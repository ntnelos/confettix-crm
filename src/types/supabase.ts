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
      communication_history: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          id: string
          source: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          id?: string
          source: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_inquiries: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          lead_id: string | null
          message: string | null
          source: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          source?: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          message?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_inquiries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_inquiries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          fireberry_account_number: string | null
          id: string
          mobile: string | null
          morning_id: string | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          unsubscribed: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          fireberry_account_number?: string | null
          id?: string
          mobile?: string | null
          morning_id?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          unsubscribed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          fireberry_account_number?: string | null
          id?: string
          mobile?: string | null
          morning_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          unsubscribed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_addresses: {
        Row: {
          city: string
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          label: string | null
          notes: string | null
          organization_id: string | null
          street: string
          zip_code: string | null
        }
        Insert: {
          city: string
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          organization_id?: string | null
          street: string
          zip_code?: string | null
        }
        Update: {
          city?: string
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          organization_id?: string | null
          street?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_addresses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          id: string
          item_id: string
          location: string
          quantity: number | null
        }
        Insert: {
          id?: string
          item_id: string
          location: string
          quantity?: number | null
        }
        Update: {
          id?: string
          item_id?: string
          location?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          created_at: string | null
          id: string
          inventory_id: string
          new_quantity: number
          notes: string | null
          quantity_changed: number
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_id: string
          new_quantity: number
          notes?: string | null
          quantity_changed: number
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_id?: string
          new_quantity?: number
          notes?: string | null
          quantity_changed?: number
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          green_invoice_id: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          order_id: string
          pdf_url: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          green_invoice_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          order_id: string
          pdf_url?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          green_invoice_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          order_id?: string
          pdf_url?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          expiration_date: string | null
          id: string
          image_url: string | null
          name: string
          tags: string[] | null
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          name: string
          tags?: string[] | null
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          name?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      lead_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          lead_id: string
          raw_payload: Json | null
          source: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          raw_payload?: Json | null
          source: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          raw_payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_rejection_reasons: {
        Row: {
          created_at: string | null
          id: string
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          company_name: string | null
          created_at: string
          estimated_quantity: number | null
          gift_type: string | null
          id: string
          is_existing_customer: boolean
          matched_contact_id: string | null
          message: string | null
          raw_payload: Json | null
          rejection_note: string | null
          rejection_reason_id: string | null
          sender_email: string | null
          sender_name: string | null
          sender_phone: string | null
          source: string
          status: string
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          estimated_quantity?: number | null
          gift_type?: string | null
          id?: string
          is_existing_customer?: boolean
          matched_contact_id?: string | null
          message?: string | null
          raw_payload?: Json | null
          rejection_note?: string | null
          rejection_reason_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          source: string
          status?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          estimated_quantity?: number | null
          gift_type?: string | null
          id?: string
          is_existing_customer?: boolean
          matched_contact_id?: string | null
          message?: string | null
          raw_payload?: Json | null
          rejection_note?: string | null
          rejection_reason_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          source?: string
          status?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_matched_contact_id_fkey"
            columns: ["matched_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_rejection_reason_id_fkey"
            columns: ["rejection_reason_id"]
            isOneToOne: false
            referencedRelation: "lead_rejection_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          calculated_value: number | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expected_delivery: string | null
          id: string
          lead_source: string | null
          organization_id: string | null
          payment_date: string | null
          payment_method: string | null
          reference_number: string | null
          status: string
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calculated_value?: number | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_delivery?: string | null
          id?: string
          lead_source?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          status?: string
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calculated_value?: number | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_delivery?: string | null
          id?: string
          lead_source?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          status?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_updates: {
        Row: {
          assigned_to: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_task: boolean
          opportunity_id: string
          task_completed: boolean | null
          task_completed_at: string | null
          task_deadline: string | null
          type: string
        }
        Insert: {
          assigned_to?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_task?: boolean
          opportunity_id: string
          task_completed?: boolean | null
          task_completed_at?: string | null
          task_deadline?: string | null
          type: string
        }
        Update: {
          assigned_to?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_task?: boolean
          opportunity_id?: string
          task_completed?: boolean | null
          task_completed_at?: string | null
          task_deadline?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_updates_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_updates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_address_id: string | null
          id: string
          notes: string | null
          opportunity_id: string
          order_number: string | null
          quote_id: string
          signature_data: string | null
          signed_at: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_address_id?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          order_number?: string | null
          quote_id: string
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_address_id?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          order_number?: string | null
          quote_id?: string
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          company_number: string | null
          created_at: string
          created_by: string | null
          employee_count: number | null
          general_info: string | null
          id: string
          industry: string | null
          invoice_company_name: string | null
          morning_id: string | null
          name: string
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          company_number?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          general_info?: string | null
          id?: string
          industry?: string | null
          invoice_company_name?: string | null
          morning_id?: string | null
          name: string
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          company_number?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number | null
          general_info?: string | null
          id?: string
          industry?: string | null
          invoice_company_name?: string | null
          morning_id?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          synced_at: string | null
          updated_at: string
          woo_product_id: string | null
          woo_product_url: string | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          synced_at?: string | null
          updated_at?: string
          woo_product_id?: string | null
          woo_product_url?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          synced_at?: string | null
          updated_at?: string
          woo_product_id?: string | null
          woo_product_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          image_url: string | null
          line_total: number
          product_id: string | null
          product_name: string
          quantity: number
          quote_id: string
          sort_order: number | null
          unit_price: number
          woo_product_id: string | null
          woo_product_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          line_total: number
          product_id?: string | null
          product_name: string
          quantity?: number
          quote_id: string
          sort_order?: number | null
          unit_price: number
          woo_product_id?: string | null
          woo_product_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          line_total?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          quote_id?: string
          sort_order?: number | null
          unit_price?: number
          woo_product_id?: string | null
          woo_product_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          opportunity_id: string
          quote_number: string | null
          shipping_cost: number | null
          status: string
          subtotal: number
          terms_and_conditions: string | null
          total_with_vat: number
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          vat_rate: number
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          opportunity_id: string
          quote_number?: string | null
          shipping_cost?: number | null
          status?: string
          subtotal?: number
          terms_and_conditions?: string | null
          total_with_vat?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          vat_rate?: number
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          opportunity_id?: string
          quote_number?: string | null
          shipping_cost?: number | null
          status?: string
          subtotal?: number
          terms_and_conditions?: string | null
          total_with_vat?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          vat_rate?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          id: string
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          id: string
          created_at: string
          level: string
          service: string
          message: string
          details: Json | null
          user_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          level: string
          service: string
          message: string
          details?: Json | null
          user_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          level?: string
          service?: string
          message?: string
          details?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_user: { Args: never; Returns: boolean }
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
