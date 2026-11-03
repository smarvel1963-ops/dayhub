"""
SAVE AS: test_hub_leftovers.py   LOCATION: C:/MarvelApps/dayhub/tests/test_hub_leftovers.py

HUB LEFTOVERS (Scott 11/03: "finish what you can on hubs"; the broken lists in the Money, Auto and Trip inventories). A phone holding only one
Hub's own things isn't empty to backup. Every Hub says its own name. Day Hub's 🚪 and its 17-kind + sheet stay in Day Hub, so nothing typed elsewhere
is lost. Trip Hub isn't a ship, and Cruise Hub still is. Drives the real app with the main suite's helpers (fake network, frozen clock).

RUN:   python tests/test_hub_leftovers.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

FAKE_DRIVE = """(cloud) => { window.__up = 0; window.__restored = 0; DTOKEN = 'tok'; DTOKEN_EXP = Date.now() + 3e6; driveSignIn = async () => true; driveDownload = async () => cloud; driveUpload = async () => { window.__up++; };
  const was = restoreFrom; restoreFrom = (c, f) => { window.__restored++; return was(c, f); }; }"""


def open_hub(b, base, path, at="2026-10-01T09:00:00", name="Sam"):
    a = T.App(b, base, path=path, at=at)
    a.page.wait_for_timeout(100)
    if a.js("!!document.querySelector('form[data-setup]')"):
        a.page.fill('form[data-setup] [name=name]', name); a.page.fill('form[data-setup] [name=city]', "80202"); a.page.click('form[data-setup] button'); a.page.wait_for_timeout(300)
    elif a.js("!!document.querySelector('form[data-mhsetup]')"):
        a.page.fill('form[data-mhsetup] [name=name]', name); a.page.click('form[data-mhsetup] button'); a.page.wait_for_timeout(200)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    return a

def kinds(a): return [k for k, _ in a.js("qaTypes()")]


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. a Hub's own things count as data]")
        a = open_hub(b, base, "")
        for label, d in [("cars", "{garage:{cars:[{id:'c'}]}}"), ("money accounts", "{mh:{accounts:[{id:'a'}]}}"), ("transactions", "{mh:{tx:[{id:'t'}]}}"), ("subscriptions", "{mh:{subs:[{id:'s'}]}}"),
                         ("a room with something in it", "{house:{spaces:[{items:[{id:'i'}]}]}}"), ("a room with a note", "{house:{spaces:[{items:[],tasks:[],notes:'paint'}]}}"), ("meds", "{hh:{meds:[{id:'m'}]}}"), ("upkeep", "{upkeep:[{id:'u'}]}"), ("birthdays", "{people:[{id:'p'}]}"), ("a payday", "{payday:{freq:'weekly'}}"), ("a budget", "{mh:{budgets:{food:100}}}"),
                         ("the emergency card", "{hh:{card:{allergies:'peanuts',contacts:[]}}}"), ("water logged", "{hh:{water:{'2026-10-01':3}}}"), ("routines", "{routines:[{id:'r'}]}"), ("alarms", "{alarms:[{id:'a'}]}")]:
            check(f"{label}: not empty to backup", a.js(f"backupHasData({d})") is True)
        for label, d in [("nothing at all", "{}"), ("set-up rooms with nothing in them", "{house:{spaces:[{items:[],tasks:[],notes:''}]}}"), ("Hub set-up records", "{mh:{accounts:[],tx:[],subs:[],setup:'2026-10-01'},garage:{cars:[]},hh:{setup:true,meds:[]}}")]:
            check(f"{label}: empty", a.js(f"backupHasData({d})") is False)
        check("the old kinds still count", a.js("backupHasData({todos:[{}]})") is True and a.js("backupHasData({lists:[{items:[{}]}]})") is True)
        check("the brief and the rest ask the old question, unchanged", a.js("hasData({garage:{cars:[{}]}})") is False and a.js("hasData({todos:[{}]})") is True)
        a.close()

        print("\n[2. backup won't upload over a Drive copy like that]")
        CLOUD = "{ savedAt: '2026-09-30T12:00:00Z', data: { name: 'Sam', garage: { cars: [{ id: 'c1', name: 'Truck', year: 2020, make: 'Ford', model: 'F-150' }] } } }"
        a = open_hub(b, base, T.AUTOP)
        a.js("setOwnerSwitch('OWNER', true)")
        a.page.evaluate(f"({FAKE_DRIVE})({CLOUD})")
        a.js("S.garage = { cars: [] }; S.todos = []; saveLocal()")
        a.page.evaluate("async () => { await syncOn(); }"); a.page.wait_for_timeout(250)
        check("new Auto Hub phone, Drive copy of cars only: restores it, uploads nothing", a.js("__restored") == 1 and a.js("__up") == 0, a.js("[__restored, __up]"))
        check("...the truck is back", a.js("S.garage.cars.length") == 1)
        a.close()
        a = open_hub(b, base, T.AUTOP)
        a.js("setOwnerSwitch('OWNER', true)")
        a.page.evaluate(f"({FAKE_DRIVE})({CLOUD})")
        a.js("S.garage = { cars: [{ id: 'c2', name: 'Van' }] }; S.sync.last = null; saveLocal()")
        a.page.evaluate("async () => { await syncOn(); }"); a.page.wait_for_timeout(250)
        check("a phone with its own car and a different Drive copy: asks, uploads nothing", a.js("__up") == 0 and a.js("__restored") == 0 and a.js("!!CLOUD_PENDING"), a.js("[__up, __restored]"))
        a.close()
        a = open_hub(b, base, T.MONEYP)
        a.js("setOwnerSwitch('OWNER', true)")
        a.page.evaluate(f"({FAKE_DRIVE})({{ savedAt: '2026-09-30T12:00:00Z', data: {{ name: 'Sam', mh: {{ accounts: [{{ id: 'a1', kind: 'checking', name: 'Checking', bal: 900 }}], tx: [], subs: [] }} }} }})")
        a.js("S.mh = { accounts: [], tx: [], subs: [], setup: '2026-10-01' }; saveLocal()")
        a.page.evaluate("async () => { await syncOn(); }"); a.page.wait_for_timeout(250)
        check("Money Hub, the same", a.js("__restored") == 1 and a.js("__up") == 0 and a.js("S.mh.accounts.length") == 1, a.js("[__restored, __up]"))
        a.close()
        a = open_hub(b, base, T.AUTOP)
        a.js("setOwnerSwitch('OWNER', true)")
        a.page.evaluate(f"({FAKE_DRIVE})({CLOUD})")
        a.js("S.garage = { cars: [{ id: 'c4', name: 'Mine' }] }; S.sync = { on: true, last: '2026-09-01T00:00:00Z', dirty: false }; saveLocal()")
        a.page.evaluate("async () => { await syncDrive(); }"); a.page.wait_for_timeout(250)
        check("opening with a newer copy of only cars, and a car of its own: asks, replaces nothing", a.js("S.garage.cars[0].name") == "Mine" and a.js("__restored") == 0 and a.js("!!CLOUD_PENDING") and "different copy" in a.page.inner_text("#toast"), a.js("S.garage.cars"))
        a.close()
        for name, path, cloud in [("Auto Hub", T.AUTOP, CLOUD), ("Money Hub", T.MONEYP, "{ savedAt: '2026-09-30T12:00:00Z', data: { name: 'Sam', mh: { accounts: [{ id: 'a1', kind: 'checking', name: 'Checking', bal: 900 }], tx: [], subs: [] } } }"),
                                  ("Home Hub", T.HOMEP, "{ savedAt: '2026-09-30T12:00:00Z', data: { name: 'Sam', house: { type: 'house', spaces: [{ id: 's1', name: 'Kitchen', items: [{ id: 'i1', name: 'Fridge' }], tasks: [], notes: '' }] } } }")]:
            a = open_hub(b, base, path)
            a.js("setOwnerSwitch('OWNER', true)")
            a.page.evaluate(f"({FAKE_DRIVE})({cloud})")
            a.js("S.garage = { cars: [] }; S.mh = { accounts: [], tx: [], subs: [] }; S.house = { type: '', spaces: [] }; S.todos = [{ id: 't1', title: 'Mine', done: false, rep: 'none', day: today() }]; S.bills = [{ id: 'b1', name: 'Rent', amount: 500, day: 5 }]; S.sync = { on: true, last: '2026-09-01T00:00:00Z', dirty: false }; saveLocal()")
            a.page.evaluate("async () => { await syncDrive(); }"); a.page.wait_for_timeout(250)
            check(f"{name}, a phone with only to-dos and bills, a newer copy of only its own things: asks, replaces nothing", a.js("S.bills.length") == 1 and a.js("S.todos.length") == 1 and a.js("__restored") == 0 and a.js("!!CLOUD_PENDING"), a.js("[__restored, S.bills.length]"))
            if name == "Auto Hub":
                a.js("S.todos.push({ id: 't2', title: 'Edit while it asks', done: false, rep: 'none', day: today() }); scheduleBackup()"); a.page.wait_for_timeout(6400)
                check("...and an edit while it asks doesn't upload over the copy in question", a.js("__up") == 0, a.js("__up"))
            a.close()
        a = open_hub(b, base, T.AUTOP)
        a.js("setOwnerSwitch('OWNER', true)")
        a.page.evaluate(f"({FAKE_DRIVE})({{ savedAt: '2026-09-30T12:00:00Z', data: {{ name: 'Sam', todos: [{{ id: 'x', title: 'From my other phone', done: false, rep: 'none', day: '2026-10-01' }}] }} }})")
        a.js("S.sync = { on: true, last: '2026-09-01T00:00:00Z', dirty: false }; saveLocal()")
        a.page.evaluate("async () => { await syncDrive(); }"); a.page.wait_for_timeout(250)
        check("a newer copy with plain to-dos still comes in by itself, as it always has", a.js("__restored") == 1, a.js("__restored"))
        a.close()
        a = open_hub(b, base, T.AUTOP)
        a.js("setOwnerSwitch('OWNER', true); S.garage = { cars: [{ id: 'c3', name: 'Van' }] }; saveLocal(); render()"); T.hero(a)
        check("Auto Hub with only a car gets the 'Not backed up' reminder", "Not backed up" in a.page.inner_text("#hero"), a.page.inner_text("#hero")[:200])
        a.close()
        a = open_hub(b, base, "/../healthhub/")
        a.js("setOwnerSwitch('OWNER', true); hh().meds.push({ id: 'm1', name: 'Vitamin', times: [] }); saveLocal(); render()"); T.hero(a)
        check("Health Hub, which says everything stays on this phone, doesn't nag", "Not backed up" not in a.page.inner_text("#hero"))
        a.close()

        print("\n[3. every Hub says its own name]")
        HUBS = [("Money Hub", T.MONEYP), ("Auto Hub", T.AUTOP), ("Home Hub", T.HOMEP), ("Trip Hub", T.TRIP), ("Cruise Hub", T.CRUISE)]
        for name, path in HUBS:
            a = open_hub(b, base, path)
            a.js("(() => { window.__said = []; notify = (t, b) => { window.__said.push(String(t) + ' ' + String(b || '')); }; })()")
            a.page.evaluate("() => { const u = navigator.userAgent; Object.defineProperty(navigator, 'userAgent', { get: () => 'iPhone' }); }")
            a.js("openSettings()"); a.page.wait_for_timeout(120); a.js("drawInstallBox()")
            box = a.js("(document.getElementById('installBox') || {}).innerText || ''")
            check(f"{name}: the install steps", "Day Hub" not in box and (name in box or box == ""), box[:120])
            ics = a.js("(S.events.push({ id: 'zz', day: '2026-10-05', time: '10:00', title: 'X', rep: 'none' }), icsFor('events:zz').ics || JSON.stringify(icsFor('events:zz')))")
            check(f"{name}: the calendar file", "Day Hub" not in ics, ics[:100])
            a.js("S.events = S.events.filter(e => e.id !== 'zz'); closeSettings()")
            a.close()
        a = open_hub(b, base, "")
        a.js("(() => { Object.defineProperty(navigator, 'userAgent', { get: () => 'iPhone' }); })(); openSettings()"); a.page.wait_for_timeout(120); a.js("drawInstallBox()")
        check("Day Hub still says Day Hub", "Open Day Hub" in a.js("document.getElementById('installBox').innerText"))
        a.close()

        print("\n[4. Day Hub's own buttons stay in Day Hub]")
        for name, path in [("Money Hub", T.MONEYP), ("Auto Hub", T.AUTOP), ("Home Hub", T.HOMEP)]:
            a = open_hub(b, base, path, at="2026-10-01T08:00:00"); T.hero(a)
            check(f"{name}: no 🚪 button or chip that leads nowhere", not a.js("!!document.querySelector('#hero [data-leave]')"), a.page.inner_text("#hero")[:120])
            a.close()
        a = open_hub(b, base, "", at="2026-10-01T08:00:00"); T.hero(a)
        check("Day Hub keeps its 🚪 and its chip", a.js("!!document.querySelector('#hero .icon-btn[data-leave]')") and a.js("!!document.querySelector('#hero .chip[data-leave]')"))
        check("Day Hub's + sheet keeps all 17", len(kinds(a)) == 17 and "spend" in kinds(a), kinds(a))
        a.close()
        a = open_hub(b, base, T.MONEYP); k = kinds(a)
        check("Money Hub's + sheet: no Spending to lose, its bills stay", "spend" not in k and "package" not in k and "bill" in k and "todo" in k, k)
        a.close()
        a = open_hub(b, base, T.AUTOP); k = kinds(a)
        check("Auto Hub's + sheet: what it has a card for", set(k) == {"dump", "todo", "item", "bill", "list"}, k)
        a.js("document.getElementById('fab') && document.getElementById('fab').click()"); a.page.wait_for_timeout(120)
        if a.js("!!document.getElementById('fab')"):
            check("...and the + opens something it offers, with its tab lit", a.js("QA_TYPE") == "todo" and a.js("!!document.querySelector('#qaTypes .on')"), a.js("QA_TYPE"))
        a.js("closeQA(); openQA('dump'); DUMP = [{ kind: 'note', title: 'An idea' }, { kind: 'event', title: 'Call Dan', day: '2026-10-05', time: '14:00' }]; drawDump()"); a.page.wait_for_timeout(80)
        opts = a.js("[...document.querySelectorAll('#dumpOut select')[0].options].map(o => o.value)")
        check("...the brain dump only offers what it can keep, and says what it'll do", "note" not in opts and "future" not in opts and "event" in opts and a.js("document.querySelectorAll('#dumpOut select')[0].value") == "todo", opts)
        a.js("DUMP = [{ kind: 'note', title: 'An idea' }, { kind: 'future', title: 'Later thought' }, { kind: 'event', title: 'Call Dan', day: '2026-10-05', time: '14:00', rep: 'none' }, { kind: 'item', title: 'Oil' }]; dumpAdd(); save(); closeQA(); render()")
        check("...an idea with no card becomes a to-do, not lost", a.js("['An idea', 'Later thought'].every(t => S.todos.some(x => x.title === t))") and a.js("S.lists[0].items.some(i => i.text === 'Oil')") and not a.js("S.notes.length") and not a.js("S.future.length"), a.js("S.todos.map(x => x.title)"))
        check("...a reminder stays a reminder, with its date and time", a.js("(e => !!e && e.day === '2026-10-05' && e.time === '14:00')(S.events.find(e => e.title === 'Call Dan'))"), a.js("S.events"))
        a.js("(() => { S.remind.on = true; openSettings(); })()"); a.page.wait_for_timeout(120)
        check("...and no Nightly reset setting where there's no Nightly reset", not a.js("!!document.querySelector('[data-rset=night]')")); a.js("closeSettings()")
        a.close()
        a = open_hub(b, base, T.HOMEP); k = kinds(a)
        check("Home Hub's + sheet: and its upkeep", "upkeep" in k and "bill" in k and "spend" not in k and "return" not in k, k)
        a.close()
        a = open_hub(b, base, T.MONEYP); a.js("openSettings()"); a.page.wait_for_timeout(120); fam = a.js("document.getElementById('famBox').innerText")
        check("Money Hub's family switch says all it covers", "Count my other Hubs" in fam and "Day Hub trip payments" in fam, fam[:200])
        a.js("closeSettings()"); a.close()
        a = open_hub(b, base, T.AUTOP); a.js("openSettings()"); a.page.wait_for_timeout(120); fam = a.js("document.getElementById('famBox').innerText")
        check("Auto Hub: Day Hub's trips do show here, so the switch to stop them stays", "trips here" in fam and a.js("!!document.querySelector('#famBox [data-fam]')") and "Money Hub" in fam, fam[:200])
        a.js("closeSettings()"); a.close()

        DAYFILE = "new File([JSON.stringify({ app: 'dayhub', v: '1', savedAt: '2026-09-30T12:00:00Z', data: { name: 'Other', todos: [{ id: 'x', title: 'Day thing' }] } })], 'dayhub.json')"
        a = open_hub(b, base, T.HOMEP)
        a.js("S.house = { type: 'house', spaces: [{ id: 's1', name: 'Kitchen', items: [{ id: 'i1', name: 'Fridge' }], tasks: [], notes: '' }] }; saveLocal()")
        a.js(f"importData({DAYFILE})"); a.page.wait_for_timeout(250)
        check("a Day Hub backup file can't empty Home Hub's rooms", a.js("S.house.spaces.length") == 1 and not a.js("S.todos.some(t => t.title === 'Day thing')") and "Day Hub backup" in a.page.inner_text("#toast"), a.page.inner_text("#toast"))
        a.js("S.remind.on = true; S.remind.night = 1260; saveLocal()")
        check("Home Hub sends no Nightly reset reminder", not a.js("reminderList().some(r => /Nightly reset/.test(r.title))"))
        a.close()
        a = open_hub(b, base, "")
        a.js("S.remind.on = true; S.remind.night = 1260; saveLocal()")
        check("Day Hub still does", a.js("reminderList().some(r => /Nightly reset/.test(r.title))"), a.js("reminderList().map(r => r.title)"))
        a.js("importData(new File([JSON.stringify({ app: 'dayhub', v: '1', savedAt: '2026-09-30T12:00:00Z', data: { name: 'Sam', todos: [{ id: 'y', title: 'From the file', done: false, rep: 'none', day: '2026-10-01' }] } })], 'dayhub.json'))"); a.page.wait_for_timeout(250)
        check("a Hub still loads its own file", a.js("S.todos.some(t => t.title === 'From the file')"), a.js("S.todos.map(t => t.title)"))
        a.js("importData(new File([JSON.stringify({ app: 'cruisehub', v: '1', savedAt: '2026-09-30T12:00:00Z', data: { name: 'Other' } })], 'cruisehub.json'))"); a.page.wait_for_timeout(250)
        check("...and not Cruise Hub's over its own", a.js("S.name") == "Sam" and "Cruise Hub backup" in a.page.inner_text("#toast"), a.page.inner_text("#toast"))
        a.close()
        a = open_hub(b, base, T.CRUISE)
        a.js("importData(new File([JSON.stringify({ app: 'dayhub', v: '1', savedAt: '2026-09-30T12:00:00Z', data: { name: 'Sam', trips: [{ id: 't1', type: 'cruise', name: 'From Day Hub', start: '2026-11-01', end: '2026-11-05', lists: {}, payments: [], spends: [], ports: [], perks: [] }] } })], 'dayhub.json'))"); a.page.wait_for_timeout(250)
        check("Cruise Hub still takes a Day Hub file's cruises", a.js("S.trips.some(t => t.name === 'From Day Hub')"), a.js("S.trips.map(t => t.name)"))
        a.close()

        print("\n[5. Trip Hub isn't a ship]")
        a = open_hub(b, base, T.TRIP, name="Pat")
        a.js("showHelp()"); a.page.wait_for_timeout(100); t = a.page.inner_text("#helpSheet")
        check("Help before any trip: no ship", "BACK TO SHIP" not in t and "GET TO THE SHIP" not in t and "MEDICAL" in t, t[:160])
        a.js("showHelp('contacts')"); a.page.wait_for_timeout(100)
        check("...and no 'plan a cruise'", "cruise" not in a.page.inner_text("#helpSheet").lower(), a.page.inner_text("#helpSheet")[:120])
        a.js("document.getElementById('helpSheet').classList.add('hidden'); openQA('trip')"); a.page.wait_for_timeout(100)
        form = a.page.inner_text("#qaForm")
        check("the trip form: no Cruise choice, an airline not a cruise line", a.js("![...document.querySelectorAll('#qaForm [name=ttype] option')].some(o => o.value === 'cruise')") and a.js("document.querySelector('#qaForm [name=line]').placeholder") == "Airline (optional)" and "Day Hub" not in form, form[:120])
        a.js("closeQA()")
        a.qa("trip", {"tname": "Miami", "start": "2026-10-02", "end": "2026-10-06", "port": "Miami, FL", "total": "900"}); a.js("closeQA()")
        check("the trip saves as a trip", a.js("curTrip().type") == "trip")
        check("the list and bag say so", a.js("TRIP_LISTS.embark") == "Travel day" and "Day bag" in a.js("BAGS[2][1]"))
        day = a.js("(showDay(curTrip().start), document.getElementById('daySheet').innerText)")
        check("no cruise-terminal tips for a land trip to a cruise city", "GOOD TO KNOW AT" not in day.upper(), day[:160]); a.js("document.getElementById('daySheet').classList.add('hidden')")
        a.js("showForget()"); a.page.wait_for_timeout(100); t = a.page.inner_text("#forgetSheet") if a.js("!!document.getElementById('forgetSheet')") else a.js("document.querySelector('.sheet:not(.hidden)').innerText")
        check("Tomorrow's check: no cabin", "cabin" not in t.lower(), t[:180]); a.js("document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'))")
        check("+ sheet: Spending goes on the trip", "tspend" in kinds(a) and "spend" not in kinds(a), kinds(a))
        a.js("openQA('tspend')"); a.page.wait_for_timeout(100); a.page.fill('#qaForm [name=amt]', "25")
        if a.js("!!document.querySelector('#qaForm [name=what]')"): a.page.fill('#qaForm [name=what]', "Lunch")
        a.page.click("#qaForm button.btn:last-of-type"); a.page.wait_for_timeout(150)
        check("...and it's there", a.js("(curTrip().spends || []).reduce((n, x) => n + Number(x.amt), 0)") == 25, a.js("curTrip().spends"))
        a.js("closeQA()")
        a.js("showReady()"); a.page.wait_for_timeout(120); a.page.click('[data-readygo]'); a.page.wait_for_timeout(200)
        check("Open my trip goes to the trip", a.js("TAB") == "plan" and a.js("!!document.querySelector('#cards [data-card=\"trips\"]')"), a.js("TAB"))
        a.close()
        a = open_hub(b, base, T.TRIP, at="2026-10-05T18:00:00", name="Pat")
        a.qa("trip", {"tname": "Miami", "start": "2026-10-02", "end": "2026-10-06", "port": "Miami, FL"}); a.js("closeQA()")
        a.js("showForget()"); a.page.wait_for_timeout(100); t = a.js("document.querySelector('.sheet:not(.hidden)').innerText")
        check("the last night: no ship account", "ON BOARD" not in t.upper() and "ship account" not in t.lower() and "LAST NIGHT" in t.upper(), t[:160]); a.js("document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'))")
        a.close()
        a = open_hub(b, base, T.TRIP, at="2026-10-20T09:00:00", name="Pat")
        a.qa("trip", {"tname": "Miami", "start": "2026-10-02", "end": "2026-10-06"}); a.js("closeQA(); shellGo('home')"); a.page.wait_for_timeout(120)
        bb = a.js("bigButton(curTrip())")
        check("after the trip: the button goes to the wrap-up, not Packing", "planview=\"diary\"" in bb["act"] and "AFTER THE TRIP" in bb["label"], bb)
        a.close()

        print("\n[6. Cruise Hub still is a ship]")
        a = open_hub(b, base, T.CRUISE)
        a.js("showHelp()"); a.page.wait_for_timeout(100)
        check("Help before any cruise: back to the ship", "BACK TO SHIP" in a.page.inner_text("#helpSheet")); a.js("document.getElementById('helpSheet').classList.add('hidden')")
        a.js("openQA('trip')"); a.page.wait_for_timeout(100)
        check("the Cruise choice and the cruise lines", a.js("[...document.querySelectorAll('#qaForm [name=ttype] option')].some(o => o.value === 'cruise')") and a.js("document.querySelector('#qaForm [name=line]').getAttribute('list')") == "lineList"); a.js("closeQA()")
        a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-10-02", "end": "2026-10-06", "line": "Princess", "port": "Port Canaveral"}); a.js("closeQA()")
        check("the Sail day list, the Port bag", a.js("TRIP_LISTS.embark") == "Sail day" and "Port bag" in a.js("BAGS[2][1]"))
        day = a.js("(showDay(curTrip().start), document.getElementById('daySheet').innerText)")
        check("the terminal tips", "GOOD TO KNOW AT" in day.upper(), day[:160]); a.js("document.getElementById('daySheet').classList.add('hidden')")
        a.close()
        a = open_hub(b, base, T.CRUISE, at="2026-10-05T18:00:00")
        a.qa("trip", {"ttype": "cruise", "tname": "Bahamas", "start": "2026-10-02", "end": "2026-10-06", "line": "Princess", "port": "Port Canaveral"}); a.js("closeQA()")
        a.js("showForget()"); a.page.wait_for_timeout(100); t = a.js("document.querySelector('.sheet:not(.hidden)').innerText")
        check("the last night on board, with the ship account", "LAST NIGHT ON BOARD" in t.upper() and "ship account" in t.lower(), t[:160])
        a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
