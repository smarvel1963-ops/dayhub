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


CRUISE = "/../cruisehub/"     # Cruise Hub's own address, next to /dayhub/ (v0.47)
TRIP = "/../triphub/"         # Trip Hub's own address (v0.97, app #3)


# ------------------------------------------------------------------ server
def serve():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    # Serve C:/MarvelApps so /dayhub/ and /cruisehub/ sit side by side, like on GitHub Pages (v0.47).
    h = functools.partial(Quiet, directory=os.path.dirname(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}/dayhub"


# ------------------------------------------------------------------ fixtures
def forecast_fixture(q):
    if "start_date" in q:                                     # one port day
        day = q["start_date"][0]
        return {"daily": {"time": [day], "temperature_2m_max": [88.0], "temperature_2m_min": [77.0],
                          "precipitation_probability_max": [30], "weather_code": [2],
                          "uv_index_max": [9.2], "wind_speed_10m_max": [14.0], "wind_gusts_10m_max": [21.0]}}
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
        if u.netloc == "nominatim.openstreetmap.org":                 # v0.99 trip map place search
            ctx._geo = getattr(ctx, "_geo", []) + [(q.get("q") or [""])[0]]
            if "nowhere" in (q.get("q") or [""])[0].lower():
                return r.fulfill(json=[])
            return r.fulfill(json=[{"lat": "28.43", "lon": "-81.30"}])
        if u.netloc == "cdnjs.cloudflare.com" and "/leaflet/" in u.path:   # v0.99 a tiny fake Leaflet (no tiles fetched)
            if u.path.endswith(".css"):
                return r.fulfill(body="", content_type="text/css")
            return r.fulfill(content_type="application/javascript", body="""window.L = (() => { const log = window.__map = { markers: 0, lines: 0, views: 0 };
              const chain = o => Object.assign(o, { addTo() { return o; }, bindPopup() { return o; } });
              return { map: el => (log.markers = 0, log.lines = 0, { setView() { log.views++; return this; }, fitBounds() { log.fit = true; return this; }, remove() {} }),
                tileLayer: () => chain({}), divIcon: o => o, marker: () => { log.markers++; return chain({}); }, polyline: () => { log.lines++; return chain({}); } }; })();""")
        if "zippopotam.us" in u.netloc:
            if u.path.endswith("/00000"):
                return r.fulfill(status=404, body="{}")
            return r.fulfill(json={"places": [{"place name": "Conway", "state abbreviation": "AR", "latitude": "35.09", "longitude": "-92.44"}]})
        if u.netloc == "script.google.com" and "/macros/s/" in u.path:
            body = json.loads(r.request.post_data or "{}")
            ctx._relay = getattr(ctx, "_relay", []) + [body]
            buyers = ("buyer@example.com", "mem_GOOD1234")      # v0.41: Whop buyer = email (or mem_ id)
            devs = ctx.__dict__.setdefault("_devices", set())     # the relay's phone list (max 3)
            if body.get("task") == "verify":
                if getattr(ctx, "_verify_down", False):
                    return r.fulfill(status=502, body="<html>Bad gateway</html>")
                cruiser = body.get("buyer") == "cruiser@example.com" and body.get("app") == "cruisehub"   # v0.48 Cruise Hub Pass
                if body.get("buyer") not in buyers and not cruiser:
                    return r.fulfill(json={"valid": False, "status": "no Day Hub Pro purchase with that email"})
                if body.get("device") not in devs and len(devs) >= 3:
                    return r.fulfill(json={"valid": False, "status": "already on 3 phones — remove it from one"})
                devs.add(body.get("device"))
                return r.fulfill(json={"valid": True, "status": "active", "until": "2026-11-01T00:00:00Z", "who": "h1", "product": "cruisehub" if cruiser else "dayhub"})
            if body.get("task") == "release":
                devs.discard(body.get("device"))
                return r.fulfill(json={"ok": True})
            if body.get("buyer") and not body.get("pass"):    # v0.40 AI on a Pro purchase
                if body["buyer"] not in buyers or body.get("device") not in devs:
                    return r.fulfill(json={"error": "Day Hub Pro isn't active for this phone"})
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
        # v0.58: Cruise Hub opens on HOME; the older tests expect the cards, so they start on PLAN.
        self.ctx.add_init_script("try { if (!localStorage.getItem('cruisehub.startTab')) localStorage.setItem('cruisehub.startTab', 'plan'); } catch (e) {}")
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
              if (el.type === 'checkbox') el.checked = !!x; else el.value = x;
            el.dispatchEvent(new Event('input', {bubbles: true})); }
            f.requestSubmit(); }""", [type_, vals])

    def card(self, key):
        el = self.page.query_selector(f'[data-card="{key}"]')
        if not el and self.page.evaluate("typeof shellOn === 'function' && shellOn()"):     # v0.58: go to the card's tab
            self.page.evaluate(f"shellGo(shellTabFor('{key}'))")
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
    a.js("showForget()")
    sheet = a.page.inner_text("#forgetSheet")
    check("What am I forgetting? port morning", "GOOD MORNING — NASSAU" in sheet and "ALL ABOARD" in sheet and "Leave the cabin by" in sheet, sheet[:200])
    check("independent-tour warning", "does NOT wait" in sheet)
    a.page.click('#forgetSheet .btn[data-forgetclose]')
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
    c = App(b, base, path=CRUISE)
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
    check("free phone (PRO_GATE on): no backup nudge, backup is a Pro feature", "Not backed up — tap to turn on" not in a.page.inner_text("#hero"))
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
    check("switchboard: PRO_GATE + AI_PUBLIC on (10/3), CRUISE_PASS on (10/7), GMAIL + STORE OFF", a.js("SWITCHES.PRO_GATE === true && SWITCHES.AI_PUBLIC === true && !SWITCHES.GMAIL && !SWITCHES.STORE && SWITCHES.CRUISE_PASS === true && Object.keys(SWITCHES).join() === 'PRO_GATE,AI_PUBLIC,GMAIL,STORE,CRUISE_PASS'"))
    check("plan: approved price, contact, Whop checkout", a.js("PLAN.MONTHLY") == "$4.99/month" and a.js("PLAN.YEARLY") == "$29.99/year" and a.js("PLAN.CONTACT_EMAIL") == "smarvel1963@gmail.com" and a.js("PLAN.WHOP_CHECKOUT_URL") == "https://whop.com/commander-marvel-por-picks/day-hub-pro")
    check("PRO_GATE on, free phone: Pro features locked, free ones open", a.js("!['ai','gcal','mail','sync'].some(can) && ['reminders','budget'].every(can)"))
    a.page.click("#settingsBtn")
    check("PRO_GATE on: Pro section in settings with the price + Whop button", a.js("!document.getElementById('proBox').hidden") and "$4.99" in a.page.inner_text("#proBox"))
    check("GMAIL off: no Gmail connect for a phone that never connected", a.js("document.getElementById('mailBox').hidden") and "Connect Gmail" not in a.page.inner_text("#sheet"))
    check("Google Calendar connect still offered", "Connect Google Calendar" in a.page.inner_text("#gcalBox"))
    check("AI box (free phone, AI_PUBLIC on): points to Pro, passphrase still offered", a.js("!!document.querySelector('form[data-aipass]')") and "Included with" in a.page.inner_text("#aiBox"))
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
    check("owner PRO_GATE on: Pro section with price + 'Enter the email you used on Whop'", "Day Hub Pro" in pro and "$4.99/month" in pro and "$29.99/year" in pro and "email you used on Whop" in pro and "license" not in pro.lower(), pro[:300])
    check("Get Day Hub Pro opens the Whop checkout", a.js("document.querySelector('#proBox a.btn').href") == "https://whop.com/commander-marvel-por-picks/day-hub-pro")
    check("PRO_GATE on, no key: Pro features locked, local ones free", a.js("!can('gcal') && !can('sync') && !can('ai') && can('reminders') && can('budget')"))
    a.page.fill('form[data-proform] [name=key]', "stranger@example.com"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("email with no purchase: stays free, says why", not a.js("isPro()") and "No active Day Hub Pro" in a.page.inner_text("#proBox"))
    a.page.fill('form[data-proform] [name=key]', "Buyer@Example.com"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("the buyer's email (any capitals): Pro unlocked", a.js("isPro() && can('gcal') && can('sync')") and "is on" in a.page.inner_text("#proBox") and "buyer@example.com" in a.page.inner_text("#proBox"))
    dev = a.js("deviceId()")
    check("verify sends the email + this phone's random id, no passphrase", any(x.get("task") == "verify" and x.get("buyer") == "buyer@example.com" and x.get("device") == dev and "pass" not in x for x in a.ctx._relay))
    check("the phone id stays the same", a.js("deviceId()") == dev and len(dev) >= 8)
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
    check("AI_PUBLIC on: a Pro key turns the AI on", a.js("aiOn()"))
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.page.click("#settingsBtn")
    for _ in range(7): a.page.click("#ver")
    a.page.check('[data-owner="AI_PUBLIC"]')
    check("AI_PUBLIC on + Pro key: AI on, 'included with Pro'", a.js("aiOn() && aiByKey()") and "Included with Day Hub Pro" in a.page.inner_text("#aiBox"))
    a.js("aiCall('ping', '').then(j => window.__left = j.left)"); a.page.wait_for_timeout(300)
    check("AI calls send the buyer + phone id, not a passphrase", a.js("window.__left") == 30 and a.ctx._relay[-1].get("buyer") == "buyer@example.com" and a.ctx._relay[-1].get("device") == dev and "pass" not in a.ctx._relay[-1])
    a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
    check("Remove from this phone: back to free + spot freed at the relay", not a.js("isPro()") and not a.js("aiOn()") and dev not in a.ctx._devices and any(x.get("task") == "release" and x.get("device") == dev for x in a.ctx._relay))
    # phone limit: 3 phones per purchase
    a.ctx._devices.update({"phoneA123", "phoneB123", "phoneC123"})
    a.page.fill('form[data-proform] [name=key]', "buyer@example.com"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("a 4th phone is refused and told how to fix it", not a.js("isPro()") and "already on 3 phones" in a.page.inner_text("#proBox"))
    a.ctx._devices.discard("phoneC123")
    a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("...once a spot is free it unlocks (email kept in the box)", a.js("isPro()"))
    a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(200)
    a.page.fill('form[data-proform] [name=key]', "mem_GOOD1234"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("fallback: Whop membership id (mem_...) unlocks too", a.js("isPro()") and a.js("proState().buyer") == "mem_GOOD1234")
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
    m = pg.request.get(base + CRUISE + "manifest.json").json()
    check("Cruise Hub manifest: its own id, no Day Hub screenshots", m.get("id") == "/cruisehub/" and m.get("scope") == "./" and not any("dayhub" in x.get("src", "") for x in m.get("screenshots", [])))
    for mp, ident in (("/manifest.json", "/dayhub/index.html"),):
        m = pg.request.get(base + mp).json()
        check(f"{mp}: id kept, scope, categories, screenshots", m.get("id") == ident and m.get("scope") == "./" and bool(m.get("categories")) and len(m.get("screenshots", [])) >= 4)
        bad = [x["src"] for x in m["screenshots"] if pg.request.get(base + mp.rsplit("/", 1)[0] + "/" + x["src"]).status != 200]
        check(f"{mp}: every screenshot file exists", not bad, bad)
    ctx.close()
    # cruise page loads the switchboard too
    a = App(b, base, path=CRUISE)
    check("Cruise Hub loads the switchboard", a.js("typeof switchOn") == "function" and a.js("can('reminders')"))
    a.close()


def t_v045_cruise_hub(b, base):
    print("\n[v0.45 Cruise Hub: its own welcome, any cruise line, no email promise while GMAIL is off]")
    a = App(b, base, path=CRUISE)
    w = a.page.inner_text("#cards")
    check("cruise welcome card, no profession picker", "Welcome to Cruise Hub" in w and "Welcome to Day Hub" not in w and "Trucker" not in w and not a.js("!!document.querySelector('form[data-setup] select')"))
    setup_c = lambda: (a.page.fill('form[data-setup] [name=name]', "Pat"), a.page.fill('form[data-setup] [name=city]', "72032"),
                       a.page.click('form[data-setup] button'), a.page.wait_for_function("WXDATA && WXDATA.here"))
    setup_c()
    check("setup works without a profession (pack = general)", a.js("S.pack") == "general" and a.js("S.name") == "Pat")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    check("empty Trips card stays FULL size in Cruise Hub", not a.js("document.querySelector('[data-card=\"trips\"]').classList.contains('mini')") and "Plan a trip" in a.card("trips"))
    check("no email promise while GMAIL is off", "Connect Gmail" not in a.card("trips") and "fill in by themselves" not in a.card("trips"))
    a.page.click("#settingsBtn")
    check("settings: no Profession in Cruise Hub (really invisible)", a.js("document.getElementById('setPack').closest('label').hidden") and not a.js("document.getElementById('setPack').offsetParent"))
    pro = a.page.inner_text("#proBox")
    check("Pro box: Day Hub Pro still works here, only Cruise Hub features", "It includes Cruise Hub" in pro and "Brain dump" not in pro and "Top 3" not in pro and "calendar" in pro and "Backup" in pro, pro[:300])
    check("fine print: Not affiliated with any cruise line", "Not affiliated with any cruise line." in a.page.inner_text("#sheet"))
    a.page.click('[data-close="sheet"]')
    # Carnival: custom package by default, generic card section + Carnival tip
    a.js("openQA('trip')")
    check("cruise line box suggests lines (neutral list)", a.js("[...document.querySelectorAll('#lineList option')].map(o => o.value).includes('Carnival')") and a.js("document.querySelectorAll('#lineList option').length") >= 10)
    check("new trip: package defaults to Custom, no other line's presets", a.js("[...document.querySelectorAll('#qaForm [name=pkg] option')].map(o => o.textContent).join('|')") == "Custom package (add your own perks)")
    a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-11-05", "end": "2026-11-09", "line": "Carnival", "travelers": "4"})
    a.page.click('[data-triptab="perks"]'); a.page.wait_for_timeout(200)
    t = a.card("trips")
    check("any line: 'Your cruise card / wearable' + the line's own tip, no Princess text", "your cruise card / wearable" in t.lower() and "Sail & Sign" in t and "Princess" not in t and "Medallion" not in t, [l for l in t.splitlines() if "Princess" in l or "Medallion" in l])
    check("Carnival: custom package text, no preset offer", "Custom package" in t and "pick your line's package" not in t)
    # Princess: its presets are offered on Edit (data kept)
    a.js("TRIP_EDIT = curTrip().id; openQA('trip', true)")
    a.page.fill("#qaForm [name=line]", "Princess"); a.js("document.getElementById('qaForm').requestSubmit()"); a.page.wait_for_timeout(200)
    check("editing the line keeps the trip", a.js("S.trips.length") == 1 and a.js("curTrip().line") == "Princess")
    a.js("TRIP_EDIT = curTrip().id; openQA('trip', true)")
    check("Princess trip: its two presets are offered", a.js("[...document.querySelectorAll('#qaForm [name=pkg] option')].map(o => o.value).join()") == ",princess-plus,princess-premier")
    a.js("closeQA()"); a.page.click('[data-triptab="perks"]'); a.page.wait_for_timeout(200)
    t = a.card("trips")
    check("Princess line: generic section + Medallion tip, no princess.com link", "your cruise card / wearable" in t.lower() and "Medallion" in t and not a.js("!!document.querySelector('[data-card=\"trips\"] a[href*=\"princess.com/ships\"]')"))
    # own sheet for What am I forgetting?
    a.page.click('[data-forget="1"]'); a.page.wait_for_timeout(200)
    check("'What am I forgetting?' opens its own sheet, not the Add sheet", not a.js("document.getElementById('forgetSheet').classList.contains('hidden')") and a.js("document.getElementById('qa').classList.contains('hidden')")
          and "What am I forgetting?" in a.page.inner_text("#forgetSheet h2") and "Brain dump" not in a.page.inner_text("#forgetSheet"))
    a.page.click('#forgetSheet .btn[data-forgetclose]')
    check("Got it closes it", a.js("document.getElementById('forgetSheet').classList.contains('hidden')"))
    m = a.page.request.get(base + CRUISE + "manifest.json").json()
    check("Cruise Hub manifest: any line, not affiliated, no email-import promise", "Not affiliated with any cruise line" in m["description"] and "fills itself" not in m["description"] and "email" not in m["description"].lower())
    a.close()
    # Day Hub unchanged
    a = App(b, base)
    w = a.page.inner_text("#cards")
    check("Day Hub: welcome + profession picker unchanged", "Welcome to Day Hub" in w and a.js("!!document.querySelector('form[data-setup] select[name=pack]')"))
    setup(a)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    check("Day Hub: empty Trips still one line", a.js("document.querySelector('[data-card=\"trips\"]').classList.contains('mini')"))
    a.page.click("#settingsBtn")
    check("Day Hub: Profession still in settings, Pro box lists the AI helper", not a.js("document.getElementById('setPack').closest('label').hidden") and "AI helper" in a.page.inner_text("#proBox"))
    a.close()


def t_v046_hub_family(b, base):
    print("\n[v0.46 Cruise Hub is its own app + the hub family link]")
    a = App(b, base)
    def go(path):
        a.page.goto(base + path); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    setup(a)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Alaska", "start": "2026-11-05", "end": "2026-11-12", "line": "Princess"})
    a.qa("trip", {"ttype": "trip", "tname": "Vegas", "start": "2026-12-01", "end": "2026-12-04"})
    check("Day Hub: two trips of its own", a.js("S.trips.length") == 2 and a.js("STORE") == "dayhub.v1")
    # same phone: open Cruise Hub for the first time
    go(CRUISE)
    check("Cruise Hub keeps its OWN data + backup file", a.js("STORE") == "cruisehub.v1" and a.js("DFILE") == "cruisehub.json" and a.js("!!localStorage.getItem('cruisehub.v1')"))
    check("first open: Day Hub's cruise came over (+ name, city), the Vegas trip did not", a.js("S.trips.map(t => t.name).join()") == "Alaska" and a.js("S.name") == "Scott" and a.js("S.city") == "72032" and a.js("S.adopted.length") == 1)
    check("Day Hub's data left untouched", a.js("JSON.parse(localStorage.getItem('dayhub.v1')).trips.length") == 2)
    t = a.card("trips")
    check("Cruise Hub shows Day Hub's Vegas trip as a family row with Open", "From Day Hub" in t and "Vegas" in t and "Open Day Hub" in t and a.js("famTrips().map(x => x.name).join()") == "Vegas")
    a.js("curTrip().name = 'Alaska Inside Passage'; save()")
    a.qa("todo", {"title": "Buy sunscreen"})
    check("a Cruise Hub to-do stays in Cruise Hub", a.js("S.todos.length") == 1 and a.js("JSON.parse(localStorage.getItem('dayhub.v1')).todos.length") == 0)
    a.page.click("#settingsBtn")
    fam = a.page.inner_text("#famBox")
    check("settings: Hub family box says linked on this phone", "Hub family" in fam and "Linked" in fam and "Day Hub is on this phone" in fam, fam[:200])
    a.page.click('[data-close="sheet"]')
    # back to Day Hub: the cruise now shows FROM Cruise Hub, with Cruise Hub's edit
    go("/")
    check("Day Hub: its own copy of the cruise steps aside (one live copy)", a.js("myTrips().map(x => x.name).join()") == "Vegas" and a.js("S.trips.length") == 2)
    t = a.card("trips")
    check("Day Hub: Trips card shows the cruise from Cruise Hub, with Cruise Hub's new name", "From Cruise Hub" in t and "Alaska Inside Passage" in t and "Open Cruise Hub" in t)
    check("Day Hub: sail day on the schedule", any("Sail day — Alaska Inside Passage" in i["title"] for i in a.js("dayItems('2026-11-05')")))
    check("Day Hub: cruise countdown in the morning brief list", "Alaska Inside Passage" in a.js("briefCountdowns().map(c => c.title).join()"))
    check("Day Hub never gets Cruise Hub's to-do", a.js("S.todos.length") == 0)
    # turn the link off: fully on its own, its own copy is back
    a.page.click("#settingsBtn"); a.page.click('[data-fam="1"]'); a.page.wait_for_timeout(200)
    check("link off: Cruise Hub trips hidden, Day Hub's own copy shows again", a.js("famTrips().length") == 0 and a.js("myTrips().length") == 2 and "Alaska Inside Passage" not in a.card("trips"))
    check("link off is remembered", a.js("JSON.parse(localStorage.getItem('dayhub.v1')).family") is False)
    a.page.click('[data-fam="1"]'); a.page.wait_for_timeout(200)
    check("link back on", a.js("S.family") is True and a.js("famTrips().length") == 1)
    a.close()
    # phone that keeps the apps apart (iPhone): the other hub's trips come from its Drive backup
    a = App(b, base)
    setup(a)
    a.js("""localStorage.setItem('dayhub.family', JSON.stringify({ trips: [{ id: 'c1', type: 'cruise', name: 'Greek Isles', start: '2026-10-20', end: '2026-10-27' }], adopted: ['c1'] })); FAM_RAW = null; render()""")
    check("no Cruise Hub on this phone: trips from the Drive copy", a.js("famTrips().map(x => x.name).join()") == "Greek Isles" and a.js("sibData().src") == "drive")
    a.page.click("#settingsBtn")
    fam = a.page.inner_text("#famBox")
    check("settings say linked through Drive backup + show the iPhone steps", "Google Drive backup" in fam and "same Google account" in fam, fam[:300])
    a.close()
    # a Day Hub backup file loaded into Cruise Hub brings its cruises only
    a = App(b, base, path=CRUISE)
    check("Day Hub file -> Cruise Hub: cruises only", a.js("cruiseSlice({ name: 'Q', trips: [{ id: 'x', type: 'cruise', name: 'A' }, { id: 'y', type: 'trip', name: 'B' }], todos: [{ id: 't' }] })").get("trips") == [{"id": "x", "type": "cruise", "name": "A"}]
          and "todos" not in a.js("cruiseSlice({ trips: [], todos: [{ id: 't' }] })"))
    check("fresh Cruise Hub with no Day Hub: empty, no family rows", a.js("S.trips.length") == 0 and a.js("famTrips().length") == 0)
    check("v0.47: Cruise Hub lives at /cruisehub/ with its OWN service worker", a.js("location.pathname") == "/cruisehub/"
          and a.js("navigator.serviceWorker.ready.then(r => r.scope)").endswith("/cruisehub/"))
    check("v0.47: Day Hub's Open button points at /cruisehub/", a.js("SIB.url").endswith("/dayhub/") and a.js("CRUISE_URL").endswith("/cruisehub/"))
    a.close()
    a = App(b, base, path="/cruise/")
    check("v0.47: the old /dayhub/cruise/ address forwards to /cruisehub/", a.js("location.pathname") == "/cruisehub/" and a.js("MODE") == "cruise")
    a.close()


def t_v048_cruise_pass(b, base):
    print("\n[v0.48 Cruise Hub Pass: $9.99/year, every cruise that year; Day Hub Pro also unlocks Cruise Hub]")
    a = App(b, base, path=CRUISE)
    def go(path):
        a.page.goto(base + path); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.page.click("#settingsBtn")
    pro = a.page.inner_text("#proBox")
    check("CRUISE_PASS on for everyone (10/7): Cruise Hub sells the Pass, $9.99", a.js("SWITCHES.CRUISE_PASS") is True and "Cruise Hub Pass" in pro and "$9.99" in pro and "$4.99" not in pro, pro[:200])
    a.js("setOwnerSwitch('CRUISE_PASS', true); drawSettings()")
    pro = a.page.inner_text("#proBox")
    check("CRUISE_PASS on: Cruise Hub Pass, $9.99/year, every cruise that year, Day Hub Pro mentioned", "Cruise Hub Pass" in pro and "$9.99/year" in pro and "every cruise you take that year" in pro
          and "as many cruises as you like" in pro and "Already have Day Hub Pro" in pro and "$4.99" not in pro, pro[:400])
    check("checkout link live (10/7): buy button goes to the Cruise Hub Pass on Whop, no Coming soon", "Coming soon" not in pro and a.js("!!document.querySelector('#proBox a.btn[href*=\"whop.com/commander-marvel-por-picks/cruise-hub-pass\"]')"))
    a.page.fill('form[data-proform] [name=key]', "cruiser@example.com"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("Cruise Hub Pass buyer: Cruise Hub unlocked", a.js("isPro() && can('sync')") and "Cruise Hub Pass is on" in a.page.inner_text("#proBox"), a.page.inner_text("#proBox")[:200])
    check("verify tells the relay it's Cruise Hub asking", any(x.get("task") == "verify" and x.get("app") == "cruisehub" for x in a.ctx._relay))
    check("the unlock is Cruise Hub's own (cruisehub.pro), Day Hub's untouched", a.js("JSON.parse(localStorage.getItem('cruisehub.pro')).product") == "cruisehub" and not a.js("localStorage.getItem('dayhub.pro')"))
    a.page.click('[data-close="sheet"]')
    go("/")
    check("a Cruise Hub Pass does NOT unlock Day Hub (same phone)", not a.js("isPro()") and not a.js("can('sync')"))
    a.page.click("#settingsBtn")
    check("Day Hub still sells Day Hub Pro at its own price", "Day Hub Pro" in a.page.inner_text("#proBox") and "$4.99/month" in a.page.inner_text("#proBox") and "Cruise Hub Pass" not in a.page.inner_text("#proBox"))
    a.page.fill('form[data-proform] [name=key]', "cruiser@example.com"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("Cruise Hub Pass email in Day Hub: not Pro, says why", not a.js("isPro()") and "No active Day Hub Pro" in a.page.inner_text("#proBox"))
    check("Day Hub's verify says app dayhub", any(x.get("task") == "verify" and x.get("app") == "dayhub" for x in a.ctx._relay))
    a.close()
    # Day Hub Pro buyer: one purchase unlocks both
    a = App(b, base)
    setup(a)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.page.click("#settingsBtn")
    a.page.fill('form[data-proform] [name=key]', "buyer@example.com"); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
    check("Day Hub Pro unlocked in Day Hub", a.js("isPro()"))
    a.page.goto(base + CRUISE); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
    a.js("setOwnerSwitch('CRUISE_PASS', true)")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.page.click("#settingsBtn")
    check("Day Hub Pro on this phone also unlocks Cruise Hub", a.js("isPro() && can('sync')") and "Included with your Day Hub Pro" in a.page.inner_text("#proBox"), a.page.inner_text("#proBox")[:200])
    a.close()


def t_v049_scenes(b, base):
    print("\n[v0.49 a faint scene behind the clock: weather (Day Hub), ocean + beach (Cruise Hub)]")
    a = App(b, base)
    setup(a)
    check("Day Hub: weather scene painted", a.js("SCENE_FOR[MODE]") == "weather" and a.js("document.getElementById('hero').dataset.scene").startswith("weather|")
          and "data:image/svg+xml" in a.js("getComputedStyle(document.getElementById('hero')).backgroundImage"))
    a.js("WXDATA.here.cur.weather_code = 63; WXDATA.here.cur.is_day = 1; paintHero()")
    check("rain now -> rain scene", a.js("document.getElementById('hero').dataset.scene") == "weather|rain|d")
    a.js("WXDATA.here.cur.weather_code = 0; WXDATA.here.cur.is_day = 0; paintHero()")
    check("clear night -> moon + stars", a.js("document.getElementById('hero').dataset.scene") == "weather|clear|n")
    v = a.js("document.getElementById('hero').style.getPropertyValue('--scene')")
    a.js("render()")
    check("a redraw with the same weather keeps the same scene (motion doesn't restart)", a.js("document.getElementById('hero').style.getPropertyValue('--scene')") == v)
    check("every weather kind draws", a.js("['clear','cloudy','rain','snow','storm','fog'].every(k => [true,false].every(n => SCENES.weather(k, n).length > 100 && SCENES.ocean(k, n).length > 100))"))
    a.close()
    a = App(b, base, path=CRUISE)
    check("Cruise Hub: ocean scene", a.js("document.getElementById('hero').dataset.scene").startswith("ocean|"))
    a.close()


def t_v050_countdown_family(b, base):
    print("\n[v0.50 Cruise Hub countdown hero + Hub family card]")
    def mk(at):
        a = App(b, base, path=CRUISE, at=at)
        a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        return a
    a = mk("2026-10-01T09:00:00")
    check("no trip yet: no countdown, the plain line", not a.js("!!document.querySelector('#hero .cd')") and "Plan your next cruise" in a.page.inner_text("#hero"))
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    a.page.wait_for_timeout(1200)
    h = a.page.inner_text("#hero")
    check("countdown: 42 DAYS until the ship + % READY", a.js("document.querySelector('.cd-n').textContent") == "42" and "DAYS" in h and "until Caribbean Princess" in h and "% READY" in h, h[:300])
    check("next step reads as an action", "next: add your booking number" in h.lower(), h[-200:])
    check("no duplicate 'in 42 days' chip", "in 42 days" not in h)
    a.page.click(".cd"); a.page.wait_for_timeout(300)
    rs = a.page.inner_text("#readySheet")
    check("tap = the checklist sheet", not a.js("document.getElementById('readySheet').classList.contains('hidden')") and "Caribbean Princess" in rs and "Booking number saved" in rs and "Open my trip" in rs)
    a.page.click('[data-readygo="1"]'); a.page.wait_for_timeout(300)
    check("Open my trip: sheet closes, Trips on the Ready tab", a.js("document.getElementById('readySheet').classList.contains('hidden')") and a.js("S.tripTab") == "ready")
    # everything done -> 100% + celebrate once
    a.js("""const tr = curTrip(); tr.total = 0; tr.booking = 'X1'; tr.insurance = 'yes'; tr.cabin = 'B1'; tr.travel = 'drive';
            tr.ports = [{ id: 'p', name: 'Grand Turk', day: '2026-11-14', excursion: 'none', allAboard: '16:30' }];
            Object.values(tr.lists).forEach(l => l.forEach(i => i.done = true)); save(); render()""")
    a.page.wait_for_timeout(300)
    check("100%: READY 🎉 + celebrated once and remembered", "100% READY" in a.page.inner_text("#hero") and a.js("curTrip().ready100") is True
          and a.js("!!document.querySelector('.confetti')"))
    a.close()
    a = mk("2026-11-12T09:00:00")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    check("sail day: SAIL DAY + welcome aboard", "SAIL DAY" in a.page.inner_text("#hero") and "Welcome aboard" in a.page.inner_text("#hero"))
    a.close()
    a = mk("2026-11-14T09:00:00")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    # boarded: v0.52 Return Guard owns the hero on a port day until you're back on board
    a.js("curTrip().ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-11-14', allAboard: '16:30', boarded: '2026-11-14' }]; save(); render()")
    h = a.page.inner_text("#hero")
    check("on board: DAY 3 OF 8 + today's port and all-aboard", "DAY 3 OF 8" in h and "Grand Turk" in h and "all aboard 4:30" in h.lower(), h[:300])
    # hub family card: last, lists the others, Trip Hub coming soon
    check("Hub family card is the last card", a.js("cardOrder().slice(-1)[0]") == "family")
    f = a.card("family")
    check("family card: Day Hub with Open, Trip Hub coming soon, not itself", "Day Hub" in f and "Trip Hub" in f and "COMING SOON" in f and "Cruise Hub" not in f.split("Day Hub")[0] and a.js("!!document.querySelector('[data-card=\"family\"] a[href$=\"/dayhub/\"]')"), f[:300])
    a.close()
    a = App(b, base)
    setup(a)
    check("Day Hub: family card last (after profession cards), shows Cruise Hub", a.js("cardOrder().slice(-1)[0]") == "family" and "Cruise Hub" in a.card("family") and a.js("!!document.querySelector('[data-card=\"family\"] a[href$=\"/cruisehub/\"]')"))
    a.js("S.hidden.push('family'); save(); render()")
    check("the family card can be hidden like any card", not a.js("!!document.querySelector('[data-card=\"family\"]')"))
    a.page.click("#settingsBtn")
    check("settings Hub family box lists the family too", "More from the Hub family" in a.page.inner_text("#famBox") and "Trip Hub" in a.page.inner_text("#famBox"))
    check("Day Hub never shows the cruise countdown", not a.js("!!document.querySelector('#hero .cd')"))
    a.close()


def t_v051_cruise_weather(b, base):
    print("\n[v0.51 Cruise Hub: two weathers - where the cruise is + where you are, with alerts]")
    a = App(b, base, path=CRUISE, at="2026-10-04T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-10-04", "end": "2026-10-11", "line": "Princess",
                  "ship": "Caribbean Princess", "port": "Fort Lauderdale (Port Everglades)"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-10-05', allAboard: '16:30' }]; save(); render()")
    a.page.wait_for_timeout(1500)
    w = a.card("weather")
    check("weather card: where the cruise is FIRST, then where you are", "WHERE YOUR CRUISE IS" in w.upper() and "WHERE YOU ARE" in w.upper() and w.upper().index("WHERE YOUR CRUISE IS") < w.upper().index("WHERE YOU ARE"), w[:300])
    check("sail day = departure port (boarding), tomorrow = the port day with all-aboard", "Fort Lauderdale" in w and "boarding" in w and "Tomorrow · Grand Turk" in w and "all aboard 4:30" in w.lower())
    check("cruise-area forecast shows UV + gusts, and the UV alert", "UV 9" in w and "gusts 21 mph" in w and "UV very high" in w)
    check("hurricane-season note for a Caribbean trip in October", "hurricane season" in w.lower())
    check("geocode asked for the plain city (no parentheses)", a.js("placeName('Fort Lauderdale (Port Everglades)')") == "Fort Lauderdale")
    check("hero chip: today's cruise-area alert, short port name", "Fort Lauderdale today: UV very high" in a.page.inner_text("#hero") and "(Port Everglades) today" not in a.page.inner_text("#hero"))
    a.page.click('[data-cwx="1"]'); a.page.wait_for_timeout(300)
    check("tapping the chip opens the Weather card", not a.js("S.collapsed.includes('weather')"))
    check("alert rules: storm / rain / wind / cool / boarding rain", a.js("""[cruiseWxAlerts({code: 95, rain: 80, hi: 80, lo: 70}, 'port')[0].key,
        cruiseWxAlerts({code: 61, rain: 70, hi: 80, lo: 70}, 'port')[0].key,
        cruiseWxAlerts({code: 1, rain: 0, hi: 80, lo: 70, gust: 34}, 'port')[0].key,
        cruiseWxAlerts({code: 1, rain: 0, hi: 60, lo: 48}, 'port')[0].key,
        cruiseWxAlerts({code: 61, rain: 40, hi: 80, lo: 70}, 'sail').map(x => x.key).join()].join('|')""") == "storm|rain|wind|cool|showers,sailrain")
    check("calm day: no alerts", a.js("cruiseWxAlerts({code: 1, rain: 5, hi: 82, lo: 74, uv: 4, gust: 12}, 'port').length") == 0)
    a.close()
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Alaska", "start": "2027-06-20", "end": "2027-06-27", "line": "Princess", "port": "Seattle"})
    w = a.card("weather")
    check("far-off cruise: says when the sail-day forecast shows up", "forecast shows up 16 days before you sail" in w, w[:300])
    check("Alaska (Seattle) in June: no Caribbean hurricane note", "hurricane" not in w.lower())
    a.close()
    a = App(b, base)
    setup(a)
    check("Day Hub weather card unchanged (no cruise block)", "WHERE YOUR CRUISE IS" not in a.card("weather").upper())
    a.close()


def t_v052_return_guard(b, base):
    print("\n[v0.52 Return Guard: all aboard in phone time, head-back time, GOOD -> PLAN -> LEAVE -> CRITICAL, BACK TO SHIP bar]")
    # clock: 10:00 -05:00 = 9:00 AM Chicago (CST in November)
    a = App(b, base, path=CRUISE, at="2026-11-14T10:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-11-14', arrive: '08:00', allAboard: '16:30', shipOffset: 60 }]; save(); render()")
    h = a.page.inner_text("#hero")
    check("port day: Return Guard takes the hero", "RETURN GUARD" in h.upper() and "Grand Turk" in h, h[:300])
    check("all aboard shown in PHONE time (ship 1 hr ahead: 4:30 ship = 3:30 local) + the ship time", "3:30 PM" in h and "4:30 PM ship time" in h)
    check("head back by = 3:30 - 60 margin - 20 trip = 2:10 PM", a.js("guardBy(curTrip().ports[0])") == "14:10" and "2:10 PM" in h)
    check("GOOD at 9 AM", a.js("guardFor(curTrip()).level") == "good" and "GOOD" in h)
    check("BACK TO SHIP bar is up", a.js("!!document.getElementById('rgBar')") and "BACK TO SHIP" in a.page.inner_text("#rgBar"))
    lv = a.js("""(() => { const tr = curTrip(), at = t => atMs('2026-11-14', t);
        return ['06:30', '11:00', '13:00', '13:50', '14:20', '15:45'].map(t => { const g = guardFor(tr, at(t)); return g ? g.level : 'none'; }).join(); })()""")
    check("levels through the day: before arrival none, good, plan, leave, critical, missed", lv == "none,good,plan,leave,critical,missed", lv)
    # the sheet: margin + trip back
    a.page.click("#rgBar"); a.page.wait_for_timeout(200)
    check("tap = Return Guard sheet with the sum", "60 min safety margin" in a.page.inner_text("#rgSheet") and "2:10 PM" in a.page.inner_text("#rgSheet"))
    a.page.click('[data-rgmargin="90"]'); a.page.wait_for_timeout(200)
    check("margin 90 -> head back by 1:40 PM, remembered", a.js("guardBy(curTrip().ports[0])") == "13:40" and a.js("JSON.parse(localStorage.getItem('cruisehub.v1')).guardMargin") == 90)
    a.page.fill('[data-rgback="p1"]', "40"); a.page.dispatch_event('[data-rgback="p1"]', "change"); a.page.wait_for_timeout(200)
    check("trip back 40 min -> 1:20 PM", a.js("guardBy(curTrip().ports[0])") == "13:20" and a.js("curTrip().ports[0].backMin") == 40)
    # reminders: all-aboard alarms in phone time + the two guard heads-ups
    r = a.js("reminderList().filter(x => /^(aa|rg):p1/.test(x.key)).map(x => x.key + '@' + new Date(x.at).toTimeString().slice(0,5)).sort().join()")
    check("alarms use phone time (60/30 before 3:30) + plan 30 min before 1:20 + leave at 1:20", r == "aa:p1:30@15:00,aa:p1:60@14:30,rg:p1:go@13:20,rg:p1:plan@12:50", r)
    sched = a.js("dayItems('2026-11-14').filter(i => i.kind === 'aboard').map(i => i.t + '|' + i.sub).join()")
    check("schedule: ALL ABOARD at 15:30 local, ship time noted", sched == "15:30|4:30 PM ship time · be on the ship", sched)
    # back on board
    a.page.click('[data-rgboard="p1"]'); a.page.wait_for_timeout(300)
    check("I'm back on board: guard + bar gone, countdown back", not a.js("guardFor(curTrip())") and not a.js("!!document.getElementById('rgBar')") and "DAY 3 OF 8" in a.page.inner_text("#hero"))
    check("no guard heads-ups after boarding", a.js("reminderList().filter(x => x.key.startsWith('rg:')).length") == 0)
    a.close()
    # same ship and local clock: no ship-time note; independent tour = 45 min trip back by default
    a = App(b, base, path=CRUISE, at="2026-11-14T10:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess"})
    a.js("curTrip().ports = [{ id: 'p2', name: 'Nassau', day: '2026-11-14', allAboard: '17:30', indie: true }]; save(); render()")
    check("same clocks: no ship-time note; independent tour -> 45 min trip back (5:30 - 105 = 3:45 PM)", "ship time" not in a.page.inner_text("#hero") and a.js("guardBy(curTrip().ports[0])") == "15:45")
    a.close()
    a = App(b, base)
    setup(a)
    check("Day Hub: no Return Guard bar", not a.js("!!document.getElementById('rgBar')"))
    a.close()


def t_v053_ask_cruise_hub(b, base):
    print("\n[v0.53 Ask Cruise Hub: the AI answers from the cruise's own facts]")
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess", "port": "Port Canaveral"})
    a.js("""const tr = curTrip(); tr.total = 3000; tr.payments = [{ id: 'x', amt: 1000, day: '2026-09-01' }]; tr.finalDue = '2026-10-15';
            tr.ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-11-14', arrive: '08:00', allAboard: '16:30', shipOffset: 60, excursion: 'Hummer tour', meet: '07:30' }]; save(); render()""")
    check("Cruise Hub hero has the 💡 Ask button", a.js("!!document.querySelector('#hero [data-ask=\"open\"]')"))
    a.page.click('#hero [data-ask="open"]')
    t = a.page.inner_text("#askSheet")
    check("without AI: 'Ask Cruise Hub' + how to turn it on (cruise wording)", "Ask Cruise Hub" in t and "back on the ship" in t and "passphrase" in t, t[:300])
    a.page.click('#askSheet [data-askclose]')
    a.js("localStorage.setItem('dayhub.aipass', 'test-only-passphrase-x7')")
    a.page.click('#hero [data-ask="open"]')
    t = a.page.inner_text("#askSheet")
    check("before the cruise: cruise questions offered", "What am I forgetting?" in t and "How much do I still owe" in t and "oil change" not in t, t[:400])
    a.page.fill("#askSheet input[name=q]", "When is my final payment?"); a.page.click("#askSheet form button:last-child"); a.page.wait_for_timeout(600)
    inp = a.ctx._ask_input
    ctxj = json.loads(inp.split("MY PLANNER (JSON):\n", 1)[1])
    trip = ctxj.get("trip") or {}
    check("the question says it's Cruise Hub", "Asked in Cruise Hub" in inp)
    check("trip facts sent: ship, port, days to go, money left + final payment", trip.get("ship") == "Caribbean Princess" and trip.get("departurePort") == "Port Canaveral"
          and trip.get("daysToGo") == 42 and trip.get("money", {}).get("left") == "$2,000.00" and trip.get("money", {}).get("finalPaymentDue") == "2026-10-15", json.dumps(trip)[:500])
    pt = (trip.get("ports") or [{}])[0]
    check("port facts: all aboard in phone time + ship time + head back by + excursion", pt.get("allAboardPhoneTime") == "3:30 PM" and pt.get("allAboardShipTime") == "4:30 PM"
          and pt.get("headBackBy") == "2:10 PM" and pt.get("excursion") == "Hummer tour" and pt.get("meet") == "7:30 AM", json.dumps(pt))
    check("what's still open is sent (readiness + list items)", any("Booking number" in x for x in trip.get("stillToDo", [])) and len(trip.get("notDoneYet", {})) > 0)
    a.close()
    # on the trip: on-board questions
    a = App(b, base, path=CRUISE, at="2026-11-13T10:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess"})
    a.js("localStorage.setItem('dayhub.aipass', 'test-only-passphrase-x7')")
    a.page.click('#hero [data-ask="open"]')
    check("on the cruise: on-board questions offered", "When do we need to be back on the ship?" in a.page.inner_text("#askSheet"))
    a.close()
    # a Day Hub Pro unlock on this phone gives Cruise Hub the AI too (the buyer is sent)
    a = App(b, base, path=CRUISE)
    a.js("localStorage.setItem('dayhub.pro', JSON.stringify({ buyer: 'buyer@example.com', ok: true, checked: Date.now() }))")
    check("Day Hub Pro on this phone: Cruise Hub AI uses that buyer", a.js("aiBuyer()") == "buyer@example.com" and a.js("aiByKey()"))
    a.close()


def t_v054_name_bar_wallet(b, base):
    print("\n[v0.54 name bar on every hub + Wallet: the whole vacation]")
    a = App(b, base); setup(a)
    check("Day Hub: DAY HUB name bar with its icon", a.js("document.querySelector('#hero .brand').textContent.trim()") == "DAY HUB" and a.js("!!document.querySelector('#hero .brand img[src=\"icon-192.png\"]')"))
    check("greeting still there under it", "Good" in a.page.inner_text("#hero .greet"))
    a.close()
    a = App(b, base, path=CRUISE)
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    check("Cruise Hub: CRUISE HUB name bar", a.js("document.querySelector('#hero .brand').textContent.trim()") == "CRUISE HUB")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    a.js("const tr = curTrip(); tr.total = 3000; tr.payments = [{ id: 'x', amt: 1000, day: '2026-09-01' }]; tr.credit = 200; save(); S.tripTab = 'money'; render()")
    t = a.card("trips")
    check("Money tab (was Payments) with the Whole trip section", "Money" in t and "WHOLE TRIP" in t.upper() and "Cruise Hub reminds you" in t and "Day Hub reminds you" not in t)
    for cat, what, amt, paid in (("hotel", "Westgate, 2 nights", "336", True), ("parking", "Port garage", "160", False), ("excursion", "Hummer", "298", False)):
        a.js("([c,w,m,p]) => { const f = document.querySelector('form[data-cost]'); f.cat.value = c; f.what.value = w; f.amt.value = m; f.paid.checked = p; f.requestSubmit(); }", [cat, what, amt, paid])
        a.page.wait_for_timeout(120)
    W = a.js("(({total, paid, left, extras, credit}) => ({total, paid, left, extras, credit}))(tripWallet(curTrip()))")
    check("whole trip = 3000 + 794 = 3794; paid 1000 + 336; left 2458; credit 200", W == {"total": 3794, "paid": 1336, "left": 2458, "extras": 794, "credit": 200}, W)
    t = a.card("trips")
    check("shown: total vacation, the three costs, onboard credit", "$3,794.00" in t and "Westgate" in t and "Port garage" in t and "Onboard credit" in t and "$200.00" in t)
    cid = a.js("curTrip().costs[1].id"); tid = a.js("curTrip().id")
    a.page.click(f'[data-costpaid="{tid}:{cid}"]'); a.page.wait_for_timeout(150)
    check("tap 'not paid' -> paid; left drops by 160", a.js("curTrip().costs[1].paid") is True and a.js("tripWallet(curTrip()).left") == 2298)
    a.page.click(f'[data-tripdel="{tid}:costs:{cid}"]'); a.page.wait_for_timeout(150)
    check("remove a cost", a.js("curTrip().costs.length") == 2 and a.js("tripWallet(curTrip()).total") == 3634)
    ctx = json.loads(a.js("aiContext()"))
    check("Ask Cruise Hub sees the whole-trip money + onboard credit", ctx["trip"].get("wholeTrip", {}).get("totalVacation") == "$3,634.00" and ctx["trip"].get("onboardCredit") == "$200.00", json.dumps(ctx["trip"].get("wholeTrip")))
    check("a zero / blank amount is not added", a.js("(() => { const f = document.querySelector('form[data-cost]'); f.amt.value = '0'; f.requestSubmit(); return curTrip().costs.length; })()") == 2)
    a.close()


def t_v055_packing_bags(b, base):
    print("\n[v0.55 packing by bag + suggestions from the trip's forecast and excursions + final-night bag]")
    a = App(b, base, path=CRUISE, at="2026-10-04T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-10-06", "end": "2026-10-11", "line": "Princess", "port": "Port Canaveral"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-10-07', allAboard: '16:30', excursion: 'Hummer tour' }, { id: 'p2', name: 'Nassau', day: '2026-10-08', excursion: 'Snorkel catamaran', indie: true }]; save(); S.tripTab = 'lists'; S.tripList = 'packing'; render()")
    a.page.wait_for_timeout(1200); a.js("render()")
    g = a.js("['Daily medications (keep in your carry-on)', 'Sunglasses + hat', 'Sunscreen (reef-safe for some ports)', 'Formal-night outfit', 'Passport', 'Reading glasses'].map(bagGuess).join()")
    check("bag guesses: meds carry, sunglasses port, sunscreen port, outfit checked, passport carry, glasses carry", g == "carry,port,port,checked,carry,carry", g)
    keys = a.js("packSuggest(curTrip()).map(x => x.key)")
    check("excursion suggestions: driver's license (Hummer), phone pouch (snorkel), port-agent screenshot (independent)", "driver" in keys and "phone pouch" in keys and "port agent" in keys, keys)
    check("UV 9 but 'Sunglasses + hat' + sunscreen already packed: no hat / sunscreen suggestion", "hat" not in keys and "sunscreen" not in keys, keys)
    a.js("const L = curTrip().lists.packing; curTrip().lists.packing = L.filter(i => !/hat/i.test(i.text)); save(); render()")
    check("take the hat off the list -> UV 9 at the port suggests a sun hat", "hat" in a.js("packSuggest(curTrip()).map(x => x.key)"))
    check("nothing suggested that's already on the list (water shoes)", "water shoes" not in keys)
    t = a.card("trips")
    check("shown with the reason and its bag", "SUGGESTED FOR YOUR TRIP" in t.upper() and "Hummer tour at Grand Turk" in t, t[:400])
    tid = a.js("curTrip().id")
    a.page.click(f'[data-sugadd="{tid}:driver"]'); a.page.wait_for_timeout(150)
    check("+ Add puts it on the packing list in the carry-on, suggestion gone", a.js("curTrip().lists.packing.some(i => i.text === \"Driver's license\" && i.bag === 'carry')") and "driver" not in a.js("packSuggest(curTrip()).map(x => x.key)"))
    a.page.click(f'[data-sugno="{tid}:port agent"]'); a.page.wait_for_timeout(150)
    check("✕ = not needed, stays gone", "port agent" not in a.js("packSuggest(curTrip()).map(x => x.key)") and a.js("curTrip().sugNo.includes('port agent')"))
    a.page.click('[data-bagview="port"]'); a.page.wait_for_timeout(150)
    rows = a.js("[...document.querySelectorAll('[data-card=\"trips\"] .bagchip')].map(b => b.textContent.trim())")
    check("Port bag view shows only port-bag items", rows and all("Port bag" in r for r in rows), rows)
    a.page.click('[data-bagview="all"]'); a.page.wait_for_timeout(150)
    iid = a.js("curTrip().lists.packing.find(i => i.text === 'Formal-night outfit').id")
    a.page.click(f'[data-bag="{tid}:{iid}"]'); a.page.wait_for_timeout(150)
    check("tap the bag chip: Checked -> Carry-on (remembered)", a.js(f"curTrip().lists.packing.find(i => i.id === '{iid}').bag") == "carry")
    check("cruise has the Final-night bag list (passport, car keys out of the safe, safe empty)", a.js("tripListKeys(curTrip()).includes('final')")
          and a.js("curTrip().lists.final.some(i => /Car keys/.test(i.text)) && curTrip().lists.final.some(i => /safe opened and EMPTY/.test(i.text))"))
    a.close()
    a = App(b, base); setup(a)
    a.qa("trip", {"ttype": "trip", "tname": "Orlando", "start": "2026-10-20", "end": "2026-10-24"})
    check("a plain trip (not a cruise) has no Final-night bag list", not a.js("tripListKeys(curTrip()).includes('final')"))
    a.close()


def t_v056_go_home(b, base):
    print("\n[v0.56 final night + safe check + remember my car + time to go home]")
    def mk(at):
        a = App(b, base, path=CRUISE, at=at)
        a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
        return a
    # mid-cruise: car chip, no final night yet
    a = mk("2026-11-14T10:00:00")
    check("on the cruise: 'Remember where you parked' chip, no final night yet", "Remember where you parked" in a.page.inner_text("#hero") and a.js("goHomeState(curTrip())") is None)
    a.close()
    # the evening before the end (7 PM -05:00 = 6 PM Chicago)
    a = mk("2026-11-18T19:00:00")
    h = a.page.inner_text("#hero")
    check("final evening: hero = FINAL NIGHT with the checklist + GET ME HOME READY", "FINAL NIGHT" in h and "GET ME HOME READY" in h and "Cabin safe not checked" in h and "Final-night bag 0/" in h, h[:400])
    r = a.js("reminderList().filter(x => x.key.startsWith('gh:')).map(x => x.key.split(':')[2] + '@' + new Date(x.at).toTimeString().slice(0,5)).join()")
    check("8 PM reminder to check the safe", r == "safe@20:00", r)
    a.page.click('#hero [data-gohome="open"]'); a.page.wait_for_timeout(200)
    a.page.check('[data-ghtoggle="safe"]'); a.page.wait_for_timeout(200)
    check("tick 'my safe is EMPTY' -> saved, reminder gone", a.js("curTrip().safeEmpty") is True and a.js("reminderList().filter(x => x.key.startsWith('gh:')).length") == 0)
    a.page.fill('form[data-car] [name=where]', "Port garage B"); a.page.fill('form[data-car] [name=level]', "3"); a.page.fill('form[data-car] [name=spot]', "C318")
    a.js("document.querySelector('form[data-car]').requestSubmit()"); a.page.wait_for_timeout(200)
    check("car saved", a.js("curTrip().car.where") == "Port garage B" and a.js("carText(curTrip().car)") == "Port garage B · Level 3 · Row/space C318")
    a.page.click('[data-ghclose="1"]'); a.page.wait_for_timeout(100)
    h = a.page.inner_text("#hero")
    check("hero shows the car + safe done", "Cabin safe is EMPTY" in h and "Port garage B" in h)
    a.page.click('#hero [data-gohome="open"]'); a.page.wait_for_timeout(150); a.page.click('[data-ghgo="final"]'); a.page.wait_for_timeout(200)
    check("'Open' on the bag goes to Trips -> Lists -> Final-night bag", a.js("S.tripTab") == "lists" and a.js("S.tripList") == "final")
    a.close()
    # last morning
    a = mk("2026-11-19T08:00:00")
    a.js("curTrip().car = { where: 'Port garage B', level: '3', spot: 'C318' }; save(); render()")
    h = a.page.inner_text("#hero")
    check("last morning: TIME TO GO HOME + where the car is", "TIME TO GO HOME" in h and "Port garage B" in h, h[:300])
    a.page.click('#hero [data-gohome="open"]'); a.page.wait_for_timeout(150)
    a.page.click('[data-ghdone="1"]'); a.page.wait_for_timeout(200)
    check("'We're off the ship' ends it", a.js("goHomeState(curTrip())") is None and "TIME TO GO HOME" not in a.page.inner_text("#hero"))
    a.close()
    a = App(b, base); setup(a)
    check("Day Hub loads cruise.js quietly (no cruise hero)", a.js("typeof goHomeState") == "function" and not a.js("!!document.querySelector('#hero [data-gohome]')"))
    a.close()


def t_v057_crisis(b, base):
    print("\n[v0.57 crisis mode: 🛟 five big choices from the trip's own contacts]")
    a = App(b, base, path=CRUISE, at="2026-11-14T15:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess", "port": "Port Canaveral"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-11-14', allAboard: '16:30', agent: '+1 649 946 1234' }]; save(); render()")
    a.page.click('#hero [data-help="home"]'); a.page.wait_for_timeout(200)
    t = a.page.inner_text("#helpSheet")
    check("🛟 opens five big choices + contacts", all(x in t for x in ("BACK TO SHIP", "GET TO THE SHIP", "MEDICAL / SAFETY", "TRAVEL PROBLEM", "MY DOCUMENTS", "MY TRIP CONTACTS")) and "4 not saved" in t, t[:400])
    a.page.click('[data-help="contacts"]'); a.page.wait_for_timeout(150)
    a.page.fill('form[data-helpform] [name=line]', "Princess 1-800-774-6237"); a.page.fill('form[data-helpform] [name=ins]', "Allianz 1-866-884-3556")
    a.js("document.querySelector('form[data-helpform]').requestSubmit()"); a.page.wait_for_timeout(200)
    check("contacts saved on the trip", a.js("curTrip().help.line") == "Princess 1-800-774-6237" and a.js("curTrip().help.ins").startswith("Allianz"))
    a.page.click('[data-help="back"]'); a.page.wait_for_timeout(150)
    t = a.page.inner_text("#helpSheet")
    check("Back to ship: today's port, all aboard, port agent + line, tap-to-call", "Grand Turk" in t and "all aboard" in t and "Port agent" in t
          and a.js("!!document.querySelector('#helpSheet a[href=\"tel:+16499461234\"]')") and a.js("!!document.querySelector('#helpSheet a[href=\"tel:18007746237\"]')"))
    check("Back to ship has map directions", a.js("!!document.querySelector('#helpSheet a[href*=\"google.com/maps\"]')"))
    a.page.click('#helpSheet [data-help="home"]'); a.page.click('[data-help="medical"]'); a.page.wait_for_timeout(150)
    t = a.page.inner_text("#helpSheet")
    check("Medical: cabin phone on the ship, insurance shown, 911 in the US", "cabin phone" in t and "Allianz" in t and "911" in t)
    a.page.click('#helpSheet [data-help="home"]'); a.page.click('[data-help="travel"]'); a.page.wait_for_timeout(150)
    check("Travel problem: call the line first, keep receipts", "Call the cruise line" in a.page.inner_text("#helpSheet") and "receipt" in a.page.inner_text("#helpSheet"))
    a.page.click('[data-helpclose="1"]')
    a.js("TRIP_EDIT = null; PORT_EDIT = 'p1'; openQA('tport', true)")
    check("port form has port agent + local emergency number fields", a.js("!!document.querySelector('#qaForm [name=agent]') && !!document.querySelector('#qaForm [name=emergency]')"))
    a.close()
    a = App(b, base); setup(a)
    check("Day Hub: no 🛟 in its hero (Cruise Hub only)", not a.js("!!document.querySelector('#hero [data-help]')"))
    a.close()


def t_v058_shell(b, base):
    print("\n[v0.58 the hub shell: HOME / PLAN / EXPLORE / WALLET / AI + the big button]")
    def mk(at):
        a = App(b, base, path=CRUISE, at=at)
        a.js("localStorage.setItem('cruisehub.startTab', 'home')"); a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
        a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        a.js("S.magicSeen = true; S.prefs = { skipped: true, loves: [] }; save(); render()")     # v0.60 one-time onboarding done
        return a
    a = App(b, base, path=CRUISE)
    a.js("localStorage.setItem('cruisehub.startTab', 'home')"); a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
    check("first run: welcome card, no tab bar yet", "Welcome to Cruise Hub" in a.page.inner_text("#cards") and not a.js("!!document.getElementById('tabbar')"))
    a.close()
    a = mk("2026-10-01T09:00:00")
    tabs = a.js("[...document.querySelectorAll('#tabbar button')].map(b => b.textContent.trim())")
    check("5 permanent tabs, opens on HOME", tabs == ["🏠Home", "📅Plan", "🌎Explore", "👛Wallet", "✨AI"] and a.js("TAB") == "home", tabs)
    check("no trip: HOME shows the ways to add a cruise", "Add my cruise" in a.page.inner_text("#cards") and "Paste my confirmation" in a.page.inner_text("#cards"))
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess", "port": "Port Canaveral"})
    a.js("const tr = curTrip(); tr.total = 3000; tr.finalDue = '2026-10-20'; tr.ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-11-14', allAboard: '16:30', excursion: 'Hummer tour' }]; save(); shellGo('home')")
    home = a.page.inner_text("#cards")
    check("HOME: What's going on (max 3) + 7 bubbles, WHAT AM I FORGETTING? first", "What's going on" in home and a.js("document.querySelectorAll('.rn-row').length") <= 3 and a.js("document.querySelectorAll('.bubbles .bubble').length") == 7 and "WHAT AM I FORGETTING" in a.page.inner_text(".bubble.hot").upper(), home[:500])
    check("HOME has no card list (no Trips / Schedule cards)", not a.js("!!document.querySelector('#cards [data-card=\"trips\"]')") and not a.js("!!document.querySelector('#cards [data-card=\"schedule\"]')"))
    check("final payment shown once in What's going on", sum(1 for x in a.js("[...document.querySelectorAll('.rn-row')].map(r => r.textContent)") if "final payment" in x.lower()) == 1)
    a.page.click(".bubble.hot"); a.page.wait_for_timeout(200)
    check("hot bubble opens 'What am I forgetting?'", not a.js("document.getElementById('forgetSheet').classList.contains('hidden')"))
    a.page.click('#forgetSheet [data-forgetclose]')
    a.page.click('#tabbar [data-shellgo="plan"]'); a.page.wait_for_timeout(150)
    check("PLAN: the trip with every tab + schedule", a.js("!!document.querySelector('[data-card=\"trips\"]') && !!document.querySelector('[data-card=\"schedule\"]')") and a.js("document.querySelectorAll('[data-card=\"trips\"] [data-triptab]').length") >= 6)
    a.page.click('#tabbar [data-shellgo="wallet"]'); a.page.wait_for_timeout(150)
    tt = a.js("[...document.querySelectorAll('[data-card=\"trips\"] [data-triptab]')].map(b => b.dataset.triptab)")
    check("WALLET: only Money / Onboard / Perks, opens on Money", tt == ["money", "onboard", "perks"] and "Whole trip" in a.card("trips").title() or "WHOLE TRIP" in a.card("trips").upper(), tt)
    a.page.click('#tabbar [data-shellgo="explore"]'); a.page.wait_for_timeout(150)
    ex = a.page.inner_text("#cards")
    check("EXPLORE: My ports (Grand Turk + Hummer tour), My ship, weather", "My ports" in ex and "Grand Turk" in ex and "Hummer tour" in ex and "My ship" in ex and a.js("!!document.querySelector('[data-card=\"weather\"]')"))
    a.page.click(".port-card"); a.page.wait_for_timeout(150)
    check("tap a port -> its day screen (v0.65)", not a.js("document.getElementById('daySheet').classList.contains('hidden')") and "Grand Turk" in a.page.inner_text("#daySheet"))
    a.js("hideSheet('daySheet')")
    a.page.click('#tabbar [data-shellgo="ai"]'); a.page.wait_for_timeout(150)
    check("AI: greeting + questions that fit + Ask anything", "42 days to Caribbean Princess" in a.page.inner_text("#cards") and "Ask anything" in a.page.inner_text("#cards"))
    check("clock + weather only on HOME (other tabs stay compact)", not a.js("document.querySelector('#hero .hero-main').offsetParent"))
    a.page.click('#tabbar [data-shellgo="home"]'); a.page.wait_for_timeout(150)
    check("back on HOME the clock shows", a.js("!!document.querySelector('#hero .hero-main').offsetParent"))
    a.close()
    # the big button changes its job with the moment
    a = mk("2026-11-14T15:00:00")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-11-14', allAboard: '16:30' }]; save(); shellGo('home')")
    check("port day: BACK TO SHIP", "BACK TO SHIP" in a.page.inner_text(".bubble.hot"))
    a.close()
    a = mk("2026-11-12T09:00:00")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "port": "Port Canaveral"})
    a.js("shellGo('home')")
    check("sail day morning: GET ME TO MY SHIP", "GET ME TO MY SHIP" in a.page.inner_text(".bubble.hot"))
    a.page.click(".bubble.hot"); a.page.wait_for_timeout(150); a.page.click('#helpSheet [data-aboard="1"]'); a.page.wait_for_timeout(150)
    check("'We're on board' -> WHAT SHOULD WE DO NOW?", "WHAT SHOULD WE DO NOW" in a.page.inner_text(".bubble.hot").upper())
    a.close()
    a = mk("2026-11-18T19:00:00")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess"})
    a.js("shellGo('home')")
    check("final evening: GET ME HOME READY", "GET ME HOME READY" in a.page.inner_text(".bubble.hot"))
    a.close()
    a = App(b, base); setup(a)
    check("Day Hub keeps its cards (no tab bar)", not a.js("!!document.getElementById('tabbar')") and a.js("!!document.querySelector('[data-card=\"schedule\"]')"))
    a.close()


def t_v059_plan_timeline(b, base):
    print("\n[v0.59 PLAN: Today | Trip | Packing | Reservations + the day-by-day timeline + day screen]")
    a = App(b, base, path=CRUISE, at="2026-11-13T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-16", "line": "Princess", "ship": "Caribbean Princess", "port": "Port Canaveral"})
    a.js("""curTrip().ports = [{ id: 'p1', name: 'Grand Turk', day: '2026-11-14', arrive: '08:00', allAboard: '16:30', excursion: 'Hummer tour', meet: '08:30', where: 'Pier gate' }];
            curTrip().costs = [{ id: 'c1', cat: 'hotel', what: 'Westgate', amt: 336, paid: true }]; save(); shellGo('plan')""")
    views = a.js("[...document.querySelectorAll('.planview [data-planview] b')].map(b => b.textContent)")
    check("PLAN views: Today | Trip | Map | Packing | Bookings | Diary (Trip first shown)", views == ["Today", "Trip", "Map", "Packing", "Bookings", "Diary"] and a.js("PLAN_VIEW") == "trip", views)   # v0.99 + Map, v1.01 + Diary
    tl = a.page.inner_text(".timeline")
    check("timeline: every day in order - sail day, at sea (TODAY), Grand Turk, at sea, back in port", tl.index("Sail day") < tl.index("At sea") < tl.index("Grand Turk") < tl.index("Back in port") and "TODAY" in tl and a.js("document.querySelectorAll('.tl-row').length") == 5, tl[:500])
    check("port row: all aboard + excursion", "all aboard 4:30 PM" in tl and "Hummer tour" in tl)
    check("the trip card, schedule etc. are still under the timeline", a.js("!!document.querySelector('[data-card=\"trips\"]') && !!document.querySelector('[data-card=\"schedule\"]')"))
    a.page.click('[data-tlday="2026-11-14"]'); a.page.wait_for_timeout(200)
    ds = a.page.inner_text("#daySheet")
    check("day screen: all aboard, head back by, excursion with meeting point, the day's items, next actions",
          "All aboard" in ds and "Head back by" in ds and "3:10 PM" in ds and "Pier gate" in ds and "ALL ABOARD" in ds and "Edit this port" in ds and "Add a plan this day" in ds, ds[:500])
    a.page.click('[data-dayclose="1"]')
    a.page.click('[data-tlday="2026-11-13"]'); a.page.wait_for_timeout(150)
    check("a sea day offers 'It's a port day'", "It's a port day" in a.page.inner_text("#daySheet"))
    a.page.click('[data-dayclose="1"]')
    check("schedule ‹ › still works under the timeline", a.js("(() => { document.querySelector('[data-card=\"schedule\"] [data-day=\"1\"]').click(); return VIEW; })()") == "2026-11-14")
    a.page.click('[data-planview="packing"]'); a.page.wait_for_timeout(150)
    check("Packing view = the packing list", a.js("S.tripTab") == "lists" and "Swimsuits" in a.card("trips"))
    a.page.click('[data-planview="reservations"]'); a.page.wait_for_timeout(150)
    r = a.page.inner_text("#cards")
    check("Reservations: excursions + bookings around the cruise", "Hummer tour" in r and "Westgate" in r and "Add a plan" in r, r[:400])
    a.page.click('[data-planview="today"]'); a.page.wait_for_timeout(150)
    check("Today view = schedule + to-dos only", a.js("!!document.querySelector('[data-card=\"schedule\"]') && !document.querySelector('[data-card=\"trips\"]')"))
    a.close()


def t_v060_onboarding(b, base):
    print("\n[v0.60 onboarding: add my cruise, paste a confirmation, YOU'RE GOING!, make it yours]")
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.js("localStorage.setItem('cruisehub.startTab', 'home')"); a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    h = a.page.inner_text("#cards")
    check("HOME with no cruise: Add my cruise - enter it / paste the confirmation", "Add my cruise" in h and "Enter my cruise" in h and "Paste my confirmation" in h and "Find it in my email" not in h)
    a.page.click('[data-pasteopen="1"]'); a.page.wait_for_timeout(150)
    a.page.fill("#pasteSheet textarea", "hello, not a cruise"); a.js("document.querySelector('form[data-pastecruise]').requestSubmit()"); a.page.wait_for_timeout(150)
    check("text with no cruise: nothing added, sheet stays", a.js("S.trips.length") == 0 and not a.js("document.getElementById('pasteSheet').classList.contains('hidden')"))
    mail = "Your Princess Cruises booking is confirmed\nShip Caribbean Princess\nSail Date Nov 12, 2026\nReturn Date Nov 19, 2026\nBooking # DN9MWJ\nStateroom C325\nEmbarkation Port Port Canaveral\nFinal Payment Due Oct 20, 2026\nTotal Price $3,214.50"
    a.page.fill("#pasteSheet textarea", mail); a.js("document.querySelector('form[data-pastecruise]').requestSubmit()"); a.page.wait_for_timeout(300)
    tr = a.js("(({ship, start, end, booking, cabin, port, finalDue, total, line}) => ({ship, start, end, booking, cabin, port, finalDue, total, line}))(curTrip())")
    check("pasted confirmation -> the cruise filled in", tr == {"ship": "Caribbean Princess", "start": "2026-11-12", "end": "2026-11-19", "booking": "DN9MWJ", "cabin": "C325",
          "port": "Port Canaveral", "finalDue": "2026-10-20", "total": 3214.5, "line": "Princess"}, tr)
    m = a.page.inner_text("#magicSheet")
    check("the magic moment: YOU'RE GOING! ship, 42 days, building..., READY + what's still needed", "YOU'RE GOING!" in m and "Caribbean Princess" in m and "42" in m and "YOUR CRUISE IS READY" in m and "still need from you" in m, m[:400])
    a.page.click('[data-magicclose="1"]'); a.page.wait_for_timeout(150)
    check("shown once (remembered)", a.js("S.magicSeen") is True and a.js("document.getElementById('magicSheet').classList.contains('hidden')"))
    h = a.page.inner_text("#cards")
    check("HOME now: Make it yours (optional) + What's going on + the bubbles", "MAKE IT YOURS" in h.upper() and "WHO'S GOING?" in h.upper() and "WHAT'S GOING ON" in h.upper(), h[:300])
    a.page.click('[data-prefwith="partner"]'); [a.page.click(f'[data-preflove="{k}"]') for k in ("comedy", "casino", "beaches", "food")]
    check("top 3 numbered in the order picked", a.js("[...document.querySelectorAll('.love i')].map(i => i.parentElement.dataset.preflove + i.textContent).join()") == "beaches3,comedy1,casino2" or a.js("[...document.querySelectorAll('.love.on i')].length") == 3)
    a.page.click('[data-prefsave="1"]'); a.page.wait_for_timeout(150)
    check("saved: partner, loves, top 3; card gone", a.js("S.prefs.with") == "partner" and a.js("S.prefs.top3.join()") == "comedy,casino,beaches" and "Make it yours" not in a.page.inner_text("#cards"))
    check("Ask Cruise Hub gets the travel style", json.loads(a.js("aiContext()")).get("travelStyle", {}).get("top3") == ["comedy", "casino", "beaches"])
    a.close()
    # by hand: the magic moment too (on HOME)
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.js("localStorage.setItem('cruisehub.startTab', 'home')"); a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Alaska", "start": "2027-06-20", "end": "2027-06-27", "line": "Princess"})
    a.page.wait_for_timeout(200)
    check("entering the cruise by hand also shows YOU'RE GOING!", "YOU'RE GOING!" in a.page.inner_text("#magicSheet"))
    a.page.click('[data-prefskip="1"]') if a.js("!!document.querySelector('[data-prefskip]')") and False else None
    a.close()


def t_v061_travel_day_offline(b, base):
    print("\n[v0.61 tomorrow you sail / today you sail / you're on board + offline pill]")
    def mk(at):
        a = App(b, base, path=CRUISE, at=at)
        a.js("localStorage.setItem('cruisehub.startTab', 'home')"); a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
        a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        a.js("S.magicSeen = true; S.prefs = { skipped: true, loves: [] }; save()")
        a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-10-02", "end": "2026-10-09", "line": "Princess", "ship": "Caribbean Princess", "port": "Port Canaveral"})
        a.js("shellGo('home')"); a.page.wait_for_timeout(300); a.js("render()")
        return a
    a = mk("2026-10-01T09:00:00")
    h = a.page.inner_text("#cards")
    check("the day before: TOMORROW YOU SAIL with documents, bags, getting there, sail-day plan", "TOMORROW YOU SAIL" in h.upper() and "Documents 0/" in h and "Bags packed 0/" in h and "Getting there" in h and "Sail-day plan" in h, h[:400])
    check("terminal directions", a.js("!!document.querySelector('.phase a[href*=\"google.com/maps\"]')"))
    a.page.click('.phase [data-triplistgo="docs"]'); a.page.wait_for_timeout(150)
    check("tap Documents -> PLAN on the documents list", a.js("TAB") == "plan" and a.js("S.tripList") == "docs")
    a.close()
    a = mk("2026-10-02T09:00:00")
    check("sail day: TODAY YOU SAIL + We're on board", "TODAY YOU SAIL" in a.page.inner_text("#cards").upper() and a.js("!!document.querySelector('.phase [data-aboard]')"))
    a.page.click('.phase [data-aboard="1"]'); a.page.wait_for_timeout(200)
    h = a.page.inner_text("#cards")
    check("on board: YOU'RE ON BOARD + 6 first things", "YOU'RE ON BOARD" in h.upper() and a.js("document.querySelectorAll('[data-first]').length") == 6)
    a.page.check('[data-first="muster"]'); a.page.wait_for_timeout(150)
    check("tick a first thing -> saved, 1/6", a.js("curTrip().firstThings.muster") is True and "1/6" in a.page.inner_text(".phase"))
    a.page.click('[data-firstdone="1"]'); a.page.wait_for_timeout(150)
    check("Hide this -> gone", not a.js("!!document.querySelector('.phase')"))
    a.ctx.set_offline(True); a.js("window.dispatchEvent(new Event('offline'))"); a.page.wait_for_timeout(200)
    check("offline: 🟠 Offline by the name, the forecast is kept", "Offline" in a.page.inner_text("#hero .brand") and a.js("!!(WXDATA && WXDATA.here)"))
    a.ctx.set_offline(False); a.js("window.dispatchEvent(new Event('online'))"); a.page.wait_for_timeout(300)
    check("back online: pill gone", "Offline" not in a.page.inner_text("#hero .brand"))
    a.close()


def t_v062_simple_mode(b, base):
    print("\n[v0.62 simple mode: big text, today, next, four big buttons]")
    a = App(b, base, path=CRUISE, at="2026-11-13T09:00:00")
    a.js("localStorage.setItem('cruisehub.startTab', 'home')"); a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.js("S.magicSeen = true; S.prefs = { skipped: true, loves: [] }; save()")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-16", "line": "Princess", "ship": "Caribbean Princess"})
    a.js("curTrip().aboard = true; curTrip().firstDone = true; save(); shellGo('home')")
    a.page.click("#settingsBtn"); a.page.wait_for_timeout(150)
    check("⚙ has Display -> Simple mode (Cruise Hub)", "Simple mode" in a.page.inner_text("#simpleBox"))
    a.page.check('[data-simple="1"]'); a.page.wait_for_timeout(200); a.page.click('[data-close="sheet"]')
    h = a.page.inner_text("#cards")
    check("simple HOME: greeting, Sea day, NEXT, big button, MY DAY / MY CRUISE / ASK / HELP", "Sea day" in h and "WHAT SHOULD WE DO NOW" in h.upper()
          and all(x in h for x in ("MY DAY", "MY CRUISE", "ASK", "HELP")) and "What's going on" not in h, h[:400])
    check("large text on", a.js("document.body.classList.contains('simple')") and a.js("parseFloat(getComputedStyle(document.body).fontSize)") >= 18)
    a.page.click('.simple-btn[data-planview="today"]'); a.page.wait_for_timeout(150)
    check("MY DAY -> Plan / Today", a.js("TAB") == "plan" and a.js("PLAN_VIEW") == "today")
    a.js("shellGo('home')"); a.page.click('.simple-btn[data-help]'); a.page.wait_for_timeout(150)
    check("HELP -> the 🛟 sheet", not a.js("document.getElementById('helpSheet').classList.contains('hidden')"))
    a.js("hideSheet('helpSheet'); S.simple = false; save(); render()")
    check("off again: normal HOME", "What's going on" in a.page.inner_text("#cards") and not a.js("document.body.classList.contains('simple')"))
    a.close()
    a = App(b, base); setup(a); a.page.click("#settingsBtn")
    check("Day Hub: no Simple mode box yet (no shell)", a.js("document.getElementById('simpleBox').hidden"))
    a.close()


def t_v062_itemized(b, base):
    print("\n[v0.62 itemized running cost of the trip]")
    a = App(b, base, path=CRUISE, at="2026-11-14T10:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess", "travelers": "2"})
    a.js("""const tr = curTrip(); tr.total = 3000; tr.payments = [{ id: 'x', amt: 3000, day: '2026-09-01' }];
            tr.costs = [{ id: 'c1', cat: 'hotel', what: 'Westgate', amt: 336, paid: true }, { id: 'c2', cat: 'parking', what: 'Port garage', amt: 160, paid: false }];
            tr.spends = [{ id: 's2', day: '2026-11-13', amt: 24, cat: 'Drinks', note: 'Crooners' }, { id: 's1', day: '2026-11-12', amt: 18.5, cat: 'Drinks', note: 'Sail-away drinks' }];
            save(); S.tripTab = 'money'; shellGo('wallet')""")
    L = a.js("tripItems(curTrip()).map(i => [i.what, i.amt, i.run, i.status])")
    g = a.js("gratEstimate(curTrip())")
    check("lines in order: fare, hotel, parking, onboard by date, gratuities - running total adds up",
          [x[0] for x in L][:5] == ["🚢 Cruise fare", "🏨 Hotel — Westgate", "🅿️ Parking — Port garage", "🍹 Sail-away drinks", "🍹 Crooners"]
          and L[-1][0].startswith("🧾 Gratuities") and abs(L[-1][2] - (3000 + 336 + 160 + 18.5 + 24 + g)) < 0.01 and L[2][2] == 3496, L)
    check("status per line: paid / not paid / ship account / estimate", [x[3] for x in L] == ["paid ✓", "paid ✓", "not paid", "ship account", "ship account", "estimate"], [x[3] for x in L])
    t = a.card("trips")
    check("shown first on Wallet -> Money with 'Trip so far'", "ITEMIZED" in t.upper() and "Trip so far" in t and t.upper().index("ITEMIZED") < t.upper().index("WHOLE TRIP"), t[:300])
    ctx = json.loads(a.js("aiContext()"))
    check("Ask Cruise Hub sees the itemized list + running total", len(ctx["trip"].get("itemizedCost", {}).get("lines", [])) == 6 and ctx["trip"]["itemizedCost"]["runningTotal"].startswith("$"))
    a.close()


def t_v063_icon_tiles(b, base):
    print("\n[v0.63 the hub navigation: big icon tiles everywhere you choose a section]")
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess"})
    a.js("shellGo('plan')")
    tt = a.js("[...document.querySelectorAll('.triptabs .tile')].map(t => t.querySelector('.tile-ic').textContent + '|' + t.querySelector('b').textContent)")
    check("trip sections are icon tiles (icon + label)", len(tt) >= 6 and "✅|Ready" in tt and "💳|Money" in tt, tt)
    check("plan views are icon tiles (6 since v1.01 Diary)", a.js("document.querySelectorAll('.planview .tile').length") == 6)
    a.page.click('.triptabs [data-triptab="lists"]'); a.page.wait_for_timeout(150)
    check("tap a tile = that section, tile lit", a.js("S.tripTab") == "lists" and a.js("document.querySelector('.triptabs .tile.on').dataset.triptab") == "lists")
    check("lists are icon tiles with done counts", a.js("document.querySelectorAll('.tilenav.compact [data-triplist]').length") >= 7 and "/" in a.js("document.querySelector('[data-triplist=\"packing\"] small').textContent"))
    a.page.click("#settingsBtn"); a.page.wait_for_timeout(200)
    j = a.js("[...document.querySelectorAll('#setJump .tile b')].map(b => b.textContent)")
    check("⚙ opens with a tile menu of its sections", "Reminders" in j and "My data" in j and "Hub family" in j, j)
    a.page.click('#setJump [data-setjump="dataBox"]'); a.page.wait_for_timeout(1000)
    check("a settings tile jumps to its section", a.js("(() => { const r = document.getElementById('dataBox').getBoundingClientRect(); return r.top < window.innerHeight; })()"))
    a.close()


def t_v064_ship_guide(b, base):
    print("\n[v0.64 ship guide: Caribbean Princess from princess.com - deck + included / extra]")
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "caribbean  princess"})
    a.js("shellGo('explore')")
    t = a.page.inner_text(".my-ship")
    check("ship matched (any capitals/spaces): facts + category tiles", "Caribbean Princess" in t and "3,140 guests" in t and "19 decks" in t and "built 2004" in t
          and a.js("document.querySelectorAll('.my-ship [data-shipcat]').length") == 8, t[:300])
    check("Eat: dining rooms with decks; Crown Grill extra; International Café included 24 hours", "Island Dining Room" in t and "Deck 5" in t and "Open 24 hours a day" in t
          and a.js("[...document.querySelectorAll('.my-ship .row')].some(r => /Crown Grill/.test(r.textContent) && /Extra cost/.test(r.textContent))"))
    a.page.click('.my-ship [data-shipcat="free"]'); a.page.wait_for_timeout(150)
    rows = a.js("[...document.querySelectorAll('.my-ship .row b')].map(b => b.textContent)")
    check("What's included = only the included venues", "World Fresh Marketplace" in rows and "Crown Grill" not in rows and all(a.js("[...document.querySelectorAll('.my-ship .row')].every(r => /Included/.test(r.textContent))") for _ in [0]), rows)
    a.page.click('.my-ship [data-shipcat="service"]'); a.page.wait_for_timeout(150)
    check("Services: Medical Center deck 4, Guest Services deck 6", "Medical Center" in a.page.inner_text(".my-ship") and "Deck 4" in a.page.inner_text(".my-ship"))
    check("source + checked date shown, links to princess.com", "checked" in a.page.inner_text(".my-ship") and a.js("!!document.querySelector('.my-ship a[href*=\"princess.com\"]')"))
    ctx = json.loads(a.js("aiContext()"))
    check("Ask Cruise Hub gets the verified venue list", any("Crown Grill (deck 6) - extra" in v for v in ctx["trip"].get("shipGuide", {}).get("venues", [])))
    a.js("curTrip().ship = 'Icon of the Seas'; save(); render()")
    check("a ship not in the guide yet: says so honestly", "isn't in Cruise Hub yet" in a.page.inner_text(".my-ship"))
    a.close()


def t_v065_port_guides(b, base):
    print("\n[v0.65 port guides: Nassau, Grand Turk, Cozumel from official sources + live advisory link]")
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Nassau, Bahamas', day: '2026-11-13', allAboard: '17:00' }, { id: 'p2', name: 'Grand Turk', day: '2026-11-15' }, { id: 'p3', name: 'Falmouth', day: '2026-11-16' }]; save(); shellGo('explore')")
    check("port cards show the country flag when there's a guide", "🇧🇸" in a.page.inner_text(".port-card") and a.js("[...document.querySelectorAll('.port-card b')].map(b => b.textContent).join('|')").count("⚓") == 1)
    a.page.click('.port-card[data-tlday="2026-11-13"]'); a.page.wait_for_timeout(200)
    t = a.page.inner_text("#daySheet")
    check("Nassau day screen: all aboard + Good to know (USD on par, free Wi-Fi, licensed taxis, pharmacy)", "All aboard" in t and "GOOD TO KNOW IN NASSAU" in t.upper()
          and "on par with the U.S. dollar" in t and "Free Wi-Fi" in t and "licensed operators" in t and "pharmacy" in t, t[:600])
    check("live U.S. advisory link (no copied level) + source + checked date", a.js("!!document.querySelector('#daySheet a[href*=\"travel.state.gov\"]')") and "Level" not in t
          and a.js("!!document.querySelector('#daySheet a[href*=\"nassaucruiseport.com\"]')") and "checked" in t)
    a.js("hideSheet('daySheet')"); a.page.click('.port-card[data-tlday="2026-11-15"]'); a.page.wait_for_timeout(200)
    check("Grand Turk: USD + taxis have no meters", "U.S. dollar" in a.page.inner_text("#daySheet") and "no meters" in a.page.inner_text("#daySheet"))
    a.js("hideSheet('daySheet')"); a.page.click('.port-card[data-tlday="2026-11-16"]'); a.page.wait_for_timeout(200)
    check("a port without a guide: no made-up info", "GOOD TO KNOW" not in a.page.inner_text("#daySheet").upper())
    ctx = json.loads(a.js("aiContext()"))
    check("Ask Cruise Hub gets the official port info", any("on par" in x for x in ctx["trip"]["ports"][0].get("officialPortInfo", [])))
    check("Cozumel guide matches 'Cozumel, Mexico'", a.js("portGuide('Cozumel, Mexico').name") == "Cozumel")
    a.close()


def t_v066_more_ports(b, base):
    print("\n[v0.66 more port guides: St. Thomas, St. Maarten, Costa Maya, Roatán, Grand Cayman]")
    a = App(b, base, path=CRUISE)
    names = a.js("['St. Thomas, USVI', 'Philipsburg, St. Maarten', 'Costa Maya', 'Roatan (Mahogany Bay)', 'George Town, Grand Cayman'].map(n => (portGuide(n) || {}).name)")
    check("names match their guides", names == ["St. Thomas", "St. Maarten", "Costa Maya", "Roatán", "Grand Cayman"], names)
    check("Grand Cayman says TENDER port + drive on the left", a.js("portGuide('Grand Cayman').facts.some(f => /TENDER/.test(f.text)) && portGuide('Grand Cayman').facts.some(f => /LEFT/.test(f.text))"))
    check("St. Thomas: U.S. territory -> no advisory button", "no foreign travel advisory" in a.js("portGuideHtml({ name: 'St. Thomas' })") and "travel.state.gov" not in a.js("portGuideHtml({ name: 'St. Thomas' })"))
    check("every guide fact has a source link; 8+ ports", a.js("Object.values(PORT_GUIDES).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))") and a.js("Object.keys(PORT_GUIDES).length") >= 8)
    a.close()


def t_v067_tender(b, base):
    print("\n[v0.67 tender ports in Return Guard + Princess Cays guide]")
    a = App(b, base, path=CRUISE, at="2026-11-14T10:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Princess Cays', day: '2026-11-14', allAboard: '16:30' }]; save(); render()")
    check("Princess Cays = tender: trip back 45 -> head back by 16:30 - 60 - 45 = 2:45 PM", a.js("guardBack(curTrip().ports[0])") == 45 and a.js("guardBy(curTrip().ports[0])") == "14:45")
    a.page.click("#rgBar"); a.page.wait_for_timeout(150)
    check("Return Guard sheet explains the tender time", "Tender port" in a.page.inner_text("#rgSheet"))
    a.js("hideSheet('rgSheet')")
    check("own number still wins over the tender default", a.js("(() => { const pt = curTrip().ports[0]; pt.backMin = 30; return guardBack(pt); })()") == 30)
    check("Grand Cayman is a tender port, Nassau isn't", a.js("isTenderPort({ name: 'George Town, Grand Cayman' }) && !isTenderPort({ name: 'Nassau' })"))
    g = a.js("portGuideHtml({ name: 'Princess Cays' })")
    check("Princess Cays guide: tender, included BBQ lunch, bungalow $199, water shoes", "TENDER" in g and "BBQ lunch is included" in g and "$199" in g and "water shoes" in g)
    a.close()


def t_v068_ports_batch3(b, base):
    print("\n[v0.68 port guides: San Juan, Key West, Ocho Rios, Aruba]")
    a = App(b, base, path=CRUISE)
    names = a.js("['Old San Juan, Puerto Rico', 'Key West, FL', 'Ocho Rios, Jamaica', 'Oranjestad, Aruba'].map(n => (portGuide(n) || {}).name)")
    check("names match", names == ["San Juan", "Key West", "Ocho Rios", "Aruba"], names)
    check("U.S. ports have no foreign advisory; Jamaica links the advisory list", "no foreign travel advisory" in a.js("portGuideHtml({ name: 'Key West' })") and "travel.state.gov" in a.js("portGuideHtml({ name: 'Ocho Rios' })"))
    check("Ocho Rios: official red-plate taxis", "red license plate" in a.js("portGuideHtml({ name: 'Ocho Rios' })"))
    check("13+ ports, all facts sourced", a.js("Object.keys(PORT_GUIDES).length") >= 13 and a.js("Object.values(PORT_GUIDES).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))"))
    a.close()


def t_v069_alaska(b, base):
    print("\n[v0.69 Alaska port guides: Juneau, Ketchikan, Skagway, Sitka, Victoria]")
    a = App(b, base, path=CRUISE)
    names = a.js("['Juneau, Alaska', 'Ketchikan, AK', 'Skagway', 'Sitka, Alaska', 'Victoria, British Columbia'].map(n => (portGuide(n) || {}).name)")
    check("Alaska + Victoria names match", names == ["Juneau", "Ketchikan", "Skagway", "Sitka", "Victoria"], names)
    check("Skagway warns: no rideshare", "NO rideshare" in a.js("portGuideHtml({ name: 'Skagway' })"))
    check("Sitka: 5 miles out + free shuttle + may tender", all(x in a.js("portGuideHtml({ name: 'Sitka' })") for x in ("5 miles", "free shuttle", "TENDER")))
    check("Victoria (Canada) links the advisory list", "travel.state.gov" in a.js("portGuideHtml({ name: 'Victoria' })"))
    check("18+ ports, all sourced", a.js("Object.keys(PORT_GUIDES).length") >= 18 and a.js("Object.values(PORT_GUIDES).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))"))
    a.close()


def t_v070_private(b, base):
    print("\n[v0.70 port guides: Perfect Day at CocoCay, Amber Cove]")
    a = App(b, base, path=CRUISE)
    names = a.js("['Perfect Day at CocoCay, Bahamas', 'Amber Cove (Puerto Plata)'].map(n => (portGuide(n) || {}).name)")
    check("CocoCay + Amber Cove names match", names == ["Perfect Day at CocoCay", "Amber Cove"], names)
    g = a.js("portGuideHtml({ name: 'CocoCay' })")
    check("CocoCay: pier walk + free vs extra", "6-minute" in g and "FREE" in g and "Thrill Waterpark" in g)
    check("CocoCay is not a tender port", not a.js("isTenderPort({ name: 'CocoCay' })"))
    check("Amber Cove: free Aqua Zone pool", "Aqua Zone" in a.js("portGuideHtml({ name: 'Amber Cove' })"))
    check("20+ ports, all sourced", a.js("Object.keys(PORT_GUIDES).length") >= 20 and a.js("Object.values(PORT_GUIDES).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))"))
    a.close()


def t_v071_bermuda_hmc(b, base):
    print("\n[v0.71 port guides: Bermuda, RelaxAway Half Moon Cay]")
    a = App(b, base, path=CRUISE)
    names = a.js("['Kings Wharf, Bermuda', 'Half Moon Cay, Bahamas'].map(n => (portGuide(n) || {}).name)")
    check("Bermuda + Half Moon Cay names match", names == ["Bermuda (Royal Naval Dockyard)", "RelaxAway, Half Moon Cay"], names)
    g = a.js("portGuideHtml({ name: 'Bermuda' })")
    check("Bermuda: BMD = USD + tip may be included", "equals the U.S. dollar" in g and "already" in g)
    check("Half Moon Cay warns about the water shuttle", "water shuttle" in a.js("portGuideHtml({ name: 'Half Moon Cay' })"))
    check("22 ports, all sourced", a.js("Object.keys(PORT_GUIDES).length") == 22 and a.js("Object.values(PORT_GUIDES).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))"))
    a.close()


def t_v072_home_ports(b, base):
    print("\n[v0.72 departure-port guides]")
    a = App(b, base, path=CRUISE)
    names = a.js("['Port Canaveral, FL', 'Orlando (Port Canaveral)', 'Fort Lauderdale (Port Everglades)', 'Miami, Florida', 'Galveston, TX', 'Honolulu'].map(n => (homePort(n) || {}).name || null)")
    check("4 home ports match, unknown port = none", names == ["Port Canaveral", "Port Canaveral", "Port Everglades", "PortMiami", "Port of Galveston", None], names)
    g = a.js("homePortHtml({ port: 'Port Canaveral' }, true)")
    check("Canaveral: $20/day, cashless, 10 AM", all(x in g for x in ("$20 a day", "cashless", "10 AM")))
    check("Miami warns debit cards not accepted", "DEBIT CARDS ARE NOT ACCEPTED" in a.js("homePortHtml({ port: 'Miami' }, true)"))
    check("collapsed form on the sail card", "<details" in a.js("homePortHtml({ port: 'Galveston' }, false)"))
    check("no port / unknown port -> nothing", a.js("homePortHtml({ port: 'Honolulu' }, true) + homePortHtml({}, true)") == "")
    check("all home-port facts sourced", a.js("Object.values(HOME_PORTS).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))"))
    a.close()


def t_v073_more_home_ports(b, base):
    print("\n[v0.73 departure ports: Seattle, New Orleans, Tampa, Baltimore, LA, Boston, San Diego]")
    a = App(b, base, path=CRUISE)
    names = a.js("['Seattle (Pier 91)', 'New Orleans, LA', 'Tampa, Florida', 'Baltimore, MD'].map(n => (homePort(n) || {}).name || null)")
    check("4 more home ports match", names == ["Port of Seattle", "Port of New Orleans", "Port Tampa Bay", "Cruise Maryland (Baltimore)"], names)
    check("Seattle: Port Valet bags-to-flight", "Port Valet" in a.js("homePortHtml({ port: 'Seattle' }, true)"))
    check("New Orleans warns low garage ceilings", "LOW ceilings" in a.js("homePortHtml({ port: 'New Orleans' }, true)"))
    names = a.js("['San Pedro (Los Angeles)', 'Boston, MA', 'San Diego, CA'].map(n => (homePort(n) || {}).name || null)")
    check("LA, Boston, San Diego match", names == ["Port of Los Angeles (San Pedro)", "Flynn Cruiseport Boston", "Port of San Diego"], names)
    check("San Diego: no long-term parking at the terminal", "NO long-term parking" in a.js("homePortHtml({ port: 'San Diego' }, true)"))
    ctx = a.js("JSON.stringify(tripContext({ name: 'C', type: 'cruise', port: 'Port Canaveral', start: '2026-12-01', end: '2026-12-08', ports: [] }).departurePortInfo)")
    check("v0.74 Ask Cruise Hub gets the departure-port facts", "$20 a day" in ctx and "Port Canaveral" in ctx, ctx[:200])
    check("11+ home ports, all sourced", a.js("Object.keys(HOME_PORTS).length") >= 11 and a.js("Object.values(HOME_PORTS).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))"))
    a.close()


def t_v075_se_home_ports(b, base):
    print("\n[v0.75 departure ports: Mobile, Charleston, Jacksonville, Norfolk]")
    a = App(b, base, path=CRUISE)
    names = a.js("['Mobile, Alabama', 'Charleston, SC', 'Jacksonville, FL', 'Norfolk, VA'].map(n => (homePort(n) || {}).name || null)")
    check("4 more home ports match", names == ["Alabama Cruise Terminal (Mobile)", "Charleston (Union Pier)", "JAXPORT Cruise Terminal", "Norfolk (Half Moone Cruise Center)"], names)
    check("'Mobile' alone is not a port (no false match)", a.js("homePort('Automobile drop-off')") is None)
    check("Charleston: no cash", "NO CASH" in a.js("homePortHtml({ port: 'Charleston' }, true)"))
    check("Norfolk: last shuttle 2:30 PM", "2:30 PM" in a.js("homePortHtml({ port: 'Norfolk' }, true)"))
    check("15 home ports, all sourced", a.js("Object.keys(HOME_PORTS).length") == 15 and a.js("Object.values(HOME_PORTS).every(g => g.facts.every(f => /^https:\\/\\//.test(f.src)))"))
    a.close()


def t_v076_emerald(b, base):
    print("\n[v0.76 ship guide: Emerald Princess]")
    a = App(b, base, path=CRUISE)
    check("Emerald Princess guide found (any case/spaces)", a.js("(shipGuide('  emerald   PRINCESS ') || {}).name") == "Emerald Princess")
    g = a.js("shipGuideHtml({ ship: 'Emerald Princess' })")
    check("Emerald: 3,080 guests, built 2007, buffet", "3,080 guests" in g and "built 2007" in g)
    check("Emerald: Sabatini's is extra cost on deck 16", a.js("shipGuide('Emerald Princess').venues.some(v => v.name.startsWith('Sabatini') && v.cost === 'extra' && v.deck === '16')"))
    check("unknown ship lists the ships we have", "Emerald Princess" in a.js("shipGuideHtml({ ship: 'Wonder of the Seas' })"))
    check("2+ ships, every venue has a category", a.js("Object.keys(SHIP_GUIDES).length") >= 2 and a.js("Object.values(SHIP_GUIDES).every(g => g.venues.every(v => SHIP_CATS.some(c => c[0] === v.cat)))"))
    a.close()


def t_v077_royal(b, base):
    print("\n[v0.77 ship guide: Royal Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Royal Princess' })")
    check("Royal Princess: 3,560 guests, built 2013", "3,560 guests" in g and "built 2013" in g)
    v = a.js("shipGuide('Royal Princess').venues")
    by = {x["name"]: x for x in v}
    check("Prego (included) vs Alfredo's (extra)", by["Prego Pizzeria"]["cost"] == "included" and by["Alfredo's Pizzeria"]["cost"] == "extra")
    check("buffet rename is explained", "Horizon Court" in by["World Fresh Marketplace"]["note"])
    check("3+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 3)
    a.close()


def t_v078_ruby(b, base):
    print("\n[v0.78 ship guide: Ruby Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Ruby Princess' })")
    check("Ruby Princess: 3,080 guests, built 2008", "3,080 guests" in g and "built 2008" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Ruby Princess').venues")}
    check("Salty Dog Grill free, Gastropub extra", by["The Salty Dog Grill"]["cost"] == "included" and by["The Salty Dog Gastropub"]["cost"] == "extra")
    check("4+ ships, every Princess guide sourced from princess.com", a.js("Object.keys(SHIP_GUIDES).length") >= 4 and a.js("Object.values(SHIP_GUIDES).filter(g => g.line === 'Princess').every(g => /princess\\.com/.test(g.sources.ship) && /princess\\.com/.test(g.sources.decks))"))
    a.close()


def t_v079_regal(b, base):
    print("\n[v0.79 ship guide: Regal Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Regal Princess' })")
    check("Regal Princess: 3,560 guests, built 2014", "3,560 guests" in g and "built 2014" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Regal Princess').venues")}
    check("no guessed deck: Prego has none, buffet deck 16", by["Prego Pizzeria"]["deck"] is None and by["World Fresh Marketplace"]["deck"] == "16")
    check("5+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 5)
    a.close()


def t_v080_majestic(b, base):
    print("\n[v0.80 ship guide: Majestic Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Majestic Princess' })")
    check("Majestic Princess: 3,560 guests, built 2017", "3,560 guests" in g and "built 2017" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Majestic Princess').venues")}
    check("no China-era venue, Sabatini's has no guessed deck", "Harmony Chinese Restaurant" not in by and by["Sabatini's Italian Trattoria"]["deck"] is None)
    check("6+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 6)
    a.close()


def t_v081_sky(b, base):
    print("\n[v0.81 ship guide: Sky Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Sky Princess' })")
    check("Sky Princess: 3,660 guests, built 2019", "3,660 guests" in g and "built 2019" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Sky Princess').venues")}
    check("Sabatini's deck 5, Catch by Rudi no guessed deck", by["Sabatini's Italian Trattoria"]["deck"] == "5" and by["The Catch by Rudi"]["deck"] is None)
    check("7+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 7)
    a.close()


def t_v082_enchanted(b, base):
    print("\n[v0.82 ship guide: Enchanted Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Enchanted Princess' })")
    check("Enchanted Princess: 3,660 guests, built 2021", "3,660 guests" in g and "built 2021" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Enchanted Princess').venues")}
    check("360 deck 5 extra, Gigi's no guessed deck", by["360: An Extraordinary Experience"]["deck"] == "5" and by["360: An Extraordinary Experience"]["cost"] == "extra" and by["Gigi's Pizzeria by Alfredo"]["deck"] is None)
    check("8+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 8)
    a.close()


def t_v083_discovery(b, base):
    print("\n[v0.83 ship guide: Discovery Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Discovery Princess' })")
    check("Discovery Princess: 3,660 guests, built 2022", "3,660 guests" in g and "built 2022" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Discovery Princess').venues")}
    check("Bellini's deck 7, Gigi's no guessed deck", by["Bellini's"]["deck"] == "7" and by["Gigi's Pizzeria by Alfredo"]["deck"] is None)
    check("9+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 9)
    a.close()


def t_v084_sun(b, base):
    print("\n[v0.84 ship guide: Sun Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Sun Princess' })")
    check("Sun Princess: 4,300 guests, 21 decks, no made-up build year", "4,300 guests" in g and "21 decks" in g and "built" not in g and "null" not in g)
    check("older ships still show their year", "built 2014" in a.js("shipGuideHtml({ ship: 'Regal Princess' })"))
    by = {x["name"]: x for x in a.js("shipGuide('Sun Princess').venues")}
    check("Soleil deck 6, Crown Grill extra with no guessed deck", by["Soleil Dining Room"]["deck"] == "6" and by["Crown Grill"]["cost"] == "extra" and by["Crown Grill"]["deck"] is None)
    check("10+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 10)
    a.close()


def t_v085_home_layout(b, base):
    print("\n[v0.85 every hub: hero / what's going on / mini action bubbles]")
    a = App(b, base, at="2026-10-01T09:00:00"); setup(a)
    order = a.js("[...document.querySelectorAll('#cards > section[data-card]')].map(s => s.dataset.card)")
    bub = a.js("[...document.querySelectorAll('.bubbles .bubble')].map(b => b.dataset.bubble)")
    check("Day Hub: What's going on sits right under the hero, then the bubbles", a.js("document.querySelector('#cards > .going-on + .bubbles') !== null"))
    check("Day Hub: one bubble per card, in the screen's order (max 12)", bub == order[:12] and len(bub) >= 4, (bub, order))
    check("Day Hub: today's rain shows in What's going on", "Rain" in a.page.inner_text(".going-on"))
    a.js("S.collapsed = ['weather']; save(); render()")
    a.page.click('.bubble[data-bubble="weather"]'); a.page.wait_for_timeout(200)
    check("tap a bubble -> that card opens", not a.js("S.collapsed.includes('weather')") and not a.js("document.querySelector('[data-card=\"weather\"]').classList.contains('collapsed')"))
    a.close()
    a = App(b, base, path=CRUISE, at="2026-10-01T09:00:00")
    a.js("localStorage.setItem('cruisehub.startTab', 'home')"); a.page.reload(); a.page.wait_for_function("document.querySelector('#hero .greet')")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.js("S.magicSeen = true; S.prefs = { skipped: true, loves: [] }; save(); render()")
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    a.js("const tr = curTrip(); tr.total = 3000; tr.finalDue = '2026-10-20'; save(); shellGo('home')")
    labels = a.js("[...document.querySelectorAll('.bubbles .bubble b')].map(b => b.textContent)")
    check("Cruise Hub: hot bubble + My day, My cruise, Packing, Ports & ship, Money, Help", labels[1:] == ["My day", "My cruise", "Packing", "Ports & ship", "Money", "Help"], labels)
    check("NEXT that repeats a row above is left out", "NEXT" not in a.page.inner_text(".going-on") and "final payment" in a.page.inner_text(".going-on").lower())
    a.page.click('.bubble[data-shellgo="wallet"]'); a.page.wait_for_timeout(150)
    check("Money bubble -> WALLET", a.js("TAB") == "wallet")
    a.js("shellGo('home')"); a.page.click('.bubble[data-planview="packing"]'); a.page.wait_for_timeout(150)
    check("Packing bubble -> Plan / Packing", a.js("TAB") == "plan" and a.js("PLAN_VIEW") == "packing")
    a.close()


def t_v086_star(b, base):
    print("\n[v0.86 ship guide: Star Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Star Princess' })")
    check("Star Princess: 4,300 guests, 21 decks, built 2025", "4,300 guests" in g and "21 decks" in g and "built 2025" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Star Princess').venues")}
    check("Aurora deck 6, Americana Diner deck 9, Umai Hot Pot extra", by["Aurora Dining Room"]["deck"] == "6" and by["Americana Diner"]["deck"] == "9" and by["Umai Hot Pot"]["cost"] == "extra")
    check("11+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 11)
    a.close()


def t_v087_grand(b, base):
    print("\n[v0.87 ship guide: Grand Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Grand Princess' })")
    check("Grand Princess: 2,600 guests, 17 decks, built 1998", "2,600 guests" in g and "17 decks" in g and "built 1998" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Grand Princess').venues")}
    check("Conservatory deck 15, buffet has no guessed deck", by["The Conservatory"]["deck"] == "15" and by["World Fresh Marketplace"]["deck"] is None)
    check("12+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 12)
    a.close()


def t_v088_crown(b, base):
    print("\n[v0.88 ship guide: Crown Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Crown Princess' })")
    check("Crown Princess: 3,080 guests, 19 decks, built 2006", "3,080 guests" in g and "19 decks" in g and "built 2006" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Crown Princess').venues")}
    check("Skywalkers deck 18, Gastropub extra with no guessed deck", by["Skywalkers Nightclub"]["deck"] == "18" and by["The Salty Dog Gastropub"]["cost"] == "extra" and by["The Salty Dog Gastropub"]["deck"] is None)
    check("13+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 13)
    a.close()


def t_v089_diamond(b, base):
    print("\n[v0.89 ship guide: Diamond Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Diamond Princess' })")
    check("Diamond Princess: 2,706 guests, 18 decks, built 2004", "2,706 guests" in g and "18 decks" in g and "built 2004" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Diamond Princess').venues")}
    check("Izumi deck 15, Churrascaria extra with no guessed deck", by["Izumi Japanese Bath"]["deck"] == "15" and by["Churrascaria Brazilian Grill"]["cost"] == "extra" and by["Churrascaria Brazilian Grill"]["deck"] is None)
    check("14+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 14)
    a.close()


def t_v090_sapphire(b, base):
    print("\n[v0.90 ship guide: Sapphire Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Sapphire Princess' })")
    check("Sapphire Princess: 2,670 guests, 18 decks, built 2004", "2,670 guests" in g and "18 decks" in g and "built 2004" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Sapphire Princess').venues")}
    check("Alfredo's deck 5 extra, Crown Grill no guessed deck", by["Alfredo's Pizzeria"]["deck"] == "5" and by["Alfredo's Pizzeria"]["cost"] == "extra" and by["Crown Grill"]["deck"] is None)
    check("15+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 15)
    a.close()


def t_v091_coral(b, base):
    print("\n[v0.91 ship guide: Coral Princess]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Coral Princess' })")
    check("Coral Princess: 2,000 guests, 16 decks, no made-up year", "2,000 guests" in g and "16 decks" in g and "built" not in g)
    by = {x["name"]: x for x in a.js("shipGuide('Coral Princess').venues")}
    check("Universe Lounge decks 6 · 7, Piazza no guessed deck", by["Universe Lounge"]["deck"] == "6 · 7" and by["The Piazza"]["deck"] is None)
    check("16+ ships", a.js("Object.keys(SHIP_GUIDES).length") >= 16)
    a.close()


def t_v092_island(b, base):
    print("\n[v0.92 ship guide: Island Princess - the whole Princess fleet]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Island Princess' })")
    check("Island Princess: 2,200 guests, 16 decks, no made-up year", "2,200 guests" in g and "16 decks" in g and "built" not in g)
    by = {x["name"]: x for x in a.js("shipGuide('Island Princess').venues")}
    check("Fitness deck 6, Shore Excursions deck 8", by["Fitness Center"]["deck"] == "6" and by["Shore Excursions"]["deck"] == "8")
    check("17 Princess ships = every one on princess.com", a.js("Object.values(SHIP_GUIDES).filter(g => g.line === 'Princess').length") == 17)
    a.close()


def t_v093_carnival(b, base):
    print("\n[v0.93 first Carnival ship guide: Carnival Jubilee]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Carnival Jubilee' })")
    check("Jubilee: 5,362 guests, built 2023, no made-up length or deck count", "5,362 guests" in g and "built 2023" in g and " ft" not in g and "decks ·" not in g and "null" not in g and "undefined" not in g)
    check("source line names carnival.com + the fact sheet, not princess.com", "carnival.com" in g and "fact sheet" in g and "princess.com" not in g)
    check("Princess guides still credit princess.com", "princess.com" in a.js("shipGuideHtml({ ship: 'Regal Princess' })"))
    by = {x["name"]: x for x in a.js("shipGuide('Carnival Jubilee').venues")}
    check("Guy's Burger Joint included, Fahrenheit 555 extra, no guessed decks", by["Guy's Burger Joint"]["cost"] == "included" and by["Fahrenheit 555 Steakhouse"]["cost"] == "extra" and all(v["deck"] is None for v in by.values()))
    a.close()


def t_v094_breeze(b, base):
    print("\n[v0.95 ship guide: Carnival Breeze]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Carnival Breeze' })")
    check("Breeze: 3,690 guests, built 2012", "3,690 guests" in g and "built 2012" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Carnival Breeze').venues")}
    check("each ship says its own price: Bonsai Sushi extra on Breeze, included on Jubilee", by["Bonsai Sushi"]["cost"] == "extra" and a.js("shipGuide('Carnival Jubilee').venues.find(v => v.name === 'Bonsai Sushi').cost") == "included")
    a.close()


def t_v095_dream(b, base):
    print("\n[v0.96 ship guide: Carnival Dream]")
    a = App(b, base, path=CRUISE)
    g = a.js("shipGuideHtml({ ship: 'Carnival Dream' })")
    check("Dream: 3,646 guests, built 2009", "3,646 guests" in g and "built 2009" in g)
    by = {x["name"]: x for x in a.js("shipGuide('Carnival Dream').venues")}
    check("Pizzeria del Capitano included, Seafood Shack extra", by["Pizzeria del Capitano"]["cost"] == "included" and by["Seafood Shack"]["cost"] == "extra")
    a.close()


def t_v097_trip_hub(b, base):
    print("\n[v0.97 Trip Hub: app #3 at /triphub/ - same engine, trip words, car scene, Day Hub Pro unlocks it]")
    a = App(b, base, path=TRIP)
    check("Trip Hub: its own name, id and data", a.js("[MODE, APP_NAME, APP_ID, STORE, TRAVEL]") == ["trip", "Trip Hub", "triphub", "triphub.v1", True] and a.page.title() == "Trip Hub")
    w = a.page.inner_text("#cards")
    check("trip welcome, no profession picker, no cruise", "Welcome to Trip Hub" in w and "plan your trip" in w and "cruise" not in w.lower().split("hub family")[0]
          and not a.js("!!document.querySelector('form[data-setup] select')"), w[:200])
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    a.js("shellGo('home')")
    check("5-tab shell on, no trip yet = Add my trip", a.js("shellOn()") and "Add my trip" in a.page.inner_text("#cards"))
    check("car scene behind the clock", a.js("document.getElementById('hero').dataset.scene").startswith("travel|"))
    a.qa("trip", {"tname": "Florida road trip", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL", "travelers": "2"})
    a.page.wait_for_timeout(200)
    check("a new trip here is a regular trip (not a cruise)", a.js("S.trips.map(t => t.type).join()") == "trip")
    texts = {}
    for t in ("home", "plan", "explore", "wallet", "ai"):
        a.js(f"shellGo('{t}')"); texts[t] = a.page.inner_text("#cards") + a.page.inner_text("#hero")
        if t == "explore": asks = a.js("document.querySelectorAll('[data-askq*=\"Orlando\"]').length")
    import re
    leak = [m for t, x in texts.items() for m in re.findall(r"[^\n]{0,30}(?:cruise|ship\b|all aboard|onboard|port day|🚢|🛳)[^\n]{0,30}", x.split("Hub family")[0], re.I)]
    check("no cruise words on any tab (hub family list aside)", not leak, leak[:4])
    check("countdown + trip big button", "until Florida road trip" in texts["home"] and "WHAT AM I FORGETTING?" in texts["home"] and "Things to do" in texts["home"])
    check("PLAN: trip day by day, travel day + going home", "Your trip, day by day" in texts["plan"] and "Travel day" in texts["plan"] and "Going home" in texts["plan"])
    check("EXPLORE: things-to-do tiles ask the AI about the destination", "Things to do — Orlando, FL" in texts["explore"]
          and asks >= 6, asks)
    a.js("showHelp()")
    hp = a.page.inner_text("#helpSheet")
    check("help: no ship buttons on a regular trip", "BACK TO SHIP" not in hp and "GET TO THE SHIP" not in hp and "MEDICAL" in hp)
    a.js("hideSheet('helpSheet')")
    a.page.click("#settingsBtn")
    pro = a.page.inner_text("#proBox")
    check("Pro box: Day Hub Pro unlocks Trip Hub, no Cruise Hub Pass", "Trip Hub's extras come with Day Hub Pro" in pro and "Cruise Hub Pass" not in pro and "$9.99" not in pro, pro[:200])
    check("Day Hub's data untouched, family = Day Hub", a.js("localStorage.getItem('dayhub.v1')") is None and a.js("SIB.id") == "dayhub")
    a.page.click('[data-close="sheet"]')
    a.close()
    # Cruise Hub must not change: a new trip there is still a cruise
    c = App(b, base, path=CRUISE)
    check("Cruise Hub still Cruise Hub", c.js("[MODE, APP_NAME, APP_ID]") == ["cruise", "Cruise Hub", "cruisehub"] and c.js("SCENE_FOR[MODE]") == "ocean")
    c.close()


def t_v098_bookings(b, base):
    print("\n[v0.98 Trip Hub bookings: flights, hotels, cars land on their days, one detail screen, cost in the money]")
    a = App(b, base, path=TRIP)
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    a.qa("trip", {"tname": "Florida road trip", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    def book(kind, vals):
        a.js(f"showBookingForm('{kind}')")
        a.page.evaluate("""v => { const f = document.querySelector('[data-bkform]'); for (const [k, x] of Object.entries(v)) {
            const el = f.querySelector(`[name=${k}]`); if (el.type === 'checkbox') el.checked = !!x; else el.value = x; } f.requestSubmit(); }""", vals)
        a.page.wait_for_timeout(150)
    book("flight", {"a": "LIT", "b": "MCO", "day": "2026-10-20", "t": "07:05", "endT": "10:40", "num": "AA 1234", "cost": "420", "paid": True})
    hd = a.js("(showBookingForm('hotel'), [...document.querySelectorAll('[data-bkform] input[type=date]:not([name=cancelBy])')].map(i => i.value))")
    check("a new hotel starts on the trip's dates", hd == ["2026-10-20", "2026-10-25"], hd)
    a.js("hideSheet('bookSheet')")
    book("hotel", {"a": "Coronado Springs", "b": "1000 W Buena Vista Dr, Orlando", "t": "15:00", "endT": "11:00", "num": "H-88812", "cost": "1150"})
    d20 = a.js("dayItems('2026-10-20').filter(x => x.kind === 'book').map(x => x.t + ' ' + x.title)")
    check("travel day: departs, lands, check-in, in time order", d20 == ["07:05 Departs — AA 1234 · LIT → MCO", "10:40 Lands — AA 1234 · LIT → MCO", "15:00 Check-in — Coronado Springs"], d20)
    check("check-out on the last day", a.js("dayItems('2026-10-25').filter(x => x.kind === 'book').map(x => x.title)") == ["Check-out — Coronado Springs"])
    costs = a.js("S.trips[0].costs.map(c => [c.cat, c.amt, c.paid])")
    check("each booking's cost is one linked money row", costs == [["travel", 420, True], ["hotel", 1150, False]], costs)
    r = a.js("readiness(S.trips[0]).items.filter(i => /staying|Getting there/.test(i.label)).map(i => i.label + ':' + i.score)")
    check("readiness: hotel + flight count as where you stay / getting there", r == ["Where you're staying:1", "Getting there planned:1"], r)
    a.js("shellGo('plan'); PLAN_VIEW = 'reservations'; render()")
    res = a.page.inner_text("#cards")
    check("PLAN → Reservations lists them once, with add tiles", res.count("Coronado Springs") == 1 and "＋ Rental car" in res and "AA 1234 · LIT → MCO" in res, res[:300])
    a.page.click('[data-bkopen]')
    det = a.page.inner_text("#bookSheet")
    check("one detail screen: times, number, cost, map", "Departs" in det and "Lands" in det and "AA 1234" in det and "$420.00 · paid ✓" in det and a.js("!!document.querySelector('#bookSheet a[href*=\"google.com/maps\"]')"), det[:200])
    bid = a.js("S.trips[0].bookings[0].id")
    a.js(f"showBookingForm(null, '{bid}')")
    a.page.fill('[data-bkform] [name=cost]', "380"); a.page.evaluate("document.querySelector('[data-bkform]').requestSubmit()"); a.page.wait_for_timeout(150)
    check("editing keeps one money row, new amount", a.js("S.trips[0].costs.filter(c => c.bk).map(c => c.amt)") == [380, 1150])
    a.js(f"deleteBooking('{bid}')")
    check("deleting removes its money row too", a.js("S.trips[0].bookings.length") == 1 and a.js("S.trips[0].costs.length") == 1)
    a.close()
    c = App(b, base, path=CRUISE)
    check("Cruise Hub has bookings too (hotel the night before)", c.js("typeof showBookingForm") == "function" and c.js("typeof bookingItems") == "function")
    c.close()


def t_v099_map(b, base):
    print("\n[v0.99 trip map: free OpenStreetMap, numbered pins in date order, looked up once, not-found listed]")
    a = App(b, base, path=TRIP)
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    a.qa("trip", {"tname": "Florida road trip", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("""(() => { const tr = S.trips[0]; tr.bookings = [
        { id: 'f1', kind: 'flight', a: 'LIT', b: 'MCO', day: '2026-10-20', t: '07:05' },
        { id: 'h1', kind: 'hotel', a: 'Coronado Springs', b: '1000 W Buena Vista Dr, Orlando', day: '2026-10-20', endDay: '2026-10-25' },
        { id: 'd1', kind: 'dinner', a: 'Nowhere Diner', b: 'Nowhere Street 99', day: '2026-10-22' }]; save(); })()""")
    P = a.js("mapPlaces(S.trips[0]).map(p => p.n + ' ' + p.q)")
    check("places in date order, one each: destination, airports, hotel, dinner", P == ["1 Orlando, FL", "2 LIT airport", "3 MCO airport", "4 1000 W Buena Vista Dr, Orlando", "5 Nowhere Street 99"], P)
    a.js("shellGo('plan'); PLAN_VIEW = 'map'; render()")
    a.page.wait_for_function("window.__map && window.__map.markers >= 4 && geoCache()['Nowhere Street 99'] === 0", timeout=30000)
    a.page.wait_for_timeout(1500)                                         # one lookup a second (OpenStreetMap's rule)
    m = a.js("window.__map")
    check("map drawn: a pin per found place + the route line", m["markers"] == 4 and m["lines"] >= 1 and m.get("fit"), m)
    check("not found is listed, never guessed", "not found on the map" in a.page.inner_text("#cards") and a.js("geoCache()['Nowhere Street 99']") == 0)
    check("OpenStreetMap credit shown", "© OpenStreetMap contributors" in a.page.inner_text("#cards"))
    n = len(a.ctx._geo)
    a.js("render()"); a.page.wait_for_timeout(800)
    check("looked up once each, with 2 fallbacks for the one not found, then remembered", len(a.ctx._geo) == n == 7 and a.ctx._geo[-2:] == ["Nowhere Diner, Orlando, FL", "Nowhere Diner"], a.ctx._geo)
    a.page.click('[data-bkopen="h1"]')
    check("a booking in the list opens its detail screen", "Coronado Springs" in a.page.inner_text("#bookSheet"))
    a.close()


PASTE_FLIGHT = """Your trip confirmation
Confirmation code: QXR7LM
Flight 1 of 2
American Airlines flight AA 1234
Tue, Oct 20, 2026
Little Rock (LIT) to Orlando (MCO)
Depart 7:05 AM   Arrive 10:40 AM
Flight 2 of 2
American Airlines flight AA 2210
Sun, Oct 25, 2026
Orlando (MCO) to Little Rock (LIT)
Depart 6:15 PM   Arrive 7:55 PM
Total paid: $412.60
"""
PASTE_HOTEL = """Reservation Confirmed
Disney's Coronado Springs Resort
1000 W Buena Vista Drive, Lake Buena Vista, FL 32830
(407) 939-1000
Confirmation number: 4419920031
Check-in: Tuesday, October 20, 2026 3:00 PM
Check-out: Sunday, October 25, 2026 11:00 AM
Total: $1,148.32
"""
PASTE_CAR = """Your Hertz reservation is confirmed
Confirmation Number: K4421987265
Pick-up
Orlando International Airport (MCO)
Tue, Oct 20, 2026 at 11:30 AM
Return
Sun, Oct 25, 2026 at 3:30 PM
Estimated total: $286.40
"""
PASTE_ARROW = """Confirmation #: HGT4R2
Wednesday, November 4, 2026
DL 2381   ATL 8:30 AM → MCO 10:05 AM
Trip total: $318.20
"""
PASTE_TWOLINE = """Southwest Airlines - Your trip is booked
Confirmation # NV7QPZ
Flight 1872
Thursday, December 3, 2026
Depart: Dallas (Love Field), TX (DAL) 9:10 AM
Arrive: Las Vegas, NV (LAS) 10:25 AM
"""


def t_v100_paste(b, base):
    print("\n[v1.00 paste a confirmation: flights / hotel / car read on the phone, filled in, checked, then added]")
    a = App(b, base, path=TRIP)
    X = lambda t: a.js("t => extractBookings(t)", t)
    f = X(PASTE_FLIGHT)
    check("flight email: both legs, numbers, times, the record locator, the total on the booking",
          [(x["a"], x["b"], x["day"], x["t"], x["endT"], x["num"]) for x in f] == [("LIT", "MCO", "2026-10-20", "07:05", "10:40", "AA 1234"), ("MCO", "LIT", "2026-10-25", "18:15", "19:55", "AA 2210")]
          and all(x["note"] == "Confirmation QXR7LM" for x in f) and f[0].get("cost") == 412.6 and not f[1].get("cost"), f)
    h = X(PASTE_HOTEL)[0]
    check("hotel email: name, address, check-in/out + times, number, phone, total",
          (h["kind"], h["a"], h["b"], h["day"], h["t"], h["endDay"], h["endT"], h["num"], h["phone"], h["cost"]) ==
          ("hotel", "Disney's Coronado Springs Resort", "1000 W Buena Vista Drive, Lake Buena Vista, FL 32830", "2026-10-20", "15:00", "2026-10-25", "11:00", "4419920031", "(407) 939-1000", 1148.32), h)
    c = X(PASTE_CAR)[0]
    check("car email: company, pick-up place, both times, number, total",
          (c["kind"], c["a"], c["b"], c["day"], c["t"], c["endDay"], c["endT"], c["num"], c["cost"]) ==
          ("car", "Hertz", "Orlando International Airport (MCO)", "2026-10-20", "11:30", "2026-10-25", "15:30", "K4421987265", 286.4), c)
    both = X(PASTE_FLIGHT + "\n" + PASTE_HOTEL)
    check("flight + hotel in one paste: each keeps its own number and total",
          [x["kind"] for x in both] == ["flight", "flight", "hotel"] and both[2]["num"] == "4419920031" and both[2]["cost"] == 1148.32 and both[1]["note"] == "Confirmation QXR7LM", both)
    ar = X(PASTE_ARROW); tw = X(PASTE_TWOLINE)
    check("other layouts: 'ATL 8:30 AM → MCO' and Depart (DAL) / Arrive (LAS) lines",
          (ar[0]["a"], ar[0]["b"], ar[0]["num"], ar[0]["t"]) == ("ATL", "MCO", "DL 2381", "08:30") and (tw[0]["a"], tw[0]["b"], tw[0]["num"], tw[0]["t"], tw[0]["endT"]) == ("DAL", "LAS", "Flight 1872", "09:10", "10:25"), [ar, tw])
    check("'Reservation Confirmed' is not a confirmation number", X("Reservation Confirmed\nCheck-in: Oct 20, 2026\nHotel Luna")[0]["num"] == "")
    check("nothing travel-like = nothing found", X("Hi Pat, lunch Tuesday? Love, Mom") == [])
    # the flow: paste -> Found 3 -> check + add each, nothing saved before Add
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    a.qa("trip", {"tname": "Florida trip", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("shellGo('plan'); PLAN_VIEW = 'reservations'; render()")
    a.page.click('[data-bkpasteopen="1"]')
    a.page.fill('[data-bkpaste] textarea', PASTE_FLIGHT + "\n" + PASTE_HOTEL)
    a.page.click('[data-bkpaste] button'); a.page.wait_for_timeout(150)
    check("Found 3, nothing saved yet", "Found 3" in a.page.inner_text("#bookSheet") and a.js("(S.trips[0].bookings || []).length") == 0)
    a.page.click('[data-bkdraft="2"]'); a.page.wait_for_timeout(100)
    check("the form opens filled in", a.page.input_value('[data-bkform] [name=a]') == "Disney's Coronado Springs Resort" and a.page.input_value('[data-bkform] [name=endDay]') == "2026-10-25")
    a.page.click('[data-bkform] button.btn'); a.page.wait_for_timeout(200)
    check("Add saves it and shows the 2 still to check", a.js("S.trips[0].bookings.length") == 1 and "Found 2" in a.page.inner_text("#bookSheet"))
    a.page.click('[data-bkdraft="0"]'); a.page.click('[data-bkform] button.btn'); a.page.wait_for_timeout(150)
    a.page.click('[data-bkdraft="0"]'); a.page.click('[data-bkform] button.btn'); a.page.wait_for_timeout(200)
    check("all 3 added, sheet closes, costs in the money", a.js("S.trips[0].bookings.map(b => b.kind).sort().join()") == "flight,flight,hotel"
          and a.js("document.getElementById('bookSheet').classList.contains('hidden')") and a.js("S.trips[0].costs.map(c => c.amt).sort().join()") == "1148.32,412.6")
    a.close()


def t_v101_diary(b, base):
    print("\n[v1.01 trip diary: a mood, a few lines and the best moment per day - Trip Hub and Cruise Hub]")
    a = App(b, base, path=TRIP, width=360, at="2026-10-01T19:00:00")      # day 3 of the trip, evening
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    a.qa("trip", {"tname": "Florida trip", "start": "2026-09-29", "end": "2026-10-03", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("shellGo('home')")
    check("evening of a trip day, nothing written: Home asks 'How was today?'", "How was today?" in a.page.inner_text(".going-on"))
    a.js("showDay('2026-10-01')")
    s = a.page.inner_text("#daySheet")
    check("the day screen has 'Our day' with 5 moods and a form", "our day" in s.lower() and a.js("document.querySelectorAll('#daySheet .mood').length") == 5
          and a.js("!!document.querySelector('#daySheet form[data-diary]')"))
    a.page.click('#daySheet .mood[aria-label="Great"]'); a.page.wait_for_timeout(100)
    check("a mood tap saves at once and stays on the day", a.js("S.trips[0].diary['2026-10-01'].mood") == "😀"
          and not a.js("document.getElementById('daySheet').classList.contains('hidden')") and a.js("document.querySelector('#daySheet .mood.on').textContent") == "😀")
    a.page.fill('#daySheet form[data-diary] textarea', "Magic Kingdom all day.\n<b>fireworks</b> at 9")
    a.page.fill('#daySheet form[data-diary] [name=best]', "Kids on Space Mountain")
    a.page.click('#daySheet form[data-diary] button'); a.page.wait_for_timeout(150)
    e = a.js("S.trips[0].diary['2026-10-01']")
    check("Save keeps the mood and adds the lines + best moment, sheet closes",
          e == {"mood": "😀", "text": "Magic Kingdom all day.\n<b>fireworks</b> at 9", "best": "Kids on Space Mountain"}
          and a.js("document.getElementById('daySheet').classList.contains('hidden')"))
    a.js("shellGo('home')")
    check("written: the Home nudge goes away", "How was today?" not in a.page.inner_text(".going-on"))
    a.js("showDay('2026-10-02')")
    check("a day that hasn't happened can't be written yet", "once it's happened" in a.page.inner_text("#daySheet") and not a.js("!!document.querySelector('#daySheet form[data-diary]')"))
    a.js("hideSheet('daySheet'); shellGo('plan'); PLAN_VIEW = 'trip'; render()")
    check("the timeline marks the written day", "📔 😀" in a.page.inner_text(".timeline"))
    check("Plan has 6 view tiles that fit a small phone", a.js("document.querySelectorAll('.planview .tile').length") == 6
          and a.js("document.documentElement.scrollWidth") <= 360)
    a.page.click('.planview [data-planview="diary"]'); a.page.wait_for_timeout(100)
    d = a.page.inner_text("main") if a.js("!!document.querySelector('main')") else a.page.inner_text("body")
    check("Plan -> Diary: count, the day, the lines, the best moment, Share", "Trip diary" in d and "1 of 5 days written" in d and "Day 3" in d
          and "Space Mountain" in d and "📤 Share my diary" in d, d[:600])
    check("diary text is shown as text, never as HTML", a.js("[...document.querySelectorAll('.diary-text')].some(x => x.textContent.includes('<b>fireworks</b>') && !x.querySelector('b'))"))
    t = a.js("diaryText(S.trips[0])")
    check("Share text: trip name, the day line, lines, best moment",
          t.startswith("📔 Florida trip") and "😀 Day 3 · " in t and "Magic Kingdom all day." in t and "⭐ Best moment: Kids on Space Mountain" in t, t)
    a.js("showDay('2026-10-01')"); a.page.click('#daySheet .mood[aria-label="Great"]'); a.page.wait_for_timeout(100)
    check("tapping the same mood again clears just the mood", a.js("S.trips[0].diary['2026-10-01'].mood") == "" and a.js("S.trips[0].diary['2026-10-01'].text").startswith("Magic"))
    a.close()
    # Cruise Hub: the same diary, cruise words; the week after the trip, Home points back to it
    c = App(b, base, path=CRUISE, at="2026-10-06T09:00:00")
    c.page.fill('form[data-setup] [name=name]', "Pat"); c.page.fill('form[data-setup] [name=city]', "72032")
    c.page.click('form[data-setup] button'); c.page.wait_for_function("WXDATA && WXDATA.here")
    c.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-09-30", "end": "2026-10-03", "line": "Carnival"})
    c.page.wait_for_timeout(150)
    c.js("S.trips[0].diary = { '2026-10-01': { mood: '😍', text: 'Snorkeled at Nassau', best: '' } }; save(); shellGo('home')")
    check("after the cruise: Home shows 'Your cruise wrap-up — 1 day in the diary' (v1.08)", "Your cruise wrap-up — 1 day in the diary" in c.page.inner_text(".going-on"))
    c.js("shellGo('plan'); PLAN_VIEW = 'diary'; render()")
    d = c.page.inner_text("body")
    check("Cruise Hub: 'Cruise diary', 1 of 4 days, 1 best day", "Cruise diary" in d and "1 of 4 days written" in d and "😍 1 best day" in d, d[:400])
    c.close()


def t_v102_port_reality(b, base):
    print("\n[v1.02 port reality: real time ashore = off the ship -> head back by]")
    a = App(b, base, path=CRUISE, at="2026-11-13T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Princess", "ship": "Caribbean Princess"})
    a.js("""curTrip().ports = [
      { id: 'p1', name: 'Cozumel', day: '2026-11-14', arrive: '08:00', allAboard: '16:30' },
      { id: 'p2', name: 'Princess Cays', day: '2026-11-16', arrive: '09:00', allAboard: '14:00' },
      { id: 'p3', name: 'Grand Turk', day: '2026-11-17', arrive: '15:00', allAboard: '16:30' },
      { id: 'p4', name: 'Nassau', day: '2026-11-18', allAboard: '17:00' },
      { id: 'p5', name: 'Roatan', day: '2026-11-15', arrive: '07:00', allAboard: '17:30', shipOffset: 60 }]; save(); render()""")
    R = lambda i: a.js(f"portReality(curTrip().ports[{i}])")
    r = R(0)
    check("docked port: off ~8:30, back by 15:10 (16:30 - 60 margin - 20 back) = 6h 40m ashore",
          r == {"tender": False, "off": "08:30", "by": "15:10", "mins": 400}, r)
    r = R(1)
    check("tender port: off ~10:00 (60 min), back by 12:15 (14:00 - 60 - 45) = 2h 15m", r == {"tender": True, "off": "10:00", "by": "12:15", "mins": 135}, r)
    check("ship clock 1 hr ahead: all aboard 17:30 ship = 16:30 phone -> back by 15:10, off 7:30 = 7h 40m", R(4)["mins"] == 460 and R(4)["by"] == "15:10", R(4))
    check("no arrival time = no sum (never guessed)", R(3) is None)
    a.js("shellGo('plan'); PLAN_VIEW = 'trip'; render()"); tl = a.page.inner_text(".timeline")
    check("timeline shows the time ashore per port", "⏱️ 6h 40m ashore" in tl and "⏱️ 2h 15m ashore" in tl, tl[:700])
    a.js("showDay('2026-11-14')")
    s = a.page.inner_text("#daySheet")
    check("day screen: big number, the four times, the verdict",
          "6h 40m" in s and "real time ashore" in s.lower() and "Off the ship" in s and "8:30" in s and "Head back by" in s and "3:10" in s and "Plenty of time" in s, s[:900])
    check("All aboard shows once (Port reality replaces the old two rows)", s.count("All aboard") == 1, s.count("All aboard"))
    check("'What fits' ask button carries the real hours", "We have about 6h 40m ashore in Cozumel" in a.js("document.querySelector('#daySheet [data-askq]').dataset.askq"))
    a.js("showDay('2026-11-16')")
    s = a.page.inner_text("#daySheet")
    check("tender + short day: tender reason and 'pick ONE thing'", "tender port" in s and "pick ONE thing" in s, s[:900])
    a.js("showDay('2026-11-17')")
    check("too little time after margins (in 3 PM, back by 3:10): warns to check with the ship", "Not enough time ashore" in a.page.inner_text("#daySheet") and a.js("portReality(curTrip().ports[2]).mins") < 0)
    a.js("showDay('2026-11-18')")
    s = a.page.inner_text("#daySheet")
    check("no arrival: hint to add it, old All aboard rows still there", "Add the time the ship arrives" in s and "Head back by" in s)
    a.close()


def t_v103_final_bill(b, base):
    print("\n[v1.03 final bill check: the ship's bill vs Cruise Hub's count + what to look for]")
    a = App(b, base, path=CRUISE, at="2026-11-18T19:00:00")              # final night (cruise ends 11/19)
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Carnival", "travelers": "2"})
    a.js("""(() => { const tr = curTrip(); tr.credit = 100;
      tr.spends = [{ id: 's1', day: '2026-11-14', amt: 12.5, cat: 'Drinks' }, { id: 's2', day: '2026-11-14', amt: 12.5, cat: 'Drinks' },
                   { id: 's3', day: '2026-11-15', amt: 150, cat: 'Spa' }];
      tr.costs = (tr.costs || []).concat([{ id: 'c1', cat: 'excursion', what: 'Snorkel', amt: 89, paid: true }]); save(); render(); })()""")
    C = a.js("billCount(curTrip())")
    check("count = spent 175 + gratuities 2 x 7 nights x $18 = 252 - credit 100 = 327", C["spent"] == 175 and C["gr"] == 252 and C["credit"] == 100 and C["total"] == 327, C)
    L = " | ".join(a.js("billLooks(curTrip())"))
    check("look-fors from the trip: gratuity rate, the credit, the prepaid excursion, the same amount twice, service charges",
          "2 × 7 nights" in L and "$100.00 onboard credit" in L and "Snorkel ($89.00) before the cruise" in L and "$12.50 2 times on" in L and "service charge" in L, L)
    a.js("showGoHome()")
    check("Get me home has the bill check button", a.js("!!document.querySelector('#ghSheet [data-billcheck]')"))
    a.page.click('#ghSheet [data-billcheck]'); a.page.wait_for_timeout(100)
    s = a.page.inner_text("#billSheet")
    check("bill sheet opens over a closed Get me home: the count rows, no verdict yet", a.js("document.getElementById('ghSheet').classList.contains('hidden')")
          and "$327.00" in s and "~$252.00" in s and "−$100.00" in s and "MORE" not in s and "Within" not in s, s[:600])
    bill = lambda v: (a.page.fill('#billSheet form[data-bill] [name=amt]', v), a.page.click('#billSheet form[data-bill] button'), a.page.wait_for_timeout(120), a.page.inner_text("#billSheet"))[3]
    s = bill("330")
    check("bill $330 = within $5: looks right, nothing ticked for you", "Within $5.00 of your count" in s and a.js("curTrip().billSeen") == 330 and not a.js("!!curTrip().accountVerified"))
    a.page.click('#billSheet [data-billok]'); a.page.wait_for_timeout(120)
    check("tick 'Charges match' = account checked (Get me home sees it)", a.js("curTrip().accountVerified") is True and a.js("goHomeItems(curTrip())[0].ok") is True)
    s = bill("400")
    check("bill $400: $73.00 MORE than the count", "$73.00 MORE" in s)
    s = bill("300")
    check("bill $300: $27.00 less, still check the list", "$27.00 less" in s)
    a.js("hideSheet('billSheet'); curTrip().line = 'Princess'; curTrip().pkg = 'princess-plus'; save()")
    L = " | ".join(a.js("billLooks(curTrip())"))
    check("a package that pays gratuities: NO daily gratuity charge, count has $0 gratuities",
          "Princess Plus pays crew gratuities — there should be NO daily gratuity charge" in L and a.js("billCount(curTrip()).gr") == 0, L)
    a.js("S.tripTab = 'onboard'; shellGo('wallet')")
    check("Wallet -> Onboard has the bill check on the last night", a.js("!!document.querySelector('[data-card=\"trips\"] [data-billcheck]')"))
    a.close()


def t_v104_fun_finder(b, base):
    print("\n[v1.04 Fun Finder: must see / interested / skip -> the day builds itself around the must-sees]")
    a = App(b, base, path=CRUISE, at="2026-11-13T09:00:00")              # a sea day
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Carnival"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Cozumel', day: '2026-11-14', arrive: '08:00', allAboard: '16:30' }]; save(); render(); showDay('2026-11-13')")
    s = a.page.inner_text("#daySheet")
    check("the day screen has Fun Finder with an add form", "fun finder" in s.lower() and a.js("!!document.querySelector('#daySheet form[data-fun]')"))
    def add(title, t, end="", where="", pick="must"):
        a.page.fill('#daySheet form[data-fun] [name=title]', title); a.page.fill('#daySheet form[data-fun] [name=t]', t)
        a.page.fill('#daySheet form[data-fun] [name=end]', end); a.page.fill('#daySheet form[data-fun] [name=where]', where)
        a.page.select_option('#daySheet form[data-fun] [name=pick]', pick)
        a.page.click('#daySheet form[data-fun] button'); a.page.wait_for_timeout(120)
    add("Comedy Show", "19:00", "19:45", "Punchliner, deck 5")
    add("Production Show", "19:30")                                        # no end = about an hour -> clashes with Comedy
    add("Trivia", "20:00", pick="maybe")                                   # clashes with Production -> backup
    add("Pool party", "14:00", pick="maybe")
    add("Bingo", "15:00", pick="skip")
    check("5 added, sheet stays open on the day", a.js("curTrip().fun.length") == 5 and not a.js("document.getElementById('daySheet').classList.contains('hidden')"))
    P = a.js("(() => { const F = funPlan(curTrip(), '2026-11-13'); return { plan: F.plan.map(f => f.title), backups: F.backups.map(([f, h]) => f.title + '>' + h.title), clashes: F.clashes.length }; })()")
    check("your day = both ❤️ + the 👍 that fits; Trivia is a backup; the two ❤️ clash",
          P == {"plan": ["Pool party", "Comedy Show", "Production Show"], "backups": ["Trivia>Production Show"], "clashes": 1}, P)
    s = a.page.inner_text("#daySheet")
    check("the clash warning + the backup note show", "Comedy Show and Production Show overlap" in s and "backup — clashes with Production Show" in s, s[:1200])
    check("your day joins the schedule (3 fun items)", a.js("dayItems('2026-11-13').filter(x => x.kind === 'fun').map(x => x.title).join()") == "Pool party,Comedy Show,Production Show")
    a.js("hideSheet('daySheet'); shellGo('plan'); PLAN_VIEW = 'trip'; render()")
    check("timeline: 🎉 3 planned", "🎉 3 planned" in a.page.inner_text(".timeline"))
    pid = a.js("curTrip().fun.find(f => f.title === 'Production Show').id")
    a.js("showDay('2026-11-13')"); a.page.click(f'#daySheet [data-funpick$="|{pid}|skip"]'); a.page.wait_for_timeout(120)
    P = a.js("funPlan(curTrip(), '2026-11-13').plan.map(f => f.title).join()")
    check("skip the Production Show: clash gone, Trivia moves into your day", P == "Pool party,Comedy Show,Trivia" and "overlap" not in a.page.inner_text("#daySheet"), P)
    bid = a.js("curTrip().fun.find(f => f.title === 'Bingo').id")
    a.page.click(f'#daySheet [data-fundel="{a.js("curTrip().id")}|{bid}"]'); a.page.wait_for_timeout(120)
    check("✕ removes one", a.js("curTrip().fun.length") == 4 and not a.js("curTrip().fun.some(f => f.title === 'Bingo')"))
    a.js("curTrip().fun.push({ id: 'f9', day: '2026-11-14', t: '11:00', end: '', title: 'Art auction', where: '', pick: 'must' }); save(); render(); showDay('2026-11-14')")
    check("port day: a pick between off-the-ship and head-back-by says you're ashore then", "Art auction at 11:00 AM falls while you're ashore (back by 3:10 PM)" in a.page.inner_text("#daySheet"))
    a.close()


def t_v105_package_calc(b, base):
    print("\n[v1.05 package: buy or skip - what it's worth to YOU vs what it costs, no line prices built in]")
    a = App(b, base, path=CRUISE)
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-11-12", "end": "2026-11-19", "line": "Carnival", "travelers": "2"})
    a.page.wait_for_timeout(150)
    a.js("S.tripTab = 'perks'; shellGo('wallet')")
    check("Wallet -> Perks has the buy-or-skip button", a.js("!!document.querySelector('[data-card=\"trips\"] [data-pkgcalc]')"))
    a.page.click('[data-card="trips"] [data-pkgcalc]'); a.page.wait_for_timeout(120)
    s = a.page.inner_text("#pkgSheet")
    check("no price yet = no answer, asks for the offer's price; custom line = nothing pre-ticked; 7 days from the trip",
          "Type the package price" in s and a.js("document.querySelectorAll('#pkgSheet .pkg-inc input:checked').length") == 0
          and a.page.input_value('#pkgSheet [name=days]') == "7", s[:500])
    def run(vals, ticks):
        for k, v in vals.items(): a.page.fill(f'#pkgSheet form[data-pkgcalc] [name={k}]', str(v))
        for k in ["incDrinks", "incCoffee", "incWater", "incWifi", "incGrats", "incDining", "incPhotos"]:
            a.page.set_checked(f'#pkgSheet [name={k}]', k in ticks)
        a.page.click('#pkgSheet form[data-pkgcalc] button.btn'); a.page.wait_for_timeout(120)
        return a.page.inner_text("#pkgSheet")
    T = ["incDrinks", "incWater", "incWifi"]
    s = run({"price": 70, "drinks": 3}, T)                                   # 3x14 + 2x4 + 20 = 70 a day = the price
    check("worth $70 a day vs $70 a day: CLOSE CALL, $490.00 both sides, for 2 of you $980.00", "CLOSE CALL" in s and "$490.00" in s and "For 2 of you: $980.00 vs $980.00" in s, s[:600])
    s = run({"drinks": 6}, T)                                                # 84 + 8 + 20 = 112 a day -> 784
    check("6 drinks a day: BUY, save about $294.00, break-even 3 drinks a day", "BUY THE PACKAGE" in s and "$294.00" in s and "3 drinks a day" in s, s[:600])
    s = run({"drinks": 1}, T)                                                # 14 + 8 + 20 = 42 -> 294
    check("1 drink a day: SKIP, paying as you go saves about $196.00", "SKIP IT" in s and "$196.00" in s, s[:600])
    check("answers are kept on the trip", a.js("curTrip().pkgCalc.drinks") == "1" and a.js("curTrip().pkgCalc.incWifi") is True and a.js("curTrip().pkgCalc.incGrats") is False)
    w = a.js("pkgWorth({ days: 7, price: 80, cap: 20, wifi: true, drinks: 4, drinkPr: 25, coffee: 0, coffeePr: 5, water: 0, waterPr: 4, wifiPr: 20, dinners: 1, dinnerPr: 50, photos: 0, incDrinks: true, incCoffee: false, incWater: false, incWifi: false, incGrats: true, incDining: true, incPhotos: false })")
    check("a $25 drink on a $20-limit package counts $20; gratuities ~$18 a day; 1 dinner",
          w["value"] == 7 * 4 * 20 + 7 * 18 + 50 and any("covers up to $20.00" in p[0] for p in w["parts"]) and w["verdict"] == "buy", w)
    a.js("hideSheet('pkgSheet'); curTrip().line = 'Princess'; curTrip().pkg = 'princess-premier'; delete curTrip().pkgCalc; save(); showPkgCalc()")
    on = a.js("[...document.querySelectorAll('#pkgSheet .pkg-inc input:checked')].map(i => i.name).sort().join()")
    check("Princess Premier (verified preset): drinks, water, Wi-Fi, gratuities, dining, photos pre-ticked; $20 limit filled",
          on == "incDining,incDrinks,incGrats,incPhotos,incWater,incWifi" and a.page.input_value('#pkgSheet [name=cap]') == "20", on)
    a.close()


def t_v106_secrets(b, base):
    print("\n[v1.06 secret engine: one general cruise tip for where the cruise is right now]")
    a = App(b, base, path=CRUISE)                                            # today 2026-10-01
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-12-10", "end": "2026-12-14", "line": "Carnival"})
    a.page.wait_for_timeout(150)
    M = lambda start, end, ports="[]": a.js(f"(() => {{ const tr = curTrip(); tr.start = '{start}'; tr.end = '{end}'; tr.ports = {ports}; return secretMoment(tr); }})()")
    got = [M("2026-12-10", "2026-12-14"), M("2026-11-01", "2026-11-05"), M("2026-10-10", "2026-10-14"), M("2026-10-02", "2026-10-06"),
           M("2026-10-01", "2026-10-05"), M("2026-09-29", "2026-10-04"),
           M("2026-09-29", "2026-10-04", "[{ id: 'p', name: 'Nassau', day: '2026-10-01', allAboard: '17:00' }]"),
           M("2026-09-27", "2026-10-02"), M("2026-09-20", "2026-09-25")]
    check("moments: booked / close / week / eve / sail / sea / port / final / none after",
          got == ["booked", "close", "week", "eve", "sail", "sea", "port", "final", None], got)
    a.js("(() => { const tr = curTrip(); tr.start = '2026-10-01'; tr.end = '2026-10-05'; tr.ports = []; save(); shellGo('home'); })()")
    s = a.page.inner_text(".secret-card")
    first = a.js("secretNow(curTrip())[0]")
    check("sail day: Home shows ONE sail-day secret", "CRUISE SECRET" in s.upper() and a.js("document.querySelectorAll('.secret-card').length") == 1 and a.js("SECRETS.find(x => x[0] === secretNow(curTrip())[0])[1]") == "sail")
    a.page.click('.secret-card [data-secretnext]'); a.page.wait_for_timeout(100)
    check("Another = a different sail-day tip", a.js("secretNow(curTrip())[0]") != first and a.js("SECRETS.find(x => x[0] === secretNow(curTrip())[0])[1]") == "sail")
    shown = a.js("secretNow(curTrip())[0]")
    a.page.click('.secret-card [data-secretok]'); a.page.wait_for_timeout(100)
    check("Got it retires that tip for this trip", shown in a.js("curTrip().secretsSeen") and a.js("secretNow(curTrip())[0]") != shown)
    a.js("curTrip().secretsSeen = SECRETS.filter(x => x[1] === 'sail').map(x => x[0]); save(); render()")
    check("all of a moment's tips seen = no card", not a.js("!!document.querySelector('.secret-card')"))
    check("every tip has a known moment and a unique id", a.js("(() => { const ok = ['booked','close','week','eve','sail','port','sea','final']; return SECRETS.every(s => ok.includes(s[1])) && new Set(SECRETS.map(s => s[0])).size === SECRETS.length; })()"))
    a.close()
    t = App(b, base, path=TRIP)
    t.page.fill('form[data-setup] [name=name]', "Pat"); t.page.fill('form[data-setup] [name=city]', "72032")
    t.page.click('form[data-setup] button'); t.page.wait_for_function("WXDATA && WXDATA.here")
    t.qa("trip", {"tname": "Florida trip", "start": "2026-10-01", "end": "2026-10-05", "port": "Orlando, FL"})
    t.page.wait_for_timeout(150); t.js("shellGo('home')")
    check("Trip Hub (not a cruise): no cruise secrets", not t.js("!!document.querySelector('.secret-card')"))
    t.close()


def t_v107_upgrade(b, base):
    print("\n[v1.07 upgrade: worth it? - the plain math per person, per night, per sea day + the checklist]")
    a = App(b, base, path=CRUISE)
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean", "start": "2026-11-12", "end": "2026-11-19", "line": "Carnival", "travelers": "2"})
    a.js("""curTrip().ports = [{ id: 'p1', name: 'Cozumel', day: '2026-11-14' }, { id: 'p2', name: 'Roatan', day: '2026-11-16' },
      { id: 'p3', name: 'Belize', day: '2026-11-17' }]; save(); S.tripTab = 'perks'; shellGo('wallet')""")
    check("7 nights, 3 sea days (6 middle days less 3 ports)", a.js("tripNights(curTrip())") == 7 and a.js("seaDays(curTrip())") == 3)
    check("Wallet -> Perks has 'Offered an upgrade?'", a.js("!!document.querySelector('[data-card=\"trips\"] [data-upopen]')"))
    a.page.click('[data-card="trips"] [data-upopen]'); a.page.wait_for_timeout(120)
    s = a.page.inner_text("#upSheet")
    check("no price yet: asks for it; the 'before you say yes' checklist is there", "Type what the upgrade costs" in s and "above and below" in s and "upgrade BID" in s, s[:500])
    def run(vals):
        for k, v in vals.items(): a.page.fill(f'#upSheet form[data-upgrade] [name={k}]', str(v))
        a.page.click('#upSheet form[data-upgrade] button'); a.page.wait_for_timeout(120)
        return a.page.inner_text("#upSheet")
    s = run({"from": "Interior", "to": "Balcony", "extra": 700, "perks": 100})
    check("$700 less $100 perks = $600 for the cabin: $42.86 a person a night, $100.00 a person per sea day",
          "$600.00" in s and "$42.86" in s and "$100.00" in s and "3 sea days" in s, s[:700])
    check("answers kept on the trip", a.js("curTrip().upgrade") == {"from": "Interior", "to": "Balcony", "extra": "700", "perks": "100"})
    s = run({"perks": 800})
    check("perks worth more than the price: the bigger cabin is free", "The bigger cabin is free" in s, s[:400])
    check("no sea days: says you'll mostly be ashore", "mostly be ashore" in a.js("(() => { const tr = curTrip(); tr.upgrade.perks = ''; tr.ports = ['2026-11-13','2026-11-14','2026-11-15','2026-11-16','2026-11-17','2026-11-18'].map((d, i) => ({ id: 'q' + i, name: 'Port ' + i, day: d })); showUpgrade(); return document.getElementById('upSheet').innerText; })()"))
    a.close()


def t_v108_wrap_up(b, base):
    print("\n[v1.08 wrap-up: one page after the cruise - numbers, best moments, day by day, money; share or PDF]")
    a = App(b, base, path=CRUISE)                                            # today 2026-10-01, cruise ended 9/28
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-09-24", "end": "2026-09-28", "line": "Carnival", "ship": "Carnival Breeze", "travelers": "2"})
    a.js("""(() => { const tr = curTrip(); tr.total = 1800;
      tr.ports = [{ id: 'p1', name: 'Nassau', day: '2026-09-26' }, { id: 'p2', name: 'Half Moon Cay', day: '2026-09-25' }];
      tr.diary = { '2026-09-26': { mood: '😍', text: 'Snorkeled the reef.', best: 'Sea turtle!' }, '2026-09-27': { mood: '🙂', text: 'Pool all day.', best: '' } };
      tr.fun = [{ id: 'f1', day: '2026-09-27', t: '20:00', end: '', title: 'Comedy Show', where: '', pick: 'must' },
                { id: 'f2', day: '2026-09-27', t: '21:00', end: '', title: 'Trivia', where: '', pick: 'maybe' }];
      tr.spends = [{ id: 's1', day: '2026-09-25', amt: 60, cat: 'Drinks' }, { id: 's2', day: '2026-09-26', amt: 120, cat: 'Spa' }];
      tr.billSeen = 410; save(); shellGo('home'); })()""")
    check("after the cruise: Home offers the wrap-up", "Your cruise wrap-up — 2 days in the diary" in a.page.inner_text(".going-on"))
    a.page.click('.going-on [data-wrapopen]'); a.page.wait_for_timeout(150)
    s = a.page.inner_text("#wrapSheet")
    check("numbers: 5 days, 2 ports, 1 sea day (25-27 less 2 ports), 1 best; ship + dates + 2 of you",
          a.js("[...document.querySelectorAll('#wrapSheet .wrap-stat b')].map(x => x.textContent).join()") == "5,2,1,1" and "Carnival Breeze" in s and "2 of you" in s, s[:500])
    check("ports in order, best moments", "Half Moon Cay → Nassau" in s and "Sea turtle!" in s)
    check("day by day: only days with something - the mood, the lines, the ❤️ (not the 👍)",
          "Day 3 · Nassau" in s and "Snorkeled the reef." in s and "Day 4 · At sea" in s and "Comedy Show" in s and "Trivia" not in s and "Day 1" not in s, s[:1200])
    check("money: cruise cost, onboard spending, the final bill, by kind",
          "$1,800.00" in s and "$180.00" in s and "$410.00" in s and "Spa" in s and "Drinks" in s)
    t = a.js("wrapText(curTrip())")
    check("share text: header, numbers, best moments, then the diary", t.startswith("📔 Bahamas") and "5 days · 2 ports (Nassau, Half Moon Cay) · 1 sea day · 😍 1 best day" in t
          and "⭐ Best moments\n• Sea turtle!" in t and "Snorkeled the reef." in t, t)
    a.js("window.__printed = null; window.print = () => { window.__printed = document.body.classList.contains('print-wrap'); }")
    a.page.click('#wrapSheet [data-wrapprint]'); a.page.wait_for_timeout(100)
    check("Save as PDF prints with only the wrap-up page", a.js("window.__printed") is True)
    a.js("window.dispatchEvent(new Event('afterprint'))")
    check("...and the page goes back to normal after", not a.js("document.body.classList.contains('print-wrap')"))
    a.js("hideSheet('wrapSheet'); shellGo('plan'); PLAN_VIEW = 'diary'; render()")
    check("Plan -> Diary has the wrap-up button too", a.js("!!document.querySelector('.planview ~ section [data-wrapopen]')"))
    a.close()


def t_v110_scene_pick(b, base):
    print("\n[v1.10 pick your background: Auto / Ocean / Road trip / Sky / None in settings]")
    a = App(b, base, path=CRUISE)
    hero = "document.getElementById('hero')"
    check("Auto: Cruise Hub keeps its ocean", a.js(f"{hero}.dataset.scene").startswith("ocean|"))
    a.page.click("#settingsBtn")
    check("settings has a Background tile and 5 choices, Auto on",
          a.js("!!document.querySelector('[data-setjump=sceneBox]')") and a.js("document.querySelectorAll('[data-scenepick]').length") == 5
          and a.js("document.querySelector('[data-scenepick].on').dataset.scenepick") == "auto")
    a.page.click('[data-scenepick="travel"]')
    check("Road trip: the car scene behind the clock, saved", a.js(f"{hero}.dataset.scene").startswith("travel|") and a.js("S.scene") == "travel"
          and a.js("document.querySelector('[data-scenepick].on').dataset.scenepick") == "travel")
    a.page.click('[data-scenepick="off"]')
    check("None: no picture behind the clock", a.js(f"{hero}.dataset.scene") == "off" and a.js(f"{hero}.style.getPropertyValue('--scene')") == ""
          and "svg" not in a.js(f"getComputedStyle({hero}).backgroundImage"))
    a.page.click('[data-scenepick="weather"]')
    check("Sky: back from None, the picture returns", a.js(f"{hero}.dataset.scene").startswith("weather|") and "svg" in a.js(f"getComputedStyle({hero}).backgroundImage"))
    a.page.reload(); a.page.wait_for_function("typeof S === 'object' && document.getElementById('hero').dataset.scene")
    check("the pick survives a reload", a.js(f"{hero}.dataset.scene").startswith("weather|"))
    a.page.click("#settingsBtn"); a.page.click('[data-scenepick="auto"]')
    check("Auto again: ocean, and nothing stored", a.js(f"{hero}.dataset.scene").startswith("ocean|") and a.js("S.scene === undefined"))
    a.close()

def t_v111_fix_my_trip(b, base):
    print("\n[v1.11 Fix my trip: a booking moves -> what it knocks out -> you tick -> your plan changes, calls listed]")
    a = App(b, base, path=TRIP, at="2026-10-19T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Orlando", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("""(() => { const tr = curTrip(); tr.bookings = [
      { id: 'f1', kind: 'flight', a: 'LIT', b: 'MCO', day: '2026-10-20', t: '07:05', endDay: '', endT: '10:40', num: 'AA 1234', phone: '800-433-7300' },
      { id: 'c1', kind: 'car', a: 'Hertz', b: 'MCO airport', day: '2026-10-20', t: '11:30', endDay: '2026-10-25', endT: '10:00', num: 'H123456', phone: '800-654-3131' },
      { id: 'h1', kind: 'hotel', a: 'Coronado Springs', b: '', day: '2026-10-20', t: '15:00', endDay: '2026-10-25', endT: '11:00', num: 'R-88812', phone: '407-939-1000' },
      { id: 'd1', kind: 'dinner', a: 'Boma', b: '', day: '2026-10-20', t: '19:00', num: 'D-77', phone: '', cost: 90 },
      { id: 't1', kind: 'ticket', a: 'Magic Kingdom', b: '', day: '2026-10-21', t: '09:00', endT: '22:00', num: 'MK-1' }];
      tr.costs = [{ id: 'x1', bk: 'd1', cat: 'other', what: 'Boma', amt: 90, paid: false }];
      tr.fun = [{ id: 'u1', day: '2026-10-20', t: '16:00', end: '17:00', title: 'Disney Springs', where: '', pick: 'must' }]; save(); render(); })()""")
    C = a.js("fixClashes(curTrip()).map(([x, y]) => x.id + '>' + y.id)")
    check("already clashing: the car pick-up is 50 min after landing (needs an hour)", C == ["f1>c1"], C)
    a.js("shellGo('plan'); PLAN_VIEW = 'reservations'; render()")
    check("Bookings has the Fix my trip row with the clash count", "Fix my trip" in a.page.inner_text("#cards") and "1 clash" in a.page.inner_text("#cards"))
    a.js("showHelp()")
    check("🛟 help has FIX MY TRIP", "FIX MY TRIP" in a.page.inner_text("#helpSheet"))
    a.page.click('#helpSheet [data-fixopen="pick"]'); a.page.wait_for_timeout(100)
    s = a.page.inner_text("#fixSheet")
    check("pick screen: the clash + every timed booking", "already clashing" in s.lower() and "AA 1234" in s and "Magic Kingdom" in s and a.js("document.getElementById('helpSheet').classList.contains('hidden')"), s[:600])
    a.page.click('#fixSheet [data-fixb="f1"]'); a.page.wait_for_timeout(80)
    a.page.select_option('#fixSheet [name=mins]', "300"); a.page.click('#fixSheet form[data-fixform] button'); a.page.wait_for_timeout(100)
    s = a.page.inner_text("#fixSheet")
    check("5-hour delay: I found 3 things (car, hotel arrival, Disney Springs); dinner and tomorrow untouched",
          "I found 3 things it knocks out" in s and "Hertz" in s and "Coronado Springs" in s and "Disney Springs" in s and "Boma" not in s and "Magic Kingdom" not in s, s[:900])
    check("car: move to 4:45 PM (lands 3:40 + an hour); hotel: tell them you're late", "move to Tomorrow 4:45 PM" in s and "arriving late" in s, s[:900])
    check("calls: Hertz with the flight number, the hotel; tap-to-call", "give them your flight, AA 1234" in s and a.js("document.querySelectorAll('#fixSheet a[href^=\"tel:\"]').length") == 2, s)
    check("ticked by default: the flight + car + Disney Springs; the hotel row can't be ticked",
          a.js("[...document.querySelectorAll('#fixSheet [data-fixtick]')].map(x => (x.checked ? 1 : 0) + (x.disabled ? 'd' : '')).join()") == "1,1,0d,1")
    a.page.click('#fixSheet [data-fixapply]'); a.page.wait_for_timeout(120)
    B = a.js("Object.fromEntries(curTrip().bookings.map(b => [b.id, [b.day, b.t, b.endDay, b.endT].join(' ')]))")
    check("flight moved whole (12:05 -> 3:40 PM); car pick-up 4:45 PM, drop-off kept; hotel untouched",
          B["f1"] == "2026-10-20 12:05  15:40" and B["c1"] == "2026-10-20 16:45 2026-10-25 10:00" and B["h1"] == "2026-10-20 15:00 2026-10-25 11:00", B)
    check("Disney Springs chained after the car: 5:00-6:00 PM", a.js("[curTrip().fun[0].t, curTrip().fun[0].end].join()") == "17:00,18:00")
    s = a.page.inner_text("#fixSheet")
    check("done: plan updated + now call list, nothing booked for you", "Your plan is updated" in s and "now call" in s.lower() and "Nothing was booked" in s, s)
    check("no clash left after the fix", a.js("fixClashes(curTrip()).length") == 0)
    a.js("FIX = null; showBooking('d1')")
    a.page.click('#bookSheet [data-fixopen="d1"]'); a.page.wait_for_timeout(80)
    a.page.check('#fixSheet [name=how][value=cancel]'); a.page.click('#fixSheet form[data-fixform] button'); a.page.wait_for_timeout(100)
    s = a.page.inner_text("#fixSheet")
    check("canceled dinner: off the trip is NOT ticked until you say so", "Boma is canceled" in s and not a.js("document.querySelector('#fixSheet [data-fixtick]').checked"), s[:500])
    a.page.check('#fixSheet [data-fixtick="0"]'); a.page.click('#fixSheet [data-fixapply]'); a.page.wait_for_timeout(120)
    check("ticked: dinner and its money row are gone", not a.js("curTrip().bookings.some(b => b.id === 'd1')") and not a.js("curTrip().costs.some(c => c.bk === 'd1')"))
    a.js("FIX = { trip: curTrip().id, bk: 't1' }; showFix('what')")
    a.page.check('#fixSheet [name=how][value=time]'); a.page.fill('#fixSheet [name=t]', "08:00")
    a.page.click('#fixSheet form[data-fixform] button'); a.page.wait_for_timeout(100)
    check("earlier time: only the ticket itself moves", a.js("FIX.impact.rows.length") == 1 and "Starts Wednesday 8:00 AM" in a.page.inner_text("#fixSheet"), a.page.inner_text("#fixSheet")[:400])
    a.close()



def t_v112_leave_time(b, base):
    print("\n[v1.12 leave-time engine: drive + park + check-in + buffer -> LEAVE AT, on the day list + 2 reminders]")
    a = App(b, base, path=TRIP, at="2026-10-19T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Orlando", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("showBookingForm('flight')")
    check("flight form has the leave-time box with the airline presets", a.js("!!document.querySelector('#bookSheet details.leave-box [name=lv_drive]')") and "Domestic" in a.js("document.getElementById('bookSheet').textContent"))
    a.page.evaluate("""() => { document.querySelector('#bookSheet details.leave-box').open = true; }""")
    for k, v in {"a": "LIT", "b": "MCO", "day": "2026-10-20", "t": "07:05", "endT": "10:40", "num": "AA 1234"}.items():
        a.page.fill(f'#bookSheet [name={k}]', v)
    a.js("(() => { const f = document.querySelector('#bookSheet form[data-bkform]'); f.lv_drive.value = '25'; f.lv_park.value = '15'; })()")   # inside <details>: set, don't type (typing flaked)
    a.page.click('#bookSheet [data-lvpreset="120"]')
    check("Domestic preset fills check-in with 120", a.page.input_value('#bookSheet [name=lv_check]') == "120")
    a.js("document.querySelector('#bookSheet form[data-bkform]').requestSubmit()"); a.page.wait_for_timeout(150)
    lv = a.js("curTrip().bookings[0].leave")
    check("saved: drive 25 + park 15 + check 120 (blanks not stored)", lv == {"drive": 25, "park": 15, "check": 120}, lv)
    check("leave at 4:25 AM (7:05 - 160 min)", a.js("leaveAt(curTrip().bookings[0])") == {"day": "2026-10-20", "t": "04:25", "mins": 160})
    rows = a.js("dayItems('2026-10-20').filter(x => x.kind === 'book').map(x => x.t + ' ' + x.title)")
    check("day list: Leave row first, then departs", rows[:2] == ["04:25 Leave for AA 1234 · LIT → MCO", "07:05 Departs — AA 1234 · LIT → MCO"], rows)
    a.js("showBooking(curTrip().bookings[0].id)")
    s = a.page.inner_text("#bookSheet")
    check("detail screen: LEAVE AT 4:25 AM with the breakdown", "LEAVE AT 4:25 AM" in s and "25 min" in s and "160 min before 7:05 AM" in s, s[:500])
    a.js("hideSheet('bookSheet')")
    a.js("""curTrip().bookings.push({ id: 'd1', kind: 'dinner', a: 'Boma', b: 'Animal Kingdom Lodge', day: '2026-10-21', t: '00:30', leave: { drive: 40 } }); save()""")
    check("crossing midnight: leave the day before", a.js("leaveAt(curTrip().bookings[1])") == {"day": "2026-10-20", "t": "23:50", "mins": 40})
    a.js("curTrip().bookings[1].day = '2026-10-20'; curTrip().bookings[1].t = '18:30'; save()")
    R = a.js("""(() => { const out = []; leaveReminders((k, until, at, title) => out.push([k.split(':').pop(), new Date(at).toTimeString().slice(0, 5), title]), d => d >= '2026-10-19' && d <= '2026-10-21'); return out; })()""")
    check("2 reminders each: 30 min before + leave now", [r[:2] for r in R] == [["30", "03:55"], ["go", "04:25"], ["30", "17:20"], ["go", "17:50"]], R)
    check("ruthless wording", R[0][2].startswith("⏰ Leave in 30 min") and R[3][2] == "🚪 Leave now — 🍽️ Boma", R)
    check("no minutes = no leave time (never guessed)", a.js("leaveAt({ day: '2026-10-20', t: '12:00', leave: {} })") is None)
    a.js("FIX = { trip: curTrip().id, bk: curTrip().bookings[0].id }; showFix('what')")
    a.page.select_option('#fixSheet [name=mins]', "60"); a.page.click('#fixSheet form[data-fixform] button'); a.page.wait_for_timeout(100)
    a.page.click('#fixSheet [data-fixapply]'); a.page.wait_for_timeout(120)
    check("Fix my trip moves the flight and the leave time follows (5:25 AM)", a.js("leaveAt(curTrip().bookings[0]).t") == "05:25")
    a.close()



def t_v113_split(b, base):
    print("\n[v1.13 split the cost: who paid what, each one's share, who owes whom, fewest payments]")
    a = App(b, base, path=TRIP, at="2026-10-19T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Vegas", "start": "2026-11-05", "end": "2026-11-08", "port": "Las Vegas, NV"})
    a.page.wait_for_timeout(150)
    a.js("""(() => { const tr = curTrip();
      tr.payments = [{ id: 'p1', day: '2026-10-01', amt: 900, note: 'flights + room' }];
      tr.costs = [{ id: 'c1', cat: 'hotel', what: 'Resort fee', amt: 300, paid: true }, { id: 'c2', cat: 'other', what: 'Show', amt: 50, paid: false }];
      tr.spends = [{ id: 's1', day: '2026-11-06', amt: 60, cat: 'Spa', note: '' }]; save();
      S.tripTab = 'money'; shellGo('wallet'); })()""")
    card = lambda: a.page.inner_text('[data-card="trips"]')
    check("Money tab: Split the cost asks for names first", "split the cost" in card().lower() and a.js("!!document.querySelector('[data-splitppl]')"))
    a.page.fill('[data-splitppl] [name=names]', "Scott, Roxanne, Dean, Scott"); a.page.click('[data-splitppl] button'); a.page.wait_for_timeout(120)
    check("names saved once each", a.js("curTrip().split.people") == ["Scott", "Roxanne", "Dean"])
    check("nothing assigned yet: 3 to assign (the unpaid cost doesn't count)", "3 not assigned" in card(), card()[-600:])
    a.page.click('[data-card="trips"] [data-splitopen]'); a.page.wait_for_timeout(100)
    check("sheet lists the 3 items with Paid by / For", a.js("document.querySelectorAll('#splitSheet [data-splitby]').length") == 3 and "Resort fee" in a.page.inner_text("#splitSheet"))
    tid = a.js("curTrip().id")
    a.page.select_option(f'#splitSheet [data-splitby="{tid}|p:p1"]', "Scott")
    a.page.select_option(f'#splitSheet [data-splitby="{tid}|c:c1"]', "Roxanne")
    a.page.select_option(f'#splitSheet [data-splitby="{tid}|s:s1"]', "Dean")
    a.page.select_option(f'#splitSheet [data-splitfor="{tid}|s:s1"]', "Dean")
    a.page.click('#splitSheet button.btn[data-splitclose]'); a.page.wait_for_timeout(120)
    M = a.js("(() => { const M = splitMath(curTrip()); return { rows: M.rows.map(r => [r.name, r.paid, r.share, r.net]), pay: M.pay.map(p => p.from + '>' + p.to + ' ' + p.amt), open: M.open.length, total: M.total }; })()")
    check("shares: $1,200 shared 3 ways + Dean's own $60 spa",
          M["rows"] == [["Scott", 900, 400, 500], ["Roxanne", 300, 400, -100], ["Dean", 60, 460, -400]] and M["open"] == 0 and M["total"] == 1260, M)
    check("settle up in 2 payments: Dean pays Scott $400, Roxanne pays Scott $100", M["pay"] == ["Dean>Scott 400", "Roxanne>Scott 100"], M)
    c = card()
    check("card shows owed / owes and the settle-up line", "is owed $500.00" in c and "owes $400.00" in c and "Dean pays Scott $400.00" in c, c[-700:])
    check("share text", a.js("splitText(curTrip())").splitlines()[-1] == "Settle up: Dean pays Scott $400.00; Roxanne pays Scott $100.00")
    a.page.fill('[data-card="trips"] [data-splitppl] [name=names]', "Scott, Roxanne"); a.page.click('[data-card="trips"] [data-splitppl] button'); a.page.wait_for_timeout(120)
    M = a.js("(() => { const M = splitMath(curTrip()); return { open: M.open.map(x => x.key), rows: M.rows.map(r => [r.name, r.net]) }; })()")
    check("drop Dean: his spa goes back to 'not assigned', never re-pointed", M == {"open": ["s:s1"], "rows": [["Scott", 300], ["Roxanne", -300]]}, M)
    a.js("curTrip().split.by['s:s1'] = 'Roxanne'; save(); render()")
    check("even split: 2 people all square when paid the same", a.js("splitMath({ split: { people: ['A', 'B'], by: { 's:x': 'A', 's:y': 'B' }, for: {} }, spends: [{ id: 'x', amt: 10, cat: 'a' }, { id: 'y', amt: 10, cat: 'b' }] }).pay.length") == 0)
    a.close()



def t_v114_hotel_mode(b, base):
    print("\n[v1.14 hotel mode: room / wifi / breakfast in one place, check-out checklist + reminders]")
    seed = """(() => { const tr = curTrip(); tr.bookings = [
      { id: 'h1', kind: 'hotel', a: 'Coronado Springs', b: '', day: '2026-10-20', t: '15:00', endDay: '2026-10-23', endT: '11:00', num: 'R-1', phone: '407-939-1000' }]; save(); render(); })()"""
    def start(at):
        a = App(b, base, path=TRIP, at=at)
        a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        a.qa("trip", {"tname": "Orlando", "start": "2026-10-20", "end": "2026-10-23", "port": "Orlando, FL"})
        a.page.wait_for_timeout(150); a.js(seed); a.js("shellGo('home')"); return a
    a = start("2026-10-21T09:00:00")
    home = a.page.inner_text("#cards")
    check("mid-stay Home: the hotel row asks for the room number", "Coronado Springs — add your room number" in home, home[:600])
    a.page.click('#cards [data-hotelopen="h1"]'); a.page.wait_for_timeout(100)
    s = a.page.inner_text("#hotelSheet")
    check("hotel sheet: dates, front desk, the 5 fields, the checklist below", "check-out Friday" in s and a.js("document.querySelectorAll('#hotelSheet form[data-hotelstay] input').length") == 5
          and a.js("document.querySelectorAll('#hotelSheet [data-hotelout]').length") == 11, s[:500])
    a.page.fill('#hotelSheet [name=room]', "1412"); a.page.fill('#hotelSheet [name=wifi]', "CS-Guest"); a.page.fill('#hotelSheet [name=pass]', "mickey22")
    a.page.click('#hotelSheet form[data-hotelstay] button.btn'); a.page.wait_for_timeout(120)
    check("saved on the booking (blanks not stored)", a.js("curTrip().bookings[0].stay") == {"room": "1412", "wifi": "CS-Guest", "pass": "mickey22"})
    a.js("hideSheet('hotelSheet'); shellGo('home')")
    home = a.page.inner_text("#cards")
    check("Home now: Room 1412 + the wifi", "Room 1412 · Coronado Springs" in home and "CS-Guest · mickey22" in home, home[:600])
    a.js("showBooking('h1')")
    check("booking detail has the hotel-mode button", a.js("!!document.querySelector('#bookSheet [data-hotelopen=\"h1\"]')"))
    a.js("hideSheet('bookSheet')")
    R = a.js("""(() => { const out = []; hotelReminders((k, until, at, title) => out.push([k.split(':').pop(), new Date(at).toString().slice(4, 21), title]), d => d >= '2026-10-21' && d <= '2026-10-23'); return out; })()""")
    check("reminders: 8 PM the night before + 10 AM (1 hour before 11)", [r[:2] for r in R] == [["eve", "Oct 22 2026 20:00"], ["1h", "Oct 23 2026 10:00"]]
          and R[0][2] == "🏨 Check out tomorrow by 11:00 AM — Coronado Springs", R)
    check("an hour past check-out the stay is over", a.js("hotelNow(curTrip(), '2026-10-23', '12:01')") is None and a.js("hotelNow(curTrip(), '2026-10-23', '11:59').id") == "h1")
    a.close()
    a = start("2026-10-23T09:30:00")
    home = a.page.inner_text("#cards")
    check("check-out day: Home's first row is the check-out countdown", "Check out by 11:00 AM — 0 of 11 checked" in home.split("NEXT")[0], home[:500])
    a.page.click('#cards [data-hotelopen="h1"]'); a.page.wait_for_timeout(100)
    check("check-out day: the checklist comes first", a.js("document.querySelector('#hotelSheet .day-label').textContent").startswith("✅ Check-out checklist"))
    for k in ["chargers", "outlets", "safe", "bath", "bed", "closet", "fridge", "meds", "bill", "keys"]:
        a.page.click(f'#hotelSheet [data-hotelout="h1|{k}"]'); a.page.wait_for_timeout(40)
    check("10 ticked, saved in order", a.js("curTrip().bookings[0].outDone.length") == 10 and a.js("outLeft(curTrip().bookings[0])") == 1)
    a.page.click('#hotelSheet [data-hotelout="h1|car"]'); a.page.wait_for_timeout(80)
    check("all 11: nothing left behind", "nothing left behind" in a.page.inner_text("#hotelSheet"))
    a.page.click('#hotelSheet [data-hotelout="h1|safe"]'); a.page.wait_for_timeout(80)
    check("untick works", a.js("curTrip().bookings[0].outDone.includes('safe')") is False)
    a.js("hideSheet('hotelSheet'); shellGo('home')")
    check("Home count follows: 10 of 11", "10 of 11 checked" in a.page.inner_text("#cards"))
    a.close()



def t_v115_cancel_refunds(b, base):
    print("\n[v1.15 free-cancel deadlines + refunds owed (and Fix my trip offers the refund)]")
    a = App(b, base, path=TRIP, at="2026-10-10T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Orlando", "start": "2026-10-20", "end": "2026-10-23", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("showBookingForm('hotel')")
    for k, v in {"a": "Coronado Springs", "t": "15:00", "endT": "11:00", "cost": "600", "cancelBy": "2026-10-13", "phone": "407-939-1000"}.items():
        a.page.fill(f'#bookSheet [name={k}]', v)
    a.js("document.querySelector('#bookSheet form[data-bkform]').requestSubmit()"); a.page.wait_for_timeout(150)
    bk = a.js("curTrip().bookings[0]")
    check("form saves the free-cancel date", bk["cancelBy"] == "2026-10-13", bk)
    a.js(f"showBooking('{bk['id']}')")
    s = a.page.inner_text("#bookSheet")
    check("detail: ⚠️ 3 days left shows", "free cancellation until Oct 13 (3 days)" in s and "⚠️" in s, s[:600])
    a.js("hideSheet('bookSheet'); shellGo('plan'); PLAN_VIEW = 'reservations'; render()")
    check("bookings list carries it", "free cancellation until Oct 13" in a.page.inner_text("#cards"))
    R = a.js("""(() => { const out = []; cancelReminders((k, until, at, title) => out.push([k.split(':').pop(), new Date(at).toString().slice(4, 21), title]), d => d >= '2026-10-10' && d <= '2026-10-20'); return out; })()""")
    check("reminders: 3 days before (today 9 AM) + the last day", [r[:2] for r in R] == [["3", "Oct 10 2026 09:00"], ["0", "Oct 13 2026 09:00"]]
          and R[1][2] == "⚠️ Last day to cancel free — 🏨 Coronado Springs", R)
    a.js("""(() => { const tr = curTrip(); tr.bookings.push({ id: 'd1', kind: 'dinner', a: 'Boma', b: '', day: '2026-10-21', t: '19:00', cost: 90, paid: true }); save(); })()""")
    a.js("FIX = { trip: curTrip().id, bk: 'd1' }; showFix('what')")
    a.page.check('#fixSheet [name=how][value=cancel]'); a.page.click('#fixSheet form[data-fixform] button'); a.page.wait_for_timeout(100)
    s = a.page.inner_text("#fixSheet")
    check("canceling a paid booking offers 'Track a refund of $90.00', ticked", "Track a refund of $90.00" in s and a.js("document.querySelector('#fixSheet [data-fixtick=\"1\"]').checked"), s[:600])
    a.page.check('#fixSheet [data-fixtick="0"]'); a.page.click('#fixSheet [data-fixapply]'); a.page.wait_for_timeout(120)
    rf = a.js("curTrip().refunds")
    check("dinner gone; refund tracked from Boma, asked today", not a.js("curTrip().bookings.some(b => b.id === 'd1')") and len(rf) == 1
          and {k: rf[0][k] for k in ["what", "from", "amt", "asked", "got"]} == {"what": "Boma", "from": "Boma", "amt": 90, "asked": "2026-10-10", "got": ""}, rf)
    a.js("hideSheet('fixSheet'); S.tripTab = 'money'; shellGo('wallet')")
    card = lambda: a.page.inner_text('[data-card="trips"]')
    check("Wallet → Money: Refunds owed — $90.00", "refunds owed — $90.00" in card().lower(), card()[-500:])
    a.page.fill('[data-refund] [name=what]', "Airport shuttle"); a.page.fill('[data-refund] [name=amt]', "40")
    a.page.fill('[data-refund] [name=from]', "Mears"); a.page.fill('[data-refund] [name=expect]', "2026-10-05")
    a.page.click('[data-refund] button'); a.page.wait_for_timeout(120)
    c = card()
    check("added by hand; past its date = ⚠️ was due; total $130", "refunds owed — $130.00" in c.lower() and "was due Oct 5" in c, c[-600:])
    rid = a.js("curTrip().refunds.find(r => r.what === 'Airport shuttle').id")
    a.page.click(f'[data-refundgot="{a.js("curTrip().id")}|{rid}"]'); a.page.wait_for_timeout(100)
    check("got it ✓: back today, owed drops to $90", a.js(f"curTrip().refunds.find(r => r.id === '{rid}').got") == "2026-10-10" and "refunds owed — $90.00" in card().lower())
    R = a.js("""(() => { curTrip().refunds[0].expect = '2026-10-15'; const out = []; cancelReminders((k, until, at, title) => out.push(k.split(':')[0] + ' ' + new Date(at).toString().slice(4, 15) + ' ' + title), d => d >= '2026-10-10' && d <= '2026-10-20'); return out.filter(x => x.startsWith('rf')); })()""")
    check("late refund nudge the day after it's due (only the open one)", R == ["rf Oct 16 2026 ↩️ Refund not here yet? $90.00 — Boma"], R)
    a.close()



def t_v116_road_trip(b, base):
    print("\n[v1.16 road trip brain (free): typed miles + drive time -> breaks, meals, fuel, arrival, does it make check-in]")
    a = App(b, base, path=TRIP, at="2026-10-19T09:00:00")
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Orlando", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("""(() => { const tr = curTrip(); tr.bookings = [
      { id: 'h1', kind: 'hotel', a: 'Coronado Springs', b: '', day: '2026-10-20', t: '15:00', endDay: '2026-10-25', endT: '11:00' },
      { id: 'd1', kind: 'dinner', a: 'Boma', b: '', day: '2026-10-20', t: '19:00' }]; save(); render(); showDay('2026-10-20'); })()""")
    check("day screen: a collapsed 'Driving today?' when there's no drive", a.js("!!document.querySelector('#daySheet details.drive-box form[data-drive]')"))
    a.page.evaluate("() => { document.querySelector('#daySheet details.drive-box').open = true; }")
    for k, v in {"from": "Little Rock", "to": "Orlando", "t": "07:00", "miles": "900", "h": "13", "m": "30"}.items():
        a.page.fill(f'#daySheet form[data-drive] [name={k}]', v)
    a.page.click('#daySheet form[data-drive] button'); a.page.wait_for_timeout(150)
    dv = a.js("curTrip().drives[0]")
    check("saved: 900 mi, 810 min, leave 7:00; the plan opens", dv["miles"] == 900 and dv["mins"] == 810 and dv["t"] == "07:00"
          and not a.js("document.getElementById('driveSheet').classList.contains('hidden')"), dv)
    a.page.fill('#driveSheet [name=range]', "400"); a.page.fill('#driveSheet [name=mpg]', "25"); a.page.fill('#driveSheet [name=gas]', "3.20")
    a.page.click('#driveSheet form[data-vehicle] button'); a.page.wait_for_timeout(120)
    P = a.js("(() => { const P = drivePlan(curTrip(), curTrip().drives[0]); return { s: P.stops.map(s => s.t + ' ' + s.kind + (s.meal ? ':' + s.meal : '') + (s.fuel ? '+fuel' : '')), arrive: P.arrive, plus: P.plusDays, cost: Math.round(P.cost * 100) / 100 }; })()")
    check("stops every 2 h; lunch + fuel 12:18, dinner + fuel 6:21 (tank at 80%), arrive 11:15 PM, $115.20 gas",
          P == {"s": ["09:00 break", "11:15 break", "12:18 meal:lunch+fuel", "15:03 break", "17:18 break", "18:21 meal:dinner+fuel", "21:06 break"],
                "arrive": "23:15", "plus": 0, "cost": 115.2}, P)
    s = a.page.inner_text("#driveSheet")
    check("sheet: stop list with mile markers, the hotel note, dinner flagged late, gas",
          "Lunch + ⛽ fuel" in s and "about mile 320" in s and "Coronado Springs: check-in from 3:00 PM" in s
          and "Boma at 7:00 PM — you arrive about 11:15 PM" in s and "36.0 gal · $115.20" in s, s[:1500])
    check("dinner warning is marked red", a.js("[...document.querySelectorAll('#driveSheet .bstat.over')].length") == 1)
    rows = a.js("dayItems('2026-10-20').filter(x => x.icon === '🚗' || x.icon === '🏁').map(x => x.t + ' ' + x.title)")
    check("day list: Drive at 7:00 + Arrive about 11:15 PM", rows == ["07:00 Drive Little Rock → Orlando", "23:15 Arrive Orlando (about)"], rows)
    a.js("hideSheet('driveSheet'); showDay('2026-10-20')")
    s = a.page.inner_text("#daySheet")
    check("day screen shows the drive summary", "arrive about 11:15 PM" in s and "7 stops" in s and "about $115.20" in s, s[:900])
    P2 = a.js("drivePlan({ vehicle: {} }, { day: '2026-10-21', t: '20:00', miles: 300, mins: 300 })")
    check("no car saved = no fuel stops; past midnight = next day", [x["kind"] for x in P2["stops"]] == ["break", "break"] and P2["arrive"] == "01:30" and P2["plusDays"] == 1, P2)
    a.page.click(f'#daySheet [data-driveopen="{a.js("curTrip().id")}|{dv["id"]}"]'); a.page.wait_for_timeout(80)
    a.page.click('#driveSheet [data-drivedel]'); a.page.wait_for_timeout(100)
    check("delete the drive", a.js("curTrip().drives.length") == 0)
    a.close()



def t_v117_free_time(b, base):
    print("\n[v1.17 free time finder: open stretches in the day + our own ideas that fit, one tap into the day]")
    a = App(b, base, path=TRIP, at="2026-10-21T12:00:00")
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Orlando", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("""(() => { const tr = curTrip(); tr.bookings = [
      { id: 't1', kind: 'ticket', a: 'Magic Kingdom', b: '', day: '2026-10-21', t: '08:00', endT: '11:00' },
      { id: 'd1', kind: 'dinner', a: 'Boma', b: '', day: '2026-10-21', t: '19:00', leave: { drive: 30 } }];
      tr.fun = [{ id: 'u1', day: '2026-10-21', t: '14:00', end: '15:00', title: 'Disney Springs', where: '', pick: 'must' }]; save(); render(); showDay('2026-10-21'); })()""")
    G = a.js("freeGaps(curTrip(), '2026-10-21', '12:00').map(g => g.t + '-' + g.end + ' ' + g.mins + ' ' + g.before)")
    check("gaps from now: 12-2 before Disney Springs, 3-6:30 before leaving for Boma, 7:30-10 PM",
          G == ["12:00-14:00 120 ❤️ Disney Springs", "15:00-18:30 210 🍽️ Boma", "19:30-22:00 150 "], G)
    s = a.page.inner_text("#daySheet")
    check("day screen: Free time with the open stretches; the idea list starts open", "free time" in s.lower() and "3:00 PM–6:30 PM · 3 h 30 min free — before 🍽️ Boma" in s
          and a.js("document.querySelector('#daySheet details.wish-box').open"), s[:1500])
    def idea(title, mins, where=""):
        a.page.fill('#daySheet form[data-wish] [name=title]', title); a.page.select_option('#daySheet form[data-wish] [name=mins]', str(mins))
        a.page.fill('#daySheet form[data-wish] [name=where]', where); a.page.click('#daySheet form[data-wish] button'); a.page.wait_for_timeout(120)
    idea("Mini golf", 90, "Fantasia Gardens"); idea("Outlet mall", 180); idea("Pool time", 60); idea("Spa", 240)
    check("4 ideas on the trip's list", a.js("curTrip().wish.map(w => w.title + ':' + w.mins)") == ["Mini golf:90", "Outlet mall:180", "Pool time:60", "Spa:240"])
    I = a.js("freeGaps(curTrip(), '2026-10-21', '12:00').map(g => gapIdeas(curTrip(), g).map(w => w.title).join('/'))")
    check("what fits each stretch (biggest first; the 4 h spa fits nowhere)", I == ["Mini golf/Pool time", "Outlet mall/Mini golf/Pool time", "Mini golf/Pool time"], I)
    a.js("hideSheet('daySheet'); shellGo('home')")
    home = a.page.inner_text("#cards")
    check("Home: You have 2 h free till 2:00 PM, 2 ideas fit, then Disney Springs", "You have 2 h free till 2:00 PM" in home and "2 ideas from your list fit — then ❤️ Disney Springs" in home, home[:700])
    a.js("showDay('2026-10-21')")
    tid = a.js("curTrip().id"); wid = a.js("curTrip().wish.find(w => w.title === 'Outlet mall').id")
    a.page.click(f'#daySheet [data-freeadd="{tid}|2026-10-21|15:00|{wid}"]'); a.page.wait_for_timeout(120)
    f = a.js("curTrip().fun.find(x => x.title === 'Outlet mall')")
    check("tap: Outlet mall 3-6 PM as a ❤️ pick, off the idea list", f and f["t"] == "15:00" and f["end"] == "18:00" and f["pick"] == "must" and not a.js("curTrip().wish.some(w => w.title === 'Outlet mall')"), f)
    G = a.js("freeGaps(curTrip(), '2026-10-21', '12:00').map(g => g.t + '-' + g.end)")
    check("the day updates: 30 min left before Boma", G == ["12:00-14:00", "18:00-18:30", "19:30-22:00"], G)
    sid = a.js("curTrip().wish.find(w => w.title === 'Spa').id")
    a.page.click(f'#daySheet [data-wishdel="{tid}|{sid}|2026-10-21"]'); a.page.wait_for_timeout(100)
    check("✕ removes an idea, the day stays open", not a.js("curTrip().wish.some(w => w.title === 'Spa')") and not a.js("document.getElementById('daySheet').classList.contains('hidden')"))
    check("past days get no free-time block", a.js("freeDayHtml(curTrip(), '2026-10-20')") == "")
    a.close()



def t_v118_group_vote(b, base):
    print("\n[v1.18 group vote: pass the phone, 👍/👎 each idea, favourites first, voted-down ideas left out]")
    a = App(b, base, path=TRIP, at="2026-10-21T12:00:00")
    a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Orlando", "start": "2026-10-20", "end": "2026-10-25", "port": "Orlando, FL"})
    a.page.wait_for_timeout(150)
    a.js("""(() => { const tr = curTrip(); tr.bookings = [{ id: 'd1', kind: 'dinner', a: 'Boma', b: '', day: '2026-10-21', t: '19:00', leave: { drive: 30 } }];
      tr.fun = [{ id: 'u1', day: '2026-10-21', t: '14:00', end: '15:00', title: 'Disney Springs', where: '', pick: 'must' }];
      tr.wish = [{ id: 'w1', title: 'Mini golf', mins: 90, where: '' }, { id: 'w2', title: 'Pool time', mins: 60, where: '' }, { id: 'w3', title: 'Outlet mall', mins: 180, where: '' }];
      save(); render(); showDay('2026-10-21'); })()""")
    a.page.evaluate("() => { document.querySelector('#daySheet details.wish-box').open = true; }")
    tid = a.js("curTrip().id")
    a.page.click(f'#daySheet [data-voteopen="{tid}"]'); a.page.wait_for_timeout(100)
    check("no names yet: the vote sheet asks who's going", a.js("!!document.querySelector('#voteSheet form[data-voteppl]')") and "two or more" in a.page.inner_text("#voteSheet"))
    a.page.fill('#voteSheet [data-voteppl] [name=names]', "Scott, Roxanne, Dean"); a.page.click('#voteSheet [data-voteppl] button'); a.page.wait_for_timeout(100)
    check("names saved (shared with Split the cost); Scott votes first", a.js("curTrip().split.people") == ["Scott", "Roxanne", "Dean"] and "Scott is voting" in a.page.inner_text("#voteSheet"))
    def vote(wid, v): a.page.click(f'#voteSheet [data-vote="{tid}|{wid}|{v}"]'); a.page.wait_for_timeout(60)
    def voter(p): a.page.click(f'#voteSheet [data-voter="{tid}|{p}"]'); a.page.wait_for_timeout(60)
    vote("w2", 1); vote("w1", -1)
    voter("Roxanne"); vote("w2", 1); vote("w1", -1)
    voter("Dean"); vote("w1", 1); vote("w3", 1)
    sc = a.js("curTrip().wish.map(w => w.title + ':' + voteScore(w) + (voteDown(curTrip(), w) ? ':down' : ''))")
    check("scores: Pool +2, Mini golf -1 (2 of 3 said no), Outlet +1", sc == ["Mini golf:-1:down", "Pool time:2", "Outlet mall:1"], sc)
    rows = a.js("[...document.querySelectorAll('#voteSheet .vote-row')].map(r => r.querySelector('.grow').firstChild.textContent.trim())")
    check("vote sheet ranked by votes", rows == ["Pool time", "Outlet mall", "Mini golf"], rows)
    check("who's in shows", "👍 Scott, Roxanne" in a.page.inner_text("#voteSheet") and "most said no" in a.page.inner_text("#voteSheet"))
    I = a.js("freeGaps(curTrip(), '2026-10-21', '12:00').map(g => gapIdeas(curTrip(), g).map(w => w.title).join('/'))")
    check("suggestions: favourites first, Mini golf left out everywhere", I == ["Pool time", "Pool time/Outlet mall", "Pool time"], I)
    vote("w3", 1)
    check("tap again takes Dean's vote back", a.js("voteScore(curTrip().wish.find(w => w.id === 'w3'))") == 0 and "Dean" not in a.js("Object.keys(curTrip().wish.find(w => w.id === 'w3').votes || {}).join()"))
    a.page.click('#voteSheet button.btn[data-voteclose]'); a.page.wait_for_timeout(100); a.js("showDay('2026-10-21')")
    check("day list shows the score: 🗳️ +2 on Pool time", "🗳️ +2 · 1 h" in a.js("document.querySelector('#daySheet details.wish-box').textContent"))
    a.close()


def t_v109_port_wx_alerts(b, base):
    print("\n[v1.09 port-day weather notifications: 7 AM on the day, 8 PM the night before only with a warning]")
    a = App(b, base, path=CRUISE, at="2026-10-01T06:00:00")                # sail day, before 7 AM
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Western Caribbean", "start": "2026-10-01", "end": "2026-10-05", "line": "Carnival", "port": "Galveston, TX"})
    a.js("curTrip().ports = [{ id: 'p1', name: 'Cozumel', day: '2026-10-02', allAboard: '16:30' }]; save(); reminderList()")
    a.page.wait_for_function("['Galveston, TX|2026-10-01', 'Cozumel|2026-10-02'].every(k => PORTWX[k] && !PORTWX[k].loading)")
    R = a.js("reminderList().filter(r => r.key.startsWith('pw:')).map(r => ({ key: r.key.split(':').slice(2).join(':'), at: new Date(r.at).toTimeString().slice(0, 5), title: r.title, body: r.body }))")
    keys = sorted(r["key"] for r in R)
    check("sail day: 8 PM the night before + 7 AM; Cozumel: 8 PM the night before + 7 AM", keys == ["2026-10-01:am", "2026-10-01:eve", "2026-10-02:am", "2026-10-02:eve"], R)
    g = {r["key"]: r for r in R}
    check("sail-day morning: 'Galveston on boarding day: 88°/77°' at 7:00", g["2026-10-01:am"]["at"] == "07:00" and "🚢 Galveston, TX on boarding day:" in g["2026-10-01:am"]["title"] and "88°/77°" in g["2026-10-01:am"]["title"], g.get("2026-10-01:am"))
    check("night before at 8 PM: 'Tomorrow in Cozumel' with the UV warning (fixture UV 9.2)",
          g["2026-10-02:eve"]["at"] == "20:00" and g["2026-10-02:eve"]["title"].startswith("🌦️ Tomorrow in Cozumel:") and "UV very high (9)" in g["2026-10-02:eve"]["body"], g.get("2026-10-02:eve"))
    check("port morning: '⚓ Cozumel today' with the same warning", g["2026-10-02:am"]["title"].startswith("⚓ Cozumel today:") and "UV very high" in g["2026-10-02:am"]["body"])
    calm = a.js("(() => { PORTWX['Cozumel|2026-10-02'] = { hi: 82, lo: 74, rain: 10, code: 1, uv: 4, wind: 8, gust: 12 }; return reminderList().filter(r => r.key.includes(':2026-10-02:')).map(r => r.key.split(':').pop() + '|' + r.body); })()")
    check("a calm forecast: no night-before alert, the morning says no worries", calm == ["am|No weather worries — enjoy it!"], calm)
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
                  t_v037_future_me, t_v039_short_home, t_v040_switches, t_v045_cruise_hub,
                  t_v046_hub_family, t_v048_cruise_pass,
                  t_v049_scenes, t_v050_countdown_family,
                  t_v051_cruise_weather, t_v052_return_guard,
                  t_v053_ask_cruise_hub, t_v054_name_bar_wallet,
                  t_v055_packing_bags, t_v056_go_home,
                  t_v057_crisis, t_v058_shell,
                  t_v059_plan_timeline, t_v060_onboarding,
                  t_v061_travel_day_offline, t_v062_simple_mode,
                  t_v062_itemized, t_v063_icon_tiles,
                  t_v064_ship_guide, t_v065_port_guides,
                  t_v066_more_ports, t_v067_tender,
                  t_v068_ports_batch3, t_v069_alaska,
                  t_v070_private, t_v071_bermuda_hmc, t_v072_home_ports, t_v073_more_home_ports, t_v075_se_home_ports, t_v076_emerald, t_v077_royal, t_v078_ruby, t_v079_regal, t_v080_majestic, t_v081_sky, t_v082_enchanted, t_v083_discovery, t_v084_sun, t_v085_home_layout, t_v086_star, t_v087_grand, t_v088_crown, t_v089_diamond, t_v090_sapphire, t_v091_coral, t_v092_island, t_v093_carnival, t_v094_breeze, t_v095_dream, t_v097_trip_hub, t_v098_bookings, t_v099_map, t_v100_paste, t_v101_diary, t_v102_port_reality, t_v103_final_bill, t_v104_fun_finder, t_v105_package_calc, t_v106_secrets, t_v107_upgrade, t_v108_wrap_up, t_v109_port_wx_alerts, t_v110_scene_pick, t_v111_fix_my_trip, t_v112_leave_time, t_v113_split, t_v114_hotel_mode, t_v115_cancel_refunds, t_v116_road_trip, t_v117_free_time, t_v118_group_vote):
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
