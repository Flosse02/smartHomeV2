const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GIS_URL = 'https://accounts.google.com/gsi/client';

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function fmtTimeRange(ev) {
  // Handles all-day and timed events
  const start = ev.start.dateTime || ev.start.date;
  const end   = ev.end.dateTime || ev.end.date;
  const s = new Date(start);
  const e = new Date(end);
  const allDay = !ev.start.dateTime;

  if (allDay) {
    return 'All day';
  }
  const opts = { hour: '2-digit', minute: '2-digit' };
  return `${s.toLocaleTimeString([], opts)} – ${e.toLocaleTimeString([], opts)}`;
}

function groupByDate(events) {
  const map = new Map();
  for (const ev of events) {
    const keySrc = ev.start.dateTime || ev.start.date;
    const d = new Date(keySrc);
    const key = d.toISOString().slice(0,10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  // sort each day by start
  for (const [, arr] of map) {
    arr.sort((a,b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date));
  }
  return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0]));
}

async function fetchEvents(accessToken, { calendarId = 'primary', maxResults = 50 } = {}) {
  const nowISO = new Date().toISOString();
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.search = new URLSearchParams({
    timeMin: nowISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
    showDeleted: 'false'
  });
  const r = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!r.ok) throw new Error(`Calendar HTTP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.items) ? j.items : [];
}

function renderList(container, events) {
  if (!events.length) {
    container.innerHTML = `<div class="text-white/60">No upcoming events</div>`;
    return;
  }
  const groups = groupByDate(events);
  container.innerHTML = groups.map(([yyyymmdd, evs]) => {
    const d = new Date(yyyymmdd);
    const heading = d.toLocaleDateString(undefined, { weekday: 'short', month:'short', day:'numeric' });
    const items = evs.map(ev => `
      <div class="flex gap-3 py-2 border-b border-white/10 last:border-b-0">
        <div class="w-32 shrink-0 text-white/70">${fmtTimeRange(ev)}</div>
        <div class="flex-1">
          <div class="font-medium">${ev.summary || '(No title)'}</div>
          ${ev.location ? `<div class="text-white/50 text-sm">${ev.location}</div>` : ''}
        </div>
      </div>`).join('');
    return `
      <section class="mb-4">
        <h3 class="text-sm uppercase tracking-wide text-white/50 mb-2">${heading}</h3>
        <div class="rounded-lg bg-white/5 p-3">${items}</div>
      </section>
    `;
  }).join('');
}

export async function mountGoogleCalendar(targetEl) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  console.log('mountGoogleCalendar: clientId=', clientId);
  if (!targetEl) throw new Error('mountGoogleCalendar: target element missing');
  if (!clientId) {
    targetEl.innerHTML = `<div class="text-red-400">VITE_GOOGLE_CLIENT_ID is missing.</div>`;
    return;
  }

  // Shell UI
  targetEl.innerHTML = `
    <div class="h-full rounded-xl border border-white/10 p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="font-semibold">Calendar</div>
        <div class="flex gap-2">
          <button id="gc-connect" class="px-3 py-1.5 rounded-lg border border-white/15 hover:border-sky-400/50">Connect Google</button>
          <button id="gc-refresh" class="px-3 py-1.5 rounded-lg border border-white/15 hover:border-sky-400/50" disabled>Refresh</button>
          <button id="gc-signout" class="px-3 py-1.5 rounded-lg border border-white/15 hover:border-rose-400/50" disabled>Sign out</button>
        </div>
      </div>
      <div id="gc-list" class="h-[calc(100%-2.75rem)] overflow-auto pr-1 text-sm text-white/80"></div>
    </div>
  `;
  const elList    = targetEl.querySelector('#gc-list');
  const btnConnect= targetEl.querySelector('#gc-connect');
  const btnRefresh= targetEl.querySelector('#gc-refresh');
  const btnSignout= targetEl.querySelector('#gc-signout');

  await loadScriptOnce(GIS_URL);

  let accessToken = null;
  let tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error) {
        console.warn('GIS error', resp);
        return;
      }
      accessToken = resp.access_token;
      btnRefresh.disabled = false;
      btnSignout.disabled = false;
      btnConnect.textContent = 'Connected';
      btnConnect.disabled = true;
      refresh();
    }
  });

  async function refresh() {
    if (!accessToken) return;
    elList.innerHTML = `<div class="text-white/60">Loading…</div>`;
    try {
      const items = await fetchEvents(accessToken, { calendarId: 'primary', maxResults: 100 });
      renderList(elList, items);
    } catch (e) {
      console.warn(e);
      elList.innerHTML = `<div class="text-rose-400">Failed to load events.</div>`;
    }
  }

  btnConnect.addEventListener('click', () => {
    tokenClient.requestAccessToken({ prompt: 'consent' }); // first time: shows Google account prompt
  });

  btnRefresh.addEventListener('click', () => refresh());

  btnSignout.addEventListener('click', () => {
    if (!accessToken) return;
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      btnConnect.textContent = 'Connect Google';
      btnConnect.disabled = false;
      btnRefresh.disabled = true;
      btnSignout.disabled = true;
      elList.innerHTML = `<div class="text-white/60">Signed out.</div>`;
    });
  });

  // Optional auto-refresh every 5 min while mounted
  const interval = setInterval(() => accessToken && refresh(), 5 * 60 * 1000);
  // Return unmount if you need it later
  return () => clearInterval(interval);
}
