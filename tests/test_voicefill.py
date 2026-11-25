"""
SAVE AS: test_voicefill.py   LOCATION: C:/MarvelApps/dayhub/tests/test_voicefill.py

VOICE FILL, engine 1.78 (Scott 11/24: "all aps must have microphone to right on any box for use to voice fill any input box all apps
old and new all input interactive pill boxes"). voicefill.js, loaded by ui.js in every Hub (switch VOICE_FILL) and by a script tag in
the other apps. What this proves:
- Every Hub (390 px): voicefill.js loads; with Settings open, every typing box at least 90 px wide shows the mic at its right end
  (icon + room for it), nothing goes sideways, no page errors.
- Talking: a tap on the mic starts listening (red mic, no keyboard: inputmode none while it listens), the words go into the box and
  the app hears an input + change event; words are added after what is already typed; a second tap stops; afterwards the box is let
  go and its inputmode is back. A tap on the rest of the box is an ordinary tap (no listening).
- Box kinds: email ("sam at gmail dot com" -> sam@gmail.com), number (digits only), textarea (mic at the top right), contenteditable,
  a box added later; never on a password, date, checkbox, read-only, disabled, data-novoice or narrow (< 90 px) box.
- No speech in the browser: the mic opens the keyboard and says to use the keyboard's mic. Mic not allowed: says how to allow it.
- The switch: VOICE_FILL off = voicefill.js is never fetched and no box gets a mic.
- The other apps: Scott Hub, Marvel Magic, the hubs site pages, Photo Hub's web app load it from /dayhub/voicefill.js.
Drives the real app with the main suite's helpers (fake network, frozen clock) and a stand-in speech recognizer.

RUN:   python tests/test_voicefill.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}", flush=True)
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}", flush=True)

HUBS = {"dayhub": "/", "cruisehub": T.CRUISE, "triphub": T.TRIP, "homehub": T.HOMEP, "autohub": T.AUTOP, "moneyhub": T.MONEYP, "hubuniverse": T.UNIP,
        "healthhub": T.HEALTHP, "familyhub": T.FAMILYP, "pethub": "/../pethub/", "cookinghub": "/../cookinghub/", "jobhub": "/../jobhub/"}

FAKE_SR = """(() => {
  window.__sr = [];
  class FakeSR {
    constructor() { window.__sr.push(this); this.live = false; }
    start() { this.live = true; }
    stop() { this.live = false; setTimeout(() => this.onend && this.onend(), 0); }
    abort() { this.stop(); }
    say(text) { const r = [[{ transcript: text }]]; r[0].isFinal = true; this.onresult && this.onresult({ results: r }); }
    end() { this.live = false; this.onend && this.onend(); }
    fail(e) { this.onerror && this.onerror({ error: e }); this.end(); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
})()"""
NO_SR = "delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;"
# every visible typing box >= 90 px wide must carry the mic; returns the ones that don't
MISSING = """(() => {
  const bad = [], ok = [];
  document.querySelectorAll('input,textarea').forEach(el => {
    if (!window.voiceFill.eligible(el) || el.offsetWidth < 90) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetParent) return;
    const has = el.classList.contains('vf-mic') && /svg/.test(cs.backgroundImage) && parseFloat(cs.paddingRight) >= 34;
    (has ? ok : bad).push(el.id || el.name || el.placeholder || el.outerHTML.slice(0, 60));
  });
  return { ok: ok.length, bad, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
})()"""
errors = []


def page(b, base, path, sr=True, extra_init=None, route_extra=None):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Chicago")
    T.route(ctx)
    if route_extra: route_extra(ctx)
    ctx.add_init_script(FAKE_SR if sr else NO_SR)
    if extra_init: ctx.add_init_script(extra_init)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{path}: {e}"))
    pg.clock.install(time="2026-10-01T08:00:00-05:00")
    pg.goto(base + path)
    return ctx, pg


def wait_vf(pg, ms=8000):
    try: pg.wait_for_function("!!window.voiceFill", timeout=ms); pg.wait_for_timeout(300); return True
    except Exception: return False


def mic_tap(pg, sel):
    r = pg.evaluate(f"(() => {{ const r = document.querySelector({sel!r}).getBoundingClientRect(); return [r.right, r.top, r.bottom, r.height]; }})()")
    y = r[1] + min(r[3] / 2, 18)
    pg.mouse.click(r[0] - 14, y); pg.wait_for_timeout(150)


def test_box(pg):
    """A plain test area in the page: one box of each kind, built after the page loaded (the observer must catch them)."""
    pg.evaluate("""(() => { const d = document.createElement('div'); d.id = 'vfTest';
      d.style.cssText = 'position:fixed;left:10px;top:60px;width:340px;z-index:2147483000;background:#fff;padding:8px';
      d.innerHTML = `<input id="t1" style="width:300px;font:16px sans-serif"><input id="t2" type="email" style="width:300px">
        <input id="t3" type="number" style="width:300px"><textarea id="t4" style="width:300px;height:80px"></textarea>
        <div id="t5" contenteditable="true" style="width:300px;min-height:30px;border:1px solid #999"></div>
        <input id="n1" type="password" style="width:300px"><input id="n2" type="date" style="width:300px"><input id="n3" type="checkbox">
        <input id="n4" readonly style="width:300px"><input id="n5" disabled style="width:300px"><input id="n6" data-novoice style="width:300px">
        <input id="n7" style="width:60px">`;
      window.__ev = []; d.addEventListener('input', e => __ev.push('input ' + e.target.id)); d.addEventListener('change', e => __ev.push('change ' + e.target.id));
      document.body.appendChild(d); })()""")
    pg.wait_for_timeout(400)


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. every Hub: the file loads, every typing box in Settings has the mic, nothing sideways]")
        for hid, path in HUBS.items():
            ctx, pg = page(b, base, path)
            if not wait_vf(pg): check(f"{hid}: voicefill.js loads", False); ctx.close(); continue
            check(f"{hid}: voicefill.js loads", pg.evaluate("!!document.querySelector('script[src*=\"voicefill.js\"]')"))
            pg.evaluate("document.getElementById('sheet') && document.getElementById('sheet').classList.remove('hidden')")
            pg.wait_for_timeout(500)
            r = pg.evaluate(MISSING)
            check(f"{hid}: every typing box in Settings shows the mic ({r['ok']} boxes)", r["ok"] > 0 and not r["bad"], r)
            check(f"{hid}: nothing sideways with the mics in", not r["sideways"])
            ctx.close()

        print("\n[2. talking into a box (Day Hub)]")
        ctx, pg = page(b, base, "/"); wait_vf(pg); test_box(pg)
        kinds = pg.evaluate("['t1','t2','t3','t4','t5','n1','n2','n3','n4','n5','n6','n7'].map(i => [i, document.getElementById(i).classList.contains('vf-mic')])")
        k = dict(kinds)
        check("a box added after load gets the mic (text, email, number, textarea, contenteditable)", all(k[i] for i in ("t1", "t2", "t3", "t4", "t5")), k)
        check("no mic on password, date, checkbox, read-only, disabled, data-novoice or a narrow box", not any(k[i] for i in ("n1", "n2", "n3", "n4", "n5", "n6", "n7")), k)
        check("textarea: the mic sits at the top right", "top" in pg.evaluate("getComputedStyle(document.getElementById('t4')).backgroundPosition") or
              pg.evaluate("getComputedStyle(document.getElementById('t4')).backgroundPositionY") in ("10px", "top 10px"))
        mic_tap(pg, "#t1")
        check("tap on the mic: it listens (red mic), no keyboard (inputmode none)", pg.evaluate("__sr.length === 1 && __sr[0].live && document.getElementById('t1').classList.contains('vf-on') && document.getElementById('t1').getAttribute('inputmode') === 'none'"))
        pg.evaluate("__sr[0].say('pick up milk'); __sr[0].end()"); pg.wait_for_timeout(150)
        check("the words go into the box", pg.evaluate("document.getElementById('t1').value") == "pick up milk")
        ev = pg.evaluate("__ev")
        check("the app hears input and change", "input t1" in ev and "change t1" in ev, ev)
        check("afterwards: mic back to normal, inputmode back, the box let go", pg.evaluate("!document.getElementById('t1').classList.contains('vf-on') && !document.getElementById('t1').hasAttribute('inputmode') && document.activeElement !== document.getElementById('t1')"))
        mic_tap(pg, "#t1"); pg.evaluate("__sr[1].say('and eggs'); __sr[1].end()"); pg.wait_for_timeout(150)
        check("more words are added after what is already there", pg.evaluate("document.getElementById('t1').value") == "pick up milk and eggs")
        mic_tap(pg, "#t1"); mic_tap(pg, "#t1"); pg.wait_for_timeout(100)
        check("a second tap stops listening", pg.evaluate("!__sr[2].live && !document.getElementById('t1').classList.contains('vf-on')"))
        n = pg.evaluate("__sr.length")
        r = pg.evaluate("(() => { const r = document.getElementById('t1').getBoundingClientRect(); return [r.left, r.top, r.height]; })()")
        pg.mouse.click(r[0] + 30, r[1] + r[2] / 2); pg.wait_for_timeout(150)
        check("a tap on the rest of the box is an ordinary tap (no listening, the box takes focus)", pg.evaluate("__sr.length") == n and pg.evaluate("document.activeElement.id") == "t1")
        mic_tap(pg, "#t2"); pg.evaluate("__sr[__sr.length - 1].say('Sam Smith at gmail dot com'); __sr[__sr.length - 1].end()"); pg.wait_for_timeout(150)
        check("email box: 'Sam Smith at gmail dot com' -> samsmith@gmail.com", pg.evaluate("document.getElementById('t2').value") == "samsmith@gmail.com", pg.evaluate("document.getElementById('t2').value"))
        mic_tap(pg, "#t3"); pg.evaluate("__sr[__sr.length - 1].say('25 dollars'); __sr[__sr.length - 1].end()"); pg.wait_for_timeout(150)
        check("number box: digits only", pg.evaluate("document.getElementById('t3').value") == "25")
        mic_tap(pg, "#t4"); pg.evaluate("__sr[__sr.length - 1].say('call the vet'); __sr[__sr.length - 1].end()"); pg.wait_for_timeout(150)
        check("textarea: mic at the top right takes words", pg.evaluate("document.getElementById('t4').value") == "call the vet")
        mic_tap(pg, "#t5"); pg.evaluate("__sr[__sr.length - 1].say('note one'); __sr[__sr.length - 1].end()"); pg.wait_for_timeout(150)
        check("contenteditable box takes words", pg.evaluate("document.getElementById('t5').textContent") == "note one")
        mic_tap(pg, "#t1"); pg.evaluate("__sr[__sr.length - 1].fail('not-allowed')"); pg.wait_for_timeout(150)
        check("mic not allowed: says how to allow it", "Allow the microphone" in pg.evaluate("(document.getElementById('vfToast') || {}).textContent || ''"))
        ctx.close()

        print("\n[3. a browser with no speech: the keyboard's mic]")
        ctx, pg = page(b, base, "/", sr=False); wait_vf(pg); test_box(pg)
        mic_tap(pg, "#t1")
        check("the mic opens the keyboard (the box takes focus) and says to use the keyboard's mic",
              pg.evaluate("document.activeElement.id") == "t1" and "keyboard" in pg.evaluate("(document.getElementById('vfToast') || {}).textContent || ''"))
        ctx.close()

        print("\n[4. the switch: VOICE_FILL off]")
        def off(c):
            def h(r):
                resp = r.fetch(); body = resp.text().replace("VOICE_FILL: true", "VOICE_FILL: false")
                r.fulfill(status=200, headers={"content-type": "text/javascript"}, body=body)
            c.route(re.compile(r".*/dayhub/features\.js.*"), h)
        ctx, pg = page(b, base, "/", route_extra=off)
        reqs = []; pg.on("request", lambda r: reqs.append(r.url))
        pg.reload(); pg.wait_for_function("typeof render === 'function'"); pg.wait_for_timeout(1500)
        check("off: voicefill.js is never fetched and no box has a mic", not any("voicefill" in u for u in reqs) and not pg.evaluate("!!window.voiceFill || !!document.querySelector('.vf-mic')"))
        ctx.close()

        print("\n[5. the other apps load it from /dayhub/voicefill.js]")
        for path in ["/../scotthub/", "/../marvelmagic/", "/../hubs/", "/../hubs/photohub/"]:
            ctx, pg = page(b, base, path)
            check(f"{path.strip('/.')}: voicefill.js loads", wait_vf(pg))
            ctx.close()

        b.close()
    srv.shutdown()
    real = [e for e in errors if "voicefill" in e.lower() or "voiceFill" in e]
    check("no page errors from voicefill.js", not real, real[:3])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
