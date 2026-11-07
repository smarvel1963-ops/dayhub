"""
SAVE AS: test_health_tiles.py   LOCATION: C:/MarvelApps/dayhub/tests/test_health_tiles.py

HEALTH HUB NEW LOOK, "Green and Gold Wellness" (healthtiles.js / healthtiles.css / ../healthhub/art, Scott 11/06: his board; 11/07 "cont ... all
updates and everything right at end of day"). Drives the real Health Hub with the main suite's own helpers and a made-up person. Checks: the switch
is OFF and a customer keeps the old look, fetches none of the art, gets no history steps and no trace; the welcome stays classic; ?look=tiles /
?look=classic; the owner's phone turns it on by itself once and Classic Look sticks; five taps only on the owner's phone; Home (the logo, Today's
Health with the person's numbers, the top band's notices, his 12 tiles in his order and where each goes, all on the first screen); every page as a
full screen (title, picture, no tab bar, back arrow); Taken still works inside a dressed page; the tab bar (Home | Visits | Vitals | Goals | More);
More; the big health-info screen; the phone's back button (newest first); the Update bar on a page; health words; crafted text; other Hubs never
get it; narrow phones and a tablet.

RUN:   python tests/test_health_tiles.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

# A made-up person: no real people, doctors, pharmacies or brands. Today = Thu Nov 12 2026, 2 PM.
DEMO = r"""(() => { S.name = 'Sam'; const H = hh(); H.setup = '2026-10-01';
  H.meds = [{id:'m1', name:'Daily Vitamin', strength:'1 tablet', color:'#4ade80', times:['08:00','20:00'], per:1, left:30, instr:'With food', pharmacy:'', by:'', notes:''},
    {id:'m2', name:'Allergy Relief', strength:'10 mg', color:'#facc15', times:['08:00'], per:1, left:5, instr:'', pharmacy:'', by:'', notes:''}];
  H.doses = {'2026-11-12': {'m1|08:00': {s:'taken', at:'08:05'}, 'm2|08:00': {s:'taken', at:'08:05'}}};
  H.vitals = [{id:'v1', kind:'bp', date:'2026-11-12', time:'08:30', sys:118, dia:76}, {id:'v2', kind:'weight', date:'2026-11-10', time:'07:00', v:172}];
  H.appts = [{id:'ap1', date:'2026-11-14', time:'10:00', doctor:'Dr. Lane', specialty:'Checkup', reason:'Yearly checkup', where:'', bring:'ID', q:['Ask about sleep']}];
  H.water = {'2026-11-12': 5}; H.steps = {'2026-11-12': 6420}; H.sleep = [{id:'s1', date:'2026-11-12', bed:'23:02', wake:'06:20', hrs:7.3, q:4, note:''}];
  save(); render(); })()"""
TILES = ["My Health", "Visits", "Medications", "Refills", "Vitals", "Water", "Activity", "Sleep", "Weight", "Daily Goals", "Emergency", "Wellness"]
TILE_TABS = ["score", "appts", "meds", "meds", "vitals", "water", "move", "sleep", "vitals", "goals", "card", "checkin"]
HEALTH_BAD = r"\b(diagnos\w*|treat(s|ment|ing)?|cure[sd]?|prevent\w*|improve your health|monitors?)\b"


def health(b, base, look="tiles", owner=False, width=390, height=844, path=None, setup=True, demo=True):
    a = T.App(b, base, path=path or T.HEALTHP, at="2026-11-12T14:00:00", width=width, height=height)
    a.art = []
    a.page.on("request", lambda r: a.art.append(r.url) if "/healthhub/art/" in r.url else None)
    if look: a.js(f"localStorage.setItem('healthhub.look', '{look}')")
    if owner: a.js("localStorage.setItem('scotthub.k', 'TEST-PASS')")
    if look or owner: a.page.reload(); a.page.wait_for_function("typeof render === 'function'")
    if setup:
        if a.js("!!document.querySelector('form[data-hhsetup]')"):
            a.page.fill("form[data-hhsetup] [name=name]", "Sam"); a.page.click("form[data-hhsetup] button"); a.page.wait_for_timeout(300)
        if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
        if demo: a.js(DEMO)
        a.js("render(); window.scrollTo(0, 0)"); a.page.wait_for_timeout(250)
    return a
def shown(a, sel): return a.js(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }})()")
def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(250)
def page_title(a): return a.js("(document.querySelector('#hhSheet:not(.hidden) .hw-head h2') || {}).textContent || ''").strip()
def nav_labels(a): return a.js("[...document.querySelectorAll('#hhNav > button')].map(b => b.textContent.trim())")
def tile_sel(label, where=".hw-grid"): return f'{where} .hw-tile:has(b:text-is("{label}"))'


def test_switch(b, base):
    print("\n-- The switch: OFF, a customer keeps the old look, downloads none of the art, gets no history steps")
    a = health(b, base, look=None)
    check("the switch in the code is OFF", a.js("HW_ON === false"))
    check("a customer: the old Health Hub (its clock band, its old bar)", not a.js("hwOn()") and not a.js("document.body.classList.contains('hw')") and shown(a, "#hero")
          and a.js("[...document.querySelectorAll('#hhNav button')].map(b => b.getAttribute('aria-label')).join()") == "Home,Meds,Add,Vitals,More")
    check("...none of the new art fetched, and no trace of the look", not a.art and a.js("!('hwtab' in document.body.dataset)"), a.art[:3])
    h0 = a.js("history.length")
    a.js("showHh('meds')"); a.page.wait_for_timeout(200)
    check("...a page opens as the old sheet", shown(a, "#hhSheet") and not a.js("!!document.querySelector('#hhSheet .hw-head')"))
    tap(a, "#hhSheet [data-hhclose]")
    check("...and no history added", a.js("history.length") == h0 and a.js("HW_DEPTH") == 0, (h0, a.js("history.length")))
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(200)
    check("a customer's five taps on the app's name do nothing", not a.js("hwOn()") and a.js("localStorage.getItem('healthhub.look')") is None)
    a.js("closeSettings(); 0"); a.ctx.close()
    a = health(b, base, setup=False)
    check("the welcome stays the classic screen, even with the look picked", not a.js("hwOn()") and a.js("!!document.querySelector('form[data-hhsetup]')"))
    a.page.fill("form[data-hhsetup] [name=name]", "Sam"); a.page.click("form[data-hhsetup] button"); a.page.wait_for_timeout(300)
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    check("...then the new look once Health Hub is set up", a.js("hwOn()") and a.js("!!document.querySelector('.hw-today')"))
    a.ctx.close()
    a = health(b, base, look=None)
    a.page.goto(base + T.HEALTHP + "?look=tiles"); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("?look=tiles turns it on, the address left clean", a.js("hwOn()") and "look=" not in a.js("location.href"))
    a.page.goto(base + T.HEALTHP + "?look=classic"); a.page.wait_for_function("typeof render === 'function'")
    check("?look=classic turns it back", not a.js("hwOn()"))
    a.ctx.close()
    a = health(b, base, look=None, owner=True)
    check("the owner's phone (Scott Hub on it) gets it by itself", a.js("hwOn()") and a.js("localStorage.getItem('healthhub.ownerlook')") == "1")
    tap(a, "#hhNav [data-hwgo=more]"); tap(a, '.hw-mrow:has(b:text-is("Classic Look"))')
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("More -> Classic Look sticks after a reload", not a.js("hwOn()"))
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(250)
    check("on the owner's phone five taps flip it back on, landing on Home", a.js("hwOn()") and a.js("HW_TAB") == "home")
    a.ctx.close()


def test_home(b, base):
    print("\n-- Home: his board")
    a = health(b, base)
    check("the clock band is hidden, the leaf logo and the name are up top", not shown(a, "#hero") and a.js("!!document.querySelector('.hw-top .hw-logo svg')") and "Health Hub" in a.page.inner_text(".hw-top"))
    c = a.page.inner_text(".hw-today")
    check("Today's Health: the score from routines, 6,420 steps, 2/3 doses, 7h 18m sleep, 5 of 8 glasses",
          "Today's routines" in c and "/100" in c and "6,420" in c and "2/3" in c and "7h 18m" in c and "5 of 8" in c, c)
    check("...the score is Health Hub's own (hhScore)", str(a.js("hhScore(today()).score")) in c)
    t = a.js("[...document.querySelectorAll('.hw-hero ~ .hw-grid .hw-tile b')].map(x => x.textContent)")
    check("his 12 tiles in his order (Water for Nutrition, Emergency for Challenges)", t == TILES, t)
    check("the mountain picture fetched on this phone", any("home.webp" in u for u in a.art), a.art[:3])
    bottom = a.js("Math.max(...[...document.querySelectorAll('.hw-grid .hw-tile')].map(e => e.getBoundingClientRect().bottom))")
    nav = a.js("document.getElementById('hhNav').getBoundingClientRect().top")
    check("all twelve tiles on the first screen of a 390x844 phone", bottom <= nav + 1, (bottom, nav))
    below = a.page.inner_text(".hw-below").lower()
    check("one scroll down: needs you, quick log, the next visit, Show my health info", all(x in below for x in ("needs you", "quick log", "dr. lane", "show my health info")), below[:200])
    a.js("CLOUD_PENDING = { data: {} }; render()"); a.page.wait_for_timeout(150)
    check("the top band's notices come along: Backup is waiting shows under Today's Health", a.js("(e => !!e && e.offsetWidth > 0)(document.querySelector('.hw-notices [data-cloudask]'))"))
    a.js("CLOUD_PENDING = null; render()"); a.page.wait_for_timeout(100)
    tap(a, ".hw-acts [data-hhwater]")
    check("+1 glass still works from Home (Health Hub's own button)", a.js("hhWater(today())") == 6)
    a.ctx.close()


def test_pages(b, base):
    print("\n-- Every tile opens its page as a full screen")
    a = health(b, base)
    for label, tab in zip(TILES, TILE_TABS):
        a.js("hideHh(); HW_TAB = 'home'; render(); window.scrollTo(0, 0)"); a.page.wait_for_timeout(100)
        tap(a, tile_sel(label))
        full = a.js("document.getElementById('hhSheet').classList.contains('hw-full')") and a.js("HH_TAB") == tab
        band = a.js("(document.querySelector('#hhSheet .hw-band') || {}).className || ''")
        check(f"{label} -> {tab}: a full screen, its title, no tab bar{', its picture' if tab != 'card' else ''}", full and page_title(a) and not shown(a, "#hhSheet nav.auto-tabs") and ("hw-band-" in band or tab == "card"), (a.js("HH_TAB"), page_title(a), band))
        if label == "Weight": check("...Weight opens Vitals on weight", a.js("HH_VK") == "weight")
    a.js("hideHh(); render()")
    tap(a, tile_sel("Medications")); tap(a, "#hhSheet .hw-back")
    check("the back arrow closes the page, back on Home", not shown(a, "#hhSheet") and a.js("HW_TAB") == "home")
    tap(a, tile_sel("Medications"))
    a.page.locator('#hhSheet [data-hhdose$="|20:00|taken"]').first.click(); a.page.wait_for_timeout(250)
    check("Medications: Taken still works inside the full screen, and the page stays dressed", a.js("hhDoses(today()).filter(d => d.st === 'taken').length") == 3 and a.js("!!document.querySelector('#hhSheet .hw-head')"))
    a.js("hideHh(); render()")
    a.js("""(() => { const H = hh(); for (let i = 3; i <= 8; i++) H.meds.push({id: 'm' + i, name: 'Extra ' + i, strength: '', color: '#60a5fa', times: ['20:00'], per: 1, left: 30, instr: '', pharmacy: '', by: '', notes: ''}); save(); })()""")
    a.js("showHh('meds')"); a.page.wait_for_timeout(200)
    a.js("document.querySelector('#hhSheet .sheet-body').scrollTop = 700"); a.page.wait_for_timeout(150)
    btn = a.page.locator('#hhSheet [data-hhdose="m5|20:00|taken"]')
    y0 = btn.bounding_box()["y"]; btn.click(); a.page.wait_for_timeout(250)
    y1 = a.page.locator('#hhSheet [data-hhdose="m5|20:00|taken"]').bounding_box()["y"]
    check("a scrolled page stays put when a dose is tapped (no jump that puts the next tap on another medicine)", abs(y1 - y0) < 20, (y0, y1))
    a.js("hideHh(); render()")
    a.js("hh().doses['2026-11-12'] = {}; save(); render()")
    a.js("showHh('meds')"); a.page.wait_for_timeout(200)
    miss = a.js("(e => e ? getComputedStyle(e).borderTopColor : '')(document.querySelector('#hhSheet .hh-dose.missed'))")
    norm = a.js("(e => e ? getComputedStyle(e).borderTopColor : '')(document.querySelector('#hhSheet .hh-dose:not(.missed)'))")
    check("a missed dose keeps its warning colour on the full screen", bool(miss) and miss != norm, (miss, norm))
    a.js("hideHh(); render()"); a.ctx.close()


def test_tabs_and_back(b, base):
    print("\n-- The tab bar, More, the big health-info screen, the phone's back button")
    a = health(b, base)
    check("Home | Visits | Vitals | Goals | More", nav_labels(a) == ["Home", "Visits", "Vitals", "Goals", "More"], nav_labels(a))
    tap(a, "#hhNav [data-hhtab=appts]"); check("the Visits tab opens Visits", page_title(a) == "Visits"); a.js("hideHh(); render()")
    tap(a, "#hhNav [data-hhtab=goals]"); check("the Goals tab opens Daily Goals", page_title(a) == "Daily Goals"); a.js("hideHh(); render()")
    tap(a, "#hhNav [data-hwgo=more]")
    m = a.page.inner_text("#cards")
    check("More: every page by what it's for, Settings and Classic Look", all(x in m for x in ("Medications", "Vitals", "Visit summary", "Records vault", "Emergency card", "Show my health info", "Step challenges", "Settings", "Classic Look")), m[:200])
    check("...and the to-do and list cards stay on Home", not a.js("[...document.querySelectorAll('#cards > .card[data-card]')].some(e => e.offsetWidth)"))
    a.page.go_back(); a.page.wait_for_timeout(350)
    check("the phone's back button: More goes Home", a.js("HW_TAB") == "home")
    tap(a, tile_sel("Vitals")); a.page.wait_for_timeout(150)
    a.page.go_back(); a.page.wait_for_timeout(350)
    check("...a page closes, no step left over", not shown(a, "#hhSheet") and a.js("HW_DEPTH") == 0, a.js("HW_DEPTH"))
    a.js("window.scrollTo(0, 2000)"); a.page.wait_for_timeout(100); tap(a, ".hw-sos")
    check("Show my health info opens the big screen", a.js("!!document.getElementById('hhSos')"))
    a.page.go_back(); a.page.wait_for_timeout(350)
    check("...and the back button closes it", not a.js("!!document.getElementById('hhSos')") and a.js("HW_DEPTH") == 0)
    a.ctx.close()


def test_safety(b, base):
    print("\n-- Update bar, health words, crafted text, other Hubs, phone sizes")
    a = health(b, base)
    a.ctx._version = {"version": "9.9", "notes": {"9.9": ["Test"]}}
    a.js("checkUpdate()"); a.page.wait_for_timeout(300)
    bar = a.js("(e => e && e.offsetWidth ? e.getBoundingClientRect().bottom : null)(document.getElementById('updBar'))")
    nav = a.js("document.getElementById('hhNav').getBoundingClientRect().top")
    check("an update waiting: the green bar sits above the bottom bar", bar is not None and bar <= nav + 1, (bar, nav))
    a.js("showHh('meds')"); a.page.wait_for_timeout(250)
    top = a.js("(e => { const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!x && !!x.closest('#updBar'); })(document.getElementById('updBar'))")
    check("...and on a full-screen page it is still there to tap", top)
    a.ctx.close()
    a = health(b, base)
    words = a.page.inner_text("#cards")
    tap(a, "#hhNav [data-hwgo=more]"); words += a.page.inner_text("#cards")
    bad = re.findall(HEALTH_BAD, words, re.I)
    check("health words: nothing on Home or More says diagnose, treat, cure, prevent, improve your health or monitors", not bad, bad[:3])
    check("...and the line that it isn't medical advice is there", "not medical advice" in words)
    a.ctx.close()
    a = health(b, base)
    a.js("""hh().appts[0].doctor = '<img src=x onerror="window.__pwn=1">'; hh().meds[1].name = '<img src=x onerror="window.__pwn=1">'; save(); render()""")
    hit = []
    for go in ("home", "more"):
        a.js(f"HW_TAB = '{go}'; render()"); a.page.wait_for_timeout(80)
        if a.js("window.__pwn === 1 || !!document.querySelector('#cards img[src=\"x\"]')"): hit.append(go)
    for t in ("meds", "appts"):
        a.js(f"showHh('{t}')"); a.page.wait_for_timeout(80)
        if a.js("window.__pwn === 1 || !!document.querySelector('#hhSheet img[src=\"x\"]')"): hit.append(t)
    check("crafted text in a visit and a medicine runs nowhere", not hit, hit)
    a.ctx.close()
    for path, nm in (("/", "Day Hub"), (T.MONEYP, "Money Hub"), (T.AUTOP, "Auto Hub")):
        x = T.App(b, base, path=path); x.js("localStorage.setItem('healthhub.look', 'tiles')"); x.page.reload(); x.page.wait_for_function("typeof render === 'function'")
        check(f"{nm} never gets it", x.js("typeof hwOn") == "undefined" and not x.js("document.body.classList.contains('hw')"))
        x.ctx.close()
    for w, h in ((360, 740), (320, 640), (412, 915), (820, 1180)):
        a = health(b, base, width=w, height=h)
        wide = []
        for go in ("home", "more"):
            a.js(f"hideHh(); HW_TAB = '{go}'; render()"); a.page.wait_for_timeout(80)
            if a.js("document.documentElement.scrollWidth > window.innerWidth + 1"): wide.append(go)
        for t in sorted(set(TILE_TABS)) + ["add", "vault", "visit", "challenge"]:
            a.js(f"showHh('{t}')"); a.page.wait_for_timeout(60)
            if a.js("(e => e.scrollWidth > e.clientWidth + 1)(document.querySelector('#hhSheet .sheet-body'))"): wide.append(t)
        check(f"{w}x{h}: nothing runs off the side on any screen", not wide, wide)
        if w == 820:
            a.js("hideHh(); HW_TAB = 'home'; render(); window.scrollTo(0, 0)"); a.page.wait_for_timeout(120)
            lefts = a.js("[...document.querySelectorAll('#cards > .hw-hero, #cards > .hw-grid, #cards > .hw-below')].map(e => Math.round(e.getBoundingClientRect().left))")
            check("tablet: one column (not split into newspaper columns), Home's pieces stacked", a.js("getComputedStyle(document.getElementById('cards')).columnCount") in ("1", "auto") and len(set(lefts)) == 1, lefts)
            a.js("S.seenVersion = '1.0'; NOTES = { [VERSION]: ['A test note'] }; render()"); a.page.wait_for_timeout(120)
            wn = a.js("(e => e && e.offsetWidth ? e.getBoundingClientRect().top : null)(document.querySelector('#cards > .whatsnew'))")
            gb = a.js("Math.max(...[...document.querySelectorAll('.hw-grid .hw-tile')].map(e => e.getBoundingClientRect().bottom))")
            check("What's New sits after the tiles on Home (the tiles stay on the first screen)", wn is not None and wn >= gb, (wn, gb))
            a.js("HW_TAB = 'more'; render()"); a.page.wait_for_timeout(100)
            check("...and stays off More", not a.js("(e => !!e && e.offsetWidth > 0)(document.querySelector('#cards > .whatsnew'))"))
        a.ctx.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        for t in (test_switch, test_home, test_pages, test_tabs_and_back, test_safety):
            t(b, base)
        errs = [e for e in T.ERRORS[before:] if "favicon" not in e and "Failed to fetch" not in e]
        check("no page errors anywhere", not errs, errs[:3])
        b.close()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
