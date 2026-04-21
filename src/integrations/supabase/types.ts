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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      colors: {
        Row: {
          created_at: string
          hex_code: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
        }
        Relationships: []
      }
      global_configs: {
        Row: {
          id: string
          updated_at: string
          value: number
        }
        Insert: {
          id: string
          updated_at?: string
          value: number
        }
        Update: {
          id?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          cod_confirmed: boolean
          cod_received_at: string | null
          confirmed_by_staff_id: string | null
          created_at: string
          customer_name: string
          customer_pays_shipping: boolean
          customer_phone: string
          delay_reason: string | null
          id: string
          is_cod: boolean
          order_confirmed: boolean
          order_confirmed_at: string | null
          order_number: string
          payment_method: string | null
          received_by_staff_id: string | null
          shipped_at: string | null
          shipping_cost: number
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          total: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          cod_confirmed?: boolean
          cod_received_at?: string | null
          confirmed_by_staff_id?: string | null
          created_at?: string
          customer_name: string
          customer_pays_shipping?: boolean
          customer_phone: string
          delay_reason?: string | null
          id?: string
          is_cod?: boolean
          order_confirmed?: boolean
          order_confirmed_at?: string | null
          order_number: string
          payment_method?: string | null
          received_by_staff_id?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          cod_confirmed?: boolean
          cod_received_at?: string | null
          confirmed_by_staff_id?: string | null
          created_at?: string
          customer_name?: string
          customer_pays_shipping?: boolean
          customer_phone?: string
          delay_reason?: string | null
          id?: string
          is_cod?: boolean
          order_confirmed?: boolean
          order_confirmed_at?: string | null
          order_number?: string
          payment_method?: string | null
          received_by_staff_id?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_confirmed_by_staff_id_fkey"
            columns: ["confirmed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_received_by_staff_id_fkey"
            columns: ["received_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_materials: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity_required: number
          raw_material_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity_required?: number
          raw_material_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity_required?: number
          raw_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          aging_days: number
          base_color: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          is_parent: boolean
          name: string
          parent_id: string | null
          price: number
          print_color: string | null
          print_design: string | null
          print_height_cm: number
          product_url: string | null
          safety_stock: number
          size: string | null
          sku: string
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          aging_days?: number
          base_color?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_parent?: boolean
          name: string
          parent_id?: string | null
          price?: number
          print_color?: string | null
          print_design?: string | null
          print_height_cm?: number
          product_url?: string | null
          safety_stock?: number
          size?: string | null
          sku: string
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          aging_days?: number
          base_color?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_parent?: boolean
          name?: string
          parent_id?: string | null
          price?: number
          print_color?: string | null
          print_design?: string | null
          print_height_cm?: number
          product_url?: string | null
          safety_stock?: number
          size?: string | null
          sku?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      raw_materials: {
        Row: {
          category_id: string
          color_id: string | null
          created_at: string
          id: string
          name: string
          size_id: string | null
          sku: string | null
          stock: number
          subcategory_id: string | null
          supplier_id: string
          unit_of_measure: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          category_id: string
          color_id?: string | null
          created_at?: string
          id?: string
          name: string
          size_id?: string | null
          sku?: string | null
          stock?: number
          subcategory_id?: string | null
          supplier_id: string
          unit_of_measure?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          color_id?: string | null
          created_at?: string
          id?: string
          name?: string
          size_id?: string | null
          sku?: string | null
          stock?: number
          subcategory_id?: string | null
          supplier_id?: string
          unit_of_measure?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          company_assumes_shipping: boolean
          created_at: string
          id: string
          notes: string | null
          order_id: string | null
          product_id: string | null
          reason_category: string
          resolution_status: string
          resolved_at: string | null
          return_shipping_cost: number
          updated_at: string
        }
        Insert: {
          company_assumes_shipping?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          reason_category: string
          resolution_status?: string
          resolved_at?: string | null
          return_shipping_cost?: number
          updated_at?: string
        }
        Update: {
          company_assumes_shipping?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          reason_category?: string
          resolution_status?: string
          resolved_at?: string | null
          return_shipping_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sizes: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact_email: string | null
          contact_phone: string
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supply_alerts: {
        Row: {
          created_at: string
          id: string
          issue_type: Database["public"]["Enums"]["alert_issue_type"]
          message: string | null
          raw_material_id: string
          resolved: boolean
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
        }
        Insert: {
          created_at?: string
          id?: string
          issue_type: Database["public"]["Enums"]["alert_issue_type"]
          message?: string | null
          raw_material_id: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Update: {
          created_at?: string
          id?: string
          issue_type?: Database["public"]["Enums"]["alert_issue_type"]
          message?: string | null
          raw_material_id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "supply_alerts_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_request_items: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          quantity_confirmed: number
          quantity_requested: number
          raw_material_id: string
          supply_request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          quantity_confirmed?: number
          quantity_requested?: number
          raw_material_id: string
          supply_request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          quantity_confirmed?: number
          quantity_requested?: number
          raw_material_id?: string
          supply_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_request_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_request_items_supply_request_id_fkey"
            columns: ["supply_request_id"]
            isOneToOne: false
            referencedRelation: "supply_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          secure_token: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          secure_token?: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          secure_token?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_items: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          is_dtf_added: boolean
          product_id: string
          quantity_to_produce: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          is_dtf_added?: boolean
          product_id: string
          quantity_to_produce: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          is_dtf_added?: boolean
          product_id?: string
          quantity_to_produce?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          batch_number: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_supply_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      complete_work_order: {
        Args: { _work_order_id: string }
        Returns: {
          batch_number: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          target_date: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      alert_issue_type:
        | "low_stock"
        | "price_change"
        | "quality"
        | "delay"
        | "other"
      alert_severity: "low" | "medium" | "high"
      order_source: "shopify" | "manual"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      work_order_status: "pending" | "in_progress" | "completed" | "cancelled"
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
      alert_issue_type: [
        "low_stock",
        "price_change",
        "quality",
        "delay",
        "other",
      ],
      alert_severity: ["low", "medium", "high"],
      order_source: ["shopify", "manual"],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      work_order_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
