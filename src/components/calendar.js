const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GIS_URL = 'https://accounts.google.com/gsi/client';

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// ---- date helpers ----
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n)    { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n)  { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function startOfWeek(d) { // Monday as first day
  const day = (d.getDay() + 6) % 7; // 0=Mon .. 6=Sun
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -day);
}

function parseDateOnlyLocal(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function ymdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function endOfMonth(d)    { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }

function isAllDay(ev) { return !!ev.start?.date && !ev.start?.dateTime; }

function fmtTime(ev) {
  if (isAllDay(ev)) return 'All day';
  const s = new Date(ev.start.dateTime), e = new Date(ev.end.dateTime);
  const opts = { hour: '2-digit', minute: '2-digit' };
  return `${s.toLocaleTimeString([], opts)}–${e.toLocaleTimeString([], opts)}`;
}

// ---- API ----
async function fetchEvents(accessToken, { calId='primary', timeMin, timeMax }) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
  const params = {
    singleEvents: 'true',
    orderBy: 'startTime',
    showDeleted: 'false',
    maxResults: '2500',
  };
  if (timeMin) params.timeMin = new Date(timeMin).toISOString();
  if (timeMax) params.timeMax = new Date(timeMax).toISOString();
  url.search = new URLSearchParams(params);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Calendar HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.items) ? j.items : [];
}

// group events by YYYY-MM-DD
function bucketByDay(events) {
  const map = new Map();
  for (const ev of events) {
    // All-day events use .date (YYYY-MM-DD) — parse as local
    // Timed events use .dateTime — Date() handles their timezone offset
    let d;
    if (ev.start?.date) d = parseDateOnlyLocal(ev.start.date);
    else d = new Date(ev.start.dateTime);

    const key = ymdLocal(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  // Sort within each day by local start time
  for (const [, arr] of map) {
    arr.sort((a,b) => {
      const aStr = a.start?.dateTime || a.start?.date;
      const bStr = b.start?.dateTime || b.start?.date;
      const ad = a.start?.date ? parseDateOnlyLocal(aStr) : new Date(aStr);
      const bd = b.start?.date ? parseDateOnlyLocal(bStr) : new Date(bStr);
      return ad - bd;
    });
  }
  return map;
}



// ---- UI renderers ----
function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function renderShell(targetEl) {
  targetEl.innerHTML = `
    <div class="h-full flex flex-col min-h-0 rounded-xl border border-white/10">
      <div class="shrink-0 flex items-center justify-between p-3 border-b border-white/10">
        <div class="font-semibold">Calendar</div>
        <div class="flex items-center gap-2">
          <button id="gc-prev" class="px-2 py-1 rounded-lg border border-white/15 hover:border-white/30">◀</button>
          <button id="gc-today" class="px-2 py-1 rounded-lg border border-white/15 hover:border-white/30">Today</button>
          <button id="gc-next" class="px-2 py-1 rounded-lg border border-white/15 hover:border-white/30">▶</button>
        </div>
        <div id="gc-month" class="text-sm text-white/70"></div>
      </div>
      <div class="shrink-0 grid grid-cols-7 text-xs uppercase tracking-wide text-white/50 px-3 py-2">
        <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
      </div>
      <div id="gc-grid" class="flex-1 min-h-0 grid grid-cols-7 grid-rows-6 gap-px bg-white/10 p-3 overflow-auto"></div>
    </div>
  `;
}

function dayCellHTML(dayDate, inMonth) {
  const dayNum = dayDate.getDate();
  const muted = inMonth ? '' : 'opacity-40';
  const today = ymdLocal(dayDate) === ymdLocal(new Date()) ? 'ring-1 ring-sky-400' : '';
  return `
    <div class="bg-white/5 p-2 flex flex-col min-h-0">
      <div class="text-xs mb-1">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${today} ${muted}">
          ${dayNum}
        </span>
      </div>
      <div class="flex-1 min-h-0 overflow-hidden" data-day="${ymdLocal(dayDate)}"></div>
    </div>
  `;
}

function renderMonthGrid(elGrid, monthDate, events) {
  elGrid.innerHTML = ''; // reset
  const label = document.getElementById('gc-month');
  if (label) label.textContent = monthLabel(monthDate);

  const first = startOfMonth(monthDate);
  const firstGrid = startOfWeek(first); // Monday start
  // 6 weeks view (6 rows x 7 cols = 42 cells)
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(firstGrid, i);
    const inMonth = d.getMonth() === monthDate.getMonth();
    cells.push(dayCellHTML(d, inMonth));
  }
  elGrid.innerHTML = cells.join('');

  const buckets = bucketByDay(events);
  // Paint events into their day containers
  for (const [dayKey, evs] of buckets) {
    const dayEl = elGrid.querySelector(`[data-day="${dayKey}"]`);
    if (!dayEl) continue;

    // Render a capped list with a "+N more" expander
    const MAX_VISIBLE = 4;
    const frag = document.createDocumentFragment();

    evs.forEach((ev, idx) => {
      const hidden = idx >= MAX_VISIBLE ? 'hidden extra-ev' : '';
      const badge = isAllDay(ev) ? 'bg-emerald-500/30' : 'bg-sky-500/30';
      const line = document.createElement('div');
      line.className = `mb-1 text-xs rounded px-1 py-0.5 ${badge} ${hidden} truncate`;
      line.title = ev.summary || '';
      line.textContent = (isAllDay(ev) ? '' : `${fmtTime(ev)} `) + (ev.summary || '(No title)');
      frag.appendChild(line);
    });

    if (evs.length > MAX_VISIBLE) {
      const more = document.createElement('button');
      more.className = 'mt-1 text-[11px] text-white/70 underline';
      more.textContent = `+${evs.length - MAX_VISIBLE} more`;
      more.addEventListener('click', () => {
        dayEl.querySelectorAll('.extra-ev').forEach(n => n.classList.remove('hidden'));
        more.remove();
      });
      frag.appendChild(more);
    }

    dayEl.appendChild(frag);
  }
}

export function initGoogleAuth({ onReady, onNeedConsent, loginHint } = {}) {
  const ready = () => !!window.google?.accounts?.oauth2;
  const waitGIS = ready()
    ? Promise.resolve()
    : new Promise(res => {
        const t = setInterval(() => { if (ready()) { clearInterval(t); res(); } }, 50);
      });

  waitGIS.then(() => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: CAL_SCOPE,
      include_granted_scopes: true,
      ...(loginHint ? { hint: loginHint } : {}),
      callback: (resp) => {
        if (resp.error) {
          cleanupToken();
          onNeedConsent?.(resp);
          return;
        }
        accessToken = resp.access_token;
        const now = Date.now();
        const expiresMs = (Number(resp.expires_in || 3600) - 300) * 1000; // refresh 5m early
        scheduleSilentRefresh(expiresMs);
        onReady?.(accessToken);
      }
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// Show this on your “Connect Google” button
export function requestInteractiveConsent() {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

export function getAccessToken() {
  return accessToken;
}

function scheduleSilentRefresh(delayMs) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    // Silent refresh: no popup if Google cookie/session exists
    tokenClient?.requestAccessToken({ prompt: '' });
  }, Math.max(15_000, delayMs));
}

function cleanupToken() {
  accessToken = null;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

// ---- main mount ----
export async function mountGoogleCalendar(targetEl) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const loginHint = import.meta.env.VITE_GOOGLE_LOGIN_EMAIL;
  if (!targetEl) { console.warn('mountGoogleCalendar: target element missing'); return; }
  if (!clientId) {
    targetEl.innerHTML = `<div class="text-rose-400">VITE_GOOGLE_CLIENT_ID is missing.</div>`;
    return;
  }

  let accessToken = null;
  let refreshTimer = null;
  function scheduleSilentRefresh(delayMs) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      // Silent refresh: no prompt if user is still signed in and already granted scope
      tokenClient?.requestAccessToken({ prompt: '' });
    }, Math.max(15_000, delayMs)); // never schedule too close
  }

  renderShell(targetEl);
  const elGrid   = targetEl.querySelector('#gc-grid');
  const btnPrev  = targetEl.querySelector('#gc-prev');
  const btnNext  = targetEl.querySelector('#gc-next');
  const btnToday = targetEl.querySelector('#gc-today');

  await loadScriptOnce(GIS_URL);

  let currentMonth = startOfMonth(new Date());
  let tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    include_granted_scopes: true,
    ...(loginHint ? { hint: loginHint } : {}), // <-- add this
    callback: (resp) => {
      if (resp) {
        console.log('Google OAuth response');
        connectBtn.classList.add('hidden'); // show button if silent attempt fails
        refresh();
      } else {
        console.warn('Google OAuth error', resp);
        // Show the "Connect Google" button for manual consent
        connectBtn.classList.remove('hidden');
      }
      accessToken = resp.access_token;
      const expiresSec = Number(resp.expires_in || 3600);
      scheduleSilentRefresh((expiresSec - 300) * 1000);
      refresh();
    }
  });

  async function refresh() {
    if (!accessToken) return;
    const from = startOfWeek(startOfMonth(currentMonth)); // include leading days
    const to   = addDays(endOfMonth(currentMonth), 7);    // include trailing days
    elGrid.innerHTML = `<div class="col-span-7 p-8 text-white/60">Loading…</div>`;
    try {
      const items = await fetchEvents(accessToken, { timeMin: from, timeMax: to });
      renderMonthGrid(elGrid, currentMonth, items);
    } catch (e) {
      console.warn(e);
      elGrid.innerHTML = `<div class="col-span-7 p-8 text-rose-400">Failed to load events.</div>`;
    }
  }

  // Controls
  btnPrev.addEventListener('click', () => { currentMonth = addMonths(currentMonth, -1); refresh(); });
  btnNext.addEventListener('click', () => { currentMonth = addMonths(currentMonth, +1); refresh(); });
  btnToday.addEventListener('click', () => { currentMonth = startOfMonth(new Date()); refresh(); });

  // If you want to auto-connect immediately, call connectOnce() here.
  // Otherwise render a one-time button:
  const header = targetEl.querySelector('.p-3.border-b');
  const connectBtn = document.createElement('button');
  connectBtn.className = 'ml-2 px-2 py-1 rounded border border-white/15 hover:border-sky-400/50';
  connectBtn.textContent = 'Connect Google';
  connectBtn.classList.add('hidden'); // <-- hidden until we know silent failed
  header?.appendChild(connectBtn);

  // Try silent token on load (no popup if session + prior consent exist)
  tokenClient.requestAccessToken({ prompt: '' });

  // setTimeout(() => {
  //   if (tokenClient.accessToken == null) {
  //     console.warn('Google Token Client failed to initialize. Manual consent required.');
  //     connectBtn.classList.remove('hidden');
  //   }
  // }, 5000);

  
  // Fallback: user clicks to do interactive consent if silent failed
  connectBtn.addEventListener('click', () => {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}
