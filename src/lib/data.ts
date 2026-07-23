import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Posto } from "./taf";

// ── Cache local para categoria_taf ──────────────────────────────────────────
// Fallback via localStorage enquanto o cache de schema do PostgREST não inclui
// a coluna categoria_taf. Quando a coluna for reconhecida pelo Supabase, os
// valores do localStorage têm precedência sobre o DB (merge transparente).

const LS_KEY = "taf_categoria_taf_cache";

function _lcGet(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}
function _lcSet(id: string, v: string) {
  const c = _lcGet(); c[id] = v;
  localStorage.setItem(LS_KEY, JSON.stringify(c));
}
function _lcRead(id: string): string | null { return _lcGet()[id] ?? null; }

export type Militar = {
  id: string;
  nome: string;
  nome_guerra: string | null;
  posto: Posto;
  identificacao: string | null;
  data_nascimento: string | null;
  pelotao: string | null;
  categoria_taf: string | null;
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
      // Mescla categoria_taf do localStorage (fallback enquanto PostgREST não
      // reconhece a coluna no schema cache).
      const cache = _lcGet();
      return ((data ?? []) as any[]).map((m): Militar => ({
        ...m,
        categoria_taf: (m.categoria_taf as string | null) ?? cache[m.id] ?? null,
      }));
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
      categoria_taf?: string | null;
    }) => {
      const categoria = m.categoria_taf ?? "belico_masculino";

      // Payload base (sem categoria_taf — evita erro de schema cache do PostgREST)
      const basePayload = {
        nome: m.nome,
        nome_guerra: m.nome_guerra ?? null,
        posto: m.posto,
        identificacao: m.identificacao ?? null,
        data_nascimento: m.data_nascimento ?? null,
        pelotao: m.pelotao ?? null,
      };

      let savedId: string;

      if (m.id) {
        // Tenta salvar com categoria_taf no banco; se falhar (schema cache),
        // salva apenas o payload base e persiste a categoria no localStorage.
        const { error } = await supabase
          .from("militares")
          .update({ ...basePayload, categoria_taf: categoria } as any)
          .eq("id", m.id);
        if (error) {
          if (error.message?.includes("categoria_taf") || error.code === "PGRST204") {
            const { error: e2 } = await supabase
              .from("militares")
              .update(basePayload)
              .eq("id", m.id);
            if (e2) throw e2;
          } else {
            throw error;
          }
        }
        savedId = m.id;
      } else {
        const { data, error } = await supabase
          .from("militares")
          .insert({ ...basePayload, categoria_taf: categoria } as any)
          .select("id")
          .single();
        if (error) {
          if (error.message?.includes("categoria_taf") || error.code === "PGRST204") {
            const { data: d2, error: e2 } = await supabase
              .from("militares")
              .insert(basePayload)
              .select("id")
              .single();
            if (e2) throw e2;
            savedId = (d2 as { id: string }).id;
          } else {
            throw error;
          }
        } else {
          savedId = (data as { id: string }).id;
        }
      }

      // Persiste categoria no localStorage (funciona mesmo sem a coluna no DB)
      _lcSet(savedId!, categoria);
      return { id: savedId! };
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
          .update(payload as any)
          .eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("taf_resultados")
          .upsert(payload as any, { onConflict: "militar_id,taf_numero,chamada" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taf_resultados"] }),
  });
}

// ── Importação em lote ──────────────────────────────────────────────────────

export type ImportRow = {
  nome: string;
  nome_guerra?: string | null;
  posto: Posto;
  data_nascimento?: string | null;
  identificacao?: string | null;
  pelotao: string;
};

export type ImportResult = { created: number; updated: number; skipped: number };

export function useImportMilitares() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ImportRow[]): Promise<ImportResult> => {
      const { data: existing, error: fetchErr } = await supabase
        .from("militares")
        .select("id, nome");
      if (fetchErr) throw fetchErr;

      const byNome = new Map(
        (existing ?? []).map((m) => [m.nome.toLowerCase().trim(), m.id as string]),
      );

      let created = 0, updated = 0, skipped = 0;

      for (const row of rows) {
        if (!row.nome.trim()) { skipped++; continue; }
        const key = row.nome.toLowerCase().trim();
        const payload = {
          nome: row.nome.trim(),
          nome_guerra: row.nome_guerra?.trim() || null,
          posto: row.posto,
          data_nascimento: row.data_nascimento || null,
          identificacao: row.identificacao?.trim() || null,
          pelotao: row.pelotao,
        };

        const existingId = byNome.get(key);
        if (existingId) {
          const { error } = await supabase
            .from("militares")
            .update(payload)
            .eq("id", existingId);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase.from("militares").insert(payload);
          if (error) throw error;
          created++;
        }
      }

      return { created, updated, skipped };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["militares"] }),
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
