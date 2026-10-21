import { render, screen } from '@testing-library/react'

import { App } from '@/app/App'

describe('App', () => {
  it('renders the product name', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /propwise/i })).toBeInTheDocument()
  })
})
