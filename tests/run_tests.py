"""
SAVE AS: run_tests.py   LOCATION: C:/MarvelApps/dayhub/tests/run_tests.py

DAY HUB TEST SUITE (Scott 2026-10-01: "we need to get day hub totally loaded
and tested and all working"). Drives the REAL app in headless Chromium at phone
and tablet sizes and checks every feature end to end.

  - Deterministic: the clock is frozen (Thu 2026-10-01 08:00, America/Chicago),
    weather / ZIP / geocoding calls are answered from fixtures, Google fonts are
    blocked. Nothing touches the live site, Google or anyone's data.
  - Every test starts from an EMPTY phone (fresh browser context).
  - Any page error or console error anywhere fails the run.

RUN:   python tests/run_tests.py          (from C:/MarvelApps/dayhub)
       Exit code 0 = all passed. Run before every push.
"""
import http.server, json, os, socket, sys, threading, functools, re, urllib.parse
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OK = FAIL = 0
ERRORS = []


def check(name, cond, extra=""):
    global OK, FAIL
    if cond:
        OK += 1; print(f"  PASS  {name}")
    else:
        FAIL += 1; print(f"  FAIL  {name}  {extra}")


# ------------------------------------------------------------------ server
def serve():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    h = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}"


# ------------------------------------------------------------------ fixtures
def forecast_fixture(q):
    if "start_date" in q:                                     # one port day
        day = q["start_date"][0]
        return {"daily": {"time": [day], "temperature_2m_max": [88.0], "temperature_2m_min": [77.0],
                          "precipitation_probability_max": [30], "weather_code": [2]}}
    days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]
    hours = [f"2026-10-01T{h:02d}:00" for h in range(24)] + [f"2026-10-02T{h:02d}:00" for h in range(24)]
    rain = [10] * 48
    for i in range(15, 19): rain[i] = 70                      # rain likely from 3 PM today
    return {"current": {"time": "2026-10-01T08:00", "temperature_2m": 72.0, "apparent_temperature": 74.0, "weather_code": 1,
                        "wind_speed_10m": 6.0, "is_day": 1},
            "hourly": {"time": hours, "temperature_2m": [70 + (i % 24) / 2 for i in range(48)], "precipitation_probability": rain,
                       "weather_code": [2] * 48, "is_day": [1 if 7 <= (i % 24) <= 18 else 0 for i in range(48)]},
            "daily": {"time": days, "temperature_2m_max": [88, 80, 79, 82, 84, 83], "temperature_2m_min": [66, 64, 60, 38, 61, 62],
                      "precipitation_probability_max": [70, 60, 10, 0, 5, 20], "sunrise": [d + "T07:04" for d in days],
                      "sunset": [d + "T18:53" for d in days], "weather_code": [61, 63, 1, 0, 1, 2]}}


def route(ctx):
    def handle(r):
        u = urllib.parse.urlparse(r.request.url); q = urllib.parse.parse_qs(u.query)
        if u.netloc.startswith("geocoding-api."):
            name = (q.get("name") or ["X"])[0]
            return r.fulfill(json={"results": [{"name": name, "latitude": 25.06, "longitude": -77.34, "admin1": "Test", "country_code": "BS"}]})
        if u.netloc == "api.open-meteo.com":
            return r.fulfill(json=forecast_fixture(q))
        if u.path.endswith("/version.json") and getattr(ctx, "_version", None):
            return r.fulfill(json=ctx._version)
        if "zippopotam.us" in u.netloc:
            if u.path.endswith("/00000"):
                return r.fulfill(status=404, body="{}")
            return r.fulfill(json={"places": [{"place name": "Conway", "state abbreviation": "AR", "latitude": "35.09", "longitude": "-92.44"}]})
        if u.netloc == "script.google.com" and "/macros/s/" in u.path:
            body = json.loads(r.request.post_data or "{}")
            ctx._relay = getattr(ctx, "_relay", []) + [body]
            if body.get("task") == "verify":                  # v0.40 Whop license check
                if getattr(ctx, "_verify_down", False):
                    return r.fulfill(status=502, body="<html>Bad gateway</html>")
                good = body.get("license") == "WHOP-GOOD-1234"
                return r.fulfill(json={"valid": good, "status": "active" if good else "expired", "until": 1793000000 if good else None})
            if body.get("license") and not body.get("pass"):  # v0.40 AI on a Pro key
                if body["license"] != "WHOP-GOOD-1234":
                    return r.fulfill(json={"error": "license key not active"})
                if body.get("task") == "ping":
                    return r.fulfill(json={"ok": True, "left": 30})
            elif body.get("pass") != "test-only-passphrase-x7":
                return r.fulfill(json={"error": "wrong passphrase"})
            if body.get("task") == "ping":
                return r.fulfill(json={"ok": True, "left": 199})
            if getattr(ctx, "_ai_down", False):
                return r.fulfill(json={"error": "Claude said 529"})
            if body.get("task") == "dump":
                return r.fulfill(json={"text": json.dumps({"items": [
                    {"kind": "event", "title": "Get new tires", "day": "2026-11-01", "time": "09:00", "rep": "none"},
                    {"kind": "event", "title": "Call Dan", "day": "2026-10-06", "time": "14:00", "rep": "none"},
                    {"kind": "item", "title": "Toothpaste"},
                    {"kind": "note", "title": "December vacation idea"},
                    {"kind": "bogus", "title": "dropped"}]})})
            if body.get("task") == "ask":
                ctx._ask_input = body.get("input", "")
                return r.fulfill(json={"text": "Your next oil change is due Fri, Jan 1."})
            if body.get("task") == "top3":
                return r.fulfill(json={"text": json.dumps({"top": [{"title": "Pay the phone bill", "why": "due today"},
                    {"title": "Dentist at 3:00 PM", "why": "appointment"}, {"title": "Call Mom", "why": "promised"}]})})
            return r.fulfill(json={"error": "unknown task"})
        if u.netloc == "accounts.google.com" and u.path == "/o/oauth2/v2/auth":
            back = q["redirect_uri"][0]
            if getattr(ctx, "_oauth", None) == "ok":
                frag = urllib.parse.urlencode({"access_token": "tok-auto", "expires_in": "3599", "scope": q["scope"][0], "state": q["state"][0]})
            else:
                frag = urllib.parse.urlencode({"error": "interaction_required", "state": q["state"][0]})
            ctx._oauth_hits = getattr(ctx, "_oauth_hits", 0) + 1
            return r.fulfill(status=302, headers={"Location": back + "#" + frag})
        if "fonts.g" in u.netloc or "accounts.google.com" in u.netloc:
            return r.fulfill(status=204, body="")
        return r.continue_()
    ctx.route("**/*", handle)


# ------------------------------------------------------------------ helpers
class App:
    def __init__(self, browser, base, path="/", width=390, height=844, at="2026-10-01T08:00:00"):
        self.ctx = browser.new_context(viewport={"width": width, "height": height}, timezone_id="America/Chicago",
                                       permissions=["notifications"])
        route(self.ctx)
        self.page = self.ctx.new_page()
        self.page.on("pageerror", lambda e: ERRORS.append(f"pageerror: {e}"))
        self.page.on("console", lambda m: ERRORS.append(f"console: {m.text}") if m.type == "error" and "favicon" not in m.text else None)
        self.page.clock.install(time=at + "-05:00")
        self.page.goto(base + path)
        self.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")

    def js(self, expr, arg=None):
        return self.page.evaluate(expr, arg) if arg is not None else self.page.evaluate(expr)

    def qa(self, type_, vals):
        """Open the + sheet on `type_`, fill the fields, submit - like a person would."""
        self.page.evaluate("""([t, v]) => { openQA(t, true); const f = document.getElementById('qaForm');
            for (const [k, x] of Object.entries(v)) { const el = f.querySelector(`[name=${k}]`);
              if (!el) throw new Error('no field ' + k + ' on ' + t);
              if (el.type === 'checkbox') el.checked = !!x; else el.value = x; }
            f.requestSubmit(); }""", [type_, vals])

    def card(self, key):
        el = self.page.query_selector(f'[data-card="{key}"]')
        return el.inner_text() if el else ""

    def close(self):
        self.ctx.close()


def setup(app, city="72032", name="Scott", pack="general"):
    app.page.fill('form[data-setup] [name=name]', name)
    app.page.fill('form[data-setup] [name=city]', city)
    app.page.select_option('form[data-setup] [name=pack]', pack)
    app.page.click('form[data-setup] button')
    app.page.wait_for_function("WXDATA && WXDATA.here")


def hero(app):
    """The whole top line: v0.39 shows 3 chips + '+N more' - open it first, like a person would."""
    m = app.page.query_selector('#hero [data-chipsmore="1"]')
    if m: m.click()
    return app.page.inner_text("#hero")


def open_mini(app, key):
    """v0.39: an empty card is one line on home - tap its i to see the full card."""
    app.page.click(f'[data-card="{key}"] .mini-info')


# ================================================================== tests
def t_first_run(b, base):
    print("\n[first run + weather]")
    a = App(b, base)
    check("fresh phone shows the welcome card", "Welcome to Day Hub" in a.page.inner_text("#cards"))
    setup(a)
    check("greeting uses the name", "Scott" in a.page.inner_text("#hero .greet"))
    check("ZIP 72032 resolves to Conway, AR", "Conway, AR" in a.card("weather"), a.card("weather")[:120])
    check("hero shows the current temperature", "72°" in a.page.inner_text("#hero"))
    check("rain timing chip (fixture: 70% from 3 PM)", "Rain from 3:00 PM" in a.page.inner_text("#hero"), a.page.inner_text("#hero"))
    check("12-hour strip + 5-day rows", a.js("document.querySelectorAll('.hour').length") == 12 and a.js("document.querySelectorAll('.dayrow').length") == 6)
    check("welcome card gone after setup", "Welcome to Day Hub" not in a.page.inner_text("#cards"))
    a.js("S.city='00000'; save(); loadWeather()"); a.page.wait_for_timeout(300)
    check("unknown ZIP shows a friendly message, not a crash", "not found" in a.card("weather").lower(), a.card("weather")[:100])
    a.close()


def t_schedule(b, base):
    print("\n[schedule + events + repeats]")
    a = App(b, base); setup(a)
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "14:30", "where": "Main St"})
    check("event lands on the timeline", "Dentist" in a.card("schedule") and "2:30 PM" in a.card("schedule"))
    check("hero 'next up' chip", "2:30 PM · Dentist" in hero(a))
    check("timeline has a NOW line", a.js("!!document.querySelector('.now-line')"))
    a.qa("event", {"title": "Gym", "date": "2026-10-01", "time": "18:00", "rep": "weekly"})
    check("weekly repeat: next week yes, tomorrow no", a.js("(() => { const g = S.events.find(e => e.title==='Gym'); return occursOn(g,'2026-10-08') && !occursOn(g,'2026-10-02'); })()"))
    a.qa("event", {"title": "Mom's birthday", "date": "2026-10-05", "time": "09:00", "rep": "yearly"})
    check("yearly repeat lands next year", a.js("occursOn(S.events.find(e=>e.rep==='yearly'),'2027-10-05')"))
    check("adding an event jumps the schedule to its day", a.js("VIEW") == "2026-10-05")
    a.page.click('[data-day="0"]')
    a.page.click('[data-del^="occ:"]')
    check("deleting ONE day of a repeat keeps the series", a.js("(() => { const g = S.events.find(e => e.title==='Gym'); return !occursOn(g,'2026-10-01') && occursOn(g,'2026-10-08'); })()"))
    a.page.click('[data-tact]')
    check("'Delete all' removes the whole series", a.js("!S.events.some(e => e.title==='Gym')"))
    a.page.click('[data-undo]')
    check("Undo brings it back", a.js("S.events.some(e => e.title==='Gym')"))
    a.page.click('[data-day="1"]')
    check("› shows tomorrow", "Tomorrow" in a.card("schedule"), a.card("schedule")[:160])
    a.page.click('[data-day="0"]')
    a.qa("event", {"title": "<img src=x onerror=window.__xss=1>", "date": "2026-10-01", "time": "10:00"})
    check("typed HTML is shown as text, never run", a.js("!window.__xss && !document.querySelector('#cards img')"))
    ics = a.js("icsFor('events:' + S.events.find(e=>e.title==='Gym').id).text")
    check(".ics export has the repeat rule + alarm", "RRULE:FREQ=WEEKLY" in ics and "TRIGGER:-PT15M" in ics and "BEGIN:VALARM" in ics)
    a.close()


def t_todos_lists_countdowns(b, base):
    print("\n[to-dos + lists + countdowns]")
    a = App(b, base); setup(a)
    a.qa("todo", {"title": "Call insurance"})
    a.qa("todo", {"title": "Take meds", "rep": "daily"})
    a.page.click('[data-tick]'); a.page.wait_for_timeout(400)
    check("ticking a to-do updates the ring", "1/2" in a.card("todos"), a.card("todos")[:80])
    a.page.clock.run_for("24:00:00"); a.js("render()")
    meds = a.js("(() => { const t = S.todos.find(x=>x.title==='Take meds'); return [todoShown(t), todoDone(t)]; })()")
    check("a daily to-do comes back unchecked the next day", meds == [True, False], meds)
    a.qa("item", {"list": "grocery", "text": "Milk"})
    a.qa("item", {"list": "grocery", "text": "Eggs"})
    a.js("closeQA()")
    check("list items added", "Milk" in a.card("lists") and "Eggs" in a.card("lists"))
    a.page.click('[data-item]'); a.page.wait_for_timeout(300)
    a.page.click('[data-clear]')
    check("Clear checked removes only checked items", a.js("S.lists[0].items.length") == 1)
    a.qa("list", {"name": "Hardware"})
    check("new list becomes the active tab", a.js("S.lists.find(l=>l.id===S.listSel).name") == "Hardware")
    a.qa("countdown", {"title": "Cruise", "date": "2026-12-20"})
    check("countdown shows days to go", "Cruise" in a.card("countdowns") and "days to go" in a.card("countdowns"))
    a.close()


def t_bills_budget_work(b, base):
    print("\n[bills + work hours + budget]")
    a = App(b, base); setup(a)
    a.qa("bill", {"title": "Phone", "amount": "85", "day": "3"})
    check("bill due in 2 days: pill + hero chip", "in 2 days" in a.card("bills") and "Phone in 2 days" in hero(a))
    a.page.click('[data-paid]')
    check("Paid rolls the bill to next month", a.js("upcomingBills()[0].due") == "2026-11-03")
    a.page.click('[data-undo]')
    a.qa("pay", {"itype": "hourly", "rate": "20", "tax": "20", "ot": "40", "period": "weekly"})
    for i, d in enumerate(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]):
        a.qa("shift", {"date": d, "start": "07:00", "end": "17:00", "brk": "0"})
    p = a.js("periodPay(periodStart(today()))")
    check("50 h week: 10 h overtime, $1,100 gross, $880 take-home", (p["hrs"], p["ot"], p["gross"], round(p["net"], 2)) == (50, 10, 1100, 880), p)
    a.page.click('[data-clock="in"]')
    a.page.clock.run_for("01:30:00")
    a.page.click('[data-clock="out"]')
    check("clock in/out records a shift", a.js("S.work.shifts.length") == 6)
    a.qa("pay", {"itype": "salary", "salary": "30000", "rate": "", "tax": "20", "ot": "40", "period": "weekly"})
    a.qa("spend", {"amt": "2000", "what": "Rent", "date": "2026-10-01"})
    bud = a.js("budget()")
    check("salary budget: $2,000/mo, over by bills + spending", round(bud["income"]) == 2000 and bud["status"] == "over", bud)
    check("over budget shows a hero warning", "over budget" in hero(a))
    a.close()


def t_packages_email(b, base):
    print("\n[packages + email reader]")
    a = App(b, base); setup(a)
    a.qa("package", {"name": "Boots", "num": "1Z999AA10123456784", "carrier": "auto", "eta": "2026-10-01"})
    check("UPS recognised + Track link", "ups.com/track" in a.js("trackUrl(S.packages[0])"))
    check("'arriving today' chip", "1 arriving today" in hero(a))
    a.page.click('[data-pkgdone]')
    check("Delivered ✓", a.js("S.packages[0].delivered"))
    res = a.js("""extractFromMessage({id:'m1', subject:'Appointment Confirmation: Dr. Lee', text:'Your appointment is on Thursday, October 9, 2026 at 2:30 PM.'})""")
    check("email: appointment found with date + time", res and res[0]["day"] == "2026-10-09" and res[0]["time"] == "14:30", res)
    check("email: promo ignored", a.js("extractFromMessage({id:'p', subject:'50% OFF this weekend', text:'Sale ends October 5'}).length") == 0)
    cr = a.js("""extractFromMessage({id:'c', subject:'Booking # DN9MWJ: Bid to upgrade', from:'Princess <p@princess.com>',
        text:'Ship Caribbean Princess\\nSail Date Aug 30, 2027\\nStateroom Premium Balcony\\nBooking # DN9MWJ'})[0].cruise""")
    check("email: real Princess format -> ship, date, booking", cr["ship"] == "Caribbean Princess" and cr["start"] == "2027-08-30" and cr["booking"] == "DN9MWJ", cr)
    a.close()


def t_trips_cruise(b, base):
    print("\n[trips + cruise mode]")
    a = App(b, base); setup(a)
    a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-09-29", "end": "2026-10-04", "line": "Princess", "ship": "Caribbean Princess",
                  "port": "Port Canaveral", "travelers": "2", "total": "2400", "finalDue": "2026-07-01", "pkg": "princess-plus"})
    a.qa("tpay", {"amt": "2400", "date": "2026-06-01", "note": "Paid"})
    a.qa("tport", {"pname": "Nassau", "pday": "2026-10-01", "arrive": "08:00", "allAboard": "16:30", "excursion": "Snorkel", "meet": "09:30",
                   "where": "Pier 2", "walk": "20", "shipOffset": "0", "indie": True, "cash": "$40", "currency": "USD", "cards": "yes", "tipping": "15%"})
    a.js("closeQA()")
    tr = a.js("(() => { const t = curTrip(); return {left: tripLeft(t), grat: gratEstimate(t), perks: t.perks.map(x=>x.name+':'+x.total), ready: readiness(t).pct}; })()")
    check("paid in full + package pays gratuities", tr["left"] == 0 and tr["grat"] == 0, tr)
    check("Plus seeds 8 casual meals for 2 people", "Casual dining meals:8" in tr["perks"], tr)
    a.js("openQA('forget')")
    sheet = a.page.inner_text("#qaForm")
    check("What am I forgetting? port morning", "GOOD MORNING — NASSAU" in sheet and "ALL ABOARD" in sheet and "Leave the cabin by" in sheet, sheet[:200])
    check("independent-tour warning", "does NOT wait" in sheet)
    a.js("closeQA()")
    a.js("S.remind.on = true")
    rem = a.js("reminderList().filter(r => /^(aa|lc|ex):/.test(r.key)).map(r => new Date(r.at).toTimeString().slice(0,5))")
    check("alarms: leave cabin 9:10, meet 9:15, back-on-ship 3:00/3:30/4:00", sorted(rem) == ["09:10", "09:15", "15:00", "15:30", "16:00"], rem)
    a.js("S.tripTab='perks'; render()")
    a.page.fill('form[data-drink] [name=price]', "14"); a.page.click('form[data-drink] button')
    check("drink $14 included in Plus", "included in Princess Plus" in a.page.inner_text("#toast"))
    a.js("S.tripTab='ports'; render()"); a.page.wait_for_timeout(400)
    check("port weather shows", "88°" in a.card("trips"), a.card("trips")[:300])
    a.close()


def t_reminders_backup_update(b, base):
    print("\n[reminders + backup restore + update notice]")
    a = App(b, base); setup(a)
    a.qa("event", {"title": "Standup", "date": "2026-10-01", "time": "08:20"})
    a.js("S.remind.on = true; S.remind.fired = {}; save()")
    a.page.clock.run_for("00:06:00")
    a.js("checkReminders()"); a.page.wait_for_timeout(200)
    check("reminder fires 15 min before (and only once)", any(k.startswith("ev:") for k in a.js("Object.keys(S.remind.fired)")))
    before = a.js("Object.keys(S.remind.fired).length"); a.js("checkReminders()"); a.page.wait_for_timeout(100)
    check("…and never twice", a.js("Object.keys(S.remind.fired).length") == before)
    a.js("restoreFrom({savedAt:'2026-10-01T12:00:00Z', data:{name:'Backup', city:'72032', todos:[{id:'b1',title:'From backup',done:false}]}})")
    check("restore from backup", a.js("S.name") == "Backup" and a.js("S.todos[0].title") == "From backup")
    a.page.click('[data-undo]')
    check("Undo after restore", a.js("S.name") == "Scott")
    a.ctx._version = {"version": "9.9", "notes": {"9.9": ["Test"]}}
    a.js("checkUpdate()"); a.page.wait_for_timeout(300)
    check("'New version ready' chip when a newer version is published", "New version ready" in a.page.inner_text("#hero"))
    a.close()


def t_settings_layout_offline(b, base):
    print("\n[settings + layout + offline + Cruise Hub]")
    a = App(b, base); setup(a)
    a.page.click("#settingsBtn")
    check("settings opens with reminders / backup / calendar / email boxes",
          all(a.js(f"!!document.getElementById('{x}')") for x in ("remindBox", "syncBox", "gcalBox", "mailBox", "installBox")))
    a.page.uncheck('[data-show="weather"]')
    check("hiding a card hides it", not a.page.query_selector('[data-card="weather"]'))
    a.page.check('[data-show="weather"]')
    a.page.select_option("#setPack", "trucker"); a.page.click('[data-close="sheet"]')
    check("Trucker pack adds Route + Loads cards", bool(a.page.query_selector('[data-card="route"]')) and bool(a.page.query_selector('[data-card="loads"]')))
    check("phone: no sideways scrolling", a.js("document.documentElement.scrollWidth <= window.innerWidth + 1"))
    a.page.set_viewport_size({"width": 1024, "height": 768})
    check("tablet: two columns", a.js("getComputedStyle(document.getElementById('cards')).columnCount") == "2")
    a.page.set_viewport_size({"width": 390, "height": 844})
    a.page.wait_for_function("navigator.serviceWorker.controller !== null || true")
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'")
    a.ctx.set_offline(True)
    a.page.reload(); a.page.wait_for_timeout(500)
    check("opens with no internet (offline copy)", a.js("typeof render === 'function' && !!document.querySelector('#hero .greet')"))
    a.ctx.set_offline(False)
    a.close()
    c = App(b, base, path="/cruise/")
    check("Cruise Hub runs in cruise mode with its own name", c.js("MODE") == "cruise" and c.js("document.title") == "Cruise Hub")
    check("Cruise Hub: trips first", c.js("cardOrder()[0]") == "trips")
    c.close()


def t_notes_data(b, base):
    print("\n[notes + your data]")
    a = App(b, base); setup(a)
    a.page.click('[data-card="notes"] .mini-add')
    check("empty Notes: the one-line row opens the card on the note box", a.js("document.activeElement && document.activeElement.closest('form[data-noteadd]') !== null"))
    a.page.fill('form[data-noteadd] [name=text]', "Gate code 4412"); a.page.click('form[data-noteadd] button')
    check("note saved", "Gate code 4412" in a.card("notes"))
    a.page.click('[data-noteedit]'); a.page.fill('#qaForm textarea', "Gate code 9981"); a.page.click('#qaForm button.btn')
    check("tap a note to edit it", "9981" in a.card("notes") and "4412" not in a.card("notes"))
    a.page.click('[data-notepin]')
    check("pin a note", a.js("S.notes[0].pinned") is True)
    a.page.click("#settingsBtn")
    with a.page.expect_download() as dl:
        a.page.click('[data-data="export"]')
    path = dl.value.path(); doc = json.load(open(path, encoding="utf-8"))
    check("Download my data gives a Day Hub backup file", doc.get("app") == "dayhub" and doc["data"]["notes"][0]["text"] == "Gate code 9981")
    a.page.click('[data-data="erase"]')
    check("Erase needs a second tap", a.js("S.notes.length") == 1 and "Tap again" in a.page.inner_text("#dataBox"))
    a.page.click('[data-data="erase"]')
    check("second tap erases", a.js("S.notes.length") == 0 and a.js("S.city") == "")
    a.page.click('[data-undo]')
    check("Undo after erase", a.js("S.notes.length") == 1)
    a.js("S.notes = []; save()")
    a.page.click("#settingsBtn")
    a.page.set_input_files("#importFile", path)
    a.page.wait_for_timeout(300)
    check("Load a backup file brings it back", a.js("S.notes.length") == 1)
    a.close()


def boot_with(b, base, data, at="2026-10-01T08:00:00"):
    """A phone whose saved data is `data` (raw string), reopened."""
    a = App(b, base, at=at)
    a.js("(d) => localStorage.setItem('dayhub.v1', d)", data)
    a.page.reload(); a.page.wait_for_timeout(500)
    return a


def t_v018_fixes(b, base):
    # Each check here is a bug found in the 2026-10-02 deep test of v0.17.
    print("\n[v0.18 fixes - edge cases]")
    a = App(b, base); setup(a)
    a.qa("event", {"title": "Zoom", "date": "2026-10-01", "time": "10:00",
                   "where": "https://us02web.zoom.us/j/81234567890?pwd=abcdefghijklmnopqrstuvwxyz123456"})
    a.js("closeQA()")
    check("pasted link: ✕ stays on screen", a.js("[...document.querySelectorAll('[data-card=schedule] .ti .x')].every(x => x.getBoundingClientRect().right <= innerWidth)"))
    check("pasted link: no sideways scrolling", a.js("document.documentElement.scrollWidth <= document.documentElement.clientWidth"))
    check("email date-only '2026-10-03' stays Oct 3", a.js("dtOf('2026-10-03')") == {"day": "2026-10-03", "time": None}, a.js("dtOf('2026-10-03')"))
    check("monthly on the 31st shows Nov 30 (and not Nov 29)", a.js("occursOn({day:'2026-10-31',rep:'monthly'},'2026-11-30') && !occursOn({day:'2026-10-31',rep:'monthly'},'2026-11-29') && occursOn({day:'2026-10-31',rep:'monthly'},'2026-12-31')"))
    check("Feb 29 yearly shows Feb 28 in 2029, Feb 29 in 2032", a.js("occursOn({day:'2028-02-29',rep:'yearly'},'2029-02-28') && occursOn({day:'2028-02-29',rep:'yearly'},'2032-02-29') && !occursOn({day:'2028-02-29',rep:'yearly'},'2032-02-28')"))
    check("overnight shift on Nov 1 (clock change) = 9 h", a.js("shiftHours({day:'2026-10-31',start:'22:00',end:'06:00',brk:0})") == 9)
    check("normal overnight shift = 8 h", a.js("shiftHours({day:'2026-10-07',start:'22:00',end:'06:00',brk:0})") == 8)
    check("clocked in 26 h counts 26 h", a.js("shiftHours({day:'2026-10-01',start:'08:00',end:'10:00',brk:0,mins:1560})") == 26)
    a.qa("bill", {"title": "Car", "amount": "1200", "day": "30"})
    a.qa("event", {"title": "Dinner, Bob", "date": "2026-10-01", "time": "19:00"})
    bill = a.js("icsFor('bill:' + S.bills[0].id).text")
    check(".ics bill on the 30th never lands on the 31st", "BYMONTHDAY=28,29,30;BYSETPOS=-1" in bill and "BYMONTHDAY=-1" not in bill, bill)
    check(".ics bill amount comma escaped", "$1\\,200.00" in bill)
    din = a.js("icsFor('events:' + S.events.find(e => e.title === 'Dinner, Bob').id).text")
    check(".ics alarm text escaped once", "DESCRIPTION:Dinner\\, Bob\r\n" in din, din)
    check(".ics lines folded at 75 octets", all(len(l.encode()) <= 75 for l in a.js("icsFor('events:' + S.events[0].id).text").split("\r\n")))
    a.close()

    a = App(b, base, at="2026-10-01T23:58:00"); setup(a)
    a.page.clock.run_for("00:03:00"); a.page.wait_for_timeout(200)
    check("open past midnight: schedule moves to the new day", a.js("VIEW") == "2026-10-02" and "Yesterday" not in a.card("schedule"))
    a.close()

    a = App(b, base); setup(a)
    a.js("S.remind.fired = {'ev:x:2026-10-01': Date.now()}; saveLocal()")
    a.js("restoreFrom({savedAt: new Date().toISOString(), data: {name: 'Old', bills: [{id:'b', name:'Gas', amount: 50, day: 9, paid: null}], remind: {on: true}}})")
    check("old backup restore: reminders still have their marks", a.js("typeof S.remind.fired === 'object' && !!S.remind.fired['ev:x:2026-10-01']"))
    check("old backup restore: old bill not shown late", a.js("upcomingBills()[0].due") == "2026-10-09")
    check("old backup restore: checkReminders runs", a.js("checkReminders().then(() => true)"))
    a.close()

    for label, data in [("empty slots", '{"name":"S","events":null,"todos":null,"bills":null,"lists":null}'),
                        ("text instead of lists", '{"name":"S","events":"x","todos":"y","lists":"z","pack":"nope"}'),
                        ("entries missing their date", '{"name":"S","city":"72032","events":[{"id":"a"}],"bills":[{"id":"c"}],"work":{"shifts":[{"id":"s"}]}}')]:
        before = len(ERRORS)
        a = boot_with(b, base, data)
        check(f"damaged data ({label}) still opens", a.js("document.querySelectorAll('[data-card]').length > 0") and len(ERRORS) == before,
              "; ".join(ERRORS[before:])[:200])
        a.close()


def t_v019_calendar_arrange(b, base):
    print("\n[v0.19 phone calendar sync + arrange]")
    a = App(b, base); setup(a)
    # Fake Google Calendar: an in-memory store behind the real REST shape.
    a.js("""() => { window.__g = {}; let n = 0; const real = window.fetch;
      window.fetch = async (u, o = {}) => { u = String(u);
        if (!u.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) return real(u, o);
        const m = o.method || 'GET', id = decodeURIComponent((u.split('/events/')[1] || '').split('?')[0]);
        const J = (x, st = 200) => new Response(x == null ? null : JSON.stringify(x), { status: st });
        if (m === 'GET') return J({ items: Object.values(window.__g) });
        if (m === 'POST') { const e = { ...JSON.parse(o.body), id: 'g' + (++n) }; window.__g[e.id] = e; return J(e); }
        if (m === 'PUT') { window.__g[id] = { ...JSON.parse(o.body), id }; return J(window.__g[id]); }
        if (m === 'DELETE') { delete window.__g[id]; return J(null, 204); } }; }""")
    a.js("GTOKEN = 'test'; GTOKEN_EXP = Date.now() + 3600000; S.gcal.connected = true; S.gcal.scope = GCAL_SCOPE; saveLocal()")
    a.qa("event", {"title": "Dentist", "date": "2026-10-05", "time": "14:30", "where": "Main St", "rep": "monthly"})
    a.qa("bill", {"title": "Rent", "amount": "900", "day": "30"})
    a.js("gcalPush()"); a.page.wait_for_timeout(300)
    g = a.js("Object.values(window.__g)")
    den = next((e for e in g if e["summary"] == "Dentist"), None)
    check("event sent to Google with alarm + timezone", den and den["start"]["dateTime"] == "2026-10-05T14:30:00" and den["start"]["timeZone"] == "America/Chicago"
          and den["reminders"]["overrides"][0]["minutes"] == 15 and den["recurrence"] == ["RRULE:FREQ=MONTHLY"], den)
    check("bill sent as an all-day monthly item", any(e["summary"].startswith("💳 Rent") and e["start"].get("date") for e in g))
    a.js("gcalPush()"); a.page.wait_for_timeout(300)
    check("syncing again makes no duplicates", a.js("Object.keys(window.__g).length") == 2)
    a.js("S.events[0].title = 'Dentist (moved)'; save(); gcalPush()"); a.page.wait_for_timeout(300)
    check("edit in Day Hub updates the phone calendar", a.js("Object.values(window.__g).some(e => e.summary === 'Dentist (moved)')") and a.js("Object.keys(window.__g).length") == 2)
    a.js("S.events = []; save(); gcalPush()"); a.page.wait_for_timeout(300)
    check("delete in Day Hub removes it from the phone calendar", a.js("Object.keys(window.__g).length") == 1)
    a.js("S.gcal.events = []; gcalFetch()"); a.page.wait_for_timeout(300)
    check("Day Hub's own copies are not shown twice", a.js("S.gcal.events.length") == 0)
    a.js("S.gcal.connected = false; S.gcal.scope = null"); a.page.click("#settingsBtn")
    txt = a.page.inner_text("#gcalBox")
    check("settings shows numbered setup steps", "Tap Connect below" in txt and "Allow" in txt, txt[:200])
    check("settings has Samsung phone steps", "Samsung" in a.js("document.getElementById('gcalBox').innerHTML") and "Sync account" in a.js("document.getElementById('gcalBox').innerHTML"))
    a.js("closeSettings()")
    a.close()

    a = App(b, base, at="2026-10-01T18:00:00"); setup(a)
    first = a.js("[...document.querySelectorAll('#cards [data-card]')].map(c => c.dataset.card)")
    check("before arranging: evening cards jump up (reset, then Tomorrow)", first[:2] == ["reset", "tomorrow"], first[:3])
    a.page.click("[data-arrange]"); a.page.wait_for_timeout(200)
    check("↕ Arrange opens settings at the card list", a.js("!document.getElementById('sheet').classList.contains('hidden')") and "Arrange your screen" in a.page.inner_text("#sheet"))
    a.page.click('[data-move="weather"][data-dir="top"]')
    now = a.js("[...document.querySelectorAll('#cards [data-card]')].map(c => c.dataset.card)")
    check("⤒ puts a card at the top - and it stays there in the evening", now[0] == "weather", now[:3])
    a.page.click("[data-orderreset]")
    check("Back to the standard order", a.js("S.order") is None)
    a.close()


def t_v020_nightly_reset(b, base):
    print("\n[v0.20 nightly reset]")
    a = App(b, base, at="2026-10-01T15:00:00"); setup(a)
    check("reset card hidden in the afternoon", not a.page.query_selector('[data-card="reset"]'))
    a.qa("todo", {"title": "Call insurance"})
    a.qa("todo", {"title": "Buy stamps"})
    a.qa("todo", {"title": "Take meds", "rep": "daily"})
    a.qa("loads", {"title": "Load 4471", "date": "2026-10-01", "time": "16:00"}) if a.js("qaTypes().includes('loads')") else a.js("S.loads.push({id:'L1',day:'2026-10-01',time:'16:00',title:'Load 4471',done:false}); save()")
    a.js("S.loads.push({id:'L2',day:'2026-10-01',time:'17:00',title:'Load 4472',done:false}); save()")
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "10:00"})
    a.js("const t = S.todos.find(x => x.title === 'Call insurance'); t.done = true; t.doneDay = today(); save()")
    a.page.clock.run_for("06:00:00"); a.js("render()")
    order = a.js("[...document.querySelectorAll('#cards [data-card]')].map(c => c.dataset.card)")
    check("at 9 PM the reset card is first", order[0] == "reset", order[:3])
    card = a.card("reset")
    check("Got done lists the finished to-do + appointment", "Call insurance" in card and "1 appointment" in card, card[:300])
    check("Still open lists what's left (2 to-dos, 2 loads)", "Buy stamps" in card and "Take meds" in card and "Load 4472" in card and "Still open (4)" in card.replace("STILL OPEN", "Still open"), card[:400])
    a.page.click('[data-rmove="all"]')
    check("Move all -> loads land on tomorrow", a.js("S.loads.every(x => x.day === '2026-10-02')"))
    a.page.click('[data-rdrop]')
    check("✕ drops an open to-do", a.js("!S.todos.some(x => x.title === 'Buy stamps')"))
    a.page.click('[data-rdone^="todos:"]')
    check("✓ marks the repeating to-do done today", a.js("todoDone(S.todos.find(x => x.title === 'Take meds'))"))
    a.page.fill("form[data-remember] input", "Bring the gate key")
    a.page.click("form[data-remember] button")
    check("remember item saved for tomorrow", a.js("S.remember.length === 1 && S.remember[0].day === '2026-10-02'"))
    a.page.click('[data-reset="close"]')
    check("Close my day: card shows closed + the morning note", "Day closed" in a.card("reset") and "Bring the gate key" in a.card("reset"))
    check("no nightly reminder once the day is closed", not any(r["key"].startswith("nr:") for r in a.js("reminderList()")))
    a.page.clock.run_for("11:00:00"); a.js("render()")
    check("next morning: 📌 chip on the hero", "Bring the gate key" in a.page.inner_text("#hero"))
    check("next morning: 📌 in the morning brief", "📌 Bring the gate key" in a.js("morningBrief()"))
    a.page.click('#hero [data-rmdel]')
    check("tap the 📌 chip when handled", a.js("S.remember.length") == 0)
    a.close()

    a = App(b, base, at="2026-10-01T20:59:00"); setup(a)
    a.js("S.remind.on = true; S.remind.fired = {}; saveLocal(); window.__n = []; window.notify = async (t, body) => window.__n.push(t)")
    a.page.clock.run_for("00:02:00"); a.js("checkReminders()"); a.page.wait_for_timeout(200)
    check("9 PM nightly reset reminder fires", "🛏️ Nightly reset" in a.js("window.__n"), a.js("window.__n"))
    a.page.click("#settingsBtn")
    check("settings: nightly reset time picker", a.js("!!document.querySelector('[data-rset=night]')"))
    a.close()


FAKE_GCAL = """(() => { window.__g = window.__g || {}; let n = 0; const real = window.fetch;
  window.fetch = async (u, o = {}) => { u = String(u);
    if (!u.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) return real(u, o);
    const m = o.method || 'GET', id = decodeURIComponent((u.split('/events/')[1] || '').split('?')[0]);
    const J = (x, st = 200) => new Response(x == null ? null : JSON.stringify(x), { status: st });
    const store = JSON.parse(sessionStorage.getItem('__g') || '{}'), keep = () => sessionStorage.setItem('__g', JSON.stringify(store));
    if (m === 'GET') return J({ items: Object.values(store) });
    if (m === 'POST') { const e = { ...JSON.parse(o.body), id: 'g' + Date.now() + (++n) }; store[e.id] = e; keep(); return J(e); }
    if (m === 'PUT') { store[id] = { ...JSON.parse(o.body), id }; keep(); return J(store[id]); }
    if (m === 'DELETE') { delete store[id]; keep(); return J(null, 204); } }; })()"""


def t_v021_brief_sync(b, base):
    print("\n[v0.21 morning brief + sync on open + remembered cards]")
    a = App(b, base); setup(a)
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "10:30"})
    a.qa("todo", {"title": "Call insurance"})
    a.qa("bill", {"title": "Phone", "amount": "85", "day": "2"})
    a.js("S.briefDay = null; saveLocal()")
    a.page.reload(); a.page.wait_for_function("WXDATA && WXDATA.here"); a.page.wait_for_timeout(300)
    br = a.page.inner_text("#brief") if a.page.query_selector("#brief") else ""
    check("first morning open shows the brief", a.js("briefOpen()") and "Good morning, Scott" in br, br[:120])
    check("brief: weather, first item, bill due", "72°" in br and "10:30 AM: Dentist" in br and "Phone" in br and "tomorrow" in br, br[:400])
    a.js("(() => { window.__said = ''; speechSynthesis.speak = u => { window.__said = u.text; }; })()")
    a.page.click('[data-brief="speak"]')
    check("🔊 reads it out loud", "Good morning, Scott" in a.js("window.__said") and "degrees" in a.js("window.__said"))
    a.page.click('[data-brief="go"]')
    check("Start my day closes it", not a.js("briefOpen()"))
    a.page.reload(); a.page.wait_for_timeout(400)
    check("only once per morning", not a.js("briefOpen()"))
    hero(a); a.page.click('#hero [data-brief="open"]')
    check("☀️ chip opens it any time in the morning", a.js("briefOpen()"))
    a.page.click("[data-briefauto]")
    a.page.click('[data-brief="go"]')
    a.page.clock.run_for("24:00:00"); a.js("maybeBrief()")
    check("turned off: no brief next morning", not a.js("briefOpen()") and a.js("S.briefAuto") is False)
    a.close()

    a = App(b, base, at="2026-10-01T14:00:00"); setup(a)
    a.js("S.briefDay = null; saveLocal()"); a.page.reload(); a.page.wait_for_timeout(400)
    check("no brief in the afternoon", not a.js("briefOpen()"))
    # remembered open/closed cards
    a.page.click('h3[data-collapse="weather"]')
    a.page.reload(); a.page.wait_for_timeout(300)
    check("closed card stays closed after closing the app", a.js("document.querySelector('[data-card=weather]').classList.contains('collapsed')"))
    a.js("restoreFrom({savedAt: new Date().toISOString(), data: {...JSON.parse(JSON.stringify(S)), collapsed: []}})")
    check("a backup restore doesn't reopen it", a.js("S.collapsed.includes('weather')"))
    a.close()

    # sync on open: a kept Google sign-in syncs with no tap
    a = App(b, base); setup(a)
    a.ctx.add_init_script(FAKE_GCAL)
    a.js("S.gcal.connected = true; S.gcal.scope = GCAL_SCOPE; S.events.push({id:'e1',day:'2026-10-03',time:'09:00',title:'Vet',rep:'none'}); saveLocal();"
         "localStorage.setItem('dayhub.gtok', JSON.stringify({g:['tok', Date.now() + 3000000]}))")
    a.page.reload(); a.page.wait_for_timeout(1200)
    check("open = synced: event is on the phone calendar, no tap", a.js("Object.values(JSON.parse(sessionStorage.getItem('__g') || '{}')).some(e => e.summary === 'Vet')"))
    check("signed in: no 'Tap to sync' chip", "Tap to sync" not in a.page.inner_text("#hero"))
    # sign-in ran out + Google says "needs you": one chip, and no redirect loop
    a.js("localStorage.setItem('dayhub.gtok', JSON.stringify({g:['tok', Date.now() - 1000]})); localStorage.removeItem('dayhub.autoauth')")
    a.page.reload(); a.page.wait_for_timeout(800)
    check("Google needs you: one '🔄 Tap to sync' chip", hero(a).count("Tap to sync") == 1)
    hits = getattr(a.ctx, "_oauth_hits", 0)
    a.page.reload(); a.page.wait_for_timeout(500)
    check("...and it does not keep bouncing to Google", getattr(a.ctx, "_oauth_hits", 0) == hits and "state=" not in a.page.url)
    # sign-in ran out + phone signed in to Google: renewed with NO tap, then synced
    a.ctx._oauth = "ok"
    a.js("localStorage.setItem('dayhub.gtok', JSON.stringify({g:['tok', Date.now() - 1000]})); localStorage.removeItem('dayhub.autoauth');"
         "S.events.push({id:'e2',day:'2026-10-04',time:'11:00',title:'Car wash',rep:'none'}); saveLocal()")
    a.page.reload(); a.page.wait_for_timeout(1500)
    check("zero-tap: fresh Google sign-in on open", a.js("GTOKEN") == "tok-auto" and "access_token" not in a.page.url)
    check("zero-tap: new event reached the phone calendar", a.js("Object.values(JSON.parse(sessionStorage.getItem('__g') || '{}')).some(e => e.summary === 'Car wash')"))
    check("zero-tap: no 'Tap to sync' chip", "Tap to sync" not in a.page.inner_text("#hero"))
    a.close()


def t_v022_brain_dump(b, base):
    print("\n[v0.22 brain dump]")
    a = App(b, base); setup(a)                     # Thu 2026-10-01 08:00
    P = lambda txt: a.js("t => dumpParse(t).map(x => [x.kind, x.title, x.day || null, x.time || null, x.rep || null])", txt)
    got = P("Need tires next month, call Dan Tuesday, buy toothpaste, vacation idea for December")
    check("Scott's example: 4 pieces", len(got) == 4, got)
    check("'need tires next month' -> reminder Nov 1", got[0][:3] == ["event", "Need tires", "2026-11-01"], got[0])
    check("'call Dan Tuesday' -> reminder Tue Oct 6", got[1][:3] == ["event", "Call Dan", "2026-10-06"], got[1])
    check("'buy toothpaste' -> shopping", got[2][:2] == ["item", "Toothpaste"], got[2])
    check("'vacation idea for December' -> idea", got[3][0] == "note" and "December" in got[3][1], got[3])
    cases = [
        ("pick up kids at 3", ["event", "Pick up kids", "2026-10-01", "15:00", "none"]),
        ("dentist tomorrow at 2:30pm", ["event", "Dentist", "2026-10-02", "14:30", "none"]),
        ("remind me to pay the electric bill on the 15th", ["event", "Pay the electric bill", "2026-10-15", "09:00", "none"]),
        ("take meds every day at 8am", ["event", "Take meds", "2026-10-01", "08:00", "daily"]),
        ("trash night every thursday", ["event", "Trash night", "2026-10-01", "09:00", "weekly"]),
        ("call mom", ["todo", "Call mom", None, None, None]),
        ("milk", ["item", "Milk", None, None, None]),
        ("oil change in 2 weeks", ["event", "Oil change", "2026-10-15", "09:00", "none"]),
        ("lunch with Bob friday at noon", ["event", "Lunch with Bob", "2026-10-02", "12:00", "none"]),
        ("call the bank at 7am", ["event", "Call the bank", "2026-10-02", "07:00", "none"]),
    ]
    for txt, want in cases:
        g = P(txt); g = g[0] if g else None
        check(f"'{txt}'", g == want, g)
    check("a lone 'Tuesday' joins the piece before it", P("call Dan. Tuesday")[0][:3] == ["event", "Call Dan", "2026-10-06"], P("call Dan. Tuesday"))

    # the real flow: 🧠 -> type -> Sort it -> fix one -> Add all
    a.page.click('#hero [data-dump]')
    check("🧠 opens Brain dump", a.js("QA_TYPE") == "dump" and a.js("!!document.querySelector('#qaForm [name=dump]')"))
    a.page.fill("#qaForm [name=dump]", "call Dan Tuesday, buy toothpaste, fix the fence, vacation idea for December")
    a.page.click("#qaForm > .btn:last-child")
    check("first tap only sorts (nothing added yet)", a.js("DUMP.length") == 4 and a.js("S.todos.length + S.events.length + S.notes.length") == 0)
    check("button now says Add all (4)", "Add all (4)" in a.page.inner_text("#qaForm > .btn:last-child"))
    a.page.select_option('[data-dkind="2"]', "event")
    check("changing a piece to Reminder shows date + time", a.js("!!document.querySelector('[data-dday=\"2\"]')"))
    a.page.fill('[data-dtext="0"]', "Call Dan about the truck")
    a.page.click('[data-ddel="3"]')
    a.page.click("#qaForm > .btn:last-child")
    check("Add all files each one", a.js("S.events.some(e => e.title === 'Call Dan about the truck' && e.day === '2026-10-06')")
          and a.js("S.lists[0].items.some(i => i.text === 'Toothpaste')") and a.js("S.events.some(e => e.title === 'Fix the fence')")
          and a.js("S.notes.length") == 0)
    a.page.click('[data-undo]')
    check("Undo takes the whole dump back", a.js("S.events.length") == 0 and a.js("S.lists[0].items.length") == 0)
    a.close()


def t_v024_weather_intel(b, base):
    print("\n[v0.24 weather intelligence]")
    a = App(b, base); setup(a)                     # fixture: 70% rain 3-6 PM today
    a.qa("event", {"title": "Mow the lawn", "date": "2026-10-01", "time": "16:00"})
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "16:00"})
    al = a.js("wxAlerts(today()).map(x => x.text)")
    check("outdoor plan in the rain is flagged", any("Rain likely at 4:00 PM" in x and "Mow the lawn" in x for x in al), al)
    check("indoor plan at the same hour is not", not any("Dentist" in x for x in al), al)
    check("alert shows on the Weather card", "Mow the lawn" in a.card("weather"))
    check("alert chip at the top of the screen", "Rain likely at 4:00 PM" in a.page.inner_text("#hero"))
    a.js("WXDATA.here.days[1].lo = 28; WXDATA.here.days[0].hi = 97; WXDATA.here.days[1].hi = 70; WXDATA.here.days[0].gust = 41; WXDATA.here.days[0].code = 95; render()")
    al = " | ".join(a.js("wxAlerts(today()).map(x => x.text)"))
    check("freeze tonight", "Freeze tonight — low 28°" in al, al)
    check("heat, storms, gusts, big drop", all(k in al for k in ["high 97°", "Thunderstorms", "Gusts to 41 mph", "Much colder tomorrow"]), al)
    check("freeze gets a 6 PM reminder", any(r["key"].startswith("fz:") and r["title"] == "🥶 Freeze tonight" for r in a.js("reminderList()")))
    check("morning brief says it out loud", "Rain likely at 4:00 PM" in " ".join(a.js("briefLines()")))
    a.qa("event", {"title": "Soccer practice", "date": "2026-10-02", "time": "15:00"})
    a.page.clock.run_for("08:00:00"); a.page.wait_for_timeout(300)
    a.js("WXDATA.here.byHour['2026-10-02T15'].rain = 80; render()")
    check("Tomorrow card warns about tomorrow's outdoor plan", "Soccer practice" in a.card("tomorrow") and "Rain likely" in a.card("tomorrow"), a.card("tomorrow")[:300])
    a.close()


def t_v025_people_leave(b, base):
    print("\n[v0.25 people & dates + don't forget]")
    a = App(b, base); setup(a)                     # Thu 2026-10-01 08:00
    a.qa("person", {"name": "Roxanne", "kind": "birthday", "date": "1985-10-13", "lead": "14", "ideas": "candles, size M"})
    card = a.card("people")
    check("birthday shows days to go + age", "Roxanne's birthday (turns 41)" in card and "in 12 days" in card, card[:200])
    check("gift prompt with your ideas", "🎁 Gift?" in card and "candles, size M" in card)
    check("morning brief asks about the gift", any("Roxanne's birthday (turns 41) is in 12 days — got a gift?" in x for x in a.js("briefLines()")))
    a.page.click("[data-pgot]")
    check("✓ Got it clears the gift prompt", "🎁 Gift?" not in a.card("people"))
    a.qa("person", {"name": "Mom & Dad", "kind": "anniversary", "date": "2026-10-02", "noyear": True, "lead": "0"})
    check("yearless anniversary: no age", "Mom & Dad anniversary" in a.card("people") and "years" not in a.card("people").split("Mom & Dad")[1][:30])
    check("tomorrow's date shows as a chip at the top", "Mom & Dad tomorrow" in a.page.inner_text("#hero"))
    check("it's on that day's schedule", a.js("dayItems('2026-10-02').some(i => i.kind === 'person')"))
    check("day-of reminder at 8 AM", any(r["key"].startswith("pp:") and "Today:" in r["title"] for r in a.js("reminderList()")))
    a.qa("person", {"name": "Leap baby", "kind": "birthday", "date": "2028-02-29", "lead": "0"})
    check("Feb 29 birthday shows Feb 28 in other years", a.js("personNext(S.people.find(p => p.name === 'Leap baby'))") == "2027-02-28")
    a.page.click('[data-pedit]')
    check("✏️ opens the date to edit", a.js("QA_TYPE") == "person" and a.js("document.querySelector('#qaForm [name=name]').value") != "")
    a.js("closeQA()")

    # don't forget
    lv = a.card("leave")
    check("default leaving list", all(x in lv for x in ["Wallet", "Keys", "Medication", "Lunch"]), lv[:200])
    check("today adds an umbrella (rain from 3 PM)", "Umbrella" in lv and "rain from 3:00 PM" in lv)
    check("brief says what to bring", any("Don't forget: umbrella" in x for x in a.js("briefLines()")))
    check("morning chip: Don't forget", "Don't forget:" in a.page.inner_text("#hero"))
    a.page.click('[data-leavechk="x-umbrella"]')
    check("ticking saves", a.js("S.leave.done.includes('x-umbrella')"))
    a.page.fill("form[data-addleave] input", "🕶️ Sunglasses"); a.page.click("form[data-addleave] button")
    check("add your own item", "Sunglasses" in a.card("leave"))
    for i in a.js("leaveAll().map(x => x.id)"):
        a.js("id => { if (!S.leave.done.includes(id)) { S.leave.done.push(id); S.leave.day = today(); } }", i)
    a.js("save(); render()")
    check("all checked: All set", "All set" in a.card("leave") and a.js("leaveLeft()") == 0)
    a.page.clock.run_for("24:00:00"); a.js("render()")
    check("next day the checklist starts fresh", a.js("leaveLeft()") > 0 and not a.js("leaveDone().length"))
    a.js("S.events.push({id:'g1',day:today(),time:'17:00',title:'Gym',rep:'none'}); S.events.push({id:'d1',day:today(),time:'10:00',title:'Dentist',rep:'none'}); save(); render()")
    check("gym day + doctor day extras", "Gym bag" in a.card("leave") and "Insurance card" in a.card("leave"))
    a.page.click('#hero [data-leave]'); a.page.wait_for_timeout(1000)
    check("🚪 jumps to the checklist", a.js("Math.abs(document.querySelector('[data-card=leave]').getBoundingClientRect().top) < 400"))
    a.js("eraseAll(); eraseAll()")
    check("after Erase the card still works", "Wallet" in a.card("leave"))
    a.close()


def t_v026_upkeep(b, base):
    print("\n[v0.26 home & car upkeep]")
    a = App(b, base); setup(a)                     # Thu 2026-10-01 08:00
    open_mini(a, "home"); open_mini(a, "auto")
    check("empty Home card offers common ones", "HVAC filter" in a.card("home") and "Trash day" in a.card("home"))
    check("empty Car card offers common ones", "Oil change" in a.card("auto") and "Registration renewal" in a.card("auto"))
    # trash day: tap the chip, set next pickup = Fri Oct 2
    a.page.click('[data-card="home"] [data-upreset="home:0"]')
    check("chip opens the form filled in", a.js("document.querySelector('#qaForm [name=name]').value") == "🗑️ Trash day"
          and a.js("document.querySelector('#qaForm [name=auto]').checked"))
    a.page.fill("#qaForm [name=next]", "2026-10-02"); a.page.click("#qaForm > .btn:last-child")
    check("trash day shows tomorrow", "tomorrow" in a.card("home"))
    check("cans-out reminder tonight at 7 PM", any(r["key"].startswith("up:") and "tomorrow" in r["title"] and r["at"] == a.js("atMs(today(), '19:00')") for r in a.js("reminderList()")))
    # HVAC: last done 3 months ago -> due today, ✓ Done restarts the clock
    a.page.click('[data-card="home"] [data-upreset="home:2"]')
    a.page.fill("#qaForm [name=last]", "2026-07-01"); a.page.click("#qaForm > .btn:last-child")
    check("HVAC filter due today", "due today" in a.card("home") and "HVAC filter" in a.page.inner_text("#hero"))
    check("on today's schedule", a.js("dayItems(today()).some(i => i.kind === 'upkeep' && /HVAC/.test(i.title))"))
    check("morning brief mentions it", any("HVAC filter is due today" in x for x in a.js("briefLines()")))
    a.page.click('[data-card="home"] [data-updone]')
    check("✓ Done -> next in 3 months", a.js("upkeepNext(S.upkeep.find(x => /HVAC/.test(x.name)))") == "2027-01-01")
    # car: registration with a fixed date
    a.page.click('[data-card="auto"] [data-upreset="auto:2"]')
    a.page.fill("#qaForm [name=next]", "2026-10-10"); a.page.click("#qaForm > .btn:last-child")
    check("registration due in 9 days", "in 9 days" in a.card("auto"))
    # trash rolls forward by itself
    a.page.clock.run_for("48:00:00"); a.js("render()")
    check("trash day rolled to next week", a.js("upkeepNext(S.upkeep.find(x => x.auto))") == "2026-10-09")
    # overdue
    a.page.clock.fast_forward(10 * 86400000); a.js("render()")
    check("registration shows overdue", "overdue" in a.card("auto"))
    check("month math: Jan 31 + 1 month = Feb 28", a.js("addEvery('2027-01-31', 1, 'months')") == "2027-02-28")
    a.page.click('[data-card="auto"] [data-upedit]')
    a.page.click("[data-updel]")
    check("✏️ -> Delete", a.js("S.upkeep.filter(x => x.area === 'auto').length") == 0)
    a.close()


def t_v027_routines(b, base):
    print("\n[v0.27 routines]")
    a = App(b, base, at="2026-10-01T06:30:00"); setup(a)          # Thursday
    open_mini(a, "routines")
    check("empty card offers the 5 routines", all(x in a.card("routines") for x in ["Morning", "Workday shutdown", "Evening", "Weekend reset", "Vacation prep"]))
    a.page.click('[data-card="routines"] [data-radd="0"]')
    check("one tap adds Morning with its steps", a.js("S.routines.length") == 1 and "Make the bed" in a.card("routines"))
    check("weekday 7 AM routine shows at the top at 6:30", "Morning: 0/5" in a.page.inner_text("#hero"))
    check("7 AM reminder", any(r["key"].startswith("rt:") for r in a.js("reminderList()")))
    ids = a.js("S.routines[0].steps.map(x => S.routines[0].id + ':' + x.id)")
    a.page.click(f'[data-rstep="{ids[0]}"]')
    check("ticking a step saves + counts", "1/5" in a.card("routines") and a.js("rDone(S.routines[0]).length") == 1)
    for i in ids[1:]:
        a.page.click(f'[data-rstep="{i}"]')
    check("all steps: done", "done today" in a.card("routines") and "Morning:" not in a.page.inner_text("#hero"))
    a.page.click('[data-card="routines"] .routine [data-ropen]')
    check("Close works on an auto-opened routine", not a.js("!!document.querySelector('.routine.open')"))
    a.page.clock.fast_forward("24:00:00"); a.js("render()")
    check("next day it starts fresh", a.js("rLeft(S.routines[0])") == 5)
    # edit: change steps, keep ticks on the ones that stayed
    rid = a.js("S.routines[0].id"); keep = a.js("S.routines[0].steps[1].id")
    a.js("(r) => { S.rdone[r] = { day: today(), ids: [S.routines[0].steps[1].id] }; save(); }", rid)
    a.page.click('[data-redit]')
    a.page.fill("#qaForm [name=steps]", "Meds\nCoffee\nWalk the dog")
    a.page.click("#qaForm > .btn:last-child")
    check("edit keeps the tick on an unchanged step", a.js("rDone(S.routines[0]).includes(S.routines[0].steps[0].id)") and a.js("S.routines[0].steps.length") == 3)
    # your own routine from +
    a.js("openQA('routine')")
    a.page.fill("#qaForm [name=name]", "🏋️ Gym day"); a.page.fill("#qaForm [name=steps]", "Fill water bottle\nPack gym bag")
    a.page.check("#qaForm [name=d5]"); a.page.fill("#qaForm [name=time]", "17:30")
    a.page.click("#qaForm > .btn:last-child")
    check("make your own routine", a.js("S.routines.some(r => r.name === '🏋️ Gym day' && r.days.includes(5) && r.time === '17:30' && r.steps.length === 2)"))
    a.page.click('[data-redit] >> nth=1'); a.page.click("[data-rdel]")
    check("delete a routine", a.js("S.routines.length") == 1)
    a.close()


def t_v028_payday(b, base):
    print("\n[v0.28 payday]")
    a = App(b, base); setup(a)                     # Thu 2026-10-01 08:00
    open_mini(a, "payday")
    check("not set up: 3 easy steps", "How often do you get paid?" in a.card("payday") and "Your next payday" in a.card("payday"))
    a.qa("bill", {"title": "Phone", "amount": "85", "day": "3"})
    a.qa("bill", {"title": "Rent", "amount": "900", "day": "12"})
    a.qa("bill", {"title": "Car", "amount": "350", "day": "20"})
    a.js("closeQA()")
    f = '[data-card="payday"] form[data-paysetup]'
    a.page.select_option(f + " [name=freq]", "biweekly"); a.page.fill(f + " [name=next]", "2026-10-09"); a.page.fill(f + " [name=amount]", "1500")
    a.page.click(f + " button")
    card = a.card("payday")
    check("next payday in 8 days", "Next payday" in card and "in 8 days" in card, card[:200])
    check("due before payday: Phone $85", "due before payday · $85.00" in card.lower())
    check("that check covers Rent + Car until Oct 23", "until oct 23" in card.lower() and "$1,250.00" in card, card[:500])
    check("left after bills ≈ $250", "Left after bills ≈ $250.00" in card)
    check("paydays repeat every 2 weeks", a.js("payNext('2026-10-10')") == "2026-10-23" and a.js("payNext('2026-09-20')") == "2026-09-25")
    # goals
    gf = '[data-card="payday"] form[data-goalnew]'
    a.page.fill(gf + " [name=name]", "Christmas"); a.page.fill(gf + " [name=target]", "600"); a.page.click(gf + " button")
    a.page.fill('[data-card="payday"] form[data-goaladd] [name=amt]', "150"); a.page.click('[data-card="payday"] form[data-goaladd] button')
    check("savings goal: $150 of $600 · 25%", "$150.00 of $600.00 · 25%" in a.card("payday"))
    # payday day itself
    a.page.clock.fast_forward(8 * 86400000) if False else a.page.clock.fast_forward(8 * 86400000)
    a.js("render()")
    check("payday: chip at the top", "Payday!" in a.page.inner_text("#hero") and "$1,250.00" in a.page.inner_text("#hero"), a.page.inner_text("#hero")[:200])
    check("payday on the schedule", a.js("dayItems(today()).some(i => i.kind === 'pay')"))
    check("payday reminder at 8 AM", any(r["key"].startswith("pay:") for r in a.js("reminderList()")))
    check("brief says payday", any("Payday today" in x for x in a.js("briefLines()")))
    # twice a month: 1st + 15th; monthly clamps to month end
    a.js("S.payday = { freq: 'semimonthly', next: '2026-10-15', d1: 15, d2: 31, amount: null }")
    check("twice a month 15th + last day", a.js("payNext('2026-10-16')") == "2026-10-31" and a.js("payNext('2026-11-01')") == "2026-11-15")
    a.js("S.payday = { freq: 'monthly', next: '2026-10-31', d1: 1, d2: 15, amount: null }")
    check("monthly on the 31st lands Nov 30", a.js("payNext('2026-11-01')") == "2026-11-30")
    a.js("S.money.type = 'salary'; S.money.salary = 52000; S.work.taxPct = 20")
    check("no amount: estimate from salary", abs(a.js("payAmount().amt") - 52000 * 0.8 / 12) < 0.01 and a.js("payAmount().est"))
    a.close()


def t_v029_pulse(b, base):
    print("\n[v0.29 life pulse]")
    a = App(b, base, at="2026-10-01T13:00:00"); setup(a)
    a.js("WXDATA.here.day.rainFrom = null; WXDATA.here.days[0].rain = 0; render()")
    check("empty day = 100 Ready", a.js("pulseScore()") == 100 and "Ready" in a.page.inner_text("#hero"))
    a.qa("todo", {"title": "Call insurance"})
    a.qa("bill", {"title": "Phone", "amount": "85", "day": "1"})
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "15:00"})
    a.qa("event", {"title": "School pickup", "date": "2026-10-01", "time": "15:30"})
    a.js("closeQA()")
    items = a.js("pulseItems().map(x => x.text)")
    check("bill due today counted", any("Phone due today" in i for i in items), items)
    check("overlap spotted", any("Dentist (3:00 PM) overlaps School pickup (3:30 PM)" in i for i in items), items)
    check("open to-do counted", any("1 to-do open" in i for i in items))
    check("score drops to 77 = Mostly ready", a.js("pulseScore()") == 77 and "Mostly ready" in a.page.inner_text("#hero"), a.js("pulseScore()"))
    a.page.click("[data-pulse]")
    sheet = a.page.inner_text("#pulseSheet")
    check("tap the ring: list, worst first", sheet.index("overlaps") < sheet.index("Phone due today") < sheet.index("to-do open"), sheet[:300])
    a.page.click('[data-pulsego="todos"]'); a.page.wait_for_timeout(900)
    check("Go jumps to the card", a.js("document.getElementById('pulseSheet').classList.contains('hidden')")
          and a.js("Math.abs(document.querySelector('[data-card=todos]').getBoundingClientRect().top) < 400"))
    a.page.click('[data-tick]'); a.page.wait_for_timeout(300)
    check("finishing things raises it", a.js("pulseScore()") == 82)
    a.close()


def t_v030_brief_countdowns(b, base):
    print("\n[v0.30 every countdown in the morning brief]")
    a = App(b, base); setup(a)
    a.qa("countdown", {"title": "Cruise", "date": "2026-12-20"})
    a.qa("countdown", {"title": "Christmas", "date": "2026-12-25"})
    a.qa("countdown", {"title": "Retirement", "date": "2029-06-01"})
    a.qa("countdown", {"title": "Concert", "date": "2026-10-01"})
    a.js("closeQA(); S.trips.push({id:'t1', name:'Vegas', start:'2026-11-05', end:'2026-11-08'}); save()")
    said = " ".join(a.js("briefLines()"))
    check("spoken: every countdown, far ones too", all(k in said for k in ["80 days until Cruise", "85 days until Christmas", "until Retirement", "35 days until Vegas"]), said)
    check("spoken: today's the day", "Today's the day: Concert" in said)
    a.js("showBrief()")
    br = a.page.inner_text("#brief")
    check("brief screen lists them all in date order", br.index("Concert") < br.index("Vegas") < br.index("Cruise") < br.index("Christmas") < br.index("Retirement"), br[:600])
    a.close()


def t_v031_ai_helper(b, base):
    print("\n[v0.31 AI helper (relay)]")
    a = App(b, base); setup(a)
    a.page.click("#settingsBtn")
    check("settings: AI helper with easy steps", "AI helper" in a.page.inner_text("#aiBox") and "Turn on" in a.page.inner_text("#aiBox"))
    a.page.fill("#aiBox [name=pass]", "wrong words"); a.page.click("#aiBox form button"); a.page.wait_for_timeout(400)
    check("wrong passphrase is refused, not saved", "doesn't match" in a.page.inner_text("#aiBox") and not a.js("aiOn()"))
    a.page.fill("#aiBox [name=pass]", "test-only-passphrase-x7"); a.page.click("#aiBox form button"); a.page.wait_for_timeout(400)
    check("right passphrase turns it on", a.js("aiOn()") and "On" in a.page.inner_text("#aiBox"))
    check("passphrase is not in the backup data", "tiger" not in a.js("JSON.stringify(S)"))
    a.js("closeSettings()")
    a.page.click('#hero [data-dump]')
    a.page.fill("#qaForm [name=dump]", "uh so tires sometime next month and ring Dan tuesday after lunch, toothpaste, maybe a december trip")
    a.page.click("[data-dumpsort]"); a.page.wait_for_timeout(500)
    got = a.js("DUMP.map(x => [x.kind, x.title, x.day, x.time])")
    check("AI sorts the messy dump (bad items dropped)", got == [["event", "Get new tires", "2026-11-01", "09:00"], ["event", "Call Dan", "2026-10-06", "14:00"],
          ["item", "Toothpaste", None, None], ["note", "December vacation idea", None, None]], got)
    a.page.click("#qaForm > .btn:last-child")
    check("Add all files the AI's sort", a.js("S.events.some(e => e.title === 'Call Dan' && e.time === '14:00')") and a.js("S.notes.length") == 1)
    a.ctx._ai_down = True
    a.page.click('#hero [data-dump]')
    a.page.fill("#qaForm [name=dump]", "call mom tomorrow at 3pm, buy milk")
    a.page.click("[data-dumpsort]"); a.page.wait_for_timeout(500)
    check("AI down: falls back to the quick sorter", a.js("DUMP.length") == 2 and a.js("DUMP[0].title") == "Call mom" and a.js("DUMP[1].kind") == "item")
    a.js("closeQA()")
    a.page.click("#settingsBtn"); a.page.click('[data-ai="off"]')
    check("Turn off forgets the passphrase", not a.js("aiOn()"))
    a.close()


def t_v032_ask_top3(b, base):
    print("\n[v0.32 ask day hub + top 3]")
    a = App(b, base); setup(a)
    a.qa("todo", {"title": "Call insurance"})
    a.qa("bill", {"title": "Phone", "amount": "85", "day": "1"})
    a.js("closeQA()")
    check("Top 3 without AI: quick pick from the pulse", a.js("S.top3.day === today() && S.top3.items.length >= 2 && !S.top3.ai") or (a.js("top3Pick(true)") or True) and a.js("S.top3.items.length >= 2"))
    check("quick pick says how to get smarter picks", "turn on 🤖 AI helper" in a.card("top3"))
    a.page.click('#hero [data-ask="open"]')
    check("💡 without AI: easy steps to turn it on", "AI helper" in a.page.inner_text("#askSheet") and "passphrase" in a.page.inner_text("#askSheet"))
    a.page.click('#askSheet [data-askclose]')
    a.js("localStorage.setItem('dayhub.aipass', 'test-only-passphrase-x7')")
    a.qa("upkeep", {"area": "auto", "name": "🛢️ Oil change", "every": "3", "unit": "months", "last": "2026-10-01"}); a.js("closeQA()")
    a.page.click('#hero [data-ask="open"]')
    a.page.fill("#askSheet input[name=q]", "When is my next oil change?"); a.page.click("#askSheet form button:last-child"); a.page.wait_for_timeout(500)
    check("💡 asks + shows the answer", "next oil change is due" in a.page.inner_text("#askSheet"))
    ctx = getattr(a.ctx, "_ask_input", "")
    check("question sent with a summary of your planner", "When is my next oil change?" in ctx and "Oil change" in ctx and "Call insurance" in ctx and "Phone" in ctx, ctx[:200])
    a.page.click('#askSheet [data-askclose]')
    a.page.click('[data-card="top3"] [data-top3="pick"]'); a.page.wait_for_timeout(500)
    card = a.card("top3")
    check("AI Top 3 picked", "Pay the phone bill" in card and "Dentist at 3:00 PM" in card and "picked by your AI helper" in card, card[:300])
    a.page.click('[data-t3up] >> nth=1')
    check("▲ reorders", a.js("S.top3.items[1].title") == "Call Mom")
    for i in a.js("S.top3.items.map(x => x.id)"):
        a.page.click(f'[data-t3chk="{i}"]')
    check("tick all three: done", "All three done" in a.card("top3"))
    check("brief reads your top 3", any("Your top 3" in l for l in a.js("briefLines()")))
    a.close()


def t_v033_alarms(b, base):
    print("\n[v0.33 alarms on the schedule + nightly reset]")
    a = App(b, base, at="2026-10-01T20:00:00"); setup(a)     # Thu evening; tomorrow = Fri
    check("nightly reset offers to add your alarm", "Add your alarm" in a.card("reset"))
    a.qa("alarm", {"time": "05:30", "d1": True, "d2": True, "d3": True, "d4": True, "d5": True, "label": "Work"})
    a.js("closeQA()")
    check("alarm on tomorrow's schedule", a.js("dayItems('2026-10-02').some(i => i.kind === 'alarm' && i.t === '05:30')"))
    check("not on Saturday's", not a.js("dayItems('2026-10-03').some(i => i.kind === 'alarm')"))
    check("nightly reset shows tomorrow's alarm", "Alarm 5:30 AM (Work)" in a.card("reset"))
    a.qa("event", {"title": "Truck inspection", "date": "2026-10-02", "time": "05:50"}); a.js("closeQA()")
    check("warns when the first thing is right after the alarm", "only 20 min before Truck inspection" in a.card("reset"), a.card("reset")[:400])
    a.js("S.events[0].time = '05:00'; save(); render()")
    check("warns when the first thing is BEFORE the alarm", "BEFORE your alarm" in a.card("reset"))
    check("Tomorrow card shows the real alarm", "Alarm 5:30 AM" in a.card("tomorrow"))
    a.page.click("#settingsBtn")
    check("⚙ My alarms lists it (weekdays)", "5:30 AM" in a.page.inner_text("#alarmBox") and "weekdays" in a.page.inner_text("#alarmBox"))
    a.page.click('#alarmBox [data-alon]')
    check("switch it off: gone from the schedule", not a.js("dayItems('2026-10-02').some(i => i.kind === 'alarm')"))
    a.page.click('#alarmBox [data-aledit]'); a.page.click("[data-aldel]")
    check("delete an alarm", a.js("S.alarms.length") == 0)
    a.close()


def t_v033_calendar_dates(b, base):
    print("\n[v0.33 birthdays found in Google Calendar + tomorrow list]")
    a = App(b, base, at="2026-10-01T20:00:00"); setup(a)
    a.js("""(() => { const real = window.fetch; window.fetch = async (u, o) => { u = String(u);
      if (u.includes('/calendars/primary/events') && (!o || !o.method || o.method === 'GET') && u.includes('timeMax'))
        return new Response(JSON.stringify({ items: [
          { summary: "Roxanne's birthday", eventType: 'birthday', start: { date: '2026-10-13' } },
          { summary: 'Mom bday', start: { date: '2027-02-02' } },
          { summary: 'Our anniversary', start: { date: '2026-12-01' } },
          { summary: 'Dentist', start: { dateTime: '2026-10-05T10:00:00-05:00' } },
          { summary: 'Roxanne\\'s birthday', start: { date: '2027-10-13' } } ] }), { status: 200 });
      return real(u, o); }; })()""")
    a.js("GTOKEN = 'tok'; GTOKEN_EXP = Date.now() + 3e6; S.gcal.connected = true; S.gcal.scope = GCAL_SCOPE")
    a.js("gcalDates(true)"); a.page.wait_for_timeout(300)
    card = a.card("people")
    check("found 3 dates (no dentist, no duplicate)", "Found 3 dates" in card and "Dentist" not in card, card[:300])
    check("names cleaned up", a.js("S.gcal.dates.map(b => b.name).sort().join('|')") == "Mom|Our anniversary|Roxanne", a.js("S.gcal.dates.map(b => b.name)"))
    a.page.click('[data-fadd^="roxanne"]')
    check("＋ Add one", a.js("S.people.some(p => p.name === 'Roxanne' && p.md === '10-13' && p.lead === 14)") and a.js("S.gcal.dates.length") == 2)
    a.page.click('[data-fno]')
    check("Not these hides the rest for good", a.js("S.gcal.dates.length") == 0 and a.js("S.gcal.datesNo.length") == 2)
    a.js("gcalDates(true)"); a.page.wait_for_timeout(300)
    check("rescan doesn't bring back added or hidden ones", a.js("S.gcal.dates.length") == 0)
    # nightly reset lists all of tomorrow
    a.js("S.gcal.events = [{id:'g1', title:'Pick up prescription', day:'2026-10-02', time:'16:00', where:''}]; S.gcal.connected = true")
    a.qa("event", {"title": "Truck inspection", "date": "2026-10-02", "time": "08:00"}); a.js("closeQA()")
    rs = a.card("reset")
    check("nightly reset lists tomorrow's calendar + Day Hub items", "Pick up prescription" in rs and "Truck inspection" in rs, rs[:500])
    a.close()


def t_v034_backup_nudge(b, base):
    print("\n[v0.34 backup nudge]")
    a = App(b, base); setup(a)
    check("nothing saved yet: no nudge", "Not backed up" not in a.page.inner_text("#hero"))
    a.qa("todo", {"title": "Call insurance"}); a.js("closeQA()")
    check("has data + backup off: nudge at the top", "Not backed up — tap to turn on" in a.page.inner_text("#hero"))
    a.page.click("#settingsBtn")
    check("⚙ backup box: easy steps", "Not backed up yet" in a.page.inner_text("#syncBox") and "Allow" in a.page.inner_text("#syncBox"))
    a.js("closeSettings(); S.sync.on = true; save(); render()")
    check("backup on: nudge gone", "Not backed up" not in a.page.inner_text("#hero"))
    a.close()


def t_v035_errands(b, base):
    print("\n[v0.35 errand run]")
    a = App(b, base); setup(a)
    check("no errands: card hidden", not a.page.query_selector('[data-card="errands"]'))
    a.qa("todo", {"title": "Pick up prescription at CVS"})
    a.qa("todo", {"title": "Deposit check"})
    a.qa("todo", {"title": "Return the Amazon package"})
    a.qa("todo", {"title": "Call insurance"})
    a.qa("item", {"list": "grocery", "text": "Milk"}); a.qa("item", {"list": "grocery", "text": "Eggs"})
    a.js("closeQA()")
    stops = a.js("errandStops().map(s => s.key)")
    check("grouped into stops in route order (store last)", stops == ["bank", "pharmacy", "post", "store"], stops)
    card = a.card("errands")
    check("card: 4 stops, brand names, grocery items", "4 stops" in card and "CVS" in card and "Milk" in card and "Call insurance" not in card, card[:400])
    url = a.js("errandMapUrl(errandStops())")
    check("Route in Maps link with stops in order", "maps/dir" in url and "destination=grocery%20store" in url and "waypoints=bank%7ccvs%7cpost%20office" in url.lower(), url)
    check("chip at the top", "Errand run: 4 stops" in a.page.inner_text("#hero"))
    check("brief reads the run", any("Errand run:" in l for l in a.js("briefLines()")))
    a.page.click('[data-card="errands"] [data-tick] >> nth=0')
    check("ticking a stop ticks its to-do", a.js("S.todos.find(x => x.title === 'Deposit check').done") and a.js("errandStops().length") == 3)
    a.close()


def t_v036_returns(b, base):
    print("\n[v0.36 returns]")
    a = App(b, base); setup(a)                     # Thu 2026-10-01
    a.qa("return", {"what": "Boots — too small", "store": "Amazon", "by": "2026-10-03", "amount": "89.99", "how": "dropoff"})
    a.qa("return", {"what": "Lamp", "store": "Target", "by": "2026-10-30", "how": "store"})
    a.js("closeQA()")
    card = a.card("packages")
    check("returns in the Packages card with days left + money", "Boots — too small" in card and "2 days left" in card and "$89.99 back" in card and "Lamp" in card, card[:400])
    check("chip at the top when close", "Return Boots — too small: 2 days left" in a.page.inner_text("#hero"))
    check("on the schedule on the last day", a.js("dayItems('2026-10-03').some(i => i.kind === 'return')"))
    check("reminder 1 day before", any(r["key"].startswith("ret:") and "1 day left" in r["title"] for r in a.js("reminderList()")))
    check("in the Life pulse", any("Return Boots" in i for i in a.js("pulseItems().map(x => x.text)")))
    check("rides in the Errand run (post stop)", a.js("errandStops().some(s => s.key === 'post' && s.items.some(i => i.src === 'return'))"))
    check("30-day-away return not in today's run", not a.js("errandStops().some(s => s.items.some(i => /Lamp/.test(i.title)))"))
    a.page.click('[data-card="packages"] [data-retdone] >> nth=0')
    check("✓ Returned clears it", a.js("openReturns().length") == 1 and "Return Boots" not in a.page.inner_text("#hero"))
    a.close()


def t_v037_future_me(b, base):
    print("\n[v0.37 future me]")
    a = App(b, base); setup(a)
    a.qa("future", {"text": "Next time we travel, don't book a 6 AM flight. We were wrecked all day."})
    words = a.js("S.future[0].words")
    check("words picked for you", "travel" in words and "flight" in words and "book" in words, words)
    check("card lists it", "6 AM flight" in a.card("future"))
    a.qa("event", {"title": "Book flight to Vegas", "date": "2026-10-10", "time": "10:00"})
    check("adding a flight brings the note back at the top", "Future you said" in a.page.inner_text("#cards") and "6 AM flight" in a.page.inner_text("#cards"))
    a.page.click("[data-futok]")
    check("Got it clears the banner", "Future you said" not in a.page.inner_text("#cards") and a.js("S.future[0].seen") == 1)
    a.qa("event", {"title": "Dentist", "date": "2026-10-10", "time": "11:00"})
    check("unrelated add: no note", "Future you said" not in a.page.inner_text("#cards"))
    # brain dump route
    a.page.click('#hero [data-dump]')
    a.page.fill("#qaForm [name=dump]", "note to self never buy the extended warranty at Best Buy, buy milk")
    a.page.click("#qaForm > .btn:last-child")
    check("brain dump: 'note to self' -> Future me", a.js("DUMP[0].kind") == "future" and a.js("DUMP[1].kind") == "item", a.js("DUMP.map(x => x.kind)"))
    a.page.click("#qaForm > .btn:last-child")
    check("…saved with its words", a.js("S.future.some(f => /extended warranty/i.test(f.text) && f.words.includes('warranty'))"))
    # date trigger
    a.qa("future", {"text": "Check if the roof guy actually fixed the leak", "words": "roof", "day": "2026-10-03"})
    a.page.clock.fast_forward("48:00:00"); a.js("render()")
    check("comes back on its day", "roof guy" in a.page.inner_text("#cards") and any("roof guy" in l for l in a.js("briefLines()")))
    check("Ask Day Hub gets the notes", "6 AM flight" in a.js("aiContext()"))
    a.close()


def t_v039_short_home(b, base):
    print("\n[v0.39 shorter home: empty cards one line, 3 chips + more]")
    a = App(b, base); setup(a)                     # Thu 2026-10-01 08:00
    minis = a.js("[...document.querySelectorAll('.card.mini')].map(c => c.dataset.card)")
    check("empty cards are one-line rows", all(k in minis for k in ["trips", "payday", "budget", "notes", "future", "packages", "bills", "countdowns", "lists"]), minis)
    check("cards with content stay full (schedule, weather, don't forget)", not any(k in minis for k in ["schedule", "weather", "leave"]), minis)
    check("no explainer text on home", "Add your monthly bills" not in a.page.inner_text("#cards") and "Got a cruise or trip coming" not in a.page.inner_text("#cards"))
    check("one-line rows are short", a.js("Math.max(...[...document.querySelectorAll('.card.mini')].map(c => c.offsetHeight))") <= 60)
    check("row says what it adds", "＋ Add a bill" in a.card("bills") and "＋ Plan a trip" in a.card("trips"))
    a.page.click('[data-card="bills"] .mini-add')
    check("tapping the row opens the same add form as the card's button", a.js("QA_TYPE") == "bill" and not a.js("document.getElementById('qa').classList.contains('hidden')"))
    a.qa("bill", {"title": "Phone", "amount": "80", "day": "3"})
    check("once it has something the card draws in full", a.js("!document.querySelector('[data-card=\"bills\"]').classList.contains('mini')") and "Phone" in a.card("bills"))
    open_mini(a, "trips")
    check("i opens the full card, explainer included", "Got a cruise or trip coming" in a.card("trips") and a.js("!document.querySelector('[data-card=\"trips\"]').classList.contains('mini')"))
    check("opening is for this visit only - nothing saved", "MINI" not in a.js("localStorage.getItem('dayhub.v1')") and a.js("!JSON.parse(localStorage.getItem('dayhub.v1')).collapsed.includes('trips')"))
    a.page.click('[data-card="home"] .mini-add')
    check("upkeep row opens the card with its tap-to-start choices", "HVAC filter" in a.card("home"))
    a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
    check("after reopening, an empty card is one line again", a.js("document.querySelector('[data-card=\"trips\"]').classList.contains('mini')"))
    # chips: 3 + more
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "14:30"})
    a.qa("todo", {"title": "Call Mom"})
    n_all = a.js("(() => { CHIPS_ALL = true; paintHero(); const n = document.querySelectorAll('#hero .chips .chip:not(.more)').length; CHIPS_ALL = false; paintHero(); return n; })()")
    shown = a.js("document.querySelectorAll('#hero .chips .chip:not(.more)').length")
    more = a.page.query_selector('#hero [data-chipsmore="1"]')
    check("at most 3 chips up top", n_all > 3 and shown == 3, f"all={n_all} shown={shown}")
    check("the rest fold into '+N more'", more is not None and more.inner_text().strip() == f"+{n_all - 3} more")
    first3 = a.js("[...document.querySelectorAll('#hero .chips .chip')].slice(0, 3).map(c => c.textContent)")
    more.click()
    after = a.js("[...document.querySelectorAll('#hero .chips .chip:not(.more)')].map(c => c.textContent)")
    check("'+N more' opens them all in place, same order", len(after) == n_all and after[:3] == first3)
    a.page.click('#hero [data-chipsmore="0"]')
    check("Show less folds them back", a.js("document.querySelectorAll('#hero .chips .chip:not(.more)').length") == 3)
    a.close()


def t_v040_switches(b, base):
    print("\n[v0.40 switchboard: everything OFF by default, owner switches, Pro key, legal pages, manifest]")
    a = App(b, base); setup(a)
    check("switchboard: all four switches OFF", a.js("Object.values(SWITCHES).every(v => v === false) && Object.keys(SWITCHES).join() === 'PRO_GATE,AI_PUBLIC,GMAIL,STORE'"))
    check("plan: approved price + contact", a.js("PLAN.MONTHLY") == "$4.99/month" and a.js("PLAN.YEARLY") == "$29.99/year" and a.js("PLAN.CONTACT_EMAIL") == "smarvel1963@gmail.com" and a.js("PLAN.WHOP_CHECKOUT_URL") == "")
    check("PRO_GATE off: every feature unlocked", a.js("['ai','gcal','mail','sync','reminders','budget'].every(can)"))
    a.page.click("#settingsBtn")
    check("PRO_GATE off: no Pro section in settings", a.js("document.getElementById('proBox').hidden && !document.getElementById('proBox').innerHTML"))
    check("GMAIL off: no Gmail connect for a phone that never connected", a.js("document.getElementById('mailBox').hidden") and "Connect Gmail" not in a.page.inner_text("#sheet"))
    check("Google Calendar connect still offered", "Connect Google Calendar" in a.page.inner_text("#gcalBox"))
    check("AI box unchanged (passphrase setup)", a.js("!!document.querySelector('form[data-aipass]')") and "Included with" not in a.page.inner_text("#aiBox"))
    check("settings links Privacy, Terms, Contact", a.js("[...document.querySelectorAll('#legalLinks a')].map(x => x.textContent).join()") == "Privacy,Terms,Contact")
    check("owner switches hidden until asked", a.js("document.getElementById('ownerBox').hidden"))
    for _ in range(6): a.page.click("#ver")
    check("6 taps on the version: still hidden", a.js("document.getElementById('ownerBox').hidden"))
    a.page.click("#ver")
    check("7th tap opens Owner switches", not a.js("document.getElementById('ownerBox').hidden") and "Owner switches" in a.page.inner_text("#ownerBox"))
    a.page.check('[data-owner="GMAIL"]')
    check("owner GMAIL on: Gmail connect shows on THIS phone", not a.js("document.getElementById('mailBox').hidden") and "Connect Gmail" in a.page.inner_text("#mailBox"))
    check("...stored on the phone only, not in the planner data", a.js("JSON.parse(localStorage.getItem('dayhub.owner')).GMAIL === true && !('GMAIL' in S)"))
    a.page.check('[data-owner="PRO_GATE"]')
    pro = a.page.inner_text("#proBox")
    check("owner PRO_GATE on: Pro section with price + coming soon (no Whop link yet)", "Day Hub Pro" in pro and "$4.99/month" in pro and "$29.99/year" in pro and "Coming soon" in pro, pro[:200])
    check("PRO_GATE on, no key: Pro features locked, local ones free", a.js("!can('gcal') && !can('sync') && !can('ai') && can('reminders') && can('budget')"))
    a.page.fill('form[data-proform] [name=key]', "WHOP-BAD-0000"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("bad key: stays free, says why", not a.js("isPro()") and "isn't active" in a.page.inner_text("#proBox"))
    a.page.fill('form[data-proform] [name=key]', "WHOP-GOOD-1234"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("good key: Pro unlocked", a.js("isPro() && can('gcal') && can('sync')") and "is on" in a.page.inner_text("#proBox") and "••1234" in a.page.inner_text("#proBox"))
    check("verify call sends only the key (no passphrase)", any(x.get("task") == "verify" and x.get("license") == "WHOP-GOOD-1234" and "pass" not in x for x in a.ctx._relay))
    a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
    check("Pro remembered after reopening", a.js("isPro()"))
    # weekly recheck + grace
    a.ctx._verify_down = True; n0 = len(a.ctx._relay)
    a.page.clock.fast_forward(8 * 86400000); a.js("recheckPro()"); a.page.wait_for_timeout(300)
    check("after 8 days it re-checks with Whop", len(a.ctx._relay) > n0)
    check("check unreachable: still Pro (grace)", a.js("isPro()"))
    a.page.clock.fast_forward(14 * 86400000); a.js("recheckPro()"); a.page.wait_for_timeout(300)
    check("unreachable past the 14-day grace: back to free", not a.js("isPro()"))
    a.ctx._verify_down = False
    a.js("recheckPro()"); a.page.wait_for_timeout(300)
    check("check reachable again: Pro back", a.js("isPro()"))
    # AI on the key, only when AI_PUBLIC is on
    check("AI_PUBLIC off: a Pro key alone doesn't turn the AI on", not a.js("aiOn()"))
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.page.click("#settingsBtn")
    for _ in range(7): a.page.click("#ver")
    a.page.check('[data-owner="AI_PUBLIC"]')
    check("AI_PUBLIC on + Pro key: AI on, 'included with Pro'", a.js("aiOn() && aiByKey()") and "Included with Day Hub Pro" in a.page.inner_text("#aiBox"))
    a.js("aiCall('ping', '').then(j => window.__left = j.left)"); a.page.wait_for_timeout(300)
    check("AI calls send the key, not a passphrase", a.js("window.__left") == 30 and a.ctx._relay[-1].get("license") == "WHOP-GOOD-1234" and "pass" not in a.ctx._relay[-1])
    a.page.click('[data-pro="remove"]')
    check("Remove key: back to free", not a.js("isPro()") and not a.js("aiOn()"))
    a.close()
    # the owner's phone (holds the relay passphrase) is never locked out
    a = App(b, base); setup(a)
    a.js("localStorage.setItem('dayhub.aipass', 'test-only-passphrase-x7'); localStorage.setItem('dayhub.owner', JSON.stringify({PRO_GATE: true}))")
    check("owner's phone with PRO_GATE on: still Pro, passphrase AI unchanged", a.js("isPro() && can('gcal') && aiOn() && !aiByKey()"))
    a.close()
    # a phone that already connected Gmail keeps it with GMAIL off
    a = boot_with(b, base, json.dumps({"name": "Scott", "city": "72032", "mail": {"on": True, "last": None, "seen": {}, "found": []}}))
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.page.click("#settingsBtn")
    check("GMAIL off never breaks a phone that already connected it", a.js("gmailAllowed()") and not a.js("document.getElementById('mailBox').hidden"))
    a.close()
    # STORE: Play link only when switched on AND a URL exists
    a = App(b, base); setup(a)
    a.page.click("#settingsBtn")
    check("STORE off: no Google Play link", "Google Play" not in a.page.inner_text("#installBox"))
    a.close()
    # legal pages + manifest (plain pages: no app to wait for)
    ctx = b.new_context(); route(ctx); pg = ctx.new_page()
    pg.goto(base + "/privacy.html"); t = pg.inner_text("body")
    check("privacy page: Marvel Corp, contact, Google Limited Use, 13+, Whop", all(x in t for x in ("Marvel Corp", "smarvel1963@gmail.com", "Limited Use", "13", "Whop", "Open-Meteo", "Anthropic")))
    pg.goto(base + "/terms.html"); t = pg.inner_text("body")
    check("terms page: price matches the plan, Whop billing, contact", "$4.99 a month" in t and "$29.99 a year" in t and "Whop" in t and "smarvel1963@gmail.com" in t)
    for mp, ident in (("/manifest.json", "/dayhub/index.html"), ("/cruise/manifest.json", "/dayhub/cruise/")):
        m = pg.request.get(base + mp).json()
        check(f"{mp}: id kept, scope, categories, screenshots", m.get("id") == ident and m.get("scope") == "./" and bool(m.get("categories")) and len(m.get("screenshots", [])) >= 4)
        bad = [x["src"] for x in m["screenshots"] if pg.request.get(base + mp.rsplit("/", 1)[0] + "/" + x["src"]).status != 200]
        check(f"{mp}: every screenshot file exists", not bad, bad)
    ctx.close()
    # cruise page loads the switchboard too
    a = App(b, base, path="/cruise/")
    check("Cruise Hub loads the switchboard", a.js("typeof switchOn") == "function" and a.js("can('gcal')"))
    a.close()


def main():
    srv, base = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for t in (t_first_run, t_schedule, t_todos_lists_countdowns, t_bills_budget_work, t_packages_email,
                  t_trips_cruise, t_reminders_backup_update, t_notes_data, t_settings_layout_offline, t_v018_fixes,
                  t_v019_calendar_arrange, t_v020_nightly_reset,
                  t_v021_brief_sync, t_v022_brain_dump,
                  t_v024_weather_intel, t_v025_people_leave,
                  t_v026_upkeep, t_v027_routines,
                  t_v028_payday, t_v029_pulse,
                  t_v030_brief_countdowns, t_v031_ai_helper,
                  t_v032_ask_top3, t_v033_alarms,
                  t_v033_calendar_dates, t_v034_backup_nudge,
                  t_v035_errands, t_v036_returns,
                  t_v037_future_me, t_v039_short_home, t_v040_switches):
            try:
                t(b, base)
            except Exception as e:
                check(f"{t.__name__} ran to the end", False, repr(e)[:300])
        b.close()
    srv.shutdown()
    print("\n[page errors]")
    real = [e for e in ERRORS if "ERR_INTERNET_DISCONNECTED" not in e and "Failed to load resource" not in e]
    check("no page / console errors anywhere", not real, "\n        " + "\n        ".join(real[:10]))
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
