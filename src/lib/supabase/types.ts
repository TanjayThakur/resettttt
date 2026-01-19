export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          identity_statement: string | null;
          anti_vision: string | null;
          vision_statement: string | null;
          current_streak: number;
          longest_streak: number;
          total_xp: number;
          last_activity_date: string | null;
          completed_onboarding: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          identity_statement?: string | null;
          anti_vision?: string | null;
          vision_statement?: string | null;
          current_streak?: number;
          longest_streak?: number;
          total_xp?: number;
          last_activity_date?: string | null;
          completed_onboarding?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          identity_statement?: string | null;
          anti_vision?: string | null;
          vision_statement?: string | null;
          current_streak?: number;
          longest_streak?: number;
          total_xp?: number;
          last_activity_date?: string | null;
          completed_onboarding?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      levers: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          category: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          category?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          category?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      daily_quests: {
        Row: {
          id: string;
          user_id: string;
          lever_id: string | null;
          quest_date: string;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lever_id?: string | null;
          quest_date: string;
          is_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lever_id?: string | null;
          quest_date?: string;
          is_completed?: boolean;
          created_at?: string;
        };
      };
      morning_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          acknowledged: boolean;
          xp_awarded: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_date: string;
          acknowledged?: boolean;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_date?: string;
          acknowledged?: boolean;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      interrupt_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          interrupt_number: number;
          prompt_id: string | null;
          response: string | null;
          xp_awarded: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_date: string;
          interrupt_number: number;
          prompt_id?: string | null;
          response?: string | null;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_date?: string;
          interrupt_number?: number;
          prompt_id?: string | null;
          response?: string | null;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      night_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          win: string | null;
          avoidance: string | null;
          alive_moment: string | null;
          journal_entry: string | null;
          xp_awarded: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_date: string;
          win?: string | null;
          avoidance?: string | null;
          alive_moment?: string | null;
          journal_entry?: string | null;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_date?: string;
          win?: string | null;
          avoidance?: string | null;
          alive_moment?: string | null;
          journal_entry?: string | null;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      weekly_entries: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          anti_vision: string | null;
          vision: string | null;
          one_year_lens: string | null;
          one_month_project: string | null;
          xp_awarded: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          anti_vision?: string | null;
          vision?: string | null;
          one_year_lens?: string | null;
          one_month_project?: string | null;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          anti_vision?: string | null;
          vision?: string | null;
          one_year_lens?: string | null;
          one_month_project?: string | null;
          xp_awarded?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      prompts: {
        Row: {
          id: string;
          text: string;
          category: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          text?: string;
          category?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      achievements: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          badge_icon: string | null;
          requirement_type: string | null;
          requirement_value: number | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          badge_icon?: string | null;
          requirement_type?: string | null;
          requirement_value?: number | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          badge_icon?: string | null;
          requirement_type?: string | null;
          requirement_value?: number | null;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: string;
        };
      };
      xp_log: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          source: string;
          multiplier: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          source: string;
          multiplier?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          source?: string;
          multiplier?: number;
          created_at?: string;
        };
      };
      reminder_settings: {
        Row: {
          id: string;
          user_id: string;
          morning_time: string;
          night_time: string;
          enabled: boolean;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          morning_time?: string;
          night_time?: string;
          enabled?: boolean;
          timezone?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          morning_time?: string;
          night_time?: string;
          enabled?: boolean;
          timezone?: string;
          created_at?: string;
        };
      };
      daily_status: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          morning_done: boolean;
          interrupts_done: number;
          night_done: boolean;
          day_complete: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          morning_done?: boolean;
          interrupts_done?: number;
          night_done?: boolean;
          day_complete?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          morning_done?: boolean;
          interrupts_done?: number;
          night_done?: boolean;
          day_complete?: boolean;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          notes: string | null;
          recurrence_type: string;
          recurrence_days: number[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          notes?: string | null;
          recurrence_type?: string;
          recurrence_days?: number[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          notes?: string | null;
          recurrence_type?: string;
          recurrence_days?: number[];
          is_active?: boolean;
          created_at?: string;
        };
      };
      daily_tasks: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          date: string;
          title: string;
          is_done: boolean;
          is_top_3: boolean;
          xp_awarded: number;
          completed_at: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          date: string;
          title: string;
          is_done?: boolean;
          is_top_3?: boolean;
          xp_awarded?: number;
          completed_at?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          date?: string;
          title?: string;
          is_done?: boolean;
          is_top_3?: boolean;
          xp_awarded?: number;
          completed_at?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      time_blocks: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          block_number: number;
          start_time: string;
          activity: string | null;
          category: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          block_number: number;
          start_time: string;
          activity?: string | null;
          category?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          block_number?: number;
          start_time?: string;
          activity?: string | null;
          category?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
      };
      google_calendar_tokens: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expiry: string;
          scope: string;
          email: string | null;
          calendar_id: string | null;
          last_sync: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expiry: string;
          scope?: string;
          email?: string | null;
          calendar_id?: string | null;
          last_sync?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          access_token?: string;
          refresh_token?: string;
          expiry?: string;
          scope?: string;
          email?: string | null;
          calendar_id?: string | null;
          last_sync?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      calendar_event_map: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          google_event_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          google_event_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          google_event_id?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Lever = Database["public"]["Tables"]["levers"]["Row"];
export type DailyQuest = Database["public"]["Tables"]["daily_quests"]["Row"];
export type MorningEntry = Database["public"]["Tables"]["morning_entries"]["Row"];
export type InterruptEntry = Database["public"]["Tables"]["interrupt_entries"]["Row"];
export type NightEntry = Database["public"]["Tables"]["night_entries"]["Row"];
export type WeeklyEntry = Database["public"]["Tables"]["weekly_entries"]["Row"];
export type Prompt = Database["public"]["Tables"]["prompts"]["Row"];
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
export type UserAchievement = Database["public"]["Tables"]["user_achievements"]["Row"];
export type XpLog = Database["public"]["Tables"]["xp_log"]["Row"];
export type ReminderSettings = Database["public"]["Tables"]["reminder_settings"]["Row"];
export type DailyStatus = Database["public"]["Tables"]["daily_status"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type DailyTask = Database["public"]["Tables"]["daily_tasks"]["Row"];
export type TimeBlock = Database["public"]["Tables"]["time_blocks"]["Row"];
export type PushSubscription = Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type GoogleCalendarToken = Database["public"]["Tables"]["google_calendar_tokens"]["Row"];
export type CalendarEventMap = Database["public"]["Tables"]["calendar_event_map"]["Row"];
