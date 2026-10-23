/* SAVE AS: health.js · LOCATION: C:/MarvelApps/dayhub/health.js
 * HEALTH HUB (app #8; Scott 2026-10-17, his "first choice": "track steps, sleep patterns, meds, gym, step competitions
 * against friends, challenges for better health" + the pasted plan, saved verbatim in
 * C:/MarvelDesktop/docs/HEALTH_HUB_PLAN_FROM_OUTSIDE_CHAT_2026-10-17.md). Runs at /healthhub/ with window.DH_MODE = "health".
 *
 * v1 (1.53), logic + visual layer in one file:
 *   Home = WELLNESS ORBIT: a glowing orb (today's Health Score) with Meds, Water, Steps, Sleep, Vitals and Appointments
 *         orbiting it (live values + badges), 5 daily rings, the score's math, the next appointment and "needs you".
 *   Bottom bar Home · Meds · ＋ · Vitals · More (More = big icon tiles, Scott 10/5 tile nav).
 *   Medications: pill-organizer cards, today's doses with Taken / Skipped, pills left -> refill countdown ("refill soon" at
 *         7 days or fewer), label scan through the relay's "scan" task - ALWAYS a review form before anything is saved.
 *   Appointments (questions to ask, what to bring, follow-up notes, a printable / shareable visit summary), Vitals (blood
 *   pressure, glucose, weight, heart rate, oxygen: gauges + trend chart, bands from published GENERAL ranges only),
 *   Movement & gym, Sleep, Water, Daily check-in, Records vault (IndexedDB, never in the backup), Emergency card.
 *   Friend step challenges: the CHALLENGES switch (features.js, OFF) - only a nickname + step totals would ever be sent.
 * RULES: data stays on the phone; never medical advice, never a dose computed or changed - "pills per dose" is only what the
 * person types from the label, used to count what's left. Every number says its math somewhere.
 * Everything lives in S.hh on this phone. Hub Universe reads it (universe.js uniHealth) read-only.
 * Loaded after ships.js, before ui.js (health mode); Hub Universe loads it before universe.js. Every top-level name is hh / HH.
 */
"use strict";
const HH_TABS = [["home", "🏠", "Home"], ["meds", "💊", "Medications"], ["add", "＋", "Add"], ["vitals", "❤️", "Vitals"], ["more", "☰", "Everything"],
  ["appts", "🩺", "Appointments"], ["move", "👟", "Movement & gym"], ["sleep", "🌙", "Sleep"], ["water", "💧", "Water"], ["checkin", "😊", "Daily check-in"],
  ["vault", "🗂️", "Records vault"], ["card", "🆘", "Emergency card"], ["visit", "📋", "Doctor-visit summary"], ["challenge", "🏆", "Step challenges"],
  ["score", "✨", "Health Score"], ["goals", "🎯", "Daily goals"]];
const HH_NAV = [["home", "🏠", "Home"], ["meds", "💊", "Meds"], ["add", "＋", "Add"], ["vitals", "❤️", "Vitals"], ["more", "☰", "More"]];
const HH_PILLS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#2dd4bf", "#60a5fa", "#a78bfa", "#f472b6", "#f1f5f9"];
const HH_VITALS = [["bp", "🩺", "Blood pressure", "mmHg"], ["glucose", "🩸", "Glucose", "mg/dL"], ["weight", "⚖️", "Weight", "lb"], ["hr", "💓", "Heart rate", "bpm"], ["spo2", "🫁", "Oxygen", "%"]];
const HH_BANDS = { good: ["#4ade80", "Typical"], caution: ["#fbbf24", "Caution"], check: ["#fb923c", "Check"], seek: ["#fb7185", "Talk to your doctor"], none: ["#22d3ee", ""] };
const HH_WORK = [["walk", "🚶", "Walk"], ["run", "🏃", "Run"], ["gym", "🏋️", "Gym / weights"], ["bike", "🚴", "Bike"], ["swim", "🏊", "Swim"], ["yoga", "🧘", "Yoga / stretch"], ["sport", "⛹️", "Sports"], ["other", "✨", "Other"]];
const HH_MOODS = [[1, "😞", "Rough"], [2, "😕", "Low"], [3, "😐", "Okay"], [4, "🙂", "Good"], [5, "😄", "Great"]];
const HH_ENERGY = [[1, "😪", "Drained"], [2, "🥱", "Low"], [3, "🙂", "Okay"], [4, "💪", "Good"], [5, "⚡", "Charged"]];
const HH_SYMS = [["headache", "🤕", "Headache"], ["pain", "🩹", "Pain"], ["tired", "😴", "Tired"], ["dizzy", "💫", "Dizzy"], ["nausea", "🤢", "Nausea"], ["cough", "😷", "Cough"],
  ["fever", "🤒", "Fever"], ["anxious", "😟", "Anxious"], ["back", "🦴", "Back pain"], ["joints", "🦵", "Joint pain"], ["poorsleep", "🛌", "Poor sleep"], ["breath", "🫁", "Short of breath"]];
const HH_DOCS = [["insurance", "🪪", "Insurance card"], ["rx", "💊", "Prescription"], ["lab", "🧪", "Lab results"], ["visit", "📋", "Visit notes"], ["vaccine", "💉", "Vaccines"], ["imaging", "🩻", "Imaging"], ["id", "🆔", "Health ID"], ["other", "📄", "Other"]];
const HH_BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Don't know"];
const HH_ASKS = ["How has my blood pressure looked this month?", "Which doses did I miss this week?", "How did I sleep this week?", "What's on my list for my next appointment?"];
const HH_ADV = "General information, not medical advice - ask your doctor.";
let HH_OPEN = false, HH_TAB = "meds", HH_MSG = "", HH_EDIT = null, HH_VK = "bp", HH_AP = null, HH_APADD = false, HH_APEDIT = null, HH_PAST = false;
let HH_VISIT = null, HH_SCAN = null, HH_BIG = null, HH_VT = "insurance", HH_CHAL = null, HH_CHAL_MSG = "";
if (typeof document !== "undefined" && typeof MODE !== "undefined" && MODE === "health") document.body.classList.add("hhapp");   // hides the Day Hub ＋ button

// ------------------------------------------------------------ the data (S.hh) and small helpers
function hh() {
  if (!S.hh || typeof S.hh !== "object" || Array.isArray(S.hh)) S.hh = {};
  const H = S.hh, o = v => v && typeof v === "object" && !Array.isArray(v);
  ["meds", "workouts", "sleep", "vitals", "appts", "vault", "medlog"].forEach(k => { H[k] = Array.isArray(H[k]) ? H[k].filter(o) : []; });
  ["doses", "water", "steps", "checkins"].forEach(k => { H[k] = o(H[k]) ? H[k] : {}; });
  H.goals = Object.assign({ water: 8, steps: 6000, sleep: 8 }, o(H.goals) ? H.goals : {});
  H.card = Object.assign({ allergies: "", conditions: "", blood: "", hospital: "", doctor: "", notes: "", contacts: [] }, o(H.card) ? H.card : {});
  if (!Array.isArray(H.card.contacts)) H.card.contacts = [];
  H.meds.forEach(m => { if (!Array.isArray(m.times)) m.times = []; });
  H.appts.forEach(a => { if (!Array.isArray(a.q)) a.q = []; });
  return H;
}
const hhSet = () => !!(S.hh && S.hh.setup);
const hhMeds = () => hh().meds.filter(m => !m.off);
const hhAppts = () => hh().appts;
const hhGoals = () => hh().goals;
const hhIsT = v => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
const hhIsD = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const hhMin = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + m; };
const hhNum = v => { const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; };
const hhTxt = (v, n = 80) => String(v == null ? "" : v).trim().slice(0, n);
const hhDate = d => d ? prettyDate(d) + (String(d).slice(0, 4) !== today().slice(0, 4) ? ", " + String(d).slice(0, 4) : "") : "";
const hhRel = d => { const n = daysUntil(d); return n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n > 1 && n < 7 ? `in ${n} days` : n < 0 && n > -7 ? `${-n} days ago` : hhDate(d); };
const hhWk = d => parseDay(d).toLocaleDateString("en-US", { weekday: "short" });
// 7.5 -> "7h 30m"
const hhFmtH = h => { const H = Math.floor(h + 1e-9), M = Math.round((h - H) * 60); return M === 60 ? `${H + 1}h` : M ? `${H}h ${M}m` : `${H}h`; };
const hhK = n => n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const hhVK = k => HH_VITALS.find(x => x[0] === k) || HH_VITALS[0];
const hhDoc = k => HH_DOCS.find(x => x[0] === k) || HH_DOCS[HH_DOCS.length - 1];
const hhCap = (c, cls = "") => `<svg class="hh-cap ${cls}" viewBox="0 0 48 24" aria-hidden="true"><rect x="1" y="1" width="46" height="22" rx="11" fill="${HH_PILLS.includes(c) ? c : HH_PILLS[4]}"/>
  <path d="M24 1h12a11 11 0 0 1 0 22H24Z" fill="#fff" opacity=".82"/><rect x="6" y="5" width="13" height="4" rx="2" fill="#fff" opacity=".45"/></svg>`;
const hhIc = (icon, tone, cls = "") => `<span class="hh-ic ${cls}" style="--tone:${tone}" aria-hidden="true">${icon}</span>`;

// ------------------------------------------------------------ the math (pure, the tests call these)
// Hours slept from bedtime to wake time, across midnight: 23:30 -> 07:00 = 7.5.
function hhSleepHrs(bed, wake) { let d = hhMin(wake) - hhMin(bed); if (d < 0) d += 1440; return Math.round(d / 60 * 100) / 100; }
// Today's (or any day's) scheduled doses: [{m, time, k, x (log), st: taken|skipped|due|missed|later}]. Due = its time has come
// (up to 2 hours), missed = more than 2 hours past and not logged. A med added today skips times more than an hour before it was added.
function hhDoses(t) {
  const L = hh().doses[t] || {}, now = t === today() ? hhMin(nowT()) : t < today() ? 1e6 : -1e6, out = [];
  hhMeds().forEach(m => m.times.slice().sort().forEach(time => {
    if (m.added && (t < m.added || (t === m.added && m.addedT && hhMin(time) < hhMin(m.addedT) - 60))) return;
    const k = `${m.id}|${time}`, x = L[k], late = now - hhMin(time);
    out.push({ m, time, k, x, st: x ? x.s : late > 120 ? "missed" : late >= 0 ? "due" : "later" }); }));
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.m.name.localeCompare(b.m.name));
}
// "As needed" medicines (no set times): how many taken on a day.
const hhPrnCount = (m, t) => Object.keys(hh().doses[t] || {}).filter(k => k.startsWith(m.id + "|prn")).length;
// Taken / Skipped (tap the same again = undo). Taken counts the pills off "pills left" (the number typed from the label).
function hhLog(k, s, t) {
  t = t || today(); const H = hh(), m = H.meds.find(x => x.id === String(k).split("|")[0]); if (!m) return "";
  const D = H.doses[t] = H.doses[t] || {}, was = D[k], per = +m.per > 0 ? +m.per : 1, track = m.left !== "" && m.left != null;
  if (was && was.s === s) { delete D[k]; if (s === "taken" && track) m.left = +m.left + per; return "undo"; }
  if (was && was.s === "taken" && track) m.left = +m.left + per;      // changed from taken to skipped: the pill goes back
  D[k] = { s, at: nowT() };
  if (s === "taken" && track) m.left = Math.max(0, +m.left - per);
  const old = addDays(t, -400); Object.keys(H.doses).forEach(d => { if (d < old) delete H.doses[d]; });   // keep about a year
  return s;
}
// Pills left -> days left (pills per dose x times a day), the refill date, and "refill soon" at 7 days or fewer.
function hhRefill(m) {
  const per = +m.per > 0 ? +m.per : 1, daily = per * (m.times || []).length, left = m.left === "" || m.left == null ? null : +m.left;
  if (left == null || !daily) return { track: left != null, left, days: null, soon: false, daily };
  const days = Math.floor(left / daily);
  return { track: true, left, daily, days, by: addDays(today(), days), soon: days <= 7 };
}
const hhWater = t => Math.max(0, +(hh().water[t] || 0));
const hhSteps = t => Math.max(0, +(hh().steps[t] || 0));
const hhWorkMin = t => hh().workouts.filter(w => w.date === t).reduce((n, w) => n + (+w.min || 0), 0);
const hhSleepOn = t => hh().sleep.filter(x => x.date === t).slice(-1)[0] || null;
const hhReads = k => hh().vitals.filter(v => v.kind === k).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
const hhLatest = k => hhReads(k).slice(-1)[0] || null;
const hhLatestAll = () => Object.fromEntries(HH_VITALS.map(([k]) => [k, hhLatest(k)]));
const hhApSort = (a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""));
function hhNextAppt() {
  const t = today(), n = nowT();
  return hhAppts().filter(a => a.date > t || (a.date === t && (!a.time || a.time >= n))).sort(hhApSort)[0] || null;
}
// Today's Health Score, 0-100, from routines done. Each routine is worth 20: meds (doses taken of today's doses - left out when
// there are none), water (glasses / goal), movement (steps / goal, or a workout: 30 minutes = full), sleep (last night / goal),
// vitals (any reading today). Score = points / points possible x 100.
function hhScore(t) {
  const g = hhGoals(), D = hhDoses(t), parts = [], tk = D.filter(d => d.st === "taken").length;
  const w = hhWater(t), st = hhSteps(t), wm = hhWorkMin(t), sl = hhSleepOn(t), v = hh().vitals.some(x => x.date === t);
  if (D.length) parts.push(["meds", "💊", "Meds", tk / D.length, `${tk} of ${D.length} doses taken`]);
  parts.push(["water", "💧", "Water", Math.min(1, w / Math.max(1, g.water)), `${w} of ${g.water} glasses`]);
  const bySteps = st / Math.max(1, g.steps), byWork = wm / 30;
  parts.push(["move", "👟", "Movement", Math.min(1, Math.max(bySteps, byWork)), byWork > bySteps ? `${wm} min of workouts (30 = full)` : `${st.toLocaleString("en-US")} of ${(+g.steps).toLocaleString("en-US")} steps`]);
  parts.push(["sleep", "🌙", "Sleep", sl ? Math.min(1, sl.hrs / Math.max(1, g.sleep)) : 0, sl ? `${hhFmtH(sl.hrs)} of ${g.sleep}h` : "not logged"]);
  parts.push(["vitals", "❤️", "Vitals", v ? 1 : 0, v ? "checked today" : "not checked yet"]);
  const sum = parts.reduce((n, p) => n + p[3], 0);
  return { score: Math.round(sum / parts.length * 100), pts: Math.round(sum * 20 * 10) / 10, max: parts.length * 20,
    parts: parts.map(([k, icon, label, frac, how]) => ({ k, icon, label, frac, pts: Math.round(frac * 20 * 10) / 10, how })) };
}
// Days in a row (ending today, or yesterday if today isn't done yet) with the step goal met or a workout logged.
function hhStreak(t) {
  const g = hhGoals(), ok = d => hhSteps(d) >= g.steps || hh().workouts.some(w => w.date === d);
  let d = ok(t) ? t : addDays(t, -1), n = 0;
  while (ok(d) && n < 999) { n++; d = addDays(d, -1); }
  return n;
}
// Vitals bands - published GENERAL ranges only, labelled as general information (never a diagnosis):
//   blood pressure: American Heart Association categories (normal <120/<80, elevated 120-129/<80, high >=130 or >=80,
//   180 or higher / 120 or higher = seek care); under 90/60 = lower than typical (NIH NHLBI).
//   glucose: fasting 70-99 typical, 100-125 caution, 126+ check; any time <140 typical (2 hours after eating), 140-199
//   caution, 200+ check; under 70 = low (American Diabetes Association). heart rate at rest 60-100 typical (AHA).
//   oxygen (pulse oximeter) 95-100 typical, 90-94 caution, under 90 check.
function hhBand(r) {
  if (!r) return { k: "none", label: "", why: "" };
  const v = +r.v;
  if (r.kind === "bp") { const s = +r.sys, d = +r.dia;
    if (s >= 180 || d >= 120) return { k: "seek", label: "Very high", why: "180 or higher, or 120 or higher" };
    if (s >= 130 || d >= 80) return { k: "check", label: "High", why: "130 or higher, or 80 or higher" };
    if (s >= 120) return { k: "caution", label: "Elevated", why: "120-129 and under 80" };
    if (s < 90 || d < 60) return { k: "caution", label: "Lower than typical", why: "under 90/60" };
    return { k: "good", label: "Normal", why: "under 120/80" }; }
  if (r.kind === "glucose") {
    if (v < 70) return { k: "check", label: "Low", why: "under 70" };
    if (r.fast !== false) return v < 100 ? { k: "good", label: "Typical (fasting)", why: "70-99 fasting" } : v < 126 ? { k: "caution", label: "Above typical (fasting)", why: "100-125 fasting" } : { k: "check", label: "High (fasting)", why: "126 or higher fasting" };
    return v < 140 ? { k: "good", label: "Typical", why: "under 140 any time" } : v < 200 ? { k: "caution", label: "Above typical", why: "140-199 any time" } : { k: "check", label: "High", why: "200 or higher" }; }
  if (r.kind === "hr") return v >= 60 && v <= 100 ? { k: "good", label: "Typical at rest", why: "60-100 at rest" } : { k: "caution", label: v < 60 ? "Below 60" : "Above 100", why: "typical at rest is 60-100 (lower can be normal for active people)" };
  if (r.kind === "spo2") return v >= 95 ? { k: "good", label: "Typical", why: "95-100%" } : v >= 90 ? { k: "caution", label: "Below typical", why: "90-94%" } : { k: "check", label: "Low", why: "under 90%" };
  return { k: "none", label: "", why: "" };
}
const hhVal = r => !r ? "–" : r.kind === "bp" ? `${r.sys}/${r.dia}` : `${r.v}`;
const hhVUnit = r => !r ? "" : `${hhVal(r)} ${hhVK(r.kind)[3]}`;
// Average of a kind over the last N days (today included). -> {n, sys, dia} | {n, v}
function hhAvg(k, days, t) {
  t = t || today(); const from = addDays(t, -(days - 1)), R = hhReads(k).filter(r => r.date >= from && r.date <= t);
  if (!R.length) return { n: 0 };
  const av = f => R.reduce((n, r) => n + (+r[f] || 0), 0) / R.length;
  return k === "bp" ? { n: R.length, sys: Math.round(av("sys")), dia: Math.round(av("dia")) } : { n: R.length, v: k === "weight" ? Math.round(av("v") * 10) / 10 : Math.round(av("v")) };
}
const hhAvgTxt = (k, A) => !A.n ? "–" : k === "bp" ? `${A.sys}/${A.dia}` : `${A.v}`;
// What needs you: doses due / missed, refills running low, an appointment today or tomorrow, a very high reading today.
function hhNeeds(t) {
  const out = [];
  hhDoses(t).filter(d => d.st === "due" || d.st === "missed").forEach(d => out.push({ icon: "💊", tone: d.st === "missed" ? "#fb7185" : "#2dd4bf", late: d.st === "missed",
    text: `${d.st === "missed" ? "Missed" : "Dose due"}: ${d.m.name}${d.m.strength ? " " + d.m.strength : ""}`, sub: hm(d.time), tab: "meds" }));
  hhMeds().forEach(m => { const r = hhRefill(m); if (r.soon) out.push({ icon: "🧴", tone: "#fb7185", late: r.days <= 0,
    text: r.days <= 0 ? `Out of ${m.name} by the count` : `Refill soon: ${m.name}`, sub: r.days <= 0 ? "0 days left" : `${r.days} day${r.days === 1 ? "" : "s"} left`, tab: "meds" }); });
  hhAppts().filter(a => a.date === t || a.date === addDays(t, 1)).sort(hhApSort).forEach(a => out.push({ icon: "🩺", tone: "#a78bfa", late: false,
    text: `${a.doctor || "Appointment"}${a.specialty ? " · " + a.specialty : ""}`, sub: `${a.date === t ? "today" : "tomorrow"}${a.time ? " " + hm(a.time) : ""}`, tab: "appts", ap: a.id }));
  hh().vitals.filter(v => v.date === t && hhBand(v).k === "seek").slice(-1).forEach(v => out.push({ icon: "⚠️", tone: "#fb7185", late: true, text: `Very high reading: ${hhVUnit(v)}`, sub: "see what to do", tab: "vitals", vk: v.kind }));
  return out.sort((a, b) => b.late - a.late);
}

// ------------------------------------------------------------ the sheet: one page per tab + the bottom bar
function hhSheet() {
  let el = document.getElementById("hhSheet");
  if (!el) { el = document.createElement("div"); el.id = "hhSheet"; el.className = "sheet hidden"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function hideHh() { const el = document.getElementById("hhSheet"); if (el) el.classList.add("hidden"); HH_OPEN = false; HH_MSG = ""; HH_EDIT = null; HH_SCAN = null; HH_BIG = null; HH_APADD = false; HH_APEDIT = null; }
function showHh(tab) {
  const el = hhSheet(), old = el.querySelector(".sheet-body"), keep = HH_OPEN && old && (!tab || tab === HH_TAB) ? old.scrollTop : 0;
  if (tab) HH_TAB = tab; HH_OPEN = true;
  const T = HH_TABS.find(x => x[0] === HH_TAB) || HH_TABS[1]; el.setAttribute("aria-label", T[2]);
  el.innerHTML = `<div class="sheet-body hh-sheet"><div class="grab"></div>
    <div class="sheet-head"><h2>${T[1]} ${T[2]}</h2><button class="icon-btn" data-hhclose="1" aria-label="Close">✕</button></div>
    <div class="home-pane">${hhPane()}</div><p class="fine" id="hhMsg">${HH_MSG ? "⚠️ " + esc(HH_MSG) : ""}</p>
    <nav class="auto-tabs mv-tabs hh-tabs" aria-label="Health Hub">${hhNavHtml(HH_TAB)}</nav></div>`;
  el.classList.remove("hidden");
  if (keep) { const b = el.querySelector(".sheet-body"); b.style.animation = "none"; b.scrollTop = keep; }
  if (HH_TAB === "vault") setTimeout(hhThumbs, 0);
}
const hhMsgShow = () => { const el = document.getElementById("hhMsg"); if (el) el.textContent = HH_MSG ? "⚠️ " + HH_MSG : ""; };
const hhNavFor = tab => ["meds", "add", "vitals"].includes(tab) ? tab : tab === "home" ? "home" : "more";
function hhNavHtml(on) {
  return HH_NAV.map(([k, i, l]) => `<button class="${hhNavFor(on) === k ? "on" : ""} ${k === "add" ? "mv-plus" : ""}" ${k === "home" ? (on === "home" ? 'data-hhtop="1"' : 'data-hhclose="1"') : `data-hhtab="${k}"`}
    aria-current="${hhNavFor(on) === k ? "page" : "false"}" aria-label="${l}"><span aria-hidden="true">${i}</span>${k === "add" ? "" : l}</button>`).join("");
}
function hhNavEnsure() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("hh", hhSet());
  let n = document.getElementById("hhNav");
  if (!hhSet()) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement("nav"); n.id = "hhNav"; n.className = "mv-nav hh-nav"; n.setAttribute("aria-label", "Health Hub"); document.body.appendChild(n); }
  n.innerHTML = hhNavHtml("home");
}
function hhPane() {
  const P = { meds: hhMedsHtml, add: hhAddHtml, vitals: hhVitalsHtml, more: hhMoreHtml, appts: hhApptsHtml, move: hhMoveHtml, sleep: hhSleepHtml, water: hhWaterHtml,
    checkin: hhCheckinHtml, vault: hhVaultHtml, card: hhCardHtml, visit: hhVisitPage, challenge: hhChalHtml, score: hhScoreHtml, goals: hhGoalsHtml };
  return (P[HH_TAB] || hhMedsHtml)();
}

// ------------------------------------------------------------ first run
function hhSetupHtml() {
  if (typeof document !== "undefined") document.body.classList.add("hhapp");
  return `<section class="card hh-home hh-hello" aria-label="Welcome to Health Hub"><div class="hh-hello-top">${hhOrbArt(null)}
      <div><h1>Health <b>Hub</b></h1><p>Your wellness command center</p></div></div>
    <div class="hh-promise">${["💊 Meds", "🩺 Visits", "❤️ Vitals", "🌙 Sleep", "👟 Move", "💧 Water"].map(w => `<span>${w}</span>`).join("")}</div>
    <h2>Welcome to Health Hub 💚</h2><p>Your name and three daily goals, and your orbit lights up. Change them any time.</p>
    <form class="qa-form" data-hhsetup="1"><input name="name" placeholder="Your first name (optional)" autocomplete="given-name" aria-label="Your first name">
      <div class="hh-goalin"><label>💧 Water<input name="water" type="number" min="1" max="30" value="8" inputmode="numeric"><small>glasses a day</small></label>
        <label>👟 Steps<input name="steps" type="number" min="500" max="50000" step="500" value="6000" inputmode="numeric"><small>a day</small></label>
        <label>🌙 Sleep<input name="sleep" type="number" min="4" max="12" step="0.5" value="8" inputmode="decimal"><small>hours a night</small></label></div>
      <button class="btn hh-go">Start Health Hub</button></form>
    <p class="fine">Everything stays on this phone. Health Hub keeps your own records and general information - it is not medical advice.</p></section>`;
}
// The glowing wellness orb (SVG, no image files). With a score it shows the number; motion stops under "reduce motion".
function hhOrbArt(score) {
  return `<svg class="hh-orb-art" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs>
      <radialGradient id="hhOrbG" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="#e0fffb"/><stop offset=".35" stop-color="#5eead4"/><stop offset=".75" stop-color="#0e7490"/><stop offset="1" stop-color="#083344"/></radialGradient>
      <radialGradient id="hhOrbH" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#2dd4bf" stop-opacity=".45"/><stop offset="1" stop-color="#2dd4bf" stop-opacity="0"/></radialGradient></defs>
    <circle class="hh-halo" cx="60" cy="60" r="58" fill="url(#hhOrbH)"/><circle cx="60" cy="60" r="40" fill="url(#hhOrbG)"/>
    <path d="M30 62h14l6-14 9 26 7-18 5 6h19" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="${score == null ? ".95" : ".28"}"/>
    <ellipse cx="48" cy="44" rx="12" ry="7" fill="#fff" opacity=".35"/></svg>`;
}

// ------------------------------------------------------------ HOME: the Wellness Orbit
function hhDashHtml() {
  hhNavEnsure();
  const t = today(), g = hhGoals(), D = hhDoses(t), S1 = hhScore(t), w = hhWater(t), st = hhSteps(t), sl = hhSleepOn(t), V = hhLatestAll(), nx = hhNextAppt(), N = hhNeeds(t);
  const tk = D.filter(d => d.st === "taken").length, due = D.filter(d => d.st === "due" || d.st === "missed").length, low = hhMeds().filter(m => hhRefill(m).soon).length;
  const vToday = hh().vitals.filter(v => v.date === t), seek = vToday.some(v => hhBand(v).k === "seek");
  const prn = hhMeds().filter(m => !m.times.length).length;
  const center = `<button class="hos-core hos-core-btn hh-orb" data-hhtab="score" aria-label="Health Score ${S1.score} of 100 - how it's worked out">${hhOrbArt(S1.score)}<b>${S1.score}</b><small>Health Score</small></button>`;
  const items = [
    { attr: 'data-hhtab="meds"', icon: "💊", label: "Meds", val: D.length ? `${tk}/${D.length} taken` : prn ? "as needed" : "add", tone: "#2dd4bf", badge: due ? String(due) : low ? "!" : "" },
    { attr: 'data-hhtab="water"', icon: "💧", label: "Water", val: `${w}/${g.water}`, tone: "#22d3ee", badge: "" },
    { attr: 'data-hhtab="move"', icon: "👟", label: "Steps", val: st ? hhK(st) : "log", tone: "#6ee7b7", badge: "" },
    { attr: 'data-hhtab="sleep"', icon: "🌙", label: "Sleep", val: sl ? hhFmtH(sl.hrs) : "log", tone: "#a78bfa", badge: "" },
    { attr: 'data-hhtab="vitals"', icon: "❤️", label: "Vitals", val: V.bp ? hhVal(V.bp) : vToday.length ? "logged" : "log", tone: "#fb7185", badge: seek ? "!" : "" },
    { attr: 'data-hhtab="appts"', icon: "🩺", label: "Visits", val: nx ? (daysUntil(nx.date) === 0 ? "today" : daysUntil(nx.date) === 1 ? "tomorrow" : prettyDate(nx.date)) : "none", tone: "#818cf8", badge: nx && daysUntil(nx.date) <= 1 ? "soon" : "" }];
  const ring = (k, pct, big, label, tone, tab) => `<button data-hhtab="${tab}" aria-label="${esc(label)}">${hosRing(pct, big, label, tone)}</button>`;
  const P = Object.fromEntries(S1.parts.map(p => [p.k, p]));
  const wd = parseDay(t).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return `<section class="card hh-home" aria-label="Health Hub">
    <div class="hh-top"><span class="hh-brand">❤️ Health <b>Hub</b></span><small>${esc(wd)}</small></div>
    <div class="hh-orbit">${hosOrbit(center, items)}</div>
    <div class="mv-sec"><h3>Needs you</h3>${N.length ? `<small class="hh-count">${N.length}</small>` : ""}</div>
    ${N.length ? `<div class="hh-needs">${N.slice(0, 6).map(x => `<button class="hh-need${x.late ? " late" : ""}" data-hhtab="${x.tab}"${x.ap ? ` data-hhap="${x.ap}"` : ""}${x.vk ? ` data-hhvk="${x.vk}"` : ""} style="--tone:${x.tone}">
        ${hhIc(x.icon, x.tone, "sm")}<span class="grow"><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></span><em>›</em></button>`).join("")}</div>`
      : `<p class="hos-hint">✨ All caught up for now${S.name ? ", " + esc(S.name) : ""}.</p>`}
    <div class="mv-sec"><h3>Today's rings</h3><button data-hhtab="score">How it's scored</button></div>
    <div class="hh-rings">${ring("meds", P.meds ? P.meds.frac * 100 : 0, D.length ? `${tk}/${D.length}` : "–", "meds taken", "#2dd4bf", "meds")}
      ${ring("water", P.water.frac * 100, `${w}/${g.water}`, "water", "#22d3ee", "water")}
      ${ring("move", P.move.frac * 100, `${Math.round(P.move.frac * 100)}%`, "movement", "#6ee7b7", "move")}
      ${ring("sleep", P.sleep.frac * 100, sl ? hhFmtH(sl.hrs) : "–", "sleep", "#a78bfa", "sleep")}
      ${ring("vitals", P.vitals.frac * 100, vToday.length ? "✓" : "–", "vitals checked", "#fb7185", "vitals")}</div>
    <button class="hh-scorecard" data-hhtab="score"><span class="hh-score-n">${S1.score}<small>/100</small></span><span class="grow"><b>Health Score</b>
      <small>${S1.parts.map(p => `${p.icon} ${p.pts % 1 ? p.pts.toFixed(1) : p.pts}`).join(" · ")} = ${S1.pts % 1 ? S1.pts.toFixed(1) : S1.pts} of ${S1.max} points</small></span><span class="hos-go" aria-hidden="true">›</span></button>
    <div class="mv-sec"><h3>Next appointment</h3><button data-hhtab="appts">${hhAppts().length ? "All" : "Add"}</button></div>
    ${nx ? `<button class="hh-apnext" data-hhtab="appts" data-hhap="${nx.id}">${hhApDate(nx.date)}<span class="grow"><b>${esc(nx.doctor || "Appointment")}${nx.specialty ? ` · ${esc(nx.specialty)}` : ""}</b>
        <small>${nx.time ? hm(nx.time) + " · " : ""}${esc(hhRel(nx.date))}${nx.q.length ? ` · ${nx.q.filter(q => !q.done).length} question${nx.q.filter(q => !q.done).length === 1 ? "" : "s"} to ask` : ""}</small></span><em>›</em></button>`
      : `<p class="hos-hint">No visits coming up. Add one and keep your questions ready.</p>`}
    <div class="mv-acts hh-acts">${[["hhwater", "1", "💧", "+1 glass", "#22d3ee"], ["hhtab", "meds", "💊", "Meds", "#2dd4bf"], ["hhvk", "bp", "🩺", "Log BP", "#fb7185"], ["hhtab", "checkin", "😊", "Check-in", "#a78bfa"]]
      .map(([k, v, i, l, c]) => `<button data-${k}="${v}"${k === "hhvk" ? ' data-hhtab="vitals"' : ""} style="--tone:${c}"><span aria-hidden="true">${i}</span>${l}</button>`).join("")}</div>
    <div class="mv-sec"><h3>More for you</h3></div>
    ${tileNav([["move", "👟", "Move & gym"], ["sleep", "🌙", "Sleep"], ["vault", "🗂️", "Records"], ["card", "🆘", "Emergency"], ["visit", "📋", "Visit summary"], ["challenge", "🏆", "Challenges"]]
      .map(([k, i, l]) => ({ icon: i, label: l, attrs: `data-hhtab="${k}"` })), 3, "hh-tiles")}
    <button class="hh-sosbtn" data-hhsos="1">🆘 Show my health info</button>
    <p class="fine hh-adv">${HH_ADV} Everything here stays on this phone.</p>
  </section>`;
}
const hhApDate = d => { const x = parseDay(d); return `<span class="hh-apdate"><small>${x.toLocaleDateString("en-US", { month: "short" })}</small><b>${x.getDate()}</b><i>${x.toLocaleDateString("en-US", { weekday: "short" })}</i></span>`; };

// ------------------------------------------------------------ HEALTH SCORE (its math, part by part)
function hhScoreHtml() {
  const S1 = hhScore(today());
  return `<section class="hh-hero"><div class="hh-orb-big">${hhOrbArt(S1.score)}<b>${S1.score}</b></div><div><h3>Today's Health Score</h3>
      <p>Made from your routines - not a medical measure. Each one is worth 20 points.</p></div></section>
    <div class="hh-parts">${S1.parts.map(p => `<div class="hh-part"><span class="hh-part-ic">${p.icon}</span><div class="grow"><b>${p.label}</b><small>${esc(p.how)}</small>
        <i class="hh-track"><span style="width:${Math.round(p.frac * 100)}%"></span></i></div><strong>${p.pts % 1 ? p.pts.toFixed(1) : p.pts}<small>/20</small></strong></div>`).join("")}</div>
    <p class="hh-math">${S1.pts % 1 ? S1.pts.toFixed(1) : S1.pts} points of ${S1.max} possible = <b>${S1.score}</b> out of 100${S1.max < 100 ? " (no doses today, so meds are left out and the rest scale up)" : ""}.</p>
    <p class="fine">Movement counts whichever is higher: steps against your goal, or workout minutes (30 minutes = full). Sleep is the night you woke up from today. Change the goals in <button class="mv-linkb hh-link" data-hhtab="goals">Daily goals</button>.</p>`;
}
function hhGoalsHtml() {
  const g = hhGoals();
  return `<form class="qa-form" data-hhgoals="1"><label class="field">Your first name<input name="name" value="${esc(S.name || "")}" autocomplete="given-name"></label>
      <div class="hh-goalin"><label>💧 Water<input name="water" type="number" min="1" max="30" value="${g.water}" inputmode="numeric"><small>glasses a day</small></label>
        <label>👟 Steps<input name="steps" type="number" min="500" max="50000" step="500" value="${g.steps}" inputmode="numeric"><small>a day</small></label>
        <label>🌙 Sleep<input name="sleep" type="number" min="4" max="12" step="0.5" value="${g.sleep}" inputmode="decimal"><small>hours a night</small></label></div>
      <button class="btn hh-go">Save goals</button></form>
    <p class="fine">Pick goals that fit you - your doctor can tell you what's right for you.</p>`;
}

// ------------------------------------------------------------ ＋ ADD and MORE: big tiles
function hhAddHtml() {
  return tileNav([["hhwater", "1", "💧", "+1 glass"], ["hhtab", "meds", "💊", "Took my meds"], ["hhvk", "bp", "🩺", "Blood pressure"], ["hhvk", "glucose", "🩸", "Glucose"],
    ["hhvk", "weight", "⚖️", "Weight"], ["hhtab", "move", "👟", "Steps / workout"], ["hhtab", "sleep", "🌙", "Sleep"], ["hhtab", "checkin", "😊", "Check-in"],
    ["hhapnew", "1", "🩺", "Appointment"], ["hhmednew", "1", "💊", "New medicine"], ["hhtab", "vault", "🗂️", "Record photo"], ["hhtab", "card", "🆘", "Emergency card"]]
    .map(([k, v, i, l]) => ({ icon: i, label: l, attrs: `data-${k}="${v}"${k === "hhvk" ? ' data-hhtab="vitals"' : ""}` })), 3, "hh-tiles hh-addtiles")
    + `<div class="hh-scanbox"><span aria-hidden="true">📷</span><div><b>Scan a medicine label</b><small>${aiOn() ? "The AI reads it (1 AI credit) and you check every field before saving." : "AI credits read it for you (⚙ → AI helper). Without them you still get the photo and type what it says."}</small></div>
      <label class="btn sm hh-go">Scan<input type="file" accept="image/*" capture="environment" data-hhscan="1" hidden></label></div>`;
}
function hhMoreHtml() {
  return tileNav([["appts", "🩺", "Appointments"], ["meds", "💊", "Medications"], ["vitals", "❤️", "Vitals"], ["move", "👟", "Move & gym"], ["sleep", "🌙", "Sleep"], ["water", "💧", "Water"],
    ["checkin", "😊", "Check-in"], ["vault", "🗂️", "Records vault"], ["card", "🆘", "Emergency card"], ["visit", "📋", "Visit summary"], ["challenge", "🏆", "Challenges"], ["score", "✨", "Health Score"],
    ["goals", "🎯", "Daily goals"]].map(([k, i, l]) => ({ icon: i, label: l, attrs: `data-hhtab="${k}"` })).concat([{ icon: "💡", label: "Ask", attrs: 'data-hhask="1"' }]), 3, "hh-tiles")
    + `<p class="fine">${HH_ADV} Your records stay on this phone; photos in the Records vault are never in the backup.</p>`;
}

// ------------------------------------------------------------ MEDICATIONS: today's doses + pill-organizer cards
const HH_SLOTS = [["Morning", "🌅", 300, 720], ["Afternoon", "☀️", 720, 1020], ["Evening", "🌆", 1020, 1260], ["Night", "🌙", 1260, 1740]];
const hhSlot = t => { let m = hhMin(t); if (m < 300) m += 1440; return HH_SLOTS.find(s => m >= s[2] && m < s[3]) || HH_SLOTS[3]; };
function hhMedsHtml() {
  if (HH_EDIT) return hhMedForm();
  const t = today(), D = hhDoses(t), tk = D.filter(d => d.st === "taken").length, M = hhMeds(), prn = M.filter(m => !m.times.length);
  const stTxt = { taken: "✓ taken", skipped: "skipped", due: "due now", missed: "missed", later: "later" };
  const row = d => `<div class="hh-dose ${d.st}" style="--pill:${HH_PILLS.includes(d.m.color) ? d.m.color : HH_PILLS[4]}">${hhCap(d.m.color)}<div class="grow"><b>${esc(d.m.name)}</b>
      <small>${d.m.strength ? esc(d.m.strength) + " · " : ""}${hm(d.time)} · ${stTxt[d.st]}${d.x && d.x.at ? ` at ${hm(d.x.at)}` : ""}</small></div>
      <button class="hh-take${d.st === "taken" ? " on" : ""}" data-hhdose="${d.k}|taken" aria-pressed="${d.st === "taken"}" aria-label="Taken: ${esc(d.m.name)} ${hm(d.time)}">✓ Taken</button>
      <button class="hh-skip${d.st === "skipped" ? " on" : ""}" data-hhdose="${d.k}|skipped" aria-pressed="${d.st === "skipped"}" aria-label="Skipped: ${esc(d.m.name)} ${hm(d.time)}">Skip</button></div>`;
  const slots = HH_SLOTS.map(s => [s, D.filter(d => hhSlot(d.time) === s)]).filter(([, L]) => L.length);
  return `<section class="hh-hero">${hosRing(D.length ? tk / D.length * 100 : 0, D.length ? `${tk}/${D.length}` : "–", "taken today", "#2dd4bf")}
      <div><h3>${!M.length ? "Your pill organizer" : D.length ? (tk === D.length ? "All of today's doses taken 🎉" : `${D.length - tk} dose${D.length - tk === 1 ? "" : "s"} left today`) : "No set times today"}</h3>
      <p>Tap <b>✓ Taken</b> as you take each one. Tap it again to undo.</p></div></section>
    ${slots.map(([s, L]) => `<div class="hh-slot"><h4>${s[1]} ${s[0]}</h4>${L.map(row).join("")}</div>`).join("") || (M.length ? "" : `<p class="hos-hint">Add your medicines and today's doses show up here, morning to night.</p>`)}
    ${prn.length ? `<div class="hh-slot"><h4>🕐 As needed</h4>${prn.map(m => { const n = hhPrnCount(m, t);
        return `<div class="hh-dose" style="--pill:${HH_PILLS.includes(m.color) ? m.color : HH_PILLS[4]}">${hhCap(m.color)}<div class="grow"><b>${esc(m.name)}</b><small>${m.strength ? esc(m.strength) + " · " : ""}${n ? `taken ${n}× today` : "not taken today"}</small></div>
          <button class="hh-take" data-hhprn="${m.id}">＋ Took one</button></div>`; }).join("")}</div>` : ""}
    <div class="mv-sec"><h3>My medicines</h3><button data-hhmednew="1">＋ Add</button></div>
    <div class="hh-medcards">${M.map(hhMedCard).join("") || ""}</div>
    <div class="hh-medadd"><button class="btn hh-go" data-hhmednew="1">＋ Add a medicine</button><label class="btn ghost">📷 Scan a label<input type="file" accept="image/*" capture="environment" data-hhscan="1" hidden></label></div>
    <p class="fine">Health Hub never works out or changes a dose - it shows the instructions exactly as you typed them and counts what's left. Questions about a medicine? Ask your pharmacist or doctor.</p>`;
}
function hhMedCard(m) {
  const R = hhRefill(m), tone = HH_PILLS.includes(m.color) ? m.color : HH_PILLS[4], D = hhDoses(today()).filter(d => d.m.id === m.id);
  const pct = R.track && R.daily ? Math.min(100, R.days / 30 * 100) : 0;
  return `<article class="hh-med${R.soon ? " low" : ""}" style="--pill:${tone}"><div class="hh-med-top">${hhCap(m.color, "big")}<div class="grow"><b>${esc(m.name)}</b><small>${esc(m.strength || "")}</small></div>
      ${R.soon ? `<i class="hh-badge">${R.days <= 0 ? "REFILL NOW" : "REFILL SOON"}</i>` : ""}</div>
    <div class="hh-times">${m.times.length ? m.times.slice().sort().map(tm => { const d = D.find(x => x.time === tm); return `<span class="${d ? d.st : ""}">${hm(tm)}</span>`; }).join("") : `<span>as needed</span>`}</div>
    ${m.instr ? `<p class="hh-instr">“${esc(m.instr)}”</p>` : ""}
    ${R.track ? `<div class="hh-left"><div class="hh-left-top"><b>${R.left} pill${R.left === 1 ? "" : "s"} left</b>${R.days != null ? `<small>${R.days} day${R.days === 1 ? "" : "s"} · refill by ${hhDate(R.by)}</small>` : ""}</div>
        ${R.days != null ? `<i class="hh-track ${R.soon ? "low" : ""}"><span style="width:${pct.toFixed(0)}%"></span></i>` : ""}
        <form class="hh-refill" data-hhrefill="${m.id}"><input name="n" inputmode="numeric" placeholder="+ pills" aria-label="Pills picked up for ${esc(m.name)}"><button class="btn sm ghost">Refilled</button></form></div>`
      : `<p class="fine">Add "pills left" (✏️) and Health Hub counts down to your refill.</p>`}
    ${R.track && R.daily ? `<p class="fine hh-mathline">${R.left} ÷ (${+m.per > 0 ? +m.per : 1} per dose × ${m.times.length} a day) = ${R.days} day${R.days === 1 ? "" : "s"}</p>` : ""}
    <div class="hh-medmeta">${m.pharmacy ? `<span>🏪 ${esc(m.pharmacy)}</span>` : ""}${m.prescriber ? `<span>👩‍⚕️ ${esc(m.prescriber)}</span>` : ""}</div>
    ${m.notes ? `<details class="hh-notes"><summary>Notes</summary><p>${esc(m.notes)}</p></details>` : ""}
    <div class="hh-med-acts"><button class="btn sm ghost" data-hhmededit="${m.id}">✏️ Edit</button><button class="btn sm ghost" data-hhmedstop="${m.id}">Stopped taking it</button></div></article>`;
}
function hhMedForm() {
  const m = HH_EDIT === "new" ? {} : hh().meds.find(x => x.id === HH_EDIT) || {}, f = HH_SCAN ? HH_SCAN.f : {}, v = k => esc(f[k] != null && f[k] !== "" ? f[k] : m[k] != null ? m[k] : "");
  const times = (m.times && m.times.length ? m.times : HH_EDIT === "new" ? ["08:00"] : []).concat(["", "", "", ""]).slice(0, 4);
  const col = HH_PILLS.includes(m.color) ? m.color : HH_PILLS[4];
  return `${HH_SCAN ? `<div class="mv-shot hh-shot"><img src="${HH_SCAN.img}" alt="Your label photo"></div>
      <p class="hh-review">${HH_SCAN.read ? "✨ What the AI read - <b>check every field</b> against the label." : "✍️ Type what the label says."} Nothing is saved until you tap Save.</p>` : ""}
    <form class="qa-form hh-form" data-hhmed="${esc(HH_EDIT)}">
      <label class="field">Medicine name<input name="name" value="${v("name")}" placeholder="e.g. Lisinopril" required maxlength="60"></label>
      <label class="field">Strength (as on the label)<input name="strength" value="${v("strength")}" placeholder="e.g. 10 mg" maxlength="30"></label>
      <div class="field">Pill colour<div class="hh-swatches" role="radiogroup" aria-label="Pill colour">${HH_PILLS.map(c => `<label><input type="radio" name="color" value="${c}" ${c === col ? "checked" : ""}><span style="--pill:${c}" aria-label="${c}"></span></label>`).join("")}</div></div>
      <div class="field">Times you take it<div class="hh-timein">${times.map((tm, i) => `<input type="time" name="t${i + 1}" value="${esc(tm)}" aria-label="Time ${i + 1}">`).join("")}</div><small class="fine">Leave all empty for "as needed".</small></div>
      <label class="field">Instructions (copy them from the label)<textarea name="instr" rows="2" maxlength="200" placeholder="e.g. Take 1 tablet by mouth every morning">${v("instr")}</textarea></label>
      <div class="two"><label class="field">Pills per dose<input name="per" inputmode="decimal" value="${v("per") || 1}" aria-describedby="hhPerHelp"></label>
        <label class="field">Pills left<input name="left" inputmode="numeric" value="${v("left")}" placeholder="e.g. 30"></label></div>
      <small class="fine" id="hhPerHelp">Pills per dose is only for counting what's left - type what your label says.</small>
      <div class="two"><label class="field">Pharmacy<input name="pharmacy" value="${v("pharmacy")}" maxlength="60"></label><label class="field">Prescribed by<input name="prescriber" value="${v("prescriber")}" maxlength="60"></label></div>
      <label class="field">Notes (side effects to watch, what it's for…)<textarea name="notes" rows="2" maxlength="300">${v("notes")}</textarea></label>
      ${HH_SCAN ? `<label class="fine mv-check"><input type="checkbox" name="keep" checked><span>Keep the label photo in my Records vault</span></label>` : ""}
      <div class="foot-actions"><button class="btn hh-go">Save medicine</button><button class="btn ghost" type="button" data-hhmedcancel="1">Cancel</button></div></form>`;
}
function hhSaveMed(data) {
  const H = hh(), name = hhTxt(data.name, 60);
  if (!name) { HH_MSG = "Type the medicine's name."; hhMsgShow(); return; }
  const times = [...new Set([1, 2, 3, 4].map(i => data["t" + i]).filter(hhIsT).map(x => x.padStart(5, "0")))].sort();
  const left = String(data.left == null ? "" : data.left).trim() === "" ? "" : Math.max(0, Math.round(hhNum(data.left))), per = hhNum(data.per) > 0 ? Math.round(hhNum(data.per) * 100) / 100 : 1;
  const vals = { name, strength: hhTxt(data.strength, 30), color: HH_PILLS.includes(data.color) ? data.color : HH_PILLS[4], times, instr: hhTxt(data.instr, 200), per, left,
    pharmacy: hhTxt(data.pharmacy, 60), prescriber: hhTxt(data.prescriber, 60), notes: hhTxt(data.notes, 300) };
  const old = HH_EDIT !== "new" && H.meds.find(x => x.id === HH_EDIT);
  if (old) {
    const ch = [old.strength !== vals.strength ? `strength ${old.strength || "-"} → ${vals.strength || "-"}` : "", old.times.join() !== times.join() ? `times ${old.times.map(hm).join(", ") || "as needed"} → ${times.map(hm).join(", ") || "as needed"}` : ""].filter(Boolean);
    if (ch.length) H.medlog.push({ date: today(), text: `Changed ${name}: ${ch.join("; ")}` });
    Object.assign(old, vals);
  } else { H.meds.push({ id: uid(), ...vals, added: today(), addedT: nowT() }); H.medlog.push({ date: today(), text: `Started ${name}${vals.strength ? " " + vals.strength : ""}` }); }
  const img = HH_SCAN && data.keep ? HH_SCAN.img : null;
  HH_EDIT = null; HH_SCAN = null; HH_MSG = ""; save(); render(); showHh("meds"); toast(`💊 ${name} saved`);
  if (img) hhVaultPut({ type: "rx", title: `${name} label`, date: today(), img }).then(() => save()).catch(() => toast("(the label photo couldn't be kept here)"));
}

// ------------------------------------------------------------ APPOINTMENTS
function hhApptsHtml() {
  const t = today(), A = hhAppts().slice().sort(hhApSort), up = A.filter(a => a.date >= t), past = A.filter(a => a.date < t).reverse();
  return `<section class="hh-hero">${hhIc("🩺", "#a78bfa")}<div><h3>${up.length ? `${up.length} visit${up.length === 1 ? "" : "s"} coming up` : "Your doctor visits"}</h3>
      <p>Tap a visit to open it: your questions, what to bring, notes after, and a summary to hand the doctor.</p></div></section>
    ${HH_APADD ? hhApForm({}) : `<button class="btn hh-go hh-wide" data-hhapnew="1">＋ New appointment</button>`}
    ${up.map(hhApCard).join("") || (HH_APADD ? "" : `<p class="hos-hint">Nothing booked. Add your next visit and start your question list.</p>`)}
    ${past.length ? `<button class="mv-switch" data-hhpast="1">${HH_PAST ? "Hide" : "Show"} past visits (${past.length})</button>${HH_PAST ? past.map(hhApCard).join("") : ""}` : ""}`;
}
function hhApCard(a) {
  if (HH_APEDIT === a.id) return hhApForm(a);
  const open = HH_AP === a.id, n = daysUntil(a.date), q = a.q.filter(x => !x.done).length;
  return `<article class="hh-ap${open ? " open" : ""}${n < 0 ? " past" : ""}"><button class="hh-ap-head" data-hhap="${a.id}" aria-expanded="${open}">${hhApDate(a.date)}<span class="grow"><b>${esc(a.doctor || "Appointment")}</b>
      <small>${[a.specialty, a.time ? hm(a.time) : "", a.where].filter(Boolean).map(esc).join(" · ")}</small></span>
      <em class="${n >= 0 && n <= 1 ? "soon" : ""}">${n < 0 ? "past" : esc(hhRel(a.date))}</em></button>
    ${!open ? (q ? `<p class="hh-ap-peek">❓ ${q} question${q === 1 ? "" : "s"} to ask</p>` : "") : `<div class="hh-ap-body">
      ${a.reason ? `<p><b>Reason:</b> ${esc(a.reason)}</p>` : ""}
      <h4>❓ Questions to ask</h4>
      <div class="hh-qs">${a.q.map(x => `<div class="hh-q${x.done ? " done" : ""}"><button class="hh-qtick" data-hhapq="${a.id}|${x.id}" aria-pressed="${!!x.done}" aria-label="${x.done ? "Asked" : "Not asked yet"}: ${esc(x.text)}">${x.done ? "✓" : ""}</button>
          <span>${esc(x.text)}</span><button class="mv-x" data-hhapqdel="${a.id}|${x.id}" aria-label="Remove question">✕</button></div>`).join("") || `<p class="fine">No questions yet - add them as you think of them.</p>`}</div>
      <form class="hh-inline" data-hhapq="${a.id}"><input name="q" placeholder="Add a question…" maxlength="160" aria-label="New question"><button class="btn sm">Add</button></form>
      <h4>🎒 Bring</h4><p>${a.bring ? esc(a.bring) : `<span class="fine">Insurance card, medicine list, ID…</span>`}</p>
      <h4>📝 Notes &amp; follow-up</h4>
      <form class="hh-inline col" data-hhapnote="${a.id}"><textarea name="notes" rows="3" maxlength="1000" placeholder="What the doctor said, next steps, follow-up date…" aria-label="Notes">${esc(a.notes || "")}</textarea><button class="btn sm ghost">Save notes</button></form>
      <div class="hh-med-acts"><button class="btn sm hh-go" data-hhvisit="${a.id}">📋 Visit summary</button><button class="btn sm ghost" data-hhapedit="${a.id}">✏️ Edit</button><button class="btn sm ghost" data-hhapdel="${a.id}">🗑️ Delete</button></div></div>`}
  </article>`;
}
function hhApForm(a) {
  const v = k => esc(a[k] || "");
  return `<form class="qa-form hh-form hh-apform" data-hhapsave="${a.id || "new"}"><h4>${a.id ? "Edit appointment" : "New appointment"}</h4>
      <div class="two"><label class="field">Date<input type="date" name="date" value="${v("date") || today()}" required></label><label class="field">Time<input type="time" name="time" value="${v("time")}"></label></div>
      <div class="two"><label class="field">Doctor<input name="doctor" value="${v("doctor")}" placeholder="e.g. Dr. Patel" maxlength="60"></label><label class="field">Specialty<input name="specialty" value="${v("specialty")}" placeholder="e.g. Cardiology" maxlength="40"></label></div>
      <label class="field">Reason for the visit<input name="reason" value="${v("reason")}" maxlength="120"></label>
      <label class="field">Where<input name="where" value="${v("where")}" placeholder="Office or clinic" maxlength="80"></label>
      <label class="field">Bring<input name="bring" value="${v("bring")}" placeholder="Insurance card, medicine list, ID" maxlength="160"></label>
      ${a.id ? "" : `<label class="field">Questions to ask (one per line)<textarea name="qs" rows="3" maxlength="800"></textarea></label>`}
      <div class="foot-actions"><button class="btn hh-go">Save</button><button class="btn ghost" type="button" data-hhapcancel="1">Cancel</button></div></form>`;
}

// ------------------------------------------------------------ VITALS: gauges, a trend chart, general ranges
const HH_GAUGE = { bp: [70, 200, [[70, 90, "caution"], [90, 120, "good"], [120, 130, "caution"], [130, 180, "check"], [180, 200, "seek"]]],
  gluF: [40, 250, [[40, 70, "check"], [70, 100, "good"], [100, 126, "caution"], [126, 250, "check"]]], gluA: [40, 300, [[40, 70, "check"], [70, 140, "good"], [140, 200, "caution"], [200, 300, "check"]]],
  hr: [30, 160, [[30, 60, "caution"], [60, 101, "good"], [101, 160, "caution"]]], spo2: [80, 100, [[80, 90, "check"], [90, 95, "caution"], [95, 100, "good"]]] };
const HH_REFS = { bp: [120, 80], glucose: [100], hr: [60, 100], spo2: [95], weight: [] };
function hhGauge(k, r) {
  const G = k === "glucose" ? HH_GAUGE[r && r.fast === false ? "gluA" : "gluF"] : HH_GAUGE[k];
  if (!G) return "";
  const [lo, hi, segs] = G, cx = 100, cy = 104, R = 80, val = r ? +(k === "bp" ? r.sys : r.v) : null;
  const ang = v => Math.PI * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)), pt = (a, rr) => [(cx + rr * Math.cos(a)).toFixed(1), (cy - rr * Math.sin(a)).toFixed(1)];
  const arc = (a0, a1) => { const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R); return `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`; };
  const b = hhBand(r), [nx, ny] = val == null ? [cx, cy] : pt(ang(val), R - 18);
  return `<svg class="hh-gauge" viewBox="0 0 200 122" role="img" aria-label="${esc(hhVK(k)[2])}: ${r ? esc(hhVUnit(r)) + (b.label ? ", " + esc(b.label) : "") : "no reading yet"}">
    <path d="${arc(Math.PI, 0)}" stroke="#12324a" stroke-width="16" fill="none" stroke-linecap="round"/>
    ${segs.map(([a, z, bk]) => `<path d="${arc(ang(a), ang(z))}" stroke="${HH_BANDS[bk][0]}" stroke-width="12" fill="none" opacity="${b.k === bk ? 1 : .45}"/>`).join("")}
    ${val == null ? "" : `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#fff" stroke-width="4" stroke-linecap="round" class="hh-needle"/>`}
    <circle cx="${cx}" cy="${cy}" r="7" fill="#e6fffb"/>
    <text x="${pt(Math.PI, R)[0]}" y="120" class="hh-gax" text-anchor="middle">${lo}</text><text x="${pt(0, R)[0]}" y="120" class="hh-gax" text-anchor="middle">${hi}</text></svg>`;
}
function hhChart(k) {
  const R = hhReads(k).slice(-30), name = hhVK(k)[2];
  if (R.length < 2) return `<p class="hos-hint">Log 2 or more ${esc(name.toLowerCase())} readings and your trend draws itself here.</p>`;
  const W = 340, H = 160, L = 34, Rt = 10, Tp = 12, B = 22, n = R.length;
  const series = k === "bp" ? [["sys", "#2dd4bf", "Top number"], ["dia", "#a78bfa", "Bottom number"]] : [["v", "#22d3ee", name]];
  const refs = HH_REFS[k] || [], vals = R.flatMap(r => series.map(s => +r[s[0]] || 0));
  let lo = Math.min(...vals, ...refs), hi = Math.max(...vals, ...refs); const pad = (hi - lo) * .12 || 5; lo -= pad; hi += pad;
  const x = i => L + i / (n - 1) * (W - L - Rt), y = v => Tp + (hi - v) / (hi - lo) * (H - Tp - B);
  const path = f => R.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(+r[f]).toFixed(1)}`).join(" ");
  const ticks = [hi, (hi + lo) / 2, lo].map(v => Math.round(v));
  return `${series.length > 1 ? `<div class="mv-legend">${series.map(s => `<span><i style="background:${s[1]}"></i>${s[2]}</span>`).join("")}</div>` : ""}
    <div class="mv-chart hh-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}: ${n} readings from ${hhDate(R[0].date)} to ${hhDate(R[n - 1].date)}">
      ${ticks.map(v => `<line x1="${L}" x2="${W - Rt}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="mv-grid"/><text x="${L - 5}" y="${(y(v) + 3).toFixed(1)}" class="mv-ax" text-anchor="end">${v}</text>`).join("")}
      ${refs.map(v => `<line x1="${L}" x2="${W - Rt}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="hh-ref"/><text x="${W - Rt}" y="${(y(v) - 3).toFixed(1)}" class="hh-reft" text-anchor="end">${v}</text>`).join("")}
      ${series.map(s => `<path d="${path(s[0])}" fill="none" stroke="${s[1]}" stroke-width="2.4" stroke-linejoin="round" class="hh-line"/>`).join("")}
      ${R.map((r, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(+r[series[0][0]]).toFixed(1)}" r="3.6" fill="${HH_BANDS[hhBand(r).k][0]}" stroke="#061528" stroke-width="1"/>`).join("")}
      ${[0, n - 1].map(i => `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="mv-ax" text-anchor="${i ? "end" : "start"}">${parseDay(R[i].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>`).join("")}</svg></div>
    <p class="fine hh-center">Dots are coloured by the general range. Dashed lines: ${refs.length ? refs.join(" and ") : "none"}${k === "glucose" ? " (fasting)" : ""}.</p>`;
}
const HH_RANGES = {
  bp: ["Under 120 and under 80: normal", "120-129 and under 80: elevated", "130 or higher, or 80 or higher: high", "180 or higher, or 120 or higher: talk to your doctor", "Under 90/60: lower than typical", "Source: American Heart Association categories; NIH for low"],
  glucose: ["Fasting: 70-99 typical · 100-125 above typical · 126 or higher high", "Any time: under 140 typical (2 hours after eating) · 140-199 above · 200 or higher high", "Under 70: low", "Source: American Diabetes Association"],
  hr: ["At rest: 60-100 beats a minute is typical", "Lower can be normal for very active people", "Source: American Heart Association"],
  spo2: ["95-100%: typical", "90-94%: below typical", "Under 90%: low - contact your doctor", "Home oximeters can read lower on cold hands or darker skin"],
  weight: ["No range here - weight that's healthy for you depends on your height and more. Your trend is the useful part."] };
function hhVitalsHtml() {
  const k = HH_VK, V = hhLatestAll(), r = V[k], b = hhBand(r), [, icon, name, unit] = hhVK(k), A7 = hhAvg(k, 7), A30 = hhAvg(k, 30), all = hhReads(k);
  const now = nowT(), seek = r && b.k === "seek";
  const w30 = k === "weight" && all.length > 1 ? (() => { const old = all.filter(x => x.date <= addDays(today(), -30)).slice(-1)[0] || all[0]; return Math.round((+r.v - +old.v) * 10) / 10; })() : null;
  const form = k === "bp" ? `<div class="two"><input name="sys" inputmode="numeric" placeholder="Top (systolic)" required aria-label="Top number (systolic)"><input name="dia" inputmode="numeric" placeholder="Bottom (diastolic)" required aria-label="Bottom number (diastolic)"></div>`
    : `<input name="v" inputmode="decimal" placeholder="${esc(name)} (${unit})" required aria-label="${esc(name)} in ${unit}">${k === "glucose" ? `<label class="fine mv-check"><input type="checkbox" name="fast" checked><span>Fasting (nothing to eat for 8 hours)</span></label>` : ""}`;
  return `<div class="hh-vtiles" role="group" aria-label="Pick a vital">${HH_VITALS.map(([kk, ic, nm]) => { const x = V[kk], bb = hhBand(x);
      return `<button class="hh-vtile${kk === k ? " on" : ""}" data-hhvk="${kk}" aria-pressed="${kk === k}" style="--tone:${HH_BANDS[bb.k][0]}"><span aria-hidden="true">${ic}</span><b>${x ? esc(hhVal(x)) : "–"}</b><small>${{ bp: "BP", glucose: "Glucose", weight: "Weight", hr: "Heart", spo2: "Oxygen" }[kk]}</small>${x && bb.k !== "none" ? "<i></i>" : ""}</button>`; }).join("")}</div>
    <section class="hh-vhero" style="--tone:${HH_BANDS[b.k][0]}">${k === "weight" ? `<div class="hh-wbig"><span aria-hidden="true">⚖️</span><b>${r ? esc(r.v) : "–"}</b><small>${unit}</small></div>` : hhGauge(k, r)}
      <div class="hh-vread"><small>${icon} ${esc(name)}${r ? ` · ${esc(hhRel(r.date))}${r.time ? " " + hm(r.time) : ""}` : ""}</small><b>${r ? esc(hhVUnit(r)) : "No reading yet"}</b>
        ${r && b.label ? `<span class="hh-band ${b.k}">${esc(b.label)}</span><em>General range: ${esc(b.why)}</em>` : ""}
        ${w30 != null ? `<em>${w30 === 0 ? "Same as" : w30 > 0 ? `▲ ${w30} ${unit} vs` : `▼ ${-w30} ${unit} vs`} about 30 days ago</em>` : ""}</div></section>
    ${seek ? `<div class="hh-seek" role="alert"><b>⚠️ This reading is in the "talk to your doctor" range.</b> Wait 5 minutes and measure again. If it is still this high, contact your doctor right away.
      If you also have chest pain, shortness of breath, back pain, numbness or weakness, a change in vision or trouble speaking, <b>call 911</b>.</div>` : ""}
    <p class="hh-advline">ℹ️ ${HH_ADV}</p>
    <h3 class="mv-h">＋ Add a ${esc(name.toLowerCase())} reading</h3>
    <form class="qa-form hh-form" data-hhvital="${k}">${form}
      <div class="two"><input type="date" name="date" value="${today()}" max="${today()}" aria-label="Date"><input type="time" name="time" value="${now}" aria-label="Time"></div><button class="btn hh-go">Save reading</button></form>
    <div class="mv-tiles3 hh-tiles3"><div><small>Latest</small><b>${r ? esc(hhVal(r)) : "–"}</b></div><div><small>7-day average</small><b>${hhAvgTxt(k, A7)}</b><em>${A7.n} reading${A7.n === 1 ? "" : "s"}</em></div><div><small>30-day average</small><b>${hhAvgTxt(k, A30)}</b><em>${A30.n} reading${A30.n === 1 ? "" : "s"}</em></div></div>
    <h3 class="mv-h">📈 Trend</h3>${hhChart(k)}
    ${all.length ? `<h3 class="mv-h">Recent readings</h3><div class="hh-reads">${all.slice(-8).reverse().map(x => { const bb = hhBand(x);
        return `<div class="hh-read"><i style="background:${HH_BANDS[bb.k][0]}"></i><b>${esc(hhVUnit(x))}</b><small>${esc(hhRel(x.date))}${x.time ? " " + hm(x.time) : ""}${x.kind === "glucose" ? (x.fast === false ? " · any time" : " · fasting") : ""}${bb.label ? " · " + esc(bb.label) : ""}</small>
          <button class="mv-x" data-hhvdel="${x.id}" aria-label="Remove this reading">✕</button></div>`; }).join("")}</div>` : ""}
    <details class="hh-ranges"><summary>General ranges for ${esc(name.toLowerCase())}</summary><ul>${HH_RANGES[k].map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>
    <p class="fine">Averages = every reading in the window added up ÷ how many. ${HH_ADV}</p>`;
}

// ------------------------------------------------------------ MOVEMENT & GYM
function hhWeekBars(f, goal, fmt, tone) {
  const days = [6, 5, 4, 3, 2, 1, 0].map(k => addDays(today(), -k)), L = days.map(d => ({ d, v: f(d) })), hi = Math.max(goal || 0, ...L.map(x => x.v), 1);
  return `<div class="hh-bars" role="img" aria-label="Last 7 days: ${L.map(x => `${hhWk(x.d)} ${fmt(x.v)}`).join(", ")}">${L.map(x => `<div class="hh-bar${x.d === today() ? " now" : ""}">
      <em>${x.v ? fmt(x.v) : ""}</em><div class="hh-btrack">${goal ? `<i class="hh-goal" style="bottom:${(goal / hi * 100).toFixed(1)}%"></i>` : ""}<span style="height:${(x.v / hi * 100).toFixed(1)}%;--tone:${goal && x.v >= goal ? "#4ade80" : tone}"></span></div>
      <small>${hhWk(x.d).slice(0, 2)}</small></div>`).join("")}</div>`;
}
function hhMoveHtml() {
  const t = today(), g = hhGoals(), st = hhSteps(t), sk = hhStreak(t), W = hh().workouts.slice().sort((a, b) => b.date.localeCompare(a.date)), wm = hhWorkMin(t);
  return `<section class="hh-hero">${hosRing(st / Math.max(1, g.steps) * 100, st ? hhK(st) : "0", `of ${hhK(g.steps)} steps`, "#6ee7b7")}
      <div><h3>${st >= g.steps ? "Step goal reached 🎉" : st ? `${(g.steps - st).toLocaleString("en-US")} steps to go` : "Log today's steps"}</h3>
      <p>🔥 <b>${sk}</b> day${sk === 1 ? "" : "s"} in a row${wm ? ` · 🏋️ ${wm} min of workouts today` : ""}</p></div></section>
    <form class="hh-inline" data-hhsteps="1"><input name="steps" inputmode="numeric" placeholder="Steps today, e.g. 4200" aria-label="Steps today" value="${st || ""}"><input type="date" name="date" value="${t}" max="${t}" aria-label="Day"><button class="btn sm hh-go">Save</button></form>
    <p class="fine">📱 Type them from your phone's health app or watch for now - automatic steps come with the store app.</p>
    <h3 class="mv-h">This week</h3>${hhWeekBars(hhSteps, g.steps, hhK, "#2dd4bf")}
    <p class="fine hh-center">Green = goal met. Dashed line = your goal (${(+g.steps).toLocaleString("en-US")}). Streak = days in a row with the goal met or a workout.</p>
    <h3 class="mv-h">🏋️ Log a workout</h3>
    <form class="qa-form hh-form" data-hhwork="1"><div class="two"><select name="type" aria-label="Kind of workout">${HH_WORK.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select>
        <input name="min" inputmode="numeric" placeholder="Minutes" required aria-label="Minutes"></div>
      <div class="hpv-row"><input name="sets" inputmode="numeric" placeholder="Sets" aria-label="Sets (optional)"><input name="reps" inputmode="numeric" placeholder="Reps" aria-label="Reps (optional)"><input name="wt" inputmode="decimal" placeholder="Weight lb" aria-label="Weight (optional)"></div>
      <div class="two"><input name="note" placeholder="Note (optional)" maxlength="80" aria-label="Note"><input type="date" name="date" value="${t}" max="${t}" aria-label="Day"></div><button class="btn hh-go">Add workout</button></form>
    <div class="hh-works">${W.slice(0, 12).map(w => { const k = HH_WORK.find(x => x[0] === w.type) || HH_WORK[7];
      return `<div class="hh-work">${hhIc(k[1], "#6ee7b7", "sm")}<div class="grow"><b>${esc(k[2])} · ${w.min} min</b><small>${esc(hhRel(w.date))}${w.sets ? ` · ${w.sets}×${w.reps || "?"}` : ""}${w.wt ? ` @ ${w.wt} lb` : ""}${w.note ? " · " + esc(w.note) : ""}</small></div>
        <button class="mv-x" data-hhwdel="${w.id}" aria-label="Remove workout">✕</button></div>`; }).join("") || `<p class="hos-hint">Walks, the gym, a bike ride - every one counts toward your streak.</p>`}</div>`;
}

// ------------------------------------------------------------ SLEEP
function hhSleepStats() {
  const L = hh().sleep.slice().sort((a, b) => a.date.localeCompare(b.date)), wk = L.filter(x => x.date > addDays(today(), -7));
  const avg = wk.length ? wk.reduce((n, x) => n + x.hrs, 0) / wk.length : 0;
  const beds = wk.map(x => { let m = hhMin(x.bed); if (m < 720) m += 1440; return m; }), mb = beds.length ? beds.reduce((a, b) => a + b, 0) / beds.length : 0;
  const sd = beds.length > 1 ? Math.round(Math.sqrt(beds.reduce((n, m) => n + (m - mb) ** 2, 0) / beds.length)) : null;
  const best = L.filter(x => x.date > addDays(today(), -30)).slice().sort((a, b) => (+b.q || 0) - (+a.q || 0) || Math.abs(a.hrs - hhGoals().sleep) - Math.abs(b.hrs - hhGoals().sleep))[0] || null;
  return { L, wk, avg: Math.round(avg * 10) / 10, sd, best };
}
function hhSleepHtml() {
  const t = today(), g = hhGoals(), last = hh().sleep.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0], Z = hhSleepStats();
  const steady = Z.sd == null ? "–" : Z.sd <= 30 ? "Very steady" : Z.sd <= 60 ? "Fairly steady" : "All over";
  return `<section class="hh-moon"><svg viewBox="0 0 340 120" class="hh-moon-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="hhNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1440"/><stop offset="1" stop-color="#2a1f5c"/></linearGradient></defs>
      <rect width="340" height="120" fill="url(#hhNight)"/>${[[30, 20], [70, 50], [120, 18], [170, 40], [220, 14], [300, 60], [260, 34], [90, 90], [200, 92], [320, 22]].map(([x, y], i) => `<circle class="mv-star" style="--d:${(i * .3).toFixed(1)}s" cx="${x}" cy="${y}" r="${i % 3 ? 1.2 : 1.8}" fill="#fff"/>`).join("")}
      <circle cx="282" cy="56" r="26" fill="#fff4d6"/><circle cx="294" cy="48" r="23" fill="url(#hhNight)"/></svg>
      <div class="hh-moon-in"><small>Last night${last ? ` · ${esc(hhRel(last.date))}` : ""}</small><b>${last ? hhFmtH(last.hrs) : "–"}</b>
        <span>${last ? `${hm(last.bed)} → ${hm(last.wake)} · ${"🌕".repeat(+last.q || 0)}${"🌑".repeat(5 - (+last.q || 0))}` : "Log your first night below"}</span></div></section>
    <h3 class="mv-h">＋ Log a night</h3>
    <form class="qa-form hh-form" data-hhsleep="1"><div class="two"><label class="field">Bedtime<input type="time" name="bed" value="23:00" required></label><label class="field">Woke up<input type="time" name="wake" value="07:00" required></label></div>
      <label class="field">Morning of<input type="date" name="date" value="${t}" max="${t}"></label>
      <div class="field">How well did you sleep?<div class="hh-moons" role="radiogroup" aria-label="Sleep quality">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="q" value="${n}" ${n === 3 ? "checked" : ""}><span aria-label="${n} of 5">${n <= 2 ? "🌘" : n === 3 ? "🌗" : n === 4 ? "🌖" : "🌕"}<small>${["Bad", "Poor", "Okay", "Good", "Great"][n - 1]}</small></span></label>`).join("")}</div></div>
      <input name="note" placeholder="Note: naps, snoring, woke up a lot… (optional)" maxlength="100" aria-label="Note"><button class="btn hh-go">Save night</button></form>
    <h3 class="mv-h">This week</h3>${hhWeekBars(d => (hhSleepOn(d) || { hrs: 0 }).hrs, g.sleep, h => `${Math.round(h * 10) / 10}h`, "#a78bfa")}
    <div class="mv-tiles3 hh-tiles3"><div><small>Average · 7 nights</small><b>${Z.wk.length ? hhFmtH(Z.avg) : "–"}</b><em>goal ${g.sleep}h</em></div>
      <div><small>Consistency</small><b>${steady}</b><em>${Z.sd == null ? "2+ nights" : `bedtime ±${Z.sd} min`}</em></div>
      <div><small>Best night · 30 days</small><b>${Z.best ? hhFmtH(Z.best.hrs) : "–"}</b><em>${Z.best ? `${esc(hhRel(Z.best.date))} · ${Z.best.q}/5` : ""}</em></div></div>
    <div class="hh-works">${Z.L.slice(-10).reverse().map(x => `<div class="hh-work">${hhIc("🌙", "#a78bfa", "sm")}<div class="grow"><b>${hhFmtH(x.hrs)} · ${x.q}/5</b><small>${esc(hhRel(x.date))} · ${hm(x.bed)} → ${hm(x.wake)}${x.note ? " · " + esc(x.note) : ""}</small></div>
        <button class="mv-x" data-hhsdel="${x.id}" aria-label="Remove night">✕</button></div>`).join("")}</div>
    <p class="fine">Hours = wake time − bedtime, across midnight (11:30 PM → 7:00 AM = 7h 30m). Consistency = how much your bedtime moves around this week (the standard deviation). Best night = your highest-rated, then closest to your goal.</p>`;
}

// ------------------------------------------------------------ WATER: a bottle that fills
function hhBottle(n, goal) {
  const f = Math.min(1, n / Math.max(1, goal)), y = (238 - 198 * f).toFixed(1), shape = "M50 10H90V30C90 40 112 46 112 68V218C112 230 104 238 92 238H48C36 238 28 230 28 218V68C28 46 50 40 50 30Z";
  const g = Math.min(12, goal);
  return `<svg class="hh-bottle" viewBox="0 0 140 250" role="img" aria-label="${n} of ${goal} glasses"><defs><clipPath id="hhBclip"><path d="${shape}"/></clipPath>
      <linearGradient id="hhWat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs>
    <g clip-path="url(#hhBclip)"><rect width="140" height="250" fill="rgba(103,232,249,.07)"/>
      ${f > 0 ? `<path class="hh-wave" d="M-60 ${y} q15 -7 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V260 H-60Z" fill="url(#hhWat)"/>` : ""}
      ${[...Array(g - 1)].map((_, i) => `<line x1="100" x2="112" y1="${(238 - 198 * (i + 1) / g).toFixed(1)}" y2="${(238 - 198 * (i + 1) / g).toFixed(1)}" stroke="#bff6ff" stroke-opacity=".35" stroke-width="2"/>`).join("")}</g>
    <path d="${shape}" fill="none" stroke="#9ff3ff" stroke-width="3"/><rect x="47" y="2" width="46" height="12" rx="4" fill="#2dd4bf"/>
    <ellipse cx="46" cy="120" rx="6" ry="40" fill="#fff" opacity=".12"/></svg>`;
}
function hhWaterHtml() {
  const t = today(), g = hhGoals(), n = hhWater(t);
  return `<section class="hh-water">${hhBottle(n, g.water)}<div class="hh-water-in"><b>${n}<small> of ${g.water}</small></b><span>glasses today</span>
      <em>${n >= g.water ? "Goal reached 🎉" : `${g.water - n} to go`}</em>
      <div class="hh-wbtns"><button class="hh-wminus" data-hhwater="-1" aria-label="One glass less">−</button><button class="hh-wplus" data-hhwater="1" aria-label="Add a glass">＋ 1 glass</button></div></div></section>
    <h3 class="mv-h">This week</h3>${hhWeekBars(hhWater, g.water, v => String(v), "#22d3ee")}
    <p class="fine">A glass = about 8 oz (250 ml). Change your goal in <button class="mv-linkb hh-link" data-hhtab="goals">Daily goals</button> - your doctor may want a different amount for you.</p>`;
}

// ------------------------------------------------------------ DAILY CHECK-IN: mood, energy, symptoms
function hhCheckinHtml() {
  const t = today(), C = hh().checkins[t] || {}, sy = Array.isArray(C.sym) ? C.sym : [];
  const days = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(k => addDays(t, -k));
  return `<h3 class="mv-h">How are you feeling today?</h3>
    <div class="hh-faces" role="group" aria-label="Mood">${HH_MOODS.map(([n, i, l]) => `<button class="hh-face${C.mood === n ? " on" : ""}" data-hhmood="${n}" aria-pressed="${C.mood === n}"><span aria-hidden="true">${i}</span>${l}</button>`).join("")}</div>
    <h3 class="mv-h">Energy</h3>
    <div class="hh-faces" role="group" aria-label="Energy">${HH_ENERGY.map(([n, i, l]) => `<button class="hh-face${C.energy === n ? " on" : ""}" data-hhenergy="${n}" aria-pressed="${C.energy === n}"><span aria-hidden="true">${i}</span>${l}</button>`).join("")}</div>
    <h3 class="mv-h">Anything bothering you? <small class="fine">tap all that fit</small></h3>
    <div class="hh-syms" role="group" aria-label="Symptoms">${HH_SYMS.map(([k, i, l]) => `<button class="hh-sym${sy.includes(k) ? " on" : ""}" data-hhsym="${k}" aria-pressed="${sy.includes(k)}"><span aria-hidden="true">${i}</span>${l}</button>`).join("")}</div>
    <form class="hh-inline" data-hhcheck="1"><input name="note" value="${esc(C.note || "")}" placeholder="A note for today (optional)" maxlength="200" aria-label="Note"><button class="btn sm ghost">Save</button></form>
    <h3 class="mv-h">Last 2 weeks</h3>
    <div class="hh-strip">${days.map(d => { const c = hh().checkins[d] || {}, m = HH_MOODS.find(x => x[0] === c.mood);
      return `<div class="${d === t ? "now" : ""}"><span>${m ? m[1] : "·"}</span><small>${hhWk(d).slice(0, 1)}</small>${(c.sym || []).length ? `<i>${c.sym.length}</i>` : ""}</div>`; }).join("")}</div>
    <p class="fine">Saved for today as you tap. The little number = symptoms that day. Patterns over time are handy at your next visit (📋 Visit summary).</p>`;
}

// ------------------------------------------------------------ RECORDS VAULT (IndexedDB on this phone; the list in S.hh.vault)
const hhDb = () => new Promise((ok, no) => { const r = indexedDB.open("healthhub.vault", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("docs"); r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ok(r.result); }; r.onerror = () => no(r.error); });   // v1.57: let Erase delete it
const hhIdb = async (mode, fn) => { const db = await hhDb(); return new Promise((ok, no) => { const t = db.transaction("docs", mode), s = t.objectStore("docs"), r = fn(s);
  t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
async function hhVaultPut(d) {
  const id = uid(); await hhIdb("readwrite", s => s.put(d.img, id));
  hh().vault.unshift({ id, type: d.type, title: d.title, date: d.date }); return id;
}
const hhVaultGet = id => hhIdb("readonly", s => s.get(id));
async function hhShrink(file, max) {
  const url = URL.createObjectURL(file);
  try { const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("not a photo")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", .82);
  } finally { URL.revokeObjectURL(url); }
}
function hhVaultHtml() {
  const V = hh().vault;
  return `<div class="mv-banner hh-banner">${hhIc("🗂️", "#2dd4bf")}<div><b>Records vault</b><small>Insurance card, prescriptions, lab results, visit notes. Kept on this phone only - never in the backup.</small></div></div>
    <div class="hos-chips">${HH_DOCS.map(([k, i, l]) => [k, i, l, V.filter(v => v.type === k).length]).filter(x => x[3]).map(([k, i, l, n]) => `<span class="mv-count">${i} ${l} <b>${n}</b></span>`).join("")}</div>
    <form class="hh-inline" onsubmit="return false"><select data-hhvt="1" aria-label="Kind of record">${HH_DOCS.map(([k, i, l]) => `<option value="${k}" ${HH_VT === k ? "selected" : ""}>${i} ${l}</option>`).join("")}</select>
      <label class="btn sm hh-go">📷 Add a photo<input type="file" accept="image/*" data-hhvault="1" hidden></label></form>
    <div class="mv-vault">${V.map(v => `<figure class="mv-doc"><button data-hhbig="${v.id}" aria-label="Open ${esc(v.title)}"><img data-hhthumb="${v.id}" alt=""><span aria-hidden="true">${hhDoc(v.type)[1]}</span></button>
        <figcaption><b>${esc(v.title)}</b><small>${hhDate(v.date)}</small></figcaption><button class="mv-x" data-hhvvdel="${v.id}" aria-label="Delete ${esc(v.title)}">✕</button></figure>`).join("")
      || `<p class="hos-hint">Nothing here yet. Snap your insurance card first - it's the one you'll need most.</p>`}</div>
    ${HH_BIG ? `<div class="mv-big-img"><img data-hhthumb="${HH_BIG}" alt="Saved record"><button class="btn sm ghost" data-hhbig="">Close</button></div>` : ""}`;
}
async function hhThumbs() {
  for (const im of document.querySelectorAll("#hhSheet img[data-hhthumb]")) { try { const d = await hhVaultGet(im.dataset.hhthumb); if (d) im.src = d; } catch (e) { /* private mode */ } }
}

// ------------------------------------------------------------ EMERGENCY CARD + "Show my health info"
function hhCardHtml() {
  const C = hh().card, M = hhMeds();
  return `<button class="hh-sosbtn big" data-hhsos="1">🆘 Show my health info</button>
    <p class="fine hh-center">One big screen for an emergency - show it to a paramedic, nurse or anyone helping you.</p>
    <form class="qa-form hh-form" data-hhcard="1">
      <label class="field">⚠️ Allergies<textarea name="allergies" rows="2" maxlength="300" placeholder="e.g. Penicillin (hives), peanuts">${esc(C.allergies)}</textarea></label>
      <label class="field">Conditions<textarea name="conditions" rows="2" maxlength="300" placeholder="e.g. High blood pressure, type 2 diabetes">${esc(C.conditions)}</textarea></label>
      <div class="two"><label class="field">Blood type<select name="blood"><option value="">-</option>${HH_BLOOD.map(b => `<option ${C.blood === b ? "selected" : ""}>${b}</option>`).join("")}</select></label>
        <label class="field">Preferred hospital<input name="hospital" value="${esc(C.hospital)}" maxlength="80"></label></div>
      <label class="field">Primary doctor (name and phone)<input name="doctor" value="${esc(C.doctor)}" maxlength="100" placeholder="e.g. Dr. Patel 501-555-0100"></label>
      <label class="field">Other notes for helpers<textarea name="notes" rows="2" maxlength="300" placeholder="e.g. Pacemaker, hard of hearing, organ donor">${esc(C.notes)}</textarea></label>
      <button class="btn hh-go">Save card</button></form>
    <h3 class="mv-h">📞 Emergency contacts</h3>
    <div class="hh-works">${C.contacts.map((c, i) => `<div class="hh-work">${hhIc("📞", "#fb7185", "sm")}<div class="grow"><b>${esc(c.name)}</b><small>${esc(c.rel || "")}${c.rel && c.phone ? " · " : ""}${esc(c.phone || "")}</small></div>
        <button class="mv-x" data-hhcdel="${i}" aria-label="Remove ${esc(c.name)}">✕</button></div>`).join("") || `<p class="fine">Add the people to call.</p>`}</div>
    ${C.contacts.length < 4 ? `<form class="qa-form hh-form" data-hhcontact="1"><div class="hpv-row"><input name="name" placeholder="Name" required maxlength="40" aria-label="Contact name"><input name="rel" placeholder="Who (e.g. Son)" maxlength="30" aria-label="Relationship">
        <input name="phone" type="tel" placeholder="Phone" maxlength="30" aria-label="Phone"></div><button class="btn sm">Add contact</button></form>` : ""}
    <h3 class="mv-h">💊 Medicines on the card</h3>
    <p class="fine">${M.length ? M.map(m => esc(`${m.name}${m.strength ? " " + m.strength : ""}`)).join(" · ") + " - straight from your medicine list." : "Your medicine list fills this in automatically."}</p>`;
}
function hhSosHtml() {
  const C = hh().card, M = hhMeds(), tel = p => String(p || "").replace(/[^\d+]/g, "");
  return `<div class="hh-sos-in"><div class="hh-sos-top"><b>🆘 MY HEALTH INFO</b><button class="hh-sos-x" data-hhsosclose="1">✕ Close</button></div>
    <h1>${esc(S.name || "My health info")}</h1>
    ${C.blood ? `<div class="hh-sos-blood"><small>Blood type</small><b>${esc(C.blood)}</b></div>` : ""}
    <section class="hh-sos-al"><small>⚠️ ALLERGIES</small><b>${esc(C.allergies || "None listed")}</b></section>
    <section><small>CONDITIONS</small><b>${esc(C.conditions || "None listed")}</b></section>
    <section><small>MEDICINES</small>${M.length ? `<ul>${M.map(m => `<li><b>${esc(m.name)}${m.strength ? " " + esc(m.strength) : ""}</b>${m.times.length ? ` · ${m.times.map(hm).join(", ")}` : " · as needed"}${m.instr ? `<br><span>${esc(m.instr)}</span>` : ""}</li>`).join("")}</ul>` : "<b>None listed</b>"}</section>
    <section><small>EMERGENCY CONTACTS</small>${C.contacts.length ? C.contacts.map(c => `<p><b>${esc(c.name)}</b>${c.rel ? ` (${esc(c.rel)})` : ""} ${c.phone ? `<a href="tel:${esc(tel(c.phone))}">${esc(c.phone)}</a>` : ""}</p>`).join("") : "<b>None listed</b>"}</section>
    ${C.doctor ? `<section><small>DOCTOR</small><b>${esc(C.doctor)}</b></section>` : ""}${C.hospital ? `<section><small>PREFERRED HOSPITAL</small><b>${esc(C.hospital)}</b></section>` : ""}
    ${C.notes ? `<section><small>NOTES</small><b>${esc(C.notes)}</b></section>` : ""}
    <p class="hh-sos-foot">From Health Hub on this phone · typed by the owner</p></div>`;
}
function hhSos(on) {
  let el = document.getElementById("hhSos");
  if (!on) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "hhSos"; el.className = "hh-sos"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "My health info"); document.body.appendChild(el); }
  el.innerHTML = hhSosHtml();
}

// ------------------------------------------------------------ DOCTOR-VISIT SUMMARY (on the phone, no AI)
function hhVisitData(a) {
  const t = today(), from = addDays(t, -29), H = hh();
  const vit = HH_VITALS.map(([k, , name, unit]) => { const A = hhAvg(k, 30), L = hhLatest(k); return A.n ? { k, name, unit, avg: hhAvgTxt(k, A), n: A.n, latest: L } : null; }).filter(Boolean);
  const ch = H.medlog.filter(x => x.date >= addDays(t, -90));
  const cks = Object.entries(H.checkins).filter(([d]) => d >= addDays(t, -13)), moods = cks.map(([, c]) => +c.mood).filter(Boolean), en = cks.map(([, c]) => +c.energy).filter(Boolean);
  const sc = {}; cks.forEach(([, c]) => (c.sym || []).forEach(s => { sc[s] = (sc[s] || 0) + 1; }));
  const doses = [...Array(14)].map((_, i) => hhDoses(addDays(t, -i - 1))).flat(), takenPct = doses.length ? Math.round(doses.filter(d => d.st === "taken").length / doses.length * 100) : null;
  const sl = H.sleep.filter(x => x.date >= addDays(t, -13)), slAvg = sl.length ? Math.round(sl.reduce((n, x) => n + x.hrs, 0) / sl.length * 10) / 10 : null;
  return { a, from, vit, ch, cks, mood: moods.length ? Math.round(moods.reduce((x, y) => x + y, 0) / moods.length * 10) / 10 : null, energy: en.length ? Math.round(en.reduce((x, y) => x + y, 0) / en.length * 10) / 10 : null,
    syms: Object.entries(sc).sort((x, y) => y[1] - x[1]), takenPct, nDoses: doses.length, slAvg, nSleep: sl.length };
}
function hhVisitHtml(a) {
  const V = hhVisitData(a), C = hh().card, sym = k => (HH_SYMS.find(x => x[0] === k) || [k, "", k])[2];
  return `<div class="hh-sum"><h1>Visit summary${S.name ? ` - ${esc(S.name)}` : ""}</h1>
    <p>${a ? `${esc(a.doctor || "Appointment")}${a.specialty ? `, ${esc(a.specialty)}` : ""} · ${hhDate(a.date)}${a.time ? " " + hm(a.time) : ""}${a.reason ? ` · ${esc(a.reason)}` : ""}` : `Prepared ${hhDate(today())}`}</p>
    ${C.allergies ? `<p><b>Allergies:</b> ${esc(C.allergies)}</p>` : ""}${C.conditions ? `<p><b>Conditions:</b> ${esc(C.conditions)}</p>` : ""}
    <h2>Vitals - last 30 days</h2>${V.vit.length ? `<ul>${V.vit.map(x => `<li><b>${esc(x.name)}:</b> average ${esc(x.avg)} ${x.unit} (${x.n} reading${x.n === 1 ? "" : "s"}); latest ${esc(hhVal(x.latest))} on ${hhDate(x.latest.date)}</li>`).join("")}</ul>` : "<p>No readings logged.</p>"}
    <h2>Medicines</h2>${hhMeds().length ? `<ul>${hhMeds().map(m => `<li><b>${esc(m.name)}${m.strength ? " " + esc(m.strength) : ""}</b> - ${m.times.length ? m.times.map(hm).join(", ") : "as needed"}${m.instr ? ` - “${esc(m.instr)}”` : ""}</li>`).join("")}</ul>` : "<p>None listed.</p>"}
    ${V.takenPct != null ? `<p>Doses taken, last 14 days: <b>${V.takenPct}%</b> (${V.nDoses} scheduled)</p>` : ""}
    ${V.ch.length ? `<p><b>Changes, last 90 days:</b></p><ul>${V.ch.map(x => `<li>${hhDate(x.date)}: ${esc(x.text)}</li>`).join("")}</ul>` : ""}
    <h2>How I've been - last 14 days</h2>${V.cks.length ? `<ul>${V.mood != null ? `<li>Mood average ${V.mood} of 5</li>` : ""}${V.energy != null ? `<li>Energy average ${V.energy} of 5</li>` : ""}
      ${V.syms.length ? `<li>Symptoms: ${V.syms.map(([k, n]) => `${esc(sym(k))} (${n} day${n === 1 ? "" : "s"})`).join(", ")}</li>` : ""}</ul>` : "<p>No check-ins.</p>"}
    ${V.slAvg != null ? `<p>Sleep: average ${hhFmtH(V.slAvg)} over ${V.nSleep} night${V.nSleep === 1 ? "" : "s"}.</p>` : ""}
    ${a ? `<h2>My questions</h2>${a.q.length ? `<ol>${a.q.map(x => `<li>${esc(x.text)}${x.done ? " ✓" : ""}</li>`).join("")}</ol>` : "<p>None yet.</p>"}` : ""}
    <p class="fine">From my own Health Hub log (typed by me). Averages = all readings in the window ÷ how many.</p></div>`;
}
const hhVisitText = a => { const d = document.createElement("div"); d.innerHTML = hhVisitHtml(a).replace(/<\/(li|p|h1|h2)>/g, "</$1>\n").replace(/<h2>/g, "\n<h2>"); return d.textContent.replace(/\n{3,}/g, "\n\n").trim(); };
function hhVisitPage() {
  const A = hhAppts().slice().sort(hhApSort), a = A.find(x => x.id === HH_VISIT) || hhNextAppt() || A.slice(-1)[0] || null;
  return `${A.length ? `<label class="field">For which visit?<select data-hhvisitsel="1">${A.map(x => `<option value="${x.id}" ${a && a.id === x.id ? "selected" : ""}>${hhDate(x.date)} · ${esc(x.doctor || "Appointment")}</option>`).join("")}</select></label>` : ""}
    <div class="hh-med-acts"><button class="btn sm hh-go" data-hhprint="${a ? a.id : ""}">🖨️ Print</button><button class="btn sm ghost" data-hhshare="${a ? a.id : ""}">📤 Share</button></div>
    ${hhVisitHtml(a)}
    <p class="fine">Made on this phone from what you logged - no AI, nothing sent anywhere unless you share it.</p>`;
}
function hhPrint(a) {
  let fr = document.getElementById("hhPrintFrame"); if (fr) fr.remove();
  fr = document.createElement("iframe"); fr.id = "hhPrintFrame"; fr.title = "Visit summary"; fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(fr);
  const d = fr.contentWindow.document; d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Visit summary</title><style>body{font:14px/1.45 Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:16px 0 4px;border-bottom:1px solid #bbb}li{margin:2px 0}.fine{color:#555;font-size:12px}</style></head><body>${hhVisitHtml(a)}</body></html>`);
  d.close(); setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast("Use your browser's Print"); } }, 150);
}

// ------------------------------------------------------------ FRIEND STEP CHALLENGES (switch CHALLENGES, OFF)
// Only a nickname + daily step totals would ever be sent (relay task "challenge" - not built yet). Leave any time.
async function hhChalCall(op, extra = {}) {
  const c = hh().chal || {}, days = [0, 1, 2, 3, 4, 5, 6].map(k => addDays(today(), -k));
  const body = { task: "challenge", op, code: extra.code || c.code || "", nick: extra.nick || c.nick || "", steps: Object.fromEntries(days.map(d => [d, hhSteps(d)])) };
  const j = await (await fetch(AI_URL, { method: "POST", body: JSON.stringify(body) })).json();
  if (!j || j.error) throw new Error((j && j.error) || "no answer");
  return j;
}
function hhChalHtml() {
  const art = `<section class="hh-hero hh-chal">${hhIc("🏆", "#fbbf24")}<div><h3>Step challenges with friends</h3><p>Make a code, share it, and see who walks the most this week.</p></div></section>`;
  if (!switchOn("CHALLENGES")) return art + `<p class="hh-soon">Coming soon</p>
    <ul class="hh-list"><li>👟 Make a challenge or join one with a code</li><li>🏅 A weekly leaderboard with nicknames</li><li>🔒 Only your nickname and your daily step totals are shared - never your meds, vitals or anything else</li><li>🚪 Leave any time</li></ul>`;
  const c = hh().chal;
  if (!c) return art + `<form class="qa-form hh-form" data-hhchal="create"><label class="field">Your nickname (what friends see)<input name="nick" maxlength="20" required placeholder="e.g. Sam S."></label><button class="btn hh-go">Make a challenge</button></form>
    <form class="qa-form hh-form" data-hhchal="join"><div class="two"><input name="nick" maxlength="20" required placeholder="Nickname" aria-label="Nickname"><input name="code" maxlength="12" required placeholder="Code" aria-label="Challenge code"></div><button class="btn">Join with a code</button></form>
    ${HH_CHAL_MSG ? `<p class="mv-alert">${esc(HH_CHAL_MSG)}</p>` : ""}<p class="fine">Only your nickname and daily step totals are sent.</p>`;
  const B = HH_CHAL || [];
  return art + `<div class="mv-tiles3 hh-tiles3"><div><small>Code</small><b>${esc(c.code)}</b></div><div><small>You are</small><b>${esc(c.nick)}</b></div><div><small>Your 7 days</small><b>${hhK([0, 1, 2, 3, 4, 5, 6].reduce((n, k) => n + hhSteps(addDays(today(), -k)), 0))}</b></div></div>
    <div class="hh-works">${B.map((x, i) => `<div class="hh-work"><span class="hh-rank">${i + 1}</span><div class="grow"><b>${esc(x.nick)}</b></div><strong>${hhK(+x.steps || 0)}</strong></div>`).join("") || `<p class="hos-hint">Tap Refresh to see the leaderboard.</p>`}</div>
    ${HH_CHAL_MSG ? `<p class="mv-alert">${esc(HH_CHAL_MSG)}</p>` : ""}
    <div class="hh-med-acts"><button class="btn sm hh-go" data-hhchalgo="board">↻ Refresh</button><button class="btn sm ghost" data-hhchalgo="leave">Leave</button></div>`;
}
async function hhChalDo(op, extra) {
  HH_CHAL_MSG = "";
  try { const j = await hhChalCall(op, extra);
    if (op === "create" || op === "join") { hh().chal = { code: String(j.code || extra.code || "").slice(0, 12), nick: extra.nick }; save(); }
    if (op === "leave") { delete hh().chal; HH_CHAL = null; save(); }
    if (Array.isArray(j.board)) HH_CHAL = j.board.slice(0, 50).map(x => ({ nick: String(x.nick || "").slice(0, 20), steps: +x.steps || 0 }));
  } catch (e) { HH_CHAL_MSG = `Couldn't reach challenges right now (${e.message}).`; }
  showHh("challenge");
}

// ------------------------------------------------------------ LABEL SCAN (relay "scan"; the person checks every field)
const HH_SCAN_WORDS = "Health Hub - this photo is a prescription medicine label. Read it exactly as printed and answer ONLY JSON: " +
  '{"name":"","strength":"","instructions":"","quantity":0,"pharmacy":"","prescriber":"","refills":"","date":"YYYY-MM-DD"}. Copy the instructions word for word. Never add, work out or change a dose.';
function hhScanFields(j) {
  j = j && typeof j === "object" ? j : {};
  const s = (v, n) => String(v == null ? "" : v).trim().slice(0, n), q = hhNum(j.quantity || j.qty || j.count);
  return { name: s(j.name || j.drug || j.medication || j.medicine || j.title, 60), strength: s(j.strength || j.dose || j.dosage, 30), instr: s(j.instructions || j.directions || j.sig || j.note, 200),
    left: q > 0 ? Math.round(q) : "", pharmacy: s(j.pharmacy || j.store || j.shop || j.company, 60), prescriber: s(j.prescriber || j.doctor, 60), notes: j.refills ? s(`Refills: ${j.refills}`, 300) : "" };
}
async function hhRead(file) {
  let img; try { img = await hhShrink(file, 1024); } catch (e) { HH_MSG = "That doesn't look like a photo."; hhMsgShow(); return; }
  HH_SCAN = { img, read: false, f: {} }; HH_EDIT = "new"; HH_MSG = "";
  if (aiOn()) {
    showHh("meds"); toast("📷 Reading the label…");
    try { const j = await aiCall("scan", HH_SCAN_WORDS, undefined, { image: img.split(",")[1] }); HH_SCAN.f = hhScanFields(aiJSON(j.text)); HH_SCAN.read = true; }
    catch (e) { HH_MSG = "Couldn't read it (" + e.message + ") - type what it says."; }
  }
  showHh("meds");
}

// ------------------------------------------------------------ events (ui.js calls these first)
function hhClick(ds) {
  if (typeof MODE === "undefined" || MODE !== "health") return false;
  const H = hh(), t = today();
  if (ds.hhsosclose) { hhSos(false); return true; }
  if (ds.hhsos) { hhSos(true); return true; }
  if (ds.hhclose) { hideHh(); render(); return true; }
  if (ds.hhtop) { window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  if (ds.hhask) { showAsk(); return true; }
  if (ds.hhwater) { H.water[t] = Math.max(0, hhWater(t) + (+ds.hhwater || 0)); save(); render(); if (HH_OPEN && HH_TAB === "water") showHh("water");
    const n = H.water[t]; toast(+ds.hhwater > 0 ? (n === H.goals.water ? "💧 Water goal reached!" : `💧 ${n} of ${H.goals.water} glasses`) : `💧 ${n} glasses`); return true; }
  if (ds.hhvk) { HH_VK = hhVK(ds.hhvk)[0]; showHh("vitals"); return true; }
  if (ds.hhap && !ds.hhtab) { HH_AP = HH_AP === ds.hhap ? null : ds.hhap; HH_APEDIT = null; showHh("appts"); return true; }
  if (ds.hhap && ds.hhtab) { HH_AP = ds.hhap; HH_APEDIT = null; showHh("appts"); return true; }
  if (ds.hhapnew) { HH_APADD = true; HH_APEDIT = null; showHh("appts"); return true; }
  if (ds.hhmednew) { HH_EDIT = "new"; HH_SCAN = null; HH_MSG = ""; showHh("meds"); return true; }
  if (ds.hhtab) { HH_MSG = ""; if (ds.hhtab !== "meds") { HH_EDIT = null; HH_SCAN = null; } showHh(ds.hhtab); return true; }
  if (ds.hhdose) { const p = ds.hhdose.split("|"), s = p.pop(), k = p.join("|"), m = H.meds.find(x => x.id === p[0]); const r = hhLog(k, s);
    save(); render(); showHh("meds"); if (m) toast(r === "undo" ? `↩️ ${m.name} back to not logged` : r === "taken" ? `✓ ${m.name} taken` : `${m.name} skipped`); return true; }
  if (ds.hhprn) { const m = H.meds.find(x => x.id === ds.hhprn); if (!m) return true; const D = H.doses[t] = H.doses[t] || {};
    D[`${m.id}|prn${Object.keys(D).length}-${nowT()}`] = { s: "taken", at: nowT() }; if (m.left !== "" && m.left != null) m.left = Math.max(0, +m.left - (+m.per > 0 ? +m.per : 1));
    save(); render(); showHh("meds"); toast(`✓ ${m.name} logged`); return true; }
  if (ds.hhmededit) { HH_EDIT = ds.hhmededit; HH_SCAN = null; showHh("meds"); return true; }
  if (ds.hhmedcancel) { HH_EDIT = null; HH_SCAN = null; HH_MSG = ""; showHh("meds"); return true; }
  if (ds.hhmedstop) { const m = H.meds.find(x => x.id === ds.hhmedstop); if (!m) return true; m.off = t; H.medlog.push({ date: t, text: `Stopped ${m.name}${m.strength ? " " + m.strength : ""}` });
    save(); render(); showHh("meds"); toast(`${m.name} moved off your list`); return true; }
  if (ds.hhapq) { const [aid, qid] = ds.hhapq.split("|"), a = H.appts.find(x => x.id === aid), q = a && a.q.find(x => x.id === qid); if (q) { q.done = !q.done; save(); showHh("appts"); } return true; }
  if (ds.hhapqdel) { const [aid, qid] = ds.hhapqdel.split("|"), a = H.appts.find(x => x.id === aid); if (a) { a.q = a.q.filter(x => x.id !== qid); save(); showHh("appts"); } return true; }
  if (ds.hhapedit) { HH_APEDIT = ds.hhapedit; HH_APADD = false; showHh("appts"); return true; }
  if (ds.hhapcancel) { HH_APEDIT = null; HH_APADD = false; showHh("appts"); return true; }
  if (ds.hhapdel) { H.appts = H.appts.filter(x => x.id !== ds.hhapdel); HH_AP = null; save(); render(); showHh("appts"); toast("🗑️ Appointment removed"); return true; }
  if (ds.hhpast) { HH_PAST = !HH_PAST; showHh("appts"); return true; }
  if (ds.hhvisit) { HH_VISIT = ds.hhvisit; showHh("visit"); return true; }
  if (ds.hhprint !== undefined) { hhPrint(H.appts.find(x => x.id === ds.hhprint) || null); return true; }
  if (ds.hhshare !== undefined) { const a = H.appts.find(x => x.id === ds.hhshare) || null, text = hhVisitText(a);
    if (navigator.share) navigator.share({ title: "Visit summary", text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("📋 Summary copied - paste it in a text or email"), () => toast("Couldn't copy here"));
    return true; }
  if (ds.hhvdel) { H.vitals = H.vitals.filter(v => v.id !== ds.hhvdel); save(); render(); showHh("vitals"); return true; }
  if (ds.hhwdel) { H.workouts = H.workouts.filter(w => w.id !== ds.hhwdel); save(); render(); showHh("move"); return true; }
  if (ds.hhsdel) { H.sleep = H.sleep.filter(x => x.id !== ds.hhsdel); save(); render(); showHh("sleep"); return true; }
  if (ds.hhmood || ds.hhenergy || ds.hhsym) { const C = H.checkins[t] = Object.assign({ sym: [] }, H.checkins[t] || {});
    if (ds.hhmood) C.mood = C.mood === +ds.hhmood ? undefined : +ds.hhmood;
    if (ds.hhenergy) C.energy = C.energy === +ds.hhenergy ? undefined : +ds.hhenergy;
    if (ds.hhsym) { C.sym = Array.isArray(C.sym) ? C.sym : []; C.sym = C.sym.includes(ds.hhsym) ? C.sym.filter(x => x !== ds.hhsym) : C.sym.concat(ds.hhsym); }
    save(); showHh("checkin"); return true; }
  if (ds.hhcdel !== undefined) { H.card.contacts.splice(+ds.hhcdel, 1); save(); showHh("card"); return true; }
  if (ds.hhbig !== undefined) { HH_BIG = ds.hhbig || null; showHh("vault"); return true; }
  if (ds.hhvvdel) { H.vault = H.vault.filter(v => v.id !== ds.hhvvdel); hhIdb("readwrite", s => s.delete(ds.hhvvdel)).catch(() => {}); if (HH_BIG === ds.hhvvdel) HH_BIG = null;
    save(); showHh("vault"); toast("🗑️ Deleted"); return true; }
  if (ds.hhchalgo) { hhChalDo(ds.hhchalgo, {}); return true; }
  return false;
}
function hhSubmit(f, data) {
  if (typeof MODE === "undefined" || MODE !== "health") return false;
  const H = hh(), t = today(), day = v => hhIsD(v) && v <= t ? v : t, D = f.dataset;
  const goals = () => { H.goals = { water: Math.min(30, Math.max(1, Math.round(hhNum(data.water)) || 8)), steps: Math.min(50000, Math.max(500, Math.round(hhNum(data.steps)) || 6000)),
    sleep: Math.min(12, Math.max(4, Math.round(hhNum(data.sleep) * 2) / 2 || 8)) }; };
  if (D.hhsetup) { S.name = hhTxt(data.name, 30); goals(); H.setup = t; save(); render(); toast("💚 Health Hub is ready"); return true; }
  if (D.hhgoals) { S.name = hhTxt(data.name, 30); goals(); save(); render(); showHh("score"); toast("🎯 Goals saved"); return true; }
  if (D.hhmed) { hhSaveMed(data); return true; }
  if (D.hhrefill) { const m = H.meds.find(x => x.id === D.hhrefill), n = Math.round(hhNum(data.n)); if (!m || !(n > 0)) { HH_MSG = "Type how many pills you picked up."; hhMsgShow(); return true; }
    m.left = (m.left === "" || m.left == null ? 0 : +m.left) + n; HH_MSG = ""; save(); render(); showHh("meds"); toast(`🧴 ${m.name}: ${m.left} pills`); return true; }
  if (D.hhvital) { const k = hhVK(D.hhvital)[0], r = { id: uid(), kind: k, date: day(data.date), time: hhIsT(data.time) ? data.time : nowT() };
    if (k === "bp") { r.sys = Math.round(hhNum(data.sys)); r.dia = Math.round(hhNum(data.dia));
      if (!(r.sys >= 50 && r.sys <= 300 && r.dia >= 30 && r.dia <= 200 && r.sys > r.dia)) { HH_MSG = "Check the numbers - the top one (systolic) first, e.g. 118 over 76."; hhMsgShow(); return true; } }
    else { r.v = Math.round(hhNum(data.v) * 10) / 10; const ok = { glucose: [20, 700], weight: [20, 1000], hr: [20, 250], spo2: [50, 100] }[k];
      if (!(r.v >= ok[0] && r.v <= ok[1])) { HH_MSG = `That doesn't look like a ${hhVK(k)[2].toLowerCase()} reading.`; hhMsgShow(); return true; }
      if (k === "glucose") r.fast = !!data.fast; }
    H.vitals.push(r); HH_MSG = ""; save(); render(); showHh("vitals"); const b = hhBand(r); toast(`${hhVK(k)[1]} ${hhVUnit(r)} saved${b.label ? " · " + b.label : ""}`); return true; }
  if (D.hhapsave) { if (!hhIsD(data.date)) { HH_MSG = "Pick the date."; hhMsgShow(); return true; }
    const vals = { date: data.date, time: hhIsT(data.time) ? data.time : "", doctor: hhTxt(data.doctor, 60), specialty: hhTxt(data.specialty, 40), reason: hhTxt(data.reason, 120), where: hhTxt(data.where, 80), bring: hhTxt(data.bring, 160) };
    const a = D.hhapsave !== "new" && H.appts.find(x => x.id === D.hhapsave);
    if (a) Object.assign(a, vals); else { const id = uid(); H.appts.push({ id, ...vals, q: String(data.qs || "").split(/\n+/).map(x => hhTxt(x, 160)).filter(Boolean).map(text => ({ id: uid(), text })), notes: "" }); HH_AP = id; }
    HH_APADD = false; HH_APEDIT = null; HH_MSG = ""; save(); render(); showHh("appts"); toast(`🩺 ${vals.doctor || "Appointment"} ${prettyDate(vals.date)} saved`); return true; }
  if (D.hhapq) { const a = H.appts.find(x => x.id === D.hhapq), q = hhTxt(data.q, 160); if (a && q) { a.q.push({ id: uid(), text: q }); save(); showHh("appts"); const i = document.querySelector(`#hhSheet form[data-hhapq="${a.id}"] input`); if (i) i.focus(); } return true; }
  if (D.hhapnote) { const a = H.appts.find(x => x.id === D.hhapnote); if (a) { a.notes = hhTxt(data.notes, 1000); save(); showHh("appts"); toast("📝 Notes saved"); } return true; }
  if (D.hhsteps) { const n = Math.round(hhNum(data.steps)); if (!(n >= 0 && n <= 150000)) { HH_MSG = "Type today's steps, e.g. 4200."; hhMsgShow(); return true; }
    const d = day(data.date); H.steps[d] = n; HH_MSG = ""; save(); render(); showHh("move"); toast(n >= H.goals.steps ? `👟 ${n.toLocaleString("en-US")} - goal reached!` : `👟 ${n.toLocaleString("en-US")} steps`); return true; }
  if (D.hhwork) { const min = Math.round(hhNum(data.min)); if (!(min > 0 && min <= 600)) { HH_MSG = "How many minutes?"; hhMsgShow(); return true; }
    const n = v => { const x = hhNum(v); return x > 0 ? Math.round(x * 10) / 10 : ""; };
    H.workouts.push({ id: uid(), date: day(data.date), type: HH_WORK.some(w => w[0] === data.type) ? data.type : "other", min, sets: n(data.sets), reps: n(data.reps), wt: n(data.wt), note: hhTxt(data.note, 80) });
    HH_MSG = ""; save(); render(); showHh("move"); toast(`🏋️ ${min} min logged · 🔥 ${hhStreak(t)} day streak`); return true; }
  if (D.hhsleep) { if (!hhIsT(data.bed) || !hhIsT(data.wake)) { HH_MSG = "Add your bedtime and wake time."; hhMsgShow(); return true; }
    const hrs = hhSleepHrs(data.bed, data.wake); if (!(hrs > 0 && hrs <= 20)) { HH_MSG = "Check the times."; hhMsgShow(); return true; }
    const d = day(data.date); H.sleep = H.sleep.filter(x => x.date !== d);
    H.sleep.push({ id: uid(), date: d, bed: data.bed, wake: data.wake, hrs, q: Math.min(5, Math.max(1, +data.q || 3)), note: hhTxt(data.note, 100) });
    HH_MSG = ""; save(); render(); showHh("sleep"); toast(`🌙 ${hhFmtH(hrs)} logged`); return true; }
  if (D.hhcheck) { const C = H.checkins[t] = Object.assign({ sym: [] }, H.checkins[t] || {}); C.note = hhTxt(data.note, 200); save(); showHh("checkin"); toast("😊 Check-in saved"); return true; }
  if (D.hhcard) { Object.assign(H.card, { allergies: hhTxt(data.allergies, 300), conditions: hhTxt(data.conditions, 300), blood: HH_BLOOD.includes(data.blood) ? data.blood : "",
    hospital: hhTxt(data.hospital, 80), doctor: hhTxt(data.doctor, 100), notes: hhTxt(data.notes, 300) }); save(); showHh("card"); toast("🆘 Emergency card saved"); return true; }
  if (D.hhcontact) { const name = hhTxt(data.name, 40); if (!name) return true; H.card.contacts.push({ name, rel: hhTxt(data.rel, 30), phone: hhTxt(data.phone, 30) }); save(); showHh("card"); return true; }
  if (D.hhchal) { const nick = hhTxt(data.nick, 20), code = hhTxt(data.code, 12).toUpperCase(); if (!nick) return true; hhChalDo(D.hhchal === "join" ? "join" : "create", { nick, code }); return true; }
  return false;
}
if (typeof document !== "undefined") document.addEventListener("change", async e => {
  const el = e.target; if (typeof MODE === "undefined" || MODE !== "health" || !el || !el.dataset) return;
  if (el.dataset.hhvt) { HH_VT = el.value; return; }
  if (el.dataset.hhvisitsel) { HH_VISIT = el.value; showHh("visit"); return; }
  if (!el.files || !el.files[0]) return;
  const file = el.files[0]; el.value = "";
  if (file.size > 25e6) { HH_MSG = "That photo is too big."; hhMsgShow(); return; }
  if (el.dataset.hhscan) { await hhRead(file); return; }
  if (el.dataset.hhvault) { try { const img = await hhShrink(file, 1600), k = hhDoc(HH_VT);
      await hhVaultPut({ type: k[0], title: `${k[2]} · ${hhDate(today())}`, date: today(), img }); save(); showHh("vault"); toast("🗂️ Saved to your vault");
    } catch (er) { HH_MSG = "Couldn't save that photo here (private browsing?)."; hhMsgShow(); } }
});

// ------------------------------------------------------------ reminders, Life pulse, what the AI reads
// Reminders (⚙ → Reminders on): each dose at its time, an appointment the day before + an hour before, a refill at 7 / 3 / 1 / 0 days.
function hhReminders(add, inWin) {
  if (!hhSet()) return;
  const R = S.remind, t = today();
  [t, addDays(t, 1)].forEach(day => hhDoses(day).forEach(d => { if (d.x) return; const at = atMs(day, d.time);
    add(`hh:${d.k}:${day}`, at + 60 * 60000, at, `💊 ${d.m.name}${d.m.strength ? " " + d.m.strength : ""}`, `${hm(d.time)}${d.m.instr ? " · " + d.m.instr.slice(0, 90) : ""} - tap ✓ Taken in Health Hub`); }));
  hhAppts().forEach(a => { const st = atMs(a.date, a.time || "09:00"), eve = addDays(a.date, -1);
    if (inWin(eve)) add(`hhap:${a.id}:eve`, st, atMs(eve, R.billHour || "09:00"), `🩺 Tomorrow: ${a.doctor || "appointment"}`, `${a.time ? hm(a.time) : "Tomorrow"}${a.where ? " · " + a.where : ""}${a.q.length ? ` · ${a.q.length} question${a.q.length === 1 ? "" : "s"} ready` : ""}`);
    if (a.time && inWin(a.date)) add(`hhap:${a.id}:soon`, st, st - Math.max(60, +R.lead || 0) * 60000, `🩺 ${a.doctor || "Appointment"} at ${hm(a.time)}`, `${a.where ? a.where + " · " : ""}Bring: ${a.bring || "insurance card and medicine list"}`); });
  hhMeds().forEach(m => { const r = hhRefill(m); if (r.days != null && [7, 3, 1, 0].includes(r.days))
    add(`hhrf:${m.id}:${t}:${r.days}`, atMs(t, "23:59"), atMs(t, "10:00"), `🧴 Refill ${m.name}`, `${r.days ? `About ${r.days} day${r.days === 1 ? "" : "s"} of pills left` : "Out of pills by the count"} - ${m.pharmacy ? "call " + m.pharmacy : "call your pharmacy"}`); });
}
function hhPulse(add) {
  if (typeof MODE === "undefined" || MODE !== "health" || !hhSet()) return;
  const t = today();
  hhDoses(t).filter(d => d.st === "missed" || d.st === "due").forEach(d => add(d.st === "missed" ? 11 : 9, "💊", `${d.st === "missed" ? "Missed" : "Due"}: ${d.m.name} (${hm(d.time)})`, null));
  hhMeds().forEach(m => { const r = hhRefill(m); if (r.days != null && r.days <= 3) add(9, "🧴", `Refill ${m.name} - ${r.days} day${r.days === 1 ? "" : "s"} of pills left`, null); });
  hhAppts().filter(a => a.date === t).forEach(a => add(9, "🩺", `${a.doctor || "Appointment"} today${a.time ? " at " + hm(a.time) : ""}`, null));
}
function hhContext() {
  if (!hhSet()) return {};
  const t = today(), H = hh(), days = n => [...Array(n)].map((_, i) => addDays(t, -i)), C = H.card;
  return { about: "This is the person's own Health Hub log, typed by them on their phone. Not medical records. Never give medical advice or dosing.",
    dailyGoals: { waterGlasses: H.goals.water, steps: H.goals.steps, sleepHours: H.goals.sleep }, healthScoreToday: hhScore(t).score,
    medicines: hhMeds().map(m => ({ name: m.name, strength: m.strength || undefined, times: m.times.length ? m.times : "as needed", labelInstructionsAsTyped: m.instr || undefined,
      pillsLeft: m.left === "" ? undefined : m.left, refillDaysLeft: hhRefill(m).days ?? undefined, pharmacy: m.pharmacy || undefined, prescribedBy: m.prescriber || undefined })),
    dosesLast7Days: days(7).map(d => { const D = hhDoses(d); return { day: d, scheduled: D.length, taken: D.filter(x => x.st === "taken").length, skipped: D.filter(x => x.st === "skipped").length, notLogged: D.filter(x => !x.x).length }; }),
    medicineChanges: H.medlog.filter(x => x.date >= addDays(t, -90)),
    vitalsLast30Days: H.vitals.filter(v => v.date >= addDays(t, -29)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(v => ({ date: v.date, time: v.time, what: hhVK(v.kind)[2], value: hhVUnit(v), fasting: v.kind === "glucose" ? v.fast !== false : undefined, generalRange: hhBand(v).label || undefined })),
    sleepLast14Nights: H.sleep.filter(x => x.date >= addDays(t, -13)).map(x => ({ morning: x.date, bed: x.bed, wake: x.wake, hours: x.hrs, quality1to5: x.q })),
    waterLast7: days(7).map(d => ({ day: d, glasses: hhWater(d) })), stepsLast7: days(7).map(d => ({ day: d, steps: hhSteps(d) })),
    workoutsLast14: H.workouts.filter(w => w.date >= addDays(t, -13)).map(w => ({ day: w.date, type: w.type, minutes: w.min })),
    checkinsLast14: Object.entries(H.checkins).filter(([d]) => d >= addDays(t, -13)).map(([d, c]) => ({ day: d, mood1to5: c.mood, energy1to5: c.energy, symptoms: c.sym, note: c.note || undefined })),
    appointments: H.appts.filter(a => a.date >= addDays(t, -30)).sort(hhApSort).map(a => ({ date: a.date, time: a.time || undefined, doctor: a.doctor || undefined, specialty: a.specialty || undefined, reason: a.reason || undefined,
      questions: a.q.map(q => q.text + (q.done ? " (asked)" : "")), notes: a.notes || undefined })),
    allergies: C.allergies || undefined, conditions: C.conditions || undefined };
}
