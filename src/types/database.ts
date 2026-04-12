// Placeholder - will be generated from Supabase CLI
// Run: npx supabase gen types typescript --project-id rfhdjggnpyzdgzurisup > src/types/database.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'user' | 'pending'
          is_active: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          role?: 'admin' | 'user' | 'pending'
          is_active?: boolean
          avatar_url?: string | null
        }
        Update: {
          email?: string
          full_name?: string
          role?: 'admin' | 'user' | 'pending'
          is_active?: boolean
          avatar_url?: string | null
          updated_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          invoice_company_name: string | null
          employee_count: number | null
          general_info: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          invoice_company_name?: string | null
          employee_count?: number | null
          general_info?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          invoice_company_name?: string | null
          employee_count?: number | null
          general_info?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
      delivery_addresses: {
        Row: {
          id: string
          organization_id: string
          label: string | null
          street: string
          city: string
          zip_code: string | null
          notes: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          label?: string | null
          street: string
          city: string
          zip_code?: string | null
          notes?: string | null
          contact_name?: string | null
          contact_phone?: string | null
        }
        Update: {
          organization_id?: string
          label?: string | null
          street?: string
          city?: string
          zip_code?: string | null
          notes?: string | null
          contact_name?: string | null
          contact_phone?: string | null
        }
      }
      contacts: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          email: string | null
          mobile: string | null
          phone: string | null
          unsubscribed: boolean
          morning_id: string | null
          fireberry_account_number: string | null
          notes: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          email?: string | null
          mobile?: string | null
          phone?: string | null
          unsubscribed?: boolean
          morning_id?: string | null
          fireberry_account_number?: string | null
          notes?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          organization_id?: string | null
          name?: string
          email?: string | null
          mobile?: string | null
          phone?: string | null
          unsubscribed?: boolean
          morning_id?: string | null
          fireberry_account_number?: string | null
          notes?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
      opportunities: {
        Row: {
          id: string
          reference_number: string | null
          subject: string
          status: 'new' | 'followup' | 'won' | 'lost'
          contact_id: string | null
          organization_id: string | null
          calculated_value: number
          lead_source: 'website' | 'whatsapp' | 'phone' | 'referral' | 'returning' | 'other' | null
          description: string | null
          expected_delivery: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reference_number?: string | null
          subject: string
          status?: 'new' | 'followup' | 'won' | 'lost'
          contact_id?: string | null
          organization_id?: string | null
          calculated_value?: number
          lead_source?: 'website' | 'whatsapp' | 'phone' | 'referral' | 'returning' | 'other' | null
          description?: string | null
          expected_delivery?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          subject?: string
          status?: 'new' | 'followup' | 'won' | 'lost'
          contact_id?: string | null
          organization_id?: string | null
          calculated_value?: number
          lead_source?: 'website' | 'whatsapp' | 'phone' | 'referral' | 'returning' | 'other' | null
          description?: string | null
          expected_delivery?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
      opportunity_updates: {
        Row: {
          id: string
          opportunity_id: string
          type: 'phone' | 'whatsapp' | 'note' | 'email' | 'meeting'
          content: string
          is_task: boolean
          task_deadline: string | null
          task_completed: boolean
          task_completed_at: string | null
          assigned_to: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          type: 'phone' | 'whatsapp' | 'note' | 'email' | 'meeting'
          content: string
          is_task?: boolean
          task_deadline?: string | null
          task_completed?: boolean
          assigned_to?: string | null
          created_by?: string | null
        }
        Update: {
          type?: 'phone' | 'whatsapp' | 'note' | 'email' | 'meeting'
          content?: string
          is_task?: boolean
          task_deadline?: string | null
          task_completed?: boolean
          task_completed_at?: string | null
          assigned_to?: string | null
        }
      }
      quotes: {
        Row: {
          id: string
          opportunity_id: string
          quote_number: string | null
          name: string
          status: 'draft' | 'final' | 'approved' | 'rejected'
          subtotal: number
          vat_rate: number
          shipping_cost: number
          total_with_vat: number
          terms_and_conditions: string | null
          version: number
          valid_until: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          quote_number?: string | null
          name: string
          status?: 'draft' | 'final' | 'approved' | 'rejected'
          subtotal?: number
          vat_rate?: number
          shipping_cost?: number
          total_with_vat?: number
          terms_and_conditions?: string | null
          version?: number
          valid_until?: string | null
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          name?: string
          status?: 'draft' | 'final' | 'approved' | 'rejected'
          subtotal?: number
          vat_rate?: number
          shipping_cost?: number
          total_with_vat?: number
          terms_and_conditions?: string | null
          version?: number
          valid_until?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_id: string | null
          product_name: string
          description: string | null
          quantity: number
          unit_price: number
          discount_percent: number
          line_total: number
          woo_product_id: string | null
          woo_product_url: string | null
          image_url: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          product_id?: string | null
          product_name: string
          description?: string | null
          quantity?: number
          unit_price: number
          discount_percent?: number
          line_total: number
          woo_product_id?: string | null
          woo_product_url?: string | null
          image_url?: string | null
          sort_order?: number
        }
        Update: {
          product_id?: string | null
          product_name?: string
          description?: string | null
          quantity?: number
          unit_price?: number
          discount_percent?: number
          line_total?: number
          woo_product_id?: string | null
          woo_product_url?: string | null
          image_url?: string | null
          sort_order?: number
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          base_price: number | null
          woo_product_id: string | null
          woo_product_url: string | null
          image_url: string | null
          category: string | null
          is_active: boolean
          synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          base_price?: number | null
          woo_product_id?: string | null
          woo_product_url?: string | null
          image_url?: string | null
          category?: string | null
          is_active?: boolean
          synced_at?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          base_price?: number | null
          woo_product_id?: string | null
          woo_product_url?: string | null
          image_url?: string | null
          category?: string | null
          is_active?: boolean
          synced_at?: string | null
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          quote_id: string
          opportunity_id: string
          order_number: string | null
          status: 'pending_signature' | 'signed' | 'paid' | 'fulfilled' | 'cancelled'
          signature_data: string | null
          signed_at: string | null
          total_amount: number
          delivery_address_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          opportunity_id: string
          order_number?: string | null
          status?: 'pending_signature' | 'signed' | 'paid' | 'fulfilled' | 'cancelled'
          signature_data?: string | null
          signed_at?: string | null
          total_amount: number
          delivery_address_id?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          status?: 'pending_signature' | 'signed' | 'paid' | 'fulfilled' | 'cancelled'
          signature_data?: string | null
          signed_at?: string | null
          total_amount?: number
          delivery_address_id?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          order_id: string
          green_invoice_id: string | null
          invoice_number: string | null
          type: 'invoice' | 'receipt' | 'invoice_receipt'
          amount: number
          pdf_url: string | null
          status: 'draft' | 'issued' | 'paid' | 'cancelled'
          issued_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          green_invoice_id?: string | null
          invoice_number?: string | null
          type: 'invoice' | 'receipt' | 'invoice_receipt'
          amount: number
          pdf_url?: string | null
          status?: 'draft' | 'issued' | 'paid' | 'cancelled'
          issued_at?: string | null
        }
        Update: {
          green_invoice_id?: string | null
          invoice_number?: string | null
          type?: 'invoice' | 'receipt' | 'invoice_receipt'
          amount?: number
          pdf_url?: string | null
          status?: 'draft' | 'issued' | 'paid' | 'cancelled'
          issued_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
