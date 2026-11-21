/* SAVE AS: basics.js · LOCATION: C:/MarvelApps/dayhub/basics.js
 * HUB BASICS (Scott 11/20: "do all apps have basic items like calendars calculators schedules notes a way to forward app to other
 * media" -> the audit -> "Yes, all of them"). The same basics in all 12 Hubs (Day, Cruise, Trip, Home, Auto, Money, Health, Family,
 * Pet, Cooking, Job Hub, Hub Universe), in both looks:
 *   - CALCULATOR: a plain phone-style calculator (+ - x /, %, clear, backspace, decimal). Each Hub's own calculators stay as they are.
 *   - CALENDAR: a month of THIS Hub's own dated items (bxItems), tap a day for that day's list. Family Hub keeps its own calendar
 *     (this opens it). Hub Universe shows the dates of the Hubs it already reads (uniPeek) - it never makes anything up.
 *   - NOTES: each Hub's own notes - S.notes in that Hub's own storage, so Hubs never mix (Day Hub's Notes card is the same list).
 *   - SHARE ONE ENTRY (Home: a task or an item; Money: a bill or a subscription; Pet: a shot, a vet visit, a medicine): the phone's
 *     share menu, or copied when the phone has none. Plain text of that one entry.
 *   - GOOGLE CALENDAR: bxGcal adds each Hub's own dated items to what app.js gcalWanted sends. The Pro gate in app.js is untouched;
 *     trips stay behind the TRAVEL_CAL switch (trip.js gcalTrips).
 *   - BRAIN DUMP in Health Hub and Hub Universe: it sorts into that Hub's own Notes and reminders (shown on its Calendar), never into
 *     Day Hub lists those Hubs don't show.
 * Reached from Settings -> Tools (every Hub, both looks) and each Hub's More page. Its look is injected here once (like tour.js).
 * Loaded right before ui.js by every Hub's index.html (and kept by every sw.js). Every top-level name is bx / BX.
 */
"use strict";
// [accent colour, what lands on its calendar, a hint for an empty notes list]
const BX_HUB = {
  dayhub: ["#f59e0b", "Plans, bills, birthdays, shifts and trips", "Ideas, gate codes, what the doctor said - keep it here."],
  cruisehub: ["#06b6d4", "Sail days, port days, final payments and bookings", "Cabin numbers, dining times, where to meet."],
  triphub: ["#a855f7", "Trip days, flights, stays and final payments", "Confirmation numbers, addresses, places to try."],
  homehub: ["#14b8a6", "Room tasks, upkeep and bills", "Paint colors, filter sizes, who to call."],
  autohub: ["#ef4444", "Service due, papers to renew and bills", "Tire sizes, the shop's number, what the mechanic said."],
  moneyhub: ["#22c55e", "Bills, paydays and renewals", "What to ask the bank, money ideas, account reminders."],
  hubuniverse: ["#6366f1", "The dates from your other Hub apps on this phone", "Anything at all."],
  healthhub: ["#2dd4bf", "Appointments, refills and reminders", "Questions for the doctor, how you felt, what changed."],
  familyhub: ["#2e86de", "Your family's events, chores and birthdays", "Gift ideas, school codes, the sitter's number."],
  pethub: ["#f97316", "Birthdays, Gotcha Days, shots, vet visits and last doses", "The vet's number, food brand, sitter instructions."],
  cookinghub: ["#d9442e", "Planned dinners and use-by dates", "Recipe ideas, what everyone liked, shopping thoughts."],
  jobhub: ["#e2b04a", "Interviews and follow-ups", "Questions to ask, people you met, what they said."],
};
const BX_TOOLS = [["cal", "📅", "Calendar"], ["notes", "📝", "Notes"], ["calc", "🧮", "Calculator"]];
const BX = { tool: "cal", month: 0, day: "", edit: "", arm: "", hist: 0, skip: 0, back: null, calc: { cur: "0", acc: null, op: null, fresh: true, line: "" } };
const bxHub = () => BX_HUB[typeof APP_ID !== "undefined" ? APP_ID : "dayhub"] || BX_HUB.dayhub;
// The new looks draw their own line icons; the Tools rows on their More pages needed a calculator and a note (24 x 24, stroked).
const BX_PATH = { calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 11h1M11.5 11h1M14.5 11h1M8.5 14.5h1M11.5 14.5h1M14.5 14.5h1M8.5 18h1M11.5 18h4"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>' };
["calc", "note"].forEach(k => {
  if (typeof WI !== "undefined" && !WI[k]) WI[k] = BX_PATH[k];                                   // Health Hub (raw paths)
  if (typeof MI !== "undefined" && !MI[k]) MI[k] = BX_PATH[k];                                   // Money Hub (raw paths)
  if (typeof JH_I !== "undefined" && !JH_I[k]) JH_I[k] = BX_PATH[k];                             // Job Hub (raw paths)
  if (typeof HI !== "undefined" && typeof HT_SVG === "function" && !HI[k]) HI[k] = HT_SVG(BX_PATH[k]);   // Home Hub (whole icons)
  if (typeof AI !== "undefined" && typeof AT_SVG === "function" && !AI[k]) AI[k] = AT_SVG(BX_PATH[k]);   // Auto Hub (whole icons)
});
const bxIsD = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const bxIsT = v => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
const bxTxt = (v, n = 120) => String(v == null ? "" : v).trim().slice(0, n);

// ------------------------------------------------------------ THE DATES: each Hub's own, from its own data
// The Day-type items every Hub keeps in S (events, birthdays, shifts, upkeep, countdowns, packages, paydays, its OWN trips) come from
// app.js dayItems, minus the weather, alarms and the other Hub's trips (S.family off for the moment). Google's own events only in Day Hub.
// Bills are every month here (dayItems shows only the next one).
const BX_SKIP = ["sun", "rain", "alarm"];
function bxDayType(hub, from, to, add) {
  if (typeof dayItems !== "function" || !S) return;
  const keep = S.family; S.family = false;
  try {
    for (let d = from; d <= to; d = addDays(d, 1))
      dayItems(d).forEach(i => {
        if (BX_SKIP.includes(i.kind) || (i.kind === "g" && hub !== "day") || String(i.cal || "").startsWith("bill:")) return;
        add(d, i.title, i.icon || "📅", i.kind, { time: bxIsT(i.t) ? i.t : "", sub: i.sub || "", del: i.kind === "event" ? i.del || "" : "" });
      });
  } finally { S.family = keep; }
  (S.bills || []).forEach(b => {
    if (!b || !b.name || !(Number(b.day) >= 1)) return;
    for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = ymd(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)).slice(0, 7)) {
      const dim = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(), d = `${m}-${pad(Math.min(Number(b.day), dim))}`;
      add(d, `${b.name} due`, "💳", "bill", { sub: [Number(b.amount) ? money(b.amount) : "", b.paid && b.paid >= m ? "paid" : ""].filter(Boolean).join(" · ") });
    }
  });
}
// Each Hub's own data. Read only - nothing here writes.
const BX_OWN = {
  health(from, to, add) {
    if (!S.hh || typeof hh !== "function") return;
    const H = hh();
    H.appts.forEach(a => add(a.date, a.reason || a.specialty || "Appointment", "🩺", "appt", { time: bxIsT(a.time) ? a.time : "", sub: [a.doctor, a.where].filter(Boolean).join(" · ") }));
    if (typeof hhRefill === "function") H.meds.filter(m => !m.off).forEach(m => { const r = hhRefill(m); if (r.by) add(r.by, `Refill ${m.name || "medicine"}`, "💊", "refill", { sub: `about ${r.days} day${r.days === 1 ? "" : "s"} of doses left` }); });
  },
  pet(from, to, add) {
    if (!S.pt || typeof pt !== "function") return;
    const P = pt(), pet = id => P.pets.find(p => p.id === id && !p.passed);
    P.pets.filter(p => !p.passed).forEach(p => {
      [[p.est ? "" : p.bday, `${p.name}'s birthday`, "🎂"], [p.gotcha, `${p.name}'s Gotcha Day`, "🏡"]].forEach(([d, title, ic]) => {
        if (!bxIsD(d)) return;
        for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) { const on = bxMd(y, d.slice(5)); if (on > d) add(on, title, ic, "pbday"); }
      });
    });
    P.shots.forEach(s => { const p = pet(s.pet); if (p && bxIsD(s.due)) add(s.due, `${p.name}: ${s.name || "shot"} due`, "💉", "shot"); });
    P.visits.forEach(v => { const p = pet(v.pet); if (p) add(v.date, `${p.name}: vet visit`, "🩺", "visit", { time: bxIsT(v.time) ? v.time : "", sub: [v.reason, v.vet].filter(Boolean).join(" · ") }); });
    P.meds.filter(m => !m.off).forEach(m => { const p = pet(m.pet); if (p && bxIsD(m.end)) add(m.end, `${p.name}: last day of ${m.name || "medicine"}`, "💊", "med"); });
  },
  job(from, to, add) {
    const J = S.jh && S.jh.jobs && typeof S.jh.jobs === "object" ? S.jh.jobs : {};
    Object.values(J).forEach(x => {
      if (!x || typeof x !== "object" || !x.t) return;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(x.iv || ""))) add(x.iv.slice(0, 10), `Interview: ${x.t}`, "👥", "iv", { time: x.iv.slice(11, 16), sub: x.co || "" });
      if (bxIsD(x.fu) && !x.fuDone && x.st !== "closed") add(x.fu, `Follow up: ${x.t}`, "📨", "fu", { sub: x.fuNote || x.co || "" });
    });
  },
  auto(from, to, add) {
    if (!S.garage || typeof garage !== "function") return;
    garage().cars.forEach(c => {
      const name = typeof carName === "function" ? carName(c) : "My car";
      if (typeof carDue === "function") carDue(c, today()).forEach(d => { const s = (typeof AUTO_SERVICES !== "undefined" ? AUTO_SERVICES : []).find(x => x[0] === d.key);
        if (s && d.dueDate) add(d.dueDate, `${s[2]} due`, s[1] || "🔧", "service", { sub: name }); });
      c.papers.forEach(x => { const k = typeof paper === "function" ? paper(x.kind) : [x.kind, "📄", "Papers"];
        if (bxIsD(x.expires)) add(x.expires, `${x.name || k[2]} renews`, k[1] || "📄", "paper", { sub: name }); });
    });
  },
  home(from, to, add) {
    if (!S.house || typeof house !== "function") return;
    house().spaces.forEach(sp => sp.tasks.filter(t => !t.done && bxIsD(t.due)).forEach(t => add(t.due, t.title, "🧰", "task", { sub: sp.name || "" })));
  },
  money(from, to, add) {
    const subs = S.mh && Array.isArray(S.mh.subs) ? S.mh.subs : [];
    subs.filter(s => s && !s.off && s.name && bxIsD(s.next)).forEach(s => {
      let d = s.next, n = 0;
      while (d <= to && n++ < 400) { add(d, `${s.name} renews`, "🔁", "sub", { sub: Number(s.amt) ? money(s.amt) : "" }); d = bxStep(d, s.every); }
    });
  },
  cooking(from, to, add) {
    if (!S.ck || typeof ck !== "function") return;
    const C = ck();
    Object.keys(C.week).forEach(d => { const w = C.week[d], r = w && typeof ckRec === "function" ? ckRec(w.r) : null; if (r) add(d, `Dinner: ${r.t}`, "🍽️", "meal", { sub: w.done ? "cooked" : "" }); });
    C.pantry.forEach(p => { if (bxIsD(p.exp)) add(p.exp, `${p.name} - use by`, "🥫", "pantry"); });
  },
  family(from, to, add) {
    if (!S.fh || typeof fhDay !== "function") return;
    for (let d = from; d <= to; d = addDays(d, 1))
      fhDay(d, "all").forEach(x => x.bday ? add(d, `${x.bday.name}'s birthday`, "🎂", "fbday")
        : add(d, x.e.title, (typeof fhKind === "function" ? fhKind(x.e.kind)[1] : "") || "📅", "fevent", { time: bxIsT(x.e.time) ? x.e.time : "", sub: x.e.where || "" }));
    fh().chores.forEach(c => { if (c.every !== "daily" && c.every !== "weekly" && bxIsD(c.date) && !(c.log[c.date] && c.log[c.date].st)) add(c.date, `Chore: ${c.title}`, "🧹", "chore", { sub: typeof fhName === "function" ? fhName(c.who) : "" }); });
  },
};
// A Feb 29 date is kept on Feb 28 in the other years.
const bxMd = (y, md) => md === "02-29" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? `${y}-02-28` : `${y}-${md}`;
function bxStep(d, every) {
  const x = parseDay(d);
  if (every === "week") x.setDate(x.getDate() + 7);
  else { const day = Number(d.slice(8)), add = every === "year" ? 12 : 1, m = x.getMonth() + add, y = x.getFullYear();
    return ymd(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()))); }
  return ymd(x);
}
// Every dated item of one Hub between two days, sorted (all-day first, then by time). The data is whoever S is right now.
function bxCollect(hub, from, to) {
  const out = [], seen = new Set();
  const add = (date, title, icon, kind, x = {}) => {
    if (!bxIsD(date) || date < from || date > to || !title) return;
    const it = { date, title: bxTxt(title, 140), icon: icon || "📅", kind: kind || "", time: x.time || "", sub: bxTxt(x.sub, 140), del: x.del || "" };
    const k = `${date}|${it.time}|${it.title}|${it.sub}`; if (seen.has(k)) return; seen.add(k); out.push(it);
  };
  try { bxDayType(hub, from, to, add); } catch (e) { /* one odd entry never blanks the calendar */ }
  if (BX_OWN[hub]) try { BX_OWN[hub](from, to, add); } catch (e) { /* the same */ }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ? 1 : 0) - (b.time ? 1 : 0) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}
// This Hub's calendar. Hub Universe: its own reminders + every Hub it already reads (UNI_HUBS, through uniPeek - read only).
function bxItems(from, to) {
  if (MODE !== "universe") return bxCollect(MODE, from, to);
  const all = bxCollect("universe", from, to);
  if (typeof UNI_HUBS !== "undefined" && typeof uniPeek === "function")
    UNI_HUBS.forEach(h => (uniPeek(h[1], () => bxCollect(h[0], from, to)) || []).forEach(i => all.push({ ...i, del: "", sub: [i.sub, h[2]].filter(Boolean).join(" · ") })));
  return all.sort((a, b) => a.date.localeCompare(b.date) || (a.time ? 1 : 0) - (b.time ? 1 : 0) || a.time.localeCompare(b.time));
}

// ------------------------------------------------------------ THE SHEET (one sheet, three tools)
function bxCss() {
  if (document.getElementById("bxCss")) return;
  const st = document.createElement("style"); st.id = "bxCss";
  st.textContent = `
#bxSheet { position: fixed; inset: 0; z-index: 9400; display: flex; align-items: flex-end; justify-content: center; background: rgba(8, 10, 24, .55);
  font-family: Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1d1b2e; }
#bxSheet.hidden { display: none; }
body.bx-on { overflow: hidden; }
body.bx-on .toast { z-index: 9450; }                                    /* "Note saved" shows over the sheet */
.bx-card { position: relative; width: 100%; max-width: 520px; height: 88vh; height: 88dvh; max-height: 680px; box-sizing: border-box; display: flex; flex-direction: column;
  background: #fff; border-radius: 22px 22px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, .35); border-top: 4px solid var(--bxa); }
@media (min-width: 600px) { #bxSheet { align-items: center; } .bx-card { border-radius: 22px; } }
.bx-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 8px; }
.bx-head h2 { flex: 1; min-width: 0; margin: 0; font-size: 20px; font-weight: 800; color: #1d1b2e; }
.bx-x { flex: none; width: 40px; height: 40px; border: 0; border-radius: 50%; background: #f1f0f6; color: #1d1b2e; font-size: 18px; cursor: pointer; }
.bx-seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 0 16px 10px; }
.bx-seg button { min-width: 0; min-height: 40px; padding: 6px 4px; border: 1.5px solid #e2e0ea; border-radius: 12px; background: #fff; color: #3b3850; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bx-seg button.on { background: var(--bxa); border-color: var(--bxa); color: #fff; }
@media (max-width: 374px) { .bx-segic { display: none; } }
.bx-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 16px calc(18px + env(safe-area-inset-bottom, 0px)); }
.bx-body p { margin: 8px 0; }
.bx-empty { color: #5d5a70; font-size: 15px; line-height: 1.4; }
.bx-fine { color: #6c6981; font-size: 13px; }
.bx-btn { min-height: 40px; padding: 8px 16px; border: 0; border-radius: 12px; background: var(--bxa); color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
.bx-ghost { min-height: 40px; padding: 8px 14px; border: 1.5px solid #dcd9e6; border-radius: 12px; background: #fff; color: #3b3850; font: inherit; font-weight: 700; cursor: pointer; }
/* calendar */
.bx-mnav { display: flex; align-items: center; gap: 8px; margin: 2px 0 8px; }
.bx-mnav b { flex: 1; text-align: center; font-size: 17px; }
.bx-mnav button { min-width: 40px; min-height: 40px; border: 1.5px solid #e2e0ea; border-radius: 12px; background: #fff; color: #1d1b2e; font: inherit; font-size: 18px; font-weight: 800; cursor: pointer; }
.bx-mnav .bx-today { font-size: 14px; padding: 0 10px; }
.bx-wd, .bx-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.bx-wd span { text-align: center; font-size: 12px; font-weight: 800; color: #8a8799; padding-bottom: 2px; }
.bx-grid > span { min-height: 44px; }
.bx-grid button { position: relative; min-width: 0; min-height: 44px; padding: 4px 0 10px; border: 1.5px solid #ecebf2; border-radius: 10px; background: #faf9fd; color: #1d1b2e; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
.bx-grid button.now { border-color: var(--bxa); color: var(--bxa); }
.bx-grid button.on { background: var(--bxa); border-color: var(--bxa); color: #fff; }
.bx-dots { position: absolute; left: 0; right: 0; bottom: 4px; display: flex; justify-content: center; gap: 3px; }
.bx-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--bxa); }
.bx-grid button.on .bx-dots i { background: #fff; }
.bx-dayh { margin: 14px 0 6px; font-size: 16px; font-weight: 800; }
.bx-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; border-top: 1px solid #efeef4; }
.bx-row .bx-ic { flex: none; width: 26px; font-size: 20px; line-height: 1.2; text-align: center; }
.bx-row .grow { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.bx-row b { display: block; font-size: 15px; } .bx-row small { display: block; font-size: 13px; color: #6c6981; margin-top: 1px; }
.bx-mini { flex: none; min-width: 36px; min-height: 36px; border: 0; border-radius: 10px; background: #f1f0f6; color: #3b3850; font: inherit; font-size: 15px; cursor: pointer; }
.bx-mini.arm { background: #ffe1e1; color: #b3261e; font-size: 13px; font-weight: 800; padding: 0 8px; }
/* notes */
.bx-noteadd { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
.bx-body textarea { width: 100%; box-sizing: border-box; min-height: 64px; padding: 10px 12px; border: 1.5px solid #dcd9e6; border-radius: 12px; font: inherit; font-size: 16px; color: #1d1b2e; background: #fff; resize: vertical; }
.bx-noteadd .bx-btn { align-self: flex-end; }
.bx-note { padding: 10px 0; border-top: 1px solid #efeef4; }
.bx-ntext { font-size: 15px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.bx-nfoot { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.bx-nfoot small { flex: 1; min-width: 0; color: #6c6981; font-size: 13px; }
.bx-nedit { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
/* calculator */
.bx-disp { padding: 12px 14px; border-radius: 16px; background: #15131f; color: #fff; text-align: right; margin-bottom: 10px; }
.bx-disp small { display: block; min-height: 18px; font-size: 14px; color: #b9b5cc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bx-disp b { display: block; font-size: 38px; font-weight: 700; line-height: 1.15; overflow-wrap: anywhere; }
.bx-keys { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.bx-keys button { min-width: 0; min-height: 56px; border: 0; border-radius: 16px; background: #f1f0f6; color: #1d1b2e; font: inherit; font-size: 24px; font-weight: 700; cursor: pointer; }
.bx-keys .op { background: color-mix(in srgb, var(--bxa) 22%, #fff); color: #1d1b2e; }
.bx-keys .eq { background: var(--bxa); color: #fff; }
.bx-keys .fn { background: #e4e2ec; font-size: 20px; }
.bx-keys .zero { grid-column: span 2; }
@media (max-height: 700px) { .bx-keys button { min-height: 46px; font-size: 21px; } .bx-keys { gap: 6px; } .bx-disp { padding: 8px 12px; margin-bottom: 8px; } .bx-disp b { font-size: 30px; }
  .bx-head { padding-top: 10px; padding-bottom: 6px; } .bx-seg { padding-bottom: 8px; } }
@supports not (background: color-mix(in srgb, red 50%, blue)) { .bx-keys .op { background: #e8e6f3; } }
/* Settings -> Tools (inherits each Hub's own Settings colours) */
.bx-setbox { margin: -4px 0 14px; }
.bx-setlabel { margin: 0 0 6px; font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; opacity: .7; }
.bx-setrow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.bx-setrow button { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 4px; border: 1.5px solid rgba(127, 127, 127, .35); border-radius: 16px;
  background: rgba(127, 127, 127, .1); color: inherit; font: inherit; cursor: pointer; }
.bx-setrow span { font-size: 24px; line-height: 1.1; } .bx-setrow b { font-size: 14px; }
.bx-unitools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
.bx-unitools button { min-width: 0; padding: 10px 4px; border: 1.5px solid rgba(255, 255, 255, .25); border-radius: 14px; background: rgba(255, 255, 255, .08); color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.bx-share { white-space: nowrap; }`;
  document.head.appendChild(st);
}
// The three buttons (Settings -> Tools, Hub Universe's home)
const bxToolBtns = () => BX_TOOLS.map(([k, ic, l]) => `<button type="button" data-bx="${k}"><span aria-hidden="true">${ic}</span><b>${l}</b></button>`).join("");
function bxSetBox(after) {                                                // ui.js drawSettings: right under How it works, in every Hub
  let el = document.getElementById("bxSetBox");
  if (!el) { el = document.createElement("div"); el.id = "bxSetBox"; el.className = "bx-setbox"; const at = after || document.querySelector("#sheet .sheet-head"); if (!at) return; at.after(el); }
  bxCss(); el.innerHTML = `<p class="bx-setlabel">Tools</p><div class="bx-setrow">${bxToolBtns()}</div>`;
}
const bxUniTools = () => { if (typeof document !== "undefined") bxCss(); return `<div class="bx-unitools">${BX_TOOLS.map(([k, ic, l]) => `<button type="button" data-bx="${k}">${ic} ${l}</button>`).join("")}</div>`; };

function bxOpen(tool) {
  tool = BX_TOOLS.some(t => t[0] === tool) ? tool : "cal";
  if (tool === "cal" && MODE === "family" && typeof showFh === "function") {   // Family Hub has its own Month / Week / Today calendar
    bxClose(); const sh = document.getElementById("sheet"); if (sh && !sh.classList.contains("hidden") && typeof closeSettings === "function") closeSettings();
    showFh("cal"); return;
  }
  bxCss();
  let el = document.getElementById("bxSheet");
  if (!el) { el = document.createElement("div"); el.id = "bxSheet"; el.className = "hidden"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "bxTitle"); document.body.appendChild(el); bxWire(el); }
  const was = !el.classList.contains("hidden");
  BX.tool = tool; BX.edit = ""; BX.arm = "";
  if (tool === "cal" && !was) { BX.month = 0; BX.day = today(); }
  el.style.setProperty("--bxa", bxHub()[0]);
  if (!was) {
    BX.back = document.activeElement;
    el.classList.remove("hidden"); document.body.classList.add("bx-on");
    try { history.pushState({ bx: 1 }, ""); BX.hist = 1; } catch (e) { /* the ✕ still works */ }
  }
  bxDraw();
  const f = el.querySelector(tool === "calc" ? ".bx-keys .eq" : ".bx-x"); if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
}
function bxClose(fromPop) {
  const el = document.getElementById("bxSheet"); if (!el || el.classList.contains("hidden")) return;
  el.classList.add("hidden"); el.innerHTML = ""; document.body.classList.remove("bx-on");
  if (!fromPop && BX.hist) { BX.hist = 0; BX.skip = 1; try { history.back(); } catch (e) { BX.skip = 0; } }
  const b = BX.back; BX.back = null; if (b && b.isConnected && typeof b.focus === "function") try { b.focus({ preventScroll: true }); } catch (e) { /* gone */ }
}
function bxDraw() {
  const el = document.getElementById("bxSheet"); if (!el || el.classList.contains("hidden")) return;
  const T = BX_TOOLS.find(t => t[0] === BX.tool) || BX_TOOLS[0];
  const body = BX.tool === "notes" ? bxNotesHtml() : BX.tool === "calc" ? bxCalcHtml() : bxCalHtml();
  const keep = el.querySelector(".bx-body"), top = keep ? keep.scrollTop : 0;
  el.innerHTML = `<div class="bx-card"><div class="bx-head"><h2 id="bxTitle">${T[1]} ${esc(T[2])}</h2><button class="bx-x" data-bxact="close" aria-label="Close">✕</button></div>
    <div class="bx-seg" role="tablist" aria-label="Tools">${BX_TOOLS.map(([k, ic, l]) => `<button role="tab" aria-selected="${k === BX.tool}" class="${k === BX.tool ? "on" : ""}" data-bxtab="${k}"><span class="bx-segic" aria-hidden="true">${ic} </span>${l}</button>`).join("")}</div>
    <div class="bx-body" data-bxtool="${BX.tool}">${body}</div></div>`;
  const nb = el.querySelector(".bx-body"); if (nb && keep) nb.scrollTop = top;
}

// ------------------------------------------------------------ CALENDAR
const BX_WD = ["S", "M", "T", "W", "T", "F", "S"];
function bxCalHtml() {
  const t = today(), base = parseDay(t); base.setDate(1); base.setMonth(base.getMonth() + BX.month);
  const y = base.getFullYear(), mo = base.getMonth(), first = ymd(base), dim = new Date(y, mo + 1, 0).getDate(), last = `${first.slice(0, 7)}-${pad(dim)}`;
  if (!bxIsD(BX.day) || BX.day < first || BX.day > last) BX.day = t >= first && t <= last ? t : first;
  const items = bxItems(first, last), on = d => items.filter(i => i.date === d);
  const cells = [...Array(base.getDay())].map(() => `<span aria-hidden="true"></span>`).concat([...Array(dim)].map((_, i) => { const d = `${first.slice(0, 7)}-${pad(i + 1)}`, L = on(d);
    return `<button class="${d === t ? "now" : ""}${d === BX.day ? " on" : ""}" data-bxday="${d}" aria-pressed="${d === BX.day}" aria-label="${esc(longDate(d))}: ${L.length ? `${L.length} dated item${L.length === 1 ? "" : "s"}` : "nothing dated"}">${i + 1}${L.length ? `<span class="bx-dots" aria-hidden="true">${L.slice(0, 3).map(() => "<i></i>").join("")}</span>` : ""}</button>`; }));
  const L = on(BX.day), word = BX.day === t ? "Today" : BX.day === addDays(t, 1) ? "Tomorrow" : "";
  const row = i => `<div class="bx-row"><span class="bx-ic" aria-hidden="true">${esc(i.icon)}</span><span class="grow"><b>${esc(i.title)}</b><small>${esc([i.time ? hm(i.time) : "All day", i.sub].filter(Boolean).join(" · "))}</small></span>
    ${/^(events|occ):/.test(i.del) ? `<button class="bx-mini${BX.arm === "c" + i.del ? " arm" : ""}" data-bxact="caldel" data-id="${esc(i.del)}" aria-label="Remove ${esc(i.title)}">${BX.arm === "c" + i.del ? "Remove?" : "✕"}</button>` : ""}</div>`;
  return `<div class="bx-mnav"><button data-bxmonth="-1" aria-label="Last month">‹</button><b>${esc(base.toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</b>
      ${BX.month ? `<button class="bx-today" data-bxmonth="0">Today</button>` : ""}<button data-bxmonth="1" aria-label="Next month">›</button></div>
    <div class="bx-wd" aria-hidden="true">${BX_WD.map(w => `<span>${w}</span>`).join("")}</div><div class="bx-grid">${cells.join("")}</div>
    <h3 class="bx-dayh">${esc(word ? `${word} · ${prettyDate(BX.day)}` : longDate(BX.day))}</h3>
    <div class="bx-daylist">${L.length ? L.map(row).join("") : `<p class="bx-empty">Nothing on ${esc(prettyDate(BX.day))}.</p>`}</div>
    ${items.length ? "" : `<p class="bx-fine">Nothing dated in ${esc(base.toLocaleDateString("en-US", { month: "long" }))}. ${esc(bxHub()[1])} you add in ${esc(APP_NAME)} show up here.</p>`}`;
}

// ------------------------------------------------------------ NOTES (S.notes: this Hub's own, like Day Hub's Notes card)
const bxNotes = () => { if (!Array.isArray(S.notes)) S.notes = []; return S.notes; };
// The day a note was last changed, on this phone's clock (it is stored as a UTC time: after 6 PM Central that is already tomorrow).
const bxNoteDay = u => { const d = new Date(u || ""); return isFinite(d) && u ? prettyDate(ymd(d)) : ""; };
function bxNotesHtml() {
  const list = bxNotes().slice().sort((a, b) => (!!b.pinned - !!a.pinned) || String(b.updated || "").localeCompare(String(a.updated || "")));
  const one = n => BX.edit === n.id
    ? `<form class="bx-note" data-bxform="noteedit" data-id="${esc(n.id)}"><textarea name="text" rows="4" maxlength="2000" aria-label="Edit note" required>${esc(n.text)}</textarea>
        <div class="bx-nedit"><button type="button" class="bx-ghost" data-bxact="noteeditx">Cancel</button><button class="bx-btn">Save</button></div></form>`
    : `<div class="bx-note"><div class="bx-ntext">${esc(n.text)}</div><div class="bx-nfoot"><small>${n.pinned ? "📌 Pinned · " : ""}${esc(bxNoteDay(n.updated))}</small>
        <button class="bx-mini" data-bxact="notepin" data-id="${esc(n.id)}" aria-label="${n.pinned ? "Unpin" : "Pin"} this note" aria-pressed="${!!n.pinned}">📌</button>
        <button class="bx-mini" data-bxact="noteedit" data-id="${esc(n.id)}" aria-label="Edit this note">✏️</button>
        <button class="bx-mini${BX.arm === "n" + n.id ? " arm" : ""}" data-bxact="notedel" data-id="${esc(n.id)}" aria-label="Delete this note">${BX.arm === "n" + n.id ? "Delete?" : "🗑️"}</button></div></div>`;
  return `<form class="bx-noteadd" data-bxform="noteadd"><textarea name="text" rows="2" maxlength="2000" placeholder="Jot something down…" aria-label="New note" required></textarea><button class="bx-btn">Save note</button></form>
    ${list.length ? list.map(one).join("") : `<p class="bx-empty">No notes yet. ${esc(bxHub()[2])}</p>`}
    <p class="bx-fine">Your ${esc(APP_NAME)} notes stay on this phone${S.sync && S.sync.on ? " and in your backup" : ""}.</p>`;
}

// ------------------------------------------------------------ CALCULATOR (plain, phone-style: no memory, no history kept)
const BX_OPS = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const BX_OWN_CALC = ["day", "cruise", "trip", "home", "auto", "money", "cooking"];   // the Hubs that already had calculators of their own (the 11/20 audit)
const bxNum = s => Number(s);
const bxFmt = n => { if (!isFinite(n)) return "Error"; const r = Number(n.toPrecision(12)); return Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9) ? r.toExponential(6) : String(r); };
const bxDo = (a, op, b) => op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : op === "/" ? (b === 0 ? NaN : a / b) : b;
function bxKey(k) {
  const C = BX.calc;
  if (C.cur === "Error" && k !== "C") { Object.assign(C, { cur: "0", acc: null, op: null, fresh: true, line: "" }); }
  if (/^[0-9]$/.test(k)) { if (C.fresh) { C.cur = k; C.fresh = false; } else if (C.cur.replace(/[-.]/g, "").length < 15) C.cur = C.cur === "0" ? k : C.cur === "-0" ? "-" + k : C.cur + k; }
  else if (k === ".") { if (C.fresh) { C.cur = "0."; C.fresh = false; } else if (!C.cur.includes(".")) C.cur += "."; }
  else if (k in BX_OPS) {
    if (C.op && C.acc != null && !C.fresh) { const r = bxDo(C.acc, C.op, bxNum(C.cur)); C.cur = bxFmt(r); C.acc = isFinite(r) ? Number(C.cur) : null; }
    else C.acc = bxNum(C.cur);
    if (C.cur === "Error") { C.op = null; C.line = ""; C.fresh = true; return; }
    C.op = k; C.fresh = true; C.line = `${C.cur} ${BX_OPS[k]}`;
  }
  else if (k === "=") {
    if (C.op && C.acc != null) { const b = bxNum(C.cur); C.line = `${bxFmt(C.acc)} ${BX_OPS[C.op]} ${bxFmt(b)} =`; C.cur = bxFmt(bxDo(C.acc, C.op, b)); }
    C.acc = null; C.op = null; C.fresh = true;
  }
  else if (k === "%") {                                                  // like a phone: 200 + 10% = 220; 50 x 10% = 5; 10% on its own = 0.1
    const b = bxNum(C.cur), p = C.op && C.acc != null && (C.op === "+" || C.op === "-") ? C.acc * b / 100 : b / 100;
    C.cur = bxFmt(p); C.fresh = false;
  }
  else if (k === "C") Object.assign(C, { cur: "0", acc: null, op: null, fresh: true, line: "" });
  else if (k === "back") { if (!C.fresh) { C.cur = C.cur.slice(0, -1); if (!C.cur || C.cur === "-") { C.cur = "0"; C.fresh = true; } } }
}
function bxCalcHtml() {
  const C = BX.calc, K = [["C", "C", "fn", "Clear"], ["back", "⌫", "fn", "Backspace"], ["%", "%", "fn", "Percent"], ["/", "÷", "op", "Divide"],
    ["7"], ["8"], ["9"], ["*", "×", "op", "Times"], ["4"], ["5"], ["6"], ["-", "−", "op", "Minus"], ["1"], ["2"], ["3"], ["+", "+", "op", "Plus"],
    ["0", "0", "zero"], [".", ".", "", "Decimal point"], ["=", "=", "eq", "Equals"]];
  const shown = C.cur === "Error" ? "Can't divide by 0" : C.cur;
  return `<div class="bx-disp" aria-live="polite"><small>${esc(C.line)}</small><b data-bxdisp="1">${esc(shown)}</b></div>
    <div class="bx-keys">${K.map(([k, l, cls, aria]) => `<button type="button" class="${cls || ""}" data-bxkey="${esc(k)}"${aria ? ` aria-label="${aria}"` : ""}>${esc(l || k)}</button>`).join("")}</div>
    ${BX_OWN_CALC.includes(MODE) ? `<p class="bx-fine">${esc(APP_NAME)}'s own calculators are still where they always were.</p>` : ""}`;
}

// ------------------------------------------------------------ taps, typing, the back button
function bxWire(el) {
  el.addEventListener("click", e => {
    e.stopPropagation();                                                   // the Hub's own tap handlers never see a tap in here
    if (e.target === el) return bxClose();                                // a tap outside the card closes it
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.bxact === "close") return bxClose();
    if (d.bxtab) { if (d.bxtab === "cal" && MODE === "family") return bxOpen("cal"); BX.tool = d.bxtab; BX.edit = ""; BX.arm = ""; if (d.bxtab === "cal") { BX.month = 0; BX.day = today(); } bxDraw(); return; }
    if (d.bxmonth !== undefined) { BX.month = Number(d.bxmonth) ? BX.month + Number(d.bxmonth) : 0; BX.day = ""; BX.arm = ""; bxDraw(); return; }
    if (d.bxday) { BX.day = d.bxday; BX.arm = ""; bxDraw(); return; }
    if (d.bxkey) { bxKey(d.bxkey); bxDraw(); bxKeyFocus(d.bxkey); return; }
    if (d.bxact === "caldel") return bxCalDel(d.id);
    if (d.bxact === "notepin") { const n = bxNotes().find(x => x.id === d.id); if (n) { n.pinned = !n.pinned; save(); bxAfter(); } return; }
    if (d.bxact === "noteedit") { BX.edit = d.id; BX.arm = ""; bxDraw(); const t = el.querySelector("[data-bxform=noteedit] textarea"); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } return; }
    if (d.bxact === "noteeditx") { BX.edit = ""; bxDraw(); return; }
    if (d.bxact === "notedel") {
      if (BX.arm !== "n" + d.id) { BX.arm = "n" + d.id; bxDraw(); return; }
      S.notes = bxNotes().filter(x => x.id !== d.id); BX.arm = ""; save(); bxAfter(); toast("🗑️ Note deleted"); return;
    }
  });
  el.addEventListener("submit", e => {
    e.preventDefault(); e.stopPropagation();                               // ui.js's own form handler never sees these
    const f = e.target, text = bxTxt(new FormData(f).get("text"), 2000);
    if (!text) return;
    if (f.dataset.bxform === "noteadd") { bxNotes().push({ id: uid(), text, pinned: false, updated: new Date().toISOString() }); save(); bxAfter(); toast("📝 Note saved"); const t = el.querySelector("[data-bxform=noteadd] textarea"); if (t) t.focus(); return; }
    if (f.dataset.bxform === "noteedit") { const n = bxNotes().find(x => x.id === f.dataset.id); if (n) { n.text = text; n.updated = new Date().toISOString(); save(); } BX.edit = ""; bxAfter(); toast("📝 Note saved"); }
  });
}
// Keys while the sheet is open (wherever the focus is - a redraw can drop it to the page): Esc closes; on the calculator, digits,
// + - * x / % . , Enter = Backspace and C / Delete work like its buttons. A note being typed keeps its keys. The Hub never sees them.
if (typeof document !== "undefined") document.addEventListener("keydown", e => {
  const el = document.getElementById("bxSheet"); if (!el || el.classList.contains("hidden") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return bxClose(); }
  if (BX.tool !== "calc" || (e.target && /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName))) return;
  const k = e.key === "Enter" ? "=" : e.key === "Backspace" ? "back" : e.key === "Delete" || e.key === "c" || e.key === "C" ? "C" : e.key === "x" || e.key === "X" ? "*" : e.key === "," ? "." : e.key;
  if (/^[0-9]$/.test(k) || k in BX_OPS || ["=", ".", "%", "back", "C"].includes(k)) { e.preventDefault(); e.stopPropagation(); bxKey(k); bxDraw(); bxKeyFocus(k); }
}, true);
function bxKeyFocus(k) { const q = document.querySelector(`#bxSheet [data-bxkey="${k}"]`) || document.querySelector("#bxSheet .bx-keys .eq"); if (q) try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } }
function bxAfter() { bxDraw(); if (typeof render === "function") render(); }   // Day Hub's Notes card and the screen under the sheet keep up
function bxCalDel(key) {
  if (BX.arm !== "c" + key) { BX.arm = "c" + key; bxDraw(); return; }
  BX.arm = "";
  if (key.startsWith("occ:")) { const [, id, day] = key.split(":"), e = S.events.find(x => x.id === id); if (e) e.skip = [...(e.skip || []), day]; }
  else { const id = key.slice(7); S.events = S.events.filter(x => x.id !== id); }
  save(); bxAfter(); toast("Removed");
}
// The back button closes the sheet first - and only the sheet. app.js asks this from a back-button listener it adds before any Hub
// adds its own; true = handled here, so the Hub's own back handlers (Pet, Job, the new looks...) never see that step.
function bxPop() {
  if (BX.skip) { BX.skip = 0; return true; }                               // our own step back after ✕
  const el = document.getElementById("bxSheet"); if (!el || el.classList.contains("hidden")) return false;
  BX.hist = 0; bxClose(true); return true;
}
// Any [data-bx] (Settings -> Tools, a More page) opens a tool; any [data-bxshare] shares one entry. Before the Hub's own handlers.
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-bx], [data-bxshare]"); if (!b || b.closest("#bxSheet")) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.bxshare) bxShareItem(b.dataset.bxshare); else bxOpen(b.dataset.bx);
}, true);

// ------------------------------------------------------------ SHARE ONE ENTRY (Home, Money, Pet)
async function bxShare(title, text) {
  try { if (navigator.share) { await navigator.share({ title, text }); return "shared"; } } catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  try { await navigator.clipboard.writeText(text); toast("📋 Copied - paste it anywhere"); return "copied"; } catch (e) { toast("Couldn't share on this phone"); return "failed"; }
}
const bxOrd = n => { n = Number(n); const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"); return n + s; };
const bxDay = d => bxIsD(d) ? longDate(d) + (d.slice(0, 4) !== today().slice(0, 4) ? ", " + d.slice(0, 4) : "") : "";
// One entry -> [title, lines]. Keys are "<kind>|<id>[|<id>]" ("|" is never in a record id).
function bxShareText(key) {
  const [k, a, b] = String(key).split("|");
  if ((k === "htask" || k === "hitem") && typeof spaceById === "function") {
    const sp = spaceById(a); if (!sp) return null;
    if (k === "htask") { const t = sp.tasks.find(x => x.id === b); if (!t) return null;
      return [t.title, [`🧰 ${t.title}`, `${sp.icon || "🏠"} ${sp.name}`, t.due ? `Due ${bxDay(t.due)}` : "", t.every ? `Repeats every ${Number(t.every) === 1 ? "month" : `${t.every} months`}` : "", t.done ? "Done" : ""]]; }
    const it = sp.items.find(x => x.id === b); if (!it) return null;
    return [it.name, [`📦 ${it.name}`, it.model || "", it.note || "", `${sp.icon || "🏠"} ${sp.name}`]];
  }
  if (k === "mbill") { const x = (S.bills || []).find(y => y.id === a); if (!x) return null; const due = typeof nextDue === "function" ? nextDue(x) : "";
    return [x.name, [`💳 ${x.name}`, `${money(x.amount)} · due on the ${bxOrd(x.day)} of every month`, due ? `Next due ${bxDay(due)}` : "", x.auto ? "On autopay" : "",
      typeof safeUrl === "function" && safeUrl(x.url) ? `Pay here: ${safeUrl(x.url)}` : ""]]; }
  if (k === "msub") { const x = (S.mh && Array.isArray(S.mh.subs) ? S.mh.subs : []).find(y => y.id === a); if (!x) return null;
    return [x.name, [`🔁 ${x.name}`, `${money(x.amt)} every ${x.every || "month"}`, x.off ? `Cancelled ${bxDay(x.off)}` : x.next ? `Renews ${bxDay(x.next)}` : ""]]; }
  if ((k === "pshot" || k === "pvisit" || k === "pmed") && typeof pt === "function") {
    const P = pt(), list = k === "pshot" ? P.shots : k === "pvisit" ? P.visits : P.meds, x = list.find(y => y.id === a), p = x && P.pets.find(y => y.id === x.pet);
    if (!x || !p) return null;
    if (k === "pshot") return [`${p.name}: ${x.name}`, [`💉 ${p.name}: ${x.name || "shot"}`, x.given ? `Given ${bxDay(x.given)}` : "", x.due ? `Next due ${bxDay(x.due)}` : ""]];
    if (k === "pvisit") return [`${p.name}: vet visit`, [`🩺 ${p.name}: vet visit`, `${bxDay(x.date)}${bxIsT(x.time) ? " at " + hm(x.time) : ""}`, x.vet || "", x.reason ? `Why: ${x.reason}` : "",
      x.notes ? `What the vet said: ${x.notes}` : "", x.cost ? `Cost: ${x.cost}` : ""]];
    return [`${p.name}: ${x.name}`, [`💊 ${p.name}: ${x.name || "medicine"}`, x.dose ? `How much: ${x.dose}` : "", (x.times || []).length ? `When: ${x.times.map(hm).join(", ")}` : "", x.end ? `Until ${bxDay(x.end)}` : ""]];
  }
  return null;
}
function bxShareItem(key) {
  const r = bxShareText(key);
  if (!r) { toast("That entry isn't here any more"); return; }
  return bxShare(r[0], r[1].filter(Boolean).join("\n") + `\n- from ${APP_NAME}`);
}
const bxShareBtn = (key, label, cls, text) => `<button type="button" class="${cls || "icon-btn"} bx-share" data-bxshare="${esc(key)}" aria-label="Share ${esc(label || "this")}">${esc(text || "📤")}</button>`;

// ------------------------------------------------------------ BRAIN DUMP in Health Hub + Hub Universe (ui.js asks these)
// Their Add sheet is the brain dump only, and it sorts into what they show: reminders (their Calendar) and notes (their Notes).
const BX_DUMP_HUBS = ["health", "universe"];
const bxDumpKind = k => BX_DUMP_HUBS.includes(MODE) ? (k === "event" ? "event" : "note") : null;
const bxQaTypes = () => BX_DUMP_HUBS.includes(MODE) ? [["dump", "🧠 Brain dump"]] : null;
const bxDumpWhere = () => BX_DUMP_HUBS.includes(MODE) ? " · they're in Notes and Calendar, under Tools" : "";

// ------------------------------------------------------------ GOOGLE CALENDAR: this Hub's own dates (app.js gcalWanted / gcalItemExists)
// Only runs where app.js already sends (Calendar sync connected + its Pro check). Keys "<kind>:<id>" never clash with app.js
// (ev sh pp bill) or trip.js (tr fp pt ex bk be dv fn). Daily things (doses, daily chores) are left off: they would fill every day.
function bxGcalList() {
  const L = [], one = (key, day, summary, o = {}) => { if (bxIsD(day) && summary) L.push({ key, day, summary: bxTxt(summary, 200), ...o }); };
  (S.upkeep || []).forEach(x => { const d = typeof upkeepNext === "function" ? upkeepNext(x) : null; one(`uk:${x.id}`, d, `${x.area === "auto" ? "🚗" : "🏠"} ${x.name}`); });
  if (MODE === "health" && S.hh && typeof hh === "function") { const H = hh();
    H.appts.forEach(a => one(`ha:${a.id}`, a.date, `🩺 ${a.reason || a.specialty || "Appointment"}${a.doctor ? " · " + a.doctor : ""}`, { time: bxIsT(a.time) ? a.time : "", where: a.where || "" }));
    if (typeof hhRefill === "function") H.meds.filter(m => !m.off).forEach(m => { const r = hhRefill(m); if (r.by) one(`hr:${m.id}`, r.by, `💊 Refill ${m.name || "medicine"}`); }); }
  if (MODE === "pet" && S.pt && typeof pt === "function") { const P = pt(), pet = id => P.pets.find(p => p.id === id && !p.passed);
    P.pets.filter(p => !p.passed).forEach(p => [["pb", p.est ? "" : p.bday, `🎂 ${p.name}'s birthday`], ["pg", p.gotcha, `🏡 ${p.name}'s Gotcha Day`]].forEach(([k, d, s]) => {
      if (!bxIsD(d)) return; const y = Number(today().slice(0, 4)); let on = bxMd(y, d.slice(5)); if (on < today()) on = bxMd(y + 1, d.slice(5));
      one(`${k}:${p.id}`, on, s, { rule: d.slice(5) === "02-29" ? `FREQ=YEARLY;BYMONTH=2;${mdRule(29)}` : "FREQ=YEARLY" }); }));
    P.shots.forEach(s => { const p = pet(s.pet); if (p) one(`ps:${s.id}`, s.due, `💉 ${p.name}: ${s.name || "shot"} due`); });
    P.visits.forEach(v => { const p = pet(v.pet); if (p) one(`pv:${v.id}`, v.date, `🩺 ${p.name}: vet visit${v.reason ? " · " + v.reason : ""}`, { time: bxIsT(v.time) ? v.time : "", where: v.vet || "" }); }); }
  if (MODE === "job" && S.jh && S.jh.jobs && typeof S.jh.jobs === "object") Object.values(S.jh.jobs).forEach(x => {
    if (!x || !x.id || !x.t) return;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(x.iv || ""))) one(`ji:${x.id}`, x.iv.slice(0, 10), `👥 Interview: ${x.t}`, { time: x.iv.slice(11, 16), where: x.co || "" });
    if (bxIsD(x.fu) && !x.fuDone && x.st !== "closed") one(`jf:${x.id}`, x.fu, `📨 Follow up: ${x.t}${x.co ? " · " + x.co : ""}`); });
  if (MODE === "auto" && S.garage && typeof garage === "function") garage().cars.forEach(c => { const name = typeof carName === "function" ? carName(c) : "";
    if (typeof carDue === "function") carDue(c, today()).forEach(d => { const s = AUTO_SERVICES.find(x => x[0] === d.key); if (s && d.dueDate) one(`as:${c.id}.${d.key}`, d.dueDate, `${s[1]} ${s[2]} due${name ? " · " + name : ""}`); });
    c.papers.forEach(x => { const k = typeof paper === "function" ? paper(x.kind) : [x.kind, "📄", "Papers"]; one(`ap:${x.id}`, x.expires, `${k[1]} ${x.name || k[2]} renews${name ? " · " + name : ""}`); }); });
  if (MODE === "home" && S.house && typeof house === "function") house().spaces.forEach(sp => sp.tasks.filter(t => !t.done).forEach(t => one(`hm:${t.id}`, t.due, `🧰 ${t.title}`, { where: sp.name || "" })));
  if (MODE === "money" && S.mh && Array.isArray(S.mh.subs)) S.mh.subs.filter(s => s && !s.off && s.name).forEach(s => {
    const md = Number(String(s.next || "").slice(8)), rule = s.every === "week" ? "FREQ=WEEKLY" : s.every === "year" ? "FREQ=YEARLY" : md > 28 ? `FREQ=MONTHLY;${mdRule(md)}` : "FREQ=MONTHLY";
    one(`ms:${s.id}`, s.next, `🔁 ${s.name} renews${Number(s.amt) ? " " + money(s.amt) : ""}`, { rule }); });
  if (MODE === "family" && S.fh && typeof fh === "function") { const F = fh(), see = e => typeof fhCan !== "function" || fhCan("see", e);
    const R = { daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", "2weeks": "FREQ=WEEKLY;INTERVAL=2", yearly: "FREQ=YEARLY" };
    F.events.filter(e => e && e.id && e.title && bxIsD(e.date) && see(e)).forEach(e => {
      const md = Number(e.date.slice(8)), tm = bxIsT(e.time) ? e.time.padStart(5, "0") : "";
      let rule = e.rep === "monthly" ? (md > 28 ? `FREQ=MONTHLY;${mdRule(md)}` : "FREQ=MONTHLY") : R[e.rep] || null;
      if (rule && bxIsD(e.until)) rule += tm ? `;UNTIL=${new Date(`${e.until}T${tm}:00`).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}` : `;UNTIL=${e.until.replace(/-/g, "")}`;
      one(`fe:${e.id}`, e.date, `${(typeof fhKind === "function" ? fhKind(e.kind)[1] : "") || "📅"} ${e.title}`, { time: tm, where: e.where || "", rule, skip: rule ? (e.skip || []).filter(bxIsD) : null }); });
    F.chores.filter(c => c && c.id && c.title).forEach(c => {
      const who = typeof fhName === "function" && c.who ? " · " + fhName(c.who) : "";
      if (c.every === "weekly") { let d = bxIsD(c.from) && c.from > today() ? c.from : today(); for (let i = 0; i < 7 && parseDay(d).getDay() !== Number(c.day); i++) d = addDays(d, 1);
        one(`fc:${c.id}`, d, `🧹 ${c.title}${who}`, { rule: "FREQ=WEEKLY" }); }
      else if (c.every !== "daily" && bxIsD(c.date) && !(c.log && c.log[c.date] && c.log[c.date].st)) one(`fc:${c.id}`, c.date, `🧹 ${c.title}${who}`); }); }
  return L;
}
function bxGcal(put, allDay, timed, old, lead) {
  bxGcalList().forEach(x => { if (!x.rule && x.day < old) return;
    put(x.key, x.summary, x.where || "", x.time ? timed(x.day, x.time, 60) : allDay(x.day), x.rule || null, x.skip || null, x.time ? lead : 900); });
}
// Still here at all? (aged out is not deleted; done, removed or cancelled is). Asked fresh each time: it only runs for this Hub's
// own Google copies that are no longer wanted, a handful per sync.
const bxGcalHas = (k, id) => bxGcalList().some(x => x.key.split(":").slice(0, 2).join(":") === `${k}:${id}`);
