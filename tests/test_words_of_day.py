"""
SAVE AS: test_words_of_day.py   LOCATION: C:/MarvelApps/dayhub/tests/test_words_of_day.py

v1.63 WORDS OF THE DAY (Scott 11/15: "on day apps and self improvement apps we need words of the day like a wisdom statement" ->
"Write a set"). wisdom.js: 368 sayings, one a day by day of the year.
  - the set: a whole leap year without a repeat, nothing empty, nothing too long for a phone card
  - Day Hub, new look: the card on Home just below the home cards, morning and evening; the saying is the day's own
  - Day Hub, classic look: the card under "what's going on"
  - the morning brief carries the same saying
  - tomorrow brings a different saying; every phone shows the same one on the same date
  - Share it: the phone's share sheet with the saying and who said it; no share sheet = copied
  - other Hubs don't load it
RUN:   python tests/test_words_of_day.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from test_update_ready import welcome
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

CARD = "document.querySelector('#cards .wd-card')"
TEXT = "(document.querySelector('#cards .wd-card .wd-q') || {}).textContent || ''"


def t_set(b, base):
    print("\n[the set]")
    a = T.App(b, base)
    n = a.js("WD.length")
    check("368 sayings: a famous line about one day in three", n == 368 and a.js("WD.filter(x => x[1]).length") == 126, n)
    days = a.js("""(() => { const s = new Set(); for (let t = Date.UTC(2028, 0, 1); new Date(t).getUTCFullYear() === 2028; t += 864e5) s.add(wdFor(new Date(t).toISOString().slice(0, 10))[0]); return s.size; })()""")
    check("a whole leap year (366 days) without a repeat", days == 366, days)
    check("nothing empty, nothing over 130 characters", a.js("WD.every(x => x[0] && x[0].length <= 130)"))
    check("Jan 1 opens with Franklin: Well done is better than well said.", a.js("wdFor('2027-01-01')") == ["Well done is better than well said.", "Benjamin Franklin"])
    a.close()


def t_day(b, base):
    print("\n[Day Hub: the card, the brief, sharing]")
    T.ERRORS.clear()
    a = T.App(b, base, look=None); welcome(a); a.page.wait_for_timeout(200)
    want = a.js("wdFor(today())")
    check("new look, 8 AM: Words of the Day on Home", a.js(f"!!{CARD}") and "Words of the Day" in a.js(f"{CARD}.innerText"))
    check("just below the home cards (their order untouched), above the round buttons",
          a.js("(document.querySelector('.dt-home') || {}).nextElementSibling === document.querySelector('.wd-card') && !document.querySelector('.dt-home .wd-card')"))
    check("the day's own saying, with who said it when known", want[0] in a.js(TEXT) and (not want[1] or want[1] in a.js(f"{CARD}.innerText")), [want, a.js(TEXT)])
    a.js("showBrief()"); a.page.wait_for_timeout(150)
    check("the morning brief carries the same saying", "words of the day" in a.page.inner_text("#brief").lower() and want[0] in a.page.inner_text("#brief"))
    a.js("closeBrief()")
    a.js("window.__sh = []; navigator.share = d => { window.__sh.push(d); return Promise.resolve(); }; 0")
    a.page.click("#cards .wd-card [data-wdshare]"); a.page.wait_for_timeout(100)
    sh = a.js("window.__sh")
    check("Share it: the share sheet gets the saying (and who said it) from Day Hub", sh and want[0] in sh[0]["text"] and "Day Hub" in sh[0]["text"], sh)
    a.page.clock.set_fixed_time("2026-10-01T20:30:00-05:00"); a.js("render()"); a.page.wait_for_timeout(100)
    check("still there in the evening", a.js("!!document.querySelector('#cards .wd-card')"))
    a.page.clock.set_fixed_time("2026-10-02T08:00:00-05:00"); a.js("render()"); a.page.wait_for_timeout(100)
    check("tomorrow: a different saying", a.js(TEXT) and want[0] not in a.js(TEXT), a.js(TEXT))
    check("no page errors", not T.ERRORS, T.ERRORS[:3])
    a.close()

    a = T.App(b, base); T.setup(a); a.page.wait_for_timeout(200)
    check("classic look: the card under what's going on", a.js(f"!!{CARD}") and a.js("wdFor(today())[0]") in a.js(TEXT))
    b2 = T.App(b, base); T.setup(b2)
    check("every phone shows the same saying on the same date", a.js(TEXT) == b2.js(TEXT))
    b2.close()
    a.js("delete Navigator.prototype.share; navigator.share = undefined; window.__cp = null; navigator.clipboard.writeText = t => { window.__cp = t; return Promise.resolve(); }; 0")
    a.page.click("#cards .wd-card [data-wdshare]"); a.page.wait_for_timeout(150)
    check("no share sheet: the saying is copied", bool(a.js("window.__cp")) and a.js("wdFor(today())[0]") in a.js("window.__cp"))
    a.close()


def t_others(b, base):
    print("\n[other Hubs don't load it]")
    for path, label in ((T.MONEYP, "Money Hub"), (T.FAMILYP, "Family Hub"), (T.CRUISE, "Cruise Hub"), (T.AUTOP, "Auto Hub")):
        a = T.App(b, base, path=path)
        check(f"{label}: no Words of the Day", a.js("typeof wdHtml") == "undefined" and not a.js(f"!!{CARD}"))
        a.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for t in (t_set, t_day, t_others):
            try: t(b, base)
            except Exception as e: check(f"{t.__name__} crashed", False, repr(e)[:400])
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
