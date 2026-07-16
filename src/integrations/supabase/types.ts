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
      militares: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          identificacao: string | null
          nome: string
          nome_guerra: string | null
          posto: Database["public"]["Enums"]["posto_graduacao"]
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          identificacao?: string | null
          nome: string
          nome_guerra?: string | null
          posto: Database["public"]["Enums"]["posto_graduacao"]
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          identificacao?: string | null
          nome?: string
          nome_guerra?: string | null
          posto?: Database["public"]["Enums"]["posto_graduacao"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          militar_id: string | null
          nome: string | null
          posto: string | null
          requested_role: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id: string
          militar_id?: string | null
          nome?: string | null
          posto?: string | null
          requested_role?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          militar_id?: string | null
          nome?: string | null
          posto?: string | null
          requested_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_militar_id_fkey"
            columns: ["militar_id"]
            isOneToOne: false
            referencedRelation: "militares"
            referencedColumns: ["id"]
          },
        ]
      }
      taf_resultados: {
        Row: {
          abdominal: number | null
          avaliador_id: string | null
          barra: number | null
          chamada: number
          ciente_at: string | null
          ciente_by: string | null
          corrida_metros: number | null
          created_at: string
          data_aplicacao: string
          flexao: number | null
          id: string
          mencao: string | null
          militar_id: string
          nota_abdominal: number | null
          nota_barra: number | null
          nota_corrida: number | null
          nota_final: number | null
          nota_flexao: number | null
          observacoes: string | null
          taf_numero: number
        }
        Insert: {
          abdominal?: number | null
          avaliador_id?: string | null
          barra?: number | null
          chamada: number
          ciente_at?: string | null
          ciente_by?: string | null
          corrida_metros?: number | null
          created_at?: string
          data_aplicacao?: string
          flexao?: number | null
          id?: string
          mencao?: string | null
          militar_id: string
          nota_abdominal?: number | null
          nota_barra?: number | null
          nota_corrida?: number | null
          nota_final?: number | null
          nota_flexao?: number | null
          observacoes?: string | null
          taf_numero: number
        }
        Update: {
          abdominal?: number | null
          avaliador_id?: string | null
          barra?: number | null
          chamada?: number
          ciente_at?: string | null
          ciente_by?: string | null
          corrida_metros?: number | null
          created_at?: string
          data_aplicacao?: string
          flexao?: number | null
          id?: string
          mencao?: string | null
          militar_id?: string
          nota_abdominal?: number | null
          nota_barra?: number | null
          nota_corrida?: number | null
          nota_final?: number | null
          nota_flexao?: number | null
          observacoes?: string | null
          taf_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "taf_resultados_militar_id_fkey"
            columns: ["militar_id"]
            isOneToOne: false
            referencedRelation: "militares"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_profile: {
        Args: {
          _profile_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      has_role:
        | { Args: { _role: string }; Returns: boolean }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      marcar_ciente: { Args: { _resultado_id: string }; Returns: undefined }
      militares_publicos: {
        Args: never
        Returns: {
          id: string
          nome: string
          posto: string
        }[]
      }
      revoke_profile: { Args: { _profile_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "avaliador"
      posto_graduacao: "oficial" | "sargento" | "cabo" | "soldado" | "recruta"
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
      app_role: ["admin", "user", "avaliador"],
      posto_graduacao: ["oficial", "sargento", "cabo", "soldado", "recruta"],
    },
  },
} as const
