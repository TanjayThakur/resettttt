import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Save push subscription
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
    const { endpoint, p256dh, auth } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing subscription data" },
        { status: 400 }
      );
    }

    // Upsert subscription (update if endpoint exists, insert if new)
    const { error } = await (supabase as any)
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
        },
        { onConflict: "user_id,endpoint" }
      );

    if (error) {
      console.error("Failed to save push subscription:", error);
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Delete push subscription
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { endpoint } = body;

    if (endpoint) {
      // Delete specific subscription
      await (supabase as any)
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);
    } else {
      // Delete all subscriptions for user
      await (supabase as any)
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push unsubscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
