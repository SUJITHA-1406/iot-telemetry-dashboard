import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getActiveSession } from "@/lib/auth-service";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(() => {
    const local = getActiveSession();
    if (local?.user) {
      return {
        access_token: local.token,
        token_type: "bearer",
        expires_in: 604800,
        expires_at: Math.floor(local.expiresAt / 1000),
        refresh_token: local.token,
        user: local.user as unknown as User,
      } as Session;
    }
    return null;
  });

  const [user, setUser] = useState<User | null>(() => {
    const local = getActiveSession();
    return local?.user ? (local.user as unknown as User) : null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    // If local session exists immediately, we are not loading
    const local = getActiveSession();
    return !local?.user;
  });

  useEffect(() => {
    const syncAuth = () => {
      const local = getActiveSession();
      if (local?.user) {
        setUser(local.user as unknown as User);
        setSession({
          access_token: local.token,
          token_type: "bearer",
          expires_in: 604800,
          expires_at: Math.floor(local.expiresAt / 1000),
          refresh_token: local.token,
          user: local.user as unknown as User,
        } as Session);
        setLoading(false);
      } else {
        // Only clear if neither local nor supabase is present
        supabase.auth.getSession().then(({ data }) => {
          if (data?.session?.user) {
            setUser(data.session.user);
            setSession(data.session);
          } else {
            setUser(null);
            setSession(null);
          }
          setLoading(false);
        });
      }
    };

    // Listen to Supabase auth events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user) {
        setSession(s);
        setUser(s.user);
        setLoading(false);
      } else {
        const local = getActiveSession();
        if (local?.user) {
          setUser(local.user as unknown as User);
        } else {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    });

    // Check Supabase session
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
      }
      setLoading(false);
    });

    window.addEventListener("auth_state_changed", syncAuth);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("auth_state_changed", syncAuth);
    };
  }, []);

  return { session, user, loading };
}
