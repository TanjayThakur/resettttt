// Google Calendar integration utilities
// ALL TIMES ARE HARDCODED TO INDIA STANDARD TIME (Asia/Kolkata, GMT+5:30)

import { createClient } from "@/lib/supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

const GOOGLE_REDIRECT_URI =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
    : "http://localhost:3000/api/google-calendar/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ============================================
// HARDCODED INDIA TIMEZONE - NEVER CHANGE THIS
// ============================================
const INDIA_TIMEZONE = "Asia/Kolkata";

// Event types for tracking in calendar_event_map
export const EVENT_TYPES = {
  MORNING: "morning_ritual",
  NIGHT: "night_reflection",
  WEEKLY: "weekly_reset",
  TRACKER: "tracker_30min",
  INTERRUPT: "interrupt",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ============================================
// INTERRUPT SCHEDULE - 6 times daily in IST
// ============================================
const INTERRUPT_SCHEDULE = [
  { number: 1, time: "09:00", label: "9:00 AM IST" },
  { number: 2, time: "11:00", label: "11:00 AM IST" },
  { number: 3, time: "13:00", label: "1:00 PM IST" },
  { number: 4, time: "15:00", label: "3:00 PM IST" },
  { number: 5, time: "17:00", label: "5:00 PM IST" },
  { number: 6, time: "19:00", label: "7:00 PM IST" },
] as const;

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

// ============================================
// DATE/TIME UTILITIES - ALL IN IST
// ============================================

/**
 * Get current date in India timezone as YYYY-MM-DD
 * This function explicitly formats the date without relying on locale
 */
function getDateInIST(date: Date = new Date()): string {
  // Get the date parts in India timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };

  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(date);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date in India timezone
 * Using tomorrow ensures recurring events start fresh
 */
function getTomorrowInIST(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateInIST(tomorrow);
}

/**
 * Format a local datetime string for Google Calendar API
 * Format: YYYY-MM-DDTHH:MM:SS (NO 'Z' suffix - timezone is specified separately)
 */
function formatLocalDateTime(dateStr: string, timeStr: string): string {
  // timeStr is in HH:MM format
  return `${dateStr}T${timeStr}:00`;
}

/**
 * Calculate end time given start time and duration in minutes
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

// ============================================
// OAUTH FUNCTIONS
// ============================================

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

// ============================================
// CALENDAR CREATION - HARDCODED IST TIMEZONE
// ============================================

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
      // Update existing calendar to ensure correct timezone
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingCalendar.id)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: "Reset Day",
            description: "Your daily rituals and productivity tracking - India Standard Time",
            timeZone: INDIA_TIMEZONE,
          }),
        }
      );
      return existingCalendar.id;
    }
  }

  // Create new calendar with INDIA timezone
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: "Reset Day",
      description: "Your daily rituals and productivity tracking - India Standard Time",
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

// ============================================
// EVENT CREATION - ALL TIMES IN IST
// ============================================

function getColorForEventType(eventType: EventType): string {
  switch (eventType) {
    case EVENT_TYPES.MORNING:
      return "5"; // Yellow - sunrise
    case EVENT_TYPES.NIGHT:
      return "9"; // Blue - night
    case EVENT_TYPES.WEEKLY:
      return "3"; // Purple - special
    case EVENT_TYPES.TRACKER:
      return "10"; // Green - productivity
    case EVENT_TYPES.INTERRUPT:
      return "6"; // Orange - attention grabbing
    default:
      return "1";
  }
}

interface EventConfig {
  summary: string;
  description: string;
  startTime: string; // HH:MM format (IST)
  durationMinutes: number;
  recurrence: string[];
  reminderMinutesBefore: number;
}

/**
 * Create or update a recurring event in Google Calendar
 * ALL TIMES ARE INTERPRETED AS INDIA STANDARD TIME
 */
async function createOrUpdateEvent(
  accessToken: string,
  calendarId: string,
  eventType: EventType,
  existingEventId: string | null,
  config: EventConfig,
  appUrl: string
): Promise<string> {
  // Use tomorrow's date to ensure events start fresh
  const startDate = getTomorrowInIST();

  const startDateTime = formatLocalDateTime(startDate, config.startTime);
  const endTime = calculateEndTime(config.startTime, config.durationMinutes);
  const endDateTime = formatLocalDateTime(startDate, endTime);

  // Build reminders - always include a popup at event time (0 minutes)
  const reminders: { method: string; minutes: number }[] = [
    { method: "popup", minutes: 0 }, // Notification exactly at event time
  ];

  if (config.reminderMinutesBefore > 0) {
    reminders.push({ method: "popup", minutes: config.reminderMinutesBefore });
  }

  const eventBody = {
    summary: config.summary,
    description: `${config.description}\n\nOpen Reset Day: ${appUrl}`,
    start: {
      dateTime: startDateTime,
      timeZone: INDIA_TIMEZONE, // CRITICAL: Always Asia/Kolkata
    },
    end: {
      dateTime: endDateTime,
      timeZone: INDIA_TIMEZONE, // CRITICAL: Always Asia/Kolkata
    },
    recurrence: config.recurrence,
    reminders: {
      useDefault: false,
      overrides: reminders,
    },
    colorId: getColorForEventType(eventType),
  };

  let response: Response;
  const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  if (existingEventId) {
    // Update existing event
    response = await fetch(`${calendarUrl}/${existingEventId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });

    // If update fails (event might be deleted), create new
    if (!response.ok) {
      response = await fetch(calendarUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      });
    }
  } else {
    // Create new event
    response = await fetch(calendarUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });
  }

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to create/update event ${config.summary}:`, error);
    throw new Error(`Failed to create/update event: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Delete an event from Google Calendar (silently fails if not found)
 */
async function deleteEventSilently(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch {
    // Silently ignore - event might already be deleted
  }
}

// ============================================
// SYNC ALL EVENTS - MAIN FUNCTION
// ============================================

/**
 * Sync all Reset Day events to Google Calendar
 * Creates/updates: Morning, Night, Weekly, Interrupts, Trackers
 * ALL EVENTS USE INDIA STANDARD TIME (Asia/Kolkata)
 */
export async function syncAllEvents(
  userId: string,
  accessToken: string,
  calendarId: string,
  baseUrl: string
): Promise<void> {
  const supabase = await createClient();

  // Get existing event mappings from database
  const { data: existingMappings } = await supabase
    .from("calendar_event_map")
    .select("event_type, google_event_id")
    .eq("user_id", userId);

  const mappings = (existingMappings ?? []) as CalendarEventMapRow[];
  const getExistingEventId = (type: string): string | null =>
    mappings.find((m) => m.event_type === type)?.google_event_id ?? null;

  // Track new mappings to save
  const newMappings: { event_type: string; google_event_id: string }[] = [];

  // ----------------------------------------
  // 1. MORNING RITUAL - Daily at 8:00 AM IST
  // ----------------------------------------
  console.log("Syncing Morning Ritual event...");
  const morningEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.MORNING,
    getExistingEventId(EVENT_TYPES.MORNING),
    {
      summary: "🌅 Morning Ritual",
      description: "Review your identity, anti-vision, and vision. Pick today's quests.\n\nTime: 8:00 AM IST",
      startTime: "08:00",
      durationMinutes: 15,
      recurrence: ["RRULE:FREQ=DAILY"],
      reminderMinutesBefore: 5,
    },
    `${baseUrl}/morning`
  );
  newMappings.push({ event_type: EVENT_TYPES.MORNING, google_event_id: morningEventId });

  // ----------------------------------------
  // 2. NIGHT REFLECTION - Daily at 9:00 PM IST
  // ----------------------------------------
  console.log("Syncing Night Reflection event...");
  const nightEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.NIGHT,
    getExistingEventId(EVENT_TYPES.NIGHT),
    {
      summary: "🌙 Night Reflection",
      description: "Reflect on your day, journal (100+ words), and plan tomorrow's quests.\n\nTime: 9:00 PM IST",
      startTime: "21:00",
      durationMinutes: 20,
      recurrence: ["RRULE:FREQ=DAILY"],
      reminderMinutesBefore: 5,
    },
    `${baseUrl}/night`
  );
  newMappings.push({ event_type: EVENT_TYPES.NIGHT, google_event_id: nightEventId });

  // ----------------------------------------
  // 3. WEEKLY RESET - Sundays at 6:00 PM IST
  // ----------------------------------------
  console.log("Syncing Weekly Reset event...");
  const weeklyEventId = await createOrUpdateEvent(
    accessToken,
    calendarId,
    EVENT_TYPES.WEEKLY,
    getExistingEventId(EVENT_TYPES.WEEKLY),
    {
      summary: "📅 Weekly Reset",
      description: "Deep reflection: review your anti-vision, vision, and set weekly goals.\n\nTime: 6:00 PM IST (Sundays)",
      startTime: "18:00",
      durationMinutes: 30,
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=SU"],
      reminderMinutesBefore: 15,
    },
    `${baseUrl}/weekly`
  );
  newMappings.push({ event_type: EVENT_TYPES.WEEKLY, google_event_id: weeklyEventId });

  // ----------------------------------------
  // 4. INTERRUPT REMINDERS - 6 times daily
  // 9 AM, 11 AM, 1 PM, 3 PM, 5 PM, 7 PM IST
  // ----------------------------------------
  console.log("Syncing Interrupt events...");
  for (const interrupt of INTERRUPT_SCHEDULE) {
    const eventType = `${EVENT_TYPES.INTERRUPT}_${interrupt.number}`;

    const interruptEventId = await createOrUpdateEvent(
      accessToken,
      calendarId,
      EVENT_TYPES.INTERRUPT,
      getExistingEventId(eventType),
      {
        summary: `⚡ Interrupt #${interrupt.number}`,
        description: `Time for your interrupt reflection! Check in with yourself.\n\nTime: ${interrupt.label}`,
        startTime: interrupt.time,
        durationMinutes: 5,
        recurrence: ["RRULE:FREQ=DAILY"],
        reminderMinutesBefore: 0, // Immediate notification only
      },
      `${baseUrl}/interrupt`
    );

    newMappings.push({ event_type: eventType, google_event_id: interruptEventId });
  }

  // ----------------------------------------
  // 5. 30-MIN TRACKER - Every 30 min, 8 AM to 10 PM IST
  // ----------------------------------------
  console.log("Syncing 30-min Tracker events...");

  // First, clean up old tracker events
  const oldTrackerMapping = mappings.find((m) => m.event_type === EVENT_TYPES.TRACKER);
  if (oldTrackerMapping) {
    await deleteEventSilently(accessToken, calendarId, oldTrackerMapping.google_event_id);
  }

  // Clean up old slot-based tracker events
  for (let i = 0; i < 30; i++) {
    const oldSlotMapping = mappings.find((m) => m.event_type === `${EVENT_TYPES.TRACKER}_${i}`);
    if (oldSlotMapping) {
      await deleteEventSilently(accessToken, calendarId, oldSlotMapping.google_event_id);
    }
  }

  // Create tracker events for each 30-min slot from 8:00 AM to 10:00 PM IST
  // That's 29 slots: 8:00, 8:30, 9:00, ..., 21:30, 22:00
  for (let slotIndex = 0; slotIndex <= 28; slotIndex++) {
    const totalMinutes = 8 * 60 + slotIndex * 30; // Start at 8:00 AM
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const eventType = `${EVENT_TYPES.TRACKER}_${slotIndex}`;

    const trackerEventId = await createOrUpdateEvent(
      accessToken,
      calendarId,
      EVENT_TYPES.TRACKER,
      getExistingEventId(eventType),
      {
        summary: "⏱️ Log Time Block",
        description: `Track what you worked on in the last 30 minutes.\n\nTime: ${timeStr} IST`,
        startTime: timeStr,
        durationMinutes: 5,
        recurrence: ["RRULE:FREQ=DAILY"],
        reminderMinutesBefore: 0, // Immediate notification only
      },
      `${baseUrl}/tracker`
    );

    newMappings.push({ event_type: eventType, google_event_id: trackerEventId });
  }

  // ----------------------------------------
  // SAVE ALL MAPPINGS TO DATABASE
  // ----------------------------------------
  console.log("Saving event mappings to database...");
  for (const mapping of newMappings) {
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

  console.log("Calendar sync complete!");
}

// ============================================
// DELETE ALL EVENTS
// ============================================

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
    await deleteEventSilently(accessToken, calendarId, mapping.google_event_id);
  }

  // Delete mappings from database
  await (supabase as any).from("calendar_event_map").delete().eq("user_id", userId);
}

// ============================================
// REVOKE ACCESS
// ============================================

export async function revokeGoogleAccess(userId: string): Promise<void> {
  const supabase = await createClient();

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
