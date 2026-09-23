import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (!token || token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/404", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token && token.role === "ADMIN",
    },
  }
);

export const config = {
  matcher: ["/admin/:path*"],
};