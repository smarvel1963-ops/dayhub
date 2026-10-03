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
 * v4 (Day Hub v0.40, Scott 10/3 "make it saleable ... things to turn on once
 * approved"). The PASS path is UNCHANGED. Added, all dormant until Scott sets
 * the Script Properties below:
 *   task "verify"  - checks a Day Hub Pro (Whop) license key with Whop's API.
 *   license keys   - a phone with an active key may use the AI tasks instead of
 *                    the PASS, ONLY while AI_PUBLIC is set, with its own daily
 *                    cap (KEY_CAP) on top of the shared DAILY_CAP.
 * New Script Properties (any capitals):
 *     WHOP_API_KEY    = a Whop company API key (Admin role is simplest)
 *     WHOP_PRODUCT_ID = prod_... of Day Hub Pro (optional; when set, keys for
 *                       any OTHER Whop product are refused)
 *     AI_PUBLIC       = true   (leave it out = license keys get no AI)
 * Whop: GET https://api.whop.com/api/v1/memberships/{id} - "{id}" may be the
 * membership id OR the license key (docs.whop.com, Retrieve membership, read
 * 10/3/2026). Api-Version-Date pinned: without it Whop answers with the
 * 2025-01-01 API whose field names differ.
 */
const MODEL = "claude-haiku-4-5";
const DAILY_CAP = 200;              // requests per day, all tasks together
const KEY_CAP = 30;                 // per Whop license key per day (inside DAILY_CAP)
const WHOP_API = "https://api.whop.com/api/v1";
const WHOP_VERSION = "2026-09-15";
// Still paid up: "canceling" runs to the end of the period, "past_due" is Whop retrying the card.
const OK_STATUS = ["active", "trialing", "past_due", "canceling"];

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
    if (req.task === "verify") return out(verifyLicense(P, req.license));
    let keyCounter = null;                                       // set = this request is on a license key
    if (req.license && !req.pass) {
      if (!/^(1|true|yes|on)$/i.test(String(prop(P, "AI_PUBLIC") || "").trim())) return out({ error: "the AI helper for Pro isn't switched on yet" });
      const v = verifyLicense(P, req.license);
      if (v.error) return out({ error: v.error });
      if (!v.valid) return out({ error: "license key not active" });
      keyCounter = dayKey() + "_K_" + keyHash(req.license);
    } else {
      const pass = prop(P, "PASS");
      if (!pass) return out({ error: "relay has no PASS set — check the property is named exactly PASS" });
      if (!req.pass || norm(req.pass) !== norm(pass)) return out({ error: "wrong passphrase" });
    }
    if (req.task === "ping") { let left = DAILY_CAP - Number(P.getProperty(dayKey()) || 0);
      if (keyCounter) left = Math.min(left, KEY_CAP - Number(P.getProperty(keyCounter) || 0));
      return out({ ok: true, model: MODEL, left: left }); }
    const t = TASKS[req.task];
    if (!t) return out({ error: "unknown task" });
    const key = prop(P, "ANTHROPIC_KEY");
    if (!key) return out({ error: "relay has no API key yet" });

    const lock = LockService.getScriptLock(); lock.waitLock(5000);
    const n = Number(P.getProperty(dayKey()) || 0);
    if (n >= DAILY_CAP) { lock.releaseLock(); return out({ error: "daily limit reached — try again tomorrow" }); }
    const kn = keyCounter ? Number(P.getProperty(keyCounter) || 0) : 0;
    if (keyCounter && kn >= KEY_CAP) { lock.releaseLock(); return out({ error: "your daily AI limit is used up — try again tomorrow" }); }
    if (n === 0) clearOldCounters(P);                           // first request of the day
    P.setProperty(dayKey(), String(n + 1));
    if (keyCounter) P.setProperty(keyCounter, String(kn + 1));
    lock.releaseLock();

    const today = /^\d{4}-\d{2}-\d{2}$/.test(req.today || "") ? req.today : Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd");
    const system = t.system.split("{today}").join(today).split("{weekday}").join(String(req.weekday || "").slice(0, 10));
    const input = String(req.input || "").slice(0, 16000);
    if (!input.trim()) return out({ error: "nothing to send" });

    const r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      payload: JSON.stringify({ model: MODEL, max_tokens: t.max, system: system, messages: [{ role: "user", content: input }] }),
    });
    const code = r.getResponseCode(), j = JSON.parse(r.getContentText() || "{}");
    if (code !== 200) return out({ error: "Claude said " + code + (j.error && j.error.message ? ": " + j.error.message : "") });
    if (j.stop_reason === "refusal") return out({ error: "Claude declined that one" });
    const text = (j.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
    return out({ text: text, usage: j.usage || null });
  } catch (err) {
    return out({ error: String(err && err.message || err) });
  }
}

// Is this Whop license key paid up? {valid, status, until} - or {error} when the
// relay itself can't check (no Whop key, Whop down). The phone treats {error} as
// "couldn't check" and keeps its grace period, so a relay problem never locks
// out a paying customer. Good answers are cached 6 hours to spare Whop's API.
function verifyLicense(P, license) {
  const key = String(license || "").trim();
  if (!/^[A-Za-z0-9_-]{6,100}$/.test(key)) return { valid: false, status: "not a license key" };
  const whop = prop(P, "WHOP_API_KEY");
  if (!whop) return { error: "relay has no WHOP_API_KEY yet" };
  const cache = CacheService.getScriptCache(), ck = "L_" + keyHash(key), hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const r = UrlFetchApp.fetch(WHOP_API + "/memberships/" + encodeURIComponent(key), {
    method: "get", muteHttpExceptions: true,
    headers: { "Authorization": "Bearer " + whop, "Api-Version-Date": WHOP_VERSION },
  });
  const code = r.getResponseCode();
  if (code === 404) return { valid: false, status: "not found" };
  if (code !== 200) return { error: "Whop said " + code };
  const m = JSON.parse(r.getContentText() || "{}");
  const pid = prop(P, "WHOP_PRODUCT_ID");
  const res = (pid && !(m.product && m.product.id === pid))
    ? { valid: false, status: "a different product" }
    : { valid: OK_STATUS.indexOf(m.status) >= 0, status: String(m.status || ""), until: m.renewal_period_end || null };
  if (res.valid) cache.put(ck, JSON.stringify(res), 6 * 3600);
  return res;
}

// Short, one-way id for a key - the key itself is never written to Properties.
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

function doGet() { return out({ ok: true, app: "dayhub-ai-relay" }); }

function dayKey() { return "N_" + Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd"); }

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
