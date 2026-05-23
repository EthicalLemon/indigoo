
// ════════════════════════════════════════════════════
//  CONFIG — update these before launch
// ════════════════════════════════════════════════════
// ─── UPDATE THESE BEFORE LAUNCH ──────────────────────────────────────────────
// API_BASE: URL of your api-server.js
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                 ? 'http://localhost:3001'
                 : '/api'; // Vercel Serverless Functions (see vercel.json for rewrites)

// DISCORD_CLIENT: your Discord Application ID (from Discord Developer Portal)
const DISCORD_CLIENT = '1472625958769922170';

// REDIRECT_URI: must EXACTLY match one of the Redirect URIs you added in
// Discord Developer Portal → your app → OAuth2 → Redirects
// Common values:
//   Local dev (serve .):   'http://localhost:3000'   or  'http://localhost:5500'
//   Local dev (file://):   won't work — serve with: npx serve .
//   Production:            'https://yourdomain.com'
//
// HOW TO FIND YOURS: open this page, copy the URL bar up to (not including) any ?code=
// Then paste that exact URL in Discord Developer Portal → OAuth2 → Redirects
const REDIRECT_URI = (function() {
  const u = window.location.origin + window.location.pathname;
  // strip trailing slash for consistency
  return u.endsWith('/') ? u.slice(0, -1) : u;
})();
const CABIN_PRICES   = { Economy: 500, 'IndiGo Stretch': 800, 'Economy Plus': 1100, Business: 1800, 'First Class': 3000 };

// ── State ─────────────────────────────────────────
let allFlights      = [];
let filteredFlights = [];
let currentFilter   = 'all';
let currentSort     = 'flight';
let currentUser     = null;
let userBalance     = null;
let activeFlightId  = null;
let selectedCabin   = 'Economy';
let selectedPrice   = 500;
let dropdownOpen    = false;

// ── Airport Database ──────────────────────────────
// Format: ICAO: [full name, city, country]
const AIRPORT_DB = {
  // India
  DEL:['Indira Gandhi International Airport','New Delhi','India'],
  BOM:['Chhatrapati Shivaji Maharaj International Airport','Mumbai','India'],
  HYD:['Rajiv Gandhi International Airport','Hyderabad','India'],
  MAA:['Chennai International Airport','Chennai','India'],
  CCU:['Netaji Subhas Chandra Bose International Airport','Kolkata','India'],
  BLR:['Kempegowda International Airport','Bengaluru','India'],
  GOI:['Goa International Airport','Goa','India'],
  AMD:['Sardar Vallabhbhai Patel International Airport','Ahmedabad','India'],
  PNQ:['Pune Airport','Pune','India'],
  COK:['Cochin International Airport','Kochi','India'],
  JAI:['Jaipur International Airport','Jaipur','India'],
  LKO:['Chaudhary Charan Singh International Airport','Lucknow','India'],
  ATQ:['Sri Guru Ram Dass Jee International Airport','Amritsar','India'],
  IXC:['Chandigarh Airport','Chandigarh','India'],
  PAT:['Jay Prakash Narayan Airport','Patna','India'],
  BBI:['Biju Patnaik International Airport','Bhubaneswar','India'],
  NAG:['Dr. Babasaheb Ambedkar International Airport','Nagpur','India'],
  SXR:['Sheikh ul-Alam International Airport','Srinagar','India'],
  GAU:['Lokpriya Gopinath Bordoloi International Airport','Guwahati','India'],
  IXB:['Bagdogra Airport','Siliguri','India'],
  VTZ:['Visakhapatnam Airport','Visakhapatnam','India'],
  TRV:['Trivandrum International Airport','Thiruvananthapuram','India'],
  IXM:['Madurai Airport','Madurai','India'],
  VGA:['Vijayawada Airport','Vijayawada','India'],
  RPR:['Swami Vivekananda Airport','Raipur','India'],
  BHO:['Raja Bhoj Airport','Bhopal','India'],
  IDR:['Devi Ahilyabai Holkar Airport','Indore','India'],
  UDR:['Maharana Pratap Airport','Udaipur','India'],
  JDH:['Jodhpur Airport','Jodhpur','India'],
  IXJ:['Jammu Airport','Jammu','India'],
  AGR:['Agra Airport','Agra','India'],
  VNS:['Lal Bahadur Shastri Airport','Varanasi','India'],
  GWL:['Gwalior Airport','Gwalior','India'],
  // International
  DXB:['Dubai International Airport','Dubai','UAE'],
  AUH:['Abu Dhabi International Airport','Abu Dhabi','UAE'],
  SIN:['Singapore Changi Airport','Singapore','Singapore'],
  LHR:['Heathrow Airport','London','United Kingdom'],
  JFK:['John F. Kennedy International Airport','New York','USA'],
  LAX:['Los Angeles International Airport','Los Angeles','USA'],
  CDG:['Charles de Gaulle Airport','Paris','France'],
  FRA:['Frankfurt Airport','Frankfurt','Germany'],
  HKG:['Hong Kong International Airport','Hong Kong','China'],
  NRT:['Narita International Airport','Tokyo','Japan'],
  ICN:['Incheon International Airport','Seoul','South Korea'],
  SYD:['Sydney Kingsford Smith Airport','Sydney','Australia'],
  KUL:['Kuala Lumpur International Airport','Kuala Lumpur','Malaysia'],
  BKK:['Suvarnabhumi Airport','Bangkok','Thailand'],
  DOH:['Hamad International Airport','Doha','Qatar'],
  IST:['Istanbul Airport','Istanbul','Turkey'],
  ORD:["O'Hare International Airport",'Chicago','USA'],
  YYZ:['Toronto Pearson International Airport','Toronto','Canada'],
  MEL:['Melbourne Airport','Melbourne','Australia'],
  MUC:['Munich Airport','Munich','Germany'],
  ZRH:['Zürich Airport','Zürich','Switzerland'],
  AMS:['Amsterdam Schiphol Airport','Amsterdam','Netherlands'],
  BCN:['Barcelona–El Prat Airport','Barcelona','Spain'],
  MAD:['Adolfo Suárez Madrid–Barajas Airport','Madrid','Spain'],
};

const cityOf = code => AIRPORT_DB[code] ? AIRPORT_DB[code][1] : (code || '—');
const airportName = code => AIRPORT_DB[code] ? AIRPORT_DB[code][0] : code;

// Get airports that have live flights — pulled from allFlights
function liveAirportCodes() {
  const codes = new Set();
  allFlights.forEach(f => { if(f.depAirport) codes.add(f.depAirport); if(f.arrAirport) codes.add(f.arrAirport); });
  return codes;
}

// Build airport suggestions matching a query string
function getAirportSuggestions(q) {
  q = q.trim().toUpperCase();
  if (!q) {
    // Show live airports first when empty
    const live = liveAirportCodes();
    return [...live].slice(0,8).map(code => ({ code, isLive: true }));
  }
  const ql = q.toLowerCase();
  const live = liveAirportCodes();
  const results = [];
  const seen = new Set();

  // Exact ICAO match first
  for (const [code, info] of Object.entries(AIRPORT_DB)) {
    if (code === q && !seen.has(code)) {
      results.push({ code, isLive: live.has(code) });
      seen.add(code);
    }
  }
  // ICAO starts with
  for (const [code, info] of Object.entries(AIRPORT_DB)) {
    if (code.startsWith(q) && !seen.has(code)) {
      results.push({ code, isLive: live.has(code) });
      seen.add(code);
    }
  }
  // Name or city contains
  for (const [code, info] of Object.entries(AIRPORT_DB)) {
    if (!seen.has(code) && (info[0].toLowerCase().includes(ql) || info[1].toLowerCase().includes(ql) || info[2].toLowerCase().includes(ql))) {
      results.push({ code, isLive: live.has(code) });
      seen.add(code);
    }
  }
  // Also check live airport codes not in DB
  for (const code of live) {
    if (!seen.has(code) && code.includes(q)) {
      results.push({ code, isLive: true });
      seen.add(code);
    }
  }
  // Sort: live flights first
  results.sort((a,b) => (b.isLive?1:0)-(a.isLive?1:0));
  return results.slice(0, 8);
}

function airportSuggest(inputId, ddId) {
  const input = document.getElementById(inputId);
  const dd = document.getElementById(ddId);
  const q = input.value;
  const suggestions = getAirportSuggestions(q);

  // Position the fixed dropdown under the input
  const rect = input.closest('.sf').getBoundingClientRect();
  dd.style.top    = (rect.bottom + 4) + 'px';
  dd.style.left   = rect.left + 'px';
  dd.style.width  = Math.max(rect.width, 280) + 'px';

  if (!suggestions.length) {
    dd.innerHTML = `<div class="apt-dd-empty">No airports found</div>`;
    dd.classList.add('open');
    return;
  }
  dd.innerHTML = suggestions.map(({code, isLive}) => {
    const info = AIRPORT_DB[code];
    const name = info ? info[0] : 'Unknown Airport';
    const city = info ? `${info[1]}, ${info[2]}` : '';
    return `<div class="apt-dd-item" onmousedown="selectAirport('${inputId}','${ddId}','${code}')">
      <span class="apt-dd-code">${code}</span>
      <div class="apt-dd-info">
        <div class="apt-dd-name">${name}</div>
        <div class="apt-dd-city">${city}</div>
      </div>
      ${isLive ? '<span class="apt-dd-live">LIVE</span>' : ''}
    </div>`;
  }).join('');
  dd.classList.add('open');
}

function selectAirport(inputId, ddId, code) {
  document.getElementById(inputId).value = code;
  closeDd(ddId);
}

function closeDd(ddId) {
  const dd = document.getElementById(ddId);
  if (dd) dd.classList.remove('open');
}

// Reposition open dropdowns on scroll or resize so they never drift
function repositionOpenDds() {
  ['s-from', 's-to'].forEach(inputId => {
    const ddId = inputId + '-dd';
    const dd = document.getElementById(ddId);
    if (!dd || !dd.classList.contains('open')) return;
    const input = document.getElementById(inputId);
    const rect = input.closest('.sf').getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + 'px';
    dd.style.left = rect.left + 'px';
    dd.style.width = Math.max(rect.width, 280) + 'px';
  });
}
window.addEventListener('scroll', repositionOpenDds, true);
window.addEventListener('resize', repositionOpenDds);

// ── UTC Clock ──────────────────────────────────────
(function clock(){
  const tick = () => {
    const n = new Date();
    document.getElementById('nav-clock').textContent =
      [n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()]
        .map(x=>String(x).padStart(2,'0')).join(':') + ' UTC';
  };
  tick(); setInterval(tick, 1000);
})();

// ════════════════════════════════════════════════════
//  DISCORD OAUTH
// ════════════════════════════════════════════════════
function startDiscordOAuth() {
  // Debug: log the exact redirect URI being used so you can register it in Discord
  console.log('[IndiGo] OAuth redirect URI:', REDIRECT_URI);
  const state = Math.random().toString(36).slice(2);
  sessionStorage.setItem('oauth_state', state);
  const p = new URLSearchParams({
    client_id: DISCORD_CLIENT, redirect_uri: REDIRECT_URI,
    response_type: 'code', scope: 'identify', state,
  });
  window.location.href = 'https://discord.com/api/oauth2/authorize?' + p.toString();
}

async function handleOAuthCallback() {
  const url    = new URL(window.location.href);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state');
  const stored = sessionStorage.getItem('oauth_state');
  if (!code) return false;

  url.searchParams.delete('code'); url.searchParams.delete('state');
  window.history.replaceState({}, '', url.toString());
  sessionStorage.removeItem('oauth_state');

  if (state !== stored) { toast('OAuth state mismatch — try again', 'error'); return true; }

  toast('Logging you in…', 'info');
  try {
    const res  = await fetch(`${API_BASE}/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: REDIRECT_URI }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    currentUser = { ...data.user, accessToken: data.accessToken };
    localStorage.setItem('ptfs_user', JSON.stringify(currentUser));
    await onLoggedIn(true);
    closeModal();
  } catch (e) {
    toast('Login failed: ' + e.message, 'error');
  }
  return true;
}

function openLoginModal()  { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal()      { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalOutside(e) { if (e.target.id === 'modal-overlay') closeModal(); }

function logout() {
  currentUser = null; userBalance = null;
  localStorage.removeItem('ptfs_user');
  document.body.classList.remove('authed');
  resetBalanceUI();
  document.getElementById('my-guest-state').style.display = 'flex';
  document.getElementById('my-authed-state').style.display = 'none';
  closeProfileDropdown();
  toast('Signed out', 'info');
}

function resetBalanceUI() {
  document.getElementById('nav-balance-small').textContent = '₹—';
  document.getElementById('pd-balance').textContent = '₹—';
  document.getElementById('my-balance').textContent = '₹—';
  document.getElementById('wm-balance').textContent = '₹—';
  Object.values(CABIN_IDS).forEach(id => {
    const el = document.getElementById('wbal-' + id);
    if (el) { el.textContent = '₹—'; el.className = 'cabin-row-wallet-val'; }
  });
}

async function onLoggedIn(showToast) {
  document.body.classList.add('authed');
  const u = currentUser;

  // Nav avatar
  const avatarImg  = document.getElementById('nav-avatar-img');
  const avatarInit = document.getElementById('nav-avatar-init');
  const pdAvatarImg  = document.getElementById('pd-avatar-img');
  const pdAvatarInit = document.getElementById('pd-avatar-init');
  const name = u.globalName || u.username || '?';

  if (u.avatar) {
    const url = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
    avatarImg.src = url; avatarImg.style.display = 'block'; avatarInit.style.display = 'none';
    pdAvatarImg.src = url; pdAvatarImg.style.display = 'block'; pdAvatarInit.style.display = 'none';
  } else {
    const init = name.charAt(0).toUpperCase();
    avatarInit.textContent = init; pdAvatarInit.textContent = init;
  }

  document.getElementById('nav-username').textContent = name;
  document.getElementById('pd-username').textContent  = name;
  document.getElementById('pd-discord-tag').textContent = u.username ? '@' + u.username : '';
  document.getElementById('pd-wallet-name').textContent = name.toUpperCase();
  document.getElementById('wm-username').textContent = name;

  if (showToast) toast(`Welcome, ${name}! 👋`, 'success');
  await fetchWallet();
}

async function fetchWallet() {
  if (!currentUser) return;
  try {
    const res  = await fetch(`${API_BASE}/wallet/${currentUser.id}`);
    const data = await res.json();
    userBalance = data.balance ?? 0;
    const fmt   = `₹${Number(userBalance).toLocaleString('en-IN')}`;
    document.getElementById('nav-balance-small').textContent = fmt;
    document.getElementById('pd-balance').textContent        = fmt;
    document.getElementById('my-balance').textContent        = fmt;
    document.getElementById('wm-balance').textContent        = fmt;
    updateCabinWalletBadges();
  } catch {}
}

// ════════════════════════════════════════════════════
//  PROFILE DROPDOWN
// ════════════════════════════════════════════════════
function toggleProfileDropdown() {
  dropdownOpen = !dropdownOpen;
  document.getElementById('profile-dropdown').classList.toggle('open', dropdownOpen);
  document.getElementById('profile-chip').classList.toggle('open', dropdownOpen);
}
function closeProfileDropdown() {
  dropdownOpen = false;
  document.getElementById('profile-dropdown').classList.remove('open');
  document.getElementById('profile-chip').classList.remove('open');
}
function closeDropdownSwitchTab(tab) {
  closeProfileDropdown();
  const btn = document.querySelector(`.nav-link:nth-child(${tab==='my'?2:1})`);
  if (btn) switchTab(btn, tab);
}
document.addEventListener('click', e => {
  if (dropdownOpen && !e.target.closest('.profile-wrap')) closeProfileDropdown();
});

// ════════════════════════════════════════════════════
//  APPLE WALLET MODAL
// ════════════════════════════════════════════════════
async function openWalletModal() {
  closeProfileDropdown();
  document.getElementById('wallet-modal-overlay').classList.add('open');
  await fetchWallet();
  await loadWalletPasses();
}
function closeWalletModal() {
  document.getElementById('wallet-modal-overlay').classList.remove('open');
}
function closeWalletModalOutside(e) {
  if (e.target.id === 'wallet-modal-overlay') closeWalletModal();
}

async function loadWalletPasses() {
  const list = document.getElementById('wm-passes-list');
  list.innerHTML = '<div class="loading-state" style="padding:20px 0;"><div class="loading-spin">↻</div></div>';

  if (!currentUser) {
    list.innerHTML = '<div class="wm-empty"><div class="wm-empty-icon">🔒</div><div class="wm-empty-text">Login to view passes</div></div>';
    return;
  }

  try {
    const res  = await fetch(`${API_BASE}/bookings/${currentUser.id}`);
    const data = await res.json();
    const bks  = (data.bookings || []).sort((a,b) => new Date(b.bookedAt) - new Date(a.bookedAt));

    // Update stats
    const totalSpent = bks.reduce((s,b) => s + (b.price||0), 0);
    const classCounts = {};
    bks.forEach(b => { classCounts[b.cabinClass] = (classCounts[b.cabinClass]||0)+1; });
    const favClass = Object.entries(classCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
    document.getElementById('wm-total-spent').textContent = `₹${totalSpent.toLocaleString('en-IN')}`;
    document.getElementById('wm-num-trips').textContent   = bks.length;
    document.getElementById('wm-fav-class').textContent   = favClass;

    if (!bks.length) {
      list.innerHTML = '<div class="wm-empty"><div class="wm-empty-icon">🎫</div><div class="wm-empty-text">No passes yet — book a flight!</div></div>';
      return;
    }

    list.innerHTML = bks.map(b => `
      <div class="wm-pass">
        <div class="wm-pass-head">
          <span class="wm-pass-airline">IndiGo PTFS · ${b.flightNum||'—'}</span>
          <span class="wm-pass-ref">${b.bookingRef}</span>
        </div>
        <div class="wm-pass-route">
          <div class="wm-pass-apt">
            <div class="wm-pass-code">${b.depAirport||'—'}</div>
            <div class="wm-pass-city">${cityOf(b.depAirport)}</div>
            <div class="wm-pass-time">${b.depTime||'—'}</div>
          </div>
          <div class="wm-pass-line"><span class="wm-pass-plane">✈</span></div>
          <div class="wm-pass-apt" style="text-align:right">
            <div class="wm-pass-code">${b.arrAirport||'—'}</div>
            <div class="wm-pass-city">${cityOf(b.arrAirport)}</div>
            <div class="wm-pass-time">${b.arrTime||'—'}</div>
          </div>
        </div>
        <div class="wm-pass-footer">
          <span class="wm-pass-class ${b.cabinClass||'Economy'}">${b.cabinClass||'Economy'}</span>
          <span class="wm-pass-date">${new Date(b.bookedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>
          <span class="wm-pass-fare">₹${Number(b.price||0).toLocaleString('en-IN')}</span>
        </div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div class="wm-empty"><div class="wm-empty-text">Could not load passes</div></div>';
  }
}

// ════════════════════════════════════════════════════
//  FLIGHTS — real API with demo fallback
// ════════════════════════════════════════════════════
async function loadFlights() {
  const loadingEl = document.getElementById('loading-state');
  const cardsEl   = document.getElementById('flight-cards');
  const emptyEl   = document.getElementById('empty-state');
  if (loadingEl) loadingEl.style.display = 'flex';
  if (cardsEl)   cardsEl.innerHTML = '';
  if (emptyEl)   emptyEl.style.display = 'none';
  try {
    const res  = await fetch(`${API_BASE}/flights`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('API returned ' + res.status);
    const data = await res.json();
    allFlights = (data.flights || []).filter(f => f && f.flightNum);
  } catch (e) {
    console.warn('[IndiGo] Could not reach API:', e.message);
    allFlights = [];
    if (loadingEl) loadingEl.style.display = 'none';
    if (cardsEl) cardsEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px 20px;color:var(--text3);">
        <div style="font-size:36px;opacity:0.2;">📡</div>
        <div style="font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text4);">API Offline</div>
        <div style="font-size:12px;color:var(--text4);text-align:center;max-width:260px;line-height:1.7;">
          Could not connect to the API server.<br/>Make sure your Netlify functions are deployed.
        </div>
        <button class="btn-refresh-sm" onclick="refreshFlights()" style="margin-top:4px;">Try Again</button>
      </div>`;
    return;
  }
  if (loadingEl) loadingEl.style.display = 'none';
  updateStats(); updateFilterCounts(); applyFilter(currentFilter);
}


async function refreshFlights() {
  const s = document.getElementById('spin-ico');
  if (s) s.style.display = 'inline-block';
  await loadFlights();
  if (s) s.style.display = 'none';
  toast('Flights refreshed', 'success');
}

// ── Stats ──────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-active').textContent    = allFlights.filter(f=>!['Cancelled','Arrived','Departed'].includes(f.status)).length;
  document.getElementById('stat-ontime').textContent    = allFlights.filter(f=>['Scheduled','Boarding'].includes(f.status)).length;
  document.getElementById('stat-delayed').textContent   = allFlights.filter(f=>['Delayed','Rescheduled'].includes(f.status)).length;
  document.getElementById('stat-cancelled').textContent = allFlights.filter(f=>f.status==='Cancelled').length;
  document.getElementById('stat-ended').textContent     = allFlights.filter(f=>['Arrived','Departed'].includes(f.status)).length;
}
function updateFilterCounts() {
  document.getElementById('fc-all').textContent      = allFlights.length;
  document.getElementById('fc-ontime').textContent   = allFlights.filter(f=>f.status==='Scheduled').length;
  document.getElementById('fc-boarding').textContent = allFlights.filter(f=>f.status==='Boarding').length;
  document.getElementById('fc-delayed').textContent  = allFlights.filter(f=>['Delayed','Rescheduled'].includes(f.status)).length;
  document.getElementById('fc-can').textContent      = allFlights.filter(f=>f.status==='Cancelled').length;
  document.getElementById('fc-ended').textContent    = allFlights.filter(f=>['Arrived','Departed'].includes(f.status)).length;
}

// ── Filter / Sort / Search ─────────────────────────
function filterFlights(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-option').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter(filter);
}
function applyFilter(filter) {
  const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
  let list = [...allFlights];
  if (filter==='on-time')   list = list.filter(f=>f.status==='Scheduled');
  if (filter==='boarding')  list = list.filter(f=>f.status==='Boarding');
  if (filter==='delayed')   list = list.filter(f=>['Delayed','Rescheduled'].includes(f.status));
  if (filter==='cancelled') list = list.filter(f=>f.status==='Cancelled');
  if (filter==='ended')     list = list.filter(f=>['Arrived','Departed'].includes(f.status));
  if (q) list = list.filter(f =>
    (f.flightNum||'').toLowerCase().includes(q)||
    (f.depAirport||'').toLowerCase().includes(q)||
    (f.arrAirport||'').toLowerCase().includes(q)||
    cityOf(f.depAirport).toLowerCase().includes(q)||
    cityOf(f.arrAirport).toLowerCase().includes(q)||
    airportName(f.depAirport).toLowerCase().includes(q)||
    airportName(f.arrAirport).toLowerCase().includes(q)||
    (f.aircraft||'').toLowerCase().includes(q)||
    (f.status||'').toLowerCase().includes(q)
  );
  filteredFlights = list;
  doSort();
}
function applySearch() { applyFilter(currentFilter); }
function applySort(col) { if(col) currentSort=col; doSort(); }
function doSort() {
  const key = {flight:'flightNum',dep:'depTime',route:'depAirport',status:'status'}[currentSort]||'flightNum';
  const sorted = [...filteredFlights].sort((a,b)=>(a[key]||'').toString().localeCompare((b[key]||'').toString()));
  renderCards(sorted);
}

// ── Render Cards ──────────────────────────────────
function bookable(f) { return ['Scheduled','Boarding'].includes(f.status); }
function alertBadge(f) {
  if (f.status==='Delayed')     return `<span class="alert-flag delayed"><span class="alert-dot-sm"></span>Delayed</span>`;
  if (f.status==='Rescheduled') return `<span class="alert-flag rescheduled"><span class="alert-dot-sm"></span>Rescheduled</span>`;
  if (f.status==='Cancelled')   return `<span class="alert-flag cancelled"><span class="alert-dot-sm"></span>Cancelled</span>`;
  return '';
}
function durationBetween(dep, arr) {
  try {
    if (!dep || !arr || dep === '—' || arr === '—') return '—';
    const parse = t => { const[h,m]=t.replace(/[^0-9:]/g,'').split(':').map(Number); return h*60+(m||0); };
    const d=parse(dep), a=parse(arr);
    if (isNaN(d) || isNaN(a)) return '—';
    const diff = a > d ? a - d : a + 1440 - d;
    if (diff === 0 || diff === 1440) return '—';
    return `${Math.floor(diff/60)}h ${diff%60}m`;
  } catch { return '—'; }
}

function renderCards(flights) {
  const wrap  = document.getElementById('flight-cards');
  const empty = document.getElementById('empty-state');
  document.getElementById('result-sub').textContent = `${flights.length} flight${flights.length!==1?'s':''} found`;
  if (!flights.length) { wrap.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display = 'none';
  wrap.innerHTML = flights.map((f,i) => {
    const fid = f.messageId || f.message_id || '';
    return `
    <div class="flight-card${activeFlightId===fid?' selected':''}" onclick="openPanel('${fid}')" style="animation-delay:${i*0.03}s">
      <div class="card-top">
        <div class="airline-logo">✈</div>
        <div class="route-block">
          <div class="apt-col">
            <div class="apt-code">${f.depAirport||'—'}</div>
            <div class="apt-city">${cityOf(f.depAirport)}</div>
            <div class="apt-time">${f.depTime||'—'}</div>
          </div>
          <div class="route-line">
            <div class="route-line-track"></div>
            <div class="route-duration">${durationBetween(f.depTime,f.arrTime)}</div>
          </div>
          <div class="apt-col">
            <div class="apt-code">${f.arrAirport||'—'}</div>
            <div class="apt-city">${cityOf(f.arrAirport)}</div>
            <div class="apt-time">${f.arrTime||'—'}</div>
          </div>
        </div>
        <div class="card-meta">
          <div class="flight-num">${f.flightNum||'—'}</div>
          <span class="status-badge ${f.status||''}">${f.status||'—'}</span>
        </div>
      </div>
      <div class="card-divider"></div>
      <div class="card-bottom">
        <div class="card-bot-left">
          ${f.aircraft&&f.aircraft!=='TBA'?`<span class="aircraft-chip">🛫 ${f.aircraft}</span>`:''}
          ${f.depGate&&f.depGate!=='—'&&f.depGate!=='TBA'?`<span class="gate-chip">Gate <span class="gate-pill">${f.depGate}</span></span>`:''}
        </div>
        <div class="card-bot-right">
          ${alertBadge(f)}
          <button class="btn-book" onclick="event.stopPropagation();quickBook('${fid}')" ${bookable(f)?'':'disabled'}>
            ${bookable(f)?'Book Seat':'Unavailable'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function quickBook(id) {
  if (!currentUser) { openLoginModal(); return; }
  openPanel(id);
}

// ── Booking Confirm Modal ──────────────────────────
let bcmSeatPref = 'Window';

function openBookingConfirm() {
  if (!currentUser) { openLoginModal(); return; }
  const f = allFlights.find(x=>x.messageId===activeFlightId);
  if (!f || !bookable(f)) { toast('Flight is not bookable', 'error'); return; }
  if (userBalance !== null && userBalance < selectedPrice) {
    toast(`Insufficient balance — need ₹${selectedPrice.toLocaleString('en-IN')}, have ₹${userBalance.toLocaleString('en-IN')}`, 'error');
    return;
  }
  // Pre-fill with Discord name
  const discordInput = document.getElementById('bcm-discord');
  if (currentUser && (currentUser.username || currentUser.globalName)) {
    discordInput.value = currentUser.username || currentUser.globalName || '';
  }
  // Populate mini ticket
  document.getElementById('bcm-dep').textContent = f.depAirport || '—';
  document.getElementById('bcm-arr').textContent = f.arrAirport || '—';
  document.getElementById('bcm-fnum').textContent = f.flightNum || '—';
  document.getElementById('bcm-class-badge').textContent = selectedCabin;
  document.getElementById('bcm-price-display').textContent = `₹${selectedPrice.toLocaleString('en-IN')}`;
  document.getElementById('bcm-title').textContent = `Booking ${f.flightNum || 'Flight'}`;
  document.getElementById('bcm-sub').textContent = `${cityOf(f.depAirport)} → ${cityOf(f.arrAirport)} · ${selectedCabin}`;
  // Reset errors
  ['bcm-discord','bcm-roblox'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
  document.getElementById('bcm-discord-err').classList.remove('show');
  document.getElementById('bcm-roblox-err').classList.remove('show');
  // Reset seat pref
  bcmSeatPref = 'Window';
  document.querySelectorAll('.bcm-seat-opt').forEach(o=>o.classList.remove('selected'));
  document.querySelector('.bcm-seat-opt').classList.add('selected');
  // Reset button
  const btn = document.getElementById('bcm-confirm-btn');
  btn.disabled = false;
  document.getElementById('bcm-btn-text').textContent = 'Confirm Booking';
  document.getElementById('bcm-btn-icon').textContent = '🎫';

  document.getElementById('booking-confirm-overlay').classList.add('open');
}
function closeBookingConfirm() {
  document.getElementById('booking-confirm-overlay').classList.remove('open');
}
function closeBookingConfirmOutside(e) {
  if (e.target.id === 'booking-confirm-overlay') closeBookingConfirm();
}
function selectSeatPref(el, pref) {
  document.querySelectorAll('.bcm-seat-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  bcmSeatPref = pref;
}

async function submitBookingConfirm() {
  const discordVal = document.getElementById('bcm-discord').value.trim();
  const robloxVal  = document.getElementById('bcm-roblox').value.trim();
  let valid = true;
  if (!discordVal) {
    document.getElementById('bcm-discord').classList.add('error');
    document.getElementById('bcm-discord-err').classList.add('show');
    valid = false;
  } else {
    document.getElementById('bcm-discord').classList.remove('error');
    document.getElementById('bcm-discord-err').classList.remove('show');
  }
  if (!robloxVal) {
    document.getElementById('bcm-roblox').classList.add('error');
    document.getElementById('bcm-roblox-err').classList.add('show');
    valid = false;
  } else {
    document.getElementById('bcm-roblox').classList.remove('error');
    document.getElementById('bcm-roblox-err').classList.remove('show');
  }
  if (!valid) return;

  const btn = document.getElementById('bcm-confirm-btn');
  btn.disabled = true;
  document.getElementById('bcm-btn-icon').innerHTML = '<span class="bcm-loading">↻</span>';
  document.getElementById('bcm-btn-text').textContent = 'Processing…';

  const f = allFlights.find(x=>x.messageId===activeFlightId);
  if (!currentUser || !f) { closeBookingConfirm(); return; }

  try {
    const res  = await fetch(`${API_BASE}/book`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        messageId: f.messageId || f.message_id,
        cabinClass: selectedCabin, price: selectedPrice,
        name: discordVal,
        robloxUsername: robloxVal,
        seatPref: bcmSeatPref,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed');

    userBalance = data.newBalance;
    const fmt = `₹${Number(userBalance).toLocaleString('en-IN')}`;
    document.getElementById('nav-balance-small').textContent      = fmt;
    document.getElementById('pd-balance').textContent             = fmt;
    document.getElementById('my-balance').textContent             = fmt;
    document.getElementById('wm-balance').textContent             = fmt;
    updateCabinWalletBadges();

    closeBookingConfirm();
    closePanel();
    toast(`🎫 Booked! Ref: ${data.bookingRef} — Boarding pass sent to Discord DMs`, 'success');
    if (document.getElementById('tab-my').classList.contains('active')) loadMyBookings();
  } catch (e) {
    toast('Booking failed: ' + e.message, 'error');
    btn.disabled = false;
    document.getElementById('bcm-btn-icon').textContent = '🎫';
    document.getElementById('bcm-btn-text').textContent = 'Confirm Booking';
  }
}

// ── Cancel Booking (from My Bookings tab) ──────────
async function cancelBooking(bookingRef) {
  if (!currentUser) return;
  if (!confirm(`Cancel booking ${bookingRef}? You will receive a 50% refund.`)) return;
  try {
    const res  = await fetch(`${API_BASE}/checkin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingRef, confirmed: false }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Cancel failed');
    toast(`✅ Booking ${bookingRef} cancelled. ₹${Number(data.refund||0).toLocaleString('en-IN')} refunded.`, 'success');
    userBalance = data.newBalance;
    const fmt = `₹${Number(userBalance).toLocaleString('en-IN')}`;
    document.getElementById('nav-balance-small').textContent = fmt;
    document.getElementById('pd-balance').textContent        = fmt;
    document.getElementById('my-balance').textContent        = fmt;
    document.getElementById('wm-balance').textContent        = fmt;
    loadMyBookings();
  } catch (e) {
    toast('Cancel failed: ' + e.message, 'error');
  }
}

// ── Book flight (panel button → opens confirm modal) ──
async function bookCurrentFlight() {
  openBookingConfirm();
}

// ── Cabin accordion ────────────────────────────────
const CABIN_IDS = {
  'Economy':'Economy',
  'IndiGo Stretch':'IndiGoStretch',
  'Economy Plus':'EconomyPlus',
  'Business':'Business',
  'First Class':'FirstClass'
};

function toggleCabin(name, price, rowEl) {
  const isOpen = rowEl.classList.contains('open');
  // Close all
  document.querySelectorAll('.cabin-row').forEach(r => r.classList.remove('open'));
  if (!isOpen) {
    rowEl.classList.add('open');
    selectedCabin = name;
    selectedPrice = price;
    updateCabinWalletBadges();
  } else {
    // Clicking open row collapses, reset to economy
    selectedCabin = 'Economy';
    selectedPrice = 500;
  }
}

function updateCabinWalletBadges() {
  if (userBalance === null) return;
  const fmt = `₹${Number(userBalance).toLocaleString('en-IN')}`;
  Object.entries(CABIN_IDS).forEach(([name, id]) => {
    const price = CABIN_PRICES[name] || 0;
    const el = document.getElementById('wbal-' + id);
    if (el) {
      el.textContent = fmt;
      el.className = 'cabin-row-wallet-val' + (userBalance < price ? ' low' : '');
    }
  });
}

function bookCabin(name, price) {
  selectedCabin = name;
  selectedPrice = price;
  openBookingConfirm();
}

// ── Panel ──────────────────────────────────────────
function openPanel(id) {
  const f = allFlights.find(x=>(x.messageId===id)||(x.message_id===id));
  if (!f) return;
  activeFlightId = f.messageId || f.message_id;
  document.querySelectorAll('.flight-card').forEach(c=>c.classList.remove('selected'));
  document.querySelectorAll(`.flight-card`).forEach(c=>{
    if (c.getAttribute('onclick')?.includes(id)) c.classList.add('selected');
  });

  document.getElementById('panel-fnum').textContent   = f.flightNum || '—';
  document.getElementById('panel-froute').textContent = `${cityOf(f.depAirport)} → ${cityOf(f.arrAirport)}`;
  document.getElementById('panel-badge').innerHTML    = `<span class="status-badge ${f.status||''}">${f.status||'—'}</span>`;
  document.getElementById('panel-msgid').textContent  = `ID: ${f.messageId}`;
  document.getElementById('panel-notes').textContent  = f.notes || 'No remarks.';
  document.getElementById('panel-grid').innerHTML = `
    <div class="panel-cell"><div class="pc-label">Dep Time</div><div class="pc-val">${f.depTime||'—'}</div></div>
    <div class="panel-cell"><div class="pc-label">Arr Time</div><div class="pc-val">${f.arrTime||'—'}</div></div>
    <div class="panel-cell"><div class="pc-label">Dep Gate</div><div class="pc-val">${f.depGate&&f.depGate!=='TBA'?f.depGate:'—'}</div></div>
    <div class="panel-cell"><div class="pc-label">Arr Gate</div><div class="pc-val">${f.arrGate&&f.arrGate!=='TBA'?f.arrGate:'—'}</div></div>
    <div class="panel-cell"><div class="pc-label">Aircraft</div><div class="pc-val">${f.aircraft||'—'}</div></div>
    <div class="panel-cell"><div class="pc-label">Duration</div><div class="pc-val">${durationBetween(f.depTime,f.arrTime)||'—'}</div></div>
  `;

  const canBook = bookable(f);
  // Update book buttons in accordion based on bookability
  document.querySelectorAll('.btn-cabin-book').forEach(btn => {
    btn.disabled = !canBook;
  });
  document.getElementById('panel-book-note').textContent = canBook
    ? ''
    : `This flight cannot be booked (status: ${f.status}).`;
  // Reset accordion to Economy open, update wallet badges
  document.querySelectorAll('.cabin-row').forEach(r => r.classList.remove('open'));
  const econRow = document.getElementById('cabin-Economy');
  if (econRow) econRow.classList.add('open');
  selectedCabin = 'Economy'; selectedPrice = 500;
  updateCabinWalletBadges();
  document.getElementById('panel-overlay').classList.add('open');
}
function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  activeFlightId = null;
  document.querySelectorAll('.flight-card').forEach(c=>c.classList.remove('selected'));
}
function closePanelOutside(e) { if(e.target.id==='panel-overlay') closePanel(); }

// ── My Bookings tab ────────────────────────────────
async function loadMyBookings() {
  if (!currentUser) return;
  document.getElementById('my-guest-state').style.display  = 'none';
  document.getElementById('my-authed-state').style.display = 'flex';
  document.getElementById('bk-loading').style.display  = 'flex';
  document.getElementById('bk-empty').style.display    = 'none';
  document.getElementById('bookings-list').innerHTML   = '';
  await fetchWallet();
  try {
    const res  = await fetch(`${API_BASE}/bookings/${currentUser.id}`);
    const data = await res.json();
    const bks  = (data.bookings||[]).sort((a,b)=>new Date(b.bookedAt)-new Date(a.bookedAt));
    document.getElementById('bk-loading').style.display = 'none';
    document.getElementById('bk-sub').textContent = `${bks.length} booking${bks.length!==1?'s':''}`;
    if (!bks.length) { document.getElementById('bk-empty').style.display='flex'; return; }
    document.getElementById('bookings-list').innerHTML = bks.map((b,i)=>{
      const isCancelled = b.checkedIn === false;
      const isCheckedIn = b.checkedIn === true;
      const isPending   = b.checkedIn === null || b.checkedIn === undefined;
      const statusIcon  = isCheckedIn ? '✅' : isCancelled ? '❌' : '⏳';
      const statusLabel = isCheckedIn ? 'Checked In' : isCancelled ? 'Cancelled' : 'Pending';
      const statusColor = isCheckedIn ? 'var(--green)' : isCancelled ? 'var(--red)' : 'var(--amber)';
      const cardOpacity = isCancelled ? 'opacity:0.55;' : '';
      const flightStatusBadge = b.flightStatus ? `<span class="status-badge ${b.flightStatus}" style="font-size:8px;">${b.flightStatus}</span>` : '';
      return `
      <div class="booking-card" style="animation-delay:${i*0.04}s;${cardOpacity}${isCancelled?'border-color:rgba(255,77,77,0.2);':''}">
        <div class="bk-head">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="bk-ref">${b.bookingRef}</span>
            <span style="font-size:9px;font-weight:700;color:${statusColor};background:${statusColor}18;border:1px solid ${statusColor}33;padding:1px 7px;border-radius:3px;letter-spacing:0.06em;">${statusIcon} ${statusLabel}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${flightStatusBadge}
            <span class="bk-status">${b.flightNum||'—'} · ${new Date(b.bookedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
          </div>
        </div>
        <div class="bk-body">
          <div class="bk-route">
            <div class="bk-airports">${b.depAirport||'—'} → ${b.arrAirport||'—'}</div>
            <div class="bk-times">${b.depTime||''} → ${b.arrTime||''} · ${b.aircraft||''}</div>
          </div>
          <div class="bk-meta">
            <span class="bk-class-pill ${b.cabinClass||'Economy'}">${b.cabinClass||'Economy'}</span>
            <span class="bk-fare">₹${Number(b.price||0).toLocaleString('en-IN')}</span>
            ${isPending ? `<button onclick="cancelBooking('${b.bookingRef}')" style="font-size:9px;font-weight:700;color:var(--red);background:var(--red-bg);border:1px solid rgba(255,77,77,0.2);padding:2px 9px;border-radius:3px;cursor:pointer;font-family:var(--font);transition:all 0.12s;" onmouseover="this.style.background='var(--red)';this.style.color='#fff'" onmouseout="this.style.background='var(--red-bg)';this.style.color='var(--red)'">✕ Cancel</button>` : `<span class="bk-date">Ref: ${b.bookingRef}</span>`}
          </div>
        </div>
        ${isCancelled ? `<div style="padding:6px 14px 8px;font-size:10px;color:var(--red);font-family:var(--mono);">Cancelled · 50% refunded to wallet</div>` : ''}
      </div>`;
    }).join('');
  } catch {
    document.getElementById('bk-loading').style.display = 'none';
    toast('Could not load bookings', 'error');
  }
}

// ── Hero search ────────────────────────────────────
function swapAirports() {
  const f=document.getElementById('s-from'), t=document.getElementById('s-to');
  [f.value, t.value] = [t.value, f.value];
}
function doSearch() {
  const from = document.getElementById('s-from').value.trim().toUpperCase();
  const to   = document.getElementById('s-to').value.trim().toUpperCase();
  // Extract ICAO codes — user may have typed full name, find best match
  const fromCode = resolveToIcao(from);
  const toCode   = resolveToIcao(to);
  // Set search input to trigger filter
  const q = [fromCode, toCode].filter(Boolean).join(' ');
  document.getElementById('search-input').value = q;
  applySearch();
  if (fromCode || toCode) toast(`Searching: ${fromCode||'any'} → ${toCode||'any'}`, 'info');
}

function resolveToIcao(q) {
  if (!q) return '';
  // Already a 3-letter ICAO code
  if (/^[A-Z]{3}$/.test(q) && AIRPORT_DB[q]) return q;
  if (/^[A-Z]{3}$/.test(q)) return q; // pass through unknown codes
  // Try matching by name or city
  const ql = q.toLowerCase();
  for (const [code, info] of Object.entries(AIRPORT_DB)) {
    if (info[0].toLowerCase().includes(ql) || info[1].toLowerCase().includes(ql)) return code;
  }
  return q;
}

// ── Tab switch ─────────────────────────────────────
function switchTab(btn, tab) {
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  if (tab==='my') {
    if (currentUser) loadMyBookings();
    else {
      document.getElementById('my-guest-state').style.display='flex';
      document.getElementById('my-authed-state').style.display='none';
    }
  }
}

// ── Toast ──────────────────────────────────────────
function toast(msg, type='info') {
  const wrap = document.getElementById('toast-wrap');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  const colors = {success:'var(--green)',error:'var(--red)',info:'var(--indigo)'};
  const icons  = {success:'✓',error:'✕',info:'ℹ'};
  el.innerHTML = `<span style="color:${colors[type]||colors.info};font-size:14px;">${icons[type]||icons.info}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(()=>el.remove(),300); }, 4500);
}

// ── Init ───────────────────────────────────────────
(async function init() {
  const wasCallback = await handleOAuthCallback();
  if (!wasCallback) {
    try {
      const u = localStorage.getItem('ptfs_user');
      if (u) { currentUser = JSON.parse(u); await onLoggedIn(false); }
    } catch {}
  }
  loadFlights();
})();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePanel(); closeModal(); closeWalletModal(); closeProfileDropdown(); closeBookingConfirm(); }
});



(function() {
'use strict';

// ── Audio Engine ──
const AC = window.AudioContext || window.webkitAudioContext;
let ctx = null;
let clickBuffers = [];

// Real click samples extracted from video (music-free)
const CLICK_B64 = [
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAGAAALnQBOTk5OTk5OTk5OTk5OTk5OcnJycnJycnJycnJycnJycnKxsbGxsbGxsbGxsbGxsbGx1dXV1dXV1dXV1dXV1dXV1dX09PT09PT09PT09PT09PT09P////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAQUAAAAAAAAC52sLFCPAAAAAAD/+8DEAAAMoANntBAAKtKaKT828AgNJyR222227j8AAEAeHh4eGGYAAAHh4eHhgAAAAAHh4eHhgAAO9/h4eGAAAACA8PP6kAHfoPDw8PDAAAABAeHh4ekAAB3h4//wAAAAAA8PDw8MAAAAEB4eHh6QAAAD2w8PfqAACAEFYRc0YkwkYZjvt5oHAgDVwpTI18DXIfynmMkBg4wFiEZKQcJCMiCBdDm/phY0u0rB0UEwEaCMC5icKUpjRJaIkA8j5wTZYQkzCdHkwOy+HogU+fS5mLyhLMzEiNI0FUzQCqLg31VR+lxYWJRMindLTzSodpAmst25StqperpjbFN1zEinNCmQ2sBqY29DcRowKhJ5hcs6+1o6dtCUklV8UETTpYkEixL+hnm3nS07///+7PoQFmSEU3dVZmbW3zf/a2JoHtwaOOiGBxY7qIxYQ4xYFRxqiYgEYAZCwUqAgoxxVaoFIOypviXdR1bKmYkQme8DBhC1MFYRFEvemovdujEFYInGG/ZqyGNOewK07jrQxArttXgaJS683sVnLDSExGSQp/E/IKWQtytDlqeaTFqa06kXsW4xZrts/FWUUcooY412JdjUzckENwPJn3fucp8+U8lh6BuX9bx1OTUppMdb7n+6+eNenuv//O193t3oFmpr89fvHf3+2cy978w1bToBEQoImL6gAABzI8pI6rbI40gAABO2LVQKvM2TNcvOGFMMKkIctEgpM5YgsOrQZWaBBZMDfxf6YK1lAG2ZbDYVkGTwbKy6aWs6LcW0h+VuAyt1l2NrGnYvozvWtpalI9LCG6a5CwKt3moafWA4FjdmheeNxmisdlEJgevU3EncpLFb+fhzH895zUl3Zvw59zGku2u2rO+3O63/eSztzVYhQrvo5kwj//mWLmZT//9F3/ljgfoEkL5s0ngqoZaehUVnMRgE4QuMoZggAR7NkFAc8kVAqwwYFZiZ+HGEkP/7kMTWABqxQUv5rAACtB6ntzWAABYBjJAwHBxeksAqXKepcLF62CwwhAimYoKEpYVQdf691HVvvhHF0M3a4uRKmq+jSo6uRQB40kC/k9T5RxGi7hyAnflKu2kMQOV0FP9uwvBw5hq1qRKyNcbHDBoiv9YRMR9NMexTRq3TPi3TC3R6xm50wUTLBRzhtVSEpqP5IGvNtD2dNRSm1bobGufQX8s4mzCElxFNJBEFMFcLCQL9a7TT9JjTV7ueFyVv1nnT4W89z8CNwWozduClil9/5ZDD8KaqFfvPv6/X/vW9yjvO/27zn//7tZg4Q7UwcGycFAO7Tf/////////////1tf/8//////////////+W3PPWdz783InHejeE+AItVrbDhGzYZPNBsY0mgjOaWP5o1GHd2UZtJJwthGrlkbYcR2IHGHQwYkIxkIOGNRaYLGhjwtiEQYNMMww5DLwSgEgS8GlkIQBCAsQSsGQiv0N0uB4cCnoMDr6BooaIjgZrI6Jam1CkU2QCIOxFwJO04YBcnMWBrUc/SKCexaFyIrERYP/7wMTagCTiD235vLANncLq/zmgCEqxDk/7eiyUyJtS0BCg4cn+X+euqn01RdSljDHtjaFago6DgV50UEZ3LRMm18hwWAlTrHS9vPqw5x1J7TEi1Mriuzd3WgtRchapUAO/fbtS08mWGfaZEQORs5a1AOMcc9rZaBXDs1n0oYAvwt2ElA4AGEaeA3ctvMoe8akmUwzViFTtvGqxNY9KoK9KNcBQDNap4cgmJy1csEtZdNhCw7jzTXZp+W9gld8uZLBav4Cl+NuOS2k//////////////lupi9p/4H//////////////l8Zh6VRNvV5ViR92t4oxgzd0yyKoDZoEIM4FyEIIrhp4YGF0jijc1hoAI2YUIgALFSBL4xQKCogYWNg4XByqCCAAKxiVJfaBgE85jQKJQLABywcx3kq1NFcOzHxZoOSnqx9ASqQQmdqLuA1xPBo8egaAWwq9amxlIlhzGpG20kls0+7vMCdaUxF/X/qR+57XmD2YtIGnwEvSOUsqn6a1AL7Rygs361M6k3bl+faep6qMoaVLae27VNAtDLa3zb4yy1WZZEYLaHFYOfiMQBGKGM0tByem7Mohu3LY5FJZIpfS2YvJYxAFyJ03yqMcuw3G7UQlnL1bCmtuVEcIzhapqOW2b9JR26F9JiW/Z5jymfyBP/P89a//////////////5jqt+q//////////////8sqUlJThFNT2zoYCUonIyl+zxDd6GGiEqvV+l/2Tv8qWVNaZ7Sw5FwMKgDgis4Fm0dOecp42nlktry8VstKrwJmTUTwMDsiBAMZEjTpG06NEK0NBUJKmVlgaqiUkdCYFDTQmMA1JY7DUJPrG//WSFgaPKktf/GAnUU0mNifVGh+m5MnR9bo2VsLQEhnjabL6tyARGBSOGjBZzRYYP5NFpblDlya1Gjjpo41smHNa9eNfWtqaxVLVplG2n15q5i1gYPNh6aa+//uQxPYAJY4TZ/m8AEmvD+0/sGAALprj+//j+a9v+teVbXWL//66KDLixKViICv/iJQNHkgCKipDsyvDOy7Z1BIBAAAHlbESAYEiwU2yc9ggxxtOMGB0cQNvV8WhUsSVLUNaQZJUR2HbHoQRBsHECEAx3hqwTcLmBYoE0Bi4kR1idhSRQE8GBfDwkXD2QtPHJJw+ThgVB1j0RM0DME+I2AcIO6pA6esXxzyfNyJmhYJQQUFaASMFim3rN1IImaaYXMDOCwD4FKhhf/vvZsPXIkLkJMmjUdhiRP/+7/aoplAQkHAsnCHkHL/////9aygdRL5PmicwNC4UkP////TT1v///4lAMZjjJ8kS8jVIBoCnCQB4BQDAEBgIBAAAMeA3ZJeBNimyOAMoorcNkC98DCCogtqleayaEV/xPikTQ2g3v/MTI2OCeiY//kREkTVMT0eH/+HJExHqkdQRUl//+sxZToIskj///9JcyrR62SJx/////8T0vJkm1UxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uAxO+ADlVFVbWEACNfQua/NTAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+yDE9gANqZ9B+SaACAAANIOAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAGAAAOXwBGRkZGRkZGRkZGRkZGRkZGeXl5eXl5eXl5eXl5eXl5eXmdnZ2dnZ2dnZ2dnZ2dnZ2dwsLCwsLCwsLCwsLCwsLCwsLt7e3t7e3t7e3t7e3t7e3t7f////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAOQAAAAAAAADl9me/XVAAAAAAD/+9DEAAAC6AEnlAAALK7Caz83tEEogsRieAAAefgACQ/8AAP//Ax//sAAACZNtmOhrV6NrXfOBUCAUCBxxIOMYSzmWmqYcVw2LA5grIYNKGXg7cUQIFNNh0yDEgSxqjMbUTQxLqwNqR2DPiA583MqUoHZFDG5fUojWBZKEQjxnQgqBXbtF5cK+cvqGWCxfhiAUEDFABdre0KQwBC+WZqHIpnE4GLONHMsHgESU3sTlKRjk/z/yxp4FMbB0pEkC85dIxgKhrGNbkrwP7b1////5hISYmHiQGzt38mDu277NaCXZTeU9y//97///e/DbdEfHTLltDLiF3C6C16bupY/MOXasqxncP/////////4o1hTBkj3yB/0NH4ikOQWy9VQYAa9eVwP2J7q93Q1IcdxOfljf////////////////q7ZpDc/lh//////////////7IHRp6CZKmlL6r3Hl3dmdZ40FAqXAEBGDDFTsCgXOLwMAiE348jeZEMcF011FTSxCNajgrUoQfguXRAETQxpNHhoxaGjHGxRcIiRoYRua7ARYeTAASOEYcDDmqEoxF4GH0ErdjOuhgiYQGNNzPiB66YMKiAIlQlIVa1OSJEmjRQ6/ZeEwIELqy+qv1cgA0UNAcNC4QBJgqxAX8KlC10fCw4xAEzqAqAQADRxMfRJAQWblzngZei29DPkOAcKC4ZmT1vuylh7XGbq4kCe7uqDIFPUUBIhHKElBs1dWNo9mAAsCelnKM0dZG4CNSmzcSUM06hR/X3C4YZEukzQmIMIY+j4jmpoyJ2YFSPQzWKsckNuaylMdZFleSGKRAKJrDigVtXkgZpdhmcZmYfcV84Gv4ZWb6pVkOArG2BkNE4z/95hXwVTUEdJS4dDvy0aiZPFYAnYDa3ekTMEqhoGm5GoHgV2Xv//////////////opdnA1eUS//////////////8tE8ilCpHxDhAQEZ8qHm52FWVWJFYCVZUDQjFAE4c1YSLAbLDeFo3RSMZBSYRFAEygkCosp2BBEwEFARGZcVmiiA2OHvKXtZNUgQT0SIacCVbEFihq5yiHkQo2t1gcua+tRdL+nm+coYyyAl8f08FBGIq//vAxPWAMHIXU/nNAETuwux/N5IA5bOnkcJW1sghAKo8PooLBu2oK0C+/0k+rKGMF7l9tMbs89qHnIaTAjl0TJGmQ00yHIqydK1FFSpbebyprSV+aSU0kTuXaKX09uH88cc8AxpAkkc3KLUigrcmF/TxeJsSY/TXb09SxSbuPy5UWzllJSX2cxR336cx+3vYAzNTVypiGYjn9JnTWty+vSalkfqzNukpbcopKeVTlWtfjLcYg46okmIHYM1l/ICaW4kajGp+1rjtWP///////////////u89///////////////njqmps5RViGh5qKNacnZG2rlcqeB0Peg5UbRimwSHFmzUYD5Z4CLFUsw9gIgE4mY8AAhAUctSTisTPAYCYoIoutdQ8LDN3WJFQDEFyBRRkb3FQB3k53kYm1NDxt3VQAvPAT/K2QVBbN3hY8mHSQ6uVpDXJTW1azclntJLsW7v7FL8snKRlEkdyas08212/YpZLUhqXOQy+3cjc9NNJeXKpKolTxqe7jGcMqal/PVykmoYlmWMdqcu43n1v38r83dpbNzuevlV2xSbkUUwn5Zhaq0NLYyemKQK72r9jGvI6WB5re8atLz/zzpZJAMsjdFQw/GL9uc+vSzN29u3hhzPf//////////////9yq/rtz/7YdnhzlgCAAkRnaXClQEAgA4amyk0YClBnVMgEzG+26atYRlJVmQCobjNZpIFgp0mNAmZCN5jFJmJh4ZSIrbmTJGDZFuRUsBTA8IOG2jKAkWfLF0UKwcGVVZaYAOCiJdm4jyhPMIBTkgULFY8XWMKALTVEVUvTCDXdYgDh09Ua1GclVmMqCuigKSFS1p1VRgWnss+zAMdr5QwmLMsBVK4KwqKr6vU/0qmOL6yq0mtWJlN5MZdzAmVIzNzcFnkultDKq350vMefv/7+UeXcw6ILDNOd5kT9QzDP5Zz0ux5cjWsctbxx1//+6DE+IAh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WcrzKqela3NAgCSFJG386uRxYfd11YbS5eCnU0guRuG4xdimlMpwsvU9f2Zy7foJEDCAYCllpw55WOtLGWtNf3Upjz/Xp2ST++/H8PwlFeGEeFqXm3cBxKarzliKRW1rt6zvudLDti7Mz1ex9uG404laGIcl/f5UnHdb/L/lfO45c+7UoZlhnamWedXDn//3Zd2MJ1w/bdzmH/////////////77VK+OF7D/////////////+ls+RZht7f+ouWlGdriEJXdJA4RABjd7wC4DNXMEAlE3rJjlJ+MshA0GAzPARNtoM0kLzBQGHmwYgMpl0amNwGYwLqCAdONmtv/7kMT6ABJyDTv5loAMbEFt/zWEQZgBFMKoFDKaptzg4DL1YBgAOeS1STMdQZBLA7LBEUjW2g86YIwECnJS68FhcF8IdflAghbLuzSHkMN0h5GclBGhm6t1jYWITDGA0+gMGCWSocjIslphCEirGIgv1uLTVL4Dc9pCVidRAJRqdFtyUhsiAt/FggcVBaYC9HCn2jTLEEmKiSdFDiTbSF+NaViTWWDWGS/jLoN/TPwgRS7YGuRMgWHlK/3cmI0qVHkMHb5O5cdPPQ1UiLO03xgVtIjM3nmgt11QK/WrKYs+G/p6WysdU9hyFDFfu9ZgarE6CCYJpWAwS1lcqwzXnX48sqf15YNic82sfYu2KR0Occu1P/////////////5bqkpcIfl3/////////////8vmX+hqXqApuR0W787siORO5U0lUNowhEiIeYwA2p1hMvOe6CwkAIjDnRERABsQlg7WZgUVBBkwI8GHkrntMLjAFaLzMVdl31nJCKapXJsUqwKpEwHlh0wFX2gjZkoL8hp3LefrMF6UsSjbWmxwJbcFhv/7sMTogCz+F1X5zIBEe0FrvzWACTZr0AvvGpx9GsMNkknhq/AEWo4y9LXVcRSIt+3kZV/APYzSUt59mkvrEYenJTGXXlEssfjDmObPpe6MawqxmMwFNS67y5NbjNhr8jmmktrS8gyifiG60qp4lSxiWyp/XZlE3nN6rNavS2pav03ZrCUXs6enr1qSxvnZqmj8Wd25La1qmtztnvdZwDSUlzePMcbUonOfnn+sv/////////////+Y/Wx1n//////////////YABMilwhQkgUwMAIw9HQoDAIAAAj4pbLwQH/n42AX3UCxP+DjD+qTBbB/hfoGpmQpuI+DLYhIGNSGjt4giSw2haAvkXhSIyPhbIGxIN3jgBzMLOF2OUQ/4yYww1aJuAIsAQSA5iZH/wuiK8J+JEWoNXCUkdVSX8sEWFbLOECIaREmP8y/5Ml0nSwTxkkTQ5xGjMqpber/5FbmRdLprrWTIypDiJJalP///+6y6cMWL3/lSVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tgxNOAFeWnQ/mZAgAAADSDgAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAGAAAMiABISEhISEhISEhISEhISEhIg4ODg4ODg4ODg4ODg4ODg4OcnJycnJycnJycnJycnJycvb29vb29vb29vb29vb29vb3v7+/v7+/v7+/v7+/v7+/v7/////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAOQAAAAAAAADIhEa0frAAAAAAD/+8DEAAADwAEntAAABDTB7T81hEEQMFiAACEAARBD5c+IMH////B9+GP//////////+oFYn3bpYl5hWe2FFGBxpgCNJeJ6nFCviYIuHBJ8Oy5A9eOKhIGWgEiKwaPS6MWBrhKEq/JCF+67AzZY9QNQ4IhbCXXhxpDTGLwqIF13aZkwFX7TPljX4kTBgeuz0HHlmHxNsFjuG3IkD9xtrcTTSDgUliLdaHEYfd+X260OXn8gicn445DQK1aHLUveqB4Ezw5n3v9LbqUR2DohGGnxukgiDsrFaRdt1alJytOS+1LP3n25FGdMklkjjdSzn9SMQ1huksTtq7+8/7vPP/5rlJezzwt2M6l/P6fOnawxDf548u95/8xzxjedJhu3hz/////////////9gkOXcJdSc//////////////pr+J86pom82e2bhIdVZaEJxuUpApuhgFyKhMz00wYXDSHcKMUZKLJxM/GMAiaVBhoceGGAmQE4xCMDBgXMaA8yIKDczDFxzA+tzUbZSNCJfNxRgGlRZBbwBNIQlBzLAGCiYdVBAUWyCIk54cGDi1zuzsMI8gwFhD6MhEI6WEES24+4KGQ9m2XgwohQEiF5OWDAy2QWJXe3qXZkvDRTARJogEL/Omy1YQu0gKZUzV0YmoghYgjpVtyubVLHVBRGA0dy4fbgBCX9gRoDNEwmyICIbcJm7tOxAwYSper++zxCU5Sls7DQqAng12lYeyVubU4/SP48SU6/mVFgFityTSbOJNeYaFBGttNf1/pp6oky6LvjKpJP0uP72z1gTPWfQUyaAq9FczzqU/FVbbOXsWQs6dlr84yx7pJKficRrpEpGy1rUofR3v/////////////2lSqZpIaxrf/////////////8qw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MiLf//+mp12VpXMTE5////+mZJl1Fi8qTEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//tQxPCAE+WnQfmpgAAAADSDgAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==',
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAGAAAOKQBHR0dHR0dHR0dHR0dHR0dHdHR0dHR0dHR0dHR0dHR0dHSgoKCgoKCgoKCgoKCgoKCgvb29vb29vb29vb29vb29vb3x8fHx8fHx8fHx8fHx8fHx8f////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAOQAAAAAAAADikCA+maAAAAAAD/+9DEAAADeAEUFBAABHBCqn81hEAMQfD+CAY////8EP////////hj/xOD5c/g+CBx5Nml9dmR0J1XGoAgAAAABE+eNo5Oi+pTIUZYGEzcGBAINyrAwBCYqA2sMyxEMYM+aAu8DDAGpQh+67J3YDAAuatjKnQd6yrx36R5Vg0Xg4mkTwcMInjQRSTRNS+tdXOrsHSbeAgsEO13Uy/cXwv0rD5IayoD5C0tpEeCpVdcz/n54X06JmXx5uJfN2ZU7NJBDtqAWN//5//yhLxakvld+KVLCumrzNNea/LbVP/55//7z7zlPkmOuuffxyHEi+WFWGHheqilManZDU/v/////+XP3YlEY5I4xYfjDCMRicjrtSu3DcKkVPKZXa3fhx41irW1+eGe8//////////////1qAoCxJAwSrf//////////////QQwXXiMxJloe9/c+qtomIq/tx2u6TBwRgxm1gghPBdQuEnTOR8pkKJ4UuwdEH8mh0JoamzGfzowGmhLpoKcZcYGPpgbKYQEFZBzzqYAkLUmFRQknAI4VFDgYwwRZBnSRh2ZlhQd3T+LpkjQyJ0LuhguZ5ELf0I2sPiDQptALqOJEISSFKRdimxAPMCJHixgAYKKiBIZwAIhpMEa0MBzFkDVISEEr5RkdjKChdQgFbmuhElmbM1gxISFhb1t2hhyE4FMl+K7kSei8F8iocgApJStz5pWBlsel7AU6I2pokYAgWEAqZOGhPfcu2wVsatD9rPtNbMAIAz1p7xIbpyI/pWMiqwhlyAF5GViInG39XewhxGJCw0RFmhvkIA8NtmcZW/jpw7LZG0mantYWKzxsnL2sgXuwxu8Zh6XV70xaqqVs7VvU2Q5tQgB9YPlt136Z5odR5klOo0z+G9T0uhH/////////////7ZYYn4FmJTOf/////////////5XaGbqQ+76Vkw+VMsyO6NQrAQbCgSDbCQeLGCIYjcQ+lY6kB+xYaXlNEcMIaDlKZJKDMmBMhBBNJTsGBE14dMmIM/HgRpysKKaZ7aCNwam0Z5i3eHlgn0aW2+oyccocMsZUiDB3b24/D8DyiKP+2eIKfbRFEtNLy68ScRYzf0UZj+N//uwxPsAL1YXVfm9AAS2Qux/NaIAaVs1QCrSd9uMCcpaeCr85uLwPSz92Am0TqSKWSrY/rhIu4U1Nu/KddrRTCk1hqX92DAqPywa6ootCDHGToyuz+1AnntXb1HS536CMP1a5SYVOtNiT7xOHGt07IGwq5dqYhmI77e7WntW6k7qVzfJm3WvW7coqZ3KTtqMvDFIskUpbDTSofeSTMugWERPmVymtyCH//////////////+/zvNY//////////////9yxsUuq6rHiHephjQydkbXO6Wx8nsdP46k5mwKDqogIvMdKhAKl9gIDJSlUiMEAjEAowQYGgYKiAhFgcQ4bSGFpXhUVSDtJfNbbxr4XHOJZVQIGVvLKxtUebpLkUFbRXrDYYfV9lTtVZOyhyJE0SA3/V04LM3wvy+xUcpkU/Z6xh2oDfjOjibA5K0+OxqHJRKr1PTRi/KYdctpmNPFJuJv890fs0U1PP1AWO5reNLWtWoxKb0rylEjtWc885bOuznbrW5uU2cMsd5ZU12xHIYlEUfSmjFJfqx+re1XhiYgKzTWvnZU5Esrb+r9Xn/rLdL2My+rE3/lFvPGv2hp6OzJPz/////////////////+XLWsfoaVJVnRCEQA1BZZEoBgKAwDDADNtEAERo1eUQSVDfavNBpgxEWzNBKNNgA2YDzWwlMmAcyQbTCIkMQoAyEWVmGDFO4YQeFzinRKHMSQgRTYPDDQsuqSCDFmC5ZkRjOk9lzGKB5IuMuGjqPKc5WMsSxNFCcChywwsLMAJTDHkM0z1NGbe1pKiyDy+i5paYKhIcVWIRzRWIWpVUnfm0X/+7DE1QAhud9h+byABK876X85oJBoCVuVMyJQZE50oNjOH7ZnvLP95yxbKYqmLIS0qRMzioFBs1KX1f1rNymu7w13ePf7EmdI9QApkup+lpO9DLs3K3c5PDOUw7VaZ7zl7PWst86vGVSOzX9/cLXMaXdbJpMaxlNPOR6rllWv01e/r62V2zlvP+d7+OX//7//////////////+5qtTW7s7/9aATo2Yoc4pYoJlYabmICgIAABD02EYKbPpEjUhsLPR2z6gbByAgkWtNuYDBlxxNwy5ZG4DecFWGMRCqAb2HxFYQoHvjwQ0ngviNEuGiB4rixkwaHCPPGxPJWonnPmhQW9qX2QLhHjjHeaLf/8i5cNSfLhDx3rnamqf/puzJ+6lX///26mbo/q///7bffWrS1r////////mhOFlRik7uzId3iVtZk0w4agmAUnDRMnQM+xVWOklAahNM1ClIUTHmXPGcCmAbBhpW0LB1ojpJLFiz9ds6GKPyaLqwzAWtrfV+oqpy4DGA4BGt+FkDBcphhkUrSvn6cvYXofqf+JMd7z6CLPupWutDAiOczKJwNUht1JDLaVoyLFXBXbtwPEH9afNXbV+gtssjEPxrkdty0v+W3Vjfik9+JuLvLKK1mYduW503yb8dUmPO27svUDaffikNw/Zy7u/F5djvl+1rmMSjU/UkktqW94Rilh+7G5/DDCk5p9mu7/8O4a5/63laoeV8cNVt/3/+5YiSC4OIZZOP/TXv/////////////8Jvu/z//////////////+ToxMtZl8/v7JqotWd7GCLpdGyohAAje7aBINN4OkwKaTp//7kMTmgBMCDT35iJAMWcFtPzWUAd0NukIOPRsUDgKgmnxecQDwIBRjQlGHCCZNF5ksGmYFeVSjFqFYbJoigXg1QFwEIZAINGlgwWAGViZ5W/ExwDKBEQrSBkhroUcDlQKWVAoTONs0wqA4TmLSlhJdCNO8DiGXRpThkwiBai1mCQKI01oyeaVZgIgpdAYEDAYpE6PMxa4psrxD5/FLIJTIQHKqqBw6WWbUSKGgyYVpqg6PL2L3WGUGlDM3dHglVnSQCu63NXrI6NHUHCggFHZYct66DP0+eT6qShLkNbctMyVN5D9PDLSlKmSSljLUML0pmXoWIoYBTCsF9oMkbevRCF/uI22UViOvqU21DHwfR20y16PzXeymgCKzT/YNyp3iUCRVWFbS0+cpf55nofpyGL2EwIdjlHO0MWt//////////////w9jQ0+5iHP/////////////7EKoO1GNubFxivrrBm5G7lBWHQmgwGQICZjgUhHos8d2AYpGZB4DQ4WAhQyCURkwBsjAjJGTLqIhwFqiXKRQqsRkaeW/NIVKkf/7wMTVAC0OF1X5zIBEhUFrfzWACdHEKBixIaTvRUQ0Zy+oGyWVIAsGVLKG5T0PzUOL0cXUakttnMofFQF4GkQtb7vyZ4K7xSRr0rrvrad6B5az27K16NPdddaeyoJNDNJD2UqdN9n4mvqVIrhK4ffzC479+o0JtYg7NmOajTd3RgWpnV/sap38intibaXX5LbjcotVbEpuU8ulMNP9T1MLlLLWG341Xs3ozZgm2/9qxDEsuUM/3mPJTZgycdaZvymcpaCfv1OfhEs7czl39anY3L/5zuGPf/////////////8+41d43P/////////////7boiimgaQhwSAQwNQvHwlEAIAAAEYx7PFzf83hRVFoIgH/0wTwcLMtY/xCwCCsLXhgsL5h8QjkxILw0gdgssPSGsTRTEK+HPDlBQQX1BvKOSQwPiGOFxfAwZFbDlECDEAXDHUVF4miLfigiMIMHxE2OaSJeU5itFH+blUV02IaIKlgiQ1f//xyhziDHSIomJDRcpHCyv///HOdEok0RY2qSMiaNmIt////+fIcTz2HVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tQxPMAFY2nQfmZgAAAADSDgAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ=='
];

function ensureCtx() {
  if (!ctx && AC) ctx = new AC();
}

async function loadSamples() {
  if (clickBuffers.length > 0 || !ctx) return;
  for (const b64 of CLICK_B64) {
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const audioBuf = await ctx.decodeAudioData(bytes.buffer);
      clickBuffers.push(audioBuf);
    } catch(e) { /* skip on decode error */ }
  }
}

function playBuffer(buf, gainVal, pitch) {
  if (!ctx || !buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gainVal, ctx.currentTime);
  src.connect(g); g.connect(ctx.destination);
  src.start();
}

function playBeep(freq, type, gainVal, dur, ramp) {
  if (!ctx) return;
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (ramp) osc.frequency.exponentialRampToValueAtTime(ramp, ctx.currentTime + dur);
  g.gain.setValueAtTime(gainVal, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(f); f.connect(g); g.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + dur + 0.01);
}

function playClick(type) {
  ensureCtx();
  if (!ctx) return;
  // Use real click samples for per-line sounds
  if ((type === 'ok' || type === 'type') && clickBuffers.length > 0) {
    const buf = clickBuffers[Math.floor(Math.random() * clickBuffers.length)];
    const gain = type === 'ok' ? 0.55 : 0.38;
    const pitch = 0.88 + Math.random() * 0.28; // slight randomisation keeps it natural
    playBuffer(buf, gain, pitch);
    return;
  }
  // Synthesised sounds for boot thud and launch fanfare
  if (type === 'fail') {
    playBeep(180, 'sawtooth', 0.1, 0.12, 60);
  } else if (type === 'boot') {
    playBeep(80, 'sine', 0.25, 0.35, 30);
    setTimeout(() => playBeep(120, 'sine', 0.15, 0.2, 60), 80);
  } else if (type === 'launch') {
    [0, 100, 200].forEach((delay, i) => {
      const freqs = [160, 220, 300];
      setTimeout(() => playBeep(freqs[i], 'sine', 0.18, 0.25, freqs[i]*1.4), delay);
    });
  }
}

// ── Boot lines definition ──
const LINES = [
  // Phase 1: kernel / hardware
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Welcome to <span class="blog-hi">eDEX-UI</span>  v2.2.8', delay: 0, sound: 'boot' },
  { tag: '[ INFO ]', cls: 'blog-info', msg: '<span class="blog-detail">vm_page_bootstrap: 387323 free pages and 530EL wired pages</span>', delay: 55, sound: 'type' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEX-UI Kernel:version 2.2.8.boot-st Sun May-02-2026 14:36:28 GMT+0300', delay: 40, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Detecting hardware configuration...', delay: 55, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'TSC: deadline timer enabled', delay: 40, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'hrt_queue_init: table max_deadline is 10000 us', delay: 35, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'TSQ_Deadline_Timer: supported and enabled', delay: 35, sound: 'ok' },
  // Phase 2: processor topology
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPICPU: ProcessorId=1 LocalApicId=0 <span class="blog-grn">Enabled</span>', delay: 28, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPICPU: ProcessorId=2 LocalApicId=1 <span class="blog-grn">Enabled</span>', delay: 22, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPICPU: ProcessorId=3 LocalApicId=2 <span class="blog-grn">Enabled</span>', delay: 22, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPICPU: ProcessorId=4 LocalApicId=3 <span class="blog-grn">Enabled</span>', delay: 22, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPICPU: ProcessorId=5 LocalApicId=255 <span class="blog-detail">Disabled</span>', delay: 22, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPICPU: ProcessorId=6 LocalApicId=255 <span class="blog-detail">Disabled</span>', delay: 22, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPICPU: ProcessorId=7 LocalApicId=255 <span class="blog-detail">Disabled</span>', delay: 22, sound: 'ok' },
  // Phase 3: security
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXACPINMI:policy:SoftRst:OEMniRplyRst=255 <span class="blog-detail">Disabled</span>', delay: 30, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Selling:npo:policy:SmErr SafetyNetRollback <span class="blog-amber">(TMSafetyNet)</span>', delay: 28, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Selling:npo:policy:SmErr BestSanddown:Box policy <span class="blog-amber">(Sandbox)</span>', delay: 28, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Security:policy:Slim:Set Quarantine:Policy <span class="blog-warn">(Q8Ntantine)</span>', delay: 28, sound: 'ok' },
  // Phase 4: init
  { tag: '[ INFO ]', cls: 'blog-info', msg: 'Copyright (c) 1986,1996–1993–1991,d–1993, The Regents of the University of Adelaide. All rights reserved.', delay: 40, sound: 'type' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'HI_Framework successfully initialized', delay: 50, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'HL_Framework successfully initialised <span class="blog-detail">cluster IO buffer headers using 16384 buffer headers and 10240 cluster IO buffer headers</span>', delay: 40, sound: 'ok' },
  { tag: '[ INFO ]', cls: 'blog-info', msg: 'IOAPIC: Version Dx20 Vectors 64:87:83  <span class="blog-addr">[0x 03 84 d5] {83}</span>', delay: 35, sound: 'type' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'PCI: System State <span class="blog-addr">[00 83 04 d5] (83)</span>', delay: 28, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'STIM: <span class="blog-addr">0xf10000000,  0xf3000000</span>', delay: 28, sound: 'ok' },
  { tag: '[ INFO ]', cls: 'blog-info', msg: 'PCI configuration begin ]', delay: 28, sound: 'type' },
  // Phase 5: PTFS-specific modules
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXIntelCPUPowerManagement: Turbo Ration 0046 Jun 18 2011: initialization complete', delay: 45, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXIntelCPUPowerManagement: (Built 13:08:12 Jun 18 2011): initialization complete', delay: 38, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'console relocated to <span class="blog-addr">0xf10000000</span>', delay: 28, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'PCI configuration changed (bridge=16 devices=4 cardbus=0)', delay: 30, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'PCI configuration end, bridges 12 devices 16 ]', delay: 30, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'mbinit: done [64 MB total pool-wise, (42/21) split]', delay: 30, sound: 'ok' },
  { tag: '[ WARN ]', cls: 'blog-warn', msg: 'Thread support: 3 errors when async kernel primitives was misused', delay: 35, sound: 'type' },
  // Phase 6: PTFS portal modules
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Loading module: <span class="blog-hi">ptfs-core.js</span>  <span class="blog-grn">✓ 48 kB</span>', delay: 55, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Loading module: <span class="blog-hi">flight-data.js</span>  <span class="blog-grn">✓ 22 kB</span>', delay: 45, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Loading module: <span class="blog-hi">booking-engine.js</span>  <span class="blog-grn">✓ 31 kB</span>', delay: 45, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Loading module: <span class="blog-hi">wallet-service.js</span>  <span class="blog-grn">✓ 14 kB</span>', delay: 45, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Loading module: <span class="blog-hi">auth-discord-oauth.js</span>  <span class="blog-grn">✓ 9 kB</span>', delay: 45, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Loading module: <span class="blog-hi">airport-db.js</span>  <span class="blog-grn">✓ 7 kB — 42 airports indexed</span>', delay: 45, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'Loading module: <span class="blog-hi">ui-components.css</span>  <span class="blog-grn">✓ 68 kB</span>', delay: 40, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'IndiGo PTFS API endpoint: <span class="blog-addr">https://indigo-ptfs-api.onrender.com</span>  <span class="blog-grn">reachable</span>', delay: 55, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'WebSocket connection: <span class="blog-addr">wss://indigo-ptfs-api.onrender.com</span>  <span class="blog-grn">established</span>', delay: 45, sound: 'ok' },
  // Phase 7: hardware
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'wlc: Broadcom BCM4331 802.11 Wireless Controller  <span class="blog-grn">5.100.98.75</span>', delay: 50, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'wlc: Broadcom BCM4331 802.11 Wireless Controller <span class="blog-grn">ready</span>', delay: 35, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'BTCOMKIT off', delay: 28, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'FireWire (OHC): Lucent ID 5901 built-in now active, GUID <span class="blog-addr">c02a14ffe04a086</span>; max speed s800.', delay: 40, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'via boot-uid from /chosen: <span class="blog-addr">#58670093-AC74-23d0-8362-AC1577EE4AA3</span>; max speed s100.', delay: 35, sound: 'ok' },
  // Phase 8: final
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'com.eDEX.eDEXCompressionTypeZlib kmod start: <span class="blog-grn">succeeded</span>', delay: 38, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'com.eDEX.eDEXToolsoldBootScreen kmod start: <span class="blog-grn">succeeded</span>', delay: 32, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'com.eDEX.eDEXCompressionTypeDataless load: <span class="blog-grn">succeeded</span>', delay: 32, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: 'eDEXIntelCPUPowerManagementClient: <span class="blog-grn">ready</span>', delay: 38, sound: 'ok' },
  { tag: '[ OK ]', cls: 'blog-ok', msg: '<span class="blog-hi">IndiGo PTFS Passenger Portal</span> — all systems <span class="blog-grn">GO</span>', delay: 60, sound: 'launch' },
];

const FINAL_STATUSES = [
  'LOADING UI ASSETS',
  'ESTABLISHING CONNECTIONS',
  'FETCHING FLIGHT DATA',
  'VERIFYING MODULES',
  'AUTHENTICATING SYSTEMS',
  'WARMING ENGINE',
  'READY FOR DEPARTURE',
];

// ── DOM refs ──
const screen    = document.getElementById('boot-screen');
const logInner  = document.getElementById('boot-log-inner');
const logWrap   = document.getElementById('boot-log');
const barFill   = document.getElementById('boot-bar-fill');
const pct       = document.getElementById('boot-pct');
const finalEl   = document.getElementById('boot-final');
const ringFg    = document.getElementById('boot-ring-fg');
const ringLabel = document.getElementById('boot-ring-label');
const statusLine= document.getElementById('boot-status-line');

// ── Run boot sequence ──
let lineIndex = 0;
let elapsed = 0;

function addLine(l) {
  const row = document.createElement('div');
  row.className = 'blog-line';
  row.innerHTML = `<span class="${l.cls}">${l.tag}</span><span class="blog-msg">${l.msg}</span>`;
  logInner.appendChild(row);

  // Force reflow then show
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      row.classList.add('show');
    });
  });

  // Scroll to bottom
  requestAnimationFrame(() => {
    logWrap.scrollTop = logWrap.scrollHeight;
  });

  playClick(l.sound);

  // Update progress bar
  const progress = ((lineIndex + 1) / LINES.length) * 100;
  barFill.style.width = progress + '%';
  pct.textContent = Math.round(progress) + '%';
}

function scheduleLines() {
  let t = 300;
  LINES.forEach((l, i) => {
    t += l.delay + Math.random() * 18;
    setTimeout(() => {
      lineIndex = i;
      addLine(l);
      if (i === LINES.length - 1) {
        setTimeout(startFinalPhase, 350);
      }
    }, t);
  });
}

// ── Final ring phase ──
function startFinalPhase() {
  // Hide log area, show final
  finalEl.classList.add('show');

  let pctVal = 0;
  const circumference = 201; // 2π×32
  const statusCycle = setInterval(() => {
    statusLine.textContent = FINAL_STATUSES[Math.floor(Math.random() * FINAL_STATUSES.length)];
  }, 280);

  const ringInterval = setInterval(() => {
    pctVal += 1.4 + Math.random() * 0.8;
    if (pctVal >= 100) {
      pctVal = 100;
      clearInterval(ringInterval);
      clearInterval(statusCycle);
      statusLine.textContent = 'READY FOR DEPARTURE';
      playClick('launch');
      setTimeout(launchApp, 420);
    }
    const offset = circumference * (1 - pctVal / 100);
    ringFg.style.strokeDashoffset = offset;
    ringLabel.textContent = Math.round(pctVal) + '%';
  }, 28);
}

// ── Launch app ──
function launchApp() {
  screen.classList.add('fade-out');
  document.body.classList.remove('booting');
  setTimeout(() => {
    document.body.classList.add('boot-done');
  }, 700);
}

// ── Wait for click on splash screen to unlock audio, then boot ──
const splash = document.getElementById('boot-splash');

function startBoot() {
  // Create AudioContext inside user gesture (required by browsers)
  ensureCtx();
  // Decode the real click samples in the background — they'll be ready
  // long before the first boot line fires
  loadSamples();
  // Hide splash with fade
  splash.classList.add('hide');
  // Short pause for fade, then fire boot thud + log sequence
  setTimeout(() => {
    playClick('boot');
    scheduleLines();
  }, 350);
}

screen.addEventListener('click', startBoot, { once: true });

})();
