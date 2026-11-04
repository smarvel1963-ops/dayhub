"""
SAVE AS: test_pro_lapse.py   LOCATION: C:/MarvelApps/dayhub/tests/test_pro_lapse.py

v1.58b PRO LAPSE (Scott 11/01 "Yes, fix it" + his spec): when a phone's Pro has ended, Google Calendar sync and Drive
backup PAUSE. Before, only turning them ON checked Pro - sync on open, "Tap to sync", the silent sign-in renewal and the
auto-backup never checked again, so a lapsed phone kept both. Nothing is deleted, restoring your own backup stays open,
AI credits still work, and renewing picks up where it left off with no doubled events. The 14-day grace is unchanged.
Covers: active Pro, grace, expired, renewed, offline, failed checks, the week-before heads-up, the Play app wording,
phones that never had Pro, backup files, the Settings boxes, Cruise Hub, and Auto Hub and Home Hub riding on Day Hub Pro.
Drives the real app with the main suite's helpers (run_tests.py: fake network, frozen clock 2026-10-01 08:00 CT).

RUN:   python tests/test_pro_lapse.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

# A fake Google (Calendar events + Drive in memory) and a switchable Pro check, every call counted in window.__calls.
# window.__verify: unset = the main suite's fake relay answers; "offline" = no signal; "error" = the relay can't check;
# an object = that answer.
FAKE_GOOGLE = """() => { window.__g = {}; window.__calls = { cal: 0, drive: 0, verify: 0 }; let n = 0; const real = window.fetch;
  window.fetch = async (u, o = {}) => { u = String(u); const m = o.method || 'GET';
    const J = (x, st = 200) => new Response(x == null ? null : JSON.stringify(x), { status: st });
    if (u.startsWith('https://www.googleapis.com/calendar/')) { window.__calls.cal++;
      if (m === 'GET') return J({ items: Object.values(window.__g) });
      if (m === 'POST') { const e = { ...JSON.parse(o.body), id: 'g' + (++n) }; window.__g[e.id] = e; return J(e); }
      return J({}); }
    if (u.includes('googleapis.com/drive') || u.includes('googleapis.com/upload/drive')) { window.__calls.drive++; return J({ files: [] }); }
    if (u === AI_URL && JSON.parse(o.body || '{}').task === 'verify') { window.__calls.verify++; window.__lastVerify = JSON.parse(o.body);
      if (window.__verify === 'offline') throw new TypeError('Failed to fetch');
      if (window.__verify === 'error') return J({ error: 'relay has no WHOP_API_KEY yet' });
      if (window.__verify) return J(window.__verify); }
    return real(u, o); }; }"""
DAY = 86400000
def pro(ok=True, days_ago=0, status="active", until=None):
    u = "null" if until is None else until
    return (f"localStorage.setItem('dayhub.pro', JSON.stringify({{ buyer: 'buyer@example.com', ok: {str(ok).lower()}, "
            f"checked: Date.now() - {days_ago} * {DAY}, status: '{status}', until: {u}, product: 'dayhub' }}))")
PRO_OK, PRO_ENDED = pro(), pro(ok=False, status="not found")
LINKS_ON = ("GTOKEN = 'tok'; GTOKEN_EXP = Date.now() + 3e6; DTOKEN = 'dtok'; DTOKEN_EXP = Date.now() + 3e6;"
            "S.gcal.connected = true; S.gcal.scope = GCAL_SCOPE; S.sync.on = true; saveLocal()")
CALLS0 = "window.__calls = { cal: 0, drive: 0, verify: 0 }"
CREDITS = "localStorage.setItem('hub.aicredits', JSON.stringify({ buyer: 'buyer@example.com', left: 5 }))"
DENTISTS = "Object.values(window.__g).filter(e => e.summary === 'Dentist').length"


def phone(b, base, pro_js, path="/", links=True):
    a = T.App(b, base, path=path)
    T.setup(a)
    a.js(FAKE_GOOGLE)
    a.js(pro_js)
    if links: a.js(LINKS_ON)
    a.qa("event", {"title": "Dentist", "date": "2026-10-05", "time": "14:30"}); a.js("closeQA()")
    return a


def top(a):
    a.js("render()")
    return T.hero(a)


def synced(a):
    a.js(CALLS0 + "; syncOnOpen(true)"); a.page.wait_for_timeout(800)
    return a.js("window.__calls")


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. active Pro: nothing changes]")
        a = phone(b, base, PRO_OK)
        c = synced(a)
        check("Pro phone: Calendar + Drive sync on open as before", c["cal"] > 0 and c["drive"] > 0, c)
        check("the event reached the phone calendar once", a.js(DENTISTS) == 1)
        h = top(a)
        check("no paused chip, no ending chip", "paused" not in h and "ends" not in h, h[-200:])
        a.js(CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(300)
        check("checked today: no extra trip to the Pro check", a.js("window.__calls.verify") == 0)
        a.js(pro(days_ago=8) + "; window.__verify = 'offline'; " + CALLS0 + "; recheckPro(); recheckPro(); recheckPro()"); a.page.wait_for_timeout(300)
        check("a due check that fails is tried once, not on every return to the app", a.js("window.__calls.verify") == 1)
        a.js("window.__verify = undefined; " + PRO_OK)
        a.close()

        print("\n[2. Pro ended: Calendar sync and backup pause]")
        a = phone(b, base, PRO_ENDED)
        check("the phone is not Pro any more", not a.js("isPro()") and not a.js("can('gcal')") and not a.js("can('sync')"))
        c = synced(a)
        check("sync on open sends nothing to Calendar or Drive", c["cal"] == 0 and c["drive"] == 0, c)
        a.js("gcalPush(); gcalFetch()"); a.page.wait_for_timeout(400)
        check("Calendar push / fetch called directly (the Schedule card's Tap to sync) do nothing", a.js("window.__calls.cal") == 0 and a.js(DENTISTS) == 0)
        a.js("S.todos.push({id:'t1', title:'Call insurance', day: today(), done:false}); save()"); a.page.clock.fast_forward(8000); a.page.wait_for_timeout(300)
        check("a change doesn't back up a few seconds later (it waits, marked as changed)", a.js("window.__calls.drive") == 0 and a.js("S.sync.dirty"))
        a.js("backupNow()"); a.page.wait_for_timeout(300)
        check("Back up now says it's part of Pro and sends nothing", a.js("window.__calls.drive") == 0 and "part of" in a.js("document.getElementById('toast').textContent"))
        a.js("GTOKEN_EXP = Date.now() - 1000; DTOKEN_EXP = Date.now() - 1000")
        check("no silent sign-in renewal and no 'Tap to sync' for paused links", a.js("autoScopes().length") == 0 and a.js("needTap().length") == 0)
        h = top(a)
        check("one gentle chip: your info is safe, sync and backup paused, plan named", "Your info is safe" in h and "Calendar sync and backup paused (Day Hub Pro ended)" in h, h[-300:])
        check("nothing was deleted: still connected, backup still on, events + to-dos kept",
              a.js("S.gcal.connected && S.sync.on && S.events.some(e => e.title === 'Dentist') && S.todos.some(t => t.title === 'Call insurance')"))
        check("restoring your own backup stays open (no Pro check in restoreNow)", "can(" not in a.js("restoreNow.toString()"))
        a.page.click("#hero [data-open='sheet']"); a.page.wait_for_timeout(200)
        check("the chip opens Settings", a.js("!document.getElementById('sheet').classList.contains('hidden')"))
        pb = a.page.inner_text("#proBox")
        check("Settings says it's paused, that the info is safe, and how to pick up again", "Calendar sync and backup are paused" in pb and "Your info is safe" in pb and "Unlock" in pb, pb[:300])
        a.js("closeSettings()")
        a.js("localStorage.setItem('hub.aicredits', JSON.stringify({ buyer: 'credit@example.com', left: 40, checked: Date.now() }))")
        check("AI credits bought separately still work after Pro ends", a.js("aiOn() && aiBuyer() === 'credit@example.com'"))
        a.js("localStorage.removeItem('hub.aicredits')")

        print("\n[3. renewed: welcome back, picks up where it left off, nothing doubles]")
        a.js("GTOKEN_EXP = Date.now() + 3e6; DTOKEN_EXP = Date.now() + 3e6; " + CALLS0)
        a.js("unlockPro('buyer@example.com')"); a.page.wait_for_timeout(1200)
        check("Unlock after renewing: Pro again", a.js("isPro() && can('gcal') && can('sync')"))
        check("it says welcome back (not just 'unlocked')", "Welcome back" in a.js("document.getElementById('toast').textContent"), a.js("document.getElementById('toast').textContent"))
        check("and syncs right away: Calendar + Drive", a.js("window.__calls.cal") > 0 and a.js("window.__calls.drive") > 0, a.js("window.__calls"))
        check("the waiting backup went (no longer marked as changed)", not a.js("S.sync.dirty"))
        check("the event reached the phone calendar", a.js(DENTISTS) == 1)
        synced(a); synced(a)
        check("syncing again and again: still ONE Dentist on the phone calendar", a.js(DENTISTS) == 1, a.js(DENTISTS))
        check("the paused chip is gone", "paused" not in top(a))
        a.close()

        print("\n[4. renewed on Whop, app just opened: the daily check finds it]")
        a = phone(b, base, pro(ok=False, days_ago=2, status="not found"))
        a.js(CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(1200)
        check("paused phone re-checks after a day", a.js("window.__calls.verify") == 1)
        check("...finds the renewal: Pro, welcome back, synced", a.js("isPro()") and "Welcome back" in a.js("document.getElementById('toast').textContent") and a.js("window.__calls.cal") > 0)
        a.page.clock.fast_forward(16 * 60000)
        a.js(pro(ok=False, days_ago=0.1, status="not found") + "; " + CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(300)
        check("but not more than once a day", a.js("window.__calls.verify") == 0)
        a.close()
        a = phone(b, base, pro(ok=False, days_ago=2, status="not found"), links=False)
        a.js(CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(300)
        check("a phone that never used sync isn't re-checked daily", a.js("window.__calls.verify") == 0)
        a.close()

        print("\n[5. grace: no signal or a broken check never pauses a paying phone early]")
        a = phone(b, base, pro(days_ago=10))
        a.js("window.__verify = 'offline'; " + CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(300)
        check("10 days since the last check, offline: tries the check", a.js("window.__calls.verify") == 1)
        check("...still Pro (14-day grace), still syncing, no paused chip", a.js("isPro()") and synced(a)["cal"] > 0 and "paused" not in top(a))
        a.page.clock.fast_forward(16 * 60000)                          # one try per 15 min
        a.js("window.__verify = 'error'; " + CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(300)
        check("...tried again after 15 minutes", a.js("window.__calls.verify") == 1)
        check("the relay can't check (its own error): still Pro, nothing lost", a.js("isPro() && JSON.parse(localStorage.getItem('dayhub.pro')).ok === true"))
        a.js(pro(days_ago=22))
        check("22 days without reaching the check (past 7 + 14): paused", not a.js("isPro()") and "paused" in top(a) and synced(a)["cal"] == 0)
        check("...the line says it needs a check, not that it ended", "needs a quick check" in top(a))
        a.page.clock.fast_forward(16 * 60000)
        a.js("window.__verify = undefined; " + CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(1200)
        check("signal back + still paid: Pro again and syncing", a.js("isPro()") and a.js("window.__calls.cal") > 0)
        a.close()

        print("\n[6. the check says no: pause]")
        a = phone(b, base, pro(days_ago=8))
        a.js("window.__verify = { valid: false, status: 'not found' }; recheckPro()"); a.page.wait_for_timeout(300)
        check("'not found' (refunded / ended): paused at once, email kept for Check now", not a.js("isPro()") and "paused" in top(a)
              and a.js("JSON.parse(localStorage.getItem('dayhub.pro')).buyer") == "buyer@example.com")
        check("...events still on the phone", a.js("S.events.some(e => e.title === 'Dentist')"))
        a.close()

        print("\n[7. the week before a plan set not to renew ends]")
        soon = "'2026-10-06T05:00:00Z'"                                  # 5 days after the frozen 10-01 08:00 CT
        a = phone(b, base, pro(status="canceling", until=soon))
        h = top(a)
        check("canceling, 5 days left: 'Day Hub Pro ends in 5 days · renew to keep automatic syncing'", "Day Hub Pro ends in 5 days · renew to keep automatic syncing" in h, h[-300:])
        check("...still fully Pro meanwhile (syncs)", synced(a)["cal"] > 0)
        a.js("openSettings ? openSettings() : document.getElementById('settingsBtn').click()"); a.page.wait_for_timeout(200)
        check("Settings says when and that it's set not to renew", "Ends in 5 days" in a.page.inner_text("#proBox"))
        a.js("closeSettings()")
        a.js(pro(status="canceling", until=str(1791262800)))             # Unix seconds, 2026-10-06 (Whop can send either)
        check("a date in Unix seconds reads the same", a.js("proEndsIn()") == 5)
        a.js(pro(status="active", until=soon))
        check("set to renew (active): no warning", a.js("proEndsIn()") == -1 and "ends in" not in top(a))
        a.js(pro(status="canceling", until="'2026-10-21T05:00:00Z'"))
        check("canceling but 20 days left: not yet", a.js("proEndsIn()") == -1)
        a.js(pro(status="canceling", until="'2026-09-30T05:00:00Z'", days_ago=0.6) + "; " + CALLS0 + "; window.__verify = { valid: false, status: 'not found' }; recheckPro()")
        a.page.wait_for_timeout(300)
        check("end date passed: checks again within the day (not a week later) and pauses", a.js("window.__calls.verify") == 1 and not a.js("isPro()"))
        a.close()
        a = phone(b, base, pro(status="canceling", until=soon), links=False)
        h = top(a)
        check("no sync on: plain 'Day Hub Pro ends in 5 days', no syncing wording", "Day Hub Pro ends in 5 days" in h and "automatic syncing" not in h, h[-300:])
        a.close()

        print("\n[8. the Play app: no Pro wording]")
        a = phone(b, base, PRO_ENDED, path="/?src=play")
        h = top(a)
        check("paused: 'Your info is safe · Calendar sync and backup are off on this phone', never 'Pro'",
              "Your info is safe · Calendar sync and backup are off on this phone" in h and "Pro" not in h, h[-300:])
        a.close()
        a = phone(b, base, pro(status="canceling", until=soon), path="/?src=play")
        h = top(a)
        check("ending: 'Calendar sync and backup end in 5 days on this phone', never 'Pro'", "Calendar sync and backup end in 5 days on this phone" in h and "Pro" not in h, h[-300:])
        a.close()
        a = phone(b, base, pro(status="canceling", until=soon), path="/?src=play", links=False)
        check("ending, no sync on: no chip at all", "end in" not in top(a))
        a.close()

        print("\n[9. never Pro on this phone (sync from before Pro existed): honest wording]")
        a = phone(b, base, "localStorage.removeItem('dayhub.pro')")
        h = top(a)
        check("'Calendar sync and backup are part of Day Hub Pro · your info is safe' - never 'ended'",
              "Calendar sync and backup are part of Day Hub Pro · your info is safe" in h and "ended" not in h, h[-300:])
        check("...and it doesn't sync", synced(a)["cal"] == 0)
        a.close()

        print("\n[10. a backup FILE keeps this phone's own backup setting]")
        a = phone(b, base, "localStorage.removeItem('dayhub.pro')", links=False)
        a.js("""importData(new File([JSON.stringify({ app: APP_ID, savedAt: new Date().toISOString(), data: JSON.parse(JSON.stringify(S)) })], 'b.json'))""")
        a.page.wait_for_timeout(400)
        check("free phone loads a backup file: data back, backup NOT switched on, no paused line",
              a.js("S.events.some(e => e.title === 'Dentist') && !S.sync.on") and "paused" not in top(a) and "part of" not in top(a))
        a.close()

        print("\n[11. the boxes in Settings while paused]")
        a = phone(b, base, PRO_ENDED)
        a.js("GTOKEN_EXP = Date.now() - 1000; render()")
        sched = a.card("schedule")
        check("Schedule card: no 'Tap to sync Google Calendar' while paused", "Tap to sync Google Calendar" not in sched)
        a.page.click("#settingsBtn"); a.page.wait_for_timeout(200)
        sb, gb = a.page.inner_text("#syncBox"), a.page.inner_text("#gcalBox")
        check("Backup box: 'Paused — part of Day Hub Pro', no Back up now; Restore / Turn off / Delete still there",
              "Paused" in sb and "Back up now" not in sb and "Restore" in sb and "Turn off" in sb and "Delete my Drive backup" in sb, sb[:300])
        check("Calendar box: paused, events already on the phone calendar stay, Disconnect only",
              "Paused" in gb and "stay there" in gb and "Sync now" not in gb and "Disconnect" in gb, gb[:300])
        a.js("closeSettings()")
        a.close()
        a = phone(b, base, PRO_ENDED, path="/?src=play")
        a.js("backupNow()"); a.page.wait_for_timeout(200)
        t = a.js("document.getElementById('toast').textContent")
        check("Play app: 'Back up now' toast has no Pro wording", "Pro" not in t and "not turned on for this phone" in t, t)
        a.js("gcalConnect && gcalConnect()"); a.page.wait_for_timeout(200)
        t = a.js("document.getElementById('toast').textContent")
        check("Play app: Calendar connect toast has no Pro wording", "Pro" not in t, t)
        a.page.click("#settingsBtn"); a.page.wait_for_timeout(200)
        sb = a.page.inner_text("#syncBox")
        check("Play app: Backup box says 'not turned on for this phone', no Pro", "not turned on for this phone" in sb and "Pro" not in sb, sb[:200])
        a.close()

        print("\n[12. Cruise Hub shows the notice too]")
        a = T.App(b, base, path=T.CRUISE)
        a.js(FAKE_GOOGLE)
        a.js("localStorage.setItem('cruisehub.pro', JSON.stringify({ buyer: 'buyer@example.com', ok: false, checked: Date.now(), status: 'not found', product: 'cruisehub' }))")
        a.js(LINKS_ON)
        h = top(a)
        check("Cruise Hub home: 'paused (Cruise Hub Pass ended)'", "Calendar sync and backup paused (Cruise Hub Pass ended)" in h, h[-300:])
        a.js("localStorage.setItem('cruisehub.pro', JSON.stringify({ buyer: 'buyer@example.com', ok: true, checked: Date.now(), status: 'canceling', until: '2026-10-06T05:00:00Z', product: 'dayhub' }))")
        h = top(a)
        check("Cruise Hub on a Day Hub Pro unlock: the heads-up names Day Hub Pro, not the Cruise Hub Pass", "Day Hub Pro ends in 5 days" in h and "Cruise Hub Pass ends" not in h, h[-300:])
        a.close()

        print("\n[13. Auto Hub on a Day Hub Pro unlock: re-checks that buyer itself]")
        a = T.App(b, base, path=T.AUTOP)
        a.js(FAKE_GOOGLE)
        a.js("localStorage.removeItem('autohub.pro'); " + pro(days_ago=10) + "; " + LINKS_ON)
        check("Pro through Day Hub Pro", a.js("isPro() && proViaDayHub()"))
        n0 = len(getattr(a.ctx, "_relay", []))
        a.js("recheckPro()"); a.page.wait_for_timeout(600)
        sent = [x for x in getattr(a.ctx, "_relay", [])[n0:] if x.get("task") == "verify"]
        check("Day Hub record 10 days old: Auto Hub checks that buyer for itself", len(sent) == 1 and sent[0].get("buyer") == "buyer@example.com" and sent[0].get("app") == "autohub", sent)
        check("...and keeps its own fresh unlock (so it never ages out while Day Hub sits unopened)",
              a.js("JSON.parse(localStorage.getItem('autohub.pro') || '{}').ok === true && isPro()"))
        a.js("localStorage.removeItem('autohub.pro'); " + pro(ok=False, status="not found"))
        h = top(a)
        check("Day Hub Pro ended: Auto Hub names the plan they bought ('Day Hub Pro ended')", "(Day Hub Pro ended)" in h, h[-300:])
        a.js("localStorage.removeItem('autohub.pro'); " + pro(days_ago=22) + "; window.__verify = { valid: false, status: 'not found' }")
        a.page.clock.fast_forward(16 * 60000); a.js(CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(400)
        check("after Auto Hub's own check says no: still 'Day Hub Pro ended' (never 'Auto Hub Pro', which they didn't buy)",
              a.js("window.__calls.verify") == 1 and "(Day Hub Pro ended)" in top(a) and a.js("JSON.parse(localStorage.getItem('autohub.pro')).product") == "dayhub", top(a)[-300:])
        a.js("localStorage.setItem('autohub.pro', JSON.stringify({ buyer: 'mine@example.com', ok: true, checked: Date.now() - 22 * 86400000, status: 'active', product: 'autohub' })); "
             + pro(ok=False, status="not found") + "; window.__verify = { valid: false, status: 'not found' }")
        a.page.clock.fast_forward(16 * 60000); a.js(CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(400)
        check("Auto Hub's OWN unlock (another email) is the one re-checked, never swapped for the Day Hub email",
              (a.js("window.__lastVerify") or {}).get("buyer") == "mine@example.com" and a.js("JSON.parse(localStorage.getItem('autohub.pro')).buyer") == "mine@example.com",
              a.js("window.__lastVerify"))
        a.close()

        print("\n[14. Home Hub on a Day Hub Pro unlock (Scott 11/03 'Yes, fix it': the app says one Pro unlocks the family)]")
        a = T.App(b, base, path=T.HOMEP)
        a.js(FAKE_GOOGLE)
        a.js("localStorage.removeItem('homehub.pro'); localStorage.removeItem('dayhub.pro'); render()")
        check("no unlock on this phone: Home Hub stays free", not a.js("isPro() || proViaDayHub()"))
        a.js("openSettings()"); a.page.wait_for_timeout(200)
        check("...and still offers Day Hub Pro", "Get Day Hub Pro" in a.page.inner_text("#proBox"), a.page.inner_text("#proBox")[:200])
        a.js("localStorage.setItem('cruisehub.pro', JSON.stringify({ buyer: 'pass@example.com', ok: true, checked: Date.now(), status: 'active', product: 'cruisehub' }))")
        check("a Cruise Hub Pass never opens Home Hub", not a.js("isPro()"))
        a.js("localStorage.removeItem('cruisehub.pro'); " + PRO_OK)
        check("Day Hub Pro on this phone: Home Hub is Pro with nothing typed", a.js("isPro() && proViaDayHub()"))
        check("...Calendar, backup and AI all open", a.js("can('gcal') && can('sync') && can('ai') && proAi()"))
        a.js("aiCall('ask', 'hi').catch(() => 0).then(() => 1)")
        last = getattr(a.ctx, "_relay", [{}])[-1]
        check("...and a question really goes out on that buyer, with this phone's id", last.get("task") == "ask" and last.get("buyer") == "buyer@example.com" and last.get("device") == a.js("localStorage.getItem('dayhub.device')"), last)
        a.js("openSettings()"); a.page.wait_for_timeout(200)
        pb = a.page.inner_text("#proBox")
        check("Settings says it's included, with nothing to buy", "Included with your Day Hub Pro on this phone" in pb and "Get Day Hub Pro" not in pb, pb[:200])
        a.js("localStorage.removeItem('dayhub.pro'); " + LINKS_ON); c = synced(a)
        check("Calendar and backup connected, no Pro on this phone: both paused", c["cal"] == 0 and c["drive"] == 0, c)
        a.js(PRO_OK); c = synced(a)
        check("...Day Hub Pro on the phone: that paused Home Hub picks both up again", c["cal"] > 0 and c["drive"] > 0, c)
        a.js("localStorage.removeItem('homehub.pro'); " + pro(days_ago=10))
        a.page.clock.fast_forward(16 * 60000)
        n0 = len(getattr(a.ctx, "_relay", []))
        a.js("recheckPro()"); a.page.wait_for_timeout(600)
        sent = [x for x in getattr(a.ctx, "_relay", [])[n0:] if x.get("task") == "verify"]
        check("Day Hub record 10 days old: Home Hub checks that buyer for itself", len(sent) == 1 and sent[0].get("buyer") == "buyer@example.com" and sent[0].get("app") == "homehub", sent)
        day = a.ctx.new_page(); day.goto(base + "/", wait_until="load"); day.wait_for_function("typeof verifyPro === 'function'")
        day.evaluate("verifyPro('buyer@example.com')"); day.close()
        check("...Day Hub checks on the same phone too: the relay's list holds one phone, not two", len(getattr(a.ctx, "_devices", [])) == 1, getattr(a.ctx, "_devices", None))
        check("...and keeps its own fresh unlock", a.js("JSON.parse(localStorage.getItem('homehub.pro') || '{}').ok === true && isPro()"))
        a.js("localStorage.removeItem('homehub.pro'); " + pro(ok=False, status="not found"))
        h = top(a)
        check("Day Hub's record says it ended: Home Hub isn't Pro and names the plan", not a.js("isPro()") and "(Day Hub Pro ended)" in h, h[-300:])
        c = synced(a)
        check("...and sync pauses, as on every other Hub", c["cal"] == 0 and c["drive"] == 0, c)
        a.js("localStorage.setItem('homehub.pro', JSON.stringify({ buyer: 'mine@example.com', ok: true, checked: Date.now() - 22 * 86400000, status: 'active', product: 'dayhub' })); "
             + pro(ok=False, status="not found") + "; window.__verify = { valid: false, status: 'not found' }")
        a.page.clock.fast_forward(16 * 60000); a.js(CALLS0 + "; recheckPro()"); a.page.wait_for_timeout(400)
        check("Home Hub's OWN unlock (another email) is the one re-checked, never swapped for the Day Hub email",
              (a.js("window.__lastVerify") or {}).get("buyer") == "mine@example.com" and a.js("JSON.parse(localStorage.getItem('homehub.pro')).buyer") == "mine@example.com",
              a.js("window.__lastVerify"))
        a.close()

        for suffix, label in (("", "web"), ("?src=play", "Play")):
            a = T.App(b, base, path=T.HOMEP + suffix)
            a.js(PRO_OK)
            a.page.fill('form[data-homesetup] [name=name]', "Pat"); a.page.fill('form[data-homesetup] [name=city]', "83702")
            a.page.click('form[data-homesetup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
            if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
            n0 = len(getattr(a.ctx, "_relay", []))
            a.page.reload(wait_until="load"); a.page.wait_for_function("typeof render === 'function'")
            if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
            a.js("syncOnOpen(true)"); a.page.wait_for_timeout(400)
            spent = [x.get("task") for x in getattr(a.ctx, "_relay", [])[n0:] if x.get("task") not in ("verify", None)]
            check(f"{label} Home Hub on Day Hub Pro: reopening it sends nothing to the AI", spent == [], spent)
            if label == "Play":
                a.js("render(); openSettings()"); a.page.wait_for_timeout(200)
                bad = a.js(T.PLAY_SCAN)
                check("Play Home Hub on Day Hub Pro: no Pro wording outside the unlock box", bad == [], bad[:6])
                check("...and no price or Whop inside it", not any(w in a.page.inner_text("#proBox") for w in ("$", "Whop", "Get Day Hub")), a.page.inner_text("#proBox")[:200])
            a.close()

        for path, nm, key in ((T.CRUISE, "Cruise Hub", "cruisehub"), (T.TRIP, "Trip Hub", "triphub"), (T.HOMEP, "Home Hub", "homehub"), (T.AUTOP, "Auto Hub", "autohub"), (T.MONEYP, "Money Hub", "moneyhub"), (T.HEALTHP, "Health Hub", "healthhub")):
            a = T.App(b, base, path=path)
            a.js(f"localStorage.removeItem('{key}.pro'); " + PRO_OK)
            check(f"{nm}: a Day Hub Pro on this phone counts", a.js("isPro() && proViaDayHub()"))
            a.close()

        # v1.57's scan only ever looked at free phones. An unlocked phone on Play follows the same rule, on every Hub.
        for path, nm in (("/", "Day Hub"), (T.CRUISE, "Cruise Hub"), (T.TRIP, "Trip Hub"), (T.HOMEP, "Home Hub"), (T.AUTOP, "Auto Hub"), (T.MONEYP, "Money Hub"), (T.HEALTHP, "Health Hub")):
            a = T.App(b, base, path=path + "?src=play")
            a.js(PRO_OK + "; " + CREDITS); a.js("render(); openSettings()"); a.page.wait_for_timeout(200)
            bad = a.js(T.PLAY_SCAN)
            check(f"Play {nm}, unlocked phone with credits: no Pro wording outside the unlock box", bad == [], bad[:6])
            ai = a.page.inner_text("#aiBox")
            check(f"...its AI box still says it's on, and what comes first", "On for this phone" in ai and "Your daily questions come first" in ai, ai[:220])
            a.close()
        a = T.App(b, base); a.js(PRO_OK + "; " + CREDITS); a.js("render(); openSettings()"); a.page.wait_for_timeout(200)
        ai = a.page.inner_text("#aiBox")
        check("the web app still names the plan", "Included with Day Hub Pro" in ai and "Your Day Hub Pro questions each day come first" in ai, ai[:220])
        a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e and "Failed to fetch" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
