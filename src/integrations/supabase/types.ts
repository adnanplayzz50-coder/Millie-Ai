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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_login_attempts: {
        Row: {
          created_at: string
          id: string
          visitor_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          visitor_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          visitor_hash?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          mode: string
          pinned: boolean
          project_id: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          pinned?: boolean
          project_id?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          pinned?: boolean
          project_id?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_files: {
        Row: {
          content_base64: string
          filename: string
          id: number
          updated_at: string
          version: string
        }
        Insert: {
          content_base64: string
          filename: string
          id: number
          updated_at?: string
          version?: string
        }
        Update: {
          content_base64?: string
          filename?: string
          id?: number
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      memory_facts: {
        Row: {
          created_at: string
          fact: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fact: string
          id?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          fact?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          sources: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          sources?: Json | null
          user_id?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json | null
          user_id?: string
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
      profiles: {
        Row: {
          ai_use: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          hobbies: string | null
          id: string
          interests: string | null
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          ai_use?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          hobbies?: string | null
          id: string
          interests?: string | null
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          ai_use?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          hobbies?: string | null
          id?: string
          interests?: string | null
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          content: string
          created_at: string
          id: string
          path: string
          project_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          path: string
          project_id: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          path?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string
          id: string
          instructions: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          instructions?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          instructions?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      support_questions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string | null
          resolved: boolean
          topic: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name?: string | null
          resolved?: boolean
          topic?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string | null
          resolved?: boolean
          topic?: string
        }
        Relationships: []
      }
      update_log: {
        Row: {
          body: string
          created_at: string
          id: string
          log_date: string
          sort_order: number
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          log_date: string
          sort_order?: number
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          log_date?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          custom_color: string | null
          font: string
          palette: string
          read_aloud: boolean
          theme: string
          updated_at: string
          user_id: string
          wake_word: boolean
        }
        Insert: {
          custom_color?: string | null
          font?: string
          palette?: string
          read_aloud?: boolean
          theme?: string
          updated_at?: string
          user_id: string
          wake_word?: boolean
        }
        Update: {
          custom_color?: string | null
          font?: string
          palette?: string
          read_aloud?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
          wake_word?: boolean
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaWithoutInternals["Tables"]][TableName] extends {
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : never
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][DefaultSchemaEnumNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
