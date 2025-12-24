import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role; 

  const isLoginPage = nextUrl.pathname === "/login";
  const isAdminPage = nextUrl.pathname.startsWith("/admin");
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/user/role");

  if (isApiAuthRoute) return NextResponse.next();
  
  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (isAdminPage) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};