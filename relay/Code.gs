/* SAVE AS: Code.gs · LOCATION: C:/MarvelApps/dayhub/relay/Code.gs
 * (the live copy is a Google Apps Script web app in Scott's Google account,
 *  project "Day Hub AI relay" — this file is the source of record)
 *
 * DAY HUB AI RELAY (Scott 10/2: "go with A"). The phone app can't hold the
 * Claude API key (Day Hub's code is public), so this tiny web app does:
 *   phone --(passphrase + task + text)--> relay --(API key)--> Claude
 * - The API key and the passphrase live in Script Properties, never in code:
 *     ANTHROPIC_KEY = the Claude API key
 *     PASS          = the passphrase typed once into Day Hub ⚙
 * - Only three fixed jobs (dump / ask / top3). The prompts live HERE, so the
 *   relay can't be used as a general free Claude by anyone who finds the URL.
 * - Cheapest model (Claude Haiku 4.5), short answers, and a hard daily cap.
 * - Nothing is stored except a per-day request counter.
 *
 * v4 (Day Hub v0.41, Scott 10/3). The PASS path is UNCHANGED. Added, all
 * dormant until Scott sets the Script Properties below:
 *   task "verify"  - is this buyer's Day Hub Pro (Whop) membership paid up?
 *                    The buyer types the EMAIL they bought with (or their
 *                    Whop membership id, mem_..., as a fallback). Whop's app
 *                    store has no license-key app for Marvel Corp, so the
 *                    email IS the account.
 *   buyer AI       - a Pro phone may use the AI tasks instead of the PASS,
 *                    ONLY while AI_PUBLIC is set, with its own daily cap
 *                    (BUYER_CAP) on top of the shared DAILY_CAP.
 *   phone limit    - one purchase unlocks at most MAX_PHONES phones (each
 *                    phone sends a random id it made itself). A phone not
 *                    seen for PHONE_DAYS drops off the list by itself.
 * New Script Properties (any capitals):
 *     WHOP_API_KEY    = Whop company API key with member:basic:read,
 *                       member:email:read, member:phone:read
 *     WHOP_PRODUCT_ID = prod_xD6LAe50BRN9C (Day Hub Pro) - required
 *     WHOP_COMPANY_ID = optional; defaults to Marvel Corp below
 *     AI_PUBLIC       = true   (leave it out = buyers get no AI)
 * Whop API, read on docs.whop.com 10/3/2026 (base /api/v1, Api-Version-Date
 * pinned - without it Whop answers with the 2025-01-01 API):
 *   GET /members?account_id=&query=<email>   "Search members by name,
 *       username, or email" (list memberships has NO email filter) - then an
 *       EXACT email match is required, a fuzzy search hit never counts.
 *   GET /memberships?account_id=&user_ids=&product_ids=   their memberships
 *   GET /memberships/{mem_id}                the mem_ fallback
 *   Array params are form/explode: user_ids=a&user_ids=b (no brackets).
 *   Product + status are ALSO checked here, so a filter Whop ignores can't
 *   unlock anything.
 * What is stored: per buyer a one-way hash of their Whop user id -> the random
 * phone ids + last-seen day. Never the email.
 *
 * v5 (Day Hub v0.48, Scott 10/4: "cruise app 9.99 per year as many cruises as
 * you want that year"). CRUISE HUB PASS = a second Whop product. The phone now
 * says which app is asking (req.app):
 *   app "cruisehub" -> Cruise Hub Pass OR Day Hub Pro unlocks it
 *   anything else   -> Day Hub Pro only (unchanged; a Cruise Pass never opens Day Hub or the AI)
 * New Script Property, optional until the Cruise Hub Pass is on sale:
 *     CRUISE_PRODUCT_ID = prod_... (Cruise Hub Pass)
 * The answer also says which product matched: product "dayhub" | "cruisehub".
 *
 * v6 (Day Hub v1.23, Scott 10/11: Trip Hub listed, same model). TRIP HUB PASS =
 * a third Whop product:
 *   app "triphub" -> Trip Hub Pass OR Day Hub Pro unlocks it
 * New Script Property, optional until the Trip Hub Pass is on sale:
 *     TRIP_PRODUCT_ID = prod_... (Trip Hub Pass)
 * product can now also be "triphub". The AI path is unchanged: Day Hub Pro only.
 *
 * v7 (Day Hub v1.24, Scott 10/11: "all our aps ought to have a play of you drop ai
 * credits"; packs 100 for $2.99 / 500 for $9.99). HUB AI CREDITS = one-time Whop
 * products that work in EVERY hub. Dormant until this Script Property is set:
 *     AI_CREDIT_PRODUCTS = {"prod_...": 100, "prod_...": 500}   (product id -> questions)
 * A buyer's credits = sum of their paid credit memberships x questions, minus what
 * they used (U_<hash>, one per answered question - a failed call is never charged).
 * Day Hub Pro buyers use their free BUYER_CAP a day first, then credits.
 * New task "credits" -> {left, total} for the email (no phone slot is taken).
 * AI answers now also carry credits_left when the question was paid with a credit.
 *
 * v8 (10/11, first real test buy): credits come from PAYMENTS, not memberships.
 * Measured on the live API with marvelcalls (two $0 CREDITSTEST buys):
 *   - a second buy of the same pack does NOT make a second membership - Whop just
 *     extends the first one, so counting memberships gave 100 for two packs;
 *   - /memberships hides "completed" (one-time) ones unless asked by status.
 * So the relay now reads GET /payments?account_id=&user_id=<buyer> (needs the key's
 * payment:basic:read scope - added to "Day Hub Key" 10/11 with Scott's OK) and counts
 * every paid, not-refunded payment for a pack: questions x quantity.
 * (product_ids / statuses filters 400 on /payments; user_ids is IGNORED - user_id works.)
 *
 * v9 (10/11, Scott "yes to both"): task "waitlist" {email, app, src} from the Hub Series page
 * (smarvel1963-ops.github.io/hubs/) adds ONE row to the "Hub Waitlist" Google Sheet in Scott's Drive.
 * Append-only; checks the email shape; same email + app twice = one row; WAITLIST_CAP rows a day max.
 * One-time setup: run setupWaitlist() from the editor (Google asks Scott to Allow Sheets), which makes
 * the sheet and saves its id in Script Property WAITLIST_SHEET_ID. Until then the task answers
 * {error:"waitlist not set up"} - the AI and Whop paths never touch the sheet.
 *
 * v10 (10/11, store audit finding S3 + part of S7, Scott "yes start with 1" -> fix #2): the purchase
 * checks no longer tell a stranger WHO is a Marvel Corp customer. Marvel Corp's Whop store also sells the
 * picks memberships, so "no Whop purchase" vs "no Day Hub Pro purchase" was a customer lookup for anyone.
 *   - verify: every "not unlocked" case answers the SAME status ("not found"), whatever the reason
 *     (no Whop account, no Pro, canceled/expired). Only "already on N phones" stays - the phone needs it.
 *   - credits: "no Whop account" and "no credits" answer the same.
 *   - a "not found" answer is cached 5 min, so repeating it costs Whop nothing.
 *   - LOOKUP_CAP uncached Whop lookups a day; past it the check answers {error} - the phone treats that
 *     as "couldn't check" and keeps its grace, so a flood can't lock out a paying customer.
 *
 * v11 (10/11, store audit finding S2, Scott "fix 3"): knowing a buyer's EMAIL is no longer enough. A NEW phone
 * must confirm a 6-digit code that the relay emails to that address before the email unlocks Pro or AI Credits
 * on it. OFF until Script Property EMAIL_CODES = true (flip it only after Day Hub v1.27, which shows the code
 * box, is live).
 *   - task "code" {buyer, device}: emails a code ONLY if the address bought a Hub product, but answers
 *     {sent:true} either way, so it is no customer lookup. At most 3 codes per address per hour.
 *   - task "confirm" {buyer, device, code}: right code -> this phone is confirmed for that address (Property
 *     V_<hash>). A code lasts 15 min and allows 5 tries.
 *   - verify / credits / AI on an unconfirmed phone answer status "needs code" - the same for buyers and
 *     strangers. A phone ALREADY unlocked before v11 (on the buyer's phone list) is confirmed silently, so no
 *     paying customer is asked for a code.
 *   - mem_ ids (a private membership id, not a public address) work as before.
 *   - Sending mail needs Scott's one-time Allow (run authMail() in the editor).
 *
 * v12 (10/11, store audit finding S8, Scott "do the guess limit"): the owner passphrase can't be guessed
 * without limit. After PASS_FAILS_HOUR wrong tries in a clock hour the passphrase path answers "try again in an
 * hour", and after PASS_FAILS_DAY in a day it is shut until tomorrow. While locked, even the RIGHT passphrase
 * is refused, so a guesser learns nothing. Buyers (email / credits) are not affected.
 * Scott will also change PASS to a long random phrase (ACTIVE_TODO S8) - the limit only slows guessing down.
 *
 * v13 (10/11, store audit small items, Scott "cont"):
 *   - L3 a paid AI credit is RESERVED under the lock before Claude is called (two requests at once can't both
 *     spend the last credit) and given back if no answer comes.
 *   - an empty request is refused BEFORE it counts against the day's cap.
 *   - L2 the phone gets plain messages ("busy, try again"); Claude's / Apps Script's raw error text goes to the
 *     execution log only.
 *   - L4 the waitlist formula guard also covers a leading tab / carriage return.
 */
const MODEL = "claude-haiku-4-5";
const DAILY_CAP = 200;              // requests per day, all tasks together
const BUYER_CAP = 30;               // per Pro buyer per day (inside DAILY_CAP)
const MAX_PHONES = 3;
const LOOKUP_CAP = 500;             // v10: uncached Whop lookups a day (verify + credits) - flood guard
const NOT_FOUND = "not found";      // v10: one answer for every "no purchase" reason
const NEEDS_CODE = "needs code";    // v11: this phone hasn't confirmed the emailed code yet
const CODE_MINUTES = 15, CODE_TRIES = 5, CODES_PER_HOUR = 3;
const PASS_FAILS_HOUR = 20, PASS_FAILS_DAY = 100;   // v12: wrong owner passphrases before the lock
const WAITLIST_CAP = 300;           // waitlist rows a day (spam guard)
const WAITLIST_APPS = ["Home Hub", "Auto Hub", "Pet Hub", "Family Hub", "All of them"];               // phones one purchase can unlock at once
const PHONE_DAYS = 60;              // a phone not seen this long frees its spot
const WHOP_API = "https://api.whop.com/api/v1";
const WHOP_COMPANY = "biz_loYMoMQKy5XhM0";   // Marvel Corp (not a secret)
const WHOP_VERSION = "2026-09-29";   // match the key (10/3: 09-15 returned members without user.email)
// Still paid up: "canceling" runs to the end of the period, "past_due" is Whop retrying the card.
const OK_STATUS = ["active", "trialing", "past_due", "canceling", "completed"];   // completed = paid once (one-time / 100% code)
// v7 credits: a pack that has run its access period (expired) was still paid for - its questions stay.
const CREDIT_STATUS = ["active", "past_due", "canceling", "completed", "expired"];

const TASKS = {
  dump: { max: 1200, system:
`You sort a person's "brain dump" for a phone planner. Today is {today} ({weekday}). Split the text into separate items, one per thing they need to do, remember, buy or think about.
For each item give:
- kind: "todo" (something to do, no particular time), "event" (has a day or time — a reminder/appointment), "item" (something to buy), or "note" (an idea or thought to keep)
- title: short, starts with a capital letter, WITHOUT the date/time words
- for events only: day (YYYY-MM-DD), time (HH:MM, 24-hour; use "09:00" if no time was said), rep ("none", "daily", "weekdays", "weekly", "monthly" or "yearly")
Resolve relative dates ("Tuesday", "next month", "in 2 weeks", "the 15th") from today. "Next month" with no day = the 1st.
Reply with ONLY this JSON and nothing else: {"items":[{"kind":"todo","title":"..."}]}` },

  ask: { max: 500, system:
`You are Day Hub, a friendly phone planner. Answer the question using ONLY the person's own planner data in the JSON below the question. Today is {today} ({weekday}).
Answer in 1-3 short sentences, plain everyday words, 12-hour times (like 3:30 PM), and say the day ("tomorrow", "Friday Oct 9"). If the data doesn't have the answer, say so simply and suggest what to add. Never invent anything.` },

  top3: { max: 400, system:
`From the person's planner data (JSON), pick the 3 things that matter most TODAY ({today}, {weekday}). Favour: things with a time today, late or due money, health and medicine, things promised to other people, anything with a deadline. Skip routine trivia unless there's nothing else.
Reply with ONLY this JSON: {"top":[{"title":"...","why":"under 10 words"}]}` },
};

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const P = PropertiesService.getScriptProperties();
    // Forgiving match (Scott 10/2: phone keyboards capitalise the first letter and add
    // spaces): case, extra spaces and leading/trailing spaces don't count.
    const norm = v => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
    if (req.task === "verify") return out(verifyBuyer(P, req.buyer, req.device, req.app));
    if (req.task === "release") return out(releasePhone(P, req.buyer, req.device, req.app));
    if (req.task === "credits") return out(creditsFor(P, req.buyer, req.device));
    if (req.task === "code") return out(sendCode(P, req.buyer, req.device));
    if (req.task === "confirm") return out(confirmCode(P, req.buyer, req.device, req.code));
    if (req.task === "waitlist") return out(waitlistAdd(P, req));
    let keyCounter = null;                                       // set = this request is on a Pro buyer
    let credit = null;                                           // v7: set = this request is paid with a Hub AI Credit
    if (req.buyer && !req.pass) {
      if (!/^(1|true|yes|on)$/i.test(String(prop(P, "AI_PUBLIC") || "").trim())) return out({ error: "the AI helper for Pro isn't switched on yet" });
      const v = verifyBuyer(P, req.buyer, req.device);
      if (v.error && !creditProducts(P)) return out({ error: v.error });
      const proKey = v.valid ? dayKey() + "_K_" + v.who : null;
      if (proKey && Number(P.getProperty(proKey) || 0) < BUYER_CAP) keyCounter = proKey;
      else {
        if (v.status === NEEDS_CODE) return out({ error: "confirm your email on this phone first (⚙ → AI helper)" });
        const c = creditProducts(P) ? creditsFor(P, req.buyer, req.device) : null;
        if (c && c.error) return out({ error: c.error });
        if (c && c.left > 0) credit = c;
        else if (proKey) return out({ error: "your daily AI limit is used up — try again tomorrow" + (c ? " (or add Hub AI Credits)" : "") });
        else return out({ error: c ? "no AI questions left — add Hub AI Credits" : "Day Hub Pro isn't active for this phone" });
      }
    } else {
      const pass = prop(P, "PASS");
      if (!pass) return out({ error: "relay has no PASS set — check the property is named exactly PASS" });
      const locked = passLocked(P);                              // v12: checked BEFORE comparing
      if (locked) return out({ error: locked });
      if (!req.pass || norm(req.pass) !== norm(pass)) { passFailed(P); return out({ error: "wrong passphrase" }); }
    }
    if (req.task === "ping") { let left = DAILY_CAP - Number(P.getProperty(dayKey()) || 0);
      if (keyCounter) left = Math.min(left, BUYER_CAP - Number(P.getProperty(keyCounter) || 0));
      if (credit) left = Math.min(left, credit.left);
      return out({ ok: true, model: MODEL, left: left, credits_left: credit ? credit.left : null }); }
    const t = TASKS[req.task];
    if (!t) return out({ error: "unknown task" });
    const key = prop(P, "ANTHROPIC_KEY");
    if (!key) return out({ error: "relay has no API key yet" });

    const input = String(req.input || "").slice(0, 16000);
    if (!input.trim()) return out({ error: "nothing to send" });   // v13: before it counts against the cap

    const lock = LockService.getScriptLock(); lock.waitLock(5000);
    const n = Number(P.getProperty(dayKey()) || 0);
    if (n >= DAILY_CAP) { lock.releaseLock(); return out({ error: "daily limit reached — try again tomorrow" }); }
    const kn = keyCounter ? Number(P.getProperty(keyCounter) || 0) : 0;
    if (keyCounter && kn >= BUYER_CAP) { lock.releaseLock(); return out({ error: "your daily AI limit is used up — try again tomorrow" }); }
    let creditUsed = null;                                       // v13: reserve the credit now, under the lock
    if (credit) {
      creditUsed = Number(P.getProperty("U_" + credit.who) || 0);
      if (creditUsed >= credit.total) { lock.releaseLock(); return out({ error: "no AI questions left — add Hub AI Credits" }); }
      P.setProperty("U_" + credit.who, String(creditUsed + 1));
    }
    if (n === 0) clearOldCounters(P);                           // first request of the day
    P.setProperty(dayKey(), String(n + 1));
    if (keyCounter) P.setProperty(keyCounter, String(kn + 1));
    lock.releaseLock();
    const refund = () => { if (!credit) return;                  // no answer came back: give the credit back
      const l3 = LockService.getScriptLock(); l3.waitLock(5000);
      try { const uk = "U_" + credit.who; P.setProperty(uk, String(Math.max(0, Number(P.getProperty(uk) || 0) - 1))); } finally { l3.releaseLock(); } };

    const today = /^\d{4}-\d{2}-\d{2}$/.test(req.today || "") ? req.today : Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd");
    const system = t.system.split("{today}").join(today).split("{weekday}").join(String(req.weekday || "").slice(0, 10));
    let r;
    try { r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      payload: JSON.stringify({ model: MODEL, max_tokens: t.max, system: system, messages: [{ role: "user", content: input }] }),
    }); } catch (fe) { refund(); throw fe; }
    const code = r.getResponseCode(), j = JSON.parse(r.getContentText() || "{}");
    if (code !== 200) {                                          // v13: details to the log, plain words to the phone
      refund(); Logger.log("Claude " + code + ": " + (j.error && j.error.message || ""));
      return out({ error: code === 429 || code >= 500 ? "the AI is busy right now — try again in a minute" : "the AI couldn't answer that one — try again" }); }
    if (j.stop_reason === "refusal") { refund(); return out({ error: "Claude declined that one" }); }
    const text = (j.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
    const creditsLeft = credit ? Math.max(0, credit.total - (creditUsed + 1)) : null;   // reserved above
    return out({ text: text, usage: j.usage || null, credits_left: creditsLeft });
  } catch (err) {
    Logger.log("relay error: " + (err && err.stack || err));   // v13: the real error stays in the log
    return out({ error: "something went wrong — try again in a minute" });
  }
}

// Is this buyer's Day Hub Pro paid up, and may THIS phone use it?
// -> {valid, status, until, who} or {error} when the relay itself can't check
// (no Whop key, Whop down). The phone treats {error} as "couldn't check" and
// keeps its grace period, so a relay problem never locks out a paying customer.
function verifyBuyer(P, buyer, device, app) {
  const b = String(buyer || "").trim(), dev = String(device || "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(dev)) return { valid: false, status: "no phone id" };
  const isMem = /^mem_[A-Za-z0-9]{4,40}$/.test(b), isMail = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(b);
  if (!isMem && !isMail) return { valid: false, status: "enter the email you bought with" };
  const res = proLookup(P, b, isMem, app);
  if (res.error) return res;
  if (isMail && needsCode(P, b, dev)) {                          // v11
    // Grandfather: a phone unlocked before v11 is on the buyer's phone list - confirm it silently.
    const was = res.valid && JSON.parse(P.getProperty("D_" + res.who) || "{}")[keyHash(dev)];
    if (!was) return { valid: false, status: NEEDS_CODE };      // buyer or stranger: the same answer
    markConfirmed(P, b, dev);
  }
  if (!res.valid) return res;
  return bindPhone(P, res, dev);
}

// v11: is this buyer's Pro / Pass paid up? Cached Whop answer (6 h yes, 5 min no). -> res | {error}
function proLookup(P, b, isMem, app) {
  const whop = prop(P, "WHOP_API_KEY"), pid = prop(P, "WHOP_PRODUCT_ID");
  if (!whop || !pid) return { error: "relay has no WHOP_API_KEY / WHOP_PRODUCT_ID yet" };
  const co = prop(P, "WHOP_COMPANY_ID") || WHOP_COMPANY;
  // v5: Cruise Hub accepts its own Cruise Hub Pass as well as Day Hub Pro. v6: Trip Hub the same with its Trip Hub Pass.
  // v14 (Auto Hub v1.38): Auto Hub accepts its own Auto Hub Pro ($2.99/mo) as well as Day Hub Pro.
  const PASSES = { cruisehub: ["CRUISE_PRODUCT_ID", "Cruise Hub Pass"], triphub: ["TRIP_PRODUCT_ID", "Trip Hub Pass"], autohub: ["AUTO_PRODUCT_ID", "Auto Hub Pro", "prod_JZvlJLr71aVz4"] };   // 3rd = default id (public, on the checkout page); a Script Property overrides it
  const pass = PASSES[app] || null;
  const cpid = pass ? (prop(P, pass[0]) || pass[2] || null) : null;
  const pids = cpid ? [pid, cpid] : [pid];

  // Whop answer cached 6 h (spares Whop's API); the phone list is checked every time.
  const cache = CacheService.getScriptCache(), ck = "B_" + keyHash(b.toLowerCase() + "|" + pids.join(",")), hit = cache.get(ck);
  let res = hit ? JSON.parse(hit) : null;
  if (!res) {
    if (!lookupOk(P)) return { error: "the purchase check is busy - try again later" };
    const got = buyerMems(whop, co, b, isMem, pids);
    if (got.error) return got;
    if (!got.mems) { cache.put(ck, JSON.stringify({ valid: false, status: NOT_FOUND }), 300); return { valid: false, status: NOT_FOUND }; }
    const mems = got.mems;
    const mine = mems.filter(function (m) { return pids.indexOf(memProd(m)) >= 0; });
    const good = mine.filter(function (m) { return OK_STATUS.indexOf(m.status) >= 0; });
    const m = good[0] || mine[0];
    res = good.length
      ? { valid: true, status: String(m.status), until: m.current_period_end || m.renewal_period_end || null, who: keyHash(memUser(m) || m.id),
          product: memProd(m) === pid ? "dayhub" : app }
      : { valid: false, status: NOT_FOUND };
    cache.put(ck, JSON.stringify(res), res.valid ? 6 * 3600 : 300);
  }
  return res;
}

// Phone limit: at most MAX_PHONES per buyer; a phone unseen for PHONE_DAYS frees its spot.
function bindPhone(P, res, dev) {
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const pk = "D_" + res.who, today = Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd");
    const cutoff = Utilities.formatDate(new Date(Date.now() - PHONE_DAYS * 86400000), "America/Chicago", "yyyy-MM-dd");
    const devs = JSON.parse(P.getProperty(pk) || "{}"), dh = keyHash(dev);
    for (const d in devs) if (devs[d] < cutoff) delete devs[d];
    if (!devs[dh] && Object.keys(devs).length >= MAX_PHONES)
      return { valid: false, status: "already on " + MAX_PHONES + " phones — remove it from one (⚙ → Day Hub Pro → Remove from this phone), or wait " + PHONE_DAYS + " days" };
    devs[dh] = today; P.setProperty(pk, JSON.stringify(devs));
  } finally { lock.releaseLock(); }
  return { valid: true, status: res.status, until: res.until, who: res.who, product: res.product || "dayhub" };
}

// The buyer's Whop memberships in pids (email search or mem_ id).
// -> {mems} | {error} | {valid:false, status} (no Whop user with that email).
function buyerMems(whop, co, b, isMem, pids) {
  if (isMem) {
    const m = whopGet(whop, "/memberships/" + encodeURIComponent(b), {});
    if (m.error) return m;
    return { mems: m.notFound ? [] : [m] };
  }
  const want = b.toLowerCase();
  const found = whopGet(whop, "/members", { account_id: co, query: b, first: 50 });
  if (found.error) return found;
  const hits = (found.data || []).map(function (x) { return x.user; }).filter(function (u) { return u && u.id; });
  let users = hits.filter(function (u) { return String(u.email || "").toLowerCase() === want; });
  // 10/3 measured: Whop's /members returns user WITHOUT email for a company key
  // (user = id, username, name, profile_picture) even with member:email:read, but its
  // search DOES match by email. A full address cannot match a name/username by
  // accident, so exactly ONE search hit = that buyer. Several hits = refuse.
  if (!users.length && hits.length === 1 && hits[0].email === undefined) users = hits;
  if (!users.length) return { valid: false, status: "no Whop purchase with that email" };
  let mems = [];
  for (let k = 0; k < users.length; k++) {
    const list = whopGet(whop, "/memberships", { account_id: co, user_ids: users[k].id, product_ids: pids, first: 50 });
    if (list.error) return list;
    mems = mems.concat((list.data || []).filter(function (m) { return memUser(m) === users[k].id; }));
  }
  return { mems: mems };
}

// v8: the buyer's Whop user id(s) - same email search as buyerMems (one exact hit), or the
// user behind a mem_ id. -> {ids} | {error} | {valid:false, status}
function buyerUserIds(whop, co, b, isMem) {
  if (isMem) {
    const m = whopGet(whop, "/memberships/" + encodeURIComponent(b), {});
    if (m.error) return m;
    const u = m.notFound ? "" : memUser(m);
    return u ? { ids: [u] } : { valid: false, status: "not a Whop membership id" };
  }
  const want = b.toLowerCase();
  const found = whopGet(whop, "/members", { account_id: co, query: b, first: 50 });
  if (found.error) return found;
  const hits = (found.data || []).map(function (x) { return x.user; }).filter(function (u) { return u && u.id; });
  let users = hits.filter(function (u) { return String(u.email || "").toLowerCase() === want; });
  if (!users.length && hits.length === 1 && hits[0].email === undefined) users = hits;   // see buyerMems
  if (!users.length) return { valid: false, status: "no Whop purchase with that email" };
  return { ids: users.map(function (u) { return u.id; }) };
}
// A payment's buyer, whether it counts (paid, not refunded), and how many questions it bought.
function payUser(p) { return (p && (p.user_id || (p.user && p.user.id))) || ""; }
function payPaid(p) {
  return p && p.status === "paid" && !/refund|dispute|chargeback|fail|void/i.test(String(p.substatus || "")) && !p.refunded_at;
}
function payQuestions(p, packs) {
  const items = p.line_items && p.line_items.length ? p.line_items : [{ product_id: p.product_id, quantity: 1 }];
  return items.reduce(function (n, li) {
    const q = Number(packs[li.product_id]) || 0;
    return n + q * Math.max(1, Number(li.quantity) || 1);
  }, 0);
}

// v7 Hub AI Credits: {"prod_...": questions} from Script Property AI_CREDIT_PRODUCTS, or null (credits off).
function creditProducts(P) {
  try { const o = JSON.parse(prop(P, "AI_CREDIT_PRODUCTS") || "null");
    return o && typeof o === "object" && Object.keys(o).length ? o : null; } catch (e) { return null; }
}

// How many AI questions this buyer has left. -> {left, total, used, who} | {error} | {left:0, status}
// Packs bought are cached 10 min (spares Whop); what was used is read fresh every time.
function creditsFor(P, buyer, device) {
  const packs = creditProducts(P);
  if (!packs) return { left: 0, total: 0, status: "Hub AI Credits aren't on sale yet" };
  const b = String(buyer || "").trim();
  const isMem = /^mem_[A-Za-z0-9]{4,40}$/.test(b), isMail = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(b);
  if (!isMem && !isMail) return { left: 0, total: 0, status: "enter the email you bought with" };
  if (isMail && needsCode(P, b, String(device || "").trim())) return { left: 0, total: 0, status: NEEDS_CODE };   // v11
  const got = creditLookup(P, b, isMem, packs);
  if (got.error) return got;
  if (!got.who) return { left: 0, total: 0, status: "no Hub AI Credits with that email" };
  const used = Number(P.getProperty("U_" + got.who) || 0);
  return { left: Math.max(0, got.total - used), total: got.total, used: used, who: got.who };
}

// v11: packs this buyer paid for, cached 10 min (5 min for "none"). -> {total, who} | {error}
function creditLookup(P, b, isMem, packs) {
  const whop = prop(P, "WHOP_API_KEY");
  if (!whop) return { error: "relay has no WHOP_API_KEY yet" };
  const co = prop(P, "WHOP_COMPANY_ID") || WHOP_COMPANY, pids = Object.keys(packs);
  const cache = CacheService.getScriptCache(), ck = "C_" + keyHash(b.toLowerCase() + "|" + pids.join(",")), hit = cache.get(ck);
  let got = hit ? JSON.parse(hit) : null;
  if (!got) {
    if (!lookupOk(P)) return { error: "the purchase check is busy - try again later" };
    const u = buyerUserIds(whop, co, b, isMem);
    if (u.error) return u;
    if (!u.ids) { got = { total: 0, who: "" }; cache.put(ck, JSON.stringify(got), 300); return got; }
    let total = 0, who = "";
    for (let k = 0; k < u.ids.length; k++) {
      const list = whopGet(whop, "/payments", { account_id: co, user_id: u.ids[k], first: 100 });
      if (list.error) return list;
      (list.data || []).forEach(function (p) {
        if (payUser(p) !== u.ids[k] || !payPaid(p)) return;
        const n = payQuestions(p, packs);
        if (n > 0) { total += n; who = who || keyHash(u.ids[k]); }
      });
    }
    got = { total: total, who: who };
    cache.put(ck, JSON.stringify(got), 600);
  }
  return got;
}

// v10: counts uncached Whop lookups today; false once LOOKUP_CAP is reached (cleared with the day's N_ counters).
function lookupOk(P) {
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const k = dayKey() + "_L", n = Number(P.getProperty(k) || 0);
    if (n >= LOOKUP_CAP) return false;
    P.setProperty(k, String(n + 1)); return true;
  } finally { lock.releaseLock(); }
}

// "Remove from this phone": frees the phone's spot. Needs the same email/mem id
// AND the phone id, so nobody can knock someone else's phones off by email alone.
function releasePhone(P, buyer, device, app) {
  const v = verifyBuyer(P, buyer, device, app);
  if (!v.valid) return { ok: true };
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const pk = "D_" + v.who, devs = JSON.parse(P.getProperty(pk) || "{}");
    delete devs[keyHash(String(device))]; P.setProperty(pk, JSON.stringify(devs));
  } finally { lock.releaseLock(); }
  P.deleteProperty(confirmKey(buyer, device));                  // v11: a removed phone confirms again next time
  return { ok: true };
}

// ---- v11 email codes (store audit S2) ----
const codesOn = P => /^(1|true|yes|on)$/i.test(String(prop(P, "EMAIL_CODES") || "").trim());
const confirmKey = (b, dev) => "V_" + keyHash(String(b || "").trim().toLowerCase() + "|" + String(dev || "").trim());
function needsCode(P, b, dev) { return codesOn(P) && !P.getProperty(confirmKey(b, dev)); }
function markConfirmed(P, b, dev) { P.setProperty(confirmKey(b, dev), Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd")); }

// Did this address buy any Hub product (Pro, a Pass or AI Credits)? Same cached lookups as verify / credits.
function hubBuyer(P, b) {
  for (const app of ["dayhub", "cruisehub", "triphub"]) {
    const r = proLookup(P, b, false, app);
    if (r.error) return r;
    if (r.valid) return { yes: true };
  }
  const packs = creditProducts(P);
  if (packs) { const c = creditLookup(P, b, false, packs); if (c.error) return c; if (c.who) return { yes: true }; }
  return { yes: false };
}

function sendCode(P, buyer, device) {
  if (!codesOn(P)) return { error: "email codes aren't switched on" };
  const b = String(buyer || "").trim().toLowerCase(), dev = String(device || "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(dev)) return { error: "no phone id" };
  if (!/^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(b)) return { error: "enter the email you bought with" };
  const cache = CacheService.getScriptCache(), rk = "R_" + keyHash(b), n = Number(cache.get(rk) || 0);
  if (n >= CODES_PER_HOUR) return { error: "too many codes for that email - try again in an hour" };
  cache.put(rk, String(n + 1), 3600);                           // counted for EVERY address, buyer or not
  const hb = hubBuyer(P, b);
  if (hb.error) return { error: "couldn't check right now - try again in a minute" };
  if (hb.yes) {
    if (MailApp.getRemainingDailyQuota() < 2) return { error: "couldn't send the email today - try again tomorrow" };
    const digits = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + "|" + Date.now());
    const code = String(((((digits[0] & 255) << 16) | ((digits[1] & 255) << 8) | (digits[2] & 255)) >>> 0) % 1000000).padStart(6, "0");
    cache.put("K_" + keyHash(b + "|" + dev), JSON.stringify({ h: keyHash("c|" + code + "|" + b + "|" + dev), n: 0 }), CODE_MINUTES * 60);
    MailApp.sendEmail({ to: b, name: "Marvel Corp Hub apps", subject: "Your Hub app code: " + code,
      body: "Your code is " + code + "\n\nEnter it in the app to use your purchase on this phone. It works for " + CODE_MINUTES +
            " minutes.\n\nDidn't ask for it? Ignore this email - nobody can use your purchase without this code.\n\nMarvel Corp" });
  }
  return { sent: true };                                         // the same answer whether or not an email went out
}

function confirmCode(P, buyer, device, code) {
  if (!codesOn(P)) return { ok: false };
  const b = String(buyer || "").trim().toLowerCase(), dev = String(device || "").trim(), c = String(code || "").replace(/\D/g, "");
  const cache = CacheService.getScriptCache(), k = "K_" + keyHash(b + "|" + dev), rec = JSON.parse(cache.get(k) || "null");
  if (!rec || c.length !== 6) return { ok: false };
  if (rec.n >= CODE_TRIES) { cache.remove(k); return { ok: false }; }
  if (rec.h !== keyHash("c|" + c + "|" + b + "|" + dev)) { rec.n++; cache.put(k, JSON.stringify(rec), CODE_MINUTES * 60); return { ok: false }; }
  cache.remove(k); markConfirmed(P, b, dev);
  return { ok: true };
}

// ---- v12 owner-passphrase guess limit (store audit S8) ----
const hourKey = () => "PF_" + Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd-HH");
function passLocked(P) {
  if (Number(P.getProperty(dayKey() + "_PF") || 0) >= PASS_FAILS_DAY) return "too many wrong passphrases today - locked until tomorrow";
  if (Number(CacheService.getScriptCache().get(hourKey()) || 0) >= PASS_FAILS_HOUR) return "too many wrong passphrases - try again in an hour";
  return "";
}
function passFailed(P) {
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache(), hk = hourKey(), dk = dayKey() + "_PF";
    cache.put(hk, String(Number(cache.get(hk) || 0) + 1), 3600);
    P.setProperty(dk, String(Number(P.getProperty(dk) || 0) + 1));   // N_<day>_PF: cleared with the day's counters
  } finally { lock.releaseLock(); }
}

// Run ONCE from the editor after pasting v11: Google asks Scott to Allow "send email as you".
function authMail() { Logger.log("emails left today: " + MailApp.getRemainingDailyQuota()); }

// GET a Whop endpoint. Array params go form/explode style (a=1&a=2).
function whopGet(whop, path, params) {
  const q = [];
  for (const k in params) [].concat(params[k]).forEach(function (v) { q.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)); });
  const r = UrlFetchApp.fetch(WHOP_API + path + (q.length ? "?" + q.join("&") : ""), {
    method: "get", muteHttpExceptions: true,
    headers: { "Authorization": "Bearer " + whop, "Api-Version-Date": WHOP_VERSION },
  });
  const code = r.getResponseCode();
  if (code === 404) return { notFound: true };
  if (code === 401 || code === 403) return { error: "Whop refused the relay's key (" + code + ") — check its scopes" };
  if (code !== 200) return { error: "Whop said " + code };
  return JSON.parse(r.getContentText() || "{}");
}

// 10/3 measured: the live API returns memberships FLAT (user_id, product_id,
// current_period_end) where the docs show nested user/product objects. Read both.
function memUser(m) { return (m && (m.user_id || (m.user && m.user.id))) || ""; }
function memProd(m) { return (m && (m.product_id || (m.product && m.product.id))) || ""; }

// Short, one-way id (email, user id, phone id) - the value itself is never written to Properties.
function keyHash(key) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(key))).slice(0, 16);
}

// Yesterday's counters (N_<day>, N_<day>_K_<hash>) - keeps Properties small.
function clearOldCounters(P) {
  const today = dayKey(), all = P.getProperties();
  for (const k in all) if (/^N_\d{4}-\d{2}-\d{2}/.test(k) && k.indexOf(today) !== 0) P.deleteProperty(k);
}

// Property names in any capitals ("Pass", "anthropic_key" - Scott's first save, 10/2).
function prop(P, name) {
  const all = P.getProperties();
  for (const k in all) if (k.trim().toUpperCase() === name) return all[k];
  return null;
}

// v9 Hub Series waitlist -> one row in Scott's "Hub Waitlist" sheet. Never reads anything back out.
function waitlistAdd(P, req) {
  const email = String(req.email || "").trim().toLowerCase().slice(0, 190);
  if (!/^[^@\s]{1,64}@[^@\s]{1,120}\.[^@\s]{2,}$/.test(email)) return { ok: false, error: "enter a real email" };
  const app = WAITLIST_APPS.indexOf(String(req.app || "")) >= 0 ? String(req.app) : "All of them";
  const id = prop(P, "WAITLIST_SHEET_ID");
  if (!id) return { ok: false, error: "waitlist not set up" };
  const cache = CacheService.getScriptCache(), ck = "W_" + keyHash(email + "|" + app);
  if (cache.get(ck)) return { ok: true, dup: true };
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const dk = "W_" + dayKey(), n = Number(P.getProperty(dk) || 0);
    if (n >= WAITLIST_CAP) return { ok: false, error: "the waitlist is busy - try again tomorrow" };
    const sh = SpreadsheetApp.openById(id).getSheets()[0];
    const last = sh.getLastRow();
    if (last > 1) {                                          // already on the list for this app?
      const rows = sh.getRange(2, 2, last - 1, 2).getValues();
      for (let i = 0; i < rows.length; i++) if (String(rows[i][0]).toLowerCase() === email && rows[i][1] === app) { cache.put(ck, "1", 21600); return { ok: true, dup: true }; }
    }
    const cell = v => /^[=+\-@\t\r]/.test(v) ? "'" + v : v;   // v13: tab / CR too   // never let a value become a sheet formula
    sh.appendRow([Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd HH:mm"), cell(email), app, cell(String(req.src || "").slice(0, 40))]);
    P.setProperty(dk, String(n + 1));
    cache.put(ck, "1", 21600);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

// Run ONCE from the editor: makes the "Hub Waitlist" sheet in Scott's Drive and remembers its id.
function setupWaitlist() {
  const P = PropertiesService.getScriptProperties();
  if (prop(P, "WAITLIST_SHEET_ID")) { Logger.log("already set up: " + prop(P, "WAITLIST_SHEET_ID")); return; }
  const ss = SpreadsheetApp.create("Hub Waitlist");
  const sh = ss.getSheets()[0]; sh.setName("Waitlist");
  sh.appendRow(["When (CT)", "Email", "App", "From"]); sh.setFrozenRows(1);
  P.setProperty("WAITLIST_SHEET_ID", ss.getId());
  Logger.log("made " + ss.getUrl());
}

function doGet() { return out({ ok: true, app: "dayhub-ai-relay" }); }

function dayKey() { return "N_" + Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd"); }

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
