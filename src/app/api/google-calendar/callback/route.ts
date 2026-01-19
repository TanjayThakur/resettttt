import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  getGoogleUserEmail,
  createResetDayCalendar,
  syncAllEvents,
} from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_params", request.url)
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/auth/signin", request.url)
    );
  }

  // Verify state matches user ID
  if (state !== user.id) {
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user's Google email
    const email = await getGoogleUserEmail(tokens.access_token);

    // Get user's timezone from their reminder settings, or use default
    // Must get this BEFORE creating calendar so we can set the calendar's timezone
    const { data: settings } = await supabase
      .from("reminder_settings")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle<{ timezone: string | null }>();

    const userTimezone = settings?.timezone || "Asia/Kolkata";

    // Create Reset Day calendar with user's timezone
    const calendarId = await createResetDayCalendar(tokens.access_token, userTimezone);

    // Save tokens to database
    await (supabase as any)
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry: tokens.expiry.toISOString(),
          scope: tokens.scope,
          email,
          calendar_id: calendarId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    // Get base URL for deep links
    const baseUrl = new URL(request.url).origin;

    // Sync all events immediately after connection
    await syncAllEvents(user.id, tokens.access_token, calendarId, baseUrl, userTimezone);

    return NextResponse.redirect(
      new URL("/settings?google=connected", request.url)
    );
  } catch (err) {
    console.error("Google Calendar callback error:", err);
    return NextResponse.redirect(
      new URL(`/settings?error=callback_failed`, request.url)
    );
  }
}
