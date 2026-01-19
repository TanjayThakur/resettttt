"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const DEFAULT_LEVERS = [
  { title: "30 min exercise", category: "health" },
  { title: "7+ hours sleep", category: "health" },
  { title: "Drink 8 glasses water", category: "health" },
  { title: "2-hour deep work block", category: "productivity" },
  { title: "Clear inbox to zero", category: "productivity" },
  { title: "Learn something new", category: "productivity" },
  { title: "Connect with friend/family", category: "relationships" },
  { title: "Express gratitude to someone", category: "relationships" },
  { title: "Create something", category: "creativity" },
  { title: "Journal/reflect", category: "creativity" },
  { title: "10 min meditation", category: "mindfulness" },
  { title: "No phone first hour", category: "mindfulness" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [identityStatement, setIdentityStatement] = useState("");
  const [antiVision, setAntiVision] = useState("");
  const [visionStatement, setVisionStatement] = useState("");
  const [selectedLevers, setSelectedLevers] = useState<string[]>(
    DEFAULT_LEVERS.map((l) => l.title)
  );
  const [customLever, setCustomLever] = useState("");

  const totalSteps = 6;
  const progress = (step / totalSteps) * 100;

  const toggleLever = (title: string) => {
    setSelectedLevers((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  const addCustomLever = () => {
    if (customLever.trim() && !selectedLevers.includes(customLever.trim())) {
      setSelectedLevers((prev) => [...prev, customLever.trim()]);
      setCustomLever("");
    }
  };

  const handleComplete = async () => {
    if (selectedLevers.length < 5) {
      toast.error("Please select at least 5 levers");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      toast.error("Please sign in first");
      router.push("/auth/signin");
      return;
    }

    const userId = user.id;
    console.log("Session user ID:", userId);

    // Step 1: Upsert profile (create if not exists, update if exists)
    console.log("Upserting profile for user:", userId);
    const { error: profileError } = await (supabase
      .from("profiles") as unknown as { upsert: (data: Record<string, unknown>) => Promise<{ error: { message: string } | null }> })
      .upsert({
        id: userId,
        identity_statement: identityStatement,
        anti_vision: antiVision,
        vision_statement: visionStatement,
        current_streak: 0,
        longest_streak: 0,
        total_xp: 0,
        completed_onboarding: true,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      toast.error(`Failed to save profile: ${profileError.message}`);
      setIsLoading(false);
      return;
    }

    // Step 2: Delete existing levers for this user
    console.log("Deleting existing levers for user:", userId);
    const { error: deleteError } = await (supabase
      .from("levers") as unknown as { delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } })
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Delete levers error:", deleteError);
      toast.error(`Failed to clear old levers: ${deleteError.message}`);
      setIsLoading(false);
      return;
    }

    // Step 3: Insert new levers
    const leversToInsert = selectedLevers.map((title, index) => {
      const defaultLever = DEFAULT_LEVERS.find((l) => l.title === title);
      return {
        user_id: userId,
        title,
        category: defaultLever?.category ?? "general",
        sort_order: index,
        is_active: true,
      };
    });

    console.log("Inserting levers:", leversToInsert);

    const { error: leversError } = await (supabase
      .from("levers") as unknown as { insert: (data: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }> })
      .insert(leversToInsert);

    if (leversError) {
      console.error("Lever insert error:", leversError);
      toast.error(`Failed to save levers: ${leversError.message}`);
      setIsLoading(false);
      return;
    }

    toast.success("Setup complete!");
    router.push("/dashboard");
    router.refresh();
  };

  const canProceed = () => {
    switch (step) {
      case 2:
        return identityStatement.trim().length > 0;
      case 3:
        return antiVision.trim().length > 0;
      case 4:
        return visionStatement.trim().length > 0;
      case 5:
        return selectedLevers.length >= 5;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Progress value={progress} className="mb-4" />
          <CardDescription>Step {step} of {totalSteps}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <CardTitle className="text-2xl">Welcome to Reset Day</CardTitle>
              <p className="text-muted-foreground">
                Reset Day is your daily system for morning rituals, mindful interrupts,
                and nightly reflection. Based on Dan Koe&apos;s framework.
              </p>
              <p className="text-muted-foreground">
                Let&apos;s set up your personal statements and daily levers.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <CardTitle className="text-xl">Who do you want to become?</CardTitle>
              <p className="text-muted-foreground text-sm">
                Write your identity statement. This is who you are becoming.
              </p>
              <p className="text-xs text-muted-foreground italic">
                Example: &quot;I am a disciplined creator who ships meaningful work daily&quot;
              </p>
              <Textarea
                placeholder="I am..."
                value={identityStatement}
                onChange={(e) => setIdentityStatement(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <CardTitle className="text-xl">What life do you refuse to live?</CardTitle>
              <p className="text-muted-foreground text-sm">
                Write your anti-vision. This is what you&apos;re moving away from.
              </p>
              <p className="text-xs text-muted-foreground italic">
                Example: &quot;Distracted, reactive, letting days blur together without purpose&quot;
              </p>
              <Textarea
                placeholder="I refuse to..."
                value={antiVision}
                onChange={(e) => setAntiVision(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <CardTitle className="text-xl">What&apos;s your ideal future?</CardTitle>
              <p className="text-muted-foreground text-sm">
                Write your vision statement. This is what you&apos;re moving toward.
              </p>
              <p className="text-xs text-muted-foreground italic">
                Example: &quot;Focused mornings, creative flow, deep relationships, financial freedom&quot;
              </p>
              <Textarea
                placeholder="My ideal life includes..."
                value={visionStatement}
                onChange={(e) => setVisionStatement(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <CardTitle className="text-xl">Configure Your Daily Levers</CardTitle>
              <p className="text-muted-foreground text-sm">
                Select at least 5 levers. You&apos;ll pick 2-3 each morning as quests.
              </p>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {DEFAULT_LEVERS.map((lever) => (
                  <label
                    key={lever.title}
                    className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedLevers.includes(lever.title)}
                      onCheckedChange={() => toggleLever(lever.title)}
                    />
                    <span className="flex-1">{lever.title}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {lever.category}
                    </span>
                  </label>
                ))}
                {selectedLevers
                  .filter((t) => !DEFAULT_LEVERS.find((l) => l.title === t))
                  .map((title) => (
                    <label
                      key={title}
                      className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => toggleLever(title)}
                      />
                      <span className="flex-1">{title}</span>
                      <span className="text-xs text-muted-foreground">custom</span>
                    </label>
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom lever..."
                  value={customLever}
                  onChange={(e) => setCustomLever(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomLever()}
                />
                <Button type="button" variant="outline" onClick={addCustomLever}>
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Selected: {selectedLevers.length} (minimum 5)
              </p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <CardTitle className="text-xl">You&apos;re All Set!</CardTitle>
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-accent">
                  <p className="font-medium mb-1">Identity</p>
                  <p className="text-muted-foreground">{identityStatement}</p>
                </div>
                <div className="p-3 rounded-lg bg-accent">
                  <p className="font-medium mb-1">Anti-Vision</p>
                  <p className="text-muted-foreground">{antiVision}</p>
                </div>
                <div className="p-3 rounded-lg bg-accent">
                  <p className="font-medium mb-1">Vision</p>
                  <p className="text-muted-foreground">{visionStatement}</p>
                </div>
                <div className="p-3 rounded-lg bg-accent">
                  <p className="font-medium mb-1">Daily Levers ({selectedLevers.length})</p>
                  <p className="text-muted-foreground">
                    {selectedLevers.slice(0, 5).join(", ")}
                    {selectedLevers.length > 5 && ` +${selectedLevers.length - 5} more`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
            <div className="flex-1" />
            {step < 6 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={isLoading}>
                {isLoading ? "Saving..." : "Start Your Journey"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
