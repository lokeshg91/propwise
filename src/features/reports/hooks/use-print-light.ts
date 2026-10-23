import { useEffect } from 'react'

/**
 * Reports always print in the light theme: the dark class is removed just
 * before printing and put back afterwards. Nothing is saved.
 */
export function usePrintLight() {
  useEffect(() => {
    let restore = false
    const before = () => {
      // Only remember a dark theme we removed ourselves (print events can repeat).
      if (document.documentElement.classList.contains('dark')) {
        restore = true
        document.documentElement.classList.remove('dark')
      }
    }
    const after = () => {
      if (restore) document.documentElement.classList.add('dark')
      restore = false
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [])
}
