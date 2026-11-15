/* SAVE AS: cookshare.js · LOCATION: C:/MarvelApps/dayhub/cookshare.js
 * COOKING HUB - SHARED RECIPES (Scott 11/15: "we do want them to be able to submit their own recipes if they want and those go to app").
 * A cook can send one of their own (non-private) recipes to Marvel Corp; Scott reviews it; an approved recipe shows in every Cooking Hub
 * under "From Our Cooks" with the cook's first name. Nothing shows before a person at Marvel Corp approves it, and every shared recipe has
 * a Report button (Google Play's rules for things people share).
 * WHERE IT GOES: the Day Hub Firebase project day-hub-510322 (Spark, free), the same one Family Hub's sharing uses, through Firebase's plain
 * web calls (REST) - no Firebase code library on a cook's phone:
 *   recipe_submissions/{id}  a cook's recipe waiting for review (text + an optional small dish photo; NEVER the recipe-card photo)
 *   recipes_shared/{id}      approved recipes, readable by anyone (that is the whole point)
 *   recipe_reports/{id}      "something's wrong with this recipe" reports
 * The phone signs in anonymously only when it sends something (no account, no email). The review page (?review=1) signs in with Google
 * and works only for Scott's account - the Firestore rules decide that (docs/hub_improvement/familyhub/firestore.rules), not this file.
 * Until those rules are published, sending says "couldn't send" and the list is simply empty.
 * Loaded after cooking.js (cooking mode only). Every top-level name is cks / CKS.
 */
"use strict";
const CKS_PROJECT = "day-hub-510322", CKS_KEY = "AIzaSyCnLXutctuOrDHc2fKuy6c0rdOmUR62e7Y";   // public web IDs (the same ones Family Hub ships)
const CKS_DOCS = `https://firestore.googleapis.com/v1/projects/${CKS_PROJECT}/databases/(default)/documents`;
const CKS_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const CKS_AUTH_KEY = "cookinghub.auth", CKS_CACHE_KEY = "cookinghub.shared", CKS_FRESH = 6 * 3600000;
let CKS_LIST = null, CKS_LOADING = null, CKS_REVIEW = null, CKS_RV_TOKEN = "", CKS_RV_MSG = "";

// ------------------------------------------------------------ Firestore's typed JSON <-> plain values
function cksVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(cksVal) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: cksFields(v) } };
  return { stringValue: String(v) };
}
const cksFields = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, cksVal(v)]));
function cksPlain(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return !!v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(cksPlain);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, cksPlain(x)]));
  return null;
}
const cksDoc = d => ({ id: String(d.name || "").split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, cksPlain(v)])) });
const cksId = () => Array.from({ length: 20 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]).join("");
async function cksFetch(url, opt) {
  if (typeof window !== "undefined" && window.CKS_FAKE) return window.CKS_FAKE(url, opt || {});   // tests only: a fake Firebase, never the real project
  const r = await fetch(url, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || ("HTTP " + r.status)); e.status = r.status; throw e; }
  return j;
}

// ------------------------------------------------------------ the phone's anonymous sign-in (only when it sends something)
async function cksToken() {
  let a = null; try { a = JSON.parse(localStorage.getItem(CKS_AUTH_KEY) || "null"); } catch (e) { a = null; }
  if (a && a.id && a.exp > Date.now() + 60000) return a;
  if (a && a.refresh) {
    try { const j = await cksFetch(`https://securetoken.googleapis.com/v1/token?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refresh)}` });
      a = { id: j.id_token, refresh: j.refresh_token, uid: j.user_id, exp: Date.now() + Number(j.expires_in || 3600) * 1000 };
      try { localStorage.setItem(CKS_AUTH_KEY, JSON.stringify(a)); } catch (e) { /* storage blocked */ } return a; } catch (e) { /* sign in again below */ }
  }
  const j = await cksFetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
  a = { id: j.idToken, refresh: j.refreshToken, uid: j.localId, exp: Date.now() + Number(j.expiresIn || 3600) * 1000 };
  try { localStorage.setItem(CKS_AUTH_KEY, JSON.stringify(a)); } catch (e) { /* storage blocked */ }
  return a;
}
// One new document, with the server's own time stamped in "at" (the rules check it).
async function cksCreate(coll, data, token, stamp = "at") {
  const name = `projects/${CKS_PROJECT}/databases/(default)/documents/${coll}/${cksId()}`;
  await cksFetch(`${CKS_DOCS.replace(/\/documents$/, "")}/documents:commit?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ writes: [{ update: { name, fields: cksFields(data) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: stamp, setToServerValue: "REQUEST_TIME" }] }] }) });
  return name.split("/").pop();
}

// ------------------------------------------------------------ sending a recipe for review, reporting one
// What goes: the recipe's words, category, servings, times, first name (optional) and - if the cook ticks it - a small dish photo.
// Never: a private recipe, the recipe-card photo, the cook's notes field "by" unless they typed a first name to show.
function cksPayload(r, opt) {
  return { t: ckTxt(r.t, 80), cat: (r.cat || [])[0] || "dinner", serves: ckInt(r.serves, 1, 99, 4), prep: ckInt(r.prep, 0, 2000, 0), cook: ckInt(r.cook, 0, 2000, 0),
    ing: (r.ing || []).slice(0, 60).map(x => ({ a: ckTxt(x[0], 30), i: ckTxt(x[1], 90) })).filter(x => x.i), steps: (r.steps || []).slice(0, 40).map(s => ckTxt(s, 600)).filter(Boolean),
    story: ckTxt(r.story, 2000), by: ckTxt(opt.by, 40), photo: opt.photo || "", agree: true, v: 1 };
}
const cksHash = r => { const s = JSON.stringify([r.t, r.ing, r.steps, r.story, r.serves, r.prep, r.cook, (r.cat || [])[0]]); /* what the cook wrote, not the quick tag the app adds */ let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };
async function cksSend(r, opt) {
  if (!r || r.private || r.draft) throw new Error("private");
  const a = await cksToken();
  const id = await cksCreate("recipe_submissions", { ...cksPayload(r, opt), uid: a.uid }, a.id);
  return id;
}
async function cksReport(rid, why) { const a = await cksToken(); return cksCreate("recipe_reports", { rid: ckTxt(rid, 64), why: ckTxt(why, 300), uid: a.uid }, a.id); }

// ------------------------------------------------------------ From Our Cooks: approved recipes (anyone may read them), kept for offline
function cksShape(d) {
  const cat = CK_WRITE_CATS.includes(d.cat) ? d.cat : "dinner";
  return { id: "s-" + String(d.id).replace(/[^\w-]/g, "").slice(0, 40), t: ckTxt(d.t, 80) || "Recipe", cat: [cat, "community"], serves: ckInt(d.serves, 1, 99, 4),
    prep: ckInt(d.prep, 0, 2000, 0), cook: ckInt(d.cook, 0, 2000, 0), e: (CK_CATS[cat] || ["🍽️"])[0], blurb: "", tip: "", gran: "",
    ing: (Array.isArray(d.ing) ? d.ing : []).filter(x => x && typeof x === "object").map(x => [ckTxt(x.a, 30), ckTxt(x.i, 90), ckKeyOf(x.i)]).filter(x => x[1]),
    steps: (Array.isArray(d.steps) ? d.steps : []).map(s => ckTxt(s, 600)).filter(Boolean), story: ckTxt(d.story, 2000), by: ckTxt(d.by, 40),
    photoUrl: typeof d.photo === "string" && /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(d.photo) ? d.photo : "", community: true };
}
function cksCached() {
  if (CKS_LIST) return CKS_LIST;
  try { const c = JSON.parse(localStorage.getItem(CKS_CACHE_KEY) || "null"); if (c && Array.isArray(c.list)) { CKS_LIST = c.list.map(cksShape); return CKS_LIST; } } catch (e) { /* none yet */ }
  return [];
}
function cksShared() { const hide = new Set((ck().hidden || [])); return cksCached().filter(r => r.ing.length && r.steps.length && !hide.has(r.id)); }
async function cksRefresh(force) {
  if (CKS_LOADING) return CKS_LOADING;
  let at = 0; try { at = (JSON.parse(localStorage.getItem(CKS_CACHE_KEY) || "null") || {}).at || 0; } catch (e) { at = 0; }
  if (!force && at && Date.now() - at < CKS_FRESH) return cksCached();
  CKS_LOADING = (async () => {
    try {
      const j = await cksFetch(`${CKS_DOCS}/recipes_shared?pageSize=300&key=${CKS_KEY}`);
      const list = (j.documents || []).map(cksDoc);
      try { localStorage.setItem(CKS_CACHE_KEY, JSON.stringify({ at: Date.now(), list })); } catch (e) { /* too big or blocked: the list still shows this visit */ }
      CKS_LIST = list.map(cksShape);
      if (typeof render === "function" && typeof MODE !== "undefined" && MODE === "cooking") { render(); if (CK_OPEN) showCk(); }
    } catch (e) { /* offline, or the rules aren't published yet: keep what we had */ }
    finally { CKS_LOADING = null; }
    return cksCached();
  })();
  return CKS_LOADING;
}
if (typeof window !== "undefined" && typeof MODE !== "undefined" && MODE === "cooking") setTimeout(() => { if (typeof ckSet === "function" && ckSet()) cksRefresh(); }, 1500);

// ------------------------------------------------------------ the review page (Scott only - the rules allow no one else)
async function cksSignInReview() {
  if (typeof window !== "undefined" && window.CKS_FAKE_REVIEW) { CKS_RV_TOKEN = window.CKS_FAKE_REVIEW; return CKS_RV_TOKEN; }   // tests only
  const load = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = CKS_SDK + src; s.onload = ok; s.onerror = () => no(new Error("offline")); document.head.appendChild(s); });
  if (!window.firebase || !firebase.auth) { await load("firebase-app-compat.js"); await load("firebase-auth-compat.js"); }
  const app = firebase.apps.find(a => a.name === "cookingreview") || firebase.initializeApp({ apiKey: CKS_KEY, authDomain: CKS_PROJECT + ".firebaseapp.com", projectId: CKS_PROJECT }, "cookingreview");
  const auth = app.auth();
  if (!auth.currentUser || auth.currentUser.isAnonymous) await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  CKS_RV_TOKEN = await auth.currentUser.getIdToken(); return CKS_RV_TOKEN;
}
async function cksReviewLoad() {
  const h = { headers: { Authorization: "Bearer " + CKS_RV_TOKEN } };
  const [s, r] = await Promise.all([cksFetch(`${CKS_DOCS}/recipe_submissions?pageSize=100&key=${CKS_KEY}`, h), cksFetch(`${CKS_DOCS}/recipe_reports?pageSize=100&key=${CKS_KEY}`, h).catch(() => ({}))]);
  CKS_REVIEW = { subs: (s.documents || []).map(cksDoc), reports: (r.documents || []).map(cksDoc) };
  return CKS_REVIEW;
}
async function cksApprove(sub) {
  const keep = ["t", "cat", "serves", "prep", "cook", "ing", "steps", "story", "by", "photo"], data = Object.fromEntries(keep.map(k => [k, sub[k]]).filter(([, v]) => v !== undefined && v !== null));
  const base = `projects/${CKS_PROJECT}/databases/(default)/documents`;
  await cksFetch(`${CKS_DOCS.replace(/\/documents$/, "")}/documents:commit?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + CKS_RV_TOKEN },
    body: JSON.stringify({ writes: [
      { update: { name: `${base}/recipes_shared/${sub.id}`, fields: cksFields(data) }, updateTransforms: [{ fieldPath: "approvedAt", setToServerValue: "REQUEST_TIME" }] },
      { delete: `${base}/recipe_submissions/${sub.id}` }] }) });
}
const cksDelete = (coll, id) => cksFetch(`${CKS_DOCS}/${coll}/${encodeURIComponent(id)}?key=${CKS_KEY}`, { method: "DELETE", headers: { Authorization: "Bearer " + CKS_RV_TOKEN } });

// ------------------------------------------------------------ RECIPE OF THE WEEK (board: docs/recipehub_design_2026-11-15/RecipeHub_Recipe_of_the_Week.png)
// Community ratings: one per phone per shared recipe (recipe_ratings/{rid}_{uid}, anyone may read them so the page shows real averages).
// Votes for next week: one per phone per week (recipe_votes/{week}_{uid}, only the review page reads them to count).
// The winner: Scott picks it on the review page (weekly/{week}); every past winner = the Blue Ribbon Hall of Fame. No made-up numbers:
// a recipe with no ratings shows none.
const cksWeek = off => ckWeekStart(off || 0);                                        // the Monday a week starts (This Week's Table's week)
const cksSid = id => String(id || "").replace(/^s-/, "");
async function cksRate(rid, s, cooked) {
  const a = await cksToken(), id = `${cksSid(rid)}_${a.uid}`, name = `projects/${CKS_PROJECT}/databases/(default)/documents/recipe_ratings/${id}`;
  await cksFetch(`${CKS_DOCS.replace(/\/documents$/, "")}/documents:commit?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.id },
    body: JSON.stringify({ writes: [{ update: { name, fields: cksFields({ rid: cksSid(rid), uid: a.uid, s: ckInt(s, 1, 5, 5), cooked: !!cooked }) }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] }] }) });
}
async function cksVote(rid) {
  const a = await cksToken(), wk = cksWeek(0), id = `${wk}_${a.uid}`, name = `projects/${CKS_PROJECT}/databases/(default)/documents/recipe_votes/${id}`;
  await cksFetch(`${CKS_DOCS.replace(/\/documents$/, "")}/documents:commit?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.id },
    body: JSON.stringify({ writes: [{ update: { name, fields: cksFields({ week: wk, rid: cksSid(rid), uid: a.uid }) }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] }] }) });
}
const CKS_STARS = {};                                                                // rid -> { avg, n, cooked, at } read this visit
async function cksStars(rid) {
  const k = cksSid(rid), c = CKS_STARS[k]; if (c && Date.now() - c.at < 10 * 60000) return c;
  const q = { structuredQuery: { from: [{ collectionId: "recipe_ratings" }], where: { fieldFilter: { field: { fieldPath: "rid" }, op: "EQUAL", value: { stringValue: k } } }, limit: 2000 } };
  const rows = await cksFetch(`${CKS_DOCS}:runQuery?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
  const L = (Array.isArray(rows) ? rows : []).filter(r => r && r.document).map(r => cksDoc(r.document)).filter(x => x.s >= 1 && x.s <= 5);
  return (CKS_STARS[k] = { avg: L.length ? L.reduce((t, x) => t + x.s, 0) / L.length : 0, n: L.length, cooked: L.filter(x => x.cooked).length, at: Date.now() });
}
let CKS_WEEKS = null;                                                                // every weekly winner, newest first (the Hall of Fame)
async function cksWeeks(force) {
  if (CKS_WEEKS && !force) return CKS_WEEKS;
  try { const j = await cksFetch(`${CKS_DOCS}/weekly?pageSize=200&key=${CKS_KEY}`); CKS_WEEKS = (j.documents || []).map(cksDoc).filter(w => ckIsD(w.start) && w.rid).sort((a, b) => b.start.localeCompare(a.start));
    try { localStorage.setItem("cookinghub.weeks", JSON.stringify(CKS_WEEKS)); } catch (e) { /* blocked */ } }
  catch (e) { try { CKS_WEEKS = JSON.parse(localStorage.getItem("cookinghub.weeks") || "[]"); } catch (e2) { CKS_WEEKS = []; } }
  return CKS_WEEKS;
}
// Review page only: this week's vote count, and naming a winner.
async function cksTally(wk) {
  const q = { structuredQuery: { from: [{ collectionId: "recipe_votes" }], where: { fieldFilter: { field: { fieldPath: "week" }, op: "EQUAL", value: { stringValue: wk } } }, limit: 5000 } };
  const rows = await cksFetch(`${CKS_DOCS}:runQuery?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + CKS_RV_TOKEN }, body: JSON.stringify(q) });
  const n = {}; (Array.isArray(rows) ? rows : []).filter(r => r && r.document).forEach(r => { const v = cksDoc(r.document); if (v.rid) n[v.rid] = (n[v.rid] || 0) + 1; });
  return n;
}
async function cksCrown(r, tip) {
  const wk = cksWeek(0), name = `projects/${CKS_PROJECT}/databases/(default)/documents/weekly/${wk}`;
  await cksFetch(`${CKS_DOCS.replace(/\/documents$/, "")}/documents:commit?key=${CKS_KEY}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + CKS_RV_TOKEN },
    body: JSON.stringify({ writes: [{ update: { name, fields: cksFields({ start: wk, rid: cksSid(r.id), t: ckTxt(r.t, 80), by: ckTxt(r.by, 40), tip: ckTxt(tip, 200) }) }, updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] }] }) });
  CKS_WEEKS = null; return cksWeeks(true);
}
