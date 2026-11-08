/* SAVE AS: familymsg.js · LOCATION: C:/MarvelApps/dayhub/familymsg.js
 * FAMILY HUB - MESSAGES (Scott 11/07, ChatGPT's list he called CORE: family messaging, quick check-ins, announcements, threads
 * for Family, Kids, School, Trips and Events). Loaded after family.js, which asks it through fhMod (the registry).
 * Phase A (now): a family message board on the phone or tablet the family shares. "Who's using this phone?" decides who is
 * writing and what is new for them. Phase B (Firebase, FAMILY_SYNC) sends the same messages to everyone's own phone.
 * No location: a check-in is words a person taps ("On my way", "At practice"), never a map or GPS.
 * The Parents conversation is adults only. Ask Family Hub reads announcements only, never the conversations.
 */
"use strict";
const FHM_THREADS = [["family", "🏡", "Family"], ["kids", "🧒", "Kids"], ["school", "🎒", "School"], ["trips", "🧳", "Trips"], ["events", "🎉", "Events"], ["parents", "🔒", "Parents"]];
const FHM_CHECKS = [["omw", "🚗", "On my way"], ["home", "🏠", "Home safe"], ["late", "⏰", "Running late"], ["store", "🛒", "Need anything from the store?"],
  ["kids", "🧒", "Picked up the kids"], ["practice", "⚽", "At practice"], ["work", "💼", "At work"], ["love", "💛", "Love you all"]];
const FHM_REACT = ["❤️", "👍", "😂"];
const FHM_KEEP = 500;          // newest messages kept on the phone
let FHM_TH = "", FHM_SCROLL = false;

const fhmCanSee = th => th !== "parents" || fhAdult();
const fhmThreads = () => FHM_THREADS.filter(([k]) => fhmCanSee(k));
const fhmThread = k => FHM_THREADS.find(x => x[0] === k) || FHM_THREADS[0];
const fhmIn = th => fh().msgs.filter(m => m.th === th);
const fhmChk = m => { const c = FHM_CHECKS.find(x => x[0] === m.chk); return c ? `${c[1]} ${c[2]}` : m.text; };
const fhmText = m => m.chk ? fhmChk(m) : m.text;
function fhmWhen(at) {
  const d = new Date(+at || 0), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, t = today();
  return k === t ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : k === addDays(t, -1) ? "Yesterday" : prettyDate(k);
}
// What's new is per person: each member's own "read up to" time per conversation (S.fh.read[memberId][thread]).
function fhmReadAt(th) { const me = fhMe(); return me ? +((fh().read[me.id] || {})[th] || 0) : Date.now(); }
function fhmUnreadIn(th) { const me = fhMe(), at = fhmReadAt(th); return me ? fhmIn(th).filter(m => +m.at > at && m.by !== me.id).length : 0; }
function fhUnread() { return typeof MODE === "undefined" || MODE !== "family" || !fhSet() ? 0 : fhmThreads().reduce((n, [k]) => n + fhmUnreadIn(k), 0); }   // the Messages tab's badge
function fhmMarkRead(th) { const me = fhMe(), F = fh(); if (!me) return; if (!F.read[me.id] || typeof F.read[me.id] !== "object") F.read[me.id] = {}; F.read[me.id][th] = Date.now(); }
const fhmAnns = () => fh().msgs.filter(m => m.ann && fhmCanSee(m.th) && (!m.until || m.until >= today())).slice(-3).reverse();
function fhmPost(th, vals) {
  const F = fh(), me = fhMe(); if (!me) return null;
  const m = { id: uid(), th, by: me.id, at: Date.now(), re: {}, ...vals }; F.msgs.push(m);
  if (F.msgs.length > FHM_KEEP) F.msgs.splice(0, F.msgs.length - FHM_KEEP);
  fhmMarkRead(th); return m;
}

// ------------------------------------------------------------ the Messages tab
function fhmAnnHtml(m) {
  return `<div class="fhm-ann" style="--tone:${fhColor(m.by)}"><span class="fhm-annic" aria-hidden="true">📣</span><span class="grow"><b>${esc(m.text)}</b>
    <small>${esc(fhName(m.by))} · ${esc(fhmWhen(m.at))}</small></span>${fhAdult() ? `<button class="fh-x" data-fhmannoff="${m.id}" aria-label="Take the announcement down">✕</button>` : ""}</div>`;
}
const fhmChecksHtml = (n, cls = "") => `<div class="fhm-checks ${cls}">${FHM_CHECKS.slice(0, n).map(([k, i, l]) => `<button class="fhm-check" data-fhmchk="${k}"><span aria-hidden="true">${i}</span>${esc(l)}</button>`).join("")}</div>`;
function fhmHtml() {
  if (FHM_TH) return fhmThreadHtml(FHM_TH);
  const me = fhMe(), A = fhmAnns();
  return `${A.length ? `<div class="fhm-anns">${A.map(fhmAnnHtml).join("")}</div>` : ""}
    <div class="mv-sec"><h3>Quick check-in</h3></div>${fhmChecksHtml(FHM_CHECKS.length)}
    <p class="fine">A check-in goes to the Family conversation. Just words - no map, no tracking.</p>
    <div class="mv-sec"><h3>Conversations</h3></div>
    <div class="fhm-threads">${fhmThreads().map(([k, i, l]) => { const L = fhmIn(k), last = L[L.length - 1], n = fhmUnreadIn(k);
      return `<button class="fhm-thread${n ? " new" : ""}" data-fhmth="${k}"><span class="fhm-thic" aria-hidden="true">${i}</span><span class="grow"><b>${esc(l)}${k === "parents" ? " <small>adults only</small>" : ""}</b>
        <small>${last ? `${esc(fhName(last.by))}: ${esc(fhmText(last).slice(0, 60))}` : "No messages yet"}</small></span>${n ? `<i class="fh-badge" aria-label="${n} new">${n > 9 ? "9+" : n}</i>` : last ? `<em>${esc(fhmWhen(last.at))}</em>` : ""}</button>`; }).join("")}</div>
    <p class="fine">${me ? `Writing as ${me.face} ${esc(me.name)} · <button class="mv-linkb fh-link" data-fhtab="who">switch</button>. ` : ""}Messages stay on this phone for now. When sharing is turned on, they reach everyone's phone.</p>`;
}
function fhmMsgHtml(m, me) {
  const mine = !!me && m.by === me.id, re = m.re && typeof m.re === "object" ? m.re : {};
  return `<div class="fhm-msg${mine ? " mine" : ""}${m.ann ? " ann" : ""}${m.chk ? " chk" : ""}" style="--tone:${fhColor(m.by)}">${mine ? "" : fhDot(m.by)}
    <div class="fhm-bub"><small>${mine ? "You" : esc(fhName(m.by))} · ${esc(fhmWhen(m.at))}${m.ann ? " · 📣 announcement" : ""}</small><p>${esc(fhmText(m))}</p>
      <div class="fhm-re">${FHM_REACT.map(e => { const n = Object.values(re).filter(v => v === e).length;
        return `<button class="${me && re[me.id] === e ? "on" : ""}" data-fhmre="${m.id}|${e}" aria-label="${e}${n ? ", " + n : ""}">${e}${n ? ` <small>${n}</small>` : ""}</button>`; }).join("")}
        ${mine || fhAdult() ? `<button class="fhm-del" data-fhmdel="${m.id}" aria-label="Delete this message">🗑️</button>` : ""}</div></div></div>`;
}
function fhmThreadHtml(th) {
  if (!fhmCanSee(th)) { FHM_TH = ""; return fhmHtml(); }
  const T = fhmThread(th), me = fhMe(), L = fhmIn(th).slice(-80);
  return `<button class="mv-linkb fh-link" data-fhmth="">‹ All conversations</button><h3 class="fh-listh">${T[1]} ${esc(T[2])}${th === "parents" ? " <small>adults only</small>" : ""}</h3>
    <div class="fhm-list" role="log" aria-label="${esc(T[2])} messages">${L.length ? L.map(m => fhmMsgHtml(m, me)).join("") : `<p class="hos-hint">Say hi to the family 👋</p>`}</div>
    ${me ? `<form class="fhm-send" data-fhmsend="${th}"><input name="text" placeholder="Message ${esc(T[2])}" maxlength="500" aria-label="Write a message" autocomplete="off">
      <button class="btn sm fh-go" aria-label="Send">Send</button>
      ${fhAdult() ? `<label class="fh-check fhm-annck"><input type="checkbox" name="ann" value="1"> 📣 Announcement - pinned on Today for a week</label>` : ""}</form>` : ""}
    ${th === "family" ? fhmChecksHtml(4, "mini") : ""}`;
}

// ------------------------------------------------------------ taps and the send box
function fhmClick(ds) {
  const F = fh(), me = fhMe();
  if (ds.fhmth !== undefined) { FHM_TH = FHM_THREADS.some(x => x[0] === ds.fhmth) && fhmCanSee(ds.fhmth) ? ds.fhmth : "";
    if (FHM_TH) { fhmMarkRead(FHM_TH); save(); FHM_SCROLL = true; } showFh("msg"); return true; }
  if (ds.fhmchk) { const c = FHM_CHECKS.find(x => x[0] === ds.fhmchk); if (!c || !me) return true;
    fhmPost("family", { text: c[2], chk: c[0] }); save(); render(); if (FH_OPEN) { FHM_SCROLL = FHM_TH === "family"; showFh(); } toast(`${c[1]} Sent to the family`); return true; }
  if (ds.fhmre) { const [id, e] = ds.fhmre.split("|"), m = F.msgs.find(x => x.id === id); if (!m || !me || !FHM_REACT.includes(e) || !fhmCanSee(m.th)) return true;
    if (!m.re || typeof m.re !== "object") m.re = {}; if (m.re[me.id] === e) delete m.re[me.id]; else m.re[me.id] = e; save(); showFh(); return true; }
  if (ds.fhmdel) { const m = F.msgs.find(x => x.id === ds.fhmdel); if (!m || !(fhAdult() || (me && m.by === me.id))) return true;
    F.msgs = F.msgs.filter(x => x.id !== m.id); save(); render(); showFh(); toast("🗑️ Message deleted"); return true; }
  if (ds.fhmannoff) { const m = F.msgs.find(x => x.id === ds.fhmannoff); if (!m || !fhAdult()) return true; m.ann = false; save(); render(); if (FH_OPEN) showFh(); toast("📣 Taken down"); return true; }
  return false;
}
function fhmSubmit(f, data) {
  const th = f.dataset.fhmsend; if (!th) return false;
  const text = fhTxt(data.text, 500); if (!fhMe() || !text || !FHM_THREADS.some(x => x[0] === th) || !fhmCanSee(th)) return true;
  const ann = !!data.ann && fhAdult();
  fhmPost(th, { text, ...(ann ? { ann: true, until: addDays(today(), 7) } : {}) }); FHM_SCROLL = true; save(); render(); showFh("msg");
  if (ann) toast("📣 Pinned on Today for a week");
  const i = document.querySelector('#fhSheet form[data-fhmsend] input[name="text"]'); if (i) i.focus(); return true;
}

// ------------------------------------------------------------ Today's card
function fhmTodayHtml() {
  const A = fhmAnns(), n = fhUnread(), L = fhmThreads().flatMap(([k]) => fhmIn(k)).sort((a, b) => b.at - a.at).slice(0, 2);
  return `<section class="fh-card" aria-label="Messages"><div class="fh-cardh"><h3>💬 Messages${n ? ` <i class="fh-badge">${n > 9 ? "9+" : n} new</i>` : ""}</h3><button data-fhnav="msg">Open ›</button></div>
    ${A.map(fhmAnnHtml).join("")}
    ${L.length ? L.map(m => `<button class="fh-row fhm-mini" data-fhmth="${m.th}" style="--tone:${fhColor(m.by)}">${fhDot(m.by)}<span class="grow"><b>${esc(fhName(m.by))} <small>${fhmThread(m.th)[1]}</small></b>
        <small>${esc(fhmText(m).slice(0, 80))}</small></span><em>${esc(fhmWhen(m.at))}</em></button>`).join("") : `<p class="hos-hint">No messages yet. Say hi, or tap a quick check-in.</p>`}
    ${fhmChecksHtml(3, "mini")}</section>`;
}

fhMod({
  id: "msg",
  tabs: [["msg", "💬", "Messages"]],
  panes: { msg: fhmHtml },
  click: fhmClick,
  submit: fhmSubmit,
  repair: (F, o) => { const ok = m => o(m) && FHM_THREADS.some(x => x[0] === m.th); if (!Array.isArray(F.msgs)) F.msgs = []; else if (!F.msgs.every(ok)) F.msgs = F.msgs.filter(ok); if (!o(F.read)) F.read = {}; },
  forget: id => { const F = fh(); delete F.read[id]; F.msgs.forEach(m => { if (m.re && typeof m.re === "object") delete m.re[id]; }); },
  back: () => { if (FH_TAB === "msg" && FHM_TH) { FHM_TH = ""; return true; } return false; },
  depth: () => FH_TAB === "msg" && FHM_TH ? 1 : 0,
  reset: () => { FHM_TH = ""; },
  after: el => { if (FH_TAB === "msg" && FHM_TH && FHM_SCROLL) { const b = el.querySelector(".sheet-body"); if (b) b.scrollTop = b.scrollHeight; } FHM_SCROLL = false; },
  today: () => [20, fhmTodayHtml()],
  adds: () => [{ icon: "💬", label: "Message", attrs: 'data-fhnav="msg"', tone: "#2e86de" }],
  pulse: add => { const n = fhUnread(); if (n) add(9, "💬", `${n} new message${n === 1 ? "" : "s"}`, null); },
  context: () => ({ announcements: fhmAnns().map(m => ({ from: fhName(m.by), text: m.text })) })
});
