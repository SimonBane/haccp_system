import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  "/",
  "/en",
  "/sign-in(.*)",
  "/en/sign-in(.*)",
  "/sign-up(.*)",
  "/en/sign-up(.*)",
  "/accept-invitation(.*)",
  "/en/accept-invitation(.*)",
  "/no-organization(.*)",
  "/en/no-organization(.*)",
]);

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/en/dashboard(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  if (isProtectedRoute(request)) {
    const { orgId, sessionStatus } = await auth();

    if (sessionStatus === "pending") {
      return intlMiddleware(request);
    }

    if (!orgId) {
      return NextResponse.redirect(new URL("/no-organization", request.url));
    }
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
