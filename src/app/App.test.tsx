import { render, screen } from '@testing-library/react'

import { App } from '@/app/App'

describe('App', () => {
  it('redirects to the dashboard overview', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })
})
