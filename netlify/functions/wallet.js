const { getSupabase, ok, err, preflight, getOrCreateWallet, saveWallet } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const sb   = getSupabase();
  // Path will be like /api/wallet/topup or /api/wallet/123456789
  const path = event.path.replace(/.*\/wallet\/?/, '').replace(/^\//, '');

  // POST /api/wallet/topup
  if (event.httpMethod === 'POST' && path === 'topup') {
    try {
      const { userId, amount } = JSON.parse(event.body || '{}');
      if (!userId || !amount || isNaN(Number(amount))) return err('Missing or invalid fields');
      const wallet  = await getOrCreateWallet(sb, userId);
      const newBal  = (wallet.balance ?? 0) + Number(amount);
      await saveWallet(sb, userId, newBal);
      return ok({ userId, balance: newBal });
    } catch (e) {
      return err('Top-up failed: ' + e.message, 500);
    }
  }

  // GET /api/wallet/:userId
  if (event.httpMethod === 'GET' && path) {
    try {
      const wallet = await getOrCreateWallet(sb, path);
      return ok({ userId: path, balance: wallet.balance ?? 0 });
    } catch (e) {
      return err('Failed to read wallet: ' + e.message, 500);
    }
  }

  return err('Not found', 404);
};
