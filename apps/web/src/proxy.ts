import { ORG_ROLE } from "@haccp/shared";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const isAdminDashboardRoute = createRouteMatcher([
  "/dashboard/equipment(.*)",
  "/dashboard/task-templates(.*)",
  "/dashboard/organization(.*)",
  "/en/dashboard/equipment(.*)",
  "/en/dashboard/task-templates(.*)",
  "/en/dashboard/organization(.*)",
  "/bg/dashboard/equipment(.*)",
  "/bg/dashboard/task-templates(.*)",
  "/bg/dashboard/organization(.*)",
]);

function getForbiddenPath(pathname: string): string {
  if (pathname.startsWith("/en/")) {
    return "/en/forbidden";
  }

  return "/forbidden";
}

export default clerkMiddleware(async (auth, request) => {
  if (isAdminDashboardRoute(request)) {
    const { orgRole } = await auth.protect();

    if (orgRole !== ORG_ROLE.ADMIN) {
      const forbiddenPath = getForbiddenPath(request.nextUrl.pathname);
      return NextResponse.redirect(new URL(forbiddenPath, request.url));
    }
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    "/((?!monitoring|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
