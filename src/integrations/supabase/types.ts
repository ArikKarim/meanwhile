export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          password_hash: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          password_hash?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          password_hash?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          color: string | null
          created_at: string
          day_of_week: number
          end_time: string
          group_id: string
          id: string
          label: string
          start_time: string
          tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          group_id: string
          id?: string
          label: string
          start_time: string
          tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          group_id?: string
          id?: string
          label?: string
          start_time?: string
          tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_colors: {
        Row: {
          id: string
          user_id: string
          group_id: string
          color: string
          user_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          group_id: string
          color: string
          user_name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          group_id?: string
          color?: string
          user_name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_colors_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notepads: {
        Row: {
          id: string
          group_id: string
          title: string
          content: string
          last_updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          title?: string
          content?: string
          last_updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          title?: string
          content?: string
          last_updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notepads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notepad_operations: {
        Row: {
          id: string
          notepad_id: string
          user_id: string
          operation_type: string
          position: number
          content: string | null
          length: number | null
          timestamp: string
          sequence_number: number
        }
        Insert: {
          id?: string
          notepad_id: string
          user_id: string
          operation_type: string
          position: number
          content?: string | null
          length?: number | null
          timestamp?: string
          sequence_number?: number
        }
        Update: {
          id?: string
          notepad_id?: string
          user_id?: string
          operation_type?: string
          position?: number
          content?: string | null
          length?: number | null
          timestamp?: string
          sequence_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "notepad_operations_notepad_id_fkey"
            columns: ["notepad_id"]
            isOneToOne: false
            referencedRelation: "notepads"
            referencedColumns: ["id"]
          },
        ]
      }
      notepad_cursors: {
        Row: {
          id: string
          notepad_id: string
          user_id: string
          position: number
          selection_start: number | null
          selection_end: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          notepad_id: string
          user_id: string
          position?: number
          selection_start?: number | null
          selection_end?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          notepad_id?: string
          user_id?: string
          position?: number
          selection_start?: number | null
          selection_end?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notepad_cursors_notepad_id_fkey"
            columns: ["notepad_id"]
            isOneToOne: false
            referencedRelation: "notepads"
            referencedColumns: ["id"]
          },
        ]
      }
      notepad_collaborators: {
        Row: {
          id: string
          notepad_id: string
          user_id: string
          user_name: string
          user_color: string
          is_active: boolean
          last_seen: string
        }
        Insert: {
          id?: string
          notepad_id: string
          user_id: string
          user_name: string
          user_color?: string
          is_active?: boolean
          last_seen?: string
        }
        Update: {
          id?: string
          notepad_id?: string
          user_id?: string
          user_name?: string
          user_color?: string
          is_active?: boolean
          last_seen?: string
        }
        Relationships: [
          {
            foreignKeyName: "notepad_collaborators_notepad_id_fkey"
            columns: ["notepad_id"]
            isOneToOne: false
            referencedRelation: "notepads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_user_color: {
        Args: {
          p_user_id: string
          p_group_id: string
          p_color: string
        }
        Returns: string
      }
      assign_user_color_in_group: {
        Args: {
          p_user_id: string
          p_group_id: string
          p_preferred_color?: string
        }
        Returns: string
      }
      generate_group_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_user_uuid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_most_recent_color: {
        Args: {
          p_user_id: string
        }
        Returns: string
      }
      set_session_user: {
        Args: {
          user_id: string
        }
        Returns: undefined
      }
      clear_session_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_group_member: {
        Args: {
          group_id: string
          user_id: string
        }
        Returns: boolean
      }
      create_group_notepad: {
        Args: {
          p_group_id: string
        }
        Returns: string
      }
      join_notepad_collaboration: {
        Args: {
          p_notepad_id: string
          p_user_name: string
          p_user_color: string
        }
        Returns: undefined
      }
      leave_notepad_collaboration: {
        Args: {
          p_notepad_id: string
        }
        Returns: undefined
      }
      update_notepad_cursor: {
        Args: {
          p_notepad_id: string
          p_position: number
          p_selection_start?: number
          p_selection_end?: number
        }
        Returns: undefined
      }
      apply_notepad_operation: {
        Args: {
          p_notepad_id: string
          p_operation_type: string
          p_position: number
          p_content?: string
          p_length?: number
        }
        Returns: number
      }
      cleanup_inactive_collaborators: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
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
