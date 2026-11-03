"""
SAVE AS: test_money_fixes.py   LOCATION: C:/MarvelApps/dayhub/tests/test_money_fixes.py

MONEY HUB FIXES (Scott 11/03: "finish what you can on hubs"; the broken list in the Money Hub inventory). Your pay can be changed after
the welcome, "twice a month" listens to the date you typed, choosing how often with no date says so instead of losing it.
Drives the real app with the main suite's helpers (fake network, frozen clock).

RUN:   python tests/test_money_fixes.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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


def welcome(b, base, at="2026-10-01T09:00:00", **vals):
    a = T.App(b, base, path=T.MONEYP, at=at)
    a.page.fill('form[data-mhsetup] [name=name]', "Sam")
    if vals.get("freq"): a.page.select_option('form[data-mhsetup] [name=freq]', vals["freq"])
    for k in ("next", "check", "d2"):
        if vals.get(k): a.page.fill(f'form[data-mhsetup] [name={k}]', vals[k])
    a.page.click('form[data-mhsetup] button'); a.page.wait_for_timeout(200)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    return a


def pay_page(a):
    a.js("showMh('payday')"); a.page.wait_for_timeout(150)
    a.js("document.querySelector('#mhSheet details').open = true")


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. the welcome]")
        a = T.App(b, base, path=T.MONEYP, at="2026-10-01T09:00:00")
        check("the other payday stays out of the way until it's needed", not a.page.is_visible('form[data-mhsetup] .mh-twice'))
        a.page.select_option('form[data-mhsetup] [name=freq]', "semimonthly")
        check("...and shows for twice a month", a.page.is_visible('form[data-mhsetup] .mh-twice'))
        a.page.select_option('form[data-mhsetup] [name=freq]', "weekly")
        check("...and goes again", not a.page.is_visible('form[data-mhsetup] .mh-twice'))
        a.page.fill('form[data-mhsetup] [name=name]', "Sam"); a.page.click('form[data-mhsetup] button'); a.page.wait_for_timeout(200)
        check("how often but no date: stays here and says so", a.js("!!document.querySelector('form[data-mhsetup]')") and not a.js("S.mh && S.mh.setup") and "Add your next payday" in a.page.inner_text("#toast"), a.page.inner_text("#toast"))
        a.close()
        a = welcome(b, base)
        check("Skip for now still works, with no payday", a.js("S.mh.setup") and not a.js("S.payday.freq"))
        a.close()
        a = welcome(b, base, freq="semimonthly", next="2026-10-10", check="1,200", d2="25")
        check("twice a month uses the days typed, not the 1st and 15th", a.js("[S.payday.d1, S.payday.d2, S.payday.amount]") == [10, 25, 1200], a.js("S.payday"))
        check("...and the dates follow", a.js("payNext('2026-10-11')") == "2026-10-25" and a.js("payNext('2026-10-26')") == "2026-11-10", a.js("payNext('2026-10-11')"))
        a.close()
        a = welcome(b, base, freq="semimonthly", next="2026-10-10")
        check("the other day left blank: 15 days away, not the same day", a.js("[S.payday.d1, S.payday.d2]") == [10, 25], a.js("S.payday"))
        a.close()

        print("\n[2. changing your pay later]")
        a = welcome(b, base)
        pay_page(a)
        check("Skipped at the welcome: the Payday page offers it, open", a.page.is_visible('form[data-mhpay]') and "not set yet" in a.page.inner_text("#mhSheet details summary"))
        check("...and no longer points you to the page you're on", "on the Payday page" not in a.page.inner_text("#mhSheet"))
        a.page.select_option('form[data-mhpay] [name=freq]', "biweekly"); a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(150)
        check("no date: says so, keeps the page", "Add your next payday" in a.page.inner_text("#mhMsg") and not a.js("S.payday.freq"))
        a.page.select_option('form[data-mhpay] [name=freq]', "biweekly"); a.page.fill('form[data-mhpay] [name=next]', "2026-10-09"); a.page.fill('form[data-mhpay] [name=check]', "1,500.50")
        a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(200)
        check("saved: how often, date, amount", a.js("[S.payday.freq, S.payday.next, S.payday.amount]") == ["biweekly", "2026-10-09", 1500.5], a.js("S.payday"))
        check("...the page shows it", "Every 2 weeks" in a.page.inner_text("#mhSheet details summary") and "Next payday" in a.page.inner_text("#mhSheet"))
        check("...and it's there after a reopen", a.js("JSON.parse(localStorage.getItem(STORE)).payday.amount") == 1500.5)
        a.js("mh().plan = { start: 100, check: 999, bills: 888, other: 5, save: 6 }; save(); showMh('payday')"); a.page.wait_for_timeout(100); a.js("document.querySelector('#mhSheet details').open = true")
        a.page.fill('form[data-mhpay] [name=check]', "2000"); a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(200)
        check("a new amount reaches the planner; what you typed for the rest stays", a.page.input_value('form[data-mhplan] [name=check]') == "2000" and a.page.input_value('form[data-mhplan] [name=start]') == "100", a.page.input_value('form[data-mhplan] [name=check]'))
        a.js("document.querySelector('#mhSheet details').open = true")
        a.page.select_option('form[data-mhpay] [name=freq]', "semimonthly"); a.page.wait_for_timeout(50)
        check("change to twice a month: the other payday appears", a.page.is_visible('form[data-mhpay] .mh-twice'))
        a.page.fill('form[data-mhpay] [name=next]', "2026-10-15"); a.page.fill('form[data-mhpay] [name=d2]', "15"); a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(150)
        check("the same day twice: says so, changes nothing", "different days" in a.page.inner_text("#mhMsg") and a.js("S.payday.freq") == "biweekly")
        a.page.fill('form[data-mhpay] [name=d2]', "30"); a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(200)
        check("the 15th and the 30th", a.js("[S.payday.freq, S.payday.d1, S.payday.d2]") == ["semimonthly", 15, 30], a.js("S.payday"))
        a.js("document.querySelector('#mhSheet details').open = true")
        check("reopened: it shows the other day, not the same one twice", a.page.input_value('form[data-mhpay] [name=next]') == "2026-10-15" and a.page.input_value('form[data-mhpay] [name=d2]') == "30", a.page.input_value('form[data-mhpay] [name=d2]'))
        a.page.select_option('form[data-mhpay] [name=freq]', ""); a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(200)
        check("you can take the payday out again", not a.js("S.payday.freq") and a.js("payNext()") is None)
        a.close()

        print("\n[2b. Save with nothing changed moves nothing]")
        for at, pay, note in [("2026-11-20T09:00:00", "{ freq: 'semimonthly', next: '2026-10-15', d1: 15, d2: 31, amount: 900 }", "15th and 31st, in a 30-day month"),
                              ("2027-02-20T09:00:00", "{ freq: 'semimonthly', next: '2026-10-15', d1: 15, d2: 31, amount: 900 }", "15th and 31st, in February"),
                              ("2026-11-20T09:00:00", "{ freq: 'semimonthly', next: '2026-10-31', d1: 31, d2: 15, amount: 900 }", "31st and 15th, the other way round"),
                              ("2026-11-20T09:00:00", "{ freq: 'monthly', next: '2026-10-31', d1: 1, d2: 15, amount: 900 }", "monthly on the 31st"),
                              ("2026-11-20T09:00:00", "{ freq: 'biweekly', next: '2026-10-09', d1: 1, d2: 15, amount: 900 }", "every 2 weeks")]:
            a = welcome(b, base, at=at)
            a.js(f"S.payday = {pay}; save()"); before = a.js("[payNext('2026-12-01'), payAfter(payNext('2026-12-01')), payNext('2027-01-20'), S.payday.next, S.payday.d1, S.payday.d2]")
            pay_page(a); a.page.fill('form[data-mhpay] [name=check]', "1000"); a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(200)
            after = a.js("[payNext('2026-12-01'), payAfter(payNext('2026-12-01')), payNext('2027-01-20'), S.payday.next, S.payday.d1, S.payday.d2]")
            check(f"{note}: a new amount changes only the amount", after == before and a.js("S.payday.amount") == 1000, [before, after])
            a.close()
        a = welcome(b, base, at="2026-11-20T09:00:00")
        a.js("S.payday = { freq: 'semimonthly', next: '2026-10-15', d1: 15, d2: 31, amount: 900 }; save()"); pay_page(a)
        check("the form shows the other payday, not the one it landed on", a.page.input_value('form[data-mhpay] [name=next]') == "2026-11-30" and a.page.input_value('form[data-mhpay] [name=d2]') == "15", a.page.input_value('form[data-mhpay] [name=d2]'))
        a.page.fill('form[data-mhpay] [name=d2]', "10"); a.page.click('form[data-mhpay] button'); a.page.wait_for_timeout(200)
        check("change just the other day: the 31st stays the 31st", a.js("[S.payday.d1, S.payday.d2]") == [31, 10], a.js("S.payday"))
        a.close()

        print("\n[3. other Hubs]")
        a = T.App(b, base)
        check("Day Hub doesn't load any of this", a.js("typeof mhSetPay") == "undefined")
        a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
