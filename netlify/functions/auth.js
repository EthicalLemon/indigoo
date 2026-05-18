const { getSupabase, ok, err, preflight, getOrCreateWallet } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const CLIENT_ID     = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET)
    return err('SERVER CONFIG: CLIENT_ID and CLIENT_SECRET must be set in Netlify environment variables', 500);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const { code, redirectUri } = body;
  if (!code || !redirectUri) return err('Missing code or redirectUri');

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return err(tokenData.error_description || 'OAuth token exchange failed');

    // Get Discord user
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();
    if (!userRes.ok) return err('Failed to fetch Discord user');

    // Create wallet if new user
    const sb = getSupabase();
    await getOrCreateWallet(sb, user.id);

    console.log(`[Auth] Login: ${user.username} (${user.id})`);

    return ok({
      user: {
        id:         user.id,
        username:   user.username,
        globalName: user.global_name || user.username,
        avatar:     user.avatar,
      },
      accessToken: tokenData.access_token,
    });
  } catch (e) {
    return err('Login failed: ' + e.message, 500);
  }
};
