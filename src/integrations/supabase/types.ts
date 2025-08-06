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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
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
          id: string
          image_url: string | null
          order_index: number
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
          id?: string
          image_url?: string | null
          order_index?: number
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
          id?: string
          image_url?: string | null
          order_index?: number
          persona_tag?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
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
      company_profiles: {
        Row: {
          beta_tour_enabled: boolean | null
          brand_voice: string | null
          company_name: string | null
          company_overview: string | null
          company_values: string | null
          compliance_settings: Json | null
          created_at: string
          crm_onboarding_completed_at: string | null
          custom_sender_email: string | null
          deleted_at: string | null
          dns_records_verified: boolean | null
          email_auth_setup_at: string | null
          email_auth_status: string | null
          email_domain: string | null
          feature_flags: Json | null
          first_content_generated: boolean | null
          first_welcome_dismissed: boolean | null
          id: string
          ideal_customer: string | null
          location_info: string | null
          onboarding_completed_at: string | null
          seasonal_focus: string | null
          specializations: string | null
          target_audience: string | null
          test_numbers: string[] | null
          tokens_balance: number | null
          tokens_reset_at: string | null
          tone_of_writing: string | null
          unique_selling_points: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          beta_tour_enabled?: boolean | null
          brand_voice?: string | null
          company_name?: string | null
          company_overview?: string | null
          company_values?: string | null
          compliance_settings?: Json | null
          created_at?: string
          crm_onboarding_completed_at?: string | null
          custom_sender_email?: string | null
          deleted_at?: string | null
          dns_records_verified?: boolean | null
          email_auth_setup_at?: string | null
          email_auth_status?: string | null
          email_domain?: string | null
          feature_flags?: Json | null
          first_content_generated?: boolean | null
          first_welcome_dismissed?: boolean | null
          id?: string
          ideal_customer?: string | null
          location_info?: string | null
          onboarding_completed_at?: string | null
          seasonal_focus?: string | null
          specializations?: string | null
          target_audience?: string | null
          test_numbers?: string[] | null
          tokens_balance?: number | null
          tokens_reset_at?: string | null
          tone_of_writing?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          beta_tour_enabled?: boolean | null
          brand_voice?: string | null
          company_name?: string | null
          company_overview?: string | null
          company_values?: string | null
          compliance_settings?: Json | null
          created_at?: string
          crm_onboarding_completed_at?: string | null
          custom_sender_email?: string | null
          deleted_at?: string | null
          dns_records_verified?: boolean | null
          email_auth_setup_at?: string | null
          email_auth_status?: string | null
          email_domain?: string | null
          feature_flags?: Json | null
          first_content_generated?: boolean | null
          first_welcome_dismissed?: boolean | null
          id?: string
          ideal_customer?: string | null
          location_info?: string | null
          onboarding_completed_at?: string | null
          seasonal_focus?: string | null
          specializations?: string | null
          target_audience?: string | null
          test_numbers?: string[] | null
          tokens_balance?: number | null
          tokens_reset_at?: string | null
          tone_of_writing?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          image_idea: string | null
          image_metadata: Json | null
          image_source: string | null
          image_url: string | null
          last_posting_error: string | null
          linked_crm_campaign_id: string | null
          notes: string | null
          platform_post_id: string | null
          platform_post_url: string | null
          post_type: string | null
          posting_attempts: number | null
          posting_disabled_at: string | null
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
          image_idea?: string | null
          image_metadata?: Json | null
          image_source?: string | null
          image_url?: string | null
          last_posting_error?: string | null
          linked_crm_campaign_id?: string | null
          notes?: string | null
          platform_post_id?: string | null
          platform_post_url?: string | null
          post_type?: string | null
          posting_attempts?: number | null
          posting_disabled_at?: string | null
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
          image_idea?: string | null
          image_metadata?: Json | null
          image_source?: string | null
          image_url?: string | null
          last_posting_error?: string | null
          linked_crm_campaign_id?: string | null
          notes?: string | null
          platform_post_id?: string | null
          platform_post_url?: string | null
          post_type?: string | null
          posting_attempts?: number | null
          posting_disabled_at?: string | null
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
          send_reasoning: string | null
          sender_display_name: string | null
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          source_content_task_id: string | null
          status: string | null
          subject_line: string | null
          synced_from: string | null
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
          send_reasoning?: string | null
          sender_display_name?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          source_content_task_id?: string | null
          status?: string | null
          subject_line?: string | null
          synced_from?: string | null
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
          send_reasoning?: string | null
          sender_display_name?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          source_content_task_id?: string | null
          status?: string | null
          subject_line?: string | null
          synced_from?: string | null
          tenant_id?: string | null
          total_clicks?: number | null
          total_opens?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "crm_segments"
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          created_at: string | null
          custom_fields: Json | null
          email: string
          first_name: string | null
          footer_last_sent_at: string | null
          id: string
          last_name: string | null
          last_purchase_date: string | null
          lifetime_value: number | null
          opt_out: boolean | null
          order_history: Json | null
          persona: string | null
          persona_assignment_method: string | null
          persona_confidence_score: number | null
          persona_id: string | null
          phone: string | null
          pos_source: string | null
          product_tags: string[] | null
          sms_opt_in: boolean | null
          sms_opt_in_at: string | null
          tags: string[] | null
          tenant_id: string | null
          timezone: string | null
          total_spent: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          custom_fields?: Json | null
          email: string
          first_name?: string | null
          footer_last_sent_at?: string | null
          id?: string
          last_name?: string | null
          last_purchase_date?: string | null
          lifetime_value?: number | null
          opt_out?: boolean | null
          order_history?: Json | null
          persona?: string | null
          persona_assignment_method?: string | null
          persona_confidence_score?: number | null
          persona_id?: string | null
          phone?: string | null
          pos_source?: string | null
          product_tags?: string[] | null
          sms_opt_in?: boolean | null
          sms_opt_in_at?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          timezone?: string | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          custom_fields?: Json | null
          email?: string
          first_name?: string | null
          footer_last_sent_at?: string | null
          id?: string
          last_name?: string | null
          last_purchase_date?: string | null
          lifetime_value?: number | null
          opt_out?: boolean | null
          order_history?: Json | null
          persona?: string | null
          persona_assignment_method?: string | null
          persona_confidence_score?: number | null
          persona_id?: string | null
          phone?: string | null
          pos_source?: string | null
          product_tags?: string[] | null
          sms_opt_in?: boolean | null
          sms_opt_in_at?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          timezone?: string | null
          total_spent?: number | null
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
            foreignKeyName: "crm_customers_tenant_id_fkey"
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
          content: string
          created_at: string | null
          customer_id: string
          error_message: string | null
          id: string
          max_retries: number | null
          message_type: string
          recipient: string
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_data: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          automation_id?: string | null
          content: string
          created_at?: string | null
          customer_id: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_type: string
          recipient: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_data?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          automation_id?: string | null
          content?: string
          created_at?: string | null
          customer_id?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_type?: string
          recipient?: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_data?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sms_campaigns: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          media_urls: Json | null
          message: string
          metrics: Json | null
          name: string
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          media_urls?: Json | null
          message: string
          metrics?: Json | null
          name: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          media_urls?: Json | null
          message?: string
          metrics?: Json | null
          name?: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string | null
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
      email_tracking_events: {
        Row: {
          campaign_id: string
          created_at: string
          customer_email: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_email: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_email?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
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
          ip_address: unknown | null
          metadata: Json | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          campaign_id: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          ip_address?: unknown | null
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
          id: string
          items: Json
          order_date: string
          pos_connection_id: string
          pos_customer_id: string | null
          raw_data: Json | null
          status: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          external_customer_id?: string | null
          external_id: string
          id?: string
          items?: Json
          order_date: string
          pos_connection_id: string
          pos_customer_id?: string | null
          raw_data?: Json | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          external_customer_id?: string | null
          external_id?: string
          id?: string
          items?: Json
          order_date?: string
          pos_connection_id?: string
          pos_customer_id?: string | null
          raw_data?: Json | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_pos_connection_id_fkey"
            columns: ["pos_connection_id"]
            isOneToOne: false
            referencedRelation: "pos_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_pos_customer_id_fkey"
            columns: ["pos_customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
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
      saved_blocks: {
        Row: {
          block_type: string
          content: Json
          created_at: string
          id: string
          is_bloomsuite_block: boolean | null
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
          content_id: string
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
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_id: string
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
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_id?: string
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
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          campaign_id: string | null
          content: string
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          media_urls: Json | null
          phone: string
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          content: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          media_urls?: Json | null
          phone: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          content?: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
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
          max_connections: number | null
          max_posts_per_month: number | null
          overage_token_price: number | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          sms_enabled: boolean | null
          sms_overage_price: number | null
          sms_quota: number | null
          sms_usage: number | null
          start_date: string
          stripe_subscription_item_id: string | null
          updated_at: string
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
          max_connections?: number | null
          max_posts_per_month?: number | null
          overage_token_price?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          sms_enabled?: boolean | null
          sms_overage_price?: number | null
          sms_quota?: number | null
          sms_usage?: number | null
          start_date?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
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
          max_connections?: number | null
          max_posts_per_month?: number | null
          overage_token_price?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          sms_enabled?: boolean | null
          sms_overage_price?: number | null
          sms_quota?: number | null
          sms_usage?: number | null
          start_date?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
          user_id?: string
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
      tenants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          settings: Json | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          settings?: Json | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json | null
          slug?: string | null
          updated_at?: string
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
          id: string
          name: string
          role: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          email: string
          id?: string
          name: string
          role?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      customer_360_enriched: {
        Row: {
          avg_order_value: number | null
          created_at: string | null
          custom_fields: Json | null
          customer_status: string | null
          email: string | null
          enriched_total_spent: number | null
          favorite_products: string | null
          first_name: string | null
          first_order_date: string | null
          footer_last_sent_at: string | null
          id: string | null
          last_name: string | null
          last_order_date: string | null
          last_purchase_date: string | null
          lifetime_value: number | null
          loyalty_status: string | null
          opt_out: boolean | null
          order_count: number | null
          order_history: Json | null
          persona: string | null
          persona_assignment_method: string | null
          persona_confidence_score: number | null
          persona_id: string | null
          phone: string | null
          pos_source: string | null
          product_categories: string | null
          product_tags: string[] | null
          sms_opt_in: boolean | null
          sms_opt_in_at: string | null
          tags: string[] | null
          tenant_id: string | null
          timezone: string | null
          total_spent: number | null
          updated_at: string | null
          user_id: string | null
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
            foreignKeyName: "crm_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      check_email_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      check_trial_expiration_emails: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_oauth_codes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      copy_master_templates_to_campaigns: {
        Args: { target_user_id?: string }
        Returns: number
      }
      create_automation_from_draft: {
        Args: { draft_id: string; template_key?: string }
        Returns: string
      }
      feature_enabled: {
        Args: { feature_name: string }
        Returns: boolean
      }
      fn_get_newsletter_ideas: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      generate_campaign_slug: {
        Args: { campaign_title: string; campaign_id: string }
        Returns: string
      }
      get_admin_user_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          email: string
          created_at: string
          company_name: string
          company_overview: string
          location_info: string
          tokens_balance: number
          onboarding_completed_at: string
          subscription_plan: string
          subscription_status: string
          subscription_end_date: string
        }[]
      }
      get_duplicate_merge_suggestions: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          accounts: Json
          suggested_keep_user_id: string
          suggestion_reason: string
        }[]
      }
      get_token_balance: {
        Args: { p_user_id: string }
        Returns: {
          tokens_balance: number
          tokens_reset_at: string
          is_trial: boolean
        }[]
      }
      get_user_image_analytics: {
        Args: Record<PropertyKey, never>
        Returns: {
          source_type: string
          total_images: number
          total_usage: number
          avg_usage_per_image: number
          optimized_images: number
          avg_compression_ratio: number
          total_original_size: number
          total_compressed_size: number
        }[]
      }
      increment_image_usage: {
        Args: { asset_id: string }
        Returns: undefined
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      merge_duplicate_accounts: {
        Args: { keep_user_id: string; merge_user_id: string }
        Returns: boolean
      }
      refill_tokens: {
        Args: { p_user_id: string; p_tokens?: number }
        Returns: boolean
      }
      reset_master_admin_account: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      restore_user_data: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      soft_delete_user_data: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      spend_tokens: {
        Args: {
          p_user_id: string
          p_tokens: number
          p_action_type?: string
          p_content_type?: string
          p_campaign_id?: string
        }
        Returns: boolean
      }
      track_image_optimization: {
        Args: {
          asset_id: string
          original_size_bytes: number
          compressed_size_bytes: number
        }
        Returns: undefined
      }
    }
    Enums: {
      billing_interval: "monthly" | "annual"
      content_status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"
      platform_type: "FB" | "IG_FEED" | "IG_REEL"
      post_mode: "AUTO" | "MANUAL"
      post_status: "QUEUED" | "PUBLISHED" | "ERROR"
      subscription_plan: "free_trial" | "sprout" | "bloom" | "expired"
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
      billing_interval: ["monthly", "annual"],
      content_status: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
      platform_type: ["FB", "IG_FEED", "IG_REEL"],
      post_mode: ["AUTO", "MANUAL"],
      post_status: ["QUEUED", "PUBLISHED", "ERROR"],
      subscription_plan: ["free_trial", "sprout", "bloom", "expired"],
    },
  },
} as const
