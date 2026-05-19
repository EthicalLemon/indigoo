/**
 * Shared Supabase helpers — imported by every Vercel API route.
 * Set these in Vercel → Project Settings → Environment Variables:
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

function ok(res, body, code = 200) {
  Object.entries({ ...CORS, 'Content-Type': 'application/json' }).forEach(([k, v]) => res.setHeader(k, v));
  return res.status(code).json(body);
}
function err(res, msg, code = 400) {
  Object.entries({ ...CORS, 'Content-Type': 'application/json' }).forEach(([k, v]) => res.setHeader(k, v));
  return res.status(code).json({ error: msg });
}
function preflight(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  return res.status(204).end();
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
