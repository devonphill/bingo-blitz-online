export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assigned_tickets: {
        Row: {
          called_numbers: number | null
          id: string
          layout_mask: number
          numbers: number[]
          perm: number
          player_id: string
          position: number
          serial: string
          session_id: string
          time_stamp: string
        }
        Insert: {
          called_numbers?: number | null
          id?: string
          layout_mask: number
          numbers: number[]
          perm: number
          player_id: string
          position: number
          serial: string
          session_id: string
          time_stamp?: string
        }
        Update: {
          called_numbers?: number | null
          id?: string
          layout_mask?: number
          numbers?: number[]
          perm?: number
          player_id?: string
          position?: number
          serial?: string
          session_id?: string
          time_stamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_tickets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_cards: {
        Row: {
          cells: Json
          created_at: string
          id: string
          player_id: string
        }
        Insert: {
          cells: Json
          created_at?: string
          id?: string
          player_id: string
        }
        Update: {
          cells?: Json
          created_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_tickets: {
        Row: {
          created_at: string
          id: string
          layout_mask: number
          numbers: number[]
          perm: number
          position: number
          serial: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout_mask: number
          numbers: number[]
          perm: number
          position: number
          serial: string
        }
        Update: {
          created_at?: string
          id?: string
          layout_mask?: number
          numbers?: number[]
          perm?: number
          position?: number
          serial?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          access_code: string
          called_items: string | null
          created_at: string
          created_by: string
          current_game: number
          game_type: string
          games_config: Json | null
          id: string
          lifecycle_state: string
          name: string
          number_of_games: number
          session_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_code: string
          called_items?: string | null
          created_at?: string
          created_by: string
          current_game?: number
          game_type: string
          games_config?: Json | null
          id?: string
          lifecycle_state?: string
          name: string
          number_of_games?: number
          session_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          called_items?: string | null
          created_at?: string
          created_by?: string
          current_game?: number
          game_type?: string
          games_config?: Json | null
          id?: string
          lifecycle_state?: string
          name?: string
          number_of_games?: number
          session_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          email: string | null
          id: string
          joined_at: string
          nickname: string
          player_code: string
          session_id: string
          tickets: number
        }
        Insert: {
          email?: string | null
          id?: string
          joined_at?: string
          nickname: string
          player_code: string
          session_id: string
          tickets?: number
        }
        Update: {
          email?: string | null
          id?: string
          joined_at?: string
          nickname?: string
          player_code?: string
          session_id?: string
          tickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
          token_count: number | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          token_count?: number | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          token_count?: number | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      sessions_progress: {
        Row: {
          called_numbers: number[] | null
          created_at: string
          current_game_number: number
          current_game_type: string
          current_prize: number | null
          current_prize_description: string | null
          current_win_pattern: string | null
          game_status: string | null
          id: string
          max_game_number: number
          session_id: string
          updated_at: string
        }
        Insert: {
          called_numbers?: number[] | null
          created_at?: string
          current_game_number?: number
          current_game_type: string
          current_prize?: number | null
          current_prize_description?: string | null
          current_win_pattern?: string | null
          game_status?: string | null
          id?: string
          max_game_number?: number
          session_id: string
          updated_at?: string
        }
        Update: {
          called_numbers?: number[] | null
          created_at?: string
          current_game_number?: number
          current_game_type?: string
          current_prize?: number | null
          current_prize_description?: string | null
          current_win_pattern?: string | null
          game_status?: string | null
          id?: string
          max_game_number?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      universal_game_logs: {
        Row: {
          called_items: string | null
          called_numbers: number[]
          caller_id: string | null
          claimed_at: string
          created_at: string
          game_number: number
          game_type: string
          id: string
          last_called_number: number | null
          player_email: string | null
          player_id: string
          player_name: string
          prize: string | null
          prize_amount: string | null
          prize_shared: boolean
          session_date: string | null
          session_id: string
          session_name: string | null
          session_time: string | null
          shared_with: number | null
          ticket_layout_mask: number
          ticket_numbers: number[]
          ticket_perm: number
          ticket_position: number | null
          ticket_serial: string
          total_calls: number
          validated_at: string
          win_pattern: string
        }
        Insert: {
          called_items?: string | null
          called_numbers: number[]
          caller_id?: string | null
          claimed_at?: string
          created_at?: string
          game_number: number
          game_type: string
          id?: string
          last_called_number?: number | null
          player_email?: string | null
          player_id: string
          player_name: string
          prize?: string | null
          prize_amount?: string | null
          prize_shared?: boolean
          session_date?: string | null
          session_id: string
          session_name?: string | null
          session_time?: string | null
          shared_with?: number | null
          ticket_layout_mask: number
          ticket_numbers: number[]
          ticket_perm: number
          ticket_position?: number | null
          ticket_serial: string
          total_calls: number
          validated_at?: string
          win_pattern: string
        }
        Update: {
          called_items?: string | null
          called_numbers?: number[]
          caller_id?: string | null
          claimed_at?: string
          created_at?: string
          game_number?: number
          game_type?: string
          id?: string
          last_called_number?: number | null
          player_email?: string | null
          player_id?: string
          player_name?: string
          prize?: string | null
          prize_amount?: string | null
          prize_shared?: boolean
          session_date?: string | null
          session_id?: string
          session_name?: string | null
          session_time?: string | null
          shared_with?: number | null
          ticket_layout_mask?: number
          ticket_numbers?: number[]
          ticket_perm?: number
          ticket_position?: number | null
          ticket_serial?: string
          total_calls?: number
          validated_at?: string
          win_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "universal_game_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universal_game_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_ticket_to_player: {
        Args: {
          p_player_id: string
          p_session_id: string
          p_serial: string
          p_perm: number
          p_position: number
          p_layout_mask: number
          p_numbers: number[]
        }
        Returns: string
      }
      get_available_bingo_tickets: {
        Args: { p_count: number }
        Returns: {
          created_at: string
          id: string
          layout_mask: number
          numbers: number[]
          perm: number
          position: number
          serial: string
        }[]
      }
      get_available_tickets_for_session: {
        Args: { p_session_id: string; p_count: number }
        Returns: {
          created_at: string
          id: string
          layout_mask: number
          numbers: number[]
          perm: number
          position: number
          serial: string
        }[]
      }
      is_superuser: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      game_type: "mainstage" | "party" | "quiz" | "music" | "logo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      game_type: ["mainstage", "party", "quiz", "music", "logo"],
    },
  },
} as const
