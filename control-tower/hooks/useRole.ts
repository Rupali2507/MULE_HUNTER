"use client";

import { useMemo } from "react";

export type Role = "admin" | "investigator" | "viewer";

interface DecodedJWT {
  sub?: string;
  email?: string;
  role?: Role;
  name?: string;
  exp?: number;
  iat?: number;
}

function base64UrlDecode(str: string): string {
  // Convert base64url to base64
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  try {
    return atob(padded);
  } catch {
    return "{}";
  }
}

function decodeJWT(token: string): DecodedJWT {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = base64UrlDecode(parts[1]);
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function getTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  // Try common storage keys used by the existing MuleHunter auth
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    null
  );
}

export function useRole(): { role: Role; name: string; email: string } {
  return useMemo(() => {
    const token = getTokenFromStorage();
    if (!token) {
      return { role: "viewer", name: "Guest User", email: "" };
    }

    const decoded = decodeJWT(token);

    // Check token expiry
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return { role: "viewer", name: "Guest User", email: "" };
    }

    return {
      role: decoded.role ?? "viewer",
      name: decoded.name ?? decoded.email ?? "User",
      email: decoded.email ?? "",
    };
  }, []);
}

export function getRoleFromToken(token: string): Role {
  const decoded = decodeJWT(token);
  return decoded.role ?? "viewer";
}
