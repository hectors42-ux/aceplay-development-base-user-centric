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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      category_config: {
        Row: {
          category_key: string
          is_entry: boolean
          label: string
          loss_points: number
          promotes_to_escalafon: boolean
          rank_order: number
          requires_tournament: boolean
          sport: string
        }
        Insert: {
          category_key: string
          is_entry?: boolean
          label: string
          loss_points: number
          promotes_to_escalafon?: boolean
          rank_order: number
          requires_tournament?: boolean
          sport: string
        }
        Update: {
          category_key?: string
          is_entry?: boolean
          label?: string
          loss_points?: number
          promotes_to_escalafon?: boolean
          rank_order?: number
          requires_tournament?: boolean
          sport?: string
        }
        Relationships: []
      }
      club_profile: {
        Row: {
          branding: Json
          legal_name: string | null
          padron_source: string | null
          space_id: string
          tax_id: string | null
        }
        Insert: {
          branding?: Json
          legal_name?: string | null
          padron_source?: string | null
          space_id: string
          tax_id?: string | null
        }
        Update: {
          branding?: Json
          legal_name?: string | null
          padron_source?: string | null
          space_id?: string
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_profile_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "space"
            referencedColumns: ["id"]
          },
        ]
      }
      escalerilla_config: {
        Row: {
          challenge_rules: Json
          pyramid: Json
          season_label: string | null
          space_id: string
        }
        Insert: {
          challenge_rules?: Json
          pyramid?: Json
          season_label?: string | null
          space_id: string
        }
        Update: {
          challenge_rules?: Json
          pyramid?: Json
          season_label?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalerilla_config_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "space"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_state: {
        Row: {
          format: string
          is_primary: boolean
          peldano: number
          points_in_category: number
          rank_order: number
          sport: string
          tournament_win_pending: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          format: string
          is_primary?: boolean
          peldano?: number
          points_in_category?: number
          rank_order: number
          sport: string
          tournament_win_pending?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          format?: string
          is_primary?: boolean
          peldano?: number
          points_in_category?: number
          rank_order?: number
          sport?: string
          tournament_win_pending?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_state: {
        Row: {
          division: string | null
          rank_in_division: number | null
          user_id: string
          week: string
          xp_week: number | null
        }
        Insert: {
          division?: string | null
          rank_in_division?: number | null
          user_id: string
          week: string
          xp_week?: number | null
        }
        Update: {
          division?: string | null
          rank_in_division?: number | null
          user_id?: string
          week?: string
          xp_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sets: {
        Row: {
          games_a: number
          games_b: number
          is_tiebreak: boolean | null
          is_valid: boolean
          match_id: string
          set_index: number
        }
        Insert: {
          games_a: number
          games_b: number
          is_tiebreak?: boolean | null
          is_valid: boolean
          match_id: string
          set_index: number
        }
        Update: {
          games_a?: number
          games_b?: number
          is_tiebreak?: boolean | null
          is_valid?: boolean
          match_id?: string
          set_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          confirmation_status: string
          created_at: string
          format: string
          id: string
          match_winner: string
          played_at: string
          prestige_mult: number
          side_a: string[]
          side_b: string[]
          source_ref: Json | null
          source_type: string
          space_id: string | null
          sport: string
          verified_event: boolean
        }
        Insert: {
          confirmation_status?: string
          created_at?: string
          format: string
          id?: string
          match_winner: string
          played_at: string
          prestige_mult?: number
          side_a: string[]
          side_b: string[]
          source_ref?: Json | null
          source_type: string
          space_id?: string | null
          sport: string
          verified_event?: boolean
        }
        Update: {
          confirmation_status?: string
          created_at?: string
          format?: string
          id?: string
          match_winner?: string
          played_at?: string
          prestige_mult?: number
          side_a?: string[]
          side_b?: string[]
          source_ref?: Json | null
          source_type?: string
          space_id?: string | null
          sport?: string
          verified_event?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "matches_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "space"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          confidence_tier: string
          format: string
          is_primary: boolean
          matches_count: number
          nivel: number | null
          rating: number
          rd: number
          sport: string
          updated_at: string
          user_id: string
          volatility: number
        }
        Insert: {
          confidence_tier?: string
          format: string
          is_primary?: boolean
          matches_count?: number
          nivel?: number | null
          rating?: number
          rd?: number
          sport: string
          updated_at?: string
          user_id: string
          volatility?: number
        }
        Update: {
          confidence_tier?: string
          format?: string
          is_primary?: boolean
          matches_count?: number
          nivel?: number | null
          rating?: number
          rd?: number
          sport?: string
          updated_at?: string
          user_id?: string
          volatility?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          base_delta: number | null
          capped: boolean | null
          context_mult: number | null
          created_at: string | null
          format: string | null
          id: number
          match_id: string | null
          prestige_mult: number | null
          season: number | null
          sport: string | null
          user_id: string | null
          weighted_delta: number | null
        }
        Insert: {
          base_delta?: number | null
          capped?: boolean | null
          context_mult?: number | null
          created_at?: string | null
          format?: string | null
          id?: number
          match_id?: string | null
          prestige_mult?: number | null
          season?: number | null
          sport?: string | null
          user_id?: string | null
          weighted_delta?: number | null
        }
        Update: {
          base_delta?: number | null
          capped?: boolean | null
          context_mult?: number | null
          created_at?: string | null
          format?: string | null
          id?: number
          match_id?: string | null
          prestige_mult?: number | null
          season?: number | null
          sport?: string | null
          user_id?: string | null
          weighted_delta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          backhand: string | null
          bio: string | null
          birthdate: string | null
          created_at: string
          data_consent: Json
          display_name: string
          dominant_hand: string | null
          favorite_shot: string | null
          favorite_surface: string | null
          first_name: string | null
          handle: string
          id: string
          last_name: string | null
          phone: string | null
          playing_style: string | null
          rut: string | null
          show_email: boolean
          show_phone: boolean
          years_playing: number | null
        }
        Insert: {
          avatar_url?: string | null
          backhand?: string | null
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          data_consent?: Json
          display_name: string
          dominant_hand?: string | null
          favorite_shot?: string | null
          favorite_surface?: string | null
          first_name?: string | null
          handle: string
          id: string
          last_name?: string | null
          phone?: string | null
          playing_style?: string | null
          rut?: string | null
          show_email?: boolean
          show_phone?: boolean
          years_playing?: number | null
        }
        Update: {
          avatar_url?: string | null
          backhand?: string | null
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          data_consent?: Json
          display_name?: string
          dominant_hand?: string | null
          favorite_shot?: string | null
          favorite_surface?: string | null
          first_name?: string | null
          handle?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          playing_style?: string | null
          rut?: string | null
          show_email?: boolean
          show_phone?: boolean
          years_playing?: number | null
        }
        Relationships: []
      }
      rating_history: {
        Row: {
          actual_score: number | null
          capped: boolean | null
          context_mult: number | null
          created_at: string | null
          expected_score: number | null
          format: string | null
          id: number
          match_id: string | null
          opponent_rating: number | null
          period_date: string | null
          rating_after: number | null
          rating_before: number | null
          rd_after: number | null
          rd_before: number | null
          sport: string | null
          user_id: string | null
        }
        Insert: {
          actual_score?: number | null
          capped?: boolean | null
          context_mult?: number | null
          created_at?: string | null
          expected_score?: number | null
          format?: string | null
          id?: number
          match_id?: string | null
          opponent_rating?: number | null
          period_date?: string | null
          rating_after?: number | null
          rating_before?: number | null
          rd_after?: number | null
          rd_before?: number | null
          sport?: string | null
          user_id?: string | null
        }
        Update: {
          actual_score?: number | null
          capped?: boolean | null
          context_mult?: number | null
          created_at?: string | null
          expected_score?: number | null
          format?: string | null
          id?: number
          match_id?: string | null
          opponent_rating?: number | null
          period_date?: string | null
          rating_after?: number | null
          rating_before?: number | null
          rd_after?: number | null
          rd_before?: number | null
          sport?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      space: {
        Row: {
          created_at: string
          id: string
          join_policy: Database["public"]["Enums"]["join_policy"]
          name: string
          organizer_id: string
          parent_space_id: string | null
          path: unknown
          settings: Json
          slug: string
          sport: string | null
          status: string
          type: Database["public"]["Enums"]["space_type"]
          visibility: Database["public"]["Enums"]["space_visibility"]
        }
        Insert: {
          created_at?: string
          id?: string
          join_policy?: Database["public"]["Enums"]["join_policy"]
          name: string
          organizer_id: string
          parent_space_id?: string | null
          path: unknown
          settings?: Json
          slug: string
          sport?: string | null
          status?: string
          type: Database["public"]["Enums"]["space_type"]
          visibility?: Database["public"]["Enums"]["space_visibility"]
        }
        Update: {
          created_at?: string
          id?: string
          join_policy?: Database["public"]["Enums"]["join_policy"]
          name?: string
          organizer_id?: string
          parent_space_id?: string | null
          path?: unknown
          settings?: Json
          slug?: string
          sport?: string | null
          status?: string
          type?: Database["public"]["Enums"]["space_type"]
          visibility?: Database["public"]["Enums"]["space_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "space_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_parent_space_id_fkey"
            columns: ["parent_space_id"]
            isOneToOne: false
            referencedRelation: "space"
            referencedColumns: ["id"]
          },
        ]
      }
      space_membership: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          player_id: string
          role: Database["public"]["Enums"]["membership_role"]
          space_id: string
          status: Database["public"]["Enums"]["membership_status"]
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          player_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          space_id: string
          status?: Database["public"]["Enums"]["membership_status"]
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          player_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          space_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
        }
        Relationships: [
          {
            foreignKeyName: "space_membership_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_membership_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_membership_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "space"
            referencedColumns: ["id"]
          },
        ]
      }
      space_standing: {
        Row: {
          local_rank: number | null
          local_state: Json
          player_id: string
          space_id: string
          updated_at: string
        }
        Insert: {
          local_rank?: number | null
          local_state?: Json
          player_id: string
          space_id: string
          updated_at?: string
        }
        Update: {
          local_rank?: number | null
          local_state?: Json
          player_id?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_standing_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_standing_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "space"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_config: {
        Row: {
          agendamiento: string | null
          ciclo: string | null
          disciplina: string
          motor: string
          prestige_mult: number
          scoring: string | null
          space_id: string
        }
        Insert: {
          agendamiento?: string | null
          ciclo?: string | null
          disciplina: string
          motor: string
          prestige_mult?: number
          scoring?: string | null
          space_id: string
        }
        Update: {
          agendamiento?: string | null
          ciclo?: string | null
          disciplina?: string
          motor?: string
          prestige_mult?: number
          scoring?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_config_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "space"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_ledger: {
        Row: {
          action_type: string | null
          created_at: string | null
          id: number
          user_id: string | null
          week: string | null
          xp: number | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          id?: number
          user_id?: string | null
          week?: string | null
          xp?: number | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          id?: number
          user_id?: string | null
          week?: string | null
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_space: { Args: { p_space: string }; Returns: boolean }
      get_player_category: {
        Args: { _nivel: number; _sport?: string }
        Returns: string
      }
      is_member_of_space: { Args: { p_space: string }; Returns: boolean }
      is_minor: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: boolean
      }
      space_admin: { Args: { p_space: string }; Returns: boolean }
      text2ltree: { Args: { "": string }; Returns: unknown }
    }
    Enums: {
      join_policy: "open" | "request" | "invite" | "code" | "socios_only"
      membership_role: "owner" | "admin" | "organizer" | "player" | "spectator"
      membership_status: "active" | "pending" | "invited" | "suspended" | "left"
      space_type:
        | "club"
        | "tournament"
        | "category"
        | "escalerilla"
        | "liga"
        | "escalafon"
      space_visibility: "public" | "members" | "hierarchy"
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
    Enums: {
      join_policy: ["open", "request", "invite", "code", "socios_only"],
      membership_role: ["owner", "admin", "organizer", "player", "spectator"],
      membership_status: ["active", "pending", "invited", "suspended", "left"],
      space_type: [
        "club",
        "tournament",
        "category",
        "escalerilla",
        "liga",
        "escalafon",
      ],
      space_visibility: ["public", "members", "hierarchy"],
    },
  },
} as const
