"""
SAVE AS: test_day_tiles.py   LOCATION: C:/MarvelApps/dayhub/tests/test_day_tiles.py

DAY HUB NEW LOOK - Phase 1 (Scott 11/01: Design Direction #1 + "Start Phase 1"). daytiles.js / daytiles.css + the
shell.js hooks. Switch DT_ON = false: nobody sees it unless the phone opened ?look=tiles. Checks:
the switch and the preview link, the home that changes with the time of day (morning brief / afternoon what's next /
evening reset + tomorrow, Top 3 near the top), the four quick buttons, the tool tiles (Arrange order + hide), every
card on exactly one tab, ⚙ on every tab, Classic look, Cruise help only while a cruise is on, no Pro wording in the
Play app, and Cruise Hub untouched. Drives the real app with the main suite's helpers (fake network, frozen clock).

RUN:   python tests/test_day_tiles.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

ORDER = "[...document.querySelectorAll('#cards .dt-home > *')].map(e => (e.className.match(/dt-moment \\w+(-\\w+)?|dt-top3|going-on/) || [''])[0])"
TABS = ["today", "tasks", "money", "more"]


def phone(b, base, at="2026-10-01T08:00:00", path="/?look=tiles"):
    a = T.App(b, base, path=path, at=at)
    T.setup(a)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')               # the morning brief opens itself once
    a.qa("event", {"title": "Team meeting", "date": "2026-10-01", "time": "15:30"}); a.js("closeQA()")
    a.qa("event", {"title": "Dinner out", "date": "2026-10-02", "time": "18:30"}); a.js("closeQA()")
    a.qa("todo", {"title": "Call insurance"}); a.js("closeQA()")
    a.js("VIEW = today(); render()")
    return a


def cards_on(a, tab):
    a.js(f"shellGo('{tab}')")
    return a.js("[...document.querySelectorAll('#cards [data-card]')].map(e => e.dataset.card)")


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. off by default]")
        a = T.App(b, base); T.setup(a)
        check("the file loads, the switch is OFF", a.js("typeof dtOn === 'function' && DT_ON === false && !dtOn()"))
        check("Day Hub looks exactly as before: no tab bar, no new-look class, classic home + Arrange link",
              a.js("!document.getElementById('tabbar') && !document.body.classList.contains('dt') && !document.body.classList.contains('shell')")
              and a.js("!!document.querySelector('.arrange-link') && !document.querySelector('.dt-home')"))
        a.close()

        print("\n[2. the preview link]")
        a = T.App(b, base, path="/?look=tiles")
        check("?look=tiles is kept on this phone and taken out of the address", a.js("localStorage.getItem('dayhub.look')") == "tiles" and "look=" not in a.js("location.search"))
        check("before set-up: the welcome card, no tabs yet", not a.js("!!document.getElementById('tabbar')") and "Welcome to Day Hub" in a.page.inner_text("#cards"))
        T.setup(a)
        check("after set-up: the new look with 5 tabs Home · Today · Tasks · Money · More",
              a.js("document.body.classList.contains('dt')") and a.js("[...document.querySelectorAll('#tabbar button')].map(b => b.textContent.trim()).join('|')") == "Home|Today|Tasks|Money|More")
        a.close()

        print("\n[3. morning: the brief and the schedule first, then Top 3]")
        a = phone(b, base, "2026-10-01T08:00:00")
        o = a.js(ORDER)
        check("order: 'This morning' card, Top 3, then what's going on", o == ["dt-moment am", "dt-top3", "going-on"], o)
        m = a.page.inner_text(".dt-moment.am")
        check("it names the first plan and counts the day", "3:30 PM · Team meeting" in m and "1 plan today" in m and "1 to-do" in m, m)
        a.page.click('.dt-moment.am [data-brief="open"]'); a.page.wait_for_timeout(200)
        check("Read my brief opens the morning brief", a.js("briefOpen()"))
        a.page.click('[data-brief="go"]')
        check("the sky hero stays: greeting, clock, Life pulse, chips, ⚙", a.js("['.greet', '.hero-clock', '.pulse, .verdict-row', '.chips', '#settingsBtn'].every(s => !!document.querySelector('#hero ' + s) || !!document.querySelector(s))"))
        q = a.js("[...document.querySelectorAll('.dt-quick .dt-q')].map(b => b.textContent.trim())")
        check("four quick buttons: Add · Ask AI · Brain Dump · Don't Forget", q == ["＋Add", "💡Ask AI", "🧠Brain Dump", "🚪Don't Forget"], q)
        a.js("window.__qa = []; const _o = openQA; openQA = (t, k) => { window.__qa.push(t); return _o(t, k); }; window.__ask = 0; showAsk = () => { window.__ask++; }; 0")   # '; 0': a script ending in a function gets that function run
        a.page.click(".dt-q.add"); a.page.wait_for_timeout(150)
        check("Add opens the + sheet", a.js("window.__qa[0]") == "event" and a.js("!document.getElementById('qa').classList.contains('hidden')"))
        a.js("closeQA()")
        a.page.click(".dt-q.dump"); a.page.wait_for_timeout(150)
        check("Brain Dump opens the brain dump", a.js("window.__qa.includes('dump')")); a.js("closeQA()")
        a.page.click(".dt-q.ai")
        check("Ask AI opens Ask Day Hub", a.js("window.__ask") == 1)
        a.page.click(".dt-q.leave"); a.page.wait_for_timeout(200)
        check("Don't Forget goes to Tasks, to the leaving list", a.js("TAB") == "tasks" and a.js("!!document.querySelector('#cards [data-card=\"leave\"]')"))
        a.close()

        print("\n[4. afternoon: what's next]")
        a = phone(b, base, "2026-10-01T14:00:00")
        o = a.js(ORDER)
        check("order: What's next first, then Top 3, then what's going on", o == ["dt-moment pm", "dt-top3", "going-on"], o)
        check("what's going on doesn't repeat the plan the card names", "Team meeting" not in a.page.inner_text(".going-on"))
        n = a.page.inner_text(".dt-moment.pm")
        check("What's next = Team meeting · 3:30 PM · in 1h 30m", "Team meeting" in n and "3:30 PM" in n and "in 1h 30m" in n, n)
        a.page.click(".dt-moment.pm"); a.page.wait_for_timeout(200)
        check("tap it: Today, the schedule", a.js("TAB") == "today" and a.js("!!document.querySelector('#cards [data-card=\"schedule\"]')"))
        a.close()

        print("\n[5. evening: Nightly reset + tomorrow first]")
        a = phone(b, base, "2026-10-01T20:00:00")
        o = a.js(ORDER)
        check("order: Nightly reset, Tomorrow, then Top 3", o == ["dt-moment pm-eve", "dt-moment eve", "dt-top3"], o)
        check("Tomorrow names the first plan", "6:30 PM · Dinner out" in a.page.inner_text(".dt-moment.eve"))
        tiles = a.js("[...document.querySelectorAll('.dt-tools .dt-tile')].map(t => t.dataset.dtcard || 'all')")
        check("the tools don't repeat what the cards above show (no reset / tomorrow / top3 tile)", not {"reset", "tomorrow", "top3"} & set(tiles), tiles)
        a.page.click(".dt-moment.pm-eve"); a.page.wait_for_timeout(200)
        check("tap the reset: Today with the Nightly reset", a.js("TAB") == "today" and a.js("!!document.querySelector('#cards [data-card=\"reset\"]')"))

        print("\n[6. every card is on exactly one tab - nothing lost]")
        seen = {}
        for t in TABS:
            for k in cards_on(a, t): seen.setdefault(k, []).append(t)
        want = set(a.js("dtOrder()"))
        check("every card on screen in the classic look is on a tab", want <= set(seen), sorted(want - set(seen)))
        check("...and on only one", all(len(v) == 1 for k, v in seen.items() if k in want), {k: v for k, v in seen.items() if len(v) > 1})
        a.js("shellGo('home')")

        print("\n[7. the tools follow Arrange: order + hide]")
        a.js("S.order = ['budget', ...cardOrder().filter(k => k !== 'budget')]; save(); render()")
        check("Budget moved to the top in Arrange = the first tile", a.js("document.querySelector('.dt-tools .dt-tile').dataset.dtcard") == "budget")
        a.js("S.hidden.push('budget'); save(); render()")
        check("hidden in Arrange = no tile, not on Money", not a.js("!!document.querySelector('.dt-tile[data-dtcard=\"budget\"]')") and "budget" not in cards_on(a, "money"))
        a.js("S.hidden = S.hidden.filter(k => k !== 'budget'); S.collapsed.push('bills'); save(); shellGo('home')")
        check("8 tiles + 'All tools' when there are more", a.js("document.querySelectorAll('.dt-tools .dt-tile').length") == 9 and "All tools" in a.page.inner_text(".dt-tools"))
        a.page.click('.dt-tile[data-dtcard="budget"]'); a.page.wait_for_timeout(200)
        check("a tile opens its tab with that card", a.js("TAB") == "money" and a.js("!!document.querySelector('#cards [data-card=\"budget\"]')"))
        a.js("shellGo('home')")
        a.js("S.order = ['bills', ...cardOrder().filter(k => k !== 'bills')]; save(); render()")
        a.page.click('.dt-tile[data-dtcard="bills"]'); a.page.wait_for_timeout(200)
        check("a folded card opens unfolded", a.js("!S.collapsed.includes('bills')") and a.js("!document.querySelector('#cards [data-card=\"bills\"]').classList.contains('collapsed')"))

        print("\n[8. ⚙ on every tab]")
        ok = True
        for t in ["home"] + TABS:
            a.js(f"shellGo('{t}')")
            vis = a.js("(() => { const g = document.getElementById('settingsBtn'); return !!g && getComputedStyle(g).display !== 'none'; })()")
            ok = ok and vis
        check("Settings button visible on Home, Today, Tasks, Money and More", ok)
        a.page.click("#settingsBtn"); a.page.wait_for_timeout(200)
        check("...and opens Settings", a.js("!document.getElementById('sheet').classList.contains('hidden')"))
        a.js("closeSettings()")
        check("other tabs: a title, not the big clock", "Today" in a.page.inner_text(".dt-title") if a.js("shellGo('today'); !!document.querySelector('.dt-title')") else False)

        print("\n[9. Classic look]")
        a.js("shellGo('more')")
        a.page.click('[data-dtgo="classic"]'); a.page.wait_for_timeout(200)
        check("More → Classic Look: the old Day Hub, remembered on this phone",
              a.js("!document.body.classList.contains('dt') && !document.getElementById('tabbar') && !!document.querySelector('.arrange-link')") and a.js("localStorage.getItem('dayhub.look')") == "classic")
        a.close()

        print("\n[10. Cruise help only while a cruise is on (Crisis Mode lives in Cruise Hub)]")
        a = phone(b, base)
        check("no cruise: no Cruise help", not a.js("!!document.querySelector('.dt-cruise')"))
        a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-10-02", "end": "2026-10-06", "line": "Princess"}); a.js("closeQA(); shellGo('home')")
        c = a.js("(document.querySelector('.dt-cruise') || {}).href || ''")
        check("a cruise tomorrow: 'Cruise help' links to Cruise Hub", c.endswith("/cruisehub/") and "Cruise help" in a.page.inner_text(".dt-cruise"), c)
        a.close()
        a = phone(b, base)
        a.js("localStorage.setItem('cruisehub.v1', JSON.stringify({ trips: [{ id: 'c9', type: 'cruise', name: 'Alaska', start: '2026-10-01', end: '2026-10-08' }], adopted: [] })); render()")
        check("a cruise kept in Cruise Hub (same phone) counts too", a.js("!!document.querySelector('.dt-cruise')"))
        a.close()

        print("\n[11. the Play app: no Pro wording in the new look]")
        a = phone(b, base, path="/?src=play&look=tiles")
        txt = a.page.inner_text("#cards") + a.page.inner_text("#tabbar")
        a.js("shellGo('more')"); txt += a.page.inner_text("#cards")
        check("Home + More in the Play app: no 'Pro'", "Pro" not in txt.replace("Pro\u200b", ""), [l for l in txt.split("\n") if "Pro" in l][:3])
        a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-10-02", "end": "2026-10-06", "line": "Princess"}); a.js("closeQA(); shellGo('home')")
        c = a.js("(document.querySelector('.dt-cruise') || {}).href || ''")
        check("Play app: Cruise help keeps the store flag (?src=play) so Cruise Hub shows no prices", c.endswith("/cruisehub/?src=play"), c)
        a.close()

        print("\n[13. after midnight: the new day, not 'tomorrow']")
        a = phone(b, base, "2026-10-01T00:30:00")
        o = a.js(ORDER)
        check("00:30: 'Later today' card, Top 3, what's going on", o == ["dt-moment eve", "dt-top3", "going-on"], o)
        n = a.page.inner_text(".dt-moment.eve")
        check("...naming today's 3:30 PM Team meeting (not Friday's dinner)", "later today" in n.lower() and "3:30 PM \u00b7 Team meeting" in n and "Dinner" not in n, n)
        a.page.click(".dt-moment.eve"); a.page.wait_for_timeout(200)
        check("...and the tap opens today's schedule", a.js("TAB") == "today" and a.js("VIEW === today()") and a.js("!!document.querySelector('#cards [data-card=\"schedule\"]')"))
        a.close()

        print("\n[14. hidden stays hidden, taps don't write]")
        a = phone(b, base, "2026-10-01T20:00:00")
        a.js("S.hidden.push('tomorrow'); save(); render()")
        check("Tomorrow hidden in Arrange: no Tomorrow card in the evening", not a.js("!!document.querySelector('.dt-moment.eve')"))
        a.js("window.__saves = 0; const _sv = save; save = () => { window.__saves++; return _sv(); }; 0")
        a.page.click('.dt-tile[data-dtcard="schedule"]'); a.page.wait_for_timeout(200)
        check("opening an open card saves nothing (no 'changes waiting' for backup / calendar)", a.js("window.__saves") == 0 and a.js("TAB") == "today")
        a.js("S.hidden.push('schedule'); shellGo('home')")
        a.page.click(".dt-moment.pm-eve"); a.page.wait_for_timeout(200)
        check("a tap never un-hides a card the user hid (Schedule stays hidden)", a.js("S.hidden.includes('schedule') && S.hidden.includes('tomorrow')"))
        check("card summaries read as text (no &amp;)", a.js("dtText('Gym &amp; Swim <b>now</b>')") == "Gym & Swim now")
        a.js("shellGo('more')")
        check("More lists every tool as a tile ('All tools' is true)", a.js("document.querySelectorAll('.dt-tools .dt-tile').length") == a.js("dtOrder().length"))
        a.close()

        print("\n[15. hero chips + Life pulse 'Go' reach cards on other tabs]")
        a = phone(b, base, "2026-10-01T08:00:00")
        T.hero(a); a.page.click('#hero .chip[data-leave]'); a.page.wait_for_timeout(300)
        check("hero chip 'Don't forget: N to check' \u2192 Tasks, the leaving list", a.js("TAB") == "tasks" and a.js("!!document.querySelector('#cards [data-card=\"leave\"]')"))
        a.js("shellGo('home')")
        a.page.click("#hero [data-pulse]"); a.page.wait_for_timeout(200)
        k = a.js("(document.querySelector('[data-pulsego]') || {dataset: {}}).dataset.pulsego || ''")
        if k:
            a.page.click("[data-pulsego]"); a.page.wait_for_timeout(300)
            check(f"Life pulse 'Go' ({k}) \u2192 its tab with the card", a.js("TAB") == a.js(f"dtTabFor('{k}')") and a.js(f"!!document.querySelector('#cards [data-card=\"{k}\"]')"), a.js("TAB"))
        else:
            check("Life pulse has a Go to follow", False, "no data-pulsego")
        a.close()

        print("\n[12. Cruise Hub untouched]")
        a = T.App(b, base, path=T.CRUISE)
        check("Cruise Hub doesn't load the Day Hub look", a.js("typeof dtOn") == "undefined" and not a.js("document.body.classList.contains('dt')"))
        a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
