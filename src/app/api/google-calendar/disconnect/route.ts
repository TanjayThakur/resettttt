import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GoogleCalendarTokenRow = {
  email: string | null;
  calendar_id: string | null;
  last_sync: string | null;
  created_at: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  const { data: tokenData } = await supabase
    .from("google_calendar_tokens")
    .select("email, calendar_id, last_sync, created_at")
    .eq("user_id", user.id)
    .maybeSingle<GoogleCalendarTokenRow>();

  if (!tokenData) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  return NextResponse.json({
    connected: true,
    email: tokenData.email,
    calendarId: tokenData.calendar_id,
    lastSync: tokenData.last_sync,
    connectedAt: tokenData.created_at,
  });
}
