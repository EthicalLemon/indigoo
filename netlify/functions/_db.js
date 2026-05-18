/**
 * Shared Supabase helpers — imported by every Netlify function.
 * Set these in Netlify → Site configuration → Environment variables:
 *   SUPABASE_URL
 *   SUPABASE_KEY
 *   CLIENT_ID
 *   CLIENT_SECRET
 */
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
}

// ── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function ok(body, code = 200) {
  return { statusCode: code, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function err(msg, code = 400) {
  return { statusCode: code, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) };
}
function preflight() {
  return { statusCode: 204, headers: CORS, body: '' };
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getAllFlights(sb) {
  const { data, error } = await sb.from('flights').select('*');
  if (error) throw new Error(error.message);
  return data.map(r => ({ ...r.data, message_id: r.message_id }));
}

async function getWallet(sb, userId) {
  const { data } = await sb.from('wallets').select('*').eq('user_id', userId).single();
  return data || null;
}

async function saveWallet(sb, userId, balance) {
  await sb.from('wallets').upsert(
    { user_id: userId, balance, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

async function getOrCreateWallet(sb, userId) {
  let w = await getWallet(sb, userId);
  if (!w) {
    await sb.from('wallets').upsert(
      { user_id: userId, balance: 5000, bank: 0, cooldowns: {}, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    w = { user_id: userId, balance: 5000 };
  }
  return w;
}

async function getAllBookings(sb) {
  const { data, error } = await sb.from('bookings').select('*');
  if (error) throw new Error(error.message);
  return data.map(r => r.data);
}

async function getBookingByRef(sb, ref) {
  const { data } = await sb.from('bookings').select('*').eq('booking_ref', ref).single();
  return data ? data.data : null;
}

async function saveBooking(sb, booking) {
  await sb.from('bookings').upsert(
    { booking_ref: booking.bookingRef, data: booking, updated_at: new Date().toISOString() },
    { onConflict: 'booking_ref' }
  );
}

async function queueDM(sb, userId, message) {
  await sb.from('dm_queue').insert({ user_id: userId, message, queued_at: new Date().toISOString(), sent: false });
}

module.exports = { getSupabase, ok, err, preflight, getAllFlights, getWallet, saveWallet, getOrCreateWallet, getAllBookings, getBookingByRef, saveBooking, queueDM };
