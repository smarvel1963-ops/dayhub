/* SAVE AS: app.js · LOCATION: C:/MarvelApps/dayhub/app.js
 * Day Hub v0.3 (Scott 2026-10-01: "make it look sexy easy and useful" + "tie into
 * personal calendar and open to a page that shows the day's schedule").
 *
 * Opens on a HERO (clock, weather, the day in one line) and the SCHEDULE - a
 * timeline of the day that merges your events, your Google Calendar, loads/jobs,
 * bills due, sunrise/sunset and when the rain starts, with a NOW line.
 * One + button adds anything. Deletes can be undone. Cards fold away.
 *
 * All data stays in this browser (localStorage). Weather: Open-Meteo (free, no
 * key); US ZIPs: Zippopotam.us. Google Calendar: read-only, through Google's own
 * sign-in; the token lives in memory only (about an hour), events are cached here.
 */
"use strict";
const VERSION = "0.37";
// CRUISE HUB (Scott 10/1: "we want a go to app for cruises ... and it works with
// day hub as well"). The SAME code runs from /dayhub/cruise/ with
// window.DH_MODE = "cruise": a cruise-first screen and its own name / install,
// but the SAME data - same origin (shared storage on Android / computer) and
// the same Google Drive backup file (iPhone keeps each installed app apart, so
// there the backup is what carries trips between the two).
const MODE = window.DH_MODE === "cruise" ? "cruise" : "day";
const APP_NAME = MODE === "cruise" ? "Cruise Hub" : "Day Hub";
const BASE_URL = new URL(".", (document.currentScript && document.currentScript.src) || location.href).href;   // where app.js lives

const STORE = "dayhub.v1";
const WX = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

// Google Calendar. Empty = the Connect button explains it is not set up yet.
// The OAuth client is created once by the app owner in Google Cloud Console
// (type "Web application", origin https://smarvel1963-ops.github.io).
const GCAL_CLIENT_ID = "750311262064-354vjd8mkh07cpg1576p07qj2ifmb0d2.apps.googleusercontent.com";
// v0.19: read AND write events (was calendar.readonly) - Day Hub items go to the phone calendar.
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";      // read-only; reading happens on the phone   // a hidden Day Hub folder in the user's own Drive

// ------------------------------------------------------------ free / pro
// Scott 2026-10-01: "no ads, just better everything when go pro". NO ADS, EVER.
// Every feature carries a switch now so pricing is a settings change later,
// never a redesign. PRO_LIVE = false keeps everything unlocked while we build;
// at launch it goes true and TIER comes from the payment check.
const PRO_LIVE = false;
let TIER = "free";
const FEATURES = {
  schedule: "free", weather: "free", todos: "free", lists: "free", countdowns: "free",
  bills: "free", work: "free", tomorrow: "free", packages: "free", inbox: "free", trips: "free", notes: "free", route: "free", loads: "free", jobs: "free", nextup: "free", games: "free",
  gcal: "pro", sync: "pro", reminders: "pro", budget: "pro", mail: "pro",   // candidates - Scott decides at launch
};
const can = f => !PRO_LIVE || FEATURES[f] !== "pro" || TIER === "pro";

// ---------------------------------------------------------------- packs
const BASE = MODE === "cruise" ? ["trips", "inbox", "schedule", "weather", "todos", "lists"] : ["inbox", "trips", "top3", "schedule", "errands", "leave", "routines", "reset", "tomorrow", "work", "payday", "budget", "weather", "todos", "notes", "future", "packages", "bills", "home", "auto", "people", "countdowns", "lists"];
const PACKS = {
  general:  { label: "General",              cards: [] },
  trucker:  { label: "Trucker / Dispatcher", cards: ["route", "loads"] },
  trades:   { label: "Trades / Contractor",  cards: ["jobs"] },
  office:   { label: "Office",               cards: ["nextup"] },
  sports:   { label: "Sports fan",           cards: ["games"] },
};

// --------------------------------------------------------------- state
const blank = () => ({
  name: "", city: "", pack: "general", order: null, hidden: [], collapsed: [],
  events: [], todos: [], loads: [], jobs: [], route: { from: "", to: "" },
  bills: [], countdowns: [], lists: [{ id: "grocery", name: "Grocery", items: [] }], listSel: "grocery",
  gcal: { connected: false, events: [], fetched: null },
  sync: { on: false, last: null, dirty: false },
  remind: { on: false, lead: 15, billDays: 1, billHour: "09:00", morning: 420, night: 1260, fired: {} },
  remember: [], resetDay: null, resetAt: null,
  people: [],
  upkeep: [],
  routines: [], rdone: {},
  top3: { day: null, items: [], ai: false },
  alarms: [],
  returns: [],
  future: [], futureShow: [],
  payday: { freq: null, next: null, amount: null, d1: 1, d2: 15 }, goals: [],
  leave: { items: LEAVE_DEFAULT.map(text => ({ id: uid(), text })), day: null, done: [] },
  packages: [],
  mail: { on: false, last: null, seen: {}, found: [] },
  notes: [],
  trips: [], tripSel: null, tripTab: "money", tripList: "packing",
  money: { type: "hourly", salary: 0, spends: [] },
  work: { rate: 0, taxPct: 20, otAfter: 40, shifts: [], clockIn: null },
});
let S;                     // loaded at start-up, after the date helpers exist
let WXDATA = null;          // { here, from, to } weather payloads (not stored)
let VIEW = null;            // the day the schedule shows (YYYY-MM-DD)
let LAST_DAY = null;        // today() at the last render - spots midnight
let QA_TYPE = "event";
let UNDO = null, toastTimer = null;
let GTOKEN = null, GTOKEN_EXP = 0, gisLoading = null;

function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE) || "{}"); }
  catch (e) { s = {}; }
  return normalize(s);
}
// Start-up AND restore/import both come through here (v0.17 restore skipped it,
// so an old backup could stop reminders). Bad or old-shape data is repaired
// rather than allowed to blank the app: one broken entry is dropped, not fatal.
function normalize(raw) {
  const s = Object.assign(blank(), raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {});
  const obj = v => v && typeof v === "object" && !Array.isArray(v);
  const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isT = v => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
  ["events", "todos", "loads", "jobs", "bills", "countdowns", "lists", "hidden", "collapsed", "packages", "notes", "trips"]
    .forEach(k => { s[k] = Array.isArray(s[k]) ? s[k].filter(x => x != null && (typeof x === "string" ? ["hidden", "collapsed"].includes(k) : typeof x === "object")) : []; });
  s.events = s.events.filter(e => isDay(e.day) && (!e.time || isT(e.time)));
  s.loads = s.loads.filter(x => isDay(x.day) && isT(x.time));
  s.jobs = s.jobs.filter(x => isDay(x.day) && isT(x.time));
  s.countdowns = s.countdowns.filter(c => isDay(c.date));
  s.bills = s.bills.filter(b => Number(b.day) >= 1 && Number(b.day) <= 31);
  s.bills.forEach(b => { b.day = Number(b.day); });
  s.lists = s.lists.filter(l => l.id).map(l => ({ ...l, items: Array.isArray(l.items) ? l.items : [] }));
  if (!s.lists.length) s.lists = blank().lists;
  if (!s.lists.some(l => l.id === s.listSel)) s.listSel = s.lists[0].id;
  if (!PACKS[s.pack]) s.pack = "general";
  if (!obj(s.route)) s.route = blank().route;
  s.people = (Array.isArray(s.people) ? s.people : []).filter(x => obj(x) && typeof x.name === "string" && /^\d{2}-\d{2}$/.test(x.md || ""));
  s.people.forEach(x => { if (!obj(x.got)) x.got = {}; x.lead = Number(x.lead ?? 14) || 0; });
  s.upkeep = (Array.isArray(s.upkeep) ? s.upkeep : []).filter(x => obj(x) && x.name && ["home", "auto"].includes(x.area) && Number(x.every) > 0
    && ["days", "weeks", "months", "years"].includes(x.unit) && (isDay(x.next) || isDay(x.last)));
  s.payday = Object.assign({ freq: null, next: null, amount: null, d1: 1, d2: 15 }, obj(s.payday) ? s.payday : {});
  if (s.payday.freq && !isDay(s.payday.next)) s.payday.freq = null;
  s.goals = (Array.isArray(s.goals) ? s.goals : []).filter(g => obj(g) && g.name).map(g => ({ ...g, target: Number(g.target) || 0, saved: Number(g.saved) || 0 }));
  s.routines = (Array.isArray(s.routines) ? s.routines : []).filter(r => obj(r) && r.name && Array.isArray(r.steps));
  s.routines.forEach(r => { r.steps = r.steps.filter(x => obj(x) && x.text); if (!Array.isArray(r.days)) r.days = []; if (r.time && !isT(r.time)) r.time = null; });
  if (!obj(s.rdone)) s.rdone = {};
  s.future = (Array.isArray(s.future) ? s.future : []).filter(f => obj(f) && f.text).map(f => ({ ...f, words: Array.isArray(f.words) ? f.words : [] }));
  if (!Array.isArray(s.futureShow)) s.futureShow = [];
  s.returns = (Array.isArray(s.returns) ? s.returns : []).filter(r => obj(r) && r.what && isDay(r.by));
  s.alarms = (Array.isArray(s.alarms) ? s.alarms : []).filter(a => obj(a) && isT(a.time)).map(a => ({ ...a, days: Array.isArray(a.days) ? a.days : [], on: a.on !== false }));
  s.top3 = Object.assign({ day: null, items: [], ai: false }, obj(s.top3) ? s.top3 : {});
  if (!Array.isArray(s.top3.items)) s.top3.items = [];
  s.leave = Object.assign({ items: null, day: null, done: [] }, obj(s.leave) ? s.leave : {});
  if (!Array.isArray(s.leave.items)) s.leave.items = LEAVE_DEFAULT.map(text => ({ id: uid(), text }));
  if (!Array.isArray(s.leave.done)) s.leave.done = [];
  s.remember = (Array.isArray(s.remember) ? s.remember : []).filter(r => obj(r) && isDay(r.day) && r.day >= addDays(today(), -7));
  // v0.2 bills stored paid = null; v0.3 reads paid as "paid THROUGH this month",
  // so null would show last month's bill as late. Treat old bills as current.
  const pm = prevMonthKey();
  s.bills.forEach(b => { if (!b.paid) b.paid = pm; });
  s.gcal = Object.assign(blank().gcal, obj(s.gcal) ? s.gcal : {});
  if (!Array.isArray(s.gcal.events)) s.gcal.events = [];
  s.work = Object.assign(blank().work, obj(s.work) ? s.work : {});
  s.work.shifts = Array.isArray(s.work.shifts) ? s.work.shifts.filter(x => obj(x) && isDay(x.day) && isT(x.start) && isT(x.end)) : [];
  s.sync = Object.assign(blank().sync, obj(s.sync) ? s.sync : {});
  s.remind = Object.assign(blank().remind, obj(s.remind) ? s.remind : {});
  if (!obj(s.remind.fired)) s.remind.fired = {};
  s.money = Object.assign(blank().money, obj(s.money) ? s.money : {});
  if (!Array.isArray(s.money.spends)) s.money.spends = [];
  s.mail = Object.assign(blank().mail, obj(s.mail) ? s.mail : {});
  if (!obj(s.mail.seen)) s.mail.seen = {};
  if (!Array.isArray(s.mail.found)) s.mail.found = [];
  return s;
}
function saveLocal() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* private mode */ }
}
// Every change is saved on the phone at once; with backup on it also goes to
// the user's Drive a few seconds later (one upload per burst of edits).
function save() {
  S.updatedAt = new Date().toISOString();
  if (S.sync && S.sync.on) { S.sync.dirty = true; scheduleBackup(); }
  scheduleGcalPush();
  saveLocal();
}

// ---------------------------------------------------------------- dates
// LOCAL date. v0.1 used toISOString() = UTC, so after 7 PM Central "today" was
// already tomorrow and evening entries landed on the wrong day.
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const today = () => ymd(new Date());
const nowT = () => hhmm(new Date());
const parseDay = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return ymd(d); };
const daysUntil = iso => { const a = new Date(); a.setHours(0, 0, 0, 0); return Math.round((parseDay(iso) - a) / 86400000); };
const prettyDate = iso => parseDay(iso).toLocaleDateString([], { month: "short", day: "numeric" });
const longDate = iso => parseDay(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
const dayName = iso => { const n = daysUntil(iso);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : parseDay(iso).toLocaleDateString([], { weekday: "long" }); };
const inDays = n => n < 0 ? `${-n} day${n === -1 ? "" : "s"} late` : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
function prevMonthKey() { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)).slice(0, 7); }
const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
const hm = t => { if (!t) return ""; const [h, m] = t.split(":").map(Number); const d = new Date(); d.setHours(h, m);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* no haptics */ } };

function cardOrder() {
  const want = [...BASE, ...(MODE === "cruise" ? [] : PACKS[S.pack].cards)];
  let order = (S.order || []).filter(k => want.includes(k));
  // A card new in this version goes to its DEFAULT place, not to the bottom
  // of someone's saved order.
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
const wxIcon = (c, isDay = 1) => (!isDay && (c === 0 || c === 1)) ? ["🌙", wmo(c)[1]] : (!isDay && c === 2) ? ["☁️", wmo(c)[1]] : wmo(c);

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
  const q = `latitude=${place.lat}&longitude=${place.lon}` +
            `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,weather_code,wind_gusts_10m_max` +
            `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=6`;
  const j = await (await fetch(`${WX}?${q}`)).json();
  const now = j.current.temperature_2m;
  const H = j.hourly, hrs = H.time || [];
  const nowHour = String(j.current.time || "").slice(0, 13);
  const start = Math.max(0, hrs.findIndex(t => t.slice(0, 13) >= nowHour));
  const hourly = hrs.slice(start, start + 12).map((t, k) => { const i = start + k;
    return { t, temp: H.temperature_2m[i], code: H.weather_code[i], rain: H.precipitation_probability[i] ?? 0, isDay: H.is_day[i] }; });
  // First hour from NOW, still today, with a 50%+ rain chance.
  let rainFrom = null;
  for (let i = start; i < hrs.length && hrs[i].slice(0, 10) === j.daily.time[0]; i++)
    if ((H.precipitation_probability[i] ?? 0) >= 50) { rainFrom = hrs[i]; break; }
  const D = j.daily;
  const days = D.time.map((d, i) => ({ d, hi: D.temperature_2m_max[i], lo: D.temperature_2m_min[i],
    rain: D.precipitation_probability_max[i] ?? 0, code: D.weather_code[i], gust: (D.wind_gusts_10m_max || [])[i] ?? null }));
  const byHour = {};                                            // "YYYY-MM-DDTHH" -> that hour (weather intelligence)
  hrs.forEach((t, i) => { byHour[t.slice(0, 13)] = { rain: H.precipitation_probability[i] ?? 0, temp: H.temperature_2m[i], code: H.weather_code[i] }; });
  // The daily high/low come from a different model run than "now", so they can
  // read 92 while it is 93 out. Never show a high below (or a low above) now.
  days[0].hi = Math.max(days[0].hi, now); days[0].lo = Math.min(days[0].lo, now);
  return { label: place.label, cur: j.current, hourly, days, byHour,
    day: { hi: days[0].hi, lo: days[0].lo, rain: days[0].rain, code: days[0].code,
           sunrise: D.sunrise[0], sunset: D.sunset[0], rainFrom } };
}

let WX_AT = 0;
async function loadWeather() {
  WX_AT = Date.now();
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
  if (briefOpen()) showBrief();
}

// ------------------------------------------------------- google calendar
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisLoading || (gisLoading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = res; s.onerror = () => { gisLoading = null; rej(new Error("blocked")); };
    document.head.appendChild(s);
  }));
}
const gReady = () => GTOKEN && Date.now() < GTOKEN_EXP;

// Must run from a tap: Google opens its own sign-in window.
async function gcalConnect() {
  if (!can("gcal")) { toast("Google Calendar sync is part of Day Hub Pro"); return; }
  if (!GCAL_CLIENT_ID) { toast("Google Calendar link is being set up — coming soon"); return; }
  try { await loadGis(); } catch (e) { toast("Couldn't reach Google — check your connection"); return; }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID, scope: GCAL_SCOPE, prompt: S.gcal.connected && S.gcal.scope === GCAL_SCOPE && !S.gcal.needsWrite ? "" : "consent",
    callback: async r => {
      if (r.error) { toast("Google sign-in was cancelled"); return; }
      GTOKEN = r.access_token; GTOKEN_EXP = Date.now() + ((r.expires_in || 3600) - 60) * 1000; saveTokens();
      if (!google.accounts.oauth2.hasGrantedAllScopes(r, GCAL_SCOPE)) { toast("Day Hub needs the calendar box ticked — tap Connect again and tick it"); GTOKEN = null; return; }
      S.gcal.connected = true; S.gcal.scope = GCAL_SCOPE; S.gcal.needsWrite = false; setAutoState({ at: 0, off: false }); save();
      await gcalFetch(); await gcalPush(); gcalDates(true);
    },
  });
  client.requestAccessToken();
}

async function gcalFetch(quiet) {
  if (!gReady()) { render(); return; }
  const from = parseDay(today()); from.setDate(from.getDate() - 1);
  const to = new Date(from); to.setDate(to.getDate() + 16);
  const u = "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime" +
            `&maxResults=250&timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}`;
  try {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${GTOKEN}` } });
    if (r.status === 401) { GTOKEN = null; render(); return; }
    const j = await r.json();
    // Day Hub's own copies are already on the schedule - don't show them twice.
    S.gcal.events = (j.items || []).filter(e => e.status !== "cancelled" && !((e.extendedProperties || {}).private || {}).dayhubApp).map(e => {
      const allDay = !e.start.dateTime;
      const s = allDay ? parseDay(e.start.date) : new Date(e.start.dateTime);
      return { id: e.id, title: e.summary || "(busy)", day: ymd(s), time: allDay ? null : hhmm(s),
               end: e.end && e.end.dateTime ? hhmm(new Date(e.end.dateTime)) : null, where: e.location || "" };
    });
    S.gcal.fetched = new Date().toISOString(); saveLocal(); render();
    if (!quiet) toast("Google Calendar synced ✓");
  } catch (e) { if (!quiet) toast("Google Calendar didn't answer — try again"); }
}

// ------------------------------------ Day Hub -> Google Calendar (two-way)
// Scott 10/2: "it needs to link to phone calendar as well" (Samsung). A web app
// cannot write the phone's calendar, but the phone shows Google Calendar - so
// Day Hub's events, bills and shifts are written THERE, alarms included, and
// ring even with Day Hub closed. STATELESS: each Google copy carries its Day
// Hub key + a content hash (private extended properties), so a new phone or a
// restored backup finds its own copies instead of making duplicates.
// Google's token lasts ~1 h and is never stored; changes made later wait for
// one tap on "Sync Google Calendar" (same as the Drive backup).
let gPushTimer = null, gPushing = false;
const GTZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago"; } catch (e) { return "America/Chicago"; } })();
function scheduleGcalPush() {
  if (!S.gcal || !S.gcal.connected) return;
  S.gcal.dirty = true;
  if (!gReady()) return;
  clearTimeout(gPushTimer); gPushTimer = setTimeout(gcalPush, 3000);
}
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
function rruleFor(x) {
  const md = Number(x.day.slice(8)), feb29 = x.day.slice(5) === "02-29";
  return { daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY",
    monthly: md > 28 ? `FREQ=MONTHLY;${mdRule(md)}` : "FREQ=MONTHLY", yearly: feb29 ? `FREQ=YEARLY;BYMONTH=2;${mdRule(29)}` : "FREQ=YEARLY" }[x.rep] || null;
}
// What Google should hold, keyed by Day Hub item. One-time items older than 30
// days are left alone (not sent, and their Google copy is never deleted).
function gcalWanted() {
  const out = {}, old = addDays(today(), -30), lead = Number(S.remind.lead) || 15;
  const timed = (day, t, mins) => { const e = new Date(atMs(day, t) + mins * 60000);
    return [{ dateTime: `${day}T${t}:00`, timeZone: GTZ }, { dateTime: `${ymd(e)}T${hhmm(e)}:00`, timeZone: GTZ }]; };
  const allDay = day => [{ date: day }, { date: addDays(day, 1) }];
  const put = (key, summary, location, [start, end], rule, skip, mins) => {
    const recurrence = rule ? [`RRULE:${rule}`, ...(skip || []).map(d => start.date
      ? `EXDATE;VALUE=DATE:${d.replace(/-/g, "")}` : `EXDATE;TZID=${GTZ}:${d.replace(/-/g, "")}T${start.dateTime.slice(11).replace(/:/g, "")}`)] : undefined;
    out[key] = { summary, location: location || "", start, end, ...(recurrence ? { recurrence } : {}),
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: mins }] } };
  };
  S.events.forEach(e => { const rule = rruleFor(e); if (!rule && e.day < old) return;
    put(`ev:${e.id}`, e.title, e.where, e.time ? timed(e.day, e.time, 60) : allDay(e.day), rule, e.skip, e.time ? lead : 900); });
  S.work.shifts.forEach(x => { if (x.day < old) return;
    put(`sh:${x.id}`, "💼 Work shift", "", timed(x.day, x.start, Math.round(shiftHours({ ...x, brk: 0 }) * 60) || 60), null, null, lead); });
  S.people.forEach(p => { const d = personNext(p);
    put(`pp:${p.id}`, `${PKIND[p.kind] || "⭐"} ${p.kind === "birthday" ? `${p.name}'s birthday` : p.name}`, "", allDay(d),
        p.md === "02-29" ? `FREQ=YEARLY;BYMONTH=2;${mdRule(29)}` : "FREQ=YEARLY", null, p.lead > 0 ? Math.min(p.lead, 28) * 1440 - 540 : 900); });
  S.bills.forEach(b => { const due = nextDue(b); if (!due) return;
    put(`bill:${b.id}`, `💳 ${b.name} due ${money(b.amount)}`, "", allDay(due), `FREQ=MONTHLY;${mdRule(b.day)}`, null, 900); });
  return out;
}
// Is this Day Hub item still there at all? (Aged-out is not deleted.)
function gcalItemExists(key) {
  const [k, id] = key.split(":");
  return k === "ev" ? S.events.some(e => e.id === id) : k === "sh" ? S.work.shifts.some(x => x.id === id)
       : k === "bill" ? S.bills.some(b => b.id === id) : k === "pp" ? S.people.some(p => p.id === id) : false;
}
async function gcalPush() {
  if (!S.gcal.connected || !gReady() || gPushing) return;
  gPushing = true;
  const api = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const call = async (method, url, body) => {
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${GTOKEN}`, "Content-Type": "application/json" },
                                 body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 || r.status === 403) { const err = new Error("auth"); err.status = r.status; throw err; }
    if (!r.ok && !(method === "DELETE" && (r.status === 404 || r.status === 410))) throw new Error(`${method} ${r.status}`);
    return r.status === 204 || method === "DELETE" ? null : r.json();
  };
  try {
    const have = {}; let page = "";
    do {
      const j = await call("GET", `${api}?privateExtendedProperty=${encodeURIComponent("dayhubApp=1")}&maxResults=2500&showDeleted=false${page ? "&pageToken=" + encodeURIComponent(page) : ""}`);
      (j.items || []).forEach(e => { const p = (e.extendedProperties || {}).private || {}; if (p.dayhubKey) have[p.dayhubKey] = { id: e.id, h: p.dayhubHash }; });
      page = j.nextPageToken || "";
    } while (page);
    const want = gcalWanted(); let n = 0;
    for (const [key, body] of Object.entries(want)) {
      const h = hashStr(JSON.stringify(body));
      const full = { ...body, extendedProperties: { private: { dayhubApp: "1", dayhubKey: key, dayhubHash: h } } };
      if (!have[key]) { await call("POST", api, full); n++; }
      else if (have[key].h !== h) { await call("PUT", `${api}/${encodeURIComponent(have[key].id)}`, full); n++; }
    }
    for (const [key, g] of Object.entries(have))
      if (!want[key] && !gcalItemExists(key)) { await call("DELETE", `${api}/${encodeURIComponent(g.id)}`); n++; }
    S.gcal.dirty = false; S.gcal.needsWrite = false; S.gcal.pushed = new Date().toISOString(); saveLocal();
    if (n) toast(`📅 ${n} change${n === 1 ? "" : "s"} sent to your phone calendar`);
  } catch (e) {
    // 403 = the old read-only permission: the next Connect asks for "edit events".
    if (e.status === 403) { S.gcal.needsWrite = true; saveLocal(); toast("One more tap: Sync Google Calendar, then Allow — so Day Hub can add events"); }
    else if (!e.status) toast("Couldn't reach Google Calendar — your changes will go next sync");
    if (e.status) GTOKEN = null;
  } finally { gPushing = false; render(); }
}

// ------------------------------------------------------------ sync on open
// Scott 10/2: "MAKE THING SYNC WHEN APP OPENS SO ALWAYS UPDATED". Every open
// (and every return to the app) pulls/pushes everything it can: weather, the
// update check, Google Calendar both ways, the Drive backup (a newer copy from
// another device comes in by itself) and email. Google's sign-in lasts about an
// hour and a web app cannot renew it in the background, so the tokens are kept
// across closing/reopening (this phone only, never backed up) and, once they
// run out, ONE tap ("🔄 Tap to sync") renews all three Google links together.
const TOK_KEY = "dayhub.gtok";
function saveTokens() {
  try { localStorage.setItem(TOK_KEY, JSON.stringify({ g: [GTOKEN, GTOKEN_EXP], d: [DTOKEN, DTOKEN_EXP], m: [MTOKEN, MTOKEN_EXP] })); } catch (e) { /* private mode */ }
}
function loadTokens() {
  try {
    const t = JSON.parse(localStorage.getItem(TOK_KEY) || "{}"), now = Date.now(), ok = x => Array.isArray(x) && x[0] && x[1] > now;
    if (ok(t.g)) [GTOKEN, GTOKEN_EXP] = t.g;
    if (ok(t.d)) [DTOKEN, DTOKEN_EXP] = t.d;
    if (ok(t.m)) [MTOKEN, MTOKEN_EXP] = t.m;
  } catch (e) { /* none kept */ }
}
// Which Google links are on but signed out (they need the one tap).
const needTap = () => [S.gcal.connected && !gReady() && "gcal", S.sync.on && !dReady() && "sync", S.mail.on && !mReady() && can("mail") && "mail"].filter(Boolean);
let LAST_SYNC = 0;
async function syncDrive() {
  try {
    const cloud = await driveDownload();
    const newer = cloud && hasData(cloud.data) && cloud.savedAt > (S.sync.last || "");
    if (newer && !S.sync.dirty) { restoreFrom(cloud); return; }           // changed on another device
    if (newer) { CLOUD_PENDING = cloud; toast("Day Hub changed on another device too — ⚙ Backup to choose"); return; }
    if (S.sync.dirty) await driveUpload();
  } catch (e) { /* stays dirty; next open tries again */ }
}
async function syncOnOpen(force) {
  if (!force && Date.now() - LAST_SYNC < 60000) return;
  LAST_SYNC = Date.now();
  if (Date.now() - WX_AT > 15 * 60000) loadWeather();
  checkUpdate();
  if (S.gcal.connected && gReady()) { await gcalFetch(true); await gcalPush(); gcalDates(); }
  if (S.sync.on && dReady()) await syncDrive();
  if (S.mail.on && mReady() && can("mail")) scanMail();
  if (MODE !== "cruise" && S.top3.day !== today() && new Date().getHours() >= 4 && (S.name || hasData(S)) && !S.hidden.includes("top3")) top3Pick();
  render();
}
// ZERO-TAP renew (Scott 10/2: "still need calendar to auto sync on open").
// A popup needs a tap, but a full-page redirect does not: on open, when a
// Google link is on and its hour is up, Day Hub hops to Google with
// prompt=none and Google sends a fresh sign-in straight back (no screen, no
// tap) as long as the phone's Chrome is signed in to Google. One short flash,
// at most once an hour. If Google says it needs the person (signed out /
// permission removed), it stops trying until the next "Tap to sync" - never
// a redirect loop (one try per 10 minutes at most).
// NEEDS: this page's address in the Google client's "Authorized redirect URIs".
const AUTO_KEY = "dayhub.autoauth";
const autoState = () => { try { return JSON.parse(localStorage.getItem(AUTO_KEY) || "{}"); } catch (e) { return {}; } };
const setAutoState = st => { try { localStorage.setItem(AUTO_KEY, JSON.stringify(st)); } catch (e) { /* private mode */ } };
const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");
function autoScopes() {
  return [S.gcal.connected && S.gcal.scope === GCAL_SCOPE && !gReady() && GCAL_SCOPE, S.sync.on && !dReady() && DRIVE_SCOPE,
          S.mail.on && !mReady() && can("mail") && GMAIL_SCOPE].filter(Boolean);
}
function autoRenew() {
  if (!GCAL_CLIENT_ID || navigator.onLine === false || !/^https?:/.test(location.protocol)) return false;
  const scopes = autoScopes(), st = autoState();
  if (!scopes.length || st.off || Date.now() - (st.at || 0) < 10 * 60000) return false;
  const busy = ["qa", "sheet"].some(id => { const el = document.getElementById(id); return el && !el.classList.contains("hidden"); });
  if (busy) return false;                                       // never yank someone out of a form
  setAutoState({ ...st, at: Date.now() });
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  Object.entries({ client_id: GCAL_CLIENT_ID, redirect_uri: redirectUri(), response_type: "token", scope: scopes.join(" "),
    prompt: "none", include_granted_scopes: "true", state: "dh-auto" }).forEach(([k, v]) => u.searchParams.set(k, v));
  location.replace(u.toString());
  return true;
}
// Back from Google: take the token out of the address and tidy the address.
function takeRedirectToken() {
  if (!/state=dh-auto/.test(location.hash)) return;
  const h = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname + location.search);
  const st = autoState();
  if (h.get("error") || !h.get("access_token")) { setAutoState({ ...st, off: true, why: h.get("error") || "no token" }); return; }
  const tok = h.get("access_token"), exp = Date.now() + ((Number(h.get("expires_in")) || 3600) - 60) * 1000;
  const got = (h.get("scope") || "").split(/\s+/);
  if (got.includes(GCAL_SCOPE)) { GTOKEN = tok; GTOKEN_EXP = exp; }
  if (got.includes(DRIVE_SCOPE)) { DTOKEN = tok; DTOKEN_EXP = exp; }
  if (got.includes(GMAIL_SCOPE)) { MTOKEN = tok; MTOKEN_EXP = exp; }
  saveTokens(); setAutoState({ at: st.at || 0, off: false });
}

// The one tap: a single Google window for every link that is on.
async function syncTap() {
  const want = needTap(); if (!want.length) { syncOnOpen(true); return; }
  const scopes = { gcal: GCAL_SCOPE, sync: DRIVE_SCOPE, mail: GMAIL_SCOPE };
  try { await loadGis(); } catch (e) { toast("Couldn't reach Google — check your connection"); return; }
  google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID, scope: want.map(k => scopes[k]).join(" "), prompt: "", include_granted_scopes: true,
    callback: r => {
      if (r.error) { toast("Google sign-in was cancelled"); return; }
      const exp = Date.now() + ((r.expires_in || 3600) - 60) * 1000, has = sc => google.accounts.oauth2.hasGrantedAllScopes(r, sc);
      if (has(GCAL_SCOPE)) { GTOKEN = r.access_token; GTOKEN_EXP = exp; }
      if (has(DRIVE_SCOPE)) { DTOKEN = r.access_token; DTOKEN_EXP = exp; }
      if (has(GMAIL_SCOPE)) { MTOKEN = r.access_token; MTOKEN_EXP = exp; }
      saveTokens(); setAutoState({ at: 0, off: false }); toast("Syncing…"); syncOnOpen(true);
    },
    error_callback: () => toast("Sign-in window closed"),
  }).requestAccessToken();
}

// ------------------------------------------------------ smart morning brief
// Scott 10/2 ("now morning brief"): the signature Day Hub screen. First open
// of the morning (4-11 AM) it fills the screen: a spoken-style summary, the
// weather with what to bring, today's plan, top to-dos, money and packages,
// 📌 notes from last night's reset - and 🔊 reads it out loud.
function briefLines() {
  const t = today(), w = WXDATA && WXDATA.here, items = dayItems(t), plans = items.filter(isPlan), s = [];
  if (w && w.cur) {
    s.push(`It's ${Math.round(w.cur.temperature_2m)}° and ${wmo(w.cur.weather_code)[1]}, with a high of ${Math.round(w.day.hi)}°` +
      (w.day.rainFrom ? ` — rain likely after ${fmtTime(w.day.rainFrom)}.` : w.day.rain < 20 ? " and no rain." : "."));
  }
  wxAlerts(t).slice(0, 2).forEach(a => s.push(a.text.replace(/[“”]/g, "") + "."));
  const todo = S.todos.filter(x => todoShown(x) && !todoDone(x)).length;
  s.push(plans.length || todo ? `You have ${plans.length ? `${plans.length} thing${plans.length === 1 ? "" : "s"} on the schedule` : "nothing on the schedule"}${todo ? ` and ${todo} to-do${todo === 1 ? "" : "s"}` : ""}.`
    : "Your day is wide open.");
  const f = plans.find(i => i.t && i.t >= nowT());
  if (f) s.push(`Your first one is at ${hm(f.t)}: ${f.title}.`);
  S.remember.filter(r => r.day === t).forEach(r => s.push(`You asked to remember: ${r.text}.`));
  S.future.filter(f => f.day === t).forEach(f => s.push(`Future you said: ${f.text}`));
  { const nx = payNext(); if (nx) { const n = daysUntil(nx);
      if (n === 0) { const c = dueBetween(nx, payAfter(nx)); s.push(`Payday today — ${c.length} bill${c.length === 1 ? "" : "s"} (${money(c.reduce((x, o) => x + o.amt, 0))}) before the next check.`); }
      else if (n <= 3) { const b = dueBetween(today(), nx); s.push(`Payday ${inDays(n)}${b.length ? ` — ${money(b.reduce((x, o) => x + o.amt, 0))} in bills due before then` : ""}.`); } } }
  upkeepDue(null, 0).forEach(({ x, day }) => s.push(`${x.name.replace(/^\S+\s/, "")} ${x.auto ? "is today" : daysUntil(day) < 0 ? "is overdue" : "is due today"}.`));
  upcomingPeople(14).forEach(({ p, day }) => { const n = daysUntil(day);
    if (n === 0) s.push(`Today is ${personLabel(p, day)}.`); else if (giftDue(p, day)) s.push(`${personLabel(p, day)} is ${inDays(n)} — got a gift?`); });
  { const ex = leaveExtras(); if (ex.length) s.push(`Don't forget: ${ex.map(x => x.text.replace(/^\S+\s/, "").toLowerCase()).join(", ")}.`); }
  upcomingBills().filter(b => daysUntil(b.due) <= 2).forEach(b => s.push(`${b.name} (${money(b.amount)}) is ${daysUntil(b.due) < 0 ? "late" : "due " + inDays(daysUntil(b.due))}.`));
  const pk = items.filter(i => i.kind === "pkg").length;
  if (pk) s.push(`${pk} package${pk === 1 ? " is" : "s are"} arriving today.`);
  // Every countdown (Scott 10/2: "on any count downs it should show in morning breifing") - and trips count down too.
  const cds = briefCountdowns(), todayCd = cds.filter(c => c.n === 0), ahead = cds.filter(c => c.n > 0);
  todayCd.forEach(c => s.push(`Today's the day: ${c.title}! 🎉`));
  openReturns().filter(r => daysUntil(r.by) >= 0 && daysUntil(r.by) <= 3).forEach(r => s.push(`Return ${r.what} — ${retWhen(r)}.`));
  { const es = errandStops(); if (es.length >= 2) s.push(`Errand run: ${es.map(st => (st.brand || st.name).toLowerCase()).join(", then ")}.`); }
  if (S.top3.day === t && S.top3.items.length) s.push(`Your top ${S.top3.items.length}: ${S.top3.items.map(x => x.title).join("; ")}.`);
  if (ahead.length) s.push(`Counting down: ${ahead.map(c => `${c.n} day${c.n === 1 ? "" : "s"} until ${c.title}`).join(", ")}.`);
  return s;
}
function briefCountdowns() {
  const out = liveCountdowns().map(c => ({ title: c.title, day: c.date, n: daysUntil(c.date), icon: "⏳" }));
  S.trips.filter(tr => tr.start && daysUntil(tr.start) >= 0 && !out.some(o => o.day === tr.start && o.title === tr.name))
    .forEach(tr => out.push({ title: tr.name, day: tr.start, n: daysUntil(tr.start), icon: isCruise(tr) ? "🚢" : "✈️" }));
  return out.sort((a, b) => a.day.localeCompare(b.day));
}
const briefOpen = () => { const el = document.getElementById("brief"); return !!el && !el.classList.contains("hidden"); };
function showBrief() {
  let el = document.getElementById("brief");
  if (!el) { el = document.createElement("div"); el.id = "brief"; el.className = "brief"; el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Morning brief"); document.body.appendChild(el); }
  const t = today(), items = dayItems(t), plans = items.filter(isPlan), w = WXDATA && WXDATA.here;
  const todos = S.todos.filter(x => todoShown(x) && !todoDone(x)).slice(0, 3);
  const tips = [];
  if (w && w.day) { if (w.day.rainFrom || w.day.rain >= 50) tips.push("☔ take an umbrella"); if (w.day.lo <= 40) tips.push("🧥 grab a jacket"); if (w.day.hi >= 92) tips.push("🥵 bring water"); }
  const sec = (title, body) => body ? `<section class="brief-sec"><h3>${title}</h3>${body}</section>` : "";
  el.innerHTML = `<div class="brief-body">
    <div class="brief-date">${esc(longDate(t))}</div>
    <h1>☀️ Good morning${S.name ? ", " + esc(S.name) : ""}</h1>
    <p class="brief-say">${briefLines().map(esc).join(" ")}</p>
    <button class="btn sm ghost" data-brief="speak">🔊 Read it to me</button>
    ${sec("Weather", w && w.cur ? `<div class="brief-wx"><span class="big">${wmo(w.cur.weather_code)[0]} ${Math.round(w.cur.temperature_2m)}°</span>
       <span>H ${Math.round(w.day.hi)}° · L ${Math.round(w.day.lo)}°${w.day.rainFrom ? `<br>Rain from ${esc(fmtTime(w.day.rainFrom))}` : w.day.rain >= 20 ? `<br>Rain ${w.day.rain}%` : "<br>No rain"}</span></div>
       ${tips.length ? `<div class="sub">${tips.join(" · ")}</div>` : ""}` : "")}
    ${sec("Today", plans.slice(0, 6).map(i => `<div class="row"><span class="time">${i.t ? hm(i.t) : "All day"}</span><span class="grow">${i.icon} ${esc(i.title)}</span></div>`).join(""))}
    ${sec("Countdowns", briefCountdowns().map(c => `<div class="row"><span class="cd-n">${c.n === 0 ? "🎉" : c.n}</span><span class="grow">${c.icon} ${esc(c.title)}
        <span class="sub">${c.n === 0 ? "today!" : `${c.n === 1 ? "day" : "days"} to go · ${prettyDate(c.day)}`}</span></span></div>`).join(""))}
    ${sec("Top to-dos", todos.map(x => `<div class="row"><span class="grow">✅ ${esc(x.title)}</span></div>`).join(""))}
    ${sec("Heads up", [...wxAlerts(t).map(a => `${a.icon} ${esc(a.text)}`),
        ...upcomingPeople(14).filter(({ p, day }) => daysUntil(day) === 0 || giftDue(p, day)).map(({ p, day }) => `${PKIND[p.kind] || "⭐"} ${esc(personLabel(p, day))} — ${daysUntil(day) === 0 ? "today!" : inDays(daysUntil(day)) + " · 🎁 gift?"}`),
        ...leaveExtras().map(x => `🚪 ${esc(x.text)} <span class="sub">${esc(x.why)}</span>`), ...S.remember.filter(r => r.day === t).map(r => `📌 ${esc(r.text)}`),
        ...upcomingBills().filter(b => daysUntil(b.due) <= 2).map(b => `💳 ${esc(b.name)} ${money(b.amount)} — ${daysUntil(b.due) < 0 ? "late" : inDays(daysUntil(b.due))}`),
        ...items.filter(i => i.kind === "pkg").map(i => `📦 ${esc(i.title)}`)].map(x => `<div class="today-line">${x}</div>`).join(""))}
    <button class="btn brief-go" data-brief="go">Start my day →</button>
    <label class="brief-auto"><input type="checkbox" data-briefauto ${S.briefAuto === false ? "" : "checked"}> Show this when I open Day Hub in the morning</label>
  </div>`;
  el.classList.remove("hidden");
}
function closeBrief() {
  const el = document.getElementById("brief"); if (el) el.classList.add("hidden");
  try { speechSynthesis.cancel(); } catch (e) { /* no speech */ }
}
function maybeBrief() {
  const h = new Date().getHours();
  if (MODE === "cruise" || S.briefAuto === false || !(S.name || hasData(S)) || h < 4 || h >= 11 || S.briefDay === today()) return;
  S.briefDay = today(); saveLocal(); showBrief();
}
function speakBrief() {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance([`Good morning${S.name ? ", " + S.name : ""}.`, ...briefLines()].join(" ").replace(/°/g, " degrees"));
    u.rate = 1; speechSynthesis.speak(u);
  } catch (e) { toast("This phone can't read aloud"); }
}

function gcalDisconnect() {
  try { if (GTOKEN && window.google) google.accounts.oauth2.revoke(GTOKEN, () => {}); } catch (e) { /* already gone */ }
  GTOKEN = null; saveTokens(); S.gcal = { connected: false, events: [], fetched: null }; save(); drawSettings(); render();
  toast("Google Calendar disconnected");
}

// ------------------------------------------------------------ backup & sync
// Scott 2026-10-01 ("yes i do" - backup/sync first). No server and $0: the data
// goes to Google Drive's appDataFolder - a hidden folder ONLY this app can read,
// inside the user's own Drive, not shown in their files. A new phone signs in
// and gets everything back. Google's token lasts about an hour and is never
// stored; after that the next backup waits for one tap ("Back up now").
let DTOKEN = null, DTOKEN_EXP = 0, backupTimer = null, CLOUD_PENDING = null;
const DFILE = "dayhub.json";
const dReady = () => DTOKEN && Date.now() < DTOKEN_EXP;
const hasData = d => !!d && ((d.events || []).length + (d.todos || []).length + (d.bills || []).length +
  (d.countdowns || []).length + ((d.work || {}).shifts || []).length + ((d.money || {}).spends || []).length +
  (d.packages || []).length + (d.trips || []).length + (d.notes || []).length + (d.lists || []).reduce((n, l) => n + (l.items || []).length, 0)) > 0;

function driveSignIn(prompt) {                                 // must run from a tap
  return loadGis().then(() => new Promise(res => {
    const c = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID, scope: DRIVE_SCOPE, prompt,
      callback: r => {
        if (r.error) { toast("Google sign-in was cancelled"); res(false); return; }
        DTOKEN = r.access_token; DTOKEN_EXP = Date.now() + ((r.expires_in || 3600) - 60) * 1000; saveTokens(); res(true);
      },
      error_callback: () => { toast("Sign-in window closed"); res(false); },
    });
    c.requestAccessToken();
  })).catch(() => { toast("Couldn't reach Google — check your connection"); return false; });
}
async function dfetch(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { Authorization: `Bearer ${DTOKEN}`, ...(opt.headers || {}) } });
  if (r.status === 401) { DTOKEN = null; throw new Error("signed out"); }
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return r;
}
async function driveFind() {
  const q = encodeURIComponent(`name='${DFILE}'`);
  const j = await (await dfetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`)).json();
  return (j.files || [])[0] || null;
}
async function driveDownload() {
  const f = await driveFind();
  return f ? (await dfetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json() : null;
}
async function driveUpload() {
  const data = JSON.parse(JSON.stringify(S));
  delete data.gcal;                                            // re-fetched from Google, not ours to copy
  const body = JSON.stringify({ app: "dayhub", v: VERSION, savedAt: new Date().toISOString(), data });
  const f = await driveFind();
  if (f) {
    await dfetch(`https://www.googleapis.com/upload/drive/v3/files/${f.id}?uploadType=media`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
  } else {
    const b = "dayhub" + uid();
    const meta = JSON.stringify({ name: DFILE, parents: ["appDataFolder"] });
    await dfetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` },
      body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
    });
  }
  S.sync.last = new Date().toISOString(); S.sync.dirty = false; saveLocal();
}
function scheduleBackup() {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(async () => {
    if (!dReady()) return;                                     // waits for a tap; "dirty" shows the button
    try { await driveUpload(); drawSyncBox(); } catch (e) { /* stays dirty, retried next change */ }
  }, 6000);
}
// Turning backup on. A new phone (nothing here yet) restores by itself; a phone
// that already has data and finds an older or different backup gets the CHOICE.
async function syncOn() {
  if (!can("sync")) { toast("Backup & sync is part of Day Hub Pro"); return; }
  if (!(await driveSignIn(S.sync.on ? "" : "consent"))) return;
  try {
    const cloud = await driveDownload();
    if (cloud && hasData(cloud.data) && !hasData(S)) { restoreFrom(cloud); return; }
    if (cloud && hasData(cloud.data) && cloud.savedAt > (S.sync.last || "")) {
      S.sync.on = true; saveLocal(); CLOUD_PENDING = cloud; drawSyncBox(); return;
    }
    S.sync.on = true; await driveUpload(); drawSyncBox(); toast("Backed up to your Google Drive ✓");
  } catch (e) { toast("Backup didn't go through — try again"); }
}
async function backupNow() {
  if (!dReady() && !(await driveSignIn(""))) return;
  try { await driveUpload(); drawSyncBox(); render(); toast("Backed up ✓"); }
  catch (e) { toast("Backup didn't go through — try again"); }
}
async function restoreNow() {
  if (!dReady() && !(await driveSignIn(""))) return;
  try { const cloud = await driveDownload(); cloud ? restoreFrom(cloud) : toast("No backup found yet"); }
  catch (e) { toast("Couldn't read the backup — try again"); }
}
function restoreFrom(cloud) {
  snap();
  const keepCal = S.gcal, keepFired = S.remind.fired, keepUI = { collapsed: S.collapsed, briefDay: S.briefDay, briefAuto: S.briefAuto };
  S = normalize(cloud.data);
  // Which cards are open or closed belongs to THIS phone (Scott 10/2: closing
  // the app keeps what you opened or closed) - a backup never changes it.
  Object.assign(S, keepUI);
  // Keep this phone's "already fired" marks: an older backup's marks alone
  // would let a reminder from the last few hours fire a second time.
  S.remind.fired = Object.assign({}, S.remind.fired, keepFired);
  S.gcal = keepCal; S.sync = { on: true, last: cloud.savedAt, dirty: false };
  CLOUD_PENDING = null; saveLocal(); drawSyncBox(); render(); loadWeather();
  toast(`Restored from ${new Date(cloud.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`, true);
}
function syncOff() {
  try { if (DTOKEN && window.google) google.accounts.oauth2.revoke(DTOKEN, () => {}); } catch (e) { /* gone */ }
  DTOKEN = null; CLOUD_PENDING = null; S.sync = { on: false, last: null, dirty: false }; saveLocal(); drawSyncBox();
  toast("Backup turned off — your Drive copy stays until you delete it");
}
function drawSyncBox() {
  const g = document.getElementById("syncBox"); if (!g) return;
  const when = iso => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  g.innerHTML = `<h3>Backup & sync</h3>` + (CLOUD_PENDING
    ? `<p class="fine" style="margin-top:0">Found a backup from <b>${when(CLOUD_PENDING.savedAt)}</b>. Which one do you want?</p>
       <div class="foot-actions"><button class="btn sm" data-sync="use">Use the backup</button>
       <button class="btn sm ghost" data-sync="keep">Keep this phone's</button></div>`
    : S.sync.on
    ? `<div class="leg"><span>☁️ On — ${S.sync.last ? `last backup ${when(S.sync.last)}` : "not backed up yet"}${S.sync.dirty ? " · <b style='color:var(--orange)'>new changes</b>" : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-sync="now">Back up now</button>
       <button class="btn sm ghost" data-sync="restore">Restore</button><button class="btn sm ghost" data-sync="off">Turn off</button></div>`
    : `<p class="fine" style="margin-top:0"><b>⚠️ Not backed up yet</b> — everything is only on this phone. Turn it on once (Scott 10/2: "all we do needs to back up on server"):</p>
       <ol class="steps"><li>Tap <b>Back up to my Google Drive</b>.</li><li>Pick your Google account → <b>Continue</b> → <b>Allow</b>.</li>
         <li>Done — every change saves to Google's servers by itself from then on.</li></ol>
       <button class="btn sm" data-sync="on">☁️ Back up to my Google Drive</button>
       <p class="fine" style="margin-top:8px">Brings everything back on a new or reset phone. Saved in a hidden Day Hub folder in your own Drive — only Day Hub can see it.</p>`);
}

// ------------------------------------------------------------- reminders
// Scott 2026-10-01 "yes start reminders". A web app can only alert while it is
// open or was used recently (phones put idle pages to sleep), so there are TWO
// paths: (1) Day Hub's own heads-up before events / shifts / loads / bills, and
// (2) 📲 on any item puts it in the phone's OWN calendar with an alarm - that
// one rings even when Day Hub is closed. Reliable background alerts need the
// app-store version (or a push server) - noted for Pro.
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const atMs = (day, t) => { const d = parseDay(day); const [h, m] = t.split(":").map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
function reminderList() {
  const R = S.remind, lead = R.lead * 60000, out = [];
  const from = addDays(today(), -1), to = addDays(today(), 2), inWin = d => d >= from && d <= to;
  const add = (key, start, at, title, body) => out.push({ key, start, at, title, body });
  for (let day = from; day <= to; day = addDays(day, 1))
    S.events.filter(e => e.time && occursOn(e, day)).forEach(e => { const st = atMs(day, e.time);
      add(`ev:${e.id}:${day}`, st, st - lead, `📅 ${e.title}`, `${hm(e.time)}${e.where ? " · " + e.where : ""}`); });
  if (S.gcal.connected) S.gcal.events.filter(e => inWin(e.day) && e.time).forEach(e => { const st = atMs(e.day, e.time);
    add(`g:${e.id}:${e.day}`, st, st - lead, `🗓️ ${e.title}`, `${hm(e.time)}${e.where ? " · " + e.where : ""}`); });
  S.work.shifts.filter(x => inWin(x.day)).forEach(x => { const st = atMs(x.day, x.start);
    add(`sh:${x.id}`, st, st - lead, "💼 Work shift", `${hm(x.start)} – ${hm(x.end)}`); });
  ["loads", "jobs"].forEach(k => S[k].filter(x => inWin(x.day) && !x.done).forEach(x => { const st = atMs(x.day, x.time);
    add(`${k}:${x.id}`, st, st - lead, `${k === "loads" ? "🚚" : "🔧"} ${x.title}`, hm(x.time)); }));
  const T1 = addDays(today(), 1), plans = dayItems(T1).filter(isPlan), w1 = WXDATA && WXDATA.here && WXDATA.here.days[1];
  if (plans.length || (w1 && w1.rain >= 50)) {
    const at = atMs(today(), "20:00"), f = plans.find(i => i.t);
    add(`tm:${T1}`, atMs(today(), "23:59"), at, "🌙 Tomorrow",
        [f ? `First up ${hm(f.t)} ${f.title}` : `${plans.length} planned`, w1 && w1.rain >= 50 ? `rain ${w1.rain}%` : ""].filter(Boolean).join(" · "));
  }
  S.trips.forEach(tr => {
    if (tr.finalDue && tripLeft(tr) !== 0) [14, 3, 1, 0].forEach(n => { const d = addDays(tr.finalDue, -n);
      if (inWin(d)) { const at = atMs(d, R.billHour); add(`tf:${tr.id}:${n}`, atMs(d, "23:59"), at,
        `💳 Final payment ${n === 0 ? "due TODAY" : `due in ${n} day${n === 1 ? "" : "s"}`}`,
        `${tr.name}${tripLeft(tr) ? ` — ${money(tripLeft(tr))} left` : ""}. Miss it and the booking can be cancelled.`); } });
    if (tr.end && perksLeft(tr).length) [2, 1].forEach(n => { const d = addDays(tr.end, -n);
      if (inWin(d)) { const at = atMs(d, "10:00"); add(`pk:${tr.id}:${n}`, atMs(d, "23:59"), at, `🎁 Use it before you lose it — ${n} day${n === 1 ? "" : "s"} left`,
        perksLeft(tr).map(x => `${x.name}: ${x.unit === "$" ? money(x.total - x.used) : x.total - x.used} left`).join(" · ")); } });
    (tr.ports || []).filter(pt => inWin(pt.day)).forEach(pt => {
      if (pt.allAboard) (pt.indie ? [90, 60, 30] : [60, 30]).forEach(m => { const aa = atMs(pt.day, pt.allAboard);
        add(`aa:${pt.id}:${m}`, aa, aa - m * 60000, `⚓ Back on the ship by ${hm(pt.allAboard)}`, `${m} minutes — ${pt.name}. The ship will not wait.`); });
      if (pt.meet && pt.excursion && pt.excursion.toLowerCase() !== "none") { const mt = atMs(pt.day, pt.meet);
        add(`ex:${pt.id}`, mt, mt - R.lead * 60000, `🤿 ${pt.excursion}`, `Meet ${hm(pt.meet)}${pt.where ? " at " + pt.where : ""} — ${pt.name}`);
        const lc = mt - (Number(pt.walk) || 15) * 60000;
        add(`lc:${pt.id}`, mt, lc, `⏰ Leave the cabin now`, `${pt.excursion} — meet ${hm(pt.meet)}${pt.where ? " at " + pt.where : ""}. Cruise card + ID!`); }
    });
    if (tr.start) [[7, "check in online + print luggage tags"], [1, "documents, meds and swimsuit in your carry-on"]].forEach(([n, what]) => {
      const d = addDays(tr.start, -n);
      if (inWin(d)) { const at = atMs(d, "10:00"); add(`ts:${tr.id}:${n}`, atMs(d, "23:59"), at,
        `${isCruise(tr) ? "🚢" : "✈️"} ${n === 1 ? "Tomorrow you go" : `${n} days to go`} — ${tr.name}`, what); } });
  });
  if (R.morning >= 0) {
    const at = atMs(today(), `${pad(Math.floor(R.morning / 60))}:${pad(R.morning % 60)}`);
    add(`mb:${today()}`, atMs(today(), "12:00"), at, `☀️ Good morning${S.name ? ", " + S.name : ""}`, morningBrief());
  }
  { const nx = payNext(); if (nx && inWin(nx)) { const c = dueBetween(nx, payAfter(nx));
      add(`pay:${nx}`, atMs(nx, "23:59"), atMs(nx, "08:00"), "💵 Payday", `${c.length} bill${c.length === 1 ? "" : "s"} (${money(c.reduce((x, o) => x + o.amt, 0))}) before the next check${S.goals.length ? " — put a little toward your goals?" : ""}`); } }
  S.routines.filter(r => r.time && rToday(r)).forEach(r => {
    if (rLeft(r)) add(`rt:${r.id}:${today()}`, atMs(today(), r.time) + 3600000, atMs(today(), r.time), `🔁 ${r.name.replace(/^\S+\s/, "")} routine`, `${r.steps.length} steps — tap to start`); });
  openReturns().forEach(r => [3, 1].forEach(n => { const d = addDays(r.by, -n);
    if (inWin(d)) add(`ret:${r.id}:${n}`, atMs(d, "23:59"), atMs(d, R.billHour), `↩️ Return ${r.what} — ${n} day${n === 1 ? "" : "s"} left`, `Last day ${prettyDate(r.by)}${r.store ? ` · ${r.store}` : ""}${r.amount ? ` · ${money(r.amount)} back` : ""}`); }));
  S.upkeep.forEach(x => { const d = upkeepNext(x);
    if (x.auto && inWin(addDays(d, -1))) add(`up:${x.id}:${d}`, atMs(d, "08:00"), atMs(addDays(d, -1), "19:00"), `${x.name} tomorrow`, "Put it out tonight.");
    else if (!x.auto && inWin(d)) add(`up:${x.id}:${d}`, atMs(d, "23:59"), atMs(d, R.billHour), `${x.name} due ${d === today() ? "today" : prettyDate(d)}`, "Tap ✓ Done in Day Hub when it's handled.");
  });
  S.people.forEach(p => {
    for (let day = from; day <= to; day = addDays(day, 1)) {
      if (personOn(p, day)) add(`pp:${p.id}:${day}`, atMs(day, "23:59"), atMs(day, "08:00"), `${PKIND[p.kind] || "⭐"} Today: ${personLabel(p, day)}`, "Call, text or a card?");
      const due = personNext(p);
      if (p.lead > 0 && !p.got[due.slice(0, 4)]) [p.lead, 3].filter((n, i, a) => a.indexOf(n) === i).forEach(n => {
        if (addDays(due, -n) === day) add(`pg:${p.id}:${due}:${n}`, atMs(day, "23:59"), atMs(day, R.billHour), `🎁 ${personLabel(p, due)} in ${n} days`, p.ideas ? `Gift ideas: ${p.ideas}` : "Time to get a gift?"); });
    }
  });
  // Freeze tonight: one heads-up at 6 PM (drip faucets, plants, pets).
  const fz = wxAlerts(today()).find(a => a.key === "freeze");
  if (fz) add(`fz:${today()}`, atMs(today(), "23:59"), atMs(today(), "18:00"), "🥶 Freeze tonight", fz.text.split(" — ")[1] || fz.text);
  if (R.night >= 0 && MODE !== "cruise" && S.resetDay !== today()) {
    const at = atMs(today(), `${pad(Math.floor(R.night / 60))}:${pad(R.night % 60)}`);
    add(`nr:${today()}`, atMs(today(), "23:59"), at, "🛏️ Nightly reset", resetSummary());
  }
  if (R.billDays >= 0) upcomingBills().forEach(b => { const d = addDays(b.due, -R.billDays);
    if (inWin(d)) { const at = atMs(d, R.billHour); add(`bill:${b.id}:${b.due}`, atMs(d, "23:59"), at, `💳 ${b.name} ${money(b.amount)}`, `Due ${prettyDate(b.due)}`); } });
  return out;
}
async function notify(title, body, tag) {
  buzz();
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      const opt = { body, tag, icon: "icon-192.png", badge: "icon-192.png", vibrate: [200, 100, 200], renotify: true };
      if (reg) { await reg.showNotification(title, opt); return; }
      new Notification(title, opt); return;
    } catch (e) { /* fall through to the in-app toast */ }
  }
  toast(`${title} — ${body}`);
}
// Fires anything due in the last 6 hours that has not fired yet (a phone that
// slept through 2:45 still says so at 3:10). Old marks are pruned after 4 days.
async function checkReminders() {
  if (!S.remind.on || !can("reminders")) return;
  const now = Date.now(), F = S.remind.fired; let changed = false;
  for (const r of reminderList()) {
    if (F[r.key] || r.at > now || r.at < now - 6 * 3600000 || r.start < now - 15 * 60000) continue;   // long started = too late to help
    F[r.key] = now; changed = true;
    await notify(r.title, r.start > now ? `${r.body} · in ${Math.max(1, Math.round((r.start - now) / 60000))} min` : r.body, r.key);
  }
  for (const [k, v] of Object.entries(F)) if (now - v > 4 * 86400000) { delete F[k]; changed = true; }
  if (changed) saveLocal();
}
async function remindOn() {
  if (!can("reminders")) { toast("Reminders are part of Day Hub Pro"); return; }
  if (!("Notification" in window)) {
    toast(isIOS() ? "On iPhone: Share → Add to Home Screen, open Day Hub from there, then turn reminders on" : "This browser can't show notifications");
    return;
  }
  const p = await Notification.requestPermission();
  if (p !== "granted") { toast("Notifications are blocked — allow them for Day Hub in your phone settings"); return; }
  S.remind.on = true;
  const now = Date.now();                                       // don't replay what already started
  reminderList().forEach(r => { if (r.start <= now) S.remind.fired[r.key] = now; });
  saveLocal(); drawRemindBox();
  notify("Day Hub reminders are on ✓", `Heads-up ${S.remind.lead} min before events and shifts.`, "dh-on");
  checkReminders();
}
function drawRemindBox() {
  const g = document.getElementById("remindBox"); if (!g) return;
  const R = S.remind;
  const opt = (v, l, cur) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`;
  g.innerHTML = `<h3>Reminders</h3>` + (R.on
    ? `<label class="field" style="margin-top:0">Before events, shifts and jobs
         <select data-rset="lead">${[5, 10, 15, 30, 60, 120].map(m => opt(m, m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`, R.lead)).join("")}</select></label>
       <label class="field">Morning brief
         <select data-rset="morning">${opt(-1, "Off", R.morning)}${[360, 390, 420, 450, 480, 540].map(m => opt(m, `${m / 60 > 12 ? m / 60 - 12 : Math.floor(m / 60)}:${pad(m % 60)} AM`, R.morning)).join("")}</select></label>
       <label class="field">Nightly reset
         <select data-rset="night">${opt(-1, "Off", R.night)}${[1200, 1230, 1260, 1290, 1320, 1350, 1380].map(m => opt(m, `${Math.floor(m / 60) - 12}:${pad(m % 60)} PM`, R.night)).join("")}</select></label>
       <label class="field">Bills
         <select data-rset="billDays">${opt(-1, "Off", R.billDays)}${opt(0, "Morning of the due day", R.billDays)}${opt(1, "Morning, 1 day before", R.billDays)}${opt(3, "Morning, 3 days before", R.billDays)}</select></label>
       <div class="foot-actions" style="margin-top:10px"><button class="btn sm" data-remind="test">Send a test</button><button class="btn sm ghost" data-remind="off">Turn off</button></div>`
    : `<button class="btn sm" data-remind="on">Turn on reminders</button>`) +
    `<p class="fine" style="margin-top:8px">Day Hub's reminders arrive while it's open or used recently. For a can't-miss item, tap 📲 on it — that puts it in your phone's own calendar, which alerts you even when Day Hub is closed.</p>`;
}

// ------------------------------------------------- add to phone calendar (.ics)
function icsFor(ref) {
  const [k, id] = ref.split(":");
  const lead = S.remind.lead || 15;
  const D = (day, t) => `${day.replace(/-/g, "")}T${t.replace(":", "")}00`;
  const plusMin = (day, t, mins) => { const d = new Date(atMs(day, t) + mins * 60000); return [ymd(d), hhmm(d)]; };
  const txt = v => String(v || "").replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
  let ev = null;
  if (k === "events") { const e = S.events.find(x => x.id === id); if (e) { const [ed, et] = plusMin(e.day, e.time, 60);
    const md = Number(e.day.slice(8)), feb29 = e.day.slice(5) === "02-29";
    const rr = { daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY",
      monthly: md > 28 ? `FREQ=MONTHLY;${mdRule(md)}` : "FREQ=MONTHLY", yearly: feb29 ? `FREQ=YEARLY;BYMONTH=2;${mdRule(29)}` : "FREQ=YEARLY" }[e.rep];
    ev = [`SUMMARY:${txt(e.title)}`, e.where ? `LOCATION:${txt(e.where)}` : "", `DTSTART:${D(e.day, e.time)}`,
          `DTEND:${D(ed, et)}${rr ? `\nRRULE:${rr}` : ""}`, `TRIGGER:-PT${lead}M`, e.title]; } }
  else if (k === "loads" || k === "jobs") { const x = S[k].find(y => y.id === id); if (x) { const [ed, et] = plusMin(x.day, x.time, 60);
    ev = [`SUMMARY:${txt(x.title)}`, "", `DTSTART:${D(x.day, x.time)}`, `DTEND:${D(ed, et)}`, `TRIGGER:-PT${lead}M`, x.title]; } }
  else if (k === "shift") { const x = S.work.shifts.find(y => y.id === id); if (x) { const ed = x.end < x.start ? addDays(x.day, 1) : x.day;
    ev = ["SUMMARY:Work shift", "", `DTSTART:${D(x.day, x.start)}`, `DTEND:${D(ed, x.end)}`, `TRIGGER:-PT${lead}M`, "Work shift"]; } }
  else if (k === "bill") { const b = S.bills.find(y => y.id === id); const due = b && nextDue(b); if (due) {
    const nx = addDays(due, 1).replace(/-/g, "");
    ev = [`SUMMARY:${txt(`${b.name} due ${money(b.amount)}`)}`, "", `DTSTART;VALUE=DATE:${due.replace(/-/g, "")}`,
          `DTEND;VALUE=DATE:${nx}\nRRULE:FREQ=MONTHLY;${mdRule(b.day)}`, "TRIGGER:-PT15H", `${b.name} bill`]; } }
  if (!ev) return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  // DESCRIPTION reuses the SUMMARY text, which is already escaped (v0.17
  // escaped it twice: the alarm read "Dinner\, Bob").
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Day Hub//EN", "BEGIN:VEVENT", `UID:${ref.replace(":", "-")}@dayhub`, `DTSTAMP:${stamp}`,
    ev[0], ev[1], ev[2], ev[3], "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${ev[0].slice(8)}`, ev[4], "END:VALARM", "END:VEVENT", "END:VCALENDAR"]
    .filter(Boolean).join("\n").split("\n").map(icsFold).join("\r\n");
  return { text: lines, name: ev[5] };
}
// Day-of-month for an RRULE, clamped the way Day Hub shows it: the 31st = last
// day; the 29th / 30th = that day or the month's last day if it is shorter
// (v0.17 sent -1 for both, so a 30th bill landed on the 31st).
function mdRule(day) {
  if (day <= 28) return `BYMONTHDAY=${day}`;
  if (day >= 31) return "BYMONTHDAY=-1";
  const ds = []; for (let n = 28; n <= day; n++) ds.push(n);
  return `BYMONTHDAY=${ds.join(",")};BYSETPOS=-1`;
}
// RFC 5545: lines over 75 octets are folded (CRLF + space).
function icsFold(line) {
  const enc = new TextEncoder(); let out = "", cur = "", n = 0;
  for (const ch of line) { const b = enc.encode(ch).length;
    if (n + b > (out ? 74 : 75)) { out += (out ? "\r\n " : "") + cur; cur = ""; n = 0; }
    cur += ch; n += b; }
  return out ? out + "\r\n " + cur : cur;
}
function addToPhoneCalendar(ref) {
  const r = icsFor(ref);
  if (!r) { toast("Couldn't find that item"); return; }
  if (isIOS()) { location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(r.text); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([r.text], { type: "text/calendar" }));
  a.download = `${r.name.replace(/[^\w ]+/g, "").trim().slice(0, 40) || "event"}.ics`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast("Open the downloaded file to add it to your calendar");
}

// --------------------------------------------------------------- repeats
// v0.6: events repeat daily / weekdays / weekly / monthly from their first
// date; deleting ONE occurrence adds that day to `skip` (the series stays).
// To-dos repeat daily / weekdays / weekly and simply come back unchecked.
const REPEATS = { none: "Doesn't repeat", daily: "Every day", weekdays: "Weekdays (Mon–Fri)", weekly: "Every week", monthly: "Every month", yearly: "Every year" };   // yearly: Scott 10/1
const isRep = x => x.rep && x.rep !== "none";
function occursOn(x, day) {
  if (day < x.day || (x.skip || []).includes(day)) return false;
  const d = parseDay(day), s0 = parseDay(x.day);
  switch (x.rep || "none") {
    case "daily": return true;
    case "weekdays": return d.getDay() >= 1 && d.getDay() <= 5;
    case "weekly": return d.getDay() === s0.getDay();
    // Clamped like bills: a 31st lands on the 30th in 30-day months, a Feb 29 on Feb 28 in other years.
    case "monthly": return d.getDate() === Math.min(s0.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
    case "yearly": return d.getMonth() === s0.getMonth() && d.getDate() === Math.min(s0.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
    default: return day === x.day;
  }
}
const todoShown = t => isRep(t) ? occursOn({ ...t, day: t.day || today() }, today()) : (!t.done || t.doneDay === today());
const todoDone = t => isRep(t) ? t.doneDay === today() : !!t.done;
const repLabel = x => {
  if (!isRep(x)) return "";
  if (x.rep === "weekly") return `🔁 Every ${parseDay(x.day || today()).toLocaleDateString([], { weekday: "long" })}`;
  return `🔁 ${REPEATS[x.rep]}`;
};
function repSelect(withMonthly) {
  return `<select name="rep">${Object.entries(REPEATS).filter(([k]) => withMonthly || (k !== "monthly" && k !== "yearly"))
    .map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>`;
}

// ---------------------------------------------------------------- install
// Android/Chrome offers a real install prompt; iPhone needs Share -> Add to
// Home Screen (and only an installed Day Hub can send reminders there).
let INSTALL_EVT = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL_EVT = e; if (S) render(); });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function drawInstallBox() {
  const g = document.getElementById("installBox"); if (!g) return;
  g.innerHTML = `<h3>On your home screen</h3>` + (standalone()
    ? `<div class="leg"><span>✅ ${APP_NAME} is installed</span></div>`
    : INSTALL_EVT ? `<button class="btn sm" data-install="1">📲 Install ${APP_NAME}</button>`
    : isIOS() ? `<p class="fine" style="margin-top:0">Tap <b>Share</b> (the square with the arrow) → <b>Add to Home Screen</b>. Open Day Hub from that icon — iPhone only sends reminders to installed apps.</p>`
    : `<p class="fine" style="margin-top:0">In your browser menu <b>⋮</b> choose <b>Install app</b> or <b>Add to Home screen</b>.</p>`);
}

// --------------------------------------------------------------- packages
// v0.9 (Scott 10/1 "all"). Live delivery status needs a paid tracking service
// (a Pro candidate later). What works free: the carrier is recognised from the
// number, Track opens the carrier's own page, and the expected day lands on
// the schedule, the Tomorrow card and the morning brief.
const CARRIERS = {
  ups:    ["UPS",    n => `https://www.ups.com/track?tracknum=${n}`],
  usps:   ["USPS",   n => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`],
  fedex:  ["FedEx",  n => `https://www.fedex.com/fedextrack/?trknbr=${n}`],
  amazon: ["Amazon", n => `https://track.amazon.com/tracking/${n}`],
  dhl:    ["DHL",    n => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`],
  other:  ["Other",  n => `https://www.google.com/search?q=${encodeURIComponent("track package " + n)}`],
};
const cleanNum = raw => String(raw || "").replace(/[\s-]/g, "").toUpperCase();
function detectCarrier(raw) {
  const n = cleanNum(raw);
  if (/^1Z[0-9A-Z]{16}$/.test(n)) return "ups";
  if (/^TBA\d{9,15}$/.test(n)) return "amazon";
  if (/^9[1-5]\d{18,24}$/.test(n) || /^[A-Z]{2}\d{9}US$/.test(n) || (/^420\d{5}/.test(n) && n.length >= 26)) return "usps";
  if (/^(\d{12}|\d{15}|\d{20}|\d{22})$/.test(n)) return "fedex";
  if (/^\d{10}$/.test(n)) return "dhl";
  return "other";
}
const trackUrl = pk => (CARRIERS[pk.carrier] || CARRIERS.other)[1](encodeURIComponent(cleanNum(pk.num)));

// The morning brief - one notification at wake-up (reminders on, time in Settings).
function morningBrief() {
  const t = today(), w = WXDATA && WXDATA.here, items = dayItems(t), plans = items.filter(isPlan), parts = [];
  S.remember.filter(r => r.day === t).forEach(r => parts.push(`📌 ${r.text}`));
  if (w) parts.push(`${wmo(w.day.code)[0]} ${Math.round(w.day.lo)}°–${Math.round(w.day.hi)}°` +
    (w.day.rainFrom ? ` · rain from ${fmtTime(w.day.rainFrom)}` : w.day.rain < 20 ? " · no rain" : ""));
  const f = plans.find(i => i.t && i.t >= nowT()) || plans.find(i => i.t);
  parts.push(plans.length ? `${plans.length} planned${f ? ` · first ${hm(f.t)} ${f.title}` : ""}` : "nothing planned");
  const todo = S.todos.filter(x => todoShown(x) && !todoDone(x)).length;
  if (todo) parts.push(`${todo} to-do${todo === 1 ? "" : "s"}`);
  items.filter(i => i.kind === "bill").forEach(i => parts.push(`💳 ${i.title}`));
  const pk = items.filter(i => i.kind === "pkg").length;
  if (pk) parts.push(`📦 ${pk} arriving`);
  return parts.join(" · ");
}

// ---------------------------------------------------------- email -> plans
// v0.10 (Scott 10/1: "like to email for calendar and such"). Reads the last
// 14 days of Gmail, READ-ONLY, on the phone, and SUGGESTS what it finds -
// nothing is added until the user taps Add, and nothing leaves the phone.
// 1) The structured data many senders embed (schema.org JSON-LD - airlines,
//    hotels, restaurants, shippers; it is what Gmail's own cards read).
// 2) Fallbacks: tracking numbers in shipping mail; a date + time in mail
//    whose subject says appointment / reservation / booking / confirmed.
let MTOKEN = null, MTOKEN_EXP = 0, MAIL_BUSY = false;
const mReady = () => MTOKEN && Date.now() < MTOKEN_EXP;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "October 3, 2026 at 2:30 PM" / "Thu, Oct 3 2:30pm" / "10/03/2026 2:30 PM" / "2026-10-03T14:30"
function parseDateTime(text, now = new Date()) {
  const t = String(text || "");
  const fix = (y, m, d, h, mi, ap) => {
    let H = Number(h || 0); const M = Number(mi || 0);
    if (ap) { ap = ap.toLowerCase(); if (ap.startsWith("p") && H < 12) H += 12; if (ap.startsWith("a") && H === 12) H = 0; }
    let Y = Number(y || now.getFullYear()); if (Y < 100) Y += 2000;
    let dt = new Date(Y, m, Number(d), H, M);
    if (!y && dt < new Date(now.getFullYear(), now.getMonth(), now.getDate())) dt = new Date(Y + 1, m, Number(d), H, M);
    if (isNaN(dt) || dt.getDate() !== Number(d)) return null;
    return { day: ymd(dt), time: h ? hhmm(dt) : null };
  };
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (m) return fix(m[1], m[2] - 1, m[3], m[4], m[5]);
  const TIME = String.raw`(?:,?\s*(?:at|@|from)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?))?`;
  m = t.match(new RegExp(String.raw`\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?` + TIME, "i"));
  if (m) return fix(m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), m[2], m[4], m[5], m[6]);
  m = t.match(new RegExp(String.raw`\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?` + TIME, "i"));
  if (m && Number(m[1]) <= 12) return fix(m[3], m[1] - 1, m[2], m[4], m[5], m[6]);
  return null;
}

const htmlToText = h => String(h || "").replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, " ");

function ldBlocks(html) {
  const out = [], re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html || ""))) {
    try {
      const j = JSON.parse(m[1].trim());
      const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { out.push(x); if (x["@graph"]) walk(x["@graph"]); } };
      walk(j);
    } catch (e) { /* a sender's broken JSON is not our problem */ }
  }
  return out;
}

const nm = x => (x && (typeof x === "string" ? x : x.name || x.iataCode)) || "";
// A date-only "2026-10-03" is parsed by new Date() as UTC midnight = 7 PM the
// day BEFORE in Central, so packages read "arriving" a day early. Keep it as is.
const dtOf = v => { if (!v) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) return { day: String(v).trim(), time: null };
  const d = new Date(v); return isNaN(d) ? null : { day: ymd(d), time: /T\d/.test(String(v)) ? hhmm(d) : null }; };

// One message -> zero or more suggestions. Pure: unit-tested without Gmail.
function extractFromMessage(msg) {
  const out = [], seenNum = new Set(), html = msg.html || "", text = msg.text || htmlToText(html), subj = msg.subject || "";
  const push = x => out.push({ ...x, key: `${msg.id}:${x.type}:${x.num || x.day + (x.time || "") + x.title}`, src: subj.slice(0, 80) });
  for (const o of ldBlocks(html)) {
    const type = String(o["@type"] || "");
    if (type === "ParcelDelivery") {
      const num = cleanNum(o.trackingNumber); if (!num || seenNum.has(num)) continue; seenNum.add(num);
      const eta = dtOf(o.expectedArrivalUntil || o.expectedArrivalFrom);
      const item = [].concat(o.itemShipped || []).map(nm).filter(Boolean)[0];
      push({ type: "package", title: item || nm(o.partOfOrder && o.partOfOrder.merchant) || subj, num,
             carrier: detectCarrier(num) !== "other" ? detectCarrier(num) : ({ ups: "ups", usps: "usps", fedex: "fedex", amazon: "amazon", dhl: "dhl" }[nm(o.carrier || o.provider).toLowerCase().split(" ")[0]] || "other"),
             day: eta && eta.day });
    } else if (type === "FlightReservation") {
      const f = o.reservationFor || {}, d = dtOf(f.departureTime); if (!d) continue;
      push({ type: "event", title: `✈️ ${nm(f.airline)} ${f.flightNumber || ""} ${nm(f.departureAirport)} → ${nm(f.arrivalAirport)}`.replace(/\s+/g, " ").trim(),
             day: d.day, time: d.time, where: nm(f.departureAirport) });
    } else if (type === "LodgingReservation") {
      const d = dtOf(o.checkinTime || o.checkinDate); if (!d) continue;
      push({ type: "event", title: `🏨 Check in: ${nm(o.reservationFor) || "hotel"}`, day: d.day, time: d.time, where: nm(o.reservationFor) });
    } else if (/Reservation$/.test(type)) {
      const f = o.reservationFor || {}, d = dtOf(o.startTime || o.startDate || f.startDate || o.pickupTime); if (!d) continue;
      push({ type: "event", title: nm(f) || subj, day: d.day, time: d.time, where: nm(f.location) });
    }
  }
  const cr = extractCruise(msg, text);
  if (cr) push(cr);
  if (!out.length && /ship|track|deliver|on its way|out for|order/i.test(subj + " " + (msg.from || ""))) {
    const re = /\b(1Z[0-9A-Z]{16}|TBA\d{12}|9[2-5]\d{20,24}|[A-Z]{2}\d{9}US)\b/g; let m;
    while ((m = re.exec(text)) && out.length < 3) { const num = cleanNum(m[1]); if (seenNum.has(num)) continue; seenNum.add(num);
      push({ type: "package", title: subj.replace(/^(re|fwd?):\s*/i, ""), num, carrier: detectCarrier(num), day: null }); }
  }
  if (!out.length && /appointment|reservation|booking|booked|scheduled|confirm/i.test(subj)) {
    const d = parseDateTime(subj + "\n" + text);
    if (d && d.day >= today() && d.day <= addDays(today(), 180))
      push({ type: "event", title: subj.replace(/^(re|fwd?):\s*/i, "").replace(/\b(your|confirmed?|confirmation|reminder)\b:?/gi, "").replace(/\s+/g, " ").trim() || "Appointment",
             day: d.day, time: d.time });
  }
  return out;
}

// v0.15 (Scott 10/1: "we can use cruise itinerary in email to make all data
// chime in" / "if they use same email all data gets added zero effort").
// Cruise lines write the trip as LABEL + VALUE lines - verified on Scott's own
// Princess mail 10/1: "Ship Caribbean Princess", "Sail Date Aug 30, 2026",
// "Stateroom Premium Balcony", "Booking # DN9MWJ" (upgrade offers repeat it).
// Full confirmations add itinerary rows: a date, a port, and 1-2 times.
// Every cruise mail for the same booking MERGES into one suggestion, and
// applying it fills BLANKS only - nothing the traveller typed is overwritten.
const CRUISE_LINES = ["princess", "carnival", "royal caribbean", "rccl", "norwegian", "ncl", "celebrity", "msc", "holland america",
  "disney cruise", "virgin voyages", "cunard", "oceania", "viking", "regent seven seas", "silversea", "azamara"];
const LINE_NAMES = { princess: "Princess", carnival: "Carnival", "royal caribbean": "Royal Caribbean", rccl: "Royal Caribbean", norwegian: "Norwegian",
  ncl: "Norwegian", celebrity: "Celebrity", msc: "MSC", "holland america": "Holland America", "disney cruise": "Disney", "virgin voyages": "Virgin Voyages",
  cunard: "Cunard", oceania: "Oceania", viking: "Viking", "regent seven seas": "Regent", silversea: "Silversea", azamara: "Azamara" };
const TIME_RE = /\b(\d{1,2}):(\d{2})\s*([ap])\.?\s?m\.?/gi;
const t24 = (h, m, ap) => { let H = Number(h) % 12; if (ap.toLowerCase() === "p") H += 12; return `${pad(H)}:${m}`; };
function extractCruise(msg, text) {
  const subj = msg.subject || "", from = (msg.from || "").toLowerCase(), all = `${subj}\n${text}`;
  const lineKey = CRUISE_LINES.find(k => from.includes(k.replace(/ /g, "")) || from.includes(k)) ||
                  CRUISE_LINES.find(k => new RegExp(`\\b${k}\\b`, "i").test(subj));
  if (!lineKey) return null;
  const c = { line: LINE_NAMES[lineKey] };
  const bk = all.match(/\bbooking\s*(?:#|id|number|no\.?)?\s*:?\s*([A-Z0-9]{6,8})\b/i) || all.match(/\b(?:confirmation|reservation)\s*(?:#|number|no\.?)\s*:?\s*([A-Z0-9]{6,10})\b/i);
  if (bk && /\d/.test(bk[1]) || bk && /^[A-Z]{6,8}$/.test(bk[1])) c.booking = bk[1].toUpperCase();
  for (const raw of text.split(/\n+/)) {
    const l = raw.replace(/\s+/g, " ").trim(); if (!l || l.length > 120) continue;
    let m;
    if (!c.ship && (m = l.match(/^ship(?: name)?\s*:?\s+([A-Z][A-Za-z'’. ]{2,40}?)\s*$/i)) && !/\d/.test(m[1])) c.ship = m[1].trim();
    else if (!c.start && (m = l.match(/^(?:sail(?:ing)? date|departure date|embark(?:ation)? date|sails?)\s*:?\s+(.+)$/i))) { const d = parseDateTime(m[1]); if (d) c.start = d.day; }
    else if (!c.end && (m = l.match(/^(?:return date|disembark(?:ation)? date|returns?)\s*:?\s+(.+)$/i))) { const d = parseDateTime(m[1]); if (d) c.end = d.day; }
    else if ((m = l.match(/^(?:stateroom|cabin)(?: number| #| no\.?)?\s*:?\s+(.+)$/i))) {
      const v = m[1].trim(), num = v.match(/\b([A-Z]{0,2}-?\d{3,5}[A-Z]?)\b/);
      if (num && !c.cabin) c.cabin = num[1]; else if (!num && !c.category && v.length < 40) c.category = v; }
    else if (!c.finalDue && (m = l.match(/final payment(?: due| date)?\s*:?\s*(.+)$/i))) { const d = parseDateTime(m[1]); if (d) c.finalDue = d.day; }
    else if (!c.total && (m = l.match(/^(?:total(?: price| fare| cruise fare| vacation price)?|grand total|cruise fare)\s*:?\s*\$\s?([\d,]+(?:\.\d{2})?)/i))) c.total = Number(m[1].replace(/,/g, ""));
    else if (!c.paid && (m = l.match(/^(?:amount paid|total paid|payments? received|paid to date)\s*:?\s*\$\s?([\d,]+(?:\.\d{2})?)/i))) c.paid = Number(m[1].replace(/,/g, ""));
    else if (!c.port && (m = l.match(/^(?:embarkation port|departure port|port of embarkation|departs? from|sailing from)\s*:?\s+([A-Z][A-Za-z .,'()-]{2,50})$/i))) c.port = m[1].trim();
    if (!c.nights && (m = l.match(/\b(\d{1,2})[- ]night\b/i))) c.nights = Number(m[1]);
  }
  if (!c.ship) { const m = all.match(/\b([A-Z][a-z]+ Princess|[A-Z][a-z]+ of the Seas|Carnival [A-Z][a-z]+|Norwegian [A-Z][a-z]+|Celebrity [A-Z][a-z]+|MSC [A-Z][a-z]+)\b/); if (m) c.ship = m[1]; }
  if (c.start && !c.end && c.nights) c.end = addDays(c.start, c.nights);
  // Itinerary rows: a date inside the voyage, a place, and 1-2 times. "At sea" rows are skipped.
  const ports = [];
  if (c.start) {
    const last = c.end || addDays(c.start, 30);
    for (const raw of text.split(/\n+/)) {
      const l = raw.replace(/\s+/g, " ").trim(); if (!l || l.length > 140 || /at sea|cruising|scenic|sail date|booking|final payment/i.test(l)) continue;
      const d = parseDateTime(l.replace(TIME_RE, ""), parseDay(c.start)); if (!d || d.day < c.start || d.day > last) continue;
      const times = [...l.matchAll(TIME_RE)].map(m => t24(m[1], m[2], m[3]));
      if (!times.length) continue;
      const name = l.replace(TIME_RE, "").replace(/\b(day\s*\d+|mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?/gi, "")
        .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?,?\s*(\d{4})?/gi, "")
        .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, "").replace(/\b(arrive|depart|arrival|departure|embark|disembark)s?\b/gi, "")
        .replace(/[|:–-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^,|,$/g, "").trim();
      if (!/[A-Za-z]{3}/.test(name) || name.length > 50) continue;
      if (d.day === c.start) { if (!c.port) c.port = name; continue; }
      if (c.end && d.day === c.end) continue;
      if (!ports.some(x => x.day === d.day)) ports.push({ day: d.day, name, arrive: times.length > 1 ? times[0] : "", depart: times[times.length - 1] });
    }
  }
  if (ports.length) c.ports = ports;
  if (!c.ship && !c.start && !c.booking) return null;
  const parts = [c.ship, c.start && prettyDate(c.start), c.booking && `booking ${c.booking}`].filter(Boolean);
  return { type: "cruise", title: `🚢 ${c.ship || c.line + " cruise"}`, day: c.start || null, cruise: c, num: c.booking || "",
           detail: parts.join(" · ") };
}
// Several mails about one booking become ONE suggestion: later mails only add what is missing.
function mergeCruise(a, b) {
  for (const [k, v] of Object.entries(b)) if (k === "ports") { a.ports = a.ports || []; v.forEach(p => { if (!a.ports.some(x => x.day === p.day)) a.ports.push(p); }); }
    else if (a[k] == null || a[k] === "") a[k] = v;
  return a;
}
const tripFor = c => S.trips.find(t => (c.booking && t.booking === c.booking) || (c.start && t.start === c.start && (!c.ship || !t.ship || t.ship === c.ship)));
// What a cruise suggestion would ADD to an existing trip (blanks only).
function cruiseAdds(c) {
  const tr = tripFor(c); if (!tr) return null;
  const want = { ship: c.ship, line: c.line, start: c.start, end: c.end, booking: c.booking, cabin: c.cabin, port: c.port, total: c.total, finalDue: c.finalDue };
  const add = Object.entries(want).filter(([k, v]) => v && !tr[k]).map(([k]) => k);
  const newPorts = (c.ports || []).filter(p => !(tr.ports || []).some(x => x.day === p.day)).length;
  return { tr, add, newPorts };
}

function mailSignIn(prompt) {                                 // must run from a tap
  return loadGis().then(() => new Promise(res => {
    google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID, scope: GMAIL_SCOPE, prompt,
      callback: r => { if (r.error) { toast("Google sign-in was cancelled"); res(false); return; }
        MTOKEN = r.access_token; MTOKEN_EXP = Date.now() + ((r.expires_in || 3600) - 60) * 1000; saveTokens(); res(true); },
      error_callback: () => { toast("Sign-in window closed"); res(false); },
    }).requestAccessToken();
  })).catch(() => { toast("Couldn't reach Google — check your connection"); return false; });
}
const b64 = s => { try { const bin = atob(String(s).replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); } catch (e) { return ""; } };
function bodies(part, acc = { html: "", text: "" }) {
  if (!part) return acc;
  if (part.mimeType === "text/html" && part.body && part.body.data) acc.html += b64(part.body.data);
  else if (part.mimeType === "text/plain" && part.body && part.body.data) acc.text += b64(part.body.data);
  (part.parts || []).forEach(p => bodies(p, acc));
  return acc;
}
async function gmail(path) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${MTOKEN}` } });
  if (r.status === 401) { MTOKEN = null; throw new Error("signed out"); }
  if (!r.ok) throw new Error(`Gmail ${r.status}`);
  return r.json();
}
async function scanMail() {                                   // from a tap, or on open while signed in
  if (!can("mail")) { toast("Email scanning is part of Day Hub Pro"); return; }
  if (MAIL_BUSY) return;
  if (!mReady() && !(await mailSignIn(S.mail.on ? "" : "consent"))) return;
  MAIL_BUSY = true; drawMailBox(); render();
  try {
    const q = encodeURIComponent("newer_than:14d -in:spam -in:trash (shipped OR tracking OR delivery OR delivered OR appointment OR reservation OR booking OR booked OR confirmation OR confirmed OR itinerary OR flight OR scheduled)");
    const list = await gmail(`messages?q=${q}&maxResults=40`);
    const cq = encodeURIComponent("newer_than:400d -in:spam -in:trash {" + CRUISE_LINES.map(k => `from:${k.replace(/ /g, "")}`).join(" ") + "} {booking itinerary confirmation \"final payment\" invoice \"sail date\" stateroom}");
    const clist = await gmail(`messages?q=${cq}&maxResults=25`).catch(() => ({}));
    const ids = [...new Set([...(list.messages || []), ...(clist.messages || [])].map(m => m.id))].filter(id => !S.mail.seen[id]);
    let added = 0;
    for (let i = 0; i < ids.length; i += 5) {
      const batch = await Promise.all(ids.slice(i, i + 5).map(id => gmail(`messages/${id}?format=full`).catch(() => null)));
      for (const m of batch.filter(Boolean)) {
        const h = Object.fromEntries((m.payload.headers || []).map(x => [x.name.toLowerCase(), x.value]));
        const b = bodies(m.payload);
        for (const sug of extractFromMessage({ id: m.id, subject: h.subject, from: h.from, html: b.html, text: b.text || htmlToText(b.html) })) {
          if (sug.type === "cruise") {
            const same = S.mail.found.find(f => f.type === "cruise" && ((sug.cruise.booking && f.cruise.booking === sug.cruise.booking) || (sug.cruise.start && f.cruise.start === sug.cruise.start)));
            if (same) { mergeCruise(same.cruise, sug.cruise); same.day = same.cruise.start || same.day; continue; }
            const ad = cruiseAdds(sug.cruise); if (ad && !ad.add.length && !ad.newPorts) continue;   // already on the trip
            S.mail.found.push(sug); added++; continue;
          }
          const dupe = S.mail.found.some(f => f.key === sug.key) ||
            (sug.type === "package" && S.packages.some(p => cleanNum(p.num) === sug.num)) ||
            (sug.type === "event" && S.events.some(e => e.day === sug.day && e.title === sug.title));
          if (!dupe) { S.mail.found.push(sug); added++; }
        }
        S.mail.seen[m.id] = Date.now();
      }
    }
    const old = Date.now() - 30 * 86400000;                    // forget message ids after 30 days
    for (const [k, v] of Object.entries(S.mail.seen)) if (v < old) delete S.mail.seen[k];
    S.mail.on = true; S.mail.last = new Date().toISOString(); save();
    toast(added ? `Found ${added} in your email` : "Nothing new in your email");
  } catch (e) { toast("Couldn't read your email — try again"); }
  MAIL_BUSY = false; drawMailBox(); render();
}
function addFound(key) {
  const f = S.mail.found.find(x => x.key === key); if (!f) return;
  if (f.type === "cruise") {
    const c = f.cruise, old = tripFor(c);
    if (old) {                                                 // fill BLANKS only - never overwrite what the traveller typed
      ensureLists(old);
      for (const k of ["ship", "line", "start", "end", "booking", "cabin", "port", "total", "finalDue"]) if (c[k] && !old[k]) old[k] = c[k];
      (c.ports || []).forEach(pt => { if (!old.ports.some(x => x.day === pt.day)) old.ports.push({ id: uid(), allAboard: "", excursion: "", meet: "", where: "", ...pt }); });
      old.ports.sort((a, b) => a.day.localeCompare(b.day)); S.tripSel = old.id;
    } else {
      const id = uid();
      const tr = ensureLists({ id, type: "cruise", name: `${c.ship || c.line + " cruise"}`, start: c.start || null, end: c.end || null, line: c.line || "",
        ship: c.ship || "", port: c.port || "", travelers: null, total: c.total || null, finalDue: c.finalDue || null, onboardBudget: null,
        booking: c.booking || "", cabin: c.cabin || "", insurance: "undecided", travel: "", payments: [], spends: [],
        ports: (c.ports || []).map(pt => ({ id: uid(), allAboard: "", excursion: "", meet: "", where: "", ...pt })), lists: newLists("cruise") });
      if (c.paid) tr.payments.push({ id: uid(), day: today(), amt: c.paid, note: "Paid so far (from email)" });
      S.trips.push(tr); S.tripSel = id;
    }
    S.tripTab = "ready"; S.mail.found = S.mail.found.filter(x => x.key !== key); save(); render(); buzz();
    toast(old ? "Trip updated from your email ✓" : "Cruise added from your email ✓"); return;
  }
  if (f.type === "package") S.packages.push({ id: uid(), name: f.title.slice(0, 60), num: f.num, carrier: f.carrier, eta: f.day || null, delivered: false });
  else S.events.push({ id: uid(), day: f.day, time: f.time || "09:00", title: f.title.slice(0, 80), where: f.where || "", rep: "none", allDayGuess: !f.time });
  S.mail.found = S.mail.found.filter(x => x.key !== key); save(); render(); buzz();
  toast(f.type === "package" ? "Added to Packages ✓" : `Added to ${dayName(f.day)} ✓`);
}
function drawMailBox() {
  const g = document.getElementById("mailBox"); if (!g) return;
  g.innerHTML = `<h3>Email → calendar</h3>` + (S.mail.on
    ? `<div class="leg"><span>📬 Gmail connected${S.mail.last ? ` · checked ${fmtTime(S.mail.last)}` : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-mail="scan">${MAIL_BUSY ? "Checking…" : "Check email now"}</button><button class="btn sm ghost" data-mail="off">Disconnect</button></div>`
    : `<button class="btn sm" data-mail="scan">Connect Gmail (read-only)</button>`) +
    `<p class="fine" style="margin-top:8px"><b>Tip: connect the email you booked with — your cruise fills itself in.</b> Day Hub reads your email on this phone (read-only) to find cruise bookings, appointments, flights, hotel and dinner reservations and package tracking. Nothing is sent anywhere, and nothing is added until you tap Add.</p>`;
}

// ---------------------------------------------------------------- updates
// v0.11 (Scott 10/1: "a reminder the app has updates notification"). The
// network-first service worker already fetches new files when the app is
// OPENED, but a page left open keeps running the old code. version.json (cache
// busted) says what is published; a mismatch shows "New version ready", and
// after updating the WHAT'S NEW card lists the changes once.
// RELEASE RULE: every push bumps VERSION here AND version.json, with notes.
let UPDATE = null, NOTES = null;
async function checkUpdate() {
  try {
    const r = await fetch(new URL(`version.json?x=${Date.now()}`, BASE_URL), { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json(); NOTES = j.notes || {};
    if (j.version && j.version !== VERSION) {
      const first = !UPDATE; UPDATE = j; render();
      if (first && S.remind.on && S.lastNotifiedVersion !== j.version) {
        S.lastNotifiedVersion = j.version; saveLocal();
        notify("✨ Day Hub update ready", (j.notes && j.notes[j.version] || ["Tap to get the newest version."])[0], "dh-update");
      }
    } else if (S.seenVersion !== VERSION) render();          // notes arrived: show WHAT'S NEW
  } catch (e) { /* offline - try again later */ }
}
async function applyUpdate() {
  toast("Updating…");
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) { /* reload anyway */ }
  location.reload();
}
function whatsNewHtml() {
  // Brand-new user: nothing is "new". Someone who used Day Hub before this
  // feature existed (has data, no mark yet) sees this release's notes once.
  if (!S.seenVersion) { S.seenVersion = hasData(S) ? "0.10.2" : VERSION; saveLocal(); }
  if (S.seenVersion === VERSION || !NOTES) return "";
  const vers = Object.keys(NOTES).filter(v => v.localeCompare(S.seenVersion, undefined, { numeric: true }) > 0 &&
                                              v.localeCompare(VERSION, undefined, { numeric: true }) <= 0)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const items = vers.flatMap(v => NOTES[v]).slice(0, 8);
  if (!items.length) { S.seenVersion = VERSION; saveLocal(); return ""; }
  return `<section class="card whatsnew"><h3><span class="ci">✨</span>What's new in ${APP_NAME} ${VERSION}</h3>
    <div class="body">${items.map(x => `<div class="today-line">• ${esc(x)}</div>`).join("")}
    <button class="btn sm" data-seen="1" style="margin-top:10px">Got it</button></div></section>`;
}

// ------------------------------------------------------------------ trips
// v0.12 (Scott 10/1: "cruise app countdown payment tracker reminders and
// travel list" -> "final payment reminder and onboard spending tracker, all
// list preplanned in advance, and lil note some people dont know about
// cruises"). He had just come back from one. A CRUISE gets the full kit; any
// other trip gets the countdown, money and lists without the cruise extras.
const ONBOARD_CATS = ["Drinks", "Excursions", "Gratuities", "Dining", "Spa", "Casino", "Wi-Fi", "Photos", "Shopping", "Other"];
const GRAT_PER_DAY = 18;          // per person per night - most mainstream lines charge about $16-18
const TRIP_LISTS = { packing: "Packing", docs: "Documents", before: "Before you go", embark: "Sail day", requests: "Cabin requests", home: "Getting home", after: "After the trip" };
const CRUISE_ONLY_LISTS = ["requests", "home", "after"];
const TEMPLATES = {
  cruise: {
    packing: ["Swimsuits + cover-up", "Formal-night outfit", "Comfortable walking shoes", "Sandals / flip-flops", "Water shoes (rocky beaches, snorkeling, coral)",
      "Light jacket or sweater (ships are cold inside)", "Sunscreen (reef-safe for some ports)", "Sunglasses + hat",
      "Seasickness remedy - bands, patch or pills", "Daily medications (keep in your carry-on)", "Phone charger + cables",
      "Magnetic hooks (cabin walls are metal)", "Lanyard for your cruise card / Medallion", "Small day bag for port days", "Reusable water bottle",
      "Waterproof lanyard pouch - papers, phone, cards and cash for port days", "Luggage tag holders (clear sleeves with steel loops)", "USB charging station / multi-port charger - NOT a surge protector", "Small USB or clip-on fan (cabins can get stuffy)",
      "Dinner outfits for every night - plus 1-2 dress-up nights (check your line's dress code)"],
    docs: ["Passport valid 6+ months after you return (or birth certificate + photo ID on closed-loop US cruises)",
      "Passport care: zip bag or waterproof pouch, NEVER in checked luggage, a photo of it on your phone + a paper copy kept apart", "Cruise boarding pass / app check-in done",
      "Luggage tags printed and attached", "Credit card for the onboard account", "Some cash for tips and ports",
      "Travel insurance details", "Excursion confirmations", "Flight + hotel confirmations", "Emergency contacts on paper"],
    before: ["Pay the final payment (Day Hub reminds you)", "Check in online as soon as it opens + pick an arrival time",
      "Book excursions you really want (popular ones sell out)", "Decide on drink / Wi-Fi packages - often cheaper before you sail",
      "Book the flight to arrive THE DAY BEFORE sailing", "Tell your bank you'll be travelling",
      "Getting to the ship: compare port parking (per day) vs a hotel park-and-cruise deal vs a shuttle / rideshare",
      "Print luggage tags (from online check-in) + put them in tag holders",
      "Plan phone use at sea (airplane mode or a cruise plan)"],
    home: ["Check your final ship account the last night", "Put out luggage tags / bags the night before (or carry off)",
      "Keep documents, meds and a change of clothes in your carry-on", "Breakfast before your exit time", "Cabin empty by the vacate time",
      "Customs: declare what you bought", "Ride / parking / flight home confirmed"],
    requests: ["BEFORE SAILING - tell the cruise line: dietary needs / allergies", "BEFORE SAILING - medical equipment (CPAP, oxygen): follow the line's own instructions",
      "BEFORE SAILING - accessibility needs", "BEFORE SAILING - celebrating? (birthday / anniversary)", "STEWARD - beds together or apart",
      "STEWARD - extra hangers", "STEWARD - extra towels / pillows", "STEWARD - ice bucket refills"],
    after: ["Card holds released + final charges match the ship account", "Refunds or unused credits checked", "Loyalty points posted",
      "Download / sort your photos", "Write down what to do differently next time", "Leave a review", "Look at future-cruise offers"],
    embark: ["Carry-on: documents, meds, swimsuit, chargers", "Arrive at your check-in time - not hours early",
      "Tip the porters ($1-2 a bag)", "Muster / safety drill (required)", "Lunch at the buffet while cabins get ready",
      "Find your cabin, check the bags arrived (can be evening)", "Look at tomorrow's daily planner in the app"],
  },
  trip: {
    packing: ["Clothes for each day", "Comfortable shoes", "Toiletries", "Medications", "Phone charger", "Sunglasses", "Jacket"],
    docs: ["ID / passport", "Tickets / boarding passes", "Hotel confirmation", "Car rental confirmation", "Travel insurance details"],
    before: ["Confirm bookings", "Tell your bank you'll be travelling", "Arrange pet / house sitting", "Check the weather where you're going"],
    embark: ["Leave early - traffic and lines", "Documents + meds in your carry-on"],
  },
};
const CRUISE_TIPS = [
  "Final payment is usually due 75-90 days before sailing - miss it and the cruise line can cancel your booking.",
  "Daily gratuities (around $16-18 per person per night) are added to your onboard account automatically.",
  "Your cruise card is your room key AND your wallet - everything onboard charges to it.",
  "The main dining room and buffet are included. Drinks, specialty restaurants, Wi-Fi, spa and most excursions cost extra.",
  "Fly in the day before you sail - if your flight is late, the ship will not wait.",
  "'All aboard' is usually 30-60 minutes before the ship leaves a port. Be back on time or it sails without you.",
  "Put your phone in airplane mode at sea - the ship's cell network can cost a fortune.",
  "On sail day your big bags may not reach your cabin until evening - keep a carry-on with what you need.",
  "Surge-protector power strips get taken at security, and cabins have few outlets.",
  "Prone to seasickness? A cabin low and in the middle of the ship moves the least.",
  "Pack a USB charging station (no surge protector) and magnets — cabins have few outlets and metal walls that hold hooks and notes.",
  "Dinner: most nights are casual-smart; most 7-night cruises have 1-2 dress-up nights. Your line's planner says which nights.",
  "SHIP excursions cost more, but if the tour runs late the ship waits for it. INDEPENDENT tours are often much cheaper — but if you're late, the ship leaves without you.",
  "Going independent? Book well-reviewed operators, plan to be back an hour before all aboard, carry the port agent's number from your planner, and use official taxis only.",
  "Passport care: keep it in the cabin safe on sea days, in a waterproof pouch when you carry it, never in checked bags — and keep a phone photo + paper copy separate from it.",
  "A waterproof lanyard pouch keeps papers, phone, cards and cash dry on beach and boat excursions.",
  "Getting to the port: cruise-terminal parking is charged per day, so on a week-long cruise compare it with a hotel 'park & cruise' package (a night's stay + parking + shuttle) or a shuttle / rideshare.",
  "Carry-on: you carry it aboard yourself — meds, documents, valuables, chargers, a swimsuit and a change of clothes go in it. Many lines ban clothes irons / steamers, surge protectors and candles in ANY bag — check your line's list.",
  "Water shoes save your feet on rocky beaches, snorkel stops and coral — and they dry fast.",
  "Luggage tags: print them from online check-in, fold them into clear tag holders with steel loops (paper tags tear off), and put a card with your name, ship, cabin and phone INSIDE every bag.",
  "Port safety: keep your cruise card / Medallion and ID on you, don't flash valuables, drink plenty of water, and follow the flags at beaches.",
];
const isCruise = tr => tr.type === "cruise";
const tripNights = tr => tr.start && tr.end ? Math.max(0, Math.round((parseDay(tr.end) - parseDay(tr.start)) / 86400000)) : 0;
const tripPaid = tr => (tr.payments || []).reduce((n, x) => n + Number(x.amt || 0), 0);
const tripLeft = tr => tr.total ? Math.max(0, tr.total - tripPaid(tr)) : null;
const tripSpent = tr => (tr.spends || []).reduce((n, x) => n + Number(x.amt || 0), 0);
// PACKAGES - checked 2026-10-01 on princess.com "Princess Plus & Princess Premier"
// terms (purchased on/after 7/22/2025, sailings departing on/after 1/14/2026).
// Only what Princess's own page states. Other lines: the traveller adds perks
// by hand until their terms are checked the same way.
const PKG_SRC = "https://www.princess.com/cruise-deals-promotions/plus-premier-cruise-packages/terms-and-conditions";
const PACKAGES = {
  "princess-plus": { name: "Princess Plus", line: "Princess", drinkCap: 15, gratsPaid: true,
    includes: ["Drinks up to $15 each — 15 a day (specialty coffee and small bottled water don't count; water up to 12 a day)",
      "Wi-Fi for 1 device per guest", "Crew appreciation (gratuities) paid by Princess",
      "4 casual prix-fixe meals per guest for the whole voyage — unused meals are not refunded",
      "OceanNow / room-service delivery: a one-time $14.99 fee per guest"],
    perks: [{ name: "Casual dining meals", per: 4, unit: "meals" }] },
  "princess-premier": { name: "Princess Premier", line: "Princess", drinkCap: 20, gratsPaid: true,
    includes: ["Drinks up to $20 each — no daily limit", "Wi-Fi for 4 devices per guest", "Crew appreciation (gratuities) paid by Princess",
      "Unlimited casual prix-fixe meals", "Specialty dining: 1 per mealtime per day", "Shore excursion credit $100–$300 (by voyage length) — not refundable for cash",
      "Unlimited digital photos + 3 prints up to 8×10", "Reserved theater seating for production shows (first come, first served)",
      "OceanNow / room-service delivery: a one-time $14.99 fee per guest"],
    perks: [{ name: "Photo prints (up to 8×10)", per: 3, unit: "prints" }, { name: "Shore excursion credit", per: 0, unit: "$" }] },
};
const pkgOf = tr => PACKAGES[tr.pkg] || null;
// A package that pays gratuities means the automatic daily charge is NOT coming.
const gratEstimate = tr => isCruise(tr) && !(pkgOf(tr) && pkgOf(tr).gratsPaid) ? (Number(tr.travelers) || 1) * tripNights(tr) * GRAT_PER_DAY : 0;
function seedPerks(tr) {
  const P = pkgOf(tr); tr.perks = tr.perks || [];
  if (!P) return;
  const n = Number(tr.travelers) || 1;
  P.perks.forEach(x => { if (!tr.perks.some(y => y.name === x.name))
    tr.perks.push({ id: uid(), name: x.name, total: x.per ? x.per * n : 0, used: 0, unit: x.unit, fromPkg: true }); });
}
const perksLeft = tr => (tr.perks || []).filter(x => x.total > 0 && x.used < x.total);

// Port weather: Open-Meteo daily forecast for the port's day (up to 16 days ahead).
const PORTWX = {};
function ensurePortWx(tr) {
  (tr.ports || []).forEach(pt => {
    const k = `${pt.name}|${pt.day}`, d = daysUntil(pt.day);
    if (PORTWX[k] || d < 0 || d > 15) return;
    PORTWX[k] = { loading: true };
    (async () => {
      try {
        const place = await geocode(pt.name);
        if (!place) { PORTWX[k] = { none: true }; return; }
        const q = `latitude=${place.lat}&longitude=${place.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
                  `&temperature_unit=fahrenheit&timezone=auto&start_date=${pt.day}&end_date=${pt.day}`;
        const j = await (await fetch(`${WX}?${q}`)).json();
        PORTWX[k] = { hi: j.daily.temperature_2m_max[0], lo: j.daily.temperature_2m_min[0], rain: j.daily.precipitation_probability_max[0] ?? 0, code: j.daily.weather_code[0] };
      } catch (e) { PORTWX[k] = { none: true }; }
      render();
    })();
  });
}
const portWxText = pt => { const w = PORTWX[`${pt.name}|${pt.day}`];
  return w && !w.loading && !w.none ? `${wmo(w.code)[0]} ${Math.round(w.hi)}°/${Math.round(w.lo)}°${w.rain >= 20 ? ` · rain ${w.rain}%` : ""}` : ""; };
const upcomingTrips = () => S.trips.filter(tr => tr.end ? tr.end >= addDays(today(), -7) : true)
  .sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999"));
const curTrip = () => S.trips.find(t => t.id === S.tripSel) || upcomingTrips()[0] || null;
// Lists added in a later version reach trips planned before it (no data is lost).
function ensureLists(tr) {
  tr.lists = tr.lists || {};
  const T = TEMPLATES[tr.type] || TEMPLATES.trip;
  for (const k of Object.keys(TRIP_LISTS)) if (!tr.lists[k]) tr.lists[k] = (T[k] || []).map(text => ({ id: uid(), text, done: false }));
  tr.ports = tr.ports || [];
  return tr;
}
const tripListKeys = tr => Object.keys(TRIP_LISTS).filter(k => isCruise(tr) || !CRUISE_ONLY_LISTS.includes(k));

// v0.13 CRUISE MODE (Scott 10/1, the master list from his other chat): one
// "% READY", the ✅ / ⚠️ items, and ONE next action - what matters NOW. An
// item "matters now" from `due` days before sailing; lists count by how much
// of them is ticked. Nothing here is a judgement call - every item is a field
// or a checkbox the traveller controls.
function readiness(tr) {
  ensureLists(tr);
  const sd = tr.start ? daysUntil(tr.start) : 9999, cruise = isCruise(tr), L = tr.lists;
  const frac = k => { const a = L[k] || []; return a.length ? a.filter(i => i.done).length / a.length : 1; };
  const firstOpen = k => (L[k] || []).find(i => !i.done);
  const items = [];
  const add = (label, score, due, action) => items.push({ label, score, due, now: sd <= due, action });
  if (tr.total) {
    const left = tripLeft(tr), fd = tr.finalDue ? daysUntil(tr.finalDue) : null;
    add(left === 0 ? "Paid in full" : `Paid ${money(tripPaid(tr))} of ${money(tr.total)}`, left === 0 ? 1 : 0,
        fd !== null ? sd - fd + 30 : 90, `Make the final payment — ${money(left)}${tr.finalDue ? ` by ${prettyDate(tr.finalDue)}` : ""}`);
  }
  add("Booking number saved", tr.booking ? 1 : 0, 9999, "Add your booking number (Edit)");
  if (cruise) add("Travel insurance decided", tr.insurance && tr.insurance !== "undecided" ? 1 : 0, 120, "Decide on travel insurance (Edit)");
  add("Documents", frac("docs"), 90, firstOpen("docs") ? `Documents: ${firstOpen("docs").text}` : "");
  if (cruise) add("Port days entered", tr.ports.length ? 1 : 0, 90, "Add your port days — the 🗺️ Ports tab");
  if (cruise && tr.ports.length) {
    const open = tr.ports.filter(pt => !pt.excursion);
    add("Excursions planned", open.length ? 1 - open.length / tr.ports.length : 1, 90, open.length ? `Plan ${open[0].name} (excursion, or type "none")` : "");
  }
  if (cruise && tr.ports.length) { const noAA = tr.ports.filter(pt => !pt.allAboard);
    add("All-aboard times", noAA.length ? 1 - noAA.length / tr.ports.length : 1, 7, noAA.length ? `Add the all-aboard time for ${noAA[0].name} (Ports tab ✏️ — from the ship's daily planner)` : ""); }
  if (cruise) add("Cabin number", tr.cabin ? 1 : 0, 60, "Add your cabin number (Edit)");
  add("Getting there planned", tr.travel ? 1 : 0, 60, `Plan how you get to ${tr.port || "the start"} (Edit)`);
  add("Before you go", frac("before"), 60, firstOpen("before") ? firstOpen("before").text : "");
  add("Packing", frac("packing"), 30, firstOpen("packing") ? `Pack: ${firstOpen("packing").text}` : "");
  add(cruise ? "Sail-day plan" : "Travel-day plan", frac("embark"), 7, firstOpen("embark") ? firstOpen("embark").text : "");
  const pct = Math.round(items.reduce((n, i) => n + i.score, 0) / items.length * 100);
  // NEXT ACTION: the final payment when it is close, else the first item that matters now.
  const pay = items[0] && tr.total && items[0].score < 1 && tr.finalDue && daysUntil(tr.finalDue) <= 30 ? items[0] : null;
  const next = pay || items.find(i => i.now && i.score < 1 && i.action) || null;
  const phase = sd > 120 ? "Booking" : sd > 90 ? "Documents & excursions" : sd > 60 ? "Dining & packages" : sd > 30 ? "Travel & packing"
    : sd > 7 ? "Packing" : sd > 0 ? "Final checklist" : daysUntil(tr.end || tr.start) > 0 ? "On the trip" : daysUntil(tr.end || tr.start) === 0 ? "Getting home" : "After the trip";
  return { pct, items, next, phase, sd };
}
const portOn = (tr, day) => (tr.ports || []).find(pt => pt.day === day);

// ------------------------------------------------- what am I forgetting? (v0.14)
// Scott 10/1 ("Cruise Secrets" list): ONE button that looks at everything Day
// Hub knows and says what matters for TODAY of the trip - sail-day bag, port
// morning (all aboard, leave-cabin time, take-with-you, port money notes),
// last night, getting home. Built only from what the traveller entered.
const TAKE_WITH = ["Cruise card / Medallion / ship app", "Photo ID (passport if this port needs it)", "Phone, charged",
  "Credit card + some cash", "Sunscreen + sunglasses", "Water bottle"];
const FIRST_BAG = ["Documents + boarding pass", "Medications", "Phone + charger", "Valuables", "Swimsuit + sunscreen", "Change of clothes for dinner"];
const CELL_WARN = "⚠️ CELLULAR AT SEA — before the ship leaves port turn on airplane mode (then Wi-Fi back on), or check your phone plan's cruise coverage. The ship's cell network can cost a fortune.";
const addMinT = (t, m) => { const x = toMin(t) + m; const y = ((x % 1440) + 1440) % 1440; return `${pad(Math.floor(y / 60))}:${pad(y % 60)}`; };
const shipNote = pt => Number(pt.shipOffset) ? ` <span class="sub" style="display:inline">SHIP time · ${hm(addMinT(pt.allAboard, -Number(pt.shipOffset)))} local</span>` : "";
const hasExc = pt => pt && pt.excursion && pt.excursion.toLowerCase() !== "none";
function forgetHtml() {
  const tr = curTrip();
  if (!tr) return `<div class="empty">Plan a trip first — then this button knows what to remind you.</div>`;
  ensureLists(tr);
  const t = today(), sd = tr.start ? daysUntil(tr.start) : 999, ed = tr.end ? daysUntil(tr.end) : sd, cruise = isCruise(tr), pt = portOn(tr, t);
  const L = [], h = x => L.push(`<div class="fg-h">${x}</div>`), li = (x, warn) => L.push(`<div class="today-line">${warn ? "⚠️" : "☐"} ${x}</div>`);
  const open = k => (tr.lists[k] || []).filter(i => !i.done).map(i => esc(i.text));
  if (sd > 1) {
    const R = readiness(tr);
    h(`${cruise ? "🚢" : "✈️"} ${esc(tr.name)} — ${sd} days · ${R.pct}% ready`);
    if (R.next) L.push(`<div class="today-line">➡️ <b>${esc(R.next.action)}</b></div>`);
    R.items.filter(i => i.now && i.score < 1).forEach(i => li(esc(i.label), true));
    const d = open("docs").slice(0, 4); if (d.length) { h("Documents still to do"); d.forEach(x => li(x)); }
  } else if (sd === 1) {
    h(`TOMORROW YOU ${cruise ? "SAIL" : "GO"}${tr.port ? " — " + esc(tr.port) : ""}`);
    h("🧳 Keep with you — your big bag may not reach the cabin until evening"); FIRST_BAG.forEach(x => li(esc(x)));
    open("docs").forEach(x => li(x, true));
    open("packing").slice(0, 6).forEach(x => li(`Pack: ${x}`));
    if (cruise) L.push(`<div class="bstat tight">${CELL_WARN}</div>`);
  } else if (sd === 0) {
    h(`${cruise ? "🚢 SAIL DAY" : "✈️ TRAVEL DAY"}${tr.port ? " — " + esc(tr.port) : ""}`);
    h("🧳 Keep with you"); FIRST_BAG.forEach(x => li(esc(x)));
    open("embark").forEach(x => li(x));
    if (cruise) L.push(`<div class="bstat tight">${CELL_WARN}</div>`);
  } else if (ed > 0 && pt) {
    h(`⚓ GOOD MORNING — ${esc(pt.name).toUpperCase()}`);
    ensurePortWx(tr); if (portWxText(pt)) L.push(`<div class="today-line">${portWxText(pt)}</div>`);
    if (pt.allAboard) L.push(`<div class="today-line big-aboard">🚢 ALL ABOARD <b>${hm(pt.allAboard)}</b>${shipNote(pt)}</div>`);
    else if (pt.depart) L.push(`<div class="bstat tight">🚢 The ship leaves at <b>${hm(pt.depart)}</b>. All aboard is EARLIER (often 30-60 min) — check today's planner in your cruise app and add it here for the alarms.</div>`);
    if (hasExc(pt)) {
      L.push(`<div class="today-line">🏝️ ${esc(pt.excursion)}${pt.meet ? ` — meet <b>${hm(pt.meet)}</b>` : ""}${pt.where ? ` at ${esc(pt.where)}` : ""}</div>`);
      if (pt.meet) L.push(`<div class="today-line">⏰ Leave the cabin by <b>${hm(addMinT(pt.meet, -(Number(pt.walk) || 15)))}</b></div>`);
      if (pt.indie) L.push(`<div class="bstat over">Independent tour — the ship does NOT wait for a late private tour. Plan to be back an hour early.</div>`);
    }
    h("Take with you"); TAKE_WITH.forEach(x => li(esc(x))); if (hasExc(pt)) li("Excursion confirmation");
    const money4 = [["Cash", pt.cash], ["Currency", pt.currency], ["Cards", pt.cards], ["Tipping", pt.tipping]].filter(x => x[1]);
    if (money4.length) { h("💰 In port"); money4.forEach(([k, v]) => L.push(`<div class="today-line">${k}: <b>${esc(v)}</b></div>`)); }
    if (pt.allAboard) L.push(`<div class="today-line">⚠️ Back-on-ship alarms at <b>${(pt.indie ? [90, 60, 30] : [60, 30]).map(m => hm(addMinT(pt.allAboard, -m))).join(", ")}</b>${S.remind.on ? "" : " — turn reminders on in ⚙"}</div>`);
  } else if (ed === 1) {
    h("🌙 LAST NIGHT ON BOARD");
    const bal = tripSpent(tr) + gratEstimate(tr) - Number(tr.credit || 0);
    li(`Check your ship account — about <b>${money(bal)}</b> by Day Hub's count`, !tr.accountVerified);
    open("home").forEach(x => li(x));
  } else if (ed === 0) {
    h("🏠 GETTING HOME"); open("home").forEach(x => li(x));
  } else if (ed > 0) {
    const n = Math.round((parseDay(t) - parseDay(tr.start)) / 86400000) + 1;
    h(`🌊 ${cruise ? "AT SEA" : "ON THE TRIP"} — day ${n}`);
    const bud = Number(tr.onboardBudget || 0), sp = tripSpent(tr);
    L.push(`<div class="today-line">🍹 Spent so far <b>${money(sp)}</b>${bud ? ` of ${money(bud)}` : ""}</div>`);
    const nx = (tr.ports || []).find(x => x.day > t);
    if (nx) L.push(`<div class="today-line">⚓ Next port: <b>${esc(nx.name)}</b> ${dayName(nx.day)}${nx.allAboard ? ` · all aboard ${hm(nx.allAboard)}` : ""}</div>`);
  } else {
    h("📝 After the trip"); open("after").forEach(x => li(x));
  }
  const tonight = dayItems(t).filter(i => i.t && i.t >= "17:00" && isPlan(i));
  if (tonight.length && sd <= 0 && ed >= 0) { h("Tonight"); tonight.forEach(i => L.push(`<div class="today-line">${hm(i.t)} ${i.icon} ${esc(i.title)}</div>`)); }
  return L.join("") || `<div class="empty">Nothing to remind you right now.</div>`;
}

function newLists(type) {
  const T = TEMPLATES[type] || TEMPLATES.trip, out = {};
  for (const k of Object.keys(TRIP_LISTS)) out[k] = (T[k] || []).map(text => ({ id: uid(), text, done: false }));
  return out;
}
// Save per month: what is still owed, spread over the months left until the
// final payment (or sail day when no final date is known).
function savePerMonth(tr) {
  const left = tripLeft(tr), by = tr.finalDue || tr.start;
  if (!left || !by) return null;
  const months = Math.max(1, daysUntil(by) / 30.44);
  return daysUntil(by) <= 0 ? left : left / months;
}

// ------------------------------------------------------------- your data
// v0.17: a file the user keeps (no Google needed), loading one back, and
// erasing the phone - two taps, and Undo still works.
function exportData() {
  const data = JSON.parse(JSON.stringify(S)); delete data.gcal;
  const body = JSON.stringify({ app: "dayhub", v: VERSION, savedAt: new Date().toISOString(), data }, null, 1);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  a.download = `day-hub-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast("Backup file saved ✓");
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result), data = j && j.app === "dayhub" ? j.data : null;
      if (!data || typeof data !== "object") { toast("That file isn't a Day Hub backup"); return; }
      restoreFrom({ savedAt: j.savedAt || new Date().toISOString(), data });
    } catch (e) { toast("Couldn't read that file"); }
  };
  r.readAsText(file);
}
function eraseAll() {
  if (Date.now() - ERASE_ARMED > 5000) { ERASE_ARMED = Date.now(); toast("Tap Erase again to wipe this phone's Day Hub"); drawDataBox(true); return; }
  ERASE_ARMED = 0; snap(); const keepName = S.name;
  // NOT closeSettings(): that saves the still-open form, which would write the
  // old name / city straight back into the erased app (caught by the test suite).
  S = blank(); saveLocal(); WXDATA = null; document.getElementById("sheet").classList.add("hidden"); render();
  toast(`Erased${keepName ? ", " + keepName : ""}`, true);
}
function drawDataBox(armed) {
  const g = document.getElementById("dataBox"); if (!g) return;
  g.innerHTML = `<h3>Your data</h3><div class="foot-actions" style="flex-wrap:wrap">
      <button class="btn sm ghost" data-data="export">⬇️ Download my data</button>
      <button class="btn sm ghost" data-data="import">⬆️ Load a backup file</button>
      <button class="btn sm ${armed ? "" : "ghost"}" data-data="erase" style="${armed ? "background:var(--red);color:#fff" : ""}">🗑️ ${armed ? "Tap again to erase" : "Erase everything"}</button></div>
    <input type="file" id="importFile" accept="application/json,.json" style="display:none">
    <p class="fine" style="margin-top:6px">The download is a file you keep anywhere (email it to yourself, save it to Drive). Erasing can be undone right after.</p>`;
}

// ------------------------------------------------------------- the day
// A bill repeats monthly on its day (clamped to the month's length). `paid`
// = the last month paid ("YYYY-MM"). Unpaid and past due = LATE, shown red.
function nextDue(b) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let k = -1; k < 3; k++) {
    const y = now.getFullYear(), m = now.getMonth() + k;
    const due = new Date(y, m, Math.min(b.day, new Date(y, m + 1, 0).getDate()));
    if (b.paid && ymd(due).slice(0, 7) <= b.paid) continue;
    return ymd(due);
  }
  return null;
}
const upcomingBills = () => S.bills.map(b => ({ ...b, due: nextDue(b) })).filter(b => b.due)
  .sort((a, b) => a.due.localeCompare(b.due));
const liveCountdowns = () => S.countdowns.filter(c => daysUntil(c.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));

// Everything happening on one day, in time order. All-day items first.
function dayItems(day) {
  const it = [];
  S.events.filter(e => occursOn(e, day)).forEach(e => it.push({ t: e.time, title: e.title, sub: [e.where, repLabel(e)].filter(Boolean).join(" · "),
    kind: "event", icon: "📅", del: isRep(e) ? `occ:${e.id}:${day}` : `events:${e.id}`, cal: `events:${e.id}` }));
  if (S.gcal.connected) S.gcal.events.filter(e => e.day === day).forEach(e =>
    it.push({ t: e.time, end: e.end, title: e.title, sub: e.where, kind: "g", icon: "🗓️" }));
  ["loads", "jobs"].forEach(k => { if (!PACKS[S.pack].cards.includes(k)) return;
    S[k].filter(x => x.day === day).forEach(x => it.push({ t: x.time, title: x.title, kind: k, icon: k === "loads" ? "🚚" : "🔧",
      tick: `${k}:${x.id}`, done: x.done, del: `${k}:${x.id}`, cal: `${k}:${x.id}` })); });
  S.work.shifts.filter(x => x.day === day).forEach(x => it.push({ t: x.start, end: x.end, title: "Work shift", sub: fmtH(shiftHours(x)), kind: "work", icon: "💼", cal: `shift:${x.id}` }));
  upcomingBills().filter(b => b.due === day).forEach(b => it.push({ t: null, title: `${b.name} due`, sub: money(b.amount), kind: "bill", icon: "💳", cal: `bill:${b.id}` }));
  openReturns().filter(r => r.by === day).forEach(r => it.push({ t: null, title: `Return ${r.what} — last day`, sub: r.store || "", kind: "return", icon: "↩️" }));
  alarmsOn(day).forEach(a => it.push({ t: a.time, title: `Alarm${a.label ? ` — ${a.label}` : ""}`, kind: "alarm", icon: "⏰" }));
  if (payNext(day) === day) it.push({ t: null, title: "Payday", sub: (a => a.amt ? `${a.est ? "≈ " : ""}${money(a.amt)}` : "")(payAmount()), kind: "pay", icon: "💵" });
  S.upkeep.filter(x => upkeepNext(x) === day || (day === today() && !x.auto && upkeepNext(x) < day)).forEach(x =>
    it.push({ t: null, title: x.auto ? x.name : `${x.name} due`, sub: x.auto ? "" : upkeepWhen(x, upkeepNext(x)), kind: "upkeep", icon: x.area === "auto" ? "🚗" : "🏠" }));
  S.people.filter(p => personOn(p, day)).forEach(p => it.push({ t: null, title: personLabel(p, day), sub: giftDue(p, day) ? "🎁 gift?" : "", kind: "person", icon: PKIND[p.kind] || "⭐" }));
  S.countdowns.filter(c => c.date === day).forEach(c => it.push({ t: null, title: c.title, sub: "The day is here", kind: "cd", icon: "🎉" }));
  S.trips.forEach(tr => {
    if (tr.start && day >= tr.start && day <= (tr.end || tr.start)) {
      const n = Math.round((parseDay(day) - parseDay(tr.start)) / 86400000) + 1;
      const pt = portOn(tr, day);
      if (pt) {
        it.push({ t: null, title: `${pt.name} — port day`, sub: [pt.arrive && `in ${hm(pt.arrive)}`, pt.allAboard && `all aboard ${hm(pt.allAboard)}`].filter(Boolean).join(" · "), kind: "trip", icon: "⚓" });
        if (pt.allAboard) it.push({ t: pt.allAboard, title: `ALL ABOARD — ${pt.name}`, sub: "be on the ship", kind: "aboard", icon: "⚓" });
        if (pt.meet && pt.excursion && pt.excursion.toLowerCase() !== "none")
          it.push({ t: pt.meet, title: pt.excursion, sub: pt.where || "excursion meeting point", kind: "exc", icon: "🤿" });
      } else
        it.push({ t: null, title: day === tr.start ? `${isCruise(tr) ? "Sail day" : "Trip starts"} — ${tr.name}` : isCruise(tr) && day !== tr.end ? `At sea — ${tr.name}` : `${tr.name} — day ${n}`,
                  sub: [tr.ship, day === tr.start ? tr.port : ""].filter(Boolean).join(" · "), kind: "trip", icon: isCruise(tr) ? "🚢" : "✈️" });
    }
    if (tr.finalDue === day && tripLeft(tr) !== 0)
      it.push({ t: null, title: `Final payment — ${tr.name}`, sub: tripLeft(tr) ? money(tripLeft(tr)) + " left" : "", kind: "bill", icon: "💳" });
  });
  S.packages.filter(p => !p.delivered && p.eta === day).forEach(p => it.push({ t: null, title: `${p.name} arriving`, sub: (CARRIERS[p.carrier] || CARRIERS.other)[0], kind: "pkg", icon: "📦" }));
  const w = WXDATA && WXDATA.here;
  if (w && day === today()) {
    it.push({ t: w.day.sunrise.slice(11, 16), title: "Sunrise", kind: "sun", icon: "🌅" });
    it.push({ t: w.day.sunset.slice(11, 16), title: "Sunset", kind: "sun", icon: "🌇" });
    if (w.day.rainFrom) it.push({ t: w.day.rainFrom.slice(11, 16), title: "Rain likely starts", kind: "rain", icon: "☔" });
  }
  return it.sort((a, b) => (a.t ? 1 : 0) - (b.t ? 1 : 0) || String(a.t).localeCompare(String(b.t)));
}
const isPlan = i => ["event", "g", "loads", "jobs", "work", "exc"].includes(i.kind);

function nextPlan() {
  const t = nowT();
  const n = dayItems(today()).find(i => isPlan(i) && i.t && i.t >= t && !i.done);
  if (n) return { when: hm(n.t), ...n };
  for (let k = 1; k <= 7; k++) {
    const d = addDays(today(), k);
    const f = dayItems(d).find(i => isPlan(i));
    if (f) return { when: `${dayName(d)}${f.t ? " " + hm(f.t) : ""}`, ...f };
  }
  return null;
}

// ----------------------------------------------------------- work hours
// Scott 2026-10-01: "keep up with work hours ... and rough estimate of bring
// home pay". Week = Monday..Sunday. Overtime = hours past otAfter (40) at 1.5x.
// Take-home = gross minus ONE flat % the user sets - a rough guide, not payroll.
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
function shiftHours(x) {
  let m = toMin(x.end) - toMin(x.start);
  if (m < 0) m += 1440;                                  // overnight shift
  // Real clock time, so a shift over the clock change counts 9 h (Nov) / 7 h (Mar).
  if (x.day && m > 0) m = Math.round((atMs(m + toMin(x.start) >= 1440 ? addDays(x.day, 1) : x.day, x.end) - atMs(x.day, x.start)) / 60000);
  if (x.mins != null) m = Number(x.mins);                // clock in/out: the measured minutes (can pass 24 h)
  return Math.max(0, m - Number(x.brk || 0)) / 60;
}
function weekStart(iso) { const d = parseDay(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return ymd(d); }
function weekPay(start) {
  const end = addDays(start, 6), W = S.work;
  const shifts = W.shifts.filter(x => x.day >= start && x.day <= end).sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start));
  const hrs = shifts.reduce((s, x) => s + shiftHours(x), 0);
  const reg = Math.min(hrs, W.otAfter), ot = Math.max(0, hrs - W.otAfter);
  const gross = W.rate * (reg + ot * 1.5);
  return { shifts, hrs, reg, ot, gross, net: gross * (1 - W.taxPct / 100) };
}
// Pay period: weekly, or every 2 weeks counted from a start date the user
// sets. Overtime is still worked out WEEK BY WEEK inside the period - that is
// how overtime is owed (a 50h week + a 30h week is 10h of OT, not 0).
function periodStart(iso) {
  const W = S.work, ws = weekStart(iso);
  if (W.period !== "biweekly") return ws;
  const anchor = weekStart(W.periodStart || iso);
  const weeks = Math.round((parseDay(ws) - parseDay(anchor)) / (7 * 86400000));
  return addDays(ws, -7 * (((weeks % 2) + 2) % 2));
}
const periodWeeks = () => S.work.period === "biweekly" ? 2 : 1;
function periodPay(start) {
  const parts = Array.from({ length: periodWeeks() }, (_, i) => weekPay(addDays(start, 7 * i)));
  const sum = k => parts.reduce((n, p) => n + p[k], 0);
  return { start, end: addDays(start, 7 * periodWeeks() - 1), shifts: parts.flatMap(p => p.shifts),
           hrs: sum("hrs"), ot: sum("ot"), gross: sum("gross"), net: sum("net") };
}
// ----------------------------------------------------------------- budget
// Scott 2026-10-01: "tell people if spending looks over budgeted earnings -
// hourly calculated and pro rated, salary entered". One month at a time:
//   take-home  hourly = earned so far this month (shifts, OT per week, a week
//              that crosses the month edge is split by its hours) + the rest
//              of the month from scheduled shifts or the last 28 days' pace,
//              whichever is larger; salary = yearly / 12. Both minus tax %.
//   going out  every monthly bill + logged spending, projected to month end
//              at the current pace (from day 7 on - one big buy on the 2nd
//              should not read as a 15x month).
function grossBetween(from, to) {
  let g = 0;
  for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) {
    const wp = weekPay(ws); if (!wp.hrs) continue;
    const inside = wp.shifts.filter(x => x.day >= from && x.day <= to).reduce((n, x) => n + shiftHours(x), 0);
    g += wp.gross * inside / wp.hrs;
  }
  return g;
}
function budget() {
  const W = S.work, M = S.money, t = today(), keep = 1 - (W.taxPct || 0) / 100;
  const dim = new Date(+t.slice(0, 4), +t.slice(5, 7), 0).getDate();
  const m0 = t.slice(0, 8) + "01", m1 = t.slice(0, 8) + pad(dim), dayN = +t.slice(8, 10), daysLeft = dim - dayN + 1;
  let income = 0, how = "";
  if (M.type === "salary") { income = (M.salary || 0) / 12 * keep; how = `${money(M.salary)} a year`; }
  else if (W.rate) {
    const soFar = grossBetween(m0, t), scheduled = grossBetween(addDays(t, 1), m1);
    const pace = grossBetween(addDays(t, -28), addDays(t, -1)) / 28;
    income = (soFar + Math.max(scheduled, pace * (daysLeft - 1))) * keep;
    how = `${money(soFar * keep)} earned so far + the rest of the month at your pace`;
  }
  const bills = S.bills.reduce((n, b) => n + Number(b.amount || 0), 0);
  const spends = M.spends.filter(x => x.day >= m0 && x.day <= m1);
  const spent = spends.reduce((n, x) => n + Number(x.amt || 0), 0);
  const projSpend = dayN >= 7 ? spent / dayN * dim : spent;
  const left = income - bills - projSpend;
  const perDay = Math.max(0, (income - bills - spent) / daysLeft);
  const status = !income ? "none" : left < 0 ? "over" : left < income * 0.1 ? "tight" : "ok";
  return { income, how, bills, spent, spends, projSpend, left, perDay, status };
}
const fmtH = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
function onClock() {
  const c = S.work.clockIn; if (!c) return null;
  return (Date.now() - new Date(c).getTime()) / 3600000;
}

// ---------------------------------------------------------------- hero
const PHASES = [
  { to: 5,  g: "linear-gradient(160deg,#1e3c72,#2a1b5e 60%,#0a0e1c)", c: "#1e3c72" },   // night
  { to: 8,  g: "linear-gradient(160deg,#f6a35c,#e0607e 45%,#4b2c7f)", c: "#f6a35c" },   // dawn
  { to: 17, g: "linear-gradient(160deg,#38bdf8,#3b6fd8 50%,#312e81)", c: "#38bdf8" },   // day
  { to: 20, g: "linear-gradient(160deg,#fb923c,#e11d74 50%,#3b1a6b)", c: "#fb923c" },   // dusk
  { to: 24, g: "linear-gradient(160deg,#1e3c72,#2a1b5e 60%,#0a0e1c)", c: "#1e3c72" },   // night
];
function greet() {
  const h = new Date().getHours();
  const part = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return S.name ? `${part}, ${esc(S.name)}` : part;
}
// ------------------------------------------------------------ nightly reset
// Scott 10/2 ("now nightly reset"): before bed - what got done, what didn't
// (one tap moves it to tomorrow), a look at tomorrow, and "anything to
// remember tomorrow?" which comes back in the morning brief and on the hero.
function resetData() {
  const t = today(), done = [], open = [];
  S.todos.forEach(x => { if (x.doneDay === t && todoDone(x)) done.push(`✅ ${x.title}`);
    else if (todoShown(x) && !todoDone(x)) open.push({ k: "todos", id: x.id, title: x.title, rep: isRep(x) }); });
  ["loads", "jobs"].forEach(k => S[k].filter(x => x.day === t).forEach(x => x.done ? done.push(`${k === "loads" ? "🚚" : "🔧"} ${x.title}`)
    : open.push({ k, id: x.id, title: `${k === "loads" ? "🚚" : "🔧"} ${x.title}` })));
  const appts = dayItems(t).filter(i => (i.kind === "event" || i.kind === "g") && (!i.t || i.t <= nowT())).length;
  if (appts) done.push(`📅 ${appts} appointment${appts === 1 ? "" : "s"}`);
  const hrs = S.work.shifts.filter(x => x.day === t).reduce((n, x) => n + shiftHours(x), 0);
  if (hrs) done.push(`💼 ${fmtH(hrs)} worked`);
  return { done, open };
}
function tomorrowLine() {
  const T1 = addDays(today(), 1), w = WXDATA && WXDATA.here && WXDATA.here.days[1];
  const items = dayItems(T1), plans = items.filter(isPlan), f = plans.find(i => i.t);
  const al = alarmsOn(T1)[0];
  return [al ? `⏰ ${hm(al.time)}` : "", w ? `${wmo(w.code)[0]} ${Math.round(w.hi)}°/${Math.round(w.lo)}°${w.rain >= 40 ? ` · rain ${w.rain}%` : ""}` : "",
    f ? `first up ${hm(f.t)} ${f.title}` : plans.length ? `${plans.length} planned` : "nothing planned",
    ...items.filter(i => i.kind === "bill").map(b => `💳 ${b.title} due`)].filter(Boolean).join(" · ");
}
function resetHtml() {
  const t = today(), T1 = addDays(t, 1), { done, open } = resetData();
  const mem = S.remember.filter(r => r.day === T1);
  if (S.resetDay === t) return `<div class="today-line">✓ Day closed${S.resetAt ? ` at ${esc(fmtTime(S.resetAt))}` : ""} — ${done.length} thing${done.length === 1 ? "" : "s"} done. Sleep well 😴</div>
    ${mem.length ? `<div class="today-line">📌 For the morning: ${mem.map(r => esc(r.text)).join(" · ")}</div>` : ""}
    ${alarmNote(T1) ? `<div class="today-line">${esc(alarmNote(T1))}</div>` : ""}
    <div class="foot-actions"><button class="btn sm ghost" data-reset="reopen">Open it again</button></div>`;
  const moveable = open.filter(o => o.k !== "todos");
  const rows = open.map(o => `<div class="row"><span class="grow">${esc(o.title)}${o.rep ? ` <span class="sub">repeats — back tomorrow</span>` : ""}</span>
      <button class="x" data-rdone="${o.k}:${o.id}" aria-label="Done">✓</button>${o.k === "todos"
      ? (o.rep ? "" : `<button class="x" data-rdrop="${o.id}" aria-label="Drop it">✕</button>`)
      : `<button class="x" data-rmove="${o.k}:${o.id}" aria-label="Move to tomorrow">→</button>`}</div>`).join("");
  return `<div class="rs-h">Got done today</div>
    <div class="today-line">${done.length ? done.map(esc).join("<br>") : "Nothing checked off yet — that's okay."}</div>
    <div class="rs-h">Still open${open.length ? ` (${open.length})` : ""}</div>
    ${open.length ? rows
      + (moveable.length > 1 ? `<button class="add-link" data-rmove="all">→ Move all ${moveable.length} to tomorrow</button>` : "")
      + (open.some(o => o.k === "todos" && !o.rep) ? `<p class="fine" style="margin-top:6px">Open to-dos stay on your list for tomorrow. ✕ drops one.</p>` : "")
      : `<div class="today-line">Nothing left over 🎉</div>`}
    <div class="rs-h">Tomorrow</div><div class="today-line">${esc(tomorrowLine())}</div>
    ${dayItems(T1).filter(i => !["sun", "rain"].includes(i.kind)).slice(0, 10).map(i => `<div class="row"><span class="time">${i.t ? hm(i.t) : "All day"}</span><span class="grow">${i.icon} ${esc(i.title)}${i.kind === "g" ? ` <span class="gbadge">Google</span>` : ""}</span></div>`).join("")}
    ${(n => n ? `<div class="today-line">${esc(n)} <button class="add-link" data-qa="alarm" style="display:inline;margin:0">${alarmsOn(T1).length ? "change" : "＋ add alarm"}</button></div>` : `<div class="today-line"><button class="add-link" data-qa="alarm" style="margin:0">⏰ ＋ Add your alarm</button></div>`)(alarmNote(T1))}
    <form data-remember class="rs-mem"><input name="text" placeholder="Anything to remember tomorrow?" autocomplete="off" maxlength="200"><button class="btn sm">Add</button></form>
    ${mem.map(r => `<div class="row"><span class="grow">📌 ${esc(r.text)}</span><button class="x" data-rmdel="${r.id}" aria-label="Remove">✕</button></div>`).join("")}
    <div class="foot-actions" style="margin-top:10px"><button class="btn sm" data-reset="close">✓ Close my day</button></div>`;
}
function resetSummary() {
  const { done, open } = resetData();
  return `${done.length} done · ${open.length ? `${open.length} still open` : "nothing left over"} · tomorrow: ${tomorrowLine()}`;
}

// ------------------------------------------------- weather intelligence
// Scott 10/2 (list #13): don't just say 78° - connect the weather to the day.
// Outdoor plans in the rain, a freeze tonight, real heat, storms, ice/snow,
// strong gusts and a big drop tomorrow. Shown on the Weather card, the top of
// the screen, the morning brief and the Tomorrow card; a freeze also gets a
// 6 PM reminder. Free: built from the forecast Day Hub already downloads.
const OUTDOOR = /\b(mow|mowing|lawn|yard|garden|gardening|outside|outdoors?|bbq|barbecue|grill|cookout|picnic|park|hike|hiking|walk|run|jog|bike|biking|golf|fishing|hunt|hunting|game|practice|soccer|baseball|softball|football|tennis|pool|beach|lake|boat|camping|car wash|wash (?:the )?car|roof|gutters?|fence|deck|patio|parade|festival|fair|zoo|farmers market|tailgate|wedding|yard sale|garage sale)\b/i;
function wxAlerts(day) {
  const w = WXDATA && WXDATA.here; if (!w || !w.days) return [];
  const i = w.days.findIndex(d => d.d === day); if (i < 0) return [];
  const d = w.days[i], next = w.days[i + 1], out = [], add = (icon, text, key) => out.push({ icon, text, key });
  // Outdoor plans that run into rain (hour by hour when we have it)
  dayItems(day).filter(x => isPlan(x) && x.t && OUTDOOR.test(`${x.title} ${x.sub || ""}`)).forEach(x => {
    const h = x.t.slice(0, 2), h2 = pad((Number(h) + 1) % 24), hb = w.byHour || {};
    const r = Math.max((hb[`${day}T${h}`] || {}).rain ?? -1, (hb[`${day}T${h2}`] || {}).rain ?? -1);
    if (r >= 50 || (r < 0 && d.rain >= 60)) add("☔", `Rain likely at ${hm(x.t)} — your “${x.title}”${r >= 0 ? ` (${r}%)` : ""}`, "rain-plan");
    const tp = (hb[`${day}T${h}`] || {}).temp;
    if (tp != null && tp <= 40) add("🧥", `${Math.round(tp)}° at ${hm(x.t)} for “${x.title}” — dress warm`, "cold-plan");
  });
  if ([95, 96, 99].includes(d.code)) add("⛈️", "Thunderstorms possible — check the sky before you head out", "storm");
  if ([56, 57, 66, 67].includes(d.code)) add("🧊", "Freezing rain — icy roads and steps, leave early", "ice");
  if ([71, 73, 75, 77, 85, 86].includes(d.code)) add("❄️", "Snow possible — leave early, scrape the car", "snow");
  if (d.hi >= 95) add("🥵", `Hot one — high ${Math.round(d.hi)}°. Water and shade; never leave kids or pets in the car`, "heat");
  if (d.gust != null && d.gust >= 35) add("💨", `Gusts to ${Math.round(d.gust)} mph — tie down trash cans and patio stuff`, "wind");
  if (next && next.lo <= 32) add("🥶", `${next.lo <= 25 ? "Hard freeze" : "Freeze"} tonight — low ${Math.round(next.lo)}°. Drip faucets, cover plants, bring pets in`, "freeze");
  if (next && d.hi - next.hi >= 15) add("📉", `Much colder tomorrow — high ${Math.round(next.hi)}° (down ${Math.round(d.hi - next.hi)}°)`, "drop");
  return out;
}
const wxAlertHtml = list => list.map(a => `<div class="wx-alert">${a.icon} ${esc(a.text)}</div>`).join("");

// ------------------------------------------------------- people & dates
// Scott 10/2 (list #11, "do both its a mobil planner"): birthdays,
// anniversaries and important dates that do more than sit there -
// "Roxanne's birthday in 12 days — gift?" with your gift ideas, a ✓ Got it,
// a nudge 2 weeks / 3 days ahead and on the day, on the schedule and in the
// phone calendar every year.
const PKIND = { birthday: "🎂", anniversary: "💍", other: "⭐" };
const pDayIn = (p, y) => { const [m, d] = p.md.split("-").map(Number); return `${y}-${pad(m)}-${pad(Math.min(d, new Date(y, m, 0).getDate()))}`; };
function personNext(p) { const t = today(), y = Number(t.slice(0, 4)); const d = pDayIn(p, y); return d >= t ? d : pDayIn(p, y + 1); }
const personOn = (p, day) => pDayIn(p, Number(day.slice(0, 4))) === day;
function personLabel(p, day) {
  const n = p.year ? Number(day.slice(0, 4)) - Number(p.year) : null;
  return p.kind === "birthday" ? `${p.name}'s birthday${n > 0 ? ` (turns ${n})` : ""}`
       : p.kind === "anniversary" ? `${p.name}${/anniversary/i.test(p.name) ? "" : " anniversary"}${n > 0 ? ` (${n} years)` : ""}` : p.name;
}
const giftDue = (p, day) => p.lead > 0 && !p.got[day.slice(0, 4)] && daysUntil(day) <= p.lead && daysUntil(day) >= 0;
const upcomingPeople = (within = 60) => S.people.map(p => ({ p, day: personNext(p) })).filter(x => daysUntil(x.day) <= within).sort((a, b) => a.day.localeCompare(b.day));
let PERSON_EDIT = null;

// ------------------------------------------------------- don't forget
// Scott 10/2 (list #15): the leaving-home check - wallet, keys, meds, lunch,
// badge... your own list, ticked fresh each day, plus what TODAY adds on its
// own: umbrella when it will rain, a jacket when it's cold, water when it's
// hot, ID on a travel day, the gym bag on a gym day, the insurance card on a
// doctor day.
const LEAVE_DEFAULT = ["👛 Wallet", "🔑 Keys", "📱 Phone + charger", "💊 Medication", "🥪 Lunch", "🪪 Work badge"];
function leaveExtras() {
  const t = today(), w = WXDATA && WXDATA.here, out = [], add = (id, text, why) => out.push({ id: "x-" + id, text, why });
  if (w && w.day) {
    if (w.day.rainFrom || w.day.rain >= 50) add("umbrella", "☂️ Umbrella", w.day.rainFrom ? `rain from ${fmtTime(w.day.rainFrom)}` : `rain ${w.day.rain}%`);
    if (w.day.lo <= 45) add("jacket", "🧥 Jacket", `low ${Math.round(w.day.lo)}°`);
    if (w.day.hi >= 92) add("water", "💧 Water bottle", `high ${Math.round(w.day.hi)}°`);
  }
  const plans = dayItems(t).filter(isPlan).map(i => `${i.title} ${i.sub || ""}`).join(" | ");
  if (/\b(gym|workout|lift|yoga|swim|crossfit|practice)\b/i.test(plans)) add("gym", "👟 Gym bag", "on today's plan");
  if (/\b(doctor|dentist|dr\.?|clinic|hospital|appointment|vet|eye exam|physical)\b/i.test(plans)) add("ins", "🪪 Insurance card", "appointment today");
  if (S.trips.some(tr => tr.start === t || tr.start === addDays(t, 1))) add("id", "🛂 ID / passport + travel docs", "trip");
  return out;
}
const leaveDone = () => S.leave.day === today() ? S.leave.done : [];
const leaveAll = () => [...leaveExtras().map(x => ({ ...x, extra: true })), ...S.leave.items];
const leaveLeft = () => { const d = leaveDone(); return leaveAll().filter(x => !d.includes(x.id)).length; };

// ------------------------------------------------------- home & car upkeep
// Scott 10/2 (list #9 + #10, "cont"): the things a house and a car need on a
// clock - trash day, HVAC filter, smoke-alarm batteries, oil change,
// registration, insurance... Tap a common one, set the date, ✓ Done restarts
// the clock. Trash / recycling roll forward by themselves with a "cans out
// tonight" nudge the evening before. On the schedule, the top of the screen,
// the morning brief and as reminders.
const UPKEEP_PRESETS = {
  home: [["🗑️ Trash day", 1, "weeks", true], ["♻️ Recycling", 2, "weeks", true], ["🌬️ HVAC filter", 3, "months"], ["🔥 Smoke alarm batteries", 12, "months"],
         ["🐜 Pest control", 3, "months"], ["🌱 Mow the lawn", 1, "weeks"], ["💧 Water heater flush", 12, "months"], ["🧺 Dryer vent clean", 12, "months"], ["🧊 Fridge water filter", 6, "months"]],
  auto: [["🛢️ Oil change", 3, "months"], ["🛞 Tire rotation", 6, "months"], ["📋 Registration renewal", 12, "months"], ["🛡️ Insurance renewal", 6, "months"],
         ["🔍 Inspection", 12, "months"], ["🧽 Car wash", 2, "weeks"], ["🌧️ Wiper blades", 12, "months"]],
};
const UNIT_WORD = { days: "day", weeks: "week", months: "month", years: "year" };
function addEvery(day, n, unit) {
  const d = parseDay(day); n = Number(n);
  if (unit === "days") d.setDate(d.getDate() + n); else if (unit === "weeks") d.setDate(d.getDate() + 7 * n);
  else { const m = unit === "years" ? 12 * n : n, dd = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + m);
    d.setDate(Math.min(dd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  return ymd(d);
}
function upkeepNext(x) {
  const t = today();
  if (x.auto) { let d = x.next || x.last; let guard = 0; while (d < t && guard++ < 600) d = addEvery(d, x.every, x.unit); return d; }
  if (x.next) return x.next;
  return addEvery(x.last, x.every, x.unit);
}
const upkeepDue = (area, within = 14) => S.upkeep.filter(x => !area || x.area === area).map(x => ({ x, day: upkeepNext(x) }))
  .filter(o => daysUntil(o.day) <= within).sort((a, b) => a.day.localeCompare(b.day));
const upkeepWhen = (x, day) => { const n = daysUntil(day);
  return n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? (x.auto ? "today" : "due today") : n === 1 ? "tomorrow" : `in ${n} days`; };
let UPKEEP_EDIT = null, UPKEEP_PRESET = null;
function upkeepCard(area) {
  const list = S.upkeep.filter(x => x.area === area).map(x => ({ x, day: upkeepNext(x) })).sort((a, b) => a.day.localeCompare(b.day));
  const chips = UPKEEP_PRESETS[area].filter(([n]) => !S.upkeep.some(x => x.area === area && x.name === n))
    .map(([n], i) => `<button class="chip" data-upreset="${area}:${UPKEEP_PRESETS[area].findIndex(p => p[0] === n)}">${esc(n)}</button>`).join("");
  return (list.length ? list.map(({ x, day }) => { const n = daysUntil(day);
      return `<div class="row ${n < 0 ? "late" : ""}"><span class="grow"><b>${esc(x.name)}</b>
          <span class="sub">${upkeepWhen(x, day)} · ${prettyDate(day)} · every ${x.every > 1 ? x.every + " " + x.unit : UNIT_WORD[x.unit]}</span></span>
        ${!x.auto && n <= 14 ? `<button class="btn sm ghost" data-updone="${x.id}">✓ Done</button>` : ""}
        <button class="x" data-upedit="${x.id}" aria-label="Edit">✏️</button></div>`; }).join("")
      : `<div class="empty">${area === "home" ? "Trash day, filters, batteries — tap one to start:" : "Oil, tires, registration, insurance — tap one to start:"}</div>`) +
    (chips ? `<div class="chips up-chips">${chips}</div>` : "");
}

// ------------------------------------------------------------- routines
// Scott 10/2 (list #14): Morning, Workday, Evening, Weekend, Vacation - one
// tap brings up the whole checklist instead of rebuilding it every time.
// Your steps, ticked fresh each day; optional days + time for a nudge.
const ROUTINE_PRESETS = [
  ["☀️ Morning", ["Make the bed", "Meds", "Glass of water", "Stretch 5 minutes", "Look over today in Day Hub"], [1, 2, 3, 4, 5], "07:00"],
  ["💼 Workday shutdown", ["Clear the inbox", "Pick tomorrow's top 3", "Log my hours", "Tidy the desk"], [1, 2, 3, 4, 5], "17:00"],
  ["🌙 Evening", ["Dishes", "Lay out clothes", "Charge phone", "Lock up", "Nightly reset in Day Hub"], [], "21:00"],
  ["🧹 Weekend reset", ["Laundry", "Groceries", "Clean the kitchen", "Trash out", "Plan the week"], [6], "10:00"],
  ["🧳 Vacation prep", ["Hold the mail", "Plants / pet care set", "Thermostat down", "Unplug small stuff", "Trash out", "Lock windows + doors"], [], null],
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let ROUTINE_OPEN = null, ROUTINE_EDIT = null;
const rDone = r => { const x = S.rdone[r.id]; return x && x.day === today() ? x.ids : []; };
const rToday = r => r.days.includes(new Date().getDay());
const rLeft = r => r.steps.filter(x => !rDone(r).includes(x.id)).length;
function addRoutine(name, steps, days, time) {
  const r = { id: uid(), name, steps: steps.map(text => ({ id: uid(), text })), days: days || [], time: time || null };
  S.routines.push(r); return r;
}
// The routine that matters right now: scheduled today, within 2 h of its time, not finished.
function routineNow() {
  const now = toMin(nowT());
  return S.routines.find(r => rToday(r) && r.time && rLeft(r) && Math.abs(toMin(r.time) - now) <= 120) || null;
}
function routinesCard() {
  if (!S.routines.length) return `<div class="empty">Checklists you run again and again — tap one to add it:</div>
    <div class="chips up-chips">${ROUTINE_PRESETS.map((r, i) => `<button class="chip" data-radd="${i}">${esc(r[0])}</button>`).join("")}</div>`;
  const open = ROUTINE_OPEN || (routineNow() || {}).id;
  return S.routines.map(r => { const d = rDone(r), left = rLeft(r), isOpen = r.id === open;
    return `<div class="routine ${isOpen ? "open" : ""}">
      <div class="row"><button class="grow r-head" data-ropen="${r.id}"><b>${esc(r.name)}</b>
          <span class="sub">${left ? `${d.length}/${r.steps.length}` : "✅ done today"}${r.days.length ? ` · ${r.days.length === 7 ? "every day" : r.days.map(n => DOW[n]).join(" ")}` : ""}${r.time ? ` · ${hm(r.time)}` : ""}</span></button>
        <button class="btn sm ${isOpen ? "ghost" : ""}" data-ropen="${r.id}">${isOpen ? "Close" : left ? "Start ▸" : "View"}</button>
        <button class="x" data-redit="${r.id}" aria-label="Edit">✏️</button></div>
      ${isOpen ? r.steps.map(x => `<label class="row leave ${d.includes(x.id) ? "done" : ""}"><input type="checkbox" class="tick" data-rstep="${r.id}:${x.id}" ${d.includes(x.id) ? "checked" : ""}><span class="grow">${esc(x.text)}</span></label>`).join("")
        + (left ? "" : `<div class="today-line">✅ ${esc(r.name.replace(/^\S+\s/, ""))} done!</div>`)
        + (d.length ? `<div class="foot-actions"><button class="add-link" data-rreset="${r.id}">Start over</button></div>` : "") : ""}</div>`; }).join("")
    + `<div class="chips up-chips">${ROUTINE_PRESETS.filter(p => !S.routines.some(r => r.name === p[0])).map(p => `<button class="chip" data-radd="${ROUTINE_PRESETS.indexOf(p)}">＋ ${esc(p[0])}</button>`).join("")}</div>`;
}

// ---------------------------------------------------------------- payday
// Scott 10/2 (list #7, "next"): organise around the paycheck, not a bank app.
// When it comes, which bills land before it, which bills THIS check has to
// cover until the one after, roughly what's left, and savings goals to put
// a little toward. Take-home is what you type, or an estimate from Work hours.
const PAY_FREQ = { weekly: "Every week", biweekly: "Every 2 weeks", semimonthly: "Twice a month", monthly: "Once a month" };
const PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
function payNext(from = today()) {
  const P = S.payday; if (!P.freq || !P.next) return null;
  const clamp = (y, m, d) => ymd(new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate())));
  if (P.freq === "weekly" || P.freq === "biweekly") {
    const step = P.freq === "weekly" ? 7 : 14; let d = P.next, g = 0;
    while (d < from && g++ < 2000) d = addDays(d, step);
    while (addDays(d, -step) >= from && g++ < 4000) d = addDays(d, -step);
    return d;
  }
  const f = parseDay(from);
  for (let k = 0; k < 14; k++) {
    const y = f.getFullYear(), m = f.getMonth() + Math.floor(k / 2);
    const days = P.freq === "monthly" ? [Number(P.next.slice(8))] : [Number(P.d1) || 1, Number(P.d2) || 15].sort((a, b) => a - b);
    for (const d of days) { const c = clamp(y, m, d); if (c >= from) return c; }
  }
  return null;
}
const payAfter = d => payNext(addDays(d, 1));
function payAmount() {
  const P = S.payday, keep = 1 - (S.work.taxPct || 0) / 100;
  if (Number(P.amount) > 0) return { amt: Number(P.amount), est: false };
  if (S.money.type === "salary" && S.money.salary) return { amt: S.money.salary * keep / PER_YEAR[P.freq], est: true };
  if (S.work.rate) { const per = PER_YEAR[P.freq], last = grossBetween(addDays(today(), -28), addDays(today(), -1)) * keep;
    if (last) return { amt: last * 13 / per, est: true }; }              // the last 4 weeks, spread per check
  return { amt: 0, est: true };
}
// Bills (and trip final payments) due from `from` up to (not including) `to`.
function dueBetween(from, to) {
  const out = [];
  S.bills.forEach(b => { for (let k = 0; k < 3; k++) { const d = nextDueFrom(b, from, k); if (d && d >= from && d < to && !out.some(o => o.id === b.id && o.day === d)) out.push({ id: b.id, name: b.name, amt: Number(b.amount) || 0, day: d, icon: "💳" }); } });
  S.trips.forEach(tr => { if (tr.finalDue && tr.finalDue >= from && tr.finalDue < to && tripLeft(tr)) out.push({ id: tr.id, name: `${tr.name} final payment`, amt: tripLeft(tr), day: tr.finalDue, icon: "🚢" }); });
  return out.sort((a, b) => a.day.localeCompare(b.day));
}
// The k-th monthly due date of bill b on/after `from` (ignores "paid" - this is planning).
function nextDueFrom(b, from, k) {
  const f = parseDay(from), y = f.getFullYear(), m = f.getMonth() + k;
  const d = ymd(new Date(y, m, Math.min(b.day, new Date(y, m + 1, 0).getDate())));
  return d >= from ? d : null;
}
const goalPct = g => g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0;
function paydayCard() {
  const P = S.payday;
  if (!P.freq) return `<p class="fine" style="margin-top:0">Set it up once (30 seconds):</p>
    <form class="pay-setup" data-paysetup="1">
      <ol class="steps"><li>How often do you get paid?<select name="freq">${Object.entries(PAY_FREQ).map(([k, v]) => `<option value="${k}" ${k === "biweekly" ? "selected" : ""}>${v}</option>`).join("")}</select></li>
      <li>Your next payday<input name="next" type="date" value="${addDays(today(), 7)}" required></li>
      <li>Twice a month only — the other payday (day of the month, 31 = last day)<input name="d2" type="number" min="1" max="31" value="15"></li>
      <li>Take-home per check (optional — leave blank and Day Hub estimates from Work hours)<input name="amount" type="number" min="0" step="0.01" placeholder="$"></li></ol>
      <button class="btn sm">Save</button></form>`;
  const t = today(), nx = payNext(t), n = daysUntil(nx), after = payAfter(nx), pa = payAmount();
  const before = n > 0 ? dueBetween(t, nx) : [], covers = dueBetween(nx, after);
  const tot = l => l.reduce((x, o) => x + o.amt, 0), row = o => `<div class="row"><span class="time">${prettyDate(o.day)}</span><span class="grow">${o.icon} ${esc(o.name)}</span><b>${money(o.amt)}</b></div>`;
  const left = pa.amt ? pa.amt - tot(covers) : null;
  return `<div class="pay-head">${n === 0 ? "💵 <b>Payday today!</b>" : `💵 Next payday <b>${dayName(nx) === "Tomorrow" ? "tomorrow" : prettyDate(nx)}</b> <span class="sub">${inDays(n)}</span>`}
      ${pa.amt ? `<span class="sub">${pa.est ? "≈ " : ""}${money(pa.amt)} take-home${pa.est ? " (estimate)" : ""}</span>` : ""}</div>
    ${before.length ? `<div class="rs-h">Due before payday · ${money(tot(before))}</div>${before.map(row).join("")}` : ""}
    <div class="rs-h">${n === 0 ? "This check covers" : "That check covers"} (until ${prettyDate(after)}) · ${money(tot(covers))}</div>
    ${covers.length ? covers.map(row).join("") : `<div class="today-line">No bills in that stretch 🎉</div>`}
    ${left !== null ? `<div class="today-line pay-left ${left < 0 ? "neg" : ""}">${left < 0 ? "⚠️ Short by" : "Left after bills ≈"} <b>${money(Math.abs(left))}</b></div>` : ""}
    <div class="rs-h">Savings goals</div>
    ${S.goals.map(g => `<div class="goal"><div class="row"><span class="grow"><b>${esc(g.name)}</b> <span class="sub">${money(g.saved)} of ${money(g.target)} · ${goalPct(g)}%</span></span>
        <button class="x" data-goaldel="${g.id}" aria-label="Remove">✕</button></div>
        <div class="gbar"><span style="width:${goalPct(g)}%"></span></div>
        <form class="inline-add" data-goaladd="${g.id}"><input name="amt" type="number" min="0" step="0.01" placeholder="Put $ toward it" required><button class="btn sm">＋ Add</button></form></div>`).join("")}
    <form class="inline-add" data-goalnew="1"><input name="name" placeholder="New goal (e.g. Christmas)" required autocomplete="off"><input name="target" type="number" min="1" step="1" placeholder="$ target" required style="max-width:110px"><button class="btn sm">Add</button></form>
    <div class="foot-actions"><button class="add-link" data-payedit="1">Change payday settings</button></div>`;
}

// ------------------------------------------------------------- life pulse
// Scott 10/2 (list #1, "next"): one number for how READY today is. Starts at
// 100 and loses points for what still needs you - late or near bills, open
// to-dos, weather that clashes with a plan, appointments that overlap, overdue
// home/car items, the leaving list, a routine waiting, a gift not bought, a
// payday that comes up short. Tap the ring: the list, worst first, each with
// a button that jumps to the card that fixes it.
function overlaps(day) {
  const ev = dayItems(day).filter(i => isPlan(i) && i.t).map(i => ({ ...i, a: toMin(i.t), b: i.end ? toMin(i.end) : toMin(i.t) + 60 }))
    .sort((x, y) => x.a - y.a), out = [];
  for (let i = 1; i < ev.length; i++) if (ev[i].a < ev[i - 1].b && ev[i].kind !== "work" && ev[i - 1].kind !== "work") out.push([ev[i - 1], ev[i]]);
  return out;
}
function pulseItems() {
  const t = today(), h = new Date().getHours(), out = [], add = (pts, icon, text, card) => out.push({ pts, icon, text, card });
  upcomingBills().forEach(b => { const n = daysUntil(b.due);
    if (n < 0) add(15, "💳", `${b.name} is ${-n} day${n === -1 ? "" : "s"} late (${money(b.amount)})`, "bills");
    else if (n <= 1) add(8, "💳", `${b.name} due ${inDays(n)} (${money(b.amount)})`, "bills"); });
  overlaps(t).forEach(([a, b]) => add(10, "⚠️", `${a.title} (${hm(a.t)}) overlaps ${b.title} (${hm(b.t)})`, "schedule"));
  wxAlerts(t).slice(0, 2).forEach(a => add(8, a.icon, a.text, "weather"));
  const todo = S.todos.filter(x => todoShown(x) && !todoDone(x));
  if (todo.length) add(Math.min(25, todo.length * 5), "✅", `${todo.length} to-do${todo.length === 1 ? "" : "s"} open — ${todo.slice(0, 2).map(x => x.title).join(", ")}${todo.length > 2 ? "…" : ""}`, "todos");
  S.upkeep.map(x => ({ x, d: upkeepNext(x) })).filter(o => !o.x.auto && daysUntil(o.d) <= 0)
    .forEach(o => add(daysUntil(o.d) < 0 ? 6 : 4, o.x.area === "auto" ? "🚗" : "🏠", `${o.x.name} ${upkeepWhen(o.x, o.d)}`, o.x.area));
  if (h < 11 && S.hidden.indexOf("leave") < 0) { const n = leaveLeft(); if (n && leaveDone().length) add(Math.min(10, n * 2), "🚪", `${n} thing${n === 1 ? "" : "s"} left on your leaving list`, "leave"); }
  const rn = routineNow(); if (rn) add(5, "🔁", `${rn.name.replace(/^\S+\s/, "")} routine — ${rLeft(rn)} step${rLeft(rn) === 1 ? "" : "s"} left`, "routines");
  upcomingPeople(7).filter(({ p, day }) => giftDue(p, day) && daysUntil(day) > 0).forEach(({ p, day }) => add(5, "🎁", `Gift for ${personLabel(p, day)} — ${inDays(daysUntil(day))}`, "people"));
  S.remember.filter(r => r.day === t).forEach(r => add(3, "📌", r.text, null));
  openReturns().filter(r => daysUntil(r.by) <= 2).forEach(r => add(daysUntil(r.by) < 0 ? 4 : 8, "↩️", `Return ${r.what} — ${retWhen(r)}${r.amount ? ` (${money(r.amount)})` : ""}`, "packages"));
  { const nx = payNext(); if (nx && daysUntil(nx) <= 3) { const pa = payAmount(), c = dueBetween(nx, payAfter(nx)), tot = c.reduce((x, o) => x + o.amt, 0);
      if (pa.amt && pa.amt < tot) add(10, "💵", `Next check comes up ${money(tot - pa.amt)} short of the bills it covers`, "payday"); } }
  return out.sort((a, b) => b.pts - a.pts);
}
function pulseScore() { return Math.max(0, 100 - pulseItems().reduce((n, x) => n + x.pts, 0)); }
const pulseWord = n => n >= 90 ? "Ready" : n >= 70 ? "Mostly ready" : n >= 50 ? "A few things" : "Needs you";
function pulseRing() {
  const n = pulseScore(), c = n >= 90 ? "#34d399" : n >= 70 ? "#a3e635" : n >= 50 ? "#fbbf24" : "#fb7185", r = 15, L = 2 * Math.PI * r;
  return `<button class="pulse" data-pulse="1" aria-label="Life pulse ${n} — ${pulseWord(n)}">
    <svg viewBox="0 0 36 36" width="40" height="40"><circle cx="18" cy="18" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="4"/>
      <circle cx="18" cy="18" r="${r}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(L * n / 100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 18 18)"/>
      <text x="18" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${n}</text></svg>
    <span class="pw">${pulseWord(n)}</span></button>`;
}
function showPulse() {
  let el = document.getElementById("pulseSheet");
  if (!el) { el = document.createElement("div"); el.id = "pulseSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); document.body.appendChild(el); }
  const items = pulseItems(), n = pulseScore();
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>Life pulse · ${n}</h2><button class="icon-btn" data-pulseclose="1" aria-label="Close">✕</button></div>
    <p class="fine" style="margin-top:4px">${n >= 90 ? "You're ready for today 🟢" : "What still needs you today — biggest first:"}</p>
    ${items.length ? items.map(x => `<div class="row pulse-row"><span class="grow">${x.icon} ${esc(x.text)}</span><span class="sub">−${x.pts}</span>
      ${x.card ? `<button class="btn sm ghost" data-pulsego="${x.card}">Go</button>` : ""}</div>`).join("") : `<div class="today-line">Nothing waiting on you. Enjoy the day ✨</div>`}
  </div>`;
  el.classList.remove("hidden");
}

// ------------------------------------------------- ask day hub + top 3
// Scott 10/2 (list #17 + #18, on the AI relay): ask in plain words instead of
// digging ("When's my next oil change?", "What didn't I finish?") and a daily
// Top 3 - the three things that matter most today, which you can tick, move
// or drop. The question goes to Claude with a SUMMARY of your own planner
// (next two weeks, open to-dos, bills, upkeep, dates, payday...), nothing else.
// Without the AI helper, Top 3 is picked on the phone from the Life pulse.
function aiContext() {
  const t = today(), d = n => addDays(t, n), out = { today: t, now: hm(nowT()), name: S.name || null };
  out.schedule = []; for (let i = -1; i <= 14; i++) { const day = d(i);
    dayItems(day).filter(x => !["sun", "rain"].includes(x.kind)).forEach(x => out.schedule.push({ day, time: x.t ? hm(x.t) : null, what: x.title, note: x.sub || undefined, kind: x.kind })); }
  out.openTodos = S.todos.filter(x => todoShown(x) && !todoDone(x)).map(x => x.title);
  out.doneToday = S.todos.filter(x => x.doneDay === t).map(x => x.title);
  out.bills = upcomingBills().map(b => ({ name: b.name, amount: money(b.amount), due: b.due }));
  out.homeAndCar = S.upkeep.map(x => ({ what: x.name.replace(/^\S+\s/, ""), area: x.area, next: upkeepNext(x), last: x.last || null }));
  out.peopleDates = S.people.map(p => ({ what: personLabel(p, personNext(p)), date: personNext(p), giftIdeas: p.ideas || undefined, giftBought: !!p.got[personNext(p).slice(0, 4)] }));
  out.countdowns = briefCountdowns().map(c => ({ what: c.title, date: c.day, daysLeft: c.n }));
  { const nx = payNext(); if (nx) out.payday = { next: nx, takeHome: (a => a.amt ? money(a.amt) : null)(payAmount()), billsBeforeIt: dueBetween(t, nx).map(o => `${o.name} ${money(o.amt)} ${o.day}`) }; }
  out.goals = S.goals.map(g => ({ goal: g.name, saved: money(g.saved), target: money(g.target) }));
  out.lists = S.lists.map(l => ({ list: l.name, toGet: l.items.filter(i => !i.done).map(i => i.text) })).filter(l => l.toGet.length);
  out.packages = S.packages.filter(x => !x.delivered).map(x => ({ what: x.name, eta: x.eta || null }));
  out.routines = S.routines.map(r => ({ name: r.name, steps: r.steps.map(x => x.text), days: r.days.map(n => DOW[n]), time: r.time ? hm(r.time) : null }));
  out.notes = S.notes.slice(-25).map(n => String(n.text).slice(0, 140));
  out.workThisPeriod = (p => p.hrs ? { hours: fmtH(p.hrs), takeHome: money(p.net) } : null)(periodPay(periodStart(t)));
  out.weatherToday = WXDATA && WXDATA.here && WXDATA.here.day ? { hi: Math.round(WXDATA.here.day.hi), lo: Math.round(WXDATA.here.day.lo), rainFrom: WXDATA.here.day.rainFrom ? fmtTime(WXDATA.here.day.rainFrom) : null } : null;
  out.alerts = pulseItems().map(x => x.text);
  out.futureMe = S.future.map(f => ({ saved: f.created.slice(0, 10), note: f.text }));
  let j = JSON.stringify(out);
  if (j.length > 14000) { out.notes = out.notes.slice(-5); out.schedule = out.schedule.filter(x => x.day <= d(7)); j = JSON.stringify(out); }
  return j.slice(0, 15000);
}
let ASK_BUSY = false, ASK_LOG = [];
function showAsk() {
  let el = document.getElementById("askSheet");
  if (!el) { el = document.createElement("div"); el.id = "askSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); document.body.appendChild(el); }
  const ex = ["What's happening tomorrow?", "When is my next oil change?", "What haven't I finished this week?", "What bills are due before payday?"];
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>💡 Ask Day Hub</h2><button class="icon-btn" data-askclose="1" aria-label="Close">✕</button></div>
    ${aiOn() ? `<form class="ask-form" data-ask="1"><input name="q" placeholder="Ask anything about your day…" autocomplete="off" required>
        <button type="button" class="btn sm ghost" data-askmic="1" aria-label="Talk">🎤</button><button class="btn sm">Ask</button></form>
      <div class="chips up-chips">${ex.map(q => `<button class="chip" data-askq="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <div id="askOut">${ASK_LOG.map(a => `<div class="ask-q">${esc(a.q)}</div><div class="ask-a">${esc(a.a)}</div>`).join("")}</div>`
    : `<p class="fine" style="margin-top:4px">Ask in plain words — "When's my next oil change?" — and Day Hub answers from your own planner.</p>
       <ol class="steps"><li>Tap ⚙ (top right).</li><li>Find <b>🤖 AI helper</b>, type your passphrase, tap <b>Turn on</b>.</li></ol>
       <button class="btn sm" data-askclose="1" data-open="sheet">Open ⚙</button>`}
  </div>`;
  el.classList.remove("hidden");
  setTimeout(() => { const i = el.querySelector("input[name=q]"); if (i) i.focus(); }, 60);
}
async function askDayHub(q) {
  q = String(q || "").trim(); if (!q || ASK_BUSY) return;
  ASK_BUSY = true; ASK_LOG.unshift({ q, a: "…thinking" }); showAsk();
  try { ASK_LOG[0].a = String((await aiCall("ask", `QUESTION: ${q}\n\nMY PLANNER (JSON):\n${aiContext()}`)).text || "").trim() || "I couldn't find that in your planner."; }
  catch (e) { ASK_LOG[0].a = `⚠️ ${/passphrase/.test(e.message) ? "The AI helper's passphrase changed — set it again in ⚙" : "Couldn't reach the AI helper right now. Try again in a minute."}`; }
  ASK_LOG = ASK_LOG.slice(0, 6); ASK_BUSY = false; showAsk();
}
// Top 3: AI pick once a day (when on), else a quick pick from the Life pulse + today's plan.
function top3Quick() {
  const out = pulseItems().slice(0, 3).map(x => ({ title: x.text, why: "needs you today" }));
  const nx = dayItems(today()).filter(i => isPlan(i) && i.t && i.t >= nowT()).slice(0, 3 - out.length);
  nx.forEach(i => out.push({ title: `${i.title} at ${hm(i.t)}`, why: "on today's schedule" }));
  return out.slice(0, 3);
}
let TOP3_BUSY = false;
async function top3Pick(force) {
  if (TOP3_BUSY || (!force && S.top3.day === today())) return;
  TOP3_BUSY = true;
  let items = null, ai = false;
  if (aiOn()) {
    try { const j = aiJSON((await aiCall("top3", aiContext())).text);
      items = (j && Array.isArray(j.top) ? j.top : []).filter(x => x && String(x.title || "").trim()).slice(0, 3)
        .map(x => ({ title: String(x.title).trim().slice(0, 100), why: String(x.why || "").trim().slice(0, 60) }));
      ai = !!items.length; if (!ai) items = null;
    } catch (e) { /* quick pick below */ }
  }
  S.top3 = { day: today(), ai, items: (items || top3Quick()).map(x => ({ id: uid(), ...x, done: false })) };
  TOP3_BUSY = false; saveLocal(); render();
}
function top3Card() {
  const T = S.top3.day === today() ? S.top3.items : [];
  if (!T.length) return `<div class="empty">${TOP3_BUSY ? "🎯 Picking…" : "The three things that matter most today."}</div>
    <button class="btn sm" data-top3="pick">🎯 Pick my top 3</button>`;
  return T.map((x, i) => `<div class="row top3 ${x.done ? "done" : ""}"><input type="checkbox" class="tick" data-t3chk="${x.id}" ${x.done ? "checked" : ""}>
      <span class="t3n">${i + 1}</span><span class="grow">${esc(x.title)}${x.why ? `<span class="sub">${esc(x.why)}</span>` : ""}</span>
      ${i ? `<button class="x" data-t3up="${x.id}" aria-label="Move up">▲</button>` : ""}<button class="x" data-t3del="${x.id}" aria-label="Remove">✕</button></div>`).join("") +
    (T.every(x => x.done) ? `<div class="today-line">🎯 All three done — great day!</div>` : "") +
    `<div class="foot-actions"><button class="add-link" data-top3="pick">↻ Pick again</button><span class="fine" style="margin:0">${S.top3.ai ? "picked by your AI helper" : "quick pick — turn on 🤖 AI helper in ⚙ for smarter picks"}</span></div>`;
}

// ---------------------------------------------------------------- alarms
// Scott 10/2 ("add to schedule the alarms phone as set ... and be on nightly
// planner"). No web app may read the phone's Clock alarms, so Day Hub keeps
// its own copy: enter each alarm once (time + days). Tomorrow's alarm shows on
// the schedule, the Tomorrow card and the Nightly reset - with a warning when
// the first thing tomorrow is before the alarm or right on top of it.
const alarmsOn = day => { const dow = parseDay(day).getDay();
  return S.alarms.filter(a => a.on && (a.days.length ? a.days.includes(dow) : a.once === day)).sort((a, b) => a.time.localeCompare(b.time)); };
let ALARM_EDIT = null;
function alarmNote(day) {
  const al = alarmsOn(day)[0], f = dayItems(day).filter(isPlan).find(i => i.t);
  if (!al) return f && toMin(f.t) <= 9 * 60 ? `⏰ No alarm set — first up ${hm(f.t)}` : "";
  const gap = f ? toMin(f.t) - toMin(al.time) : null;
  return `⏰ Alarm ${hm(al.time)}${al.label ? ` (${al.label})` : ""}` + (gap === null ? "" : gap < 0 ? ` — ⚠️ ${f.title} at ${hm(f.t)} is BEFORE your alarm`
    : gap < 45 ? ` — ⚠️ only ${gap} min before ${f.title} at ${hm(f.t)}` : "");
}
const alarmDays = a => !a.days.length ? (a.once ? prettyDate(a.once) : "once") : a.days.length === 7 ? "every day"
  : [1, 2, 3, 4, 5].every(d => a.days.includes(d)) && a.days.length === 5 ? "weekdays"
  : a.days.length === 2 && a.days.includes(0) && a.days.includes(6) ? "weekends" : a.days.map(n => DOW[n]).join(" ");
function drawAlarmBox() {
  const g = document.getElementById("alarmBox"); if (!g) return;
  g.innerHTML = `<h3>⏰ My alarms</h3>
    <p class="fine" style="margin-top:0">Day Hub can't see your phone's Clock app, so add your alarms here once — they show on your schedule and in the Nightly reset.</p>
    ${S.alarms.map(a => `<div class="row"><input type="checkbox" class="tick" data-alon="${a.id}" ${a.on ? "checked" : ""} aria-label="On">
      <span class="grow"><b>${hm(a.time)}</b> <span class="sub">${esc(alarmDays(a))}${a.label ? ` · ${esc(a.label)}` : ""}</span></span>
      <button class="x" data-aledit="${a.id}" aria-label="Edit">✏️</button></div>`).join("")}
    <button class="btn sm" data-qa="alarm">＋ Add an alarm</button>`;
}

// ------------------------------------------- dates found in your calendar
// Scott 10/2 ("have bday date also look at calendar for data"): once a day,
// with Google Calendar connected, look a year ahead for birthdays and
// anniversaries (Google's own birthday entries, and events named "...birthday",
// "bday", "anniversary") and OFFER them in People & dates. Nothing is added
// until Add / Add all; "Not these" hides them for good.
function bdayFromEvent(e) {
  const title = String(e.summary || "").trim(), day = (e.start && (e.start.date || e.start.dateTime) || "").slice(0, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const isBday = e.eventType === "birthday" || /\b(birthday|bday|b-day|born)\b/i.test(title), isAnn = /\banniversary\b/i.test(title);
  if (!isBday && !isAnn) return null;
  let name = title.replace(/[’']s\b/g, "").replace(/\b(happy|birthday|bday|b-day|anniversary|wedding|day)\b/gi, "").replace(/[🎂🎉🎁💍!]/gu, "").replace(/\s+/g, " ").trim();
  if (!name || /^(our|my|the|your|his|her|their)$/i.test(name)) name = title;      // "Our anniversary" stays whole
  return { key: `${name.toLowerCase()}|${day.slice(5)}`, name, md: day.slice(5), kind: isAnn && !isBday ? "anniversary" : "birthday", from: title };
}
async function gcalDates(force) {
  if (!S.gcal.connected || !gReady() || (!force && S.gcal.datesDay === today())) return;
  const from = parseDay(today()), to = new Date(from); to.setDate(to.getDate() + 366);
  const found = {};
  try {
    let page = "";
    do {
      const u = "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=2500" +
        `&timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}${page ? "&pageToken=" + encodeURIComponent(page) : ""}`;
      const r = await fetch(u, { headers: { Authorization: `Bearer ${GTOKEN}` } });
      if (!r.ok) return;
      const j = await r.json();
      (j.items || []).filter(e => e.status !== "cancelled" && !((e.extendedProperties || {}).private || {}).dayhubApp)
        .forEach(e => { const b = bdayFromEvent(e); if (b && !found[b.key]) found[b.key] = b; });
      page = j.nextPageToken || "";
    } while (page);
  } catch (e) { return; }
  const have = new Set(S.people.map(p => `${p.name.toLowerCase()}|${p.md}`)), no = new Set(S.gcal.datesNo || []);
  S.gcal.dates = Object.values(found).filter(b => !have.has(b.key) && !no.has(b.key)).sort((a, b) => a.md.localeCompare(b.md));
  S.gcal.datesDay = today(); saveLocal(); render();
}
function addFoundDates(keys) {
  const pick = (S.gcal.dates || []).filter(b => keys.includes(b.key));
  pick.forEach(b => S.people.push({ id: uid(), name: b.name, kind: b.kind, md: b.md, year: null, lead: b.kind === "birthday" ? 14 : 7, ideas: "", got: {} }));
  S.gcal.dates = (S.gcal.dates || []).filter(b => !keys.includes(b.key));
  return pick.length;
}

// ---------------------------------------------------------------- errands
// Scott 10/2 (list #6, "next"): instead of six separate to-dos, one ERRAND
// RUN. Open to-dos, today's plans and the grocery list are read for stops
// (bank, pharmacy, post office, DMV, cleaners, hardware, pets, pick-ups, gas,
// the store); grouped by stop, put in a sensible order (places that close
// early first, gas before the drive home, groceries LAST so cold food goes
// straight home) with a Route in Maps button. Ticking a stop ticks its to-dos.
const ERRAND_STOPS = [
  { key: "bank", icon: "🏦", name: "Bank", q: "bank", re: /\b(bank|deposit|atm|cash (a|the) check|credit union)\b/i },
  { key: "pharmacy", icon: "💊", name: "Pharmacy", q: "pharmacy", re: /\b(pharmacy|prescriptions?|rx|cvs|walgreens|refill)\b/i },
  { key: "post", icon: "📮", name: "Post office / shipping", q: "post office", re: /\b(post office|usps|ups store|fedex|mail (a|the|it)|ship (a|the|it)|stamps|return (a |the |my )?(package|order|amazon))\b/i },
  { key: "dmv", icon: "🪪", name: "DMV / tag office", q: "DMV", re: /\b(dmv|revenue office|tag office|license plate|renew (my )?(license|tags?))\b/i },
  { key: "cleaners", icon: "👔", name: "Dry cleaners", q: "dry cleaners", re: /\b(dry clean(ing|ers)?|cleaners)\b/i },
  { key: "pickup", icon: "📦", name: "Pick up / drop off", q: null, re: /\b(pick up|pickup|drop off|drop-off)\b/i },
  { key: "hardware", icon: "🔨", name: "Hardware store", q: "hardware store", re: /\b(hardware|home depot|lowe'?s|ace hardware|menards)\b/i },
  { key: "pet", icon: "🐾", name: "Pet store", q: "pet store", re: /\b(pet store|petsmart|petco|dog food|cat food)\b/i },
  { key: "gas", icon: "⛽", name: "Gas", q: "gas station", re: /\b(get gas|gas up|fill up|fill the tank|fuel)\b/i },
  { key: "store", icon: "🛒", name: "Store", q: "grocery store", re: /\b(walmart|target|costco|sam'?s club|kroger|aldi|dollar general|grocer(y|ies)|the store|supermarket|buy|groceries)\b/i },
];
const BRANDS = /\b(walmart|target|costco|sam'?s club|kroger|aldi|dollar general|cvs|walgreens|home depot|lowe'?s|ace hardware|menards|petsmart|petco|ups store|fedex)\b/i;
function errandStops() {
  const t = today(), byKey = {};
  const put = (stop, item) => { (byKey[stop.key] = byKey[stop.key] || { ...stop, items: [] }).items.push(item);
    const b = item.title.match(BRANDS); if (b && !byKey[stop.key].brand) byKey[stop.key].brand = b[0]; };
  const match = txt => ERRAND_STOPS.find(st => st.re.test(txt));
  S.todos.filter(x => todoShown(x) && !todoDone(x)).forEach(x => { const st = match(x.title); if (st) put(st, { src: "todo", id: x.id, title: x.title }); });
  dayItems(t).filter(i => isPlan(i) && i.kind === "event").forEach(i => { const st = match(i.title); if (st) put(st, { src: "plan", title: i.title + (i.t ? ` (${hm(i.t)})` : "") }); });
  openReturns().filter(r => daysUntil(r.by) <= 7).forEach(r => { const st = ERRAND_STOPS.find(x => x.key === (RETURN_HOW[r.how] || RETURN_HOW.ship)[2]);
    put(st, { src: "return", id: r.id, title: `Return ${r.what}${r.store ? ` (${r.store})` : ""} — by ${prettyDate(r.by)}` }); });
  const L = S.lists.find(l => /grocer|shop/i.test(l.name)) || S.lists[0], toGet = L ? L.items.filter(i => !i.done) : [];
  if (toGet.length) put(ERRAND_STOPS.find(st => st.key === "store"), { src: "list", list: L.id, title: `${L.name} list — ${toGet.length} item${toGet.length === 1 ? "" : "s"}`, items: toGet });
  return ERRAND_STOPS.map(st => byKey[st.key]).filter(Boolean);          // ERRAND_STOPS order = the route order
}
function errandMapUrl(stops) {
  const q = stops.map(st => st.brand || st.q || st.items[0].title).filter(Boolean);
  if (!q.length) return null;
  const dest = q[q.length - 1], way = q.slice(0, -1);
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(dest)}${way.length ? `&waypoints=${encodeURIComponent(way.join("|"))}` : ""}`;
}
function errandsCard() {
  const stops = errandStops(); if (!stops.length) return "";
  const w = WXDATA && WXDATA.here && WXDATA.here.day, url = errandMapUrl(stops);
  return `<div class="today-line">🛍️ <b>${stops.length} stop${stops.length === 1 ? "" : "s"}</b> in a good order${w && (w.rainFrom || w.rain >= 50) ? ` · ☔ ${w.rainFrom ? "rain from " + fmtTime(w.rainFrom) + " — go early" : "rain likely"}` : ""}</div>` +
    stops.map((st, n) => `<div class="errand"><div class="row"><span class="t3n">${n + 1}</span><span class="grow"><b>${st.icon} ${esc(st.brand ? (st.brand.length <= 3 ? st.brand.toUpperCase() : st.brand.replace(/\b\w/g, c => c.toUpperCase())) : st.name)}</b></span></div>
      ${st.items.map(it => it.src === "todo" ? `<label class="row leave"><input type="checkbox" class="tick" data-tick="${it.id}"><span class="grow">${esc(it.title)}</span></label>`
        : it.src === "list" ? `<div class="row"><span class="grow">${esc(it.title)}<span class="sub">${it.items.slice(0, 8).map(i => esc(i.text)).join(", ")}${it.items.length > 8 ? "…" : ""}</span></span></div>`
        : it.src === "return" ? `<label class="row leave"><input type="checkbox" class="tick" data-retchk="${it.id}"><span class="grow">↩️ ${esc(it.title)}</span></label>`
        : `<div class="row"><span class="grow">📅 ${esc(it.title)}</span></div>`).join("")}</div>`).join("") +
    (url ? `<div class="foot-actions"><a class="btn sm" href="${url}" target="_blank" rel="noopener">🗺️ Route in Maps</a></div>` : "");
}

// ---------------------------------------------------------------- returns
// Scott 10/2 (list #8 Delivery Center, "cont"): returns with their RETURN-BY
// date, so the money isn't lost. Days left in the Packages card, reminders 3
// days and 1 day before, a chip at the top when it's close, and the trip to
// the post office / store rides along in the Errand run.
const RETURN_HOW = { ship: ["📮", "Ship it back", "post"], store: ["🏬", "Take it to the store", "store"], dropoff: ["📦", "Drop-off point (UPS / Whole Foods / Kohl's…)", "post"] };
const openReturns = () => S.returns.filter(r => !r.done).sort((a, b) => a.by.localeCompare(b.by));
const retWhen = r => { const n = daysUntil(r.by); return n < 0 ? `${-n} day${n === -1 ? "" : "s"} PAST the return window` : n === 0 ? "last day TODAY" : `${n} day${n === 1 ? "" : "s"} left`; };

// ------------------------------------------------------------- future me
// Scott 10/2 (the "one unusual feature": Future Me). Not a reminder - the
// REASON. "Next time we travel, don't book a 6 AM flight." "Didn't buy the
// Ford - transmission reviews." Each note carries a few words; when you later
// add anything that mentions them (a trip, an event, a to-do, a list item...)
// the note comes back at the top of the screen. Or pick a day for it to come
// back. Ask Day Hub can answer "why didn't I...?" from them.
const STOP = new Set("about after again also because been before being both come could didnt does doesnt dont down each even ever every from going gonna have here into just keep know like made make maybe more most much must need never next only other over really remember said same should since some still such sure take than that their them then there these they thing this those time told very want was were what when where which while will with would your youre note future".split(" "));
const futureWords = text => [...new Set(String(text).toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/)
  .map(w => w.replace(/'s$|'/g, "")).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)))].slice(0, 5);
function futureMatch(text) {
  const t = " " + String(text || "").toLowerCase() + " ";
  return S.future.filter(f => f.words.some(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(t)));
}
// Called after anything is added: bring back what future-you asked to hear.
function futureCheck(text) {
  const hits = futureMatch(text).filter(f => !S.futureShow.includes(f.id));
  if (hits.length) { S.futureShow.push(...hits.map(f => f.id)); hits.forEach(f => { f.seen = (f.seen || 0) + 1; f.lastSeen = today(); }); saveLocal(); }
  return hits.length;
}
function futureDue() {                                      // date-triggered notes, once on their day
  let changed = false;
  S.future.filter(f => f.day && f.day <= today() && !f.dayShown).forEach(f => { f.dayShown = true; if (!S.futureShow.includes(f.id)) S.futureShow.push(f.id); changed = true; });
  if (changed) saveLocal();
}
function futureBanner() {
  const list = S.futureShow.map(id => S.future.find(f => f.id === id)).filter(Boolean);
  if (!list.length) return "";
  return `<section class="card future-banner"><h3><span class="ci">🔮</span>Future you said…</h3><div class="body">
    ${list.map(f => `<div class="today-line">“${esc(f.text)}”<span class="sub">— you, ${prettyDate(f.created.slice(0, 10))}${f.created.slice(0, 4) !== today().slice(0, 4) ? " " + f.created.slice(0, 4) : ""}</span></div>`).join("")}
    <div class="foot-actions"><button class="btn sm" data-futok="1">Got it</button></div></div></section>`;
}
let FUTURE_EDIT = null;

function heroHtml() {
  const now = new Date(), h = now.getHours();
  const w = WXDATA && WXDATA.here;
  const todayItems = dayItems(today()).filter(isPlan);
  const open = S.todos.filter(t => todoShown(t) && !todoDone(t)).length;
  const left = todayItems.filter(i => !i.t || i.t >= nowT()).length;
  let verdict;
  if (h >= 20) { const n = dayItems(addDays(today(), 1)).filter(isPlan).length;
    verdict = n ? `Tomorrow: ${n} thing${n === 1 ? "" : "s"} planned.` : "Nothing planned tomorrow. Rest up."; }
  else { const busy = left + open;
    verdict = busy === 0 ? "A clear day ahead." : busy <= 3 ? "A light day." : busy <= 7 ? "A full day — you've got this." : "A busy one. Pace yourself."; }
  if (MODE === "cruise") { const tr = curTrip();
    verdict = !tr ? "Plan your next cruise ⛴️" : !tr.start ? `🚢 ${esc(tr.name)}` : daysUntil(tr.start) > 0
      ? `🚢 ${isCruise(tr) ? "Cruise" : "Trip"} in ${daysUntil(tr.start)} day${daysUntil(tr.start) === 1 ? "" : "s"} · ${readiness(tr).pct}% ready`
      : daysUntil(tr.end || tr.start) >= 0 ? `🚢 Enjoy ${esc(tr.name)}!` : `🏠 Welcome home from ${esc(tr.name)}`; }

  const chips = [];
  { const rn = routineNow(); if (rn) chips.unshift(`<button class="chip good" data-ropen="${rn.id}">🔁 ${esc(rn.name.replace(/^\S+\s/, ""))}: ${rDone(rn).length}/${rn.steps.length}</button>`); }
  { const nx = payNext(); if (nx === today()) { const c = dueBetween(nx, payAfter(nx));
      chips.unshift(`<span class="chip good">💵 Payday! ${c.length} bill${c.length === 1 ? "" : "s"} before the next check — ${money(c.reduce((x, o) => x + o.amt, 0))}</span>`); } }
  { const es = errandStops(); if (MODE !== "cruise" && es.length >= 2 && h < 18 && !S.hidden.includes("errands"))
      chips.push(`<button class="chip" data-errands="1">🛍️ Errand run: ${es.length} stops</button>`); }
  openReturns().filter(r => daysUntil(r.by) <= 2).slice(0, 2).forEach(r => chips.push(`<span class="chip warn">↩️ Return ${esc(r.what)}: ${retWhen(r)}</span>`));
  upkeepDue(null, 1).filter(({ x, day }) => x.auto ? (daysUntil(day) === 0 || (daysUntil(day) === 1 && h >= 15)) : daysUntil(day) <= 0)
    .slice(0, 2).forEach(({ x, day }) => chips.push(`<span class="chip ${daysUntil(day) < 0 ? "warn" : ""}">${esc(x.name)} ${x.auto && daysUntil(day) === 1 ? "tomorrow — out tonight" : upkeepWhen(x, day)}</span>`));
  upcomingPeople(3).forEach(({ p, day }) => { const n = daysUntil(day);
    chips.push(`<span class="chip ${n === 0 ? "good" : ""}">${PKIND[p.kind] || "⭐"} ${esc(n === 0 ? personLabel(p, day) + " — today!" : `${p.name} ${inDays(n)}`)}</span>`); });
  if (MODE !== "cruise" && h >= 5 && h < 11 && leaveLeft() && leaveDone().length < leaveAll().length && S.hidden.indexOf("leave") < 0)
    chips.push(`<button class="chip" data-leave="1">🚪 Don't forget: ${leaveLeft()} to check</button>`);
  const wa = wxAlerts(today());
  wa.slice(0, 2).forEach(a => chips.push(`<span class="chip warn">${a.icon} ${esc(a.text.split(" — ")[0])}</span>`));
  if (w && w.day.rainFrom && !wa.some(a => a.key === "rain-plan")) chips.push(`<span class="chip warn">☔ Rain from ${fmtTime(w.day.rainFrom)}</span>`);
  else if (w && w.day.rain < 20) chips.push(`<span class="chip good">☀ No rain today</span>`);
  const nx = nextPlan();
  if (nx) chips.push(`<span class="chip">⏭ ${esc(nx.when)} · ${esc(nx.title)}</span>`);
  const oc = onClock();
  if (budget().status === "over") chips.push(`<span class="chip warn">⚠ Spending is running over budget</span>`);
  if (oc !== null) chips.push(`<span class="chip good">⏱ On the clock ${fmtH(oc)}</span>`);
  S.remember.filter(r => r.day === today()).forEach(r => chips.unshift(`<button class="chip good" data-rmdel="${r.id}" title="Tap when handled">📌 ${esc(r.text)} ✓</button>`));
  if (open) chips.push(`<span class="chip">✅ ${open} to-do${open === 1 ? "" : "s"}</span>`);
  upcomingBills().filter(b => daysUntil(b.due) <= 3).forEach(b =>
    chips.push(`<span class="chip ${daysUntil(b.due) < 0 ? "warn" : ""}">💳 ${esc(b.name)} ${inDays(daysUntil(b.due))}</span>`));
  const nt = upcomingTrips()[0];
  if (nt && nt.start) {
    const fd = nt.finalDue ? daysUntil(nt.finalDue) : null;
    if (fd !== null && fd >= 0 && fd <= 30 && tripLeft(nt) !== 0) chips.push(`<span class="chip warn">💳 Final payment ${inDays(fd)}</span>`);
    const sd = daysUntil(nt.start);
    if (sd > 0 && sd <= 365) chips.push(`<span class="chip">${isCruise(nt) ? "🚢" : "✈️"} ${esc(nt.name)} in ${sd} day${sd === 1 ? "" : "s"}</span>`);
    else if (sd <= 0 && daysUntil(nt.end || nt.start) >= 0) chips.push(`<span class="chip good">${isCruise(nt) ? "🚢" : "✈️"} Enjoy ${esc(nt.name)}!</span>`);
    if (sd <= 2 && daysUntil(nt.end || nt.start) >= -2) chips.unshift(`<button class="chip good" data-forget="1">🛳️ What am I forgetting?</button>`);
  }
  const pkToday = S.packages.filter(p => !p.delivered && p.eta === today()).length;
  if (pkToday) chips.push(`<span class="chip">📦 ${pkToday} arriving today</span>`);
  const cd = liveCountdowns()[0];
  if (cd) chips.push(`<span class="chip">⏳ ${esc(cd.title)} ${daysUntil(cd.date) === 0 ? "today!" : inDays(daysUntil(cd.date))}</span>`);
  if (MODE !== "cruise" && !S.sync.on && hasData(S) && can("sync")) chips.unshift(`<button class="chip warn" data-sync="on">☁️ Not backed up — tap to turn on</button>`);
  if (needTap().length) chips.push(`<button class="chip" data-syncall="1">🔄 Tap to sync${S.gcal.dirty || S.sync.dirty ? " · changes waiting" : ""}</button>`);
  if (MODE !== "cruise" && h >= 4 && h < 12 && (S.name || hasData(S))) chips.push(`<button class="chip" data-brief="open">☀️ Morning brief</button>`);
  if (UPDATE) chips.unshift(`<button class="chip good" data-update="1">✨ New version ready — tap to update</button>`);
  if (INSTALL_EVT && !standalone()) chips.push(`<button class="chip" data-install="1">📲 Install ${APP_NAME}</button>`);


  const wx = w ? (() => { const [ic] = wxIcon(w.cur.weather_code, w.cur.is_day);
      return `<div class="hero-wx"><div class="ic">${ic}</div><div class="t">${Math.round(w.cur.temperature_2m)}°</div>
              <div class="hl">H ${Math.round(w.day.hi)}° · L ${Math.round(w.day.lo)}°</div></div>`; })()
    : S.city && !WXDATA ? `<div class="hero-wx"><div class="skel" style="width:84px;height:74px"></div></div>` : "";
  // Cruise Hub's top line is about the cruise only (Day Hub's chips stay in Day Hub).
  const keep = MODE !== "cruise" ? chips : chips.filter(c => /forgetting|Final payment|🚢|✈️|[Rr]ain|New version|Install|⚓/.test(c));
  return `<div class="hero-top"><div class="greet">${greet()}</div>
      <span class="hero-btns">${MODE !== "cruise" ? `<button class="icon-btn" data-ask="open" aria-label="Ask Day Hub">💡</button><button class="icon-btn" data-leave="1" aria-label="Don't forget">🚪</button><button class="icon-btn" data-dump="1" aria-label="Brain dump">🧠</button>` : ""}<button id="settingsBtn" class="icon-btn" aria-label="Settings">⚙</button></span></div>
    <div class="hero-main"><div><div class="hero-clock" id="clockNow"></div><div class="hero-date">${longDate(today())}</div></div>${wx}</div>
    <div class="verdict-row">${MODE !== "cruise" && (S.name || hasData(S)) ? pulseRing() : ""}<div class="verdict">${verdict}</div></div>
    <div class="chips">${keep.join("")}</div>`;
}
function paintHero() {
  const hero = document.getElementById("hero");
  const h = new Date().getHours();
  const p = PHASES.find(x => h < x.to);
  hero.style.setProperty("--hero", p.g);
  const w = WXDATA && WXDATA.here;
  hero.classList.toggle("gloomy", !!(w && w.cur.weather_code >= 45));
  document.getElementById("themeColor").setAttribute("content", p.c);
  hero.innerHTML = heroHtml();
}

// --------------------------------------------------------------- cards
const CARDS = {
  schedule: { icon: "🗓️", title: "Schedule",
    meta: () => { const n = dayItems(VIEW).filter(isPlan).length; return n ? `${n} planned` : ""; },
    add: ["event", "Add to schedule"],
    body: () => {
      const items = dayItems(VIEW), isToday = VIEW === today(), t = nowT();
      let html = `<div class="daynav"><button class="nav" data-day="-1" aria-label="Previous day">‹</button>
        <button class="dn" data-day="0"><b>${dayName(VIEW)}</b><span>${longDate(VIEW)}</span></button>
        <button class="nav" data-day="1" aria-label="Next day">›</button></div>`;
      if (S.gcal.connected && !gReady()) html += `<button class="sync" data-gsync="1">🔄 Tap to sync Google Calendar${S.gcal.fetched ? ` · last ${fmtTime(S.gcal.fetched)}` : ""}</button>`;
      if (!items.length) return html + `<div class="tl-empty">Nothing scheduled ${isToday ? "today" : "this day"}.<br>Tap <b>+</b> to add something.</div>`;
      let nowDone = !isToday;
      const rows = [];
      for (const i of items) {
        if (!nowDone && i.t && i.t > t) { rows.push(`<div class="now-line"><span>${hm(t)}</span></div>`); nowDone = true; }
        const past = isToday && i.t && i.t < t;
        const ctrl = i.tick ? `<input type="checkbox" class="tick" data-tickl="${i.tick}" ${i.done ? "checked" : ""} aria-label="Done">`
                   : i.del ? `<button class="x" data-del="${i.del}" aria-label="Remove">✕</button>` : "";
        rows.push(`<div class="ti k-${i.kind} ${past ? "past" : ""} ${i.done ? "done" : ""}">
          <div class="tt">${i.t ? hm(i.t) : "All day"}${i.end ? `<small>${hm(i.end)}</small>` : ""}</div>
          <div class="dot"></div>
          <div class="tc"><div class="tn">${i.icon} ${esc(i.title)}${i.kind === "g" ? ` <span class="gbadge">Google</span>` : ""}</div>
            ${i.sub ? `<div class="ts">${esc(i.sub)}</div>` : ""}</div><span class="ctl">${i.cal ? `<button class="x" data-ics="${i.cal}" aria-label="Add to phone calendar">📲</button>` : ""}${ctrl}</span></div>`);
      }
      if (!nowDone) rows.push(`<div class="now-line"><span>${hm(t)}</span></div>`);
      return html + `<div class="tl">${rows.join("")}</div>`;
    } },

  // v0.8 (Scott 10/1 "next Day Hub feature"): the evening look at tomorrow.
  // Shown from 3 PM; from 5 PM it moves to the top (see render()).
  reset: { icon: "🛏️", title: "Nightly reset",
    meta: () => S.resetDay === today() ? "done ✓" : (n => n ? `${n} to wrap up` : "all wrapped up")(resetData().open.length),
    body: () => resetHtml() },
  tomorrow: { icon: "🌙", title: "Tomorrow",
    meta: () => { const n = dayItems(addDays(today(), 1)).filter(isPlan).length; return n ? `${n} planned` : "clear"; },
    body: () => {
      const T1 = addDays(today(), 1), items = dayItems(T1), plans = items.filter(isPlan);
      const w = WXDATA && WXDATA.here && WXDATA.here.days[1];
      const L = [];
      if (w) {
        const tips = [];
        if (w.rain >= 50) tips.push("☔ rain likely — take an umbrella");
        if (w.lo <= 40) tips.push("🧥 cold start — grab a jacket");
        if (w.hi >= 92) tips.push("🥵 hot one — bring water");
        L.push(`<div class="today-line">${wmo(w.code)[0]} <b>${Math.round(w.hi)}°</b> / ${Math.round(w.lo)}° · ${wmo(w.code)[1]}${w.rain >= 20 ? ` · rain ${w.rain}%` : ""}${tips.length ? `<br><span class="sub">${tips.join(" · ")}</span>` : ""}</div>`);
        const al = wxAlerts(T1); if (al.length) L.push(`<div class="wx-alerts">${wxAlertHtml(al)}</div>`);
      }
      const first = plans.find(i => i.t);
      if (first) {
        const alarm = new Date(atMs(T1, first.t) - 60 * 60000);
        const an = alarmNote(T1);
        L.push(`<div class="today-line">⏰ First up <b>${hm(first.t)}</b> — ${esc(first.title)}<br><span class="sub">${an && alarmsOn(T1).length ? esc(an) : `Alarm idea: ${alarm.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (an hour before)`}</span></div>`);
      }
      if (plans.length) L.push(plans.slice(0, 5).map(i => `<div class="row"><span class="time">${i.t ? hm(i.t) : "All day"}</span><span class="grow">${i.icon} ${esc(i.title)}</span></div>`).join(""));
      else L.push(`<div class="today-line">📅 Nothing planned yet — a clear day.</div>`);
      items.filter(i => i.kind === "bill").forEach(i => L.push(`<div class="today-line">💳 <b>${esc(i.title)}</b> ${esc(i.sub || "")}</div>`));
      items.filter(i => i.kind === "cd").forEach(i => L.push(`<div class="today-line">🎉 <b>${esc(i.title)}</b> is tomorrow!</div>`));
      items.filter(i => i.kind === "pkg").forEach(i => L.push(`<div class="today-line">📦 <b>${esc(i.title)}</b> (${esc(i.sub)})</div>`));
      const left = S.todos.filter(t => todoShown(t) && !todoDone(t) && !isRep(t)).length;
      if (left) L.push(`<div class="today-line">✅ ${left} to-do${left === 1 ? "" : "s"} still open today — they carry over.</div>`);
      return L.join("") + `<div class="foot-actions" style="margin-top:10px"><button class="btn sm" data-plan="tomorrow">＋ Plan tomorrow</button>
        <button class="btn sm ghost" data-day="1" data-goto="schedule">See tomorrow's schedule</button></div>`;
    } },

  work: { icon: "💼", title: "Work hours", add: ["shift", "Add a shift"],
    meta: () => { const p = periodPay(periodStart(today())); return p.hrs ? `${fmtH(p.hrs)} this ${periodWeeks() > 1 ? "period" : "week"}` : ""; },
    body: () => {
      const W = S.work, oc = onClock();
      const clock = oc !== null
        ? `<div class="clockbox on"><div><b>On the clock</b><span>since ${fmtTime(W.clockIn)} · ${fmtH(oc)}</span></div><button class="btn" data-clock="out">Clock out</button></div>`
        : `<div class="clockbox"><div><b>Off the clock</b><span>Tap when your shift starts</span></div><button class="btn" data-clock="in">Clock in</button></div>`;
      const ps = periodStart(today()), p = periodPay(ps), last = periodPay(addDays(ps, -7 * periodWeeks())), two = periodWeeks() > 1;
      const pay = W.rate
        ? `<div class="paygrid"><div class="fact">Hours<b>${fmtH(p.hrs)}</b>${p.ot ? `<small>${fmtH(p.ot)} overtime</small>` : ""}</div>
             <div class="fact">Gross<b>${money(p.gross)}</b></div>
             <div class="fact take">Take-home*<b>${money(p.net)}</b></div></div>
           <div class="fine" style="margin-top:6px">*Rough: ${money(W.rate)}/hr, overtime after ${W.otAfter}h at 1.5x, minus ${W.taxPct}% for taxes.
             Last ${two ? "period" : "week"}: ${fmtH(last.hrs)} · ~${money(last.net)}. <button class="add-link" style="padding:0" data-qa="pay">Change pay</button></div>`
        : `<button class="btn sm ghost" data-qa="pay" style="margin-top:10px">Set your hourly pay to see take-home</button>`;
      const rows = p.shifts.map(x => `<div class="row"><span class="time">${parseDay(x.day).toLocaleDateString([], two ? { weekday: "short", month: "numeric", day: "numeric" } : { weekday: "short" })}</span>
          <span class="grow">${hm(x.start)} – ${hm(x.end)}${Number(x.brk) ? `<span class="sub">${x.brk} min break</span>` : ""}</span>
          <b>${fmtH(shiftHours(x))}</b><button class="x" data-del="work.shifts:${x.id}" aria-label="Remove">✕</button></div>`).join("");
      return clock + pay + (rows ? `<div class="day-label" style="margin-top:14px">${two ? `Pay period · ${prettyDate(p.start)} – ${prettyDate(p.end)}` : "This week"}</div>${rows}` : "");
    } },

  budget: { icon: "💰", title: "Budget", add: ["spend", "Log spending"],
    meta: () => { const b = budget();
      return b.status === "over" ? `<span style="color:var(--red)">over</span>` : b.status === "tight" ? `<span style="color:var(--orange)">tight</span>`
        : b.income ? `${money(b.perDay)}/day` : ""; },
    body: () => {
      const b = budget(), M = S.money;
      if (!b.income) return `<div class="empty">${M.type === "salary" ? "Enter your yearly salary" : "Set your hourly pay and add a few shifts"} — Day Hub will tell you if spending is running ahead of what you bring home.</div>
        <button class="btn sm ghost" data-qa="pay" style="margin-top:10px">Set income</button>`;
      const line = b.status === "over" ? `<div class="bstat over">⚠ At this pace you'll spend <b>${money(-b.left)}</b> more than you bring home this month.</div>`
        : b.status === "tight" ? `<div class="bstat tight">Tight month — about <b>${money(b.left)}</b> to spare. ${money(b.perDay)}/day keeps you even.</div>`
        : `<div class="bstat ok">On track — about <b>${money(b.perDay)}/day</b> free for the rest of the month.</div>`;
      const rows = b.spends.slice().sort((x, y) => y.day.localeCompare(x.day)).slice(0, 5).map(x => `<div class="row"><span class="time">${prettyDate(x.day)}</span>
        <span class="grow">${esc(x.what || "Spending")}</span><b>${money(x.amt)}</b><button class="x" data-del="money.spends:${x.id}" aria-label="Remove">✕</button></div>`).join("");
      return line + `<div class="paygrid"><div class="fact take">Take-home<b>${money(b.income)}</b></div><div class="fact">Bills<b>${money(b.bills)}</b></div>
          <div class="fact">Spent<b>${money(b.spent)}</b>${b.projSpend > b.spent + 0.5 ? `<small>~${money(b.projSpend)} by month end</small>` : ""}</div></div>
        <div class="fine" style="margin-top:6px">${new Date().toLocaleDateString([], { month: "long" })} estimate: ${esc(b.how)}, minus ${S.work.taxPct}% for taxes.
          <button class="add-link" style="padding:0" data-qa="pay">Change income</button></div>` +
        (rows ? `<div class="day-label" style="margin-top:12px">Recent spending</div>${rows}` : "");
    } },

  weather: { icon: "🌤️", title: "Weather",
    meta: () => (WXDATA && WXDATA.here) ? esc(WXDATA.here.label) : "",
    body: () => {
      if (!S.city) return `<div class="empty">Add your city or ZIP to see the weather.</div>
        <button class="btn sm" data-open="sheet" style="margin-top:10px">Set location</button>`;
      if (!WXDATA) return `<div class="skel"></div>`;
      const w = WXDATA.here;
      if (!w) return `<div class="empty">${esc(WXDATA.error || "City or ZIP not found — check it in ⚙ settings.")}</div>`;
      const hours = w.hourly.map((x, i) => `<div class="hour ${i === 0 ? "now" : ""}"><div class="h">${i === 0 ? "Now" : new Date(x.t).toLocaleTimeString([], { hour: "numeric" })}</div>
        <div class="i">${wxIcon(x.code, x.isDay)[0]}</div><div class="tp">${Math.round(x.temp)}°</div><div class="r">${x.rain >= 20 ? x.rain + "%" : ""}</div></div>`).join("");
      const mn = Math.min(...w.days.map(d => d.lo)), mx = Math.max(...w.days.map(d => d.hi)), span = Math.max(1, mx - mn);
      const days = w.days.map((d, i) => `<div class="dayrow"><span>${i === 0 ? "Today" : parseDay(d.d).toLocaleDateString([], { weekday: "short" })}</span>
        <span>${wmo(d.code)[0]}</span><span class="lo">${Math.round(d.lo)}°</span>
        <span class="bar"><span style="left:${(d.lo - mn) / span * 100}%;width:${Math.max(6, (d.hi - d.lo) / span * 100)}%"></span></span>
        <span class="hi">${Math.round(d.hi)}°${d.rain >= 30 ? `<span class="rn"> ${d.rain}%</span>` : ""}</span></div>`).join("");
      const al = wxAlerts(today());
      return `${al.length ? `<div class="wx-alerts">${wxAlertHtml(al)}</div>` : ""}<div class="hours">${hours}</div>
        <div class="wx-facts"><div class="fact">Feels like<b>${Math.round(w.cur.apparent_temperature)}°</b></div>
          <div class="fact">Wind<b>${Math.round(w.cur.wind_speed_10m)} mph</b></div>
          <div class="fact">Sunrise<b>${fmtTime(w.day.sunrise)}</b></div><div class="fact">Sunset<b>${fmtTime(w.day.sunset)}</b></div></div>
        <div class="days">${days}</div>`;
    } },

  todos: { icon: "✅", title: "To-do", add: ["todo", "Add a to-do"],
    meta: () => { const shown = S.todos.filter(todoShown); if (!shown.length) return "";
      const d = shown.filter(todoDone).length;
      return `<span style="display:inline-flex;gap:7px;align-items:center">${d}/${shown.length}<span class="ring" style="--p:${Math.round(d / shown.length * 100)}"></span></span>`; },
    body: () => {
      const shown = S.todos.filter(todoShown).sort((a, b) => todoDone(a) - todoDone(b));
      return shown.length ? shown.map(t => `<div class="row ${todoDone(t) ? "done" : ""}"><input type="checkbox" class="tick" data-tick="${t.id}" ${todoDone(t) ? "checked" : ""} aria-label="Done">
        <span class="grow">${esc(t.title)}${isRep(t) ? `<span class="sub">${repLabel(t)}</span>` : ""}</span><button class="x" data-del="todos:${t.id}" aria-label="Remove">✕</button></div>`).join("")
        : `<div class="empty">Nothing to do. Enjoy it. 🎉</div>`;
    } },

  // v0.17 (Scott 10/1: "get day hub totally loaded"): the Notes card from his icon sheet.
  notes: { icon: "📝", title: "Notes",
    meta: () => S.notes.length ? `${S.notes.length}` : "",
    body: () => {
      const list = S.notes.slice().sort((a, b) => (b.pinned - a.pinned) || String(b.updated).localeCompare(String(a.updated)));
      return `<form class="inline-add" data-noteadd="1" style="margin-top:0"><input name="text" placeholder="Jot something down…" required autocomplete="off"><button class="btn sm">Save</button></form>` +
        (list.length ? list.map(n => `<div class="row"><button class="x" data-notepin="${n.id}" aria-label="${n.pinned ? "Unpin" : "Pin"}" style="opacity:${n.pinned ? 1 : .35}">📌</button>
            <span class="grow note-text" data-noteedit="${n.id}">${esc(n.text).replace(/\n/g, "<br>")}<span class="sub">${prettyDate(String(n.updated).slice(0, 10))}</span></span>
            <button class="x" data-del="notes:${n.id}" aria-label="Delete">✕</button></div>`).join("")
          : `<div class="empty">Ideas, gate codes, wifi passwords for guests, what the doctor said — keep it here.</div>`);
    } },

  bills: { icon: "💳", title: "Bills due", add: ["bill", "Add a bill"],
    meta: () => S.bills.length ? `${money(S.bills.reduce((s, b) => s + Number(b.amount || 0), 0))}/mo` : "",
    body: () => {
      const up = upcomingBills();
      if (!up.length) return `<div class="empty">Add your monthly bills — Day Hub reminds you before they're due.</div>`;
      return up.map(b => { const n = daysUntil(b.due);
        return `<div class="row"><div class="grow">${esc(b.name)}<span class="sub">${money(b.amount)} · ${prettyDate(b.due)}</span></div>
          <span class="pill ${n < 0 ? "late" : n <= 3 ? "soon" : ""}">${inDays(n)}</span>
          <button class="btn sm ghost" data-paid="${b.id}">Paid</button>
          <button class="x" data-ics="bill:${b.id}" aria-label="Add to phone calendar">📲</button>
          <button class="x" data-del="bills:${b.id}" aria-label="Remove">✕</button></div>`; }).join("") +
        `<div class="total"><span>Every month</span><b>${money(S.bills.reduce((s, b) => s + Number(b.amount || 0), 0))}</b></div>`;
    } },

  inbox: { icon: "📬", title: "From your email",
    meta: () => S.mail.found.length ? `${S.mail.found.length} to review` : "",
    body: () => {
      const f = S.mail.found.slice().sort((a, b) => (a.day || "9999").localeCompare(b.day || "9999"));
      const top = S.mail.on && !mReady() ? `<button class="sync" data-mail="scan">📬 Tap to check your email${S.mail.last ? ` · last ${fmtTime(S.mail.last)}` : ""}</button>` : "";
      if (!f.length) return top + `<div class="empty">${S.mail.on ? "Nothing waiting. New cruise bookings, appointments, flights and deliveries show up here." : "Connect Gmail in ⚙ — use the email you book trips with — and Day Hub finds cruises, appointments, flights, reservations and packages in it."}</div>`;
      return top + f.map(x => x.type === "cruise" ? (() => { const ad = cruiseAdds(x.cruise), c = x.cruise;
          return `<div class="row"><div class="grow">${esc(x.title)}${c.line ? ` <span class="tag">${esc(c.line)}</span>` : ""}
            <span class="sub">${[c.start && `${prettyDate(c.start)}${c.end ? " – " + prettyDate(c.end) : ""}`, c.booking && `booking ${esc(c.booking)}`, c.cabin || c.category, c.ports && `${c.ports.length} ports`, c.finalDue && `final payment ${prettyDate(c.finalDue)}`].filter(Boolean).map(String).join(" · ")}
            ${ad ? ` · adds ${[...ad.add, ad.newPorts ? `${ad.newPorts} ports` : ""].filter(Boolean).join(", ")} to your trip` : ""}</span></div>
            <button class="btn sm" data-addfound="${esc(x.key)}">${ad ? "Update trip" : "Add trip"}</button><button class="x" data-dropfound="${esc(x.key)}" aria-label="Dismiss">✕</button></div>`; })()
        : `<div class="row"><div class="grow">${x.type === "package" ? "📦" : "📅"} ${esc(x.title)}
          <span class="sub">${x.type === "package" ? `${(CARRIERS[x.carrier] || CARRIERS.other)[0]} · …${esc(x.num.slice(-6))}${x.day ? ` · arrives ${prettyDate(x.day)}` : ""}`
            : `${dayName(x.day)} ${prettyDate(x.day)}${x.time ? ` · ${hm(x.time)}` : " · time not found"}`} · from "${esc(x.src)}"</span></div>
        <button class="btn sm" data-addfound="${esc(x.key)}">Add</button><button class="x" data-dropfound="${esc(x.key)}" aria-label="Dismiss">✕</button></div>`).join("");
    } },

  trips: { icon: "🚢", title: "Trips",
    meta: () => { const tr = curTrip(); return tr ? `${readiness(tr).pct}% ready` : ""; },
    body: () => {
      const tr = curTrip();
      if (!tr) return `<div class="empty">Got a cruise or trip coming? Day Hub counts down, reminds you about the final payment, tracks onboard spending and hands you ready-made packing and document lists.</div>
        <div class="today-line" style="margin-top:8px">✨ <b>Zero effort:</b> connect the email you booked with (⚙ → Connect Gmail) and the ship, dates, booking number, cabin and ports fill in by themselves.</div>
        <button class="btn sm" data-qa="trip" style="margin-top:10px">🚢 Plan a trip</button>`;
      const all = upcomingTrips();
      const pick = all.length > 1 ? `<div class="tabs">${all.map(t => `<button class="tab ${t.id === tr.id ? "on" : ""}" data-tripsel="${t.id}">${esc(t.name)}</button>`).join("")}</div>` : "";
      const sd = tr.start ? daysUntil(tr.start) : null, nights = tripNights(tr);
      const big = sd === null ? "?" : sd > 0 ? sd : daysUntil(tr.end || tr.start) >= 0 ? "🎉" : "✓";
      const lab = sd === null ? "add the dates" : sd > 0 ? (sd === 1 ? "day to go" : "days to go") : daysUntil(tr.end || tr.start) >= 0 ? "you're away!" : "back home";
      const head = `<div class="trip-hero"><div class="trip-n">${big}</div><div class="grow"><b>${isCruise(tr) ? "🚢" : "✈️"} ${esc(tr.name)}</b>
          <span class="sub">${lab}${tr.start ? ` · ${prettyDate(tr.start)}${tr.end ? ` – ${prettyDate(tr.end)}` : ""}${nights ? ` · ${nights} nights` : ""}` : ""}</span>
          <span class="sub">${[tr.line, tr.ship, tr.port].filter(Boolean).map(esc).join(" · ")}</span></div>
          <button class="btn sm ghost" data-tripedit="${tr.id}">Edit</button></div>
        <button class="btn" data-forget="1" style="width:100%;margin-top:10px">🛳️ What am I forgetting?</button>`;
      const tabs = ["ready", "money"].concat(isCruise(tr) ? ["ports"] : [], ["onboard"], isCruise(tr) ? ["perks"] : [], ["lists"], isCruise(tr) ? ["tips"] : []);
      const TL = { ready: "✅ Ready", money: "💳 Payments", ports: "🗺️ Ports", onboard: isCruise(tr) ? "🍹 Onboard" : "💵 Spending", lists: "📋 Lists", perks: "🎁 Perks", tips: "💡 Good to know" };
      const tab = tabs.includes(S.tripTab) ? S.tripTab : "ready";
      let body = "";
      if (tab === "ready") {
        const R = readiness(tr);
        body = `<div class="ready"><div class="ring big" style="--p:${R.pct}"><b>${R.pct}%</b></div>
            <div class="grow"><b>${R.pct >= 100 ? "Ready to go!" : "Ready"}</b><span class="sub">Stage: ${esc(R.phase)}</span>
            ${R.next ? `<div class="next">➡️ <b>Next:</b> ${esc(R.next.action)}</div>` : `<div class="next">✅ Nothing needs you right now.</div>`}</div></div>` +
          R.items.map(i => `<div class="today-line">${i.score >= 1 ? "✅" : i.now ? "⚠️" : "⏳"} ${esc(i.label)}${i.score > 0 && i.score < 1 ? ` <span class="sub" style="display:inline">${Math.round(i.score * 100)}%</span>` : ""}</div>`).join("") +
          `<div class="fine" style="margin-top:6px">⚠️ = matters now · ⏳ = later — Day Hub brings it up when it's time.</div>`;
      } else if (tab === "ports") {
        const days = []; if (tr.start) for (let d = tr.start; d <= (tr.end || tr.start); d = addDays(d, 1)) days.push(d);
        ensurePortWx(tr);
        body = days.length ? days.map(d => { const pt = portOn(tr, d);
          const label = pt ? `⚓ <b>${esc(pt.name)}</b>` : d === tr.start ? `🚢 <b>Sail day</b> — ${esc(tr.port || "")}` : d === tr.end ? `🏠 <b>Back in port</b> — getting home` : "🌊 At sea";
          const sub = pt ? [portWxText(pt), pt.arrive && `in ${hm(pt.arrive)}`, pt.allAboard ? `<b style="color:var(--orange)">all aboard ${hm(pt.allAboard)}${Number(pt.shipOffset) ? " ship time" : ""}</b>`
                              : pt.depart && `departs ${hm(pt.depart)} · <b style="color:var(--orange)">add all-aboard ✏️</b>`,
                            pt.indie && `<b style="color:var(--red)">independent tour</b>`,
                            pt.excursion && (pt.excursion.toLowerCase() === "none" ? "no excursion" : `🤿 ${esc(pt.excursion)}${pt.meet ? ` · meet ${hm(pt.meet)}` : ""}${pt.where ? ` · ${esc(pt.where)}` : ""}`)].filter(Boolean).join(" · ") : "";
          return `<div class="row"><span class="time">${parseDay(d).toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })}</span>
            <span class="grow">${label}${sub ? `<span class="sub">${sub}</span>` : ""}</span>
            ${pt ? `<button class="x" data-portedit="${pt.id}" aria-label="Edit">✏️</button><button class="x" data-tripdel="${tr.id}:ports:${pt.id}" aria-label="Remove">✕</button>`
                 : d !== tr.start && d !== tr.end ? `<button class="btn sm ghost" data-portadd="${d}">＋ Port</button>` : ""}</div>`; }).join("")
          : `<div class="empty">Add the sailing dates (Edit) and every day shows up here.</div>`;
        body += `<div class="fine" style="margin-top:6px">⚓ Day Hub alarms you 60 and 30 minutes before all-aboard — the ship will not wait.</div>`;
      } else if (tab === "money") {
        const paid = tripPaid(tr), left = tripLeft(tr), spm = savePerMonth(tr), fd = tr.finalDue ? daysUntil(tr.finalDue) : null;
        body = tr.total ? `<div class="paygrid"><div class="fact">Total<b>${money(tr.total)}</b></div><div class="fact">Paid<b>${money(paid)}</b></div>
            <div class="fact ${left ? "" : "take"}">Left<b>${money(left)}</b></div></div>
            <div class="bar" style="margin-top:10px"><span style="left:0;width:${Math.min(100, paid / tr.total * 100)}%"></span></div>`
          : `<div class="empty">Add the total price (Edit) to see what's left to pay.</div>`;
        if (tr.finalDue) body += `<div class="today-line" style="margin-top:8px">💳 Final payment due <b>${prettyDate(tr.finalDue)}</b>
            ${left === 0 ? `<span class="pill">paid off ✓</span>` : `<span class="pill ${fd !== null && fd <= 14 ? "late" : fd <= 45 ? "soon" : ""}">${fd < 0 ? `${-fd} days ago` : inDays(fd)}</span>`}</div>`;
        else if (isCruise(tr)) body += `<div class="today-line sub" style="margin-top:8px">Add the final-payment date (Edit) — Day Hub reminds you 14, 3 and 1 day before.</div>`;
        if (spm && left) body += `<div class="today-line">💰 Put aside about <b>${money(spm)}</b> a month to be ready.</div>`;
        body += (tr.payments || []).slice().sort((a, b) => b.day.localeCompare(a.day)).map(x => `<div class="row"><span class="time">${prettyDate(x.day)}</span>
            <span class="grow">${esc(x.note || "Payment")}</span><b>${money(x.amt)}</b><button class="x" data-tripdel="${tr.id}:payments:${x.id}" aria-label="Remove">✕</button></div>`).join("");
        body += `<button class="add-link" data-tripqa="tpay">＋ Log a payment</button>`;
      } else if (tab === "onboard") {
        const spent = tripSpent(tr), bud = Number(tr.onboardBudget || 0), gr = gratEstimate(tr);
        const cats = {}; (tr.spends || []).forEach(x => { cats[x.cat] = (cats[x.cat] || 0) + Number(x.amt || 0); });
        body = `<div class="paygrid"><div class="fact">Budget<b>${bud ? money(bud) : "--"}</b></div><div class="fact">Spent<b>${money(spent)}</b></div>
            <div class="fact ${bud && spent > bud ? "" : "take"}">Left<b>${bud ? money(bud - spent) : "--"}</b></div></div>`;
        if (bud && spent > bud) body += `<div class="bstat over" style="margin-top:8px">⚠ ${money(spent - bud)} over your onboard budget.</div>`;
        if (isCruise(tr)) { const credit = Number(tr.credit || 0), bal = spent + gr - credit;
          body += `<div class="today-line" style="margin-top:8px">🧾 Ship account: <b>${money(bal)}</b> <span class="sub" style="display:inline">(spent ${money(spent)} + gratuities ${money(gr)}${credit ? ` − credit ${money(credit)}` : ""})</span></div>`;
          if (tr.end && daysUntil(tr.end) <= 1) body += `<label class="row"><input type="checkbox" class="tick" data-tverify="${tr.id}" ${tr.accountVerified ? "checked" : ""}><span class="grow">Final ship account checked — charges match</span></label>`; }
        if (pkgOf(tr) && pkgOf(tr).gratsPaid) body += `<div class="today-line" style="margin-top:8px">🧾 Gratuities: <b>$0</b> — ${esc(pkgOf(tr).name)} pays crew appreciation.</div>`;
        if (gr) body += `<div class="today-line" style="margin-top:8px">🧾 Automatic gratuities: about <b>${money(gr)}</b> (${Number(tr.travelers) || 1} × ${nights} nights × ~$${GRAT_PER_DAY}) — they hit your account even if you never log them.</div>`;
        const mx = Math.max(1, ...Object.values(cats));
        body += Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="catrow"><span>${esc(c)}</span>
            <span class="bar"><span style="left:0;width:${v / mx * 100}%"></span></span><b>${money(v)}</b></div>`).join("");
        body += (tr.spends || []).slice().sort((a, b) => b.day.localeCompare(a.day)).slice(0, 6).map(x => `<div class="row"><span class="time">${prettyDate(x.day)}</span>
            <span class="grow">${esc(x.cat)}${x.note ? `<span class="sub">${esc(x.note)}</span>` : ""}</span><b>${money(x.amt)}</b>
            <button class="x" data-tripdel="${tr.id}:spends:${x.id}" aria-label="Remove">✕</button></div>`).join("");
        body += `<button class="add-link" data-tripqa="tspend">＋ Log ${isCruise(tr) ? "onboard " : ""}spending</button>`;
      } else if (tab === "perks") {
        const P = pkgOf(tr); seedPerks(tr);
        body = P ? `<div class="today-line"><b>${esc(P.name)}</b> — what's already included:</div>` + P.includes.map(x => `<div class="today-line">✅ ${esc(x)}</div>`).join("") +
            `<div class="fine">From <a href="${PKG_SRC}" target="_blank" rel="noopener" style="color:var(--accent)">Princess's package terms</a> (sailings from Jan 14, 2026). Your own booking's terms win if they differ.</div>
             <form class="inline-add" data-drink="${tr.id}"><input name="price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Drink price $ — is it included?" required><button class="btn sm">Check</button></form>`
          : `<div class="empty">Bought a drinks / dining / Wi-Fi package? Pick it on the trip (Edit → Package) and Day Hub shows what's included. Any line: add your perks below.</div>`;
        body += `<div class="day-label" style="margin-top:12px">Use it before you lose it</div>` + ((tr.perks || []).length ? tr.perks.map(x => {
            const left = x.total ? x.total - x.used : null;
            return `<div class="row"><span class="grow">${esc(x.name)}<span class="sub">${x.unit === "$" ? `${money(x.used)} used${x.total ? ` of ${money(x.total)}` : " — set the amount ✏️"}` : `${x.used} of ${x.total} used`}</span></span>
              ${left !== null && left > 0 ? `<span class="pill soon">${x.unit === "$" ? money(left) : left} left</span>` : x.total ? `<span class="pill">all used ✓</span>` : ""}
              <button class="btn sm ghost" data-perk="${tr.id}:${x.id}:1">${x.unit === "$" ? "Use $" : "＋1"}</button>
              <button class="x" data-perkedit="${tr.id}:${x.id}" aria-label="Set amount">✏️</button>
              <button class="x" data-tripdel="${tr.id}:perks:${x.id}" aria-label="Remove">✕</button></div>`; }).join("")
          : `<div class="empty">Nothing tracked yet.</div>`) + `<button class="add-link" data-tripqa="tperk">＋ Add a perk (credit, meals, photos…)</button>`;
        if (/princess/i.test(tr.line || "")) body += `<div class="day-label" style="margin-top:12px">🟠 Your Medallion (Princess)</div>
            <div class="today-line">• A quarter-sized disc you wear — it's your boarding pass, cabin key, ID and how you pay onboard.</div>
            <div class="today-line">• Your cabin door unlocks as you walk up to it.</div>
            <div class="today-line">• OceanNow finds you by your Medallion — order food and drinks to your cabin or where you're sitting.</div>
            <div class="today-line">• Get it: mailed home (a fee — set it in online check-in at least 13 days before sailing, US / PR / Canada addresses) or picked up free at the port.</div>
            <div class="today-line">• Use the Princess app with it: check-in, your calendar / planner, finding your group.</div>
            <div class="today-line">⚠️ Before you leave the cabin: Medallion → pocket or lanyard.</div>
            <div class="fine">From <a href="https://www.princess.com/ships-and-experience/princess-medallionclass/ocean-faq" target="_blank" rel="noopener" style="color:var(--accent)">Princess MedallionClass FAQ</a>.</div>`;
      } else if (tab === "lists") {
        ensureLists(tr); const keys = tripListKeys(tr);
        const lk = keys.includes(S.tripList) ? S.tripList : "packing", L = (tr.lists && tr.lists[lk]) || [];
        const done = L.filter(i => i.done).length;
        body = `<div class="tabs">${keys.map(k => [k, TRIP_LISTS[k]]).map(([k, l]) => { const n = ((tr.lists || {})[k] || []);
            return `<button class="tab ${k === lk ? "on" : ""}" data-triplist="${k}">${l}<small>${n.filter(i => i.done).length}/${n.length}</small></button>`; }).join("")}</div>
          <div class="today-line sub">${done} of ${L.length} done</div>` +
          L.map(i => `<div class="row ${i.done ? "done" : ""}"><input type="checkbox" class="tick" data-titem="${tr.id}:${lk}:${i.id}" ${i.done ? "checked" : ""} aria-label="Done">
            <span class="grow">${esc(i.text)}</span><button class="x" data-tripdel="${tr.id}:lists.${lk}:${i.id}" aria-label="Remove">✕</button></div>`).join("") +
          `<form class="inline-add" data-tadd="${tr.id}:${lk}"><input name="text" placeholder="Add to ${TRIP_LISTS[lk]}…" required autocomplete="off"><button class="btn sm">Add</button></form>`;
      } else {
        body = `<div class="today-line sub">For first-timers — things most people wish someone had told them.</div>` +
          CRUISE_TIPS.map(t => `<div class="today-line">💡 ${esc(t)}</div>`).join("");
      }
      return pick + head + `<div class="tabs" style="margin-top:10px">${tabs.map(k => `<button class="tab ${k === tab ? "on" : ""}" data-triptab="${k}">${TL[k]}</button>`).join("")}</div>` +
        body + `<div class="foot-actions" style="margin-top:6px"><button class="add-link" data-qa="trip">＋ Another trip</button></div>`;
    } },

  packages: { icon: "📦", title: "Packages", add: ["package", "Add a package"],
    meta: () => { const n = S.packages.filter(p => !p.delivered).length, r = openReturns().length;
      return [n ? `${n} on the way` : "", r ? `${r} to return` : ""].filter(Boolean).join(" · "); },
    body: () => {
      const recent = addDays(today(), -3);
      const list = S.packages.filter(p => !p.delivered || (p.deliveredDay || "") >= recent)
        .sort((a, b) => (a.delivered - b.delivered) || (a.eta || "9999").localeCompare(b.eta || "9999"));
      const rets = openReturns(), retHtml = (rets.length ? `<div class="rs-h">↩️ Returns</div>` + rets.map(r => { const n = daysUntil(r.by);
          return `<div class="row ${n < 0 ? "late" : ""}"><div class="grow"><b>${esc(r.what)}</b>${r.store ? ` <span class="sub" style="display:inline">· ${esc(r.store)}</span>` : ""}
            <span class="sub">${(RETURN_HOW[r.how] || RETURN_HOW.ship)[0]} by ${prettyDate(r.by)} — ${retWhen(r)}${r.amount ? ` · ${money(r.amount)} back` : ""}</span></div>
            ${n <= 3 ? `<span class="pill ${n <= 1 ? "soon" : ""}">${n < 0 ? "late" : inDays(n)}</span>` : ""}
            <button class="btn sm ghost" data-retdone="${r.id}">✓ Returned</button><button class="x" data-del="returns:${r.id}" aria-label="Remove">✕</button></div>`; }).join("") : "")
        + `<div class="foot-actions"><button class="add-link" data-qa="return">↩️ Add a return</button></div>`;
      if (!list.length) return (rets.length ? "" : `<div class="empty">Add a tracking number — Day Hub knows UPS, USPS, FedEx, Amazon and DHL and puts the arrival day on your schedule.</div>`) + retHtml;
      return list.map(p => { const n = p.eta ? daysUntil(p.eta) : null;
        return `<div class="row ${p.delivered ? "done" : ""}"><div class="grow">${esc(p.name)}<span class="sub">${(CARRIERS[p.carrier] || CARRIERS.other)[0]} · …${esc(cleanNum(p.num).slice(-6))}${p.delivered ? " · delivered" : p.eta ? ` · arrives ${prettyDate(p.eta)}` : " · no date yet"}</span></div>
          ${!p.delivered && n !== null && n <= 1 ? `<span class="pill ${n <= 0 ? "soon" : ""}">${n < 0 ? "late?" : inDays(n)}</span>` : ""}
          <a class="btn sm ghost" href="${trackUrl(p)}" target="_blank" rel="noopener">Track</a>
          ${p.delivered ? "" : `<button class="btn sm ghost" data-pkgdone="${p.id}" aria-label="Delivered">✓</button>`}
          <button class="x" data-del="packages:${p.id}" aria-label="Remove">✕</button></div>`; }).join("") +
        `<div class="fine" style="margin-top:6px">Track opens the carrier's page. Live status updates are planned for Day Hub Pro.</div>` + retHtml;
    } },

  people: { icon: "🎂", title: "People & dates", add: ["person", "Add a birthday or date"],
    meta: () => { const u = upcomingPeople(14); return u.length ? `${u.length} coming up` : ""; },
    body: () => {
      const found = (S.gcal.dates || []);
      const foundBox = found.length ? `<div class="found-box"><b>📅 Found ${found.length} date${found.length === 1 ? "" : "s"} in your Google Calendar</b>
          ${found.slice(0, 30).map(b => `<div class="row"><span class="grow">${PKIND[b.kind]} ${esc(b.name)} <span class="sub">${prettyDate(personNext(b))}</span></span>
            <button class="btn sm ghost" data-fadd="${esc(b.key)}">＋ Add</button></div>`).join("")}
          <div class="foot-actions"><button class="btn sm" data-fadd="__all">Add all ${found.length}</button><button class="add-link" data-fno="1">Not these</button></div></div>` : "";
      if (!S.people.length) return foundBox + `<div class="empty">Birthdays, anniversaries, important dates — Day Hub reminds you in time to get a gift.${S.gcal.connected ? "" : " Connect Google Calendar in ⚙ and Day Hub finds the ones already in your calendar."}</div>`;
      const row = ({ p, day }) => { const n = daysUntil(day);
        return `<div class="row pp ${n === 0 ? "today" : ""}"><span class="grow"><b>${PKIND[p.kind] || "⭐"} ${esc(personLabel(p, day))}</b>
            <span class="sub">${n === 0 ? "🎉 TODAY — call, text or card?" : `${inDays(n)} · ${prettyDate(day)}`}</span>
            ${giftDue(p, day) && n > 0 ? `<span class="sub gift">🎁 Gift?${p.ideas ? ` Ideas: ${esc(p.ideas)}` : ""}</span>` : ""}</span>
          ${giftDue(p, day) ? `<button class="btn sm ghost" data-pgot="${p.id}">✓ Got it</button>` : ""}
          <button class="x" data-pedit="${p.id}" aria-label="Edit">✏️</button></div>`; };
      const soon = upcomingPeople(60), later = S.people.map(p => ({ p, day: personNext(p) })).filter(x => daysUntil(x.day) > 60).sort((a, b) => a.day.localeCompare(b.day));
      return foundBox + (soon.length ? soon.map(row).join("") : `<div class="empty">Nothing in the next 60 days.</div>`) +
        (later.length ? `<details class="steps"><summary>All dates (${S.people.length})</summary>${later.map(row).join("")}</details>` : "");
    } },

  payday: { icon: "💵", title: "Payday",
    meta: () => { const nx = payNext(); return nx ? (daysUntil(nx) === 0 ? "today!" : inDays(daysUntil(nx))) : ""; }, body: () => paydayCard() },
  future: { icon: "🔮", title: "Future me", add: ["future", "Note to future me"],
    meta: () => S.future.length ? `${S.future.length} saved` : "",
    body: () => S.future.length ? [...S.future].reverse().map(f => `<div class="row"><span class="grow">“${esc(f.text)}”
        <span class="sub">${prettyDate(f.created.slice(0, 10))} · comes back ${f.day ? `on ${prettyDate(f.day)}` : ""}${f.day && f.words.length ? " or " : ""}${f.words.length ? `with: ${esc(f.words.join(", "))}` : ""}${f.seen ? ` · came back ${f.seen}×` : ""}</span></span>
        <button class="x" data-futedit="${f.id}" aria-label="Edit">✏️</button></div>`).join("")
      : `<div class="empty">Save the WHY behind a decision — "Next time we travel, don't book a 6 AM flight" — and Day Hub brings it back the next time it matters.</div>` },
  errands: { icon: "🛍️", title: "Errand run",
    meta: () => { const n = errandStops().length; return n ? `${n} stop${n === 1 ? "" : "s"}` : ""; }, body: () => errandsCard() },
  top3: { icon: "🎯", title: "Top 3 today",
    meta: () => { const T = S.top3.day === today() ? S.top3.items : []; return T.length ? `${T.filter(x => x.done).length}/${T.length}` : ""; }, body: () => top3Card() },
  routines: { icon: "🔁", title: "Routines", add: ["routine", "Make your own routine"],
    meta: () => { const r = routineNow(); return r ? `${esc(r.name.replace(/^\S+\s/, ""))} now` : ""; }, body: () => routinesCard() },
  home: { icon: "🏠", title: "Home", add: ["upkeep", "Add something"],
    meta: () => { const n = upkeepDue("home", 7).length; return n ? `${n} coming up` : ""; }, body: () => upkeepCard("home") },
  auto: { icon: "🚗", title: "Car", add: ["upkeep", "Add something"],
    meta: () => { const n = upkeepDue("auto", 14).length; return n ? `${n} coming up` : ""; }, body: () => upkeepCard("auto") },

  leave: { icon: "🚪", title: "Don't forget",
    meta: () => { const n = leaveLeft(); return n ? `${n} left` : "all set ✓"; },
    body: () => {
      const d = leaveDone(), all = leaveAll(), left = all.filter(x => !d.includes(x.id)).length;
      return (left ? "" : `<div class="today-line">✅ All set — have a good day!</div>`) +
        all.map(x => `<label class="row leave ${d.includes(x.id) ? "done" : ""}"><input type="checkbox" class="tick" data-leavechk="${x.id}" ${d.includes(x.id) ? "checked" : ""}>
          <span class="grow">${esc(x.text)}${x.extra ? ` <span class="sub">today · ${esc(x.why)}</span>` : ""}</span>
          ${x.extra ? "" : `<button type="button" class="x" data-leavedel="${x.id}" aria-label="Remove">✕</button>`}</label>`).join("") +
        `<form class="inline-add" data-addleave="1"><input name="text" placeholder="Add to your list (gym bag, sunglasses…)" required autocomplete="off"><button class="btn sm">Add</button></form>
        ${d.length ? `<div class="foot-actions"><button class="add-link" data-leavereset="1">Uncheck all</button></div>` : ""}`;
    } },

  countdowns: { icon: "⏳", title: "Countdowns", add: ["countdown", "Add a countdown"],
    body: () => {
      const cs = liveCountdowns();
      return cs.length ? `<div class="tiles">${cs.map(c => { const n = daysUntil(c.date);
        return `<div class="tile"><button class="x" data-del="countdowns:${c.id}" aria-label="Remove">✕</button>
          <div class="n">${n === 0 ? "🎉" : n}</div><div class="u">${n === 0 ? "today!" : n === 1 ? "day to go" : "days to go"}</div>
          <div class="tt">${esc(c.title)}</div><div class="dd">${prettyDate(c.date)}</div></div>`; }).join("")}</div>`
        : `<div class="empty">Vacation, birthday, payday — add something to look forward to.</div>`;
    } },

  lists: { icon: "🛒", title: "Lists",
    meta: () => { const n = S.lists.reduce((s, l) => s + l.items.filter(i => !i.done).length, 0); return n ? `${n} to get` : ""; },
    body: () => {
      const L = S.lists.find(l => l.id === S.listSel) || S.lists[0];
      const tabs = S.lists.map(l => `<button class="tab ${L && l.id === L.id ? "on" : ""}" data-listsel="${l.id}">${esc(l.name)}<small>${l.items.filter(i => !i.done).length || ""}</small></button>`).join("") +
        `<button class="tab" data-qa="list">＋ New</button>`;
      if (!L) return `<div class="tabs">${tabs}</div>`;
      const items = [...L.items].sort((a, b) => a.done - b.done);
      return `<div class="tabs">${tabs}</div>` +
        (items.length ? items.map(i => `<div class="row ${i.done ? "done" : ""}"><input type="checkbox" class="tick" data-item="${L.id}:${i.id}" ${i.done ? "checked" : ""} aria-label="Got it">
          <span class="grow">${esc(i.text)}</span><button class="x" data-delitem="${L.id}:${i.id}" aria-label="Remove">✕</button></div>`).join("")
          : `<div class="empty">Empty — add the first item below.</div>`) +
        `<form class="inline-add" data-additem="${L.id}"><input name="text" placeholder="Add to ${esc(L.name)}…" required autocomplete="off">
          <button class="btn sm">Add</button></form>
        <div class="foot-actions">${items.some(i => i.done) ? `<button class="add-link" data-clear="${L.id}">Clear checked</button>` : ""}
          ${S.lists.length > 1 ? `<button class="add-link" style="color:var(--dim)" data-dellist="${L.id}">Delete this list</button>` : ""}</div>`;
    } },

  route: { icon: "🛣️", title: "Route weather",
    body: () => {
      const leg = (k, lbl) => {
        const w = WXDATA && WXDATA[k];
        if (!S.route[k]) return `<div class="leg"><span>${lbl}</span><span class="empty">not set</span></div>`;
        if (!w) return `<div class="leg"><span>${lbl}: ${esc(S.route[k])}</span><span class="empty">…</span></div>`;
        const [icon, txt] = wmo(w.day.code);
        return `<div class="leg"><span>${lbl}: ${esc(w.label)}</span><b>${icon} ${Math.round(w.day.hi)}°/${Math.round(w.day.lo)}° · rain ${w.day.rain ?? 0}%</b></div>
                <div class="empty">${txt}${(w.day.rain ?? 0) >= 50 ? " — <b style='color:var(--red)'>plan for wet roads</b>" : ""}</div>`;
      };
      return leg("from", "From") + leg("to", "To") +
        `<form class="inline-add" data-route="1"><input name="from" placeholder="From: city or ZIP" value="${esc(S.route.from)}">
         <input name="to" placeholder="To: city or ZIP" value="${esc(S.route.to)}"><button class="btn sm">Set</button></form>`;
    } },

  loads: { icon: "🚚", title: "Today's loads", add: ["loads", "Add a load"], body: () => listCard("loads", "load") },
  jobs:  { icon: "🔧", title: "Today's jobs", add: ["jobs", "Add a job"], body: () => listCard("jobs", "job") },

  nextup: { icon: "⏭️", title: "Next up",
    body: () => {
      const nx = nextPlan();
      if (!nx) return `<div class="empty">Nothing coming up this week.</div>`;
      if (nx.t && nx.when === hm(nx.t)) {
        const [h, m] = nx.t.split(":").map(Number); const at = new Date(); at.setHours(h, m, 0, 0);
        const mins = Math.max(0, Math.round((at - new Date()) / 60000));
        return `<div class="leg"><span>${nx.icon} ${esc(nx.title)}</span><b>in ${mins >= 60 ? Math.floor(mins / 60) + "h " : ""}${mins % 60}m</b></div>`;
      }
      return `<div class="leg"><span>${nx.icon} ${esc(nx.title)}</span><b>${esc(nx.when)}</b></div>`;
    } },

  games: { icon: "🏟️", title: "Today's games", body: () => `<div class="empty">Today's games and start times arrive in a later version.</div>` },
};

function listCard(key, word) {
  const rows = S[key].filter(x => x.day === today()).sort((a, b) => a.time.localeCompare(b.time));
  return rows.length ? rows.map(x => `<div class="row ${x.done ? "done" : ""}"><input type="checkbox" class="tick" data-tickl="${key}:${x.id}" ${x.done ? "checked" : ""} aria-label="Done">
    <span class="time">${hm(x.time)}</span><span class="grow">${esc(x.title)}</span>
    <button class="x" data-del="${key}:${x.id}" aria-label="Remove">✕</button></div>`).join("")
    : `<div class="empty">No ${word}s today.</div>`;
}

function welcomeHtml() {
  return `<section class="card welcome"><h2>Welcome to Day Hub 👋</h2><p>Two quick things and your day is set.</p>
    <form class="qa-form" data-setup="1"><input name="name" placeholder="Your first name" autocomplete="given-name">
      <input name="city" placeholder="City or ZIP for weather (e.g. 72032)" required>
      <select name="pack">${Object.entries(PACKS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("")}</select>
      <button class="btn">Let's go</button></form></section>`;
}

function render() {
  const t = today();
  if (!VIEW || (VIEW < addDays(t, -60))) VIEW = t;
  // Left open past midnight: a schedule that was on "today" moves to the new
  // today instead of reading "Yesterday" until the app is reopened.
  if (LAST_DAY && LAST_DAY !== t && VIEW === LAST_DAY) VIEW = t;
  LAST_DAY = t;
  paintHero();
  const hr = new Date().getHours();
  let order = cardOrder().filter(k => !S.hidden.includes(k) && !(k === "tomorrow" && hr < 15) && !(k === "reset" && hr < 18) && !(k === "errands" && !errandStops().length) && !(k === "inbox" && !S.mail.on && !S.mail.found.length));
  // Smart jumps only until the user arranges the screen (Scott 10/2: "order the
  // sections how anyone would like") - after that their order always wins.
  if (!S.order && hr >= 17 && order.includes("tomorrow")) order = ["tomorrow", ...order.filter(k => k !== "tomorrow")];
  if (!S.order && hr >= 18 && order.includes("reset")) order = ["reset", ...order.filter(k => k !== "reset")];
  if (!S.order && S.mail.found.length && order.includes("inbox")) order = ["inbox", ...order.filter(k => k !== "inbox")];   // waiting on you = on top
  const cards = order.map(k => {
    const c = CARDS[k]; const col = S.collapsed.includes(k);
    const tag = PACKS[S.pack].cards.includes(k) ? ` <span class="tag">${PACKS[S.pack].label}</span>` : "";
    if (!can(k)) return `<section class="card" data-card="${k}"><h3><span class="ci">${c.icon}</span>${c.title} <span class="tag">PRO</span></h3>
      <div class="body"><div class="empty">Part of Day Hub Pro. No ads, ever — Pro just does more.</div></div></section>`;
    return `<section class="card ${col ? "collapsed" : ""}" data-card="${k}">
      <h3 data-collapse="${k}"><span class="ci">${c.icon}</span>${c.title}${tag}<span class="meta">${c.meta ? c.meta() : ""}</span><span class="chev">⌄</span></h3>
      <div class="body">${c.body()}${c.add ? `<button class="add-link" data-qa="${c.add[0]}">＋ ${c.add[1]}</button>` : ""}</div></section>`;
  }).join("");
  futureDue();
  document.getElementById("cards").innerHTML = futureBanner() + whatsNewHtml() + (!S.city && !S.name ? welcomeHtml() : "") + cards +
    `<button class="add-link arrange-link" data-arrange="1">↕ Arrange my screen</button>`;
  tick();
}

function tick() {
  const c = document.getElementById("clockNow");
  if (!c) return;
  const s = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const m = s.match(/^(.*?)\s*([AaPp]\.?\s?[Mm]\.?)$/);
  c.innerHTML = m ? `${m[1]}<small>${m[2].toUpperCase()}</small>` : s;
}

// ---------------------------------------------------------- toast + undo
let TOAST_ACT = null;
function toast(msg, undoable, extra) {
  const el = document.getElementById("toast");
  TOAST_ACT = extra ? extra.act : null;
  el.innerHTML = `<span>${esc(msg)}</span>${extra ? `<button data-tact="1">${esc(extra.label)}</button>` : ""}${undoable ? `<button data-undo="1">Undo</button>` : ""}`;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); UNDO = null; }, undoable ? 5000 : 2200);
}
// Snapshot the whole state before anything destructive; Undo puts it back.
const snap = () => { UNDO = JSON.stringify(S); };

// ------------------------------------------------------------ quick add
// ------------------------------------------------------------- AI helper
// Scott 10/2 ("go with A"): Claude through a tiny relay in Scott's own Google
// account (relay/Code.gs, a Google Apps Script web app). The relay holds the
// API key + a passphrase; this phone only knows the passphrase, typed once in
// ⚙ and kept on THIS phone (never in the backup, never in the code). The relay
// runs only three fixed jobs - dump / ask / top3 - on the cheapest model with a
// daily cap. If it is off or down, everything falls back to the free on-phone way.
const AI_URL = "https://script.google.com/macros/s/AKfycbyVbxOCPR7v8UNTVufOWKOKBpI19-NcWEXMVzjP86iKraxenseHpWL95W9sB_Rr6DXo/exec";
const AI_KEY = "dayhub.aipass";
const aiPass = () => { try { return localStorage.getItem(AI_KEY) || ""; } catch (e) { return ""; } };
const aiOn = () => !!aiPass();
async function aiCall(task, input, pass = aiPass()) {
  const t = today(), r = await fetch(AI_URL, { method: "POST", body: JSON.stringify({ pass, task, input,
    today: t, weekday: parseDay(t).toLocaleDateString("en-US", { weekday: "long" }) }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}
const aiJSON = text => { const m = String(text || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; };
function drawAiBox(msg) {
  const g = document.getElementById("aiBox"); if (!g) return;
  g.innerHTML = `<h3>🤖 AI helper</h3>` + (aiOn()
    ? `<div class="leg"><span>✅ On — Brain dump, 💡 Ask and 🎯 Top 3 use AI${msg ? ` · ${esc(msg)}` : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-ai="test">Test it</button><button class="btn sm ghost" data-ai="off">Turn off</button></div>`
    : `<p class="fine" style="margin-top:0">Smarter sorting for 🧠 Brain dump (more coming). Uses your own Claude helper — set up once:</p>
       <ol class="steps"><li>Type the passphrase you saved as <b>PASS</b> in your Day Hub AI relay.</li><li>Tap <b>Turn on</b>.</li></ol>
       <form class="inline-add" data-aipass="1"><input name="pass" type="password" placeholder="Passphrase" autocomplete="off" required><button class="btn sm">Turn on</button></form>
       ${msg ? `<p class="fine" style="margin-top:6px">⚠️ ${esc(msg)}</p>` : ""}`);
}

// ------------------------------------------------------------- brain dump
// Scott 10/2 ("cont" -> Brain Dump, the free version): say or type everything
// on your mind in one go - "need tires next month, call Dan Tuesday, buy
// toothpaste, vacation idea for December" - and Day Hub splits it, sorts each
// piece into a to-do, a reminder (with its day/time), a shopping item or an
// idea, and SHOWS the result to approve. Nothing is added until "Add all".
// Rules on the phone, no AI and no cost; an AI sorter can replace dumpParse later.
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHOP_WORDS = /\b(milk|eggs?|bread|butter|cheese|coffee|tea|toothpaste|toothbrush|paper towels?|toilet paper|tp|soap|shampoo|conditioner|deodorant|detergent|dish soap|dog food|cat food|bananas?|apples?|chicken|beef|steak|rice|pasta|sugar|flour|batteries|trash bags|foil|cereal|juice|water|creamer|lettuce|tomatoes|onions|potatoes|bacon|sausage|yogurt|chips|razors?)\b/i;
const DUMP_KINDS = { todo: "✅ To-do", event: "⏰ Reminder", item: "🛒 Shopping", note: "💡 Idea / note", future: "🔮 Future me" };
let DUMP = [], RECOG = null;

function dumpSplit(text) {
  const parts = String(text || "").replace(/\b(and then|oh and|also|plus)\b/gi, ",")
    .split(/[\n,;]+|\.(?=\s|$)/).map(x => x.trim()).filter(x => /[a-z]/i.test(x));
  // A piece that is only a when ("Tuesday", "at 3") belongs to the one before it.
  const out = [];
  parts.forEach(x => { const w = dumpWhen(x);
    if (out.length && !w.rest.replace(/\b(on|at|by|for|this|next|the)\b/gi, "").trim() && (w.day || w.time)) out[out.length - 1] += " " + x;
    else out.push(x); });
  return out;
}
// Finds the day / time / repeat in a piece; returns them plus the text left over.
function dumpWhen(text, now = new Date()) {
  let r = " " + String(text) + " ", day = null, time = null, rep = null;
  const t0 = ymd(now), cut = re => { const m = r.match(re); if (m) r = r.replace(m[0], " "); return m; };
  const nextDow = (dow, skipToday) => { const d = new Date(now); let n = (dow - d.getDay() + 7) % 7; if (n === 0 && skipToday) n = 7; d.setDate(d.getDate() + n); return ymd(d); };
  let m;
  if ((m = cut(/\bevery\s*(day|morning|night|evening)\b|\b(daily|nightly)\b/i))) rep = "daily";
  else if ((m = cut(/\bevery\s*weekday\b|\bweekdays\b/i))) rep = "weekdays";
  else if ((m = cut(/\bevery\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) { rep = "weekly"; day = nextDow(WEEKDAYS.indexOf(m[1].toLowerCase()), false); }
  else if ((m = cut(/\b(every\s*week|weekly)\b/i))) rep = "weekly";
  else if ((m = cut(/\b(every\s*month|monthly)\b/i))) rep = "monthly";
  else if ((m = cut(/\b(every\s*year|yearly|annually)\b/i))) rep = "yearly";
  if (!day) {
    if ((m = cut(/\bday after tomorrow\b/i))) day = addDays(t0, 2);
    else if ((m = cut(/\b(today|this morning|this afternoon)\b/i))) day = t0;
    else if ((m = cut(/\btonight\b/i))) { day = t0; time = "19:00"; }
    else if ((m = cut(/\btomorrow( morning| afternoon| night| evening)?\b/i))) { day = addDays(t0, 1); if (m[1]) time = { morning: "09:00", afternoon: "14:00", evening: "18:00", night: "19:00" }[m[1].trim().toLowerCase()]; }
    else if ((m = cut(/\bin\s+(a|an|one|two|three|four|five|six|\d+)\s+(day|days|week|weeks|month|months)\b/i))) {
      const n = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[m[1].toLowerCase()] || Number(m[1]);
      const u = m[2].toLowerCase(); const d = parseDay(t0);
      if (u.startsWith("day")) d.setDate(d.getDate() + n); else if (u.startsWith("week")) d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n);
      day = ymd(d);
    }
    else if ((m = cut(/\bnext\s+week\b/i))) day = nextDow(1, true);
    else if ((m = cut(/\bnext\s+month\b/i))) day = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    else if ((m = cut(/\b(this\s+)?weekend\b/i))) day = nextDow(6, false);
    else if ((m = cut(/\b(next\s+|this\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu|thurs|fri|sat)\b/i))) {
      const k = m[2].toLowerCase().slice(0, 3), dow = WEEKDAYS.findIndex(w => w.startsWith(k));
      day = nextDow(dow, true); if (m[1] && /next/i.test(m[1]) && daysUntil(day) < 7) day = addDays(day, 7);
    }
    else if ((m = cut(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i))) {
      let d = new Date(now.getFullYear(), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]));
      if (ymd(d) < t0) d = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate()); day = ymd(d);
    }
    else if ((m = cut(/\b(\d{1,2})\/(\d{1,2})\b/))) {
      if (Number(m[1]) <= 12) { let d = new Date(now.getFullYear(), m[1] - 1, Number(m[2])); if (ymd(d) < t0) d.setFullYear(d.getFullYear() + 1); day = ymd(d); }
    }
    else if ((m = cut(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i))) {
      let d = new Date(now.getFullYear(), now.getMonth(), Number(m[1])); if (ymd(d) < t0) d = new Date(now.getFullYear(), now.getMonth() + 1, Number(m[1])); day = ymd(d);
    }
  }
  if ((m = cut(/\b(?:at|@|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\W)/i))) {
    let h = Number(m[1]) % 12; if (/p/i.test(m[3])) h += 12; time = `${pad(h)}:${m[2] || "00"}`;
  } else if ((m = cut(/\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\b/i))) {
    let h = Number(m[1]); if (h >= 1 && h <= 7) h += 12; if (h < 24) time = `${pad(h)}:${m[2] || "00"}`;
  } else if ((m = cut(/\b(?:at\s+)?noon\b/i))) time = "12:00";
  // "morning / afternoon / evening" are times only next to a day or after "in the / this";
  // "night" only after "in the / at" ("trash night" is a name, not 7 PM).
  else if (!time && (m = cut(day ? /\b(?:in the\s+|this\s+)?(morning|afternoon|evening)\b|\b(?:in the|at)\s+(night)\b/i
                                 : /\b(?:in the|this)\s+(morning|afternoon|evening)\b|\b(?:in the|at)\s+(night)\b/i)))
    time = { morning: "09:00", afternoon: "14:00", evening: "18:00", night: "19:00" }[(m[1] || m[2]).toLowerCase()];
  return { day, time, rep, rest: r.replace(/\s+/g, " ").trim() };
}
const dumpClean = s => {
  let x = String(s).replace(/^(please\s+)?(remind me to|remind me|remember to|don'?t forget to|dont forget|i need to|i have to|need to|have to|gotta|got to|i should|i want to|i gotta)\s+/i, "")
    .replace(/\s+\b(on|at|by|for|this|next|the|in)\s*$/i, "").replace(/^\b(to)\s+/i, "").replace(/\s+/g, " ").trim();
  return x ? x[0].toUpperCase() + x.slice(1) : x;
};
// One piece -> { kind, title, day, time, rep }.
function dumpClassify(piece, now = new Date()) {
  const raw = piece.trim(), w = dumpWhen(raw, now), low = w.rest.toLowerCase();
  if (/\b(future me|note to self|remind future|next time\b.*\b(don'?t|do not|never|remember)|never again)\b/i.test(raw))
    return { kind: "future", title: raw.replace(/^(remind\s+)?(future me|note to self)[:,\s-]*/i, "").replace(/^\w/, c => c.toUpperCase()) };
  if (/\b(idea|ideas|someday|maybe|what if|think about|look into)\b/i.test(raw)) return { kind: "note", title: dumpClean(raw) };
  const shopVerb = /^(please\s+)?(i need to buy|need to buy|buy|get|grab|pick up|pickup|order|we need|need more|out of|restock)\s+/i;
  if (!w.time && !w.rep && (shopVerb.test(w.rest) && (SHOP_WORDS.test(low) || !w.day)) || (!w.day && !w.time && SHOP_WORDS.test(low) && low.split(" ").length <= 3)) {
    const item = w.rest.replace(shopVerb, "").replace(/^(some|more|a|an)\s+/i, "").trim();
    return { kind: "item", title: dumpClean(item || w.rest) };
  }
  if (w.day || w.time || w.rep) {
    let day = w.day, time = w.time;
    if (!day) day = time && time <= hhmm(now) && !w.rep ? addDays(ymd(now), 1) : ymd(now);   // a repeat starts today
    return { kind: "event", title: dumpClean(w.rest) || dumpClean(raw), day, time: time || "09:00", rep: w.rep || "none" };
  }
  return { kind: "todo", title: dumpClean(raw) };
}
const dumpParse = (text, now = new Date()) => dumpSplit(text).map(p => dumpClassify(p, now)).filter(x => x.title);
function drawDump() {
  const out = document.getElementById("dumpOut"); if (!out) return;
  if (!DUMP.length) { out.innerHTML = ""; return; }
  const opt = (v, cur) => `<option value="${v}" ${v === cur ? "selected" : ""}>${DUMP_KINDS[v]}</option>`;
  out.innerHTML = `<div class="dump-h">Here's how I sorted it — change anything, then Add all</div>` + DUMP.map((x, i) => `<div class="dump-row">
      <div class="dump-line"><select data-dkind="${i}">${Object.keys(DUMP_KINDS).map(k => opt(k, x.kind)).join("")}</select>
        <button type="button" class="x" data-ddel="${i}" aria-label="Remove">✕</button></div>
      <input data-dtext="${i}" value="${esc(x.title)}" autocomplete="off">
      ${x.kind === "event" ? `<div class="two"><input type="date" data-dday="${i}" value="${x.day || today()}"><input type="time" data-dtime="${i}" value="${x.time || "09:00"}"></div>
        ${x.rep && x.rep !== "none" ? `<div class="sub">🔁 ${REPEATS[x.rep] || x.rep}</div>` : ""}` : ""}</div>`).join("");
  const b = document.querySelector("#qaForm > .btn:last-child"); if (b) b.textContent = `Add all (${DUMP.length})`;
}
async function dumpSort() {
  const ta = document.querySelector("#qaForm [name=dump]"); if (!ta) return;
  if (!ta.value.trim()) { toast("Say or type something first"); return; }
  let items = null;
  if (aiOn()) {
    const b = document.querySelector("[data-dumpsort]"); if (b) { b.disabled = true; b.textContent = "🤖 Sorting…"; }
    try {
      const j = aiJSON((await aiCall("dump", ta.value)).text), K = ["todo", "event", "item", "note"];
      items = (j && Array.isArray(j.items) ? j.items : []).filter(x => x && K.includes(x.kind) && String(x.title || "").trim()).map(x => ({
        kind: x.kind, title: String(x.title).trim().slice(0, 120),
        day: x.kind === "event" ? (/^\d{4}-\d{2}-\d{2}$/.test(x.day || "") ? x.day : today()) : null,
        time: x.kind === "event" ? (/^\d{1,2}:\d{2}$/.test(x.time || "") ? x.time.padStart(5, "0") : "09:00") : null,
        rep: x.kind === "event" && REPEATS[x.rep] ? x.rep : "none" }));
      if (!items.length) items = null;
    } catch (e) { toast("AI helper didn't answer — used the quick sorter"); }
    if (b) { b.disabled = false; b.textContent = "🧠 Sort it"; }
  }
  DUMP = items || dumpParse(ta.value).map(x => x.kind === "event" ? x : { ...x, day: null, time: null });
  if (!DUMP.length) { toast("Say or type something first"); return; }
  drawDump();
}
function dumpAdd() {
  const n = { todo: 0, event: 0, item: 0, note: 0, future: 0 }, L = S.lists.find(l => /grocer|shop/i.test(l.name)) || S.lists[0];
  DUMP.filter(x => (x.title || "").trim()).forEach(x => {
    const title = x.title.trim(); n[x.kind]++;
    if (x.kind === "todo") S.todos.push({ id: uid(), title, done: false, rep: "none", day: today() });
    else if (x.kind === "event") S.events.push({ id: uid(), day: x.day || today(), time: x.time || "09:00", title, where: "", rep: x.rep || "none" });
    else if (x.kind === "item") L.items.push({ id: uid(), text: title, done: false });
    else if (x.kind === "future") S.future.push({ id: uid(), created: new Date().toISOString(), seen: 0, text: title, words: futureWords(title), day: null });
    else S.notes.push({ id: uid(), text: title, pinned: false, updated: new Date().toISOString() });
  });
  DUMP = [];
  const said = [[n.todo, "to-do"], [n.event, "reminder"], [n.item, "shopping item"], [n.note, "idea"], [n.future, "future-me note"]].filter(([k]) => k).map(([k, w]) => `${k} ${w}${k === 1 ? "" : "s"}`).join(", ");
  return said;
}
function micToggle(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Tap the 🎤 on your keyboard and talk"); return; }
  if (RECOG) { RECOG.stop(); return; }
  const ta = document.querySelector("#qaForm [name=dump]"), base = ta.value ? ta.value.replace(/\s*$/, ", ") : "";
  RECOG = new SR(); RECOG.lang = navigator.language || "en-US"; RECOG.interimResults = true; RECOG.continuous = true;
  let finals = "";
  RECOG.onresult = e => { let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const tx = e.results[i][0].transcript;
      if (e.results[i].isFinal) finals += (finals ? ", " : "") + tx.trim(); else interim += tx; }
    ta.value = base + finals + (interim ? (finals ? ", " : "") + interim : ""); };
  RECOG.onend = () => { RECOG = null; btn.textContent = "🎤 Talk"; btn.classList.remove("on"); if (ta.value.trim()) dumpSort(); };
  RECOG.onerror = e => { if (e.error === "not-allowed") toast("Allow the microphone for Day Hub, or use the 🎤 on your keyboard"); };
  RECOG.start(); btn.textContent = "⏹ Stop"; btn.classList.add("on");
}

function qaTypes() {
  const t = [["dump", "🧠 Brain dump"], ["event", "📅 Event"], ["person", "🎂 Birthday / date"], ["upkeep", "🏠 Home / car"], ["routine", "🔁 Routine"], ["alarm", "⏰ Alarm"], ["return", "↩️ Return"], ["future", "🔮 Future me"], ["shift", "💼 Work shift"], ["todo", "✅ To-do"], ["spend", "💵 Spending"], ["item", "🛒 List item"], ["bill", "💳 Bill"], ["package", "📦 Package"], ["trip", "🚢 Trip"], ["countdown", "⏳ Countdown"], ["list", "📝 New list"]];
  if (S.pack === "trucker") t.splice(1, 0, ["loads", "🚚 Load"]);
  if (S.pack === "trades") t.splice(1, 0, ["jobs", "🔧 Job"]);
  return t;
}
function qaFields(type) {
  const d = VIEW || today();
  const F = {
    dump: `<textarea name="dump" rows="4" placeholder="Say or type everything on your mind — e.g. need tires next month, call Dan Tuesday at 2, buy toothpaste, vacation idea for December"></textarea>
      <div class="foot-actions dump-acts"><button type="button" class="btn sm ghost" data-mic="1">🎤 Talk</button><button type="button" class="btn sm" data-dumpsort="1">🧠 Sort it</button></div>
      <div class="hint">Separate things with a comma or a pause. Nothing is added until you tap Add all.</div>
      <div id="dumpOut"></div>`,
    event: `<input name="title" placeholder="What's happening?" required autocomplete="off">
      <div class="two"><input name="date" type="date" value="${d}" required><input name="time" type="time" required></div>
      <input name="where" placeholder="Where (optional)" autocomplete="off">${repSelect(true)}`,
    todo: `<input name="title" placeholder="What needs doing?" required autocomplete="off">${repSelect(false)}
      <div class="hint">Repeating to-dos come back unchecked on their days — meds, trash night, workouts.</div>`,
    loads: `<input name="title" placeholder="Pickup / delivery (e.g. PU Little Rock)" required autocomplete="off">
      <div class="two"><input name="date" type="date" value="${d}" required><input name="time" type="time" required></div>`,
    jobs: `<input name="title" placeholder="Job + address" required autocomplete="off">
      <div class="two"><input name="date" type="date" value="${d}" required><input name="time" type="time" required></div>`,
    item: `<select name="list">${S.lists.map(l => `<option value="${l.id}" ${l.id === S.listSel ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select>
      <input name="text" placeholder="Add an item" required autocomplete="off"><div class="hint">Stays open so you can add a few in a row.</div>`,
    bill: `<input name="title" placeholder="Bill name (e.g. Electric)" required autocomplete="off">
      <div class="two"><input name="amount" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount $" required>
      <input name="day" type="number" min="1" max="31" inputmode="numeric" placeholder="Due day (1-31)" required></div>
      <div class="hint">Repeats every month. Tap Paid and it moves to next month.</div>`,
    trip: (() => { const tr = S.trips.find(x => x.id === TRIP_EDIT) || {}; const v = k => esc(tr[k] ?? "");
      return `<div class="two"><select name="ttype"><option value="cruise" ${tr.type !== "trip" ? "selected" : ""}>🚢 Cruise</option><option value="trip" ${tr.type === "trip" ? "selected" : ""}>✈️ Other trip</option></select>
        <input name="tname" placeholder="Name (e.g. Caribbean cruise)" value="${v("name")}" required autocomplete="off"></div>
      <div class="two"><label class="field" style="margin:0">Leave<input name="start" type="date" value="${v("start")}" required></label>
        <label class="field" style="margin:0">Back<input name="end" type="date" value="${v("end")}"></label></div>
      <div class="two"><input name="line" placeholder="Cruise line / airline" value="${v("line")}"><input name="ship" placeholder="Ship (optional)" value="${v("ship")}"></div>
      <div class="two"><input name="port" placeholder="Leaving from (port / city)" value="${v("port")}"><input name="travelers" type="number" min="1" inputmode="numeric" placeholder="People" value="${v("travelers")}"></div>
      <div class="two"><input name="total" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Total price $" value="${v("total")}">
        <label class="field" style="margin:0">Final payment due<input name="finalDue" type="date" value="${v("finalDue")}"></label></div>
      <div class="two"><input name="onboardBudget" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Onboard budget $" value="${v("onboardBudget")}">
        <input name="credit" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Onboard credit $" value="${v("credit")}"></div>
      <div class="two"><input name="booking" placeholder="Booking number" value="${v("booking")}" autocomplete="off"><input name="cabin" placeholder="Cabin (e.g. D-512)" value="${v("cabin")}" autocomplete="off"></div>
      <label class="field" style="margin:0">Travel insurance<select name="insurance">${["undecided", "bought", "declined"].map(o => `<option value="${o}" ${(tr.insurance || "undecided") === o ? "selected" : ""}>${{ undecided: "Not decided yet", bought: "Bought", declined: "Decided not to" }[o]}</option>`).join("")}</select></label>
      <input name="travel" placeholder="Getting there (drive / flight + hotel night before…)" value="${v("travel")}" autocomplete="off">
      <label class="field" style="margin:0">Package<select name="pkg"><option value="">None / not sure</option>${Object.entries(PACKAGES).map(([k, P]) => `<option value="${k}" ${tr.pkg === k ? "selected" : ""}>${P.name}</option>`).join("")}<option value="other" ${tr.pkg === "other" ? "selected" : ""}>Another line's package (add perks yourself)</option></select></label>
      <div class="hint">Day Hub never asks for passport or ID numbers — only whether they're ready.</div>
      <div class="hint">${TRIP_EDIT ? "Changing a trip keeps its payments, spending and lists." : "Packing, documents and before-you-go lists are filled in for you."}</div>
      ${TRIP_EDIT ? `<button type="button" class="btn sm ghost" data-tripremove="${TRIP_EDIT}">Delete this trip</button>` : ""}`; })(),
    tpay: `<input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount paid $" required>
      <div class="two"><input name="date" type="date" value="${today()}" required><input name="note" placeholder="Note (deposit, final…)" autocomplete="off"></div>`,
    tport: (() => { const tr = curTrip() || {}; const pt = (tr.ports || []).find(x => x.id === PORT_EDIT) || { day: PORT_DAY || tr.start };
      const v = k => esc(pt[k] ?? "");
      return `<input name="pname" placeholder="Port (e.g. Cozumel)" value="${v("name")}" required autocomplete="off">
      <input name="pday" type="date" value="${v("day")}" min="${tr.start || ""}" max="${tr.end || ""}" required>
      <div class="two"><label class="field" style="margin:0">Arrive<input name="arrive" type="time" value="${v("arrive")}"></label>
        <label class="field" style="margin:0"><b style="color:var(--orange)">All aboard</b><input name="allAboard" type="time" value="${v("allAboard")}"></label></div>
      <input name="excursion" placeholder="Excursion (or type none)" value="${v("excursion")}" autocomplete="off">
      <div class="two"><label class="field" style="margin:0">Meet at<input name="meet" type="time" value="${v("meet")}"></label>
        <input name="where" placeholder="Meeting point" value="${v("where")}" autocomplete="off"></div>
      <div class="two"><label class="field" style="margin:0">Walk to meeting point (min)<input name="walk" type="number" min="0" inputmode="numeric" value="${v("walk") || 15}"></label>
        <label class="field" style="margin:0">Ship clock<select name="shipOffset">${[[0, "Same as local"], [60, "Ship 1 hr AHEAD"], [-60, "Ship 1 hr BEHIND"]].map(([o, l]) => `<option value="${o}" ${Number(pt.shipOffset || 0) === o ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <label class="row" style="border:none"><input type="checkbox" name="indie" value="1" ${pt.indie ? "checked" : ""} style="width:20px;height:20px"> <span class="grow">Independent tour (not booked through the ship) — extra alarm 90 min before all aboard</span></label>
      <div class="two"><input name="cash" placeholder="Cash to bring (e.g. $40)" value="${v("cash")}" autocomplete="off"><input name="currency" placeholder="Currency (e.g. USD ok)" value="${v("currency")}" autocomplete="off"></div>
      <div class="two"><input name="cards" placeholder="Cards (yes / cash better)" value="${v("cards")}" autocomplete="off"><input name="tipping" placeholder="Tipping custom" value="${v("tipping")}" autocomplete="off"></div>
      <div class="hint">All aboard is printed in your cruise app / daily planner — usually 30-60 min before the ship leaves. It's SHIP time, which can differ from your phone's local time.</div>`; })(),
    forget: forgetHtml(),
    tperk: `<input name="pname" placeholder="Perk (e.g. Onboard credit, Specialty dinners)" required autocomplete="off">
      <div class="two"><input name="ptotal" type="number" step="0.01" min="0" inputmode="decimal" placeholder="How many / how much" required>
      <select name="punit"><option value="times">times</option><option value="$">dollars</option></select></div>`,
    tperkset: (() => { const tr = curTrip() || {}; const x = (tr.perks || []).find(y => y.id === PERK_EDIT) || {};
      return `<div class="today-line"><b>${esc(x.name || "")}</b></div>
      <div class="two"><label class="field" style="margin:0">${x.unit === "$" ? "Credit $" : "Total"}<input name="ptotal" type="number" step="0.01" min="0" value="${x.total || ""}" required></label>
      <label class="field" style="margin:0">${x.unit === "$" ? "Used $" : "Used"}<input name="pused" type="number" step="0.01" min="0" value="${x.used || 0}" required></label></div>`; })(),
    tspend: `<div class="two"><input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount $" required>
      <select name="cat">${ONBOARD_CATS.map(c => `<option>${c}</option>`).join("")}</select></div>
      <div class="two"><input name="date" type="date" value="${today()}" required><input name="note" placeholder="What (optional)" autocomplete="off"></div>`,
    package: `<input name="name" placeholder="What is it (e.g. New boots)" required autocomplete="off">
      <input name="num" placeholder="Tracking number" required autocomplete="off" autocapitalize="characters">
      <div class="two"><select name="carrier"><option value="auto">Carrier: figure it out</option>${Object.entries(CARRIERS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select>
      <input name="eta" type="date" min="${today()}" title="Expected delivery (optional)"></div>
      <div class="hint">Expected date is optional — add it and the delivery shows on your schedule.</div>`,
    person: (() => { const p = S.people.find(x => x.id === PERSON_EDIT) || { kind: "birthday", lead: 14 };
      const o = (v, l, cur) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`;
      const dv = p.md ? `${p.year || today().slice(0, 4)}-${p.md}` : "";
      return `<input name="name" placeholder="Whose? (e.g. Roxanne) or what date" value="${esc(p.name || "")}" required autocomplete="off">
      <div class="two"><select name="kind">${o("birthday", "🎂 Birthday", p.kind)}${o("anniversary", "💍 Anniversary", p.kind)}${o("other", "⭐ Other date", p.kind)}</select>
        <input name="date" type="date" value="${dv}" required></div>
      <label class="check"><input type="checkbox" name="noyear" ${p.md && !p.year ? "checked" : ""}> I don't know the year</label>
      <label class="field">Gift reminder<select name="lead">${o(0, "Off", p.lead)}${o(7, "1 week before", p.lead)}${o(14, "2 weeks before", p.lead)}${o(21, "3 weeks before", p.lead)}${o(28, "4 weeks before", p.lead)}</select></label>
      <input name="ideas" placeholder="Gift ideas, sizes, favorites (optional)" value="${esc(p.ideas || "")}" autocomplete="off">
      ${PERSON_EDIT ? `<button type="button" class="btn sm ghost" data-pdel="${PERSON_EDIT}">Delete this date</button>` : ""}`; })(),
    future: (() => { const f = S.future.find(x => x.id === FUTURE_EDIT) || { text: "", words: [], day: "" };
      return `<textarea name="text" rows="3" required placeholder="What should future you remember — and why? e.g. Next time we travel, don't book a 6 AM flight. We were wrecked all day.">${esc(f.text)}</textarea>
        <label class="field">Bring it back when I add something about… (words, comma between)<input name="words" value="${esc(f.words.join(", "))}" placeholder="leave blank — Day Hub picks the words" autocomplete="off"></label>
        <label class="field">…or on this day (optional)<input name="day" type="date" value="${f.day || ""}"></label>
        ${FUTURE_EDIT ? `<button type="button" class="btn sm ghost" data-futdel="${FUTURE_EDIT}">Delete this note</button>` : ""}`; })(),
    return: `<input name="what" placeholder="What are you returning? (e.g. Boots — too small)" required autocomplete="off">
      <input name="store" placeholder="Store / site (Amazon, Target…)" autocomplete="off">
      <div class="two"><label class="field">Return by<input name="by" type="date" value="${addDays(today(), 30)}" required></label>
        <label class="field">Money back (optional)<input name="amount" type="number" min="0" step="0.01" placeholder="$"></label></div>
      <label class="field">How<select name="how">${Object.entries(RETURN_HOW).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join("")}</select></label>
      <div class="hint">Most stores give 30 days from delivery — check the receipt or order page. Day Hub reminds you 3 days and 1 day before.</div>`,
    alarm: (() => { const a = S.alarms.find(x => x.id === ALARM_EDIT) || { time: "06:00", days: [1, 2, 3, 4, 5], label: "" };
      return `<label class="field">Alarm time<input name="time" type="time" value="${a.time}" required></label>
        <div class="field">Which days?<div class="dow">${DOW.map((n, i) => `<label><input type="checkbox" name="d${i}" ${a.days.includes(i) ? "checked" : ""}>${n}</label>`).join("")}</div></div>
        <input name="label" placeholder="Label (optional — Work, Gym…)" value="${esc(a.label || "")}" autocomplete="off">
        <div class="hint">Set the same alarm in your phone's Clock app — Day Hub shows it on your schedule and in the Nightly reset. No days ticked = just tomorrow.</div>
        ${ALARM_EDIT ? `<button type="button" class="btn sm ghost" data-aldel="${ALARM_EDIT}">Delete this alarm</button>` : ""}`; })(),
    routine: (() => { const r = S.routines.find(x => x.id === ROUTINE_EDIT) || { name: "", steps: [], days: [], time: "" };
      return `<input name="name" placeholder="Name (e.g. 🏋️ Gym day)" value="${esc(r.name)}" required autocomplete="off">
        <label class="field">Steps — one per line<textarea name="steps" rows="6" required placeholder="Fill water bottle&#10;Pack gym bag&#10;Protein shake">${esc(r.steps.map(x => x.text).join("\n"))}</textarea></label>
        <div class="field">Which days? (for a reminder)<div class="dow">${DOW.map((n, i) => `<label><input type="checkbox" name="d${i}" ${r.days.includes(i) ? "checked" : ""}>${n}</label>`).join("")}</div></div>
        <label class="field">At<input name="time" type="time" value="${r.time || ""}"></label>
        ${ROUTINE_EDIT ? `<button type="button" class="btn sm ghost" data-rdel="${ROUTINE_EDIT}">Delete this routine</button>` : ""}`; })(),
    upkeep: (() => { const x = S.upkeep.find(y => y.id === UPKEEP_EDIT) || (UPKEEP_PRESET ? { area: UPKEEP_PRESET[0], name: UPKEEP_PRESET[1][0], every: UPKEEP_PRESET[1][1], unit: UPKEEP_PRESET[1][2], auto: !!UPKEEP_PRESET[1][3] } : { area: "home", every: 3, unit: "months" });
      const o = (v, l, cur) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`;
      return `<div class="two"><select name="area">${o("home", "🏠 Home", x.area)}${o("auto", "🚗 Car", x.area)}</select>
          <input name="name" list="upList" placeholder="What? (e.g. HVAC filter)" value="${esc(x.name || "")}" required autocomplete="off"></div>
        <datalist id="upList">${[...UPKEEP_PRESETS.home, ...UPKEEP_PRESETS.auto].map(([n]) => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="two"><label class="field">Every<input name="every" type="number" min="1" max="99" value="${x.every || 1}" required></label>
          <label class="field">&nbsp;<select name="unit">${["days", "weeks", "months", "years"].map(u => o(u, u, x.unit)).join("")}</select></label></div>
        <label class="field">${x.auto ? "Next pickup day" : "Next due (or leave blank and set Last done)"}<input name="next" type="date" value="${x.next || (x.auto || !x.last ? (x.id ? upkeepNext(x) : "") : "")}"></label>
        ${x.auto ? "" : `<label class="field">Last done<input name="last" type="date" value="${x.last || ""}"></label>`}
        <label class="check"><input type="checkbox" name="auto" ${x.auto ? "checked" : ""}> Repeats on its own (like trash day) — no ✓ Done needed</label>
        ${UPKEEP_EDIT ? `<button type="button" class="btn sm ghost" data-updel="${UPKEEP_EDIT}">Delete</button>` : ""}`; })(),
    countdown: `<input name="title" placeholder="What are you counting down to?" required autocomplete="off">
      <input name="date" type="date" min="${today()}" required>`,
    list: `<input name="name" placeholder="List name (e.g. Hardware store)" required autocomplete="off">`,
    note: (() => { const n = S.notes.find(x => x.id === NOTE_EDIT) || {};
      return `<textarea name="text" rows="6" placeholder="Your note" required>${esc(n.text || "")}</textarea>`; })(),
    spend: `<input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount $" required>
      <input name="what" placeholder="What for (gas, groceries, eating out…)" autocomplete="off">
      <input name="date" type="date" value="${today()}" required>
      <div class="hint">Bills are already counted — log the day-to-day spending.</div>`,
    shift: `<input name="date" type="date" value="${d}" required>
      <div class="two"><label class="field" style="margin:0">Start<input name="start" type="time" required></label>
      <label class="field" style="margin:0">End<input name="end" type="time" required></label></div>
      <input name="brk" type="number" min="0" inputmode="numeric" placeholder="Unpaid break (minutes, optional)">`,
    pay: `<label class="field" style="margin:0">Paid by
        <select name="itype"><option value="hourly" ${S.money.type !== "salary" ? "selected" : ""}>The hour</option>
        <option value="salary" ${S.money.type === "salary" ? "selected" : ""}>Salary</option></select></label>
      <label class="field" style="margin:0">Hourly pay ($) — hourly only<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" value="${S.work.rate || ""}"></label>
      <label class="field" style="margin:0">Yearly salary ($) — salary only<input name="salary" type="number" step="1" min="0" inputmode="decimal" value="${S.money.salary || ""}"></label>
      <label class="field" style="margin:0">Taken out for taxes (%)<input name="tax" type="number" step="0.5" min="0" max="60" inputmode="decimal" value="${S.work.taxPct}" required></label>
      <label class="field" style="margin:0">Overtime after (hours/week)<input name="ot" type="number" min="1" max="80" inputmode="numeric" value="${S.work.otAfter}" required></label>
      <label class="field" style="margin:0">Paid
        <select name="period"><option value="weekly" ${S.work.period !== "biweekly" ? "selected" : ""}>Every week</option>
        <option value="biweekly" ${S.work.period === "biweekly" ? "selected" : ""}>Every 2 weeks</option></select></label>
      <label class="field" style="margin:0">A pay period started on (for every 2 weeks)<input name="pstart" type="date" value="${S.work.periodStart || weekStart(today())}"></label>
      <div class="hint">Not sure of your tax %? 15–25% covers most people. Check one real paycheck: take-home ÷ gross.</div>`,
  };
  return (F[type] || F.todo) + `<button class="btn">${type === "forget" ? "Got it" : type === "pay" || (type === "trip" && TRIP_EDIT) ? "Save" : type === "dump" ? (DUMP.length ? `Add all (${DUMP.length})` : "Sort it") : "Add"}</button>`;
}
let NOTE_EDIT = null, ERASE_ARMED = 0;
let TRIP_EDIT = null, PORT_EDIT = null, PORT_DAY = null, PERK_EDIT = null;
function openQA(type, keepEdit) {
  if (!keepEdit) { TRIP_EDIT = null; PERSON_EDIT = null; UPKEEP_EDIT = null; UPKEEP_PRESET = null; ROUTINE_EDIT = null; ALARM_EDIT = null; FUTURE_EDIT = null; }
  // Opened from ⚙ (✏️ an alarm, ＋ Add an alarm): close Settings first - it sat on top and hid the form.
  if (!document.getElementById("sheet").classList.contains("hidden")) closeSettings();
  QA_TYPE = type || QA_TYPE;
  if (QA_TYPE !== "dump") DUMP = [];
  if (RECOG) RECOG.stop();
  document.getElementById("qaTypes").innerHTML = qaTypes().map(([k, l]) => `<button class="${k === QA_TYPE ? "on" : ""}" data-qtype="${k}">${l}</button>`).join("");
  const f = document.getElementById("qaForm");
  f.innerHTML = qaFields(QA_TYPE);
  document.getElementById("qa").classList.remove("hidden");
  setTimeout(() => { const i = f.querySelector("input"); if (i) i.focus(); }, 60);
}
const closeQA = () => document.getElementById("qa").classList.add("hidden");

function submitQA(f) {
  const d = Object.fromEntries(new FormData(f));
  const ty = QA_TYPE;
  if (ty === "dump") {
    if (!DUMP.length) { dumpSort(); return; }                   // first tap sorts; nothing added yet
    const dumpText = DUMP.map(x => x.title).join(" "); snap(); const said = dumpAdd(); const hit = futureCheck(dumpText);
    save(); closeQA(); render(); buzz(); toast(`Added ${said} ✓${hit ? " — 🔮 see the note at the top" : ""}`, true); return;
  }
  if (ty === "event") { S.events.push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), where: (d.where || "").trim(), rep: d.rep || "none" }); VIEW = d.date; }
  else if (ty === "shift") { S.work.shifts.push({ id: uid(), day: d.date, start: d.start, end: d.end, brk: Number(d.brk || 0) }); VIEW = d.date; }
  else if (ty === "pay") { S.work.rate = Number(d.rate || 0); S.work.taxPct = Number(d.tax); S.work.otAfter = Number(d.ot);
    S.money.type = d.itype || "hourly"; S.money.salary = Number(d.salary || 0);
    S.work.period = d.period || "weekly"; S.work.periodStart = d.pstart || null;
    save(); closeQA(); render(); toast("Pay saved ✓"); return; }
  else if (ty === "note") { const n = S.notes.find(x => x.id === NOTE_EDIT);
    if (n) { n.text = d.text.trim(); n.updated = new Date().toISOString(); } else S.notes.push({ id: uid(), text: d.text.trim(), pinned: false, updated: new Date().toISOString() });
    NOTE_EDIT = null; }
  else if (ty === "spend") S.money.spends.push({ id: uid(), day: d.date, amt: Number(d.amt), what: (d.what || "").trim() });
  else if (ty === "todo") S.todos.push({ id: uid(), title: d.title.trim(), done: false, rep: d.rep || "none", day: today() });
  else if (ty === "loads" || ty === "jobs") { S[ty].push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), done: false }); VIEW = d.date; }
  else if (ty === "bill") {
    const day = Math.min(31, Math.max(1, Number(d.day))), now = new Date();
    // Added after this month's due day = treat this month as handled; before it = due this month.
    const paid = day < now.getDate() ? today().slice(0, 7) : prevMonthKey();
    S.bills.push({ id: uid(), name: d.title.trim(), amount: Number(d.amount), day, paid });
  }
  else if (ty === "future") {
    const words = (d.words || "").split(",").map(w => w.trim().toLowerCase()).filter(w => w.length >= 3);
    const rec = { text: d.text.trim(), words: words.length ? words : futureWords(d.text), day: d.day || null };
    const old = S.future.find(x => x.id === FUTURE_EDIT);
    if (old) Object.assign(old, rec, { dayShown: rec.day !== old.day ? false : old.dayShown }); else S.future.push({ id: uid(), created: new Date().toISOString(), seen: 0, ...rec });
    FUTURE_EDIT = null;
    save(); closeQA(); render(); buzz(); toast(`🔮 Saved — comes back with: ${rec.words.join(", ") || "its date"}`); return;
  }
  else if (ty === "return") S.returns.push({ id: uid(), what: d.what.trim(), store: (d.store || "").trim(), by: d.by, how: d.how || "ship",
    amount: Number(d.amount) > 0 ? Number(d.amount) : null, done: false });
  else if (ty === "alarm") {
    const days = DOW.map((_, i) => d["d" + i] ? i : -1).filter(i => i >= 0);
    const rec = { time: d.time, days, label: (d.label || "").trim(), on: true, once: days.length ? null : addDays(today(), 1) };
    const old = S.alarms.find(x => x.id === ALARM_EDIT);
    if (old) Object.assign(old, rec); else S.alarms.push({ id: uid(), ...rec });
    ALARM_EDIT = null; if (!document.getElementById("sheet").classList.contains("hidden")) drawAlarmBox();
  }
  else if (ty === "routine") {
    const texts = (d.steps || "").split(/\n+/).map(x => x.trim()).filter(Boolean), days = DOW.map((_, i) => d["d" + i] ? i : -1).filter(i => i >= 0);
    const old = S.routines.find(x => x.id === ROUTINE_EDIT);
    if (old) { old.name = d.name.trim(); old.days = days; old.time = d.time || null;
      old.steps = texts.map(t => old.steps.find(x => x.text === t) || { id: uid(), text: t }); }   // keep ticks on unchanged steps
    else ROUTINE_OPEN = addRoutine(d.name.trim(), texts, days, d.time).id;
    ROUTINE_EDIT = null;
  }
  else if (ty === "upkeep") {
    const auto = !!d.auto, rec = { area: d.area, name: d.name.trim(), every: Math.max(1, Number(d.every) || 1), unit: d.unit, auto,
      next: d.next || null, last: auto ? null : (d.last || (d.next ? null : today())) };
    if (auto && !rec.next) rec.next = today();
    const old = S.upkeep.find(x => x.id === UPKEEP_EDIT);
    if (old) Object.assign(old, rec); else S.upkeep.push({ id: uid(), ...rec });
    UPKEEP_EDIT = UPKEEP_PRESET = null;
  }
  else if (ty === "person") {
    const rec = { name: d.name.trim(), kind: d.kind || "birthday", md: d.date.slice(5), year: d.noyear ? null : Number(d.date.slice(0, 4)),
                  lead: Number(d.lead || 0), ideas: (d.ideas || "").trim() };
    const old = S.people.find(x => x.id === PERSON_EDIT);
    if (old) Object.assign(old, rec); else S.people.push({ id: uid(), got: {}, ...rec });
    PERSON_EDIT = null;
  }
  else if (ty === "countdown") S.countdowns.push({ id: uid(), title: d.title.trim(), date: d.date });
  else if (ty === "trip") {
    const fields = { type: d.ttype, name: d.tname.trim(), start: d.start || null, end: d.end || null, line: (d.line || "").trim(),
      ship: (d.ship || "").trim(), port: (d.port || "").trim(), travelers: Number(d.travelers || 0) || null,
      total: Number(d.total || 0) || null, finalDue: d.finalDue || null, onboardBudget: Number(d.onboardBudget || 0) || null,
      credit: Number(d.credit || 0) || null, booking: (d.booking || "").trim(), cabin: (d.cabin || "").trim(),
      insurance: d.insurance || "undecided", travel: (d.travel || "").trim(), pkg: d.pkg || "" };
    const old = S.trips.find(x => x.id === TRIP_EDIT);
    if (old) { Object.assign(old, fields); seedPerks(old); }
    else { const id = uid(); const nt = ensureLists({ id, ...fields, payments: [], spends: [], ports: [], perks: [], lists: newLists(fields.type) }); seedPerks(nt); S.trips.push(nt); S.tripSel = id; S.tripTab = "ready"; }
    TRIP_EDIT = null;
  }
  else if (ty === "forget") { closeQA(); return; }
  else if (ty === "tperk" || ty === "tperkset") {
    const tr = curTrip(); if (!tr) { closeQA(); return; } tr.perks = tr.perks || [];
    if (ty === "tperk") tr.perks.push({ id: uid(), name: d.pname.trim(), total: Number(d.ptotal || 0), used: 0, unit: d.punit === "$" ? "$" : "times" });
    else { const x = tr.perks.find(y => y.id === PERK_EDIT); if (x) { x.total = Number(d.ptotal || 0); x.used = Math.min(Number(d.pused || 0), x.total || Infinity); } PERK_EDIT = null; }
  }
  else if (ty === "tport") {
    const tr = curTrip(); if (!tr) { closeQA(); return; } ensureLists(tr);
    const f2 = { day: d.pday, name: d.pname.trim(), arrive: d.arrive || "", allAboard: d.allAboard || "", excursion: (d.excursion || "").trim(), meet: d.meet || "", where: (d.where || "").trim(),
      walk: Number(d.walk || 15), shipOffset: Number(d.shipOffset || 0), indie: d.indie === "1",
      cash: (d.cash || "").trim(), currency: (d.currency || "").trim(), cards: (d.cards || "").trim(), tipping: (d.tipping || "").trim() };
    const old = tr.ports.find(x => x.id === PORT_EDIT);
    if (old) Object.assign(old, f2); else tr.ports.push({ id: uid(), ...f2 });
    tr.ports.sort((a, b) => a.day.localeCompare(b.day)); PORT_EDIT = PORT_DAY = null;
  }
  else if (ty === "tpay" || ty === "tspend") {
    const tr = curTrip(); if (!tr) { closeQA(); return; }
    if (ty === "tpay") tr.payments.push({ id: uid(), day: d.date, amt: Number(d.amt), note: (d.note || "").trim() });
    else tr.spends.push({ id: uid(), day: d.date, amt: Number(d.amt), cat: d.cat, note: (d.note || "").trim() });
  }
  else if (ty === "package") S.packages.push({ id: uid(), name: d.name.trim(), num: cleanNum(d.num),
    carrier: d.carrier === "auto" ? detectCarrier(d.num) : d.carrier, eta: d.eta || null, delivered: false });
  else if (ty === "list") { const id = uid(); S.lists.push({ id, name: d.name.trim(), items: [] }); S.listSel = id; }
  else if (ty === "item") {
    const L = S.lists.find(l => l.id === d.list);
    if (L) { L.items.push({ id: uid(), text: d.text.trim(), done: false }); S.listSel = L.id; }
    save(); render(); toast(`Added to ${L ? L.name : "list"} ✓`);
    f.querySelector("[name=text]").value = ""; f.querySelector("[name=text]").focus();
    return;
  }
  const hit = futureCheck(Object.values(d).filter(v => typeof v === "string").join(" "));
  save(); closeQA(); render(); buzz(); toast(hit ? "Added ✓ — 🔮 future you left a note (top of the screen)" : "Added ✓");
}

// ------------------------------------------------------------- events
document.addEventListener("submit", e => {
  const f = e.target; e.preventDefault();
  const data = Object.fromEntries(new FormData(f));
  if (f.id === "qaForm") { submitQA(f); return; }
  if (f.dataset.setup) {
    S.name = (data.name || "").trim(); S.city = (data.city || "").trim(); S.pack = data.pack || "general";
    save(); WXDATA = null; render(); loadWeather(); toast("You're all set ✓"); return;
  }
  if (f.dataset.remember !== undefined) { const x = (data.text || "").trim(); if (!x) return;
    S.remember.push({ id: uid(), day: addDays(today(), 1), text: x }); save(); render(); toast("📌 Saved for the morning"); return; }
  if (f.dataset.route) { S.route = { from: data.from.trim(), to: data.to.trim() }; save(); loadWeather(); return; }
  if (f.dataset.drink) { const tr = S.trips.find(x => x.id === f.dataset.drink); const P = tr && pkgOf(tr); const pr = Number(data.price);
    if (P) toast(pr <= P.drinkCap ? `✅ $${pr.toFixed(2)} — included in ${P.name} (up to $${P.drinkCap})` : `⚠️ $${pr.toFixed(2)} is over ${P.name}'s $${P.drinkCap} limit — ask the bartender before you order`);
    f.reset(); return; }
  if (f.dataset.noteadd) { S.notes.push({ id: uid(), text: data.text.trim(), pinned: false, updated: new Date().toISOString() }); save(); render(); buzz(); return; }
  if (f.dataset.tadd) { const [tid, k] = f.dataset.tadd.split(":"); const tr = S.trips.find(x => x.id === tid);
    if (tr) tr.lists[k].push({ id: uid(), text: data.text.trim(), done: false });
    save(); render(); const again = document.querySelector(`form[data-tadd="${f.dataset.tadd}"] input`); if (again) again.focus(); return; }
  if (f.dataset.ask) { askDayHub(data.q); return; }
  if (f.dataset.aipass) { const pw = (data.pass || "").trim(); if (!pw) return;
    drawAiBox("checking…");
    aiCall("ping", "", pw).then(() => { try { localStorage.setItem(AI_KEY, pw); } catch (e) { /* private mode */ } drawAiBox("connected ✓"); toast("🤖 AI helper on"); })
      .catch(e => { drawAiBox(/passphrase/.test(e.message) ? "That passphrase doesn't match the relay's PASS" : "Couldn't reach the relay: " + e.message); });
    return; }
  if (f.dataset.paysetup) { S.payday = { ...S.payday, freq: data.freq, next: data.next, amount: Number(data.amount) > 0 ? Number(data.amount) : null };
    if (data.freq === "semimonthly") { S.payday.d1 = Number(data.next.slice(8)); S.payday.d2 = Math.min(31, Math.max(1, Number(data.d2) || 15)); }
    save(); render(); buzz(); toast("💵 Payday set ✓"); return; }
  if (f.dataset.goalnew) { S.goals.push({ id: uid(), name: data.name.trim(), target: Number(data.target) || 0, saved: 0 }); save(); render(); buzz(); return; }
  if (f.dataset.goaladd) { const g = S.goals.find(x => x.id === f.dataset.goaladd); if (g) { snap(); g.saved = Math.round((g.saved + Number(data.amt || 0)) * 100) / 100; save(); render(); buzz();
    toast(g.saved >= g.target ? `🎉 ${g.name} — goal reached!` : `${money(Number(data.amt))} toward ${g.name} ✓`, true); } return; }
  if (f.dataset.addleave) { const x = (data.text || "").trim(); if (!x) return;
    S.leave.items.push({ id: uid(), text: x }); save(); render(); buzz();
    const again = document.querySelector('form[data-addleave] input'); if (again) again.focus(); return; }
  if (f.dataset.additem) {
    const L = S.lists.find(l => l.id === f.dataset.additem);
    if (L) L.items.push({ id: uid(), text: data.text.trim(), done: false });
    save(); render(); buzz();
    const again = document.querySelector(`form[data-additem="${f.dataset.additem}"] input`); if (again) again.focus();
  }
});

document.addEventListener("click", e => {
  const ne = e.target.closest && e.target.closest("[data-noteedit]");
  if (ne) { NOTE_EDIT = ne.dataset.noteedit; openQA("note"); return; }
  if (e.target.classList && e.target.classList.contains("sheet")) {         // tap on the dim backdrop
    if (e.target.id === "sheet") closeSettings(); else if (e.target.id === "pulseSheet" || e.target.id === "askSheet") e.target.classList.add("hidden"); else closeQA(); return;
  }
  const t = e.target.closest("button, h3[data-collapse]");
  if (!t) return;
  const ds = t.dataset;
  if (t.id === "fab") { openQA(VIEW === today() ? "event" : "event"); return; }
  if (t.id === "settingsBtn" || ds.open === "sheet") { openSettings(); return; }
  if (ds.close === "qa") { closeQA(); return; }
  if (ds.close === "sheet") { closeSettings(); return; }
  if (ds.qa) { openQA(ds.qa); return; }
  if (ds.qtype) { openQA(ds.qtype); return; }
  if (ds.undo) { if (UNDO) { S = JSON.parse(UNDO); UNDO = null; save(); render(); toast("Restored ✓"); } return; }
  if (ds.collapse) { const k = ds.collapse;
    S.collapsed = S.collapsed.includes(k) ? S.collapsed.filter(x => x !== k) : [...S.collapsed, k]; save(); render(); return; }
  if (ds.plan === "tomorrow") { VIEW = addDays(today(), 1); openQA("event"); return; }
  if (ds.goto) { VIEW = addDays(today(), Number(ds.day)); render();
    const c = document.querySelector(`[data-card="${ds.goto}"]`); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.day !== undefined) { const n = Number(ds.day); VIEW = n === 0 ? today() : addDays(VIEW, n); render(); return; }
  if (ds.update) { applyUpdate(); return; }
  if (ds.seen) { S.seenVersion = VERSION; saveLocal(); render(); return; }
  if (ds.tact) { const f = TOAST_ACT; TOAST_ACT = null; if (f) f(); return; }
  if (ds.install && INSTALL_EVT) { INSTALL_EVT.prompt(); INSTALL_EVT.userChoice.finally(() => { INSTALL_EVT = null; drawInstallBox(); render(); }); return; }
  if (ds.del && ds.del.startsWith("occ:")) {            // one day of a repeating event
    snap(); const [, id, day] = ds.del.split(":"); const e = S.events.find(x => x.id === id);
    if (e) { e.skip = [...(e.skip || []), day]; save(); render(); }
    toast("Removed this day", true, { label: "Delete all", act: () => { S.events = S.events.filter(x => x.id !== id); save(); render(); toast("Deleted every repeat", true); } });
    return;
  }
  if (ds.del) { snap(); const [k, id] = ds.del.split(":");
    if (k === "work.shifts") S.work.shifts = S.work.shifts.filter(x => x.id !== id);
    else if (k === "money.spends") S.money.spends = S.money.spends.filter(x => x.id !== id);
    else S[k] = S[k].filter(x => x.id !== id);
    save(); render(); toast("Removed", true); return; }
  if (ds.clock === "in") { S.work.clockIn = new Date().toISOString(); save(); render(); buzz(); toast("Clocked in ✓"); return; }
  if (ds.clock === "out") { const st = new Date(S.work.clockIn), en = new Date();
    snap();
    if (en - st >= 60000) S.work.shifts.push({ id: uid(), day: ymd(st), start: hhmm(st), end: hhmm(en), brk: 0, mins: Math.round((en - st) / 60000) });
    S.work.clockIn = null; save(); render(); buzz(); toast(`Clocked out · ${fmtH((en - st) / 3600000)}`, true); return; }
  if (ds.addfound) { addFound(ds.addfound); return; }
  if (ds.dropfound) { snap(); S.mail.found = S.mail.found.filter(x => x.key !== ds.dropfound); save(); render(); toast("Dismissed", true); return; }
  if (ds.mail === "scan") { scanMail(); return; }
  if (ds.mail === "off") { try { if (MTOKEN && window.google) google.accounts.oauth2.revoke(MTOKEN, () => {}); } catch (e) { /* gone */ }
    MTOKEN = null; S.mail = { on: false, last: null, seen: {}, found: [] }; save(); drawMailBox(); render(); toast("Gmail disconnected"); return; }
  if (ds.tripremove) { snap(); S.trips = S.trips.filter(x => x.id !== ds.tripremove); S.tripSel = null; TRIP_EDIT = null; closeQA(); save(); render(); toast("Trip deleted", true); return; }
  if (ds.notepin) { const n = S.notes.find(x => x.id === ds.notepin); if (n) { n.pinned = !n.pinned; save(); render(); } return; }
  if (ds.data === "export") { exportData(); return; }
  if (ds.data === "import") { document.getElementById("importFile").click(); return; }
  if (ds.data === "erase") { eraseAll(); return; }
  if (ds.forget) { openQA("forget"); return; }
  if (ds.perk) { const [tid, pid] = ds.perk.split(":"); const tr = S.trips.find(x => x.id === tid); const x = tr && tr.perks.find(y => y.id === pid);
    if (x) { if (x.unit === "$") { PERK_EDIT = pid; openQA("tperkset"); return; } x.used = Math.min(x.used + 1, x.total || x.used + 1); save(); render(); buzz(); } return; }
  if (ds.perkedit) { PERK_EDIT = ds.perkedit.split(":")[1]; openQA("tperkset"); return; }
  if (ds.portadd) { PORT_EDIT = null; PORT_DAY = ds.portadd; openQA("tport"); return; }
  if (ds.portedit) { PORT_EDIT = ds.portedit; PORT_DAY = null; openQA("tport"); return; }
  if (ds.tripsel) { S.tripSel = ds.tripsel; save(); render(); return; }
  if (ds.triptab) { S.tripTab = ds.triptab; save(); render(); return; }
  if (ds.triplist) { S.tripList = ds.triplist; save(); render(); return; }
  if (ds.tripedit) { TRIP_EDIT = ds.tripedit; openQA("trip", true); return; }
  if (ds.tripqa) { openQA(ds.tripqa); return; }
  if (ds.tripdel) { snap(); const [tid, where, id] = ds.tripdel.split(":"); const tr = S.trips.find(x => x.id === tid);
    if (tr) { if (where.startsWith("lists.")) { const k = where.slice(6); tr.lists[k] = tr.lists[k].filter(i => i.id !== id); }
              else tr[where] = tr[where].filter(i => i.id !== id); }
    save(); render(); toast("Removed", true); return; }
  if (ds.pkgdone) { const pk = S.packages.find(x => x.id === ds.pkgdone);
    if (pk) { snap(); pk.delivered = true; pk.deliveredDay = today(); save(); render(); buzz(); toast(`${pk.name} delivered ✓`, true); } return; }
  if (ds.paid) { const b = S.bills.find(x => x.id === ds.paid); const due = b && nextDue(b);
    if (due) { snap(); b.paid = due.slice(0, 7); save(); render(); buzz(); toast(`${b.name} paid ✓`, true); } return; }
  if (ds.delitem) { snap(); const [l, id] = ds.delitem.split(":"); const L = S.lists.find(x => x.id === l);
    if (L) L.items = L.items.filter(i => i.id !== id); save(); render(); toast("Removed", true); return; }
  if (ds.clear) { snap(); const L = S.lists.find(x => x.id === ds.clear); if (L) L.items = L.items.filter(i => !i.done);
    save(); render(); toast("Cleared", true); return; }
  if (ds.dellist) { snap(); S.lists = S.lists.filter(l => l.id !== ds.dellist); S.listSel = (S.lists[0] || {}).id; save(); render(); toast("List deleted", true); return; }
  if (ds.listsel) { S.listSel = ds.listsel; save(); render(); return; }
  if (ds.move) { moveCard(ds.move, ds.dir === "top" ? "top" : Number(ds.dir)); return; }
  if (ds.reset) { S.resetDay = ds.reset === "close" ? today() : null; S.resetAt = ds.reset === "close" ? new Date().toISOString() : null;
    save(); render(); if (ds.reset === "close") { buzz(); toast("Day closed ✓ Sleep well"); } return; }
  if (ds.rdone) { const [k, id] = ds.rdone.split(":"); const x = S[k].find(y => y.id === id); if (x) { snap();
    if (k === "todos") { x.done = true; x.doneDay = today(); } else x.done = true; save(); render(); buzz(); } return; }
  if (ds.rdrop) { snap(); S.todos = S.todos.filter(y => y.id !== ds.rdrop); save(); render(); toast("Dropped", true); return; }
  if (ds.rmove) { snap(); const T1 = addDays(today(), 1);
    const pick = ds.rmove === "all" ? ["loads", "jobs"].flatMap(k => S[k].filter(x => x.day === today() && !x.done)) : [S[ds.rmove.split(":")[0]].find(y => y.id === ds.rmove.split(":")[1])];
    pick.filter(Boolean).forEach(x => { x.day = T1; }); save(); render(); toast(`Moved to tomorrow (${pick.length})`, true); return; }
  if (ds.rmdel) { S.remember = S.remember.filter(r => r.id !== ds.rmdel); save(); render(); return; }
  if (ds.syncall) { syncTap(); return; }
  if (ds.ai === "off") { try { localStorage.removeItem(AI_KEY); } catch (e) { /* ok */ } drawAiBox(); toast("AI helper off — the quick sorter takes over"); return; }
  if (ds.ai === "test") { drawAiBox("testing…"); aiCall("ping", "").then(j => drawAiBox(`working · ${j.left} left today`)).catch(e => drawAiBox("problem: " + e.message)); return; }
  if (ds.fadd) { snap(); const keys = ds.fadd === "__all" ? (S.gcal.dates || []).map(b => b.key) : [ds.fadd];
    const n = addFoundDates(keys); save(); render(); buzz(); toast(`🎂 Added ${n} date${n === 1 ? "" : "s"} — ✏️ to add gift ideas`, true); return; }
  if (ds.fno) { S.gcal.datesNo = [...new Set([...(S.gcal.datesNo || []), ...(S.gcal.dates || []).map(b => b.key)])]; S.gcal.dates = []; saveLocal(); render(); return; }
  if (ds.futok) { S.futureShow = []; saveLocal(); render(); return; }
  if (ds.futedit) { FUTURE_EDIT = ds.futedit; openQA("future", true); return; }
  if (ds.futdel) { snap(); S.future = S.future.filter(f => f.id !== ds.futdel); S.futureShow = S.futureShow.filter(id => id !== ds.futdel); FUTURE_EDIT = null; closeQA(); save(); render(); toast("Note deleted", true); return; }
  if (ds.retdone) { const r = S.returns.find(x => x.id === ds.retdone); if (r) { snap(); r.done = true; r.doneDay = today(); save(); render(); buzz();
    toast(`↩️ Returned ✓${r.amount ? ` — watch for ${money(r.amount)} back` : ""}`, true); } return; }
  if (ds.errands) { if (S.collapsed.includes("errands")) { S.collapsed = S.collapsed.filter(k => k !== "errands"); save(); render(); }
    const el = document.querySelector('[data-card="errands"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.aledit) { ALARM_EDIT = ds.aledit; openQA("alarm", true); return; }
  if (ds.aldel) { snap(); S.alarms = S.alarms.filter(a => a.id !== ds.aldel); ALARM_EDIT = null; closeQA(); save(); render(); drawAlarmBox(); toast("Alarm removed", true); return; }
  if (ds.ask === "open") { showAsk(); return; }
  if (ds.askclose) { document.getElementById("askSheet").classList.add("hidden"); if (ds.open === "sheet") openSettings(); return; }
  if (ds.askq) { askDayHub(ds.askq); return; }
  if (ds.askmic) { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const i = document.querySelector("#askSheet input[name=q]");
    if (!SR || !i) { toast("Tap the 🎤 on your keyboard and talk"); return; }
    const r = new SR(); r.lang = navigator.language || "en-US"; r.onresult = e => { i.value = e.results[0][0].transcript; askDayHub(i.value); }; r.start(); t.textContent = "…"; return; }
  if (ds.top3 === "pick") { top3Pick(true); render(); return; }
  if (ds.t3up) { const T = S.top3.items, i = T.findIndex(x => x.id === ds.t3up); if (i > 0) [T[i - 1], T[i]] = [T[i], T[i - 1]]; saveLocal(); render(); return; }
  if (ds.t3del) { S.top3.items = S.top3.items.filter(x => x.id !== ds.t3del); saveLocal(); render(); return; }
  if (ds.pulse) { showPulse(); return; }
  if (ds.pulseclose) { document.getElementById("pulseSheet").classList.add("hidden"); return; }
  if (ds.pulsego) { document.getElementById("pulseSheet").classList.add("hidden"); const k = ds.pulsego;
    if (S.hidden.includes(k)) S.hidden = S.hidden.filter(x => x !== k); if (S.collapsed.includes(k)) S.collapsed = S.collapsed.filter(x => x !== k);
    save(); render(); const el = document.querySelector(`[data-card="${k}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.payedit) { S.payday.freq = null; render(); return; }
  if (ds.goaldel) { snap(); S.goals = S.goals.filter(g => g.id !== ds.goaldel); save(); render(); toast("Goal removed", true); return; }
  if (ds.radd !== undefined) { const p = ROUTINE_PRESETS[Number(ds.radd)]; ROUTINE_OPEN = addRoutine(p[0], p[1], p[2], p[3]).id; save(); render(); buzz();
    toast(`${p[0]} added — ✏️ to change the steps`); return; }
  if (ds.ropen) { const cur = ROUTINE_OPEN || (routineNow() || {}).id;
    ROUTINE_OPEN = t.closest("#hero") ? ds.ropen : cur === ds.ropen ? "none" : ds.ropen;
    if (S.collapsed.includes("routines")) { S.collapsed = S.collapsed.filter(k => k !== "routines"); save(); }
    render(); const el = document.querySelector('[data-card="routines"]'); if (el && t.closest("#hero")) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.redit) { ROUTINE_EDIT = ds.redit; openQA("routine", true); return; }
  if (ds.rreset) { delete S.rdone[ds.rreset]; save(); render(); return; }
  if (ds.rdel) { snap(); S.routines = S.routines.filter(r => r.id !== ds.rdel); ROUTINE_EDIT = null; closeQA(); save(); render(); toast("Routine deleted", true); return; }
  if (ds.upreset) { const [a, i] = ds.upreset.split(":"); UPKEEP_EDIT = null; UPKEEP_PRESET = [a, UPKEEP_PRESETS[a][Number(i)]]; openQA("upkeep", true); return; }
  if (ds.upedit) { UPKEEP_EDIT = ds.upedit; UPKEEP_PRESET = null; openQA("upkeep", true); return; }
  if (ds.updone) { const x = S.upkeep.find(y => y.id === ds.updone); if (x) { snap(); x.last = today(); x.next = null; save(); render(); buzz();
    toast(`✓ ${x.name.replace(/^\S+\s/, "")} — next ${prettyDate(upkeepNext(x))}`, true); } return; }
  if (ds.updel) { snap(); S.upkeep = S.upkeep.filter(x => x.id !== ds.updel); UPKEEP_EDIT = null; closeQA(); save(); render(); toast("Deleted", true); return; }
  if (ds.pedit) { PERSON_EDIT = ds.pedit; openQA("person", true); return; }
  if (ds.pgot) { const p = S.people.find(x => x.id === ds.pgot); if (p) { p.got[personNext(p).slice(0, 4)] = true; save(); render(); buzz(); toast("🎁 Got it ✓"); } return; }
  if (ds.pdel) { snap(); S.people = S.people.filter(x => x.id !== ds.pdel); PERSON_EDIT = null; closeQA(); save(); render(); toast("Date deleted", true); return; }
  if (ds.leave) { const c = document.querySelector('[data-card="leave"]');
    if (S.hidden.includes("leave")) { S.hidden = S.hidden.filter(k => k !== "leave"); save(); render(); }
    if (S.collapsed.includes("leave")) { S.collapsed = S.collapsed.filter(k => k !== "leave"); save(); render(); }
    const el = document.querySelector('[data-card="leave"]') || c; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.leavedel) { snap(); S.leave.items = S.leave.items.filter(x => x.id !== ds.leavedel); save(); render(); toast("Removed", true); return; }
  if (ds.leavereset) { S.leave.done = []; S.leave.day = today(); save(); render(); return; }
  if (ds.dump) { DUMP = []; openQA("dump"); return; }
  if (ds.dumpsort) { dumpSort(); return; }
  if (ds.mic) { micToggle(t); return; }
  if (ds.ddel !== undefined) { DUMP.splice(Number(ds.ddel), 1); drawDump(); if (!DUMP.length) { const b = document.querySelector("#qaForm > .btn:last-child"); if (b) b.textContent = "Sort it"; } return; }
  if (ds.brief) { if (ds.brief === "go") { S.briefDay = today(); saveLocal(); closeBrief(); render(); }
    else if (ds.brief === "speak") speakBrief(); else showBrief(); return; }
  if (ds.orderreset) { S.order = null; save(); drawCardList(); render(); toast("Standard order back"); return; }
  if (ds.arrange) { openSettings(); setTimeout(() => { const h = document.getElementById("arrangeHead"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); return; }
  if (ds.gconnect) { gcalConnect(); return; }
  if (ds.gsync) { gReady() ? gcalFetch().then(gcalPush) : gcalConnect(); return; }
  if (ds.gdisc) { gcalDisconnect(); return; }
  if (ds.ics) { addToPhoneCalendar(ds.ics); return; }
  if (ds.remind) {
    if (ds.remind === "on") remindOn();
    else if (ds.remind === "off") { S.remind.on = false; saveLocal(); drawRemindBox(); toast("Reminders off"); }
    else if (ds.remind === "test") notify("🔔 Day Hub test", "This is what a reminder looks like.", "dh-test");
    return;
  }
  if (ds.sync) {
    const a = ds.sync;
    if (a === "on") syncOn(); else if (a === "now") backupNow(); else if (a === "restore") restoreNow(); else if (a === "off") syncOff();
    else if (a === "use" && CLOUD_PENDING) restoreFrom(CLOUD_PENDING);
    else if (a === "keep") { CLOUD_PENDING = null; backupNow(); }
    return;
  }
});

document.addEventListener("input", e => {
  const t = e.target; if (t.dataset && t.dataset.dtext !== undefined && DUMP[Number(t.dataset.dtext)]) DUMP[Number(t.dataset.dtext)].title = t.value;
});
document.addEventListener("change", e => {
  const t = e.target, ds = t.dataset;
  if (t.id === "importFile" && t.files && t.files[0]) { importData(t.files[0]); t.value = ""; return; }
  if (ds.dkind !== undefined) { const x = DUMP[Number(ds.dkind)]; x.kind = t.value;
    if (x.kind === "event" && !x.day) { x.day = today(); x.time = "09:00"; x.rep = "none"; } drawDump(); return; }
  if (ds.dday !== undefined) { DUMP[Number(ds.dday)].day = t.value; return; }
  if (ds.dtime !== undefined) { DUMP[Number(ds.dtime)].time = t.value; return; }
  if (t.dataset.briefauto !== undefined) { S.briefAuto = t.checked; saveLocal(); toast(t.checked ? "Morning brief on" : "Morning brief off — ☀️ chip still opens it"); return; }
  if (ds.retchk) { const r = S.returns.find(x => x.id === ds.retchk); if (r) { r.done = t.checked; r.doneDay = today(); save(); render(); buzz(); } return; }
  if (ds.alon) { const a = S.alarms.find(x => x.id === ds.alon); if (a) { a.on = t.checked; save(); render(); } return; }
  if (ds.t3chk) { const x = S.top3.items.find(y => y.id === ds.t3chk); if (x) { x.done = t.checked; saveLocal(); render(); buzz();
    if (S.top3.items.every(y => y.done)) toast("🎯 All three done!"); } return; }
  if (ds.rstep) { const [rid, sid] = ds.rstep.split(":"), r = S.routines.find(x => x.id === rid); if (!r) return;
    const cur = rDone(r), ids = t.checked ? [...new Set([...cur, sid])] : cur.filter(x => x !== sid);
    S.rdone[rid] = { day: today(), ids }; save(); render(); buzz();
    if (!rLeft(r)) toast(`✅ ${r.name.replace(/^\S+\s/, "")} done!`); return; }
  if (ds.leavechk) { if (S.leave.day !== today()) { S.leave.day = today(); S.leave.done = []; }
    S.leave.done = t.checked ? [...new Set([...S.leave.done, ds.leavechk])] : S.leave.done.filter(x => x !== ds.leavechk);
    save(); render(); buzz(); if (!leaveLeft()) toast("✅ All set — have a good day!"); return; }
  if (ds.tick) { const x = S.todos.find(y => y.id === ds.tick); if (x) { x.done = t.checked; x.doneDay = t.checked ? today() : null; } }
  else if (ds.tickl) { const [k, id] = ds.tickl.split(":"); const x = S[k].find(y => y.id === id); if (x) x.done = t.checked; }
  else if (ds.item) { const [l, id] = ds.item.split(":"); const L = S.lists.find(x => x.id === l); const i = L && L.items.find(y => y.id === id); if (i) i.done = t.checked; }
  else if (ds.tverify) { const tr = S.trips.find(x => x.id === ds.tverify); if (tr) tr.accountVerified = t.checked; }
  else if (ds.titem) { const [tid, k, id] = ds.titem.split(":"); const tr = S.trips.find(x => x.id === tid);
    const i = tr && tr.lists[k].find(y => y.id === id); if (i) i.done = t.checked; }
  else if (ds.rset) { S.remind[ds.rset] = Number(t.value); saveLocal(); return; }
  else if (ds.show) { S.hidden = t.checked ? S.hidden.filter(k => k !== ds.show) : [...S.hidden, ds.show]; save(); drawCardList(); render(); return; }
  else return;
  if (t.checked) buzz();
  save(); setTimeout(render, 220);                     // let the check animation play
});

// ------------------------------------------------------------ settings
function openSettings() {
  drawSettings();
  document.getElementById("sheet").classList.remove("hidden");
}
function drawSettings() {
  document.getElementById("setName").value = S.name;
  document.getElementById("setCity").value = S.city;
  document.getElementById("setPack").innerHTML = Object.entries(PACKS).map(([k, p]) => `<option value="${k}" ${k === S.pack ? "selected" : ""}>${p.label}</option>`).join("");
  drawCardList();
  let db = document.getElementById("dataBox");
  if (!db) { db = document.createElement("div"); db.id = "dataBox"; document.getElementById("cardList").after(db); }
  drawDataBox();
  let ib = document.getElementById("installBox");
  if (!ib) { ib = document.createElement("div"); ib.id = "installBox"; document.getElementById("cardList").before(ib); }
  drawInstallBox();
  let mb = document.getElementById("mailBox");
  if (!mb) { mb = document.createElement("div"); mb.id = "mailBox"; document.getElementById("cardList").before(mb); }
  drawMailBox();
  let rb = document.getElementById("remindBox");
  if (!rb) { rb = document.createElement("div"); rb.id = "remindBox"; document.getElementById("cardList").before(rb); }
  drawRemindBox();
  let sb = document.getElementById("syncBox");
  if (!sb) { sb = document.createElement("div"); sb.id = "syncBox"; document.getElementById("cardList").before(sb); }
  drawSyncBox();
  let alb = document.getElementById("alarmBox");
  if (!alb) { alb = document.createElement("div"); alb.id = "alarmBox"; document.getElementById("cardList").before(alb); }
  drawAlarmBox();
  let ab = document.getElementById("aiBox");
  if (!ab) { ab = document.createElement("div"); ab.id = "aiBox"; document.getElementById("cardList").before(ab); }
  drawAiBox();
  let g = document.getElementById("gcalBox");
  if (!g) { g = document.createElement("div"); g.id = "gcalBox"; document.getElementById("cardList").before(g); }
  const ok = S.gcal.connected && S.gcal.scope === GCAL_SCOPE && !S.gcal.needsWrite;
  g.innerHTML = `<h3>Your phone calendar</h3>` + (ok
    ? `<div class="leg"><span>✅ Connected — Day Hub events, bills and shifts go to your phone calendar${S.gcal.pushed ? ` · last sent ${fmtTime(S.gcal.pushed)}` : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-gsync="1">Sync now</button><button class="btn sm ghost" data-gdisc="1">Disconnect</button></div>
       <details class="steps"><summary>Not showing on your phone? Check these</summary>${phoneCalSteps()}</details>`
    : `<p class="fine">Puts everything you add in Day Hub on your phone's own calendar, with alarms that ring even when Day Hub is closed. Your phone's events show here too.</p>
       <ol class="steps">
         <li>Tap <b>${S.gcal.connected ? "Reconnect" : "Connect"}</b> below.</li>
         <li>Pick your Google account.</li>
         <li>If you see <i>"Google hasn't verified this app"</i>, tap <b>Continue</b>.</li>
         <li>Tick the <b>calendar</b> box, then tap <b>Allow</b>.</li>
       </ol>
       <button class="btn sm" data-gconnect="1">🗓️ ${S.gcal.connected ? "Reconnect" : "Connect"} Google Calendar</button>
       <details class="steps"><summary>Then, on your phone (one time)</summary>${phoneCalSteps()}</details>`) +
    `<h3 id="arrangeHead">Arrange your screen</h3>
     <p class="fine" style="margin-top:0">▲▼ moves a card one spot · ⤒ puts it at the top · the switch shows or hides it.</p>`;
  document.querySelector("#sheet .sheet-body > h3").style.display = "none";
  document.getElementById("ver").textContent = `Version ${VERSION}.`;
}
// Setup steps for the PHONE side (Scott 10/2: settings make setup as easy as
// possible). Shows this phone's steps first; the other kind is one tap away.
function phoneCalSteps() {
  const samsung = `<b>Samsung / Android</b><ol>
    <li>Open your phone's <b>Settings</b> → <b>Accounts and backup</b> → <b>Manage accounts</b>.</li>
    <li>Tap your Google account → <b>Sync account</b> → turn <b>Calendar</b> on.</li>
    <li>Open the <b>Calendar</b> app → ☰ menu → <b>Manage calendars</b> → make sure your Google calendar is ticked.</li></ol>`;
  const iphone = `<b>iPhone</b><ol>
    <li>Open <b>Settings</b> → <b>Calendar</b> → <b>Accounts</b> → <b>Add Account</b> → <b>Google</b>.</li>
    <li>Sign in, then turn <b>Calendars</b> on → <b>Save</b>.</li></ol>`;
  return `${isIOS() ? iphone + samsung : samsung + iphone}
    <p class="fine">Test it: add any event in Day Hub — within a minute it's in your phone's calendar.
    Google lets Day Hub stay signed in for about an hour; after that, changes wait for one tap on <b>🔄 Sync Google Calendar</b>.</p>`;
}
function drawCardList() {
  document.getElementById("cardList").innerHTML = cardOrder().map(k => `<li><span>${CARDS[k].icon} ${CARDS[k].title}</span>
    <button class="x" data-move="${k}" data-dir="top" aria-label="Move to top">⤒</button>
    <button class="x" data-move="${k}" data-dir="-1" aria-label="Move up">▲</button>
    <button class="x" data-move="${k}" data-dir="1" aria-label="Move down">▼</button>
    <input type="checkbox" data-show="${k}" ${S.hidden.includes(k) ? "" : "checked"} aria-label="Show ${CARDS[k].title}"></li>`).join("") +
    (S.order ? `<li class="reset-order"><button class="btn sm ghost" data-orderreset="1">Back to the standard order</button></li>` : "");
}
function moveCard(k, dir) {
  const o = cardOrder(); const i = o.indexOf(k);
  if (dir === "top") { o.splice(i, 1); o.unshift(k); }
  else { const j = i + Number(dir); if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; }
  S.order = o; save(); drawCardList(); render();
}
function closeSettings() {
  const city = document.getElementById("setCity").value.trim();
  const pack = document.getElementById("setPack").value;
  const changed = city !== S.city || pack !== S.pack;
  S.name = document.getElementById("setName").value.trim();
  S.city = city; S.pack = pack; save();
  document.getElementById("sheet").classList.add("hidden");
  if (changed) WXDATA = null;
  render();
  if (changed) loadWeather();
}

// --------------------------------------------------------------- start
S = load();
loadTokens();
takeRedirectToken();
const RENEWING = autoRenew();                                   // hops to Google and straight back
// If saved data still breaks the first draw, never leave a blank screen with
// the Erase button out of reach: offer to save the raw data, then start fresh.
try { render(); }
catch (e) {
  console.warn("Day Hub could not draw saved data", e);
  document.getElementById("cards").innerHTML = `<section class="card"><h3>Something in your saved data won't open</h3><div class="body">
    <p>Save a copy first, then start fresh. Nothing is erased until you tap Start fresh.</p>
    <div class="foot-actions"><button class="btn sm" id="bootSave">Save a copy</button><button class="btn sm ghost" id="bootReset">Start fresh</button></div></div></section>`;
  document.getElementById("bootSave").onclick = () => { const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([localStorage.getItem(STORE) || ""], { type: "application/json" }));
    a.download = "dayhub-saved-data.json"; document.body.appendChild(a); a.click(); };
  document.getElementById("bootReset").onclick = () => { S = blank(); saveLocal(); location.reload(); };
}
loadWeather();
setInterval(tick, 10000);
// Once a minute: move the NOW line and the chips - unless someone is typing.
setInterval(() => { const a = document.activeElement;
  if (!a || !/INPUT|SELECT|TEXTAREA/.test(a.tagName)) render(); }, 60000);
setInterval(loadWeather, 30 * 60000);
setInterval(checkReminders, 30000);
checkUpdate();
setInterval(checkUpdate, 30 * 60000);
setInterval(() => { if (S.mail.on && mReady()) scanMail(); }, 20 * 60000);
checkReminders();
if (!RENEWING) { syncOnOpen(true); maybeBrief(); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (autoRenew()) return; VIEW = today(); render(); checkReminders(); syncOnOpen(); maybeBrief(); } });
if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("sw.js", BASE_URL)).catch(() => {});
