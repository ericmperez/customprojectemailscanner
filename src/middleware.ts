import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/cron/process-emails',
  '/onboarding(.*)',
]);

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();

    const { orgId } = await auth();

    // Require org membership for non-onboarding routes
    if (!orgId && !isOnboardingRoute(request)) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // Single-org enforcement: users who already have an org cannot
    // access the org-creation step of onboarding.  Allow through only
    // the gmail / done steps (needed right after initial org creation).
    if (orgId && isOnboardingRoute(request)) {
      const step = request.nextUrl.searchParams.get('step');
      if (!step || step === 'org') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
