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
export const MOCKUP_VERSION = '1.5.5';

/* TWO ROUNDS, TWO NUMBERS, AND THE SPEC MOVED FOR BOTH.

   v1.5 was the requirement set as four rounds of review had amended it, and
   every one of those rounds moved screens rather than rules. The call on v1.5.2
   did the opposite, and the comments on v1.5.4 went further in the same
   direction, so the specification is at v1.7 and the build at v1.5.5.

   THE CALL (mockup 1.5.4, spec 1.6)

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
       hand-drawn boundary.
     * A NEW RULE: when the satellite sees a field harvested it cannot name what
       replaced it for about three weeks, so the app asks.

   THE COMMENTS ON IT (mockup 1.5.5, spec 1.7)

     * THE APP HAS ONE HOME SCREEN. B1 is deleted: a list of farms is a picker,
       and a picker belongs in the app bar. WF5.001…WF5.011 collapse onto B2,
       and the ones that only ever described the list — the four-state summary
       bar, the by-farm/all-plots toggle — are withdrawn with it.
     * THE MAP IS THE ONLY FULL-SCREEN READING. B7 and B8 are deleted: both were
       the map rebuilt at plot scope and reachable from nowhere else, so
       WF5.029…WF5.033 are satisfied on C1 and C4 and B4 hands the plot over.
     * TREE ANALYTICS ARE SCOPED TO A GROUP, not to a farm. B9 becomes B13, and
       WF5.041…WF5.061 are read against the group the farmer pressed rather than
       against every tree he owns.
     * FIELD CAPTURE IS WITHDRAWN. WF5.154…WF5.159 and WF6.028 described a
       photograph, a category and a severity that nothing in the app ever read
       back. E6 and E7 go, and so does the write path behind them.
     * THE COVERAGE QUESTION IS ASKED ONCE, on A9, before the fork — and the
       fork itself is offered to field crops alone (WF4.052 gains that
       condition). A12 stops asking and explains instead: WF4.047…WF4.050 are
       satisfied by what it now says the survey will do.
     * NO SCREEN NAMES ANOTHER SCREEN. The build had begun annotating buttons
       with where they land — "(D1)" — for the benefit of a printed deck. Those
       belong on the deck, drawn as arrows, and not in an app a farmer uses.

   The requirement identifiers throughout are still v1.2's, for the reason given
   in the README under Deviations. */
export const SPEC_VERSION = '1.7';
