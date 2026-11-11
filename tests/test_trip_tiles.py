"""
SAVE AS: test_trip_tiles.py   LOCATION: C:/MarvelApps/dayhub/tests/test_trip_tiles.py

TRIP HUB NEW LOOK, "Atlas" (triptiles.js / triptiles.css / ../triphub/art, Scott 11/06: his board, then "Build it"). Drives the real Trip Hub with
the main suite's own helpers (run_tests.py: fake network, frozen clock, App). Checks: the switch is OFF and a customer keeps the old look and
fetches none of the art; ?look=tiles / ?look=classic; the owner's phone turns it on by itself once and Classic Look sticks; the five tabs;
his 12 tiles in his order and where each one goes; the My Trip card before, on travel day, during and after the trip, and with no dates;
the full screens and their back arrows; Trip Money's numbers and who owes whom; the phone's back button; More holds everything; the Play
app shows no Pass or price; crafted text runs nowhere; Simple mode and Real photo off; Cruise Hub and Day Hub never get it; narrow phones.

RUN:   python tests/test_trip_tiles.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

BOOKINGS = """(() => { const tr = curTrip(); tr.bookings = [
  { id: 'f1', kind: 'flight', a: 'AAA', b: 'BBB', day: '2026-10-12', t: '07:10', endDay: '', endT: '10:45', num: 'SK 204', cost: 1200, paid: true, leave: { drive: 35 } },
  { id: 'c1', kind: 'car', a: 'Sample Rentals', b: 'BBB airport', day: '2026-10-12', t: '11:15', endDay: '2026-10-19', endT: '09:00', num: 'CAR-552', cost: 360 },
  { id: 'h1', kind: 'hotel', a: 'Ridgeline Lodge', b: '', day: '2026-10-12', t: '15:00', endDay: '2026-10-19', endT: '11:00', num: 'HTL-7731', cost: 840 },
  { id: 'd1', kind: 'dinner', a: 'Trailside Grill', b: '', day: '2026-10-15', t: '19:30', num: 'D-77' }];
  tr.bookings.forEach(b => syncBookingCost(tr, b));
  tr.split = { people: ['Alex', 'Blair', 'Casey'], by: {}, for: {} };
  tr.costs.forEach(c => { if (c.paid) tr.split.by['c:' + c.id] = 'Alex'; });
  save(); render(); })()"""


def trip(b, base, at="2026-09-21T09:00:00", look="tiles", owner=False, width=390, height=844, path=None, bookings=True, dates=True):
    a = T.App(b, base, path=path or T.TRIP, at=at, width=width, height=height, look=None if look is None else "classic")
    a.art = []
    a.page.on("request", lambda r: a.art.append(r.url) if "/triphub/art/" in r.url else None)
    a.js("localStorage.setItem('triphub.startTab', 'home')")
    if look: a.js(f"localStorage.setItem('triphub.look', '{look}')")
    if owner:                          # the owner turn-on is checked once per load: Scott Hub's key is on the phone before Trip Hub opens
        a.js("localStorage.setItem('scotthub.k', 'TEST-PASS')"); a.page.reload(); a.page.wait_for_function("typeof render === 'function'")
    a.page.fill('form[data-setup] [name=name]', "Sam"); a.page.fill('form[data-setup] [name=city]', "83702")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"tname": "Mountain Week", "port": "Silver Pines", "travelers": "3", "start": "2026-10-12", "end": "2026-10-19"})
    a.page.wait_for_timeout(150); a.js("closeQA()")
    if not dates: a.js("(() => { const tr = curTrip(); tr.start = ''; tr.end = ''; save(); })()")   # the form needs dates; a pasted trip can have none
    if bookings: a.js(BOOKINGS)
    a.js("shellGo('home')"); a.page.wait_for_timeout(300)
    return a
def tabs(a): return a.js("[...document.querySelectorAll('#tabbar button')].map(b => b.textContent.replace(/[^A-Za-z ]/g, '').trim())")   # the old bar's labels carry an emoji
def cards(a): return a.page.inner_text("#cards")
def shown(a, sel): return a.js(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; }})()")
def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(250)
def close_sheets(a): a.js("document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'))")
def title(a): return a.js("(document.querySelector('#cards .tt-title .grow') || {}).textContent || ''").strip()
def home(a): close_sheets(a); a.js("TT_SCREEN = null; TT_FROM = null; TT_TAB_FROM = null; shellGo('home')"); a.page.wait_for_timeout(150)
def tile(a, label): return f'.tt-main .tt-tile:has(b:text-is("{label}"))'


def test_switch(b, base):
    print("\n-- The switch: ON for every customer (Scott 11/10: \"Yes, all of them\"); More -> Classic Look keeps the old one")
    a = trip(b, base, look=None)
    check("the switch in the code is ON", a.js("TT_ON === true"))
    check("a customer, nothing picked: the new look, and its art comes down", a.js("ttOn()") and a.js("localStorage.getItem('triphub.look')") is None and a.js("!!document.querySelector('.tt-main')") and len(a.art) > 0, (a.js("ttOn()"), a.art[:2]))
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(200)
    check("a customer's five taps on the app's name change nothing", a.js("ttOn()") and a.js("localStorage.getItem('triphub.look')") is None)
    a.js("closeSettings(); 0"); a.page.wait_for_timeout(100)
    a.js("shellGo('ai')"); tap(a, '[data-ttgo="classic"]')
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("a customer's More -> Classic Look: the old Trip Hub, and it sticks after a reload", not a.js("ttOn()") and a.js("localStorage.getItem('triphub.look')") == "classic")
    a.ctx.close()
    a = trip(b, base, look="classic")
    check("Classic Look picked: old look, old tab names", not a.js("ttOn()") and not a.js("document.body.classList.contains('tt')") and tabs(a) == ["Home", "Plan", "Explore", "Wallet", "AI"], tabs(a))
    check("...the old Home (What's going on + bubbles)", "What's going on" in cards(a) and not a.js("!!document.querySelector('.tt-main')"))
    check("...and none of the new art fetched", not a.art, a.art[:3])
    h0 = a.js("history.length")
    for go in ("plan", "explore", "wallet", "ai", "home"): a.page.click(f'#tabbar [data-shellgo="{go}"]'); a.page.wait_for_timeout(120)
    a.js("showHelp()"); a.page.wait_for_timeout(150); a.page.click("#helpSheet .sheet-head h2"); a.page.wait_for_timeout(150)
    check("...and tapping round the tabs and a sheet adds no history (the back button is the browser's own)", a.js("history.length") == h0 and a.js("TT_DEPTH") == 0, (h0, a.js("history.length"), a.js("TT_DEPTH")))
    close_sheets(a)
    a.page.goto(base + T.TRIP + "?look=tiles"); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("?look=tiles turns it on for this phone", a.js("ttOn()") and a.js("document.body.classList.contains('tt')"))
    check("...and leaves the address clean", "look=" not in a.js("location.href"))
    a.page.goto(base + T.TRIP + "?look=classic"); a.page.wait_for_function("typeof render === 'function'")
    check("?look=classic turns it back", not a.js("ttOn()") and not a.js("document.body.classList.contains('tt')"))
    a.ctx.close()
    a = trip(b, base, look=None, owner=True)
    check("the owner's phone (Scott Hub on it) gets the new look by itself", a.js("ttOn()") and a.js("localStorage.getItem('triphub.ownerlook')") == "1")
    a.js("shellGo('ai')"); tap(a, '[data-ttgo="classic"]')
    check("More -> Classic Look: the old look, on this phone", not a.js("ttOn()") and "Classic look on this phone" in a.page.inner_text("#toast"))
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("...and it sticks after a reload (the owner turn-on runs once)", not a.js("ttOn()"))
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')               # the morning brief comes back on a reload; it isn't what's tested here
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(250)
    check("on the owner's phone five taps flip it back on, landing on Home", a.js("ttOn()") and a.js("TAB") == "home")
    a.ctx.close()


def test_home(b, base):
    print("\n-- Home: his board (21 days to go, Ready, the 12 tiles in his order, the five tabs)")
    a = trip(b, base)
    check("five tabs: Home, Plan, Map, Money, More", tabs(a) == ["Home", "Plan", "Map", "Money", "More"], tabs(a))
    t = a.js("[...document.querySelectorAll('.tt-main .tt-tile b')].map(x => x.textContent)")
    check("his 12 tiles in his order", t == ["My Trip", "Bookings", "Today", "Map", "Packing", "Trip Money", "Spending", "Fix My Trip", "Hotel", "Road Trip", "Things to Do", "Help"], t)
    s = a.page.inner_text(".tt-stage")
    check("My Trip card: the name, the dates, 21 days to go, the Ready bar", all(x in s for x in ("My Trip", "Mountain Week", "Oct 12", "Oct 19", "21", "Days to go", "Ready to Go")), s)
    check("every tile has its painted icon (no emoji)", a.js("[...document.querySelectorAll('.tt-main .tt-tile img.tt-icimg')].length") == 12)
    check("the art and icons were fetched on this phone", any("home.webp" in u for u in a.art) and any("ic_backpack.webp" in u for u in a.art), a.art[:4])
    a.js("window.scrollTo(0, hubPanY())"); a.page.wait_for_timeout(100)        # 11/08: the opening glide lands here
    bottom = a.js("Math.max(...[...document.querySelectorAll('.tt-main .tt-tile')].map(e => e.getBoundingClientRect().bottom))")
    bar = a.js("document.getElementById('tabbar').getBoundingClientRect().top")
    check("all twelve tiles on one screen of a 390x844 phone, once it has glided down, above the tab bar", bottom <= bar + 1, (bottom, bar))
    check("nothing runs off the side", not a.js("document.documentElement.scrollWidth > window.innerWidth + 1"))
    check("Needs you and the big button wait below the tiles", a.js("!!document.querySelector('.tt-below .tt-big-btn')") and "WHAT AM I FORGETTING" in a.page.inner_text(".tt-below").upper())
    tap(a, '.tt-ready')
    check("the Ready bar opens the ready checklist", shown(a, "#readySheet"), a.js("[...document.querySelectorAll('.sheet:not(.hidden)')].map(s => s.id)"))
    a.ctx.close()


def test_tiles(b, base):
    print("\n-- Where each tile goes (each opens what Trip Hub already has)")
    a = trip(b, base, at="2026-10-14T10:00:00")       # day 3 of the trip
    tap(a, tile(a, "My Trip"))
    check("My Trip -> Trip Timeline, a full screen with no tab bar", title(a) == "Trip Timeline" and a.js("document.body.dataset.ttscreen") == "timeline" and not shown(a, "#tabbar"), title(a))
    check("...the day-by-day rows with today marked", a.js("document.querySelectorAll('#cards .timeline .tl-row').length") >= 8 and a.js("!!document.querySelector('#cards .timeline .tl-row.now')"))
    tap(a, ".tt-back")
    check("its back arrow goes Home", a.js("TAB") == "home" and not a.js("document.body.dataset.ttscreen") and shown(a, "#tabbar"))
    tap(a, tile(a, "Bookings"))
    check("Bookings -> the bookings screen with all four and Fix my trip", title(a) == "Bookings" and all(x in cards(a) for x in ("SK 204", "Sample Rentals", "Ridgeline Lodge", "Trailside Grill", "Fix my trip")), cards(a)[:300])
    home(a); tap(a, tile(a, "Today"))
    check("Today (on the trip) -> today's day screen", shown(a, "#daySheet") and "Oct 14" in a.page.inner_text("#daySheet"))
    home(a); tap(a, tile(a, "Map"))
    check("Map -> the Map tab: the next stop, then the trip on the map", a.js("TAB") == "explore" and "Next stop" in cards(a) and "Trailside Grill" in cards(a) and "on the map" in cards(a))
    home(a); tap(a, tile(a, "Packing"))
    check("Packing -> Plan, Packing", a.js("TAB") == "plan" and a.js("PLAN_VIEW") == "packing")
    home(a); tap(a, tile(a, "Trip Money"))
    check("Trip Money -> the money screen", title(a) == "Trip Money" and a.js("document.body.dataset.ttscreen") == "money")
    home(a); tap(a, tile(a, "Spending"))
    check("Spending -> Money, on its Spending tab", a.js("TAB") == "wallet" and a.js("S.tripTab") == "onboard")
    home(a); tap(a, tile(a, "Fix My Trip"))
    check("Fix My Trip -> Fix my trip", shown(a, "#fixSheet"))
    home(a); tap(a, tile(a, "Hotel"))
    check("Hotel -> tonight's hotel: room, wifi, check-out", shown(a, "#hotelSheet") and "Ridgeline Lodge" in a.page.inner_text("#hotelSheet"))
    home(a); tap(a, tile(a, "Road Trip")); a.page.wait_for_timeout(200)
    check("Road Trip -> the day screen at its drive planner", shown(a, "#daySheet") and a.js("!!document.querySelector('#daySheet .drive-box, #daySheet .drive-add')"))
    home(a); tap(a, tile(a, "Things to Do"))
    check("Things to Do -> its screen: the idea buttons (they say they come from the AI), then the weather", title(a) == "Things to Do" and "Top things to do" in cards(a) and "Trip Hub AI" in cards(a) and "Weather" in cards(a))
    home(a); tap(a, tile(a, "Help"))
    check("Help -> the help screen with Fix my trip", shown(a, "#helpSheet") and "FIX MY TRIP" in a.page.inner_text("#helpSheet").upper())
    a.ctx.close()
    a = trip(b, base, bookings=False)
    go = a.js("Object.fromEntries([...document.querySelectorAll('.tt-main .tt-tile')].map(x => [x.querySelector('b').textContent, x.dataset.ttgo || '']))")
    check("no bookings yet: Fix My Trip and Hotel go to Bookings instead of a dead tap", go.get("Fix My Trip") == "bookings" and go.get("Hotel") == "bookings", go)
    check("...and say why on the tile (add a hotel first / add a booking first)", a.page.is_visible(tile(a, "Hotel") + " small") and "add a hotel first" in a.page.inner_text(tile(a, "Hotel"))
          and "add a booking first" in a.page.inner_text(tile(a, "Fix My Trip")))
    a.js("shellGo('ai')"); a.page.wait_for_timeout(150); tap(a, '.tt-more .tt-tile:has(b:text-is("Documents"))')
    check("More -> Documents opens the Documents list (not Packing)", a.js("TAB") == "plan" and a.js("S.tripTab") == "lists" and a.js("S.tripList") == "docs", (a.js("S.tripTab"), a.js("S.tripList")))
    a.ctx.close()
    a = trip(b, base, width=820, height=1180)
    a.js("shellGo('ai')"); a.page.wait_for_timeout(200)
    lefts = a.js("[...document.querySelectorAll('.tt-more')].map(e => Math.round(e.getBoundingClientRect().left))")
    check("tablet (820 wide): More's groups go across the screen, not split into columns", len(set(lefts)) == 1, lefts)
    a.ctx.close()


def test_stage(b, base):
    print("\n-- The My Trip card for the moment")
    a = trip(b, base, at="2026-10-12T05:30:00")
    s = a.page.inner_text(".tt-stage")
    check("travel day: Travel day, Leave at 6:35 AM (35 min drive before 7:10), the flight", "Travel day" in s and "Leave at 6:35 AM" in s and "SK 204" in s and "7:10 AM" in s, s)
    a.js("(() => { curTrip().bookings.forEach(b => { delete b.leave; }); save(); render(); })()"); a.page.wait_for_timeout(150)
    s = a.page.inner_text(".tt-stage")
    check("travel day with no leave time typed: the flight still shows", "Travel day" in s and "SK 204" in s and "Leave at" not in s, s)
    a.ctx.close()
    a = trip(b, base, at="2026-10-14T10:00:00")
    s = a.page.inner_text(".tt-stage")
    check("during: Day 3 of 8, no Ready bar", "Day 3 of 8" in s and not a.js("!!document.querySelector('.tt-ready')"), s)
    a.js("TT_SCREEN = null; render()"); a.ctx.close()
    a = trip(b, base, at="2026-10-15T09:00:00")
    s = a.page.inner_text(".tt-stage")
    check("during, a booking today: Next: dinner today 7:30 PM", "Next:" in s and "Trailside Grill" in s and "today 7:30 PM" in s, s)
    a.ctx.close()
    a = trip(b, base, at="2026-10-21T10:00:00")
    s = a.page.inner_text(".tt-stage")
    check("after: Welcome home", "Welcome home" in s, s)
    tap(a, ".tt-stage")
    check("...and it opens the wrap-up", shown(a, "#wrapSheet"))
    a.ctx.close()
    a = trip(b, base, dates=False, bookings=False)
    check("no dates yet: the card asks for them and opens the trip form", "Add your dates" in a.page.inner_text(".tt-stage") and a.js("document.querySelector('.tt-stage').dataset.tripedit") == a.js("curTrip().id"))
    a.ctx.close()
    a = T.App(b, base, path=T.TRIP); a.js("localStorage.setItem('triphub.look', 'tiles')")
    a.page.fill('form[data-setup] [name=name]', "Sam"); a.page.fill('form[data-setup] [name=city]', "83702"); a.page.click('form[data-setup] button')
    a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.js("shellGo('home')"); a.page.wait_for_timeout(200)
    check("no trip yet: the ways in, under the compass", a.js("ttOn()") and "Add my trip" in cards(a) and a.js("!!document.querySelector('.tt-hero .tt-logo')"))
    a.ctx.close()


def test_money(b, base):
    print("\n-- Trip Money: his three boxes, what it adds up to, who owes whom")
    a = trip(b, base)
    tap(a, tile(a, "Trip Money"))
    st = a.js("[...document.querySelectorAll('.tt-stats > div')].map(d => d.innerText.replace(/\\s+/g, ' ').trim())")
    check("Trip Total $2,400 · Paid $1,200 · Left to Pay $1,200 (the trip's own sums)", st == ["Trip Total $2,400", "Paid $1,200", "Left to Pay $1,200"], st)
    rows = a.js("[...document.querySelectorAll('.tt-mlist .tt-mrow')].map(d => d.innerText.replace(/\\s+/g, ' ').trim())")
    check("rows by booking kind: Flights $1,200, Hotel $840, Car $360", rows == ["Flights $1,200", "Hotel $840", "Car $360"], rows)
    sp = a.page.inner_text(".tt-split")
    check("Split the Cost: Alex paid the flight, so Alex is owed $800 and Blair and Casey owe $400", "Alex" in sp and "is owed $800" in sp and sp.count("owes $400") == 2, sp)
    tap(a, ".tt-split")
    check("...and it opens the split sheet", shown(a, "#splitSheet"))
    key = a.js("Object.keys(curTrip().split.by)[0]")
    a.page.select_option(f'#splitSheet select[data-splitby$="|{key}"]', "Blair"); a.page.wait_for_timeout(200)
    a.page.evaluate("history.back()"); a.page.wait_for_timeout(500)
    sp = a.page.inner_text(".tt-split") if a.js("!!document.querySelector('.tt-split')") else ""
    check("the phone's back button closes the split sheet and the sums redraw (Blair paid now: Alex owes $400, Blair is owed $800)",
          not shown(a, "#splitSheet") and "Alex" in sp and "owes $400" in sp and "is owed $800" in sp, sp)
    close_sheets(a); tap(a, ".tt-pulse")
    check("the Spending row stays on Money, on its Spending tab", a.js("TAB") == "wallet" and a.js("S.tripTab") == "onboard")
    tap(a, ".tt-back")
    check("Money's back arrow goes Home", a.js("TAB") == "home")
    a.js("TT_SCREEN = 'bookings'; render()"); a.page.wait_for_timeout(150)
    a.js("document.querySelector('#cards').insertAdjacentHTML('beforeend', '<button id=\"gm\" data-shellgo=\"wallet\">m</button>')"); tap(a, "#gm")
    tap(a, ".tt-back")
    check("Money opened from Bookings: its back arrow goes back to Bookings", title(a) == "Bookings", title(a))
    a.ctx.close()


def test_more_and_back(b, base):
    print("\n-- More holds everything; the phone's back button walks back")
    a = trip(b, base)
    a.js("shellGo('ai')"); a.page.wait_for_timeout(200)
    m = cards(a)
    want = ["Packing", "Documents", "Before You Go", "What Am I Forgetting?", "Bookings", "Fix My Trip", "My Day", "Trip Timeline", "Things to Do", "Weather",
            "Road Trip", "Map", "Trip Diary", "Trip Money", "Spending", "Split the Cost", "Export the Money", "Ask Trip Hub", "Reminders", "Settings", "Simple Mode", "Classic Look"]
    miss = [w for w in want if w not in m]
    check("More: every feature has a place", not miss, miss)
    check("...the AI's questions at the bottom", "Ask anything" in m)
    check("the Pass tile on the website", "Trip Hub Pass" in m)
    tap(a, '[data-ttgo="things:weather"]')
    check("Weather -> Things to Do, at the weather card", title(a) == "Things to Do")
    a.ctx.close()
    a = trip(b, base)
    tap(a, tile(a, "My Trip"))
    check("opening a full screen adds one step of history", a.js("TT_DEPTH") == 1)
    a.page.evaluate("history.back()"); a.page.wait_for_timeout(400)
    check("the phone's back button: Trip Timeline -> Home", a.js("TAB") == "home" and not a.js("document.body.dataset.ttscreen"), (a.js("TAB"), a.js("document.body.dataset.ttscreen")))
    tap(a, tile(a, "Help"))
    a.page.evaluate("history.back()"); a.page.wait_for_timeout(400)
    check("...an open sheet closes first", not shown(a, "#helpSheet") and a.js("TAB") == "home")
    a.ctx.close()


def test_play_and_safety(b, base):
    print("\n-- Play app wording, crafted text, Simple mode, Real photo off, other Hubs")
    a = trip(b, base, path=T.TRIP + "?src=play")
    check("Play app: the new look is on", a.js("STORE_MODE") and a.js("ttOn()"))
    seen = []
    for go in ("home", "plan", "explore", "wallet", "ai"):
        a.js(f"TT_SCREEN = null; shellGo('{go}')"); a.page.wait_for_timeout(120); seen.append(cards(a))
    for sc in ("timeline", "bookings", "things"):
        a.js(f"TT_SCREEN = '{sc}'; render()"); a.page.wait_for_timeout(120); seen.append(cards(a))
    txt = " ".join(seen)
    import re
    check("Play app: no Pass tile, no Pro, trial or Whop words on any screen", "Pass" not in txt and not re.search(r"\bPro\b|whop|trial", txt, re.I), re.findall(r".{20}(?:Pass|\bPro\b|whop|trial).{20}", txt, re.I)[:3])
    a.ctx.close()
    X = '<img src=x onerror=window.__pwn=1>'
    for at in ("2026-09-21T09:00:00", "2026-10-12T05:30:00", "2026-10-15T09:00:00"):   # before (Ready), travel day (Leave at + the flight), during (Next:)
        a = trip(b, base, at=at)
        a.js(f"""(() => {{ const x = {X!r}, tr = curTrip(); tr.name = x; tr.port = x; tr.bookings.forEach(b => {{ b.a = x; b.b = x; b.num = x; }});
          tr.split.people = [x, 'B']; Object.keys(tr.split.by).forEach(k => {{ tr.split.by[k] = x; }}); save(); render(); }})()""")
        hit = []
        for go in ("home", "plan", "explore", "wallet", "ai"):
            a.js(f"TT_SCREEN = null; shellGo('{go}')"); a.page.wait_for_timeout(80)
            if a.js("window.__pwn === 1 || !!document.querySelector('#cards img[src=\"x\"]')"): hit.append(go)
        for sc in ("timeline", "bookings", "things"):
            a.js(f"TT_SCREEN = '{sc}'; render()"); a.page.wait_for_timeout(80)
            if a.js("window.__pwn === 1 || !!document.querySelector('#cards img[src=\"x\"]')"): hit.append(sc)
        a.js("TT_SCREEN = null; shellGo('wallet')"); a.page.wait_for_timeout(80)
        drawn = a.js("!!document.querySelector('.tt-split .tt-person')")
        check(f"crafted text in the trip, bookings and split names runs nowhere ({at[:10]}; the split names drawn: {drawn})", not hit and drawn, hit)
        if at != "2026-10-15T09:00:00": a.ctx.close()
    a.js("TT_SCREEN = null; S.simple = true; save(); shellGo('home')"); a.page.wait_for_timeout(150)
    check("Simple mode always wins", not a.js("ttOn()") and not a.js("document.body.classList.contains('tt')"))
    a.ctx.close()
    a = trip(b, base, look="tiles")
    a.js("S.photo = false; save(); render()"); a.page.wait_for_timeout(150)
    check("Real photo off: no pictures behind the screens, the icons stay", a.js("document.body.classList.contains('tt-noart')") and a.js("document.querySelectorAll('.tt-main img.tt-icimg').length") == 12)
    a.ctx.close()
    c = T.App(b, base, path=T.CRUISE); c.js("localStorage.setItem('triphub.look', 'tiles'); localStorage.setItem('scotthub.k', 'TEST-PASS')"); c.page.reload(); c.page.wait_for_function("typeof render === 'function'")
    check("Cruise Hub never gets it (it doesn't even load it)", c.js("typeof ttOn") == "undefined" and not c.js("document.body.classList.contains('tt')"))
    c.ctx.close()
    d = T.App(b, base, path="/"); d.js("localStorage.setItem('triphub.look', 'tiles')"); d.page.reload(); d.page.wait_for_function("typeof render === 'function'")
    check("Day Hub never gets it", d.js("typeof ttOn") == "undefined" and not d.js("document.body.classList.contains('tt')"))
    d.ctx.close()
    for w, h in ((360, 740), (320, 640)):
        a = trip(b, base, width=w, height=h)
        wide = []
        for go in ("home", "plan", "explore", "wallet", "ai"):
            a.js(f"TT_SCREEN = null; shellGo('{go}')"); a.page.wait_for_timeout(80)
            if a.js("document.documentElement.scrollWidth > window.innerWidth + 1"): wide.append(go)
        for sc in ("timeline", "bookings", "things"):
            a.js(f"TT_SCREEN = '{sc}'; render()"); a.page.wait_for_timeout(80)
            if a.js("document.documentElement.scrollWidth > window.innerWidth + 1"): wide.append(sc)
        check(f"{w}x{h} phone: nothing runs off the side on any screen", not wide, wide)
        a.ctx.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        for t in (test_switch, test_home, test_tiles, test_stage, test_money, test_more_and_back, test_play_and_safety):
            t(b, base)
        errs = [e for e in T.ERRORS[before:] if "favicon" not in e]
        check("no page errors anywhere", not errs, errs[:3])
        b.close()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
