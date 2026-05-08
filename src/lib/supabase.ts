import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let authPromise: Promise<void> | null = null;

export async function ensureAuth(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  if (!authPromise) {
    authPromise = supabase.auth
      .signInAnonymously()
      .then(() => {
        authPromise = null;
      })
      .catch((err) => {
        authPromise = null;
        console.error("匿名登录失败:", err);
      });
  }

  return authPromise;
}
