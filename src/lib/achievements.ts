import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Achievement, UserAchievement } from "./supabase/types";

export async function checkAndAwardAchievements(
  supabase: SupabaseClient<Database>,
  userId: string,
  currentStreak: number
): Promise<Achievement[]> {
  // Get all achievements
  const { data: achievements } = await supabase
    .from("achievements")
    .select("*");

  if (!achievements) return [];

  // Get user's existing achievements
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const unlockedIds = new Set(
    (userAchievements ?? []).map((ua) => (ua as { achievement_id: string }).achievement_id)
  );

  const newAchievements: Achievement[] = [];

  for (const achievement of achievements as Achievement[]) {
    // Skip if already unlocked
    if (unlockedIds.has(achievement.id)) continue;

    // Check streak requirements
    if (achievement.requirement_type === "streak" && achievement.requirement_value) {
      if (currentStreak >= achievement.requirement_value) {
        // Award achievement
        await (supabase
          .from("user_achievements") as ReturnType<typeof supabase.from>)
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
          } as Database["public"]["Tables"]["user_achievements"]["Insert"]);

        newAchievements.push(achievement);
      }
    }
  }

  return newAchievements;
}

export async function getUserAchievements(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<(UserAchievement & { achievement: Achievement })[]> {
  const { data } = await supabase
    .from("user_achievements")
    .select("*, achievements(*)")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (!data) return [];

  return data.map((ua) => ({
    ...(ua as unknown as UserAchievement),
    achievement: (ua as { achievements: Achievement }).achievements,
  }));
}

export async function getAllAchievements(
  supabase: SupabaseClient<Database>
): Promise<Achievement[]> {
  const { data } = await supabase
    .from("achievements")
    .select("*")
    .order("requirement_value");

  return (data as Achievement[]) ?? [];
}
