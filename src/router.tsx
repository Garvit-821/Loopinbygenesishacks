import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import type { RouteHandle } from '@/components/layout/navigation';
import { PublicOnlyLayout } from '@/components/layout/PublicOnlyLayout';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { RequireRole } from '@/components/layout/RequireRole';
import { RootLayout } from '@/components/layout/RootLayout';
import { RouteError } from '@/components/layout/RouteError';
import { ShellLayout } from '@/components/layout/ShellLayout';

/**
 * Route tree (SPEC §6.2). Every page file default-exports its component and is code-split; react-router ignores
 * `default` on lazy routes, hence `page()`. Each route's `handle` gives the TopBar/document title and, for detail
 * pages, where Back goes when there's no in-app history.
 */

type PageModule = { default: ComponentType };

const page = (load: () => Promise<PageModule>) => async () => ({ Component: (await load()).default });

const handle = (title: string, back?: string): RouteHandle => (back ? { title, back } : { title });

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'dev/ui', lazy: page(() => import('@/dev/UiKitchenSink')), handle: handle('UI kit') }]
  : [];

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: LoadingScreen,
    ErrorBoundary: RouteError,
    children: [
      {
        Component: PublicOnlyLayout,
        children: [
          {
            ErrorBoundary: RouteError,
            children: [
              { index: true, lazy: page(() => import('@/features/static/LandingPage')), handle: handle('Your hackathon passport') },
              { path: 'login', lazy: page(() => import('@/features/auth/LoginPage')), handle: handle('Log in') },
              { path: 'signup', lazy: page(() => import('@/features/auth/SignupPage')), handle: handle('Sign up') },
              { path: 'forgot-password', lazy: page(() => import('@/features/auth/ForgotPasswordPage')), handle: handle('Forgot password') },
              { path: 'reset-password', lazy: page(() => import('@/features/auth/ResetPasswordPage')), handle: handle('Choose a new password') },
              { path: 'auth/callback', lazy: page(() => import('@/features/auth/OAuthCallbackPage')), handle: handle('Signing in') },
            ],
          },
        ],
      },
      {
        // Full screen, outside the shell.
        path: 'organizer/events/:eventId/door',
        Component: RequireAuth,
        children: [
          {
            element: <RequireRole role="organizer" />,
            children: [
              {
                index: true,
                lazy: page(() => import('@/features/organizer/DoorPage')),
                handle: handle('Door check-in', '/organizer/events/:eventId'),
              },
            ],
          },
        ],
      },
      {
        Component: ShellLayout,
        children: [
          {
            ErrorBoundary: RouteError,
            children: [
              {
                Component: RequireAuth,
                children: [
                  { path: 'onboarding', lazy: page(() => import('@/features/auth/OnboardingPage')), handle: handle('Welcome') },
                  { path: 'passport', lazy: page(() => import('@/features/passport/PassportPage')), handle: handle('Passport') },
                  {
                    path: 'passport/edit',
                    lazy: page(() => import('@/features/passport/EditProfilePage')),
                    handle: handle('Edit profile', '/passport'),
                  },
                  { path: 'network', lazy: page(() => import('@/features/network/NetworkPage')), handle: handle('Network') },
                  {
                    path: 'network/:connectionId',
                    lazy: page(() => import('@/features/network/ConnectionDetailPage')),
                    handle: handle('Connection', '/network'),
                  },
                  { path: 'exchange', lazy: page(() => import('@/features/exchange/ExchangePage')), handle: handle('Exchange') },
                  { path: 'live', lazy: page(() => import('@/features/live/LivePage')), handle: handle('Live') },
                  { path: 'settings', lazy: page(() => import('@/features/settings/SettingsPage')), handle: handle('Settings') },
                  {
                    element: <RequireRole role="organizer" />,
                    children: [
                      { path: 'organizer', lazy: page(() => import('@/features/organizer/OrganizerHomePage')), handle: handle('Organizer') },
                      {
                        path: 'organizer/events/:eventId',
                        lazy: page(() => import('@/features/organizer/EventConsolePage')),
                        handle: handle('Event', '/organizer'),
                      },
                      {
                        element: <RequireRole role="admin" />,
                        children: [
                          {
                            path: 'organizer/team',
                            lazy: page(() => import('@/features/organizer/TeamPage')),
                            handle: handle('Team', '/organizer'),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              // Adaptive: AppShell when signed in, PublicLayout otherwise.
              { path: 'u/:handle', lazy: page(() => import('@/features/passport/PublicProfilePage')), handle: handle('Passport', '/passport') },
              {
                path: 'verify/:credentialId',
                lazy: page(() => import('@/features/passport/VerifyCredentialPage')),
                handle: handle('Verify credential', '/passport'),
              },
              { path: 'c/:token', lazy: page(() => import('@/features/exchange/ConnectLinkPage')), handle: handle('Connect', '/exchange') },
              { path: 'privacy', lazy: page(() => import('@/features/static/PrivacyPage')), handle: handle('Privacy', '/settings') },
              { path: 'terms', lazy: page(() => import('@/features/static/TermsPage')), handle: handle('Terms', '/settings') },
              { path: '*', lazy: page(() => import('@/features/static/NotFoundPage')), handle: handle('Page not found') },
            ],
          },
        ],
      },
      ...devRoutes,
    ],
  },
];

export const router = createBrowserRouter(routes);
