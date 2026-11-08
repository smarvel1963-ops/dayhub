/* SAVE AS: family.js · LOCATION: C:/MarvelApps/dayhub/family.js
 * FAMILY HUB (app #9; Scott 2026-10-25: "you could start on family hub app" + Family_Hub_Project_Notes.pdf, saved in
 * C:/MarvelDesktop/docs/FAMILY_HUB_PLAN_FROM_OUTSIDE_CHAT_2026-10-25.md). Runs at /familyhub/ with window.DH_MODE = "family".
 *
 * v1 (1.59) - the notes' V1 "Foundation", on ONE phone first. Sharing between phones (Firebase, Scott 10/25 "A") plugs in
 * behind the FAMILY_SYNC switch (features.js, OFF) once the project exists.
 *   Home = FAMILY ORBIT: a glowing heart (today's count) with every family member orbiting it (their events + chores today),
 *          Needs you (chores to OK, events soon, birthdays), today's schedule, Who's doing what, the week ahead, big tiles.
 *   Bottom bar Today · Tasks · ＋ · Family · More (the notes' navigation).
 *   Calendar: color-coded by person, repeats (every day / weekdays / week / 2 weeks / month / year), school, sports,
 *          lessons, appointments; "adults only" events that kids and guests never see.
 *   Chores & allowances: assign, check off, a parent OKs it, points and dollars add up, pay-outs logged.
 *   Shopping lists (grocery, household, school + your own), Family to-do board (To do -> Doing -> Done),
 *   Emergency card (contacts, meeting place, plan, sitter notes; guests only when allowed), Birthdays from the profiles,
 *   Grandparent Mode (bigger text, the simple screen), "Who's using this phone?" with a parent PIN to leave a kid's view.
 * ROLES (owner, adult, child, guest): fhCan() decides every screen and every action. Kids are PROFILES a parent manages -
 * no kid logins, no kid emails, no location, no medical records (the notes' V1 privacy rules).
 * Everything lives in S.fh on this phone. Hub Universe reads it (universe.js uniFamily) read-only.
 * Loaded after ships.js, before ui.js (family mode); Hub Universe loads it before universe.js. Every top-level name is fh / FH.
 *
 * v2 PHASE A (Scott 11/07: his two boards, ChatGPT's build spec, then "these are CORE": messaging, photo sharing, important dates,
 * the family tree, per-member sharing; tabs Today | Messages | Calendar | Family | More). Board 1's bright sky-blue look (family.css).
 * Each part with its own file registers through fhMod (FH_MODS): familymsg.js (Messages), familytree.js (tree, profiles, who sees
 * what), familyphotos.js (Photos & memories), familylife.js (Meals, School, Documents, Pets, Goals, Trips). This file asks every
 * one in turn for its panes, taps, forms, Today card, reminders and what Ask reads. Still one phone; Phase B = Firebase sync.
 * WHO SEES WHAT: fhAudOk / fhSees - one rule for profiles, birthdays on the calendar, photos and documents (nothing forced public).
 * PRICE (Scott 11/07): $25 once for the whole family after a 30-day free trial (fhTrial). Nothing is charged or paused until the
 * product exists; the Play app never shows it (store wording rule).
 */
"use strict";
const FH_TABS = [["home", "🏠", "Today"], ["tasks", "✅", "Family tasks & chores"], ["add", "＋", "Add something"], ["family", "👨‍👩‍👧", "Our family"], ["more", "☰", "More family tools"], ["needs", "🔔", "Needs you"],
  ["cal", "📅", "Calendar"], ["lists", "🛒", "Shopping lists"], ["todo", "📌", "Family to-do"], ["card", "🆘", "Emergency card"], ["money", "💵", "Allowances"],
  ["bday", "🎂", "Birthdays"], ["who", "🔄", "Who's using this phone"], ["share", "🔗", "Share with your family"], ["big", "👵", "Grandparent Mode"]];
const FH_NAV = [["home", "🏠", "Today"], ["msg", "💬", "Messages"], ["cal", "📅", "Calendar"], ["family", "👨‍👩‍👧", "Family"], ["more", "☰", "More"]];   // v2 (Scott 11/07) + a floating ＋
const FH_NAVOF = { home: "home", msg: "msg", cal: "cal", family: "family", tree: "family", sharing: "family", profile: "family", who: "family" };
const FH_ROLES = {
  owner: ["👑", "Owner", "Runs the family: everything, plus who's in it, their roles and sharing."],
  adult: ["🧑", "Adult", "Adds and changes everything and OKs chores."],
  child: ["🧒", "Child", "Sees the family calendar and lists, checks off their own chores. A parent OKs them."],
  guest: ["🤝", "Guest", "A sitter or grandparent: the family calendar and the lists. The emergency card only if you allow it."] };
const FH_COLORS = ["#ff6b6b", "#ff9f43", "#feca57", "#1dd1a1", "#48dbfb", "#2e86de", "#a29bfe", "#ff6bcb", "#10ac84", "#c8d6e5"];
const FH_FACES = ["👩", "👨", "🧑", "👧", "👦", "🧒", "👶", "👵", "👴", "🧔", "👩‍🦰", "👨‍🦱", "👱‍♀️", "🧑‍🦳", "🐶", "🐱"];
const FH_KINDS = [["family", "🏡", "Family"], ["school", "🎒", "School"], ["sports", "⚽", "Sports"], ["lesson", "🎵", "Lesson"], ["appt", "📋", "Appointment"],
  ["party", "🎉", "Party"], ["work", "💼", "Work"], ["anniv", "💍", "Anniversary"], ["reunion", "👪", "Reunion"], ["trip", "🧳", "Trip"], ["pet", "🐾", "Pet"], ["other", "✨", "Other"]];   // "other" stays last (fhKind's fallback)
const FH_REM = [["week", "1 week before"], ["day", "1 day before"], ["same", "Same day"]];   // v2: important dates (Scott's core list)
const FH_BIGKINDS = ["anniv", "reunion", "trip", "party", "appt"];
const FH_REPEAT = [["none", "Just once"], ["daily", "Every day"], ["weekdays", "Weekdays (Mon-Fri)"], ["weekly", "Every week"], ["2weeks", "Every 2 weeks"],
  ["monthly", "Every month"], ["yearly", "Every year"]];
const FH_EVERY = [["once", "Once"], ["daily", "Every day"], ["weekly", "Every week"]];
const FH_LIST_ICONS = ["🛒", "🧻", "🎒", "🎉", "🎁", "🏕️", "🐾", "📦", "🧳"];
const FH_WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FH_ASKS = ["What's everyone doing tomorrow?", "Which chores are still open today?", "What's on the grocery list?", "Whose birthday is next?"];
let FH_OPEN = false, FH_TAB = "tasks", FH_MSG = "", FH_EDIT = null, FH_LIST = null, FH_WEEK = 0, FH_WHO = "all", FH_PIN_FOR = null;
let FH_STACK = [], FH_CALV = "week", FH_MONTH = 0, FH_DAYV = "", FH_EVKIND = "", FH_EVTITLE = "", FH_EVPET = "";
// v2 REGISTRY: each Family Hub part with its own file calls fhMod({ id, tabs, panes, click, submit, repair, back, depth, reset, after,
// today, adds, reminders, pulse, context, forget }) once. Nothing else in the engine needs a hook for a new part.
const FH_MODS = [];
const fhMod = m => { FH_MODS.push(m); };
const fhEach = (k, ...a) => FH_MODS.map(m => typeof m[k] === "function" ? m[k](...a) : undefined);
const fhAny = (k, ...a) => FH_MODS.some(m => typeof m[k] === "function" && !!m[k](...a));
const fhTabInfo = k => FH_TABS.concat(...FH_MODS.map(m => m.tabs || [])).find(x => x[0] === k) || null;
// WHO SEES WHAT (Scott's paste 11/07: "Nothing should be forced public inside the family. Each member controls what they share.")
const FH_AUD = [["all", "👨‍👩‍👧", "Whole family"], ["parents", "🧑", "Parents only"], ["some", "👥", "Picked people"], ["me", "🔒", "Only me"]];
const FH_FIELDS = [["bday", "🎂", "Birthday"], ["photo", "🖼️", "Photo"], ["phone", "📞", "Phone"], ["interests", "⭐", "Interests"], ["bio", "📝", "About me"], ["school", "🎒", "School or work"],
  ["place", "📍", "Born in"], ["facts", "📜", "Life facts"], ["story", "📖", "Stories"], ["heritage", "🌍", "Heritage"]];
// May the person using this phone (or viewer) see something owner shared to a = { to, ids }? Owners always see their own; parents
// always see a child's (kids are profiles a parent manages). "Whole family" = everyone in this Family Hub, guests included.
function fhAudOk(a, owner, viewer) {
  if (!owner) return true;
  const v = viewer === undefined ? fhMe() : fhMem(viewer), vid = v && v.id, vr = v ? v.role : "owner", o = fhMem(owner);
  if (!v || vid === owner) return true;
  if (o && o.role === "child" && (vr === "owner" || vr === "adult")) return true;
  const to = (a && a.to) || "all";
  return to === "all" ? true : to === "parents" ? vr === "owner" || vr === "adult" : to === "some" ? Array.isArray(a.ids) && a.ids.includes(vid) : false;
}
const fhShareOf = (mid, f) => { const x = (fh().share[mid] || {})[f]; return x && typeof x === "object" && FH_AUD.some(a => a[0] === x.to) ? x : { to: f === "phone" ? "parents" : "all", ids: [] }; };
const fhSees = (m, f) => !!m && fhAudOk(fhShareOf(m.id, f), m.id);
// THE PRICE (Scott 11/07): a 30-day free trial of everything for the whole family, from the day the family is made; then $25 once.
const FH_TRIAL_DAYS = 30;
function fhTrial() { const F = fh(), used = fhIsD(F.setup) ? Math.max(0, -daysUntil(F.setup)) : 0; return { paid: !!F.paid, left: Math.max(0, FH_TRIAL_DAYS - used) }; }
function fhTrialHtml() {
  if (typeof STORE_MODE !== "undefined" && STORE_MODE) return "";        // the Play app: no price or trial words outside the unlock box
  const T = fhTrial();
  if (T.paid) return `<p class="fh-trial paid">💛 Family Hub is yours, for your whole family.</p>`;
  if (!T.left) return `<div class="fh-trial"><b>🎁 Your free trial has ended</b><small>Everything your family added stays yours. $25 once keeps Family Hub for everyone you invite - no subscription.</small></div>`;
  return `<div class="fh-trial"><b>🎁 Free trial: ${T.left} day${T.left === 1 ? "" : "s"} left</b><small>Everything, for your whole family. After that, $25 once keeps Family Hub for everyone you invite - no subscription.</small></div>`;
}
const FH_ART = { home: "home", cal: "calendar", msg: "messages", family: "tree", tree: "tree", photos: "memories", meals: "meals", school: "school", pets: "pets", trips: "trips" };
const fhArt = k => FH_ART[k] ? `../familyhub/art/${FH_ART[k]}.webp` : "";
const fhTiles = (items, cls = "") => `<div class="fh-qtiles ${cls}">${items.map(i => `<button class="fh-qt" ${i.attrs} style="--tone:${i.tone || "#2e86de"}"><span aria-hidden="true">${i.icon}</span><b>${esc(i.label)}</b></button>`).join("")}</div>`;
const fhFamSeg = on => `<div class="fh-seg" role="tablist" aria-label="Family">${[["family", "Members"], ["tree", "Family tree"], ["sharing", "Who sees what"]].filter(([k]) => k === "family" || fhTabInfo(k))
  .map(([k, l]) => `<button role="tab" aria-selected="${on === k}" class="${on === k ? "on" : ""}" data-fhseg="${k}">${l}</button>`).join("")}</div>`;
if (typeof document !== "undefined" && typeof MODE !== "undefined" && MODE === "family") document.body.classList.add("fhapp");   // hides the Day Hub ＋ button

// ------------------------------------------------------------ the data (S.fh) and small helpers
// Repairs S.fh IN PLACE and keeps every array and object it already has: callers hold F.todos / F.card while other helpers
// (fhMem, fhMe ...) call fh() again, so a fresh copy here would swallow the write (found by the to-do test, v1.59).
// Values that end up inside the page's HTML as they are (faces, colours, icons, ids) are re-checked here, so a restored or (later)
// synced copy can't carry markup in them. Everything typed is escaped where it is shown.
const fhOkIc = (v, d) => typeof v === "string" && v.length > 0 && v.length <= 12 && !/[<>"'&\\`]/.test(v) ? v : d;
const fhOkCol = v => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#c8d6e5";
const fhRec = v => !!v && typeof v === "object" && !Array.isArray(v) && (v.id === undefined || (typeof v.id === "string" && /^[\w-]{1,64}$/.test(v.id)));
let FH_FIXED = null;      // the S.fh object last repaired: a new one (load, restore, undo, Erase) is repaired once, not on every call
function fh() {
  if (S.fh && S.fh === FH_FIXED) return S.fh;
  if (!S.fh || typeof S.fh !== "object" || Array.isArray(S.fh)) S.fh = {};
  const F = S.fh, o = fhRec;
  ["members", "events", "chores", "payouts", "lists", "todos"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; else if (!F[k].every(o)) F[k] = F[k].filter(o); });
  F.members.forEach(m => { m.face = fhOkIc(m.face, "🙂"); m.color = fhOkCol(m.color); });
  if (!o(F.card)) F.card = {};
  Object.entries({ meet: "", plan: "", sitter: "", doctor: "", guests: false }).forEach(([k, v]) => { if (!(k in F.card)) F.card[k] = v; });
  if (!Array.isArray(F.card.contacts)) F.card.contacts = [];
  F.events.forEach(e => { if (!Array.isArray(e.who)) e.who = []; if (!Array.isArray(e.skip)) e.skip = []; });
  F.chores.forEach(c => { if (!o(c.log)) c.log = {}; });
  F.lists.forEach(l => { if (!Array.isArray(l.items)) l.items = []; l.icon = fhOkIc(l.icon, "🛒"); });
  if (!o(F.share)) F.share = {};
  F.events.forEach(e => { if (e.rem !== undefined && !Array.isArray(e.rem)) delete e.rem; });
  FH_MODS.forEach(m => { if (typeof m.repair === "function") m.repair(F, o); });
  FH_FIXED = F; return F;
}
// Who may edit a member: the owner anyone; an adult the kids, the guests and themself (never another adult - Scott's "each member
// controls what they share" would end the moment one adult could turn another into a child).
const fhCanEditMem = m => !!m && fhCan("members") && (fhCan("role") || ["child", "guest"].includes(m.role) || (!!fhMe() && fhMe().id === m.id));
// A member leaves: what they kept "Only me" leaves with them (a child's goes to the parents); the rest stays, now kept by whoever removed them.
function fhHandOver(list, gone, drop) {
  const me = fhMe(), keeper = (me && me.id !== gone.id ? me : fhMembers().find(x => x.role === "owner")) || {};
  return list.filter(p => { if (Array.isArray(p.ids)) p.ids = p.ids.filter(i => i !== gone.id);
    if (p.by !== gone.id) return true;
    if (p.to === "me" && gone.role !== "child") { if (typeof drop === "function") drop(p.id); return false; }
    p.by = keeper.id || ""; if (p.to === "me" || p.to === "some") { p.to = "parents"; p.ids = []; } return true; });
}
// A Feb 29 birthday is kept on Feb 28 in the other years.
const fhLeap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const fhBdayIn = (y, mmdd) => mmdd === "02-29" && !fhLeap(y) ? `${y}-02-28` : `${y}-${mmdd}`;
const fhSet = () => !!(S.fh && S.fh.setup);
const fhMembers = () => fh().members;
const fhMem = id => fhMembers().find(m => m.id === id) || null;
const fhMe = () => fhMem(fh().me) || fhMembers().find(m => m.role === "owner") || fhMembers()[0] || null;
const fhRole = () => (fhMe() || {}).role || "owner";
const fhAdult = () => ["owner", "adult"].includes(fhRole());
const fhName = id => (fhMem(id) || {}).name || "Someone";
const fhFace = id => (fhMem(id) || {}).face || "🙂";
const fhColor = id => (fhMem(id) || {}).color || "#c8d6e5";
const fhKind = k => FH_KINDS.find(x => x[0] === k) || FH_KINDS[FH_KINDS.length - 1];
const fhIsD = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fhIsT = v => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
const fhMin = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + m; };
const fhTxt = (v, n = 80) => String(v == null ? "" : v).trim().slice(0, n);
const fhNum = v => { const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; };
const fhUsd = n => "$" + (Math.round((+n || 0) * 100) / 100).toFixed(2).replace(/\.00$/, "");
const fhRel = d => { const n = daysUntil(d); return n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n > 1 && n < 7 ? FH_WD[parseDay(d).getDay()] : prettyDate(d); };
const fhDot = id => `<span class="fh-dot" style="--tone:${fhColor(id)}" title="${esc(fhName(id))}" aria-hidden="true">${fhFace(id)}</span>`;
const fhIc = (icon, tone, cls = "") => `<span class="fh-ic ${cls}" style="--tone:${tone}" aria-hidden="true">${icon}</span>`;

// ------------------------------------------------------------ ROLES: one place decides what the person using this phone sees and does
function fhCan(act, x) {
  const r = fhRole(), me = fhMe(), mid = me && me.id, adult = r === "owner" || r === "adult";
  switch (act) {
    case "see": return !x || x.vis !== "adults" || adult;                         // events / to-dos marked "adults only"
    case "event": case "chore": case "approve": case "todo": case "card": case "members": case "pin": case "pay": case "listEdit": return adult;
    case "done": return adult || (r === "child" && !!x && x.who === mid);           // check off a chore: adults any, a child their own
    case "undo": return adult || (r === "child" && !!x && x.c.who === mid && x.l && x.l.st === "done");   // a child can take back their own, before the OK
    case "listAdd": case "listCheck": return true;                                    // everyone, guests too (a sitter picks up milk)
    case "todoMove": return adult || (!!x && x.who === mid);
    case "seeCard": return r !== "guest" || !!fh().card.guests;
    case "seeMoney": return adult || (r === "child" && !!x && x === mid);            // x = member id: a child sees only their own, a guest none
    case "role": case "share": return r === "owner";                                  // roles, removing adults, sharing
    default: return false;
  }
}

// ------------------------------------------------------------ CALENDAR: does an event happen on day d?
function fhOccurs(e, d) {
  if (!fhIsD(e.date) || d < e.date || (e.until && d > e.until) || e.skip.includes(d)) return false;
  const A = parseDay(e.date), D = parseDay(d), n = Math.round((D - A) / 864e5);
  switch (e.rep || "none") {
    case "daily": return true;
    case "weekdays": return D.getDay() > 0 && D.getDay() < 6;
    case "weekly": return n % 7 === 0;
    case "2weeks": return n % 14 === 0;
    case "monthly": return D.getDate() === A.getDate();
    case "yearly": return D.getDate() === A.getDate() && D.getMonth() === A.getMonth();
    default: return n === 0;
  }
}
// Everything on day d the person using this phone may see (adults-only hidden from kids and guests), birthdays included.
function fhDay(d, who) {
  const all = !who || who === "all";
  const out = fh().events.filter(e => fhCan("see", e) && fhOccurs(e, d) && (all || fhFor(e, who))).map(e => ({ e, d, time: e.time || "" }));
  fhMembers().filter(m => fhIsD(m.bday) && fhBdayIn(+d.slice(0, 4), m.bday.slice(5)) === d && (all || who === m.id) && fhSees(m, "bday")).forEach(m => out.push({ bday: m, d, time: "" }));
  return out.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}
// Is this event one of this member's? Picked by name, or nobody picked (the whole family) - but an adults-only event is never
// a kid's or a guest's, even when nobody was picked.
const fhFor = (e, id) => { const m = fhMem(id); return e.who.length ? e.who.includes(id) : e.vis !== "adults" || (!!m && ["owner", "adult"].includes(m.role)); };
function fhBdays() {
  const t = today(), y = +t.slice(0, 4);
  return fhMembers().filter(m => fhIsD(m.bday) && fhSees(m, "bday")).map(m => {
    let next = fhBdayIn(y, m.bday.slice(5)); if (next < t) next = fhBdayIn(y + 1, m.bday.slice(5));
    const by = +m.bday.slice(0, 4), age = by > 1900 && by <= y ? +next.slice(0, 4) - by : null;
    return { m, next, days: daysUntil(next), age };
  }).sort((a, b) => a.days - b.days);
}

// ------------------------------------------------------------ CHORES: what is due on a day, its state, the money
const fhChoreDue = (c, d) => c.every === "daily" ? d >= (c.from || "") : c.every === "weekly" ? parseDay(d).getDay() === +c.day && d >= (c.from || "") : c.date === d;
const fhSt = (c, k, t) => { const l = c.log[k]; return l ? l.st : k < t ? "late" : "open"; };
// Due on t (daily / weekly), plus one-time chores due on t or still not done from before.
function fhChoresOn(t) {
  const out = [];
  fh().chores.forEach(c => {
    if (c.every === "daily" || c.every === "weekly") { if (fhChoreDue(c, t)) out.push({ c, k: t, st: fhSt(c, t, t), l: c.log[t] || null }); }
    else if (fhIsD(c.date) && c.date <= t && (c.date === t || !c.log[c.date])) out.push({ c, k: c.date, st: fhSt(c, c.date, t), l: c.log[c.date] || null });
  });
  return out.sort((a, b) => fhName(a.c.who).localeCompare(fhName(b.c.who)) || a.c.title.localeCompare(b.c.title));
}
const fhWaiting = () => fh().chores.flatMap(c => Object.entries(c.log).filter(([, l]) => l && l.st === "done").map(([k, l]) => ({ c, k, l }))).sort((a, b) => b.k.localeCompare(a.k));
// Earned = every OK'd chore, at the value it had when it was OK'd. Owed = earned - paid out.
function fhEarned(mid) {
  let amt = 0, pts = 0;
  fh().chores.filter(c => c.who === mid).forEach(c => Object.values(c.log).forEach(l => { if (l && l.st === "ok") { amt += +l.amt || 0; pts += +l.pts || 0; } }));
  const paid = fh().payouts.filter(p => p.who === mid).reduce((n, p) => n + (+p.amt || 0), 0);
  const r = n => Math.round(n * 100) / 100;
  return { amt: r(amt), pts, paid: r(paid), owed: r(amt - paid) };
}
const fhRewards = c => [+c.pts ? `⭐ ${+c.pts}` : "", +c.amt ? fhUsd(c.amt) : ""].filter(Boolean).join(" · ");

function fhNeeds(t) {
  const out = [], me = fhMe(), adult = fhAdult(), now = nowT();
  if (adult) fhWaiting().slice(0, 8).forEach(w => out.push({ icon: "🙋", tone: "#feca57", late: false, text: `${fhName(w.c.who)} finished: ${w.c.title}`, sub: `${fhRel(w.k)} · tap to OK it`, tab: "tasks" }));
  fhChoresOn(t).filter(x => (x.st === "open" || x.st === "late") && (adult || (me && x.c.who === me.id)))
    .forEach(x => out.push({ icon: "🧹", tone: fhColor(x.c.who), late: x.st === "late", text: `${fhName(x.c.who)}: ${x.c.title}`, sub: x.st === "late" ? `was due ${prettyDate(x.k)}` : "today", tab: "tasks" }));
  fhDay(t).filter(x => x.e && x.time && x.time >= now && fhMin(x.time) - fhMin(now) <= 120)
    .forEach(x => out.push({ icon: fhKind(x.e.kind)[1], tone: "#48dbfb", late: false, text: x.e.title, sub: `at ${hm(x.time)}${x.e.where ? " · " + x.e.where : ""}`, tab: "cal" }));
  fhBdays().filter(b => b.days <= 7).forEach(b => out.push({ icon: "🎂", tone: "#ff6bcb", late: false,
    text: b.days === 0 ? `Happy birthday, ${b.m.name}!` : `${b.m.name}'s birthday ${b.days === 1 ? "tomorrow" : FH_WD[parseDay(b.next).getDay()]}`, sub: b.age ? `turns ${b.age}` : prettyDate(b.next), tab: "bday" }));
  const un = typeof fhUnread === "function" ? fhUnread() : 0;
  if (un) out.push({ icon: "💬", tone: "#2e86de", late: false, text: `${un} new message${un === 1 ? "" : "s"}`, sub: "tap to read", tab: "msg" });
  return out.sort((a, b) => b.late - a.late);
}

// ------------------------------------------------------------ the sheet: one full screen per tab + the bottom bar
function fhSheet() {
  let el = document.getElementById("fhSheet");
  if (!el) { el = document.createElement("div"); el.id = "fhSheet"; el.className = "sheet hidden"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function hideFh() { const el = document.getElementById("fhSheet"); if (el) el.classList.add("hidden"); FH_OPEN = false; FH_MSG = ""; FH_EDIT = null; FH_PIN_FOR = null; FH_STACK = []; FH_EVKIND = FH_EVTITLE = FH_EVPET = ""; }
// back = true: going back (or a top-level tab), so the page we leave isn't remembered.
function showFh(tab, back) {
  const el = fhSheet(), was = FH_OPEN, old = el.querySelector(".sheet-body"), keep = was && old && (!tab || tab === FH_TAB) ? old.scrollTop : 0;
  if (!was) FH_STACK = [];
  else if (tab && tab !== FH_TAB && !back) { FH_STACK.push(FH_TAB); if (FH_STACK.length > 12) FH_STACK.shift(); }
  if (tab) FH_TAB = tab; FH_OPEN = true;
  const T = fhTabInfo(FH_TAB) || fhTabInfo("tasks"), art = fhArt(FH_TAB); el.setAttribute("aria-label", T[2]);
  el.innerHTML = `<div class="sheet-body fh-sheet fh-pg-${esc(FH_TAB)}"><div class="fh-pghead"><button class="fh-back" data-fhback="1" aria-label="Back">‹</button>
      <h2><span aria-hidden="true">${T[1]}</span> ${esc(T[2])}</h2><button class="fh-tb fh-shut" data-fhclose="1" aria-label="Close">✕</button></div>
    ${art ? `<div class="fh-band" style="background-image:url('${art}')" aria-hidden="true"></div>` : ""}
    <div class="home-pane fh-pane">${fhPane()}</div><p class="fine" id="fhMsg">${FH_MSG ? "⚠️ " + esc(FH_MSG) : ""}</p>
    <nav class="auto-tabs mv-tabs fh-tabs" aria-label="Family Hub">${fhNavHtml(FH_TAB)}</nav></div>`;
  el.classList.remove("hidden");
  const b = el.querySelector(".sheet-body");
  if (was) b.style.animation = "none";
  if (keep) b.scrollTop = keep;
  fhEach("after", el);
}
const fhMsgShow = () => { const el = document.getElementById("fhMsg"); if (el) el.textContent = FH_MSG ? "⚠️ " + FH_MSG : ""; };
function fhNavHtml(on) {
  const cur = FH_NAVOF[on] || "more", un = typeof fhUnread === "function" ? fhUnread() : 0;
  return FH_NAV.map(([k, i, l]) => `<button class="${cur === k ? "on" : ""}" ${k === "home" ? (on === "home" ? 'data-fhtop="1"' : 'data-fhclose="1"') : `data-fhnav="${k}"`}
    aria-current="${cur === k ? "page" : "false"}" aria-label="${l}${k === "msg" && un ? `, ${un} new` : ""}"><span aria-hidden="true">${i}</span>${l}${k === "msg" && un ? `<i class="fh-badge" aria-hidden="true">${un > 9 ? "9+" : un}</i>` : ""}</button>`).join("")
    + `<button class="fh-plus" data-fhnav="add" aria-label="Add something"><span aria-hidden="true">＋</span></button>`;
}
function fhNavEnsure() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("fh", fhSet());
  document.body.classList.toggle("fh-big", fhSet() && !!fh().big);
  let n = document.getElementById("fhNav");
  if (!fhSet()) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement("nav"); n.id = "fhNav"; n.className = "mv-nav fh-nav"; n.setAttribute("aria-label", "Family Hub"); document.body.appendChild(n); }
  n.innerHTML = fhNavHtml("home");
  const tc = document.getElementById("themeColor"); if (tc) tc.setAttribute("content", "#0f2f7a");
}
function fhPane() {
  const P = Object.assign({ tasks: fhTasksHtml, add: fhAddHtml, family: fhFamilyHtml, more: fhMoreHtml, cal: fhCalHtml, lists: fhListsHtml, todo: fhTodoHtml, card: fhCardHtml,
    money: fhMoneyHtml, bday: fhBdayHtml, who: fhWhoHtml, share: fhShareHtml, big: fhBigHtml, needs: fhNeedsHtml }, ...FH_MODS.map(m => m.panes || {}));
  return (P[FH_TAB] || fhTasksHtml)();
}
// Back: a form or a sub-page first, then the page before, then Today.
function fhBack() {
  if (FH_PIN_FOR || FH_EDIT) { FH_PIN_FOR = null; FH_EDIT = null; FH_MSG = ""; FH_EVKIND = FH_EVTITLE = FH_EVPET = ""; showFh(); return; }
  if (fhAny("back")) { showFh(); return; }
  if (FH_TAB === "lists" && FH_LIST) { FH_LIST = null; showFh(); return; }
  if (FH_STACK.length) { showFh(FH_STACK.pop(), true); return; }
  hideFh(); render();
}
const fhDepth = () => FH_OPEN ? 1 + FH_STACK.length + (FH_PIN_FOR || FH_EDIT ? 1 : 0) + (FH_TAB === "lists" && FH_LIST ? 1 : 0) + fhEach("depth").reduce((n, x) => n + (+x || 0), 0) : 0;
// The phone's back button walks back the same way (one history step per level), as the other new looks do.
let FH_HDEPTH = 0, FH_HSKIP = 0, FH_HT = 0;
const FH_CLOSERS = ["askclose", "pulseclose", "close", "upclose", "readyclose", "forgetclose"].map(k => `[data-${k}]`).join(", ");
const fhOthers = () => [...document.querySelectorAll(".sheet:not(.hidden)")].filter(el => el.id !== "fhSheet");
function fhSyncHistory() {
  FH_HT = 0;
  if (FH_HSKIP || typeof MODE === "undefined" || MODE !== "family" || !fhSet()) return;
  const want = fhDepth() + fhOthers().length;
  try {
    if (want && "scrollRestoration" in history) history.scrollRestoration = "manual";
    while (FH_HDEPTH < want) history.pushState({ fh: ++FH_HDEPTH }, "");
    if (FH_HDEPTH > want) { FH_HSKIP++; setTimeout(() => { FH_HSKIP = 0; }, 1500); history.go(want - FH_HDEPTH); FH_HDEPTH = want; }
  } catch (e) { FH_HDEPTH = want; /* some browsers limit this; the arrow still works */ }
}
const fhSyncSoon = () => { if (!FH_HT) FH_HT = setTimeout(fhSyncHistory, 0); };
if (typeof document !== "undefined" && typeof window !== "undefined") {
  document.addEventListener("click", () => { if (typeof MODE !== "undefined" && MODE === "family") fhSyncSoon(); });
  document.addEventListener("submit", () => { if (typeof MODE !== "undefined" && MODE === "family") fhSyncSoon(); });
  window.addEventListener("popstate", () => {
    if (FH_HSKIP) { FH_HSKIP--; fhSyncSoon(); return; }
    if (typeof MODE === "undefined" || MODE !== "family" || !fhSet()) return;
    FH_HDEPTH = Math.max(0, FH_HDEPTH - 1);
    const o = fhOthers();
    if (o.length) { const el = o[o.length - 1], x = el.querySelector(FH_CLOSERS); if (x) x.click(); else { el.classList.add("hidden"); render(); } }
    else if (FH_OPEN) fhBack();
    fhSyncSoon();
  });
}

// ------------------------------------------------------------ first run
function fhSetupHtml() {
  fhNavEnsure(); if (FH_OPEN) hideFh();          // after Erase: no tab bar and no open page on an empty family
  if (typeof document !== "undefined") document.body.classList.add("fhapp");
  return `<section class="card fh-home fh-hello" aria-label="Welcome to Family Hub"><div class="fh-hello-top">${fhHeartArt()}
      <div><h1>Family <b>Hub</b></h1><p>One family. One place. Everything organized.</p></div></div>
    <div class="fh-promise">${["📅 Calendar", "✅ Chores", "🛒 Lists", "💵 Allowances", "🎂 Birthdays", "🆘 Emergency card"].map(w => `<span>${w}</span>`).join("")}</div>
    <h2>Welcome to Family Hub 💛</h2><p>Name your family and yourself. Then add everyone else - kids, grandparents, even the dog.</p>
    <form class="qa-form fh-form" data-fhsetup="1">
      <label class="field">Family name<input name="fam" placeholder="e.g. The Marvel Family" maxlength="40" required></label>
      <label class="field">Your first name<input name="name" placeholder="e.g. Scott" maxlength="24" autocomplete="given-name" required></label>
      <fieldset class="fh-faces"><legend>Pick your face</legend>${FH_FACES.map((f, i) => `<label><input type="radio" name="face" value="${f}"${i === 1 ? " checked" : ""}><span>${f}</span></label>`).join("")}</fieldset>
      <button class="btn fh-go">Start Family Hub</button></form>
    ${typeof fhsSetupExtra === "function" ? fhsSetupExtra() : ""}
    <p class="fine">You're the family's owner. Everything stays on this phone for now - a family tablet works great. Sharing between everyone's phones is coming.</p></section>`;
}
// The glowing family heart (SVG, no image files). Motion stops under "reduce motion".
function fhHeartArt() {
  return `<svg class="fh-heart-art" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs>
      <radialGradient id="fhHeartG" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffe3ea"/><stop offset=".42" stop-color="#ff6b8b"/><stop offset="1" stop-color="#b3124d"/></radialGradient>
      <radialGradient id="fhHalo" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#ff8fab" stop-opacity=".5"/><stop offset="1" stop-color="#ff8fab" stop-opacity="0"/></radialGradient></defs>
    <circle class="fh-halo" cx="60" cy="60" r="58" fill="url(#fhHalo)"/>
    <path d="M60 98C22 72 13 52 23 35c9-14 28-13 37 2 9-15 28-16 37-2 10 17 1 37-37 63z" fill="url(#fhHeartG)" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
    <ellipse cx="41" cy="41" rx="10" ry="5.5" fill="#fff" opacity=".45" transform="rotate(-32 41 41)"/></svg>`;
}

// ------------------------------------------------------------ HOME: Today (Scott's board 1: the greeting over the house, everyone's faces,
// today's events, quick actions; then ChatGPT's order: messages, important dates, photos, chores, home, what needs you)
// The hidden top band's must-see notices (new version, Install, backup waiting, tap to sync), as every new look shows them.
function fhNoticesHtml() {
  if (typeof heroHtml !== "function" || typeof CHIPS_ALL === "undefined") return "";
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } catch (e) { html = ""; } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-cloudask], .chips > [data-sync], .chips > [data-syncall], .chips > [data-brief]")];
  return keep.length ? `<div class="fh-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}
// This week's chores so far (Sunday to today): the person's own when a kid is using the phone, everyone's for a parent.
function fhWeekStats(t) {
  const start = addDays(t, -parseDay(t).getDay()), me = fhMe(), kid = !!me && me.role === "child";
  let due = 0, done = 0, pts = 0;
  for (let d = start; d <= t; d = addDays(d, 1)) fh().chores.forEach(c => { if (kid && c.who !== me.id) return;
    const on = c.every === "daily" || c.every === "weekly" ? fhChoreDue(c, d) : c.date === d; if (!on) return;
    due++; const l = c.log[d]; if (l && (l.st === "done" || l.st === "ok")) done++; if (l && l.st === "ok") pts += +l.pts || 0; });
  return { due, done, pts, pct: due ? Math.round(done / due * 100) : 0 };
}
const fhRing = pct => { const r = 26, c = 2 * Math.PI * r;
  return `<svg class="fh-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="bg"/><circle cx="32" cy="32" r="${r}" class="fg" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${pct}%</text></svg>`; };
// Important dates in the next n days: birthdays, anniversaries, reunions, trips, parties, appointments, and anything with a week-ahead reminder.
function fhDates(t, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const d = addDays(t, i); fhDay(d).forEach(x => { if (x.bday || FH_BIGKINDS.includes(x.e.kind) || (Array.isArray(x.e.rem) && x.e.rem.includes("week"))) out.push({ ...x, d }); }); }
  return out;
}
function fhChoreRow(x) {
  const st = x.st, ok = st === "ok", done = st === "done", adult = fhAdult();
  const can = (!ok && !done && fhCan("done", x.c)) || ((done || ok) && fhCan("undo", x)) || (done && adult);
  const lab = ok ? "OK'd" : done ? "waiting for a parent's OK" : st === "late" ? `was due ${prettyDate(x.k)}` : "due today";
  return `<div class="fh-chrow st-${st}" style="--tone:${fhColor(x.c.who)}">${can ? `<button class="fh-tick" data-fhdone="${x.c.id}|${x.k}" aria-pressed="${ok || done}" aria-label="${esc(x.c.title)}: ${esc(lab)}">${ok || done ? "✓" : ""}</button>` : `<span class="fh-tick ro" aria-hidden="true">${ok || done ? "✓" : ""}</span>`}
    ${fhDot(x.c.who)}<span class="grow"><b>${esc(x.c.title)}</b><small>${esc(fhName(x.c.who))} · ${esc(lab)}</small></span>${+x.c.pts ? `<span class="fh-pts">⭐ ${+x.c.pts}</span>` : ""}</div>`;
}
function fhDashHtml() {
  fhNavEnsure();
  const t = today(), F = fh(), me = fhMe(), N = fhNeeds(t), D = fhDay(t), CH = fhChoresOn(t), adult = fhAdult();
  const wd = parseDay(t).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const using = me ? `<button class="fh-using" data-fhtab="who" aria-label="Using this phone: ${esc(me.name)}. Switch">${fhDot(me.id)}<span>${esc(me.name)}</span><em>⇄</em></button>` : "";
  if (F.big) return fhBigDashHtml(t, wd, using, N, D);
  const h = new Date().getHours(), hi = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening", W = fhWeekStats(t);
  const faces = fhMembers().slice(0, 12).map(m => `<button class="fh-face" data-fhprof="${m.id}" style="--tone:${m.color || "#c8d6e5"}" aria-label="${esc(m.name)}'s profile"><span aria-hidden="true">${m.face || "🙂"}</span><b>${esc(m.name)}</b></button>`).join("")
    + (adult && fhMembers().length < 16 ? `<button class="fh-face add" data-fhmemnew="1" aria-label="Add a family member"><span aria-hidden="true">＋</span><b>Add</b></button>` : "");
  const sec = [];
  sec.push([10, `<section class="fh-card" aria-label="Today's events"><div class="fh-cardh"><h3>📅 Today's Events</h3><button data-fhnav="cal">Calendar ›</button></div>
    ${D.length ? `<div class="fh-agenda">${D.map(x => fhAgendaRow(x)).join("")}</div>` : `<p class="hos-hint">Nothing on the calendar today.${fhCan("event") ? ` <button class="mv-linkb fh-link" data-fhevnew="${t}">Add something</button>` : ""}</p>`}</section>`]);
  sec.push([15, `<section class="fh-card" aria-label="Quick actions"><div class="fh-cardh"><h3>⚡ Quick Actions</h3></div>${fhTiles([
    { icon: "📅", label: "Calendar", attrs: 'data-fhnav="cal"', tone: "#2e86de" }, { icon: "✅", label: "Chores", attrs: 'data-fhtab="tasks"', tone: "#22b04b" },
    { icon: "🛒", label: "Shopping", attrs: 'data-fhtab="lists"', tone: "#ff9f43" }, { icon: "👨‍👩‍👧", label: "Family", attrs: 'data-fhnav="family"', tone: "#8e44ff" }], "fh-quick")}</section>`]);
  const DT = fhDates(t, 30).filter(x => x.d !== t).slice(0, 5);
  if (DT.length) sec.push([30, `<section class="fh-card" aria-label="Coming up"><div class="fh-cardh"><h3>🎉 Coming Up</h3><button data-fhnav="cal">Calendar ›</button></div>
    <div class="fh-agenda">${DT.map(x => fhAgendaRow(x, true)).join("")}</div></section>`]);
  const mineCH = adult ? CH : CH.filter(x => me && x.c.who === me.id);
  if (F.chores.length || fhCan("chore")) sec.push([50, `<section class="fh-card" aria-label="Chores"><div class="fh-cardh"><h3>✅ Family Tasks &amp; Chores</h3><button data-fhtab="tasks">All ›</button></div>
    ${W.due ? `<div class="fh-wkstat">${fhRing(W.pct)}<span class="grow"><b>This week</b><small>${W.done} of ${W.due} done</small><i class="fhl-bar"><i style="width:${W.pct}%"></i></i></span>
      ${W.pts ? `<span class="fh-stars"><small>Rewards earned</small><b>⭐ ${W.pts}</b></span>` : ""}</div>` : ""}
    ${mineCH.slice(0, 5).map(fhChoreRow).join("") || `<p class="hos-hint">No chores today.${fhCan("chore") ? ` <button class="mv-linkb fh-link" data-fhchnew="1">Add one</button> - kids check them off, you OK them.` : ""}</p>`}</section>`]);
  const more = N.filter(x => x.tab !== "msg");
  if (more.length) sec.push([60, `<section class="fh-card" aria-label="Needs you"><div class="fh-cardh"><h3>🔔 Needs You</h3>${more.length > 4 ? `<button data-fhtab="needs">All ${more.length} ›</button>` : ""}</div>
    <div class="fh-needs">${more.slice(0, 4).map(x => `<button class="fh-need${x.late ? " late" : ""}" data-fhtab="${x.tab}" style="--tone:${x.tone}">${fhIc(x.icon, x.tone, "sm")}<span class="grow"><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></span><em>›</em></button>`).join("")}</div></section>`]);
  FH_MODS.forEach(m => { if (typeof m.today !== "function") return; const r = m.today(t); if (Array.isArray(r) && r[1]) sec.push(r); });
  sec.sort((a, b) => a[0] - b[0]);
  return `<section class="fh-home" aria-label="Family Hub">
    <div class="fh-topbar"><button class="fh-tb" data-fhnav="more" aria-label="More family tools">☰</button><span class="fh-logo">${fhHeartArt()}<b>Family Hub</b></span>
      <button class="fh-tb fh-bell" data-fhtab="needs" aria-label="Needs you${N.length ? ": " + N.length : ""}">🔔${N.length ? `<i class="fh-badge" aria-hidden="true">${N.length > 9 ? "9+" : N.length}</i>` : ""}</button></div>
    <div class="fh-hello2"><h1>${hi},<br>${esc(String(F.name || "Family").replace(/^the\s+/i, ""))}!</h1><small>${esc(wd)}</small>${using}</div>
    <div class="fh-faces2" role="group" aria-label="Our family">${faces}</div>
    ${fhNoticesHtml()}
    ${sec.map(x => x[1]).join("")}
    ${typeof fhsNote === "function" && fhsNote() ? `<p class="fine fh-note"><button class="mv-linkb fh-link" data-fhtab="share">${esc(fhsNote())}</button></p>`
      : `<p class="fine fh-note">Your family lives on this phone. <button class="mv-linkb fh-link" data-fhtab="share">Share it with everyone's phones</button></p>`}
  </section>`;
}
// Grandparent Mode: the day, what needs you and six big buttons - nothing else.
function fhBigDashHtml(t, wd, using, N, D) {
  return `<section class="fh-home fh-bighome" aria-label="Family Hub">
    <div class="fh-topbar"><span class="fh-logo">${fhHeartArt()}<b>Family Hub</b></span></div>
    <h1 class="fh-bigday">${esc(wd)}</h1>${using}
    <h2>Today</h2>${D.length ? `<div class="fh-agenda">${D.map(x => fhAgendaRow(x)).join("")}</div>` : `<p class="hos-hint">Nothing on the calendar today.</p>`}
    ${N.length ? `<h2>Needs you</h2><div class="fh-needs">${N.slice(0, 4).map(x => `<button class="fh-need" data-fhtab="${x.tab}" style="--tone:${x.tone}">${fhIc(x.icon, x.tone, "sm")}<span class="grow"><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></span></button>`).join("")}</div>` : ""}
    <div class="fh-bigbtns">${[["msg", "💬", "Messages"], ["cal", "📅", "Calendar"], ["photos", "📸", "Photos"], ["lists", "🛒", "Lists"], ["card", "🆘", "Emergency"], ["family", "👨‍👩‍👧", "Family"]]
      .filter(([k]) => fhTabInfo(k)).map(([k, i, l]) => `<button data-fhtab="${k}"><span aria-hidden="true">${i}</span>${l}</button>`).join("")}</div>
    <button class="btn sm ghost fh-bigoff" data-fhbig="0">Turn off Grandparent Mode</button></section>`;
}
function fhAgendaRow(x, withDay) {
  if (x.bday) return `<button class="fh-row" data-fhtab="bday" style="--tone:${x.bday.color || "#ff6bcb"}"><span class="fh-when">${withDay ? `<b>${esc(fhRel(x.d))}</b>` : "<b>All day</b>"}</span>
    ${fhIc("🎂", "#ff6bcb", "sm")}<span class="grow"><b>${esc(x.bday.name)}'s birthday</b></span></button>`;
  const e = x.e, k = fhKind(e.kind), tone = e.who.length === 1 ? fhColor(e.who[0]) : "#2e86de";
  return `<button class="fh-row" ${fhCan("event") ? `data-fhevedit="${e.id}@${x.d}"` : 'data-fhtab="cal"'} style="--tone:${tone}">
    <span class="fh-when">${withDay ? `<b>${esc(fhRel(x.d))}</b><small>${x.time ? hm(x.time) : "all day"}</small>` : `<b>${x.time ? hm(x.time) : "All day"}</b>`}</span>
    ${fhIc(k[1], tone, "sm")}<span class="grow"><b>${esc(e.title)}${e.vis === "adults" ? " 🔒" : ""}</b><small>${[e.where, e.rep && e.rep !== "none" ? "🔁" : ""].filter(Boolean).map(esc).join(" · ")}</small></span>
    <span class="fh-dots">${e.who.map(fhDot).join("")}</span><em class="fh-chev" aria-hidden="true">›</em></button>`;
}
function fhNeedsHtml() {
  const N = fhNeeds(today());
  return N.length ? `<div class="fh-needs">${N.map(x => `<button class="fh-need${x.late ? " late" : ""}" data-fhtab="${x.tab}" style="--tone:${x.tone}">${fhIc(x.icon, x.tone, "sm")}<span class="grow"><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></span><em>›</em></button>`).join("")}</div>`
    : `<p class="hos-hint">✨ All caught up.</p>`;
}

// ------------------------------------------------------------ ＋ ADD and MORE: big tiles (board 1's More: Meals, School, Memories, Documents, Emergency, Trips, Pets, Goals, Settings)
function fhAddHtml() {
  const T = [["fhevnew", today(), "📅", "Event", "event", "#2e86de"], ["fhchnew", "1", "🧹", "Chore", "chore", "#22b04b"], ["fhtab", "lists", "🛒", "Grocery item", "", "#ff9f43"], ["fhtodonew", "1", "📌", "To-do", "todo", "#e1a100"],
    ["fhmemnew", "1", "👨‍👩‍👧", "Family member", "members", "#8e44ff"], ["fhtab", "card", "🆘", "Emergency contact", "card", "#e74c3c"], ["fhtab", "money", "💵", "Pay allowance", "pay", "#10ac84"], ["fhtab", "bday", "🎂", "Birthday", "members", "#ff6bcb"]];
  return fhTiles(T.filter(x => !x[4] || fhCan(x[4])).map(([k, v, i, l, , c]) => ({ icon: i, label: l, attrs: `data-${k}="${v}"`, tone: c })).concat(...fhEach("adds").filter(Array.isArray)), "fh-addtiles");
}
const FH_MORE = [["tasks", "#22b04b", "Chores"], ["lists", "#ff9f43", "Shopping"], ["meals", "#ff7f50", "Meals"], ["school", "#2e86de", "School"], ["photos", "#ff6bcb", "Memories"], ["docs", "#e1a100", "Documents"],
  ["card", "#e74c3c", "Emergency"], ["trips", "#00a8cc", "Trips"], ["pets", "#c07a3a", "Pets"], ["goals", "#e84393", "Goals"], ["bday", "#ff6bcb", "Birthdays"], ["todo", "#d4a000", "To-do board"],
  ["money", "#10ac84", "Allowances"], ["tree", "#27ae60", "Family tree"], ["sharing", "#5f27cd", "Who sees what"], ["who", "#576574", "Who's using"], ["big", "#8e44ff", "Grandparent Mode"], ["share", "#0abde3", "Share"]];
function fhMoreHtml() {
  const items = FH_MORE.filter(([k]) => fhTabInfo(k) && (k !== "card" || fhCan("seeCard"))).map(([k, c, l]) => ({ icon: fhTabInfo(k)[1], label: l, attrs: `data-fhtab="${k}"`, tone: c }))
    .concat([{ icon: "⚙️", label: "Settings", attrs: 'data-fhgo="settings"', tone: "#576574" }, { icon: "💡", label: "Ask", attrs: 'data-fhask="1"', tone: "#f39c12" }]);
  return fhTrialHtml() + fhTiles(items, "fh-moretiles") + `<p class="fine">Family Hub keeps your family on this phone. No ads. No location tracking. Kids are profiles a parent manages.</p>`;
}

// ------------------------------------------------------------ CALENDAR: Month, Week or Today, a filter per person
function fhCalHtml() {
  if (FH_EDIT && FH_EDIT.startsWith("ev:")) return fhEventForm();
  const t = today(), chips = [["all", "👨‍👩‍👧", "Everyone", "#2e86de"]].concat(fhMembers().map(m => [m.id, m.face, m.name, m.color]));
  const seg = `<div class="fh-seg" role="tablist" aria-label="Calendar view">${[["month", "Month"], ["week", "Week"], ["day", "Today"]].map(([k, l]) => `<button role="tab" aria-selected="${FH_CALV === k}" class="${FH_CALV === k ? "on" : ""}" data-fhcalv="${k}">${l}</button>`).join("")}</div>`;
  let body = "", addDay = t;
  if (FH_CALV === "month") body = fhMonthHtml(t);
  else if (FH_CALV === "day") { const d = fhIsD(FH_DAYV) ? FH_DAYV : t, L = fhDay(d, FH_WHO); addDay = d;
    body = `<div class="fh-weeknav"><button class="btn sm ghost" data-fhdayv="${addDays(d, -1)}" aria-label="Day before">‹</button><b>${d === t ? "Today" : esc(FH_WD[parseDay(d).getDay()])} · ${esc(prettyDate(d))}</b>
      <button class="btn sm ghost" data-fhdayv="${addDays(d, 1)}" aria-label="Next day">›</button>${d !== t ? `<button class="btn sm ghost" data-fhdayv="${t}">Today</button>` : ""}</div>
      <div class="fh-agenda fh-dayl">${L.length ? L.map(x => fhAgendaRow(x)).join("") : `<p class="hos-hint">Nothing on ${d === t ? "today" : esc(prettyDate(d))}.</p>`}</div>`; }
  else { const start = addDays(t, -parseDay(t).getDay() + FH_WEEK * 7), days = [...Array(7)].map((_, i) => addDays(start, i));
    body = `<div class="fh-weeknav"><button class="btn sm ghost" data-fhweek="-1" aria-label="Last week">‹</button><b>${esc(prettyDate(days[0]))} - ${esc(prettyDate(days[6]))}</b>
      <button class="btn sm ghost" data-fhweek="1" aria-label="Next week">›</button>${FH_WEEK ? `<button class="btn sm ghost" data-fhweek="0">This week</button>` : ""}</div>
      <div class="fh-wkstrip">${days.map(d => `<button class="${d === t ? "now" : ""}${fhDay(d, FH_WHO).length ? " has" : ""}" data-fhday="${d}"><small>${FH_WD[parseDay(d).getDay()].slice(0, 3)}</small><b>${+d.slice(8)}</b></button>`).join("")}</div>
      <div class="fh-week">${days.map(d => { const L = fhDay(d, FH_WHO);
        return `<div class="fh-day${d === t ? " now" : ""}"><div class="fh-dayhead"><b>${FH_WD[parseDay(d).getDay()].slice(0, 3)}</b><small>${esc(prettyDate(d))}</small>
            ${fhCan("event") ? `<button class="fh-dayadd" data-fhevnew="${d}" aria-label="Add on ${esc(prettyDate(d))}">＋</button>` : ""}</div>
          ${L.length ? L.map(x => fhAgendaRow(x)).join("") : `<p class="fh-free">free</p>`}</div>`; }).join("")}</div>`; }
  return `${seg}<div class="fh-chips" role="group" aria-label="Show">${chips.map(([id, f, n, c]) => `<button class="fh-chip${FH_WHO === id ? " on" : ""}" data-fhwho="${id}" style="--tone:${c}">${f} ${esc(n)}</button>`).join("")}</div>
    ${body}${fhCan("event") ? `<button class="btn fh-go fh-addev" data-fhevnew="${addDay}">📅 Add Event</button>` : `<p class="fine">Ask a parent to add things to the calendar.</p>`}`;
}
function fhMonthHtml(t) {
  const base = parseDay(t); base.setDate(1); base.setMonth(base.getMonth() + FH_MONTH);
  const y = base.getFullYear(), mo = base.getMonth(), first = `${y}-${String(mo + 1).padStart(2, "0")}-01`, n = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(base.getDay())].map(() => `<span class="fh-mc empty" aria-hidden="true"></span>`).concat([...Array(n)].map((_, i) => { const d = addDays(first, i), L = fhDay(d, FH_WHO);
    return `<button class="fh-mc${d === t ? " now" : ""}${L.length ? " has" : ""}" data-fhday="${d}" aria-label="${esc(prettyDate(d))}: ${L.length ? L.length + " on the calendar" : "free"}"><b>${i + 1}</b>
      <span class="fh-mdots" aria-hidden="true">${L.slice(0, 3).map(x => `<i style="--tone:${x.bday ? "#ff6bcb" : x.e.who.length === 1 ? fhColor(x.e.who[0]) : "#2e86de"}"></i>`).join("")}</span></button>`; }));
  const all = [...Array(n)].map((_, i) => addDays(first, i)).filter(d => d >= t || FH_MONTH < 0).flatMap(d => fhDay(d, FH_WHO).map(x => ({ ...x, d }))).slice(0, 12);
  return `<div class="fh-weeknav"><button class="btn sm ghost" data-fhmonth="-1" aria-label="Last month">‹</button><b>${esc(base.toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</b>
      <button class="btn sm ghost" data-fhmonth="1" aria-label="Next month">›</button>${FH_MONTH ? `<button class="btn sm ghost" data-fhmonth="0">This month</button>` : ""}</div>
    <div class="fh-month"><div class="fh-mhead" aria-hidden="true">${FH_WD.map(w => `<span>${w.slice(0, 1)}</span>`).join("")}</div><div class="fh-mgrid">${cells.join("")}</div></div>
    ${all.length ? `<div class="mv-sec"><h3>${FH_MONTH ? "This month" : "Still to come this month"}</h3></div><div class="fh-agenda">${all.map(x => fhAgendaRow(x, true)).join("")}</div>` : ""}`;
}
function fhEventForm() {
  const [id, day] = FH_EDIT.slice(3).split("@"), e = id !== "new" && fh().events.find(x => x.id === id);
  if (id !== "new" && !e) { FH_EDIT = null; return fhCalHtml(); }
  const kind = FH_KINDS.some(k => k[0] === FH_EVKIND) ? FH_EVKIND : "family";
  const v = e || { title: FH_EVTITLE || "", date: day || today(), time: "", kind, rep: "none", until: "", where: "", note: "", vis: "", who: [], rem: FH_BIGKINDS.includes(kind) ? ["week", "day", "same"] : ["same"] };
  const rep = v.rep && v.rep !== "none", rem = Array.isArray(v.rem) ? v.rem : ["same"];
  return `<form class="qa-form fh-form" data-fhevent="${e ? e.id : "new"}">
    <label class="field">What<input name="title" value="${esc(v.title)}" placeholder="e.g. Soccer practice" maxlength="80" required></label>
    <div class="fh-two"><label class="field">Day<input type="date" name="date" value="${esc(v.date)}" required></label><label class="field">Time (optional)<input type="time" name="time" value="${esc(v.time || "")}"></label></div>
    <label class="field">Kind<select name="kind">${FH_KINDS.map(([k, i, l]) => `<option value="${k}"${v.kind === k ? " selected" : ""}>${i} ${l}</option>`).join("")}</select></label>
    <fieldset class="fh-pick"><legend>Who's in it</legend>${fhMembers().map(m => `<label class="fh-chip" style="--tone:${m.color}"><input type="checkbox" name="w_${m.id}" value="1"${v.who.includes(m.id) ? " checked" : ""}><span>${m.face} ${esc(m.name)}</span></label>`).join("")}
      <small>None picked = the whole family.</small></fieldset>
    <div class="fh-two"><label class="field">Repeats<select name="rep">${FH_REPEAT.map(([k, l]) => `<option value="${k}"${(v.rep || "none") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field">Until (optional)<input type="date" name="until" value="${esc(v.until || "")}"></label></div>
    <label class="field">Where<input name="where" value="${esc(v.where || "")}" maxlength="80" placeholder="e.g. Laurel Park field 3"></label>
    <label class="field">Notes<input name="note" value="${esc(v.note || "")}" maxlength="200"></label>
    <fieldset class="fh-pick"><legend>🔔 Remind me</legend>${FH_REM.map(([k, l]) => `<label class="fh-chip" style="--tone:#2e86de"><input type="checkbox" name="r_${k}" value="1"${rem.includes(k) ? " checked" : ""}><span>${l}</span></label>`).join("")}
      <small>Reminders show while Reminders are on in Settings.</small></fieldset>
    <input type="hidden" name="pet" value="${esc(e ? e.pet || "" : FH_EVPET)}">
    <label class="fh-check"><input type="checkbox" name="adults" value="1"${v.vis === "adults" ? " checked" : ""}> 🔒 Adults only - kids and guests don't see it</label>
    <div class="fh-btns"><button class="btn fh-go">Save</button><button type="button" class="btn sm ghost" data-fhcancel="1">Cancel</button></div>
    ${e ? `<div class="fh-btns fh-danger">${rep && day ? `<button type="button" class="btn sm ghost" data-fhevskip="${e.id}@${day}">Skip just ${esc(prettyDate(day))}</button>` : ""}
      <button type="button" class="btn sm ghost" data-fhevdel="${e.id}">🗑️ Delete${rep ? " every one" : ""}</button></div>` : ""}</form>`;
}

// ------------------------------------------------------------ CHORES (Tasks): today, waiting for an OK, everyone's list
function fhTasksHtml() {
  if (FH_EDIT && FH_EDIT.startsWith("ch:")) return fhChoreForm();
  const t = today(), me = fhMe(), adult = fhAdult(), W = fhWaiting(), CH = fhChoresOn(t);
  const btn = x => { const st = x.st, ok = st === "ok", done = st === "done";
    const can = (!ok && !done && fhCan("done", x.c)) || ((done || ok) && fhCan("undo", x)) || (done && adult);
    const label = ok ? "✅ OK'd" : done ? "⏳ Waiting for OK" : st === "late" ? "◯ Late" : "◯ Not yet";
    return can ? `<button class="fh-state st-${st}" data-fhdone="${x.c.id}|${x.k}">${label}</button>` : `<span class="fh-state st-${st}">${label}</span>`; };
  const group = fhMembers().filter(m => m.role !== "guest").map(m => ({ m, L: CH.filter(x => x.c.who === m.id) })).filter(g => g.L.length);
  return `${adult && W.length ? `<div class="mv-sec"><h3>Waiting for your OK</h3><small class="fh-count">${W.length}</small></div>
      <div class="fh-needs">${W.map(w => `<div class="fh-okrow" style="--tone:${fhColor(w.c.who)}">${fhDot(w.c.who)}<span class="grow"><b>${esc(w.c.title)}</b><small>${esc(fhName(w.c.who))} · ${esc(fhRel(w.k))}${fhRewards(w.c) ? " · " + esc(fhRewards(w.c)) : ""}</small></span>
        <button class="btn sm fh-go" data-fhok="${w.c.id}|${w.k}">✓ OK</button><button class="btn sm ghost" data-fhnot="${w.c.id}|${w.k}" aria-label="Not done yet">↩</button></div>`).join("")}</div>` : ""}
    <div class="mv-sec"><h3>Today's chores</h3>${fhCan("chore") ? `<button data-fhchnew="1">＋ Add</button>` : ""}</div>
    ${group.length ? group.map(g => `<div class="fh-chgroup" style="--tone:${g.m.color}"><div class="fh-chhead">${fhDot(g.m.id)}<b>${esc(g.m.name)}</b>
        <small>${g.L.filter(x => x.st === "ok" || x.st === "done").length}/${g.L.length} done</small></div>
        ${g.L.map(x => `<div class="fh-chore"><span class="grow"><b>${esc(x.c.title)}</b><small>${[x.st === "late" ? `was due ${esc(prettyDate(x.k))}` : "", esc(fhRewards(x.c))].filter(Boolean).join(" · ")}</small></span>${btn(x)}</div>`).join("")}</div>`).join("")
      : `<p class="hos-hint">No chores today.${fhCan("chore") ? " Add one - kids can check them off, you OK them." : ""}</p>`}
    ${adult && fh().chores.length ? `<div class="mv-sec"><h3>All chores</h3></div><div class="fh-all">${fh().chores.map(c => `<button class="fh-row" data-fhchedit="${c.id}" style="--tone:${fhColor(c.who)}">
        ${fhDot(c.who)}<span class="grow"><b>${esc(c.title)}</b><small>${esc(c.every === "daily" ? "every day" : c.every === "weekly" ? "every " + FH_WD[+c.day || 0] : "once, " + prettyDate(c.date || today()))}${fhRewards(c) ? " · " + esc(fhRewards(c)) : ""}</small></span><em>✎</em></button>`).join("")}</div>` : ""}
    <div class="fh-btns"><button class="btn sm ghost" data-fhtab="todo">📌 Family to-do board</button><button class="btn sm ghost" data-fhtab="money">💵 Allowances</button></div>
    ${!adult && me ? `<p class="fine">Check off your chores, ${esc(me.name)} - a parent OKs them and your stars add up.</p>` : ""}`;
}
function fhChoreForm() {
  const id = FH_EDIT.slice(3), c = id !== "new" && fh().chores.find(x => x.id === id);
  if (id !== "new" && !c) { FH_EDIT = null; return fhTasksHtml(); }
  const v = c || { title: "", who: (fhMembers().find(m => m.role === "child") || fhMe() || {}).id, every: "daily", date: today(), day: parseDay(today()).getDay(), pts: 1, amt: "" };
  const kids = fhMembers().filter(m => m.role !== "guest");
  return `<form class="qa-form fh-form" data-fhchore="${c ? c.id : "new"}">
    <label class="field">Chore<input name="title" value="${esc(v.title)}" placeholder="e.g. Feed the dog" maxlength="60" required></label>
    <label class="field">Who<select name="who">${kids.map(m => `<option value="${m.id}"${v.who === m.id ? " selected" : ""}>${m.face} ${esc(m.name)}</option>`).join("")}</select></label>
    <div class="fh-two"><label class="field">How often<select name="every">${FH_EVERY.map(([k, l]) => `<option value="${k}"${v.every === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field">Weekly on<select name="day">${FH_WD.map((d, i) => `<option value="${i}"${+v.day === i ? " selected" : ""}>${d}</option>`).join("")}</select></label></div>
    <label class="field">Once: on this day<input type="date" name="date" value="${esc(v.date || today())}"></label>
    <div class="fh-two"><label class="field">⭐ Stars<input type="number" name="pts" min="0" max="100" value="${esc(String(v.pts || 0))}" inputmode="numeric"></label>
      <label class="field">💵 Allowance $<input type="number" name="amt" min="0" max="100" step="0.25" value="${esc(String(v.amt || ""))}" inputmode="decimal" placeholder="0"></label></div>
    <div class="fh-btns"><button class="btn fh-go">Save</button><button type="button" class="btn sm ghost" data-fhcancel="1">Cancel</button></div>
    ${c ? `<div class="fh-btns fh-danger"><button type="button" class="btn sm ghost" data-fhchdel="${c.id}">🗑️ Delete chore</button></div>` : ""}
    <p class="fine">A chore is worth what it says on the day you OK it - changing it later doesn't change what was earned.</p></form>`;
}

// ------------------------------------------------------------ SHOPPING LISTS
function fhListsHtml() {
  const F = fh(), L = F.lists.find(l => l.id === FH_LIST);
  if (L) {
    const open = L.items.filter(i => !i.done), got = L.items.filter(i => i.done);
    const row = i => `<div class="fh-item${i.done ? " done" : ""}"><button class="fh-tick" data-fhitem="${L.id}|${i.id}" aria-pressed="${i.done ? "true" : "false"}" aria-label="${esc(i.text)}">${i.done ? "✓" : ""}</button>
      <span class="grow"><b>${esc(i.text)}</b>${i.by ? `<small>${esc(fhName(i.by))}</small>` : ""}</span>${fhCan("listEdit") || i.by === (fhMe() || {}).id ? `<button class="fh-x" data-fhitemdel="${L.id}|${i.id}" aria-label="Remove ${esc(i.text)}">✕</button>` : ""}</div>`;
    return `<button class="mv-linkb fh-link" data-fhlist="">‹ All lists</button><h3 class="fh-listh">${L.icon} ${esc(L.name)}</h3>
      <form class="fh-additem" data-fhitemadd="${L.id}"><input name="text" placeholder="Add an item - milk, tape, poster board" maxlength="60" aria-label="Add an item" autocomplete="off"><button class="btn sm fh-go">Add</button></form>
      ${open.length ? open.map(row).join("") : `<p class="hos-hint">Nothing to get. 🎉</p>`}
      ${got.length ? `<div class="mv-sec"><h3>In the cart</h3>${fhCan("listEdit") ? `<button data-fhclear="${L.id}">Clear</button>` : ""}</div>${got.map(row).join("")}` : ""}
      ${fhCan("listEdit") ? `<div class="fh-btns fh-danger"><button class="btn sm ghost" data-fhlistdel="${L.id}">🗑️ Delete this list</button></div>` : ""}`;
  }
  return `<div class="fh-lists">${F.lists.map(l => { const n = l.items.filter(i => !i.done).length;
      return `<button class="fh-listbtn" data-fhlist="${l.id}"><span class="fh-listic" aria-hidden="true">${l.icon}</span><span class="grow"><b>${esc(l.name)}</b><small>${n ? `${n} to get` : "all set"}</small></span><em>›</em></button>`; }).join("")}</div>
    ${fhCan("listEdit") ? `<form class="qa-form fh-form fh-newlist" data-fhlistnew="1"><div class="fh-two"><label class="field">New list<input name="name" placeholder="e.g. Party supplies" maxlength="30" required></label>
      <label class="field">Icon<select name="icon">${FH_LIST_ICONS.map(i => `<option>${i}</option>`).join("")}</select></label></div><button class="btn sm fh-go">Make the list</button></form>` : ""}
    <p class="fine">Everyone in the family can add to a list and check things off - sitters and grandparents too.</p>`;
}

// ------------------------------------------------------------ FAMILY TO-DO BOARD: To do -> Doing -> Done
function fhTodoHtml() {
  const L = fh().todos.filter(x => fhCan("see", x)), col = (st, h) => { const X = L.filter(x => x.st === st);
    return `<div class="fh-col"><div class="mv-sec"><h3>${h}</h3><small>${X.length}</small></div>${X.length ? X.map(x => `<div class="fh-todo st-${st}" style="--tone:${x.who ? fhColor(x.who) : "#c8d6e5"}">
        ${x.who ? fhDot(x.who) : fhIc("📌", "#c8d6e5", "sm")}<span class="grow"><b>${esc(x.title)}${x.vis === "adults" ? " 🔒" : ""}</b><small>${[x.who ? fhName(x.who) : "anyone", x.due ? "by " + fhRel(x.due) : ""].filter(Boolean).map(esc).join(" · ")}</small></span>
        ${fhCan("todoMove", x) ? `<button class="btn sm ${st === "done" ? "ghost" : "fh-go"}" data-fhtodomove="${x.id}">${st === "todo" ? "Start" : st === "doing" ? "Done ✓" : "↺"}</button>` : ""}
        ${fhCan("todo") ? `<button class="fh-x" data-fhtododel="${x.id}" aria-label="Delete ${esc(x.title)}">✕</button>` : ""}</div>`).join("") : `<p class="fh-free">nothing here</p>`}</div>`; };
  return `${fhCan("todo") ? `<form class="qa-form fh-form" data-fhtodo="new"><label class="field">Household job<input name="title" placeholder="e.g. Clean out the garage" maxlength="80" required></label>
      <div class="fh-two"><label class="field">Who<select name="who"><option value="">Anyone</option>${fhMembers().map(m => `<option value="${m.id}">${m.face} ${esc(m.name)}</option>`).join("")}</select></label>
        <label class="field">By (optional)<input type="date" name="due"></label></div>
      <label class="fh-check"><input type="checkbox" name="adults" value="1"> 🔒 Adults only</label><button class="btn sm fh-go">Add to the board</button></form>` : ""}
    <div class="fh-board">${col("todo", "To do")}${col("doing", "Doing")}${col("done", "Done")}</div>`;
}

// ------------------------------------------------------------ FAMILY: members, roles, who's using this phone, PIN
function fhFamilyHtml() {
  if (FH_EDIT && FH_EDIT.startsWith("mem:")) return fhMemberForm();
  const F = fh(), me = fhMe();
  return `${fhFamSeg("family")}<div class="fh-members">${F.members.map(m => { const R = FH_ROLES[m.role] || FH_ROLES.child, b = fhBdays().find(x => x.m.id === m.id);
      return `<div class="fh-member" style="--tone:${m.color}"><button class="fh-bigface" data-fhprof="${m.id}" aria-label="${esc(m.name)}'s profile">${m.face}</button><span class="grow"><b>${esc(m.name)}${me && me.id === m.id ? " <small>(using this phone)</small>" : ""}</b>
        <small>${R[0]} ${R[1]}${b ? ` · 🎂 ${esc(prettyDate(b.next))}${b.age ? ` (turns ${b.age})` : ""}` : ""}</small></span>
        ${fhCanEditMem(m) ? `<button class="btn sm ghost" data-fhmemedit="${m.id}">Edit</button>` : ""}</div>`; }).join("")}</div>
    ${fhCan("members") ? `<button class="btn fh-go" data-fhmemnew="1">＋ Add a family member</button>` : ""}
    <div class="mv-sec"><h3>Roles</h3></div><div class="fh-roles">${Object.values(FH_ROLES).map(([i, l, w]) => `<p><b>${i} ${l}</b> - ${esc(w)}</p>`).join("")}</div>
    <div class="fh-btns"><button class="btn sm ghost" data-fhtab="who">🔄 Who's using this phone</button><button class="btn sm ghost" data-fhtab="share">🔗 Share</button></div>
    ${fhCan("pin") ? `<div class="mv-sec"><h3>Parent PIN</h3></div><form class="qa-form fh-form" data-fhpinset="1"><p class="fine">A kid using this phone needs the PIN to switch back to a parent. It's a kid lock for a shared phone or tablet, not a password.</p>
      <div class="fh-two"><label class="field">4 numbers<input name="pin" inputmode="numeric" maxlength="4" placeholder="${F.pin ? "••••" : "e.g. 2468"}" autocomplete="off"></label>
      <div class="fh-btns"><button class="btn sm fh-go">${F.pin ? "Change PIN" : "Set PIN"}</button>${F.pin ? `<button type="button" class="btn sm ghost" data-fhpinoff="1">Remove</button>` : ""}</div></div></form>` : ""}`;
}
function fhMemberForm() {
  const id = FH_EDIT.slice(4), m = id !== "new" && fhMem(id);
  if (id !== "new" && !m) { FH_EDIT = null; return fhFamilyHtml(); }
  const used = fhMembers().map(x => x.color), v = m || { name: "", face: "🧒", color: FH_COLORS.find(c => !used.includes(c)) || FH_COLORS[0], role: "child", bday: "" };
  const roles = m && m.role === "owner" ? ["owner"] : m && m.role === "adult" && !fhCan("role") ? ["adult"] : ["adult", "child", "guest"].filter(r => fhCan("role") || r !== "adult");
  const hideB = !!m && !!fhMe() && m.id !== fhMe().id && m.role !== "child" && !fhSees(m, "bday");
  return `<form class="qa-form fh-form" data-fhmember="${m ? m.id : "new"}">
    <label class="field">First name<input name="name" value="${esc(v.name)}" maxlength="24" placeholder="e.g. Mia" required autocomplete="off"></label>
    <fieldset class="fh-faces"><legend>Face</legend>${FH_FACES.map(f => `<label><input type="radio" name="face" value="${f}"${v.face === f ? " checked" : ""}><span>${f}</span></label>`).join("")}</fieldset>
    <fieldset class="fh-colors"><legend>Color on the calendar</legend>${FH_COLORS.map(c => `<label style="--tone:${c}"><input type="radio" name="color" value="${c}"${v.color === c ? " checked" : ""}><span aria-label="${c}"></span></label>`).join("")}</fieldset>
    <label class="field">Role<select name="role"${roles.length === 1 ? " disabled" : ""}>${roles.map(r => `<option value="${r}"${v.role === r ? " selected" : ""}>${FH_ROLES[r][0]} ${FH_ROLES[r][1]}</option>`).join("")}</select></label>
    ${hideB ? `<p class="fine">🔒 ${esc(m.name)} keeps their birthday private.</p>` : `<label class="field">Birthday (optional)<input type="date" name="bday" value="${esc(v.bday || "")}"></label>`}
    <div class="fh-btns"><button class="btn fh-go">Save</button><button type="button" class="btn sm ghost" data-fhcancel="1">Cancel</button></div>
    ${m && m.role !== "owner" && (m.role !== "adult" || fhCan("role")) && fhMe() && fhMe().id !== m.id ? `<div class="fh-btns fh-danger"><button type="button" class="btn sm ghost" data-fhmemdel="${m.id}">Remove ${esc(m.name)}</button></div>` : ""}
    <p class="fine">Kids are profiles you manage - no email, no login, no location. The birthday stays on this phone.</p></form>`;
}
function fhWhoHtml() {
  const me = fhMe(), F = fh();
  if (FH_PIN_FOR) { const m = fhMem(FH_PIN_FOR);
    return `<form class="qa-form fh-form" data-fhpinchk="${FH_PIN_FOR}"><p>Switching to <b>${m ? m.face + " " + esc(m.name) : "a parent"}</b> needs the parent PIN.</p>
      <label class="field">PIN<input name="pin" inputmode="numeric" maxlength="4" autocomplete="off" autofocus></label>
      <div class="fh-btns"><button class="btn fh-go">Switch</button><button type="button" class="btn sm ghost" data-fhcancel="1">Cancel</button></div></form>`; }
  return `<p>Family Hub shows each person what's right for them. Pick who's using this phone or tablet right now.</p>
    <div class="fh-whogrid">${F.members.map(m => `<button class="fh-whobig${me && me.id === m.id ? " on" : ""}" data-fhuse="${m.id}" style="--tone:${m.color}"><span aria-hidden="true">${m.face}</span><b>${esc(m.name)}</b><small>${FH_ROLES[m.role] ? FH_ROLES[m.role][1] : ""}</small></button>`).join("")}</div>
    <p class="fine">${F.pin ? "🔒 Going from a kid or guest back to a parent asks for the parent PIN." : "Tip: set a parent PIN in Family so kids can't switch to a parent."}</p>`;
}

// ------------------------------------------------------------ EMERGENCY CARD, ALLOWANCES, BIRTHDAYS, SHARE, GRANDPARENT MODE
function fhCardHtml() {
  const C = fh().card;
  if (!fhCan("seeCard")) return `<p class="hos-hint">🔒 The family's emergency card is for family members. A parent can share it with guests.</p>`;
  const view = `<div class="fh-sos"><h3>🆘 ${esc(fh().name || "Our family")}</h3>
      ${C.contacts.length ? C.contacts.map((c, i) => `<div class="fh-contact"><span class="grow"><b>${esc(c.name)}</b><small>${esc(c.rel)}</small></span>${c.phone ? `<a class="btn sm fh-go" href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">📞 ${esc(c.phone)}</a>` : ""}
        ${fhCan("card") ? `<button class="fh-x" data-fhcdel="${i}" aria-label="Remove ${esc(c.name)}">✕</button>` : ""}</div>`).join("") : `<p class="hos-hint">No emergency contacts yet.</p>`}
      ${C.meet ? `<p><b>📍 Meeting place:</b> ${esc(C.meet)}</p>` : ""}${C.plan ? `<p><b>📋 Our plan:</b> ${esc(C.plan)}</p>` : ""}
      ${C.sitter ? `<p><b>🍼 For the sitter:</b> ${esc(C.sitter)}</p>` : ""}${C.doctor ? `<p><b>👩‍⚕️ Family doctor:</b> ${esc(C.doctor)}</p>` : ""}
      <p class="fh-poison"><b>Emergency: 911</b> · Poison Help: <a href="tel:18002221222">1-800-222-1222</a></p></div>`;
  if (!fhCan("card")) return view;
  return view + `<form class="qa-form fh-form" data-fhcontact="1"><div class="mv-sec"><h3>Add a contact</h3></div>
      <div class="fh-two"><label class="field">Name<input name="name" maxlength="40" required></label><label class="field">Who they are<input name="rel" maxlength="30" placeholder="e.g. Grandma, neighbor"></label></div>
      <label class="field">Phone<input name="phone" type="tel" maxlength="30"></label><button class="btn sm fh-go">Add contact</button></form>
    <form class="qa-form fh-form" data-fhcard="1"><div class="mv-sec"><h3>The plan</h3></div>
      <label class="field">Meeting place<input name="meet" value="${esc(C.meet)}" maxlength="120" placeholder="e.g. the big oak at the end of the street"></label>
      <label class="field">What we do<textarea name="plan" maxlength="400" rows="3" placeholder="e.g. Fire: get out, meet at the oak, call 911 from a neighbor's">${esc(C.plan)}</textarea></label>
      <label class="field">Notes for a sitter<textarea name="sitter" maxlength="400" rows="3" placeholder="Bedtimes, the dog, where the flashlight is">${esc(C.sitter)}</textarea></label>
      <label class="field">Family doctor (name + phone)<input name="doctor" value="${esc(C.doctor)}" maxlength="100"></label>
      <label class="fh-check"><input type="checkbox" name="guests" value="1"${C.guests ? " checked" : ""}> Guests (sitters, grandparents) can see this card</label>
      <button class="btn sm fh-go">Save the card</button></form>
    <p class="fine">Keep it to what someone needs in an emergency. Family Hub doesn't keep medical records.</p>`;
}
function fhMoneyHtml() {
  const me = fhMe(), list = fhMembers().filter(m => m.role !== "guest" && fhCan("seeMoney", m.id));
  const rows = list.map(m => ({ m, E: fhEarned(m.id) })).filter(x => x.E.amt || x.E.pts || x.E.paid || fh().chores.some(c => c.who === x.m.id));
  return `${rows.length ? rows.map(({ m, E }) => `<div class="fh-money" style="--tone:${m.color}">${fhDot(m.id)}<span class="grow"><b>${esc(m.name)}</b>
        <small>⭐ ${E.pts} stars · earned ${fhUsd(E.amt)} · paid ${fhUsd(E.paid)}</small></span><strong>${fhUsd(E.owed)}<small>owed</small></strong></div>
      ${fhCan("pay") && E.owed > 0 ? `<form class="fh-additem" data-fhpay="${m.id}"><input name="amt" type="number" min="0.25" step="0.25" value="${E.owed}" inputmode="decimal" aria-label="Amount paid to ${esc(m.name)}"><button class="btn sm fh-go">💵 Paid ${esc(m.name)}</button></form>` : ""}`).join("")
    : `<p class="hos-hint">No allowances yet. Give a chore stars or dollars and they add up here once you OK it.</p>`}
    ${fh().payouts.length && fhAdult() ? `<div class="mv-sec"><h3>Paid out</h3></div>${fh().payouts.slice(-10).reverse().map(p => `<p class="fh-paid">${fhDot(p.who)} ${esc(fhName(p.who))} · ${fhUsd(p.amt)} · ${esc(prettyDate(p.date))}</p>`).join("")}` : ""}
    <p class="fine">Owed = what OK'd chores earned, less what you've paid out. Family Hub never moves money - you pay them yourself${me && !fhAdult() ? "" : " and log it here"}.</p>`;
}
function fhBdayHtml() {
  const B = fhBdays(), no = fhMembers().filter(m => !fhIsD(m.bday));
  return `${B.length ? B.map(b => `<div class="fh-bday" style="--tone:${b.m.color}"><span class="fh-bigface" aria-hidden="true">${b.m.face}</span><span class="grow"><b>${esc(b.m.name)}</b>
      <small>${esc(prettyDate(b.next))}${b.age ? ` · turns ${b.age}` : ""}</small></span><strong>${b.days === 0 ? "🎉 Today!" : b.days === 1 ? "Tomorrow" : `${b.days} days`}</strong></div>`).join("")
    : `<p class="hos-hint">No birthdays yet.</p>`}
    ${no.length && fhCan("members") ? `<p class="fine">Add birthdays in Family: ${no.map(m => `<button class="mv-linkb fh-link" data-fhmemedit="${m.id}">${esc(m.name)}</button>`).join(", ")}.</p>` : ""}
    <p class="fine">Birthdays show on the calendar every year, with a reminder the day before.</p>`;
}
function fhShareHtml() {
  const on = typeof switchOn === "function" && switchOn("FAMILY_SYNC");
  return `<div class="fh-share"><span class="fh-bigface" aria-hidden="true">🔗</span><h3>Everyone's phone, one family</h3>
    <p>${on ? "Sharing is getting ready." : "Coming soon: invite your family with a code. Everyone sees the same calendar, chores and lists on their own phone, and the roles still decide who sees what."}</p></div>
    <ul class="fh-promises"><li>🔒 Sharing is something you turn on - nothing leaves this phone until you do.</li><li>👶 Kids stay profiles you manage. No kid logins, no location.</li>
      <li>🧭 Each person sees only what their role allows.</li><li>🗑️ You can take your family off the shared copy any time.</li></ul>
    <p class="fine">Until then, a family tablet works great: set a parent PIN and switch who's using it.</p>`;
}
function fhBigHtml() {
  const on = !!fh().big;
  return `<div class="fh-share"><span class="fh-bigface" aria-hidden="true">👵</span><h3>Grandparent Mode</h3>
    <p>Bigger text, bigger buttons and the simplest home screen: today's calendar, what needs you, and four big buttons.</p>
    <button class="btn fh-go" data-fhbig="${on ? "0" : "1"}">${on ? "Turn it off" : "Turn it on"}</button></div>
    <p class="fine">It's for this phone only - turn it on for Grandma's tablet and leave yours as it is.</p>`;
}

// ------------------------------------------------------------ taps
function fhClick(ds) {
  if (typeof MODE === "undefined" || MODE !== "family" || !fhSet()) return false;
  const F = fh(), t = today(), me = fhMe();
  if (ds.fhclose) { hideFh(); render(); return true; }
  if (ds.fhtop) { window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  if (ds.fhask) { if (FH_OPEN) hideFh(); showAsk(); return true; }
  if (ds.fhgo === "settings") { if (FH_OPEN) hideFh(); render(); if (typeof openSettings === "function") openSettings(); return true; }
  if (ds.fhcancel) { FH_EDIT = null; FH_PIN_FOR = null; FH_MSG = ""; FH_EVKIND = FH_EVTITLE = FH_EVPET = ""; showFh(); return true; }
  if (ds.fhback) { fhBack(); return true; }
  if (ds.fhnav) { FH_STACK = []; FH_EDIT = null; FH_PIN_FOR = null; FH_MSG = ""; FH_EVKIND = FH_EVTITLE = FH_EVPET = ""; fhEach("reset"); if (ds.fhnav === "lists") FH_LIST = null; showFh(ds.fhnav, true); return true; }
  if (ds.fhseg) { FH_EDIT = null; FH_MSG = ""; showFh(ds.fhseg, true); return true; }
  if (ds.fhcalv) { FH_CALV = ["month", "week", "day"].includes(ds.fhcalv) ? ds.fhcalv : "week"; FH_MONTH = 0; FH_WEEK = 0; FH_DAYV = ""; showFh("cal"); return true; }
  if (ds.fhmonth !== undefined) { FH_MONTH = +ds.fhmonth === 0 ? 0 : FH_MONTH + (+ds.fhmonth || 0); showFh("cal"); return true; }
  if (ds.fhday) { if (!fhIsD(ds.fhday)) return true; FH_CALV = "day"; FH_DAYV = ds.fhday; showFh("cal"); return true; }
  if (ds.fhdayv) { if (!fhIsD(ds.fhdayv)) return true; FH_DAYV = ds.fhdayv; showFh("cal"); return true; }
  if (ds.fhmem) { FH_WHO = ds.fhmem; FH_WEEK = 0; FH_EDIT = null; showFh("cal"); return true; }
  if (ds.fhwho) { FH_WHO = ds.fhwho; showFh("cal"); return true; }
  if (ds.fhweek !== undefined) { FH_WEEK = +ds.fhweek === 0 ? 0 : FH_WEEK + (+ds.fhweek); showFh("cal"); return true; }
  if (ds.fhevnew) { if (!fhCan("event")) return true; FH_EDIT = `ev:new@${fhIsD(ds.fhevnew) ? ds.fhevnew : t}`; FH_MSG = ""; showFh("cal"); return true; }
  if (ds.fhevedit) { if (!fhCan("event")) return true; FH_EDIT = `ev:${ds.fhevedit}`; FH_MSG = ""; showFh("cal"); return true; }
  if (ds.fhevskip) { if (!fhCan("event")) return true; const [id, d] = ds.fhevskip.split("@"), e = F.events.find(x => x.id === id);
    if (e && fhIsD(d)) { e.skip.push(d); e.at = Date.now(); } FH_EDIT = null; save(); render(); showFh("cal"); toast(`Skipped ${prettyDate(d)}`); return true; }
  if (ds.fhevdel) { if (!fhCan("event")) return true; const e = F.events.find(x => x.id === ds.fhevdel); F.events = F.events.filter(x => x.id !== ds.fhevdel);
    FH_EDIT = null; save(); render(); showFh("cal"); if (e) toast(`🗑️ ${e.title} removed`); return true; }
  if (ds.fhchnew) { if (!fhCan("chore")) return true; FH_EDIT = "ch:new"; FH_MSG = ""; showFh("tasks"); return true; }
  if (ds.fhchedit) { if (!fhCan("chore")) return true; FH_EDIT = `ch:${ds.fhchedit}`; showFh("tasks"); return true; }
  if (ds.fhchdel) { if (!fhCan("chore")) return true; F.chores = F.chores.filter(x => x.id !== ds.fhchdel); FH_EDIT = null; save(); render(); showFh("tasks"); toast("🗑️ Chore removed"); return true; }
  if (ds.fhdone) { const [id, k] = ds.fhdone.split("|"), c = F.chores.find(x => x.id === id); if (!c || !fhIsD(k)) return true;
    const l = c.log[k], x = { c, k, l };
    if (!l) { if (!fhCan("done", c) || !fhChoresOn(t).some(x => x.c === c && x.k === k)) return true; c.log[k] = fhAdult() ? { st: "ok", by: me && me.id, at: Date.now(), pts: +c.pts || 0, amt: +c.amt || 0 } : { st: "done", by: me && me.id, at: Date.now() };
      toast(fhAdult() ? `✅ ${c.title} - ${fhName(c.who)}${fhRewards(c) ? " earned " + fhRewards(c) : ""}` : `🙌 Nice! ${c.title} is waiting for a parent's OK`); }
    else if (l.st === "done" && fhAdult()) { c.log[k] = { st: "ok", by: me && me.id, at: Date.now(), pts: +c.pts || 0, amt: +c.amt || 0 }; toast(`✅ OK'd: ${c.title}`); }
    else if (fhCan("undo", x)) { delete c.log[k]; toast(`↩️ ${c.title} back to not done`); }
    else return true;
    save(); render(); if (FH_OPEN) showFh(); return true; }
  if (ds.fhok) { if (!fhCan("approve")) return true; const [id, k] = ds.fhok.split("|"), c = F.chores.find(x => x.id === id);
    if (c && c.log[k] && c.log[k].st === "done") { c.log[k] = { st: "ok", by: me && me.id, at: Date.now(), pts: +c.pts || 0, amt: +c.amt || 0 }; save(); render(); showFh("tasks"); toast(`✅ ${fhName(c.who)}: ${c.title}${fhRewards(c) ? " · " + fhRewards(c) : ""}`); }
    return true; }
  if (ds.fhnot) { if (!fhCan("approve")) return true; const [id, k] = ds.fhnot.split("|"), c = F.chores.find(x => x.id === id);
    if (c && c.log[k]) { delete c.log[k]; save(); render(); showFh("tasks"); toast(`↩️ Sent back to ${fhName(c.who)}`); } return true; }
  if (ds.fhlist !== undefined) { FH_LIST = ds.fhlist || null; showFh("lists"); return true; }
  if (ds.fhitem) { if (!fhCan("listCheck")) return true; const [lid, iid] = ds.fhitem.split("|"), L = F.lists.find(l => l.id === lid), i = L && L.items.find(x => x.id === iid);
    if (i) { i.done = !i.done; i.at = Date.now(); save(); render(); showFh("lists"); } return true; }
  if (ds.fhitemdel) { const [lid, iid] = ds.fhitemdel.split("|"), L = F.lists.find(l => l.id === lid), i = L && L.items.find(x => x.id === iid);
    if (i && (fhCan("listEdit") || (me && i.by === me.id))) { L.items = L.items.filter(x => x.id !== iid); save(); render(); showFh("lists"); } return true; }
  if (ds.fhclear) { if (!fhCan("listEdit")) return true; const L = F.lists.find(l => l.id === ds.fhclear); if (L) { L.items = L.items.filter(x => !x.done); save(); render(); showFh("lists"); toast("🧹 Cleared"); } return true; }
  if (ds.fhlistdel) { if (!fhCan("listEdit")) return true; const L = F.lists.find(l => l.id === ds.fhlistdel); F.lists = F.lists.filter(l => l.id !== ds.fhlistdel); FH_LIST = null;
    save(); render(); showFh("lists"); if (L) toast(`🗑️ ${L.name} deleted`); return true; }
  if (ds.fhtodonew) { showFh("todo"); const i = document.querySelector('#fhSheet form[data-fhtodo] input[name="title"]'); if (i) i.focus(); return true; }
  if (ds.fhtodomove) { const x = F.todos.find(y => y.id === ds.fhtodomove); if (!x || !fhCan("todoMove", x)) return true;
    x.st = x.st === "todo" ? "doing" : x.st === "doing" ? "done" : "todo"; x.at = Date.now(); save(); render(); showFh("todo"); if (x.st === "done") toast(`🎉 Done: ${x.title}`); return true; }
  if (ds.fhtododel) { if (!fhCan("todo")) return true; F.todos = F.todos.filter(y => y.id !== ds.fhtododel); save(); render(); showFh("todo"); return true; }
  if (ds.fhmemnew) { if (!fhCan("members")) return true; FH_EDIT = "mem:new"; FH_MSG = ""; showFh("family"); return true; }
  if (ds.fhmemedit) { if (!fhCanEditMem(fhMem(ds.fhmemedit))) return true; FH_EDIT = `mem:${ds.fhmemedit}`; FH_MSG = ""; showFh("family"); return true; }
  if (ds.fhmemdel) { const m = fhMem(ds.fhmemdel); if (!m || !fhCan("members") || m.role === "owner" || (m.role === "adult" && !fhCan("role")) || (me && me.id === m.id)) return true;
    F.members = F.members.filter(x => x.id !== m.id); F.events.forEach(e => { e.who = e.who.filter(w => w !== m.id); });
    F.chores = F.chores.filter(c => c.who !== m.id); F.todos.forEach(x => { if (x.who === m.id) x.who = ""; });
    delete F.share[m.id]; Object.values(F.share).forEach(x => { if (x && typeof x === "object") Object.values(x).forEach(a => { if (a && Array.isArray(a.ids)) a.ids = a.ids.filter(i => i !== m.id); }); });
    F.payouts = F.payouts.filter(p => p.who !== m.id);
    fhEach("forget", m.id, m);
    FH_EDIT = null; save(); render(); showFh("family"); toast(`${m.name} removed from Family Hub`); return true; }
  if (ds.fhuse) { const m = fhMem(ds.fhuse); if (!m) return true;
    const up = !fhAdult() && (!me || m.id !== me.id) && (["owner", "adult"].includes(m.role) || fhRole() === "guest");
    if (up && F.pin) { FH_PIN_FOR = m.id; showFh("who"); return true; }
    F.me = m.id; save(); render(); showFh("who"); toast(`Hi, ${m.name}! ${m.face}`); return true; }
  if (ds.fhpinoff) { if (!fhCan("pin")) return true; F.pin = ""; save(); showFh("family"); toast("PIN removed"); return true; }
  if (ds.fhcdel !== undefined) { if (!fhCan("card")) return true; F.card.contacts.splice(+ds.fhcdel, 1); save(); showFh("card"); return true; }
  if (ds.fhbig !== undefined) { F.big = ds.fhbig === "1"; save(); hideFh(); render(); toast(F.big ? "👵 Grandparent Mode on" : "Grandparent Mode off"); return true; }
  if (ds.fhtab) { if (!fhTabInfo(ds.fhtab)) return true; FH_MSG = ""; if (ds.fhtab !== FH_TAB) { FH_EDIT = null; FH_PIN_FOR = null; FH_EVKIND = FH_EVTITLE = FH_EVPET = ""; }
    if (ds.fhtab === "lists" && !F.lists.some(l => l.id === FH_LIST)) FH_LIST = null; showFh(ds.fhtab); return true; }
  return fhAny("click", ds);
}

// ------------------------------------------------------------ forms
function fhSubmit(f, data) {
  if (typeof MODE === "undefined" || MODE !== "family") return false;
  const F = fh(), t = today(), D = f.dataset, me = fhMe(), bad = m => { FH_MSG = m; fhMsgShow(); return true; };
  const face = v => FH_FACES.includes(v) ? v : "🙂", color = v => FH_COLORS.includes(v) ? v : FH_COLORS[0];
  if (!D.fhsetup && !fhSet()) return false;
  if (D.fhsetup) { if (fhSet()) return true; const name = fhTxt(data.name, 24), fam = fhTxt(data.fam, 40); if (!name || !fam) return true;
    const id = uid(); F.members = [{ id, name, face: face(data.face), color: FH_COLORS[0], role: "owner", bday: "" }]; F.me = id; F.name = fam; S.name = name;
    F.lists = [["Grocery", "🛒"], ["Household", "🧻"], ["School", "🎒"]].map(([n, i]) => ({ id: uid(), name: n, icon: i, items: [] }));
    F.setup = t; save(); render(); toast(`💛 Welcome, ${name}! Now add your family.`); return true; }
  if (D.fhevent) { if (!fhCan("event")) return true;
    const title = fhTxt(data.title, 80); if (!title) return bad("What is it? Give it a name.");
    if (!fhIsD(data.date)) return bad("Pick the day.");
    const rep = FH_REPEAT.some(r => r[0] === data.rep) ? data.rep : "none", until = fhIsD(data.until) && data.until >= data.date && rep !== "none" ? data.until : "";
    const vals = { title, date: data.date, time: fhIsT(data.time) ? data.time : "", kind: fhKind(data.kind)[0], rep, until, where: fhTxt(data.where, 80), note: fhTxt(data.note, 200),
      vis: data.adults ? "adults" : "", who: fhMembers().filter(m => data["w_" + m.id]).map(m => m.id), at: Date.now(), by: me && me.id,
      rem: FH_REM.filter(r => data["r_" + r[0]]).map(r => r[0]), pet: Array.isArray(F.pets) && F.pets.some(x => x.id === data.pet) ? data.pet : "" };
    const e = D.fhevent !== "new" && F.events.find(x => x.id === D.fhevent);
    if (e) Object.assign(e, vals); else F.events.push({ id: uid(), skip: [], ...vals });
    FH_EDIT = null; FH_MSG = ""; FH_EVKIND = FH_EVTITLE = FH_EVPET = ""; save(); render(); showFh("cal"); toast(`📅 ${title} · ${fhRel(vals.date)}${vals.time ? " " + hm(vals.time) : ""}${rep !== "none" ? " 🔁" : ""}`); return true; }
  if (D.fhchore) { if (!fhCan("chore")) return true;
    const title = fhTxt(data.title, 60); if (!title) return bad("Name the chore.");
    const who = fhMem(data.who); if (!who || who.role === "guest") return bad("Pick who does it.");
    const every = FH_EVERY.some(x => x[0] === data.every) ? data.every : "once";
    if (every === "once" && !fhIsD(data.date)) return bad("Pick the day it's due.");
    const vals = { title, who: who.id, every, date: every === "once" ? data.date : "", day: Math.min(6, Math.max(0, Math.round(fhNum(data.day)))),
      pts: Math.min(100, Math.max(0, Math.round(fhNum(data.pts)))), amt: Math.min(100, Math.max(0, Math.round(fhNum(data.amt) * 100) / 100)), at: Date.now() };
    const c = D.fhchore !== "new" && F.chores.find(x => x.id === D.fhchore);
    if (c) Object.assign(c, vals); else F.chores.push({ id: uid(), from: t, log: {}, ...vals });
    FH_EDIT = null; FH_MSG = ""; save(); render(); showFh("tasks"); toast(`🧹 ${title} - ${who.name}`); return true; }
  if (D.fhitemadd) { if (!fhCan("listAdd")) return true; const L = F.lists.find(l => l.id === D.fhitemadd), text = fhTxt(data.text, 60); if (!L || !text) return true;
    L.items.push({ id: uid(), text, by: me && me.id, done: false, at: Date.now() }); save(); render(); showFh("lists");
    const i = document.querySelector(`#fhSheet form[data-fhitemadd="${L.id}"] input`); if (i) i.focus(); return true; }
  if (D.fhlistnew) { if (!fhCan("listEdit")) return true; const name = fhTxt(data.name, 30); if (!name) return true;
    const L = { id: uid(), name, icon: FH_LIST_ICONS.includes(data.icon) ? data.icon : "🛒", items: [] }; F.lists.push(L); FH_LIST = L.id; save(); render(); showFh("lists"); return true; }
  if (D.fhtodo) { if (!fhCan("todo")) return true; const title = fhTxt(data.title, 80); if (!title) return true;
    F.todos.push({ id: uid(), title, who: fhMem(data.who) ? data.who : "", due: fhIsD(data.due) ? data.due : "", st: "todo", vis: data.adults ? "adults" : "", by: me && me.id, at: Date.now() });
    save(); render(); showFh("todo"); toast(`📌 ${title} on the board`); return true; }
  if (D.fhmember) { if (!fhCan("members")) return true;
    const name = fhTxt(data.name, 24); if (!name) return bad("Type their first name.");
    const m = D.fhmember !== "new" && fhMem(D.fhmember);
    if (m && !fhCanEditMem(m)) return true;
    const allowed = m && m.role === "owner" ? ["owner"] : m && m.role === "adult" && !fhCan("role") ? ["adult"] : ["adult", "child", "guest"].filter(r => fhCan("role") || r !== "adult");
    const hideB = !!m && !!me && m.id !== me.id && m.role !== "child" && !fhSees(m, "bday");
    const role = m && m.role === "owner" ? "owner" : allowed.includes(data.role) ? data.role : m ? m.role : "child";
    const vals = { name, face: face(data.face), color: color(data.color), role, bday: hideB ? m.bday : fhIsD(data.bday) && data.bday <= t ? data.bday : "" };
    if (m) Object.assign(m, vals); else F.members.push({ id: uid(), ...vals });
    if (m && me && m.id === me.id) S.name = name;
    FH_EDIT = null; FH_MSG = ""; save(); render(); showFh("family"); toast(`${vals.face} ${name} ${m ? "saved" : "joined the family"}`); return true; }
  if (D.fhpinset) { if (!fhCan("pin")) return true; const p = String(data.pin || "").trim(); if (!/^\d{4}$/.test(p)) return bad("The PIN is 4 numbers.");
    F.pin = p; FH_MSG = ""; save(); showFh("family"); toast("🔒 Parent PIN set"); return true; }
  if (D.fhpinchk) { const m = fhMem(D.fhpinchk); if (!m) return true;
    if (String(data.pin || "").trim() !== F.pin) return bad("That's not the PIN.");
    F.me = m.id; FH_PIN_FOR = null; FH_MSG = ""; save(); render(); showFh("who"); toast(`Hi, ${m.name}! ${m.face}`); return true; }
  if (D.fhcontact) { if (!fhCan("card")) return true; const name = fhTxt(data.name, 40); if (!name) return true;
    F.card.contacts.push({ name, rel: fhTxt(data.rel, 30), phone: fhTxt(data.phone, 30) }); save(); showFh("card"); toast(`🆘 ${name} added`); return true; }
  if (D.fhcard) { if (!fhCan("card")) return true;
    Object.assign(F.card, { meet: fhTxt(data.meet, 120), plan: fhTxt(data.plan, 400), sitter: fhTxt(data.sitter, 400), doctor: fhTxt(data.doctor, 100), guests: !!data.guests });
    save(); showFh("card"); toast("🆘 Emergency card saved"); return true; }
  if (D.fhpay) { if (!fhCan("pay")) return true; const m = fhMem(D.fhpay), amt = Math.round(fhNum(data.amt) * 100) / 100; if (!m) return true;
    if (!(amt > 0 && amt <= 1000)) return bad("Type how much you paid.");
    F.payouts.push({ id: uid(), who: m.id, amt, date: t, by: me && me.id }); FH_MSG = ""; save(); render(); showFh("money"); toast(`💵 ${fhUsd(amt)} to ${m.name} logged`); return true; }
  return fhAny("submit", f, data);
}

// ------------------------------------------------------------ reminders, Life pulse, what the AI reads
// Reminders (⚙ → Reminders on): timed events before they start, all-day ones in the morning, chores still open at 5 PM,
// birthdays the day before and the morning of.
function fhReminders(add, inWin) {
  if (!fhSet()) return;
  const R = S.remind || {}, t = today();
  [t, addDays(t, 1)].forEach(d => { if (!inWin(d)) return; fhDay(d).forEach(x => {
    if (x.bday) { add(`fhbd:${x.bday.id}:${d}`, atMs(d, "23:59"), atMs(d, "08:00"), `🎂 ${x.bday.name}'s birthday today`, "Family Hub"); return; }
    const e = x.e, who = e.who.map(fhName).join(", ");
    if (Array.isArray(e.rem) && !e.rem.includes("same")) return;                // v2: the event's own reminder choices
    if (x.time) { const st = atMs(d, x.time); add(`fhev:${e.id}:${d}`, st, st - Math.max(15, +R.lead || 0) * 60000, `${fhKind(e.kind)[1]} ${e.title} at ${hm(x.time)}`, [who, e.where].filter(Boolean).join(" · ") || "Family Hub"); }
    else add(`fhev:${e.id}:${d}`, atMs(d, "23:59"), atMs(d, "07:30"), `${fhKind(e.kind)[1]} Today: ${e.title}`, who || "Family Hub"); }); });
  if (inWin(t)) { const open = fhChoresOn(t).filter(x => x.st === "open");
    if (open.length) add(`fhch:${t}`, atMs(t, "21:00"), atMs(t, "17:00"), `🧹 ${open.length} chore${open.length === 1 ? "" : "s"} still open`, open.slice(0, 4).map(x => `${fhName(x.c.who)}: ${x.c.title}`).join(" · "));
    fhBdays().filter(b => b.days === 1).forEach(b => add(`fhbd1:${b.m.id}:${b.next}`, atMs(t, "23:59"), atMs(t, R.billHour || "09:00"), `🎂 Tomorrow: ${b.m.name}'s birthday`, b.age ? `Turns ${b.age}` : "Family Hub"));
    fhBdays().filter(b => b.days === 7).forEach(b => add(`fhbd7:${b.m.id}:${b.next}`, atMs(t, "23:59"), atMs(t, R.billHour || "09:00"), `🎂 ${b.m.name}'s birthday is a week away`, `${FH_WD[parseDay(b.next).getDay()]}, ${prettyDate(b.next)}`)); }
  // Important dates (v2): "1 week before" and "1 day before", in the morning, for the events that ask for them.
  [t, addDays(t, 1)].forEach(d => { if (!inWin(d)) return; [["week", 7, "in a week"], ["day", 1, "tomorrow"]].forEach(([k, n, when]) => { const on = addDays(d, n);
    fhDay(on).filter(x => x.e && Array.isArray(x.e.rem) && x.e.rem.includes(k)).forEach(x => add(`fhr${k}:${x.e.id}:${on}`, atMs(d, "23:59"), atMs(d, R.billHour || "09:00"),
      `${fhKind(x.e.kind)[1]} ${x.e.title} ${when}`, `${FH_WD[parseDay(on).getDay()]}, ${prettyDate(on)}${x.time ? " at " + hm(x.time) : ""}`)); }); });
  fhEach("reminders", add, inWin);
}
function fhPulse(add) {
  if (typeof MODE === "undefined" || MODE !== "family" || !fhSet()) return;
  const t = today(), w = fhWaiting().length, now = nowT();
  if (w && fhAdult()) add(9, "🙋", `${w} chore${w === 1 ? "" : "s"} waiting for your OK`, null);
  fhDay(t).filter(x => x.e && x.time && x.time >= now).slice(0, 3).forEach(x => add(8, fhKind(x.e.kind)[1], `${x.e.title} at ${hm(x.time)}`, null));
  fhBdays().filter(b => b.days === 0).forEach(b => add(10, "🎂", `${b.m.name}'s birthday today`, null));
  fhEach("pulse", add);
}
// What Ask Family Hub reads: first names, the calendar this person may see, chores, lists, the board. Never the PIN or the emergency card.
function fhContext() {
  if (!fhSet()) return {};
  const t = today(), F = fh();
  return { about: "This is the family's own Family Hub, typed in on this phone. First names only. Answer only from it; say plainly when something isn't on it.",
    family: F.name, usingThisPhone: (fhMe() || {}).name, members: F.members.map(m => ({ name: m.name, role: m.role, birthday: fhIsD(m.bday) && fhSees(m, "bday") ? m.bday.slice(5) : undefined })),
    next14Days: [...Array(14)].map((_, i) => addDays(t, i)).map(d => ({ day: d, events: fhDay(d).map(x => x.bday ? { what: `${x.bday.name}'s birthday` }
      : { what: x.e.title, time: x.time || "all day", who: x.e.who.length ? x.e.who.map(fhName) : "whole family", where: x.e.where || undefined }) })).filter(x => x.events.length),
    choresToday: fhChoresOn(t).map(x => ({ chore: x.c.title, who: fhName(x.c.who), status: x.st })),
    choresWaitingForParentOK: fhWaiting().length,
    lists: F.lists.map(l => ({ list: l.name, toGet: l.items.filter(i => !i.done).map(i => i.text).slice(0, 40) })),
    todoBoard: F.todos.filter(x => x.st !== "done" && fhCan("see", x)).map(x => ({ job: x.title, who: x.who ? fhName(x.who) : "anyone", by: x.due || undefined, status: x.st })),
    ...Object.assign({}, ...fhEach("context").filter(x => x && typeof x === "object")) };
}
