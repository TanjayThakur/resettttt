-- Reset Day Database Schema
-- Run this in your Supabase SQL Editor

-- Users profile (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_statement TEXT,
  anti_vision TEXT,
  vision_statement TEXT,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_xp INT DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Levers (preset quests)
CREATE TABLE levers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Quests (selected for a specific day)
CREATE TABLE daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lever_id UUID REFERENCES levers(id) ON DELETE SET NULL,
  quest_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Morning Entries
CREATE TABLE morning_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  acknowledged BOOLEAN DEFAULT true,
  xp_awarded INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- Prompts Pool
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interrupt Entries
CREATE TABLE interrupt_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  interrupt_number INT NOT NULL,
  prompt_id UUID REFERENCES prompts(id),
  response TEXT,
  xp_awarded INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_date, interrupt_number)
);

-- Night Entries
CREATE TABLE night_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  win TEXT,
  avoidance TEXT,
  alive_moment TEXT,
  xp_awarded INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- Weekly Reset Entries
CREATE TABLE weekly_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  anti_vision TEXT,
  vision TEXT,
  one_year_lens TEXT,
  one_month_project TEXT,
  xp_awarded INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Achievements
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  badge_icon TEXT,
  requirement_type TEXT,
  requirement_value INT
);

-- User Achievements (unlocked)
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- XP Log (for history/debugging)
CREATE TABLE xp_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  source TEXT NOT NULL,
  multiplier DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_levers_user_id ON levers(user_id);
CREATE INDEX idx_daily_quests_user_date ON daily_quests(user_id, quest_date);
CREATE INDEX idx_morning_entries_user_date ON morning_entries(user_id, entry_date);
CREATE INDEX idx_interrupt_entries_user_date ON interrupt_entries(user_id, entry_date);
CREATE INDEX idx_night_entries_user_date ON night_entries(user_id, entry_date);
CREATE INDEX idx_weekly_entries_user_date ON weekly_entries(user_id, week_start_date);
CREATE INDEX idx_xp_log_user_id ON xp_log(user_id);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE levers ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE morning_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE interrupt_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Levers policies
CREATE POLICY "Users can view own levers"
  ON levers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own levers"
  ON levers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own levers"
  ON levers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own levers"
  ON levers FOR DELETE
  USING (auth.uid() = user_id);

-- Daily quests policies
CREATE POLICY "Users can view own daily quests"
  ON daily_quests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily quests"
  ON daily_quests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily quests"
  ON daily_quests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily quests"
  ON daily_quests FOR DELETE
  USING (auth.uid() = user_id);

-- Morning entries policies
CREATE POLICY "Users can view own morning entries"
  ON morning_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own morning entries"
  ON morning_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own morning entries"
  ON morning_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- Interrupt entries policies
CREATE POLICY "Users can view own interrupt entries"
  ON interrupt_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interrupt entries"
  ON interrupt_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interrupt entries"
  ON interrupt_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- Night entries policies
CREATE POLICY "Users can view own night entries"
  ON night_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own night entries"
  ON night_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own night entries"
  ON night_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- Weekly entries policies
CREATE POLICY "Users can view own weekly entries"
  ON weekly_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly entries"
  ON weekly_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly entries"
  ON weekly_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- User achievements policies
CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- XP log policies
CREATE POLICY "Users can view own xp log"
  ON xp_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own xp log"
  ON xp_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Prompts are readable by all authenticated users
CREATE POLICY "Authenticated users can view prompts"
  ON prompts FOR SELECT
  TO authenticated
  USING (true);

-- Achievements are readable by all authenticated users
CREATE POLICY "Authenticated users can view achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default achievements
INSERT INTO achievements (name, description, badge_icon, requirement_type, requirement_value) VALUES
  ('Week Warrior', 'Maintain a 7-day streak', '🔥', 'streak', 7),
  ('Month Master', 'Maintain a 30-day streak', '⚡', 'streak', 30),
  ('Century Club', 'Maintain a 100-day streak', '💯', 'streak', 100),
  ('Year Legend', 'Maintain a 365-day streak', '👑', 'streak', 365);

-- Insert default prompts (15-20 for V1)
INSERT INTO prompts (text, category) VALUES
  ('What''s consuming your mental energy right now?', 'general'),
  ('Are you moving toward your vision or away from it?', 'general'),
  ('What would the best version of you do right now?', 'general'),
  ('What''s one thing you''re grateful for in this moment?', 'general'),
  ('Is this task aligned with your 1-month project?', 'general'),
  ('What are you avoiding that you know you should do?', 'general'),
  ('How is your energy level? What would boost it?', 'general'),
  ('Are you being reactive or proactive right now?', 'general'),
  ('Is this how you want to spend your limited time?', 'general'),
  ('What small win can you create in the next hour?', 'general'),
  ('Are you present or lost in thought?', 'general'),
  ('What fear is holding you back right now?', 'general'),
  ('Are you working on what matters most?', 'general'),
  ('How does your current activity serve your identity?', 'general'),
  ('What would you do if you weren''t afraid?', 'general'),
  ('Are you creating or consuming right now?', 'general'),
  ('What would make your future self proud?', 'general'),
  ('How can you make the next hour count?', 'general');
