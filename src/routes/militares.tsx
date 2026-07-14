import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Trash2, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import { POSTOS, postoLabel, type Posto } from "@/lib/taf";
import {
  useDeleteMilitar,
  useMilitares,
  useSaveMilitar,
  type Militar,
} from "@/lib/data";

export const Route = createFileRoute("/militares")({
  component: MilitaresPage,
});

function MilitaresPage() {
  const { data: militares = [], isLoading } = useMilitares();
  const save = useSaveMilitar();
  const del = useDeleteMilitar();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Militar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Militar | null>(null);
  const [filter, setFilter] = useState<Posto | "todos">("todos");
  const [q, setQ] = useState("");

  const [nome, setNome] = useState("");
  const [posto, setPosto] = useState<Posto>("soldado");
  const [ident, setIdent] = useState("");

  function openNew() {
    setEditing(null);
    setNome("");
    setPosto("soldado");
    setIdent("");
    setOpen(true);
  }

  function openEdit(m: Militar) {
    setEditing(m);
    setNome(m.nome);
    setPosto(m.posto);
    setIdent(m.identificacao ?? "");
    setOpen(true);
  }

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Informe o nome do militar.");
      return;
    }
    try {
      await save.mutateAsync({
        id: editing?.id,
        nome: nome.trim(),
        posto,
        identificacao: ident.trim() || null,
      });
      toast.success(editing ? "Militar atualizado." : "Militar cadastrado.");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Militar removido.");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover.");
    }
  }

  const filtered = useMemo(() => {
    return militares.filter((m) => {
      if (filter !== "todos" && m.posto !== filter) return false;
      if (q && !m.nome.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [militares, filter, q]);

  const grouped = useMemo(() => {
    return POSTOS.map((p) => ({
      posto: p,
      list: filtered.filter((m) => m.posto === p.value),
    }));
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Efetivo
          </p>
          <h1 className="mt-1 text-3xl font-display tracking-wide text-primary">
            Militares
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro do efetivo da Companhia CCAP separado por categoria.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo militar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wide">
                {editing ? "Editar militar" : "Novo militar"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome de guerra / Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Posto / Graduação</Label>
                  <Select value={posto} onValueChange={(v) => setPosto(v as Posto)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTOS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Identificação (opcional)</Label>
                  <Input
                    placeholder="Ex.: nº interno"
                    value={ident}
                    onChange={(e) => setIdent(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar militar pelo nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {POSTOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.plural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando efetivo...</p>
      )}

      {!isLoading && militares.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum militar cadastrado. Clique em <b>Novo militar</b> para começar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(({ posto: p, list }) =>
          list.length === 0 ? null : (
            <Card key={p.value}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg tracking-wide text-primary">
                    {p.plural}
                  </CardTitle>
                  <Badge variant="outline">{list.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {list.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{m.nome}</div>
                        {m.identificacao && (
                          <div className="text-xs text-muted-foreground">
                            {m.identificacao}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDelete(m)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover militar?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete &&
                `${postoLabel(confirmDelete.posto)} ${confirmDelete.nome} será removido, junto com todos os TAFs vinculados. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
