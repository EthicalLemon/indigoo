const { getSupabase, ok, err, preflight, getOrCreateWallet, saveWallet } = require('../_db');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return preflight(res);

  const sb     = getSupabase();
  const { action } = req.query;

  // POST /api/wallet/topup
  if (req.method === 'POST' && action === 'topup') {
    try {
      let body;
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
      catch { return err(res, 'Invalid JSON'); }

      const { userId, amount } = body;
      if (!userId || !amount || isNaN(Number(amount))) return err(res, 'Missing or invalid fields');
      const wallet  = await getOrCreateWallet(sb, userId);
      const newBal  = (wallet.balance ?? 0) + Number(amount);
      await saveWallet(sb, userId, newBal);
      return ok(res, { userId, balance: newBal });
    } catch (e) {
      return err(res, 'Top-up failed: ' + e.message, 500);
    }
  }

  // GET /api/wallet/:userId
  if (req.method === 'GET' && action) {
    try {
      const wallet = await getOrCreateWallet(sb, action);
      return ok(res, { userId: action, balance: wallet.balance ?? 0 });
    } catch (e) {
      return err(res, 'Failed to read wallet: ' + e.message, 500);
    }
  }

  return err(res, 'Not found', 404);
};
