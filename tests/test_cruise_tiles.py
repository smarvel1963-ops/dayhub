"""
SAVE AS: test_cruise_tiles.py   LOCATION: C:/MarvelApps/dayhub/tests/test_cruise_tiles.py

CRUISE HUB NEW LOOK - Phase 1 (cruisetiles.js / cruisetiles.css, Scott 11/01). Drives the real Cruise Hub with the main
suite's own helpers (run_tests.py: fake network, frozen clock, App). Checks the switch is OFF by default, the ?look=tiles
preview, the 12 tiles + where each one goes, the five renamed tabs, the lifesaver on every tab, the stage card (countdown,
port day Return Guard, final night, after the trip), Simple mode, the Classic tile, and that Trip Hub / Day Hub never get it.

RUN:   python tests/test_cruise_tiles.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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


def cruise(b, base, at="2026-11-01T10:24:00", look="tiles", ports=True):
    a = T.App(b, base, path=T.CRUISE, at=at)
    a.js("localStorage.setItem('cruisehub.startTab', 'home')")
    if look: a.js(f"localStorage.setItem('cruisehub.look', '{look}')")
    a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
    a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("trip", {"ttype": "cruise", "tname": "Caribbean Adventure", "start": "2027-03-14", "end": "2027-03-21", "line": "Princess",
                  "ship": "Caribbean Princess", "port": "Port Canaveral", "travelers": "2", "total": "4280", "finalDue": "2027-01-20"})
    a.qa("tpay", {"amt": "3000", "date": "2026-10-01", "note": "Deposit"})
    if ports:
        for nm, d, ar, aa in (("Nassau", "2027-03-16", "08:00", "16:30"), ("Cozumel", "2027-03-18", "07:00", "15:30")):
            a.qa("tport", {"pname": nm, "pday": d, "arrive": ar, "allAboard": aa})
    a.js("closeQA()"); a.js("shellGo('home')"); a.page.wait_for_timeout(400)
    return a


def tabs(a):
    return a.js("[...document.querySelectorAll('#tabbar button')].map(b => b.textContent.trim())")


def visible(a, sel):     # sheets are position:fixed (offsetParent is always null), so ask the computed style
    return a.js(f"(() => {{ const e = document.querySelector('{sel}'); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; }})()")


def tap(a, sel):
    a.page.click(sel); a.page.wait_for_timeout(250)


def close_sheets(a):
    a.js("document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'))")


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. switch OFF by default - Cruise Hub looks exactly as before]")
        a = cruise(b, base, look=None)
        check("no new look without the preview", not a.js("document.body.classList.contains('ct')") and not a.js("!!document.querySelector('.ct-grid')"))
        check("old tab names kept", tabs(a) == ["🏠Home", "📅Plan", "🌎Explore", "👛Wallet", "✨AI"], tabs(a))
        check("old home kept (bubbles + hero)", a.js("!!document.querySelector('#cards .bubbles') && getComputedStyle(document.getElementById('hero')).display !== 'none'"))
        a.close()

        print("\n[2. ?look=tiles preview: the new home]")
        a = cruise(b, base)
        check("new look on", a.js("document.body.classList.contains('ct') && ctOn()"))
        check("hero hidden, new hero on top", a.js("getComputedStyle(document.getElementById('hero')).display === 'none' && !!document.querySelector('#cards .ct-hero')"))
        check("tabs: Home | My Cruise | Port Days | Money | More", tabs(a) == ["Home", "My Cruise", "Port Days", "Money", "More"], tabs(a))
        names = a.js("[...document.querySelectorAll('.ct-grid .ct-tile b')].map(x => x.textContent)")
        check("the 12 tiles, in Scott's order", names == ["My Cruise", "Lists & Prep", "Payments & Budget", "Travel & Stay", "Sail Day", "On Board",
              "Port Days", "Activities & Fun", "Coming Home", "Crisis Mode", "AI Helper", "More"], names)
        card = a.page.inner_text(".ct-stage")
        check("stage card: countdown + readiness + next up", "133" in card and "Days to Sail" in card and "%" in card and "Next up" in card, card)
        needs = a.page.inner_text(".ct-needs") if a.js("!!document.querySelector('.ct-needs')") else ""
        nxt = a.js("readiness(curTrip()).next.action.replace(/\\s*\\([^)]*\\)/g, '')")
        check("Needs you never repeats the card's Next up", nxt not in needs, needs)
        sub = a.js("[...document.querySelectorAll('.ct-tile small')].map(x => x.textContent)")
        check("tile lines: nights + ports, packed, money left", any("nights" in s and "2 ports" in s for s in sub) and any(s.startswith("packed") for s in sub)
              and "$1,280.00 left" in sub, sub)

        print("\n[3. each tile goes where it should]")
        go = lambda name: tap(a, f".ct-grid .ct-tile:has(b:text-is('{name}'))")
        go("My Cruise"); check("My Cruise -> My Cruise tab, the trip", a.js("TAB") == "plan" and a.js("PLAN_VIEW") == "trip")
        a.js("shellGo('home')"); go("Lists & Prep"); check("Lists & Prep -> packing", a.js("TAB") == "plan" and a.js("PLAN_VIEW") == "packing")
        a.js("shellGo('home')"); go("Payments & Budget"); check("Payments -> Money tab", a.js("TAB") == "wallet")
        a.js("shellGo('home')"); go("Travel & Stay"); check("Travel & Stay -> bookings", a.js("TAB") == "plan" and a.js("PLAN_VIEW") == "reservations")
        a.js("shellGo('home')"); go("Sail Day"); check("Sail Day -> Get me to my ship help", visible(a, "#helpSheet")); close_sheets(a)
        a.js("shellGo('home')"); go("On Board"); a.page.wait_for_timeout(200)
        check("On Board -> Port Days tab with My ship", a.js("TAB") == "explore" and a.js("!!document.querySelector('#cards .my-ship')"))
        a.js("shellGo('home')"); go("Port Days"); check("Port Days -> Port Days tab", a.js("TAB") == "explore")
        a.js("shellGo('home')"); go("Activities & Fun"); check("Activities & Fun -> the first port day's screen", visible(a, "#daySheet") and "Nassau" in a.page.inner_text("#daySheet")); close_sheets(a)
        a.js("shellGo('home')"); go("Coming Home"); check("Coming Home -> Get me home sheet", visible(a, "#ghSheet")); close_sheets(a)
        a.js("shellGo('home')"); go("Crisis Mode"); check("Crisis Mode -> help", visible(a, "#helpSheet")); close_sheets(a)
        a.js("shellGo('home')"); go("AI Helper"); check("AI Helper -> Ask", visible(a, "#askSheet")); close_sheets(a)
        a.js("shellGo('home')"); go("More"); check("More -> More tab", a.js("TAB") == "ai" and a.js("!!document.querySelector('.ct-more')"))
        a.js("shellGo('home')"); tap(a, ".ct-stage"); check("the card -> the readiness checklist", visible(a, "#readySheet")); close_sheets(a)

        print("\n[4. the lifesaver is on every tab]")
        for t in ("home", "plan", "explore", "wallet", "ai"):
            a.js(f"shellGo('{t}')"); a.page.wait_for_timeout(150)
            ok = a.js("!!document.querySelector('#cards .ct-life')")
            if ok: tap(a, "#cards .ct-life")
            check(f"lifesaver on {t} opens Crisis Mode", ok and visible(a, "#helpSheet")); close_sheets(a)
        a.js("shellGo('home')"); tap(a, ".ct-gear"); check("the gear opens Settings", visible(a, "#sheet")); a.js("closeSettings()")

        print("\n[5. More tab + Classic look]")
        a.js("shellGo('ai')"); a.page.wait_for_timeout(150)
        more = a.js("[...document.querySelectorAll('.ct-more .ct-tile b')].map(x => x.textContent)")
        check("More holds AI, diary, map, bookings, ship guide, final night, bill check, settings", all(x in more for x in
              ["AI Helper", "Trip Diary", "Map", "Bookings", "Ship Guide", "Final Night", "Final Bill Check", "Settings", "Classic Look"]), more)
        tap(a, ".ct-more .ct-tile:has(b:text-is('Classic Look'))")
        check("Classic Look turns it off on this phone", not a.js("document.body.classList.contains('ct')") and a.js("localStorage.getItem('cruisehub.look')") == "classic"
              and tabs(a)[1] == "📅Plan", tabs(a))
        a.close()

        print("\n[5b. every feature has a place: More, Money, Pass]")
        a = cruise(b, base)
        a.js("shellGo('ai')"); a.page.wait_for_timeout(150)
        heads = a.js("[...document.querySelectorAll('.ct-more-h')].map(x => x.textContent)")
        check("More is grouped by when you need it", heads == ["Before you go", "On board", "Coming home", "This app"], heads)
        more = a.js("[...document.querySelectorAll('.ct-more .ct-tile b')].map(x => x.textContent)")
        want = ["Packing", "Documents", "Bookings", "Road Trip", "Home Port", "My Day", "Ship Guide", "First 10 Minutes", "Free Time", "Activities & Fun", "Group Vote", "Trip Diary", "Map",
                "Final Night", "Final Bill Check", "After the Trip", "AI Helper", "Reminders", "Cruise Hub Pass", "Settings", "Simple Mode", "Classic Look"]
        check("his list is all there", all(x in more for x in want), [x for x in want if x not in more])
        check("no booking with a time yet: no Fix My Trip", "Fix My Trip" not in more)
        tap(a, ".ct-more .ct-tile:has(b:text-is('First 10 Minutes'))")
        check("First 10 Minutes opens the same ticks", a.js("CT_SCREEN") == "first10" and a.js("document.querySelectorAll('#cards [data-first]').length") == a.js("FIRST_THINGS.length"))
        a.page.click("#cards [data-first='muster']"); a.page.wait_for_timeout(150)
        check("...a tick saves, and stays on the screen", a.js("curTrip().firstThings.muster") is True and a.js("CT_SCREEN") == "first10" and "1/" in a.page.inner_text("#cards .card .meta"))
        tap(a, ".ct-back")
        check("...‹ comes back to More", a.js("CT_SCREEN") is None and a.js("TAB") == "ai" and a.js("!!document.querySelector('.ct-more')"))
        tap(a, ".ct-more .ct-tile:has(b:text-is('First 10 Minutes'))"); tap(a, "#tabbar button[data-shellgo='home']")
        check("...a tab leaves it", a.js("CT_SCREEN") is None and a.js("TAB") == "home"); a.js("shellGo('ai')"); a.page.wait_for_timeout(150)
        check("...and More opens as More next time", a.js("!!document.querySelector('.ct-more')"))
        tap(a, ".ct-more .ct-tile:has(b:text-is('Road Trip'))"); a.page.wait_for_timeout(120)
        check("Road Trip opens sail day with the drive planner unfolded", visible(a, "#daySheet") and a.js("(d => !d || d.open)(document.querySelector('#daySheet details.drive-box'))") and a.page.is_visible("#daySheet form.drive-add")); close_sheets(a)
        tap(a, ".ct-more .ct-tile:has(b:text-is('Home Port'))"); a.page.wait_for_timeout(120)
        check("Home Port opens the port's tips", visible(a, "#daySheet") and "GOOD TO KNOW AT" in a.page.inner_text("#daySheet").upper()); close_sheets(a)
        tap(a, ".ct-more .ct-tile:has(b:text-is('Free Time'))"); a.page.wait_for_timeout(120)
        check("Free Time opens the day's free time", visible(a, "#daySheet") and "FREE TIME" in a.page.inner_text("#daySheet").upper()); close_sheets(a)
        tap(a, ".ct-more .ct-tile:has(b:text-is('Reminders'))"); a.page.wait_for_timeout(120)
        check("Reminders opens that box in Settings", visible(a, "#sheet") and a.js("!!document.getElementById('remindBox')")); a.js("closeSettings()")
        check("no ideas yet: Group Vote says what it needs", a.js("!document.querySelector('.ct-more [data-voteopen]')") and "add 2 ideas first" in a.page.inner_text(".ct-more .ct-tile:has(b:text-is('Group Vote'))"))
        a.js("curTrip().wish = [{ id: 'w1', title: 'Snorkel', mins: 60 }, { id: 'w2', title: 'Beach', mins: 90 }]; save(); render()"); a.page.wait_for_timeout(100)
        check("two ideas: Group Vote opens the vote", a.js("!!document.querySelector('.ct-more [data-voteopen]')"))
        tap(a, ".ct-more [data-voteopen]"); a.page.wait_for_timeout(120)
        check("...the vote screen", a.js("!!document.querySelector('.sheet:not(.hidden) [data-voteclose], #voteSheet:not(.hidden)')")); close_sheets(a)
        a.js("shellGo('plan'); PLAN_VIEW = 'packing'; render(); shellGo('ai')"); a.page.wait_for_timeout(120)
        tap(a, ".ct-more .ct-tile:has(b:text-is('Documents'))"); a.page.wait_for_timeout(150)
        check("Documents opens Documents, even after Packing", a.js("TAB") == "plan" and a.js("S.tripList") == "docs" and a.js("PLAN_VIEW") == "trip" and "Add to Documents" in a.js("document.querySelector('[data-card=\"trips\"] form[data-tadd] input').placeholder"))
        a.js("shellGo('plan'); PLAN_VIEW = 'today'; render(); shellGo('ai')"); a.page.wait_for_timeout(120)
        tap(a, ".ct-more .ct-tile:has(b:text-is('After the Trip'))"); a.page.wait_for_timeout(150)
        check("After the Trip opens its list, even after My Day", a.js("S.tripList") == "after" and a.js("!!document.querySelector('[data-card=\"trips\"]')"))
        a.js("shellGo('ai')"); a.page.wait_for_timeout(100)
        a.js("curTrip().bookings = [{ id: 'bk1', kind: 'flight', a: 'MCO', b: 'MIA', day: '2027-03-14', t: '08:00' }]; save(); render()"); a.page.wait_for_timeout(100)
        check("a booking with a time: Fix My Trip shows", "Fix My Trip" in a.js("[...document.querySelectorAll('.ct-more .ct-tile b')].map(x => x.textContent)"))
        a.js("shellGo('wallet')"); a.page.wait_for_timeout(150)
        tools = a.js("[...document.querySelectorAll('.ct-tools .ct-tile b')].map(x => x.textContent)")
        check("Money tools: package, upgrade, split, bill, pulse, export", tools == ["Package worth it?", "Upgrade worth it?", "Split the cost", "Final bill check", "Spending pulse", "Export the money"], tools)
        tap(a, ".ct-tools .ct-tile:has(b:text-is('Spending pulse'))"); a.page.wait_for_timeout(150)
        check("Spending pulse opens the spending tab, in view", a.js("S.tripTab") == "onboard" and a.js("TAB") == "wallet" and a.js("window.scrollY") > 0, a.js("window.scrollY"))
        a.js("shellGo('home')"); a.page.wait_for_timeout(150)
        check("One Cruise Secret is on the new Home when the old one had it", a.js("!!document.querySelector('#cards .secret-card')") == bool(a.js("secretHtml(curTrip())")))
        a.js("shellGo('ai')"); a.page.wait_for_timeout(100)
        tap(a, ".ct-more .ct-tile:has(b:text-is('Cruise Hub Pass'))")
        hero = a.page.inner_text(".ct-prohero")
        check("Pass screen: where you stand", a.js("CT_SCREEN") == "pass" and "Free" in hero, hero)
        t = a.page.inner_text("#cards")
        check("...what's syncing and what it includes", all(w in t for w in ["Google Calendar", "Drive backup", "Backup to your own Google Drive", "free forever"]), t[:200])
        check("...the price and the buy link are the Pass's own, on a real button", "$9.99/year" in t and a.js("document.querySelector('a.ct-probuy').href").endswith("cruise-hub-pass") and a.js("getComputedStyle(document.querySelector('a.ct-probuy')).backgroundImage").startswith("linear-gradient"))
        tap(a, ".ct-promanage"); a.page.wait_for_timeout(120)
        check("...enter your email opens the Pro box", visible(a, "#sheet") and a.js("!!document.getElementById('proBox')")); a.js("closeSettings()")
        a.js("localStorage.setItem('dayhub.pro', JSON.stringify({ buyer: 'b@example.com', ok: true, checked: Date.now(), status: 'active', product: 'dayhub' })); localStorage.setItem('cruisehub.pro', JSON.stringify({ buyer: 'b@example.com', ok: true, checked: Date.now(), status: 'active', product: 'cruise' })); render()"); a.page.wait_for_timeout(120)
        check("someone already paying isn't asked to pay", not a.js("!!document.querySelector('a.ct-probuy')"), a.page.inner_text(".ct-prohero"))
        a.js("localStorage.removeItem('cruisehub.pro'); localStorage.setItem('dayhub.pro', JSON.stringify({ buyer: 'b@example.com', ok: true, checked: Date.now(), status: 'canceling', until: Date.now() + 3 * 86400000, product: 'dayhub' })); CT_SCREEN = 'pass'; render()"); a.page.wait_for_timeout(120)
        check("Day Hub Pro set not to renew: says it ends, not just On", "Ends" in a.page.inner_text(".ct-prohero"), a.page.inner_text(".ct-prohero"))
        check("...and renews Day Hub Pro, not a Pass they never bought", "Day Hub Pro" in a.page.inner_text("a.ct-probuy") and a.js("document.querySelector('a.ct-probuy').href").endswith("day-hub-pro") and "$4.99" in a.page.inner_text(".ct-price"), a.page.inner_text("a.ct-probuy"))
        a.js("localStorage.setItem('dayhub.pro', JSON.stringify({ buyer: 'b@example.com', ok: true, checked: Date.now(), status: 'past_due', product: 'dayhub' })); render()"); a.page.wait_for_timeout(120)
        check("Day Hub Pro with a card problem: says so", "Payment problem" in a.page.inner_text(".ct-prohero"), a.page.inner_text(".ct-prohero"))
        a.js("localStorage.setItem('dayhub.pro', JSON.stringify({ buyer: 'b@example.com', ok: true, checked: Date.now(), status: 'active', product: 'dayhub' })); render()"); a.page.wait_for_timeout(120)
        check("Day Hub Pro, all fine: included, nothing to pay", "Included with your Day Hub Pro" in a.page.inner_text(".ct-prohero") and not a.js("!!document.querySelector('a.ct-probuy')"), a.page.inner_text(".ct-prohero"))
        a.js("localStorage.setItem('dayhub.pro', JSON.stringify({ buyer: 'b@example.com', ok: false, checked: Date.now(), status: 'not found', product: 'dayhub' })); render()"); a.page.wait_for_timeout(120)
        check("Day Hub Pro ended: the button is Day Hub Pro's too", "Day Hub Pro" in a.page.inner_text("a.ct-probuy") and a.js("document.querySelector('a.ct-probuy').href").endswith("day-hub-pro"), a.page.inner_text("a.ct-probuy"))
        a.js("CT_SCREEN = null")
        a.close()
        a = cruise(b, base, at="2027-04-01T10:00:00"); a.js("shellGo('ai')"); a.page.wait_for_timeout(120)
        check("after the trip: no Road Trip or Free Time on a finished day", not {"Road Trip", "Free Time"} & set(a.js("[...document.querySelectorAll('.ct-more .ct-tile b')].map(x => x.textContent)")))
        a.close()
        a = T.App(b, base, path=T.CRUISE + "?src=play", at="2026-11-01T10:24:00")
        a.js("localStorage.setItem('cruisehub.startTab', 'home'); localStorage.setItem('cruisehub.look', 'tiles')")
        a.page.fill('form[data-setup] [name=name]', "Sam"); a.page.fill('form[data-setup] [name=city]', "80202")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        a.js("shellGo('ai')"); a.page.wait_for_timeout(150); t = a.page.inner_text("#cards")
        check("the Play app: no Pass tile, no price, no Pass wording", "Pass" not in t and "$" not in t and not a.js("!!document.querySelector('[data-ctgo=\"pass\"]')"), t[:200])
        a.js("CT_SCREEN = 'pass'; render()"); a.page.wait_for_timeout(100)
        check("...and the screen can't be reached there", not a.js("!!document.querySelector('.ct-prohero')"))
        a.js("CT_SCREEN = null")
        check("no trip yet: only the tiles that work", all(x not in a.js("[...document.querySelectorAll('.ct-more .ct-tile b')].map(x => x.textContent)") for x in ["Packing", "Road Trip", "First 10 Minutes", "Final Night"]))
        a.close()

        a = cruise(b, base)
        a.js("CLOUD_PENDING = { savedAt: '2026-09-30T12:00:00Z', data: {} }; shellGo('home')"); a.page.wait_for_timeout(120)
        check("the new Home shows 'Backup is waiting' (the old hero is hidden there)", a.js("!!document.querySelector('.ct-notices [data-cloudask]')"), a.page.inner_text(".ct-notices") if a.js("!!document.querySelector('.ct-notices')") else "no notices")
        a.js("S.simple = true; save(); shellGo('home')"); a.page.wait_for_timeout(120)
        check("...and so does Simple Mode, where the top chips are hidden", a.is_visible('#cards [data-cloudask]') if hasattr(a, 'is_visible') else a.page.is_visible('#cards [data-cloudask]'))
        a.js("CLOUD_PENDING = null; S.simple = false; save(); render()"); a.close()

        print("\n[6. the stage card follows the trip]")
        a = cruise(b, base, at="2027-03-16T13:30:00")
        check("port day: Return Guard on top", a.js("!!document.querySelector('.ct-stage .rg')") and "ALL ABOARD" in a.page.inner_text(".ct-stage"), a.page.inner_text(".ct-stage"))
        check("port day: big button = BACK TO SHIP", "BACK TO SHIP" in a.page.inner_text(".ct-big"))
        a.close()
        a = cruise(b, base, at="2027-03-20T19:00:00")
        check("final night: Get me home ready + the car", a.js("!!document.querySelector('.ct-stage .gohome')") and "Remember where you parked" in a.page.inner_text(".ct-stage"))
        a.close()
        a = cruise(b, base, at="2027-03-13T10:00:00")
        check("day before: 1 Day to Sail + Tomorrow you sail list", "Day to Sail" in a.page.inner_text(".ct-stage") and "Tomorrow you sail" in a.page.inner_text(".ct-phase"))
        a.close()
        a = cruise(b, base, at="2027-03-25T10:00:00")
        check("after the trip: Welcome home", "Welcome home" in a.page.inner_text(".ct-stage"))
        a.js("S.simple = true; render()")
        check("Simple mode always wins over the new look", not a.js("document.body.classList.contains('ct')") and a.js("!!document.querySelector('.simple-home')"))
        a.close()

        print("\n[8. review fixes: no dates, other trip, no sideways scroll, photo off]")
        a = cruise(b, base)
        for t in ("home", "plan", "explore", "wallet", "ai"):
            a.js(f"shellGo('{t}')"); a.page.wait_for_timeout(150)
            check(f"no sideways scroll on {t}", a.js("document.documentElement.scrollWidth <= document.documentElement.clientWidth"),
                  a.js("[document.documentElement.scrollWidth, document.documentElement.clientWidth]"))
        a.js("shellGo('home'); curTrip().start = null; curTrip().end = null; save(); render()"); a.page.wait_for_timeout(200)
        card = a.page.inner_text(".ct-stage") if a.js("!!document.querySelector('.ct-stage')") else ""
        check("a cruise with no dates (pasted email): no crash, asks for the dates", "Add your dates" in card and a.js("!!document.querySelector('.ct-grid')"), card)
        tap(a, ".ct-stage"); check("tap = edit the trip", a.js("TRIP_EDIT") == a.js("curTrip().id") and visible(a, "#qa")); a.js("closeQA()")
        a.js("S.photo = false; render()")
        check("Real photo off = no hero photo", not a.js("document.querySelector('.ct-hero').getAttribute('style')"))
        a.close()
        a = T.App(b, base, path=T.CRUISE)
        a.js("localStorage.setItem('cruisehub.startTab', 'home'); localStorage.setItem('cruisehub.look', 'tiles')")
        a.page.fill('form[data-setup] [name=name]', "Scott"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        a.qa("trip", {"ttype": "trip", "tname": "Vegas", "start": "2026-12-01", "end": "2026-12-04"}); a.js("closeQA()"); a.js("shellGo('home')"); a.page.wait_for_timeout(300)
        names = a.js("[...document.querySelectorAll('.ct-grid .ct-tile b')].map(x => x.textContent)")
        card = a.page.inner_text(".ct-stage")
        check("Other trip: trip words, no Sail Day / On Board tiles", "My Trip" in card and "Days to go" in card and "Sail" not in card
              and "Sail Day" not in names and "On Board" not in names and "My Trip" in names, [card, names])
        a.js("shellGo('ai')"); a.page.wait_for_timeout(150)
        more = a.js("[...document.querySelectorAll('.ct-more .ct-tile b')].map(x => x.textContent)")
        check("Other trip: More has no ship-only tiles", "Ship Guide" not in more and "Final Bill Check" not in more, more)
        a.close()

        print("\n[9. Phase 2: inner screens + pop-ups in the bright look]")
        a = cruise(b, base)
        a.js("shellGo('wallet')"); a.page.wait_for_timeout(200)
        mt = a.page.inner_text(".ct-money") if a.js("!!document.querySelector('.ct-money')") else ""
        check("Money: trip total / paid / left + final payment due", all(x in mt for x in ["$4,280.00", "$3,000.00", "$1,280.00", "Final payment due Jan 20", "80 days"]), mt)
        tools = a.js("[...document.querySelectorAll('.ct-tools .ct-tile b')].map(x => x.textContent)")
        check("Money tools: package / upgrade / split / bill first", tools[:4] == ["Package worth it?", "Upgrade worth it?", "Split the cost", "Final bill check"], tools)
        for name, sheet in (("Package worth it?", "#pkgSheet"), ("Upgrade worth it?", "#upSheet"), ("Split the cost", "#splitSheet"), ("Final bill check", "#billSheet")):
            a.js("shellGo('wallet')"); tap(a, f".ct-tools .ct-tile:has(b:text-is('{name}'))")
            check(f"{name} opens its screen", visible(a, sheet)); close_sheets(a)
        a.js("shellGo('plan')"); a.page.wait_for_timeout(150)
        check("inner screens are bright (white cards, navy text)", a.js("getComputedStyle(document.querySelector('#cards .card')).backgroundColor") == "rgba(255, 255, 255, 0.93)"
              and a.js("getComputedStyle(document.body).color") == "rgb(15, 44, 85)")
        a.js("showHelp(null)"); a.page.wait_for_timeout(150)
        bg = lambda sel: a.js(f"getComputedStyle(document.querySelector('{sel}')).backgroundColor")
        check("Crisis Mode: one colour per emergency", bg("#helpSheet [data-help=back]") == "rgb(37, 99, 235)" and bg("#helpSheet [data-help=medical]") == "rgb(220, 38, 38)"
              and bg("#helpSheet [data-help=get]") == "rgb(21, 128, 61)" and bg("#helpSheet [data-help=docs]") == "rgb(124, 58, 237)")
        check("the ✕ on a sheet is visible (dark on white)", a.js("getComputedStyle(document.querySelector('#helpSheet .icon-btn')).color") == "rgb(15, 44, 85)")
        a.js("showHelp('medical')"); a.page.wait_for_timeout(150)
        check("Crisis tap-to-call links are dark teal, not light teal (review 1)", a.js("getComputedStyle(document.querySelector('#helpSheet a[href^=\"tel:\"]')).color") == "rgb(15, 118, 110)")
        close_sheets(a)
        a.js("shellGo('plan'); PLAN_VIEW = 'packing'; render()"); a.page.wait_for_timeout(200)
        tab_on = a.js("(() => { const t = document.querySelector('#cards .tab.on'); return t ? [getComputedStyle(t).backgroundColor, getComputedStyle(t).color] : null; })()")
        check("the chosen tab is white on navy (review 2)", tab_on == ["rgb(15, 44, 85)", "rgb(255, 255, 255)"], tab_on)
        tick = a.js("(() => { const t = document.querySelector('#cards input[type=checkbox].tick:not(:checked)'); return t ? getComputedStyle(t).borderTopColor : null; })()")
        check("an unchecked tick has a visible edge on white (review 3)", tick == "rgba(15, 44, 85, 0.45)", tick)
        a.js("const t = document.querySelector('#cards input[type=checkbox].tick:not(:checked)'); t.click()"); a.page.wait_for_timeout(200)
        done = a.js("(() => { const t = document.querySelector('#cards input[type=checkbox].tick:checked'); return t ? getComputedStyle(t).backgroundColor : null; })()")
        check("a checked tick keeps its green fill", done and done not in ("rgb(255, 255, 255)", "rgba(0, 0, 0, 0)"), done)
        a.close()
        a = cruise(b, base, at="2027-03-16T13:30:00")
        a.js("showGuard()"); a.page.wait_for_timeout(150)
        on = a.js("(() => { const s = [...document.querySelectorAll('#rgSheet .seg button, #rgSheet .chip')]; const o = s.find(x => x.classList.contains('on') || x.classList.contains('good')); const n = s.find(x => x !== o);"
                  " return o && n ? [getComputedStyle(o).backgroundImage + getComputedStyle(o).backgroundColor, getComputedStyle(n).backgroundImage + getComputedStyle(n).backgroundColor] : null; })()")
        check("Return Guard: the picked safety margin stays highlighted", bool(on) and on[0] != on[1], on)
        txt = a.js("(() => { const o = document.querySelector('#rgSheet .seg button.on'); return o ? getComputedStyle(o).color : null; })()")
        check("Return Guard: the picked margin's text is dark on its light gradient (re-check 1)", txt == "rgb(10, 14, 28)", txt)
        a.close()

        print("\n[11. Money and Packing don't repeat Home]")
        a = cruise(b, base)
        shown = "(() => { const h = document.querySelector('[data-card=\"trips\"] .trip-n'), f = document.querySelector('[data-card=\"trips\"] .btn[data-forget]'); return [h && getComputedStyle(h).display !== 'none', f && getComputedStyle(f).display !== 'none']; })()"
        edit = "(() => { const e = document.querySelector('[data-card=\"trips\"] [data-tripedit]'); return !!e && e.offsetParent !== null; })()"
        a.js("shellGo('wallet')"); a.page.wait_for_timeout(100)
        check("Money: no second countdown or 'What am I forgetting?', but Edit stays (the cards say '(Edit)')", a.js(shown) == [False, False] and a.js(edit), a.js(shown))
        a.js("shellGo('plan'); PLAN_VIEW = 'packing'; render()"); a.page.wait_for_timeout(100)
        check("Packing: the same", a.js(shown) == [False, False] and a.js(edit), a.js(shown))
        a.js("PLAN_VIEW = 'trip'; render()"); a.page.wait_for_timeout(100)
        check("My Cruise → Trip keeps them, with Edit", a.js(shown) == [True, True] and a.js("!!document.querySelector('[data-card=\"trips\"] [data-tripedit]')"), a.js(shown))
        a.close()

        a = cruise(b, base, at="2027-03-20T15:00:00")                       # a port call the day before getting off, after 2 PM
        a.qa("tport", {"pname": "Roatan", "pday": "2027-03-20", "arrive": "08:00", "allAboard": "17:30"}); a.js("closeQA(); shellGo('home')"); a.page.wait_for_timeout(200)
        both = a.js("!!guardFor(curTrip()) && !!goHomeState(curTrip())")
        check("Return Guard holding the card on final night: the car chip isn't lost", both and a.js("!!document.querySelector('.ct-notices [data-gohome]')"), both)
        a.close()

        print("\n[10. the hidden hero's must-see notices]")
        a = cruise(b, base)
        check("nothing to say: no notices row", not a.js("!!document.querySelector('.ct-notices')"))
        a.js("UPDATE = { version: '9.9' }; render()")
        check("a new version shows on the new home, tappable", a.js("!!document.querySelector('.ct-notices [data-update]')"))
        a.js("UPDATE = null; INSTALL_EVT = { prompt() {} }; render()")
        check("the install prompt too", a.js("!!document.querySelector('.ct-notices [data-install]')"))
        a.js("INSTALL_EVT = null; localStorage.setItem('cruisehub.pro', JSON.stringify({ buyer: 'buyer@example.com', ok: false, checked: Date.now(), status: 'not found', product: 'cruisehub' })); S.sync.on = true; render()")
        n = a.page.inner_text(".ct-notices")
        check("Pro ended: the paused notice names the pass", "Calendar sync and backup paused (Cruise Hub Pass ended)" in n, n)
        a.js("S.sync.on = false; UPDATE = { version: '9.9' }; shellGo('wallet')")
        check("the notices are Home's: not on the other tabs", not a.js("!!document.querySelector('.ct-notices')"))
        a.js("UPDATE = null; const n0 = window.navigator; Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); render(); 0")
        check("no connection: the Offline pill sits in the top bar", "Offline" in a.page.inner_text(".ct-top"))
        a.js("Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); 0")
        a.close()
        a = T.App(b, base, path=T.CRUISE + "?src=play&look=tiles")
        a.page.fill('form[data-setup] [name=name]', "Sam"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        a.js("shellGo('ai')")
        m = a.page.inner_text(".ct-more")
        check("Play app: the More tile says Settings, no Pass wording", "Settings" in m and "Pass" not in m, m[:200])
        a.close()

        print("\n[7. the link, and the other hubs]")
        a = T.App(b, base, path=T.CRUISE + "?src=play&look=tiles")
        check("?look=tiles is kept on the phone and dropped from the address; ?src=play stays", a.js("localStorage.getItem('cruisehub.look')") == "tiles"
              and "look=" not in a.page.url and "src=play" in a.page.url, a.page.url)
        a.close()
        a = T.App(b, base, path=T.TRIP)
        a.js("localStorage.setItem('cruisehub.look', 'tiles')")
        a.page.fill('form[data-setup] [name=name]', "Pat"); a.page.fill('form[data-setup] [name=city]', "72032")
        a.page.click('form[data-setup] button'); a.page.wait_for_function("WXDATA && WXDATA.here")
        check("Trip Hub never gets it", not a.js("typeof ctOn === 'function' && ctOn()") and not a.js("document.body.classList.contains('ct')"))
        a.close()
        a = T.App(b, base); T.setup(a)
        check("Day Hub never loads it", a.js("typeof ctOn") == "undefined" and not a.js("document.body.classList.contains('ct')"))
        a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
