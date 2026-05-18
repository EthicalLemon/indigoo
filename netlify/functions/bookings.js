const { getSupabase, ok, err, preflight, getAllBookings, getAllFlights } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  // Path: /api/bookings/:userId
  const userId = event.path.replace(/.*\/bookings\/?/, '').replace(/^\//, '');
  if (!userId) return err('Missing userId', 400);

  try {
    const sb = getSupabase();
    const [allBookings, allFlights] = await Promise.all([getAllBookings(sb), getAllFlights(sb)]);

    const flightMap = {};
    allFlights.forEach(f => { if (f.messageId) flightMap[f.messageId] = f; });

    const mine = allBookings
      .filter(b => b.userId === userId)
      .map(b => {
        const f = flightMap[b.messageId];
        return f ? {
          ...b,
          depAirport: f.depAirport || b.depAirport,
          arrAirport: f.arrAirport || b.arrAirport,
          depTime:    f.depTime    || b.depTime,
          arrTime:    f.arrTime    || b.arrTime,
          aircraft:   f.aircraft   || b.aircraft,
          flightNum:  f.flightNum  || b.flightNum,
          flightStatus: f.status,
        } : b;
      })
      .sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));

    return ok({ bookings: mine, total: mine.length });
  } catch (e) {
    return err('Failed to load bookings: ' + e.message, 500);
  }
};
