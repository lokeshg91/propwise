/**
 * The address typed on the sign-up or forgot-password form, held in memory
 * only so the check-email page can show it. It isn't written to storage, the
 * URL or browser history, and it's gone after a reload.
 */
let pending: string | null = null

export const rememberEmailForThisPage = (email: string) => {
  pending = email
}

export const pendingEmail = (): string | null => pending

export const forgetPendingEmail = () => {
  pending = null
}
