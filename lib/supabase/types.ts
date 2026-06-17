/*
  Supabase database types for Regan Phones (MVP).

  NOTE: These types are intentionally lightweight and reflect only the
  columns/relations used by the app. They can be replaced later by
  `supabase gen types typescript` once a proper migration/type pipeline
  exists.
*/

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone_number: string | null;
          role: "admin" | "worker";
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone_number?: string | null;
          role?: "admin" | "worker";
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          phone_number?: string | null;
          role?: "admin" | "worker";
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      phones: {
        Row: {
          id: string;
          imei: string;
          brand: string;
          model: string;
          storage: string | null;
          color: string | null;
          battery_health: string | null;
          condition: "New" | "UK Used";
          cost_price: number;
          selling_price: number;
          status: "Available" | "Sold" | "With Dealer" | "Returned" | "Damaged" | "Archived";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          imei: string;
          brand: string;
          model: string;
          storage?: string | null;
          color?: string | null;
          battery_health?: string | null;
          condition: "New" | "UK Used";
          cost_price: number;
          selling_price: number;
          status?:
            | "Available"
            | "Sold"
            | "With Dealer"
            | "Returned"
            | "Damaged"
            | "Archived";
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          imei?: string;
          brand?: string;
          model?: string;
          storage?: string | null;
          color?: string | null;
          battery_health?: string | null;
          condition?: "New" | "UK Used";
          cost_price?: number;
          selling_price?: number;
          status?:
            | "Available"
            | "Sold"
            | "With Dealer"
            | "Returned"
            | "Damaged"
            | "Archived";
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          phone_id: string;
          customer_name: string | null;
          customer_phone: string | null;
          selling_price: number;
          profit: number;
          payment_method: string;
          payment_status: "Pending Admin Confirmation" | "Received";
          confirmed_by: string | null;
          confirmed_at: string | null;
          sold_by: string;
          sold_at: string;
        };
        Insert: {
          id?: string;
          phone_id: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          selling_price: number;
          profit?: number;
          payment_method?: string;
          payment_status?: "Pending Admin Confirmation" | "Received";
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          sold_by?: string;
          sold_at?: string;
        };
        Update: {
          id?: string;
          phone_id?: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          selling_price?: number;
          profit?: number;
          payment_method?: string;
          payment_status?: "Pending Admin Confirmation" | "Received";
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          sold_by?: string;
          sold_at?: string;
        };
        Relationships: [];
      };
      dealers: {
        Row: {
          id: string;
          name: string;
          phone_number: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone_number: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone_number?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dealer_records: {
        Row: {
          id: string;
          batch_id: string | null;
          dealer_id: string;
          phone_id: string;
          agreed_price: number;
          amount_paid: number;
          status: "With Dealer" | "Sold" | "Returned";
          date_given: string;
          date_completed: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id?: string | null;
          dealer_id: string;
          phone_id: string;
          agreed_price: number;
          amount_paid?: number;
          status?: "With Dealer" | "Sold" | "Returned";
          date_given?: string;
          date_completed?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string | null;
          dealer_id?: string;
          phone_id?: string;
          agreed_price?: number;
          amount_paid?: number;
          status?: "With Dealer" | "Sold" | "Returned";
          date_given?: string;
          date_completed?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dealer_batches: {
        Row: {
          id: string;
          dealer_id: string;
          created_by: string;
          date_given: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          dealer_id: string;
          created_by: string;
          date_given?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          dealer_id?: string;
          created_by?: string;
          date_given?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          user_id: string;
          phone_id: string | null;
          dealer_id: string | null;
          action: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          phone_id?: string | null;
          dealer_id?: string | null;
          action: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phone_id?: string | null;
          dealer_id?: string | null;
          action?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

