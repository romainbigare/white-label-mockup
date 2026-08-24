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
export const MOCKUP_VERSION = '1.5.4';

/* THE SPEC MOVED THIS TIME, WHICH IS WHY THIS NUMBER DID.

   v1.5 was the requirement set as four rounds of review had amended it, and
   every one of those rounds moved screens rather than rules. The call on
   v1.5.2 did the opposite: it deleted two whole concepts and changed a third,
   and no amount of redrawing would have implemented it.

     * TASK MANAGEMENT IS GONE. §5.9 in its entirety — the task list, the task
       record, assignment, completion — along with WF3.004's task badge. An
       advice is the unit of work; sending it to the supervisor is a state on
       the advice (`sentAt`), and it stays open until somebody records what was
       done or the owner ignores it. WF5.099's "pre-packaged as a task" now
       means pre-packaged as a message.
     * THE WORKFORCE IS GONE. §5.6 — worker records, per-worker languages,
       delivery channels, invitations to workers — and with it the worker ROLE,
       which had nothing left to do. Two roles ship: owner and supervisor.
       WF8.005's worker management and WF5.063…WF5.070 go with the screens.
     * TREES ARE NOT PLOTS. A tree group is one record per species per farm,
       standing on several parcels of ground, with no crop cycle and no
       hand-drawn boundary — the trees are counted individually from the
       imagery, and the count is what the price is worked out from. So the fork
       on A9 asks what is growing BEFORE it offers a route, and a farm with
       trees only ever gets the survey (WF4.052 gains that condition, WF5.049
       is generalised from "add farm" to "every route in").
     * A NEW RULE, and the one Mark asked for by name: when the satellite sees a
       field harvested it cannot name what replaced it for about three weeks, so
       the app asks. The plot carries the date the clearance was seen, says so
       in red on the list and on the plot, and offers the crop picker.

   Three smaller amendments in the same round: attention counts are URGENT only
   (WF5.001, WF5.003, WF5.012 — planned and monitor are always present and
   calling them out taught the farmer to read nothing); farm-level health is
   withdrawn (WF5.016 — plant health, water stress and nutrition are per crop,
   and an average across crops is not a reading); and B2 absorbs B3, so
   WF5.018…WF5.021 are satisfied on the farm screen rather than one tap in.

   The requirement identifiers throughout are still v1.2's, for the reason given
   in the README under Deviations. */
export const SPEC_VERSION = '1.6';
