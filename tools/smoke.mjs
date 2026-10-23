/* Smoke test: open every registered screen, in every role, and fail on any
   console error or uncaught exception. Also dumps the English string catalogue
   so the translation files can be generated from what the app actually uses.

   Usage:  node tools/smoke.mjs [--dump path.json] [--shots dir]
*/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
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
const overlayIds = ['UPGRADE', 'CONFIRM', 'NOTICE', 'NEEDS_CONNECTION', 'MEASURE_INFO',
  'FARM_PICKER', 'FARM_SWITCH', 'PLOT_PICKER', 'JOIN_PLOT_PICKER', 'CROP_PICKER',
  'LANG_PICKER', 'REPORT_RECIPIENT', 'MAP_SEARCH', 'PLOT_SHAPE_MENU',
  'FIELD_CROP', 'BIOMETRIC',
  'PLOT_MENU', 'TREE_MENU', 'ADVICE_MENU', 'ADVICE_FILTERS', 'SEND_TO', 'ADVICE_RECIPIENTS', 'WORKER', 'SHOW_WHERE', 'HELP_NOTE',
  'ADVISORY_LOG', 'DELETE_PLOT', 'DELETE_FARM', 'DELETE_ACCOUNT', 'CLOSE_CYCLE',
  'SEARCH', 'NOTIFICATIONS', 'REPORT', 'PLAN_CHOOSER', 'CONTACT_PREVIEW',
  'CONTACT', 'LEGAL', 'LEAVE_REASON', 'PLANNER_PLOT'];

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
  PLOT_PICKER: { farmId: 'farm-3' },
  FARM_SWITCH: { current: 'farm-1' }, CROP_PICKER: {},
  HELP_NOTE: { title: 'How to draw this', body: 'Trace the outside of your land.' },
  PLOT_MENU: { plotId: 'plot-23' }, TREE_MENU: { treeId: 'T-2841' },
  ADVICE_MENU: { adviceId: 'adv-01' }, SHOW_WHERE: { adviceId: 'adv-01' },
  ADVISORY_LOG: { adviceId: 'adv-01' },
  DELETE_PLOT: { plotId: 'plot-23' }, DELETE_FARM: { farmId: 'farm-1' },
  CLOSE_CYCLE: { plotId: 'plot-13', cycleId: 'plot-13-cyc-1' },
  REPORT: { reportId: 'rep-01' },
  CONTACT_PREVIEW: { channel: 'whatsapp' }, LEGAL: { doc: 'terms' },
  CONFIRM: { title: 'x', body: 'y' },
  FIELD_CROP: { index: 0 },
  MEASURE_INFO: { key: 'ndvi' }, MAP_SEARCH: {},
  PLOT_SHAPE_MENU: { plotId: 'plot-23' }, JOIN_PLOT_PICKER: { farmId: 'farm-3', exclude: 'plot-23' },
  WORKER: { id: 'user-2', farmId: 'farm-1' },
  PLANNER_PLOT: { farmId: 'farm-3', current: 'plot-22' },
};

for (const id of overlayIds) {
  const before = problems.length;
  await page.evaluate(([view, params]) => {
    wafra.jump('B1:farm-1');
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
  await page.evaluate((l) => { wafra.setLanguage(l); wafra.jump('B2:plot-04'); }, lang);
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
}));

const routes = [
  ...entities.farms.flatMap((id) => [`B1:${id}`, `B11:${id}`, `B10:${id}`, `F3:${id}`, `F4:${id}`, `A16:${id}`, `A17:${id}`]),
  // A tree group has no crop cycle and no plot detail of its own — B2 hands it
  // to B5 — so the cycle screens are walked over the crop plots only.
  ...entities.plots.map((id) => `B2:${id}`),
  ...entities.cropPlots.flatMap((id) => [`B3:${id}`, `B4:${id}`, `C5:${id}`]),
  ...entities.treeGroups.map((id) => `B5:${id}`),
  ...entities.trees.map((id) => `B6:${id}`),
  // Weather records are not advice since the Monday review, so they have no
  // detail screen; D6 went with them.
  ...entities.advice.filter((a) => a.type !== 'weather')
    .map((a) => `${({ irrigation: 'D2', nutrition: 'D3', protection: 'D4' })[a.type]}:${a.id}`),
  'B2:plot-23',
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
for (const plan of ['basic', 'premium', 'trial_expired']) {
  for (const route of ['B1:farm-3', 'B2:plot-23', 'B5:tg-01', 'B3:plot-13', 'C1', 'C2', 'D1', 'F5', 'F6', 'F10', 'F4:farm-1']) {
    const before = problems.length;
    await page.evaluate(([p, r]) => { wafra.state.session.plan = p; wafra.jump(r); }, [plan, route]);
    await page.waitForTimeout(10);
    if (problems.length > before) problems.push(`  ↳ ${route} on ${plan}`);
    checked += 1;
  }
}
await page.evaluate(() => { wafra.state.session.plan = 'premium'; });

/* Oct 2026 — two plans; crops per hectare, trees per tree. The pricing rules and the
   per-farm entitlement, checked against the fixtures rather than against
   numbers copied in here: the band table is mock data and will change. */
{
  const found = await page.evaluate(async () => {
    const pricing = await import('/app/core/pricing.js');
    const ent = await import('/app/core/entitlements.js');
    const { bands, crop, trees, minimum } = wafra.state.db.pricing;
    const out = [];
    const [first, second] = bands;
    // Crops per hectare, trees per tree: trees are never counted as hectares.
    const both = pricing.priceFor([{ cropHa: 10, treeCount: 1000 }], 'basic');
    if (Math.abs(both.usd - (10 * crop[0].basic + 1000 * trees[0].basic)) > 1e-9) out.push('the price is not hectares × the crop rate + trees × the tree rate');
    const orchard = pricing.priceFor([{ cropHa: 0, treeCount: 1000 }], 'premium');
    if (Math.abs(orchard.usd - 1000 * trees[0].premium) > 1e-9) out.push('trees are not priced per tree');
    const few = pricing.priceFor([{ cropHa: 0, treeCount: 20 }], 'basic');
    if (Math.abs(few.usd - minimum.trees * trees[0].basic) > 1e-9) out.push('fewer trees than the minimum do not pay the minimum');
    const farms = pricing.priceFor([{ cropHa: 30, treeCount: 0 }, { cropHa: 30, treeCount: 0 }], 'basic');
    if (Math.abs(farms.cropRate - crop[1].basic) > 1e-9) out.push('the rate per hectare is not read from the owner\'s total hectares');
    if (pricing.bandFor(0) !== first) out.push('a total of 0 does not pay the first band');
    if (pricing.bandFor(first.m / 2) !== first) out.push('a total below the first band does not pay the first band');
    if (pricing.bandFor(second.m) !== second) out.push('a total at a band\'s price is not billed in that band');
    if (pricing.bandFor(second.m - 0.01) !== first) out.push('a total just under a band is not rounded down');
    if (pricing.bandFor(1e9) !== bands[bands.length - 1]) out.push('a huge total is not billed in the last band');
    if (pricing.productId('premium', 'month', bands[11]) !== `wafra_premium_m_${String(bands[11].band).padStart(3, '0')}`) out.push('product id is not wafra_{level}_{m|y}_{band:3}');
    if (!/^wafra_basic_y_\d{3}$/.test(pricing.productId('basic', 'year', first))) out.push('yearly product id is malformed');
    // One list per plan, the same on every farm: farm-2 is crops only,
    // farm-1 trees only, farm-3 both, and none of that changes the plan.
    wafra.state.session.plan = 'basic';
    // What F6 sells in Basic is open on Basic, and what it sells in Premium
    // only is not; what neither F6 nor the plan sheet puts in Premium is Basic.
    for (const key of ['irrigation.schedule', 'irrigation.schedule.tree',
      'measure.evi', 'growthstage', 'weather.forecast.15', 'et.data', 'tree.perTree', 'ripeness',
      'harvest.alerts', 'tree.disease.forecast', 'maps.compare', 'tree.list', 'report.monthly', 'satellite.1m', 'tree.health.full']) {
      if (!ent.has(key)) out.push(`Basic does not give ${key}`);
    }
    for (const key of ['irrigation.efficiency', 'fertigation', 'crop.planner', 'soil.nutrients', 'yield.forecast',
      'measure.ndre', 'disease.photo', 'tickets', 'tree.gap.detect']) {
      if (ent.has(key)) out.push(`Basic gives ${key}`);
    }
    if (ent.lock('maps.compare').plan !== 'Basic' || ent.lock('crop.planner').plan !== 'Premium') out.push('a lock names the wrong plan');
    // The crop planner (B7) and plant diagnosis (D5) are Premium.
    wafra.jump('B7:farm-2');
    if (!document.querySelector('#app .lockbox')) out.push('B7 on Basic is not the lock');
    wafra.jump('B1:farm-2');
    if (!document.querySelector('#app .quickbar__lock')) out.push('B1 on Basic: the crop planner shortcut has no lock');
    wafra.jump('D5');
    if (!document.querySelector('#app .lockbox')) out.push('D5 on Basic is not the lock');
    // Irrigation efficiency and nutrition are Premium, on crops and trees.
    for (const farm of ['farm-1', 'farm-2']) {
      wafra.jump(`B1:${farm}`);
      if (!document.querySelector('#app .farmscores__cell--locked')) out.push(`B1 on Basic: irrigation efficiency on ${farm} is not locked`);
    }
    for (const plot of ['plot-15', 'tg-02']) {
      wafra.jump(`B2:${plot}`);
      if (![...document.querySelectorAll('#app .scorelist .row--locked')].some((r) => /Nutrition/.test(r.textContent))) out.push(`B2 on Basic: nutrition on ${plot} is not locked`);
    }
    wafra.state.ui.measure = 'ndre';
    wafra.jump('B2:tg-01');
    if (!document.querySelector('#app .plotmap .locked')) out.push('B5 on Basic: the map painted with nutrition is not locked');
    wafra.state.ui.measure = 'ndvi';
    wafra.state.session.plan = 'premium';
    for (const key of ['irrigation.efficiency', 'crop.planner', 'measure.ndre', 'disease.photo', 'tickets']) {
      if (!ent.has(key)) out.push(`Premium does not give ${key}`);
    }
    wafra.jump('B1:farm-2');
    if (document.querySelector('#app .farmscores__cell--locked')) out.push('B1 on Premium: irrigation efficiency is locked');
    wafra.jump('B7:farm-1');
    if (document.querySelector('#app .lockbox')) out.push('B7 on Premium is locked on a farm of trees');
    wafra.jump('D5');
    if (document.querySelector('#app .lockbox')) out.push('D5 on Premium is locked');
    wafra.state.session.plan = 'trial_expired';
    if (ent.has('maps.compare') || !ent.has('farm.view.readonly')) out.push('trial_expired is not read-only');
    wafra.state.session.plan = 'premium';
    // A18 names the store product the press buys.
    wafra.jump('A18');
    const id = document.querySelector('#app [data-product-id]')?.dataset.productId ?? '';
    if (!/^wafra_(basic|premium)_[my]_\d{3}$/.test(id)) out.push(`A18 sells "${id}", not a wafra_{level}_{m|y}_{band} product`);
    return out;
  });
  for (const f of found) problems.push(`pricing: ${f}`);
  if (!found.length) console.log('pricing: crops per hectare, trees per tree, bands rounded down with a minimum, product ids, per-farm plans');
  checked += 1;
}

for (const conn of ['offline', 'syncing', 'online']) {
  for (const route of ['B1:farm-1', 'C1', 'C5:plot-23', 'D2:adv-01', 'B4:plot-13', 'F10']) {
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
  for (const route of ['C1', 'B6:T-2841', 'B6:T-2805', 'B5:tg-01']) {
    const before = problems.length;
    await page.evaluate(([g, r]) => { wafra.state.session.gpsGranted = g; wafra.jump(r); }, [granted, route]);
    await page.waitForTimeout(14);
    if (problems.length > before) problems.push(`  ↳ ${route} with location ${granted ? 'granted' : 'refused'}`);
    checked += 1;
  }
  for (const params of [{ treeId: 'T-2841' }, { adviceId: 'adv-01' }]) {
    const before = problems.length;
    await page.evaluate((p) => { wafra.jump('B5:tg-01'); wafra.openSheet('SHOW_WHERE', p); }, params);
    await page.waitForTimeout(14);
    const drawn = await page.evaluate(() => !!document.querySelector('.overlay .sheet'));
    if (!drawn) problems.push(`SHOW_WHERE did not render for ${JSON.stringify(params)}`);
    if (problems.length > before) problems.push(`  ↳ SHOW_WHERE ${JSON.stringify(params)} location ${granted}`);
    checked += 1;
  }
}

// Demo mode unlocks everything (WF4.091) and must not break a gated screen.
await page.evaluate(() => { wafra.state.session.demo = true; wafra.commit('t'); });
for (const route of ['B1:farm-1', 'B1:farm-3', 'C2', 'D1', 'F5', 'A9B']) {
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
// And since the Monday review a farm also has a WORKFORCE: people in B10's
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


// THE PLOT CARDS, which are what B1 is for (v1.7.4). Every card says what
// grows there, carries the plot's number, and is ONE button that opens the
// plot — nothing inside it goes anywhere else (not the crop cycles, not the
// advice), so a card pressed anywhere lands on the plot.
{
  const before = problems.length;
  const seen = await page.evaluate(() => {
    wafra.jump('B1:farm-3');
    const cards = [...document.querySelectorAll('.page .pcard')];
    const plots = wafra.sel.plotsOf('farm-3');
    return {
      cards: cards.length,
      plots: plots.length,
      // In plot number order, trees among the fields.
      order: cards.map((c) => c.querySelector('.pcard__num')?.textContent).join(),
      expected: plots.map((p) => p.shortName).join(),
      headed: cards.filter((c) => c.querySelector('.pcard__big')?.textContent.trim()).length,
      inner: cards.reduce((n, c) => n + c.querySelectorAll('button, a, [role="button"]').length, 0),
      // Every plot says how it is doing: the worst of its five indicators.
      verdicts: plots.filter((p, i) => !p.harvestDetectedOn && !p.counting && cards[i]?.dataset.health !== wafra.sel.plotHealth(p)).map((p) => p.shortName),
      unsaid: plots.filter((p, i) => !p.harvestDetectedOn && !p.counting && !cards[i]?.querySelector('.pcard__foot .status')).map((p) => p.shortName),
      empty: cards.filter((c) => c.querySelector('.pcard__big--none')).length,
      opens: cards.filter((c) => c.tagName === 'BUTTON').length,
      columns: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size,
      scores: document.querySelectorAll('.page .farmscores__cell').length,
      quick: document.querySelectorAll('.page .quickbar__item').length,
      // The review took all four off this screen; each would come back as a
      // whole block, so each is worth naming when it does.
      legend: (document.querySelector('.page')?.textContent ?? '').includes('act within days'),
      filter: !!document.querySelector('.page select'),
      nothingUrgent: (document.querySelector('.page')?.textContent ?? '').includes('Nothing urgent'),
    };
  });
  if (seen.cards !== seen.plots) problems.push(`B1 draws ${seen.cards} plot cards for ${seen.plots} plots`);
  if (seen.order !== seen.expected) problems.push(`B1: the cards run ${seen.order}, expected ${seen.expected}`);
  if (seen.headed !== seen.cards) problems.push(`B1: ${seen.cards - seen.headed} cards do not say what is growing there`);
  if (seen.inner) problems.push(`B1: ${seen.inner} controls inside the plot cards go somewhere other than the plot`);
  if (seen.verdicts.length) problems.push(`B1: ${seen.verdicts.join(', ')} do not wear their worst indicator's status`);
  if (seen.unsaid.length) problems.push(`B1: ${seen.unsaid.join(', ')} do not say how they are doing`);
  // Pressed on its crop name, and on its "No crop", a card still opens the plot.
  for (const [plotId, sel] of [['plot-22', '.pcard__big'], ['plot-23', '.pcard__big--none']]) {
    const at = await page.evaluate(async ([id, s]) => {
      wafra.jump('B1:farm-3');
      await new Promise((r) => setTimeout(r, 40));
      const card = [...document.querySelectorAll('.page .pcard')].find((c) => c.querySelector('.pcard__num')?.textContent === wafra.sel.plotsOf('farm-3').find((p) => p.id === id)?.shortName);
      card?.querySelector(s)?.click();
      await new Promise((r) => setTimeout(r, 40));
      return location.hash;
    }, [plotId, sel]);
    if (!at.includes(`B2:${plotId}`)) problems.push(`B1: pressing ${sel} on ${plotId}'s card led to ${at}, expected B2`);
  }
  if (seen.empty !== 1) problems.push(`B1: ${seen.empty} plots prompt for a crop, expected 1 (plot-23 is between crops)`);
  if (seen.opens !== seen.cards) problems.push('B1: a plot card has no way through to the plot');
  if (seen.columns !== 2) problems.push(`B1: the cards stand in ${seen.columns} columns, expected 2`);
  if (seen.scores !== 3) problems.push(`B1: ${seen.scores} farm scores in the strip, expected 3`);
  if (seen.quick < 3) problems.push(`B1: only ${seen.quick} shortcuts under More`);
  if (seen.legend) problems.push('B1: the status legend is back');
  if (seen.filter) problems.push('B1: the plot filter is back');
  if (seen.nothingUrgent) problems.push('B1 says "Nothing urgent" — silence is the answer when nothing is');
  if (problems.length > before) problems.push('  ↳ while checking the plot list on B1');
  checked += 1;
}

/* NO ROUTE MAY POINT AT A SCREEN THE REGISTRY DOES NOT CARRY. A go() call to a
   deleted screen is a dead end nothing else in this test would notice.

   This used to name one screen — the quote-request page the 01/09 review
   deleted, which was A12 at the time — and the v1.7.1 renumbering retired that
   check rather than repointing it: the letter A12 belongs to a live screen now,
   so asserting its absence would assert the opposite of the truth. What the
   check was FOR survives here in the general form, which is the half that was
   ever really testable. */
{
  const before = problems.length;
  const dead = await page.evaluate(() =>
    [...document.querySelectorAll('[data-missing-screen]')].map((el) => el.dataset.missingScreen));
  if (dead.length) problems.push(`routes point at screens that do not exist: ${dead.join(', ')}`);
  if (problems.length > before) problems.push('  ↳ while checking for dead routes');
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
      severity: 'all', completion: 'all', type: 'all', sort: 'field', kind: 'plots',
    });
    wafra.state.session.role = 'owner';
    wafra.jump('D1');
    // The Plots tab (v1.7.3): advice on fields, not on tree groups.
    const all = wafra.sel.adviceFor({ status: 'open' });
    const open = all.filter((a) => a.plotIds.some((id) => wafra.sel.plotById(id).kind !== 'trees'));
    const labels = [...document.querySelectorAll('.page .card .btn')].map((b) => b.textContent.trim());
    return {
      wantOpen: open.length,
      wantSent: all.filter((a) => wafra.sel.isSent(a)).length,
      wantAll: all.length,
      cardButtons: labels,
      share: document.querySelectorAll('.page .card .cardshare').length,
    };
  });
  if (!seen.wantSent || seen.wantSent === seen.wantAll) problems.push('D1 fixtures no longer show both advice states');
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
    return { signup: runToEnd('A3'), help: runToEnd('A3:help') };
  });
  if (ends.signup !== 'Get started') problems.push(`A3 from first run ends on "${ends.signup}"`);
  if (ends.help !== 'Done') problems.push(`A3 from Help ends on "${ends.help}"`);
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

     A17 puts two plan cards side by side and a Choose button on each. Review
     S03 asked for the two buttons to be the SAME, because a green one on one
     card and a grey one on the other is the app choosing for the farmer; the
     round after it asked for the same button to be the PRIMARY one, because a
     grey button under a price reads as the option you are being talked out of.
     Two equal primaries is the requirement being met rather than broken — the
     screen has one decision on it, offered twice. Named here so that a THIRD
     primary appearing on A17, or a second one anywhere else, still fails. */
  const allowed = s.id === 'A17' ? 2 : 1;
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
// A8 is the whole account on one form: a name, a mobile number, an email
// address and a password — the number because a code goes to it and is checked,
// the address because reports and a web-bought licence need somewhere to land,
// the name and the password because an account is not made without them. The
// primary button has to answer all five conditions as they are typed rather
// than on blur.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A8'); });
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
if (!a5.focused) live.push('A8: typing lost focus');
if (!a5.caretAtEnd) live.push('A8: the caret jumped while typing');
if (!a5.disabled) live.push('A8: the primary action was enabled with only a number typed');
if (!a5.asksForEmail) live.push('A8: no email address is asked for');
if (!a5.asksForName) live.push('A8: a first name and a last name are not both asked for');
if (a5.asksForPassword) live.push('A8: a password field is back on the sign-up form');
if (!a5.doorsInView) live.push('A8: "join a farm as a guest" needs scrolling to reach');

await page.click('#app input[type="email"]');
await page.type('#app input[type="email"]', 'khaled@example.com', { delay: 4 });
await page.waitForTimeout(60);
if (!await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A8: the primary action was enabled with no name, no password and no terms ticked');
}
await page.click('#app [data-field="firstname"]');
await page.type('#app [data-field="firstname"]', 'Khaled', { delay: 4 });
await page.click('#app [data-field="lastname"]');
await page.type('#app [data-field="lastname"]', 'Al-Amri', { delay: 4 });
await page.waitForTimeout(60);
// The password rule went with the password (review 21/09). What is left as the
// last gate is the terms tick, and it still has to be a gate.
if (!await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A8: the primary action was enabled before the terms were ticked');
}
await page.click('#app .check input[type="checkbox"]');
await page.waitForTimeout(60);
if (await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A8: the primary action is still disabled with the whole form answered');
}
// The caret must survive a keystroke made in the MIDDLE of a value.
await page.evaluate(() => { const e = document.querySelector('#app input[type="tel"]'); e.focus(); e.setSelectionRange(3, 3); });
await page.keyboard.type('7');
const mid = await page.evaluate(() => ({ at: document.activeElement.selectionStart, value: document.activeElement.value }));
if (mid.at !== 4 || mid.value !== '5127345678') live.push(`A8: caret moved on a mid-string keystroke (${mid.at}, "${mid.value}")`);

// A9 sends the code to the NUMBER. The address is the account (06/09) and the
// code is not the account (Monday review): four digits have to arrive in
// seconds on a phone in a field, which is an SMS. The screen says where it went
// once, as the screen's headline (v1.8: on the page, under its mark), and that
// sentence is the only heading it has. Four
// cells, not six, and they are inputs the phone's own keyboard can fill — the
// drawn keypad went at the 06/09 review.
await page.evaluate(() => wafra.jump('A9'));
await page.waitForTimeout(60);
const a6 = await page.evaluate(() => ({
  bar: document.querySelector('#app .appbar__title, #app .headline')?.textContent ?? '',
  body: document.querySelector('#app .page')?.textContent ?? '',
  cells: document.querySelectorAll('#app input.otp__cell').length,
  keypad: document.querySelectorAll('#app .keypad').length,
}));
if (!/\d/.test(a6.bar) || a6.bar.includes('@')) live.push('A9: the code was not addressed to a mobile number');
if (a6.cells !== 4) live.push(`A9: ${a6.cells} typable code cells, expected 4`);
if (a6.keypad) live.push('A9: the drawn keypad is back');

// 13/09 review, second pass — A10 asks its name, unit and two numbers, and
// nothing else. Filling in the area, the tree count, or both IS what used to
// be a picker with a "Both" card; there is no picker left to test for.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A10'); });
await page.waitForTimeout(80);
const a9 = await page.evaluate(() => ({
  asksForName: !!document.querySelector('#app [data-field="farmname"]'),
  asksArea: !!document.querySelector('#app [data-field="rougharea"]'),
  asksTrees: !!document.querySelector('#app [data-field="roughtrees"]'),
  noBoth: !(document.querySelector('#app .page')?.textContent ?? '').includes('Both'),
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
}));
if (!a9.asksForName) live.push('A10: the farm is not named up front');
if (!a9.asksArea) live.push('A10: no field for the approximate crop area');
if (!a9.asksTrees) live.push('A10: no field for the approximate tree count');
if (!a9.noBoth) live.push('A10: a "Both" option is still on the screen');
if (!a9.dock.includes('Continue')) live.push(`A10: no Continue button in the dock ("${a9.dock}")`);

// Continue with nothing filled in must not proceed: nothing is disabled, so
// the screen has to say what is missing rather than sit there.
await page.evaluate(() => document.querySelector('#app .actiondock .btn')?.click());
await page.waitForTimeout(80);
const nagged = await page.evaluate(() => location.hash);
if (nagged.includes('A11')) live.push('A10: Continue proceeded with no farm name and no numbers at all');

await page.click('#app [data-field="farmname"]');
await page.type('#app [data-field="farmname"]', 'North Block', { delay: 4 });
await page.click('#app [data-field="rougharea"]');
await page.type('#app [data-field="rougharea"]', '12', { delay: 4 });
await page.click('#app [data-field="roughtrees"]');
await page.type('#app [data-field="roughtrees"]', '400', { delay: 4 });
await page.waitForTimeout(60);
await page.evaluate(() => document.querySelector('#app .actiondock .btn')?.click());
await page.waitForTimeout(80);

// A11 — the price estimate. One button, a plain-text caption rather than a
// boxed summary, and an explanation of what the NEXT screen does, all new at
// the 13/09 review. (A11, not A9D: A9D is B9's old letter, and B9's own
// translation keys are still 'a9d.*', so that letter was never actually free
// to reuse.)
const a9e = await page.evaluate(() => ({
  at: location.hash,
  body: document.querySelector('#app .page')?.textContent ?? '',
  dock: document.querySelector('#app .actiondock')?.textContent ?? '',
  cards: document.querySelectorAll('#app .card--tap').length,
}));
if (!a9e.at.includes('A11')) live.push(`A10: Continue led to ${a9e.at}, expected A11`);
if (!a9e.body.includes('12.0 ha') && !a9e.body.includes('12 ha')) live.push('A11: the area typed on A10 is not reflected in the estimate');
if (!a9e.body.includes('400')) live.push('A11: the tree count typed on A10 is not reflected in the estimate');
/* REBUILT AT REVIEW 21/09 out of A17's layout: the two real plans at their two
   real prices, and NOTHING to choose between them — "remove buttons, not needed
   at this point". The radio is the thing to assert on, because a card that
   merely looks unselected still invites a tap. */
if (a9e.cards !== 0) live.push(`A11: ${a9e.cards} plan cards offer a selection, expected none`);
if (!a9e.body.includes('final quote')) live.push('A11: it does not say the fields drawn are what settle the price');
// The four steps, in the reviewer's order — and the fourth is the one that
// matters: choosing a plan comes last, after the fields are drawn.
if (!a9e.body.includes('You select the service plan you want')) live.push('A11: the four next steps are not on the screen');
// "Let's still capture 'not interested / why' … we want some signal if
// conversion isn't happening."
if (!a9e.dock.includes('not interested')) live.push('A11: there is no way to decline at the price stage');
await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(80);

// A9B is deliberately not on this walk any more — see the note in
// screens/index.js. Every farm goes straight from A11 to A13 now.
const a10start = await page.evaluate(() => location.hash);
if (a10start.includes('A9B')) live.push('A11: Confirm and continue still opens the removed A9B fork');
if (!a10start.includes('A13') || a10start.includes('B9')) {
  live.push(`A11: Confirm and continue led to ${a10start}, expected A13`);
}

/* A13 IS ONE SCREEN TO FIND THE FARM AND DRAW ITS FIELDS, since v1.7.4: "no
   more two screens to find the farm. Just: find your farm with a search
   button, or browse the map." The map is the whole screen; two small tools on
   its side, a polygon and a round field; the fields drawn in a drawer at the
   bottom, and every field drawn is asked what grows in it. */
const read = () => page.evaluate(() => ({
  at: location.hash,
  // The screen's head: the app bar, the drawer of the drawing screen, or a
  // title written on the page over a map (A16, v1.8).
  bar: document.querySelector('#app .appbar__title, #app .drawer__title, #app .pagehead__title')?.textContent ?? '',
  sub: document.querySelector('#app .appbar small, #app .drawer__sub, #app .drawer__chip, #app .pagehead__sub')?.textContent ?? '',
  body: [document.querySelector('#app')?.textContent ?? '',
    ...[...document.querySelectorAll('#app input')].map((i) => i.placeholder ?? '')].join(' '),
  dock: document.querySelector('#app .actiondock, #app .drawer')?.textContent ?? '',
  sheet: document.querySelector('.overlay .sheet')?.textContent ?? '',
}));
const press = (sel, words) => page.evaluate(([s, w]) => [...document.querySelectorAll(s)]
  .find((b) => b.textContent.includes(w))?.click(), [sel, words]);
const tool = (label) => page.evaluate((l) => document.querySelector(`#app .drawtools [aria-label="${l}"]`)?.click(), label);
const a13 = await read();
if (!a13.bar.includes('Draw your fields')) live.push(`A13: the drawer is headed "${a13.bar}", expected "Draw your fields"`);
if (!a13.sub.includes('North Block')) live.push('A13: the drawer does not carry the name given on A10');
if (!a13.body.includes('Find your farm')) live.push('A13: there is no search to find the farm');
if (a13.body.includes('Use my current location')) live.push('A13: the location button is back; finding is search or browse');
const tools = await page.evaluate(() => [...document.querySelectorAll('#app .drawtools .maptool')].map((b) => b.getAttribute('aria-label')).join());
if (tools !== 'Draw a field,Round field') live.push(`A13: the tools on the map are "${tools}", expected a polygon and a round field`);
const fullScreen = await page.evaluate(() => {
  const map = document.querySelector('#app .drawscreen')?.getBoundingClientRect();
  const app = document.querySelector('#app')?.getBoundingClientRect();
  return map && app ? map.height / app.height : 0;
});
if (fullScreen < 0.9) live.push(`A13: the map takes ${Math.round(fullScreen * 100)}% of the screen, expected all of it`);

// A polygon, answered with a crop.
await tool('Draw a field');
await page.waitForTimeout(60);
await press('#app .drawer .btn', 'Done');
await page.waitForTimeout(80);
const cropSheet = await read();
if (!cropSheet.sheet.includes('What grows in Plot 1')) live.push('A13: a finished field does not ask what grows in it');
if (!cropSheet.sheet.includes('Date palms and fruit trees')) live.push('FIELD_CROP: the tree answer is not offered');
await press('.overlay .sheet .row', 'Wheat');
await page.waitForTimeout(80);

// A round field: a tap sets the centre, and the circle is there to drag.
await tool('Round field');
await page.waitForTimeout(60);
const band = await page.locator('#app .drawscreen').first().boundingBox();
await page.mouse.click(band.x + band.width * 0.3, band.y + band.height * 0.45);
await page.waitForTimeout(60);
const circle = await page.evaluate(() => !!document.querySelector('#app .drawscreen circle'));
if (!circle) live.push('A13: a tap with the round tool does not place a circle');
await press('#app .drawer .btn', 'Done');
await page.waitForTimeout(80);
await press('.overlay .sheet .row', 'Date palms and fruit trees');
await page.waitForTimeout(80);
const a13done = await read();
const listed = await page.evaluate(() => [...document.querySelectorAll('#app .drawer .fieldcard__sub')].map((r) => r.textContent.split(' · ')[0]).join());
if (listed !== 'Wheat,Date palms and fruit trees') live.push(`A13: the fields listed are "${listed}", expected Wheat and a tree field`);
if (!a13done.dock.includes('Continue to quote')) live.push(`A13: the drawer reads "${a13done.dock}", expected "Continue to quote"`);

await press('#app .drawer .btn', 'Continue to quote');
await page.waitForTimeout(100);
const a16 = await read();
if (!a16.at.includes('A16')) live.push(`A13: Continue to quote led to ${a16.at}, expected A16`);
if (!`${a16.bar} ${a16.sub}`.includes('North Block')) live.push('A16: the drawn fields are not headed by the farm name');
if (!a16.body.includes('Wheat') || !a16.body.includes('Date palms and fruit trees')) live.push('A16: the fields do not say what grows in them');
if (!a16.body.includes('about')) live.push('A16: the tree fields carry no estimate of the trees in them');

await press('#app .btn', 'See your price');
await page.waitForTimeout(100);
const price = await read();
if (!price.at.includes('A17')) live.push(`A16: See your price led to ${price.at}, expected A17`);
// Review 21/09 made the button "Start free trial" on both passes of this screen.
if (!price.dock.includes('Start free trial')) live.push(`A17: the dock reads "${price.dock}", expected "Start free trial"`);

// The plans are rows inside one card, not cards of their own — review
// 21/09's second pass, "there's too many widgets going on".
const farmsBeforeBuy = await page.evaluate(() => wafra.state.db.farms.length);
await page.evaluate(() => document.querySelectorAll('#app .planbox__row--tap')[1]?.click());
await page.waitForTimeout(80);
await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(160);

/* THE MONEY CHANGES HANDS IN THE STORE'S OWN SHEET. A18, new at the second
   pass: "add a new screen 13c with the iOS app store payment popup displayed as
   a drawer for payment." A17 no longer completes anything by itself, which is
   the whole point — Wafra never sees the card. */
const store = await read();
if (!store.at.includes('A18')) live.push(`A17: Start free trial led to ${store.at}, expected A18`);
if (!store.body.includes('Confirm Subscription')) live.push('A18: the App Store sheet is not drawn');
if (!store.body.includes('Double Click to Confirm')) live.push('A18: the sheet is missing the side-button confirmation');
if (!store.body.includes('Apple Account')) live.push('A18: the sheet does not say whose account is paying');

/* PAYING MAKES THE FARM, out of the fields drawn, and starts counting the
   trees in its tree fields. */
await press('#app button', 'Subscribe');
await page.waitForTimeout(160);
const made = await page.evaluate(() => {
  const farm = wafra.state.db.farms.at(-1);
  const plots = wafra.state.db.plots.filter((p) => p.farmId === farm.id);
  return {
    at: location.hash,
    farms: wafra.state.db.farms.length,
    farmId: farm.id,
    name: farm.name,
    count: farm.count?.state,
    plots: plots.map((p) => `${p.kind}:${p.counting ? 'counting' : p.cropName}`).join(),
    body: document.querySelector('#app .page')?.textContent ?? '',
    dock: document.querySelector('#app .actiondock')?.textContent ?? '',
  };
});
if (!made.at.includes('A19')) live.push(`A18: Subscribe led to ${made.at}, expected A19`);
if (made.farms !== farmsBeforeBuy + 1) live.push('A18: Subscribe did not create the farm');
if (made.name !== 'North Block') live.push(`A18: the new farm is called "${made.name}", expected "North Block"`);
if (made.count !== 'counting') live.push(`A18: the new farm's count is "${made.count}", expected "counting"`);
if (made.plots !== 'crops:Wheat,trees:counting') live.push(`A18: the new farm's fields are ${made.plots}, expected Wheat and a tree field being counted`);
if (!made.body.includes('has been added to your account')) live.push('A19: the confirmation is not in the reviewed words');
if (!made.body.includes('counting the trees')) live.push('A19: it does not say the trees are being counted');
if (!made.dock.includes('Add another farm')) live.push('A19: no second button for another farm');

// The second button starts the next farm's sign-up, without adding a second
// record for the one just finished.
await press('#app .actiondock .btn', 'Add another farm');
await page.waitForTimeout(140);
const again = await page.evaluate(() => ({
  at: location.hash,
  farms: wafra.state.db.farms.length,
  placeholder: document.querySelector('#app [data-field="farmname"]')?.placeholder ?? '',
}));
if (!again.at.includes('A10')) live.push(`A19: Add another farm led to ${again.at}, expected A10`);
if (again.farms !== made.farms) live.push('A19: Add another farm changed the farm count, expected no change');
if (!again.placeholder) live.push('A19: the next farm opens with no suggested name');

/* THE COUNT, ON HOME AND ON THE MAP: a tree field being counted says so, with
   a skeleton shine, until the count is in. */
await page.evaluate(() => { wafra.state.nav.mode = 'app'; wafra.commit('t'); });
await page.evaluate((id) => wafra.jump(`B1:${id}`), made.farmId);
await page.waitForTimeout(120);
const home = await page.evaluate(() => ({
  body: document.querySelector('#app .page')?.textContent ?? '',
  skeleton: !!document.querySelector('#app .page .skeleton'),
  shape: !!document.querySelector('#app .counting'),
}));
if (!home.body.includes('Counting your trees')) live.push('B1: a farm being counted does not show the counting card');
if (!home.skeleton) live.push('B1: the tree field being counted has no skeleton line');
if (!home.shape) live.push('B1: the tree field being counted is not marked on the map');
await press('#app .page .btn', 'See the result now');
await page.waitForTimeout(100);
const counted = await page.evaluate(() => document.querySelector('#app .page')?.textContent ?? '');
if (!counted.includes('Your trees are counted')) live.push('B1: the finished count does not show the ready card');

await page.evaluate(() => document.querySelector('#app .card--tap')?.click());
await page.waitForTimeout(140);
const found = await read();
if (!found.at.includes('A16')) live.push(`B1: the ready card led to ${found.at}, expected A16`);
if (!found.body.includes('trees')) live.push('A16: the counted trees are not listed');
await press('#app .btn', 'Confirm my plan');
await page.waitForTimeout(140);
const repriced = await read();
if (!repriced.at.includes('A17')) live.push(`A16: Confirm my plan led to ${repriced.at}, expected A17`);
if (!repriced.body.includes('the trees we counted')) live.push('A17: after the count it does not say the price comes from it');
await page.evaluate(() => document.querySelector('#app .actiondock .btn--primary')?.click());
await page.waitForTimeout(140);
await press('#app button', 'Subscribe');
await page.waitForTimeout(160);
const confirmed = await page.evaluate((id) => wafra.state.db.farms.find((f) => f.id === id)?.count?.state, made.farmId);
if (confirmed !== 'confirmed') live.push(`A17: paying after the count left it "${confirmed}", expected "confirmed"`);

// B9 — Farm settings' "Add fields": the same drawing screen, adding to a farm
// that already exists.
const plotsBefore = await page.evaluate(() => wafra.sel.plotsOf('farm-3').length);
await page.evaluate(() => { wafra.state.nav.mode = 'app'; wafra.jump('B11:farm-3'); });
await page.waitForTimeout(60);
await page.evaluate(() => wafra.startDrawPlot('farm-3'));
await page.waitForTimeout(80);
const b9 = await read();
if (!b9.at.includes('B9')) live.push(`startDrawPlot(): opened ${b9.at}, expected B9`);
if (!b9.sub.includes('Al Kharj South')) live.push('B9: the drawer does not carry the farm name');
if (!b9.dock.includes('Add these fields')) live.push(`B9: the drawer reads "${b9.dock}", expected "Add these fields"`);
await tool('Draw a field');
await page.waitForTimeout(60);
await press('#app .drawer .btn', 'Done');
await page.waitForTimeout(80);
await press('.overlay .sheet .row', 'Barley');
await page.waitForTimeout(80);
await press('#app .drawer .btn', 'Add these fields');
await page.waitForTimeout(100);
const added = await page.evaluate(() => ({ at: location.hash, plots: wafra.sel.plotsOf('farm-3').length }));
if (added.plots !== plotsBefore + 1) live.push(`B9: Add these fields left farm-3 with ${added.plots} plots, expected ${plotsBefore + 1}`);
if (added.at.includes('B9')) live.push(`B9: Add these fields stayed on ${added.at}`);
await page.evaluate(() => { wafra.resetLocal('signup'); });

// The search bar is a text field sitting on top of a map that redraws on every
// keystroke, which is the one place in the app where losing the caret would be
// easy and invisible — the sheet it replaced had no such problem.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A13'); });
await page.waitForTimeout(80);
await page.click('#app [data-field="placesearch"]');
await page.type('#app [data-field="placesearch"]', 'Al Kharj', { delay: 6 });
await page.waitForTimeout(60);
const search = await page.evaluate(() => ({
  field: document.activeElement?.dataset?.field,
  value: document.activeElement?.value,
  caret: document.activeElement?.selectionStart,
}));
if (search.field !== 'placesearch') live.push('A13: the map search lost focus while typing');
if (search.value !== 'Al Kharj') live.push(`A13: the map search lost characters ("${search.value}")`);
if (search.caret !== 8) live.push(`A13: the caret jumped in the map search (${search.caret})`);
await page.evaluate(() => wafra.resetLocal('signup'));

// B4, the last long-form typing screen in the app now that E6 has gone with the
// observation capture. A textarea re-created mid-render loses the caret, and a
// notes field is where that is most expensive.
await page.evaluate(() => { wafra.resetLocal('b6-plot-13-new'); wafra.jump('B4:plot-13'); });
await page.waitForTimeout(80);
await page.click('#app textarea.textarea');
await page.type('#app textarea.textarea', 'Sown after the barley', { delay: 5 });
const b6 = await page.evaluate(() => ({
  focused: document.activeElement?.tagName === 'TEXTAREA',
  note: document.activeElement?.value,
}));
if (!b6.focused || b6.note !== 'Sown after the barley') live.push(`B4: the notes field lost focus or characters ("${b6.note}")`);

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
const b4 = await textAt('B2:plot-15');
/* Review 21/09 moved these two titles INSIDE their cards — "it's not clear the
   two are linked; make it one combined box" — so they are no longer section
   rules in small caps. Matched case-insensitively, and the case itself is
   asserted below, because a title that drifts back out to a section head is
   exactly the regression this note is about. */
if (!/growth stage/i.test(b4)) live.push('B2: the growth stage block is not on the plot screen');
if (b4.includes('GROWTH STAGE')) live.push('B2: growth stage is a section rule again, not a title inside its card');
if (!/Your plot, to today[\s\S]*Expected/.test(b4)) live.push('B2: the growth stage is not a line chart of expected against today');
if (!/(ahead|behind|On track)/.test(b4)) live.push('B2: the growth stage block gives no verdict against the expected pace');
// v1.7.3 — the three boxes, in this order, with the disease & pest box last.
if (!/Irrigation[\s\S]*Fertilisation[\s\S]*Disease & pest/.test(b4)) live.push('B2: the irrigation, fertilisation and disease & pest boxes are missing or out of order');
if (/disease and pest risk/i.test(b4)) live.push('B2: the disease & pest box is called "risk" again');
// The trend and the score are one box now, and the axis is the crop cycle.
if (!/wk 1/i.test(b4)) live.push('B2: the trend axis is not in weeks of the crop cycle');
if (/\bMar\b.*\bAug\b/.test(b4)) live.push('B2: the trend axis is still six fixed month names');
if (!/target/i.test(b4)) live.push('B2: the trend chart has no target reference line');
if (b4.includes('TREND')) live.push('B2: the trend is a section of its own again, not merged with the health score');
// "'Advices' should be singular — 'Advice' — and probably lowercase."
if (b4.includes('Advices')) live.push('B2: the advice button is still plural');
if (/advice for this plot/i.test(b4)) live.push('B2: the single advice box is back');
if (!/(Action required|Inspect and report back|Monitor|No action)/.test(b4)) live.push('B2: the disease & pest box gives no action word');
if (/Scorecard/.test(b4) === false) live.push('B2: the scorecard is not called Scorecard');
if (/See advice/.test(b4)) live.push('B2: the See advice button is back');
if (/Red palm weevil/.test(b4)) live.push('B2: a wheat plot is being warned about a date palm pest');

// 407 / 801 — the same heat on the season bar, and the forecast as a band.
const b5 = await textAt('B3:plot-15');
if (!/growing degree days/.test(b5)) live.push('B3: the season bar carries no heat accumulation beside its days');
if (!b5.includes('Harvest forecast')) live.push('B3: there is no yield forecast');
if (!/\d+(\.\d+)?–\d+(\.\d+)?\s*t\/ha/.test(b5)) live.push('B3: the yield forecast is not a range');

// 406 / 602 — the sum behind the volume, and the feed that goes in with it.
// They are the plot's schedule since v1.7.2 (B12); D2 is a one-shot fix.
const b12 = await textAt('B12:tg-01');
// v1.7.3 took the ET sum and the system block off it.
if (b12.includes('Why this much water')) live.push('B12: "Why this much water" is back');
if (/flow rate|Your irrigation system|minutes/i.test(b12)) live.push('B12: the irrigation system, flow rate or minutes are back');
if (!b12.includes('Fertilisers needed')) live.push('B12: a drip-irrigated plot is given no fertilisers');
if (!/waterings/.test(b12)) live.push('B12: the schedule does not list the week’s waterings');
const d2 = await textAt('D2:adv-01');
if (/This week’s weather conditions|Feed with this water/.test(d2)) live.push('D2: the irrigation advice is carrying the weekly schedule again');
if (!/short of water|too much water/.test(d2)) live.push('D2: the irrigation advice does not say what is wrong with the water');

/* 701 — THE WAY IN, AND WHERE IT MUST NOT BE.

   The photo check spent one round at the top of the advice inbox and the
   review sent it to the More menu: D1 is a worklist — everything on it arrived
   from the model, is screened by four filters and is cleared as it is dealt
   with — and a button that starts something new pushed the grouping and the
   sort control below the fold on the screen the farmer opens most.

   Both halves are asserted, because the second is the one that will be
   forgotten: the row has to be in More, and the inbox has to stay as it was. */
const f0 = await textAt('F1');
if (!f0.includes('Plant diagnosis')) live.push('F1: there is no way into the plant diagnosis');
const d1 = await textAt('D1');
if (/RAISED BY THE FORECAST/.test(d1)) live.push('D1: the inbox has grown back a section that was moved off it');
/* ONE FILTER BAR, PLOTS AND TREES IN THE APP BAR, AND THE PHOTO CHECK
   FLOATING (v1.7.4) — "there's barely any space left for actual advice".

   What the shape promises and what would quietly rot:
     - the bar names every choice, in full, at both ends of the range of
       phones — 390 dp is what the deck prints, 360 is WF2.002's acceptance
       size — wrapping rather than cutting a word off, to three lines at most;
     - the funnel counts the filters that are on;
     - its end button clears all four, the farm included, which is the one a
       reset forgets;
     - the sheet behind it holds every filter and the sort. */
if (!d1.includes('All farms · All advice')) live.push('D1: the filter bar does not say the list is unfiltered');
if (!d1.includes('Sorted by')) live.push('D1: the filter bar does not say how the list is sorted');
if (!d1.includes('Plant diagnosis')) live.push('D1: the plant diagnosis button is missing, or has lost its label');
const farmForFilter = await page.evaluate(() => wafra.state.db.farms[0].id);
const farmName = await page.evaluate(() => wafra.state.db.farms[0].name);
const measureFilters = () => page.evaluate(() => {
  const app = document.querySelector('#app');
  const what = document.querySelector('#app .filterbar__what');
  return {
    bar: !!document.querySelector('#app .filterbar'),
    tabs: [...document.querySelectorAll('#app .appbar .segmented__seg')].map((el) => el.textContent).join(),
    count: Number(document.querySelector('#app .filterbar__count')?.textContent ?? 0),
    text: what?.textContent ?? '',
    clipped: what ? what.scrollHeight > what.clientHeight + 1 : false,
    lines: what ? Math.round(what.clientHeight / parseFloat(getComputedStyle(what).lineHeight)) : 0,
    fab: !!document.querySelector('#app .fabpill'),
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
  const f = await measureFilters();
  const at = `D1 at ${dev}`;
  if (!f.bar) live.push(`${at}: there is no filter bar`);
  if (f.tabs !== 'Plots,Trees') live.push(`${at}: the app bar's tabs read "${f.tabs}", expected Plots and Trees`);
  if (f.count !== 4) live.push(`${at}: the funnel counts ${f.count} filters, expected 4`);
  for (const word of [farmName, 'Watch', 'Crop protection', 'Completed']) {
    if (!f.text.includes(word)) live.push(`${at}: the filter bar does not name "${word}" — it reads "${f.text}"`);
  }
  if (f.clipped) live.push(`${at}: the filter bar cuts its words off — "${f.text}"`);
  if (f.lines > 3) live.push(`${at}: the filter bar runs to ${f.lines} lines`);
  if (!f.fab) live.push(`${at}: the plant diagnosis button is not floating over the list`);
  if (f.overflow > 0) live.push(`${at}: the screen scrolls sideways by ${f.overflow}px`);
}
await page.evaluate(() => { wafra.state.device.presetId = 'iphone-14'; wafra.commit('t'); });

// The end button puts all four back, the farm included.
await page.evaluate(() => { document.querySelector('#app .filterbar__end').click(); });
await page.waitForTimeout(160);
const cleared = await measureFilters();
if (cleared.count !== 0) live.push(`D1: clearing left ${cleared.count} filters on`);
if (await page.evaluate(() => wafra.state.ui.farmFilter) !== 'all') live.push('D1: clearing left the farm filter set — the one a reset forgets');

/* THE SHEET: every filter and the sort, each choice changing the list at
   once, and the full name of each kind of advice. */
await page.evaluate(() => document.querySelector('#app .filterbar__open').click());
await page.waitForTimeout(120);
const filterSheet = await page.evaluate(() => document.querySelector('.sheet')?.textContent ?? '');
for (const word of ['All farms', 'Severity', 'Crop protection', 'Fertilisation', 'Status', 'Sort by']) {
  if (!filterSheet.includes(word)) live.push(`D1: the filter sheet does not offer "${word}"`);
}
await page.evaluate(() => [...document.querySelectorAll('.sheet .chip')].find((c) => c.textContent.trim() === 'Urgent')?.click());
await page.waitForTimeout(80);
if (await page.evaluate(() => wafra.state.session.adviceFilters.severity) !== 'urgent') live.push('D1: a chip in the filter sheet did not change the filter');
await page.evaluate(() => [...document.querySelectorAll('.sheet .btn')].find((b) => b.textContent.includes('Clear all'))?.click());
await page.evaluate(() => { wafra.closeOverlay(); wafra.commit('t'); });

/* THE DECK'S ANNOTATION BOX FOR D1 IS GONE — review 16/09, see REVIEW_NOTES in
   app/screens/index.js. The check that used to live here held the box's wording
   against the screen's, after one of them drifted into calling Status
   "Progress"; there is no second wording to drift now, so the check went with
   the box rather than being left to pass on an empty string. */

// 701 — capture, then result, then the entry it hands on to.
const d5 = await textAt('D5');
if (!d5.includes('Fill the frame')) live.push('D5: the capture screen gives no framing guidance');
const d5r = await textAt('D6:leaf');
if (!/(Likely|Possible) match/.test(d5r)) live.push('D6: the result does not say how sure it is');
if (/% match/.test(d5r)) live.push('D6: the result prints a percentage for a disease again');
if (!/it could also be/i.test(d5r)) live.push('D6: the result offers no second candidate');

// 703 / 505 — the two directories, and the cross-link that is the reason they
// shipped together.
const f17d = await textAt('F16:red-palm-weevil');
if (!f17d.includes('Pre-harvest interval')) live.push('F16: a disease entry does not carry its pre-harvest interval');
if (!/Date Palm/i.test(f17d)) live.push('F16: a disease entry does not name the crops it affects');
const f16d = await textAt('F14:date-palm');
if (!/Red palm weevil/.test(f16d)) live.push('F14: a crop page does not link to the problems that name it');

// 504 / 902 — the two farm-level views.
const b15 = await textAt('B7:farm-3');
if (!/Plot 1/.test(b15)) live.push('B7: the planner lists no plots');
const b16 = await textAt('B8:farm-3');
if (!/twelve months/i.test(b16)) live.push('B8: the progress screen does not say what period it covers');
if (!/average across plots/i.test(b16)) live.push('B8: the progress screen does not qualify its farm average');

// v1.7.2 — the metric is picked on the map, and efficiency is the plot's.
const c2 = await textAt('C2');
if (/Monitoring layer/i.test(c2)) live.push('C2: the monitoring layer list is back');
if (c2.includes('Irrigation efficiency')) live.push('C2: the irrigation efficiency layer is back');

// 606 / 803 — the two reports that carry real content rather than a skeleton.
await page.evaluate(() => wafra.jump('F3:farm-3'));
await page.waitForTimeout(140);
const reports = await page.evaluate(() => {
  // The overlay shape is the router's own: kind, view, params.
  wafra.state.ui.overlay = { kind: 'sheet', view: 'REPORT', params: { reportId: 'irrigation', custom: true } };
  wafra.commit('t');
  return { list: document.querySelector('#app')?.innerText ?? '' };
});
if (!reports.list.includes('Nutrient reports and analysis')) live.push('F3: the nutrient report is not offered');
await page.waitForTimeout(120);
const irrigationReport = await page.evaluate(() => document.querySelector('.overlay')?.textContent ?? '');
if (!irrigationReport.includes('advised against applied')) live.push('F3: the irrigation report is still a placeholder');
await page.evaluate(() => { wafra.state.ui.overlay = null; wafra.commit('t'); });

// 406 — the farm's own week of demand.
const f15 = await textAt('F4:farm-1');
if (!/EVAPOTRANSPIRATION \(MM\)/i.test(f15)) live.push('F4: the week of evapotranspiration is missing');

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
/* One tile per FILING, not per screen. A20 is in First run and in Log in, and it
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
const EXTRA_STATES = ['FORGOT:password', 'A9:login', 'A9:reset'];
for (const s of screens) {
  await page.evaluate((route) => wafra.jump(route), s.route);
  await page.waitForTimeout(10);
}
for (const route of EXTRA_STATES) {
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(10);
}

/* A17's OTHER BILLING PERIOD, which is not a route and so cannot be an
   EXTRA_STATE. Since review 21/09's third pass the monthly page is a state of
   A17 rather than a screen of its own, and the walk above only ever sees the
   default, which is annual — so "Pro · Monthly" on the store sheet reached the
   translators only by accident of which page rendered first. The segment is
   pressed here, both screens are walked again, and it is put back so nothing
   after this runs against a period the rest of the file did not choose. */
const pressPeriod = async (label) => {
  await page.evaluate((want) => wafra.jump(want), 'A17');
  await page.waitForTimeout(30);
  await page.evaluate((want) => {
    [...document.querySelectorAll('#app .segmented__seg')]
      .find((b) => b.textContent.trim() === want)?.click();
  }, label);
  await page.waitForTimeout(40);
};
await pressPeriod('Monthly');
await page.evaluate(() => wafra.jump('A18'));
await page.waitForTimeout(30);
await pressPeriod('Annual');

/* B9's SEARCH CONFIRMATION, which is a toast and so only exists once it has
   been raised. A13 used to raise the same one and stopped at review 21/09's
   fourth pass — it has a pin and a line under the map now, and the badge landed
   on top of them — which left `map.centred` reachable from one screen the walk
   never types into, and the key dropped out of the catalogue without a single
   string being deleted. Typing here puts it back. */
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('B9'); });
await page.waitForTimeout(40);
await page.evaluate(() => {
  const field = document.querySelector('#app [data-field="placesearch"]');
  if (!field) return;
  field.value = 'Al Kharj';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(40);
await page.evaluate(() => wafra.resetLocal('signup'));

const catalogue = await page.evaluate(() => Object.fromEntries(wafra.catalogue()));

// One key, two English strings. The catalogue keeps whichever rendered first,
// so the second screen shows a wording no translator was ever given — and the
// dump looks perfectly healthy either way. This is the only place it can be
// seen, because it takes a run that has drawn every screen to find it.
//
// The check arrived with the 22/08 review, which turned one of these up the
// hard way: deleting A16's toolbar handed `a11.join` to the shape menu, and
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
  'c1.search', 'unit.ha',
]);
// A farm's headline and blocked-imagery reason are content keys per farm id
// (localise.js), and unlike a farm's NAME they are not meant to hold one
// string for the farm's whole life — addFarm(), markCountReady() and
// confirmCount() each set a different one as the farm moves through its
// tree count. The live-validation walk above is the first run of this test to
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

/* AND EVERY LITERAL t() IN THE SOURCE. The walk only registers what the states
   it reaches happen to draw, and a string shown only by a sort order, an
   under-watering plot or a record written mid-session never reaches the
   translators — D1's "Today" heading was one. So every call written as
   t('key', 'English') is read off the source as well; a key built at run time
   still needs the walk. The walk wins where both have it. */
async function literalKeys(dir) {
  const found = {};
  const CALL = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1\s*,\s*(['"])((?:\\.|(?!\3)[^\\\n])*)\3/g;
  const unquote = (q, body) => JSON.parse(`"${(q === "'" ? body.replace(/\\'/g, "'").replace(/(^|[^\\])"/g, '$1\\"') : body)}"`);
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const path = join(entry.parentPath, entry.name);
    if (path.includes(`${join('app', 'i18n')}`)) continue;
    // Comments carry examples — t('x', 'Due in {n} days') — that are not strings.
    const code = (await readFile(path, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(CALL)) found[unquote(m[1], m[2])] ??= unquote(m[3], m[4]);
  }
  return found;
}
for (const [key, en] of Object.entries(await literalKeys(join(ROOT, 'app')))) catalogue[key] ??= en;

if (dumpAt) {
  const sorted = Object.fromEntries(Object.entries(catalogue).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(dumpAt, JSON.stringify(sorted, null, 1));
  console.log(`catalogue: ${Object.keys(catalogue).length} keys → ${dumpAt}`);
}

/* THE EXHIBITION EDITION (app/core/edition.js). One folder down, signed in,
   in Arabic, with no first run: no A screen may be reachable by any door, and
   everything it loads — the satellite pictures included — must resolve from
   expo/ to the one copy at the root. */
{
  const before = problems.length;
  const expo = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  expo.on('console', (msg) => { if (msg.type() === 'error') problems.push(`expo console: ${msg.text()}`); });
  expo.on('pageerror', (err) => problems.push(`expo pageerror: ${err.message}`));
  expo.on('response', (res) => { if (res.status() >= 400) problems.push(`expo: ${res.status()} ${res.url()}`); });
  await expo.goto(`${base}expo/`, { waitUntil: 'networkidle' });
  await expo.waitForFunction(() => !!globalThis.wafra);
  const seen = await expo.evaluate(async () => {
    const out = { mode: wafra.state.nav.mode, lang: wafra.state.session.lang, view: location.hash };
    wafra.jump('A1');
    wafra.go('A20');
    out.afterA = wafra.state.nav.mode;
    wafra.jump('F1');
    out.logout = !!document.querySelector('#app .btn--ghost') && /Log out|خروج/.test(document.getElementById('app').textContent);
    // The vendored photograph, on C4's compare map. Not C1's, B1's or a
    // plot's: those maps are live tiles (ui/livemap.js), with no photograph.
    wafra.jump('C4');
    await new Promise((r) => setTimeout(r, 300));
    const href = document.querySelector('#app image')?.getAttribute('href');
    out.imagery = href ? await fetch(href).then((r) => r.ok, () => false) : false;
    // And C1's live map: Leaflet is imported relative to the module, so it
    // must load from expo/ as it does from the root.
    wafra.jump('C1');
    await new Promise((r) => setTimeout(r, 1500));
    out.liveMap = !!document.querySelector('#app .livemap.leaflet-container svg.leaflet-image-layer');
    return out;
  });
  if (seen.mode !== 'app' || !seen.view.startsWith('#/home/B1')) problems.push(`expo: opens on ${seen.mode} ${seen.view}, not signed in on B1`);
  if (seen.lang !== 'en') problems.push(`expo: opens in ${seen.lang}, not English`);
  if (seen.afterA !== 'app') problems.push('expo: an A route was reachable');
  if (seen.logout) problems.push('expo: F1 offers Log out, and there is no log-in screen to land on');
  if (!seen.imagery) problems.push('expo: the satellite imagery does not resolve from expo/');
  if (!seen.liveMap) problems.push('expo: C1 has no live map with its plots over it');
  await expo.close();
  if (problems.length > before) problems.push('  ↳ while checking the exhibition edition');
  else console.log('expo edition: signed in, English, no A screens, imagery resolves');
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
