import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile, XpLog, MorningEntry, NightEntry, InterruptEntry, DailyTask } from "@/lib/supabase/types";
import { HeatmapCalendar } from "@/components/heatmap-calendar";
import { XpChart } from "@/components/xp-chart";

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Load profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // Load XP log for chart (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: xpLogData } = await supabase
    .from("xp_log")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at");

  const xpLog = (xpLogData ?? []) as XpLog[];

  // Aggregate XP by date for chart
  const xpByDate = new Map<string, number>();
  xpLog.forEach((log) => {
    const date = log.created_at.split("T")[0];
    xpByDate.set(date, (xpByDate.get(date) ?? 0) + log.amount);
  });

  const xpChartData = Array.from(xpByDate.entries())
    .map(([date, xp]) => ({ date, xp }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Load activity data for heatmap (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [morningData, nightData, interruptData, tasksData] = await Promise.all([
    supabase
      .from("morning_entries")
      .select("entry_date")
      .eq("user_id", user.id)
      .gte("entry_date", ninetyDaysAgo.toISOString().split("T")[0]),
    supabase
      .from("night_entries")
      .select("entry_date")
      .eq("user_id", user.id)
      .gte("entry_date", ninetyDaysAgo.toISOString().split("T")[0]),
    supabase
      .from("interrupt_entries")
      .select("entry_date")
      .eq("user_id", user.id)
      .gte("entry_date", ninetyDaysAgo.toISOString().split("T")[0]),
    supabase
      .from("daily_tasks")
      .select("date, is_done")
      .eq("user_id", user.id)
      .eq("is_done", true)
      .gte("date", ninetyDaysAgo.toISOString().split("T")[0]),
  ]);

  // Count completed tasks per day
  const tasksByDate = new Map<string, number>();
  ((tasksData.data ?? []) as { date: string; is_done: boolean }[]).forEach((t) => {
    tasksByDate.set(t.date, (tasksByDate.get(t.date) ?? 0) + 1);
  });

  const totalTasksCompleted = tasksData.data?.length ?? 0;

  // Count activities per day
  const activityByDate = new Map<string, number>();

  (morningData.data ?? []).forEach((e) => {
    const date = (e as { entry_date: string }).entry_date;
    activityByDate.set(date, (activityByDate.get(date) ?? 0) + 1);
  });

  (nightData.data ?? []).forEach((e) => {
    const date = (e as { entry_date: string }).entry_date;
    activityByDate.set(date, (activityByDate.get(date) ?? 0) + 1);
  });

  (interruptData.data ?? []).forEach((e) => {
    const date = (e as { entry_date: string }).entry_date;
    activityByDate.set(date, (activityByDate.get(date) ?? 0) + 1);
  });

  // Include tasks in activity count
  tasksByDate.forEach((count, date) => {
    activityByDate.set(date, (activityByDate.get(date) ?? 0) + count);
  });

  const heatmapData = Array.from(activityByDate.entries())
    .map(([date, count]) => ({ date, count }));

  // Calculate stats
  const totalDays = activityByDate.size;
  const totalActivities = Array.from(activityByDate.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Statistics</h1>
            <p className="text-muted-foreground text-sm">
              Your progress over time
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total XP</CardDescription>
              <CardTitle className="text-3xl">{profile?.total_xp ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Streak</CardDescription>
              <CardTitle className="text-3xl">{profile?.current_streak ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Longest Streak</CardDescription>
              <CardTitle className="text-3xl">{profile?.longest_streak ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Days</CardDescription>
              <CardTitle className="text-3xl">{totalDays}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Activity Heatmap */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Activity Heatmap</CardTitle>
            <CardDescription>Your activity over the last 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            <HeatmapCalendar data={heatmapData} days={90} />
          </CardContent>
        </Card>

        {/* XP Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>XP Progress</CardTitle>
            <CardDescription>Cumulative XP over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <XpChart data={xpChartData} />
          </CardContent>
        </Card>

        {/* Activity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Breakdown</CardTitle>
            <CardDescription>Last 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-accent">
                <p className="text-sm text-muted-foreground">Morning Rituals</p>
                <p className="text-2xl font-bold">{morningData.data?.length ?? 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent">
                <p className="text-sm text-muted-foreground">Night Reflections</p>
                <p className="text-2xl font-bold">{nightData.data?.length ?? 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent">
                <p className="text-sm text-muted-foreground">Interrupts</p>
                <p className="text-2xl font-bold">{interruptData.data?.length ?? 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent">
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">{totalTasksCompleted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
