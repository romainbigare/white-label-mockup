/* ---------------------------------------------------------------------------
   onboarding.js — chapter 4: A1 … A15, login and recovery.

   The shape of this flow is the shape of §4.1: registration creates an IDENTITY,
   not a role (WF-100). A6 routes; it does not assign privileges (WF-124). So the
   role is set at exactly two points in this file — enterApp('owner') after a farm
   is created (WF-101), and enterApp(invitation.role) after a join (WF-102).
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local, resetLocal } from '../core/local.js';
import { t, LANGUAGES, setLanguage, langMeta } from '../core/i18n.js';
import { go, back, enterApp, enterOnboarding, openModal, openSheet, resetStack } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { logo } from '../ui/brand.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, field,
  input, select, checkbox, radioList, disclaimer, statusChip, emptyState, req, kv,
} from '../ui/components.js';
import { area, price, priceBare, num, date, NOW } from '../core/format.js';
import { boundaryCanvas, undoVertex, starterPolygon, polygonAreaHa, selfIntersection } from '../ui/boundaryEditor.js';
import { mapSvg, landUseSvg } from '../ui/map.js';
import { addFarm, confirmSurvey } from '../data/actions.js';
import { surveyTotals, LAND_USE, LAND_USE_META } from '../data/survey.js';
import { farmById, rawFarm } from '../data/selectors.js';
import { PLANS, offeredFamily } from '../core/entitlements.js';

/* The draft an owner builds across A7 → A13. One object, one flow. */
const draft = () => local('signup', {
  country: 'SA', phone: '', agreed: false, code: '',
  name: '', email: '', password: '', showPassword: false,
  grows: null, farmName: '', farmType: null, irrigation: 'Drip', soil: '',
  points: [], plan: null, welcomeCard: 0, attempts: 0,
});

/* -- A1 · Language picker ------------------------------------------------- */

export function A1() {
  return {
    tabs: false,
    body: h('div.page', { style: { paddingTop: 'calc(var(--safe-top) + 24px)', gap: '20px' } },
      logoBlock(),
      h('div', { style: { textAlign: 'center' } },
        h('h1', { style: { fontSize: 'var(--t-title)', margin: '0 0 2px' } }, t('a1.title', 'Choose your language')),
        // WF-109 — the prompt repeats in Arabic beneath, so an Arabic speaker
        // can find it without already reading English.
        h('p', { style: { margin: 0, fontSize: 'var(--t-body)', color: 'var(--ink-500)' }, dir: 'rtl' }, 'اختر لغتك')),
      card({}, LANGUAGES.map((lang) => h('button.row', {
        onclick: () => setLanguage(lang.code),          // WF-111 — mirrors immediately
      },
      h('div.row__main',
        h('div.row__title', { style: { fontSize: 'var(--t-lead)' }, dir: lang.dir }, lang.native),
        h('div.row__sub', lang.english + (lang.dir === 'rtl' ? ' · RTL' : ''))),
      when(lang.code === state.session.lang, () => h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('check', 22)))))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        t('a1.later', 'You can change this later in Settings.'), req('WF-112'))),
    dock: actionDock(btn(t('action.continue', 'Continue'), { variant: 'primary', onclick: () => go('A2') })),
  };
}

/* The full lockup, on the only two screens with room for it. It carries the
   name in both scripts, so there is no caption underneath to translate. */
function logoBlock() {
  return h('div', { style: { display: 'flex', justifyContent: 'center', padding: '10px 0 6px' } },
    logo('lockup', 60));
}

/* -- A2 · Welcome, WF-113 ------------------------------------------------- */

const WELCOME = [
  { icon: 'map', headline: 'See your farm from space', body: 'Satellite images show you where your crop is stressed, before you can see it walking the field.' },
  { icon: 'advice', headline: 'Know what to do', body: 'Get irrigation, nutrition and pest advice for your crops, in your language.' },
  { icon: 'users', headline: 'Work as a team', body: 'Send jobs to your workers and see them done, with photos.' },
];

export function A2() {
  const d = draft();
  const cardIndex = d.welcomeCard;
  const c = WELCOME[cardIndex];
  const next = () => {
    if (cardIndex < WELCOME.length - 1) { d.welcomeCard += 1; commit('a2'); }
    else go('A3');
  };
  return {
    tabs: false,
    top: h('div.app__top', h('div.appbar',
      h('div.appbar__spacer'),
      h('button.iconbtn', { onclick: () => go('A3'), style: { minWidth: 'auto', padding: '0 14px' } },
        h('span', { style: { fontWeight: 650 } }, t('action.skip', 'Skip'))))),   // WF-113 — skippable from every card
    body: h('div.page', { style: { gap: '22px', textAlign: 'center', alignItems: 'center' } },
      h('div', {
        style: {
          width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(160deg, var(--brand-100), var(--brand-050))',
          display: 'grid', placeItems: 'center', color: 'var(--brand-600)',
        },
      }, icon(c.icon, 92)),
      h('h1', { style: { fontSize: 'var(--t-head)', margin: 0 } }, t(`a2.${cardIndex}.h`, c.headline)),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '32ch' } }, t(`a2.${cardIndex}.b`, c.body)),
      h('div.dots', WELCOME.map((_, i) => h('span', i === cardIndex ? { 'data-on': '' } : {})))),
    dock: actionDock(btn(cardIndex < WELCOME.length - 1 ? t('action.next', 'Next') : t('action.start', 'Get started'),
      { variant: 'primary', onclick: next })),
  };
}

/* -- A3 · Sign up, WF-114 … WF-117 --------------------------------------- */

export function A3() {
  const d = draft();
  const countries = state.db.countries;
  const priority = countries.filter((c) => c.priority);   // WF-115 — GCC + Jordan on top
  const rest = countries.filter((c) => !c.priority);
  const dial = countries.find((c) => c.code === d.country)?.dial ?? '+966';

  return {
    tabs: false,
    top: appBar({ title: '', back: true, onBack: () => go('A2', { replace: true }) }),
    body: page(
      h('div',
        h('h1', { style: { fontSize: 'var(--t-head)', margin: '0 0 4px' } }, t('a3.title', 'Create your account')),
        h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('a3.sub', 'We will send you a code by SMS'))),
      field(t('a3.mobile', 'Mobile number'),
        h('div.inputgroup',
          select([...priority.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` })),
                  ...rest.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` }))],
            d.country, (v) => { d.country = v; commit('a3'); }, { style: { width: '112px' } }),
          input({
            type: 'tel', inputmode: 'tel', placeholder: '5X XXX XXXX', value: d.phone,
            oninput: (e) => { d.phone = e.target.value; },
            onchange: (e) => {
              // WF-116 — spaces and dashes normalise; a leading zero is stripped.
              d.phone = e.target.value.replace(/[\s-]/g, '').replace(/^0+/, '');
              commit('a3');
            },
          })),
        { required: true, hint: t('a3.hint', 'Spaces and dashes are fine. A leading zero is removed.') }),
      // WF-117 — unticked by default; Terms and Privacy open in-app.
      checkbox(h('span', t('a3.terms.pre', 'I agree to the '),
        link(t('a3.terms', 'Terms of Use'), () => openModal('LEGAL', { doc: 'terms' })),
        t('a3.and', ' and '),
        link(t('a3.privacy', 'Privacy Policy'), () => openModal('LEGAL', { doc: 'privacy' }))),
        d.agreed, (v) => { d.agreed = v; commit('a3'); }),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' } },
        h('div', { style: { fontSize: 'var(--t-meta)' } },
          t('a3.have', 'Already have an account? '), link(t('action.login', 'Log in'), () => go('LOGIN'))),
        h('div', { style: { fontSize: 'var(--t-meta)' } },
          t('a3.invited', 'Have an invitation? '), link(t('a14.title', 'Join a farm'), () => go('A14'))))),
    dock: actionDock(btn(t('a3.send', 'Send code'), {
      variant: 'primary',
      disabled: !d.agreed || d.phone.replace(/\D/g, '').length < 6,   // WF-117
      onclick: () => go('A4'),
    })),
  };
}

/* WF-004 — a link inside a sentence is still a target, so it gets a real box. */
function link(label, onclick) {
  return h('button.textlink', { onclick, type: 'button' }, label);
}

/* -- A4 · Verify code, WF-118 … WF-120 ----------------------------------- */

export function A4() {
  const d = draft();
  const digits = d.code.padEnd(6, ' ').split('');
  const locked = d.attempts >= 5;                              // WF-120

  const pressKey = (key) => {
    if (locked) return;
    if (key === 'del') d.code = d.code.slice(0, -1);
    else if (d.code.length < 6) d.code += key;
    commit('a4');
    // WF-118 — auto-submits at six digits.
    if (d.code.length === 6) {
      setTimeout(() => {
        if (d.code === '000000') { d.attempts += 1; d.code = ''; commit('a4'); return; }
        go('A5');
      }, 260);
    }
  };

  return {
    tabs: false,
    top: appBar({ title: t('a4.title', 'Enter your code') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a4.sent', 'We sent a 6-digit code to {phone}', { phone: `${state.db.countries.find((c) => c.code === d.country)?.dial} ${d.phone || '5X XXX XXXX'}` })),
      h('div.otp', digits.map((c, i) => h(`div.otp__cell${c.trim() ? '.otp__cell--filled' : ''}${i === d.code.length && !locked ? '.otp__cell--focus' : ''}`,
        { style: { display: 'grid', placeItems: 'center' } }, c.trim()))),
      when(locked, () => h('div',
        disclaimer(t('a4.locked', 'Too many attempts. Your account is locked for 15 minutes. You can contact Wafra for help.'), true),
        h('div', { style: { height: '10px' } }),
        btn(t('f13.title', 'Contact Wafra'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center' } },
        t('a4.valid', 'The code is valid for 10 minutes.'), req('WF-118')),
      h('div.keypad', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => (
        k === '' ? h('span') : h('button', { onclick: () => pressKey(k), disabled: locked },
          k === 'del' ? icon('back', 22, 'flip') : k)))),
      h('div', { style: { textAlign: 'center' } },
        // WF-119 — resend after 45 seconds, max 5 requests per hour.
        h('button.textlink', { onclick: () => toast(t('a4.resent', 'New code sent')) },
          t('a4.resend', 'Resend code (available in 45s)'))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        t('a4.mockhint', 'Mockup: any six digits continue. 000000 simulates a wrong code.'))),
  };
}

/* -- A5 · Your details, WF-121 … WF-123 ---------------------------------- */

export function A5() {
  const d = draft();
  const weak = d.password.length > 0 && d.password.length < 8;
  const common = ['password', '12345678', 'qwertyui'].includes(d.password.toLowerCase());

  return {
    tabs: false,
    top: appBar({ title: t('a5.title', 'Tell us about you') }),
    body: page(
      field(t('a5.name', 'Your name'), input({
        value: d.name, autocomplete: 'name',
        oninput: (e) => { d.name = e.target.value; },
        onchange: () => commit('a5'),
      }), { required: true }),
      field(t('a5.email', 'Email address (optional)'), input({
        type: 'email', value: d.email, autocomplete: 'email',
        oninput: (e) => { d.email = e.target.value; },
      }), { hint: t('a5.email.hint', 'We use this to send you reports') }),
      field(t('a5.password', 'Set a password'),
        h('div', { style: { position: 'relative' } },
          input({
            type: d.showPassword ? 'text' : 'password', value: d.password,
            oninput: (e) => { d.password = e.target.value; },
            onchange: () => commit('a5'),
            style: { paddingInlineEnd: '52px' },
          }),
          // WF-122 — a show/hide control on the password field.
          h('button.iconbtn', {
            onclick: () => { d.showPassword = !d.showPassword; commit('a5'); },
            'aria-label': t('a5.showpw', 'Show password'),
            style: { position: 'absolute', insetInlineEnd: '2px', top: '0' },
          }, icon(d.showPassword ? 'eyeOff' : 'eye', 21))),
        {
          required: true,
          hint: t('a5.password.hint', 'At least 8 characters'),
          error: common ? t('a5.password.common', 'That password is too common. Please choose another.')
            : weak ? t('a5.password.short', 'Passwords need at least 8 characters.') : null,
        }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('a5.workernote', 'Workers invited to a farm can sign in with an SMS code and do not need a password.'), req('WF-123'))),
    dock: actionDock(btn(t('action.continue', 'Continue'), {
      variant: 'primary',
      disabled: !d.name.trim() || d.password.length < 8 || common,
      onclick: () => go('A6'),
    })),
  };
}

/* -- A6 · How will you use the app? WF-124 … WF-129 ---------------------- */

export function A6() {
  return {
    tabs: false,
    top: appBar({ title: t('a6.title', 'How will you use the app?') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a6.sub', 'This only decides where you start. It does not lock anything.'), req('WF-124')),
      choiceCard('home', t('a6.own', 'I manage my own farm'), t('a6.own.sub', 'Set up your farms and invite your team'), () => go('A7')),
      choiceCard('check', t('a6.invited', 'I was invited to a farm'), t('a6.invited.sub', 'Enter your invitation code or scan the QR code'), () => go('A14')),
      choiceCard('grid', t('a6.tour', 'I just want to tour the app'), t('a6.tour.sub', 'Look around with example data. Nothing is saved.'), () => {
        state.session.demo = true;                     // WF-126
        state.session.role = 'owner';
        enterApp('owner');
      })),
  };
}

function choiceCard(iconName, title, sub, onclick) {
  return card({ onclick }, cardPad(
    h('div', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(iconName, 28)),
    h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650 } }, title),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, sub)));
}

/* -- A7 · What do you grow? WF-130 --------------------------------------- */

export function A7() {
  const d = draft();
  const pick = (value) => { d.grows = value; d.farmType = value; commit('a7'); go('A8'); };
  return {
    tabs: false,
    top: appBar({ title: t('a7.title', 'What do you grow?') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('a7.sub', 'You can change this later')),
      choiceCard('sprout', t('a7.crops', 'Field crops'), t('a7.crops.sub', 'Wheat, alfalfa, potato, vegetables, fodder'), () => pick('crops')),
      choiceCard('tree', t('a7.trees', 'Trees and orchards'), t('a7.trees.sub', 'Date palm, olive, citrus, mango, grapes'), () => pick('trees')),
      choiceCard('leaf', t('a7.both', 'Both'), t('a7.both.sub', 'You will be offered a combined plan'), () => pick('mixed'))),
  };
}

/* -- A8 · Add your first farm, WF-131 / §4.9 -----------------------------
   A fork, and the two routes carry equal weight. Drawing your own plots suits
   a farmer who already knows which fields he wants watched; the survey suits
   one whose land is a mixture of orchard, open field, sheds and a house, and
   who would rather be told what is there than trace nine outlines on a phone.

   The choice belongs to the FARM, not the account, and neither route is spent:
   a farmer who drew his plots can ask for a survey later from Farm settings,
   and a farmer who surveyed can still draw a plot by hand. */

export function A8() {
  return {
    tabs: false,
    top: appBar({ title: t('a8.title', 'Add your farm') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a8.lead', 'There are two ways to start. You can change your mind later.')),
      choiceCard('edit', t('a8.draw', 'Draw the plots I want monitored'),
        t('a8.draw.sub', 'Trace each field yourself. Best when you already know which land you want watched.'),
        () => { draft().route = 'plots'; go('A8D'); }),
      choiceCard('scan', t('a8.survey', 'Survey my whole farm'),
        t('a8.survey.sub', 'Draw one line around everything and we will find the fields, the orchards and the buildings inside it.'),
        () => { draft().route = 'survey'; go('A9'); }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('a8.note', 'Only farm owners and supervisors can add land.'), req('WF-131'))),
  };
}

/* -- A9 · Survey my whole farm, §4.9 ------------------------------------- */

export function A9() {
  const d = draft();
  if (!d.points.length) d.points = starterPolygon();
  const editor = boundaryCanvas({
    points: d.points,
    selected: d.selectedVertex,
    onChange: ({ selected }) => { d.selectedVertex = selected; commit('draw'); },
  });
  const areaHa = editor.areaHa;

  return {
    tabs: false,
    top: appBar({
      title: t('a9.title', 'Survey my whole farm'),
      actions: [barAction('undo', t('action.undo', 'Undo'), () => undoVertex(d.points), { disabled: !d.points.length })],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', minHeight: '220px', position: 'relative' } },
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),
        editor.node),
      h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--paper)' } },
        h('div', h('span.num', area(areaHa))),
        when(editor.invalid, () => disclaimer(
          t('a8d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('a9.help', 'Go around everything you own, buildings included. We will sort out what is what.')),
        field(t('a9.name', 'What do you call this farm?'),
          input({ value: d.farmName, placeholder: t('a9.name.ph', 'Home farm'), oninput: (e) => { d.farmName = e.target.value; } }),
          { required: true }))),
    dock: actionDock(btn(t('a9.start', 'Start the survey'), {
      variant: 'primary',
      disabled: d.points.length < 3 || editor.invalid || !d.farmName.trim(),
      onclick: () => {
        // No spinner and no waiting screen: the survey takes minutes to hours,
        // and a farmer standing in a field should not be asked to watch it.
        const farm = addFarm({ name: d.farmName.trim(), type: 'crops', areaHa, survey: 'surveying' });
        resetLocal('signup');
        enterApp('owner');
        toast(t('a9.started', 'Survey started for {name}. We will tell you when it is ready.', { name: farm.name }));
      },
    })),
  };
}

/* -- A10 · What we found, §4.9 -------------------------------------------
   The map is the argument. A list of nine polygons means nothing on its own,
   so the colours and the rows are the same three classes and are read
   together — tap a row, the map says which shape it is.

   Shapes cannot be redrawn here. Correcting a machine's outline with a finger
   on a phone is worse than the original error; the honest fix is to exclude
   the wrong shape and draw a plot by hand afterwards, and that is what the
   row offers. */

export function A10(farmId) {
  const farm = farmById(farmId);
  const ui = local(`a10-${farmId}`, { selected: null });
  const totals = surveyTotals(farm);
  const areas = totals.areas;

  const setDecision = (area, patch) => {
    const s = rawFarm(farm.id).survey ??= { state: 'ready', decisions: {} };
    s.decisions = s.decisions ?? {};
    s.decisions[area.id] = { kind: area.kind, included: area.included, ...patch };
    commit('a10');
  };

  return {
    tabs: false,
    top: appBar({ title: t('a10.title', 'What we found'), subtitle: farm.name }),
    body: page(
      h('div.mapbox', { style: { height: '230px', borderRadius: 'var(--radius)' } },
        landUseSvg({
          areas, selectedId: ui.selected,
          fills: Object.fromEntries(LAND_USE.map((k) => [k, LAND_USE_META[k].fill])),
          onTap: (a) => { ui.selected = a.id; commit('a10'); },
        })),

      // The map means nothing without this, and a legend under it is read once
      // and then remembered — better than repeating a colour word on every row.
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: '-4px' } },
        LAND_USE.map((kind) => h('span', {
          style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' },
        },
        h('span', {
          style: {
            width: '13px', height: '13px', borderRadius: '3px', flex: '0 0 auto',
            background: LAND_USE_META[kind].fill,
          },
        }),
        t(`landuse.${kind}.short`, LAND_USE_SHORT[kind])))),

      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a10.lead', 'We looked inside your boundary and found {n} areas. Tell us which ones we should watch.',
          { n: num(areas.length) })),

      LAND_USE.map((kind) => {
        const group = areas.filter((a) => a.kind === kind);
        if (!group.length) return null;
        return section(t(`landuse.${kind}`, LAND_USE_LABEL[kind]), {},
          h('p', { style: { margin: '0 0 2px', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t(`landuse.${kind}.note`, LAND_USE_NOTE[kind])),
          card({}, group.map((a) => areaRow(farm, a, ui, setDecision))));
      }),

      card({}, cardPad(
        h('div', { style: { fontWeight: 650 } }, t('a10.scope', 'What we will watch')),
        kv([
          [t('a10.croparea', 'Open field crops'), area(totals.cropHa)],
          [t('a10.treearea', 'Trees'), totals.treeCount
            ? `${area(totals.treeHa, { bare: true })} · ${t('farm.treecount', '{n} trees', { n: num(totals.treeCount) })}`
            : t('a10.none', 'None')],
          [t('a10.excluded', 'Left out'), area(totals.excludedHa)],
        ]))),

      disclaimer(t('a10.redraw', 'We cannot reshape an area we found. If an outline is wrong, leave it out and draw that plot yourself afterwards.'))),

    dock: actionDock(btn(t('a10.confirm', 'Confirm and see the price'), {
      variant: 'primary',
      disabled: totals.cropHa === 0 && totals.treeCount === 0,
      onclick: () => { confirmSurvey(farm.id); go(`A12:${farm.id}`); },
    })),
  };
}

const LAND_USE_LABEL = {
  crops: 'Open field crops',
  trees: 'Date palms and fruit trees',
  structures: 'Covered agriculture and structures',
};

const LAND_USE_SHORT = {
  crops: 'Open field',
  trees: 'Trees',
  structures: 'Buildings',
};

const LAND_USE_NOTE = {
  crops: 'Fallow land counts — it is still land we can watch.',
  trees: 'Olive trees are surveyed separately.',
  structures: 'Greenhouses, housing, warehouses. Left out unless you say otherwise.',
};

function areaRow(farm, a, ui, setDecision) {
  const meta = LAND_USE_META[a.kind];
  return h(`div.row${ui.selected === a.id ? '.row--sel' : ''}`, {
    style: { alignItems: 'flex-start', flexWrap: 'wrap', rowGap: '8px' },
  },
  h('span', { style: { color: meta.fill, display: 'flex', paddingTop: '2px' } }, icon(meta.icon, 21)),
  h('div.row__main',
    h('div.row__title', a.label),
    h('div.row__sub', a.kind === 'trees' && a.treeCount
      ? `${area(a.areaHa, { bare: true })} · ${t('farm.treecount', '{n} trees', { n: num(a.treeCount) })}`
      : area(a.areaHa, { bare: true }))),
  h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
    when(!a.included, () => h('span.status.status--nodata', icon('close', 14), t('a10.out', 'Left out'))),
    h('button.textlink', {
      style: { fontWeight: 600, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' },
      onclick: () => setDecision(a, { included: !a.included }),
    }, a.included ? t('a10.exclude', 'Leave out') : t('a10.include', 'Put back')),
    h('button.iconbtn.iconbtn--bare', {
      onclick: () => openSheet('RECLASSIFY', { farmId: farm.id, areaId: a.id }),
      'aria-label': t('a10.reclass', 'Change what this is'),
      title: t('a10.reclass', 'Change what this is'),
    }, icon('dots', 22))));
}

/* -- A8 · Draw your boundary, WF-132 … WF-138 ---------------------------- */

export function A8D() {
  const d = draft();
  if (!d.points.length) d.points = starterPolygon();
  const editor = boundaryCanvas({
    points: d.points,
    selected: d.selectedVertex,
    onChange: ({ selected }) => { d.selectedVertex = selected; commit('draw'); },
  });
  const areaHa = editor.areaHa;
  const tooSmall = areaHa > 0 && areaHa < 0.1;                 // WF-138
  const tooBig = areaHa > 10000;

  return {
    tabs: false,
    top: appBar({
      title: t('a8d.title', 'Draw your boundary'),
      actions: [
        barAction('undo', t('action.undo', 'Undo'), () => undoVertex(d.points), { disabled: !d.points.length }),
        barAction('trash', t('action.clearall', 'Clear'), () => openModal('CONFIRM', {
          title: t('a8d.clear.title', 'Clear all corners?'),
          body: t('a8d.clear.body', 'This removes every corner you have placed. The map stays where it is.'),
          confirmLabel: t('action.clearall', 'Clear'),
          onConfirm: () => { d.points.length = 0; commit('draw'); },
        })),
      ],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', minHeight: '260px', position: 'relative' } },
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),   // WF-133 — satellite by default
        editor.node,
        h('button.mapchip.mapchip--square', {
          style: { position: 'absolute', insetInlineEnd: '12px', bottom: '12px' },
          onclick: () => toast(t('a8d.located', 'Centred on your position')),
        }, icon('locate', 19), t('map.locate', 'Locate'))),
      h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--paper)' } },
        h('div',
          h('span.num', area(areaHa)),                          // WF-134
          req('WF-134')),
        when(editor.invalid, () => disclaimer(
          t('a8d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        when(tooSmall, () => disclaimer(t('a8d.small', 'That is smaller than 0.1 ha. You can still save it — just checking it is right.'))),
        when(tooBig, () => disclaimer(t('a8d.big', 'That is larger than 10,000 ha. You can still save it — just checking it is right.'))),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('a8d.help', 'Tap the map to place corners. Drag a corner to move it.')))),
    dock: actionDock(btn(t('action.done', 'Done'), {
      variant: 'primary',
      disabled: d.points.length < 3 || editor.invalid,
      onclick: () => {
        d.areaHa = areaHa;
        if (tooSmall || tooBig) {
          openModal('CONFIRM', {
            title: t('a8d.confirm.title', 'Is that the right size?'),
            body: tooSmall
              ? t('a8d.confirm.small', 'This boundary is under 0.1 hectares. If that is correct, carry on.')
              : t('a8d.confirm.big', 'This boundary is over 10,000 hectares. If that is correct, carry on.'),
            confirmLabel: t('action.continue', 'Continue'),
            onConfirm: () => go('A11'),
          });
        } else go('A11');
      },
    })),
  };
}

/* -- A11 · Farm details, WF-139 … WF-141 --------------------------------- */

const IRRIGATION = ['Drip', 'Centre pivot', 'Sprinkler', 'Bubbler', 'Flood/furrow', 'Other', 'Not sure'];
const SOILS = ['', 'Sandy', 'Sandy loam', 'Loam', 'Clay loam', 'Clay', 'Silt loam', 'Not sure'];

export function A11() {
  const d = draft();
  return {
    tabs: false,
    top: appBar({ title: t('a11.title', 'Farm details') }),
    body: page(
      field(t('a11.name', 'Farm name'), input({
        value: d.farmName, placeholder: 'Al Kharj North',
        oninput: (e) => { d.farmName = e.target.value; },
        onchange: () => commit('a11'),
      }), { required: true }),
      field(t('a11.what', 'What is on this land?'),
        radioList([
          { id: 'crops', label: t('a7.crops', 'Field crops') },
          { id: 'trees', label: t('a7.trees', 'Trees and orchards') },
          { id: 'mixed', label: t('a7.both', 'Both') },
        ], d.farmType, (v) => { d.farmType = v; commit('a11'); }), { required: true }),
      // WF-148 — a mixed farm requires a combined plan, and the app says so here.
      when(d.farmType === 'mixed', () => disclaimer(
        t('a11.mixed', 'A farm with both crops and trees needs a Complete plan. We will show you those next.'))),
      field(t('a11.irrigation', 'Irrigation system'),
        select(IRRIGATION.map((v) => ({ value: v, label: v })), d.irrigation, (v) => { d.irrigation = v; commit('a11'); }),
        { hint: t('a11.irrigation.hint', '“Not sure” is a valid answer and blocks nothing.') }),
      field(t('a11.soil', 'Soil type'),
        select(SOILS.map((v) => ({ value: v, label: v || t('a11.soil.blank', 'Leave blank') })), d.soil,
          (v) => { d.soil = v; commit('a11'); }),
        { hint: t('a11.soil.hint', 'Not sure? We will estimate it from the soil layer and you can correct it.') }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('a11.optional', 'Only the name and the type are needed. Everything else can wait.'), req('WF-139'))),
    dock: actionDock(btn(t('a11.save', 'Save farm'), {
      variant: 'primary',
      disabled: !d.farmName.trim() || !d.farmType,
      onclick: () => go('A12'),
    })),
  };
}

/* -- A12 · Choose your plan, WF-142 … WF-151 ----------------------------- */

const PLAN_COPY = {
  crop: [
    { key: 'crop_basic', name: 'Basic', usd: 39, blurb: 'Satellite health monitoring, weather, farm diary, scouting' },
    { key: 'crop_pro', name: 'Pro', usd: 79, popular: true, blurb: 'Everything in Basic, plus fertiliser insights, disease forecasting, 14-day weather, advanced maps, expert advice' },
    { key: 'crop_advanced', name: 'Advanced', usd: 139, blurb: 'Everything in Pro, plus irrigation scheduling, 1 m imagery, yield comparison, photo disease detection, custom alerts, Agro Doctor' },
  ],
  tree: [
    { key: 'tree_basic', name: 'Basic', usd: 45, blurb: 'Tree mapping and counting, health, water stress, orchard planner' },
    { key: 'tree_pro', name: 'Pro', usd: 99, popular: true, blurb: 'Everything in Basic, plus per-tree detail, ripeness, yield estimation, harvest planning, irrigation schedule' },
  ],
  complete: [
    { key: 'complete_basic', name: 'Basic', usd: 69, blurb: 'Crop Basic on every crop farm and Tree Basic on every tree farm' },
    { key: 'complete_pro', name: 'Pro', usd: 149, popular: true, blurb: 'Crop Pro on every crop farm and Tree Pro on every tree farm' },
    { key: 'complete_adv', name: 'Advanced', usd: 219, blurb: 'Crop Advanced on every crop farm and Tree Pro on every tree farm' },
  ],
};

/* §4.9 — a surveyed farm is priced from the ground the farmer just confirmed.
   The published figure covers a farm of about 25 ha; beyond that it scales with
   what is in scope, trees counted as the land they stand on. Scaling the whole
   plan rather than adding a per-hectare line keeps the tiers in proportion —
   Advanced stays worth three times Basic at any size. */
const BASE_HA = 25;

function planPrice(plan, totals) {
  if (!totals) return plan.usd;
  const units = totals.cropHa + totals.treeCount / 120;
  const factor = Math.max(1, units / BASE_HA);
  return Math.round((plan.usd * factor) / 5) * 5;
}

export function A12(farmId) {
  const d = draft();
  // Arriving from a survey, the family and the price come from the ground the
  // farmer just confirmed. Arriving from the drawing route, from what he said.
  const farm = farmId ? farmById(farmId) : null;
  const totals = farm?.survey ? surveyTotals(farm) : null;
  const family = totals
    ? (totals.family === 'complete' ? 'complete' : totals.family)
    : d.farmType === 'mixed' ? 'complete' : d.farmType === 'trees' ? 'tree' : 'crop';
  const plans = PLAN_COPY[family];

  return {
    tabs: false,
    top: appBar({ title: t('a12.title', 'Choose your plan'), subtitle: farm?.name }),
    body: page(
      when(totals, () => card({}, cardPad(
        h('div', { style: { fontWeight: 650 } }, t('a12.fromsurvey', 'Priced from your survey')),
        kv([
          [t('a10.croparea', 'Open field crops'), area(totals.cropHa)],
          [t('a10.treearea', 'Trees'), totals.treeCount
            ? `${area(totals.treeHa, { bare: true })} · ${t('farm.treecount', '{n} trees', { n: num(totals.treeCount) })}`
            : t('a10.none', 'None')],
        ]),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('a12.keepother', 'Whatever you leave out of the plan stays on record. Adding it later needs no second survey.'))))),
      h('p', { style: { margin: 0, fontWeight: 600 } }, t('a12.trial', 'Your first month is free on any plan'), req('WF-708')),
      when(family === 'complete', () => disclaimer(
        t('a12.combined', 'You have crops and trees, so this is one Complete plan — a single price and a single renewal date. Never two subscriptions.'))),
      plans.map((plan) => card({ accent: plan.popular ? 'good' : null }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)' } }, plan.name.toUpperCase()),
          when(plan.popular, () => h('span.status.status--good', icon('star', 14), t('a12.popular', 'Most popular')))),
        // WF-144 / WF-767 — local currency, USD alongside, rates from the server.
        h('div.num', price(planPrice(plan, totals), d.country)),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          `USD ${num(planPrice(plan, totals))} / ${t('a12.month', 'month')}`),
        // WF-329 asks for the renewal to be plain; showing the year beside the
        // month is what stops a farmer discovering it at the twelfth payment.
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('a12.annual', 'or {price} a year — two months free', { price: priceBare(planPrice(plan, totals) * 10, d.country) })),
        h('p', { style: { margin: '4px 0 0', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, plan.blurb),
        btn(t('a12.choose', 'Choose'), {
          variant: plan.popular ? 'primary' : 'secondary', size: 'sm',
          onclick: () => {
            d.plan = plan.key;
            state.session.plan = plan.key;
            commit('a12');
            if (farm) { enterApp('owner'); toast(t('a12.done', '{name} is on the {plan} plan', { name: farm.name, plan: plan.name })); }
            else go('A13');
          },
        })))),
      h('button.row', { onclick: () => go('F6') },
        h('div.row__main', h('div.row__title', t('a12.compare', 'Compare all features'))),
        h('span.row__chev', icon('forward', 20, 'flip'))),
      disclaimer(t('a12.iap', 'Payment is handled by the App Store or Google Play. You can cancel any time from your store account.'))),
  };
}

/* -- A13 · You're ready, WF-152 ------------------------------------------ */

export function A13() {
  const d = draft();
  return {
    tabs: false,
    body: h('div.page', { style: { paddingTop: 'calc(var(--safe-top) + 40px)', alignItems: 'center', textAlign: 'center', gap: '18px' } },
      h('div', {
        style: {
          width: '92px', height: '92px', borderRadius: '50%', background: 'var(--st-good-bg)',
          color: 'var(--st-good)', display: 'grid', placeItems: 'center',
        },
      }, icon('check', 52)),
      h('h1', { style: { margin: 0, fontSize: 'var(--t-head)' } }, t('a13.title', 'You’re ready')),
      h('p', { style: { margin: 0, color: 'var(--ink-700)', maxWidth: '30ch' } },
        t('a13.watchlist', '{farm} is being added to our satellite watchlist.', { farm: d.farmName || 'Your farm' })),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '30ch' } },
        t('a13.first', 'Your first images will arrive within 48 hours. We will notify you when they do.')),
      h('div', { style: { flex: '1 1 auto' } })),
    dock: actionDock(
      btn(t('a13.go', 'Go to my farm'), {
        variant: 'primary', size: 'big',
        onclick: () => {
          if (d.farmName) addFarm({ name: d.farmName, type: d.farmType, irrigation: d.irrigation, soil: d.soil, areaHa: d.areaHa });
          resetLocal('signup');
          enterApp('owner');                   // WF-101 — creating a farm makes you its Owner
        },
      }),
      h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('a13.trial', 'Trial: 30 days remaining'))),
  };
}

/* -- A14 · Join a farm, WF-153 … WF-157 ---------------------------------- */

export function A14() {
  const d = local('join', { code: '', error: null });
  const cells = d.code.padEnd(6, ' ').split('');

  const type = (key) => {
    if (key === 'del') d.code = d.code.slice(0, -1);
    else if (d.code.length < 6) d.code += key;
    d.error = null;
    commit('a14');
  };

  const join = () => {
    // WF-156 — a used, expired or revoked invitation says so clearly.
    if (d.code.toUpperCase() === 'EXPIRE') {
      d.error = 'expired'; commit('a14'); return;
    }
    const asWorker = !d.code.toUpperCase().startsWith('S');
    resetLocal('join');
    // WF-102 — the role comes from the invitation and is never chosen here.
    // WF-157 — a Worker lands on My Work; a Supervisor on Home, farm-scoped.
    enterApp(asWorker ? 'worker' : 'supervisor');
    toast(asWorker
      ? t('a14.joined.worker', 'You have joined Al Kharj North as a Farm Worker')
      : t('a14.joined.sup', 'You have joined Al Kharj North as a Farm Supervisor'));
  };

  return {
    tabs: false,
    top: appBar({ title: t('a14.title', 'Join a farm') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('a14.enter', 'Enter the code you were sent')),
      h('div.otp', cells.map((c, i) => h(`div.otp__cell${c.trim() ? '.otp__cell--filled' : ''}${i === d.code.length ? '.otp__cell--focus' : ''}`,
        { style: { display: 'grid', placeItems: 'center', width: '40px' } }, c.trim()))),
      when(d.error === 'expired', () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        disclaimer(t('a14.expired', 'That invitation has already been used or has expired. Invitations last 7 days and work once.'), true),
        btn(t('a14.contactowner', 'Contact the farm owner'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),
      h('div.keypad', ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'K', '0', 'del'].map((k) => (
        h('button', { onclick: () => type(k) }, k === 'del' ? icon('back', 22, 'flip') : k)))),
      btn(t('a14.scan', 'Scan QR code'), { variant: 'secondary', icon: 'qr', onclick: () => openModal('QR_SCAN') }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a14.nocode', 'No code? Ask the farm owner to send you one.')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a14.mockhint', 'Mockup: any 6 characters join as a Worker. Start with S to join as a Supervisor. Type EXPIRE to see the expired-invitation message.'))),
    dock: actionDock(btn(t('a14.join', 'Join'), {
      variant: 'primary', disabled: d.code.length < 6, onclick: join,
    })),
  };
}

/* -- Login and recovery, WF-158 … WF-162 --------------------------------- */

export function LOGIN() {
  const d = local('login', { phone: '', password: '', show: false, country: 'SA' });
  const dial = state.db.countries.find((c) => c.code === d.country)?.dial ?? '+966';
  return {
    tabs: false,
    top: h('div.app__top', h('div.appbar',
      h('div.appbar__spacer'),
      // WF-159 — a language control is present on the login screen.
      h('button.iconbtn', { onclick: () => openModal('LANG_PICKER'), style: { minWidth: 'auto', padding: '0 10px' } },
        icon('language', 20), h('span.iconbtn__label', langMeta().english)))),
    body: page(
      logoBlock(),
      field(t('a3.mobile', 'Mobile number'),
        h('div.inputgroup',
          select(state.db.countries.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` })), d.country,
            (v) => { d.country = v; commit('login'); }, { style: { width: '112px' } }),
          input({ type: 'tel', placeholder: '5X XXX XXXX', value: d.phone, oninput: (e) => { d.phone = e.target.value; } }))),
      // WF-158 — SMS code is the more prominent of the two options.
      btn(t('login.sms', 'Send me a code'), { variant: 'primary', onclick: () => go('A4') }),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
        h('span', { style: { flex: 1, height: '1px', background: 'var(--ink-200)' } }),
        h('span', t('login.or', 'or')),
        h('span', { style: { flex: 1, height: '1px', background: 'var(--ink-200)' } })),
      field(t('a5.password', 'Password'),
        h('div', { style: { position: 'relative' } },
          input({
            type: d.show ? 'text' : 'password', value: d.password,
            oninput: (e) => { d.password = e.target.value; }, style: { paddingInlineEnd: '52px' },
          }),
          h('button.iconbtn', {
            onclick: () => { d.show = !d.show; commit('login'); },
            style: { position: 'absolute', insetInlineEnd: '2px', top: 0 },
          }, icon(d.show ? 'eyeOff' : 'eye', 21)))),
      btn(t('action.login', 'Log in'), { variant: 'secondary', onclick: () => enterApp('owner') }),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--t-meta)' } },
        link(t('login.forgot', 'Forgot your password?'), () => go('FORGOT')),
        h('div', t('login.new', 'New here? '), link(t('login.create', 'Create an account'), () => go('A3'))),
        h('div', t('a3.invited', 'Have an invitation? '), link(t('a14.title', 'Join a farm'), () => go('A14')))),
      when(state.session.biometric, () => h('div', { style: { textAlign: 'center', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
        t('login.biometric', 'Biometric unlock is available on this device.'), req('WF-160')))),
  };
}

export function FORGOT() {
  return {
    tabs: false,
    top: appBar({ title: t('forgot.title', 'Reset your password') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('forgot.body', 'We will send a code to your mobile number. Enter it, then choose a new password.')),
      field(t('a3.mobile', 'Mobile number'), input({ type: 'tel', placeholder: '5X XXX XXXX' }))),
    dock: actionDock(btn(t('a3.send', 'Send code'), { variant: 'primary', onclick: () => go('A4') })),
  };
}

/* -- A15 · Demo mode ------------------------------------------------------ */
/* A15 is not a separate screen in the running app — WF-163 says a demo session
   opens the ordinary app against a fixture. This entry exists so the screen
   index can jump straight into one. */

export function A15() {
  return {
    tabs: false,
    top: appBar({ title: t('a15.title', 'Demo mode') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a15.body', 'A demo session opens two example farms — one crop, one tree — with plots, sixty days of imagery, advice, tasks and a team, in your chosen language.')),
      card({}, cardPad(
        h('div', { style: { fontWeight: 650 } }, t('a15.rules', 'While you are in the demo')),
        h('ul', { style: { margin: 0, paddingInlineStart: '20px', color: 'var(--ink-700)' } },
          [t('a15.r1', 'Every plan feature is unlocked, so you see what the product does.'),
           t('a15.r2', 'Every action completes and shows a confirmation. Nothing is disabled.'),
           t('a15.r3', 'Nothing is saved, no account is created, and closing the app ends it.'),
           t('a15.r4', 'Anything that genuinely needs an account offers to create one.')].map((x) => h('li', x)))),
      ),
      disclaimer(t('a15.disclaimer', 'Every advisory screen still carries its disclaimer, exactly as it does for a paying customer.'))),
    dock: actionDock(btn(t('a15.start', 'Start the demo'), {
      variant: 'primary',
      onclick: () => { state.session.demo = true; enterApp('owner'); },
    })),
  };
}
