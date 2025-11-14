export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      body_composition: {
        Row: {
          bone_percentage: number | null
          created_at: string
          date: string
          fat_percentage: number | null
          id: string
          muscle_percentage: number | null
          time: string | null
          user_id: string
          water_percentage: number | null
          weight_kg: number
        }
        Insert: {
          bone_percentage?: number | null
          created_at?: string
          date: string
          fat_percentage?: number | null
          id?: string
          muscle_percentage?: number | null
          time?: string | null
          user_id: string
          water_percentage?: number | null
          weight_kg: number
        }
        Update: {
          bone_percentage?: number | null
          created_at?: string
          date?: string
          fat_percentage?: number | null
          id?: string
          muscle_percentage?: number | null
          time?: string | null
          user_id?: string
          water_percentage?: number | null
          weight_kg?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          mode: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mode?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mode?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      garmin_activities: {
        Row: {
          activity_type: string
          avg_heart_rate: number | null
          avg_speed_kmh: number | null
          calories: number | null
          created_at: string
          distance_km: number | null
          duration_seconds: number | null
          elevation_gain: number | null
          id: string
          max_heart_rate: number | null
          raw_data: Json | null
          start_date: string
          user_id: string
        }
        Insert: {
          activity_type: string
          avg_heart_rate?: number | null
          avg_speed_kmh?: number | null
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          duration_seconds?: number | null
          elevation_gain?: number | null
          id?: string
          max_heart_rate?: number | null
          raw_data?: Json | null
          start_date: string
          user_id: string
        }
        Update: {
          activity_type?: string
          avg_heart_rate?: number | null
          avg_speed_kmh?: number | null
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          duration_seconds?: number | null
          elevation_gain?: number | null
          id?: string
          max_heart_rate?: number | null
          raw_data?: Json | null
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
      health_logs: {
        Row: {
          condition_type: string
          created_at: string
          id: string
          log_date: string
          notes: string | null
          severity: number | null
          user_id: string
        }
        Insert: {
          condition_type: string
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          severity?: number | null
          user_id: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          severity?: number | null
          user_id?: string
        }
        Relationships: []
      }
      heart_rate_rest: {
        Row: {
          created_at: string
          date: string
          heart_rate: number
          id: string
          time: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          heart_rate: number
          id?: string
          time?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          heart_rate?: number
          id?: string
          time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hrv_logs: {
        Row: {
          created_at: string
          date: string
          hrv: number
          id: string
          measurement_type: string | null
          metric: string | null
          source: string | null
          time: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          hrv: number
          id?: string
          measurement_type?: string | null
          metric?: string | null
          source?: string | null
          time?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          hrv?: number
          id?: string
          measurement_type?: string | null
          metric?: string | null
          source?: string | null
          time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          image_url: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          category: string | null
          created_at: string | null
          due_date: string | null
          id: string
          is_important: boolean | null
          location: string | null
          recurrence: string | null
          reminder_date: string | null
          text: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_important?: boolean | null
          location?: string | null
          recurrence?: string | null
          reminder_date?: string | null
          text: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_important?: boolean | null
          location?: string | null
          recurrence?: string | null
          reminder_date?: string | null
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          bmi: number | null
          bmr: number | null
          created_at: string | null
          custom_instructions: string | null
          display_name: string | null
          email: string | null
          garmin_access_token: string | null
          garmin_refresh_token: string | null
          garmin_token_expiry: string | null
          gender: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_token_expiry: string | null
          height_cm: number | null
          id: string
          preferred_mode: string | null
          strava_access_token: string | null
          strava_refresh_token: string | null
          strava_token_expiry: string | null
          trainer_enabled: boolean | null
          updated_at: string | null
          user_description: string | null
          user_id: string
          voice_preference: string | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          bmi?: number | null
          bmr?: number | null
          created_at?: string | null
          custom_instructions?: string | null
          display_name?: string | null
          email?: string | null
          garmin_access_token?: string | null
          garmin_refresh_token?: string | null
          garmin_token_expiry?: string | null
          gender?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          height_cm?: number | null
          id?: string
          preferred_mode?: string | null
          strava_access_token?: string | null
          strava_refresh_token?: string | null
          strava_token_expiry?: string | null
          trainer_enabled?: boolean | null
          updated_at?: string | null
          user_description?: string | null
          user_id: string
          voice_preference?: string | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          bmi?: number | null
          bmr?: number | null
          created_at?: string | null
          custom_instructions?: string | null
          display_name?: string | null
          email?: string | null
          garmin_access_token?: string | null
          garmin_refresh_token?: string | null
          garmin_token_expiry?: string | null
          gender?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          height_cm?: number | null
          id?: string
          preferred_mode?: string | null
          strava_access_token?: string | null
          strava_refresh_token?: string | null
          strava_token_expiry?: string | null
          trainer_enabled?: boolean | null
          updated_at?: string | null
          user_description?: string | null
          user_id?: string
          voice_preference?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      race_goals: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          notes: string | null
          preparation_plan: string | null
          race_date: string
          race_name: string
          race_type: string
          target_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          notes?: string | null
          preparation_plan?: string | null
          race_date: string
          race_name: string
          race_type: string
          target_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          notes?: string | null
          preparation_plan?: string | null
          race_date?: string
          race_name?: string
          race_type?: string
          target_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          awake_duration_minutes: number | null
          created_at: string
          deep_sleep_minutes: number | null
          duration_minutes: number | null
          end_time: string | null
          hr_average: number | null
          hr_lowest: number | null
          id: string
          light_sleep_minutes: number | null
          quality: number | null
          rem_duration_minutes: number | null
          respiration_rate: number | null
          sleep_date: string
          start_time: string | null
          unknown_sleep_minutes: number | null
          user_id: string
        }
        Insert: {
          awake_duration_minutes?: number | null
          created_at?: string
          deep_sleep_minutes?: number | null
          duration_minutes?: number | null
          end_time?: string | null
          hr_average?: number | null
          hr_lowest?: number | null
          id?: string
          light_sleep_minutes?: number | null
          quality?: number | null
          rem_duration_minutes?: number | null
          respiration_rate?: number | null
          sleep_date: string
          start_time?: string | null
          unknown_sleep_minutes?: number | null
          user_id: string
        }
        Update: {
          awake_duration_minutes?: number | null
          created_at?: string
          deep_sleep_minutes?: number | null
          duration_minutes?: number | null
          end_time?: string | null
          hr_average?: number | null
          hr_lowest?: number | null
          id?: string
          light_sleep_minutes?: number | null
          quality?: number | null
          rem_duration_minutes?: number | null
          respiration_rate?: number | null
          sleep_date?: string
          start_time?: string | null
          unknown_sleep_minutes?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
