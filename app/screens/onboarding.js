/* ---------------------------------------------------------------------------
   onboarding.js — chapter 4: A1 … A15, and password recovery.

   The shape of this flow is the shape of §4.1: registration creates an IDENTITY,
   not a role (WF4.001). Nothing on the way in assigns privileges. So the role is
   set at exactly two points in this file — enterApp('owner') after a farm is
   created (WF4.002), and enterApp(invitation.role) after a join (WF4.003).

   The order is the order of §4, and three things about it are deliberate, all
   three of them settled at the 22/08 review:

     * A1 IS FIRST AND RUNS ONCE. Everything after it is unreadable to an Arabic
       or Pashto speaker until it has happened, which is why language comes
       before the argument, the form and the front door alike.
     * THE TOUR COMES SECOND, before anyone is asked who they are. It used to
       sit between "Create an account" and the sign-up form, which meant the
       case for signing up was only ever made to people who had already decided
       to. Skip and the last card both lead to A3. It is first-run only; F12
       brings it back afterwards (WF4.030).
     * A3 IS THE FRONT DOOR, and there is no routing screen in front of it. A2
       is gone: logging in is the common case, so the login form is the screen,
       and creating an account or joining a farm as a guest are links beneath
       it. Nobody types a password on the way to redeeming an invitation — the
       guest route still collects nothing but six digits, on its own screen.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local, resetLocal } from '../core/local.js';
import { t, LANGUAGES, setLanguage, langMeta } from '../core/i18n.js';
import { go, back, enterApp, openModal, openSheet } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { logo, BRAND } from '../ui/brand.js';
import {
  appBar, barAction, page, section, card, cardPad, btn, actionDock, actionDockPair,
  field, input, select, checkbox, disclaimer, req, kv, chips, segmented, helpBlock,
  mapBand,
} from '../ui/components.js';
import { area, priceBare, num } from '../core/format.js';
import { boundaryCanvas, undoVertex, starterPolygon, PLOT_SCALE } from '../ui/boundaryEditor.js';
import { mapSvg, landUseSvg, outlineOf } from '../ui/map.js';
import { addFarm, confirmSurvey, setFarmBoundary } from '../data/actions.js';
import {
  surveyTotals, typeFromTotals, decidedAreas, LAND_USE, LAND_USE_META, TREES_PER_HA,
  addArea, setAreaIncluded,
} from '../data/survey.js';
import { farmById, rawFarm, visibleFarms } from '../data/selectors.js';

/* The draft an owner builds across A5 → A14. One object, one flow. */
const draft = () => local('signup', {
  country: 'SA', phone: '', email: '', agreed: false, code: '',
  name: '', password: '', showPassword: false, areaUnit: null,
  farmName: '', farmType: null,
  // Set by startAddFarm: this draft belongs to an account that already holds
  // farms, which is the only thing that makes the automatic name a number
  // higher than one.
  inApp: false,
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

/* -- A1 · Language, WF4.011 … WF4.016 --------------------------------------

   Review 22/08 — THE FIRST SCREEN OF THE FIRST RUN, AND ONLY THAT. The reviewer
   asked whether the language menu appears only once, when the app is first
   downloaded. It does: `firstRunDone` is set the moment anyone enters the app,
   and the language lives in Settings and in A3's app bar afterwards.

   TWO WAYS ON, as the review asked for: the tour is the main one and the front
   door is beside it. Neither can be pressed before a language is chosen — the
   list above them is what this screen is for — but once it has been, the farmer
   who wants to see the product first and the farmer who already has an account
   are two different people and this is the earliest place they part. */

export function A1() {
  return {
    tabs: false,
    // WF4.013 — the whole list has to fit a 360 × 640 screen without scrolling,
    // so this screen is tight on purpose: five rows, a logo and two buttons.
    body: h('div.page', { style: { paddingTop: 'calc(var(--safe-top) + 8px)', gap: '10px' } },
      // Review 22/08 — the same lockup size as every other screen that carries
      // it. At 48 it was the smallest logo in the app on the screen that has
      // the most room for it.
      logoBlock(64),
      h('div', { style: { textAlign: 'center' } },
        h('h1', { style: { fontSize: 'var(--t-title)', margin: '0 0 2px' } }, t('a1.title', 'Choose your language')),
        // Review 22/08 — level with the English above it. See LANGUAGES.scale:
        // the same pixel size in Arabic reads a size smaller.
        h('p', {
          style: {
            margin: 0, fontSize: `calc(var(--t-title) * ${langScale('ar')})`,
            lineHeight: 1.25, color: 'var(--ink-600)',
          },
          dir: 'rtl',
        }, 'اختر لغتك')),
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
        h('div.row__title', {
          style: { fontSize: `calc(var(--t-lead) * ${lang.scale ?? 1})`, unicodeBidi: 'isolate' },
        }, lang.native)),
      when(lang.code === state.session.lang, () => h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('check', 22)))))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        t('a1.later', 'You can change this later in Settings.'), req('WF4.011', 'WF4.012', 'WF4.013')),
      // Review 01/09 — THE ADDRESS, in the gap this screen already had. A1 is
      // tight by requirement (WF4.013) and the space between the language list
      // and the two buttons was the one piece of it doing nothing; a farmer who
      // wants to read about us before he registers now has somewhere to go, and
      // it is where he is already looking rather than at the foot of a screen
      // he has to scroll to reach. It is not a link: this is the first screen
      // of the first run and sending anyone out of the app here loses them.
      h('div', { style: { flex: '1 1 auto', minHeight: '4px' } }),
      h('p', {
        style: {
          margin: 0, textAlign: 'center', fontWeight: 600,
          fontSize: 'var(--t-meta)', color: 'var(--brand-700)',
        },
      }, BRAND.site)),
    /* GETTING ON WITH IT IS THE PRIMARY ACTION, and the tour is the offer.
       They were the other way round: the tour led, in the filled button, and
       "Register / log in" sat under it looking like the alternative. Most people
       opening this screen have been told to install the app and want to be in
       it — WF4.018 asks that the tour reach everyone, not that it be pressed
       first, and it is still one tap away, still runs before the front door for
       anyone who takes it, and Help brings it back afterwards.

       The tour keeps a filled container rather than dropping to a bare link.
       Secondary, but visibly a button: a plain line of text under a green
       button is read as a caption, not as a thing to press. */
    dock: actionDock(
      btn(t('a1.account', 'Register / log in'), { variant: 'primary', onclick: () => go('A3') }),
      btn(t('a1.tour', 'Proceed with guided tour'), { variant: 'quiet', onclick: () => openTour() })),
  };
}

/** The optical correction for one language's script — see LANGUAGES. */
function langScale(code) {
  return LANGUAGES.find((l) => l.code === code)?.scale ?? 1;
}

/* -- A3 · The front door, WF4.017 … WF4.025 -------------------------------

   Review 22/08 — A2 IS GONE, AND THIS SCREEN IS WHAT REPLACED IT. The reviewer
   asked twice whether the two could be merged, and asked for A2's functions to
   be moved down here. They have been, as links under the form rather than as
   three cards: a hub whose only job is to send you somewhere else costs every
   returning farmer a tap, and of the three doors one is overwhelmingly the
   common case. WF4.017's rule — no login form on the routing screen — dies with
   the screen it was about; what it was protecting is kept by making the two
   exceptions plain text at the bottom rather than making everyone choose first.

   TWO ROUTES, NEVER BOTH AT ONCE. The old screen showed one field labelled
   "Mobile number or email" with two submit buttons under it, and the review
   read that as four permutations — mobile + code, mobile + password, email +
   code, email + password — and asked for two. There were only ever two, and the
   layout was what invented the other two: a free-text identifier next to a
   choice of credential looks like a grid.

   So the routes are now separated and only one is on screen:

     mobile + code       the default, because the number is the one identifier
                         registration proves, and it is one tap for a farmer
                         holding his phone. A real country selector and a
                         numeric field, so the box cannot take an address.
     email + password    one tap away behind a link, with its own two fields
                         and its own button.

   And the fingerprint sentence has gone (review 22/08). It was an advisory
   about a facility the operating system provides, on a screen where the farmer
   can do nothing with the information. The offer is made ONCE, when the account
   is created — see the BIOMETRIC sheet after A6 — and what appears here
   afterwards is a button he can press, not a fact about his handset. */

export function A3() {
  const d = local('login', { mode: 'code', country: 'SA', phone: '', email: '', password: '', show: false });
  const countries = state.db.countries;
  const dialOptions = [...countries.filter((c) => c.priority), ...countries.filter((c) => !c.priority)]
    .map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` }));
  const phoneOk = d.phone.replace(/\D/g, '').length >= 6;
  const byCode = d.mode === 'code';

  return {
    tabs: false,
    // The back arrow appears only when there is something behind it, which is
    // the difference between the two ways in: a farmer who logged out opens
    // here and this is the root, while one who tapped "Register / log in" on
    // A1 came from somewhere and may want the tour after all. WF4.020's
    // language control came down from A2 either way, so a wrong tap on A1
    // still costs exactly one tap to undo.
    top: appBar({
      title: t('action.login', 'Log in'),
      actions: [h('button.iconbtn', {
        onclick: () => openModal('LANG_PICKER'),
        style: { minWidth: 'auto', padding: '0 10px' },
      }, icon('language', 20), h('span.iconbtn__label', langMeta().english))],
    }),
    // page--fill gives the page the phone's height, which is what lets the
    // spacer near the bottom actually take up room — see the comment there.
    body: page({ class: 'page--fill' },
      // WF4.023 — the two ways in, side by side, before either form is read. It
      // used to be one form with a link to the other at the bottom, which made
      // the code route the screen and the password route a footnote a farmer
      // had to read past his own form to find.
      credentialSwitch(byCode ? 'mobile' : 'email', (id) => { d.mode = id === 'mobile' ? 'code' : 'password'; commit('a3'); }),

      byCode ? codeRoute(d, dialOptions, phoneOk) : passwordRoute(d),

      h('div', { style: { height: '2px' } }),
      h('span', { style: { display: 'block', height: '1px', background: 'var(--ink-200)' } }),

      // Review 22/08 — "move these functions here from A2". They are links
      // because they are the exceptions; the form above is the rule.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        doorLink(t('a3.new', 'New here?'), t('a2.create', 'Create an account'), () => go('A5')),
        // Review 22/08 — "Join a farm as a guest". A worker or a supervisor
        // redeeming a code never owns the farm he is walking into, and the word
        // says so before he taps.
        doorLink(t('a3.invited', 'Invited?'), t('a2.join', 'Join a farm as a guest'), () => go('A15'))),

      /* THE WAY TO A PERSON, AT THE FOOT OF THE FRONT DOOR.

         Everything above this line assumes the farmer can get in; the two
         buttons under it are for the one who cannot, and he is the visitor with
         the least patience for hunting through a menu he has not reached yet.

         Review 01/09 (second pass) — "align the 'we are here to help', and the
         contact buttons to the bottom of the screen". They sat directly under
         the two links, which put a help offer in the middle of a short screen
         where it read as a third way to log in. The spacer takes whatever room
         is left over, so the block is against the bottom on a tall phone and
         simply follows the form on a short one — pushed down, never pushed
         off. */
      h('div', { style: { flex: '1 1 auto', minHeight: 'var(--sp-4)' } }),
      h('span', { style: { display: 'block', height: '1px', background: 'var(--ink-200)' } }),
      helpBlock({ prominent: false }),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        req('WF4.017', 'WF4.022', 'WF4.023', 'WF4.024', 'WF4.025'))),
  };
}

/* The switch itself, in one place because two screens carry it and the words on
   it have to be the same on both. Mobile first: it is the account (WF4.032) and
   it is the route most farmers take. */
export function credentialSwitch(active, onSelect) {
  return segmented([
    { id: 'mobile', label: t('cred.mobile', 'Mobile'), icon: 'phone' },
    { id: 'email', label: t('cred.email', 'Email'), icon: 'mail' },
  ], active, onSelect);
}

/* WF4.023 — a code to the registered mobile. */
function codeRoute(d, dialOptions, phoneOk) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
    // Review 22/08 — a phone control, not a free-text box that might be an
    // address. Half of the "four permutations" was the field's own ambiguity.
    field(t('a5.mobile', 'Mobile number'),
      h('div.inputgroup',
        select(dialOptions, d.country, (v) => { d.country = v; commit('a3'); },
          { style: { width: 'auto', minWidth: '116px' } }),
        input({
          type: 'tel', inputmode: 'tel', autocomplete: 'tel', name: 'loginphone',
          placeholder: '5X XXX XXXX', value: d.phone,
          oninput: (e) => { d.phone = e.target.value; },
          onchange: (e) => {
            d.phone = e.target.value.replace(/[\s-]/g, '').replace(/^0+/, '');
            commit('a3');
          },
        }))),

    // WF4.024 — the offer taken at registration, as a control rather than a
    // notice. It appears only once it has been ACCEPTED: on a phone where
    // nobody has made an account there is nothing to unlock, which is exactly
    // what the sentence this replaced was failing to notice.
    when(state.session.biometric && state.session.biometricAsked,
      () => btn(t('login.faceid', 'Log in with Face ID'), {
        variant: 'secondary', icon: 'lock',
        onclick: () => enterApp('owner'),
      })),

    // The same words A5 uses. "Send me a code" left the farmer to work out
    // which of the two things he had just typed it was going to.
    btn(t('login.sms2', 'Send code to mobile number'), {
      variant: 'primary',
      disabled: !phoneOk,
      // A6 in login mode: the code is the whole of logging in, so it opens the
      // app rather than the farm-creation path a new account follows.
      onclick: () => go('A6:login'),
    }),

  );
}

/* The second route, in the same place as the first — this is a swap, not a
   second screen and not a second form under the first one. The switch above
   decides which of the two is drawn. */
function passwordRoute(d) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
    field(t('a5.email', 'Email address'), input({
      type: 'email', inputmode: 'email', autocomplete: 'email', name: 'loginemail',
      placeholder: 'name@example.com', value: d.email,
      oninput: (e) => { d.email = e.target.value; },
      onchange: () => commit('a3'),
    })),
    // Review 22/08 — no "at least 8 characters" here. A rule about choosing a
    // password belongs where one is being chosen; on this screen the farmer
    // already has one that met it.
    field(t('login.password', 'Password'),
      passwordInput(d.password, d.show,
        (v) => { d.password = v; },
        () => { d.show = !d.show; commit('a3'); })),
    btn(t('action.login', 'Log in'), {
      variant: 'primary',
      disabled: !EMAILISH.test(d.email.trim()) || !d.password.length,
      onclick: () => enterApp('owner'),
    }),
    h('div', { style: { display: 'flex', justifyContent: 'center', fontSize: 'var(--t-meta)' } },
      link(t('login.forgot', 'Forgot your password?'), () => go('FORGOT'))));
}

/* A2's doors, at the size an exception deserves. */
function doorLink(lead, label, onclick) {
  return h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
    h('span', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, lead),
    link(label, onclick));
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
      'aria-label': t('a11y.showpw', 'Show password'),
      style: { position: 'absolute', insetInlineEnd: '2px', top: '0' },
    }, icon(shown ? 'eyeOff' : 'eye', 21)));
}

/* Password recovery is three steps and owns all three. It used to borrow A7 for
   the last one — send a code, verify it, and land on "Tell us about you", where
   a returning farmer was asked for his name again to change his password. With
   A7 gone the step comes home: confirm the number, code, new password.

   Review 21/08 — A RESET GOES TO THE REGISTERED MOBILE NUMBER AND NOWHERE ELSE.
   The screen used to take a number or an email and send the code to whichever
   was typed, which made an unverified address a way into an account: the number
   is the one thing registration proves, and in this market it is the thing tied
   to a government ID. So there is no longer a choice to offer, and no field
   either — the account holds the number already. The screen says where the code
   is going, and says how to change it if that number is wrong, because a farmer
   who has lost the phone cannot be left with a dead end. */

export function FORGOT(step = 'identifier') {
  const d = local('forgot', { password: '', show: false, via: 'mobile' });

  if (step === 'password') {
    const weak = d.password.length > 0 && !passwordOk(d.password);
    return {
      tabs: false,
      top: appBar({ title: t('forgot.new.title', 'Choose a new password') }),
      body: page(
        h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
          t('forgot.new.body', 'Your number is confirmed. Pick a password and you are back in.')),
        field(t('forgot.new.field', 'New password'),
          passwordInput(d.password, d.show,
            (v) => { d.password = v; },
            () => { d.show = !d.show; commit('forgot'); }),
          {
            required: true,
            hint: t('password.hint', 'At least 8 characters, including one letter, one number and one special character.'),
            error: weak ? t('password.short', 'That password does not meet the rule above yet.') : null,
          })),
      dock: actionDock(btn(t('forgot.new.save', 'Save and log in'), {
        variant: 'primary',
        disabled: !passwordOk(d.password),
        onclick: () => { resetLocal('forgot'); enterApp('owner'); },
      })),
    };
  }

  /* TWO WAYS TO RESET, because there are two ways to log in.

     This screen assumed the mobile: it said where the code would go, showed a
     masked number and offered one button. An account that signs in with an
     email and password — the second half of A3's switch — had nothing here,
     which is the one screen where having nothing means being locked out.

     So it carries the same Mobile / Email control A3 does, in the same place
     and the same words, and the sentence under it changes with the choice. The
     mobile route is still the default: the number is the account (WF4.032), and
     it is the one credential we have verified. */
  const byMobile = (d.via ?? 'mobile') === 'mobile';
  // Masked, because the screen is proving we hold the right contact rather than
  // reading it out to whoever is holding the phone.
  const dial = state.db.countries.find((c) => c.code === draft().country)?.dial ?? '+966';
  const contact = state.db.contact;

  return {
    tabs: false,
    top: appBar({ title: t('forgot.title', 'Reset your password') }),
    body: page(
      credentialSwitch(byMobile ? 'mobile' : 'email', (id) => { d.via = id; commit('forgot'); }),

      // Review 22/08 — "a code to reset the password". "OTP" is an initialism
      // out of a telecoms spec; nobody outside one says it, and it appears
      // nowhere in this app any more.
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        byMobile
          ? t('forgot.body', 'We will send a code to reset the password to your registered mobile number: {to}.',
            { to: `${dial} 5X XXX XX XX` })
          : t('forgot.body.email', 'We will send a link to reset the password to your registered email address: {to}.',
            { to: 'k••••••@example.com' })),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        byMobile
          ? t('forgot.change', 'Contact us at {email} or by WhatsApp on {phone} to change your registered phone number.',
            { email: contact.email, phone: contact.whatsapp })
          : t('forgot.change.email', 'Contact us at {email} or by WhatsApp on {phone} if you no longer have access to that address.',
            { email: contact.email, phone: contact.whatsapp }),
        req('WF4.023')),

      // The email route ends in an inbox rather than in a keypad, so the screen
      // says what will happen next instead of handing on to A6.
      when(!byMobile, () => disclaimer(
        t('forgot.email.wait', 'The link works once and lasts an hour. Check your spam folder if it has not arrived in a few minutes.')))),
    dock: actionDock(btn(
      byMobile ? t('forgot.send', 'Send code') : t('forgot.sendlink', 'Send reset link'),
      {
        variant: 'primary',
        onclick: () => (byMobile
          ? go('A6:reset')
          : toast(t('forgot.email.sent', 'Reset link sent. Open it on this phone to choose a new password.'))),
      },
    )),
  };
}

/* -- A4 · Guided tour, WF4.026 … WF4.031 ---------------------------------

   SIX PANELS SINCE THE 01/09 REVIEW, AND ALL THE WORDS ARE THE REVIEWER'S.

   The tour used to be five panels of placeholder copy over a big icon, held
   open for Hani to supply the text. He supplied it, and it changed the shape of
   the thing: each panel now argues a part of the product — how the service
   works, what the planner does, what the advice covers, what it does to yields,
   and what the farmers who already use it get out of it — and each is
   ILLUSTRATED BY THE SCREENS THAT DO IT rather than by a picture of an icon.

   The illustrations are PICTURES: the two photographs the reviewer supplied for
   the satellite panel and the closing one, and generated screenshots of the six
   screens the middle panels describe. The screenshots are a build step —
   tools/tourshots.mjs regenerates all six from the running app — so the tour
   still cannot quietly drift away from the product it is advertising, without
   any of them being a live screen mounted inside a page it does not belong to.

   WF4.026 still holds: this is stills with captions, not a live interface with
   banners over it and not a demo account. */

const TOUR = [
  // The opening panel says what the product is FOR, which is what somebody who
  // has not signed up is asking. Review 01/09 switched the last two clauses:
  // irrigation before fertiliser, because that is the order the farmer meets
  // them in and the order the advice panels are in.
  {
    art: 'icon', icon: 'map',
    headline: 'Enhancing your farm profitability through precision agriculture',
    body: 'Our solution helps you increase crop yields and reduce input costs by optimizing crop scheduling, monitoring plant health, improving irrigation efficiency, and applying fertilizers based on soil nutrient levels.',
  },
  // Review 01/09 — a new panel, second, because everything after it is a thing
  // the service does and this is the sentence that says how it can.
  {
    art: 'image', src: 'satellite.avif', alt: 'A satellite passing over farmland',
    headline: 'How our service works',
    body: 'We collect over 200 parameters from satellites that monitor your farm on a daily basis, even under cloudy conditions.',
    body2: 'Our Artificial Intelligence (AI) models, customized for your region, analyze these parameters and provide you with data-driven advice to optimize your farm operations.',
  },
  {
    art: 'shots', shots: ['D1', 'F9'],
    headline: 'Farm planner',
    body: 'Our farm dashboard provides you with a daily report on your crop health, irrigation requirements, soil nutrition conditions, and local weather forecast.',
    body2: 'We send you a daily list of tasks recommended for maintaining healthy plants and optimizing crop yields. You can assign individual tasks by WhatsApp or SMS to your farm workers.',
  },
  {
    art: 'shots', shots: ['D2', 'D3'],
    headline: 'Irrigation and fertilization advice',
    body: 'By monitoring stress levels of your field crops and trees, we advise you on when to irrigate your plants and on the appropriate mix of soil nutrients to apply.',
    body2: 'This prevents you from wasting resources and damaging your crops through over-irrigation or applying the wrong fertilizers.',
  },
  {
    art: 'shots', shots: ['B5', 'B6'],
    headline: 'Optimizing crop yields',
    body: 'We monitor biomass growth throughout the crop cycle against expected plant growth. This allows us to predict harvest yields and detect any problems.',
    body2: 'We advise you on corrective actions to increase plant growth, and we recommend a harvest time to maximize farm revenues.',
  },
  // The closing panel is the only one that argues with numbers, so it is the
  // only one whose body is a list. Profitability sits apart from the three
  // above it because it is what they add up to, not a fourth measurement.
  {
    art: 'image', src: 'crops.avif', alt: 'Wheat, olives, potatoes, date palms and a field of greens',
    headline: 'Over 6 million farmers trust us worldwide',
    body: 'On average, our users experience the following improvements after using our service:',
    stats: [
      ['a4.stat.yield', 'Increase in crop yield', '12–16%'],
      ['a4.stat.water', 'Irrigation savings', '15–25%'],
      ['a4.stat.fert', 'Reduction in fertilizer costs', '18–20%'],
    ],
    total: ['a4.stat.profit', 'Increase in farm profitability', '10–25%'],
  },
];

/**
 * Start the tour from the beginning. Whoever opens it owns the reset, because
 * A4 has no entry hook of its own and a half-watched tour must not resume at
 * card 4 the next time somebody asks to see it.
 *
 * `from` is 'help' when F12 opened it (WF4.030) and null on the first-run path.
 * It is the only thing that differs: where the end of the tour leads.
 */
export function openTour(from = null) {
  draft().tourCard = 0;
  go(from ? `A4:${from}` : 'A4');
}

/* Review 22/08 — THE TOUR MOVED IN FRONT OF THE FRONT DOOR. WF4.018 had it
   between "Create an account" and the sign-up form, which meant only somebody
   who had already decided to sign up ever saw the argument for signing up. It
   now sits between A1 and A3, so it runs once on first launch, in the language
   just chosen, before anyone is asked who they are — and Skip and the last card
   both land on A3 rather than on the form.

   It is still first-run only. A farmer who has logged out opens on A3, and F12
   is where the tour lives from then on (WF4.030). */

/* SIX PANELS, SIX PAGES IN THE DECK, ONE SCREEN IN THE APP.

   In the app the tour is a carousel: one screen, Next, six cards. On paper a
   carousel is one page showing one card and five the reviewer never sees, so
   the deck needs a page each — and it gets them as A4A…A4E, which render the
   same screen pinned to a card instead of reading the draft.

   The letters follow the ORDER, not the history: the panel added at the 01/09
   review is second, so it is A4A and everything after it moved up a letter.
   Codes that stay put while the thing they name moves are how a deck and an app
   stop describing the same product. */
const tourScreen = (fixed) => (from) => renderTour(fixed ?? Math.min(draft().tourCard, TOUR.length - 1), from);

export const A4 = tourScreen(null);
export const A4A = tourScreen(1);
export const A4B = tourScreen(2);
export const A4C = tourScreen(3);
export const A4D = tourScreen(4);
export const A4E = tourScreen(5);

/* THE ILLUSTRATION, AND IT IS A PICTURE NOW.

   Review 01/09 (second pass) — "use actual pictures of the screen, generated,
   cropped, with light border", and the two photographs the reviewer supplied
   for the satellite panel and the closing one.

   The panels used to mount the real screens live and scale them down. It kept
   the tour honest by construction, and it cost three things the review's answer
   removes: a page carrying three primary buttons and sixty sub-36 dp targets
   that belong to other screens, six extra renders every time the tour opens,
   and — on paper — a photograph of a photograph.

   So all three kinds are `<img>` now. The screen pictures come from
   tools/tourshots.mjs, which regenerates them from the running app; the
   honesty is a build step rather than a rendering trick. */
function tourArt(c) {
  if (c.art === 'image') {
    return h('div.tourart.tourart--bleed',
      h('img.tourart__photo', { src: `app/imgs/tour/${c.src}`, alt: c.alt ?? '' }));
  }
  if (c.art === 'shots') {
    // Two screens, side by side, each in the light border the review asked for.
    return h('div.tourart.tourart--bleed', { style: { gap: '12px' } },
      c.shots.map((id) => h('img.tourart__shot', {
        src: `app/imgs/tour/${id}.png`,
        alt: t(`a4.shot.${id}`, `The ${id} screen`),
      })));
  }
  return h('div.tourart', { style: { color: 'var(--brand-600)' } }, icon(c.icon, 76));
}

function renderTour(i, from) {
  const d = draft();
  const c = TOUR[i];
  const last = i === TOUR.length - 1;
  // WF4.030 — from Help the tour is a detour, so it ends where it started.
  const leave = from === 'help' ? () => back() : () => go('A3', { replace: true });
  return {
    tabs: false,
    top: h('div.app__top', h('div.appbar',
      h('div.appbar__spacer'),
      // WF4.029 — Skip is on every snapshot, and goes straight to A3.
      h('button.iconbtn', { onclick: leave, style: { minWidth: 'auto', padding: '0 14px' } },
        h('span', { style: { fontWeight: 650 } }, t('action.skip', 'Skip'))))),
    body: h('div.page', { style: { gap: '14px', textAlign: 'center', alignItems: 'center', height: '100%' } },
      tourArt(c),
      // WF4.028 — numbered, so the length of the thing is never a mystery.
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', fontWeight: 600 } },
        t('a4.count', '{n} of {total}', { n: num(i + 1), total: num(TOUR.length) })),
      h('h1', {
        // A headline that is a sentence sets at title size; a headline that is
        // three words keeps the display size it was designed at.
        style: { fontSize: c.headline.length > 34 ? 'var(--t-title)' : 'var(--t-head)', margin: 0, lineHeight: 1.15 },
      }, t(`a4.${i}.h`, c.headline)),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '34ch' } }, t(`a4.${i}.b`, c.body)),
      // The second paragraph is a second paragraph, not a longer first one: the
      // reviewer's copy sets out the what and then the so-what, and running the
      // two together loses the beat between them.
      when(c.body2, () => h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '34ch' } },
        t(`a4.${i}.b2`, c.body2))),
      when(c.stats, () => h('div', { style: { width: '100%', maxWidth: '34ch', textAlign: 'start' } },
        c.stats.map(([key, label, value]) => h('div.tourstat',
          h('span.tourstat__label', t(key, label)),
          h('span.tourstat__value', value))))),
      // What the three above add up to, and drawn as a conclusion: an arrow
      // down out of the list, then the figure on its own.
      when(c.total, () => h('div', {
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%', maxWidth: '34ch' },
      },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('chevronDown', 24)),
      h('div', {
        style: {
          width: '100%', display: 'flex', justifyContent: 'space-between', gap: '12px',
          background: 'var(--brand-050)', color: 'var(--brand-800)',
          borderRadius: 'var(--radius)', padding: '10px 14px', fontWeight: 700, textAlign: 'start',
        },
      },
      h('span', t(c.total[0], c.total[1])),
      h('span', { style: { whiteSpace: 'nowrap' } }, c.total[2])))),
      h('div.dots', TOUR.map((_, k) => h('span', k === i ? { 'data-on': '' } : {})))),
    dock: actionDock(btn(
      last
        // Not "Create my account" any more: the tour no longer sits on the
        // registration path, so its last card hands on to the front door and
        // the farmer decides there whether he is new or coming back.
        ? (from === 'help' ? t('action.done', 'Done') : t('a4.start', 'Get started'))
        : t('action.next', 'Next'),
      {
        variant: 'primary',
        onclick: () => { if (last) leave(); else { d.tourCard = i + 1; commit('a4'); } },
      })),
  };
}

/* -- A5 · Sign up, WF4.032 … WF4.037, WF4.041 … WF4.042 -------------------
   The MOBILE NUMBER is the one thing that has to be right, so it is the one
   thing that gets validated: a code goes to it and nothing continues until the
   code comes back. The email address is collected and never verified.

   That asymmetry is the whole design of this screen, and it replaced a
   symmetrical one where the farmer could start with either and the code went to
   whichever they had typed. Either-way-round is the right answer for LOGGING IN
   — A3 still takes either — but it is the wrong answer for registration: an
   account whose number was never proved cannot be sent work, cannot receive an
   alert, and cannot be found by the owner who types that number into a worker
   record. The address is worth having (WF9.021 writes a licence bought on the
   web against it) and worth nothing to verify: nobody is locked out of a farm
   because an email bounced.

   Review 18/08 — THE WHOLE ACCOUNT IS ASKED FOR HERE. The name and the password
   used to sit on a screen of their own after verification, which split one
   question — who are you and how do you get back in — across a code entry that
   has nothing to do with either. Everything the account is made of is now on
   this form, and A7 has gone. What that screen also carried, the land unit, was
   never an account fact at all: it is how the farmer reads an area, so it now
   sits on A9 beside the first area he is about to draw. */

const EMAILISH = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* Review 22/08 — the rule the reviewer wrote out, enforced rather than merely
   printed. It lives here because three screens state it — A5, the reset, and
   any future change-password — and a rule described in one place and checked in
   another is a rule that drifts. */
export function passwordOk(pw) {
  return pw.length >= 8
    && /[A-Za-z]/.test(pw)
    && /[0-9]/.test(pw)
    && /[^A-Za-z0-9]/.test(pw);
}

export function A5() {
  const d = draft();
  const countries = state.db.countries;
  const priority = countries.filter((c) => c.priority);   // WF4.035 — GCC + Jordan on top
  const rest = countries.filter((c) => !c.priority);

  const phoneOk = d.phone.replace(/\D/g, '').length >= 6;
  const emailOk = EMAILISH.test(d.email.trim());
  const weak = d.password.length > 0 && !passwordOk(d.password);

  return {
    tabs: false,
    top: appBar({ title: t('a5.title', 'Create your account'), onBack: () => go('A3', { replace: true }) }),
    body: page(
      // WF4.041 — the name is mandatory, and it is asked first because it is the
      // only thing on this form the farmer does not have to check on his SIM.
      field(t('a5.name', 'Your name'), input({
        value: d.name, autocomplete: 'name', name: 'name',
        oninput: (e) => { d.name = e.target.value; },
        onchange: () => commit('a5'),
      }), { required: true }),

      /* NO CREDENTIAL SWITCH HERE, and it is worth saying why not, because A3
         has one. Logging in is a CHOICE between two ways to prove who you are,
         and the switch is what makes both visible. Registering is not: WF4.032
         makes the mobile the account and WF4.037 uses the email to find a
         licence bought elsewhere, so an account needs both and there is nothing
         to choose between. A switch over two things you are going to fill in
         anyway is a control that only adds a step. */
      mobileField(d, priority, rest),
      emailField(d),

      // WF4.042 — the show/hide control travels with the field, wherever it sits.
      field(t('a5.password', 'Create a password'),
        passwordInput(d.password, d.showPassword,
          (v) => { d.password = v; },
          () => { d.showPassword = !d.showPassword; commit('a5'); }),
        {
          required: true,
          // Review 22/08 — the whole rule, on the screen where the password is
          // being chosen. It used to say only the length, so a farmer met the
          // stated rule and was still refused.
          hint: t('password.hint', 'At least 8 characters, including one letter, one number and one special character.'),
          error: weak ? t('password.short', 'That password does not meet the rule above yet.') : null,
        }),

      // WF4.037 — unticked by default; Terms and Privacy open in-app.
      checkbox(h('span', t('a5.terms.pre', 'I agree to the '),
        link(t('a5.terms', 'Terms of Use'), () => openModal('LEGAL', { doc: 'terms' })),
        t('a5.and', ' and '),
        link(t('a5.privacy', 'Privacy Policy'), () => openModal('LEGAL', { doc: 'privacy' }))),
        d.agreed, (v) => { d.agreed = v; commit('a5'); }),

      // Review 21/08 — the worker note has gone. WF4.044 is still true and the
      // invitation screens still do it; it was being answered on the wrong
      // screen. A farmer filling in his own account has no staff yet and no way
      // to issue a short code, so the sentence read as an instruction with
      // nowhere to carry it out — and named a screen he had not reached.
      req('WF4.032', 'WF4.033', 'WF4.041', 'WF4.044')),

    dock: actionDock(btn(t('a5.send', 'Send code to mobile number'), {
      variant: 'primary',
      disabled: !d.agreed || !phoneOk || !emailOk || !d.name.trim() || !passwordOk(d.password),
      onclick: () => go('A6'),
    })),
  };
}

/* The two credential fields, lifted out of the body only to keep A5 readable —
   both are required and neither is conditional. */
function mobileField(d, priority, rest) {
  return field(t('a5.mobile', 'Mobile number'),
    h('div.inputgroup',
      select([...priority.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` })),
        ...rest.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` }))],
      // Review 21/08 — at a fixed 112px the dial code ran under the chevron and
      // read "+96(". It sizes to its own widest option now, which is a bounded
      // thing to ask for: every option is a flag and at most four digits.
      d.country, (v) => { d.country = v; commit('a5'); }, { style: { width: 'auto', minWidth: '116px' } }),
      input({
        type: 'tel', inputmode: 'tel', autocomplete: 'tel', name: 'phone',
        placeholder: '5X XXX XXXX', value: d.phone,
        oninput: (e) => { d.phone = e.target.value; },
        // WF4.036 — spaces and dashes normalise; a leading zero is stripped.
        onchange: (e) => {
          d.phone = e.target.value.replace(/[\s-]/g, '').replace(/^0+/, '');
          commit('a5');
        },
      })),
    // Review 22/08 — "Verification required". The farmer does not need the
    // name of the mechanism, only to know the number will be checked.
    { required: true, hint: t('a5.hint', 'Verification required.') });
}

function emailField(d) {
  return field(t('a5.email', 'Email address'), input({
    type: 'email', inputmode: 'email', autocomplete: 'email', value: d.email, name: 'email',
    placeholder: 'name@example.com',
    oninput: (e) => { d.email = e.target.value; },
    onchange: () => commit('a5'),
  }), {
    required: true,
    hint: t('a5.email.hint', 'Farm reports are sent to this email address.'),
  });
}

/* -- A6 · Verify code, WF4.034 / WF4.038 … WF4.040 -------------------------
   ONE SENTENCE, not a heading and a sentence saying the same thing twice. The
   screen exists to say where the code went, and that is now the only line on it.

   FOUR DIGITS, not six. WF4.038 asked for six and was updated to four at the
   18 August review, which asked for four unless there was a security reason for
   six: the code expires in ten minutes and the account locks after five wrong
   tries, so the two extra digits were buying a longer thing to hold in your head
   rather than any real protection. One constant if it ever goes back.

   The screen is reached from three places and each wants somewhere different
   afterwards, so the route carries which: registration goes on to the farm,
   logging in goes into the app, and a reset goes back to choose a password. */

const OTP_LENGTH = 4;

export function A6(mode = 'signup') {
  const d = draft();
  const digits = d.code.padEnd(OTP_LENGTH, ' ').split('');
  const locked = d.attempts >= 5;                              // WF4.040
  const wrongCode = '0'.repeat(OTP_LENGTH);

  const done = () => {
    if (mode === 'reset') { go('FORGOT:password', { replace: true }); return; }
    if (mode === 'login') { enterApp('owner'); return; }
    go('A9');                                                  // WF4.045 — this route makes an Owner
    // Review 22/08 — "we should ask him if he wants face ID when he first
    // creates an account". This is that moment and the only one: the number is
    // proved, the account exists, and there is now something to unlock. A3 used
    // to carry the same fact as a sentence nobody could act on.
    if (!state.session.biometricAsked) openModal('BIOMETRIC');
  };

  const pressKey = (key) => {
    if (locked) return;
    if (key === 'del') d.code = d.code.slice(0, -1);
    else if (d.code.length < OTP_LENGTH) d.code += key;
    commit('a6');
    // WF4.038 — auto-submits on the last digit.
    if (d.code.length === OTP_LENGTH) {
      setTimeout(() => {
        if (d.code === wrongCode) { d.attempts += 1; d.code = ''; commit('a6'); return; }
        d.code = '';
        done();
      }, 260);
    }
  };

  const dial = state.db.countries.find((c) => c.code === d.country)?.dial ?? '+966';
  // WF4.034 — always by SMS, always to the mobile number. The address is never
  // a route in, because it is never checked.
  const sentTo = `${dial} ${d.phone || '5X XXX XXXX'}`;
  return {
    tabs: false,
    // Review 22/08 — "code", not "OTP", here and everywhere else.
    top: appBar({ title: t('a6.title', 'Enter the code sent to {to}', { to: sentTo }), wrap: true }),
    body: page(
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
        t('a6.mockhint', 'Mockup: any four digits continue. 0000 simulates a wrong code.'))),
  };
}

/* -- the land unit, WF4.043 ------------------------------------------------
   Two units, not three. Acres are not how land is counted anywhere the app
   launches, and the third chip was an invitation to pick the wrong one.

   The question used to be the tail of A7 — "tell us about you" — which is where
   it went wrong: a unit is not a fact about the farmer, it is how he reads an
   area. It now stands on A9, one screen before the first area the app prints,
   so the answer and its consequence are in sight of each other. */

/* Review 22/08 — hectare first. It is the unit most of the sales footprint
   counts in, and the dunum belt below is the exception rather than the lead. */
const AREA_UNITS = [
  { id: 'hectare', label: 'Hectare' },
  { id: 'dunum', label: 'Dunum' },
];

/* WF4.043 — dunum in the UAE and Jordan, hectares in Saudi Arabia. The dunum
   belt is the Levant, Iraq and Turkey as well, and it is a list rather than a
   default because the rest of the world the app now sells into counts hectares:
   a Kenyan or Uzbek farmer offered dunum would be reading someone else's unit. */
const DUNUM_COUNTRIES = ['AE', 'JO', 'PS', 'SY', 'LB', 'IQ', 'TR'];

/** The chips, and the country note that makes them a correction not a question. */
function unitField(d) {
  const detected = DUNUM_COUNTRIES.includes(d.country) ? 'dunum' : 'hectare';
  const chosen = d.areaUnit ?? detected;
  if (state.session.areaUnit !== chosen) state.session.areaUnit = chosen;
  return field(t('a9.unit', 'How do you measure land?'),
    chips(AREA_UNITS.map((u) => ({ id: u.id, label: t(`unit.${u.id}.name`, u.label) })), chosen,
      (id) => { d.areaUnit = id; state.session.areaUnit = id; commit('a9'); }),
    // Review 21/08 — the country note has gone. The right chip is already
    // selected and Settings is where anything gets changed, so the sentence
    // spent two lines telling the farmer that a right answer was a right answer.
    { required: true });
}

/* Review 21/08 — THE FARM'S NAME, asked before anything else about it is.

   It moved up from A12, where it sat under the coverage question — which meant
   both drawing screens had to put a name in their app bar for a farm the farmer
   had not named yet, and a farmer with two farms was answering "what should we
   cover" before he had said which farm he was answering for.

   Required, which it was not on A12: that screen offered to number the farm if
   the field was left blank, and an account holding Farm 1, Farm 2 and Farm 3 has
   nothing to tell them apart by in any list in this app. The placeholder still
   shows the number he would have been given, so the field says what a good
   answer looks like without taking silence as one. */
export function farmNameField(d, key = 'a9') {
  return field(t('a12.farmname', 'Name your farm'), input({
    value: d.farmName ?? '', placeholder: autoFarmName(), name: 'farmname',
    oninput: (e) => { d.farmName = e.target.value; },
    onchange: () => commit(key),
  }), { required: true });
}

/** Nothing else about a farm can be chosen until it has a name. */
export function farmIsNamed(d) { return (d.farmName ?? '').trim().length > 0; }

/* What a route card does when the farm has no name yet. Nothing is disabled, so
   something has to happen — and the useful something is to put the cursor in
   the field that is missing and say why, rather than to do nothing and leave
   the farmer pressing a card that looks live. */
export function focusFarmName() {
  const field = document.querySelector('[data-field="farmname"]');
  if (field) { field.focus(); field.scrollIntoView({ block: 'center' }); }
  toast(t('a9.nameneeded', 'Give your farm a name first'), 'warn');
}

/* -- the search bar, WF4.056 / WF4.057 ------------------------------------
   Visible at all times on every map screen, never behind an icon. A farmer
   adding land is looking at a satellite image of somewhere that is not his
   farm, and scrolling there by hand from wherever the phone happens to be is
   the single worst moment in the flow.

   Review 21/08 — THE BAR IS THE CONTROL, not a door to one. It used to open a
   sheet offering three ways in: search the map, name a town, use this phone.
   Two of those were the map screen describing itself — the map can be dragged
   and the bar can be typed into — so the sheet spent a full screen explaining
   what the farmer was already looking at. It has gone: the bar takes a town
   directly, and the third way, the one the map genuinely cannot do on its own,
   is its own button beside it. */

function placeSearch(d, placeholder = t('a9d.search', 'Find your farm')) {
  const centre = (place) => {
    const name = place.trim();
    if (name) toast(t('map.centred', 'Centred on {place}', { place: name }));
  };
  return h('div', {
    style: {
      position: 'absolute', insetInline: '10px', top: '10px', zIndex: 3,
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--paper)', borderRadius: '999px',
      padding: '0 14px', height: '44px', width: 'calc(100% - 20px)',
      boxShadow: '0 2px 10px rgba(9, 22, 17, .18)',
    },
  },
  h('span', { style: { display: 'flex', color: 'var(--ink-500)' } }, icon('search', 19)),
  input({
    type: 'search', name: 'placesearch', placeholder,
    value: d.place ?? '',
    oninput: (e) => { d.place = e.target.value; },
    onchange: (e) => { centre(e.target.value); commit('draw'); },
    onkeydown: (e) => { if (e.key === 'Enter') centre(e.target.value); },
    style: {
      border: 0, background: 'transparent', minHeight: '40px', padding: 0,
      fontSize: 'var(--t-meta)', borderRadius: 0,
    },
  }));
}

/* WF4.057's third way in, and the only one the map cannot do for itself: the
   map can be dragged and a town can be typed, but only the phone knows where
   the farmer is standing. It used to be a button called "Locate" sitting under
   a search bar, which read as part of the search rather than as a separate
   thing; it says what it does now.

   And it is the one route with a failure the other two do not have — the phone
   can simply refuse — so the refusal is a screen that names the setting to
   change rather than a button that quietly does nothing. */
function locateChip() {
  const centred = t('a9d.located', 'Centred on your position');
  return h('button.mapchip', {
    style: { position: 'absolute', insetInlineEnd: '12px', bottom: '12px' },
    // WF5.077 / WF4.055 — the same one flag every other screen reads, so the
    // harness's Location control speaks for the phone here too.
    onclick: () => (state.session.gpsGranted ? toast(centred) : openModal('LOCATION_BLOCKED')),
  }, icon('locate', 19), t('map.uselocation', 'Use my current location'));
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
 * ADDING A FARM IS ONE FLOW, WHEREVER IT STARTS.
 *
 * There used to be two: A9 during registration, and B12 for a farmer who
 * already had farms — the same two route cards, written out twice, under a
 * second name field. The review's verdict was that B12 is an A screen, so the
 * second copy has gone: everything that adds a farm now opens A9, which names
 * it and asks what is on it, and A9B, which is the fork.
 *
 * The draft is cleared on the way in so a half-finished attempt does not leak
 * into the next one, and `inApp` marks the drafts that belong to an account
 * that already exists.
 */
export function startAddFarm(farmName = '') {
  resetLocal('signup');
  const d = draft();
  d.inApp = true;
  d.farmName = farmName;
  go('A9');
}

/**
 * Adding a PLOT to a farm that already exists, which is a different thing and
 * was being routed through the add-a-farm flow. The farm is named, its type is
 * settled and its boundary is drawn; the only screen left is the canvas.
 */
export function startDrawPlot(farmName = '') {
  resetLocal('signup');
  const d = draft();
  d.route = 'plots';
  d.inApp = true;
  d.farmName = farmName;
  go('A10D');
}

export function A9() {
  const d = draft();
  return {
    tabs: false,
    top: appBar({ title: t('a9.title', 'Add your farm') }),
    body: page(
      // Review 21/08 — the name is the first thing asked, because everything
      // under it is a decision about one particular farm and a farmer with two
      // of them decides differently for each.
      farmNameField(d),

      // WF4.043 — asked here, one screen before the app first prints an area.
      unitField(d),

      // WHAT IS GROWING, ASKED BEFORE THE FORK AND NOT AFTER IT.
      //
      // It used to be on A12, after the boundary had already been drawn — which
      // meant a farmer with nothing but date palms was offered "draw my own
      // plots", traced six outlines round scattered bands of trees, and only
      // then told what we were going to count. Trees have to be found from the
      // imagery: they stand in irregular groups all over a holding, they are
      // counted individually, and the count is what the price is calculated
      // from. A farmer cannot draw that and should not be asked to try.
      //
      // So the answer arrives here, and it decides which routes the fork offers.
      farmTypeField(d),

      // What happens next, which differs by the answer just given — and is the
      // only place the difference is stated, because A9B never appears to the
      // farmer it does not apply to.
      h('p', { style: { margin: 0, color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        d.farmType && d.farmType !== 'crops'
          ? t('a9.next.trees', 'Trees are counted one by one from the imagery, so we read your whole farm from above. Next you will draw its boundary.')
          : t('a9.next', 'Next we will ask how you would like your plots found.'),
        req('WF4.051'))),

    /* THE CONTINUE BUTTON, which this screen spent a round without.
       The two route cards were the action — pressing one both answered the fork
       and left the screen — so there was nothing in the dock, and a farmer who
       had filled in a name, a unit and a crop type had no way of telling the
       screen he was done. The fork is A9B's now, and this screen ends the way
       every other form in the app ends.

       NOT DISABLED. A dimmed button does not say which field is missing; this
       one lands on whichever answer is short and says why. */
    dock: actionDock(btn(t('action.continue', 'Continue'), {
      variant: 'primary',
      onclick: () => {
        if (!farmIsNamed(d)) { focusFarmName(); return; }
        if (!d.farmType) { toast(t('a9.typeneeded', 'Tell us what is growing on this land'), 'warn'); return; }
        // A FARM WITH TREES SKIPS THE FORK. It has one way in — see A9B — and a
        // screen that offers a choice of one is a screen asking a question it
        // has already answered. It goes straight to the farm-boundary canvas.
        if (d.farmType !== 'crops') { d.route = 'survey'; go('A10'); return; }
        go('A9B');
      },
    })),
  };
}

/* -- A9B · Survey or draw, WF4.052 / WF5.049 … WF5.052 ---------------------

   THIS SCREEN IS FOR FIELD CROPS ONLY, AND IT ALWAYS OFFERS BOTH ROUTES.

   Two rules, and they are the same rule read from both ends. Trees have to be
   found from the imagery: they stand in irregular groups all over a holding,
   they are counted one by one, and the count is what the price is worked out
   from. A farmer cannot draw that and should not be asked to try — so a farm
   with any trees on it never sees this screen at all. A9 sends it straight to
   A10, the farm-boundary canvas, with the reason on A9 itself.

   And because the only farms that arrive here are farms of field crops, both
   routes are always open when they do. There is no state in which one card is
   withheld, greyed or replaced by an explanation; a screen whose whole job is a
   choice between two things always shows two things.

   NONE OF THAT IS WRITTEN ON THE SCREEN. A farmer never reads "this screen
   appears when…" — he either sees it or he does not. The condition is recorded
   here, in the registry note, and on the deck page, which are the three places
   a reviewer looks.

   THIS WAS B12. It was filed under My Farm, which made adding a farm look like
   something you do to a farm you already have; and it asked for the farm's name
   a second time, in its own draft, because it ran the fork without A9 in front
   of it. The name, the units and the crop type are A9's — asked once, for
   first-run and for a farmer with four farms alike — and what is left here is
   the fork and the two notices that qualify it. */
export function A9B() {
  const d = draft();
  const farms = visibleFarms();
  // WF5.051 — the hard limit, and WF5.050's warning one screen short of it.
  // Both speak at ten: a farmer with six farms told twice that he is near a
  // limit he is nowhere near has been told nothing.
  const atCap = d.inApp && farms.length >= 10;
  const nearCap = d.inApp && farms.length >= 9;

  return {
    tabs: false,
    top: appBar({
      title: (d.farmName || '').trim() || autoFarmName(),
      subtitle: t('a9b.subtitle', 'How should we find your plots?'),
    }),
    body: page(
      when(atCap, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        disclaimer(t('b12.cap', 'You’ve reached the 10-farm limit on this account. If you need more, get in touch and we’ll find an arrangement that works.'), true),
        btn(t('f13.title', 'Contact Wafra'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),

      // BOTH ROUTES, ALWAYS. See the note above the function: this screen only
      // exists for a farm of field crops, and for a farm of field crops both
      // routes are always open. There is no state in which one of them is
      // withheld, so there is no branch here to withhold it.
      when(!atCap, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
          t('a9.lead', 'Two ways to get started. Both give you the same result.')),
        ...farmRouteCards(),
        h('p', { style: { margin: 0, color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, req('WF4.052')))),

      // Both notices sit under the choice they qualify. Neither is a warning
      // about the fork — one is about the farm count and the other about buying
      // a type you do not yet hold — so above the cards they would have taken a
      // weight they have not earned and pushed the choice down the screen.
      when(!atCap && d.inApp, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        when(nearCap, () => disclaimer(
          t('b12.enterprise', 'You’re close to the 10-farm limit. If you’ll need more, there’s a better plan at this scale — talk to an advisor.'))),
        disclaimer(t('b12.combined', 'If you add a different type of farm, we’ll offer you the combined plan instead of a second subscription.')),
        h('span', req('WF5.049', 'WF5.050', 'WF5.051'))))),
  };
}

/* The coverage question, asked on A9 and re-asked nowhere. A12 still shows the
   answer and is still where the quote is requested, because the price depends
   on it — but the choice is made here, where it changes what happens next. */
export function farmTypeField(d, key = 'a9') {
  return field(t('a9.what', 'What is growing on this land?'),
    card({}, COVERAGE.map((option) => h('button.row', {
      onclick: () => {
        d.farmType = option.id;
        state.session.coverage = option.id;
        // A farm with trees cannot be drawn by hand, so a route chosen before
        // the answer changed is not a route any more.
        if (option.id !== 'crops') d.route = 'survey';
        commit(key);
      },
    },
    h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(option.icon, 22)),
    h('div.row__main',
      h('div.row__title', t(...option.label)),
      h('div.row__sub', t(...option.sub))),
    when(option.id === d.farmType, () => h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('check', 22)))))),
    { required: true });
}

/* The fork itself. It has ONE caller now — A9B — where it used to have two, and
   the difference between them was the whole reason it was extracted: A9 was
   mid-registration and B12 was a farmer with farms already, so the same two
   cards had to be written to two different drafts. Adding a farm is one flow
   from either end now, so there is one draft and no branch. */
export function farmRouteCards() {
  const choose = (route) => {
    draft().route = route;
    // Review 21/08 — the fork leads STRAIGHT TO THE DRAWING. What we should
    // cover is asked afterwards, on A12, once there is a boundary to ask it
    // about; it used to sit in between, so the farmer chose a route and was
    // then handed a different question before he got to use it.
    go(route === 'plots' ? 'A10D' : 'A10');
  };
  return [
    routeCard('scan', t('a9.survey', 'Survey my whole farm'),
      t('a9.survey.sub', 'Draw your farm boundary, and our satellite will automatically detect cultivated plots and trees.'),
      // WF4.054 / review C102–C108 — say WHEN to choose this one, in the
      // farmer's terms. The two routes are not a beginner and an expert
      // version; they answer different questions, and the difference is what
      // gets surveyed and therefore what gets paid for.
      //
      // Review 21/08 — "all cultivated areas" replaced a list of what we look
      // for. The list was the same three things the next screen asks him to
      // choose between, so it read as the choice being made for him.
      [
        t('a9.survey.when', 'Choose this option if you want all cultivated areas monitored on your farm.'),
        t('a9.survey.remove', 'You will be able to add or delete plots later.'),
      ],
      () => choose('survey')),
    routeCard('edit', t('a9.draw', 'Draw my own plots'),
      // Review 22/08 — "Draw", to match the farm boundary. The card is called
      // Draw my own plots and then asked the farmer to trace them.
      t('a9.draw.sub2', 'Draw the individual plot boundaries you want us to survey.'),
      [t('a9.draw.when2', 'Choose this option if you only want to monitor 2-3 fields by satellite.')],
      () => choose('plots')),
  ];
}

/* One step of what the satellite does, on A12. An icon, a claim, and the
   sentence that makes the claim checkable — a list of three promises with no
   detail under them is a brochure.

   NOT A ROW, AND NOT IN A CARD. It was `.row--static` inside a card(), which is
   the shape this app uses for things you fill in or tap: a white panel, hairline
   dividers, 48 dp bands. Nothing here is either. It is us telling the farmer
   what we are about to do with his land while he waits for a price, and a
   settings-list frame around that reads as three switches he has failed to
   find. So it is prose with a glyph beside it — no box, no rules, no bands. */
function explainRow(iconName, title, sub) {
  return h('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
    h('span', {
      style: { color: 'var(--brand-600)', display: 'flex', flex: '0 0 auto', marginTop: '2px' },
    }, icon(iconName, 22)),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { style: { fontWeight: 650 } }, title),
      h('div', { style: { color: 'var(--ink-600)' } }, sub)));
}

/* The whole card is the target. "Choose this option" is how the review's
   wording for the bullet reads — "Choose this option if you want all cultivated
   areas monitored…" — not a button it asked for, and a card that says the words
   and then repeats them on a control inside itself is one instruction too many.

   NOTHING IS DRAWN DISABLED. The 21/08 review's "required" used to grey both
   cards out until the farm had a name, and the round after 1.5.4 asked for that
   to stop: a screen that opens with everything on it dimmed reads as broken
   rather than as sequenced, and the farmer is left guessing which field unlocks
   it. The name is still required — the field is marked, and choosing a route
   without one lands on the name rather than proceeding — but the choice looks
   like a choice from the moment the screen opens. */
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

export function A10D() {
  const d = draft();
  // Each new plot starts beside the last rather than on top of it. Every plot
  // used to begin from the same five corners, so a farmer who saved three
  // without moving them had three identical shapes — and A11 now draws them all
  // on one map, where that would have been three labels in one place.
  if (!d.points.length) d.points = starterPolygon({ scale: PLOT_SCALE, index: d.plots.length });
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
      name: (d.plotName || '').trim() || t('a9d.counter', 'Plot {n}', { n: num(d.plots.length + 1) }),
      areaHa,
      // Review 22/08 — one plot is one crop, so a plot carries its own class.
      // The farmer now says which on the panel below, because it decides how
      // the plot is PRICED and he is the only one who knows: this route has no
      // survey to read it off, and A11's Edit sheet was too late to find out
      // that a traced block of palms had been quoted by the hectare.
      kind: d.plotKind ?? 'crops',
      included: true,
      points: d.points.map((p) => [...p]),
    });
    d.points = [];
    d.plotName = '';
    d.plotKind = 'crops';
  };

  const farmName = (d.farmName || '').trim() || autoFarmName();
  const plotLabel = t('a9d.counter', 'Plot {n}', { n: num(done + 1) });

  return {
    tabs: false,
    top: appBar({
      // WF4.061 — the counter is how a farmer keeps his place across several
      // plots, and it now reads under the farm it belongs to: the farmer has
      // just named the farm one screen ago, and the second line says what the
      // screen wants from him rather than leaving him to work it out.
      title: `${farmName} · ${plotLabel}`,
      // Review 22/08 — "Draw", not "Trace", to match the farm boundary, and the
      // rule that makes A12 unnecessary on this route in the same breath: one
      // plot, one crop. It wraps to three lines and is worth them — a farmer
      // told this here is not asked what is growing later.
      subtitle: t('a9d.subtitle', 'Draw one plot'),
      // Review 24/08 — the guidance is an ⓘ beside the line it explains, not a
      // chip in the panel below competing with the fields.
      help: {
        title: t('a9d.subtitle', 'Draw one plot'),
        body: t('a9d.instruction', 'Draw your plot boundary. Each plot should preferably correspond to a single crop — where two crops sit side by side, draw them as two plots.'),
      },
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
    /* Review 01/09 — "LET'S REDUCE THE TEXT TO SHOW A LARGER MAP SCREEN. We've
       already described what is a plot v. trees." The panel under the map held
       a name field and two options carrying nine example crops between them,
       which pushed the map — the thing this screen is for — into the top third
       of the phone. The examples are gone (see COVERAGE), and what is left is
       given a floor rather than the whole of what it asks for: the map keeps at
       least half the screen and the panel scrolls inside its own share. */
    body: [
      mapBand(
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),   // WF4.058 — satellite by default
        editor.node,
        placeSearch(d),
        locateChip()),
      h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--paper)' } },
        // Review 22/08 — THE LIVE AREA READOUT HAS GONE, the same change A10
        // had at the last review and for the same reason: it is the running
        // total of a bill nobody has been quoted for, printed larger than
        // anything else on the panel. The sizes appear on A11, where the farmer
        // approves the list, and in the quote on A13. WF4.065 is answered there.
        //
        // What stays below the map is the pair of sanity warnings, because those
        // are about the shape rather than the price: a farmer who has drawn a
        // car park or half the province should be told before he saves it.
        when(editor.invalid, () => disclaimer(
          t('a9d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        when(tooSmall, () => disclaimer(t('a9d.small', 'That is smaller than 0.1 ha. You can still save it — just checking it is right.'))),
        when(tooBig, () => disclaimer(t('a9d.big', 'That is larger than 10,000 ha. You can still save it — just checking it is right.'))),
        // WF4.063 / review C094 — the farmer's own name for the field. Optional,
        // because a numbered plot is already a working name.
        field(t('a9d.name', 'Name this plot'), input({
          value: d.plotName ?? '', placeholder: plotLabel, name: 'plotname',
          oninput: (e) => { d.plotName = e.target.value; },
          onchange: () => commit('draw'),
        })),

        /* WHAT IS ON THIS ONE, asked per plot and priced per plot.

           The same two answers A12 offers on the survey route, in the same
           words and with the same note about how each is charged — because it
           is the same question and a farmer who has met it once should not have
           to work out that this is it again. It is here rather than on A12
           because this route never reaches A12: one drawn plot is one crop, so
           the answer belongs to the plot rather than to the farm. */
        field(t('a9d.kind', 'What is on this plot?'),
          card({}, COVERAGE.filter((o) => o.id !== 'mixed').map((option) => h('button.row', {
            onclick: () => { d.plotKind = option.id; commit('draw'); },
          },
          h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(option.icon, 22)),
          h('div.row__main',
            h('div.row__title', t(...option.label)),
            h('div.row__sub', t(...option.sub))),
          when((d.plotKind ?? 'crops') === option.id,
            () => h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('check', 22)))))),
          { required: true }),

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
              onclick: () => openSheet('PLOT_EDIT', { index: i }),
            }, icon('edit', 20)),
            h('button.iconbtn.iconbtn--bare', {
              'aria-label': t('a9d.removeplot', 'Remove {name}', { name: p.name }),
              title: t('a9d.removeplot', 'Remove {name}', { name: p.name }),
              onclick: () => { d.plots.splice(i, 1); commit('draw'); },
            }, icon('trash', 20)))))))),
    ],
    /* Review 01/09 (second pass) — ONE LINE EACH. The two buttons sat in a bare
       flex row, which sized them to a share of the dock and then let the labels
       wrap: "Add another / plot" over two lines beside "Request / quote". They
       are a PAIR — same weight, side by side — which is what actionDockPair is
       for, and the pair keeps its labels on one line. */
    dock: actionDockPair(
        // Review 21/08 — "Add another plot". The farmer is standing on a plot
        // he has just traced, so "Add a plot" read as an offer to start the
        // thing he was already finishing.
        btn(t('a9d.addplot', 'Add another plot'), {
          variant: 'secondary', block: false,
          disabled: !drawable,
          onclick: () => { keepPlot(); commit('draw'); },
        }),
        // Review 01/09 — "Request quote", the same words A11's confirm now
        // carries. "Done" named the end of the drawing; what the farmer is
        // actually doing is asking for a price, and the screen he lands on says
        // so on its own button too.
        btn(t('a11.requestquote', 'Request quote'), {
          variant: 'primary', block: false,
          disabled: !drawable && !done,
          onclick: () => {
            if (drawable) keepPlot();
            d.areaHa = d.plots.reduce((s, p) => s + p.areaHa, 0);
            // Review 22/08 — STRAIGHT TO A11, not to A12. A12 asks what the
            // satellite should look for, and a farmer who has just drawn eight
            // outlines by hand has already answered it eight times. What he has
            // not done is check the list, which is what A11 is for — and the
            // review asked for both routes to end up on it.
            if (tooSmall || tooBig) {
              openModal('CONFIRM', {
                title: t('a9d.confirm.title', 'Is that the right size?'),
                body: tooSmall
                  ? t('a9d.confirm.small', 'This boundary is under 0.1 hectares. If that is correct, carry on.')
                  : t('a9d.confirm.big', 'This boundary is over 10,000 hectares. If that is correct, carry on.'),
                confirmLabel: t('action.continue', 'Continue'),
                onConfirm: () => go('A11'),
              });
            } else go('A11');
          },
        })),
  };
}

/* -- A10 · Survey my whole farm, WF4.070 … WF4.077 ------------------------
   One polygon around the growing land: open fields and tree areas, with the
   sheds and the yard left out. It used to ask for everything the farmer holds,
   buildings and all, on the grounds that the algorithm has to be told where to
   stop looking — but nothing built is reported back and nothing built is
   charged for, so the farmer was being asked to trace roofs for our benefit and
   then trust us about the bill. He now draws what he is buying.

   The farm has its name from A9, and this screen says it: the bar carries the
   farm on the first line and the instruction on the second, so a boundary is
   never drawn for a farm the farmer cannot see the name of.

   Review 21/08 took the farm-making off this screen and gave it to A12; the
   01/09 review deleted A12 and gave it back. What survived both rounds is the
   shape — a map, one sentence and one button — and three things about it:

     * The instruction in the bar is the whole instruction. The help text used
       to repeat it in a panel under the map, four lines below the shape it was
       about; it has moved up into the place the farmer is already reading.
     * The area readout has gone with it. It was the running total of a bill
       nobody had been quoted for yet, printed twice the size of the sentence
       explaining what to draw, and A13 is where a number about money belongs.
     * The button asks for the survey, because that is what it does. "Continue"
       named the navigation rather than the act — review 01/09, "change to
       'Request survey'" — and what follows it is the pop-up that says when the
       answer comes back.

   WHAT PRESSING IT DOES. The farm record is made here, the survey is run
   against it, and the farmer lands on A11 with the result. The 01/09 review is
   explicit about the destination — "after A10 he should go to A11" — and the
   pop-up in between is what makes the jump honest: it says the results are
   coming rather than pretending they were instant. */

/** The automatic name a new farm arrives with, and can leave behind at will.

    It counts the farms the ACCOUNT holds. During registration that is none,
    whatever the demo database is carrying, so the first farm anyone names is
    offered "Farm 1" rather than "Farm 7" — a number out of somebody else's
    sequence is the one thing a placeholder must never be. */
export function autoFarmName() {
  const held = draft().inApp ? state.db.farms.length : 0;
  return t('farm.auto', 'Farm {n}', { n: num(held + 1) });
}

/* TWO WAYS INTO THIS SCREEN, and the second one is new.

   Without a farm id it is the registration step: draw the line, ask for the
   survey, meet the result on A11. With one it is A11's "adjust the farm
   boundary" — the 01/09 review asked for a way to correct a line that took in
   too much land, and called it out as "an alternative way for him to remove
   plots", which is exactly what it is: the plots the survey found outside the
   corrected outline come off the quote. */
export function A10(farmId) {
  const d = draft();
  const farm = farmId ? rawFarm(farmId) : null;
  // Editing an existing farm works on ITS boundary, not on the registration
  // draft, and starts from the line already stored rather than from the
  // starter shape.
  const edit = local(`a10-${farmId ?? 'new'}`, { points: null, selectedVertex: null });
  // A farm that arrived without a traced line is opened on the one every map
  // draws for it — the hull of what the survey found — so the farmer is
  // correcting the line he has been looking at rather than a fresh rectangle.
  if (farm && !edit.points) {
    const start = farm.boundary
      ?? outlineOf(decidedAreas(farm).flatMap((a) => a.geometry))
      ?? starterPolygon();
    edit.points = start.map((pt) => [...pt]);
  }
  const work = farm ? edit : d;
  if (!farm && !d.points.length) d.points = starterPolygon();

  const editor = boundaryCanvas({
    points: work.points,
    selected: work.selectedVertex,
    tone: 'farm',                                   // the outside line, in blue
    onChange: ({ selected }) => { work.selectedVertex = selected; commit('draw'); },
  });
  const areaHa = editor.areaHa;

  const farmName = farm?.name ?? ((d.farmName || '').trim() || autoFarmName());

  return {
    tabs: false,
    top: appBar({
      // The farm has a name by the time anyone gets here, so the bar says which
      // farm this outline belongs to and then what to do with it.
      title: farmName,
      // SIX WORDS, not thirty-eight. The bar carried the whole instruction —
      // what to include, what to leave out, and why — wrapped over three lines
      // above a map the farmer is trying to look at. It says what the screen is
      // for; the rest is behind the ⓘ below, which is where a farmer who has
      // drawn one boundary before never has to look again.
      subtitle: t('a10.subtitle', 'Draw your farm boundary'),
      help: {
        title: t('a10.subtitle', 'Draw your farm boundary'),
        body: t('a10.instruction', 'Draw your farm boundary to cover open fields, date palms and fruit trees you want to monitor. No need to include greenhouses or other structures.'),
      },
      actions: [barAction('undo', t('action.undo', 'Undo'), () => undoVertex(work.points), { disabled: !work.points.length })],
    }),
    // The band, then whatever is under it — see mapBand(). All that is left
    // below the map here is the one thing that can go wrong.
    body: [
      mapBand(
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite' }),
        editor.node,
        placeSearch(d),
        locateChip()),
      when(editor.invalid, () => h('div', { style: { padding: '14px 16px', background: 'var(--paper)' } },
        disclaimer(t('a9d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true))),
    ],
    dock: actionDock(farm
      // The correction case. Nothing is requested again — the survey has
      // already run — so the button saves and hands straight back to the list
      // it was opened from.
      ? btn(t('a10.saveboundary', 'Save boundary'), {
        variant: 'primary',
        disabled: work.points.length < 3 || editor.invalid,
        onclick: () => {
          const kept = setFarmBoundary(farm.id, work.points, areaHa);
          resetLocal(`a10-${farmId}`);
          go(`A11:${farm.id}`, { replace: true });
          toast(kept.dropped
            ? t('a10.boundary.dropped', 'Boundary saved. {n} plots now fall outside it and have been taken off.', { n: num(kept.dropped) })
            : t('a10.boundary.saved', 'Boundary saved'));
        },
      })
      : btn(t('a10.request', 'Request survey'), {
        variant: 'primary',
        disabled: d.points.length < 3 || editor.invalid,
        onclick: () => {
          d.areaHa = areaHa;
          // WF4.072 — the farm record is created at once. The farmer already
          // said on A9 what is growing on it, so nothing further is asked.
          const made = addFarm({
            name: farmName, type: d.farmType ?? 'crops', areaHa, boundary: d.points,
          });
          d.farmId = made.id;
          commit('draw');
          openModal('NOTICE', {
            title: t('a10.requested', 'Survey requested'),
            // The reviewer's own sentence, and the same one A14 ends on. It is
            // the promise the app makes twice because the farmer is waiting for
            // the same thing both times.
            body: t('a14.first', 'We will notify you when the farm monitoring results are available (usually within one day).'),
            actionLabel: t('a10.seeresults', 'See what we found'),
            onAction: () => go(`A11:${made.id}`),
          });
        },
      })),
  };
}

/* -- A11 · Survey results, WF4.078 … WF4.088 -----------------------------
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

/* Review 22/08 — BOTH ROUTES END HERE. "Both search options (whole farm and
   selecting individual plots) should end up with this page", and the drawn
   route used to skip it: A10D handed straight to A12 and the farmer never saw
   the list he had just made written out as one thing to approve.

   So A11 now reads from either of two sources, and asks for the same shape from
   both — a named list of areas, each with a class and a size, each of which can
   be kept, corrected or taken off the quote, plus a way to add one that is
   missing. The survey's areas live on a farm record and are edited through
   survey.js; the drawn plots live in the signup draft and have no record at all
   until A14. Neither of those facts reaches the screen. */

export function A11(farmId) {
  const scope = farmId ? surveyScope(farmId) : drawnScope();
  const ui = local(`a11-${scope.key}`, { selected: null });
  const { totals, areas } = scope;

  // Review 01/09 — "Request quote". A12 used to carry that button and this one
  // said where it went next; with A12 gone this IS the end of the survey route,
  // and the farmer pressing it is asking for a price rather than agreeing to
  // navigate. Same words on the drawn route, which reaches the same place.
  const confirm = btn(t('a11.requestquote', 'Request quote'), {
    variant: 'primary',
    disabled: totals.cropHa === 0 && totals.treeCount === 0,
    // Review C154/C155 — no name-confirmation screen in between. The survey is
    // confirmed and the price follows from it.
    onclick: scope.confirm,
  });

  return {
    tabs: false,
    // Review 22/08 — the farm's name is the title and the line under it says
    // what the screen is. It used to be the other way round, which meant the
    // bold line was the same on every farm and the farm itself was the
    // afterthought.
    top: appBar({
      title: scope.name,
      // Review 01/09 (second pass) — the screen is called Survey results, on
      // the page and in the deck. "Summary of plots to be monitored" described
      // the list rather than naming the screen, which left the reviewer's own
      // shorthand — he calls it the survey results throughout — with nothing
      // on screen to attach to.
      subtitle: t('a11.subtitle2', 'Survey results'),
      /* AND THE WAY BACK TO THE LINE IS ON THE BAR. It was a full-width row
         under the map, which gave a correction the same weight as the map it
         corrects; the review asked for "a smaller, subtle button" on the right
         of the top bar, which is where every other per-screen action in the app
         already lives. The boundary is drawn on the map either way — that is
         the reference point the first pass asked for — and this is what makes
         it a reference the farmer can act on. */
      actions: [when(scope.canEditBoundary, () => barAction(
        'edit', t('a11.editboundary2', 'Boundary'),
        () => go(`A10:${scope.farmId}`),
        { title: t('a11.editboundary', 'Adjust the farm boundary') },
      ))],
    }),
    /* Review 01/09 (second pass) — THE MAP IS THE BAND, 65% of the phone and
       flush to three edges, the same on this screen as on A10 and A10D. It was
       a 215 dp letterbox for one round and a 420 dp card for the next; what it
       had never been is the same map the farmer drew on. */
    body: [
      mapBand(landUseSvg({
        areas, selectedId: ui.selected, boundary: scope.boundary,
        fills: Object.fromEntries(LAND_USE.map((k) => [k, LAND_USE_META[k].fill])),
        onTap: (a) => { ui.selected = ui.selected === a.id ? null : a.id; commit('a11'); },
      })),
      page(
      scope.treesOnly ? treeScope(scope.raw, totals) : plotScope(scope, ui),

      // Review C151 — the button lives in the totals box, so it arrives when
      // the farmer has actually reached the end of the list. A docked button
      // sat over the plots the whole way down, inviting a tap before anything
      // had been read.
      scopeTotals(totals, confirm)),
    ],
  };
}

/* The survey's answer, on a farm record. */
function surveyScope(farmId) {
  const farm = farmById(farmId);
  const raw = rawFarm(farmId);
  return {
    key: farmId,
    farmId,
    name: farm.name,
    raw,
    /* THE LINE THE FARMER DREW ON A10, drawn under the plots as the reference
       point the 01/09 review asked for — and editable, which is the other half
       of that note.

       A fixture farm has no traced line, because nobody traced it; it gets the
       same shape every map in the app gives such a farm, which is the hull of
       what the survey found with a little air round it. Editable either way:
       the point of the control is to pull the line IN over ground that is not
       his, and a farm that arrived without one has just as much use for that. */
    get boundary() { return raw.boundary ?? outlineOf(decidedAreas(raw).flatMap((a) => a.geometry)); },
    canEditBoundary: true,
    totals: surveyTotals(raw),
    get areas() { return decidedAreas(raw); },
    treesOnly: farm.type === 'trees',
    lead: (n) => t('a11.lead', 'We found {n} plots inside your farm.', { n: num(n) }),
    setIncluded: (id, on) => { setAreaIncluded(raw, id, on); commit('a11'); },
    edit: (id) => openSheet('AREA_EDIT', { farmId, areaId: id }),
    // WF4.081 — a plot the survey missed. On this route the app can invent one,
    // because it already holds the boundary it would sit inside.
    add: (ui) => { const added = addArea(raw); ui.selected = added.id; commit('a11'); },
    confirm: () => { confirmSurvey(farm.id); go(`A13:${farm.id}`); },
  };
}

/* The plots the farmer drew himself, still in the signup draft.

   The list is the same list A10D was building; what this scope adds is the
   include flag, so a plot can be taken off the quote without being thrown
   away — the drawing is expensive and the decision is not. */
function drawnScope() {
  const d = draft();
  const plots = d.plots ?? [];
  const areas = plots.map((p, i) => {
    const kind = p.kind ?? 'crops';
    return {
      id: p.id ?? `draft-${i + 1}`,
      label: p.name,
      kind,
      areaHa: p.areaHa,
      treeCount: kind === 'trees' ? Math.round(p.areaHa * TREES_PER_HA) : 0,
      included: p.included !== false,
      geometry: p.points ?? starterPolygon({ scale: PLOT_SCALE, index: i }),
      centroid: centroidOf(p.points ?? starterPolygon({ scale: PLOT_SCALE, index: i })),
    };
  });
  const inc = areas.filter((a) => a.included);
  const round1 = (n) => Math.round(n * 10) / 10;
  const cropHa = round1(inc.filter((a) => a.kind === 'crops').reduce((s, a) => s + a.areaHa, 0));
  const treeHa = round1(inc.filter((a) => a.kind === 'trees').reduce((s, a) => s + a.areaHa, 0));
  const treeCount = inc.reduce((s, a) => s + a.treeCount, 0);
  const at = (id) => plots[areas.findIndex((a) => a.id === id)];

  return {
    key: 'drawn',
    farmId: null,
    name: (d.farmName || '').trim() || autoFarmName(),
    raw: null,
    // Nothing to show and nothing to correct: this farmer drew the plots
    // themselves and never traced a line round the outside.
    boundary: null,
    canEditBoundary: false,
    // TREES_PER_HA is date-palm spacing, so a tree plot the farmer drew is
    // counted as palms. He was never asked to tell one kind from the other —
    // A10D offers "date palms and fruit trees" as one answer — so the fruit
    // line is honestly zero rather than a guess split out of the total.
    totals: { areas, cropHa, treeHa, treeCount, palmCount: treeCount, fruitCount: 0 },
    areas,
    // A hand-drawn farm is never trees-only in the way a surveyed one is: the
    // count that drives the trees-only screen comes from the imagery, and there
    // is none yet. Every drawn plot is a row.
    treesOnly: false,
    // "We found" is the survey's sentence. This farmer drew them himself, and
    // telling him we found what he traced is the app taking credit for his work
    // and, worse, sounding as though it might have found something else.
    lead: (n) => t('a11.drawnlead', 'You drew {n} plots. Check them over before we price them.', { n: num(n) }),
    setIncluded: (id, on) => { const p = at(id); if (p) p.included = on; commit('a11'); },
    edit: (id) => openSheet('PLOT_EDIT', { index: areas.findIndex((a) => a.id === id) }),
    // Adding a missing plot here means drawing it, because nothing else can:
    // there is no boundary to guess inside.
    add: () => go('A10D'),
    confirm: () => {
      d.areaHa = round1(cropHa + treeHa);
      d.farmType = typeFromTotals({ cropHa, treeCount });
      commit('a11');
      go('A13');
    },
  };
}

function centroidOf(points) {
  const n = points.length || 1;
  return [
    points.reduce((s, p) => s + p[0], 0) / n,
    points.reduce((s, p) => s + p[1], 0) / n,
  ];
}

/* The plot-by-plot case: crops, or crops and trees together. */
function plotScope(scope, ui) {
  const areas = scope.areas;
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

    // Review 22/08 — one sentence. "Inside your farm", not "inside your
    // boundary", and the instruction that followed it is now on the rows
    // themselves, where the three buttons say what can be done.
    //
    // Review 01/09 added the second sentence, and it is a RULE rather than a
    // description: it is what makes Split on a row worth reaching for, and the
    // reason a farmer looking at one big rectangle holding wheat and onions
    // should cut it in two before he confirms.
    h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, scope.lead(areas.length),
      ' ', t('a11.onecrop', 'A plot should not have more than one crop.')),

    card({}, areas.map((a) => areaRow(scope, a, ui))),

    // Review 22/08 — the four-tool row has gone and this has taken its place.
    // Three of the four tools were second ways to do what the rows now offer
    // outright; the fourth, adding a plot the survey missed, is the one thing
    // the list itself cannot express, so it is what the button says. Join and
    // Split live in a row's own Edit sheet, which is where a farmer looking at
    // the plot he wants to change is already going.
    btn(t('a11.addmissing', 'Add a missing plot'), {
      variant: 'secondary', icon: 'plus',
      onclick: () => scope.add(ui),
    }),

    h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      t('a11.edithint', 'Removing a plot greys it out and takes it off the quote. You can always put it back.'),
      req('WF4.081')));
}

/* Review C137 … C144 — the trees-only case. No plot menus: a count, the kinds
   of tree found, and the choice of which of them to include. The price is per
   tree, so the tree count IS the quote and everything else is noise. */
function treeScope(raw, totals) {
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
    // Review 01/09 — "monitor", not "watch". It is the word the rest of the
    // sales conversation uses, and it is the word on the subtitle of this very
    // screen; two words for one service is one word too many.
    h('div', { style: { fontWeight: 650 } }, t('a11.scope2', 'What we will monitor')),
    /* THREE ROWS, ALWAYS, AND A ZERO WHERE THERE IS NOTHING.

       The reviewer wrote the rows out — field crops in hectares, date palms and
       fruit trees each as a count — and added the rule that makes them worth
       printing: "if there is no value, we should show 0". A row that disappears
       when it is empty leaves the farmer to work out whether we found no palms
       or forgot to look; a nought says which.

       The two tree lines are what the survey's species split is for (survey.js).
       Crops are bought by the hectare and trees by the head, so each row is in
       the unit its own half of the price is counted in. */
    kv([
      [t('a11.croparea', 'Field crops'), totals.cropHa ? area(totals.cropHa) : area(0)],
      [t('a11.palms', 'Date palms'), t('farm.treecount', '{n} trees', { n: num(totals.palmCount ?? 0) })],
      [t('a11.fruittrees', 'Fruit trees'), t('farm.treecount', '{n} trees', { n: num(totals.fruitCount ?? 0) })],
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

/* Review 22/08 — ALL THREE, ALWAYS: "each plot should have three options: Keep,
   Edit, Remove". The row used to show two, swapping Remove for Keep depending
   on which state it was in, which meant the farmer could only ever see half the
   choice and had to infer the other half from a greyed-out row.

   So the three are always drawn, and the one that is already true is the one
   lit: an included plot shows Keep in the brand colour and Remove plain, a
   removed one the other way round. Pressing the lit one does nothing it has not
   already done, which is the correct behaviour for a state that is being
   displayed as well as offered. */
function areaRow(scope, a, ui) {
  const meta = LAND_USE_META[a.kind];
  const selected = ui.selected === a.id;
  return h(`div.row${selected ? '.row--sel' : ''}`, {
    // Two lines rather than two columns. Three captioned buttons and a plot
    // description do not share 360 dp: side by side, "Field crops · 7.7 ha"
    // wrapped to three lines and the row grew taller than the pair it was
    // trying to fit beside. The description gets the width, the buttons get
    // the line under it.
    style: {
      flexDirection: 'column', alignItems: 'stretch', gap: '2px',
      opacity: a.included ? 1 : 0.55,
    },
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
    // A tree area is counted, not measured: the hectares its palms stand on are
    // not what it is priced on and not what the farmer would quote about it.
    `${t(`landuse.${a.kind}`, LAND_USE_LABEL[a.kind])} · ${a.kind === 'trees' && a.treeCount
      ? t('farm.treecount', '{n} trees', { n: num(a.treeCount) })
      : area(a.areaHa)}`)),

  h('div', { style: { display: 'flex', gap: '2px', justifyContent: 'flex-end' } },
    rowAction('check', t('a11.keep', 'Keep'), () => scope.setIncluded(a.id, true), { on: a.included }),
    rowAction('edit', t('action.edit', 'Edit'), () => scope.edit(a.id)),
    rowAction('trash', t('a11.remove', 'Remove'), () => scope.setIncluded(a.id, false), { on: !a.included })));
}

function rowAction(iconName, label, onclick, opts = {}) {
  return h('button.iconbtn.iconbtn--bare', {
    onclick, 'aria-label': label, title: label, type: 'button',
    style: opts.on ? { color: 'var(--brand-700)' } : { color: 'var(--ink-500)' },
  }, icon(iconName, 20), h('span.iconbtn__label', label));
}

/* The two answers to "what is growing on this land?", asked on A9 by
   farmTypeField() and per plot on A10D.

   They are here rather than up beside A9 because A10D also reads them, and one
   list is the only way the two screens can go on describing the same things in
   the same words. A12 was the third reader and it is gone (review 01/09).

   WF4.048's wording travels with the options: the tree category is "date palms
   and fruit trees" everywhere in the app, never "orchard", which is not the
   local term.

   Review 01/09 — THE EXAMPLES ARE OFF THE SUBTITLES. "Under field crops: keep
   'priced per area', delete 'for example: wheat, alfalfa…'. Under date palms
   and fruit trees: keep 'priced per tree', delete 'for example: dates,
   olives…'". Nine crops listed under an option nobody is choosing BY crop made
   the card four lines tall and invited the farmer to hunt for his own crop in a
   list that was never meant to be exhaustive. What is left is the thing the
   answer actually decides: how the plot is priced. */

const COVERAGE = [
  {
    id: 'crops', icon: 'sprout',
    label: ['farmtype.crops', 'Field crops'],
    sub: ['a12.crops.sub2', 'Priced per area.'],
  },
  {
    id: 'trees', icon: 'tree',
    label: ['farmtype.trees', 'Date palms and fruit trees'],
    sub: ['a12.trees.sub2', 'Priced per tree.'],
  },
  {
    id: 'mixed', icon: 'grid',
    label: ['farmtype.mixed', 'Both'],
    sub: ['a12.mixed.sub', 'One subscription covering field crops, date palms and fruit trees.'],
  },
];

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

/**
 * What one tier costs this farm, per month, in USD.
 *
 * It used to hand back the working as well — "12.4 ha × SAR 40.01" — for
 * WF4.099, and the 22/08 review deleted that line: a holding with crops priced
 * per hectare and trees priced per tree has two rates and no single cost per
 * area to state, so the sum could only ever be right for half the farms this
 * app sells to. The quantities are on the card above the price; the rates are
 * server configuration (WF4.102) and belong on the payment page with the
 * annual option that went the same way.
 */
function planPrice(family, tier, totals) {
  let usd = 0;
  if (family !== 'tree' && totals.cropHa > 0) usd += totals.cropHa * RATES.crop[tier];
  if (family !== 'crop' && totals.treeCount > 0) usd += totals.treeCount * RATES.tree[tier];
  return usd;
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
  // Review 22/08 — the plots now carry their own class, decided one by one on
  // A11 rather than for the whole farm on A12, so the split is read off them
  // instead of being guessed from a single answer. The fallback below is for a
  // draft that somehow reaches the price with no plots on it — the old halving
  // rule, kept for that one case.
  const kept = (d.plots ?? []).filter((p) => p.included !== false);
  if (kept.length) {
    const round1 = (n) => Math.round(n * 10) / 10;
    const cropHa = round1(kept.filter((p) => (p.kind ?? 'crops') === 'crops').reduce((s, p) => s + p.areaHa, 0));
    const treeHa = round1(kept.filter((p) => p.kind === 'trees').reduce((s, p) => s + p.areaHa, 0));
    return { cropHa, treeHa, treeCount: Math.round(treeHa * TREES_PER_HA) };
  }
  const traced = d.areaHa ?? 12.4;
  if (d.farmType === 'crops') return { cropHa: traced, treeHa: 0, treeCount: 0 };
  if (d.farmType === 'trees') {
    return { cropHa: 0, treeHa: traced, treeCount: Math.round(traced * TREES_PER_HA) };
  }
  /* A mixed holding, and the one the deck photographs. It used to halve the
     traced area between the two, which put a hectare figure on the trees as
     well — and a tree block is priced by the head, so the halving printed a
     number nobody is charged for beside the number they are. A smallholding
     with its fields and a block of palms along the boundary is the shape this
     screen has to show, so that is what the fallback is: the whole traced area
     as crops, and the palms counted separately. */
  return { cropHa: traced, treeHa: 0, treeCount: 220 };
}

/* The plan cards, and the commercial facts that go with them.

   Six things about this page came out of review, and all six are about trust
   rather than layout:

     * Compare all features is at the TOP. At the bottom it was below two price
       cards and a trial line, and nobody who had not already decided ever
       scrolled to it — which made the comparison table the app's best-argued
       screen and its least-read one.
     * Both Choose buttons are the SAME. A green button on one card and a grey
       one on the other is the app choosing for the farmer, and the "Most
       chosen" badge that went with it was an assertion nobody could check.
       They were both made neutral first, and the round after that made them
       both primary — sameness was the requirement; quietness never was, and a
       grey button under a price reads as the option you are being talked out
       of.
     * The page shows only what the farmer asked to be covered. He answered
       crops-or-trees-or-both before the survey ran; repeating tree features to
       somebody who grows wheat is the repetition the comparison table was
       already criticised for.
     * The annual discount, the VAT position, when permission is asked for, and
       the free trial are all stated. They were scattered, absent, or in eight
       point at the bottom of the screen.
     * The warnings are one block, in one place, at the end.
*/

/* THE ANNUAL DISCOUNT, in one place, because four screens quote it: A13's plan
   cards, F5's subscription, F6's comparison and the before-you-buy block.

   It went to the payment page at the 22/08 review, when annual and monthly cost
   the same per month and a second figure on the card was noise. It is back
   because there is now a saving to state, and a saving is a reason to choose —
   which belongs on the thing being chosen rather than two screens later.

   WF4.102 keeps the real figure on the server; when the payment page exists it
   will fetch it rather than read this constant. */
export const ANNUAL_DISCOUNT = 0.15;

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
            t('a13.surveying.body', 'Your plan price depends on what the survey finds, so we can’t show it just yet. We’ll let you know as soon as it’s ready.')))),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, req('WF4.091'))),
    };
  }

  const totals = raw?.survey ? surveyTotals(raw) : drawnTotals(d);
  const family = totals.cropHa > 0 && totals.treeCount > 0 ? 'combined'
    : totals.treeCount > 0 ? 'tree' : 'crop';

  return {
    tabs: false,
    top: appBar({
      title: t('a13.title', 'Your plan'),
      // The plots route has no farm record yet, and since the 21/08 review it
      // has had a name from the very first screen — so the bar can say which
      // farm this price is for either way.
      subtitle: farm?.name ?? ((d.farmName || '').trim() || autoFarmName()),
    }),
    body: page(
      // WF9.029 — thirty days, said first and said plainly. It was a grey line
      // under the fold, which is where a free trial goes to be missed.
      card({ accent: 'good' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { color: 'var(--st-good)', display: 'flex' } }, icon('check', 22)),
          // Review 22/08 — the plain phrase. "On either plan" was answering a
          // question about the plans before the plans had been shown.
          h('span', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } },
            t('a13.trial', '30 days free trial'))),
        /* THE PROMISE ABOUT MONEY, SAID ONCE, HERE.
           It was said twice — "we will seek your authorization…" on this card
           and "we ask your permission before taking any payment" in the block
           at the end — in two different registers, which reads less like a
           promise kept twice than like a promise being negotiated. It belongs
           beside the trial, because the trial ending is the moment it is about,
           and the wording opens with the ask rather than with the charge.
           (Mark still owes the final sentence; this is the shape of it.) */
        h('div', { style: { color: 'var(--ink-700)' } },
          // Review 01/09 — "remove 'at all'". It was doing the work of an
          // argument in a sentence that is a promise, and a promise that
          // protests is a promise being doubted.
          t('a13.trial.permission2', 'We will ask for your permission before any payment is taken from your card, and nothing is charged during the free trial.')))),

      // Review 22/08 — "Cultivated areas to be monitored". The card was headed
      // with the farm's name, which is already in the bar above it, so the one
      // line that could have said what the numbers under it were did not.
      card({}, cardPad(
        h('div', { style: { fontWeight: 650 } }, t('a13.yourfarm', 'Cultivated areas to be monitored')),
        // Crops in hectares, trees by the head, and both named — the card is
        // what the price below it is worked out from, and a bare "220 trees"
        // beside "12.4 ha" left the reader to guess which of the two units the
        // subscription was counted in. It is counted in both.
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          [totals.cropHa ? area(totals.cropHa) : null,
            totals.treeCount
              ? t('a13.treesqty', '{n} date palms and fruit trees', { n: num(totals.treeCount) })
              : null].filter(Boolean).join(' · ')))),

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
        const usd = planPrice(family, level.tier, totals);
        const key = `${family === 'combined' ? 'combined' : family}_${level.tier}`;
        return card({}, cardPad(
          h('span', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)' } },
            t(`plan.${level.tier}`, level.name).toUpperCase()),
          // WF4.102 — the farmer's own currency, from a server rate. Review
          // S34: the figure is exclusive of VAT and says so, because a farmer
          // who budgets from this number and then sees 15% more on the receipt
          // has been misled by a rounding of the truth.
          /* Review 01/09 — "MOVE '+VAT' UP ONE LINE TO THE RIGHT OF 'MONTH'".
             It was its own line under the price, which made a qualification of
             the figure look like a second fact about the plan. It belongs to
             the number, so it is set beside it, smaller and quieter — one line,
             one price, one caveat. */
          h('div.num', { style: { display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'wrap' } },
            h('span', `${priceBare(usd, d.country)} / ${t('unit.month', 'month')}`),
            h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)', fontWeight: 600 } },
              t('a13.plusvat', '+ VAT'))),
          /* THE ANNUAL RATE HAS GONE BACK TO THE PAYMENT PAGE, and so has the
             line naming what the level covers. Review 01/09 struck both out
             with one word — "delete" — and the card is better for it: the
             farmer is choosing a LEVEL here, and a second price for a billing
             period he has not been offered yet is a number to compare against
             the one he is deciding on. The saving is stated once, in "Before
             you buy" at the foot of this screen, where the other commercial
             facts are. */
          // Review S03 — the same button on both cards. The farmer picks, and
          // both cards offer him the same weight of button to pick with: the
          // point was never that choosing should look tentative, it was that
          // neither plan should be dressed as the recommended one.
          btn(t('a13.choose', 'Choose'), {
            variant: 'primary', size: 'sm',
            // Review 01/09 — BOTH ROUTES GO ON TO THE SAME PLACE. The survey
            // route used to drop the farmer into the app from here while the
            // drawn route went on to A14, which is why one of them never saw
            // the screen that says the work is done.
            //
            // A payment page briefly sat between the two, and the second pass
            // of the same review took it out again: it was never in the App Map
            // and the marker asking for it is a conversation rather than a
            // screen. The annual saving is stated in "Before you buy" below.
            onclick: () => {
              d.plan = key;
              state.session.plan = key;
              commit('a13');
              go(farm ? `A14:${farm.id}` : 'A14');
            },
          })));
      }),

      // Review 22/08 — the way back to the list the price was worked out from.
      // A farmer looking at a figure he did not expect has exactly one useful
      // question — which plots is this for — and the answer was three taps of
      // back away, through the plan he had not chosen yet.
      btn(t('a13.modify', 'Click here to modify the list of plots.'), {
        variant: 'ghost',
        onclick: () => go(farm ? `A11:${farm.id}` : 'A11'),
      }),

      // Review S06 — one block, at the end, holding everything that qualifies
      // the prices above. Scattered through the page these read as small print
      // hidden in three different places.
      section(t('a13.beforeyoubuy', 'Before you buy'), {},
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          when(family === 'combined', () => disclaimer(
            // WF4.107 — one product, one price, one renewal date. Never two.
            t('a13.combined', 'You have crops and trees, so this is one combined subscription — a single price and a single renewal date.'))),
          // The permission sentence is NOT repeated here. It moved up to the
          // trial card, where the moment it describes is, and a promise made
          // twice on one screen reads as a promise being argued.
          //
          // WF9.020 / WF9.023 — the in-app route is the only one named. The web
          // route exists but the app must not describe or link to it in KSA or
          // the UAE, so it is not mentioned at all.
          disclaimer(t('a13.annualsave', 'A 15% discount is offered for all annual subscriptions.')),
          disclaimer(t('a13.cancel', 'You can cancel the renewal of your monthly or annual subscription at any time in the App Store or Google Play.'))))),
  };
}

/* -- A14 · You're ready, WF4.112 ------------------------------------------ */

/* TWO ROUTES ARRIVE HERE NOW, and they differ in one thing: whether the farm
   record already exists. The survey route made it on A10, because the survey
   had to have something to run against; the drawn route is still carrying its
   plots in the signup draft and they become a farm when this screen is left.
   Everything the farmer sees is the same either way. */
export function A14(farmId) {
  const d = draft();
  const made = farmId ? farmById(farmId) : null;
  // The farm was named on A9, or numbered for the farmer who left the field
  // blank. Either way the name he is about to see on Home is the name this
  // screen says. Resolved once per render so the two uses below agree.
  const farmName = made?.name ?? d.farmName ?? autoFarmName();
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
      // Review 22/08 — two sentences where there were three paragraphs. The
      // farm is added, not "being added to a watchlist"; the wait is a day, not
      // forty-eight hours; and renaming is a thing to discover in Farm settings
      // rather than a footnote on the screen that says the work is done.
      // Review 01/09 — "your", not "our". It is the farmer's account; the app
      // saying the farm has been added to OURS is the one sentence on this
      // screen that could be read as us taking possession of his land.
      h('p', { style: { margin: 0, color: 'var(--ink-700)', maxWidth: '30ch' } },
        t('a14.watchlist2', '{farm} has been added to your account.', { farm: farmName })),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '32ch' } },
        t('a14.first', 'We will notify you when the farm monitoring results are available (usually within one day).')),
      h('div', { style: { flex: '1 1 auto' } })),
    dock: actionDock(
      btn(t('a14.go', 'Go to my farm'), {
        variant: 'primary', size: 'big',
        onclick: () => { finishFarm(d, farmName, made); enterApp('owner'); },   // WF4.002
      }),
      // Review 22/08 — a farmer with a second holding is at his most willing to
      // add it here, having just been through the whole of the first one. The
      // farm he has finished is saved either way; only where he lands differs.
      btn(t('a14.another', 'Add another farm'), {
        variant: 'secondary',
        onclick: () => {
          finishFarm(d, farmName, made);
          // Straight to the fork, with the account's farms already counted so
          // the next name offered is Farm 2 rather than Farm 1 again.
          resetLocal('addfarm');
          draft().inApp = true;
          go('A9', { replace: true });
        },
      }),
      h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('a14.trial', 'Trial: 30 days remaining'))),
  };
}

/** Turn the finished draft into a farm record and clear it.

    `existing` is the farm A10 already made on the survey route. There is
    nothing left to create there — the record has been carrying the survey since
    the boundary was drawn — so the draft is simply cleared. */
function finishFarm(d, farmName, existing = null) {
  if (existing) { resetLocal('signup'); return; }
  addFarm({
    name: farmName,
    type: d.farmType ?? 'crops',
    areaHa: d.areaHa,
    // Review 22/08 — only the plots the farmer kept on A11. A removed plot is
    // off the quote, so it must not arrive as a plot record he is looking at.
    plots: (d.plots ?? []).filter((p) => p.included !== false),
  });
  resetLocal('signup');
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
    if (d.code === '000000') {
      d.error = 'expired'; commit('a15'); return;
    }
    // THERE IS ONE ROLE TO ARRIVE IN NOW. The worker role went with task
    // management: with no queue to hold and nothing to mark done, a worker
    // account had nothing in it. Anyone redeeming an invitation is the farm's
    // supervisor, which is who the owner is inviting in the first place.
    resetLocal('join');
    // WF4.003 — the role comes from the invitation and is never chosen here.
    enterApp('supervisor');
    toast(t('a15.joined.sup', 'You have joined Al Kharj North as a Farm Supervisor'));
  };

  return {
    tabs: false,
    // Review 22/08 — "as a guest". Redeeming a code never makes anyone an
    // owner, and the title is where that is cheapest to say.
    top: appBar({ title: t('a15.title', 'Join a farm as a guest'), onBack: () => go('A3', { replace: true }) }),
    body: page(
      // Review 22/08 — the reviewer's sentence. It names both ways in and says
      // who the code came from, which is what somebody holding a six-digit
      // number and no context actually needs.
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a15.enter', 'Enter the invitation code or scan the QR code sent to you by the person who set up this service.')),
      h('div.otp', cells.map((c, i) => h(`div.otp__cell${c.trim() ? '.otp__cell--filled' : ''}${i === d.code.length ? '.otp__cell--focus' : ''}`,
        { style: { display: 'grid', placeItems: 'center', width: '40px' } }, c.trim()))),
      when(d.error === 'expired', () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        disclaimer(t('a15.expired', 'That invitation has already been used or has expired. Invitations last 7 days and work once.'), true),
        btn(t('a15.contactowner', 'Contact the farm owner'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),
      // Review 22/08 — the K has gone. It was there because the mockup keyed
      // the joining role off a letter, which made a numeric keypad carry one
      // letter and no way to reach the other twenty-five. Invitation codes are
      // six digits, so the keypad is the same one A6 uses.
      h('div.keypad', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => (
        k === '' ? h('span') : h('button', { onclick: () => type(k) }, k === 'del' ? icon('back', 22, 'flip') : k)))),
      // WF4.114 — the QR code on the inviter's screen is the second route in.
      btn(t('a15.scan', 'Scan QR code'), { variant: 'secondary', icon: 'qr', onclick: () => toast(t('a15.scanning', 'Point the camera at the code on the other phone')) }),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a15.nocode', 'No code? Ask the farm owner to send you one.')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a15.mockhint', 'Mockup: any 6 digits join as the farm’s Supervisor. Type 000000 to see the expired-invitation message.'))),
    dock: actionDock(btn(t('a15.join', 'Join'), {
      variant: 'primary', disabled: d.code.length < 6, onclick: join,
    })),
  };
}
