# Hydra Boosting

Hydra is a small, server-rendered SMM ordering panel built with Express, EJS, Firebase Admin SDK, and Firebase Realtime Database. The browser receives only the public service names and this panel's own UI. Provider credentials, service IDs, pricing, balance checks, wallet mutations, and order forwarding stay on the server.

## What changed


No application can make a captured HTTPS request invisible to a user controlling their own browser. The realistic defense is to make captured values short-lived or session-bound, revalidate every value server-side, never ship secrets, use HTTPS, and monitor/rate-limit abuse. This project follows that model rather than claiming to defeat Burp/ZAP.

## Run locally

## Source code overview

Hydra is a server-rendered Express application. A request enters `server.js`, passes through the global security and maintenance checks, reaches one of the route modules, and normally ends in an EJS view. Firebase Realtime Database is accessed only through the backend; the browser uses the small JSON API in `routes/orders.js` for service lists and price quotes.

### Application entry points

- `server.js` creates the Express app, loads environment variables, configures EJS, Helmet, URL-encoded body parsing, sessions, rate limiting, origin validation, static files, maintenance mode, routes, 404 handling, and the final 500 handler. It also validates the production session secret and starts the HTTP listener.
- `start.js` is the deployment wrapper. It verifies that `express` is available at runtime, prints a useful Railway volume diagnostic when dependencies are hidden, and then loads `server.js`.
- `package.json` defines the Node 20 runtime, the `start` command, the syntax-check command, and dependencies: Express, EJS, Firebase Admin, sessions, security middleware, bcrypt, UUIDs, dotenv, and rate limiting.

### Configuration, persistence, and integrations

- `config/services.js` is the fixed public catalog. It defines the four categories, service names, provider service IDs, prices per 1,000, availability, and quantity limits. Tiktok comments are enabled only when their two environment variables are present. Helper functions retrieve categories and services by category or public ID.
- `lib/db.js` is the Firebase data-access layer. It initializes Firebase Admin from either one service-account JSON variable or three separate credentials, then exposes user lookup/creation/update, atomic balance changes, order creation/query/update, status updates, and maintenance settings under the `hydra` database node.
- `lib/firebaseSessionStore.js` implements the `express-session` store backed by `hydra/sessions`. It supports session get, set, destroy, and cookie touch operations. Production fails closed when Firebase is unavailable; development can fall back to the default in-memory store.
- `services/jtsmmClient.js` is the provider adapter. It sends form-encoded requests with the server-only API key, applies a 20-second timeout, and exposes provider balance, single-order placement, single-order status, and up-to-100-order status lookup.
- `firebase.rules.json` denies all direct client reads and writes. Only the trusted Firebase Admin SDK used by the server can access application data.

### Middleware and security

- `middleware/asyncHandler.js` forwards rejected promises from route handlers to Express error handling.
- `middleware/auth.js` supplies user and admin guards, redirects authenticated visitors away from login/signup, blocks regular users during maintenance, and tracks activity for the admin online/offline indicator. Each authenticated user is reloaded from Firebase rather than trusted solely from the session.
- `middleware/originCheck.js` checks the `Origin` or `Referer` host on mutating requests when `SITE_URL` is configured.
- `middleware/rateLimit.js` defines a global limit, a stricter login/signup limit, and an order/status-refresh limit.
- `lib/security.js` verifies Cloudflare Turnstile, bypassing it only in development when no secret is configured; it also creates per-session CSRF tokens and compares submitted tokens with a timing-safe comparison.

### Routes and business behavior

- `routes/auth.js` handles signup, login, and logout. Signup validates usernames and passwords, verifies Turnstile, hashes passwords with bcrypt, creates a zero-credit user, and redirects to login. Login verifies the password, supports the separately configured admin credentials, regenerates the session, records user activity, and rejects banned users.
- `routes/dashboard.js` renders the order form with the available platform categories, CSRF token, and flash message.
- `routes/orders.js` owns the order workflow and its JSON helpers. `/api/services` returns only public service metadata; `/api/quote` validates a service and quantity and calculates the charge. `POST /orders` revalidates every field, requires an HTTP(S) link and an allowed quantity, checks the user wallet, checks provider availability, atomically deducts credits, records a local order, submits it upstream, and refunds the user if storage or provider submission fails.
- `routes/status.js` renders the signed-in user's orders with normalized display statuses. Its refresh endpoint batches pending provider IDs in groups of 100, updates local statuses, and reports success or failure through a flash message.
- `routes/settings.js` renders account settings and changes a user's password only after CSRF validation, current-password verification, and new-password validation. It also supplies the configured admin Telegram contact.
- `routes/admin.js` protects the admin console and provides user listing, activity state, balance add/deduct/set operations, ban/unban toggling, maintenance-mode toggling, and all-order history.

### Browser assets and views

- `public/js/app.js` controls the responsive navigation drawer and dynamically loads services and quotes from the order JSON endpoints. It updates the displayed total and keeps order submission disabled until the selected service and quantity are valid.
- `public/css/style.css` contains the main layout, forms, cards, navigation, tables, buttons, alerts, order status badges, and responsive rules.
- `public/css/theme.css` overrides the base palette with Hydra's charcoal, amber, indigo, and warm neutral theme.
- `public/css/readable.css` improves contrast, focus states, mobile navigation, table readability, spacing, and reduced-motion behavior.
- `views/partials/head.ejs` supplies shared metadata, the favicon, page title, and stylesheets. `views/partials/navbar.ejs` supplies desktop navigation, the brand, current balance, and admin link. `views/partials/drawer.ejs` supplies the mobile menu and logout form.
- `views/login.ejs` and `views/signup.ejs` render authentication forms with CSRF and Turnstile fields. `views/dashboard.ejs` renders the order form. `views/status.ejs` renders order history and refresh controls. `views/settings.ejs` renders password and support settings. `views/admin.ejs` renders maintenance, user, balance, access, activity, and order-management tables.
- `views/maintenance.ejs`, `views/404.ejs`, and `views/500.ejs` are the maintenance, not-found, and server-error responses. EJS escapes displayed user/provider values with `<%=` in the templates.

### Request and order flow

1. The browser loads the dashboard after authentication; the server supplies categories but never exposes provider credentials or provider IDs.
2. The browser requests the selected category's public services and posts a quote request as the quantity changes.
3. On submission, the server ignores client-side assumptions and repeats category, service, URL, quantity, price, balance, CSRF, and provider-availability checks.
4. The server deducts the wallet transactionally, stores a `Submitting` order, calls the provider, then either records the provider order ID and `Pending` status or refunds the wallet and marks the order `Failed`.
5. The status page reads local orders. Refresh batches pending IDs through the provider and maps provider states to `DONE`, `IN PROGRESS`, `PENDING`, or `CANCELED` for display.

### Deployment and supporting files

- `Dockerfile` builds the production image and installs Node dependencies.
- `railway.json` describes Railway deployment behavior; Railway supplies `PORT` and starts through the package command.
- `firebase.seed.json` contains optional Firebase seed data for initial setup.
- `data/` is reserved for local or persistent application data when a deployment needs a narrow mounted storage path.
- `CHANGELOG.md` records project changes. `README.md` contains setup, environment-variable, provider-contract, admin, security, and deployment documentation.

```bash
cp .env.example .env
npm install
npm run check
npm start
```

Railway is configured to build from the included `Dockerfile`. The image
installs runtime dependencies from the public npm registry, then starts with
`node start.js`. The startup guard stops immediately if the image is missing
`express`, which usually means a Railway Volume is mounted over `/app` or
`/app/node_modules`. Do not mount a volume over the application directory;
use a narrow path such as `/app/data` if persistent files are needed.

Open `http://localhost:3000`. In development Turnstile can be omitted. In production, configure Turnstile or login/signup fail closed.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | Railway sets it | HTTP port |
| `NODE_ENV` | recommended `production` | secure cookies and fail-closed bot checks |
| `SITE_URL` | recommended | canonical deployment URL |
| `SESSION_SECRET` | yes in production | long random session signing secret |
| `BASE_API_URL` | for live orders | provider API URL, server-only |
| `API_KEY` | for live orders | provider API key, server-only |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | production | Cloudflare Turnstile |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | production | private admin credentials; both must be configured |
| `MAX_SHAREABLE_CREDITS` | no; defaults to `700` | positive integer cap for the server-managed admin allocation pool |
| `TIKTOK_COMMENT_SERVICE_ID` / `TIKTOK_COMMENT_PRICE` | optional | enables the configured default Tiktok comment service |
| `ADMIN_TELEGRAM` | optional | support contact |
| `FIREBASE_DATABASE_URL` | yes | Firebase RTDB URL |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | recommended | Complete Firebase service-account JSON in one Railway Secret |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | alternative | Separate Firebase Admin variables; keep all three in Railway Secrets |

`API_BASE_URL` and `JTSMM_API_URL` are accepted as backwards-compatible URL aliases, but new deployments should use `BASE_API_URL`. `JTSMM_API_KEY` remains accepted as a backwards-compatible key alias, but new deployments should use `API_KEY`.

## Railway deployment

1. Create a new GitHub repository and push this folder:

   ```bash
   git init
   git add .
   git commit -m "Upgrade Hydra Boosting"
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

2. In Railway, choose **New Project → Deploy from GitHub repo** and select the repository.
3. Add the variables above under the service's **Variables** tab. Put secrets directly in Railway; never commit `.env`.
4. Generate a public domain under **Settings → Networking** and set `SITE_URL` to that URL.
5. Redeploy and confirm `/login`, `/signup`, and `/admin`.

The included `package.json` gives Railway the start command (`node server.js`). Railway supplies `PORT`. Firebase RTDB is the durable application store, including sessions under `hydra/sessions`. The included `firebase.rules.json` intentionally blocks all direct browser reads and writes; the Admin SDK backend is the only data path.

## Admin

The admin login uses `ADMIN_USERNAME` and `ADMIN_PASSWORD`. There is no password fallback in the application, so the admin account is disabled until both values are configured. Admin maintenance access is not blocked by maintenance mode.

Production also requires a 32-character `SESSION_SECRET` and Firebase configuration. The server exits instead of using an in-memory session store when those values are missing.

## Provider contract

The provider must support form-encoded `action=balance`, `action=add`, and `action=status` requests. The balance guard treats a failed, malformed, or zero provider balance as unavailable and shows `This Service is Unavailable`; user credits remain untouched. The provider script supplied with this project reports its balance separately from Hydra's PHP retail credits, so the two currencies are not compared directly. If the provider is available but the user wallet is empty, the user sees `No Credits, recharge first` and no `action=add` request is sent.