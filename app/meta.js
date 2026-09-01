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
export const MOCKUP_VERSION = '1.5.6';

/* ONE BUILD NUMBER, FOUR ROUNDS OF COMMENT, AND A SPEC THAT MOVED TWICE.

   v1.5 was the requirement set as four rounds of review had amended it, and
   every one of those rounds moved screens rather than rules. The call on v1.5.2
   did the opposite, and the two rounds of comment since have gone further in
   the same direction, so the specification is at v1.7.

   v1.5.4 HELD STILL FOR A CYCLE, ON INSTRUCTION: the reviewer was holding one
   deck and wanted one number on it while the amendments were in flight. The
   cycle closed with the 01/09 comments on that deck, so the number moves.

   WHAT v1.5.5 AND v1.5.6 ARE. One round of comment, read twice: the forty-five
   changes marked on the v1.5.4 deck, and then the second pass over what those
   produced. v1.5.6 is the corrections — a screen withdrawn again, a control
   moved to the app bar, one map size across three screens, and the tour's
   illustrations turned from live screens into pictures. The five that stand
   are:

     * A12 IS DELETED. "Not sure what purpose this screen is fulfilling. After
       A10 he should go to A11. It is too early for him to request a quote."
       A10 makes the farm, runs the survey and says when the answer comes; A11
       is where the quote is asked for, in front of the plots it is about.
     * THE TOUR IS SIX PANELS, all six written by the reviewer, all six
       illustrated by a picture rather than an icon: two photographs he supplied
       and six generated screenshots, cropped and bordered
       (tools/tourshots.mjs).
     * THE MAP IS ONE SIZE. A10, A10D and A11 all carry it at 65% of the phone,
       flush to three edges, with what is under it scrolling — the farmer draws
       on one map and reads the result on the same one.
     * A13B WAS ADDED FOR THE MARKER BETWEEN A13 AND A14, AND WITHDRAWN. "It
       wasn't there before and shouldn't be there now." The payment page stays a
       conversation.
     * THE FARM HAS AN OUTLINE, kept from A10, drawn on every map, and editable
       from A11 — which is the second way to take plots off a quote.
     * THE SURVEY TELLS DATE PALMS FROM OTHER FRUIT TREES, because A11 now
       reports them on separate lines.
     * F6 COMPARES FEATURES, not satellites: three columns, four topics, and
       nothing about resolution.

   ONE COMMENT IS NOT IMPLEMENTED, and it is the ordering of the fork: "A9B
   should come before A9". The app cannot follow it — A9's "what is growing on
   this land" is what decides whether A9B appears at all, and a farm with trees
   never sees the fork, settled at the 22/08 review — so asking the fork first
   would offer a date grower a route ending in his being told he cannot take it.
   The deck printed it the reviewer's way for one build; the second pass asked
   for the old order back "and a visible note to the powerpoint explaining it",
   which is what A9B's `when` line now carries onto the page.

   THE CALL (spec 1.6)

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

   THE COMMENTS ON IT (spec 1.7)

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
