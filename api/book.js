const { getSupabase, ok, err, preflight, getAllFlights, getAllBookings, getOrCreateWallet, saveWallet, saveBooking, queueDM } = require('./_db');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return preflight(res);
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return err(res, 'Invalid JSON'); }

  const { userId, messageId, cabinClass, price, name, seatPref } = body;
  if (!userId || !messageId || !name || price == null) return err(res, 'Missing required fields');

  const priceParsed = Number(price);
  if (isNaN(priceParsed) || priceParsed <= 0) return err(res, 'Invalid price');

  try {
    const sb = getSupabase();

    // Find flight
    const flights = await getAllFlights(sb);
    const flight  = flights.find(f => f.messageId === messageId);
    if (!flight) return err(res, 'Flight not found', 404);
    if (['Cancelled','Arrived','Departed'].includes(flight.status))
      return err(res, `Flight cannot be booked (status: ${flight.status})`);

    // Check wallet
    const wallet = await getOrCreateWallet(sb, userId);
    const currentBalance = wallet.balance ?? 0;
    if (currentBalance < priceParsed)
      return err(res, `Insufficient balance — need ₹${priceParsed.toLocaleString()}, you have ₹${currentBalance.toLocaleString()}`, 400);

    // Check duplicate
    const allBookings = await getAllBookings(sb);
    const duplicate   = allBookings.some(b => b.userId === userId && b.messageId === messageId && b.checkedIn !== false);
    if (duplicate) return err(res, 'You already have an active booking on this flight');

    // Deduct wallet
    const newBalance = currentBalance - priceParsed;
    await saveWallet(sb, userId, newBalance);

    // Create booking
    const bookingRef = 'IG' + Date.now().toString(36).toUpperCase();
    const booking = {
      bookingRef, userId, messageId,
      flightNum:    flight.flightNum,
      depAirport:   flight.depAirport,
      arrAirport:   flight.arrAirport,
      depTime:      flight.depTime,
      arrTime:      flight.arrTime,
      aircraft:     flight.aircraft,
      cabinClass:   cabinClass || 'Economy',
      price:        priceParsed,
      name,
      seatPref:     seatPref || 'Any',
      depTimestamp: flight.depTimestamp || null,
      bookedAt:     new Date().toISOString(),
      checkedIn:    null,
    };
    await saveBooking(sb, booking);

    // Queue DM
    const dmText =
      `🎫 **Booking Confirmed!**\n` +
      `> **Flight:** ${flight.flightNum}  ·  ${flight.depAirport} → ${flight.arrAirport}\n` +
      `> **Ref:** \`${bookingRef}\`  ·  **Class:** ${booking.cabinClass}  ·  **Fare:** ₹${priceParsed.toLocaleString()}\n` +
      `> **Wallet balance:** ₹${newBalance.toLocaleString()}\n\n` +
      `📨 Your boarding pass image will arrive shortly.\n` +
      `Use \`/cancelbooking ${bookingRef}\` in Discord to cancel (50% refund).`;
    await queueDM(sb, userId, dmText);

    return ok(res, { success: true, bookingRef, newBalance });
  } catch (e) {
    return err(res, 'Booking failed: ' + e.message, 500);
  }
};
