-- Tasks and Daily Tasks Schema
-- Run this in your Supabase SQL Editor

-- Task Templates Table (for recurring tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  recurrence_type TEXT NOT NULL DEFAULT 'none', -- 'none', 'daily', 'weekly'
  recurrence_days INT[] DEFAULT '{}', -- For weekly: 0=Sun, 1=Mon, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Tasks Table (task instances for each day)
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- NULL for one-off tasks
  date DATE NOT NULL,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  is_top_3 BOOLEAN NOT NULL DEFAULT false, -- Selected as top 3 in morning ritual
  xp_awarded INT DEFAULT 0,
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_id, date) -- Prevent duplicate recurring tasks
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for daily_tasks
CREATE POLICY "Users can view own daily tasks"
  ON daily_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily tasks"
  ON daily_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily tasks"
  ON daily_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily tasks"
  ON daily_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_date ON daily_tasks(date);

-- Function to generate daily tasks from recurring templates
CREATE OR REPLACE FUNCTION public.generate_daily_tasks(p_user_id UUID, p_date DATE)
RETURNS void AS $$
DECLARE
  v_task RECORD;
  v_day_of_week INT;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date)::INT;

  FOR v_task IN
    SELECT * FROM tasks
    WHERE user_id = p_user_id
    AND is_active = true
    AND (
      recurrence_type = 'daily'
      OR (recurrence_type = 'weekly' AND v_day_of_week = ANY(recurrence_days))
    )
  LOOP
    INSERT INTO daily_tasks (user_id, task_id, date, title, sort_order)
    VALUES (p_user_id, v_task.id, p_date, v_task.title, 0)
    ON CONFLICT (user_id, task_id, date) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment user XP
CREATE OR REPLACE FUNCTION public.increment_xp(user_id UUID, xp_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET total_xp = GREATEST(0, COALESCE(total_xp, 0) + xp_amount),
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
