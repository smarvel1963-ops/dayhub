/* SAVE AS: app.js · LOCATION: C:/MarvelApps/dayhub/app.js
 * Day Hub v0.2 (Scott 2026-10-01). One screen of CARDS; a PROFESSION PACK adds
 * cards; every card can be moved or hidden. All data stays in this browser
 * (localStorage). Weather + geocoding: Open-Meteo (free, no key); US ZIPs:
 * Zippopotam.us. v0.2 adds the TODAY summary card, Bills due, Countdowns and
 * Lists - all free, all on the phone, no AI and no paid service (yet).
 */
"use strict";
const VERSION = "0.2";

const STORE = "dayhub.v1";
const WX = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

// ---------------------------------------------------------------- packs
// Base cards everyone gets; a pack ADDS its own. Order = default order.
const BASE = ["today", "clock", "weather", "calendar", "todos", "bills", "countdowns", "lists"];
const PACKS = {
  general:  { label: "General",              cards: ["sun"] },
  trucker:  { label: "Trucker / Dispatcher", cards: ["route", "loads"] },
  trades:   { label: "Trades / Contractor",  cards: ["jobs"] },
  office:   { label: "Office",               cards: ["nextup"] },
  sports:   { label: "Sports fan",           cards: ["games"] },
};
const TITLES = {
  today: "Today", bills: "Bills due", countdowns: "Countdowns", lists: "Lists",
  clock: "Clock", weather: "Weather", calendar: "Today's calendar", todos: "To-do",
  sun: "Sunrise & sunset", route: "Route weather", loads: "Today's loads",
  jobs: "Today's jobs", nextup: "Next up", games: "Today's games",
};

// --------------------------------------------------------------- state
const blank = () => ({
  name: "", city: "", pack: "general", order: null, hidden: [],
  events: [], todos: [], loads: [], jobs: [], route: { from: "", to: "" },
  bills: [], countdowns: [], lists: [{ id: "grocery", name: "Grocery", items: [] }], listSel: "grocery",
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
// LOCAL date. v0.1 used toISOString() = UTC, so after 7 PM Central "today" was
// already tomorrow and evening entries landed on the wrong day.
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => ymd(new Date());
const daysUntil = iso => { const [y, m, d] = iso.split("-").map(Number);
  const a = new Date(); a.setHours(0, 0, 0, 0); return Math.round((new Date(y, m - 1, d) - a) / 86400000); };
const prettyDate = iso => { const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: "short", day: "numeric" }); };
const inDays = n => n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function cardOrder() {
  const want = [...BASE, ...PACKS[S.pack].cards];
  let order = (S.order || []).filter(k => want.includes(k));
  // A card new in this version goes to its DEFAULT place (TODAY on top), not
  // to the bottom of someone's saved order.
  want.forEach((k, i) => { if (!order.includes(k)) order.splice(Math.min(i, order.length), 0, k); });
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

// A 5-digit US ZIP (or ZIP+4) goes to Zippopotam.us - an exact postal lookup,
// free, no key. Open-Meteo's name search will "match" a ZIP too, but by guessing
// (it can land on a same-numbered postcode abroad), so it only gets city names.
const ZIP = /^\s*(\d{5})(?:-\d{4})?\s*$/;
async function geocode(city) {
  const z = ZIP.exec(city || "");
  if (z) {
    const r = await fetch(`https://api.zippopotam.us/us/${z[1]}`);
    if (!r.ok) return null;                                   // 404 = no such ZIP
    const p = ((await r.json()).places || [])[0];
    return p ? { lat: Number(p.latitude), lon: Number(p.longitude),
                 label: `${p["place name"]}, ${p["state abbreviation"]} ${z[1]}` } : null;
  }
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
            `&hourly=precipitation_probability` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
  const j = await (await fetch(`${WX}?${q}`)).json();
  // The daily high/low come from a different model run than "now", so they can
  // read 92 while it is 93 out. Never show a high below (or a low above) now.
  const now = j.current.temperature_2m;
  // First hour from NOW on with a 50%+ rain chance (for "rain likely from 6 PM").
  const hrs = (j.hourly && j.hourly.time) || [];
  const nowHour = String(j.current.time || "").slice(0, 13);
  let rainFrom = null;
  hrs.forEach((t, i) => { if (!rainFrom && t.slice(0, 13) >= nowHour && (j.hourly.precipitation_probability[i] ?? 0) >= 50) rainFrom = t; });
  return { label: place.label, cur: j.current, day: {
    hi: Math.max(j.daily.temperature_2m_max[0], now), lo: Math.min(j.daily.temperature_2m_min[0], now),
    rain: j.daily.precipitation_probability_max[0], code: j.daily.weather_code[0],
    sunrise: j.daily.sunrise[0], sunset: j.daily.sunset[0], rainFrom } };
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

// ---------------------------------------------------------- v0.2 helpers
// A bill repeats monthly on its day (1-31, clamped to the month's length).
// Marking it PAID covers the month of its next due date, so it rolls forward.
function nextDue(b) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let k = 0; k < 3; k++) {
    const y = now.getFullYear(), m = now.getMonth() + k;
    const last = new Date(y, m + 1, 0).getDate();
    const due = new Date(y, m, Math.min(b.day, last));
    if (due < now) continue;
    if (b.paid === ymd(due).slice(0, 7)) continue;          // this month already paid
    return ymd(due);
  }
  return null;
}
const money = n => `$${Number(n || 0).toFixed(2)}`;
const upcomingBills = () => S.bills.map(b => ({ ...b, due: nextDue(b) })).filter(b => b.due)
  .sort((a, b) => a.due.localeCompare(b.due));
const liveCountdowns = () => S.countdowns.filter(c => daysUntil(c.date) >= 0)
  .sort((a, b) => a.date.localeCompare(b.date));

const CARD = {
  // The plain-language summary of the day. Rule-based, not AI: every sentence
  // comes from something the user entered or the weather service returned.
  today: () => {
    const lines = [];
    const w = WXDATA && WXDATA.here;
    if (w) {
      const rf = w.day.rainFrom;
      lines.push(`${wmo(w.cur.weather_code)[0]} ${Math.round(w.cur.temperature_2m)}° now, high ${Math.round(w.day.hi)}°. ` +
        (rf ? `<b>Rain likely from ${fmtTime(rf)}</b> — do outdoor things before then.` : "No rain expected."));
    } else if (!S.city) lines.push("Add your city or ZIP in ⚙ for the weather.");
    const ev = S.events.filter(e => e.day === today()).sort((a, b) => a.time.localeCompare(b.time));
    const pad = n => String(n).padStart(2, "0"); const d = new Date(); const nowT = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const nx = ev.find(e => e.time >= nowT);
    lines.push(ev.length ? `📅 ${ev.length} on the calendar` + (nx ? ` — next: <b>${hm(nx.time)} ${esc(nx.title)}</b>` : " — all done") + "."
                         : "📅 Nothing on the calendar.");
    const td = S.todos.filter(t => !t.done).length;
    lines.push(td ? `✅ ${td} to-do${td === 1 ? "" : "s"} open.` : "✅ No open to-dos.");
    for (const b of upcomingBills().filter(b => daysUntil(b.due) <= 3))
      lines.push(`💳 <b>${esc(b.name)} ${money(b.amount)}</b> due ${inDays(daysUntil(b.due))}.`);
    const cd = liveCountdowns()[0];
    if (cd) lines.push(`⏳ ${esc(cd.title)} ${daysUntil(cd.date) === 0 ? "is <b>today</b>!" : inDays(daysUntil(cd.date)) + "."}`);
    if (S.pack === "trucker") {
      const l = S.loads.filter(x => x.day === today() && !x.done).sort((a, b) => a.time.localeCompare(b.time))[0];
      if (l) lines.push(`🚚 First stop <b>${hm(l.time)}</b> — ${esc(l.title)}.`);
    }
    const busy = ev.length + td;
    lines.unshift(`<span class="verdict">${busy === 0 ? "A clear day." : busy <= 3 ? "A light day." : busy <= 7 ? "A full day." : "A busy day — pace yourself."}</span>`);
    return lines.map(l => `<div class="today-line">${l}</div>`).join("");
  },

  bills: () => {
    const up = upcomingBills();
    const total = S.bills.reduce((s, b) => s + Number(b.amount || 0), 0);
    return (up.length ? up.map(b => { const n = daysUntil(b.due);
      return `<div class="row"><span class="time" style="min-width:72px">${prettyDate(b.due)}</span>
        <span class="grow">${esc(b.name)} <b>${money(b.amount)}</b>${n <= 3 ? ` <span class="soon">${inDays(n)}</span>` : ""}</span>
        <button class="small" data-paid="${b.id}">Paid</button><button class="x" data-del="bills:${b.id}" aria-label="Remove">✕</button></div>`; }).join("")
      : `<div class="empty">No bills added. Add one below — it repeats every month.</div>`) +
      (S.bills.length ? `<div class="wx-line">Monthly total: <b>${money(total)}</b></div>` : "") +
      `<form class="add" data-add="bills"><input name="title" placeholder="Bill (e.g. Electric)" required>
       <input name="amount" type="number" step="0.01" min="0" placeholder="$" style="max-width:80px" required>
       <input name="day" type="number" min="1" max="31" placeholder="Day" style="max-width:64px" required>
       <button class="small">Add</button></form>`;
  },

  countdowns: () => {
    const cs = liveCountdowns();
    return (cs.length ? cs.map(c => { const n = daysUntil(c.date);
      return `<div class="row"><span class="grow">${esc(c.title)} <span class="wx-line">${prettyDate(c.date)}</span></span>
        <b class="big">${n === 0 ? "TODAY" : n + (n === 1 ? " day" : " days")}</b>
        <button class="x" data-del="countdowns:${c.id}" aria-label="Remove">✕</button></div>`; }).join("")
      : `<div class="empty">Add something to look forward to.</div>`) +
      `<form class="add" data-add="countdowns"><input name="title" placeholder="e.g. Cruise" required>
       <input name="date" type="date" required style="max-width:150px"><button class="small">Add</button></form>`;
  },

  lists: () => {
    const L = S.lists.find(l => l.id === S.listSel) || S.lists[0];
    if (!L) return `<div class="empty">No lists.</div>`;
    const opts = S.lists.map(l => `<option value="${l.id}" ${l.id === L.id ? "selected" : ""}>${esc(l.name)} (${l.items.filter(i => !i.done).length})</option>`).join("");
    return `<div class="add" style="margin-top:0"><select data-listsel="1" style="flex:1">${opts}</select></div>` +
      (L.items.length ? L.items.map(i => `<div class="row ${i.done ? "done" : ""}"><input type="checkbox" data-item="${L.id}:${i.id}" ${i.done ? "checked" : ""}>
        <span class="grow">${esc(i.text)}</span><button class="x" data-delitem="${L.id}:${i.id}" aria-label="Remove">✕</button></div>`).join("")
        : `<div class="empty">Empty list.</div>`) +
      `<form class="add" data-additem="${L.id}"><input name="text" placeholder="Add to ${esc(L.name)}" required><button class="small">Add</button></form>` +
      (L.items.some(i => i.done) ? `<button class="small" data-clear="${L.id}" style="margin-top:8px">Clear checked</button>` : "") +
      `<form class="add" data-newlist="1"><input name="name" placeholder="New list (e.g. Hardware store)" required><button class="small">+ List</button></form>`;
  },

  clock: () => `<div class="clock" id="clockNow"></div><div class="date" id="dateNow"></div>`,

  weather: () => {
    if (!S.city) return `<div class="empty">Add your city or ZIP code in ⚙ settings to see today's weather.</div>`;
    if (!WXDATA) return `<div class="empty">Loading weather…</div>`;
    const w = WXDATA.here;
    if (!w) return `<div class="empty">${esc(WXDATA.error || "City or ZIP not found — check it in ⚙ settings.")}</div>`;
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
      `<form class="add" data-route="1"><input name="from" placeholder="From: city, ST or ZIP" value="${esc(S.route.from)}">
       <input name="to" placeholder="To: city, ST or ZIP" value="${esc(S.route.to)}"><button class="small">Set</button></form>`;
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
  if (f.dataset.newlist) { const id = uid(); S.lists.push({ id, name: data.name.trim(), items: [] }); S.listSel = id; save(); render(); return; }
  if (f.dataset.additem) { const L = S.lists.find(l => l.id === f.dataset.additem); if (L) L.items.push({ id: uid(), text: data.text.trim(), done: false }); save(); render(); return; }
  const key = f.dataset.add;
  if (key === "bills") S.bills.push({ id: uid(), name: data.title.trim(), amount: Number(data.amount), day: Math.min(31, Math.max(1, Number(data.day))), paid: null });
  else if (key === "countdowns") S.countdowns.push({ id: uid(), title: data.title.trim(), date: data.date });
  else if (key === "todos") S.todos.push({ id: uid(), title: data.title.trim(), done: false });
  else S[key].push({ id: uid(), day: today(), time: data.time, title: data.title.trim(), done: false });
  save(); render();
});

document.addEventListener("click", e => {
  const t = e.target;
  if (t.dataset.del) { const [k, id] = t.dataset.del.split(":"); S[k] = S[k].filter(x => x.id !== id); save(); render(); }
  if (t.dataset.paid) { const b = S.bills.find(x => x.id === t.dataset.paid); const due = b && nextDue(b); if (due) { b.paid = due.slice(0, 7); save(); render(); } }
  if (t.dataset.delitem) { const [l, id] = t.dataset.delitem.split(":"); const L = S.lists.find(x => x.id === l); if (L) L.items = L.items.filter(i => i.id !== id); save(); render(); }
  if (t.dataset.clear) { const L = S.lists.find(x => x.id === t.dataset.clear); if (L) L.items = L.items.filter(i => !i.done); save(); render(); }
  if (t.id === "settingsBtn") openSheet();
  if (t.id === "closeSheet" || t.id === "sheet") closeSheet();
  if (t.dataset.move) { moveCard(t.dataset.move, Number(t.dataset.dir)); }
});

document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.tick) { const x = S.todos.find(y => y.id === t.dataset.tick); x.done = t.checked; x.doneDay = today(); save(); render(); }
  if (t.dataset.tickl) { const [k, id] = t.dataset.tickl.split(":"); const x = S[k].find(y => y.id === id); x.done = t.checked; save(); render(); }
  if (t.dataset.listsel) { S.listSel = t.value; save(); render(); }
  if (t.dataset.item) { const [l, id] = t.dataset.item.split(":"); const L = S.lists.find(x => x.id === l); const i = L && L.items.find(y => y.id === id); if (i) { i.done = t.checked; save(); render(); } }
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
