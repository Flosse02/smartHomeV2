export function weatherEmoji(code) {
  const m = {
        0:'☀️',
        1:'🌤️',
        2:'⛅',
        3:'☁️',
        45:'🌫️',
        48:'🌫️',
        51:'🌦️',
        53:'🌦️',
        55:'🌦️',
        61:'🌧️',
        63:'🌧️',
        65:'🌧️',
        71:'🌨️',
        73:'🌨️',
        75:'🌨️',
        80:'🌧️',
        81:'🌧️',
        82:'🌧️',
        95:'⛈️',
        96:'⛈️',
        99:'⛈️'};

  return m[code] ?? '🌡️';
}

async function fetchWeather(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude:  String(lat),
    longitude: String(lon),
    current_weather: 'true',
    timezone: 'auto'
  });
  
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return j.current_weather;
}

export async function updateWeather(el) {
  if (!el) return;
  const getCoords = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({lat: -31.95, lon: 115.86}); // Perth
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve({ lat: -31.95, lon: 115.86 }),
      { maximumAge: 60_000, timeout: 8_000 }
    );
  });

  try {
    const { lat, lon } = await getCoords();
    const cw = await fetchWeather(lat, lon);
    const t = cw?.temperature;
    el.textContent = t != null ? `${Math.round(t)}°C ${weatherEmoji(cw?.weathercode)}` : '—°C';
  } catch (e) {
    console.warn('weather error', e);
  }
}
