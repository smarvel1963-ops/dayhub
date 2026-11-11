"""
SAVE AS: test_money_tiles.py   LOCATION: C:/MarvelApps/dayhub/tests/test_money_tiles.py

MONEY HUB NEW LOOK, "Emerald Vault" (moneytiles.js / moneytiles.css / ../moneyhub/art, Scott 11/06: his three boards; 11/07 "cont" = build it).
Drives the real Money Hub with the main suite's own helpers (run_tests.py: fake network, frozen clock, App) and a made-up household. Checks: the
switch is OFF and a customer keeps the old look, fetches none of the art and gets no history steps; the welcome stays classic; ?look=tiles /
?look=classic; the owner's phone turns it on by itself once and Classic Look sticks; five taps only on the owner's phone; Home (the shield,
his Cash card with the household's numbers, Up to date?, his 12 tiles in his order, all on the first screen, the gold + clear of them, the
art); every tile opens its page as a full screen (title, picture, no tab bar, back arrow); the tab bar (Home | Accounts | Bills | Plan | More
and the +); Plan and More; the eye; Money Hub's own forms and buttons still work inside a dressed page; the phone's back button; the Orbit view;
the Update bar clear of the gold +; Play wording; crafted text runs nowhere; Day, Home and Auto Hub never get it; narrow phones and a tablet.

RUN:   python tests/test_money_tiles.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

# A made-up household: no real people, banks, stores or brands. Today = Thu Nov 12 2026.
DEMO = r"""(() => { S.name = 'Sam'; const M = mh(); M.setup = '2026-10-01';
  M.accounts = [{id:'a1',kind:'checking',name:'Everyday Checking',bal:2140,at:'2026-11-10'}, {id:'a2',kind:'savings',name:'Rainy-Day Savings',bal:1500,at:'2026-10-30'},
    {id:'a3',kind:'credit',name:'Credit Card',bal:860,apr:22.9,min:35,at:'2026-10-20'}];
  S.payday = Object.assign({}, S.payday, {freq:'biweekly', next:'2026-11-20', amount:1450});
  S.bills = [{id:'b1',name:'Rent',amount:1150,day:1,paid:'2026-11',auto:false,cat:'housing',url:''}, {id:'b3',name:'Phone',amount:65,day:15,paid:'2026-10',auto:true,cat:'utilities',url:''},
    {id:'b4',name:'Internet',amount:60,day:18,paid:'2026-10',auto:false,cat:'utilities',url:''}, {id:'b6',name:'Water',amount:45,day:26,paid:'2026-10',auto:false,cat:'utilities',url:''}];
  M.tx = [['2026-11-12',-24.80,'Corner Market','groceries'],['2026-11-11',-32.00,'Pizza Night','dining'],['2026-11-06',1450,'Paycheck','pay'],['2026-11-01',-1150,'Rent','housing']]
    .map(([date,amt,what,cat],i) => ({id:'t'+i,date,amt,what,cat,acct:''}));
  M.subs = [{id:'s1',name:'Music App',amt:11,every:'month',next:'2026-11-14'}]; M.budgets = {groceries: 300};
  S.goals = [{id:'g1',name:'Emergency Fund',target:5000,saved:1500,icon:'🛡️',by:''}]; save(); render(); })()"""
TILES = ["Accounts", "Transactions", "Bills", "Budget", "Subscriptions", "Debt", "Payday", "Goals", "Forecast", "Can I Afford It?", "Vault", "Reports"]
TILE_TABS = ["accounts", "spend", "bills", "budget", "subs", "debt", "payday", "goals", "forecast", "advisor", "vault", "reports"]


def money(b, base, look="tiles", owner=False, width=390, height=844, path=None, setup=True, demo=True):
    a = T.App(b, base, path=path or T.MONEYP, at="2026-11-12T14:00:00", width=width, height=height, look=None if look is None else "classic")
    a.art = []
    a.page.on("request", lambda r: a.art.append(r.url) if "/moneyhub/art/" in r.url else None)
    if look: a.js(f"localStorage.setItem('moneyhub.look', '{look}')")
    if owner: a.js("localStorage.setItem('scotthub.k', 'TEST-PASS')")
    if look or owner: a.page.reload(); a.page.wait_for_function("typeof render === 'function'")
    if setup:
        if a.js("!!document.querySelector('form[data-mhsetup]')"):
            a.page.fill("form[data-mhsetup] [name=name]", "Sam"); a.page.click("form[data-mhsetup] button"); a.page.wait_for_timeout(300)
        if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
        if demo: a.js(DEMO)
        a.js("render(); window.scrollTo(0, 0)"); a.page.wait_for_timeout(250)
    return a
def shown(a, sel): return a.js(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }})()")
def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(250)
def page_title(a): return a.js("(document.querySelector('#mhSheet:not(.hidden) .mt-head h2') || {}).textContent || ''").strip()
def nav_labels(a): return a.js("[...document.querySelectorAll('#mvNav > button:not(.mt-plus)')].map(b => b.textContent.trim())")
def tile_sel(label, where=".mt-grid"): return f'{where} .mt-tile:has(b:text-is("{label}"))'


def test_switch(b, base):
    print("\n-- The switch: ON for every customer (Scott 11/10: \"Yes, all of them\"); More -> Classic Look keeps the old one")
    a = money(b, base, look=None)
    check("the switch in the code is ON", a.js("MT_ON === true"))
    check("a customer, nothing picked: the new look, and its art comes down", a.js("mtOn()") and a.js("localStorage.getItem('moneyhub.look')") is None and a.js("!!document.querySelector('.mt-cash')") and len(a.art) > 0, (a.js("mtOn()"), a.art[:2]))
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(200)
    check("a customer's five taps on the app's name change nothing", a.js("mtOn()") and a.js("localStorage.getItem('moneyhub.look')") is None)
    a.js("closeSettings(); 0"); a.page.wait_for_timeout(100)
    tap(a, "#mvNav [data-mtgo=more]"); tap(a, '.mt-mrow:has(b:text-is("Classic Look"))')
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("a customer's More -> Classic Look: the old Money Hub, and it sticks after a reload", not a.js("mtOn()") and a.js("localStorage.getItem('moneyhub.look')") == "classic")
    a.ctx.close()
    a = money(b, base, look="classic")
    check("Classic Look picked: the old Money Hub (its own clock band, its old bar)", not a.js("mtOn()") and not a.js("document.body.classList.contains('mt')") and shown(a, "#hero")
          and "Payments" in a.page.inner_text("#mvNav"))
    check("...none of the new art fetched", not a.art, a.art[:3])
    check("...and no trace of the look on the page (no class, no data-mttab)", a.js("!('mttab' in document.body.dataset)"))
    h0 = a.js("history.length")
    a.js("showMh('bills')"); a.page.wait_for_timeout(200)
    check("...a page opens as the old sheet (no back arrow, its own bar)", shown(a, "#mhSheet") and not a.js("!!document.querySelector('#mhSheet .mt-head')") and not a.js("document.getElementById('mhSheet').classList.contains('mt-full')"))
    tap(a, "#mhSheet [data-mhclose]")
    check("...and no history added (the back button is the browser's own)", a.js("history.length") == h0 and a.js("MT_DEPTH") == 0, (h0, a.js("history.length")))
    a.ctx.close()
    a = money(b, base, setup=False)
    check("the welcome stays the classic screen, even with the look picked", not a.js("mtOn()") and a.js("!!document.querySelector('form[data-mhsetup]')"))
    a.page.fill("form[data-mhsetup] [name=name]", "Sam"); a.page.click("form[data-mhsetup] button"); a.page.wait_for_timeout(300)
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    check("...then the new look once Money Hub is set up", a.js("mtOn()") and a.js("!!document.querySelector('.mt-cash')"))
    a.ctx.close()
    a = money(b, base, look=None)
    a.page.goto(base + T.MONEYP + "?look=tiles"); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("?look=tiles turns it on, the address left clean", a.js("mtOn()") and "look=" not in a.js("location.href"))
    a.page.goto(base + T.MONEYP + "?look=classic"); a.page.wait_for_function("typeof render === 'function'")
    check("?look=classic turns it back", not a.js("mtOn()"))
    a.ctx.close()
    a = money(b, base, look=None, owner=True)
    check("the owner's phone (Scott Hub on it) gets it by itself", a.js("mtOn()") and a.js("localStorage.getItem('moneyhub.ownerlook')") == "1")
    tap(a, "#mvNav [data-mtgo=more]"); tap(a, '.mt-mrow:has(b:text-is("Classic Look"))')
    a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(300)
    check("More -> Classic Look sticks after a reload", not a.js("mtOn()"))
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    a.js("openSettings(); 0"); a.page.wait_for_timeout(150)
    for _ in range(5): a.page.locator("#sheet p.fine > b", has_text="Marvel Corp app").first.click()
    a.page.wait_for_timeout(250)
    check("on the owner's phone five taps flip it back on, landing on Home", a.js("mtOn()") and a.js("MT_TAB") == "home")
    a.ctx.close()


def test_home(b, base):
    print("\n-- Home: his board")
    a = money(b, base)
    check("the Day Hub clock band is hidden, the shield and the name are up top", not shown(a, "#hero") and a.js("!!document.querySelector('.mt-top .mt-logo svg')") and "Money Hub" in a.page.inner_text(".mt-top"))
    c = a.page.inner_text(".mt-cash")
    check("his Cash card: cash available $3,640, owed $860, next payday Nov 20", "$3,640" in c and "Cash available" in c and "$860" in c and "Net this month" in c and "Next payday Nov 20" in c, c)
    check("Up to date?: the two old accounts", "2 need updating" in a.page.inner_text(".mt-fresh"), a.page.inner_text(".mt-fresh"))
    t = a.js("[...document.querySelectorAll('.mt-hero ~ .mt-grid .mt-tile b')].map(x => x.textContent)")
    check("his 12 tiles in his order", t == TILES, t)
    check("the vault picture fetched on this phone", any("home.webp" in u for u in a.art), a.art[:3])
    a.js("window.scrollTo(0, hubPanY())"); a.page.wait_for_timeout(100)        # 11/08: the opening glide lands here
    bottom = a.js("Math.max(...[...document.querySelectorAll('.mt-grid .mt-tile')].map(e => e.getBoundingClientRect().bottom))")
    nav = a.js("document.getElementById('mvNav').getBoundingClientRect().top"); plus = a.js("document.querySelector('.mt-plus').getBoundingClientRect().top")
    check("all twelve tiles on one screen of a 390x844 phone, once it has glided down, clear of the gold +", bottom <= plus + 1 and bottom <= nav, (bottom, plus, nav))
    below = a.page.inner_text(".mt-below").lower()
    check("one scroll down: what needs you, due soon, the quick log", all(x in below for x in ("needs you", "due soon", "phone", "quick log")), below[:160])
    tap(a, ".mt-round[data-mveye]")
    check("the eye hides the amounts on the card", "$•••••" in a.page.inner_text(".mt-cash") and "$3,640" not in a.page.inner_text(".mt-cash"))
    below = a.page.inner_text(".mt-below")
    check("...and in Needs you and Due soon (no dollar figure left one scroll down)", not re.search(r"\$\d", below), below[:200])
    tap(a, ".mt-round[data-mveye]")
    a.js("CLOUD_PENDING = { data: {} }; render()"); a.page.wait_for_timeout(150)
    check("the top band's notices come along: Backup is waiting shows under the Cash card", a.js("(e => !!e && e.offsetWidth > 0)(document.querySelector('.mt-notices [data-cloudask]'))"))
    a.js("CLOUD_PENDING = null; render()"); a.page.wait_for_timeout(100)
    a.page.fill(".mt-quick [name=amt]", "12.50"); a.page.fill(".mt-quick [name=what]", "Corner Market"); a.page.click(".mt-quick .mt-qbtn"); a.page.wait_for_timeout(250)
    check("the quick log adds a row (Money Hub's own form)", a.js("mh().tx.some(x => x.what === 'Corner Market' && x.amt === -12.5)"))
    a.ctx.close()


def test_pages(b, base):
    print("\n-- Every tile opens its page as a full screen")
    a = money(b, base)
    for label, tab in zip(TILES, TILE_TABS):
        a.js("hideMh(); MT_TAB = 'home'; render(); window.scrollTo(0, 0)"); a.page.wait_for_timeout(100)
        tap(a, tile_sel(label))
        full = a.js("document.getElementById('mhSheet').classList.contains('mt-full')") and a.js("MH_TAB") == tab
        band = a.js("(document.querySelector('#mhSheet .mt-band') || {}).className || ''")
        check(f"{label} -> {tab}: a full screen, its title, its picture, no tab bar", full and page_title(a) and not shown(a, "#mhSheet nav.auto-tabs") and ("mt-band-" in band or tab == "add"), (a.js("MH_TAB"), page_title(a), band))
    a.js("hideMh(); render()")
    tap(a, tile_sel("Bills")); tap(a, "#mhSheet .mt-back")
    check("the back arrow closes the page, back on Home", not shown(a, "#mhSheet") and a.js("MT_TAB") == "home")
    tap(a, tile_sel("Bills"))
    pb = a.page.locator("#mhSheet [data-mhpaid]").first
    if pb.count():
        pb.click(); a.page.wait_for_timeout(250)
        check("Bills: Mark paid still works inside the full screen, and the page stays dressed", a.js("S.bills.filter(x => x.paid === '2026-11').length") >= 2 and a.js("!!document.querySelector('#mhSheet .mt-head')"))
    else: check("Bills: a Mark paid button on the page", False)
    a.js("showMh('spend')"); a.page.wait_for_timeout(200)
    a.page.locator("#mhSheet [data-mvtf=in]").first.click(); a.page.wait_for_timeout(250)
    check("Transactions: a filter redraws the page and it stays a full screen", a.js("MV_TF") == "in" and page_title(a) == "Transactions" and a.js("!!document.querySelector('#mhSheet .mt-band')"))
    a.js("hideMh(); render()"); a.ctx.close()


def test_tabs_and_back(b, base):
    print("\n-- The tab bar, Plan, More, the phone's back button")
    a = money(b, base)
    check("Home | Accounts | Bills | Plan | More, and the gold +", nav_labels(a) == ["Home", "Accounts", "Bills", "Plan", "More"] and shown(a, ".mt-plus"), nav_labels(a))
    tap(a, "#mvNav [data-mtgo=plan]")
    t = a.js("[...document.querySelectorAll('.mt-grid .mt-tile b')].map(x => x.textContent)")
    check("Plan: the planning pages", t == ["Can I Afford It?", "Cash Forecast", "Cash Flow", "Payday", "Budget", "Goals", "Debt", "Subscriptions", "Insights"] and a.js("MT_TAB") == "plan", t)
    check("...and the to-do and list cards stay on Home", not a.js("[...document.querySelectorAll('#cards > .card[data-card]')].some(e => e.offsetWidth)"))
    tap(a, "#mvNav [data-mtgo=more]")
    m = a.page.inner_text("#cards")
    check("More: every page by what it's for, Settings and Classic Look", all(x in m for x in ("Accounts", "Transactions", "Smart Insights", "Update my accounts", "Bring in a bank file", "Document Vault", "Settings", "Classic Look", "never moves money")), m[:200])
    tap(a, "#mvNav [data-mhtab=accounts]")
    check("the Accounts tab opens Accounts", page_title(a) == "Accounts")
    a.js("hideMh(); render()")
    tap(a, "#mvNav .mt-plus")
    check("the gold + opens Add", page_title(a) == "Add" and a.js("MH_TAB") == "add")
    a.js("hideMh(); MT_TAB = 'home'; render()"); a.page.wait_for_timeout(100)
    tap(a, tile_sel("Budget")); a.page.wait_for_timeout(150)
    a.page.go_back(); a.page.wait_for_timeout(350)
    check("the phone's back button closes a page, and no step is left over", not shown(a, "#mhSheet") and a.js("MT_DEPTH") == 0, a.js("MT_DEPTH"))
    tap(a, tile_sel("Can I Afford It?")); a.page.wait_for_timeout(150)
    a.page.locator("#mhSheet [data-mvask]").first.click(); a.page.wait_for_timeout(300)
    two = shown(a, "#askSheet") and shown(a, "#mhSheet")
    a.page.go_back(); a.page.wait_for_timeout(350)
    check("Ask over a page: one back press closes only the Ask panel", two and not shown(a, "#askSheet") and shown(a, "#mhSheet") and page_title(a) == "Can I Afford It?", (two, shown(a, "#askSheet"), shown(a, "#mhSheet")))
    a.page.go_back(); a.page.wait_for_timeout(350)
    check("...and the next one closes the page", not shown(a, "#mhSheet") and a.js("MT_DEPTH") == 0)
    tap(a, "#mvNav [data-mtgo=plan]"); a.page.wait_for_timeout(150)
    a.page.go_back(); a.page.wait_for_timeout(350)
    check("...and from Plan it goes Home", a.js("MT_TAB") == "home")
    tap(a, "#mvNav [data-mtgo=more]"); tap(a, '.mt-mrow:has(b:text-is("Orbit view"))')
    check("More -> Orbit view: the older home, in its own look", not a.js("document.body.classList.contains('mt')") and a.js("MV_VIEW") == "orbit")
    a.page.locator("button[data-mvview=room]").first.click(); a.page.wait_for_timeout(250)
    check("...and its Control room button comes back to the new look's Home (not More)", a.js("document.body.classList.contains('mt')") and a.js("MT_TAB") == "home" and a.js("!!document.querySelector('.mt-cash')"))
    a.ctx.close()


def test_safety(b, base):
    print("\n-- Update bar, Play app, crafted text, other Hubs, phone sizes")
    a = money(b, base)
    a.ctx._version = {"version": "9.9", "notes": {"9.9": ["Test"]}}
    a.js("checkUpdate()"); a.page.wait_for_timeout(300)
    bar = a.js("(e => e && e.offsetWidth ? e.getBoundingClientRect().bottom : null)(document.getElementById('updBar'))")
    plus = a.js("document.querySelector('.mt-plus').getBoundingClientRect().top")
    check("an update waiting: the green bar sits above the gold +", bar is not None and bar <= plus + 1, (bar, plus))
    a.js("showMh('bills')"); a.page.wait_for_timeout(250)
    top = a.js("(e => { const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!x && !!x.closest('#updBar'); })(document.getElementById('updBar'))")
    check("...and on a full-screen page it is still there to tap, at the bottom", top)
    a.js("hideMh(); render()")
    a.ctx.close()
    a = money(b, base, path=T.MONEYP + "?src=play")
    words = a.page.inner_text("#cards")
    for go in ("plan", "more"): tap(a, f"#mvNav [data-mtgo={go}]"); words += a.page.inner_text("#cards")
    bad = re.findall(T.PLAY_BAD[1:-2], words, re.I)
    check("Play app: no Pro, price or trial words on Home, Plan or More", not bad, bad[:3])
    a.ctx.close()
    a = money(b, base)
    a.js("""mh().accounts[0].name = '<img src=x onerror="window.__pwn=1">'; S.bills[1].name = '<img src=x onerror="window.__pwn=1">'; save(); render()""")
    hit = []
    for go in ("home", "plan", "more"):
        a.js(f"MT_TAB = '{go}'; render()"); a.page.wait_for_timeout(80)
        if a.js("window.__pwn === 1 || !!document.querySelector('#cards img[src=\"x\"]')"): hit.append(go)
    for t in ("accounts", "bills", "update"):
        a.js(f"showMh('{t}')"); a.page.wait_for_timeout(80)
        if a.js("window.__pwn === 1 || !!document.querySelector('#mhSheet img[src=\"x\"]')"): hit.append(t)
    check("crafted text in an account and a bill runs nowhere", not hit, hit)
    a.ctx.close()
    for path, nm in (("/", "Day Hub"), (T.HOMEP, "Home Hub"), (T.AUTOP, "Auto Hub")):
        x = T.App(b, base, path=path); x.js("localStorage.setItem('moneyhub.look', 'tiles')"); x.page.reload(); x.page.wait_for_function("typeof render === 'function'")
        check(f"{nm} never gets it", x.js("typeof mtOn") == "undefined" and not x.js("document.body.classList.contains('mt')"))
        x.ctx.close()
    for w, h in ((360, 740), (320, 640), (412, 915), (820, 1180)):
        a = money(b, base, width=w, height=h)
        wide = []
        for go in ("home", "plan", "more"):
            a.js(f"hideMh(); MT_TAB = '{go}'; render()"); a.page.wait_for_timeout(80)
            if a.js("document.documentElement.scrollWidth > window.innerWidth + 1"): wide.append(go)
        for t in TILE_TABS + ["add", "update", "flow", "insights", "connect"]:
            a.js(f"showMh('{t}')"); a.page.wait_for_timeout(60)
            if a.js("(e => e.scrollWidth > e.clientWidth + 1)(document.querySelector('#mhSheet .sheet-body'))"): wide.append(t)
        check(f"{w}x{h}: nothing runs off the side on any screen", not wide, wide)
        if w == 820:
            a.js("hideMh(); MT_TAB = 'home'; render(); window.scrollTo(0, 0)"); a.page.wait_for_timeout(120)
            lefts = a.js("[...document.querySelectorAll('#cards > .mt-hero, #cards > .mt-grid, #cards > .mt-below')].map(e => Math.round(e.getBoundingClientRect().left))")
            check("tablet: one column (not split into newspaper columns), Home's pieces stacked", a.js("getComputedStyle(document.getElementById('cards')).columnCount") in ("1", "auto") and len(set(lefts)) == 1, lefts)
            a.js("S.seenVersion = '1.0'; NOTES = { [VERSION]: ['A test note'] }; render()"); a.page.wait_for_timeout(120)
            wn = a.js("(e => e && e.offsetWidth ? e.getBoundingClientRect().top : null)(document.querySelector('#cards > .whatsnew'))")
            gb = a.js("Math.max(...[...document.querySelectorAll('.mt-grid .mt-tile')].map(e => e.getBoundingClientRect().bottom))")
            check("What's New sits after the tiles on Home (the tiles stay on the first screen)", wn is not None and wn >= gb, (wn, gb))
            a.js("MT_TAB = 'more'; render()"); a.page.wait_for_timeout(100)
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
