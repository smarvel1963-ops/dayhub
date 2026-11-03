"""
SAVE AS: test_calendar_hubs.py   LOCATION: C:/MarvelApps/dayhub/tests/test_calendar_hubs.py

GOOGLE CALENDAR ACROSS THE HUBS (Scott 11/03: "finish what you can on hubs"). (1) A Hub only removes calendar events it put there: every
Hub writes to the same calendar, and each one used to delete what it didn't recognise. (2) Behind TRAVEL_CAL (OFF): trips, port days,
final payments, bookings, drives and plans reach the calendar, as the Cruise Hub and Trip Hub Passes promise. Fake Google, frozen clock.

RUN:   python tests/test_calendar_hubs.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

# The suite's fake Google, plus a refused event and PATCH (a claim changes the owner and nothing else).
FAKE = T.FAKE_GCAL.replace("if (m === 'POST') {", "if ((m === 'POST' || m === 'PUT') && JSON.parse(o.body).summary.includes('REFUSE')) return J({}, 400); if (m === 'PATCH') { const p = JSON.parse(o.body).extendedProperties.private; store[id].extendedProperties.private = { ...store[id].extendedProperties.private, ...p }; keep(); return J(store[id]); } if (m === 'POST') {")
SEED_FOREIGN = """(() => { const E = (id, key, summary, owner) => ({ id, summary, start: { date: '2026-10-20' }, end: { date: '2026-10-21' },
    extendedProperties: { private: { dayhubApp: '1', dayhubKey: key, dayhubHash: 'old', ...(owner ? { dayhubOwner: owner } : {}) } } });
  sessionStorage.setItem('__g', JSON.stringify({ d1: E('d1', 'ev:fromday', "Day Hub's vet", 'dayhub'), d2: E('d2', 'ev:oldone', 'From before owners', null), d3: E('d3', 'bill:oldbill', 'Old bill', 'moneyhub') })); })()"""


def hub(b, base, path, pro=True):
    a = T.App(b, base, path=path, at="2026-10-01T09:00:00")
    a.ctx.add_init_script(FAKE); a.page.reload(); a.page.wait_for_timeout(200)
    if path:
        a.js("localStorage.setItem(APP_ID + '.startTab', 'home')")
    if a.js("!!document.querySelector('form[data-setup]')"):
        a.page.fill('form[data-setup] [name=name]', "Sam"); a.page.fill('form[data-setup] [name=city]', "80202"); a.page.click('form[data-setup] button'); a.page.wait_for_timeout(300)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    if pro: a.js("setOwnerSwitch('OWNER', true)")
    a.js("GTOKEN = 'tok'; GTOKEN_EXP = Date.now() + 3e6; S.gcal.connected = true; S.gcal.scope = GCAL_SCOPE; saveLocal()")
    return a

def push(a): a.page.evaluate("async () => { await gcalPush(); }"); a.page.wait_for_timeout(100)
def cal(a): return a.js("JSON.parse(sessionStorage.getItem('__g') || '{}')")
def keys(a): return {e["extendedProperties"]["private"]["dayhubKey"]: e for e in cal(a).values() if (e.get("extendedProperties") or {}).get("private", {}).get("dayhubKey")}


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. a Hub only removes what it put there]")
        a = hub(b, base, T.CRUISE)
        a.js(SEED_FOREIGN); push(a); k = keys(a)
        check("Cruise Hub leaves Day Hub's event alone", "ev:fromday" in k)
        check("...and one from before owners", "ev:oldone" in k)
        check("...and Money Hub's bill", "bill:oldbill" in k)
        a.js("S.events.push({ id: 'c1', day: '2026-10-05', time: '10:00', title: 'Cruise dentist', rep: 'none' }); saveLocal()"); push(a); k = keys(a)
        check("its own plan goes on, marked as its own", k["ev:c1"]["extendedProperties"]["private"].get("dayhubOwner") == "cruisehub", k.get("ev:c1"))
        a.js("S.events = S.events.filter(e => e.id !== 'c1'); saveLocal()"); push(a); k = keys(a)
        check("delete it there and it comes off", "ev:c1" not in k and "ev:fromday" in k)
        a.js("""(() => { const g = JSON.parse(sessionStorage.getItem('__g')); g.d4 = { id: 'd4', summary: 'Mine, old', start: { dateTime: '2026-10-06T10:00:00' }, end: { dateTime: '2026-10-06T11:00:00' }, extendedProperties: { private: { dayhubApp: '1', dayhubKey: 'ev:c2', dayhubHash: 'old' } } }; sessionStorage.setItem('__g', JSON.stringify(g));
             S.events.push({ id: 'c2', day: '2026-10-06', time: '10:00', title: 'Mine, old', rep: 'none' }); saveLocal(); })()"""); push(a); k = keys(a)
        check("one from before owners that it still has: it claims it, no second copy", k["ev:c2"]["extendedProperties"]["private"].get("dayhubOwner") == "cruisehub" and sum(1 for e in cal(a).values() if e.get("summary") == "Mine, old") == 1)
        a.js("""S.events.push({ id: 'c3', day: '2026-10-08', time: '10:00', title: 'Pre-owner', rep: 'none' }); saveLocal()"""); push(a)
        a.js("""(() => { const g = JSON.parse(sessionStorage.getItem('__g')), e = Object.values(g).find(x => x.summary === 'Pre-owner'); delete e.extendedProperties.private.dayhubOwner; e.colorId = '7'; sessionStorage.setItem('__g', JSON.stringify(g)); })()"""); push(a); k = keys(a)
        check("a claim changes the owner only: a colour set in Google stays", k["ev:c3"]["extendedProperties"]["private"].get("dayhubOwner") == "cruisehub" and k["ev:c3"].get("colorId") == "7", k.get("ev:c3"))
        a.js("S.events = S.events.filter(e => e.id !== 'c3'); saveLocal()"); push(a)
        a.js("""(() => { const g = JSON.parse(sessionStorage.getItem('__g')); g.x1 = { id: 'x1', summary: 'Same id', start: { date: '2026-10-09' }, end: { date: '2026-10-10' }, extendedProperties: { private: { dayhubApp: '1', dayhubKey: 'ev:shared', dayhubHash: 'h', dayhubOwner: 'dayhub' } } }; sessionStorage.setItem('__g', JSON.stringify(g)); })()""")
        check("another Hub's event: left with its owner", keys(a)["ev:shared"]["extendedProperties"]["private"]["dayhubOwner"] == "dayhub")
        a.js("S.events = S.events.filter(e => e.id !== 'c2'); saveLocal()"); push(a)
        check("...and can then remove it", "ev:c2" not in keys(a))
        a.close()

        a = hub(b, base, "")
        a.js(SEED_FOREIGN); push(a); k = keys(a)
        check("Day Hub removes its own old event, as it always has", "ev:oldone" not in k)
        check("...and leaves another Hub's alone", "bill:oldbill" in k)
        a.js("S.events.push({ id: 'e9', day: '2026-10-07', time: '09:00', title: 'Vet', rep: 'none' }); saveLocal()"); push(a); k = keys(a)
        check("a plain event still goes on, once", k["ev:e9"]["summary"] == "Vet")
        n = len(cal(a)); push(a)
        check("pushing again changes nothing", len(cal(a)) == n)
        a.close()

        print("\n[2. trips on the calendar: switched off]")
        a = hub(b, base, T.CRUISE)
        check("the switch is off", a.js("SWITCHES.TRAVEL_CAL") is False)
        a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-11-10", "end": "2026-11-15", "line": "Princess", "ship": "Star", "port": "Port Canaveral", "total": "2000", "finalDue": "2026-10-20"})
        a.qa("tport", {"pname": "Nassau", "pday": "2026-11-12", "arrive": "08:00", "allAboard": "16:30", "excursion": "Snorkel", "meet": "09:30", "where": "Pier 1"})
        a.js("closeQA()"); push(a)
        check("off: no trip, port or payment goes to the calendar", not [x for x in keys(a) if x.split(":")[0] in ("tr", "fp", "pt", "ex", "bk")], list(keys(a)))

        print("\n[3. trips on the calendar: switched on]")
        a.js("setOwnerSwitch('TRAVEL_CAL', true)")
        a.js("""(() => { const t = curTrip(); t.bookings = [{ id: 'f1', kind: 'flight', a: 'MCO', b: 'MIA', num: 'AA 12', day: '2026-11-09', t: '08:00', endDay: '2026-11-09', endT: '09:30' },
              { id: 'h1', kind: 'hotel', a: 'Beach Inn', b: '1 Ocean Dr', day: '2026-11-09', t: '15:00', endDay: '2026-11-10', endT: '11:00' }, { id: 'n1', kind: 'dinner', a: 'No date yet' }];
              t.drives = [{ id: 'dv1', day: '2026-11-09', t: '05:00', from: 'Home', to: 'Airport' }]; t.fun = [{ id: 'fn1', day: '2026-11-11', t: '19:00', title: 'Comedy show', pick: 'must', where: 'Theater' }, { id: 'fn2', day: '2026-11-11', t: '10:00', title: 'Just an idea', pick: 'skip' }]; saveLocal(); })()""")
        push(a); k = keys(a); tid = a.js("curTrip().id"); pid = a.js("curTrip().ports[0].id")
        trip = k.get(f"tr:{tid}", {})
        check("the trip: all its days, with its name", "Bahamas" in trip.get("summary", "") and trip.get("start", {}).get("date") == "2026-11-10" and trip.get("end", {}).get("date") == "2026-11-16", trip)
        fp = k.get(f"fp:{tid}", {})
        check("final payment on its day", "Final payment" in fp.get("summary", "") and fp.get("start", {}).get("date") == "2026-10-20", fp)
        pt = k.get(f"pt:{pid}", {})
        check("all aboard on the port's day, its time in the words: no alarm at the wrong hour for a port in another time zone", "ALL ABOARD 4:30 PM" in pt.get("summary", "") and "Nassau" in pt["summary"] and pt["start"].get("date") == "2026-11-12" and "dateTime" not in pt["start"], pt)
        check("...and nothing on the trip carries a clock time", not [x for x, e in k.items() if x.split(":")[0] in ("tr", "fp", "pt", "ex", "bk", "be", "dv", "fn") and "dateTime" in e["start"]], [x for x, e in k.items() if "dateTime" in e["start"]])
        ex = k.get(f"ex:{pid}", {})
        check("the excursion's meeting time", "Snorkel" in ex.get("summary", "") and "9:30 AM" in ex["summary"] and ex["start"]["date"] == "2026-11-12", ex)
        fl = k.get("bk:f1", {})
        check("a flight: departs and lands", "AA 12" in fl.get("summary", "") and "8:00 AM" in fl["summary"] and "lands 9:30 AM" in fl["summary"] and fl["start"]["date"] == "2026-11-09" and "be:f1" not in k, fl)
        check("a hotel: check-in and check-out, with its address", "Check-in" in k["bk:h1"]["summary"] and "Check-out" in k["be:h1"]["summary"] and k["bk:h1"]["location"] == "1 Ocean Dr")
        check("a booking with no date: not sent", "bk:n1" not in k)
        check("a drive", "Home → Airport" in k["dv:dv1"]["summary"])
        check("a plan you picked goes, an idea you skipped doesn't", "Comedy show" in k["fn:fn1"]["summary"] and "fn:fn2" not in k)
        ids = {x: e["id"] for x, e in k.items()}
        a.js("curTrip().bookings[0].t = '09:00'; curTrip().bookings[0].endT = '10:30'; saveLocal()"); push(a); k = keys(a)
        check("change a flight: the same event changes, no second copy", k["bk:f1"]["id"] == ids["bk:f1"] and "9:00 AM" in k["bk:f1"]["summary"])
        a.js("curTrip().bookings = curTrip().bookings.filter(b => b.id !== 'h1'); saveLocal()"); push(a); k = keys(a)
        check("remove the hotel: both its events come off", "bk:h1" not in k and "be:h1" not in k)
        a.js("curTrip().fun[0].pick = 'skip'; saveLocal()"); push(a)
        check("drop a plan: it comes off", "fn:fn1" not in keys(a))
        a.js("curTrip().ports[0].excursion = 'none'; saveLocal()"); push(a)
        check("no excursion now: its event comes off, the port day stays", f"ex:{pid}" not in keys(a) and f"pt:{pid}" in keys(a))
        a.js("curTrip().payments = [{ id: 'p1', amt: 2000, day: '2026-10-01' }]; saveLocal()"); push(a)
        check("paid in full: the final payment comes off", a.js("tripLeft(curTrip())") == 0 and f"fp:{tid}" not in keys(a))
        a.js("setOwnerSwitch('TRAVEL_CAL', false)"); push(a); k = keys(a)
        check("switched back off: nothing is deleted", f"tr:{tid}" in k and f"pt:{pid}" in k)
        a.js("setOwnerSwitch('TRAVEL_CAL', true); curTrip().end = '2026-11-01'; saveLocal()"); push(a); k = keys(a)
        check("Back typed before Leave: one day, and Google can take it", k[f"tr:{tid}"]["end"]["date"] == "2026-11-11", k[f"tr:{tid}"])
        a.js("curTrip().end = '2026-11-15'; S.events.push({ id: 'bad', day: '2026-10-05', time: '10:00', title: 'REFUSE me', rep: 'none' }, { id: 'good', day: '2026-10-06', time: '10:00', title: 'Fine one', rep: 'none' }); saveLocal()"); push(a); k = keys(a)
        check("Google refuses one event: the others still go, and no false 'couldn't reach' message", "ev:good" in k and "ev:bad" not in k and "Couldn't reach" not in a.page.inner_text("#toast") and "couldn't go on your calendar" in a.page.inner_text("#toast"), a.page.inner_text("#toast"))
        a.js("S.events = S.events.filter(e => e.id !== 'bad'); setOwnerSwitch('TRAVEL_CAL', true); S.trips = []; saveLocal()"); push(a); k = keys(a)
        check("delete the trip: everything of it comes off", not [x for x in k if x.split(":")[0] in ("tr", "fp", "pt", "ex", "bk", "be", "dv", "fn")], list(k))
        a.close()

        a = hub(b, base, T.TRIPP if hasattr(T, "TRIPP") else "/../triphub/")
        a.js("setOwnerSwitch('TRAVEL_CAL', true)")
        a.qa("trip", {"tname": "Denver", "start": "2026-11-10", "end": "2026-11-12"}); a.js("closeQA()")
        a.js("curTrip().bookings = [{ id: 'f2', kind: 'flight', a: 'LIT', b: 'DEN', day: '2026-11-10', t: '07:00' }]; saveLocal()"); push(a); k = keys(a)
        check("Trip Hub: the trip and its flight, with a plane not a ship", "✈️" in k[f"tr:{a.js('curTrip().id')}"]["summary"] and "bk:f2" in k, list(k))
        a.close()

        a = hub(b, base, "")
        a.js("setOwnerSwitch('TRAVEL_CAL', true)")
        a.qa("trip", {"ttype": "cruise", "tname": "Day Hub cruise", "start": "2026-11-10", "end": "2026-11-12"}); a.js("closeQA()"); push(a)
        check("Day Hub stays as it was: its trips aren't sent", not [x for x in keys(a) if x.startswith("tr:")], list(keys(a)))
        a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
