import { getAccount } from '@/data/services'

/** The signed-in user's profile and notification preferences. */
export async function accountLoader() {
  return { account: await getAccount() }
}

export type AccountData = Awaited<ReturnType<typeof accountLoader>>
