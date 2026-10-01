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
const VERSION = "0.4";

const STORE = "dayhub.v1";
const WX = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

// Google Calendar. Empty = the Connect button explains it is not set up yet.
// The OAuth client is created once by the app owner in Google Cloud Console
// (type "Web application", origin https://smarvel1963-ops.github.io).
const GCAL_CLIENT_ID = "750311262064-354vjd8mkh07cpg1576p07qj2ifmb0d2.apps.googleusercontent.com";
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";   // a hidden Day Hub folder in the user's own Drive

// ------------------------------------------------------------ free / pro
// Scott 2026-10-01: "no ads, just better everything when go pro". NO ADS, EVER.
// Every feature carries a switch now so pricing is a settings change later,
// never a redesign. PRO_LIVE = false keeps everything unlocked while we build;
// at launch it goes true and TIER comes from the payment check.
const PRO_LIVE = false;
let TIER = "free";
const FEATURES = {
  schedule: "free", weather: "free", todos: "free", lists: "free", countdowns: "free",
  bills: "free", work: "free", route: "free", loads: "free", jobs: "free", nextup: "free", games: "free",
  gcal: "pro", sync: "pro",            // candidates - Scott decides at launch
};
const can = f => !PRO_LIVE || FEATURES[f] !== "pro" || TIER === "pro";

// ---------------------------------------------------------------- packs
const BASE = ["schedule", "work", "weather", "todos", "bills", "countdowns", "lists"];
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
const money = n => `$${Number(n || 0).toFixed(2)}`;
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* no haptics */ } };

function cardOrder() {
  const want = [...BASE, ...PACKS[S.pack].cards];
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
  (d.countdowns || []).length + ((d.work || {}).shifts || []).length +
  (d.lists || []).reduce((n, l) => n + (l.items || []).length, 0)) > 0;

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
  S.events.filter(e => e.day === day).forEach(e => it.push({ t: e.time, title: e.title, sub: e.where, kind: "event", icon: "📅", del: `events:${e.id}` }));
  if (S.gcal.connected) S.gcal.events.filter(e => e.day === day).forEach(e =>
    it.push({ t: e.time, end: e.end, title: e.title, sub: e.where, kind: "g", icon: "🗓️" }));
  ["loads", "jobs"].forEach(k => { if (!PACKS[S.pack].cards.includes(k)) return;
    S[k].filter(x => x.day === day).forEach(x => it.push({ t: x.time, title: x.title, kind: k, icon: k === "loads" ? "🚚" : "🔧",
      tick: `${k}:${x.id}`, done: x.done, del: `${k}:${x.id}` })); });
  S.work.shifts.filter(x => x.day === day).forEach(x => it.push({ t: x.start, end: x.end, title: "Work shift", sub: fmtH(shiftHours(x)), kind: "work", icon: "💼" }));
  upcomingBills().filter(b => b.due === day).forEach(b => it.push({ t: null, title: `${b.name} due`, sub: money(b.amount), kind: "bill", icon: "💳" }));
  S.countdowns.filter(c => c.date === day).forEach(c => it.push({ t: null, title: c.title, sub: "The day is here", kind: "cd", icon: "🎉" }));
  const w = WXDATA && WXDATA.here;
  if (w && day === today()) {
    it.push({ t: w.day.sunrise.slice(11, 16), title: "Sunrise", kind: "sun", icon: "🌅" });
    it.push({ t: w.day.sunset.slice(11, 16), title: "Sunset", kind: "sun", icon: "🌇" });
    if (w.day.rainFrom) it.push({ t: w.day.rainFrom.slice(11, 16), title: "Rain likely starts", kind: "rain", icon: "☔" });
  }
  return it.sort((a, b) => (a.t ? 1 : 0) - (b.t ? 1 : 0) || String(a.t).localeCompare(String(b.t)));
}
const isPlan = i => ["event", "g", "loads", "jobs", "work"].includes(i.kind);

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
  const open = S.todos.filter(t => !t.done).length;
  const left = todayItems.filter(i => !i.t || i.t >= nowT()).length;
  let verdict;
  if (h >= 20) { const n = dayItems(addDays(today(), 1)).filter(isPlan).length;
    verdict = n ? `Tomorrow: ${n} thing${n === 1 ? "" : "s"} planned.` : "Nothing planned tomorrow. Rest up."; }
  else { const busy = left + open;
    verdict = busy === 0 ? "A clear day ahead." : busy <= 3 ? "A light day." : busy <= 7 ? "A full day — you've got this." : "A busy one. Pace yourself."; }

  const chips = [];
  if (w && w.day.rainFrom) chips.push(`<span class="chip warn">☔ Rain from ${fmtTime(w.day.rainFrom)}</span>`);
  else if (w && w.day.rain < 20) chips.push(`<span class="chip good">☀ No rain today</span>`);
  const nx = nextPlan();
  if (nx) chips.push(`<span class="chip">⏭ ${esc(nx.when)} · ${esc(nx.title)}</span>`);
  const oc = onClock();
  if (oc !== null) chips.push(`<span class="chip good">⏱ On the clock ${fmtH(oc)}</span>`);
  if (open) chips.push(`<span class="chip">✅ ${open} to-do${open === 1 ? "" : "s"}</span>`);
  upcomingBills().filter(b => daysUntil(b.due) <= 3).forEach(b =>
    chips.push(`<span class="chip ${daysUntil(b.due) < 0 ? "warn" : ""}">💳 ${esc(b.name)} ${inDays(daysUntil(b.due))}</span>`));
  const cd = liveCountdowns()[0];
  if (cd) chips.push(`<span class="chip">⏳ ${esc(cd.title)} ${daysUntil(cd.date) === 0 ? "today!" : inDays(daysUntil(cd.date))}</span>`);
  if (S.gcal.connected && !gReady()) chips.push(`<button class="chip" data-gsync="1">🔄 Sync Google Calendar</button>`);
  if (S.sync.on && S.sync.dirty && !dReady()) chips.push(`<button class="chip" data-sync="now">☁️ Back up changes</button>`);

  const wx = w ? (() => { const [ic] = wxIcon(w.cur.weather_code, w.cur.is_day);
      return `<div class="hero-wx"><div class="ic">${ic}</div><div class="t">${Math.round(w.cur.temperature_2m)}°</div>
              <div class="hl">H ${Math.round(w.day.hi)}° · L ${Math.round(w.day.lo)}°</div></div>`; })()
    : S.city && !WXDATA ? `<div class="hero-wx"><div class="skel" style="width:84px;height:74px"></div></div>` : "";
  return `<div class="hero-top"><div class="greet">${greet()}</div>
      <button id="settingsBtn" class="icon-btn" aria-label="Settings">⚙</button></div>
    <div class="hero-main"><div><div class="hero-clock" id="clockNow"></div><div class="hero-date">${longDate(today())}</div></div>${wx}</div>
    <div class="verdict">${verdict}</div>
    <div class="chips">${chips.join("")}</div>`;
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
            ${i.sub ? `<div class="ts">${esc(i.sub)}</div>` : ""}</div>${ctrl}</div>`);
      }
      if (!nowDone) rows.push(`<div class="now-line"><span>${hm(t)}</span></div>`);
      return html + `<div class="tl">${rows.join("")}</div>`;
    } },

  work: { icon: "💼", title: "Work hours", add: ["shift", "Add a shift"],
    meta: () => { const p = weekPay(weekStart(today())); return p.hrs ? `${fmtH(p.hrs)} this week` : ""; },
    body: () => {
      const W = S.work, oc = onClock();
      const clock = oc !== null
        ? `<div class="clockbox on"><div><b>On the clock</b><span>since ${fmtTime(W.clockIn)} · ${fmtH(oc)}</span></div><button class="btn" data-clock="out">Clock out</button></div>`
        : `<div class="clockbox"><div><b>Off the clock</b><span>Tap when your shift starts</span></div><button class="btn" data-clock="in">Clock in</button></div>`;
      const ws = weekStart(today()), p = weekPay(ws), last = weekPay(addDays(ws, -7));
      const pay = W.rate
        ? `<div class="paygrid"><div class="fact">Hours<b>${fmtH(p.hrs)}</b>${p.ot ? `<small>${fmtH(p.ot)} overtime</small>` : ""}</div>
             <div class="fact">Gross<b>${money(p.gross)}</b></div>
             <div class="fact take">Take-home*<b>${money(p.net)}</b></div></div>
           <div class="fine" style="margin-top:6px">*Rough: ${money(W.rate)}/hr, overtime after ${W.otAfter}h at 1.5x, minus ${W.taxPct}% for taxes.
             Last week: ${fmtH(last.hrs)} · ~${money(last.net)}. <button class="add-link" style="padding:0" data-qa="pay">Change pay</button></div>`
        : `<button class="btn sm ghost" data-qa="pay" style="margin-top:10px">Set your hourly pay to see take-home</button>`;
      const rows = p.shifts.map(x => `<div class="row"><span class="time">${parseDay(x.day).toLocaleDateString([], { weekday: "short" })}</span>
          <span class="grow">${hm(x.start)} – ${hm(x.end)}${Number(x.brk) ? `<span class="sub">${x.brk} min break</span>` : ""}</span>
          <b>${fmtH(shiftHours(x))}</b><button class="x" data-del="work.shifts:${x.id}" aria-label="Remove">✕</button></div>`).join("");
      return clock + pay + (rows ? `<div class="day-label" style="margin-top:14px">This week</div>${rows}` : "");
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
    meta: () => { const shown = S.todos.filter(t => !t.done || t.doneDay === today()); if (!shown.length) return "";
      const d = shown.filter(t => t.done).length;
      return `<span style="display:inline-flex;gap:7px;align-items:center">${d}/${shown.length}<span class="ring" style="--p:${Math.round(d / shown.length * 100)}"></span></span>`; },
    body: () => {
      const shown = S.todos.filter(t => !t.done || t.doneDay === today()).sort((a, b) => a.done - b.done);
      return shown.length ? shown.map(t => `<div class="row ${t.done ? "done" : ""}"><input type="checkbox" class="tick" data-tick="${t.id}" ${t.done ? "checked" : ""} aria-label="Done">
        <span class="grow">${esc(t.title)}</span><button class="x" data-del="todos:${t.id}" aria-label="Remove">✕</button></div>`).join("")
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
          <button class="x" data-del="bills:${b.id}" aria-label="Remove">✕</button></div>`; }).join("") +
        `<div class="total"><span>Every month</span><b>${money(S.bills.reduce((s, b) => s + Number(b.amount || 0), 0))}</b></div>`;
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
  const cards = cardOrder().filter(k => !S.hidden.includes(k)).map(k => {
    const c = CARDS[k]; const col = S.collapsed.includes(k);
    const tag = PACKS[S.pack].cards.includes(k) ? ` <span class="tag">${PACKS[S.pack].label}</span>` : "";
    if (!can(k)) return `<section class="card" data-card="${k}"><h3><span class="ci">${c.icon}</span>${c.title} <span class="tag">PRO</span></h3>
      <div class="body"><div class="empty">Part of Day Hub Pro. No ads, ever — Pro just does more.</div></div></section>`;
    return `<section class="card ${col ? "collapsed" : ""}" data-card="${k}">
      <h3 data-collapse="${k}"><span class="ci">${c.icon}</span>${c.title}${tag}<span class="meta">${c.meta ? c.meta() : ""}</span><span class="chev">⌄</span></h3>
      <div class="body">${c.body()}${c.add ? `<button class="add-link" data-qa="${c.add[0]}">＋ ${c.add[1]}</button>` : ""}</div></section>`;
  }).join("");
  document.getElementById("cards").innerHTML = (!S.city && !S.name ? welcomeHtml() : "") + cards;
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
function toast(msg, undoable) {
  const el = document.getElementById("toast");
  el.innerHTML = `<span>${esc(msg)}</span>${undoable ? `<button data-undo="1">Undo</button>` : ""}`;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); UNDO = null; }, undoable ? 5000 : 2200);
}
// Snapshot the whole state before anything destructive; Undo puts it back.
const snap = () => { UNDO = JSON.stringify(S); };

// ------------------------------------------------------------ quick add
function qaTypes() {
  const t = [["event", "📅 Event"], ["shift", "💼 Work shift"], ["todo", "✅ To-do"], ["item", "🛒 List item"], ["bill", "💳 Bill"], ["countdown", "⏳ Countdown"], ["list", "📝 New list"]];
  if (S.pack === "trucker") t.splice(1, 0, ["loads", "🚚 Load"]);
  if (S.pack === "trades") t.splice(1, 0, ["jobs", "🔧 Job"]);
  return t;
}
function qaFields(type) {
  const d = VIEW || today();
  const F = {
    event: `<input name="title" placeholder="What's happening?" required autocomplete="off">
      <div class="two"><input name="date" type="date" value="${d}" required><input name="time" type="time" required></div>
      <input name="where" placeholder="Where (optional)" autocomplete="off">`,
    todo: `<input name="title" placeholder="What needs doing?" required autocomplete="off">`,
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
    countdown: `<input name="title" placeholder="What are you counting down to?" required autocomplete="off">
      <input name="date" type="date" min="${today()}" required>`,
    list: `<input name="name" placeholder="List name (e.g. Hardware store)" required autocomplete="off">`,
    shift: `<input name="date" type="date" value="${d}" required>
      <div class="two"><label class="field" style="margin:0">Start<input name="start" type="time" required></label>
      <label class="field" style="margin:0">End<input name="end" type="time" required></label></div>
      <input name="brk" type="number" min="0" inputmode="numeric" placeholder="Unpaid break (minutes, optional)">`,
    pay: `<label class="field" style="margin:0">Hourly pay ($)<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" value="${S.work.rate || ""}" required></label>
      <label class="field" style="margin:0">Taken out for taxes (%)<input name="tax" type="number" step="0.5" min="0" max="60" inputmode="decimal" value="${S.work.taxPct}" required></label>
      <label class="field" style="margin:0">Overtime after (hours/week)<input name="ot" type="number" min="1" max="80" inputmode="numeric" value="${S.work.otAfter}" required></label>
      <div class="hint">Not sure of your tax %? 15–25% covers most people. Check one real paycheck: take-home ÷ gross.</div>`,
  };
  return (F[type] || F.todo) + `<button class="btn">${type === "pay" ? "Save" : "Add"}</button>`;
}
function openQA(type) {
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
  if (ty === "event") { S.events.push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), where: (d.where || "").trim() }); VIEW = d.date; }
  else if (ty === "shift") { S.work.shifts.push({ id: uid(), day: d.date, start: d.start, end: d.end, brk: Number(d.brk || 0) }); VIEW = d.date; }
  else if (ty === "pay") { S.work.rate = Number(d.rate); S.work.taxPct = Number(d.tax); S.work.otAfter = Number(d.ot);
    save(); closeQA(); render(); toast("Pay saved ✓"); return; }
  else if (ty === "todo") S.todos.push({ id: uid(), title: d.title.trim(), done: false });
  else if (ty === "loads" || ty === "jobs") { S[ty].push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), done: false }); VIEW = d.date; }
  else if (ty === "bill") {
    const day = Math.min(31, Math.max(1, Number(d.day))), now = new Date();
    // Added after this month's due day = treat this month as handled; before it = due this month.
    const paid = day < now.getDate() ? today().slice(0, 7) : prevMonthKey();
    S.bills.push({ id: uid(), name: d.title.trim(), amount: Number(d.amount), day, paid });
  }
  else if (ty === "countdown") S.countdowns.push({ id: uid(), title: d.title.trim(), date: d.date });
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
  if (ds.day !== undefined) { const n = Number(ds.day); VIEW = n === 0 ? today() : addDays(VIEW, n); render(); return; }
  if (ds.del) { snap(); const [k, id] = ds.del.split(":");
    if (k === "work.shifts") S.work.shifts = S.work.shifts.filter(x => x.id !== id); else S[k] = S[k].filter(x => x.id !== id);
    save(); render(); toast("Removed", true); return; }
  if (ds.clock === "in") { S.work.clockIn = new Date().toISOString(); save(); render(); buzz(); toast("Clocked in ✓"); return; }
  if (ds.clock === "out") { const st = new Date(S.work.clockIn), en = new Date();
    snap();
    if (en - st >= 60000) S.work.shifts.push({ id: uid(), day: ymd(st), start: hhmm(st), end: hhmm(en), brk: 0 });
    S.work.clockIn = null; save(); render(); buzz(); toast(`Clocked out · ${fmtH((en - st) / 3600000)}`, true); return; }
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
  if (ds.tick) { const x = S.todos.find(y => y.id === ds.tick); if (x) { x.done = t.checked; x.doneDay = today(); } }
  else if (ds.tickl) { const [k, id] = ds.tickl.split(":"); const x = S[k].find(y => y.id === id); if (x) x.done = t.checked; }
  else if (ds.item) { const [l, id] = ds.item.split(":"); const L = S.lists.find(x => x.id === l); const i = L && L.items.find(y => y.id === id); if (i) i.done = t.checked; }
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) { VIEW = today(); render(); } });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
