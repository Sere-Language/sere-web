"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/app/lib/db";

export function useAuthSession() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabaseClient = getSupabaseClient();

    void supabaseClient.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setReady(true);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  return {
    email,
    ready,
    signedIn: email !== null,
  };
}
