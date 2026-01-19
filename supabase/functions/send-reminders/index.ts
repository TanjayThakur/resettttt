// Supabase Edge Function for sending email reminders
// Deploy: supabase functions deploy send-reminders
// Schedule: Use a cron job to call this function every hour

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderSettings {
  user_id: string;
  morning_time: string;
  night_time: string;
  enabled: boolean;
  timezone: string;
}

interface UserProfile {
  id: string;
  email?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all enabled reminder settings
    const { data: reminders, error: remindersError } = await supabase
      .from("reminder_settings")
      .select("*")
      .eq("enabled", true);

    if (remindersError) {
      throw new Error(`Failed to fetch reminders: ${remindersError.message}`);
    }

    const remindersList = reminders as ReminderSettings[];
    const now = new Date();
    const currentHour = now.getUTCHours();
    const sentReminders: string[] = [];

    for (const reminder of remindersList) {
      // Calculate local hour for user's timezone
      const userDate = new Date(
        now.toLocaleString("en-US", { timeZone: reminder.timezone })
      );
      const userHour = userDate.getHours();
      const userMinutes = userDate.getMinutes();

      // Parse reminder times (HH:MM format)
      const [morningHour] = reminder.morning_time.split(":").map(Number);
      const [nightHour] = reminder.night_time.split(":").map(Number);

      // Check if it's time for morning or night reminder (within 30 min window)
      const isMorningTime = userHour === morningHour && userMinutes < 30;
      const isNightTime = userHour === nightHour && userMinutes < 30;

      if (!isMorningTime && !isNightTime) {
        continue;
      }

      // Get user's email from auth.users
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        reminder.user_id
      );

      if (userError || !userData.user?.email) {
        console.error(`Could not get email for user ${reminder.user_id}`);
        continue;
      }

      const email = userData.user.email;
      const reminderType = isMorningTime ? "morning" : "night";

      // Check daily_status to avoid duplicate reminders
      const today = now.toISOString().split("T")[0];
      const { data: status } = await supabase
        .from("daily_status")
        .select("*")
        .eq("user_id", reminder.user_id)
        .eq("date", today)
        .single();

      // Skip if already completed
      if (isMorningTime && status?.morning_done) {
        continue;
      }
      if (isNightTime && status?.night_done) {
        continue;
      }

      // Send email reminder via Resend (if API key is configured)
      if (resendApiKey) {
        const subject = isMorningTime
          ? "Start Your Morning Ritual"
          : "Time for Night Reflection";

        const body = isMorningTime
          ? "Good morning! It's time to review your identity, anti-vision, and vision statements. Pick your quests for the day and start strong."
          : "Good evening! Take a moment to reflect on your day. Record your wins, what you avoided, and your most alive moment.";

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Reset Day <reminders@resetday.app>",
              to: [email],
              subject: subject,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">${subject}</h2>
                  <p style="color: #666; line-height: 1.6;">${body}</p>
                  <a href="${supabaseUrl.replace('.supabase.co', '.vercel.app')}/${reminderType}"
                     style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
                    Start Now
                  </a>
                </div>
              `,
            }),
          });

          if (res.ok) {
            sentReminders.push(`${reminderType}:${email}`);
          } else {
            const errorData = await res.text();
            console.error(`Failed to send email to ${email}: ${errorData}`);
          }
        } catch (emailError) {
          console.error(`Email send error for ${email}:`, emailError);
        }
      } else {
        // Log reminder if no email service configured
        console.log(`Would send ${reminderType} reminder to ${email}`);
        sentReminders.push(`${reminderType}:${email} (logged only)`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: remindersList.length,
        sent: sentReminders.length,
        reminders: sentReminders,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
