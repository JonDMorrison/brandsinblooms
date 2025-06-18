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
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          prompt: string | null
          source: string | null
          start_date: string
          theme: string | null
          title: string
          user_id: string | null
          week_number: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          prompt?: string | null
          source?: string | null
          start_date: string
          theme?: string | null
          title: string
          user_id?: string | null
          week_number: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          prompt?: string | null
          source?: string | null
          start_date?: string
          theme?: string | null
          title?: string
          user_id?: string | null
          week_number?: number
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          brand_voice: string | null
          company_name: string | null
          company_overview: string | null
          company_values: string | null
          created_at: string
          first_content_generated: boolean | null
          first_welcome_dismissed: boolean | null
          id: string
          ideal_customer: string | null
          location_info: string | null
          onboarding_completed_at: string | null
          seasonal_focus: string | null
          specializations: string | null
          target_audience: string | null
          tokens_balance: number | null
          tokens_reset_at: string | null
          tone_of_writing: string | null
          unique_selling_points: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_voice?: string | null
          company_name?: string | null
          company_overview?: string | null
          company_values?: string | null
          created_at?: string
          first_content_generated?: boolean | null
          first_welcome_dismissed?: boolean | null
          id?: string
          ideal_customer?: string | null
          location_info?: string | null
          onboarding_completed_at?: string | null
          seasonal_focus?: string | null
          specializations?: string | null
          target_audience?: string | null
          tokens_balance?: number | null
          tokens_reset_at?: string | null
          tone_of_writing?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_voice?: string | null
          company_name?: string | null
          company_overview?: string | null
          company_values?: string | null
          created_at?: string
          first_content_generated?: boolean | null
          first_welcome_dismissed?: boolean | null
          id?: string
          ideal_customer?: string | null
          location_info?: string | null
          onboarding_completed_at?: string | null
          seasonal_focus?: string | null
          specializations?: string | null
          target_audience?: string | null
          tokens_balance?: number | null
          tokens_reset_at?: string | null
          tone_of_writing?: string | null
          unique_selling_points?: string | null
          updated_at?: string
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
      content_tasks: {
        Row: {
          ai_output: string | null
          assigned_user_id: string | null
          campaign_id: string | null
          created_at: string
          hashtags: string | null
          holiday_id: string | null
          id: string
          image_idea: string | null
          notes: string | null
          post_type: string | null
          scheduled_date: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          ai_output?: string | null
          assigned_user_id?: string | null
          campaign_id?: string | null
          created_at?: string
          hashtags?: string | null
          holiday_id?: string | null
          id?: string
          image_idea?: string | null
          notes?: string | null
          post_type?: string | null
          scheduled_date?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          ai_output?: string | null
          assigned_user_id?: string | null
          campaign_id?: string | null
          created_at?: string
          hashtags?: string | null
          holiday_id?: string | null
          id?: string
          image_idea?: string | null
          notes?: string | null
          post_type?: string | null
          scheduled_date?: string | null
          status?: string
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
      social_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          platform: string
          platform_account_id: string
          platform_account_name: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          platform: string
          platform_account_id: string
          platform_account_name?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          platform?: string
          platform_account_id?: string
          platform_account_name?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          base_token_allowance: number | null
          billing_interval:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          created_at: string
          end_date: string
          id: string
          overage_token_price: number | null
          plan: Database["public"]["Enums"]["subscription_plan"]
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
          created_at?: string
          end_date: string
          id?: string
          overage_token_price?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
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
          created_at?: string
          end_date?: string
          id?: string
          overage_token_price?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
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
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_trial_expiration_emails: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      copy_master_templates_to_campaigns: {
        Args: { target_user_id?: string }
        Returns: number
      }
      get_token_balance: {
        Args: { p_user_id: string }
        Returns: {
          tokens_balance: number
          tokens_reset_at: string
          is_trial: boolean
        }[]
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      refill_tokens: {
        Args: { p_user_id: string; p_tokens?: number }
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
    }
    Enums: {
      billing_interval: "monthly" | "annual"
      subscription_plan: "free_trial" | "sprout" | "bloom" | "expired"
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
      billing_interval: ["monthly", "annual"],
      subscription_plan: ["free_trial", "sprout", "bloom", "expired"],
    },
  },
} as const
