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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bots: {
        Row: {
          broker_connection_id: string | null
          created_at: string
          id: string
          name: string
          risk_profile: string
          status: string
          strategy_id: string | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          broker_connection_id?: string | null
          created_at?: string
          id?: string
          name: string
          risk_profile?: string
          status?: string
          strategy_id?: string | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          broker_connection_id?: string | null
          created_at?: string
          id?: string
          name?: string
          risk_profile?: string
          status?: string
          strategy_id?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bots_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bots_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connections: {
        Row: {
          account_name: string
          account_type: string | null
          broker_id: string
          connection_code: string | null
          created_at: string
          environment: string
          id: string
          last_seen_at: string | null
          mt5_login: string
          nickname: string | null
          server: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_type?: string | null
          broker_id: string
          connection_code?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_seen_at?: string | null
          mt5_login: string
          nickname?: string | null
          server: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_type?: string | null
          broker_id?: string
          connection_code?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_seen_at?: string | null
          mt5_login?: string
          nickname?: string | null
          server?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_connections_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          capabilities: Json
          connection_config: Json
          created_at: string
          id: string
          logo: string | null
          name: string
          slug: string
          sort_order: number
          status: string
          supported: boolean
        }
        Insert: {
          capabilities?: Json
          connection_config?: Json
          created_at?: string
          id?: string
          logo?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: string
          supported?: boolean
        }
        Update: {
          capabilities?: Json
          connection_config?: Json
          created_at?: string
          id?: string
          logo?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          supported?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          referral_code: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      strategies: {
        Row: {
          configuration: Json
          created_at: string
          description: string
          id: string
          markets: Json
          name: string
          slug: string
          status: string
          timeframe: string | null
        }
        Insert: {
          configuration?: Json
          created_at?: string
          description: string
          id?: string
          markets?: Json
          name: string
          slug: string
          status?: string
          timeframe?: string | null
        }
        Update: {
          configuration?: Json
          created_at?: string
          description?: string
          id?: string
          markets?: Json
          name?: string
          slug?: string
          status?: string
          timeframe?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          bot_id: string | null
          broker_connection_id: string | null
          closed_at: string | null
          created_at: string
          entry_price: number | null
          exit_price: number | null
          id: string
          opened_at: string | null
          profit: number | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          ticket: string | null
          type: string
          user_id: string
          volume: number | null
        }
        Insert: {
          bot_id?: string | null
          broker_connection_id?: string | null
          closed_at?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          profit?: number | null
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          ticket?: string | null
          type: string
          user_id: string
          volume?: number | null
        }
        Update: {
          bot_id?: string | null
          broker_connection_id?: string | null
          closed_at?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          profit?: number | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          ticket?: string | null
          type?: string
          user_id?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          active_connection_id: string | null
          created_at: string
          date_format: string
          default_currency: string
          default_risk_profile: string
          id: string
          language: string
          notifications: Json
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_connection_id?: string | null
          created_at?: string
          date_format?: string
          default_currency?: string
          default_risk_profile?: string
          id?: string
          language?: string
          notifications?: Json
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_connection_id?: string | null
          created_at?: string
          date_format?: string
          default_currency?: string
          default_risk_profile?: string
          id?: string
          language?: string
          notifications?: Json
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
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
