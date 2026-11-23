const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "env.txt") });
const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const bodyparser = require("body-parser");
const { createAuth, publicUser, PROFILE_FIELDS } = require("./auth");
const { ensureLocalMongo } = require("./localMongo");
const { AIRLINE, ensureFlyhighNetwork } = require("./airline");
const { createPaymentService, PaymentError } = require("./payments");

const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
const stripe = require("stripe")(stripeKey);

// Global exception handler to prevent backend crashes
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason?.message || reason);
});

const app = express();
const port = Number(process.env.PORT) || 3001;

// Enable CORS
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174').split(',').map(origin => origin.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
    return res.status(403).json({ success: false, message: 'This origin is not allowed.' });
  }
  next();
});

// MongoDB connection URI
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
if (!uri) {
  console.error("Missing MONGO_URI. Please set it in backend/env.txt or .env");
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
const databaseName = process.env.MONGO_DB_NAME || "Airline";
const database = client.db(databaseName);

// Start this machine's recovered local database when needed, then connect.
ensureLocalMongo(uri).then(() => client.connect()).then(() => {
  return ensureFlyhighNetwork(database).then(() => {
    console.log("MongoDB connected; Flyhigh departures ready");
    payments.reconcile().catch(() => console.error('Stripe test checkout reconciliation will retry.'));
  });
}).catch((err) => {
  console.error("MongoDB connection error:", err);
});

const payments = createPaymentService({ db: database, stripe, testMode: /^(sk|rk)_test_/.test(stripeKey) && !/placeholder|your_/i.test(stripeKey), allowedOrigins, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET });
const paymentRoute = handler => async (req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); res.json(await handler(req)); }
  catch (error) {
    res.status(error instanceof PaymentError ? error.status : 502).json({ message: error instanceof PaymentError ? error.message : 'The test payment could not be completed. Please try again.' });
  }
};
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), paymentRoute(req => payments.webhook(req.body, req.headers['stripe-signature'])));
app.use(bodyparser.json());
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const auth = createAuth({
  users: database.collection('Users'),
  clientId: process.env.GOOGLE_CLIENT_ID,
  adminEmails: process.env.ADMIN_EMAILS,
  production: process.env.NODE_ENV === 'production',
});
app.post('/api/auth/google', auth.googleLogin);
app.get('/api/auth/session', auth.session);
app.post('/api/auth/logout', auth.logout);
app.get('/api/me', auth.requireUser, async (req, res) => {
  try {
    const user = await database.collection('Users').findOne({ email: req.authUser.email });
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json(publicUser(user, req.authUser.role));
  } catch { res.status(503).json({ message: 'Unable to load your profile.' }); }
});
// Sensitive admin reads and all network-management writes require a verified session.
app.use((req, res, next) => {
  const requestPath = req.path.replace(/\/+$/, '').toLowerCase();
  const adminReads = ['/api/login', '/api/users', '/api/feedback', '/api/update-profile', '/api/update-profile-on', '/api/airlines-addflt'];
  const adminWrites = ['/api/airlines', '/api/airlines-addflt', '/api/flights', '/api/flightin'];
  if ((['GET', 'HEAD'].includes(req.method) && adminReads.includes(requestPath)) || (req.method !== 'GET' && req.method !== 'OPTIONS' && adminWrites.includes(requestPath))) return auth.requireAdmin(req, res, next);
  if (req.method === 'POST' && ['/api/update-profile', '/api/update-profile-on'].includes(requestPath)) return auth.requireUser(req, res, next);
  next();
});
app.get('/api/airlines', asyncRoute(async (req, res) => {
  const flights = await database.collection('Flights').find({ operator: AIRLINE.operator }, { projection: { flightNumber: 1 } }).toArray();
  res.json([{ flightName: AIRLINE.name, flightCode: AIRLINE.code, flights: flights.map(row => row.flightNumber) }]);
}));
app.post('/api/airlines', (req, res) => res.status(410).json({ message: 'Flyhigh operates all flights. Add a Flyhigh route instead.' }));
app.post('/api/airlines-addflt', (req, res) => res.status(410).json({ message: 'Flight routes are managed directly by Flyhigh.' }));

app.get("/api/airports", (req, res) => {
  const db = database;
  const collection = db.collection("Airports");
  collection
    .find()
    .toArray()
    .then((airports) => {
      res.json(airports);
    })
    .catch((err) => {
      console.error("Error fetching airports:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.get("/bookings", auth.requireUser, (req, res) => {
  const db = database;
  const collection = db.collection("Bookings");
  collection
    .find(req.authUser.role === 'admin' ? {} : { email: req.authUser.email })
    .toArray()
    .then((bookings) => {
      res.json(bookings);
    })
    .catch((err) => {
      console.error("Error fetching bookings:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post('/bookings', auth.requireUser, (req, res) => res.status(410).json({ message: 'Bookings are created only after verified Stripe test payments.' }));
app.get('/api/bookings/:id', auth.requireUser, paymentRoute(req => payments.getBooking(req.params.id, req.authUser)));
app.post('/api/payments', auth.requireUser, paymentRoute(req => payments.createCheckout(req.body, req.authUser, req.headers.origin || allowedOrigins[0])));
app.post('/api/payments/confirm', auth.requireUser, paymentRoute(req => payments.confirm(req.body.sessionId, req.authUser)));
app.post('/api/payments/cancel', auth.requireUser, paymentRoute(req => payments.cancel(req.body.orderId, req.authUser)));

app.get("/fltstatus", (req, res) => {
  const db = database;
  const collection = db.collection("Flight Status");
  collection
    .find()
    .toArray()
    .then((status) => {
      res.json(status);
    })
    .catch((err) => {
      console.error("Error fetching flight status:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post("/fltstatus", asyncRoute(async (req, res) => {
  const db = database;
  const collection = db.collection("Flight Status");
  const { originAirport_, destinationAirport_, selectedDate_ } = req.body;
  const result = await collection.insertOne({
    originAirport_,
    destinationAirport_,
    selectedDate_,
  });
}));

app.get("/api/login", (req, res) => {
  const db = database;
  const collection = db.collection("Users");
  collection
    .find({}, { projection: { password: 0, googleSub: 0 } })
    .toArray()
    .then((users) => {
      res.json(users);
    })
    .catch((err) => {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post("/api/login", asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
  try {
    const user = await database.collection('Users').findOne({ email: email.trim().toLowerCase(), password });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    await database.collection('Users').updateOne({ _id: user._id }, { $set: { status: 1 } });
    // Password login never grants admin access; administrators must verify their Google identity.
    res.json({ success: true, message: 'Login successful', user: auth.startSession(req, res, user, 'user') });
  } catch { res.status(503).json({ success: false, message: 'Unable to reach the account database.' }); }
}));

app.get("/api/users", (req, res) => {
  const db = database;
  const collection = db.collection("Users");
  collection
    .find({}, { projection: { password: 0, googleSub: 0 } })
    .toArray()
    .then((users) => {
      res.json(users);
    })
    .catch((err) => {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post("/api/users", asyncRoute(async (req, res) => {
  const db = database;
  const collection = db.collection("Users");
  const { title, firstName, lastName, email, password, mobileNumber, birthday, gender, maritalStatus, address } =
    req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !password || !email.trim()) return res.status(400).json({ success: false, message: 'Email and password are required.' });
  const normalizedEmail = email.trim().toLowerCase();
  const user = await collection.findOne({ email: normalizedEmail });
  if (user) {
    return res
      .status(400)
      .json({ success: false, message: "Username already Exists" });
  }
  const newUser = {
    title,
    firstName,
    lastName,
    email: normalizedEmail,
    password,
    mobileNumber,
    birthday: birthday || '',
    gender: gender || '',
    maritalStatus: maritalStatus || '',
    address: address || '',
    status: 'Active'
  };
  await collection.insertOne(newUser);
  res.json({ success: true, message: "Registered successful" });
}));

app.get("/api/update-profile", (req, res) => {
  const db = database;
  const collection = db.collection("Users");
  collection
    .find({}, { projection: { password: 0, googleSub: 0 } })
    .toArray()
    .then((users) => {
      res.json(users);
    })
    .catch((err) => {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post("/api/update-profile", asyncRoute(async (req, res) => {
  const db = database;
  const collection = db.collection("Users");
  const email = req.authUser.email;
  const updatedProfile = Object.fromEntries(PROFILE_FIELDS.filter(key => typeof req.body.updatedProfile?.[key] === 'string').map(key => [key, req.body.updatedProfile[key]]));
  const result = await collection.updateOne(
    { email: email },
    { $set: updatedProfile },
  );
  console.log("Update result:", result);
  if (result.matchedCount === 1) {
    res.status(200).json({ message: "Profile updated successfully" });
  } else {
    console.log("User not found for update");
    res.status(404).json({ message: "User not found" });
  }
}));

app.get("/api/update-profile-on", (req, res) => {
  const db = database;
  const collection = db.collection("Users");
  collection
    .find({}, { projection: { password: 0, googleSub: 0 } })
    .toArray()
    .then((users) => {
      res.json(users);
    })
    .catch((err) => {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post("/api/update-profile-on", asyncRoute(async (req, res) => {
  const db = database;
  const collection = db.collection("Users");
  const email = req.authUser.email;
  const status = req.body.status ? 1 : 0;
  const result = await collection.updateOne(
    { email: email },
    { $set: { status } },
  );
  console.log("Update status:", status);
  if (result.matchedCount === 1) {
    res.status(200).json({ message: "Status updated successfully" });
  } else {
    console.log("User not found for update");
    res.status(404).json({ message: "User not found" });
  }
}));

app.get("/api/flights", (req, res) => {
  const db = database;
  const collection = db.collection("Flights");
  collection
    .find({ operator: AIRLINE.operator })
    .toArray()
    .then((flights) => {
      res.json(flights);
    })
    .catch((err) => {
      console.error("Error fetching flights:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post('/api/flights', asyncRoute(async (req, res) => {
  const flightNumber = String(req.body.flightNumber || '').replace(/\s/g, '').toUpperCase();
  const { originAirport, destinationAirport } = req.body;
  if (!/^FH\d{1,4}$/.test(flightNumber) || originAirport === destinationAirport) return res.status(400).json({ message: 'Use an FH flight number and two different airports.' });
  const airports = await database.collection('Airports').countDocuments({ code: { $in: [originAirport, destinationAirport] } });
  if (airports !== 2) return res.status(400).json({ message: 'Select valid origin and destination airports.' });
  try {
    await database.collection('Flights').insertOne({ flightName: AIRLINE.name, flightNumber, operator: AIRLINE.operator, originAirport, destinationAirport });
    res.status(201).json({ success: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This Flyhigh flight number already exists.' });
    throw error;
  }
}));

app.get("/api/flights/count", async (req, res) => {
  const db = database;
  const collection = db.collection("Flights");
  const counts = await collection
    .aggregate([
      { $group: { _id: "$flightName", count: { $sum: 1 } } },
      { $project: { flightName: "$_id", count: 1, _id: 0 } },
    ])
    .toArray();
  res.json(counts);
});

app.get("/api/feedback", (req, res) => {
  const db = database;
  const collection = db.collection("Feedback");
  collection
    .find()
    .toArray()
    .then((feedback) => {
      res.json(feedback);
    })
    .catch((err) => {
      console.error("Error fetching feedback:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post("/api/feedback", asyncRoute(async (req, res) => {
  const db = database;
  const collection = db.collection("Feedback");
  const { email, firstImpression, hearAbout, missingAnything, rating } =
    req.body;
  const result = await collection.insertOne({
    email,
    firstImpression,
    hearAbout,
    missingAnything,
    rating,
  });
  res.json({ success: true });
}));

app.get("/api/flightinfo", (req, res) => {
  const db = database;
  const collection = db.collection("Flight Info");
  collection
    .find({ operator: AIRLINE.operator })
    .toArray()
    .then((fltinfo) => {
      res.json(fltinfo);
    })
    .catch((err) => {
      console.error("Error fetching flight info:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post("/api/flightinfo", asyncRoute(async (req, res) => {
  const db = database;
  const collection = db.collection("Flight Info");
  const { flightNumber, departureDate } = req.body;
  const fltinfo = await collection.findOne({ flightNumber, departureDate, operator: AIRLINE.operator });
  if (!fltinfo) {
    return res.status(400).json({ success: false, message: "Invalid" });
  }
  res.json(fltinfo);
}));

app.get("/api/flightin", (req, res) => {
  const db = database;
  const collection = db.collection("Flight Info");
  collection
    .find({ operator: AIRLINE.operator })
    .toArray()
    .then((fltinfo) => {
      res.json(fltinfo);
    })
    .catch((err) => {
      console.error("Error fetching flight info:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post('/api/flightin', asyncRoute(async (req, res) => {
  const route = await database.collection('Flights').findOne({ flightNumber: req.body.flightNumber, operator: AIRLINE.operator });
  const { departureTime, arrivalTime, seatsAvailable, prices } = req.body;
  if (!route || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(departureTime || '') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(arrivalTime || '') || !(new Date(arrivalTime) > new Date(departureTime))) return res.status(400).json({ message: 'Select a Flyhigh route and a valid departure and arrival time.' });
  const cabins = ['economy', 'business', 'first'];
  if (!cabins.some(cabin => seatsAvailable?.[cabin] > 0) || cabins.some(cabin => !Number.isInteger(seatsAvailable?.[cabin]) || (seatsAvailable[cabin] !== -1 && seatsAvailable[cabin] < 1) || !Number.isInteger(prices?.[cabin]) || (seatsAvailable[cabin] > 0 && prices[cabin] < 1))) return res.status(400).json({ message: 'Provide valid seat counts and fares for each enabled cabin.' });
  try {
    await database.collection('Flight Info').insertOne({ flightName: AIRLINE.name, flightNumber: route.flightNumber, operator: AIRLINE.operator, originAirport: route.originAirport, destinationAirport: route.destinationAirport, departureDate: departureTime.split('T')[0], departureTime, arrivalTime, seatsAvailable, prices, demo: true });
    res.status(201).json({ success: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This departure is already scheduled.' });
    throw error;
  }
}));

app.get("/api/flight", (req, res) => {
  const db = database;
  const collection = db.collection("Flight Info");
  collection
    .find({ operator: AIRLINE.operator })
    .toArray()
    .then((fltinfo) => {
      res.json(fltinfo);
    })
    .catch((err) => {
      console.error("Error fetching flight info:", err);
      res.status(500).json({ error: "Server Error" });
    });
});

app.post('/api/flight', (req, res) => res.status(410).json({ message: 'Seat allocation is handled by verified payment confirmation.' }));
const reconciliationTimer = setInterval(() => payments.reconcile().catch(() => console.error('Stripe test reconciliation will retry.')), 60000);
reconciliationTimer.unref();
const demoNetworkTimer = setInterval(() => ensureFlyhighNetwork(database).catch(() => console.error('Flyhigh demo departure refresh will retry.')), 6 * 60 * 60 * 1000);
demoNetworkTimer.unref();

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({ success: false, message: 'The request could not be completed. Please try again.' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
