const { getSupabase, ok, err, preflight, getAllFlights } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  try {
    const sb     = getSupabase();
    const list   = (await getAllFlights(sb)).filter(f => f && f.flightNum);
    return ok({ flights: list, total: list.length });
  } catch (e) {
    return err('Failed to load flights: ' + e.message, 500);
  }
};
