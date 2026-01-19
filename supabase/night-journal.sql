-- Night Journal Migration
-- Adds journal_entry column to night_entries table

-- Add journal_entry column to night_entries table
ALTER TABLE night_entries
ADD COLUMN IF NOT EXISTS journal_entry TEXT;

-- Create index for faster queries on user_id and entry_date
CREATE INDEX IF NOT EXISTS idx_night_entries_user_date
ON night_entries(user_id, entry_date);
