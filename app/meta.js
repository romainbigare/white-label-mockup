/* ---------------------------------------------------------------------------
   meta.js — what this mockup is, in one place.

   Two versions, and they are not the same thing:

     MOCKUP_VERSION  this build of the mockup. It moves when the screens move —
                     a review round applied, a flow reordered — and it is what
                     anyone looking at the app or holding a printout of it is
                     talking about when they say "which version is this".
     SPEC_VERSION    the requirement set the mockup is built against. It moves
                     when the REQUIREMENTS do, which is not the same event: a
                     screen can be redrawn without a rule changing, and a rule
                     can change without a screen moving.

   The bar prints both, so a comment about a screen and a comment about a
   requirement can be told apart six weeks from now.

   NOTHING IS IMPORTED HERE ON PURPOSE. app/version.js is rewritten wholesale at
   deploy time and cannot hold anything hand-written; harness.js is full of DOM.
   A module with no dependencies can be read by the browser and by a Node tool
   alike, which is how tools/screendeck.mjs stamps the deck with the same
   version the app is showing.
   --------------------------------------------------------------------------- */

/** This build of the mockup. */
export const MOCKUP_VERSION = '1.5.1';

/* v1.2 of the specification plus the four rounds of review that amended it —
   the meeting review, and the comments on the 18, 21 and 22 August decks. The
   21 August round is what took it to 1.5: it did not just reword screens, it
   moved WF4.072 and WF4.073 from A10 to A12, read WF4.023 as a reset by
   registered number only, and reordered the path WF4.051 … WF4.057 describe.

   The 22 August round moves the mockup rather than the requirement set, which
   is why this stays at 1.5 while the build above goes to 1.5.1 — but it does
   read three rules differently, and they are worth naming: WF4.017's ban on a
   login form applied to a routing screen that no longer exists, WF4.024's
   biometric mention became an offer made once at registration rather than a
   notice on the login screen, and WF4.099's written-out sum came off A13
   because a farm priced per hectare AND per tree has no single rate to show. */
export const SPEC_VERSION = '1.5';
