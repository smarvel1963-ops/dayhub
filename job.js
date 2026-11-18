/* SAVE AS: job.js · LOCATION: C:/MarvelApps/dayhub/job.js
 * JOB HUB (app #12; Scott 11/14 "ad job hunt hub to list of aps", 11/15 his 6-screen board, 11/17 "Job Hub", then his 15 page looks
 * the same night: docs/jobhub_design_2026-11-15/JobHub_Scott_5_Screen_Looks_2026-11-17 + the 10 that followed).
 * Runs at /jobhub/ with window.DH_MODE = "job".
 * PAGES: Welcome · Career Command Center (Home) · Job Radar · the job (Overview / Pay / Company / Requirements) · Career Fit ·
 * Employer · Saved Role Tracker · Opportunity Pipeline · Smart Alerts · Resume Studio · Tailor To a Job · Edit My Resume (+ one
 * experience) · What I'm Looking For · Check a Job I Found · More. Bottom bar: Home, Radar, Resume, Pipeline, Alerts.
 * THE JOBS: jobs.json in the Job Hub site (built every day by jobhub/tools/build_jobs.py on GitHub, free): companies' own job boards
 * (Greenhouse, Lever, Ashby), Jobicy remote jobs (credited, links go to Jobicy) and USAJOBS federal jobs. One detail shard
 * (jobs/detail_NN.json) loads when a job is opened. Plus jobs the person pastes in themselves (any site - LinkedIn, Indeed...).
 * RULES (the plan's, kept):
 *  - Never invent qualifications. The match score shows its EVIDENCE: which words from the job are on the resume, which aren't.
 *    Tailor adds only the words the person taps as true for them.
 *  - Unknown is shown as unknown ("not known", "Pay not posted") - never guessed. The page looks Scott drew carry sample numbers
 *    (employee counts, ratings, reviews); postings don't have those, so those spots show facts from today's postings instead.
 *  - Apply always opens the employer's own posting; Job Hub never applies, logs in to job sites, or scrapes LinkedIn / Indeed.
 *  - Resume suggestions are plain rules (numbers, strong verbs, length, words the saved jobs ask for) - no AI, no cost.
 *  - Data stays on this phone (S.jh, in the normal backup). Current pay is private: never sent to Ask.
 * Scoring: Scott's weights (Desktop notes 11/15), pay 30 · skills 25 · location & work style 20 · experience 15 · industry 10
 * (experience + industry took the places of stability + growth 11/17: postings never say those; Scott's Career Fit look asks for
 * experience and industry, and the person can answer them). Career goals (the job title vs the jobs they want) multiplies.
 * Loaded after ships.js, before ui.js (job mode). Every top-level name is jh / JH.
 */
"use strict";
const JH_NAV = [["home", "home", "Home"], ["radar", "radar", "Radar"], ["resume", "doc", "Resume"], ["pipe", "pipe", "Pipeline"], ["alerts", "bell", "Alerts"]];
const JH_TABS = { radar: "Job Radar", job: "Is This Job Right for Me?", fit: "Career Fit", emp: "Employer", track: "Saved Role Tracker", resume: "Resume Studio",
  tailor: "Tailor To a Job", edit: "Edit My Resume", exp: "Experience", pipe: "Opportunity Pipeline", alerts: "Smart Alerts", prefs: "What I'm Looking For",
  paste: "Check a Job I Found", more: "More" };
const JH_STAGES = [["saved", "bookmark", "Saved"], ["applied", "send", "Applied"], ["interview", "users", "Interview"], ["offer", "trophy", "Offer"]];
const JH_STAGES5 = [...JH_STAGES, ["closed", "check", "Closed"]];
const JH_W0 = { pay: 30, match: 25, remote: 20, exp: 15, ind: 10 };
const JH_WNAME = { pay: "Pay & compensation", match: "Skills match", remote: "Location & work style", exp: "Experience level", ind: "Industry fit" };
const JH_WICON = { pay: "dollar", match: "code", remote: "pin", exp: "bag", ind: "layers" };
const JH_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
const JH_WORK = [["remote", "Remote", "check"], ["hybrid", "Hybrid", "users"], ["onsite", "On-site", "building"]];
const JH_INDS0 = ["Tech", "Healthcare", "Finance", "Aerospace", "Defense", "Energy", "Automotive", "Manufacturing", "Security", "Logistics", "Retail", "Media", "Biotech",
  "Education", "Gaming", "Insurance", "Legal", "Travel", "Transportation", "Food & Hospitality", "Fitness", "Government", "Real Estate", "Agriculture"];
const JH_CATS = [["product", "Product", "bag", /\bproduct\b/], ["eng", "Engineering", "code", /engineer|developer|software|devops|\bsre\b|programmer/],
  ["data", "Data", "chart", /\bdata\b|analyst|analytics|machine learning|scientist/], ["design", "Design", "pen", /design|\bux\b|\bui\b/],
  ["sales", "Sales", "trend", /sales|account exec|account manager|business development|\bsdr\b|\bbdr\b/], ["ops", "Operations", "pipe", /operations|logistics|supply chain|program manager|project manager/],
  ["health", "Healthcare", "heart", /nurse|\brn\b|medical|clinical|therap|health|physician|pharm/], ["marketing", "Marketing", "mega", /marketing|content|brand|\bseo\b|communications/],
  ["finance", "Finance", "coins", /financ|accountant|accounting|controller|payroll|\btax\b|audit/], ["support", "Support", "users", /support|customer success|customer service|help desk|technician/]];
const JH_ASKS = ["How do I answer 'tell me about yourself'?", "What should I ask at the end of an interview?", "Which of my saved jobs pays best?", "How do I follow up after applying?"];
const JH_STATES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington DC", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
const JH_VERBS = /^(led|built|cut|grew|launched|managed|created|designed|improved|reduced|increased|delivered|drove|ran|trained|saved|won|opened|started|developed|organized|negotiated|planned|coordinated|supervised|dispatched|handled|resolved|shipped|owned|scaled|automated|streamlined)\b/i;
const JH_STOP = new Set(["and", "or", "of", "the", "a", "an", "to", "for", "in", "at", "with", "on", "i", "ii", "iii", "iv", "&", "-", "/", "senior", "sr", "jr", "junior", "lead", "staff", "principal"]);
const JH_SKILLS0 = ["excel", "sql", "python", "java", "javascript", "customer service", "sales", "project management", "management", "leadership", "communication", "scheduling",
  "dispatch", "logistics", "supply chain", "forklift", "cdl", "inventory", "budgeting", "accounting", "quickbooks", "salesforce", "microsoft office", "word", "powerpoint",
  "data analysis", "marketing", "social media", "nursing", "rn", "lpn", "cna", "hipaa", "spanish", "bilingual", "aws", "azure", "linux", "react", "node", "safety", "osha",
  "manufacturing", "lean", "six sigma", "quality", "auditing", "recruiting", "training", "bachelor's degree", "master's degree", "high school diploma", "teaching", "writing", "design"];
let JH_OPEN = false, JH_TAB = "radar", JH_STACK = [], JH_MSG = "", JH_CUR = "", JH_JTAB = "over", JH_FEED = null, JH_FEEDBUSY = false, JH_FEEDERR = "", JH_Q = "",
  JH_F = { work: "any", pay: 0 }, JH_ROLE = "", JH_N = 30, JH_ARM = "", JH_TAILOR = "", JH_VOCAB = null, JH_SCORES = null, JH_EMP = "", JH_ETAB = "over", JH_PF = "",
  JH_EXP = "", JH_ZOOM = false;
const JH_PICK = new Set();          // Tailor: the missing words the person tapped as true for them
const JH_DETAIL = {};               // shard number -> { busy } | { d: {...} } | { err }
let JH_MEMO = { of: null };         // title fit, resume text and the match lists - valid while JH_SCORES is the same Map
function jhMemo() {   // a restored backup or a Drive copy swaps S.jh: start fresh then too
  if (JH_MEMO.jh !== S.jh) JH_SCORES = null;
  if (!JH_SCORES) JH_SCORES = new Map(); if (JH_MEMO.of !== JH_SCORES) JH_MEMO = { of: JH_SCORES, jh: S.jh, fit: new Map(), rt: null, list: new Map() }; return JH_MEMO; }
if (typeof document !== "undefined" && typeof MODE !== "undefined" && MODE === "job") document.body.classList.add("jhapp");

// ------------------------------------------------------------ the data (S.jh) and small helpers
const jhIsD = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const jhIsM = v => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
const jhTxt = (v, n = 80) => String(v == null ? "" : v).trim().slice(0, n);
const jhInt = (v, lo, hi, d) => { const n = Math.floor(Number(String(v == null ? "" : v).replace(/[$,\s]/g, ""))); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const jhPl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const jhArr = (v, n, len) => Array.isArray(v) ? v.map(x => jhTxt(x, len)).filter(Boolean).slice(0, n) : [];
function jh() {
  if (!S.jh || typeof S.jh !== "object" || Array.isArray(S.jh)) S.jh = {};
  const J = S.jh, o = v => v && typeof v === "object" && !Array.isArray(v);
  // A backup file or Drive copy is outside data: shapes and numbers are checked before they reach the page.
  if (!o(J.me)) J.me = {};
  const M = J.me;
  M.titles = jhArr(M.titles, 8, 60);
  if (!JH_STATES[M.where]) M.where = "";
  if (M.remote !== undefined) { if (M.remote === "remote" && !Array.isArray(M.work)) M.work = ["remote"]; delete M.remote; }   // the first build's "Remote only"
  M.work = Array.isArray(M.work) ? JH_WORK.map(w => w[0]).filter(k => M.work.includes(k)) : [];
  if (M.work.length === JH_WORK.length) M.work = [];   // all three = any
  if (!JH_TYPES.includes(M.type)) M.type = "";
  M.minPay = jhInt(M.minPay, 0, 5000000, 0); M.curPay = jhInt(M.curPay, 0, 5000000, 0); M.yrs = jhInt(M.yrs, 0, 60, 0);
  M.inds = jhArr(M.inds, 12, 40);
  const w0 = o(M.w) ? M.w : {}; M.w = {}; Object.keys(JH_W0).forEach(k => { M.w[k] = w0[k] == null || w0[k] === "" ? JH_W0[k] : jhInt(w0[k], 0, 100, JH_W0[k]); });   // a weight not set yet = Scott's (jhInt reads "" as 0)
  if (!o(J.cv)) J.cv = {};
  const V = J.cv;
  V.name = jhTxt(V.name, 60); V.head = jhTxt(V.head, 90); V.sum = jhTxt(V.sum, 1200);
  V.exp = Array.isArray(V.exp) ? V.exp.filter(o).map(e => ({ id: /^[a-z0-9-]{1,40}$/i.test(String(e.id || "")) ? String(e.id) : uid(), t: jhTxt(e.t, 80), co: jhTxt(e.co, 80),
    from: jhIsM(e.from) ? e.from : "", to: jhIsM(e.to) ? e.to : "", bul: jhArr(e.bul, 12, 300) })).filter(e => e.t || e.co || e.bul.length).slice(0, 15) : [];
  V.bul = jhArr(V.bul, 40, 300);
  if (V.bul.length) { if (!V.exp.length) V.exp.push({ id: uid(), t: V.head || "Experience", co: "", from: "", to: "", bul: V.bul.slice(0, 12) }); V.bul = []; }   // the first build kept loose lines
  V.skills = jhArr(V.skills, 60, 40);
  if (!o(J.jobs)) J.jobs = {};
  Object.keys(J.jobs).forEach(id => { const x = J.jobs[id]; if (!o(x)) { delete J.jobs[id]; return; }
    x.id = String(id).slice(0, 120); x.t = jhTxt(x.t, 120) || "Job"; x.co = jhTxt(x.co, 80); x.loc = jhTxt(x.loc, 80); x.url = /^https?:\/\//.test(String(x.url || "")) ? String(x.url).slice(0, 500) : "";
    x.min = jhInt(x.min, 0, 5000000, 0); x.max = jhInt(x.max, 0, 5000000, 0); x.src = jhTxt(x.src, 20); x.type = JH_TYPES.includes(x.type) ? x.type : "";
    if (!["saved", "applied", "interview", "offer", "closed"].includes(x.st)) x.st = "saved";
    ["add", "appl", "fu", "stAt"].forEach(k => { if (!jhIsD(x[k])) x[k] = ""; }); if (!x.stAt) x.stAt = x.add;
    x.iv = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(x.iv || "")) ? x.iv : ""; x.note = jhTxt(x.note, 600); x.fuNote = jhTxt(x.fuNote, 120); x.fuDone = x.fuDone === true; });
  J.mine = Array.isArray(J.mine) ? J.mine.filter(o).map(x => ({ id: /^p-/.test(String(x.id || "")) ? String(x.id).slice(0, 40) : "p-" + uid(), t: jhTxt(x.t, 120) || "A job I found",
    co: jhTxt(x.co, 80), loc: jhTxt(x.loc, 80), url: /^https?:\/\//.test(String(x.url || "")) ? String(x.url).slice(0, 500) : "", text: jhTxt(x.text, 6000),
    min: jhInt(x.min, 0, 5000000, 0), max: jhInt(x.max, 0, 5000000, 0), rem: x.rem ? 1 : 0, add: jhIsD(x.add) ? x.add : today() })).slice(0, 60) : [];
  J.hide = Array.isArray(J.hide) ? J.hide.filter(x => typeof x === "string").slice(-500) : [];
  J.follow = jhArr(J.follow, 50, 80);   // employers whose new openings show on Smart Alerts
  J.seen = jhTxt(J.seen, 40); J.mon = J.mon !== false;
  J.seenIds = Array.isArray(J.seenIds) ? J.seenIds.filter(x => typeof x === "string").map(x => x.slice(0, 120)).slice(-300) : [];   // alerts already shown
  if (J.setup && !jhIsD(J.setupDay)) J.setupDay = today();
  return J;
}
const jhSet = () => !!(S.jh && S.jh.setup);
// THE PRICE (Scott 11/18: "4.99 month"): 30 days free from setup, then $4.99/month on Whop (unlocked with the email bought with, like every
// Hub; Day Hub Pro unlocks it too). After the free days the whole app locks (v1.65 rule, Scott 11/15 "All paid apps"): only jhLockHtml -
// subscribe, "I already bought it", save a copy. Nothing is deleted. Never in the Play app, never before JOB_CHECKOUT_URL exists.
const jhSells = () => typeof jobPass === "function" && jobPass() && !(typeof STORE_MODE !== "undefined" && STORE_MODE) && !!(typeof PLAN !== "undefined" && PLAN.JOB_CHECKOUT_URL);
function jhTrial() { const J = S.jh || {}, days = (typeof PLAN !== "undefined" && PLAN.JOB_TRIAL_DAYS) || 30, used = jhIsD(J.setupDay) ? Math.max(0, -daysUntil(J.setupDay)) : 0;
  return { paid: typeof isPro === "function" && isPro(), left: Math.max(0, days - used) }; }
const jhPaused = () => jhSells() && jhSet() && (t => !t.paid && !t.left)(jhTrial());
// Scott's lock screen (11/18 design: "Keep your career momentum." - lead with the benefit, show the person's own results, one buy button,
// restore access, export). The numbers are this phone's real activity and show only when there is some; nothing is promised.
function jhMonthStats() {
  const J = S.jh || {}, jobs = Object.values(J.jobs && typeof J.jobs === "object" ? J.jobs : {}).filter(x => x && typeof x === "object");
  let strong = null;
  if (JH_FEED) { strong = 0; for (const j of jhMatches(0, true)) { if (jhScore(j) >= 70) strong++; else break; } }
  return { strong, saved: jobs.length, applied: jobs.filter(x => x.appl || ["applied", "interview", "offer"].includes(x.st)).length };
}
const JH_SUMMIT = `<svg class="jh-summit" viewBox="0 0 320 150" aria-hidden="true"><defs>
  <radialGradient id="jhSg" cx=".62" cy=".22" r=".55"><stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/><stop offset=".45" stop-color="#f2a94e" stop-opacity=".25"/><stop offset="1" stop-color="#0a1736" stop-opacity="0"/></radialGradient>
  <linearGradient id="jhSm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3f78"/><stop offset="1" stop-color="#0b1838"/></linearGradient>
  <linearGradient id="jhSp" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#c48d22"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
  <filter id="jhSb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>
  <rect width="320" height="150" fill="url(#jhSg)"/>
  <path d="M0 112 52 78 92 96 138 62 176 88 214 40 248 70 286 54 320 76V150H0Z" fill="#1a2a58" opacity=".85"/>
  <path d="M30 150 118 92 158 104 200 46 236 86 262 78 320 116V150Z" fill="url(#jhSm)"/>
  <path d="M200 46 188 64 198 60 206 68 214 58Z" fill="#dfe6f7" opacity=".55"/>
  <path d="M96 150C120 132 170 132 172 118S128 106 150 92 196 86 200 50" fill="none" stroke="#ffd27a" stroke-width="5" filter="url(#jhSb)" opacity=".85"/>
  <path d="M96 150C120 132 170 132 172 118S128 106 150 92 196 86 200 50" fill="none" stroke="url(#jhSp)" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M200 50V18" stroke="#ffe08a" stroke-width="2"/><path d="M200 18h26l-7 6 7 6h-26z" fill="#f2c14e"/>
  <circle cx="150" cy="92" r="4" fill="#2fe0c0"/><circle cx="150" cy="92" r="8" fill="#2fe0c0" opacity=".25"/>
  <circle cx="171" cy="118" r="4" fill="#2fe0c0"/><circle cx="171" cy="118" r="8" fill="#2fe0c0" opacity=".25"/></svg>`;
function jhLockHtml() {
  jhLoad();   // today's list, for "Strong matches" (it re-draws this screen when it lands)
  const N = jhMonthStats(), any = N.saved || N.applied || N.strong;
  const stat = (n, l) => `<span><b>${n.toLocaleString()}</b><small>${l}</small></span>`;
  const feat = (i, l) => `<span class="jh-lf">${jhIco(i)}<b>${l}</b></span>`;
  return `<section class="hub-lock jh-lock" aria-label="Job Hub - keep your career momentum">
    <div class="jh-lbrand">${jhLogo()}<b>JOB HUB</b><small>by Marvel Corp</small></div>
    <h2>Keep your career <span class="g">momentum.</span></h2><p class="jh-lsub">Your free month has ended.</p>
    ${JH_SUMMIT}
    ${any ? `<div class="jh-lmonth"><small>YOUR FIRST MONTH WITH JOB HUB</small><div>${N.strong != null ? stat(N.strong, "Strong matches today") : ""}${stat(N.saved, N.saved === 1 ? "Role saved" : "Roles saved")}${stat(N.applied, N.applied === 1 ? "Application tracked" : "Applications tracked")}</div></div>
      <p class="jh-lpitch">You've already started making moves. Keep Job Hub working for you for just <b>${esc(PLAN.JOB_MONTHLY.replace("/month", ""))}</b> a month.</p>`
      : `<p class="jh-lpitch">Your personal career assistant for just <b>${esc(PLAN.JOB_MONTHLY.replace("/month", ""))}</b> a month.</p>`}
    <div class="jh-lfeats">${feat("search", "Fresh job matches")}${feat("chart", "Career Fit insights")}${feat("doc", "Resume Studio")}${feat("cal", "Pipeline &amp; reminders")}</div>
    <div class="jh-lprice"><b>${esc(PLAN.JOB_MONTHLY.replace("/month", ""))}</b><span>/month</span><small>Cancel anytime</small></div>
    <a class="hl-buy" href="${esc(PLAN.JOB_CHECKOUT_URL)}" target="_blank" rel="noopener">Keep Job Hub working for me</a>
    <button class="hl-link" data-open="sheet">Already subscribed? Restore access</button>
    <button class="hl-link" data-data="export">Save or export my information</button>
    <p class="jh-lsafe">${jhIco("lock")}<span>Your saved jobs and resume stay on this device.</span></p></section>`;
}
function jhTrialHtml() {           // a small line on Home while the free month runs
  if (!jhSells() || !jhSet()) return "";
  const T = jhTrial(); if (T.paid || !T.left) return "";
  return `<div class="jh-trialbar">${jhIco("star")}<span class="grow"><b>Free for ${T.left} more day${T.left === 1 ? "" : "s"}</b><small>Then ${esc(PLAN.JOB_MONTHLY)}, cancel any time.</small></span><button class="jh-all" data-open="sheet">Already subscribed?</button></div>`;
}
const jhQ = () => (S.jh && S.jh.me && S.jh.cv && S.jh.jobs && Array.isArray(S.jh.hide) && Array.isArray(S.jh.follow) ? S.jh : jh());   // already repaired: skip the full check (hot paths)
const jhMoney = n => !n ? "" : n >= 1000 ? "$" + (n >= 100000 ? Math.round(n / 1000) : Math.round(n / 100) / 10) + "K" : "$" + n;
const jhPayTxt = j => { const a = j.min || 0, b = j.max || 0; if (!a && !b) return "Pay not posted"; if (a && b && a !== b) return `${jhMoney(a)} – ${jhMoney(b)}`; return jhMoney(a || b); };
const jhLocNice = l => { const s = String(l || "").trim(), m = s.match(/^US-([A-Z]{2})-(.+)$/); return m ? `${m[2].replace(/-/g, " ")}, ${m[1]}` : s; };
const jhWhere = j => j.rem ? (j.loc && !/remote|anywhere/i.test(j.loc) ? `Remote · ${jhLocNice(j.loc)}` : "Remote") : (jhLocNice(j.loc) || "Location not listed");
const jhStyle = j => j.rem ? "remote" : /hybrid/i.test(j.loc || "") ? "hybrid" : "onsite";
const jhStageName = k => (JH_STAGES5.find(s => s[0] === k) || ["", "", "Saved"])[2];
const jhDayWord = d => !d ? "" : d === today() ? "Today" : d === addDays(today(), 1) ? "Tomorrow" : d === addDays(today(), -1) ? "Yesterday" : prettyDate(d);
const jhTime12 = hm => { const [h, m] = String(hm || "").split(":").map(Number); return isFinite(h) && isFinite(m) ? `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` : ""; };
const jhMonth = ym => { if (!jhIsM(ym)) return ""; const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };

// ------------------------------------------------------------ the job list (jobs.json) and one job's details (a shard)
const JH_F_ORDER = ["id", "title", "company", "loc", "state", "remote", "min", "max", "period", "posted", "url", "src", "kw", "shard", "ind", "type"];
function jhRow(r, F) {
  const g = k => F[k] === undefined ? undefined : r[F[k]], ty = String(g("type") || "");
  return { id: String(g("id") || ""), t: String(g("title") || ""), co: String(g("company") || ""), loc: String(g("loc") || ""), st: String(g("state") || ""), rem: g("remote") ? 1 : 0,
    min: Number(g("min")) || 0, max: Number(g("max")) || 0, per: String(g("period") || ""), d: String(g("posted") || ""), url: String(g("url") || ""), src: String(g("src") || ""),
    kw: Array.isArray(g("kw")) ? g("kw") : [], sh: Number(g("shard")) || 0, ind: String(g("ind") || ""), type: JH_TYPES.includes(ty) ? ty : "" };
}
function jhLoad(force) {
  // A failed download waits for Try again (or the phone coming back online) - every render calls this, so retrying here would loop.
  if (typeof fetch === "undefined" || JH_FEEDBUSY || ((JH_FEED || JH_FEEDERR) && !force)) return;
  JH_FEEDBUSY = true; JH_FEEDERR = "";
  fetch(JOBHUB_URL + "jobs.json?v=" + today()).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(j => {
    const fields = Array.isArray(j.fields) ? j.fields : JH_F_ORDER, F = {}; fields.forEach((k, i) => { F[k] = i; });
    const rows = (Array.isArray(j.m) ? j.m : []).filter(Array.isArray).map(r => jhRow(r, F)).filter(x => x.id && x.t && /^https?:\/\//.test(x.url));
    rows.forEach(x => { x.tt = jhToks(x.t); x.tc = x.tt.concat(jhToks(x.co)); x.tl = x.t.toLowerCase(); });   // a job's words, worked out once (7,000+ jobs: every tap re-did this)
    const inds = {}; rows.forEach(x => { if (x.ind) inds[x.ind] = (inds[x.ind] || 0) + 1; });
    JH_FEED = { made: String(j.made || ""), credit: String(j.credit || ""), counts: j.counts && typeof j.counts === "object" ? j.counts : {}, rows, by: new Map(rows.map(x => [x.id, x])),
      inds: Object.keys(inds).sort((a, b) => inds[b] - inds[a]) };
    JH_SCORES = null;
  }).catch(e => { JH_FEEDERR = "Couldn't load today's jobs - check your connection."; }).then(() => { JH_FEEDBUSY = false; jhRefresh(); });
}
if (typeof window !== "undefined") window.addEventListener("online", () => { if (typeof MODE !== "undefined" && MODE === "job" && JH_FEEDERR && jhSet()) jhLoad(true); });
function jhVocabLoad() {
  if (JH_VOCAB || typeof fetch === "undefined") return; JH_VOCAB = JH_SKILLS0;
  fetch(JOBHUB_URL + "jobs/vocab.json?v=" + today()).then(r => r.ok ? r.json() : null).then(j => { if (j && Array.isArray(j.words) && j.words.length) { JH_VOCAB = j.words.map(w => String(w).toLowerCase()); JH_SCORES = null; } }).catch(() => {});
}
function jhDetail(job) {
  if (!job || /^p-/.test(job.id) || job.gone || typeof fetch === "undefined") return job && job.gone ? {} : null;
  const n = job.sh, D = JH_DETAIL[n];
  if (D && D.d) return D.d[job.id] || {};
  if (D && D.err) return {};
  if (!D) { JH_DETAIL[n] = { busy: true }; fetch(JOBHUB_URL + "jobs/detail_" + String(n).padStart(2, "0") + ".json?v=" + today()).then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(j => { JH_DETAIL[n] = { d: j && j.d && typeof j.d === "object" ? j.d : {} }; }).catch(() => { JH_DETAIL[n] = { err: 1 }; })
    .then(() => { if (JH_OPEN && ["job", "fit"].includes(JH_TAB) && JH_CUR === job.id) showJh(); }); }
  return null;
}
function jhRefresh() { if (!jhSet()) return; if (JH_OPEN) showJh(); if (typeof render === "function") render(); }
// A job by id: the feed, a pasted one, or the saved copy (a saved job stays even after it leaves the feed).
function jhJob(id) {
  if (!id) return null;
  const J = jhQ();
  if (/^p-/.test(id)) { const p = J.mine.find(x => x.id === id); return p ? { ...p, kw: jhWords(p.text + " " + p.t), pasted: true } : null; }
  const f = JH_FEED && JH_FEED.by.get(id); if (f) return f;
  const s = J.jobs[id]; return s ? { id, t: s.t, co: s.co, loc: s.loc, url: s.url, min: s.min, max: s.max, src: s.src, type: s.type, kw: [], rem: /remote/i.test(s.loc) ? 1 : 0, gone: true } : null;
}
const jhBoard = j => { const tok = String(j.id || "").split(":")[1] || "";
  return !tok ? "" : j.src === "Greenhouse" ? `https://boards.greenhouse.io/${tok}` : j.src === "Lever" ? `https://jobs.lever.co/${tok}` : j.src === "Ashby" ? `https://jobs.ashbyhq.com/${tok}` : ""; };

// ------------------------------------------------------------ the match: title fit + Scott's weighted factors, with the evidence
const jhToks = s => String(s || "").toLowerCase().replace(/\bmgr\b/g, "manager").replace(/\bsr\b/g, "senior").replace(/[^a-z0-9+#]+/g, " ").split(" ").filter(w => w && !JH_STOP.has(w));
function jhWords(text) {           // the skill words in a pasted job
  const s = " " + String(text || "").toLowerCase().replace(/[^a-z0-9+#'. ]+/g, " ") + " ", out = [];
  (JH_VOCAB || JH_SKILLS0).forEach(w => { if (out.length < 30 && s.includes(" " + w + " ")) out.push(w); });
  const y = String(text || "").match(/(\d{1,2})\+?\s*(?:years|yrs)/i); if (y) out.push("years:" + y[1]);
  return out;
}
const jhLines = () => { const V = jhQ().cv; return [].concat(...V.exp.map(e => e.bul)); };
function jhResumeText() { const m = jhMemo(); if (m.rt == null) { const V = jhQ().cv;
  m.rt = " " + [V.head, V.sum, ...V.exp.map(e => [e.t, e.co, ...e.bul].join(" ")), ...V.skills].join(" ").toLowerCase().replace(/[^a-z0-9+#'. ]+/g, " ") + " "; } return m.rt; }
const jhFitTo = (toks, wt) => { const jt = new Set(toks); return !wt.length ? 0 : wt.filter(x => jt.has(x) || (x.length > 4 && [...jt].some(y => y.startsWith(x.slice(0, 5))))).length / wt.length; };
function jhTitleFit(t, toks) {
  const want = jhQ().me.titles; if (!want.length) return 0.6;
  const m = jhMemo(); if (m.fit.has(t)) return m.fit.get(t);
  const tk = toks || jhToks(t); let best = 0;
  want.forEach(w => { best = Math.max(best, jhFitTo(tk, jhToks(w))); });
  m.fit.set(t, best); return best;
}
function jhEvidence(job) {
  const rt = jhResumeText(), kw = (job.kw || []).filter(k => !/^years:/.test(k)), has = [], miss = [];
  const empty = rt.trim().length < 3;
  kw.forEach(k => { (!empty && rt.includes(" " + k.toLowerCase() + " ") ? has : miss).push(k); });
  const yrs = (job.kw || []).find(k => /^years:/.test(k));
  return { has, miss, yrs: yrs ? Number(yrs.slice(6)) : 0, empty };
}
function jhFactors(job) {
  const M = jhQ().me, E = jhEvidence(job), hi = job.max || job.min || 0, sty = jhStyle(job);
  const styleOk = !M.work.length || M.work.includes(sty), placeOk = sty === "remote" || !M.where || job.st === M.where;
  const f = {
    pay: !hi ? null : !M.minPay ? 1 : hi >= M.minPay ? 1 : Math.max(0, (hi / M.minPay - 0.6) / 0.4),   // no floor set = any posted pay is fine
    match: E.empty || !(E.has.length + E.miss.length) ? null : E.has.length / (E.has.length + E.miss.length),
    remote: styleOk && placeOk ? 1 : styleOk || placeOk ? 0.5 : 0.1,
    exp: M.yrs && E.yrs ? (M.yrs >= E.yrs ? 1 : Math.max(0, M.yrs / E.yrs)) : null,
    ind: M.inds.length && job.ind ? (M.inds.includes(job.ind) ? 1 : 0.3) : null };
  return { f, E, goal: jhTitleFit(job.t, job.tt) };
}
// Unknown factors count as halfway (shown as "not known"), so a job is never pushed up or down by a guess.
function jhScore(job) {
  if (!job) return 0;
  if (JH_SCORES && JH_SCORES.has(job.id)) return JH_SCORES.get(job.id);
  const W = jhQ().me.w, { f, goal } = jhFactors(job); let num = 0, den = 0;
  Object.keys(JH_W0).forEach(k => { const w = W[k] || 0; den += w; num += w * (f[k] == null ? 0.5 : f[k]); });
  const base = den ? num / den : 0.5, s = Math.max(1, Math.min(99, Math.round(100 * base * (0.3 + 0.7 * goal))));
  jhMemo(); JH_SCORES.set(job.id, s);
  return s;
}
const jhFitWord = s => s >= 85 ? "Excellent Match" : s >= 70 ? "Good Match" : s >= 55 ? "Fair Match" : "Long Shot";
// The match list. base = the person's own search (Home, alerts); otherwise Job Radar's search box and dropdowns apply too.
function jhMatches(limit, base) {
  if (!JH_FEED) return [];
  const J = jh(), M = J.me, memo = jhMemo(), q0 = base ? "" : JH_Q, role = base ? "" : JH_ROLE, work = base ? "any" : JH_F.work, pay = base ? 0 : JH_F.pay;
  const key = [JH_FEED.made, JH_FEED.rows.length, base ? 1 : 0, q0, role, work, pay, J.hide.length, M.where, M.minPay, M.type, M.titles.join("|")].join("~");
  if (memo.list.has(key)) { const l = memo.list.get(key); return limit ? l.slice(0, limit) : l; }
  const hide = new Set(J.hide), q = jhToks(q0), cat = /^c:/.test(role) ? (JH_CATS.find(c => c[0] === role.slice(2)) || [])[3] : null;
  const one = /^t:\d+$/.test(role) ? jhToks(M.titles[Number(role.slice(2))] || "") : null;
  const out = [];
  for (const j of JH_FEED.rows) {
    if (hide.has(j.id)) continue;
    if (M.type && j.type && j.type !== M.type) continue;            // a job that doesn't say its type is never hidden by it
    if (work === "near" ? !(M.where && j.st === M.where && !j.rem) : work !== "any" && jhStyle(j) !== work) continue;
    if (pay && !((j.max || j.min) >= pay)) continue;
    const tt = j.tc || jhToks(j.t + " " + j.co);
    if (q.length) { if (!q.every(w => tt.some(x => x === w || x.startsWith(w)))) continue; }
    else if (cat) { if (!cat.test(j.tl || j.t.toLowerCase())) continue; }
    else if (one) { if (jhFitTo(j.tt || jhToks(j.t), one) < 0.5) continue; }
    else if (M.titles.length && jhTitleFit(j.t, j.tt) < 0.5) continue;
    out.push(j);
  }
  out.sort((a, b) => jhScore(b) - jhScore(a) || (b.d > a.d ? 1 : b.d < a.d ? -1 : 0));
  memo.list.set(key, out);
  return limit ? out.slice(0, limit) : out;
}
function jhMarket(job) {           // posted pay of similar jobs in today's list (honest "market": what Job Hub can see)
  if (!JH_FEED) return null;
  const tk = job.tt || jhToks(job.t); if (!tk.length) return null;
  const mids = [];
  for (const j of JH_FEED.rows) { if (j.id === job.id || !(j.min || j.max)) continue; const jt = new Set(j.tt || jhToks(j.t)); if (tk.filter(x => jt.has(x)).length / tk.length >= 0.6) mids.push(((j.min || j.max) + (j.max || j.min)) / 2); if (mids.length > 400) break; }
  if (mids.length < 3) return { n: mids.length };
  mids.sort((a, b) => a - b); const q = p => mids[Math.min(mids.length - 1, Math.floor(p * mids.length))];
  return { n: mids.length, lo: Math.round(q(0.25)), mid: Math.round(q(0.5)), hi: Math.round(q(0.75)) };
}
function jhEmpStats(co) {          // what today's postings say about one employer - nothing else is shown about them
  const rows = JH_FEED && co ? JH_FEED.rows.filter(x => x.co === co) : [], n = rows.length;
  const pays = rows.map(x => x.max && x.min ? (x.max + x.min) / 2 : x.max || x.min).filter(Boolean).sort((a, b) => a - b);
  const sts = {}; rows.forEach(x => { if (x.st) sts[x.st] = (sts[x.st] || 0) + 1; });
  const cats = {}; rows.forEach(x => { const c = JH_CATS.find(k => k[3].test(x.tl || x.t.toLowerCase())); if (c) cats[c[1]] = (cats[c[1]] || 0) + 1; });
  const sty = { remote: 0, hybrid: 0, onsite: 0 }; rows.forEach(x => { sty[jhStyle(x)]++; });
  return { rows, n, ind: (rows.find(x => x.ind) || {}).ind || "", remote: n ? Math.round(sty.remote / n * 100) : 0, sty,
    states: Object.keys(sts).sort((a, b) => sts[b] - sts[a]), stc: sts, cats: Object.keys(cats).sort((a, b) => cats[b] - cats[a]).map(k => [k, cats[k]]),
    pmin: pays[0] || 0, pmid: pays.length ? Math.round(pays[Math.floor(pays.length / 2)]) : 0, pmax: pays[pays.length - 1] || 0, newest: rows.reduce((a, x) => x.d > a ? x.d : a, ""),
    board: rows.length ? jhBoard(rows[0]) : "", loc: rows.length ? jhLocNice((rows.find(x => !x.rem) || rows[0]).loc) : "" };
}

// ------------------------------------------------------------ art, drawn in code (navy + gold + teal; Scott's page looks)
const JH_I = {
  home: '<path d="M4 11.5 12 5l8 6.5V20h-5v-5.5H9V20H4z"/>', radar: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l5.5-5.5"/>',
  doc: '<path d="M6.5 3.5H14l4 4v13H6.5z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/>', pipe: '<circle cx="5.5" cy="17.5" r="2"/><circle cx="18.5" cy="6.5" r="2"/><path d="M7.5 17.5h6a3.5 3.5 0 000-7h-3a3.5 3.5 0 010-7h6"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0110 4h4a1.5 1.5 0 011.5 1.5V7M3 12.5h18"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/>', share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8M5 12.5v6A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5v-6"/>',
  back: '<path d="M19 12H5.5M11 6l-6 6 6 6"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  coins: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4M5 10.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4M5 14.5v3c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-3"/>',
  trend: '<path d="M3.5 17l6-6 4 4 7-7.5"/><path d="M15 7.5h5.5V13"/>', ext: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 13.5V19a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5 19 9M14 9l2 2"/>', code: '<path d="M8.5 7l-5 5 5 5M15.5 7l5 5-5 5"/>', chart: '<path d="M5 20v-7M10 20V6M15 20v-9M20 20V9"/>',
  pen: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z"/>', users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.5 14.4c2.4.2 4 1.8 4.5 4.6"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.9-4 3.8-6.2 7.5-6.2s6.6 2.2 7.5 6.2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z"/>',
  building: '<path d="M4 20V6.5L12 3v17M12 9l8 3v8M2.5 20h19M7 8h2M7 11.5h2M7 15h2M15 14h2M15 17h2"/>', layers: '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a2.5 2.5 0 002.8 3.5M16 6h3a2.5 2.5 0 01-2.8 3.5M12 13v3.5M8.5 20h7l-.8-3.5H9.3z"/>',
  dollar: '<path d="M12 3v18M16.5 7.5C15.9 6 14.1 5 12 5c-2.6 0-4.5 1.4-4.5 3.4 0 4.6 9.5 2.4 9.5 7.1 0 2-2 3.5-5 3.5-2.4 0-4.4-1.1-5-2.8"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>', down: '<path d="M6 9l6 6 6-6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  send: '<path d="M20.5 3.5 3.5 10.5l7 2.5 2.5 7z"/><path d="M20.5 3.5 10.5 13"/>', bookmark: '<path d="M6.5 3.5h11V21L12 17l-5.5 4z"/>',
  filter: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M3.5 3.5l17 17"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5"/>', download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>', list: '<path d="M8.5 7h11M8.5 12h11M8.5 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', mega: '<path d="M4 10v4h3l8 4.5v-13L7 10z"/><path d="M18 9.5a3.5 3.5 0 010 5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  wave: '<circle cx="12" cy="12" r="2"/><path d="M8 8a5.5 5.5 0 000 8M16 8a5.5 5.5 0 010 8M5 5a9.5 9.5 0 000 14M19 5a9.5 9.5 0 010 14"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>', note: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>' };
const jhIco = (n, cls = "") => `<svg class="jh-i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${JH_I[n] || ""}</svg>`;
const jhLogo = () => `<svg class="jh-logo" viewBox="0 0 40 30" aria-hidden="true"><defs><linearGradient id="jhLg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".45" stop-color="#f4c44e"/><stop offset="1" stop-color="#b47f1c"/></linearGradient></defs><path d="M1 29 10 1h7l6 16 5.5-16H39l-9 28h-7l-6-16-6 16z" fill="url(#jhLg)"/></svg>`;
const jhBrand = () => `<span class="jh-brand">${jhLogo()}<span class="jh-bt"><b>JOB HUB</b><small>by Marvel Corp</small></span></span>`;
function jhLogoBadge(co, big) {     // the employer's initials on a colour from its name (no logos in the postings)
  const s = String(co || "?"), h = [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const ini = s.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  return `<span class="jh-co${big ? " big" : ""}" style="--h:${h}" aria-hidden="true">${esc(ini)}</span>`;
}
function jhSky(cls = "") {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const B = [[0, 34, 70], [26, 22, 96], [46, 30, 60], [74, 18, 120], [90, 28, 84], [116, 16, 150], [130, 24, 104], [152, 34, 72], [184, 20, 128], [202, 30, 92], [230, 14, 178], [242, 26, 110],
    [266, 30, 80], [294, 22, 140], [314, 28, 96], [340, 20, 116], [358, 42, 70]];
  const bld = B.map(([bx, bw, bh0]) => { const bh = Math.round(bh0 * 0.62); let win = ""; for (let yy = 214 - bh + 8; yy < 206; yy += 9) for (let xx = bx + 4; xx < bx + bw - 4; xx += 6) if (rnd() > 0.55) win += `<rect x="${xx}" y="${yy}" width="2.4" height="3.4" fill="#ffd27a" opacity="${(0.45 + rnd() * 0.5).toFixed(2)}"/>`;
    return `<rect x="${bx}" y="${214 - bh}" width="${bw}" height="${bh}" fill="#0b1633"/>${win}`; }).join("");
  return `<svg class="jh-sky ${cls}" viewBox="0 0 400 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="jhS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#081634"/><stop offset=".38" stop-color="#2c2a66"/><stop offset=".62" stop-color="#a9567a"/><stop offset=".8" stop-color="#f29a54"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
    <radialGradient id="jhSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d6"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <linearGradient id="jhW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a5a"/><stop offset="1" stop-color="#0a1330"/></linearGradient></defs>
    <rect width="400" height="230" fill="url(#jhS)"/><circle cx="292" cy="100" r="92" fill="url(#jhSun)"/><circle cx="292" cy="100" r="21" fill="#fff3c4"/>
    <path d="M0 150 L50 120 L95 142 L150 104 L205 138 L262 112 L318 136 L360 118 L400 132 L400 230 L0 230 Z" fill="#1f2a5c" opacity=".75"/>
    <path d="M0 196 L60 176 L120 190 L190 168 L250 186 L320 170 L400 188 L400 230 L0 230 Z" fill="#26305f" opacity=".7"/>
    <path d="M232 96 L236 76 L240 96 L240 214 L232 214 Z" fill="#0b1633"/>${bld}
    <rect y="214" width="400" height="16" fill="url(#jhW)"/><path d="M262 218 h60 M276 222 h34 M284 226 h18" stroke="#ffd27a" stroke-width="1.6" opacity=".7"/></svg>`;
}
// One glowing picture per page, on the right of the art (Scott's looks each have their own: a bell, a target, a resume, a road...).
const JH_ART = {
  globe: '<circle cx="80" cy="80" r="54" stroke="#5ee6c8" stroke-width="2.5"/><ellipse cx="80" cy="80" rx="22" ry="54" stroke="#5ee6c8" stroke-width="2"/><path d="M26 80h108M34 52h92M34 108h92" stroke="#5ee6c8" stroke-width="2"/><circle cx="58" cy="58" r="4" fill="#ffd27a"/><circle cx="104" cy="70" r="4" fill="#ffd27a"/><circle cx="92" cy="110" r="4" fill="#ffd27a"/><path d="M58 58 104 70 92 110" stroke="#ffd27a" stroke-width="1.5" stroke-dasharray="3 4"/>',
  bell: '<path d="M80 30c-21 0-35 15-35 37v25l-11 15h92l-11-15V67c0-22-14-37-35-37z" fill="url(#jhAg)" stroke="#fff0b8" stroke-width="1.5"/><path d="M73 26h14" stroke="#ffd27a" stroke-width="5" stroke-linecap="round"/><circle cx="80" cy="117" r="9" fill="#f4c44e"/><path d="M28 60a60 60 0 000 50M132 60a60 60 0 010 50M16 50a76 76 0 000 70M144 50a76 76 0 010 70" stroke="#5ee6c8" stroke-width="2.5" stroke-linecap="round"/><path d="M58 52c-6 6-8 14-8 22" stroke="#fff6d6" stroke-width="3" stroke-linecap="round" opacity=".7"/>',
  target: '<circle cx="78" cy="84" r="50" stroke="#5ee6c8" stroke-width="2.5"/><circle cx="78" cy="84" r="34" stroke="#5ee6c8" stroke-width="2.5"/><circle cx="78" cy="84" r="18" stroke="#5ee6c8" stroke-width="2.5"/><circle cx="78" cy="84" r="6" fill="#ffd27a"/><path d="M78 84 136 30" stroke="#ffd27a" stroke-width="4" stroke-linecap="round"/><path d="M126 26l14-4-4 14-6 2z" fill="#ffd27a"/><path d="M128 40l8 8M132 34l10 6" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round"/>',
  doc: '<g transform="rotate(-8 80 80)"><rect x="38" y="20" width="84" height="112" rx="6" fill="#f4f1e8" stroke="#5ee6c8" stroke-width="2"/><text x="52" y="44" font-family="Inter,sans-serif" font-size="13" font-weight="800" fill="#1e2a52">RESUME</text><circle cx="58" cy="64" r="9" fill="#9fb2d8"/><path d="M74 60h34M74 68h24M52 86h56M52 96h56M52 106h40M52 116h48" stroke="#9fb2d8" stroke-width="4" stroke-linecap="round"/></g><path d="M118 112l18 18" stroke="#ffd27a" stroke-width="5" stroke-linecap="round"/><path d="M104 106l12-12 8 8-12 12-10 2z" fill="#ffd27a"/>',
  road: '<path d="M20 150c30-10 56-26 60-50s-26-28-18-52 40-26 64-30" stroke="#ffd27a" stroke-width="7" stroke-linecap="round" opacity=".9"/><path d="M20 150c30-10 56-26 60-50s-26-28-18-52 40-26 64-30" stroke="#081634" stroke-width="1.5" stroke-dasharray="6 7"/><g fill="#0b1838" stroke="#5ee6c8" stroke-width="2.5"><path d="M62 118c0-8 6-14 13-14s13 6 13 14c0 10-13 22-13 22s-13-12-13-22z"/><path d="M46 70c0-8 6-14 13-14s13 6 13 14c0 10-13 22-13 22s-13-12-13-22z"/><path d="M108 40c0-8 6-14 13-14s13 6 13 14c0 10-13 22-13 22s-13-12-13-22z"/></g><path d="M69 117l5 5 8-9M53 69l5 5 8-9M115 39l5 5 8-9" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  building: '<path d="M40 140V46l44-18v112M84 60l40 14v66" stroke="#5ee6c8" stroke-width="2.5" fill="rgba(12,40,80,.55)"/><path d="M50 58h8M64 54h8M50 72h8M64 68h8M50 86h8M64 82h8M50 100h8M64 96h8M50 114h8M64 110h8M94 84h8M108 88h8M94 100h8M108 104h8M94 116h8M108 120h8" stroke="#ffd27a" stroke-width="4"/><path d="M30 140h104" stroke="#5ee6c8" stroke-width="2.5"/><path d="M66 36 76 20l10 16" stroke="#ffd27a" stroke-width="2.5"/>',
  search: '<g transform="rotate(6 80 80)"><rect x="66" y="22" width="66" height="88" rx="6" fill="rgba(12,40,80,.6)" stroke="#5ee6c8" stroke-width="2"/><text x="78" y="44" font-family="Inter,sans-serif" font-size="13" font-weight="800" fill="#5ee6c8">JOB</text><path d="M78 58l4 4 7-8M78 74l4 4 7-8M78 90l4 4 7-8" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M96 58h24M96 74h24M96 90h18" stroke="#5ee6c8" stroke-width="3" stroke-linecap="round"/></g><circle cx="60" cy="98" r="24" stroke="#ffd27a" stroke-width="6" fill="rgba(94,230,200,.12)"/><path d="M42 116 22 136" stroke="#ffd27a" stroke-width="9" stroke-linecap="round"/>',
  cal: '<rect x="36" y="34" width="88" height="84" rx="10" fill="rgba(12,40,80,.6)" stroke="#5ee6c8" stroke-width="2.5"/><path d="M36 56h88M58 26v16M102 26v16" stroke="#5ee6c8" stroke-width="2.5" stroke-linecap="round"/><g fill="#5ee6c8" opacity=".7"><rect x="50" y="66" width="12" height="10" rx="2"/><rect x="74" y="66" width="12" height="10" rx="2"/><rect x="50" y="88" width="12" height="10" rx="2"/><rect x="98" y="88" width="12" height="10" rx="2"/></g><circle cx="104" cy="70" r="16" fill="#f4c44e"/><path d="M96 70l6 6 10-11" stroke="#081634" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
  peak: '<path d="M10 140 62 66l20 26 18-22 50 70z" fill="rgba(12,40,80,.6)" stroke="#5ee6c8" stroke-width="2.5" stroke-linejoin="round"/><path d="M62 66l-9 13 9-4 8 5z" fill="#f4f1e8"/><path d="M100 70V30" stroke="#ffd27a" stroke-width="3"/><path d="M100 30h24l-6 8 6 8h-24z" fill="#f4c44e"/>' };
const jhArt = k => JH_ART[k] ? `<svg class="jh-art" viewBox="0 0 160 160" fill="none" aria-hidden="true"><defs><linearGradient id="jhAg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".55" stop-color="#e6ab38"/><stop offset="1" stop-color="#9a6514"/></linearGradient></defs>${JH_ART[k]}</svg>` : "";
// A page's art: the sunset city, the page's picture, its title (second part gold) and a line under it. o.head = a top bar inside the art (Home, Welcome).
function jhHero(k, t1, t2, sub, o = {}) {
  return `<div class="jh-bleed ${o.size || ""}">${jhSky(o.dim ? "dim" : "")}${o.radar || jhArt(k)}${o.head || ""}${o.extra || ""}
    <div class="jh-bleedtxt"><h1 class="jh-title">${esc(t1)}${t2 ? `${o.brk ? "<br>" : " "}<span class="g">${esc(t2)}</span>` : ""}</h1>${sub ? `<p class="jh-sub">${esc(sub)}</p>` : ""}</div></div>`;
}
function jhRadarSvg(jobs) {
  const dots = jobs.slice(0, 9).map((j, i) => { const s = jhScore(j), r = 14 + (100 - s) * 0.9, a = (i * 41 + 20) * Math.PI / 180;
    return `<circle cx="${(100 + r * Math.cos(a)).toFixed(1)}" cy="${(100 + r * Math.sin(a)).toFixed(1)}" r="${s >= 85 ? 4.5 : 3.5}" fill="${s >= 85 ? "#ffd27a" : "#5ee6c8"}"/>`; }).join("");
  return `<svg class="jh-radar" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="jhR" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0f4e66"/><stop offset="1" stop-color="#05182c"/></radialGradient>
    <linearGradient id="jhSw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5ee6c8" stop-opacity="0"/><stop offset="1" stop-color="#5ee6c8" stop-opacity=".6"/></linearGradient></defs>
    <circle cx="100" cy="100" r="96" fill="url(#jhR)" stroke="#c9a45c" stroke-width="3"/>${[24, 48, 72].map(r => `<circle cx="100" cy="100" r="${r}" fill="none" stroke="#2f9f9f" stroke-width="1" opacity=".7"/>`).join("")}
    <path d="M100 4V196M4 100H196" stroke="#2f9f9f" stroke-width="1" opacity=".6"/><g class="jh-sweep"><path d="M100 100 100 6A94 94 0 0 1 181 53Z" fill="url(#jhSw)"/></g>${dots}<circle cx="100" cy="100" r="3" fill="#5ee6c8"/></svg>`;
}
const JH_LEAF = (() => { let s = ""; for (let i = 0; i < 8; i++) {   // leaves on both sides of a curved stem
  const a = (205 - i * 19) * Math.PI / 180, x = 46 + 34 * Math.cos(a), y = 52 - 44 * Math.sin(a), tan = (115 - i * 19);
  [-38, 38].forEach((o, k) => { const r = (tan + o) * Math.PI / 180, cx = x + 6.5 * Math.cos(r) * (k ? 1 : -1) * 0 + 6 * Math.cos((tan + o) * Math.PI / 180), cy = y - 6 * Math.sin((tan + o) * Math.PI / 180);
    s += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="6.8" ry="2.9" transform="rotate(${(-(tan + o)).toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`; }); } return s; })();
const jhLaurel = side => `<svg class="jh-laurel ${side}" viewBox="0 0 44 100" aria-hidden="true"><defs><linearGradient id="jhLf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe39a"/><stop offset="1" stop-color="#c08a24"/></linearGradient></defs><path d="M27 97C8 80 6 40 30 6" stroke="#c9952c" stroke-width="1.8" fill="none"/><g fill="url(#jhLf)">${JH_LEAF}</g></svg>`;
function jhRing(s, word, label) {
  const L = 2 * Math.PI * 84;
  return `<div class="jh-ring" role="img" aria-label="${esc(label)} ${s} percent${word ? ", " + esc(word) : ""}"><svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="jhRg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2fe0c0"/><stop offset=".7" stop-color="#2fe0c0"/><stop offset="1" stop-color="#f4c44e"/></linearGradient></defs>
    <circle cx="100" cy="100" r="84" fill="rgba(8,22,52,.85)" stroke="#16264f" stroke-width="16"/><circle cx="100" cy="100" r="84" fill="none" stroke="url(#jhRg)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(L * Math.max(1, s) / 100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 100 100)"/></svg>
    <div class="jh-ringt"><small>${esc(label)}</small><b>${s}%</b>${word ? `<span class="jh-badge">${jhIco("trophy")}${esc(word)}</span>` : ""}</div></div>`;
}
const jhRingWrap = (s, word, label, cls = "") => `<div class="jh-ringwrap ${cls}">${jhLaurel("l")}${jhRing(s, word, label)}${jhLaurel("r")}</div>`;

// ------------------------------------------------------------ the sheet (one page per tab) + the bottom bar + the phone's back button
function jhSheet() {
  let el = document.getElementById("jhSheet");
  if (!el) { el = document.createElement("div"); el.id = "jhSheet"; el.className = "sheet hidden"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function jhReset() { JH_MSG = ""; JH_ARM = ""; }
function hideJh(fromPop) {
  const el = document.getElementById("jhSheet"); if (el) el.classList.add("hidden"); JH_OPEN = false; JH_STACK = []; jhReset(); jhNavEnsure();
  if (!fromPop && JH_HPUSH) { JH_HPUSH = 0; JH_HSKIP++; try { history.back(); } catch (e) { JH_HSKIP = 0; } }
}
function showJh(tab, push) {
  if (jhPaused()) { if (JH_OPEN) hideJh(true); if (typeof render === "function") render(); return; }   // v1.66.2 locked: only the lock screen
  const el = jhSheet(), old = el.querySelector(".sheet-body"), same = JH_OPEN && (!tab || tab === JH_TAB), keep = same && old ? old.scrollTop : 0;
  if (tab && tab !== JH_TAB && push !== false && JH_OPEN) JH_STACK.push(JH_TAB);
  if (tab) JH_TAB = tab; if (!JH_OPEN) jhHist(); JH_OPEN = true;
  jhLoad(); jhVocabLoad();
  el.setAttribute("aria-label", JH_TABS[JH_TAB] || "Job Hub");
  const pane = jhPane();
  el.innerHTML = `<div class="sheet-body jh-sheet jh-t-${JH_TAB}">${jhHeadHtml()}<div class="jh-pane">${pane}</div><p class="fine jh-msg" id="jhMsg">${JH_MSG ? "⚠️ " + esc(JH_MSG) : ""}</p>
    <nav class="jh-tabs" aria-label="Job Hub">${jhNavHtml(JH_TAB)}</nav></div>`;
  el.classList.remove("hidden");
  if (keep) { const b = el.querySelector(".sheet-body"); b.style.animation = "none"; b.scrollTop = keep; }
}
const jhBellBtn = () => `<button class="jh-ib" data-jhtab="alerts" aria-label="Smart Alerts">${jhIco("bell")}${jhAlertCount() ? `<i class="jh-dot"></i>` : ""}</button>`;
function jhHeadHtml() {
  const roots = ["radar", "resume", "pipe", "alerts"];
  const left = JH_STACK.length ? `<button class="jh-ib" data-jhback="1" aria-label="Back">${jhIco("back")}</button>`
    : roots.includes(JH_TAB) ? `<span class="jh-ib ghost" aria-hidden="true"></span>` : `<button class="jh-ib" data-jhclose="1" aria-label="Back to Home">${jhIco("back")}</button>`;
  const j = JH_TAB === "job" ? jhJob(JH_CUR) : null, saved = j && jhQ().jobs[j.id];
  const right = j ? `<span class="jh-hr"><button class="jh-ib ${saved ? "on" : ""}" data-jhheart="${esc(j.id)}" aria-label="${saved ? "Saved - tap to take it off" : "Save this job"}" aria-pressed="${!!saved}">${jhIco("heart")}</button>${j.url ? `<button class="jh-ib" data-jhshare="${esc(j.id)}" aria-label="Share this job">${jhIco("share")}</button>` : ""}</span>` : jhBellBtn();
  return `<div class="jh-head">${left}${jhBrand()}${right}</div>`;
}
const jhNavFor = tab => ["radar", "resume", "pipe", "alerts"].includes(tab) ? tab : ["edit", "exp", "tailor"].includes(tab) ? "resume" : tab === "track" ? "pipe"
  : ["job", "fit", "emp"].includes(tab) ? (JH_STACK.includes("pipe") || JH_STACK.includes("track") ? "pipe" : JH_STACK.includes("radar") ? "radar" : "home") : "home";
function jhNavHtml(on) {
  return JH_NAV.map(([k, i, l]) => `<button class="${jhNavFor(on) === k ? "on" : ""}" ${k === "home" ? 'data-jhclose="1"' : `data-jhtab="${k}" data-jhroot="1"`}
    aria-current="${jhNavFor(on) === k ? "page" : "false"}">${jhIco(i)}<span>${l}</span></button>`).join("");
}
function jhNavEnsure() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("jh", jhSet());
  let n = document.getElementById("jhNav");
  if (!jhSet()) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement("nav"); n.id = "jhNav"; n.className = "jh-nav"; n.setAttribute("aria-label", "Job Hub"); document.body.appendChild(n); }
  n.innerHTML = jhNavHtml(JH_OPEN ? JH_TAB : "home");
}
function jhPane() {
  const P = { radar: jhRadarHtml, job: jhJobHtml, fit: jhFitHtml, emp: jhEmpHtml, track: jhTrackHtml, resume: jhResumeHtml, tailor: jhTailorHtml, edit: jhEditHtml, exp: jhExpHtml,
    pipe: jhPipeHtml, alerts: jhAlertsHtml, prefs: jhPrefsHtml, paste: jhPasteHtml, more: jhMoreHtml };
  return (P[JH_TAB] || jhRadarHtml)();
}
function jhBack() { if (JH_STACK.length) { jhReset(); showJh(JH_STACK.pop(), false); } else hideJh(); }
let JH_HSKIP = 0, JH_HPUSH = 0;
function jhHist() { try { history.pushState({ jh: 1 }, ""); JH_HPUSH = 1; } catch (e) { /* the back arrow still works */ } }
if (typeof window !== "undefined") window.addEventListener("popstate", () => {
  if (typeof MODE === "undefined" || MODE !== "job") return;
  if (JH_HSKIP) { JH_HSKIP--; return; }
  if (!JH_OPEN) return;
  JH_HPUSH = 0;
  if (JH_STACK.length) { jhBack(); jhHist(); } else hideJh(true);
});

// ------------------------------------------------------------ WELCOME: Your Next Move Starts Here
const jhStateOpts = (cur, any = "Anywhere in the US") => `<option value="">${esc(any)}</option>` + Object.keys(JH_STATES).map(k => `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(JH_STATES[k])}</option>`).join("");
const jhTypeOpts = (cur, any) => `<option value="">${esc(any)}</option>` + JH_TYPES.map(t => `<option ${cur === t ? "selected" : ""}>${t}</option>`).join("");
function jhSetupHtml() {
  jhNavEnsure(); if (JH_OPEN) hideJh();
  if (typeof document !== "undefined") document.body.classList.add("jhapp");
  const M = jh().me;
  return `<section class="card jh-home jh-hello" aria-label="Welcome to Job Hub">
    ${jhHero("", "Your Next Move", "Starts Here", "Discover the right opportunities, match your skills, and grow your career with JOB HUB.", { size: "tall", brk: true, head: `<div class="jh-top">${jhBrand()}</div>` })}
    <form class="jh-panel jh-form" data-jhsetup="1">
      <label class="jh-inp">${jhIco("search")}<input name="titles" maxlength="200" placeholder="Job title, skill, or keyword" aria-label="Job title, skill, or keyword" value="${esc(M.titles.join(", "))}" required></label>
      <label class="jh-inp">${jhIco("pin")}<select name="loc" aria-label="Location"><option value="">Location (anywhere in the US)</option><option value="remote" ${M.work.length === 1 && M.work[0] === "remote" ? "selected" : ""}>Remote</option>${Object.keys(JH_STATES).map(k => `<option value="${k}" ${M.where === k ? "selected" : ""}>${esc(JH_STATES[k])}</option>`).join("")}</select>${jhIco("down", "jh-ddi")}</label>
      <label class="jh-inp">${jhIco("bag")}<select name="type" aria-label="Job type">${jhTypeOpts(M.type, "Job type (any)")}</select>${jhIco("down", "jh-ddi")}</label>
      <p class="fine">More than one job? Separate them with commas.</p>
      <button class="jh-cta">${jhIco("search")} Find Jobs</button></form>
    <div class="jh-feats"><span>${jhIco("target")}<b>Smarter<br>Matches</b></span><span>${jhIco("cal")}<b>Faster<br>Interviews</b></span><span>${jhIco("trend")}<b>Higher<br>Earnings</b></span></div>
    <p class="fine jh-center">Everything stays on this phone. Add your pay, experience and resume any time.</p></section>`;
}

// ------------------------------------------------------------ HOME: Career Command Center
function jhDashHtml() {
  jhNavEnsure(); jhLoad(); jhVocabLoad();
  if (typeof document !== "undefined") document.body.classList.add("jhapp");
  const J = jh(), M = J.me, all = jhMatches(0, true), top = all.slice(0, 3);
  let strong = 0; for (const j of all) { if (jhScore(j) >= 70) strong++; else break; }
  const wk = addDays(today(), 7), ivs = Object.values(J.jobs).filter(x => x.st === "interview" && x.iv && x.iv.slice(0, 10) >= today() && x.iv.slice(0, 10) <= wk);
  const best = all.slice(0, strong).filter(j => j.max || j.min).sort((a, b) => (b.max || b.min) - (a.max || a.min))[0];
  const nNew = J.mon ? jhNew().filter(a => a.k === "match").length : 0, up = best && M.curPay ? Math.round(((best.max || best.min) / M.curPay - 1) * 100) : 0;
  const next = jhNextSteps().slice(0, 3);
  const feedLine = JH_FEEDERR ? esc(JH_FEEDERR) : !JH_FEED ? "Loading today's openings…" : `${JH_FEED.rows.length.toLocaleString()} openings today · ${esc(jhSources())}`;
  const head = `<div class="jh-top"><button class="jh-ib" data-jhtab="more" aria-label="More">${jhIco("menu")}</button>${jhBrand()}${jhBellBtn()}</div>`;
  return `<section class="card jh-home" aria-label="Your Career Command Center">
    ${jhHero("globe", "Career", "Command Center", "Your personalized hub for opportunities, interviews, and career growth.", { brk: true, head })}
    <div class="jh-tiles">
      <button class="jh-tile" data-jhtab="radar">${jhIco("target")}<b>${JH_FEED ? strong : "…"}</b><small>Matches</small>${nNew ? `<em class="up">+${nNew} new</em>` : `<em>for you</em>`}</button>
      <button class="jh-tile" data-jhtab="pipe">${jhIco("cal")}<b>${ivs.length}</b><small>Interviews</small><em>This week</em></button>
      <button class="jh-tile" ${best ? `data-jhjob="${esc(best.id)}"` : 'data-jhtab="prefs"'}>${jhIco("coins")}<b>${best ? jhMoney(best.max || best.min) : "—"}</b><small>Top Salary</small>${best ? (up > 0 ? `<em class="up">↑ +${up}%</em>` : `<em class="cl">${esc(best.t)}</em>`) : `<em>Set your pay</em>`}</button></div>
    ${jhTrialHtml()}
    <div class="jh-sec"><h3 class="jh-h3">Top Job Matches for You</h3><button class="jh-all" data-jhtab="radar" data-jhroot="1">View All ›</button></div>
    ${top.length ? top.map(j => jhRowHtml(j, "Match")).join("") : `<p class="jh-empty">${JH_FEEDERR ? esc(JH_FEEDERR) : !JH_FEED ? "Loading today's openings…" : "No openings match yet - try another job title under What I'm Looking For."}</p>`}
    <div class="jh-sec"><h3 class="jh-h3">Top Jobs in the Market</h3><button class="jh-all" data-jhtab="radar" data-jhroot="1">View All ›</button></div>
    <div class="jh-cats">${JH_CATS.map(([k, l, i]) => `<button class="jh-cat" data-jhcat="${k}">${jhIco(i)}${l}</button>`).join("")}</div>
    ${next.length ? `<div class="jh-sec"><h3 class="jh-h3">Your Next Steps</h3></div>${next.map(jhStepHtml).join("")}` : ""}
    <button class="jh-btn alt" data-jhtab="paste">${jhIco("plus")} Check a job I found</button>
    <p class="fine jh-feed">${feedLine}</p></section>`;
}
function jhSources() { const c = JH_FEED ? JH_FEED.counts : {}, names = Object.keys(c).filter(k => c[k] > 0); return names.length ? "from " + names.join(", ") : "from employers' own job boards"; }
function jhRowHtml(j, word = "Match") {
  const s = jhScore(j), saved = jhQ().jobs[j.id];
  return `<div class="jh-rw"><button class="jh-row" data-jhjob="${esc(j.id)}">${jhLogoBadge(j.co)}<span class="grow"><b>${esc(j.t)}</b><small>${esc(j.co || "Employer not listed")}</small><small class="jh-loc">${jhIco("pin")}${esc(jhWhere(j))}${j.type ? " · " + esc(j.type) : ""}</small></span>
    <span class="jh-rt"><b class="jh-pay">${esc(jhPayTxt(j))}</b><span class="jh-pill ${s >= 85 ? "hi" : s >= 70 ? "ok" : ""}">${s}% ${word}</span></span></button>
    <button class="jh-heart ${saved ? "on" : ""}" data-jhheart="${esc(j.id)}" aria-label="${saved ? "Saved - tap to take it off" : "Save this job"}" aria-pressed="${!!saved}">${jhIco("heart")}</button></div>`;
}

// ------------------------------------------------------------ JOB RADAR
function jhRadarHtml() {
  const M = jh().me, all = JH_FEED ? jhMatches() : [], list = all.slice(0, JH_N);
  let n85 = 0; for (const j of all) { if (jhScore(j) >= 85) n85++; else break; }
  const sel = (k, label, opts, cur) => `<label class="jh-dd"><select data-jhsel="${k}" aria-label="${esc(label)}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>${jhIco("down")}</label>`;
  const roles = [["", M.titles.length > 1 ? "All my roles" : M.titles[0] || "All roles"], ...(M.titles.length > 1 ? M.titles.map((t, i) => ["t:" + i, t]) : []), ...JH_CATS.map(([k, l]) => ["c:" + k, l])];
  const work = [["any", "Any style"], ["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On-site"], ...(M.where ? [["near", "Near me (" + M.where + ")"]] : [])];
  const pays = [0, 50000, 75000, 100000, 140000, 180000]; if (M.minPay && !pays.includes(M.minPay)) pays.push(M.minPay); pays.sort((a, b) => a - b);
  const laurel = `<div class="jh-laur">${jhLaurel("l")}<span><b>85%+</b><small>${n85.toLocaleString()} ${n85 === 1 ? "match" : "matches"}<br>detected</small></span>${jhLaurel("r")}</div>`;
  return `${jhHero("", "Job", "Radar", "Scan the job market and discover high-match opportunities in real time.", { radar: jhRadarSvg(list), extra: laurel, size: "radar" })}
    <form class="jh-search" data-jhsearch="1" role="search">${jhIco("search")}<input name="q" placeholder="Search & Filter Jobs" aria-label="Search jobs" value="${esc(JH_Q)}" autocomplete="off"><button type="button" class="jh-fbtn" data-jhtab="prefs" aria-label="What I'm looking for">${jhIco("filter")}</button></form>
    <div class="jh-dds">${sel("role", "Role", roles, JH_ROLE)}${sel("work", "Work style", work, JH_F.work)}${sel("pay", "Salary", pays.map(p => [p, p ? jhMoney(p) + "+" : "Any pay"]), JH_F.pay)}</div>
    ${JH_FEEDERR ? `<p class="jh-empty">${esc(JH_FEEDERR)} <button class="jh-link" data-jhreload="1">Try again</button></p>` : !JH_FEED ? `<p class="jh-empty">Loading today's openings…</p>`
    : !list.length ? `<p class="jh-empty">No openings match right now. Try fewer filters, or search a different title.</p>`
    : `<div class="jh-sec"><h3 class="jh-h3">Matching Jobs${n85 && n85 === all.length ? ` <span class="g">(85%+ Fit)</span>` : ""}</h3><span class="jh-res">${all.length.toLocaleString()} ${all.length === 1 ? "Result" : "Results"}</span></div>
      ${list.map(j => jhRowHtml(j, "Fit")).join("")}
      ${all.length > JH_N ? `<button class="jh-btn alt" data-jhmore="1">Show more (${(all.length - JH_N).toLocaleString()} left)</button>` : ""}`}
    <p class="fine">Openings come from employers' own job boards, Jobicy (remote jobs) and USAJOBS (federal jobs), refreshed every day. Apply opens the employer's own posting.</p>`;
}

// ------------------------------------------------------------ THE JOB: Overview · Pay · Company · Requirements
function jhJobHtml() {
  const j = jhJob(JH_CUR);
  if (!j) return `${jhHero("building", "", "", "", { size: "short", dim: true })}<p class="jh-empty">That job isn't in today's list any more. <button class="jh-link" data-jhtab="radar" data-jhroot="1">Back to Job Radar</button></p>`;
  const J = jh(), saved = J.jobs[j.id], s = jhScore(j), det = jhDetail(j), tab = (k, l) => `<button class="${JH_JTAB === k ? "on" : ""}" data-jhjtab="${k}" aria-pressed="${JH_JTAB === k}">${l}</button>`;
  const body = JH_JTAB === "pay" ? jhPayTabHtml(j) : JH_JTAB === "comp" ? jhCompHtml(j) : JH_JTAB === "req" ? jhReqHtml(j, det) : jhOverHtml(j, det);
  return `${jhHero("building", "", "", "", { size: "short", dim: true })}
    <div class="jh-jobcard">${jhLogoBadge(j.co, true)}<span class="grow"><b>${esc(j.t)}</b>${j.co && !j.pasted ? `<button class="jh-colink" data-jhemp="${esc(j.co)}">${esc(j.co)}</button>` : `<small>${esc(j.co || "Employer not listed")}</small>`}
      <small class="jh-loc">${jhIco("pin")}${esc(jhWhere(j))}${j.type ? " · " + esc(j.type) : ""}</small></span></div>
    ${j.gone ? `<p class="fine">This posting has left today's list - it may be filled. Your saved copy stays here.</p>` : ""}
    <div class="jh-fitrow"><button class="jh-fitbox" data-jhtab="fit">${jhIco("target")}<span><small>Fit Score</small><b>${s}%</b></span></button>
      ${j.url ? `<a class="jh-apply" href="${esc(j.url)}" target="_blank" rel="noopener" data-jhapply="${esc(j.id)}">Apply Now ${jhIco("ext")}</a>` : `<span class="jh-apply off">No link saved</span>`}</div>
    <div class="jh-seg four" role="group" aria-label="About this job">${tab("over", "Overview")}${tab("pay", "Pay")}${tab("comp", "Company")}${tab("req", "Requirements")}</div>
    ${body}
    ${saved ? `<button class="jh-inpipe" data-jhtrack="${esc(j.id)}">${jhIco("bookmark")}<span class="grow"><b>In your pipeline · ${esc(jhStageName(saved.st))}</b><small>Dates, follow-up and notes in the Saved Role Tracker</small></span>${jhIco("right")}</button>`
      : `<button class="jh-btn gold" data-jhheart="${esc(j.id)}">${jhIco("heart")} Save Role</button><button class="jh-link" data-jhhide="${esc(j.id)}">Not for me - hide this job</button>`}
    ${j.pasted ? `<button class="jh-link danger" data-jhpdel="${esc(j.id)}">${JH_ARM === "pdel:" + j.id ? "Tap again to remove this job" : "Remove this job"}</button>` : ""}`;
}
function jhBar(label, val, max, cls, txt) { const pct = max ? Math.max(4, Math.min(100, Math.round(val / max * 100))) : 0;
  return `<div class="jh-bar"><span>${esc(label)}</span><b>${esc(txt)}</b><i class="${cls}"><em style="width:${pct}%"></em></i></div>`; }
function jhPayBars(j) {
  const M = jh().me, mk = jhMarket(j), mine = M.curPay, hi = j.max || j.min || 0, top = Math.max(hi, mk && mk.mid || 0, mine || 0) * 1.08;
  if (!hi && !(mk && mk.mid)) return `<p class="fine">This employer didn't post pay.${mk && mk.n >= 3 ? "" : " Not enough similar jobs posted pay to compare yet."}</p>${mine ? "" : `<button class="jh-link" data-jhtab="prefs">Add your current pay to compare (private)</button>`}`;
  return `${hi ? jhBar("This role", hi, top, "gold", jhPayTxt(j)) : jhBar("This role", 0, top, "gold", "Not posted")}
    ${mk && mk.mid ? jhBar("Market average", mk.mid, top, "teal", jhMoney(mk.mid)) : ""}
    ${mine ? jhBar("Your current pay", mine, top, "blue", jhMoney(mine)) : `<button class="jh-link" data-jhtab="prefs">Add your current pay to compare (private)</button>`}
    ${mk && mk.mid ? `<p class="fine">Market average = the middle of posted pay for ${mk.n} similar openings in today's list (most pay ${jhMoney(mk.lo)} – ${jhMoney(mk.hi)}).</p>` : ""}`;
}
function jhEmpTiles(co) {
  const st = jhEmpStats(co);
  return `<div class="jh-etiles"><span>${jhIco("bag")}<b>${st.n}</b><small>Openings today</small></span><span>${jhIco("globe")}<b>${st.n ? st.remote + "%" : "—"}</b><small>Remote</small></span>
    <span>${jhIco("pin")}<b>${st.states.length || "—"}</b><small>${st.states.length === 1 ? "State" : "States"}</small></span><span>${jhIco("coins")}<b>${st.pmid ? jhMoney(st.pmid) : "—"}</b><small>Middle pay</small></span></div>`;
}
function jhOverHtml(j, det) {
  const st = j.co && !j.pasted ? jhEmpStats(j.co) : null;
  const about = j.pasted ? (j.text ? `<p class="jh-about">${esc(j.text.slice(0, 900))}${j.text.length > 900 ? "…" : ""}</p>` : "")
    : det === null ? `<p class="fine">Loading the job's details…</p>` : det.sum ? `<p class="jh-about">${esc(det.sum)}</p>` : "";
  return `<section class="jh-box"><div class="jh-boxh"><h3 class="jh-h3">Pay Comparison</h3><small>Annual total (USD)</small></div>${jhPayBars(j)}</section>
    ${st && st.n ? `<section class="jh-box"><div class="jh-boxh"><h3 class="jh-h3">${jhIco("building")} About the Employer</h3></div><p class="jh-about">${esc(jhEmpLine(j.co, st))}</p>${jhEmpTiles(j.co)}
      <button class="jh-link" data-jhemp="${esc(j.co)}">See ${esc(j.co)}'s page ›</button></section>` : ""}
    <section class="jh-box"><h3 class="jh-h3">About the Role</h3>${about || `<p class="fine">Open the full posting for the details.</p>`}
      <p class="fine">${j.d ? "Posted " + esc(prettyDate(j.d)) + " · " : ""}${j.pasted ? "A job you added" : "From " + esc(j.src || "a saved copy")}${det && det.type ? " · " + esc(det.type) : ""}${det && det.dept ? " · " + esc(det.dept) : ""}</p></section>`;
}
function jhPayTabHtml(j) {
  const M = jh().me, hi = j.max || j.min || 0, up = hi && M.curPay ? Math.round((hi / M.curPay - 1) * 100) : null;
  const lines = [hi ? `Posted pay: <b>${esc(jhPayTxt(j))}</b>${j.per && j.per !== "year" ? ` (posted ${esc(j.per === "hour" ? "by the hour - shown as a year at 2,080 hours" : "per " + j.per)})` : " a year"}` : "This employer didn't post pay.",
    M.minPay ? (hi ? (hi >= M.minPay ? `Meets your ${esc(jhMoney(M.minPay))} floor.` : `Below your ${esc(jhMoney(M.minPay))} floor.`) : "") : `No pay floor set. <button class="jh-link" data-jhtab="prefs">Set one</button>`,
    up != null ? (up >= 0 ? `About ${up}% more than your current pay.` : `About ${-up}% less than your current pay.`) : ""].filter(Boolean);
  return `<section class="jh-box"><div class="jh-boxh"><h3 class="jh-h3">Pay Comparison</h3><small>Annual total (USD)</small></div>${jhPayBars(j)}</section>
    <section class="jh-box"><h3 class="jh-h3">${jhIco("coins")} What it pays</h3>${lines.map(l => `<p class="jh-line">${l}</p>`).join("")}<p class="fine">Your current pay never leaves this phone.</p></section>`;
}
function jhEmpLine(co, st) {   // one plain sentence built only from today's postings
  return `${co} has ${jhPl(st.n, "opening")} in today's list${st.ind ? ` (${st.ind})` : ""}${st.cats.length ? `, most of them ${st.cats[0][0].toLowerCase()} roles` : ""}${st.n ? `; ${st.remote}% can be done remotely` : ""}.`;
}
function jhCompHtml(j) {
  if (!j.co || j.pasted) return `<section class="jh-box"><p class="fine">${j.pasted ? "A job you added - Job Hub has no list of this employer's other openings." : "The employer isn't named in this posting."}</p></section>`;
  const st = jhEmpStats(j.co), others = st.rows.filter(x => x.id !== j.id);
  return `<section class="jh-box"><div class="jh-boxh"><h3 class="jh-h3">${jhIco("building")} About the Employer</h3></div>${st.n ? `<p class="jh-about">${esc(jhEmpLine(j.co, st))}</p>${jhEmpTiles(j.co)}` : `<p class="fine">${esc(j.co)} has no other openings in today's list.</p>`}
      <p class="fine">Job Hub shows only what the postings say. Size, culture and reviews aren't in them, so they aren't guessed.</p></section>
    ${others.length ? `<div class="jh-sec"><h3 class="jh-h3">Other Openings at ${esc(j.co)}</h3><button class="jh-all" data-jhemp="${esc(j.co)}">View All ›</button></div>${others.slice(0, 3).map(x => jhRowHtml(x)).join("")}` : ""}
    <button class="jh-btn alt" data-jhemp="${esc(j.co)}">${jhIco("building")} ${esc(j.co)}'s employer page</button>`;
}
function jhKwHtml(E) {
  return E.empty ? `<p class="fine">Add your resume and Job Hub shows which of this job's asks you already have.</p><button class="jh-btn alt" data-jhtab="edit">${jhIco("doc")} Add my resume</button>`
    : `${E.has.length ? `<div class="jh-kw">${E.has.map(k => `<span class="yes">${jhIco("check")}${esc(k)}</span>`).join("")}</div>` : `<p class="fine">None of this job's key words are on your resume yet.</p>`}
       ${E.miss.length ? `<h4 class="jh-h4">Not on your resume</h4><div class="jh-kw">${E.miss.map(k => `<span class="no">${esc(k)}</span>`).join("")}</div><p class="fine">Only add the ones that are true for you - never invent experience.</p>` : ""}`;
}
function jhReqHtml(j, det) {
  const E = jhEvidence(j), saved = jhQ().jobs[j.id];
  return `<section class="jh-box"><h3 class="jh-h3">What They Ask For</h3>${det === null ? `<p class="fine">Loading the job's details…</p>` : (det.req || []).length ? `<ul class="jh-req">${det.req.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : `<p class="fine">The posting doesn't list them separately - open the full posting for the details.</p>`}
      ${E.yrs ? `<p class="jh-line">${jhIco("bag")} They ask for about ${E.yrs}+ years of experience.</p>` : ""}</section>
    <section class="jh-box"><h3 class="jh-h3">From Your Resume</h3>${jhKwHtml(E)}</section>
    <div class="jh-actions"><button class="jh-btn line" data-jhtab="fit">${jhIco("target")} Career Fit</button>${saved ? `<button class="jh-btn gold" data-jhtailorgo="${esc(j.id)}">${jhIco("spark")} Tailor Resume</button>` : `<button class="jh-btn gold" data-jhheart="${esc(j.id)}">${jhIco("heart")} Save to Tailor</button>`}</div>`;
}

// ------------------------------------------------------------ CAREER FIT
function jhFitHtml() {
  const j = jhJob(JH_CUR);
  if (!j) return `<p class="jh-empty">That job isn't here any more.</p>`;
  const s = jhScore(j), { f, E, goal } = jhFactors(j), W = jh().me.w;
  const rows = [["code", "Skills match", f.match, W.match], ["bag", "Experience level", f.exp, W.exp], ["layers", "Industry fit", f.ind, W.ind], ["target", "Career goals", goal, null],
    ["pin", "Location & work style", f.remote, W.remote], ["dollar", "Pay", f.pay, W.pay]];
  return `${jhHero("peak", "Career", "Fit", "See how well this role matches your skills, experience, and career goals.")}
    <button class="jh-fitfor" data-jhjob="${esc(j.id)}">${esc(j.t)}${j.co ? " · " + esc(j.co) : ""} ›</button>
    ${jhRingWrap(s, jhFitWord(s), "Career Fit Score")}
    <section class="jh-box"><h3 class="jh-h3">Compatibility Breakdown</h3>
      ${rows.map(([i, l, v, w]) => `<div class="jh-fac">${jhIco(i)}<span>${l}${w != null ? ` <small>${w}%</small>` : ""}</span><i><em style="width:${v == null ? 50 : Math.round(v * 100)}%" class="${v == null ? "unk" : ""}"></em></i><b>${v == null ? "not known" : Math.round(v * 100) + "%"}</b></div>`).join("")}
      <p class="fine">"Not known" = the posting or your profile doesn't say. It counts halfway - never a guess. Add your experience and industries under <button class="jh-link" data-jhtab="prefs">What I'm Looking For</button>.</p></section>
    <section class="jh-box gold"><h3 class="jh-h3">${jhIco("key")} Missing Keywords <span class="g">(Add to Your Resume)</span></h3>
      ${E.empty ? jhKwHtml(E) : E.miss.length ? `<div class="jh-kw">${E.miss.map(k => `<span class="no">${esc(k)}</span>`).join("")}</div><p class="fine">Only add the ones that are true for you - never invent experience.</p>` : `<p class="fine">Your resume already has every key word this job lists.</p>`}
      ${!E.empty && E.has.length ? `<h4 class="jh-h4">On your resume</h4><div class="jh-kw">${E.has.map(k => `<span class="yes">${jhIco("check")}${esc(k)}</span>`).join("")}</div>` : ""}
      ${E.yrs ? `<p class="fine">They ask for about ${E.yrs}+ years of experience.</p>` : ""}</section>`;
}

// ------------------------------------------------------------ EMPLOYER
function jhEmpHtml() {
  const co = JH_EMP, st = jhEmpStats(co), fol = jh().follow.includes(co), tab = (k, l) => `<button class="${JH_ETAB === k ? "on" : ""}" data-jhetab="${k}" aria-pressed="${JH_ETAB === k}">${l}</button>`;
  const card = `<div class="jh-empcard">${jhLogoBadge(co, true)}<span class="grow"><b>${esc(co)}</b><small>${esc([st.ind, st.n ? jhPl(st.n, "opening") + " today" : ""].filter(Boolean).join(" · ") || "Not in today's list")}</small>
      ${st.loc ? `<small class="jh-loc">${jhIco("pin")}${esc(st.loc)}${st.states.length > 1 ? ` · ${st.states.length} states` : ""}</small>` : ""}</span>
      <button class="jh-ib ${fol ? "on" : ""}" data-jhfollow="${esc(co)}" aria-pressed="${fol}" aria-label="${fol ? "Following - tap to stop" : "Follow: new openings show on Smart Alerts"}">${jhIco("heart")}</button></div>`;
  let body = "";
  if (JH_ETAB === "open") body = st.n ? st.rows.slice(0, 60).map(x => jhRowHtml(x)).join("") + (st.n > 60 ? `<p class="fine">Showing 60 of ${st.n}. See them all on their own job board.</p>` : "") : `<p class="jh-empty">No openings in today's list.</p>`;
  else if (JH_ETAB === "ins") {
    const bar = (l, n, max) => `<div class="jh-bar"><span>${esc(l)}</span><b>${n}</b><i class="teal"><em style="width:${max ? Math.max(4, Math.round(n / max * 100)) : 0}%"></em></i></div>`;
    body = !st.n ? `<p class="jh-empty">No openings in today's list to learn from.</p>` : `
      <section class="jh-box"><h3 class="jh-h3">${jhIco("coins")} Posted Pay</h3>${st.pmid ? `<p class="jh-line">From <b>${jhMoney(st.pmin)}</b> to <b>${jhMoney(st.pmax)}</b>, middle <b>${jhMoney(st.pmid)}</b></p>` : `<p class="fine">None of today's openings posted pay.</p>`}</section>
      <section class="jh-box"><h3 class="jh-h3">${jhIco("chart")} Kinds of Jobs</h3>${st.cats.length ? st.cats.slice(0, 5).map(([l, n]) => bar(l, n, st.cats[0][1])).join("") : `<p class="fine">Mixed roles.</p>`}</section>
      <section class="jh-box"><h3 class="jh-h3">${jhIco("pin")} Where</h3>${st.states.slice(0, 5).map(k => bar(JH_STATES[k] || k, st.stc[k], st.stc[st.states[0]])).join("")}
        ${bar("Remote", st.sty.remote, st.n)}${bar("Hybrid", st.sty.hybrid, st.n)}${bar("On-site", st.sty.onsite, st.n)}</section>
      <p class="fine">Built from ${jhPl(st.n, "posting")} in today's list${st.newest ? `, newest ${esc(prettyDate(st.newest))}` : ""}. Reviews and ratings aren't in postings, so Job Hub doesn't show any.</p>`;
  } else body = `<section class="jh-box"><h3 class="jh-h3">Company Overview</h3><p class="jh-about">${st.n ? esc(jhEmpLine(co, st)) : esc(co) + " has no openings in today's list."}</p><p class="fine">From today's postings. Job Hub doesn't guess size, culture or reviews.</p>${st.n ? jhEmpTiles(co) : ""}</section>
      ${st.n ? `<div class="jh-sec"><h3 class="jh-h3">Openings at ${esc(co)}</h3><button class="jh-all" data-jhetab="open">View All ›</button></div>${st.rows.slice(0, 2).map(x => jhRowHtml(x)).join("")}` : ""}`;
  return `${jhHero("building", "Employer", "", `Explore the company, open roles, and opportunities to grow with ${co}.`)}
    ${card}<div class="jh-seg" role="group" aria-label="About ${esc(co)}">${tab("over", "Overview")}${tab("open", `Openings (${st.n})`)}${tab("ins", "Insights")}</div>${body}
    ${st.board ? `<a class="jh-btn gold" href="${esc(st.board)}" target="_blank" rel="noopener">${jhIco("ext")} View Company Job Board</a>` : ""}`;
}

// ------------------------------------------------------------ SAVED ROLE TRACKER (one saved job)
function jhTrackHtml() {
  const J = jh(), x = J.jobs[JH_CUR];
  if (!x) return `${jhHero("cal", "Saved Role", "Tracker", "")}<p class="jh-empty">That job isn't in your pipeline any more. <button class="jh-link" data-jhtab="pipe" data-jhroot="1">Open your pipeline</button></p>`;
  const all = Object.values(J.jobs), cnt = k => all.filter(y => y.st === k).length, idx = k => JH_STAGES5.findIndex(s => s[0] === k), j = jhJob(x.id), s = jhScore(j);
  return `${jhHero("cal", "Saved Role", "Tracker", "Track your saved jobs, applications, interviews, offers, and outcomes in one place.")}
    <div class="jh-steps">${JH_STAGES5.map(([k, i, l]) => `<button class="${x.st === k ? "on" : idx(k) < idx(x.st) && x.st !== "closed" ? "done" : ""}" data-jhstage="${k}" data-jhid="${esc(x.id)}" aria-pressed="${x.st === k}"><span>${jhIco(i)}</span><b>${l}</b><small>(${cnt(k)})</small></button>`).join("")}</div>
    <button class="jh-trackcard" data-jhjob="${esc(x.id)}">${jhLogoBadge(x.co)}<span class="grow"><b>${esc(x.t)}</b><small>${esc(x.co || "Employer not listed")}</small>${x.loc ? `<small class="jh-loc">${jhIco("pin")}${esc(jhLocNice(x.loc))}</small>` : ""}</span><span class="jh-stpill ${x.st}">${esc(jhStageName(x.st))}</span>${jhIco("right")}</button>
    <div class="jh-trackf">
      <label class="jh-trow">${jhIco("cal")}<span class="grow"><small>Interview Date & Time</small><input type="datetime-local" data-jhtf="iv" value="${esc(x.iv)}" aria-label="Interview date and time"></span></label>
      <div class="jh-trow">${jhIco("clock")}<span class="grow"><small>Follow-Up</small><input type="date" data-jhtf="fu" value="${esc(x.fu)}" aria-label="Follow up on">
        <input data-jhtf="fuNote" maxlength="120" placeholder="${x.st === "interview" || x.iv ? "Send a thank-you note after the interview" : "Check in on your application"}" value="${esc(x.fuNote)}" aria-label="Follow-up note"></span>
        <button type="button" class="jh-chk ${x.fuDone ? "on" : ""}" data-jhfudone="${esc(x.id)}" aria-pressed="${x.fuDone}" aria-label="${x.fuDone ? "Follow-up done" : "Mark the follow-up done"}">${jhIco("check")}</button></div>
      <label class="jh-trow">${jhIco("note")}<span class="grow"><small>Notes</small><textarea data-jhtf="note" rows="3" maxlength="600" placeholder="Who you talked to, what's next…" aria-label="Notes">${esc(x.note)}</textarea></span></label></div>
    <h3 class="jh-h3">Role Details</h3>
    <div class="jh-two"><div class="jh-stat">${jhIco("coins")}<span><small>Salary</small><b>${esc(jhPayTxt(x))}</b></span></div><button class="jh-stat" data-jhfitfor="${esc(x.id)}">${jhIco("target")}<span><small>Match Score</small><b class="t">${s}% Fit</b></span></button></div>
    <div class="jh-actions"><button class="jh-btn line" data-jhjob="${esc(x.id)}">${jhIco("search")} View Job</button>
      <label class="jh-btn gold jh-stsel"><span>Update Stage</span>${jhIco("down")}<select data-jhstagesel="${esc(x.id)}" aria-label="Update stage">${JH_STAGES5.map(([k, , l]) => `<option value="${k}" ${x.st === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <button class="jh-link danger" data-jhunsave="${esc(x.id)}">${JH_ARM === "uns:" + x.id ? "Tap again to take it off your pipeline" : "Take it off my pipeline"}</button>`;
}

// ------------------------------------------------------------ OPPORTUNITY PIPELINE
function jhPipeHtml() {
  const J = jh(), all = Object.values(J.jobs), wk = addDays(today(), -7), of = k => all.filter(x => x.st === k), nw = k => of(k).filter(x => (x.stAt || x.add) >= wk).length;
  const ord = k => JH_STAGES5.findIndex(s => s[0] === k), list = (JH_PF ? of(JH_PF) : all).sort((a, b) => ord(b.st) - ord(a.st) || (b.stAt > a.stAt ? 1 : -1));
  if (!JH_PF) list.sort((a, b) => (a.st === "closed") - (b.st === "closed"));
  return `${jhHero("road", "Opportunity", "Pipeline", "Track every opportunity from saved to offer and keep your career moving forward.", { brk: true })}
    <div class="jh-ptiles">${JH_STAGES.map(([k, i, l]) => `<button class="jh-pt ${k} ${JH_PF === k ? "on" : ""}" data-jhpf="${k}" aria-pressed="${JH_PF === k}">${jhIco(i)}<small>${l}</small><b>${of(k).length}</b><em>${nw(k) ? "+" + nw(k) : "0"} new</em></button>`).join("")}</div>
    ${all.length ? `<div class="jh-sec"><h3 class="jh-h3">${JH_PF ? esc(jhStageName(JH_PF)) : "Pipeline Opportunities"} (${list.length})</h3>${JH_PF ? `<button class="jh-all" data-jhpf="${JH_PF}">View All ›</button>` : ""}</div>
      ${list.map(x => `<div class="jh-rw"><button class="jh-row" data-jhtrack="${esc(x.id)}">${jhLogoBadge(x.co)}<span class="grow"><b>${esc(x.t)}</b><small>${esc(x.co || "Employer not listed")} <span class="jh-stpill ${x.st}">${esc(jhStageName(x.st))}</span></small>${x.iv && x.st === "interview" ? `<small class="jh-loc">${jhIco("cal")}${esc(jhDayWord(x.iv.slice(0, 10)))} · ${esc(jhTime12(x.iv.slice(11, 16)))}</small>` : ""}</span>
        <span class="jh-rt"><b class="jh-pay">${esc(jhPayTxt(x))}</b></span></button><button class="jh-heart on" data-jhheart="${esc(x.id)}" aria-label="Saved - tap to take it off" aria-pressed="true">${jhIco("heart")}</button></div>`).join("") || `<p class="jh-empty">Nothing in ${esc(jhStageName(JH_PF))} yet.</p>`}`
    : `<p class="jh-empty">Nothing here yet. Save a role on Job Radar (the ♥) and it starts in Saved - then move it along as you apply and interview.</p><button class="jh-btn gold" data-jhtab="radar" data-jhroot="1">${jhIco("radar")} Open Job Radar</button>`}`;
}

// ------------------------------------------------------------ SMART ALERTS
function jhNextSteps() {
  const J = jh(), t = today(), out = [];
  Object.values(J.jobs).forEach(x => {
    if (x.st === "interview" && x.iv && x.iv.slice(0, 10) >= t && x.iv.slice(0, 10) <= addDays(t, 7)) out.push({ k: "iv", x, when: x.iv });
    if ((x.st === "applied" || x.st === "interview") && !x.fuDone && ((x.fu && x.fu <= t) || (x.st === "applied" && !x.fu && x.appl && x.appl <= addDays(t, -7)))) out.push({ k: "fu", x, when: x.fu || addDays(x.appl, 7) });
  });
  return out.sort((a, b) => a.k !== b.k ? (a.k === "iv" ? -1 : 1) : a.when < b.when ? -1 : 1);   // interviews first, then follow-ups, soonest first
}
function jhNew() {                 // strong matches + openings at followed employers posted since Alerts was last opened, not shown there yet
  if (!JH_FEED) return [];
  const J = jh(), since = (J.seen || addDays(today(), -2)).slice(0, 10), shown = new Set(J.seenIds), out = [];
  jhMatches(40, true).forEach(j => { if (out.length < 5 && jhScore(j) >= 75 && j.d && j.d >= since && !shown.has(j.id)) out.push({ k: "match", j }); });
  if (J.follow.length) { const fol = new Set(J.follow); let n = 0;
    for (const j of JH_FEED.rows) { if (n >= 5) break; if (fol.has(j.co) && j.d >= since && !shown.has(j.id) && !out.some(a => a.j === j)) { out.push({ k: "follow", j }); n++; } } }
  return out;
}
const jhAlertCount = () => !jhSet() ? 0 : jhNextSteps().length + (jh().mon ? jhNew().length : 0);
function jhStepHtml(a) {
  const x = a.x, iv = a.k === "iv";
  const when = iv ? `${jhDayWord(a.when.slice(0, 10))}, ${jhTime12(a.when.slice(11, 16))}` : jhDayWord(a.when);
  const txt = iv ? `Interview${x.co ? " with " + x.co : ""} - ${x.t}` : `${x.fuNote || "It's a good time to follow up on your application"}${x.co ? " at " + x.co : ""}.`;
  return `<button class="jh-alert ${a.k}" data-jhtrack="${esc(x.id)}"><span class="jh-aic">${jhIco(iv ? "cal" : "bolt")}</span><span class="grow"><b>${iv ? "Interview Reminder" : "Follow-up Cue"}</b><small>${esc(txt)}</small></span><em>${esc(when)}</em>${jhIco("right", "jh-go")}</button>`;
}
function jhAlertsHtml() {
  const J = jh(), steps = jhNextSteps(), all = J.mon ? jhNew() : [], nw = all.slice(0, 3);
  const html = `${jhHero("bell", "Smart", "Alerts", "Real-time updates on new matches, interviews, and next steps, so you never miss an opportunity.")}
    <label class="jh-mon">${jhIco("wave", "jh-monic")}<span class="grow"><b>Monitoring for Opportunities</b><small>Get alerts for new matches, interview updates, and follow-ups.</small></span><input type="checkbox" class="jh-switch" data-jhmon="1" ${J.mon ? "checked" : ""} aria-label="Monitoring for opportunities"></label>
    <div class="jh-sec"><h3 class="jh-h3">Alert Timeline</h3><button class="jh-all" data-jhclose="1" data-open="sheet">Manage ›</button></div>
    <div class="jh-timeline">${nw.map(({ k, j }) => `<button class="jh-alert new" data-jhjob="${esc(j.id)}"><span class="jh-aic">${jhIco(k === "follow" ? "building" : "search")}</span><span class="grow"><b>${k === "follow" ? "New Opening" : "New Match"}</b><small>${esc(j.t)}${j.co ? " at " + esc(j.co) : ""}${k === "match" ? ` (${jhScore(j)}% fit)` : ""}</small></span><em>${esc(jhDayWord(j.d))}</em>${jhIco("right", "jh-go")}</button>`).join("")}
      ${all.length > 3 ? `<button class="jh-link" data-jhtab="radar" data-jhroot="1">${all.length - 3} more new ${all.length - 3 === 1 ? "match" : "matches"} on Job Radar ›</button>` : ""}
      ${steps.map(jhStepHtml).join("")}
      ${!nw.length && !steps.length ? `<p class="jh-empty">All quiet. New strong matches, interview reminders and follow-up cues show up here.</p>` : ""}</div>
    <p class="fine">Phone reminders for interviews and follow-ups also need ⚙ Settings → Reminders on.</p>`;
  // Opening Alerts marks what it showed as seen: a job posted today alerts once, not all day (posted dates are days, not times).
  if (JH_FEED && (J.seen !== JH_FEED.made || all.length)) { J.seen = JH_FEED.made || today(); J.seenIds = [...J.seenIds, ...all.map(a => a.j.id)].slice(-300); save(); }
  return html;
}

// ------------------------------------------------------------ RESUME STUDIO · TAILOR TO A JOB · EDIT MY RESUME
function jhResumeChecks() {
  const V = jh().cv, L = jhLines(), nums = L.filter(b => /\d/.test(b)).length, verbs = L.filter(b => JH_VERBS.test(b.trim())).length, out = [];
  if (!L.length) out.push("Add 3 to 6 short lines about what you did - each one a result, not a duty.");
  else { if (nums < Math.min(3, L.length)) out.push(`Put a number in more of your lines (${nums} of ${L.length} have one) - how many, how much, how fast.`);
    if (verbs < Math.ceil(L.length / 2)) out.push("Start each line with a strong verb: Led, Built, Cut, Grew, Trained, Saved.");
    const long = L.filter(b => b.length > 180).length; if (long) out.push(`Shorten ${jhPl(long, "long line")} - one idea per line.`); }
  if (!V.sum) out.push("Add a 2-3 line summary at the top: who you are and the result you bring.");
  else if (V.sum.length > 420) out.push("Your summary is long - keep it to 2-3 lines.");
  if (V.skills.length < 5) out.push("List at least 5 skills the jobs you want ask for.");
  const asked = {}; Object.values(jh().jobs).forEach(x => { const j = jhJob(x.id); (j && j.kw || []).forEach(k => { if (!/^years:/.test(k)) asked[k] = (asked[k] || 0) + 1; }); });
  const rt = jhResumeText(), gap = Object.keys(asked).filter(k => !rt.includes(" " + k + " ")).sort((a, b) => asked[b] - asked[a]).slice(0, 5);
  if (gap.length) out.push(`Your saved jobs ask for ${gap.join(", ")} - add them only if you have them.`);
  return { out, nums, verbs };
}
const jhBestLine = () => { const L = jhLines(); return L.find(b => /\d/.test(b) && JH_VERBS.test(b.trim())) || L.find(b => /\d/.test(b)) || ""; };
const jhDates = e => e.from ? `${jhMonth(e.from)} – ${e.to ? jhMonth(e.to) : "Present"}` : e.to ? jhMonth(e.to) : "";
function jhResumeTxt() {
  const V = jh().cv;
  return [V.name || S.name || "", V.head, "", V.sum ? "SUMMARY\n" + V.sum : "", V.exp.length ? "EXPERIENCE\n" + V.exp.map(e => [[e.t, e.co].filter(Boolean).join(" - ") + (jhDates(e) ? ` (${jhDates(e)})` : ""), ...e.bul.map(b => "• " + b)].join("\n")).join("\n\n") : "",
    V.skills.length ? "SKILLS\n" + V.skills.join(", ") : ""].filter((x, i) => x || i === 2).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function jhResumeHtml() {
  const V = jh().cv, C = jhResumeChecks(), best = jhBestLine(), has = !!(V.name || V.sum || V.exp.length || V.skills.length);
  const paper = has ? `<small class="jh-rlabel">RESUME</small><h2>${esc(V.name || S.name || "Your name")}</h2><p class="jh-rhead">${esc(V.head)}</p>
      ${V.sum ? `<h4>Summary</h4><p>${esc(V.sum)}</p>` : ""}${V.exp.length ? `<h4>Experience</h4>${V.exp.map(e => `<p class="jh-pe"><b>${esc(e.t)}</b>${e.co ? ` · ${esc(e.co)}` : ""}${jhDates(e) ? `<small>${esc(jhDates(e))}</small>` : ""}</p>${e.bul.length ? `<ul>${e.bul.map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}`).join("")}` : ""}
      ${V.skills.length ? `<h4>Skills</h4><p>${esc(V.skills.join(" · "))}</p>` : ""}`
    : `<small class="jh-rlabel">RESUME</small><h2>Your resume goes here</h2><p>Type it in once - Job Hub uses it to show which jobs fit and why.</p>`;
  return `${jhHero("doc", "Resume", "Studio", "Build, refine, and optimize a standout resume that gets you noticed.")}
    <div class="jh-paperwrap"><div class="jh-paper ${JH_ZOOM ? "big" : ""}">${paper}</div>
      <div class="jh-ptools"><button class="jh-ib" data-jhzoom="1" aria-label="${JH_ZOOM ? "Show less" : "See the whole resume"}">${jhIco(JH_ZOOM ? "x" : "zoom")}</button>${has ? `<button class="jh-ib" data-jhdl="1" aria-label="Save as a text file">${jhIco("download")}</button>` : ""}</div></div>
    ${best ? `<div class="jh-impactbar">${jhIco("star")}<span class="grow"><b>Key Impact</b><small>${esc(best)}</small></span></div>` : ""}
    <div class="jh-actions"><button class="jh-btn gold" data-jhtab="edit">${jhIco("pen")} ${has ? "Edit Resume" : "Add My Resume"}</button>${has ? `<button class="jh-btn line" data-jhcopy="1">${jhIco("doc")} Copy as Text</button>` : ""}</div>
    <h3 class="jh-h3">Improvement Suggestions</h3>
    ${C.out.length ? C.out.map(t => `<button class="jh-sug" data-jhtab="edit">${jhIco("target")}<span class="grow">${esc(t)}</span>${jhIco("right")}</button>`).join("") : `<p class="fine">Looks strong - every line has a result and the skills match what you're after.</p>`}
    <button class="jh-sug gold" data-jhtailorgo="">${jhIco("spark")}<span class="grow"><b>Tailor To a Job</b> - compare your resume with a saved job</span>${jhIco("right")}</button>
    <p class="fine">Plain checks on this phone - nothing is sent anywhere.</p>`;
}
function jhTailorHtml() {
  const J = jh(), saved = Object.values(J.jobs).filter(x => x.st !== "closed");
  if (!JH_TAILOR || !J.jobs[JH_TAILOR]) JH_TAILOR = saved[0] ? saved[0].id : "";
  const hero = jhHero("target", "Tailor To a", "Job", "Compare your resume with a job description and get a personalized fit and keyword recommendations.");
  if (!JH_TAILOR) return `${hero}<p class="jh-empty">Save a job first (the ♥ on Job Radar), then come back to tailor your resume to it.</p><button class="jh-btn gold" data-jhtab="radar" data-jhroot="1">${jhIco("radar")} Open Job Radar</button>`;
  const j = jhJob(JH_TAILOR), x = J.jobs[JH_TAILOR], E = jhEvidence(j), s = jhScore(j), C = jhResumeChecks();
  [...JH_PICK].forEach(w => { if (!E.miss.includes(w)) JH_PICK.delete(w); });
  return `${hero}
    <section class="jh-box"><div class="jh-boxh"><b>Select a Saved Job</b><label class="jh-change">Change<select data-jhtailorsel="1" aria-label="Pick a saved job">${saved.map(y => `<option value="${esc(y.id)}" ${y.id === JH_TAILOR ? "selected" : ""}>${esc(y.t)}${y.co ? " · " + esc(y.co) : ""}</option>`).join("")}</select></label></div>
      <button class="jh-row in" data-jhjob="${esc(x.id)}">${jhLogoBadge(x.co)}<span class="grow"><b>${esc(x.t)}</b><small>${esc(x.co)}</small>${x.loc ? `<small class="jh-loc">${jhIco("pin")}${esc(jhLocNice(x.loc))}</small>` : ""}</span>${jhIco("right", "jh-go")}</button></section>
    <div class="jh-tailgrid">${jhRingWrap(s, "", "Fit Score", "sm")}
      <div class="jh-box jh-gap"><b>Resume Gap Analysis</b><p>${jhIco("check", "ok")}<span><b>${E.has.length}</b> Matching ${E.has.length === 1 ? "Skill" : "Skills"}</span></p><p>${jhIco("warn", "wn")}<span><b>${E.miss.length}</b> Missing ${E.miss.length === 1 ? "Keyword" : "Keywords"}</span></p><p>${jhIco("list")}<span><b>${C.out.length}</b> ${C.out.length === 1 ? "Area" : "Areas"} to Improve</span></p></div></div>
    <section class="jh-box"><h3 class="jh-h3">Missing Keywords <span class="g">(Add to Resume)</span></h3>
      ${E.miss.length ? `<p class="fine">Tap the ones you really have.</p><div class="jh-kw pick">${E.miss.map(k => `<button class="${JH_PICK.has(k) ? "on" : ""}" data-jhpick="${esc(k)}" aria-pressed="${JH_PICK.has(k)}">${JH_PICK.has(k) ? jhIco("check") : ""}${esc(k)}</button>`).join("")}</div>` : `<p class="fine">${j.kw && j.kw.length ? "Your resume already has every key word this job lists." : "This job's key words aren't in today's list any more."}</p>`}
      ${E.has.length ? `<h3 class="jh-h3">Present in Your Resume</h3><div class="jh-kw">${E.has.map(k => `<span class="yes">${jhIco("check")}${esc(k)}</span>`).join("")}</div>` : ""}</section>
    <button class="jh-cta" data-jhpickadd="1" ${JH_PICK.size ? "" : "disabled"}>${jhIco("spark")} ${JH_PICK.size ? `Add ${JH_PICK.size} to My Resume` : "Apply to My Resume"}</button>
    <p class="fine jh-center">Only pick what's true for you - Job Hub never adds experience you don't have. They go in your Skills.</p>`;
}
const jhFld = (icon, label, inner, extra = "") => `<label class="jh-fld">${jhIco(icon)}<span class="grow"><small>${label}</small>${inner}${extra}</span></label>`;
function jhEditHtml() {
  const V = jh().cv;
  return `${jhHero("doc", "Edit My", "Resume", "Update your resume details, keep it current, and make a stronger impression.")}
    <form class="jh-panel jh-form" id="jhcvform" data-jhcv="1">
      ${jhFld("user", "Full Name", `<input name="name" maxlength="60" autocomplete="name" value="${esc(V.name || S.name || "")}">`)}
      ${jhFld("bag", "Headline", `<input name="head" maxlength="90" placeholder="e.g. Operations & Logistics Leader" value="${esc(V.head)}">`)}
      ${jhFld("list", "Summary", `<textarea name="sum" rows="4" maxlength="600" data-jhcount="600">${esc(V.sum)}</textarea>`, `<em class="jh-cnt">${V.sum.length} / 600</em>`)}</form>
    <div class="jh-sec"><h3 class="jh-h3">${jhIco("layers")} Experience</h3><button class="jh-all" data-jhexp="new">${jhIco("plus")} Add Experience</button></div>
    ${V.exp.length ? V.exp.map(e => `<div class="jh-exprow"><span class="grow"><b>${esc(e.t || "Experience")}</b><small>${esc([e.co, jhDates(e)].filter(Boolean).join(" · ") || jhPl(e.bul.length, "line"))}</small></span>
      <button type="button" class="jh-ib sm" data-jhexp="${esc(e.id)}" aria-label="Edit ${esc(e.t)}">${jhIco("pen")}</button><button type="button" class="jh-ib sm ${JH_ARM === "exp:" + e.id ? "arm" : ""}" data-jhexpdel="${esc(e.id)}" aria-label="${JH_ARM === "exp:" + e.id ? "Tap again to delete" : "Delete " + esc(e.t)}">${jhIco("trash")}</button></div>`).join("")
      : `<p class="fine">No jobs yet. Add each job with a few lines about what you did - results, with numbers.</p>`}
    ${JH_ARM.startsWith("exp:") ? `<p class="fine jh-warn">Tap the trash again to delete it.</p>` : ""}
    <div class="jh-sec"><h3 class="jh-h3">${jhIco("gear")} Skills</h3></div>
    <div class="jh-skchips">${V.skills.map((s, i) => `<span class="jh-sk">${esc(s)}<button type="button" data-jhskdel="${i}" aria-label="Remove ${esc(s)}">${jhIco("x")}</button></span>`).join("") || `<p class="fine">No skills yet.</p>`}</div>
    <form class="jh-skadd" data-jhskill="1"><input name="sk" maxlength="40" placeholder="Add a skill (e.g. Excel)" aria-label="Add a skill"><button class="jh-all">${jhIco("plus")} Add Skill</button></form>
    <button class="jh-cta" type="submit" form="jhcvform">${jhIco("save")} Save Changes</button>
    <p class="fine jh-center">Stays on this phone. Copy as text when you apply.</p>`;
}
function jhExpHtml() {
  const V = jh().cv, e = V.exp.find(x => x.id === JH_EXP) || { id: "new", t: "", co: "", from: "", to: "", bul: [] };
  return `<div class="jh-pagehead"><h1 class="jh-title">${e.id === "new" ? "Add" : "Edit"} <span class="g">Experience</span></h1><p class="jh-sub">One job: what it was, when, and what you got done.</p></div>
    <form class="jh-panel jh-form" data-jhexpf="${esc(e.id)}">
      ${jhFld("bag", "Job title", `<input name="t" maxlength="80" value="${esc(e.t)}" placeholder="e.g. Dispatch Supervisor">`)}
      ${jhFld("building", "Company", `<input name="co" maxlength="80" value="${esc(e.co)}">`)}
      <div class="jh-two">${jhFld("cal", "Started", `<input type="month" name="from" value="${esc(e.from)}">`)}${jhFld("cal", "Ended", `<input type="month" name="to" value="${esc(e.to)}">`)}</div>
      <p class="fine">Still there? Leave Ended empty - it shows as Present.</p>
      ${jhFld("list", "What you did - one result per line", `<textarea name="bul" rows="6" maxlength="3600" placeholder="Led a team of 12 dispatchers…&#10;Cut delivery delays 18%…">${esc(e.bul.join("\n"))}</textarea>`)}
      <button class="jh-cta">${jhIco("save")} Save</button></form>`;
}

// ------------------------------------------------------------ WHAT I'M LOOKING FOR · CHECK A JOB I FOUND · MORE
function jhPrefsHtml() {
  const M = jh().me, inds = JH_FEED && JH_FEED.inds.length ? JH_FEED.inds : JH_INDS0;
  M.inds.forEach(n => { if (!inds.includes(n)) inds.push(n); });
  return `${jhHero("target", "What I'm", "Looking For", "Tell us your career goals and preferences so we can find the best opportunities for you.", { brk: true })}
    <form class="jh-panel jh-form" data-jhprefs="1"><input type="hidden" name="full" value="1">
      ${jhFld("bag", "Target Job Title", `<input name="titles" maxlength="200" value="${esc(M.titles.join(", "))}" placeholder="e.g. Operations Manager, Dispatcher">`)}
      ${jhFld("pin", "Location", `<select name="where">${jhStateOpts(M.where)}</select>`)}
      <fieldset class="jh-togs"><legend>Remote Options</legend>${JH_WORK.map(([k, l, i]) => `<label class="jh-tog ${M.work.includes(k) ? "on" : ""}"><input type="checkbox" name="work_${k}" ${M.work.includes(k) ? "checked" : ""}>${jhIco(i)}${l}</label>`).join("")}</fieldset>
      <p class="fine">None picked = any.</p>
      ${jhFld("bag", "Job Type", `<select name="type">${jhTypeOpts(M.type, "Any job type")}</select>`)}
      <div class="jh-two">${jhFld("coins", "Lowest Pay I'll Consider", `<input name="minPay" inputmode="numeric" value="${M.minPay || ""}" placeholder="e.g. 65000">`)}
        <label class="jh-fld">${jhIco("lock")}<span class="grow"><small>My Current Pay</small><span class="jh-inl"><input name="curPay" inputmode="numeric" class="jh-priv hid" value="${M.curPay || ""}" placeholder="optional"><button type="button" class="jh-eye" data-jheye="1" aria-label="Show or hide">${jhIco("eye")}</button></span><em class="jh-cnt">Private (never leaves this phone)</em></span></label></div>
      ${jhFld("bag", "Years of Experience", `<input name="yrs" inputmode="numeric" value="${M.yrs || ""}" placeholder="optional - for Experience level">`)}
      <fieldset class="jh-togs sm"><legend>Industries I'd Like (optional - for Industry fit)</legend>${inds.map((n, i) => `<label class="jh-tog ${M.inds.includes(n) ? "on" : ""}"><input type="checkbox" name="ind_${i}" value="${esc(n)}" ${M.inds.includes(n) ? "checked" : ""}>${esc(n)}</label>`).join("")}</fieldset>
      <h3 class="jh-h3">What's Most Important to You?</h3><p class="fine">How much each one counts in a match.</p>
      ${Object.keys(JH_W0).map(k => `<label class="jh-slider">${jhIco(JH_WICON[k])}<span>${esc(JH_WNAME[k])}</span><input type="range" name="wt_${k}" min="0" max="100" step="5" value="${M.w[k]}" aria-label="${esc(JH_WNAME[k])}"><b>${M.w[k]}%</b></label>`).join("")}
      <button class="jh-cta">Save Preferences</button></form>`;
}
function jhPasteHtml() {
  return `${jhHero("search", "Check a Job", "I Found", "Paste the details of any job you found and let us analyze the fit, pay, and key insights for you.", { brk: true })}
    <form class="jh-panel jh-form" data-jhpaste="1">
      ${jhFld("bag", "Job Title", `<input name="t" maxlength="120" required placeholder="e.g. Fleet Operations Manager">`)}
      ${jhFld("building", "Company", `<input name="co" maxlength="80">`)}
      ${jhFld("pin", "Location", `<input name="loc" maxlength="80" placeholder="e.g. Little Rock, AR or Remote">`)}
      ${jhFld("link", "Job Link", `<input name="url" type="url" maxlength="500" placeholder="https://">`)}
      ${jhFld("coins", "Pay (if listed)", `<input name="pay" inputmode="numeric" placeholder="e.g. 70000 - 85000">`)}
      ${jhFld("doc", "Job Description", `<textarea name="text" rows="7" maxlength="6000" data-jhcount="6000"></textarea>`, `<em class="jh-cnt">0 / 6,000</em>`)}
      <button class="jh-cta">${jhIco("search")} Check This Job</button></form>`;
}
function jhMoreHtml() {
  const J = jh(), row = (attrs, i, t, s) => `<button class="jh-mrow" ${attrs}><span class="jh-mic">${jhIco(i)}</span><span class="grow"><b>${t}</b><small>${s}</small></span>${jhIco("right", "jh-go")}</button>`;
  return `${jhHero("building", "More", "", "Manage your job search, customize your experience, and unlock more powerful tools.")}
    ${row('data-jhtab="prefs"', "filter", "Preferences", "Update your goals, location, pay, and importance rates.")}
    ${row('data-jhtab="paste"', "search", "Check a Job I Found", "Analyze any job posting for fit, pay, and key insights.")}
    ${row('data-jhclose="1" data-ask="1"', "spark", "Ask AI", "Interview questions, follow-ups, resume wording, your saved jobs.")}
    ${row('data-jhclose="1" data-open="sheet"', "gear", "Settings", "Backup, reminders, notifications, your data and more.")}
    ${row('data-jhunhide="1"', "eyeoff", "Show Hidden Jobs", J.hide.length ? `${jhPl(J.hide.length, "job")} you hid - tap to show them again.` : "No hidden jobs right now.")}
    <p class="fine">${JH_FEED ? esc(JH_FEED.credit) : ""} Jobicy listings link to Jobicy. Job Hub never applies for you or logs in to job sites.</p>`;
}

// ------------------------------------------------------------ clicks
function jhSaveJob(j, st) {
  const J = jh(); if (!j) return null;
  const x = J.jobs[j.id] || (J.jobs[j.id] = { id: j.id, t: j.t, co: j.co, loc: jhWhere(j), url: j.url, min: j.min || 0, max: j.max || 0, src: j.src || (j.pasted ? "You" : ""), type: j.type || "",
    st: "saved", add: today(), stAt: today(), appl: "", iv: "", fu: "", note: "", fuNote: "", fuDone: false });
  if (st) jhSetStage(x, st);
  return x;
}
function jhSetStage(x, st) {
  if (!JH_STAGES5.some(s => s[0] === st)) return;
  if (x.st !== st) { x.st = st; x.stAt = today(); }
  if (st === "applied" && !x.appl) x.appl = today();
}
const jhAgain = () => { if (JH_OPEN) showJh(); render(); };
function jhCvFromForm() {           // keep what's typed in Edit My Resume when a skill or job is added before Save
  const f = document.getElementById("jhcvform"); if (!f) return;
  const d = Object.fromEntries(new FormData(f)), V = jh().cv; V.name = jhTxt(d.name, 60); V.head = jhTxt(d.head, 90); V.sum = jhTxt(d.sum, 1200);
}
function jhClick(ds) {
  if (typeof MODE === "undefined" || MODE !== "job") return false;
  const J = jh();
  if (ds.jhclose && !ds.ask && !ds.open) { hideJh(); render(); return true; }
  if (ds.jhclose) { hideJh(); return false; }           // Ask / ⚙ from More: close ours, let the engine open its own
  if (ds.jhback) { jhBack(); return true; }
  if (ds.jhtab) { if (ds.jhroot) JH_STACK = []; jhReset(); if (ds.jhtab === "edit") JH_EXP = ""; showJh(ds.jhtab, !ds.jhroot); jhNavEnsure(); return true; }
  if (ds.jhjob) { JH_CUR = ds.jhjob; JH_JTAB = "over"; jhReset(); showJh("job"); jhNavEnsure(); return true; }
  if (ds.jhtrack) { JH_CUR = ds.jhtrack; jhReset(); showJh("track"); jhNavEnsure(); return true; }
  if (ds.jhfitfor) { JH_CUR = ds.jhfitfor; showJh("fit"); return true; }
  if (ds.jhemp !== undefined) { if (!ds.jhemp) return true; JH_EMP = ds.jhemp; JH_ETAB = "over"; jhReset(); showJh("emp"); return true; }
  if (ds.jhetab) { JH_ETAB = ds.jhetab; showJh(); return true; }
  if (ds.jhjtab) { JH_JTAB = ds.jhjtab; showJh(); return true; }
  if (ds.jhcat) { JH_ROLE = "c:" + ds.jhcat; JH_Q = ""; JH_N = 30; JH_STACK = []; jhReset(); showJh("radar", false); jhNavEnsure(); return true; }
  if (ds.jhpf !== undefined) { JH_PF = JH_PF === ds.jhpf ? "" : ds.jhpf; showJh(); return true; }
  if (ds.jhmore) { JH_N += 30; showJh(); return true; }
  if (ds.jhreload) { JH_FEED = null; jhLoad(true); showJh(); return true; }
  if (ds.jhheart) { const id = ds.jhheart, x = J.jobs[id];
    if (!x) { const j = jhJob(id); if (j) { jhSaveJob(j); JH_ARM = ""; save(); toast("♥ Saved to your pipeline"); buzz(); } }
    else if (x.st === "saved" || JH_ARM === "heart:" + id) { delete J.jobs[id]; JH_ARM = ""; save(); toast("Taken off your pipeline"); if (JH_TAB === "track" && JH_CUR === id) { jhBack(); render(); return true; } }
    else { JH_ARM = "heart:" + id; toast(`It's at ${jhStageName(x.st)} in your pipeline - tap ♥ again to take it off`); return true; }
    jhAgain(); return true; }
  if (ds.jhshare) { const j = jhJob(ds.jhshare); if (!j || !j.url) return true;
    const d = { title: j.t, text: `${j.t}${j.co ? " at " + j.co : ""} - found with Job Hub`, url: j.url };
    if (navigator.share) navigator.share(d).catch(() => {}); else (navigator.clipboard ? navigator.clipboard.writeText(j.url) : Promise.reject()).then(() => toast("🔗 Link copied")).catch(() => toast("Couldn't share on this phone"));
    return true; }
  if (ds.jhfollow) { const co = ds.jhfollow, on = J.follow.includes(co); J.follow = on ? J.follow.filter(x => x !== co) : [...J.follow, co].slice(-50); save();
    toast(on ? `Stopped following ${co}` : `♥ Following ${co} - their new openings show on Smart Alerts`); showJh(); return true; }
  if (ds.jhstage) { const x = J.jobs[ds.jhid]; if (x) { jhSetStage(x, ds.jhstage); save(); jhAgain(); buzz(); } return true; }
  if (ds.jhfudone) { const x = J.jobs[ds.jhfudone]; if (x) { x.fuDone = !x.fuDone; save(); toast(x.fuDone ? "✓ Follow-up done" : "Follow-up back on"); jhAgain(); } return true; }
  if (ds.jhunsave) { const x = J.jobs[ds.jhunsave]; if (!x) return true; if (JH_ARM !== "uns:" + x.id) { JH_ARM = "uns:" + x.id; showJh(); return true; }
    delete J.jobs[x.id]; JH_ARM = ""; save(); toast("Taken off your pipeline"); if (JH_TAB === "track") jhBack(); else showJh(); render(); return true; }
  if (ds.jhhide) { if (!J.hide.includes(ds.jhhide)) J.hide.push(ds.jhhide); save(); JH_SCORES = null; toast("Hidden - it won't show on Job Radar"); jhBack(); render(); return true; }
  if (ds.jhunhide) { if (!J.hide.length) { toast("No hidden jobs"); return true; } J.hide = []; JH_SCORES = null; save(); toast("Hidden jobs are back"); showJh(); render(); return true; }
  if (ds.jhpdel) { const id = ds.jhpdel; if (JH_ARM !== "pdel:" + id) { JH_ARM = "pdel:" + id; showJh(); return true; } J.mine = J.mine.filter(x => x.id !== id); delete J.jobs[id]; JH_ARM = ""; save(); jhBack(); render(); toast("Removed"); return true; }
  if (ds.jhtailorgo !== undefined) { if (ds.jhtailorgo) JH_TAILOR = ds.jhtailorgo; JH_PICK.clear(); jhReset(); showJh("tailor"); jhNavEnsure(); return true; }
  if (ds.jhpick) { const w = ds.jhpick; if (JH_PICK.has(w)) JH_PICK.delete(w); else JH_PICK.add(w); showJh(); return true; }
  if (ds.jhpickadd) { if (!JH_PICK.size) return true; const V = J.cv, have = new Set(V.skills.map(s => s.toLowerCase())), add = [...JH_PICK].filter(w => !have.has(w.toLowerCase()));
    V.skills = [...V.skills, ...add].slice(0, 60); JH_PICK.clear(); JH_SCORES = null; save(); toast(`✓ ${jhPl(add.length, "skill")} added to your resume`); jhAgain(); return true; }
  if (ds.jhzoom) { JH_ZOOM = !JH_ZOOM; showJh(); return true; }
  if (ds.jhdl) { const V = J.cv, txt = jhResumeTxt();
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" })); a.download = `${(V.name || S.name || "My").replace(/[^\w .-]/g, "")} resume.txt`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast("⬇ Resume saved as a text file"); } catch (e) { toast("Couldn't save the file on this phone"); }
    return true; }
  if (ds.jhcopy) { (navigator.clipboard ? navigator.clipboard.writeText(jhResumeTxt()) : Promise.reject()).then(() => toast("📋 Resume copied - paste it into the application")).catch(() => toast("Couldn't copy on this phone")); return true; }
  if (ds.jhexp) { jhCvFromForm(); JH_EXP = ds.jhexp; jhReset(); showJh("exp"); return true; }
  if (ds.jhexpdel) { const id = ds.jhexpdel; jhCvFromForm(); if (JH_ARM !== "exp:" + id) { JH_ARM = "exp:" + id; showJh(); return true; }
    J.cv.exp = J.cv.exp.filter(e => e.id !== id); JH_ARM = ""; JH_SCORES = null; save(); toast("Deleted"); showJh(); return true; }
  if (ds.jhskdel !== undefined) { jhCvFromForm(); J.cv.skills.splice(Number(ds.jhskdel), 1); JH_SCORES = null; save(); showJh(); return true; }
  if (ds.jheye) { const i = document.querySelector('#jhSheet [name="curPay"]'); if (i) i.classList.toggle("hid"); return true; }
  return false;
}
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {          // capture phase: things the engine's button-only click handler never sees
    if (typeof MODE === "undefined" || MODE !== "job" || !e.target || !e.target.closest) return;
    const b = e.target.closest("[data-jhclose]"); if (b && (b.dataset.ask || b.dataset.open) && JH_OPEN) hideJh();   // Ask / ⚙ are the engine's own sheets
    const ap = e.target.closest("a[data-jhapply]");   // Apply is a link (it opens the posting); mark the job Applied as it opens
    if (ap) { const j = jhJob(ap.dataset.jhapply); if (j) { jhSaveJob(j, "applied"); save(); toast("📨 Marked Applied - the posting opens on the employer's site"); setTimeout(() => { if (JH_OPEN) showJh(); render(); }, 300); } }
  }, true);
  document.addEventListener("change", e => {
    if (typeof MODE === "undefined" || MODE !== "job" || !e.target) return;
    const t = e.target, d = t.dataset || {};
    if (d.jhmon) { jh().mon = !!t.checked; save(); render(); return; }
    if (d.jhsel) { if (d.jhsel === "role") JH_ROLE = t.value; else if (d.jhsel === "work") JH_F.work = t.value; else if (d.jhsel === "pay") JH_F.pay = jhInt(t.value, 0, 5000000, 0); JH_N = 30; showJh(); return; }
    if (d.jhtf) { const x = jh().jobs[JH_CUR]; if (!x) return; const k = d.jhtf, v = t.value;
      if (k === "iv") { x.iv = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : ""; if (x.iv && (x.st === "saved" || x.st === "applied")) jhSetStage(x, "interview"); }
      else if (k === "fu") { x.fu = jhIsD(v) ? v : ""; x.fuDone = false; } else if (k === "fuNote") x.fuNote = jhTxt(v, 120); else if (k === "note") x.note = jhTxt(v, 600);
      save(); toast(k === "iv" && x.iv ? "📅 Interview saved - you'll get a reminder" : "Saved ✓"); if (k === "iv" || k === "fu") jhAgain(); return; }
    if (d.jhstagesel) { const x = jh().jobs[d.jhstagesel]; if (x) { jhSetStage(x, t.value); save(); jhAgain(); buzz(); } return; }
    if (d.jhtailorsel) { JH_TAILOR = t.value; JH_PICK.clear(); showJh(); return; }
    if (t.type === "checkbox" && t.closest && t.closest(".jh-tog")) t.closest(".jh-tog").classList.toggle("on", t.checked);
    if (t.type === "range" && /^wt_/.test(t.name || "")) { const b = t.parentElement.querySelector("b"); if (b) b.textContent = t.value + "%"; }
  });
  document.addEventListener("input", e => {
    if (typeof MODE === "undefined" || MODE !== "job" || !e.target) return;
    const t = e.target;
    if (t.type === "range" && /^wt_/.test(t.name || "")) { const b = t.parentElement.querySelector("b"); if (b) b.textContent = t.value + "%"; }
    if (t.dataset && t.dataset.jhcount) { const c = t.parentElement.querySelector(".jh-cnt"); if (c) c.textContent = `${t.value.length.toLocaleString()} / ${Number(t.dataset.jhcount).toLocaleString()}`; }
  });
}

// ------------------------------------------------------------ forms
function jhPrefsSave(data, M) {
  if (data.titles !== undefined) M.titles = String(data.titles || "").split(",").map(t => jhTxt(t, 60)).filter(Boolean).slice(0, 8);
  if (data.loc !== undefined) { M.where = JH_STATES[data.loc] ? data.loc : ""; M.work = data.loc === "remote" ? ["remote"] : []; }   // the welcome's one Location box
  if (data.where !== undefined) M.where = JH_STATES[data.where] ? data.where : "";
  if (data.type !== undefined) M.type = JH_TYPES.includes(data.type) ? data.type : "";
  if (data.full) { M.work = JH_WORK.map(w => w[0]).filter(k => data["work_" + k]); if (M.work.length === JH_WORK.length) M.work = [];
    M.inds = Object.keys(data).filter(k => /^ind_\d+$/.test(k)).map(k => jhTxt(data[k], 40)).filter(Boolean).slice(0, 12); }
  if (data.minPay !== undefined) M.minPay = jhInt(data.minPay, 0, 5000000, 0);
  if (data.curPay !== undefined) M.curPay = jhInt(data.curPay, 0, 5000000, 0);
  if (data.yrs !== undefined) M.yrs = jhInt(data.yrs, 0, 60, 0);
  Object.keys(JH_W0).forEach(k => { if (data["wt_" + k] !== undefined) M.w[k] = jhInt(data["wt_" + k], 0, 100, JH_W0[k]); });
  JH_SCORES = null;
}
function jhPayParse(s) { const n = String(s || "").replace(/[$,]/g, "").match(/\d+(?:\.\d+)?\s*k?/gi) || [];
  const v = n.map(x => /k$/i.test(x.trim()) ? parseFloat(x) * 1000 : parseFloat(x)).map(x => x < 200 ? Math.round(x * 2080) : Math.round(x)).filter(x => x >= 1000);
  return [v[0] || 0, v[1] || v[0] || 0]; }
function jhSubmit(f, data) {
  if (typeof MODE === "undefined" || MODE !== "job") return false;
  const D = f.dataset, J = jh();
  if (D.jhsetup) { jhPrefsSave(data, J.me); if (!J.me.titles.length) { toast("What job are you looking for?"); return true; }
    J.setup = true; J.setupDay = today(); save(); jhNavEnsure(); render(); buzz(); window.scrollTo(0, 0); toast("🔭 Job Radar is on - here's today's best"); return true; }
  if (D.jhprefs) { jhPrefsSave(data, J.me); save(); toast("Saved ✓ - matches updated"); JH_STACK = []; showJh("radar", false); jhNavEnsure(); render(); return true; }
  if (D.jhsearch) { JH_Q = jhTxt(data.q, 60); JH_N = 30; showJh("radar"); jhNavEnsure(); return true; }
  if (D.jhcv) { const V = J.cv; V.name = jhTxt(data.name, 60); V.head = jhTxt(data.head, 90); V.sum = jhTxt(data.sum, 1200);
    JH_SCORES = null; save(); toast("📄 Resume saved - matches updated"); JH_STACK = []; showJh("resume", false); jhNavEnsure(); render(); return true; }
  if (D.jhexpf) { const V = J.cv, bul = String(data.bul || "").split(/\r?\n/).map(b => jhTxt(b.replace(/^[\s•\-*·]+/, ""), 300)).filter(Boolean).slice(0, 12);
    const e = { t: jhTxt(data.t, 80), co: jhTxt(data.co, 80), from: jhIsM(data.from) ? data.from : "", to: jhIsM(data.to) ? data.to : "", bul };
    if (!e.t && !e.co && !bul.length) { JH_MSG = "Give it a job title, a company or a line about what you did."; jhMsgShow(); return true; }
    const old = V.exp.find(x => x.id === D.jhexpf); if (old) Object.assign(old, e); else V.exp.unshift({ id: uid(), ...e });
    V.exp.sort((a, b) => (b.to || "9999") < (a.to || "9999") ? -1 : (b.to || "9999") > (a.to || "9999") ? 1 : (b.from > a.from ? 1 : -1));   // newest job first; Present on top
    JH_SCORES = null; save(); toast("✓ Saved"); jhBack(); return true; }
  if (D.jhskill) { const s = jhTxt(data.sk, 40); if (!s) return true; jhCvFromForm(); const V = J.cv; if (!V.skills.some(x => x.toLowerCase() === s.toLowerCase())) V.skills.push(s);
    V.skills = V.skills.slice(0, 60); JH_SCORES = null; save(); showJh(); const i = document.querySelector('#jhSheet [name="sk"]'); if (i) i.focus(); return true; }
  if (D.jhpaste) { const t = jhTxt(data.t, 120); if (!t) { JH_MSG = "Give it a job title."; jhMsgShow(); return true; }
    const [mn, mx] = jhPayParse(data.pay), loc = jhTxt(data.loc, 80), p = { id: "p-" + uid(), t, co: jhTxt(data.co, 80), loc, url: /^https?:\/\//.test(String(data.url || "")) ? String(data.url).slice(0, 500) : "",
      text: jhTxt(data.text, 6000), min: mn, max: mx, rem: /remote|anywhere|work from home/i.test(loc + " " + (data.text || "").slice(0, 400)) ? 1 : 0, add: today() };
    J.mine.unshift(p); jhSaveJob({ ...p, pasted: true }); save(); JH_CUR = p.id; JH_STACK = ["pipe"]; showJh("fit", false); render(); toast("✓ Checked and saved to your pipeline"); return true; }
  return false;
}
const jhMsgShow = () => { const el = document.getElementById("jhMsg"); if (el) el.textContent = JH_MSG ? "⚠️ " + JH_MSG : ""; };

// ------------------------------------------------------------ reminders, Life pulse, what Ask reads
// Reminders (⚙ → Reminders on, and Monitoring on): an interview the evening before and 2 hours before; a follow-up cue at 10 AM.
function jhReminders(add, inWin) {
  if (!jhSet() || !jh().mon) return;
  const t = today();
  Object.values(jh().jobs).forEach(x => {
    if (x.st === "interview" && x.iv) { const day = x.iv.slice(0, 10), ms = Date.parse(x.iv); if (!isFinite(ms)) return;
      if (inWin(addDays(day, -1)) && addDays(day, -1) >= t) add(`jhi1:${x.id}:${x.iv}`, ms, atMs(addDays(day, -1), "18:00"), `👥 Interview tomorrow: ${x.t}`, `${x.co ? x.co + " at " : "At "}${jhTime12(x.iv.slice(11, 16))}. You've got this.`);
      if (inWin(day) && day >= t) add(`jhi2:${x.id}:${x.iv}`, ms + 3600000, ms - 7200000, `👥 Interview today: ${x.t}`, `${x.co ? x.co + " at " : "At "}${jhTime12(x.iv.slice(11, 16))}.`); }
    if ((x.st === "applied" || x.st === "interview") && !x.fuDone) { const due = x.fu || (x.st === "applied" && x.appl ? addDays(x.appl, 7) : "");
      if (due && due >= t && inWin(due)) add(`jhf:${x.id}:${due}`, atMs(due, "23:59"), atMs(due, "10:00"), `✉️ Follow up: ${x.t}`, x.fuNote || `A short note to ${x.co || "the employer"} keeps you on their list.`); }
  });
}
function jhPulse(add) {
  if (typeof MODE === "undefined" || MODE !== "job" || !jhSet()) return;
  jhNextSteps().forEach(a => add(a.k === "iv" ? 9 : 6, a.k === "iv" ? "👥" : "✉️", a.k === "iv" ? `Interview: ${a.x.t}` : `Follow up: ${a.x.t}`, null));
  const n = jh().mon ? jhNew().length : 0; if (n) add(5, "🔭", `${jhPl(n, "new match")} on Job Radar`, null);
}
function jhContext() {
  if (!jhSet()) return {};
  const J = jh(), M = J.me, V = J.cv;
  return { about: "This is the person's own Job Hub on their phone. Help with job hunting: interview prep, follow-ups, resume wording, which saved job fits. Never invent experience or qualifications; their current pay is private and not included.",
    lookingFor: { jobs: M.titles, where: M.where ? JH_STATES[M.where] : "anywhere in the US", workStyle: M.work.length ? M.work : "any", jobType: M.type || "any", lowestPay: M.minPay || undefined,
      yearsOfExperience: M.yrs || undefined, industries: M.inds.length ? M.inds : undefined },
    resume: { headline: V.head || undefined, summary: V.sum || undefined, experience: V.exp.slice(0, 8).map(e => ({ title: e.t, company: e.co || undefined, dates: jhDates(e) || undefined, lines: e.bul })), skills: V.skills.slice(0, 30) },
    pipeline: Object.values(J.jobs).map(x => ({ job: x.t, company: x.co || undefined, stage: x.st, pay: jhPayTxt(x), interview: x.iv || undefined, followUp: x.fu || undefined })).slice(0, 30) };
}
