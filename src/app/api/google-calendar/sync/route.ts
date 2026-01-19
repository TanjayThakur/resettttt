import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, syncAllEvents } from "@/lib/google-calendar";

type GoogleCalendarTokenRow = {
  calendar_id: string | null;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Get ONLY the field we need + type it
  const { data: tokenData } = await supabase
    .from("google_calendar_tokens")
    .select("calendar_id")
    .eq("user_id", user.id)
    .maybeSingle<GoogleCalendarTokenRow>();

  const calendarId = tokenData?.calendar_id ?? null;

  if (!calendarId) {
    return NextResponse.json(
      { error: "Google Calendar not connected" },
      { status: 400 }
    );
  }

  try {
    // Get valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(user.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to get valid access token" },
        { status: 401 }
      );
    }

    // Get user's timezone from reminder settings
    const { data: settings } = await supabase
      .from("reminder_settings")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle<{ timezone: string | null }>();

    const userTimezone = settings?.timezone || "America/New_York";

    // Get base URL from request
    const baseUrl = new URL(request.url).origin;

    // ✅ Sync all events with user's timezone
    await syncAllEvents(user.id, accessToken, calendarId, baseUrl, userTimezone);

    return NextResponse.json({
      success: true,
      message: "Calendar synced successfully",
    });
  } catch (err) {
    console.error("Google Calendar sync error:", err);
    return NextResponse.json({ error: "Failed to sync calendar" }, { status: 500 });
  }
}
