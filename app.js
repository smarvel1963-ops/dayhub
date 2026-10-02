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
const VERSION = "0.14";
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
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
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
  bills: "free", work: "free", tomorrow: "free", packages: "free", inbox: "free", trips: "free", route: "free", loads: "free", jobs: "free", nextup: "free", games: "free",
  gcal: "pro", sync: "pro", reminders: "pro", budget: "pro", mail: "pro",   // candidates - Scott decides at launch
};
const can = f => !PRO_LIVE || FEATURES[f] !== "pro" || TIER === "pro";

// ---------------------------------------------------------------- packs
const BASE = MODE === "cruise" ? ["trips", "inbox", "schedule", "weather", "todos", "lists"] : ["inbox", "trips", "schedule", "tomorrow", "work", "budget", "weather", "todos", "packages", "bills", "countdowns", "lists"];
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
  remind: { on: false, lead: 15, billDays: 1, billHour: "09:00", morning: 420, fired: {} },
  packages: [],
  mail: { on: false, last: null, seen: {}, found: [] },
  trips: [], tripSel: null, tripTab: "money", tripList: "packing",
  money: { type: "hourly", salary: 0, spends: [] },
  work: { rate: 0, taxPct: 20, otAfter: 40, shifts: [], clockIn: null },
});
let S;                     // loaded at start-up, after the date helpers exist
let WXDATA = null;          // { here, from, to } weather payloads (not stored)
let VIEW = null;            // the day the schedule shows (YYYY-MM-DD)
let QA_TYPE = "event";
let UNDO = null, toastTimer = null;
let GTOKEN = null, GTOKEN_EXP = 0, gisLoading = null;

function load() {
  let s;
  try { s = Object.assign(blank(), JSON.parse(localStorage.getItem(STORE) || "{}")); }
  catch (e) { s = blank(); }
  // v0.2 bills stored paid = null; v0.3 reads paid as "paid THROUGH this month",
  // so null would show last month's bill as late. Treat old bills as current.
  const pm = prevMonthKey();
  s.bills.forEach(b => { if (!b.paid) b.paid = pm; });
  if (!s.gcal) s.gcal = { connected: false, events: [], fetched: null };
  s.work = Object.assign(blank().work, s.work || {});
  s.sync = Object.assign(blank().sync, s.sync || {});
  s.remind = Object.assign(blank().remind, s.remind || {});
  s.money = Object.assign(blank().money, s.money || {});
  if (!Array.isArray(s.packages)) s.packages = [];
  s.mail = Object.assign(blank().mail, s.mail || {});
  if (!Array.isArray(s.trips)) s.trips = [];
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
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,weather_code` +
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
    rain: D.precipitation_probability_max[i] ?? 0, code: D.weather_code[i] }));
  // The daily high/low come from a different model run than "now", so they can
  // read 92 while it is 93 out. Never show a high below (or a low above) now.
  days[0].hi = Math.max(days[0].hi, now); days[0].lo = Math.min(days[0].lo, now);
  return { label: place.label, cur: j.current, hourly, days,
    day: { hi: days[0].hi, lo: days[0].lo, rain: days[0].rain, code: days[0].code,
           sunrise: D.sunrise[0], sunset: D.sunset[0], rainFrom } };
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
    client_id: GCAL_CLIENT_ID, scope: GCAL_SCOPE, prompt: S.gcal.connected ? "" : "consent",
    callback: async r => {
      if (r.error) { toast("Google sign-in was cancelled"); return; }
      GTOKEN = r.access_token; GTOKEN_EXP = Date.now() + ((r.expires_in || 3600) - 60) * 1000;
      S.gcal.connected = true; save();
      await gcalFetch();
    },
  });
  client.requestAccessToken();
}

async function gcalFetch() {
  if (!gReady()) { render(); return; }
  const from = parseDay(today()); from.setDate(from.getDate() - 1);
  const to = new Date(from); to.setDate(to.getDate() + 16);
  const u = "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime" +
            `&maxResults=250&timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}`;
  try {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${GTOKEN}` } });
    if (r.status === 401) { GTOKEN = null; render(); return; }
    const j = await r.json();
    S.gcal.events = (j.items || []).filter(e => e.status !== "cancelled").map(e => {
      const allDay = !e.start.dateTime;
      const s = allDay ? parseDay(e.start.date) : new Date(e.start.dateTime);
      return { id: e.id, title: e.summary || "(busy)", day: ymd(s), time: allDay ? null : hhmm(s),
               end: e.end && e.end.dateTime ? hhmm(new Date(e.end.dateTime)) : null, where: e.location || "" };
    });
    S.gcal.fetched = new Date().toISOString(); save(); render();
    toast("Google Calendar synced ✓");
  } catch (e) { toast("Google Calendar didn't answer — try again"); }
}

function gcalDisconnect() {
  try { if (GTOKEN && window.google) google.accounts.oauth2.revoke(GTOKEN, () => {}); } catch (e) { /* already gone */ }
  GTOKEN = null; S.gcal = { connected: false, events: [], fetched: null }; save(); drawSettings(); render();
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
  (d.packages || []).length + (d.trips || []).length + (d.lists || []).reduce((n, l) => n + (l.items || []).length, 0)) > 0;

function driveSignIn(prompt) {                                 // must run from a tap
  return loadGis().then(() => new Promise(res => {
    const c = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID, scope: DRIVE_SCOPE, prompt,
      callback: r => {
        if (r.error) { toast("Google sign-in was cancelled"); res(false); return; }
        DTOKEN = r.access_token; DTOKEN_EXP = Date.now() + ((r.expires_in || 3600) - 60) * 1000; res(true);
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
  const keepCal = S.gcal;
  S = Object.assign(blank(), cloud.data);
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
    : `<button class="btn sm" data-sync="on">Back up to my Google Drive</button>
       <p class="fine" style="margin-top:8px">Keeps everything safe and brings it back on a new phone. Saved in a hidden Day Hub folder in your own Drive — only Day Hub can see it.</p>`);
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
    const rr = { daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY" }[e.rep];
    ev = [`SUMMARY:${txt(e.title)}`, e.where ? `LOCATION:${txt(e.where)}` : "", `DTSTART:${D(e.day, e.time)}`,
          `DTEND:${D(ed, et)}${rr ? `\nRRULE:${rr}` : ""}`, `TRIGGER:-PT${lead}M`, e.title]; } }
  else if (k === "loads" || k === "jobs") { const x = S[k].find(y => y.id === id); if (x) { const [ed, et] = plusMin(x.day, x.time, 60);
    ev = [`SUMMARY:${txt(x.title)}`, "", `DTSTART:${D(x.day, x.time)}`, `DTEND:${D(ed, et)}`, `TRIGGER:-PT${lead}M`, x.title]; } }
  else if (k === "shift") { const x = S.work.shifts.find(y => y.id === id); if (x) { const ed = x.end < x.start ? addDays(x.day, 1) : x.day;
    ev = ["SUMMARY:Work shift", "", `DTSTART:${D(x.day, x.start)}`, `DTEND:${D(ed, x.end)}`, `TRIGGER:-PT${lead}M`, "Work shift"]; } }
  else if (k === "bill") { const b = S.bills.find(y => y.id === id); const due = b && nextDue(b); if (due) {
    const nx = addDays(due, 1).replace(/-/g, "");
    ev = [`SUMMARY:${txt(b.name)} due ${money(b.amount)}`, "", `DTSTART;VALUE=DATE:${due.replace(/-/g, "")}`,
          `DTEND;VALUE=DATE:${nx}\nRRULE:FREQ=MONTHLY;BYMONTHDAY=${b.day >= 29 ? -1 : b.day}`, "TRIGGER:-PT15H", `${b.name} bill`]; } }
  if (!ev) return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Day Hub//EN", "BEGIN:VEVENT", `UID:${ref.replace(":", "-")}@dayhub`, `DTSTAMP:${stamp}`,
    ev[0], ev[1], ev[2], ev[3], "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${txt(ev[0].slice(8))}`, ev[4], "END:VALARM", "END:VEVENT", "END:VCALENDAR"]
    .filter(Boolean).join("\r\n").replace(/\n(?!$)/g, "\r\n").replace(/\r\r/g, "\r");
  return { text: lines, name: ev[5] };
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
    case "monthly": return d.getDate() === s0.getDate();
    case "yearly": return d.getMonth() === s0.getMonth() && d.getDate() === s0.getDate();
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
const dtOf = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : { day: ymd(d), time: /T\d/.test(String(v)) ? hhmm(d) : null }; };

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

function mailSignIn(prompt) {                                 // must run from a tap
  return loadGis().then(() => new Promise(res => {
    google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID, scope: GMAIL_SCOPE, prompt,
      callback: r => { if (r.error) { toast("Google sign-in was cancelled"); res(false); return; }
        MTOKEN = r.access_token; MTOKEN_EXP = Date.now() + ((r.expires_in || 3600) - 60) * 1000; res(true); },
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
    const ids = (list.messages || []).map(m => m.id).filter(id => !S.mail.seen[id]);
    let added = 0;
    for (let i = 0; i < ids.length; i += 5) {
      const batch = await Promise.all(ids.slice(i, i + 5).map(id => gmail(`messages/${id}?format=full`).catch(() => null)));
      for (const m of batch.filter(Boolean)) {
        const h = Object.fromEntries((m.payload.headers || []).map(x => [x.name.toLowerCase(), x.value]));
        const b = bodies(m.payload);
        for (const sug of extractFromMessage({ id: m.id, subject: h.subject, from: h.from, html: b.html, text: b.text || htmlToText(b.html) })) {
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
    `<p class="fine" style="margin-top:8px">Day Hub reads your last 2 weeks of email on this phone to find appointments, flights, hotel and dinner reservations and package tracking. Nothing is sent anywhere, and nothing is added until you tap Add.</p>`;
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
const TRIP_LISTS = { packing: "Packing", docs: "Documents", before: "Before you go", embark: "Sail day", home: "Getting home", after: "After the trip" };
const CRUISE_ONLY_LISTS = ["home", "after"];
const TEMPLATES = {
  cruise: {
    packing: ["Swimsuits + cover-up", "Formal-night outfit", "Comfortable walking shoes", "Sandals / flip-flops",
      "Light jacket or sweater (ships are cold inside)", "Sunscreen (reef-safe for some ports)", "Sunglasses + hat",
      "Seasickness remedy - bands, patch or pills", "Daily medications (keep in your carry-on)", "Phone charger + cables",
      "Magnetic hooks (cabin walls are metal)", "Lanyard for your cruise card", "Small day bag for port days", "Reusable water bottle"],
    docs: ["Passport valid 6+ months after you return (or birth certificate + photo ID on closed-loop US cruises)", "Cruise boarding pass / app check-in done",
      "Luggage tags printed and attached", "Credit card for the onboard account", "Some cash for tips and ports",
      "Travel insurance details", "Excursion confirmations", "Flight + hotel confirmations", "Emergency contacts on paper"],
    before: ["Pay the final payment (Day Hub reminds you)", "Check in online as soon as it opens + pick an arrival time",
      "Book excursions you really want (popular ones sell out)", "Decide on drink / Wi-Fi packages - often cheaper before you sail",
      "Book the flight to arrive THE DAY BEFORE sailing", "Tell your bank you'll be travelling", "Print luggage tags",
      "Plan phone use at sea (airplane mode or a cruise plan)"],
    home: ["Check your final ship account the last night", "Put out luggage tags / bags the night before (or carry off)",
      "Keep documents, meds and a change of clothes in your carry-on", "Breakfast before your exit time", "Cabin empty by the vacate time",
      "Customs: declare what you bought", "Ride / parking / flight home confirmed"],
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
];
const isCruise = tr => tr.type === "cruise";
const tripNights = tr => tr.start && tr.end ? Math.max(0, Math.round((parseDay(tr.end) - parseDay(tr.start)) / 86400000)) : 0;
const tripPaid = tr => (tr.payments || []).reduce((n, x) => n + Number(x.amt || 0), 0);
const tripLeft = tr => tr.total ? Math.max(0, tr.total - tripPaid(tr)) : null;
const tripSpent = tr => (tr.spends || []).reduce((n, x) => n + Number(x.amt || 0), 0);
const gratEstimate = tr => isCruise(tr) ? (Number(tr.travelers) || 1) * tripNights(tr) * GRAT_PER_DAY : 0;
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
    if (pt.allAboard) L.push(`<div class="today-line big-aboard">🚢 ALL ABOARD <b>${hm(pt.allAboard)}</b>${shipNote(pt)}</div>`);
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
  if (w && w.day.rainFrom) chips.push(`<span class="chip warn">☔ Rain from ${fmtTime(w.day.rainFrom)}</span>`);
  else if (w && w.day.rain < 20) chips.push(`<span class="chip good">☀ No rain today</span>`);
  const nx = nextPlan();
  if (nx) chips.push(`<span class="chip">⏭ ${esc(nx.when)} · ${esc(nx.title)}</span>`);
  const oc = onClock();
  if (budget().status === "over") chips.push(`<span class="chip warn">⚠ Spending is running over budget</span>`);
  if (oc !== null) chips.push(`<span class="chip good">⏱ On the clock ${fmtH(oc)}</span>`);
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
  if (S.gcal.connected && !gReady()) chips.push(`<button class="chip" data-gsync="1">🔄 Sync Google Calendar</button>`);
  if (UPDATE) chips.unshift(`<button class="chip good" data-update="1">✨ New version ready — tap to update</button>`);
  if (INSTALL_EVT && !standalone()) chips.push(`<button class="chip" data-install="1">📲 Install ${APP_NAME}</button>`);
  if (S.sync.on && S.sync.dirty && !dReady()) chips.push(`<button class="chip" data-sync="now">☁️ Back up changes</button>`);

  const wx = w ? (() => { const [ic] = wxIcon(w.cur.weather_code, w.cur.is_day);
      return `<div class="hero-wx"><div class="ic">${ic}</div><div class="t">${Math.round(w.cur.temperature_2m)}°</div>
              <div class="hl">H ${Math.round(w.day.hi)}° · L ${Math.round(w.day.lo)}°</div></div>`; })()
    : S.city && !WXDATA ? `<div class="hero-wx"><div class="skel" style="width:84px;height:74px"></div></div>` : "";
  // Cruise Hub's top line is about the cruise only (Day Hub's chips stay in Day Hub).
  const keep = MODE !== "cruise" ? chips : chips.filter(c => /forgetting|Final payment|🚢|✈️|[Rr]ain|New version|Install|⚓/.test(c));
  return `<div class="hero-top"><div class="greet">${greet()}</div>
      <button id="settingsBtn" class="icon-btn" aria-label="Settings">⚙</button></div>
    <div class="hero-main"><div><div class="hero-clock" id="clockNow"></div><div class="hero-date">${longDate(today())}</div></div>${wx}</div>
    <div class="verdict">${verdict}</div>
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
      }
      const first = plans.find(i => i.t);
      if (first) {
        const alarm = new Date(atMs(T1, first.t) - 60 * 60000);
        L.push(`<div class="today-line">⏰ First up <b>${hm(first.t)}</b> — ${esc(first.title)}<br><span class="sub">Alarm idea: ${alarm.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (an hour before)</span></div>`);
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
      return `<div class="hours">${hours}</div>
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
      if (!f.length) return top + `<div class="empty">${S.mail.on ? "Nothing waiting. New appointments, flights and deliveries show up here." : "Connect Gmail in ⚙ and Day Hub will find appointments, flights, reservations and packages in your email."}</div>`;
      return top + f.map(x => `<div class="row"><div class="grow">${x.type === "package" ? "📦" : "📅"} ${esc(x.title)}
          <span class="sub">${x.type === "package" ? `${(CARRIERS[x.carrier] || CARRIERS.other)[0]} · …${esc(x.num.slice(-6))}${x.day ? ` · arrives ${prettyDate(x.day)}` : ""}`
            : `${dayName(x.day)} ${prettyDate(x.day)}${x.time ? ` · ${hm(x.time)}` : " · time not found"}`} · from "${esc(x.src)}"</span></div>
        <button class="btn sm" data-addfound="${esc(x.key)}">Add</button><button class="x" data-dropfound="${esc(x.key)}" aria-label="Dismiss">✕</button></div>`).join("");
    } },

  trips: { icon: "🚢", title: "Trips",
    meta: () => { const tr = curTrip(); return tr ? `${readiness(tr).pct}% ready` : ""; },
    body: () => {
      const tr = curTrip();
      if (!tr) return `<div class="empty">Got a cruise or trip coming? Day Hub counts down, reminds you about the final payment, tracks onboard spending and hands you ready-made packing and document lists.</div>
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
      const tabs = ["ready", "money"].concat(isCruise(tr) ? ["ports"] : [], ["onboard", "lists"], isCruise(tr) ? ["tips"] : []);
      const TL = { ready: "✅ Ready", money: "💳 Payments", ports: "🗺️ Ports", onboard: isCruise(tr) ? "🍹 Onboard" : "💵 Spending", lists: "📋 Lists", tips: "💡 Good to know" };
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
        body = days.length ? days.map(d => { const pt = portOn(tr, d);
          const label = pt ? `⚓ <b>${esc(pt.name)}</b>` : d === tr.start ? `🚢 <b>Sail day</b> — ${esc(tr.port || "")}` : d === tr.end ? `🏠 <b>Back in port</b> — getting home` : "🌊 At sea";
          const sub = pt ? [pt.arrive && `in ${hm(pt.arrive)}`, pt.allAboard && `<b style="color:var(--orange)">all aboard ${hm(pt.allAboard)}${Number(pt.shipOffset) ? " ship time" : ""}</b>`,
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
        if (gr) body += `<div class="today-line" style="margin-top:8px">🧾 Automatic gratuities: about <b>${money(gr)}</b> (${Number(tr.travelers) || 1} × ${nights} nights × ~$${GRAT_PER_DAY}) — they hit your account even if you never log them.</div>`;
        const mx = Math.max(1, ...Object.values(cats));
        body += Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="catrow"><span>${esc(c)}</span>
            <span class="bar"><span style="left:0;width:${v / mx * 100}%"></span></span><b>${money(v)}</b></div>`).join("");
        body += (tr.spends || []).slice().sort((a, b) => b.day.localeCompare(a.day)).slice(0, 6).map(x => `<div class="row"><span class="time">${prettyDate(x.day)}</span>
            <span class="grow">${esc(x.cat)}${x.note ? `<span class="sub">${esc(x.note)}</span>` : ""}</span><b>${money(x.amt)}</b>
            <button class="x" data-tripdel="${tr.id}:spends:${x.id}" aria-label="Remove">✕</button></div>`).join("");
        body += `<button class="add-link" data-tripqa="tspend">＋ Log ${isCruise(tr) ? "onboard " : ""}spending</button>`;
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
    meta: () => { const n = S.packages.filter(p => !p.delivered).length; return n ? `${n} on the way` : ""; },
    body: () => {
      const recent = addDays(today(), -3);
      const list = S.packages.filter(p => !p.delivered || (p.deliveredDay || "") >= recent)
        .sort((a, b) => (a.delivered - b.delivered) || (a.eta || "9999").localeCompare(b.eta || "9999"));
      if (!list.length) return `<div class="empty">Add a tracking number — Day Hub knows UPS, USPS, FedEx, Amazon and DHL and puts the arrival day on your schedule.</div>`;
      return list.map(p => { const n = p.eta ? daysUntil(p.eta) : null;
        return `<div class="row ${p.delivered ? "done" : ""}"><div class="grow">${esc(p.name)}<span class="sub">${(CARRIERS[p.carrier] || CARRIERS.other)[0]} · …${esc(cleanNum(p.num).slice(-6))}${p.delivered ? " · delivered" : p.eta ? ` · arrives ${prettyDate(p.eta)}` : " · no date yet"}</span></div>
          ${!p.delivered && n !== null && n <= 1 ? `<span class="pill ${n <= 0 ? "soon" : ""}">${n < 0 ? "late?" : inDays(n)}</span>` : ""}
          <a class="btn sm ghost" href="${trackUrl(p)}" target="_blank" rel="noopener">Track</a>
          ${p.delivered ? "" : `<button class="btn sm ghost" data-pkgdone="${p.id}" aria-label="Delivered">✓</button>`}
          <button class="x" data-del="packages:${p.id}" aria-label="Remove">✕</button></div>`; }).join("") +
        `<div class="fine" style="margin-top:6px">Track opens the carrier's page. Live status updates are planned for Day Hub Pro.</div>`;
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
  paintHero();
  const hr = new Date().getHours();
  let order = cardOrder().filter(k => !S.hidden.includes(k) && !(k === "tomorrow" && hr < 15) && !(k === "inbox" && !S.mail.on && !S.mail.found.length));
  if (hr >= 17 && order.includes("tomorrow")) order = ["tomorrow", ...order.filter(k => k !== "tomorrow")];
  if (S.mail.found.length && order.includes("inbox")) order = ["inbox", ...order.filter(k => k !== "inbox")];   // waiting on you = on top
  const cards = order.map(k => {
    const c = CARDS[k]; const col = S.collapsed.includes(k);
    const tag = PACKS[S.pack].cards.includes(k) ? ` <span class="tag">${PACKS[S.pack].label}</span>` : "";
    if (!can(k)) return `<section class="card" data-card="${k}"><h3><span class="ci">${c.icon}</span>${c.title} <span class="tag">PRO</span></h3>
      <div class="body"><div class="empty">Part of Day Hub Pro. No ads, ever — Pro just does more.</div></div></section>`;
    return `<section class="card ${col ? "collapsed" : ""}" data-card="${k}">
      <h3 data-collapse="${k}"><span class="ci">${c.icon}</span>${c.title}${tag}<span class="meta">${c.meta ? c.meta() : ""}</span><span class="chev">⌄</span></h3>
      <div class="body">${c.body()}${c.add ? `<button class="add-link" data-qa="${c.add[0]}">＋ ${c.add[1]}</button>` : ""}</div></section>`;
  }).join("");
  document.getElementById("cards").innerHTML = whatsNewHtml() + (!S.city && !S.name ? welcomeHtml() : "") + cards;
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
function qaTypes() {
  const t = [["event", "📅 Event"], ["shift", "💼 Work shift"], ["todo", "✅ To-do"], ["spend", "💵 Spending"], ["item", "🛒 List item"], ["bill", "💳 Bill"], ["package", "📦 Package"], ["trip", "🚢 Trip"], ["countdown", "⏳ Countdown"], ["list", "📝 New list"]];
  if (S.pack === "trucker") t.splice(1, 0, ["loads", "🚚 Load"]);
  if (S.pack === "trades") t.splice(1, 0, ["jobs", "🔧 Job"]);
  return t;
}
function qaFields(type) {
  const d = VIEW || today();
  const F = {
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
    tspend: `<div class="two"><input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount $" required>
      <select name="cat">${ONBOARD_CATS.map(c => `<option>${c}</option>`).join("")}</select></div>
      <div class="two"><input name="date" type="date" value="${today()}" required><input name="note" placeholder="What (optional)" autocomplete="off"></div>`,
    package: `<input name="name" placeholder="What is it (e.g. New boots)" required autocomplete="off">
      <input name="num" placeholder="Tracking number" required autocomplete="off" autocapitalize="characters">
      <div class="two"><select name="carrier"><option value="auto">Carrier: figure it out</option>${Object.entries(CARRIERS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select>
      <input name="eta" type="date" min="${today()}" title="Expected delivery (optional)"></div>
      <div class="hint">Expected date is optional — add it and the delivery shows on your schedule.</div>`,
    countdown: `<input name="title" placeholder="What are you counting down to?" required autocomplete="off">
      <input name="date" type="date" min="${today()}" required>`,
    list: `<input name="name" placeholder="List name (e.g. Hardware store)" required autocomplete="off">`,
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
  return (F[type] || F.todo) + `<button class="btn">${type === "forget" ? "Got it" : type === "pay" || (type === "trip" && TRIP_EDIT) ? "Save" : "Add"}</button>`;
}
let TRIP_EDIT = null, PORT_EDIT = null, PORT_DAY = null;
function openQA(type, keepEdit) {
  if (!keepEdit) TRIP_EDIT = null;
  QA_TYPE = type || QA_TYPE;
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
  if (ty === "event") { S.events.push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), where: (d.where || "").trim(), rep: d.rep || "none" }); VIEW = d.date; }
  else if (ty === "shift") { S.work.shifts.push({ id: uid(), day: d.date, start: d.start, end: d.end, brk: Number(d.brk || 0) }); VIEW = d.date; }
  else if (ty === "pay") { S.work.rate = Number(d.rate || 0); S.work.taxPct = Number(d.tax); S.work.otAfter = Number(d.ot);
    S.money.type = d.itype || "hourly"; S.money.salary = Number(d.salary || 0);
    S.work.period = d.period || "weekly"; S.work.periodStart = d.pstart || null;
    save(); closeQA(); render(); toast("Pay saved ✓"); return; }
  else if (ty === "spend") S.money.spends.push({ id: uid(), day: d.date, amt: Number(d.amt), what: (d.what || "").trim() });
  else if (ty === "todo") S.todos.push({ id: uid(), title: d.title.trim(), done: false, rep: d.rep || "none", day: today() });
  else if (ty === "loads" || ty === "jobs") { S[ty].push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), done: false }); VIEW = d.date; }
  else if (ty === "bill") {
    const day = Math.min(31, Math.max(1, Number(d.day))), now = new Date();
    // Added after this month's due day = treat this month as handled; before it = due this month.
    const paid = day < now.getDate() ? today().slice(0, 7) : prevMonthKey();
    S.bills.push({ id: uid(), name: d.title.trim(), amount: Number(d.amount), day, paid });
  }
  else if (ty === "countdown") S.countdowns.push({ id: uid(), title: d.title.trim(), date: d.date });
  else if (ty === "trip") {
    const fields = { type: d.ttype, name: d.tname.trim(), start: d.start || null, end: d.end || null, line: (d.line || "").trim(),
      ship: (d.ship || "").trim(), port: (d.port || "").trim(), travelers: Number(d.travelers || 0) || null,
      total: Number(d.total || 0) || null, finalDue: d.finalDue || null, onboardBudget: Number(d.onboardBudget || 0) || null,
      credit: Number(d.credit || 0) || null, booking: (d.booking || "").trim(), cabin: (d.cabin || "").trim(),
      insurance: d.insurance || "undecided", travel: (d.travel || "").trim() };
    const old = S.trips.find(x => x.id === TRIP_EDIT);
    if (old) Object.assign(old, fields);
    else { const id = uid(); S.trips.push(ensureLists({ id, ...fields, payments: [], spends: [], ports: [], lists: newLists(fields.type) })); S.tripSel = id; S.tripTab = "ready"; }
    TRIP_EDIT = null;
  }
  else if (ty === "forget") { closeQA(); return; }
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
  save(); closeQA(); render(); buzz(); toast("Added ✓");
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
  if (f.dataset.route) { S.route = { from: data.from.trim(), to: data.to.trim() }; save(); loadWeather(); return; }
  if (f.dataset.tadd) { const [tid, k] = f.dataset.tadd.split(":"); const tr = S.trips.find(x => x.id === tid);
    if (tr) tr.lists[k].push({ id: uid(), text: data.text.trim(), done: false });
    save(); render(); const again = document.querySelector(`form[data-tadd="${f.dataset.tadd}"] input`); if (again) again.focus(); return; }
  if (f.dataset.additem) {
    const L = S.lists.find(l => l.id === f.dataset.additem);
    if (L) L.items.push({ id: uid(), text: data.text.trim(), done: false });
    save(); render(); buzz();
    const again = document.querySelector(`form[data-additem="${f.dataset.additem}"] input`); if (again) again.focus();
  }
});

document.addEventListener("click", e => {
  if (e.target.classList && e.target.classList.contains("sheet")) {         // tap on the dim backdrop
    if (e.target.id === "sheet") closeSettings(); else closeQA(); return;
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
    if (en - st >= 60000) S.work.shifts.push({ id: uid(), day: ymd(st), start: hhmm(st), end: hhmm(en), brk: 0 });
    S.work.clockIn = null; save(); render(); buzz(); toast(`Clocked out · ${fmtH((en - st) / 3600000)}`, true); return; }
  if (ds.addfound) { addFound(ds.addfound); return; }
  if (ds.dropfound) { snap(); S.mail.found = S.mail.found.filter(x => x.key !== ds.dropfound); save(); render(); toast("Dismissed", true); return; }
  if (ds.mail === "scan") { scanMail(); return; }
  if (ds.mail === "off") { try { if (MTOKEN && window.google) google.accounts.oauth2.revoke(MTOKEN, () => {}); } catch (e) { /* gone */ }
    MTOKEN = null; S.mail = { on: false, last: null, seen: {}, found: [] }; save(); drawMailBox(); render(); toast("Gmail disconnected"); return; }
  if (ds.tripremove) { snap(); S.trips = S.trips.filter(x => x.id !== ds.tripremove); S.tripSel = null; TRIP_EDIT = null; closeQA(); save(); render(); toast("Trip deleted", true); return; }
  if (ds.forget) { openQA("forget"); return; }
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
  if (ds.move) { moveCard(ds.move, Number(ds.dir)); return; }
  if (ds.gconnect) { gcalConnect(); return; }
  if (ds.gsync) { gReady() ? gcalFetch() : gcalConnect(); return; }
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

document.addEventListener("change", e => {
  const t = e.target, ds = t.dataset;
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
  let g = document.getElementById("gcalBox");
  if (!g) { g = document.createElement("div"); g.id = "gcalBox"; document.getElementById("cardList").before(g); }
  g.innerHTML = `<h3>Your calendar</h3>` + (S.gcal.connected
    ? `<div class="leg"><span>🗓️ Google Calendar connected${S.gcal.fetched ? ` · synced ${fmtTime(S.gcal.fetched)}` : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-gsync="1">Sync now</button><button class="btn sm ghost" data-gdisc="1">Disconnect</button></div>`
    : `<button class="btn sm" data-gconnect="1">Connect Google Calendar</button>
       <p class="fine" style="margin-top:8px">Read-only: Day Hub shows your events on the schedule and never changes them.</p>`) +
    `<h3>Cards — ▲▼ to move, switch to show or hide</h3>`;
  document.querySelector("#sheet .sheet-body > h3").style.display = "none";
  document.getElementById("ver").textContent = `Version ${VERSION}.`;
}
function drawCardList() {
  document.getElementById("cardList").innerHTML = cardOrder().map(k => `<li><span>${CARDS[k].icon} ${CARDS[k].title}</span>
    <button class="x" data-move="${k}" data-dir="-1" aria-label="Move up">▲</button>
    <button class="x" data-move="${k}" data-dir="1" aria-label="Move down">▼</button>
    <input type="checkbox" data-show="${k}" ${S.hidden.includes(k) ? "" : "checked"} aria-label="Show ${CARDS[k].title}"></li>`).join("");
}
function moveCard(k, dir) {
  const o = cardOrder(); const i = o.indexOf(k), j = i + dir;
  if (j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]]; S.order = o; save(); drawCardList(); render();
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
render();
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) { VIEW = today(); render(); checkReminders(); checkUpdate(); } });
if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("sw.js", BASE_URL)).catch(() => {});
