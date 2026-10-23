import { useCallback, useState } from 'react'
import { toast } from 'sonner'

/**
 * One settings save: shows nothing until the save has succeeded. A failure
 * (validation or storage) stays next to the form as an error and no success
 * message appears.
 */
export function useSaveAction(onSaved: () => void) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (save: () => Promise<unknown>, success: { title: string; description?: string }) => {
      setPending(true)
      setError(null)
      try {
        await save()
        toast.success(success.title, success.description ? { description: success.description } : undefined)
        onSaved()
        return true
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.')
        return false
      } finally {
        setPending(false)
      }
    },
    [onSaved],
  )

  return { pending, error, setError, run }
}
