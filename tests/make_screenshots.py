"""
SAVE AS: make_screenshots.py   LOCATION: C:/MarvelApps/dayhub/tests/make_screenshots.py

STORE SCREENSHOTS (v0.40, Scott 10/3 "make it saleable"). Drives the real app
through the test harness (frozen clock Thu Oct 1 8:00 AM, fixture weather,
empty phone + demo data typed in like a person would) and saves:
    screenshots/phone-1-home.png ... phone-4-*.png   1080x1920 (manifest, Play Store)
    screenshots/wide-1-home.png                      1280x800  (manifest "wide")
Nothing touches the live site or anyone's data.

RUN:   python tests/make_screenshots.py      (from C:/MarvelApps/dayhub)
Re-run after any visible change, then commit the PNGs.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OUT = os.path.join(T.ROOT, "screenshots")


def demo(a):
    T.setup(a, name="Sam")
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    a.qa("event", {"title": "Dentist", "date": "2026-10-01", "time": "14:30", "where": "Main St"})
    a.qa("event", {"title": "Soccer practice", "date": "2026-10-01", "time": "17:30"})
    a.qa("todo", {"title": "Call the insurance company"})
    a.qa("todo", {"title": "Pick up dry cleaning"})
    a.qa("bill", {"title": "Phone", "amount": "85", "day": "3"})
    a.qa("countdown", {"title": "Beach trip", "date": "2026-10-23"})
    a.js("S.lists[0].items.push({id:'a',text:'Milk',done:false},{id:'b',text:'Eggs',done:false},{id:'c',text:'Coffee',done:false}); save(); render()")
    a.page.evaluate("window.scrollTo(0, 0)"); a.page.wait_for_timeout(400)


def shoot(a, name, scroll_to=None):
    if scroll_to:
        a.page.evaluate(f"document.querySelector('{scroll_to}').scrollIntoView({{block: 'start'}})")
    else:
        a.page.evaluate("window.scrollTo(0, 0)")
    a.page.evaluate("document.getElementById('toast').classList.remove('show')")
    a.page.wait_for_timeout(500)
    a.page.screenshot(path=os.path.join(OUT, name))
    print("  saved", name)


def main():
    os.makedirs(OUT, exist_ok=True)
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        # phone: 360x640 CSS px at 3x = 1080x1920
        a = T.App(b, base, width=360, height=640)
        a.ctx.close()
        ctx = b.new_context(viewport={"width": 360, "height": 640}, device_scale_factor=3, timezone_id="America/Chicago")
        T.route(ctx); a.ctx = ctx; a.page = ctx.new_page()
        a.page.clock.install(time="2026-10-01T08:00:00-05:00")
        a.page.goto(base + "/"); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
        demo(a)
        shoot(a, "phone-1-home.png")
        shoot(a, "phone-2-schedule.png", '[data-card="schedule"]')
        shoot(a, "phone-3-weather.png", '[data-card="weather"]')
        a.js("openQA('dump')"); a.page.wait_for_timeout(300)
        a.page.fill("#qaForm [name=dump]", "dentist tuesday 3pm, buy milk and eggs, call mom about thanksgiving, oil change next month")
        shoot(a, "phone-4-brain-dump.png")
        ctx.close()
        # wide: tablet / desktop
        ctx = b.new_context(viewport={"width": 1280, "height": 800}, timezone_id="America/Chicago")
        T.route(ctx); a.ctx = ctx; a.page = ctx.new_page()
        a.page.clock.install(time="2026-10-01T08:00:00-05:00")
        a.page.goto(base + "/"); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')")
        demo(a)
        shoot(a, "wide-1-home.png")
        ctx.close()
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
