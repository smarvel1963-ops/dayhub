"""
SAVE AS: test_hub_connect.py   LOCATION: C:/MarvelApps/dayhub/tests/test_hub_connect.py

HUB CONNECTIONS (hubconnect.js; Scott's 11/04 Auto Hub list, 11/05 "cont"). Day Hub and Trip Hub READ Auto Hub's records on this phone; Auto Hub
lists what each Hub picks up. Checks: the switch is ON for everyone (v1.58.11) and a phone without Auto Hub downloads nothing new; a phone gets Auto Hub's own due list on Day
Hub's Car card (both looks) and Use my car on a road trip; nothing is ever written to Auto Hub or copied into another Hub; a fix or a deleted car in
Auto Hub shows at once; Settings -> Hub family turns it off; crafted records run nothing and hide nothing; the other Hubs never load it.

RUN:   python tests/test_hub_connect.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
import test_auto_tiles as AT
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

AT_DAY = "2026-10-01T08:00:00"
loaded = lambda a, f: a.js(f"[...document.scripts].some(s => (s.src || '').split('?')[0].endsWith('/{f}'))")   # the resource list fills up on Day Hub, the script tags don't
FROM = lambda t: "from auto hub" in (t or "").lower()   # the label is drawn in capitals
def go(a, path, fn=None):
    a.page.goto(a.base + path); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
    if fn: a.page.wait_for_function(f"typeof {fn} === 'function'", timeout=15000)
    a.js("render(); 0"); a.page.wait_for_timeout(120)
def car_card(a): return a.js("(() => { const el = document.querySelector('[data-card=\"auto\"]'); return el ? el.innerText : ''; })()")
def raw(a, k="autohub.v1"): return a.js(f"localStorage.getItem('{k}')")
TRIP = """(() => { S.trips = S.trips.filter(t => t.id !== 'rt'); S.trips.push({ id: 'rt', type: 'trip', name: 'Orlando', start: '2026-10-20', end: '2026-10-25',
  drives: [{ id: 'dv1', day: '2026-10-20', from: 'Maple Ridge', to: 'Orlando', t: '07:00', miles: 900, mins: 810 }] }); S.tripSel = 'rt'; save(); render(); showDrive('rt|dv1'); 0 })()"""


def app(b, base, owner):
    a = T.App(b, base, path=T.AUTOP, at=AT_DAY); a.base = base
    if owner: a.js("localStorage.setItem('scotthub.k', 'TEST-PASS'); 0"); a.page.reload(); a.page.wait_for_function("typeof render === 'function'")
    a.js(AT.SAMPLE); a.page.wait_for_timeout(150)
    a.js("try { if (briefOpen()) document.querySelector('[data-brief=go]').click(); } catch (e) {}; 0")
    return a


def test_customer(b, base):
    print("\n-- A customer (v1.58.11, Scott 11/06 \"go\"): the switch is ON; a phone without Auto Hub downloads nothing new")
    # no Auto Hub on the phone: Day Hub and Trip Hub fetch nothing and draw what they always did
    a = T.App(b, base, path="/", at=AT_DAY); a.base = base
    a.js("S.name = 'Sam'; save(); render(); 0"); a.page.wait_for_timeout(400)
    check("the switch in the code is ON", a.js("HC_ON === true") and a.js("hcOn()") is True)
    check("no Auto Hub on this phone: Day Hub downloads nothing new (no auto.js, no hubconnect.js)", not loaded(a, "auto.js") and not loaded(a, "hubconnect.js"))
    check("...and the Car card is just Day Hub's", not FROM(car_card(a)), car_card(a)[:200])
    go(a, T.TRIP); a.js(TRIP); a.page.wait_for_timeout(150)
    check("Trip Hub: the drive sheet opens as before, nothing downloaded", a.js("!!document.querySelector('#driveSheet form[data-vehicle]')")
          and not a.js("!!document.querySelector('#driveSheet [data-hcuse]')") and not loaded(a, "auto.js") and not loaded(a, "hubconnect.js"))
    a.close()
    # Auto Hub on the phone: a customer (no Scott Hub, no owner mark) gets all three, read only
    a = app(b, base, owner=False)
    a.page.wait_for_function("typeof hcShow === 'function'", timeout=15000)
    check("Auto Hub: on for a customer", a.js("hcOn()") is True and not a.js("!!localStorage.getItem('scotthub.k')") and a.js("localStorage.getItem('dayhub.ownerok')") is None)
    a.js("openSettings(); 0"); a.page.wait_for_timeout(120)
    check("Auto Hub: a Hub Connections button in Settings -> Hub family", a.js("!!document.querySelector('#famBox [data-hcopen]')")); a.js("closeSettings(); 0")
    before = raw(a)
    go(a, "/", "hcAutoRows"); a.js("S.name = 'Sam'; save(); render(); 0")
    check("Day Hub: the Car card has From Auto Hub", FROM(car_card(a)) and "Oil change · Daily Driver" in car_card(a), car_card(a)[-300:])
    go(a, T.TRIP, "hcCarButtons"); a.js(TRIP); a.page.wait_for_timeout(150)
    check("Trip Hub: Use my car on the drive sheet", a.js("!!document.querySelector('#driveSheet [data-hcuse]')"))
    check("Auto Hub's records untouched", raw(a) == before)
    a.close()


def test_owner_day(b, base):
    print("\n-- Your phone: Day Hub's Car card shows what Auto Hub says is coming due")
    a = app(b, base, owner=True)
    a.page.wait_for_function("typeof hcShow === 'function'")
    before = raw(a)
    go(a, "/", "hcAutoRows")
    check("Day Hub loads Auto Hub's own math and the reader", loaded(a, "auto.js") and loaded(a, "hubconnect.js"))
    a.js("S.name = 'Sam'; S.city = '33101'; save(); render(); 0")
    t = car_card(a)
    check("the Car card has a From Auto Hub part", FROM(t), t[-400:])
    check("oil change, from Auto Hub's own rule: 2,440 mi or a date", "Oil change · Daily Driver" in t and "in 2,440 mi or by" in t, t[:400])
    check("insurance runs out in 7 days", "Sample Insurance · Daily Driver" in t and "runs out in 7 days" in t, t[:400])
    check("registration 150 days out isn't listed", "State · Daily Driver" not in t)
    same = a.js("""(() => { const c = hcCars()[0]; return carDue(c, today()).filter(d => d.late || d.soon).map(d => d.key); })()""")
    rows = a.js("hcDue(today()).filter(x => !x.text.includes('Insurance')).map(x => x.text.split(' · ')[0])")
    check("the same services Auto Hub calls soon, no more, no less", len(same) == len(rows) and len(rows) >= 1, (same, rows))
    meta = a.js("CARDS.auto.meta()")
    check("the card's 'coming up' counts Auto Hub's within 14 days", meta and int(meta.split()[0]) == a.js("upkeepDue('auto', 14).length + hcDue(today()).filter(x => daysUntil(x.day) <= 14).length"), meta)
    check("an Open Auto Hub link", a.js("!!document.querySelector('[data-card=\"auto\"] [data-hc] a[data-famopen]')"))
    check("nothing written to Auto Hub", raw(a) == before)
    d = json.loads(raw(a, "dayhub.v1") or "{}")
    check("nothing copied into Day Hub's records", "garage" not in d and not any("Daily Driver" in json.dumps(x) for x in d.get("upkeep", [])))
    if a.js("typeof dtOn === 'function' && dtOn()"):
        a.js("DT_SCREEN = 'upkeep'; DT_UPKEEP = 'auto'; render(); 0"); a.page.wait_for_timeout(100)
        check("Day Hub's new look: the Upkeep screen's Car side shows it too", FROM(a.js("document.getElementById('cards').innerText")))
        a.js("DT_SCREEN = ''; render(); 0")
    else:
        a.js("localStorage.setItem('dayhub.look', 'tiles'); 0"); a.page.reload(); a.page.wait_for_function("typeof hcAutoRows === 'function'")
        if a.js("typeof dtOn === 'function' && dtOn()"):
            a.js("DT_SCREEN = 'upkeep'; DT_UPKEEP = 'auto'; render(); 0"); a.page.wait_for_timeout(100)
            check("Day Hub's new look: the Upkeep screen's Car side shows it too", FROM(a.js("document.getElementById('cards').innerText")))
        else:
            check("Day Hub's new look could be turned on for the check", False, "dtOn false")
        a.js("localStorage.removeItem('dayhub.look'); 0"); a.page.reload(); a.page.wait_for_function("typeof hcAutoRows === 'function'"); a.js("render(); 0")

    print("\n-- Fix it in Auto Hub and Day Hub shows the fix (nothing to keep in step)")
    a.js("""(() => { const d = JSON.parse(localStorage.getItem('autohub.v1')); const c = d.garage.cars[0];
      c.services.push({ id: 'new', kind: 'oil', date: today(), miles: 42320, cost: 70, note: '' });
      c.papers.find(p => p.kind === 'insurance').expires = addDays(today(), 180); localStorage.setItem('autohub.v1', JSON.stringify(d)); render(); })()""")
    t = car_card(a)
    check("an oil change logged in Auto Hub: gone from Day Hub", "Oil change · Daily Driver" not in t, t[-300:])
    check("insurance renewed in Auto Hub: gone from Day Hub", "Sample Insurance" not in t)
    a.js("""(() => { const d = JSON.parse(localStorage.getItem('autohub.v1')); d.garage.cars = []; localStorage.setItem('autohub.v1', JSON.stringify(d)); render(); })()""")
    check("the car deleted in Auto Hub: nothing from it in Day Hub", not FROM(car_card(a)) and a.js("hcCars().length") == 0)
    a.js(f"localStorage.setItem('autohub.v1', {json.dumps(before)}); render(); 0")
    check("back again when it's back", FROM(car_card(a)))

    print("\n-- Settings -> Hub family turns it off in that Hub")
    a.js("S.family = false; render(); 0")
    check("Hub family off: the Car card is Day Hub's own again", not FROM(car_card(a)) and a.js("hcAutoSoon()") == 0)
    a.js("S.family = true; save(); render(); 0")
    check("Hub family on: back", FROM(car_card(a)))
    a.close()


def test_owner_trip(b, base):
    print("\n-- Your phone: Trip Hub's Use my car")
    a = app(b, base, owner=True)
    before = raw(a)
    go(a, T.TRIP, "hcCarButtons"); a.js(TRIP); a.page.wait_for_timeout(150)
    btn = a.page.locator("#driveSheet [data-hcuse]")
    check("the drive sheet offers Use my car with Auto Hub's MPG", btn.count() == 1 and "Daily Driver · 28.5 mpg" in btn.first.inner_text(), btn.first.inner_text() if btn.count() else "")
    check("it says where the numbers come from and that range is yours", "From your fill-ups in Auto Hub" in a.page.inner_text("#driveSheet") and "Miles on a full tank isn't in Auto Hub" in a.page.inner_text("#driveSheet"))
    btn.first.click(); a.page.wait_for_timeout(100)
    check("a tap fills MPG 28.5 and gas $3.18 (35 / 11 gal)", a.page.input_value("#driveSheet [name=mpg]") == "28.5" and a.page.input_value("#driveSheet [name=gas]") == "3.18",
          (a.page.input_value("#driveSheet [name=mpg]"), a.page.input_value("#driveSheet [name=gas]")))
    check("nothing saved until Save car", not a.js("curTrip().vehicle && curTrip().vehicle.mpg"))
    a.page.fill("#driveSheet [name=range]", "380"); a.page.click("#driveSheet form[data-vehicle] button"); a.page.wait_for_timeout(150)
    v = a.js("curTrip().vehicle")
    check("Save car keeps it, with the range you typed", v == {"range": 380, "mpg": 28.5, "gas": 3.18}, v)
    check("the plan uses it: gas cost from 28.5 mpg", abs(a.js("drivePlan(curTrip(), curTrip().drives[0]).gallons") - 900 / 28.5) < 0.01)
    check("nothing written to Auto Hub", raw(a) == before)
    check("Trip Hub's records hold no garage", "garage" not in json.loads(raw(a, "triphub.v1") or "{}"))
    a.js("""(() => { const d = JSON.parse(localStorage.getItem('autohub.v1')); d.garage.cars[0].fuel = d.garage.cars[0].fuel.slice(0, 1); localStorage.setItem('autohub.v1', JSON.stringify(d)); showDrive('rt|dv1'); })()""")
    check("one fill-up isn't an MPG yet: no button", not a.js("!!document.querySelector('#driveSheet [data-hcuse]')"))
    a.js(f"localStorage.setItem('autohub.v1', {json.dumps(before)}); 0")
    a.js("S.family = false; showDrive('rt|dv1'); 0")
    check("Hub family off in Trip Hub: no button", not a.js("!!document.querySelector('#driveSheet [data-hcuse]')"))
    a.close()


def test_owner_auto(b, base):
    print("\n-- Your phone: Auto Hub's Hub Connections sheet")
    a = app(b, base, owner=True)
    a.page.wait_for_function("typeof hcShow === 'function'"); a.js("render(); 0")
    check("the new look is on (owner phone)", a.js("document.body.classList.contains('at')"))
    a.js("shellGo('more'); 0"); a.page.wait_for_timeout(150)
    tile = a.page.locator("[data-hcopen]")
    check("More -> This App has Hub Connections", tile.count() >= 1 and "Hub Connections" in tile.first.inner_text())
    tile.first.click(); a.page.wait_for_timeout(150)
    vis = lambda: a.js("(() => { const e = document.getElementById('hcSheet'); return !!e && !e.classList.contains('hidden'); })()")
    s = a.page.inner_text("#hcSheet") if vis() else ""
    check("the sheet opens with Money, Day, Trip and Hub Universe", vis() and all(n in s for n in ("Money Hub", "Day Hub", "Trip Hub", "Hub Universe")), s[:300])
    check("it says read, never copied, and the iPhone limit", "never copy or change them" in s and "iPhone home-screen apps keep their own storage" in s)
    check("1 car shared", "1 car shared." in s)
    tag = lambda hub: a.js(f"(() => {{ const r = document.querySelector('#hcSheet [data-hchub=\"{hub}\"] .tag'); return r ? r.textContent : ''; }})()")
    check("Day Hub not opened on this phone yet: no tag", tag("day") == "")
    a.page.go_back(); a.page.wait_for_timeout(250)
    check("back closes the sheet and stays in the app", not vis() and a.js("TAB") == "more", a.js("TAB"))
    a.js("localStorage.setItem('dayhub.v1', JSON.stringify({ name: 'Sam' })); localStorage.setItem('moneyhub.v1', JSON.stringify({ family: false })); hcShow(); 0")
    check("Day Hub on this phone: ON THIS PHONE", "ON THIS PHONE" in tag("day"))
    check("Money Hub with Hub family off: says so", tag("money") == "TURNED OFF THERE", tag("money"))
    a.js("hcHide(); localStorage.setItem('autohub.look', 'classic'); render(); openSettings(); 0"); a.page.wait_for_timeout(150)
    btn = a.page.locator("#famBox [data-hcopen]")
    check("classic look: Settings -> Hub family has the button", btn.count() == 1)
    btn.click(); a.page.wait_for_timeout(150)
    check("it closes Settings and opens the sheet", vis() and a.js("document.getElementById('sheet').classList.contains('hidden')"))
    a.page.click("#hcSheet [data-hcclose]"); a.page.wait_for_timeout(100)
    check("the ✕ closes it", not vis())
    a.close()


def test_crafted(b, base):
    print("\n-- Crafted records in Auto Hub's data run nothing and hide nothing")
    a = app(b, base, owner=True)
    a.page.wait_for_function("typeof hcShow === 'function'")
    evil = {"garage": {"cars": [
        {"id": "x1", "nick": "<img src=x onerror=\"window.__pwn=1\">", "miles": "42000<script>", "odo": "nope", "every": {"oil": "<x>", "rotate": [1e308, 0]},
         "services": [{"kind": "oil", "date": "2026-04-01", "miles": 39000}, {"kind": "rotate", "date": 5, "miles": "x"}, None, "str"],
         "papers": [{"kind": "insurance", "name": "<svg onload=\"window.__pwn=2\">", "expires": "2026-10-05"}, {"kind": "x", "expires": 12345}, {"kind": "<b>", "name": "", "expires": "~"}, None],
         "fuel": [{"date": "2026-09-01", "miles": 1000, "gal": 10, "cost": 30}, {"date": "2026-09-20", "miles": 1300, "gal": 10, "cost": 30}]},
        "junk", None, [1, 2],
        {"id": "x2", "nick": "\"><script>window.__pwn=3</script>", "odo": [{"date": 7, "miles": "a"}], "services": [{"kind": "oil", "date": "2026-05-01", "miles": 1}],
         "fuel": [{"date": "2026-09-01", "miles": 1, "gal": 1, "cost": "<b>"}, {"date": "2026-09-10", "miles": "x", "gal": 1}]},
        {"id": "x3", "nick": "Plain Car", "papers": [{"kind": "registration", "name": "State", "expires": "2026-10-10"}]}]}}
    a.js(f"localStorage.setItem('autohub.v1', {json.dumps(json.dumps(evil))}); 0")
    errs = []; a.page.on("pageerror", lambda e: errs.append(str(e)))
    go(a, "/", "hcAutoRows")
    t = car_card(a)
    check("Day Hub draws the Car card", FROM(t), t[:300])
    check("a good car beside crafted ones still shows", "State · Plain Car" in t, t[:400])
    check("the crafted name shows as text", "<svg onload" in t or "<img src=x" in t, t[:300])
    go(a, T.TRIP, "hcCarButtons"); a.js(TRIP); a.page.wait_for_timeout(150)
    check("Trip Hub's drive sheet draws", a.js("!!document.querySelector('#driveSheet form[data-vehicle]')"))
    a.js("hcShow(); 0")
    check("ran nothing, anywhere", not a.js("window.__pwn"), a.js("window.__pwn"))
    check("no page errors", not errs, errs[:2])
    a.js("localStorage.setItem('autohub.v1', '{not json'); render(); showDrive('rt|dv1'); 0")
    check("Auto Hub's data unreadable: nothing shows, nothing breaks", not a.js("!!document.querySelector('#driveSheet [data-hcuse]')") and a.js("hcCars().length") == 0)
    a.close()


def test_no_auto_and_others(b, base):
    print("\n-- No Auto Hub on the phone, and the other Hubs never load it")
    a = T.App(b, base, path="/", at=AT_DAY); a.base = base
    a.js("localStorage.setItem('scotthub.k', 'TEST-PASS'); 0"); go(a, "/")
    check("Day Hub, no Auto Hub data: nothing downloaded, the Car card is just Day Hub's", not FROM(car_card(a)) and not loaded(a, "auto.js") and not loaded(a, "hubconnect.js"))
    go(a, T.TRIP); a.js(TRIP); a.page.wait_for_timeout(150)
    check("Trip Hub, no Auto Hub data: no button, nothing downloaded", not a.js("!!document.querySelector('#driveSheet [data-hcuse]')") and not loaded(a, "auto.js") and not loaded(a, "hubconnect.js"))
    for name, path in (("Money Hub", T.MONEY if hasattr(T, "MONEY") else "/../moneyhub/"), ("Cruise Hub", T.CRUISE), ("Home Hub", "/../homehub/"), ("Health Hub", "/../healthhub/"), ("Hub Universe", "/../hubuniverse/")):
        a.page.goto(base + path); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(400)
        check(f"{name}: never loads it, even on your phone", not loaded(a, "hubconnect.js") and a.js("typeof hcShow") == "undefined")
    a.close()


def test_review(b, base):
    print("\n-- Review fixes: no false all-clear, array dates, Hub family on without a reload, the empty-state words")
    # auto.js won't load (a weak signal): hubconnect.js isn't loaded either, so the card stays Day Hub's own instead of saying "nothing due"
    a = app(b, base, owner=True)
    a.ctx.route("**/dayhub/auto.js", lambda r: r.abort())
    a.page.goto(base + "/"); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(1200)
    a.js("S.name = 'Sam'; save(); render(); 0")
    check("auto.js fails: hubconnect.js isn't loaded", a.js("typeof hcAutoRows") == "undefined" and not loaded(a, "hubconnect.js"))
    check("...so no false 'Nothing due' on the Car card", "nothing due" not in car_card(a).lower() and not FROM(car_card(a)))
    a.ctx.unroute("**/dayhub/auto.js")
    a.page.reload(); a.page.wait_for_function("typeof hcAutoRows === 'function'", timeout=15000); a.js("render(); 0")
    check("next open it loads", FROM(car_card(a)))
    # a car whose services can't be read: say so, never "nothing due"
    a.js("""(() => { const d = JSON.parse(localStorage.getItem('autohub.v1')); const c = d.garage.cars[0];
      c.services = [{ id: 'z', kind: 'oil', date: ['2026-09-01'], miles: 1 }]; c.papers = []; localStorage.setItem('autohub.v1', JSON.stringify(d)); render(); })()""")
    t = car_card(a)
    check("an unreadable service record: 'Couldn't read all', not 'Nothing due'", "couldn't read all of auto hub's records" in t.lower() and "nothing due" not in t.lower(), t[-300:])
    # an array date on a paper hides only that paper; one on a fill-up leaves the drive sheet working
    a.js("""(() => { const d = JSON.parse(localStorage.getItem('autohub.v1')); const c = d.garage.cars[0];
      c.services = []; c.papers = [{ id: 'q1', kind: 'registration', name: 'Odd', expires: ['2026-10-03'] }, { id: 'q2', kind: 'insurance', name: 'Sample Insurance', expires: addDays(today(), 7) }];
      c.fuel = c.fuel.concat([{ id: 'fz', date: ['2026-09-30'], miles: 41500, gal: 10, cost: 32 }]); localStorage.setItem('autohub.v1', JSON.stringify(d)); render(); })()""")
    t = car_card(a)
    check("an array date on one paper: the next paper still shows", "Sample Insurance · Daily Driver" in t and "Odd · Daily Driver" not in t, t[-300:])
    before = raw(a)
    go(a, T.TRIP, "hcCarButtons"); a.js(TRIP); a.page.wait_for_timeout(150)
    check("an array date on a fill-up: the drive sheet still opens with Use my car", a.js("!!document.querySelector('#driveSheet form[data-vehicle]')") and a.js("!!document.querySelector('#driveSheet [data-hcuse]')"))
    check("each button carries its car's own gas price", "$3.18 gas" in a.page.inner_text("#driveSheet [data-hcuse]") or "$3.20 gas" in a.page.inner_text("#driveSheet [data-hcuse]"), a.page.inner_text("#driveSheet [data-hcuse]"))
    check("still nothing written to Auto Hub", raw(a) == before)
    a.close()
    # Hub family off at open, then on in Settings: it loads without a reload; the switch says it covers Auto Hub
    a = app(b, base, owner=True)
    a.page.goto(base + "/"); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
    a.js("S.name = 'Sam'; S.family = false; save(); 0"); a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(800)
    check("Hub family off at open: nothing loaded", a.js("typeof hcAutoRows") == "undefined")
    a.js("closeBrief(); openSettings(); 0"); a.page.wait_for_timeout(150)
    a.page.locator('#famBox input[data-fam]').check(); a.page.wait_for_function("typeof hcAutoRows === 'function'", timeout=15000); a.page.wait_for_timeout(200)
    check("turned on in Settings: it loads without a reload", a.js("hcOn()") and a.js("typeof hcShow") == "function")
    a.js("drawFamBox(); 0")
    check("Day Hub's Hub family box says the switch also covers Auto Hub", "also lets Day Hub read your car records from Auto Hub" in a.page.inner_text("#famBox"), a.page.inner_text("#famBox")[:300])
    a.js("closeSettings(); render(); 0")
    t = car_card(a)
    check("the Car card's empty words point at Auto Hub, not 'Oil, tires...'", "Auto Hub keeps your car's service and papers, below." in t and "Oil, tires, registration" not in t, t[:300])
    a.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for t in (test_customer, test_owner_day, test_owner_trip, test_owner_auto, test_crafted, test_no_auto_and_others, test_review):
            if len(sys.argv) < 2 or any(x in t.__name__ for x in sys.argv[1:]): t(b, base)
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e and "ERR_" not in e and "Failed to load" not in e]
    check("no page / console errors anywhere", not errs, errs[:6])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
