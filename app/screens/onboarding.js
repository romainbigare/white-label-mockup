/* ---------------------------------------------------------------------------
   onboarding.js — chapter 4: A1 … A21, and password recovery.

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
       to. Skip and the last card both lead to A20. It is first-run only; F12
       brings it back afterwards (WF4.030).
     * A20 IS THE FRONT DOOR, and there is no routing screen in front of it. A2
       is gone: logging in is the common case, so the login form is the screen,
       and creating an account or joining a farm as a guest are links beneath
       it. Nobody types a password on the way to redeeming an invitation — the
       guest route still collects nothing but six digits, on its own screen.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local, resetLocal } from '../core/local.js';
import { t, langMeta } from '../core/i18n.js';
import { go, back, enterApp, openModal, openSheet } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { logo, BRAND } from '../ui/brand.js';
import {
  appBar, barAction, page, section, card, cardPad, btn, actionDock, actionDockPair,
  field, input, select, checkbox, disclaimer, req, kv, chips, helpBlock,
  mapBand, languageChoice, row, segmented,
} from '../ui/components.js';
import { area, priceBare, priceRange, num, toHectares } from '../core/format.js';
import { boundaryCanvas, undoVertex, starterPolygon, PLOT_SCALE } from '../ui/boundaryEditor.js';
import { mapSvg, landUseSvg, outlineOf } from '../ui/map.js';
import { addFarm, confirmSurvey, setFarmBoundary, redeemFarmInvitation } from '../data/actions.js';
import {
  surveyTotals, typeFromTotals, decidedAreas, LAND_USE, LAND_USE_META, TREES_PER_HA,
  addArea, setAreaIncluded,
} from '../data/survey.js';
import { farmById, rawFarm, visibleFarms, me } from '../data/selectors.js';

/* The draft an owner builds across A8 → A19. One object, one flow. */
const draft = () => local('signup', {
  country: 'SA', phone: '', email: '', agreed: false, code: '',
  // Review 06/09 — "split into 'First name' and 'Last Name'", and a company
  // name beside them that nobody has to fill in.
  firstName: '', lastName: '', company: '', password: '', showPassword: false, areaUnit: null,
  farmName: '', farmType: null,
  // The screening step's own two numbers — a guess, not a measurement, so
  // they never touch a plot record. See A9C / A11.
  roughArea: '', roughTrees: '',
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

/* -- A1 · Welcome, and A2 · the language sheet ---------------------------

   REVIEW 06/09 STRUCK THE OLD A1 OUT AND DREW TWO SCREENS IN ITS PLACE. The
   first thing the app showed was a language chooser, which is a question about
   the app asked before the app has said what it is; the note on his own first
   screen is "tells users what we do (to avoid any misunderstanding)". So the
   first screen introduces the product and the language question moves into a
   bottom sheet behind the chip in the corner — the pattern he pasted in from
   another app, and the pattern the rest of this app already uses for a choice
   with more than a few answers.

   Nothing was lost by moving it. WF4.011 … WF4.016 are all about the CONTROL —
   ten languages, named in their own scripts, taking effect the moment they are
   pressed — and the control is the same one, in a sheet that is allowed to
   scroll rather than on a screen that was not. WF4.014's pre-selection is what
   makes the chip readable before anything is pressed: it opens on the device's
   language, so most farmers never open the sheet at all.

   TWO WAYS OFF THE SCREEN, WHICH IS WHAT SKIP AND NEXT MEAN. Next takes the
   tour, because somebody still reading the first screen is somebody the product
   has not yet been explained to. Skip goes straight to the front door. It is
   the same pair the old screen had, drawn the way an onboarding screen usually
   draws it rather than as two stacked buttons of nearly equal weight.

   REGISTERED USERS NEVER SEE EITHER. "Registered users will go straight to
   login screen" — which is what `firstRunDone` has always done; it is recorded
   here because the note asked for it and because it is the reason this screen
   can afford to be slow and welcoming. */

/* The top row of the welcome screen: the language in one corner, the way past
   it in the other. Not an appBar — there is no title and nothing to go back to,
   and a bar would draw a line across a screen whose whole job is to feel like
   the front of something. */
function introTop(onSkip) {
  return h('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '8px',
      // The top slot sits outside `.page`, so it carries its own gutters —
      // without them Skip runs off the edge of the phone.
      padding: 'calc(var(--safe-top) + 6px) var(--sp-4) 0',
    },
  },
  /* A GLOBE, NOT THE TRANSLATION MARK. "Can we put a globe? It's a globe
     everybody uses." Lucide's `languages` icon is an A beside a glyph — it
     names translation, which is a service, where a globe names the choice of
     where you are, which is the convention every app the farmer already has
     puts in this corner. */
  h('button.langchip', {
    type: 'button',
    onclick: () => go('A2'),
    'aria-label': t('a1.language', 'Choose your language'),
  }, icon('globe', 20), h('span', langMeta().native)),
  h('button.textlink', {
    onclick: onSkip,
    style: { fontWeight: 650, color: 'var(--ink-500)' },
  }, t('action.skip', 'Skip')));
}

/* The body both screens share, so the sheet is drawn over the screen it belongs
   to rather than over a copy of it that can drift. */
function welcomeBody({ dimmed = false } = {}) {
  return h('div.page', {
    style: {
      gap: '16px', height: '100%', textAlign: 'center', alignItems: 'center',
      // The sheet is the thing being read on A2, so what is behind it stands
      // back — the same way the reference does it.
      ...(dimmed ? { filter: 'grayscale(0.15)', opacity: 0.55 } : {}),
    },
  },
  /* THE MARK AND THE SENTENCE SIT ABOVE THE MIDDLE. They were centred exactly,
     with equal spacers above and below — which is the right instinct for a
     welcome screen and half a step too low in practice, because the eye reads
     the optical centre as sitting higher than the geometric one and because the
     address at the foot weights the bottom of the page. "Can we move the logo
     up a bit? … the logo needs to be kind of centred a bit."

     So the spacers are uneven rather than gone: the block still floats rather
     than being pinned to a fixed gap at the top, and it lands where the reader
     expects to find it. */
  h('div', { style: { flex: '0.62 1 auto', minHeight: '12px' } }),
  logo('lockup', 108),
  /* WHAT WE DO, IN ONE SENTENCE. The reviewer wrote it on his own mockup and it
     is his wording, with one letter changed: he typed "IA-powered", which is
     the French and Spanish order of those two initials. */
  h('p', {
    style: {
      margin: 0, maxWidth: '30ch', fontSize: 'var(--t-lead)',
      lineHeight: 1.35, color: 'var(--ink-700)',
    },
  }, t('a1.pitch', 'AI-powered satellite monitoring for precision agriculture, to enhance your farm profitability.')),
  h('div', { style: { flex: '1 1 auto', minHeight: '12px' } }),
  // Review 01/09 put the address on this screen and it stays on it: a farmer
  // who wants to read about us before he registers has somewhere to go, and it
  // is not a link, because sending anyone out of the app here loses them.
  h('p', {
    style: {
      margin: 0, fontWeight: 600,
      fontSize: 'var(--t-meta)', color: 'var(--brand-700)',
    },
  }, BRAND.site),
  h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
    req('WF4.011', 'WF4.014', 'WF4.018')));
}

export function A1() {
  /* SKIP GOES TO THE SIGN-UP FORM, NOT TO THE LOGIN SCREEN.

     This screen is first-run only, so everybody reading it is somebody the app
     has never met — a registered farmer never gets here, which is the reviewer's
     own note. Skipping the introduction therefore means getting on with making
     an account, and A8 carries the way back to A20 for the one person in a
     hundred who reinstalled. Sending Skip to a login screen that no longer
     offers "create an account" would be a door into a room with no doors. */
  const skip = () => go('A8');
  return {
    tabs: false,
    top: introTop(skip),
    body: welcomeBody(),
    dock: actionDock(btn(t('action.next', 'Next'), {
      variant: 'primary',
      onclick: () => openTour(),
      deckTo: 'A3',
    })),
  };
}

/* A2 · the language sheet.

   In the app this is a sheet over A1 — the chip opens it and choosing a row
   closes it. It is a screen here for the same reason C3 is: §3.2 wants the
   thing a farmer sees to have a page in the deck, and a carousel or a sheet
   that only exists as a state of another screen prints as nothing at all. So
   the sheet is drawn in place, over its own screen, and the deck gets a page of
   the second thing the app shows anybody.

   WF4.013's no-scrolling rule was about a SCREEN. A sheet that scrolls is what
   the reviewer drew, and ten languages is the list he supplied. */
export function A2() {
  return {
    tabs: false,
    top: introTop(() => go('A20')),
    body: h('div', { style: { position: 'relative', height: '100%' } },
      welcomeBody({ dimmed: true }),
      /* THE SHEET STARTS HIGHER THAN A SHEET USUALLY DOES. The inline default
         is 78% of the phone, which is right for a sheet you raise over a screen
         you were reading; here the sheet IS the screen, and at 78% the tenth
         language sat below the fold with nothing to suggest it was there.
         "There is Georgian and Armenian. So the list should move up then. Why
         does it start so low?" All ten fit now without a drag. */
      h('div.sheet.sheet--inline.sheet--tall', { style: { position: 'absolute', insetInline: 0, bottom: 0 } },
        h('div.sheet__grip'),
        h('div.sheet__body',
          h('h2.sheet__title', t('a1.title', 'Choose your language')),
          languageChoice({ onchoose: () => back() }),
          h('p', { style: { margin: '4px 0 0', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t('a1.later', 'You can change this later in Settings.'),
            req('WF4.011', 'WF4.012', 'WF4.015', 'WF4.016'))))),
  };
}

/* -- A20 · The front door, WF4.017 … WF4.025 -------------------------------

   REVIEW 06/09 REDREW THIS SCREEN AND CHANGED WHAT AN ACCOUNT IS.

   The reviewer built his own version of it out of pieces of ours and a banking
   app, and wrote the assumptions underneath: "Most users will sign in via Face
   ID. The login screen is only shown to registered users who fail Face ID. No
   need to 'create an account' or 'join farm as a guest' here. OTP can be sent
   to registered mobile number or registered email address. 'Switch account' is
   available in case user has created multiple accounts for different farms."
   Alongside it he set out the account itself: sign up with an EMAIL; name,
   phone and the rest are details collected afterwards; coming back is Face ID
   first and a code to the email when that fails. No more logging in by phone.

   WHAT THAT COST, AND WHY EACH PIECE WENT.

     the Mobile / Email switch   there is one credential now, so there is
                                 nothing to switch between. Half the screen was
                                 a control for a choice that no longer exists.
     the country selector        it belongs to a phone number, and a phone
                                 number is no longer how anyone gets in. It is
                                 still on A8, where the number is collected, and
                                 review 06/09 widened it to every country.
     the two doors               "no need to create an account or join a farm as
                                 a guest here". This screen is for somebody the
                                 app has already met. Both links moved to A8,
                                 which is where somebody the app has NOT met
                                 lands — see the note there.

   WHAT ARRIVED. The greeting, which is the whole argument for the redraw: a
   screen that says "Welcome back, Khaled" is a screen that has already told you
   the app knows who you are, so a password field on it needs no label above it
   explaining whose password. Switch account is for the farmer holding two
   accounts for two farms, and it is a link rather than a button because it is
   the exception. And Face ID is offered first, in the order the reviewer put
   it: the fastest way in, above the way in that needs typing.

   WF4.017's ban on a login form was about the ROUTING screen and died with it.
   WF4.023's "a code to the registered contact" is unchanged; the registered
   contact is the address now. */

export function A20() {
  const d = local('login', {
    // 'known' is the returning farmer this screen was redrawn for; 'other' is
    // what Switch account opens, and the only state that has to ask who.
    who: 'known', email: '',
  });
  const person = me();
  const known = d.who === 'known';
  const email = known ? person.email : d.email.trim();

  return {
    tabs: false,
    /* NO APP BAR. Review 06/09 (second pass) took it off: a bar carrying the
       word "Log in" over a screen that already says "Welcome back" is the same
       sentence twice, and the language picker on it was the third place in four
       screens to offer the same menu — A1's chip, this bar, and F7. Somebody
       who has an account has chosen a language already, and Settings is where
       he changes it. What is left is one column, top to bottom, with nothing
       above it. */
    body: page({ class: 'page--fill' },
      /* WHY THIS SCREEN IS OPEN AT ALL.

         The reviewer's own assumption: Face ID runs first, and this screen is
         only drawn when it fails. There used to be an "Unlock with Face ID"
         button here, which put the fastest way in below the slowest — and asked
         the farmer to press, by hand, the thing that had just declined to
         recognise him. The notice replaces it: it says what happened, in the
         place a phone says it, and everything under it is what to do instead.

         It is a strip rather than a toast because a toast is gone in three
         seconds and this is the reason the screen exists — and because a deck
         printed on paper cannot photograph something that has already faded. */
      when(known, () => h('div.notice',
        icon('warning', 18),
        h('span', t('a3.faceidfailed', 'Face ID not recognised')))),

      h('div', { style: { display: 'flex', justifyContent: 'center', paddingTop: '2px' } },
        logo('lockup', 78)),

      /* THE GREETING IS ONE SENTENCE ON TWO LINES, not a heading with a caption
         under it. Review 06/09 (second pass) — "Welcome back and Khaled must be
         the same font, size, etc." They were a title and a bold sub-line, which
         made the farmer's own name look like a label on the greeting rather
         than the end of it. */
      when(known, () => h('h1.a3greeting',
        h('span', t('a3.welcome', 'Welcome back')),
        h('span', person.firstName))),

      when(!known, () => field(t('a5.email', 'Email address'), input({
        type: 'email', inputmode: 'email', autocomplete: 'email', name: 'loginemail',
        placeholder: 'name@example.com', value: d.email,
        oninput: (e) => { d.email = e.target.value; },
        onchange: () => commit('a3'),
      }))),

      /* ONE BLOCK: the field, the two ways round it, and the button that uses
         it. They were three siblings of the page with the page's own gap
         between them, which spread a single question over a third of the
         screen. Review 06/09 (second pass) asked for it to look "a little more
         organised and structured", and grouping by what a control is FOR is the
         structure a form has. */
      /* ONE BUTTON, SINCE REVIEW 21/09. This block used to be five controls —
         a password field with a show/hide eye, Switch account, Forgot your
         password?, Log in, and a quiet "Send code by SMS instead" underneath
         it. Four of the five existed to serve the password, and the password is
         gone: "If Face ID doesn't work, isn't it simpler just to issue an SMS
         code? Ir seems apps are moving away from passwords."

         So the fallback is now the whole screen. Face ID first; if it fails,
         one button sends a code. Switch account survives because it answers a
         different question — which account, not how to prove it — and a farmer
         holding several farms under several accounts still needs it. */
      h('div.a3form',
        btn(t('a5.send', 'Send code by SMS'), {
          variant: 'primary',
          disabled: !EMAILISH.test(email),
          // A9 in login mode: the code is the whole of logging in now, so it
          // opens the app rather than the farm-creation path a new account
          // follows.
          onclick: () => go('A9:login'),
        }),

        h('div.a3links',
          link(known ? t('a3.switch', 'Switch account') : t('a3.thisdevice', 'Back to my account'),
            () => { d.who = known ? 'other' : 'known'; commit('a3'); }))),

      /* THE WAY TO A PERSON, AT THE FOOT OF THE FRONT DOOR.

         Everything above this line assumes the farmer can get in; the two
         buttons under it are for the one who cannot, and he is the visitor with
         the least patience for hunting through a menu he has not reached yet.

         Review 01/09 (second pass) — "align the 'we are here to help', and the
         contact buttons to the bottom of the screen". The spacer takes whatever
         room is left over, so the block is against the bottom on a tall phone
         and simply follows the form on a short one — pushed down, never pushed
         off. */
      h('div', { style: { flex: '1 1 auto', minHeight: 'var(--sp-4)' } }),
      h('span', { style: { display: 'block', height: '1px', background: 'var(--ink-200)' } }),
      helpBlock({ prominent: false }),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        req('WF4.022', 'WF4.023', 'WF4.024', 'WF4.025'))),
  };
}

/* The two doors, at the size an exception deserves. They were on A20 until
   review 06/09 took them off it — "no need to 'create an account' or 'join farm
   as a guest' here" — and they are on A8 now, which is the screen somebody the
   app has never met actually lands on. */
function doorLink(lead, label, onclick) {
  return h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
    h('span', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, lead),
    link(label, onclick));
}

/* FORGOT IS GONE, AND SO IS THE QUESTION IT ANSWERED.

   Review 21/09 struck the whole page through and wrote "Delete?". It is the
   last thing to fall out of the password decision: with no password there is
   nothing to reset, and a screen called "Reset your password" on an app that
   has none is worse than no screen at all.

   Where its traffic went: A20's "Forgot your password?" went with it, because
   A20's one button already does what this screen did — send a code to the
   registered number. A farmer who cannot get in presses that. The A20 -> FORGOT
   -> A9 journey in screens/index.js went too, for the same reason; there is one
   way in now and it is A20 -> A9.

   Two helpers went with it because nothing was left calling them: the
   show/hide eye (`passwordInput`) and the rule it was checked against
   (`passwordOk`). They were the last password code in the app. */

/* -- A3 · Guided tour, WF4.026 … WF4.031 ---------------------------------

   FIVE PANELS SINCE THE 06/09 REVIEW, AND ALL THE WORDS ARE THE REVIEWER'S.

   The tour used to be five panels of placeholder copy over a big icon, held
   open for Hani to supply the text. He supplied it at the 01/09 review, and it
   changed the shape of the thing: each panel now argues a part of the product
   — how the service works, what the planner does, what the advice covers, what
   it does to yields, and what the farmers who already use it get out of it —
   and each is ILLUSTRATED BY THE SCREENS THAT DO IT rather than by a picture of
   an icon.

   REVIEW 06/09 STRUCK OUT THE PANEL THAT WAS STILL AN ICON. It was the opening
   one, "Enhancing your farm profitability through precision agriculture", and
   it was the last card in the tour making a claim rather than showing a thing.
   Deleting it costs nothing that is not said better one card later, and the
   sentence it opened on now belongs to the welcome screen, where somebody who
   has not pressed anything yet actually reads it.

   THE PANELS ARE KEYED BY NAME, NOT BY POSITION. They were `a4.0`, `a4.1` and
   so on, and deleting the first would have slid every catalogue one panel along
   — nine languages quietly showing the wrong caption under the right picture,
   with nothing anywhere reporting it. `id` is now the key, so a panel can be
   removed, reordered or inserted and every translation stays attached to the
   words it was made from.

   The illustrations are PICTURES: the two photographs the reviewer supplied for
   the satellite panel and the closing one, and generated screenshots of the six
   screens the middle panels describe. The screenshots are a build step —
   tools/tourshots.mjs regenerates all six from the running app — so the tour
   still cannot quietly drift away from the product it is advertising, without
   any of them being a live screen mounted inside a page it does not belong to.

   WF4.026 still holds: this is stills with captions, not a live interface with
   banners over it and not a demo account. */

const TOUR = [
  // Review 01/09 wrote this panel and review 06/09 made it the first: everything
  // after it is a thing the service does, and this is the sentence that says how
  // it can.
  {
    id: 'works',
    art: 'image', src: 'satellite.avif', alt: 'A satellite passing over farmland',
    headline: 'How our service works',
    body: 'We collect over 200 parameters from satellites that monitor your farm on a daily basis, even under cloudy conditions.',
    body2: 'Our Artificial Intelligence (AI) models, customized for your region, analyze these parameters and provide you with data-driven advice to optimize your farm operations.',
  },
  {
    id: 'planner',
    art: 'shots', shots: ['D1', 'F9'],
    headline: 'Farm planner',
    body: 'Our farm dashboard provides you with a daily report on your crop health, irrigation requirements, soil nutrition conditions, and local weather forecast.',
    // Review 06/09 — "Add 'Telegram'". Three channels now, and the order is the
    // order a Gulf farm actually reaches a supervisor in.
    // The wording followed the app: there is nothing to assign any more, and
    // nothing is a task. A piece of advice is shared with somebody, which is
    // what the panel now says.
    body2: 'We send you a daily list of what to do to keep your plants healthy and your yields high. You can share any piece of advice by WhatsApp, Telegram or SMS with the people who work for you.',
  },
  {
    id: 'advice',
    art: 'shots', shots: ['D2', 'D3'],
    // Review 21/09 — the heading broke as "Irrigation and fertilization /
    // advice", which orphans the one word the panel is about. The break is
    // explicit now: "Irrigation and" then "fertilization advice".
    headline: 'Irrigation and\nfertilization advice',
    body: 'By monitoring stress levels of your field crops and trees, we advise you on when to irrigate your plants and on the appropriate mix of soil nutrients to apply.',
    body2: 'This prevents you from wasting resources and damaging your crops through over-irrigation or applying the wrong fertilizers.',
  },
  {
    id: 'yields',
    art: 'shots', shots: ['B3', 'B4'],
    headline: 'Optimizing crop yields',
    body: 'We monitor biomass growth throughout the crop cycle against expected plant growth. This allows us to predict harvest yields and detect any problems.',
    // Review 06/09 — "plant growth" became "crop yields". The panel is called
    // Optimizing crop yields and the sentence under it was promising something
    // one step short of that: taller plants are the mechanism, the harvest is
    // the point.
    body2: 'We advise you on corrective actions to increase crop yields, and we recommend a harvest time to maximize farm revenues.',
  },
  // The closing panel is the only one that argues with numbers, so it is the
  // only one whose body is a list. Profitability sits apart from the three
  // above it because it is what they add up to, not a fourth measurement.
  {
    id: 'trust',
    // Review 21/09 — "update picture (sent separately). No need for black
    // frame." The five photographs he supplied, butted edge to edge: the strip
    // he pasted still carried the black dividers of the old one, and the note
    // beside it is what takes them off.
    art: 'image', src: 'crops.jpg', alt: 'Salad rows, figs, a field of greens, date palms and potato ridges',
    headline: 'Over 6 million farmers trust us worldwide',
    // Review 06/09 supplied this sentence whole. "Farmers" rather than "our
    // users", and "benefits" rather than "improvements": the reader is not a
    // user of anything yet, which is the entire situation this card is in.
    body: 'On average, farmers experience the following benefits from our service:',
    /* THE THREE FIGURES CAME OFF, AND ONE STAYED. Four percentage ranges on one
       card is a card arguing four cases, and three of them are the workings for
       the fourth: a farmer deciding whether to sign up is deciding about his
       profit, not about his fertiliser bill. So the three name the benefit and
       the funnel below them carries the only number the panel makes — and that
       number says "potential", because it is a range across six million farms
       and not a promise about this one. */
    stats: [
      ['a4.stat.yield', 'Increase in crop yields'],
      ['a4.stat.water', 'Irrigation savings'],
      ['a4.stat.fert', 'Reduction in fertilizer costs'],
    ],
    // Review 21/09 — the label broke as "Potential increase in farm /
    // profitability", so the break is explicit; and the figure gained its sign,
    // because a range on its own reads as a spread and not as a gain.
    total: ['a4.stat.profit', 'Potential increase\nin farm profitability', '+10–25%'],
  },
];

/**
 * Start the tour from the beginning. Whoever opens it owns the reset, because
 * A3 has no entry hook of its own and a half-watched tour must not resume at
 * card 4 the next time somebody asks to see it.
 *
 * `from` is 'help' when F12 opened it (WF4.030) and null on the first-run path.
 * It is the only thing that differs: where the end of the tour leads.
 */
export function openTour(from = null) {
  draft().tourCard = 0;
  go(from ? `A3:${from}` : 'A3');
}

/* Review 22/08 — THE TOUR MOVED IN FRONT OF THE FRONT DOOR. WF4.018 had it
   between "Create an account" and the sign-up form, which meant only somebody
   who had already decided to sign up ever saw the argument for signing up. It
   now sits between A1 and A20, so it runs once on first launch, in the language
   just chosen, before anyone is asked who they are — and Skip and the last card
   both land on A20 rather than on the form.

   It is still first-run only. A farmer who has logged out opens on A20, and F12
   is where the tour lives from then on (WF4.030). */

/* FIVE PANELS, FIVE PAGES IN THE DECK, ONE SCREEN IN THE APP.

   In the app the tour is a carousel: one screen, Next, five cards. On paper a
   carousel is one page showing one card and four the reviewer never sees, so
   the deck needs a page each — and it gets them as A4…A7, which render the
   same screen pinned to a card instead of reading the draft.

   The letters follow the ORDER, not the history: review 06/09 deleted the panel
   that was A3, so every letter after it moved down one and A4E is gone. Codes
   that stay put while the thing they name moves are how a deck and an app stop
   describing the same product — and the TRANSLATIONS no longer move with the
   letters either, because the panels are keyed by `id` now. */
const tourScreen = (fixed) => (from) => renderTour(fixed ?? Math.min(draft().tourCard, TOUR.length - 1), from);

export const A3 = tourScreen(null);
export const A4 = tourScreen(1);
export const A5 = tourScreen(2);
export const A6 = tourScreen(3);
export const A7 = tourScreen(4);

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
  // On the first run it ends where the argument it just made points: at the
  // form. It used to land on A20, back when A20 carried "create an account";
  // review 06/09 took that link off A20, so the tour hands straight to A8.
  const leave = from === 'help' ? () => back() : () => go('A8', { replace: true });
  return {
    tabs: false,
    top: h('div.app__top', h('div.appbar',
      h('div.appbar__spacer'),
      // WF4.029 — Skip is on every snapshot, and goes straight to A20.
      h('button.iconbtn', { onclick: leave, style: { minWidth: 'auto', padding: '0 14px' } },
        h('span', { style: { fontWeight: 650 } }, t('action.skip', 'Skip'))))),
    /* THE PANEL NEEDS AIR. It was set at a 14 px gap throughout, which is a
       list's rhythm rather than a poster's: the picture, the headline and two
       paragraphs sat in one undifferentiated column and the whole card read as
       dense. The gap is a paragraph now, and the picture gets a wider one under
       it than the words get between them — it is a different kind of thing, and
       the space is what says so. */
    body: h('div.page', { style: { gap: 'var(--sp-4)', textAlign: 'center', alignItems: 'center', height: '100%' } },
      // The picture gets a wider gap under it than the words get between them.
      // It is a different kind of thing from the copy, and the space is what
      // says so; a uniform rhythm made the panel one undifferentiated column.
      h('div', { style: { width: '100%', display: 'flex', flex: '1 1 auto', minHeight: 0, paddingBottom: 'var(--sp-2)' } },
        tourArt(c)),
      /* WF4.028 ASKS THAT THE LENGTH NOT BE A MYSTERY, AND THE DOTS ANSWER IT.
         There was a "3 of 6" line above the headline as well, and review 06/09
         read the pair the way anybody would: "seems redundant, delete '2 of 6'
         and keep graphics at bottom". The dots say the same thing in the place
         a carousel is looked at for it, and they say it without a number to
         translate. */
      h('h1', {
        // ONE SIZE ON ALL SIX PANELS. It used to size itself by the length of
        // the headline — a sentence at title size, three words at display size
        // — which set panels 2, 3 and 5 a size larger than 1, 4 and 6 and had
        // the review reading six cards as though six people had typeset them.
        // Title size is the one that holds the longest of the six without
        // pushing the dots off a 640 dp screen, so it is the one they all take.
        // pre-line so a headline can choose its own break. Review 21/09 asked
        // for one on A5; everywhere else the string has no newline in it and
        // this changes nothing.
        style: { fontSize: 'var(--t-title)', margin: 0, lineHeight: 1.15, whiteSpace: 'pre-line' },
      }, t(`a4.${c.id}.h`, c.headline)),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '34ch' } }, t(`a4.${c.id}.b`, c.body)),
      // The second paragraph is a second paragraph, not a longer first one: the
      // reviewer's copy sets out the what and then the so-what, and running the
      // two together loses the beat between them.
      when(c.body2, () => h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '34ch' } },
        t(`a4.${c.id}.b2`, c.body2))),
      // The three benefits in ONE quiet box, centred. Three boxes read as three
      // separate claims; one box with three lines in it reads as what it is —
      // a single list of what the service does — and it is the thing the funnel
      // below narrows into one figure.
      when(c.stats, () => h('div.tourstat', { style: { width: '100%', maxWidth: '34ch' } },
        c.stats.map(([key, label]) => h('span', t(key, label))))),
      // What the three above add up to, and drawn as a conclusion: an arrow
      // down out of the list, then the figure on its own.
      when(c.total, () => h('div', {
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%', maxWidth: '34ch' },
      },
      /* Review 06/09 — "redraw as indicated, use triangle for greater emphasis",
         drawn on his own copy of the panel. A chevron is an arrow saying "keep
         going"; a solid triangle is a funnel, which is the actual argument —
         three measured savings narrowing into the one figure a farmer cares
         about. */
      h('span.funnel'),
      h('div.tourstat.tourstat--total',
        h('span', { style: { whiteSpace: 'pre-line' } }, t(c.total[0], c.total[1])),
        h('span.tourstat__value', c.total[2])))),
      /* Review 06/09 — "add small space (equivalent to what you have between
         paragraphs)". The dots were sitting straight under the last line of the
         copy, close enough to read as punctuation on it rather than as the
         control they are. */
      h('div', { style: { flex: '0 0 auto', height: 'var(--sp-3)' } }),
      h('div.dots', TOUR.map((_, k) => h('span', k === i ? { 'data-on': '' } : {})))),
    dock: actionDock(btn(
      last
        ? (from === 'help' ? t('action.done', 'Done') : t('a4.start', 'Get started'))
        : t('action.next', 'Next'),
      {
        variant: 'primary',
        onclick: () => { if (last) leave(); else { d.tourCard = i + 1; commit('a4'); } },
      })),
  };
}

/* -- A8 · Sign up, WF4.032 … WF4.037, WF4.041 … WF4.042 -------------------
   The MOBILE NUMBER is the one thing that has to be right, so it is the one
   thing that gets validated: a code goes to it and nothing continues until the
   code comes back. The email address is collected and never verified.

   That asymmetry is the whole design of this screen, and it replaced a
   symmetrical one where the farmer could start with either and the code went to
   whichever they had typed. Either-way-round is the right answer for LOGGING IN
   — A20 still takes either — but it is the wrong answer for registration: an
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
   sits on A10 beside the first area he is about to draw. */

const EMAILISH = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function A8() {
  const d = draft();
  const countries = state.db.countries;
  const priority = countries.filter((c) => c.priority);   // WF4.035 — GCC + Jordan on top
  const rest = countries.filter((c) => !c.priority);

  const phoneOk = d.phone.replace(/\D/g, '').length >= 6;
  const emailOk = EMAILISH.test(d.email.trim());
  const named = d.firstName.trim().length > 0 && d.lastName.trim().length > 0;

  return {
    tabs: false,
    top: appBar({ title: t('a5.title', 'Create your account'), onBack: () => go('A1', { replace: true }) }),
    body: page(
      /* WF4.041 — THE NAME IS MANDATORY AND IT IS TWO FIELDS.

         Review 06/09 — "split into 'First name' and 'Last Name'", on this screen
         and again on F2. One box holding a whole name is fine until something
         has to greet somebody by half of it, which is exactly what A20's
         "Welcome back, Khaled" now does; a first name pulled out of a free-text
         field by splitting on the first space is a guess, and it is the wrong
         guess for a good part of the world.

         STACKED, since review 21/09. They were side by side, on the argument
         that they are one question asked twice — which is true, and it cost
         half a phone's width to each half of a name: "Arabic names can be quite
         long. Is it best to stacked the two entries?" They are. The room the
         password field gave up below is what pays for the extra row. */
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' } },
        field(t('a5.firstname', 'First name'), input({
          value: d.firstName, autocomplete: 'given-name', name: 'firstname',
          oninput: (e) => { d.firstName = e.target.value; },
          onchange: () => commit('a5'),
        }), { required: true }),
        field(t('a5.lastname', 'Last name'), input({
          value: d.lastName, autocomplete: 'family-name', name: 'lastname',
          oninput: (e) => { d.lastName = e.target.value; },
          onchange: () => commit('a5'),
        }), { required: true })),

      /* Review 06/09 — "Add 'Company name' (optional - no red asterisk)". The
         farms this app is sold into are increasingly held by a company rather
         than by the man walking them, and a report addressed to a person when
         it should be addressed to a business is a small, repeated wrongness. It
         carries no asterisk, which the reviewer said in the note and which is
         the whole point of the field: a farmer with no company is not being
         asked a question he cannot answer. */
      field(t('a5.company', 'Company name'), input({
        value: d.company, autocomplete: 'organization', name: 'company',
        oninput: (e) => { d.company = e.target.value; },
        onchange: () => commit('a5'),
      })),

      /* THE ADDRESS IS THE ACCOUNT. THE NUMBER IS WHAT THE CODE GOES TO.

         Two rounds settled two different questions here and it is worth keeping
         them apart. Review 06/09 made the ADDRESS the account: it is what a
         farmer signs up with and comes back to, because an app sold from
         Georgia to Bengal cannot assume the number a man holds this season is
         the one he holds next. The Monday review settled the CHANNEL: the code
         goes to the number.

         Which is right, and it is the older behaviour restored for the older
         reason. A one-time code has to arrive in seconds on a phone standing in
         a field with one bar of signal, and an SMS does that where an inbox
         does not — the phone shows the code on the lock screen and offers to
         type it in. Nothing about the account changed; only where four digits
         land.

         So the number is asked FIRST, because it is the field the next screen
         depends on, and a form that asks for the thing it is about to use last
         reads as though it were an afterthought. */
      mobileField(d, priority, rest),
      emailField(d),

      /* THERE IS NO PASSWORD. Review 21/09: "I've seen a shift industry-wide,
         over the last six months, away from passwords toward SMS/email one-time
         codes… I think it's safe to move Wafra to that model." The field, its
         rule line and its show/hide eye are gone, and with them the only reason
         this screen ever scrolled — which is the second thing the removal buys.
         See the note on the two doors below. */

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

    /* THE TWO DOORS, WHICH CAME OFF A20 AND ARE IN THE DOCK SINCE REVIEW 21/09.

       Review 06/09 took "create an account" and "join a farm as a guest" off
       the login screen, on the argument that A20 is only ever shown to somebody
       the app has already met. That is right, and it left this screen — the one
       a stranger reaches — as where the counterparts belong: the way back for
       somebody who turns out to have an account already, and the way sideways
       for somebody who was invited to a farm rather than buying one.

       They were at the FOOT OF THE BODY until review 21/09, and that was the
       complaint: "My real worry with that screen was that it forced scrolling
       to reach two important links." Dropping the password and stacking the
       names was the fix proposed on the call, and it is not enough — measured,
       the form is 765 px against 601 px of phone, and it was 164 px over before
       these two 108 px links were counted at all. A form asking for five things
       does not fit a phone in any language, and it fits least in the ones with
       the longest words.

       So they are in the dock, which does not scroll. It is the only place that
       makes the answer true on every phone, at every text size, in all ten
       languages, rather than true on the one we measured.

       They sit BELOW the button, which is the rule every A screen now follows:
       the primary action is the first thing the thumb meets at the foot of the
       screen, and the ways of deciding not to take it come after. */
    dock: actionDock(
      btn(t('a5.send', 'Send code by SMS'), {
        variant: 'primary',
        disabled: !d.agreed || !phoneOk || !emailOk || !named,
        onclick: () => go('A9'),
      }),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        doorLink(t('a5.already', 'Already registered?'), t('action.login', 'Log in'), () => go('A20', { replace: true })),
        doorLink(t('a3.invited', 'Invited?'), t('a2.join', 'Join a farm as a guest'), () => go('A21')))),
  };
}

/* The two contact fields, lifted out of the body only to keep A8 readable. */
function mobileField(d, priority, rest) {
  return field(t('a5.mobile', 'Mobile number'),
    h('div.inputgroup',
      select([...priority.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` })),
        ...rest.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` }))],
      // Review 21/08 — at a fixed 112px the dial code ran under the chevron and
      // read "+96(". It sizes to its own widest option now, which is a bounded
      // thing to ask for: every option is a flag and at most four digits.
      //
      // Review 06/09 — "add country codes for all countries in the world". It
      // was fifty-three: the GCC, the Levant, and the countries the workforce
      // comes from. The list is every country now, with the seven the farms are
      // in still held at the top by `priority` (WF4.035) and the rest in
      // alphabetical order, because a list of two hundred that is not sorted is
      // a list nobody can use.
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
    // The hint is back, because what it describes is true again: the code goes
    // to this number, and a farmer who mistypes it here is a farmer who never
    // reaches the next screen. It was deleted at the 06/09 round, when the code
    // briefly went to the address instead.
    // Review 21/09 reworded it. "We send a code to this number to check it" is
    // the app talking about its own plumbing; the farmer is being told what is
    // about to happen to him, so it is said that way round.
    { required: true, hint: t('a5.mobile.hint', 'A verification code will be sent to this number.') });
}

function emailField(d) {
  return field(t('a5.email', 'Email address'), input({
    type: 'email', inputmode: 'email', autocomplete: 'email', value: d.email, name: 'email',
    placeholder: 'name@example.com',
    oninput: (e) => { d.email = e.target.value; },
    onchange: () => commit('a5'),
  }), {
    required: true,
    // Review 06/09 — "Delete. In settings, the farmer should be able to send
    // farm report to multiple email addresses, including this one by default."
    // The sentence was true and in the wrong place: it described a rule about
    // reports on the screen where an account is created, and it quietly said
    // there was one address when the farmer wanted several. F3 carries the list
    // now; this field just collects the first one.
  });
}

/* -- A9 · Verify code, WF4.034 / WF4.038 … WF4.040 -------------------------
   ONE SENTENCE, not a heading and a sentence saying the same thing twice. The
   screen exists to say where the code went, and that is now the only line on it.

   FOUR DIGITS, not six. WF4.038 asked for six and was updated to four at the
   18 August review, which asked for four unless there was a security reason for
   six: the code expires in ten minutes and the account locks after five wrong
   tries, so the two extra digits were buying a longer thing to hold in your head
   rather than any real protection. One constant if it ever goes back.

   The screen is reached from three places and each wants somewhere different
   afterwards, so the route carries which: registration goes on to the farm,
   logging in goes into the app, and a reset goes back to choose a password.

   AND THE CODE GOES TO THE MOBILE NUMBER, which is WF4.034 as written. It went
   to the email address for one round, on the argument that the address is the
   account — and the Monday review put it back, on the better argument that a
   code is not an identity, it is a message that has to arrive in seconds on a
   phone in a field. An SMS does that; an inbox does not, and the note on this
   screen has always assumed the phone fills the code in by itself, which is
   something a phone does for an SMS and not for mail. The account is still the
   address (A8); only the four digits go by SMS.

   THE CONTENT SITS AT THE TOP. It used to be centred vertically — four boxes in
   the middle of the phone with the sentences hanging off them — which reads as
   a screen with nothing on it. A code entry is the first thing on the screen
   because it is the only thing to do on it. */

const OTP_LENGTH = 4;

/* -- the code boxes, and why they are INPUTS ------------------------------

   Review 06/09, twice — once on this screen and once on A21: "why do we need
   this? Keyboard should appear once the user presses the first entry box,
   right?" He is right, and the drawn keypad underneath was a mockup artefact
   that had outlived its excuse. It was there because four `<div>`s cannot be
   typed into, so something had to be tappable; the answer is to stop drawing
   `<div>`s. Each box is a one-character numeric input now, so the phone raises
   its own keyboard on the first tap and the farmer gets his own layout, his own
   numerals and his own autofill — which is the other half of the note on A9,
   where he assumes the code arrives and fills itself in.

   The boxes advance and retreat on their own: typing a digit moves to the next,
   backspacing an empty box moves to the previous. Focus survives the re-render
   because every box carries a `name`, which is what the shell restores by. */
function codeCells(value, length, { onValue, disabled = false, focusIndex = null }) {
  const chars = value.padEnd(length, ' ').split('');
  const set = (i, ch) => {
    const next = value.padEnd(length, ' ').split('');
    next[i] = ch || ' ';
    onValue(next.join('').replace(/ +$/, ''));
  };
  const move = (i, by) => {
    const el = document.querySelector(`#app [data-field="code${i + by}"]`);
    el?.focus();
    el?.setSelectionRange?.(0, 1);
  };
  return h('div.otp', chars.map((c, i) => input({
    class: `otp__cell${c.trim() ? ' otp__cell--filled' : ''}`,
    type: 'text', inputmode: 'numeric', maxlength: 1, disabled,
    // WF4.038's auto-fill: the platform recognises the attribute and offers the
    // code straight from the notification.
    autocomplete: 'one-time-code',
    name: `code${i}`,
    'aria-label': t('a6.digit', 'Digit {n} of {total}', { n: num(i + 1), total: num(length) }),
    value: c.trim(),
    autofocus: focusIndex === i ? true : null,
    oninput: (e) => {
      const digit = e.target.value.replace(/\D/g, '').slice(-1);
      e.target.value = digit;
      set(i, digit);
      if (digit && i + 1 < length) move(i, 1);
    },
    onkeydown: (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) move(i, -1);
    },
  })));
}

export function A9(mode = 'signup') {
  const d = draft();
  const locked = d.attempts >= 5;                              // WF4.040
  const wrongCode = '0'.repeat(OTP_LENGTH);

  const done = () => {
    /* 'reset' is F2 proving a CHANGED NUMBER, and it is the one caller left
       now that FORGOT has gone. It used to hand on to FORGOT:password, which
       was always a little wrong — a farmer editing his profile was being made
       to choose a password — and with no password to choose it is simply the
       end of the job. Back to the profile, with the number now proved. */
    if (mode === 'reset') {
      back();
      toast(t('a6.numberproved', 'Your new number is confirmed'));
      return;
    }
    if (mode === 'login') { enterApp('owner'); return; }
    go('A10');                                                  // WF4.045 — this route makes an Owner
    // Review 22/08 — "we should ask him if he wants face ID when he first
    // creates an account". This is that moment and the only one: the number is
    // proved, the account exists, and there is now something to unlock. A20 used
    // to carry the same fact as a sentence nobody could act on.
    if (!state.session.biometricAsked) openModal('BIOMETRIC');
  };

  const setCode = (next) => {
    if (locked) return;
    d.code = next;
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

  // Where the code went, which on a reset is the account's own number and on
  // registration is the one just typed into A8.
  const dial = state.db.countries.find((c) => c.code === d.country)?.dial ?? '';
  const sentTo = (mode === 'signup' ? [dial, d.phone].filter(Boolean).join(' ') : me().phone) || '+966 5X XXX XXXX';
  return {
    tabs: false,
    // Review 22/08 — "code", not "OTP", here and everywhere else.
    top: appBar({ title: t('a6.title', 'Enter the code sent to {to}', { to: sentTo }), wrap: true }),
    /* Centred across, aligned to the top. The boxes were floated to the middle
       of the phone at the 06/09 round; the Monday review asked for the content
       to come up, and it is right — a screen whose one control sits halfway down
       an empty page reads as a screen still loading, and the reader's eye starts
       at the top whatever the layout does. */
    // page--fill so the help block below can be pushed to the foot, the way it
    // is on A20.
    body: page({ class: 'page--fill', style: { alignItems: 'center', textAlign: 'center' } },
      codeCells(d.code, OTP_LENGTH, { onValue: setCode, disabled: locked }),
      when(locked, () => h('div',
        disclaimer(t('a6.locked', 'Too many attempts. Your account is locked for 15 minutes. You can contact Wafra for help.'), true),
        h('div', { style: { height: '10px' } }),
        btn(t('f13.title', 'Contact Wafra'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center' } },
        t('a6.valid', 'The code is valid for 10 minutes.'), req('WF4.038')),
      /* The line about the keyboard has gone. Review 21/09: "Delete. This is an
         automatic phone feature." It was written for a reviewer holding a
         printed page, to explain the air where a keypad would be — which is a
         note about our deck, not a sentence a farmer needs. */
      h('div', { style: { textAlign: 'center' } },
        // WF4.039 — resend after 45 seconds.
        h('button.textlink', { onclick: () => toast(t('a6.resent', 'New code sent')) },
          t('a6.resend', 'Resend code (available in 45s)'))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', textAlign: 'center', margin: 0 } },
        t('a6.mockhint', 'Mockup: any four digits continue. 0000 simulates a wrong code.')),

      /* THE WAY TO A PERSON, ON THE SCREEN WHERE THE CODE EITHER ARRIVES OR
         DOES NOT. Review 21/09, and Mark pasted A20's block onto this page to
         say where: "if someone has a problem with their code (didn't get it,
         lost their phone number), they can reach us." With the password gone
         this screen is the single point of failure for getting into the app,
         and it was the one screen in the run with no way off it. */
      h('div', { style: { flex: '1 1 auto', minHeight: 'var(--sp-4)' } }),
      h('span', { style: { display: 'block', height: '1px', background: 'var(--ink-200)', width: '100%' } }),
      helpBlock({ prominent: false })),
  };
}

/* -- the land unit, WF4.043 ------------------------------------------------
   Two units, not three. Acres are not how land is counted anywhere the app
   launches, and the third chip was an invitation to pick the wrong one.

   The question used to be the tail of A7 — "tell us about you" — which is where
   it went wrong: a unit is not a fact about the farmer, it is how he reads an
   area. It now stands on A10, one screen before the first area the app prints,
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

/* `floating: false` is A13 since review 21/09: the bar is a row in a panel
   above the map rather than a pill lying on top of it. Everything else keeps
   the floating form, where the bar has to share the screen with the map it
   searches. */
/* `confirm` is whether a search says out loud that it moved the map.

   It is FALSE on A13 since review 21/09's fourth pass — "remove the black
   confirmation badge that says 'centred on xxx'" — because that screen now
   carries a pin and a line under the map saying the farm is around it. A toast
   is what a screen uses when it has no room to show the result; A13 shows the
   result, and the badge landed on top of it. B9 has neither, so it keeps the
   toast: there the sentence is the only thing that tells a farmer his typing
   did anything. */
function placeSearch(d, placeholder = t('a9d.search', 'Find your farm'), { floating = true, confirm = true } = {}) {
  const centre = (place) => {
    const name = place.trim();
    if (name && confirm) toast(t('map.centred', 'Centred on {place}', { place: name }));
  };
  return h('div', {
    style: {
      ...(floating
        ? { position: 'absolute', insetInline: '10px', top: '10px', zIndex: 3, width: 'calc(100% - 20px)', boxShadow: '0 2px 10px rgba(9, 22, 17, .18)' }
        : { border: '1px solid var(--ink-200)' }),
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--paper)', borderRadius: '999px',
      padding: '0 14px', height: '44px',
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

/* -- A10 · Add your first farm, WF4.051 … WF4.057 --------------------------
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
 * There used to be two: A10 during registration, and B12 for a farmer who
 * already had farms — the same two route cards, written out twice, under a
 * second name field. The review's verdict was that B12 is an A screen, so the
 * second copy has gone: everything that adds a farm now opens A10, which names
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
  go('A10');
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
  go('B9');
}

/** Does this farm grow field crops, trees, or both — read off the two numbers
    on A10 rather than asked as its own question. Null means neither field has
    a number in it yet. */
function farmTypeFrom(d) {
  const hasArea = Number(d.roughArea) > 0;
  const hasTrees = Number(d.roughTrees) > 0;
  if (hasArea && hasTrees) return 'mixed';
  if (hasTrees) return 'trees';
  if (hasArea) return 'crops';
  return null;
}

/* ONE CROP KIND, AS A CARD WITH ITS OWN NUMBER IN IT.

   The glyph is the point: at a glance, before any label is read, the screen
   says the app wants to know about fields and about trees. The tick is the
   other half — a card with a number in it has been answered, and one without
   has not, which is the only state this screen now has to show.

   NOT A BUTTON, unlike the picker cards it replaces and unlike A17's plan
   cards. There is an input inside it; making the whole card tappable would put
   a target around a target, and the thing to press is the field. */
function quantityCard({ glyph, title, sub, filled, label, suffix, control }) {
  return card({ accent: filled ? 'good' : undefined }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
      h('span', {
        style: {
          width: '44px', height: '44px', borderRadius: '50%', flex: '0 0 auto',
          display: 'grid', placeItems: 'center',
          background: filled ? 'var(--st-good-bg)' : 'var(--brand-100)',
          color: filled ? 'var(--st-good)' : 'var(--brand-700)',
        },
      }, icon(glyph, 24)),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { fontWeight: 650 } }, title),
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, sub)),
      when(filled, () => h('span', { style: { color: 'var(--st-good)', display: 'flex' } }, icon('check', 22)))),
    field(label, h('div.inputgroup.inputgroup--suffix',
      control,
      h('span.input', { style: { width: '76px', display: 'grid', placeItems: 'center' } }, suffix)))));
}

export function A10() {
  const d = draft();
  // Same detection unitField() itself uses — read here too because the area
  // input's suffix has to agree with the unit chip below it from the first
  // paint, not just after that field has rendered once.
  const unit = d.areaUnit ?? (DUNUM_COUNTRIES.includes(d.country) ? 'dunum' : 'hectare');

  return {
    tabs: false,
    /* Review 21/09 changed the heading twice over. The deck framed it and
       wrote "Tell us about your farm" — which is what the screen does, rather
       than what pressing the button will eventually cause — and on the call
       Mark took the other word out too: "drop 'first,' it's confusing this
       early; there's already a later option to add a second farm, so
       introducing the 'first farm' concept now just adds noise." The word
       "first" is gone from the screen and from its name in the registry. */
    top: appBar({ title: t('a9.title', 'Tell us about your farm') }),
    body: page(
      // Review 21/08 — the name is the first thing asked, because everything
      // under it is a decision about one particular farm and a farmer with two
      // of them decides differently for each.
      farmNameField(d),

      // WF4.043 — asked here, one screen before the app first prints an area.
      unitField(d),

      /* WHAT IS GROWING, READ OFF TWO NUMBERS RATHER THAN A PICKER — AND
         DRAWN LIKE THE PICKER IT REPLACED.

         The question used to be three cards with a glyph each (Field crops /
         Date palms and fruit trees / Both), answered before either number was
         known; the 13/09 review's second pass replaced it with two number
         fields, because filling in one, the other, or both IS the answer and
         nothing needs picking. What that lost was the picture: two labelled
         boxes on a grey page, where there had been something a farmer could
         recognise before reading a word of it.

         So the numbers keep the cards. Each one is the crop kind it stands
         for — its glyph, its name, and how it is priced — with the field
         inside it, and it lights up as soon as there is a number in it. That
         last part is doing real work now that no card is ever "chosen": the
         highlight is the only thing on the screen that says which of the two
         the farmer has actually answered, which is what the price on the next
         screen is about to be built from. */
      quantityCard({
        glyph: 'sprout',
        title: t('farmtype.crops', 'Field crops'),
        sub: t('a12.crops.sub2', 'Priced per area.'),
        filled: Number(d.roughArea) > 0,
        // Review 21/09 — "Approximate cultivated area (we don't want the user
        // to give us the entire farm area)". On the call: "good instinct,
        // 'approximate area' alone loses precision." The number is what the
        // subscription is priced from, and a farmer who reads "area" gives the
        // title-deed figure including the tracks, the yard and the house.
        label: t('a9.area', 'Approximate cultivated area'),
        // The SHORT unit, which is the one every area the app prints carries
        // (see area() in format.js) — and the one that fits the box. Spelled
        // out it was clipped at "Hectare", and it repeated the chip above
        // without adding anything.
        suffix: t(unit === 'dunum' ? 'unit.dunum' : 'unit.ha', unit === 'dunum' ? 'dunum' : 'ha'),
        control: input({
          type: 'number', inputmode: 'decimal', min: '0', value: d.roughArea,
          placeholder: '0', name: 'rougharea',
          oninput: (e) => { d.roughArea = e.target.value; },
          onchange: () => commit('a9'),
        }),
      }),

      quantityCard({
        glyph: 'tree',
        title: t('farmtype.trees', 'Date palms and fruit trees'),
        sub: t('a12.trees.sub2', 'Priced per tree.'),
        filled: Number(d.roughTrees) > 0,
        label: t('a9.trees', 'Approximate number of trees'),
        suffix: t('unit.trees', 'Trees'),
        control: input({
          type: 'number', inputmode: 'numeric', min: '0', step: '1', value: d.roughTrees,
          placeholder: '0', name: 'roughtrees',
          oninput: (e) => { d.roughTrees = e.target.value; },
          onchange: () => commit('a9'),
        }),
      }),

      // One line, under both cards, because it is true of both: neither number
      // has to be right. Filling in only one is a complete answer too — that
      // is what having no "Both" card means — so nothing here asks for the
      // other.
      h('p', { style: { margin: 0 } }, req('WF4.051'))),

    /* NOT DISABLED. A dimmed button does not say which field is missing; this
       one lands on whichever answer is short and says why.

       THE HINT BECAME A BUTTON. Review 21/09: "Replace with a discrete button
       that says: 'I'm not sure'. In this case, clicking on 'Continue' takes
       him to A13 for the automated farm survey."

       Which is a better answer than the sentence was. "A rough number is fine"
       tells a farmer who has no number that he still has to type one; the
       button gives him the thing he actually wants, which is to skip the
       question. On the call Mark checked where it lands — "does that still
       route to the full farm survey (A13)?" — and it does: straight to locating
       the farm, skipping the estimate, because there is nothing to estimate
       from.

       It is in the dock, UNDER Continue, and not at the foot of the two cards
       where it started. A skip that sits inside the question it skips is read
       as part of the question; in the dock it is read as the other way out of
       the screen, which is what it is. Quiet, as asked — a discrete button, not
       a second primary competing with Continue. */
    dock: actionDock(
      btn(t('action.continue', 'Continue'), {
        variant: 'primary',
        onclick: () => {
          if (!farmIsNamed(d)) { focusFarmName(); return; }
          const farmType = farmTypeFrom(d);
          if (!farmType) { toast(t('a9.typeneeded', 'Tell us roughly how much you grow'), 'warn'); return; }
          d.farmType = farmType;
          state.session.coverage = farmType;
          go('A11');
        },
      }),
      btn(t('a9.notsure', 'I’m not sure'), {
        variant: 'quiet',
        deckTo: 'A13',
        deckNote: 'Skips the estimate and goes straight to locating the farm',
        onclick: () => {
          if (!farmIsNamed(d)) { focusFarmName(); return; }
          d.farmType = farmTypeFrom(d) ?? 'crops';
          state.session.coverage = d.farmType;
          d.route = 'survey';
          commit('a9');
          go('A13');
        },
      })),
  };
}

/* -- A11 · Your price estimate ---------------------------------------------

   THE 13/09 REVIEW'S SCREENING STEP. "Someone who downloads it just to test
   it out commits us to a full survey before they even get a price" — Mark's
   words for the problem. A10 takes two rough numbers; this screen prices them
   and asks once, plainly, whether to go on to the real thing.

   CALLED A11, NOT A9D. A9D is a letter this app has used before — the drawing
   canvas, renamed B9 at v1.5.8 — and its `t('a9d.…')` keys were never
   renamed with it, so the letter is not actually free.

   ONE BUTTON. The follow-up review cut the second one — "no Not Right Now" —
   on the reasoning that an app bar already has a back arrow, and a screen
   asking for a decision should ask for one decision, not offer leaving as an
   equally-weighted second choice next to it.

   WHY THE NUMBER IS A RANGE, NOT ONE FIGURE. The app already prices a
   confirmed survey as two levels, Basic and Pro. Quoting one figure here that
   neither plan actually charges would be a number the farmer could hold the
   final quote against; a range bounded by the same two rates A17 uses is the
   same honest arithmetic, run early and admitted to be rough.

   THE GUESS NEVER BECOMES A RECORD. `roughArea` and `roughTrees` live on the
   signup draft only — they are never written to a plot, a farm, or anything
   the real survey overwrites later. */

/** A11's "Confirm and continue": on to the boundary that runs the real
    survey. Removing A9B from the flow (still in the code, just not on this
    path — see the registry note) means every farm takes the same next step
    now, whatever is growing on it. */
function continueToSurvey() {
  const d = draft();
  d.route = 'survey';
  go('A13');
}

/**
 * The two numbers A10 asked for, in the units the rates are quoted in.
 *
 * ONE SOURCE FOR TWO SCREENS. A11 quotes a range from these and A17 charges
 * from them a screen later; a price that moves between the two, with nothing
 * measured in between to explain the move, is the one thing this pair must
 * not do. So neither screen does the arithmetic itself.
 *
 * AN EMPTY DRAFT IS NOT A FARMER, it is the deck or the harness opening the
 * screen cold. A10's Continue does not let anyone past with both fields blank,
 * so the fallback is not a farm state to handle — it is what the printed page
 * has to show instead of a row of zeros, and it is the same smallholding the
 * rest of the deck photographs: fields, and a block of palms.
 */
function roughTotals(d) {
  const unit = d.areaUnit ?? (DUNUM_COUNTRIES.includes(d.country) ? 'dunum' : 'hectare');
  const cropHa = Math.round(toHectares(Number(d.roughArea) || 0, unit) * 10) / 10;
  const treeCount = Math.round(Number(d.roughTrees) || 0);
  if (cropHa > 0 || treeCount > 0) return { cropHa, treeCount };
  return { cropHa: d.areaHa ?? 12.4, treeCount: 220 };
}

/* -- A11 · Available service plans ----------------------------------------

   REBUILT AT REVIEW 21/09, OUT OF A17'S OWN LAYOUT.

   Mark struck the old A11 through corner to corner — "Old A11 Slide" — and
   built its replacement by duplicating the A17 page and retitling it in green.
   What went: a single hero figure, "SAR 716 – 1,074 / month", and three
   explainRows about what happens next. What arrived: the two real plans, at
   their two real prices, presented as an estimate.

   It is a better screen for the same reason the range was a worse one. A band
   between two numbers is not a price anybody can act on — it is the Basic
   price and the Pro price with the question of which one removed — so the
   farmer was shown the arithmetic of a choice and not the choice. Now he sees
   what A17 will later ask him to pick between, at the cost it will be, with
   nothing to pick yet.

   WHAT THIS SCREEN DOES NOT DO. There are no radio buttons on the cards:
   "Remove buttons. Not needed at this point." Nothing is chosen here and
   nothing is confirmed; the cards are a price list. That is also why the
   heading is "Available service plans" rather than "Your plan" — the plan is
   not his yet.

   It is the screen the call calls A13a, the first-time user's version of the
   plan screen, with A17 the later one he returns to once the survey has priced
   his real farm. The two are told apart by their titles rather than by a
   letter — see app/meta.js. */

export function A11() {
  const d = draft();
  const totals = roughTotals(d);
  const { cropHa, treeCount } = totals;
  const family = cropHa > 0 && treeCount > 0 ? 'combined' : treeCount > 0 ? 'tree' : 'crop';

  return {
    tabs: false,
    // "Change to: 'Available service plans'."
    top: appBar({ title: t('a9e.title', 'Available service plans'), onBack: () => go('A10') }),
    body: page(
      /* WHAT IS BEING PRICED AND HOW SURE WE ARE — the reviewer's sentence,
         and the second half of it is the part that matters: it names the
         survey as the thing that settles the number, so the figure below is
         read as a bracket rather than as a quote. */
      h('p', { style: { margin: 0, color: 'var(--ink-700)' } },
        t('a9e.basis', 'Estimated cost based on {what}. We will give you a final quote once we complete the automated farm survey.',
          { what: quantityLine(totals) })),

      /* ONE CARD, the same shape A17 uses — see the note there. The two screens
         show the same two plans a few steps apart, and drawing them differently
         would make a farmer wonder what changed between them. What differs is
         the one thing that should: there is no radio here and no billing
         switch, because nothing is chosen on this screen. */
      card({}, h('div.planbox',
        LEVELS.map((level) => planChoice(level, {
          usd: planPrice(family, level.tier, totals),
          country: d.country,
          // No selection state at all. Not "nothing selected" — no control to
          // select with.
          pickable: false,
        })),
        h('button.row.planbox__row', {
          onclick: () => go('F6'),
          deckTo: 'F6',
        },
        h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('list', 21)),
        h('div.row__main', h('div.row__title', t('a13.compare', 'Compare plans'))),
        h('span.row__chev', icon('forward', 20, 'flip'))))),

      /* THE FOUR STEPS, WHICH ARE THE REVIEWER'S OWN WORDS AND HIS OWN ORDER.
         They replaced the trial card and the "when you confirm we send your
         boundary" line, and the order is the thing to read twice: the farmer
         tells us where the farm is, we survey it, we quote, and only THEN does
         he pick a plan. Choosing last is not a detail of this screen — it is
         the shape of the whole run, and this list is where the app says so.

         He pasted a checkmark beside three of the four and wrote "Checkmark
         icon" next to them, so each step carries one. */
      /* WHAT HAPPENS NEXT, IN THE SHAPE v1.7.0 DREW IT.

         The 21/09 deck replaced three steps with four and Mark pasted a
         checkmark beside them, so the first pass rendered four ticked lines and
         dropped the explainRow layout the screen had. The second pass put it
         back: "make sure we keep the same icons and layout for the 'what
         happens next' section."

         Which is the right call, and the reason is that a tick means something
         the icons do not. A checkmark beside a step that has not happened yet
         reads as done; the pencil, the scan and the list say what each step IS.
         The words are Mark's four and the order is his — the fourth is the
         whole argument, that a plan is chosen last.

         A HEADING AGAIN, AND ONLY THE STEPS — review 21/09, third pass:
         "instead of a long paragraph saying 'Once you have reviewed the plan
         features (…)' just place a 'What happens next' above all the steps. We
         also don't need the description for each step. Just the step, no
         description."

         Both halves of that are the same point. The paragraph said in twenty
         words what three words label, and each sub-line restated its own step
         in a second voice — so the section ran to nine blocks of prose under a
         price the farmer is trying to decide about. Three words and four step
         names is the whole content; the detail belongs on the screens that do
         the steps, where a farmer is actually doing them. The earlier note
         against section() still stands and is not this: a section head shouts a
         sentence, but "What happens next" is a LABEL, which is what small caps
         are for. */
      section(t('a9e.next.head3', 'What happens next'), {},
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '2px' } },
          explainRow('locate', t('a9e.next1', 'You tell us the location of your farm')),
          explainRow('scan', t('a9e.next2', 'Our platform automatically surveys your farm')),
          explainRow('list', t('a9e.next3', 'We send you a final quote')),
          explainRow('check', t('a9e.next4', 'You select the service plan you want'))))),

    /* AND THE WAY OUT, WHICH IS THE POINT OF ASKING. "Let's still capture
       'not interested / why' as an option if the user backs out at the price
       stage — we want some signal if conversion isn't happening." A farmer who
       leaves here leaves silently otherwise, and this is the one screen in the
       run where we learn whether the price is the reason. Quiet, under the
       primary action, because it is the minority answer. */
    dock: actionDock(
      btn(t('a9e.continue', 'Confirm and continue'), {
        variant: 'primary',
        onclick: continueToSurvey,
      }),
      btn(t('a9e.notinterested', 'I’m not interested'), {
        variant: 'quiet',
        deckTo: 'A12',
        onclick: () => go('A12'),
      })),
  };
}

/* -- A12 · Not interested -------------------------------------------------

   NEW AT REVIEW 21/09, and the only screen in the app whose job is to learn
   something from somebody who is leaving.

   "If user clicks on 'I'm not interested', bring him to a page that gives him
   the following options: Not what I'm looking for / Too complicated / Too
   expensive / Other reason: — Our contact info (WhatsApp and email) should be
   at bottom."

   The four reasons are his, in his order, and the order is not alphabetical or
   arbitrary: it runs from "this is not the product" through "this is not the
   product I can use" to "this is not the price", which are three different
   pieces of news for the business. Nothing here is required — a farmer who
   picks nothing and closes the app has still told us he got this far.

   AND THE CONTACT BLOCK IS NOT A CONSOLATION PRIZE. It is at the bottom
   because a farmer who is out because the app is "too complicated" is exactly
   the one a person could still help, and he has no other way to reach one: he
   has no account, so there is no More tab and no F17 behind it. */

const LEAVE_REASONS = [
  ['a9f.reason1', 'Not what I’m looking for'],
  ['a9f.reason2', 'Too complicated'],
  ['a9f.reason3', 'Too expensive'],
];

export function A12() {
  const d = local('leave', { reason: null, other: '' });
  const sent = () => {
    resetLocal('leave');
    toast(t('a9f.thanks', 'Thank you — that helps us'));
    go('A11', { replace: true });
  };

  return {
    tabs: false,
    top: appBar({ title: t('a9f.title', 'Before you go'), onBack: () => go('A11', { replace: true }) }),
    body: page({ class: 'page--fill' },
      /* THE OPENING LINE, IN THE REGISTER EVERY OTHER APP USES FOR THIS —
         review 21/09, third pass: "can you use generic phrasing, like we would
         see in any other app or service? 'It is the only way we find out what
         is wrong' sounds like a 4th grader is writing this app."

         Fair, and the fault is not the vocabulary. That sentence made the app
         the subject of its own exit screen — it pleaded, and it told a farmer
         who is leaving that something is WRONG, which is a conclusion he has
         not drawn and may not share; he may simply not want the product. What a
         cancellation screen says instead is what it wants and what it is for:
         one optional answer, used to improve the service. */
      h('p', { style: { margin: 0, color: 'var(--ink-700)' } },
        t('a9f.body2', 'Your feedback helps us improve the service. Please tell us what made you decide not to continue.')),

      /* FOUR ROWS IN ONE LIST, AND THE FOURTH OPENS A DRAWER.

         "Other reason" was a text field sitting under the list, which made it
         look like a second question — three things to pick from, and then a box
         to fill in as well. It is a fourth answer to the same question. Review
         21/09 (second pass): "other reason should be as a fourth option in the
         same list as the other 3, with a chevron that opens up a drawer popup."

         The chevron is what makes the difference honest: the first three answer
         themselves in a tap, this one has something to say, and a row that
         opens rather than toggles should look like one. Once it has been
         answered the row shows what was typed, so the list still reads as four
         answers of which one is chosen. */
      card({},
        LEAVE_REASONS.map(([key, label]) => row({
          title: t(key, label),
          chevron: false,
          value: d.reason === key ? icon('check', 20) : null,
          onclick: () => { d.reason = d.reason === key ? null : key; commit('leave'); },
        })),
        row({
          title: t('a9f.other', 'Other reason'),
          sub: d.other.trim() || null,
          chevron: true,
          deckNote: 'Opens a drawer to type the reason',
          value: d.reason === 'other' ? icon('check', 20) : null,
          onclick: () => openSheet('LEAVE_REASON'),
        })),

      h('div', { style: { flex: '1 1 auto', minHeight: 'var(--sp-4)' } }),
      h('span', { style: { display: 'block', height: '1px', background: 'var(--ink-200)' } }),
      helpBlock({ prominent: false })),

    dock: actionDock(btn(t('a9f.send', 'Send'), {
      variant: 'primary',
      disabled: !d.reason,
      onclick: sent,
    })),
  };
}

/* -- A9B · Choose survey or draw, WF4.052 / WF5.049 … WF5.052 -------------

   THIS SCREEN IS FOR FIELD CROPS ONLY, AND IT ALWAYS OFFERS BOTH ROUTES.

   Two rules, and they are the same rule read from both ends. Trees have to be
   found from the imagery: they stand in irregular groups all over a holding,
   they are counted one by one, and the count is what the price is worked out
   from. A farmer cannot draw that and should not be asked to try — so a farm
   with any trees on it never sees this screen at all. A10 sends it straight to
   A13, the farm-boundary canvas, with the reason on A10 itself.

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
   a second time, in its own draft, because it ran the fork without A10 in front
   of it. The name, the units and the crop type are A10's — asked once, for
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

/* farmTypeField() USED TO LIVE HERE — the crops/trees/"Both" picker A10 asked
   before drawing anything. The 13/09 review's second pass removed it along
   with A9C: what is growing is read off the two numbers on A10 itself now
   (see farmTypeFrom()), so there is no picker left to hold a "Both" card, and
   nothing else called this function once A10 stopped. COVERAGE, below, is not
   dead with it — B9 still reads it for its own per-plot question. */

/* The fork itself. It has ONE caller now — A9B — where it used to have two, and
   the difference between them was the whole reason it was extracted: A10 was
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
    go(route === 'plots' ? 'B9' : 'A13');
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
      /* Review 06/09 — the line described the FARM rather than the choice, and
         the reviewer put it back on the farm: "Choose this option if you are a
         small farm with only 2-3 plots". "Fields" was also the wrong noun —
         everything else on these two screens counts plots. */
      [t('a9.draw.when2', 'Choose this option if you are a small farm with only 2-3 plots.')],
      () => choose('plots')),
  ];
}

/* One step of what happens next, on A11. It was written for A12 and outlived
   it: an icon, a claim, and the sentence that makes the claim checkable — a
   list of three promises with no detail under them is a brochure.

   NOT A ROW, AND NOT IN A CARD. It was `.row--static` inside a card(), which is
   the shape this app uses for things you fill in or tap: a white panel, hairline
   dividers, 48 dp bands. Nothing here is either. It is us telling the farmer
   what we are about to do with his land while he waits for a price, and a
   settings-list frame around that reads as three switches he has failed to
   find. So it is prose with a glyph beside it — no box, no rules, no bands. */
/* The sub line is OPTIONAL since review 21/09: A11's four steps are named and
   nothing more. With no sub the row is one line, so it centres on its icon
   rather than hanging off the top of it — a 22px icon top-aligned against a
   single line of text sits a couple of pixels proud, which four rows in a
   column turn into a visibly crooked edge.

   AND THE STEP IS NOT BOLD when it stands alone. Review 21/09, fourth pass:
   "there's a lot of bold text, not a lot of hierarchy in the typography. Please
   remove the bold effect on the next steps descriptions."

   The weight was there to separate a step from its own sub-line, and the third
   pass took the sub-lines away — so four bold sentences were left stacked under
   a heading, arguing with the prices above them about what the important thing
   on the screen is. A step that keeps its sub still keeps its weight, because
   there it is still doing that job. */
function explainRow(iconName, title, sub) {
  return h('div', { style: { display: 'flex', gap: '12px', alignItems: sub ? 'flex-start' : 'center' } },
    h('span', {
      style: { color: 'var(--brand-600)', display: 'flex', flex: '0 0 auto', marginTop: sub ? '2px' : 0 },
    }, icon(iconName, 22)),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { style: { fontWeight: sub ? 650 : 400, color: 'var(--ink-800)' } }, title),
      when(sub, () => h('div', { style: { color: 'var(--ink-600)' } }, sub))));
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

/* -- A10 · Draw my own plots, WF4.058 … WF4.069 ---------------------------
   The crop question has gone. It used to sit under the canvas — "What is
   growing here?", a nine-item picker answered once per plot — and the survey
   detects it, which makes the question both work and a chance to be wrong.
   What the farmer knows and the algorithm does not is what he CALLS the field,
   so that is what this screen asks instead, and even then only as a correction:
   every plot arrives already named after the farm and numbered.

   Saved plots are a list, not a counter. The old screen said "3 saved so far"
   and gave no way to see, rename or remove any of them, so a plot traced round
   the wrong field could only be fixed by starting the flow again. */

export function B9() {
  const d = draft();
  // Each new plot starts beside the last rather than on top of it. Every plot
  // used to begin from the same five corners, so a farmer who saved three
  // without moving them had three identical shapes — and A16 now draws them all
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
      // survey to read it off, and A16's Edit sheet was too late to find out
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
        // WF4.058 — satellite by default, and since review 22/09 that means a
        // photograph. The farm has no record yet, so the ground is named the
        // same way A13 names it: this is the same place, a screen later.
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite', imageryOf: 'farm-1', cover: true }),
        editor.node,
        placeSearch(d),
        locateChip()),
      h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--paper)' } },
        /* Review 06/09 — "Add: 'A plot should not have more than one crop..'",
           with the line drawn to the instruction at the top of the screen. It
           is the rule this whole route rests on: one plot is one crop is why
           the drawing screen can ask what is on the plot and skip the farm-wide
           coverage question altogether. A16 has said it since the last review;
           saying it here as well means the farmer meets it while he is drawing
           rather than after he has finished. In the open, not behind the ⓘ —
           a rule you can break is not guidance you can skip. */
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('a11.onecrop', 'A plot should not have more than one crop.')),
        // Review 22/08 — THE LIVE AREA READOUT HAS GONE, the same change A13
        // had at the last review and for the same reason: it is the running
        // total of a bill nobody has been quoted for, printed larger than
        // anything else on the panel. The sizes appear on A16, where the farmer
        // approves the list, and in the quote on A17. WF4.065 is answered there.
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
        // 13/09 review, second pass — "Continue to quote", its own words: this
        // button used to share A16's "Request quote", which read the same on
        // two different screens doing two different things a tap apart.
        btn(t('a10d.continuequote', 'Continue to quote'), {
          variant: 'primary', block: false,
          disabled: !drawable && !done,
          onclick: () => {
            if (drawable) keepPlot();
            d.areaHa = d.plots.reduce((s, p) => s + p.areaHa, 0);
            // Review 22/08 — STRAIGHT TO A16, not to A12. A12 asks what the
            // satellite should look for, and a farmer who has just drawn eight
            // outlines by hand has already answered it eight times. What he has
            // not done is check the list, which is what A16 is for — and the
            // review asked for both routes to end up on it.
            if (tooSmall || tooBig) {
              openModal('CONFIRM', {
                title: t('a9d.confirm.title', 'Is that the right size?'),
                body: tooSmall
                  ? t('a9d.confirm.small', 'This boundary is under 0.1 hectares. If that is correct, carry on.')
                  : t('a9d.confirm.big', 'This boundary is over 10,000 hectares. If that is correct, carry on.'),
                confirmLabel: t('action.continue', 'Continue'),
                onConfirm: () => go('A16'),
              });
            } else go('A16');
          },
        })),
  };
}

/* -- A13 · Survey my whole farm, WF4.070 … WF4.077 ------------------------
   One polygon around the growing land: open fields and tree areas, with the
   sheds and the yard left out. It used to ask for everything the farmer holds,
   buildings and all, on the grounds that the algorithm has to be told where to
   stop looking — but nothing built is reported back and nothing built is
   charged for, so the farmer was being asked to trace roofs for our benefit and
   then trust us about the bill. He now draws what he is buying.

   The farm has its name from A10, and this screen says it: the bar carries the
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
       explaining what to draw, and A17 is where a number about money belongs.
     * The button asks for the survey, because that is what it does. "Continue"
       named the navigation rather than the act — review 01/09, "change to
       'Request survey'" — and what follows it is the pop-up that says when the
       answer comes back.

   WHAT PRESSING IT DOES. The farm record is made here, the survey is run
   against it, and the farmer lands on A16 with the result. The 01/09 review is
   explicit about the destination — "after A13 he should go to A16" — and the
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
   survey, meet the result on A16. With one it is A16's "adjust the farm
   boundary" — the 01/09 review asked for a way to correct a line that took in
   too much land, and called it out as "an alternative way for him to remove
   plots", which is exactly what it is: the plots the survey found outside the
   corrected outline come off the quote. */
/* -- A13 · Locate your farm, and A14 · Draw your farm boundary -----------

   ONE SCREEN BECAME TWO AT REVIEW 21/09.

   A13 used to do the whole job: find the farm on a satellite map and draw a
   line round it, on one screen, with the instruction behind an ⓘ in the app
   bar. Mark tried it and could not tell what he was supposed to do —

     "It wasn't clear to me I was supposed to manipulate a polygon… I expected
      you to hand me a pre-drawn polygon to manipulate, not to draw one myself
      with my finger from scratch."

   — and then found the reason, which is better than the symptom: on one screen
   a tap has two meanings. Tapping the map to move it and tapping the map to
   drop a corner are the same gesture, and the screen never says which mode it
   is in because it is always in both.

     "Proposal: split it into two screens. Screen one is purely 'find your
      farm' (search Google Maps or use current location) — no drawing yet. Once
      you confirm 'I found my farm,' a second screen appears with separate
      instructions to draw the boundary with your finger. Two clean steps
      instead of one overloaded one."

   So A13 is now finding, and only finding: the map pans and zooms and nothing
   a farmer does to it draws anything. A14 is drawing, and by the time he
   arrives the map is already over his land, so panning is no longer a thing he
   needs — which is what makes every tap on it unambiguous.

   THE TWO WAYS OF FINDING ARE STACKED AND NUMBERED. They were at opposite ends
   of the screen: a search bar floating at the top of the map and a chip in the
   bottom corner. "These are two equivalent options that should be side by side.
   The user can pick one or the other… 'Option 1: Search on GoogleMaps' /
   'Option 2: Use my current location'" — and on the call, stacked rather than
   side by side, "since they're just two equivalent ways to do the same thing".
   Stacked also survives ten languages; two boxes sharing a phone's width do
   not.

   NO AUTO-DETECTION IN V1. Romain raised running MMC's boundary model on the
   device so the polygon could arrive pre-drawn, which is what Mark expected in
   the first place, and Mark closed it: "Let's not over-automate this for now —
   we're covering a lot of different countries and farm shapes; keep it simple."
   The UAE route — look the boundary up from ADAFSA's own farm records by
   national ID — is a good idea and explicitly not this release: ADAFSA is not
   sharing national IDs in phase one. */

export function A13(farmId) {
  const d = draft();
  // Editing an existing farm's outline skips the finding step entirely: the
  // farm has a boundary already, so the map opens on it and there is nothing
  // to look for. A13 is a first-run screen; a correction goes straight to the
  // canvas.
  if (farmId) return A14(farmId);

  const farmName = (d.farmName || '').trim() || autoFarmName();
  // Either way in counts as found: the GPS button sets the flag, and a typed
  // place name is the farmer having told the map where to look. It is what gets
  // committed on the way out; it is no longer what decides whether the pin is
  // drawn — see the note on the map below.
  const located = !!d.located || !!(d.place || '').trim();

  return {
    tabs: false,
    top: appBar({
      // Review 21/09 — "Change to: 'Locate your farm'". The bar used to carry
      // the farm's name and "Draw your farm boundary" under it, which is the
      // job of the NEXT screen now.
      title: t('a10.locate.title', 'Locate your farm'),
      subtitle: farmName,
      onBack: () => go('A11'),
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      /* THE TWO WAYS IN, ABOVE THE MAP RATHER THAN FLOATING ON IT, AND SHORT.

         "Can we put both boxes at top" — and at the top of the SCREEN, not the
         image: a control lying over a satellite photograph is a control the eye
         reads as part of the photograph, which is what was wrong with the
         floating search pill this replaced.

         THE NUMBERS ARE GONE, at the third pass of review 21/09: "remove the
         labels 'option 1', 'option 2'. Make the 'use my current location' more
         compact. It should fit in one line."

         They were carrying two costs for one job. They took a column of the row
         — which is why the button underneath had to be shortened to "Use my
         location" to stop it wrapping — and they made a pair of alternatives
         read as a numbered procedure, which is the one thing a farmer must not
         do here: he needs ONE of these, not both in order. A search field over
         a locate button is the arrangement every map app on his phone already
         uses, and it says "either" without a word. With the column back, the
         full label fits on one line again. */
      h('div', {
        style: {
          display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
          padding: 'var(--sp-3) var(--sp-4)', background: 'var(--paper)', flex: '0 0 auto',
        },
      },
      // Its own key: B9's search bar says "Find your farm" and this one names
      // the service. One key, two English strings is a key that ships whichever
      // rendered first.
      placeSearch(d, t('a10.search', 'Search on Google Maps'), { floating: false, confirm: false }),
      btn(t('a10.uselocation', 'Use my current location'), {
        variant: 'secondary', icon: 'locate', size: 'sm',
        onclick: () => {
          if (!state.session.gpsGranted) { openModal('LOCATION_BLOCKED'); return; }
          d.located = true;
          commit('draw');
        },
      })),

      /* Everything the panel gives up, the map takes. It is the subject of the
         screen and it should look like it.

         THE PIN IS ALWAYS THERE, and the third pass asked for it "to show that
         when selected, the farm is here" — so the first pass drew it only once
         a place had been picked, on the argument that a pin on an arbitrary
         patch of desert would be the app claiming to know the answer to the
         question it is asking.

         The fourth pass settles it the other way, and the screen's own button
         is the reason. "Ready to map my farm" is deliberately NOT disabled
         before anything is pressed, because a farmer whose farm is already on
         screen has found it without pressing anything — which is the app
         saying, in code, that the map opens somewhere his farm might be. A pin
         at the centre of that is not a claim, it is the proposal the line
         underneath makes explicit: this is where we think it is, drag it if we
         are wrong. And it is what the fourth pass asked to see on the deck
         page, which is drawn in the state the screen opens in.

         It also has to carry more weight now. The search and the GPS button no
         longer raise a toast — same pass, "remove the black confirmation badge
         that says 'centred on xxx'" — so the pin and its line are the whole of
         what tells a farmer the map moved. A pin that appeared only after the
         badge was taken away would have left the opening state saying
         nothing at all. */
      // `imageryOf` because this screen has no plots to read a farm from: the
      // farmer is looking for ground he has not drawn yet. farm-1 is a block of
      // date-palm holdings south of Al Ain, which is what a farmer opening this
      // screen in the Gulf would be looking at.
      h('div.mapbox', { style: { flex: '1 1 auto', minHeight: '260px' } },
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite', pin: true, imageryOf: 'farm-1', cover: true })),
      h('p', {
        style: {
          margin: 0, padding: '0 var(--sp-4) var(--sp-2)', background: 'var(--paper)',
          color: 'var(--ink-600)', fontSize: 'var(--t-meta)', textAlign: 'center',
        },
      }, t('a10.pinned', 'Your farm is around the pin. Drag the map if it is not quite right.'))),

    /* "Once you confirm 'I found my farm,' a second screen appears." The
       confirmation IS the button, which is why it is worded as one — Romain on
       the call: "the 'use my current location' button becomes something like
       'ready to map my farm', which then reveals the drawing instructions on
       screen two." Not disabled before the map has been moved: a farmer whose
       farm is already on screen has found it without pressing anything, and a
       dimmed button would be the app disagreeing with his own eyes. */
    dock: actionDock(btn(t('a10.ready', 'Ready to map my farm'), {
      variant: 'primary',
      deckTo: 'A14',
      onclick: () => { d.located = located; commit('draw'); go('A14'); },
    })),
  };
}

/* THE INSTRUCTION, ON THE MAP, IN A SIZE NOBODY CAN MISS.

   It was six words in the app bar with the other thirty-two behind an ⓘ, and
   that is what Mark walked past: "Text is very small and easy to miss. Farmer
   may not know how to proceed. Should 'draw your farm boundary' appear on the
   map (at top of map or in the middle of the polygon) in bigger font?" It
   should, and it does — at the top of the map, over the image, where the
   instruction and the thing it is about are the same object.

   AND IT NOW DESCRIBES THE TOOL THAT IS ACTUALLY THERE — review 21/09, third
   pass: "we're placing corners of the field, not tracing with fingers. Change
   the explanation to basically say 'press to add a point at each corner of your
   farm' but in a more professional way."

   "Trace it with your finger" was describing a freehand tool this app has never
   had. handlePointer() pushes one vertex per tap and drags the vertex under the
   finger; a farmer who follows the old sentence drags his finger across the map
   and gets one point and a lot of nothing. Naming the corner is also naming the
   easier job: five taps is a thing anybody can do accurately on a phone, and a
   steady freehand line round a field is not. */
function drawInstruction() {
  return h('div', {
    style: {
      position: 'absolute', insetInline: '10px', top: '10px', zIndex: 3,
      background: 'rgba(11, 26, 21, .78)', color: '#fff',
      borderRadius: 'var(--radius)', padding: '10px 14px',
      backdropFilter: 'blur(2px)',
    },
  },
  h('div', { style: { fontWeight: 750, fontSize: 'var(--t-lead)' } },
    t('a10.subtitle', 'Draw your farm boundary')),
  h('div', { style: { fontSize: 'var(--t-meta)', opacity: .92, marginTop: '2px' } },
    t('a10.instruction3', 'Tap each corner of your farm to place a point. Include open fields, date palms and fruit trees — leave out greenhouses and sheds.')));
}

export function A14(farmId) {

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
      /* THE SUBTITLE AND THE ⓘ HAVE BOTH GONE. Six words in the bar with the
         other thirty-two behind an info button was the arrangement review
         21/09 walked straight past. The instruction is on the map now, in
         drawInstruction(), at a size that cannot be missed — which is what was
         asked for — and repeating it in the bar would be the same sentence
         twice on one screen. */
      onBack: () => go('A13'),
      actions: [barAction('undo', t('action.undo', 'Undo'), () => undoVertex(work.points), { disabled: !work.points.length })],
    }),
    /* THE MAP TAKES THE WHOLE SCREEN HERE, and it is the one of the three that
       does. B9 has a panel of fields under its map and A16 a list of plots to
       approve, so on those two the 65% band leaves room for something; A13 has
       nothing under it but the one warning that can appear, and 65% left a band
       of empty paper above the button. Review 01/09 (third pass) — "revert the
       map back to full height for this one." */
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', minHeight: '220px' } },
        // The ground does not change between A13 and here. He found his farm on
        // the last screen and is drawing round it on this one; a different
        // picture would be the app having moved the map while he was reading.
        mapSvg({ plots: [], measure: 'ndvi', basemap: 'satellite', imageryOf: 'farm-1', cover: true }),
        editor.node,
        // THE BIG INSTRUCTION, ON THE MAP. See the note on drawInstruction().
        drawInstruction()),
      when(editor.invalid, () => h('div', { style: { padding: '14px 16px', background: 'var(--paper)' } },
        disclaimer(t('a9d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)))),
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
          go(`A16:${farm.id}`, { replace: true });
          toast(kept.dropped
            ? t('a10.boundary.dropped', 'Boundary saved. {n} plots now fall outside it and have been taken off.', { n: num(kept.dropped) })
            : t('a10.boundary.saved', 'Boundary saved'));
        },
      })
      : btn(t('a10.request', 'Get quote'), {
        variant: 'primary',
        disabled: d.points.length < 3 || editor.invalid,
        /* THE SURVEY RUNS HERE, AND THE PRICE COMES AFTER IT — REVERSED BACK
           AT REVIEW 21/09.

           The 13/09 review's third pass had put the plan screen between this
           one and the satellite, so that a farmer who turned back at the price
           cost MMC nothing. Review 21/09 turns it round again, and says so in
           three separate places rather than one: the sequence Mark wrote on
           A13 — "Sequence: A13, A15, A16, A17" — the A15 button he renamed
           "Go to service plans (A17)", which is only a forward step if A17 is
           ahead, and above all the four steps he wrote on the new A11, which
           are the whole argument in his own words:

             You tell us the location of your farm
             Our platform automatically surveys your farm
             We send you a final quote
             You select the service plan you want

           A quote comes third and a plan is chosen fourth. The screening step
           that protected MMC from idle sign-ups is still there, and it is A11
           — the farmer has now seen both plans at their estimated cost before
           he gets here, which is the gate; what he has not done is commit, and
           he should not have to commit before being told the real number.

           So "Get quote" is exactly what the button does: it makes the farm,
           sends the boundary for survey, and the quote comes back. */
        onclick: () => {
          d.areaHa = areaHa;
          const made = addFarm({
            name: farmName,
            type: d.farmType ?? 'crops',
            areaHa,
            boundary: d.points,
            survey: 'surveying',
          });
          d.farmId = made.id;
          commit('draw');
          go(`A15:${made.id}`);
        },
      })),
  };
}

/* -- A15 · Analysis in progress ------------------------------------------

   NEW AT THE SECOND PASS OF THE 13/09 REVIEW, AND MOVED BY THE THIRD.
   Requesting the survey used to open a pop-up over the drawing screen —
   "Survey requested", a promise about timing, and a button straight through
   to A16 — which let the farmer see the (mocked-up, instant) result without
   ever really leaving the onboarding walk. The review's note: a real
   check-back, a real screen, not a pop-up the farmer clicks straight past.

   THE THIRD PASS PUT THE PRICE IN FRONT OF IT. This screen is now what the
   payment screen hands to — "once the survey is ongoing, we move to a new
   screen: confirm analysis ongoing, check back in later" — so by the time a
   farmer reads it he has drawn his land, seen his plan and confirmed it, and
   the only thing left to say is that the work has started and where to find
   the answer.

   ONE JOB, ONE BUTTON. It does not pretend to know when the answer comes;
   farm.survey.state carries that story and Home already knows how to tell it
   (surveyState(), in home.js), including the mockup's own shortcut past the
   wait. Duplicating that here would be a second place for the same fact to
   drift out of step with the first.

   WHY THIS IS WHERE THE ACCOUNT ACTUALLY OPENS. enterApp() used to wait for
   A19, at the far end of a route that no longer runs during sign-up. The farm
   exists and its survey is requested by the time this screen draws, so there
   is nothing left to finish before Home makes sense — "Go to my farm" is the
   one door out of first-run sign-up, same as it always was. */
export function A15(farmId) {
  const farm = farmId ? farmById(farmId) : null;
  return {
    tabs: false,
    body: h('div.page', { style: { paddingTop: 'calc(var(--safe-top) + 40px)', alignItems: 'center', textAlign: 'center', gap: '18px' } },
      h('div', {
        style: {
          width: '92px', height: '92px', borderRadius: '50%', background: 'var(--st-monitor-bg)',
          color: 'var(--st-monitor)', display: 'grid', placeItems: 'center',
        },
      }, icon('scan', 44)),
      /* "SURVEY", NOT "ANALYSIS". Review 21/09 framed the one word and changed
         it. The farmer was told a survey was starting on the screen before
         this one and will be told his survey is finished on the screen after;
         calling the middle of it an analysis makes three names for two things. */
      h('h1', { style: { margin: 0, fontSize: 'var(--t-head)' } }, t('a10b.title2', 'Survey in progress')),

      /* TWO PARAGRAPHS BECAME ONE SENTENCE, AND THE ONE THING IT USED TO GET
         WRONG IS GONE.

         It said "keep the app open to see available service plans", and Mark
         asked why: "I don't think that's needed." He is right, and the reason
         is architectural rather than editorial — the survey runs on MMC's
         servers, not in the phone. The app has nothing to do while it runs and
         nothing to lose by being closed; a push notification is what brings the
         farmer back. Telling him to sit and watch was asking him to do the
         waiting the server is already doing.

         "Then let's simplify to 'you will be notified when the survey is
         completed,' plus an estimated time." */
      h('p', { style: { margin: 0, color: 'var(--ink-700)', maxWidth: '30ch' } },
        t('a10b.body3', 'We will notify you when the survey of {farm} is completed.', { farm: farm?.name ?? autoFarmName() })),

      /* THE ESTIMATED TIME IS MMC'S NUMBER AND NOT OURS. Mark assumed about
         thirty minutes; Romain has heard one or two in some cases, and it
         varies by country — "we'll let MMC supply the actual number". So the
         figure here is a placeholder, and the sentence is written so that
         swapping the number does not rewrite it.

         THE NOTE SAYING SO IS GONE — review 21/09, third pass: "remove the
         mockup note." It was a line of paper addressed to us, printed on a
         screen a farmer reads, and every reviewer who saw the deck read it as
         part of the app. Where the thirty comes from belongs in this comment,
         which is where the person who has to swap it is looking. */
      h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '30ch' } },
        t('a10b.eta', 'This usually takes about {mins} minutes.', { mins: num(30) })),
      h('div', { style: { flex: '1 1 auto' } })),

    /* Review 21/09 — "Change to: 'Go to service plans' (A17)." The button used
       to open Home, which was the right destination when the survey ran before
       the price; with the price after it, the thing waiting on the far side of
       this screen is the quote. */
    dock: actionDock(btn(t('a10b.toplans', 'Go to service plans'), {
      variant: 'primary',
      deckTo: 'A17',
      onclick: () => { resetLocal('signup'); go(farmId ? `A17:${farmId}` : 'A17'); },
    })),
  };
}

/* -- A16 · Survey results, WF4.078 … WF4.088 -----------------------------
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
   route used to skip it: B9 handed straight to A12 and the farmer never saw
   the list he had just made written out as one thing to approve.

   So A16 now reads from either of two sources, and asks for the same shape from
   both — a named list of areas, each with a class and a size, each of which can
   be kept, corrected or taken off the quote, plus a way to add one that is
   missing. The survey's areas live on a farm record and are edited through
   survey.js; the drawn plots live in the signup draft and have no record at all
   until A19. Neither of those facts reaches the screen. */

export function A16(farmId) {
  const scope = farmId ? surveyScope(farmId) : drawnScope();
  const ui = local(`a11-${scope.key}`, { selected: null });
  const { totals, areas } = scope;

  /* TWO ROUTES REACH THIS BUTTON AND THEY ARE ASKING FOR DIFFERENT THINGS.
     "Request quote" was right when a quote was what came next, and on the
     drawn route it still is. On the survey route it stopped being true at the
     13/09 review's third pass: the farmer chose his plan and paid for it
     before the satellite was asked for anything, so by the time he reads this
     list he is not asking for a price, he is telling us the plots we found are
     the right ones — and A17 follows to show what they came to. */
  const confirm = btn(scope.confirmLabel ?? t('a11.requestquote', 'Request quote'), {
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
        () => go(`A13:${scope.farmId}`),
        { title: t('a11.editboundary', 'Adjust the farm boundary') },
      ))],
    }),
    /* Review 01/09 (second pass) — THE MAP IS THE BAND, 65% of the phone and
       flush to three edges, the same on this screen as on A13 and B9. It was
       a 215 dp letterbox for one round and a 420 dp card for the next; what it
       had never been is the same map the farmer drew on. */
    body: [
      mapBand(landUseSvg({
        areas, selectedId: ui.selected, boundary: scope.boundary,
        fills: Object.fromEntries(LAND_USE.map((k) => [k, LAND_USE_META[k].fill])),
        onTap: (a) => { ui.selected = ui.selected === a.id ? null : a.id; commit('a11'); },
        // The areas carry no farm id of their own, so the ground is named here:
        // the farm being surveyed, or — on a first run, before there is a farm
        // record — the place A13 and A14 were looking at.
        imageryOf: scope.farmId ?? 'farm-1',
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
    /* THE LINE THE FARMER DREW ON A13, drawn under the plots as the reference
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
    confirmLabel: t('a11.confirmplots', 'Confirm these plots'),
    confirm: () => { confirmSurvey(farm.id); go(`A17:${farm.id}`); },
  };
}

/* The plots the farmer drew himself, still in the signup draft.

   The list is the same list B9 was building; what this scope adds is the
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
    // B9 offers "date palms and fruit trees" as one answer — so the fruit
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
    add: () => go('B9'),
    confirm: () => {
      d.areaHa = round1(cropHa + treeHa);
      d.farmType = typeFromTotals({ cropHa, treeCount });
      commit('a11');
      go('A17');
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
    /* WF4.079 — read once and remembered, which beats repeating a colour word
       on every row.

       Review 06/09 added the third key, and drew the swatch for it: "Add: Farm
       boundary", with a blue dashed rectangle beside the words. The line has
       been on the map since the 01/09 review and the legend under it named two
       fills and not the outline round them — so a farmer looking at a dashed
       blue shape he did not recognise had nothing to read it against. The
       swatch is drawn the way the line is drawn, which is the only way a key is
       worth having. */
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' } },
      LAND_USE.map((kind) => h('span.legendkey',
        h('span.legendkey__swatch', { style: { background: LAND_USE_META[kind].fill } }),
        t(`landuse.${kind}.short`, LAND_USE_SHORT[kind]))),
      h('span.legendkey',
        h('span.legendkey__swatch.legendkey__swatch--boundary'),
        t('a11.legend.boundary', 'Farm boundary'))),

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

/* The two answers to "what is growing on this farm?" — read off two numbers
   on A10 now (see farmTypeFrom()) rather than picked from cards, and still
   asked per plot on B9, which is the one place left that reads this list.

   A12 was a third reader once and it is gone (review 01/09); A10's own picker
   was a fourth and it went at the 13/09 review's second pass. What survives
   is the vocabulary — icons, labels, per-plot pricing sub-lines — because
   B9 still needs a name for each answer and a farmer meeting the words a
   second time should meet the same ones.

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

/* -- A17 · Your plan and price, WF4.089 … WF4.111 -------------------------
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
 * What to price when no survey has run — which, since the 13/09 review's third
 * pass, is the ordinary first-run case: the plan is chosen and paid for BEFORE
 * the satellite is asked for anything.
 *
 * THE FARMER'S OWN TWO NUMBERS COME FIRST, and they are the same two A11
 * quoted a range from. A price that changes between the estimate screen and
 * the plan screen, with nothing measured in between to explain the change, is
 * the one thing this pair of screens must not do.
 *
 * A mixed farm has to SPLIT its quantities rather than counting the same
 * ground twice — the survey path does that naturally, because its areas are
 * disjoint polygons, and an earlier fallback charged the same hectares once as
 * crop ground and again as the trees standing on it. Here the split is the
 * farmer's own: he entered an area for his fields and a count for his trees.
 */
function drawnTotals(d) {
  const round1 = (n) => Math.round(n * 10) / 10;
  // Review 22/08 — plots carry their own class, decided one by one on A16, so
  // where they exist the split is read off them rather than guessed.
  const kept = (d.plots ?? []).filter((p) => p.included !== false);
  if (kept.length) {
    const cropHa = round1(kept.filter((p) => (p.kind ?? 'crops') === 'crops').reduce((s, p) => s + p.areaHa, 0));
    const treeHa = round1(kept.filter((p) => p.kind === 'trees').reduce((s, p) => s + p.areaHa, 0));
    return { cropHa, treeHa, treeCount: Math.round(treeHa * TREES_PER_HA) };
  }
  // Otherwise the farmer's own two numbers, through the same helper A11 quoted
  // its range from — including its fallback, so a cold-opened A17 and a
  // cold-opened A11 describe one holding rather than two.
  const { cropHa, treeCount } = roughTotals(d);
  return { cropHa, treeHa: 0, treeCount };
}

/* The plan cards, and the commercial facts that go with them.

   Six things about this page came out of review, and all six are about trust
   rather than layout:

     * Compare plans is at the TOP. At the bottom it was below two price
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

/* THE ANNUAL DISCOUNT, in one place, because four screens quote it: A17's plan
   cards, F5's subscription, F6's comparison and the before-you-buy block.

   It went to the payment page at the 22/08 review, when annual and monthly cost
   the same per month and a second figure on the card was noise. It is back
   because there is now a saving to state, and a saving is a reason to choose —
   which belongs on the thing being chosen rather than two screens later.

   WF4.102 keeps the real figure on the server; when the payment page exists it
   will fetch it rather than read this constant. */
export const ANNUAL_DISCOUNT = 0.15;

/* ONE PLAN CARD. Tapping it selects — it does not leave the screen.
   The 13/09 review's third pass asked for "one main confirmation button at the
   bottom", which is a different shape of decision from the two Choose buttons
   this screen used to carry: those made the choice AND acted on it in one tap,
   so the farmer committed to a subscription by the same press that told us
   which one he was reading about. Choosing and confirming are two steps now,
   and the second one is the only button that leaves. */
/* ONE PLAN, AS A ROW INSIDE THE DECISION CARD.

   It was a card of its own until review 21/09's second pass — "there's too many
   widgets going on" — and a card is the wrong container for one of two things
   being chosen between: two cards are two subjects, two rows in one box are one
   question. The tick, the name and the price are unchanged; what went is the
   border round each of them.

   `pickable: false` is A11 — "Remove buttons. Not needed at this point." No
   radio and nothing to tap: on the estimate screen these two are a price list,
   not a question, and an empty circle is still an invitation. */
function planChoice(level, opts) {
  return planCard(level, { ...opts, bare: true });
}

function planCard(level, { usd, country, selected, onPick, pickable = true, period = 'month', bare = false }) {
  const body = (...kids) => (bare
    ? h(`div.planbox__row${pickable ? '.planbox__row--tap' : ''}`, {
      onclick: pickable ? onPick : undefined,
      role: pickable ? 'button' : null,
      style: { display: 'block' },
    }, ...kids)
    : card({ accent: selected ? 'good' : undefined, onclick: pickable ? onPick : undefined },
      cardPad(...kids)));
  return body(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        // The tick is the whole of the selected state, beside the name it
        // belongs to. WF4.101 still holds — neither plan is dressed as the
        // recommended one — because both cards are drawn from this one
        // function and differ in nothing but their name and their number.
        when(pickable, () => h('span', {
          style: {
            display: 'grid', placeItems: 'center', flex: '0 0 auto',
            width: '22px', height: '22px', borderRadius: '50%',
            border: selected ? 'none' : '2px solid var(--ink-300)',
            background: selected ? 'var(--st-good)' : 'transparent',
            color: 'var(--paper)',
          },
        }, when(selected, () => icon('check', 15)))),
        /* THE PLAN NAME IS A LABEL, NOT A HEADING — review 21/09, fourth pass:
           "there's a lot of bold text, not a lot of hierarchy in the
           typography… add a little more hierarchical typography in the pricing
           display."

           It was 750-weight ink at body-adjacent size, which put it at the same
           volume as the figure under it, and a plan card where the word BASIC
           shouts as loudly as SAR 716 has told the reader nothing about which
           of the two he is choosing between. Small caps in grey is what a label
           looks like; the price keeps the weight. */
        h('span', {
          style: {
            fontWeight: 700, letterSpacing: '.07em', fontSize: 'var(--t-meta)',
            color: 'var(--ink-500)',
          },
        }, t(`plan.${level.tier}`, level.name).toUpperCase())),

      /* WF4.102 — the farmer's own currency, from a server rate. Review S34:
         the figure is exclusive of VAT and says so, because a farmer who
         budgets from this number and then sees 15% more on the receipt has
         been misled by a rounding of the truth. Review 01/09 — "+VAT" sits
         beside the number rather than under it: one line, one price, one
         caveat.

         FOUR LEVELS ON ONE LINE, and they were one. "SAR 716 / month" was a
         single 700-weight string, so the amount, the currency and the billing
         unit were all equally loud and the eye had nothing to land on — which
         is the whole of what the fourth pass was asking for. The number is the
         only thing set at --t-num now; the unit after it steps down a size and
         a weight, and the VAT caveat steps down again. */
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' } },
        h('span.num', priceBare(usd, country)),
        // Review 21/09 framed both frames round the word "month" on the annual
        // page and wrote "year" beside them, so the period is a parameter now.
        h('span', { style: { fontSize: 'var(--t-lead)', fontWeight: 500, color: 'var(--ink-600)' } },
          `/ ${period === 'year' ? t('unit.year', 'year') : t('unit.month', 'month')}`),
        h('span', { style: { fontSize: 'var(--t-meta)', fontWeight: 500, color: 'var(--ink-500)' } },
          t('a13.plusvat', '+ VAT'))));
}

/* -- A17 · Service plans --------------------------------------------------

   ONE SCREEN AND ONE STATE, SINCE REVIEW 21/09'S THIRD PASS.

   It was two screen codes. The deck split the plan page in two and recoloured
   A17's own title to say which half it now is — "Your MONTHLY plan and price
   for new users" — with a new A18 carrying the annual prices, and the call
   settled the switch between them as "a toggle you swap between… clicking
   through takes you to a second screen for the annual plan".

   The third pass takes that back, in its own words: "don't create a separate
   screen code to show the monthly plan page. Don't show it on the powerpoint."

   A18 is therefore GONE as a screen and as a deck page, and the billing period
   is state rather than a route. Which is what it always was: a segmented
   control whose two halves are two URLs is a control pretending to be
   navigation, and it cost a screen code, a deck page and a registry entry to
   say a thing the lit segment already says. Nothing on the screen changes
   except two numbers and one word.

   THE PERIOD IS NOW ON TOP, AND ANNUAL IS THE DEFAULT. Also the third pass:
   "move the monthly / annually on top of the pricing. The tab is a bit big. Can
   we default to annually, and show a colourful '2 months free' below the tab,
   with a small sparkle symbol."

   Which reverses the second pass's ordering — the toggle sat under the cards
   and under Compare plans, on the argument that the level is the real question
   and the period only how it is paid for. That argument was sound about
   IMPORTANCE and wrong about READING ORDER: the period is what the two prices
   MEAN, so a farmer who met the figures first read them under an assumption the
   screen had not yet stated, and then watched them change. The period is the
   unit; the unit is declared before the number. Defaulting to annual is the
   same sentence from the other end — the cheaper of the two is the one to show
   first — and the saving is spelled out under the control rather than crammed
   into a segment, which is what made the tab too big.

   A NOTE ON THE LETTER. The call renamed the two A13s — "an earlier version
   (for a first-time user) and a later version (for a returning one)… we'll
   rename them A13a and A13b" — which collided with the deck's A18 for the
   annual page. With A18 withdrawn the collision is gone; the first-time /
   returning distinction is carried by the screen titles. */

/* Where the billing period lives now. Not in the signup draft: the draft is the
   account being built, and a control the farmer flicks back and forth to
   compare two numbers is not part of it — F5 asks the same question of an
   account that already has a subscription, and this screen is also reached from
   Home for a farm that has one. Annual by default, as asked. */
const billing = () => local('billing', { period: 'year' });

export function A17(farmId) {
  const period = billing().period;
  const d = draft();
  const farm = farmId ? farmById(farmId) : null;
  const raw = farmId ? rawFarm(farmId) : null;

  /* THE PRICE NO LONGER WAITS FOR THE SURVEY, BECAUSE THE SURVEY NOW WAITS
     FOR THIS SCREEN. WF4.091 said no price before a survey has finished, and
     that rule was written when the survey ran first: inventing a number ahead
     of it would have been the guess the survey exists to remove. The 13/09
     review's third pass reversed the order — "after A13 we move to A17, the
     payment screen … once the user clicks the main confirmation button, we
     send for survey" — so the only honest thing to price before the satellite
     has looked is what the farmer himself said he has, which is what A10 asked
     for and A11 already quoted. The screen says so, in as many words, rather
     than hiding the distinction.

     `estimate` is that state: no farm record yet, nothing measured, the two
     numbers off A10 and the boundary off A13. */
  const estimate = !raw;

  /* THE ONE CASE WITH NOTHING TO SAY: a farm whose survey is running. It has a
     record, so it is not an estimate any more, and no result, so there is
     nothing to price — and reading `surveyTotals` here would materialise the
     answer early (ensureSurvey() writes on first read), showing the farmer
     plots the satellite is still supposed to be finding. Nothing routes here
     in this state; a hand-typed route can. */
  if (raw?.survey && raw.survey.state === 'surveying') {
    return {
      tabs: false,
      top: appBar({ title: t('a13.surveying.title', 'Your plan'), subtitle: farm.name }),
      body: page(
        card({}, cardPad(
          h('div', { style: { fontWeight: 650 } }, t('a13.surveying', 'The survey is still running')),
          h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
            t('a13.surveying.body2', 'We will show you what we found, and what it costs, as soon as it is ready.'))))),
    };
  }

  const annual = period === 'year';
  const totals = raw?.survey ? surveyTotals(raw) : drawnTotals(d);
  const family = totals.cropHa > 0 && totals.treeCount > 0 ? 'combined'
    : totals.treeCount > 0 ? 'tree' : 'crop';
  const farmName = farm?.name ?? ((d.farmName || '').trim() || autoFarmName());

  /* PRO IS PRESELECTED — review 21/09, fourth pass: "preselect Pro plan."

     It opened with neither tier ticked, which made the screen's first state a
     question with no answer offered and put a toast ("Choose a plan first")
     between the farmer and the button he is most likely to press. A default is
     also what the rest of this run already assumes: A11 quotes both tiers as a
     price list and the four steps say the plan is chosen here, so arriving with
     the fuller one ticked is the app finishing a sentence it started.

     WF4.101 SAYS NEITHER PLAN MAY BE DRESSED AS THE RECOMMENDED ONE, and this
     does not break it. The rule is about the DRAWING — no "most popular"
     ribbon, no larger card, no accent one of them does not get — and planCard()
     still renders both tiers from one function that differs in nothing but the
     name and the number. A preselected radio is a starting value the farmer
     changes with one tap, in a control that shows the alternative at the same
     size directly above it.

     It is `d.plan ?? default`, not a write: nothing is committed until he
     presses the button, and a farmer who has already picked Basic keeps it. */
  const chosen = d.plan ?? `${family === 'combined' ? 'combined' : family}_pro`;

  /* THE ONE ROUTE THAT STILL ARRIVES WITHOUT A FARM RECORD is B9's — plots
     drawn and classified by hand, nothing for the satellite to detect, so
     nothing made a farm on the way in. Since review 21/09 the whole-farm route
     arrives with both a record and a finished survey behind it. */
  const drawnPlots = (d.plots ?? []).filter((p) => p.included !== false);

  /* WHAT FINISHES THE PURCHASE, called from A18's Subscribe rather than from
     the button on this screen: since review 21/09's second pass the money
     changes hands in the store's own sheet, and this is what runs when it
     comes back. It is the farmer agreeing to the price his real plots came to,
     and it hands to A19 — on both routes, because on both of them the
     measuring is done by the time he reads a figure. */
  const confirm = () => {
    if (!chosen) {
      toast(t('a13.pickplan', 'Choose a plan first'), 'warn');
      return;
    }
    state.session.plan = chosen;
    if (estimate) {
      /* THE ONLY ROUTE LEFT THROUGH HERE WITHOUT A FARM RECORD is the one that
         drew its own plots on B9: nothing was surveyed, so nothing made a
         farm on the way. The whole-farm route now arrives with a record and a
         survey behind it, because A14 makes both — see the note on its
         button. */
      const made = addFarm({
        name: farmName,
        type: d.farmType ?? 'crops',
        areaHa: d.areaHa,
        plots: drawnPlots,
      });
      d.farmId = made.id;
      commit('a13');
      go(`A19:${made.id}`);
      return;
    }
    // A farm whose survey came back and was approved on A16 is confirmed
    // already; one opened straight from Home is not, and this is the press
    // that settles it.
    if (raw.survey && raw.survey.state !== 'confirmed') confirmSurvey(farm.id);
    commit('a13');
    go(`A19:${farm.id}`);
  };

  return {
    tabs: false,
    // A18 renders this screen behind its sheet and needs the same press to
    // finish the purchase — see the note on confirm() above.
    confirmPurchase: confirm,
    top: appBar({
      /* Review 21/09 — "Change to: 'Monthly service plans'", and the same note
         on the annual page. "Your plan" was the possessive of a thing not yet
         chosen; this names what is on the screen.

         ONE TITLE, NOT TWO, since the period became a toggle on the same
         screen: a heading that rewrites itself when a control two rows below it
         is pressed reads as a page change, which is exactly the page change the
         third pass removed. The lit segment says which period this is. */
      title: t('a13.title2', 'Service plans'),
      // The estimate route has no farm record yet, and since the 21/08 review
      // it has had a name from the very first screen — so the bar can say
      // which farm this price is for either way.
      subtitle: farmName,
    }),
    body: page(
      /* WHAT IS BEING PRICED, AND ON WHAT BASIS — one line, at the top, where
         a farmer reading a number for the first time asks the question. The
         quantities used to sit in a card of their own below the trial card,
         which made two boxes of supporting detail stand between the screen's
         title and its actual subject. */
      h('p', { style: { margin: 0, color: 'var(--ink-700)' } },
        estimate
          // Review 21/09 rewrote this. "Priced on what you told us … we will
          // adjust it to whatever the survey actually finds" put the caveat
          // first and the subject second; the new line says what the plans are
          // based on and stops.
          ? t('a13.basis.estimate', 'The service plans are based on {what}.', { what: quantityLine(totals) })
          : t('a13.basis.survey', 'Priced on what the survey found: {what}.', { what: quantityLine(totals) })),

      /* ONE CARD FOR THE WHOLE DECISION, SINCE REVIEW 21/09 (SECOND PASS).

         "There's too many widgets going on, can we organise this page to look
         a little more structured with a little less inputs and stuff?"

         The count was the symptom. Everything on this screen belongs to one
         question — which plan, at which billing period — and it was drawn as
         five separate boxes down the page: a card, a card, a row, a checkbox, a
         card. Five edges, five backgrounds, and nothing saying they were about
         the same thing.

         They are one card now with rules between the parts: the period switch,
         then the two plans as rows rather than cards of their own, then Compare
         plans. The third pass moved the switch from the bottom of this box to
         the top of it — see the note above the function — and it is still
         visibly part of the same decision rather than an afterthought floating
         under it, which is what the one card was for.

         Nothing was dropped. Every string, every link and every button the
         review asked for is still here; what went is the chrome between them. */
      card({}, h('div.planbox',
        /* THE BILLING PERIOD, FIRST — see the note above the function for why
           it moved up here. A segmented control rather than the deck's
           checkbox: see segmented() in components.js.

           SMALL, and one line per segment. It carried "two months free" as a
           sub-line under "Annual", which made both segments two lines tall to
           say something about one of them — "the tab is a bit big", and that
           was the reason. The saving is its own line underneath now, where it
           can be coloured and can keep a symbol. */
        h('div.planbox__row', { style: { display: 'block' } },
          segmented([
            { id: 'year', label: t('a13.per.year', 'Annual') },
            { id: 'month', label: t('a13.per.month', 'Monthly') },
          ], period, (id) => {
            if (id === period) return;
            billing().period = id;
            commit('billing');
          }, { size: 'sm' }),

          /* THE SAVING, SPELT OUT AND IN COLOUR. "Show a colourful '2 months
             free' below the tab, with a small sparkle symbol or something."

             It reads the same under either segment on purpose — it is the
             reason to choose annual when monthly is lit, and what he is getting
             when annual is. Twelve months at ANNUAL_DISCOUNT is two months off,
             which is why it can say a number of months rather than a
             percentage: months are the unit the farmer is already thinking in
             on this screen.

             THREE WORDS, because it is a badge and a badge that wraps is a
             banner. "…with annual billing" ran to two lines and filled the
             card's whole width, which made a small flourish look like a notice;
             the segment lit directly above it already says which period this
             belongs to. */
          h('div', { style: { display: 'flex', justifyContent: 'center', marginTop: '10px' } },
            h('span', {
              style: {
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                // WF2.017 — the four-state scale's own green on its own tint,
                // which is the pairing .status--good uses and the only pair on
                // this page that says "in your favour" without inventing a
                // colour for it.
                background: 'var(--st-good-bg)', color: 'var(--st-good)',
                borderRadius: '999px', padding: '5px 12px',
                fontSize: 'var(--t-meta)', fontWeight: 700,
              },
            },
            h('span', { style: { display: 'flex', flex: '0 0 auto' } }, icon('sparkles', 16)),
            h('span', t('a13.per.year.save2', '2 months free'))))),

        LEVELS.map((level) => {
          const key = `${family === 'combined' ? 'combined' : family}_${level.tier}`;
          const monthly = planPrice(family, level.tier, totals);
          return planChoice(level, {
            // Twelve months at the discounted rate. "Note that MMC changed
            // discount plan" — ANNUAL_DISCOUNT is the one place that figure
            // lives, and it is server configuration when there is a server.
            usd: annual ? monthly * 12 * (1 - ANNUAL_DISCOUNT) : monthly,
            period,
            country: d.country,
            selected: chosen === key,
            onPick: () => { d.plan = key; commit('a13'); },
          });
        }),

        // Where the comparison belongs: beside the decision it informs. Review
        // 06/09 — "Change to 'Compare plans' (user goes to F6)".
        h('button.row.planbox__row', {
          onclick: () => go('F6'),
          deckTo: 'F6',
        },
        h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('list', 21)),
        h('div.row__main', h('div.row__title', t('a13.compare', 'Compare plans'))),
        h('span.row__chev', icon('forward', 20, 'flip'))))),

      /* THE TRIAL, UNDER THE CHOICE RATHER THAN OVER IT. It is the answer to
         "what happens if I press the button", which is a question the farmer
         asks once he has picked — and at the top of the screen it was the
         first thing read on a page whose subject is the plan.

         AND IT DESCRIBES THE STORE'S BILLING RATHER THAN OURS. Review 21/09:
         "The language should reflect how the Apple/Google payment plans work.
         We don't charge a credit card, as the subscription is through
         Apple/Google." Which is not a wording preference — the old sentence,
         "we will ask before your CARD is charged", described a relationship
         that does not exist. Wafra never sees the card. The store does, the
         farmer already has an account with it, and cancelling is something he
         does there and not here. The term is the store's own: "Apple calls this
         'in-app purchase' — we should align our wording to that."

         TWO SENTENCES BECAME ONE, AND THE TWO PHONES BECAME NO PHONES — review
         21/09, third pass: "make the explanation for the 30 days free trial
         shorter. Focus on in-app purchase, and managing the trial through that.
         Do not differentiate between iOS and Android, they work the same."

         Which is right on the facts: the second line named Google Play only to
         say that Google Play does what the App Store does, so it spent a line
         drawing a distinction in order to deny it. "Your app store" covers both
         and is what the farmer calls his own. What is left is the one thing he
         needs — where the trial is managed and that nothing is charged until it
         ends — in the length he will actually read on the screen that asks him
         to subscribe. */
      card({ accent: 'good' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { color: 'var(--st-good)', display: 'flex' } }, icon('check', 22)),
          h('span', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } },
            t('a13.trial', '30 days free trial'))),
        h('div', { style: { color: 'var(--ink-700)' } },
          t('a13.trial.permission5', 'This is an in-app purchase. Nothing is charged until the 30 days are up, and you can cancel any time before then from your app store subscriptions.')))),

      // Review 22/08 — the way back to the list the price was worked out from,
      // for the farmer looking at a figure he did not expect. There is no such
      // list before the survey has run, so the link waits for one.
      when(!estimate, () => btn(t('a13.modify', 'Click here to modify the list of plots.'), {
        variant: 'ghost',
        onclick: () => go(`A16:${farm.id}`),
      })),

      /* 13/09 REVIEW, SECOND PASS — THREE DISCLAIMERS BECAME ONE. The annual
         discount and the App Store cancellation policy are both real facts,
         and both belong on a screen about billing (F5) rather than on the one
         screen that stands between a farmer and his first price. What he does
         need here is the answer to "what if I got the numbers wrong". */
      disclaimer(t('a13.adjust', 'You can change what is monitored at any time — your price adjusts at the next billing cycle.'))),

    /* THE MAIN CONFIRMATION BUTTON, AT THE BOTTOM, asked for in those words.
       NOT DISABLED: a dimmed button does not say what is missing, and this one
       says it — the same rule A10's Continue follows. */
    /* Review 21/09 — "Change to: 'start free trial'." It was "Confirm and start
       survey", which named what the app does next rather than what the farmer
       gets, and on a screen whose subject is a subscription the honest verb is
       the one about the subscription. The survey still starts; the sentence
       above the button is what says so. */
    /* Review 21/09 — "Change to: 'start free trial'." It named what the app
       does next rather than what the farmer gets, and on a screen whose subject
       is a subscription the honest verb is the one about the subscription.

       IT OPENS THE STORE'S SHEET, not ours. That is the second pass's A18, and
       it is where the money actually changes hands — see the note on that
       screen. */
    dock: actionDock(btn(
      t('a13.starttrial', 'Start free trial'),
      {
        variant: 'primary', deckTo: 'A18',
        onclick: () => {
          if (!chosen) { toast(t('a13.pickplan', 'Choose a plan first'), 'warn'); return; }
          state.session.plan = chosen;
          commit('a13');
          go(farmId ? `A18:${farmId}` : 'A18');
        },
      },
    )),
  };
}

/* -- A18 · The App Store purchase sheet ----------------------------------

   NEW AT REVIEW 21/09 (SECOND PASS): "Add a new screen 13c with the iOS app
   store payment popup displayed as a drawer for payment. Use the original,
   default Apple one if possible."

   WHY IT IS WORTH A PAGE AT ALL. The 21/09 call settled that Wafra never sees
   a card — "we don't charge a credit card, as the subscription is through
   Apple/Google" — and A17 now says so in words. This is the same fact in the
   form a farmer meets it: press Start free trial and the app stops being the
   thing he is dealing with. The sheet is Apple's, the account is his, the
   confirmation is a double-press of the side button, and nothing we draw
   appears on it except our own name and price.

   IT IS DELIBERATELY NOT OUR DESIGN SYSTEM. Every other screen in this deck is
   Wafra's; this one is a photograph of somebody else's, drawn to iOS's own
   metrics — the grabber, the 13 pt secondary type, the blue 17 pt action, the
   "Double Click to Confirm" caret at the top right where the side button
   physically is. A reviewer needs to recognise it instantly as the system
   sheet, because the whole point is that it is not ours to change. What it
   costs is a handful of hard-coded values that break the token rules on
   purpose; they are Apple's values, not ours, and they should not be swapped
   for brand ones when the tokens next move.

   The drawer is drawn INTO the page rather than into the overlay layer, the
   same way A2's language sheet is, because a printed deck cannot photograph a
   state of another screen any other way. */

/* Apple's own system colours, and the secondary is the DARKER of the two Apple
   ships. `secondaryLabel` at #8a8a8e is what the sheet uses by default and it
   measures 3.1:1 against #f2f2f7 — which our own spec audit flags, rightly, and
   which Apple itself replaces with this darker grey the moment a phone has
   Increase Contrast turned on. Taking the accessible one of the two values the
   platform already has is not redrawing somebody else's sheet. */
const APPLE = {
  ink: '#1c1c1e', sub: '#636366', blue: '#0060df',
  paper: '#f2f2f7', card: '#ffffff', rule: 'rgba(60,60,67,.18)',
};

export function A18(farmId) {
  const d = draft();
  /* The same period the screen behind this sheet is showing. It used to read
     `d.plan === 'annual'`, which could not be true: d.plan holds a level key
     like `crop_pro`, so the sheet quoted a monthly figure whichever page opened
     it. With the period in one place there is one thing to read. */
  const annual = billing().period === 'year';
  const base = A17(farmId);

  const line = (label, value, opts = {}) => h('div', {
    style: {
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: '12px', padding: '11px 16px',
      borderTop: opts.first ? '0' : `.5px solid ${APPLE.rule}`,
    },
  },
  h('span', { style: { color: APPLE.ink, fontSize: '15px' } }, label),
  h('span', { style: { color: opts.strong ? APPLE.ink : APPLE.sub, fontSize: '15px', fontWeight: opts.strong ? 600 : 400, textAlign: 'end' } }, value));

  return {
    tabs: false,
    top: base.top,
    body: h('div', { style: { position: 'relative', height: '100%' } },
      // The plan screen behind it, dimmed the way iOS dims what a system sheet
      // is raised over.
      h('div', { style: { height: '100%', overflow: 'hidden', filter: 'saturate(.9)', opacity: .55 } }, base.body),
      h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,.28)' } }),

      h('div', {
        style: {
          position: 'absolute', insetInline: 0, bottom: 0,
          background: APPLE.paper, color: APPLE.ink,
          borderRadius: '13px 13px 0 0',
          paddingBottom: 'calc(var(--safe-bottom) + 10px)',
          boxShadow: '0 -1px 20px rgba(0,0,0,.18)',
          fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
        },
      },
      // The grabber, then the double-click caret pointing at the side button.
      h('div', { style: { width: '36px', height: '5px', borderRadius: '3px', background: 'rgba(60,60,67,.3)', margin: '6px auto 0' } }),
      h('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: '8px', padding: '10px 16px 0',
        },
      },
      h('span', { style: { fontSize: '13px', fontWeight: 600, color: APPLE.ink, textAlign: 'end', lineHeight: 1.2 } },
        t('a13c.doubleclick', 'Double Click to Confirm')),
      h('span', { style: { fontSize: '17px', color: APPLE.ink } }, '»')),

      h('div', { style: { padding: '2px 16px 12px' } },
        h('div', { style: { fontSize: '20px', fontWeight: 700, letterSpacing: '-.01em' } },
          t('a13c.title', 'Confirm Subscription')),
        h('div', { style: { fontSize: '13px', color: APPLE.sub, marginTop: '2px' } },
          t('a13c.appleid', 'Apple Account: khaled@icloud.com'))),

      h('div', { style: { background: APPLE.card, borderRadius: '10px', margin: '0 16px', overflow: 'hidden' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' } },
          // The app's own tile, which is the one thing on this sheet that is
          // ours — at the size the store draws it.
          h('div', {
            style: {
              width: '44px', height: '44px', borderRadius: '10px', flex: '0 0 auto',
              background: 'var(--brand-700)', color: '#fff',
              display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '18px',
            },
          }, 'W'),
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { fontSize: '15px', fontWeight: 600 } }, BRAND.product),
            h('div', { style: { fontSize: '13px', color: APPLE.sub } },
              annual ? t('a13c.plan.year', 'Pro · Yearly') : t('a13c.plan.month', 'Pro · Monthly')))),
        line(t('a13c.free', 'Free Trial'), t('a13c.free.len', '30 days'), { first: false, strong: true }),
        line(t('a13c.then', 'Then'), annual ? 'SAR 10,955 / year' : 'SAR 1,074 / month'),
        line(t('a13c.renews', 'Renews'), t('a13c.renews.when', '21 October 2026'))),

      h('p', { style: { margin: '10px 16px 0', fontSize: '12px', lineHeight: 1.35, color: APPLE.sub } },
        t('a13c.smallprint', 'Your free trial ends on 21 October 2026. The subscription renews automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel in Settings.')),

      h('div', { style: { display: 'flex', justifyContent: 'center', padding: '14px 16px 4px' } },
        h('button', {
          type: 'button',
          onclick: () => base.confirmPurchase?.(),
          style: {
            background: 'none', border: 0, color: APPLE.blue,
            fontSize: '17px', fontWeight: 600, cursor: 'pointer', padding: '8px 12px',
          },
        }, t('a13c.subscribe', 'Subscribe'))))),
  };
}

/** The quantities, in the two units they are counted in — hectares for ground,
    heads for trees. A bare "220 trees" beside "12.4 ha" left the reader to
    guess which of the two the subscription was counted in; it is both. */
function quantityLine(totals) {
  return [
    totals.cropHa ? area(totals.cropHa) : null,
    totals.treeCount ? t('a13.treesqty', '{n} date palms and fruit trees', { n: num(totals.treeCount) }) : null,
  ].filter(Boolean).join(' · ');
}

/* -- A19 · You're ready, WF4.112 ------------------------------------------ */

/* TWO ROUTES ARRIVE HERE NOW, and they differ in one thing: whether the farm
   record already exists. The survey route made it on A13, because the survey
   had to have something to run against; the drawn route is still carrying its
   plots in the signup draft and they become a farm when this screen is left.
   Everything the farmer sees is the same either way. */
export function A19(farmId) {
  const d = draft();
  const made = farmId ? farmById(farmId) : null;
  // The farm was named on A10, or numbered for the farmer who left the field
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
        variant: 'primary',
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
          go('A10', { replace: true });
        },
      }),
      h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('a14.trial', 'Trial: 30 days remaining'))),
  };
}

/** Turn the finished draft into a farm record and clear it.

    `existing` is the farm A13 already made on the survey route. There is
    nothing left to create there — the record has been carrying the survey since
    the boundary was drawn — so the draft is simply cleared. */
function finishFarm(d, farmName, existing = null) {
  if (existing) { resetLocal('signup'); return; }
  addFarm({
    name: farmName,
    type: d.farmType ?? 'crops',
    areaHa: d.areaHa,
    // Review 22/08 — only the plots the farmer kept on A16. A removed plot is
    // off the quote, so it must not arrive as a plot record he is looking at.
    plots: (d.plots ?? []).filter((p) => p.included !== false),
  });
  resetLocal('signup');
}

/* -- A21 · Join a farm, WF4.113 … WF4.117 ---------------------------------
   Redeeming a code is an ATTACHMENT, not a registration. The owner already made
   a record for this person — that is what the code is bound to — so joining
   walks up to a record that has their language, their notification preferences
   and everything they have already finished on it, and puts an account on the
   front of it. Nothing is carried across because nothing moves.

   THIS SCREEN IS THE REMOTE ROUTE, AND ONLY THAT, SINCE REVIEW 21/09.

   It used to carry both ways in — six digits typed, or a QR code scanned — and
   that is what made it confusing: "it mixes both options on one screen, and if
   I scan a QR code I shouldn't need to see all these extra screens, it should
   go straight to registration." The two routes are not alternatives to each
   other, they are answers to different situations, and Mark drew the line
   where the people are standing:

     "If I'm sending an invite to someone remote, that's a six-digit code;
      face-to-face, sitting next to each other, that's a QR code."

   So: a guest who reaches this screen typed his way here, off "Join a farm as
   a guest" on A8, holding a number somebody sent him. A guest who was handed a
   QR code never sees it — scanning deep-links into the app already carrying the
   farm. The QR button and the "no invitation code?" line both went, because
   both existed to bridge between the two routes, and there is no bridge to
   build: the owner making the invite on B10 chooses which one he is sending.

   WHAT IT ASKS FOR is a first name, a last name and a number — review 21/09,
   replacing one free-text "Your name" — and the number is what the code goes
   to, so the dock sends a code rather than joining outright. The email went
   with the password: "Email not needed." */

export function A21() {
  const d = local('join', { code: '', error: null, firstName: '', lastName: '', phone: '' });

  const setCode = (next) => {
    d.code = next;
    d.error = null;
    commit('a15');
  };

  const join = () => {
    // WF4.116 — a used, expired or revoked invitation says so clearly, and
    // never grants partial access.
    const name = [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ');
    const invite = redeemFarmInvitation(d.code, { email: 'co-owner@example.com', name: name || 'New co-owner' });
    if (!invite) { d.error = 'expired'; commit('a15'); return; }
    resetLocal('join');
    enterApp(invite.role);
    toast(t('a15.joined', 'You joined the farm as a co-owner'));
  };

  return {
    tabs: false,
    // Review 22/08 — "as a guest". Redeeming a code never makes anyone an
    // owner, and the title is where that is cheapest to say.
    top: appBar({ title: t('a15.title', 'Join a farm as a guest'), onBack: () => go('A20', { replace: true }) }),
    body: page(
      // Review 22/08 — the reviewer's sentence. It names both ways in and says
      // who the code came from, which is what somebody holding a six-digit
      // number and no context actually needs.
      /* Review 21/09 rewrote this line. It used to name both ways in — "enter
         the invitation code or scan the QR code on the phone of the person who
         set up this account" — which is the sentence that made the screen read
         as a choice. It names one way in now, and says what to do if you have
         not got a code, which is the only other thing a stranger on this screen
         can be thinking. */
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('a15.enter', 'Enter the invitation code. If you do not have one, ask the account owner to send you one.')),
      codeCells(d.code, 6, { onValue: setCode }),

      /* Review 21/09 — "We should ask for: First name / Last name / Phone
         number." Stacked, for the same reason A8's are: an Arabic name does
         not fit in half a phone. The number is not idle detail here — it is
         where the code from the dock button goes. */
      field(t('a15.firstname', 'First name'), input({
        value: d.firstName, autocomplete: 'given-name', name: 'joinfirst',
        oninput: (e) => { d.firstName = e.target.value; },
        onchange: () => commit('a15'),
      }), { required: true }),
      field(t('a15.lastname', 'Last name'), input({
        value: d.lastName, autocomplete: 'family-name', name: 'joinlast',
        oninput: (e) => { d.lastName = e.target.value; },
        onchange: () => commit('a15'),
      }), { required: true }),
      field(t('a15.phone', 'Mobile number'), input({
        type: 'tel', inputmode: 'tel', autocomplete: 'tel', name: 'joinphone',
        placeholder: '5X XXX XXXX', value: d.phone,
        oninput: (e) => { d.phone = e.target.value; },
        onchange: () => commit('a15'),
      }), { required: true, hint: t('a5.mobile.hint', 'A verification code will be sent to this number.') }),

      when(d.error === 'expired', () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        disclaimer(t('a15.expired', 'That invitation has already been used or has expired. Invitations last 7 days and work once.'), true),
        btn(t('a15.contactowner', 'Contact the farm owner'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0, textAlign: 'center' } },
        t('a15.mockhint', 'Mockup: any 6 digits join as the farm’s Supervisor. Type 000000 to see the expired-invitation message.'))),
    // Review 21/09 — "Replace with 'Send code by SMS' button", and Mark pasted
    // A8's own button over the Join button to say which one he meant. A guest
    // proves a number the same way an owner does.
    dock: actionDock(btn(t('a5.send', 'Send code by SMS'), {
      variant: 'primary',
      disabled: d.code.length < 6
        || !d.firstName.trim() || !d.lastName.trim()
        || d.phone.replace(/\D/g, '').length < 6,
      onclick: join,
    })),
  };
}
