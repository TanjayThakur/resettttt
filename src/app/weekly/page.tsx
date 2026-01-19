"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getSundayOfWeek, XP_VALUES, getStreakMultiplier, isSunday } from "@/lib/utils";
import type { Profile, Database } from "@/lib/supabase/types";

export default function WeeklyPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [antiVision, setAntiVision] = useState("");
  const [vision, setVision] = useState("");
  const [oneYearLens, setOneYearLens] = useState("");
  const [oneMonthProject, setOneMonthProject] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

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

    const weekStart = getSundayOfWeek();

    // Check if already completed this week
    const { data: weeklyEntry } = await supabase
      .from("weekly_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start_date", weekStart)
      .single();

    if (weeklyEntry) {
      setAlreadyCompleted(true);
    }

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>();

    setProfile(profileData);

    // Pre-fill with profile's vision/anti-vision
    if (profileData) {
      setAntiVision(profileData.anti_vision ?? "");
      setVision(profileData.vision_statement ?? "");
    }

    setIsLoading(false);
  };

  const handleComplete = async () => {
    if (!antiVision.trim() || !vision.trim() || !oneYearLens.trim() || !oneMonthProject.trim()) {
      toast.error("Please fill all fields");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/signin");
      return;
    }

    const weekStart = getSundayOfWeek();
    const multiplier = getStreakMultiplier(profile?.current_streak ?? 0);
    const xpEarned = Math.round(XP_VALUES.WEEKLY * multiplier);

    // Create weekly entry
    const { error: weeklyError } = await (supabase
      .from("weekly_entries") as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        week_start_date: weekStart,
        anti_vision: antiVision.trim(),
        vision: vision.trim(),
        one_year_lens: oneYearLens.trim(),
        one_month_project: oneMonthProject.trim(),
        xp_awarded: xpEarned,
      } as Database["public"]["Tables"]["weekly_entries"]["Insert"]);

    if (weeklyError) {
      toast.error("Failed to save weekly entry");
      setIsSaving(false);
      return;
    }

    // Update profile with new vision/anti-vision
    await (supabase
      .from("profiles") as ReturnType<typeof supabase.from>)
      .update({
        anti_vision: antiVision.trim(),
        vision_statement: vision.trim(),
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
        source: "weekly",
        multiplier,
      } as Database["public"]["Tables"]["xp_log"]["Insert"]);

    toast.success(`Weekly reset complete! +${xpEarned} XP`);
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

  if (!isSunday()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Weekly Reset</CardTitle>
            <CardDescription>
              Weekly reset is only available on Sundays.
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

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Weekly Reset Complete</CardTitle>
            <CardDescription>
              You&apos;ve already completed your weekly reset this week.
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
        <div className="text-center">
          <h1 className="text-2xl font-bold">Weekly Reset</h1>
          <p className="text-muted-foreground">Deep reflection and planning</p>
        </div>

        {/* Anti-Vision */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Anti-Vision Excavation</CardTitle>
            <CardDescription>
              Describe in vivid detail the life you DON&apos;T want in 5 years
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="In 5 years, if I continue on the wrong path, I would be..."
              value={antiVision}
              onChange={(e) => setAntiVision(e.target.value)}
              rows={6}
            />
          </CardContent>
        </Card>

        {/* Vision */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vision Crafting</CardTitle>
            <CardDescription>
              Describe in vivid detail your ideal life in 5 years
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="In 5 years, my ideal life looks like..."
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              rows={6}
            />
          </CardContent>
        </Card>

        {/* 1-Year Lens */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1-Year Lens</CardTitle>
            <CardDescription>
              What must be true 1 year from now to be on track?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="In 1 year, to be on track toward my vision, I need to have..."
              value={oneYearLens}
              onChange={(e) => setOneYearLens(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* 1-Month Project */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1-Month Project</CardTitle>
            <CardDescription>
              What&apos;s the ONE project/focus for the next 30 days?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="My main focus for the next 30 days is..."
              value={oneMonthProject}
              onChange={(e) => setOneMonthProject(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Complete Button */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleComplete}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Complete Weekly Reset"}
          </Button>
        </div>
      </div>
    </div>
  );
}
