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
              ["AI Helper", "Trip Diary", "Map", "Bookings", "Ship Guide", "Final Night", "Final Bill Check", "Settings & Pass", "Classic Look"]), more)
        tap(a, ".ct-more .ct-tile:has(b:text-is('Classic Look'))")
        check("Classic Look turns it off on this phone", not a.js("document.body.classList.contains('ct')") and a.js("localStorage.getItem('cruisehub.look')") == "classic"
              and tabs(a)[1] == "📅Plan", tabs(a))
        a.close()

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
        check("Money tools: package / upgrade / split / bill", tools == ["Package worth it?", "Upgrade worth it?", "Split the cost", "Final bill check"], tools)
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
