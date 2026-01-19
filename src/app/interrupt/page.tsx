"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getToday, XP_VALUES, getStreakMultiplier, INTERRUPT_TIMES, getCurrentInterruptNumber } from "@/lib/utils";
import type { Profile, Prompt, InterruptEntry, Database } from "@/lib/supabase/types";

export default function InterruptPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [response, setResponse] = useState("");
  const [completedInterrupts, setCompletedInterrupts] = useState<InterruptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentInterruptNum, setCurrentInterruptNum] = useState<number | null>(null);

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
    const currentNum = getCurrentInterruptNumber();
    setCurrentInterruptNum(currentNum);

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>();

    setProfile(profileData);

    // Load today's completed interrupts
    const { data: interruptsData } = await supabase
      .from("interrupt_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .order("interrupt_number");

    setCompletedInterrupts((interruptsData as InterruptEntry[]) ?? []);

    // Load a random prompt
    const { data: promptsData } = await supabase
      .from("prompts")
      .select("*")
      .eq("is_active", true);

    if (promptsData && promptsData.length > 0) {
      const randomPrompt = promptsData[Math.floor(Math.random() * promptsData.length)] as Prompt;
      setPrompt(randomPrompt);
    }

    setIsLoading(false);
  };

  const getNextInterruptNumber = (): number | null => {
    if (!currentInterruptNum) return null;

    const completedNumbers = completedInterrupts.map((i) => i.interrupt_number);

    // Find the first uncompleted interrupt up to current time
    for (let i = 1; i <= currentInterruptNum; i++) {
      if (!completedNumbers.includes(i)) {
        return i;
      }
    }
    return null;
  };

  const nextInterrupt = getNextInterruptNumber();

  const handleSubmit = async () => {
    if (!response.trim()) {
      toast.error("Please enter a response");
      return;
    }
    if (!nextInterrupt) {
      toast.error("No interrupt available");
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
    const xpEarned = Math.round(XP_VALUES.INTERRUPT * multiplier);

    // Create interrupt entry
    const { error: interruptError } = await (supabase
      .from("interrupt_entries") as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        entry_date: today,
        interrupt_number: nextInterrupt,
        prompt_id: prompt?.id,
        response: response.trim(),
        xp_awarded: xpEarned,
      } as Database["public"]["Tables"]["interrupt_entries"]["Insert"]);

    if (interruptError) {
      toast.error("Failed to save interrupt");
      setIsSaving(false);
      return;
    }

    // Update XP
    let totalXpEarned = xpEarned;

    // Check if all 6 interrupts complete (including this one)
    const newCompletedCount = completedInterrupts.length + 1;
    if (newCompletedCount === 6) {
      const bonus = Math.round(XP_VALUES.ALL_INTERRUPTS_BONUS * multiplier);
      totalXpEarned += bonus;
      toast.success(`All interrupts complete! Bonus: +${bonus} XP`);
    }

    await (supabase
      .from("profiles") as ReturnType<typeof supabase.from>)
      .update({
        total_xp: (profile?.total_xp ?? 0) + totalXpEarned,
        updated_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", user.id);

    // Log XP
    await (supabase
      .from("xp_log") as ReturnType<typeof supabase.from>)
      .insert({
        user_id: user.id,
        amount: totalXpEarned,
        source: "interrupt",
        multiplier,
      } as Database["public"]["Tables"]["xp_log"]["Insert"]);

    toast.success(`Interrupt complete! +${xpEarned} XP`);
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

  if (!currentInterruptNum) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Too Early</CardTitle>
            <CardDescription>
              Your first interrupt starts at 9:00 AM.
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

  if (!nextInterrupt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>All Caught Up!</CardTitle>
            <CardDescription>
              You&apos;ve completed all available interrupts.
              {completedInterrupts.length < 6 && ` Next one at ${INTERRUPT_TIMES[completedInterrupts.length]?.time || "tomorrow"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Completed: {completedInterrupts.length}/6 today
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const interruptInfo = INTERRUPT_TIMES.find((i) => i.number === nextInterrupt);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Interrupt #{nextInterrupt}</h1>
          <p className="text-muted-foreground">{interruptInfo?.time}</p>
        </div>

        {/* Interrupt Progress */}
        <div className="flex justify-center gap-2">
          {INTERRUPT_TIMES.map((t) => (
            <div
              key={t.number}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                completedInterrupts.some((i) => i.interrupt_number === t.number)
                  ? "bg-primary text-primary-foreground"
                  : t.number === nextInterrupt
                  ? "bg-accent border-2 border-primary"
                  : t.number <= currentInterruptNum
                  ? "bg-destructive/20 text-destructive"
                  : "bg-muted"
              }`}
            >
              {t.number}
            </div>
          ))}
        </div>

        {/* Prompt */}
        <Card>
          <CardHeader>
            <CardDescription>Reflect on this prompt</CardDescription>
            <CardTitle className="text-xl">{prompt?.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Your response (1-2 sentences)..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSaving || !response.trim()}
              >
                {isSaving ? "Saving..." : "Submit"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
