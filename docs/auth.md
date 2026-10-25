# Demo authentication (v0.10)

Propwise has no backend, so every sign-in, sign-up, password and verification flow is a **labelled demonstration**. The pages validate input and walk through the real steps, but no account is created, no email is sent and no password is checked or stored. Each page shows a visible **Demo** notice, and no message claims otherwise ("Demo complete — no password was changed").

Replace these flows with your auth provider before using Propwise with real users (see [Connecting a real provider](#connecting-a-real-provider)).

## Pages

| Route | Purpose | Next step |
| --- | --- | --- |
| `/login` | Email and password, prefilled with the sample user. Any valid input signs in | Returns to `?next=`, or `/dashboard` |
| `/signup` | Full name, work email, password with live rules, confirm password, and Terms/Privacy consent | `/check-email?for=verify` |
| `/forgot-password` | Email | `/check-email?for=reset` |
| `/check-email` | "Check your email" (reset) or "Verify your email" (verify). A labelled **Demo: open the link from the email** button stands in for the email; **Resend** says nothing was sent and waits 30 seconds | Opens the demo link |
| `/reset-password?token=…` | New password and confirmation. Missing or invalid tokens show their own state | "Demo complete — no password was changed" |
| `/verify-email?token=…` | Pending, invalid and valid states | **Continue to Propwise** signs in |

The forms use field-level errors linked with `aria-describedby`, `role="alert"` and `role="status"` for outcomes, and a Show/Hide password button with `aria-pressed`.

## Demo session

The session is one `localStorage` key, `propwise-session` (`src/lib/session.ts`):

- **Absent means signed in.** This is the default, so a fresh browser, deep links and existing demos open the app directly.
- **Sign out** (user menu or `/account`) writes `{"status":"signed-out","at":"<ISO time>"}`. **Sign in** removes the key. An unreadable value counts as signed in.
- If storage refuses the write, sign-out shows "Couldn't sign out" and you stay signed in.
- Other tabs follow through the browser's `storage` event.
- The key holds no name, email, password or token, and it isn't part of backups. **Reset workspace** keeps it.

## Route guard

- `appLayoutLoader` redirects a signed-out visit to any app page to `/login?next=<path, search and hash>`. This covers direct URLs, refresh and Back/Forward.
- Signing out in this tab goes to `/login`. Signing out in another tab sends this tab to `/login?next=<current page>`.
- After sign-in, Propwise navigates to `next` with `replace`, so Back doesn't return to the login page. After sign-out, Back and Forward land on `/login` and never show app content.
- **Public pages** (`/privacy`, `/terms`, `/cookies`) work either way: signed in, they show "Back to Propwise"; signed out, "Sign in".

### `safeNext`

`src/lib/safe-next.ts` accepts only same-app paths and maps the auth pages themselves to `/dashboard`, so there are no redirect loops. Everything else falls back to `/dashboard`:

- absolute and scheme URLs, including `javascript:` and `data:`;
- protocol-relative `//host` and `/\host`;
- backslashes, control characters, and leading or trailing whitespace;
- strings over 2,048 characters, malformed `%`-encoding, or encoding nested more than 3 levels deep;
- encoded forms of any of the above;
- any result whose origin isn't the app.

## Demo tokens

- Reset and verification links carry `demo-reset-<16 hex>` or `demo-verify-<16 hex>`, made with `crypto.getRandomValues` (`src/features/auth/lib/demo-tokens.ts`, marked `DEMO ONLY`).
- They're checked **by format only**; there's nothing to redeem them against.
- A token is read once and then removed from the address bar, so refresh and Back don't carry it. Tokens live in component state only: never in storage, history state or logs.
- The email typed on sign-up or forgot password is kept in memory only and is lost on refresh, which the page then shows as "your email address".

## What is never stored

Passwords (on any form), tokens, and anything typed into the auth forms. A browser check after every flow confirms that only the documented keys exist, that no cookies are set and that sessionStorage and IndexedDB are unused.

## Connecting a real provider

1. Replace the `onSubmit` handlers in `src/features/auth/pages/` with calls to your provider, and remove the Demo notices.
2. Replace `isSignedIn`, `signIn`, `signOut` and `subscribeSession` in `src/lib/session.ts` with your provider's session. The loader guard and the live guard in `AppLayout` use only these functions.
3. Keep `safeNext` for any redirect target taken from the URL.
4. Replace the demo token helpers with your provider's reset and verification links.
5. Update `STORAGE_KEYS`, `STORAGE_ENTRIES` and the Privacy page if your provider stores anything in the browser.

## Limitations

- Any valid email and password signs in. `/login` keeps its sample email prefill even after you change the profile email.
- After a verification link is used, refreshing `/verify-email` shows the pending state rather than "expired", because nothing remembers the used token.
- There is no two-factor sign-in, sessions list or invite acceptance.
