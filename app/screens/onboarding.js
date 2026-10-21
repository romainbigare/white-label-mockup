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
import { t, tc, lower, langMeta, upper } from '../core/i18n.js';
import { formsTreeGroup, MIN_GROUP_TREES } from '../core/trees.js';
import { go, back, enterApp, openModal, openSheet, reachable } from '../core/router.js';
import { asset } from '../core/site.js';
import { icon } from '../ui/icons.js';
import { logo, BRAND } from '../ui/brand.js';
import {
  appBar, page, section, card, cardPad, btn, actionDock,
  field, input, select, checkbox, disclaimer, req, kv, chips, helpBlock,
  mapBand, mapTool, languageChoice, row, segmented, radioList, deckMark,
} from '../ui/components.js';
import { area, priceBare, priceRange, num, toHectares } from '../core/format.js';
import {
  boundaryCanvas, circleCanvas, circleRing, drawnFieldsLayer, undoVertex, starterPolygon, editorFrame, PLOT_SCALE,
} from '../ui/boundaryEditor.js';
import { mapSvg } from '../ui/map.js';
import { addFarm, addFieldsToFarm, confirmCount, redeemFarmInvitation, TREES_PER_HA } from '../data/actions.js';
import { farmById, rawFarm, visibleFarms, me, plotsOf, smallTreesOf, farmTotals } from '../data/selectors.js';

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
      h('img.tourart__photo', { src: asset(`app/imgs/tour/${c.src}`), alt: c.alt ? t(`a4.${c.id}.alt`, c.alt) : '' }));
  }
  if (c.art === 'shots') {
    // Two screens, side by side, each in the light border the review asked for.
    return h('div.tourart.tourart--bleed', { style: { gap: '12px' } },
      c.shots.map((id) => h('img.tourart__shot', {
        src: asset(`app/imgs/tour/${id}.png`),
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

/** The switch, and the country default that makes it a correction not a
    question.

    A TOGGLE IN A BOX, NOT TWO CHIPS — review 22/09, third pass: "make the
    choice hectare / dunum into one box that takes the same width and height as
    the text box above, and a toggle between hectare and dunum. Slight corner
    radius."

    Two pills floating under their label, directly beneath a full-width bordered
    text field, made two consecutive questions on a four-question form look like
    two different kinds of question. They are the same kind: both are things the
    farmer states about his farm before anything is priced. `.segmented--field`
    is the segmented control wearing .input's box — see the note on it. */
function unitField(d) {
  const detected = DUNUM_COUNTRIES.includes(d.country) ? 'dunum' : 'hectare';
  const chosen = d.areaUnit ?? detected;
  if (state.session.areaUnit !== chosen) state.session.areaUnit = chosen;
  return field(t('a9.unit', 'How do you measure land?'),
    segmented(AREA_UNITS.map((u) => ({ id: u.id, label: t(`unit.${u.id}.name`, u.label) })), chosen,
      (id) => { d.areaUnit = id; state.session.areaUnit = id; commit('a9'); },
      { size: 'field' }),
    // Review 21/08 — the country note has gone. The right half is already lit
    // and Settings is where anything gets changed, so the sentence spent two
    // lines telling the farmer that a right answer was a right answer.
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

/* Both walks end in the first-run series — adding a farm starts on A10, and
   a drawn plot is priced on A16 — so an edition without that series (the
   exhibition one, see core/edition.js) offers neither. The doors ask here
   rather than knowing where the walks lead. */
export const canAddFarm = () => reachable('A10');
export const canDrawPlot = () => reachable('B9');

/**
 * Adding FIELDS to a farm that already exists (B11's "Add fields", or an empty
 * farm's own button): the same drawing screen as sign-up, with the fields
 * added to this farm rather than made into a new one.
 */
export function startDrawPlot(farmId) {
  resetLocal('signup');
  const d = draft();
  d.inApp = true;
  d.addTo = farmId;
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

      /* THE THIRD QUESTION, ASKED OUT LOUD — review 22/09, third pass: "also
         ask a third question: 'what do you grow on this farm?' before the input
         for total area and tree count."

         The two cards below have always BEEN the answer to it — filling in one,
         the other, or both is what says what is grown — but the question itself
         was never on the screen, so a form that asks two things in words went on
         to ask a third in pictures only. It is one label, marked required like
         the two above it, and the cards are what answers it. */
      h('div.field',
        h('label.field__label',
          h('span', t('a9.grow', 'What do you grow on this farm?')),
          h('span.req', ' *'))),

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
          go(farmTooSmall(d) ? 'A22' : 'A11');
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

/* -- A22 · Too small for a survey -------------------------------------------

   NEW AT v1.7.3. There was no screen saying "sorry, your farm is too small":
   a farmer with four trees and a vegetable patch was quoted, sent to draw a
   boundary, and surveyed. Now the two numbers on A10 are checked first, and a
   holding below both limits lands here instead of on the price.

   THE LIMITS ARE A PLACEHOLDER. Nobody at the October review said what "too
   small" is in numbers; what was said is that a 20-tree farm CAN be surveyed
   (and is billed as 100 trees, the minimum — see billedTrees()). So this
   stops a holding with fewer than 20 trees AND less than half a hectare of
   field crops, and the numbers are here, in one place, to be replaced.

   Coded A22, at the end of the A series, so that no other screen had to be
   renumbered to make room for it. */
const TOO_SMALL = { trees: 20, cropHa: 0.5 };

function farmTooSmall(d) {
  const unit = d.areaUnit ?? (DUNUM_COUNTRIES.includes(d.country) ? 'dunum' : 'hectare');
  const cropHa = toHectares(Number(d.roughArea) || 0, unit);
  const trees = Number(d.roughTrees) || 0;
  return trees < TOO_SMALL.trees && cropHa < TOO_SMALL.cropHa;
}

export function A22() {
  return {
    tabs: false,
    top: appBar({ title: t('a22.title', 'Too small for a survey'), onBack: () => go('A10', { replace: true }) }),
    body: page({ class: 'page--fill' },
      h('div', { style: { display: 'grid', placeItems: 'center', padding: '18px 0 4px', color: 'var(--ink-500)' } }, icon('ruler', 44)),
      h('p', { style: { margin: 0, fontSize: 'var(--t-lead)', fontWeight: 650, color: 'var(--ink-800)' } },
        t('a22.lead', 'Sorry, your farm or your tree count is too small for a survey.')),
      h('p', { style: { margin: 0, color: 'var(--ink-700)' } },
        t('a22.body', 'We can survey farms from {trees} trees, or from {area} of field crops. If you have more than you told us, change your numbers. If you are not sure, talk to us.', {
          trees: num(TOO_SMALL.trees), area: area(TOO_SMALL.cropHa),
        })),
      h('div', { style: { flex: '1 1 auto', minHeight: 'var(--sp-4)' } }),
      h('span', { style: { display: 'block', height: '1px', background: 'var(--ink-200)' } }),
      helpBlock({ prominent: false })),
    dock: actionDock(btn(t('a22.change', 'Change my numbers'), {
      variant: 'primary',
      onclick: () => go('A10', { replace: true }),
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
        t('a9e.basis2', 'Estimated cost based on {what}. We will give you a final quote once you draw your fields and we count your trees.',
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
          // v1.7.4 — the steps of the new way in: the farmer draws his
          // fields, the price is confirmed, and only the trees are counted.
          explainRow('polygon', t('a9e.next.draw', 'You find your farm and draw your fields')),
          explainRow('sprout', t('a9e.next.crop', 'You tell us what grows in each one')),
          explainRow('check', t('a9e.next4', 'You select the service plan you want')),
          explainRow('tree', t('a9e.next.count', 'We count your trees and confirm the price'))))),

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

/* -- A13 · Find your farm and draw your fields, and B9 · Add fields ---------

   v1.7.4 REBUILT HOW A FARMER TELLS US WHAT HE HAS. There used to be two
   ways: draw one line round the whole farm and let the satellite survey find
   the plots and trees inside it (A13 locate, A14 boundary, A15 survey running,
   A16 survey results), or draw every plot by hand (B9). The review kept the
   second and made it the only one:

     * ONE SCREEN TO FIND THE FARM AND DRAW ON IT. Search for the farm, or
       browse the map to it — then draw, on the same map. The separate
       locating screen and the farm-boundary screen are gone.
     * EVERY FIELD IS DRAWN BY THE FARMER, with one of two tools: a polygon,
       corner by corner, or a circle — press the middle of a centre-pivot
       field, then drag the handle on its edge to size it.
     * EACH FIELD SAYS WHAT GROWS IN IT, picked from the list of crops — or
       "Date palms and fruit trees", in which case we count the trees in it.
       That count is the only survey left: it runs on the tree fields after
       the plan is confirmed, and the price is confirmed again when it is in.
     * TREES ARE GROUPED BY THE FIELD THEY ARE DRAWN IN, not by species: a
       tree field is a plot like any other.

   ONE SCREEN, TWO WAYS IN. During sign-up (A13) the fields become a new farm
   once the plan is paid for; from Farm settings' "Add a field" (B9) they are
   added to the farm the farmer is on. The drawing is the same. */

/** The automatic name a new farm arrives with, and can leave behind at will.

    It counts the farms the ACCOUNT holds. During registration that is none,
    whatever the demo database is carrying, so the first farm anyone names is
    offered "Farm 1" rather than "Farm 7" — a number out of somebody else's
    sequence is the one thing a placeholder must never be. */
export function autoFarmName() {
  const held = draft().inApp ? state.db.farms.length : 0;
  return t('farm.auto', 'Farm {n}', { n: num(held + 1) });
}

export function A13() { return fieldDrawing(); }
export function B9() { return fieldDrawing({ addTo: draft().addTo ?? null }); }

/* What the farmer is told while he draws: one line, on the map, at a size
   nobody can miss — the place review 21/09 asked the instruction to be. */
function drawHint(d) {
  const words = d.tool === 'circle'
    ? (d.circle
      ? t('draw.circle.size', 'Drag the white handle to set the size. Drag the centre to move the field.')
      : t('draw.circle.centre', 'Tap the middle of the round field.'))
    : t('draw.polygon', 'Tap each corner of the field. Drag a corner to move it.');
  return h('div.drawhint', icon(d.tool === 'circle' ? 'circleField' : 'polygon', 18), h('span', words));
}

/* THE TWO TOOLS, small and bare on the left of the map (v1.7.4): a polygon
   for an ordinary field and a circle for a centre-pivot one. Their glyphs
   are drawn to say which is which (tools/build-icons.mjs), their names are on
   them for a screen reader and a long press, and the drawer under the map
   says what they do until the first field is drawn. The tool in use is lit;
   while drawing a polygon, Undo sits under them. */
function drawTools(d) {
  const start = (tool) => {
    d.tool = tool;
    d.circle = null;
    d.selectedVertex = null;
    d.points = tool === 'polygon' ? starterPolygon({ scale: PLOT_SCALE, index: d.plots.length }) : [];
    commit('draw');
  };
  return h('div.maptools.drawtools',
    mapTool('polygon', t('draw.tool.polygon', 'Draw a field'), () => start('polygon'),
      { on: d.tool === 'polygon', deckNote: 'Adds a field to draw corner by corner' }),
    mapTool('circleField', t('draw.tool.circle', 'Round field'), () => start('circle'),
      { on: d.tool === 'circle', deckNote: 'Adds a round field: tap its centre, drag its edge' }),
    when(d.tool === 'polygon', () => mapTool('undo', t('action.undo', 'Undo'),
      () => undoVertex(d.points), { disabled: !d.points.length })));
}

/** What grows in a field, in a few words: its crop, or the trees we count. */
export function fieldWhat(f) {
  if (f.kind === 'trees') return t('field.trees.short', 'Date palms and fruit trees');
  if (f.kind === 'crops' && f.cropName) return tc(`crop.${f.cropName}`, f.cropName);
  return null;
}

function fieldDrawing({ addTo = null } = {}) {
  const d = draft();
  const target = addTo ? farmById(addTo) : null;
  // The map frames the ground the fields are drawn on: the farm being added
  // to, or — during sign-up, before there is a farm — the place the map
  // opens on (see editorFrame()).
  const frame = editorFrame(target ? rawFarm(addTo) : undefined);
  const drawing = d.tool === 'polygon' || d.tool === 'circle';

  const editor = d.tool === 'polygon'
    ? boundaryCanvas({
      points: d.points, selected: d.selectedVertex, frame,
      onChange: ({ selected }) => { d.selectedVertex = selected; commit('draw'); },
    })
    : d.tool === 'circle'
      ? circleCanvas({ circle: d.circle, frame, onChange: ({ circle }) => { d.circle = circle; commit('draw'); } })
      : null;
  const valid = d.tool === 'polygon' ? d.points.length >= 3 && !editor.invalid : d.tool === 'circle' ? !!d.circle : false;

  const finish = () => {
    const ring = d.tool === 'circle' ? circleRing(d.circle.c, d.circle.r) : d.points.map((p) => [...p]);
    const offset = target ? plotsOf(addTo).length : 0;
    d.plots.push({
      id: `draft-${Date.now().toString(36)}-${d.plots.length}`,
      name: t('a9d.counter', 'Plot {n}', { n: num(offset + d.plots.length + 1) }),
      shape: d.tool,
      points: ring,
      ...(d.tool === 'circle' ? { centre: [...d.circle.c], radius: d.circle.r } : {}),
      areaHa: Math.round(editor.areaHa * 10) / 10,
      kind: null, cropId: null, cropName: null, included: true,
    });
    d.tool = null; d.points = []; d.circle = null; d.selectedVertex = null;
    d.drawerOpen = true;
    commit('draw');
    // What grows in it, asked the moment it is drawn.
    openSheet('FIELD_CROP', { index: d.plots.length - 1 });
  };
  const cancel = () => { d.tool = null; d.points = []; d.circle = null; commit('draw'); };

  const unanswered = d.plots.findIndex((f) => !f.kind);
  const proceed = () => {
    if (unanswered >= 0) { openSheet('FIELD_CROP', { index: unanswered }); return; }
    if (target) {
      const added = addFieldsToFarm(addTo, d.plots);
      resetLocal('signup');
      toast(t('draw.added', '{n} fields added to {farm}', { n: num(added), farm: target.name }));
      back();
      return;
    }
    d.areaHa = Math.round(d.plots.reduce((s, f) => s + f.areaHa, 0) * 10) / 10;
    commit('draw');
    go('A16');
  };

  const farmName = target?.name ?? ((d.farmName || '').trim() || autoFarmName());
  const onBack = target ? back : () => go('A11');

  /* THE MAP IS THE SCREEN (v1.7.4). No app bar: the way back and the search
     float at the top, the two tools on the left, and the fields drawn so far
     are in a drawer at the bottom with the button that moves on. While a
     field is being drawn the search gives way to the instruction, and the
     drawer to Cancel and Done. */
  return {
    tabs: false,
    body: h('div.drawscreen',
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        // Adding to a farm, its fields are on the map already, so nothing is drawn twice.
        mapSvg({ plots: target ? plotsOf(addTo) : [], measure: null, basemap: 'satellite', imageryOf: target?.id ?? 'farm-1', cover: frame }),
        drawnFieldsLayer(d.plots, {
          frame,
          onTap: drawing ? null : (i) => openSheet('FIELD_CROP', { index: i }),
        }),
        editor?.node),
      // What floats on the map, top to bottom: the bar, the tools — centred
      // in the map left between the bar and the drawer — and the drawer.
      h('div.drawscreen__ui',
        h('div.drawscreen__top',
          h('button.mapchip.mapchip--round', {
            type: 'button', onclick: onBack,
            'aria-label': t('a11y.back', 'Back'), title: t('a11y.back', 'Back'),
          }, icon('back', 22, 'flip')),
          drawing ? drawHint(d) : placeSearch(d, t('draw.search', 'Find your farm'), { floating: false })),
        h('div.drawscreen__side', drawTools(d)),
        fieldDrawer(d, {
        title: target ? t('draw.add.title', 'Add fields') : t('draw.title', 'Draw your fields'),
        farmName, drawing, editor, valid, finish, cancel,
        proceed: btn(target ? t('draw.add.save', 'Add these fields') : t('a10d.continuequote', 'Continue to quote'), {
          variant: 'primary', disabled: !d.plots.length, onclick: proceed,
          deckTo: target ? null : 'A16',
        }),
      }))),
  };
}

/* THE DRAWER: the screen's title and the farm, the fields drawn so far, and
   the button that moves on. Its handle folds the list away to give the map
   the room; it opens again when a field is added. While a field is being
   drawn it holds only Cancel and Done. */
function fieldDrawer(d, { title, farmName, drawing, editor, valid, finish, cancel, proceed }) {
  if (drawing) {
    return h('div.drawer',
      when(editor?.invalid, () => disclaimer(
        t('a9d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
      h('div.drawer__pair',
        btn(t('action.cancel', 'Cancel'), { variant: 'secondary', block: false, onclick: cancel }),
        btn(t('draw.done', 'Done'), { variant: 'primary', block: false, disabled: !valid, onclick: finish })));
  }
  const open = d.drawerOpen !== false;
  const toggle = () => { d.drawerOpen = !open; commit('draw'); };
  return h(`div.drawer${open ? '' : '.drawer--folded'}`,
    h('button.drawer__head', {
      type: 'button', onclick: toggle, 'aria-expanded': String(open), title: t('draw.list', 'Your fields'),
      ...deckMark({ deckNote: 'Folds the list of fields away, and opens it again' }),
    },
    h('span.drawer__grip'),
    h('span.drawer__titles',
      h('span.drawer__title', title),
      h('span.drawer__sub', d.plots.length
        ? `${farmName} · ${d.plots.length === 1 ? t('draw.count.one', '1 field') : t('draw.count', '{n} fields', { n: num(d.plots.length) })}`
        : farmName)),
    icon(open ? 'chevronDown' : 'chevronUp', 20)),
    when(open, () => (d.plots.length
      ? card({ class: 'drawer__list' }, d.plots.map((f, i) => {
        const what = fieldWhat(f);
        return h('div.row', { style: { minHeight: '52px' } },
          h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(f.shape === 'circle' ? 'circleField' : 'polygon', 20)),
          h('button.row__main', {
            type: 'button', onclick: () => openSheet('FIELD_CROP', { index: i }),
            style: { textAlign: 'start', background: 'none', border: 0, padding: 0, cursor: 'pointer' },
          },
          h('div.row__title', f.name),
          h('div.row__sub', what
            ? `${what} · ${area(f.areaHa)}`
            : h('span', { style: { color: 'var(--st-urgent)', fontWeight: 650 } }, t('draw.pick', 'Tell us what grows here')))),
          h('button.iconbtn.iconbtn--bare', {
            type: 'button',
            'aria-label': t('a9d.removeplot', 'Remove {name}', { name: f.name }),
            title: t('a9d.removeplot', 'Remove {name}', { name: f.name }),
            onclick: () => { d.plots.splice(i, 1); commit('draw'); },
          }, icon('trash', 20)));
      }))
      // Before the first field: what the two bare tools are for.
      : h('div.drawer__empty',
        h('p', t('draw.empty3', 'Find your farm, then draw each of your fields with these two tools:')),
        h('div.drawer__key', icon('polygon', 18), h('span', t('draw.key.polygon', 'A field of any shape'))),
        h('div.drawer__key', icon('circleField', 18), h('span', t('draw.key.circle', 'A round field')))))),
    proceed);
}


/* -- A16 · Your fields -------------------------------------------------------

   THE LIST TO APPROVE, IN TWO SITTINGS, since v1.7.4.

     First, straight after drawing: every field the farmer drew, with what
     grows in it and its size, over the map he drew them on — keep, change or
     take off the quote — and a total to price. The tree fields are not
     counted yet; they are priced on an estimate, and the line says so.

     Then, when the trees are counted (A16 with a farm id): the same fields,
     now with the number of trees found in each, the soil our survey read,
     and the price to confirm again on A17. A tree field with fewer than forty
     trees is counted and said to be too few for advice (core/trees.js).

   It is the screen the review calls the survey results, and the only part of
   the old survey that is left is the tree count in it. */
export function A16(farmId) {
  return farmId ? countedFields(farmId) : drawnFields();
}

function fieldsMap(fields, frame, imageryOf) {
  return mapBand(
    mapSvg({ plots: [], measure: null, basemap: 'satellite', imageryOf, cover: frame }),
    drawnFieldsLayer(fields, { frame }));
}

function drawnFields() {
  const d = draft();
  const fields = d.plots ?? [];
  const kept = fields.filter((f) => f.included !== false);
  const round1 = (n) => Math.round(n * 10) / 10;
  const cropHa = round1(kept.filter((f) => f.kind !== 'trees').reduce((s, f) => s + f.areaHa, 0));
  const treeHa = round1(kept.filter((f) => f.kind === 'trees').reduce((s, f) => s + f.areaHa, 0));
  const farmName = (d.farmName || '').trim() || autoFarmName();

  return {
    tabs: false,
    top: appBar({ title: farmName, subtitle: t('a16.title', 'Your fields'), onBack: () => go('A13') }),
    body: [
      fieldsMap(fields, editorFrame(), 'farm-1'),
      page(
        h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
          t('a16.lead', 'You drew {n} fields. Check them before we work out your price.', { n: num(fields.length) })),
        card({}, fields.map((f, i) => fieldRow(f, {
          onKeep: () => { f.included = true; commit('a16'); },
          onEdit: () => openSheet('FIELD_CROP', { index: i }),
          onRemove: () => { f.included = false; commit('a16'); },
        }))),
        btn(t('a16.addfield', 'Draw another field'), { variant: 'secondary', icon: 'plus', onclick: () => go('A13') }),
        card({}, cardPad(
          h('div', { style: { fontWeight: 650 } }, t('a11.scope2', 'What we will monitor')),
          kv([
            [t('a11.croparea', 'Field crops'), area(cropHa)],
            [t('a16.treefields', 'Tree fields'), treeHa
              ? t('a16.treeest', '{area}, about {n} trees', { area: area(treeHa), n: num(Math.round(treeHa * TREES_PER_HA)) })
              : area(0)],
          ]),
          when(treeHa, () => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('a16.treenote', 'We count the trees in your tree fields after you subscribe, and confirm the price when the count is in.'))),
          btn(t('a16.toprice', 'See your price'), {
            variant: 'primary',
            disabled: !kept.length,
            onclick: () => {
              d.areaHa = round1(cropHa + treeHa);
              d.farmType = cropHa && treeHa ? 'mixed' : treeHa ? 'trees' : 'crops';
              commit('a16');
              go('A17');
            },
          }))),
        req('WF4.081')),
    ],
  };
}

/* The second sitting: the trees are counted. Read off the farm's own plots. */
function countedFields(farmId) {
  const farm = farmById(farmId);
  const raw = rawFarm(farmId);
  const fields = [...plotsOf(farmId), ...smallTreesOf(farmId)]
    .sort((a, b) => a.shortName.localeCompare(b.shortName, undefined, { numeric: true }));
  const totals = farmTotals(farmId);

  return {
    tabs: false,
    top: appBar({ title: farm.name, subtitle: t('a16.counted.title', 'Your trees are counted') }),
    body: [
      mapBand(mapSvg({ plots: fields, measure: null, basemap: 'satellite', layers: { labels: true } })),
      page(
        h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
          t('a16.counted.lead', 'We counted the trees in your tree fields. Check the numbers, then confirm your plan.')),
        card({}, fields.map((p) => h('div.row',
          h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(p.kind === 'trees' ? 'tree' : 'sprout', 20)),
          h('div.row__main',
            h('div.row__title', p.shortName),
            h('div.row__sub', p.kind === 'trees'
              ? [p.cropName, t('farm.treecount', '{n} trees', { n: num(p.treeCount ?? 0) }),
                formsTreeGroup(p.treeCount) ? null : t('a16.toofew', 'too few for advice')].filter(Boolean).join(' · ')
              : `${p.cropName} · ${area(p.areaHa)}`))))),
        soilQuestion(farmId),
        card({}, cardPad(
          h('div', { style: { fontWeight: 650 } }, t('a11.scope2', 'What we will monitor')),
          kv([
            [t('a11.croparea', 'Field crops'), area(totals.cropHa)],
            [t('a16.treescounted', 'Trees counted'), t('farm.treecount', '{n} trees', { n: num(totals.treeCount) })],
          ]),
          when(reachable(`A17:${farmId}`), () => btn(t('a16.confirmplan', 'Confirm my plan'), {
            variant: 'primary', onclick: () => go(`A17:${farmId}`),
          })))),
        req('WF4.084')),
    ],
  };
}

/** A drawn field, as a row to keep, change or take off the quote. */
function fieldRow(f, { onKeep, onEdit, onRemove }) {
  const what = fieldWhat(f);
  return h('div.row', {
    style: { flexDirection: 'column', alignItems: 'stretch', gap: '2px', opacity: f.included === false ? 0.55 : 1 },
  },
  h('div.row__main',
    h('div.row__title', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
      h('span', { style: { color: f.kind === 'trees' ? '#2e8f66' : '#6f9a3c', display: 'flex' } },
        icon(f.kind === 'trees' ? 'tree' : 'sprout', 18)),
      h('span', f.name)),
    h('div.row__sub', [what ?? t('draw.pick', 'Tell us what grows here'), area(f.areaHa),
      f.kind === 'trees' ? t('a16.tocount', 'trees counted after you subscribe') : null].filter(Boolean).join(' · '))),
  h('div', { style: { display: 'flex', gap: '2px', justifyContent: 'flex-end' } },
    rowAction('check', t('a11.keep', 'Keep'), onKeep, { on: f.included !== false }),
    rowAction('edit', t('action.edit', 'Edit'), onEdit),
    rowAction('trash', t('a11.remove', 'Remove'), onRemove, { on: f.included === false })));
}

function rowAction(iconName, label, onclick, opts = {}) {
  return h('button.iconbtn.iconbtn--bare', {
    onclick, 'aria-label': label, title: label, type: 'button',
    style: opts.on ? { color: 'var(--brand-700)' } : { color: 'var(--ink-500)' },
  }, icon(iconName, 20), h('span.iconbtn__label', label));
}

/* THE SOIL, ASKED ONCE, ANSWERED WITHOUT TYPING (v1.7.4). MMC's reading of
   the ground makes a guess at the soil; this card says what it detected and
   offers three answers — yes, change it, I don't know. "Change it" opens the
   list of soil types to pick from. The answer is the farm's, and Farm
   settings (B11) is where it can be changed later. Whether MMC can send the
   soil type at this point is a question for them. */
function soilQuestion(farmId) {
  const raw = rawFarm(farmId);
  const s = raw.count ??= {};
  const ui = local(`a16-soil-${farmId}`, { picking: false });
  const answer = (value) => { s.soilAnswer = value; ui.picking = value === 'change'; commit('a11'); };
  const choice = (id, label) => btn(label, {
    variant: s.soilAnswer === id ? 'emphasis' : 'secondary', size: 'sm', block: false,
    onclick: () => answer(id),
  });
  return card({}, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('layers', 20)),
      h('span', { style: { fontWeight: 650 } },
        t('a16.soil', 'We detected {soil} soil', { soil: lower(tc(`soil.${raw.soil}`, raw.soil)) }))),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      choice('agree', t('a16.soil.agree', 'Yes, I agree')),
      choice('change', t('a16.soil.change', 'No, change it')),
      choice('unknown', t('a16.soil.unknown', 'I don’t know'))),
    when(ui.picking, () => radioList(
      state.db.soilTypes.map((v) => ({ id: v, label: tc(`soil.${v}`, v) })), raw.soil,
      (v) => { raw.soil = v; raw.soilSource = 'farmer'; ui.picking = false; commit('a11'); })),
    when(s.soilAnswer === 'unknown', () => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
      t('a16.soil.unknown.note', 'That is fine. We will use our reading, and you can change it later in Farm settings.')))));
}

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

/* TREES ARE BILLED IN BANDS, ROUNDED DOWN — the October review. The early
   idea was to round up to the next band; the last word was down, and Wafra
   takes the smaller margin: 125 trees is billed as 100, not 150. And nobody is
   billed for fewer than 100 trees: 0 to 99 is billed as 100, whatever the mix
   (80 date palms and 20 olives are 100 trees).

   The bands are "about a hundred" apart at the start, following MMC's own
   bands with more steps, and wider as the farm grows. They stand in for the
   document Romain is sending with the real bands and examples; like the
   rates above, the real ones belong on the server (WF4.102). */
export const TREE_BANDS = [100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000];
const BAND_STEP_ABOVE = 5000;

/** How many trees a count is billed as: the band at or below it, never under 100. */
export function billedTrees(count) {
  const n = Math.round(Number(count) || 0);
  if (n <= 0) return 0;
  const top = TREE_BANDS[TREE_BANDS.length - 1];
  if (n >= top) return Math.floor(n / BAND_STEP_ABOVE) * BAND_STEP_ABOVE;
  return [...TREE_BANDS].reverse().find((band) => band <= n) ?? TREE_BANDS[0];
}

/* Two levels, and neither is "the recommended one". Whatever the app pushes,
   the farmer has to work out why it is being pushed. */
const LEVELS = [
  { tier: 'basic', name: 'Basic' },
  // Review 22/09 — the supplier's own document names the upper tier Premium
  // ("MMC Professional = Wafra Premium"), and F6 prints that document. The id
  // stays `pro`: it keys the entitlement matrix, the plan strings and four
  // screens' worth of saved state, and none of that is farmer-facing.
  { tier: 'pro', name: 'Premium' },
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
  if (family !== 'crop' && totals.treeCount > 0) usd += billedTrees(totals.treeCount) * RATES.tree[tier];
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
        }, upper(t(`plan.${level.tier}`, level.name)))),

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

  /* THE ONE CASE WITH NOTHING TO SAY: a farm whose trees are still being
     counted. It has a record, so it is not an estimate any more, and no
     count, so the trees cannot be priced yet. Nothing routes here in this
     state; a hand-typed route can. */
  if (raw?.count?.state === 'counting') {
    return {
      tabs: false,
      top: appBar({ title: t('a13.surveying.title', 'Your plan'), subtitle: farm.name }),
      body: page(
        card({}, cardPad(
          h('div', { style: { fontWeight: 650 } }, t('a13.counting', 'We are still counting your trees')),
          h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
            t('a13.counting.body', 'We will show you how many we found, and what your plan costs, as soon as the count is in.'))))),
    };
  }

  const annual = period === 'year';
  // The farm's own fields and counted trees once there is a farm; before
  // that, the fields just drawn, with the trees estimated.
  const totals = raw ? farmTotals(farmId) : drawnTotals(d);
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

  /* THE FIELDS JUST DRAWN, and kept on A16: on a first run there is no farm
     record yet, and these become it when the plan is paid for. */
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
      // The tree fields start being counted the moment the farm exists.
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
    // The trees are counted and the farmer has seen the number: this press
    // confirms the plan at the price the count came to.
    confirmCount(farm.id);
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
          : t('a13.basis.counted', 'Priced on your fields and the trees we counted: {what}.', { what: quantityLine(totals) })),
      // Before the count, the trees are an estimate, and the screen says so.
      when(estimate && totals.treeCount > 0, () => h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('a13.treeestimate', 'Your tree fields are priced on an estimate. We count the trees after you subscribe and confirm the price then.'))),

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
              annual ? t('a13c.plan.year', 'Premium · Yearly') : t('a13c.plan.month', 'Premium · Monthly')))),
        line(t('a13c.free', 'Free Trial'), t('a13c.free.len', '30 days'), { first: false, strong: true }),
        line(t('a13c.then', 'Then'), annual
          ? `SAR ${num(10955)} / ${t('unit.year', 'year')}`
          : `SAR ${num(1074)} / ${t('unit.month', 'month')}`),
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
  const billed = billedTrees(totals.treeCount);
  return [
    totals.cropHa ? area(totals.cropHa) : null,
    totals.treeCount ? t('a13.treesqty', '{n} date palms and fruit trees', { n: num(totals.treeCount) }) : null,
    // The band, said out loud when it is not the count: the farmer sees the
    // trees he has and the trees he pays for, side by side.
    totals.treeCount && billed !== totals.treeCount
      ? t('a13.billedas', 'billed as {n} trees', { n: num(billed) }) : null,
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
      // The tree count runs from here, on the tree fields only.
      when(made && rawFarm(made.id).count?.state === 'counting', () => h('p', { style: { margin: 0, color: 'var(--ink-600)', maxWidth: '32ch' } },
        t('a14.counting', 'We are counting the trees in your tree fields. When the count is in, we will ask you to confirm your price.'))),
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
