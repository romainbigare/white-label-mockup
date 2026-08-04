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
import { go, back, enterApp, enterOnboarding, openModal, resetStack } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, field,
  input, select, checkbox, radioList, disclaimer, statusChip, emptyState, req,
} from '../ui/components.js';
import { area, price, num, date, NOW } from '../core/format.js';
import { boundaryCanvas, undoVertex, starterPolygon, polygonAreaHa, selfIntersection } from '../ui/boundaryEditor.js';
import { mapSvg } from '../ui/map.js';
import { addFarm } from '../data/actions.js';
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

function logoBlock() {
  return h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '8px 0 4px' } },
    h('div', {
      style: {
        width: '76px', height: '76px', borderRadius: '22px',
        background: 'linear-gradient(150deg, var(--brand-500), var(--brand-800))',
        display: 'grid', placeItems: 'center', color: 'var(--brand-100)',
        boxShadow: '0 8px 22px rgba(20,92,64,.28)',
      },
    }, icon('leaf', 40)),
    h('div', { style: { fontWeight: 750, fontSize: 'var(--t-lead)', letterSpacing: '.01em' } }, 'Wafra'));
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
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-400)', textAlign: 'center', margin: 0 } },
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

/* -- A8 · Add your first farm, WF-131 ------------------------------------ */

export function A8() {
  return {
    tabs: false,
    top: appBar({ title: t('a8.title', 'Add your farm') }),
    body: page(
      choiceCard('edit', t('a8.draw', 'Draw it on the map'), t('a8.draw.sub', 'Trace the boundary on satellite imagery'), () => go('A8D')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('a8.note', 'Only farm owners and supervisors can add land.'), req('WF-131'))),
  };
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
    { key: 'tree_pro', name: 'Pro', usd: 99, popular: true, blurb: 'Everything in Basic, plus per-tree detail, QR codes, ripeness, yield estimation, harvest planning, irrigation schedule' },
  ],
  complete: [
    { key: 'complete_basic', name: 'Basic', usd: 69, blurb: 'Crop Basic on every crop farm and Tree Basic on every tree farm' },
    { key: 'complete_pro', name: 'Pro', usd: 149, popular: true, blurb: 'Crop Pro on every crop farm and Tree Pro on every tree farm' },
    { key: 'complete_adv', name: 'Advanced', usd: 219, blurb: 'Crop Advanced on every crop farm and Tree Pro on every tree farm' },
  ],
};

export function A12() {
  const d = draft();
  // WF-142 / WF-704 — the family is derived from the farm just created.
  const family = d.farmType === 'mixed' ? 'complete' : d.farmType === 'trees' ? 'tree' : 'crop';
  const plans = PLAN_COPY[family];

  return {
    tabs: false,
    top: appBar({ title: t('a12.title', 'Choose your plan') }),
    body: page(
      h('p', { style: { margin: 0, fontWeight: 600 } }, t('a12.trial', 'Your first month is free on any plan'), req('WF-708')),
      when(family === 'complete', () => disclaimer(
        t('a12.combined', 'You have crops and trees, so this is one Complete plan — a single price and a single renewal date. Never two subscriptions.'))),
      plans.map((plan) => card({ accent: plan.popular ? 'good' : null }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)' } }, plan.name.toUpperCase()),
          when(plan.popular, () => h('span.status.status--good', icon('star', 14), t('a12.popular', 'Most popular')))),
        // WF-144 / WF-767 — local currency, USD alongside, rates from the server.
        h('div.num', price(plan.usd, d.country)),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, `USD ${plan.usd} / month`),
        h('p', { style: { margin: '4px 0 0', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, plan.blurb),
        btn(t('a12.choose', 'Choose'), {
          variant: plan.popular ? 'primary' : 'secondary', size: 'sm',
          onclick: () => {
            d.plan = plan.key;
            state.session.plan = plan.key;
            commit('a12');
            go('A13');
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
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-400)', margin: 0, textAlign: 'center' } },
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
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--ink-400)', fontSize: 'var(--t-meta)' } },
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
