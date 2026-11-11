"""
SAVE AS: test_home_tiles.py   LOCATION: C:/MarvelApps/dayhub/tests/test_home_tiles.py

HOME HUB NEW LOOK, "Lamplight" (hometiles.js / hometiles.css / ../homehub/art, Scott 11/06: his board, then "Home Hub" = build it). Drives the real
Home Hub with the main suite's own helpers (run_tests.py: fake network, frozen clock, App). Checks: the switch is OFF and a customer keeps the
old look, fetches none of the art and gets no history steps; the first-run setup stays the classic screen; ?look=tiles / ?look=classic; the
owner's phone turns it on by itself once and Classic Look sticks; the five tabs; his 12 tiles in his order and where each one goes; the Your
House card (spaces, next due, tonight's weather warning); a room as a full screen with home.js's own tabs, forms and buttons (add an item, add a
task, done, notes, rename, remove asks first, add a space); Rooms / Upkeep / Money / More; Coming Up; the back arrows and the phone's back
button; Play app wording; crafted text runs nowhere; Real photo off; Day, Trip and Auto Hub never get it; narrow phones and a tablet.

RUN:   python tests/test_home_tiles.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

TASKS = """(() => { const sp = S.house.spaces, k = sp.find(s => s.key === 'kitchen'), h = sp.find(s => s.key === 'hvac');
  k.items.push({ id: 'i1', name: 'Dishwasher', model: '', note: '', added: today() }, { id: 'i2', name: 'Fridge water filter', model: '', note: '', added: today() });
  k.tasks.push({ id: 't1', title: 'Clean dishwasher filter', due: '2026-10-20', every: 3, done: false }, { id: 't2', title: 'Test smoke alarm', due: '2026-09-28', every: 1, done: false });
  h.tasks.push({ id: 't3', title: 'Change HVAC filter', due: '2026-10-04', every: 3, done: false });
  S.upkeep = (S.upkeep || []).concat([{ id: 'u1', area: 'home', name: 'Trash day', every: 1, unit: 'weeks', last: '2026-09-29' }]); save(); render(); })()"""


def home(b, base, at="2026-10-01T08:00:00", look="tiles", owner=False, width=390, height=844, path=None, setup=True, tasks=True):
    a = T.App(b, base, path=path or T.HOMEP, at=at, width=width, height=height, look=None if look is None else "classic")
    a.art = []
    a.page.on("request", lambda r: a.art.append(r.url) if "/homehub/art/" in r.url else None)
    if look: a.js(f"localStorage.setItem('homehub.look', '{look}')")
    if owner: a.js("localStorage.setItem('scotthub.k', 'TEST-PASS')"); a.page.reload(); a.page.wait_for_function("typeof render === 'function'")
    if setup:
        a.page.fill('form[data-homesetup] [name=name]', "Sam"); a.page.fill('form[data-homesetup] [name=city]', "83702")
        a.page.click('form[data-homesetup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        if tasks: a.js(TASKS)
        a.js("render()"); a.page.wait_for_timeout(300)
    return a
def tabs(a): return a.js("[...document.querySelectorAll('#tabbar button')].map(b => b.textContent.replace(/[^A-Za-z ]/g, '').trim())")
def cards(a): return a.page.inner_text("#cards")
def shown(a, sel): return a.js(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; }})()")
def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(250)
def title(a): return a.js("(document.querySelector('#cards .ht-title .grow') || {}).textContent || ''").strip()
def tile(label, where=".ht-main"): return f'{where} .ht-tile:has(b:text-is("{label}"))'
def back_home(a): a.js("document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); HT_SCREEN = null; HT_FROM = null; HOME_OPEN = null; shellGo('home')"); a.page.wait_for_timeout(150)
def kid(a): return a.js("S.house.spaces.find(s => s.key === 'kitchen').id")


def test_switch(b, base):
    print("\n-- The switch: ON for every customer (Scott 11/10: \"Yes, all of them\"); More -> Classic Look keeps the old one")
    a = home(b, base, look=None)
    check("the switch in the code is ON", a.js("HT_ON === true"))
    check("a customer, nothing picked: the new look, and its art comes down", a.js("htOn()") and a.js("localStorage.getItem('homehub.look')") is None and a.js("!!document.querySelector('.ht-main')") and len(a.art) > 0, (a.js("htOn()"), a.art[:2]))
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(200)
    check("a customer's five taps on the app's name change nothing", a.js("htOn()") and a.js("localStorage.getItem('homehub.look')") is None)
    a.js("closeSettings(); 0"); a.page.wait_for_timeout(100)
    a.js("shellGo('more')"); a.page.wait_for_timeout(150); tap(a, tile("Classic Look", ".ht-more"))
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("a customer's More -> Classic Look: the old Home Hub, and it sticks after a reload", not a.js("htOn()") and a.js("localStorage.getItem('homehub.look')") == "classic")
    a.ctx.close()
    a = home(b, base, look="classic")
    check("Classic Look picked: the old dashboard, no tab bar", not a.js("htOn()") and not a.js("document.body.classList.contains('ht')") and not a.js("!!document.getElementById('tabbar')") and "Rooms & spaces" in cards(a))
    check("...none of the new art fetched", not a.art, a.art[:3])
    h0 = a.js("history.length")
    a.page.click(f'[data-hspace="{kid(a)}"]'); a.page.wait_for_timeout(200)
    check("...a room opens as the old sheet", shown(a, "#homeSheet"))
    a.page.click('#homeSheet [data-hclose]'); a.page.wait_for_timeout(150)
    check("...and no history added (the back button is the browser's own)", a.js("history.length") == h0 and a.js("HT_DEPTH") == 0, (h0, a.js("history.length")))
    a.ctx.close()
    a = home(b, base, setup=False)
    check("first run: the classic Set up your home, even with the look picked", not a.js("htOn()") and a.js("!!document.querySelector('form[data-homesetup]')"))
    a.page.fill('form[data-homesetup] [name=name]', "Sam"); a.page.fill('form[data-homesetup] [name=city]', "83702"); a.page.click('form[data-homesetup] button')
    a.page.wait_for_function("WXDATA && WXDATA.here"); a.page.wait_for_timeout(300)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    check("...then the new look once the home is built", a.js("htOn()") and a.js("!!document.querySelector('.ht-main')"))
    a.ctx.close()
    a = home(b, base, look=None)
    a.page.goto(base + T.HOMEP + "?look=tiles"); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("?look=tiles turns it on, the address left clean", a.js("htOn()") and "look=" not in a.js("location.href"))
    a.page.goto(base + T.HOMEP + "?look=classic"); a.page.wait_for_function("typeof render === 'function'")
    check("?look=classic turns it back", not a.js("htOn()"))
    a.ctx.close()
    a = home(b, base, look=None, owner=True)
    check("the owner's phone (Scott Hub on it) gets it by itself", a.js("htOn()") and a.js("localStorage.getItem('homehub.ownerlook')") == "1")
    a.js("shellGo('more')"); a.page.wait_for_timeout(150); tap(a, tile("Classic Look", ".ht-more"))
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("More -> Classic Look sticks after a reload", not a.js("htOn()"))
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')               # the morning brief comes back on a reload; it isn't what's tested here
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(250)
    check("on the owner's phone five taps flip it back on, landing on Home", a.js("htOn()") and a.js("TAB") == "home")
    a.ctx.close()


def test_home(b, base):
    print("\n-- Home: his board")
    a = home(b, base)
    check("five tabs: Home, Rooms, Upkeep, Money, More", tabs(a) == ["Home", "Rooms", "Upkeep", "Money", "More"], tabs(a))
    t = a.js("[...document.querySelectorAll('.ht-main .ht-tile b')].map(x => x.textContent)")
    check("his 12 tiles in his order", t == ["Rooms", "Outdoors", "Systems", "Upkeep", "Coming Up", "Home Value", "Bills Due", "To-Do", "Lists", "Weather", "Ask Home Hub", "Add a Space"], t)
    hc = a.page.inner_text(".ht-house")
    check("Your House: the home, its spaces, the next thing due (the late smoke alarm first)", "Your House" in hc and "My House" in hc and "12 spaces" in hc and "Test smoke alarm" in hc and "late" in hc, hc)
    check("the art fetched on this phone", any("home.webp" in u for u in a.art), a.art[:3])
    a.js("window.scrollTo(0, hubPanY())"); a.page.wait_for_timeout(100)        # 11/08: the opening glide lands here
    bottom = a.js("Math.max(...[...document.querySelectorAll('.ht-main .ht-tile')].map(e => e.getBoundingClientRect().bottom))")
    bar = a.js("document.getElementById('tabbar').getBoundingClientRect().top")
    check("all twelve tiles on one screen of a 390x844 phone, once it has glided down", bottom <= bar + 1, (bottom, bar))
    a.js("window.scrollTo(0, 0)"); a.page.wait_for_timeout(100)
    top = a.js("document.querySelector('.ht-house').getBoundingClientRect().top")
    bg = a.js("getComputedStyle(document.body, '::before').backgroundImage")
    pos = a.js("getComputedStyle(document.body, '::before').backgroundPosition.split(',').pop().trim()")   # the picture's layer is the last
    check("the whole house shows on opening (Scott 11/08 \"home hub open with house covered up\"): the picture from the top, Your House below it",
          top >= 470 and "home.webp" in bg and pos.split()[-1] in ("0%", "0px"), (top, pos))
    below = a.page.inner_text(".ht-below")
    check("Coming up one scroll down, from the rooms and the Upkeep list", a.js("document.querySelectorAll('.ht-below .ht-row').length") == 4 and "Test smoke alarm" in below and "Trash day" in below, below[:200])
    a.js("WXDATA.here.days[1].lo = 27; render()"); a.page.wait_for_timeout(150)
    check("a freeze tonight shows on the card, as the weather says it", "Freeze tonight" in a.page.inner_text(".ht-house") and "Drip faucets" in a.page.inner_text(".ht-house"), a.page.inner_text(".ht-house"))
    tap(a, ".ht-alert")
    check("...and opens Weather", title(a) == "Weather")
    a.ctx.close()


def test_tiles(b, base):
    print("\n-- Where each tile goes")
    a = home(b, base)
    for label, area in (("Rooms", "indoor"), ("Outdoors", "outdoor"), ("Systems", "systems")):
        back_home(a); tap(a, tile(label)); a.page.wait_for_timeout(200)
        check(f"{label} -> the Rooms tab, at {area}", a.js("TAB") == "rooms" and a.js(f"!!document.getElementById('ht-{area}')"))
    back_home(a); tap(a, tile("Upkeep"))
    check("Upkeep -> the Upkeep tab: the Upkeep list with Trash day, then every room's open tasks", a.js("TAB") == "upkeep" and "Trash day" in cards(a) and "Change HVAC filter" in cards(a) and "Clean dishwasher filter" in cards(a))
    for label, t_ in (("Coming Up", "Coming Up"), ("Home Value", "Home Value"), ("Bills Due", "Bills Due"), ("To-Do", "To-Do"), ("Lists", "Lists"), ("Weather", "Weather")):
        back_home(a); tap(a, tile(label))
        check(f"{label} -> its full screen, no tab bar", title(a) == t_ and not shown(a, "#tabbar"), title(a))
    back_home(a); tap(a, tile("Coming Up"))
    w = cards(a)
    check("Coming Up: date order, late first, rooms and Upkeep together", w.index("Test smoke alarm") < w.index("Change HVAC filter") < w.index("Clean dishwasher filter") and "Trash day" in w, w[:300])
    for label, qa in (("Bills Due", "bill"), ("To-Do", "todo"), ("Lists", "item")):
        back_home(a); tap(a, tile(label)); tap(a, ".ht-title .ht-plus")
        check(f"{label}'s + opens its own add form ({qa})", shown(a, "#qa") and a.js("QA_TYPE") == qa, a.js("QA_TYPE"))
        a.js("closeQA()")
    a.js("WXDATA.here.days[1].lo = 27; WXDATA.here.days[0].code = 95; render()"); back_home(a)
    check("a storm today and a freeze tonight: the house shows the freeze", "Freeze tonight" in a.page.inner_text(".ht-house"), a.page.inner_text(".ht-house"))
    back_home(a); tap(a, tile("Add a Space"))
    check("Add a Space -> the add sheet", shown(a, "#homeSheet") and "Add a room" in a.page.inner_text("#homeSheet"))
    back_home(a); tap(a, tile("Ask Home Hub"))
    check("Ask Home Hub -> Ask", shown(a, "#askSheet") or a.js("[...document.querySelectorAll('.sheet:not(.hidden)')].some(s => /ask/i.test(s.id))"), a.js("[...document.querySelectorAll('.sheet:not(.hidden)')].map(s => s.id)"))
    a.ctx.close()


def test_room(b, base):
    print("\n-- A room as a full screen (home.js's own pane, forms and buttons)")
    a = home(b, base)
    a.js("shellGo('rooms')"); a.page.wait_for_timeout(150)
    check("Rooms: three groups of picture tiles, the old counts", all(x in cards(a) for x in ("Indoors", "Outdoors", "Whole-home systems", "Rooms & spaces")) and a.js("document.querySelectorAll('.ht-space .ht-spimg').length") == 12)
    tap(a, f'.ht-space[data-hspace="{kid(a)}"]')
    check("Kitchen opens as a full screen: its picture, Overview / Items / Tasks / Notes, no sheet", title(a) == "Kitchen" and a.js("!!document.querySelector('.ht-band')") and not shown(a, "#homeSheet")
          and all(x in cards(a) for x in ("Overview", "Items", "Tasks", "Notes")), title(a))
    tap(a, '[data-htab="items"]')
    a.page.fill('form[data-hitem] [name=name]', "Range"); a.page.fill('form[data-hitem] [name=model]', "Model 30-G")
    a.page.click(".ht-where"); a.js("render()"); a.page.wait_for_timeout(200)   # half typed, then a redraw from outside (the app coming back, the weather landing)
    check("half-typed text in a room's form survives a redraw", a.js("document.querySelector('form[data-hitem] [name=name]').value") == "Range"
          and a.js("document.querySelector('form[data-hitem] [name=model]').value") == "Model 30-G")
    a.page.click('form[data-hitem] button'); a.page.wait_for_timeout(200)
    check("Items: add one with home.js's own form (stays on the room screen)", "Range" in a.js("S.house.spaces.find(s => s.key === 'kitchen').items.map(i => i.name).join()") and title(a) == "Kitchen")
    check("...and the saved form comes back empty", a.js("document.querySelector('form[data-hitem] [name=name]').value") == "")
    tap(a, '[data-htab="tasks"]')
    a.page.fill('form[data-htask] [name=title]', "Clean the oven"); a.page.click('form[data-htask] button'); a.page.wait_for_timeout(200)
    check("Tasks: add one", "Clean the oven" in cards(a) and title(a) == "Kitchen")
    before = a.js("S.house.spaces.find(s => s.key === 'kitchen').tasks.find(t => t.id === 't2').due")
    tap(a, '[data-hdone="t2"]')
    after = a.js("S.house.spaces.find(s => s.key === 'kitchen').tasks.find(t => t.id === 't2').due")
    check("Done on a monthly task: next one a month on, still on the room screen", before == "2026-09-28" and after == "2026-11-01" and title(a) == "Kitchen", (before, after))
    tap(a, '[data-htab="notes"]'); a.page.fill('textarea[data-hnotes]', "Paint: warm white")
    check("Notes save as you type", a.js("S.house.spaces.find(s => s.key === 'kitchen').notes") == "Paint: warm white")
    tap(a, '[data-htab="overview"]'); a.page.fill('form[data-hrename] [name=name]', "Main Kitchen"); a.page.click('form[data-hrename] button'); a.page.wait_for_timeout(200)
    check("Rename: the title follows", title(a) == "Main Kitchen")
    tap(a, "[data-hrmspace]")
    check("Remove asks first (first tap keeps it)", a.js("S.house.spaces.some(s => s.key === 'kitchen')") and title(a) == "Main Kitchen")
    tap(a, ".ht-back")
    check("the back arrow goes back to Rooms", a.js("TAB") == "rooms" and not a.js("document.body.dataset.htscreen") and shown(a, "#tabbar"))
    tap(a, '.ht-space.add[data-haddspace="indoor"]'); tap(a, '#homeSheet [data-hpick="bath"]')
    check("Add a space from the list: the sheet gives way to the new room's screen", title(a) == "Bathroom 2" and not shown(a, "#homeSheet"), title(a))
    a.ctx.close()


def test_tabs_and_back(b, base):
    print("\n-- Money, More, the phone's back button")
    a = home(b, base)
    a.js("shellGo('money')"); a.page.wait_for_timeout(200)
    check("Money: Bills Due and Home Value (the cards Home Hub already has)", a.js("!!document.querySelector('#cards [data-card=\"bills\"]')") and a.js("!!document.getElementById('hpvCard')"))
    a.js("shellGo('more')"); a.page.wait_for_timeout(200)
    m = cards(a)
    miss = [x for x in ("Rooms", "Outdoors", "Systems", "Add a Space", "Coming Up", "Upkeep", "Bills Due", "Home Value", "To-Do", "Lists", "Weather", "Ask Home Hub", "Reminders", "Settings", "Classic Look") if x not in m]
    check("More: everything has a place, and the Hub family card", not miss and a.js("!!document.querySelector('#cards [data-card=\"family\"]')"), miss)
    a.js("shellGo('home')"); a.page.wait_for_timeout(150); tap(a, tile("Coming Up"))
    check("opening a full screen adds one step of history", a.js("HT_DEPTH") == 1)
    a.page.evaluate("history.back()"); a.page.wait_for_timeout(400)
    check("the phone's back button: Coming Up -> Home", a.js("TAB") == "home" and not a.js("document.body.dataset.htscreen"))
    tap(a, tile("Coming Up")); tap(a, '#cards .ht-row[data-hspace]')
    check("a task on Coming Up opens its room at Tasks", title(a) in ("Kitchen", "HVAC & Climate") and a.js("HOME_TAB") == "tasks", title(a))
    a.page.evaluate("history.back()"); a.page.wait_for_timeout(400)
    check("back from the room returns to Coming Up", title(a) == "Coming Up", title(a))
    a.page.evaluate("history.back()"); a.page.wait_for_timeout(400)
    check("...and back again goes Home", a.js("TAB") == "home" and not a.js("document.body.dataset.htscreen"))
    tap(a, tile("Add a Space")); a.page.evaluate("history.back()"); a.page.wait_for_timeout(400)
    check("an open sheet closes first", not shown(a, "#homeSheet") and a.js("TAB") == "home")
    tap(a, '#tabbar [data-shellgo="rooms"]'); a.page.evaluate("history.back()"); a.page.wait_for_timeout(400)
    check("from the Rooms tab, back goes Home", a.js("TAB") == "home")
    a.ctx.close()


def test_safety(b, base):
    print("\n-- Play app, crafted text, Real photo off, other Hubs, phone sizes")
    a = home(b, base, path=T.HOMEP + "?src=play")
    seen = []
    for go in ("home", "rooms", "upkeep", "money", "more"):
        a.js(f"HT_SCREEN = null; shellGo('{go}')"); a.page.wait_for_timeout(120); seen.append(cards(a))
    for sc in ("coming", "value", "bills", "todos", "lists", "weather"):
        a.js(f"HT_SCREEN = '{sc}'; render()"); a.page.wait_for_timeout(120); seen.append(cards(a))
    txt = " ".join(seen)
    check("Play app: the look on, no Pro, Pass, trial or Whop words on any screen", a.js("STORE_MODE") and a.js("htOn()") and not re.search(r"\bPro\b|\bPass\b|whop|trial", txt, re.I), re.findall(r".{20}(?:\bPro\b|\bPass\b|whop|trial).{20}", txt, re.I)[:3])
    a.ctx.close()
    a = home(b, base)
    X = '<img src=x onerror=window.__pwn=1>'
    a.js(f"""(() => {{ const x = {X!r}; S.house.spaces.forEach(s => {{ s.name = x; s.floor = x; s.icon = x; s.notes = x; s.items.forEach(i => {{ i.name = x; i.model = x; }}); s.tasks.forEach(t => {{ t.title = x; }}); }});
      S.upkeep.forEach(u => {{ u.name = x; }}); save(); render(); }})()""")
    hit = []
    for go in ("home", "rooms", "upkeep", "money", "more"):
        a.js(f"HT_SCREEN = null; shellGo('{go}')"); a.page.wait_for_timeout(80)
        if a.js("window.__pwn === 1 || !!document.querySelector('#cards img[src=\"x\"]')"): hit.append(go)
    for sc in ("coming", "value", "bills", "todos", "lists", "weather"):
        a.js(f"HT_SCREEN = '{sc}'; render()"); a.page.wait_for_timeout(80)
        if a.js("window.__pwn === 1 || !!document.querySelector('#cards img[src=\"x\"]')"): hit.append(sc)
    a.js(f"HOME_OPEN = S.house.spaces[0].id; HT_SCREEN = 'space'; render()"); a.page.wait_for_timeout(80)
    for t_ in ("overview", "items", "tasks", "notes"):
        a.js(f"HOME_TAB = '{t_}'; render()"); a.page.wait_for_timeout(60)
        if a.js("window.__pwn === 1 || !!document.querySelector('#cards img[src=\"x\"]')"): hit.append("room:" + t_)
    check("crafted text in every room, item, task, note and Upkeep job runs nowhere", not hit, hit)
    a.ctx.close()
    a = home(b, base)
    a.js("S.photo = false; save(); HT_ART_ASKED = false; render()"); a.page.wait_for_timeout(150)
    a.js("shellGo('rooms')"); a.page.wait_for_timeout(150)
    check("Real photo off: no pictures (rooms show their icons)", a.js("document.body.classList.contains('ht-noart')") and a.js("document.querySelectorAll('.ht-space .ht-spimg').length") == 0 and a.js("document.querySelectorAll('.ht-space .ht-spic').length") >= 12)
    a.js("shellGo('home')"); a.page.wait_for_timeout(150)
    check("Real photo off: Home has no house picture either", "home.webp" not in a.js("getComputedStyle(document.body, '::before').backgroundImage"))
    a.ctx.close()
    for path, nm in (("/", "Day Hub"), (T.TRIP, "Trip Hub"), (T.AUTOP, "Auto Hub")):
        x = T.App(b, base, path=path); x.js("localStorage.setItem('homehub.look', 'tiles')"); x.page.reload(); x.page.wait_for_function("typeof render === 'function'")
        check(f"{nm} never gets it", x.js("typeof htOn") == "undefined" and not x.js("document.body.classList.contains('ht')"))
        x.ctx.close()
    for w, h in ((360, 740), (320, 640), (360, 780), (384, 854), (412, 915), (820, 1180)):
        a = home(b, base, width=w, height=h)
        wide = []
        for go in ("home", "rooms", "upkeep", "money", "more"):
            a.js(f"HT_SCREEN = null; shellGo('{go}')"); a.page.wait_for_timeout(80)
            if a.js("document.documentElement.scrollWidth > window.innerWidth + 1"): wide.append(go)
        for sc in ("coming", "value", "bills", "todos", "lists", "weather"):
            a.js(f"HT_SCREEN = '{sc}'; render()"); a.page.wait_for_timeout(80)
            if a.js("document.documentElement.scrollWidth > window.innerWidth + 1"): wide.append(sc)
        check(f"{w}x{h}: nothing runs off the side on any screen", not wide, wide)
        if w < 700 and h >= 740:                                   # a 320x640 phone scrolls for the last row, as it always has
            a.js("HT_SCREEN = null; shellGo('home'); window.scrollTo(0, 0)"); a.page.wait_for_timeout(120); a.js("window.scrollTo(0, hubPanY())"); a.page.wait_for_timeout(80)
            bot = a.js("Math.max(...[...document.querySelectorAll('.ht-main .ht-tile')].map(e => e.getBoundingClientRect().bottom))")
            check(f"{w}x{h}: all twelve tiles on one screen, once it has glided down", bot <= a.js("document.getElementById('tabbar').getBoundingClientRect().top") + 1, bot)
        if w == 820:
            a.js("HT_SCREEN = null; shellGo('more')"); a.page.wait_for_timeout(120)
            lefts = a.js("[...document.querySelectorAll('.ht-more')].map(e => Math.round(e.getBoundingClientRect().left))")
            check("tablet: More's groups go across the screen, not split into columns", len(set(lefts)) == 1, lefts)
            a.js("shellGo('upkeep')"); a.page.wait_for_timeout(120)
            bw = a.js("Math.round(document.querySelector('.ht-band').getBoundingClientRect().width)")
            check("tablet: the Upkeep picture goes across the screen", bw >= 780, bw)
        a.ctx.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        for t in (test_switch, test_home, test_tiles, test_room, test_tabs_and_back, test_safety):
            t(b, base)
        errs = [e for e in T.ERRORS[before:] if "favicon" not in e]
        check("no page errors anywhere", not errs, errs[:3])
        b.close()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
