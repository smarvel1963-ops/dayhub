"""
SAVE AS: test_basics.py   LOCATION: C:/MarvelApps/dayhub/tests/test_basics.py

HUB BASICS, v1.73 (Scott 11/20: "do all apps have basic items like calendars calculators schedules notes a way to forward app to
other media" -> "Yes, all of them"). basics.js in all 12 Hubs. What this proves:
- Every Hub: Settings -> Tools (right under How it works) has Calendar, Notes and Calculator; each opens; a note saved there lands in
  THAT Hub's own storage and in no other Hub's; the calculator works; Family Hub's Calendar opens its own calendar. No page errors.
- The calculator: + - x /, chains, %, a divide by 0, decimals, backspace, clear, typing on a keyboard.
- Notes: add, edit, pin, delete (a second tap), the empty line, Day Hub's Notes card shows the same list.
- The month calendar shows each Hub's OWN dates (Day: events, bills every month, birthdays; Health: appointments, refills; Pet:
  birthdays, shots, vet visits, last doses; Job: interviews, follow-ups; Money: bills, renewals; Auto: service due, papers; Home:
  room tasks; Cooking: planned dinners, use-by dates; Hub Universe: what the Hubs it reads hold). Tap a day -> its list. Months move.
- Health Hub + Hub Universe brain dump: the brain dump only (no Day Hub types), sorted into reminders and notes they show; Day Hub's
  brain dump is unchanged.
- Google Calendar sync: each Hub's own dates join what is sent (keys + valid times); a removed one is no longer "still there";
  TRAVEL_CAL stays off (no trips sent) and the Pro gate is unchanged.
- Share one entry: Home (task, item, both looks), Money (bill, subscription), Pet (shot, vet visit, medicine) - the phone's share
  menu with the entry's plain text, or copied when there is none.
- Each Hub's More page (both looks where there are two) reaches the tools; the back button closes the tools only.
- 320 and 360 px phones: the sheet, the calendar and the keypad fit, nothing sideways. The 1.73 notes name no price or plan.
Drives the real app with the main suite's helpers (fake network, frozen clock: Thu 2026-10-01 8 AM Chicago).

RUN:   python tests/test_basics.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
import test_auto_tiles as TA
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}", flush=True)
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}", flush=True)

HUBS = [("Day Hub", "/", "dayhub"), ("Cruise Hub", T.CRUISE, "cruisehub"), ("Trip Hub", T.TRIP, "triphub"), ("Home Hub", T.HOMEP, "homehub"),
        ("Auto Hub", T.AUTOP, "autohub"), ("Money Hub", T.MONEYP, "moneyhub"), ("Hub Universe", T.UNIP, "hubuniverse"), ("Health Hub", T.HEALTHP, "healthhub"),
        ("Family Hub", T.FAMILYP, "familyhub"), ("Pet Hub", "/../pethub/", "pethub"), ("Cooking Hub", "/../cookinghub/", "cookinghub"), ("Job Hub", "/../jobhub/", "jobhub")]
PATH = {h: p for _, p, h in HUBS}
PRICE = re.compile(r"\$\d|\bPro\b|\bPass\b|whop|trial|\bsubscribe\b|upgrade to|/month|/year|per month|per year|\bprice", re.I)   # price words + plan names (app.js playOk and a few more)
STUB = """(() => { window.__clip = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__clip.push(t); return Promise.resolve(); } } }); } catch (e) {}
  window.__share = null; navigator.share = d => { window.__share = d; return Promise.resolve(); }; })()"""
errors = []

def app(b, base, hid, look=None, width=390, height=844):
    a = T.App(b, base, path=PATH[hid], look=look, width=width, height=height)
    a.page.on("pageerror", lambda e: errors.append(f"{hid}: {e}"))
    return a
def tap(a, sel, ms=120): a.page.click(sel); a.page.wait_for_timeout(ms)
def opened(a): return a.js("(() => { const s = document.getElementById('bxSheet'); return !!s && !s.classList.contains('hidden'); })()")
def title(a): return a.js("(document.getElementById('bxTitle') || {}).innerText || ''")
def body(a): return a.js("(document.querySelector('#bxSheet .bx-body') || {}).innerText || ''")
def disp(a): return a.js("(document.querySelector('[data-bxdisp]') || {}).innerText || ''")
def keys(a, seq):
    for k in seq: a.page.click(f'#bxSheet [data-bxkey="{k}"]')
def items(a, frm="2026-10-01", to="2026-10-31"): return a.js(f"bxItems('{frm}', '{to}').map(i => [i.date, i.time, i.title, i.sub])")
def has(L, date, title_part): return any(i[0] == date and title_part in i[2] for i in L)
def fits(a):
    return a.js("""(() => { const c = document.querySelector('#bxSheet .bx-card'); if (!c) return false; const r = c.getBoundingClientRect();
      const inside = [...document.querySelectorAll('#bxSheet button, #bxSheet textarea')].every(e => { const q = e.getBoundingClientRect(); return q.width === 0 || (q.left >= r.left - 1 && q.right <= r.right + 1); });
      return r.left >= -1 && r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1 && inside; })()""")


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. every Hub: Settings -> Tools, all three open, a note stays in that Hub's own storage]")
        for name, path, hid in HUBS:
            a = app(b, base, hid)
            a.js("openSettings()"); a.page.wait_for_timeout(200)
            check(f"{name}: Settings has Tools - Calendar, Notes, Calculator", a.js("[...document.querySelectorAll('#bxSetBox [data-bx]')].map(x => x.dataset.bx).join()") == "cal,notes,calc")
            check(f"{name}: Tools sits at the top of Settings, after How it works and the Settings tiles", a.js("(() => { const p = document.getElementById('bxSetBox').previousElementSibling; return !!p && (p.id === 'tourSetBtn' || (p.id === 'setJump' && p.previousElementSibling.id === 'tourSetBtn')); })()"))
            tap(a, "#bxSetBox [data-bx=notes]")
            check(f"{name}: Notes opens", opened(a) and "Notes" in title(a) and "No notes yet" in body(a), title(a))
            a.page.fill("#bxSheet [data-bxform=noteadd] textarea", f"Gate code 4411 for {hid}"); tap(a, "#bxSheet [data-bxform=noteadd] .bx-btn")
            mine = a.js(f"JSON.parse(localStorage.getItem('{hid}.v1') || '{{}}').notes || []")
            check(f"{name}: the note is saved in {hid}.v1", any(n.get("text") == f"Gate code 4411 for {hid}" for n in mine) and f"for {hid}" in body(a))
            others = a.js(f"Object.keys(localStorage).filter(k => /\\.v1$/.test(k) && k !== '{hid}.v1' && (localStorage.getItem(k) || '').includes('for {hid}'))")
            check(f"{name}: no other Hub's storage has it", not others, others)
            tap(a, "#bxSheet [data-bxtab=calc]"); keys(a, ["1", "2", "+", "3", "="])
            check(f"{name}: Calculator 12 + 3 = 15", "Calculator" in title(a) and disp(a) == "15", disp(a))
            own = hid in ("dayhub", "cruisehub", "triphub", "homehub", "autohub", "moneyhub", "cookinghub")
            check(f"{name}: it {'points to' if own else 'claims no'} calculators of its own", ("own calculators" in body(a)) == own)
            tap(a, "#bxSheet [data-bxtab=cal]", 300)
            if hid == "familyhub":
                check("Family Hub: Calendar opens its own calendar (Month / Week / Today)", not opened(a) and a.js("FH_TAB") == "cal" and a.js("!!document.querySelector('.fh-seg [data-fhcalv]')"))
            else:
                check(f"{name}: Calendar opens on October 2026, 31 days", opened(a) and "October 2026" in body(a) and a.js("document.querySelectorAll('#bxSheet .bx-grid button[data-bxday]').length") == 31, body(a)[:80])
                tap(a, "#bxSheet [data-bxact=close]")
                check(f"{name}: ✕ closes it", not opened(a))
            a.close()

        print("\n[2. the calculator]")
        a = app(b, base, "dayhub")
        a.js("bxOpen('calc')"); a.page.wait_for_timeout(100)
        check("opens on 0", disp(a) == "0")
        keys(a, ["1", "2", "+", "7", "="]); check("12 + 7 = 19", disp(a) == "19" and "12 + 7 =" in body(a))
        keys(a, ["2", "*", "3", "+", "4", "="]); check("2 × 3 + 4 = 10 (it chains)", disp(a) == "10")
        keys(a, ["9", "/", "4", "="]); check("9 ÷ 4 = 2.25", disp(a) == "2.25")
        keys(a, ["0", ".", "1", "+", "0", ".", "2", "="]); check("0.1 + 0.2 = 0.3 (no float noise)", disp(a) == "0.3")
        keys(a, ["2", "0", "0", "+", "1", "0", "%"]); check("200 + 10% shows 20", disp(a) == "20")
        keys(a, ["="]); check("... = 220", disp(a) == "220")
        keys(a, ["5", "0", "*", "1", "0", "%", "="]); check("50 × 10% = 5", disp(a) == "5")
        keys(a, ["9", "/", "0", "="]); check("9 ÷ 0 says it can't", disp(a) == "Can't divide by 0")
        keys(a, ["7"]); check("a key after that starts fresh", disp(a) == "7")
        keys(a, ["C", "1", "2", "3", "back"]); check("backspace: 123 -> 12", disp(a) == "12")
        keys(a, ["back", "back"]); check("backspace to empty shows 0", disp(a) == "0")
        keys(a, ["5", "-", "8", "="]); check("5 − 8 = -3", disp(a) == "-3")
        keys(a, ["C"]); check("C clears", disp(a) == "0" and a.js("BX.calc.op") is None)
        a.page.keyboard.type("7*6"); a.page.keyboard.press("Enter"); a.page.wait_for_timeout(60)
        check("typing 7*6 Enter on a keyboard = 42", disp(a) == "42")
        a.page.keyboard.press("Escape"); a.page.wait_for_timeout(60); check("Esc closes it", not opened(a))
        a.close()

        print("\n[3. notes: add, edit, pin, delete; Day Hub's Notes card is the same list]")
        a = app(b, base, "dayhub", look="classic")
        a.js("bxOpen('notes')"); a.page.wait_for_timeout(100)
        check("empty: says what notes are for", "No notes yet" in body(a))
        for t in ["Wifi for guests: blue-house", "Call the plumber back"]:
            a.page.fill("#bxSheet [data-bxform=noteadd] textarea", t); tap(a, "#bxSheet [data-bxform=noteadd] .bx-btn")
        check("'Note saved' shows over the sheet", "Note saved" in a.js("document.getElementById('toast').innerText") and int(a.js("getComputedStyle(document.getElementById('toast')).zIndex")) > 9400)
        check("two notes, newest first",a.js("[...document.querySelectorAll('#bxSheet .bx-ntext')].map(x => x.innerText).join('|')") == "Call the plumber back|Wifi for guests: blue-house")
        check("an empty note isn't saved", (a.page.fill("#bxSheet [data-bxform=noteadd] textarea", "   "), tap(a, "#bxSheet [data-bxform=noteadd] .bx-btn"), a.js("S.notes.length"))[2] == 2)
        nid = a.js("S.notes.find(n => n.text.startsWith('Wifi')).id")
        tap(a, f'#bxSheet [data-bxact=notepin][data-id="{nid}"]')
        check("📌 pins it to the top", a.js("document.querySelector('#bxSheet .bx-ntext').innerText").startswith("Wifi") and "Pinned" in body(a))
        tap(a, f'#bxSheet [data-bxact=noteedit][data-id="{nid}"]')
        a.page.fill("#bxSheet [data-bxform=noteedit] textarea", "Wifi for guests: green-house"); tap(a, "#bxSheet [data-bxform=noteedit] .bx-btn")
        check("✏️ edits it", a.js("S.notes.find(n => n.id === '" + nid + "').text") == "Wifi for guests: green-house" and "green-house" in body(a))
        tap(a, f'#bxSheet [data-bxact=notedel][data-id="{nid}"]')
        check("🗑️ asks first (Delete?)", a.js("S.notes.length") == 2 and "Delete?" in body(a))
        tap(a, f'#bxSheet [data-bxact=notedel][data-id="{nid}"]')
        check("a second tap deletes it", a.js("S.notes.length") == 1 and "green-house" not in body(a))
        a.page.keyboard.press("Escape"); a.page.wait_for_timeout(100)
        check("Day Hub's Notes card shows the same list", "Call the plumber back" in a.card("notes"))
        check("a note's date is this phone's day (7:30 PM Central is still Oct 1)", a.js("bxNoteDay('2026-10-02T00:30:00.000Z')") == "Oct 1")
        a.close()

        print("\n[4. the month calendar: each Hub's own dates]")
        a = app(b, base, "dayhub", look="classic")
        a.js("""S.events.push({ id: 'e1', day: '2026-10-05', time: '14:00', title: 'Dentist', where: '', rep: 'none' }, { id: 'e2', day: '2026-10-02', time: '', title: 'Garden club', where: '', rep: 'weekly' });
          S.bills.push({ id: 'b1', name: 'Electric', amount: 80, day: 15, paid: '2026-09' }); S.people.push({ id: 'pp1', name: 'Mom', md: '10-20', kind: 'birthday', got: {}, lead: 14 }); save(); render();""")
        L = items(a)
        check("Day: an event, on its day and time", any(i[0] == "2026-10-05" and i[1] == "14:00" and i[2] == "Dentist" for i in L), L)
        check("Day: a weekly event on every Friday", all(has(L, d, "Garden club") for d in ["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"]))
        check("Day: a bill on its due day", has(L, "2026-10-15", "Electric due"))
        check("Day: a birthday", has(L, "2026-10-20", "Mom"))
        check("Day: no weather or sunrise rows", not any("Sunrise" in i[2] or "Rain" in i[2] for i in L))
        a.js("bxOpen('cal')"); a.page.wait_for_timeout(100)
        check("opens on today (Oct 1) with its list", "Today · Oct 1" in body(a))
        check("days with something carry dots", a.js("!!document.querySelector('#bxSheet [data-bxday=\"2026-10-05\"] .bx-dots i')") and not a.js("!!document.querySelector('#bxSheet [data-bxday=\"2026-10-06\"] .bx-dots')"))
        tap(a, '#bxSheet [data-bxday="2026-10-05"]')
        check("tap a day -> that day's list, with the time", "Dentist" in body(a) and "2:00 PM" in body(a) and "Monday, October 5" in body(a))
        tap(a, '#bxSheet [data-bxday="2026-10-06"]'); check("an empty day says so", "Nothing on Oct 6." in body(a))
        tap(a, "#bxSheet [data-bxmonth='1']")
        check("› moves to November, and bills come every month", "November 2026" in body(a) and has(items(a, "2026-11-01", "2026-11-30"), "2026-11-15", "Electric due"))
        check("Today comes back", a.js("!!document.querySelector('#bxSheet .bx-today')"))
        tap(a, "#bxSheet .bx-today"); check("... to October", "October 2026" in body(a))
        tap(a, '#bxSheet [data-bxday="2026-10-05"]'); tap(a, "#bxSheet [data-bxact=caldel]")
        check("an event's ✕ asks first", "Remove?" in body(a) and a.js("S.events.length") == 2)
        tap(a, "#bxSheet [data-bxact=caldel]"); check("... then removes it", a.js("S.events.some(e => e.id === 'e1')") is False and "Dentist" not in body(a))
        a.close()

        a = app(b, base, "healthhub")
        a.js("""S.hh = { setup: true, appts: [{ id: 'a1', date: '2026-10-09', time: '10:30', doctor: 'Dr. Lee', specialty: '', reason: 'Checkup', where: 'Main St Clinic', q: [] }],
          meds: [{ id: 'm1', name: 'Lisinopril', times: ['08:00'], per: 1, left: 10 }] }; save(); render();""")
        L = items(a)
        check("Health: an appointment, with its time and doctor", any(i[0] == "2026-10-09" and i[1] == "10:30" and i[2] == "Checkup" and "Dr. Lee" in i[3] for i in L), L)
        check("Health: the refill date (10 pills, 1 a day = Oct 11)", has(L, "2026-10-11", "Refill Lisinopril"))
        a.close()

        a = app(b, base, "pethub")
        a.js("""S.pt = { setup: true, pets: [{ id: 'pp1', name: 'Biscuit', species: 'dog', bday: '2020-10-12', gotcha: '2021-10-03' }, { id: 'pp2', name: 'Old Tom', species: 'cat', bday: '2010-10-14', passed: '2025-01-01' }],
          shots: [{ id: 's1', pet: 'pp1', name: 'Rabies', given: '2025-10-20', due: '2026-10-20' }], visits: [{ id: 'v1', pet: 'pp1', date: '2026-10-07', time: '09:00', vet: 'Happy Paws', reason: 'Yearly checkup' }],
          meds: [{ id: 'pm1', pet: 'pp1', name: 'Heartworm chew', dose: '1 chew', times: ['08:00'], end: '2026-10-25' }], care: [], weights: [], mems: [], papers: [] }; save(); render();""")
        L = items(a)
        check("Pet: a birthday and a Gotcha Day", has(L, "2026-10-12", "Biscuit's birthday") and has(L, "2026-10-03", "Biscuit's Gotcha Day"), L)
        check("Pet: a shot due, a vet visit, a last dose", has(L, "2026-10-20", "Rabies due") and has(L, "2026-10-07", "vet visit") and has(L, "2026-10-25", "last day of Heartworm chew"))
        check("Pet: a pet at the Rainbow Bridge isn't on it", not any("Old Tom" in i[2] for i in L))
        a.close()

        a = app(b, base, "jobhub")
        a.js("""jh(); S.jh.jobs.j1 = { id: 'j1', t: 'Fleet Manager', co: 'Acme Freight', st: 'interview', iv: '2026-10-08T14:00', fu: '2026-10-12', fuNote: 'Send a thank-you', fuDone: false, add: '2026-09-20', stAt: '2026-09-25', appl: '2026-09-21' };
          S.jh.jobs.j2 = { id: 'j2', t: 'Dispatcher', co: 'Zed Co', st: 'applied', iv: '', fu: '2026-10-13', fuDone: true }; save(); render();""")
        L = items(a)
        check("Job: an interview with its time", any(i[0] == "2026-10-08" and i[1] == "14:00" and "Interview: Fleet Manager" in i[2] for i in L), L)
        check("Job: a follow-up; a done one isn't", has(L, "2026-10-12", "Follow up: Fleet Manager") and not any("Dispatcher" in i[2] for i in L))
        a.close()

        a = app(b, base, "moneyhub")
        a.js("""S.bills.push({ id: 'b1', name: 'Rent', amount: 1200, day: 1, paid: '2026-10' }); mh().subs.push({ id: 'sub1', name: 'Netflix', amt: 15.49, every: 'month', next: '2026-10-18' });
          S.payday = { freq: 'biweekly', next: '2026-10-09', amount: 1500, d1: 1, d2: 15 }; save(); render();""")
        L = items(a)
        check("Money: a bill (paid this month says so)", any(i[0] == "2026-10-01" and i[2] == "Rent due" and "paid" in i[3] for i in L), L)
        check("Money: a renewal, every month", has(L, "2026-10-18", "Netflix renews") and has(items(a, "2026-11-01", "2026-11-30"), "2026-11-18", "Netflix renews"))
        check("Money: payday", has(L, "2026-10-09", "Payday"))
        a.close()

        a = app(b, base, "autohub")
        a.js("""garage().cars.push({ id: 'c1', nick: 'Truck', miles: 31000, services: [{ id: 'sv1', kind: 'oil', date: '2026-04-10', miles: 30000 }], fuel: [], odo: [],
          papers: [{ id: 'pa1', kind: 'registration', name: '', expires: '2026-10-28' }], extras: [], notes: [], photos: [], mech: [] }); save(); render();""")
        L = items(a)
        check("Auto: papers to renew", has(L, "2026-10-28", "Registration renews"), L)
        check("Auto: a service due by date", has(L, "2026-10-10", "Oil change due"), L)
        a.close()

        a = app(b, base, "homehub")
        a.js("""house().spaces.push({ id: 'sp1', key: 'kitchen', icon: '🍳', name: 'Kitchen', area: 'indoor', floor: '', items: [{ id: 'it1', name: 'Refrigerator', model: 'LG LRMVS', note: 'left of sink' }],
          tasks: [{ id: 't1', title: 'Clean dishwasher filter', due: '2026-10-14', every: 3, done: false }, { id: 't2', title: 'Paint trim', due: '2026-10-16', done: true }], notes: '' }); S.house.type = 'house'; save(); render();""")
        L = items(a)
        check("Home: an open room task; a done one isn't", has(L, "2026-10-14", "Clean dishwasher filter") and not any("Paint trim" in i[2] for i in L), L)
        a.close()

        a = app(b, base, "cookinghub")
        a.js("""ck(); const r = ckBook()[0]; S.ck.week['2026-10-03'] = { r: r.id, done: false }; S.ck.pantry.push({ id: 'pa1', name: 'Milk', cat: 'ing', exp: '2026-10-04' }); window.__rt = r.t; save(); render();""")
        L = items(a)
        check("Cooking: a planned dinner and a use-by date", has(L, "2026-10-03", "Dinner: " + a.js("window.__rt")) and has(L, "2026-10-04", "Milk"), L)
        a.close()

        print("\n[5. Hub Universe: the dates of the Hubs it already reads, read-only]")
        a = app(b, base, "hubuniverse")
        a.js("""localStorage.setItem('dayhub.v1', JSON.stringify({ name: 'Sam', events: [{ id: 'e1', day: '2026-10-05', time: '14:00', title: 'Dentist', where: '', rep: 'none' }] }));
          localStorage.setItem('healthhub.v1', JSON.stringify({ hh: { setup: true, appts: [{ id: 'a1', date: '2026-10-09', time: '10:30', doctor: 'Dr. Lee', reason: 'Checkup', q: [] }], meds: [] } }));""")
        before = a.js("localStorage.getItem('dayhub.v1') + localStorage.getItem('healthhub.v1')")
        L = items(a)
        check("Universe: Day Hub's event, marked Day Hub", any(i[0] == "2026-10-05" and i[2] == "Dentist" and "Day Hub" in i[3] for i in L), L)
        check("Universe: Health Hub's appointment, marked Health Hub", any(i[0] == "2026-10-09" and i[2] == "Checkup" and "Health Hub" in i[3] for i in L))
        check("Universe: it changed nothing in the other Hubs", a.js("localStorage.getItem('dayhub.v1') + localStorage.getItem('healthhub.v1')") == before)
        a.js("render()"); a.page.wait_for_timeout(150)
        check("Universe: the three tools sit on its home screen", a.js("[...document.querySelectorAll('#cards .bx-unitools [data-bx]')].map(x => x.dataset.bx).join()") == "cal,notes,calc")
        tap(a, "#cards .bx-unitools [data-bx=cal]"); tap(a, '#bxSheet [data-bxday="2026-10-09"]')
        check("Universe: tap a day -> the other Hub's item, no ✕ to remove it", "Checkup" in body(a) and "Health Hub" in body(a) and not a.js("!!document.querySelector('#bxSheet [data-bxact=caldel]')"))
        a.close()

        print("\n[6. brain dump: Health Hub + Hub Universe keep it in what they show]")
        DUMP = "call Dan Tuesday at 2, December vacation idea, buy toothpaste"
        for hid, nm in (("healthhub", "Health Hub"), ("hubuniverse", "Hub Universe")):
            a = app(b, base, hid, look="classic")
            tap(a, "#hero [data-dump]", 200)
            check(f"{nm}: the 🧠 opens the brain dump only (no Day Hub types)", a.js("[...document.querySelectorAll('#qaTypes button')].map(x => x.dataset.qtype).join()") == "dump")
            a.page.fill("#qaForm [name=dump]", DUMP); tap(a, "[data-dumpsort]", 300)
            check(f"{nm}: sorted into a reminder and notes only", a.js("DUMP.map(x => dumpKindHere(x.kind)).join()") == "event,note,note"
                  and a.js("[...document.querySelectorAll('#dumpOut select')[0].options].map(o => o.value).join()") == "event,note")
            tap(a, "#qaForm > .btn:last-child", 300)
            check(f"{nm}: the idea and the shopping item are notes", sorted(a.js("S.notes.map(n => n.text)")) == ["December vacation idea", "Toothpaste"], a.js("S.notes"))
            check(f"{nm}: the reminder is on Tuesday at 2", a.js("S.events.map(e => [e.title, e.day, e.time])") == [["Call Dan", "2026-10-06", "14:00"]])
            check(f"{nm}: nothing went to Day Hub to-dos or lists", a.js("S.todos.length + S.lists.reduce((n, l) => n + l.items.length, 0) + (S.future || []).length") == 0)
            check(f"{nm}: the toast says where they are", "Notes and Calendar" in a.js("document.getElementById('toast').innerText"))
            a.js("bxOpen('notes')"); a.page.wait_for_timeout(100)
            check(f"{nm}: they're in its Notes", "Toothpaste" in body(a) and "December vacation idea" in body(a))
            tap(a, "#bxSheet [data-bxtab=cal]"); tap(a, '#bxSheet [data-bxday="2026-10-06"]')
            check(f"{nm}: the reminder is on its Calendar", "Call Dan" in body(a) and "2:00 PM" in body(a))
            a.close()
        a = app(b, base, "dayhub", look="classic")
        tap(a, "#hero [data-dump]", 200)
        check("Day Hub: its brain dump still offers every type", a.js("document.querySelectorAll('#qaTypes button').length") > 10)
        a.page.fill("#qaForm [name=dump]", DUMP); tap(a, "[data-dumpsort]", 300)
        check("Day Hub: still sorts into a to-do list item etc.", a.js("DUMP.map(x => dumpKindHere(x.kind)).join()") == "event,note,item")
        a.close()

        print("\n[7. Google Calendar sync: each Hub's own dates join what is sent]")
        def wanted(a): return a.js("Object.keys(gcalWanted())")
        def body_ok(a, key): return a.js(f"(() => {{ const w = gcalWanted()['{key}']; return !!w && !!w.summary && !!(w.start.date || /T\\d\\d:\\d\\d:00$/.test(w.start.dateTime)); }})()")
        a = app(b, base, "healthhub")
        a.js("""S.hh = { setup: true, appts: [{ id: 'a1', date: '2026-10-09', time: '10:30', doctor: 'Dr. Lee', reason: 'Checkup', where: 'Main St', q: [] }], meds: [{ id: 'm1', name: 'Lisinopril', times: ['08:00'], per: 1, left: 10 }] };""")
        W = wanted(a)
        check("Health: appointment + refill are sent", "ha:a1" in W and "hr:m1" in W, W)
        check("Health: the appointment at its time, with the place", body_ok(a, "ha:a1") and a.js("gcalWanted()['ha:a1'].start.dateTime") == "2026-10-09T10:30:00" and a.js("gcalWanted()['ha:a1'].location") == "Main St")
        check("Health: still there -> kept; removed -> gone from Google next sync", a.js("gcalItemExists('ha:a1')") and (a.js("S.hh.appts = []; 0") == 0) and not a.js("gcalItemExists('ha:a1')"))
        check("Pro gate unchanged: a phone without Pro can't sync", a.js("can('gcal')") is False and a.js("SWITCHES.PRO_GATE") is True)
        a.close()
        a = app(b, base, "pethub")
        a.js("""S.pt = { setup: true, pets: [{ id: 'pp1', name: 'Biscuit', species: 'dog', bday: '2020-10-12' }], shots: [{ id: 's1', pet: 'pp1', name: 'Rabies', due: '2026-10-20' }],
          visits: [{ id: 'v1', pet: 'pp1', date: '2026-10-07', time: '09:00', vet: 'Happy Paws' }], meds: [], care: [], weights: [], mems: [], papers: [] };""")
        W = wanted(a)
        check("Pet: shot, vet visit and a yearly birthday are sent", {"ps:s1", "pv:v1", "pb:pp1"} <= set(W) and a.js("gcalWanted()['pb:pp1'].recurrence[0]") == "RRULE:FREQ=YEARLY", W)
        a.close()
        a = app(b, base, "jobhub")
        a.js("""jh(); S.jh.jobs.j1 = { id: 'j1', t: 'Fleet Manager', co: 'Acme', st: 'interview', iv: '2026-10-08T14:00', fu: '2026-10-12', fuDone: false };""")
        W = wanted(a)
        check("Job: interview (timed) + follow-up are sent", "ji:j1" in W and "jf:j1" in W and a.js("gcalWanted()['ji:j1'].start.dateTime") == "2026-10-08T14:00:00", W)
        check("Job: a follow-up marked done is no longer there", (a.js("S.jh.jobs.j1.fuDone = true; 0") == 0) and not a.js("gcalItemExists('jf:j1')") and a.js("gcalItemExists('ji:j1')"))
        a.close()
        a = app(b, base, "autohub"); a.js(TA.SAMPLE)
        W = wanted(a)
        check("Auto: papers to renew + services due are sent", any(k.startswith("ap:") for k in W) and any(k.startswith("as:") for k in W), W)
        a.close()
        a = app(b, base, "homehub")
        a.js("""house().spaces.push({ id: 'sp1', key: 'kitchen', icon: '🍳', name: 'Kitchen', area: 'indoor', floor: '', items: [], tasks: [{ id: 't1', title: 'Clean filter', due: '2026-10-14', every: 3, done: false }], notes: '' });
          S.upkeep.push({ id: 'u1', name: 'Change furnace filter', area: 'home', every: 3, unit: 'months', next: '2026-10-20' });""")
        W = wanted(a)
        check("Home: room task + home upkeep are sent", "hm:t1" in W and "uk:u1" in W, W)
        a.close()
        a = app(b, base, "moneyhub")
        a.js("mh().subs.push({ id: 'sub1', name: 'Netflix', amt: 15.49, every: 'month', next: '2026-10-31' })")
        W = wanted(a)
        check("Money: a renewal goes as a monthly repeat (31st -> last day)", "ms:sub1" in W and "BYMONTHDAY" in a.js("gcalWanted()['ms:sub1'].recurrence[0]"), W)
        a.close()
        a = app(b, base, "familyhub")
        a.js("""fh(); S.fh.events.push({ id: 'fe1', title: 'Soccer', date: '2026-10-03', time: '09:00', kind: 'sports', rep: 'weekly', until: '2026-11-28', who: [], skip: ['2026-10-10'], where: 'Field 3' });
          S.fh.chores.push({ id: 'c1', title: 'Clean garage', who: '', every: 'once', date: '2026-10-11', log: {} }); FH_FIXED = null;""")
        W = wanted(a)
        r = a.js("gcalWanted()['fe:fe1'] && gcalWanted()['fe:fe1'].recurrence") or []
        check("Family: a weekly event with its end + skipped day, and a chore, are sent", "fe:fe1" in W and "fc:c1" in W and r and r[0].startswith("RRULE:FREQ=WEEKLY;UNTIL=2026112") and any("EXDATE" in x and "20261010" in x for x in r), [W, r])
        a.close()
        a = app(b, base, "triphub")
        a.js("S.trips.push({ id: 'tr1', type: 'trip', name: 'Florida', start: '2026-10-20', end: '2026-10-25' })")
        W = wanted(a)
        check("Trip: TRAVEL_CAL stays off - no trips sent", a.js("SWITCHES.TRAVEL_CAL") is False and not any(k.startswith("tr:") for k in W), W)
        check("Trip: ...but the trip is on its own Calendar", has(items(a), "2026-10-20", "Florida"))
        a.close()

        print("\n[8. share one entry: Home, Money, Pet]")
        a = app(b, base, "homehub", look="classic"); a.js(STUB)
        a.js("""house().spaces.push({ id: 'sp1', key: 'kitchen', icon: '🍳', name: 'Kitchen', area: 'indoor', floor: '', items: [{ id: 'it1', name: 'Refrigerator', model: 'LG LRMVS', note: 'left of sink' }],
          tasks: [{ id: 't1', title: 'Clean dishwasher filter', due: '2026-10-14', every: 3, done: false }], notes: '' }); S.house.type = 'house'; save(); render(); showSpace('sp1', 'tasks');""")
        a.page.wait_for_timeout(150); tap(a, '[data-bxshare="htask|sp1|t1"]', 200)
        t = (a.js("window.__share") or {}).get("text", "")
        check("Home: a task goes to the share menu as plain text", "Clean dishwasher filter" in t and "Kitchen" in t and "Due Wednesday, October 14" in t and "every 3 months" in t and "from Home Hub" in t, t)
        a.js("showSpace('sp1', 'items')"); a.page.wait_for_timeout(150); tap(a, '[data-bxshare="hitem|sp1|it1"]', 200)
        t = (a.js("window.__share") or {}).get("text", "")
        check("Home: an item too (just that one)", "Refrigerator" in t and "LG LRMVS" in t and "dishwasher" not in t, t)
        a.js("navigator.share = undefined; delete navigator.share; window.__share = null"); tap(a, '[data-bxshare="hitem|sp1|it1"]', 200)
        check("Home: no share menu on the phone -> copied, and it says so", "Refrigerator" in (a.js("window.__clip") or [""])[-1] and "Copied" in a.js("document.getElementById('toast').innerText"))
        a.close()
        a = app(b, base, "homehub")      # the new look: the room screen uses the same panes
        a.js(STUB)
        a.js("""house().spaces.push({ id: 'sp1', key: 'kitchen', icon: '🍳', name: 'Kitchen', area: 'indoor', floor: '', items: [], tasks: [{ id: 't1', title: 'Clean dishwasher filter', due: '2026-10-14', done: false }], notes: '' });
          S.house.type = 'house'; save(); render(); showSpace('sp1', 'tasks');""")
        a.page.wait_for_timeout(200)
        check("Home new look: the task's 📤 is there too", a.js("htOn()") and a.js("!!document.querySelector('[data-bxshare=\"htask|sp1|t1\"]')"))
        a.close()
        a = app(b, base, "moneyhub"); a.js(STUB)
        a.js("""S.bills.push({ id: 'b1', name: 'Electric', amount: 80, day: 15, paid: '2026-09', auto: true }); mh().subs.push({ id: 'sub1', name: 'Netflix', amt: 15.49, every: 'month', next: '2026-10-18' });
          save(); render(); showMh('bills');""")
        a.page.wait_for_timeout(200); tap(a, '[data-bxshare="mbill|b1"]', 200)
        t = (a.js("window.__share") or {}).get("text", "")
        check("Money: one bill", "Electric" in t and "$80.00" in t and "15th of every month" in t and "Next due Thursday, October 15" in t and "On autopay" in t and "Netflix" not in t, t)
        a.js("showMh('subs')"); a.page.wait_for_timeout(200); tap(a, '[data-bxshare="msub|sub1"]', 200)
        t = (a.js("window.__share") or {}).get("text", "")
        check("Money: one subscription", "Netflix" in t and "$15.49 every month" in t and "Renews Sunday, October 18" in t, t)
        a.close()
        a = app(b, base, "pethub"); a.js(STUB)
        a.js("""S.pt = { setup: true, cur: 'pp1', pets: [{ id: 'pp1', name: 'Biscuit', species: 'dog', bday: '2020-10-12', color: '#ffb27d' }], shots: [{ id: 's1', pet: 'pp1', name: 'Rabies', given: '2025-10-20', due: '2026-10-20' }],
          visits: [{ id: 'v1', pet: 'pp1', date: '2026-10-07', time: '09:00', vet: 'Happy Paws', reason: 'Yearly checkup', notes: 'All good', cost: '$85' }],
          meds: [{ id: 'pm1', pet: 'pp1', name: 'Heartworm chew', dose: '1 chew', times: ['08:00'], end: '2026-10-25' }], care: [], weights: [], mems: [], papers: [], done: {}, doses: {} }; save(); render(); showPt('health');""")
        a.page.wait_for_timeout(250)
        out = {}
        for k in ("pshot|s1", "pvisit|v1", "pmed|pm1"):
            a.js("window.__share = null"); tap(a, f'#ptSheet [data-bxshare="{k}"]', 200); out[k] = (a.js("window.__share") or {}).get("text", "")
        check("Pet: a shot", "Biscuit: Rabies" in out["pshot|s1"] and "Next due Tuesday, October 20" in out["pshot|s1"], out["pshot|s1"])
        check("Pet: a vet visit (what the vet said, cost)", "vet visit" in out["pvisit|v1"] and "9:00 AM" in out["pvisit|v1"] and "Happy Paws" in out["pvisit|v1"] and "All good" in out["pvisit|v1"], out["pvisit|v1"])
        check("Pet: a medicine, exactly as typed", "Heartworm chew" in out["pmed|pm1"] and "1 chew" in out["pmed|pm1"] and "Until Sunday, October 25" in out["pmed|pm1"], out["pmed|pm1"])
        check("Pet: the Pet Hub page is still open under it", a.js("PT_OPEN") is True)
        a.close()

        print("\n[9. every More page reaches the tools (both looks where there are two); the back button closes the tools only]")
        def more_has(a, sel, want="cal,notes,calc"):
            got = a.js(f"[...document.querySelectorAll('{sel} [data-bx]')].map(x => x.dataset.bx).join()")
            return got == want, got
        a = app(b, base, "dayhub"); a.js("S.name = 'Sam'; save(); render(); shellGo('more')"); a.page.wait_for_timeout(150)
        ok, got = more_has(a, "#cards", "cal,calc"); check("Day new look: More has Calendar + Calculator (Notes is its card)", ok and a.js("!!document.querySelector('#cards [data-card=notes]')") , got)
        tap(a, "#cards [data-bx=cal]"); check("Day new look: it opens", opened(a) and "Calendar" in title(a)); a.close()
        a = app(b, base, "healthhub"); a.js("S.hh = { setup: true }; save(); render();"); a.page.wait_for_timeout(150)
        tap(a, "#hhNav [data-hwgo=more]"); ok, got = more_has(a, "#cards"); check("Health new look: More -> Tools", a.js("hwOn()") and ok, got)
        tap(a, "#cards [data-bx=calc]"); check("Health new look: it opens", opened(a) and "Calculator" in title(a))
        a.js("history.back()"); a.page.wait_for_timeout(300)
        check("back closes the tools, Health's More stays open", not opened(a) and a.js("HW_TAB") == "more" and "TOOLS" in a.page.inner_text("#cards").upper()); a.close()
        a = app(b, base, "healthhub", look="classic"); a.js("S.hh = { setup: true }; save(); render(); showHh('more');"); a.page.wait_for_timeout(150)
        ok, got = more_has(a, "#hhSheet"); check("Health classic: Everything has the tools", not a.js("hwOn()") and ok, got); a.close()
        a = app(b, base, "moneyhub"); a.js("S.mh = { setup: true, accounts: [], tx: [], subs: [] }; save(); render();"); a.page.wait_for_timeout(150)
        tap(a, "#mvNav [data-mtgo=more]"); ok, got = more_has(a, "#cards"); check("Money new look: More -> Tools", a.js("mtOn()") and ok, got); a.close()
        a = app(b, base, "moneyhub", look="classic"); a.js("S.mh = { setup: true, accounts: [], tx: [], subs: [] }; save(); render(); showMh('more');"); a.page.wait_for_timeout(150)
        ok, got = more_has(a, "#mhSheet .mv-tiles"); check("Money classic: More has the tools", ok, got); a.close()
        a = app(b, base, "homehub"); a.js("house().spaces.push({ id: 'sp1', key: 'kitchen', icon: '🍳', name: 'Kitchen', area: 'indoor', floor: '', items: [], tasks: [], notes: '' }); S.house.type = 'house'; save(); render(); shellGo('more');")
        a.page.wait_for_timeout(150); ok, got = more_has(a, "#cards"); check("Home new look: More -> Tools", ok, got); a.close()
        a = app(b, base, "autohub"); a.js(TA.SAMPLE); a.js("render(); shellGo('more'); 0"); a.page.wait_for_timeout(150)
        ok, got = more_has(a, "#cards"); check("Auto new look: More -> Tools", ok, got); a.close()
        for hid, nm in (("triphub", "Trip"), ("cruisehub", "Cruise")):
            a = app(b, base, hid); a.js("S.name = 'Sam'; save(); render(); shellGo('ai')"); a.page.wait_for_timeout(150)
            ok, got = more_has(a, "#cards"); check(f"{nm} new look: More -> Tools", ok, got); a.close()
        a = app(b, base, "pethub"); a.js("S.pt = { setup: true, pets: [{ id: 'pp1', name: 'Biscuit', species: 'dog' }] }; save(); render(); showPt('more');"); a.page.wait_for_timeout(200)
        ok, got = more_has(a, "#ptSheet"); check("Pet: More -> the tools", ok, got)
        tap(a, "#ptSheet [data-bx=notes]"); a.js("history.back()"); a.page.wait_for_timeout(300)
        check("Pet: back closes the tools, its More page stays", not opened(a) and a.js("PT_OPEN") is True and a.js("PT_TAB") == "more"); a.close()
        a = app(b, base, "jobhub"); a.js("jh(); S.jh.setup = true; save(); render(); showJh('more');"); a.page.wait_for_timeout(200)
        ok, got = more_has(a, "#jhSheet"); check("Job: More -> the tools (icons drawn)", ok and a.js("[...document.querySelectorAll('#jhSheet [data-bx] svg')].every(s => s.innerHTML.length > 20)"), got); a.close()
        a = app(b, base, "cookinghub"); a.js("ck(); S.ck.setup = true; save(); render(); showCk('more');"); a.page.wait_for_timeout(200)
        ok, got = more_has(a, "body"); check("Cooking: More -> the tools", ok, got); a.close()
        a = app(b, base, "familyhub"); a.js("fh(); S.fh.setup = true; FH_FIXED = null; save(); render(); showFh('more');"); a.page.wait_for_timeout(200)
        ok, got = more_has(a, "body", "notes,calc"); check("Family: More -> Notes + Calculator (Calendar is in its tab bar)", ok, got); a.close()

        print("\n[10. small phones: 320 and 360 px, nothing sideways]")
        for hid, w, h in (("dayhub", 320, 568), ("pethub", 360, 740), ("healthhub", 320, 568), ("jobhub", 360, 740), ("moneyhub", 320, 568)):
            a = app(b, base, hid, width=w, height=h)
            for tool in ("cal", "notes", "calc"):
                a.js(f"bxOpen('{tool}')"); a.page.wait_for_timeout(120)
                check(f"{hid} at {w} px: {tool} fits, nothing sideways", fits(a))
            check(f"{hid} at {w} px: the keypad is all on screen", a.js("[...document.querySelectorAll('#bxSheet .bx-keys button')].every(k => { const r = k.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.width >= 40; })"))
            a.close()

        print("\n[11. the 1.73 notes: no price or plan words; the version is everywhere]")
        notes = json.load(open(os.path.join(T.ROOT, "version.json"), encoding="utf-8"))
        vt = lambda v: tuple(int(x) for x in v.split("."))   # 1.74 (Tiny Tipster) moved the version on: 1.73 or newer, its notes kept
        check("version.json is 1.73 or newer, with the 1.73 notes", vt(notes["version"]) >= (1, 73) and len(notes["notes"]["1.73"]) >= 6)
        bad = [n for n in notes["notes"]["1.73"] if PRICE.search(n)]
        check("no price or plan words in the 1.73 notes", not bad, bad)
        check("app.js VERSION and sw.js CACHE say the same version as version.json", f'const VERSION = "{notes["version"]}"' in open(os.path.join(T.ROOT, "app.js"), encoding="utf-8").read()
              and f'const CACHE = "dayhub-v{notes["version"]}"' in open(os.path.join(T.ROOT, "sw.js"), encoding="utf-8").read())
        miss = [h for _, _, h in HUBS if "basics.js" not in open(os.path.join(os.path.dirname(T.ROOT), h, "index.html"), encoding="utf-8").read()
                or "basics.js" not in open(os.path.join(os.path.dirname(T.ROOT), h, "sw.js"), encoding="utf-8").read()]
        check("every Hub's page loads basics.js and its offline worker keeps it", not miss, miss)
        order = [h for _, _, h in HUBS if not re.search(r'basics\.js"></script>\s*<script src="(\.\./dayhub/)?ui\.js"', open(os.path.join(os.path.dirname(T.ROOT), h, "index.html"), encoding="utf-8").read())]
        check("...right before ui.js", not order, order)

        b.close()
    srv.shutdown()
    real = [e for e in errors + T.ERRORS if "ERR_INTERNET_DISCONNECTED" not in e and "Failed to load resource" not in e]
    check("no page / console errors anywhere", not real, "\n        " + "\n        ".join(real[:10]))
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
