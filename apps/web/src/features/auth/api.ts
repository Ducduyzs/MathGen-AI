import { apiFetch } from "@/lib/api/http";
import type { LoginResponse, RegisterRequest, User } from "@/types/api";

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/api/auth/login", { method: "POST", body: { email, password } }, false),
  register: (body: RegisterRequest) =>
    apiFetch<LoginResponse>("/api/auth/register", { method: "POST", body }, false),
  logout: () => apiFetch<void>("/api/auth/logout", { method: "POST" }, false),
  me: () => apiFetch<User>("/api/me"),
};
