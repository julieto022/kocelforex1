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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bots: {
        Row: {
          broker_connection_id: string | null
          configuration: Json
          created_at: string
          id: string
          name: string
          risk_profile: string
          status: string
          strategy_id: string | null
          symbol: string
          timeframe: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          broker_connection_id?: string | null
          configuration?: Json
          created_at?: string
          id?: string
          name: string
          risk_profile?: string
          status?: string
          strategy_id?: string | null
          symbol: string
          timeframe?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          broker_connection_id?: string | null
          configuration?: Json
          created_at?: string
          id?: string
          name?: string
          risk_profile?: string
          status?: string
          strategy_id?: string | null
          symbol?: string
          timeframe?: string | null
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
          authorized_at: string | null
          broker_id: string
          created_at: string
          ea_version: string | null
          environment: string
          id: string
          last_connected_at: string | null
          last_seen_at: string | null
          mt5_login: string
          nickname: string | null
          revoked_at: string | null
          server: string
          status: string
          terminal_build: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_type?: string | null
          authorized_at?: string | null
          broker_id: string
          created_at?: string
          ea_version?: string | null
          environment?: string
          id?: string
          last_connected_at?: string | null
          last_seen_at?: string | null
          mt5_login: string
          nickname?: string | null
          revoked_at?: string | null
          server: string
          status?: string
          terminal_build?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_type?: string | null
          authorized_at?: string | null
          broker_id?: string
          created_at?: string
          ea_version?: string | null
          environment?: string
          id?: string
          last_connected_at?: string | null
          last_seen_at?: string | null
          mt5_login?: string
          nickname?: string | null
          revoked_at?: string | null
          server?: string
          status?: string
          terminal_build?: string | null
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
          description: string | null
          id: string
          logo: string | null
          name: string
          slug: string
          sort_order: number
          status: string
          supported: boolean
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          connection_config?: Json
          created_at?: string
          description?: string | null
          id?: string
          logo?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: string
          supported?: boolean
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          connection_config?: Json
          created_at?: string
          description?: string | null
          id?: string
          logo?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          supported?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      community_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          idea: Json | null
          image_url: string | null
          status: string
          symbol: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          idea?: Json | null
          image_url?: string | null
          status?: string
          symbol?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          idea?: Json | null
          image_url?: string | null
          status?: string
          symbol?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          description: string | null
          details: string | null
          id: string
          post_id: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          id?: string
          post_id?: string | null
          reason: string
          reporter_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_events: {
        Row: {
          actual: string | null
          category: string | null
          country: string | null
          created_at: string
          currency: string
          event_name: string
          event_time: string
          forecast: string | null
          id: string
          impact: string
          previous: string | null
          source: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          actual?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          currency: string
          event_name: string
          event_time: string
          forecast?: string | null
          id?: string
          impact?: string
          previous?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          actual?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          event_name?: string
          event_time?: string
          forecast?: string | null
          id?: string
          impact?: string
          previous?: string | null
          source?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      market_symbols: {
        Row: {
          asset_class: string
          broker_connection_id: string
          contract_size: number | null
          created_at: string
          digits: number | null
          display_name: string | null
          id: string
          max_volume: number | null
          min_volume: number | null
          point: number | null
          status: string
          symbol: string
          trade_mode: string | null
          updated_at: string
          user_id: string
          volume_step: number | null
        }
        Insert: {
          asset_class?: string
          broker_connection_id: string
          contract_size?: number | null
          created_at?: string
          digits?: number | null
          display_name?: string | null
          id?: string
          max_volume?: number | null
          min_volume?: number | null
          point?: number | null
          status?: string
          symbol: string
          trade_mode?: string | null
          updated_at?: string
          user_id: string
          volume_step?: number | null
        }
        Update: {
          asset_class?: string
          broker_connection_id?: string
          contract_size?: number | null
          created_at?: string
          digits?: number | null
          display_name?: string | null
          id?: string
          max_volume?: number | null
          min_volume?: number | null
          point?: number | null
          status?: string
          symbol?: string
          trade_mode?: string | null
          updated_at?: string
          user_id?: string
          volume_step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_symbols_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      mt5_authorization_requests: {
        Row: {
          account_name: string | null
          broker_hint: string | null
          connection_id: string | null
          created_at: string
          decided_at: string | null
          ea_version: string
          expires_at: string
          id: string
          mt5_login: string
          poll_token_hash: string
          server: string
          status: string
          terminal_build: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_name?: string | null
          broker_hint?: string | null
          connection_id?: string | null
          created_at?: string
          decided_at?: string | null
          ea_version: string
          expires_at: string
          id?: string
          mt5_login: string
          poll_token_hash: string
          server: string
          status?: string
          terminal_build?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_name?: string | null
          broker_hint?: string | null
          connection_id?: string | null
          created_at?: string
          decided_at?: string | null
          ea_version?: string
          expires_at?: string
          id?: string
          mt5_login?: string
          poll_token_hash?: string
          server?: string
          status?: string
          terminal_build?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mt5_authorization_requests_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          category: string
          content: string | null
          created_at: string
          currency: string | null
          id: string
          image_url: string | null
          impact: string
          published_at: string | null
          source: string | null
          source_url: string | null
          summary: string | null
          symbol: string | null
          symbols: Json
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          impact?: string
          published_at?: string | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          symbol?: string | null
          symbols?: Json
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          impact?: string
          published_at?: string | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          symbol?: string | null
          symbols?: Json
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      nfp_events: {
        Row: {
          actual: string | null
          created_at: string
          forecast: string | null
          id: string
          previous: string | null
          release_date: string
          release_time: string
          source: string | null
          status: string
          surprise: string | null
          updated_at: string
        }
        Insert: {
          actual?: string | null
          created_at?: string
          forecast?: string | null
          id?: string
          previous?: string | null
          release_date: string
          release_time: string
          source?: string | null
          status?: string
          surprise?: string | null
          updated_at?: string
        }
        Update: {
          actual?: string | null
          created_at?: string
          forecast?: string | null
          id?: string
          previous?: string | null
          release_date?: string
          release_time?: string
          source?: string | null
          status?: string
          surprise?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nfp_predictions: {
        Row: {
          actual: string | null
          analysis: string | null
          confidence: number | null
          confidence_breakdown: Json
          created_at: string
          eurusd_impact: string | null
          expected_impact: string | null
          factors: Json
          forecast: string | null
          gbpusd_impact: string | null
          gold_impact: string | null
          id: string
          nas100_impact: string | null
          nfp_event_id: string | null
          prediction: string | null
          previous: string | null
          release_date: string
          status: string
          updated_at: string
          usd_impact: string | null
        }
        Insert: {
          actual?: string | null
          analysis?: string | null
          confidence?: number | null
          confidence_breakdown?: Json
          created_at?: string
          eurusd_impact?: string | null
          expected_impact?: string | null
          factors?: Json
          forecast?: string | null
          gbpusd_impact?: string | null
          gold_impact?: string | null
          id?: string
          nas100_impact?: string | null
          nfp_event_id?: string | null
          prediction?: string | null
          previous?: string | null
          release_date: string
          status?: string
          updated_at?: string
          usd_impact?: string | null
        }
        Update: {
          actual?: string | null
          analysis?: string | null
          confidence?: number | null
          confidence_breakdown?: Json
          created_at?: string
          eurusd_impact?: string | null
          expected_impact?: string | null
          factors?: Json
          forecast?: string | null
          gbpusd_impact?: string | null
          gold_impact?: string | null
          id?: string
          nas100_impact?: string | null
          nfp_event_id?: string | null
          prediction?: string | null
          previous?: string | null
          release_date?: string
          status?: string
          updated_at?: string
          usd_impact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfp_predictions_nfp_event_id_fkey"
            columns: ["nfp_event_id"]
            isOneToOne: false
            referencedRelation: "nfp_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
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
          deleted_at: string | null
          email: string | null
          email_verified: boolean
          full_name: string | null
          id: string
          last_login_at: string | null
          onboarding_completed: boolean
          phone: string | null
          referral_code: string | null
          status: string
          two_factor_enabled: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          email_verified?: boolean
          full_name?: string | null
          id: string
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          status?: string
          two_factor_enabled?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          email_verified?: boolean
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          referral_code?: string | null
          status?: string
          two_factor_enabled?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket_key: string
          created_at: string
          hits: number
          id: string
          window_seconds: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          hits?: number
          id?: string
          window_seconds: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          hits?: number
          id?: string
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          analysis: Json
          broker_connection_id: string | null
          confidence: number | null
          confidence_breakdown: Json
          created_at: string
          direction: string
          entry: number | null
          entry_zone: string | null
          id: string
          market_condition: string | null
          result: string | null
          risk_reward: string | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          timeframe: string | null
          updated_at: string
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          analysis?: Json
          broker_connection_id?: string | null
          confidence?: number | null
          confidence_breakdown?: Json
          created_at?: string
          direction: string
          entry?: number | null
          entry_zone?: string | null
          id?: string
          market_condition?: string | null
          result?: string | null
          risk_reward?: string | null
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          timeframe?: string | null
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          analysis?: Json
          broker_connection_id?: string | null
          confidence?: number | null
          confidence_breakdown?: Json
          created_at?: string
          direction?: string
          entry?: number | null
          entry_zone?: string | null
          id?: string
          market_condition?: string | null
          result?: string | null
          risk_reward?: string | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          timeframe?: string | null
          updated_at?: string
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_broker_connection_id_fkey"
            columns: ["broker_connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          configuration: Json
          configuration_schema: Json
          created_at: string
          description: string
          id: string
          markets: Json
          name: string
          slug: string
          status: string
          timeframe: string | null
          timeframes: Json
          updated_at: string
        }
        Insert: {
          configuration?: Json
          configuration_schema?: Json
          created_at?: string
          description: string
          id?: string
          markets?: Json
          name: string
          slug: string
          status?: string
          timeframe?: string | null
          timeframes?: Json
          updated_at?: string
        }
        Update: {
          configuration?: Json
          configuration_schema?: Json
          created_at?: string
          description?: string
          id?: string
          markets?: Json
          name?: string
          slug?: string
          status?: string
          timeframe?: string | null
          timeframes?: Json
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          bot_id: string | null
          broker_connection_id: string | null
          closed_at: string | null
          commission: number | null
          created_at: string
          entry_price: number | null
          exit_price: number | null
          id: string
          opened_at: string | null
          profit: number | null
          status: string
          stop_loss: number | null
          swap: number | null
          symbol: string
          take_profit: number | null
          ticket: string | null
          type: string
          updated_at: string
          user_id: string
          volume: number | null
        }
        Insert: {
          bot_id?: string | null
          broker_connection_id?: string | null
          closed_at?: string | null
          commission?: number | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          profit?: number | null
          status?: string
          stop_loss?: number | null
          swap?: number | null
          symbol: string
          take_profit?: number | null
          ticket?: string | null
          type: string
          updated_at?: string
          user_id: string
          volume?: number | null
        }
        Update: {
          bot_id?: string | null
          broker_connection_id?: string | null
          closed_at?: string | null
          commission?: number | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          profit?: number | null
          status?: string
          stop_loss?: number | null
          swap?: number | null
          symbol?: string
          take_profit?: number | null
          ticket?: string | null
          type?: string
          updated_at?: string
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
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device: string | null
          expires_at: string
          id: string
          ip_address: string | null
          last_activity_at: string
          os: string | null
          revoked_at: string | null
          session_token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string
          os?: string | null
          revoked_at?: string | null
          session_token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string
          os?: string | null
          revoked_at?: string | null
          session_token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      bump_rate_limit: {
        Args: {
          _bucket_key: string
          _window_seconds: number
          _window_start: string
        }
        Returns: number
      }
      soft_delete_account: { Args: { _user_id: string }; Returns: undefined }
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
