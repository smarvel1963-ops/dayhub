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
 *
 * v0.38: split in two to stay under 3,000 lines. THIS file = state, data and
 * every feature's logic; ui.js (loaded right after) = cards, sheets, events and
 * START. A new card's renderer goes in ui.js; its logic goes here.
 */
"use strict";
const VERSION = "0.75";
// CRUISE HUB (Scott 10/1: "we want a go to app for cruises ... and it works with
// day hub as well"). The SAME code runs from its own address /cruisehub/ (its
// own repo since v0.47; /dayhub/cruise/ forwards there) with
// window.DH_MODE = "cruise": a cruise-first screen and its own name / install.
// v0.46 (Scott 10/4: "build separate app ... its independent but also a family
// of apps"): each hub keeps its OWN data (STORE) and its OWN Drive backup
// (DFILE). The HUB FAMILY link (below, "hub family") lets each one SEE the
// other's trips - read only - when both are on the phone or both back up.
const MODE = window.DH_MODE === "cruise" ? "cruise" : "day";
const APP_NAME = MODE === "cruise" ? "Cruise Hub" : "Day Hub";
const BASE_URL = new URL(".", (document.currentScript && document.currentScript.src) || location.href).href;   // where app.js lives
const APP_ID = MODE === "cruise" ? "cruisehub" : "dayhub";
const CRUISE_URL = new URL("../cruisehub/", BASE_URL).href;    // Cruise Hub's own address (repo smarvel1963-ops/cruisehub)
const HOME_URL = MODE === "cruise" ? CRUISE_URL : BASE_URL;     // this app's own folder (its sw.js lives here)

const STORE = APP_ID + ".v1";
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
// never a redesign. v0.40: the switch is PRO_GATE in features.js (default OFF =
// everything unlocked) and what Pro covers is PLAN.PRO_FEATURES (AI, Google
// Calendar sync, Gmail, Drive backup). Every local feature stays free forever.
const can = f => !switchOn("PRO_GATE") || !PLAN.PRO_FEATURES.includes(f) || isPro();

// ------------------------------------------------------- pro (Whop purchase)
// v0.40/v0.41 (Scott 10/3, sold on Whop only). The EMAIL the buyer used on Whop
// is the account (or their Whop membership id, mem_..., as a fallback): the AI
// relay checks it with Whop (the Whop API key lives in the relay's Script
// Properties, never here) and allows PLAN.MAX_PHONES phones per purchase, told
// apart by a random id this phone makes for itself ("dayhub.device"). Stored on
// this phone only ("dayhub.pro"); re-checked every RECHECK_DAYS; if the phone
// can't reach the check it stays Pro for GRACE_DAYS more, so a dead signal never
// locks anyone out.
// v0.48: each hub keeps its own unlock ("cruisehub.pro" in Cruise Hub); Cruise
// Hub ALSO counts a Day Hub Pro unlock on the same phone (Day Hub Pro covers both).
const PRO_KEY = APP_ID + ".pro", DAY_PRO_KEY = "dayhub.pro", DAY_MS = 86400000;
const readPro = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
const proState = () => readPro(PRO_KEY);
const setProState = p => { try { localStorage.setItem(PRO_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ } };
function deviceId() {
  let d = ""; try { d = localStorage.getItem("dayhub.device") || ""; } catch (e) { /* private mode */ }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(d)) { d = "d" + uid() + uid() + uid();
    try { localStorage.setItem("dayhub.device", d); } catch (e) { /* private mode */ } }
  return d;
}
// Never lock the owner out of his own app: the phone holding the relay
// passphrase (or with the OWNER owner-switch) counts as Pro.
const ownerPhone = () => !!aiPass() || !!ownerSwitches().OWNER;
const proGood = p => !!(p.buyer && p.ok && Date.now() < (p.checked || 0) + (PLAN.RECHECK_DAYS + PLAN.GRACE_DAYS) * DAY_MS);
const proViaDayHub = () => MODE === "cruise" && !proGood(proState()) && proGood(readPro(DAY_PRO_KEY));
function isPro() {
  return ownerPhone() || proGood(proState()) || proViaDayHub();
}
// What this app sells: Cruise Hub sells the Cruise Hub Pass once CRUISE_PASS is on; otherwise Day Hub Pro.
const cruisePass = () => MODE === "cruise" && switchOn("CRUISE_PASS");
const proName = () => cruisePass() ? PLAN.CRUISE_NAME : PLAN.NAME;
async function verifyPro(buyer) {                   // throws when the check can't be reached
  const j = await (await fetch(AI_URL, { method: "POST", body: JSON.stringify({ task: "verify", buyer, device: deviceId(), app: APP_ID }) })).json();
  if (typeof j.valid !== "boolean") throw new Error(j.error || "no answer");
  // A "no" never wipes a known buyer: the email stays so Check now can retry.
  setProState({ buyer, ok: j.valid, checked: Date.now(), status: j.status || "", until: j.until || null, product: j.product || "" });
  return j.valid;
}
function recheckPro() {
  const p = proState();
  if (!switchOn("PRO_GATE") || !p.buyer || Date.now() - (p.checked || 0) < PLAN.RECHECK_DAYS * DAY_MS) return;
  verifyPro(p.buyer).then(() => render()).catch(() => { /* offline: grace period covers it */ });
}
// Gmail waits on Google's verification (GMAIL switch). A phone that already
// connected it keeps it - turning the switch off never breaks a working phone.
const gmailAllowed = () => switchOn("GMAIL") || S.mail.on || !!S.mail.found.length;

// ---------------------------------------------------------- hub family
// v0.46 (Scott 10/4: "its independent but also a family of apps"). Day Hub and
// Cruise Hub each keep their own data; each READS the other's trips, never
// writes them:
//  - both on this phone in the same browser (Android / computer): straight
//    from the other hub's saved data;
//  - otherwise (iPhone keeps installed apps apart): from the other hub's Drive
//    backup, when this hub's backup is on (the same Google sign-in reads both).
// A trip from the other hub shows in this one's schedule, morning brief,
// reminders and bills, and in the Trips card as a row with an Open button.
// A cruise Cruise Hub took over from Day Hub (S.adopted) is shown from Cruise
// Hub in both, so there is one live copy. Off: Settings -> Hub family.
const SIB = MODE === "cruise"
  ? { id: "dayhub", name: "Day Hub", store: "dayhub.v1", file: "dayhub.json", url: BASE_URL, icon: "☀️" }
  : { id: "cruisehub", name: "Cruise Hub", store: "cruisehub.v1", file: "cruisehub.json", url: CRUISE_URL, icon: "🚢" };
const FAM_KEY = APP_ID + ".family";              // the other hub's trips from its Drive backup (a cache)
let FAM_RAW = null, FAM_DATA = null, FAM_DRIVE_AT = 0;
function sibData() {
  if (!S || S.family === false) return null;
  let raw = null, src = "phone";
  try { raw = localStorage.getItem(SIB.store); if (!raw) { raw = localStorage.getItem(FAM_KEY); src = "drive"; } } catch (e) { return null; }
  if (!raw) return null;
  if (raw !== FAM_RAW) {
    FAM_RAW = raw; FAM_DATA = null;
    try { const d = JSON.parse(raw);
      if (d && typeof d === "object" && Array.isArray(d.trips))
        FAM_DATA = { trips: d.trips.filter(t => t && typeof t === "object" && !Array.isArray(t) && t.id), adopted: Array.isArray(d.adopted) ? d.adopted : [], src };
    } catch (e) { /* the other hub's data is its own business - just don't show it */ }
  }
  return FAM_DATA;
}
// This hub's own trips, less any the other hub took over (it shows them instead).
const myTrips = () => { const sd = sibData();
  return sd && sd.adopted.length ? S.trips.filter(t => !(sd.adopted.includes(t.id) && sd.trips.some(x => x.id === t.id))) : S.trips; };
// The other hub's trips (copies, marked fam) - for showing only.
function famTrips() {
  const sd = sibData(); if (!sd) return [];
  const mine = new Set(myTrips().map(t => t.id));
  return sd.trips.filter(t => !mine.has(t.id)).map(t => ({ ...t, fam: SIB.name }));
}
const allTrips = () => myTrips().concat(famTrips());
// What Cruise Hub takes from a Day Hub save: your name, city and your CRUISES.
// Nothing is removed from Day Hub's data.
function cruiseSlice(d) {
  const trips = (d && Array.isArray(d.trips) ? d.trips : []).filter(t => t && typeof t === "object" && isCruise(t));
  return { name: (d && d.name) || "", city: (d && d.city) || "", trips, adopted: trips.map(t => t.id),
           tripTab: d && d.tripTab, tripList: d && d.tripList };
}
// First open of Cruise Hub v0.46+ on a phone that has Day Hub data (before
// v0.46 the two shared it): bring the cruises over, once.
function adoptFromDayHub() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SIB.store) || "null"); } catch (e) { d = null; }
  if (!d || typeof d !== "object") return {};
  const s = cruiseSlice(d);
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* private mode */ }
  return s;
}
// The other hub's trips from its Drive backup (at most every 10 minutes).
async function famDriveRefresh() {
  if (S.family === false || !dReady() || Date.now() - FAM_DRIVE_AT < 10 * 60000) return;
  FAM_DRIVE_AT = Date.now();
  try { const c = await driveDownload(SIB.file), d = c && c.data;
    if (d && Array.isArray(d.trips)) {
      localStorage.setItem(FAM_KEY, JSON.stringify({ trips: d.trips, adopted: Array.isArray(d.adopted) ? d.adopted : [] }));
      render();
    }
  } catch (e) { /* tried again next backup */ }
}

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
  family: true, adopted: [],
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
  let s, raw = null;
  try { raw = localStorage.getItem(STORE); } catch (e) { /* private mode */ }
  if (raw === null && MODE === "cruise") return normalize(adoptFromDayHub());
  try { s = JSON.parse(raw || "{}"); }
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
  s.family = s.family !== false;
  s.adopted = (Array.isArray(s.adopted) ? s.adopted : []).filter(x => typeof x === "string");
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
  const want = [...BASE, ...(MODE === "cruise" ? [] : PACKS[S.pack].cards), "family"];   // v0.50 Hub family card: always last
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
  if (navigator.onLine === false && WXDATA && WXDATA.here) return;          // v0.61 offline: keep the last forecast, don't blank it
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
  if (!can("gcal")) { toast(`Google Calendar sync is part of ${proName()}`); return; }
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
  if (S.sync.on && dReady()) { await syncDrive(); famDriveRefresh(); }
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
  allTrips().filter(tr => tr.start && daysUntil(tr.start) >= 0 && !out.some(o => o.day === tr.start && o.title === tr.name))
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
const DFILE = APP_ID + ".json";
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
async function driveFind(name = DFILE) {
  const q = encodeURIComponent(`name='${name}'`);
  const j = await (await dfetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`)).json();
  return (j.files || [])[0] || null;
}
async function driveDownload(name = DFILE) {
  const f = await driveFind(name);
  return f ? (await dfetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json() : null;
}
async function driveUpload() {
  const data = JSON.parse(JSON.stringify(S));
  delete data.gcal;                                            // re-fetched from Google, not ours to copy
  const body = JSON.stringify({ app: APP_ID, v: VERSION, savedAt: new Date().toISOString(), data });
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
  famDriveRefresh();
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
  if (!can("sync")) { toast(`Backup & sync is part of ${proName()}`); return; }
  if (!(await driveSignIn(S.sync.on ? "" : "consent"))) return;
  try {
    let cloud = await driveDownload();
    if (!cloud && MODE === "cruise") {                         // before v0.46 Cruise Hub backed up into dayhub.json
      const old = await driveDownload(SIB.file);
      if (old && old.data) cloud = { savedAt: old.savedAt, data: cruiseSlice(old.data) };
    }
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
    : `<p class="fine" style="margin-top:0"><b>⚠️ Not backed up yet</b> — everything is only on this phone. Turn it on once:</p>
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
  allTrips().forEach(tr => {
    if (tr.finalDue && tripLeft(tr) !== 0) [14, 3, 1, 0].forEach(n => { const d = addDays(tr.finalDue, -n);
      if (inWin(d)) { const at = atMs(d, R.billHour); add(`tf:${tr.id}:${n}`, atMs(d, "23:59"), at,
        `💳 Final payment ${n === 0 ? "due TODAY" : `due in ${n} day${n === 1 ? "" : "s"}`}`,
        `${tr.name}${tripLeft(tr) ? ` — ${money(tripLeft(tr))} left` : ""}. Miss it and the booking can be cancelled.`); } });
    if (tr.end && perksLeft(tr).length) [2, 1].forEach(n => { const d = addDays(tr.end, -n);
      if (inWin(d)) { const at = atMs(d, "10:00"); add(`pk:${tr.id}:${n}`, atMs(d, "23:59"), at, `🎁 Use it before you lose it — ${n} day${n === 1 ? "" : "s"} left`,
        perksLeft(tr).map(x => `${x.name}: ${x.unit === "$" ? money(x.total - x.used) : x.total - x.used} left`).join(" · ")); } });
    (tr.ports || []).filter(pt => inWin(pt.day)).forEach(pt => {
      // v0.52: alarms run on the PHONE's clock, so all aboard is converted from ship time first (it fired
      // an hour late when the ship's clock was an hour ahead).
      if (pt.allAboard) (pt.indie ? [90, 60, 30] : [60, 30]).forEach(m => { const aa = atMs(pt.day, aaLocal(pt));
        add(`aa:${pt.id}:${m}`, aa, aa - m * 60000, `⚓ Back on the ship by ${hm(aaLocal(pt))}`, `${m} minutes — ${pt.name}. The ship will not wait.`); });
      if (pt.allAboard && pt.boarded !== pt.day) { const by = atMs(pt.day, guardBy(pt));      // v0.52 Return Guard
        add(`rg:${pt.id}:plan`, by, by - 30 * 60000, `🟡 Start heading back soon — ${pt.name}`, `Leave by ${hm(guardBy(pt))} to be on the ship with your ${guardMargin()} min safety margin.`);
        add(`rg:${pt.id}:go`, by + 30 * 60000, by, `🟠 Leave now for the ship — ${pt.name}`, `All aboard ${hm(aaLocal(pt))}. Don't make another stop.`); }
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
  if (typeof cruiseReminders === "function") cruiseReminders(add, inWin);       // v0.56 final-night safe check (cruise.js)
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
  if (!can("reminders")) { toast(`Reminders are part of ${proName()}`); return; }
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
    : `<p class="fine" style="margin-top:0">In your browser menu <b>⋮</b> choose <b>Install app</b> or <b>Add to Home screen</b>.</p>`) +
    (switchOn("STORE") && PLAN.PLAY_STORE_URL && !standalone() && !isIOS()
      ? `<a class="btn sm ghost" style="margin-top:8px" href="${esc(PLAN.PLAY_STORE_URL)}" target="_blank" rel="noopener">▶ Get it on Google Play</a>` : "");
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
  if (!gmailAllowed()) return;
  if (!can("mail")) { toast(`Email scanning is part of ${proName()}`); return; }
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
  g.hidden = !gmailAllowed(); if (g.hidden) { g.innerHTML = ""; return; }
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
const TRIP_LISTS = { packing: "Packing", docs: "Documents", before: "Before you go", embark: "Sail day", requests: "Cabin requests", home: "Getting home", final: "Final-night bag", after: "After the trip" };
const CRUISE_ONLY_LISTS = ["requests", "home", "final", "after"];
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
    // v0.55 (Scott's plan: "Final-night packing reversal - DON'T PUT THESE OUTSIDE"): what stays WITH you the last night.
    final: ["Passport / ID - with you, never in the bag outside", "Wallet + cards", "Medication", "Phone + charger", "Glasses / contacts",
      "Car keys - out of the cabin safe tonight", "Tomorrow's clothes + shoes set out", "Morning toiletries", "Parking / flight / ride confirmations",
      "Cabin safe opened and EMPTY", "Checked: closets, drawers, under the bed, bathroom, balcony"],
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
// v0.54 WALLET (V1 step 3, Scott's plan: "Real Vacation Cost = cruise + transportation + hotel + parking +
// packages + excursions + insurance"). Costs AROUND the cruise, each paid or not yet; the cruise fare stays
// total + payments. Onboard credit = tr.credit (Onboard tab); benefits = perks.
const COST_CATS = [["hotel", "🏨 Hotel"], ["travel", "🚗 Gas / flights"], ["parking", "🅿️ Parking"], ["excursion", "🤿 Excursions"],
  ["package", "🍹 Packages"], ["insurance", "🛡️ Insurance"], ["other", "🧾 Other"]];
const costLabel = k => (COST_CATS.find(c => c[0] === k) || COST_CATS[COST_CATS.length - 1])[1];
function tripWallet(tr) {
  const costs = (tr.costs || []).filter(c => Number(c.amt) > 0);
  const extras = costs.reduce((n, c) => n + Number(c.amt), 0), extrasPaid = costs.filter(c => c.paid).reduce((n, c) => n + Number(c.amt), 0);
  const fare = Number(tr.total) || 0, farePaid = tripPaid(tr);
  const total = fare + extras, paid = Math.min(fare, farePaid) + extrasPaid;
  return { fare, farePaid, extras, extrasPaid, total, paid, left: Math.max(0, total - paid), credit: Number(tr.credit) || 0,
           unused: perksLeft(tr).length, costs };
}
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
// v0.45 (any cruise line): package presets are DATA, offered only for their own
// line; every other line starts on "Custom package". Line names are plain text
// for the traveller to pick - no logos, not affiliated with any cruise line.
const linePkgs = line => Object.keys(PACKAGES).filter(k => line && PACKAGES[k].line.toLowerCase() === String(line).trim().toLowerCase());
const CRUISE_LINE_LIST = [...new Set(Object.values(LINE_NAMES))].sort();
// What each line calls its card / wearable - common public names only.
const LINE_TIPS = {
  princess: ["Princess", "it's the Medallion, a small disc you wear. Set up delivery in online check-in, or pick it up at the port."],
  carnival: ["Carnival", "it's the Sail & Sign card — you get it at check-in or in your cabin."],
  "royal caribbean": ["Royal Caribbean", "it's the SeaPass card — keep it with you; many ships also let you use the app."],
  celebrity: ["Celebrity", "it's the SeaPass card — you get it at check-in or in your cabin."],
  disney: ["Disney", "it's the Key to the World card — waiting in your stateroom or at check-in."],
};
const lineTip = line => { const n = String(line || "").toLowerCase();
  const k = Object.keys(LINE_TIPS).find(x => n.includes(x)); return k ? { line: LINE_TIPS[k][0], text: LINE_TIPS[k][1] } : null; };
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
// Weather for one cruise place on one day (a port, or the departure port on sail
// day). v0.51 adds UV and wind for the cruise-area alerts. Forecasts reach 16 days.
const placeName = n => String(n || "").replace(/\s*\([^)]*\)/g, "").trim();   // "Fort Lauderdale (Port Everglades)" -> "Fort Lauderdale"
function ensurePlaceWx(name, day) {
  const k = `${name}|${day}`, d = daysUntil(day);
  if (!name || PORTWX[k] || d < 0 || d > 15) return;
  PORTWX[k] = { loading: true };
  (async () => {
    try {
      const place = await geocode(placeName(name));
      if (!place) { PORTWX[k] = { none: true }; return; }
      const q = `latitude=${place.lat}&longitude=${place.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max` +
                `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&start_date=${day}&end_date=${day}`;
      const j = await (await fetch(`${WX}?${q}`)).json(), D = j.daily, v = a => (a && a[0] != null ? a[0] : null);
      PORTWX[k] = { hi: v(D.temperature_2m_max), lo: v(D.temperature_2m_min), rain: v(D.precipitation_probability_max) ?? 0, code: v(D.weather_code),
                    uv: v(D.uv_index_max), wind: v(D.wind_speed_10m_max), gust: v(D.wind_gusts_10m_max), lat: place.lat, lon: place.lon };
    } catch (e) { PORTWX[k] = { none: true }; }
    render();
  })();
}
function ensurePortWx(tr) {
  (tr.ports || []).forEach(pt => ensurePlaceWx(pt.name, pt.day));
  if (tr.port && tr.start) ensurePlaceWx(tr.port, tr.start);
}

// ---------------------------------------------------- cruise-area weather
// v0.51 (Scott 10/4: "cruise app 2 weathers - actuals and one for cruise area,
// any alerts or info needed"). Weather where you are stays in the hero and the
// Weather card; this is the weather WHERE THE CRUISE IS: the departure port on
// sail day, then each port day (sea days have no place to forecast). Next 3
// cruise days that are today or later, inside the 16-day forecast.
function cruiseWxDays(tr) {
  if (!tr || !tr.start) return [];
  const out = [], end = tr.end || tr.start;
  for (let d = tr.start > today() ? tr.start : today(); d <= end && out.length < 3; d = addDays(d, 1)) {
    const pt = portOn(tr, d);
    if (pt) out.push({ day: d, name: pt.name, kind: "port", pt });
    else if (d === tr.start && tr.port) out.push({ day: d, name: tr.port, kind: "sail" });
  }
  return out;
}
// What the passenger should know or do, from one cruise-area forecast.
function cruiseWxAlerts(w, kind) {
  const out = [], add = (icon, text, key) => out.push({ icon, text, key });
  if (!w || w.loading || w.none) return out;
  if (w.code >= 95) add("⛈️", "Thunderstorms possible — times, tenders and excursions can change. Follow the ship's announcements", "storm");
  else if (w.rain >= 60) add("☔", `Rain likely (${w.rain}%) — light rain jacket, waterproof phone pouch, zip bags`, "rain");
  else if (w.rain >= 35) add("🌦️", `Showers possible (${w.rain}%) — pack a light layer`, "showers");
  if (w.uv != null && w.uv >= 8) add("🧴", `UV very high (${Math.round(w.uv)}) — reef-safe sunscreen, hat, sunglasses, water`, "uv");
  else if (w.uv != null && w.uv >= 6) add("🧴", `UV high (${Math.round(w.uv)}) — sunscreen and a hat`, "uv");
  if (w.hi != null && w.hi >= 90) add("🥵", `Hot — high ${Math.round(w.hi)}°. Drink water, find shade midday`, "heat");
  if ((w.gust != null && w.gust >= 30) || (w.wind != null && w.wind >= 22))
    add("💨", `Windy (gusts ${Math.round(w.gust ?? w.wind)} mph) — boat, snorkel and tender trips can be rough or cancelled`, "wind");
  if (w.lo != null && w.lo <= 55) add("🧥", `Cool — low ${Math.round(w.lo)}°. Bring a layer for the deck and evening`, "cool");
  if (kind === "sail" && w.rain >= 35) add("🧳", "Rain on boarding day — keep a jacket in your carry-on (checked bags come later)", "sailrain");
  return out;
}
// Atlantic hurricane season (Jun 1 - Nov 30) for Caribbean / Gulf / Atlantic places.
function hurricaneNote(tr) {
  if (!tr || !tr.start) return "";
  const m = Number(tr.start.slice(5, 7)), em = Number((tr.end || tr.start).slice(5, 7));
  if (!(m >= 6 && m <= 11) && !(em >= 6 && em <= 11)) return "";
  const w = Object.values(PORTWX).find(x => x && x.lat != null && x.lat >= 5 && x.lat <= 36 && x.lon >= -100 && x.lon <= -50);
  const words = /caribbean|bahama|nassau|cozumel|key west|miami|lauderdale|canaveral|galveston|tampa|orleans|san juan|grand turk|st\.? (thomas|maarten|kitts|lucia)|jamaica|cayman|roat|belize|costa maya|aruba|cura|barbados|antigua|cococay|amber cove|labadee|half moon/i;
  const named = words.test([tr.name, tr.port, tr.ship, ...(tr.ports || []).map(p => p.name)].join(" "));
  return w || named ? "🌀 Atlantic hurricane season (June–November): the cruise line can change ports or times. Watch for its emails, check its travel alerts, and think about travel insurance." : "";
}
const portWxText = pt => { const w = PORTWX[`${pt.name}|${pt.day}`];
  return w && !w.loading && !w.none ? `${wmo(w.code)[0]} ${Math.round(w.hi)}°/${Math.round(w.lo)}°${w.rain >= 20 ? ` · rain ${w.rain}%` : ""}` : ""; };
const upcomingTrips = () => myTrips().filter(tr => tr.end ? tr.end >= addDays(today(), -7) : true)
  .sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999"));
const curTrip = () => myTrips().find(t => t.id === S.tripSel) || upcomingTrips()[0] || null;
// Lists added in a later version reach trips planned before it (no data is lost).
function ensureLists(tr) {
  tr.lists = tr.lists || {};
  const T = TEMPLATES[tr.type] || TEMPLATES.trip;
  for (const k of Object.keys(TRIP_LISTS)) if (!tr.lists[k]) tr.lists[k] = (T[k] || []).map(text => ({ id: uid(), text, done: false }));
  tr.ports = tr.ports || [];
  return tr;
}
const tripListKeys = tr => Object.keys(TRIP_LISTS).filter(k => isCruise(tr) || !CRUISE_ONLY_LISTS.includes(k));

// ------------------------------------------------------ packing by bag
// v0.55 (V1 step 4, Scott's plan: "separates checked luggage / carry-on / port bag / final-night bag" +
// "weather-aware and excursion-aware packing"). Each packing item has a bag (guessed from its words
// until the traveler changes it), and "Suggested for your trip" offers items the trip's own forecast
// and excursions call for - each with the reason, one tap to add, never added by itself.
const BAGS = [["checked", "🧳 Checked"], ["carry", "🎒 Carry-on"], ["port", "🏖️ Port bag"]];
const bagLabel = k => (BAGS.find(b => b[0] === k) || BAGS[0])[1];
const bagGuess = text => /medic|passport|document|\bid\b|charger|cable|swimsuit|wallet|cash|\bglasses\b|keys|seasick|lanyard/i.test(text) ? "carry"
  : /sunscreen|water shoes|sunglasses|\bhat\b|pouch|day bag|water bottle|snorkel|beach|towel/i.test(text) ? "port" : "checked";
const bagOf = i => BAGS.some(b => b[0] === i.bag) ? i.bag : bagGuess(i.text || "");
function packSuggest(tr) {
  if (!tr) return [];
  const have = ((tr.lists || {}).packing || []).map(i => (i.text || "").toLowerCase()), no = tr.sugNo || [], out = [];
  const add = (key, text, why, bag) => { if (no.includes(key) || out.some(o => o.key === key) || have.some(h => h.includes(key))) return; out.push({ key, text, why, bag }); };
  const when = d => d === today() ? "today" : d === addDays(today(), 1) ? "tomorrow" : `${dayName(d)} ${prettyDate(d)}`;
  cruiseWxDays(tr).forEach(x => { const w = PORTWX[`${x.name}|${x.day}`]; if (!w || w.loading || w.none) return;
    const at = `${placeName(x.name)} ${when(x.day)}`;
    if (w.rain >= 35 || w.code >= 95) { add("rain jacket", "Light rain jacket", `rain ${w.rain}% at ${at}`, "port"); add("phone pouch", "Waterproof phone pouch", `rain at ${at}`, "port"); }
    if (w.uv != null && w.uv >= 8) { add("sunscreen", "Reef-safe sunscreen", `UV ${Math.round(w.uv)} at ${at}`, "port"); add("hat", "Sun hat", `UV ${Math.round(w.uv)} at ${at}`, "port"); }
    if (w.hi != null && w.hi >= 90) add("water bottle", "Refillable water bottle", `${Math.round(w.hi)}° at ${at}`, "port");
    if (w.lo != null && w.lo <= 55) add("warm layer", "Warm layer for the deck and evenings", `low ${Math.round(w.lo)}° at ${at}`, "checked"); });
  (tr.ports || []).forEach(pt => { const ex = `${pt.excursion || ""}`;
    if (/snorkel|beach|swim|kayak|boat|catamaran|paddle|dive/i.test(ex)) { add("water shoes", "Water shoes", `${ex} at ${pt.name}`, "port"); add("phone pouch", "Waterproof phone pouch", `${ex} at ${pt.name}`, "port"); }
    if (/hummer|jeep|atv|buggy|drive|driving|scooter|rental car|car rental|golf cart/i.test(ex)) add("driver", "Driver's license", `${ex} at ${pt.name} — drivers usually need it`, "carry");
    if (/hike|hiking|walk|walking|trail|climb|ruins/i.test(ex)) add("walking shoes", "Comfortable walking shoes", `${ex} at ${pt.name}`, "port");
    if (pt.indie) add("port agent", "Screenshot of the ship's port agent contact", `independent tour at ${pt.name}`, "carry"); });
  return out;
}

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

// ---------------------------------------------------------- return guard
// v0.52 (MVP #1, Scott's plan: "Return Guard calculates a conservative recommended
// return window and escalates reminders as all-aboard approaches"). RULES ONLY - no AI:
//   head back by = all aboard (in phone time) - safety margin - travel back to the ship.
// Margin 45 / 60 / 90 (default 60, the conservative side); travel back is per port
// (default 20 min, 45 for an independent tour). Estimates only - the ship's own
// announcements and all-aboard time always win.
const GUARD_MARGINS = [45, 60, 90];
const guardMargin = () => GUARD_MARGINS.includes(Number(S.guardMargin)) ? Number(S.guardMargin) : 60;
// v0.67: a TENDER port (small boats back to the ship, long lines late in the day) also defaults to 45.
const isTenderPort = pt => !!(typeof portGuide === "function" && portGuide(pt.name) && portGuide(pt.name).tender);
const guardBack = pt => Number(pt.backMin) > 0 ? Number(pt.backMin) : pt.indie || isTenderPort(pt) ? 45 : 20;
const aaLocal = pt => pt.allAboard ? addMinT(pt.allAboard, -(Number(pt.shipOffset) || 0)) : null;    // all aboard on the PHONE's clock
const guardBy = pt => addMinT(aaLocal(pt), -(guardMargin() + guardBack(pt)));
// Today's guard for a trip: null outside a port day with an all-aboard time, before
// arrival (or 6 AM), after you tapped "back on board", or an hour past all aboard.
function guardFor(tr, now = Date.now()) {
  const pt = tr && portOn(tr, today());
  if (!pt || !pt.allAboard || pt.boarded === pt.day) return null;
  const aa = atMs(pt.day, aaLocal(pt)), by = atMs(pt.day, guardBy(pt)), from = atMs(pt.day, pt.arrive || "06:00");
  if (now < from || now > aa + 60 * 60000) return null;
  const toBy = Math.round((by - now) / 60000), toAA = Math.round((aa - now) / 60000);
  const level = toAA < 0 ? "missed" : toBy < 0 ? "critical" : toBy < 30 ? "leave" : toBy < 90 ? "plan" : "good";
  return { pt, aa, by, toBy, toAA, level, margin: guardMargin(), back: guardBack(pt) };
}
const GUARD_LABEL = { good: "🟢 GOOD", plan: "🟡 PLAN YOUR RETURN", leave: "🟠 LEAVE NOW", critical: "🔴 TIME CRITICAL — GO TO THE SHIP", missed: "🔴 ALL ABOARD HAS PASSED" };
const minsText = n => { const a = Math.abs(n), h = Math.floor(a / 60), m = a % 60; return h ? `${h}h ${pad(m)}m` : `${m} min`; };
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
  const body = JSON.stringify({ app: APP_ID, v: VERSION, savedAt: new Date().toISOString(), data }, null, 1);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  a.download = `${MODE === "cruise" ? "cruise" : "day"}-hub-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast("Backup file saved ✓");
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result);
      let data = j && (j.app === APP_ID || j.app === SIB.id) ? j.data : null;
      if (!data || typeof data !== "object") { toast(`That file isn't a ${APP_NAME} backup`); return; }
      if (j.app !== APP_ID && MODE === "cruise") data = cruiseSlice(data);   // a Day Hub file: its cruises only
      restoreFrom({ savedAt: j.savedAt || new Date().toISOString(), data });
    } catch (e) { toast("Couldn't read that file"); }
  };
  r.readAsText(file);
}
function eraseAll() {
  if (Date.now() - ERASE_ARMED > 5000) { ERASE_ARMED = Date.now(); toast(`Tap Erase again to wipe this phone's ${APP_NAME}`); drawDataBox(true); return; }
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
  allTrips().forEach(tr => {
    if (tr.start && day >= tr.start && day <= (tr.end || tr.start)) {
      const n = Math.round((parseDay(day) - parseDay(tr.start)) / 86400000) + 1;
      const pt = portOn(tr, day);
      if (pt) {
        it.push({ t: null, title: `${pt.name} — port day`, sub: [pt.arrive && `in ${hm(pt.arrive)}`, pt.allAboard && `all aboard ${hm(pt.allAboard)}`].filter(Boolean).join(" · "), kind: "trip", icon: "⚓" });
        if (pt.allAboard) it.push({ t: aaLocal(pt), title: `ALL ABOARD — ${pt.name}`, sub: Number(pt.shipOffset) ? `${hm(pt.allAboard)} ship time · be on the ship` : "be on the ship", kind: "aboard", icon: "⚓" });
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
  if (allTrips().some(tr => tr.start === t || tr.start === addDays(t, 1))) add("id", "🛂 ID / passport + travel docs", "trip");
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
  allTrips().forEach(tr => { if (tr.finalDue && tr.finalDue >= from && tr.finalDue < to && tripLeft(tr)) out.push({ id: tr.id, name: `${tr.name} final payment`, amt: tripLeft(tr), day: tr.finalDue, icon: "🚢" }); });
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
  { const tr = curTrip(); if (tr) out.trip = tripContext(tr); }          // v0.53: the trip / cruise, for Ask Cruise Hub
  if (S.prefs && !S.prefs.skipped) out.travelStyle = { travelingWith: S.prefs.with || undefined, loves: S.prefs.loves, top3: S.prefs.top3 };   // v0.60
  let j = JSON.stringify(out);
  if (j.length > 14000) { out.notes = out.notes.slice(-5); out.schedule = out.schedule.filter(x => x.day <= d(7)); j = JSON.stringify(out); }
  return j.slice(0, 15000);
}
// v0.53 (V1 step 2, Ask Cruise Hub): the current trip as FACTS for the AI - dates, ports, all-aboard
// in phone time + the Return Guard head-back time, money, what's still open, perks left, cruise-area
// weather. The AI only explains these; it never invents times (Scott's plan: "facts come from data").
function tripContext(tr) {
  const R = readiness(tr), sd = tr.start ? daysUntil(tr.start) : null, hmOr = t => t ? hm(t) : null;
  const o = { name: tr.name, type: tr.type, line: tr.line || null, ship: tr.ship || null, departurePort: tr.port || null,
    start: tr.start || null, end: tr.end || null, daysToGo: sd, nights: tripNights(tr) || null, cabin: tr.cabin || null,
    travelers: tr.travelers || null, readyPercent: R.pct, stage: R.phase, nextStep: R.next ? R.next.action : null,
    stillToDo: R.items.filter(i => i.score < 1).map(i => `${i.label}${i.now ? " (matters now)" : " (later)"}`) };
  if (tr.total) o.money = { total: money(tr.total), paid: money(tripPaid(tr)), left: money(tripLeft(tr) || 0), finalPaymentDue: tr.finalDue || null };
  if (typeof tripItems === "function") { const L = tripItems(tr); if (L.length) o.itemizedCost = { lines: L.map(i => `${i.what.replace(/^\S+\s/, "")}: ${money(i.amt)} (${i.status})`), runningTotal: money(L[L.length - 1].run) }; }   // v0.62
  { const W = tripWallet(tr); if (W.extras) o.wholeTrip = { totalVacation: money(W.total), paid: money(W.paid), left: money(W.left),
      otherCosts: W.costs.map(c => `${costLabel(c.cat).replace(/^\S+\s/, "")}: ${c.what || ""} ${money(c.amt)} ${c.paid ? "(paid)" : "(not paid yet)"}`) };
    if (W.credit) o.onboardCredit = money(W.credit); }
  o.ports = (tr.ports || []).map(pt => ({ day: pt.day, port: pt.name, arrive: hmOr(pt.arrive),
    allAboardPhoneTime: pt.allAboard ? hm(aaLocal(pt)) : null, allAboardShipTime: pt.allAboard && Number(pt.shipOffset) ? hm(pt.allAboard) : undefined,
    headBackBy: pt.allAboard ? hm(guardBy(pt)) : null, excursion: pt.excursion || null, meet: hmOr(pt.meet), meetingPoint: pt.where || null,
    independentTour: !!pt.indie, cash: pt.cash || undefined, currency: pt.currency || undefined, weather: portWxText(pt) || undefined,
    officialPortInfo: (typeof portGuide === "function" && portGuide(pt.name)) ? portGuide(pt.name).facts.map(f => f.text) : undefined }));   // v0.65
  o.perksLeft = perksLeft(tr).map(x => `${x.name}: ${x.unit === "$" ? money(x.total - x.used) : x.total - x.used} left`);
  ensureLists(tr);
  o.notDoneYet = Object.fromEntries(Object.entries(tr.lists).map(([k, l]) => [k, (l || []).filter(i => !i.done).map(i => i.text).slice(0, 30)]).filter(([, v]) => v.length));
  o.cruiseAreaWeather = cruiseWxDays(tr).map(x => { const w = PORTWX[`${x.name}|${x.day}`];
    return w && !w.loading && !w.none ? { day: x.day, place: x.name, hi: Math.round(w.hi), lo: Math.round(w.lo), rainChance: w.rain, uv: w.uv, alerts: cruiseWxAlerts(w, x.kind).map(a => a.text) } : null; }).filter(Boolean);
  o.returnGuardSafetyMarginMin = guardMargin();
  { const G = typeof shipGuide === "function" && shipGuide(tr.ship);       // v0.64 verified ship guide -> "where can we eat for free?"
    if (G) o.shipGuide = { source: `princess.com, checked ${G.verified}`, venues: G.venues.map(v => `${v.name}${v.deck ? ` (deck ${v.deck})` : ""}${v.cost ? ` - ${v.cost}` : ""}${v.note ? ` - ${v.note}` : ""}`) }; }
  { const H = typeof homePort === "function" && tr.port && homePort(tr.port);   // v0.74 departure port -> "where do we park?"
    if (H) o.departurePortInfo = { port: H.name, checked: H.verified, facts: H.facts.map(f => f.text) }; }
  return o;
}
let ASK_BUSY = false, ASK_LOG = [];
function showAsk() {
  let el = document.getElementById("askSheet");
  if (!el) { el = document.createElement("div"); el.id = "askSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); document.body.appendChild(el); }
  const tr = MODE === "cruise" ? curTrip() : null, away = tr && tr.start && daysUntil(tr.start) <= 0;
  const ex = MODE !== "cruise" ? ["What's happening tomorrow?", "When is my next oil change?", "What haven't I finished this week?", "What bills are due before payday?"]
    : away ? ["When do we need to be back on the ship?", "What's the plan tomorrow?", "What should I bring ashore tomorrow?", "Which perks haven't we used?"]
    : ["What am I forgetting?", "How much do I still owe, and when?", "What's left to pack?", "What should I do this week for my cruise?"];
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>💡 Ask ${APP_NAME}</h2><button class="icon-btn" data-askclose="1" aria-label="Close">✕</button></div>
    ${aiOn() ? `<form class="ask-form" data-ask="1"><input name="q" placeholder="${MODE === "cruise" ? "Ask anything about your cruise…" : "Ask anything about your day…"}" autocomplete="off" required>
        <button type="button" class="btn sm ghost" data-askmic="1" aria-label="Talk">🎤</button><button class="btn sm">Ask</button></form>
      <div class="chips up-chips">${ex.map(q => `<button class="chip" data-askq="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <div id="askOut">${ASK_LOG.map(a => `<div class="ask-q">${esc(a.q)}</div><div class="ask-a">${esc(a.a)}</div>`).join("")}</div>`
    : `<p class="fine" style="margin-top:4px">${MODE === "cruise" ? `Ask in plain words — "When do we need to be back on the ship?" — and Cruise Hub answers from your own cruise.` : `Ask in plain words — "When's my next oil change?" — and Day Hub answers from your own planner.`}</p>
       <ol class="steps"><li>Tap ⚙ (top right).</li><li>Find <b>🤖 AI helper</b>, type your passphrase, tap <b>Turn on</b>.</li></ol>
       <button class="btn sm" data-askclose="1" data-open="sheet">Open ⚙</button>`}
  </div>`;
  el.classList.remove("hidden");
  setTimeout(() => { const i = el.querySelector("input[name=q]"); if (i) i.focus(); }, 60);
}
async function askDayHub(q) {
  q = String(q || "").trim(); if (!q || ASK_BUSY) return;
  ASK_BUSY = true; ASK_LOG.unshift({ q, a: "…thinking" }); showAsk();
  // Cruise Hub: the relay's "ask" job answers only from the JSON; the trip block holds the cruise facts.
  const lead = MODE === "cruise" ? "(Asked in Cruise Hub - answer about my cruise, using the \"trip\" section first.) " : "";
  try { ASK_LOG[0].a = String((await aiCall("ask", `QUESTION: ${lead}${q}\n\nMY PLANNER (JSON):\n${aiContext()}`)).text || "").trim() || `I couldn't find that in your ${MODE === "cruise" ? "cruise" : "planner"}.`; }
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
  // v0.50 (Scott 10/4 "build the countdown next"): Cruise Hub's hero is the big countdown (ui.js cruiseCountdown).
  const CD = MODE === "cruise" ? cruiseCountdown(curTrip()) : "";

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
  if (MODE === "cruise") { const cw = cruiseWxChip(); if (cw) chips.unshift(cw); }   // v0.51 cruise-area weather alert
  if (MODE === "cruise" && typeof carChip === "function") { const cc = carChip(curTrip()); if (cc) chips.push(cc); }   // v0.56
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
    if (CD) { /* the countdown already says it */ }
    else if (sd > 0 && sd <= 365) chips.push(`<span class="chip">${isCruise(nt) ? "🚢" : "✈️"} ${esc(nt.name)} in ${sd} day${sd === 1 ? "" : "s"}</span>`);
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
  const keep = MODE !== "cruise" ? chips : chips.filter(c => /forgetting|Final payment|🚢|✈️|[Rr]ain|New version|Install|⚓|data-cwx|data-gohome/.test(c));
  // v0.54 (Scott 10/4: "across the top of the apps to signify app you're on - DAY HUB, CRUISE HUB"):
  // every hub shows its own name + icon at the top.
  return `<div class="hero-top"><div class="brand"><img src="icon-192.png" alt="" width="24" height="24"><span>${esc(APP_NAME.toUpperCase())}</span>${navigator.onLine === false ? `<span class="offline-pill" title="No connection - your plans still work; weather may be old">🟠 Offline</span>` : ""}</div>
      <span class="hero-btns">${MODE !== "cruise" ? `<button class="icon-btn" data-ask="open" aria-label="Ask Day Hub">💡</button><button class="icon-btn" data-leave="1" aria-label="Don't forget">🚪</button><button class="icon-btn" data-dump="1" aria-label="Brain dump">🧠</button>` : `<button class="icon-btn help-icon" data-help="home" aria-label="Need help">🛟</button><button class="icon-btn" data-ask="open" aria-label="Ask Cruise Hub">💡</button>`}<button id="settingsBtn" class="icon-btn" aria-label="Settings">⚙</button></span></div>
    <div class="greet">${greet()}</div>
    <div class="hero-main"><div><div class="hero-clock" id="clockNow"></div><div class="hero-date">${longDate(today())}</div></div>${wx}</div>
    ${CD || `<div class="verdict-row">${MODE !== "cruise" && (S.name || hasData(S)) ? pulseRing() : ""}<div class="verdict">${verdict}</div></div>`}
    <div class="chips">${chipsShown(keep).join("")}</div>`;
}
// v0.39 (Scott 10/3 "do 1 2"): at most 3 chips up top, in the order above (= priority);
// the rest fold into "+N more", which opens them in place. Open for this visit only.
let CHIPS_ALL = false;
const CHIPS_MAX = 3;
const chipsShown = keep => keep.length <= CHIPS_MAX ? keep
  : CHIPS_ALL ? [...keep, `<button class="chip more" data-chipsmore="0">− Show less</button>`]
  : [...keep.slice(0, CHIPS_MAX), `<button class="chip more" data-chipsmore="1">+${keep.length - CHIPS_MAX} more</button>`];
function paintHero() {
  const hero = document.getElementById("hero");
  const h = new Date().getHours();
  const p = PHASES.find(x => h < x.to);
  hero.style.setProperty("--hero", p.g);
  if (typeof paintScene === "function") paintScene(hero);    // v0.49 the faint scene behind the clock (scenes.js)
  const w = WXDATA && WXDATA.here;
  hero.classList.toggle("gloomy", !!(w && w.cur.weather_code >= 45));
  document.getElementById("themeColor").setAttribute("content", p.c);
  hero.innerHTML = heroHtml();
  if (typeof afterHero === "function") afterHero(hero);
}

