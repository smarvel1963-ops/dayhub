"""
SAVE AS: test_closed_app_reminders.py   LOCATION: C:/MarvelApps/dayhub/tests/test_closed_app_reminders.py

v1.60 (Scott 11/12: "build the closed-app reminders" -> "Yes, build it"). The Google Play app's wrapper (C:/MarvelApps/android/hub_alarms)
talks to the page over Chrome's "PostMessage for TWA": Chrome hands the page a port in a window message with EMPTY data, then the
wrapper says {"t":"hubalarms-hello","app":<package>,...} ON the port. The page answers with every reminder coming up and the wrapper
sets the phone's own alarm for each. This plays the wrapper's part with a real MessageChannel, the way Chrome delivers it:
  - a browser (no port) behaves exactly as before; a message from another site, or without a port, is ignored
  - the hello -> one list with the right reminder, time and words; nothing re-sent while nothing changed
  - a hello from ANOTHER Hub's app (the Hub links open other Hubs inside an app) gets no answer, so that app's alarms stay put
  - the wrapper's OK marks them handed; the page never rings a handed one again when the phone's alarm is on time, but rings it
    itself (and takes it off the phone's list) when the page is on screen and the phone's alarm may run late
  - a changed time sends a new list; an unconfirmed reminder still rings on the page; reminders off sends an empty list
  - Settings: "ring even when it's closed", the late-alarm note + "Ring on time" (asks the wrapper), notifications-off warning
  - coming back on screen asks the wrapper; no answer = the line is gone, and Settings stops promising
  - a backup restored on this phone keeps this phone's handed marks (another phone's must not silence anything)
  - every Play Hub (Day, Cruise, Trip, Home, Auto, Money) answers its own app's hello, with no page errors

RUN:   python tests/test_closed_app_reminders.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from test_update_ready import welcome
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

# The wrapper's side, as Chrome delivers it: the port in a window message with empty data, then the hello on the port.
# Everything the page sends lands in window.__got (parsed).
HELLO = """(o) => { const ch = new MessageChannel(); window.__ch = ch; window.__got = [];
  ch.port1.onmessage = e => window.__got.push(JSON.parse(e.data));
  window.dispatchEvent(new MessageEvent('message', { data: '', origin: o.origin || location.origin, ports: o.noport ? [] : [ch.port2] }));
  const me = 'com.marvelcorp.' + location.pathname.split('/').filter(Boolean)[0];
  if (!o.nohello) ch.port1.postMessage(JSON.stringify(Object.assign({ t: 'hubalarms-hello', v: 1, app: me, notif: true, exact: true }, o.extra || {})));
  return me; }"""
SAY = "o => window.__ch.port1.postMessage(JSON.stringify(o))"       # the wrapper says something more on the port
GOT = "window.__got || []"
LISTS = "(window.__got || []).filter(m => m.t === 'hubalarms')"
LAST = "(window.__got || []).filter(m => m.t === 'hubalarms').slice(-1)[0] || null"
BOX = "(document.getElementById('remindBox') || {}).innerText || ''"
PLAY = (("/", "Day Hub"), (T.CRUISE, "Cruise Hub"), (T.TRIP, "Trip Hub"), (T.HOMEP, "Home Hub"), (T.AUTOP, "Auto Hub"), (T.MONEYP, "Money Hub"))


def wait(a, ms=150): a.page.wait_for_timeout(ms)
def item(msg, title): return [i for i in (msg or {}).get("items", []) if i["t"] == title]


def t_day(b, base):
    print("\n[Day Hub: the page's side of the closed-app reminders]")
    a = T.App(b, base); T.setup(a)
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "14:30", "where": "Main St"})
    a.js("S.remind.on = true; S.remind.fired = {}; S.remind.lead = 15; save()")
    a.js("window.__n = []; window.notify = async (t, body) => window.__n.push(t)")

    check("a browser has no port: nothing to hand over", a.js("ALARM.port === null && !ALARM.live"))
    a.js("openSettings()")                       # the Reminders box lives in Settings
    a.js("drawRemindBox()")
    check("...and Settings keeps the old words (reminders arrive while it's open)", "while it's open" in a.js(BOX))

    a.js(HELLO, {"origin": "https://evil.example"}); wait(a)
    check("a port from another site is ignored", a.js("ALARM.port === null") and a.js(GOT) == [])
    a.js(HELLO, {"noport": True}); wait(a)
    check("a message without a port is ignored", a.js("ALARM.port === null"))
    a.js(HELLO, {"extra": {"app": "com.marvelcorp.moneyhub"}}); wait(a)
    check("a hello from another Hub's app gets no answer (its alarms stay put)", a.js(LISTS) == [] and not a.js("ALARM.live"), a.js(GOT))
    a.js(HELLO, {"nohello": True}); wait(a)
    check("Chrome's port alone (empty message, no hello yet) sends nothing", a.js("ALARM.port !== null") and a.js(GOT) == [] and not a.js("ALARM.live"))

    a.js(HELLO, {"origin": a.js("location.origin") + "/"}); wait(a)
    check("an origin written with a trailing slash still counts as the site", len(a.js(LISTS)) == 1 and a.js("ALARM.live"), a.js(GOT))
    a.js(HELLO, {}); wait(a)
    lists = a.js(LISTS)
    check("the wrapper's hello (on the port) gets one list back", len(lists) == 1 and lists[0]["n"] >= 1, a.js(GOT))
    den = item(lists[0] if lists else None, "📅 Dentist")
    want = a.js("atMs('2026-10-01', '14:15')")
    check("the Dentist reminder is in it, 15 min before", len(den) == 1 and den[0]["at"] == want and den[0]["k"].startswith("ev:"), den)
    check("...with the words the page would show (time, place, 'in 15 min')", bool(den) and den[0]["b"] == "2:30 PM · Main St · in 15 min", den)
    check("only reminders still to come", all(i["at"] > a.js("Date.now()") for i in (lists[0]["items"] if lists else [])))
    a.js("alarmSync()"); a.js("checkReminders()"); wait(a)
    check("nothing is sent again while nothing changed", len(a.js(LISTS)) == 1, len(a.js(LISTS)))

    a.js(SAY, {"t": "hubalarms-ok", "n": lists[0]["n"] if lists else 0, "count": 3}); wait(a)
    check("the wrapper's OK marks them handed", bool(den) and a.js("S.remind.handed[" + json.dumps(den[0]["k"]) + "]") == want, a.js("S.remind.handed"))
    a.js("drawRemindBox()")
    box = a.js(BOX)
    check("Settings now says they ring even when it's closed", "ring even when it's closed" in box and "while it's open" not in box, box[-300:])
    check("...and no late-alarm note while the phone's alarms are on time", "Ring on time" not in box)

    a.page.clock.run_for("06:20:00"); a.js("checkReminders()"); wait(a, 300)   # 8:00 -> 14:20, past the 14:15 alarm
    check("a handed reminder is marked done...", bool(den) and bool(a.js("S.remind.fired[" + json.dumps(den[0]["k"]) + "]")))
    check("...and the page does NOT ring it a second time (the phone's alarm did)", "📅 Dentist" not in a.js("window.__n"), a.js("window.__n"))

    a.qa("event", {"title": "Call Pat", "date": "2026-10-01", "time": "15:30"})
    a.js("checkReminders()"); wait(a)
    last = a.js(LAST)
    check("a new reminder sends a new list", len(item(last, "📅 Call Pat")) == 1, last)
    a.js("S.events.find(e => e.title === 'Call Pat').time = '15:00'; save()"); a.js("checkReminders()"); wait(a)
    pat = item(a.js(LAST), "📅 Call Pat")
    check("a changed time sends the new time", len(pat) == 1 and pat[0]["at"] == a.js("atMs('2026-10-01', '14:45')"), pat)
    a.page.clock.run_for("00:26:00"); a.js("checkReminders()"); wait(a, 300)   # 14:20 -> 14:46, never confirmed by the wrapper
    check("an unconfirmed reminder still rings on the page (nothing lost if the wrapper is quiet)", "📅 Call Pat" in a.js("window.__n"), a.js("window.__n"))

    # the phone's alarms may run late (no "Alarms & reminders"): with the page on screen it rings on time and takes it off the phone
    a.js(HELLO, {"extra": {"exact": False}}); wait(a)
    a.qa("event", {"title": "Pick up Sam", "date": "2026-10-01", "time": "15:20"})
    a.js("checkReminders()"); wait(a)
    sam = item(a.js(LAST), "📅 Pick up Sam")
    a.js(SAY, {"t": "hubalarms-ok", "n": a.js(LAST)["n"], "count": 1}); wait(a)
    check("late phone alarms: the new reminder is handed", len(sam) == 1 and a.js("S.remind.handed[" + json.dumps(sam[0]["k"]) + "]") == sam[0]["at"] if sam else False)
    a.js("drawRemindBox()")
    box = a.js(BOX)
    check("Settings says one may ring late and offers 'Ring on time' + where to find it", "up to an hour" in box and "Ring on time" in box and "Alarms & reminders" in box, box[-400:])
    a.js("document.querySelector('[data-alarmexact]').click()"); wait(a)   # (the Settings sheet was closed by the + sheet above)
    check("'Ring on time' asks the wrapper to open the phone's page", any(m.get("t") == "hubalarms-exact" for m in a.js(GOT)), a.js(GOT))
    a.page.clock.run_for("00:20:00"); a.js("checkReminders()"); wait(a, 300)   # 14:46 -> 15:06, past 15:05, page on screen
    check("...the page on screen rings it on time itself", "📅 Pick up Sam" in a.js("window.__n"), a.js("window.__n"))
    check("...and the next list takes it off the phone (no second ring later)", sam and not item(a.js(LAST), "📅 Pick up Sam"), a.js(LAST))

    a.js("S.remind.on = false; save()"); a.js("checkReminders()"); wait(a)
    check("reminders turned off: an empty list goes out (clears every alarm)", (a.js(LAST) or {}).get("items") == [], a.js(LAST))
    a.js("S.remind.on = true; save()")

    a.js(HELLO, {"extra": {"notif": False}}); wait(a)
    a.js("drawRemindBox()")
    check("notifications off on the phone: Settings says so", "Notifications are off" in a.js(BOX))
    check("a new port + hello (the page reloaded) gets a fresh list", len(a.js(LISTS)) == 1 and a.js("ALARM.live"), a.js(GOT))

    # back on screen: the page asks; no answer within 8 s = the line is gone
    a.js("document.dispatchEvent(new Event('visibilitychange'))"); wait(a)
    check("coming back on screen asks the wrapper how things stand", any(m.get("t") == "hubalarms-ask" for m in a.js(GOT)), a.js(GOT))
    a.js(SAY, {"t": "hubalarms-hello", "v": 1, "app": a.js("ALARM_APP"), "notif": True, "exact": True}); wait(a)
    a.page.clock.run_for("00:00:10"); wait(a)
    check("...an answer keeps the line up (and refreshes what the phone allows)", a.js("ALARM.live && ALARM.info.exact === true"))
    a.js("document.dispatchEvent(new Event('visibilitychange'))"); wait(a)
    a.page.clock.run_for("00:00:10"); wait(a); a.js("drawRemindBox()")
    check("...no answer: the line is gone and Settings stops promising", not a.js("ALARM.live") and "while it's open" in a.js(BOX), a.js(BOX)[-200:])

    a.js("S.remind.handed = {'ev:keep:2026-10-01': 123}; saveLocal()")
    a.js("restoreFrom({savedAt: new Date().toISOString(), data: {name: 'Old', remind: {on: true, handed: {'ev:other:2026-10-01': 456}}}})")
    check("a restored backup keeps this phone's handed marks, not the backup's", a.js("JSON.stringify(S.remind.handed)") == json.dumps({"ev:keep:2026-10-01": 123}, separators=(",", ":")), a.js("S.remind.handed"))
    a.close()


def t_play_hubs(b, base):
    print("\n[every Play Hub answers its own app's wrapper]")
    for path, label in PLAY:
        T.ERRORS.clear()
        a = T.App(b, base, path=path)            # the look doesn't matter here; the welcome helper fills the classic forms
        check(f"{label}: past the welcome", welcome(a))
        a.js("S.remind.on = true; save()")
        me = a.js(HELLO, {}); wait(a, 250)
        last = a.js(LAST)
        check(f"{label}: its own app ({me}) gets a list back", bool(last) and isinstance(last["items"], list), a.js(GOT))
        check(f"{label}: no page errors", not T.ERRORS, T.ERRORS[:3])
        a.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for t in (t_day, t_play_hubs):
            try: t(b, base)
            except Exception as e: check(f"{t.__name__} crashed", False, repr(e)[:300])
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
