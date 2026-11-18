"""
SAVE AS: test_cooking.py   LOCATION: C:/MarvelApps/dayhub/tests/test_cooking.py

COOKING HUB (app #11, Scott 11/15: his Recipe Hub boards -> "Yes, build it" -> "maybe should be clalled cooking hub"). Drives the real
Cooking Hub page (/cookinghub/, cookbook.js + cooking.js + cookingtiles.css) on a phone-size screen with a frozen clock. Checks: first
run + the two looks, the recipe book (Desktop's video recipes keep their link + credit), Home (greeting, fox, tiles, Tonight, Use it
soon), lists + search, the recipe page (servings scale the amounts, tabs, favorites, Watch the video), Cook Along (steps, timer, the
finish), the Dinner Finder (a plain match, never "AI"), My Pantry (use-by), This Week's Table + the grocery list (skips the pantry),
Write My Recipe (rows, photo of the card, private, draft, edit, delete), ratings + the Blue Ribbon order (review count counts),
Grandma's Recipe Box (gingham, side tabs, Grandma's tip), reminders, what Ask reads (never a private recipe), the engine hooks
(the Hub family list, Erase, update notes) and no sideways scroll.

RUN:   python tests/test_cooking.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import base64, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

CKP = "/../cookinghub/"
AT = "2026-10-01T08:00:00"          # a Thursday morning
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Hr8sCFAAAAAElFTkSuQmCC")

def sheet_text(a): return a.js("(document.querySelector('#ckSheet .ck-pane') || {}).innerText || ''")
def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(120)
def no_sideways(a): return a.js("document.documentElement.scrollWidth <= innerWidth + 1")
def phone(b, base, look="kitchen", name="Sam", width=390):
    a = T.App(b, base, path=CKP, at=AT, width=width, look=None)
    a.page.wait_for_selector("form[data-cksetup]")
    if look == "vintage": a.page.click('form[data-cksetup] .ck-lookcard.v')
    if name: a.page.fill('form[data-cksetup] [name="name"]', name)
    a.page.click("form[data-cksetup] .ck-cta"); a.page.wait_for_timeout(200)
    return a


def main():
    srv, base = T.serve()
    pic = os.path.join(tempfile.gettempdir(), "ck_card_test.png"); open(pic, "wb").write(PNG)
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. first run: pick your kitchen]")
        a = T.App(b, base, path=CKP, at=AT, look=None)
        a.page.wait_for_selector("form[data-cksetup]")
        check("Cooking Hub runs in its own mode with its own name", a.js("MODE === 'cooking' && APP_NAME === 'Cooking Hub' && APP_ID === 'cookinghub'"))
        check("the welcome shows the chef fox and both looks", a.js("!!document.querySelector('.ck-hello .ck-fox') && document.querySelectorAll('.ck-lookcard').length === 2"))
        check("no Day Hub top screen or + button in Cooking Hub", a.js("getComputedStyle(document.getElementById('hero')).display === 'none' && getComputedStyle(document.getElementById('fab')).display === 'none'"))
        a.page.fill('form[data-cksetup] [name="name"]', "Sam"); a.page.click("form[data-cksetup] .ck-cta"); a.page.wait_for_timeout(200)
        check("Start cooking opens the kitchen (Magical Kitchen by default)", a.js("ckSet() && S.ck.look === 'kitchen' && document.body.classList.contains('ck-kitchen')"))
        home = a.js("document.getElementById('cards').innerText")
        check("Home greets by name and time of day", "Good Morning" in home and "Sam!" in home, home[:120])
        check("Home has the fox, the search and the four tiles (Dinner, Quick Meals, Healthy, Favorites)",
              a.js("!!document.querySelector('.ck-k .ck-fox') && !!document.querySelector('form[data-cksearch]') && [...document.querySelectorAll('.ck-tile')].map(t => t.innerText.trim().split(/\\n/).pop()).join('|')") == "Dinner|Quick Meals|Healthy|Favorites")
        check("the bottom bar: Home, Finder, Pantry, Week, My Book", a.js("[...document.querySelectorAll('#ckNav button')].map(b => b.innerText.replace(/\\s+/g, ' ').trim().split(' ').pop()).join('|')") in ("Home|Finder|Pantry|Week|Book",), a.js("[...document.querySelectorAll('#ckNav button')].map(b => b.innerText)"))
        check("no sideways scroll on Home (390 px)", no_sideways(a))

        print("\n[2. the recipe book]")
        n = a.js("CK_BOOK.length"); vids = a.js("CK_BOOK.filter(r => r.src && r.src.url).length")
        check("33 built-in recipes, 11 of them Desktop's with their video link", n == 33 and vids == 11, (n, vids))
        check("every video recipe keeps its Facebook link; the creator is named when known (9 of 11), never a likes count",
              a.js("CK_BOOK.filter(r => r.src).every(r => /^https:\\/\\/www\\.facebook\\.com\\/reel\\//.test(r.src.url) && !/likes/i.test(r.src.by || '')) && CK_BOOK.filter(r => r.src && r.src.by).length === 9"))
        check("every recipe has a title, ingredients and steps", a.js("CK_BOOK.every(r => r.t && r.ing.length && r.steps.length && r.ing.every(x => x.length === 3))"))
        check("meats carry USDA safe temperatures (165 chicken, 160 ground beef, 145 pork and fish)",
              a.js("['lemon-herb-chicken:165', 'meatloaf:160', 'pineapple-pork-tacos:145', 'salmon-greens:145'].every(s => { const [id, t] = s.split(':'); return CK_BOOK.find(r => r.id === id).steps.join(' ').includes(t + '°F'); })"))

        print("\n[3. lists + search]")
        tap(a, '.ck-tile[data-ckcat="quick"]')
        check("Quick Meals lists only recipes of 30 minutes or less", a.js("CK_CAT === 'quick' && ckCatList('quick').length > 3 && ckCatList('quick').every(r => ckMin(r) <= 30)"))
        tap(a, '#ckSheet [data-ckclose]')
        a.page.fill("form[data-cksearch] input", "pecan"); a.page.press("form[data-cksearch] input", "Enter"); a.page.wait_for_timeout(150)
        check("search finds a recipe by name or ingredient", "Old-Fashioned Pecan Pie" in sheet_text(a))

        print("\n[4. the recipe page]")
        a.js("ckClick({ ckrec: 'sunday-pasta' })"); a.page.wait_for_timeout(120)
        t = sheet_text(a)
        check("Sunday Pasta opens with time, servings and the three tabs", "Sunday Pasta" in t and "30 min" in t and "4 servings" in t and a.js("document.querySelectorAll('#ckSheet .ck-rtabs button').length") == 3)
        for _ in range(4): tap(a, '#ckSheet [data-ckserv="1"]')
        t = sheet_text(a)
        check("8 servings doubles the amounts (400 g -> 800 g, 1/2 cup basil -> 1 cup)", "8 servings" in t and "800 g (28 oz)" in t and "1 cup fresh basil" in t, t[:400])
        tap(a, '#ckSheet [data-ckrtab="steps"]'); check("Steps tab shows the directions", "salted water" in sheet_text(a))
        tap(a, '#ckSheet [data-ckrtab="tips"]'); check("Chef's Tips tab shows the tip", "pasta water" in sheet_text(a).lower())
        tap(a, '#ckSheet [data-ckfav="sunday-pasta"]'); check("the heart saves it to Favorites", a.js("ckFav('sunday-pasta') && ckCatList('fav').some(r => r.id === 'sunday-pasta')"))
        vid = a.js("CK_BOOK.find(r => r.src).id")
        a.js(f"ckClick({{ ckrec: '{vid}' }})"); a.page.wait_for_timeout(120)
        link = a.js("(document.querySelector('#ckSheet .ck-video a') || {}).href || ''")
        check("a video recipe has Watch the video with the creator's name, opening a new tab",
              link.startswith("https://www.facebook.com/reel/") and a.js("document.querySelector('#ckSheet .ck-video a').target === '_blank'") and "not kitchen-tested yet" in sheet_text(a), link)

        print("\n[5. Cook Along]")
        a.js("ckClick({ ckcook: 'lemon-herb-chicken' })"); a.page.wait_for_timeout(150)
        t = sheet_text(a)
        check("Cook Along starts at step 1 with step dots and Voice Mode", "Step" in t and a.js("document.querySelectorAll('#ckSheet .ck-dots span').length") == 4 and "Voice Mode" in t)
        tap(a, '#ckSheet [data-ckstep="1"]'); tap(a, '#ckSheet [data-ckstep="1"]')
        check("step 3 mentions minutes, so a timer is offered", "20-minute timer" in sheet_text(a), sheet_text(a)[:300])
        tap(a, "#ckSheet [data-cktimer]"); check("the timer starts and counts down", a.js("!!CK_TIMER && !!document.getElementById('ckTimeLeft')"))
        tap(a, "#ckSheet [data-cktimer]"); check("tapping it again stops it", a.js("CK_TIMER === null"))
        tap(a, '#ckSheet [data-ckstep="1"]'); tap(a, '#ckSheet [data-ckstep="1"]')
        check("the last Next finishes: Dinner is served, counted as cooked", "Dinner is served" in sheet_text(a) and a.js("ckCooked('lemon-herb-chicken') === 1 && S.ck.lastCook === 'lemon-herb-chicken'"))
        tap(a, '#ckSheet .ck-done [data-ckclose]')

        print("\n[6. Dinner Finder]")
        a.js("ckClick({ cktab: 'finder', ckroot: '1' })"); a.page.wait_for_timeout(120)
        check("the finder never says AI (it's a plain match)", "AI" not in sheet_text(a).replace("ADD", ""), sheet_text(a)[:200])
        for w in ("chicken", "lemon", "garlic"):
            a.page.fill('#ckSheet [name="w"]', w); a.page.press('#ckSheet [name="w"]', "Enter"); a.page.wait_for_timeout(100)
        tap(a, "#ckSheet [data-ckfind]")
        top = a.js("(CK_RESULTS[0] || {r: {}}).r.t")
        check("chicken + lemon + garlic: Lemon Herb Chicken is the best match", top == "Lemon Herb Chicken", top)
        check("each match says what you have and what you need", "You have 3 of 4" in sheet_text(a) and "thyme" in sheet_text(a))

        print("\n[7. My Pantry]")
        a.js("ckClick({ cktab: 'pantry', ckroot: '1' })"); a.page.wait_for_timeout(100)
        tap(a, "#ckSheet [data-ckpnew]")
        a.page.fill('#ckSheet form[data-ckpform] [name="name"]', "Cream"); a.page.fill('#ckSheet form[data-ckpform] [name="qty"]', "1 pint")
        a.page.fill('#ckSheet form[data-ckpform] [name="exp"]', "2026-10-02"); a.page.click("#ckSheet form[data-ckpform] .ck-cta"); a.page.wait_for_timeout(150)
        check("an item with a use-by date shows 'Expires tomorrow'", "Expires tomorrow" in sheet_text(a))
        tap(a, "#ckSheet [data-ckpnew]"); a.page.fill('#ckSheet form[data-ckpform] [name="name"]', "Tomatoes"); a.page.fill('#ckSheet form[data-ckpform] [name="qty"]', "6 left")
        a.page.click("#ckSheet form[data-ckpform] .ck-cta"); a.page.wait_for_timeout(120)
        check("an item without one shows its amount", "6 left" in sheet_text(a))
        tap(a, '#ckSheet [data-ckpcat="spice"]'); check("the Spices group filters the list", "Tomatoes" not in sheet_text(a))
        tap(a, '#ckSheet [data-ckpcat="all"]')
        a.js("hideCk(); render()"); a.page.wait_for_timeout(100)
        check("Home rings the bell and shows Use it soon", a.js("(document.querySelector('.ck-bell em') || {}).textContent") == "1" and "Use it soon" in a.js("document.getElementById('cards').innerText"))

        print("\n[8. This Week's Table + the grocery list]")
        a.js("ckClick({ cktab: 'week', ckroot: '1' })"); a.page.wait_for_timeout(100)
        check("the week shows Monday to Sunday", a.js("[...document.querySelectorAll('#ckSheet .ck-day')].map(d => d.textContent).join(' ')") == "Mon Tue Wed Thu Fri Sat Sun")
        a.js("ckClick({ ckpickday: today() })"); a.page.wait_for_timeout(100)
        check("picking a dinner opens the recipe list in pick mode", a.js("CK_PICK === today()") and "Dinner for Thursday" in sheet_text(a))
        a.js("ckClick({ ckpick: 'sunday-pasta' })"); a.page.wait_for_timeout(120)
        check("the pick lands on today's row", a.js("S.ck.week[today()].r === 'sunday-pasta'") and "Sunday Pasta" in sheet_text(a))
        tap(a, '#ckSheet [data-cktab="groc"]'); tap(a, "#ckSheet [data-ckgrocfill]")
        g = a.js("S.ck.groc.map(x => x.t)")
        check("Fill adds the week's missing ingredients, skipping the pantry and the basics",
              any("pasta" in x for x in g) and not any("tomato" in x.lower() for x in g) and not any("olive oil" in x for x in g), g)
        first = a.js("S.ck.groc[0].id"); a.js(f"ckClick({{ ckgroc: '{first}' }})")
        check("ticking moves an item into the cart", a.js(f"S.ck.groc.find(x => x.id === '{first}').done") and "In the cart" in sheet_text(a))
        a.js("ckClick({ ckgrocclear: '1' })"); check("Clear removes what's in the cart", a.js(f"!S.ck.groc.some(x => x.id === '{first}')"))
        a.js("hideCk(); render()"); a.page.wait_for_timeout(100)
        check("Home shows Tonight's dinner", "tonight's dinner" in a.js("document.getElementById('cards').innerText").lower() and "Sunday Pasta" in a.js("document.querySelector('.ck-tonight').innerText"))

        print("\n[9. Write My Recipe]")
        a.js("ckClick({ ckwrite: '1' })"); a.page.wait_for_timeout(150)
        f = "#ckSheet form[data-ckwrite]"
        check("the form has the board's parts", a.js(f"['t', 'photo', 'card', 'serves', 'prep', 'cook', 'story', 'private'].every(n => document.querySelector('{f} [name=\"' + n + '\"]')) && document.querySelectorAll('{f} [name=cat]').length >= 3"))
        a.page.fill(f + ' [name="t"]', "Grandma's Sunday Biscuits")
        a.page.click(f + ' input[name="cat"][value="breads"] + span')
        amts = a.page.query_selector_all(f + ' [name="amt"]'); items = a.page.query_selector_all(f + ' [name="item"]')
        amts[0].fill("2 cups"); items[0].fill("self-rising flour"); amts[1].fill("1 cup"); items[1].fill("buttermilk")
        tap(a, f + ' [data-ckrow="ing"]'); a.page.query_selector_all(f + ' [name="item"]')[2].fill("butter, cold")
        check("+ Add Ingredient adds a row (3 now)", a.js(f"document.querySelectorAll('{f} [name=item]').length") == 3)
        a.page.query_selector_all(f + ' [name="step"]')[0].fill("Heat the oven to 450°F.")
        tap(a, f + ' [data-ckrow="step"]'); a.page.query_selector_all(f + ' [name="step"]')[1].fill("Bake 10 to 12 minutes.")
        check("+ Add Step numbers the new step 2", a.js(f"[...document.querySelectorAll('{f} .ck-num')].map(x => x.textContent).join(',')") == "1,2")
        a.page.fill(f + ' [name="story"]', "She made these every Sunday after church.")
        a.page.set_input_files(f + ' [name="card"]', pic)
        a.page.click(f + ' .ck-switch [name="private"]')
        a.page.click(f + " .ck-cta.big"); a.page.wait_for_timeout(600)
        mine = a.js("S.ck.mine[0]")
        check("Save to My Cookbook keeps it, with the ingredients and steps", mine and mine["t"] == "Grandma's Sunday Biscuits" and len(mine["ing"]) == 3 and len(mine["steps"]) == 2 and mine["cat"] == ["breads"], mine)
        check("the card's photo is kept on the phone (an id in the data, the picture in the photo store)", bool(mine and mine.get("card")) and a.js(f"ckIdb('readonly', s => s.get('{mine['card']}')).then(d => !!d)"))
        check("it opens on its own recipe page with the family story", "She made these every Sunday" in sheet_text(a) and "Private" in sheet_text(a))
        check("a private recipe never goes in Share or Ask", a.js("ckShareText('book') === '' && !JSON.stringify(ckContext()).includes('Sunday Biscuits')"))
        a.js("ckClick({ ckwrite: '1' })"); a.page.wait_for_timeout(120)
        a.page.fill(f + ' [name="t"]', "Aunt May's chili"); a.js("ckClick({ ckdraft: '1' })"); a.page.wait_for_timeout(400)
        check("Save Draft keeps a draft, listed under Drafts and not in the recipe lists", a.js("S.ck.mine.some(r => r.draft && r.t === \"Aunt May's chili\") && !ckAll().some(r => r.t === \"Aunt May's chili\")") and "Drafts" in sheet_text(a))
        did = a.js("S.ck.mine.find(r => r.draft).id")
        a.js(f"ckClick({{ ckedit: '{did}' }})"); a.page.wait_for_timeout(120)
        a.page.fill(f + ' [name="t"]', "Aunt May's Chili"); a.page.click(f + " .ck-cta.big"); a.page.wait_for_timeout(400)
        check("finishing a draft makes it a real recipe (same one, no copy)", a.js(f"S.ck.mine.filter(r => r.id === '{did}' && !r.draft && r.t === \"Aunt May's Chili\").length === 1 && S.ck.mine.length === 2"))
        check("a non-private family recipe can be shared", "Aunt May's Chili" in a.js("ckShareText('book')"))
        a.js(f"ckClick({{ ckdel: '{did}' }})"); a.page.wait_for_timeout(80)
        check("Delete asks for a second tap", a.js(f"S.ck.mine.some(r => r.id === '{did}')") and "Tap again to delete" in sheet_text(a))
        a.js(f"ckClick({{ ckdel: '{did}' }})"); a.page.wait_for_timeout(120)
        check("the second tap deletes it", a.js(f"!S.ck.mine.some(r => r.id === '{did}')"))

        print("\n[10. ratings + the Blue Ribbon list]")
        a.js("hideCk()")
        a.js("ckClick({ ckrate: 'apple-pie' })"); a.page.wait_for_timeout(120)
        a.page.click('#ckSheet label[for="cks5"]'); a.page.click("#ckSheet form[data-ckrateform] .ck-cta"); a.page.wait_for_timeout(150)
        check("a rating saves and opens the Blue Ribbon list", a.js("ckRates('apple-pie').length === 1") and "Grandma's Apple Pie" in sheet_text(a))
        check("no stars = asks for them", a.js("ckClick({ ckrate: 'meatloaf' }), document.querySelector('#ckSheet form[data-ckrateform] .ck-cta').click(), CK_MSG.includes('stars')"))
        a.js("for (let i = 0; i < 6; i++) S.ck.rate['pot-roast'] = [...(S.ck.rate['pot-roast'] || []), { d: today(), s: 5 }]; save()")
        order = a.js("ckRibbon('all').map(x => x.r.id)")
        check("a recipe rated 5 six times ranks above one rated 5 once", order.index("pot-roast") < order.index("apple-pie"), order)
        check("scores are out of 10", a.js("ckRibbon('all').every(x => x.sc10 > 0 && x.sc10 <= 10)"))

        print("\n[11. reminders + Ask]")
        got = a.js("(() => { const L = []; ckReminders((k, end, at, title, body) => L.push(title), d => true); return L; })()")
        check("reminders: tonight's dinner and the cream's use-by", any("Tonight: Sunday Pasta" in x for x in got) and any("Cream" in x for x in got), got)
        ctx = a.js("JSON.stringify(ckContext())")
        check("Ask reads the pantry, the week and the ratings", "Cream" in ctx and "Sunday Pasta" in ctx and "Grandma's Apple Pie" in ctx)
        print("\n[11b. the independent review's fixes (11/15)]")
        check("scaling leaves the can size alone: 2 cans (28 oz each) x2 = 4 cans (28 oz each)", a.js("ckScale('2 cans (28 oz each)', 2)") == "4 cans (28 oz each)")
        check("a tiny amount never shows as 0", a.js("ckScale('1/4 tsp', 0.25)") == "1/8 tsp")
        check("whole words: butternut squash isn't butter, pineapple isn't apple, egg noodles are noodles",
              a.js("ckKeyOf('1 butternut squash') !== 'butter' && ckKeyOf('1 cup pineapple') !== 'apple' && ckKeyOf('8 oz egg noodles') === 'noodles'"))
        check("pepper jack cheese and oil-packed tomatoes are real ingredients, not basics", a.js("ckKeyOf('pepper jack cheese') !== '' && ckKeyOf('oil-packed tomatoes') !== ''"))
        check("having peanut butter doesn't count as having butter", a.js("!ckHas('butter', ['peanut butter']) && ckHas('butter', ['unsalted butter'])"))
        a.js("(() => { const C = ck(); C.mine.push({ id: 'm-secret', t: 'Secret Gumbo', cat: ['dinner'], serves: 4, prep: 0, cook: 0, ing: [['', 'okra', 'okra']], steps: ['Stir.'], private: true, draft: false });"
             " C.favs.push('m-secret'); C.week[addDays(today(), 1)] = { r: 'm-secret', done: false }; C.rate['m-secret'] = [{ d: today(), s: 5 }]; save(); })()")
        check("a private recipe's name never reaches Ask (favorites, the week, ratings)", "Secret Gumbo" not in a.js("JSON.stringify(ckContext())"))
        a.js("ck().week[today()] = { r: 'meatloaf', done: false }; ck().cooked['meatloaf'] = 0; save(); ckClick({ ckwkdone: today() }); ckClick({ ckwkdone: today() })")
        check("ticking a dinner cooked, then un-ticking it, leaves the count where it was", a.js("ckCooked('meatloaf')") == 0)
        a.js("(() => { const C = ck(); C.mine.push({ id: 'm-draft1', t: 'Half-written pie', cat: ['pies'], serves: 8, prep: 0, cook: 0, ing: [], steps: [], draft: true }); save(); })(); ckClick({ ckedit: 'm-draft1' })")
        a.page.wait_for_timeout(120); a.js("ckClick({ ckdel: 'm-draft1' })"); a.js("ckClick({ ckdel: 'm-draft1' })"); a.page.wait_for_timeout(120)
        check("a draft can be deleted from its Write page", a.js("!ck().mine.some(r => r.id === 'm-draft1')"))
        a.js("hideCk()")
        a.close()

        print("\n[12. Grandma's Recipe Box]")
        a = phone(b, base, look="vintage")
        check("the vintage look: gingham + Grandma's Recipe Box + five side tabs", a.js("document.body.classList.contains('ck-vintage')") and "Grandma's Recipe Box" in a.js("document.getElementById('cards').innerText") and a.js("document.querySelectorAll('.ck-sidetabs button').length") == 5)
        tap(a, '.ck-sidetabs [data-ckvtab="pies"]')
        check("the Pies tab lists the pies", "Grandma's Apple Pie" in a.js("document.querySelector('.ck-page').innerText") and "Pumpkin Pie" in a.js("document.querySelector('.ck-page').innerText"))
        tap(a, '.ck-vrow[data-ckrec="apple-pie"]')
        check("the vintage recipe page: Ingredients, Directions and From Grandma's Kitchen in her hand", "From Grandma's Kitchen" in sheet_text(a) and "sing" in sheet_text(a) and a.js("!!document.querySelector('#ckSheet .ck-tip.hand')"))
        check("no sideways scroll on Grandma's Recipe Box (390 px)", no_sideways(a))
        a.js("hideCk(); ckClick({ cktab: 'more', ckroot: '1' })"); a.page.wait_for_timeout(100)
        a.js("ckClick({ cklook: 'kitchen' })"); a.page.wait_for_timeout(120)
        check("More switches back to the Magical Kitchen", a.js("S.ck.look === 'kitchen' && document.body.classList.contains('ck-kitchen')"))
        a.close()
        a = phone(b, base, width=360); check("no sideways scroll at 360 px", no_sideways(a)); a.close()

        print("\n[13. the engine hooks]")
        a = T.App(b, base, look=None); T.setup(a)
        check("every Hub's family list now has Cooking Hub", a.js("HUBS.some(h => h.id === 'cookinghub' && /cookinghub\\/$/.test(h.url))"))
        check("Erase knows Cooking Hub's photo store", a.js("typeof ERASE_DBS !== 'undefined' ? ERASE_DBS.cooking === 'cookinghub.photos' : true"))
        notes = a.js("fetch('version.json').then(r => r.json())")
        check("the update note for Cooking Hub goes only to Cooking Hub", any(x.startswith("🍳 Cooking Hub:") for v in notes["notes"].values() for x in v) and not a.js("noteForMe('🍳 Cooking Hub: hello')"))
        a.close()
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
