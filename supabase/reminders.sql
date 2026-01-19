-- Reminders and Daily Status Schema
-- Run this in your Supabase SQL Editor

-- Add completed_onboarding to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS completed_onboarding BOOLEAN DEFAULT false;

-- Reminder Settings Table
CREATE TABLE IF NOT EXISTS reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  morning_time TIME NOT NULL DEFAULT '08:00',
  night_time TIME NOT NULL DEFAULT '21:00',
  enabled BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminder_settings
CREATE POLICY "Users can view own reminder settings"
  ON reminder_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder settings"
  ON reminder_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder settings"
  ON reminder_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Daily Status Table for streak tracking
CREATE TABLE IF NOT EXISTS daily_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  morning_done BOOLEAN DEFAULT false,
  interrupts_done INT DEFAULT 0,
  night_done BOOLEAN DEFAULT false,
  day_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE daily_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_status
CREATE POLICY "Users can view own daily status"
  ON daily_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily status"
  ON daily_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily status"
  ON daily_status FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminder_settings_user_id ON reminder_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_status_user_date ON daily_status(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status(date);

-- Function to create default reminder settings on profile creation
CREATE OR REPLACE FUNCTION public.create_default_reminder_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reminder_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create reminder settings when profile is created
DROP TRIGGER IF EXISTS on_profile_created_reminder ON profiles;
CREATE TRIGGER on_profile_created_reminder
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_reminder_settings();
