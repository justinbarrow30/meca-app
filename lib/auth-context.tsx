import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/query-client";

interface User {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  teamId: string | null;
  playerId: string | null;
  playerLinkApproved: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; role?: string; teamId?: string; playerId?: string }) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<{ name: string; role: string; teamId: string; playerId: string }>) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json() as Promise<User>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role?: string; teamId?: string; playerId?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json() as Promise<User>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<{ name: string; role: string; teamId: string; playerId: string }>) => {
      const res = await apiRequest("PUT", "/api/auth/profile", data);
      return res.json() as Promise<User>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  const value = useMemo<AuthContextValue>(() => ({
    user: user ?? null,
    isLoading,
    isGuest: !user,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    register: (data) => registerMutation.mutateAsync(data),
    logout: () => logoutMutation.mutateAsync(),
    updateProfile: (data) => updateProfileMutation.mutateAsync(data),
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
