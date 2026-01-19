// Google Calendar integration utilities

import { createClient } from "@/lib/supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/**
 * Redirect URI
 * - In production (Vercel) uses NEXT_PUBLIC_APP_URL
 * - In local dev uses localhost
 */
const GOOGLE_REDIRECT_URI =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
    : "http://localhost:3000/api/google-calendar/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

// HARDCODED India timezone - all events will be in IST (GMT+5:30)
// This ensures consistent timing regardless of server location (Vercel UTC)
const INDIA_TIMEZONE = "Asia/Kolkata";

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

// Create "Reset Day" calendar - ALWAYS uses India timezone
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

  // Create new calendar with HARDCODED India timezone
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: "Reset Day",
      description: "Your daily rituals and productivity tracking",
      timeZone: INDIA_TIMEZONE,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Get today's date in India timezone as YYYY-MM-DD
 * Uses INDIA_TIMEZONE constant to ensure correct date regardless of server location
 */
function getTodayInIST(): string {
  const now = new Date();
  // Use Intl.DateTimeFormat to get date parts in India timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA locale gives YYYY-MM-DD format
  return formatter.format(now);
}

// Create or update a recurring event - ALWAYS uses India timezone
export async function createOrUpdateEvent(
  accessToken: string,
  calendarId: string,
  eventType: EventType,
  existingEventId: string | null,
  eventConfig: {
    summary: string;
    description: string;
    startTime: string; // HH:MM format in IST
    duration: number; // minutes
    recurrence: string[]; // RRULE strings
    reminderMinutes: number;
  },
  baseUrl: string
): Promise<string> {
  const { summary, description, startTime, duration, recurrence, reminderMinutes } =
    eventConfig;

  // Get today's date in India timezone (NOT UTC)
  const dateStr = getTodayInIST();

  // Parse start time (already in IST)
  const [hours, minutes] = startTime.split(":").map(Number);

  // Format: YYYY-MM-DDTHH:MM:SS (NO Z suffix - timezone specified separately)
  // This is the LOCAL time in India, NOT UTC
  const startDateTime = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

  // Calculate end time
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  const endDateTime = `${dateStr}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;

  const eventBody = {
    summary,
    description: `${description}\n\nOpen app: ${baseUrl}`,
    start: {
      dateTime: startDateTime,
      timeZone: INDIA_TIMEZONE, // HARDCODED: Asia/Kolkata
    },
    end: {
      dateTime: endDateTime,
      timeZone: INDIA_TIMEZONE, // HARDCODED: Asia/Kolkata
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

/**
 * Generate all 30-min tracker time slots from 8:00 AM to 10:00 PM IST
 * Returns array of "HH:MM" strings
 */
function getTrackerTimeSlots(): string[] {
  const slots: string[] = [];
  // From 8:00 (8*60=480) to 22:00 (22*60=1320), every 30 minutes
  // That's 8:00, 8:30, 9:00, ... 21:30, 22:00 = 29 slots
  for (let totalMinutes = 8 * 60; totalMinutes <= 22 * 60; totalMinutes += 30) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    slots.push(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
  }
  return slots;
}

// Sync all Reset Day events to Google Calendar - ALWAYS uses India timezone
export async function syncAllEvents(
  userId: string,
  accessToken: string,
  calendarId: string,
  baseUrl: string
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

  // Track all event mappings to save
  const eventMappingsToSave: { event_type: string; google_event_id: string }[] = [];

  // 1. Morning Ritual - Daily at 8:00 AM IST
  const morningEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.MORNING,
    getExistingEventId(EVENT_TYPES.MORNING),
    {
      summary: "🌅 Morning Ritual",
      description:
        "Review your identity, anti-vision, and vision. Pick today's quests.",
      startTime: "08:00", // 8:00 AM IST
      duration: 15,
      recurrence: ["RRULE:FREQ=DAILY"],
      reminderMinutes: 5,
    },
    `${baseUrl}/morning`
  );
  eventMappingsToSave.push({
    event_type: EVENT_TYPES.MORNING,
    google_event_id: morningEventId,
  });

  // 2. Night Reflection - Daily at 9:00 PM IST
  const nightEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.NIGHT,
    getExistingEventId(EVENT_TYPES.NIGHT),
    {
      summary: "🌙 Night Reflection",
      description: "Reflect on your day, journal, and plan tomorrow's quests.",
      startTime: "21:00", // 9:00 PM IST
      duration: 20,
      recurrence: ["RRULE:FREQ=DAILY"],
      reminderMinutes: 5,
    },
    `${baseUrl}/night`
  );
  eventMappingsToSave.push({
    event_type: EVENT_TYPES.NIGHT,
    google_event_id: nightEventId,
  });

  // 3. Weekly Reset - Sundays at 6:00 PM IST
  const weeklyEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.WEEKLY,
    getExistingEventId(EVENT_TYPES.WEEKLY),
    {
      summary: "📅 Weekly Reset",
      description:
        "Deep reflection: review your anti-vision, vision, and set weekly goals.",
      startTime: "18:00", // 6:00 PM IST
      duration: 30,
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=SU"],
      reminderMinutes: 15,
    },
    `${baseUrl}/weekly`
  );
  eventMappingsToSave.push({
    event_type: EVENT_TYPES.WEEKLY,
    google_event_id: weeklyEventId,
  });

  // 4. 30-min Tracker Reminders - Every 30 min from 8:00 AM to 10:00 PM IST
  // Google Calendar doesn't support BYHOUR/BYMINUTE for multiple daily events
  // So we create separate daily recurring events for each 30-min slot
  const trackerSlots = getTrackerTimeSlots();

  // First, delete any old tracker events that might exist with wrong format
  const oldTrackerMapping = mappings.find((m) => m.event_type === EVENT_TYPES.TRACKER);
  if (oldTrackerMapping) {
    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${oldTrackerMapping.google_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch {
      // Ignore if already deleted
    }
  }

  // Delete old individual tracker slot events (clean up any stale mappings)
  for (let i = 0; i < 30; i++) {
    const oldSlotMapping = mappings.find(
      (m) => m.event_type === `${EVENT_TYPES.TRACKER}_${i}`
    );
    if (oldSlotMapping) {
      try {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${oldSlotMapping.google_event_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      } catch {
        // Ignore if already deleted
      }
    }
  }

  // Create new tracker events for each 30-min slot (all times in IST)
  for (let i = 0; i < trackerSlots.length; i++) {
    const slot = trackerSlots[i];
    const slotEventType = `${EVENT_TYPES.TRACKER}_${i}`;
    const existingSlotEventId = getExistingEventId(slotEventType);

    const trackerEventId = await createOrUpdateEvent(
      accessToken,
      calendarId,
      EVENT_TYPES.TRACKER,
      existingSlotEventId,
      {
        summary: "⏱️ Log Time Block",
        description: `Track what you worked on. Open the 30-min tracker to log your progress.`,
        startTime: slot, // Time in IST (e.g., "08:00", "08:30", etc.)
        duration: 5,
        recurrence: ["RRULE:FREQ=DAILY"],
        reminderMinutes: 0,
      },
      `${baseUrl}/tracker`
    );

    eventMappingsToSave.push({
      event_type: slotEventType,
      google_event_id: trackerEventId,
    });
  }

  // Save all event mappings
  for (const mapping of eventMappingsToSave) {
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
  await (supabase as any).from("calendar_event_map").delete().eq("user_id", userId);
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
    await (supabase as any)
      .from("google_calendar_tokens")
      .delete()
      .eq("user_id", userId);
    await (supabase as any).from("calendar_event_map").delete().eq("user_id", userId);
  }
}
