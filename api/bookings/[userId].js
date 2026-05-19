const { getSupabase, ok, err, preflight, getAllBookings, getAllFlights } = require('../_db');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return preflight(res);
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const { userId } = req.query;
  if (!userId) return err(res, 'Missing userId', 400);

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

    return ok(res, { bookings: mine, total: mine.length });
  } catch (e) {
    return err(res, 'Failed to load bookings: ' + e.message, 500);
  }
};
