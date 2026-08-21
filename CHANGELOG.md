# Hydra Boosting refactor

## What changed

- Reworked the responsive header so the brand, menu control, navigation, and credit badge have separate layout space on small screens.
- Kept desktop navigation visible and added a mobile drawer route for the Admin Panel.
- Added the Admin Panel link only when the signed-in session has the admin role.
- Admin login now lands on the main dashboard, where the admin-only panel button is available.
- Registration now writes the account to Firebase and sends the user to login without creating a session.
- Added the requested account-created success message on the login screen.
- Removed the hardcoded admin credential fallback; configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` through deployment secrets.
- Order submission now refreshes the user's Firebase balance immediately before charging.
- Insufficient user balance returns `No Credits, recharge first`.
- Missing, invalid, empty, or failing provider balance checks return `This Service is Unavailable` without deducting credits.
- Failed upstream orders refund the wallet charge and do not expose upstream API responses to the browser.
- Preserved server-only Firebase Admin SDK access, CSRF checks, rate limiting, CSP, same-origin checks, secure session cookies, and Turnstile support.

## Important security boundary

The browser never receives Firebase credentials, provider API keys, provider service IDs, or raw provider responses. HTTPS, CSP, frame blocking, origin checks, CSRF tokens, and rate limits are included as practical controls. No browser application can make traffic invisible to a person who controls that browser, so the backend remains the security boundary instead of relying on anti-debugging tricks.

## Deployment

Copy `.env.example` to `.env` for local work, or add the variables directly to Railway. Firebase Realtime Database rules remain closed to direct clients:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

Run:

```bash
npm install
npm run check
npm start
```