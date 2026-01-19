import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleOAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use user ID as state to verify callback
  const state = user.id;
  const authUrl = getGoogleOAuthUrl(state);

  return NextResponse.json({ url: authUrl });
}
