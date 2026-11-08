/* SAVE AS: familysync.js · LOCATION: C:/MarvelApps/dayhub/familysync.js
 * FAMILY HUB - SHARING BETWEEN PHONES (Phase B; Scott 11/07: "Phase B: all phones"; Firebase chosen 10/25 "A", set up 11/07 on the
 * Day Hub Google project day-hub-510322, Spark plan). Loaded after familylife.js; the Firebase code itself loads only when this phone
 * turns sharing on or joins (nothing leaves a phone that never shares). No accounts: each phone signs in anonymously; the owner can
 * link Google only to get the family back on a new phone. Kids never sign in (they use a parent's phone or the family tablet).
 *
 * HOW THE FAMILY TRAVELS (cheap on Firebase's free plan: a handful of documents per family, not one per item):
 *   families/{fid}                    owner, the phones (uid -> member + role), created, paid (set by the shop later, never by a phone)
 *   families/{fid}/all/{part}         what everyone in the family may see (guests included): people, plan, photos, reads, msgs-YYYY-MM
 *   families/{fid}/adults/{part}      parents only: adults-only events and to-dos, the Parents talk, allowances paid, the emergency card,
 *                                     profile parts shared "Parents only" or with picked people. A guest's phone can't read these.
 *   "Only me" never leaves the phone. Documents stay on each phone. Photos travel at a smaller size (no paid Storage needed).
 *   invites/{code}                    a 10-character code for one person, made by the owner, good for 2 days, used once.
 * Each document holds r: { "kind~id": record }; each record is written whole (mergeFields), so two phones editing different things never
 * overwrite each other, a field taken out of a record (a birthday made "Parents only") really leaves the shared copy, and the same
 * thing edited on two phones: the newer edit wins. A record gone from the server that this phone had agreed on before was deleted on
 * another phone - unless a part suddenly lost most of its records (then nothing is deleted and this phone puts them back).
 * What this phone last agreed on is kept as short fingerprints (FHS.shadow); S.fh carries the family's id (sid) and a sync count (sv),
 * so a restored backup or Undo never reads as "everything since was deleted".
 * Firestore security rules: docs/hub_improvement/familyhub/firestore.rules (they decide who reads what; the app only follows them).
 * Reviewed 11/07 (17 findings, all fixed; see FAMILY_HUB_PHASE_B_STATUS_2026-11-07.md).
 */
"use strict";
const FHS_CONFIG = { apiKey: "AIzaSyCnLXutctuOrDHc2fKuy6c0rdOmUR62e7Y", authDomain: "day-hub-510322.firebaseapp.com", projectId: "day-hub-510322",
  storageBucket: "day-hub-510322.firebasestorage.app", messagingSenderId: "750311262064", appId: "1:750311262064:web:d3119089f8c4249f77f1b5" };   // public IDs; no measurementId - Family Hub never loads Analytics
const FHS_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const FHS_KEY = "familyhub.sync";            // this phone's own sharing state: never in the family data, never in the backup
const FHS_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FHS_INVITE_DAYS = 2;
const FHS_OKID = /^[\w-]{1,64}$/;
let FHS = fhsLoad();                          // { fid, uid, shadow, img, first, sv } while this phone is in a shared family
let FHS_REMOTE = {}, FHS_GOT = new Set(), FHS_DEAD = new Set(), FHS_UNSUB = [], FHS_LIVE = [], FHS_T = 0, FHS_RUN = false, FHS_AGAIN = false;
let FHS_STATE = FHS ? "starting" : "off", FHS_ERR = "", FHS_LAST = 0, FHS_FAM = null, FHS_INV = null, FHS_NET0 = null, FHS_GOOGLE = false, FHS_ASK = "";
let FHS_SAVE0 = null, FHS_ROLESEEN = null, FHS_ROLEDIRTY = new Set(), FHS_MISS = new Map(), FHS_DIRTY = false, FHS_PAINTED = "", FHS_RETRY = 0;

function fhsLoad() { try { const x = JSON.parse(localStorage.getItem(FHS_KEY) || "null"); return x && typeof x === "object" && typeof x.fid === "string" && typeof x.uid === "string" ? x : null; } catch (e) { return null; } }
function fhsStore() { try { if (FHS) localStorage.setItem(FHS_KEY, JSON.stringify(FHS)); else localStorage.removeItem(FHS_KEY); } catch (e) { /* storage full or blocked */ } }
const fhsSwitch = () => typeof switchOn !== "function" || switchOn("FAMILY_SYNC");
const fhsMine = () => FHS_FAM && FHS && FHS_FAM.members ? FHS_FAM.members[FHS.uid] : null;
const fhsAdult = () => { const m = fhsMine(); return !!m && (m.role === "owner" || m.role === "adult"); };
const fhsOwner = () => !!(FHS_FAM && FHS && FHS_FAM.owner === FHS.uid);

// ------------------------------------------------------------ the one place that talks to Firebase (tests put a fake in window.FHS_FAKE)
function fhsNet() {
  if (typeof window !== "undefined" && window.FHS_FAKE) return window.FHS_FAKE;
  if (FHS_NET0) return FHS_NET0;
  const load = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = FHS_SDK + src; s.onload = ok; s.onerror = () => no(new Error("offline")); document.head.appendChild(s); });
  let app, db, auth, ready = null;
  const ref = p => db.doc(p), FV = () => firebase.firestore.FieldValue, val = v => v === null ? FV().delete() : v;
  FHS_NET0 = {
    async start() {
      if (!ready) ready = (async () => {
        if (!window.firebase || !firebase.firestore || !firebase.auth) { await load("firebase-app-compat.js"); await load("firebase-auth-compat.js"); await load("firebase-firestore-compat.js"); }
        const emu = window.FHS_EMU && typeof window.FHS_EMU === "object" ? window.FHS_EMU : null;   // tests only: Firebase's local emulator, never the real project
        app = firebase.apps.find(a => a.name === "familyhub") || firebase.initializeApp(emu ? { ...FHS_CONFIG, projectId: emu.project, apiKey: "emulator" } : FHS_CONFIG, "familyhub");
        auth = app.auth(); db = app.firestore(); try { db.settings({ ignoreUndefinedProperties: true }); } catch (e) { /* already set */ }
        if (emu) { auth.useEmulator("http://127.0.0.1:9099"); db.useEmulator("127.0.0.1", 8085); }
        await new Promise(r => { const u = auth.onAuthStateChanged(() => { u(); r(); }); });
        if (!auth.currentUser) await auth.signInAnonymously();
      })();
      try { await ready; } catch (e) { ready = null; throw e; }
      return { uid: auth.currentUser.uid, google: auth.currentUser.providerData.some(p => p && p.providerId === "google.com") };
    },
    // Only answers from the server count: offline, the SDK would answer "no such document" from its empty cache. Metadata changes are
    // asked for, so a part that doesn't exist yet still gets the server's "still empty" (found in the live check 11/07: without it a
    // new phone waited forever on last month's messages).
    listen: (p, cb, bad) => ref(p).onSnapshot({ includeMetadataChanges: true }, s => { if (s.metadata && s.metadata.fromCache) return; cb(s.exists ? s.data() : null); }, e => { if (bad) bad(e); }),
    get: async p => { const s = await ref(p).get({ source: "server" }); return s.exists ? s.data() : null; },
    set: (p, d) => ref(p).set(d),
    patch: (p, ch) => { const r = {}, f = []; Object.keys(ch).forEach(k => { r[k] = val(ch[k]); f.push(new firebase.firestore.FieldPath("r", k)); }); return ref(p).set({ r }, { mergeFields: f }); },
    update: (p, d) => { const x = {}; Object.keys(d).forEach(k => { x[k] = val(d[k]); }); return ref(p).update(x); },
    batch: async ops => { const b = db.batch(); ops.forEach(o => { if (o.op === "update") { const x = {}; Object.keys(o.d).forEach(k => { x[k] = val(o.d[k]); }); b.update(ref(o.p), x); } else if (o.op === "del") b.delete(ref(o.p)); }); await b.commit(); },
    del: p => ref(p).delete(),
    now: () => FV().serverTimestamp(),
    ts: ms => firebase.firestore.Timestamp.fromMillis(ms),
    ms: t => t && typeof t.toMillis === "function" ? t.toMillis() : +t || 0,
    newId: () => db.collection("families").doc().id,
    ownerOf: async uid => { const q = await db.collection("families").where("owner", "==", uid).limit(1).get(); return q.empty ? null : q.docs[0].id; },
    google: async link => { const pv = new firebase.auth.GoogleAuthProvider(); if (link) await auth.currentUser.linkWithPopup(pv); else await auth.signInWithPopup(pv); return auth.currentUser.uid; }
  };
  return FHS_NET0;
}

// ------------------------------------------------------------ fingerprints (the same record always gives the same text, whatever the key order)
const fhsJson = v => Array.isArray(v) ? `[${v.map(fhsJson).join(",")}]` : v && typeof v === "object"
  ? `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + fhsJson(v[k])).join(",")}}` : JSON.stringify(v === undefined ? null : v);
const fhsHash = v => { const s = fhsJson(v); let a = 0x811c9dc5, b = 0x9747b28c ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); } return (a >>> 0).toString(36) + (b >>> 0).toString(36); };

// ------------------------------------------------------------ the family -> records (what goes where)
const fhsAudOf = to => to === "me" ? "" : !to || to === "all" ? "all" : "adults";
const fhsMonth = at => { const d = new Date(+at || 0); return `msgs-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const fhsCopy = (o, drop) => { const c = {}; Object.keys(o).forEach(k => { if (!drop.includes(k) && o[k] !== undefined) c[k] = o[k]; }); return c; };
const FHS_TREE_F = ["interests", "bio", "school", "phone", "place", "facts", "story", "heritage"];
function fhsExport(adult) {
  const F = fh(), out = {}, put = (aud, part, k, v) => { if (aud) out[k] = [`${aud}/${part}`, v]; };
  out["fam~1"] = ["all/people", { name: F.name || "" }];
  F.members.forEach(m => {
    const a = fhsAudOf(fhShareOf(m.id, "bday").to);
    put("all", "people", "mem~" + m.id, fhsCopy(m, a === "all" ? [] : ["bday"]));
    if (a === "adults" && m.bday) put("adults", "people", "memx~" + m.id, { bday: m.bday });
  });
  F.relatives.forEach(r => put("all", "people", "rel~" + r.id, fhsCopy(r, [])));
  Object.entries(F.tree || {}).forEach(([id, t]) => { if (!t || typeof t !== "object") return;
    const mem = fhMem(id), base = fhsCopy(t, ["pic", ...FHS_TREE_F]), extra = {};
    FHS_TREE_F.forEach(f => { if (t[f] === undefined) return; const a = mem ? fhsAudOf(fhShareOf(id, f).to) : "all";
      if (a === "all") base[f] = t[f]; else if (a === "adults") extra[f] = t[f]; });
    put("all", "people", "tree~" + id, base); if (Object.keys(extra).length) put("adults", "people", "treex~" + id, extra); });
  Object.entries(F.share || {}).forEach(([id, x]) => { if (x && typeof x === "object") put("all", "people", "share~" + id, x); });
  Object.entries(F.read || {}).forEach(([mid, x]) => { if (x && typeof x === "object") Object.entries(x).forEach(([th, at]) => put("all", "reads", `read~${mid}|${th}`, { at: +at || 0 })); });
  if (adult) { put("adults", "people", "card~1", F.card); if (F.card && F.card.guests) put("all", "people", "cardg~1", F.card); }   // only a parent's phone sends the card
  F.events.forEach(e => put(e.vis === "adults" ? "adults" : "all", "plan", "ev~" + e.id, e));
  F.todos.forEach(x => put(x.vis === "adults" ? "adults" : "all", "plan", "td~" + x.id, x));
  F.chores.forEach(c => { put("all", "plan", "ch~" + c.id, fhsCopy(c, ["log"])); Object.entries(c.log || {}).forEach(([d, l]) => { if (l) put("all", "plan", `clog~${c.id}|${d}`, l); }); });
  F.payouts.forEach(p => put("adults", "plan", "pay~" + p.id, p));
  F.lists.forEach(l => { put("all", "plan", "ls~" + l.id, fhsCopy(l, ["items"])); l.items.forEach(i => { if (i && i.id) put("all", "plan", `it~${l.id}|${i.id}`, i); }); });
  [["recipes", "rec"], ["hw", "hw"], ["pickups", "pk"], ["pets", "pet"], ["goals", "goal"]].forEach(([k, p]) => (F[k] || []).forEach(x => put("all", "plan", `${p}~${x.id}`, x)));
  Object.entries(F.meals || {}).forEach(([d, x]) => { if (x) put("all", "plan", "meal~" + d, x); });
  (F.albums || []).forEach(a => put("all", "photos", "alb~" + a.id, a));
  (F.photos || []).forEach(p => put(fhsAudOf(p.to), "photos", "ph~" + p.id, p));
  (F.msgs || []).forEach(m => { const aud = m.th === "parents" ? "adults" : "all", part = fhsMonth(m.at);
    put(aud, part, "m~" + m.id, fhsCopy(m, ["re"])); Object.entries(m.re || {}).forEach(([who, e]) => put(aud, part, `re~${m.id}|${who}`, { e })); });
  return out;
}

// ------------------------------------------------------------ records -> the family (keeps what never travels: who's using this phone,
// Grandparent Mode, the PIN, Documents, "Only me" photos and profile parts, profile pictures). Anything that arrives with an id or a date
// that isn't one is dropped here, before it can reach the page.
function fhsBuild(flat, adult) {
  const F = fh(), by = {}, meId = F.me || "", ok = x => typeof x === "string" && FHS_OKID.test(x);
  Object.keys(flat).forEach(k => { const i = k.indexOf("~"), v = flat[k][1]; if (i < 1 || !v || typeof v !== "object") return; (by[k.slice(0, i)] = by[k.slice(0, i)] || []).push([k.slice(i + 1), v]); });
  const L = kind => (by[kind] || []).filter(([id]) => ok(id)).map(([id, v]) => [id, v]);
  const R = kind => L(kind).map(([id, v]) => ({ ...v, id }));                  // array records: the id is the key's, always
  const M = kind => Object.fromEntries(L(kind));
  const P = kind => (by[kind] || []).map(([k, v]) => [k.split("|"), v]).filter(([p]) => p.length === 2 && ok(p[0]) && (ok(p[1]) || fhIsD(p[1])));
  const keepOrder = (old, list) => { const ix = new Map(old.map((x, i) => [x.id, i])); return list.sort((a, b) => (ix.has(a.id) ? ix.get(a.id) : 1e6 + (+a.at || 0)) - (ix.has(b.id) ? ix.get(b.id) : 1e6 + (+b.at || 0))); };
  const fam = M("fam")["1"]; if (fam && typeof fam.name === "string" && fam.name) F.name = fam.name.slice(0, 40);
  // A parent's phone keeps what it knew of a person beyond the shared copy; a guest's keeps that only for its own person.
  const keepOld = (id, old) => adult || id === meId ? (old || {}) : {};
  const mx = adult ? M("memx") : {}, om = new Map(F.members.map(m => [m.id, m]));
  F.members = keepOrder(F.members, L("mem").map(([id, v]) => ({ ...keepOld(id, om.get(id)), ...v, ...(mx[id] || {}), id })));
  const orel = new Map(F.relatives.map(r => [r.id, r]));
  F.relatives = keepOrder(F.relatives, L("rel").map(([id, v]) => ({ ...(orel.get(id) || {}), ...v, id })));
  const tx = adult ? M("treex") : {}, ot = F.tree || {}; F.tree = {};
  L("tree").forEach(([id, v]) => { const o = ot[id] || {}; F.tree[id] = { ...(adult || id === meId ? o : o.pic ? { pic: o.pic } : {}), ...v, ...(tx[id] || {}) }; });
  F.share = M("share");
  F.read = {}; P("read").forEach(([[mid, th], v]) => { (F.read[mid] = F.read[mid] || {})[th] = +v.at || 0; });
  const card = adult ? M("card")["1"] || M("cardg")["1"] : M("cardg")["1"];
  if (card) F.card = { ...card }; else if (!adult) F.card = { meet: "", plan: "", sitter: "", doctor: "", guests: false, contacts: [] };   // guests: only what the parents allow
  F.events = keepOrder(F.events, R("ev").filter(e => fhIsD(e.date)));
  F.todos = keepOrder(F.todos, R("td"));
  const logs = {}; P("clog").forEach(([[cid, d], v]) => { if (fhIsD(d)) (logs[cid] = logs[cid] || {})[d] = v; });
  F.chores = keepOrder(F.chores, R("ch").map(c => ({ ...c, log: logs[c.id] || {} })));
  F.payouts = adult ? keepOrder(F.payouts, R("pay")) : [];
  const items = {}, oldItems = new Map(F.lists.map(l => [l.id, l.items.map(i => i.id)]));
  P("it").forEach(([[lid, iid], v]) => { if (ok(iid)) (items[lid] = items[lid] || []).push({ ...v, id: iid }); });
  F.lists = keepOrder(F.lists, R("ls").map(l => ({ ...l, items: keepOrder((oldItems.get(l.id) || []).map(x => ({ id: x })), items[l.id] || []) })));
  [["recipes", "rec"], ["hw", "hw"], ["pickups", "pk"], ["pets", "pet"], ["goals", "goal"]].forEach(([k, p]) => { F[k] = keepOrder(F[k] || [], R(p)); });
  F.meals = {}; (by.meal || []).forEach(([d, v]) => { if (fhIsD(d)) F.meals[d] = v; });
  F.albums = keepOrder(F.albums || [], R("alb"));
  // "Only me" photos stay as they are; so does a guest's own "Parents only" photo (it can't be sent from a guest's phone)
  const stay = (F.photos || []).filter(p => !fhsAudOf(p.to) || (!adult && fhsAudOf(p.to) === "adults" && p.by === meId));
  F.photos = R("ph").filter(p => !stay.some(x => x.id === p.id)).concat(stay).sort((a, b) => (+b.at || 0) - (+a.at || 0));
  const re = {}; P("re").forEach(([[mid, who], v]) => { if (ok(who)) (re[mid] = re[mid] || {})[who] = v.e; });
  F.msgs = R("m").map(m => ({ ...m, re: re[m.id] || {} })).sort((a, b) => (+a.at || 0) - (+b.at || 0));
  FH_FIXED = null; fh();                                                           // repair (and re-check) what arrived, once
}

// ------------------------------------------------------------ the merge: this phone's copy, the server's, and what both last agreed on
function fhsRemoteFlat() {
  const out = {}, pre = `families/${FHS.fid}/`;
  Object.entries(FHS_REMOTE).forEach(([path, d]) => { if (!d || !d.r || typeof d.r !== "object") return; const part = path.slice(pre.length);
    Object.entries(d.r).forEach(([k, v]) => { if (v && typeof v === "object") out[k] = [part, v]; }); });
  return out;
}
function fhsSoon(ms) { if (!FHS) return; clearTimeout(FHS_T); FHS_T = setTimeout(fhsSync, ms == null ? 500 : ms); }
// Members whose role this phone changed (or removed) - only those reach the phones' access (fhsRoles), and only from the owner's phone.
function fhsRoleWatch() {
  const now = new Map(fhMembers().map(m => [m.id, m.role]));
  if (FHS_ROLESEEN) { now.forEach((r, id) => { if (FHS_ROLESEEN.has(id) && FHS_ROLESEEN.get(id) !== r) FHS_ROLEDIRTY.add(id); }); FHS_ROLESEEN.forEach((r, id) => { if (!now.has(id)) FHS_ROLEDIRTY.add(id); }); }
}
async function fhsSync() {
  if (!FHS || FHS_STATE === "removed") return;
  if (FHS_RUN) { FHS_AGAIN = true; return; }
  if (!FHS_LIVE.length || FHS_LIVE.some(p => !FHS_GOT.has(p))) return;           // wait for every part's first answer from the server
  if (FHS_FAM && !FHS_LIVE.some(p => p.endsWith("/all/" + fhsMonth(Date.now())))) { fhsParts(FHS_FAM, true); return; }   // a new month: listen to it first
  FHS_RUN = true; const run = FHS;
  try {
    let F = fh(); const pre = `families/${FHS.fid}/`, adult = fhsAdult();
    // A copy of the family that didn't come from sharing (a backup restored, Undo): never read as "everything since was deleted".
    if ((F.sid || "") !== FHS.fid) { S.fh = { setup: F.setup || today(), name: "", me: (fhsMine() || {}).m || "", pin: F.pin, big: F.big, sid: FHS.fid, members: [], lists: [] }; FH_FIXED = null; F = fh(); FHS.shadow = {}; }
    else if ((+F.sv || 0) < (+FHS.sv || 0)) FHS.shadow = {};
    fhsRoleWatch();
    const live = new Set(FHS_LIVE.filter(p => !FHS_DEAD.has(p)).map(p => p.slice(pre.length))), first = !!FHS.first;
    const local = fhsExport(adult), remote = fhsRemoteFlat(), sh = FHS.shadow || {}, sh2 = {}, merged = {}, writes = {};
    // A part that suddenly lost most of what it had (blanked by someone, or a bad answer) deletes nothing here; this phone puts it back.
    const had = {}, has = {};
    Object.keys(sh).forEach(k => { had[sh[k][0]] = (had[sh[k][0]] || 0) + 1; if (remote[k]) has[sh[k][0]] = (has[sh[k][0]] || 0) + 1; });
    const suspect = new Set(Object.keys(had).filter(p => had[p] >= 8 && (has[p] || 0) < had[p] * .5));
    let changed = false;
    const w8 = (part, k, v) => { (writes[part] = writes[part] || {})[k] = v; };
    new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(sh)]).forEach(k => {
      const l = local[k], r = remote[k], s = sh[k], part = (l || r || s)[0];
      if (!adult && part.startsWith("adults/")) { if (l && /^(ev|td|m|re|pay|memx|treex|ph)~/.test(k) && !(k.startsWith("ph~") && l[1].by === F.me)) changed = true; return; }   // a guest's phone keeps nothing that's for parents only
      if (!first && !live.has(part) && !(r && live.has(r[0]))) { if (l) merged[k] = l; if (s) sh2[k] = s; return; }   // a part nobody is watching (an older month): left as it is
      const lh = l ? fhsHash(l[1]) : "", rh = r ? fhsHash(r[1]) : "", sH = s ? s[1] : "";
      let w;
      if (r && rh !== sH) w = l && lh !== sH && lh !== rh && (+l[1].at || 0) > (+r[1].at || 0) ? l : r;    // changed on another phone: the newer edit wins
      else if (!r && s) w = (l && lh !== sH) || (l && suspect.has(s[0])) ? l : null;                       // deleted on another phone (unless changed here since, or the part looks wiped)
      else w = l || null;                                                                                   // new here, or only changed here
      if (w) {
        merged[k] = w; sh2[k] = [w[0], w === l ? lh : rh];
        if (!r || r[0] !== w[0] || (w === l && lh !== rh)) w8(w[0], k, w[1]);
        if (r && r[0] !== w[0]) w8(r[0], k, null);
        if (w !== l && (!l || lh !== rh)) changed = true;
      } else { if (r) w8(r[0], k, null); if (l || s) changed = true; }   // gone: whatever this phone built from it goes too
    });
    if (changed) fhsBuild(merged, adult);
    const net = fhsNet(), failed = new Set();
    for (const part of Object.keys(writes)) {
      const ch = writes[part]; let size = 0, chunk = {};
      try {
        for (const k of Object.keys(ch)) { chunk[k] = ch[k]; size += k.length + (ch[k] ? fhsJson(ch[k]).length : 4);
          if (size > 400000) { await net.patch(pre + part, chunk); chunk = {}; size = 0; } }
        if (Object.keys(chunk).length) await net.patch(pre + part, chunk);
      } catch (e) { failed.add(part); if (/permission|denied/i.test(String(e && (e.code || e.message)))) throw e; FHS_ERR = String(e && (e.message || e)); }   // one part too big or busy: the others still go
    }
    if (FHS !== run) return;                                                         // left or taken off meanwhile: nothing more to keep
    Object.keys(sh2).forEach(k => { if (failed.has(sh2[k][0])) { if (sh[k]) sh2[k] = sh[k]; else delete sh2[k]; } });   // what didn't go is tried again next time
    FHS.shadow = sh2; FHS.first = false;
    if (changed || Object.keys(writes).length) { FHS.sv = (+FHS.sv || 0) + 1; fh().sv = FHS.sv; fh().sid = FHS.fid; if (FHS_SAVE0) FHS_SAVE0(); else saveLocal(); }   // only when something moved
    fhsStore();
    FHS_ROLESEEN = new Map(fhMembers().map(m => [m.id, m.role]));
    if (changed) fhsPaint();
    await fhsImages(merged);
    await fhsRoles();
    if (FHS !== run) return;
    FHS_STATE = failed.size ? "offline" : "ok"; if (!failed.size) FHS_ERR = ""; FHS_LAST = Date.now(); if (failed.size) fhsSoon(30000);
  } catch (e) { if (FHS !== run) return; FHS_STATE = /permission|denied/i.test(String(e && (e.code || e.message))) ? "denied" : "offline"; FHS_ERR = String(e && (e.message || e)); fhsSoon(30000); }
  finally { FHS_RUN = false; if (FHS_AGAIN) { FHS_AGAIN = false; fhsSoon(50); } fhsPaintShare(); }
}
// The owner's phone keeps each phone's access in step - but only for the people the owner changed on this phone (never because of an
// edit that arrived from another phone: a guest can't make themself an adult). A phone follows its person's role; a removed person's
// phone is taken off. The server's rules read these roles, so this is what decides access.
async function fhsRoles() {
  if (!fhsOwner() || !FHS_ROLEDIRTY.size) return;
  const ch = {};
  Object.entries(FHS_FAM.members || {}).forEach(([uid, p]) => { if (uid === FHS.uid || !p || !FHS_ROLEDIRTY.has(p.m)) return; const m = fhMem(p.m);
    if (!m) { ch[`members.${uid}`] = null; return; }
    const role = m.role === "adult" || m.role === "owner" ? "adult" : "guest"; if (p.role !== role) ch[`members.${uid}`] = { ...p, role }; });
  if (Object.keys(ch).length) await fhsNet().update(`families/${FHS.fid}`, ch);
  FHS_ROLEDIRTY.clear();
}
// Redraw after news from another phone - never under someone's fingers: while a form is open or half filled, only Today redraws.
function fhsPaint() {
  const a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#fhSheet, #cards");
  if (typing) { a.addEventListener("blur", () => setTimeout(fhsPaint, 0), { once: true }); return; }
  render();
  if (FH_OPEN && !FH_EDIT && !FHS_DIRTY) { if (FH_TAB === "share") fhsPaintShare(); else showFh(); }
}
// The Share page redraws only when what it shows changed, and keeps what was picked or typed (a choice lost mid-tap = a code for the wrong person).
function fhsPaintShare() {
  if (!(FH_OPEN && FH_TAB === "share")) return;
  const a = document.activeElement; if (a && a.closest && a.closest("#fhSheet form")) return;
  if (fhsShareHtml0() === FHS_PAINTED) return;
  const keep = [...document.querySelectorAll("#fhSheet form [name]")].map(el => [el.closest("form").getAttribute("class") + "|" + el.name, el.value]);
  showFh();
  keep.forEach(([k, v]) => { const [cls, n] = k.split("|"), el = [...document.querySelectorAll(`#fhSheet form [name="${n}"]`)].find(x => x.closest("form").getAttribute("class") === cls); if (el && v) el.value = v; });
}
if (typeof document !== "undefined") document.addEventListener("input", e => { if (e.target && e.target.closest && e.target.closest("#fhSheet form")) FHS_DIRTY = true; });

// ------------------------------------------------------------ photos travel at a smaller size, each in its own document, fetched once per phone
const fhsImgPath = (aud, id) => `families/${FHS.fid}/${aud}/img-${id}`;
function fhsSmaller(dataUrl, max, q) {
  return new Promise((ok, no) => { const i = new Image(); i.onload = () => { const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(i.width * k)); c.height = Math.max(1, Math.round(i.height * k)); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", q)); };
    i.onerror = () => no(new Error("not a photo")); i.src = dataUrl; });
}
async function fhsImages(merged) {
  if (typeof fhpGet !== "function" || !FHS) return;
  const net = fhsNet(), img = FHS.img || (FHS.img = {}), want = {};
  Object.keys(merged).forEach(k => { if (k.startsWith("ph~")) want[k.slice(3)] = merged[k][0].split("/")[0]; });
  for (const [id, aud] of Object.entries(want)) {
    if (img[id] === aud || !FHS_OKID.test(id)) continue;
    let d = null; try { d = await fhpGet(id); } catch (e) { d = null; }
    if (!d) continue;                                                                 // not on this phone yet: the phone that has it sends it
    try { const small = await fhsSmaller(d, 1200, .72); if (small.length < 900000) await net.set(fhsImgPath(aud, id), { d: small, at: Date.now() }); } catch (e) { continue; }
    if (img[id] && img[id] !== aud) { try { await net.del(fhsImgPath(img[id], id)); } catch (e) { /* already gone */ } }
    img[id] = aud;
  }
  for (const [id, aud] of Object.entries(img)) if (!want[id]) { try { await net.del(fhsImgPath(aud, id)); } catch (e) { /* not ours to delete, or gone */ } delete img[id]; }
  fhsStore();
}
// familyphotos.js asks for a picture this phone doesn't have yet: get it once, keep it on the phone (a miss isn't asked again for 10 minutes).
async function fhsFetchImg(id) {
  if (!FHS || typeof fhpIdb !== "function" || !FHS_OKID.test(String(id))) return null;
  const p = (fh().photos || []).find(x => x.id === id); if (!p) return null;
  const aud = fhsAudOf(p.to); if (!aud || (aud === "adults" && !fhsAdult())) return null;
  if (Date.now() - (FHS_MISS.get(id) || 0) < 6e5) return null;
  try { const x = await fhsNet().get(fhsImgPath(aud, id)); if (!x || typeof x.d !== "string" || !x.d.startsWith("data:image/")) { FHS_MISS.set(id, Date.now()); return null; }
    const small = await fhsSmaller(x.d, 360, .8); await fhpIdb("readwrite", s => { s.put(x.d, id); return s.put(small, id + "_t"); });
    (FHS.img || (FHS.img = {}))[id] = aud; fhsStore(); return x.d;                  // fetched, so this phone never sends it back
  } catch (e) { FHS_MISS.set(id, Date.now()); return null; }
}

// ------------------------------------------------------------ listening: the family's parts this phone may read
function fhsStopListening() { FHS_UNSUB.forEach(u => { try { u(); } catch (e) { /* gone */ } }); FHS_UNSUB = []; FHS_LIVE = []; FHS_GOT = new Set(); FHS_DEAD = new Set(); FHS_REMOTE = {}; }
// Which parts this phone listens to: the shared ones, the parents' ones on a parent's phone, this month's and last month's messages.
function fhsParts(d, force) {
  const famPath = `families/${FHS.fid}`, mine = d.members[FHS.uid], adult = mine.role === "owner" || mine.role === "adult", prev = new Date(); prev.setDate(0);
  const parts = ["people", "plan", "photos", fhsMonth(Date.now()), fhsMonth(prev.getTime())];
  const want = parts.map(x => `${famPath}/all/${x}`).concat(["reads"].map(x => `${famPath}/all/${x}`), adult ? parts.map(x => `${famPath}/adults/${x}`) : []);
  if (!force && want.join() === FHS_LIVE.join()) return;
  const net = fhsNet();
  FHS_UNSUB.splice(1).forEach(u => { try { u(); } catch (e) { /* gone */ } }); FHS_LIVE = want; FHS_GOT = new Set(); FHS_DEAD = new Set(); FHS_REMOTE = {};
  // A failed answer is never taken as an empty family (that would read as "everything was deleted"): the part stays as last seen,
  // it is marked dead (left out of the merge, so its old copy can't undo this phone's edits) and listened to again.
  want.forEach(p => FHS_UNSUB.push(net.listen(p, x => { if (!FHS || !FHS_LIVE.includes(p)) return; FHS_REMOTE[p] = x; FHS_GOT.add(p); FHS_DEAD.delete(p); fhsSoon(120); },
    e => { if (!FHS || !FHS_LIVE.includes(p)) return; FHS_DEAD.add(p); FHS_STATE = "offline"; FHS_ERR = String(e && (e.code || e.message)); fhsRetry(); fhsPaintShare(); })));
}
async function fhsListen() {
  if (!FHS) return;
  fhsStopListening(); FHS_STATE = "starting";
  let me; try { me = await fhsNet().start(); } catch (e) { FHS_STATE = "offline"; FHS_ERR = String(e && e.message || e); fhsRetry(); fhsPaintShare(); return; }
  FHS_GOOGLE = !!me.google;
  if (me.uid !== FHS.uid) { FHS_STATE = "denied"; FHS_ERR = "This phone signed in again as someone new. Join again with a code."; fhsPaintShare(); return; }
  const net = fhsNet(), famPath = `families/${FHS.fid}`;
  FHS_UNSUB.push(net.listen(famPath, d => {
    if (!FHS) return;
    if (!d || !d.members || !d.members[FHS.uid]) { fhsRemoved(); return; }
    FHS_FAM = d; fhsParts(d); fhsPaintShare();
  }, e => { if (!FHS) return; const denied = /permission|denied/i.test(String(e && (e.code || e.message)));
    if (denied && FHS_FAM) { fhsRemoved(); return; }                                // was in the family, now turned away: taken off
    FHS_STATE = denied ? "denied" : "offline"; FHS_ERR = String(e && (e.code || e.message)); if (!denied) fhsRetry(); fhsPaintShare(); }));
}
function fhsRetry() { if (FHS_RETRY) return; FHS_RETRY = setTimeout(() => { FHS_RETRY = 0; if (FHS && (FHS_STATE !== "ok" || FHS_DEAD.size)) fhsListen(); }, 30000); }
function fhsRemoved() {
  fhsStopListening(); FHS = null; fhsStore(); FHS_STATE = "removed"; FHS_FAM = null;
  toast("This phone isn't sharing with the family any more. Your copy stays here."); render(); if (FH_OPEN) showFh();
}
function fhsReset() { fhsStopListening(); FHS = null; fhsStore(); FHS_STATE = "off"; FHS_FAM = null; FHS_ERR = ""; render(); if (FH_OPEN) showFh(); }

// ------------------------------------------------------------ turning it on, inviting, joining, leaving
async function fhsCreate() {
  if (FHS || !fhCan("share") || !fhsSwitch()) return;
  const net = fhsNet(), me = await net.start(), m = fhMe(), fid = net.newId();
  await net.set(`families/${fid}`, { owner: me.uid, members: { [me.uid]: { m: m.id, role: "owner", at: Date.now(), n: m.name } }, created: net.now(), paid: false, v: 1 });
  FHS = { fid, uid: me.uid, shadow: {}, img: {}, first: true, sv: 0 }; fh().sid = fid; fh().sv = 0; fhsStore(); FHS_GOOGLE = !!me.google; await fhsListen();
}
function fhsCode() { const b = new Uint8Array(10); (window.crypto || window.msCrypto).getRandomValues(b); return [...b].map(x => FHS_ABC[x % 32]).join(""); }
// Only the owner makes invites (Scott: the owner invites the family), each for one person in Family: an adult or a guest.
async function fhsInvite(mid) {
  const m = fhMem(mid); if (!FHS || !fhsOwner() || !m || m.role === "child") return null;
  const role = m.role === "guest" ? "guest" : "adult", code = fhsCode(), net = fhsNet(), exp = Date.now() + FHS_INVITE_DAYS * 864e5;
  await net.set(`invites/${code}`, { fid: FHS.fid, m: m.id, role, by: FHS.uid, exp: net.ts(exp), name: fh().name || "", who: m.name });
  FHS_INV = { code, mid: m.id, who: m.name, exp }; return FHS_INV;
}
const fhsPretty = c => `${c.slice(0, 5)}-${c.slice(5)}`;
const fhsLink = c => new URL(`?join=${c}`, location.href.split("?")[0].split("#")[0]).href;
function fhsAdopt(fid, uid, name, me) {
  S.fh = { setup: today(), name: name || "Our family", me: me || "", sid: fid, members: [], lists: [] }; FH_FIXED = null; fh();
  if (FH_OPEN) hideFh();
  FHS = { fid, uid, shadow: {}, img: {}, sv: 0 }; FHS_ROLESEEN = null; fhsStore(); if (FHS_SAVE0) FHS_SAVE0(); else saveLocal(); render();
}
async function fhsJoin(raw) {
  const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 10) return "The code has 10 letters and numbers.";
  const net = fhsNet(); let me, inv;
  try { me = await net.start(); inv = await net.get(`invites/${code}`); } catch (e) { return "Couldn't reach the family - check the internet and try again."; }
  if (!inv || net.ms(inv.exp) < Date.now() || !FHS_OKID.test(String(inv.fid)) || !FHS_OKID.test(String(inv.m))) return "That code didn't work. It may be used or expired - ask for a new one.";
  let fam = null; try { fam = await net.get(`families/${inv.fid}`); } catch (e) { fam = null; }
  if (!(fam && fam.members && fam.members[me.uid])) {                            // already in it (a phone that left while offline): just pick up again
    try { await net.batch([{ op: "update", p: `families/${inv.fid}`, d: { [`members.${me.uid}`]: { m: inv.m, role: inv.role, at: Date.now(), n: inv.who || "" }, join: code } }, { op: "del", p: `invites/${code}` }]); }
    catch (e) { return "That code didn't work. Ask for a new one."; }
  }
  fhsAdopt(inv.fid, me.uid, inv.name, inv.m);
  try { history.replaceState(null, "", location.pathname); } catch (e) { /* fine */ }
  toast(`💛 Welcome to ${inv.name || "the family"}! Bringing everything over...`); await fhsListen(); return "";
}
async function fhsLeave() {
  if (!FHS || !FHS_FAM || fhsOwner()) return;
  try { await fhsNet().update(`families/${FHS.fid}`, { [`members.${FHS.uid}`]: null }); } catch (e) { /* offline: rejoining later picks this phone up again */ }
  fhsReset(); toast("This phone stopped sharing. Your copy stays here.");
}
async function fhsRemovePhone(uid) {
  if (!fhsOwner() || uid === FHS.uid || !FHS_FAM.members[uid]) return;
  await fhsNet().update(`families/${FHS.fid}`, { [`members.${uid}`]: null }); toast("That phone is off the family's sharing");
}
// The owner on a new phone (or after Erase): this phone's own sign-in first, then the Google account linked before.
async function fhsRecover(google) {
  const net = fhsNet();
  try { let me = await net.start(), uid = me.uid, fid = await net.ownerOf(uid);
    if (!fid && google && net.google) { uid = await net.google(false); fid = await net.ownerOf(uid); }
    if (!fid) return google ? "No family found for that Google account." : "";
    const fam = await net.get(`families/${fid}`); const mine = fam && fam.members && fam.members[uid];
    fhsAdopt(fid, uid, "", mine ? mine.m : ""); await fhsListen(); toast("💛 Your family is back"); return "";
  } catch (e) { return /popup|cancel/i.test(String(e && (e.code || e.message))) ? "Google sign-in was closed." : "Couldn't find your family - check the internet."; }
}
async function fhsGoogleLink() { const net = fhsNet(); if (!net.google) return "Not available here.";
  try { await net.start(); await net.google(true); FHS_GOOGLE = true; return ""; } catch (e) { return /popup|cancel/i.test(String(e && (e.code || e.message))) ? "Google sign-in was closed." : "Couldn't link Google."; } }

// ------------------------------------------------------------ the Share page, the setup screen's "Join", the Today note
function fhsWhen(ms) { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : prettyDate(today()); }
function fhsShareHtml() { const h = fhsShareHtml0(); FHS_PAINTED = h; return h; }
function fhsShareHtml0() {
  const me = fhMe(), owner = fhsOwner();
  if (!fhsSwitch()) return `<div class="fh-share"><span class="fh-bigface" aria-hidden="true">🔗</span><h3>Everyone's phone, one family</h3><p>Sharing between phones is coming soon.</p></div>`;
  if (!FHS) return `<div class="fh-share"><span class="fh-bigface" aria-hidden="true">🔗</span><h3>Everyone's phone, one family</h3>
      <p>Turn on sharing and invite your family with a code. Everyone sees the same calendar, messages, chores, lists and photos on their own phone. No accounts.</p>
      ${fhCan("share") ? `<button class="btn fh-go" data-fhson="1">Turn on sharing</button>` : `<p class="fine">Only ${esc((fhMembers().find(m => m.role === "owner") || {}).name || "the family's owner")} can turn sharing on.</p>`}
      ${FHS_STATE === "removed" ? `<p class="fine">This phone isn't sharing with the family any more.</p>` : ""}${FHS_ERR && FHS_STATE !== "removed" ? `<p class="fine">⚠️ ${esc(FHS_ERR)}</p>` : ""}</div>
    <ul class="fh-promises"><li>🔒 Nothing leaves this phone until you turn it on.</li><li>🙈 "Only me" stays on your own phone. "Parents only" never reaches a guest's phone.</li>
      <li>👶 Kids stay profiles you manage - they use a parent's phone or the family tablet. No kid logins, no location.</li><li>🗑️ You can take a phone off the family any time.</li></ul>
    ${fhsJoinFormHtml(true)}`;
  if (FHS_STATE === "denied") return `<div class="fhs-status"><b>⚠️ The family's sharing turned this phone away</b><small>${esc(FHS_ERR)}</small></div>
    <div class="fh-btns"><button class="btn sm ghost" data-fhsreset="1">Stop sharing on this phone</button></div>${fhsJoinFormHtml(true)}`;
  const st = { ok: `✅ Shared · synced ${fhsWhen(FHS_LAST)}`, starting: "⏳ Connecting...", offline: "📴 Offline - changes send when you're back online", removed: "This phone isn't sharing" }[FHS_STATE] || "⏳";
  const phones = FHS_FAM ? Object.entries(FHS_FAM.members || {}) : [], inv = FHS_INV && FHS_INV.exp > Date.now() ? FHS_INV : null;
  const linked = new Set(phones.map(([, x]) => x && x.m)), canInv = fhMembers().filter(m => m.role !== "child")
    .sort((x, y) => ((me && x.id === me.id) - (me && y.id === me.id)) || (linked.has(x.id) - linked.has(y.id)));   // people without a phone yet first, "another phone for me" last
  return `<div class="fhs-status${FHS_STATE === "ok" ? " ok" : ""}"><b>${esc(st)}</b><small>${phones.length} phone${phones.length === 1 ? "" : "s"} in the family</small></div>
    ${owner ? `<div class="mv-sec"><h3>Invite someone</h3></div>
      ${inv ? `<div class="fhs-code"><small>Code for ${esc(inv.who)} · works once, for ${FHS_INVITE_DAYS} days</small><b>${esc(fhsPretty(inv.code))}</b>
        <div class="fh-btns"><button class="btn fh-go" data-fhsshare="1">📤 Send it</button><button class="btn sm ghost" data-fhscopy="1">Copy</button></div>
        <p class="fine">On their phone: open Family Hub and tap "Join your family", or open the link you send.</p></div>` : ""}
      <form class="qa-form fh-form" data-fhsinv="1"><label class="field">Who is it for<select name="m">${canInv.map(m => `<option value="${m.id}">${m.face} ${esc(m.name)}${me && m.id === me.id ? " (another phone or tablet for me)" : linked.has(m.id) ? " (has a phone)" : ""}</option>`).join("")}</select></label>
        <button class="btn sm fh-go">Make an invite code</button><p class="fine">Add the person in Family first. Kids don't need a code - they use a parent's phone or the family tablet.</p></form>` : ""}
    <div class="mv-sec"><h3>Phones in the family</h3></div>
    <div class="fh-members">${phones.map(([uid, p]) => { const m = fhMem(p.m); return `<div class="fh-member" style="--tone:${m ? m.color : "#c8d6e5"}"><span class="fh-bigface" aria-hidden="true">${m ? m.face : "📱"}</span>
      <span class="grow"><b>${esc(m ? m.name : String(p.n || "A phone"))}${uid === FHS.uid ? " <small>(this phone)</small>" : ""}</b><small>${uid === FHS_FAM.owner ? "👑 Owner" : p.role === "guest" ? "🤝 Guest" : "🧑 Adult"}</small></span>
      ${owner && uid !== FHS.uid && FHS_OKID.test(uid) ? `<button class="btn sm ghost" data-fhsrm="${uid}">Remove</button>` : ""}</div>`; }).join("")}</div>
    ${owner ? `<div class="mv-sec"><h3>If you lose this phone</h3></div>${FHS_GOOGLE ? `<p class="fine">✅ Linked to your Google account: on a new phone, tap "I'm the owner" on the welcome screen.</p>`
        : `<p class="fine">Link your Google account so you can get your family back on a new phone. Google only sees that you use Family Hub.</p><button class="btn sm ghost" data-fhsgoogle="1">Link Google</button>`}`
      : `<div class="fh-btns fh-danger"><button class="btn sm ghost" data-fhsleave="1">${FHS_ASK === "leave" ? "Tap again to stop sharing on this phone" : "Stop sharing on this phone"}</button></div>`}
    <p class="fine">Shared: the calendar, messages, chores, lists, meals, school, pets, goals, the tree, profiles (as each person allows) and photos. Documents stay on each phone. "Only me" never leaves your phone.</p>`;
}
function fhsJoinFormHtml(replace) {
  if (!fhsSwitch()) return "";
  const pre = (() => { try { return (new URLSearchParams(location.search).get("join") || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 14); } catch (e) { return ""; } })();
  return `<form class="qa-form fh-form fhs-join" data-fhsjoin="1"><div class="mv-sec"><h3>${replace ? "Joining a family that's already sharing?" : "Join your family"}</h3></div>
    <label class="field">Invite code<input name="code" value="${esc(pre)}" placeholder="e.g. K7M2Q-9XRTP" maxlength="14" autocomplete="off" autocapitalize="characters" required></label>
    <button class="btn fh-go">Join</button>${replace ? `<p class="fine">Joining puts the shared family on this phone in place of the one here.</p>` : ""}</form>`;
}
// The welcome screen: start a family, join one with a code, or (the owner, new phone) get it back.
function fhsSetupExtra() {
  if (!fhsSwitch()) return "";
  return `${fhsJoinFormHtml(false)}<p class="fine fhs-owner"><button class="mv-linkb fh-link" data-fhsrecover="1">I'm the owner - get my family back</button></p>
    <p class="fine" id="fhsJoinMsg">${esc(FHS_ERR && FHS_STATE !== "ok" ? FHS_ERR : "")}</p>`;
}
const fhsNote = () => FHS ? `☁️ Shared with your family's phones${FHS_STATE === "ok" ? ` · synced ${fhsWhen(FHS_LAST)}` : FHS_STATE === "offline" ? " · offline" : ""}.` : "";

function fhsClick(ds) {
  const say = m => { FH_MSG = m; fhMsgShow(); };
  if (ds.fhson) { if (!fhCan("share")) return true; fhsCreate().then(() => { showFh("share"); toast("☁️ Sharing is on. Invite your family."); }).catch(e => { FHS_ERR = "Couldn't turn sharing on: " + (e && e.message || e); showFh("share"); }); return true; }
  if (ds.fhsshare) { const i = FHS_INV; if (!i) return true; const link = fhsLink(i.code), text = `Join our family on Family Hub: ${link} (code ${fhsPretty(i.code)})`;
    if (navigator.share) navigator.share({ title: "Family Hub", text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("Copied - paste it in a text"), () => {}); return true; }
  if (ds.fhscopy) { const i = FHS_INV; if (i && navigator.clipboard) navigator.clipboard.writeText(`${fhsLink(i.code)} (code ${fhsPretty(i.code)})`).then(() => toast("Copied"), () => {}); return true; }
  if (ds.fhsrm) { fhsRemovePhone(ds.fhsrm).catch(() => say("Couldn't remove that phone - check the internet.")); return true; }
  if (ds.fhsleave) { if (FHS_ASK !== "leave") { FHS_ASK = "leave"; showFh("share"); setTimeout(() => { FHS_ASK = ""; }, 5000); return true; } FHS_ASK = ""; fhsLeave(); return true; }
  if (ds.fhsreset) { fhsReset(); return true; }
  if (ds.fhsgoogle) { fhsGoogleLink().then(m => { if (m) say(m); else { toast("✅ Linked to Google"); showFh("share"); } }); return true; }
  return false;
}
function fhsSubmit(f, data) {
  const D = f.dataset;
  if (D.fhsinv) { if (!fhsOwner()) return true; fhsInvite(data.m).then(i => { if (!i) { FH_MSG = "Pick an adult or a guest."; fhMsgShow(); return; } showFh("share"); })
    .catch(() => { FH_MSG = "Couldn't make a code - check the internet."; fhMsgShow(); }); return true; }
  return false;
}
// Before setup only these two answer (fhClick / fhSubmit stay closed until the family exists).
if (typeof document !== "undefined") {
  document.addEventListener("submit", e => {
    const f = e.target; if (typeof MODE === "undefined" || MODE !== "family" || !f || !f.dataset || !f.dataset.fhsjoin) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const code = new FormData(f).get("code"), msg = document.getElementById("fhsJoinMsg") || document.getElementById("fhMsg");
    if (fhSet() && FHS_ASK !== "join") { FHS_ASK = "join"; if (msg) msg.textContent = "⚠️ Tap Join again: the shared family replaces the one on this phone."; setTimeout(() => { FHS_ASK = ""; }, 6000); return; }
    FHS_ASK = ""; if (msg) msg.textContent = "Joining...";
    fhsJoin(code).then(m => { if (m) { FHS_ERR = m; const el = document.getElementById("fhsJoinMsg") || document.getElementById("fhMsg"); if (el) el.textContent = "⚠️ " + m; } });
  }, true);
  document.addEventListener("click", e => {
    const b = e.target && e.target.closest && e.target.closest("[data-fhsrecover]"); if (!b || typeof MODE === "undefined" || MODE !== "family") return;
    e.preventDefault(); e.stopImmediatePropagation();
    fhsRecover(true).then(m => { const el = document.getElementById("fhsJoinMsg"); if (m && el) el.textContent = "⚠️ " + m; });
  }, true);
}

// ------------------------------------------------------------ hooks: every save sends; Erase on a sharing phone takes it off the family first
if (typeof MODE !== "undefined" && MODE === "family" && typeof save === "function") {
  FHS_SAVE0 = save;
  save = function () { const r = FHS_SAVE0.apply(this, arguments); if (FHS) fhsSoon(); return r; };   // eslint-disable-line no-global-assign
  if (typeof eraseAll === "function") { const E0 = eraseAll;
    eraseAll = function () { const armed = typeof ERASE_ARMED !== "undefined" && Date.now() - ERASE_ARMED <= 5000;   // eslint-disable-line no-global-assign
      if (armed && FHS) { const was = FHS, owner = fhsOwner(); fhsStopListening(); FHS = null; fhsStore(); FHS_STATE = "off";
        if (!owner && FHS_FAM) fhsNet().update(`families/${was.fid}`, { [`members.${was.uid}`]: null }).catch(() => {}); FHS_FAM = null; }   // the owner's family stays: "I'm the owner" brings it back
      return E0.apply(this, arguments); }; }
  if (FHS) setTimeout(fhsListen, 0);
  if (typeof window !== "undefined") window.addEventListener("online", () => { if (FHS && (FHS_STATE !== "ok" || FHS_DEAD.size)) fhsListen(); });
}

fhMod({
  id: "sync",
  panes: { share: fhsShareHtml },
  click: fhsClick,
  submit: fhsSubmit,
  after: () => { FHS_DIRTY = false; },
  forget: () => {}
});
