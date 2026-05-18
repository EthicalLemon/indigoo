const { getSupabase, ok, err, preflight, getBookingByRef, saveBooking, getOrCreateWallet, saveWallet } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const { bookingRef, confirmed } = body;
  if (!bookingRef) return err('Missing bookingRef');

  try {
    const sb      = getSupabase();
    const booking = await getBookingByRef(sb, bookingRef);
    if (!booking) return err('Booking not found', 404);

    if (confirmed) {
      booking.checkedIn = true;
      await saveBooking(sb, booking);
      return ok({ success: true, bookingRef, checkedIn: true });
    } else {
      const refund     = Math.floor((booking.price || 0) / 2);
      const wallet     = await getOrCreateWallet(sb, booking.userId);
      const newBalance = (wallet.balance ?? 0) + refund;
      await saveWallet(sb, booking.userId, newBalance);
      booking.checkedIn = false;
      await saveBooking(sb, booking);
      return ok({ success: true, bookingRef, checkedIn: false, refund, newBalance });
    }
  } catch (e) {
    return err('Check-in failed: ' + e.message, 500);
  }
};
