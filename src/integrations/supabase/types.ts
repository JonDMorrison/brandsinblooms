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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_details: Json | null
          action_type: string
          admin_user_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          target_tenant_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_session_context: {
        Row: {
          active_tenant_id: string | null
          admin_user_id: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          active_tenant_id?: string | null
          admin_user_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          active_tenant_id?: string | null
          admin_user_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_session_context_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "admin_session_context_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_generated_images: {
        Row: {
          created_at: string | null
          enhanced_prompt: string | null
          generation_order: number
          global_image_id: string
          id: string
          is_selected: boolean | null
          message_id: string
          selected_at: string | null
          session_id: string
          used_in_context: string | null
          used_in_id: string | null
          user_prompt: string
        }
        Insert: {
          created_at?: string | null
          enhanced_prompt?: string | null
          generation_order: number
          global_image_id: string
          id?: string
          is_selected?: boolean | null
          message_id: string
          selected_at?: string | null
          session_id: string
          used_in_context?: string | null
          used_in_id?: string | null
          user_prompt: string
        }
        Update: {
          created_at?: string | null
          enhanced_prompt?: string | null
          generation_order?: number
          global_image_id?: string
          id?: string
          is_selected?: boolean | null
          message_id?: string
          selected_at?: string | null
          session_id?: string
          used_in_context?: string | null
          used_in_id?: string | null
          user_prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_generated_images_global_image_id_fkey"
            columns: ["global_image_id"]
            isOneToOne: false
            referencedRelation: "global_image_gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_generated_images_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_generated_images_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          message_type: string
          metadata: Json | null
          sequence_number: number
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          message_type: string
          metadata?: Json | null
          sequence_number: number
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          sequence_number?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistant_sessions: {
        Row: {
          channel: string | null
          context_id: string | null
          context_type: string | null
          created_at: string | null
          id: string
          image_count: number | null
          last_activity_at: string | null
          message_count: number | null
          tenant_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          image_count?: number | null
          last_activity_at?: string | null
          message_count?: number | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          image_count?: number | null
          last_activity_at?: string | null
          message_count?: number | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ai_assistant_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_resources: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      ai_mapping_suggestions: {
        Row: {
          artifact_id: string
          confidence_score: number | null
          created_at: string
          id: string
          import_job_id: string
          new_persona_name: string | null
          new_segment_name: string | null
          rationale: string | null
          suggested_action: string
          suggestion_data: Json | null
          target_persona_id: string | null
          target_segment_id: string | null
          tenant_id: string
        }
        Insert: {
          artifact_id: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          import_job_id: string
          new_persona_name?: string | null
          new_segment_name?: string | null
          rationale?: string | null
          suggested_action: string
          suggestion_data?: Json | null
          target_persona_id?: string | null
          target_segment_id?: string | null
          tenant_id: string
        }
        Update: {
          artifact_id?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          import_job_id?: string
          new_persona_name?: string | null
          new_segment_name?: string | null
          rationale?: string | null
          suggested_action?: string
          suggestion_data?: Json | null
          target_persona_id?: string | null
          target_segment_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_mapping_suggestions_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "provider_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_mapping_suggestions_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_data: {
        Row: {
          connection_id: string
          created_at: string
          date_collected: string
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
        }
        Insert: {
          connection_id: string
          created_at?: string
          date_collected: string
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
        }
        Update: {
          connection_id?: string
          created_at?: string
          date_collected?: string
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_data_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          automation_id: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string | null
          event_type: string
          id: string
          message_type: string | null
          payload: Json | null
          sms_id: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          message_type?: string | null
          payload?: Json | null
          sms_id?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          automation_id?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          message_type?: string | null
          payload?: Json | null
          sms_id?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_settings: {
        Row: {
          auto_sync_enabled: boolean
          created_at: string
          email_frequency: string
          email_reports_enabled: boolean
          id: string
          sync_frequency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          created_at?: string
          email_frequency?: string
          email_reports_enabled?: boolean
          id?: string
          sync_frequency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean
          created_at?: string
          email_frequency?: string
          email_reports_enabled?: boolean
          id?: string
          sync_frequency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_admin_emails: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
        }
        Relationships: []
      }
      automation_events: {
        Row: {
          automation_id: string | null
          branch_id: string | null
          created_at: string | null
          customer_id: string | null
          event_type: string
          id: string
          is_test: boolean | null
          message_id: string | null
          metadata: Json | null
          order_id: string | null
          revenue_amount: number | null
        }
        Insert: {
          automation_id?: string | null
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          event_type: string
          id?: string
          is_test?: boolean | null
          message_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          revenue_amount?: number | null
        }
        Update: {
          automation_id?: string | null
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          event_type?: string
          id?: string
          is_test?: boolean | null
          message_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          revenue_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_personas: {
        Row: {
          automation_id: string
          created_at: string | null
          id: string
          persona_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string | null
          id?: string
          persona_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string | null
          id?: string
          persona_id?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          automation_id: string
          completed_at: string | null
          created_at: string
          current_step_index: number
          customer_id: string
          error_message: string | null
          id: string
          metadata: Json | null
          next_step_scheduled_at: string | null
          started_at: string
          status: string
          tenant_id: string
          total_steps: number
          trigger_data: Json | null
          updated_at: string
        }
        Insert: {
          automation_id: string
          completed_at?: string | null
          created_at?: string
          current_step_index?: number
          customer_id: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          next_step_scheduled_at?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          total_steps?: number
          trigger_data?: Json | null
          updated_at?: string
        }
        Update: {
          automation_id?: string
          completed_at?: string | null
          created_at?: string
          current_step_index?: number
          customer_id?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          next_step_scheduled_at?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          total_steps?: number
          trigger_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          flow_data: Json
          id: string
          is_active: boolean | null
          kpi_data: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          flow_data: Json
          id?: string
          is_active?: boolean | null
          kpi_data?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          flow_data?: Json
          id?: string
          is_active?: boolean | null
          kpi_data?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_trigger_events: {
        Row: {
          automation_id: string | null
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          event_type: string
          id: string
          persona_id: string | null
          processed_at: string | null
          segment_id: string | null
          tenant_id: string
        }
        Insert: {
          automation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          persona_id?: string | null
          processed_at?: string | null
          segment_id?: string | null
          tenant_id: string
        }
        Update: {
          automation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          persona_id?: string | null
          processed_at?: string | null
          segment_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_trigger_events_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_trigger_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_trigger_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_trigger_events_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_trigger_events_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "crm_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_trigger_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "automation_trigger_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_versions: {
        Row: {
          author_user_id: string
          automation_id: string | null
          created_at: string | null
          diff_data: Json
          id: string
          version_number: number
        }
        Insert: {
          author_user_id: string
          automation_id?: string | null
          created_at?: string | null
          diff_data: Json
          id?: string
          version_number: number
        }
        Update: {
          author_user_id?: string
          automation_id?: string | null
          created_at?: string | null
          diff_data?: Json
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_versions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      available_fonts: {
        Row: {
          created_at: string | null
          display_name: string
          font_family_css: string
          google_fonts_url: string
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          font_family_css: string
          google_fonts_url: string
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          font_family_css?: string
          google_fonts_url?: string
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_attribution: {
        Row: {
          attribution_window_days: number | null
          automation_id: string | null
          campaign_id: string | null
          contact_id: string
          created_at: string | null
          first_touch_at: string | null
          id: string
          last_touch_at: string | null
          tenant_id: string
          total_redemptions: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          attribution_window_days?: number | null
          automation_id?: string | null
          campaign_id?: string | null
          contact_id: string
          created_at?: string | null
          first_touch_at?: string | null
          id?: string
          last_touch_at?: string | null
          tenant_id: string
          total_redemptions?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          attribution_window_days?: number | null
          automation_id?: string | null
          campaign_id?: string | null
          contact_id?: string
          created_at?: string | null
          first_touch_at?: string | null
          id?: string
          last_touch_at?: string | null
          tenant_id?: string
          total_redemptions?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_block_versions: {
        Row: {
          block_id: string
          campaign_id: string
          created_at: string
          id: string
          snapshot_json: Json
        }
        Insert: {
          block_id: string
          campaign_id: string
          created_at?: string
          id?: string
          snapshot_json: Json
        }
        Update: {
          block_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          snapshot_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_block_versions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "campaign_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_block_versions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_blocks: {
        Row: {
          block_type: string
          campaign_id: string
          content: Json
          created_at: string
          cta_text: string | null
          cta_url: string | null
          dark_overlay_opacity: number | null
          headline: string | null
          id: string
          image_url: string | null
          layout_settings: Json | null
          order_index: number
          overlay_color: string | null
          overlay_opacity: number | null
          persona_tag: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          block_type: string
          campaign_id: string
          content?: Json
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          dark_overlay_opacity?: number | null
          headline?: string | null
          id?: string
          image_url?: string | null
          layout_settings?: Json | null
          order_index?: number
          overlay_color?: string | null
          overlay_opacity?: number | null
          persona_tag?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          block_type?: string
          campaign_id?: string
          content?: Json
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          dark_overlay_opacity?: number | null
          headline?: string | null
          id?: string
          image_url?: string | null
          layout_settings?: Json | null
          order_index?: number
          overlay_color?: string | null
          overlay_opacity?: number | null
          persona_tag?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_content_classification: {
        Row: {
          ai_classification_reason: string | null
          ai_classified: boolean | null
          ai_confidence_score: number | null
          block_id: string | null
          campaign_id: string | null
          content_category: string
          content_type: string
          created_at: string | null
          crm_campaign_id: string | null
          cta_types: string[] | null
          has_cta: boolean | null
          id: string
          is_brand_story: boolean | null
          is_educational: boolean | null
          is_promotional: boolean | null
          is_time_sensitive: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ai_classification_reason?: string | null
          ai_classified?: boolean | null
          ai_confidence_score?: number | null
          block_id?: string | null
          campaign_id?: string | null
          content_category: string
          content_type: string
          created_at?: string | null
          crm_campaign_id?: string | null
          cta_types?: string[] | null
          has_cta?: boolean | null
          id?: string
          is_brand_story?: boolean | null
          is_educational?: boolean | null
          is_promotional?: boolean | null
          is_time_sensitive?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ai_classification_reason?: string | null
          ai_classified?: boolean | null
          ai_confidence_score?: number | null
          block_id?: string | null
          campaign_id?: string | null
          content_category?: string
          content_type?: string
          created_at?: string | null
          crm_campaign_id?: string | null
          cta_types?: string[] | null
          has_cta?: boolean | null
          id?: string
          is_brand_story?: boolean | null
          is_educational?: boolean | null
          is_promotional?: boolean | null
          is_time_sensitive?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_content_classification_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_content_classification_crm_campaign_id_fkey"
            columns: ["crm_campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_content_classification_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "campaign_content_classification_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_personas: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          persona_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          persona_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          persona_id?: string
        }
        Relationships: []
      }
      campaign_segments: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          segment_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          segment_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_segments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "crm_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          description: string | null
          hub_enabled: boolean | null
          hub_expiry: string | null
          id: string
          prompt: string | null
          slug: string | null
          source: string | null
          start_date: string | null
          tenant_id: string | null
          theme: string | null
          title: string
          user_id: string | null
          week_number: number | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          hub_enabled?: boolean | null
          hub_expiry?: string | null
          id?: string
          prompt?: string | null
          slug?: string | null
          source?: string | null
          start_date?: string | null
          tenant_id?: string | null
          theme?: string | null
          title: string
          user_id?: string | null
          week_number?: number | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          description?: string | null
          hub_enabled?: boolean | null
          hub_expiry?: string | null
          id?: string
          prompt?: string | null
          slug?: string | null
          source?: string | null
          start_date?: string | null
          tenant_id?: string | null
          theme?: string | null
          title?: string
          user_id?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      canva_designs: {
        Row: {
          canva_design_id: string
          content_task_id: string | null
          created_at: string
          design_metadata: Json | null
          final_image_url: string | null
          id: string
          original_image_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          canva_design_id: string
          content_task_id?: string | null
          created_at?: string
          design_metadata?: Json | null
          final_image_url?: string | null
          id?: string
          original_image_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          canva_design_id?: string
          content_task_id?: string | null
          created_at?: string
          design_metadata?: Json | null
          final_image_url?: string | null
          id?: string
          original_image_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canva_designs_content_task_id_fkey"
            columns: ["content_task_id"]
            isOneToOne: false
            referencedRelation: "content_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      clover_connection_tests: {
        Row: {
          connection_id: string
          counts: Json | null
          created_at: string | null
          duration_ms: number | null
          errors: Json | null
          id: string
          merchant_id: string
          raw_results: Json
          status: string
          summary: string | null
          tenant_id: string
          tested_by: string | null
        }
        Insert: {
          connection_id: string
          counts?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          merchant_id: string
          raw_results?: Json
          status: string
          summary?: string | null
          tenant_id: string
          tested_by?: string | null
        }
        Update: {
          connection_id?: string
          counts?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          merchant_id?: string
          raw_results?: Json
          status?: string
          summary?: string | null
          tenant_id?: string
          tested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clover_connection_tests_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "clover_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clover_connection_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "clover_connection_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clover_connections: {
        Row: {
          connected_at: string | null
          created_at: string | null
          customers_synced: number | null
          employee_id: string | null
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          environment: string | null
          expires_at: string
          id: string
          last_customer_sync: string | null
          last_product_sync: string | null
          last_sales_sync: string | null
          last_synced_at: string | null
          last_test_status: string | null
          last_tested_at: string | null
          merchant_id: string | null
          merchant_name: string | null
          products_synced: number | null
          region: string | null
          sales_synced: number | null
          setup_wizard_completed_at: string | null
          status: string | null
          sync_errors: Json | null
          tenant_id: string
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          employee_id?: string | null
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          environment?: string | null
          expires_at: string
          id?: string
          last_customer_sync?: string | null
          last_product_sync?: string | null
          last_sales_sync?: string | null
          last_synced_at?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          products_synced?: number | null
          region?: string | null
          sales_synced?: number | null
          setup_wizard_completed_at?: string | null
          status?: string | null
          sync_errors?: Json | null
          tenant_id: string
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          employee_id?: string | null
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          environment?: string | null
          expires_at?: string
          id?: string
          last_customer_sync?: string | null
          last_product_sync?: string | null
          last_sales_sync?: string | null
          last_synced_at?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          products_synced?: number | null
          region?: string | null
          sales_synced?: number | null
          setup_wizard_completed_at?: string | null
          status?: string | null
          sync_errors?: Json | null
          tenant_id?: string
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clover_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "clover_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          beta_tour_enabled: boolean | null
          body_font_id: string | null
          brand_accent_color: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          brand_text_color: string | null
          brand_voice: string | null
          button_font_id: string | null
          city: string | null
          company_email: string | null
          company_name: string | null
          company_overview: string | null
          company_phone: string | null
          company_values: string | null
          compliance_settings: Json | null
          country: string | null
          created_at: string
          crm_onboarding_completed_at: string | null
          custom_sender_email: string | null
          deleted_at: string | null
          description: string | null
          dns_records_verified: boolean | null
          email_auth_setup_at: string | null
          email_auth_status: string | null
          email_domain: string | null
          facebook_url: string | null
          feature_flags: Json | null
          first_content_generated: boolean | null
          first_welcome_dismissed: boolean | null
          footer_legal_text: string | null
          headline_font_id: string | null
          id: string
          ideal_customer: string | null
          instagram_url: string | null
          linkedin_url: string | null
          location_info: string | null
          onboarding_completed_at: string | null
          pinterest_url: string | null
          postal_code: string | null
          seasonal_focus: string | null
          selected_font_id: string | null
          specializations: string | null
          state_province: string | null
          street_address: string | null
          subheading_font_id: string | null
          target_audience: string | null
          test_numbers: string[] | null
          tiktok_url: string | null
          tokens_balance: number | null
          tokens_reset_at: string | null
          tone_of_writing: string | null
          unique_selling_points: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          beta_tour_enabled?: boolean | null
          body_font_id?: string | null
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_text_color?: string | null
          brand_voice?: string | null
          button_font_id?: string | null
          city?: string | null
          company_email?: string | null
          company_name?: string | null
          company_overview?: string | null
          company_phone?: string | null
          company_values?: string | null
          compliance_settings?: Json | null
          country?: string | null
          created_at?: string
          crm_onboarding_completed_at?: string | null
          custom_sender_email?: string | null
          deleted_at?: string | null
          description?: string | null
          dns_records_verified?: boolean | null
          email_auth_setup_at?: string | null
          email_auth_status?: string | null
          email_domain?: string | null
          facebook_url?: string | null
          feature_flags?: Json | null
          first_content_generated?: boolean | null
          first_welcome_dismissed?: boolean | null
          footer_legal_text?: string | null
          headline_font_id?: string | null
          id?: string
          ideal_customer?: string | null
          instagram_url?: string | null
          linkedin_url?: string | null
          location_info?: string | null
          onboarding_completed_at?: string | null
          pinterest_url?: string | null
          postal_code?: string | null
          seasonal_focus?: string | null
          selected_font_id?: string | null
          specializations?: string | null
          state_province?: string | null
          street_address?: string | null
          subheading_font_id?: string | null
          target_audience?: string | null
          test_numbers?: string[] | null
          tiktok_url?: string | null
          tokens_balance?: number | null
          tokens_reset_at?: string | null
          tone_of_writing?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          beta_tour_enabled?: boolean | null
          body_font_id?: string | null
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_text_color?: string | null
          brand_voice?: string | null
          button_font_id?: string | null
          city?: string | null
          company_email?: string | null
          company_name?: string | null
          company_overview?: string | null
          company_phone?: string | null
          company_values?: string | null
          compliance_settings?: Json | null
          country?: string | null
          created_at?: string
          crm_onboarding_completed_at?: string | null
          custom_sender_email?: string | null
          deleted_at?: string | null
          description?: string | null
          dns_records_verified?: boolean | null
          email_auth_setup_at?: string | null
          email_auth_status?: string | null
          email_domain?: string | null
          facebook_url?: string | null
          feature_flags?: Json | null
          first_content_generated?: boolean | null
          first_welcome_dismissed?: boolean | null
          footer_legal_text?: string | null
          headline_font_id?: string | null
          id?: string
          ideal_customer?: string | null
          instagram_url?: string | null
          linkedin_url?: string | null
          location_info?: string | null
          onboarding_completed_at?: string | null
          pinterest_url?: string | null
          postal_code?: string | null
          seasonal_focus?: string | null
          selected_font_id?: string | null
          specializations?: string | null
          state_province?: string | null
          street_address?: string | null
          subheading_font_id?: string | null
          target_audience?: string | null
          test_numbers?: string[] | null
          tiktok_url?: string | null
          tokens_balance?: number | null
          tokens_reset_at?: string | null
          tone_of_writing?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_body_font_id_fkey"
            columns: ["body_font_id"]
            isOneToOne: false
            referencedRelation: "available_fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_button_font_id_fkey"
            columns: ["button_font_id"]
            isOneToOne: false
            referencedRelation: "available_fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_headline_font_id_fkey"
            columns: ["headline_font_id"]
            isOneToOne: false
            referencedRelation: "available_fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_selected_font_id_fkey"
            columns: ["selected_font_id"]
            isOneToOne: false
            referencedRelation: "available_fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_subheading_font_id_fkey"
            columns: ["subheading_font_id"]
            isOneToOne: false
            referencedRelation: "available_fonts"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_logs: {
        Row: {
          automation_id: string | null
          campaign_id: string | null
          created_at: string | null
          event_type: string
          id: string
          message_content: string | null
          meta: Json | null
          msisdn: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          message_content?: string | null
          meta?: Json | null
          msisdn: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          automation_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          message_content?: string | null
          meta?: Json | null
          msisdn?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_assets: {
        Row: {
          created_at: string
          dimensions: string | null
          duration: string | null
          file_path: string
          id: string
          name: string
          photographer: string | null
          size_bytes: number
          tags: string[] | null
          type: string
          unsplash_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dimensions?: string | null
          duration?: string | null
          file_path: string
          id?: string
          name: string
          photographer?: string | null
          size_bytes: number
          tags?: string[] | null
          type: string
          unsplash_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dimensions?: string | null
          duration?: string | null
          file_path?: string
          id?: string
          name?: string
          photographer?: string | null
          size_bytes?: number
          tags?: string[] | null
          type?: string
          unsplash_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_active: boolean
          payload_json: Json
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          payload_json?: Json
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          payload_json?: Json
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_interaction_events: {
        Row: {
          block_id: string | null
          block_type: string | null
          blocks_viewed: number | null
          campaign_id: string | null
          channel: string
          content_category: string | null
          content_type: string
          created_at: string | null
          cta_position: number | null
          cta_type: string | null
          customer_id: string | null
          device_type: string | null
          id: string
          interaction_type: string
          is_deep_engagement: boolean | null
          is_quick_response: boolean | null
          message_id: string | null
          metadata: Json | null
          scroll_depth_percent: number | null
          session_id: string
          tenant_id: string
          time_since_send_seconds: number | null
          time_spent_seconds: number | null
          user_agent: string | null
        }
        Insert: {
          block_id?: string | null
          block_type?: string | null
          blocks_viewed?: number | null
          campaign_id?: string | null
          channel: string
          content_category?: string | null
          content_type: string
          created_at?: string | null
          cta_position?: number | null
          cta_type?: string | null
          customer_id?: string | null
          device_type?: string | null
          id?: string
          interaction_type: string
          is_deep_engagement?: boolean | null
          is_quick_response?: boolean | null
          message_id?: string | null
          metadata?: Json | null
          scroll_depth_percent?: number | null
          session_id: string
          tenant_id: string
          time_since_send_seconds?: number | null
          time_spent_seconds?: number | null
          user_agent?: string | null
        }
        Update: {
          block_id?: string | null
          block_type?: string | null
          blocks_viewed?: number | null
          campaign_id?: string | null
          channel?: string
          content_category?: string | null
          content_type?: string
          created_at?: string | null
          cta_position?: number | null
          cta_type?: string | null
          customer_id?: string | null
          device_type?: string | null
          id?: string
          interaction_type?: string
          is_deep_engagement?: boolean | null
          is_quick_response?: boolean | null
          message_id?: string | null
          metadata?: Json | null
          scroll_depth_percent?: number | null
          session_id?: string
          tenant_id?: string
          time_since_send_seconds?: number | null
          time_spent_seconds?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_interaction_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_interaction_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_interaction_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "content_interaction_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_tasks: {
        Row: {
          ai_output: string | null
          assigned_user_id: string | null
          attachments: Json | null
          campaign_id: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          hashtags: string | null
          holiday_id: string | null
          id: string
          image_generated_at: string | null
          image_generation_error: string | null
          image_generation_status: string | null
          image_idea: string | null
          image_metadata: Json | null
          image_source: string | null
          image_url: string | null
          last_posting_error: string | null
          linked_crm_campaign_id: string | null
          notes: string | null
          plan_id: string | null
          plan_theme: string | null
          platform_post_id: string | null
          platform_post_url: string | null
          post_type: string | null
          posting_attempts: number | null
          posting_disabled_at: string | null
          preview_image_url: string | null
          scheduled_date: string | null
          status: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          ai_output?: string | null
          assigned_user_id?: string | null
          attachments?: Json | null
          campaign_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          hashtags?: string | null
          holiday_id?: string | null
          id?: string
          image_generated_at?: string | null
          image_generation_error?: string | null
          image_generation_status?: string | null
          image_idea?: string | null
          image_metadata?: Json | null
          image_source?: string | null
          image_url?: string | null
          last_posting_error?: string | null
          linked_crm_campaign_id?: string | null
          notes?: string | null
          plan_id?: string | null
          plan_theme?: string | null
          platform_post_id?: string | null
          platform_post_url?: string | null
          post_type?: string | null
          posting_attempts?: number | null
          posting_disabled_at?: string | null
          preview_image_url?: string | null
          scheduled_date?: string | null
          status?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          ai_output?: string | null
          assigned_user_id?: string | null
          attachments?: Json | null
          campaign_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          hashtags?: string | null
          holiday_id?: string | null
          id?: string
          image_generated_at?: string | null
          image_generation_error?: string | null
          image_generation_status?: string | null
          image_idea?: string | null
          image_metadata?: Json | null
          image_source?: string | null
          image_url?: string | null
          last_posting_error?: string | null
          linked_crm_campaign_id?: string | null
          notes?: string | null
          plan_id?: string | null
          plan_theme?: string | null
          platform_post_id?: string | null
          platform_post_url?: string | null
          post_type?: string | null
          posting_attempts?: number | null
          posting_disabled_at?: string | null
          preview_image_url?: string | null
          scheduled_date?: string | null
          status?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tasks_holiday_id_fkey"
            columns: ["holiday_id"]
            isOneToOne: false
            referencedRelation: "holidays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tasks_linked_crm_campaign_id_fkey"
            columns: ["linked_crm_campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "content_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          description: string | null
          id: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          usage_count: number | null
          user_id: string
          variables: string[] | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          description?: string | null
          id?: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
          usage_count?: number | null
          user_id: string
          variables?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          usage_count?: number | null
          user_id?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          automation_id: string | null
          campaign_id: string | null
          code: string
          created_at: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          generated_at: string | null
          id: string
          is_active: boolean | null
          min_purchase_amount: number | null
          net_sales: number | null
          pos_txn_id: string | null
          redeemed_at: string | null
          tenant_id: string
          updated_at: string | null
          usage_count: number | null
          usage_limit: number | null
        }
        Insert: {
          automation_id?: string | null
          campaign_id?: string | null
          code: string
          created_at?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          is_active?: boolean | null
          min_purchase_amount?: number | null
          net_sales?: number | null
          pos_txn_id?: string | null
          redeemed_at?: string | null
          tenant_id: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
        }
        Update: {
          automation_id?: string | null
          campaign_id?: string | null
          code?: string
          created_at?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          is_active?: boolean | null
          min_purchase_amount?: number | null
          net_sales?: number | null
          pos_txn_id?: string | null
          redeemed_at?: string | null
          tenant_id?: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      crm_automation_logs: {
        Row: {
          automation_id: string
          created_at: string | null
          customer_id: string
          error_message: string | null
          id: string
          message_type: string
          sent_at: string | null
          status: string
          step_index: number
          updated_at: string | null
        }
        Insert: {
          automation_id: string
          created_at?: string | null
          customer_id: string
          error_message?: string | null
          id?: string
          message_type: string
          sent_at?: string | null
          status?: string
          step_index: number
          updated_at?: string | null
        }
        Update: {
          automation_id?: string
          created_at?: string | null
          customer_id?: string
          error_message?: string | null
          id?: string
          message_type?: string
          sent_at?: string | null
          status?: string
          step_index?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_automations: {
        Row: {
          created_at: string | null
          flow_state: Json | null
          id: string
          is_active: boolean | null
          name: string
          persona_targeting: Json | null
          template_source: string | null
          tenant_id: string | null
          trigger_conditions: Json | null
          trigger_type: string
          updated_at: string | null
          user_id: string | null
          version: number | null
          workflow_steps: Json | null
        }
        Insert: {
          created_at?: string | null
          flow_state?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          persona_targeting?: Json | null
          template_source?: string | null
          tenant_id?: string | null
          trigger_conditions?: Json | null
          trigger_type: string
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
          workflow_steps?: Json | null
        }
        Update: {
          created_at?: string | null
          flow_state?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          persona_targeting?: Json | null
          template_source?: string | null
          tenant_id?: string | null
          trigger_conditions?: Json | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
          workflow_steps?: Json | null
        }
        Relationships: []
      }
      crm_campaigns: {
        Row: {
          actual_sender_email: string | null
          auto_send_enabled: boolean | null
          click_rate: number | null
          content: string | null
          created_at: string | null
          delivery_method: string | null
          from_email_domain_id: string | null
          id: string
          metadata: Json | null
          metrics: Json | null
          name: string
          open_rate: number | null
          persona_ids: string[] | null
          predicted_segment_ids: string[] | null
          preheader: string | null
          preheader_text: string | null
          scheduled_at: string | null
          segment_id: string | null
          send_blocked_reason: string | null
          send_reasoning: string | null
          sender_display_name: string | null
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          source_campaign_id: string | null
          source_content_task_id: string | null
          status: string | null
          subject_line: string | null
          synced_from: string | null
          template_id: string | null
          tenant_id: string | null
          total_clicks: number | null
          total_opens: number | null
          total_sent: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actual_sender_email?: string | null
          auto_send_enabled?: boolean | null
          click_rate?: number | null
          content?: string | null
          created_at?: string | null
          delivery_method?: string | null
          from_email_domain_id?: string | null
          id?: string
          metadata?: Json | null
          metrics?: Json | null
          name: string
          open_rate?: number | null
          persona_ids?: string[] | null
          predicted_segment_ids?: string[] | null
          preheader?: string | null
          preheader_text?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          send_blocked_reason?: string | null
          send_reasoning?: string | null
          sender_display_name?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          source_campaign_id?: string | null
          source_content_task_id?: string | null
          status?: string | null
          subject_line?: string | null
          synced_from?: string | null
          template_id?: string | null
          tenant_id?: string | null
          total_clicks?: number | null
          total_opens?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actual_sender_email?: string | null
          auto_send_enabled?: boolean | null
          click_rate?: number | null
          content?: string | null
          created_at?: string | null
          delivery_method?: string | null
          from_email_domain_id?: string | null
          id?: string
          metadata?: Json | null
          metrics?: Json | null
          name?: string
          open_rate?: number | null
          persona_ids?: string[] | null
          predicted_segment_ids?: string[] | null
          preheader?: string | null
          preheader_text?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          send_blocked_reason?: string | null
          send_reasoning?: string | null
          sender_display_name?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          source_campaign_id?: string | null
          source_content_task_id?: string | null
          status?: string | null
          subject_line?: string | null
          synced_from?: string | null
          template_id?: string | null
          tenant_id?: string | null
          total_clicks?: number | null
          total_opens?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_from_email_domain_id_fkey"
            columns: ["from_email_domain_id"]
            isOneToOne: false
            referencedRelation: "deliverability_summary_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "crm_campaigns_from_email_domain_id_fkey"
            columns: ["from_email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domain_stats_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "crm_campaigns_from_email_domain_id_fkey"
            columns: ["from_email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "crm_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_source_content_task_id_fkey"
            columns: ["source_content_task_id"]
            isOneToOne: false
            referencedRelation: "content_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          avg_time_to_click_minutes: number | null
          avg_time_to_open_minutes: number | null
          city: string | null
          clover_customer_id: string | null
          clover_last_synced_at: string | null
          country_code: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string
          email_bounce_rate: number | null
          email_click_rate: number | null
          email_consent_ip: string | null
          email_consent_method: string | null
          email_consent_source: string | null
          email_ctor: number | null
          email_engagement_score: number | null
          email_open_rate: number | null
          email_opt_in: boolean | null
          email_opt_in_at: string | null
          email_opt_out_at: string | null
          first_name: string | null
          first_purchase_date: string | null
          footer_last_sent_at: string | null
          id: string
          is_vip: boolean
          last_email_bounced_at: string | null
          last_email_clicked_at: string | null
          last_email_delivered_at: string | null
          last_email_sent_at: string | null
          last_name: string | null
          last_open_at: string | null
          last_purchase_date: string | null
          lat: number | null
          lifetime_value: number | null
          lon: number | null
          opt_out: boolean | null
          order_history: Json | null
          persona: string | null
          persona_assignment_method: string | null
          persona_confidence_score: number | null
          persona_id: string | null
          phone: string | null
          pos_source: string | null
          postal_code: string | null
          preferred_channel: string | null
          product_tags: string[] | null
          signup_campaign: string | null
          signup_referrer_id: string | null
          signup_source: string | null
          sms_consent_ip: string | null
          sms_consent_method: string | null
          sms_consent_source: string | null
          sms_opt_in: boolean | null
          sms_opt_in_at: string | null
          sms_opt_out_at: string | null
          square_customer_id: string | null
          square_group_ids: string[] | null
          square_last_synced_at: string | null
          state_region: string | null
          store_id: string | null
          store_name: string | null
          suppressed: boolean
          suppressed_at: string | null
          suppressed_reason: string | null
          tags: string[] | null
          tenant_id: string | null
          timezone: string | null
          total_emails_bounced: number | null
          total_emails_clicked: number | null
          total_emails_delivered: number | null
          total_emails_opened: number | null
          total_emails_sent: number | null
          total_hard_bounces: number | null
          total_soft_bounces: number | null
          total_spent: number | null
          total_unsubscribes: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_time_to_click_minutes?: number | null
          avg_time_to_open_minutes?: number | null
          city?: string | null
          clover_customer_id?: string | null
          clover_last_synced_at?: string | null
          country_code?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email: string
          email_bounce_rate?: number | null
          email_click_rate?: number | null
          email_consent_ip?: string | null
          email_consent_method?: string | null
          email_consent_source?: string | null
          email_ctor?: number | null
          email_engagement_score?: number | null
          email_open_rate?: number | null
          email_opt_in?: boolean | null
          email_opt_in_at?: string | null
          email_opt_out_at?: string | null
          first_name?: string | null
          first_purchase_date?: string | null
          footer_last_sent_at?: string | null
          id?: string
          is_vip?: boolean
          last_email_bounced_at?: string | null
          last_email_clicked_at?: string | null
          last_email_delivered_at?: string | null
          last_email_sent_at?: string | null
          last_name?: string | null
          last_open_at?: string | null
          last_purchase_date?: string | null
          lat?: number | null
          lifetime_value?: number | null
          lon?: number | null
          opt_out?: boolean | null
          order_history?: Json | null
          persona?: string | null
          persona_assignment_method?: string | null
          persona_confidence_score?: number | null
          persona_id?: string | null
          phone?: string | null
          pos_source?: string | null
          postal_code?: string | null
          preferred_channel?: string | null
          product_tags?: string[] | null
          signup_campaign?: string | null
          signup_referrer_id?: string | null
          signup_source?: string | null
          sms_consent_ip?: string | null
          sms_consent_method?: string | null
          sms_consent_source?: string | null
          sms_opt_in?: boolean | null
          sms_opt_in_at?: string | null
          sms_opt_out_at?: string | null
          square_customer_id?: string | null
          square_group_ids?: string[] | null
          square_last_synced_at?: string | null
          state_region?: string | null
          store_id?: string | null
          store_name?: string | null
          suppressed?: boolean
          suppressed_at?: string | null
          suppressed_reason?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          timezone?: string | null
          total_emails_bounced?: number | null
          total_emails_clicked?: number | null
          total_emails_delivered?: number | null
          total_emails_opened?: number | null
          total_emails_sent?: number | null
          total_hard_bounces?: number | null
          total_soft_bounces?: number | null
          total_spent?: number | null
          total_unsubscribes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_time_to_click_minutes?: number | null
          avg_time_to_open_minutes?: number | null
          city?: string | null
          clover_customer_id?: string | null
          clover_last_synced_at?: string | null
          country_code?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string
          email_bounce_rate?: number | null
          email_click_rate?: number | null
          email_consent_ip?: string | null
          email_consent_method?: string | null
          email_consent_source?: string | null
          email_ctor?: number | null
          email_engagement_score?: number | null
          email_open_rate?: number | null
          email_opt_in?: boolean | null
          email_opt_in_at?: string | null
          email_opt_out_at?: string | null
          first_name?: string | null
          first_purchase_date?: string | null
          footer_last_sent_at?: string | null
          id?: string
          is_vip?: boolean
          last_email_bounced_at?: string | null
          last_email_clicked_at?: string | null
          last_email_delivered_at?: string | null
          last_email_sent_at?: string | null
          last_name?: string | null
          last_open_at?: string | null
          last_purchase_date?: string | null
          lat?: number | null
          lifetime_value?: number | null
          lon?: number | null
          opt_out?: boolean | null
          order_history?: Json | null
          persona?: string | null
          persona_assignment_method?: string | null
          persona_confidence_score?: number | null
          persona_id?: string | null
          phone?: string | null
          pos_source?: string | null
          postal_code?: string | null
          preferred_channel?: string | null
          product_tags?: string[] | null
          signup_campaign?: string | null
          signup_referrer_id?: string | null
          signup_source?: string | null
          sms_consent_ip?: string | null
          sms_consent_method?: string | null
          sms_consent_source?: string | null
          sms_opt_in?: boolean | null
          sms_opt_in_at?: string | null
          sms_opt_out_at?: string | null
          square_customer_id?: string | null
          square_group_ids?: string[] | null
          square_last_synced_at?: string | null
          state_region?: string | null
          store_id?: string | null
          store_name?: string | null
          suppressed?: boolean
          suppressed_at?: string | null
          suppressed_reason?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          timezone?: string | null
          total_emails_bounced?: number | null
          total_emails_clicked?: number | null
          total_emails_delivered?: number | null
          total_emails_opened?: number | null
          total_emails_sent?: number | null
          total_hard_bounces?: number | null
          total_soft_bounces?: number | null
          total_spent?: number | null
          total_unsubscribes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_customers_signup_referrer_id_fkey"
            columns: ["signup_referrer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_customers_signup_referrer_id_fkey"
            columns: ["signup_referrer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_email_consent_events: {
        Row: {
          created_at: string
          customer_id: string
          email: string
          event_type: string
          id: string
          ip_address: string | null
          source: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          email: string
          event_type: string
          id?: string
          ip_address?: string | null
          source: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          source?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_email_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_consent_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_email_consent_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_email_preference_tokens: {
        Row: {
          created_at: string
          customer_id: string
          email: string
          expires_at: string
          id: string
          purpose: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email: string
          expires_at: string
          id?: string
          purpose?: string
          tenant_id: string
          token: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_email_preference_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_preference_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_preference_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_email_preference_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_email_sends: {
        Row: {
          campaign_id: string | null
          clicked_at: string | null
          created_at: string | null
          customer_id: string | null
          email: string
          id: string
          opened_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          email: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_sends_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_email_sends_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_message_logs: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          message_type: string
          metadata: Json | null
          outbox_id: string | null
          recipient: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_type: string
          metadata?: Json | null
          outbox_id?: string | null
          recipient: string
          status: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          outbox_id?: string | null
          recipient?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_message_logs_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "crm_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_outbox: {
        Row: {
          automation_id: string | null
          automation_run_id: string | null
          content: string
          created_at: string | null
          customer_id: string
          error_message: string | null
          id: string
          locked_by: string | null
          locked_until: string | null
          max_retries: number | null
          message_type: string
          priority: number | null
          recipient: string
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          step_index: number | null
          subject: string | null
          template_data: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          automation_id?: string | null
          automation_run_id?: string | null
          content: string
          created_at?: string | null
          customer_id: string
          error_message?: string | null
          id?: string
          locked_by?: string | null
          locked_until?: string | null
          max_retries?: number | null
          message_type: string
          priority?: number | null
          recipient: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          step_index?: number | null
          subject?: string | null
          template_data?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          automation_id?: string | null
          automation_run_id?: string | null
          content?: string
          created_at?: string | null
          customer_id?: string
          error_message?: string | null
          id?: string
          locked_by?: string | null
          locked_until?: string | null
          max_retries?: number | null
          message_type?: string
          priority?: number | null
          recipient?: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          step_index?: number | null
          subject?: string | null
          template_data?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_outbox_automation_run_id_fkey"
            columns: ["automation_run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_persona_campaign_templates: {
        Row: {
          ai_prompt_context: string | null
          campaign_type: string | null
          created_at: string | null
          description: string | null
          id: string
          persona_id: string | null
          season: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          ai_prompt_context?: string | null
          campaign_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          persona_id?: string | null
          season?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          ai_prompt_context?: string | null
          campaign_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          persona_id?: string | null
          season?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_persona_campaign_templates_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_personas: {
        Row: {
          created_at: string
          id: string
          is_custom: boolean
          persona_description: string | null
          persona_name: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_custom?: boolean
          persona_description?: string | null
          persona_name: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_custom?: boolean
          persona_description?: string | null
          persona_name?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_segments: {
        Row: {
          auto_update: boolean | null
          conditions: Json | null
          created_at: string | null
          customer_count: number | null
          description: string | null
          id: string
          name: string
          persona_id: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_update?: boolean | null
          conditions?: Json | null
          created_at?: string | null
          customer_count?: number | null
          description?: string | null
          id?: string
          name: string
          persona_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_update?: boolean | null
          conditions?: Json | null
          created_at?: string | null
          customer_count?: number | null
          description?: string | null
          id?: string
          name?: string
          persona_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_segments_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sms_campaigns: {
        Row: {
          created_at: string
          enqueue_claimed_at: string | null
          enqueue_claimed_by: string | null
          enqueue_completed_at: string | null
          enqueue_cursor_customer_id: string | null
          enqueue_started_at: string | null
          enqueue_status: string
          enqueued: boolean
          from_phone: string | null
          id: string
          image_url: string | null
          media_urls: Json | null
          message: string
          metrics: Json | null
          name: string
          priority_mode: string
          scheduled_at: string | null
          segment_id: string | null
          sending_identity_id: string | null
          sent_at: string | null
          status: string
          targeting_logic: string | null
          targeting_persona_ids: string[] | null
          targeting_persona_names: string[] | null
          tenant_id: string | null
          total_enqueued: number | null
          total_recipients_estimate: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enqueue_claimed_at?: string | null
          enqueue_claimed_by?: string | null
          enqueue_completed_at?: string | null
          enqueue_cursor_customer_id?: string | null
          enqueue_started_at?: string | null
          enqueue_status?: string
          enqueued?: boolean
          from_phone?: string | null
          id?: string
          image_url?: string | null
          media_urls?: Json | null
          message: string
          metrics?: Json | null
          name: string
          priority_mode?: string
          scheduled_at?: string | null
          segment_id?: string | null
          sending_identity_id?: string | null
          sent_at?: string | null
          status?: string
          targeting_logic?: string | null
          targeting_persona_ids?: string[] | null
          targeting_persona_names?: string[] | null
          tenant_id?: string | null
          total_enqueued?: number | null
          total_recipients_estimate?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enqueue_claimed_at?: string | null
          enqueue_claimed_by?: string | null
          enqueue_completed_at?: string | null
          enqueue_cursor_customer_id?: string | null
          enqueue_started_at?: string | null
          enqueue_status?: string
          enqueued?: boolean
          from_phone?: string | null
          id?: string
          image_url?: string | null
          media_urls?: Json | null
          message?: string
          metrics?: Json | null
          name?: string
          priority_mode?: string
          scheduled_at?: string | null
          segment_id?: string | null
          sending_identity_id?: string | null
          sent_at?: string | null
          status?: string
          targeting_logic?: string | null
          targeting_persona_ids?: string[] | null
          targeting_persona_names?: string[] | null
          tenant_id?: string | null
          total_enqueued?: number | null
          total_recipients_estimate?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sms_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "crm_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sms_consent_events: {
        Row: {
          created_at: string
          customer_id: string
          event_type: string
          id: string
          ip_address: string | null
          phone: string
          source: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          event_type: string
          id?: string
          ip_address?: string | null
          phone: string
          source: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          phone?: string
          source?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sms_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sms_consent_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sms_consent_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_sms_consent_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_subscriptions: {
        Row: {
          created_at: string | null
          customer_id: string | null
          email: string
          id: string
          opt_out: boolean | null
          opt_out_at: string | null
          source: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          email: string
          id?: string
          opt_out?: boolean | null
          opt_out_at?: string | null
          source?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          email?: string
          id?: string
          opt_out?: boolean | null
          opt_out_at?: string | null
          source?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crm_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_segments: {
        Row: {
          created_at: string
          customer_count: number | null
          filters: Json
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_count?: number | null
          filters?: Json
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_count?: number | null
          filters?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_additional_fields: {
        Row: {
          created_at: string
          customer_id: string
          field_name: string
          field_type: string | null
          field_value: string | null
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          field_name: string
          field_type?: string | null
          field_value?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          field_name?: string
          field_type?: string | null
          field_value?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_additional_fields_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_additional_fields_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ai_insights: {
        Row: {
          behavioral_patterns: Json | null
          completion_tokens: number | null
          created_at: string | null
          customer_id: string
          expires_at: string | null
          generated_at: string | null
          has_sufficient_data: boolean | null
          id: string
          key_insight: string
          model_used: string | null
          prompt_tokens: number | null
          recommended_actions: Json | null
          tenant_id: string
        }
        Insert: {
          behavioral_patterns?: Json | null
          completion_tokens?: number | null
          created_at?: string | null
          customer_id: string
          expires_at?: string | null
          generated_at?: string | null
          has_sufficient_data?: boolean | null
          id?: string
          key_insight: string
          model_used?: string | null
          prompt_tokens?: number | null
          recommended_actions?: Json | null
          tenant_id: string
        }
        Update: {
          behavioral_patterns?: Json | null
          completion_tokens?: number | null
          created_at?: string | null
          customer_id?: string
          expires_at?: string | null
          generated_at?: string | null
          has_sufficient_data?: boolean | null
          id?: string
          key_insight?: string
          model_used?: string | null
          prompt_tokens?: number | null
          recommended_actions?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ai_insights_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ai_insights_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consents: {
        Row: {
          channel: string
          consent_timestamp: string
          created_at: string | null
          customer_id: string
          id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          channel: string
          consent_timestamp: string
          created_at?: string | null
          customer_id: string
          id?: string
          status: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          consent_timestamp?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_content_intent_metrics: {
        Row: {
          avg_blocks_viewed_per_message: number | null
          avg_ctas_viewed_before_click: number | null
          avg_messages_engaged_per_session: number | null
          best_performing_content_category: string | null
          block_engagement_breakdown: Json | null
          brand_story_avg_read_time_seconds: number | null
          brand_story_emails_opened: number | null
          brand_story_emails_sent: number | null
          brand_story_open_rate: number | null
          click_pattern_consistency_score: number | null
          click_timing_pattern: string | null
          clicks_after_scrolling: number | null
          clicks_on_first_cta: number | null
          consistent_click_position: string | null
          content_preference: string | null
          created_at: string | null
          cta_click_rate: number | null
          cta_clicks_last_30d: number | null
          cta_clicks_last_7d: number | null
          cta_interaction_frequency: number | null
          customer_id: string
          depth_ratio: number | null
          edu_promo_ratio: number | null
          educational_messages_engaged: number | null
          educational_messages_received: number | null
          educational_response_rate: number | null
          engagement_depth_score: number | null
          id: string
          intent_level: string | null
          intent_score: number | null
          intent_score_components: Json | null
          intent_trend: string | null
          last_intent_signal_at: string | null
          message_relevance_score: number | null
          most_clicked_cta_type: string | null
          multi_content_sessions: number | null
          offer_engagement_rate: number | null
          peak_engagement_day: string | null
          peak_engagement_hour: number | null
          preferred_content_type: string | null
          promotional_messages_engaged: number | null
          promotional_messages_received: number | null
          promotional_response_rate: number | null
          quick_open_rate: number | null
          relevance_feedback_score: number | null
          single_content_sessions: number | null
          story_engagement_rate: number | null
          tenant_id: string
          top_performing_block_types: string[] | null
          total_click_sessions: number | null
          total_ctas_clicked: number | null
          total_ctas_viewed: number | null
          total_delayed_opens: number | null
          total_messages_opened: number | null
          total_messages_read_deeply: number | null
          total_messages_received: number | null
          total_offer_clicks: number | null
          total_offer_views: number | null
          total_relevant_opens: number | null
          total_spam_reports: number | null
          total_story_clicks: number | null
          total_story_views: number | null
          total_unsubscribe_requests: number | null
          updated_at: string | null
          worst_performing_content_category: string | null
        }
        Insert: {
          avg_blocks_viewed_per_message?: number | null
          avg_ctas_viewed_before_click?: number | null
          avg_messages_engaged_per_session?: number | null
          best_performing_content_category?: string | null
          block_engagement_breakdown?: Json | null
          brand_story_avg_read_time_seconds?: number | null
          brand_story_emails_opened?: number | null
          brand_story_emails_sent?: number | null
          brand_story_open_rate?: number | null
          click_pattern_consistency_score?: number | null
          click_timing_pattern?: string | null
          clicks_after_scrolling?: number | null
          clicks_on_first_cta?: number | null
          consistent_click_position?: string | null
          content_preference?: string | null
          created_at?: string | null
          cta_click_rate?: number | null
          cta_clicks_last_30d?: number | null
          cta_clicks_last_7d?: number | null
          cta_interaction_frequency?: number | null
          customer_id: string
          depth_ratio?: number | null
          edu_promo_ratio?: number | null
          educational_messages_engaged?: number | null
          educational_messages_received?: number | null
          educational_response_rate?: number | null
          engagement_depth_score?: number | null
          id?: string
          intent_level?: string | null
          intent_score?: number | null
          intent_score_components?: Json | null
          intent_trend?: string | null
          last_intent_signal_at?: string | null
          message_relevance_score?: number | null
          most_clicked_cta_type?: string | null
          multi_content_sessions?: number | null
          offer_engagement_rate?: number | null
          peak_engagement_day?: string | null
          peak_engagement_hour?: number | null
          preferred_content_type?: string | null
          promotional_messages_engaged?: number | null
          promotional_messages_received?: number | null
          promotional_response_rate?: number | null
          quick_open_rate?: number | null
          relevance_feedback_score?: number | null
          single_content_sessions?: number | null
          story_engagement_rate?: number | null
          tenant_id: string
          top_performing_block_types?: string[] | null
          total_click_sessions?: number | null
          total_ctas_clicked?: number | null
          total_ctas_viewed?: number | null
          total_delayed_opens?: number | null
          total_messages_opened?: number | null
          total_messages_read_deeply?: number | null
          total_messages_received?: number | null
          total_offer_clicks?: number | null
          total_offer_views?: number | null
          total_relevant_opens?: number | null
          total_spam_reports?: number | null
          total_story_clicks?: number | null
          total_story_views?: number | null
          total_unsubscribe_requests?: number | null
          updated_at?: string | null
          worst_performing_content_category?: string | null
        }
        Update: {
          avg_blocks_viewed_per_message?: number | null
          avg_ctas_viewed_before_click?: number | null
          avg_messages_engaged_per_session?: number | null
          best_performing_content_category?: string | null
          block_engagement_breakdown?: Json | null
          brand_story_avg_read_time_seconds?: number | null
          brand_story_emails_opened?: number | null
          brand_story_emails_sent?: number | null
          brand_story_open_rate?: number | null
          click_pattern_consistency_score?: number | null
          click_timing_pattern?: string | null
          clicks_after_scrolling?: number | null
          clicks_on_first_cta?: number | null
          consistent_click_position?: string | null
          content_preference?: string | null
          created_at?: string | null
          cta_click_rate?: number | null
          cta_clicks_last_30d?: number | null
          cta_clicks_last_7d?: number | null
          cta_interaction_frequency?: number | null
          customer_id?: string
          depth_ratio?: number | null
          edu_promo_ratio?: number | null
          educational_messages_engaged?: number | null
          educational_messages_received?: number | null
          educational_response_rate?: number | null
          engagement_depth_score?: number | null
          id?: string
          intent_level?: string | null
          intent_score?: number | null
          intent_score_components?: Json | null
          intent_trend?: string | null
          last_intent_signal_at?: string | null
          message_relevance_score?: number | null
          most_clicked_cta_type?: string | null
          multi_content_sessions?: number | null
          offer_engagement_rate?: number | null
          peak_engagement_day?: string | null
          peak_engagement_hour?: number | null
          preferred_content_type?: string | null
          promotional_messages_engaged?: number | null
          promotional_messages_received?: number | null
          promotional_response_rate?: number | null
          quick_open_rate?: number | null
          relevance_feedback_score?: number | null
          single_content_sessions?: number | null
          story_engagement_rate?: number | null
          tenant_id?: string
          top_performing_block_types?: string[] | null
          total_click_sessions?: number | null
          total_ctas_clicked?: number | null
          total_ctas_viewed?: number | null
          total_delayed_opens?: number | null
          total_messages_opened?: number | null
          total_messages_read_deeply?: number | null
          total_messages_received?: number | null
          total_offer_clicks?: number | null
          total_offer_views?: number | null
          total_relevant_opens?: number | null
          total_spam_reports?: number | null
          total_story_clicks?: number | null
          total_story_views?: number | null
          total_unsubscribe_requests?: number | null
          updated_at?: string | null
          worst_performing_content_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_content_intent_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_content_intent_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_content_intent_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_content_intent_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_cross_channel_metrics: {
        Row: {
          created_at: string | null
          customer_id: string
          days_since_last_engagement: number | null
          email_fatigue_score: number | null
          email_interactions_30d: number | null
          email_interactions_7d: number | null
          email_messages_received_7d: number | null
          fatigue_status: string | null
          id: string
          last_engaged_channel: string | null
          last_engagement_at: string | null
          multi_channel_score: number | null
          preferred_channel: string | null
          sms_fatigue_score: number | null
          sms_interactions_30d: number | null
          sms_interactions_7d: number | null
          sms_messages_received_7d: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          days_since_last_engagement?: number | null
          email_fatigue_score?: number | null
          email_interactions_30d?: number | null
          email_interactions_7d?: number | null
          email_messages_received_7d?: number | null
          fatigue_status?: string | null
          id?: string
          last_engaged_channel?: string | null
          last_engagement_at?: string | null
          multi_channel_score?: number | null
          preferred_channel?: string | null
          sms_fatigue_score?: number | null
          sms_interactions_30d?: number | null
          sms_interactions_7d?: number | null
          sms_messages_received_7d?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          days_since_last_engagement?: number | null
          email_fatigue_score?: number | null
          email_interactions_30d?: number | null
          email_interactions_7d?: number | null
          email_messages_received_7d?: number | null
          fatigue_status?: string | null
          id?: string
          last_engaged_channel?: string | null
          last_engagement_at?: string | null
          multi_channel_score?: number | null
          preferred_channel?: string | null
          sms_fatigue_score?: number | null
          sms_interactions_30d?: number | null
          sms_interactions_7d?: number | null
          sms_messages_received_7d?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_cross_channel_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cross_channel_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cross_channel_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_cross_channel_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_email_metrics: {
        Row: {
          avg_time_to_click_minutes: number | null
          avg_time_to_open_minutes: number | null
          bounce_rate: number | null
          click_rate: number | null
          created_at: string | null
          ctor: number | null
          customer_id: string
          engagement_score: number | null
          hard_bounces: number | null
          id: string
          last_bounced_at: string | null
          last_clicked_at: string | null
          last_delivered_at: string | null
          last_opened_at: string | null
          last_sent_at: string | null
          open_rate: number | null
          soft_bounces: number | null
          tenant_id: string
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_opened: number | null
          total_sent: number | null
          total_unsubscribes: number | null
          updated_at: string | null
        }
        Insert: {
          avg_time_to_click_minutes?: number | null
          avg_time_to_open_minutes?: number | null
          bounce_rate?: number | null
          click_rate?: number | null
          created_at?: string | null
          ctor?: number | null
          customer_id: string
          engagement_score?: number | null
          hard_bounces?: number | null
          id?: string
          last_bounced_at?: string | null
          last_clicked_at?: string | null
          last_delivered_at?: string | null
          last_opened_at?: string | null
          last_sent_at?: string | null
          open_rate?: number | null
          soft_bounces?: number | null
          tenant_id: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_unsubscribes?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_time_to_click_minutes?: number | null
          avg_time_to_open_minutes?: number | null
          bounce_rate?: number | null
          click_rate?: number | null
          created_at?: string | null
          ctor?: number | null
          customer_id?: string
          engagement_score?: number | null
          hard_bounces?: number | null
          id?: string
          last_bounced_at?: string | null
          last_clicked_at?: string | null
          last_delivered_at?: string | null
          last_opened_at?: string | null
          last_sent_at?: string | null
          open_rate?: number | null
          soft_bounces?: number | null
          tenant_id?: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_opened?: number | null
          total_sent?: number | null
          total_unsubscribes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_email_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_email_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_email_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_email_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_engagement_summary: {
        Row: {
          created_at: string | null
          customer_id: string
          email_score: number | null
          engagement_tier: string | null
          id: string
          last_calculated_at: string | null
          last_engagement_at: string | null
          overall_engagement_score: number | null
          purchase_score: number | null
          sms_score: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email_score?: number | null
          engagement_tier?: string | null
          id?: string
          last_calculated_at?: string | null
          last_engagement_at?: string | null
          overall_engagement_score?: number | null
          purchase_score?: number | null
          sms_score?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email_score?: number | null
          engagement_tier?: string | null
          id?: string
          last_calculated_at?: string | null
          last_engagement_at?: string | null
          overall_engagement_score?: number | null
          purchase_score?: number | null
          sms_score?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_engagement_summary_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_engagement_summary_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_engagement_summary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_engagement_summary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_identity_metrics: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string | null
          customer_id: string
          id: string
          lat: number | null
          lon: number | null
          postal_code: string | null
          preferred_channel: string | null
          signup_campaign: string | null
          signup_referrer_id: string | null
          signup_source: string | null
          state_region: string | null
          store_id: string | null
          store_name: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          lat?: number | null
          lon?: number | null
          postal_code?: string | null
          preferred_channel?: string | null
          signup_campaign?: string | null
          signup_referrer_id?: string | null
          signup_source?: string | null
          state_region?: string | null
          store_id?: string | null
          store_name?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          lat?: number | null
          lon?: number | null
          postal_code?: string | null
          preferred_channel?: string | null
          signup_campaign?: string | null
          signup_referrer_id?: string | null
          signup_source?: string | null
          state_region?: string | null
          store_id?: string | null
          store_name?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_identity_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identity_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identity_metrics_signup_referrer_id_fkey"
            columns: ["signup_referrer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identity_metrics_signup_referrer_id_fkey"
            columns: ["signup_referrer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identity_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_identity_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_lifecycle_events: {
        Row: {
          churn_risk_score_at_event: number | null
          created_at: string | null
          customer_id: string
          days_since_last_engagement_at_event: number | null
          days_since_last_purchase_at_event: number | null
          event_type: string
          from_stage: string | null
          id: string
          tenant_id: string
          to_stage: string | null
          trigger_reason: string | null
          trigger_source: string | null
          trigger_source_id: string | null
        }
        Insert: {
          churn_risk_score_at_event?: number | null
          created_at?: string | null
          customer_id: string
          days_since_last_engagement_at_event?: number | null
          days_since_last_purchase_at_event?: number | null
          event_type: string
          from_stage?: string | null
          id?: string
          tenant_id: string
          to_stage?: string | null
          trigger_reason?: string | null
          trigger_source?: string | null
          trigger_source_id?: string | null
        }
        Update: {
          churn_risk_score_at_event?: number | null
          created_at?: string | null
          customer_id?: string
          days_since_last_engagement_at_event?: number | null
          days_since_last_purchase_at_event?: number | null
          event_type?: string
          from_stage?: string | null
          id?: string
          tenant_id?: string
          to_stage?: string | null
          trigger_reason?: string | null
          trigger_source?: string | null
          trigger_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycle_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_lifecycle_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_lifecycle_metrics: {
        Row: {
          automations_received_last_30d: number | null
          avg_time_to_reactivation_days: number | null
          churn_risk_score: number | null
          churned_at: string | null
          created_at: string | null
          customer_created_at: string | null
          customer_id: string
          days_in_current_stage: number | null
          days_since_last_automation: number | null
          days_since_last_engagement: number | null
          days_since_last_purchase: number | null
          days_since_signup: number | null
          engagement_velocity: number | null
          engagements_last_30d: number | null
          engagements_last_90d: number | null
          first_purchase_at: string | null
          id: string
          is_churned: boolean | null
          is_reactivated: boolean | null
          last_any_engagement_at: string | null
          last_automation_received_at: string | null
          last_email_engagement_at: string | null
          last_purchase_at: string | null
          last_reactivation_trigger: string | null
          last_sms_engagement_at: string | null
          lifecycle_health_score: number | null
          lifecycle_stage: string
          lifecycle_stage_changed_at: string | null
          predicted_churn_date: string | null
          previous_lifecycle_stage: string | null
          purchase_velocity: number | null
          purchases_last_30d: number | null
          purchases_last_90d: number | null
          reactivated_at: string | null
          reactivation_count: number | null
          reactivation_success_rate: number | null
          retention_probability: number | null
          successful_reactivations: number | null
          tenant_id: string
          time_to_churn_days: number | null
          time_to_reactivation_days: number | null
          total_churn_events: number | null
          updated_at: string | null
        }
        Insert: {
          automations_received_last_30d?: number | null
          avg_time_to_reactivation_days?: number | null
          churn_risk_score?: number | null
          churned_at?: string | null
          created_at?: string | null
          customer_created_at?: string | null
          customer_id: string
          days_in_current_stage?: number | null
          days_since_last_automation?: number | null
          days_since_last_engagement?: number | null
          days_since_last_purchase?: number | null
          days_since_signup?: number | null
          engagement_velocity?: number | null
          engagements_last_30d?: number | null
          engagements_last_90d?: number | null
          first_purchase_at?: string | null
          id?: string
          is_churned?: boolean | null
          is_reactivated?: boolean | null
          last_any_engagement_at?: string | null
          last_automation_received_at?: string | null
          last_email_engagement_at?: string | null
          last_purchase_at?: string | null
          last_reactivation_trigger?: string | null
          last_sms_engagement_at?: string | null
          lifecycle_health_score?: number | null
          lifecycle_stage?: string
          lifecycle_stage_changed_at?: string | null
          predicted_churn_date?: string | null
          previous_lifecycle_stage?: string | null
          purchase_velocity?: number | null
          purchases_last_30d?: number | null
          purchases_last_90d?: number | null
          reactivated_at?: string | null
          reactivation_count?: number | null
          reactivation_success_rate?: number | null
          retention_probability?: number | null
          successful_reactivations?: number | null
          tenant_id: string
          time_to_churn_days?: number | null
          time_to_reactivation_days?: number | null
          total_churn_events?: number | null
          updated_at?: string | null
        }
        Update: {
          automations_received_last_30d?: number | null
          avg_time_to_reactivation_days?: number | null
          churn_risk_score?: number | null
          churned_at?: string | null
          created_at?: string | null
          customer_created_at?: string | null
          customer_id?: string
          days_in_current_stage?: number | null
          days_since_last_automation?: number | null
          days_since_last_engagement?: number | null
          days_since_last_purchase?: number | null
          days_since_signup?: number | null
          engagement_velocity?: number | null
          engagements_last_30d?: number | null
          engagements_last_90d?: number | null
          first_purchase_at?: string | null
          id?: string
          is_churned?: boolean | null
          is_reactivated?: boolean | null
          last_any_engagement_at?: string | null
          last_automation_received_at?: string | null
          last_email_engagement_at?: string | null
          last_purchase_at?: string | null
          last_reactivation_trigger?: string | null
          last_sms_engagement_at?: string | null
          lifecycle_health_score?: number | null
          lifecycle_stage?: string
          lifecycle_stage_changed_at?: string | null
          predicted_churn_date?: string | null
          previous_lifecycle_stage?: string | null
          purchase_velocity?: number | null
          purchases_last_30d?: number | null
          purchases_last_90d?: number | null
          reactivated_at?: string | null
          reactivation_count?: number | null
          reactivation_success_rate?: number | null
          retention_probability?: number | null
          successful_reactivations?: number | null
          tenant_id?: string
          time_to_churn_days?: number | null
          time_to_reactivation_days?: number | null
          total_churn_events?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycle_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_lifecycle_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty_metrics: {
        Row: {
          avg_order_value_with_perks: number | null
          avg_order_value_without_perks: number | null
          avg_redemption_delay_days: number | null
          created_at: string | null
          current_loyalty_tier: string | null
          current_points_balance: number | null
          customer_created_at: string | null
          customer_id: string
          id: string
          is_perks_member: boolean | null
          last_redemption_at: string | null
          loyalty_engagement_score: number | null
          loyalty_risk_score: number | null
          max_redemption_delay_days: number | null
          member_email_open_rate: number | null
          member_engagement_score: number | null
          member_purchase_frequency: number | null
          member_sms_click_rate: number | null
          min_redemption_delay_days: number | null
          non_redeemed_points_ratio: number | null
          perks_enrolled_at: string | null
          perks_revenue_percentage: number | null
          previous_loyalty_tier: string | null
          redemption_frequency: number | null
          tenant_id: string
          tier_progression_speed_days: number | null
          tier_upgrade_count: number | null
          tier_upgraded_at: string | null
          time_to_join_perks_days: number | null
          total_non_perks_revenue: number | null
          total_perks_driven_revenue: number | null
          total_points_earned: number | null
          total_points_redeemed: number | null
          total_redemptions: number | null
          updated_at: string | null
        }
        Insert: {
          avg_order_value_with_perks?: number | null
          avg_order_value_without_perks?: number | null
          avg_redemption_delay_days?: number | null
          created_at?: string | null
          current_loyalty_tier?: string | null
          current_points_balance?: number | null
          customer_created_at?: string | null
          customer_id: string
          id?: string
          is_perks_member?: boolean | null
          last_redemption_at?: string | null
          loyalty_engagement_score?: number | null
          loyalty_risk_score?: number | null
          max_redemption_delay_days?: number | null
          member_email_open_rate?: number | null
          member_engagement_score?: number | null
          member_purchase_frequency?: number | null
          member_sms_click_rate?: number | null
          min_redemption_delay_days?: number | null
          non_redeemed_points_ratio?: number | null
          perks_enrolled_at?: string | null
          perks_revenue_percentage?: number | null
          previous_loyalty_tier?: string | null
          redemption_frequency?: number | null
          tenant_id: string
          tier_progression_speed_days?: number | null
          tier_upgrade_count?: number | null
          tier_upgraded_at?: string | null
          time_to_join_perks_days?: number | null
          total_non_perks_revenue?: number | null
          total_perks_driven_revenue?: number | null
          total_points_earned?: number | null
          total_points_redeemed?: number | null
          total_redemptions?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_order_value_with_perks?: number | null
          avg_order_value_without_perks?: number | null
          avg_redemption_delay_days?: number | null
          created_at?: string | null
          current_loyalty_tier?: string | null
          current_points_balance?: number | null
          customer_created_at?: string | null
          customer_id?: string
          id?: string
          is_perks_member?: boolean | null
          last_redemption_at?: string | null
          loyalty_engagement_score?: number | null
          loyalty_risk_score?: number | null
          max_redemption_delay_days?: number | null
          member_email_open_rate?: number | null
          member_engagement_score?: number | null
          member_purchase_frequency?: number | null
          member_sms_click_rate?: number | null
          min_redemption_delay_days?: number | null
          non_redeemed_points_ratio?: number | null
          perks_enrolled_at?: string | null
          perks_revenue_percentage?: number | null
          previous_loyalty_tier?: string | null
          redemption_frequency?: number | null
          tenant_id?: string
          tier_progression_speed_days?: number | null
          tier_upgrade_count?: number | null
          tier_upgraded_at?: string | null
          time_to_join_perks_days?: number | null
          total_non_perks_revenue?: number | null
          total_perks_driven_revenue?: number | null
          total_points_earned?: number | null
          total_points_redeemed?: number | null
          total_redemptions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_loyalty_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_personas: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          persona_id: string | null
          predefined_persona_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          persona_id?: string | null
          predefined_persona_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          persona_id?: string | null
          predefined_persona_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_personas_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_personas_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_post_purchase_metrics: {
        Row: {
          automation_conversion_rate: number | null
          avg_time_to_next_purchase_days: number | null
          coupon_usage_frequency: number | null
          created_at: string | null
          customer_id: string
          days_since_last_incentive_redemption: number | null
          drop_off_after_incentive_rate: number | null
          id: string
          incentive_dependency_score: number | null
          incentive_effectiveness_score: number | null
          incentive_redemption_rate: number | null
          incentives_expired_unused: number | null
          last_automation_purchase_at: string | null
          last_time_to_next_purchase_days: number | null
          max_time_to_next_purchase_days: number | null
          min_time_to_next_purchase_days: number | null
          post_purchase_email_ctr: number | null
          post_purchase_email_open_rate: number | null
          post_purchase_emails_clicked: number | null
          post_purchase_emails_opened: number | null
          post_purchase_emails_sent: number | null
          post_purchase_engagement_score: number | null
          post_purchase_follow_up_ctr: number | null
          post_purchase_sms_clicked: number | null
          post_purchase_sms_delivered: number | null
          post_purchase_sms_sent: number | null
          purchases_after_automation: number | null
          purchases_with_incentive: number | null
          purchases_without_incentive: number | null
          tenant_id: string
          total_automation_messages: number | null
          total_coupon_value_redeemed: number | null
          total_incentives_offered: number | null
          total_incentives_redeemed: number | null
          unique_coupons_used: number | null
          updated_at: string | null
        }
        Insert: {
          automation_conversion_rate?: number | null
          avg_time_to_next_purchase_days?: number | null
          coupon_usage_frequency?: number | null
          created_at?: string | null
          customer_id: string
          days_since_last_incentive_redemption?: number | null
          drop_off_after_incentive_rate?: number | null
          id?: string
          incentive_dependency_score?: number | null
          incentive_effectiveness_score?: number | null
          incentive_redemption_rate?: number | null
          incentives_expired_unused?: number | null
          last_automation_purchase_at?: string | null
          last_time_to_next_purchase_days?: number | null
          max_time_to_next_purchase_days?: number | null
          min_time_to_next_purchase_days?: number | null
          post_purchase_email_ctr?: number | null
          post_purchase_email_open_rate?: number | null
          post_purchase_emails_clicked?: number | null
          post_purchase_emails_opened?: number | null
          post_purchase_emails_sent?: number | null
          post_purchase_engagement_score?: number | null
          post_purchase_follow_up_ctr?: number | null
          post_purchase_sms_clicked?: number | null
          post_purchase_sms_delivered?: number | null
          post_purchase_sms_sent?: number | null
          purchases_after_automation?: number | null
          purchases_with_incentive?: number | null
          purchases_without_incentive?: number | null
          tenant_id: string
          total_automation_messages?: number | null
          total_coupon_value_redeemed?: number | null
          total_incentives_offered?: number | null
          total_incentives_redeemed?: number | null
          unique_coupons_used?: number | null
          updated_at?: string | null
        }
        Update: {
          automation_conversion_rate?: number | null
          avg_time_to_next_purchase_days?: number | null
          coupon_usage_frequency?: number | null
          created_at?: string | null
          customer_id?: string
          days_since_last_incentive_redemption?: number | null
          drop_off_after_incentive_rate?: number | null
          id?: string
          incentive_dependency_score?: number | null
          incentive_effectiveness_score?: number | null
          incentive_redemption_rate?: number | null
          incentives_expired_unused?: number | null
          last_automation_purchase_at?: string | null
          last_time_to_next_purchase_days?: number | null
          max_time_to_next_purchase_days?: number | null
          min_time_to_next_purchase_days?: number | null
          post_purchase_email_ctr?: number | null
          post_purchase_email_open_rate?: number | null
          post_purchase_emails_clicked?: number | null
          post_purchase_emails_opened?: number | null
          post_purchase_emails_sent?: number | null
          post_purchase_engagement_score?: number | null
          post_purchase_follow_up_ctr?: number | null
          post_purchase_sms_clicked?: number | null
          post_purchase_sms_delivered?: number | null
          post_purchase_sms_sent?: number | null
          purchases_after_automation?: number | null
          purchases_with_incentive?: number | null
          purchases_without_incentive?: number | null
          tenant_id?: string
          total_automation_messages?: number | null
          total_coupon_value_redeemed?: number | null
          total_incentives_offered?: number | null
          total_incentives_redeemed?: number | null
          unique_coupons_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_post_purchase_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_post_purchase_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_post_purchase_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_post_purchase_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_purchase_metrics: {
        Row: {
          average_order_value: number | null
          avg_days_between_purchases: number | null
          created_at: string | null
          customer_id: string
          customer_tier: string | null
          days_since_last_purchase: number | null
          discount_driven_ratio: number | null
          favorite_products: string[] | null
          first_purchase_date: string | null
          id: string
          last_purchase_date: string | null
          lifetime_value: number | null
          max_days_between_purchases: number | null
          min_days_between_purchases: number | null
          peak_purchase_month: string | null
          product_category_affinity: Json | null
          purchase_engagement_score: number | null
          purchase_frequency: number | null
          purchase_velocity: number | null
          repeat_purchase_rate: number | null
          revenue_per_month: number | null
          seasonal_patterns: Json | null
          tenant_id: string
          top_product_categories: string[] | null
          total_discount_amount: number | null
          total_discounted_purchases: number | null
          total_full_price_purchases: number | null
          total_purchases: number | null
          updated_at: string | null
        }
        Insert: {
          average_order_value?: number | null
          avg_days_between_purchases?: number | null
          created_at?: string | null
          customer_id: string
          customer_tier?: string | null
          days_since_last_purchase?: number | null
          discount_driven_ratio?: number | null
          favorite_products?: string[] | null
          first_purchase_date?: string | null
          id?: string
          last_purchase_date?: string | null
          lifetime_value?: number | null
          max_days_between_purchases?: number | null
          min_days_between_purchases?: number | null
          peak_purchase_month?: string | null
          product_category_affinity?: Json | null
          purchase_engagement_score?: number | null
          purchase_frequency?: number | null
          purchase_velocity?: number | null
          repeat_purchase_rate?: number | null
          revenue_per_month?: number | null
          seasonal_patterns?: Json | null
          tenant_id: string
          top_product_categories?: string[] | null
          total_discount_amount?: number | null
          total_discounted_purchases?: number | null
          total_full_price_purchases?: number | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Update: {
          average_order_value?: number | null
          avg_days_between_purchases?: number | null
          created_at?: string | null
          customer_id?: string
          customer_tier?: string | null
          days_since_last_purchase?: number | null
          discount_driven_ratio?: number | null
          favorite_products?: string[] | null
          first_purchase_date?: string | null
          id?: string
          last_purchase_date?: string | null
          lifetime_value?: number | null
          max_days_between_purchases?: number | null
          min_days_between_purchases?: number | null
          peak_purchase_month?: string | null
          product_category_affinity?: Json | null
          purchase_engagement_score?: number | null
          purchase_frequency?: number | null
          purchase_velocity?: number | null
          repeat_purchase_rate?: number | null
          revenue_per_month?: number | null
          seasonal_patterns?: Json | null
          tenant_id?: string
          top_product_categories?: string[] | null
          total_discount_amount?: number | null
          total_discounted_purchases?: number | null
          total_full_price_purchases?: number | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchase_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchase_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchase_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_purchase_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_risk_signals: {
        Row: {
          auto_suppressed_at: string | null
          avg_ignore_streak_length: number | null
          avg_incentive_value_used: number | null
          avg_order_value_with_coupon: number | null
          avg_order_value_without_coupon: number | null
          bounce_categories: string[] | null
          bounce_risk_score: number | null
          churn_probability: number | null
          consecutive_coupon_purchases: number | null
          consecutive_hard_bounces: number | null
          coupon_dependency_risk_score: number | null
          coupon_only_ratio: number | null
          created_at: string | null
          current_ignore_streak: number | null
          customer_id: string
          days_since_first_message: number | null
          days_since_last_engagement: number | null
          days_since_last_purchase: number | null
          dormancy_duration_days: number | null
          dormancy_risk_score: number | null
          dormancy_start_date: string | null
          dormant_reactivation_attempts: number | null
          dormant_reactivation_responses: number | null
          email_opt_outs: number | null
          engagement_gap_risk_score: number | null
          engagement_gap_threshold: number | null
          first_hard_bounce_at: string | null
          hard_bounce_rate: number | null
          id: string
          ignore_streak_risk_score: number | null
          ignore_streak_started_at: string | null
          incentive_abuse_risk_score: number | null
          incentive_abuse_signals: Json | null
          incentives_shared: number | null
          incentives_stacked: number | null
          incentives_used_at_expiry: number | null
          is_coupon_dependent: boolean | null
          is_email_invalid: boolean | null
          is_ignoring_messages: boolean | null
          is_long_term_dormant: boolean | null
          is_no_engagement_alert: boolean | null
          is_rapid_opt_out: boolean | null
          is_sms_unreachable: boolean | null
          is_suspected_incentive_abuser: boolean | null
          last_engagement_at: string | null
          last_hard_bounce_at: string | null
          last_opt_out_at: string | null
          last_risk_assessment_at: string | null
          max_consecutive_coupon_purchases: number | null
          max_ignore_streak: number | null
          max_incentive_value_used: number | null
          messages_before_opt_out: number | null
          messages_since_last_engagement: number | null
          opt_out_risk_score: number | null
          opt_out_sources: string[] | null
          opt_out_speed_days: number | null
          overall_risk_score: number | null
          purchases_with_coupon: number | null
          purchases_without_coupon: number | null
          risk_factors: string[] | null
          risk_level: string | null
          risk_trend: string | null
          should_suppress: boolean | null
          sms_carrier_blocks: number | null
          sms_delivery_failures: number | null
          sms_invalid_number_flags: number | null
          sms_opt_outs: number | null
          sms_risk_score: number | null
          sms_spam_reports: number | null
          suppression_reason: string | null
          tenant_id: string
          total_hard_bounces: number | null
          total_incentives_used: number | null
          total_messages_engaged: number | null
          total_messages_ignored: number | null
          total_messages_sent: number | null
          total_opt_outs: number | null
          total_purchases: number | null
          total_soft_bounces: number | null
          updated_at: string | null
        }
        Insert: {
          auto_suppressed_at?: string | null
          avg_ignore_streak_length?: number | null
          avg_incentive_value_used?: number | null
          avg_order_value_with_coupon?: number | null
          avg_order_value_without_coupon?: number | null
          bounce_categories?: string[] | null
          bounce_risk_score?: number | null
          churn_probability?: number | null
          consecutive_coupon_purchases?: number | null
          consecutive_hard_bounces?: number | null
          coupon_dependency_risk_score?: number | null
          coupon_only_ratio?: number | null
          created_at?: string | null
          current_ignore_streak?: number | null
          customer_id: string
          days_since_first_message?: number | null
          days_since_last_engagement?: number | null
          days_since_last_purchase?: number | null
          dormancy_duration_days?: number | null
          dormancy_risk_score?: number | null
          dormancy_start_date?: string | null
          dormant_reactivation_attempts?: number | null
          dormant_reactivation_responses?: number | null
          email_opt_outs?: number | null
          engagement_gap_risk_score?: number | null
          engagement_gap_threshold?: number | null
          first_hard_bounce_at?: string | null
          hard_bounce_rate?: number | null
          id?: string
          ignore_streak_risk_score?: number | null
          ignore_streak_started_at?: string | null
          incentive_abuse_risk_score?: number | null
          incentive_abuse_signals?: Json | null
          incentives_shared?: number | null
          incentives_stacked?: number | null
          incentives_used_at_expiry?: number | null
          is_coupon_dependent?: boolean | null
          is_email_invalid?: boolean | null
          is_ignoring_messages?: boolean | null
          is_long_term_dormant?: boolean | null
          is_no_engagement_alert?: boolean | null
          is_rapid_opt_out?: boolean | null
          is_sms_unreachable?: boolean | null
          is_suspected_incentive_abuser?: boolean | null
          last_engagement_at?: string | null
          last_hard_bounce_at?: string | null
          last_opt_out_at?: string | null
          last_risk_assessment_at?: string | null
          max_consecutive_coupon_purchases?: number | null
          max_ignore_streak?: number | null
          max_incentive_value_used?: number | null
          messages_before_opt_out?: number | null
          messages_since_last_engagement?: number | null
          opt_out_risk_score?: number | null
          opt_out_sources?: string[] | null
          opt_out_speed_days?: number | null
          overall_risk_score?: number | null
          purchases_with_coupon?: number | null
          purchases_without_coupon?: number | null
          risk_factors?: string[] | null
          risk_level?: string | null
          risk_trend?: string | null
          should_suppress?: boolean | null
          sms_carrier_blocks?: number | null
          sms_delivery_failures?: number | null
          sms_invalid_number_flags?: number | null
          sms_opt_outs?: number | null
          sms_risk_score?: number | null
          sms_spam_reports?: number | null
          suppression_reason?: string | null
          tenant_id: string
          total_hard_bounces?: number | null
          total_incentives_used?: number | null
          total_messages_engaged?: number | null
          total_messages_ignored?: number | null
          total_messages_sent?: number | null
          total_opt_outs?: number | null
          total_purchases?: number | null
          total_soft_bounces?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_suppressed_at?: string | null
          avg_ignore_streak_length?: number | null
          avg_incentive_value_used?: number | null
          avg_order_value_with_coupon?: number | null
          avg_order_value_without_coupon?: number | null
          bounce_categories?: string[] | null
          bounce_risk_score?: number | null
          churn_probability?: number | null
          consecutive_coupon_purchases?: number | null
          consecutive_hard_bounces?: number | null
          coupon_dependency_risk_score?: number | null
          coupon_only_ratio?: number | null
          created_at?: string | null
          current_ignore_streak?: number | null
          customer_id?: string
          days_since_first_message?: number | null
          days_since_last_engagement?: number | null
          days_since_last_purchase?: number | null
          dormancy_duration_days?: number | null
          dormancy_risk_score?: number | null
          dormancy_start_date?: string | null
          dormant_reactivation_attempts?: number | null
          dormant_reactivation_responses?: number | null
          email_opt_outs?: number | null
          engagement_gap_risk_score?: number | null
          engagement_gap_threshold?: number | null
          first_hard_bounce_at?: string | null
          hard_bounce_rate?: number | null
          id?: string
          ignore_streak_risk_score?: number | null
          ignore_streak_started_at?: string | null
          incentive_abuse_risk_score?: number | null
          incentive_abuse_signals?: Json | null
          incentives_shared?: number | null
          incentives_stacked?: number | null
          incentives_used_at_expiry?: number | null
          is_coupon_dependent?: boolean | null
          is_email_invalid?: boolean | null
          is_ignoring_messages?: boolean | null
          is_long_term_dormant?: boolean | null
          is_no_engagement_alert?: boolean | null
          is_rapid_opt_out?: boolean | null
          is_sms_unreachable?: boolean | null
          is_suspected_incentive_abuser?: boolean | null
          last_engagement_at?: string | null
          last_hard_bounce_at?: string | null
          last_opt_out_at?: string | null
          last_risk_assessment_at?: string | null
          max_consecutive_coupon_purchases?: number | null
          max_ignore_streak?: number | null
          max_incentive_value_used?: number | null
          messages_before_opt_out?: number | null
          messages_since_last_engagement?: number | null
          opt_out_risk_score?: number | null
          opt_out_sources?: string[] | null
          opt_out_speed_days?: number | null
          overall_risk_score?: number | null
          purchases_with_coupon?: number | null
          purchases_without_coupon?: number | null
          risk_factors?: string[] | null
          risk_level?: string | null
          risk_trend?: string | null
          should_suppress?: boolean | null
          sms_carrier_blocks?: number | null
          sms_delivery_failures?: number | null
          sms_invalid_number_flags?: number | null
          sms_opt_outs?: number | null
          sms_risk_score?: number | null
          sms_spam_reports?: number | null
          suppression_reason?: string | null
          tenant_id?: string
          total_hard_bounces?: number | null
          total_incentives_used?: number | null
          total_messages_engaged?: number | null
          total_messages_ignored?: number | null
          total_messages_sent?: number | null
          total_opt_outs?: number | null
          total_purchases?: number | null
          total_soft_bounces?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_risk_signals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_risk_signals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_risk_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_risk_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          created_at: string
          customer_id: string
          id: string
          segment_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          segment_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_segments_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_segments_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sms_metrics: {
        Row: {
          avg_time_to_response_minutes: number | null
          click_rate: number | null
          created_at: string | null
          customer_id: string
          delivery_rate: number | null
          engagement_score: number | null
          id: string
          last_clicked_at: string | null
          last_delivered_at: string | null
          last_opt_out_at: string | null
          last_replied_at: string | null
          last_sent_at: string | null
          opt_out_rate: number | null
          reply_rate: number | null
          tenant_id: string
          total_clicked: number | null
          total_delivered: number | null
          total_failed: number | null
          total_opt_outs: number | null
          total_replied: number | null
          total_sent: number | null
          updated_at: string | null
        }
        Insert: {
          avg_time_to_response_minutes?: number | null
          click_rate?: number | null
          created_at?: string | null
          customer_id: string
          delivery_rate?: number | null
          engagement_score?: number | null
          id?: string
          last_clicked_at?: string | null
          last_delivered_at?: string | null
          last_opt_out_at?: string | null
          last_replied_at?: string | null
          last_sent_at?: string | null
          opt_out_rate?: number | null
          reply_rate?: number | null
          tenant_id: string
          total_clicked?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_opt_outs?: number | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_time_to_response_minutes?: number | null
          click_rate?: number | null
          created_at?: string | null
          customer_id?: string
          delivery_rate?: number | null
          engagement_score?: number | null
          id?: string
          last_clicked_at?: string | null
          last_delivered_at?: string | null
          last_opt_out_at?: string | null
          last_replied_at?: string | null
          last_sent_at?: string | null
          opt_out_rate?: number | null
          reply_rate?: number | null
          tenant_id?: string
          total_clicked?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_opt_outs?: number | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_sms_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sms_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sms_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_sms_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sources: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          imported_at: string
          source_id: string | null
          source_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          imported_at: string
          source_id?: string | null
          source_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          imported_at?: string
          source_id?: string | null
          source_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sources_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sources_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          contact_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_timeline: {
        Row: {
          activity_type: string
          campaign_id: string | null
          campaign_name: string | null
          created_at: string | null
          customer_id: string
          id: string
          metadata: Json | null
          product_name: string | null
          purchase_amount: number | null
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          metadata?: Json | null
          product_name?: string | null
          purchase_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          metadata?: Json | null
          product_name?: string | null
          purchase_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_timeline_events: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_id: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_id: string
          description?: string | null
          event_date: string
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_id?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_timeline_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_timeline_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          cancellation_requested_at: string | null
          created_at: string
          email_sent: boolean | null
          hard_delete_completed_at: string | null
          id: string
          requested_at: string
          scheduled_hard_delete_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_requested_at?: string | null
          created_at?: string
          email_sent?: boolean | null
          hard_delete_completed_at?: string | null
          id?: string
          requested_at?: string
          scheduled_hard_delete_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_requested_at?: string | null
          created_at?: string
          email_sent?: boolean | null
          hard_delete_completed_at?: string | null
          id?: string
          requested_at?: string
          scheduled_hard_delete_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          domain_id: string
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          domain_id: string
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          domain_id?: string
          id?: string
        }
        Relationships: []
      }
      domain_connect_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          domain_id: string
          expires_at: string
          id: string
          params: Json
          registrar_name: string | null
          session_token: string
          status: string
          template_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          domain_id: string
          expires_at?: string
          id?: string
          params?: Json
          registrar_name?: string | null
          session_token: string
          status?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          domain_id?: string
          expires_at?: string
          id?: string
          params?: Json
          registrar_name?: string | null
          session_token?: string
          status?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      domain_dns_records: {
        Row: {
          applied: boolean
          created_at: string
          desired: boolean
          domain_id: string
          error: string | null
          id: string
          last_checked_at: string | null
          name: string
          priority: number | null
          record_type: string
          ttl: number | null
          updated_at: string
          value: string
          verified: boolean
        }
        Insert: {
          applied?: boolean
          created_at?: string
          desired?: boolean
          domain_id: string
          error?: string | null
          id?: string
          last_checked_at?: string | null
          name: string
          priority?: number | null
          record_type: string
          ttl?: number | null
          updated_at?: string
          value: string
          verified?: boolean
        }
        Update: {
          applied?: boolean
          created_at?: string
          desired?: boolean
          domain_id?: string
          error?: string | null
          id?: string
          last_checked_at?: string | null
          name?: string
          priority?: number | null
          record_type?: string
          ttl?: number | null
          updated_at?: string
          value?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "domain_dns_records_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          created_at: string
          data: Json
          domain_id: string
          event_type: string
          id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          domain_id: string
          event_type: string
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          domain_id?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_health_checks: {
        Row: {
          check_type: string
          checked_at: string
          created_at: string
          details: Json
          domain_id: string
          id: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          created_at?: string
          details?: Json
          domain_id: string
          id?: string
          response_time_ms?: number | null
          status: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          created_at?: string
          details?: Json
          domain_id?: string
          id?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      domain_provider_integrations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          oauth_connected: boolean | null
          provider_config: Json
          provider_type: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          oauth_connected?: boolean | null
          provider_config?: Json
          provider_type: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          oauth_connected?: boolean | null
          provider_config?: Json
          provider_type?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      domain_send_log: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          daily_limit_at_send: number
          domain_id: string
          emails_sent: number
          id: string
          sent_at: string | null
          warmup_stage: number
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          daily_limit_at_send: number
          domain_id: string
          emails_sent?: number
          id?: string
          sent_at?: string | null
          warmup_stage: number
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          daily_limit_at_send?: number
          domain_id?: string
          emails_sent?: number
          id?: string
          sent_at?: string | null
          warmup_stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "domain_send_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_send_log_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "deliverability_summary_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "domain_send_log_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domain_stats_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "domain_send_log_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_setup_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          domain_id: string
          error_message: string | null
          id: string
          progress: number | null
          provider_integration_id: string | null
          records_to_create: Json
          results: Json | null
          setup_type: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          domain_id: string
          error_message?: string | null
          id?: string
          progress?: number | null
          provider_integration_id?: string | null
          records_to_create?: Json
          results?: Json | null
          setup_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          domain_id?: string
          error_message?: string | null
          id?: string
          progress?: number | null
          provider_integration_id?: string | null
          records_to_create?: Json
          results?: Json | null
          setup_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          acme_challenge_response: string | null
          acme_challenge_token: string | null
          acme_challenge_type: string | null
          auto_dns_enabled: boolean | null
          certificate_expires_at: string | null
          certificate_issued_at: string | null
          created_at: string
          desired_state: Json
          dns_provider: string | null
          dns_status: string
          domain: string
          domain_connect_supported: boolean | null
          domain_connect_template_id: string | null
          health_check_frequency: number | null
          id: string
          is_primary: boolean
          last_checked_at: string | null
          last_setup_at: string | null
          path_prefix: string | null
          provider_credentials: Json | null
          provider_type: string | null
          setup_type: string | null
          status: string
          tenant_id: string
          tls_status: string
          type: string
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          acme_challenge_response?: string | null
          acme_challenge_token?: string | null
          acme_challenge_type?: string | null
          auto_dns_enabled?: boolean | null
          certificate_expires_at?: string | null
          certificate_issued_at?: string | null
          created_at?: string
          desired_state?: Json
          dns_provider?: string | null
          dns_status?: string
          domain: string
          domain_connect_supported?: boolean | null
          domain_connect_template_id?: string | null
          health_check_frequency?: number | null
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_setup_at?: string | null
          path_prefix?: string | null
          provider_credentials?: Json | null
          provider_type?: string | null
          setup_type?: string | null
          status?: string
          tenant_id: string
          tls_status?: string
          type: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          acme_challenge_response?: string | null
          acme_challenge_token?: string | null
          acme_challenge_type?: string | null
          auto_dns_enabled?: boolean | null
          certificate_expires_at?: string | null
          certificate_issued_at?: string | null
          created_at?: string
          desired_state?: Json
          dns_provider?: string | null
          dns_status?: string
          domain?: string
          domain_connect_supported?: boolean | null
          domain_connect_template_id?: string | null
          health_check_frequency?: number | null
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_setup_at?: string | null
          path_prefix?: string | null
          provider_credentials?: Json | null
          provider_type?: string | null
          setup_type?: string | null
          status?: string
          tenant_id?: string
          tls_status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      draft_snapshots: {
        Row: {
          conflict_diff: Json | null
          content: Json
          content_url: string | null
          created_at: string
          deleted_at: string | null
          doc_id: string
          doc_type: Database["public"]["Enums"]["draft_doc_type"]
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          conflict_diff?: Json | null
          content?: Json
          content_url?: string | null
          created_at?: string
          deleted_at?: string | null
          doc_id: string
          doc_type: Database["public"]["Enums"]["draft_doc_type"]
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          conflict_diff?: Json | null
          content?: Json
          content_url?: string | null
          created_at?: string
          deleted_at?: string | null
          doc_id?: string
          doc_type?: Database["public"]["Enums"]["draft_doc_type"]
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: []
      }
      email_dns_checks: {
        Row: {
          check_name: string
          checked_at: string | null
          details: Json | null
          email_domain_id: string
          id: string
          ok: boolean
        }
        Insert: {
          check_name: string
          checked_at?: string | null
          details?: Json | null
          email_domain_id: string
          id?: string
          ok: boolean
        }
        Update: {
          check_name?: string
          checked_at?: string | null
          details?: Json | null
          email_domain_id?: string
          id?: string
          ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_dns_checks_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "deliverability_summary_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "email_dns_checks_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domain_stats_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "email_dns_checks_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      email_dns_records: {
        Row: {
          applied_at: string | null
          applied_automatically: boolean | null
          applied_provider: string | null
          created_at: string | null
          email_domain_id: string
          id: string
          name: string
          priority: number | null
          provider_record_id: string | null
          purpose: string
          required: boolean
          source: string | null
          type: string
          value: string
        }
        Insert: {
          applied_at?: string | null
          applied_automatically?: boolean | null
          applied_provider?: string | null
          created_at?: string | null
          email_domain_id: string
          id?: string
          name: string
          priority?: number | null
          provider_record_id?: string | null
          purpose: string
          required?: boolean
          source?: string | null
          type: string
          value: string
        }
        Update: {
          applied_at?: string | null
          applied_automatically?: boolean | null
          applied_provider?: string | null
          created_at?: string | null
          email_domain_id?: string
          id?: string
          name?: string
          priority?: number | null
          provider_record_id?: string | null
          purpose?: string
          required?: boolean
          source?: string | null
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_dns_records_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "deliverability_summary_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "email_dns_records_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domain_stats_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "email_dns_records_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domain_usage: {
        Row: {
          bounces: number | null
          complaints: number | null
          created_at: string | null
          date: string
          email_domain_id: string
          emails_sent: number | null
          hour: number
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          bounces?: number | null
          complaints?: number | null
          created_at?: string | null
          date: string
          email_domain_id: string
          emails_sent?: number | null
          hour: number
          id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          bounces?: number | null
          complaints?: number | null
          created_at?: string | null
          date?: string
          email_domain_id?: string
          emails_sent?: number | null
          hour?: number
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_domain_usage_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "deliverability_summary_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "email_domain_usage_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domain_stats_30d"
            referencedColumns: ["domain_id"]
          },
          {
            foreignKeyName: "email_domain_usage_email_domain_id_fkey"
            columns: ["email_domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domains: {
        Row: {
          bounce_rate_30d: number | null
          complaint_rate_30d: number | null
          created_at: string | null
          daily_limit: number | null
          daily_sent_count: number | null
          default_from_email: string | null
          default_from_name: string | null
          dns_records: Json | null
          domain: string
          entri_connection_id: string | null
          entri_provider: string | null
          env: Database["public"]["Enums"]["email_env"] | null
          error: string | null
          healthy_days_counter: number | null
          hourly_limit: number | null
          id: string
          is_entri_managed: boolean
          is_sandbox: boolean | null
          last_daily_reset_at: string | null
          last_stage_updated_at: string | null
          last_verify_attempt_at: string | null
          last_verify_error: string | null
          manual_pause: boolean | null
          next_verify_at: string | null
          notes: string | null
          report_email: string | null
          resend_domain_id: string | null
          resend_status: Json | null
          status: string
          tenant_id: string
          total_bounces_30d: number | null
          total_complaints_30d: number | null
          total_sent_30d: number | null
          updated_at: string | null
          verified_at: string | null
          verify_attempts: number | null
          warmup_stage: number | null
          warmup_started_at: string | null
        }
        Insert: {
          bounce_rate_30d?: number | null
          complaint_rate_30d?: number | null
          created_at?: string | null
          daily_limit?: number | null
          daily_sent_count?: number | null
          default_from_email?: string | null
          default_from_name?: string | null
          dns_records?: Json | null
          domain: string
          entri_connection_id?: string | null
          entri_provider?: string | null
          env?: Database["public"]["Enums"]["email_env"] | null
          error?: string | null
          healthy_days_counter?: number | null
          hourly_limit?: number | null
          id?: string
          is_entri_managed?: boolean
          is_sandbox?: boolean | null
          last_daily_reset_at?: string | null
          last_stage_updated_at?: string | null
          last_verify_attempt_at?: string | null
          last_verify_error?: string | null
          manual_pause?: boolean | null
          next_verify_at?: string | null
          notes?: string | null
          report_email?: string | null
          resend_domain_id?: string | null
          resend_status?: Json | null
          status?: string
          tenant_id: string
          total_bounces_30d?: number | null
          total_complaints_30d?: number | null
          total_sent_30d?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verify_attempts?: number | null
          warmup_stage?: number | null
          warmup_started_at?: string | null
        }
        Update: {
          bounce_rate_30d?: number | null
          complaint_rate_30d?: number | null
          created_at?: string | null
          daily_limit?: number | null
          daily_sent_count?: number | null
          default_from_email?: string | null
          default_from_name?: string | null
          dns_records?: Json | null
          domain?: string
          entri_connection_id?: string | null
          entri_provider?: string | null
          env?: Database["public"]["Enums"]["email_env"] | null
          error?: string | null
          healthy_days_counter?: number | null
          hourly_limit?: number | null
          id?: string
          is_entri_managed?: boolean
          is_sandbox?: boolean | null
          last_daily_reset_at?: string | null
          last_stage_updated_at?: string | null
          last_verify_attempt_at?: string | null
          last_verify_error?: string | null
          manual_pause?: boolean | null
          next_verify_at?: string | null
          notes?: string | null
          report_email?: string | null
          resend_domain_id?: string | null
          resend_status?: Json | null
          status?: string
          tenant_id?: string
          total_bounces_30d?: number | null
          total_complaints_30d?: number | null
          total_sent_30d?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verify_attempts?: number | null
          warmup_stage?: number | null
          warmup_started_at?: string | null
        }
        Relationships: []
      }
      email_send_jobs: {
        Row: {
          attempts: number
          batch_index: number
          campaign_id: string
          created_at: string
          domain_id: string | null
          emails_failed: number | null
          emails_sent: number | null
          error_message: string | null
          id: string
          recipient_emails: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_index?: number
          campaign_id: string
          created_at?: string
          domain_id?: string | null
          emails_failed?: number | null
          emails_sent?: number | null
          error_message?: string | null
          id?: string
          recipient_emails?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_index?: number
          campaign_id?: string
          created_at?: string
          domain_id?: string | null
          emails_failed?: number | null
          emails_sent?: number | null
          error_message?: string | null
          id?: string
          recipient_emails?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_senders: {
        Row: {
          created_at: string
          display_name: string | null
          dkim_host: string | null
          dkim_value: string | null
          dmarc_value: string | null
          domain_id: string | null
          error: string | null
          id: string
          last_verified_at: string | null
          provider: string
          provider_domain_id: string | null
          sender_email: string
          spf_value: string | null
          status: string
          tenant_id: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          dkim_host?: string | null
          dkim_value?: string | null
          dmarc_value?: string | null
          domain_id?: string | null
          error?: string | null
          id?: string
          last_verified_at?: string | null
          provider?: string
          provider_domain_id?: string | null
          sender_email: string
          spf_value?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          dkim_host?: string | null
          dkim_value?: string | null
          dmarc_value?: string | null
          domain_id?: string | null
          error?: string | null
          id?: string
          last_verified_at?: string | null
          provider?: string
          provider_domain_id?: string | null
          sender_email?: string
          spf_value?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_senders_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking_events: {
        Row: {
          bounce_type: string | null
          campaign_id: string
          created_at: string
          customer_email: string
          customer_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown
          sent_at: string | null
          time_to_event_seconds: number | null
          user_agent: string | null
        }
        Insert: {
          bounce_type?: string | null
          campaign_id: string
          created_at?: string
          customer_email: string
          customer_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          sent_at?: string | null
          time_to_event_seconds?: number | null
          user_agent?: string | null
        }
        Update: {
          bounce_type?: string | null
          campaign_id?: string
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          sent_at?: string | null
          time_to_event_seconds?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_content: {
        Row: {
          caption: string
          created_at: string | null
          id: string
          media_url: string | null
          status: Database["public"]["Enums"]["content_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          caption: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          status?: Database["public"]["Enums"]["content_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          caption?: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          status?: Database["public"]["Enums"]["content_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      global_image_gallery: {
        Row: {
          channel: string | null
          content_context: string | null
          content_title: string | null
          created_at: string
          dimensions: Json | null
          file_size_bytes: number | null
          first_used_at: string | null
          generation_model: string
          generation_prompt: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          mime_type: string | null
          public_url: string
          storage_bucket: string
          storage_path: string
          total_usage_count: number | null
          unique_tenant_count: number | null
          updated_at: string
        }
        Insert: {
          channel?: string | null
          content_context?: string | null
          content_title?: string | null
          created_at?: string
          dimensions?: Json | null
          file_size_bytes?: number | null
          first_used_at?: string | null
          generation_model?: string
          generation_prompt: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          mime_type?: string | null
          public_url: string
          storage_bucket?: string
          storage_path: string
          total_usage_count?: number | null
          unique_tenant_count?: number | null
          updated_at?: string
        }
        Update: {
          channel?: string | null
          content_context?: string | null
          content_title?: string | null
          created_at?: string
          dimensions?: Json | null
          file_size_bytes?: number | null
          first_used_at?: string | null
          generation_model?: string
          generation_prompt?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          mime_type?: string | null
          public_url?: string
          storage_bucket?: string
          storage_path?: string
          total_usage_count?: number | null
          unique_tenant_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      global_image_tags: {
        Row: {
          confidence_score: number | null
          created_at: string
          generated_by: string | null
          id: string
          image_id: string
          tag_category: string
          tag_name: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          generated_by?: string | null
          id?: string
          image_id: string
          tag_category: string
          tag_name: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          generated_by?: string | null
          id?: string
          image_id?: string
          tag_category?: string
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_image_tags_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "global_image_gallery"
            referencedColumns: ["id"]
          },
        ]
      }
      google_analytics_settings: {
        Row: {
          connection_status: string
          created_at: string
          id: string
          last_test_at: string | null
          property_id: string
          service_account_configured: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_status?: string
          created_at?: string
          id?: string
          last_test_at?: string | null
          property_id: string
          service_account_configured?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_status?: string
          created_at?: string
          id?: string
          last_test_at?: string | null
          property_id?: string
          service_account_configured?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holiday_generation_logs: {
        Row: {
          created_at: string
          error_message: string | null
          generation_type: string
          holidays_deactivated: number
          holidays_generated: number
          id: string
          success: boolean
          triggered_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          generation_type?: string
          holidays_deactivated?: number
          holidays_generated?: number
          id?: string
          success?: boolean
          triggered_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          generation_type?: string
          holidays_deactivated?: number
          holidays_generated?: number
          id?: string
          success?: boolean
          triggered_by?: string | null
          year?: number
        }
        Relationships: []
      }
      holiday_tasks: {
        Row: {
          content_suggestions: Json | null
          created_at: string
          created_by_user_id: string | null
          holiday_id: string
          id: string
          priority: number | null
          status: string
          suggested_date: string | null
          task_description: string | null
          task_title: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content_suggestions?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          holiday_id: string
          id?: string
          priority?: number | null
          status?: string
          suggested_date?: string | null
          task_description?: string | null
          task_title: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          content_suggestions?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          holiday_id?: string
          id?: string
          priority?: number | null
          status?: string
          suggested_date?: string | null
          task_description?: string | null
          task_title?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_tasks_holiday_id_fkey"
            columns: ["holiday_id"]
            isOneToOne: false
            referencedRelation: "holidays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "holiday_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_templates: {
        Row: {
          calculation_rule: Json
          category: string
          created_at: string
          description: string | null
          garden_relevance_template: string | null
          holiday_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          calculation_rule: Json
          category?: string
          created_at?: string
          description?: string | null
          garden_relevance_template?: string | null
          holiday_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          calculation_rule?: Json
          category?: string
          created_at?: string
          description?: string | null
          garden_relevance_template?: string | null
          holiday_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          garden_relevance: string | null
          holiday_date: string
          holiday_name: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          garden_relevance?: string | null
          holiday_date: string
          holiday_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          garden_relevance?: string | null
          holiday_date?: string
          holiday_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      hub_interactions: {
        Row: {
          block_id: string | null
          campaign_id: string
          created_at: string
          id: string
          interaction_type: string
          metadata: Json | null
          session_id: string
        }
        Insert: {
          block_id?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          interaction_type: string
          metadata?: Json | null
          session_id: string
        }
        Update: {
          block_id?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          interaction_type?: string
          metadata?: Json | null
          session_id?: string
        }
        Relationships: []
      }
      hub_views: {
        Row: {
          campaign_id: string
          id: string
          ip_address: unknown
          metadata: Json | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          campaign_id: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: []
      }
      image_assets: {
        Row: {
          alt_text: string | null
          compressed_size: number | null
          compression_ratio: number | null
          content_task_id: string | null
          created_at: string
          description: string | null
          dimensions: Json | null
          file_name: string | null
          file_size: number | null
          id: string
          last_used_at: string | null
          mime_type: string | null
          optimization_applied: boolean | null
          original_size: number | null
          original_url: string
          photographer_name: string | null
          photographer_url: string | null
          processed_url: string | null
          processing_error: string | null
          processing_status: string | null
          source_type: string
          tags: string[] | null
          thumbnail_url: string | null
          unsplash_id: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          alt_text?: string | null
          compressed_size?: number | null
          compression_ratio?: number | null
          content_task_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          last_used_at?: string | null
          mime_type?: string | null
          optimization_applied?: boolean | null
          original_size?: number | null
          original_url: string
          photographer_name?: string | null
          photographer_url?: string | null
          processed_url?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_type: string
          tags?: string[] | null
          thumbnail_url?: string | null
          unsplash_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          alt_text?: string | null
          compressed_size?: number | null
          compression_ratio?: number | null
          content_task_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          last_used_at?: string | null
          mime_type?: string | null
          optimization_applied?: boolean | null
          original_size?: number | null
          original_url?: string
          photographer_name?: string | null
          photographer_url?: string | null
          processed_url?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_type?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          unsplash_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_assets_content_task_id_fkey"
            columns: ["content_task_id"]
            isOneToOne: false
            referencedRelation: "content_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      image_suggestions: {
        Row: {
          alt: string | null
          content_task_id: string | null
          created_at: string
          download_url: string
          id: string
          photographer: string
          query: string
          thumb_url: string
          unsplash_id: string
        }
        Insert: {
          alt?: string | null
          content_task_id?: string | null
          created_at?: string
          download_url: string
          id?: string
          photographer: string
          query: string
          thumb_url: string
          unsplash_id: string
        }
        Update: {
          alt?: string | null
          content_task_id?: string | null
          created_at?: string
          download_url?: string
          id?: string
          photographer?: string
          query?: string
          thumb_url?: string
          unsplash_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_suggestions_content_task_id_fkey"
            columns: ["content_task_id"]
            isOneToOne: false
            referencedRelation: "content_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      image_tenant_usage: {
        Row: {
          block_id: string | null
          campaign_id: string | null
          created_at: string
          first_used_at: string | null
          id: string
          image_id: string
          last_used_at: string | null
          tenant_id: string
          updated_at: string
          usage_count: number | null
          used_in_context: string | null
          user_id: string
        }
        Insert: {
          block_id?: string | null
          campaign_id?: string | null
          created_at?: string
          first_used_at?: string | null
          id?: string
          image_id: string
          last_used_at?: string | null
          tenant_id: string
          updated_at?: string
          usage_count?: number | null
          used_in_context?: string | null
          user_id: string
        }
        Update: {
          block_id?: string | null
          campaign_id?: string | null
          created_at?: string
          first_used_at?: string | null
          id?: string
          image_id?: string
          last_used_at?: string | null
          tenant_id?: string
          updated_at?: string
          usage_count?: number | null
          used_in_context?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_tenant_usage_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "campaign_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_tenant_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_tenant_usage_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "global_image_gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_tenant_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "image_tenant_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_items: {
        Row: {
          created_at: string | null
          email: string | null
          error_message: string | null
          external_id: string
          id: string
          import_job_id: string
          mapped_customer_id: string | null
          phone: string | null
          raw_data: Json | null
          skip_reason: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          external_id: string
          id?: string
          import_job_id: string
          mapped_customer_id?: string | null
          phone?: string | null
          raw_data?: Json | null
          skip_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          external_id?: string
          id?: string
          import_job_id?: string
          mapped_customer_id?: string | null
          phone?: string | null
          raw_data?: Json | null
          skip_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          batch_stats: Json | null
          completed_at: string | null
          config: Json
          created_at: string
          current_stage: string | null
          error_details: Json | null
          estimated_completion_at: string | null
          id: string
          migration_job_id: string | null
          progress_percentage: number | null
          provider: string
          report: Json | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_stats?: Json | null
          completed_at?: string | null
          config?: Json
          created_at?: string
          current_stage?: string | null
          error_details?: Json | null
          estimated_completion_at?: string | null
          id?: string
          migration_job_id?: string | null
          progress_percentage?: number | null
          provider: string
          report?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_stats?: Json | null
          completed_at?: string | null
          config?: Json
          created_at?: string
          current_stage?: string | null
          error_details?: Json | null
          estimated_completion_at?: string | null
          id?: string
          migration_job_id?: string | null
          progress_percentage?: number | null
          provider?: string
          report?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_migration_job_id_fkey"
            columns: ["migration_job_id"]
            isOneToOne: false
            referencedRelation: "migration_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_tracking: {
        Row: {
          automation_id: string | null
          campaign_id: string | null
          code: string | null
          created_at: string | null
          customer_id: string
          expires_at: string | null
          id: string
          incentive_type: string
          order_total: number | null
          redeemed_at: string | null
          redemption_amount: number | null
          redemption_order_id: string | null
          sent_at: string
          source_id: string | null
          source_type: string
          status: string | null
          tenant_id: string
          updated_at: string | null
          value: number | null
          value_type: string | null
        }
        Insert: {
          automation_id?: string | null
          campaign_id?: string | null
          code?: string | null
          created_at?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          incentive_type: string
          order_total?: number | null
          redeemed_at?: string | null
          redemption_amount?: number | null
          redemption_order_id?: string | null
          sent_at?: string
          source_id?: string | null
          source_type: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          value?: number | null
          value_type?: string | null
        }
        Update: {
          automation_id?: string | null
          campaign_id?: string | null
          code?: string | null
          created_at?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          incentive_type?: string
          order_total?: number | null
          redeemed_at?: string | null
          redemption_amount?: number | null
          redemption_order_id?: string | null
          sent_at?: string
          source_id?: string | null
          source_type?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          value?: number | null
          value_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incentive_tracking_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_tracking_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_tracking_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_tracking_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "incentive_tracking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          can_retry: boolean | null
          created_at: string
          customers_imported: number | null
          error_message: string | null
          id: string
          last_retry_at: string | null
          metadata: Json | null
          orders_imported: number | null
          pos_source: string
          retry_count: number | null
          rollback_available: boolean | null
          status: string
          sync_date: string
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_retry?: boolean | null
          created_at?: string
          customers_imported?: number | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          orders_imported?: number | null
          pos_source: string
          retry_count?: number | null
          rollback_available?: boolean | null
          status?: string
          sync_date?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_retry?: boolean | null
          created_at?: string
          customers_imported?: number | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          orders_imported?: number | null
          pos_source?: string
          retry_count?: number | null
          rollback_available?: boolean | null
          status?: string
          sync_date?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lightspeed_connections: {
        Row: {
          connected_at: string | null
          created_at: string | null
          customers_synced: number | null
          domain_prefix: string
          encrypted_access_token: string
          encrypted_refresh_token: string
          expires_at: string
          id: string
          installed_by: string | null
          last_customer_sync: string | null
          last_product_sync: string | null
          last_sales_sync: string | null
          last_synced_at: string | null
          products_synced: number | null
          retailer_id: number | null
          retailer_name: string | null
          sales_synced: number | null
          status: string | null
          sync_errors: Json | null
          tenant_id: string
          updated_at: string | null
          user_id: string
          webhook_registered: boolean | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          domain_prefix: string
          encrypted_access_token: string
          encrypted_refresh_token: string
          expires_at: string
          id?: string
          installed_by?: string | null
          last_customer_sync?: string | null
          last_product_sync?: string | null
          last_sales_sync?: string | null
          last_synced_at?: string | null
          products_synced?: number | null
          retailer_id?: number | null
          retailer_name?: string | null
          sales_synced?: number | null
          status?: string | null
          sync_errors?: Json | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
          webhook_registered?: boolean | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          domain_prefix?: string
          encrypted_access_token?: string
          encrypted_refresh_token?: string
          expires_at?: string
          id?: string
          installed_by?: string | null
          last_customer_sync?: string | null
          last_product_sync?: string | null
          last_sales_sync?: string | null
          last_synced_at?: string | null
          products_synced?: number | null
          retailer_id?: number | null
          retailer_name?: string | null
          sales_synced?: number | null
          status?: string | null
          sync_errors?: Json | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
          webhook_registered?: boolean | null
        }
        Relationships: []
      }
      lightspeed_customers: {
        Row: {
          contact_id: string | null
          created_at: string | null
          customer_group_id: string | null
          email: string | null
          first_name: string | null
          first_purchase_date: string | null
          id: string
          last_name: string | null
          last_purchase_date: string | null
          lightspeed_customer_id: string
          loyalty_balance: number | null
          phone: string | null
          purchase_count: number | null
          raw_data: Json | null
          synced_at: string | null
          tags: Json | null
          tenant_id: string
          total_spend: number | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          customer_group_id?: string | null
          email?: string | null
          first_name?: string | null
          first_purchase_date?: string | null
          id?: string
          last_name?: string | null
          last_purchase_date?: string | null
          lightspeed_customer_id: string
          loyalty_balance?: number | null
          phone?: string | null
          purchase_count?: number | null
          raw_data?: Json | null
          synced_at?: string | null
          tags?: Json | null
          tenant_id: string
          total_spend?: number | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          customer_group_id?: string | null
          email?: string | null
          first_name?: string | null
          first_purchase_date?: string | null
          id?: string
          last_name?: string | null
          last_purchase_date?: string | null
          lightspeed_customer_id?: string
          loyalty_balance?: number | null
          phone?: string | null
          purchase_count?: number | null
          raw_data?: Json | null
          synced_at?: string | null
          tags?: Json | null
          tenant_id?: string
          total_spend?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lightspeed_customers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lightspeed_customers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lightspeed_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lightspeed_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lightspeed_products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          inventory_count: number | null
          lightspeed_product_id: string
          name: string
          price: number | null
          raw_data: Json | null
          sku: string | null
          synced_at: string | null
          tags: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inventory_count?: number | null
          lightspeed_product_id: string
          name: string
          price?: number | null
          raw_data?: Json | null
          sku?: string | null
          synced_at?: string | null
          tags?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inventory_count?: number | null
          lightspeed_product_id?: string
          name?: string
          price?: number | null
          raw_data?: Json | null
          sku?: string | null
          synced_at?: string | null
          tags?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lightspeed_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lightspeed_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lightspeed_sales: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          lightspeed_customer_id: string | null
          lightspeed_sale_id: string
          line_items: Json | null
          note: string | null
          payment_method: string | null
          raw_data: Json | null
          sale_date: string
          status: string
          synced_at: string | null
          tenant_id: string
          total_amount: number
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          lightspeed_customer_id?: string | null
          lightspeed_sale_id: string
          line_items?: Json | null
          note?: string | null
          payment_method?: string | null
          raw_data?: Json | null
          sale_date: string
          status: string
          synced_at?: string | null
          tenant_id: string
          total_amount?: number
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          lightspeed_customer_id?: string | null
          lightspeed_sale_id?: string
          line_items?: Json | null
          note?: string | null
          payment_method?: string | null
          raw_data?: Json | null
          sale_date?: string
          status?: string
          synced_at?: string | null
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "lightspeed_sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lightspeed_sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lightspeed_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lightspeed_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points_transactions: {
        Row: {
          created_at: string | null
          customer_id: string
          description: string | null
          external_transaction_id: string | null
          id: string
          order_id: string | null
          order_total: number | null
          points_amount: number
          points_balance_after: number | null
          redemption_value: number | null
          source_id: string | null
          source_type: string
          tenant_id: string
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          description?: string | null
          external_transaction_id?: string | null
          id?: string
          order_id?: string | null
          order_total?: number | null
          points_amount: number
          points_balance_after?: number | null
          redemption_value?: number | null
          source_id?: string | null
          source_type: string
          tenant_id: string
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          description?: string | null
          external_transaction_id?: string | null
          id?: string
          order_id?: string | null
          order_total?: number | null
          points_amount?: number
          points_balance_after?: number | null
          redemption_value?: number | null
          source_id?: string | null
          source_type?: string
          tenant_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "loyalty_points_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_campaign_templates: {
        Row: {
          content_ideas: string | null
          created_at: string
          id: string
          platform_specific_notes: Json | null
          prompt: string | null
          seasonal_focus: string | null
          target_audience_notes: string | null
          theme: string | null
          title: string
          updated_at: string
          week_number: number
        }
        Insert: {
          content_ideas?: string | null
          created_at?: string
          id?: string
          platform_specific_notes?: Json | null
          prompt?: string | null
          seasonal_focus?: string | null
          target_audience_notes?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          week_number: number
        }
        Update: {
          content_ideas?: string | null
          created_at?: string
          id?: string
          platform_specific_notes?: Json | null
          prompt?: string | null
          seasonal_focus?: string | null
          target_audience_notes?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: []
      }
      migration_artifacts: {
        Row: {
          artifact_type: string
          created_at: string | null
          error_message: string | null
          id: string
          job_id: string
          mapping_data: Json | null
          source_id: string | null
          status: string
          target_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          artifact_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          mapping_data?: Json | null
          source_id?: string | null
          status?: string
          target_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          artifact_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          mapping_data?: Json | null
          source_id?: string | null
          status?: string
          target_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "migration_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_job_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          job_id: string
          log_level: string
          message: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          job_id: string
          log_level?: string
          message: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          job_id?: string
          log_level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "migration_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          metadata: Json | null
          paused_at: string | null
          progress_current: number | null
          progress_percentage: number | null
          progress_total: number | null
          source_platform: string
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          metadata?: Json | null
          paused_at?: string | null
          progress_current?: number | null
          progress_percentage?: number | null
          progress_total?: number | null
          source_platform: string
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          metadata?: Json | null
          paused_at?: string | null
          progress_current?: number | null
          progress_percentage?: number | null
          progress_total?: number | null
          source_platform?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      negative_behavior_events: {
        Row: {
          abuse_type: string | null
          automation_id: string | null
          bounce_reason: string | null
          bounce_type: string | null
          campaign_id: string | null
          channel: string
          created_at: string | null
          customer_id: string | null
          event_subtype: string | null
          event_type: string
          id: string
          ignore_streak_length: number | null
          message_id: string | null
          messages_received_before: number | null
          metadata: Json | null
          opt_out_source: string | null
          risk_score_impact: number | null
          tenant_id: string
          time_since_last_message_seconds: number | null
        }
        Insert: {
          abuse_type?: string | null
          automation_id?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          campaign_id?: string | null
          channel: string
          created_at?: string | null
          customer_id?: string | null
          event_subtype?: string | null
          event_type: string
          id?: string
          ignore_streak_length?: number | null
          message_id?: string | null
          messages_received_before?: number | null
          metadata?: Json | null
          opt_out_source?: string | null
          risk_score_impact?: number | null
          tenant_id: string
          time_since_last_message_seconds?: number | null
        }
        Update: {
          abuse_type?: string | null
          automation_id?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          campaign_id?: string | null
          channel?: string
          created_at?: string | null
          customer_id?: string | null
          event_subtype?: string | null
          event_type?: string
          id?: string
          ignore_streak_length?: number | null
          message_id?: string | null
          messages_received_before?: number | null
          metadata?: Json | null
          opt_out_source?: string | null
          risk_score_impact?: number | null
          tenant_id?: string
          time_since_last_message_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negative_behavior_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negative_behavior_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negative_behavior_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "negative_behavior_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_code_usage: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string
          domain_prefix: string
          expires_at: string
          id: string
          provider: string | null
          state_token: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_prefix: string
          expires_at: string
          id?: string
          provider?: string | null
          state_token: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain_prefix?: string
          expires_at?: string
          id?: string
          provider?: string | null
          state_token?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          about_business: string | null
          annual_events: string | null
          created_at: string
          id: string
          tone_samples: string | null
          user_id: string | null
        }
        Insert: {
          about_business?: string | null
          annual_events?: string | null
          created_at?: string
          id?: string
          tone_samples?: string | null
          user_id?: string | null
        }
        Update: {
          about_business?: string | null
          annual_events?: string | null
          created_at?: string
          id?: string
          tone_samples?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      org_usage_budgets: {
        Row: {
          created_at: string
          id: string
          max_automation_runs: number
          max_customers: number
          max_email_sends: number
          max_orders: number
          max_products: number
          max_rows_ingested: number
          max_sms_sends: number
          max_sync_jobs: number
          month: string
          plan: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_automation_runs?: number
          max_customers?: number
          max_email_sends?: number
          max_orders?: number
          max_products?: number
          max_rows_ingested?: number
          max_sms_sends?: number
          max_sync_jobs?: number
          month?: string
          plan?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_automation_runs?: number
          max_customers?: number
          max_email_sends?: number
          max_orders?: number
          max_products?: number
          max_rows_ingested?: number
          max_sms_sends?: number
          max_sync_jobs?: number
          month?: string
          plan?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_usage_budgets_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plan_definitions"
            referencedColumns: ["plan"]
          },
          {
            foreignKeyName: "org_usage_budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "org_usage_budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_usage_counters: {
        Row: {
          automation_runs_used: number
          created_at: string
          customers_count: number
          email_sends_used: number
          id: string
          month: string
          orders_count: number
          products_count: number
          rows_ingested: number
          sms_sends_used: number
          sync_jobs_used: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          automation_runs_used?: number
          created_at?: string
          customers_count?: number
          email_sends_used?: number
          id?: string
          month?: string
          orders_count?: number
          products_count?: number
          rows_ingested?: number
          sms_sends_used?: number
          sync_jobs_used?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          automation_runs_used?: number
          created_at?: string
          customers_count?: number
          email_sends_used?: number
          id?: string
          month?: string
          orders_count?: number
          products_count?: number
          rows_ingested?: number
          sms_sends_used?: number
          sync_jobs_used?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "org_usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perks_enrollment_events: {
        Row: {
          created_at: string | null
          customer_id: string
          enrollment_source: string | null
          event_type: string
          id: string
          new_tier: string | null
          previous_tier: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          enrollment_source?: string | null
          event_type: string
          id?: string
          new_tier?: string | null
          previous_tier?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          enrollment_source?: string | null
          event_type?: string
          id?: string
          new_tier?: string | null
          previous_tier?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perks_enrollment_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perks_enrollment_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perks_enrollment_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "perks_enrollment_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          buying_triggers: string[] | null
          color_theme: string | null
          created_at: string | null
          description: string
          icon: string | null
          id: string
          ideal_products: string[] | null
          name: string
          sample_phrases: string[] | null
          tone: string
        }
        Insert: {
          buying_triggers?: string[] | null
          color_theme?: string | null
          created_at?: string | null
          description: string
          icon?: string | null
          id?: string
          ideal_products?: string[] | null
          name: string
          sample_phrases?: string[] | null
          tone: string
        }
        Update: {
          buying_triggers?: string[] | null
          color_theme?: string | null
          created_at?: string | null
          description?: string
          icon?: string | null
          id?: string
          ideal_products?: string[] | null
          name?: string
          sample_phrases?: string[] | null
          tone?: string
        }
        Relationships: []
      }
      plan_definitions: {
        Row: {
          created_at: string
          max_automation_runs: number
          max_concurrent_jobs: number
          max_customers: number
          max_email_sends: number
          max_orders: number
          max_products: number
          max_rows_ingested: number
          max_sms_sends: number
          max_sync_jobs: number
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          max_automation_runs?: number
          max_concurrent_jobs?: number
          max_customers?: number
          max_email_sends?: number
          max_orders?: number
          max_products?: number
          max_rows_ingested?: number
          max_sms_sends?: number
          max_sync_jobs?: number
          plan: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          max_automation_runs?: number
          max_concurrent_jobs?: number
          max_customers?: number
          max_email_sends?: number
          max_orders?: number
          max_products?: number
          max_rows_ingested?: number
          max_sms_sends?: number
          max_sync_jobs?: number
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          id: string
          month: string
          name: string
          status: string
          tenant_id: string | null
          themes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          name: string
          status?: string
          tenant_id?: string | null
          themes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          name?: string
          status?: string
          tenant_id?: string | null
          themes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_connections: {
        Row: {
          created_at: string
          credentials_encrypted: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          name: string
          platform: string
          settings: Json
          sync_error: string | null
          sync_status: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          name: string
          platform: string
          settings?: Json
          sync_error?: string | null
          sync_status?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          name?: string
          platform?: string
          settings?: Json
          sync_error?: string | null
          sync_status?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_customers: {
        Row: {
          address: Json | null
          created_at: string
          email: string | null
          external_id: string
          id: string
          name: string | null
          phone: string | null
          pos_connection_id: string
          pos_source: string
          raw_data: Json | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          email?: string | null
          external_id: string
          id?: string
          name?: string | null
          phone?: string | null
          pos_connection_id: string
          pos_source: string
          raw_data?: Json | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          email?: string | null
          external_id?: string
          id?: string
          name?: string | null
          phone?: string | null
          pos_connection_id?: string
          pos_source?: string
          raw_data?: Json | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_customers_pos_connection_id_fkey"
            columns: ["pos_connection_id"]
            isOneToOne: false
            referencedRelation: "pos_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          created_at: string
          currency: string | null
          external_customer_id: string | null
          external_id: string
          fulfillment_state: string | null
          fulfillment_type: string | null
          id: string
          items: Json
          order_date: string
          pos_connection_id: string
          pos_customer_id: string | null
          raw_data: Json | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          status: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          external_customer_id?: string | null
          external_id: string
          fulfillment_state?: string | null
          fulfillment_type?: string | null
          id?: string
          items?: Json
          order_date: string
          pos_connection_id: string
          pos_customer_id?: string | null
          raw_data?: Json | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          external_customer_id?: string | null
          external_id?: string
          fulfillment_state?: string | null
          fulfillment_type?: string | null
          id?: string
          items?: Json
          order_date?: string
          pos_connection_id?: string
          pos_customer_id?: string | null
          raw_data?: Json | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_pos_customer_id_fkey"
            columns: ["pos_customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sync_cursors: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          last_cursor: string | null
          last_sync_at: string | null
          provider: Database["public"]["Enums"]["pos_provider"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          last_cursor?: string | null
          last_sync_at?: string | null
          provider: Database["public"]["Enums"]["pos_provider"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          last_cursor?: string | null
          last_sync_at?: string | null
          provider?: Database["public"]["Enums"]["pos_provider"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sync_cursors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_sync_cursors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sync_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          connection_id: string
          connection_type: string
          created_at: string | null
          current_page: number | null
          cursor: string | null
          error_message: string | null
          has_more_pages: boolean | null
          id: string
          is_first_page: boolean | null
          max_attempts: number | null
          page_offset: number | null
          page_size: number | null
          started_at: string | null
          status: string
          sync_type: string
          tenant_id: string
          total_failed: number | null
          total_fetched: number | null
          total_synced: number | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          connection_id: string
          connection_type: string
          created_at?: string | null
          current_page?: number | null
          cursor?: string | null
          error_message?: string | null
          has_more_pages?: boolean | null
          id?: string
          is_first_page?: boolean | null
          max_attempts?: number | null
          page_offset?: number | null
          page_size?: number | null
          started_at?: string | null
          status?: string
          sync_type: string
          tenant_id: string
          total_failed?: number | null
          total_fetched?: number | null
          total_synced?: number | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          connection_id?: string
          connection_type?: string
          created_at?: string | null
          current_page?: number | null
          cursor?: string | null
          error_message?: string | null
          has_more_pages?: boolean | null
          id?: string
          is_first_page?: boolean | null
          max_attempts?: number | null
          page_offset?: number | null
          page_size?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          tenant_id?: string
          total_failed?: number | null
          total_fetched?: number | null
          total_synced?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sync_jobs_v2: {
        Row: {
          attempts: number
          batch_size: number
          circuit_open_until: string | null
          completed_at: string | null
          consecutive_failures: number | null
          created_at: string
          current_batch: number
          current_cursor: string | null
          customers_synced: number
          error_count: number
          estimated_rows: number | null
          id: string
          is_delta: boolean
          last_error: string | null
          last_failure_at: string | null
          last_sync_cursor: string | null
          max_retries: number
          metadata: Json | null
          next_retry_at: string | null
          orders_synced: number
          processed_rows: number
          products_synced: number
          provider: Database["public"]["Enums"]["pos_provider"]
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["pos_job_status"]
          sync_type: Database["public"]["Enums"]["pos_sync_type"]
          tenant_id: string
          total_batches: number | null
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_size?: number
          circuit_open_until?: string | null
          completed_at?: string | null
          consecutive_failures?: number | null
          created_at?: string
          current_batch?: number
          current_cursor?: string | null
          customers_synced?: number
          error_count?: number
          estimated_rows?: number | null
          id?: string
          is_delta?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_sync_cursor?: string | null
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          orders_synced?: number
          processed_rows?: number
          products_synced?: number
          provider: Database["public"]["Enums"]["pos_provider"]
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["pos_job_status"]
          sync_type?: Database["public"]["Enums"]["pos_sync_type"]
          tenant_id: string
          total_batches?: number | null
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_size?: number
          circuit_open_until?: string | null
          completed_at?: string | null
          consecutive_failures?: number | null
          created_at?: string
          current_batch?: number
          current_cursor?: string | null
          customers_synced?: number
          error_count?: number
          estimated_rows?: number | null
          id?: string
          is_delta?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_sync_cursor?: string | null
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          orders_synced?: number
          processed_rows?: number
          products_synced?: number
          provider?: Database["public"]["Enums"]["pos_provider"]
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["pos_job_status"]
          sync_type?: Database["public"]["Enums"]["pos_sync_type"]
          tenant_id?: string
          total_batches?: number | null
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sync_jobs_v2_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_sync_jobs_v2_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sync_logs: {
        Row: {
          completed_at: string | null
          customers_synced: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          orders_synced: number | null
          pos_connection_id: string
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          customers_synced?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          orders_synced?: number | null
          pos_connection_id: string
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          customers_synced?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          orders_synced?: number | null
          pos_connection_id?: string
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sync_logs_pos_connection_id_fkey"
            columns: ["pos_connection_id"]
            isOneToOne: false
            referencedRelation: "pos_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          collected_at: string | null
          comments: number | null
          id: string
          impressions: number | null
          likes: number | null
          reach: number | null
          scheduled_id: string
        }
        Insert: {
          collected_at?: string | null
          comments?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          reach?: number | null
          scheduled_id: string
        }
        Update: {
          collected_at?: string | null
          comments?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          reach?: number | null
          scheduled_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_scheduled_id_fkey"
            columns: ["scheduled_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_performance: {
        Row: {
          collected_at: string | null
          comments_count: number | null
          content_task_id: string | null
          created_at: string | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          likes_count: number | null
          platform: string
          platform_post_id: string
          reach: number | null
          shares_count: number | null
          updated_at: string | null
        }
        Insert: {
          collected_at?: string | null
          comments_count?: number | null
          content_task_id?: string | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes_count?: number | null
          platform: string
          platform_post_id: string
          reach?: number | null
          shares_count?: number | null
          updated_at?: string | null
        }
        Update: {
          collected_at?: string | null
          comments_count?: number | null
          content_task_id?: string | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes_count?: number | null
          platform?: string
          platform_post_id?: string
          reach?: number | null
          shares_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_performance_content_task_id_fkey"
            columns: ["content_task_id"]
            isOneToOne: false
            referencedRelation: "content_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          global_image_id: string | null
          id: string
          image_url: string | null
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
          source: string | null
          thumbnail_url: string | null
          variation_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          global_image_id?: string | null
          id?: string
          image_url?: string | null
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
          source?: string | null
          thumbnail_url?: string | null
          variation_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          global_image_id?: string | null
          id?: string
          image_url?: string | null
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
          source?: string | null
          thumbnail_url?: string | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_global_image_id_fkey"
            columns: ["global_image_id"]
            isOneToOne: false
            referencedRelation: "global_image_gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          attributes: Json | null
          barcode: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          external_id: string | null
          id: string
          inventory_count: number | null
          is_active: boolean | null
          name: string
          price: number | null
          product_id: string
          sku: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          attributes?: Json | null
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          external_id?: string | null
          id?: string
          inventory_count?: number | null
          is_active?: boolean | null
          name: string
          price?: number | null
          product_id: string
          sku?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          attributes?: Json | null
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          external_id?: string | null
          id?: string
          inventory_count?: number | null
          is_active?: boolean | null
          name?: string
          price?: number | null
          product_id?: string
          sku?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          created_by_user_id: string | null
          currency: string | null
          description: string | null
          external_data: Json | null
          external_id: string | null
          id: string
          inventory_count: number | null
          is_visible: boolean | null
          last_synced_at: string | null
          low_stock_threshold: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          price: number | null
          sku: string | null
          slug: string | null
          source: string
          status: string
          subcategory: string | null
          tags: string[] | null
          tenant_id: string
          track_inventory: boolean | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string | null
          description?: string | null
          external_data?: Json | null
          external_id?: string | null
          id?: string
          inventory_count?: number | null
          is_visible?: boolean | null
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          price?: number | null
          sku?: string | null
          slug?: string | null
          source?: string
          status?: string
          subcategory?: string | null
          tags?: string[] | null
          tenant_id: string
          track_inventory?: boolean | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string | null
          description?: string | null
          external_data?: Json | null
          external_id?: string | null
          id?: string
          inventory_count?: number | null
          is_visible?: boolean | null
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          price?: number | null
          sku?: string | null
          slug?: string | null
          source?: string
          status?: string
          subcategory?: string | null
          tags?: string[] | null
          tenant_id?: string
          track_inventory?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_artifacts: {
        Row: {
          artifact_type: string
          created_at: string
          data: Json | null
          embedding: string | null
          external_id: string
          id: string
          import_job_id: string
          member_count: number | null
          name: string
          provider: string
          tenant_id: string
        }
        Insert: {
          artifact_type: string
          created_at?: string
          data?: Json | null
          embedding?: string | null
          external_id: string
          id?: string
          import_job_id: string
          member_count?: number | null
          name: string
          provider: string
          tenant_id: string
        }
        Update: {
          artifact_type?: string
          created_at?: string
          data?: Json | null
          embedding?: string | null
          external_id?: string
          id?: string
          import_job_id?: string
          member_count?: number | null
          name?: string
          provider?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_artifacts_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_connections: {
        Row: {
          connected_at: string | null
          created_at: string | null
          encrypted_access_token: string | null
          id: string
          metadata: Json | null
          provider: string
          provider_account_id: string | null
          provider_account_name: string | null
          revoked_at: string | null
          status: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          encrypted_access_token?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          revoked_at?: string | null
          status?: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          encrypted_access_token?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          revoked_at?: string | null
          status?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "provider_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reported_problem_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          problem_id: string
          storage_bucket: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          problem_id: string
          storage_bucket?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          problem_id?: string
          storage_bucket?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reported_problem_attachments_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "reported_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      reported_problems: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          browser_info: Json | null
          captured_url: string
          created_at: string | null
          description: string
          id: string
          priority: string | null
          resolved_at: string | null
          status: string | null
          tenant_id: string
          title: string
          updated_at: string | null
          user_agent: string | null
          user_email: string
          user_id: string
          viewport_size: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          browser_info?: Json | null
          captured_url: string
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
          user_agent?: string | null
          user_email: string
          user_id: string
          viewport_size?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          browser_info?: Json | null
          captured_url?: string
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          user_agent?: string | null
          user_email?: string
          user_id?: string
          viewport_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reported_problems_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "reported_problems_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_blocks: {
        Row: {
          block_type: string
          content: Json
          created_at: string
          id: string
          is_bloomsuite_block: boolean | null
          is_favorite: boolean | null
          name: string
          tags: string[] | null
          tenant_id: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          block_type: string
          content?: Json
          created_at?: string
          id?: string
          is_bloomsuite_block?: boolean | null
          is_favorite?: boolean | null
          name: string
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          block_type?: string
          content?: Json
          created_at?: string
          id?: string
          is_bloomsuite_block?: boolean | null
          is_favorite?: boolean | null
          name?: string
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      saved_campaign_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          layout_json: Json
          name: string
          tags: string[] | null
          tenant_id: string | null
          thumbnail_url: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout_json?: Json
          name: string
          tags?: string[] | null
          tenant_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout_json?: Json
          name?: string
          tags?: string[] | null
          tenant_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          content_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          insights_fetched: boolean | null
          mode: Database["public"]["Enums"]["post_mode"]
          platform: Database["public"]["Enums"]["platform_type"]
          publish_at: string
          published_id: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["post_status"] | null
          task_id: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          insights_fetched?: boolean | null
          mode?: Database["public"]["Enums"]["post_mode"]
          platform: Database["public"]["Enums"]["platform_type"]
          publish_at: string
          published_id?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["post_status"] | null
          task_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          insights_fetched?: boolean | null
          mode?: Database["public"]["Enums"]["post_mode"]
          platform?: Database["public"]["Enums"]["platform_type"]
          publish_at?: string
          published_id?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["post_status"] | null
          task_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "generated_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "content_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          count_cached: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_computed_at: string | null
          name: string
          query_json: Json
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          count_cached?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_computed_at?: string | null
          name: string
          query_json: Json
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          count_cached?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_computed_at?: string | null
          name?: string
          query_json?: Json
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sms_automation_logs: {
        Row: {
          automation_id: string | null
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          message_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string | null
          step_number: number
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string | null
          step_number: number
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string | null
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "sms_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_automation_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_automations: {
        Row: {
          created_at: string
          description: string | null
          flow: Json
          id: string
          name: string
          status: string | null
          tenant_id: string | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flow: Json
          id?: string
          name: string
          status?: string | null
          tenant_id?: string | null
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flow?: Json
          id?: string
          name?: string
          status?: string | null
          tenant_id?: string | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sms_automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_compliance_events: {
        Row: {
          created_at: string | null
          customer_id: string | null
          event_type: string
          id: string
          message_content: string | null
          metadata: Json | null
          phone: string
          source: string | null
          tenant_id: string | null
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          event_type: string
          id?: string
          message_content?: string | null
          metadata?: Json | null
          phone: string
          source?: string | null
          tenant_id?: string | null
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          event_type?: string
          id?: string
          message_content?: string | null
          metadata?: Json | null
          phone?: string
          source?: string | null
          tenant_id?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_compliance_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_compliance_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_compliance_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sms_compliance_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          attempts: number
          campaign_id: string | null
          content: string
          created_at: string
          customer_id: string | null
          dead_lettered_at: string | null
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          failure_type: string | null
          from_phone: string | null
          id: string
          last_attempt_at: string | null
          media_urls: Json | null
          phone: string
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id?: string | null
          content: string
          created_at?: string
          customer_id?: string | null
          dead_lettered_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failure_type?: string | null
          from_phone?: string | null
          id?: string
          last_attempt_at?: string | null
          media_urls?: Json | null
          phone: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string | null
          content?: string
          created_at?: string
          customer_id?: string | null
          dead_lettered_at?: string | null
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          failure_type?: string | null
          from_phone?: string | null
          id?: string
          last_attempt_at?: string | null
          media_urls?: Json | null
          phone?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_sms_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_rate_limit_state: {
        Row: {
          id: string
          sending_identity_id: string
          sent_in_window: number
          tenant_id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          id?: string
          sending_identity_id: string
          sent_in_window?: number
          tenant_id: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          id?: string
          sending_identity_id?: string
          sent_in_window?: number
          tenant_id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      sms_send_jobs: {
        Row: {
          attempts: number
          batch_index: number
          campaign_id: string | null
          claim_token: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          dead_lettered_at: string | null
          error_message: string | null
          from_phone: string | null
          id: string
          messaging_service_sid: string | null
          partition_key: string | null
          priority: number
          recipient_message_ids: string[]
          scheduled_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          batch_index: number
          campaign_id?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          dead_lettered_at?: string | null
          error_message?: string | null
          from_phone?: string | null
          id?: string
          messaging_service_sid?: string | null
          partition_key?: string | null
          priority?: number
          recipient_message_ids: string[]
          scheduled_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          batch_index?: number
          campaign_id?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          dead_lettered_at?: string | null
          error_message?: string | null
          from_phone?: string | null
          id?: string
          messaging_service_sid?: string | null
          partition_key?: string | null
          priority?: number
          recipient_message_ids?: string[]
          scheduled_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_send_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_sms_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_warmup_stage_rules: {
        Row: {
          created_at: string | null
          daily_limit: number
          required_healthy_days: number
          stage: number
        }
        Insert: {
          created_at?: string | null
          daily_limit: number
          required_healthy_days: number
          stage: number
        }
        Update: {
          created_at?: string | null
          daily_limit?: number
          required_healthy_days?: number
          stage?: number
        }
        Relationships: []
      }
      social_connections: {
        Row: {
          access_token: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          page_id: string | null
          platform: string
          platform_account_id: string
          platform_account_name: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          page_id?: string | null
          platform: string
          platform_account_id: string
          platform_account_name?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          page_id?: string | null
          platform?: string
          platform_account_id?: string
          platform_account_name?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          api_response: Json | null
          content: string
          content_id: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          image_url: string | null
          media_url: string | null
          platform: string | null
          platform_post_id: string | null
          platform_post_url: string | null
          publish_at: string | null
          published_at: string | null
          social_connection_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_response?: Json | null
          content: string
          content_id?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          media_url?: string | null
          platform?: string | null
          platform_post_id?: string | null
          platform_post_url?: string | null
          publish_at?: string | null
          published_at?: string | null
          social_connection_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_response?: Json | null
          content?: string
          content_id?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          media_url?: string | null
          platform?: string | null
          platform_post_id?: string | null
          platform_post_url?: string | null
          publish_at?: string | null
          published_at?: string | null
          social_connection_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_social_posts_content_id"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_social_connection_id_fkey"
            columns: ["social_connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      square_connections: {
        Row: {
          connected_at: string | null
          created_at: string | null
          customers_synced: number | null
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          environment: string | null
          expires_at: string
          id: string
          last_customer_sync: string | null
          last_product_sync: string | null
          last_sales_sync: string | null
          last_synced_at: string | null
          location_id: string | null
          merchant_id: string | null
          merchant_name: string | null
          products_synced: number | null
          sales_synced: number | null
          setup_wizard_completed_at: string | null
          status: string | null
          sync_errors: Json | null
          tenant_id: string
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          environment?: string | null
          expires_at: string
          id?: string
          last_customer_sync?: string | null
          last_product_sync?: string | null
          last_sales_sync?: string | null
          last_synced_at?: string | null
          location_id?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          products_synced?: number | null
          sales_synced?: number | null
          setup_wizard_completed_at?: string | null
          status?: string | null
          sync_errors?: Json | null
          tenant_id: string
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          customers_synced?: number | null
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          environment?: string | null
          expires_at?: string
          id?: string
          last_customer_sync?: string | null
          last_product_sync?: string | null
          last_sales_sync?: string | null
          last_synced_at?: string | null
          location_id?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          products_synced?: number | null
          sales_synced?: number | null
          setup_wizard_completed_at?: string | null
          status?: string | null
          sync_errors?: Json | null
          tenant_id?: string
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "square_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "square_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          base_token_allowance: number | null
          billing_interval:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          contacts_limit: number | null
          created_at: string
          crm_enabled: boolean | null
          deleted_at: string | null
          email_overage_price: number | null
          email_quota: number | null
          email_usage: number | null
          end_date: string
          id: string
          is_founding_customer: boolean | null
          max_connections: number | null
          max_posts_per_month: number | null
          overage_emails_this_month: number | null
          overage_sms_this_month: number | null
          overage_token_price: number | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          sms_enabled: boolean | null
          sms_overage_price: number | null
          sms_quota: number | null
          sms_usage: number | null
          start_date: string
          stripe_subscription_item_id: string | null
          tier: string | null
          updated_at: string
          usage_alert_100_sent_at: string | null
          usage_alert_80_sent_at: string | null
          user_id: string
        }
        Insert: {
          base_token_allowance?: number | null
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          contacts_limit?: number | null
          created_at?: string
          crm_enabled?: boolean | null
          deleted_at?: string | null
          email_overage_price?: number | null
          email_quota?: number | null
          email_usage?: number | null
          end_date: string
          id?: string
          is_founding_customer?: boolean | null
          max_connections?: number | null
          max_posts_per_month?: number | null
          overage_emails_this_month?: number | null
          overage_sms_this_month?: number | null
          overage_token_price?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          sms_enabled?: boolean | null
          sms_overage_price?: number | null
          sms_quota?: number | null
          sms_usage?: number | null
          start_date?: string
          stripe_subscription_item_id?: string | null
          tier?: string | null
          updated_at?: string
          usage_alert_100_sent_at?: string | null
          usage_alert_80_sent_at?: string | null
          user_id: string
        }
        Update: {
          base_token_allowance?: number | null
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          contacts_limit?: number | null
          created_at?: string
          crm_enabled?: boolean | null
          deleted_at?: string | null
          email_overage_price?: number | null
          email_quota?: number | null
          email_usage?: number | null
          end_date?: string
          id?: string
          is_founding_customer?: boolean | null
          max_connections?: number | null
          max_posts_per_month?: number | null
          overage_emails_this_month?: number | null
          overage_sms_this_month?: number | null
          overage_token_price?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          sms_enabled?: boolean | null
          sms_overage_price?: number | null
          sms_quota?: number | null
          sms_usage?: number | null
          start_date?: string
          stripe_subscription_item_id?: string | null
          tier?: string | null
          updated_at?: string
          usage_alert_100_sent_at?: string | null
          usage_alert_80_sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_attachments: {
        Row: {
          comment_id: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          storage_bucket: string | null
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          storage_bucket?: string | null
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          storage_bucket?: string | null
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "support_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "support_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_comments: {
        Row: {
          comment_text: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          is_system: boolean | null
          metadata: Json | null
          ticket_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          ticket_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          ticket_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          metadata: Json | null
          notification_type: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          notification_type: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          notification_type?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_history: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          ticket_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category_id: string | null
          created_at: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          tenant_id: string
          ticket_number: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category_id?: string | null
          created_at?: string | null
          description: string
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          tenant_id: string
          ticket_number: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject?: string
          tenant_id?: string
          ticket_number?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "support_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_list: {
        Row: {
          auto_suppressed: boolean | null
          channel: string
          created_at: string | null
          customer_id: string | null
          email: string | null
          expires_at: string | null
          id: string
          lifted_at: string | null
          lifted_by: string | null
          phone: string | null
          reason: string | null
          source_event_id: string | null
          suppressed_at: string | null
          suppression_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auto_suppressed?: boolean | null
          channel: string
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          phone?: string | null
          reason?: string | null
          source_event_id?: string | null
          suppressed_at?: string | null
          suppression_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auto_suppressed?: boolean | null
          channel?: string
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          phone?: string | null
          reason?: string | null
          source_event_id?: string | null
          suppressed_at?: string | null
          suppression_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppression_list_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_360_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppression_list_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "negative_behavior_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppression_list_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "suppression_list_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_paid: boolean
          max_members: number
          name: string
          owner_id: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_paid?: boolean
          max_members?: number
          name: string
          owner_id: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_paid?: boolean
          max_members?: number
          name?: string
          owner_id?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenant_lifecycle_thresholds: {
        Row: {
          active_to_at_risk_days: number | null
          active_to_loyal_days: number | null
          at_risk_to_dormant_days: number | null
          created_at: string | null
          dormant_to_churned_days: number | null
          engaged_to_active_buyer_purchase_count: number | null
          id: string
          new_to_engaged_engagement_count: number | null
          reactivation_engagement_required: boolean | null
          reactivation_purchase_required: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active_to_at_risk_days?: number | null
          active_to_loyal_days?: number | null
          at_risk_to_dormant_days?: number | null
          created_at?: string | null
          dormant_to_churned_days?: number | null
          engaged_to_active_buyer_purchase_count?: number | null
          id?: string
          new_to_engaged_engagement_count?: number | null
          reactivation_engagement_required?: boolean | null
          reactivation_purchase_required?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active_to_at_risk_days?: number | null
          active_to_loyal_days?: number | null
          at_risk_to_dormant_days?: number | null
          created_at?: string | null
          dormant_to_churned_days?: number | null
          engaged_to_active_buyer_purchase_count?: number | null
          id?: string
          new_to_engaged_engagement_count?: number | null
          reactivation_engagement_required?: boolean | null
          reactivation_purchase_required?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_lifecycle_thresholds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_lifecycle_thresholds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          archived_at: string | null
          city: string | null
          country: string | null
          created_at: string
          fallback_from_name: string | null
          fallback_sender_created_at: string | null
          fallback_sender_email: string | null
          id: string
          is_active: boolean
          last_event_at: string | null
          name: string
          region: string | null
          settings: Json | null
          slug: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          fallback_from_name?: string | null
          fallback_sender_created_at?: string | null
          fallback_sender_email?: string | null
          id?: string
          is_active?: boolean
          last_event_at?: string | null
          name: string
          region?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          fallback_from_name?: string | null
          fallback_sender_created_at?: string | null
          fallback_sender_email?: string | null
          id?: string
          is_active?: boolean
          last_event_at?: string | null
          name?: string
          region?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      tier_limits: {
        Row: {
          created_at: string | null
          email_limit: number
          email_overage_rate: number | null
          includes_website: boolean | null
          price_annual: number | null
          price_monthly: number
          sms_limit: number
          sms_overage_rate: number | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_limit: number
          email_overage_rate?: number | null
          includes_website?: boolean | null
          price_annual?: number | null
          price_monthly: number
          sms_limit: number
          sms_overage_rate?: number | null
          tier: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_limit?: number
          email_overage_rate?: number | null
          includes_website?: boolean | null
          price_annual?: number | null
          price_monthly?: number
          sms_limit?: number
          sms_overage_rate?: number | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          action_type: string
          campaign_id: string | null
          content_type: string | null
          created_at: string
          id: string
          metadata: Json | null
          tokens_consumed: number
          tokens_remaining: number
          user_id: string
        }
        Insert: {
          action_type: string
          campaign_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_consumed: number
          tokens_remaining: number
          user_id: string
        }
        Update: {
          action_type?: string
          campaign_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_consumed?: number
          tokens_remaining?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_expiration_emails: {
        Row: {
          created_at: string
          days_remaining: number
          email_sent_at: string
          email_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_remaining: number
          email_sent_at?: string
          email_type?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_remaining?: number
          email_sent_at?: string
          email_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      tutorial_progress: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          step: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          step: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          step?: string
          user_id?: string
        }
        Relationships: []
      }
      twilio_phone_numbers: {
        Row: {
          bounce_rate_30d: number | null
          capabilities: Json | null
          created_at: string | null
          daily_limit: number | null
          daily_sent_count: number
          failure_rate_30d: number | null
          friendly_name: string
          healthy_days_counter: number
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_health_evaluated_at: string | null
          last_reset_at: string | null
          last_stage_updated_at: string | null
          messaging_service_sid: string | null
          phone_number: string
          tenant_id: string
          updated_at: string | null
          warmup_stage: number
        }
        Insert: {
          bounce_rate_30d?: number | null
          capabilities?: Json | null
          created_at?: string | null
          daily_limit?: number | null
          daily_sent_count?: number
          failure_rate_30d?: number | null
          friendly_name: string
          healthy_days_counter?: number
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_health_evaluated_at?: string | null
          last_reset_at?: string | null
          last_stage_updated_at?: string | null
          messaging_service_sid?: string | null
          phone_number: string
          tenant_id: string
          updated_at?: string | null
          warmup_stage?: number
        }
        Update: {
          bounce_rate_30d?: number | null
          capabilities?: Json | null
          created_at?: string | null
          daily_limit?: number | null
          daily_sent_count?: number
          failure_rate_30d?: number | null
          friendly_name?: string
          healthy_days_counter?: number
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_health_evaluated_at?: string | null
          last_reset_at?: string | null
          last_stage_updated_at?: string | null
          messaging_service_sid?: string | null
          phone_number?: string
          tenant_id?: string
          updated_at?: string | null
          warmup_stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "twilio_phone_numbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "twilio_phone_numbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_alert_settings: {
        Row: {
          auto_pause_at_limit: boolean | null
          created_at: string | null
          email_critical_threshold: number | null
          email_notifications_enabled: boolean | null
          email_warning_threshold: number | null
          id: string
          in_app_notifications_enabled: boolean | null
          pos_sync_frequency: string | null
          sms_critical_threshold: number | null
          sms_warning_threshold: number | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_pause_at_limit?: boolean | null
          created_at?: string | null
          email_critical_threshold?: number | null
          email_notifications_enabled?: boolean | null
          email_warning_threshold?: number | null
          id?: string
          in_app_notifications_enabled?: boolean | null
          pos_sync_frequency?: string | null
          sms_critical_threshold?: number | null
          sms_warning_threshold?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_pause_at_limit?: boolean | null
          created_at?: string | null
          email_critical_threshold?: number | null
          email_notifications_enabled?: boolean | null
          email_warning_threshold?: number | null
          id?: string
          in_app_notifications_enabled?: boolean | null
          pos_sync_frequency?: string | null
          sms_critical_threshold?: number | null
          sms_warning_threshold?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_alert_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "usage_alert_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_agreement_acceptances: {
        Row: {
          accepted_at: string
          agreement_name: string
          agreement_version: string
          business_name: string | null
          created_at: string
          id: string
          ip_address: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          agreement_name: string
          agreement_version: string
          business_name?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          agreement_name?: string
          agreement_version?: string
          business_name?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agreement_acceptances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_agreement_acceptances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          created_at: string | null
          credentials: Json
          id: string
          integration_type: string
          is_active: boolean | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials?: Json
          id?: string
          integration_type: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          id?: string
          integration_type?: string
          is_active?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_segment_preferences: {
        Row: {
          created_at: string
          custom_segments: Json
          id: string
          preferred_segments: Json
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_segments?: Json
          id?: string
          preferred_segments?: Json
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_segments?: Json
          id?: string
          preferred_segments?: Json
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_support_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["support_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["support_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["support_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_support_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_support_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_theme_status: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          status: string | null
          tenant_id: string | null
          theme_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          status?: string | null
          tenant_id?: string | null
          theme_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          status?: string | null
          tenant_id?: string | null
          theme_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_theme_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_theme_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          email: string
          full_name: string | null
          id: string
          last_sign_in_at: string | null
          name: string
          role: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          email: string
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          name: string
          role?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          name?: string
          role?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_stage_rules: {
        Row: {
          created_at: string | null
          daily_limit: number
          required_healthy_days: number
          stage: number
        }
        Insert: {
          created_at?: string | null
          daily_limit: number
          required_healthy_days: number
          stage: number
        }
        Update: {
          created_at?: string | null
          daily_limit?: number
          required_healthy_days?: number
          stage?: number
        }
        Relationships: []
      }
      website_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_tenant_overview: {
        Row: {
          archived_at: string | null
          city: string | null
          company_name: string | null
          country: string | null
          current_period_end: string | null
          is_active: boolean | null
          is_paid_active: boolean | null
          is_trialing: boolean | null
          last_activity_at: string | null
          onboarding_completed_at: string | null
          plan: Database["public"]["Enums"]["subscription_plan"] | null
          primary_contact_email: string | null
          primary_contact_last_login: string | null
          primary_contact_name: string | null
          region: string | null
          subscription_status: string | null
          tenant_created_at: string | null
          tenant_id: string | null
          trial_end: string | null
          trial_not_expired: boolean | null
          trial_start: string | null
          website: string | null
        }
        Relationships: []
      }
      content_library_view: {
        Row: {
          approved_count: number | null
          bundle_id: string | null
          channels: Json | null
          created_at: string | null
          deleted_at: string | null
          mode: string | null
          recommended_images: Json | null
          snapshot_id: string | null
          source_label: string | null
          thumbnail: string | null
          total_items: number | null
          updated_at: string | null
          user_id: string | null
          version: number | null
          workspace_id: string | null
        }
        Insert: {
          approved_count?: never
          bundle_id?: string | null
          channels?: never
          created_at?: string | null
          deleted_at?: string | null
          mode?: never
          recommended_images?: never
          snapshot_id?: string | null
          source_label?: never
          thumbnail?: never
          total_items?: never
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
          workspace_id?: string | null
        }
        Update: {
          approved_count?: never
          bundle_id?: string | null
          channels?: never
          created_at?: string | null
          deleted_at?: string | null
          mode?: never
          recommended_images?: never
          snapshot_id?: string | null
          source_label?: never
          thumbnail?: never
          total_items?: never
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      customer_360_enriched: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string | null
          email: string | null
          email_bounce_rate: number | null
          email_click_rate: number | null
          email_last_clicked_at: string | null
          email_last_opened_at: string | null
          email_last_sent_at: string | null
          email_open_rate: number | null
          email_total_bounced: number | null
          email_total_clicked: number | null
          email_total_delivered: number | null
          email_total_opened: number | null
          email_total_sent: number | null
          email_total_unsubscribes: number | null
          engagement_email_score: number | null
          engagement_last_calculated_at: string | null
          engagement_overall_score: number | null
          engagement_purchase_score: number | null
          engagement_sms_score: number | null
          engagement_tier: string | null
          first_name: string | null
          first_seen_at: string | null
          id: string | null
          last_name: string | null
          last_seen_at: string | null
          phone: string | null
          postal_code: string | null
          preferred_channel: string | null
          signup_campaign: string | null
          signup_source: string | null
          sms_avg_response_time_minutes: number | null
          sms_click_rate: number | null
          sms_delivery_rate: number | null
          sms_engagement_score: number | null
          sms_last_clicked_at: string | null
          sms_last_delivered_at: string | null
          sms_last_opt_out_at: string | null
          sms_last_replied_at: string | null
          sms_last_sent_at: string | null
          sms_opt_out_rate: number | null
          sms_reply_rate: number | null
          sms_total_clicked: number | null
          sms_total_delivered: number | null
          sms_total_failed: number | null
          sms_total_opt_outs: number | null
          sms_total_replied: number | null
          sms_total_sent: number | null
          state_region: string | null
          store_id: string | null
          store_name: string | null
          tenant_id: string | null
          timezone: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "admin_tenant_overview"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "crm_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverability_summary_30d: {
        Row: {
          bounce_rate: number | null
          bounced_30d: number | null
          campaign_1_open_rate: number | null
          campaign_2_open_rate: number | null
          campaign_3_open_rate: number | null
          campaign_count_30d: number | null
          click_rate: number | null
          clicked_30d: number | null
          complained_30d: number | null
          complaint_rate: number | null
          daily_limit: number | null
          delivered_30d: number | null
          domain_id: string | null
          domain_name: string | null
          open_rate: number | null
          opened_30d: number | null
          sent_30d: number | null
          tenant_id: string | null
          verification_status: string | null
          warmup_stage: number | null
        }
        Relationships: []
      }
      email_domain_stats_30d: {
        Row: {
          bounce_rate_30d: number | null
          click_rate_30d: number | null
          complaint_rate_30d: number | null
          daily_limit: number | null
          daily_used: number | null
          domain_id: string | null
          domain_name: string | null
          emails_bounced_30d: number | null
          emails_clicked_30d: number | null
          emails_complained_30d: number | null
          emails_delivered_30d: number | null
          emails_opened_30d: number | null
          emails_sent_30d: number | null
          open_rate_30d: number | null
          tenant_id: string | null
          verification_status: string | null
          warmup_stage: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user: { Args: { target_user_id: string }; Returns: boolean }
      admin_extend_trial: {
        Args: { p_days: number; p_tenant_id: string }
        Returns: undefined
      }
      admin_extend_trial_by_email: {
        Args: { p_days: number; p_email: string }
        Returns: Json
      }
      admin_get_stats: {
        Args: never
        Returns: {
          active_trials: number
          inactive_tenants: number
          paid_active: number
          total_tenants: number
        }[]
      }
      admin_list_tenants: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          city: string
          company_name: string
          country: string
          current_period_end: string
          is_active: boolean
          is_paid_active: boolean
          is_trialing: boolean
          last_activity_at: string
          onboarding_completed_at: string
          plan: string
          primary_contact_email: string
          primary_contact_last_login: string
          primary_contact_name: string
          region: string
          subscription_status: string
          tenant_created_at: string
          tenant_id: string
          trial_end: string
          trial_not_expired: boolean
          trial_start: string
          website: string
        }[]
      }
      admin_toggle_tenant_active: {
        Args: { p_active: boolean; p_tenant_id: string }
        Returns: undefined
      }
      advance_automation_step: {
        Args: { p_next_scheduled_at?: string; p_run_id: string }
        Returns: boolean
      }
      bundle_approved_counts: { Args: { j: Json }; Returns: Json }
      bundle_channels: { Args: { j: Json }; Returns: string[] }
      bundle_first_media_url: { Args: { j: Json }; Returns: string }
      calculate_churn_risk_score: {
        Args: { p_customer_id: string }
        Returns: number
      }
      calculate_content_intent_score: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      calculate_tenant_perks_enrollment_rate: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      can_run_automation: { Args: { p_tenant_id: string }; Returns: string }
      can_run_sync:
        | {
            Args: {
              p_org_id: string
              p_provider: Database["public"]["Enums"]["pos_provider"]
            }
            Returns: Json
          }
        | {
            Args: { p_estimated_rows?: number; p_tenant_id: string }
            Returns: string
          }
      can_send_emails: {
        Args: { p_count?: number; p_tenant_id: string }
        Returns: string
      }
      can_send_sms: {
        Args: { p_count?: number; p_tenant_id: string }
        Returns: string
      }
      cancel_pos_sync_job: { Args: { p_job_id: string }; Returns: boolean }
      check_email_exists: { Args: { email_to_check: string }; Returns: boolean }
      check_email_quota: {
        Args: { p_recipient_count: number; p_tenant_id: string }
        Returns: Json
      }
      check_send_quota: {
        Args: {
          p_domain_id?: string
          p_recipient_count?: number
          p_tenant_id: string
        }
        Returns: Json
      }
      check_sms_quota: {
        Args: { p_estimated_units: number; p_tenant_id: string }
        Returns: Json
      }
      check_trial_expiration_emails: { Args: never; Returns: number }
      claim_next_pos_sync_job: {
        Args: { p_provider?: Database["public"]["Enums"]["pos_provider"] }
        Returns: {
          attempts: number
          batch_size: number
          circuit_open_until: string | null
          completed_at: string | null
          consecutive_failures: number | null
          created_at: string
          current_batch: number
          current_cursor: string | null
          customers_synced: number
          error_count: number
          estimated_rows: number | null
          id: string
          is_delta: boolean
          last_error: string | null
          last_failure_at: string | null
          last_sync_cursor: string | null
          max_retries: number
          metadata: Json | null
          next_retry_at: string | null
          orders_synced: number
          processed_rows: number
          products_synced: number
          provider: Database["public"]["Enums"]["pos_provider"]
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["pos_job_status"]
          sync_type: Database["public"]["Enums"]["pos_sync_type"]
          tenant_id: string
          total_batches: number | null
          triggered_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pos_sync_jobs_v2"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_sms_campaign_enqueue: {
        Args: {
          p_campaign_id: string
          p_stale_minutes?: number
          p_worker_id: string
        }
        Returns: boolean
      }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      cleanup_old_oauth_codes: { Args: never; Returns: undefined }
      cleanup_stale_sync_jobs: { Args: never; Returns: number }
      complete_pos_sync_job: {
        Args: {
          p_cursor?: string
          p_customers?: number
          p_job_id: string
          p_orders?: number
          p_products?: number
          p_rows?: number
        }
        Returns: boolean
      }
      copy_master_templates_to_campaigns: {
        Args: { target_user_id?: string }
        Returns: number
      }
      create_automation_from_draft: {
        Args: { draft_id: string; template_key?: string }
        Returns: string
      }
      delete_customers_except: {
        Args: { p_keep_email: string; p_tenant_id: string }
        Returns: {
          deleted_count: number
        }[]
      }
      determine_lifecycle_stage: {
        Args: { p_customer_id: string }
        Returns: string
      }
      enable_crm_for_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      enqueue_pos_sync_job: {
        Args: {
          p_estimated_rows?: number
          p_provider: Database["public"]["Enums"]["pos_provider"]
          p_sync_type?: Database["public"]["Enums"]["pos_sync_type"]
          p_tenant_id: string
          p_triggered_by?: string
        }
        Returns: Json
      }
      ensure_org_usage_initialized: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      fail_pos_sync_job: {
        Args: { p_error: string; p_job_id: string }
        Returns: boolean
      }
      feature_enabled: { Args: { feature_name: string }; Returns: boolean }
      find_images_by_tags: {
        Args: {
          p_channel?: string
          p_limit?: number
          p_min_confidence?: number
          p_tags: string[]
        }
        Returns: {
          image_id: string
          match_count: number
          matched_tags: string[]
          public_url: string
          storage_path: string
          total_usage_count: number
        }[]
      }
      fn_get_newsletter_ideas: { Args: { p_user_id?: string }; Returns: Json }
      generate_campaign_slug: {
        Args: { campaign_id: string; campaign_title: string }
        Returns: string
      }
      generate_ticket_number: { Args: { p_tenant_id: string }; Returns: string }
      get_active_sync_job_count: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      get_admin_user_data: {
        Args: never
        Returns: {
          company_name: string
          company_overview: string
          created_at: string
          email: string
          location_info: string
          onboarding_completed_at: string
          subscription_end_date: string
          subscription_plan: string
          subscription_status: string
          tokens_balance: number
          user_id: string
        }[]
      }
      get_customer_activity_heatmap: {
        Args: { p_channel?: string; p_customer_id: string }
        Returns: {
          day_of_week: number
          event_count: number
          hour_of_day: number
        }[]
      }
      get_customer_channel_trend: {
        Args: { p_customer_id: string; p_months?: number }
        Returns: {
          month_label: string
          preferred_channel: string
        }[]
      }
      get_customer_engagement_decay: {
        Args: { p_customer_id: string }
        Returns: {
          engagement_percentage: number
          week_number: number
        }[]
      }
      get_customer_engagement_timeline: {
        Args: { p_customer_id: string; p_months?: number }
        Returns: {
          email_events: number
          engagement_score: number
          period_date: string
          sms_events: number
        }[]
      }
      get_customer_purchase_timeline: {
        Args: { p_customer_id: string; p_months?: number }
        Returns: {
          order_count: number
          period_date: string
          total_revenue: number
        }[]
      }
      get_customer_unified_timeline: {
        Args: {
          p_customer_id: string
          p_event_types?: string[]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          created_at: string
          description: string
          event_category: string
          event_type: string
          id: string
          impact: string
          metadata: Json
          title: string
        }[]
      }
      get_deliverability_status: {
        Args: { p_domain_id: string }
        Returns: Json
      }
      get_domain_email_stats_30d: {
        Args: { p_tenant_id?: string }
        Returns: {
          bounce_rate_30d: number
          click_rate_30d: number
          complaint_rate_30d: number
          daily_limit: number
          daily_used: number
          domain_id: string
          domain_name: string
          emails_bounced_30d: number
          emails_clicked_30d: number
          emails_complained_30d: number
          emails_delivered_30d: number
          emails_opened_30d: number
          emails_sent_30d: number
          open_rate_30d: number
          tenant_id: string
          verification_status: string
          warmup_stage: number
        }[]
      }
      get_domain_remaining_limit: {
        Args: { p_domain_id: string }
        Returns: {
          daily_limit: number
          daily_sent_count: number
          domain_id: string
          healthy_days_counter: number
          remaining_limit: number
          warmup_stage: number
        }[]
      }
      get_duplicate_merge_suggestions: {
        Args: never
        Returns: {
          accounts: Json
          email: string
          suggested_keep_user_id: string
          suggestion_reason: string
        }[]
      }
      get_email_consent_stats: {
        Args: { p_tenant_id: string }
        Returns: {
          opted_in_count: number
          opted_out_count: number
          total_customers: number
          unknown_count: number
        }[]
      }
      get_global_in_progress_count: { Args: never; Returns: number }
      get_next_message_sequence: {
        Args: { p_session_id: string }
        Returns: number
      }
      get_remaining_budget: { Args: { p_tenant_id: string }; Returns: Json }
      get_sms_warmup_info: {
        Args: { p_messaging_service_sid?: string; p_phone_number?: string }
        Returns: {
          daily_limit: number
          daily_sent_count: number
          healthy_days_counter: number
          last_reset_at: string
          last_stage_updated_at: string
          messaging_service_sid: string
          phone_number: string
          remaining_today: number
          sending_identity_id: string
          warmup_stage: number
        }[]
      }
      get_sync_queue_status: { Args: never; Returns: Json }
      get_tenant_content_intent_stats: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      get_tenant_lifecycle_stats: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      get_tenant_risk_stats: { Args: { p_tenant_id: string }; Returns: Json }
      get_token_balance: {
        Args: { p_user_id: string }
        Returns: {
          is_trial: boolean
          tokens_balance: number
          tokens_reset_at: string
        }[]
      }
      get_usage_stats: { Args: { p_user_id: string }; Returns: Json }
      get_user_image_analytics: {
        Args: never
        Returns: {
          avg_compression_ratio: number
          avg_usage_per_image: number
          optimized_images: number
          source_type: string
          total_compressed_size: number
          total_images: number
          total_original_size: number
          total_usage: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_support_role: {
        Args: {
          _role: Database["public"]["Enums"]["support_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      increment_image_usage: { Args: { asset_id: string }; Returns: undefined }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      is_master_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action_details?: Json
          p_action_type: string
          p_target_tenant_id?: string
          p_target_user_id?: string
        }
        Returns: string
      }
      log_import_batch_error: {
        Args: {
          p_batch_number: number
          p_error_message: string
          p_failed_items?: Json
          p_job_id: string
        }
        Returns: undefined
      }
      mark_expired_incentives: { Args: never; Returns: number }
      mark_onboarding_completed: {
        Args: { p_company?: string }
        Returns: undefined
      }
      merge_duplicate_accounts: {
        Args: { keep_user_id: string; merge_user_id: string }
        Returns: boolean
      }
      recalculate_content_intent_metrics: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_cross_channel_scores: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_customer_engagement: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_lifecycle_metrics: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_loyalty_metrics: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_post_purchase_metrics: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
      recalculate_purchase_metrics: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_risk_signals: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_sms_engagement_score: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      record_automation_usage: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      record_email_sends: {
        Args: { p_count?: number; p_tenant_id: string }
        Returns: boolean
      }
      record_email_usage: {
        Args: {
          p_bounces?: number
          p_complaints?: number
          p_count: number
          p_domain_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      record_sms_sends: {
        Args: { p_count?: number; p_tenant_id: string }
        Returns: boolean
      }
      record_sync_usage: {
        Args: {
          p_customers?: number
          p_orders?: number
          p_products?: number
          p_rows: number
          p_tenant_id: string
        }
        Returns: boolean
      }
      refill_tokens: {
        Args: { p_tokens?: number; p_user_id: string }
        Returns: boolean
      }
      refresh_all_content_intent_metrics: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      refresh_all_cross_channel_metrics: {
        Args: { p_tenant_id?: string }
        Returns: number
      }
      refresh_all_lifecycle_metrics: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      refresh_all_loyalty_metrics: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      refresh_all_post_purchase_metrics: {
        Args: { p_tenant_id?: string }
        Returns: number
      }
      refresh_all_purchase_metrics: {
        Args: { p_tenant_id?: string }
        Returns: number
      }
      refresh_all_risk_signals: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      reserve_sms_send_tokens: {
        Args: {
          p_max_tokens?: number
          p_sending_identity_id: string
          p_tenant_id: string
          p_tokens: number
          p_window_ms?: number
        }
        Returns: boolean
      }
      reset_master_admin_account: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      restore_user_data: { Args: { target_user_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_user_data: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      spend_tokens: {
        Args: {
          p_action_type?: string
          p_campaign_id?: string
          p_content_type?: string
          p_tokens: number
          p_user_id: string
        }
        Returns: boolean
      }
      track_content_interaction: {
        Args: {
          p_block_id?: string
          p_block_type?: string
          p_blocks_viewed?: number
          p_campaign_id?: string
          p_channel: string
          p_content_category?: string
          p_content_type: string
          p_cta_position?: number
          p_cta_type?: string
          p_customer_id: string
          p_device_type?: string
          p_interaction_type: string
          p_message_id?: string
          p_metadata?: Json
          p_scroll_depth_percent?: number
          p_session_id: string
          p_tenant_id: string
          p_time_since_send_seconds?: number
          p_time_spent_seconds?: number
        }
        Returns: string
      }
      track_global_image_usage: {
        Args: {
          p_block_id?: string
          p_campaign_id?: string
          p_context: string
          p_image_id: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      track_image_optimization: {
        Args: {
          asset_id: string
          compressed_size_bytes: number
          original_size_bytes: number
        }
        Returns: undefined
      }
      track_incentive_redeemed: {
        Args: {
          p_code: string
          p_customer_id: string
          p_discount_applied?: number
          p_order_id?: string
          p_order_total?: number
        }
        Returns: boolean
      }
      track_incentive_sent: {
        Args: {
          p_code?: string
          p_customer_id: string
          p_expires_at?: string
          p_incentive_type?: string
          p_source_id?: string
          p_source_type?: string
          p_tenant_id: string
          p_value?: number
          p_value_type?: string
        }
        Returns: string
      }
      track_loyalty_enrollment: {
        Args: {
          p_customer_id: string
          p_enrollment_source?: string
          p_tenant_id: string
        }
        Returns: string
      }
      track_negative_behavior_event: {
        Args: {
          p_automation_id?: string
          p_campaign_id?: string
          p_channel?: string
          p_customer_id: string
          p_event_subtype?: string
          p_event_type: string
          p_message_id?: string
          p_metadata?: Json
          p_tenant_id: string
        }
        Returns: string
      }
      track_points_earned: {
        Args: {
          p_customer_id: string
          p_description?: string
          p_order_id?: string
          p_points: number
          p_source_id?: string
          p_source_type: string
          p_tenant_id: string
        }
        Returns: string
      }
      track_points_redeemed: {
        Args: {
          p_customer_id: string
          p_description?: string
          p_order_id?: string
          p_order_total?: number
          p_points: number
          p_redemption_value?: number
          p_tenant_id: string
        }
        Returns: string
      }
      update_cross_channel_metrics: {
        Args: { p_channel: string; p_customer_id: string; p_event_type: string }
        Returns: undefined
      }
      update_customer_email_metrics: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      update_customer_purchase_metrics: {
        Args: {
          p_customer_id: string
          p_event_type?: string
          p_order_id?: string
        }
        Returns: undefined
      }
      update_customer_sms_metrics: {
        Args: {
          p_customer_id: string
          p_event_type: string
          p_message_sent_at?: string
          p_response_at?: string
        }
        Returns: undefined
      }
      update_domain_warmup: {
        Args: { p_domain_id: string }
        Returns: undefined
      }
      update_import_job_progress: {
        Args: {
          p_batch_stats?: Json
          p_current_stage: string
          p_job_id: string
          p_progress_percentage: number
        }
        Returns: undefined
      }
      update_loyalty_tier: {
        Args: { p_customer_id: string; p_new_tier: string; p_tenant_id: string }
        Returns: undefined
      }
      update_pos_sync_progress: {
        Args: {
          p_current_batch?: number
          p_cursor?: string
          p_job_id: string
          p_processed_rows: number
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "master_admin" | "admin" | "user"
      billing_interval: "monthly" | "annual"
      content_status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"
      draft_doc_type: "newsletter" | "automation" | "content_bundle"
      email_env: "prod" | "dev"
      platform_type: "FB" | "IG_FEED" | "IG_REEL"
      pos_job_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "failed"
        | "cancelled"
        | "delayed"
      pos_provider: "square" | "clover" | "lightspeed"
      pos_sync_type: "customers" | "orders" | "products" | "full"
      post_mode: "AUTO" | "MANUAL"
      post_status: "QUEUED" | "PUBLISHED" | "ERROR"
      subscription_plan: "free_trial" | "sprout" | "bloom" | "expired"
      support_role: "support_agent" | "support_admin"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "pending" | "in_progress" | "resolved" | "closed"
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
      app_role: ["master_admin", "admin", "user"],
      billing_interval: ["monthly", "annual"],
      content_status: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
      draft_doc_type: ["newsletter", "automation", "content_bundle"],
      email_env: ["prod", "dev"],
      platform_type: ["FB", "IG_FEED", "IG_REEL"],
      pos_job_status: [
        "pending",
        "in_progress",
        "completed",
        "failed",
        "cancelled",
        "delayed",
      ],
      pos_provider: ["square", "clover", "lightspeed"],
      pos_sync_type: ["customers", "orders", "products", "full"],
      post_mode: ["AUTO", "MANUAL"],
      post_status: ["QUEUED", "PUBLISHED", "ERROR"],
      subscription_plan: ["free_trial", "sprout", "bloom", "expired"],
      support_role: ["support_agent", "support_admin"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "pending", "in_progress", "resolved", "closed"],
    },
  },
} as const
