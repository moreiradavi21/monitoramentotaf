import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { POSTOS, postoPlural } from "@/lib/taf";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const POSTOS_MILITARES = [
  "AL",
  "Recruta",
  "Soldado",
  "Cabo",
  "3° SGT",
  "2° SGT",
  "1° SGT",
  "Sub Tenente",
  "Aspirante",
  "2° Tenente",
  "1° Tenente",
  "Capitão",
] as const;

const POSTOS_AVAL_ADMIN = POSTOS_MILITARES.filter(
  (p) =>
    p === "AL" ||
    p.includes("SGT") ||
    p.includes("Tenente") ||
    p === "Sub Tenente",
);

// Mapeia o posto selecionado no cadastro para as categorias da tabela `militares`.
function categoriasParaPosto(posto: string): string[] {
  if (["Capitão", "1° Tenente", "2° Tenente", "Aspirante"].includes(posto))
    return ["oficial"];
  if (["Sub Tenente", "1° SGT", "2° SGT", "3° SGT"].includes(posto))
    return ["sargento"];
  if (["AL", "Cabo", "Soldado", "Recruta"].includes(posto))
    return ["cabo", "soldado", "recruta"];
  return [];
}

const REQUESTED_ROLES = [
  { value: "companhia", label: "Militares da Cia C Apoio", desc: "Visualiza os índices e dá ciente no próprio TAF." },
  { value: "avaliador", label: "Militar Avaliador", desc: "Lança e edita os resultados do TAF (requer aprovação)." },
  { value: "administrador", label: "Militar Administrador", desc: "Gerencia militares, TAF e aprovações (requer aprovação)." },
] as const;

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const signupSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe seu nome").max(100),
    email: z.string().trim().email("E-mail inválido").max(255),
    password: z.string().min(6, "Mínimo 6 caracteres").max(72),
    posto: z.string().min(1, "Selecione o posto/graduação"),
    requested_role: z.enum(["companhia", "avaliador", "administrador"]),
    militar_id: z.string().nullable().optional(),
  })
  .refine(
    (v) => {
      if (v.requested_role === "companhia") return true;
      return POSTOS_AVAL_ADMIN.some((p) => p === v.posto);
    },
    {
      message: "Avaliador/Administrador precisa ser AL, SGT ou TEN.",
      path: ["posto"],
    },
  )
  .refine(
    (v) => {
      if (v.requested_role !== "companhia") return true;
      return !!v.militar_id;
    },
    {
      message: "Selecione seu nome na lista de militares.",
      path: ["militar_id"],
    },
  );

function AuthPage() {
  const navigate = useNavigate();
  const { session, signIn, signUp } = useAuth();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [posto, setPosto] = useState<string>("");
  const [requestedRole, setRequestedRole] =
    useState<"companhia" | "avaliador" | "administrador">("companhia");
  const [militarId, setMilitarId] = useState<string>("");

  const [militares, setMilitares] = useState<
    { id: string; nome: string; posto: string }[]
  >([]);

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  // Carrega lista de militares (leitura pública indisponível — usamos RPC?)
  // A tabela agora exige aprovação; para o cadastro exibimos via função pública.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("militares_publicos" as any).select("id, nome, posto");
      if (Array.isArray(data)) setMilitares(data as any);
    })();
  }, []);

  const postoOptions = useMemo(
    () => (requestedRole === "companhia" ? POSTOS_MILITARES : POSTOS_AVAL_ADMIN),
    [requestedRole],
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      toast.success("Bem-vindo(a)!");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({
      nome,
      email,
      password,
      posto,
      requested_role: requestedRole,
      militar_id: requestedRole === "companhia" ? militarId : null,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      await signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        nome: parsed.data.nome,
        posto: parsed.data.posto,
        requested_role: parsed.data.requested_role,
        militar_id: parsed.data.militar_id ?? null,
      });
      if (parsed.data.requested_role === "companhia") {
        toast.success(
          "Conta criada! Aguardando aprovação do administrador para acesso completo.",
        );
      } else {
        toast.success(
          "Solicitação enviada! Sua conta ficará ativa após aprovação do administrador.",
        );
      }
      setTab("login");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao registrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center">
          <img
            src="/tucandeira.png"
            alt="Tucandeira CCAP"
            className="h-16 w-16 rounded-full object-cover"
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Companhia CCAP
          </p>
          <h1 className="font-display text-2xl tracking-wider text-primary">
            Controle de TAF
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display tracking-wide">
            Acesso restrito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Registrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form className="space-y-3" onSubmit={handleLogin}>
                <div className="space-y-1">
                  <Label htmlFor="li-email">E-mail</Label>
                  <Input
                    id="li-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="li-pw">Senha</Label>
                  <Input
                    id="li-pw"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form className="space-y-3" onSubmit={handleSignup}>
                <div className="space-y-1">
                  <Label>Tipo de conta</Label>
                  <div className="grid gap-2">
                    {REQUESTED_ROLES.map((r) => (
                      <label
                        key={r.value}
                        className={`cursor-pointer rounded-md border p-2 text-sm transition ${
                          requestedRole === r.value
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="rrole"
                            className="mt-1"
                            checked={requestedRole === r.value}
                            onChange={() => {
                              setRequestedRole(r.value);
                              setPosto("");
                              setMilitarId("");
                            }}
                          />
                          <div className="font-medium text-primary">{r.label}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="su-nome">Nome completo</Label>
                  <Input
                    id="su-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Posto/Graduação</Label>
                    <Select value={posto} onValueChange={setPosto}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {postoOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {requestedRole !== "companhia" && (
                      <p className="text-[11px] text-muted-foreground">
                        Somente AL, SGT ou TEN.
                      </p>
                    )}
                  </div>

                  {requestedRole === "companhia" && (
                    <div className="space-y-1">
                      <Label>Seu nome na lista</Label>
                      <Select value={militarId} onValueChange={setMilitarId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const cats = categoriasParaPosto(posto);
                            if (!posto) {
                              return (
                                <div className="px-2 py-3 text-xs text-muted-foreground">
                                  Selecione primeiro o posto/graduação.
                                </div>
                              );
                            }
                            const grupos = POSTOS.filter((c) => cats.includes(c.value));
                            const total = grupos.reduce(
                              (n, cat) => n + militares.filter((m) => m.posto === cat.value).length,
                              0,
                            );
                            if (total === 0) {
                              return (
                                <div className="px-2 py-3 text-xs text-muted-foreground">
                                  Nenhum militar disponível.
                                </div>
                              );
                            }
                            return grupos.map((cat) => {
                              const list = militares.filter((m) => m.posto === cat.value);
                              if (!list.length) return null;
                              return (
                                <div key={cat.value}>
                                  <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                                    {postoPlural(cat.value as any)}
                                  </div>
                                  {list.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.nome}
                                    </SelectItem>
                                  ))}
                                </div>
                              );
                            });
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="su-email">E-mail</Label>
                  <Input
                    id="su-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="su-pw">Senha</Label>
                  <Input
                    id="su-pw"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Mínimo 6 caracteres.
                  </p>
                </div>
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? "Registrando..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline">
              Voltar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
