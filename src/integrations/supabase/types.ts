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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assessments: {
        Row: {
          assessment_date: string
          care_details: Json | null
          care_rating: string | null
          care_score: number | null
          created_at: string | null
          customer_id: string
          id: string
          is_current: boolean | null
          one_color_details: Json | null
          one_color_rating: string | null
          one_color_score: number | null
          time_details: Json | null
          time_rating: string | null
          time_score: number | null
          total_rating: string | null
          total_score: number | null
          total_time_minutes: number | null
          total_time_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          assessment_date: string
          care_details?: Json | null
          care_rating?: string | null
          care_score?: number | null
          created_at?: string | null
          customer_id: string
          id?: string
          is_current?: boolean | null
          one_color_details?: Json | null
          one_color_rating?: string | null
          one_color_score?: number | null
          time_details?: Json | null
          time_rating?: string | null
          time_score?: number | null
          total_rating?: string | null
          total_score?: number | null
          total_time_minutes?: number | null
          total_time_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          assessment_date?: string
          care_details?: Json | null
          care_rating?: string | null
          care_score?: number | null
          created_at?: string | null
          customer_id?: string
          id?: string
          is_current?: boolean | null
          one_color_details?: Json | null
          one_color_rating?: string | null
          one_color_score?: number | null
          time_details?: Json | null
          time_rating?: string | null
          time_score?: number | null
          total_rating?: string | null
          total_score?: number | null
          total_time_minutes?: number | null
          total_time_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          age: number | null
          application_date: string | null
          blank_period: string | null
          created_at: string | null
          current_monthly_customers: number | null
          email: string | null
          external_id: string
          id: string
          issuer: string | null
          nailist_experience: string | null
          name: string
          occupation_type: string | null
          prefecture: string | null
          salon_monthly_customers: number | null
          salon_work_experience: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          application_date?: string | null
          blank_period?: string | null
          created_at?: string | null
          current_monthly_customers?: number | null
          email?: string | null
          external_id: string
          id?: string
          issuer?: string | null
          nailist_experience?: string | null
          name: string
          occupation_type?: string | null
          prefecture?: string | null
          salon_monthly_customers?: number | null
          salon_work_experience?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          application_date?: string | null
          blank_period?: string | null
          created_at?: string | null
          current_monthly_customers?: number | null
          email?: string | null
          external_id?: string
          id?: string
          issuer?: string | null
          nailist_experience?: string | null
          name?: string
          occupation_type?: string | null
          prefecture?: string | null
          salon_monthly_customers?: number | null
          salon_work_experience?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      // Flexible JSONB blocks (everything else from ranges & span groups)
      section_blobs: {
        Row: {
          id: string
          customer_id: string
          assessment_id: string | null
          section: string
          subtype: string
          data: Json
          source: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          assessment_id?: string | null
          section: string
          subtype: string
          data: Json
          source?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          assessment_id?: string | null
          section?: string
          subtype?: string
          data?: Json
          source?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "section_blobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_blobs_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          }
        ]
      }
      radar_chart: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_chart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      care_score: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_score_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      care_evaluation_graph: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_evaluation_graph_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      care_comparison: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_comparison_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      one_color_score: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_color_score_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      one_color_evaluation_graph: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_color_evaluation_graph_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      final_one_color_comparison: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "final_one_color_comparison_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      one_color_radar_chart: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_color_radar_chart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      time_both_hand: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_both_hand_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      time_evaluation_graph: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_evaluation_graph_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      time_lapse_comparison: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_lapse_comparison_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      time_radar_chart: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_radar_chart_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      comparison: {
        Row: {
          id: string
          customer_id: string
          data: Json
          type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          data: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          data?: Json
          type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparison_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      // Legacy scores table for backward compatibility
      scores: {
        Row: {
          id: string
          assessment_id: string
          category: string
          sub_item: string
          score: number
          rating: string | null
          comment: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          assessment_id: string
          category: string
          sub_item: string
          score: number
          rating?: string | null
          comment?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          assessment_id?: string
          category?: string
          sub_item?: string
          score?: number
          rating?: string | null
          comment?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

// Add function definitions for the new helper functions
export type Functions = {
  get_customer_latest_assessment_data: {
    Args: {
      p_customer_id: string;
    };
    Returns: Array<{
      section: string;
      subtype: string;
      data: Json;
      created_at: string;
    }>;
  };
  get_customer_comparison_data: {
    Args: {
      p_customer_id: string;
    };
    Returns: Array<{
      section: string;
      current_data: Json;
      average_data: Json;
    }>;
  };
  get_customer_radar_data: {
    Args: {
      p_customer_id: string;
    };
    Returns: Array<{
      name: string;
      current_score: number;
      average_score: number;
    }>;
  };
};

// Add view definitions
export type Views = {
  v_latest_assessments: {
    Row: {
      id: string;
      customer_id: string;
      assessment_date: string;
      is_current: boolean | null;
      care_details: Json | null;
      care_rating: string | null;
      care_score: number | null;
      one_color_details: Json | null;
      one_color_rating: string | null;
      one_color_score: number | null;
      time_details: Json | null;
      time_rating: string | null;
      time_score: number | null;
      total_rating: string | null;
      total_score: number | null;
      total_time_minutes: number | null;
      total_time_seconds: number | null;
      created_at: string | null;
      updated_at: string | null;
    };
  };
  v_customer_summary: {
    Row: {
      id: string;
      external_id: string;
      name: string;
      issuer: string | null;
      email: string | null;
      prefecture: string | null;
      application_date: string | null;
      assessment_date: string;
      total_score: number | null;
      total_rating: string | null;
      care_score: number | null;
      care_rating: string | null;
      one_color_score: number | null;
      one_color_rating: string | null;
      time_score: number | null;
      time_rating: string | null;
      assessment_created_at: string | null;
    };
  };
};
