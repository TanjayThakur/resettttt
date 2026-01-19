"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getToday, XP_VALUES, getStreakMultiplier } from "@/lib/utils";
import { checkAndAwardAchievements } from "@/lib/achievements";
import type { Profile, Lever, DailyQuest, Database } from "@/lib/supabase/types";

export default function NightPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayQuests, setTodayQuests] = useState<(DailyQuest & { lever: Lever | null })[]>([]);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [win, setWin] = useState("");
  const [avoidance, setAvoidance] = useState("");
  const [aliveMoment, setAliveMoment] = useState("");
  const [journalEntry, setJournalEntry] = useState("");
  const [tomorrowQuests, setTomorrowQuests] = useState<string[]>([]);

  // Calculate word count for journal entry
  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };
  const journalWordCount = getWordCount(journalEntry);
  const MIN_JOURNAL_WORDS = 100;
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

    const today = getToday();

    // Check if already completed today
    const { data: nightEntry } = await supabase
      .from("night_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .single();

    if (nightEntry) {
      setAlreadyCompleted(true);
    }

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>();

    setProfile(profileData);

    // Load today's quests with lever info
    const { data: questsData } = await supabase
      .from("daily_quests")
      .select("*, levers(*)")
      .eq("user_id", user.id)
      .eq("quest_date", today);

    type QuestWithLever = DailyQuest & { levers: Lever | null };
    const rawQuests = (questsData ?? []) as unknown as QuestWithLever[];
    const formattedQuests = rawQuests.map((q) => ({
      ...q,
      lever: q.levers,
    }));
    setTodayQuests(formattedQuests);

    // Load all levers for tomorrow's selection
    const { data: leversData } = await supabase
      .from("levers")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("sort_order");

    setLevers((leversData as Lever[]) ?? []);

    // Suggest tomorrow's quests (different from today's)
    const todayLeverIds = rawQuests.map((q) => q.lever_id);
    const leversArray = (leversData as Lever[]) ?? [];
    const availableLevers = leversArray.filter((l) => !todayLeverIds.includes(l.id));
    const suggested = availableLevers.slice(0, 3).map((l) => l.id);
    setTomorrowQuests(suggested);

    setIsLoading(false);
  };

  const toggleQuestComplete = async (questId: string, completed: boolean) => {
    const supabase = createClient();
    await (supabase
      .from("daily_quests") as ReturnType<typeof supabase.from>)
      .update({ is_completed: completed } as Database["public"]["Tables"]["daily_quests"]["Update"])
      .eq("id", questId);

    setTodayQuests((prev) =>
      prev.map((q) =>
        q.id === questId ? { ...q, is_completed: completed } : q
      )
    );
  };

  const toggleTomorrowQuest = (leverId: string) => {
    setTomorrowQuests((prev) => {
      if (prev.includes(leverId)) {
        return prev.filter((id) => id !== leverId);
      }
      if (prev.length >= 3) {
        toast.error("Maximum 3 quests");
        return prev;
      }
      return [...prev, leverId];
    });
  };

  const handleComplete = async () => {
    if (!win.trim() || !avoidance.trim() || !aliveMoment.trim()) {
      toast.error("Please fill all reflection fields");
      return;
    }
    if (journalWordCount < MIN_JOURNAL_WORDS) {
      toast.error(`Journal entry must be at least ${MIN_JOURNAL_WORDS} words (currently ${journalWordCount})`);
      return;
    }
    if (tomorrowQuests.length < 2) {
      toast.error("Please select at least 2 quests for tomorrow");
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const multiplier = getStreakMultiplier(profile?.current_streak ?? 0);
    const xpEarned = Math.round(XP_VALUES.NIGHT * multiplier);

    // Create night entry
    const { error: nightError } = await (supabase
      .from("night_entries") as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        entry_date: today,
        win: win.trim(),
        avoidance: avoidance.trim(),
        alive_moment: aliveMoment.trim(),
        journal_entry: journalEntry.trim(),
        xp_awarded: xpEarned,
      } as Database["public"]["Tables"]["night_entries"]["Insert"]);

    if (nightError) {
      console.error("Night entry error:", nightError);
      toast.error(`Failed to save night entry: ${nightError.message}`);
      setIsSaving(false);
      return;
    }

    // Create tomorrow's quests
    const questsToInsert = tomorrowQuests.map((leverId) => ({
      user_id: user.id,
      lever_id: leverId,
      quest_date: tomorrowDate,
    }));

    await (supabase
      .from("daily_quests") as ReturnType<typeof supabase.from>)
      .insert(questsToInsert as Database["public"]["Tables"]["daily_quests"]["Insert"][]);

    // Update streak and XP
    const lastActivity = profile?.last_activity_date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = 1;
    if (lastActivity === yesterdayStr || lastActivity === today) {
      newStreak = (profile?.current_streak ?? 0) + (lastActivity === today ? 0 : 1);
    }

    await (supabase
      .from("profiles") as ReturnType<typeof supabase.from>)
      .update({
        total_xp: (profile?.total_xp ?? 0) + xpEarned,
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, profile?.longest_streak ?? 0),
        last_activity_date: today,
        updated_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", user.id);

    // Log XP
    await (supabase
      .from("xp_log") as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        amount: xpEarned,
        source: "night",
        multiplier,
      } as Database["public"]["Tables"]["xp_log"]["Insert"]);

    // Check for new achievements
    const newAchievements = await checkAndAwardAchievements(supabase, user.id, newStreak);

    if (newAchievements.length > 0) {
      for (const achievement of newAchievements) {
        toast.success(`Achievement unlocked: ${achievement.name}! ${achievement.badge_icon}`);
      }
    }

    toast.success(`Night complete! +${xpEarned} XP`);
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
            <CardTitle>Night Complete</CardTitle>
            <CardDescription>
              You&apos;ve already completed your night reflection today.
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
        <h1 className="text-2xl font-bold text-center">Night Reflection</h1>

        {/* Today's Quests Review */}
        {todayQuests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today&apos;s Quests</CardTitle>
              <CardDescription>Mark completed quests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayQuests.map((quest) => (
                <label
                  key={quest.id}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={quest.is_completed}
                    onCheckedChange={(checked) =>
                      toggleQuestComplete(quest.id, checked === true)
                    }
                  />
                  <span className={quest.is_completed ? "line-through text-muted-foreground" : ""}>
                    {quest.lever?.title ?? "Unknown quest"}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Reflection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Reflection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                What was your biggest win today?
              </label>
              <Textarea
                placeholder="My biggest win was..."
                value={win}
                onChange={(e) => setWin(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                What did you avoid or resist?
              </label>
              <Textarea
                placeholder="I avoided/resisted..."
                value={avoidance}
                onChange={(e) => setAvoidance(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                When did you feel most alive?
              </label>
              <Textarea
                placeholder="I felt most alive when..."
                value={aliveMoment}
                onChange={(e) => setAliveMoment(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Journal Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Night Journal</CardTitle>
            <CardDescription>
              Write freely about your day. Minimum {MIN_JOURNAL_WORDS} words required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Textarea
                placeholder="Write about your day... What happened? What did you learn? What are you thinking about? Let your thoughts flow freely..."
                value={journalEntry}
                onChange={(e) => setJournalEntry(e.target.value)}
                rows={8}
                className="min-h-[200px]"
              />
              <div className="flex justify-between items-center mt-2">
                <p className={`text-sm ${journalWordCount >= MIN_JOURNAL_WORDS ? "text-green-500" : "text-muted-foreground"}`}>
                  {journalWordCount} / {MIN_JOURNAL_WORDS} words
                  {journalWordCount >= MIN_JOURNAL_WORDS && " ✓"}
                </p>
                {journalWordCount < MIN_JOURNAL_WORDS && (
                  <p className="text-sm text-muted-foreground">
                    {MIN_JOURNAL_WORDS - journalWordCount} more words needed
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tomorrow's Quests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tomorrow&apos;s Quests</CardTitle>
            <CardDescription>
              Select 2-3 quests ({tomorrowQuests.length}/3 selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {levers.map((lever) => (
                <label
                  key={lever.id}
                  className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={tomorrowQuests.includes(lever.id)}
                    onCheckedChange={() => toggleTomorrowQuest(lever.id)}
                  />
                  <span className="flex-1 text-sm">{lever.title}</span>
                </label>
              ))}
            </div>
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
            disabled={isSaving || journalWordCount < MIN_JOURNAL_WORDS}
          >
            {isSaving ? "Saving..." : journalWordCount < MIN_JOURNAL_WORDS ? `Write ${MIN_JOURNAL_WORDS - journalWordCount} more words` : "Complete Night Reflection"}
          </Button>
        </div>
      </div>
    </div>
  );
}
