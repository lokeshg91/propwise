import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/app/layouts/app-layout'
import { appLayoutLoader } from '@/app/layouts/app-layout.loader'
import { AuthLayout } from '@/app/layouts/auth-layout'
import { navHandle, type RouteHandle } from '@/app/routes/route-handle'
import { AppLoadingScreen } from '@/app/routes/app-loading-screen'
import { NotFoundPage } from '@/app/routes/not-found-page'
import { skipSearchParamRevalidation } from '@/app/routes/revalidation'
import { RouteErrorBoundary } from '@/app/routes/route-error-boundary'
import { propertyHandles } from '@/features/properties/properties.handles'

/** Feature pages are code-split; each module loads on first visit. */
export const routes: RouteObject[] = [
  {
    HydrateFallback: AppLoadingScreen,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        Component: AuthLayout,
        children: [
          {
            path: 'login',
            handle: { title: 'Sign in' } satisfies RouteHandle,
            lazy: async () => ({
              Component: (await import('@/features/auth/pages/login-page')).LoginPage,
            }),
          },
        ],
      },
      {
        Component: AppLayout,
        loader: appLayoutLoader,
        shouldRevalidate: skipSearchParamRevalidation,
        children: [
          {
            path: 'dashboard',
            handle: navHandle('/dashboard'),
            shouldRevalidate: skipSearchParamRevalidation,
            lazy: async () => {
              const [{ DashboardPage }, { dashboardLoader }] = await Promise.all([
                import('@/features/dashboard/pages/dashboard-page'),
                import('@/features/dashboard/dashboard.loader'),
              ])
              return { Component: DashboardPage, loader: dashboardLoader }
            },
          },
          {
            path: 'properties',
            handle: navHandle('/properties'),
            children: [
              {
                index: true,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ PropertiesPage }, { propertiesLoader }] = await Promise.all([
                    import('@/features/properties/pages/properties-page'),
                    import('@/features/properties/properties.loaders'),
                  ])
                  return { Component: PropertiesPage, loader: propertiesLoader }
                },
              },
              {
                path: 'new',
                handle: propertyHandles.create,
                lazy: async () => ({
                  Component: (await import('@/features/properties/pages/property-create-page')).PropertyCreatePage,
                }),
              },
              {
                path: ':propertyId',
                handle: propertyHandles.detail,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ PropertyDetailsPage }, { propertyDetailLoader }, { PropertyRouteError }] = await Promise.all([
                    import('@/features/properties/pages/property-details-page'),
                    import('@/features/properties/properties.loaders'),
                    import('@/features/properties/components/property-route-error'),
                  ])
                  return { Component: PropertyDetailsPage, loader: propertyDetailLoader, ErrorBoundary: PropertyRouteError }
                },
              },
              {
                path: ':propertyId/edit',
                handle: propertyHandles.edit,
                lazy: async () => {
                  const [{ PropertyEditPage }, { propertyDetailLoader }, { PropertyRouteError }] = await Promise.all([
                    import('@/features/properties/pages/property-edit-page'),
                    import('@/features/properties/properties.loaders'),
                    import('@/features/properties/components/property-route-error'),
                  ])
                  return { Component: PropertyEditPage, loader: propertyDetailLoader, ErrorBoundary: PropertyRouteError }
                },
              },
            ],
          },
          {
            path: 'tenants',
            handle: navHandle('/tenants'),
            lazy: async () => ({
              Component: (await import('@/features/tenants/pages/tenants-page')).TenantsPage,
            }),
          },
          {
            path: 'maintenance',
            handle: navHandle('/maintenance'),
            lazy: async () => ({
              Component: (await import('@/features/maintenance/pages/maintenance-page'))
                .MaintenancePage,
            }),
          },
          {
            path: 'vendors',
            handle: navHandle('/vendors'),
            lazy: async () => ({
              Component: (await import('@/features/vendors/pages/vendors-page')).VendorsPage,
            }),
          },
          {
            path: 'finance',
            handle: navHandle('/finance'),
            lazy: async () => ({
              Component: (await import('@/features/finance/pages/finance-page')).FinancePage,
            }),
          },
          {
            path: 'reports',
            handle: navHandle('/reports'),
            lazy: async () => ({
              Component: (await import('@/features/reports/pages/reports-page')).ReportsPage,
            }),
          },
          {
            path: 'staff',
            handle: navHandle('/staff'),
            lazy: async () => ({
              Component: (await import('@/features/staff/pages/staff-page')).StaffPage,
            }),
          },
          {
            path: 'notifications',
            handle: navHandle('/notifications'),
            lazy: async () => ({
              Component: (await import('@/features/notifications/pages/notifications-page'))
                .NotificationsPage,
            }),
          },
          {
            path: 'settings',
            handle: navHandle('/settings'),
            lazy: async () => ({
              Component: (await import('@/features/settings/pages/settings-page')).SettingsPage,
            }),
          },
          {
            path: '*',
            handle: { title: 'Page not found' } satisfies RouteHandle,
            Component: NotFoundPage,
          },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(routes)
}
