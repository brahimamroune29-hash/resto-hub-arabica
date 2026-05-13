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
      cashier_credentials: {
        Row: {
          pin_hash: string
          pin_salt: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          pin_hash: string
          pin_salt: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          pin_hash?: string
          pin_salt?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cashier_login_attempts: {
        Row: {
          failed_count: number
          locked_until: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          failed_count?: number
          locked_until?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          failed_count?: number
          locked_until?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cashier_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          restaurant_id: string
          revoked: boolean
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          restaurant_id: string
          revoked?: boolean
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          restaurant_id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          name: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      chef_credentials: {
        Row: {
          pin_hash: string
          pin_salt: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          pin_hash: string
          pin_salt: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          pin_hash?: string
          pin_salt?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      chef_login_attempts: {
        Row: {
          failed_count: number
          locked_until: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          failed_count?: number
          locked_until?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          failed_count?: number
          locked_until?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      chef_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          restaurant_id: string
          revoked: boolean
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          restaurant_id: string
          revoked?: boolean
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          restaurant_id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          description: string
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          restaurant_id: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          description: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          restaurant_id: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          description?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          restaurant_id?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      customer_points_log: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          order_id: string | null
          points_earned: number
          points_redeemed: number
          reason: string | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          order_id?: string | null
          points_earned?: number
          points_redeemed?: number
          reason?: string | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          points_earned?: number
          points_redeemed?: number
          reason?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          last_visit_at: string | null
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string
          total_points: number
          total_spent: number
          total_visits: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_visit_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          total_points?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_visit_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          total_points?: number
          total_spent?: number
          total_visits?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_assignments: {
        Row: {
          claimed_at: string
          confirmed_at: string | null
          created_at: string
          driver_chat_id: number
          driver_id: string | null
          followup_count: number
          id: string
          last_followup_at: string | null
          order_id: string
          owner_alerted: boolean
          restaurant_id: string
        }
        Insert: {
          claimed_at?: string
          confirmed_at?: string | null
          created_at?: string
          driver_chat_id: number
          driver_id?: string | null
          followup_count?: number
          id?: string
          last_followup_at?: string | null
          order_id: string
          owner_alerted?: boolean
          restaurant_id: string
        }
        Update: {
          claimed_at?: string
          confirmed_at?: string | null
          created_at?: string
          driver_chat_id?: number
          driver_id?: string | null
          followup_count?: number
          id?: string
          last_followup_at?: string | null
          order_id?: string
          owner_alerted?: boolean
          restaurant_id?: string
        }
        Relationships: []
      }
      delivery_drivers: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          link_token: string | null
          restaurant_id: string
          telegram_chat_id: number | null
          telegram_username: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          link_token?: string | null
          restaurant_id: string
          telegram_chat_id?: number | null
          telegram_username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          link_token?: string | null
          restaurant_id?: string
          telegram_chat_id?: number | null
          telegram_username?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_deductions: {
        Row: {
          amount: number
          created_at: string
          date: string
          employee_id: string
          id: string
          label: string | null
          month: string
          notes: string | null
          quantity: number
          restaurant_id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          label?: string | null
          month: string
          notes?: string | null
          quantity?: number
          restaurant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          label?: string | null
          month?: string
          notes?: string | null
          quantity?: number
          restaurant_id?: string
          type?: string
        }
        Relationships: []
      }
      employee_salary_payments: {
        Row: {
          base_salary: number
          employee_id: string
          id: string
          month: string
          net_salary: number
          notes: string | null
          paid_at: string
          restaurant_id: string
          total_deductions: number
        }
        Insert: {
          base_salary?: number
          employee_id: string
          id?: string
          month: string
          net_salary?: number
          notes?: string | null
          paid_at?: string
          restaurant_id: string
          total_deductions?: number
        }
        Update: {
          base_salary?: number
          employee_id?: string
          id?: string
          month?: string
          net_salary?: number
          notes?: string | null
          paid_at?: string
          restaurant_id?: string
          total_deductions?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          base_salary: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          restaurant_id: string
          role: string
          salary_type: Database["public"]["Enums"]["salary_type"]
        }
        Insert: {
          base_salary?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          restaurant_id: string
          role: string
          salary_type?: Database["public"]["Enums"]["salary_type"]
        }
        Update: {
          base_salary?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          restaurant_id?: string
          role?: string
          salary_type?: Database["public"]["Enums"]["salary_type"]
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          custom_label: string | null
          date: string
          id: string
          is_recurring: boolean
          month: string
          notes: string | null
          restaurant_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          custom_label?: string | null
          date?: string
          id?: string
          is_recurring?: boolean
          month: string
          notes?: string | null
          restaurant_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          custom_label?: string | null
          date?: string
          id?: string
          is_recurring?: boolean
          month?: string
          notes?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          alert_threshold: number
          cost_per_unit: number
          created_at: string
          current_stock: number
          id: string
          name: string
          restaurant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          alert_threshold?: number
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          name: string
          restaurant_id: string
          unit: string
          updated_at?: string
        }
        Update: {
          alert_threshold?: number
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          name?: string
          restaurant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_count_items: {
        Row: {
          count_id: string
          counted_qty: number
          created_at: string
          expected_qty: number
          id: string
          ingredient_id: string
          notes: string | null
          variance: number
          variance_value: number
        }
        Insert: {
          count_id: string
          counted_qty?: number
          created_at?: string
          expected_qty?: number
          id?: string
          ingredient_id: string
          notes?: string | null
          variance?: number
          variance_value?: number
        }
        Update: {
          count_id?: string
          counted_qty?: number
          created_at?: string
          expected_qty?: number
          id?: string
          ingredient_id?: string
          notes?: string | null
          variance?: number
          variance_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          closed_at: string | null
          count_date: string
          created_at: string
          id: string
          notes: string | null
          restaurant_id: string
          status: string
          total_variance_value: number
        }
        Insert: {
          closed_at?: string | null
          count_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          restaurant_id: string
          status?: string
          total_variance_value?: number
        }
        Update: {
          closed_at?: string | null
          count_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          status?: string
          total_variance_value?: number
        }
        Relationships: []
      }
      menu_item_recipes: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          menu_item_id: string
          quantity: number
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          menu_item_id: string
          quantity: number
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          menu_item_id?: string
          quantity?: number
          restaurant_id?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          restaurant_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          order_id: string | null
          read_at: string | null
          restaurant_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string
          title?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string | null
          name_snapshot: string
          order_id: string
          price_snapshot: number
          quantity: number
        }
        Insert: {
          id?: string
          menu_item_id?: string | null
          name_snapshot: string
          order_id: string
          price_snapshot: number
          quantity: number
        }
        Update: {
          id?: string
          menu_item_id?: string | null
          name_snapshot?: string
          order_id?: string
          price_snapshot?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          kind: string
          message_id: number
          order_id: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          kind?: string
          message_id: number
          order_id: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          kind?: string
          message_id?: number
          order_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          acknowledged: boolean
          assigned_driver_chat_id: number | null
          assigned_kitchen_id: string | null
          assigned_waiter_id: string | null
          created_at: string
          customer_address: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          daily_number: number | null
          id: string
          inventory_deducted_at: string | null
          notes: string | null
          order_type: string
          restaurant_id: string
          review_due_at: string | null
          served_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          total: number
        }
        Insert: {
          acknowledged?: boolean
          assigned_driver_chat_id?: number | null
          assigned_kitchen_id?: string | null
          assigned_waiter_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          daily_number?: number | null
          id?: string
          inventory_deducted_at?: string | null
          notes?: string | null
          order_type?: string
          restaurant_id: string
          review_due_at?: string | null
          served_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total: number
        }
        Update: {
          acknowledged?: boolean
          assigned_driver_chat_id?: number | null
          assigned_kitchen_id?: string | null
          assigned_waiter_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          daily_number?: number | null
          id?: string
          inventory_deducted_at?: string | null
          notes?: string | null
          order_type?: string
          restaurant_id?: string
          review_due_at?: string | null
          served_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          ingredient_id: string
          purchase_order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          purchase_order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          purchase_order_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          restaurant_id: string
          supplier_id: string
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          restaurant_id: string
          supplier_id: string
          total?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          supplier_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_daily_counters: {
        Row: {
          day_key: string
          last_number: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          day_key: string
          last_number?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          day_key?: string
          last_number?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          brand_color: string | null
          cashier_enabled: boolean
          chef_enabled: boolean
          cover_image_url: string | null
          cover_type: string
          cover_video_url: string | null
          created_at: string
          daily_summary_enabled: boolean
          daily_summary_last_sent_for: string | null
          delivery_enabled: boolean
          delivery_token: string | null
          facebook_url: string | null
          features: Json
          google_maps_review_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          menu_theme: string
          name: string
          owner_id: string
          setup_completed: boolean
          splash_always_show: boolean
          splash_description: string | null
          splash_enabled: boolean
          summary_bot_token: string | null
          summary_bot_username: string | null
          summary_chat_id: number | null
          summary_link_token: string | null
          summary_username: string | null
          tagline: string | null
          takeaway_enabled: boolean
          takeaway_token: string | null
          telegram_bot_token: string | null
          telegram_bot_username: string | null
          telegram_chat_id: number | null
          telegram_link_token: string | null
          telegram_username: string | null
          whatsapp_number: string | null
        }
        Insert: {
          brand_color?: string | null
          cashier_enabled?: boolean
          chef_enabled?: boolean
          cover_image_url?: string | null
          cover_type?: string
          cover_video_url?: string | null
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_last_sent_for?: string | null
          delivery_enabled?: boolean
          delivery_token?: string | null
          facebook_url?: string | null
          features?: Json
          google_maps_review_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          menu_theme?: string
          name: string
          owner_id: string
          setup_completed?: boolean
          splash_always_show?: boolean
          splash_description?: string | null
          splash_enabled?: boolean
          summary_bot_token?: string | null
          summary_bot_username?: string | null
          summary_chat_id?: number | null
          summary_link_token?: string | null
          summary_username?: string | null
          tagline?: string | null
          takeaway_enabled?: boolean
          takeaway_token?: string | null
          telegram_bot_token?: string | null
          telegram_bot_username?: string | null
          telegram_chat_id?: number | null
          telegram_link_token?: string | null
          telegram_username?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          brand_color?: string | null
          cashier_enabled?: boolean
          chef_enabled?: boolean
          cover_image_url?: string | null
          cover_type?: string
          cover_video_url?: string | null
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_last_sent_for?: string | null
          delivery_enabled?: boolean
          delivery_token?: string | null
          facebook_url?: string | null
          features?: Json
          google_maps_review_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          menu_theme?: string
          name?: string
          owner_id?: string
          setup_completed?: boolean
          splash_always_show?: boolean
          splash_description?: string | null
          splash_enabled?: boolean
          summary_bot_token?: string | null
          summary_bot_username?: string | null
          summary_chat_id?: number | null
          summary_link_token?: string | null
          summary_username?: string | null
          tagline?: string | null
          takeaway_enabled?: boolean
          takeaway_token?: string | null
          telegram_bot_token?: string | null
          telegram_bot_username?: string | null
          telegram_chat_id?: number | null
          telegram_link_token?: string | null
          telegram_username?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          redirected_to_google: boolean
          restaurant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          redirected_to_google?: boolean
          restaurant_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          redirected_to_google?: boolean
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          amount: number
          employee_id: string
          id: string
          notes: string | null
          paid_at: string
          period_month: string
          restaurant_id: string
          units: number | null
        }
        Insert: {
          amount: number
          employee_id: string
          id?: string
          notes?: string | null
          paid_at?: string
          period_month?: string
          restaurant_id: string
          units?: number | null
        }
        Update: {
          amount?: number
          employee_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
          period_month?: string
          restaurant_id?: string
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted: boolean
          created_at: string
          email: string
          id: string
          invited_by: string
          restaurant_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          email: string
          id?: string
          invited_by: string
          restaurant_id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted?: boolean
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      supplier_transactions: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          notes: string | null
          restaurant_id: string
          supplier_id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          restaurant_id: string
          supplier_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          supplier_id?: string
          type?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tables: {
        Row: {
          created_at: string
          id: string
          qr_token: string
          restaurant_id: string
          table_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          qr_token: string
          restaurant_id: string
          table_number: number
        }
        Update: {
          created_at?: string
          id?: string
          qr_token?: string
          restaurant_id?: string
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waste_logs: {
        Row: {
          cost: number
          created_at: string
          id: string
          ingredient_id: string
          logged_by: string | null
          quantity: number
          reason: Database["public"]["Enums"]["waste_reason"]
          reason_other: string | null
          restaurant_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          ingredient_id: string
          logged_by?: string | null
          quantity: number
          reason: Database["public"]["Enums"]["waste_reason"]
          reason_other?: string | null
          restaurant_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          logged_by?: string | null
          quantity?: number
          reason?: Database["public"]["Enums"]["waste_reason"]
          reason_other?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_logs_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_daily_number: { Args: { _restaurant_id: string }; Returns: number }
      current_business_day: { Args: { _at?: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _restaurant_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      user_has_restaurant_access: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      user_owns_restaurant: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      order_status: "new" | "preparing" | "ready" | "paid"
      salary_type: "monthly" | "daily" | "hourly"
      waste_reason: "burned" | "expired" | "dropped" | "prep_error" | "other"
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
      app_role: ["admin", "staff"],
      order_status: ["new", "preparing", "ready", "paid"],
      salary_type: ["monthly", "daily", "hourly"],
      waste_reason: ["burned", "expired", "dropped", "prep_error", "other"],
    },
  },
} as const
