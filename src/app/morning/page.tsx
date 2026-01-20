"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getToday, XP_VALUES, getStreakMultiplier } from "@/lib/utils";
import { checkAndAwardAchievements } from "@/lib/achievements";
import type { Profile, Lever, Database } from "@/lib/supabase/types";

export default function MorningPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [selectedQuests, setSelectedQuests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [step, setStep] = useState(1); // 1: statements, 2: quest selection

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/signin");
      return;
    }

    const today = getToday();

    // Check if already completed today
    const { data: morningEntry } = await supabase
      .from("morning_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .single();

    if (morningEntry) {
      setAlreadyCompleted(true);
    }

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>();

    setProfile(profileData);

    // Load all active levers for quest selection
    const { data: leversData } = await supabase
      .from("levers")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("sort_order");

    setLevers((leversData as Lever[]) ?? []);

    // Check if quests were already selected (from night before)
    const { data: existingQuests } = await (supabase as any)
      .from("daily_quests")
      .select("lever_id")
      .eq("user_id", user.id)
      .eq("quest_date", today);

    if (existingQuests && existingQuests.length > 0) {
      setSelectedQuests(existingQuests.map((q: { lever_id: string }) => q.lever_id));
    } else {
      // Suggest 3 quests if none selected
      const suggested = (leversData as Lever[])?.slice(0, 3).map((l) => l.id) ?? [];
      setSelectedQuests(suggested);
    }

    setIsLoading(false);
  };

  const toggleQuest = (leverId: string) => {
    setSelectedQuests((prev) => {
      if (prev.includes(leverId)) {
        return prev.filter((id) => id !== leverId);
      }
      if (prev.length >= 3) {
        toast.error("Maximum 3 quests per day");
        return prev;
      }
      return [...prev, leverId];
    });
  };

  const handleComplete = async () => {
    if (selectedQuests.length < 2) {
      toast.error("Please select at least 2 quests for today");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/signin");
      return;
    }

    const today = getToday();
    const multiplier = getStreakMultiplier(profile?.current_streak ?? 0);
    const xpEarned = Math.round(XP_VALUES.MORNING * multiplier);

    // Create morning entry
    const { error: morningError } = await (supabase
      .from("morning_entries") as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        entry_date: today,
        acknowledged: true,
        xp_awarded: xpEarned,
      } as Database["public"]["Tables"]["morning_entries"]["Insert"]);

    if (morningError) {
      console.error("Morning entry error:", morningError);
      toast.error(`Failed to save: ${morningError.message}`);
      setIsSaving(false);
      return;
    }

    // Delete any existing quests for today (in case they were set last night)
    await (supabase
      .from("daily_quests") as ReturnType<typeof supabase.from>)
      .delete()
      .eq("user_id", user.id)
      .eq("quest_date", today);

    // Create today's quests
    const questsToInsert = selectedQuests.map((leverId) => ({
      user_id: user.id,
      lever_id: leverId,
      quest_date: today,
    }));

    await (supabase
      .from("daily_quests") as ReturnType<typeof supabase.from>)
      .insert(questsToInsert as Database["public"]["Tables"]["daily_quests"]["Insert"][]);

    // Update XP
    await (supabase
      .from("profiles") as ReturnType<typeof supabase.from>)
      .update({
        total_xp: (profile?.total_xp ?? 0) + xpEarned,
        updated_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", user.id);

    // Log XP
    await (supabase
      .from("xp_log") as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        amount: xpEarned,
        source: "morning",
        multiplier,
      } as Database["public"]["Tables"]["xp_log"]["Insert"]);

    // Check for new achievements
    const newAchievements = await checkAndAwardAchievements(
      supabase,
      user.id,
      profile?.current_streak ?? 0
    );

    if (newAchievements.length > 0) {
      for (const achievement of newAchievements) {
        toast.success(`Achievement unlocked: ${achievement.name}! ${achievement.badge_icon}`);
      }
    }

    toast.success(`Morning ritual complete! +${xpEarned} XP`);
    router.push("/dashboard");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Morning Complete</CardTitle>
            <CardDescription>
              You&apos;ve already completed your morning ritual today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center">Morning Ritual</h1>

        {step === 1 && (
          <>
            {/* Identity Statement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Identity</CardTitle>
                <CardDescription>Read this aloud to yourself</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium p-4 bg-muted rounded-lg">
                  {profile?.identity_statement || "Set your identity statement in onboarding"}
                </p>
              </CardContent>
            </Card>

            {/* Anti-Vision */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Anti-Vision</CardTitle>
                <CardDescription>What you&apos;re avoiding - remember the cost of inaction</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-base p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  {profile?.anti_vision || "Set your anti-vision in onboarding"}
                </p>
              </CardContent>
            </Card>

            {/* Vision */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Vision</CardTitle>
                <CardDescription>What you&apos;re building - your ideal future</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-base p-4 bg-primary/10 rounded-lg border border-primary/20">
                  {profile?.vision_statement || "Set your vision statement in onboarding"}
                </p>
              </CardContent>
            </Card>

            <Button className="w-full" onClick={() => setStep(2)}>
              Continue to Quest Selection
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            {/* Quest Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today&apos;s Quests</CardTitle>
                <CardDescription>
                  Select 2-3 levers to focus on today ({selectedQuests.length}/3 selected)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {levers.map((lever) => (
                    <label
                      key={lever.id}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedQuests.includes(lever.id)}
                        onCheckedChange={() => toggleQuest(lever.id)}
                      />
                      <div className="flex-1">
                        <span className="font-medium">{lever.title}</span>
                        {lever.category && (
                          <p className="text-sm text-muted-foreground">{lever.category}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Complete Button */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleComplete}
                disabled={isSaving || selectedQuests.length < 2}
              >
                {isSaving ? "Saving..." : "Complete Morning Ritual"}
              </Button>
            </div>
          </>
        )}

        {/* Cancel button */}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => router.push("/dashboard")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
