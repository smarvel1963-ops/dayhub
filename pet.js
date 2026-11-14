/* SAVE AS: pet.js · LOCATION: C:/MarvelApps/dayhub/pet.js
 * PET HUB (app #10; Scott 2026-11-13: "what app we build next" -> "Pet Hub" -> "Yes, build it"). Runs at /pethub/ with
 * window.DH_MODE = "pet". Plan: C:/MarvelApps/docs/hub_improvement/pethub/PET_HUB_PLAN_2026-11-13.md.
 * LOOK = Scott's board 1 (docs/hub_improvement/pethub/boards/board1_four_screens_2026-11-13.png): warm cream, cartoon-bright pet cards,
 * coral buttons, navy titles (pettiles.css). Screens: Our Happy Crew (All My Pets), each pet's own page, Birthdays & Ages, Memory Moments,
 * Add Your Pet, Daily Care, Health & Records, Pet Passport, Rainbow Bridge. Board rule: each animal has its own profile and records, the
 * owner sees everyone together, and picking a pet turns the whole app to that pet's colour.
 * Every animal gets its own life story (Scott's paste 11/13): age in years / months / days, birthday + Gotcha Day countdowns, milestones,
 * weight with photos, First Day Home, birthdays, adventures, Then & Now, On This Day, the timeline, a birthday slideshow, Rainbow Bridge.
 * RULES: data stays on this phone (S.pt); photos in this phone's own IndexedDB (pethub.photos - never in S, never in the backup, emptied
 * by Erase). Never veterinary advice: a medicine is only what the owner typed from the vet; no dose is ever worked out here.
 * "On This Day", "Then & Now", the timeline and the slideshow run on dates on the phone - no AI, no cost.
 * Loaded after ships.js, before ui.js (pet mode). Every top-level name is pt / PT.
 */
"use strict";
const PT_SPECIES = [["dog", "🐶", "Dog"], ["cat", "🐱", "Cat"], ["bird", "🦜", "Bird"], ["rabbit", "🐰", "Rabbit"], ["horse", "🐴", "Horse"], ["reptile", "🦎", "Reptile"], ["fish", "🐠", "Fish"], ["other", "🐾", "Other"]];
const PT_TONES = ["#ffb27d", "#6fd3c1", "#86bdf5", "#c3a8f5", "#ffd166", "#ff9cc2", "#93dd85", "#f59f9f"];
const PT_CARE = [["feed", "🍖", "Feeding"], ["walk", "🦮", "Walk"], ["water", "💧", "Fresh water"], ["play", "🎾", "Playtime"], ["groom", "🛁", "Grooming"],
  ["litter", "🧹", "Litter / cage"], ["habitat", "🏠", "Habitat"], ["meds", "💊", "Medicine"], ["other", "✨", "Other"]];
const PT_EVERY = [["daily", "Every day"], ["weekly", "Every week"], ["monthly", "Every month"]];
const PT_MEMK = [["home", "🏡", "First Day Home"], ["bday", "🎂", "Birthday"], ["adv", "🏖️", "Adventure"], ["funny", "😂", "Funny moment"], ["trick", "🎓", "New trick"],
  ["first", "⭐", "A first"], ["photo", "📸", "Photo"], ["other", "💛", "Special moment"]];
const PT_PAPERS = [["vacc", "💉", "Vaccine record"], ["adopt", "📜", "Adoption papers"], ["ins", "🛡️", "Insurance card"], ["vet", "🩺", "Vet record"], ["other", "📄", "Other paper"]];
// General life stages by species (years). General information only - every animal is different; the vet knows best.
const PT_STAGES = { dog: [[1, "Puppy"], [7, "Adult"], [99, "Senior"]], cat: [[1, "Kitten"], [11, "Adult"], [99, "Senior"]], rabbit: [[1, "Young"], [6, "Adult"], [99, "Senior"]],
  horse: [[4, "Young"], [15, "Adult"], [99, "Senior"]], bird: [[1, "Young"], [99, "Adult"]], reptile: [[1, "Young"], [99, "Adult"]], fish: [[1, "Young"], [99, "Adult"]], other: [[1, "Young"], [99, "Adult"]] };
const PT_STAGE_TIP = { Puppy: "Puppy shots, house training and lots of naps.", Kitten: "Kitten shots, play and safe chewing.", Young: "Growing fast - keep up with checkups.",
  Adult: "A yearly checkup keeps things on track.", Senior: "Seniors often see the vet more often - ask yours what's right." };
// Ready-made routine for a new pet (the owner keeps, changes or deletes any of it).
const PT_START = { dog: [["feed", "Breakfast", "07:30"], ["walk", "Morning walk", "08:00"], ["feed", "Dinner", "17:30"], ["walk", "Evening walk", "18:30"]],
  cat: [["feed", "Breakfast", "07:30"], ["feed", "Dinner", "17:30"], ["litter", "Scoop the litter", "20:00"]], bird: [["feed", "Fresh food & water", "08:00"]],
  rabbit: [["feed", "Hay, greens & water", "08:00"]], horse: [["feed", "Morning feed", "07:00"], ["feed", "Evening feed", "17:00"]],
  reptile: [["habitat", "Check heat & water", "08:00"]], fish: [["feed", "Feed", "08:00"]], other: [["feed", "Food & water", "08:00"]] };
const PT_MILES = [[0, 6, "6 months old"], [1, 0, "1st birthday"], [2, 0, "2nd birthday"], [3, 0, "3rd birthday"], [5, 0, "5 years old"], [10, 0, "10 years old"], [15, 0, "15 years old"], [20, 0, "20 years old"]];
const PT_NAV = [["home", "🐾", "My Pets"], ["bday", "🎂", "Birthdays"], ["mem", "🖼️", "Memories"], ["more", "•••", "More"]];
const PT_TABS = { pet: "🐾 My pet", bday: "🎂 Birthdays & Ages", mem: "🖼️ Memory Moments", more: "••• More", add: "＋ Add Your Pet", care: "🦮 Daily Care", health: "🩺 Health & Records",
  pass: "🛂 Pet Passport", bridge: "🌈 Rainbow Bridge", needs: "🔔 Needs you", all: "🐾 Our Happy Crew" };
const PT_ADV = "General information, not veterinary advice - ask your vet.";
const PT_ASKS = ["When is each pet's next birthday?", "Which shots are due soon?", "What did the vet say last time?", "How has Biscuit's weight changed?"];
let PT_OPEN = false, PT_TAB = "pet", PT_MSG = "", PT_EDIT = null, PT_MONTH = 0, PT_PENDING = "", PT_MEMPIC = "", PT_MEMADD = false, PT_FORM = "", PT_STACK = [], PT_ARM = "", PT_BUSY = false;
const PT_IMG = {};          // photo id -> data URL already read this visit (no flicker on redraw)
if (typeof document !== "undefined" && typeof MODE !== "undefined" && MODE === "pet") document.body.classList.add("ptapp");   // hides the Day Hub ＋ and the hero

// ------------------------------------------------------------ the data (S.pt) and small helpers
function pt() {
  if (!S.pt || typeof S.pt !== "object" || Array.isArray(S.pt)) S.pt = {};
  const P = S.pt, o = v => v && typeof v === "object" && !Array.isArray(v);
  ["pets", "care", "meds", "shots", "visits", "weights", "mems", "papers"].forEach(k => { P[k] = Array.isArray(P[k]) ? P[k].filter(o) : []; });
  ["done", "doses"].forEach(k => { P[k] = o(P[k]) ? P[k] : {}; });
  // A backup file or Drive copy is outside data: colours, times and numbers are checked before they reach the page.
  const isT = v => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v), int = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  P.pets.forEach((p, i) => { if (!p.id) p.id = uid(); if (!p.name) p.name = "Pet"; if (!PT_SPECIES.some(s => s[0] === p.species)) p.species = "other";
    if (!/^#[0-9a-f]{6}$/i.test(String(p.color || ""))) p.color = PT_TONES[i % PT_TONES.length]; });
  P.care.forEach(c => { if (!Array.isArray(c.times)) c.times = c.time ? [c.time] : []; c.times = c.times.filter(isT); c.dow = int(c.dow, 0, 6, 0); c.dom = int(c.dom, 1, 31, 1); });
  P.meds.forEach(m => { if (!Array.isArray(m.times)) m.times = []; m.times = m.times.filter(isT); if (m.left !== "" && m.left != null) m.left = int(m.left, 0, 99999, 0); });
  P.weights = P.weights.filter(w => Number(w.lb) > 0 && Number(w.lb) < 5000); P.weights.forEach(w => { w.lb = Math.round(Number(w.lb) * 10) / 10; });
  if (P.cur && !P.pets.some(p => p.id === P.cur)) P.cur = "";
  return P;
}
const ptSet = () => !!(S.pt && S.pt.setup && Array.isArray(S.pt.pets) && S.pt.pets.length);
const ptPets = () => pt().pets;
const ptLiving = () => ptPets().filter(p => !p.passed);
const ptPet = id => ptPets().find(p => p.id === id) || null;
const ptCur = () => { const P = pt(); return ptPet(P.cur) || ptLiving()[0] || ptPets()[0] || null; };
const ptSp = k => PT_SPECIES.find(s => s[0] === k) || PT_SPECIES[PT_SPECIES.length - 1];
const ptCk = k => PT_CARE.find(c => c[0] === k) || PT_CARE[PT_CARE.length - 1];
const ptMk = k => PT_MEMK.find(c => c[0] === k) || PT_MEMK[PT_MEMK.length - 1];
const ptIsD = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ptIsT = v => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
const ptTxt = (v, n = 80) => String(v == null ? "" : v).trim().slice(0, n);
const ptNum = v => { const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; };
const ptDate = d => ptIsD(d) ? prettyDate(d) + (d.slice(0, 4) !== today().slice(0, 4) ? ", " + d.slice(0, 4) : "") : "";
const ptMonthYr = d => ptIsD(d) ? parseDay(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
const ptOf = (list, id) => list.filter(x => x.pet === id);
const ptTone = p => (p && p.color) || PT_TONES[0];

// Months later, keeping the day but never past a month's end (Jan 31 + 1 month = Feb 28/29).
const ptAddMonths = (a, n) => { const y = a.getFullYear(), m = a.getMonth() + n; return new Date(y, m, Math.min(a.getDate(), new Date(y, m + 1, 0).getDate())); };
const ptIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Age between two days as whole years, months and days: the most whole months that fit, then the days left (never negative,
// so a pet born on the 31st is "1 month, 1 day" on March 1st, not "1 month, -2 days").
function ptAge(from, to) {
  if (!ptIsD(from)) return null;
  const a = parseDay(from), b = parseDay(to || today()); if (b < a) return { y: 0, m: 0, d: 0, neg: true };
  let M = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (ptAddMonths(a, M) > b) M -= 1;
  return { y: Math.floor(M / 12), m: M % 12, d: Math.round((b - ptAddMonths(a, M)) / 86400000) };
}
const ptPl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function ptAgeTxt(p, style = "short", at) {
  const A = p && ptAge(p.bday, at || (p.passed || today())); if (!A) return "";
  const ab = p.est ? "about " : "";
  if (style === "long") return ab + [A.y ? ptPl(A.y, "year") : "", A.m ? ptPl(A.m, "month") : "", !p.est && (A.d || (!A.y && !A.m)) ? ptPl(A.d, "day") : ""].filter(Boolean).join(", ");
  if (!A.y && !A.m) return ab + ptPl(A.d, "day");
  return ab + (A.y ? `${A.y} yr${A.y === 1 ? "" : "s"}` : "") + (A.y && A.m ? " " : "") + (A.m || !A.y ? `${A.m} mo${A.m === 1 ? "" : "s"}` : "");
}
// The next time a month-day comes round (Feb 29 -> Feb 28 in other years).
function ptNextMD(iso, from) {
  if (!ptIsD(iso)) return null;
  const t = from || today(), [, mm, dd] = iso.split("-").map(Number), y0 = Number(t.slice(0, 4));
  const on = y => { const last = new Date(y, mm, 0).getDate(); return `${y}-${String(mm).padStart(2, "0")}-${String(Math.min(dd, last)).padStart(2, "0")}`; };
  let d = on(y0); if (d < t) d = on(y0 + 1);
  return d;
}
// An estimated age has no real birthday, so it gets no countdown, party or reminder (its age still shows as "about ...").
// A birthday or Gotcha Day typed as today is day 0: the first one to celebrate is a year from now.
function ptNextBday(p) {
  if (!p || !ptIsD(p.bday) || p.passed || p.est) return null;
  let d = ptNextMD(p.bday); if (Number(d.slice(0, 4)) <= Number(p.bday.slice(0, 4))) d = ptNextMD(p.bday, addDays(today(), 1));
  return { date: d, days: daysUntil(d), turns: Number(d.slice(0, 4)) - Number(p.bday.slice(0, 4)) };
}
function ptNextGotcha(p) {
  if (!p || !ptIsD(p.gotcha) || p.passed || p.gotcha > today()) return null;
  let d = ptNextMD(p.gotcha); if (Number(d.slice(0, 4)) <= Number(p.gotcha.slice(0, 4))) d = ptNextMD(p.gotcha, addDays(today(), 1));
  return { date: d, days: daysUntil(d), years: Number(d.slice(0, 4)) - Number(p.gotcha.slice(0, 4)) };
}
function ptStage(p) {
  const A = p && ptAge(p.bday); if (!A) return "";
  const yrs = A.y + A.m / 12; return ((PT_STAGES[p.species] || PT_STAGES.other).find(([to]) => yrs < to) || ["", ""])[1];
}
// The next milestone (and today's, if it is today).
function ptMilestone(p) {
  if (!p || !ptIsD(p.bday) || p.passed || p.est) return null;
  for (const [y, m, label] of PT_MILES) {
    const iso = ptIso(ptAddMonths(parseDay(p.bday), y * 12 + m));
    if (iso >= today() && iso > p.bday) return { label, date: iso, days: daysUntil(iso) };
  }
  return null;
}
const ptMileTxt = (p, ms) => /birthday/.test(ms.label) ? `It's ${p.name}'s ${ms.label}!` : `${p.name} is ${ms.label} today!`;

// ------------------------------------------------------------ daily care + medicine doses
function ptCareOn(c, day) {
  if (c.off || !ptPet(c.pet) || ptPet(c.pet).passed) return false;
  if (ptIsD(c.from) && day < c.from) return false;
  const d = parseDay(day);
  return c.every === "weekly" ? d.getDay() === Number(c.dow || 0) : c.every === "monthly" ? d.getDate() === Math.min(Number(c.dom || 1), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) : true;
}
function ptCareDue(day, petId) {
  const P = pt(), out = [];
  P.care.filter(c => (!petId || c.pet === petId) && ptCareOn(c, day)).forEach(c => (c.times.length ? c.times : [""]).forEach(tm => {
    const key = `${c.id}|${tm}`; out.push({ c, time: tm, key, done: !!(P.done[day] && P.done[day][key]), pet: ptPet(c.pet) }); }));
  return out.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}
function ptDoses(day, petId) {
  const P = pt(), out = [];
  P.meds.filter(m => !m.off && (!petId || m.pet === petId) && ptPet(m.pet) && !ptPet(m.pet).passed && (!ptIsD(m.start) || day >= m.start) && (!ptIsD(m.end) || day <= m.end))
    .forEach(m => m.times.forEach(tm => { const k = `${m.id}|${tm}`, st = (P.doses[day] || {})[k] || ""; out.push({ m, time: tm, k, st, pet: ptPet(m.pet) }); }));
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
function ptRefill(m) {
  const left = m.left === "" || m.left == null ? null : ptNum(m.left), per = Math.max(1, ptNum(m.per) || 1) * Math.max(1, m.times.length);
  return left == null || !m.times.length ? { days: null } : { days: Math.floor(left / per), soon: Math.floor(left / per) <= 5 };
}
const ptShotsDue = petId => pt().shots.filter(s => (!petId || s.pet === petId) && ptIsD(s.due) && ptPet(s.pet) && !ptPet(s.pet).passed).sort((a, b) => a.due.localeCompare(b.due));
const ptVisitsNext = petId => pt().visits.filter(v => (!petId || v.pet === petId) && ptPet(v.pet) && !ptPet(v.pet).passed && ptIsD(v.date) && v.date >= today()).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
function ptNeeds() {
  const t = today(), N = [], now = typeof nowT === "function" ? nowT() : "23:59";
  ptCareDue(t).filter(x => !x.done && x.time && x.time <= now).forEach(x => N.push({ icon: ptCk(x.c.kind)[1], text: `${x.pet.name}: ${x.c.title}`, sub: `Was due ${hm(x.time)}`, tab: "care", pet: x.pet.id, late: true }));
  ptDoses(t).filter(d => !d.st && d.time <= now).forEach(d => N.push({ icon: "💊", text: `${d.pet.name}: ${d.m.name}`, sub: `Dose at ${hm(d.time)}`, tab: "health", pet: d.pet.id, late: true }));
  ptShotsDue().filter(s => daysUntil(s.due) <= 14).forEach(s => N.push({ icon: "💉", text: `${ptPet(s.pet).name}: ${s.name}`, sub: daysUntil(s.due) < 0 ? `Overdue since ${ptDate(s.due)}` : `Due ${ptRel(s.due)}`, tab: "health", pet: s.pet, late: daysUntil(s.due) < 0 }));
  ptVisitsNext().filter(v => daysUntil(v.date) <= 2).forEach(v => N.push({ icon: "🩺", text: `${ptPet(v.pet).name}: vet visit`, sub: `${ptRel(v.date)}${v.time ? " at " + hm(v.time) : ""}${v.vet ? " · " + v.vet : ""}`, tab: "health", pet: v.pet }));
  ptMeds().forEach(m => { const r = ptRefill(m); if (r.soon) N.push({ icon: "🧴", text: `Refill ${m.name}`, sub: `${ptPet(m.pet).name} · about ${ptPl(r.days, "day")} left`, tab: "health", pet: m.pet }); });
  ptLiving().forEach(p => { const b = ptNextBday(p); if (b && b.days <= 7) N.push({ icon: "🎂", text: b.days ? `${p.name} turns ${b.turns} in ${ptPl(b.days, "day")}` : `${p.name} turns ${b.turns} today! 🎉`, sub: ptDate(b.date), tab: "bday", pet: p.id }); });
  return N;
}
const ptMeds = () => pt().meds.filter(m => !m.off && ptPet(m.pet) && !ptPet(m.pet).passed);
const ptRel = d => { const n = daysUntil(d); return n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n > 1 && n < 7 ? `in ${n} days` : n < 0 && n > -7 ? `${-n} days ago` : ptDate(d); };

// ------------------------------------------------------------ photos (this phone's own IndexedDB: pethub.photos)
let PT_DB = null;
const ptDb = () => PT_DB || (PT_DB = new Promise((ok, no) => { const r = indexedDB.open("pethub.photos", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("pics"); r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); PT_DB = null; }; ok(r.result); }; r.onerror = () => { PT_DB = null; no(r.error); }; }));
const ptIdb = async (mode, fn) => { const db = await ptDb(); return new Promise((ok, no) => { const t = db.transaction("pics", mode), s = t.objectStore("pics"), r = fn(s);
  t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
async function ptShrink(file, max) {
  const url = URL.createObjectURL(file);
  try { const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("not a photo")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", .84);
  } finally { URL.revokeObjectURL(url); }
}
async function ptPhotoPut(data) { const id = uid() + uid(); await ptIdb("readwrite", s => s.put(data, id)); PT_IMG[id] = data; return id; }
const ptPhotoDel = id => { if (!id) return; delete PT_IMG[id]; try { ptIdb("readwrite", s => s.delete(id)).catch(() => {}); } catch (e) { /* private mode */ } };
async function ptPaint(root) {
  if (typeof document === "undefined") return;
  for (const im of (root || document).querySelectorAll("img[data-ptimg]")) {
    const id = im.dataset.ptimg; if (!id || im.dataset.ptdone === id) continue;
    try { const d = PT_IMG[id] || (PT_IMG[id] = await ptIdb("readonly", s => s.get(id))); if (d) { im.src = d; im.dataset.ptdone = id; im.closest(".pt-pic") && im.closest(".pt-pic").classList.add("has"); } } catch (e) { /* private mode: the emoji stays */ }
  }
}
const ptPaintSoon = () => setTimeout(() => ptPaint(), 0);
// A pet's face: its photo when there is one, its species emoji on its own colour underneath (shows while loading or with no photo).
const ptFace = (p, cls = "") => `<span class="pt-pic ${cls}" style="--tone:${ptTone(p)}"><i aria-hidden="true">${ptSp(p && p.species)[1]}</i>${p && p.photo ? `<img data-ptimg="${esc(p.photo)}" alt="">` : ""}${p && p.passed ? `<em class="pt-rb" aria-hidden="true">🌈</em>` : ""}</span>`;
const ptMemPic = m => m && m.photo ? `<span class="pt-pic pt-mempic"><i aria-hidden="true">${ptMk(m.kind)[1]}</i><img data-ptimg="${esc(m.photo)}" alt=""></span>` : `<span class="pt-pic pt-mempic"><i aria-hidden="true">${ptMk(m && m.kind)[1]}</i></span>`;

// ------------------------------------------------------------ the sheet (one page per tab) + the bottom bar + the phone's back button
function ptSheet() {
  let el = document.getElementById("ptSheet");
  if (!el) { el = document.createElement("div"); el.id = "ptSheet"; el.className = "sheet hidden"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function ptReset() { PT_MSG = ""; PT_EDIT = null; PT_PENDING = ""; PT_MEMPIC = ""; PT_MEMADD = false; PT_FORM = ""; PT_ARM = ""; }
// fromPop = the phone's back button already took our history step away; any other close takes it away itself, so the
// next back press is never a dead one.
function hidePt(fromPop) {
  const el = document.getElementById("ptSheet"); if (el) el.classList.add("hidden"); PT_OPEN = false; PT_STACK = []; ptReset(); ptTheme(); ptNavEnsure();
  if (!fromPop && PT_HPUSH) { PT_HPUSH = 0; PT_HSKIP++; try { history.back(); } catch (e) { PT_HSKIP = 0; } }
}
function showPt(tab, push) {
  const el = ptSheet(), old = el.querySelector(".sheet-body"), same = PT_OPEN && (!tab || tab === PT_TAB), keep = same && old ? old.scrollTop : 0;
  if (tab && tab !== PT_TAB && push !== false && PT_OPEN) PT_STACK.push(PT_TAB);
  if (tab) PT_TAB = tab; if (!PT_OPEN) ptHist(); PT_OPEN = true;
  const p = ptCur(), plain = PT_TAB === "pet" && p ? p.name : PT_TAB === "add" && PT_EDIT ? "Edit profile" : String(PT_TABS[PT_TAB] || "🐾 Pet Hub").replace(/^\S+\s/, "");
  el.setAttribute("aria-label", plain);                       // plain text (an "&" in a name stays an "&")
  const big = esc(plain);                                     // the board's big title has no leading emoji
  el.innerHTML = `<div class="sheet-body pt-sheet">${ptDeco()}
    <div class="sheet-head pt-head">${PT_STACK.length ? `<button class="pt-round pt-back" data-ptback="1" aria-label="Back">←</button>` : `<button class="pt-round pt-back" data-ptclose="1" aria-label="Back to all my pets">←</button>`}<span class="pt-brand"><span>🐾</span> Pet Hub</span><button class="pt-round" data-ptclose="1" aria-label="Close">✕</button></div>
    <h2 class="pt-title pt-dash pt-pagetitle">${big}</h2>
    <div class="pt-pane">${ptPane()}</div><p class="fine pt-msg" id="ptMsg">${PT_MSG ? "⚠️ " + esc(PT_MSG) : ""}</p>
    <nav class="pt-tabs" aria-label="Pet Hub">${ptNavHtml(PT_TAB)}</nav></div>`;
  el.classList.remove("hidden"); ptTheme();
  if (keep) { const b = el.querySelector(".sheet-body"); b.style.animation = "none"; b.scrollTop = keep; }
  ptPaint(el);
}
const ptMsgShow = () => { const el = document.getElementById("ptMsg"); if (el) el.textContent = PT_MSG ? "⚠️ " + PT_MSG : ""; };
const ptNavFor = tab => ["bday", "mem", "more"].includes(tab) ? tab : ["home", "pet", "all", "needs"].includes(tab) ? "home" : "more";
function ptNavHtml(on) {
  return PT_NAV.map(([k, i, l]) => `<button class="${ptNavFor(on) === k ? "on" : ""}" ${k === "home" ? 'data-ptclose="1"' : `data-pttab="${k}" data-ptroot="1"`}
    aria-current="${ptNavFor(on) === k ? "page" : "false"}"><span aria-hidden="true">${i}</span>${l}</button>`).join("");
}
function ptNavEnsure() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("pt", ptSet());
  let n = document.getElementById("ptNav");
  if (!ptSet()) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement("nav"); n.id = "ptNav"; n.className = "pt-nav"; n.setAttribute("aria-label", "Pet Hub"); document.body.appendChild(n); }
  n.innerHTML = ptNavHtml(PT_OPEN ? PT_TAB : "home");
}
// The whole app wears the chosen pet's colour (board: "the entire app visually personalizes itself around that animal").
function ptTheme() { if (typeof document === "undefined") return; const p = PT_OPEN ? ptCur() : null; document.body.style.setProperty("--pt-tone", p ? ptTone(p) : "#ff6b57"); }
function ptPane() {
  const P = { pet: ptPetHtml, bday: ptBdayHtml, mem: ptMemHtml, more: ptMoreHtml, add: ptAddHtml, care: ptCareHtml, health: ptHealthHtml, pass: ptPassHtml, bridge: ptBridgeHtml, needs: ptNeedsHtml, all: ptAllHtml };
  if (!ptPets().length && PT_TAB !== "add") return ptAddHtml();
  return (P[PT_TAB] || ptPetHtml)();
}
function ptBack() { if (PT_STACK.length) { ptReset(); showPt(PT_STACK.pop(), false); } else hidePt(); }
// One history step while a Pet Hub page is open (PT_HPUSH) and one while the slideshow plays (PT_SHOWPUSH). The back button
// closes the slideshow first, then walks back through the pages, then closes them. PT_HSKIP = steps we took away ourselves.
let PT_HSKIP = 0, PT_HPUSH = 0, PT_SHOWPUSH = 0;
function ptHist() { try { history.pushState({ pt: 1 }, ""); PT_HPUSH = 1; } catch (e) { /* the ✕ still works */ } }
if (typeof window !== "undefined") window.addEventListener("popstate", () => {
  if (typeof MODE === "undefined" || MODE !== "pet") return;
  if (PT_HSKIP) { PT_HSKIP--; return; }
  if (PT_SHOWPUSH) { PT_SHOWPUSH = 0; ptShowClose(true); return; }
  if (!PT_OPEN) return;
  PT_HPUSH = 0;
  if (PT_STACK.length) { ptBack(); ptHist(); } else hidePt(true);
});

// ------------------------------------------------------------ the pet picker row (switch the pet the app is about)
const ptPicker = (tab) => ptPets().length > 1 ? `<div class="pt-picker" role="tablist" aria-label="Choose a pet">${ptPets().map(p => `<button class="${ptCur() && ptCur().id === p.id ? "on" : ""}" data-ptpick="${p.id}" data-ptgo="${tab}" role="tab" aria-selected="${ptCur() && ptCur().id === p.id}">${ptFace(p, "sm")}<b>${esc(p.name)}</b></button>`).join("")}</div>` : "";
const ptDeco = () => `<span class="pt-deco l" aria-hidden="true">🌼<b>🌿</b></span><span class="pt-deco r" aria-hidden="true"><b>🌿</b>🌸</span>`;

// ------------------------------------------------------------ first run = add your first pet
function ptSetupHtml() {
  ptNavEnsure(); if (PT_OPEN) hidePt();
  if (typeof document !== "undefined") document.body.classList.add("ptapp");
  return `<section class="card pt-home pt-hello" aria-label="Welcome to Pet Hub">${ptDeco()}
    <div class="pt-brand"><span>🐾</span> Pet Hub</div>
    <h1 class="pt-title">Every pet's <b>life story</b></h1>
    <p class="pt-sub">Care, birthdays, the vet and every memory - one page for each of your animals.</p>
    <div class="pt-promise">${["🎂 Birthdays & ages", "🦮 Daily care", "🩺 Vet & shots", "🖼️ Memories", "🛂 Pet passport", "🔔 Reminders"].map(w => `<span>${w}</span>`).join("")}</div>
    ${ptPetForm(null, "setup")}
    <p class="fine">Everything stays on this phone. ${PT_ADV}</p></section>`;
}

// ------------------------------------------------------------ HOME: Our Happy Crew (All My Pets)
function ptDashHtml() {
  ptNavEnsure(); if (typeof document !== "undefined") document.body.classList.add("ptapp");
  const t = today(), pets = ptPets(), living = ptLiving(), gone = pets.filter(p => p.passed), tasks = ptCareDue(t), open = tasks.filter(x => !x.done);
  const bdays = living.map(p => ({ p, b: ptNextBday(p) })).filter(x => x.b && x.b.days <= 30).sort((a, b) => a.b.days - b.b.days);
  const gotchas = living.map(p => ({ p, g: ptNextGotcha(p) })).filter(x => x.g && x.g.days <= 30 && x.g.years > 0);
  const otd = ptOnThisDay(), N = ptNeeds(), doses = ptDoses(t).filter(d => !d.st);
  ptPaintSoon();
  return `<section class="card pt-home" aria-label="Pet Hub - all my pets">${ptDeco()}
    <div class="pt-top"><button class="pt-round" data-pttab="all" aria-label="All my pets">👥</button><span class="pt-brand"><span>🐾</span> Pet Hub</span>
      <button class="pt-round pt-bell" data-pttab="needs" aria-label="Needs you${N.length ? ": " + N.length : ""}">🔔${N.length ? `<em>${N.length}</em>` : ""}</button></div>
    <h1 class="pt-title pt-dash">Our Happy Crew</h1><p class="pt-kicker">All My Pets</p>
    <div class="pt-grid">${living.map(p => ptPetCard(p)).join("")}</div>
    <button class="pt-cta" data-ptnew="1"><span aria-hidden="true">＋</span> Add a Pet</button>
    ${otd.length ? `<div class="pt-box pt-otd"><h3>📅 On This Day</h3>${otd.slice(0, 2).map(m => `<button class="pt-row" data-ptpick="${m.pet}" data-ptgo="mem">${ptMemPic(m)}<span class="grow"><b>${esc(m.title)}</b><small>${esc(ptPet(m.pet).name)} · ${ptPl(Number(t.slice(0, 4)) - Number(m.date.slice(0, 4)), "year")} ago today</small></span><em>›</em></button>`).join("")}</div>` : ""}
    <div class="pt-box pt-tasks"><div class="pt-boxhead"><h3>📋 Household Tasks</h3><span>${open.length ? `${tasks.length - open.length}/${tasks.length} done` : tasks.length ? "All done 🐾" : ""}</span></div>
      ${tasks.length ? tasks.slice(0, 8).map(x => ptTaskRow(x, t, true)).join("") + (tasks.length > 8 ? `<button class="pt-more" data-pttab="care">+${tasks.length - 8} more</button>` : "")
        : `<p class="pt-hint">No care set up for today. <button class="pt-link" data-pttab="care">Add feeding, walks…</button></p>`}
      ${doses.length ? doses.slice(0, 4).map(d => `<div class="pt-row pt-dose">${ptFace(d.pet, "xs")}<span class="grow"><b>💊 ${esc(d.m.name)}</b><small>${esc(d.pet.name)} · ${hm(d.time)}${d.m.dose ? " · " + esc(d.m.dose) : ""}</small></span>
          <button class="pt-mini ok" data-ptdose="${d.k}" data-ptst="taken">Given</button></div>`).join("") : ""}</div>
    <div class="pt-box pt-alerts"><div class="pt-boxhead"><h3>🎉 Birthday Alerts <small>(Next 30 Days)</small></h3></div>
      ${bdays.length || gotchas.length ? bdays.map(({ p, b }) => `<button class="pt-row" data-ptpick="${p.id}" data-ptgo="bday">${ptFace(p, "xs")}<span class="grow"><b>${esc(p.name)} ${b.days ? `turns ${b.turns} in ${ptPl(b.days, "day")}!` : `turns ${b.turns} today! 🎂`}</b></span><span class="pt-chip">${prettyDate(b.date)}</span></button>`).join("")
          + gotchas.map(({ p, g }) => `<button class="pt-row" data-ptpick="${p.id}" data-ptgo="mem">${ptFace(p, "xs")}<span class="grow"><b>${esc(p.name)}'s Gotcha Day ${g.days ? `in ${ptPl(g.days, "day")}` : "is today! 🏡"}</b><small>${ptPl(g.years, "year")} with your family</small></span><span class="pt-chip">${prettyDate(g.date)}</span></button>`).join("")
        : `<p class="pt-hint">No birthdays in the next 30 days.</p>`}</div>
    ${gone.length ? `<div class="pt-box pt-gone"><h3>🌈 In loving memory</h3><div class="pt-gonerow">${gone.map(p => `<button data-ptpick="${p.id}" data-ptgo="bridge">${ptFace(p, "sm")}<b>${esc(p.name)}</b></button>`).join("")}</div></div>` : ""}
    <p class="fine pt-adv">${PT_ADV} Everything here stays on this phone.</p>
  </section>`;
}
function ptPetCard(p) {
  const b = ptNextBday(p), sp = ptSp(p.species);
  return `<button class="pt-card" data-ptpick="${p.id}" data-ptgo="pet" style="--tone:${ptTone(p)}" aria-label="${esc(p.name)}, ${esc(p.breed || sp[2])}">
    ${ptFace(p, "big")}<span class="pt-cardfoot"><span class="grow"><b>${esc(p.name)} <i aria-hidden="true">🐾</i></b><small>${esc(p.breed || sp[2])}${b && b.days <= 7 ? ` · 🎂 ${b.days ? "in " + ptPl(b.days, "day") : "today"}` : ""}</small></span><em aria-hidden="true">›</em></span></button>`;
}
function ptTaskRow(x, day, showPet) {
  return `<div class="pt-row pt-task${x.done ? " done" : ""}"><button class="pt-check${x.done ? " on" : ""}" data-ptdone="${x.key}" data-ptday="${day}" aria-pressed="${x.done}" aria-label="${x.done ? "Done" : "Mark done"}: ${esc(x.c.title)}">${x.done ? "✓" : ""}</button>
    <span class="grow"><b>${ptCk(x.c.kind)[1]} ${esc(x.c.title)}</b><small>${showPet ? esc(x.pet.name) + (x.time ? " · " : "") : ""}${x.time ? hm(x.time) : ""}</small></span>${showPet ? ptFace(x.pet, "xs") : ""}</div>`;
}
function ptOnThisDay() {
  const t = today(), md = t.slice(5);
  return pt().mems.filter(m => ptIsD(m.date) && m.date.slice(5) === md && m.date.slice(0, 4) < t.slice(0, 4) && ptPet(m.pet));
}
function ptAllHtml() {
  return `<div class="pt-grid">${ptPets().map(p => ptPetCard(p)).join("")}</div><button class="pt-cta" data-ptnew="1">＋ Add a Pet</button>
    <div class="pt-box"><h3>🎂 Ages at a glance</h3><div class="pt-ages">${ptPets().map(p => `<button data-ptpick="${p.id}" data-ptgo="pet" style="--tone:${ptTone(p)}">${ptFace(p, "sm")}<b>${esc(p.name)}</b><small>${esc(ptAgeTxt(p) || "age?")}</small></button>`).join("")}</div></div>`;
}

// ------------------------------------------------------------ ONE PET'S PAGE (the storybook)
function ptPetHtml() {
  const p = ptCur(); if (!p) return ptAddHtml();
  if (p.passed) return ptBridgeHtml();
  const t = today(), b = ptNextBday(p), g = ptNextGotcha(p), ms = ptMilestone(p), st = ptStage(p), tasks = ptCareDue(t, p.id), doses = ptDoses(t, p.id);
  const shot = ptShotsDue(p.id)[0], visit = ptVisitsNext(p.id)[0], w = ptOf(pt().weights, p.id).sort((a, c) => a.date.localeCompare(c.date)), lastW = w[w.length - 1];
  const mems = ptOf(pt().mems, p.id), sp = ptSp(p.species);
  return `${ptPicker("pet")}
    <section class="pt-story" style="--tone:${ptTone(p)}">${ptFace(p, "hero")}
      <h3>${esc(p.name)}</h3><p>${sp[1]} ${esc(p.breed || sp[2])}${p.sex ? ` · ${p.sex === "f" ? "Girl" : "Boy"}` : ""}${st ? ` · ${st}` : ""}</p>
      <div class="pt-agebig">${p.bday ? `<b>${esc(ptAgeTxt(p, "long"))}</b><small>old${p.est ? " (estimated)" : ""}</small>` : `<button class="pt-link" data-ptedit="${p.id}">Add a birthday or an estimated age</button>`}</div>
      <div class="pt-counts">${b ? `<span><b>${b.days ? b.days : "🎂"}</b><small>${b.days ? `days to birthday #${b.turns}` : `${b.turns} today!`}</small></span>` : ""}
        ${g ? `<span><b>${g.days ? g.days : "🏡"}</b><small>${g.days ? `days to Gotcha Day` : "Gotcha Day!"}</small></span>` : ""}
        ${p.gotcha ? `<span><b>${esc(ptAgeTxt({ bday: p.gotcha }) || "new")}</b><small>with your family</small></span>` : ""}</div>
      ${ms ? `<p class="pt-mile">⭐ ${ms.days ? `Next milestone: <b>${esc(ms.label)}</b> ${ptRel(ms.date)}` : `<b>${esc(ptMileTxt(p, ms))}</b>`}</p>` : ""}
      <button class="pt-cta pt-memories" data-pttab="mem">🖼️ Our Memories <small>${mems.length ? ptPl(mems.length, "moment") : "start the story"}</small></button>
    </section>
    <div class="pt-box"><div class="pt-boxhead"><h3>🦮 Today's care</h3><button class="pt-link" data-pttab="care">Edit</button></div>
      ${tasks.length ? tasks.map(x => ptTaskRow(x, t, false)).join("") : `<p class="pt-hint">Nothing set for today. <button class="pt-link" data-pttab="care">Add feeding, walks, grooming…</button></p>`}
      ${doses.map(d => ptDoseRow(d)).join("")}</div>
    <div class="pt-quick">
      <button data-pttab="health" style="--q:#ff8a7a">🩺<b>Health & Records</b><small>${shot ? `${esc(shot.name)} ${daysUntil(shot.due) < 0 ? "overdue" : "due " + ptRel(shot.due)}` : visit ? `Vet ${ptRel(visit.date)}` : "Shots, vet, meds"}</small></button>
      <button data-pttab="pass" style="--q:#7cb7f2">🛂<b>Pet Passport</b><small>${p.chip ? "Microchip saved" : "ID & emergency"}</small></button>
      <button data-pttab="bday" style="--q:#ffc24d">🎂<b>Birthdays</b><small>${b ? ptDate(b.date) : "Add a birthday"}</small></button>
      <button data-pttab="health" data-ptform="weight" style="--q:#6fd3c1">⚖️<b>Weight</b><small>${lastW ? `${lastW.lb} lb · ${ptDate(lastW.date)}` : "Start a growth chart"}</small></button></div>
    ${st && PT_STAGE_TIP[st] ? `<p class="pt-tip">💡 <b>${esc(st)}:</b> ${esc(PT_STAGE_TIP[st])} <small>${PT_ADV}</small></p>` : ""}
    <button class="pt-ghost" data-ptedit="${p.id}">✏️ Edit ${esc(p.name)}'s profile</button>`;
}
function ptDoseRow(d) {
  return `<div class="pt-row pt-dose${d.st ? " done" : ""}"><span class="pt-dosetime">${hm(d.time)}</span><span class="grow"><b>💊 ${esc(d.m.name)}</b><small>${d.m.dose ? esc(d.m.dose) : "as the vet said"}${d.st ? ` · ${d.st === "taken" ? "given ✓" : "skipped"}` : ""}</small></span>
    ${d.st ? `<button class="pt-mini" data-ptdose="${d.k}" data-ptst="">Undo</button>` : `<button class="pt-mini ok" data-ptdose="${d.k}" data-ptst="taken">Given</button><button class="pt-mini" data-ptdose="${d.k}" data-ptst="skipped">Skip</button>`}</div>`;
}

// ------------------------------------------------------------ BIRTHDAYS & AGES
function ptBdayHtml() {
  const living = ptLiving(), up = living.map(p => ({ p, b: ptNextBday(p) })).filter(x => x.b).sort((a, b) => a.b.days - b.b.days), first = up[0];
  const base = new Date(Number(today().slice(0, 4)), Number(today().slice(5, 7)) - 1 + PT_MONTH, 1), Y = base.getFullYear(), M = base.getMonth();
  const marks = {};
  living.forEach(p => { [[p.bday, "🎂"], [p.gotcha, "🏡"]].forEach(([d, ic]) => { if (!ptIsD(d)) return; const mm = Number(d.slice(5, 7)) - 1; if (mm !== M) return;
    const day = Math.min(Number(d.slice(8, 10)), new Date(Y, M + 1, 0).getDate()); (marks[day] = marks[day] || []).push({ p, ic }); }); });
  const lead = new Date(Y, M, 1).getDay(), days = new Date(Y, M + 1, 0).getDate(), isNow = Y === Number(today().slice(0, 4)) && M === Number(today().slice(5, 7)) - 1;
  const cells = [...Array(lead).fill(""), ...Array.from({ length: days }, (_, i) => i + 1)];
  ptPaintSoon();
  return `${first ? `<section class="pt-party" style="--tone:${ptTone(first.p)}">${ptFace(first.p, "party")}<span class="pt-hat" aria-hidden="true">🥳</span>
      <div class="pt-bubble"><b>${esc(first.p.name)} turns ${first.b.turns}</b><span>${first.b.days ? `in ${ptPl(first.b.days, "day")}!` : "today! 🎉"}</span></div><span class="pt-cake" aria-hidden="true">🎂</span></section>`
    : `<p class="pt-hint">Add a birthday (or an estimated age) to a pet's profile and the countdown starts here.</p>`}
    <div class="pt-box pt-cal"><div class="pt-calhead"><button data-ptmonth="-1" aria-label="Previous month">←</button><b>${base.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b><button data-ptmonth="1" aria-label="Next month">→</button></div>
      <div class="pt-calgrid">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<span class="dow">${d}</span>`).join("")}${cells.map(d => d === "" ? `<span></span>`
        : `<span class="${marks[d] ? "mark" : ""}${isNow && d === Number(today().slice(8, 10)) ? " now" : ""}" ${marks[d] ? `title="${esc(marks[d].map(x => x.p.name + (x.ic === "🎂" ? " birthday" : " Gotcha Day")).join(", "))}"` : ""}>${marks[d] ? `<em>${marks[d][0].ic === "🎂" ? "🐾" : "🏡"}</em>` : d}</span>`).join("")}</div></div>
    <div class="pt-box"><h3>🎁 Upcoming Pet Birthdays</h3>${up.length ? up.map(({ p, b }) => `<button class="pt-row" data-ptpick="${p.id}" data-ptgo="pet">${ptFace(p, "xs")}<span class="grow"><b>${esc(p.name)}</b><small>${b.days ? `Turns ${b.turns} in ${ptPl(b.days, "day")}!` : `Turns ${b.turns} today!`}</small></span><span class="pt-chip">${prettyDate(b.date)}</span><em>›</em></button>`).join("")
      : `<p class="pt-hint">No birthdays saved yet.</p>`}</div>
    ${first ? `<button class="pt-slidebtn" data-ptshow="${first.p.id}"><span class="pt-slidepic">${ptFace(first.p, "sm")}</span><span class="grow"><b>Create Birthday Slideshow</b><small>${esc(first.p.name)}'s best moments, year by year</small></span><span class="pt-play" aria-hidden="true">▶</span></button>` : ""}
    <div class="pt-box"><h3>🎂 Pet Ages at a Glance</h3><div class="pt-ages">${ptPets().map(p => `<button data-ptpick="${p.id}" data-ptgo="${p.passed ? "bridge" : "pet"}" style="--tone:${ptTone(p)}">${ptFace(p, "sm")}<b>${esc(p.name)}</b><small>${esc(ptAgeTxt(p) || "age?")}</small></button>`).join("")}</div></div>`;
}

// ------------------------------------------------------------ MEMORY MOMENTS (the life journey)
function ptJourney(p) {
  const mems = ptOf(pt().mems, p.id).filter(m => ptIsD(m.date)), out = mems.map(m => ({ ...m, real: true }));
  if (ptIsD(p.gotcha) && !mems.some(m => m.kind === "home")) out.push({ id: "", pet: p.id, kind: "home", title: "First Day Home", date: p.gotcha, photo: "", real: false });
  if (ptIsD(p.bday) && !p.est) { const b1 = addDays(p.bday, 0).replace(/^\d{4}/, String(Number(p.bday.slice(0, 4)) + 1));
    if (b1 <= today() && !mems.some(m => m.kind === "bday" && m.date.slice(0, 4) === b1.slice(0, 4))) out.push({ id: "", pet: p.id, kind: "bday", title: "First Birthday", date: b1, photo: "", real: false }); }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
function ptMemHtml() {
  const p = ptCur(); if (!p) return ptAddHtml();
  const J = ptJourney(p), pics = ptOf(pt().mems, p.id).filter(m => m.photo).sort((a, b) => a.date.localeCompare(b.date));
  const thenP = pics[0], nowP = pics.length > 1 ? pics[pics.length - 1] : null, otd = ptOnThisDay().filter(m => m.pet === p.id);
  ptPaintSoon();
  return `${ptPicker("mem")}
    <div class="pt-journeyhead">${ptFace(p, "sm")}<b>${esc(p.name)}'s Life Journey</b></div>
    ${otd.length ? `<div class="pt-box pt-otd"><h3>📅 On This Day</h3>${otd.map(m => `<div class="pt-row">${ptMemPic(m)}<span class="grow"><b>${esc(m.title)}</b><small>${ptPl(Number(today().slice(0, 4)) - Number(m.date.slice(0, 4)), "year")} ago</small></span></div>`).join("")}</div>` : ""}
    ${PT_MEMADD ? ptMemForm(p) : `<button class="pt-cta" data-ptmemnew="1">📸 Add Memory</button>`}
    <ol class="pt-timeline">${J.map(m => `<li>${ptMemPic(m)}<span class="grow"><b>${esc(m.title || ptMk(m.kind)[2])}</b><small>${ptDate(m.date)}${p.bday && !p.est && m.date >= p.bday ? ` · age ${esc(ptAgeTxt(p, "short", m.date))}` : ""}</small>${m.note ? `<span class="pt-note">${esc(m.note)}</span>` : ""}</span>
        <span class="pt-heart" aria-hidden="true">${m.kind === "bday" ? "🎂" : m.kind === "home" ? "🏡" : "♡"}</span>${m.real ? `<button class="pt-x" data-ptdel="mems:${m.id}" aria-label="Delete ${esc(m.title)}">✕</button>` : ""}</li>`).join("")
      || `<li class="pt-empty">Start ${esc(p.name)}'s story: the first photo, the day they came home, a favourite walk.</li>`}</ol>
    ${pics.length ? `<div class="pt-box"><h3>📖 Scrapbook</h3><div class="pt-scrap">${pics.slice(-9).reverse().map((m, i) => `<figure style="--r:${[-4, 3, -2, 5, -3, 2, -5, 4, -1][i % 9]}deg">${ptMemPic(m)}<figcaption>${esc(m.title)}</figcaption></figure>`).join("")}</div></div>` : ""}
    ${thenP && nowP ? `<div class="pt-box"><h3>🖼️ Then & Now</h3><div class="pt-thennow"><figure>${ptMemPic(thenP)}<figcaption><b>Then</b><small>${p.bday && !p.est ? esc(ptAgeTxt(p, "short", thenP.date)) : ptMonthYr(thenP.date)}</small></figcaption></figure>
        <span class="pt-arrow" aria-hidden="true">➜</span><figure>${ptMemPic(nowP)}<figcaption><b>Now</b><small>${p.bday && !p.est ? esc(ptAgeTxt(p, "short", nowP.date)) : ptMonthYr(nowP.date)}</small></figcaption></figure></div></div>` : ""}
    ${pics.length >= 2 ? `<button class="pt-slidebtn" data-ptshow="${p.id}"><span class="pt-slidepic">${ptFace(p, "sm")}</span><span class="grow"><b>Play ${esc(p.name)}'s slideshow</b><small>${ptPl(pics.length, "photo")}, oldest first</small></span><span class="pt-play" aria-hidden="true">▶</span></button>` : ""}`;
}
function ptMemForm(p) {
  return `<form class="pt-form pt-box" data-ptmem="${p.id}"><h3>📸 New memory for ${esc(p.name)}</h3>
    <div class="pt-memkinds">${PT_MEMK.map(([k, i, l], n) => `<label><input type="radio" name="kind" value="${k}" ${n === 0 && !ptOf(pt().mems, p.id).some(m => m.kind === "home") ? "checked" : k === "photo" && ptOf(pt().mems, p.id).some(m => m.kind === "home") ? "checked" : ""}><span>${i}<small>${l}</small></span></label>`).join("")}</div>
    <label class="field">Title<input name="title" maxlength="60" placeholder="e.g. Beach Adventure"></label>
    <label class="field">Date<input name="date" type="date" value="${today()}" max="${today()}" required></label>
    <label class="field">The story (optional)<textarea name="note" rows="2" maxlength="400" placeholder="What happened, who was there, the funny part"></textarea></label>
    <div class="pt-photoin">${PT_MEMPIC ? `<span class="pt-pic pt-mempic has"><img src="${PT_MEMPIC}" alt="Chosen photo"></span>` : ""}<label class="pt-ghost">📷 ${PT_MEMPIC ? "Change photo" : "Add a photo"}<input type="file" accept="image/*" data-ptmempic="1" hidden></label></div>
    <div class="pt-formbtns"><button class="pt-cta">Save memory</button><button type="button" class="pt-ghost" data-ptmemnew="0">Cancel</button></div></form>`;
}

// ------------------------------------------------------------ ADD / EDIT A PET (board screen 4)
function ptAddHtml() { return ptPetForm(PT_EDIT ? ptPet(PT_EDIT) : null, "pet"); }
function ptPetForm(p, how) {
  const v = p || {}, sp = v.species || "dog", photo = PT_PENDING || "";
  const hasPhoto = !!(PT_PENDING || v.photo);
  ptPaintSoon();
  return `<form class="pt-form pt-addform${v.est ? " pt-est" : ""}" data-ptpetform="${how}" ${p ? `data-ptid="${p.id}"` : ""}>
    ${how === "setup" ? `<label class="field">Your first name (optional)<input name="owner" maxlength="30" autocomplete="given-name" placeholder="e.g. Scott" value="${esc(S.name || "")}"></label>` : `<p class="pt-sub">${p ? `Update ${esc(p.name)}'s profile.` : "Create a profile for your new family member!"}</p>`}
    <h3><span class="pt-step">1</span> Choose a Species</h3>
    <div class="pt-species">${PT_SPECIES.map(([k, i, l]) => `<label><input type="radio" name="species" value="${k}" ${sp === k ? "checked" : ""}><span>${i}<b>${l}</b></span></label>`).join("")}</div>
    <h3><span class="pt-step">2</span> Pet Details</h3>
    <label class="field">Name *<input name="name" maxlength="30" required placeholder="e.g. Biscuit" value="${esc(v.name || "")}"></label>
    <label class="field">Breed or kind (optional)<input name="breed" maxlength="40" placeholder="e.g. Golden Retriever" value="${esc(v.breed || "")}"></label>
    <div class="pt-agechoice"><label><input type="radio" name="agehow" value="date" ${!v.est ? "checked" : ""}> I know the birthday</label><label><input type="radio" name="agehow" value="est" ${v.est ? "checked" : ""}> Rescue: about how old</label></div>
    <div class="pt-agein"><label class="field pt-bdayf">Birthday<input name="bday" type="date" max="${today()}" value="${!v.est && ptIsD(v.bday) ? v.bday : ""}"></label>
      <div class="pt-estf"><label class="field">Years<input name="ey" type="number" min="0" max="60" inputmode="numeric" value="${v.est && v.bday ? (ptAge(v.bday) || {}).y || 0 : ""}"></label><label class="field">Months<input name="em" type="number" min="0" max="11" inputmode="numeric" value="${v.est && v.bday ? (ptAge(v.bday) || {}).m || 0 : ""}"></label></div></div>
    <label class="field">Gotcha Day <small>(the day they joined your family)</small><input name="gotcha" type="date" max="${today()}" value="${ptIsD(v.gotcha) ? v.gotcha : ""}"></label>
    <div class="pt-two"><label class="field">Boy or girl<select name="sex"><option value="">-</option><option value="m" ${v.sex === "m" ? "selected" : ""}>Boy</option><option value="f" ${v.sex === "f" ? "selected" : ""}>Girl</option></select></label>
      <label class="field">Colour / markings<input name="look" maxlength="40" placeholder="e.g. Golden" value="${esc(v.look || "")}"></label></div>
    <div class="pt-tones" role="radiogroup" aria-label="Pet Hub colour for this pet">${PT_TONES.map((c, i) => `<label style="--tone:${c}"><input type="radio" name="color" value="${c}" ${(v.color || PT_TONES[ptPets().length % PT_TONES.length]) === c ? "checked" : ""} aria-label="Colour ${i + 1}"><span></span></label>`).join("")}</div>
    <h3><span class="pt-step">3</span> Profile Photo</h3>
    <div class="pt-photoin">${hasPhoto ? `<span class="pt-pic pt-hero has">${photo ? `<img src="${photo}" alt="Chosen photo">` : `<img data-ptimg="${esc(v.photo)}" alt="">`}</span>` : `<span class="pt-pic pt-hero"><i aria-hidden="true">${ptSp(sp)[1]}</i></span>`}
      <label class="pt-dash">📷 ${hasPhoto ? "Change the photo" : "Add a profile photo (or take a new one)"}<input type="file" accept="image/*" data-ptphoto="1" hidden></label></div>
    ${!p ? `<label class="pt-check2"><input type="checkbox" name="starter" checked> Start with a simple daily routine for this <span class="pt-startname">${esc(ptSp(sp)[2].toLowerCase())}</span> (change it any time)</label>` : ""}
    <button class="pt-cta">${p ? "Save" : "Continue"} <span aria-hidden="true">→</span></button>
  </form>
  ${p ? `<div class="pt-danger">${p.passed ? `<button type="button" class="pt-ghost" data-ptunbridge="${p.id}">Undo Rainbow Bridge</button>` : `<button type="button" class="pt-ghost" data-ptbridgeask="${p.id}">🌈 In loving memory…</button>`}
      <button type="button" class="pt-ghost warn" data-ptremove="${p.id}">${PT_ARM === "rm:" + p.id ? "Tap again to remove " + esc(p.name) + " and everything saved for them" : "Remove this pet"}</button></div>` : ""}`;
}

// ------------------------------------------------------------ DAILY CARE
function ptCareHtml() {
  const p = ptCur(); if (!p) return ptAddHtml();
  const t = today(), tasks = ptCareDue(t, p.id), list = ptOf(pt().care, p.id).filter(c => !c.off);
  return `${ptPicker("care")}
    <div class="pt-box"><div class="pt-boxhead"><h3>✅ Today</h3><span>${tasks.filter(x => x.done).length}/${tasks.length}</span></div>
      ${tasks.length ? tasks.map(x => ptTaskRow(x, t, false)).join("") : `<p class="pt-hint">Nothing due today for ${esc(p.name)}.</p>`}</div>
    <div class="pt-box"><h3>🔁 ${esc(p.name)}'s routine</h3>${list.length ? list.map(c => `<div class="pt-row"><span class="pt-careic">${ptCk(c.kind)[1]}</span><span class="grow"><b>${esc(c.title)}</b><small>${ptEveryTxt(c)}${c.times.length ? " · " + c.times.map(hm).join(", ") : ""}</small></span><button class="pt-x" data-ptdel="care:${c.id}" aria-label="Delete ${esc(c.title)}">✕</button></div>`).join("")
      : `<p class="pt-hint">No routine yet.</p>`}</div>
    <form class="pt-form pt-box" data-ptcare="${p.id}"><h3>＋ Add to the routine</h3>
      <div class="pt-two"><label class="field">Kind<select name="kind">${PT_CARE.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select></label>
        <label class="field">What<input name="title" maxlength="50" placeholder="e.g. Breakfast - 1 cup"></label></div>
      <div class="pt-two"><label class="field">How often<select name="every">${PT_EVERY.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
        <label class="field">Time (optional)<input name="time" type="time"></label></div>
      <div class="pt-two"><label class="field">Day of the week<select name="dow">${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => `<option value="${i}" ${parseDay(t).getDay() === i ? "selected" : ""}>${d}</option>`).join("")}</select></label>
        <label class="field">Day of the month<input name="dom" type="number" min="1" max="31" value="${Number(t.slice(8, 10))}" inputmode="numeric"></label></div>
      <p class="fine">Weekly uses the day of the week, monthly the day of the month (flea and heartworm doses, nail trims…).</p>
      <button class="pt-cta">Add</button></form>`;
}
const ptEveryTxt = c => c.every === "weekly" ? `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(c.dow || 0)]}` : c.every === "monthly" ? `Monthly on the ${Number(c.dom || 1)}${["th", "st", "nd", "rd"][(Number(c.dom) % 100 > 10 && Number(c.dom) % 100 < 14) ? 0 : Math.min(Number(c.dom) % 10, 4) % 4] || "th"}` : "Every day";

// ------------------------------------------------------------ HEALTH & RECORDS (shots, vet visits, medicines, weight)
function ptHealthHtml() {
  const p = ptCur(); if (!p) return ptAddHtml();
  const P = pt(), t = today(), shots = ptOf(P.shots, p.id).sort((a, b) => (a.due || "9").localeCompare(b.due || "9")), visits = ptOf(P.visits, p.id).sort((a, b) => b.date.localeCompare(a.date));
  const meds = ptOf(P.meds, p.id).filter(m => !m.off), w = ptOf(P.weights, p.id).sort((a, b) => a.date.localeCompare(b.date)), F = PT_FORM;
  const up = visits.filter(v => v.date >= t).reverse(), past = visits.filter(v => v.date < t);
  return `${ptPicker("health")}
    <div class="pt-box"><div class="pt-boxhead"><h3>💉 Shots & vaccines</h3><button class="pt-link" data-ptform="shot">＋ Add</button></div>
      ${F === "shot" ? `<form class="pt-form" data-ptshot="${p.id}"><label class="field">Which shot<input name="name" maxlength="50" required placeholder="e.g. Rabies, DHPP, FVRCP"></label>
        <div class="pt-two"><label class="field">Given on<input name="given" type="date" max="${t}"></label><label class="field">Next due<input name="due" type="date"></label></div>
        <div class="pt-formbtns"><button class="pt-cta">Save</button><button type="button" class="pt-ghost" data-ptform="">Cancel</button></div></form>` : ""}
      ${shots.length ? shots.map(s => `<div class="pt-row"><span class="pt-careic">💉</span><span class="grow"><b>${esc(s.name)}</b><small>${s.given ? "Given " + ptDate(s.given) : ""}${s.given && s.due ? " · " : ""}${s.due ? (daysUntil(s.due) < 0 ? `<span class="pt-late">Overdue since ${ptDate(s.due)}</span>` : "Due " + ptRel(s.due)) : ""}</small></span><button class="pt-x" data-ptdel="shots:${s.id}" aria-label="Delete ${esc(s.name)}">✕</button></div>`).join("") : `<p class="pt-hint">No shots saved. Add the next one due and Pet Hub reminds you a week ahead.</p>`}</div>
    <div class="pt-box"><div class="pt-boxhead"><h3>🩺 Vet visits</h3><button class="pt-link" data-ptform="visit">＋ Add</button></div>
      ${F === "visit" ? `<form class="pt-form" data-ptvisit="${p.id}"><div class="pt-two"><label class="field">Date<input name="date" type="date" value="${t}" required></label><label class="field">Time (optional)<input name="time" type="time"></label></div>
        <div class="pt-two"><label class="field">Vet / clinic<input name="vet" maxlength="50" value="${esc(p.vet || "")}"></label><label class="field">Why<input name="reason" maxlength="60" placeholder="e.g. Yearly checkup"></label></div>
        <label class="field">What the vet said (notes)<textarea name="notes" rows="2" maxlength="500"></textarea></label><label class="field">Cost (optional)<input name="cost" inputmode="decimal" placeholder="$"></label>
        <div class="pt-formbtns"><button class="pt-cta">Save</button><button type="button" class="pt-ghost" data-ptform="">Cancel</button></div></form>` : ""}
      ${up.map(v => ptVisitRow(v, true)).join("")}${past.slice(0, 6).map(v => ptVisitRow(v, false)).join("")}${!visits.length ? `<p class="pt-hint">No visits yet. Add the next appointment and keep the vet's notes in one place.</p>` : ""}</div>
    <div class="pt-box"><div class="pt-boxhead"><h3>💊 Medicines</h3><button class="pt-link" data-ptform="med">＋ Add</button></div>
      ${F === "med" ? `<form class="pt-form" data-ptmed="${p.id}"><label class="field">Medicine<input name="name" maxlength="50" required placeholder="e.g. Heartworm chew"></label>
        <label class="field">How much, exactly as the vet said<input name="dose" maxlength="60" placeholder="e.g. 1 chew"></label>
        <div class="pt-two"><label class="field">Time<input name="t1" type="time"></label><label class="field">2nd time (optional)<input name="t2" type="time"></label></div>
        <div class="pt-two"><label class="field">Doses left (optional)<input name="left" type="number" min="0" inputmode="numeric"></label><label class="field">Last day (optional)<input name="end" type="date"></label></div>
        <p class="fine">Monthly doses (flea, heartworm)? Add them under Daily Care as "monthly" instead.</p>
        <div class="pt-formbtns"><button class="pt-cta">Save</button><button type="button" class="pt-ghost" data-ptform="">Cancel</button></div></form>` : ""}
      ${ptDoses(t, p.id).map(d => ptDoseRow(d)).join("")}
      ${meds.length ? meds.map(m => { const r = ptRefill(m); return `<div class="pt-row"><span class="pt-careic">💊</span><span class="grow"><b>${esc(m.name)}</b><small>${m.dose ? esc(m.dose) : ""}${m.times.length ? " · " + m.times.map(hm).join(", ") : ""}${r.days != null ? ` · <span class="${r.soon ? "pt-late" : ""}">about ${ptPl(r.days, "day")} left</span>` : ""}${m.end ? " · until " + ptDate(m.end) : ""}</small></span><button class="pt-x" data-ptdel="meds:${m.id}" aria-label="Delete ${esc(m.name)}">✕</button></div>`; }).join("") : F === "med" ? "" : `<p class="pt-hint">No medicines.</p>`}</div>
    <div class="pt-box"><div class="pt-boxhead"><h3>⚖️ Weight & growth</h3><button class="pt-link" data-ptform="weight">＋ Add</button></div>
      ${F === "weight" ? `<form class="pt-form" data-ptweight="${p.id}"><div class="pt-two"><label class="field">Weight (lb)<input name="lb" inputmode="decimal" required placeholder="e.g. 62.5"></label><label class="field">Date<input name="date" type="date" value="${t}" max="${t}"></label></div>
        <div class="pt-formbtns"><button class="pt-cta">Save</button><button type="button" class="pt-ghost" data-ptform="">Cancel</button></div></form>` : ""}
      ${w.length ? ptWeightChart(w) + w.slice(-5).reverse().map(x => `<div class="pt-row"><span class="grow"><b>${x.lb} lb</b><small>${ptDate(x.date)}${p.bday && !p.est ? " · age " + esc(ptAgeTxt(p, "short", x.date)) : ""}</small></span><button class="pt-x" data-ptdel="weights:${x.id}" aria-label="Delete">✕</button></div>`).join("") : `<p class="pt-hint">Weigh-ins draw a growth chart here.</p>`}</div>
    <p class="fine pt-adv">${PT_ADV}</p>`;
}
const ptVisitRow = (v, soon) => `<div class="pt-row${soon ? " pt-soon" : ""}"><span class="pt-careic">${soon ? "📅" : "🩺"}</span><span class="grow"><b>${soon ? ptRel(v.date) : ptDate(v.date)}${v.time ? " · " + hm(v.time) : ""}${v.reason ? " · " + esc(v.reason) : ""}</b><small>${esc(v.vet || "")}${v.cost ? ` · ${esc(v.cost)}` : ""}</small>${v.notes ? `<span class="pt-note">${esc(v.notes)}</span>` : ""}</span><button class="pt-x" data-ptdel="visits:${v.id}" aria-label="Delete visit">✕</button></div>`;
function ptWeightChart(w) {
  const pts = w.slice(-12), lo = Math.min(...pts.map(x => x.lb)), hi = Math.max(...pts.map(x => x.lb)), span = hi - lo || 1, W = 300, H = 110;
  const xy = pts.map((x, i) => [pts.length === 1 ? W / 2 : 14 + i * (W - 28) / (pts.length - 1), H - 16 - (x.lb - lo) / span * (H - 36)]);
  return `<svg class="pt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight from ${pts[0].lb} to ${pts[pts.length - 1].lb} pounds">
    <polyline points="${xy.map(p => p.join(",")).join(" ")}" fill="none" stroke="var(--pt-tone,#ff6b57)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#fff" stroke="var(--pt-tone,#ff6b57)" stroke-width="3"/>${i === 0 || i === xy.length - 1 ? `<text x="${x}" y="${y - 9}" text-anchor="middle">${pts[i].lb}</text>` : ""}`).join("")}</svg>`;
}

// ------------------------------------------------------------ PET PASSPORT (ID, microchip, emergency, papers)
function ptPassHtml() {
  const p = ptCur(); if (!p) return ptAddHtml();
  const papers = ptOf(pt().papers, p.id), sp = ptSp(p.species);
  ptPaintSoon();
  return `${ptPicker("pass")}
    <section class="pt-passport" style="--tone:${ptTone(p)}"><div class="pt-passtop"><b>🛂 PET PASSPORT</b><small>Pet Hub</small></div>
      <div class="pt-passbody">${ptFace(p, "pass")}<dl><dt>Name</dt><dd>${esc(p.name)}</dd><dt>Species</dt><dd>${sp[1]} ${esc(p.breed || sp[2])}</dd>
        ${p.look ? `<dt>Colour</dt><dd>${esc(p.look)}</dd>` : ""}${p.sex ? `<dt>Sex</dt><dd>${p.sex === "f" ? "Girl" : "Boy"}</dd>` : ""}
        ${p.bday ? `<dt>Born</dt><dd>${p.est ? "about " + ptMonthYr(p.bday) : ptDate(p.bday)}</dd>` : ""}<dt>Microchip</dt><dd>${esc(p.chip || "-")}${p.chipCo ? ` <small>(${esc(p.chipCo)})</small>` : ""}</dd>
        ${p.tag ? `<dt>Tag / license</dt><dd>${esc(p.tag)}</dd>` : ""}</dl></div></section>
    <div class="pt-box"><h3>🆘 If something happens</h3>
      ${p.vet || p.vetPh ? `<a class="pt-row pt-call" href="tel:${esc(String(p.vetPh || "").replace(/[^\d+]/g, ""))}"><span class="pt-careic">🩺</span><span class="grow"><b>${esc(p.vet || "Regular vet")}</b><small>${esc(p.vetPh || "")}</small></span><em>📞</em></a>` : ""}
      ${p.evet || p.evetPh ? `<a class="pt-row pt-call" href="tel:${esc(String(p.evetPh || "").replace(/[^\d+]/g, ""))}"><span class="pt-careic">🚑</span><span class="grow"><b>${esc(p.evet || "Emergency vet")}</b><small>${esc(p.evetPh || "")}</small></span><em>📞</em></a>` : ""}
      <a class="pt-row pt-call" href="tel:+18884264435"><span class="pt-careic">☠️</span><span class="grow"><b>ASPCA Animal Poison Control</b><small>(888) 426-4435 · 24/7, a fee may apply</small></span><em>📞</em></a>
      ${p.ins || p.insNo ? `<div class="pt-row"><span class="pt-careic">🛡️</span><span class="grow"><b>${esc(p.ins || "Pet insurance")}</b><small>${esc(p.insNo || "")}</small></span></div>` : ""}
      ${p.feed ? `<div class="pt-row"><span class="pt-careic">📝</span><span class="grow"><b>For the sitter</b><span class="pt-note">${esc(p.feed)}</span></span></div>` : ""}</div>
    <div class="pt-box"><h3>📄 Papers</h3><div class="pt-papers">${papers.map(d => `<figure><span class="pt-pic pt-mempic"><i aria-hidden="true">${(PT_PAPERS.find(x => x[0] === d.type) || PT_PAPERS[4])[1]}</i><img data-ptimg="${esc(d.photo)}" alt=""></span><figcaption>${esc(d.title)}</figcaption><button class="pt-x" data-ptdel="papers:${d.id}" aria-label="Delete ${esc(d.title)}">✕</button></figure>`).join("")}</div>
      <form class="pt-inline" onsubmit="return false"><select data-ptpapertype="1" aria-label="Kind of paper">${PT_PAPERS.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select>
        <label class="pt-ghost">📷 Add a photo<input type="file" accept="image/*" data-ptpaper="${p.id}" hidden></label></form>
      <p class="fine">Kept on this phone only - never in the backup.</p></div>
    <form class="pt-form pt-box" data-ptpass="${p.id}"><h3>✏️ Passport details</h3>
      <div class="pt-two"><label class="field">Microchip number<input name="chip" maxlength="30" value="${esc(p.chip || "")}" inputmode="numeric"></label><label class="field">Microchip company<input name="chipCo" maxlength="40" value="${esc(p.chipCo || "")}"></label></div>
      <label class="field">Tag / license number<input name="tag" maxlength="30" value="${esc(p.tag || "")}"></label>
      <div class="pt-two"><label class="field">Regular vet<input name="vet" maxlength="50" value="${esc(p.vet || "")}"></label><label class="field">Vet phone<input name="vetPh" type="tel" maxlength="25" value="${esc(p.vetPh || "")}"></label></div>
      <div class="pt-two"><label class="field">Emergency vet (24 h)<input name="evet" maxlength="50" value="${esc(p.evet || "")}"></label><label class="field">Its phone<input name="evetPh" type="tel" maxlength="25" value="${esc(p.evetPh || "")}"></label></div>
      <div class="pt-two"><label class="field">Pet insurance<input name="ins" maxlength="40" value="${esc(p.ins || "")}"></label><label class="field">Policy number<input name="insNo" maxlength="30" value="${esc(p.insNo || "")}"></label></div>
      <label class="field">Notes for a sitter or a trip (food, quirks, travel)<textarea name="feed" rows="3" maxlength="500">${esc(p.feed || "")}</textarea></label>
      <button class="pt-cta">Save passport</button></form>`;
}

// ------------------------------------------------------------ RAINBOW BRIDGE (an optional, gentle memorial)
function ptBridgeHtml() {
  const p = ptCur(); if (!p) return ptAddHtml();
  if (!p.passed) return `<p class="pt-sub">${esc(p.name)} is with you. 💛</p>${ptPetHtml()}`;
  const mems = ptJourney(p);
  ptPaintSoon();
  return `${ptPicker("bridge")}<section class="pt-bridge">${ptFace(p, "hero")}<h3>${esc(p.name)}</h3>
      <p>${p.bday ? `${p.est ? "about " + ptMonthYr(p.bday) : ptDate(p.bday)} – ` : ""}${ptDate(p.passed)}</p>
      <p class="pt-forever">Forever in our hearts</p>${p.bday ? `<p class="pt-sub">${esc(ptAgeTxt(p, "long", p.passed))} of love${p.gotcha ? `, ${esc(ptAgeTxt({ bday: p.gotcha }, "long", p.passed) || "")} with your family` : ""}.</p>` : ""}</section>
    <ol class="pt-timeline">${mems.map(m => `<li>${ptMemPic(m)}<span class="grow"><b>${esc(m.title || ptMk(m.kind)[2])}</b><small>${ptDate(m.date)}</small>${m.note ? `<span class="pt-note">${esc(m.note)}</span>` : ""}</span></li>`).join("")}</ol>
    <button class="pt-cta" data-pttab="mem">📸 Add a memory</button>
    ${ptOf(pt().mems, p.id).filter(m => m.photo).length >= 2 ? `<button class="pt-slidebtn" data-ptshow="${p.id}"><span class="pt-slidepic">${ptFace(p, "sm")}</span><span class="grow"><b>Play ${esc(p.name)}'s slideshow</b><small>Every photo, oldest first</small></span><span class="pt-play" aria-hidden="true">▶</span></button>` : ""}`;
}

// ------------------------------------------------------------ NEEDS YOU + MORE
function ptNeedsHtml() {
  const N = ptNeeds();
  return N.length ? N.map(x => `<button class="pt-row pt-need${x.late ? " late" : ""}" data-ptpick="${x.pet}" data-ptgo="${x.tab}"><span class="pt-careic">${x.icon}</span><span class="grow"><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></span><em>›</em></button>`).join("")
    : `<p class="pt-hint">✨ All caught up${S.name ? ", " + esc(S.name) : ""}. Everyone's taken care of.</p>`;
}
function ptMoreHtml() {
  const gone = ptPets().filter(p => p.passed).length;
  return tileNav([["＋", "Add a pet", 'data-ptnew="1"'], ["🦮", "Daily care", 'data-pttab="care"'], ["🩺", "Health & records", 'data-pttab="health"'], ["🛂", "Pet passport", 'data-pttab="pass"'],
    ["🖼️", "Memories", 'data-pttab="mem"'], ["🎂", "Birthdays", 'data-pttab="bday"'], ["🐾", "All my pets", 'data-pttab="all"'], ...(gone ? [["🌈", "Rainbow Bridge", 'data-pttab="bridge"']] : []),
    ["💡", "Ask Pet Hub", 'data-ask="open" data-ptclose="1"'], ["⚙️", "Settings & backup", 'data-open="sheet" data-ptclose="1"']].map(([i, l, a]) => ({ icon: i, label: l, attrs: a })), 3, "pt-tiles")
    + `<p class="fine pt-adv">Pet Hub - a Marvel Corp app, part of the Hub family. ${PT_ADV} Everything you type stays on this phone unless you turn on backup; photos stay on this phone only.</p>`;
}

// ------------------------------------------------------------ the birthday slideshow (photos on the phone, oldest first)
let PT_SHOW = null;
async function ptShow(petId) {
  const p = ptPet(petId); if (!p) return;
  const pics = ptOf(pt().mems, p.id).filter(m => m.photo && ptIsD(m.date)).sort((a, b) => a.date.localeCompare(b.date));
  const slides = [...(p.photo ? [{ photo: p.photo, title: p.name, date: "" }] : []), ...pics];
  if (!slides.length) { PT_MSG = `Add a few photos to ${p.name}'s memories first.`; ptMsgShow(); return; }
  let el = document.getElementById("ptShow");
  if (!el) { el = document.createElement("div"); el.id = "ptShow"; el.className = "pt-show"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Slideshow"); document.body.appendChild(el); }
  const b = ptNextBday(p), end = p.passed ? `Forever in our hearts, ${esc(p.name)} 🌈` : b ? `Happy ${b.days ? "early " : ""}birthday, ${esc(p.name)}! 🎂 ${b.turns}` : `${esc(p.name)} 💛`;
  el.innerHTML = `<button class="pt-showx" data-ptshowclose="1" aria-label="Close slideshow">✕</button><div class="pt-slides">${slides.map((s, i) => `<figure class="${i === 0 ? "on" : ""}"><img data-ptimg="${esc(s.photo)}" alt=""><figcaption><b>${esc(s.title || "")}</b>${s.date ? `<small>${ptMonthYr(s.date)}${p.bday && !p.est && s.date >= p.bday ? " · age " + esc(ptAgeTxt(p, "short", s.date)) : ""}</small>` : ""}</figcaption></figure>`).join("")}
    <figure class="pt-showend"><div><b>${end}</b><small>${esc(ptAgeTxt(p, "long") || "")}</small></div></figure></div><div class="pt-dots">${slides.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}<i></i></div>`;
  el.classList.remove("hidden");
  if (!PT_SHOWPUSH) { try { history.pushState({ ptshow: 1 }, ""); PT_SHOWPUSH = 1; } catch (e) { /* ✕ still closes it */ } }
  await ptPaint(el);
  clearInterval(PT_SHOW); let i = 0; const F = el.querySelectorAll(".pt-slides figure"), D = el.querySelectorAll(".pt-dots i");
  PT_SHOW = setInterval(() => { if (i >= F.length - 1) { clearInterval(PT_SHOW); return; } F[i].classList.remove("on"); D[i].classList.remove("on"); i++; F[i].classList.add("on"); D[i].classList.add("on"); }, 3200);
}
function ptShowClose(fromPop) {
  clearInterval(PT_SHOW); const el = document.getElementById("ptShow"); if (el) el.classList.add("hidden");
  if (!fromPop && PT_SHOWPUSH) { PT_SHOWPUSH = 0; PT_HSKIP++; try { history.back(); } catch (e) { PT_HSKIP = 0; } }
}

// ------------------------------------------------------------ taps
function ptClick(ds) {
  if (typeof MODE === "undefined" || MODE !== "pet") return false;
  if (ds.ptshowclose) { ptShowClose(); return true; }
  if (ds.ptshow) { ptShow(ds.ptshow); return true; }
  if (ds.ptclose && !ds.ask && !ds.open) { hidePt(); render(); return true; }
  if (ds.ptclose) { hidePt(); return false; }           // Ask / ⚙ from More: close ours, let the engine open its own
  if (ds.ptback) { ptBack(); return true; }
  if (ds.ptpick) { pt().cur = ds.ptpick; save(); ptReset(); const go = ds.ptgo || "pet";
    if (PT_OPEN) showPt(go); else { PT_STACK = []; showPt(go); } ptNavEnsure(); return true; }
  if (ds.ptnew) { ptReset(); PT_EDIT = null; showPt("add"); return true; }
  if (ds.ptedit) { ptReset(); PT_EDIT = ds.ptedit; pt().cur = ds.ptedit; showPt("add"); return true; }
  if (ds.pttab) { if (ds.ptroot) PT_STACK = []; const f = ds.ptform || ""; ptReset(); PT_FORM = f; showPt(ds.pttab, !ds.ptroot); ptNavEnsure(); return true; }
  if (ds.ptform !== undefined) { PT_FORM = ds.ptform; showPt(); return true; }
  if (ds.ptmonth) { PT_MONTH += Number(ds.ptmonth) || 0; showPt(); return true; }
  if (ds.ptmemnew !== undefined) { PT_MEMADD = ds.ptmemnew === "1"; PT_MEMPIC = ""; showPt(); return true; }
  if (ds.ptdone) { const P = pt(), day = ds.ptday || today(), k = ds.ptdone; P.done[day] = P.done[day] || {};
    if (P.done[day][k]) delete P.done[day][k]; else P.done[day][k] = 1;
    ptTrim(); save(); if (PT_OPEN) showPt(); render(); if (P.done[day][k] && ptCareDue(day).every(x => x.done)) toast("🐾 Everyone's taken care of today!"); return true; }
  if (ds.ptdose) { const P = pt(), day = today(); P.doses[day] = P.doses[day] || {};
    const prev = P.doses[day][ds.ptdose] || "", m = P.meds.find(x => x.id === ds.ptdose.split("|")[0]), per = m ? Math.max(1, ptNum(m.per) || 1) : 1;
    if (ds.ptst) P.doses[day][ds.ptdose] = ds.ptst; else delete P.doses[day][ds.ptdose];
    if (m && m.left !== "" && m.left != null) {           // Given takes one off the count; Undo of a Given puts it back
      if (ds.ptst === "taken" && prev !== "taken") m.left = Math.max(0, ptNum(m.left) - per);
      else if (prev === "taken" && ds.ptst !== "taken") m.left = ptNum(m.left) + per; }
    ptTrim(); save(); if (PT_OPEN) showPt(); render(); return true; }
  if (ds.ptdel) { const [k, id] = ds.ptdel.split(":"), P = pt(); if (!Array.isArray(P[k])) return true;
    const x = P[k].find(y => y.id === id); if (!x) return true;
    if (x.photo) ptPhotoDel(x.photo);
    P[k] = P[k].filter(y => y.id !== id); save(); showPt(); render(); toast("Deleted"); return true; }
  if (ds.ptbridgeask) { const p = ptPet(ds.ptbridgeask); if (!p) return true;
    PT_MSG = ""; const el = document.querySelector("#ptSheet .pt-danger");
    if (el) el.innerHTML = `<form class="pt-form" data-ptbridge="${p.id}"><p class="pt-sub">We're so sorry. 💛 Pet Hub keeps ${esc(p.name)}'s photos and story in a quiet memorial page and stops the care reminders.</p>
      <label class="field">The day ${esc(p.name)} passed<input name="date" type="date" value="${today()}" max="${today()}" required></label><div class="pt-formbtns"><button class="pt-cta">Remember ${esc(p.name)}</button><button type="button" class="pt-ghost" data-ptedit="${p.id}">Cancel</button></div></form>`;
    return true; }
  if (ds.ptunbridge) { const p = ptPet(ds.ptunbridge); if (p) { p.passed = ""; save(); showPt("pet"); render(); } return true; }
  if (ds.ptremove) { const p = ptPet(ds.ptremove); if (!p) return true;
    if (PT_ARM !== "rm:" + p.id) { PT_ARM = "rm:" + p.id; showPt(); return true; }
    const P = pt(); [p.photo, ...["mems", "papers"].flatMap(k => P[k].filter(x => x.pet === p.id).map(x => x.photo))].forEach(ptPhotoDel);
    ["care", "meds", "shots", "visits", "weights", "mems", "papers"].forEach(k => { P[k] = P[k].filter(x => x.pet !== p.id); });
    P.pets = P.pets.filter(x => x.id !== p.id); P.cur = ""; ptReset(); save();
    if (!P.pets.length) { P.setup = false; hidePt(); render(); } else { PT_STACK = []; hidePt(); render(); }
    toast(`${p.name} removed`); return true; }
  return false;
}
// Ask and ⚙ Settings from More are the engine's own sheets, handled before ptClick: close ours first (capture phase) so theirs is on top.
if (typeof document !== "undefined") document.addEventListener("click", e => {
  if (typeof MODE === "undefined" || MODE !== "pet" || !e.target || !e.target.closest) return;
  const b = e.target.closest("[data-ptclose]"); if (b && (b.dataset.ask || b.dataset.open) && PT_OPEN) hidePt();
}, true);
// Keep only the last 45 days of ticks and doses (the history the screens show).
function ptTrim() { const P = pt(), cut = addDays(today(), -45); ["done", "doses"].forEach(k => Object.keys(P[k]).forEach(d => { if (d < cut) delete P[k][d]; })); }

// ------------------------------------------------------------ forms
function ptSubmit(f, data) {
  if (typeof MODE === "undefined" || MODE !== "pet") return false;
  const D = f.dataset, P = pt(), t = today();
  if (D.ptpetform) {
    if (PT_BUSY) return true;                                 // a second tap while the photo is still being kept: not a second pet
    const name = ptTxt(data.name, 30); if (!name) { PT_MSG = "Give your pet a name."; ptMsgShow(); return true; }
    const species = PT_SPECIES.some(s => s[0] === data.species) ? data.species : "other", old = D.ptid ? ptPet(D.ptid) : null;
    let bday = "", est = false;
    if (data.agehow === "est" && (data.ey !== "" || data.em !== "")) {
      const y = Math.max(0, Math.min(60, Math.floor(ptNum(data.ey)))), m = Math.max(0, Math.min(11, Math.floor(ptNum(data.em)))), A = old && old.est ? ptAge(old.bday) : null;
      // Unchanged years + months keep the date first worked out, so an edit never slides the age; a new estimate counts back from today.
      bday = A && A.y === y && A.m === m ? old.bday : ptIso(ptAddMonths(parseDay(t), -(y * 12 + m))); est = true; }
    else if (ptIsD(data.bday) && data.bday <= t) bday = data.bday;
    const vals = { name, species, breed: ptTxt(data.breed, 40), bday, est, gotcha: ptIsD(data.gotcha) && data.gotcha <= t ? data.gotcha : "", sex: ["m", "f"].includes(data.sex) ? data.sex : "",
      look: ptTxt(data.look, 40), color: PT_TONES.includes(data.color) ? data.color : PT_TONES[P.pets.length % PT_TONES.length] };
    const finish = (photoId, memPhoto) => {
      PT_BUSY = false;
      let p = D.ptid ? ptPet(D.ptid) : null;
      if (p) { if (photoId && p.photo && p.photo !== photoId) ptPhotoDel(p.photo); Object.assign(p, vals, photoId ? { photo: photoId } : {}); }
      else { p = { id: uid(), ...vals, photo: photoId || "", added: t }; P.pets.push(p);
        if (data.starter) (PT_START[species] || PT_START.other).forEach(([kind, title, time]) => P.care.push({ id: uid(), pet: p.id, kind, title, every: "daily", times: [time], from: t }));
        // the memory keeps its OWN copy of the photo: deleting it never takes the profile photo, and a new profile photo never empties it
        if (memPhoto) P.mems.push({ id: uid(), pet: p.id, kind: p.gotcha ? "home" : "photo", title: p.gotcha ? "First Day Home" : `${p.name}'s first photo here`, date: p.gotcha || t, note: "", photo: memPhoto }); }
      if (D.ptpetform === "setup") { P.setup = true; if (data.owner !== undefined) S.name = ptTxt(data.owner, 30) || S.name || ""; }
      P.cur = p.id; const isNew = !D.ptid; PT_PENDING = ""; PT_EDIT = null; save();
      if (D.ptpetform === "setup") { render(); toast(`🐾 Welcome, ${p.name}!`); return; }
      PT_STACK = []; showPt("pet", false); render(); toast(isNew ? `🐾 ${p.name} joined the crew!` : "Saved ✓");
    };
    if (PT_PENDING && PT_PENDING.startsWith("data:")) { PT_BUSY = true; const pic = PT_PENDING;
      Promise.all([ptPhotoPut(pic), D.ptid ? "" : ptPhotoPut(pic)]).then(([a, b]) => finish(a, b), () => { PT_MSG = "Couldn't keep the photo on this phone (private browsing?). Saved without it."; finish("", ""); }); }
    else finish("", "");
    return true;
  }
  if (D.ptcare) {
    const title = ptTxt(data.title, 50) || ptCk(data.kind)[2], every = PT_EVERY.some(e => e[0] === data.every) ? data.every : "daily";
    P.care.push({ id: uid(), pet: D.ptcare, kind: PT_CARE.some(c => c[0] === data.kind) ? data.kind : "other", title, every, times: ptIsT(data.time) ? [data.time] : [],
      dow: Math.max(0, Math.min(6, Math.floor(ptNum(data.dow)))), dom: Math.max(1, Math.min(31, Math.floor(ptNum(data.dom)) || 1)), from: t });
    save(); showPt(); render(); toast(`🔁 ${title} added`); return true;
  }
  if (D.ptshot) { const name = ptTxt(data.name, 50); if (!name) return true;
    P.shots.push({ id: uid(), pet: D.ptshot, name, given: ptIsD(data.given) ? data.given : "", due: ptIsD(data.due) ? data.due : "" }); PT_FORM = ""; save(); showPt(); render(); toast("💉 Saved"); return true; }
  if (D.ptvisit) { if (!ptIsD(data.date)) return true;
    P.visits.push({ id: uid(), pet: D.ptvisit, date: data.date, time: ptIsT(data.time) ? data.time : "", vet: ptTxt(data.vet, 50), reason: ptTxt(data.reason, 60), notes: ptTxt(data.notes, 500), cost: ptTxt(data.cost, 15) });
    const p = ptPet(D.ptvisit); if (p && !p.vet && data.vet) p.vet = ptTxt(data.vet, 50);
    PT_FORM = ""; save(); showPt(); render(); toast("🩺 Saved"); return true; }
  if (D.ptmed) { const name = ptTxt(data.name, 50); if (!name) return true;
    P.meds.push({ id: uid(), pet: D.ptmed, name, dose: ptTxt(data.dose, 60), times: [data.t1, data.t2].filter(ptIsT).sort(), left: data.left === "" || data.left == null ? "" : Math.max(0, Math.floor(ptNum(data.left))), per: 1, start: t, end: ptIsD(data.end) ? data.end : "" });
    PT_FORM = ""; save(); showPt(); render(); toast("💊 Saved"); return true; }
  if (D.ptweight) { const lb = Math.round(ptNum(data.lb) * 10) / 10; if (!(lb > 0)) { PT_MSG = "Type the weight in pounds."; ptMsgShow(); return true; }
    P.weights.push({ id: uid(), pet: D.ptweight, date: ptIsD(data.date) ? data.date : t, lb }); PT_FORM = ""; save(); showPt(); render(); toast("⚖️ Saved"); return true; }
  if (D.ptpass) { const p = ptPet(D.ptpass); if (!p) return true;
    ["chip", "chipCo", "tag", "vet", "vetPh", "evet", "evetPh", "ins", "insNo"].forEach(k => { p[k] = ptTxt(data[k], 50); }); p.feed = ptTxt(data.feed, 500);
    save(); showPt(); toast("🛂 Passport saved"); return true; }
  if (D.ptmem) {
    if (PT_BUSY) return true;
    const kind = PT_MEMK.some(k => k[0] === data.kind) ? data.kind : "photo", date = ptIsD(data.date) && data.date <= t ? data.date : t, title = ptTxt(data.title, 60) || ptMk(kind)[2];
    const add = photo => { PT_BUSY = false; P.mems.push({ id: uid(), pet: D.ptmem, kind, title, date, note: ptTxt(data.note, 400), photo: photo || "" }); PT_MEMADD = false; PT_MEMPIC = ""; save(); showPt(); render(); toast("📸 Memory saved"); };
    if (PT_MEMPIC) { PT_BUSY = true; ptPhotoPut(PT_MEMPIC).then(add, () => { PT_MSG = "Couldn't keep the photo on this phone. Saved the memory without it."; add(""); }); } else add("");
    return true;
  }
  if (D.ptbridge) { const p = ptPet(D.ptbridge); if (!p || !ptIsD(data.date)) return true;
    p.passed = data.date; save(); PT_STACK = []; showPt("bridge", false); render(); return true; }
  return false;
}
// Photos picked: shrink on the phone, then show them in the form (saved with the form) or save straight away (papers).
if (typeof document !== "undefined") document.addEventListener("change", async e => {
  const el = e.target; if (typeof MODE === "undefined" || MODE !== "pet" || !el || !el.dataset) return;
  if (el.dataset.ptpapertype) { el.closest("form").dataset.type = el.value; return; }
  const pf = el.closest && el.closest("form[data-ptpetform]");
  if (pf && el.name === "agehow") { pf.classList.toggle("pt-est", el.value === "est"); return; }   // works without CSS :has() too
  if (pf && el.name === "species") { const n = pf.querySelector(".pt-startname"), face = pf.querySelector(".pt-photoin .pt-pic:not(.has) i");
    if (n) n.textContent = ptSp(el.value)[2].toLowerCase(); if (face) face.textContent = ptSp(el.value)[1]; return; }
  if (!el.files || !el.files[0] || el.id === "importFile") return;
  const file = el.files[0]; el.value = "";
  if (file.size > 30e6) { PT_MSG = "That photo is too big."; ptMsgShow(); return; }
  try {
    if (el.dataset.ptphoto) { PT_PENDING = await ptShrink(file, 900); const f = el.closest("form"), box = f && f.querySelector(".pt-photoin .pt-pic");
      if (box) { box.classList.add("has"); box.innerHTML = `<img src="${PT_PENDING}" alt="Chosen photo">`; } return; }
    if (el.dataset.ptmempic) { PT_MEMPIC = await ptShrink(file, 1400); const f = el.closest("form"), wrap = f && f.querySelector(".pt-photoin");
      if (wrap) { const old = wrap.querySelector(".pt-pic"); if (old) old.remove(); wrap.insertAdjacentHTML("afterbegin", `<span class="pt-pic pt-mempic has"><img src="${PT_MEMPIC}" alt="Chosen photo"></span>`); } return; }
    if (el.dataset.ptpaper) { const type = (el.closest("form") && el.closest("form").dataset.type) || "vacc", k = PT_PAPERS.find(x => x[0] === type) || PT_PAPERS[0];
      const id = await ptPhotoPut(await ptShrink(file, 1600)); pt().papers.unshift({ id: uid(), pet: el.dataset.ptpaper, type: k[0], title: `${k[2]} · ${ptDate(today())}`, date: today(), photo: id });
      save(); showPt(); toast("📄 Saved to the passport"); return; }
  } catch (er) { PT_MSG = "Couldn't read that photo here (private browsing?)."; ptMsgShow(); }
});

// ------------------------------------------------------------ reminders, Life pulse, what Ask reads
// Reminders (⚙ → Reminders on; on the Play app they ring with the app closed): care with a time, medicine doses, a shot 7 days
// ahead and on the day, a vet visit the evening before and an hour before, birthdays and Gotcha Days (a week ahead and on the day).
function ptReminders(add, inWin) {
  if (!ptSet()) return;
  const t = today(), R = S.remind || {};
  [t, addDays(t, 1)].forEach(day => {
    ptCareDue(day).filter(x => x.time && !x.done).forEach(x => { const at = atMs(day, x.time);
      add(`ptc:${x.key}:${day}`, at + 60 * 60000, at, `${ptCk(x.c.kind)[1]} ${x.pet.name}: ${x.c.title}`, `${hm(x.time)} - tap ✓ in Pet Hub when it's done`); });
    ptDoses(day).filter(d => !d.st).forEach(d => { const at = atMs(day, d.time);
      add(`ptd:${d.k}:${day}`, at + 60 * 60000, at, `💊 ${d.pet.name}: ${d.m.name}`, `${hm(d.time)}${d.m.dose ? " · " + d.m.dose : ""} - tap Given in Pet Hub`); });
  });
  ptShotsDue().forEach(s => [7, 0].forEach(n => { const d = addDays(s.due, -n); const p = ptPet(s.pet);
    if (inWin(d)) add(`pts:${s.id}:${n}`, atMs(d, "23:59"), atMs(d, R.billHour || "09:00"), `💉 ${p.name}: ${s.name} ${n ? "due in a week" : "due today"}`, `Due ${ptDate(s.due)}${p.vet ? " · " + p.vet : ""}`); }));
  ptVisitsNext().forEach(v => { const p = ptPet(v.pet), st = atMs(v.date, v.time || "09:00"), eve = addDays(v.date, -1);
    if (inWin(eve)) add(`ptv:${v.id}:eve`, st, atMs(eve, "18:00"), `🩺 Tomorrow: ${p.name} at the vet`, `${v.time ? hm(v.time) : "Tomorrow"}${v.vet ? " · " + v.vet : ""}${v.reason ? " · " + v.reason : ""}`);
    if (v.time && inWin(v.date)) add(`ptv:${v.id}:soon`, st, st - 60 * 60000, `🩺 ${p.name}: vet at ${hm(v.time)}`, `${v.vet ? v.vet + " · " : ""}${v.reason || "Bring the vaccine record"}`); });
  ptLiving().forEach(p => { const b = ptNextBday(p), g = ptNextGotcha(p);
    if (b) [7, 0].forEach(n => { const d = addDays(b.date, -n); if (inWin(d)) add(`ptb:${p.id}:${b.date}:${n}`, atMs(d, "23:59"), atMs(d, "09:00"), n ? `🎂 ${p.name} turns ${b.turns} in a week` : `🎂 Happy birthday, ${p.name}! ${b.turns} today`, n ? "Treats, a toy or a party hat?" : "Add today's photo to the memories 📸"); });
    if (g && g.years > 0) [0].forEach(n => { const d = g.date; if (inWin(d)) add(`ptg:${p.id}:${d}`, atMs(d, "23:59"), atMs(d, "09:00"), `🏡 ${p.name}'s Gotcha Day`, `${ptPl(g.years, "year")} with your family today`); }); });
}
function ptPulse(add) {
  if (typeof MODE === "undefined" || MODE !== "pet" || !ptSet()) return;
  ptNeeds().forEach(x => add(x.late ? 10 : 7, x.icon, `${x.text} - ${x.sub}`, null));
}
function ptContext() {
  if (!ptSet()) return {};
  const P = pt(), t = today();
  return { about: "This is the owner's own Pet Hub, typed by them on their phone. Never give veterinary advice, a diagnosis or dosing; for health questions say to ask the vet.",
    pets: P.pets.map(p => ({ name: p.name, species: ptSp(p.species)[2], breed: p.breed || undefined, sex: p.sex ? (p.sex === "f" ? "girl" : "boy") : undefined, born: p.bday ? (p.est ? "about " + p.bday.slice(0, 7) : p.bday) : undefined,
      age: ptAgeTxt(p, "long") || undefined, lifeStage: ptStage(p) || undefined, gotchaDay: p.gotcha || undefined, nextBirthday: (ptNextBday(p) || {}).date, passedAway: p.passed || undefined,
      vet: p.vet || undefined, microchipSaved: !!p.chip,
      careRoutine: ptOf(P.care, p.id).filter(c => !c.off).map(c => ({ what: c.title, how: ptEveryTxt(c), times: c.times })),
      careDoneToday: ptCareDue(t, p.id).map(x => ({ what: x.c.title, time: x.time || undefined, done: x.done })),
      medicines: ptOf(P.meds, p.id).filter(m => !m.off).map(m => ({ name: m.name, asTypedFromVet: m.dose || undefined, times: m.times, until: m.end || undefined })),
      shots: ptOf(P.shots, p.id).map(s => ({ name: s.name, given: s.given || undefined, due: s.due || undefined })),
      vetVisits: ptOf(P.visits, p.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(v => ({ date: v.date, reason: v.reason || undefined, vet: v.vet || undefined, notes: v.notes || undefined })),
      weightsLb: ptOf(P.weights, p.id).sort((a, b) => a.date.localeCompare(b.date)).slice(-12).map(w => ({ date: w.date, lb: w.lb })),
      memories: ptOf(P.mems, p.id).length })) };
}
