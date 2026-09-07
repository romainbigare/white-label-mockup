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
export const MOCKUP_VERSION = '1.5.9';

/* WHAT v1.5.9 IS. The Monday review — a call rather than a marked-up deck, and
   its Wafra half is about one thing: THE APP STOPPED KEEPING AN ACCOUNT OF WHO
   IS DOING WHAT.

     * SHARING REPLACED ASSIGNING. "How about we just forgo the 'assign to' and
       we say 'share with'?" An advice is sent to somebody on the team the way a
       message is forwarded, and nothing comes back. The app knows a team now
       rather than one supervisor, and the person is chosen in a sheet rather
       than named on a button.
     * D7 IS DELETED. Recording what was actually applied was the last of the
       accountability, and it existed to close a job somebody had been made
       answerable for. "Completed" is one button on the detail screen now, out
       of the ⋯ menu where nobody could find it.
     * D1'S CARD IS THREE LINES. Severity and kind, the ground, what to do. The
       amount, the diagnosis and the two buttons moved to the detail screen —
       "on D1 I have no more than three lines" — and the alternative, an
       expanding box, was weighed and set aside because a detail that lives
       inside a list item can never grow a chart or a week's schedule.
     * THE INBOX CAN BE SORTED THREE WAYS. By delivery time, by severity or by
       field. The old fixed order interleaved two fields' urgent work; grouping
       by field alone hid what had just arrived. "So it's like your emails. You
       can give them the option."
     * F9 IS ADVICE DISTRIBUTION. It answers the question the old screen could
       not — "who's WhatsApp?" — with three advice types, three channels (SMS,
       WhatsApp, Telegram; email and push are gone) and, behind each, the people
       it reaches. Routing is by TYPE rather than by urgency: a man is hired for
       a job, not for a severity.
     * F6 SHOWS ONLY DIFFERENCES, IN ONE TABLE. "It's not too much detail, it's
       the wrong detail." Every row differs between Basic and Pro, and the
       crops/trees tabs are gone. The definitive feature list is still coming
       from the reviewer.

   Nutrition is called fertilisation everywhere a farmer reads it, the weather
   is not a kind of advice, F8's calendar offers Gregorian / both / Hijri, its
   translation-coverage readout has gone back to the harness, units and formats
   came off the More menu, and A1 carries a globe with its lockup a little
   higher.

   ONE BUILD NUMBER, FOUR ROUNDS OF COMMENT, AND A SPEC THAT MOVED TWICE.

   v1.5 was the requirement set as four rounds of review had amended it, and
   every one of those rounds moved screens rather than rules. The call on v1.5.2
   did the opposite, and the two rounds of comment since have gone further in
   the same direction, so the specification is at v1.7.

   THE APP IS NO LONGER CALLED A WHITE LABEL ONE (v1.5.7). Wafra owns and
   controls it, so it is the Wafra Farm app. What white label described is still
   true of the CODE — see app/ui/brand.js, where the name, the mark and the
   palette are one object — but it is an implementation fact now rather than a
   thing the product says about itself.

   WHAT v1.5.8 IS. The comments on the v1.5.7 deck — sixty-six of them, marked
   on the slides rather than in a comment thread, and the largest round since the
   v1.5.4 cut. Six of them change what the app IS rather than what a screen says:

     * THE ACCOUNT IS AN EMAIL ADDRESS. Sign up with it, come back with Face ID,
       and get a code to it when Face ID fails. The mobile number is collected
       as a detail and is no longer a way in, which is what an app sold from
       Georgia to Bengal needs: a number a farmer holds this season is not the
       number he holds next season.
     * THE FIRST SCREEN SAYS WHAT WE DO. A1 was a language chooser; it is a
       welcome screen now, with the language behind a chip in the corner and the
       ten-language sheet as A1B. "First screen tells users what we do (to avoid
       any misunderstanding)."
     * THE LOGO IS ENGLISH ONLY, for the same international focus.
     * THE TOUR IS FIVE PANELS. The opening one, the last still illustrated by
       an icon, was struck through and deleted; the "N of 6" counter went with
       it and the dots stayed.
     * D1's SCREENER IS THREE MENUS — severity, progress, type — one axis each,
       remembered between sessions. It was a pill row, a chip strip and a select
       that between them mixed two of the three axes into one control.
     * THE INDEX NAMES ARE GONE from every layer a farmer meets. "Each
       monitoring layer is generated from multiple indices / combinations of
       indices" — so naming a layer after one of them was shorthand that was
       not true.

   WHAT v1.5.7 WAS. The comments on the v1.5.6 deck, and they are four: the name
   above; four more languages and a language screen that no longer scrolls; one
   type size across the six tour panels, with their screenshots whole rather
   than cropped and without the phone's status bar; and the green note card that
   macOS PowerPoint was carrying off A9B's page onto the slides after it.

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
   which A9B's deck page carried as a green card until v1.5.7 took the card off
   — see below. The reasoning is in A9B's registry note in screens/index.js,
   which is the deck's speaker note for that page.

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
