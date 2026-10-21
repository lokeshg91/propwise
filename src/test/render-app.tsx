import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from '@/app/providers/app-providers'
import { routes } from '@/app/routes/router'

/** Renders the full application at `path` using an in-memory router. */
export function renderApp(path = '/dashboard') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const result = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, router, user }
}
