-- Migration for Google Calendar integration

-- Google Calendar tokens table (stores OAuth tokens securely)
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT DEFAULT 'https://www.googleapis.com/auth/calendar',
  email TEXT,
  calendar_id TEXT,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar event mapping table (prevents duplicate events)
CREATE TABLE IF NOT EXISTS calendar_event_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, event_type)
);

-- Enable RLS
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_map ENABLE ROW LEVEL SECURITY;

-- RLS policies for google_calendar_tokens
CREATE POLICY "Users can view their own tokens"
  ON google_calendar_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON google_calendar_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON google_calendar_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON google_calendar_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for calendar_event_map
CREATE POLICY "Users can view their own event mappings"
  ON calendar_event_map FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own event mappings"
  ON calendar_event_map FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own event mappings"
  ON calendar_event_map FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own event mappings"
  ON calendar_event_map FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user ON google_calendar_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_map_user ON calendar_event_map(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_map_type ON calendar_event_map(user_id, event_type);
