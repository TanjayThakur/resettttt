"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  checkNotificationSupport,
  showLocalNotification,
} from "@/lib/push-notifications";

interface ReminderSettingsRow {
  morning_time: string | null;
  night_time: string | null;
  enabled: boolean | null;
  timezone: string | null;
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [morningTime, setMorningTime] = useState("08:00");
  const [nightTime, setNightTime] = useState("21:00");
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  // Push notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [trackerReminders, setTrackerReminders] = useState(false);

  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleLastSync, setGoogleLastSync] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/signin");
        return;
      }

      const { data: settings } = await supabase
        .from("reminder_settings")
        .select("morning_time, night_time, enabled, timezone")
        .eq("user_id", user.id)
        .maybeSingle<ReminderSettingsRow>();

      if (settings) {
        setMorningTime(settings.morning_time || "08:00");
        setNightTime(settings.night_time || "21:00");
        setEnabled(settings.enabled ?? true);
        setTimezone(settings.timezone || "Asia/Kolkata");
      }

      // Check push notification support
      const { supported, permission } = checkNotificationSupport();
      setPushSupported(supported);
      setPushPermission(permission);
      setPushEnabled(permission === "granted");

      // Load Google Calendar status
      await loadGoogleCalendarStatus();

      setIsLoading(false);
    };

    loadSettings();

    // Handle Google Calendar callback messages
    const googleParam = searchParams.get("google");
    const errorParam = searchParams.get("error");

    if (googleParam === "connected") {
      toast.success("Google Calendar connected successfully!");
      // Clean URL
      router.replace("/settings");
    } else if (errorParam) {
      toast.error(`Google Calendar error: ${errorParam}`);
      router.replace("/settings");
    }
  }, [router, searchParams]);

  const loadGoogleCalendarStatus = async () => {
    try {
      const response = await fetch("/api/google-calendar/status");
      if (response.ok) {
        const data = await response.json();
        setGoogleConnected(data.connected);
        setGoogleEmail(data.email);
        setGoogleLastSync(data.lastSync);
      }
    } catch (error) {
      console.error("Failed to load Google Calendar status:", error);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const response = await fetch("/api/google-calendar/auth");
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        toast.error("Failed to start Google Calendar connection");
      }
    } catch (error) {
      console.error("Google Calendar connect error:", error);
      toast.error("Failed to connect Google Calendar");
    }
    setIsConnectingGoogle(false);
  };

  const handleSyncGoogle = async () => {
    setIsSyncingGoogle(true);
    try {
      const response = await fetch("/api/google-calendar/sync", {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Calendar synced successfully!");
        await loadGoogleCalendarStatus();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to sync calendar");
      }
    } catch (error) {
      console.error("Google Calendar sync error:", error);
      toast.error("Failed to sync calendar");
    }
    setIsSyncingGoogle(false);
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar? This will remove all Reset Day events from your calendar.")) {
      return;
    }

    setIsDisconnectingGoogle(true);
    try {
      const response = await fetch("/api/google-calendar/disconnect", {
        method: "POST",
      });
      if (response.ok) {
        setGoogleConnected(false);
        setGoogleEmail(null);
        setGoogleLastSync(null);
        toast.success("Google Calendar disconnected");
      } else {
        toast.error("Failed to disconnect Google Calendar");
      }
    } catch (error) {
      console.error("Google Calendar disconnect error:", error);
      toast.error("Failed to disconnect Google Calendar");
    }
    setIsDisconnectingGoogle(false);
  };

  const handleEnablePush = async () => {
    const permission = await requestNotificationPermission();
    setPushPermission(permission);

    if (permission === "granted") {
      const registration = await registerServiceWorker();
      if (registration) {
        const subscription = await subscribeToPush(registration);
        if (subscription) {
          setPushEnabled(true);
          toast.success("Push notifications enabled!");
          // Show a test notification
          await showLocalNotification(
            "Notifications Enabled!",
            "You will now receive reminders for your rituals.",
            "/dashboard"
          );
        }
      }
    } else if (permission === "denied") {
      toast.error("Notification permission denied. Please enable in browser settings.");
    }
  };

  const handleDisablePush = async () => {
    const registration = await navigator.serviceWorker.ready;
    const success = await unsubscribeFromPush(registration);
    if (success) {
      setPushEnabled(false);
      toast.success("Push notifications disabled");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    const { error } = await (supabase as any)
      .from("reminder_settings")
      .upsert({
        user_id: user.id,
        morning_time: morningTime,
        night_time: nightTime,
        enabled,
        timezone,
      });

    if (error) {
      toast.error(`Failed to save settings: ${error.message}`);
    } else {
      toast.success("Settings saved!");
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm">
              Configure your reminder preferences
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Reminders</CardTitle>
            <CardDescription>
              Get reminded to complete your morning ritual and night reflection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled">Enable Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email reminders for your daily rituals
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full p-2 rounded-md border bg-background"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="morning-time">Morning Reminder Time</Label>
                <Input
                  id="morning-time"
                  type="time"
                  value={morningTime}
                  onChange={(e) => setMorningTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  When to remind you to start your morning ritual
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="night-time">Night Reminder Time</Label>
                <Input
                  id="night-time"
                  type="time"
                  value={nightTime}
                  onChange={(e) => setNightTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  When to remind you to complete your night reflection
                </p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Push Notifications</CardTitle>
            <CardDescription>
              Get browser notifications for your rituals and tracker reminders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!pushSupported ? (
              <p className="text-sm text-muted-foreground">
                Push notifications are not supported in this browser.
              </p>
            ) : pushPermission === "denied" ? (
              <div>
                <p className="text-sm text-destructive">
                  Notification permission was denied.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please enable notifications in your browser settings to use this feature.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="push-enabled">Enable Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive reminders directly in your browser
                    </p>
                  </div>
                  <Switch
                    id="push-enabled"
                    checked={pushEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleEnablePush();
                      } else {
                        handleDisablePush();
                      }
                    }}
                  />
                </div>

                {pushEnabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="tracker-reminders">30-Min Tracker Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified every 30 minutes to log your time
                        </p>
                      </div>
                      <Switch
                        id="tracker-reminders"
                        checked={trackerReminders}
                        onCheckedChange={setTrackerReminders}
                      />
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => showLocalNotification(
                        "Test Notification",
                        "This is how your notifications will appear!",
                        "/dashboard"
                      )}
                    >
                      Send Test Notification
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Google Calendar
              {googleConnected && <Badge variant="secondary">Connected</Badge>}
            </CardTitle>
            <CardDescription>
              Sync your rituals to Google Calendar for native notifications on all devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {googleConnected ? (
              <>
                <div className="p-4 rounded-lg bg-muted space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Connected Account</span>
                    <span className="text-sm font-medium">{googleEmail}</span>
                  </div>
                  {googleLastSync && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Synced</span>
                      <span className="text-sm">
                        {new Date(googleLastSync).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Events synced to your calendar:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Morning Ritual - Daily at 8:00 AM</li>
                    <li>Night Reflection - Daily at 9:00 PM</li>
                    <li>Weekly Reset - Sundays at 6:00 PM</li>
                    <li>30-min Tracker - Every 30 min (8 AM - 10 PM)</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSyncGoogle}
                    disabled={isSyncingGoogle}
                    className="flex-1"
                  >
                    {isSyncingGoogle ? "Syncing..." : "Sync Now"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnectGoogle}
                    disabled={isDisconnectingGoogle}
                  >
                    {isDisconnectingGoogle ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>Connect Google Calendar to automatically create recurring events for:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Morning Ritual (8:00 AM daily)</li>
                    <li>Night Reflection (9:00 PM daily)</li>
                    <li>Weekly Reset (Sunday 6:00 PM)</li>
                    <li>30-min Time Tracker reminders</li>
                  </ul>
                  <p className="mt-2">Google Calendar will handle all notifications across your devices.</p>
                </div>

                <Button
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="w-full"
                >
                  {isConnectingGoogle ? "Connecting..." : "Connect Google Calendar"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/onboarding">Redo Onboarding</Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Update your identity, anti-vision, vision statements and daily levers
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
