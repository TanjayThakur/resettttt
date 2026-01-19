// Google Calendar integration utilities

import { createClient } from "@/lib/supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/**
<<<<<<< HEAD
 * Redirect URI
 * - In production (Vercel) uses NEXT_PUBLIC_APP_URL
 * - In local dev uses localhost
=======
 * Redirect URI FIX ✅
 * - In production (Vercel) it will use NEXT_PUBLIC_APP_URL
 * - In local dev it will use localhost
 *
 * This prevents Google OAuth redirect_uri_mismatch.
>>>>>>> 2e6e7791af99ae486fa2955a8b186d279cd0c7d8
 */
const GOOGLE_REDIRECT_URI =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
    : "http://localhost:3000/api/google-calendar/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

// Event types for tracking
export const EVENT_TYPES = {
  MORNING: "morning_ritual",
  NIGHT: "night_reflection",
  WEEKLY: "weekly_reset",
  TRACKER: "tracker_30min",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Row types for Supabase queries
type GoogleCalendarTokenRow = {
  access_token: string;
  refresh_token: string;
  expiry: string;
  calendar_id: string | null;
};

type CalendarEventMapRow = {
  event_type: string;
  google_event_id: string;
};

// Generate OAuth URL
export function getGoogleOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expiry: Date;
  scope: string;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  const expiry = new Date(Date.now() + data.expires_in * 1000);

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry,
    scope: data.scope,
  };
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expiry: Date;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  const expiry = new Date(Date.now() + data.expires_in * 1000);

  return {
    access_token: data.access_token,
    expiry,
  };
}

// Get user email from Google
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to get user info");
  }

  const data = await response.json();
  return data.email;
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: tokenData } = await supabase
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expiry")
    .eq("user_id", userId)
    .maybeSingle<GoogleCalendarTokenRow>();

  if (!tokenData) return null;

  const expiry = new Date(tokenData.expiry);
  const now = new Date();

  // If token expires in less than 5 minutes, refresh it
  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const { access_token, expiry: newExpiry } = await refreshAccessToken(
        tokenData.refresh_token
      );

      await (supabase as any)
        .from("google_calendar_tokens")
        .update({
          access_token,
          expiry: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return access_token;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return null;
    }
  }

  return tokenData.access_token;
}

// Create "Reset Day" calendar
export async function createResetDayCalendar(accessToken: string): Promise<string> {
  // First check if calendar already exists
  const listResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (listResponse.ok) {
    const listData = await listResponse.json();
    const existingCalendar = listData.items?.find(
      (cal: { summary: string }) => cal.summary === "Reset Day"
    );
    if (existingCalendar) {
      return existingCalendar.id;
    }
  }

<<<<<<< HEAD
  // Create new calendar (timezone will be set when creating events)
=======
  // Create new calendar
>>>>>>> 2e6e7791af99ae486fa2955a8b186d279cd0c7d8
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: "Reset Day",
      description: "Your daily rituals and productivity tracking",
<<<<<<< HEAD
=======
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
>>>>>>> 2e6e7791af99ae486fa2955a8b186d279cd0c7d8
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

// Create or update a recurring event
export async function createOrUpdateEvent(
  accessToken: string,
  calendarId: string,
  eventType: EventType,
  existingEventId: string | null,
  eventConfig: {
    summary: string;
    description: string;
    startTime: string; // HH:MM format
    duration: number; // minutes
    recurrence: string[]; // RRULE strings
    reminderMinutes: number;
  },
  baseUrl: string,
  timezone: string
): Promise<string> {
  const { summary, description, startTime, duration, recurrence, reminderMinutes } =
    eventConfig;

  // Calculate start and end times for today in the user's timezone
  const [hours, minutes] = startTime.split(":").map(Number);

  // Create date string in user's timezone
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // Format: YYYY-MM-DDTHH:MM:SS (without Z, with timezone specified separately)
  const startDateTime = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

  const endHours = hours + Math.floor((minutes + duration) / 60);
  const endMinutes = (minutes + duration) % 60;
  const endDateTime = `${dateStr}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;

  const eventBody = {
    summary,
    description: `${description}\n\nOpen app: ${baseUrl}`,
    start: {
      dateTime: startDateTime,
      timeZone: timezone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: timezone,
    },
    recurrence,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: reminderMinutes },
        ...(reminderMinutes > 0 ? [{ method: "popup", minutes: 0 }] : []),
      ],
    },
    colorId: getColorForEventType(eventType),
  };

  let response: Response;

  if (existingEventId) {
    // Update existing event
    response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existingEventId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );
  } else {
    // Create new event
    response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create/update event: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

// Get color ID for event type
function getColorForEventType(eventType: EventType): string {
  switch (eventType) {
    case EVENT_TYPES.MORNING:
      return "5"; // Yellow
    case EVENT_TYPES.NIGHT:
      return "9"; // Blue
    case EVENT_TYPES.WEEKLY:
      return "3"; // Purple
    case EVENT_TYPES.TRACKER:
      return "10"; // Green
    default:
      return "1";
  }
}

// Sync all Reset Day events to Google Calendar
export async function syncAllEvents(
  userId: string,
  accessToken: string,
  calendarId: string,
  baseUrl: string,
  timezone: string = "America/New_York"
): Promise<void> {
  const supabase = await createClient();

  // Get existing event mappings
  const { data: existingMappings } = await supabase
    .from("calendar_event_map")
    .select("event_type, google_event_id")
    .eq("user_id", userId);

  const mappings = (existingMappings ?? []) as CalendarEventMapRow[];
  const getExistingEventId = (type: string) =>
    mappings.find((m) => m.event_type === type)?.google_event_id ?? null;

  // 1. Morning Ritual - Daily at 8:00 AM
  const morningEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.MORNING,
    getExistingEventId(EVENT_TYPES.MORNING),
    {
      summary: "Morning Ritual",
      description:
        "Review your identity, anti-vision, and vision. Pick today's quests.",
      startTime: "08:00",
      duration: 15,
      recurrence: ["RRULE:FREQ=DAILY"],
      reminderMinutes: 5,
    },
    `${baseUrl}/morning`,
    timezone
  );

  // 2. Night Reflection - Daily at 9:00 PM
  const nightEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.NIGHT,
    getExistingEventId(EVENT_TYPES.NIGHT),
    {
      summary: "Night Reflection",
      description: "Reflect on your day, journal, and plan tomorrow's quests.",
      startTime: "21:00",
      duration: 20,
      recurrence: ["RRULE:FREQ=DAILY"],
      reminderMinutes: 5,
    },
    `${baseUrl}/night`,
    timezone
  );

  // 3. Weekly Reset - Sundays at 6:00 PM
  const weeklyEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.WEEKLY,
    getExistingEventId(EVENT_TYPES.WEEKLY),
    {
      summary: "Weekly Reset",
      description:
        "Deep reflection: review your anti-vision, vision, and set weekly goals.",
      startTime: "18:00",
      duration: 30,
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=SU"],
      reminderMinutes: 15,
    },
    `${baseUrl}/weekly`,
    timezone
  );

  // 4. Time Tracker Reminder - Single daily reminder at 9:00 AM
  // NOTE: Google Calendar does not support BYHOUR/BYMINUTE with FREQ=DAILY for multiple events per day.
  // For 30-min reminders, users should rely on browser push notifications instead.
  // This creates one daily reminder to check the tracker.
  const trackerEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.TRACKER,
    getExistingEventId(EVENT_TYPES.TRACKER),
    {
      summary: "Check Time Tracker",
      description:
        "Remember to log your 30-min time blocks throughout the day. Open the tracker to stay on top of your productivity.",
      startTime: "09:00",
      duration: 5,
      recurrence: ["RRULE:FREQ=DAILY"],
      reminderMinutes: 0,
    },
    `${baseUrl}/tracker`,
    timezone
  );

  // Save/update event mappings
  const eventMappings = [
    { event_type: EVENT_TYPES.MORNING, google_event_id: morningEventId },
    { event_type: EVENT_TYPES.NIGHT, google_event_id: nightEventId },
    { event_type: EVENT_TYPES.WEEKLY, google_event_id: weeklyEventId },
    { event_type: EVENT_TYPES.TRACKER, google_event_id: trackerEventId },
  ];

  for (const mapping of eventMappings) {
    await (supabase as any)
      .from("calendar_event_map")
      .upsert(
        {
          user_id: userId,
          event_type: mapping.event_type,
          google_event_id: mapping.google_event_id,
        },
        { onConflict: "user_id,event_type" }
      );
  }

  // Update last sync time
  await (supabase as any)
    .from("google_calendar_tokens")
    .update({
      last_sync: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

// Delete all Reset Day events from Google Calendar
export async function deleteAllEvents(
  accessToken: string,
  calendarId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  // Get event mappings
  const { data: mappings } = await supabase
    .from("calendar_event_map")
    .select("google_event_id")
    .eq("user_id", userId);

  // Delete each event from Google Calendar
  for (const mapping of (mappings ?? []) as { google_event_id: string }[]) {
    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${mapping.google_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  }

  // Delete mappings from database
<<<<<<< HEAD
  await (supabase as any).from("calendar_event_map").delete().eq("user_id", userId);
=======
  await supabase.from("calendar_event_map").delete().eq("user_id", userId);
>>>>>>> 2e6e7791af99ae486fa2955a8b186d279cd0c7d8
}

// Revoke Google access and clean up
export async function revokeGoogleAccess(userId: string): Promise<void> {
  const supabase = await createClient();

  // Get token data
  const { data: tokenData } = await supabase
    .from("google_calendar_tokens")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle<{ access_token: string }>();

  if (tokenData) {
    // Try to revoke token at Google
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenData.access_token}`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Failed to revoke token at Google:", error);
    }

    // Delete from database
<<<<<<< HEAD
    await (supabase as any)
      .from("google_calendar_tokens")
      .delete()
      .eq("user_id", userId);
    await (supabase as any).from("calendar_event_map").delete().eq("user_id", userId);
=======
    await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
    await supabase.from("calendar_event_map").delete().eq("user_id", userId);
>>>>>>> 2e6e7791af99ae486fa2955a8b186d279cd0c7d8
  }
}
