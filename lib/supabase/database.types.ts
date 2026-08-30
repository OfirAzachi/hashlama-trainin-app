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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      benchmark_tests: {
        Row: {
          created_at: string
          id: string
          max_pushups: number
          recorded_date: string
          run_3km_seconds: number
          test_type: Database["public"]["Enums"]["test_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_pushups: number
          recorded_date?: string
          run_3km_seconds: number
          test_type: Database["public"]["Enums"]["test_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_pushups?: number
          recorded_date?: string
          run_3km_seconds?: number
          test_type?: Database["public"]["Enums"]["test_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_tests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_categories: {
        Row: {
          catalog: Database["public"]["Enums"]["catalog_kind"]
          description: string
          id: Database["public"]["Enums"]["strength_category"]
          name: string
          name_en: string
        }
        Insert: {
          catalog: Database["public"]["Enums"]["catalog_kind"]
          description?: string
          id: Database["public"]["Enums"]["strength_category"]
          name: string
          name_en: string
        }
        Update: {
          catalog?: Database["public"]["Enums"]["catalog_kind"]
          description?: string
          id?: Database["public"]["Enums"]["strength_category"]
          name?: string
          name_en?: string
        }
        Relationships: []
      }
      exercise_gif_overrides: {
        Row: {
          exercise_id: string
          gif_url: string
          updated_at: string
        }
        Insert: {
          exercise_id: string
          gif_url: string
          updated_at?: string
        }
        Update: {
          exercise_id?: string
          gif_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_templates: {
        Row: {
          id: string
          training_type: string
          title: string
          description: string
          workout_instructions: string
          points_game: Json | null
          running: Json | null
          created_at: string
        }
        Insert: {
          id: string
          training_type: string
          title: string
          description?: string
          workout_instructions?: string
          points_game?: Json | null
          running?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          training_type?: string
          title?: string
          description?: string
          workout_instructions?: string
          points_game?: Json | null
          running?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      media_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          media_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          media_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_comments_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "session_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      media_likes: {
        Row: {
          created_at: string
          media_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          media_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_likes_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "session_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          media_id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          media_id: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          media_id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "media_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "session_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roster: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string | null
          final_grade: Database["public"]["Enums"]["roster_grade"] | null
          final_run_seconds: number | null
          final_score: number | null
          first_name: string
          gender: string
          km_levels: number[]
          last_name: string
          matched_user_id: string | null
          personal_number: string
          pushup_achievement: number | null
          role: Database["public"]["Enums"]["user_role"]
          run_finish_time: string | null
          run_grade: Database["public"]["Enums"]["roster_grade"] | null
          run_start_time: string | null
          status_notes: string | null
          strength_grade: Database["public"]["Enums"]["roster_grade"] | null
          team: number | null
          unit: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email?: string | null
          final_grade?: Database["public"]["Enums"]["roster_grade"] | null
          final_run_seconds?: number | null
          final_score?: number | null
          first_name: string
          gender: string
          km_levels?: number[]
          last_name: string
          matched_user_id?: string | null
          personal_number: string
          pushup_achievement?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          run_finish_time?: string | null
          run_grade?: Database["public"]["Enums"]["roster_grade"] | null
          run_start_time?: string | null
          status_notes?: string | null
          strength_grade?: Database["public"]["Enums"]["roster_grade"] | null
          team?: number | null
          unit: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string | null
          final_grade?: Database["public"]["Enums"]["roster_grade"] | null
          final_run_seconds?: number | null
          final_score?: number | null
          first_name?: string
          gender?: string
          km_levels?: number[]
          last_name?: string
          matched_user_id?: string | null
          personal_number?: string
          pushup_achievement?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          run_finish_time?: string | null
          run_grade?: Database["public"]["Enums"]["roster_grade"] | null
          run_start_time?: string | null
          status_notes?: string | null
          strength_grade?: Database["public"]["Enums"]["roster_grade"] | null
          team?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      running_configs: {
        Row: {
          mode: Database["public"]["Enums"]["run_mode"]
          session_id: string
        }
        Insert: {
          mode?: Database["public"]["Enums"]["run_mode"]
          session_id: string
        }
        Update: {
          mode?: Database["public"]["Enums"]["run_mode"]
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_configs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      running_logs: {
        Row: {
          actual_seconds: number
          created_at: string
          distance_meters: number
          id: string
          pace_category: Database["public"]["Enums"]["run_pace_category"]
          points: number | null
          repeats_done: number
          segment_id: string
          segment_index: number
          session_id: string
          total_distance_meters: number | null
          user_id: string
        }
        Insert: {
          actual_seconds: number
          created_at?: string
          distance_meters: number
          id?: string
          pace_category: Database["public"]["Enums"]["run_pace_category"]
          points?: number | null
          repeats_done: number
          segment_id: string
          segment_index?: number
          session_id: string
          total_distance_meters?: number | null
          user_id: string
        }
        Update: {
          actual_seconds?: number
          created_at?: string
          distance_meters?: number
          id?: string
          pace_category?: Database["public"]["Enums"]["run_pace_category"]
          points?: number | null
          repeats_done?: number
          segment_id?: string
          segment_index?: number
          session_id?: string
          total_distance_meters?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "running_logs_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "running_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      running_segments: {
        Row: {
          distance_meters: number
          id: string
          label: string
          pace_category: Database["public"]["Enums"]["run_pace_category"]
          position: number
          recovery_seconds: number
          repeats: number
          session_id: string
          target_team: number | null
        }
        Insert: {
          distance_meters: number
          id?: string
          label: string
          pace_category: Database["public"]["Enums"]["run_pace_category"]
          position?: number
          recovery_seconds?: number
          repeats?: number
          session_id: string
          target_team?: number | null
        }
        Update: {
          distance_meters?: number
          id?: string
          label?: string
          pace_category?: Database["public"]["Enums"]["run_pace_category"]
          position?: number
          recovery_seconds?: number
          repeats?: number
          session_id?: string
          target_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "running_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          created_at: string
          exercise_name: string
          id: string
          metric_type: Database["public"]["Enums"]["metric_type"]
          metric_value: number
          notes: string | null
          rpe: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_name: string
          id?: string
          metric_type: Database["public"]["Enums"]["metric_type"]
          metric_value: number
          notes?: string | null
          rpe: number
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_name?: string
          id?: string
          metric_type?: Database["public"]["Enums"]["metric_type"]
          metric_value?: number
          notes?: string | null
          rpe?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_media: {
        Row: {
          caption: string | null
          file_name: string | null
          id: string
          image_url: string | null
          mime_type: string | null
          session_id: string | null
          tags: string[]
          uploaded_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          file_name?: string | null
          id?: string
          image_url?: string | null
          mime_type?: string | null
          session_id?: string | null
          tags?: string[]
          uploaded_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          file_name?: string | null
          id?: string
          image_url?: string | null
          mime_type?: string | null
          session_id?: string | null
          tags?: string[]
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_tracks: {
        Row: {
          id: string
          label: string
          session_id: string
          target_team: number | null
        }
        Insert: {
          id?: string
          label: string
          session_id: string
          target_team?: number | null
        }
        Update: {
          id?: string
          label?: string
          session_id?: string
          target_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      strength_configs: {
        Row: {
          allowed_levels: number[]
          catalog: Database["public"]["Enums"]["catalog_kind"]
          round_categories: Database["public"]["Enums"]["strength_category"][]
          round_exercise_ids: string[]
          round_rest_seconds: number[]
          round_work_seconds: number[]
          session_id: string
        }
        Insert: {
          allowed_levels?: number[]
          catalog?: Database["public"]["Enums"]["catalog_kind"]
          round_categories?: Database["public"]["Enums"]["strength_category"][]
          round_exercise_ids?: string[]
          round_rest_seconds?: number[]
          round_work_seconds?: number[]
          session_id: string
        }
        Update: {
          allowed_levels?: number[]
          catalog?: Database["public"]["Enums"]["catalog_kind"]
          round_categories?: Database["public"]["Enums"]["strength_category"][]
          round_exercise_ids?: string[]
          round_rest_seconds?: number[]
          round_work_seconds?: number[]
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strength_configs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      strength_exercises: {
        Row: {
          animation_key: string
          catalog: Database["public"]["Enums"]["catalog_kind"]
          category: Database["public"]["Enums"]["strength_category"]
          gif_url: string | null
          id: string
          level: number
          name: string
          name_en: string
          unit: Database["public"]["Enums"]["strength_unit"]
          units_per_rep: number
        }
        Insert: {
          animation_key: string
          catalog?: Database["public"]["Enums"]["catalog_kind"]
          category: Database["public"]["Enums"]["strength_category"]
          gif_url?: string | null
          id: string
          level: number
          name: string
          name_en: string
          unit?: Database["public"]["Enums"]["strength_unit"]
          units_per_rep?: number
        }
        Update: {
          animation_key?: string
          catalog?: Database["public"]["Enums"]["catalog_kind"]
          category?: Database["public"]["Enums"]["strength_category"]
          gif_url?: string | null
          id?: string
          level?: number
          name?: string
          name_en?: string
          unit?: Database["public"]["Enums"]["strength_unit"]
          units_per_rep?: number
        }
        Relationships: []
      }
      strength_logs: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          level: number
          points: number | null
          raw_value: number
          reps: number | null
          round_index: number
          session_id: string
          unit: Database["public"]["Enums"]["strength_unit"]
          units_per_rep: number
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          level: number
          points?: number | null
          raw_value: number
          reps?: number | null
          round_index: number
          session_id: string
          unit: Database["public"]["Enums"]["strength_unit"]
          units_per_rep: number
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          level?: number
          points?: number | null
          raw_value?: number
          reps?: number | null
          round_index?: number
          session_id?: string
          unit?: Database["public"]["Enums"]["strength_unit"]
          units_per_rep?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strength_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "strength_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strength_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strength_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      track_exercises: {
        Row: {
          id: string
          metric_type: Database["public"]["Enums"]["metric_type"]
          name: string
          position: number
          prescription: string
          target_value: number | null
          track_id: string
        }
        Insert: {
          id?: string
          metric_type: Database["public"]["Enums"]["metric_type"]
          name: string
          position?: number
          prescription?: string
          target_value?: number | null
          track_id: string
        }
        Update: {
          id?: string
          metric_type?: Database["public"]["Enums"]["metric_type"]
          name?: string
          position?: number
          prescription?: string
          target_value?: number | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_exercises_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "session_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          is_optional: boolean
          target_team: number | null
          title: string
          training_type: Database["public"]["Enums"]["training_type"]
          week_index: number
          workout_instructions: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          is_optional?: boolean
          target_team?: number | null
          title: string
          training_type?: Database["public"]["Enums"]["training_type"]
          week_index: number
          workout_instructions?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_optional?: boolean
          target_team?: number | null
          title?: string
          training_type?: Database["public"]["Enums"]["training_type"]
          week_index?: number
          workout_instructions?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bonus_points: number
          created_at: string
          email: string
          final_run_seconds: number | null
          final_score: number | null
          gender: string | null
          id: string
          joined_at: string
          km_levels: number[]
          name: string
          pushup_achievement: number | null
          role: Database["public"]["Enums"]["user_role"]
          team: number | null
          unit: string | null
        }
        Insert: {
          avatar_url?: string | null
          bonus_points?: number
          created_at?: string
          email: string
          final_run_seconds?: number | null
          final_score?: number | null
          gender?: string | null
          id: string
          joined_at?: string
          km_levels?: number[]
          name: string
          pushup_achievement?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          team?: number | null
          unit?: string | null
        }
        Update: {
          avatar_url?: string | null
          bonus_points?: number
          created_at?: string
          email?: string
          final_run_seconds?: number | null
          final_score?: number | null
          gender?: string | null
          id?: string
          joined_at?: string
          km_levels?: number[]
          name?: string
          pushup_achievement?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          team?: number | null
          unit?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_trainer: { Args: never; Returns: boolean }
    }
    Enums: {
      catalog_kind: "strength" | "endurance" | "warmup" | "cooldown"
      metric_type: "reps" | "time_seconds" | "distance_meters" | "weight_kg"
      roster_grade: "V" | "X" | "חסר"
      run_mode: "intervals" | "steady"
      run_pace_category: "walk" | "talk" | "borg" | "sprint"
      strength_category:
        | "lower"
        | "push"
        | "back"
        | "core"
        | "jumps"
        | "machines"
        | "fullbody"
        | "agility"
        | "dynamic_stretch"
        | "pulse_raiser"
        | "stretch_lower"
        | "stretch_upper"
        | "stretch_back"
        | "cardio"
      strength_unit: "reps" | "seconds" | "meters"
      test_type: "initial" | "final"
      training_type:
        | "running"
        | "endurance"
        | "strength"
        | "warmup"
        | "cooldown"
        | "log"
      user_role: "trainer" | "participant"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      catalog_kind: ["strength", "endurance", "warmup", "cooldown"],
      metric_type: ["reps", "time_seconds", "distance_meters", "weight_kg"],
      roster_grade: ["V", "X", "חסר"],
      run_mode: ["intervals", "steady"],
      run_pace_category: ["walk", "talk", "borg", "sprint"],
      strength_category: [
        "lower",
        "push",
        "back",
        "core",
        "jumps",
        "machines",
        "fullbody",
        "agility",
        "dynamic_stretch",
        "pulse_raiser",
        "stretch_lower",
        "stretch_upper",
        "stretch_back",
        "cardio",
      ],
      strength_unit: ["reps", "seconds", "meters"],
      test_type: ["initial", "final"],
      training_type: ["running", "endurance", "strength", "warmup", "cooldown", "log"],
      user_role: ["trainer", "participant"],
    },
  },
} as const
