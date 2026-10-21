export interface User {
  id: string
  name: string
  email: string
  role: string
  /** Optional avatar image. Initials are shown when it is missing. */
  avatarUrl?: string
}
