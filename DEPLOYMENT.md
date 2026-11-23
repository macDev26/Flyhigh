# Deploy Flyhigh on Vercel

The same Vercel project serves the React frontend and the Express API. Keep the
project root at the repository root. `vercel.json` installs both sets of
dependencies, builds Vite, routes API requests to `api/index.js`, and supports
refreshing React pages such as `/admin/login` and `/eticket`.

## 1. Create the hosted database

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Create a project for Flyhigh and a **Free / M0** cluster. Do not choose Flex
   or a dedicated paid cluster for this learning project.
3. Create an application database user with `readWrite` access to the `Airline`
   database. Use a unique password and keep it out of Git and chat messages.
4. Configure Atlas Network Access so the Vercel function can connect. A laptop's
   current IP address does not cover Vercel. Prefer Vercel static egress IPs when
   available. Atlas also supports `0.0.0.0/0` for changing outbound IPs; this
   permits connection attempts from anywhere and should be an explicit choice,
   with authentication and the database-scoped account retained.
5. Open **Connect → Drivers → Node.js** and copy the connection string. Substitute
   the database user's password, URL-encoding special characters as needed. Add
   it directly to Vercel as `MONGO_URI`; do not put it in a `VITE_*` variable.

See [Atlas free-cluster setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)
and [driver connection instructions](https://www.mongodb.com/docs/atlas/driver-connection/).

The first successful API request creates the twelve Flyhigh routes and fourteen
days of demo departures automatically. It does not import local users, bookings
or personal records. Each instance refreshes missing departures when India's
calendar date changes. Existing schedules, fares and sold seats are preserved.

## 2. Set the Vercel environment variables

Open **Vercel → airline-manager → Settings → Environment Variables**. Add these
for **Production** (and separately for Preview if needed):

| Variable | Value |
| --- | --- |
| `MONGO_URI` | The private Atlas connection string |
| `MONGO_DB_NAME` | `Airline` |
| `FRONTEND_ORIGINS` | `https://airline-manager.vercel.app` |
| `GOOGLE_CLIENT_ID` | Your Google Web client ID |
| `VITE_GOOGLE_CLIENT_ID` | The same Google Web client ID |
| `ADMIN_EMAILS` | The approved administrator email |
| `STRIPE_SECRET_KEY` | Your Stripe **test** secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | The signing secret for the hosted test webhook |
| `NODE_ENV` | `production` |

Leave `VITE_API_URL` unset or empty. Requests stay on the website's own origin so
HttpOnly, Secure, SameSite cookies work without third-party cookie exceptions.
Only public Google client IDs belong in `VITE_*` variables.

The native MongoDB/Vercel marketplace integration may supply `MONGODB_URI`;
copy its value into the app's **`MONGO_URI`** setting if using that integration.

## 3. Configure Google and Stripe

In the Google Web OAuth client's **Authorized JavaScript origins**, add
`https://airline-manager.vercel.app`. Retain `http://localhost:5173` for local
development. The Google sign-in flow does not need a new OAuth redirect URL.

In Stripe's **test environment**, create an event destination for:

`https://airline-manager.vercel.app/api/stripe/webhook`

Subscribe to `checkout.session.completed` and
`checkout.session.async_payment_succeeded`. Save that destination's signing
secret in `STRIPE_WEBHOOK_SECRET`. A local Stripe CLI secret is different.

Vercel functions do not rely on background `setInterval` tasks. Payment is
verified when the customer returns; the signed webhook handles a paid checkout
when the customer closes the browser. Live Stripe keys remain disabled.

## 4. Deploy and verify

Push to the connected GitHub branch (`main`), or redeploy the latest commit in
Vercel after changing environment variables. Changing build-time variables such
as `VITE_GOOGLE_CLIENT_ID` requires a new deployment.

Check these URLs after the deployment reports **Ready**:

- `/api/health`: HTTP 200 JSON with `database: "connected"`.
- `/api/airports`: HTTP 200 JSON containing DEL, BOM, MAA and CCU.
- `/api/flights`: Flyhigh's FH routes.
- `/api/flightinfo`: the rolling demo departures.

Then search a future date within the next fourteen days, sign in, and exercise
Stripe's test success, decline and cancel cases. Refresh the saved ticket to
verify the reference is stable. Check that `/admin/login` loads when opened
directly and that an ordinary user is denied administrator endpoints.

## Deployment verification — 24 November 2026

The production site at [airline-manager.vercel.app](https://airline-manager.vercel.app/)
was checked after configuring Atlas, the matching Google client IDs and the
production Google JavaScript origin, and the Stripe test key and webhook secret.

- The health endpoint returned HTTP 200 with the database connected. Airport and
  route endpoints supplied the four demo airports and twelve Flyhigh routes.
- A hosted Stripe test checkout was created through the authenticated Flyhigh
  API using a synthetic test account and passenger. Stripe reported
  `livemode: false`, and its INR amount matched the fare stored in MongoDB.
- Canceling that checkout expired its Stripe session, created no booking, and
  left the departure's seat count unchanged. The test account was signed out.
- A harmless signed webhook check returned HTTP 200. A forged signature returned
  HTTP 400. The configured test destination subscribes to
  `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

This production check did not submit a paid checkout. Successful payment
fulfillment, repeated confirmations, ownership checks, inventory allocation and
failure recovery are also covered by the backend's automated tests.

The temporary file used to transfer the Stripe secrets into Vercel was removed
after verification. Secret values, environment files, and live database contents
are not part of this repository. No live payment key was enabled.

## Troubleshooting

- **404 on `/api/airports`:** the deployed commit does not include the API
  function/routing, or the Vercel project's root directory is incorrect.
- **503 from the API:** check `MONGO_URI`, Atlas database-user credentials and
  Network Access. The API does not disclose database credentials in responses.
- **Empty airport dropdown:** search now displays an error and retry action if
  the API cannot be reached; it does not silently show an empty list.
- **Google origin error:** register the exact HTTPS production origin and
  redeploy with matching frontend/backend client IDs.
- **Payments unavailable:** verify the server's test key and webhook secret.

Sessions are persisted in MongoDB with hashed cookie identifiers and an
eight-hour expiry/TTL index. They work across function instances and deploys;
logout revokes the stored session. Administrator access still depends on the
current backend email allowlist.

`.local/`, `.env`, `backend/env.txt`, local database backups and MongoDB binaries
are excluded from deployment. The local database remains independent.
