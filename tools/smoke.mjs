/* Smoke test: open every registered screen, in every role, and fail on any
   console error or uncaught exception. Also dumps the English string catalogue
   so the translation files can be generated from what the app actually uses.

   Usage:  node tools/smoke.mjs [--dump path.json] [--shots dir]
*/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const dumpAt = process.argv.includes('--dump') ? process.argv[process.argv.indexOf('--dump') + 1] : null;
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotsAt) await mkdir(shotsAt, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

const problems = [];
page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

await page.goto(base, { waitUntil: 'networkidle' });

await page.waitForFunction(() => !!globalThis.wafra);

const screens = await page.evaluate(() =>
  Object.values(wafra.SCREENS).map((s) => ({ id: s.id, route: s.route ?? s.id })));

const roles = ['owner', 'supervisor'];
let checked = 0;

for (const role of roles) {
  await page.evaluate((r) => {
    wafra.state.session.role = r;
    wafra.state.session.demo = false;
    wafra.commit('test');
  }, role);

  for (const s of screens) {
    const before = problems.length;
    await page.evaluate((route) => wafra.jump(route), s.route);
    await page.waitForTimeout(28);
    const bad = await page.evaluate(() => {
      const app = document.getElementById('app');
      // A route to a screen that no longer exists renders a readable sentence,
      // which is long enough to pass a character count. It has to be detected
      // as what it is.
      if (app?.querySelector('[data-missing-screen]')) return 'no such screen';
      if ((app?.textContent ?? '').trim().length < 12) return 'empty render';
      return null;
    });
    if (bad) problems.push(`${bad}: ${s.id} (${role})`);
    if (problems.length > before) problems.push(`  ↳ while rendering ${s.id} as ${role}`);
    checked += 1;
    if (shotsAt && role === 'owner') {
      await page.screenshot({ path: join(shotsAt, `${s.id}.png`), clip: await page.evaluate(() => {
        const el = document.getElementById('device');
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }) });
    }
  }
}

// Exercise the overlay layer too — the upgrade sheet, the pickers, the modals.
const overlayIds = ['UPGRADE', 'CONFIRM', 'NOTICE', 'NEEDS_CONNECTION', 'C3', 'MEASURE_PICKER', 'MEASURE_INFO',
  'FARM_PICKER', 'FARM_SWITCH', 'PLOT_PICKER', 'JOIN_PLOT_PICKER', 'CROP_PICKER',
  'LANG_PICKER', 'REPORT_RECIPIENT', 'MAP_SEARCH', 'TREE_FINDER', 'PLOT_SHAPE_MENU', 'AREA_EDIT', 'AREA_TOOL',
  'PLOT_EDIT', 'BIOMETRIC', 'LOCATION_BLOCKED',
  'PLOT_MENU', 'TREE_MENU', 'ADVICE_MENU', 'ADVICE_FILTER', 'ADVICE_SORT', 'SEND_TO', 'ADVICE_RECIPIENTS', 'WORKER', 'SHOW_WHERE', 'HELP_NOTE',
  'ASSUMPTIONS', 'ADVISORY_LOG', 'DELETE_PLOT', 'DELETE_FARM', 'DELETE_ACCOUNT', 'CLOSE_CYCLE',
  'SEARCH', 'NOTIFICATIONS', 'REPORT', 'PLAN_CHOOSER', 'CONTACT_PREVIEW',
  'CONTACT', 'LEGAL', 'LEAVE_REASON'];

// Every overlay the app can open must be in that list, or a broken one is
// simply never rendered — which is how a duplicate object key that silently
// overrode a picker's own onPick survived a green run.
const declaredOverlays = await page.evaluate(() => Object.keys(wafra.OVERLAYS ?? {}));
const untested = declaredOverlays.filter((id) => !overlayIds.includes(id));
if (untested.length) problems.push(`overlays never opened by this test: ${untested.join(', ')}`);

await page.evaluate(() => { wafra.state.session.role = 'owner'; wafra.commit('test'); });

// The measure explanations are content strings, registered lazily by tc() the
// first time each one is drawn. Opening the sheet for a single measure leaves
// the other six out of the catalogue and therefore out of every translation.
for (const key of await page.evaluate(() => wafra.state.db.measures.map((m) => m.key))) {
  await page.evaluate((k) => wafra.openSheet('MEASURE_INFO', { key: k }), key);
  await page.waitForTimeout(14);
}
await page.evaluate(() => wafra.state.ui.overlay = null);

const PARAMS = {
  UPGRADE: { featureKey: 'irrigation.schedule' },
  NEEDS_CONNECTION: { what: 'a connection to send this to your supervisor' },
  C3: { plotId: 'plot-23' }, MEASURE_PICKER: {}, PLOT_PICKER: { farmId: 'farm-3' },
  FARM_SWITCH: { current: 'farm-1' }, CROP_PICKER: {},
  HELP_NOTE: { title: 'How to draw this', body: 'Trace the outside of your land.' },
  PLOT_MENU: { plotId: 'plot-23' }, TREE_MENU: { treeId: 'T-2841' },
  ADVICE_MENU: { adviceId: 'adv-01' }, SHOW_WHERE: { adviceId: 'adv-01' },
  ADVICE_FILTER: { axis: 'status' },
  ASSUMPTIONS: { plotId: 'plot-23' }, ADVISORY_LOG: { adviceId: 'adv-01' },
  DELETE_PLOT: { plotId: 'plot-23' }, DELETE_FARM: { farmId: 'farm-1' },
  CLOSE_CYCLE: { plotId: 'plot-13', cycleId: 'plot-13-cyc-1' },
  REPORT: { reportId: 'rep-01' },
  CONTACT_PREVIEW: { channel: 'whatsapp' }, LEGAL: { doc: 'terms' },
  CONFIRM: { title: 'x', body: 'y' },
  AREA_EDIT: { farmId: 'farm-6', areaId: 'farm-6-a1' },
  AREA_TOOL: { farmId: 'farm-6', tool: 'join' },
  PLOT_EDIT: { index: 0 },
  MEASURE_INFO: { key: 'ndvi' }, MAP_SEARCH: {}, TREE_FINDER: { farmId: 'farm-1' },
  PLOT_SHAPE_MENU: { plotId: 'plot-23' }, JOIN_PLOT_PICKER: { farmId: 'farm-3', exclude: 'plot-23' },
  WORKER: { id: 'user-2', farmId: 'farm-1' },
};

for (const id of overlayIds) {
  const before = problems.length;
  await page.evaluate(([view, params]) => {
    wafra.jump('B2:farm-1');
    wafra.openSheet(view, params ?? {});
  }, [id, PARAMS[id] ?? {}]);
  await page.waitForTimeout(22);
  const drawn = await page.evaluate(() => !!document.querySelector('.overlay .sheet, .overlay .modal'));
  if (!drawn) problems.push(`overlay did not render: ${id}`);
  if (problems.length > before) problems.push(`  ↳ while rendering overlay ${id}`);
  checked += 1;
}

// Every language, on a representative screen, to catch RTL/format crashes.
for (const lang of ['en', 'ar', 'hi', 'bn', 'ps']) {
  const before = problems.length;
  await page.evaluate((l) => { wafra.setLanguage(l); wafra.jump('B4:plot-04'); }, lang);
  await page.waitForTimeout(30);
  if (problems.length > before) problems.push(`  ↳ while rendering in ${lang}`);
  checked += 1;
}
await page.evaluate(() => wafra.setLanguage('en'));

// Every farm, plot and tree — farm-4 has no imagery at all, which is the case
// most likely to break a date stepper.
const entities = await page.evaluate(() => ({
  farms: wafra.state.db.farms.map((f) => f.id),
  plots: wafra.state.db.plots.map((p) => p.id),
  cropPlots: wafra.state.db.plots.filter((p) => p.kind !== 'trees').map((p) => p.id),
  treeGroups: wafra.state.db.plots.filter((p) => p.kind === 'trees').map((p) => p.id),
  trees: wafra.state.db.trees.slice(0, 8).map((t) => t.id),
  advice: wafra.state.db.advice.map((a) => ({ id: a.id, type: a.type })),

  // A survey area is addressed as `area=<farmId>|<areaId>`, and the survey has
  // to be materialised before its ids exist.
  areas: (() => {
    const farm = wafra.state.db.farms.find((f) => f.survey);
    if (!farm) return [];
    return wafra.ensureSurvey(farm).slice(0, 3).map((a) => `${farm.id}|${a.id}`);
  })(),
}));

const routes = [
  ...entities.farms.flatMap((id) => [`B2:${id}`, `B11:${id}`, `B14:${id}`, `F1:${id}`, `F15:${id}`, `A11:${id}`, `A13:${id}`]),
  ...entities.areas.map((a) => `C5:area=${a}`),
  // A tree group has no crop cycle and no plot detail of its own — B4 hands it
  // to B13 — so the cycle screens are walked over the crop plots only.
  ...entities.plots.map((id) => `B4:${id}`),
  ...entities.cropPlots.flatMap((id) => [`B5:${id}`, `B6:${id}`, `C5:${id}`]),
  ...entities.treeGroups.map((id) => `B13:${id}`),
  ...entities.trees.map((id) => `B10:${id}`),
  // Weather records are not advice since the Monday review, so they have no
  // detail screen; D6 went with them.
  ...entities.advice.filter((a) => a.type !== 'weather')
    .map((a) => `${({ irrigation: 'D2', nutrition: 'D3', protection: 'D4' })[a.type]}:${a.id}`),
  'B4:plot-23',
];
for (const route of routes) {
  const before = problems.length;
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(12);
  const missing = await page.evaluate(() =>
    document.querySelector('#app [data-missing-screen]')?.dataset.missingScreen ?? null);
  if (missing) problems.push(`no such screen "${missing}" for route`);
  if (problems.length > before) problems.push(`  ↳ while rendering ${route}`);
  checked += 1;
}

// Plan and connectivity variations, on the screens that gate on them.
for (const plan of ['crop_basic', 'crop_pro', 'tree_basic', 'tree_pro', 'combined_basic', 'combined_pro', 'trial_expired']) {
  for (const route of ['B2:farm-3', 'B4:plot-23', 'B13:tg-01', 'B5:plot-13', 'C1', 'C2', 'D1', 'F5', 'F6', 'F10', 'F15:farm-1']) {
    const before = problems.length;
    await page.evaluate(([p, r]) => { wafra.state.session.plan = p; wafra.jump(r); }, [plan, route]);
    await page.waitForTimeout(10);
    if (problems.length > before) problems.push(`  ↳ ${route} on ${plan}`);
    checked += 1;
  }
}
await page.evaluate(() => { wafra.state.session.plan = 'crop_pro'; });

for (const conn of ['offline', 'syncing', 'online']) {
  for (const route of ['B2:farm-1', 'C1', 'C5:plot-23', 'D2:adv-01', 'B6:plot-13', 'F10']) {
    const before = problems.length;
    await page.evaluate(([c, r]) => {
      wafra.state.session.connectivity = c;
      wafra.state.session.pendingSync = c === 'online' ? 0 : 3;
      wafra.jump(r);
    }, [conn, route]);
    await page.waitForTimeout(10);
    if (problems.length > before) problems.push(`  ↳ ${route} while ${conn}`);
    checked += 1;
  }
}

// WF5.065 / WF4.036 — refusing location must not take a screen away, only the
// parts of it that genuinely need a position.
for (const granted of [false, true]) {
  for (const route of ['C1', 'B10:T-2841', 'B10:T-2805', 'B13:tg-01']) {
    const before = problems.length;
    await page.evaluate(([g, r]) => { wafra.state.session.gpsGranted = g; wafra.jump(r); }, [granted, route]);
    await page.waitForTimeout(14);
    if (problems.length > before) problems.push(`  ↳ ${route} with location ${granted ? 'granted' : 'refused'}`);
    checked += 1;
  }
  for (const params of [{ treeId: 'T-2841' }, { adviceId: 'adv-01' }]) {
    const before = problems.length;
    await page.evaluate((p) => { wafra.jump('B13:tg-01'); wafra.openSheet('SHOW_WHERE', p); }, params);
    await page.waitForTimeout(14);
    const drawn = await page.evaluate(() => !!document.querySelector('.overlay .sheet'));
    if (!drawn) problems.push(`SHOW_WHERE did not render for ${JSON.stringify(params)}`);
    if (problems.length > before) problems.push(`  ↳ SHOW_WHERE ${JSON.stringify(params)} location ${granted}`);
    checked += 1;
  }
}

// Demo mode unlocks everything (WF4.091) and must not break a gated screen.
await page.evaluate(() => { wafra.state.session.demo = true; wafra.commit('t'); });
for (const route of ['B2:farm-1', 'B2:farm-3', 'C2', 'D1', 'F5', 'A9B']) {
  const before = problems.length;
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(10);
  if (problems.length > before) problems.push(`  ↳ ${route} in demo mode`);
  checked += 1;
}
await page.evaluate(() => { wafra.state.session.demo = false; wafra.commit('t'); });

// §5.6 is two sentences now. Every farm has exactly one supervisor, and that is
// who work goes to by default — the thing that breaks silently is a farm with
// nobody attached, because the send button simply stops being drawn, on every
// card, with no error anywhere.
//
// And since the Monday review a farm also has a WORKFORCE: people in B14's
// address book who receive messages and hold no account. They carry role
// 'worker', which is deliberately NOT a role the capability matrix knows —
// ROLE_INDEX still has exactly two entries, and that is the invariant worth
// asserting. A worker who could be selected in the harness would be a login
// that does not exist.
{
  const before = problems.length;
  const sup = await page.evaluate(() => {
    const farms = wafra.state.db.farms.map((f) => f.id);
    return {
      missing: farms.filter((id) => !wafra.sel.supervisorOf(id)),
      // Two ACCOUNT roles, and the matrix has to agree. Anyone else in the
      // team is address-book only.
      roles: [...new Set(wafra.state.db.team.map((m) => m.role))].filter((r) => r !== 'worker').sort(),
      matrixRoles: Object.keys(wafra.MATRIX_ROLES ?? { owner: 0, supervisor: 1 }).sort(),
      // Every person work can be sent to has a number and a channel to reach
      // them on; an address book entry with neither reaches nobody.
      reachable: wafra.state.db.team.filter((m) => !m.isYou).every((m) => m.phone && m.channel),
      // Only the owner may send work; a supervisor cannot send it to himself.
      ownerSends: wafra.can('advice.send', null, 'owner'),
      supSends: wafra.can('advice.send', null, 'supervisor'),
    };
  });
  if (sup.missing.length) problems.push(`farms with no supervisor to send work to: ${sup.missing.join(', ')}`);
  if (sup.roles.join(',') !== 'owner,supervisor') problems.push(`account roles in the fixtures are ${sup.roles.join(', ')}, expected owner and supervisor`);
  if (!sup.reachable) problems.push('somebody in the workforce has no number or no channel to reach them on');
  if (!sup.ownerSends) problems.push('the owner cannot send advice');
  if (sup.supSends) problems.push('a supervisor can send advice to himself');
  if (problems.length > before) problems.push('  ↳ while checking the owner/supervisor model');
  checked += 1;
}


// THE PLOT LINE, which is what B2 is for. Four things have to be on every row —
// the name, the crop as a CONTROL, the size and a way in — and the one that
// breaks silently is the crop: it is a button, and a button that stopped being
// one still renders as text nobody notices they cannot press.
//
// Earlier blocks walk farms through the survey flow, and a farm mid-survey
// draws the waiting card instead of a plot list, so the survey state is parked
// for the length of this check and put back afterwards.
const parkedSurveys = await page.evaluate(() => {
  const saved = wafra.state.db.farms.map((f) => [f.id, f.survey]);
  wafra.state.db.farms.forEach((f) => { if (f.survey?.state !== 'confirmed') f.survey = null; });
  return saved;
});
{
  const before = problems.length;
  const seen = await page.evaluate(() => {
    wafra.jump('B2:farm-3');
    const lines = [...document.querySelectorAll('.page .plotline')];
    return {
      lines: lines.length,
      plots: wafra.sel.plotsOf('farm-3').length,
      crops: lines.filter((l) => l.querySelector('.plotline__crop')).length,
      buttons: lines.filter((l) => l.querySelector('button.plotline__crop')).length,
      empty: lines.filter((l) => l.querySelector('.plotline__crop--empty')).length,
      go: lines.filter((l) => l.querySelector('.plotline__go')).length,
      cards: document.querySelectorAll('.page .plotcard').length,
      // The review took all four off this screen; each would come back as a
      // whole block, so each is worth naming when it does.
      legend: (document.querySelector('.page')?.textContent ?? '').includes('act within days'),
      filter: !!document.querySelector('.page select'),
      nothingUrgent: (document.querySelector('.page')?.textContent ?? '').includes('Nothing urgent'),
    };
  });
  if (seen.lines !== seen.plots) problems.push(`B2 draws ${seen.lines} plot lines for ${seen.plots} plots`);
  if (seen.crops !== seen.lines) problems.push(`B2: ${seen.lines - seen.crops} plot lines do not say what is growing on them`);
  if (!seen.buttons) problems.push('B2: no plot line offers the crop as a control');
  if (seen.empty !== 1) problems.push(`B2: ${seen.empty} plots prompt for a crop, expected 1 (plot-23 is between crops)`);
  if (seen.go !== seen.lines) problems.push('B2: a plot line has no way through to the plot');
  if (seen.cards) problems.push(`B2: ${seen.cards} plots are still drawn as cards`);
  if (seen.legend) problems.push('B2: the status legend is back');
  if (seen.filter) problems.push('B2: the plot filter is back');
  if (seen.nothingUrgent) problems.push('B2 says "Nothing urgent" — silence is the answer when nothing is');
  if (problems.length > before) problems.push('  ↳ while checking the plot list on B2');
  checked += 1;
}
await page.evaluate((saved) => {
  for (const [id, survey] of saved) wafra.state.db.farms.find((f) => f.id === id).survey = survey;
}, parkedSurveys);

// A12 IS GONE, and this is what stops it coming back. The 01/09 review deleted
// it — "not sure what purpose this screen is fulfilling. After A10 he should go
// to A11. It is too early for him to request a quote." — so the registry must
// not carry it and no route may reach it. A deleted screen that a go() call
// still points at is a dead end nothing else in this test would notice.
{
  const before = problems.length;
  const gone = await page.evaluate(() => ({
    registered: Boolean(wafra.SCREENS.A12),
    routed: [...document.querySelectorAll('[data-missing-screen]')].length,
  }));
  if (gone.registered) problems.push('A12 is back in the registry — the 01/09 review deleted it');
  if (problems.length > before) problems.push('  ↳ while checking A12');
  checked += 1;
}
await page.evaluate(() => wafra.resetLocal('signup'));

/* THE CARD IS A SUMMARY, NOT A CONTROL PANEL. The Monday review cut it to three
   lines — severity and kind, the ground, what to do — with everything else on
   the detail screen. So the only button on a card is the share icon, and any
   text button appearing there means the old card is growing back.

   And no card, on any advice surface, ever, says "Mark as complete", "Assign",
   "Record what was done" or "Send to <name>". The first two were the task's; the
   third was D7's, which the review deleted; the fourth named a man the app chose
   for the farmer, which is exactly what sharing replaced. Getting any of this
   wrong is silent — the card still renders. */
{
  const before = problems.length;
  const seen = await page.evaluate(() => {
    wafra.state.ui.farmFilter = 'all';
    Object.assign(wafra.state.session.adviceFilters, {
      severity: 'all', completion: 'all', type: 'all', sort: 'field',
    });
    wafra.state.session.role = 'owner';
    wafra.jump('D1');
    const open = wafra.sel.adviceFor({ status: 'open' });
    const labels = [...document.querySelectorAll('.page .card .btn')].map((b) => b.textContent.trim());
    return {
      wantOpen: open.length,
      wantSent: open.filter((a) => wafra.sel.isSent(a)).length,
      cardButtons: labels,
      share: document.querySelectorAll('.page .card .cardshare').length,
    };
  });
  if (!seen.wantSent || seen.wantSent === seen.wantOpen) problems.push('D1 fixtures no longer show both advice states');
  for (const bad of ['Mark as complete', 'Assign', 'Record what was done']) {
    if (seen.cardButtons.includes(bad)) problems.push(`D1: a card carries a "${bad}" button`);
  }
  if (seen.cardButtons.some((l) => l.startsWith('Send to '))) {
    problems.push('D1: a card names who to send to — the SEND_TO sheet chooses the person now');
  }
  if (seen.share !== seen.wantOpen) problems.push(`D1: ${seen.share} share controls on cards, expected ${seen.wantOpen}`);
  if (problems.length > before) problems.push('  ↳ while checking the advice card face');
  checked += 1;
}
await page.evaluate(() => { wafra.state.session.adviceFilters.completion = 'notsent'; });

// WF4.030 — the tour runs once, on first launch, and Help is the only way back
// to it afterwards. The two entrances differ in exactly one way: where the last
// card leads. Both are checked, because a tour opened from Help that ends by
// sending the farmer to the front door is the failure worth catching.
{
  const before = problems.length;
  const ends = await page.evaluate(async () => {
    const dock = () => document.querySelector('.actiondock');
    const read = () => dock()?.querySelector('button')?.textContent?.trim();
    const runToEnd = (route) => {
      wafra.resetLocal('signup');
      wafra.jump(route);
      for (let i = 0; i < 10; i += 1) {
        const label = read();
        if (label !== 'Next') return label;
        dock().querySelector('button').click();
      }
      return 'never ended';
    };
    return { signup: runToEnd('A4'), help: runToEnd('A4:help') };
  });
  if (ends.signup !== 'Get started') problems.push(`A4 from first run ends on "${ends.signup}"`);
  if (ends.help !== 'Done') problems.push(`A4 from Help ends on "${ends.help}"`);
  if (problems.length > before) problems.push('  ↳ while walking the guided tour');
  checked += 2;
}

// --- spec audits -----------------------------------------------------------
// These are acceptance criteria, not style preferences, so they are checked
// rather than eyeballed: WF2.002 (360x640), WF2.004 (48dp targets, 8dp apart),
// WF2.006 (16sp body, 20sp actionable numbers), WF2.010 (one primary action).
await page.evaluate(() => { wafra.state.session.role = 'owner'; wafra.state.device.presetId = 'android-min'; wafra.commit('t'); });
await page.waitForTimeout(60);

const audit = [];
for (const s of screens) {
  await page.evaluate((route) => wafra.jump(route), s.route);
  await page.waitForTimeout(24);
  const found = await page.evaluate(() => {
    const app = document.getElementById('app');
    const out = { primaries: 0, small: [], tiny: [], overflowX: false, dim: [] };
    out.primaries = app.querySelectorAll('.btn--primary').length;

    // Contrast. Not a WF id — the specification does not name a ratio — but a
    // farm app is read in full sun, and a CSS cascade accident can flip a whole
    // family of buttons to near-black on dark green without anyone noticing at
    // a glance. WCAG AA: 4.5:1 for body text, 3:1 from 18.5px or bold 14px.
    const lum = (colour) => {
      const [r, g, b] = colour.match(/[\d.]+/g).map(Number);
      const f = [r, g, b].map((v) => (v /= 255, v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    };
    const paintedBg = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      }
      return 'rgb(255, 255, 255)';
    };
    for (const el of app.querySelectorAll('*')) {
      // Only elements that paint text of their own, and only if it is visible.
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (el.closest('svg, .skeleton, .map__legend')) continue;   // decoration and imagery
      const size = parseFloat(cs.fontSize);
      const large = size >= 18.5 || (size >= 14 && Number(cs.fontWeight) >= 700);
      const a = lum(cs.color), b = lum(paintedBg(el));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < (large ? 3 : 4.5)) {
        out.dim.push(`${ratio.toFixed(1)}:1 ${el.className || el.tagName} "${el.textContent.trim().slice(0, 24)}"`);
      }
    }
    for (const el of app.querySelectorAll('button, a, input, select, [role="switch"], [role="radio"]')) {
      if (el.closest('.otp') || el.closest('.chart')) continue; // display-only cells
      if (el.type === 'range') continue;                        // full-area drag surface
      // The target is what a finger can hit: a checkbox inside a tall label
      // inherits the label's box.
      const target = el.closest('label, button, .row, .switch') ?? el;
      const r = target.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 40 || r.width < 30) out.small.push(`${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const el of app.querySelectorAll('.row__title, .card__pad > div, .page > p, .state__body')) {
      if (el.classList.contains('chart__axisrow')) continue;   // chart furniture
      if (el.closest('.tourart')) continue;                    // a picture, not prose
      const size = parseFloat(getComputedStyle(el).fontSize);
      const text = el.textContent.trim();
      if (text && size < 15.5) out.tiny.push(`${size}px "${text.slice(0, 40)}"`);
    }
    // WF2.002 is about what the user experiences, so test the real thing: can
    // the view be scrolled sideways, and is any *visible* control cut off?
    // SVG internals are clipped by their own viewport and do not count.
    const scroll = document.getElementById('scroll');
    if (scroll) {
      const right = scroll.getBoundingClientRect().right;
      let worst = null;
      for (const el of scroll.querySelectorAll('button, input, select, textarea, .row, .chip, .card')) {
        if (el.closest('svg') || el.closest('.chips, .pilltabs') || el.closest('[data-hscroll]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > right + 2) {
          if (!worst || r.right > worst.right) worst = { right: r.right, w: Math.round(r.width), cls: String(el.className).slice(0, 30) || el.tagName };
        }
      }
      if (worst) {
        out.overflowX = true;
        out.overflowBy = `${worst.cls} runs ${Math.round(worst.right - right)}px past the edge`;
      }
    }
    return out;
  });
  /* WF2.010 IS ONE PRIMARY ACTION PER SCREEN, WITH ONE NAMED EXCEPTION.

     A13 puts two plan cards side by side and a Choose button on each. Review
     S03 asked for the two buttons to be the SAME, because a green one on one
     card and a grey one on the other is the app choosing for the farmer; the
     round after it asked for the same button to be the PRIMARY one, because a
     grey button under a price reads as the option you are being talked out of.
     Two equal primaries is the requirement being met rather than broken — the
     screen has one decision on it, offered twice. Named here so that a THIRD
     primary appearing on A13, or a second one anywhere else, still fails. */
  const allowed = s.id === 'A13' ? 2 : 1;
  if (found.primaries > allowed) audit.push(`WF2.010 ${s.id}: ${found.primaries} primary actions`);
  if (found.small.length) audit.push(`WF2.004 ${s.id}: ${found.small.length} targets under 36dp — ${found.small.slice(0, 3).join(', ')}`);
  if (found.tiny.length) audit.push(`WF2.006 ${s.id}: ${found.tiny.length} body strings under 16sp — ${found.tiny.slice(0, 2).join(', ')}`);
  if (found.overflowX) audit.push(`WF2.002 ${s.id}: content scrolls sideways at 360 dp — ${found.overflowBy ?? ''}`);
  if (found.dim.length) audit.push(`contrast ${s.id}: ${found.dim.length} below AA — ${found.dim.slice(0, 3).join(' · ')}`);
  checked += 1;
}

// WF2.007 — the same screens at 200% text must not lose the primary action or
// push content off the side.
await page.evaluate(() => { wafra.state.device.fontScale = 2; wafra.commit('t'); });
await page.waitForTimeout(60);
for (const s of screens) {
  await page.evaluate((route) => wafra.jump(route), s.route);
  await page.waitForTimeout(24);
  const bad = await page.evaluate(() => {
    const scroll = document.getElementById('scroll');
    const app = document.getElementById('app');
    const dock = app.querySelector('.actiondock .btn--primary');
    const appRect = app.getBoundingClientRect();
    const clipped = dock ? (dock.getBoundingClientRect().bottom > appRect.bottom + 2) : false;
    let wide = false;
    if (scroll) {
      const right = scroll.getBoundingClientRect().right;
      for (const el of scroll.querySelectorAll('button, input, select, textarea, .row, .chip, .card')) {
        if (el.closest('svg') || el.closest('.chips, .pilltabs') || el.closest('[data-hscroll]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > right + 2) { wide = true; break; }
      }
    }
    return { wide, clipped };
  });
  if (bad.wide) audit.push(`WF2.007 ${s.id}: sideways scroll at 200% text`);
  if (bad.clipped) audit.push(`WF2.007 ${s.id}: primary action pushed off-screen at 200% text`);
  checked += 1;
}
await page.evaluate(() => { wafra.state.device.fontScale = 1; wafra.state.device.presetId = 'iphone-14'; wafra.commit('t'); });

if (audit.length) {
  console.log(`\n${audit.length} spec-audit findings:`);
  for (const a of audit.slice(0, 40)) console.log('  ' + a);
} else {
  console.log('spec audits clean: WF2.002, WF2.004, WF2.006, WF2.007, WF2.010');
}

// A form has to answer while you are still typing in it. These check the whole
// chain: the field commits on every keystroke, the shell puts focus and the
// caret back after the re-render, and the primary action re-reads its own
// disabled state — none of it waiting for a blur.
const live = [];
// A5 is the whole account on one form: a name, a mobile number, an email
// address and a password — the number because a code goes to it and is checked,
// the address because reports and a web-bought licence need somewhere to land,
// the name and the password because an account is not made without them. The
// primary button has to answer all five conditions as they are typed rather
// than on blur.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A5'); });
await page.waitForTimeout(80);
await page.click('#app input[type="tel"]');
await page.type('#app input[type="tel"]', '512345678', { delay: 5 });
const a5 = await page.evaluate(() => ({
  focused: document.activeElement?.type === 'tel',
  caretAtEnd: document.activeElement.selectionStart === document.activeElement.value.length,
  disabled: document.querySelector('#app .btn--primary')?.disabled,
  asksForEmail: !!document.querySelector('#app input[type="email"]'),
  // Review 06/09 split one name box into two, so both have to be there.
  asksForName: !!document.querySelector('#app [data-field="firstname"]')
    && !!document.querySelector('#app [data-field="lastname"]'),
  // Review 21/09 took the password off this screen, so its absence is now the
  // thing worth asserting: a password field reappearing here is a regression.
  asksForPassword: !!document.querySelector('#app input[type="password"]'),
  // And the two doors have to be reachable without scrolling — that was the
  // actual complaint, not the length of the form.
  doorsInView: (() => {
    const app = document.querySelector('#app');
    const links = [...document.querySelectorAll('#app button.textlink')];
    const join = links.find((l) => /guest/i.test(l.textContent));
    const login = links.find((l) => /^log in$/i.test(l.textContent.trim()));
    if (!app || !join || !login) return false;
    const frame = app.getBoundingClientRect();
    const seen = (el) => {
      const r = el.getBoundingClientRect();
      return r.bottom <= frame.bottom + 1 && r.top >= frame.top - 1 && r.height > 0;
    };
    return seen(join) && seen(login);
  })(),
}));
if (!a5.focused) live.push('A5: typing lost focus');
if (!a5.caretAtEnd) live.push('A5: the caret jumped while typing');
if (!a5.disabled) live.push('A5: the primary action was enabled with only a number typed');
if (!a5.asksForEmail) live.push('A5: no email address is asked for');
if (!a5.asksForName) live.push('A5: a first name and a last name are not both asked for');
if (a5.asksForPassword) live.push('A5: a password field is back on the sign-up form');
if (!a5.doorsInView) live.push('A5: "join a farm as a guest" needs scrolling to reach');

await page.click('#app input[type="email"]');
await page.type('#app input[type="email"]', 'khaled@example.com', { delay: 4 });
await page.waitForTimeout(60);
if (!await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A5: the primary action was enabled with no name, no password and no terms ticked');
}
await page.click('#app [data-field="firstname"]');
await page.type('#app [data-field="firstname"]', 'Khaled', { delay: 4 });
await page.click('#app [data-field="lastname"]');
await page.type('#app [data-field="lastname"]', 'Al-Amri', { delay: 4 });
await page.waitForTimeout(60);
// The password rule went with the password (review 21/09). What is left as the
// last gate is the terms tick, and it still has to be a gate.
if (!await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A5: the primary action was enabled before the terms were ticked');
}
await page.click('#app .check input[type="checkbox"]');
await page.waitForTimeout(60);
if (await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A5: the primary action is still disabled with the whole form answered');
}
// The caret must survive a keystroke made in the MIDDLE of a value.
await page.evaluate(() => { const e = document.querySelector('#app input[type="tel"]'); e.focus(); e.setSelectionRange(3, 3); });
await page.keyboard.type('7');
const mid = await page.evaluate(() => ({ at: document.activeElement.selectionStart, value: document.activeElement.value }));
if (mid.at !== 4 || mid.value !== '5127345678') live.push(`A5: caret moved on a mid-string keystroke (${mid.at}, "${mid.value}")`);

// A6 sends the code to the NUMBER. The address is the account (06/09) and the
// code is not the account (Monday review): four digits have to arrive in
// seconds on a phone in a field, which is an SMS. The screen says where it went
// once, in the app bar, and that sentence is the only heading it has. Four
// cells, not six, and they are inputs the phone's own keyboard can fill — the
// drawn keypad went at the 06/09 review.
await page.evaluate(() => wafra.jump('A6'));
await page.waitForTimeout(60);
const a6 = await page.evaluate(() => ({
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
  body: document.querySelector('#app .page')?.textContent ?? '',
  cells: document.querySelectorAll('#app input.otp__cell').length,
  keypad: document.querySelectorAll('#app .keypad').length,
}));
if (!/\d/.test(a6.bar) || a6.bar.includes('@')) live.push('A6: the code was not addressed to a mobile number');
if (a6.cells !== 4) live.push(`A6: ${a6.cells} typable code cells, expected 4`);
if (a6.keypad) live.push('A6: the drawn keypad is back');

// 13/09 review, second pass — A9 asks its name, unit and two numbers, and
// nothing else. Filling in the area, the tree count, or both IS what used to
// be a picker with a "Both" card; there is no picker left to test for.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A9'); });
await page.waitForTimeout(80);
const a9 = await page.evaluate(() => ({
  asksForName: !!document.querySelector('#app [data-field="farmname"]'),
  asksArea: !!document.querySelector('#app [data-field="rougharea"]'),
  asksTrees: !!document.querySelector('#app [data-field="roughtrees"]'),
  noBoth: !(document.querySelector('#app .page')?.textContent ?? '').includes('Both'),
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!a9.asksForName) live.push('A9: the farm is not named up front');
if (!a9.asksArea) live.push('A9: no field for the approximate crop area');
if (!a9.asksTrees) live.push('A9: no field for the approximate tree count');
if (!a9.noBoth) live.push('A9: a "Both" option is still on the screen');
if (!a9.dock.includes('Continue')) live.push(`A9: no Continue button in the dock ("${a9.dock}")`);

// Continue with nothing filled in must not proceed: nothing is disabled, so
// the screen has to say what is missing rather than sit there.
await page.evaluate(() => document.querySelector('#app .actiondock .btn')?.click());
await page.waitForTimeout(80);
const nagged = await page.evaluate(() => location.hash);
if (nagged.includes('A9E')) live.push('A9: Continue proceeded with no farm name and no numbers at all');

await page.click('#app [data-field="farmname"]');
await page.type('#app [data-field="farmname"]', 'North Block', { delay: 4 });
await page.click('#app [data-field="rougharea"]');
await page.type('#app [data-field="rougharea"]', '12', { delay: 4 });
await page.click('#app [data-field="roughtrees"]');
await page.type('#app [data-field="roughtrees"]', '400', { delay: 4 });
await page.waitForTimeout(60);
await page.evaluate(() => document.querySelector('#app .actiondock .btn')?.click());
await page.waitForTimeout(80);

// A9E — the price estimate. One button, a plain-text caption rather than a
// boxed summary, and an explanation of what the NEXT screen does, all new at
// the 13/09 review. (A9E, not A9D: A9D is A10D's old letter, and A10D's own
// translation keys are still 'a9d.*', so that letter was never actually free
// to reuse.)
const a9e = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app .page')?.textContent ?? '',
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
  cards: document.querySelectorAll('#app .card--tap').length,
}));
if (!a9e.at.includes('A9E')) live.push(`A9: Continue led to ${a9e.at}, expected A9E`);
if (!a9e.body.includes('12.0 ha') && !a9e.body.includes('12 ha')) live.push('A9E: the area typed on A9 is not reflected in the estimate');
if (!a9e.body.includes('400')) live.push('A9E: the tree count typed on A9 is not reflected in the estimate');
/* REBUILT AT REVIEW 21/09 out of A13's layout: the two real plans at their two
   real prices, and NOTHING to choose between them — "remove buttons, not needed
   at this point". The radio is the thing to assert on, because a card that
   merely looks unselected still invites a tap. */
if (a9e.cards !== 0) live.push(`A9E: ${a9e.cards} plan cards offer a selection, expected none`);
if (!a9e.body.includes('final quote')) live.push('A9E: it does not say the survey is what settles the price');
// The four steps, in the reviewer's order — and the fourth is the one that
// matters: choosing a plan comes last, after the survey.
if (!a9e.body.includes('You select the service plan you want')) live.push('A9E: the four next steps are not on the screen');
// "Let's still capture 'not interested / why' … we want some signal if
// conversion isn't happening."
if (!a9e.dock.includes('not interested')) live.push('A9E: there is no way to decline at the price stage');
await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(80);

// A9B is deliberately not on this walk any more — see the note in
// screens/index.js. Every farm goes straight from A9E to A10 now.
const a10start = await page.evaluate(() => location.hash);
if (a10start.includes('A9B')) live.push('A9E: Confirm and continue still opens the removed A9B fork');
if (!a10start.includes('A10') || a10start.includes('A10D') || a10start.includes('A10B') || a10start.includes('A10C')) {
  live.push(`A9E: Confirm and continue led to ${a10start}, expected A10`);
}

/* A10 IS FINDING, AND ONLY FINDING, SINCE REVIEW 21/09. Tapping to pan and
   tapping to drop a corner were the same gesture on one screen, so the screen
   was always in both modes and said it was in neither. The split is what these
   three assertions hold in place: two numbered options, no drawing surface, and
   a button that confirms rather than continues. */
const a10 = await page.evaluate(() => ({
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
  sub: document.querySelector('#app .appbar small')?.textContent ?? '',
  body: document.querySelector('#app')?.textContent ?? '',
  canvas: !!document.querySelector('#app .mapbox svg polygon'),
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!a10.bar.includes('Locate your farm')) live.push(`A10: the bar reads "${a10.bar}", expected "Locate your farm"`);
if (!a10.sub.includes('North Block')) live.push('A10: the bar does not carry the name given on A9');
if (!a10.body.includes('Option 1') || !a10.body.includes('Option 2')) live.push('A10: the two ways of finding a farm are not offered as numbered options');
if (a10.canvas) live.push('A10: there is still a drawing surface on the find-your-farm screen');
if (!a10.dock.includes('Ready to map my farm')) live.push(`A10: the dock reads "${a10.dock}", expected "Ready to map my farm"`);

await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(120);

/* A10C IS DRAWING. The instruction is ON the map at lead size — "text is very
   small and easy to miss, farmer may not know how to proceed" — rather than six
   words in the bar with the rest behind an ⓘ. */
const a10c = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app')?.textContent ?? '',
  canvas: !!document.querySelector('#app .mapbox svg polygon'),
  chip: !!document.querySelector('#app .appbar .iconbtn--bare'),
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!a10c.at.includes('A10C')) live.push(`A10: Ready to map my farm led to ${a10c.at}, expected A10C`);
if (!a10c.canvas) live.push('A10C: there is no drawing surface on the draw-your-boundary screen');
if (!a10c.body.includes('Draw your farm boundary')) live.push('A10C: the instruction is not on the screen');
if (!a10c.body.includes('greenhouses')) live.push('A10C: the instruction does not say what to leave out');
if (a10c.chip) live.push('A10C: the instruction is still hidden behind an ⓘ as well as shown');
if (!a10c.dock.includes('Get quote')) live.push(`A10C: the dock reads "${a10c.dock}", expected "Get quote"`);

/* THE END OF THE SIGN-UP WALK, REWIRED AGAIN AT THE 13/09 REVIEW'S THIRD
   PASS — AND THE ORDER IS THE WHOLE POINT OF IT. It used to be boundary →
   survey → (come back later) → price; it is boundary → price → survey now,
   because nothing expensive should run before somebody has agreed to pay for
   it. So A10C must create NOTHING and request NOTHING, A13 must be what makes
   the farm and asks for the survey, and A10B must be what says so. Each of
   those three can silently stop being true on its own. */
const farmsBeforeSurvey = await page.evaluate(() => wafra.state.db.farms.length);
await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(140);

/* THE ORDER WENT BACK AT REVIEW 21/09, AND THIS IS WHERE IT SHOWS.

   The 13/09 third pass had the price between the boundary and the satellite;
   21/09 puts the satellite first again, in three places at once — the sequence
   Mark wrote on A10, the A10B button he renamed "Go to service plans", and the
   four steps on the new A9E, which say a quote comes third and a plan is chosen
   fourth. So "Get quote" is what makes the farm and asks for the survey, and
   the price screen is on the far side of it. */
const started = await page.evaluate(() => {
  const farm = wafra.state.db.farms.at(-1);
  return {
    at: location.hash,
    body: document.querySelector('#app .page')?.textContent ?? '',
    dock: document.querySelector('#app .actiondock')?.textContent ?? '',
    farms: wafra.state.db.farms.length,
    surveyState: farm?.survey?.state,
    farmId: farm?.id,
  };
});
if (!started.at.includes('A10B')) live.push(`A10C: Get quote led to ${started.at}, expected A10B`);
if (started.farms !== farmsBeforeSurvey + 1) live.push('A10C: Get quote did not create the farm');
if (started.surveyState !== 'surveying') live.push(`A10C: the new farm's survey state is "${started.surveyState}", expected "surveying"`);
if (!started.body.includes('North Block')) live.push('A10B: the screen does not name the farm');
if (!started.body.includes('Survey in progress')) live.push('A10B: the heading does not call it a survey');
/* "Why does it say 'keep the app open to see available service plans'? I don't
   think that's needed." The survey runs on MMC's servers; the app has nothing
   to do while it runs and a push notification is what brings the farmer back. */
if (started.body.includes('keep the app open')) live.push('A10B: it still tells the farmer to keep the app open');
if (!started.body.includes('notify you')) live.push('A10B: it does not say the farmer will be notified');
if (!started.body.includes('minutes')) live.push('A10B: it does not give an estimated time');
if (!started.dock.includes('Go to service plans')) live.push(`A10B: the dock reads "${started.dock}", expected "Go to service plans"`);

/* AND A13 REACHED BEFORE THE ANSWER IS BACK HAS TO SAY SO RATHER THAN INVENT A
   FIGURE — which is Mark's own open question on this screen, answered the way
   he proposed it: "does the app take him to A13 (without cost), and he waits
   until the cost is calculated and is displayed?" */
await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(140);
const waiting = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app .page')?.textContent ?? '',
}));
if (!waiting.at.includes('A13')) live.push(`A10B: Go to service plans led to ${waiting.at}, expected A13`);
if (!waiting.body.includes('survey is still running')) live.push('A13: reached before the survey is back, it does not say so');

// Back into the app the way Home would be reached, so the rest of the walk can
// carry on from a farm that exists.
await page.evaluate(() => { wafra.state.nav.mode = 'app'; wafra.commit('t'); });
await page.waitForTimeout(40);
const mode = await page.evaluate(() => wafra.state.nav.mode);
if (mode !== 'app') live.push('A10B: the account did not open');

// Home's own farm-switcher default (homeRoute) picks the account's FIRST
// farm, which in this shared demo database is a fixture rather than the one
// just created — a fact about the mockup's data, not about this walk. So the
// farm just made is opened by id, the way B2's own farm-switcher would.
await page.evaluate((id) => wafra.jump(`B2:${id}`), started.farmId);
await page.waitForTimeout(80);
const home = await page.evaluate(() => (document.querySelector('#app .page')?.textContent ?? ''));
if (!home.includes('Reading your land')) live.push('B2: a farm whose survey just started does not show the surveying card');

// The mockup's own shortcut past the wait — "we're working on it" is not
// something a reviewer should have to sit through — flips the survey to
// 'ready', and Home's card changes with it.
await page.evaluate(() => [...document.querySelectorAll('#app .btn')].find((b) => b.textContent.includes('See the result now'))?.click());
await page.waitForTimeout(100);
const readyCard = await page.evaluate(() => (document.querySelector('#app .page')?.textContent ?? ''));
if (!readyCard.includes('Your survey is ready')) live.push('B2: marking the survey ready did not update the card');

/* THE SECOND SITTING. With the plan chosen and paid for before the satellite
   was asked for anything, what is new when the answer arrives is the ANSWER —
   so Home's ready card opens A11, the plots that were found, and A13 is one
   step beyond it with the price adjusted to them. */
await page.evaluate(() => document.querySelector('#app .card--tap')?.click());
await page.waitForTimeout(140);
const found = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app .page')?.textContent ?? '',
}));
if (!found.at.includes('A11')) live.push(`B2: the ready card led to ${found.at}, expected A11`);

// A11's confirm hands to the same A13, now doing its other job: the real
// plots, the real price, and a button that agrees to it rather than starting
// anything. Its words changed with the order — the farmer is approving what
// was found, not asking for a quote he was given two screens before the
// satellite ever looked.
// Review C151 put A11's button inside the totals box rather than in a dock,
// so it is read off the page.
if (!found.body.includes('Confirm these plots')) live.push('A11: after a survey its button does not read "Confirm these plots"');
if (found.body.includes('Request quote')) live.push('A11: it still asks for a quote the farmer was given before the survey ran');
await page.evaluate(() => [...document.querySelectorAll('#app .page .btn')].find((b) => b.textContent.includes('Confirm these plots'))?.click());
await page.waitForTimeout(140);
const repriced = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app .page')?.textContent ?? '',
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!repriced.at.includes('A13')) live.push(`A11: Confirm led to ${repriced.at}, expected A13`);
if (!repriced.body.includes('the survey found')) live.push('A13: after the survey it does not say the price comes from what was found');
// Review 21/09 made the button "Start free trial" on both passes of this
// screen. It is the same first subscription either way — what changed between
// the two is the price on it, not whether a trial is starting.
if (!repriced.dock.includes('Start free trial')) live.push(`A13: the dock reads "${repriced.dock}", expected "Start free trial"`);
if (!repriced.body.includes('modify the list of plots')) live.push('A13: no way back to the plot list once one exists');

await page.evaluate(() => document.querySelectorAll('#app .card--tap')[1]?.click());
await page.waitForTimeout(80);
await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(140);
const ready = await page.evaluate(() => {
  const farm = wafra.state.db.farms.find((f) => f.survey);
  return {
    at: location.hash,
    body: document.querySelector('#app .page')?.textContent ?? '',
    dock: document.querySelector('#app .actiondock')?.textContent ?? '',
    surveyState: farm?.survey?.state,
  };
});
if (!ready.at.includes('A14')) live.push(`A13: Start free trial led to ${ready.at}, expected A14`);
if (!ready.body.includes('has been added to your account')) live.push('A14: the confirmation is not in the reviewed words');
if (!ready.dock.includes('Add another farm')) live.push('A14: no second button for another farm');

// The second button starts the next farm's sign-up, without adding a second
// record for the one just finished.
const farmsBefore = await page.evaluate(() => wafra.state.db.farms.length);
await page.evaluate(() => [...document.querySelectorAll('#app .actiondock .btn')].find((b) => b.textContent.includes('Add another farm'))?.click());
await page.waitForTimeout(140);
const again = await page.evaluate(() => ({
  at: location.hash,
  farms: wafra.state.db.farms.length,
  placeholder: document.querySelector('#app [data-field="farmname"]')?.placeholder ?? '',
}));
if (!again.at.includes('A9')) live.push(`A14: Add another farm led to ${again.at}, expected A9`);
if (again.farms !== farmsBefore) live.push('A14: Add another farm changed the farm count, expected no change');
if (!again.placeholder) live.push('A14: the next farm opens with no suggested name');

// A10D — moved to Farm settings' "Add a plot" at the 13/09 review's second
// pass, so this is reached with startDrawPlot() directly rather than through
// the sign-up walk. Its confirm button now reads "Continue to quote", its own
// words rather than A11's borrowed ones.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.startDrawPlot('South Field'); });
await page.waitForTimeout(80);
const a10d = await page.evaluate(() => ({
  at: location.hash,
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!a10d.at.includes('A10D')) live.push(`startDrawPlot(): opened ${a10d.at}, expected A10D`);
if (!a10d.bar.includes('South Field')) live.push('A10D: the bar does not carry the given farm name');
if (!a10d.dock.includes('Continue to quote')) live.push(`A10D: the dock reads "${a10d.dock}", expected "Continue to quote"`);
await page.evaluate(() => [...document.querySelectorAll('#app .actiondock .btn')].find((b) => b.textContent.includes('Continue to quote'))?.click());
await page.waitForTimeout(80);
const drawn = await page.evaluate(() => ({
  at: location.hash,
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
}));
if (!drawn.at.includes('A11')) live.push(`A10D: Continue to quote led to ${drawn.at}, expected A11`);
if (!drawn.bar.includes('South Field')) live.push('A11: the drawn summary is not headed by the farm name');
await page.evaluate(() => { wafra.resetLocal('signup'); });

// The search bar is a text field sitting on top of a map that redraws on every
// keystroke, which is the one place in the app where losing the caret would be
// easy and invisible — the sheet it replaced had no such problem.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A10'); });
await page.waitForTimeout(80);
await page.click('#app [data-field="placesearch"]');
await page.type('#app [data-field="placesearch"]', 'Al Kharj', { delay: 6 });
await page.waitForTimeout(60);
const search = await page.evaluate(() => ({
  field: document.activeElement?.dataset?.field,
  value: document.activeElement?.value,
  caret: document.activeElement?.selectionStart,
}));
if (search.field !== 'placesearch') live.push('A10: the map search lost focus while typing');
if (search.value !== 'Al Kharj') live.push(`A10: the map search lost characters ("${search.value}")`);
if (search.caret !== 8) live.push(`A10: the caret jumped in the map search (${search.caret})`);
await page.evaluate(() => wafra.resetLocal('signup'));

// B6, the last long-form typing screen in the app now that E6 has gone with the
// observation capture. A textarea re-created mid-render loses the caret, and a
// notes field is where that is most expensive.
await page.evaluate(() => { wafra.resetLocal('b6-plot-13-new'); wafra.jump('B6:plot-13'); });
await page.waitForTimeout(80);
await page.click('#app textarea.textarea');
await page.type('#app textarea.textarea', 'Sown after the barley', { delay: 5 });
const b6 = await page.evaluate(() => ({
  focused: document.activeElement?.tagName === 'TEXTAREA',
  note: document.activeElement?.value,
}));
if (!b6.focused || b6.note !== 'Sown after the barley') live.push(`B6: the notes field lost focus or characters ("${b6.note}")`);

/* -- the 13/09 catalogue round --------------------------------------------

   Eleven features that were missing and seven that were half-built. Each of
   the checks below is the one thing about its feature that can silently stop
   being true: a number that stops reaching the screen, a cross-link that stops
   resolving, a layer that stops painting. They are deliberately about CONTENT
   rather than layout — the screens are already rendered and audited above; what
   these ask is whether the figures are actually there. */

const textAt = async (route) => {
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(140);
  return page.evaluate(() => document.querySelector('#app')?.innerText ?? '');
};

// 501 / 407 — the stage, the verdict and the heat behind it, on a plot whose
// crop is mid-season rather than finished.
const b4 = await textAt('B4:plot-15');
/* Review 21/09 moved these two titles INSIDE their cards — "it's not clear the
   two are linked; make it one combined box" — so they are no longer section
   rules in small caps. Matched case-insensitively, and the case itself is
   asserted below, because a title that drifts back out to a section head is
   exactly the regression this note is about. */
if (!/growth stage/i.test(b4)) live.push('B4: the growth stage block is not on the plot screen');
if (b4.includes('GROWTH STAGE')) live.push('B4: growth stage is a section rule again, not a title inside its card');
if (!/growing degree days/.test(b4)) live.push('B4: the growth stage block does not print the heat it is worked out from');
if (!/(ahead|behind|On track)/.test(b4)) live.push('B4: the growth stage block gives no verdict against the expected pace');
// 702 — risk, per crop, with a window on it.
if (!/disease and pest risk/i.test(b4)) live.push('B4: the disease risk strip is missing');
if (b4.includes('DISEASE AND PEST RISK')) live.push('B4: disease risk is a section rule again, not a title inside its card');
// The trend and the score are one box now, and the axis is the crop cycle.
if (!/wk 1/i.test(b4)) live.push('B4: the trend axis is not in weeks of the crop cycle');
if (/\bMar\b.*\bAug\b/.test(b4)) live.push('B4: the trend axis is still six fixed month names');
if (!/target/i.test(b4)) live.push('B4: the trend chart has no target reference line');
if (b4.includes('TREND')) live.push('B4: the trend is a section of its own again, not merged with the health score');
// "'Advices' should be singular — 'Advice' — and probably lowercase."
if (b4.includes('Advices')) live.push('B4: the advice button is still plural');
if (!/advice for this plot/i.test(b4)) live.push('B4: the advice list is still called recent suggestions');
if (!/peaks in/.test(b4)) live.push('B4: a disease risk is shown with no window to act in');
if (/Red palm weevil/.test(b4)) live.push('B4: a wheat plot is being warned about a date palm pest');

// 407 / 801 — the same heat on the season bar, and the forecast as a band.
const b5 = await textAt('B5:plot-15');
if (!/growing degree days/.test(b5)) live.push('B5: the season bar carries no heat accumulation beside its days');
if (!b5.includes('Harvest forecast')) live.push('B5: there is no yield forecast');
if (!/\d+(\.\d+)?–\d+(\.\d+)?\s*t\/ha/.test(b5)) live.push('B5: the yield forecast is not a range');

// 406 / 602 — the sum behind the volume, and the feed that goes in with it.
const d2 = await textAt('D2:adv-01');
if (!d2.includes('Why this much water')) live.push('D2: evapotranspiration is not shown behind the volume');
if (!/Reference ET[\s\S]*Crop coefficient[\s\S]*Crop use today/.test(d2)) live.push('D2: the ET sum is not written out as reference × coefficient = use');
if (!d2.includes('Feed with this water')) live.push('D2: a drip-irrigated plot is given no fertigation plan');

/* 701 — THE WAY IN, AND WHERE IT MUST NOT BE.

   The photo check spent one round at the top of the advice inbox and the
   review sent it to the More menu: D1 is a worklist — everything on it arrived
   from the model, is screened by four filters and is cleared as it is dealt
   with — and a button that starts something new pushed the grouping and the
   sort control below the fold on the screen the farmer opens most.

   Both halves are asserted, because the second is the one that will be
   forgotten: the row has to be in More, and the inbox has to stay as it was. */
const f0 = await textAt('F0');
if (!f0.includes('Check a photo')) live.push('F0: there is no way into the photo check');
const d1 = await textAt('D1');
if (/RAISED BY THE FORECAST/.test(d1)) live.push('D1: the inbox has grown back a section that was moved off it');
// The four screening axes and the sort are what the inbox is for; they are
// what an addition to this screen pushes out of reach.
for (const control of ['Farm', 'Severity', 'Type', 'Status']) {
  if (!d1.includes(control)) live.push(`D1: the ${control.toLowerCase()} filter is missing`);
}
// The photo check is IN THE BAR on this screen, labelled — an icon on its own
// was the thing the review would not take.
if (!d1.includes('Photo check')) live.push('D1: the photo check is not in the app bar, or has lost its label');

/* FOUR PILLS ON ONE LINE, THE STATE UNDER THEM, AND THE PHOTO BUTTON IN THE
   CORNER.

   The pills carry a word each and no value, so unlike the drop-downs they
   replaced they cannot truncate an answer — what they can do is wrap onto two
   rows, which is a whole row of a sticky header on the screen the farmer opens
   most. Both ends of the range are measured: 390 dp is what the deck prints,
   and 360 is WF2.002's acceptance size — "every screen must work here".

   The rest is what the shape promises and what would quietly rot:
     - the fill IS the state, so all four are on when all four are narrowed;
     - the line under them names every choice, in full — it is the only place
       on the screen wide enough for a farm's real name, which is the whole
       reason the pills are allowed to be wordless;
     - the line and its Clear are NOT there when nothing is narrowed;
     - Clear clears the farm too, which is the one a reset forgets. */
const farmForFilter = await page.evaluate(() => wafra.state.db.farms[0].id);
const farmName = await page.evaluate(() => wafra.state.db.farms[0].name);
const measureScreener = () => page.evaluate(() => {
  const app = document.querySelector('#app');
  const pills = [...document.querySelectorAll('#app .screener__pill')];
  const bar = document.querySelector('#app .appbar');
  const photo = document.querySelector('#app .appbar .chip--action');
  const barBox = bar?.getBoundingClientRect();
  const photoBox = photo?.getBoundingClientRect();
  const state = document.querySelector('#app .screener__state');
  const chosen = document.querySelector('#app .screener__chosen');
  const band = document.querySelector('#app .screener');
  const bandStyle = band ? getComputedStyle(band) : null;
  return {
    count: pills.length,
    words: pills.map((el) => el.querySelector('span').textContent),
    rows: new Set(pills.map((el) => Math.round(el.getBoundingClientRect().top))).size,
    on: pills.filter((el) => el.classList.contains('is-on')).length,
    // offsetHeight rather than the client rect: the harness draws the phone at
    // a scale, and a 38 dp control measures 30 through a 0.79 zoom.
    shortest: Math.min(...pills.map((el) => el.offsetHeight)),
    clipped: pills
      .map((el) => {
        const w = el.querySelector('span');
        return w.scrollWidth > w.clientWidth + 1 ? w.textContent : null;
      })
      .filter(Boolean),
    // The page edge, and what the bar and the filter row actually sit at.
    gutter: parseFloat(getComputedStyle(app).getPropertyValue('--gutter')) || 0,
    barInset: bar ? Math.round(parseFloat(getComputedStyle(bar).paddingInlineStart)) : 0,
    pillsInset: bandStyle ? Math.round(parseFloat(bandStyle.paddingInlineStart)) : 0,
    // The air inside a pill, which is what "cramped" meant: half of what is
    // left of the box once the word and the icon have taken theirs.
    pillPad: (() => {
      const el = pills[0];
      if (!el) return 0;
      return Math.round((el.clientWidth - el.querySelector('span').scrollWidth - 15 - 4) / 2);
    })(),
    hasState: !!state,
    stateText: chosen?.textContent ?? '',
    // It wraps instead of truncating, so the failure to look for is hidden
    // overflow, plus a line count that has got out of hand.
    stateClipped: chosen ? chosen.scrollHeight > chosen.clientHeight + 1 : false,
    stateLines: chosen ? Math.round(chosen.scrollHeight / parseFloat(getComputedStyle(chosen).lineHeight)) : 0,
    hasClear: !!document.querySelector('#app .screener__clear'),
    // Top right corner: last in the bar, and hard against its end.
    photoIsLast: !!photo && bar?.lastElementChild === photo,
    photoGap: photoBox ? Math.round(barBox.right - photoBox.right) : null,
    overflow: app.scrollWidth - app.clientWidth,
  };
});

for (const dev of ['android-min', 'iphone-14']) {
  await page.evaluate(([devId, farmId]) => {
    wafra.state.device.presetId = devId;
    wafra.state.ui.farmFilter = farmId;
    wafra.state.session.adviceFilters.severity = 'monitor';
    wafra.state.session.adviceFilters.type = 'protection';
    wafra.state.session.adviceFilters.status = 'completed';
    wafra.jump('D1');
    wafra.commit('t');
  }, [dev, farmForFilter]);
  await page.waitForTimeout(160);
  const screener = await measureScreener();
  const at = `D1 at ${dev}`;
  if (screener.count !== 4) live.push(`${at}: ${screener.count} filter pills, expected 4`);
  if (screener.rows !== 1) live.push(`${at}: the filters wrap onto ${screener.rows} rows, expected one line`);
  if (screener.on !== 4) live.push(`${at}: ${screener.on} of 4 narrowed filters are filled in`);
  if (screener.shortest < 36) live.push(`${at}: a filter pill is ${screener.shortest}px tall, under the 36dp target`);
  if (screener.clipped.length) live.push(`${at}: a filter pill clips its word — ${screener.clipped.join(', ')}`);
  /* THE BAR AND THE PAGE SHARE ONE EDGE. The large title stands on the page
     rather than on a slab over it, which only reads as generous if everything
     that touches the edge stands on the same line — the title, the pills, the
     cards. --gutter is that line, and this is the check that nothing has been
     left behind on the old 16. */
  if (Math.abs(screener.barInset - screener.gutter) > 1) live.push(`${at}: the app bar is inset ${screener.barInset}px against a ${screener.gutter}px page`);
  if (Math.abs(screener.pillsInset - screener.gutter) > 1) live.push(`${at}: the filter row is inset ${screener.pillsInset}px against a ${screener.gutter}px page`);
  // 6 dp is the floor the 360 dp phone can afford once the gutter has taken
  // its 22; flex-grow spends a wider screen's slack inside the pills, which is
  // what the 15/09 round asked for. Under the floor means something has taken
  // the row's width away.
  if (screener.pillPad < 6) live.push(`${at}: a filter pill carries only ${screener.pillPad}px each side of its word`);
  if (dev === 'iphone-14' && screener.pillPad < 10) live.push(`${at}: a filter pill carries only ${screener.pillPad}px each side of its word`);
  if (!screener.hasState) live.push(`${at}: nothing says what the four filters are set to`);
  if (!screener.hasClear) live.push(`${at}: a narrowed list offers no way to clear the filters`);
  for (const word of [farmName, 'Monitor', 'Crop protection', 'Completed']) {
    if (!screener.stateText.includes(word)) live.push(`${at}: the filter line does not name "${word}" — it reads "${screener.stateText}"`);
  }
  if (screener.stateClipped) live.push(`${at}: the filter line truncates — "${screener.stateText}"`);
  if (screener.stateLines > 2) live.push(`${at}: the filter line runs to ${screener.stateLines} lines`);
  if (!screener.photoIsLast) live.push(`${at}: the photo check is not the last thing in the app bar`);
  // In the corner means on the page's edge now, not on the phone's: the bar
  // takes --gutter like everything else, so the chip ends where a card does.
  if (screener.photoGap === null || Math.abs(screener.photoGap - screener.gutter) > 2) live.push(`${at}: the photo check ends ${screener.photoGap}px from the bar's edge, not on the page's ${screener.gutter}px line`);
  if (screener.overflow > 0) live.push(`${at}: the screen scrolls sideways by ${screener.overflow}px`);
}
await page.evaluate(() => { wafra.state.device.presetId = 'iphone-14'; wafra.commit('t'); });

// Clear puts all four back, the farm included, and takes the line with it.
await page.evaluate(() => { document.querySelector('#app .screener__clear').click(); });
await page.waitForTimeout(160);
const cleared = await measureScreener();
if (cleared.on !== 0) live.push(`D1: Clear left ${cleared.on} filters on`);
if (await page.evaluate(() => wafra.state.ui.farmFilter) !== 'all') live.push('D1: Clear left the farm filter set — the one a reset forgets');
if (cleared.hasState) live.push('D1: the filter line is still there with nothing narrowed');

/* AND THE OPTIONS ARE IN A SHEET, with the full name of each kind in it. This
   is the trade the toggles make — "Protection" on an 85 dp control, "Crop
   protection" in the list — and it only holds if the sheet really opens. */
const filterSheet = await page.evaluate(() => {
  wafra.openSheet('ADVICE_FILTER', { axis: 'type' });
  wafra.commit('t');
  return document.querySelector('.sheet')?.innerText ?? '';
});
if (!filterSheet.includes('Crop protection')) live.push('D1: the type sheet does not offer the full name of each kind');
if (!/Irrigation[\s\S]*Fertilisation/.test(filterSheet)) live.push('D1: the type sheet is missing an option');
await page.evaluate(() => { wafra.closeOverlay(); wafra.commit('t'); });

/* THE DECK'S ANNOTATION BOX FOR D1 IS GONE — review 16/09, see REVIEW_NOTES in
   app/screens/index.js. The check that used to live here held the box's wording
   against the screen's, after one of them drifted into calling Status
   "Progress"; there is no second wording to drift now, so the check went with
   the box rather than being left to pass on an empty string. */

// 701 — capture, then result, then the entry it hands on to.
const d5 = await textAt('D5');
if (!d5.includes('Fill the frame')) live.push('D5: the capture screen gives no framing guidance');
const d5r = await textAt('D5R:leaf');
if (!/% match/.test(d5r)) live.push('D5R: the result does not say how sure it is');
if (!/it could also be/i.test(d5r)) live.push('D5R: the result offers no second candidate');

// 703 / 505 — the two directories, and the cross-link that is the reason they
// shipped together.
const f17d = await textAt('F17D:red-palm-weevil');
if (!f17d.includes('Pre-harvest interval')) live.push('F17D: a disease entry does not carry its pre-harvest interval');
if (!/Date Palm/i.test(f17d)) live.push('F17D: a disease entry does not name the crops it affects');
const f16d = await textAt('F16D:date-palm');
if (!/Red palm weevil/.test(f16d)) live.push('F16D: a crop page does not link to the problems that name it');

// 504 / 902 — the two farm-level views.
const b15 = await textAt('B15:farm-3');
if (!/Plot 1/.test(b15)) live.push('B15: the planner lists no plots');
const b16 = await textAt('B16:farm-3');
if (!/twelve months/i.test(b16)) live.push('B16: the progress screen does not say what period it covers');
if (!/average across plots/i.test(b16)) live.push('B16: the progress screen does not qualify its farm average');

// 604 / 802 — the fifth measure, which is the whole of that feature's plumbing.
const c2 = await textAt('C2');
if (!c2.includes('Soil moisture')) live.push('C2: soil moisture is not in the monitoring layer list');
if (!c2.includes('Irrigation efficiency')) live.push('C2: the irrigation efficiency layer is not offered');

// 606 / 803 — the two reports that carry real content rather than a skeleton.
await page.evaluate(() => wafra.jump('F1:farm-3'));
await page.waitForTimeout(140);
const reports = await page.evaluate(() => {
  // The overlay shape is the router's own: kind, view, params.
  wafra.state.ui.overlay = { kind: 'sheet', view: 'REPORT', params: { reportId: 'irrigation', custom: true } };
  wafra.commit('t');
  return { list: document.querySelector('#app')?.innerText ?? '' };
});
if (!reports.list.includes('Soil nutrient status')) live.push('F1: the soil nutrient report is not offered');
await page.waitForTimeout(120);
const irrigationReport = await page.evaluate(() => document.querySelector('.overlay')?.textContent ?? '');
if (!irrigationReport.includes('advised against applied')) live.push('F1: the irrigation report is still a placeholder');
await page.evaluate(() => { wafra.state.ui.overlay = null; wafra.commit('t'); });

// 406 — the farm's own week of demand.
const f15 = await textAt('F15:farm-1');
if (!/WATER DEMAND THIS WEEK/i.test(f15)) live.push('F15: the week of evapotranspiration is missing');

// The comparison table must not sell what the app cannot do (13/09 flags).
const f6 = await textAt('F6');
if (/Scouting/i.test(f6)) live.push('F6: the comparison table still lists scouting, which was deferred');

if (live.length) { console.log(`\n${live.length} live-validation findings:`); for (const l of live) console.log('  ' + l); }
else console.log('forms answer while you type: focus, caret and button state all live');
problems.push(...live);

// The contact sheet renders every screen at once into a live app, which is the
// one place a render-time side effect would do real damage. Check that it draws
// them all, in English, and hands the session back exactly as it found it.
await page.evaluate(() => { wafra.jump('D1'); wafra.setLanguage('ar'); });
await page.waitForTimeout(60);
const seenBefore = await page.evaluate(() => wafra.state.db.seenAdvice.size);
await page.click('#harness-main .hb__cta');
await page.evaluate(async () => {
  const el = document.getElementById('screen-grid');
  for (let y = 0; y <= el.scrollHeight; y += 400) {
    el.scrollTop = y;
    await new Promise((r) => setTimeout(r, 60));
  }
});
await page.waitForTimeout(300);
const sheet = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.sgrid__cell')];
  return {
    total: cells.length,
    empty: cells.filter((c) => c.querySelector('.app').childElementCount === 0).map((c) => c.dataset.screen),
    english: !cells.some((c) => c.querySelector('.app').dir === 'rtl'),
    lang: wafra.state.session.lang,
    preview: wafra.state.ui.preview,
    seen: wafra.state.db.seenAdvice.size,
  };
});
/* One tile per FILING, not per screen. A3 is in First run and in Log in, and it
   is meant to be: it is the last screen of the registration walk for somebody
   who already has an account and the first screen of the way back in. So the
   count to check against is the number of entries in SCREEN_GROUPS, and what
   would be a real failure is a screen that is registered and filed nowhere. */
const filed = await page.evaluate(async () => {
  const { SCREEN_GROUPS } = await import('/app/screens/index.js');
  const ids = SCREEN_GROUPS.flatMap((g) => g.ids).filter((id) => wafra.SCREENS[id]);
  return { tiles: ids.length, missing: Object.keys(wafra.SCREENS).filter((id) => !ids.includes(id)) };
});
if (sheet.total !== filed.tiles) problems.push(`screen grid: ${sheet.total} tiles for ${filed.tiles} filed screens`);
if (filed.missing.length) problems.push(`screen grid: registered but in no section — ${filed.missing.join(', ')}`);
if (sheet.empty.length) problems.push(`screen grid: empty tiles — ${sheet.empty.join(', ')}`);
if (!sheet.english) problems.push('screen grid: a tile rendered right-to-left; it is meant to force English');
if (sheet.lang !== 'ar') problems.push(`screen grid: left the session in "${sheet.lang}" instead of putting Arabic back`);
if (sheet.preview) problems.push('screen grid: left state.ui.preview raised');
if (sheet.seen !== seenBefore) problems.push('screen grid: drawing advice cards marked them as read');
console.log(`screen grid: ${sheet.total} tiles, no side effects`);

// The sheet is a place you can send someone, so the link has to survive a load.
const urlOnOpen = await page.evaluate(() => location.hash);
if (!/^#\/screens\/z\d+$/.test(urlOnOpen)) problems.push(`screen grid: opened without a shareable hash (${urlOnOpen})`);
await page.evaluate(() => { document.querySelector('.sgrid__close').click(); wafra.setLanguage('en'); });
await page.goto(`${base}#/screens/z70`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!globalThis.wafra);
await page.waitForTimeout(400);
const shared = await page.evaluate(() => ({
  open: !document.getElementById('screen-grid').hidden,
  hash: location.hash,
  zoom: document.querySelector('.sgrid__pct')?.textContent,
}));
if (!shared.open) problems.push('screen grid: a shared #/screens link did not open the sheet');
if (shared.zoom !== '70%') problems.push(`screen grid: shared link lost its zoom (${shared.zoom})`);
if (shared.hash !== '#/screens/z70') problems.push(`screen grid: shared link rewrote its own hash (${shared.hash})`);
console.log(`screen grid: shareable at ${shared.hash}, reopened at ${shared.zoom}`);
await page.evaluate(() => { document.querySelector('.sgrid__close').click(); });

// Walk every screen once more with the catalogue collecting, then dump it.
// A screen with more than one state has to be walked in each of them, or the
// strings only one of them uses never reach the translators — FORGOT is three
// steps behind one id, and its "choose a new password" step is the last of them.
const EXTRA_STATES = ['FORGOT:password', 'A6:login', 'A6:reset'];
for (const s of screens) {
  await page.evaluate((route) => wafra.jump(route), s.route);
  await page.waitForTimeout(10);
}
for (const route of EXTRA_STATES) {
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(10);
}
const catalogue = await page.evaluate(() => Object.fromEntries(wafra.catalogue()));

// One key, two English strings. The catalogue keeps whichever rendered first,
// so the second screen shows a wording no translator was ever given — and the
// dump looks perfectly healthy either way. This is the only place it can be
// seen, because it takes a run that has drawn every screen to find it.
//
// The check arrived with the 22/08 review, which turned one of these up the
// hard way: deleting A11's toolbar handed `a11.join` to the shape menu, and
// three catalogue entries quietly changed their wording. Nineteen more were
// already there. They are listed rather than fixed because each is a copy
// decision on a screen this review did not touch, and a rename is a
// translation change in four languages — they are worth a round of their own.
// Anything NOT on this list fails the run.
// `advice.type.nutrition` and `advice.type.protection` came off this list on
// 15/09, with `b10.water`. The D1 filter menu had been offering a short
// "Fertiliser" and "Protection" against the cards' long names; the menus are
// gone, the abbreviations went with them, and every site that names a kind of
// advice now reads ADVICE_TYPE_LABEL through adviceTypeLabel().
const KNOWN_KEY_COLLISIONS = new Set([
  'action.save', 'b11.title',
  'c1.search', 'landuse.crops', 'landuse.trees', 'unit.ha',
]);
// A farm's headline and blocked-imagery reason are content keys per farm id
// (localise.js), and unlike a farm's NAME they are not meant to hold one
// string for the farm's whole life — addFarm(), markSurveyReady() and
// confirmSurvey() each set a different one as the farm moves through its
// survey. The live-validation walk above is the first run of this test to
// carry one farm through all three states in a single page session, which is
// what a real farm does too; it is a fact about the field, not a copy
// mistake, so it is exempted by shape rather than by one farm id, which
// `uuid()`'s counter does not hold stable between runs anyway.
const DYNAMIC_KEY_COLLISION = /^c\.farm\.[^.]+\.(headline|blocked)$/;
const collisions = await page.evaluate(() => wafra.keyCollisions());
for (const { key, english } of collisions) {
  if (KNOWN_KEY_COLLISIONS.has(key) || DYNAMIC_KEY_COLLISION.test(key)) continue;
  problems.push(`translation key "${key}" is offered as ${english.map((e) => JSON.stringify(e)).join(' and ')}`);
}
const stale = [...KNOWN_KEY_COLLISIONS].filter((k) => !collisions.some((c) => c.key === k));
if (stale.length) problems.push(`fixed key collisions still listed as known: ${stale.join(', ')}`);
console.log(`${collisions.length} translation keys carry more than one English string (${KNOWN_KEY_COLLISIONS.size} known)`);

if (dumpAt) {
  await writeFile(dumpAt, JSON.stringify(catalogue, null, 1));
  console.log(`catalogue: ${Object.keys(catalogue).length} keys → ${dumpAt}`);
}

await browser.close();
server.close();

console.log(`checked ${checked} renders across ${roles.length} roles`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems.slice(0, 60)) console.log('  ' + p);
  process.exit(1);
}
console.log('no console errors, no empty renders');
