"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthBrowserClient } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  useEffect(() => {
    const supabase = createAuthBrowserClient();

    // PKCE flow (Google OAuth): exchange code for session
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? "/auth/login?error=auth_failed" : next);
      });
      return;
    }

    // Implicit flow (magic link via generateLink): the Supabase browser client
    // automatically detects #access_token hash fragments and establishes the session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          router.replace(next);
        }
      }
    );

    // Also check if the session was already established by the time this runs
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(next);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </main>
  );
}
