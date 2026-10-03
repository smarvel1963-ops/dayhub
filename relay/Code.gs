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
 */
const MODEL = "claude-haiku-4-5";
const DAILY_CAP = 200;              // requests per day, all tasks together

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
    const pass = P.getProperty("PASS");
    if (!pass || req.pass !== pass) return out({ error: "wrong passphrase" });
    if (req.task === "ping") return out({ ok: true, model: MODEL, left: DAILY_CAP - Number(P.getProperty(dayKey()) || 0) });
    const t = TASKS[req.task];
    if (!t) return out({ error: "unknown task" });
    const key = P.getProperty("ANTHROPIC_KEY");
    if (!key) return out({ error: "relay has no API key yet" });

    const lock = LockService.getScriptLock(); lock.waitLock(5000);
    const n = Number(P.getProperty(dayKey()) || 0);
    if (n >= DAILY_CAP) { lock.releaseLock(); return out({ error: "daily limit reached — try again tomorrow" }); }
    P.setProperty(dayKey(), String(n + 1)); lock.releaseLock();

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

function doGet() { return out({ ok: true, app: "dayhub-ai-relay" }); }

function dayKey() { return "N_" + Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd"); }

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
