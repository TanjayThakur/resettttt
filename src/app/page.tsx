import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { Profile } from "@/lib/supabase/types";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if user completed onboarding
    const { data: profile } = await supabase
      .from("profiles")
      .select("completed_onboarding")
      .eq("id", user.id)
      .single<Pick<Profile, "completed_onboarding">>();

    if (profile?.completed_onboarding) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Day</CardTitle>
          <CardDescription>
            Daily system for morning rituals, interrupts, and reflection
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild className="w-full">
            <Link href="/auth/signin">Get Started</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
