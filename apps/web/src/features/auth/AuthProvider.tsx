"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onUnauthorized, setAccessToken } from "@/lib/api/auth-token";
import { refreshAccessToken } from "@/lib/api/http";
import type { LoginResponse, RegisterRequest, User } from "@/types/api";
import { authApi } from "./api";

type Status = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (body: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  // Mở ứng dụng: thử refresh bằng cookie httpOnly để khôi phục phiên.
  useEffect(() => {
    let cancelled = false;
    onUnauthorized(clear);
    (async () => {
      if (!(await refreshAccessToken())) {
        if (!cancelled) setStatus("guest");
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) clear();
      }
    })();
    return () => {
      cancelled = true;
      onUnauthorized(null);
    };
  }, [clear]);

  const signIn = useCallback((res: LoginResponse) => {
    setAccessToken(res.access_token);
    setUser(res.user);
    setStatus("authenticated");
    return res.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (email, password) => signIn(await authApi.login(email, password)),
      register: async (body) => signIn(await authApi.register(body)),
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          clear();
          queryClient.clear();
        }
      },
    }),
    [status, user, signIn, clear, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return ctx;
}
