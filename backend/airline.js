const AIRLINE = { name: 'Flyhigh', code: 'FH', operator: 'flyhigh' };

function indiaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function departureTimestamp(value) {
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value || '') ? value : `${value}+05:30`);
}

async function ensureFlyhighNetwork(db, now = new Date()) {
  const airports = ['DEL', 'BOM', 'MAA', 'CCU'];
  const durations = { 'BOM-DEL': 135, 'DEL-BOM': 135, 'DEL-MAA': 165, 'MAA-DEL': 165, 'DEL-CCU': 135, 'CCU-DEL': 135, 'BOM-MAA': 105, 'MAA-BOM': 105, 'BOM-CCU': 165, 'CCU-BOM': 165, 'MAA-CCU': 120, 'CCU-MAA': 120 };
  const fares = { 'DEL-BOM': 5500, 'BOM-DEL': 5500, 'DEL-MAA': 6500, 'MAA-DEL': 6500, 'DEL-CCU': 6000, 'CCU-DEL': 6000, 'BOM-MAA': 4500, 'MAA-BOM': 4500, 'BOM-CCU': 7000, 'CCU-BOM': 7000, 'MAA-CCU': 5000, 'CCU-MAA': 5000 };
  const today = indiaDate(now);
  await db.collection('Airports').bulkWrite([['DEL', 'Delhi'], ['BOM', 'Mumbai'], ['MAA', 'Chennai'], ['CCU', 'Kolkata']].map(([code, name]) => ({ updateOne: { filter: { code }, update: { $setOnInsert: { code, name, city: name, country: 'India' } }, upsert: true } })));
  const flights = db.collection('Flights');
  const schedules = db.collection('Flight Info');
  await flights.createIndex({ flightNumber: 1 }, { unique: true, partialFilterExpression: { operator: AIRLINE.operator }, name: 'flyhigh_flight_number' });
  await schedules.createIndex({ flightNumber: 1, departureTime: 1 }, { unique: true, partialFilterExpression: { operator: AIRLINE.operator }, name: 'flyhigh_departure' });
  let number = 101;
  const routeUpdates = [];
  const departureUpdates = [];
  for (const origin of airports) for (const destination of airports) {
    if (origin === destination) continue;
    const flightNumber = `${AIRLINE.code}${number++}`;
    const route = { flightNumber, flightName: AIRLINE.name, operator: AIRLINE.operator, originAirport: origin, destinationAirport: destination };
    routeUpdates.push({ updateOne: { filter: { flightNumber, operator: AIRLINE.operator }, update: { $setOnInsert: route }, upsert: true } });
    for (let offset = 0; offset < 14; offset++) {
      const day = new Date(`${today}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() + offset);
      const date = day.toISOString().slice(0, 10);
      const hour = 8 + (number % 7);
      const departureTime = `${date}T${String(hour).padStart(2, '0')}:00`;
      const arrival = new Date(`${departureTime}:00Z`);
      arrival.setUTCMinutes(arrival.getUTCMinutes() + durations[`${origin}-${destination}`]);
      const baseFare = fares[`${origin}-${destination}`];
      departureUpdates.push({ updateOne: { filter: { flightNumber, departureTime, operator: AIRLINE.operator }, update: {
        $setOnInsert: { ...route, departureDate: date, departureTime, arrivalTime: arrival.toISOString().slice(0, 16), seatsAvailable: { economy: 60, business: 12, first: -1 }, prices: { economy: baseFare, business: baseFare * 2, first: 0 }, demo: true },
      }, upsert: true } });
    }
  }
  // A cold hosted function should use a few database round trips, rather than
  // one trip per route and departure. Insert-only updates preserve sold seats.
  await flights.bulkWrite(routeUpdates);
  await schedules.bulkWrite(departureUpdates);
  const ownFlights = await flights.find({ operator: AIRLINE.operator }, { projection: { flightNumber: 1 } }).toArray();
  await db.collection('Airlines').updateOne({ flightCode: AIRLINE.code }, { $set: { flightName: AIRLINE.name, operator: AIRLINE.operator, flights: ownFlights.map(row => row.flightNumber) } }, { upsert: true });
}

module.exports = { AIRLINE, indiaDate, departureTimestamp, ensureFlyhighNetwork };
