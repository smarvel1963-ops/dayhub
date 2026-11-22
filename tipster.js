/* SAVE AS: tipster.js · LOCATION: C:/MarvelApps/dayhub/tipster.js
 * TINY TIPSTER, engine 1.74 (Scott 11/21: "what do you think about tiny tipsters to help with apps same way as usemart does" -> "Yes, build it").
 * A small round character in the bottom corner of the Home screen in every Hub (Day, Cruise, Trip, Home, Auto, Money, Health, Family,
 * Pet, Cooking, Job Hub, Hub Universe). Each Hub has its own: its emoji and its colours (the same as its Share the Magic page).
 *   - AT MOST ONE bubble a day per app, only on Home. Never on a Hub's first day on a phone: the 1.68 tour has that day.
 *   - One tap opens the tip; ✕ closes it (gone until tomorrow); Hush turns him off in this app; Settings -> Tiny Tipster turns him back on.
 *   - What he says, the first that applies:
 *       1. right after an update, while the What's new card is on Home: "New in <version>" + its first line; Show me = that card.
 *       2. a reminder from this Hub's OWN saved dates, read by the same code as the 1.73 Calendar (basics.js bxCollect) - nothing made up:
 *          Money + Day Hub a bill due soon (Day Hub also a birthday), Pet a vet visit / a shot due, Health an appointment / a refill,
 *          Trip + Cruise a trip coming up / a final payment, Auto a service / papers to renew, Family an event / a birthday,
 *          Home a room task, Job an interview / a follow-up, Cooking a use-by date, Hub Universe a date from the Hubs it already reads.
 *          Each one once, and once more on the day itself (or the day before).
 *       3. "Did you know?" - this Hub's own list of real features (6 of its own + 4 every Hub has), in turn; it remembers which were shown.
 *   - He never covers a button: he sits above the bottom bar (and the Update bar), and when something you can tap is under him he tucks
 *     into the screen's edge. He waits while anything is open on top of Home, while you type or scroll, and while the opening glide runs.
 * No AI, no network, no cost: what he knows is on this phone (localStorage APP_ID.tipster, read and written by ui.js tipRead / tipWrite -
 * on/off, the day, which tips he has said; reminders are kept as short codes, never their words). Erase everything clears it.
 * Loaded only on a day he has something to say (ui.js tipMaybe), like tour.js, so no Hub gets heavier and no Hub's own files change.
 * Switch: TINY_TIPSTER in features.js (ON since 1.74; OFF = no character at all). Every top-level name is tip / TIP.
 */
"use strict";
// [emoji, colour, deep colour] - each Hub's own, the same as its Share the Magic page (share.js STM_APPS)
const TIP_LOOK = {
  dayhub: ["☀️", "#f59e0b", "#7c3aed"], cruisehub: ["🚢", "#06b6d4", "#1e3a8a"], triphub: ["✈️", "#a855f7", "#1e1b4b"],
  homehub: ["🏡", "#14b8a6", "#134e4a"], autohub: ["🚗", "#ef4444", "#3f1012"], moneyhub: ["💰", "#22c55e", "#064e3b"],
  healthhub: ["❤️", "#2dd4bf", "#0f3d3a"], familyhub: ["👨‍👩‍👧", "#2e86de", "#3b1d6e"], pethub: ["🐾", "#f97316", "#4a1d0f"],
  cookinghub: ["🍳", "#d9442e", "#5a1a0e"], jobhub: ["💼", "#e2b04a", "#0c1a3e"], hubuniverse: ["🌌", "#6366f1", "#1e1b4b"],
};
// "Did you know?" - [id, words, Show me (optional), a switch it needs (optional)]. Each line is a feature that is really in that Hub.
// Show me: tools:cal / tools:notes / tools:calc (basics.js), share (Share the Magic), tour (How it works), data (Settings -> My data),
// qa:<type> (the Add sheet on that type, only where the Hub's Add sheet has it).
const TIP_COMMON = [
  ["tools", "Your calculator, calendar and notes are in ⚙ Settings, under Tools.", "tools:calc"],
  ["share", `Like ${APP_NAME}? Share the Magic sends it to a friend. It's at the top of ⚙ Settings.`, "share"],
  ["tour", "Want the quick tour again? ⚙ Settings → How it works.", "tour"],
  ["data", "Save a copy of everything you've added: ⚙ Settings → My data → Download my data.", "data"],
];
const TIP_TIPS = {
  dayhub: [
    ["dump", "Brain dump: type or say everything on your mind at once, and Day Hub sorts it into plans, to-dos and bills.", "qa:dump"],
    ["future", "Future me: leave yourself a note that comes back on a day you pick, or when the same words come up again.", "qa:future"],
    ["reset", "After 6 PM, the Nightly reset helps you wrap up today and get set for tomorrow."],
    ["return", "Bought something you might send back? Add a Return and Day Hub reminds you before the last day.", "qa:return"],
    ["package", "Waiting on a package? Add it and its arrival day shows on your schedule.", "qa:package"],
    ["countdown", "Counting down to something big? Add a Countdown and Day Hub shows the days left.", "qa:countdown"]],
  cruisehub: [
    ["count", "Add your cruise and Cruise Hub counts down the days - and reminds you before the final payment is due."],
    ["ports", "Every port day gets its times and an all-aboard alarm."],
    ["bags", "Packing by bag: your packing lists show what goes in each bag."],
    ["forget", "Not sure what's left to do? Tap \"What am I forgetting?\" and Cruise Hub tells you, from where you are in your cruise."],
    ["guides", "Ship guides and port guides are built in."],
    ["crisis", "Crisis Mode: five big choices when something goes wrong, with the phone numbers you saved."]],
  triphub: [
    ["paste", "Paste a booking email and Trip Hub turns it into your flights and stays."],
    ["leave", "Leave-by times tell you when to head out, so you're never rushing."],
    ["fix", "Plans changed? Fix My Trip helps you sort out what to do next."],
    ["split", "Going with others? Add everyone's first name and Trip Hub works out who paid what and who owes whom."],
    ["vote", "Can't agree? Pass one phone around and everyone votes 👍 or 👎 on the trip's ideas."],
    ["refund", "Refunds owed keeps track of money a hotel or airline still owes you."]],
  homehub: [
    ["rooms", "Every room, yard and system in one place - add, rename or remove any of them."],
    ["upkeep", "Repeating reminders keep your home's upkeep from slipping."],
    ["value", "Curious what your home is worth? Home Hub estimates it from sales near you.", null, "HOME_VALUE"],
    ["share1", "Share one task or one item with someone: tap 📤 beside it."],
    ["model", "Keep the model number with each appliance, so the right part is easy to find."],
    ["cal", "Your room tasks show on the Calendar in ⚙ Settings → Tools.", "tools:cal"]],
  autohub: [
    ["vin", "Type the VIN and your car fills itself in: year, make and model."],
    ["due", "Oil, tires and brakes come due on their own - by miles or by months."],
    ["recall", "Auto Hub checks for safety recalls on your car, free."],
    ["mpg", "Log a fill-up and Auto Hub works out your miles per gallon."],
    ["papers", "Keep your registration and insurance papers here, with the date each one renews."],
    ["cal", "Service due dates and papers to renew show on the Calendar in ⚙ Settings → Tools.", "tools:cal"]],
  moneyhub: [
    ["afford", "Can I afford it? Ask before you buy: yes, tight or not yet - with the math shown."],
    ["payday", "See every bill before your next payday, plus a 60-day look ahead."],
    ["subs", "Add your subscriptions and Money Hub shows when each one renews."],
    ["share1", "Share one bill or one subscription: tap 📤 beside it."],
    ["safe", "Money Hub never asks for a bank password. What you type stays on this phone."],
    ["owe", "All your accounts in one picture: what you have and what you owe."]],
  healthhub: [
    ["meds", "Add your meds for reminders and refill countdowns."],
    ["charts", "Blood pressure, glucose and weight show as easy charts."],
    ["rings", "Steps, sleep and water show as daily rings."],
    ["dump", "Brain dump: say what's on your mind and Health Hub sorts it into notes and reminders.", "qa:dump"],
    ["cal", "Your appointments and refill dates show on the Calendar in ⚙ Settings → Tools.", "tools:cal"],
    ["notes", "Write down questions for the doctor in Notes, so they're ready at your visit.", "tools:notes"]],
  familyhub: [
    ["cal", "One family calendar for everyone's plans.", "tools:cal"],
    ["chores", "Chores kids check off, with rewards."],
    ["photos", "Family messages, photos and a family tree, all in one place."],
    ["invite", "Invite each person with their own code, and everyone's phone stays in step.", null, "FAMILY_SYNC"],
    ["lists", "Shared lists keep the groceries and errands in one place for the whole family."],
    ["bday", "Family birthdays show on the family calendar.", "tools:cal"]],
  pethub: [
    ["bday", "Every pet gets a birthday countdown - and a Gotcha Day, too."],
    ["shots", "Add shots with a due date and Pet Hub reminds you."],
    ["vet", "Vet visits and weight, kept in one place for each pet."],
    ["passport", "Each pet has its own pet passport."],
    ["mems", "Memories keeps your pet's life story, with photos."],
    ["share1", "Share one shot, vet visit or medicine: tap 📤 beside it."]],
  cookinghub: [
    ["finder", "Dinner Finder: tell it what you have and it shows what you can make."],
    ["along", "Cook Along walks you through a recipe one step at a time, with timers."],
    ["book", "Keep your family's favorites in your own cookbook."],
    ["pantry", "Add use-by dates to your pantry and they show on the Calendar.", "tools:cal"],
    ["week", "Plan the week's dinners and they show on the Calendar in ⚙ Settings → Tools.", "tools:cal"],
    ["quick", "Short on time? Quick Meals has fast ideas."]],
  jobhub: [
    ["match", "Today's openings are matched to what you're looking for, with the reasons."],
    ["fit", "Career Fit and Resume Studio help you get ready to apply."],
    ["pipe", "Your pipeline keeps every application in one place."],
    ["iv", "Add an interview time and Job Hub reminds you."],
    ["fu", "Set a follow-up date on a job so you remember to check back."],
    ["cal", "Interviews and follow-ups show on the Calendar in ⚙ Settings → Tools.", "tools:cal"]],
  hubuniverse: [
    ["orbit", "Your hubs orbit you: open any Hub app on this phone and it lights up here."],
    ["needs", "What needs you, across all your hubs, in one place."],
    ["today", "Today across everything, in one timeline."],
    ["read", "Hub Universe reads your other Hub apps on this phone and never changes them."],
    ["dump", "Brain dump here saves into Hub Universe's own notes and calendar.", "qa:dump"],
    ["cal", "The Calendar shows the dates from your other Hub apps on this phone.", "tools:cal"]],
};
// Reminders read from the Hub's own dates by basics.js bxCollect: [kind, how many days ahead]. Bills and trips are read straight
// from app.js (upcomingBills skips a month already paid; myTrips = this Hub's own trips).
const TIP_REM = {
  day: [["person", 7]], pet: [["visit", 14], ["shot", 14]], health: [["appt", 7], ["refill", 5]], auto: [["service", 14], ["paper", 21]],
  home: [["task", 7]], family: [["fevent", 1], ["fbday", 10]], job: [["iv", 7], ["fu", 2]], cooking: [["pantry", 3]],
};
const TIP_WAIT = 2500;                                           // Home has to be calm this long before he first appears on an open
const TIP = { root: null, iv: 0, calm: 0, out: false, open: false, lastScroll: 0, scrollT: 0, floorAt: 0, floor: 0, keyFn: null, downFn: null, pick: null };
const tipLook = () => TIP_LOOK[APP_ID] || TIP_LOOK.dayhub;
const tipToday = () => today();
// A short code for a reminder (never its words): kind + date + a hash of the title.
function tipHash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }

// ------------------------------------------------------------ WHAT HE SAYS
function tipActOk(act) {
  if (!act) return false;
  if (act === "news") return true;
  if (act.startsWith("tools:") || act.startsWith("cal:")) return typeof bxOpen === "function";
  if (act === "share") return typeof openShareMagic === "function";
  if (act === "tour") return typeof openTour === "function";
  if (act === "data") return typeof openSettings === "function";
  if (act.startsWith("qa:")) { const k = act.slice(3); try { return typeof openQA === "function" && typeof qaTypes === "function" && qaTypes().some(t => t[0] === k); } catch (e) { return false; } }
  return false;
}
const tipPlayOk = x => typeof playOk !== "function" || playOk(x);
// This Hub's tips in turn: its own first, one every-Hub tip after each two of its own.
function tipList() {
  const own = (TIP_TIPS[APP_ID] || TIP_TIPS.dayhub).filter(t => !t[3] || switchOn(t[3])), out = [], common = TIP_COMMON.slice();
  own.forEach((t, i) => { out.push(t); if (i % 2 === 1 && common.length) out.push(common.shift()); });
  out.push(...common);
  return out.filter(t => tipPlayOk(t[1])).map(t => ({ id: t[0], text: t[1], act: tipActOk(t[2]) ? t[2] : "" }));
}
function tipWhen(date, time) {
  const d = daysUntil(date), at = time && typeof hm === "function" ? ` at ${hm(time)}` : "";
  if (d === 0) return "today" + at;
  if (d === 1) return "tomorrow" + at;
  const wk = parseDay(date).toLocaleDateString([], { weekday: "long" });
  return (d <= 6 ? `on ${wk}` : `on ${prettyDate(date)}`) + at + ` (in ${d} days)`;
}
const tipNow = () => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}`; };
// Every reminder this Hub could give right now, soonest first. Only what this Hub has saved on this phone.
function tipReminders() {
  const t = tipToday(), out = [];
  const add = (code, date, icon, text, sub) => out.push({ key: code, date, d: daysUntil(date), icon: icon || "📅", text, sub: sub || "" });
  const isD = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  try {
    if ((MODE === "day" || MODE === "money") && typeof upcomingBills === "function")
      upcomingBills().forEach(b => { const d = daysUntil(b.due); if (d >= 0 && d <= (MODE === "money" ? 5 : 3) && b.name)
        add(`bill:${tipHash(b.id + b.name)}:${b.due}`, b.due, "💳", `${b.name} is due ${tipWhen(b.due)}.`, Number(b.amount) ? money(b.amount) : ""); });
    if (TRAVEL && typeof myTrips === "function") myTrips().forEach(tr => {
      if (!tr || typeof tr !== "object" || !tr.name) return; const cr = typeof isCruise === "function" && isCruise(tr);
      if (isD(tr.start)) { const d = daysUntil(tr.start); if (d >= 1 && d <= 30) add(`trip:${tipHash(tr.id + tr.name)}:${tr.start}`, tr.start, cr ? "🚢" : "✈️", `${tr.name} ${cr ? "sails" : "starts"} ${tipWhen(tr.start)}.`, ""); }
      if (isD(tr.finalDue) && typeof tripLeft === "function" && tripLeft(tr) !== 0) { const d = daysUntil(tr.finalDue), left = tripLeft(tr);
        if (d >= 0 && d <= 14) add(`final:${tipHash(tr.id + tr.name)}:${tr.finalDue}`, tr.finalDue, "💳", `The final payment for ${tr.name} is due ${tipWhen(tr.finalDue)}.`, left ? `${money(left)} left to pay` : ""); }
    });
    const spec = TIP_REM[MODE];
    if (spec && typeof bxCollect === "function") {
      const max = Math.max(...spec.map(s => s[1]));
      bxCollect(MODE, t, addDays(t, max)).forEach(i => {
        const s = spec.find(x => x[0] === i.kind); if (!s) return; const d = daysUntil(i.date);
        if (d < 0 || d > s[1] || (d === 0 && i.time && i.time < tipNow())) return;
        add(`${i.kind}:${tipHash(i.title + i.sub)}:${i.date}`, i.date, i.icon, `${i.title} - ${tipWhen(i.date, i.time)}.`, i.sub);
      });
    }
    if (MODE === "universe" && typeof bxItems === "function")                 // what the Hubs it already reads hold, today and tomorrow (read only)
      bxItems(t, addDays(t, 1)).forEach(i => { if ((i.time && i.date === t && i.time < tipNow()) || (i.kind === "bill" && /\bpaid\b/.test(i.sub))) return;   // a bill marked paid is not a reminder
        add(`uni:${tipHash(i.title + i.sub)}:${i.date}`, i.date, i.icon, `${i.title} - ${tipWhen(i.date, i.time)}.`, i.sub); });
  } catch (e) { /* one odd entry never stops him; he just has a tip instead */ }
  const order = MODE === "family" ? ["fevent", "fbday"] : [];
  return out.sort((a, b) => a.d - b.d || order.indexOf(a.key.split(":")[0]) - order.indexOf(b.key.split(":")[0]) || a.text.localeCompare(b.text));
}
// The update: only while the What's new card is on Home, and once per version.
function tipNewsItem(st) {
  if (st.ver === VERSION || !document.querySelector("#cards .whatsnew")) return null;
  const line = ((typeof NOTES !== "undefined" && NOTES && NOTES[VERSION]) || []).filter(x => typeof noteForMe !== "function" || noteForMe(x)).filter(tipPlayOk)[0];
  return { k: "new", key: VERSION, title: `New in ${VERSION}`, text: line || `${APP_NAME} just got an update.`, sub: "", act: "news", go: "See what's new", teaser: `New in ${VERSION}!` };
}
const tipBucket = r => r.key + (r.d <= 1 ? "|now" : "|soon");
function tipRemItem(r) { return { k: "rem", key: tipBucket(r), title: "Heads up", text: `${r.icon} ${r.text}`, sub: r.sub, act: typeof bxOpen === "function" ? "cal:" + r.date : "", go: "Show on calendar", teaser: "Heads up!" }; }
function tipTipItem(x) { return { k: "tip", key: x.id, title: "Did you know?", text: x.text, sub: "", act: x.act, go: "Show me", teaser: "Psst! A tip" }; }
// Today's pick, in order: the update, a reminder not said yet, the next tip. Marks it as said.
function tipChoose(st) {
  const news = tipNewsItem(st);
  if (news) { st.ver = VERSION; return news; }
  const said = Array.isArray(st.rem) ? st.rem : [];
  const r = tipReminders().find(x => !said.includes(tipBucket(x)));
  if (r) { st.rem = said.concat(tipBucket(r)).slice(-80); return tipRemItem(r); }
  const L = tipList(); if (!L.length) return null;
  let shown = Array.isArray(st.tips) ? st.tips.filter(id => L.some(x => x.id === id)) : [];
  let next = L.find(x => !shown.includes(x.id));
  if (!next) { shown = []; next = L[0]; }                                     // every tip said once: round again
  st.tips = shown.concat(next.id);
  return tipTipItem(next);
}
// The words for a pick saved earlier today (only its kind and code are saved). null = it no longer applies.
function tipWords(p) {
  if (!p || !p.k) return null;
  if (p.k === "new") { const L = ((typeof NOTES !== "undefined" && NOTES && NOTES[p.key]) || []).filter(x => typeof noteForMe !== "function" || noteForMe(x)).filter(tipPlayOk);
    return { k: "new", key: p.key, title: `New in ${p.key}`, text: L[0] || `${APP_NAME} just got an update.`, sub: "", act: "news", go: "See what's new", teaser: `New in ${p.key}!` }; }
  if (p.k === "rem") { const r = tipReminders().find(x => tipBucket(x) === p.key); return r ? tipRemItem(r) : null; }
  const x = tipList().find(y => y.id === p.key); return x ? tipTipItem(x) : null;
}

// ------------------------------------------------------------ WHEN HE SHOWS
function tipAllowed(st) {
  return switchOn("TINY_TIPSTER") && !st.off && !HUB_FIRST_OPEN && st.born !== tipToday() && !(navigator.webdriver && !window.__TIP);
}
const TIP_TAP = "button, a[href], input, select, textarea, label, summary, [role=button], [role=link], [role=tab], [role=switch], [tabindex]:not([tabindex='-1']), [data-qa], [onclick]";
function tipTopAt(x, y) { for (const e of document.elementsFromPoint(x, y)) if (!e.closest("#tipRoot")) return e; return null; }
function tipTappable(e) {
  if (!e || e === document.body || e === document.documentElement) return false;
  if (e.closest(TIP_TAP)) return true;
  try { return getComputedStyle(e).cursor === "pointer"; } catch (x) { return false; }
}
// Home, with nothing on top of it: the Home tab of whichever look, no sheet or page open, nothing laid over the middle of the screen.
function tipOnHome() {
  const b = document.body; if (!b || ["hub-locked", "tour-on", "bx-on"].some(c => b.classList.contains(c))) return false;
  if (typeof TAB !== "undefined" && TAB !== "home") return false;
  if (MODE === "money" && typeof MT_TAB !== "undefined" && MT_TAB !== "home") return false;
  if (MODE === "health" && typeof HW_TAB !== "undefined" && HW_TAB !== "home") return false;
  if ((typeof PT_OPEN !== "undefined" && PT_OPEN) || (typeof CK_OPEN !== "undefined" && CK_OPEN) || (typeof JH_OPEN !== "undefined" && JH_OPEN) || (typeof HH_OPEN !== "undefined" && HH_OPEN)
    || (typeof MH_OPEN !== "undefined" && MH_OPEN) || (typeof FH_OPEN !== "undefined" && FH_OPEN) || (typeof UNI_OPEN !== "undefined" && UNI_OPEN)) return false;
  if ((typeof DT_SCREEN !== "undefined" && DT_SCREEN) || (typeof CT_SCREEN !== "undefined" && CT_SCREEN) || (typeof TT_SCREEN !== "undefined" && TT_SCREEN)   // a new look's full screen,
    || (typeof HT_SCREEN !== "undefined" && HT_SCREEN) || (MODE === "auto" && typeof AT !== "undefined" && AT && (AT.page || AT.car))) return false;          // opened from Home
  if ([...document.querySelectorAll(".sheet:not(.hidden), dialog[open], #stmSheet:not(.hidden), #bxSheet:not(.hidden), #tourSheet:not(.hidden)")].some(e => e.getClientRects().length)) return false;
  const mid = tipTopAt(innerWidth / 2, innerHeight / 2);
  return !!mid && !!mid.closest("#cards, #hero");
}
function tipCalm() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;        // someone is typing
  if (Date.now() - TIP.lastScroll < 900) return false;                         // ...or scrolling
  if ((typeof HP_LIVE !== "undefined" && HP_LIVE) || (typeof HP_RAF !== "undefined" && HP_RAF)) return false;   // the opening glide (shell.js)
  return true;
}

// ------------------------------------------------------------ THE LOOK (injected once, like tour.js)
function tipCss() {
  if (document.getElementById("tipCss")) return;
  const st = document.createElement("style"); st.id = "tipCss";
  st.textContent = `
#tipRoot { position: fixed; left: calc(10px + env(safe-area-inset-left, 0px)); bottom: 90px; z-index: 24; font-family: Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --tc: #f59e0b; --td: #7c3aed; -webkit-tap-highlight-color: transparent; }
#tipRoot.hidden { display: none; }
.tip-peek { display: flex; align-items: center; gap: 6px; transition: transform .28s ease, opacity .2s; }
.tip-face { flex: none; box-sizing: border-box; width: 52px; height: 52px; padding: 0; border-radius: 50%; border: 3px solid #fff; cursor: pointer; display: grid; place-items: center;
  font-size: 25px; line-height: 1; color: #fff; background: radial-gradient(circle at 34% 28%, rgba(255, 255, 255, .55), transparent 42%), linear-gradient(150deg, var(--tc), var(--td));
  box-shadow: 0 6px 16px rgba(0, 0, 0, .35), 0 0 0 3px rgba(255, 255, 255, .25); }
.tip-face span { display: block; transform: translateY(1px); }
.tip-say { position: relative; flex: none; max-width: 150px; padding: 8px 12px; border: 0; border-radius: 16px; background: #fff; color: #1d1b2e; font: inherit; font-size: 14px; font-weight: 800;
  line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; box-shadow: 0 4px 14px rgba(0, 0, 0, .28); }
.tip-say::before { content: ""; position: absolute; left: -6px; top: 50%; margin-top: -6px; border-style: solid; border-width: 6px 7px 6px 0; border-color: transparent #fff transparent transparent; }
.tip-px { flex: none; align-self: flex-start; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; background: rgba(15, 15, 30, .62); color: #fff; font: inherit; font-size: 12px;
  font-weight: 800; line-height: 26px; cursor: pointer; }
#tipRoot.tucked .tip-peek { transform: translateX(calc(-42px - env(safe-area-inset-left, 0px))); }
.tip-face span { transition: transform .28s ease; }
#tipRoot.tucked .tip-face span { transform: translate(15px, 1px) scale(.62); }   /* tucked: his face peeks out of the 20 px left showing */
#tipRoot.tucked .tip-say, #tipRoot.tucked .tip-px { opacity: 0; visibility: hidden; }
#tipRoot.nohit .tip-face { pointer-events: none; }
#tipRoot.open .tip-peek { visibility: hidden; }
.tip-pop .tip-peek { animation: tipPop .55s cubic-bezier(.2, 1.4, .4, 1); }
@keyframes tipPop { from { opacity: 0; transform: translateY(18px) scale(.6); } to { opacity: 1; transform: none; } }
.tip-card { position: absolute; left: 0; bottom: 0; width: min(340px, calc(100vw - 20px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))); box-sizing: border-box;
  max-height: calc(100vh - var(--tipb, 90px) - 24px); overflow-y: auto; overscroll-behavior: contain; padding: 14px 14px 12px; border-radius: 20px; border: 2px solid var(--tc);
  box-shadow: 0 14px 38px rgba(0, 0, 0, .42); animation: tipCard .22s ease-out; }
@keyframes tipCard { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.tip-card[hidden] { display: none; }
.tip-light .tip-card { background: #fff; color: #1d1b2e; }
.tip-dark .tip-card { background: linear-gradient(165deg, var(--td), #0b0a16 88%); color: #fff; }
.tip-chead { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tip-mini { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 16px; background: linear-gradient(150deg, var(--tc), var(--td)); border: 2px solid #fff; }
.tip-chead b { flex: 1; min-width: 0; font-size: 15px; font-weight: 800; }
.tip-x { flex: none; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; }
.tip-light .tip-x { background: #f1f0f6; color: #1d1b2e; } .tip-dark .tip-x { background: rgba(255, 255, 255, .14); color: #fff; }
.tip-title { margin: 0 0 4px; font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--tc); }
.tip-dark .tip-title { filter: brightness(1.25); }
.tip-text { margin: 0; font-size: 16px; line-height: 1.4; font-weight: 600; overflow-wrap: break-word; }
.tip-sub { margin: 4px 0 0; font-size: 14px; line-height: 1.35; opacity: .8; overflow-wrap: break-word; }
.tip-acts { display: flex; gap: 8px; margin-top: 12px; }
.tip-acts button { flex: 1; min-width: 0; min-height: 42px; padding: 8px 10px; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; }
.tip-go { border: 0; background: var(--tc); color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, .35); }
.tip-light .tip-ok { border: 1.5px solid #dcd9e6; background: #fff; color: #3b3850; } .tip-dark .tip-ok { border: 1.5px solid rgba(255, 255, 255, .35); background: transparent; color: #fff; }
.tip-hush { display: block; margin: 10px auto 0; padding: 6px 10px; border: 0; background: none; font: inherit; font-size: 13px; font-weight: 700; text-decoration: underline; cursor: pointer; color: inherit; opacity: .75; }
.whatsnew.tip-flash { outline: 3px solid var(--tc, #f59e0b); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .tip-peek, .tip-face span { transition: none; } .tip-pop .tip-peek, .tip-card { animation: none; } }`;
  document.head.appendChild(st);
}
// His card follows the Hub's look: a page painted a solid colour goes by that colour; otherwise light words on the page = a dark look.
function tipDarkPage() {
  const rgb = c => { const m = String(c).match(/[\d.]+/g); return m ? m.map(Number) : null; }, lum = v => (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255;
  try {
    const s = getComputedStyle(document.body), bg = rgb(s.backgroundColor);
    if (bg && (bg.length < 4 || bg[3] >= 0.95)) return lum(bg) < 0.45;
    const fg = rgb(s.color); return !!fg && lum(fg) > 0.6;
  } catch (e) { return false; }
}

// ------------------------------------------------------------ WHERE HE SITS
// Above every bar fixed to the bottom of the screen that would be under him (a tab bar, its big middle button, the Update bar).
function tipFloor(left, w) {
  if (Date.now() - TIP.floorAt < 2500 && TIP.floor && TIP.floorW === w) return TIP.floor;
  let top = innerHeight;
  const fixed = [...document.querySelectorAll("body *")].filter(e => {
    if (e.id === "toast" || e.closest("#tipRoot") || !e.getClientRects().length) return false;
    try { return getComputedStyle(e).position === "fixed"; } catch (x) { return false; } });
  fixed.forEach(f => [f, ...f.querySelectorAll("*")].forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < innerHeight * 0.55 || r.top >= innerHeight || r.right <= left || r.left >= left + w) return;
    if (r.top < innerHeight * 0.55) return;                                    // a full-screen layer is not a bar
    top = Math.min(top, r.top);
  }));
  TIP.floorAt = Date.now(); TIP.floor = top; TIP.floorW = w;
  return top;
}
// The open card is wider than him, so it looks above whatever is under ITS width.
function tipPlace() {
  const root = TIP.root; if (!root) return;
  const peek = root.querySelector(".tip-peek"), card = root.querySelector(".tip-card"), left = root.getBoundingClientRect().left || 10;
  const w = Math.round(TIP.open && card && !card.hidden ? card.offsetWidth : Math.max(peek ? peek.offsetWidth : 200, 210));
  const b = Math.max(12, Math.round(innerHeight - tipFloor(left, w)) + 10);
  root.style.bottom = `calc(${b}px + ${b <= 12 ? "env(safe-area-inset-bottom, 0px)" : "0px"})`;
  root.style.setProperty("--tipb", b + "px");
}
// Does anything you can tap sit under this box? (sampled every ~14 px)
function tipCovers(r) {
  const cols = Math.max(2, Math.ceil(r.width / 14)), rows = Math.max(2, Math.ceil(r.height / 14));
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
    const x = r.left + 1 + (r.width - 2) * i / cols, y = r.top + 1 + (r.height - 2) * j / rows;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    if (tipTappable(tipTopAt(x, y))) return true;
  }
  return false;
}
// Out in the corner when nothing to tap is under him; tucked into the edge when something is (and then even the sliver lets taps through it).
// The box he takes when out is worked out from the layout (offset sizes), so it is right even while he slides.
function tipTuck() {
  const root = TIP.root; if (!root || TIP.open || root.classList.contains("hidden")) return false;
  const peek = root.querySelector(".tip-peek"), face = root.querySelector(".tip-face"); if (!peek || !face) return false;
  const rr = root.getBoundingClientRect();
  const under = tipCovers({ left: rr.left, top: rr.top, width: Math.min(peek.offsetWidth, innerWidth - rr.left), height: peek.offsetHeight });
  root.classList.toggle("tucked", under);
  root.classList.toggle("nohit", under && tipCovers({ left: 0, top: rr.top, width: Math.max(1, face.offsetWidth - 32), height: face.offsetHeight }));   // the 20 px left showing
  return under;
}
function tipOnScroll() {
  TIP.lastScroll = Date.now();
  if (!TIP.root || TIP.open) return;
  if (!TIP.scrollT) TIP.scrollT = setTimeout(() => { TIP.scrollT = 0; tipTuck(); }, 120);
  clearTimeout(TIP.endT); TIP.endT = setTimeout(tipTuck, 260);
}

// ------------------------------------------------------------ DRAWING HIM
function tipRootEl() {
  if (TIP.root && TIP.root.isConnected) return TIP.root;
  tipCss();
  const L = tipLook(), root = document.createElement("div"); root.id = "tipRoot"; root.className = "hidden";
  root.style.setProperty("--tc", L[1]); root.style.setProperty("--td", L[2]);
  root.addEventListener("click", tipClick);
  document.body.appendChild(root); TIP.root = root;
  return root;
}
function tipPeekHtml(p) {
  const L = tipLook();
  return `<div class="tip-peek"><button type="button" class="tip-face" data-tip="open" aria-label="Tiny Tipster: ${esc(p.teaser)} Tap to read it."><span aria-hidden="true">${L[0]}</span></button>
    <button type="button" class="tip-say" data-tip="open" tabindex="-1" aria-hidden="true">${esc(p.teaser)}</button>
    <button type="button" class="tip-px" data-tip="x" aria-label="Not now">✕</button></div>
    <div class="tip-card" role="dialog" aria-modal="false" aria-label="Tiny Tipster" hidden></div>`;
}
function tipCardHtml(p) {
  const L = tipLook();
  return `<div class="tip-chead"><span class="tip-mini" aria-hidden="true">${L[0]}</span><b>Tiny Tipster</b><button type="button" class="tip-x" data-tip="close" aria-label="Close">✕</button></div>
    <p class="tip-title">${esc(p.title)}</p><p class="tip-text">${esc(p.text)}</p>${p.sub ? `<p class="tip-sub">${esc(p.sub)}</p>` : ""}
    <div class="tip-acts">${p.act ? `<button type="button" class="tip-go" data-tip="go">${esc(p.go || "Show me")}</button>` : ""}<button type="button" class="tip-ok" data-tip="close">Got it</button></div>
    <button type="button" class="tip-hush" data-tip="hush">🤫 Hush - no more tips in ${esc(APP_NAME)}</button>`;
}
function tipShow(p) {
  const root = tipRootEl(), fresh = TIP.pick !== p.key, coming = fresh || root.classList.contains("hidden");
  if (fresh) { root.innerHTML = tipPeekHtml(p); TIP.pick = p.key; }
  TIP.words = p;
  if (coming) {
    const dk = tipDarkPage(); root.classList.toggle("tip-dark", dk); root.classList.toggle("tip-light", !dk);
    root.classList.remove("hidden"); TIP.floorAt = 0; tipPlace(); TIP.placed = Date.now();
    if (!tipTuck()) { root.classList.add("tip-pop"); setTimeout(() => root.classList.remove("tip-pop"), 700); }   // he pops up only where he is out in full
  } else {
    if (Date.now() - (TIP.placed || 0) > 3000) { tipPlace(); TIP.placed = Date.now(); }
    tipTuck();
  }
  TIP.out = true;
}
function tipHide() {
  if (TIP.open) tipCloseCard(true);
  if (TIP.root) TIP.root.classList.add("hidden");
  TIP.out = false;
}
function tipOpenCard() {
  const root = TIP.root, p = TIP.words; if (!root || !p) return;
  const st = tipRead(); st.opened = true; tipWrite(st);
  const card = root.querySelector(".tip-card"); card.innerHTML = tipCardHtml(p); card.hidden = false;
  root.classList.remove("tucked", "nohit"); root.classList.add("open"); TIP.open = true;
  tipPlace();
  const f = card.querySelector(".tip-go") || card.querySelector(".tip-ok"); if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
  TIP.keyFn = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); tipDone(); } };
  TIP.downFn = e => { if (TIP.open && !e.target.closest("#tipRoot")) tipDone(); };           // a tap anywhere else closes it - and still does what it tapped
  document.addEventListener("keydown", TIP.keyFn, true); document.addEventListener("pointerdown", TIP.downFn, true);
}
function tipCloseCard(silent) {
  if (TIP.keyFn) document.removeEventListener("keydown", TIP.keyFn, true);
  if (TIP.downFn) document.removeEventListener("pointerdown", TIP.downFn, true);
  TIP.keyFn = TIP.downFn = null; TIP.open = false;
  if (!silent && TIP.root) { TIP.root.classList.remove("open"); const c = TIP.root.querySelector(".tip-card"); if (c) c.hidden = true; }
}
// Said for today: he goes until tomorrow.
function tipDone() {
  const st = tipRead(); st.day = tipToday(); st.done = true; tipWrite(st);
  tipCloseCard(true); tipStop();
}
function tipGo() {
  const p = TIP.words, act = p && p.act; tipDone(); if (!act) return;
  if (act === "news") { const c = document.querySelector("#cards .whatsnew"); if (c) { c.style.setProperty("--tc", tipLook()[1]); c.scrollIntoView({ behavior: "smooth", block: "center" }); c.classList.add("tip-flash"); setTimeout(() => c.classList.remove("tip-flash"), 2600); } return; }
  if (act.startsWith("tools:")) return bxOpen(act.slice(6));
  if (act.startsWith("cal:")) {                                                // the reminder's own day on this Hub's Calendar
    bxOpen("cal"); const d = act.slice(4);
    if (MODE !== "family" && typeof BX !== "undefined" && /^\d{4}-\d{2}-\d{2}$/.test(d)) { const a = parseDay(tipToday()), b = parseDay(d);
      BX.month = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); BX.day = d; if (typeof bxDraw === "function") bxDraw(); }
    return;
  }
  if (act === "share") return openShareMagic();
  if (act === "tour") return openTour();
  if (act === "data") { openSettings(); setTimeout(() => { const el = document.getElementById("dataBox"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); return; }
  if (act.startsWith("qa:")) return openQA(act.slice(3));
}
function tipHush() {
  const st = tipRead(); st.off = true; st.day = tipToday(); st.done = true; tipWrite(st);
  tipCloseCard(true); tipStop();
  if (typeof toast === "function") toast(`Tiny Tipster is off in ${APP_NAME}. ⚙ Settings turns him back on.`);
}
function tipClick(e) {
  e.stopPropagation();                                                       // the Hub's own tap handlers never see a tap on him
  const b = e.target.closest("[data-tip]"); if (!b) return;
  const a = b.dataset.tip;
  if (a === "open") { if (TIP.root.classList.contains("nohit")) return; return tipOpenCard(); }
  if (a === "x" || a === "close") return tipDone();
  if (a === "go") return tipGo();
  if (a === "hush") return tipHush();
}

// ------------------------------------------------------------ THE LOOP (ui.js tipMaybe calls tipSync on each render too)
function tipStart() {
  if (TIP.iv) return;
  TIP.iv = setInterval(tipSync, 700);
  addEventListener("scroll", tipOnScroll, { passive: true });
  addEventListener("resize", TIP.resizeFn = () => { TIP.floorAt = 0; if (TIP.out) { tipPlace(); tipTuck(); } });
}
function tipStop() {
  clearInterval(TIP.iv); TIP.iv = 0; clearTimeout(TIP.scrollT); clearTimeout(TIP.endT); TIP.scrollT = 0;
  removeEventListener("scroll", tipOnScroll); if (TIP.resizeFn) removeEventListener("resize", TIP.resizeFn);
  if (TIP.open) tipCloseCard(true);
  if (TIP.root) { TIP.root.remove(); TIP.root = null; }
  TIP.out = false; TIP.calm = 0; TIP.pick = null; TIP.words = null;
}
function tipSync() {
  const st = tipRead(), t = tipToday();
  if (!tipAllowed(st)) return tipStop();
  if (st.day !== t) { st.day = t; st.done = false; st.opened = false; st.pick = null; tipWrite(st); }
  if (st.done) return tipStop();
  tipStart();
  if (!tipOnHome()) { if (TIP.open) tipDone(); else tipHide(); TIP.calm = 0; return; }      // opened, then left Home = read
  if (TIP.open) return;
  if (!TIP.out) {                                                              // waiting to come out: a calm Home for a moment first
    if (!tipCalm()) { TIP.calm = 0; return; }
    if (!TIP.calm) TIP.calm = Date.now();
    if (Date.now() - TIP.calm < TIP_WAIT) return;
  }
  let p = null;
  if (st.pick && st.pick.k !== "new" && !st.opened && tipNewsItem(st)) st.pick = null;   // an update came in before he was read: the update goes first
  if (st.pick) p = tipWords(st.pick);
  if (st.pick && !p) { st.done = true; tipWrite(st); return tipStop(); }              // what he had to say no longer applies (a bill paid...): quiet until tomorrow
  if (!p) { p = tipChoose(st); if (!p) { st.done = true; tipWrite(st); return tipStop(); } st.pick = { k: p.k, key: p.key }; tipWrite(st); }
  tipShow(p);
}
