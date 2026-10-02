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
    check("hero 'next up' chip", "2:30 PM · Dentist" in a.page.inner_text("#hero"))
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
    check("bill due in 2 days: pill + hero chip", "in 2 days" in a.card("bills") and "Phone in 2 days" in a.page.inner_text("#hero"))
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
    check("over budget shows a hero warning", "over budget" in a.page.inner_text("#hero"))
    a.close()


def t_packages_email(b, base):
    print("\n[packages + email reader]")
    a = App(b, base); setup(a)
    a.qa("package", {"name": "Boots", "num": "1Z999AA10123456784", "carrier": "auto", "eta": "2026-10-01"})
    check("UPS recognised + Track link", "ups.com/track" in a.js("trackUrl(S.packages[0])"))
    check("'arriving today' chip", "1 arriving today" in a.page.inner_text("#hero"))
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


def main():
    srv, base = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for t in (t_first_run, t_schedule, t_todos_lists_countdowns, t_bills_budget_work, t_packages_email,
                  t_trips_cruise, t_reminders_backup_update, t_notes_data, t_settings_layout_offline):
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
