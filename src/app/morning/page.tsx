"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type UserSettingsRow = {
  id: string;
  morning_time: string | null;
  night_time: string | null;
  enabled: boolean | null;
  timezone: string | null;
};

export default function SettingsPage() {
  const [morningTime, setMorningTime] = useState("08:00");
  const [nightTime, setNightTime] = useState("21:00");
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: settings, error } = await supabase
      .from("user_settings")
      .select("id, morning_time, night_time, enabled, timezone")
      .eq("id", user.id)
      .maybeSingle<UserSettingsRow>();

    if (error) {
      console.error(error);
      toast.error("Failed to load settings");
      setLoading(false);
      return;
    }

    if (settings) {
      setMorningTime(settings.morning_time || "08:00");
      setNightTime(settings.night_time || "21:00");
      setEnabled(settings.enabled ?? true);
      setTimezone(settings.timezone || "Asia/Kolkata");
    }

    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You are not logged in");
      setSaving(false);
      return;
    }

    const { error } = await (supabase as any)
      .from("user_settings")
      .upsert({
        id: user.id,
        morning_time: morningTime,
        night_time: nightTime,
        enabled,
        timezone,
      });

    if (error) {
      console.error(error);
      toast.error("Failed to save settings");
      setSaving(false);
      return;
    }

    toast.success("Settings saved");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="enabled">Reminders Enabled</Label>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={(v) => setEnabled(v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Morning Time</Label>
              <Input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Night Time</Label>
              <Input
                type="time"
                value={nightTime}
                onChange={(e) => setNightTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
              />
            </div>

            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
