import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, setApiToken } from "../../lib/api";
import { decodeJwt } from "../../lib/jwt";

type AuthUser = {
  id: string;
  roles: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const applyToken = useCallback((token: string | null) => {
    setAccessToken(token);
    setApiToken(token);
    if (token) {
      const payload = decodeJwt(token);
      if (payload?.sub && Array.isArray(payload.roles)) {
        setUser({ id: payload.sub, roles: payload.roles });
      } else {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ accessToken: string }>("/auth/refresh", {
        method: "POST",
      });
      applyToken(res.accessToken);
    } catch {
      applyToken(null);
    }
  }, [applyToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      applyToken(res.accessToken);
    },
    [applyToken]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      applyToken(null);
    }
  }, [applyToken]);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const value = useMemo(
    () => ({ user, accessToken, ready, login, logout, refresh }),
    [user, accessToken, ready, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
