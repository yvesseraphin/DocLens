import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { auth } from "../lib/api.js";

function parseSupabaseFragment(hash) {
  if (!hash || !hash.includes("access_token="))
    return { isAuthCallback: false };
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    isAuthCallback: true,
    type: params.get("type"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname || "/login");

  useEffect(() => {
    const { isAuthCallback, type, accessToken, refreshToken } =
      parseSupabaseFragment(window.location.hash);

    if (isAuthCallback) {
      if (accessToken) auth.setToken(accessToken);
      if (refreshToken) localStorage.setItem("dl_refresh_token", refreshToken);

      supabase.auth
        .getUser(accessToken)
        .then(({ data }) => {
          if (data?.user) {
            const u = data.user;
            auth.setUser({
              id: u.id,
              email: u.email,
              full_name:
                u.user_metadata?.full_name ||
                u.user_metadata?.name ||
                u.email?.split("@")[0] ||
                "User",
              avatar_url: u.user_metadata?.avatar_url || null,
            });
          }
        })
        .catch(() => {});

      const dest = type === "recovery" ? "/change-password" : "/dashboard";
      window.history.replaceState(null, "", dest);
      setPath(dest);
      return;
    }

    const current = window.location.pathname;
    if (current === "/") {
      window.history.replaceState(null, "", "/login");
      setPath("/login");
    } else {
      setPath(current);
    }

    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useCallback((nextPath) => {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  }, []);

  return [path, navigate];
}
