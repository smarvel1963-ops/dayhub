"""
SAVE AS: test_pet.py   LOCATION: C:/MarvelApps/dayhub/tests/test_pet.py

PET HUB (app #10, Scott 11/13: "Pet Hub" -> "Yes, build it"; board 1 = the look). Drives the real Pet Hub page (/pethub/, pet.js +
pettiles.css) with the main suite's helpers and made-up pets (no real animals or people). Checks: its own name, id and data; the
first-run "add your pet" form (species, birthday or estimated age, Gotcha Day, a profile photo kept on the phone); Our Happy Crew;
each pet's page (age, countdowns, milestone, the whole app wearing that pet's colour); the starter routine and ticking care off;
shots, vet visits, medicines (Given takes one off the count), weight + chart; memories (First Day Home, a photo memory, Then & Now,
the slideshow); Birthdays & Ages (alerts, the calendar, upcoming); the passport; reminders and Life pulse; Ask's context;
Rainbow Bridge; removing a pet; Erase knows the photo store; the phone's back button; narrow phones; no page errors.

RUN:   python tests/test_pet.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

AT = "2026-11-12T14:00:00"      # Thursday Nov 12 2026, 2 PM
PETP = "/../pethub/"

def photo(color):
    from PIL import Image
    p = os.path.join(tempfile.gettempdir(), f"pethub_test_{color[0]}_{color[1]}.png")
    Image.new("RGB", (800, 600), color).save(p); return p

def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(250)
def sheet(a): return a.page.inner_text("#ptSheet") if a.page.locator("#ptSheet:not(.hidden)").count() else ""

def start(b, base, width=390, height=844):
    a = T.App(b, base, path=PETP, at=AT, width=width, height=height, look=None)
    return a

def first_pet(a):
    a.page.click('form[data-ptpetform=setup] label:has(> input[name=species][value=dog]) > span')
    a.page.fill('form[data-ptpetform=setup] [name=owner]', "Scott")
    a.page.fill('form[data-ptpetform=setup] [name=name]', "Biscuit")
    a.page.fill('form[data-ptpetform=setup] [name=breed]', "Golden Retriever")
    a.page.fill('form[data-ptpetform=setup] [name=bday]', "2021-11-20")
    a.page.fill('form[data-ptpetform=setup] [name=gotcha]', "2022-01-15")
    a.page.set_input_files('form[data-ptpetform=setup] input[data-ptphoto]', photo((240, 190, 110)))
    a.page.wait_for_function("PT_PENDING && PT_PENDING.startsWith('data:image/jpeg')")
    a.page.click('form[data-ptpetform=setup] button.pt-cta'); a.page.wait_for_function("S.pt && S.pt.setup && S.pt.pets.length === 1")
    a.page.wait_for_timeout(300)


def test_first_run(b, base):
    print("\n[Pet Hub: its own app, the first-run form, Our Happy Crew]")
    a = start(b, base)
    check("its own name, id and data", a.js("[MODE, APP_NAME, APP_ID, STORE, TRAVEL]") == ["pet", "Pet Hub", "pethub", "pethub.v1", False] and a.page.title() == "Pet Hub")
    check("first run is the Add Your Pet form, with all 8 species", a.page.locator("#cards form[data-ptpetform=setup]").count() == 1
          and a.js("document.querySelectorAll('#cards .pt-species input').length") == 8)
    check("the Day Hub hero and ＋ button are hidden in Pet Hub", a.js("getComputedStyle(document.getElementById('hero')).display") == "none"
          and a.js("getComputedStyle(document.getElementById('fab')).display") == "none")
    first_pet(a)
    p = a.js("S.pt.pets[0]")
    check("Biscuit saved: dog, breed, birthday, Gotcha Day, a photo id", p["name"] == "Biscuit" and p["species"] == "dog" and p["breed"] == "Golden Retriever"
          and p["bday"] == "2021-11-20" and p["gotcha"] == "2022-01-15" and bool(p.get("photo")), p)
    check("your first name kept", a.js("S.name") == "Scott")
    check("the starter routine for a dog: breakfast, morning walk, dinner, evening walk", a.js("S.pt.care.map(c => c.title).join()") == "Breakfast,Morning walk,Dinner,Evening walk")
    check("the profile photo became the First Day Home memory", a.js("S.pt.mems.length === 1 && S.pt.mems[0].kind === 'home' && S.pt.mems[0].date === '2022-01-15'"))
    check("the photo lives in this phone's own store (pethub.photos), not in the saved data", a.js("JSON.stringify(S.pt).includes('data:image')") is False
          and a.js("(async () => !!(await ptIdb('readonly', s => s.get(S.pt.pets[0].photo))))()"))
    home = a.page.inner_text("#cards")
    check("home = Our Happy Crew / All My Pets with Biscuit's card", "Our Happy Crew" in home and "All My Pets" in home and a.page.locator("#cards .pt-card").count() == 1 and "Biscuit" in home)
    a.page.wait_for_timeout(300)
    check("Biscuit's card shows his photo", (a.js("document.querySelector('#cards .pt-card img[data-ptimg]').src") or "").startswith("data:image/jpeg"))
    check("the Pet Hub bar: My Pets, Birthdays, Memories, More", a.js("[...document.querySelectorAll('#ptNav button')].map(b => b.textContent.trim()).join('|')") == "🐾My Pets|🎂Birthdays|🖼️Memories|•••More")
    check("on home, the bar lights My Pets", a.js("document.querySelector('#ptNav button.on').textContent.trim()") == "🐾My Pets")
    check("Household Tasks lists today's 4 care items", a.js("document.querySelectorAll('#cards .pt-tasks .pt-task').length") == 4)
    check("Birthday Alerts: Biscuit turns 5 in 8 days (Nov 20)", "Biscuit turns 5 in 8 days!" in home and "Nov 20" in home)
    a.close()


def test_pet_page_and_care(b, base):
    print("\n[One pet's page, a second pet, the colour follows the pet, care]")
    a = start(b, base); first_pet(a)
    check("age: 4 yrs 11 mos (Nov 20 2021 -> Nov 12 2026)", a.js("ptAgeTxt(S.pt.pets[0])") == "4 yrs 11 mos", a.js("ptAgeTxt(S.pt.pets[0])"))
    check("long age: 4 years, 11 months, 23 days", a.js("ptAgeTxt(S.pt.pets[0], 'long')") == "4 years, 11 months, 23 days", a.js("ptAgeTxt(S.pt.pets[0], 'long')"))
    check("next birthday: Nov 20 2026, turns 5, in 8 days", a.js("JSON.stringify(ptNextBday(S.pt.pets[0]))") == '{"date":"2026-11-20","days":8,"turns":5}')
    check("Feb 29 birthdays come round on Feb 28 in other years", a.js("ptNextMD('2024-02-29')") == "2027-02-28")
    tap(a, '#cards .pt-card')
    s = sheet(a)
    check("tapping the card opens Biscuit's page: age, countdowns, Our Memories", "Biscuit" in s and "4 years, 11 months, 23 days" in s and "days to birthday #5" in s and "Our Memories" in s)
    check("the next milestone is his 5th birthday", "5 years old" in s)
    # a second pet: rescue, estimated age
    tap(a, '#ptSheet [data-pttab=more]'); tap(a, '#ptSheet [data-ptnew]')
    a.page.click('#ptSheet label:has(> input[name=species][value=cat]) > span')
    a.page.fill('#ptSheet [name=name]', "Mochi")
    a.page.check('#ptSheet input[name=agehow][value=est]')
    check("choosing 'about how old' swaps the birthday box for years + months", a.page.locator("#ptSheet [name=bday]").is_visible() is False and a.page.locator("#ptSheet [name=ey]").is_visible())
    a.page.fill('#ptSheet [name=ey]', "2"); a.page.fill('#ptSheet [name=em]', "4")
    a.page.click('#ptSheet label:has(> input[name=color][value="#86bdf5"]) > span')
    tap(a, '#ptSheet form[data-ptpetform] button.pt-cta')
    m = a.js("S.pt.pets[1]")
    check("Mochi saved as an estimated age (about 2 yrs 4 mos), current pet", m["name"] == "Mochi" and m["est"] is True and a.js("ptAgeTxt(S.pt.pets[1])") == "about 2 yrs 4 mos" and a.js("S.pt.cur") == m["id"], a.js("ptAgeTxt(S.pt.pets[1])"))
    check("the whole app wears Mochi's colour", a.js("document.body.style.getPropertyValue('--pt-tone')") == "#86bdf5")
    check("a cat's starter routine has the litter box", "Scoop the litter" in a.js("S.pt.care.filter(c => c.pet === S.pt.pets[1].id).map(c => c.title).join()"))
    check("the pet picker shows both pets", a.js("document.querySelectorAll('#ptSheet .pt-picker button').length") == 2)
    tap(a, '#ptSheet .pt-picker [data-ptpick="%s"]' % a.js("S.pt.pets[0].id"))
    check("picking Biscuit turns the app to his colour", a.js("document.body.style.getPropertyValue('--pt-tone')") == a.js("S.pt.pets[0].color"))
    # care
    tap(a, '#ptSheet [data-ptclose]')
    n0 = a.js("document.querySelectorAll('#cards .pt-tasks .pt-check.on').length")
    tap(a, '#cards .pt-tasks .pt-check')
    check("ticking a care item marks it done and saves", a.js("document.querySelectorAll('#cards .pt-tasks .pt-check.on').length") == n0 + 1 and a.js("Object.keys(S.pt.done[today()] || {}).length") == 1)
    a.js("S.pt.cur = S.pt.pets[0].id; save(); showPt('care')")
    a.page.select_option('#ptSheet form[data-ptcare] [name=kind]', "groom"); a.page.fill('#ptSheet form[data-ptcare] [name=title]', "Brush coat")
    a.page.select_option('#ptSheet form[data-ptcare] [name=every]', "weekly"); a.page.select_option('#ptSheet form[data-ptcare] [name=dow]', "6")
    tap(a, '#ptSheet form[data-ptcare] button.pt-cta')
    check("a weekly care item (Saturdays) is added and only falls on Saturdays", a.js("(() => { const c = S.pt.care.find(x => x.title === 'Brush coat'); return [ptCareOn(c, '2026-11-14'), ptCareOn(c, '2026-11-13')]; })()") == [True, False])
    a.close()


def test_health(b, base):
    print("\n[Health & Records: shots, vet, medicines, weight]")
    a = start(b, base); first_pet(a)
    a.js("showPt('health')")
    tap(a, '#ptSheet [data-ptform=shot]')
    a.page.fill('#ptSheet form[data-ptshot] [name=name]', "Rabies"); a.page.fill('#ptSheet form[data-ptshot] [name=due]', "2026-11-17")
    tap(a, '#ptSheet form[data-ptshot] button.pt-cta')
    check("shot saved with its due date and shown as due", a.js("S.pt.shots[0].name") == "Rabies" and "Due in 5 days" in sheet(a))
    tap(a, '#ptSheet [data-ptform=visit]')
    a.page.fill('#ptSheet form[data-ptvisit] [name=date]', "2026-11-13"); a.page.fill('#ptSheet form[data-ptvisit] [name=time]', "10:00")
    a.page.fill('#ptSheet form[data-ptvisit] [name=vet]', "Elm Street Vet"); a.page.fill('#ptSheet form[data-ptvisit] [name=reason]', "Yearly checkup")
    tap(a, '#ptSheet form[data-ptvisit] button.pt-cta')
    check("vet visit saved; the vet becomes Biscuit's regular vet", a.js("S.pt.visits.length") == 1 and a.js("S.pt.pets[0].vet") == "Elm Street Vet")
    tap(a, '#ptSheet [data-ptform=med]')
    a.page.fill('#ptSheet form[data-ptmed] [name=name]', "Joint chew"); a.page.fill('#ptSheet form[data-ptmed] [name=dose]', "1 chew")
    a.page.fill('#ptSheet form[data-ptmed] [name=t1]', "18:00"); a.page.fill('#ptSheet form[data-ptmed] [name=left]', "10")
    tap(a, '#ptSheet form[data-ptmed] button.pt-cta')
    check("medicine saved exactly as typed, with today's 6 PM dose", a.js("S.pt.meds[0].dose") == "1 chew" and a.js("ptDoses(today()).length") == 1)
    tap(a, '#ptSheet [data-ptdose][data-ptst=taken]')
    check("Given logs the dose and takes one off the count (10 -> 9)", a.js("Object.values(S.pt.doses[today()])[0]") == "taken" and a.js("S.pt.meds[0].left") == 9)
    tap(a, '#ptSheet [data-ptform=weight]'); a.page.fill('#ptSheet form[data-ptweight] [name=lb]', "62.5"); a.page.fill('#ptSheet form[data-ptweight] [name=date]', "2026-10-01")
    tap(a, '#ptSheet form[data-ptweight] button.pt-cta')
    tap(a, '#ptSheet [data-ptform=weight]'); a.page.fill('#ptSheet form[data-ptweight] [name=lb]', "64")
    tap(a, '#ptSheet form[data-ptweight] button.pt-cta')
    check("two weigh-ins draw the growth chart", a.js("S.pt.weights.length") == 2 and a.page.locator("#ptSheet svg.pt-chart").count() == 1)
    check("Needs you lists the shot due soon and the vet visit tomorrow", (lambda N: "Rabies" in N and "vet visit" in N)(a.js("ptNeeds().map(x => x.text).join('|')")))
    R = a.js("S.remind.on = true; reminderList().map(r => r.key).join('|')")
    check("reminders: care times, the dose, the vet visit the evening before, the birthday a week ahead", all(k in R for k in ["ptc:", "ptd:", "ptv:", "ptb:"]), R[:300])
    check("Life pulse carries Pet Hub's needs", a.js("pulseItems().some(x => /Rabies|vet visit/.test(x.text))"))
    ctx = a.js("JSON.parse(aiContext()).pets")
    check("Ask reads the pets (name, age, shots, meds as typed) and never a photo", ctx and ctx["pets"][0]["name"] == "Biscuit" and ctx["pets"][0]["shots"][0]["name"] == "Rabies"
          and "data:image" not in str(ctx) and "never give veterinary advice" in ctx["about"].lower())
    a.close()


def test_memories_birthdays_passport(b, base):
    print("\n[Memory Moments, Birthdays & Ages, the passport, the slideshow]")
    a = start(b, base); first_pet(a)
    a.js("showPt('mem')")
    s = sheet(a)
    check("Biscuit's Life Journey starts with First Day Home", "Biscuit's Life Journey" in s and "First Day Home" in s)
    check("his First Birthday is on the timeline (Nov 20 2022)", "First Birthday" in s and "Nov 20, 2022" in s)
    tap(a, '#ptSheet [data-ptmemnew="1"]')
    a.page.click('#ptSheet label:has(> input[name=kind][value=adv]) > span')
    a.page.fill('#ptSheet form[data-ptmem] [name=title]', "Beach Adventure"); a.page.fill('#ptSheet form[data-ptmem] [name=date]', "2024-08-20")
    a.page.set_input_files('#ptSheet input[data-ptmempic]', photo((90, 170, 220)))
    a.page.wait_for_function("PT_MEMPIC && PT_MEMPIC.startsWith('data:image/jpeg')")
    tap(a, '#ptSheet form[data-ptmem] button.pt-cta'); a.page.wait_for_timeout(300)
    s = sheet(a)
    check("the memory is saved with its photo and age at the time", a.js("S.pt.mems.length") == 2 and "Beach Adventure" in s and "age 2 yrs 9 mos" in s, s[:400])
    check("Then & Now appears once there are two photos", "Then & Now" in s and a.page.locator("#ptSheet .pt-thennow figure").count() == 2)
    check("the scrapbook shows both photos", a.page.locator("#ptSheet .pt-scrap figure").count() == 2)
    tap(a, '#ptSheet [data-ptshow]'); a.page.wait_for_timeout(400)
    check("the slideshow plays the photos oldest first and ends with the birthday wish", a.page.locator("#ptShow:not(.hidden) .pt-slides figure").count() == 4
          and "Happy early birthday, Biscuit!" in a.page.inner_text("#ptShow"))
    tap(a, '#ptShow [data-ptshowclose]')
    check("the slideshow closes", a.page.locator("#ptShow.hidden").count() == 1)
    a.js("showPt('bday')")
    s = sheet(a)
    check("Birthdays: 'Biscuit turns 5 in 8 days!' + upcoming list + ages at a glance", "Biscuit turns 5" in s and "in 8 days!" in s and "Upcoming Pet Birthdays" in s and "Pet Ages at a Glance" in s)
    check("the calendar marks Nov 20 with a paw", a.js("[...document.querySelectorAll('#ptSheet .pt-calgrid .mark')].length") == 1)
    tap(a, '#ptSheet [data-ptmonth="1"]')
    check("next month (December) has no marks", "December 2026" in sheet(a) and a.js("document.querySelectorAll('#ptSheet .pt-calgrid .mark').length") == 0)
    a.js("PT_MONTH = 0; showPt('pass')")
    a.page.fill('#ptSheet form[data-ptpass] [name=chip]', "985112003456789"); a.page.fill('#ptSheet form[data-ptpass] [name=evet]', "Night Paws ER")
    a.page.fill('#ptSheet form[data-ptpass] [name=evetPh]', "555-0199")
    tap(a, '#ptSheet form[data-ptpass] button.pt-cta')
    s = sheet(a)
    check("the passport shows the microchip, the emergency vet to call, and poison control", "985112003456789" in s and "Night Paws ER" in s and "ASPCA Animal Poison Control" in s
          and a.page.locator('#ptSheet a[href="tel:5550199"]').count() == 1)
    a.close()


def test_bridge_remove_erase(b, base):
    print("\n[Rainbow Bridge, removing a pet, Erase, the back button, narrow phones]")
    a = start(b, base); first_pet(a)
    a.js("""(() => { const P = pt(); P.pets.push({ id: 'mo', name: 'Mochi', species: 'cat', bday: '2015-03-02', est: false, color: '#c3a8f5', photo: '' });
      P.care.push({ id: 'mc', pet: 'mo', kind: 'feed', title: 'Mochi breakfast', every: 'daily', times: ['07:00'], from: '2026-01-01' }); save(); render(); })()""")
    a.js("PT_EDIT = 'mo'; S.pt.cur = 'mo'; showPt('add')")
    tap(a, '#ptSheet [data-ptbridgeask]')
    a.page.fill('#ptSheet form[data-ptbridge] [name=date]', "2026-11-01"); tap(a, '#ptSheet form[data-ptbridge] button.pt-cta')
    s = sheet(a)
    check("Rainbow Bridge: a gentle memorial page with her dates", "Forever in our hearts" in s and "Mochi" in s and "Nov 1" in s)
    check("her care stops: no task and no reminder for Mochi", "Mochi breakfast" not in a.js("ptCareDue(today()).map(x => x.c.title).join()")
          and "mc|" not in a.js("S.remind.on = true; reminderList().map(r => r.key).join('|')"))
    tap(a, '#ptSheet [data-ptclose]')
    check("home keeps her in 'In loving memory', off the happy-crew grid", "In loving memory" in a.page.inner_text("#cards") and a.page.locator("#cards .pt-grid .pt-card").count() == 1)
    a.js("PT_EDIT = 'mo'; showPt('add')")
    tap(a, '#ptSheet [data-ptremove]')
    check("Remove asks for a second tap first", a.js("S.pt.pets.length") == 2 and "Tap again" in sheet(a))
    tap(a, '#ptSheet [data-ptremove]')
    check("the second tap removes Mochi and everything saved for her", a.js("S.pt.pets.length") == 1 and a.js("S.pt.care.some(c => c.pet === 'mo')") is False)
    check("Erase knows Pet Hub's own photo store (and no other Hub's)", a.js("ERASE_DBS.pet") == "pethub.photos")
    a.js("showPt('pet')"); tap(a, '#ptSheet [data-pttab=health]')
    check("inside a page, ← goes back to the page before", a.page.locator("#ptSheet .pt-back").count() == 1)
    a.page.go_back(); a.page.wait_for_timeout(300)
    check("the phone's back button walks back (health -> Biscuit's page)", a.page.locator("#ptSheet:not(.hidden)").count() == 1 and a.js("PT_TAB") == "pet")
    a.page.go_back(); a.page.wait_for_timeout(300)
    check("and back again closes Pet Hub's page, leaving the app open on home", a.page.locator("#ptSheet.hidden").count() == 1 and "Our Happy Crew" in a.page.inner_text("#cards"))
    a.close()
    for w, h in [(360, 740), (820, 1180)]:
        a = start(b, base, width=w, height=h); first_pet(a)
        wide = a.js("document.documentElement.scrollWidth > innerWidth + 1")
        a.js("showPt('pet')"); a.page.wait_for_timeout(200)
        wide2 = a.js("[...document.querySelectorAll('#ptSheet .sheet-body')].some(b => b.scrollWidth > b.clientWidth + 1)")
        check(f"no sideways scrolling at {w}px (home and a pet's page)", not wide and not wide2)
        a.close()


def test_review_fixes(b, base):
    print("\n[Review fixes 11/13: photos kept apart, estimated ages, ages never negative, dose undo, back button, outside data checked]")
    a = start(b, base); first_pet(a)
    check("the First Day Home memory has its OWN photo copy (deleting it keeps the profile photo)", a.js("S.pt.mems[0].photo !== S.pt.pets[0].photo && !!S.pt.mems[0].photo"))
    a.js("showPt('mem')"); a.page.click(f'#ptSheet [data-ptdel="mems:{a.js("S.pt.mems[0].id")}"]'); a.page.wait_for_timeout(300)
    check("...and after deleting that memory the profile photo is still there", a.js("(async () => !!(await ptIdb('readonly', s => s.get(S.pt.pets[0].photo))))()"))
    check("ages never go negative: Jan 31 -> Mar 1 is 1 month, 1 day", a.js("JSON.stringify(ptAge('2026-01-31', '2026-03-01'))") == '{"y":0,"m":1,"d":1}')
    check("a birthday typed as today is day 0: the first birthday is next year (turns 1)", a.js("(() => { const p = { bday: today() }; const b = ptNextBday(p); return b.turns === 1 && b.days === 365; })()"))
    a.js("""(() => { const P = pt(); P.pets.push({ id: 'r1', name: 'Rex', species: 'dog', bday: '', est: false, color: '#6fd3c1', photo: '' }); save(); PT_EDIT = 'r1'; S.pt.cur = 'r1'; showPt('add'); })()""")
    a.page.check('#ptSheet input[name=agehow][value=est]'); a.page.fill('#ptSheet [name=ey]', "3"); a.page.fill('#ptSheet [name=em]', "0")
    a.page.click('#ptSheet form[data-ptpetform] button.pt-cta'); a.page.wait_for_timeout(300)
    bd = a.js("ptPet('r1').bday")
    check("an estimated age gets no birthday countdown, party or reminder (no 'turns 3 today')", a.js("ptNextBday(ptPet('r1'))") is None and a.js("ptMilestone(ptPet('r1'))") is None
          and "ptb:r1" not in a.js("S.remind.on = true; reminderList().map(r => r.key).join('|')"))
    a.page.clock.fast_forward(9 * 86400000)           # nine days later, open and save again without touching the age
    a.js("PT_EDIT = 'r1'; showPt('add')"); a.page.click('#ptSheet form[data-ptpetform] button.pt-cta'); a.page.wait_for_timeout(300)
    check("saving again with the same years and months keeps the date (the age never slides)", a.js("ptPet('r1').bday") == bd, [bd, a.js("ptPet('r1').bday")])
    a.js("""(() => { const P = pt(); P.meds.push({ id: 'md', pet: S.pt.pets[0].id, name: 'Chew', dose: '1', times: ['23:30'], left: 10, per: 1, start: '2026-01-01', end: '' }); P.cur = P.pets[0].id; save(); showPt('health'); })()""")
    k = "md|23:30"
    a.page.click(f'#ptSheet [data-ptdose="{k}"][data-ptst=taken]'); a.page.wait_for_timeout(150)
    a.page.click(f'#ptSheet [data-ptdose="{k}"][data-ptst=""]'); a.page.wait_for_timeout(150)
    a.page.click(f'#ptSheet [data-ptdose="{k}"][data-ptst=taken]'); a.page.wait_for_timeout(150)
    check("Given -> Undo -> Given takes ONE off the count (10 -> 9), not two", a.js("S.pt.meds.find(m => m.id === 'md').left") == 9)
    a.js("hidePt(); render()"); a.page.wait_for_timeout(300)
    for _ in range(3):
        a.page.click('#cards .pt-card'); a.page.wait_for_timeout(200); a.page.click('#ptSheet .pt-head [aria-label=Close]'); a.page.wait_for_timeout(300)
    check("opening and closing with ✕ leaves no dead back presses (our history step is taken away)", not a.js("history.state && history.state.pt"))
    a.js("""(() => { const P = pt(); P.visits.push({ id: 'ov', pet: 'gone', date: addDays(today(), 1), time: '10:00', vet: 'X', reason: '' }); P.pets[0].color = 'red;background:url(x)';
      P.care[0].times = ['8:00"><b>x</b>']; P.weights.push({ id: 'w9', pet: P.pets[0].id, date: today(), lb: '<b>9</b>' }); save(); })()""")
    check("outside data is checked: a bad colour, time or weight never reaches the page", a.js("pt(), [S.pt.pets[0].color.startsWith('#'), S.pt.care[0].times.length === 0, !S.pt.weights.some(w => w.id === 'w9')]") == [True, True, True])
    check("a vet visit for a pet that no longer exists never breaks the reminders or the home screen", a.js("(() => { try { reminderList(); render(); return true; } catch (e) { return String(e); } })()") is True)
    a.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        for t in (test_first_run, test_pet_page_and_care, test_health, test_memories_birthdays_passport, test_bridge_remove_erase, test_review_fixes):
            t(b, base)
        errs = [e for e in T.ERRORS[before:] if "favicon" not in e and "Failed to fetch" not in e]
        check("no page errors anywhere", not errs, errs[:3])
        b.close()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
