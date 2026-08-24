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
const overlayIds = ['UPGRADE', 'CONFIRM', 'NEEDS_CONNECTION', 'C3', 'MEASURE_PICKER', 'MEASURE_INFO',
  'FARM_PICKER', 'FARM_SWITCH', 'PLOT_PICKER', 'JOIN_PLOT_PICKER', 'CROP_PICKER',
  'LANG_PICKER', 'MAP_SEARCH', 'TREE_FINDER', 'PLOT_SHAPE_MENU', 'AREA_EDIT', 'AREA_TOOL',
  'PLOT_EDIT', 'BIOMETRIC', 'LOCATION_BLOCKED',
  'PLOT_MENU', 'TREE_MENU', 'ADVICE_MENU', 'SHOW_WHERE', 'HELP_NOTE',
  'ASSUMPTIONS', 'ADVISORY_LOG', 'DELETE_PLOT', 'DELETE_FARM', 'DELETE_ACCOUNT', 'CLOSE_CYCLE',
  'SEARCH', 'NOTIFICATIONS', 'REPORT', 'PLAN_CHOOSER', 'CONTACT_PREVIEW',
  'CONTACT', 'LEGAL'];

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
  ...entities.farms.flatMap((id) => [`B2:${id}`, `B11:${id}`, `D6:${id}`, `F1:${id}`, `F15:${id}`, `A11:${id}`, `A13:${id}`]),
  ...entities.areas.map((a) => `C5:area=${a}`),
  // A tree group has no crop cycle and no plot detail of its own — B4 hands it
  // to B13 — so the cycle screens are walked over the crop plots only.
  ...entities.plots.map((id) => `B4:${id}`),
  ...entities.cropPlots.flatMap((id) => [`B5:${id}`, `B6:${id}`, `C5:${id}`]),
  ...entities.treeGroups.map((id) => `B13:${id}`),
  ...entities.trees.map((id) => `B10:${id}`),
  ...entities.advice.map((a) => `${({ irrigation: 'D2', nutrition: 'D3', protection: 'D4', weather: 'D6' })[a.type]}:${a.id}`),
  ...entities.advice.map((a) => `D7:${a.id}`),
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
  for (const route of ['B2:farm-1', 'C1', 'C5:plot-23', 'D7:adv-01', 'B6:plot-13', 'F10']) {
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
for (const route of ['B2:farm-1', 'B2:farm-3', 'C2', 'D1', 'F5', 'B12']) {
  const before = problems.length;
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(10);
  if (problems.length > before) problems.push(`  ↳ ${route} in demo mode`);
  checked += 1;
}
await page.evaluate(() => { wafra.state.session.demo = false; wafra.commit('t'); });

// §5.6 is now one sentence: every farm has exactly one supervisor, and that is
// who work goes to. It replaced a worker directory, and the thing that breaks
// silently is a farm with nobody attached — the send button simply stops being
// drawn, on every card, with no error anywhere.
{
  const before = problems.length;
  const sup = await page.evaluate(() => {
    const farms = wafra.state.db.farms.map((f) => f.id);
    return {
      missing: farms.filter((id) => !wafra.sel.supervisorOf(id)),
      // Two roles, and the matrix has to agree.
      roles: [...new Set(wafra.state.db.team.map((m) => m.role))].sort(),
      // Only the owner may send work; a supervisor cannot send it to himself.
      ownerSends: wafra.can('advice.send', null, 'owner'),
      supSends: wafra.can('advice.send', null, 'supervisor'),
    };
  });
  if (sup.missing.length) problems.push(`farms with no supervisor to send work to: ${sup.missing.join(', ')}`);
  if (sup.roles.join(',') !== 'owner,supervisor') problems.push(`roles in the fixtures are ${sup.roles.join(', ')}, expected owner and supervisor`);
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

// A12 STOPPED ASKING. The crops-trees-both question moved to A9, before the
// fork, because the answer decides whether there is a fork at all — so a
// farmer reaching A12 has already answered it and this screen explains what he
// has set in motion instead. What is worth checking is that it no longer offers
// the choice, that it still says the combined service applies to a mixed farm
// (WF4.108), and that it still asks for the quote.
{
  const before = problems.length;
  const seen = await page.evaluate(() => {
    const out = {};
    for (const type of ['crops', 'trees', 'mixed']) {
      wafra.resetLocal('signup');
      wafra.state.session.coverage = type;
      wafra.jump('A12');
      const draft = wafra.state.db.farms[0];        // unused; keeps the shape clear
      const page_ = document.querySelector('.page');
      out[type] = (page_?.textContent ?? '').includes('combined service');
      out.pressable = document.querySelectorAll('.page .card button.row').length;
      out.dock = document.querySelector('.actiondock')?.textContent ?? '';
    }
    return out;
  });
  if (seen.pressable) problems.push(`A12 still offers ${seen.pressable} choices — the question moved to A9`);
  if (!seen.dock.includes('Request a quote')) problems.push(`A12's dock reads "${seen.dock}", expected the quote`);
  if (problems.length > before) problems.push('  ↳ while checking A12');
  checked += 1;
}
await page.evaluate(() => wafra.resetLocal('signup'));

// An advice card carries Send and Ignore before it goes out, and Record what
// was done and Take it back after. Never "Mark as complete", on any advice
// surface, ever: closing an advice is a statement about what happened in the
// field, and it goes through D7 so somebody has to say what was actually
// applied. Getting this wrong is silent — the card still renders.
{
  const before = problems.length;
  const seen = await page.evaluate(() => {
    Object.assign(wafra.state.ui, {
      adviceTab: 'all', farmFilter: 'all', adviceTypeFilter: 'all', adviceStateFilter: 'all',
    });
    wafra.state.session.role = 'owner';
    wafra.jump('D1');
    const open = wafra.sel.adviceFor({ status: 'open' });
    const labels = [...document.querySelectorAll('.page .btn')].map((b) => b.textContent.trim());
    return {
      wantSent: open.filter((a) => wafra.sel.isSent(a)).length,
      wantUnsent: open.filter((a) => !wafra.sel.isSent(a)).length,
      complete: labels.filter((l) => l === 'Mark as complete').length,
      assign: labels.filter((l) => l === 'Assign').length,
      record: labels.filter((l) => l === 'Record what was done').length,
      send: labels.filter((l) => l.startsWith('Send to ')).length,
    };
  });
  if (!seen.wantSent || !seen.wantUnsent) problems.push('D1 fixtures no longer show both advice states');
  if (seen.complete) problems.push(`D1: ${seen.complete} "Mark as complete" buttons on advice cards, expected none`);
  if (seen.assign) problems.push(`D1: ${seen.assign} "Assign" buttons — assignment was deleted with tasks`);
  if (seen.record !== seen.wantSent) problems.push(`D1: ${seen.record} "Record what was done" buttons, expected ${seen.wantSent}`);
  if (seen.send !== seen.wantUnsent) problems.push(`D1: ${seen.send} "Send to …" buttons, expected ${seen.wantUnsent}`);
  if (problems.length > before) problems.push('  ↳ while checking the advice card face');
  checked += 1;
}
await page.evaluate(() => { wafra.state.ui.adviceTab = 'needs'; });

// WF4.030 — the tour runs once, on first launch, and Help is the only way back
// to it afterwards. The two entrances differ in exactly one way: where the last
// card leads. Both are checked, because a tour opened from Help that ends by
// sending the farmer to the front door is the failure worth catching.
{
  const before = problems.length;
  const ends = await page.evaluate(async () => {
    const read = () => document.querySelector('.actiondock button')?.textContent?.trim();
    const runToEnd = (route) => {
      wafra.resetLocal('signup');
      wafra.jump(route);
      for (let i = 0; i < 6; i += 1) {
        const label = read();
        if (label !== 'Next') return label;
        document.querySelector('.actiondock button').click();
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
  if (found.primaries > 1) audit.push(`WF2.010 ${s.id}: ${found.primaries} primary actions`);
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
  asksForName: !!document.querySelector('#app [data-field="name"]'),
  asksForPassword: !!document.querySelector('#app input[type="password"]'),
}));
if (!a5.focused) live.push('A5: typing lost focus');
if (!a5.caretAtEnd) live.push('A5: the caret jumped while typing');
if (!a5.disabled) live.push('A5: the primary action was enabled with only a number typed');
if (!a5.asksForEmail) live.push('A5: no email address is asked for');
if (!a5.asksForName) live.push('A5: no name is asked for');
if (!a5.asksForPassword) live.push('A5: no password is asked for');

await page.click('#app input[type="email"]');
await page.type('#app input[type="email"]', 'khaled@example.com', { delay: 4 });
await page.waitForTimeout(60);
if (!await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A5: the primary action was enabled with no name, no password and no terms ticked');
}
await page.click('#app [data-field="name"]');
await page.type('#app [data-field="name"]', 'Khaled', { delay: 4 });
await page.click('#app input[type="password"]');
// Review 22/08 — eight characters is no longer the whole rule: a letter, a
// number and a symbol as well. A password that meets the length and nothing
// else must still leave the button disabled.
await page.type('#app input[type="password"]', 'letmein123', { delay: 4 });
await page.waitForTimeout(60);
if (!await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A5: the primary action was enabled with a password that has no symbol in it');
}
await page.type('#app input[type="password"]', '!', { delay: 4 });
await page.waitForTimeout(60);
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

// A6 sends the code to the NUMBER, always — the address is never verified, so
// it is never a route in. It says so once, in the app bar, and the sentence is
// the only heading the screen has. Four cells, not six.
await page.evaluate(() => wafra.jump('A6'));
await page.waitForTimeout(60);
const a6 = await page.evaluate(() => ({
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
  body: document.querySelector('#app .page')?.textContent ?? '',
  cells: document.querySelectorAll('#app .otp__cell').length,
}));
if (!a6.bar.includes('5127345678')) live.push('A6: the code was not addressed to the mobile number');
if (a6.cells !== 4) live.push(`A6: ${a6.cells} code cells, expected 4`);
if (`${a6.bar}${a6.body}`.includes('khaled@example.com')) live.push('A6: the code was addressed to an unverified email address');

// Review 21/08 and the v1.5.4 round — the ORDER of the middle of registration.
// A farm is named AND its crop or trees declared before either route can be
// chosen; each route leads straight to its own drawing screen; and the coverage
// question on A12 is now a confirmation of what A9 already asked.
//
// The type question is the new gate, and it is the one that decides whether
// there is a fork at all: a farm of trees gets the survey and nothing else,
// because trees cannot be traced by hand.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A9'); });
await page.waitForTimeout(80);
const a9 = await page.evaluate(() => ({
  asksForName: !!document.querySelector('#app [data-field="farmname"]'),
  asksType: (document.querySelector('#app .page')?.textContent ?? '').includes('What is growing on this land'),
  // Nothing is offered until the type is answered, which is the v1.5.4 second
  // round: the fork exists for field crops and for nobody else.
  routes: document.querySelectorAll('#app .card--tap').length,
}));
if (!a9.asksForName) live.push('A9: the farm is not named before the fork');
if (!a9.asksType) live.push('A9: it does not ask what is growing before the fork');
if (a9.routes !== 0) live.push(`A9: ${a9.routes} routes offered before the type was answered, expected none`);

await page.click('#app [data-field="farmname"]');
await page.type('#app [data-field="farmname"]', 'North Block', { delay: 4 });
await page.waitForTimeout(60);

// Trees first, to prove the fork stays shut and says why.
await page.evaluate(() => {
  [...document.querySelectorAll('#app .card .row')]
    .find((r) => r.textContent.includes('Date palms and fruit trees'))?.click();
});
await page.waitForTimeout(60);
const forked = await page.evaluate(() => ({
  routes: document.querySelectorAll('#app .card--tap').length,
  saysWhy: document.querySelector('#app .page').textContent.includes('counted one by one'),
  hasButton: !!document.querySelector('#app .actiondock, #app .btn--primary'),
}));
if (forked.routes) live.push(`A9: a farm of trees was offered ${forked.routes} route cards, expected none`);
if (!forked.saysWhy) live.push('A9: a farm of trees is sent to the survey with no reason given');
if (!forked.hasButton) live.push('A9: a farm of trees has no way on to the drawing');

// Back to field crops, which is the path the rest of this walk follows.
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#app .card .row')];
  rows.find((r) => r.textContent.includes('Field crops'))?.click();
});
await page.waitForTimeout(60);
const named = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#app .card--tap')];
  if (cards.some((c) => c.disabled)) return { open: false };
  cards[0].click();                                     // Survey my whole farm
  return { open: true };
});
if (!named.open) live.push('A9: the routes stayed locked with the farm named and its crop declared');
await page.waitForTimeout(80);
const a10 = await page.evaluate(() => ({
  at: location.hash,
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
  // The area readout went with the panel it sat in. The instruction went the
  // other way at v1.5.4: it was thirty-eight words wrapped over three lines
  // above the map, and it is behind the ⓘ chip now — so what is checked is that
  // the chip is there and that the words are one tap away rather than gone.
  prints: (document.querySelector('#app .page, #app .app__body')?.textContent ?? '').includes('Farm area'),
  chip: !!document.querySelector('#app .helpchip'),
}));
if (!a10.at.includes('A10')) live.push(`A9: Survey my whole farm led to ${a10.at}, expected A10`);
if (!a10.bar.includes('North Block')) live.push('A10: the bar does not carry the name given on A9');
if (!a10.chip) live.push('A10: no way through to the drawing guidance');
if (a10.prints) live.push('A10: the farm-area readout is still on the screen');
{
  // The instruction is not gone, it is one tap away — which is the whole of the
  // change and the only part of it that can silently stop being true.
  const guidance = await page.evaluate(() => {
    document.querySelector('#app .helpchip')?.click();
    const text = document.querySelector('.overlay .sheet')?.textContent ?? '';
    wafra.state.ui.overlay = null; wafra.commit('t');
    return text;
  });
  if (!guidance.includes('greenhouses')) live.push('A10: the guidance sheet does not carry the drawing instruction');
}

await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(80);
const a12 = await page.evaluate(() => ({
  at: location.hash,
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
  asksForName: !!document.querySelector('#app [data-field="farmname"]'),
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!a12.at.includes('A12')) live.push(`A10: continuing led to ${a12.at}, expected A12`);
if (!a12.bar.includes('North Block')) live.push('A12: the bar does not carry the farm name');
if (a12.asksForName) live.push('A12: still asks for the farm name, which moved to A9');
if (a12.bar.includes('satellite')) live.push('A12: the bar still repeats the question the body asks');
if (!a12.dock.includes('Request a quote')) live.push(`A12: the dock reads "${a12.dock}", expected the quote`);
if (!a12.dock.includes('15–20')) live.push('A12: the wait did not travel with the quote');

// And the other route, which ends in a price rather than a survey: the farm is
// drawn plot by plot, and since the 22/08 review it does NOT pass through A12 —
// one drawn plot is one crop, so there is nothing left to ask. It goes to A11,
// the summary both routes now finish on.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A9'); });
await page.waitForTimeout(80);
await page.click('#app [data-field="farmname"]');
await page.type('#app [data-field="farmname"]', 'South Field', { delay: 4 });
await page.waitForTimeout(60);
// Field crops, which is the only answer that leaves the drawing route open.
await page.evaluate(() => {
  [...document.querySelectorAll('#app .card .row')].find((r) => r.textContent.includes('Field crops'))?.click();
});
await page.waitForTimeout(60);
await page.evaluate(() => document.querySelectorAll('#app .card--tap')[1].click());
await page.waitForTimeout(80);
const a9d = await page.evaluate(() => ({
  at: location.hash,
  bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
  again: !!document.querySelector('#app .actiondock')?.textContent.includes('Add another plot'),
}));
if (!a9d.at.includes('A10D')) live.push(`A9: Draw my own plots led to ${a9d.at}, expected A10D`);
if (!a9d.bar.includes('South Field')) live.push('A10D: the bar does not carry the name given on A9');
if (!a9d.again) live.push('A10D: the secondary action does not offer another plot');

await page.evaluate(() => [...document.querySelectorAll('#app .actiondock .btn')].find((b) => b.textContent.includes('Done'))?.click());
await page.waitForTimeout(80);
const drawn = await page.evaluate(() => {
  const body = document.querySelector('#app .page')?.textContent ?? '';
  const row = document.querySelector('#app .row');
  const labels = [...(row?.querySelectorAll('.iconbtn__label') ?? [])].map((n) => n.textContent.trim());
  return {
    at: location.hash,
    bar: document.querySelector('#app .appbar__title')?.textContent ?? '',
    body,
    rows: document.querySelectorAll('#app .row').length,
    keep: labels.includes('Keep'),
    edit: labels.includes('Edit'),
    remove: labels.includes('Remove'),
  };
});
if (!drawn.at.includes('A11')) live.push(`A10D: Done led to ${drawn.at}, expected A11`);
if (!drawn.bar.includes('South Field')) live.push('A11: the drawn summary is not headed by the farm name');
if (!drawn.bar.includes('Summary of plots')) live.push('A11: the bar does not say what the screen is');
if (drawn.rows < 1) live.push('A11: the drawn summary lists no plots');
if (!drawn.keep || !drawn.edit || !drawn.remove) {
  live.push('A11: a plot row does not offer all three of Keep, Edit and Remove');
}
if (!drawn.body.includes('Add a missing plot')) live.push('A11: no way to add a plot that is missing');

// And on to the end of it. Walking the route rather than jumping to each screen
// is the only thing that catches a handler that throws — a missing import in a
// click callback renders perfectly and does nothing, which is exactly how the
// drawn route's Confirm reached this test working on every screen and on no
// button.
await page.evaluate(() => [...document.querySelectorAll('#app .btn')].find((b) => b.textContent.includes('Confirm and continue'))?.click());
await page.waitForTimeout(120);
const priced = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app .page')?.textContent ?? '',
}));
if (!priced.at.includes('A13')) live.push(`A11: Confirm led to ${priced.at}, expected A13`);
if (!priced.body.includes('30 days free trial')) live.push('A13: the trial is not stated in the reviewed words');
if (!priced.body.includes('Cultivated areas to be monitored')) live.push('A13: the quantities card is not labelled');
if (priced.body.includes('×')) live.push('A13: the per-unit working is still printed');
if (priced.body.includes('15% off')) live.push('A13: the annual price is still on the plan card');
if (!priced.body.includes('modify the list of plots')) live.push('A13: no way back to the plot list');

await page.evaluate(() => [...document.querySelectorAll('#app .btn')].find((b) => b.textContent.trim() === 'Choose')?.click());
await page.waitForTimeout(120);
const ready = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app .page')?.textContent ?? '',
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!ready.at.includes('A14')) live.push(`A13: Choose led to ${ready.at}, expected A14`);
if (!ready.body.includes('has been added to our account')) live.push('A14: the confirmation is not in the reviewed words');
if (!ready.dock.includes('Add another farm')) live.push('A14: no second button for another farm');

// The second button saves the farm just finished and starts the next one, so
// it touches the draft, the farm list and the router in one handler — which is
// the shape of thing that renders correctly and does nothing.
const farmsBefore = await page.evaluate(() => wafra.state.db.farms.length);
await page.evaluate(() => [...document.querySelectorAll('#app .actiondock .btn')].find((b) => b.textContent.includes('Add another farm'))?.click());
await page.waitForTimeout(140);
const again = await page.evaluate(() => ({
  at: location.hash,
  farms: wafra.state.db.farms.length,
  placeholder: document.querySelector('#app [data-field="farmname"]')?.placeholder ?? '',
}));
if (!again.at.includes('A9')) live.push(`A14: Add another farm led to ${again.at}, expected A9`);
if (again.farms !== farmsBefore + 1) live.push('A14: Add another farm did not save the farm just finished');
if (!again.placeholder) live.push('A14: the next farm opens with no suggested name');

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
if (sheet.total !== screens.length) problems.push(`screen grid: ${sheet.total} tiles for ${screens.length} screens`);
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
const KNOWN_KEY_COLLISIONS = new Set([
  'action.save', 'advice.type.irrigation', 'advice.type.nutrition',
  'advice.type.protection', 'advice.type.weather', 'b10.water', 'b11.title',
  'c1.search', 'landuse.crops', 'landuse.trees', 'unit.ha',
]);
const collisions = await page.evaluate(() => wafra.keyCollisions());
for (const { key, english } of collisions) {
  if (KNOWN_KEY_COLLISIONS.has(key)) continue;
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
