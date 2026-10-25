import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { signOut } from '@/lib/session'

/**
 * Ends the demo session and goes to sign-in (user menu and Account page).
 * If the browser refuses to save the signed-out flag, the user stays signed
 * in and is told so.
 */
export function useSignOut(): () => void {
  const navigate = useNavigate()
  return useCallback(() => {
    if (!signOut()) {
      toast.error('Couldn’t sign out', { description: 'This browser didn’t allow Propwise to save the change. You’re still signed in.' })
      return
    }
    void navigate('/login', { replace: true })
    toast.success('Signed out', { description: 'Demo session ended. Sign in to continue.' })
  }, [navigate])
}
