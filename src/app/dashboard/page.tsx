import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { DailyTasks } from "@/components/daily-tasks";
import { InterruptCard } from "@/components/interrupt-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Profile, MorningEntry, InterruptEntry, NightEntry, DailyQuest, Lever, Achievement, UserAchievement } from "@/lib/supabase/types";
import { getTodayIST, isSunday, getSundayOfWeek, getStreakMultiplier } from "@/lib/utils";
import { getUserAchievements, getAllAchievements } from "@/lib/achievements";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const today = getTodayIST();
  const weekStart = getSundayOfWeek();

  // Load profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Check if onboarding complete
  if (!profile?.completed_onboarding) {
    redirect("/onboarding");
  }

  // Load today's morning entry
  const { data: morningEntry } = await supabase
    .from("morning_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("entry_date", today)
    .single<MorningEntry>();

  // Load today's interrupts
  const { data: interruptEntries } = await supabase
    .from("interrupt_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("entry_date", today)
    .order("interrupt_number");

  const interrupts = (interruptEntries ?? []) as InterruptEntry[];
  const completedInterrupts = interrupts.length;

  // Load today's night entry
  const { data: nightEntry } = await supabase
    .from("night_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("entry_date", today)
    .single<NightEntry>();

  // Load weekly entry (if Sunday)
  const { data: weeklyEntryData } = await supabase
    .from("weekly_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start_date", weekStart)
    .single();

  const weeklyEntry = weeklyEntryData as { xp_awarded: number } | null;

  // Load today's quests
  const { data: questsData } = await supabase
    .from("daily_quests")
    .select("*, levers(*)")
    .eq("user_id", user.id)
    .eq("quest_date", today);

  type QuestWithLever = DailyQuest & { levers: Lever | null };
  const rawQuests = (questsData ?? []) as unknown as QuestWithLever[];
  const quests = rawQuests.map((q) => ({
    ...q,
    lever: q.levers,
  }));

  // Load achievements
  const userAchievements = await getUserAchievements(supabase, user.id);
  const allAchievements = await getAllAchievements(supabase);

  const currentStreak = profile?.current_streak ?? 0;
  const totalXp = profile?.total_xp ?? 0;
  const level = Math.floor(totalXp / 100);
  const xpInLevel = totalXp % 100;
  const multiplier = getStreakMultiplier(currentStreak);

  // Get completed interrupt numbers for the client component
  const completedInterruptNumbers = interrupts.map((i) => i.interrupt_number);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/tracker">Tracker</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/stats">Stats</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">Settings</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Streak</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {currentStreak}
                {currentStreak > 0 && <span className="text-orange-500">🔥</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {multiplier}x XP multiplier
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total XP</CardDescription>
              <CardTitle className="text-3xl">{totalXp}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Level {level}</CardDescription>
              <CardTitle className="text-3xl">{xpInLevel}/100</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={xpInLevel} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today&apos;s Quests</CardDescription>
              <CardTitle className="text-3xl">
                {quests.filter((q) => q.is_completed).length}/{quests.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Rituals Grid */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {/* Morning */}
          <Card className={morningEntry ? "border-primary/50" : ""}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Morning Ritual</CardTitle>
                  <CardDescription>Review statements & pick quests</CardDescription>
                </div>
                {morningEntry ? (
                  <Badge variant="secondary">Complete</Badge>
                ) : (
                  <Badge>Available</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {morningEntry ? (
                <p className="text-sm text-muted-foreground">
                  +{morningEntry.xp_awarded} XP earned
                </p>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/morning">Start Morning Ritual</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Interrupts - Client component with real-time updates */}
          <InterruptCard
            userId={user.id}
            initialCompletedNumbers={completedInterruptNumbers}
          />

          {/* Night */}
          <Card className={nightEntry ? "border-primary/50" : ""}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Night Reflection</CardTitle>
                  <CardDescription>Reflect & plan tomorrow</CardDescription>
                </div>
                {nightEntry ? (
                  <Badge variant="secondary">Complete</Badge>
                ) : (
                  <Badge variant="outline">Evening</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {nightEntry ? (
                <p className="text-sm text-muted-foreground">
                  +{nightEntry.xp_awarded} XP earned
                </p>
              ) : (
                <Button asChild variant={morningEntry ? "default" : "outline"} className="w-full">
                  <Link href="/night">Start Night Reflection</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Weekly Reset (Sunday only) */}
          <Card className={weeklyEntry ? "border-primary/50" : isSunday() ? "" : "opacity-50"}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Weekly Reset</CardTitle>
                  <CardDescription>Deep reflection (Sundays)</CardDescription>
                </div>
                {weeklyEntry ? (
                  <Badge variant="secondary">Complete</Badge>
                ) : isSunday() ? (
                  <Badge>Available</Badge>
                ) : (
                  <Badge variant="outline">Sunday</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {weeklyEntry ? (
                <p className="text-sm text-muted-foreground">
                  +{weeklyEntry.xp_awarded} XP earned
                </p>
              ) : isSunday() ? (
                <Button asChild className="w-full">
                  <Link href="/weekly">Start Weekly Reset</Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Available on Sundays
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today's Quests */}
        {quests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today&apos;s Quests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quests.map((quest) => (
                  <div
                    key={quest.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      quest.is_completed ? "bg-primary/10" : ""
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        quest.is_completed
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}
                    >
                      {quest.is_completed && "✓"}
                    </div>
                    <span
                      className={
                        quest.is_completed ? "line-through text-muted-foreground" : ""
                      }
                    >
                      {quest.lever?.title ?? "Unknown quest"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Mark quests complete in your Night Reflection
              </p>
            </CardContent>
          </Card>
        )}

        {/* Daily Tasks */}
        <DailyTasks userId={user.id} currentStreak={currentStreak} />

        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Achievements</CardTitle>
            <CardDescription>
              {userAchievements.length}/{allAchievements.length} unlocked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {allAchievements.map((achievement) => {
                const unlocked = userAchievements.some(
                  (ua) => ua.achievement_id === achievement.id
                );
                return (
                  <div
                    key={achievement.id}
                    className={`flex flex-col items-center p-3 rounded-lg border ${
                      unlocked ? "bg-primary/10 border-primary/50" : "opacity-40"
                    }`}
                    title={achievement.description ?? ""}
                  >
                    <span className="text-2xl">{achievement.badge_icon}</span>
                    <span className="text-xs mt-1 text-center">{achievement.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {achievement.requirement_value} days
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
