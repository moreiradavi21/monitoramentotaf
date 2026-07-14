import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const signupSchema = loginSchema.extend({
  nome: z.string().trim().min(2, "Informe seu nome").max(100),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, signIn, signUp } = useAuth();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

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
    const parsed = signupSchema.safeParse({ nome, email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      await signUp(parsed.data.email, parsed.data.password, parsed.data.nome);
      toast.success("Conta criada! Você já pode entrar.");
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
        <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-gold text-gold-foreground">
          <ShieldCheck className="h-6 w-6" />
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
                  <Label htmlFor="su-nome">Nome</Label>
                  <Input
                    id="su-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
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
                    Mínimo 6 caracteres. O primeiro usuário registrado será o
                    administrador do sistema.
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
              Voltar ao painel público
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
