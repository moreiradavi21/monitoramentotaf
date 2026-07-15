import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "avaliador" | "user";

export type Profile = {
  id: string;
  nome: string | null;
  posto: string | null;
  requested_role: string | null;
  approved: boolean;
  militar_id: string | null;
};

type SignUpArgs = {
  email: string;
  password: string;
  nome: string;
  posto: string;
  requested_role: "administrador" | "avaliador" | "companhia";
  militar_id?: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  role: Role | null;
  profile: Profile | null;
  isAdmin: boolean;
  isAvaliador: boolean;
  isCompanhia: boolean;
  approved: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (args: SignUpArgs) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (!s) {
        setRole(null);
        setProfile(null);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") qc.invalidateQueries();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc, router]);

  async function loadProfile(uid: string) {
    const [{ data: rolesData }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("profiles")
        .select("id, nome, posto, requested_role, approved, militar_id")
        .eq("id", uid)
        .maybeSingle(),
    ]);
    const roles = (rolesData ?? []).map((r: any) => r.role as Role);
    setRole(roles.includes("admin") ? "admin" : roles[0] ?? null);
    setProfile((prof as Profile | null) ?? null);
  }

  useEffect(() => {
    if (!session?.user) {
      setRole(null);
      setProfile(null);
      return;
    }
    let cancel = false;
    (async () => {
      if (!cancel) await loadProfile(session.user.id);
    })();
    return () => {
      cancel = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      profile,
      isAdmin: role === "admin",
      isAvaliador: role === "admin" || role === "avaliador",
      isCompanhia: role === "user",
      approved: !!profile?.approved,
      loading,
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async ({ email, password, nome, posto, requested_role, militar_id }) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nome, posto, requested_role, militar_id: militar_id ?? null },
          },
        });
        if (error) throw error;
      },
      signOut: async () => {
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
      },
    }),
    [session, role, profile, loading, qc],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return c;
}
