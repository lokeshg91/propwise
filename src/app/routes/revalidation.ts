import { type ShouldRevalidateFunctionArgs } from 'react-router'

/**
 * Filters live in the URL. Changing them is a client-side view change, so
 * loaders skip re-fetching when only the query string differs. Explicit
 * refreshes (`useRevalidator`) and real navigations still revalidate.
 */
export function skipSearchParamRevalidation({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  const onlySearchChanged = currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search
  return onlySearchChanged ? false : defaultShouldRevalidate
}
