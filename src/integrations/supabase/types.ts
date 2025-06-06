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
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          prompt: string | null
          start_date: string
          theme: string | null
          title: string
          week_number: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          prompt?: string | null
          start_date: string
          theme?: string | null
          title: string
          week_number: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          prompt?: string | null
          start_date?: string
          theme?: string | null
          title?: string
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
          id: string
          ideal_customer: string | null
          location_info: string | null
          seasonal_focus: string | null
          specializations: string | null
          target_audience: string | null
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
          id?: string
          ideal_customer?: string | null
          location_info?: string | null
          seasonal_focus?: string | null
          specializations?: string | null
          target_audience?: string | null
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
          id?: string
          ideal_customer?: string | null
          location_info?: string | null
          seasonal_focus?: string | null
          specializations?: string | null
          target_audience?: string | null
          tone_of_writing?: string | null
          unique_selling_points?: string | null
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
          id: string
          image_idea: string | null
          notes: string | null
          post_type: string | null
          scheduled_date: string | null
          status: string
        }
        Insert: {
          ai_output?: string | null
          assigned_user_id?: string | null
          campaign_id?: string | null
          created_at?: string
          hashtags?: string | null
          id?: string
          image_idea?: string | null
          notes?: string | null
          post_type?: string | null
          scheduled_date?: string | null
          status?: string
        }
        Update: {
          ai_output?: string | null
          assigned_user_id?: string | null
          campaign_id?: string | null
          created_at?: string
          hashtags?: string | null
          id?: string
          image_idea?: string | null
          notes?: string | null
          post_type?: string | null
          scheduled_date?: string | null
          status?: string
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
        ]
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
      subscriptions: {
        Row: {
          billing_interval:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          created_at: string
          end_date: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          created_at?: string
          end_date: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          created_at?: string
          end_date?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string
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
      [_ in never]: never
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
