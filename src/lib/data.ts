import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Posto } from "./taf";

export type Militar = {
  id: string;
  nome: string;
  nome_guerra: string | null;
  posto: Posto;
  identificacao: string | null;
  data_nascimento: string | null;
  pelotao: string | null;
  created_at: string;
};

export type TafResultado = {
  id: string;
  militar_id: string;
  taf_numero: number;
  chamada: number;
  data_aplicacao: string;
  flexao: number | null;
  abdominal: number | null;
  corrida_metros: number | null;
  barra: number | null;
  nota_flexao: number | null;
  nota_abdominal: number | null;
  nota_corrida: number | null;
  nota_barra: number | null;
  nota_final: number | null;
  mencao: string | null;
  observacoes: string | null;
  ciente_at: string | null;
  ciente_by: string | null;
  /** ID do avaliador que lançou o resultado (null em registros legados) */
  avaliador_id: string | null;
  created_at: string;
};

export function useMilitares() {
  return useQuery({
    queryKey: ["militares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("militares")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Militar[];
    },
  });
}

export function useResultados() {
  return useQuery({
    queryKey: ["taf_resultados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taf_resultados")
        .select("*")
        .order("data_aplicacao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TafResultado[];
    },
  });
}

export function useSaveMilitar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: {
      id?: string;
      nome: string;
      nome_guerra?: string | null;
      posto: Posto;
      identificacao?: string | null;
      data_nascimento?: string | null;
      pelotao?: string | null;
    }) => {
      const payload = {
        nome: m.nome,
        nome_guerra: m.nome_guerra ?? null,
        posto: m.posto,
        identificacao: m.identificacao ?? null,
        data_nascimento: m.data_nascimento ?? null,
        pelotao: m.pelotao ?? null,
      };
      if (m.id) {
        const { error } = await supabase
          .from("militares")
          .update(payload)
          .eq("id", m.id);
        if (error) throw error;
        return { id: m.id };
      } else {
        const { data, error } = await supabase
          .from("militares")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data as { id: string };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["militares"] }),
  });
}

export function useDeleteMilitar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("militares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["militares"] });
      qc.invalidateQueries({ queryKey: ["taf_resultados"] });
    },
  });
}

export function useSaveResultado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      r: Partial<TafResultado> & {
        militar_id: string;
        taf_numero: number;
        chamada: number;
        data_aplicacao: string;
        avaliador_id?: string | null;
      },
    ) => {
      const payload: Record<string, unknown> = {
        militar_id: r.militar_id,
        taf_numero: r.taf_numero,
        chamada: r.chamada,
        data_aplicacao: r.data_aplicacao,
        flexao: r.flexao ?? null,
        abdominal: r.abdominal ?? null,
        corrida_metros: r.corrida_metros ?? null,
        barra: r.barra ?? null,
        nota_flexao: r.nota_flexao ?? null,
        nota_abdominal: r.nota_abdominal ?? null,
        nota_corrida: r.nota_corrida ?? null,
        nota_barra: r.nota_barra ?? null,
        nota_final: r.nota_final ?? null,
        mencao: r.mencao ?? null,
        observacoes: r.observacoes ?? null,
      };

      if (!r.id && r.avaliador_id !== undefined) {
        payload.avaliador_id = r.avaliador_id ?? null;
      }

      if (r.id) {
        const { error } = await supabase
          .from("taf_resultados")
          .update(payload)
          .eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("taf_resultados")
          .upsert(payload, { onConflict: "militar_id,taf_numero,chamada" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taf_resultados"] }),
  });
}

export function useDeleteResultado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("taf_resultados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taf_resultados"] }),
  });
}
