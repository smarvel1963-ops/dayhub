"""
SAVE AS: test_restore_file.py   LOCATION: C:/MarvelApps/dayhub/tests/test_restore_file.py

LOAD A BACKUP FILE, IN EVERY HUB (Scott 11/04: "Yes, fix it"). Health Hub's own file listener ran first and emptied the file box, so the restore in
ui.js found nothing and "Load a backup file" silently did nothing. Auto Hub and Money Hub had the same listener problem. Making restore reachable there
opened what restore did next, and the review held it for that. What this proves:
- Every Hub downloads a real backup with its own button, loses the thing, and gets it back with a real tap on Load a backup file.
- A wrong or damaged file says so and changes nothing, on screen and in storage. Closing Settings doesn't write the old name back. Undo works.
- Health, Money and Auto Hub: an older file never hides a newer photo, a new phone shows no empty rows, and the file's rows come back when the photo really
  is on this phone (Start fresh, older file then newer file). The message shows only for photos really elsewhere, and keeps Undo.
- Reminders and the AI's access to notes stay this phone's own choice, on file and Drive restores. Only the background sync's own restore is quiet.
- In those three Hubs, one field or keyed-record name at a time, as text, wrapped in an array, or a list swapped for a look-alike: nothing runs on the Hub's home, its listed tabs or the
  edit forms named in FUZZ. That is a set of records and screens, not every path.
- Day Hub, Cruise Hub (classic and new look), Trip Hub, Home Hub (section 10): the same one-field-at-a-time run over the screens and clocks listed in OTHERS, plus the other Hub's trips and a real file.
  A date or a time also gets a bad value that still reads as one, because a value that doesn't sort like a date never reaches the branches that compare dates. An independent review found two sinks only that form reaches.
  Each Hub first proves the detector goes off on a raw value and that the records draw with nothing thrown. A field is redrawn on the screens that read it in a clean draw; each Hub prints the fields no listed
  screen reads, which were NOT tried. Hub Universe gets one all-at-once check only, across the 7 stores it reads.
  NOT covered here: screens reached only by a tap that isn't listed (those were crawled by hand with every field bad at once, not by this test), Family Hub, values that come straight off the network (weather,
  an AI reply, an email, a Drive copy) except as saved fields, and a value that only draws alongside some other kind of record than the ones in these sets. A bad value that makes a draw throw stops that draw there (each Hub
  prints how many), and a field read only on a clock that drew the same page as an earlier one, numbers aside, shows up as not tried. Passing means these records on these screens, not every path.
- Honest values with quotes and brackets are untouched, and form values round-trip.
Drives the real app with the main suite's helpers (fake network, frozen clock).

RUN:   python tests/test_restore_file.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.   Add "payload" for only the payload runs, "others" for only section 10.
"""
import copy, json, os, re, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}", flush=True)
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}", flush=True)

PNG1 = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")
PIC = {"name": "pic.png", "mimeType": "image/png", "buffer": PNG1}

# what each Hub keeps of its own: how to add it, how to take it away, how to see it's there, a word that shows on screen
OWN = {
    "Health Hub": ("S.hh = S.hh || {}; S.hh.setup = S.hh.setup || true; S.hh.card = S.hh.card || {}; S.hh.card.allergies = 'peanuts'; S.hh.card.contacts = S.hh.card.contacts || []",
                   "S.hh.card.allergies = ''",
                   "S.hh.card.allergies === 'peanuts'", ""),
    "Money Hub": ("S.mh = S.mh || {}; S.mh.setup = S.mh.setup || true; S.mh.accounts = S.mh.accounts || []; S.mh.accounts.push({ id: 'a1', name: 'Checking', kind: 'checking', bal: 100 })",
                  "S.mh.accounts = S.mh.accounts.filter(x => x.id !== 'a1')",
                  "S.mh.accounts.some(x => x.id === 'a1')", "Checking"),
    "Auto Hub": ("S.garage = S.garage || { cars: [] }; S.garage.cars.push({ id: 'c1', name: 'Truck', year: 2020, make: 'Ford', model: 'F-150' })",
                 "S.garage.cars = S.garage.cars.filter(x => x.id !== 'c1')",
                 "S.garage.cars.some(x => x.id === 'c1')", "F-150"),
}
HUBS = [("Day Hub", ""), ("Cruise Hub", T.CRUISE), ("Trip Hub", T.TRIP), ("Home Hub", T.HOMEP), ("Auto Hub", T.AUTOP),
        ("Money Hub", T.MONEYP), ("Health Hub", T.HEALTHP), ("Hub Universe", T.UNIP)]
THREE = (("Health Hub", T.HEALTHP), ("Money Hub", T.MONEYP), ("Auto Hub", T.AUTOP))
tmp = tempfile.mkdtemp(prefix="restore_")


def open_hub(b, base, path, at="2026-10-01T09:00:00"):
    a = T.App(b, base, path=path, at=at)
    a.page.wait_for_timeout(100)
    for form in ("form[data-setup]", "form[data-homesetup]", "form[data-mhsetup]", "form[data-hhsetup]"):
        if a.js(f"!!document.querySelector('{form}')"):
            for name, val in (("name", "Sam"), ("city", "80202")):
                if a.js(f"!!document.querySelector('{form} [name={name}]')"): a.page.fill(f"{form} [name={name}]", val)
            a.page.click(f"{form} button"); a.page.wait_for_timeout(200)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    return a

def toast_text(a):
    return a.js("(document.getElementById('toast') || {}).textContent || ''")

def clear_sheets(a):
    a.js("['hhSheet', 'mhSheet', 'autoSheet'].forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); })")

def download(a, file_name):
    clear_sheets(a); a.js("openSettings()"); a.page.wait_for_timeout(100)
    with a.page.expect_download() as dl:
        a.page.click('[data-data="export"]')
    p = os.path.join(tmp, file_name); dl.value.save_as(p)
    a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(100)
    return p

def load(a, path):
    """The way a person does it: open Settings, tap the button, pick the file."""
    clear_sheets(a); a.js("openSettings()"); a.page.wait_for_timeout(100)
    with a.page.expect_file_chooser() as fc:
        a.page.click('[data-data="import"]')
    fc.value.set_files(path)
    a.page.wait_for_timeout(350)


# ------------------------------------------------------------ a full set of records for the one-field-at-a-time test
HEALTH = {"name": "Sam", "city": "80202", "hh": {"setup": "2026-01-01",
  "meds": [{"id": "m1", "name": "Med", "strength": "10mg", "times": ["08:00", "20:00"], "instr": "with food", "left": 30, "per": 1, "refills": 2, "pharmacy": "Pharm", "prescriber": "Dr", "rx": "123", "doctor": "Dr", "purpose": "p", "color": "#ff0000", "start": "2026-01-01", "added": "2026-01-01", "addedT": "08:00"}],
  "workouts": [{"id": "w1", "date": "2026-09-30", "type": "walk", "min": 30, "sets": 3, "reps": 10, "wt": 20, "note": "n"}, {"id": "w2", "date": "2026-10-01", "type": "walk", "min": 20, "sets": 2, "reps": 8, "wt": 15, "note": "n"}],
  "sleep": [{"id": "s1", "date": "2026-09-30", "bed": "22:00", "wake": "06:00", "hrs": 8, "q": 4, "note": "n"}, {"id": "s2", "date": "2026-10-01", "bed": "22:30", "wake": "06:30", "hrs": 8, "q": 3, "note": "n"}],
  "vitals": [{"id": "v1", "date": "2026-09-30", "time": "08:00", "kind": "bp", "sys": 120, "dia": 80, "note": "n"}, {"id": "v2", "date": "2026-09-29", "time": "08:00", "kind": "glucose", "v": 100, "note": "n"}, {"id": "v3", "date": "2026-10-01", "time": "08:00", "kind": "weight", "v": 180}],
  "appts": [{"id": "ap1", "date": "2026-10-05", "time": "09:00", "doctor": "Dr", "specialty": "sp", "reason": "r", "where": "Clinic", "bring": "b", "q": [{"id": "q1", "text": "q"}], "notes": "n"}],
  "vault": [{"id": "vv1", "type": "insurance", "title": "t", "date": "2026-09-30"}], "chal": {"code": "ABC", "nick": "Sam"},
  "medlog": [{"date": "2026-09-30", "text": "t"}], "doses": {"2026-10-01": {"m1|08:00": {"s": "taken", "at": "08:05"}}}, "water": {"2026-10-01": 3}, "steps": {"2026-10-01": 5000},
  "checkins": {"2026-10-01": {"mood": 3, "energy": 3, "note": "n", "sym": ["headache"]}}, "goals": {"water": 8, "steps": 6000, "sleep": 8},
  "card": {"allergies": "a", "conditions": "c", "blood": "O+", "hospital": "h", "doctor": "d", "notes": "n", "contacts": [{"name": "n", "rel": "r", "phone": "5551212"}]}}}
MONEY = {"name": "Sam", "city": "80202", "bills": [{"id": "b1", "name": "Rent", "amount": 900, "day": 15, "paid": "2026-09", "auto": False, "cat": "bills", "url": ""}],
  "goals": [{"id": "g1", "name": "Trip", "target": 1000, "saved": 100, "icon": "💰", "by": "2027-01-01", "pic": ""}],
  "payday": {"freq": "biweekly", "next": "2026-10-09", "amount": 1500, "d1": 1, "d2": 15},
  "mh": {"setup": "2026-01-01", "accounts": [{"id": "a1", "kind": "checking", "name": "Checking", "bal": 100, "apr": 0, "min": 0, "at": "2026-10-01", "web": "bank.com", "src": "manual"}, {"id": "a2", "kind": "credit", "name": "Card", "bal": 500, "apr": 20, "min": 25, "at": "2026-09-01"}],
  "tx": [{"id": "t1", "date": "2026-09-30", "amt": -20, "what": "Food", "cat": "food", "acct": "a1", "src": "scan"}, {"id": "t2", "date": "2026-09-25", "amt": 1500, "what": "Pay", "cat": "pay", "acct": "a1"}],
  "subs": [{"id": "s1", "name": "Stream", "amt": 10, "every": "month", "next": "2026-10-10", "cat": "fun"}],
  "budgets": {"food": 200, "fun": 100}, "plan": {"start": 100, "check": 1000, "bills": 500, "other": 100, "save": 200}, "debt": {"extra": 25, "method": "avalanche"}, "payCash": 300, "payCheck": 1500,
  "vault": [{"id": "dv1", "type": "tax", "title": "t", "date": "2026-09-30"}]}}
AUTO = {"name": "Sam", "city": "80202", "garage": {"gas": 3.5, "cars": [{"id": "c1", "nick": "T", "year": 2020, "make": "Ford", "model": "F-150", "trim": "XL", "engine": "V8", "vin": "1FA6P8CF0L5100001", "miles": 30000, "paid": 30000, "price": 25000, "boughtOn": "2020-01-01", "body": "Pickup", "thumb": "data:image/jpeg;base64,AAAA", "cover": "p1", "every": {"oil": [5000, 6]},
    "services": [{"id": "sv1", "kind": "oil", "date": "2026-09-01", "miles": 29000, "cost": 50, "note": "n"}], "fuel": [{"id": "f1", "date": "2026-09-20", "miles": 29800, "gal": 10, "cost": 30}, {"id": "f2", "date": "2026-09-27", "miles": 30000, "gal": 11, "cost": 33}],
    "odo": [{"id": "o1", "date": "2026-09-27", "miles": 30000}], "papers": [{"id": "pp1", "kind": "insurance", "name": "Ins", "expires": "2026-12-01", "cost": 100, "paid": "2026-01-01", "ref": "r", "note": "n"}],
    "extras": [{"id": "e1", "name": "Mod", "cat": "other", "cost": 10, "status": "installed", "date": "2026-09-01", "note": "n"}], "notes": [{"id": "n1", "date": "2026-09-01", "text": "n"}], "photos": [{"id": "p1", "tag": "car", "date": "2026-09-01", "cap": "c"}],
    "mech": [{"id": "me1", "date": "2026-09-01", "q": "q", "code": "P0300", "a": {"urgency": "soon", "summary": "s", "causes": [{"cause": "c", "why": "w", "likely": "high", "diy": "easy", "cost": "$50"}], "check": "c", "shop": "s"}}, {"id": "me2", "date": "2026-08-01", "q": "q2", "a": {"urgency": "watch", "summary": "s", "causes": [{"cause": "c", "why": "w", "likely": "low", "diy": "shop", "cost": "$9"}], "check": "c", "shop": "s"}}],
    "recalls": {"list": [{"id": "r1", "part": "part", "summary": "sum", "remedy": "fix", "park": True}], "at": "2026-10-01"}, "recallDone": {"r1": True}, "tripCheck": {"tires": True}}]}}
# name, address, records, how to open a screen, the car to open, the edit forms (name, js) on top of the home screen and every listed tab
FUZZ = [("Health Hub", T.HEALTHP, HEALTH, "showHh", None, [("medicine form", "HH_EDIT = 'm1'; showHh('meds'); HH_EDIT = null"), ("appointment form", "HH_APEDIT = 'ap1'; showHh('appts'); HH_APEDIT = null"),
                                                           ("open appointment", "HH_AP = 'ap1'; showHh('appts'); HH_AP = null"), ("visit summary", "HH_VISIT = 'ap1'; showHh('visit'); HH_VISIT = null")]),
        ("Money Hub", T.MONEYP, MONEY, "showMh", None, [("bill form", "MH_PEDIT = 'b1'; showMh('bills'); MH_PEDIT = null"), ("sign-in link form", "MV_WEB = 'a1'; showMh('update'); MV_WEB = ''"), ("transaction form", "MH_EDIT = 't1'; showMh('spend'); MH_EDIT = null"), ("calendar", "MV_PVIEW = 'cal'; showMh('bills'); MV_PVIEW = 'list'")]),
        ("Auto Hub", T.AUTOP, AUTO, "showCar", "c1", [("road trip box", "AUTO_TRIPOPEN = true; showCar('c1', 'fuel'); AUTO_TRIPOPEN = false"), ("one photo", "AUTO_VIEW = 'p1'; showCar('c1', 'photos'); AUTO_VIEW = null")])]
STEP = """([data, fn, arg, extras]) => { const errs = [];
  const tabs = fn === 'showHh' ? HH_TABS.map(x => x[0]) : fn === 'showMh' ? MH_TABS.map(x => x[0]) : AUTO_TABS.map(x => x[0]);
  try { S = normalize(JSON.parse(data)); } catch (e) { return ['normalize: ' + e]; }
  try { render(); } catch (e) { errs.push('home: ' + e); }
  for (const t of tabs) { try { arg ? showCar(arg, t) : window[fn](t); } catch (e) { errs.push(t + ': ' + e); } }
  for (const [name, js] of extras) { try { (0, eval)(js); } catch (e) { errs.push(name + ': ' + e); } }
  return errs; }"""

def leaves(o, path=()):
    if isinstance(o, dict):
        for k, v in o.items(): yield from leaves(v, path + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from leaves(v, path + (i,))
    else:
        yield path

def lists(o, path=()):
    """Every field that holds a list: a file can hand back something that only looks like one."""
    if isinstance(o, dict):
        for k, v in o.items(): yield from lists(v, path + (k,))
    elif isinstance(o, list):
        if path: yield path
        for i, v in enumerate(o): yield from lists(v, path + (i,))

def key_maps(o, path=()):
    """Records keyed by a word or a date: the key itself comes from the file too."""
    if isinstance(o, dict):
        if path and (path[-1] in ("budgets", "doses", "water", "steps", "checkins", "recallDone", "tripCheck", "every") or (len(path) >= 2 and path[-2] == "doses")):
            for k in o: yield path, k
        for k, v in o.items(): yield from key_maps(v, path + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from key_maps(v, path + (i,))


def payload_run(b, base):
    print("\n[8. a file built to run script: one field at a time, as text and in an array, on the home screen, every listed tab and the named forms]")
    PAY = "'\"><img src=data:,x onerror=__p(%d)>"
    for name, path, fixture, fn, arg, extras in FUZZ:
        a = T.App(b, base, path=path)
        a.page.wait_for_timeout(200)
        a.js("window.__pwn = []; window.__p = i => window.__pwn.push(Number(i)); window.showHh = typeof showHh === 'function' ? showHh : null; window.showMh = typeof showMh === 'function' ? showMh : null; setOwnerSwitch('OWNER', true); 0")
        clean = a.page.evaluate(STEP, [json.dumps(fixture), fn, arg, extras])
        check(f"{name}: the records draw every listed screen with nothing thrown, so the run below really reaches them", not clean, clean[:6])
        paths, seen = list(leaves(fixture)), {}
        keys = list(key_maps(fixture))
        for form, wrap in (("text", lambda v: v), ("array", lambda v: [v])):
            for i, lp in enumerate(paths):
                n = len(seen); seen[n] = f"{'.'.join(map(str, lp))} ({form})"
                d = copy.deepcopy(fixture); o = d
                for k in lp[:-1]: o = o[k]
                o[lp[-1]] = wrap(PAY % n)
                a.page.evaluate(STEP, [json.dumps(d), fn, arg, extras])
                if i % 8 == 7: a.page.wait_for_timeout(30)
        for i, lp in enumerate(paths):                       # a date or a time also as a bad value that still reads as one (shaped, below)
            o = fixture
            for k in lp: o = o[k]
            like = shaped(o)
            if not like: continue
            n = len(seen); seen[n] = f"{'.'.join(map(str, lp))} (reads as a date or time)"
            d = copy.deepcopy(fixture); o = d
            for k in lp[:-1]: o = o[k]
            o[lp[-1]] = like % n
            a.page.evaluate(STEP, [json.dumps(d), fn, arg, extras])
            if i % 8 == 7: a.page.wait_for_timeout(30)
        like_lists = list(lists(fixture))
        for j, lp in enumerate(like_lists):
            n = len(seen); seen[n] = f"{'.'.join(map(str, lp))} (not a real list)"
            d = copy.deepcopy(fixture); o = d
            for k in lp[:-1]: o = o[k]
            o[lp[-1]] = {"length": PAY % n}
            a.page.evaluate(STEP, [json.dumps(d), fn, arg, extras])
            if j % 8 == 7: a.page.wait_for_timeout(30)
        for j, (mp, k) in enumerate(keys):
            n = len(seen); seen[n] = f"key of {'.'.join(map(str, mp))}"
            d = copy.deepcopy(fixture); o = d
            for x in mp: o = o[x]
            o[PAY % n] = o.pop(k)
            a.page.evaluate(STEP, [json.dumps(d), fn, arg, extras])
            if j % 8 == 7: a.page.wait_for_timeout(30)
        a.page.wait_for_timeout(700)
        ran = sorted(set(a.js("window.__pwn")))
        check(f"{name}: nothing ran, {len(paths)} fields twice + {len(like_lists)} lists + {len(keys)} keys", not ran, [seen.get(i, i) for i in ran][:30])
        a.close()

# ------------------------------------------------------------ Day, Cruise, Trip and Home Hub: a full set of records and every screen they draw on
DAY_F = {"name": "Sam", "city": "80202", "pack": "general", "order": ["schedule"], "hidden": ["x"], "collapsed": ["x"], "listSel": "l1",
  "events": [{"id": "e1", "title": "Dentist", "day": "2026-10-01", "time": "14:30", "end": "15:00", "where": "Main St", "rep": "weekly", "skip": ["2026-10-08"]}, {"id": "e2", "title": "Gym", "day": "2026-10-02", "time": "09:00", "where": "w", "rep": ""}, {"id": "e3", "title": "All day", "day": "2026-10-01", "where": "w3"}, {"id": "e4", "title": "Soon", "day": "2026-10-01", "time": "09:30", "where": "w4"}, {"id": "e5", "title": "Every day", "day": "2026-09-01", "time": "08:15", "rep": "daily"}],
  "todos": [{"id": "t1", "title": "Call", "rep": "daily", "day": "2026-10-01", "done": False}, {"id": "t2", "title": "Mail", "day": "2026-10-02", "done": True, "doneDay": "2026-10-01", "rep": ""}, {"id": "t3", "title": "Done", "day": "2026-10-01", "done": True, "doneDay": "2026-10-01"}],
  "loads": [{"id": "lo1", "title": "Load", "day": "2026-10-01", "time": "10:00", "done": False}], "jobs": [{"id": "j1", "title": "Job", "day": "2026-10-01", "time": "11:00", "done": False}],
  "route": {"from": "Denver", "to": "Boise"}, "bills": [{"id": "b1", "name": "Rent", "amount": 900, "day": 3, "paid": "2026-09", "auto": False}], "countdowns": [{"id": "c1", "title": "Trip", "date": "2026-10-20"}],
  "lists": [{"id": "l1", "name": "Grocery", "items": [{"id": "i1", "text": "Milk", "done": False}, {"id": "i2", "text": "Eggs", "done": True}]}, {"id": "l2", "name": "Hardware", "items": []}],
  "people": [{"id": "p1", "name": "Mom", "md": "10-05", "kind": "birthday", "lead": 14, "year": 1950, "ideas": "scarf", "got": {"2025": True}}, {"id": "p2", "name": "Pat", "md": "12-25", "kind": "anniversary", "lead": 7, "year": "", "ideas": "tie", "got": {}}],
  "upkeep": [{"id": "u1", "name": "Oil", "area": "auto", "every": 3, "unit": "months", "next": "2026-10-03", "last": "2026-07-03", "auto": True}, {"id": "u2", "name": "Filter", "area": "home", "every": 1, "unit": "months", "next": "2026-10-02", "last": "2026-09-02", "auto": False}],
  "routines": [{"id": "r1", "name": "☀️ Morning", "time": "09:30", "days": [0, 1, 2, 3, 4, 5, 6], "steps": [{"id": "st1", "text": "Stretch"}, {"id": "st2", "text": "Water"}]}], "rdone": {"r1": {"day": "2026-10-01", "ids": ["st1"]}},
  "top3": {"day": "2026-10-01", "items": [{"id": "tp1", "title": "Big thing", "done": False, "why": "y"}], "ai": False},
  "alarms": [{"id": "al1", "time": "06:30", "label": "Wake", "days": [1, 2, 3, 4, 5], "on": True}], "returns": [{"id": "rt1", "what": "Shoes", "store": "Shop", "by": "2026-10-03", "how": "ship", "amount": 50, "done": False}],
  "future": [{"id": "f1", "text": "No 6 AM flights", "words": ["flight"], "day": "2026-10-01", "created": "2025-01-01T10:00:00", "seen": 1}], "futureShow": ["f1"],
  "payday": {"freq": "biweekly", "next": "2026-10-09", "amount": 1500, "d1": 1, "d2": 15}, "goals": [{"id": "g1", "name": "Trip", "target": 1000, "saved": 100}],
  "leave": {"items": [{"id": "lv1", "text": "Keys", "extra": False}, {"id": "lv2", "text": "Bag", "extra": True, "why": "y"}], "day": "2026-10-01", "done": ["lv1"]},
  "packages": [{"id": "pk1", "name": "Book", "num": "1Z999AA10123456784", "carrier": "ups", "eta": "2026-10-02", "delivered": False}, {"id": "pk2", "name": "Lamp", "num": "12345", "carrier": "other", "delivered": True, "deliveredDay": "2026-10-01", "eta": "2026-10-01"}],
  "remember": [{"id": "rm1", "text": "Umbrella", "day": "2026-10-01"}, {"id": "rm2", "text": "Coat", "day": "2026-10-02"}], "notes": [{"id": "n1", "text": "Gate code", "pinned": True, "updated": "2026-09-30T08:00:00"}],
  "gcal": {"connected": True, "fetched": "2026-10-01T08:00:00", "pushed": "2026-10-01T08:00:00", "dirty": True, "events": [{"id": "ge1", "title": "Meeting", "day": "2026-10-01", "time": "13:00", "end": "14:00", "where": "Room"}], "dates": [{"key": "k1", "name": "Bob", "kind": "birthday", "md": "10-10"}]},
  "mail": {"on": True, "last": "2026-10-01T08:00:00", "seen": {}, "found": [{"key": "m1", "type": "event", "title": "Dinner", "day": "2026-10-03", "time": "18:00", "src": "s@x.com"},
     {"key": "m2", "type": "package", "title": "Order", "num": "1Z999AA10123456784", "carrier": "ups", "day": "2026-10-03", "src": "s@x.com"},
     {"key": "m3", "type": "cruise", "title": "Cruise", "src": "s@x.com", "day": "2027-03-14", "cruise": {"line": "Princess", "ship": "Sun", "start": "2027-03-14", "end": "2027-03-21", "booking": "ABC123", "cabin": "A1", "category": "Bal", "port": "Miami", "ports": [{"name": "Nassau", "day": "2027-03-16"}], "finalDue": "2027-01-01"}}]},
  "money": {"type": "hourly", "salary": 50000, "spends": [{"id": "sp1", "day": "2026-10-01", "amt": 20, "what": "Food"}]},
  "work": {"rate": 25, "taxPct": 20, "otAfter": 40, "period": "biweekly", "periodStart": "2026-09-28", "clockIn": "2026-10-01T07:00:00", "shifts": [{"id": "sh1", "day": "2026-09-30", "start": "09:00", "end": "17:00", "brk": 30}]},
  "sync": {"on": True, "last": "2026-10-01T08:00:00", "dirty": True}, "remind": {"on": True, "lead": 15, "billDays": 1, "billHour": "09:00", "morning": 420, "night": 1260, "fired": {"x": 1}},
  "resetDay": "2026-09-30", "resetAt": "2026-09-30T21:00:00", "seenVersion": "1.0", "scene": "auto", "guardMargin": 60, "bagView": "all", "tripTab": "money", "tripList": "packing", "family": True, "adopted": ["x"], "photo": True}
def trip_f(kind):
    return {"id": "tr1", "type": kind, "name": "Caribbean", "start": "2026-10-20", "end": "2026-10-27", "line": "Princess", "ship": "Sun", "port": "Miami", "booking": "ABC123", "cabin": "A1", "travelers": 2, "total": 4000, "finalDue": "2026-10-10", "onboardBudget": 500, "credit": 50, "pkg": "princess-plus", "insurance": "bought", "sugNo": ["x"], "accountVerified": False, "safeEmpty": False, "aboard": False,
      "travel": "flying", "firstThings": {"cabin": True, "muster": False}, "payments": [{"id": "pay1", "day": "2026-09-01", "amt": 1000, "note": "Deposit"}],
      "spends": [{"id": "ts1", "day": "2026-09-20", "amt": 20, "cat": "Bar", "note": "n"}, {"id": "ts2", "day": "2026-09-20", "amt": 20, "cat": "Bar", "note": "n"}, {"id": "ts3", "day": "2026-09-21", "amt": 5, "cat": "Spa", "note": "m", "dupeOk": "x"}],
      "costs": [{"id": "co1", "cat": "hotel", "what": "Inn", "amt": 100, "paid": False}, {"id": "co2", "cat": "travel", "what": "Flight", "amt": 300, "paid": True, "bk": "bk1"}],
      "ports": [{"id": "pt1", "name": "Nassau, Bahamas", "day": "2026-10-22", "arrive": "08:00", "depart": "17:00", "allAboard": "16:30", "shipOffset": 60, "excursion": "Snorkel", "meet": "09:00", "where": "Pier", "indie": True, "walk": 15, "agent": "Agent 555-111-3333", "emergency": "911-555-1212", "currency": "BSD", "cash": "Yes", "cards": "Most", "tipping": "15%", "backMin": 20}, {"id": "pt2", "name": "Cozumel", "day": "2026-10-24", "arrive": "07:00", "depart": "16:00", "allAboard": "15:30", "excursion": "none"}],
      "perks": [{"id": "pe1", "name": "Credit", "unit": "$", "total": 100, "used": 10}, {"id": "pe2", "name": "Meals", "unit": "x", "total": 3, "used": 1}],
      "lists": {"packing": [{"id": "li1", "text": "Passport", "done": False, "bag": "carry"}], "docs": [{"id": "li2", "text": "ID", "done": True}], "before": [{"id": "li3", "text": "Pay", "done": False}], "embark": [{"id": "li4", "text": "Board", "done": False}], "requests": [{"id": "li5", "text": "Ask", "done": False}], "home": [{"id": "li6", "text": "Lock", "done": False}], "final": [{"id": "li7", "text": "Tip", "done": False}], "after": [{"id": "li8", "text": "Photo", "done": False}]},
      "bookings": [{"id": "bk1", "kind": "flight", "a": "DEN", "b": "MIA", "num": "UA123", "day": "2026-10-20", "t": "08:00", "endDay": "2026-10-20", "endT": "12:00", "cost": 300, "paid": True, "phone": "555-121-2345", "note": "n", "cancelBy": "2026-10-10", "leave": {"drive": 30, "park": 15, "check": 90, "buf": 15}},
                   {"id": "bk2", "kind": "hotel", "a": "Inn", "b": "1 Main", "num": "H1", "day": "2026-10-20", "t": "16:00", "endDay": "2026-10-22", "endT": "11:00", "cost": 120, "paid": False, "phone": "555-121-2346", "cancelBy": "2026-10-03", "note": "n", "stay": {"room": "101", "wifi": "w", "pass": "p", "breakfast": "b", "parking": "pk", "desk": "d"}, "outDone": ["x"]},
                   {"id": "bk3", "kind": "car", "a": "Hertz", "b": "Airport", "num": "C1", "day": "2026-10-20", "t": "12:30", "endDay": "2026-10-27", "endT": "10:00", "cost": 80, "paid": False, "phone": "555-121-2347", "cancelBy": "2026-09-01"},
                   {"id": "bk4", "kind": "train", "a": "A", "b": "B", "num": "T1", "day": "2026-10-22", "t": "10:00", "endDay": "2026-10-22", "endT": "12:00", "cost": 50, "paid": False},
                   {"id": "bk5", "kind": "ticket", "a": "Park", "b": "Where", "num": "A1", "day": "2026-10-20", "t": "13:00", "endT": "15:00", "cost": 50, "paid": False},
                   {"id": "bk6", "kind": "dinner", "a": "Cafe", "b": "Addr", "num": "D1", "day": "2026-10-20", "t": "18:00", "cost": 40, "paid": True}],
      "fun": [{"id": "fu1", "title": "Beach", "day": "2026-10-21", "t": "10:00", "end": "11:00", "pick": "must", "where": "w"}, {"id": "fu2", "title": "Museum", "day": "2026-10-21", "t": "10:30", "end": "12:00", "pick": "must", "where": "w2"}, {"id": "fu3", "title": "Lunch", "day": "2026-10-21", "pick": "skip"}, {"id": "fu4", "title": "Show", "day": "2026-10-21", "t": "10:15", "end": "10:45", "pick": "maybe"}],
      "wish": [{"id": "wi1", "title": "Museum", "mins": 60, "votes": {"Sam": 1, "Pat": -1}, "where": "w"}, {"id": "wi2", "title": "Park", "mins": 30, "votes": {"Sam": -1, "Pat": -1}}],
      "split": {"people": ["Sam", "Pat"], "by": {"c:co2": "Sam", "s:ts1": "Pat", "p:pay1": "Sam"}, "for": {"c:co2": "Sam", "s:ts1": "Pat"}}, "diary": {"2026-10-20": {"text": "Great", "best": "Sun", "mood": "😀"}},
      "refunds": [{"id": "rf1", "what": "Tour", "amt": 50, "from": "Co", "expect": "2026-09-20", "asked": "2026-09-01", "got": ""}, {"id": "rf2", "what": "Hotel", "amt": 20, "from": "Inn", "expect": "2026-10-20", "asked": "2026-09-05", "got": "2026-09-25"}],
      "drives": [{"id": "dv1", "day": "2026-10-20", "from": "Home", "to": "Port", "t": "06:00", "miles": 500, "mins": 480}], "vehicle": {"range": 300, "mpg": 25, "gas": 3.5},
      "car": {"level": "3", "spot": "B4", "where": "Lot B"}, "help": {"line": "555-111-2222", "agent": "Pat 555-111-2223", "ins": "Co 555-111-2224", "policy": "P9", "contact": "Mom 555-111-2225"},
      "upgrade": {"from": "Inside", "to": "Balcony", "extra": 100, "perks": 20},
      "pkgCalc": {"wifi": 1, "drinks": 4, "drinkPr": 12, "cap": 15, "coffee": 2, "coffeePr": 5, "water": 1, "waterPr": 3, "wifiPr": 20, "dinners": 1, "dinnerPr": 40, "photos": 30, "days": 7, "price": 60, "incDrinks": True, "incCoffee": True, "incWater": True, "incWifi": True, "incDining": True, "incPhotos": True, "incGrats": True}}
TRIP2 = {"id": "tr2", "type": "trip", "name": "Weekend", "start": "2026-12-01", "end": "2026-12-03"}
DOCS = [{"id": "doc1", "who": "Sam", "kind": "passport", "exp": "2026-11-01"}, {"id": "doc2", "who": "Pat", "kind": "license", "exp": "2028-01-01"}]
PREFS = {"with": "couple", "loves": ["beach"]}
DAY_FX = dict(DAY_F, trips=[trip_f("cruise")], tripSel="tr1")
CRUISE_FX = dict(DAY_F, trips=[trip_f("cruise"), TRIP2], tripSel="tr1", idDocs=DOCS, prefs=PREFS)
TRIP_FX = dict(DAY_F, trips=[trip_f("trip"), TRIP2], tripSel="tr1", idDocs=DOCS)
HOME_FX = dict(DAY_F, house={"type": "house", "value": {"end": "2026-08-31", "area": False, "est": 400000, "low": 350000, "high": 450000, "at": "2026-09-01", "ppsf": 200, "sold": 100, "yoy": 0.03, "sqft": 2000, "size": 1.1, "trend": 1.01, "shape": 1.02, "beds": 3, "baths": 2, "year": 1990, "cond": "avg", "zip": "80202"},
  "spaces": [{"id": "sp1", "key": "kitchen", "icon": "🍳", "name": "Kitchen", "area": "indoor", "floor": "1", "notes": "n", "items": [{"id": "it1", "name": "Stove", "model": "M", "note": "n"}], "tasks": [{"id": "tk1", "title": "Clean", "due": "2026-10-03", "every": 3, "done": False}, {"id": "tk2", "title": "Fix", "due": "2026-09-03", "every": 0, "done": True, "doneOn": "2026-09-03"}, {"id": "tk3", "title": "Paint", "due": "2026-09-20", "done": False}]},
             {"id": "sp2", "key": "yard", "icon": "🌳", "name": "Yard", "area": "outdoor", "floor": "", "notes": "", "items": [], "tasks": []}, {"id": "sp3", "key": "hvac", "icon": "❄️", "name": "HVAC", "area": "systems", "items": [], "tasks": []}]})
SCRATCH = "const d = document.createElement('div'); d.innerHTML = "
COMMON = [("home", "render()"),
  *[(f"{k} card", f"{SCRATCH}CARDS.{k}.body(); d.innerHTML = String(CARDS.{k}.meta ? CARDS.{k}.meta() : '')") for k in ("schedule", "reset", "tomorrow", "work", "budget", "weather", "todos", "notes", "bills", "inbox", "trips", "packages", "people", "payday", "future", "errands", "top3", "routines", "home", "auto", "leave", "countdowns", "lists", "route", "loads", "jobs", "nextup")],
  ("the day before", f"VIEW = addDays(today(), 1); {SCRATCH}CARDS.schedule.body(); VIEW = today()"),
  ("settings", "openSettings(); drawSettings()"), ("settings boxes", "drawAlarmBox(); drawSyncBox(); drawRemindBox(); drawMailBox(); drawDataBox(); drawAiBox(); drawFamBox(); drawCardList(); drawProBox(); drawInstallBox(); drawSceneBox(); drawSimpleBox()"),
  ("morning brief", "showBrief()"), ("life pulse", "showPulse()"), ("ask", "showAsk()"), ("simple mode", "S.simple = true; render(); S.simple = false; render()"),
  *[(f"{t} form", f"openQA('{t}'); closeQA()") for t in ("dump", "event", "todo", "loads", "jobs", "item", "bill", "person", "upkeep", "routine", "alarm", "return", "future", "trip", "tpay", "tport", "tperk", "tperkset", "tspend", "package", "countdown", "list", "spend", "shift", "pay")],
  ("edit a date", "PERSON_EDIT = 'p1'; openQA('person', true); PERSON_EDIT = 'p2'; openQA('person', true); PERSON_EDIT = null; closeQA()"), ("edit a note to future me", "FUTURE_EDIT = 'f1'; openQA('future', true); FUTURE_EDIT = null; closeQA()"),
  ("edit an alarm", "ALARM_EDIT = 'al1'; openQA('alarm', true); ALARM_EDIT = null; closeQA()"), ("edit a routine", "ROUTINE_EDIT = 'r1'; openQA('routine', true); ROUTINE_EDIT = null; closeQA()"),
  ("edit upkeep", "UPKEEP_EDIT = 'u1'; openQA('upkeep', true); UPKEEP_EDIT = 'u2'; openQA('upkeep', true); UPKEEP_EDIT = null; closeQA()")]
TAPPED = "TAB = 'plan'; PLAN_VIEW = 'trip'; render(); const seen = [...document.querySelectorAll('[data-tlday]')].map(e => e.dataset.tlday); TAB = 'explore'; render(); seen.push(...[...document.querySelectorAll('[data-tlday]')].map(e => e.dataset.tlday)); TAB = 'home'; "
TRAVEL_SCREENS = [*[(f"{t} tab", f"S.tripTab = '{t}'; {SCRATCH}CARDS.trips.body(); S.tripTab = 'money'") for t in ("ready", "money", "ports", "onboard", "perks", "lists", "tips")],
  *[(f"{l} list", f"S.tripList = '{l}'; S.tripTab = 'lists'; {SCRATCH}CARDS.trips.body(); S.tripList = 'packing'; S.tripTab = 'money'") for l in ("packing", "docs", "before", "embark", "requests", "home", "final", "after")],
  ("a bag", "S.bagView = 'carry'; S.tripTab = 'lists'; const d = document.createElement('div'); d.innerHTML = CARDS.trips.body(); S.bagView = 'all'; S.tripTab = 'money'"),
  ("trip form", "TRIP_EDIT = 'tr1'; openQA('trip', true); TRIP_EDIT = null; closeQA()"), ("port form", "PORT_EDIT = 'pt1'; openQA('tport', true); PORT_EDIT = 'pt2'; openQA('tport', true); PORT_EDIT = null; closeQA()"), ("perk form", "PERK_EDIT = 'pe1'; openQA('tperkset', true); PERK_EDIT = 'pe2'; openQA('tperkset', true); PERK_EDIT = null; closeQA()"),
  *[(f"{t} tab of the app", f"TAB = '{t}'; render(); TAB = 'home'") for t in ("explore", "wallet", "ai")],
  *[(f"plan: {v}", f"TAB = 'plan'; PLAN_VIEW = '{v}'; render(); PLAN_VIEW = 'trip'; TAB = 'home'") for v in ("today", "trip", "packing", "reservations", "diary")],
  ("map", f"{SCRATCH}tripMapHtml()"), ("ready", "showReady()"), ("return guard", "showGuard()"), ("forgetting", "showForget()"), ("go home", "showGoHome()"), ("crisis", "showHelp(); __each(['back', 'get', 'medical', 'travel', 'docs', 'contacts'], v => showHelp(v))"),
  ("paste", "showPaste()"), ("all set", "showMagic(S.trips[0])"), ("bill", "showBill()"), ("package", "showPkgCalc()"), ("upgrade", "showUpgrade()"),
  ("booking", "__each(['bk1', 'bk2', 'bk3', 'bk4', 'bk5', 'bk6'], b => showBooking(b))"), ("booking form", "BK_TRIP = 'tr1'; __each([['flight', 'bk1'], ['hotel', 'bk2'], ['car', 'bk3'], ['train', 'bk4'], ['ticket', 'bk5'], ['dinner', 'bk6']], ([k, b]) => showBookingForm(k, b))"),
  ("paste found", "PASTE_FOUND = S.trips[0].bookings.slice(); showPasteFound(); PASTE_FOUND = []"), ("the wrap", "showWrap()"), ("what changed", "FIX = { trip: 'tr1', bk: 'bk1' }; showFix('pick'); showFix('what'); FIX.impact = fixImpact(S.trips[0], 'bk1', { how: 'late', mins: 120 }); showFix('review'); FIX.calls = FIX.impact ? FIX.impact.calls : []; showFix('done'); FIX.impact = fixImpact(S.trips[0], 'bk1', { how: 'cancel' }); showFix('review'); FIX = null"),
  ("split", "showSplit('tr1')"), ("hotel", "showHotel('bk2')"), ("drive", "showDrive('tr1|dv1')"), ("vote", "showVote('tr1'); VOTER = 'Pat'; showVote('tr1'); VOTER = null"),
  ("the days without a button", "['2026-10-21', '2026-10-23'].forEach(d => showDay(d))"), ("each day button, as tapped", TAPPED + "__each([...new Set(seen)], v => showDay(v))"),
  ("a plan on each tapped day", TAPPED + "__each([...new Set(seen)], v => { showDay(v); const p = document.querySelector('#daySheet [data-dayplan]'); if (!p) return; VIEW = p.dataset.dayplan; const d = document.createElement('div'); d.innerHTML = CARDS.schedule.body(); d.innerHTML = String(CARDS.schedule.meta()); openQA('event'); closeQA(); }); VIEW = today()")]
HOME_SCREENS = [*[(f"space: {t}", f"showSpace('sp1', '{t}'); showSpace('sp2', '{t}')") for t in ("overview", "items", "tasks", "notes")], ("add a space", "['indoor', 'outdoor', 'systems'].forEach(a => showAddSpace(a))"), ("home value", "hpvEditing = false; hpvDraw(); document.getElementById('hpvCard'); const d = document.createElement('div'); d.innerHTML = hpvInner(); hpvEditing = true; d.innerHTML = hpvInner(); hpvEditing = false")]
DT_SCREENS_T = [*[(f"new look: {t}", f"TAB = '{t}'; render(); TAB = 'home'") for t in ("home", "today", "tasks", "money", "more")],
  *[(f"new look money: {s}", f"TAB = 'money'; DT_MONEY = '{s}'; render(); DT_MONEY = 'overview'; TAB = 'home'") for s in ("overview", "bills", "budget", "pay", "goals")],
  *[(f"new look tasks: {s}", f"TAB = 'tasks'; DT_TASKS = '{s}'; render(); DT_TASKS = 'todo'; TAB = 'home'") for s in ("todo", "lists", "routines", "leave")],
  *[(f"new look screen: {s}", f"DT_SCREEN = '{s}'; render(); DT_SCREEN = null") for s in ("weather", "pro", "trips", "upkeep", "reset", "family")],
  ("new look: car upkeep", "DT_SCREEN = 'upkeep'; DT_UPKEEP = 'auto'; render(); DT_UPKEEP = 'home'; DT_SCREEN = null"), ("new look: change a plan", "TAB = 'today'; render(); dtEditEvent('e1'); closeQA(); TAB = 'home'"), ("new look: brief", "showBrief()"), ("new look: brain dump", "openQA('dump'); closeQA()")]
CT_SCREENS_T = [*[(f"new look: {t}", f"TAB = '{t}'; render(); TAB = 'home'") for t in ("home", "plan", "explore", "wallet", "ai")],
  *[(f"new look screen: {s}", f"CT_SCREEN = '{s}'; render(); CT_SCREEN = null") for s in ("pass", "first10", "countdown", "onboard")],
  *[(f"new look list: {l}", f"TAB = 'plan'; PLAN_VIEW = 'packing'; S.tripList = '{l}'; render(); CT_OPEN.add('cruise'); render(); PLAN_VIEW = 'trip'; TAB = 'home'") for l in ("packing", "docs", "before", "final")],
  ("new look: a bag", "TAB = 'plan'; PLAN_VIEW = 'packing'; S.tripList = 'packing'; S.bagView = 'carry'; render(); S.bagView = 'all'; PLAN_VIEW = 'trip'; TAB = 'home'"),
  ("new look: each day button, as tapped", TAPPED + "__each([...new Set(seen)], v => showDay(v))")]
# the screens change with the clock: before the trip, the week before, sail day, a port day (running out of time), the last night, home again; morning, evening, the small hours
TRIP_CLOCKS = ["2026-10-01T09:00:00", "2026-10-15T09:00:00", "2026-10-19T21:00:00", "2026-10-20T07:00:00", "2026-10-21T09:00:00", "2026-10-22T09:00:00", "2026-10-22T15:20:00", "2026-10-26T21:00:00", "2026-10-29T10:00:00"]
DAY_CLOCKS = ["2026-10-01T09:00:00", "2026-10-01T20:00:00", "2026-10-02T01:00:00"]
# label, address, records, look key, clocks, screens, what must really be read (the sinks this run is here for: if a change stops drawing one, say so instead of passing quietly)
OTHERS = [("Day Hub", "", DAY_FX, None, DAY_CLOCKS, COMMON, ["work.taxPct", "work.otAfter", "work.rate", "work.periodStart", "money.salary", "people.0.year", "upkeep.1.next", "upkeep.1.last", "future.0.day", "future.0.seen"]),
          ("Day Hub, new look", "", DAY_FX, "dayhub.look", DAY_CLOCKS, DT_SCREENS_T, ["work.taxPct", "future.0.seen", "trips.0.name"]),
          ("Cruise Hub", T.CRUISE, CRUISE_FX, None, TRIP_CLOCKS, COMMON + TRAVEL_SCREENS, ["trips.0.ports.0.day", "trips.0.perks.1.used", "trips.0.perks.1.total", "trips.0.diary.2026-10-20.mood", "trips.0.travelers", "trips.0.drives.0.miles", "trips.0.fun.1.title", "trips.0.start", "trips.0.end"]),
          ("Cruise Hub, new look", T.CRUISE, CRUISE_FX, "cruisehub.look", TRIP_CLOCKS, CT_SCREENS_T, ["trips.0.ports.0.day", "trips.0.ports.1.day", "trips.0.lists.packing.0.text"]),
          ("Trip Hub", T.TRIP, TRIP_FX, None, TRIP_CLOCKS, COMMON + TRAVEL_SCREENS, ["trips.0.diary.2026-10-20.mood", "trips.0.travelers", "trips.0.drives.0.miles", "trips.0.fun.1.title"]),
          ("Home Hub", T.HOMEP, HOME_FX, None, DAY_CLOCKS[:2], COMMON + HOME_SCREENS, ["house.spaces.0.icon", "house.spaces.0.tasks.0.every", "house.value.sold", "house.value.sqft", "house.value.beds", "house.value.baths", "house.value.year"])]
# one clean draw per clock and screen, noting which fields each one reads: a field is then redrawn only where it shows. JSON.stringify (saving) and normalize don't count as showing.
TRACK2 = r"""(() => { const seen = new WeakMap(); window.__quiet = 0; const js = JSON.stringify; JSON.stringify = (...a) => { window.__quiet++; try { return js(...a); } finally { window.__quiet--; } };
  window.__track = function track(o, path) { if (!o || typeof o !== 'object') return o; if (seen.has(o)) return seen.get(o);
    const p = new Proxy(o, {
      get(t, k, r) { const v = Reflect.get(t, k, r); if (typeof k !== 'string' || window.__quiet) return v;
        if (Array.isArray(t) && !/^\d+$/.test(k)) { if (k === 'length') window.__reads.add(path); return v; }
        const q = path ? path + '.' + k : k; window.__reads.add(q);
        return (v && typeof v === 'object') ? track(v, q) : v; },
      ownKeys(t) { if (!window.__quiet) window.__reads.add(path + '.*'); return Reflect.ownKeys(t); } });
    seen.set(o, p); seen.set(p, p); return p; };
  window.__each = (list, fn) => list.forEach(v => { try { fn(v); } catch (e) { window.__eachN = (window.__eachN || 0) + 1; if (window.__eachErrs) window.__eachErrs.push(String(e)); } });
  const box = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', { get() { return box.get.call(this); }, set(v) { if (window.__drawn) window.__drawn.push(String(v)); box.set.call(this, v); }, configurable: true });
  return 0; })()"""
READS2 = r"""([data, screens]) => { const out = [], errs = [];
  screens.forEach(([name, js]) => { window.__reads = new Set(); window.__drawn = []; window.__eachErrs = [];
    try { S = __track(normalize(JSON.parse(data)), ''); } catch (e) { errs.push('normalize: ' + e); out.push([[], '']); return; }
    try { (0, eval)(js); } catch (e) { errs.push(name + ': ' + e); }
    window.__eachErrs.forEach(e => errs.push(name + ': ' + e)); window.__eachErrs = null;
    let h = 0; for (const c of window.__drawn.join('|').replace(/\d+/g, '#')) h = (h * 31 + c.codePointAt(0)) | 0;
    window.__drawn = null; out.push([[...window.__reads], h]); });
  return [out, errs]; }"""
DRAW2 = r"""([data, screens]) => { let threw = 0;
  for (const [name, js] of screens) {
    try { S = normalize(JSON.parse(data)); (0, eval)(js); } catch (e) { threw++; } }
  threw += window.__eachN || 0; window.__eachN = 0;
  return threw; }"""
# weather comes from the (fake) network once, so the screens that mix it with saved words draw too
WARM2 = """async (data) => { S = normalize(JSON.parse(data)); saveLocal(); await loadWeather(); if (WXDATA) { WXDATA.from = WXDATA.here; WXDATA.to = WXDATA.here; } try { (S.trips || []).forEach(tr => ensurePortWx(tr)); } catch (e) {} return Object.keys(WXDATA || {}); }"""
PAY2 = "'\"></textarea></title></style></select><img/src=\"data:,x\"/onerror=__p`%d`>"   # no space and no (): a word-stripper or placeName can't disarm it
def shaped(v):
    """The same bad value, but it starts like a date or a time, so it still parses and sorts as one. A value starting with ' sorts below every date, and the branches that compare dates throw it away before it draws."""
    if isinstance(v, str) and re.match(r"^\d{4}-\d{2}(-\d{2}|$)", v): return f"{v}-{PAY2}"
    if isinstance(v, str) and re.match(r"^\d{2}-\d{2}$", v): return f"{v}-{PAY2}"
    if isinstance(v, str) and re.match(r"^\d{1,2}:\d{2}$", v): return f"{v}:{PAY2}"
    return None
key_of = lambda lp: ".".join(map(str, lp))

def dicts(o, path=()):
    if isinstance(o, dict):
        if path: yield path
        for k, v in o.items(): yield from dicts(v, path + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from dicts(v, path + (i,))

def others_side_by_side():
    """Each Hub's run takes minutes, so they run side by side, a process each; what they print comes back in order, with their counts."""
    global OK, FAIL
    print("\n[10. the same run on Day, Cruise, Trip and Home Hub: every field, one at a time, as text, in an array, a list swapped for a look-alike, and a new record name, redrawn on every listed screen and clock that reads it]", flush=True)
    kids = []
    width = int(os.environ.get("RESTORE_WIDTH", "3"))          # 3 at a time: 14 browsers at once on this PC made pages time out
    stop = time.time() + 3 * 3600
    for arg in [str(i) for i in range(len(OTHERS))] + ["rest"]:
        while sum(1 for _, _, k in kids if k.poll() is None) >= width:
            if time.time() > stop:
                for _, _, k in kids: k.kill()
            time.sleep(1)
        out = open(os.path.join(tmp, f"others_{arg}.txt"), "w", encoding="utf-8", errors="replace")
        kids.append((arg, out, subprocess.Popen([sys.executable, os.path.abspath(__file__), "others-one", arg], stdout=out, stderr=subprocess.STDOUT, env=dict(os.environ, PYTHONIOENCODING="utf-8"))))
    for arg, out, k in kids:
        try: k.wait(timeout=5400)
        except subprocess.TimeoutExpired: k.kill(); k.wait()
        out.close()
        text = open(out.name, encoding="utf-8", errors="replace").read()
        print(text, flush=True)
        m = re.findall(r"(\d+) passed, (\d+) failed", text)
        if m and k.returncode == (1 if int(m[-1][1]) else 0): OK += int(m[-1][0]); FAIL += int(m[-1][1])
        else: check(f"section 10, part {arg}, ran to the end", False, f"exit {k.returncode}: {text[-400:]}")

def others_one(b, base, i):
    for name, path, fixture, look, clocks, screens, must in OTHERS[i:i + 1]:
        a = T.App(b, base, path=path)
        a.page.wait_for_timeout(150)
        if look:
            a.js(f"localStorage.setItem('{look}', 'tiles'); 0"); a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
        a.js("window.__pwn = []; window.__p = i => window.__pwn.push(Number(i)); setOwnerSwitch('OWNER', true); 0")
        # the detector itself: a raw value in a page has to set it off here, or a clean result below means nothing
        a.page.evaluate("(v) => { document.createElement('div').innerHTML = v; }", PAY2 % -1); a.page.wait_for_timeout(200)
        check(f"{name}: the detector goes off on a raw value", -1 in a.js("window.__pwn"))
        a.js(TRACK2)
        a.page.evaluate(WARM2, json.dumps(fixture)); a.page.wait_for_timeout(300)
        who, errs, drew = {}, [], {}
        for ci, at in enumerate(clocks):
            a.page.clock.set_fixed_time(at + "-05:00")
            reads, e = a.page.evaluate(READS2, [json.dumps(fixture), screens])
            errs += [at[5:16] + " " + x for x in e]
            for si, (rs, h) in enumerate(reads):
                if h in drew.setdefault(si, set()): continue         # this clock draws the same page as an earlier one, numbers aside: once is enough
                drew[si].add(h)
                for r in rs: who.setdefault(r, set()).add((ci, si))
        check(f"{name}: the records draw every listed screen on every clock with nothing thrown", not errs, errs[:8])
        missing = [m for m in must if m not in who]
        check(f"{name}: the screens really read the fields this run is here for", not missing, missing)
        tries, threw, seen, unread = 0, 0, {}, []
        def one(d, pairs):
            nonlocal tries, threw
            by_clock = {}
            for ci, si in pairs: by_clock.setdefault(ci, []).append(screens[si])
            for ci, ss in by_clock.items():
                a.page.clock.set_fixed_time(clocks[ci] + "-05:00")
                threw += a.page.evaluate(DRAW2, [json.dumps(d), ss])
            tries += 1
            if tries % 10 == 0: a.page.wait_for_timeout(25)
        paths = list(leaves(fixture))
        only = os.environ.get("RESTORE_ONLY", "")              # RESTORE_ONLY=trips.0.ports tries just those fields: for checking one sink by hand, never a full pass
        for lp in paths:
            pairs = who.get(key_of(lp))
            if not pairs: unread.append(key_of(lp)); continue
            if only not in key_of(lp): continue
            for form, wrap in (("text", lambda v: v), ("array", lambda v: [v])):
                n = len(seen); seen[n] = f"{key_of(lp)} ({form})"
                d = copy.deepcopy(fixture); o = d
                for k in lp[:-1]: o = o[k]
                o[lp[-1]] = wrap(PAY2 % n)
                one(d, pairs)
            o = fixture
            for k in lp: o = o[k]
            like = shaped(o)
            if like:
                n = len(seen); seen[n] = f"{key_of(lp)} (reads as a date or time)"
                d = copy.deepcopy(fixture); o = d
                for k in lp[:-1]: o = o[k]
                o[lp[-1]] = like % n
                one(d, pairs)
        for lp in lists(fixture):
            pairs = who.get(key_of(lp))
            if not pairs or only not in key_of(lp): continue
            n = len(seen); seen[n] = f"{key_of(lp)} (not a real list)"
            d = copy.deepcopy(fixture); o = d
            for k in lp[:-1]: o = o[k]
            o[lp[-1]] = {"length": PAY2 % n}
            one(d, pairs)
        for lp in dicts(fixture):                  # a record name comes from the file too, wherever something walks the names
            pairs = who.get(key_of(lp) + ".*")
            o = fixture
            for k in lp: o = o[k]
            if not pairs or not o or only not in key_of(lp): continue
            n = len(seen); seen[n] = f"new record name in {key_of(lp)}"
            d = copy.deepcopy(fixture); o = d
            for k in lp: o = o[k]
            first = next(iter(o))
            o[(shaped(first) or PAY2) % n] = copy.deepcopy(o[first])          # a day's record name has to read as a day to get drawn
            one(d, pairs)
        a.page.wait_for_timeout(900)
        check(f"{name}: fields were really tried", tries > 0, f"RESTORE_ONLY={only!r}")
        if only: print(f"        RESTORE_ONLY={only}: this checked {tries} tries on those fields only. It is not a full pass.")
        ran = sorted(i for i in set(a.js("window.__pwn")) if i >= 0)
        check(f"{name}: nothing ran, {len(paths)} fields ({len(unread)} no listed screen reads), {tries} tries", not ran, [seen.get(i, i) for i in ran][:40])
        print(f"        {threw} draws threw on a bad value and stopped there. Fields no listed screen reads, so not tried: {' '.join(unread) or 'none'}")
        a.close()

def others_rest(b, base):
    print("\n[10a. another Hub's trips, read straight from its own store, not through this Hub's cleanup]")
    FAM = [("home", "render()"), ("trips card", f"{SCRATCH}CARDS.trips.body(); d.innerHTML = String(CARDS.trips.meta())"), ("schedule", f"{SCRATCH}CARDS.schedule.body()"), ("settings", "openSettings(); drawSettings(); drawFamBox()"), ("brief", "showBrief()")]
    for name, path, store, kind in (("Day Hub, showing Cruise Hub's trip", "", "cruisehub.v1", "cruise"), ("Cruise Hub, showing Day Hub's trip", T.CRUISE, "dayhub.v1", "trip"), ("Trip Hub, showing Day Hub's trip", T.TRIP, "dayhub.v1", "cruise")):
        a = T.App(b, base, path=path)
        a.page.wait_for_timeout(150)
        a.js("window.__pwn = []; window.__p = i => window.__pwn.push(Number(i)); 0")
        tr = trip_f(kind); own = {"name": "Sam", "city": "80202"}
        STEP3 = r"""([own, store, sib, screens]) => { localStorage.setItem(store, sib); FAM_RAW = null; let threw = 0;
          for (const [n, js] of screens) { try { S = normalize(JSON.parse(own)); (0, eval)(js); } catch (e) { threw++; } } return threw; }"""
        clean = a.page.evaluate(STEP3, [json.dumps(own), store, json.dumps({"trips": [tr], "adopted": []}), FAM])
        shown = a.js("famTrips().length")
        check(f"{name}: the other Hub's trip really reaches this one and draws", clean == 0 and shown == 1, (clean, shown))
        seen = {}
        for form, wrap in (("text", lambda v: v), ("array", lambda v: [v])):
            for lp in leaves(tr):
                if lp == ("id",): continue
                n = len(seen); seen[n] = f"{key_of(lp)} ({form})"
                d = copy.deepcopy(tr); o = d
                for k in lp[:-1]: o = o[k]
                o[lp[-1]] = wrap(PAY2 % n)
                a.page.evaluate(STEP3, [json.dumps(own), store, json.dumps({"trips": [d], "adopted": []}), FAM])
                if n % 10 == 9: a.page.wait_for_timeout(25)
        for lp in leaves(tr):
            o = tr
            for k in lp: o = o[k]
            like = shaped(o)
            if not like: continue
            n = len(seen); seen[n] = f"{key_of(lp)} (reads as a date or time)"
            d = copy.deepcopy(tr); o = d
            for k in lp[:-1]: o = o[k]
            o[lp[-1]] = like % n
            a.page.evaluate(STEP3, [json.dumps(own), store, json.dumps({"trips": [d], "adopted": []}), FAM])
        a.page.wait_for_timeout(900)
        ran = sorted(set(a.js("window.__pwn")))
        check(f"{name}: nothing ran, {len(seen)} tries", not ran, [seen.get(i, i) for i in ran][:30])
        a.close()
    print("\n[10b. Hub Universe reads every Hub's store: every text and number in all of them bad at once, not one at a time, on its home and each planet]")
    keep = {"id", "day", "date", "time", "t", "end", "start", "by", "due", "next", "last", "md", "kind", "type", "unit", "area", "every", "endDay", "endT", "arrive", "depart", "allAboard", "meet", "pick", "bk", "key", "exp", "expect", "asked", "got", "cat", "listSel", "tripSel", "pack", "freq", "scene", "tripTab", "tripList", "bagView", "seenVersion", "paid", "created", "clockIn", "fetched", "pushed", "resetDay", "resetAt", "cancelBy", "doneOn", "doneDay", "deliveredDay", "eta", "finalDue", "periodStart", "at", "code", "period", "how", "carrier", "bag", "num", "setup"}
    marks = {}
    def all_bad(o, pre):
        if isinstance(o, dict):
            for k in list(o):
                if k in keep or isinstance(o[k], bool) or o[k] is None: continue
                if isinstance(o[k], (dict, list)): all_bad(o[k], f"{pre}.{k}")
                else:
                    n = len(marks); marks[n] = f"{pre}.{k}"; o[k] = PAY2 % n
        elif isinstance(o, list):
            for i, v in enumerate(o):
                if isinstance(v, (dict, list)): all_bad(v, f"{pre}.{i}")
                elif not isinstance(v, bool) and v is not None:
                    n = len(marks); marks[n] = f"{pre}.{i}"; o[i] = PAY2 % n
    a = T.App(b, base, path=T.UNIP)
    a.page.wait_for_timeout(200)
    a.js("window.__pwn = []; window.__p = i => window.__pwn.push(Number(i)); S.name = 'Sam'; S.city = '80202'; 0")
    for store, fx in (("dayhub.v1", DAY_FX), ("cruisehub.v1", CRUISE_FX), ("triphub.v1", TRIP_FX), ("homehub.v1", HOME_FX), ("healthhub.v1", HEALTH), ("moneyhub.v1", MONEY), ("autohub.v1", AUTO)):
        d = copy.deepcopy(fx); all_bad(d, store)
        a.page.evaluate("([k, v]) => localStorage.setItem(k, v)", [store, json.dumps(d)])
    a.js("render(); document.querySelectorAll('[data-uniplanet]').forEach(e => e.click()); 0")
    a.page.wait_for_timeout(900)
    drew = a.js("uniScan().filter(h => h.set).length")
    check("Hub Universe: all 7 Hubs really draw with their bad values", drew == 7, drew)
    ran = sorted(set(a.js("window.__pwn")))
    check(f"Hub Universe: nothing ran, {len(marks)} bad values in 7 stores", not ran, [marks.get(i, i) for i in ran][:20])
    a.close()
    print("\n[10c. the same thing through a real file, on each Hub]")
    for name, path, fixture, app in (("Day Hub", "", DAY_FX, "dayhub"), ("Cruise Hub", T.CRUISE, CRUISE_FX, "cruisehub"), ("Trip Hub", T.TRIP, TRIP_FX, "triphub"), ("Home Hub", T.HOMEP, HOME_FX, "homehub")):
        evil = copy.deepcopy(fixture); evil["name"] = "Evil"
        for i, lp in enumerate((("work", "taxPct"), ("work", "otAfter"), ("work", "rate"), ("money", "salary"), ("work", "periodStart"), ("future", 0, "seen"), ("future", 0, "day"), ("people", 0, "year"), ("upkeep", 1, "last"))):
            o = evil
            for k in lp[:-1]: o = o[k]
            o[lp[-1]] = PAY2 % i
        for i, lp in enumerate((("perks", 1, "used"), ("perks", 1, "total"), ("travelers",), ("diary", "2026-10-20", "mood"), ("drives", 0, "miles"), ("fun", 1, "title"))):
            if evil.get("trips"):
                o = evil["trips"][0]
                for k in lp[:-1]: o = o[k]
                o[lp[-1]] = PAY2 % (100 + i)
        if evil.get("trips"): evil["trips"][0]["ports"][0]["day"] = shaped("2026-10-22") % 150
        if evil.get("house"):
            evil["house"]["spaces"][0]["icon"] = PAY2 % 200; evil["house"]["spaces"][0]["tasks"][0]["every"] = PAY2 % 201; evil["house"]["value"]["sold"] = PAY2 % 202; evil["house"]["value"]["sqft"] = PAY2 % 203
        a = open_hub(b, base, path)
        a.js("window.__pwn = []; window.__p = i => window.__pwn.push(Number(i)); 0")
        p = os.path.join(tmp, f"evil_{app}.json")
        with open(p, "w", encoding="utf-8") as f: json.dump({"app": a.js("APP_ID"), "savedAt": "2026-09-01T12:00:00Z", "data": evil}, f)
        load(a, p)
        check(f"{name}: the file really loads", a.js("S.name") == "Evil", toast_text(a))
        a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(150)
        a.js("openQA('pay'); closeQA(); FUTURE_EDIT = 'f1'; openQA('future', true); FUTURE_EDIT = null; closeQA(); PERSON_EDIT = 'p1'; openQA('person', true); PERSON_EDIT = null; UPKEEP_EDIT = 'u2'; openQA('upkeep', true); UPKEEP_EDIT = null; closeQA(); 0")
        if evil.get("trips"): a.js("showWrap(); showDrive('tr1|dv1'); TAB = 'plan'; PLAN_VIEW = 'trip'; render(); document.querySelectorAll('[data-tlday]').forEach(e => showDay(e.dataset.tlday)); TAB = 'explore'; render(); const p = document.querySelector('.port-card[data-tlday]'); if (p) { p.click(); const q = document.querySelector('#daySheet [data-dayplan]'); if (q) { q.click(); closeQA(); TAB = 'plan'; PLAN_VIEW = 'today'; render(); } } TAB = 'home'; VIEW = today(); render(); 0")
        if evil.get("house"): a.js("showSpace('sp1', 'tasks'); 0")
        a.page.wait_for_timeout(500)
        check(f"{name}: a real file with bad values in the fields fixed here ran nothing", not a.js("window.__pwn"), a.js("window.__pwn"))
        a.close()
    print("\n[10d. values that could lock the app up: a trip whose end date never comes, a drive or a cost of Infinity. They used to spin a loop forever, which also hid every field after them in section 10]")
    DRAW_ALL = """([data, screens]) => { window.__allDrawn = false; window.__allThrew = []; setTimeout(() => { for (const [n, js] of screens) { try { S = normalize(JSON.parse(data)); (0, eval)(js); } catch (e) { window.__allThrew.push(n + ': ' + e); } } window.__allDrawn = true; }, 0); return 0; }"""
    NEVER = [("an end date of words", {"end": "zzz"}), ("a bad end date", {"end": PAY2 % 0}), ("a far-off end date", {"end": "9999-12-31"}), ("an end date that sorts after every date", {"end": "~"}), ("a very early start", {"start": "0001-01-01"}),
             ("a drive that never ends", {"drives": [{"id": "dv1", "day": "2026-10-20", "from": "A", "to": "B", "t": "08:00", "miles": 500, "mins": "Infinity"}]}),
             ("a cost of Infinity split between two", {"costs": [{"id": "c", "cat": "hotel", "what": "Inn", "amt": "Infinity", "paid": True}], "split": {"people": ["Sam", "Pat"], "by": {"c:c": "Sam"}, "for": {"c:c": "Pat"}}})]
    for name, path, fixture in (("Day Hub", "", DAY_FX), ("Cruise Hub", T.CRUISE, CRUISE_FX), ("Trip Hub", T.TRIP, TRIP_FX)):
        for label, change in NEVER:
            a = T.App(b, base, path=path)
            a.page.wait_for_timeout(100)
            a.js("window.__pwn = []; window.__p = i => window.__pwn.push(Number(i)); window.__each = (list, fn) => list.forEach(v => { try { fn(v); } catch (e) { window.__allThrew.push(String(e)); } }); 0")
            d = copy.deepcopy(fixture); d["trips"][0].update(change)
            a.page.evaluate(DRAW_ALL, [json.dumps(d), COMMON + TRAVEL_SCREENS + [("reminders", "reminderList()")]])
            try:
                a.page.wait_for_function("window.__allDrawn === true", timeout=90000); done = True
            except Exception:
                done = False
            threw = a.js("window.__allThrew") if done else []
            check(f"{name}: {label}: it doesn't hang", done)
            check(f"{name}: {label}: and every screen draws", done and not threw, threw[:4])
            a.ctx.close() if not done else a.close()
    for name, path, change in (("Cruise Hub", T.CRUISE, NEVER[0][1]), ("Trip Hub", T.TRIP, NEVER[5][1]), ("Cruise Hub", T.CRUISE, NEVER[6][1])):
        a = open_hub(b, base, path)
        tr = {"id": "t", "type": "cruise" if path == T.CRUISE else "trip", "name": "X", "start": "2026-10-20", "end": "2026-10-27"}; tr.update(change)
        p = os.path.join(tmp, "never_ends.json")
        with open(p, "w", encoding="utf-8") as f: json.dump({"app": a.js("APP_ID"), "savedAt": "2026-09-01T12:00:00Z", "data": {"name": "Evil", "city": "80202", "tripSel": "t", "trips": [tr]}}, f)
        what = next(k for k in change)
        a.js("openSettings(); 0")
        with a.page.expect_file_chooser() as fc:
            a.page.click('[data-data="import"]')
        fc.value.set_files(p)
        try:
            a.page.wait_for_function("S.name === 'Evil'", timeout=60000); done = True
        except Exception:
            done = False
        check(f"{name}: a real file with a bad {what} loads instead of hanging", done)
        if done:
            try:
                a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')", timeout=60000); opens = True
            except Exception:
                opens = False
            check(f"{name}: and the app still opens with it on the phone", opens)
        a.ctx.close() if not done else a.close()

    print("\n[10e. honest values on the fields fixed here read as they did]")
    a = open_hub(b, base, T.CRUISE)
    days = a.page.evaluate("(d) => { S = normalize(JSON.parse(d)); S.tripTab = 'ports'; const x = document.createElement('div'); x.innerHTML = CARDS.trips.body(); return x.querySelectorAll('.row .time').length; }", json.dumps(CRUISE_FX))
    check("a real trip still lists every day", days == 8, days)
    a.close()
    a = open_hub(b, base, T.TRIP)
    a.page.evaluate("(d) => { S = normalize(JSON.parse(d)); }", json.dumps(TRIP_FX))
    plan = a.js("(() => { const tr = S.trips[0], p = drivePlan(tr, { id: 'x', day: '2026-10-20', from: 'A', to: 'B', t: '06:00', miles: 2800, mins: 2880 }); return p.stops.length; })()")
    check("a two-day drive still gets all its stops", 20 <= plan < 400, plan)
    settle = a.js("(() => { const tr = { costs: [{ id: 'c', cat: 'hotel', what: 'Inn', amt: 100, paid: true }], split: { people: ['Sam', 'Pat'], by: { 'c:c': 'Sam' }, for: {} } }; return splitMath(tr).pay; })()")
    check("a split still settles up", len(settle) == 1 and settle[0]["from"] == "Pat" and settle[0]["to"] == "Sam" and settle[0]["amt"] == 50, settle)
    a.close()
    a = open_hub(b, base, "")
    a.js("""S.work.rate = 25; S.work.taxPct = 18.5; S.work.otAfter = 38; S.work.periodStart = '2026-09-28'; S.money.salary = 52000; S.future = [{ id: 'f', text: 'x', words: [], day: '2026-11-01', created: '2026-01-01T00:00:00', seen: 2 }];
           S.people = [{ id: 'p', name: 'Mom', md: '10-05', kind: 'birthday', lead: 14, year: 1950, got: {} }]; S.upkeep = [{ id: 'u', name: 'Filter', area: 'home', every: 3, unit: 'months', next: '2026-11-02', last: '2026-08-02' }];
           S.work.shifts = [{ id: 's', day: today(), start: '09:00', end: '17:00', brk: 30 }]; save(); openQA('pay'); 0""")
    fv = lambda n: a.js(f"document.querySelector('#qaForm [name={n}]').value")
    check("the pay form reads back as stored", (fv("rate"), fv("tax"), fv("ot"), fv("salary"), fv("pstart")) == ("25", "18.5", "38", "52000", "2026-09-28"), (fv("rate"), fv("tax"), fv("ot"), fv("salary"), fv("pstart")))
    a.js("closeQA(); FUTURE_EDIT = 'f'; openQA('future', true); FUTURE_EDIT = null; 0")
    check("a note to future me keeps its day", fv("day") == "2026-11-01", fv("day"))
    a.js("closeQA(); PERSON_EDIT = 'p'; openQA('person', true); PERSON_EDIT = null; 0")
    check("a date keeps its year", fv("date") == "1950-10-05", fv("date"))
    a.js("closeQA(); UPKEEP_EDIT = 'u'; openQA('upkeep', true); UPKEEP_EDIT = null; 0")
    check("upkeep keeps its dates and how often", (fv("next"), fv("last"), fv("every")) == ("2026-11-02", "2026-08-02", "3"), (fv("next"), fv("last"), fv("every")))
    a.js("closeQA(); 0")
    a.js("S.events = [{ id: 'r', title: 'Walk', day: '2026-09-01', time: '18:00', rep: 'daily' }]; VIEW = today(); render(); 0")
    check("a repeating plan's remove button carries its day", a.js("(() => { const d = document.createElement('div'); d.innerHTML = CARDS.schedule.body(); return d.querySelector('[data-del^=occ]').dataset.del; })()") == "occ:r:2026-10-01")
    box = a.js("(() => { const d = document.createElement('div'); d.innerHTML = CARDS.work.body() + CARDS.future.body() + CARDS.budget.body(); return d.textContent; })()")
    check("the work card and a saved note read as before", "minus 18.5% for taxes" in box and "overtime after 38h" in box and "30 min break" in box and "came back 2×" in box, box[:300])
    a.close()
    a = open_hub(b, base, T.TRIP, at="2026-10-21T09:00:00")
    honest = dict(TRIP_FX, trips=[dict(trip_f("trip"), travelers=3)])
    honest["trips"][0]["diary"] = {"2026-10-20": {"text": "t", "mood": "😍"}}; honest["trips"][0]["fun"] = [{"id": "a", "title": "Tom & Jerry's \"big\" show", "day": "2026-10-21", "t": "10:00", "end": "11:00", "pick": "must"}, {"id": "b", "title": "Museum", "day": "2026-10-21", "t": "10:30", "end": "12:00", "pick": "maybe"}]
    a.page.evaluate("(d) => { S = normalize(JSON.parse(d)); showWrap(); }", json.dumps(honest)); a.page.wait_for_timeout(150)
    wrap = a.js("document.getElementById('wrapSheet') ? document.getElementById('wrapSheet').textContent : document.body.textContent")
    check("the wrap reads 3 of you, and a day's mood is still its picture", "3 of you" in wrap and "😍" in wrap, wrap[:200])
    a.js("showDrive('tr1|dv1'); 0"); a.page.wait_for_timeout(100)
    check("a drive still says its miles", "500 mi" in a.js("document.getElementById('driveSheet').textContent"))
    a.js("showDay('2026-10-21'); 0"); a.page.wait_for_timeout(100)
    day = a.js("document.getElementById('daySheet').textContent")
    check("a backup's clash reads once, not as codes", "clashes with Tom & Jerry's \"big\" show" in day and "&amp;" not in day and "&quot;" not in day, day[:300])
    check("a wish's remove button and Add a plan carry their day", a.js("document.querySelector('#daySheet [data-wishdel]').dataset.wishdel") == "tr1|wi1|2026-10-21" and a.js("document.querySelector('#daySheet [data-dayplan]').dataset.dayplan") == "2026-10-21", a.js("(document.querySelector('#daySheet [data-wishdel]') || {dataset: {}}).dataset.wishdel"))
    a.js("TAB = 'plan'; PLAN_VIEW = 'trip'; render(); 0"); a.page.wait_for_timeout(100)
    check("a day button still carries its day", a.js("document.querySelector('[data-tlday]').dataset.tlday") == "2026-10-20", a.js("document.querySelector('[data-tlday]').dataset.tlday"))
    a.close()
    a = open_hub(b, base, T.HOMEP)
    a.page.evaluate("(d) => { S = normalize(JSON.parse(d)); render(); showSpace('sp1', 'tasks'); }", json.dumps(HOME_FX)); a.page.wait_for_timeout(120)
    sheet = a.js("document.getElementById('homeSheet').textContent")
    check("Home Hub: a space keeps its picture and a task says how often", "🍳" in sheet and "every 3 months" in sheet, sheet[:200])
    a.js("const d = document.createElement('div'); d.innerHTML = hpvInner(); window.__hv = d.textContent; 0")
    hv = a.js("window.__hv")
    check("Home Hub: the value card says its sales and square feet", "100homes sold" in hv and "2,000 sq ft" in hv, hv[:240])
    a.close()
    a = open_hub(b, base, T.CRUISE)
    a.page.evaluate("(d) => { S = normalize(JSON.parse(d)); TAB = 'plan'; S.tripTab = 'perks'; render(); }", json.dumps(CRUISE_FX)); a.page.wait_for_timeout(120)
    check("Cruise Hub: a perk reads 1 of 3 used", "1 of 3 used" in a.js("(() => { const d = document.createElement('div'); d.innerHTML = CARDS.trips.body(); return d.textContent; })()"))
    a.js("PERK_EDIT = 'pe2'; openQA('tperkset', true); PERK_EDIT = null; 0")
    check("Cruise Hub: the perk form reads back", (a.js("document.querySelector('#qaForm [name=ptotal]').value"), a.js("document.querySelector('#qaForm [name=pused]').value")) == ("3", "1"))
    a.close()


def main():
    srv, base = T.serve()
    files = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        if "others-one" in sys.argv[1:]:                      # one part of section 10, in its own process (others_side_by_side)
            which = sys.argv[sys.argv.index("others-one") + 1]
            others_rest(b, base) if which == "rest" else others_one(b, base, int(which))
            b.close(); srv.shutdown()
            print(f"\n{OK} passed, {FAIL} failed")
            return 1 if FAIL else 0
        if "payload" in sys.argv[1:] or "others" in sys.argv[1:]:
            if "others" not in sys.argv[1:]: payload_run(b, base)
            others_side_by_side(); b.close(); srv.shutdown()
            print(f"\n{OK} passed, {FAIL} failed")
            return 1 if FAIL else 0

        print("\n[1. every Hub gets its things back from its own backup file, with a real tap]")
        for name, path in HUBS:
            a = open_hub(b, base, path)
            errs = []
            a.page.on("pageerror", lambda e: errs.append(str(e)))
            a.js("S.name = 'Sam'; S.city = '80202'; S.notes = S.notes || []; S.notes.push({ id: 'n1', text: 'Gate code 9981', pinned: false, at: Date.now() }); save()")
            own = OWN.get(name)
            if own: a.js(own[0] + "; save(); render()")
            files[name] = download(a, f"{name.replace(' ', '_')}.json")
            doc = json.load(open(files[name], encoding="utf-8"))
            check(f"{name}: Download my data gives its own backup file", doc.get("app") == a.js("APP_ID") and len(doc["data"]["notes"]) >= 1, doc.get("app"))
            a.js("S.notes = []; save()")
            if own: a.js(own[1] + "; save()")
            check(f"{name}: the things are gone first", a.js("S.notes.length") == 0 and (not own or not a.js(own[2])))
            load(a, files[name])
            check(f"{name}: it says it restored", "Restored from" in toast_text(a), toast_text(a))
            check(f"{name}: Load a backup file brings the note back", a.js("S.notes.length") == 1 and a.js("S.notes[0].text") == "Gate code 9981", a.js("S.notes.length"))
            if own: check(f"{name}: and its own things", a.js(own[2]) is True)
            a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(150)
            if own and own[3]: check(f"{name}: and they're on the screen", own[3] in a.js("document.body.innerText"), a.js("document.body.innerText")[:120])
            check(f"{name}: the screen isn't the can't-open page", "won't open" not in a.js("document.body.innerText"))
            a.js("S.notes = []; save()")
            load(a, files[name])
            check(f"{name}: the same file can be picked a second time", a.js("S.notes.length") == 1)
            a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
            check(f"{name}: it's still there after reopening", a.js("S.notes.length") == 1 and a.js("S.notes[0].text") == "Gate code 9981")
            check(f"{name}: no page errors", not errs, errs[:2])
            a.close()

        print("\n[2. a wrong file says so, nothing changes]")
        junk = os.path.join(tmp, "not_a_backup.json")
        with open(junk, "w", encoding="utf-8") as f: json.dump({"hello": "world"}, f)
        broken = os.path.join(tmp, "broken.json")
        with open(broken, "w", encoding="utf-8") as f: f.write("{ not json")
        for name, path in THREE:
            a = open_hub(b, base, path)
            a.js("S.notes = [{ id: 'keep', text: 'Keep me', pinned: false, at: Date.now() }]; save()")
            load(a, junk)
            check(f"{name}: a file that isn't a backup says so", "isn't a" in toast_text(a), toast_text(a))
            check(f"{name}: and nothing changed", a.js("S.notes.length") == 1 and a.js("S.notes[0].id") == "keep")
            load(a, broken)
            check(f"{name}: a broken file says so", "Couldn't read" in toast_text(a), toast_text(a))
            load(a, files["Day Hub"])
            check(f"{name}: Day Hub's file is turned away by name", "Day Hub" in toast_text(a) and a.js("S.notes[0].id") == "keep", toast_text(a))
            a.close()

        print("\n[3. the photo boxes these listeners exist for still work]")
        a = open_hub(b, base, T.HEALTHP)
        a.js("S.hh.setup = true; save(); render(); showHh('vault')"); a.page.wait_for_timeout(250)
        a.page.set_input_files('[data-hhvault]', PIC); a.page.wait_for_function("(S.hh.vault || []).length === 1", timeout=8000)
        check("Health Hub: a vault photo still saves", a.js("S.hh.vault.length") == 1)
        a.close()
        a = open_hub(b, base, T.MONEYP)
        a.js("S.mh.setup = true; save(); render(); showMh('vault')"); a.page.wait_for_timeout(250)
        a.page.set_input_files('#mhSheet [data-mvvault]', PIC); a.page.wait_for_function("(S.mh.vault || []).length === 1", timeout=8000)
        check("Money Hub: a vault photo still saves", a.js("S.mh.vault.length") == 1)
        a.close()

        print("\n[4. closing Settings after a load doesn't write the old name back; Undo works]")
        for name, path in (("Day Hub", ""),) + THREE:
            a = open_hub(b, base, path)
            a.js("S.name = 'Pat'; S.city = '10001'; S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: Date.now() }]; save()")
            load(a, files[name])
            check(f"{name}: the form shows the restored name", a.js("document.getElementById('setName').value") == "Sam", a.js("document.getElementById('setName').value"))
            a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(120)
            check(f"{name}: closing Settings keeps the restored name and city", a.js("S.name") == "Sam" and a.js("S.city") == "80202", (a.js("S.name"), a.js("S.city")))
            a.js("S.name = 'Pat'; S.city = '10001'; S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: Date.now() }]; save()")
            load(a, files[name])
            a.page.click('#toast [data-undo]'); a.page.wait_for_timeout(120)
            check(f"{name}: Undo puts it all back", a.js("S.notes[0].id") == "mine" and a.js("S.name") == "Pat")
            check(f"{name}: the form shows it too", a.js("document.getElementById('setName').value") == "Pat")
            a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(120)
            check(f"{name}: closing Settings after Undo keeps it", a.js("S.name") == "Pat" and a.js("S.city") == "10001", (a.js("S.name"), a.js("S.city")))
            a.close()

        print("\n[5. photos: this phone's rows stay, the file's come back when the photo is here, the rest stay out]")
        STAY = "photos stay on the phone they were taken on"
        for name, path, key, show, box, thumb, sheet in (("Health Hub", T.HEALTHP, "hh", "showHh", "[data-hhvault]", "img[data-hhthumb]", "#hhSheet"),
                                                         ("Money Hub", T.MONEYP, "mh", "showMh", "#mhSheet [data-mvvault]", "img[data-mvthumb]", "#mhSheet")):
            a = open_hub(b, base, path)
            a.js(f"S.{key}.setup = true; save(); render(); {show}('vault')"); a.page.wait_for_timeout(250)
            a.page.set_input_files(box, PIC); a.page.wait_for_function(f"(S.{key}.vault || []).length === 1", timeout=8000)
            older = download(a, f"{key}_older.json")
            a.js(f"{show}('vault')"); a.page.wait_for_timeout(200)
            a.page.set_input_files(box, PIC); a.page.wait_for_function(f"S.{key}.vault.length === 2", timeout=8000)
            load(a, older)
            check(f"{name}: an older file doesn't hide a newer photo", a.js(f"S.{key}.vault.length") == 2, a.js(f"S.{key}.vault.length"))
            check(f"{name}: and it says nothing about photos, they're all here", STAY not in toast_text(a), toast_text(a))
            clear_sheets(a); a.page.click('[data-close="sheet"]')
            a.js(f"{show}('vault')")
            a.page.wait_for_function(f"[...document.querySelectorAll('{sheet} {thumb}')].filter(i => (i.getAttribute('src') || '').startsWith('data:')).length === 2", timeout=8000)
            check(f"{name}: both photos show", True)
            # Start fresh, then load: the photos never left this phone
            a.js("S = blank(); saveLocal(); 0"); a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
            load(a, older)
            check(f"{name}: after Start fresh the file's row comes back, its photo is here", a.js(f"S.{key}.vault.length") == 1, a.js(f"S.{key}.vault.length"))
            check(f"{name}: and no message about another phone", STAY not in toast_text(a), toast_text(a))
            check(f"{name}: saved, not just on screen", len(a.js(f"JSON.parse(localStorage.getItem(STORE)).{key}.vault")) == 1)
            clear_sheets(a); a.page.click('[data-close="sheet"]')
            a.js(f"{show}('vault')")
            a.page.wait_for_function(f"[...document.querySelectorAll('{sheet} {thumb}')].filter(i => (i.getAttribute('src') || '').startsWith('data:')).length === 1", timeout=8000)
            check(f"{name}: and that photo shows", True)
            a.close()
            a = open_hub(b, base, path)
            a.js("S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: 1 }]; save()")
            load(a, older)
            check(f"{name}: new phone: the file's data came", a.js(f"!!S.{key}.setup"))
            check(f"{name}: new phone: no rows for photos that aren't here", a.js(f"S.{key}.vault.length") == 0, a.js(f"S.{key}.vault.length"))
            check(f"{name}: new phone: it says where the photos are", STAY in toast_text(a), toast_text(a))
            check(f"{name}: new phone: and Undo is still there", a.js("!!document.querySelector('#toast [data-undo]')"))
            a.page.click('#toast [data-undo]'); a.page.wait_for_timeout(120)
            check(f"{name}: new phone: Undo works from that message", a.js("S.notes[0].id") == "mine")
            a.close()
        # Auto Hub
        def auto_setup(a):
            a.page.fill('form[data-autosetup] [name=city]', "83702"); a.page.fill('form[data-autosetup] [name=vin]', "1FA6P8CF0L5100001"); a.page.fill('form[data-autosetup] [name=miles]', "30000")
            a.page.click('form[data-autosetup] button'); a.page.wait_for_function("S.garage && S.garage.cars.length === 1")
            if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        AP = {"name": "car.png", "mimeType": "image/png", "buffer": T._png()}
        a = T.App(b, base, path=T.AUTOP, at="2026-10-01T09:00:00")
        auto_setup(a)
        cid = a.js("S.garage.cars[0].id")
        a.page.click(f'[data-acar="{cid}"]'); a.page.click('#autoSheet [data-atab="photos"]')
        a.page.set_input_files('#autoSheet [data-aphotoadd]', AP); a.page.wait_for_function("S.garage.cars[0].photos.length === 1 && S.garage.cars[0].thumb", timeout=8000)
        check("Auto Hub: a car photo still saves", a.js("S.garage.cars[0].photos.length") == 1)
        check("Auto Hub: its file box is empty after", a.js("[...document.querySelectorAll('#autoSheet [data-aphotoadd]')].every(i => !i.value)"))
        cover, thumb = a.js("S.garage.cars[0].cover"), a.js("S.garage.cars[0].thumb")
        older = download(a, "auto_older.json")
        a.js(f"showCar('{cid}', 'photos')"); a.page.wait_for_timeout(200)
        a.page.set_input_files('#autoSheet [data-aphotoadd]', AP); a.page.wait_for_function("S.garage.cars[0].photos.length === 2", timeout=8000)
        a.js("S.garage.cars.push({ id: 'later', year: 2021, make: 'Kia', model: 'Soul', photos: [] }); save(); render(); showCar('later', 'photos')"); a.page.wait_for_timeout(200)
        a.page.set_input_files('#autoSheet [data-aphotoadd]', AP); a.page.wait_for_function("S.garage.cars[1].photos.length === 1 && S.garage.cars[1].thumb", timeout=8000)
        later_cover, later_thumb = a.js("S.garage.cars[1].cover"), a.js("S.garage.cars[1].thumb")
        newer = download(a, "auto_newer.json")
        load(a, older)
        check("Auto Hub: an older file doesn't hide a newer photo", a.js("S.garage.cars[0].photos.length") == 2, a.js("S.garage.cars[0].photos.length"))
        check("Auto Hub: the cover stays", a.js("S.garage.cars[0].cover") == cover and a.js("S.garage.cars[0].thumb") == thumb)
        check("Auto Hub: a car added after the file goes with the file", a.js("S.garage.cars.length") == 1)
        a.page.click('#toast [data-undo]'); a.page.wait_for_timeout(120)
        check("Auto Hub: Undo brings that car back", a.js("S.garage.cars.length") == 2)
        load(a, older)
        check("Auto Hub: older file again, the later car's gone", a.js("S.garage.cars.length") == 1)
        load(a, newer)
        check("Auto Hub: then the newer file: the car and its photo row are back", a.js("S.garage.cars.length") == 2 and a.js("S.garage.cars[1].photos.length") == 1, a.js("S.garage.cars.map(c => c.photos.length).join()"))
        check("Auto Hub: and its cover and small picture", a.js("S.garage.cars[1].cover") == later_cover and a.js("S.garage.cars[1].thumb") == later_thumb)
        check("Auto Hub: no message, those photos are here", STAY not in toast_text(a), toast_text(a))
        a.js("S = blank(); saveLocal(); 0"); a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
        load(a, newer)
        check("Auto Hub: after Start fresh both cars have their photos", a.js("S.garage.cars.map(c => c.photos.length).join()") == "2,1", a.js("S.garage.cars.map(c => c.photos.length).join()"))
        clear_sheets(a); a.page.click('[data-close="sheet"]')
        a.js(f"showCar('{cid}', 'photos')")
        a.page.wait_for_function("[...document.querySelectorAll('#autoSheet img[data-aphoto]')].filter(i => (i.getAttribute('src') || '').startsWith('data:')).length === 2", timeout=8000)
        check("Auto Hub: and they show", True)
        a.close()
        a = open_hub(b, base, T.AUTOP)
        load(a, older)
        check("Auto Hub: new phone: the car came", a.js("S.garage.cars.length") == 1)
        check("Auto Hub: new phone: no rows for photos that aren't here", a.js("S.garage.cars[0].photos.length") == 0 and a.js("S.garage.cars[0].cover") == "")
        check("Auto Hub: new phone: the small cover picture comes along", a.js("S.garage.cars[0].thumb") == thumb)
        check("Auto Hub: new phone: it says where the photos are", STAY in toast_text(a), toast_text(a))
        a.close()
        # a car already on this phone keeps its own small picture, whatever an older file says
        a = open_hub(b, base, T.AUTOP)
        a.js("S.garage = { cars: [{ id: 'c1', year: 2020, make: 'Ford', model: 'F-150', cover: '', thumb: '', photos: [] }] }; save(); 0")
        p_old = os.path.join(tmp, "auto_cover_old.json")
        with open(p_old, "w", encoding="utf-8") as f: json.dump({"app": "autohub", "savedAt": "2026-09-01T12:00:00Z", "data": {"name": "Sam", "garage": {"cars": [{"id": "c1", "year": 2020, "make": "Ford", "model": "F-150", "cover": "gone", "thumb": "data:image/jpeg;base64,AAAA", "photos": [{"id": "gone", "tag": "car"}]}]}}}, f)
        load(a, p_old)
        check("Auto Hub: a removed cover's small picture doesn't come back", a.js("S.garage.cars[0].thumb") == "" and a.js("S.garage.cars[0].cover") == "", a.js("S.garage.cars[0].thumb"))
        a.close()

        print("\n[6. reminders and the AI's access to notes stay this phone's own choice]")
        for name, path in THREE:
            a = open_hub(b, base, path)
            a.js("S.remind.on = true; S.aiNotes = true; S.notes = [{ id: 'n', text: 'x', pinned: false, at: 1 }]; save()")
            file_on = download(a, f"{name}_on.json")
            a.close()
            a = open_hub(b, base, path)
            a.js("S.remind.on = false; delete S.aiNotes; save()")
            load(a, file_on)
            check(f"{name}: a file doesn't turn reminders on here without this phone's OK", a.js("S.remind.on") is False)
            check(f"{name}: it says so", "Reminders are off on this phone" in toast_text(a), toast_text(a))
            check(f"{name}: a file doesn't open notes to the AI", a.js("S.aiNotes === true") is False)
            file_off = download(a, f"{name}_off.json")
            a.js("S.remind.on = true; S.aiNotes = true; save()")
            load(a, file_off)
            check(f"{name}: a file doesn't turn reminders off here", a.js("S.remind.on") is True)
            check(f"{name}: and doesn't nag about them", "Reminders are off" not in toast_text(a), toast_text(a))
            check(f"{name}: a file doesn't change the AI choice", a.js("S.aiNotes") is True)
            a.close()

        print("\n[6a. the longest message fits a phone, and Undo stays on it]")
        a = open_hub(b, base, T.HEALTHP)
        LONG = "Restored from Oct 1, 9:00 AM. Reminders are off on this phone: turn them on in ⚙. Full-size photos stay on the phone they were taken on"
        for w in (390, 320):
            a.page.set_viewport_size({"width": w, "height": 800})
            a.page.evaluate("(m) => toast(m, true)", LONG); a.page.wait_for_timeout(350)
            box = a.js("(() => { const t = document.getElementById('toast').getBoundingClientRect(), u = document.querySelector('#toast [data-undo]').getBoundingClientRect(); return [t.left, t.right, u.left, u.right, innerWidth]; })()")
            check(f"at {w} wide it's all on the phone, Undo too", box[0] >= 0 and box[1] <= box[4] and box[2] >= 0 and box[3] <= box[4], box)
        a.page.evaluate("(m) => toast(m, true)", "Saved"); a.page.wait_for_timeout(350)
        check("a short message still sits on one line", a.js("document.getElementById('toast').getBoundingClientRect().height") < 60, a.js("document.getElementById('toast').getBoundingClientRect().height"))
        a.close()

        print("\n[6b. the same rules when it comes from Google Drive]")
        DRIVE = """(cloud) => { DTOKEN = 'tok'; DTOKEN_EXP = Date.now() + 3e6; driveSignIn = async () => true; driveDownload = async () => cloud; driveUpload = async () => {}; setOwnerSwitch('OWNER', true); }"""
        CLOUD = {"savedAt": "2027-01-01T12:00:00Z", "data": {"name": "Sam", "city": "80202", "aiNotes": True, "remind": {"on": True, "fired": {}}, "notes": [{"id": "fromcloud", "text": "Cloud", "pinned": False, "at": 1}],
                 "hh": {"setup": "2026-01-01", "vault": [{"id": "elsewhere", "type": "insurance", "title": "t", "date": "2026-09-30"}]}}}
        a = open_hub(b, base, T.HEALTHP)
        a.page.evaluate(DRIVE, CLOUD)
        a.js("S.remind.on = false; delete S.aiNotes; save(); 0")
        a.page.evaluate("restoreNow()"); a.page.wait_for_timeout(300)
        check("Restore from Drive: it came", a.js("S.notes[0].id") == "fromcloud")
        check("Restore from Drive: reminders stay this phone's, and it says so", a.js("S.remind.on") is False and "Reminders are off on this phone" in toast_text(a), toast_text(a))
        check("Restore from Drive: the AI choice stays this phone's", a.js("S.aiNotes === true") is False)
        check("Restore from Drive: no rows for photos that aren't here, and it says so", a.js("S.hh.vault.length") == 0 and "photos stay on the phone" in toast_text(a), toast_text(a))
        a.close()
        a = open_hub(b, base, T.HEALTHP)
        a.page.evaluate(DRIVE, CLOUD)
        a.js("S.remind.on = false; S.sync = { on: true, last: '', dirty: false }; S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: 1 }]; saveLocal(); 0")
        a.js("openSettings()"); a.page.wait_for_timeout(100); a.page.fill("#setName", "Typing now")
        a.page.evaluate("syncDrive()"); a.page.wait_for_timeout(300)
        check("Background sync: it came", a.js("S.notes[0].id") == "fromcloud", a.js("S.notes[0].id"))
        check("Background sync: quiet about reminders and photos", "Reminders are off" not in toast_text(a) and "photos stay" not in toast_text(a), toast_text(a))
        check("Background sync: reminders stay this phone's", a.js("S.remind.on") is False)
        check("Background sync: leaves a half-typed name alone", a.js("document.getElementById('setName').value") == "Typing now")
        a.close()
        a = open_hub(b, base, T.MONEYP)
        a.page.evaluate(DRIVE, {"savedAt": "2027-01-01T12:00:00Z", "data": {"name": "Sam", "notes": [{"id": "n", "text": "x", "at": 1}], "mh": {"setup": "2026-01-01", "accounts": [None]}}})
        a.js("S.name = 'Pat'; S.notes = [{ id: 'keep', text: 'Keep me', pinned: false, at: 1 }]; save(); 0")
        a.page.evaluate("restoreNow()"); a.page.wait_for_timeout(300)
        check("A damaged Drive copy changes nothing and says so", a.js("S.notes[0].id") == "keep" and "Nothing changed" in toast_text(a), toast_text(a))
        a.close()

        print("\n[7. a damaged file can't wreck the phone]")
        for name, path, data, app in (("Money Hub", T.MONEYP, {"mh": {"setup": "2026-01-01", "accounts": [None]}}, "moneyhub"), ("Auto Hub", T.AUTOP, {"garage": {"cars": [None]}}, "autohub")):
            bad = os.path.join(tmp, f"{app}_bad.json")
            with open(bad, "w", encoding="utf-8") as f: json.dump({"app": app, "savedAt": "2026-09-01T12:00:00Z", "data": data}, f)
            a = open_hub(b, base, path)
            a.js("S.name = 'Pat'; S.notes = [{ id: 'keep', text: 'Keep me', pinned: false, at: 1 }]; save(); 0")
            load(a, bad)
            check(f"{name}: it says nothing changed", "Nothing changed" in toast_text(a), toast_text(a))
            check(f"{name}: and nothing did, on screen", a.js("S.notes[0].id") == "keep" and a.js("S.name") == "Pat")
            stored = a.js("JSON.parse(localStorage.getItem(STORE))")
            check(f"{name}: or in storage, right after the load", stored["notes"][0]["id"] == "keep" and stored["name"] == "Pat", str(stored)[:120])
            a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
            check(f"{name}: reopened with Settings never closed: still there, no can't-open page", a.js("S.notes[0].id") == "keep" and "won't open" not in a.js("document.body.innerText"))
            a.close()

        payload_run(b, base)
        others_side_by_side()
        # the same thing through a real file
        a = open_hub(b, base, T.AUTOP)
        a.js("window.__pwn = []; window.__p = i => window.__pwn.push(i); 0")   # the 0: Playwright calls a function the expression ends on
        PAY = "'\"><img src=data:,x onerror=__p(%d)>"
        evil = copy.deepcopy(AUTO); evil["garage"]["cars"][0]["thumb"] = [PAY % 1]; evil["garage"]["cars"][0]["miles"] = PAY % 2; evil["garage"]["cars"][0]["id"] = [PAY % 3]
        p_evil = os.path.join(tmp, "evil.json")
        with open(p_evil, "w", encoding="utf-8") as f: json.dump({"app": "autohub", "savedAt": "2026-09-01T12:00:00Z", "data": evil}, f)
        load(a, p_evil)
        a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(500)
        check("Auto Hub: a real file with a bad picture, miles and id ran nothing", a.js("window.__pwn.length") == 0, a.js("window.__pwn"))
        a.close()

        print("\n[9. honest values aren't touched]")
        a = open_hub(b, base, T.AUTOP)
        honest = a.js("""normalize({ name: 'Sam', notes: [{ id: 'n', text: 'He said "hi" <today>', at: 1 }],
            garage: { cars: [{ id: 'c', make: 'Ford', model: 'F-150', miles: '30,000', paid: '$12,000.50', thumb: 'data:image/jpeg;base64,AAAA/+=', notes: [{ id: 'm', text: 'Dad\\'s "good" truck' }], mech: [{ id: 'q', q: 'Why "ping" <at 60>?' }] }] },
            mh: { accounts: [{ id: 'a', name: 'Joe\\'s "Big" <Bank>', bal: '1,200.50', kind: 'checking' }] },
            hh: { setup: 'x', card: { notes: 'Takes "A" <then> B' }, meds: [{ id: 'm', name: 'A "B" <C>', times: ['08:00', '8:30'] }] } })""")
        check("a note keeps its quotes", honest["notes"][0]["text"] == 'He said "hi" <today>')
        c = honest["garage"]["cars"][0]
        check("miles and paid with commas and $ stay", c["miles"] == "30,000" and c["paid"] == "$12,000.50")
        check("a real picture stays", c["thumb"] == "data:image/jpeg;base64,AAAA/+=")
        check("a car's note and a question keep theirs", c["notes"][0]["text"] == "Dad's \"good\" truck" and c["mech"][0]["q"] == 'Why "ping" <at 60>?')
        check("an account's name keeps its quotes, its balance stays", honest["mh"]["accounts"][0]["name"] == 'Joe\'s "Big" <Bank>' and honest["mh"]["accounts"][0]["bal"] == "1,200.50")
        check("the emergency card keeps its words", honest["hh"]["card"]["notes"] == 'Takes "A" <then> B')
        a.close()
        # the AI Mechanic's own words, on the screen
        a = open_hub(b, base, T.AUTOP)
        a.js("""S.garage = { cars: [{ id: 'c', year: 2020, make: 'Ford', model: 'F-150', mech: [{ id: 'm', date: '2026-09-01', q: 'Why?', a: { urgency: 'soon', summary: 's', check: 'Is the "check engine" light flashing?', shop: 'Say "now" <today>', causes: [{ cause: 'Plug', why: 'w', likely: 'high', diy: 'easy', cost: '<$50' }] } }] }] }; save(); render(); showCar('c', 'mech'); 0""")
        a.page.wait_for_timeout(150)
        shown = a.page.inner_text("#autoSheet")
        check("the AI Mechanic's check and cost keep their quotes and brackets, stored", a.js("S.garage.cars[0].mech[0].a.check") == 'Is the "check engine" light flashing?' and a.js("S.garage.cars[0].mech[0].a.causes[0].cost") == "<$50")
        a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
        check("and after reopening", a.js("S.garage.cars[0].mech[0].a.check") == 'Is the "check engine" light flashing?' and a.js("S.garage.cars[0].mech[0].a.causes[0].cost") == "<$50")
        check("and on the screen, once each, not as codes", 'Is the "check engine" light flashing?' in shown and "<$50" in shown and "&quot;" not in shown and "&lt;" not in shown, shown[:200])
        a.close()
        # values in forms come back exactly as stored
        a = open_hub(b, base, T.AUTOP)
        a.js("""S.garage = { gas: '3.49 "reg"', cars: [{ id: 'c', year: 2020, make: 'Ford', model: 'F-150', miles: '30,000', paid: '$12,000.50', price: 'a "b" <c>', every: { oil: [5000, 6] }, fuel: [{ id: 'f', date: '2026-09-20', miles: 100, gal: '10.5', cost: 30 }] }] }; save(); render(); showCar('c', 'overview'); 0""")
        a.page.wait_for_timeout(120)
        check("Auto Hub: paid and asking price read back as stored", a.js("document.querySelector('#autoSheet [name=paid]').value") == "$12,000.50" and a.js("document.querySelector('#autoSheet form[data-aprice] [name=price]').value") == 'a "b" <c>')
        check("Auto Hub: miles reads back as stored", a.js("document.querySelector('#autoSheet form[data-aedit] [name=miles]').value") == "30,000")
        a.js("showCar('c', 'fuel'); 0"); a.page.wait_for_timeout(120)
        check("Auto Hub: gas price reads back as stored", a.js("document.querySelector('#autoSheet form[data-atrip] [name=price]').value") == '3.49 "reg"')
        check("Auto Hub: a fill-up shows its gallons", "10.5 gal" in a.page.inner_text("#autoSheet"))
        a.js("showCar('c', 'service'); 0"); a.page.wait_for_timeout(120)
        a.js("document.querySelector('#autoSheet details.auto-every')?.setAttribute('open', ''); document.querySelector('#autoSheet [data-aeveryreset=oil]').click(); 0"); a.page.wait_for_timeout(120)
        check("Auto Hub: resetting your own interval still works", not a.js("(S.garage.cars[0].every || {}).oil"))
        a.close()
        a = open_hub(b, base, T.MONEYP)
        a.js("""S.mh.setup = 'x'; S.mh.accounts = [{ id: 'a', kind: 'checking', name: 'Joe', bal: '1,200.50', at: today() }]; S.mh.budgets = { 'a&b': 50, food: 20 }; S.mh.payCash = 300; S.mh.payCheck = 1500; S.bills = [{ id: 'b', name: 'Rent', amount: 900, day: 15, cat: 'bills' }]; save(); render(); showMh('accounts'); 0""")
        a.page.wait_for_timeout(120)
        check("Money Hub: a balance reads back as stored", a.js("document.querySelector('#mhSheet [name=bal]').value") == "1,200.50")
        a.js("showMh('bills'); 0"); a.page.wait_for_timeout(120)
        check("Money Hub: cash and paycheck read back", a.js("document.querySelector('#mhSheet [name=cash]').value") == "300" and a.js("document.querySelector('#mhSheet [name=check]').value") == "1500")
        a.js("MH_PEDIT = 'b'; showMh('bills'); MH_PEDIT = null; 0"); a.page.wait_for_timeout(120)
        check("Money Hub: a bill's amount and day read back", a.js("document.querySelector('#mhSheet [name=amount]').value") == "900" and a.js("document.querySelector('#mhSheet [name=day]').value") == "15")
        a.js("showMh('budget'); 0"); a.page.wait_for_timeout(120)
        keys = a.js("[...document.querySelectorAll('#mhSheet [data-mhbudgetoff]')].map(x => x.dataset.mhbudgetoff)")
        check("Money Hub: a budget's remove button carries its name exactly", "a&b" in keys and "food" in keys, keys)
        a.js("document.querySelector('#mhSheet [data-mhbudgetoff=food]').click(); 0"); a.page.wait_for_timeout(120)
        check("Money Hub: and still removes it", "food" not in a.js("Object.keys(S.mh.budgets)"))
        a.close()
        a = open_hub(b, base, T.HEALTHP)
        a.js("""S.hh = { setup: 'x', goals: { water: 8, steps: 6000, sleep: 7.5 }, meds: [{ id: 'm', name: 'A', times: ['08:00', '8:30'] }], sleep: [{ id: 's', date: '2026-10-01', bed: '22:00', wake: '06:00', hrs: 8, q: 4 }], workouts: [{ id: 'w', date: '2026-10-01', type: 'walk', min: 30, sets: 3, reps: 10, wt: 20 }] }; save(); render(); showHh('meds'); 0""")
        a.page.wait_for_timeout(120)
        check("Health Hub: dose times aren't touched", a.js("hh().meds[0].times.join()") == "08:00,8:30", a.js("hh().meds[0].times.join()"))
        a.js("document.querySelector('.hh-take').click(); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: Taken still works", a.js("hhDoses(today()).filter(d => d.st === 'taken').length") == 1)
        a.js("showHh('goals'); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: goals read back", a.js("document.querySelector('#hhSheet [name=sleep]').value") == "7.5")
        a.js("showHh('sleep'); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: a night's quality reads 4/5", "4/5" in a.page.inner_text("#hhSheet"))
        a.js("showHh('move'); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: a workout reads as logged", "30 min" in a.page.inner_text("#hhSheet") and "3×10" in a.page.inner_text("#hhSheet") and "@ 20 lb" in a.page.inner_text("#hhSheet"))
        a.close()
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
