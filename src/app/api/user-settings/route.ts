import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET user settings
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: settings, error } = await (supabase as any)
      .from("reminder_settings")
      .select("morning_time, night_time, enabled, timezone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    // Return defaults if no settings exist
    return NextResponse.json({
      morning_time: settings?.morning_time || "08:00",
      night_time: settings?.night_time || "21:00",
      enabled: settings?.enabled ?? true,
      timezone: settings?.timezone || "Asia/Kolkata",
    });
  } catch (error) {
    console.error("User settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST (upsert) user settings
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { morning_time, night_time, enabled, timezone } = body;

    // Validate required fields
    if (!morning_time || !night_time || !timezone) {
      return NextResponse.json(
        { error: "Missing required fields: morning_time, night_time, timezone" },
        { status: 400 }
      );
    }

    const { error } = await (supabase as any)
      .from("reminder_settings")
      .upsert(
        {
          user_id: user.id,
          morning_time,
          night_time,
          enabled: enabled ?? true,
          timezone,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Failed to save user settings:", error);
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("User settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
