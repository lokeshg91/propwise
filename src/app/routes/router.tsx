import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/app/layouts/app-layout'
import { appLayoutLoader } from '@/app/layouts/app-layout.loader'
import { FixedFormatProvider } from '@/app/providers/settings-provider'
import { AuthLayout } from '@/app/layouts/auth-layout'
import { PublicLayout } from '@/app/layouts/public-layout'
import { navHandle, type RouteHandle } from '@/app/routes/route-handle'
import { AppLoadingScreen } from '@/app/routes/app-loading-screen'
import { NotFoundPage } from '@/app/routes/not-found-page'
import { skipSearchParamRevalidation } from '@/app/routes/revalidation'
import { RouteErrorBoundary } from '@/app/routes/route-error-boundary'
import { propertyHandles } from '@/features/properties/properties.handles'
import { maintenanceHandles } from '@/features/maintenance/maintenance.handles'
import { tenantHandles } from '@/features/tenants/tenants.handles'
import { financeHandles } from '@/features/finance/finance.handles'
import { vendorHandles } from '@/features/vendors/vendors.handles'
import { staffHandles } from '@/features/staff/staff.handles'

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
          {
            path: 'signup',
            handle: { title: 'Create account' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/auth/pages/signup-page')).SignupPage }),
          },
          {
            path: 'forgot-password',
            handle: { title: 'Reset your password' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/auth/pages/forgot-password-page')).ForgotPasswordPage }),
          },
          {
            path: 'check-email',
            handle: { title: 'Check your email' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/auth/pages/check-email-page')).CheckEmailPage }),
          },
          {
            path: 'reset-password',
            handle: { title: 'Choose a new password' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/auth/pages/reset-password-page')).ResetPasswordPage }),
          },
          {
            path: 'verify-email',
            handle: { title: 'Verify your email' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/auth/pages/verify-email-page')).VerifyEmailPage }),
          },
        ],
      },
      {
        Component: PublicLayout,
        children: [
          {
            path: 'privacy',
            handle: { title: 'Privacy policy' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/legal/pages/privacy-page')).PrivacyPage }),
          },
          {
            path: 'terms',
            handle: { title: 'Terms of service' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/legal/pages/terms-page')).TermsPage }),
          },
          {
            path: 'cookies',
            handle: { title: 'Cookies and local storage' } satisfies RouteHandle,
            lazy: async () => ({ Component: (await import('@/features/legal/pages/cookies-page')).CookiesPage }),
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
              // The Dashboard keeps its fixed sample data and USD / en-US formatting, whatever the workspace settings.
              const FixedDashboard = () => (
                <FixedFormatProvider>
                  <DashboardPage />
                </FixedFormatProvider>
              )
              return { Component: FixedDashboard, loader: dashboardLoader }
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
                  const [{ PropertyDetailsPage }, { propertyDetailsLoader }, { PropertyRouteError }] = await Promise.all([
                    import('@/features/properties/pages/property-details-page'),
                    import('@/features/properties/properties.loaders'),
                    import('@/features/properties/components/property-route-error'),
                  ])
                  return { Component: PropertyDetailsPage, loader: propertyDetailsLoader, ErrorBoundary: PropertyRouteError }
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
            children: [
              {
                index: true,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ TenantsPage }, { tenantsLoader }] = await Promise.all([
                    import('@/features/tenants/pages/tenants-page'),
                    import('@/features/tenants/tenants.loaders'),
                  ])
                  return { Component: TenantsPage, loader: tenantsLoader }
                },
              },
              {
                path: 'new',
                handle: tenantHandles.create,
                // Keep the ?propertyId&unitId preselection without refetching.
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ TenantCreatePage }, { tenantCreateLoader }] = await Promise.all([
                    import('@/features/tenants/pages/tenant-create-page'),
                    import('@/features/tenants/tenants.loaders'),
                  ])
                  return { Component: TenantCreatePage, loader: tenantCreateLoader }
                },
              },
              {
                path: ':tenantId',
                handle: tenantHandles.detail,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ TenantDetailsPage }, { tenantDetailLoader }, { TenantRouteError }] = await Promise.all([
                    import('@/features/tenants/pages/tenant-details-page'),
                    import('@/features/tenants/tenants.loaders'),
                    import('@/features/tenants/components/tenant-route-error'),
                  ])
                  return { Component: TenantDetailsPage, loader: tenantDetailLoader, ErrorBoundary: TenantRouteError }
                },
              },
              {
                path: ':tenantId/edit',
                handle: tenantHandles.edit,
                lazy: async () => {
                  const [{ TenantEditPage }, { tenantEditLoader }, { TenantRouteError }] = await Promise.all([
                    import('@/features/tenants/pages/tenant-edit-page'),
                    import('@/features/tenants/tenants.loaders'),
                    import('@/features/tenants/components/tenant-route-error'),
                  ])
                  return { Component: TenantEditPage, loader: tenantEditLoader, ErrorBoundary: TenantRouteError }
                },
              },
            ],
          },
          {
            path: 'maintenance',
            handle: navHandle('/maintenance'),
            children: [
              {
                index: true,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ MaintenancePage }, { maintenanceLoader }] = await Promise.all([
                    import('@/features/maintenance/pages/maintenance-page'),
                    import('@/features/maintenance/maintenance.loaders'),
                  ])
                  return { Component: MaintenancePage, loader: maintenanceLoader }
                },
              },
              {
                path: 'new',
                handle: maintenanceHandles.create,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ RequestCreatePage }, { requestCreateLoader }] = await Promise.all([
                    import('@/features/maintenance/pages/request-create-page'),
                    import('@/features/maintenance/maintenance.loaders'),
                  ])
                  return { Component: RequestCreatePage, loader: requestCreateLoader }
                },
              },
              {
                path: ':requestId',
                handle: maintenanceHandles.detail,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ RequestDetailsPage }, { requestDetailLoader }, { RequestRouteError }] = await Promise.all([
                    import('@/features/maintenance/pages/request-details-page'),
                    import('@/features/maintenance/maintenance.loaders'),
                    import('@/features/maintenance/components/request-route-error'),
                  ])
                  return { Component: RequestDetailsPage, loader: requestDetailLoader, ErrorBoundary: RequestRouteError }
                },
              },
              {
                path: ':requestId/edit',
                handle: maintenanceHandles.edit,
                lazy: async () => {
                  const [{ RequestEditPage }, { requestEditLoader }, { RequestRouteError }] = await Promise.all([
                    import('@/features/maintenance/pages/request-edit-page'),
                    import('@/features/maintenance/maintenance.loaders'),
                    import('@/features/maintenance/components/request-route-error'),
                  ])
                  return { Component: RequestEditPage, loader: requestEditLoader, ErrorBoundary: RequestRouteError }
                },
              },
            ],
          },
          {
            path: 'vendors',
            handle: navHandle('/vendors'),
            children: [
              {
                index: true,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ VendorsPage }, { vendorsLoader }] = await Promise.all([
                    import('@/features/vendors/pages/vendors-page'),
                    import('@/features/vendors/vendors.loaders'),
                  ])
                  return { Component: VendorsPage, loader: vendorsLoader }
                },
              },
              {
                path: 'new',
                handle: vendorHandles.create,
                lazy: async () => ({
                  Component: (await import('@/features/vendors/pages/vendor-create-page')).VendorCreatePage,
                }),
              },
              {
                path: ':vendorId',
                handle: vendorHandles.detail,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ VendorDetailsPage }, { vendorDetailLoader }, { VendorRouteError }] = await Promise.all([
                    import('@/features/vendors/pages/vendor-details-page'),
                    import('@/features/vendors/vendors.loaders'),
                    import('@/features/vendors/components/vendor-route-error'),
                  ])
                  return { Component: VendorDetailsPage, loader: vendorDetailLoader, ErrorBoundary: VendorRouteError }
                },
              },
              {
                path: ':vendorId/edit',
                handle: vendorHandles.edit,
                lazy: async () => {
                  const [{ VendorEditPage }, { vendorDetailLoader }, { VendorRouteError }] = await Promise.all([
                    import('@/features/vendors/pages/vendor-edit-page'),
                    import('@/features/vendors/vendors.loaders'),
                    import('@/features/vendors/components/vendor-route-error'),
                  ])
                  return { Component: VendorEditPage, loader: vendorDetailLoader, ErrorBoundary: VendorRouteError }
                },
              },
            ],
          },
          {
            path: 'finance',
            handle: navHandle('/finance'),
            shouldRevalidate: skipSearchParamRevalidation,
            lazy: async () => {
              const [{ FinanceLayout }, { financeLayoutLoader }] = await Promise.all([
                import('@/features/finance/pages/finance-layout'),
                import('@/features/finance/finance.loaders'),
              ])
              return { Component: FinanceLayout, loader: financeLayoutLoader }
            },
            children: [
              {
                index: true,
                lazy: async () => {
                  const [{ FinanceOverviewPage }, { financeOverviewLoader }] = await Promise.all([
                    import('@/features/finance/pages/finance-overview-page'),
                    import('@/features/finance/finance.loaders'),
                  ])
                  return { Component: FinanceOverviewPage, loader: financeOverviewLoader }
                },
              },
              {
                path: 'transactions',
                handle: financeHandles.transactions,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ TransactionsPage }, { transactionsLoader }] = await Promise.all([
                    import('@/features/finance/pages/transactions-page'),
                    import('@/features/finance/finance.loaders'),
                  ])
                  return { Component: TransactionsPage, loader: transactionsLoader }
                },
              },
              {
                path: 'income/new',
                handle: financeHandles.newIncome,
                lazy: async () => {
                  const [{ IncomeCreatePage }, { financeFormLoader }] = await Promise.all([
                    import('@/features/finance/pages/income-create-page'),
                    import('@/features/finance/finance.loaders'),
                  ])
                  return { Component: IncomeCreatePage, loader: financeFormLoader }
                },
              },
              {
                path: 'expenses/new',
                handle: financeHandles.newExpense,
                lazy: async () => {
                  const [{ ExpenseCreatePage }, { financeFormLoader }] = await Promise.all([
                    import('@/features/finance/pages/expense-create-page'),
                    import('@/features/finance/finance.loaders'),
                  ])
                  return { Component: ExpenseCreatePage, loader: financeFormLoader }
                },
              },
              {
                path: 'transactions/:transactionId/edit',
                handle: financeHandles.edit,
                lazy: async () => {
                  const [{ TransactionEditPage }, { transactionEditLoader }, { FinanceRouteError }] = await Promise.all([
                    import('@/features/finance/pages/transaction-edit-page'),
                    import('@/features/finance/finance.loaders'),
                    import('@/features/finance/components/finance-route-error'),
                  ])
                  return { Component: TransactionEditPage, loader: transactionEditLoader, ErrorBoundary: FinanceRouteError }
                },
              },
              {
                path: 'transactions/:transactionId',
                handle: financeHandles.detail,
                lazy: async () => {
                  const [{ TransactionDetailPage }, { transactionDetailLoader }, { FinanceRouteError }] = await Promise.all([
                    import('@/features/finance/pages/transaction-detail-page'),
                    import('@/features/finance/finance.loaders'),
                    import('@/features/finance/components/finance-route-error'),
                  ])
                  return { Component: TransactionDetailPage, loader: transactionDetailLoader, ErrorBoundary: FinanceRouteError }
                },
              },
              {
                path: 'receivables',
                handle: financeHandles.receivables,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ ReceivablesPage }, { receivablesLoader }] = await Promise.all([
                    import('@/features/finance/pages/receivables-page'),
                    import('@/features/finance/finance.loaders'),
                  ])
                  return { Component: ReceivablesPage, loader: receivablesLoader }
                },
              },
            ],
          },
          {
            path: 'reports',
            handle: navHandle('/reports'),
            children: [
              {
                index: true,
                lazy: async () => {
                  const [{ ReportsPage }, { reportsHubLoader }] = await Promise.all([import('@/features/reports/pages/reports-page'), import('@/features/reports/reports.loaders')])
                  return { Component: ReportsPage, loader: reportsHubLoader }
                },
              },
              {
                path: 'income-expense',
                handle: { title: 'Income & Expense', section: 'Main', parent: { label: 'Reports', to: '/reports' } } satisfies RouteHandle,
                lazy: async () => {
                  const [{ IncomeExpensePage }, { incomeExpenseLoader }] = await Promise.all([import('@/features/reports/pages/income-expense-page'), import('@/features/reports/reports.loaders')])
                  return { Component: IncomeExpensePage, loader: incomeExpenseLoader }
                },
              },
              {
                path: 'rent-collection',
                handle: { title: 'Rent Collection', section: 'Main', parent: { label: 'Reports', to: '/reports' } } satisfies RouteHandle,
                lazy: async () => {
                  const [{ RentCollectionPage }, { rentCollectionLoader }] = await Promise.all([import('@/features/reports/pages/rent-collection-page'), import('@/features/reports/reports.loaders')])
                  return { Component: RentCollectionPage, loader: rentCollectionLoader }
                },
              },
              {
                path: 'receivables',
                handle: { title: 'Receivables & Aging', section: 'Main', parent: { label: 'Reports', to: '/reports' } } satisfies RouteHandle,
                lazy: async () => {
                  const [{ ReceivablesReportPage }, { receivablesLoader }] = await Promise.all([import('@/features/reports/pages/receivables-report-page'), import('@/features/reports/reports.loaders')])
                  return { Component: ReceivablesReportPage, loader: receivablesLoader }
                },
              },
              {
                path: 'property-performance',
                handle: { title: 'Property performance', section: 'Main', parent: { label: 'Reports', to: '/reports' } } satisfies RouteHandle,
                lazy: async () => {
                  const [{ PropertyPerformancePage }, { propertyPerformanceLoader }] = await Promise.all([import('@/features/reports/pages/property-performance-page'), import('@/features/reports/reports.loaders')])
                  return { Component: PropertyPerformancePage, loader: propertyPerformanceLoader }
                },
              },
              {
                path: 'maintenance-expenses',
                handle: { title: 'Maintenance expenses', section: 'Main', parent: { label: 'Reports', to: '/reports' } } satisfies RouteHandle,
                lazy: async () => {
                  const [{ MaintenanceReportPage }, { maintenanceLoader }] = await Promise.all([import('@/features/reports/pages/maintenance-report-page'), import('@/features/reports/reports.loaders')])
                  return { Component: MaintenanceReportPage, loader: maintenanceLoader }
                },
              },
            ],
          },
          {
            path: 'staff',
            handle: navHandle('/staff'),
            children: [
              {
                index: true,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ StaffPage }, { staffListLoader }] = await Promise.all([import('@/features/staff/pages/staff-page'), import('@/features/staff/staff.loaders')])
                  return { Component: StaffPage, loader: staffListLoader }
                },
              },
              {
                path: 'new',
                handle: staffHandles.create,
                lazy: async () => {
                  const [{ StaffCreatePage }, { staffCreateLoader }] = await Promise.all([import('@/features/staff/pages/staff-create-page'), import('@/features/staff/staff.loaders')])
                  return { Component: StaffCreatePage, loader: staffCreateLoader }
                },
              },
              {
                path: ':staffId',
                handle: staffHandles.detail,
                shouldRevalidate: skipSearchParamRevalidation,
                lazy: async () => {
                  const [{ StaffDetailsPage }, { staffDetailLoader }, { StaffRouteError }] = await Promise.all([
                    import('@/features/staff/pages/staff-details-page'),
                    import('@/features/staff/staff.loaders'),
                    import('@/features/staff/components/staff-route-error'),
                  ])
                  return { Component: StaffDetailsPage, loader: staffDetailLoader, ErrorBoundary: StaffRouteError }
                },
              },
              {
                path: ':staffId/edit',
                handle: staffHandles.edit,
                lazy: async () => {
                  const [{ StaffEditPage }, { staffEditLoader }, { StaffRouteError }] = await Promise.all([
                    import('@/features/staff/pages/staff-edit-page'),
                    import('@/features/staff/staff.loaders'),
                    import('@/features/staff/components/staff-route-error'),
                  ])
                  return { Component: StaffEditPage, loader: staffEditLoader, ErrorBoundary: StaffRouteError }
                },
              },
            ],
          },
          {
            path: 'notifications',
            handle: navHandle('/notifications'),
            shouldRevalidate: skipSearchParamRevalidation,
            lazy: async () => {
              const [{ NotificationsPage }, { notificationsLoader }] = await Promise.all([
                import('@/features/notifications/pages/notifications-page'),
                import('@/features/notifications/notifications.loaders'),
              ])
              return { Component: NotificationsPage, loader: notificationsLoader }
            },
          },
          {
            path: 'settings',
            handle: navHandle('/settings'),
            shouldRevalidate: skipSearchParamRevalidation,
            lazy: async () => {
              const [{ SettingsPage }, { settingsLoader }] = await Promise.all([
                import('@/features/settings/pages/settings-page'),
                import('@/features/settings/settings.loaders'),
              ])
              return { Component: SettingsPage, loader: settingsLoader }
            },
          },
          {
            path: 'account',
            handle: { title: 'Account', section: 'Management' } satisfies RouteHandle,
            lazy: async () => {
              const [{ AccountPage }, { accountLoader }] = await Promise.all([import('@/features/account/pages/account-page'), import('@/features/account/account.loaders')])
              return { Component: AccountPage, loader: accountLoader }
            },
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
