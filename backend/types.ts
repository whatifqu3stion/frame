/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

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
      daily_installation_action_usage: {
        Row: {
          action_type: string
          installation_token_hash: string
          provider_call_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          action_type: string
          installation_token_hash: string
          provider_call_count?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          action_type?: string
          installation_token_hash?: string
          provider_call_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      daily_provider_usage: {
        Row: {
          estimated_quota_units: number
          id: string
          provider: string
          request_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          estimated_quota_units?: number
          id?: string
          provider: string
          request_count?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          estimated_quota_units?: number
          id?: string
          provider?: string
          request_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      interest_categories: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      media_items: {
        Row: {
          created_at: string
          description: string
          duration_seconds: number | null
          id: string
          is_livestream: boolean
          is_upcoming_premiere: boolean
          made_for_kids: boolean | null
          metadata_expires_at: string | null
          metadata_fetched_at: string | null
          provider: string
          provider_media_id: string
          published_at: string | null
          source_id: string
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_seconds?: number | null
          id?: string
          is_livestream?: boolean
          is_upcoming_premiere?: boolean
          made_for_kids?: boolean | null
          metadata_expires_at?: string | null
          metadata_fetched_at?: string | null
          provider: string
          provider_media_id: string
          published_at?: string | null
          source_id: string
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_seconds?: number | null
          id?: string
          is_livestream?: boolean
          is_upcoming_premiere?: boolean
          made_for_kids?: boolean | null
          metadata_expires_at?: string | null
          metadata_fetched_at?: string | null
          provider?: string
          provider_media_id?: string
          published_at?: string | null
          source_id?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      service_controls: {
        Row: {
          daily_youtube_unit_ceiling: number
          id: string
          maintenance_mode: boolean
          reserved_safety_units: number
          source_leases_enabled: boolean
          source_resolution_daily_installation_call_limit: number
          source_resolution_enabled: boolean
          source_sync_batch_limit: number
          source_sync_lock_seconds: number
          source_sync_success_interval_minutes: number
          updated_at: string
          weekly_picks_enabled: boolean
          youtube_ingestion_enabled: boolean
          youtube_ingestion_halted_until: string | null
          youtube_ingestion_last_error_code: string | null
        }
        Insert: {
          daily_youtube_unit_ceiling: number
          id: string
          maintenance_mode?: boolean
          reserved_safety_units: number
          source_leases_enabled?: boolean
          source_resolution_daily_installation_call_limit?: number
          source_resolution_enabled?: boolean
          source_sync_batch_limit?: number
          source_sync_lock_seconds?: number
          source_sync_success_interval_minutes?: number
          updated_at?: string
          weekly_picks_enabled?: boolean
          youtube_ingestion_enabled?: boolean
          youtube_ingestion_halted_until?: string | null
          youtube_ingestion_last_error_code?: string | null
        }
        Update: {
          daily_youtube_unit_ceiling?: number
          id?: string
          maintenance_mode?: boolean
          reserved_safety_units?: number
          source_leases_enabled?: boolean
          source_resolution_daily_installation_call_limit?: number
          source_resolution_enabled?: boolean
          source_sync_batch_limit?: number
          source_sync_lock_seconds?: number
          source_sync_success_interval_minutes?: number
          updated_at?: string
          weekly_picks_enabled?: boolean
          youtube_ingestion_enabled?: boolean
          youtube_ingestion_halted_until?: string | null
          youtube_ingestion_last_error_code?: string | null
        }
        Relationships: []
      }
      source_demand_leases: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          lease_token_hash: string
          renewed_at: string
          source_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          lease_token_hash: string
          renewed_at?: string
          source_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          lease_token_hash?: string
          renewed_at?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_demand_leases_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_interests: {
        Row: {
          created_at: string
          id: string
          interest_id: string
          is_active: boolean
          provenance: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_id: string
          is_active?: boolean
          provenance?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_id?: string
          is_active?: boolean
          provenance?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_interests_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_sync_state: {
        Row: {
          claim_token: string | null
          consecutive_failures: number
          created_at: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_success_at: string | null
          locked_until: string | null
          next_attempt_at: string
          source_id: string
          updated_at: string
          uploads_playlist_id: string | null
        }
        Insert: {
          claim_token?: string | null
          consecutive_failures?: number
          created_at?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          source_id: string
          updated_at?: string
          uploads_playlist_id?: string | null
        }
        Update: {
          claim_token?: string | null
          consecutive_failures?: number
          created_at?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          source_id?: string
          updated_at?: string
          uploads_playlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_sync_state_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_sync_worker_credentials: {
        Row: {
          created_at: string
          id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          created_at: string
          description: string
          display_name: string
          handle: string | null
          id: string
          metadata_expires_at: string | null
          metadata_fetched_at: string | null
          provider: string
          provider_source_id: string
          status: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_name: string
          handle?: string | null
          id?: string
          metadata_expires_at?: string | null
          metadata_fetched_at?: string | null
          provider: string
          provider_source_id: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_name?: string
          handle?: string | null
          id?: string
          metadata_expires_at?: string | null
          metadata_fetched_at?: string | null
          provider?: string
          provider_source_id?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      weekly_pick_items: {
        Row: {
          created_at: string
          display_order: number
          featured_media_item_id: string | null
          id: string
          pick_set_id: string
          public_reason: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          featured_media_item_id?: string | null
          id?: string
          pick_set_id: string
          public_reason?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          featured_media_item_id?: string | null
          id?: string
          pick_set_id?: string
          public_reason?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_pick_items_featured_media_item_id_source_id_fkey"
            columns: ["featured_media_item_id", "source_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id", "source_id"]
          },
          {
            foreignKeyName: "weekly_pick_items_pick_set_id_fkey"
            columns: ["pick_set_id"]
            isOneToOne: false
            referencedRelation: "weekly_pick_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_pick_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_pick_sets: {
        Row: {
          created_at: string
          id: string
          interest_id: string
          period_end: string
          period_start: string
          published_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_id: string
          period_end: string
          period_start: string
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_id?: string
          period_end?: string
          period_start?: string
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_pick_sets_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authorize_source_sync_worker: {
        Args: { p_token: string }
        Returns: boolean
      }
      claim_due_source_syncs: {
        Args: { p_claim_token: string; p_requested_limit?: number }
        Returns: {
          provider_source_id: string
          source_id: string
          source_metadata_expires_at: string
          source_metadata_fetched_at: string
          uploads_playlist_id: string
        }[]
      }
      complete_source_sync_claim: {
        Args: {
          p_claim_token: string
          p_error_code?: string
          p_outcome: string
          p_source_id: string
          p_uploads_playlist_id?: string
        }
        Returns: boolean
      }
      create_or_renew_source_demand_lease: {
        Args: {
          p_expires_at: string
          p_lease_token_hash: string
          p_source_id: string
        }
        Returns: string
      }
      expire_stale_youtube_metadata: {
        Args: { p_limit?: number }
        Returns: {
          expired_media_count: number
          expired_source_count: number
        }[]
      }
      get_current_weekly_picks: {
        Args: { p_interest_ids: string[] }
        Returns: {
          interest_id: string
          media_description: string
          media_duration_seconds: number
          media_is_livestream: boolean
          media_is_upcoming_premiere: boolean
          media_provider: string
          media_provider_id: string
          media_published_at: string
          media_thumbnail_url: string
          media_title: string
          period_end: string
          period_start: string
          pick_order: number
          pick_set_status: string
          public_reason: string
          source_description: string
          source_display_name: string
          source_handle: string
          source_provider: string
          source_provider_id: string
          source_thumbnail_url: string
        }[]
      }
      increment_daily_provider_usage: {
        Args: {
          p_estimated_quota_units?: number
          p_provider: string
          p_request_count?: number
        }
        Returns: {
          estimated_quota_units: number
          provider: string
          request_count: number
          updated_at: string
          usage_date: string
        }[]
      }
      next_youtube_quota_reset: { Args: { p_now?: string }; Returns: string }
      purge_expired_source_demand_leases: { Args: never; Returns: number }
      read_cached_source_feed_items: {
        Args: { p_limit_per_source?: number; p_provider_source_ids: string[] }
        Returns: {
          description: string
          duration_seconds: number
          is_livestream: boolean
          is_upcoming_premiere: boolean
          made_for_kids: boolean
          metadata_fetched_at: string
          provider: string
          provider_media_id: string
          published_at: string
          source_id: string
          thumbnail_url: string
          title: string
        }[]
      }
      record_youtube_ingestion_halt: {
        Args: { p_error_code: string; p_halted_until: string }
        Returns: boolean
      }
      release_source_demand_lease: {
        Args: { p_lease_token_hash: string }
        Returns: boolean
      }
      reserve_source_resolution_quota: {
        Args: { p_installation_token: string; p_provider_call_count: number }
        Returns: {
          outcome: string
          reserved_provider_calls: number
        }[]
      }
      reserve_youtube_ingestion_quota: {
        Args: { p_quota_units: number; p_request_count: number }
        Returns: {
          outcome: string
          reserved_quota_units: number
          reserved_request_count: number
        }[]
      }
      user_id: { Args: never; Returns: string }
      youtube_quota_date: { Args: { p_now?: string }; Returns: string }
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
