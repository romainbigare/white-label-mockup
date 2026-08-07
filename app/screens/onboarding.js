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
     * The tour is at A4, AFTER the language and AFTER the user has said they
       are new (WF4.030). A returning user logging in never sees it, and it runs
       in their own language because A1 has already happened.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local, resetLocal } from '../core/local.js';
import { t, LANGUAGES, setLanguage, langMeta } from '../core/i18n.js';
import { go, back, enterApp, openModal, openSheet } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { logo } from '../ui/brand.js';
import {
  appBar, barAction, page, card, cardPad, btn, actionDock, field,
  input, select, checkbox, disclaimer, req, kv, chips,
} from '../ui/components.js';
import { area, priceBare, perAreaUnit, num } from '../core/format.js';
import { boundaryCanvas, undoVertex, starterPolygon } from '../ui/boundaryEditor.js';
import { mapSvg, landUseSvg } from '../ui/map.js';
import { addFarm, confirmSurvey } from '../data/actions.js';
import {
  surveyTotals, LAND_USE, LAND_USE_META, TREES_PER_HA,
  splitArea, joinAreas, removeArea, addArea, setAreaKind, setAreaIncluded,
} from '../data/survey.js';
import { farmById, rawFarm } from '../data/selectors.js';

/* The draft an owner builds across A5 → A14. One object, one flow. */
const draft = () => local('signup', {
  country: 'SA', phone: '', email: '', agreed: false, code: '',
  name: '', password: '', showPassword: false, areaUnit: null,
  grows: null, farmName: '', farmType: null, soil: '',
  points: [], plots: [], plotCrop: '', plan: null, tourCard: 0, attempts: 0,
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
   Three doors and nothing else. WF4.017 is unusually specific about what must
   NOT be here — no number field, no password field, no checkbox, no terms line
   — and the reason is that this screen used to be a login form with "create an
   account" underneath it. A returning user, a new user and an invited worker
   want three different things, and asking them all to look at a phone-number
   field first serves only one of the three.

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
      h('div', { style: { flex: '1 1 auto' } }),
      doorCard('login', t('action.login', 'Log in'), null, () => go('A3')),
      doorCard('user', t('a2.create', 'Create an account'), null, () => go('A4')),
      doorCard('users', t('a2.join', 'Join a farm'), t('a2.join.sub', 'I have an invitation'), () => go('A15')),
      h('div', { style: { flex: '1 1 auto' } }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        req('WF4.017'))),
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

/* -- A4 · Guided tour, WF4.026 … WF4.031 ----------------------------------
   Still images with a caption, not a live interface with banners over it and
   not a demo account (WF4.026). A tour built out of the real app has to be
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

export function A4() {
  const d = draft();
  const i = Math.min(d.tourCard, TOUR.length - 1);
  const c = TOUR[i];
  const last = i === TOUR.length - 1;
  return {
    tabs: false,
    top: h('div.app__top', h('div.appbar',
      h('div.appbar__spacer'),
      // WF4.029 — Skip is on every snapshot, and goes straight to A5.
      h('button.iconbtn', { onclick: () => go('A5'), style: { minWidth: 'auto', padding: '0 14px' } },
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
    dock: actionDock(btn(last ? t('a4.start', 'Create my account') : t('action.next', 'Next'), {
      variant: 'primary',
      onclick: () => { if (last) go('A5'); else { d.tourCard = i + 1; commit('a4'); } },
    })),
  };
}

/* -- A5 · Sign up, WF4.032 … WF4.037 --------------------------------------
   Both a number and an email (WF4.032). The email is not a nicety: WF9.021
   writes a licence bought on the web against the account, and without an
   address there is nothing to write it against. */

export function A5() {
  const d = draft();
  const countries = state.db.countries;
  const priority = countries.filter((c) => c.priority);   // WF4.035 — GCC + Jordan on top
  const rest = countries.filter((c) => !c.priority);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim());

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
            type: 'tel', inputmode: 'tel', placeholder: '5X XXX XXXX', value: d.phone,
            oninput: (e) => { d.phone = e.target.value; },
            onchange: (e) => {
              // WF4.036 — spaces and dashes normalise; a leading zero is stripped.
              d.phone = e.target.value.replace(/[\s-]/g, '').replace(/^0+/, '');
              commit('a5');
            },
          })),
        { required: true, hint: t('a5.hint', 'Spaces and dashes are fine. A leading zero is removed.') }),
      field(t('a5.email', 'Email address'), input({
        type: 'email', inputmode: 'email', autocomplete: 'email', value: d.email,
        placeholder: 'name@example.com',
        oninput: (e) => { d.email = e.target.value; },
        onchange: () => commit('a5'),
      }), {
        required: true,
        hint: t('a5.email.hint', 'Your reports go here, and it is how your account is found.'),
      }),
      // WF4.037 — unticked by default; Terms and Privacy open in-app.
      checkbox(h('span', t('a5.terms.pre', 'I agree to the '),
        link(t('a5.terms', 'Terms of Use'), () => openModal('LEGAL', { doc: 'terms' })),
        t('a5.and', ' and '),
        link(t('a5.privacy', 'Privacy Policy'), () => openModal('LEGAL', { doc: 'privacy' }))),
        d.agreed, (v) => { d.agreed = v; commit('a5'); })),
    dock: actionDock(btn(t('a5.send', 'Send code'), {
      variant: 'primary',
      disabled: !d.agreed || d.phone.replace(/\D/g, '').length < 6 || !emailOk,
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
  return {
    tabs: false,
    top: appBar({ title: t('a6.title', 'Enter your code') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        // WF4.034 — the code goes to whichever identifier was given.
        t('a6.sent', 'We sent a 6-digit code to {to}', { to: `${dial} ${d.phone || '5X XXX XXXX'}` })),
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

const AREA_UNITS = [
  { id: 'dunum', label: 'Dunum' },
  { id: 'hectare', label: 'Hectare' },
  { id: 'acre', label: 'Acre' },
];

/* WF4.043 — dunum in the UAE, hectares in Saudi Arabia, acres elsewhere. */
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
        go('A8');                                                // WF4.045 — this route makes an Owner
      },
    })),
  };
}

/* -- A8 · What do you grow? WF4.047 … WF4.050 -----------------------------
   WF4.049 is a rule about the EXAMPLES, and it exists because the earlier list
   read "wheat, alfalfa, vegetables, fodder" — which names alfalfa twice, once
   as itself and once as the group it belongs to. Every example here is a single
   crop, on both cards.

   WF4.048: the tree category is "date palms and fruit trees" throughout the
   app. "Orchard" is not the local term. */

export function A8() {
  const d = draft();
  const pick = (value) => { d.grows = value; d.farmType = value; commit('a8'); go('A9'); };
  return {
    tabs: false,
    top: appBar({ title: t('a8.title', 'What do you grow?') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('a8.sub', 'You can change this later')),
      growCard('sprout', t('a8.crops', 'Field crops'),
        t('a8.crops.sub', 'Wheat, alfalfa, potato, tomato'), () => pick('crops')),
      growCard('tree', t('a8.trees', 'Date palms and fruit trees'),
        t('a8.trees.sub', 'Date palm, citrus, mango, grape'), () => pick('trees')),
      // WF4.050 — Both carries no example line. Its meaning is complete without one.
      growCard('leaf', t('a8.both', 'Both'), null, () => pick('mixed')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } }, req('WF4.049'))),
  };
}

function growCard(iconName, title, sub, onclick) {
  return card({ onclick }, cardPad(
    h('div', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(iconName, 28)),
    h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650 } }, title),
    when(sub, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, sub))));
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

export function A9() {
  return {
    tabs: false,
    top: appBar({ title: t('a9.title', 'Add your farm') }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { height: '170px', position: 'relative', flex: '0 0 auto' } },
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),
        placeSearch(t('a9.search', 'Search a place, address or coordinates'))),
      h('div', { style: { flex: '1 1 auto', overflow: 'auto' } }, page(
        routeCard('scan', t('a9.survey', 'Survey my whole farm'),
          t('a9.survey.sub', 'Draw the outer boundary and we find the plots and the trees'),
          () => { draft().route = 'survey'; go('A10'); }),
        routeCard('edit', t('a9.draw', 'Draw my plots myself'),
          t('a9.draw.sub', 'Trace each plot and tell us what is growing in it'),
          () => { draft().route = 'plots'; go('A9D'); }),
        h('p', { style: { margin: 0, color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          t('a9.later', 'You can add more plots or run a survey later.'), req('WF4.052')))),
    ),
  };
}

function routeCard(iconName, title, sub, onclick) {
  return card({ onclick }, cardPad(
    h('div', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(iconName, 28)),
    h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650 } }, title),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, sub)));
}

/* -- A9 · Draw my plots myself, WF4.058 … WF4.069 ------------------------- */

const CROPS = ['Alfalfa', 'Wheat', 'Potato', 'Tomato', 'Barley', 'Date palm', 'Citrus', 'Mango', 'Grape'];

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

  // WF4.061 — many plots per farm, each carrying its own crop.
  const keepPlot = () => {
    d.plots.push({ areaHa, crop: d.plotCrop || CROPS[0], points: d.points.map((p) => [...p]) });
    d.points = [];
    d.plotCrop = '';
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
      h('div.mapbox', { style: { flex: '1 1 auto', minHeight: '230px', position: 'relative' } },
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),   // WF4.058 — satellite by default
        editor.node,
        placeSearch(t('a9d.search', 'Search a place or coordinates')),
        h('button.mapchip.mapchip--square', {
          style: { position: 'absolute', insetInlineEnd: '12px', bottom: '12px' },
          onclick: () => toast(t('a9d.located', 'Centred on your position')),
        }, icon('locate', 19), t('map.locate', 'Locate'))),
      h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--paper)' } },
        h('div',
          h('span.num', area(areaHa)),                          // WF4.065
          req('WF4.065')),
        when(editor.invalid, () => disclaimer(
          t('a9d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        when(tooSmall, () => disclaimer(t('a9d.small', 'That is smaller than 0.1 ha. You can still save it — just checking it is right.'))),
        when(tooBig, () => disclaimer(t('a9d.big', 'That is larger than 10,000 ha. You can still save it — just checking it is right.'))),
        field(t('a9d.crop', 'What is growing here?'),
          select(CROPS.map((c) => ({ value: c, label: t(`crop.${c.toLowerCase().replace(/\s/g, '')}`, c) })),
            d.plotCrop || CROPS[0], (v) => { d.plotCrop = v; commit('draw'); })),
        when(done > 0, () => h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('a9d.saved', '{n} saved so far', { n: num(done) }))))),
    dock: actionDock(
      h('div', { style: { display: 'flex', gap: '10px' } },
        btn(t('a9d.addplot', 'Add a plot'), {
          variant: 'secondary', icon: 'plus', block: false,
          disabled: d.points.length < 3 || editor.invalid,
          onclick: () => { keepPlot(); commit('draw'); },
        }),
        btn(t('action.done', 'Done'), {
          variant: 'primary', block: false,
          disabled: (d.points.length < 3 || editor.invalid) && !done,
          onclick: () => {
            if (d.points.length >= 3 && !editor.invalid) keepPlot();
            d.areaHa = d.plots.reduce((s, p) => s + p.areaHa, 0);
            if (tooSmall || tooBig) {
              openModal('CONFIRM', {
                title: t('a9d.confirm.title', 'Is that the right size?'),
                body: tooSmall
                  ? t('a9d.confirm.small', 'This boundary is under 0.1 hectares. If that is correct, carry on.')
                  : t('a9d.confirm.big', 'This boundary is over 10,000 hectares. If that is correct, carry on.'),
                confirmLabel: t('action.continue', 'Continue'),
                onConfirm: () => go('A12'),
              });
            } else go('A12');
          },
        }))),
  };
}

/* -- A10 · Survey my whole farm, WF4.070 … WF4.077 ------------------------
   One polygon around everything the farmer holds, buildings and all. The point
   of asking for the buildings is that the algorithm has to be told where to
   stop looking, not that anyone is going to be charged for a shed — WF4.080
   excludes structures by default at the next screen. */

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
        field(t('a10.name', 'What do you call this farm?'),
          input({
            value: d.farmName, placeholder: t('a10.name.ph', 'Home farm'),
            oninput: (e) => { d.farmName = e.target.value; },
            onchange: () => commit('a10'),
          }),
          { required: true }))),
    dock: actionDock(
      btn(t('a10.send', 'Send for survey'), {
        variant: 'primary',
        disabled: d.points.length < 3 || editor.invalid || !d.farmName.trim(),
        onclick: () => {
          // WF4.072 — the farm record is created at once and the farmer goes
          // back to work. No progress screen: this takes a quarter of an hour,
          // and nobody should be asked to watch it.
          const farm = addFarm({ name: d.farmName.trim(), type: 'crops', areaHa, survey: 'surveying' });
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
   the colours and the rows are the same three classes and are read together —
   tap a row and the map says which shape it is. WF4.079 also forbids colour
   from being the only signal, so every row states its class in words.

   Everything here is editable now (WF4.081): split what the algorithm merged,
   join what it separated, redraw an outline, remove an area, add one it missed.
   The earlier build refused to reshape anything and told the farmer to exclude
   the bad shape and redraw it later, which turned one wrong outline into a
   detour through two more screens. */

export function A11(farmId) {
  const farm = farmById(farmId);
  const raw = rawFarm(farmId);
  const ui = local(`a11-${farmId}`, { selected: null, joining: [] });
  const totals = surveyTotals(raw);
  const areas = totals.areas;
  const joining = ui.joining ?? [];

  const after = (fn) => { fn(); ui.joining = []; commit('a11'); };

  return {
    tabs: false,
    top: appBar({ title: t('a11.title', 'What we found'), subtitle: farm.name }),
    body: page(
      h('div.mapbox', { style: { height: '215px', borderRadius: 'var(--radius)' } },
        landUseSvg({
          areas, selectedId: ui.selected,
          fills: Object.fromEntries(LAND_USE.map((k) => [k, LAND_USE_META[k].fill])),
          onTap: (a) => { ui.selected = a.id; commit('a11'); },
        })),

      // WF4.079 — read once and remembered, which beats repeating a colour word
      // on every row.
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
        t('a11.lead', 'We looked inside your boundary and found {n} areas. Keep what we should watch, and correct anything we read wrongly.',
          { n: num(areas.length) })),

      card({}, areas.map((a) => areaRow(raw, a, ui, joining, after))),

      // WF4.081 — the five edits, gathered where they act on the list rather
      // than repeated on every row.
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
        btn(t('a11.split', 'Split'), {
          variant: 'secondary', size: 'sm', block: false,
          disabled: !ui.selected,
          // splitArea replaces the area with two halves, so the id that was
          // selected no longer exists — leaving it set kept the button live
          // and a second press was a silent no-op.
          onclick: () => after(() => { splitArea(raw, ui.selected); ui.selected = null; }),
        }),
        btn(t('a11.join', 'Join'), {
          variant: 'secondary', size: 'sm', block: false,
          disabled: joining.length < 2,
          onclick: () => after(() => { const j = joinAreas(raw, joining); ui.selected = j?.id ?? null; }),
        }),
        btn(t('a11.remove', 'Remove'), {
          variant: 'secondary', size: 'sm', block: false,
          disabled: !ui.selected,
          onclick: () => after(() => { removeArea(raw, ui.selected); ui.selected = null; }),
        }),
        btn(t('a11.add', 'Add plot'), {
          variant: 'secondary', size: 'sm', icon: 'plus', block: false,
          onclick: () => after(() => { ui.selected = addArea(raw).id; }),
        })),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          joining.length
            ? t('a11.joinhint', '{n} selected to join. Tap one again to drop it.', { n: num(joining.length) })
            : t('a11.edithint', 'Tap an area to select it. Tap Edit on a row to redraw its outline.'),
          req('WF4.081')),
        when(joining.length, () => h('button.textlink', {
          style: { fontSize: 'var(--t-meta)' },
          onclick: () => { ui.joining = []; ui.selected = null; commit('a11'); },
        }, t('a11.clearsel', 'Clear')))),

      // WF4.084 — the totals move as the farmer changes anything, because they
      // are what the price is about to be calculated from.
      card({}, cardPad(
        h('div', { style: { fontWeight: 650 } }, t('a11.scope', 'What we will watch')),
        kv([
          [t('a11.croparea', 'Field crops'), area(totals.cropHa)],
          [t('a11.treearea', 'Trees'), totals.treeCount
            ? `${area(totals.treeHa, { bare: true })} · ${t('farm.treecount', '{n} trees', { n: num(totals.treeCount) })}`
            : t('a11.none', 'None')],
          [t('a11.excluded', 'Left out'), area(totals.excludedHa)],
        ]),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          // WF4.085 — excluded ground is stored, simply not analysed or charged.
          t('a11.keptout', 'Anything left out stays on record. Adding it later needs no second survey.'))))),

    dock: actionDock(btn(t('a11.confirm', 'Confirm and continue'), {
      variant: 'primary',
      disabled: totals.cropHa === 0 && totals.treeCount === 0,
      onclick: () => { confirmSurvey(farm.id); go(`A12:${farm.id}`); },
    })),
  };
}

const LAND_USE_LABEL = {
  crops: 'Field crops',
  trees: 'Date palms and fruit trees',
  structures: 'Covered agriculture and structures',
};

const LAND_USE_SHORT = {
  crops: 'Field crops',
  trees: 'Trees',
  structures: 'Excluded',
};

function areaRow(farm, a, ui, joining, after) {
  const meta = LAND_USE_META[a.kind];
  const selected = ui.selected === a.id;
  const marked = joining.includes(a.id);
  // No flex-wrap: the class name and the area are long enough together to push
  // Edit onto its own line, which reads as a second row for the same area.
  // They wrap INSIDE the main column instead, where wrapping is expected.
  return h(`div.row${selected ? '.row--sel' : ''}`, { style: { alignItems: 'flex-start' } },
    // WF4.083 — include or exclude, on the row, as the first thing read.
    h('button.iconbtn.iconbtn--bare', {
      onclick: () => { setAreaIncluded(farm, a.id, !a.included); commit('a11'); },
      'aria-label': a.included ? t('a11.exclude', 'Leave out') : t('a11.include', 'Put back'),
      title: a.included ? t('a11.exclude', 'Leave out') : t('a11.include', 'Put back'),
      style: { color: a.included ? 'var(--st-good)' : 'var(--ink-400)', flex: '0 0 auto' },
    }, icon(a.included ? 'check' : 'close', 20)),
    h('button.row__main', {
      style: { textAlign: 'start', background: 'none', border: 0, padding: 0, cursor: 'pointer', minWidth: 0 },
      onclick: () => {
        // A tap on the selected row deselects it; a tap on another row while
        // one is selected starts a join set. Without the first half the set
        // only ever grows, and looking at a third area to decide whether you
        // wanted it silently adds it to the join.
        if (ui.selected === a.id) {
          ui.selected = null;
          ui.joining = joining.filter((id) => id !== a.id);
        } else if (joining.includes(a.id)) {
          ui.joining = joining.filter((id) => id !== a.id);
          ui.selected = a.id;
        } else if (ui.selected) {
          ui.joining = [...new Set([ui.selected, ...joining, a.id])];
          ui.selected = a.id;
        } else {
          ui.selected = a.id;
        }
        commit('a11');
      },
    },
    h('div.row__title', { style: { display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'wrap' } },
      h('span', { style: { color: meta.fill, display: 'flex', alignSelf: 'center' } }, icon(meta.icon, 18)),
      // The label is the handle for the shape on the map above, so it never
      // breaks across two lines; the measurement beside it may.
      h('span', { style: { whiteSpace: 'nowrap' } }, a.label),
      h('span', { style: { color: 'var(--ink-600)', fontWeight: 500 } },
        a.kind === 'trees' && a.treeCount
          ? `${area(a.areaHa, { bare: true })} · ${t('farm.treecount', '{n} trees', { n: num(a.treeCount) })}`
          : area(a.areaHa, { bare: true })),
      when(marked, () => h('span.status.status--good', icon('check', 13), t('a11.tojoin', 'to join')))),
    // WF4.079 — the class in words, because colour is never the only signal.
    h('div.row__sub', t(`landuse.${a.kind}`, LAND_USE_LABEL[a.kind])),
    when(!a.included, () => h('div.row__sub', { style: { color: 'var(--st-nodata)' } }, t('a11.out', 'Left out')))),
    h('button.textlink', {
      style: { fontWeight: 600, fontSize: 'var(--t-meta)', color: 'var(--ink-600)', flex: '0 0 auto' },
      onclick: () => openSheet('AREA_EDIT', { farmId: farm.id, areaId: a.id }),
    }, t('action.edit', 'Edit')));
}

/* -- A12 · Farm details, WF4.095 … WF4.097 -------------------------------
   WF4.096 removes the irrigation system outright — drip, sprinkler, pivot,
   bubbler and mixed are out of scope, not asked, not stored, not shown. What
   the advisory layer actually needs to size a watering is efficiency and flow
   rate, and both of those live on the plot where they can be corrected against
   a real recommendation (WF6.020), not guessed at during setup. */

const SOILS = ['', 'Sandy', 'Sandy loam', 'Loam', 'Clay loam', 'Clay', 'Silt loam', 'Not sure'];

export function A12(farmId) {
  const d = draft();
  const farm = farmId ? farmById(farmId) : null;
  if (farm && !d.farmName) d.farmName = farm.name;
  if (farm && !d.farmType) d.farmType = farm.type;

  return {
    tabs: false,
    top: appBar({ title: t('a12.title', 'Farm details') }),
    body: page(
      field(t('a12.name', 'Farm name'), input({
        value: d.farmName, placeholder: 'Al Kharj North',
        oninput: (e) => { d.farmName = e.target.value; },
        onchange: () => commit('a12'),
      }), { required: true }),
      field(t('a12.what', 'What is on this land?'),
        select([
          { value: '', label: t('a12.whatpick', 'Choose one') },
          { value: 'crops', label: t('a8.crops', 'Field crops') },
          { value: 'trees', label: t('a8.trees', 'Date palms and fruit trees') },
          { value: 'mixed', label: t('a8.both', 'Both') },
        ], d.farmType ?? '', (v) => { d.farmType = v || null; commit('a12'); }), { required: true }),
      // WF4.108 — a mixed farm needs the combined service, and the app says so here.
      when(d.farmType === 'mixed', () => disclaimer(
        t('a12.mixed', 'A farm with both crops and trees needs the combined service — one price, one renewal date. We will show you that next.'))),
      field(t('a12.soil', 'Soil type'),
        select(SOILS.map((v) => ({ value: v, label: v || t('a12.soil.blank', 'Leave blank') })), d.soil,
          (v) => { d.soil = v; commit('a12'); }),
        { hint: t('a12.soil.hint', 'Not sure? We will estimate it and you can correct it.') }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('a12.optional', 'Only the name and the type are needed. Everything else can wait.'), req('WF4.095'))),
    dock: actionDock(btn(t('a12.save', 'Save farm'), {
      variant: 'primary',
      disabled: !d.farmName.trim() || !d.farmType,
      onclick: () => go(farm ? `A13:${farm.id}` : 'A13'),
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

const LEVELS = [
  { tier: 'basic', name: 'Basic' },
  { tier: 'pro', name: 'Pro', popular: true },
];

const BLURB = {
  crop: {
    basic: 'Health, water stress, weather, fertiliser insights, disease forecasting, farm diary',
    pro: 'Everything in Basic, plus irrigation scheduling, 1 m imagery, growth stages, photo disease checking, custom alerts, Agro Doctor',
  },
  tree: {
    basic: 'Health, water stress, weather, tree list, disease directory',
    pro: 'Everything in Basic, plus irrigation scheduling, disease forecasting, per-tree detail, 15-day weather, Agro Doctor',
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
    lines.push(`${area(totals.cropHa, { bare: true })} × ${priceBare(perAreaUnit(RATES.crop[tier]), country)}`);
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
      card({}, cardPad(
        h('div', { style: { fontWeight: 650 } }, farm?.name ?? d.farmName ?? t('a13.yourfarm', 'Your farm')),
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          [totals.treeCount ? t('farm.treecount', '{n} trees', { n: num(totals.treeCount) }) : null,
            totals.cropHa ? area(totals.cropHa, { bare: true }) : null].filter(Boolean).join(' · ')))),

      when(family === 'combined', () => disclaimer(
        // WF4.107 — one product, one price, one renewal date. Never two.
        t('a13.combined', 'You have crops and trees, so this is one combined subscription — a single price and a single renewal date.'))),

      // WF4.101 — always Basic then Pro.
      LEVELS.map((level) => {
        const { usd, lines } = priceLines(family, level.tier, totals, d.country);
        const key = `${family === 'combined' ? 'combined' : family}_${level.tier}`;
        return card({ accent: level.popular ? 'good' : null }, cardPad(
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('span', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)' } },
              t(`plan.${level.tier}`, level.name).toUpperCase()),
            when(level.popular, () => h('span.status.status--good', icon('star', 14), t('a13.popular', 'Most chosen')))),
          // WF4.102 — the farmer's own currency, from a server rate.
          h('div.num', `${priceBare(usd, d.country)} / ${t('unit.month', 'month')}`),
          // WF4.099 — the working, not just the answer.
          lines.map((l) => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, l)),
          h('p', { style: { margin: '4px 0 0', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
            t(`a13.blurb.${family}.${level.tier}`, BLURB[family][level.tier])),
          btn(t('a13.choose', 'Choose'), {
            variant: level.popular ? 'primary' : 'secondary', size: 'sm',
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

      // WF9.029 — thirty days on whichever level is chosen.
      h('p', { style: { margin: 0, fontWeight: 600, textAlign: 'center' } }, t('a13.trial', '30 days free on either plan')),
      h('button.row', { onclick: () => go('F6') },
        h('div.row__main', h('div.row__title', t('a13.compare', 'Compare all features'))),
        h('span.row__chev', icon('forward', 20, 'flip'))),
      // WF9.020 / WF9.023 — the in-app route is the only one named here. The
      // web route exists but the app must not describe or link to it in KSA
      // or the UAE, so it is not mentioned at all.
      disclaimer(t('a13.iap', 'Payment is handled by the App Store or Google Play. You can cancel any time from your store account.'))),
  };
}

/* -- A14 · You're ready, WF4.112 ------------------------------------------ */

export function A14() {
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
      h('h1', { style: { margin: 0, fontSize: 'var(--t-head)' } }, t('a14.title', 'You’re ready')),
      h('p', { style: { margin: 0, color: 'var(--ink-700)', maxWidth: '30ch' } },
        t('a14.watchlist', '{farm} is being added to our satellite watchlist.', { farm: d.farmName || 'Your farm' })),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '30ch' } },
        t('a14.first', 'Your first images will arrive within 48 hours. We will notify you when they do.')),
      h('div', { style: { flex: '1 1 auto' } })),
    dock: actionDock(
      btn(t('a14.go', 'Go to my farm'), {
        variant: 'primary', size: 'big',
        onclick: () => {
          if (d.farmName) addFarm({ name: d.farmName, type: d.farmType, soil: d.soil, areaHa: d.areaHa });
          resetLocal('signup');
          enterApp('owner');                   // WF4.002 — creating a farm makes you its Owner
        },
      }),
      h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('a14.trial', 'Trial: 30 days remaining'))),
  };
}

/* -- A15 · Join a farm, WF4.113 … WF4.117 --------------------------------- */

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
    resetLocal('join');
    // WF4.003 — the role comes from the invitation and is never chosen here.
    // WF4.117 — a Worker lands on My Work; a Supervisor on Home, farm-scoped.
    enterApp(asWorker ? 'worker' : 'supervisor');
    toast(asWorker
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
        t('a15.nocode', 'No code? Ask the farm owner to send you one.')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a15.mockhint', 'Mockup: any 6 characters join as a Worker. Start with S to join as a Supervisor. Type EXPIRE to see the expired-invitation message.'))),
    dock: actionDock(btn(t('a15.join', 'Join'), {
      variant: 'primary', disabled: d.code.length < 6, onclick: join,
    })),
  };
}
