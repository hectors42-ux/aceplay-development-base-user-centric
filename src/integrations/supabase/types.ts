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
      americano_rounds: {
        Row: {
          bye_user_ids: string[]
          created_at: string
          id: string
          round_number: number
          status: string
          tenant_id: string
          tournament_category_id: string
          tournament_session_id: string | null
          updated_at: string
        }
        Insert: {
          bye_user_ids?: string[]
          created_at?: string
          id?: string
          round_number: number
          status?: string
          tenant_id: string
          tournament_category_id: string
          tournament_session_id?: string | null
          updated_at?: string
        }
        Update: {
          bye_user_ids?: string[]
          created_at?: string
          id?: string
          round_number?: number
          status?: string
          tenant_id?: string
          tournament_category_id?: string
          tournament_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "americano_rounds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "americano_rounds_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "americano_rounds_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_finance"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "americano_rounds_tournament_session_id_fkey"
            columns: ["tournament_session_id"]
            isOneToOne: false
            referencedRelation: "tournament_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          event_props: Json
          id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          event_props?: Json
          id?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          event_props?: Json
          id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_thresholds: {
        Row: {
          caida_actividad_pct: number
          created_at: string
          inactividad_critica_dias: number
          inactividad_riesgo_dias: number
          mora_critica_clp: number
          ocupacion_critica_pct: number
          ocupacion_valle_pct: number
          peak_hour_end: number
          peak_hour_start: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          caida_actividad_pct?: number
          created_at?: string
          inactividad_critica_dias?: number
          inactividad_riesgo_dias?: number
          mora_critica_clp?: number
          ocupacion_critica_pct?: number
          ocupacion_valle_pct?: number
          peak_hour_end?: number
          peak_hour_start?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          caida_actividad_pct?: number
          created_at?: string
          inactividad_critica_dias?: number
          inactividad_riesgo_dias?: number
          mora_critica_clp?: number
          ocupacion_critica_pct?: number
          ocupacion_valle_pct?: number
          peak_hour_end?: number
          peak_hour_start?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_thresholds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: Database["public"]["Enums"]["badge_category"]
          code: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          threshold: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["badge_category"]
          code: string
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          threshold?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["badge_category"]
          code?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          threshold?: number | null
        }
        Relationships: []
      }
      booking_rules: {
        Row: {
          allow_back_to_back: boolean
          max_active_bookings: number
          max_advance_days: number
          min_cancel_hours: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_back_to_back?: boolean
          max_active_bookings?: number
          max_advance_days?: number
          min_cancel_hours?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_back_to_back?: boolean
          max_active_bookings?: number
          max_advance_days?: number
          min_cancel_hours?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          block_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          court_id: string
          created_at: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          notes: string | null
          partner_user_id: string | null
          period: unknown
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          block_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          court_id: string
          created_at?: string
          ends_at: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          notes?: string | null
          partner_user_id?: string | null
          period?: unknown
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          user_id: string
        }
        Update: {
          block_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          court_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          notes?: string | null
          partner_user_id?: string | null
          period?: unknown
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      club_announcements: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_published: boolean
          priority: Database["public"]["Enums"]["announcement_priority"]
          starts_at: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          priority?: Database["public"]["Enums"]["announcement_priority"]
          starts_at?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          priority?: Database["public"]["Enums"]["announcement_priority"]
          starts_at?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          coach_id: string
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          is_recurring: boolean
          starts_at: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          starts_at: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          starts_at?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_class_blocks: {
        Row: {
          allow_external: boolean
          coach_id: string | null
          court_id: string
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          notes: string | null
          starts_at: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          allow_external?: boolean
          coach_id?: string | null
          court_id: string
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          notes?: string | null
          starts_at: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          allow_external?: boolean
          coach_id?: string | null
          court_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          starts_at?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_class_blocks_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_class_blocks_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_class_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_class_bookings: {
        Row: {
          booking_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          coach_id: string
          completed_at: string | null
          court_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          ends_at: string
          external_student_name: string | null
          external_student_phone: string | null
          id: string
          kind: Database["public"]["Enums"]["coach_class_kind"]
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_status: Database["public"]["Enums"]["coach_payment_status"]
          price_clp: number
          starts_at: string
          status: Database["public"]["Enums"]["coach_class_status"]
          student1_user_id: string | null
          student2_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          coach_id: string
          completed_at?: string | null
          court_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes: number
          ends_at: string
          external_student_name?: string | null
          external_student_phone?: string | null
          id?: string
          kind: Database["public"]["Enums"]["coach_class_kind"]
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_status?: Database["public"]["Enums"]["coach_payment_status"]
          price_clp?: number
          starts_at: string
          status?: Database["public"]["Enums"]["coach_class_status"]
          student1_user_id?: string | null
          student2_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          coach_id?: string
          completed_at?: string | null
          court_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          ends_at?: string
          external_student_name?: string | null
          external_student_phone?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["coach_class_kind"]
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_status?: Database["public"]["Enums"]["coach_payment_status"]
          price_clp?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["coach_class_status"]
          student1_user_id?: string | null
          student2_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_class_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_class_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_class_bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_class_bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_payments: {
        Row: {
          classes_count: number
          coach_id: string
          created_at: string
          id: string
          marked_by: string | null
          marked_paid_at: string | null
          notes: string | null
          period_end: string
          period_start: string
          tenant_id: string
          total_clp: number
          updated_at: string
        }
        Insert: {
          classes_count?: number
          coach_id: string
          created_at?: string
          id?: string
          marked_by?: string | null
          marked_paid_at?: string | null
          notes?: string | null
          period_end: string
          period_start: string
          tenant_id: string
          total_clp?: number
          updated_at?: string
        }
        Update: {
          classes_count?: number
          coach_id?: string
          created_at?: string
          id?: string
          marked_by?: string | null
          marked_paid_at?: string | null
          notes?: string | null
          period_end?: string
          period_start?: string
          tenant_id?: string
          total_clp?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          accepts_external: boolean
          bio_pro: string | null
          certifications: string | null
          created_at: string
          display_order: number
          hourly_rate_external_clp: number
          hourly_rate_member_clp: number
          hourly_rate_shared_clp: number
          id: string
          is_active: boolean
          is_head_coach: boolean
          languages: string[] | null
          photo_url: string | null
          specialties: string[] | null
          sports: string[]
          tenant_id: string
          updated_at: string
          user_id: string
          years_coaching: number | null
        }
        Insert: {
          accepts_external?: boolean
          bio_pro?: string | null
          certifications?: string | null
          created_at?: string
          display_order?: number
          hourly_rate_external_clp?: number
          hourly_rate_member_clp?: number
          hourly_rate_shared_clp?: number
          id?: string
          is_active?: boolean
          is_head_coach?: boolean
          languages?: string[] | null
          photo_url?: string | null
          specialties?: string[] | null
          sports?: string[]
          tenant_id: string
          updated_at?: string
          user_id: string
          years_coaching?: number | null
        }
        Update: {
          accepts_external?: boolean
          bio_pro?: string | null
          certifications?: string | null
          created_at?: string
          display_order?: number
          hourly_rate_external_clp?: number
          hourly_rate_member_clp?: number
          hourly_rate_shared_clp?: number
          id?: string
          is_active?: boolean
          is_head_coach?: boolean
          languages?: string[] | null
          photo_url?: string | null
          specialties?: string[] | null
          sports?: string[]
          tenant_id?: string
          updated_at?: string
          user_id?: string
          years_coaching?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          is_active: boolean
          is_indoor: boolean
          name: string
          opens_at: string
          slot_minutes: number
          sort_order: number
          sport: string
          surface: Database["public"]["Enums"]["court_surface"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closes_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_indoor?: boolean
          name: string
          opens_at?: string
          slot_minutes?: number
          sort_order?: number
          sport?: string
          surface?: Database["public"]["Enums"]["court_surface"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_indoor?: boolean
          name?: string
          opens_at?: string
          slot_minutes?: number
          sort_order?: number
          sport?: string
          surface?: Database["public"]["Enums"]["court_surface"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_challenge_schedule_proposals: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          proposed_at: string
          proposed_by: string
          selected_at: string | null
          selected_by: string | null
          selected_slot: number | null
          slot1_court_id: string
          slot1_starts_at: string
          slot2_court_id: string | null
          slot2_starts_at: string | null
          slot3_court_id: string | null
          slot3_starts_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          proposed_at?: string
          proposed_by: string
          selected_at?: string | null
          selected_by?: string | null
          selected_slot?: number | null
          slot1_court_id: string
          slot1_starts_at: string
          slot2_court_id?: string | null
          slot2_starts_at?: string | null
          slot3_court_id?: string | null
          slot3_starts_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          proposed_at?: string
          proposed_by?: string
          selected_at?: string | null
          selected_by?: string | null
          selected_slot?: number | null
          slot1_court_id?: string
          slot1_starts_at?: string
          slot2_court_id?: string | null
          slot2_starts_at?: string | null
          slot3_court_id?: string | null
          slot3_starts_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_challenge_schedule_proposals_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "ladder_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenge_schedule_proposals_slot1_court_id_fkey"
            columns: ["slot1_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenge_schedule_proposals_slot2_court_id_fkey"
            columns: ["slot2_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenge_schedule_proposals_slot3_court_id_fkey"
            columns: ["slot3_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenge_schedule_proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_challenges: {
        Row: {
          booking_id: string | null
          cancel_reason: string | null
          challenged_partner_user_id: string | null
          challenged_position: number | null
          challenged_user_id: string
          challenger_partner_user_id: string | null
          challenger_position: number | null
          challenger_user_id: string
          court_id: string | null
          created_at: string
          expires_at: string
          id: string
          ladder_id: string | null
          loser_user_id: string | null
          played_at: string | null
          proposed_at: string
          reject_reason: string | null
          responded_at: string | null
          result_confirmed_at: string | null
          result_proposed_at: string | null
          result_proposed_by: string | null
          retired: boolean
          scheduled_at: string | null
          score: Json | null
          status: Database["public"]["Enums"]["ladder_challenge_status"]
          tenant_id: string
          tournament_category_id: string | null
          tournament_match_id: string | null
          updated_at: string
          walkover: boolean
          winner_user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          cancel_reason?: string | null
          challenged_partner_user_id?: string | null
          challenged_position?: number | null
          challenged_user_id: string
          challenger_partner_user_id?: string | null
          challenger_position?: number | null
          challenger_user_id: string
          court_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ladder_id?: string | null
          loser_user_id?: string | null
          played_at?: string | null
          proposed_at?: string
          reject_reason?: string | null
          responded_at?: string | null
          result_confirmed_at?: string | null
          result_proposed_at?: string | null
          result_proposed_by?: string | null
          retired?: boolean
          scheduled_at?: string | null
          score?: Json | null
          status?: Database["public"]["Enums"]["ladder_challenge_status"]
          tenant_id: string
          tournament_category_id?: string | null
          tournament_match_id?: string | null
          updated_at?: string
          walkover?: boolean
          winner_user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          cancel_reason?: string | null
          challenged_partner_user_id?: string | null
          challenged_position?: number | null
          challenged_user_id?: string
          challenger_partner_user_id?: string | null
          challenger_position?: number | null
          challenger_user_id?: string
          court_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ladder_id?: string | null
          loser_user_id?: string | null
          played_at?: string | null
          proposed_at?: string
          reject_reason?: string | null
          responded_at?: string | null
          result_confirmed_at?: string | null
          result_proposed_at?: string | null
          result_proposed_by?: string | null
          retired?: boolean
          scheduled_at?: string | null
          score?: Json | null
          status?: Database["public"]["Enums"]["ladder_challenge_status"]
          tenant_id?: string
          tournament_category_id?: string | null
          tournament_match_id?: string | null
          updated_at?: string
          walkover?: boolean
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ladder_challenges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenges_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenges_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenges_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_challenges_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_finance"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "ladder_challenges_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_history: {
        Row: {
          challenge_id: string | null
          id: string
          ladder_id: string
          notes: string | null
          position_after: number | null
          position_before: number | null
          reason: Database["public"]["Enums"]["ladder_history_reason"]
          recorded_at: string
          recorded_by: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          challenge_id?: string | null
          id?: string
          ladder_id: string
          notes?: string | null
          position_after?: number | null
          position_before?: number | null
          reason: Database["public"]["Enums"]["ladder_history_reason"]
          recorded_at?: string
          recorded_by?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          challenge_id?: string | null
          id?: string
          ladder_id?: string
          notes?: string | null
          position_after?: number | null
          position_before?: number | null
          reason?: Database["public"]["Enums"]["ladder_history_reason"]
          recorded_at?: string
          recorded_by?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_history_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "ladder_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_history_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_positions: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          ladder_id: string
          last_challenged_at: string | null
          last_played_at: string | null
          losses: number
          position: number
          status: Database["public"]["Enums"]["ladder_position_status"]
          tenant_id: string
          updated_at: string
          user_id: string
          walkovers_against: number
          walkovers_for: number
          wins: number
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          ladder_id: string
          last_challenged_at?: string | null
          last_played_at?: string | null
          losses?: number
          position: number
          status?: Database["public"]["Enums"]["ladder_position_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
          walkovers_against?: number
          walkovers_for?: number
          wins?: number
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          ladder_id?: string
          last_challenged_at?: string | null
          last_played_at?: string | null
          losses?: number
          position?: number
          status?: Database["public"]["Enums"]["ladder_position_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
          walkovers_against?: number
          walkovers_for?: number
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "ladder_positions_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ladders: {
        Row: {
          challenge_window_days: number
          cooldown_days: number
          created_at: string
          created_by: string | null
          description: string | null
          discipline: Database["public"]["Enums"]["tournament_discipline"]
          gender: Database["public"]["Enums"]["category_gender"]
          id: string
          inactivity_days: number
          inactivity_drop_positions: number
          is_active: boolean
          loser_drops_position: boolean
          max_position_jump: number
          name: string
          response_window_hours: number
          result_validation_mode: Database["public"]["Enums"]["result_validation_mode"]
          season_ends_at: string | null
          season_starts_at: string | null
          surface: Database["public"]["Enums"]["court_surface"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          challenge_window_days?: number
          cooldown_days?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          discipline?: Database["public"]["Enums"]["tournament_discipline"]
          gender?: Database["public"]["Enums"]["category_gender"]
          id?: string
          inactivity_days?: number
          inactivity_drop_positions?: number
          is_active?: boolean
          loser_drops_position?: boolean
          max_position_jump?: number
          name: string
          response_window_hours?: number
          result_validation_mode?: Database["public"]["Enums"]["result_validation_mode"]
          season_ends_at?: string | null
          season_starts_at?: string | null
          surface?: Database["public"]["Enums"]["court_surface"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          challenge_window_days?: number
          cooldown_days?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          discipline?: Database["public"]["Enums"]["tournament_discipline"]
          gender?: Database["public"]["Enums"]["category_gender"]
          id?: string
          inactivity_days?: number
          inactivity_drop_positions?: number
          is_active?: boolean
          loser_drops_position?: boolean
          max_position_jump?: number
          name?: string
          response_window_hours?: number
          result_validation_mode?: Database["public"]["Enums"]["result_validation_mode"]
          season_ends_at?: string | null
          season_starts_at?: string | null
          surface?: Database["public"]["Enums"]["court_surface"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content_md: string
          created_at: string
          created_by: string | null
          effective_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          tenant_id: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          content_md: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          tenant_id?: string | null
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["legal_doc_kind"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      match_invitations: {
        Row: {
          booking_id: string | null
          compat_score: number | null
          created_at: string
          expires_at: string
          id: string
          invitee_user_id: string
          inviter_user_id: string
          message: string | null
          proposed_slots: Json
          responded_at: string | null
          selected_slot: Json | null
          status: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          compat_score?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          invitee_user_id: string
          inviter_user_id: string
          message?: string | null
          proposed_slots: Json
          responded_at?: string | null
          selected_slot?: Json | null
          status?: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          compat_score?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          invitee_user_id?: string
          inviter_user_id?: string
          message?: string | null
          proposed_slots?: Json
          responded_at?: string | null
          selected_slot?: Json | null
          status?: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_observation_outbox: {
        Row: {
          created_at: string
          format: string
          id: string
          match_winner: string
          played_at: string
          sets: Json
          side_a_players: string[]
          side_b_players: string[]
          source_type: string
          sport: string
          status: string
          tenant_id: string
          tournament_match_id: string
          verified_source: boolean
        }
        Insert: {
          created_at?: string
          format: string
          id?: string
          match_winner: string
          played_at: string
          sets: Json
          side_a_players: string[]
          side_b_players: string[]
          source_type: string
          sport: string
          status?: string
          tenant_id: string
          tournament_match_id: string
          verified_source?: boolean
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          match_winner?: string
          played_at?: string
          sets?: Json
          side_a_players?: string[]
          side_b_players?: string[]
          source_type?: string
          sport?: string
          status?: string
          tenant_id?: string
          tournament_match_id?: string
          verified_source?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "match_observation_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_observation_outbox_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_of_the_week: {
        Row: {
          computed_at: string
          highlight_label: string | null
          id: string
          kind: string
          level_a: number | null
          level_b: number | null
          level_diff: number | null
          played_at: string
          player_a_id: string
          player_b_id: string
          score: Json | null
          source_id: string
          source_table: string
          tenant_id: string
          week_start: string
          winner_id: string | null
        }
        Insert: {
          computed_at?: string
          highlight_label?: string | null
          id?: string
          kind: string
          level_a?: number | null
          level_b?: number | null
          level_diff?: number | null
          played_at: string
          player_a_id: string
          player_b_id: string
          score?: Json | null
          source_id: string
          source_table: string
          tenant_id: string
          week_start: string
          winner_id?: string | null
        }
        Update: {
          computed_at?: string
          highlight_label?: string | null
          id?: string
          kind?: string
          level_a?: number | null
          level_b?: number | null
          level_diff?: number | null
          played_at?: string
          player_a_id?: string
          player_b_id?: string
          score?: Json | null
          source_id?: string
          source_table?: string
          tenant_id?: string
          week_start?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_of_the_week_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      match_open_post_slots: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          post_id: string
          slot_index: number
          team: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          post_id: string
          slot_index: number
          team: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          post_id?: string
          slot_index?: number
          team?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_open_post_slots_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "match_open_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      match_open_posts: {
        Row: {
          available_slots: Json
          court_id: string | null
          created_at: string
          expires_at: string
          format: Database["public"]["Enums"]["partner_match_format"]
          gender_filter: Database["public"]["Enums"]["open_match_gender_filter"]
          id: string
          level_max: number | null
          level_min: number | null
          match_type: Database["public"]["Enums"]["open_match_type"]
          mode: Database["public"]["Enums"]["open_match_mode"]
          note: string | null
          partner_user_id: string | null
          slots_total: number
          sport: string
          status: Database["public"]["Enums"]["partner_post_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_slots: Json
          court_id?: string | null
          created_at?: string
          expires_at?: string
          format?: Database["public"]["Enums"]["partner_match_format"]
          gender_filter?: Database["public"]["Enums"]["open_match_gender_filter"]
          id?: string
          level_max?: number | null
          level_min?: number | null
          match_type?: Database["public"]["Enums"]["open_match_type"]
          mode?: Database["public"]["Enums"]["open_match_mode"]
          note?: string | null
          partner_user_id?: string | null
          slots_total?: number
          sport?: string
          status?: Database["public"]["Enums"]["partner_post_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_slots?: Json
          court_id?: string | null
          created_at?: string
          expires_at?: string
          format?: Database["public"]["Enums"]["partner_match_format"]
          gender_filter?: Database["public"]["Enums"]["open_match_gender_filter"]
          id?: string
          level_max?: number | null
          level_min?: number | null
          match_type?: Database["public"]["Enums"]["open_match_type"]
          mode?: Database["public"]["Enums"]["open_match_mode"]
          note?: string | null
          partner_user_id?: string | null
          slots_total?: number
          sport?: string
          status?: Database["public"]["Enums"]["partner_post_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      match_post_responses: {
        Row: {
          created_at: string
          id: string
          message: string | null
          post_id: string
          responder_user_id: string
          selected_slot: Json
          status: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          post_id: string
          responder_user_id: string
          selected_slot: Json
          status?: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string
          responder_user_id?: string
          selected_slot?: Json
          status?: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_post_responses_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "match_open_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      match_search_filters: {
        Row: {
          category: string | null
          level_delta: number
          preferred_days: number[] | null
          surface: Database["public"]["Enums"]["court_surface"] | null
          tenant_id: string
          time_window: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          level_delta?: number
          preferred_days?: number[] | null
          surface?: Database["public"]["Enums"]["court_surface"] | null
          tenant_id: string
          time_window?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          level_delta?: number
          preferred_days?: number[] | null
          surface?: Database["public"]["Enums"]["court_surface"] | null
          tenant_id?: string
          time_window?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          invited_by: string | null
          last_name: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          rut: string | null
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          first_name: string
          id?: string
          invited_by?: string | null
          last_name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          rut?: string | null
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          invited_by?: string | null
          last_name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          rut?: string | null
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dismissals: {
        Row: {
          created_at: string
          id: string
          kind: string
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_match_results: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          invitation_id: string
          loser_user_id: string
          proposed_at: string
          proposed_by: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          retired: boolean
          score: Json | null
          status: string
          tenant_id: string
          updated_at: string
          walkover: boolean
          winner_user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          invitation_id: string
          loser_user_id: string
          proposed_at?: string
          proposed_by: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          retired?: boolean
          score?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string
          walkover?: boolean
          winner_user_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          invitation_id?: string
          loser_user_id?: string
          proposed_at?: string
          proposed_by?: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          retired?: boolean
          score?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
          walkover?: boolean
          winner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_match_results_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "match_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          competitive_matches: number
          created_at: string
          id: string
          initial_level: number | null
          last_change_delta: number
          last_match_at: string | null
          level: number
          matches_played: number
          onboarding_completed_at: string | null
          reliability: number
          sport: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          competitive_matches?: number
          created_at?: string
          id?: string
          initial_level?: number | null
          last_change_delta?: number
          last_match_at?: string | null
          level?: number
          matches_played?: number
          onboarding_completed_at?: string | null
          reliability?: number
          sport?: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          competitive_matches?: number
          created_at?: string
          id?: string
          initial_level?: number | null
          last_change_delta?: number
          last_match_at?: string | null
          level?: number
          matches_played?: number
          onboarding_completed_at?: string | null
          reliability?: number
          sport?: Database["public"]["Enums"]["rating_sport"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepted_privacy_at: string | null
          accepted_terms_at: string | null
          availability: string | null
          avatar_url: string | null
          backhand: string | null
          bio: string | null
          birth_date: string | null
          club_ranking: number | null
          created_at: string
          dominant_hand: string | null
          dues_status: Database["public"]["Enums"]["dues_status"]
          email: string
          favorite_shot: string | null
          favorite_surface: Database["public"]["Enums"]["court_surface"] | null
          first_name: string
          id: string
          last_name: string
          member_since: string
          membership_activated_at: string | null
          membership_expires_at: string | null
          membership_source_tournament: string | null
          membership_type: string
          ntrp_level: number | null
          padel_dominant_side: string | null
          padel_position: string | null
          phone: string | null
          playing_style: string | null
          preferred_sport: string
          rut: string | null
          show_email: boolean
          show_phone: boolean
          tenant_id: string
          theme: string
          theme_mode: string
          updated_at: string
          user_id: string
          years_playing: number | null
        }
        Insert: {
          accepted_privacy_at?: string | null
          accepted_terms_at?: string | null
          availability?: string | null
          avatar_url?: string | null
          backhand?: string | null
          bio?: string | null
          birth_date?: string | null
          club_ranking?: number | null
          created_at?: string
          dominant_hand?: string | null
          dues_status?: Database["public"]["Enums"]["dues_status"]
          email: string
          favorite_shot?: string | null
          favorite_surface?: Database["public"]["Enums"]["court_surface"] | null
          first_name: string
          id?: string
          last_name: string
          member_since?: string
          membership_activated_at?: string | null
          membership_expires_at?: string | null
          membership_source_tournament?: string | null
          membership_type?: string
          ntrp_level?: number | null
          padel_dominant_side?: string | null
          padel_position?: string | null
          phone?: string | null
          playing_style?: string | null
          preferred_sport?: string
          rut?: string | null
          show_email?: boolean
          show_phone?: boolean
          tenant_id: string
          theme?: string
          theme_mode?: string
          updated_at?: string
          user_id: string
          years_playing?: number | null
        }
        Update: {
          accepted_privacy_at?: string | null
          accepted_terms_at?: string | null
          availability?: string | null
          avatar_url?: string | null
          backhand?: string | null
          bio?: string | null
          birth_date?: string | null
          club_ranking?: number | null
          created_at?: string
          dominant_hand?: string | null
          dues_status?: Database["public"]["Enums"]["dues_status"]
          email?: string
          favorite_shot?: string | null
          favorite_surface?: Database["public"]["Enums"]["court_surface"] | null
          first_name?: string
          id?: string
          last_name?: string
          member_since?: string
          membership_activated_at?: string | null
          membership_expires_at?: string | null
          membership_source_tournament?: string | null
          membership_type?: string
          ntrp_level?: number | null
          padel_dominant_side?: string | null
          padel_position?: string | null
          phone?: string | null
          playing_style?: string | null
          preferred_sport?: string
          rut?: string | null
          show_email?: boolean
          show_phone?: boolean
          tenant_id?: string
          theme?: string
          theme_mode?: string
          updated_at?: string
          user_id?: string
          years_playing?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_membership_source_tournament_fkey"
            columns: ["membership_source_tournament"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "profiles_membership_source_tournament_fkey"
            columns: ["membership_source_tournament"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_history: {
        Row: {
          delta: number
          id: string
          level_after: number
          level_before: number
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          reliability_after: number
          reliability_before: number
          source: Database["public"]["Enums"]["rating_change_source"]
          source_ref_id: string | null
          sport: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          delta: number
          id?: string
          level_after: number
          level_before: number
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reliability_after: number
          reliability_before: number
          source: Database["public"]["Enums"]["rating_change_source"]
          source_ref_id?: string | null
          sport: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          user_id: string
        }
        Update: {
          delta?: number
          id?: string
          level_after?: number
          level_before?: number
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reliability_after?: number
          reliability_before?: number
          source?: Database["public"]["Enums"]["rating_change_source"]
          source_ref_id?: string | null
          sport?: Database["public"]["Enums"]["rating_sport"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      standings_snapshots: {
        Row: {
          category_id: string
          consecutive_wins: number
          id: string
          points: number
          position: number
          registration_id: string
          snapshot_at: string
          snapshot_date: string | null
          tenant_id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          category_id: string
          consecutive_wins?: number
          id?: string
          points?: number
          position: number
          registration_id: string
          snapshot_at?: string
          snapshot_date?: string | null
          tenant_id: string
          tournament_id: string
          user_id: string
        }
        Update: {
          category_id?: string
          consecutive_wins?: number
          id?: string
          points?: number
          position?: number
          registration_id?: string
          snapshot_at?: string
          snapshot_date?: string | null
          tenant_id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standings_snapshots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_snapshots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_finance"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "standings_snapshots_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "standings_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      suggested_matchup_of_the_week: {
        Row: {
          computed_at: string
          id: string
          level_a: number | null
          level_b: number | null
          level_diff: number | null
          player_a_id: string
          player_b_id: string
          reason: string | null
          score: number
          tenant_id: string
          week_start: string
        }
        Insert: {
          computed_at?: string
          id?: string
          level_a?: number | null
          level_b?: number | null
          level_diff?: number | null
          player_a_id: string
          player_b_id: string
          reason?: string | null
          score?: number
          tenant_id: string
          week_start: string
        }
        Update: {
          computed_at?: string
          id?: string
          level_a?: number | null
          level_b?: number | null
          level_diff?: number | null
          player_a_id?: string
          player_b_id?: string
          reason?: string | null
          score?: number
          tenant_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_matchup_of_the_week_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_rating_config: {
        Row: {
          category_a_min: number
          category_b_max: number
          category_c_max: number
          created_at: string
          k_factor_high_reliability: number
          k_factor_low_reliability: number
          k_factor_mid_reliability: number
          min_reliability_for_category: number
          reliability_decay_after_days: number
          reliability_decay_per_period: number
          reliability_gain_per_match: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_a_min?: number
          category_b_max?: number
          category_c_max?: number
          created_at?: string
          k_factor_high_reliability?: number
          k_factor_low_reliability?: number
          k_factor_mid_reliability?: number
          min_reliability_for_category?: number
          reliability_decay_after_days?: number
          reliability_decay_per_period?: number
          reliability_gain_per_match?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_a_min?: number
          category_b_max?: number
          category_c_max?: number
          created_at?: string
          k_factor_high_reliability?: number
          k_factor_low_reliability?: number
          k_factor_mid_reliability?: number
          min_reliability_for_category?: number
          reliability_decay_after_days?: number
          reliability_decay_per_period?: number
          reliability_gain_per_match?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_rating_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          bookings_provider: string
          brand_primary: string
          brand_primary_deep: string
          brand_primary_glow: string
          created_at: string
          domain: string | null
          external_booking_url: string | null
          id: string
          is_institutional: boolean
          ladder_label: string
          logo_url: string | null
          name: string
          short_name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          bookings_provider?: string
          brand_primary?: string
          brand_primary_deep?: string
          brand_primary_glow?: string
          created_at?: string
          domain?: string | null
          external_booking_url?: string | null
          id?: string
          is_institutional?: boolean
          ladder_label?: string
          logo_url?: string | null
          name: string
          short_name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          bookings_provider?: string
          brand_primary?: string
          brand_primary_deep?: string
          brand_primary_glow?: string
          created_at?: string
          domain?: string | null
          external_booking_url?: string | null
          id?: string
          is_institutional?: boolean
          ladder_label?: string
          logo_url?: string | null
          name?: string
          short_name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_alerts: {
        Row: {
          created_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_categories: {
        Row: {
          americano_rounds_target: number | null
          bracket_generated_at: string | null
          category_label: string
          close_mode: string
          config: Json
          created_at: string
          deadline_at: string | null
          discipline: Database["public"]["Enums"]["tournament_discipline"]
          entry_fee_clp: number
          gender: Database["public"]["Enums"]["category_gender"]
          groups_count: number | null
          home_tenant_id: string | null
          id: string
          max_participants: number
          modality: Database["public"]["Enums"]["tournament_modality"]
          motor: Database["public"]["Enums"]["competition_motor"]
          name: string
          operational_rules: Json
          preset_key: string | null
          prize_allocation: Json
          qualifiers_per_group: number
          roster_locked_at: string | null
          scheduling: string
          seeding_method: Database["public"]["Enums"]["seeding_method"]
          sort_order: number
          sport: Database["public"]["Enums"]["tournament_sport"]
          status: Database["public"]["Enums"]["tournament_status"]
          surface: Database["public"]["Enums"]["court_surface"]
          tenant_id: string
          tiebreaker_weights: Json
          tournament_id: string
          updated_at: string
        }
        Insert: {
          americano_rounds_target?: number | null
          bracket_generated_at?: string | null
          category_label?: string
          close_mode?: string
          config?: Json
          created_at?: string
          deadline_at?: string | null
          discipline?: Database["public"]["Enums"]["tournament_discipline"]
          entry_fee_clp?: number
          gender?: Database["public"]["Enums"]["category_gender"]
          groups_count?: number | null
          home_tenant_id?: string | null
          id?: string
          max_participants?: number
          modality?: Database["public"]["Enums"]["tournament_modality"]
          motor?: Database["public"]["Enums"]["competition_motor"]
          name: string
          operational_rules?: Json
          preset_key?: string | null
          prize_allocation?: Json
          qualifiers_per_group?: number
          roster_locked_at?: string | null
          scheduling?: string
          seeding_method?: Database["public"]["Enums"]["seeding_method"]
          sort_order?: number
          sport?: Database["public"]["Enums"]["tournament_sport"]
          status?: Database["public"]["Enums"]["tournament_status"]
          surface?: Database["public"]["Enums"]["court_surface"]
          tenant_id: string
          tiebreaker_weights?: Json
          tournament_id: string
          updated_at?: string
        }
        Update: {
          americano_rounds_target?: number | null
          bracket_generated_at?: string | null
          category_label?: string
          close_mode?: string
          config?: Json
          created_at?: string
          deadline_at?: string | null
          discipline?: Database["public"]["Enums"]["tournament_discipline"]
          entry_fee_clp?: number
          gender?: Database["public"]["Enums"]["category_gender"]
          groups_count?: number | null
          home_tenant_id?: string | null
          id?: string
          max_participants?: number
          modality?: Database["public"]["Enums"]["tournament_modality"]
          motor?: Database["public"]["Enums"]["competition_motor"]
          name?: string
          operational_rules?: Json
          preset_key?: string | null
          prize_allocation?: Json
          qualifiers_per_group?: number
          roster_locked_at?: string | null
          scheduling?: string
          seeding_method?: Database["public"]["Enums"]["seeding_method"]
          sort_order?: number
          sport?: Database["public"]["Enums"]["tournament_sport"]
          status?: Database["public"]["Enums"]["tournament_status"]
          surface?: Database["public"]["Enums"]["court_surface"]
          tenant_id?: string
          tiebreaker_weights?: Json
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_categories_home_tenant_id_fkey"
            columns: ["home_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_cobrand: {
        Row: {
          accent_hex: string | null
          brand_key: string
          created_at: string
          display_name: string
          eyebrow_text: string | null
          flag_country: string | null
          gradient_css: string | null
          lockup_text: string | null
          logo_url: string | null
          primary_hex: string | null
          rights_text: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          accent_hex?: string | null
          brand_key: string
          created_at?: string
          display_name: string
          eyebrow_text?: string | null
          flag_country?: string | null
          gradient_css?: string | null
          lockup_text?: string | null
          logo_url?: string | null
          primary_hex?: string | null
          rights_text?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          accent_hex?: string | null
          brand_key?: string
          created_at?: string
          display_name?: string
          eyebrow_text?: string | null
          flag_country?: string | null
          gradient_css?: string | null
          lockup_text?: string | null
          logo_url?: string | null
          primary_hex?: string | null
          rights_text?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_cobrand_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_cobrand_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_courts: {
        Row: {
          court_id: string
          created_at: string
          id: string
          tenant_id: string
          tournament_id: string
        }
        Insert: {
          court_id: string
          created_at?: string
          id?: string
          tenant_id: string
          tournament_id: string
        }
        Update: {
          court_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_courts_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_courts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_courts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_courts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_events: {
        Row: {
          actor: string | null
          at: string
          id: string
          kind: string
          payload: Json
          tenant_id: string
          tournament_id: string
        }
        Insert: {
          actor?: string | null
          at?: string
          id?: string
          kind: string
          payload?: Json
          tenant_id: string
          tournament_id: string
        }
        Update: {
          actor?: string | null
          at?: string
          id?: string
          kind?: string
          payload?: Json
          tenant_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          tournament_category_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order: number
          tenant_id: string
          tournament_category_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          tournament_category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_groups_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_groups_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_finance"
            referencedColumns: ["category_id"]
          },
        ]
      }
      tournament_match_reschedule_requests: {
        Row: {
          created_at: string
          id: string
          match_id: string
          proposed_by: string
          proposed_court_id: string | null
          proposed_starts_at: string
          reject_reason: string | null
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["reschedule_request_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          proposed_by: string
          proposed_court_id?: string | null
          proposed_starts_at: string
          reject_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["reschedule_request_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          proposed_by?: string
          proposed_court_id?: string | null
          proposed_starts_at?: string
          reject_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["reschedule_request_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_match_reschedule_requests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_reschedule_requests_proposed_court_id_fkey"
            columns: ["proposed_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_reschedule_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_match_results: {
        Row: {
          created_at: string
          id: string
          match_id: string
          proposed_by: string
          reject_reason: string | null
          responded_at: string | null
          responded_by: string | null
          retired: boolean
          score: Json | null
          status: Database["public"]["Enums"]["match_result_proposal_status"]
          tenant_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          proposed_by: string
          reject_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          retired?: boolean
          score?: Json | null
          status?: Database["public"]["Enums"]["match_result_proposal_status"]
          tenant_id: string
          updated_at?: string
          walkover?: boolean
          winner_registration_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          proposed_by?: string
          reject_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          retired?: boolean
          score?: Json | null
          status?: Database["public"]["Enums"]["match_result_proposal_status"]
          tenant_id?: string
          updated_at?: string
          walkover?: boolean
          winner_registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_results_winner_registration_id_fkey"
            columns: ["winner_registration_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_match_review_flags: {
        Row: {
          created_at: string
          id: string
          reason: string
          tenant_id: string
          tournament_match_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          tenant_id: string
          tournament_match_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          tenant_id?: string
          tournament_match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_match_review_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_review_flags_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: true
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          acceptance_a: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at: string | null
          americano_round_id: string | null
          booking_id: string | null
          bracket: string
          bracket_position: number
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          court_id: string | null
          created_at: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          interrupted_at: string | null
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          next_match_id: string | null
          next_match_slot: string | null
          partial_score: Json | null
          phase: string | null
          played_at: string | null
          registration_a_id: string | null
          registration_b_id: string | null
          reported_at: string | null
          reported_by: string | null
          reschedule_used: boolean
          resume_deadline_at: string | null
          retired: boolean
          round: number
          scheduled_at: string | null
          score: Json | null
          side_a_user_ids: string[] | null
          side_b_user_ids: string[] | null
          status: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id: string | null
          tournament_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string | null
          winner_side: string | null
        }
        Insert: {
          acceptance_a?: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b?: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at?: string | null
          americano_round_id?: string | null
          booking_id?: string | null
          bracket?: string
          bracket_position: number
          confirmation_status?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          court_id?: string | null
          created_at?: string
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          id?: string
          interrupted_at?: string | null
          loser_next_match_id?: string | null
          loser_next_match_slot?: string | null
          next_match_id?: string | null
          next_match_slot?: string | null
          partial_score?: Json | null
          phase?: string | null
          played_at?: string | null
          registration_a_id?: string | null
          registration_b_id?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reschedule_used?: boolean
          resume_deadline_at?: string | null
          retired?: boolean
          round: number
          scheduled_at?: string | null
          score?: Json | null
          side_a_user_ids?: string[] | null
          side_b_user_ids?: string[] | null
          status?: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id?: string | null
          tournament_id: string
          updated_at?: string
          walkover?: boolean
          winner_registration_id?: string | null
          winner_side?: string | null
        }
        Update: {
          acceptance_a?: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b?: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at?: string | null
          americano_round_id?: string | null
          booking_id?: string | null
          bracket?: string
          bracket_position?: number
          confirmation_status?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          court_id?: string | null
          created_at?: string
          dispute_reason?: string | null
          disputed_at?: string | null
          disputed_by?: string | null
          id?: string
          interrupted_at?: string | null
          loser_next_match_id?: string | null
          loser_next_match_slot?: string | null
          next_match_id?: string | null
          next_match_slot?: string | null
          partial_score?: Json | null
          phase?: string | null
          played_at?: string | null
          registration_a_id?: string | null
          registration_b_id?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reschedule_used?: boolean
          resume_deadline_at?: string | null
          retired?: boolean
          round?: number
          scheduled_at?: string | null
          score?: Json | null
          side_a_user_ids?: string[] | null
          side_b_user_ids?: string[] | null
          status?: Database["public"]["Enums"]["match_status"]
          tenant_id?: string
          tournament_category_id?: string
          tournament_group_id?: string | null
          tournament_id?: string
          updated_at?: string
          walkover?: boolean
          winner_registration_id?: string | null
          winner_side?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_americano_round_id_fkey"
            columns: ["americano_round_id"]
            isOneToOne: false
            referencedRelation: "americano_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_finance"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "tournament_matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_loser_next_match_id_fkey"
            columns: ["loser_next_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_registration_a_id_fkey"
            columns: ["registration_a_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_registration_b_id_fkey"
            columns: ["registration_b_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_group_id_fkey"
            columns: ["tournament_group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_registration_id_fkey"
            columns: ["winner_registration_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_membership_offer: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          offer_label: string
          offer_terms_md: string | null
          offer_type: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          offer_label: string
          offer_terms_md?: string | null
          offer_type: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          offer_label?: string
          offer_terms_md?: string | null
          offer_type?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_membership_offer_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_membership_offer_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_operators: {
        Row: {
          granted_at: string
          granted_by: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          tournament_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_operators_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_operators_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_phases: {
        Row: {
          created_at: string
          daily_window_end: string
          daily_window_start: string
          ends_on: string
          id: string
          name: string
          round: number
          starts_on: string
          tenant_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_window_end?: string
          daily_window_start?: string
          ends_on: string
          id?: string
          name: string
          round: number
          starts_on: string
          tenant_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_window_end?: string
          daily_window_start?: string
          ends_on?: string
          id?: string
          name?: string
          round?: number
          starts_on?: string
          tenant_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_phases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_phases_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_phases_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          confirmed_at: string | null
          consecutive_wins: number
          created_at: string
          fee_amount_clp: number | null
          fee_method: string | null
          fee_paid_at: string | null
          id: string
          notes: string | null
          player1_user_id: string
          player2_user_id: string | null
          registered_at: string
          rules_accepted_at: string | null
          rules_version_accepted: number | null
          seed: number | null
          session_availability: string[]
          status: Database["public"]["Enums"]["registration_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_id: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          consecutive_wins?: number
          created_at?: string
          fee_amount_clp?: number | null
          fee_method?: string | null
          fee_paid_at?: string | null
          id?: string
          notes?: string | null
          player1_user_id: string
          player2_user_id?: string | null
          registered_at?: string
          rules_accepted_at?: string | null
          rules_version_accepted?: number | null
          seed?: number | null
          session_availability?: string[]
          status?: Database["public"]["Enums"]["registration_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_id: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          consecutive_wins?: number
          created_at?: string
          fee_amount_clp?: number | null
          fee_method?: string | null
          fee_paid_at?: string | null
          id?: string
          notes?: string | null
          player1_user_id?: string
          player2_user_id?: string | null
          registered_at?: string
          rules_accepted_at?: string | null
          rules_version_accepted?: number | null
          seed?: number | null
          session_availability?: string[]
          status?: Database["public"]["Enums"]["registration_status"]
          tenant_id?: string
          tournament_category_id?: string
          tournament_id?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_finance"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "tournament_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rules: {
        Row: {
          created_at: string
          created_by: string | null
          descriptive_md: string | null
          format_table_json: Json | null
          id: string
          image_rights_md: string | null
          is_current: boolean
          key_rules_md: string | null
          operator_guide_md: string | null
          player_guide_md: string | null
          tiebreak_rules_md: string | null
          tournament_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descriptive_md?: string | null
          format_table_json?: Json | null
          id?: string
          image_rights_md?: string | null
          is_current?: boolean
          key_rules_md?: string | null
          operator_guide_md?: string | null
          player_guide_md?: string | null
          tiebreak_rules_md?: string | null
          tournament_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descriptive_md?: string | null
          format_table_json?: Json | null
          id?: string
          image_rights_md?: string | null
          is_current?: boolean
          key_rules_md?: string | null
          operator_guide_md?: string | null
          player_guide_md?: string | null
          tiebreak_rules_md?: string | null
          tournament_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_sessions: {
        Row: {
          block_label: string
          court_ids: string[]
          created_at: string
          created_by: string
          ends_at: string
          id: string
          name: string
          starts_at: string
          status: string
          tenant_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          block_label?: string
          court_ids?: string[]
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          name: string
          starts_at: string
          status?: string
          tenant_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          block_label?: string
          court_ids?: string[]
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
          status?: string
          tenant_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_sessions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_sessions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_stream_featured: {
        Row: {
          match_id: string | null
          set_at: string
          set_by: string | null
          tournament_id: string
        }
        Insert: {
          match_id?: string | null
          set_at?: string
          set_by?: string | null
          tournament_id: string
        }
        Update: {
          match_id?: string | null
          set_at?: string
          set_by?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_stream_featured_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_stream_featured_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_stream_featured_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          auto_confirm_after_minutes: number
          closed_at: string | null
          closing_summary: Json | null
          created_at: string
          created_by: string | null
          default_config: Json
          description: string | null
          ends_at: string
          entry_fee_clp: number
          id: string
          is_public_stream_enabled: boolean
          name: string
          registration_closes_at: string
          registration_opens_at: string
          reschedule_enabled: boolean
          reschedule_min_notice_hours: number
          reschedule_window_hours: number
          result_validation_mode: Database["public"]["Enums"]["result_validation_mode"]
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["tournament_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_confirm_after_minutes?: number
          closed_at?: string | null
          closing_summary?: Json | null
          created_at?: string
          created_by?: string | null
          default_config?: Json
          description?: string | null
          ends_at: string
          entry_fee_clp?: number
          id?: string
          is_public_stream_enabled?: boolean
          name: string
          registration_closes_at: string
          registration_opens_at: string
          reschedule_enabled?: boolean
          reschedule_min_notice_hours?: number
          reschedule_window_hours?: number
          result_validation_mode?: Database["public"]["Enums"]["result_validation_mode"]
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["tournament_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_confirm_after_minutes?: number
          closed_at?: string | null
          closing_summary?: Json | null
          created_at?: string
          created_by?: string | null
          default_config?: Json
          description?: string | null
          ends_at?: string
          entry_fee_clp?: number
          id?: string
          is_public_stream_enabled?: boolean
          name?: string
          registration_closes_at?: string
          registration_opens_at?: string
          reschedule_enabled?: boolean
          reschedule_min_notice_hours?: number
          reschedule_window_hours?: number
          result_validation_mode?: Database["public"]["Enums"]["result_validation_mode"]
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_availability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          starts_at: string
          tenant_id: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          starts_at: string
          tenant_id: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          context: Json | null
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          context?: Json | null
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          context?: Json | null
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_challenge_at: string | null
          last_week_start: string | null
          longest_streak: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_challenge_at?: string | null
          last_week_start?: string | null
          longest_streak?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_challenge_at?: string | null
          last_week_start?: string | null
          longest_streak?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_streaks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          ref_id: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          ref_id?: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          ref_id?: string | null
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_push_preferences: {
        Row: {
          juego: boolean
          marketing: boolean
          sistema: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          juego?: boolean
          marketing?: boolean
          sistema?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          juego?: boolean
          marketing?: boolean
          sistema?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      americano_individual_standings: {
        Row: {
          games_lost: number | null
          games_won: number | null
          matches_played: number | null
          matches_won: number | null
          tournament_category_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      organizer_history: {
        Row: {
          closed_at: string | null
          closing_summary: Json | null
          ends_at: string | null
          matches_played: number | null
          name: string | null
          organizer_user_id: string | null
          participants_count: number | null
          slug: string | null
          sports: string[] | null
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"] | null
          tenant_id: string | null
          tournament_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closing_summary?: Json | null
          ends_at?: string | null
          matches_played?: never
          name?: string | null
          organizer_user_id?: string | null
          participants_count?: never
          slug?: string | null
          sports?: never
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          tenant_id?: string | null
          tournament_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closing_summary?: Json | null
          ends_at?: string | null
          matches_played?: never
          name?: string | null
          organizer_user_id?: string | null
          participants_count?: never
          slug?: string | null
          sports?: never
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          tenant_id?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_reputation: {
        Row: {
          confirmed_both_sides_pct: number | null
          first_tournament_at: string | null
          organizer_user_id: string | null
          tournaments_closed: number | null
          tournaments_total: number | null
          verified_matches: number | null
        }
        Relationships: []
      }
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      profiles_directory: {
        Row: {
          availability: string | null
          avatar_url: string | null
          backhand: string | null
          bio: string | null
          club_ranking: number | null
          created_at: string | null
          dominant_hand: string | null
          email: string | null
          favorite_shot: string | null
          favorite_surface: Database["public"]["Enums"]["court_surface"] | null
          first_name: string | null
          id: string | null
          last_name: string | null
          member_since: string | null
          ntrp_level: number | null
          phone: string | null
          playing_style: string | null
          show_email: boolean | null
          show_phone: boolean | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
          years_playing: number | null
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          backhand?: string | null
          bio?: string | null
          club_ranking?: number | null
          created_at?: string | null
          dominant_hand?: string | null
          email?: never
          favorite_shot?: string | null
          favorite_surface?: Database["public"]["Enums"]["court_surface"] | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          member_since?: string | null
          ntrp_level?: number | null
          phone?: never
          playing_style?: string | null
          show_email?: boolean | null
          show_phone?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_playing?: number | null
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          backhand?: string | null
          bio?: string | null
          club_ranking?: number | null
          created_at?: string | null
          dominant_hand?: string | null
          email?: never
          favorite_shot?: string | null
          favorite_surface?: Database["public"]["Enums"]["court_surface"] | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          member_since?: string | null
          ntrp_level?: number | null
          phone?: never
          playing_style?: string | null
          show_email?: boolean | null
          show_phone?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          years_playing?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      round_robin_group_standings: {
        Row: {
          category_id: string | null
          games_won: number | null
          group_id: string | null
          matches_played: number | null
          matches_won: number | null
          position: number | null
          registration_id: string | null
          sets_won: number | null
          stb_games_won: number | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_finance"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tournament_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      round_robin_standings: {
        Row: {
          category_id: string | null
          games_lost: number | null
          games_won: number | null
          matches_lost: number | null
          matches_played: number | null
          matches_won: number | null
          position: number | null
          registration_id: string | null
          sets_lost: number | null
          sets_won: number | null
          stb_games_won: number | null
          total_points: number | null
          tournament_category_id: string | null
          tournament_group_id: string | null
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
      tournament_finance: {
        Row: {
          category_id: string | null
          collected_clp: number | null
          entry_fee_clp: number | null
          expected_clp: number | null
          paid_count: number | null
          tenant_id: string | null
          total_count: number | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "organizer_history"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _analytics_guard: { Args: never; Returns: string }
      _apply_ladder_result: {
        Args: { _challenge_id: string }
        Returns: undefined
      }
      _apply_match_result: {
        Args: {
          _match_id: string
          _retired: boolean
          _score: Json
          _walkover: boolean
          _winner_registration_id: string
        }
        Returns: {
          acceptance_a: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at: string | null
          americano_round_id: string | null
          booking_id: string | null
          bracket: string
          bracket_position: number
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          court_id: string | null
          created_at: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          interrupted_at: string | null
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          next_match_id: string | null
          next_match_slot: string | null
          partial_score: Json | null
          phase: string | null
          played_at: string | null
          registration_a_id: string | null
          registration_b_id: string | null
          reported_at: string | null
          reported_by: string | null
          reschedule_used: boolean
          resume_deadline_at: string | null
          retired: boolean
          round: number
          scheduled_at: string | null
          score: Json | null
          side_a_user_ids: string[] | null
          side_b_user_ids: string[] | null
          status: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id: string | null
          tournament_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _apply_partner_match_rating: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      _apply_rating_for_match: {
        Args: {
          _loser_users: string[]
          _notes?: string
          _source: Database["public"]["Enums"]["rating_change_source"]
          _source_ref_id: string
          _sport: Database["public"]["Enums"]["rating_sport"]
          _winner_users: string[]
        }
        Returns: undefined
      }
      _bootstrap_vault_has_cron_secret: { Args: never; Returns: boolean }
      _bootstrap_vault_secret_upsert: {
        Args: { _name: string; _secret: string }
        Returns: string
      }
      _cleanup: { Args: never; Returns: boolean }
      _compute_match_winner: {
        Args: { _profile: Json; _score: Json }
        Returns: string
      }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _demo_admin_uid: { Args: never; Returns: string }
      _demo_impersonate: { Args: { _uid: string }; Returns: undefined }
      _demo_make_user: {
        Args: { _email: string; _first: string; _last: string }
        Returns: string
      }
      _demo_random_score: { Args: { _motor: string }; Returns: Json }
      _demo_seed_padel_grupos_playoff: {
        Args: { _label: string; _state: string }
        Returns: string
      }
      _demo_seed_tournament: {
        Args: {
          _label: string
          _motor: string
          _organizer_email?: string
          _participants?: number
          _scheduling?: string
          _state?: string
        }
        Returns: string
      }
      _demo_tenant_id: { Args: never; Returns: string }
      _demo_user_uid: { Args: { _email: string }; Returns: string }
      _e2e_create_propuesto_challenge: {
        Args: {
          _challenged_position: number
          _challenged_user_id: string
          _challenger_position: number
          _challenger_user_id: string
          _expires_at: string
          _ladder_id: string
          _slot1_starts_at?: string
          _tenant_id: string
        }
        Returns: string
      }
      _e2e_lookup_users_by_email: {
        Args: { emails: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      _e2e_reset_padel_ladder: { Args: never; Returns: undefined }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _qa_admin_uid: { Args: never; Returns: string }
      _qa_build_bracket: {
        Args: { _bracket?: string; _cat: string; _seeds: string[] }
        Returns: number
      }
      _qa_build_round_robin: { Args: { _cat: string }; Returns: number }
      _qa_call_gen: { Args: { _cat: string; _seeds: string[] }; Returns: Json }
      _qa_diag_matches: { Args: { _cat: string }; Returns: Json }
      _qa_exec: { Args: { _sql: string }; Returns: undefined }
      _qa_impersonate: { Args: { _uid: string }; Returns: undefined }
      _qa_make_user: {
        Args: { _display: string; _email: string; _is_admin?: boolean }
        Returns: string
      }
      _qa_random_score: { Args: { _motor: string }; Returns: Json }
      _qa_tenant_id: { Args: never; Returns: string }
      _qa_test_insert: { Args: { _cat: string }; Returns: Json }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      _tournament_category_podium: {
        Args: { _category_id: string }
        Returns: Json
      }
      accept_doubles_invitation: {
        Args: { _registration_id: string }
        Returns: {
          confirmed_at: string | null
          consecutive_wins: number
          created_at: string
          fee_amount_clp: number | null
          fee_method: string | null
          fee_paid_at: string | null
          id: string
          notes: string | null
          player1_user_id: string
          player2_user_id: string | null
          registered_at: string
          rules_accepted_at: string | null
          rules_version_accepted: number | null
          seed: number | null
          session_availability: string[]
          status: Database["public"]["Enums"]["registration_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_id: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_tournament_match: {
        Args: { _match_id: string }
        Returns: {
          acceptance_a: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at: string | null
          americano_round_id: string | null
          booking_id: string | null
          bracket: string
          bracket_position: number
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          court_id: string | null
          created_at: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          interrupted_at: string | null
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          next_match_id: string | null
          next_match_slot: string | null
          partial_score: Json | null
          phase: string | null
          played_at: string | null
          registration_a_id: string | null
          registration_b_id: string | null
          reported_at: string | null
          reported_by: string | null
          reschedule_used: boolean
          resume_deadline_at: string | null
          retired: boolean
          round: number
          scheduled_at: string | null
          score: Json | null
          side_a_user_ids: string[] | null
          side_b_user_ids: string[] | null
          status: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id: string | null
          tournament_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      activate_trial_membership: {
        Args: { _phone?: string; _tournament_id: string }
        Returns: Json
      }
      advance_groups_to_playoff: {
        Args: { _category_id: string }
        Returns: Json
      }
      analytics_alerts: {
        Args: never
        Returns: {
          action_url: string
          body: string
          kind: string
          metric_value: number
          severity: string
          title: string
        }[]
      }
      analytics_coaches_performance: {
        Args: { p_from: string; p_sport?: string; p_to: string }
        Returns: Json
      }
      analytics_community_stats: {
        Args: { p_from: string; p_sport?: string; p_to: string }
        Returns: Json
      }
      analytics_directory_digest: {
        Args: { p_month: string; p_sport?: string }
        Returns: Json
      }
      analytics_finance_summary: {
        Args: { p_from: string; p_sport?: string; p_to: string }
        Returns: Json
      }
      analytics_members_engagement: {
        Args: { p_from: string; p_sport?: string; p_to: string }
        Returns: Json
      }
      analytics_occupancy_heatmap: {
        Args: { p_from: string; p_sport?: string; p_to: string }
        Returns: {
          court_id: string
          court_name: string
          hour: number
          occupied_count: number
          weekday: number
        }[]
      }
      analytics_overview: {
        Args: { p_from: string; p_sport?: string; p_to: string }
        Returns: Json
      }
      auto_confirm_pending_results: { Args: never; Returns: number }
      block_tournament_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      can_create_tournament: { Args: { _tenant_id: string }; Returns: boolean }
      cancel_booking: {
        Args: { _booking_id: string }
        Returns: {
          block_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          court_id: string
          created_at: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          notes: string | null
          partner_user_id: string | null
          period: unknown
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_coach_class: {
        Args: { _class_id: string; _reason?: string }
        Returns: undefined
      }
      cancel_open_match: { Args: { _post_id: string }; Returns: Json }
      cancel_partner_match: {
        Args: { _invitation_id: string; _reason?: string }
        Returns: {
          booking_id: string | null
          compat_score: number | null
          created_at: string
          expires_at: string
          id: string
          invitee_user_id: string
          inviter_user_id: string
          message: string | null
          proposed_slots: Json
          responded_at: string | null
          selected_slot: Json | null
          status: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "match_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_americano: { Args: { _category_id: string }; Returns: undefined }
      close_by_deadline: { Args: { _category_id: string }; Returns: Json }
      close_tournament: { Args: { _tournament_id: string }; Returns: Json }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      complete_coach_class: { Args: { _class_id: string }; Returns: undefined }
      complete_rating_onboarding: {
        Args: {
          _initial_level: number
          _initial_reliability?: number
          _sport: Database["public"]["Enums"]["rating_sport"]
        }
        Returns: {
          competitive_matches: number
          created_at: string
          id: string
          initial_level: number | null
          last_change_delta: number
          last_match_at: string | null
          level: number
          matches_played: number
          onboarding_completed_at: string | null
          reliability: number
          sport: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "player_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_match_of_the_week: {
        Args: { _tenant_id: string }
        Returns: {
          computed_at: string
          highlight_label: string | null
          id: string
          kind: string
          level_a: number | null
          level_b: number | null
          level_diff: number | null
          played_at: string
          player_a_id: string
          player_b_id: string
          score: Json | null
          source_id: string
          source_table: string
          tenant_id: string
          week_start: string
          winner_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "match_of_the_week"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      compute_partner_compatibility: {
        Args: { _me: string; _them: string }
        Returns: number
      }
      compute_partner_fit_breakdown: {
        Args: {
          _me: string
          _sport?: Database["public"]["Enums"]["rating_sport"]
          _them: string
        }
        Returns: Json
      }
      compute_suggested_matchup: {
        Args: { _tenant_id: string }
        Returns: {
          computed_at: string
          id: string
          level_a: number | null
          level_b: number | null
          level_diff: number | null
          player_a_id: string
          player_b_id: string
          reason: string | null
          score: number
          tenant_id: string
          week_start: string
        }
        SetofOptions: {
          from: "*"
          to: "suggested_matchup_of_the_week"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_coach_class: { Args: { _class_id: string }; Returns: undefined }
      confirm_ladder_challenge_slot:
        | {
            Args: { _proposal_id: string; _slot_index: number }
            Returns: {
              booking_id: string | null
              cancel_reason: string | null
              challenged_partner_user_id: string | null
              challenged_position: number | null
              challenged_user_id: string
              challenger_partner_user_id: string | null
              challenger_position: number | null
              challenger_user_id: string
              court_id: string | null
              created_at: string
              expires_at: string
              id: string
              ladder_id: string | null
              loser_user_id: string | null
              played_at: string | null
              proposed_at: string
              reject_reason: string | null
              responded_at: string | null
              result_confirmed_at: string | null
              result_proposed_at: string | null
              result_proposed_by: string | null
              retired: boolean
              scheduled_at: string | null
              score: Json | null
              status: Database["public"]["Enums"]["ladder_challenge_status"]
              tenant_id: string
              tournament_category_id: string | null
              tournament_match_id: string | null
              updated_at: string
              walkover: boolean
              winner_user_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "ladder_challenges"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _challenged_partner_user_id?: string
              _proposal_id: string
              _slot_index: number
            }
            Returns: {
              booking_id: string | null
              cancel_reason: string | null
              challenged_partner_user_id: string | null
              challenged_position: number | null
              challenged_user_id: string
              challenger_partner_user_id: string | null
              challenger_position: number | null
              challenger_user_id: string
              court_id: string | null
              created_at: string
              expires_at: string
              id: string
              ladder_id: string | null
              loser_user_id: string | null
              played_at: string | null
              proposed_at: string
              reject_reason: string | null
              responded_at: string | null
              result_confirmed_at: string | null
              result_proposed_at: string | null
              result_proposed_by: string | null
              retired: boolean
              scheduled_at: string | null
              score: Json | null
              status: Database["public"]["Enums"]["ladder_challenge_status"]
              tenant_id: string
              tournament_category_id: string | null
              tournament_match_id: string | null
              updated_at: string
              walkover: boolean
              winner_user_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "ladder_challenges"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      confirm_ladder_result: { Args: { _challenge_id: string }; Returns: Json }
      confirm_match_result: {
        Args: { _proposal_id: string }
        Returns: {
          acceptance_a: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at: string | null
          americano_round_id: string | null
          booking_id: string | null
          bracket: string
          bracket_position: number
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          court_id: string | null
          created_at: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          interrupted_at: string | null
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          next_match_id: string | null
          next_match_slot: string | null
          partial_score: Json | null
          phase: string | null
          played_at: string | null
          registration_a_id: string | null
          registration_b_id: string | null
          reported_at: string | null
          reported_by: string | null
          reschedule_used: boolean
          resume_deadline_at: string | null
          retired: boolean
          round: number
          scheduled_at: string | null
          score: Json | null
          side_a_user_ids: string[] | null
          side_b_user_ids: string[] | null
          status: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id: string | null
          tournament_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_partner_match_result: {
        Args: { _invitation_id: string }
        Returns: Json
      }
      correct_match_result: {
        Args: {
          _new_score: Json
          _new_winner_registration_id: string
          _tournament_match_id: string
        }
        Returns: string
      }
      create_booking: {
        Args: {
          _court_id: string
          _duration_minutes?: number
          _notes?: string
          _partner_user_id: string
          _starts_at: string
        }
        Returns: {
          block_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          court_id: string
          created_at: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          notes: string | null
          partner_user_id: string | null
          period: unknown
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_coach_class: {
        Args: {
          _coach_id: string
          _court_id: string
          _duration_minutes: number
          _external_student_name?: string
          _external_student_phone?: string
          _kind: Database["public"]["Enums"]["coach_class_kind"]
          _notes?: string
          _starts_at: string
          _student1_user_id?: string
          _student2_user_id?: string
        }
        Returns: string
      }
      create_ladder_challenge: {
        Args: { _challenged_user_id: string; _ladder_id: string }
        Returns: {
          booking_id: string | null
          cancel_reason: string | null
          challenged_partner_user_id: string | null
          challenged_position: number | null
          challenged_user_id: string
          challenger_partner_user_id: string | null
          challenger_position: number | null
          challenger_user_id: string
          court_id: string | null
          created_at: string
          expires_at: string
          id: string
          ladder_id: string | null
          loser_user_id: string | null
          played_at: string | null
          proposed_at: string
          reject_reason: string | null
          responded_at: string | null
          result_confirmed_at: string | null
          result_proposed_at: string | null
          result_proposed_by: string | null
          retired: boolean
          scheduled_at: string | null
          score: Json | null
          status: Database["public"]["Enums"]["ladder_challenge_status"]
          tenant_id: string
          tournament_category_id: string | null
          tournament_match_id: string | null
          updated_at: string
          walkover: boolean
          winner_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ladder_challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_ladder_challenge_with_slots:
        | {
            Args: {
              _challenged_user_id: string
              _ladder_id: string
              _slots: Json
            }
            Returns: {
              booking_id: string | null
              cancel_reason: string | null
              challenged_partner_user_id: string | null
              challenged_position: number | null
              challenged_user_id: string
              challenger_partner_user_id: string | null
              challenger_position: number | null
              challenger_user_id: string
              court_id: string | null
              created_at: string
              expires_at: string
              id: string
              ladder_id: string | null
              loser_user_id: string | null
              played_at: string | null
              proposed_at: string
              reject_reason: string | null
              responded_at: string | null
              result_confirmed_at: string | null
              result_proposed_at: string | null
              result_proposed_by: string | null
              retired: boolean
              scheduled_at: string | null
              score: Json | null
              status: Database["public"]["Enums"]["ladder_challenge_status"]
              tenant_id: string
              tournament_category_id: string | null
              tournament_match_id: string | null
              updated_at: string
              walkover: boolean
              winner_user_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "ladder_challenges"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _challenged_user_id: string
              _challenger_partner_user_id?: string
              _ladder_id: string
              _slots: Json
            }
            Returns: {
              booking_id: string | null
              cancel_reason: string | null
              challenged_partner_user_id: string | null
              challenged_position: number | null
              challenged_user_id: string
              challenger_partner_user_id: string | null
              challenger_position: number | null
              challenger_user_id: string
              court_id: string | null
              created_at: string
              expires_at: string
              id: string
              ladder_id: string | null
              loser_user_id: string | null
              played_at: string | null
              proposed_at: string
              reject_reason: string | null
              responded_at: string | null
              result_confirmed_at: string | null
              result_proposed_at: string | null
              result_proposed_by: string | null
              retired: boolean
              scheduled_at: string | null
              score: Json | null
              status: Database["public"]["Enums"]["ladder_challenge_status"]
              tenant_id: string
              tournament_category_id: string | null
              tournament_match_id: string | null
              updated_at: string
              walkover: boolean
              winner_user_id: string | null
            }
            SetofOptions: {
              from: "*"
              to: "ladder_challenges"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      create_match_invitation: {
        Args: { _invitee_user_id: string; _message?: string; _slots: Json }
        Returns: {
          booking_id: string | null
          compat_score: number | null
          created_at: string
          expires_at: string
          id: string
          invitee_user_id: string
          inviter_user_id: string
          message: string | null
          proposed_slots: Json
          responded_at: string | null
          selected_slot: Json | null
          status: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "match_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_match_open_post: {
        Args: {
          _available_slots: Json
          _format: Database["public"]["Enums"]["partner_match_format"]
          _note?: string
        }
        Returns: {
          available_slots: Json
          court_id: string | null
          created_at: string
          expires_at: string
          format: Database["public"]["Enums"]["partner_match_format"]
          gender_filter: Database["public"]["Enums"]["open_match_gender_filter"]
          id: string
          level_max: number | null
          level_min: number | null
          match_type: Database["public"]["Enums"]["open_match_type"]
          mode: Database["public"]["Enums"]["open_match_mode"]
          note: string | null
          partner_user_id: string | null
          slots_total: number
          sport: string
          status: Database["public"]["Enums"]["partner_post_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "match_open_posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_tournament_challenge: {
        Args: {
          _category_id: string
          _challenged_user_id: string
          _challenger_partner_user_id?: string
          _slots: Json
        }
        Returns: {
          booking_id: string | null
          cancel_reason: string | null
          challenged_partner_user_id: string | null
          challenged_position: number | null
          challenged_user_id: string
          challenger_partner_user_id: string | null
          challenger_position: number | null
          challenger_user_id: string
          court_id: string | null
          created_at: string
          expires_at: string
          id: string
          ladder_id: string | null
          loser_user_id: string | null
          played_at: string | null
          proposed_at: string
          reject_reason: string | null
          responded_at: string | null
          result_confirmed_at: string | null
          result_proposed_at: string | null
          result_proposed_by: string | null
          retired: boolean
          scheduled_at: string | null
          score: Json | null
          status: Database["public"]["Enums"]["ladder_challenge_status"]
          tenant_id: string
          tournament_category_id: string | null
          tournament_match_id: string | null
          updated_at: string
          walkover: boolean
          winner_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ladder_challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      demo_protocol_seed: { Args: never; Returns: Json }
      demo_protocol_status: { Args: never; Returns: Json }
      demo_protocol_wipe: { Args: { _wipe_bots?: boolean }; Returns: Json }
      demo_seed_courts: { Args: never; Returns: undefined }
      demo_seed_padel_americano_protocolo: { Args: never; Returns: Json }
      demo_seed_players: { Args: { _n?: number }; Returns: number }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      emit_match_observation: {
        Args: { _tournament_match_id: string }
        Returns: string
      }
      enqueue_partner_match_reminders: { Args: never; Returns: Json }
      enqueue_user_notification: {
        Args: {
          _body: string
          _category: string
          _kind: string
          _link: string
          _ref_id: string
          _tenant_id: string
          _title: string
          _tournament_id?: string
          _user_id: string
        }
        Returns: string
      }
      evaluate_dominant_rule: {
        Args: { _rules: Json; _score: Json }
        Returns: Json
      }
      expire_match_invitations: { Args: never; Returns: number }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      find_free_court_for_slot: {
        Args: {
          _duration_minutes?: number
          _starts_at: string
          _surface: Database["public"]["Enums"]["court_surface"]
          _tenant_id: string
        }
        Returns: string
      }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      flag_dependent_matches_for_review: {
        Args: { _corrected_match_id: string }
        Returns: number
      }
      format_score_summary: { Args: { _score: Json }; Returns: string }
      format_type_string: { Args: { "": string }; Returns: string }
      generate_americano_round:
        | {
            Args: { _category_id: string; _round_number: number }
            Returns: string
          }
        | {
            Args: {
              _category_id: string
              _round_number: number
              _session_id?: string
            }
            Returns: string
          }
      generate_bracket: {
        Args: { _category_id: string; _seed_order?: string[] }
        Returns: number
      }
      generate_consolation: {
        Args: { _category_id: string; _seed_order?: string[] }
        Returns: number
      }
      generate_double_elimination: {
        Args: { _category_id: string; _seed_order?: string[] }
        Returns: number
      }
      generate_groups: {
        Args: {
          _category_id: string
          _groups_count: number
          _seed_order?: string[]
        }
        Returns: Json
      }
      generate_round_robin: { Args: { _category_id: string }; Returns: number }
      get_active_share_moment: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: Json
      }
      get_booking_sensitive: {
        Args: { _booking_id: string }
        Returns: {
          cancelled_at: string
          cancelled_by: string
          id: string
          notes: string
          partner_user_id: string
        }[]
      }
      get_challengeable_players: {
        Args: { _ladder_id: string }
        Returns: {
          avatar_url: string
          cooldown_blocked: boolean
          first_name: string
          last_name: string
          last_played_at: string
          level: number
          level_diff: number
          pos: number
          rematch: boolean
          schedule_match: boolean
          score: number
          user_id: string
        }[]
      }
      get_club_ranking: {
        Args: { _sport: Database["public"]["Enums"]["rating_sport"] }
        Returns: {
          avatar_url: string
          category: string
          first_name: string
          last_match_at: string
          last_name: string
          level: number
          matches_played: number
          prev_rank_position: number
          rank_position: number
          reliability: number
          streak: number
          user_id: string
        }[]
      }
      get_coach_class_external_contact: {
        Args: { _booking_id: string }
        Returns: {
          external_student_name: string
          external_student_phone: string
        }[]
      }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          last_name: string
          tenant_id: string
          tenant_name: string
          tenant_short_name: string
        }[]
      }
      get_my_primary_rating: {
        Args: never
        Returns: {
          competitive_matches: number
          created_at: string
          id: string
          initial_level: number | null
          last_change_delta: number
          last_match_at: string | null
          level: number
          matches_played: number
          onboarding_completed_at: string | null
          reliability: number
          sport: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "player_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_rating_with_category: {
        Args: never
        Returns: {
          category: string
          rating: Database["public"]["Tables"]["player_ratings"]["Row"]
        }[]
      }
      get_partner_suggestions: {
        Args: {
          _limit?: number
          _sport?: Database["public"]["Enums"]["rating_sport"]
        }
        Returns: {
          avatar_url: string
          breakdown: Json
          compat_score: number
          first_name: string
          last_name: string
          level: number
          level_diff: number
          reasons: string[]
          user_id: string
        }[]
      }
      get_player_category: {
        Args: { _level: number; _tenant_id: string }
        Returns: string
      }
      get_player_streak: {
        Args: {
          _sport: Database["public"]["Enums"]["rating_sport"]
          _user_id: string
        }
        Returns: number
      }
      get_public_stream_now_playing: { Args: { _slug: string }; Returns: Json }
      get_public_stream_standings: {
        Args: { _limit?: number; _slug: string }
        Returns: Json
      }
      get_public_stream_tournament: { Args: { _slug: string }; Returns: Json }
      get_recent_partners: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          first_name: string
          last_name: string
          last_played_at: string
          source: string
          user_id: string
        }[]
      }
      get_round_robin_opponents: {
        Args: { _category_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          has_open_challenge: boolean
          registration_id: string
          tournament_match_id: string
          user_id: string
        }[]
      }
      get_share_card_stats: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: Json
      }
      get_share_standings: {
        Args: { _category_id?: string; _limit?: number; _tournament_id: string }
        Returns: Json
      }
      get_tournament_membership_offer: {
        Args: { _tournament_id: string }
        Returns: Json
      }
      get_tournament_phase_slots: {
        Args: { _round: number; _tournament_id: string }
        Returns: {
          court_id: string
          court_name: string
          ends_at: string
          starts_at: string
        }[]
      }
      get_tournament_reschedule_slots: {
        Args: { _match_id: string }
        Returns: {
          court_id: string
          court_name: string
          ends_at: string
          starts_at: string
        }[]
      }
      grant_organizer_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: undefined
      }
      has_completed_rating_onboarding: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_unique: { Args: { "": string }; Returns: string }
      home_pending_actions: {
        Args: never
        Returns: {
          doubles_invitations: number
          ladder_challenges_received: number
          ladder_results_to_confirm: number
          partner_results_to_confirm: number
          partner_results_to_load: number
          reschedule_requests: number
          results_to_load: number
          total: number
          tournament_results_to_confirm: number
        }[]
      }
      in_todo: { Args: never; Returns: boolean }
      is_club_admin_of: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_empty: { Args: { "": string }; Returns: string }
      is_ladder_challenge_party: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: boolean
      }
      is_match_player: {
        Args: { _match_id: string; _user_id: string }
        Returns: boolean
      }
      is_match_side_a: {
        Args: { _match_id: string; _user_id: string }
        Returns: boolean
      }
      is_match_side_b: {
        Args: { _match_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tournament_admin: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      is_tournament_manager: {
        Args: { _tournament_id: string }
        Returns: boolean
      }
      is_tournament_operator: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      isnt_empty: { Args: { "": string }; Returns: string }
      join_ladder: {
        Args: { _ladder_id: string }
        Returns: {
          created_at: string
          id: string
          joined_at: string
          ladder_id: string
          last_challenged_at: string | null
          last_played_at: string | null
          losses: number
          position: number
          status: Database["public"]["Enums"]["ladder_position_status"]
          tenant_id: string
          updated_at: string
          user_id: string
          walkovers_against: number
          walkovers_for: number
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "ladder_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_open_match: {
        Args: {
          _partner_user_id?: string
          _post_id: string
          _slot_index?: number
        }
        Returns: Json
      }
      ladder_pending_counts: {
        Args: never
        Returns: {
          challenges_received: number
          expiring_soon: number
          results_to_confirm: number
          scheduled_matches: number
          total: number
        }[]
      }
      leave_ladder: { Args: { _ladder_id: string }; Returns: boolean }
      leave_open_match: { Args: { _post_id: string }; Returns: Json }
      lives_ok: { Args: { "": string }; Returns: string }
      lower_my_rating: {
        Args: {
          _new_level: number
          _reason?: string
          _sport: Database["public"]["Enums"]["rating_sport"]
        }
        Returns: {
          competitive_matches: number
          created_at: string
          id: string
          initial_level: number | null
          last_change_delta: number
          last_match_at: string | null
          level: number
          matches_played: number
          onboarding_completed_at: string | null
          reliability: number
          sport: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "player_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_class_paid: {
        Args: {
          _class_id: string
          _status?: Database["public"]["Enums"]["coach_payment_status"]
        }
        Returns: undefined
      }
      my_upcoming_bookings: {
        Args: { _limit?: number }
        Returns: {
          court_id: string
          court_name: string
          court_surface: Database["public"]["Enums"]["court_surface"]
          ends_at: string
          i_am_owner: boolean
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          other_first_name: string
          other_last_name: string
          partner_user_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          user_id: string
        }[]
      }
      no_plan: { Args: never; Returns: boolean[] }
      notifications_feed: {
        Args: never
        Returns: {
          created_at: string
          description: string
          kind: string
          link: string
          ref_id: string
          title: string
        }[]
      }
      num_failed: { Args: never; Returns: number }
      opponent_registration: {
        Args: { _match_id: string; _user_id: string }
        Returns: string
      }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      player_confirm_result: { Args: { _match_id: string }; Returns: string }
      player_dispute_result: {
        Args: { _match_id: string; _reason: string }
        Returns: string
      }
      process_ladder_expirations_run: { Args: never; Returns: Json }
      process_ladder_inactivity_run: { Args: never; Returns: Json }
      propose_ladder_challenge_slots: {
        Args: { _challenge_id: string; _slots: Json }
        Returns: {
          challenge_id: string
          created_at: string
          id: string
          proposed_at: string
          proposed_by: string
          selected_at: string | null
          selected_by: string | null
          selected_slot: number | null
          slot1_court_id: string
          slot1_starts_at: string
          slot2_court_id: string | null
          slot2_starts_at: string | null
          slot3_court_id: string | null
          slot3_starts_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ladder_challenge_schedule_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_tournament_rules: {
        Args: { _payload: Json; _tournament_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          descriptive_md: string | null
          format_table_json: Json | null
          id: string
          image_rights_md: string | null
          is_current: boolean
          key_rules_md: string | null
          operator_guide_md: string | null
          player_guide_md: string | null
          tiebreak_rules_md: string | null
          tournament_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "tournament_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      qa_reset: { Args: { _slug?: string }; Returns: undefined }
      qa_seed_all: { Args: never; Returns: undefined }
      qa_seed_clubs: { Args: never; Returns: undefined }
      qa_seed_players: { Args: { _n?: number }; Returns: undefined }
      qa_seed_tournament: {
        Args: {
          _motor: string
          _participants?: number
          _scheduling?: string
          _state?: string
        }
        Returns: string
      }
      recalculate_rating_after_match: {
        Args: {
          _k_multiplier?: number
          _notes?: string
          _opponent_level: number
          _source: Database["public"]["Enums"]["rating_change_source"]
          _source_ref_id?: string
          _sport: Database["public"]["Enums"]["rating_sport"]
          _user_id: string
          _won: boolean
        }
        Returns: {
          competitive_matches: number
          created_at: string
          id: string
          initial_level: number | null
          last_change_delta: number
          last_match_at: string | null
          level: number
          matches_played: number
          onboarding_completed_at: string | null
          reliability: number
          sport: Database["public"]["Enums"]["rating_sport"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "player_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      regenerate_americano_rounds: {
        Args: { _category_id: string; _from_round: number }
        Returns: Json
      }
      register_to_category:
        | {
            Args: { _category_id: string; _player2_user_id?: string }
            Returns: {
              confirmed_at: string | null
              consecutive_wins: number
              created_at: string
              fee_amount_clp: number | null
              fee_method: string | null
              fee_paid_at: string | null
              id: string
              notes: string | null
              player1_user_id: string
              player2_user_id: string | null
              registered_at: string
              rules_accepted_at: string | null
              rules_version_accepted: number | null
              seed: number | null
              session_availability: string[]
              status: Database["public"]["Enums"]["registration_status"]
              tenant_id: string
              tournament_category_id: string
              tournament_id: string
              updated_at: string
              withdrawn_at: string | null
            }
            SetofOptions: {
              from: "*"
              to: "tournament_registrations"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _category_id: string
              _player2_user_id?: string
              _session_availability?: string[]
            }
            Returns: {
              confirmed_at: string | null
              consecutive_wins: number
              created_at: string
              fee_amount_clp: number | null
              fee_method: string | null
              fee_paid_at: string | null
              id: string
              notes: string | null
              player1_user_id: string
              player2_user_id: string | null
              registered_at: string
              rules_accepted_at: string | null
              rules_version_accepted: number | null
              seed: number | null
              session_availability: string[]
              status: Database["public"]["Enums"]["registration_status"]
              tenant_id: string
              tournament_category_id: string
              tournament_id: string
              updated_at: string
              withdrawn_at: string | null
            }
            SetofOptions: {
              from: "*"
              to: "tournament_registrations"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      reject_doubles_invitation: {
        Args: { _registration_id: string }
        Returns: {
          confirmed_at: string | null
          consecutive_wins: number
          created_at: string
          fee_amount_clp: number | null
          fee_method: string | null
          fee_paid_at: string | null
          id: string
          notes: string | null
          player1_user_id: string
          player2_user_id: string | null
          registered_at: string
          rules_accepted_at: string | null
          rules_version_accepted: number | null
          seed: number | null
          session_availability: string[]
          status: Database["public"]["Enums"]["registration_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_id: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_ladder_result: {
        Args: { _challenge_id: string; _reason?: string }
        Returns: Json
      }
      reject_match_result: {
        Args: { _proposal_id: string; _reason?: string }
        Returns: {
          created_at: string
          id: string
          match_id: string
          proposed_by: string
          reject_reason: string | null
          responded_at: string | null
          responded_by: string | null
          retired: boolean
          score: Json | null
          status: Database["public"]["Enums"]["match_result_proposal_status"]
          tenant_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tournament_match_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_partner_match_result: {
        Args: { _invitation_id: string; _reason?: string }
        Returns: Json
      }
      reject_tournament_match: {
        Args: { _match_id: string; _reason?: string }
        Returns: {
          acceptance_a: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at: string | null
          americano_round_id: string | null
          booking_id: string | null
          bracket: string
          bracket_position: number
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          court_id: string | null
          created_at: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          interrupted_at: string | null
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          next_match_id: string | null
          next_match_slot: string | null
          partial_score: Json | null
          phase: string | null
          played_at: string | null
          registration_a_id: string | null
          registration_b_id: string | null
          reported_at: string | null
          reported_by: string | null
          reschedule_used: boolean
          resume_deadline_at: string | null
          retired: boolean
          round: number
          scheduled_at: string | null
          score: Json | null
          side_a_user_ids: string[] | null
          side_b_user_ids: string[] | null
          status: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id: string | null
          tournament_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_category: { Args: { _category_id: string }; Returns: undefined }
      request_match_reschedule: {
        Args: {
          _match_id: string
          _proposed_court_id: string
          _proposed_starts_at: string
        }
        Returns: {
          created_at: string
          id: string
          match_id: string
          proposed_by: string
          proposed_court_id: string | null
          proposed_starts_at: string
          reject_reason: string | null
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["reschedule_request_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tournament_match_reschedule_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reschedule_partner_match: {
        Args: {
          _duration_minutes?: number
          _invitation_id: string
          _new_court_id: string
          _new_starts_at: string
        }
        Returns: {
          block_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          court_id: string
          created_at: string
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          notes: string | null
          partner_user_id: string | null
          period: unknown
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          tenant_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_ladder_challenge: {
        Args: { _accept: boolean; _challenge_id: string; _reason?: string }
        Returns: {
          booking_id: string | null
          cancel_reason: string | null
          challenged_partner_user_id: string | null
          challenged_position: number | null
          challenged_user_id: string
          challenger_partner_user_id: string | null
          challenger_position: number | null
          challenger_user_id: string
          court_id: string | null
          created_at: string
          expires_at: string
          id: string
          ladder_id: string | null
          loser_user_id: string | null
          played_at: string | null
          proposed_at: string
          reject_reason: string | null
          responded_at: string | null
          result_confirmed_at: string | null
          result_proposed_at: string | null
          result_proposed_by: string | null
          retired: boolean
          scheduled_at: string | null
          score: Json | null
          status: Database["public"]["Enums"]["ladder_challenge_status"]
          tenant_id: string
          tournament_category_id: string | null
          tournament_match_id: string | null
          updated_at: string
          walkover: boolean
          winner_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ladder_challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_match_invitation: {
        Args: { _accept: boolean; _invitation_id: string; _selected_slot: Json }
        Returns: {
          booking_id: string | null
          compat_score: number | null
          created_at: string
          expires_at: string
          id: string
          invitee_user_id: string
          inviter_user_id: string
          message: string | null
          proposed_slots: Json
          responded_at: string | null
          selected_slot: Json | null
          status: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "match_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_match_open_post: {
        Args: { _message?: string; _post_id: string; _selected_slot: Json }
        Returns: {
          created_at: string
          id: string
          message: string | null
          post_id: string
          responder_user_id: string
          selected_slot: Json
          status: Database["public"]["Enums"]["partner_invitation_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "match_post_responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_match_reschedule: {
        Args: { _accept: boolean; _reason?: string; _request_id: string }
        Returns: {
          created_at: string
          id: string
          match_id: string
          proposed_by: string
          proposed_court_id: string | null
          proposed_starts_at: string
          reject_reason: string | null
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["reschedule_request_status"]
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tournament_match_reschedule_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revert_match_observation: {
        Args: { _tournament_match_id: string }
        Returns: undefined
      }
      revoke_organizer_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: undefined
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      schedule_ladder_match: {
        Args: { _challenge_id: string; _court_id: string; _starts_at: string }
        Returns: {
          booking_id: string | null
          cancel_reason: string | null
          challenged_partner_user_id: string | null
          challenged_position: number | null
          challenged_user_id: string
          challenger_partner_user_id: string | null
          challenger_position: number | null
          challenger_user_id: string
          court_id: string | null
          created_at: string
          expires_at: string
          id: string
          ladder_id: string | null
          loser_user_id: string | null
          played_at: string | null
          proposed_at: string
          reject_reason: string | null
          responded_at: string | null
          result_confirmed_at: string | null
          result_proposed_at: string | null
          result_proposed_by: string | null
          retired: boolean
          scheduled_at: string | null
          score: Json | null
          status: Database["public"]["Enums"]["ladder_challenge_status"]
          tenant_id: string
          tournament_category_id: string | null
          tournament_match_id: string | null
          updated_at: string
          walkover: boolean
          winner_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ladder_challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_match: {
        Args: { _court_id: string; _match_id: string; _starts_at: string }
        Returns: {
          acceptance_a: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at: string | null
          americano_round_id: string | null
          booking_id: string | null
          bracket: string
          bracket_position: number
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          court_id: string | null
          created_at: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          interrupted_at: string | null
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          next_match_id: string | null
          next_match_slot: string | null
          partial_score: Json | null
          phase: string | null
          played_at: string | null
          registration_a_id: string | null
          registration_b_id: string | null
          reported_at: string | null
          reported_by: string | null
          reschedule_used: boolean
          resume_deadline_at: string | null
          retired: boolean
          round: number
          scheduled_at: string | null
          score: Json | null
          side_a_user_ids: string[] | null
          side_b_user_ids: string[] | null
          status: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id: string | null
          tournament_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      snapshot_tournament_standings: { Args: never; Returns: number }
      submit_americano_result: {
        Args: {
          _match_id: string
          _score: Json
          _walkover?: boolean
          _winner_side: string
        }
        Returns: string
      }
      submit_ladder_result: {
        Args: {
          _challenge_id: string
          _retired?: boolean
          _score?: Json
          _walkover?: boolean
          _winner_user_id: string
        }
        Returns: Json
      }
      submit_match_result: {
        Args: {
          _match_id: string
          _retired?: boolean
          _score?: Json
          _walkover?: boolean
          _winner_registration_id: string
        }
        Returns: Json
      }
      submit_partner_match_result: {
        Args: {
          _invitation_id: string
          _retired?: boolean
          _score?: Json
          _walkover?: boolean
          _winner_user_id: string
        }
        Returns: Json
      }
      suggest_handicap: {
        Args: {
          _sport: Database["public"]["Enums"]["rating_sport"]
          _user_a: string
          _user_b: string
        }
        Returns: {
          diff: number
          level_a: number
          level_b: number
          suggestion: string
        }[]
      }
      swap_americano_players: {
        Args: { _round_id: string; _swaps: Json }
        Returns: Json
      }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      toggle_registration_fee: {
        Args: { _method?: string; _paid: boolean; _registration_id: string }
        Returns: {
          confirmed_at: string | null
          consecutive_wins: number
          created_at: string
          fee_amount_clp: number | null
          fee_method: string | null
          fee_paid_at: string | null
          id: string
          notes: string | null
          player1_user_id: string
          player2_user_id: string | null
          registered_at: string
          rules_accepted_at: string | null
          rules_version_accepted: number | null
          seed: number | null
          session_availability: string[]
          status: Database["public"]["Enums"]["registration_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_id: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tournament_pending_counts: {
        Args: never
        Returns: {
          admin_pending_registrations: number
          doubles_invitations: number
          reschedule_requests: number
          result_proposals: number
          total: number
        }[]
      }
      tournament_report_metrics: {
        Args: { _tournament_id: string }
        Returns: Json
      }
      tournament_signals_feed: {
        Args: never
        Returns: {
          created_at: string
          description: string
          kind: string
          link: string
          ref_id: string
          title: string
        }[]
      }
      tournament_tenant_id: {
        Args: { _tournament_id: string }
        Returns: string
      }
      unblock_tournament_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      unschedule_match: {
        Args: { _match_id: string }
        Returns: {
          acceptance_a: Database["public"]["Enums"]["match_acceptance_status"]
          acceptance_b: Database["public"]["Enums"]["match_acceptance_status"]
          accepted_at: string | null
          americano_round_id: string | null
          booking_id: string | null
          bracket: string
          bracket_position: number
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          court_id: string | null
          created_at: string
          dispute_reason: string | null
          disputed_at: string | null
          disputed_by: string | null
          id: string
          interrupted_at: string | null
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          next_match_id: string | null
          next_match_slot: string | null
          partial_score: Json | null
          phase: string | null
          played_at: string | null
          registration_a_id: string | null
          registration_b_id: string | null
          reported_at: string | null
          reported_by: string | null
          reschedule_used: boolean
          resume_deadline_at: string | null
          retired: boolean
          round: number
          scheduled_at: string | null
          score: Json | null
          side_a_user_ids: string[] | null
          side_b_user_ids: string[] | null
          status: Database["public"]["Enums"]["match_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_group_id: string | null
          tournament_id: string
          updated_at: string
          walkover: boolean
          winner_registration_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_match_history: {
        Args: { _limit?: number; _user_id: string }
        Returns: Json
      }
      user_partner_match_events: {
        Args: { _limit?: number; _user_id: string }
        Returns: Json
      }
      user_profile_summary: {
        Args: {
          _sport?: Database["public"]["Enums"]["rating_sport"]
          _user_id: string
        }
        Returns: Json
      }
      user_tenant_id: { Args: { _user_id: string }; Returns: string }
      withdraw_from_category: {
        Args: { _registration_id: string }
        Returns: {
          confirmed_at: string | null
          consecutive_wins: number
          created_at: string
          fee_amount_clp: number | null
          fee_method: string | null
          fee_paid_at: string | null
          id: string
          notes: string | null
          player1_user_id: string
          player2_user_id: string | null
          registered_at: string
          rules_accepted_at: string | null
          rules_version_accepted: number | null
          seed: number | null
          session_availability: string[]
          status: Database["public"]["Enums"]["registration_status"]
          tenant_id: string
          tournament_category_id: string
          tournament_id: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tournament_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_registration_with_walkover: {
        Args: { _registration_id: string }
        Returns: undefined
      }
    }
    Enums: {
      announcement_priority: "info" | "highlight" | "urgent"
      app_role:
        | "super_admin"
        | "club_admin"
        | "staff"
        | "member"
        | "coach"
        | "organizador"
      badge_category: "milestone" | "streak" | "rating" | "social" | "special"
      booking_kind: "socio" | "clase" | "torneo"
      booking_status: "confirmada" | "cancelada"
      category_gender: "varones" | "damas" | "mixto"
      coach_class_kind: "socio_individual" | "socio_compartida" | "externa"
      coach_class_status:
        | "propuesta"
        | "confirmada"
        | "completada"
        | "cancelada"
        | "no_show"
      coach_payment_status: "pendiente" | "pagada" | "condonada"
      competition_motor:
        | "eliminacion_simple"
        | "round_robin"
        | "grupos_playoff"
        | "americano_rotacion"
        | "consolacion"
        | "doble_eliminacion"
      court_surface: "arcilla" | "dura" | "cesped" | "sintetico"
      dues_status: "al_dia" | "pendiente" | "moroso" | "suspendido"
      ladder_challenge_status:
        | "propuesto"
        | "aceptado"
        | "rechazado"
        | "programado"
        | "jugado"
        | "expirado"
        | "cancelado"
      ladder_history_reason:
        | "ingreso"
        | "retiro"
        | "desafio_ganado"
        | "desafio_perdido"
        | "walkover"
        | "inactividad"
        | "ajuste_admin"
      ladder_position_status: "activo" | "inactivo" | "congelado"
      legal_doc_kind:
        | "terms"
        | "privacy"
        | "user_manual"
        | "rating_explained"
        | "club_regulation"
        | "other"
      match_acceptance_status: "pending" | "accepted" | "rejected"
      match_result_proposal_status: "propuesto" | "confirmado" | "rechazado"
      match_status:
        | "pendiente"
        | "programado"
        | "jugado"
        | "walkover"
        | "cancelado"
        | "interrumpido"
      open_match_gender_filter: "any" | "male" | "female" | "mixed"
      open_match_mode: "open_slots" | "pair_vs_pair"
      open_match_type: "singles" | "doubles"
      partner_invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      partner_match_format: "1set" | "best_of_3" | "best_of_5"
      partner_post_status: "open" | "matched" | "expired" | "cancelled"
      rating_change_source:
        | "onboarding"
        | "open_match"
        | "ladder_challenge"
        | "tournament_match"
        | "admin_adjustment"
        | "user_manual_lower"
        | "ten_match_challenge"
        | "clase"
      rating_sport: "tenis_singles" | "tenis_dobles" | "padel" | "pickleball"
      registration_status:
        | "pendiente_pareja"
        | "pendiente_admin"
        | "confirmada"
        | "rechazada"
        | "retirada"
      reschedule_request_status:
        | "pendiente"
        | "aceptada"
        | "rechazada"
        | "cancelada"
        | "expirada"
      result_validation_mode:
        | "solo_admin"
        | "jugadores_con_confirmacion"
        | "jugadores_con_aprobacion_admin"
      seeding_method: "manual" | "ntrp" | "ranking_club"
      tournament_discipline: "tenis_singles" | "tenis_dobles" | "padel_dobles"
      tournament_format: "eliminacion_simple"
      tournament_modality: "singles" | "dobles"
      tournament_sport: "tenis" | "padel"
      tournament_status:
        | "borrador"
        | "inscripciones_abiertas"
        | "inscripciones_cerradas"
        | "en_curso"
        | "finalizado"
        | "cancelado"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
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
      announcement_priority: ["info", "highlight", "urgent"],
      app_role: [
        "super_admin",
        "club_admin",
        "staff",
        "member",
        "coach",
        "organizador",
      ],
      badge_category: ["milestone", "streak", "rating", "social", "special"],
      booking_kind: ["socio", "clase", "torneo"],
      booking_status: ["confirmada", "cancelada"],
      category_gender: ["varones", "damas", "mixto"],
      coach_class_kind: ["socio_individual", "socio_compartida", "externa"],
      coach_class_status: [
        "propuesta",
        "confirmada",
        "completada",
        "cancelada",
        "no_show",
      ],
      coach_payment_status: ["pendiente", "pagada", "condonada"],
      competition_motor: [
        "eliminacion_simple",
        "round_robin",
        "grupos_playoff",
        "americano_rotacion",
        "consolacion",
        "doble_eliminacion",
      ],
      court_surface: ["arcilla", "dura", "cesped", "sintetico"],
      dues_status: ["al_dia", "pendiente", "moroso", "suspendido"],
      ladder_challenge_status: [
        "propuesto",
        "aceptado",
        "rechazado",
        "programado",
        "jugado",
        "expirado",
        "cancelado",
      ],
      ladder_history_reason: [
        "ingreso",
        "retiro",
        "desafio_ganado",
        "desafio_perdido",
        "walkover",
        "inactividad",
        "ajuste_admin",
      ],
      ladder_position_status: ["activo", "inactivo", "congelado"],
      legal_doc_kind: [
        "terms",
        "privacy",
        "user_manual",
        "rating_explained",
        "club_regulation",
        "other",
      ],
      match_acceptance_status: ["pending", "accepted", "rejected"],
      match_result_proposal_status: ["propuesto", "confirmado", "rechazado"],
      match_status: [
        "pendiente",
        "programado",
        "jugado",
        "walkover",
        "cancelado",
        "interrumpido",
      ],
      open_match_gender_filter: ["any", "male", "female", "mixed"],
      open_match_mode: ["open_slots", "pair_vs_pair"],
      open_match_type: ["singles", "doubles"],
      partner_invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      partner_match_format: ["1set", "best_of_3", "best_of_5"],
      partner_post_status: ["open", "matched", "expired", "cancelled"],
      rating_change_source: [
        "onboarding",
        "open_match",
        "ladder_challenge",
        "tournament_match",
        "admin_adjustment",
        "user_manual_lower",
        "ten_match_challenge",
        "clase",
      ],
      rating_sport: ["tenis_singles", "tenis_dobles", "padel", "pickleball"],
      registration_status: [
        "pendiente_pareja",
        "pendiente_admin",
        "confirmada",
        "rechazada",
        "retirada",
      ],
      reschedule_request_status: [
        "pendiente",
        "aceptada",
        "rechazada",
        "cancelada",
        "expirada",
      ],
      result_validation_mode: [
        "solo_admin",
        "jugadores_con_confirmacion",
        "jugadores_con_aprobacion_admin",
      ],
      seeding_method: ["manual", "ntrp", "ranking_club"],
      tournament_discipline: ["tenis_singles", "tenis_dobles", "padel_dobles"],
      tournament_format: ["eliminacion_simple"],
      tournament_modality: ["singles", "dobles"],
      tournament_sport: ["tenis", "padel"],
      tournament_status: [
        "borrador",
        "inscripciones_abiertas",
        "inscripciones_cerradas",
        "en_curso",
        "finalizado",
        "cancelado",
      ],
    },
  },
} as const
