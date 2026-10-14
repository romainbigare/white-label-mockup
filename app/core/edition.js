/* ---------------------------------------------------------------------------
   edition.js — which version of the mockup this page is.

   One set of files, two front doors. The page itself says which edition it is,
   on <html data-edition>, before any module runs:

     full   index.html — the whole mockup, first run included. What reviewers
            and the handover read.
     expo   expo/index.html — the exhibition demo. It opens already signed in as
            the sample owner, in Arabic, on the farm. The first-run series (the
            A screens: welcome, tour, sign-up, log in, add a farm, survey,
            plans, payment) does not exist in it: the router refuses every A
            route (reachable() in router.js), and the few in-app doors that
            lead into that series are hidden rather than left to do nothing.

   expo/index.html is GENERATED from index.html by tools/editions.mjs, so the
   two pages cannot drift apart; edit index.html and re-run it.

   Read from the document rather than the URL so that the Node tools, which
   import modules without a document, simply get the full edition.
   --------------------------------------------------------------------------- */

const EDITIONS = {
  full: { id: 'full', firstRun: true, lang: null },
  // Arabic first: the exhibition is in Saudi Arabia. The language can still be
  // changed in Settings and in the mockup controls.
  expo: { id: 'expo', firstRun: false, lang: 'ar' },
};

export const EDITION = EDITIONS[globalThis.document?.documentElement.dataset.edition] ?? EDITIONS.full;
