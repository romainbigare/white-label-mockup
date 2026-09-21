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
export const MOCKUP_VERSION = '1.7.1';

/* WHAT v1.7.1 IS: THE 21 SEPTEMBER REVIEW, AND IT IS A PATCH ONLY IN NUMBER.

   Two inputs, merged. Mark marked up the v1.7.0 deck — 52 yellow boxes, 9 blue
   ones, two slides struck through — and then walked those marks screen by
   screen on a call, which decided a good deal the deck never raised. Where the
   two disagree the call wins. The whole of it is written up in
   docs/Mockup_Changes_v171.md, row by row; what follows is the shape of it.

     PASSWORDS ARE GONE. "I've seen a shift industry-wide, over the last six
     months, away from passwords toward SMS/email one-time codes." A8 loses the
     field, A21 loses four of its five controls, FORGOT is deleted outright, and
     A9 gains the help block because it is now the single point of failure for
     getting into the app. The two doors on A8 moved to the dock: the complaint
     was that they needed scrolling, and measured, the form does not fit a phone
     in any language.

     THE SURVEY RUNS BEFORE THE PRICE AGAIN, reversing the 13/09 third pass.
     Mark says it in three places rather than one — the sequence written on A13,
     the A15 button renamed "Go to service plans", and above all the four steps
     he wrote onto the new A11: we send you a final quote third, you select the
     service plan fourth. So A14's "Get quote" makes the farm and asks for the
     survey, and A17 is on the far side of it. The screening step that made
     charging-first worth doing has not gone; it moved to A11.

     A11 IS REBUILT OUT OF A17'S LAYOUT, which is how Mark built it in the deck
     — he struck the old one through and duplicated the plan page. The range
     "SAR 716 – 1,074" was the Basic price and the Pro price with the choice
     removed. Two cards now, at cost, with no radio on them because nothing is
     picked here.

     A17 SPLITS MONTHLY / ANNUAL, with the toggle BELOW both cards and below
     Compare plans: the level is what is chosen, the billing period only how it
     is paid for. And the trial copy describes Apple's billing rather than a
     card Wafra never sees, in Apple's own words.

     A13 SPLITS IN TWO. Finding a farm and drawing round it were the same tap on
     the same map, so the screen was always in both modes and said it was in
     neither.

     ON THE FARM SIDE: B2's three floating titles move inside their cards, its
     trend axis becomes weeks of the crop cycle with a target line, and target
     yield stops being an input — "he shouldn't be able to override our number".
     B5 loses the donut and the per-tree breakdown. B7 stops recommending
     crops and starts showing field work. The Hijri calendar goes, and the Saudi
     phone number with it.

   AND EVERY SCREEN WAS RENUMBERED. The second pass asked for codes that run in
   deck order, ascending, one sequence per section: the letters had been telling
   the story of how the app was built rather than of how it is walked. The full
   old-to-new table is at the top of app/screens/index.js, with what deliberately
   did not move — translation keys, and the codes inside quoted review comments.

   THE ONE THING LEFT OPEN is the letter. The call renamed the two plan screens
   A13a and A13b — first-time and returning — which collides with the deck's
   A18 for the annual page, and both cannot hold it. The annual page keeps A18
   here because that is what the marked-up deck says; the first-time/returning
   distinction is carried by the screen titles instead. It is open question 1 in
   the changes document and it needs Mark.

   WHAT v1.7.0 WAS. A MINOR, NOT A PATCH, because the app looks different on
   every screen rather than on one. The 15/09 review put it plainly: the app bar
   was "a slab of white with a black title, not well integrated, a bit rough".
   Five dressings were drawn, shot and thrown away; the one the review picked
   takes the box off altogether.

     THE TOP OF A SCREEN IS THE PAGE. `.app__top` and the status-bar strip take
     the canvas the content is on, so there is no edge to be rough and nothing
     to integrate. What names the screen is a large title standing on it, 28 px,
     as iOS has done since 11 — the weight is carried by the words rather than
     by a band of paper behind them.

     NOTHING IS CUT. A title wraps to a second line and the top of the screen
     grows to hold it: "Join a farm as a guest", "Tabuk River Estate", "Farm 1 ·
     Plot 1" all read whole. An ellipsis in the one place that says where you
     are is the worst place in the app for one.

     THE PAGE EDGE IS A TOKEN NOW — `--gutter`, 16 → 22. A 28 px title needs
     room to read as a title, and everything that touches the edge moved with
     it: the bar, the page, the filter row, banners, chip strips. A title
     indented past the cards under it is not generous, it is misaligned.

     GREY FILLS CHOSEN TO READ AGAINST PAPER went white with a hairline — an
     unselected chip, D1's filter pills. Tints that MEAN something keep theirs.

   AND D1'S SCREENER WAS REBUILT, four rounds of one argument. Three drop-downs
   could never hold the fourth axis, because a menu is as wide as its longest
   option and four of those do not fit across a phone — which is the only reason
   the farm had been living up in the app bar, away from the three filters it
   belongs with.

     FOUR PILLS THAT DO NOT SHOW THEIR VALUE. Farm, severity, type, status: an
     icon, one word, filled dark green when it is narrowing the list. A control
     that shows only the QUESTION is as wide as one word, so the options moved
     into a sheet — where "Sent, not yet done" has the width of the screen, and
     where the abbreviations the old boxes needed ("Fertiliser", "Protection",
     "Done") could be deleted. Every place that names a kind of advice names it
     the way the cards do now.

     WHAT THE PILLS GIVE UP, THE LINE UNDER THEM GIVES BACK. Wordless controls
     cannot say WHICH farm, so one line writes the choices out in full when
     anything is set — and it wraps rather than truncating, because it exists
     precisely to hold what the controls could not. Clear resets all four, the
     farm among them.

     AND THE PHOTO CHECK IS IN THE CORNER, labelled. It is the one thing on that
     screen the farmer starts himself; everything else on it arrived from the
     model. */

/* WHAT v1.6.2 IS. The 13/09 feature review, built. The call went through
   MapMyCrop's Crop Monitoring catalogue module by module and kept 32 of them;
   a gap report against the v1.6.1 build then found thirteen already in the app,
   seven half-built and eleven with nothing behind them at all — five of which
   the plan comparison table was already selling. This release closes every one
   of those except the farm health score, which is held back deliberately: B1
   carries a written argument that plant health at farm level averages crops
   that cannot be averaged, and overruling it needs a design decision rather
   than a build.

   WHAT IS NEW ON SCREENS THAT ALREADY EXISTED.

     406  EVAPOTRANSPIRATION, in the two places it is actually read. On D2 it
          is the sum behind the volume — reference ET × crop coefficient = what
          the plot lost — so the figure a farmer acts on is checkable rather
          than handed down. On F4 it is the week ahead as bars, because the
          shape of the week is what decides whether an irrigation moves.
     407  GROWING DEGREE DAYS on B3's season bar, beside the calendar it can
          disagree with: a crop two-thirds through its days and half through
          its heat is a harvest that will be late.
     501  THE GROWTH STAGE CURVE on B2 — the stage named, the track behind it,
          and the verdict that is the point of modelling it at all: how many
          days ahead of or behind its own pace this crop is running.
     602  FERTIGATION as a column on the watering plan rather than a plan of
          its own, and only where the plumbing carries it. The glossary had
          been promising this for months.
     603  THE IRRIGATION MAP, back, with the objection that removed it
          answered in the review's own words: per-plot efficiency painted on
          the plot's own boundary, not a heat map washed across a farm. Flat
          fill, three bands, its own key.
     604  SOIL MOISTURE as a fifth measure, which is the whole of its
          plumbing: the picker, the layer list, the trend chart and the
          two-date comparison all read one list. 802 is the same layer read
          forward.
     702  A DISEASE RISK STRIP on B2, drawn only from directory entries that
          name this crop, and 706 as its farm-level counterpart — a section at
          the top of the inbox for what the forecast raised, kept separate
          from advice because nobody can "complete" the weather turning.
     801  A YIELD FORECAST on B3, as a band that narrows as the crop fills,
          and saying out loud that the tree figure is still being tuned.
     606, 803  THE TWO REPORTS THAT CARRY REAL CONTENT NOW, one row per plot:
          advised against applied with the efficiency that explains the gap,
          and what the soil actually holds behind D3's advice.

   AND EIGHT NEW SCREENS.

     D5, D6   photo diagnosis (701). A photo check existed once, as E7, and
               v1.5.4 deleted it because nothing in the app read an
               observation. Something does now: this round also built the
               directory it identifies against and the treatment it hands on
               to. It is the one feature on the list that makes the phone the
               right device rather than the web platform.
     F13, F14  the crop guide (505). Thirty-eight crops the app already knew
               about as picker data, readable at last.
     F15, F16  pests and diseases (703), eighteen entries written for this
               region — red palm weevil, dubas bug, bayoud. The glossary had
               been referring farmers to a directory that did not exist.
     B7       the crop planner (504): the whole farm on one calendar, so the
               ground coming free is visible before the decision is due.
     B8       farm progress (902), twelve months of one measure. Deliberately
               not a health score.

   THREE THINGS THE APP WAS SAYING THAT WERE NOT TRUE. The plan comparison
   table sold growth-stage modelling, soil moisture, the disease directory,
   photo diagnosis and a health dashboard, none of which existed; four of the
   five now do and the fifth was reworded to what ships. The same table listed
   scouting, which the call deferred, so that row is gone. And the help article
   promising variable rate maps, anomaly detection and the Agro Doctor — all
   three dropped or unresolved — names what is actually in the plan instead. */

/* WHAT v1.6.1 IS. The 13/09 call between Mark, Romain and Hany, on one problem:
   the app as built commits Wafra to a full MMC survey before a farmer has seen
   a price. A11 sits between A10 and the boundary-drawing that used to follow it
   directly — a farmer's rough area and tree count are priced off the same
   rates A17 charges later, and only then does he choose to go on to the
   survey that spends MMC's imagery budget.

   IT IS A11, NOT A9D. A9D is a letter this app used once before — the drawing
   canvas, renamed B9 at v1.5.8 without its translation keys following it, so
   every `t('a9d.…')` call on that screen is still live. Reusing the letter
   here would have reused its key namespace along with it.

   THE ESTIMATE IS A RANGE, NOT MARK'S OWN "ABOUT $80" EXAMPLE. The 13/09 call
   also settled that Basic underserves this farmer and Wafra is selling
   Advanced/Professional as "Premium" — so a single figure here would be a
   number belonging to neither plan, and the range this screen shows is bounded
   by the same two rates A17 already prices from.

   THE GUESS IS NEVER A RECORD. `roughArea` and `roughTrees` live on the
   sign-up draft alone and are never written to a farm, a plot or a survey —
   the whole point of the real boundary-drawing and survey that follow is to
   replace a guess with a measurement, which a mockup cannot do if it quietly
   turns the guess into one first.

   THE SECOND PASS OVER THE SAME ROUND, still v1.6.1, went further — five
   changes, all commercial rather than cosmetic.

     * A10 AND A9C MERGED. "Not by picking one or both" — what used to be a
       question with three cards (Field crops / Trees / Both) is now two
       number fields on A10 itself, and filling in one, the other, or both IS
       the answer. There is no "Both" any more because there is no picker to
       hold it. A9C is gone; A11 reads A10's two numbers directly.
     * A9B LEFT THE FLOW, NOT THE CODE. Both of A9B's routes led to the same
       paid MMC pipeline either way, so offering the choice at all was
       offering a distinction that had stopped mattering. `onboarding.A9B` is
       untouched — the instruction was explicit, code stays, flow and deck do
       not — and A11's "Confirm and continue" now goes straight to A13.
       Drawing plots by hand still exists, moved to Farm settings' "Add a
       plot" (B9), because a farmer clearing a field after the fact still
       needs it even though sign-up no longer offers it.
     * A11 LOST ITS SECOND BUTTON AND GAINED AN EXPLANATION. "No Not Right
       Now" — a screen asking for one decision now asks for one decision. In
       its place: what the next screen actually does, in plain words — draw a
       boundary, send it for satellite survey and AI analysis.
     * THE POP-UP BECAME A SCREEN, A15. Requesting the survey used to open a
       modal over A13 with an instant way through to the (mocked-up) result.
       A15 replaces it: a real screen that says the survey has started and
       sends the farmer Home to check back later — which is also where
       enterApp() now runs, since there is nothing left to finish first.
     * HOME OPENS STRAIGHT ON THE PRICE. B1's "your survey is ready" card used
       to open A16; it opens A17 now, which shows a real price the moment a
       survey is ready rather than waiting for A16's confirmation — A16 is
       still one tap away, behind "modify the list of plots", for anyone who
       wants to check the plots first. A17 itself lost three lines of small
       print that were true but not decision-relevant here — the annual
       discount and the App Store cancellation policy, both real facts that
       belong on a billing screen (F5) rather than the screen between a
       farmer and his first price.

   THE THIRD PASS TURNED THE WALK AROUND, and it is the biggest change of the
   three: THE PRICE NOW COMES BEFORE THE SURVEY. "After A13 we move to A17,
   the payment screen … once the user clicks on the main confirmation button
   at the bottom of the payment screen, we send for survey." Which finishes
   the argument the screening step was always making — if the point is that
   nothing expensive should run for somebody who was never going to pay, then
   the payment, not the estimate, is the right gate.

     * A13 MAKES NOTHING AND REQUESTS NOTHING. Its "Continue to survey" keeps
       the boundary on the draft and opens A17. A farmer who turns back at the
       price leaves no half-made farm behind him and costs MMC nothing, which
       the previous pass could not say: it created the farm and asked for the
       survey the moment the line was drawn.
     * A17 IS THE PAYMENT SCREEN, AND IT DOES TWO JOBS. Before the survey it
       prices the farmer's own two numbers from A10 — the same arithmetic A11
       quoted a range from, so the figure cannot move between the two screens
       — and says so in as many words. After the survey it prices what was
       actually found. Restructured either way: the plans are cards to pick
       between rather than two buttons that chose AND committed in one press,
       and there is one main confirmation button at the bottom, which is what
       the review asked for.
     * THAT BUTTON IS WHAT SENDS FOR THE SURVEY. It makes the farm, marks the
       survey requested and hands to A15 — renamed "Analysis in progress",
       which confirms the analysis is running, says to check back later, and
       carries the one link Home.
     * THE SECOND SITTING READS THE OTHER WAY ROUND NOW. With the plan chosen
       and paid for before the satellite looked, what is new when the answer
       arrives is the answer — so B1's "your survey is ready" card opens A16
       again (what we found), and A17 follows it re-priced on the real plots.
       A16's own button changed with it: "Confirm these plots", not "Request
       quote", because the quote happened two screens before the satellite
       ever looked.
     * A11 IS THREE STEPS RATHER THAN A PARAGRAPH. Same promise — a boundary,
       sent for satellite survey and AI analysis — drawn as the walk the
       farmer is about to take, with the price band on one line instead of
       two currencies set side by side. */

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

   THE SECOND PASS OVER THE SAME ROUND went further in two directions.

     * THE WORKFORCE IS BACK, AS AN ADDRESS BOOK. B10: the men work is sent to
       on a farm, each a name, a number and the app he actually reads. Nobody
       holds an account except the one supervisor. It is what "somewhere you get
       your library of team members" asked for, and it is not §5.6, which was
       accounts and permissions and stays deleted.
     * D6 IS DELETED. A weather alert on the advice detail shell made a forecast
       look like a job, one round after the same review said weather is not
       advice. F4 is the weather screen and carries what D6 carried.
     * THE CODE GOES TO THE NUMBER AGAIN. The account is still the email address
       — that was 06/09's decision and it stands — but a one-time code is not an
       identity, it is a message that has to arrive in seconds on a phone in a
       field. A21, A8, A9 and the reset all agree, and A8 asks for the number
       first because it is the field the next screen depends on.

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
       ten-language sheet as A2. "First screen tells users what we do (to avoid
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
       A13 he should go to A16. It is too early for him to request a quote."
       A13 makes the farm, runs the survey and says when the answer comes; A16
       is where the quote is asked for, in front of the plots it is about.
     * THE TOUR IS SIX PANELS, all six written by the reviewer, all six
       illustrated by a picture rather than an icon: two photographs he supplied
       and six generated screenshots, cropped and bordered
       (tools/tourshots.mjs).
     * THE MAP IS ONE SIZE. A13, B9 and A16 all carry it at 65% of the phone,
       flush to three edges, with what is under it scrolling — the farmer draws
       on one map and reads the result on the same one.
     * A18 WAS ADDED FOR THE MARKER BETWEEN A17 AND A20, AND WITHDRAWN. "It
       wasn't there before and shouldn't be there now." The payment page stays a
       conversation.
     * THE FARM HAS AN OUTLINE, kept from A13, drawn on every map, and editable
       from A16 — which is the second way to take plots off a quote.
     * THE SURVEY TELLS DATE PALMS FROM OTHER FRUIT TREES, because A16 now
       reports them on separate lines.
     * F6 COMPARES FEATURES, not satellites: three columns, four topics, and
       nothing about resolution.

   ONE COMMENT IS NOT IMPLEMENTED, and it is the ordering of the fork: "A9B
   should come before A10". The app cannot follow it — A10's "what is growing on
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
       and a picker belongs in the app bar. WF5.001…WF5.011 collapse onto B1,
       and the ones that only ever described the list — the four-state summary
       bar, the by-farm/all-plots toggle — are withdrawn with it.
     * THE MAP IS THE ONLY FULL-SCREEN READING. B7 and B8 are deleted: both were
       the map rebuilt at plot scope and reachable from nowhere else, so
       WF5.029…WF5.033 are satisfied on C1 and C4 and B2 hands the plot over.
     * TREE ANALYTICS ARE SCOPED TO A GROUP, not to a farm. B11 becomes B5, and
       WF5.041…WF5.061 are read against the group the farmer pressed rather than
       against every tree he owns.
     * FIELD CAPTURE IS WITHDRAWN. WF5.154…WF5.159 and WF6.028 described a
       photograph, a category and a severity that nothing in the app ever read
       back. E6 and E7 go, and so does the write path behind them.
     * THE COVERAGE QUESTION IS ASKED ONCE, on A10, before the fork — and the
       fork itself is offered to field crops alone (WF4.052 gains that
       condition). A12 stops asking and explains instead: WF4.047…WF4.050 are
       satisfied by what it now says the survey will do.
     * NO SCREEN NAMES ANOTHER SCREEN. The build had begun annotating buttons
       with where they land — "(D1)" — for the benefit of a printed deck. Those
       belong on the deck, drawn as arrows, and not in an app a farmer uses.

   The requirement identifiers throughout are still v1.2's, for the reason given
   in the README under Deviations. */
export const SPEC_VERSION = '1.7';
