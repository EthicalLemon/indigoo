const { getSupabase, ok, err, preflight, getAllFlights } = require('./_db');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return preflight(res);
  try {
    const sb   = getSupabase();
    const list = (await getAllFlights(sb)).filter(f => f && f.flightNum);
    return ok(res, { flights: list, total: list.length });
  } catch (e) {
    return err(res, 'Failed to load flights: ' + e.message, 500);
  }
};
