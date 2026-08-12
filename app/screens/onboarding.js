/* ---------------------------------------------------------------------------
   onboarding.js — chapter 4: A1 … A15, and password recovery.

   The shape of this flow is the shape of §4.1: registration creates an IDENTITY,
   not a role (WF4.001). A2 routes; it does not assign privileges. So the role is
   set at exactly two points in this file — enterApp('owner') after a farm is
   created (WF4.002), and enterApp(invitation.role) after a join (WF4.003).

   The order is the order of §4, and two things about it are deliberate:

     * A2 comes before anything that needs typing. Three doors, no keyboard
       (WF4.017). Each route then collects its own inputs on its own screen, so
       nobody types a password on the way to redeeming an invitation.
     * The tour is at A4, between "Create an account" and the form (WF4.018), so
       it is on the registration path and nowhere else (WF4.030) — a returning
       user logging in never sees it. It runs in the user's own language because
       A1 has already happened, which is the whole reason language comes first:
       an Arabic speaker cannot read a word of these screens until it does.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local, resetLocal } from '../core/local.js';
import { t, LANGUAGES, setLanguage, langMeta } from '../core/i18n.js';
import { go, back, enterApp, openModal, openSheet } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { logo } from '../ui/brand.js';
import {
  appBar, barAction, page, section, card, cardPad, btn, actionDock, field,
  input, select, checkbox, disclaimer, req, kv, chips,
} from '../ui/components.js';
import { area, priceBare, perAreaUnit, num } from '../core/format.js';
import { boundaryCanvas, undoVertex, starterPolygon } from '../ui/boundaryEditor.js';
import { mapSvg, landUseSvg } from '../ui/map.js';
import { addFarm, confirmSurvey, attachAccount } from '../data/actions.js';
import {
  surveyTotals, decidedAreas, LAND_USE, LAND_USE_META, TREES_PER_HA,
  addArea, setAreaIncluded,
} from '../data/survey.js';
import { farmById, rawFarm } from '../data/selectors.js';

/* The draft an owner builds across A5 → A14. One object, one flow. */
const draft = () => local('signup', {
  country: 'SA', phone: '', email: '', agreed: false, code: '',
  name: '', password: '', showPassword: false, areaUnit: null,
  farmName: '', farmType: null,
  points: [], plots: [], plan: null, tourCard: 0, attempts: 0,
});

/* WF2.004 — a link inside a sentence is still a target, so it gets a real box. */
function link(label, onclick) {
  return h('button.textlink', { onclick, type: 'button' }, label);
}

/* The full lockup, on the screens with room for it. It carries the name in both
   scripts, so there is no caption underneath to translate. */
function logoBlock(height = 60) {
  return h('div', { style: { display: 'flex', justifyContent: 'center', padding: '10px 0 6px' } },
    logo('lockup', height));
}

/* -- A1 · Language, WF4.011 … WF4.016 -------------------------------------- */

export function A1() {
  return {
    tabs: false,
    // WF4.013 — the whole list has to fit a 360 × 640 screen without scrolling,
    // so this screen is tight on purpose: five rows, a logo and a button.
    body: h('div.page', { style: { paddingTop: 'calc(var(--safe-top) + 14px)', gap: '14px' } },
      logoBlock(48),
      h('div', { style: { textAlign: 'center' } },
        h('h1', { style: { fontSize: 'var(--t-title)', margin: '0 0 2px' } }, t('a1.title', 'Choose your language')),
        h('p', { style: { margin: 0, fontSize: 'var(--t-body)', color: 'var(--ink-500)' }, dir: 'rtl' }, 'اختر لغتك')),
      // WF4.011 — each language is named ONLY in its own script. An English
      // gloss under each one is of no use to the person who needs this screen:
      // someone who can read "Bengali" can already read the app, and the row is
      // twice as tall for it.
      card({}, LANGUAGES.map((lang) => h('button.row.row--tight', {
        onclick: () => setLanguage(lang.code),          // WF4.015 — mirrors immediately
      },
      h('div.row__main',
        // Isolated rather than dir="rtl": the Arabic characters carry their own
        // direction, so the run renders right-to-left inside a row that still
        // begins where every other row begins. Setting dir on the block moved
        // the word to the far edge and made the list look like two lists.
        h('div.row__title', { style: { fontSize: 'var(--t-lead)', unicodeBidi: 'isolate' } }, lang.native)),
      when(lang.code === state.session.lang, () => h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('check', 22)))))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        t('a1.later', 'You can change this later in Settings.'), req('WF4.011', 'WF4.012', 'WF4.013'))),
    dock: actionDock(btn(t('action.continue', 'Continue'), { variant: 'primary', onclick: () => go('A2') })),
  };
}

/* -- A2 · Get started, WF4.017 … WF4.021 ----------------------------------
   Doors and nothing else. WF4.017 is unusually specific about what must NOT be
   here — no number field, no password field, no checkbox, no terms line — and
   the reason is that this screen used to be a login form with "create an
   account" underneath it. A returning user, a new user and an invited worker
   want different things, and asking them all to look at a phone-number field
   first serves only one of them.

   Exactly three, and the tour is not a fourth: WF4.018 routes "Create an
   account" through A4, so the tour is what somebody who has decided to sign up
   sees on the way to the form, and a returning user never does.

   No keyboard opens here. Each route collects its own inputs on its own screen. */

export function A2() {
  return {
    tabs: false,
    top: h('div.app__top', h('div.appbar',
      h('div.appbar__spacer'),
      // WF4.020 — a language control stays here, so a wrong tap at A1 costs one tap.
      h('button.iconbtn', { onclick: () => openModal('LANG_PICKER'), style: { minWidth: 'auto', padding: '0 10px' } },
        icon('language', 20), h('span.iconbtn__label', langMeta().english)))),
    body: h('div.page', { style: { gap: '18px', paddingTop: '8px' } },
      logoBlock(64),
      doorCard('login', t('action.login', 'Log in'), null, () => go('A3')),
      doorCard('user', t('a2.create', 'Create an account'), null, () => openTour()),
      doorCard('users', t('a2.join', 'Join a farm'), t('a2.join.sub', 'I have an invitation'), () => go('A15')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        req('WF4.017', 'WF4.018'))),
  };
}

/* Equal weight, because none of the three is the expected one. */
function doorCard(iconName, title, sub, onclick) {
  return card({ onclick }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(iconName, 26)),
      h('div', { style: { flex: 1 } },
        h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650 } }, title),
        when(sub, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, sub))),
      h('span.row__chev', icon('forward', 20, 'flip')))));
}

/* -- A3 · Log in, WF4.022 … WF4.025 ---------------------------------------- */

export function A3() {
  const d = local('login', { identifier: '', password: '', show: false });
  return {
    tabs: false,
    top: appBar({ title: t('action.login', 'Log in'), onBack: () => go('A2', { replace: true }) }),
    body: page(
      // WF4.022 — one field, because a number and an email are interchangeable
      // identifiers and asking which one this is serves nobody.
      field(t('a3.identifier', 'Mobile number or email'), input({
        type: 'text', inputmode: 'email', autocomplete: 'username',
        placeholder: '+966 5X XXX XXXX', value: d.identifier,
        oninput: (e) => { d.identifier = e.target.value; },
        onchange: () => commit('a3'),
      })),
      // WF4.023 — a code is the prominent of the two routes.
      btn(t('login.sms', 'Send me a code'), {
        variant: 'primary',
        disabled: d.identifier.trim().length < 4,
        onclick: () => go('A6'),
      }),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
        h('span', { style: { flex: 1, height: '1px', background: 'var(--ink-200)' } }),
        h('span', t('login.or', 'or')),
        h('span', { style: { flex: 1, height: '1px', background: 'var(--ink-200)' } })),
      field(t('a7.password', 'Password'),
        passwordInput(d.password, d.show,
          (v) => { d.password = v; },
          () => { d.show = !d.show; commit('a3'); }),
        { hint: t('a7.password.hint', 'At least 8 characters') }),
      btn(t('action.login', 'Log in'), {
        variant: 'secondary',
        disabled: !d.identifier.trim() || d.password.length < 8,
        onclick: () => enterApp('owner'),
      }),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--t-meta)' } },
        link(t('login.forgot', 'Forgot your password?'), () => go('FORGOT'))),
      when(state.session.biometric, () => h('div', { style: { textAlign: 'center', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
        t('login.biometric', 'Fingerprint unlock is available on this device.'), req('WF4.024')))),
  };
}

/* WF4.042 — the show/hide control, in one place because two screens carry it. */
function passwordInput(value, shown, onValue, onToggle) {
  return h('div', { style: { position: 'relative' } },
    input({
      type: shown ? 'text' : 'password', value,
      oninput: (e) => onValue(e.target.value),
      onchange: () => commit('password'),
      style: { paddingInlineEnd: '52px' },
    }),
    h('button.iconbtn', {
      onclick: onToggle,
      'aria-label': t('a7.showpw', 'Show password'),
      style: { position: 'absolute', insetInlineEnd: '2px', top: '0' },
    }, icon(shown ? 'eyeOff' : 'eye', 21)));
}

export function FORGOT() {
  return {
    tabs: false,
    top: appBar({ title: t('forgot.title', 'Reset your password') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('forgot.body', 'We will send a code to your mobile number or email. Enter it, then choose a new password.')),
      field(t('a3.identifier', 'Mobile number or email'), input({ type: 'text', placeholder: '+966 5X XXX XXXX' }))),
    dock: actionDock(btn(t('a5.send', 'Send code'), { variant: 'primary', onclick: () => go('A6') })),
  };
}

/* -- A4 · Guided tour, WF4.026 … WF4.031 --------------------------------- */

/* WF4.026 — still images with a caption, not a live interface with banners over
   it and not a demo account. A tour built out of the real app has to be
   maintained alongside the real app, and a prospect walking through a fake farm
   spends the first minute working out that none of it is theirs. */
const TOUR = [
  { icon: 'map', headline: 'Your farm from above',
    body: 'The survey finds your fields and counts your trees, so you start with the land already mapped.' },
  { icon: 'advice', headline: 'What to do today',
    body: 'Water this plot, feed that one, do not spray on Tuesday. Each one says how much, and why.' },
  { icon: 'droplet', headline: 'How much water, exactly',
    body: 'A volume and a time, worked out from the weather, your soil and what the crop is using.' },
  { icon: 'users', headline: 'Send it to the person doing it',
    body: 'Work goes out by WhatsApp or text, in their language. They never need the app.' },
  { icon: 'check', headline: 'And see it done',
    body: 'A photo, an amount and a note come back, and the record builds itself.' },
];

/**
 * Start the tour from the beginning. Whoever opens it owns the reset, because
 * A4 has no entry hook of its own and a half-watched tour must not resume at
 * card 4 the next time somebody asks to see it.
 *
 * `from` is 'help' when F12 opened it (WF4.030) and null on the registration
 * path. It is the only thing that differs: where the end of the tour leads.
 */
export function openTour(from = null) {
  draft().tourCard = 0;
  go(from ? `A4:${from}` : 'A4');
}

export function A4(from) {
  const d = draft();
  const i = Math.min(d.tourCard, TOUR.length - 1);
  const c = TOUR[i];
  const last = i === TOUR.length - 1;
  // WF4.030 — from Help the tour is a detour, so it ends where it started.
  const leave = from === 'help' ? () => back() : () => go('A5', { replace: true });
  return {
    tabs: false,
    top: h('div.app__top', h('div.appbar',
      h('div.appbar__spacer'),
      // WF4.029 — Skip is on every snapshot, and goes straight to A5.
      h('button.iconbtn', { onclick: leave, style: { minWidth: 'auto', padding: '0 14px' } },
        h('span', { style: { fontWeight: 650 } }, t('action.skip', 'Skip'))))),
    body: h('div.page', { style: { gap: '20px', textAlign: 'center', alignItems: 'center' } },
      h('div', {
        style: {
          width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(160deg, var(--brand-100), var(--brand-050))',
          display: 'grid', placeItems: 'center', color: 'var(--brand-600)',
        },
      }, icon(c.icon, 92)),
      // WF4.028 — numbered, so the length of the thing is never a mystery.
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', fontWeight: 600 } },
        t('a4.count', '{n} of {total}', { n: num(i + 1), total: num(TOUR.length) })),
      h('h1', { style: { fontSize: 'var(--t-head)', margin: 0 } }, t(`a4.${i}.h`, c.headline)),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '32ch' } }, t(`a4.${i}.b`, c.body)),
      h('div.dots', TOUR.map((_, k) => h('span', k === i ? { 'data-on': '' } : {})))),
    dock: actionDock(btn(
      last
        ? (from === 'help' ? t('action.done', 'Done') : t('a4.start', 'Create my account'))
        : t('action.next', 'Next'),
      {
        variant: 'primary',
        onclick: () => { if (last) leave(); else { d.tourCard = i + 1; commit('a4'); } },
      })),
  };
}

/* -- A5 · Sign up, WF4.032 … WF4.037 --------------------------------------
   The MOBILE NUMBER is the one thing that has to be right, so it is the one
   thing that gets validated: a six-digit code goes to it and nothing continues
   until the code comes back. The email address is collected and never verified.

   That asymmetry is the whole design of this screen, and it replaced a
   symmetrical one where the farmer could start with either and the code went to
   whichever they had typed. Either-way-round is the right answer for LOGGING IN
   — A3 still takes either — but it is the wrong answer for registration: an
   account whose number was never proved cannot be sent work, cannot receive an
   alert, and cannot be found by the owner who types that number into a worker
   record. The address is worth having (WF9.021 writes a licence bought on the
   web against it) and worth nothing to verify: nobody is locked out of a farm
   because an email bounced. */

const EMAILISH = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function A5() {
  const d = draft();
  const countries = state.db.countries;
  const priority = countries.filter((c) => c.priority);   // WF4.035 — GCC + Jordan on top
  const rest = countries.filter((c) => !c.priority);

  const phoneOk = d.phone.replace(/\D/g, '').length >= 6;
  const emailOk = EMAILISH.test(d.email.trim());

  return {
    tabs: false,
    top: appBar({ title: t('a5.title', 'Create your account'), onBack: () => go('A2', { replace: true }) }),
    body: page(
      field(t('a5.mobile', 'Mobile number'),
        h('div.inputgroup',
          select([...priority.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` })),
            ...rest.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` }))],
          d.country, (v) => { d.country = v; commit('a5'); }, { style: { width: '112px' } }),
          input({
            type: 'tel', inputmode: 'tel', autocomplete: 'tel',
            placeholder: '5X XXX XXXX', value: d.phone,
            oninput: (e) => { d.phone = e.target.value; },
            // WF4.036 — spaces and dashes normalise; a leading zero is stripped.
            onchange: (e) => {
              d.phone = e.target.value.replace(/[\s-]/g, '').replace(/^0+/, '');
              commit('a5');
            },
          })),
        { required: true, hint: t('a5.hint', 'We send a code to this number to check it is yours.') }),

      field(t('a5.email', 'Email address'), input({
        type: 'email', inputmode: 'email', autocomplete: 'email', value: d.email,
        placeholder: 'name@example.com',
        oninput: (e) => { d.email = e.target.value; },
        onchange: () => commit('a5'),
      }), {
        required: true,
        hint: t('a5.email.hint', 'Your reports go here. We do not send a code to it.'),
      }),

      // WF4.037 — unticked by default; Terms and Privacy open in-app.
      checkbox(h('span', t('a5.terms.pre', 'I agree to the '),
        link(t('a5.terms', 'Terms of Use'), () => openModal('LEGAL', { doc: 'terms' })),
        t('a5.and', ' and '),
        link(t('a5.privacy', 'Privacy Policy'), () => openModal('LEGAL', { doc: 'privacy' }))),
        d.agreed, (v) => { d.agreed = v; commit('a5'); }),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('a5.bothneeded', 'You can sign in afterwards with either the number or the address. Only the number is checked.'),
        req('WF4.032', 'WF4.033'))),

    dock: actionDock(btn(t('a5.send', 'Send code'), {
      variant: 'primary',
      disabled: !d.agreed || !phoneOk || !emailOk,
      onclick: () => go('A6'),
    })),
  };
}

/* -- A6 · Verify code, WF4.034 / WF4.038 … WF4.040 ------------------------- */

export function A6() {
  const d = draft();
  const digits = d.code.padEnd(6, ' ').split('');
  const locked = d.attempts >= 5;                              // WF4.040

  const pressKey = (key) => {
    if (locked) return;
    if (key === 'del') d.code = d.code.slice(0, -1);
    else if (d.code.length < 6) d.code += key;
    commit('a6');
    // WF4.038 — auto-submits at six digits.
    if (d.code.length === 6) {
      setTimeout(() => {
        if (d.code === '000000') { d.attempts += 1; d.code = ''; commit('a6'); return; }
        go('A7');
      }, 260);
    }
  };

  const dial = state.db.countries.find((c) => c.code === d.country)?.dial ?? '+966';
  // WF4.034 — always by SMS, always to the mobile number. The address is never
  // a route in, because it is never checked.
  const sentTo = `${dial} ${d.phone || '5X XXX XXXX'}`;
  return {
    tabs: false,
    top: appBar({ title: t('a6.title', 'Enter your code') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a6.sent', 'We sent a 6-digit code to {to}', { to: sentTo })),
      h('div.otp', digits.map((c, i) => h(`div.otp__cell${c.trim() ? '.otp__cell--filled' : ''}${i === d.code.length && !locked ? '.otp__cell--focus' : ''}`,
        { style: { display: 'grid', placeItems: 'center' } }, c.trim()))),
      when(locked, () => h('div',
        disclaimer(t('a6.locked', 'Too many attempts. Your account is locked for 15 minutes. You can contact Wafra for help.'), true),
        h('div', { style: { height: '10px' } }),
        btn(t('f13.title', 'Contact Wafra'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center' } },
        t('a6.valid', 'The code is valid for 10 minutes.'), req('WF4.038')),
      h('div.keypad', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => (
        k === '' ? h('span') : h('button', { onclick: () => pressKey(k), disabled: locked },
          k === 'del' ? icon('back', 22, 'flip') : k)))),
      h('div', { style: { textAlign: 'center' } },
        // WF4.039 — resend after 45 seconds.
        h('button.textlink', { onclick: () => toast(t('a6.resent', 'New code sent')) },
          t('a6.resend', 'Resend code (available in 45s)'))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        t('a6.mockhint', 'Mockup: any six digits continue. 000000 simulates a wrong code.'))),
  };
}

/* -- A7 · Your details and units, WF4.041 … WF4.046 -----------------------
   The land unit is asked once, here, because every area in the app is about to
   be printed in it and a farmer who counts in dunum should never have to divide
   by ten in his head. WF4.043 pre-selects it from the country the phone reports
   and says so, which makes it a correction rather than a question. */

/* Two units, not three. Acres are not how land is counted anywhere the app
   launches, and the third chip was an invitation to pick the wrong one. */
const AREA_UNITS = [
  { id: 'dunum', label: 'Dunum' },
  { id: 'hectare', label: 'Hectare' },
];

/* WF4.043 — dunum in the UAE and Jordan, hectares in Saudi Arabia. */
const UNIT_FOR_COUNTRY = { AE: 'dunum', SA: 'hectare', JO: 'dunum' };

export function A7() {
  const d = draft();
  const detected = UNIT_FOR_COUNTRY[d.country] ?? 'acre';
  const chosen = d.areaUnit ?? detected;
  const weak = d.password.length > 0 && d.password.length < 8;

  return {
    tabs: false,
    top: appBar({ title: t('a7.title', 'Tell us about you') }),
    body: page(
      field(t('a7.name', 'Your name'), input({
        value: d.name, autocomplete: 'name',
        oninput: (e) => { d.name = e.target.value; },
        onchange: () => commit('a7'),
      }), { required: true }),                                    // WF4.041
      field(t('a7.password', 'Set a password'),
        passwordInput(d.password, d.showPassword,
          (v) => { d.password = v; },
          () => { d.showPassword = !d.showPassword; commit('a7'); }),
        {
          required: true,
          hint: t('a7.password.hint', 'At least 8 characters'),
          error: weak ? t('a7.password.short', 'Passwords need at least 8 characters.') : null,
        }),
      field(t('a7.unit', 'How do you measure land?'),
        chips(AREA_UNITS.map((u) => ({ id: u.id, label: t(`unit.${u.id}.name`, u.label) })), chosen,
          (id) => { d.areaUnit = id; state.session.areaUnit = id; commit('a7'); }),
        {
          required: true,
          hint: t('a7.unit.hint', 'We have set this from your country. You can change it in Settings.'),
        }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        // WF4.044 — a worker invited to a farm needs no password at all.
        t('a7.workernote', 'Workers invited to a farm can sign in with a code and do not need a password.'), req('WF4.044'))),
    dock: actionDock(btn(t('action.continue', 'Continue'), {
      variant: 'primary',
      disabled: !d.name.trim() || d.password.length < 8,
      onclick: () => {
        state.session.areaUnit = chosen;
        go('A9');                                                // WF4.045 — this route makes an Owner
      },
    })),
  };
}

/* -- the search bar, WF4.056 / WF4.057 ------------------------------------
   Visible at all times on every map screen, never behind an icon. A farmer
   adding land is looking at a satellite image of somewhere that is not his
   farm, and scrolling there by hand from wherever the phone happens to be is
   the single worst moment in the flow. */

function placeSearch(placeholder) {
  return h('div', {
    style: {
      position: 'absolute', insetInline: '10px', top: '10px', zIndex: 3,
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--paper)', borderRadius: '999px',
      padding: '0 14px', height: '44px',
      boxShadow: '0 2px 10px rgba(9, 22, 17, .18)',
    },
  },
  h('span', { style: { display: 'flex', color: 'var(--ink-500)' } }, icon('search', 19)),
  h('span', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
    placeholder));
}

/* -- A9 · Add your first farm, WF4.051 … WF4.057 --------------------------
   A fork, and WF4.052 insists the two routes carry EQUAL weight — neither
   dressed as the advanced one. Drawing your own plots suits a farmer who
   already knows which fields he wants watched; the survey suits one whose land
   is a mixture of orchard, open field, sheds and a house, and who would rather
   be told what is there than trace nine outlines on a phone.

   WF4.053: the choice belongs to the FARM, not the account, and neither route
   is spent — a farmer who drew his plots can ask for a survey later from Farm
   settings, and a farmer who surveyed can still draw a plot by hand. */

/**
 * The way in to the fork from anywhere that is not first-run — B12's Add farm,
 * and Home's empty state. It clears the draft so a half-finished attempt does
 * not leak into the next one, and remembers which route was chosen so A12 knows
 * where to send the farmer next.
 */
export function startAddFarm(route) {
  resetLocal('signup');
  draft().route = route;
  go('A12');
}

export function A9() {
  return {
    tabs: false,
    top: appBar({ title: t('a9.title', 'Add your farm') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a9.lead', 'Two ways in. Both end with the same farm — pick whichever describes your land.')),
      routeCard('scan', t('a9.survey', 'Survey my whole farm'),
        t('a9.survey.sub', 'Draw the outer boundary and we find the plots and the trees'),
        // WF4.054 / review C102–C108 — say WHEN to choose this one, in the
        // farmer's terms. The two routes are not a beginner and an expert
        // version; they answer different questions, and the difference is what
        // gets surveyed and therefore what gets paid for.
        [
          t('a9.survey.when', 'Choose this if you want everything growing on your farm surveyed — every crop and every tree.'),
          t('a9.survey.remove', 'You can still take plots out of the result afterwards.'),
        ],
        () => { draft().route = 'survey'; go('A12'); }),
      routeCard('edit', t('a9.draw', 'Draw my own plots'),
        t('a9.draw.sub', 'Trace each plot and give it a name'),
        [t('a9.draw.when', 'Choose this if you only want particular plots surveyed — one or two fields rather than the whole farm.')],
        () => { draft().route = 'plots'; go('A12'); }),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        t('a9.later', 'You can add more plots or run a survey later.'), req('WF4.052'))),
  };
}

function routeCard(iconName, title, sub, when_, onclick) {
  return card({ onclick }, cardPad(
    h('div', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(iconName, 28)),
    h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650 } }, title),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, sub),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' } },
      when_.map((line) => h('div', {
        style: { display: 'flex', gap: '7px', alignItems: 'flex-start', color: 'var(--ink-700)' },
      },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex', flex: '0 0 auto', marginTop: '2px' } }, icon('check', 16)),
      h('span', line))))));
}

/* -- A9 · Draw my own plots, WF4.058 … WF4.069 ---------------------------
   The crop question has gone. It used to sit under the canvas — "What is
   growing here?", a nine-item picker answered once per plot — and the survey
   detects it, which makes the question both work and a chance to be wrong.
   What the farmer knows and the algorithm does not is what he CALLS the field,
   so that is what this screen asks instead, and even then only as a correction:
   every plot arrives already named after the farm and numbered.

   Saved plots are a list, not a counter. The old screen said "3 saved so far"
   and gave no way to see, rename or remove any of them, so a plot traced round
   the wrong field could only be fixed by starting the flow again. */

export function A9D() {
  const d = draft();
  if (!d.points.length) d.points = starterPolygon();
  const editor = boundaryCanvas({
    points: d.points,
    selected: d.selectedVertex,
    onChange: ({ selected }) => { d.selectedVertex = selected; commit('draw'); },
  });
  const areaHa = editor.areaHa;
  const tooSmall = areaHa > 0 && areaHa < 0.1;                 // WF4.069
  const tooBig = areaHa > 10000;
  const done = d.plots.length;
  const drawable = d.points.length >= 3 && !editor.invalid;

  // WF4.061 — many plots per farm, each with a name the farmer can recognise.
  const keepPlot = () => {
    d.plots.push({
      id: `draft-${d.plots.length + 1}`,
      name: (d.plotName || '').trim() || `P${d.plots.length + 1}`,
      areaHa,
      points: d.points.map((p) => [...p]),
    });
    d.points = [];
    d.plotName = '';
  };

  return {
    tabs: false,
    top: appBar({
      // WF4.061 — the counter is how a farmer keeps his place across several plots.
      title: t('a9d.counter', 'Plot {n}', { n: num(done + 1) }),
      actions: [
        barAction('undo', t('action.undo', 'Undo'), () => undoVertex(d.points), { disabled: !d.points.length }),
        barAction('trash', t('action.clearall', 'Clear'), () => openModal('CONFIRM', {
          title: t('a9d.clear.title', 'Clear all corners?'),
          body: t('a9d.clear.body', 'This removes every corner you have placed. The map stays where it is.'),
          confirmLabel: t('action.clearall', 'Clear'),
          onConfirm: () => { d.points.length = 0; commit('draw'); },
        })),
      ],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', minHeight: '210px', position: 'relative' } },
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),   // WF4.058 — satellite by default
        editor.node,
        placeSearch(t('a9d.search', 'Search a place or coordinates')),
        h('button.mapchip.mapchip--square', {
          style: { position: 'absolute', insetInlineEnd: '12px', bottom: '12px' },
          onclick: () => toast(t('a9d.located', 'Centred on your position')),
        }, icon('locate', 19), t('map.locate', 'Locate'))),
      h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--paper)', overflow: 'auto' } },
        h('div',
          h('span.num', area(areaHa)),                          // WF4.065
          req('WF4.065')),
        when(editor.invalid, () => disclaimer(
          t('a9d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        when(tooSmall, () => disclaimer(t('a9d.small', 'That is smaller than 0.1 ha. You can still save it — just checking it is right.'))),
        when(tooBig, () => disclaimer(t('a9d.big', 'That is larger than 10,000 ha. You can still save it — just checking it is right.'))),
        // WF4.063 / review C094 — the farmer's own name for the field. Optional,
        // because a numbered plot is already a working name.
        field(t('a9d.name', 'Call this plot'), input({
          value: d.plotName ?? '', placeholder: `P${done + 1}`,
          oninput: (e) => { d.plotName = e.target.value; },
          onchange: () => commit('draw'),
        }), { hint: t('a9d.name.hint', 'Optional. Leave it and we number it for you.') }),

        // The list of what has been traced so far — visible, renameable, and
        // removable without leaving the screen.
        when(done > 0, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { fontWeight: 650, fontSize: 'var(--t-meta)' } },
            t('a9d.savedlist', 'Plots you have drawn')),
          card({}, d.plots.map((p, i) => h('div.row', { style: { minHeight: '48px' } },
            h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('grid', 19)),
            h('div.row__main',
              h('div.row__title', p.name),
              h('div.row__sub', area(p.areaHa))),
            h('button.iconbtn.iconbtn--bare', {
              'aria-label': t('a9d.rename', 'Rename {name}', { name: p.name }),
              title: t('a9d.rename', 'Rename {name}', { name: p.name }),
              onclick: () => openSheet('PLOT_RENAME', { index: i }),
            }, icon('edit', 20)),
            h('button.iconbtn.iconbtn--bare', {
              'aria-label': t('a9d.removeplot', 'Remove {name}', { name: p.name }),
              title: t('a9d.removeplot', 'Remove {name}', { name: p.name }),
              onclick: () => { d.plots.splice(i, 1); commit('draw'); },
            }, icon('trash', 20))))))))),
    dock: actionDock(
      h('div', { style: { display: 'flex', gap: '10px' } },
        btn(t('a9d.addplot', 'Add a plot'), {
          variant: 'secondary', block: false,
          disabled: !drawable,
          onclick: () => { keepPlot(); commit('draw'); },
        }),
        btn(t('action.done', 'Done'), {
          variant: 'primary', block: false,
          disabled: !drawable && !done,
          onclick: () => {
            if (drawable) keepPlot();
            d.areaHa = d.plots.reduce((s, p) => s + p.areaHa, 0);
            if (tooSmall || tooBig) {
              openModal('CONFIRM', {
                title: t('a9d.confirm.title', 'Is that the right size?'),
                body: tooSmall
                  ? t('a9d.confirm.small', 'This boundary is under 0.1 hectares. If that is correct, carry on.')
                  : t('a9d.confirm.big', 'This boundary is over 10,000 hectares. If that is correct, carry on.'),
                confirmLabel: t('action.continue', 'Continue'),
                onConfirm: () => go('A13'),
              });
            } else go('A13');
          },
        }))),
  };
}

/* -- A10 · Survey my whole farm, WF4.070 … WF4.077 ------------------------
   One polygon around everything the farmer holds, buildings and all. The point
   of asking for the buildings is that the algorithm has to be told where to
   stop looking; nothing built is reported back, and nothing built is charged
   for.

   The farm's NAME is not asked for here. It used to be the last field before
   the button, and it is the wrong question at the wrong moment: the farmer has
   just traced a boundary and wants to know what it costs, not to be held up
   naming something he has one of. So the farm is named automatically and can be
   renamed at any time in Farm settings — which is where somebody who cares
   about the name will look for it anyway. */

/** The automatic name a new farm arrives with, and can leave behind at will. */
export function autoFarmName() {
  return t('farm.auto', 'Farm {n}', { n: num(state.db.farms.length + 1) });
}

export function A10() {
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
      title: t('a10.title', 'Your farm boundary'),
      actions: [barAction('undo', t('action.undo', 'Undo'), () => undoVertex(d.points), { disabled: !d.points.length })],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', minHeight: '220px', position: 'relative' } },
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),
        editor.node,
        placeSearch(t('a9d.search', 'Search a place or coordinates')),
        h('button.mapchip.mapchip--square', {
          style: { position: 'absolute', insetInlineEnd: '12px', bottom: '12px' },
          onclick: () => toast(t('a9d.located', 'Centred on your position')),
        }, icon('locate', 19), t('map.locate', 'Locate'))),
      h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--paper)' } },
        h('div', h('span.num', area(areaHa))),
        when(editor.invalid, () => disclaimer(
          t('a9d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('a10.help', 'Draw around everything you hold — fields, trees, buildings and all. We work out what is farmed, and what your subscription will cost.')),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('a10.autoname', 'We will call it {name} for now. You can rename it whenever you like, in Farm settings.',
            { name: autoFarmName() })))),
    dock: actionDock(
      // Review C082 — "sent for quote", not "sent for survey". The survey is
      // how we do it; the quote is what the farmer is waiting for, and it costs
      // him nothing to ask for one.
      btn(t('a10.send', 'Send for quote'), {
        variant: 'primary',
        disabled: d.points.length < 3 || editor.invalid,
        onclick: () => {
          // WF4.072 — the farm record is created at once and the farmer goes
          // back to work. No progress screen: this takes a quarter of an hour,
          // and nobody should be asked to watch it.
          const farm = addFarm({
            name: autoFarmName(), type: d.farmType ?? 'mixed', areaHa, survey: 'surveying',
          });
          resetLocal('signup');
          enterApp('owner');
          toast(t('a10.started', 'Survey started for {name}. We will tell you when it is ready.', { name: farm.name }));
        },
      }),
      // WF4.073 — the wait is stated, and it is server configuration rather
      // than a constant, which is why it reads as a range.
      h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('a10.wait', 'Usually ready in 15–20 minutes'))),
  };
}

/* -- A11 · What we found, WF4.078 … WF4.088 ------------------------------
   The map is the argument. A list of nine polygons means nothing on its own, so
   the colours and the rows are the same two classes and are read together — tap
   a row and the map says which shape it is. WF4.079 also forbids colour from
   being the only signal, so every row states its class in words.

   THREE THINGS ABOUT THIS SCREEN CHANGED, and each of them was a real
   complaint about the last version.

   The row now says what it is on the LEFT and what you can do about it on the
   RIGHT — Keep, Remove, Edit — instead of hiding "include this" behind a tick
   at the start of the line and everything else behind the word Edit. Removing
   is not deleting: the row greys out and the Keep button puts it straight back,
   because a farmer clearing four fields off a quote wants to be able to change
   his mind without redoing the survey.

   The five edits of WF4.081 are a TOOLBAR — Join, Split, Remove, Add — on one
   line, and choosing one asks which plots it applies to. Before, joining meant
   discovering that tapping a second row while a first was selected silently
   built a set, which nobody discovered.

   And a tree farm gets none of it (review C137–C144). A date grower with 8,000
   palms across nine blocks does not want a plot-by-plot menu; he wants to know
   how many trees were found, which kinds, and what that costs. So when the
   coverage is trees only, this screen is a count and a choice of tree type. */

export function A11(farmId) {
  const farm = farmById(farmId);
  const raw = rawFarm(farmId);
  const ui = local(`a11-${farmId}`, { selected: null });
  const totals = surveyTotals(raw);
  const areas = totals.areas;
  const treesOnly = farm.type === 'trees';

  const confirm = btn(t('a11.confirm', 'Confirm and continue'), {
    variant: 'primary',
    disabled: totals.cropHa === 0 && totals.treeCount === 0,
    // Review C154/C155 — no name-confirmation screen in between. The survey is
    // confirmed and the price follows from it.
    onclick: () => { confirmSurvey(farm.id); go(`A13:${farm.id}`); },
  });

  return {
    tabs: false,
    top: appBar({ title: t('a11.title', 'What we found'), subtitle: farm.name }),
    body: page(
      h('div.mapbox', { style: { height: '215px', borderRadius: 'var(--radius)' } },
        landUseSvg({
          areas, selectedId: ui.selected,
          fills: Object.fromEntries(LAND_USE.map((k) => [k, LAND_USE_META[k].fill])),
          onTap: (a) => { ui.selected = ui.selected === a.id ? null : a.id; commit('a11'); },
        })),

      treesOnly ? treeScope(raw, farm, totals) : plotScope(raw, farm, ui, totals, areas),

      // Review C151 — the button lives in the totals box, so it arrives when
      // the farmer has actually reached the end of the list. A docked button
      // sat over the plots the whole way down, inviting a tap before anything
      // had been read.
      scopeTotals(totals, confirm)),
  };
}

/* The plot-by-plot case: crops, or crops and trees together. */
function plotScope(raw, farm, ui, totals, areas) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    // WF4.079 — read once and remembered, which beats repeating a colour word
    // on every row.
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' } },
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
      t('a11.lead', 'We looked inside your boundary and found {n} plots. Keep what we should watch, and correct anything we read wrongly.',
        { n: num(areas.length) })),

    // WF4.081 — one line, four tools. Each opens a picker naming the plots it
    // can act on, so the operation and its target are one gesture apart.
    h('div', { style: { display: 'flex', gap: '8px' } },
      areaTool('grid', t('a11.join', 'Join'), () => openSheet('AREA_TOOL', { farmId: farm.id, tool: 'join' }),
        { disabled: areas.length < 2 }),
      areaTool('split', t('a11.split', 'Split'), () => openSheet('AREA_TOOL', { farmId: farm.id, tool: 'split' }),
        { disabled: !areas.length }),
      areaTool('trash', t('a11.remove', 'Remove'), () => openSheet('AREA_TOOL', { farmId: farm.id, tool: 'remove' }),
        { disabled: !areas.length }),
      // Review C126 — no + beside Add. The word is the action.
      areaTool('edit', t('a11.add', 'Add'), () => { const added = addArea(raw); ui.selected = added.id; commit('a11'); })),

    card({}, areas.map((a) => areaRow(raw, a, ui))),

    h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      t('a11.edithint', 'Remove takes a plot out of the quote and greys it out. Keep puts it back.'),
      req('WF4.081')));
}

/**
 * One tool on the A11 toolbar.
 *
 * Four of them share one line at 360 dp, which is 82 dp each — so the glyph
 * sits ABOVE its word rather than beside it. Side by side, "Remove" and its
 * icon ran past the edge of the screen and took the whole page into a sideways
 * scroll, which WF2.002 forbids and which is the kind of thing a phone hides
 * until somebody reviews on a small one.
 */
function areaTool(iconName, label, onclick, opts = {}) {
  return h('button.areatool', { onclick, disabled: opts.disabled, type: 'button' },
    icon(iconName, 20), h('span', label));
}

/* Review C137 … C144 — the trees-only case. No plot menus: a count, the kinds
   of tree found, and the choice of which of them to include. The price is per
   tree, so the tree count IS the quote and everything else is noise. */
function treeScope(raw, farm, totals) {
  const kinds = treeKinds(raw);
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
      t('a11.treelead', 'We counted the trees inside your boundary. Choose which kinds you want us to watch.')),
    card({}, cardPad(
      h('span.bignum', t('farm.treecount', '{n} trees', { n: num(totals.treeCount) })),
      h('div', { style: { color: 'var(--ink-600)' } },
        t('a11.treearea.sub', 'across {area}', { area: area(totals.treeHa) })))),
    card({}, kinds.map((k) => h('div.row',
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('tree', 20)),
      h('div.row__main',
        h('div.row__title', k.label),
        h('div.row__sub', t('farm.treecount', '{n} trees', { n: num(k.treeCount) }))),
      btn(k.included ? t('a11.keep', 'Keep') : t('a11.include', 'Put back'), {
        variant: k.included ? 'emphasis' : 'secondary', size: 'sm', block: false,
        onclick: () => { for (const id of k.ids) setAreaIncluded(raw, id, !k.included); commit('a11'); },
      })))));
}

/* The tree blocks a survey found, grouped by the kind of tree standing in them.
   The kind is not on the area record — the algorithm reports canopy, not
   variety — so the fixtures' own species list stands in for it, split
   deterministically so a reviewer sees the same answer twice. */
const TREE_KINDS = ['Date palm', 'Citrus', 'Mango'];

function treeKinds(raw) {
  const groups = new Map();
  decidedAreas(raw).filter((a) => a.kind === 'trees').forEach((a, i) => {
    const label = TREE_KINDS[i % TREE_KINDS.length];
    const g = groups.get(label) ?? { label: t(`crop.${label.toLowerCase().replace(/\s/g, '')}`, label), ids: [], treeCount: 0, included: false };
    g.ids.push(a.id);
    g.treeCount += a.treeCount;
    g.included = g.included || a.included;
    groups.set(label, g);
  });
  return [...groups.values()];
}

/* WF4.084 — the totals move as the farmer changes anything, because they are
   what the price is about to be calculated from.

   What is NOT here any more is the "left out" line. It printed the hectares the
   farmer had just decided he did not want, under a sentence explaining that we
   were keeping a record of them — which reads as a charge he has not agreed to
   and a fact about his land he did not ask us to hold. Removed ground is simply
   not in the quote (review C145, C152). */
function scopeTotals(totals, confirmButton) {
  return card({}, cardPad(
    h('div', { style: { fontWeight: 650 } }, t('a11.scope', 'What we will watch')),
    kv([
      totals.cropHa ? [t('a11.croparea', 'Field crops'), area(totals.cropHa)] : null,
      totals.treeCount
        ? [t('a11.treearea', 'Trees'), `${area(totals.treeHa)} · ${t('farm.treecount', '{n} trees', { n: num(totals.treeCount) })}`]
        : null,
    ]),
    // WF4.091 — NO PRICE HERE, and none anywhere before a survey is confirmed.
    // The quantities on this screen are still being edited: every Keep, Remove
    // and Join changes what is in scope, so any figure printed beside them is a
    // number the farmer might reasonably hold us to and that we would then have
    // to revise. Pricing follows the scope; it does not run alongside it.
    confirmButton));
}

const LAND_USE_LABEL = {
  crops: 'Field crops',
  trees: 'Date palms and fruit trees',
};

const LAND_USE_SHORT = {
  crops: 'Field crops',
  trees: 'Trees',
};

/* Review C112 / C113 — the name reads on the left, the three things you can do
   about it sit on the right, in the order you would want them: Keep what is
   good, Remove what is not, Edit what is nearly right. */
function areaRow(farm, a, ui) {
  const meta = LAND_USE_META[a.kind];
  const selected = ui.selected === a.id;
  return h(`div.row${selected ? '.row--sel' : ''}`, {
    style: { alignItems: 'center', gap: '6px', opacity: a.included ? 1 : 0.55 },
  },
  h('button.row__main', {
    style: { textAlign: 'start', background: 'none', border: 0, padding: 0, cursor: 'pointer', minWidth: 0 },
    onclick: () => { ui.selected = selected ? null : a.id; commit('a11'); },
  },
  h('div.row__title', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
    h('span', { style: { color: meta.fill, display: 'flex' } }, icon(meta.icon, 18)),
    h('span', { style: { whiteSpace: 'nowrap' } }, a.label)),
  // WF4.079 — the class in words, because colour is never the only signal.
  h('div.row__sub',
    `${t(`landuse.${a.kind}`, LAND_USE_LABEL[a.kind])} · ${a.kind === 'trees' && a.treeCount
      ? `${area(a.areaHa)} · ${t('farm.treecount', '{n} trees', { n: num(a.treeCount) })}`
      : area(a.areaHa)}`)),

  h('div', { style: { display: 'flex', gap: '4px', flex: '0 0 auto' } },
    a.included
      ? rowAction('trash', t('a11.remove', 'Remove'), () => { setAreaIncluded(farm, a.id, false); commit('a11'); })
      : rowAction('check', t('a11.keep', 'Keep'), () => { setAreaIncluded(farm, a.id, true); commit('a11'); }, { on: true }),
    rowAction('edit', t('action.edit', 'Edit'), () => openSheet('AREA_EDIT', { farmId: farm.id, areaId: a.id }))));
}

function rowAction(iconName, label, onclick, opts = {}) {
  return h('button.iconbtn.iconbtn--bare', {
    onclick, 'aria-label': label, title: label, type: 'button',
    style: opts.on ? { color: 'var(--brand-700)' } : null,
  }, icon(iconName, 20), h('span.iconbtn__label', label));
}

/* -- A12 · What should we cover? ------------------------------------------
   One question, asked BEFORE the survey runs rather than after it, and it is
   not the question this screen used to ask.

   It used to ask two things: what the farm is called, and what is growing on
   it. Both have gone, for different reasons.

   The NAME went because confirming it is a screen the farmer has to read and
   agree to before he is allowed to see a price, in exchange for a fact he can
   change later in two taps. Farms are named automatically now, and renamed in
   Farm settings.

   "What is growing on it" went because the survey detects that, and a question
   whose answer we already hold is a chance for the farmer to be wrong. What
   replaces it is a commercial question the survey cannot answer: what does he
   want COVERED. A date grower with two hundred hectares of fallow ground beside
   his palms should not be quoted for the fallow, and a vegetable farmer with a
   windbreak of eucalyptus should not be quoted per tree for it. Asking first
   also stops the survey coming back full of areas he has to switch off one by
   one.

   WF4.048's wording travels with the options: the tree category is "date palms
   and fruit trees" everywhere in the app, never "orchard", which is not the
   local term. */

const COVERAGE = [
  {
    id: 'crops', icon: 'sprout',
    label: ['farmtype.crops', 'Field crops'],
    sub: ['a12.crops.sub', 'Everything you sow and harvest — wheat, alfalfa, potato, tomato'],
  },
  {
    id: 'trees', icon: 'tree',
    label: ['farmtype.trees', 'Date palms and fruit trees'],
    sub: ['a12.trees.sub', 'Counted and priced per tree — date palm, citrus, mango, grape'],
  },
  {
    id: 'mixed', icon: 'grid',
    label: ['farmtype.mixed', 'Both'],
    sub: ['a12.mixed.sub', 'One subscription covering the fields and the trees'],
  },
];

export function A12(farmId) {
  const d = draft();
  const farm = farmId ? farmById(farmId) : null;
  if (farm && !d.farmType) d.farmType = farm.type;
  const chosen = d.farmType;
  const next = d.route === 'plots' ? 'A9D' : 'A10';

  return {
    tabs: false,
    top: appBar({ title: t('a12.title', 'What should we cover?') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a12.lead', 'We will look for both, and watch — and charge for — only what you pick here. You can change it later.')),

      card({}, COVERAGE.map((option) => h('button.row', {
        onclick: () => {
          d.farmType = option.id;
          state.session.coverage = option.id;
          commit('a12');
        },
      },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(option.icon, 22)),
      h('div.row__main',
        h('div.row__title', t(...option.label)),
        h('div.row__sub', t(...option.sub))),
      when(option.id === chosen, () => h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('check', 22)))))),

      // WF4.108 — a mixed farm needs the combined service, and the app says so here.
      when(chosen === 'mixed', () => disclaimer(
        t('a12.mixed', 'A farm with both crops and trees needs the combined service — one price, one renewal date. We will show you that next.'))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('a12.optional', 'We work out what is actually there from the imagery. This only says what you want us to watch.'),
        req('WF4.047', 'WF4.048', 'WF4.049', 'WF4.050', 'WF4.095'))),
    dock: actionDock(btn(t('action.continue', 'Continue'), {
      variant: 'primary',
      disabled: !chosen,
      onclick: () => {
        if (farm) { rawFarm(farm.id).type = chosen; go(`A13:${farm.id}`); } else go(next);
      },
    })),
  };
}

/* -- A13 · Your plan and price, WF4.089 … WF4.111 -------------------------
   The price is arithmetic the farmer can follow, not a number handed down:
   WF4.099 asks for the quantity, the rate and the result, all three on the
   card. That is why the rates below are per tree and per hectare rather than a
   plan price with a multiplier — a farmer who counts 1,180 trees should be able
   to see 1,180 in the sum.

   WF4.102 puts the rates on the server, so nothing here is a published price:
   these stand in for a configuration fetch, and the app holds no rate of its
   own in the real product. */

export const RATES = {
  // USD per hectare of included crop area, per month.
  crop: { basic: 10.67, pro: 16.0 },
  // USD per included tree, per month. SAR 1.00 and SAR 1.50 at 3.75.
  tree: { basic: 0.2667, pro: 0.40 },
};

/* Two levels, and neither is "the recommended one". Whatever the app pushes,
   the farmer has to work out why it is being pushed. */
const LEVELS = [
  { tier: 'basic', name: 'Basic' },
  { tier: 'pro', name: 'Pro' },
];

const BLURB = {
  crop: {
    basic: 'Health, water stress, weather, fertiliser insights, disease forecasting, farm activity tracking',
    pro: 'Everything in Basic, plus irrigation scheduling, 1 m imagery, growth stages, photo disease checking, custom alerts',
  },
  tree: {
    basic: 'Health, water stress, weather, tree list, disease directory',
    pro: 'Everything in Basic, plus irrigation scheduling, disease forecasting, per-tree detail, 15-day weather',
  },
  combined: {
    basic: 'Crop Basic and Tree Basic across every farm on the account',
    pro: 'Crop Pro and Tree Pro across every farm on the account',
  },
};

/**
 * WF4.099 — the sum, so the card can print it rather than assert a total.
 *
 * The rate has to be restated in the unit the quantity is shown in. The rates
 * above are per hectare, but a Saudi farmer reads dunum, and "124 dunum × SAR
 * 40" printed beside a total of SAR 1,959 is arithmetic that visibly does not
 * work — which is worse than showing no working at all.
 */
function priceLines(family, tier, totals, country) {
  const lines = [];
  let usd = 0;
  if (family !== 'tree' && totals.cropHa > 0) {
    usd += totals.cropHa * RATES.crop[tier];
    lines.push(`${area(totals.cropHa)} × ${priceBare(perAreaUnit(RATES.crop[tier]), country)}`);
  }
  if (family !== 'crop' && totals.treeCount > 0) {
    usd += totals.treeCount * RATES.tree[tier];
    lines.push(`${t('farm.treecount', '{n} trees', { n: num(totals.treeCount) })} × ${priceBare(RATES.tree[tier], country)}`);
  }
  return { usd, lines };
}

/**
 * The drawing route has no survey, so the quantities come from what was traced
 * and what the farmer said grows there.
 *
 * A mixed farm has to SPLIT the traced area between crops and trees rather than
 * counting it as both — the survey path does that naturally, because its areas
 * are disjoint polygons, and the fallback used to charge the same hectares once
 * as crop ground and again as the trees standing on it.
 */
function drawnTotals(d) {
  const traced = d.areaHa ?? 12.4;
  const cropShare = d.farmType === 'trees' ? 0 : d.farmType === 'mixed' ? traced / 2 : traced;
  const treeShare = d.farmType === 'crops' ? 0 : traced - cropShare;
  return {
    cropHa: Math.round(cropShare * 10) / 10,
    treeHa: Math.round(treeShare * 10) / 10,
    treeCount: Math.round(treeShare * TREES_PER_HA),
  };
}

/* The plan cards, and the commercial facts that go with them.

   Six things about this page came out of review, and all six are about trust
   rather than layout:

     * Compare all features is at the TOP. At the bottom it was below two price
       cards and a trial line, and nobody who had not already decided ever
       scrolled to it — which made the comparison table the app's best-argued
       screen and its least-read one.
     * Both Choose buttons are the same neutral colour. A green button on one
       card and a grey one on the other is the app choosing for the farmer, and
       the "Most chosen" badge that went with it was an assertion nobody could
       check.
     * The page shows only what the farmer asked to be covered. He answered
       crops-or-trees-or-both before the survey ran; repeating tree features to
       somebody who grows wheat is the repetition the comparison table was
       already criticised for.
     * The annual discount, the VAT position, when permission is asked for, and
       the free trial are all stated. They were scattered, absent, or in eight
       point at the bottom of the screen.
     * The warnings are one block, in one place, at the end.
*/

const ANNUAL_DISCOUNT = 0.15;   // WF4.102 puts the real figure on the server.

export function A13(farmId) {
  const d = draft();
  const farm = farmId ? farmById(farmId) : null;
  const raw = farmId ? rawFarm(farmId) : null;

  // WF4.091 — no price before a survey has completed and been confirmed. There
  // is nothing to multiply until then, and inventing a number here is exactly
  // the guess the survey exists to remove.
  if (raw?.survey && raw.survey.state !== 'confirmed') {
    return {
      tabs: false,
      top: appBar({ title: t('a13.title', 'Your plan'), subtitle: farm.name }),
      body: page(
        card({}, cardPad(
          h('div', { style: { fontWeight: 650 } }, t('a13.surveying', 'The survey is still running')),
          h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
            t('a13.surveying.body', 'We price your plan from what the survey finds, so there is nothing to show yet. We will tell you the moment it is ready.')))),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, req('WF4.091'))),
    };
  }

  const totals = raw?.survey ? surveyTotals(raw) : drawnTotals(d);
  const family = totals.cropHa > 0 && totals.treeCount > 0 ? 'combined'
    : totals.treeCount > 0 ? 'tree' : 'crop';

  return {
    tabs: false,
    top: appBar({ title: t('a13.title', 'Your plan'), subtitle: farm?.name }),
    body: page(
      // WF9.029 — thirty days, said first and said plainly. It was a grey line
      // under the fold, which is where a free trial goes to be missed.
      card({ accent: 'good' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { color: 'var(--st-good)', display: 'flex' } }, icon('check', 22)),
          h('span', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } },
            t('a13.trial', '30 days free, on either plan'))),
        h('div', { style: { color: 'var(--ink-700)' } },
          t('a13.trial.body', 'Nothing is taken until the trial ends, and we ask you before it is.')))),

      card({}, cardPad(
        h('div', { style: { fontWeight: 650 } }, farm?.name ?? t('a13.yourfarm', 'Your farm')),
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          [totals.treeCount ? t('farm.treecount', '{n} trees', { n: num(totals.treeCount) }) : null,
            totals.cropHa ? area(totals.cropHa) : null].filter(Boolean).join(' · ')))),

      // Where the comparison belongs: above the decision it informs.
      h('button.row', {
        onclick: () => go('F6'),
        style: { background: 'var(--paper)', borderRadius: 'var(--radius)', border: '1px solid var(--ink-200)' },
      },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('list', 21)),
      h('div.row__main', h('div.row__title', t('a13.compare', 'Compare all features'))),
      h('span.row__chev', icon('forward', 20, 'flip'))),

      // WF4.101 — always Basic then Pro, and neither of them dressed up.
      LEVELS.map((level) => {
        const { usd, lines } = priceLines(family, level.tier, totals, d.country);
        const key = `${family === 'combined' ? 'combined' : family}_${level.tier}`;
        return card({}, cardPad(
          h('span', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)' } },
            t(`plan.${level.tier}`, level.name).toUpperCase()),
          // WF4.102 — the farmer's own currency, from a server rate. Review
          // S34: the figure is exclusive of VAT and says so, because a farmer
          // who budgets from this number and then sees 15% more on the receipt
          // has been misled by a rounding of the truth.
          h('div.num', `${priceBare(usd, d.country)} / ${t('unit.month', 'month')}`),
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)', fontWeight: 600 } },
            t('a13.plusvat', '+ VAT')),
          // WF4.099 — the working, not just the answer.
          lines.map((l) => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, l)),
          // Review S32 — the annual option and what it saves, on the card where
          // the monthly figure it is measured against already is.
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-700)' } },
            t('a13.annual', 'Or {price} a year — 15% off, paid once, for twelve months.', {
              price: priceBare(usd * 12 * (1 - ANNUAL_DISCOUNT), d.country),
            })),
          h('p', { style: { margin: '4px 0 0', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
            t(`a13.blurb.${family}.${level.tier}`, BLURB[family][level.tier])),
          // Review S03 — the same button on both cards. The farmer picks.
          btn(t('a13.choose', 'Choose'), {
            variant: 'secondary', size: 'sm',
            onclick: () => {
              d.plan = key;
              state.session.plan = key;
              commit('a13');
              if (farm) {
                enterApp('owner');
                toast(t('a13.done', '{name} is on {plan}', { name: farm.name, plan: t(`plan.${key}`, level.name) }));
              } else go('A14');
            },
          })));
      }),

      // Review S06 — one block, at the end, holding everything that qualifies
      // the prices above. Scattered through the page these read as small print
      // hidden in three different places.
      section(t('a13.beforeyoubuy', 'Before you buy'), {},
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          when(family === 'combined', () => disclaimer(
            // WF4.107 — one product, one price, one renewal date. Never two.
            t('a13.combined', 'You have crops and trees, so this is one combined subscription — a single price and a single renewal date.'))),
          // Review S35 — say when money moves, before it moves.
          disclaimer(t('a13.permission', 'We ask your permission before taking any payment. Nothing is charged during the free trial.')),
          // WF9.020 / WF9.023 — the in-app route is the only one named here. The
          // web route exists but the app must not describe or link to it in KSA
          // or the UAE, so it is not mentioned at all.
          disclaimer(t('a13.iap', 'Payment is handled by the App Store or Google Play. You can cancel any time from your store account.')),
          disclaimer(t('a13.annual.commit', 'An annual subscription runs for twelve months and renews once a year. A monthly one renews every month.'))))),
  };
}

/* -- A14 · You're ready, WF4.112 ------------------------------------------ */

export function A14() {
  const d = draft();
  // Nobody was asked to name the farm, so it arrives with the name we gave it
  // and the farmer meets that name here rather than being surprised by it on
  // Home. Resolved once per render so the two uses below agree.
  const farmName = d.farmName || autoFarmName();
  return {
    tabs: false,
    body: h('div.page', { style: { paddingTop: 'calc(var(--safe-top) + 40px)', alignItems: 'center', textAlign: 'center', gap: '18px' } },
      h('div', {
        style: {
          width: '92px', height: '92px', borderRadius: '50%', background: 'var(--st-good-bg)',
          color: 'var(--st-good)', display: 'grid', placeItems: 'center',
        },
      }, icon('check', 52)),
      h('h1', { style: { margin: 0, fontSize: 'var(--t-head)' } }, t('a14.title', 'You’re ready')),
      h('p', { style: { margin: 0, color: 'var(--ink-700)', maxWidth: '30ch' } },
        t('a14.watchlist', '{farm} is being added to our satellite watchlist.', { farm: farmName })),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '30ch' } },
        t('a14.first', 'Your first images will arrive within 48 hours. We will notify you when they do.')),
      h('p', { style: { margin: 0, color: 'var(--ink-500)', fontSize: 'var(--t-meta)', maxWidth: '32ch' } },
        t('a14.rename', 'Call it something else whenever you like — Farm settings.')),
      h('div', { style: { flex: '1 1 auto' } })),
    dock: actionDock(
      btn(t('a14.go', 'Go to my farm'), {
        variant: 'primary', size: 'big',
        onclick: () => {
          addFarm({ name: farmName, type: d.farmType ?? 'crops', areaHa: d.areaHa, plots: d.plots });
          resetLocal('signup');
          enterApp('owner');                   // WF4.002 — creating a farm makes you its Owner
        },
      }),
      h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('a14.trial', 'Trial: 30 days remaining'))),
  };
}

/* -- A15 · Join a farm, WF4.113 … WF4.117 ---------------------------------
   Redeeming a code is an ATTACHMENT, not a registration. The owner already made
   a record for this person — that is what the code is bound to — so joining
   walks up to a record that has their language, their notification preferences
   and everything they have already finished on it, and puts an account on the
   front of it. Nothing is carried across because nothing moves. */

export function A15() {
  const d = local('join', { code: '', error: null });
  const cells = d.code.padEnd(6, ' ').split('');

  const type = (key) => {
    if (key === 'del') d.code = d.code.slice(0, -1);
    else if (d.code.length < 6) d.code += key;
    d.error = null;
    commit('a15');
  };

  const join = () => {
    // WF4.116 — a used, expired or revoked invitation says so clearly, and
    // never grants partial access.
    if (d.code.toUpperCase() === 'EXPIRE') {
      d.error = 'expired'; commit('a15'); return;
    }
    const asWorker = !d.code.toUpperCase().startsWith('S');
    // The code names the person record it was issued against. Attaching is what
    // makes this the same person the owner has been sending work to all along,
    // rather than a second, empty identity with the same phone number.
    const invite = state.db.invitations.find((i) => i.code === d.code.toUpperCase() && i.workerId);
    const joined = invite ? attachAccount(invite.workerId, `user-${invite.workerId}`) : null;
    resetLocal('join');
    // WF4.003 — the role comes from the invitation and is never chosen here.
    // WF4.117 — a Worker lands on My Work; a Supervisor on Home, farm-scoped.
    enterApp(asWorker ? 'worker' : 'supervisor');
    toast(joined
      ? t('a15.joined.back', 'Welcome back, {name}. Your work is already here.', { name: joined.name })
      : asWorker
        ? t('a15.joined.worker', 'You have joined Al Kharj North as a Farm Worker')
        : t('a15.joined.sup', 'You have joined Al Kharj North as a Farm Supervisor'));
  };

  return {
    tabs: false,
    top: appBar({ title: t('a15.title', 'Join a farm'), onBack: () => go('A2', { replace: true }) }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('a15.enter', 'Enter the code you were sent')),
      h('div.otp', cells.map((c, i) => h(`div.otp__cell${c.trim() ? '.otp__cell--filled' : ''}${i === d.code.length ? '.otp__cell--focus' : ''}`,
        { style: { display: 'grid', placeItems: 'center', width: '40px' } }, c.trim()))),
      when(d.error === 'expired', () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        disclaimer(t('a15.expired', 'That invitation has already been used or has expired. Invitations last 7 days and work once.'), true),
        btn(t('a15.contactowner', 'Contact the farm owner'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),
      h('div.keypad', ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'K', '0', 'del'].map((k) => (
        h('button', { onclick: () => type(k) }, k === 'del' ? icon('back', 22, 'flip') : k)))),
      // WF4.114 — the QR code on the inviter's screen is one of the four routes.
      btn(t('a15.scan', 'Scan QR code'), { variant: 'secondary', icon: 'qr', onclick: () => openModal('QR_SCAN') }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a15.carryover', 'If they have already been sending you work, everything you have finished is waiting on the other side of this code.')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a15.nocode', 'No code? Ask the farm owner to send you one.')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a15.mockhint', 'Mockup: any 6 characters join as a Worker. Start with S to join as a Supervisor. Type EXPIRE to see the expired-invitation message.'))),
    dock: actionDock(btn(t('a15.join', 'Join'), {
      variant: 'primary', disabled: d.code.length < 6, onclick: join,
    })),
  };
}
