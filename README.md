# Hydra Boosting

Hydra is a small, server-rendered SMM ordering panel built with Express, EJS, Firebase Admin SDK, and Firebase Realtime Database. The browser receives only the public service names and this panel's own UI. Provider credentials, service IDs, pricing, balance checks, wallet mutations, and order forwarding stay on the server.

## What changed

- Modular routes, Firebase data access, provider client, middleware, and fixed catalog.
- Warm charcoal / amber / indigo responsive interface with platform language and icons.
- New users start at **0 credits**. Admin can add or deduct credit, ban/unban users, review all orders, and toggle maintenance mode.
- Every order is revalidated on the server, uses the fixed catalog, requires a quantity of at least **3000**, checks user credit atomically, checks provider balance before deduction, and refunds a charge if the upstream order fails.
- CSRF tokens, strict same-origin checks, Helmet headers, session cookies, request size limits, and rate limiting are included.

No application can make a captured HTTPS request invisible to a user controlling their own browser. The realistic defense is to make captured values short-lived or session-bound, revalidate every value server-side, never ship secrets, use HTTPS, and monitor/rate-limit abuse. This project follows that model rather than claiming to defeat Burp/ZAP.

## Run locally

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