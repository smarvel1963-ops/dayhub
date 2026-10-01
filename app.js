/* SAVE AS: app.js · LOCATION: C:/MarvelApps/dayhub/app.js
 * Day Hub prototype v0.1 (Scott 2026-10-01). One screen of CARDS; a PROFESSION
 * PACK adds cards; every card can be moved or hidden. All data stays in this
 * browser (localStorage). Weather + geocoding: Open-Meteo (free, no key).
 */
"use strict";

const STORE = "dayhub.v1";
const WX = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

// ---------------------------------------------------------------- packs
// Base cards everyone gets; a pack ADDS its own. Order = default order.
const BASE = ["clock", "weather", "calendar", "todos"];
const PACKS = {
  general:  { label: "General",              cards: ["sun"] },
  trucker:  { label: "Trucker / Dispatcher", cards: ["route", "loads"] },
  trades:   { label: "Trades / Contractor",  cards: ["jobs"] },
  office:   { label: "Office",               cards: ["nextup"] },
  sports:   { label: "Sports fan",           cards: ["games"] },
};
const TITLES = {
  clock: "Clock", weather: "Weather", calendar: "Today's calendar", todos: "To-do",
  sun: "Sunrise & sunset", route: "Route weather", loads: "Today's loads",
  jobs: "Today's jobs", nextup: "Next up", games: "Today's games",
};

// --------------------------------------------------------------- state
const blank = () => ({
  name: "", city: "", pack: "general", order: null, hidden: [],
  events: [], todos: [], loads: [], jobs: [], route: { from: "", to: "" },
});
let S = load();
let WXDATA = null;          // { here, from, to } weather payloads (not stored)

function load() {
  try { return Object.assign(blank(), JSON.parse(localStorage.getItem(STORE) || "{}")); }
  catch (e) { return blank(); }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* private mode */ }
}
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function cardOrder() {
  const want = [...BASE, ...PACKS[S.pack].cards];
  let order = (S.order || []).filter(k => want.includes(k));
  for (const k of want) if (!order.includes(k)) order.push(k);
  return order;
}

// ------------------------------------------------------------- weather
const WMO = {
  0: ["☀️", "clear"], 1: ["🌤️", "mostly clear"], 2: ["⛅", "partly cloudy"], 3: ["☁️", "cloudy"],
  45: ["🌫️", "fog"], 48: ["🌫️", "fog"], 51: ["🌦️", "drizzle"], 53: ["🌦️", "drizzle"], 55: ["🌦️", "drizzle"],
  61: ["🌧️", "rain"], 63: ["🌧️", "rain"], 65: ["🌧️", "heavy rain"], 71: ["🌨️", "snow"], 73: ["🌨️", "snow"],
  75: ["❄️", "heavy snow"], 80: ["🌦️", "showers"], 81: ["🌧️", "showers"], 82: ["⛈️", "heavy showers"],
  95: ["⛈️", "thunderstorms"], 96: ["⛈️", "storms + hail"], 99: ["⛈️", "storms + hail"],
};
const wmo = c => WMO[c] || ["🌡️", "—"];

async function geocode(city) {
  const name = city.split(",")[0].trim();
  if (!name) return null;
  const r = await fetch(`${GEO}?name=${encodeURIComponent(name)}&count=5&language=en`);
  const j = await r.json();
  const st = (city.split(",")[1] || "").trim().toLowerCase();
  const hit = (j.results || []).find(x => !st || (x.admin1 || "").toLowerCase().startsWith(st) ||
                                     (x.admin1_code || "").toLowerCase() === st) || (j.results || [])[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude, label: `${hit.name}, ${hit.admin1 || hit.country_code}` } : null;
}

async function forecast(place) {
  const q = `latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code,wind_speed_10m` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,weather_code` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
  const j = await (await fetch(`${WX}?${q}`)).json();
  // The daily high/low come from a different model run than "now", so they can
  // read 92 while it is 93 out. Never show a high below (or a low above) now.
  const now = j.current.temperature_2m;
  return { label: place.label, cur: j.current, day: {
    hi: Math.max(j.daily.temperature_2m_max[0], now), lo: Math.min(j.daily.temperature_2m_min[0], now),
    rain: j.daily.precipitation_probability_max[0], code: j.daily.weather_code[0],
    sunrise: j.daily.sunrise[0], sunset: j.daily.sunset[0] } };
}

async function loadWeather() {
  WXDATA = {};
  try {
    if (S.city) { const p = await geocode(S.city); if (p) WXDATA.here = await forecast(p); }
    if (S.pack === "trucker") {
      for (const leg of ["from", "to"]) {
        if (S.route[leg]) { const p = await geocode(S.route[leg]); if (p) WXDATA[leg] = await forecast(p); }
      }
    }
  } catch (e) { WXDATA.error = "Weather unavailable right now."; }
  render();
}

// ------------------------------------------------------------- render
const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
const hm = t => { if (!t) return ""; const [h, m] = t.split(":").map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

const CARD = {
  clock: () => `<div class="clock" id="clockNow"></div><div class="date" id="dateNow"></div>`,

  weather: () => {
    if (!S.city) return `<div class="empty">Add your city in ⚙ settings to see today's weather.</div>`;
    if (!WXDATA) return `<div class="empty">Loading weather…</div>`;
    const w = WXDATA.here;
    if (!w) return `<div class="empty">${esc(WXDATA.error || "City not found — check it in ⚙ settings.")}</div>`;
    const [icon, txt] = wmo(w.cur.weather_code);
    return `<div class="wx-now"><span class="wx-icon">${icon}</span><span class="wx-temp">${Math.round(w.cur.temperature_2m)}°</span>
      <span>${txt}<br><span class="wx-line">${esc(w.label)}</span></span></div>
      <div class="wx-line">High ${Math.round(w.day.hi)}° · Low ${Math.round(w.day.lo)}° · Rain ${w.day.rain ?? 0}% · Wind ${Math.round(w.cur.wind_speed_10m)} mph</div>`;
  },

  calendar: () => {
    const ev = S.events.filter(e => e.day === today()).sort((a, b) => a.time.localeCompare(b.time));
    return (ev.length ? ev.map(e => `<div class="row"><span class="time">${hm(e.time)}</span><span class="grow">${esc(e.title)}</span>
      <button class="x" data-del="events:${e.id}" aria-label="Remove">✕</button></div>`).join("")
      : `<div class="empty">Nothing on the calendar today.</div>`) +
      `<form class="add" data-add="events"><input name="time" type="time" required style="max-width:120px">
       <input name="title" placeholder="Add an event" required><button class="small">Add</button></form>`;
  },

  todos: () => {
    const open = S.todos.filter(t => !t.done || t.doneDay === today());
    return (open.length ? open.map(t => `<div class="row ${t.done ? "done" : ""}"><input type="checkbox" data-tick="${t.id}" ${t.done ? "checked" : ""}>
      <span class="grow">${esc(t.title)}</span><button class="x" data-del="todos:${t.id}" aria-label="Remove">✕</button></div>`).join("")
      : `<div class="empty">No to-dos. Enjoy it.</div>`) +
      `<form class="add" data-add="todos"><input name="title" placeholder="Add a to-do" required><button class="small">Add</button></form>`;
  },

  sun: () => {
    const w = WXDATA && WXDATA.here;
    return w ? `<div class="leg"><span>🌅 Sunrise</span><b>${fmtTime(w.day.sunrise)}</b></div>
                <div class="leg"><span>🌇 Sunset</span><b>${fmtTime(w.day.sunset)}</b></div>`
             : `<div class="empty">Set your city to see sunrise and sunset.</div>`;
  },

  route: () => {
    const leg = (k, lbl) => {
      const w = WXDATA && WXDATA[k];
      if (!S.route[k]) return `<div class="leg"><span>${lbl}</span><span class="empty">not set</span></div>`;
      if (!w) return `<div class="leg"><span>${lbl}: ${esc(S.route[k])}</span><span class="empty">…</span></div>`;
      const [icon, txt] = wmo(w.day.code);
      return `<div class="leg"><span>${lbl}: ${esc(w.label)}</span><b>${icon} ${Math.round(w.day.hi)}°/${Math.round(w.day.lo)}° · rain ${w.day.rain ?? 0}%</b></div>
              <div class="wx-line">${txt}${(w.day.rain ?? 0) >= 50 ? " — <b style='color:var(--red)'>plan for wet roads</b>" : ""}</div>`;
    };
    return leg("from", "From") + leg("to", "To") +
      `<form class="add" data-route="1"><input name="from" placeholder="From city, ST" value="${esc(S.route.from)}">
       <input name="to" placeholder="To city, ST" value="${esc(S.route.to)}"><button class="small">Set</button></form>`;
  },

  loads: () => listCard("loads", "load", "Pickup / delivery (e.g. PU Little Rock)"),
  jobs: () => listCard("jobs", "job", "Job + address"),

  nextup: () => {
    const now = new Date(); const pad = n => String(n).padStart(2, "0");
    const nowT = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const nx = S.events.filter(e => e.day === today() && e.time >= nowT).sort((a, b) => a.time.localeCompare(b.time))[0];
    if (!nx) return `<div class="empty">Nothing else on the calendar today.</div>`;
    const [h, m] = nx.time.split(":").map(Number); const at = new Date(); at.setHours(h, m, 0, 0);
    const mins = Math.round((at - now) / 60000);
    return `<div class="leg"><span>${esc(nx.title)}</span><b>in ${mins >= 60 ? Math.floor(mins / 60) + "h " : ""}${mins % 60}m</b></div>`;
  },

  games: () => `<div class="empty">Today's games and start times arrive in the next version.</div>`,
};

function listCard(key, word, ph) {
  const rows = S[key].filter(x => x.day === today()).sort((a, b) => a.time.localeCompare(b.time));
  return (rows.length ? rows.map(x => `<div class="row ${x.done ? "done" : ""}"><input type="checkbox" data-tickl="${key}:${x.id}" ${x.done ? "checked" : ""}>
    <span class="time">${hm(x.time)}</span><span class="grow">${esc(x.title)}</span>
    <button class="x" data-del="${key}:${x.id}" aria-label="Remove">✕</button></div>`).join("")
    : `<div class="empty">No ${word}s today.</div>`) +
    `<form class="add" data-add="${key}"><input name="time" type="time" required style="max-width:120px">
     <input name="title" placeholder="${ph}" required><button class="small">Add</button></form>`;
}

function summaryLine() {
  const bits = [];
  const w = WXDATA && WXDATA.here;
  if (w) bits.push(`${Math.round(w.cur.temperature_2m)}° and ${wmo(w.cur.weather_code)[1]}`);
  const ev = S.events.filter(e => e.day === today()).length;
  const td = S.todos.filter(t => !t.done).length;
  bits.push(`${ev} event${ev === 1 ? "" : "s"}`, `${td} to-do${td === 1 ? "" : "s"}`);
  if (S.pack === "trucker") {
    const l = S.loads.filter(x => x.day === today() && !x.done).sort((a, b) => a.time.localeCompare(b.time))[0];
    if (l) bits.push(`first stop ${hm(l.time)}`);
  }
  return bits.join(" · ");
}

function greet() {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return S.name ? `${part}, ${esc(S.name)}` : part;
}

function render() {
  document.getElementById("greeting").innerHTML = greet();
  document.getElementById("summary").textContent = summaryLine();
  const html = cardOrder().filter(k => !S.hidden.includes(k)).map(k =>
    `<section class="card" data-card="${k}"><h3>${TITLES[k]}${PACKS[S.pack].cards.includes(k) ? `<span class="tag">${PACKS[S.pack].label}</span>` : ""}</h3>${CARD[k]()}</section>`).join("");
  document.getElementById("cards").innerHTML = html;
  tick();
}

function tick() {
  const c = document.getElementById("clockNow"), d = document.getElementById("dateNow");
  const now = new Date();
  if (c) c.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d) d.textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

// ------------------------------------------------------------- events
document.addEventListener("submit", e => {
  const f = e.target; e.preventDefault();
  const data = Object.fromEntries(new FormData(f));
  if (f.dataset.route) { S.route = { from: data.from.trim(), to: data.to.trim() }; save(); loadWeather(); return; }
  const key = f.dataset.add;
  if (key === "todos") S.todos.push({ id: uid(), title: data.title.trim(), done: false });
  else S[key].push({ id: uid(), day: today(), time: data.time, title: data.title.trim(), done: false });
  save(); render();
});

document.addEventListener("click", e => {
  const t = e.target;
  if (t.dataset.del) { const [k, id] = t.dataset.del.split(":"); S[k] = S[k].filter(x => x.id !== id); save(); render(); }
  if (t.id === "settingsBtn") openSheet();
  if (t.id === "closeSheet" || t.id === "sheet") closeSheet();
  if (t.dataset.move) { moveCard(t.dataset.move, Number(t.dataset.dir)); }
});

document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.tick) { const x = S.todos.find(y => y.id === t.dataset.tick); x.done = t.checked; x.doneDay = today(); save(); render(); }
  if (t.dataset.tickl) { const [k, id] = t.dataset.tickl.split(":"); const x = S[k].find(y => y.id === id); x.done = t.checked; save(); render(); }
  if (t.dataset.show) { S.hidden = t.checked ? S.hidden.filter(k => k !== t.dataset.show) : [...S.hidden, t.dataset.show]; save(); render(); }
});

// ------------------------------------------------------------ settings
function openSheet() {
  document.getElementById("setName").value = S.name;
  document.getElementById("setCity").value = S.city;
  const sel = document.getElementById("setPack");
  sel.innerHTML = Object.entries(PACKS).map(([k, p]) => `<option value="${k}" ${k === S.pack ? "selected" : ""}>${p.label}</option>`).join("");
  drawCardList();
  document.getElementById("sheet").classList.remove("hidden");
}
function drawCardList() {
  document.getElementById("cardList").innerHTML = cardOrder().map(k => `<li><span>${TITLES[k]}</span>
    <button class="x" data-move="${k}" data-dir="-1" aria-label="Move up">▲</button>
    <button class="x" data-move="${k}" data-dir="1" aria-label="Move down">▼</button>
    <input type="checkbox" data-show="${k}" ${S.hidden.includes(k) ? "" : "checked"} aria-label="Show ${TITLES[k]}"></li>`).join("");
}
function moveCard(k, dir) {
  const o = cardOrder(); const i = o.indexOf(k), j = i + dir;
  if (j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; S.order = o; save(); drawCardList(); render();
}
function closeSheet() {
  const city = document.getElementById("setCity").value.trim();
  const changedCity = city !== S.city;
  const pack = document.getElementById("setPack").value;
  const changedPack = pack !== S.pack;
  S.name = document.getElementById("setName").value.trim();
  S.city = city; S.pack = pack; save();
  document.getElementById("sheet").classList.add("hidden");
  render();
  if (changedCity || changedPack) loadWeather();
}

// ---------------------------------------------------------------- boot
render();
loadWeather();
setInterval(tick, 15000);
if (!S.city) openSheet();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
