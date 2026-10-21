import { useState } from 'react'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from '@/app/providers/app-providers'
import { createAppRouter } from '@/app/routes/router'

export function App() {
  const [router] = useState(createAppRouter)

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
