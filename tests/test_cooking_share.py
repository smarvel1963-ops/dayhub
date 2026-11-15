"""
SAVE AS: test_cooking_share.py   LOCATION: C:/MarvelApps/dayhub/tests/test_cooking_share.py

COOKING HUB - SHARED RECIPES, RECIPE OF THE WEEK, THE PRICE (Scott 11/15: "we do want them to be able to submit their own recipes if they
want and those go to app"; his Recipe of the Week board; "pricing free for 2 weeks then 2.99 month"). Real Cooking Hub pages with a FAKE
Firebase inside the page (window.CKS_FAKE) - nothing reaches the real project. The fake follows docs/hub_improvement/familyhub/firestore.rules
for these collections: anyone reads approved recipes / ratings / weekly winners; a signed-in phone creates a submission, a report, its own
rating and its own vote; only the reviewer's token reads submissions / reports / votes and approves, removes or crowns.
Checks: Share needs the "it's my own" tick; what is sent (words, first name, optional small dish photo; never the card photo); a private recipe
and a draft can't be shared; approved recipes appear under From Our Cooks with the cook's name and their photo; real community stars (none =
none shown); Report hides it on this phone and files the report; one vote a week; Recipe of the Week shows the crowned recipe, the cook's tip,
the vote box and the Hall of Fame; the review page signs in, lists, approves, rejects, removes a reported recipe and crowns a winner; a
cook's own winning recipe gets the badge; the price: 14 free days counted from setup, then everything still reads and cooks but adding waits,
an unlocked phone never waits, the Play app never shows a price or waits, and no Whop link = nothing waits.

RUN:   python tests/test_cooking_share.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

CKP, AT = "/../cookinghub/", "2026-10-01T08:00:00"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Hr8sCFAAAAAElFTkSuQmCC")
# The fake Firebase: one store per page (window.__FB), typed Firestore JSON in and out, the rules for these collections.
FAKE = r"""
(() => {
  const FB = window.__FB = { docs: {}, n: 0, calls: [] };
  const plain = v => v == null ? null : "stringValue" in v ? v.stringValue : "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue
    : "booleanValue" in v ? v.booleanValue : "arrayValue" in v ? (v.arrayValue.values || []).map(plain) : "mapValue" in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)])) : null;
  const deny = () => { const e = new Error("Missing or insufficient permissions."); e.status = 403; throw e; };
  const tok = o => ((o.headers || {}).Authorization || "").replace("Bearer ", "");
  const isRev = o => tok(o) === "rv-token";
  window.CKS_FAKE = async (url, o) => {
    FB.calls.push({ url, method: o.method || "GET", body: o.body || "" });
    if (url.includes("accounts:signUp") || url.includes("securetoken")) { FB.n++; return { idToken: "tok-phone", refreshToken: "r1", localId: "phone1", expiresIn: "3600", id_token: "tok-phone", refresh_token: "r1", user_id: "phone1", expires_in: "3600" }; }
    if (url.includes("documents:commit")) {
      const b = JSON.parse(o.body);
      for (const w of b.writes) {
        if (w.delete) { const p = w.delete.split("/documents/")[1]; if (!isRev(o)) deny(); delete FB.docs[p]; continue; }
        const p = w.update.name.split("/documents/")[1], coll = p.split("/")[0], d = Object.fromEntries(Object.entries(w.update.fields).map(([k, v]) => [k, plain(v)]));
        (w.updateTransforms || []).forEach(t => { d[t.fieldPath] = "2026-10-01T13:00:00Z"; });
        if (["recipe_submissions", "recipe_reports", "recipe_ratings", "recipe_votes"].includes(coll)) { if (tok(o) !== "tok-phone" || d.uid !== "phone1") deny();
          if (coll === "recipe_submissions" && (d.agree !== true || !d.t || !Array.isArray(d.steps) || !d.steps.length)) deny();
          if (coll === "recipe_ratings" && p.split("/")[1] !== d.rid + "_phone1") deny(); if (coll === "recipe_votes" && p.split("/")[1] !== d.week + "_phone1") deny(); }
        else if (!isRev(o)) deny();
        FB.docs[p] = d;
      }
      return {};
    }
    const docsOf = coll => Object.entries(FB.docs).filter(([p]) => p.split("/")[0] === coll).map(([p, d]) => ({ name: "x/documents/" + p, fields: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typed(v)])) }));
    const typed = v => Array.isArray(v) ? { arrayValue: { values: v.map(typed) } } : typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : v && typeof v === "object" ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typed(x)])) } } : { stringValue: String(v) };
    if (url.includes(":runQuery")) { const q = JSON.parse(o.body).structuredQuery, coll = q.from[0].collectionId, f = q.where.fieldFilter;
      if (coll === "recipe_votes" && !isRev(o)) deny();
      return docsOf(coll).filter(d => plain(d.fields[f.field.fieldPath]) === f.value.stringValue).map(document => ({ document })); }
    const m = url.match(/\/documents\/([\w_]+)(?:\/([^?]+))?\?/); if (!m) throw new Error("fake: " + url);
    if ((o.method || "GET") === "DELETE") { if (!isRev(o)) deny(); delete FB.docs[m[1] + "/" + decodeURIComponent(m[2])]; return {}; }
    if (["recipe_submissions", "recipe_reports", "recipe_votes"].includes(m[1]) && !isRev(o)) deny();
    return { documents: docsOf(m[1]) };
  };
})();
"""
def sheet(a): return a.js("(document.querySelector('#ckSheet .ck-pane') || {}).innerText || ''")
def phone(b, base, name="Sam", path=CKP, extra=None):
    a = T.App(b, base, path=path, at=AT, look=None)
    a.ctx.add_init_script(FAKE)
    if extra: extra(a)
    a.page.reload(); a.page.wait_for_selector("form[data-cksetup]")
    a.page.fill('form[data-cksetup] [name="name"]', name); a.page.click("form[data-cksetup] .ck-cta"); a.page.wait_for_timeout(200)
    return a
def seed_shared(a, docs):
    a.js("(L => { L.forEach(([id, d]) => { window.__FB.docs['recipes_shared/' + id] = d; }); })(" + __import__("json").dumps(docs) + ")")
    a.js("localStorage.removeItem('cookinghub.shared'); CKS_LIST = null"); a.js("cksRefresh(true)"); a.page.wait_for_timeout(300)
def mine(a, t, private=False, photo=False):
    return a.js(f"""(() => {{ const C = ck(); const r = {{ id: 'm-' + uid(), t: {t!r}, cat: ['dinner'], serves: 4, prep: 10, cook: 20, ing: [['1 cup', 'rice', 'rice'], ['2', 'eggs', 'egg']],
      steps: ['Cook the rice.', 'Stir in the eggs.'], story: 'Mom made it on Fridays.', by: '', private: {str(private).lower()}, draft: false, photo: '', card: 'cardpic1' }};
      C.mine.push(r); save(); return r.id; }})()""")

def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. sharing one of my recipes]")
        a = phone(b, base)
        check("the sharing module is loaded and talks only to the fake here", a.js("typeof cksSend === 'function' && typeof window.CKS_FAKE === 'function'"))
        rid = mine(a, "Friday Fried Rice")
        a.js(f"ckClick({{ ckrec: '{rid}' }})"); a.page.wait_for_timeout(120)
        check("my recipe has Share with Cooking Hub", "Share with Cooking Hub" in sheet(a))
        a.js(f"ckClick({{ ckshareask: '{rid}' }})"); a.page.wait_for_timeout(120)
        check("the share box asks for the 'my own recipe' tick and a first name", a.js("!!document.querySelector('#ckSheet form[data-ckshareform] [name=agree]') && document.querySelector('#ckSheet form[data-ckshareform] [name=by]').value === 'Sam'"))
        a.page.click("#ckSheet form[data-ckshareform] .ck-cta"); a.page.wait_for_timeout(200)
        check("without the tick nothing is sent", a.js("Object.keys(window.__FB.docs).length === 0") and "Tick the box" in a.js("CK_MSG"))
        a.page.click("#ckSheet form[data-ckshareform] .ck-agree input"); a.page.click("#ckSheet form[data-ckshareform] .ck-cta")
        a.page.wait_for_function("Object.keys(window.__FB.docs).some(p => p.startsWith('recipe_submissions/')) && !CK_BUSY", timeout=15000)   # wait for the send, not a fixed pause (a busy machine)
        sub = a.js("Object.entries(window.__FB.docs).find(([p]) => p.startsWith('recipe_submissions/'))")
        check("with the tick it goes for review", bool(sub), sub)
        d = sub[1] if sub else {}
        check("what's sent: the words, servings, times, the first name - and never the card photo", d.get("t") == "Friday Fried Rice" and d.get("by") == "Sam" and len(d.get("ing", [])) == 2
              and d["ing"][0] == {"a": "1 cup", "i": "rice"} and d.get("steps") == ["Cook the rice.", "Stir in the eggs."] and "card" not in d and d.get("photo") == "" and d.get("agree") is True, d)
        check("the recipe remembers it was sent", a.js(f"!!ck().mine.find(r => r.id === '{rid}').shared") and "Sent for review" in sheet(a))
        a.js(f"ck().mine.find(r => r.id === '{rid}').steps.push('Top with scallions.'); save(); showCk()")
        check("after an edit it offers to send the new version", "Send the new version" in sheet(a))
        pid = mine(a, "Grandma's Secret Gumbo", private=True)
        a.js(f"ckClick({{ ckrec: '{pid}' }})"); a.page.wait_for_timeout(100)
        check("a Private Family Recipe has no Share button at all", "Share with Cooking Hub" not in sheet(a))
        check("and cksSend refuses it outright", a.js(f"cksSend(ck().mine.find(r => r.id === '{pid}'), {{}}).then(() => 'sent', e => e.message)") == "private")

        print("\n[2. From Our Cooks]")
        seed_shared(a, [["sub1", {"t": "Aunt Bea's Biscuits", "cat": "breads", "serves": 8, "prep": 10, "cook": 12, "ing": [{"a": "2 cups", "i": "flour"}, {"a": "1 cup", "i": "buttermilk"}],
                         "steps": ["Mix.", "Bake 12 minutes."], "story": "Every Sunday.", "by": "Bea", "photo": "data:image/png;base64," + base64.b64encode(PNG).decode()}],
                        ["sub2", {"t": "No Steps Stew", "cat": "dinner", "serves": 4, "prep": 0, "cook": 0, "ing": [{"a": "", "i": "beef"}], "steps": [], "story": "", "by": ""}]])
        check("approved recipes appear under From Our Cooks (a broken one with no steps doesn't)", a.js("ckShared().map(r => r.t).join('|')") == "Aunt Bea's Biscuits")
        check("they're in the recipe lists and search too", a.js("ckAll().some(r => r.id === 's-sub1') && ckCatList('community').length === 1"))
        a.js("hideCk(); render()"); a.page.wait_for_timeout(100)
        check("Home shows From our cooks", "From our cooks" in a.js("document.getElementById('cards').innerText"))
        a.js("ckClick({ ckrec: 's-sub1' })"); a.page.wait_for_timeout(300)
        check("the recipe page names the cook and shows their photo", "Shared by Bea" in sheet(a) and a.js("!!document.querySelector('#ckSheet .ck-rhero .ck-plate.has img[src^=\"data:image/png\"]')"))
        check("no ratings yet = no stars shown (never a made-up number)", a.js("document.getElementById('ckCommStars').hidden === true"))
        a.js("window.__FB.docs['recipe_ratings/sub1_other1'] = { rid: 'sub1', uid: 'other1', s: 5, cooked: true }; window.__FB.docs['recipe_ratings/sub1_other2'] = { rid: 'sub1', uid: 'other2', s: 4, cooked: false }")
        a.js("delete CKS_STARS['sub1']; showCk()"); a.page.wait_for_timeout(300)
        check("with ratings: the real average and the real count", a.js("document.getElementById('ckCommStars').textContent") == "★ 4.5 · 2 home cooks", a.js("document.getElementById('ckCommStars').textContent"))
        a.js("ckClick({ ckrate: 's-sub1' })"); a.page.click('#ckSheet label[for="cks5"]'); a.page.click("#ckSheet form[data-ckrateform] .ck-cta"); a.page.wait_for_timeout(300)
        check("my rating of a shared recipe counts toward its stars (one per phone)", a.js("window.__FB.docs['recipe_ratings/sub1_phone1'] && window.__FB.docs['recipe_ratings/sub1_phone1'].s === 5"))
        a.js("ckClick({ ckrec: 's-sub1' }); ckClick({ ckreportask: 's-sub1' })"); a.page.wait_for_timeout(120)
        a.page.click("#ckSheet form[data-ckreportform] .ck-cta"); a.page.wait_for_timeout(300)
        check("Report files the report and hides the recipe on this phone", a.js("Object.keys(window.__FB.docs).some(p => p.startsWith('recipe_reports/'))") and a.js("!ckShared().some(r => r.id === 's-sub1')"))
        a.js("ck().hidden = []; save()")

        print("\n[3. vote + Recipe of the Week]")
        a.js("ckClick({ cktab: 'vote', ckroot: '1' })"); a.page.wait_for_timeout(120)
        a.js("ckClick({ ckvote: 's-sub1' })"); a.page.wait_for_timeout(300)
        check("one vote a week, kept as this phone's own", a.js("Object.keys(window.__FB.docs).some(p => p === 'recipe_votes/' + cksWeek(0) + '_phone1')") and "Your vote" in sheet(a))
        a.js("ckClick({ cktab: 'weekly', ckroot: '1' })"); a.page.wait_for_timeout(400)
        check("before a winner: the page invites a share and the vote", "first Recipe of the Week" in sheet(a) and "Vote for Next Week" in sheet(a))
        a.js("window.__FB.docs['weekly/' + cksWeek(0)] = { start: cksWeek(0), rid: 'sub1', t: \"Aunt Bea's Biscuits\", by: 'Bea', tip: 'Cold butter, hot oven.' }; CKS_WEEKS = null")
        a.js("ckClick({ cktab: 'weekly', ckroot: '1' })"); a.page.wait_for_timeout(500)
        t = sheet(a)
        check("Recipe of the Week: the winner, its cook's tip, Cook This Tonight, Save to My Book, the vote box", all(x in t for x in ["Aunt Bea's Biscuits", "From Bea's Kitchen", "Cold butter, hot oven.", "Cook This Tonight", "Save to My Book", "Want next week's winner?"]), t[:500])
        a.js("ckClick({ cktab: 'fame' })"); a.page.wait_for_timeout(100)
        check("the Hall of Fame lists every winner", "Aunt Bea's Biscuits" in sheet(a) and "Week of" in sheet(a))
        a.js("hideCk(); render()"); a.page.wait_for_timeout(100)
        check("Home shows the Recipe of the Week", "recipe of the week" in a.js("document.getElementById('cards').innerText").lower())
        a.js(f"ck().mine.find(r => r.id === '{rid}').shared.id = 'sub1'; save(); ckClick({{ ckrec: '{rid}' }})"); a.page.wait_for_timeout(120)
        check("the cook's own winning recipe wears the Blue Ribbon badge", "Blue Ribbon winner" in sheet(a))
        a.close()

        print("\n[4. the review page (Marvel Corp only)]")
        a = phone(b, base, path=CKP + "?review=1", extra=lambda x: x.ctx.add_init_script("window.CKS_FAKE_REVIEW = 'rv-token'"))
        a.page.wait_for_timeout(1200)
        check("?review=1 opens the review page and asks to sign in", a.js("CK_TAB") == "review" and "Sign in with Google" in sheet(a))
        a.js("window.__FB.docs['recipe_submissions/new1'] = { t: 'Uncle Joe Chili', cat: 'dinner', serves: 6, prep: 15, cook: 60, ing: [{ a: '2 lb', i: 'ground beef' }], steps: ['Brown the beef.'], story: '', by: 'Joe', uid: 'p9', agree: true, v: 1 };"
             "window.__FB.docs['recipe_submissions/new2'] = { t: 'Spam', cat: 'dinner', serves: 1, prep: 0, cook: 0, ing: [], steps: ['buy now'], story: '', by: '', uid: 'p8', agree: true, v: 1 }")
        a.js("ckClick({ ckrvsign: '1' })"); a.page.wait_for_timeout(600)
        check("after sign-in: the two waiting recipes", "Uncle Joe Chili" in sheet(a) and "Spam" in sheet(a) and "Waiting for you (2)" in sheet(a), sheet(a)[:300])
        a.js("ckClick({ ckrvok: 'new1' })"); a.page.wait_for_timeout(500)
        check("Approve moves it to the shared recipes (same id) and off the waiting list", a.js("!!window.__FB.docs['recipes_shared/new1'] && !window.__FB.docs['recipe_submissions/new1'] && window.__FB.docs['recipes_shared/new1'].t === 'Uncle Joe Chili'"))
        a.js("ckClick({ ckrvno: 'new2' })"); a.page.wait_for_timeout(400)
        check("Reject deletes it", a.js("!window.__FB.docs['recipe_submissions/new2'] && !window.__FB.docs['recipes_shared/new2']"))
        a.page.wait_for_timeout(400); a.js("showCk()"); a.page.wait_for_timeout(200)
        check("the approved recipe is now in this phone's From Our Cooks", a.js("ckShared().some(r => r.id === 's-new1')"))
        a.page.fill('#ckSheet form[data-ckcrown="s-new1"] [name="tip"]', "Brown it slow."); a.page.click('#ckSheet form[data-ckcrown="s-new1"] .ck-mini'); a.page.wait_for_timeout(500)
        check("crowning makes it this week's Recipe of the Week", a.js("(w => !!w && w.rid === 'new1' && w.tip === 'Brown it slow.')(window.__FB.docs['weekly/' + cksWeek(0)])"))
        check("a phone without the reviewer's token can't read submissions", a.js("window.CKS_FAKE(CKS_DOCS + '/recipe_submissions?pageSize=1&key=x', {}).then(() => 'read', e => e.status)") == 403)
        a.close()

        print("\n[5. the price: 2 weeks free, then $2.99/month]")
        a = phone(b, base)
        check("the Whop link is set: Cooking Hub sells (Whop product cooking-hub-44)", a.js("ckSells() && PLAN.COOKING_CHECKOUT_URL === 'https://whop.com/commander-marvel-por-picks/cooking-hub-44'"))
        a.close()
        withurl = lambda x: x.ctx.route("**/dayhub/features.js", lambda r: r.fulfill(body=open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "features.js"), encoding="utf-8").read()
                                           .replace('COOKING_CHECKOUT_URL: "",', 'COOKING_CHECKOUT_URL: "https://whop.com/commander-marvel-por-picks/cooking-hub-test",'), content_type="application/javascript"))
        a = phone(b, base, extra=withurl)
        check("day 1: 'Free for 14 more days', then $2.99/month or $19.99/year", a.js("ckSells() && ckTrial().left === 14") and "Free for 14 more days" in a.js("document.getElementById('cards').innerText") and "$2.99/month or $19.99/year" in a.js("document.getElementById('cards').innerText"))
        a.js("ck().setupDay = addDays(today(), -15); save(); render()"); a.page.wait_for_timeout(100)
        home = a.js("document.getElementById('cards').innerText")
        check("after 14 days: the 2 free weeks are up, everything still here, a Keep cooking button", a.js("ckPaused()") and "free weeks are up" in home and "Keep cooking" in home)
        check("the Keep cooking button goes to Whop", (a.js("(document.querySelector('.ck-trial.over a.ck-cta') || {}).href") or "").startswith("https://whop.com/"))
        a.js("ckClick({ cktab: 'pantry', ckroot: '1' }); ckClick({ ckpnew: '1' })"); a.page.wait_for_timeout(100)
        check("adding a pantry item waits", not a.js("!!document.querySelector('#ckSheet form[data-ckpform]')") and "free weeks are up" in a.js("document.getElementById('toast').textContent"))
        a.js("ckClick({ ckrec: 'sunday-pasta' })"); a.page.wait_for_timeout(100)
        check("reading a recipe still works", "Sunday Pasta" in sheet(a))
        a.js("ckClick({ ckcook: 'sunday-pasta' })"); a.page.wait_for_timeout(100)
        check("cooking still works", "Cook Along" in sheet(a))
        check("the unlock box sells Cooking Hub", a.js("proName()") == "Cooking Hub")
        a.js("window.isPro = () => true"); a.js("hideCk(); render()"); a.page.wait_for_timeout(100)
        check("an unlocked phone never waits and sees no price strip", a.js("!ckPaused()") and "free weeks are up" not in a.js("document.getElementById('cards').innerText"))
        a.close()
        a = phone(b, base, path=CKP + "?src=play", extra=withurl)
        a.js("ck().setupDay = addDays(today(), -30); save(); render()"); a.page.wait_for_timeout(100)
        check("the Play app never shows a price and never waits", a.js("!ckSells() && !ckPaused()") and "$2.99" not in a.js("document.getElementById('cards').innerText"))
        a.close()
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
