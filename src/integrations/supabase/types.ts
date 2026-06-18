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
      profiles: {
        Row: {
          avatar_url: string | null
          birthdate: string | null
          created_at: string
          data_consent: Json
          display_name: string
          handle: string
          id: string
          rut: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthdate?: string | null
          created_at?: string
          data_consent?: Json
          display_name: string
          handle: string
          id: string
          rut?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthdate?: string | null
          created_at?: string
          data_consent?: Json
          display_name?: string
          handle?: string
          id?: string
          rut?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_space: { Args: { p_space: string }; Returns: boolean }
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
