# Flyhigh Airlines

A learning project for a fictional airline. Customers book Flyhigh’s own `FH`
flights; administrators manage its routes, departures, passengers and bookings.
Stripe runs exclusively in test mode. This project does not charge real money or
issue valid travel documents.

## Earlier demo recordings

These recordings show an earlier version of the project and predate the current
single-airline, Google sign-in and verified Stripe test-booking changes.

- [Demo 1 (without Stripe)](https://drive.google.com/file/d/1KRKBcX_lcVbeu2QQzBUnzvEUC4WgJwtj/view?usp=sharing)
- [Demo 2 (with Stripe)](https://drive.google.com/file/d/1eci7aoBWVO76jqizuwhYSNivgLxFSRK5/view?usp=sharing)

## Run locally

Requires Node.js, npm and a local MongoDB server.

```powershell
npm install
cd backend
npm install
npm start
```

In a second terminal:

```powershell
cd C:\Tech\Projects\Airline-Manager
npm run dev
```

Open [Flyhigh](http://localhost:5173), [traveler sign-in](http://localhost:5173/login)
or [administrator sign-in](http://localhost:5173/admin/login). Use `localhost`
when signing in with the currently configured Google OAuth client.

The frontend uses Vite’s same-origin proxy for `/api`, `/bookings` and
`/fltstatus`. Vercel routes these to the included Express function. See
[DEPLOYMENT.md](DEPLOYMENT.md) for Atlas setup, hosted environment variables
and the production verification checklist.

## Configuration

Create `.env` using `.env.example`. Set `VITE_GOOGLE_CLIENT_ID` to your public
Google Web application client ID. In the ignored `backend/env.txt`, preserve your
settings and configure:

```env
MONGO_URI=mongodb://127.0.0.1:27017
GOOGLE_CLIENT_ID=the_same_client_id.apps.googleusercontent.com
ADMIN_EMAILS=your_approved_google_account@gmail.com
STRIPE_SECRET_KEY=sk_test_your_test_key
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PORT=3001
```

Both Google IDs must match. Register your actual frontend origin under the
client’s Authorized JavaScript origins in Google Auth Platform. Users can use
Google or an existing email/password account; administrator access requires a
verified Google identity and the backend email allowlist. Sessions use HttpOnly,
SameSite cookies, expire after eight hours, and persist in MongoDB across
backend restarts and hosted function instances. Session storage is used only for display, not backend authorization.

See [Google’s client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
and [token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Flyhigh’s network

The application maintains twelve initial Flyhigh routes between Delhi, Mumbai,
Chennai and Kolkata. Flights use `FH101` through `FH112`. On startup and every
six hours locally, and on the first request after India’s date changes when
hosted, the backend adds missing demo departures for the next fourteen days,
using India’s calendar date. Existing schedules, fares and sold seats are not
reset. Economy and Business cabins are available on the initial routes.

Administrators use **Flights & routes → Add Flyhigh route**, then **Schedule
flight** to add other departures. The operating airline is always Flyhigh;
partner-airline creation is retired. Previous multi-airline route and schedule
records remain in MongoDB for history, but current searches show Flyhigh flights
only. Existing booking snapshots retain their original flight details.

The seeding command is also available manually:

```powershell
cd backend
node seedFlights.js
```

## Stripe test checkout

The backend refuses live Stripe keys. Checkout requires a signed-in user, reads
fares and availability from MongoDB, and stores passenger details in a pending
order. The browser cannot choose the charged price or create confirmed bookings.
Stripe’s return URLs contain opaque references rather than passenger details.

After Stripe confirms a successful test payment, the backend creates the saved
booking and atomically allocates seats. Repeated confirmations, page refreshes,
webhook deliveries and recovery attempts reuse the same booking and allocation.
A stable demo booking reference is stored with the booking. If a departure sells
out between checkout and payment, the losing test payment is refunded instead
of overbooking.

Failed, unpaid, expired and canceled checkouts create no booking and deduct no
seats. Canceling an open checkout expires its Stripe session and returns to a
page with a **Return to booking** action. Old client-side booking and seat-write
endpoints are disabled. E-tickets load saved bookings for the authenticated
owner; old `?info=...` ticket payloads no longer confirm anything.

For local learning, the return page verifies payment directly with Stripe, and
a local backend reconciliation task checks pending sessions every minute,
including when the customer never returns. On Vercel, configure the signed Stripe
webhook as described in [DEPLOYMENT.md](DEPLOYMENT.md); hosted functions do not
rely on background timers.
To exercise real webhook deliveries locally, install the official Stripe CLI
and run:

```powershell
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Set `STRIPE_WEBHOOK_SECRET` in `backend/env.txt` to the signing secret printed by
that command, then restart the backend. Unsigned or invalid webhook deliveries
are rejected. No webhook secret is committed to this repository.

Use Stripe’s [test cards](https://docs.stripe.com/testing): `4242 4242 4242 4242`
succeeds and `4000 0000 0000 0002` declines, with a future expiry date and a test
CVC. [Stripe’s fulfillment guide](https://docs.stripe.com/checkout/fulfillment)
explains the server verification and retry requirements.

## Validation

```powershell
npm run build
cd backend
npm test
```

The payment tests require MongoDB at `MONGO_TEST_URI` (default
`mongodb://127.0.0.1:27017`). They create and remove isolated
`Flyhigh_Payment_Test_*` databases and simulate Stripe calls. They cover unpaid,
failed, canceled, successful, repeated and concurrent confirmations, ownership,
price tampering, sold-out refunds, signed webhooks, recovery after database
failure, test-only enforcement and idempotent network seeding. Authentication
regressions are included. No test changes the main `Airline` database.

The repository’s older project-wide ESLint setup is incomplete; focused checks
use `--config eslintrc.cjs`.

## Recovered MongoDB on this machine

The local MongoDB 8.3.7 runtime was recovered from the existing MongoDB-signed
installer under `.local/mongodb-8.3.7/`. The active database is
`.local/mongodb/data/`. Starting the backend automatically starts this recovered
server if needed, bound only to `127.0.0.1:27017`. `npm run db:start` in `backend`
checks or starts it independently. Remote database URIs remain separately managed.

The original folders at `C:/data/db` and
`C:/Program Files/MongoDB/Server/8.3/data` remain untouched. Verified backups are
in `.local/mongodb-backups/20261123-122825/`; a network snapshot from before the
single-airline setup is in `.local/mongodb-backups/before-flyhigh-airline/`.

The `.local/` directory is ignored by Git and contains active records, backups,
runtime binaries and logs. Retain it when cleaning the workspace.
