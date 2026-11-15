"""
SAVE AS: test_marvel_magic_feed.py   LOCATION: C:/MarvelApps/dayhub/tests/test_marvel_magic_feed.py

v1.62 NEW ON TV - FROM MARVEL MAGIC (Scott 11/14: "any of our app the an plug about new shows or anything like that should be coming
from this app to those" -> "Yes, build it"). magicfeed.js reads Marvel Magic's new_on_tv.json (marvelmagic/tools/build_new_on_tv.py).
Played here with a fixture file, times set around the test clock:
  - Day Hub, new look: the card on Home in the evening (not in the morning); up to 4 shows, premieres first, soonest first; every tap
    and "from Marvel Magic" open Marvel Magic; "Listings: TVmaze" credit; a poster only from TVmaze's own image server
  - Day Hub, classic look: the same card in the Tomorrow card
  - Marvel Magic opened on this phone: only the services ticked there (plus free ones); its Kids Lock = kid-safe only
  - Family Hub: "Family Night", kid-safe shows only (2 weeks ahead)
  - Money Hub (both looks): only for subscriptions that match a service, only those services' shows; a gym-only list shows nothing
  - never in the Google Play app (store mode): the file isn't even fetched; no file = no card and no page errors
  - Cruise / Trip / Home / Auto / Health / Pet don't load it
RUN:   python tests/test_marvel_magic_feed.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import json, os, sys
from datetime import datetime, timedelta, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from test_update_ready import welcome
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

AT = "2026-10-01T19:00:00"                                        # Thursday 7 PM Central = evening on Day Hub's Home
T0 = datetime(2026, 10, 1, 19, 0, tzinfo=timezone(timedelta(hours=-5)))
ms = lambda days: int((T0 + timedelta(days=days)).timestamp() * 1000)
IMG = "https://static.tvmaze.com/uploads/images/medium_portrait/1/1.jpg"
def show(i, name, svc, days, season=None, kids=False, free=False, w=50, img=IMG, net=None):
    return {"id": i, "name": name, "net": net or svc or "", "svc": svc, "free": free, "genres": [], "w": w, "img": img, "sum": "", "url": "",
            "kids": kids, "next": ms(days), "prem": {"at": ms(days), "season": season} if season else None}
FEED = {"made": "2026-10-01T23:00:00+00:00", "days": 21, "credit": "Listings: TVmaze", "shows": [
    show(1, "Star Show", "Netflix", 1, season=2),
    show(2, "Hulu Premiere", "Hulu", 2, season=1),
    show(3, "Free One", "Tubi", 2.5, season=1, free=True),
    show(4, "Kids Fun", None, 3, season=1, kids=True, net="Nickelodeon"),
    show(5, "Big Drama", "Peacock", 1.5, w=90),
    show(6, "Bad Img", "HBO Max", 4, season=3, img="https://evil.example/x.jpg"),
    show(7, "Far Away", "Netflix", 20, season=1),
    show(8, "Old News", "Hulu", -3, season=1),
    show(9, "Kids Later", None, 10, season=1, kids=True, net="Disney Junior"),
]}
CARD = "document.querySelector('.mf-card')"
NAMES = "[...document.querySelectorAll('.mf-card .mf-show b')].map(b => b.textContent)"


def feed_app(b, base, path="/", look="classic", feed=FEED, store=False, mm=None, at=AT):
    """A Hub with the fixture as Marvel Magic's file, opened fresh (route set, the shared copy cleared, page reloaded)."""
    a = T.App(b, base, path=path, at=at, look=look)
    a.hits = []
    def serve(route):
        a.hits.append(route.request.url)
        if feed is None: route.fulfill(status=404, body="")
        else: route.fulfill(status=200, content_type="application/json", body=json.dumps(feed))
    a.ctx.route("**/marvelmagic/new_on_tv.json*", serve)
    T.ERRORS.clear()                                              # the first open ran before the fixture was in place
    a.js(f"""localStorage.removeItem('hubs.newontv'); localStorage.removeItem('mm_mine'); localStorage.removeItem('mm_kids');
             {''.join(f"localStorage.setItem('mm_{k}', {json.dumps(json.dumps(v))});" for k, v in (mm or {}).items())}""")
    a.page.goto(base + path + ("?src=play" if store else ""))
    a.page.wait_for_function("typeof render === 'function'")
    return a


def wait_mf(a):
    try: a.page.wait_for_function("typeof mfShows === 'function' && typeof MF !== 'undefined' && !!MF", timeout=5000)
    except Exception: pass
    a.page.wait_for_timeout(200)


def t_day(b, base):
    print("\n[Day Hub: New on TV this week - from Marvel Magic]")
    T.ERRORS.clear()
    a = feed_app(b, base, look=None); welcome(a); wait_mf(a); a.js("render()"); a.page.wait_for_timeout(150)
    check("new look, 7 PM: the card is on Home", a.js(f"!!{CARD} && !!document.querySelector('.dt-home .mf-card')"))
    check("4 shows, premieres first, soonest first (Star Show, Hulu Premiere, Free One, Kids Fun)", a.js(NAMES) == ["Star Show", "Hulu Premiere", "Free One", "Kids Fun"], a.js(NAMES))
    t = a.js(f"{CARD}.innerText")
    check("each says what and when (Season 2 · Tomorrow, New series · Sat) and where", "Season 2 · Tomorrow" in t and "New series · Sat" in t and "Netflix" in t, t)
    links = a.js("[...document.querySelectorAll('.mf-card a.mf-show, .mf-card a.mf-from')].map(x => [x.getAttribute('href'), x.target])")
    check("every show and 'from Marvel Magic' open Marvel Magic (new tab)", links and all(h.endswith("/marvelmagic/") and tg == "_blank" for h, tg in links), links)
    check("credit: Listings: TVmaze", "Listings: TVmaze" in t)
    check("a TVmaze poster shows", a.js("document.querySelector('.mf-card img').src") == IMG)
    check("the file is kept for every Hub on this site (hubs.newontv)", a.js("JSON.parse(localStorage.getItem('hubs.newontv')).feed.shows.length") == len(FEED["shows"]))
    check("a picture from anywhere but TVmaze is never shown", "evil.example" not in a.js("mfCardHtml('x', mfShows({ svcs: ['HBO Max'], days: 7 }))") and "mf-noimg" in a.js("mfCardHtml('x', mfShows({ svcs: ['HBO Max'], days: 7 }))"))
    check("shows already aired or 3 weeks out are left off", "Old News" not in t and "Far Away" not in t)
    a.page.clock.set_fixed_time("2026-10-02T08:00:00-05:00"); a.js("render()"); a.page.wait_for_timeout(100)
    check("morning: no TV card on Home", not a.js(f"!!document.querySelector('.dt-home .mf-card')"))
    check("no page errors", not T.ERRORS, T.ERRORS[:3])
    a.close()

    T.ERRORS.clear()
    a = feed_app(b, base); T.setup(a); wait_mf(a); a.js("render()"); a.page.wait_for_timeout(150)
    check("classic look: the card sits in the Tomorrow card", "New on TV this week" in a.card("tomorrow") and "Star Show" in a.card("tomorrow"), a.card("tomorrow")[-300:])
    check("no page errors (classic)", not T.ERRORS, T.ERRORS[:3])
    a.close()

    a = feed_app(b, base, look=None, mm={"mine": ["Netflix"]}); welcome(a); wait_mf(a); a.js("render()"); a.page.wait_for_timeout(150)
    check("Marvel Magic opened here with Netflix ticked: only Netflix + free shows", a.js(NAMES) == ["Star Show", "Free One"], a.js(NAMES))
    a.close()
    a = feed_app(b, base, look=None, mm={"kids": {"on": True, "pin": "1234"}}); welcome(a); wait_mf(a); a.js("render()"); a.page.wait_for_timeout(150)
    check("Marvel Magic's Kids Lock on here: kid-safe only", a.js(NAMES) == ["Kids Fun"], a.js(NAMES))
    a.close()


def t_family(b, base):
    print("\n[Family Hub: Family Night - kid-safe only]")
    T.ERRORS.clear()
    a = feed_app(b, base, path=T.FAMILYP)
    a.page.fill('form[data-fhsetup] [name=fam]', "The Marvel Family"); a.page.fill('form[data-fhsetup] [name=name]', "Scott")
    a.page.click('form[data-fhsetup] button'); a.page.wait_for_function("S.fh && S.fh.setup")
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    wait_mf(a); a.js("render()"); a.page.wait_for_timeout(150)
    check("Family Night card on Home, in Family Hub's own card frame", a.js("!!document.querySelector('.fh-home .mf-card.fh-card')") and "Family Night" in a.js(f"{CARD}.innerText"))
    check("only kid-safe shows, 2 weeks ahead (Kids Fun, Kids Later)", a.js(NAMES) == ["Kids Fun", "Kids Later"], a.js(NAMES))
    check("no page errors", not T.ERRORS, T.ERRORS[:3])
    a.close()
    a = feed_app(b, base, path=T.FAMILYP, feed={**FEED, "shows": [s for s in FEED["shows"] if not s["kids"]]})
    a.page.fill('form[data-fhsetup] [name=fam]', "The Marvel Family"); a.page.fill('form[data-fhsetup] [name=name]', "Scott")
    a.page.click('form[data-fhsetup] button'); a.page.wait_for_function("S.fh && S.fh.setup")
    wait_mf(a); a.js("render()"); a.page.wait_for_timeout(150)
    check("no kid-safe shows coming: no card", not a.js(f"!!{CARD}"))
    a.close()


def t_money(b, base):
    print("\n[Money Hub: new on what you pay for]")
    T.ERRORS.clear()
    a = feed_app(b, base, path=T.MONEYP)
    a.page.fill('form[data-mhsetup] [name=name]', "Scott"); a.page.fill('form[data-mhsetup] [name=bal]', "1,500")
    a.page.select_option('form[data-mhsetup] [name=freq]', "biweekly"); a.page.fill('form[data-mhsetup] [name=next]', "2026-10-09"); a.page.fill('form[data-mhsetup] [name=check]', "1200")
    a.page.click('form[data-mhsetup] button'); a.page.wait_for_function("S.mh && S.mh.setup")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    wait_mf(a)
    a.js("mh().subs.push({ id: 's1', name: 'Netflix Premium', amt: 22.99, every: 'month' }, { id: 's2', name: 'Max', amt: 16.99, every: 'month' }, { id: 's3', name: 'Planet Fitness', amt: 10, every: 'month' }); save(); render()")
    a.page.click('#cards [data-mhtab="spend"]'); a.page.wait_for_timeout(100)
    T.mh_go(a, "subs"); a.page.wait_for_timeout(150)
    t = a.js("(document.querySelector('#mhSheet .mf-card') || {}).innerText || ''")
    check("classic look, Subscriptions: the card for Netflix + Max (HBO Max)", "New on what you pay for" in t, a.page.inner_text("#mhSheet")[:300])
    check("only those services' shows, 2 weeks ahead (Star Show, Bad Img)", a.js("[...document.querySelectorAll('#mhSheet .mf-show b')].map(b => b.textContent)") == ["Star Show", "Bad Img"])
    check("new look draws it too", "New on what you pay for" in a.js("mvSubsHtml()"))
    a.js("mh().subs = mh().subs.filter(s => s.id === 's3'); save(); render()")
    check("a gym-only list: no TV card", "mf-card" not in a.js("mvSubsHtml()") and a.js("mfSubsHtml(mh().subs)") == "")
    a.js("mh().subs.forEach(s => s.off = '2026-09-01'); mh().subs.push({ id: 's4', name: 'Hulu', amt: 9.99, every: 'month', off: '2026-09-15' }); save()")
    check("a cancelled Hulu doesn't count", a.js("mfSubsHtml(mh().subs)") == "")
    check("no page errors", not T.ERRORS, T.ERRORS[:3])
    a.close()


def t_never(b, base):
    print("\n[never in the Google Play app; no file = no card; other Hubs don't load it]")
    T.ERRORS.clear()
    a = feed_app(b, base, look=None, store=True); welcome(a); a.page.wait_for_timeout(600); a.js("render()")
    check("Play app (store mode): magicfeed.js never loads, the file is never fetched", a.js("typeof mfShows") == "undefined" and not a.hits and not a.js(f"!!{CARD}"), a.hits)
    a.close()
    a = feed_app(b, base, look=None, feed=None); welcome(a); a.page.wait_for_timeout(800); a.js("render()")
    errs = [e for e in T.ERRORS if "404" not in e and "Failed to load resource" not in e]
    check("Marvel Magic's file missing: no card, nothing breaks", a.js("typeof mfShows") == "function" and not a.js(f"!!{CARD}") and not errs, errs[:3])
    a.close()
    for path, label in ((T.CRUISE, "Cruise Hub"), (T.TRIP, "Trip Hub"), (T.HOMEP, "Home Hub"), (T.AUTOP, "Auto Hub")):
        a = feed_app(b, base, path=path); a.page.wait_for_timeout(500)
        check(f"{label} doesn't load it", a.js("typeof mfShows") == "undefined" and not a.hits)
        a.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for t in (t_day, t_family, t_money, t_never):
            try: t(b, base)
            except Exception as e: check(f"{t.__name__} crashed", False, repr(e)[:400])
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
