"""
SAVE AS: test_add_save.py   LOCATION: C:/MarvelApps/dayhub/tests/test_add_save.py

v1.63.2 (Scott 11/15: "on day hub when you click you finishe event it doesnt safe and goway needs save button"). The Add sheet's own
button sat at the very bottom (under the phone's keyboard while typing), a plan had to have a time, and a tap on the dim backdrop
closed the sheet and lost what was typed. Checks, in both looks (new + Classic): the header Save button is there and in view at the
top, it saves a plan, a plan with no time saves as all day, a tap outside keeps a typed form (and still closes an untouched one),
✕ still throws it away, editing a plan (✏️) saves through the header button, the keyboard lift (--kb) moves the sheet up, and the
Save button hides on the brain dump (its own Sort / Add all button) - and shows again on the next form.

RUN:   python tests/test_add_save.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

SAVE_BOX = "(() => { const b = document.getElementById('qaSave'); if (!b) return null; const r = b.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: r.top, h: r.height, hidden: b.hidden, onTop: at === b || b.contains(at) }; })()"


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for look in (None, "classic"):
            name = "new look" if look is None else "Classic look"
            print(f"\n[{name}]")
            a = T.App(b, base, look=look); T.setup(a)
            if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
            a.js("openQA('event')"); a.page.wait_for_timeout(250)
            box = a.js(SAVE_BOX)
            check("the Add sheet has a Save button in its header", box is not None and not box["hidden"], box)
            check("it is in view near the top of the sheet, not under anything", box and box["onTop"] and box["top"] < 844 - 300, box)
            a.page.fill('#qaForm [name="title"]', "Dentist"); a.page.fill('#qaForm [name="time"]', "10:00")
            a.page.click("#qaSave"); a.page.wait_for_timeout(250)
            check("the header Save saves the plan and closes the sheet", a.js("S.events.some(e => e.title === 'Dentist' && e.time === '10:00')") and a.js("document.getElementById('qa').classList.contains('hidden')"))

            a.js("openQA('event')"); a.page.fill('#qaForm [name="title"]', "Mom's birthday dinner"); a.page.click("#qaSave"); a.page.wait_for_timeout(250)
            ev = a.js("S.events.find(e => e.title === \"Mom's birthday dinner\")")
            check("a plan with no time saves (all day)", ev is not None and not ev.get("time"), ev)
            a.js("VIEW = S.events.find(e => e.title === \"Mom's birthday dinner\").day; render()")
            if look is None: a.js("shellGo('today')")
            check("it shows as All day on the schedule", a.js("[...document.querySelectorAll('.ti')].some(r => /Mom's birthday dinner/.test(r.textContent) && /All day/.test(r.textContent))"))
            ics = a.js("(icsFor('events:' + S.events.find(e => e.title === \"Mom's birthday dinner\").id) || {}).text") or ""
            check("its calendar file is a proper all-day entry (no broken time)", "DTSTART;VALUE=DATE:" in ics and "NaN" not in ics, ics[:300])
            check("the bottom button says Save on a plan", a.js("openQA('event'), document.querySelector('#qaForm button.btn:last-of-type').textContent") == "Save")

            # a tap outside: an untouched form closes, a typed one stays
            a.js("closeQA(); openQA('event')"); a.page.mouse.click(195, 40); a.page.wait_for_timeout(150)
            check("a tap outside still closes an untouched form", a.js("document.getElementById('qa').classList.contains('hidden')"))
            a.js("openQA('event')"); a.page.fill('#qaForm [name="title"]', "Haircut"); a.page.mouse.click(195, 40); a.page.wait_for_timeout(150)
            check("a tap outside keeps a form you typed in", not a.js("document.getElementById('qa').classList.contains('hidden')") and a.js("document.querySelector('#qaForm [name=title]').value") == "Haircut")
            check("... and says how to save it", "tap Save" in (a.js("document.getElementById('toast').textContent") or ""))
            a.page.click('#qa [data-close="qa"]'); a.page.wait_for_timeout(150)
            check("✕ still throws it away", a.js("document.getElementById('qa').classList.contains('hidden')") and not a.js("S.events.some(e => e.title === 'Haircut')"))

            # the keyboard lift
            a.js("openQA('event'); document.documentElement.style.setProperty('--kb', '300px')"); a.page.wait_for_timeout(500)
            lifted = a.js("Math.round(844 - document.querySelector('#qa .sheet-body').getBoundingClientRect().bottom)")
            check("with the keyboard up (--kb 300px) the sheet sits above it", lifted == 300, lifted)
            a.js("document.documentElement.style.setProperty('--kb', '0px'); closeQA()")

            # brain dump has its own button; Save comes back on the next form
            types = a.js("qaTypes().map(x => x[0])")
            if "dump" in types:
                a.js("openQA('dump')"); check("Save hides on the brain dump (its own Sort it / Add all)", a.js("document.getElementById('qaSave').hidden") is True)
                a.js("openQA('todo')"); check("... and shows again on the next form", a.js("document.getElementById('qaSave').hidden") is False)
                a.js("closeQA()")

            if look is None:   # ✏️ edit (new look) saves through the header Save too
                a.js("openQA('event')"); a.page.fill('#qaForm [name="title"]', "Team lunch"); a.page.fill('#qaForm [name="time"]', "12:00"); a.page.click("#qaSave"); a.page.wait_for_timeout(200)
                eid = a.js("S.events.find(e => e.title === 'Team lunch').id")
                a.js(f"dtEditEvent('{eid}')"); a.page.wait_for_timeout(150)
                a.page.fill('#qaForm [name="title"]', "Team lunch (moved)"); a.page.click("#qaSave"); a.page.wait_for_timeout(200)
                check("editing a plan (✏️) saves through the header Save, no copy made",
                      a.js(f"S.events.filter(e => e.id === '{eid}' && e.title === 'Team lunch (moved)').length === 1 && !S.events.some(e => e.title === 'Team lunch')"))
            a.close()
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
