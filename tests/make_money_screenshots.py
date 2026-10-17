"""
SAVE AS: make_money_screenshots.py   LOCATION: C:/MarvelApps/dayhub/tests/make_money_screenshots.py

MONEY HUB STORE SCREENSHOTS (v1.45 control room). Same harness as make_screenshots.py (frozen clock Thu Oct 1
8:00 AM, fixture weather, an empty phone + SAMPLE data - not anyone's real money) and saves into
C:/MarvelApps/moneyhub/screenshots/:
    phone-1-home.png  phone-2-payments.png  phone-3-add-by-photo.png  phone-4-forecast.png   1080x1920
    wide-1-payments.png                                                                      1280x800
RUN:   python tests/make_money_screenshots.py      (from C:/MarvelApps/dayhub)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(T.ROOT), "moneyhub", "screenshots")
DEMO = """
S.name = 'Scott'; const M = mh(); M.setup = '2026-09-01';
M.accounts = [{id:'a1',kind:'checking',name:'Checking',bal:4320,at:'2026-10-01'},{id:'a2',kind:'savings',name:'Savings',bal:6200,at:'2026-10-01'},
 {id:'a3',kind:'credit',name:'Visa',bal:1240,apr:22,min:45,at:'2026-10-01'},{id:'a4',kind:'invest',name:'Roth IRA',bal:720,at:'2026-10-01'}];
S.payday.freq = 'biweekly'; S.payday.next = '2026-10-09'; S.payday.amount = 2450;
S.bills = [{id:'b1',name:'Rent',amount:1800,day:1,paid:'2026-10',auto:true,cat:'housing'},{id:'b2',name:'Spotify',amount:10.99,day:2,paid:'2026-09',auto:true,cat:'subs'},
 {id:'b3',name:'Netflix',amount:15.99,day:3,paid:'2026-09',auto:true,cat:'subs'},{id:'b4',name:'Electric',amount:120,day:4,paid:'2026-09',auto:false,cat:'utilities'},
 {id:'b5',name:'Phone plan',amount:45,day:12,paid:'2026-09',auto:true,cat:'utilities'},{id:'b6',name:'Gym membership',amount:29.99,day:15,paid:'2026-09',auto:true,cat:'health'},
 {id:'b7',name:'Car insurance',amount:132,day:20,paid:'2026-09',auto:false,cat:'insurance'}];
const tx = [['2026-10-01',-52.36,'Whole Foods','groceries'],['2026-10-01',2450,'Salary','pay'],['2026-09-30',-18.40,'Uber','transport'],['2026-09-29',-89.99,'Amazon','shopping'],
 ['2026-09-28',-6.75,'Starbucks','dining'],['2026-09-24',-14.20,"McDonald's",'dining'],['2026-09-23',-13.99,'YouTube Premium','subs'],['2026-09-22',-41.10,'Shell','transport'],
 ['2026-09-18',-120.44,'Kroger','groceries'],['2026-09-15',-64.00,'Petco','pets'],['2026-09-12',2450,'Salary','pay'],['2026-09-10',-210.00,'Target','shopping'],
 ['2026-08-28',2450,'Salary','pay'],['2026-08-20',-300,'Kroger','groceries'],['2026-08-14',2450,'Salary','pay'],['2026-08-10',-1800,'Rent','housing']];
M.tx = tx.map(([date,amt,what,cat],i) => ({id:'t'+i,date,amt,what,cat,acct:''}));
M.subs = [{id:'s1',name:'Netflix',amt:15.99,every:'month',next:'2026-10-03'},{id:'s2',name:'Spotify',amt:10.99,every:'month',next:'2026-10-02'},{id:'s3',name:'iCloud',amt:2.99,every:'month',next:'2026-10-18'}];
M.budgets = {groceries: 400, dining: 100, shopping: 250};
S.goals = [{id:'g1',name:'Dream Home',target:20000,saved:4200,icon:'🏠',by:'2028-06-01'},{id:'g2',name:'Japan Trip',target:5000,saved:1800,icon:'✈️',by:'2027-05-01'},
 {id:'g3',name:'New Car',target:15000,saved:2450,icon:'🚗',by:''},{id:'g4',name:'Emergency Fund',target:10000,saved:0,icon:'🛡️',by:''}];
save(); render();
"""


def open_app(b, base, w, h, scale):
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=scale, timezone_id="America/Chicago")
    T.route(ctx); pg = ctx.new_page()
    pg.clock.install(time="2026-10-01T08:00:00-05:00")
    pg.goto(base + T.MONEYP); pg.wait_for_function("typeof render === 'function'")
    pg.evaluate(DEMO); pg.wait_for_timeout(300)
    pg.evaluate("briefOpen() && document.querySelector('[data-brief=go]') && document.querySelector('[data-brief=go]').click()")
    return ctx, pg


def shoot(pg, name):
    pg.evaluate("document.getElementById('toast').classList.remove('show')"); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(OUT, name)); print("  saved", name)


def main():
    os.makedirs(OUT, exist_ok=True)
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx, pg = open_app(b, base, 360, 640, 3)
        pg.evaluate("document.querySelector('.mv-home').scrollIntoView()"); shoot(pg, "phone-1-home.png")
        pg.evaluate("showMh('bills')"); shoot(pg, "phone-2-payments.png")
        pg.evaluate("hideMh(); showMh('add')"); shoot(pg, "phone-3-add-by-photo.png")
        pg.evaluate("hideMh(); showMh('forecast')"); shoot(pg, "phone-4-forecast.png")
        ctx.close()
        ctx, pg = open_app(b, base, 1280, 800, 1)
        pg.evaluate("showMh('bills')"); shoot(pg, "wide-1-payments.png")
        ctx.close(); b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
