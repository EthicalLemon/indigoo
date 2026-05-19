const { getSupabase, ok, err, preflight, getBookingByRef, saveBooking, getOrCreateWallet, saveWallet } = require('./_db');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return preflight(res);
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return err(res, 'Invalid JSON'); }

  const { bookingRef, confirmed } = body;
  if (!bookingRef) return err(res, 'Missing bookingRef');

  try {
    const sb      = getSupabase();
    const booking = await getBookingByRef(sb, bookingRef);
    if (!booking) return err(res, 'Booking not found', 404);

    if (confirmed) {
      booking.checkedIn = true;
      await saveBooking(sb, booking);
      return ok(res, { success: true, bookingRef, checkedIn: true });
    } else {
      const refund     = Math.floor((booking.price || 0) / 2);
      const wallet     = await getOrCreateWallet(sb, booking.userId);
      const newBalance = (wallet.balance ?? 0) + refund;
      await saveWallet(sb, booking.userId, newBalance);
      booking.checkedIn = false;
      await saveBooking(sb, booking);
      return ok(res, { success: true, bookingRef, checkedIn: false, refund, newBalance });
    }
  } catch (e) {
    return err(res, 'Check-in failed: ' + e.message, 500);
  }
};
