/* ---------------------------------------------------------------------------
   index.js — the screen registry.

   Every screen in the App Map of §3.2, keyed by its specification identifier.
   The registry carries the title, a one-line note and the requirement IDs each
   screen implements, which is what feeds the reviewer caption panel and the
   "All screens" index in the harness. Keeping the mapping here means the App Map
   and the build cannot drift apart unnoticed.

   Three codes here are not in the App Map, and all three are sub-screens the
   spec describes but does not number:
     B9  the drawing canvas behind "Draw my own plots", which §4.10.1 gives
          no code of its own. Reached from Farm settings' "Add a plot" now,
          not from sign-up — see the 13/09 note further down this file.
     A15  new at the 13/09 review, second pass: the screen that tells a
          farmer his analysis is running, in place of the pop-up that used to.
          The third pass moved it behind the payment screen, which is what
          now sends the boundary for survey.
     FORGOT  GONE at review 21/09, with the password itself. A20's one button
          sends a code; there is nothing left to reset.

   WHAT THE 13/09 REVIEW'S THIRD PASS DID TO THE ORDER. The walk was boundary
   → survey → (come back later) → price; it is boundary → price → survey now.
   "After A13 we move to A17, the payment screen … once the user clicks on the
   main confirmation button at the bottom of the payment screen, we send for
   survey." Which settles the question the screening step was always circling:
   nothing expensive runs until somebody has agreed to pay for it. A17 does
   two jobs because of it — the plan priced on the farmer's own numbers before
   the satellite looks, and the plan re-priced on real plots when it comes
   back — and A13 makes nothing, requests nothing, and simply carries its
   boundary forward.

   A7 is in the App Map and NOT in this registry. The 18/08 review deleted it:
   the name and password it asked for are part of creating an account and are
   collected on A8, and the land unit it also carried belongs beside the first
   area the app prints, which is A10. §4.8's requirements survive the screen —
   WF4.041, WF4.042 and WF4.044 sit on A8, WF4.043 on A10, WF4.045 on A9.

   A2 has gone the same way, at the 22/08 review, which asked twice whether it
   could be merged into A20 and asked for its contents to be moved there. Three
   doors of equal weight is a decision the app can make for the farmer: logging
   in is the common case, so A20 is the front door and the other two doors are
   links beneath the form. §4.5 survives the screen — WF4.017's ban on a login
   form was about the ROUTING screen and dies with it, WF4.020's language
   control is in A20's app bar, and WF4.018's tour now runs before either.

   A9B IS DIFFERENT FROM ALL OF THOSE, AND DELIBERATELY HALF-DELETED. The
   13/09 review's second pass took the survey-or-draw fork off the sign-up
   walk — every new farm now takes the same next step after A11, whatever is
   growing on it — with one instruction that does not fit the pattern above:
   "don't remove it from the code, just remove it from the flows and the
   ppt." So `onboarding.A9B` is untouched, a working screen nothing routes to
   any more, and it has no line in this registry — which is what keeps it out
   of both SCREEN_GROUPS and the deck this file feeds, without deleting a
   function the next round might want back. Everything A9B used to decide
   (a farm with any trees goes straight to A13; a farm of crops only ever saw
   two equally-weighted route cards) is moot now that both routes ARE the
   same route — the fork is not choosing between draw-my-own and survey any
   more, because sign-up only ever offers the second. Drawing plots by hand
   still exists, reached from Farm settings' "Add a plot" straight to B9.

   WHAT v1.5.4 DELETED, AND WHY NONE OF IT IS A GAP.

     B3   merged into B1. The farm screen and the list of its plots were the
          same screen asked for twice; B1 is now the farm AND every plot on it.
     B1   the list of farms. A list of farms is a picker, and a picker belongs
          in the app bar — it is the FARM_SWITCH sheet, opened from the farm
          name on B1, and it carries Add a farm too.
     B7, B8   the full-screen measure viewer and the date comparison. Both were
          the MAP, rebuilt at plot scope and reachable from nowhere else. B2's
          third map button hands the plot to C1 instead.
     B11   every tree on a farm, behind a plot filter. Replaced by B5, the tree
          GROUP — press a group in the plot list and you get its map, its
          readings, its health spread and its trees.
     E1–E4   task management. An advice sent to the supervisor is the job; there
          was never a second object to model beside it.
     E6, E7   field observation and the photo disease check. They survived the
          deletion of tasks on the argument that they were field capture rather
          than work, and the round after it took them out anyway: nothing in the
          app reads an observation, and a form whose output nothing consumes is
          a promise the build cannot keep.
     G1, G2, G3   the workforce. Nothing to manage once nobody holds a queue.

   WHAT v1.5.5 DELETED. **A12 Your survey** — "not sure what purpose this screen
   is fulfilling. After A13 he should go to A16. It is too early for him to
   request a quote." It was the screen that asked for the quote and explained
   what the survey covers, and both halves had already moved: the explanation is
   the tour's second panel, and the quote is asked for on A16, where the farmer
   is looking at what he would be quoted on. A13 now makes the farm, runs the
   survey and says when the answer comes.

   Two codes are new. **F4 Weather** is the block that came off B1 — a forecast
   is something to look up, not something to be shown every time the app opens.
   **B5 Tree group** is what B11 became.

   A third was added and withdrawn inside one review: **A18 Confirm and pay**,
   for the marker between A17 and A19. The second pass of the same review took
   it out — "it wasn't there before and shouldn't be there now" — so the payment
   page stays a conversation rather than a screen.

   WHAT v1.5.8 DID TO THE FIRST RUN. Review 06/09 struck out two screens and
   drew a third.

     A1   was the language chooser and is now the WELCOME screen: what the app
          does, in one sentence, before it asks anything. "First screen tells
          users what we do (to avoid any misunderstanding)."
     A2  is new — the language sheet A1's corner chip raises, modelled on the
          reference the reviewer pasted in, and carrying his ten languages.
     A3   the tour's opening panel, the last one still illustrated by an icon,
          was struck through corner to corner and marked "Delete". The tour is
          five panels, so it runs A3 … A7 and A4E has gone.

   Two are renamed: A9D is **B9**, because it is the drawing canvas and it
   belongs beside A13, the other one; and A16 is **Survey results**, which is
   what the review calls it and what it now says on the screen.
   --------------------------------------------------------------------------- */

import * as onboarding from './onboarding.js';
import * as home from './home.js';
import * as plot from './plot.js';
import * as trees from './trees.js';
import * as maps from './mapscreens.js';
import * as advice from './advice.js';
import * as more from './more.js';
import * as guides from './guides.js';
import * as planner from './planner.js';

/* A screen. The last argument is for the one thing only some screens have:
     route  a hash route that differs from the id */
const S = (id, title, note, reqs, render, { route } = {}) =>
  [id, { id, title, note, reqs, render, route }];

/* =============================================================================
   THE CODES WERE RENUMBERED AT v1.7.1, AND THIS IS THE ONLY MAP OF IT.

   Review 21/09 (second pass): "renumber all the screens so that it matches our
   new order, and do it in ascending order (keep A, B, etc.)."

   Two years of review rounds had left the letters telling the story of how the
   app was built rather than of how it is walked: A4D came before A5, A10C
   between A10 and A10B, A9E and A9F were a price screen and an exit dressed as
   variants of the farm form, and A10D had been filed under My Farm since the
   13/09 round while still carrying an A. The numbers run in deck order now, one
   sequence per section, with no letter suffixes left.

   ONE CODE CHANGED SECTION. A10D — draw my own plots — is B9. It has been
   reached from Farm settings rather than from sign-up since 13/09 and is filed
   under My Farm; keeping an A on it was the last trace of where it used to be.

   old  new                     old  new                     old  new
   A1   A1   Welcome            A15  A21  Join as a guest     D5R  D6   Photo result
   A1B  A2   Language           B2   B1   Farm home           F0   F1   More
   A4   A3   Tour 1             B4   B2   Plot detail         F14  F2   My profile
   A4A  A4   Tour 2             B5   B3   Crop cycles         F1   F3   Reports
   A4B  A5   Tour 3             B6   B4   Add / edit cycle    F15  F4   Weather
   A4C  A6   Tour 4             B13  B5   Tree group          F5   F5   Subscription
   A4D  A7   Tour 5             B9  B6   Tree detail         F6   F6   Compare plans
   A5   A8   Sign up            B15  B7   Crop planner        F7   F7   Settings
   A6   A9   Verify code        B16  B8   Farm progress       F8   F8   Units
   A9   A10  Tell us …          B10  B11   Farm settings       F9   F9   Distribution
   A9E  A11  Service plans      A10D B9  Draw my own plots   F10  F10  Data
   A9F  A12  Not interested     B14  B10  Manage workforce    F11  F11  Activity
   A10  A13  Locate your farm   C1–C5 unchanged               F12  F12  Help
   A10C A14  Draw boundary      D1–D5 unchanged               F16  F13  Crop guide
   A10B A15  Survey in progress                               F16D F14  One crop
   A11  A16  Survey results                                   F17  F15  Pests
   A13  A17  Service plans                                    F17D F16  One pest
   A13B  —   withdrawn — the annual page is a state of A17, not a screen
   A13C A18  Confirm subscription                             F13  F17  Contact Wafra
   A14  A19  You’re ready
   A3   A20  Log in

   WHAT DID NOT MOVE, DELIBERATELY:

   TRANSLATION KEYS. `a13.*` still belongs to what is now A17, `b15.*` to B7,
   `a9d.*` to B9. Renaming 1,452 keys across ten languages to chase a screen
   code would throw away every translation that has been done, and the precedent
   is already set — A9D became A10D at v1.5.8 and kept its keys. A key is an
   identity, not an address.

   OLD CODES INSIDE QUOTED REVIEW COMMENTS. The renumbering was applied across
   the whole app, comments included, so a sentence quoting a reviewer may now
   carry a code he did not say. That is the cost of having every comment agree
   with the registry, and the table above is how to read back through it: where
   a quote and a date disagree with a code, trust the quote and map the code.
   ========================================================================== */

export const SCREENS = Object.fromEntries([
  /* -- First run, and coming back ------------------------------------------
     Registered in one block because the registry is keyed by id and the App Map
     numbers them together; SCREEN_GROUPS below is what files them into the two
     sections the deck prints. */
  /* -- First run, and coming back ---------------------------------------- */
  S('A1', 'Welcome', 'The first thing anyone sees, once, on the first launch: the mark and one sentence saying what the app does, centred, with the address at the foot. Next takes the tour and Skip goes straight to the sign-up form. Registered users see neither — they open on A20.', ['WF4.011', 'WF4.014', 'WF4.018'], onboarding.A1),
  S('A2', 'Choose your language', 'Not a screen — a pop-up sheet over A1, raised by the globe in its corner and closed by choosing a row. It has a page here because a printed deck cannot show a state of another screen any other way. Ten languages, each in its own script with its code beside it; pressing one turns the whole app round if it reads right to left, and closes the sheet. It is where Arabic and Pashto are chosen, and it is one tap from the corner of A1.', ['WF4.011', 'WF4.012', 'WF4.015', 'WF4.016'], onboarding.A2),
  S('A3', 'Guided tour — 1 of 5', 'How the service works, and the first of five pictures of the app doing its job, in the language just chosen. Next on A1 opens it and Help brings it back. Illustrated by a satellite over the same synthesised farmland the map screens draw.', ['WF4.026', 'WF4.027', 'WF4.028', 'WF4.029', 'WF4.030', 'WF4.031'], onboarding.A3),
  S('A4', 'Guided tour — 2 of 5', 'The farm planner, illustrated by D1 and F9 themselves. In the app these five are one carousel; on paper each needs a page of its own, or four of the five are never seen.', ['WF4.026', 'WF4.027', 'WF4.028'], onboarding.A4),
  S('A5', 'Guided tour — 3 of 5', 'Irrigation and fertilisation advice, illustrated by D2 and D3.', ['WF4.026', 'WF4.027', 'WF4.028'], onboarding.A5),
  S('A6', 'Guided tour — 4 of 5', 'Optimising crop yields, illustrated by B3 and B4.', ['WF4.026', 'WF4.027', 'WF4.028'], onboarding.A6),
  S('A7', 'Guided tour — 5 of 5', 'What the farmers already using it get out of it, and the panel that hands on to the front door. The only one that argues with figures, and the only one drawn as a funnel: three savings narrowing into one.', ['WF4.026', 'WF4.029', 'WF4.031'], onboarding.A7),
  S('A8', 'Sign up', 'The whole account on one form, and since review 06/09 the email address is the account: a first and last name, an optional company, the address, a number from any country in the world, and a password. The two doors that used to be on A20 are at the foot of it.', ['WF4.032', 'WF4.033', 'WF4.035', 'WF4.036', 'WF4.037', 'WF4.041', 'WF4.042', 'WF4.044'], onboarding.A8),
  S('A9', 'Verify code', 'Four digits to the registered email address, and one sentence saying where they went. The boxes are real inputs, so the phone raises its own keyboard and can fill the code in itself; it sends on the last digit, and five wrong tries rest the account for a quarter of an hour. A brand new account is asked about Face ID here and nowhere else.', ['WF4.034', 'WF4.038', 'WF4.039', 'WF4.040', 'WF4.045'], onboarding.A9),
  S('A10', 'Tell us about your farm', 'The moment an account becomes a farm: its name, the unit its land is measured in, and roughly how much of each it holds — a number under Field crops, a count under Date palms and fruit trees. Filling in one, the other, or both IS the answer to what is growing here; nothing is picked. Review 21/09 took the word “first” out of the title — there is a later option to add a second farm, so the idea of a first one is noise this early — and turned the hint under the two numbers into a quiet “I’m not sure”, which skips the estimate and goes straight to locating the farm.', ['WF4.043', 'WF4.051', 'WF4.053', 'WF4.055'], onboarding.A10),
  S('A11', 'Available service plans', 'Rebuilt at review 21/09 out of A17’s own layout: Mark struck the old price-estimate screen through and made its replacement by duplicating the plan page. The two real plans at their two real prices, presented as an estimate, with NOTHING to choose — the radio buttons came off, because the plan is picked later on A17 once the survey has priced the real farm. Under them, the four steps in the reviewer’s own order, which is where the app says plan selection comes last. The call calls this screen A13a; the two plan screens are told apart by their titles rather than by a letter.', [], onboarding.A11),
  S('A12', 'Not interested', 'New at review 21/09, and the only screen in the app that exists to learn something from somebody leaving. Behind “I’m not interested” on A11: four reasons in Mark’s order — not what I’m looking for, too complicated, too expensive, and a free-text other — with the WhatsApp and email buttons at the foot, because a farmer who is out because the app is too complicated is the one a person could still help, and he has no account and so no other way to reach one.', [], onboarding.A12),
  S('A13', 'Locate your farm', 'The first half of what used to be one screen. Review 21/09 split it: finding the farm and drawing round it were the same tap on the same map, so the screen was always in both modes and said it was in neither. This half only finds — two numbered, stacked options above the map, search or current location, and one button that confirms the farm is on screen. Nothing a farmer does here draws anything.', ['WF4.056', 'WF4.057', 'WF4.070'], onboarding.A13),
  S('A14', 'Draw your farm boundary', 'The second half, and the one that draws. By the time anyone arrives the map is already over their land, which is what makes every tap on it unambiguous. The instruction is ON the map at lead size rather than six words in the bar with the rest behind an ⓘ — "text is very small and easy to miss. Farmer may not know how to proceed." One button, "Get quote", and since review 21/09 that is exactly what it does: it makes the farm, sends the boundary for survey, and the quote comes back on the far side. The screening that used to be done by charging first is done by A11 now, which shows both plans at their estimated cost before anyone gets here. Opened with a farm id it edits that farm’s outline instead, which is the one route that skips A13 entirely.', ['WF4.056', 'WF4.057', 'WF4.071', 'WF4.074', 'WF4.075', 'WF4.076', 'WF4.077'], onboarding.A14),
  S('A15', 'Survey in progress', 'The screen that says the satellite has been asked for something. Review 21/09 renamed it — the farmer is told a survey is starting before it and that his survey is ready after it, so calling the middle of it an analysis made three names for two things — and took out the line telling him to keep the app open: the survey runs on MMC’s servers, so the app has nothing to do while it waits and a push notification is what brings him back. It carries an estimated time, which is MMC’s number and varies by country. Its button goes on to the service plans.', [], onboarding.A15),
  S('A16', 'Survey results', 'The plots the survey found, or the plots the farmer drew, as one list to approve, over the farm’s own outline. Every row offers all three of Keep, Edit and Remove, one button underneath adds a plot that is missing, and the app bar carries the way back to the boundary. It is the second sitting now: the plan was chosen and paid for before the survey ran, so what Home opens when the answer comes back is this — what was found — with A17 one step beyond it, re-priced on the real plots.', ['WF4.078', 'WF4.079', 'WF4.080', 'WF4.081', 'WF4.082', 'WF4.083', 'WF4.084', 'WF4.085', 'WF4.086', 'WF4.087', 'WF4.088', 'WF4.065'], onboarding.A16),
  S('A17', 'Service plans', 'The payment screen. Review 21/09 split it into a monthly and an annual page and the third pass of the same review put it back together — the period is a toggle on this screen, not a second screen code. Two levels to pick between and one main confirmation button at the bottom. It comes AFTER the survey again — “Sequence: A13, A15, A16, A17”, and the four steps on A11 say the same thing in longer form: a quote third, a plan chosen fourth. Reached before the answer is back it says the survey is still running rather than inventing a figure. The monthly/annual toggle sits ABOVE the two cards at review 21/09’s third pass — the period is what the two prices MEAN, so it is declared before them — and it defaults to annual, with the saving spelt out under it. It is a toggle on this one screen and no longer a second screen code: “don’t create a separate screen code to show the monthly plan page.” F5 is the same question for an account that already has one.', ['WF4.089', 'WF4.090', 'WF4.091', 'WF4.092', 'WF4.093', 'WF4.094', 'WF4.098', 'WF4.099', 'WF4.100', 'WF4.101', 'WF4.102', 'WF4.103', 'WF4.106', 'WF4.107'], onboarding.A17),
  S('A18', 'Confirm subscription', 'New at review 21/09 (second pass): the App Store purchase sheet, drawn as the drawer a farmer actually meets when he presses Start free trial. The 21/09 call settled that Wafra never sees a card — “we don’t charge a credit card, as the subscription is through Apple/Google” — and A17 says that in words; this is the same fact in the form it arrives. Deliberately not our design system: it is Apple’s sheet, drawn to iOS’s own metrics, because the point is that it is not ours to change. The Android equivalent is Google Play’s and is named on A17.', [], onboarding.A18),
  S('A19', 'You’re ready', 'The pause between setting up and starting. It says when the first satellite pass arrives, so the empty farm makes sense.', ['WF4.112', 'WF4.002'], onboarding.A19),
  S('A20', 'Log in', 'The way back in for somebody the app has already met, and only for them. It opens with the reason it is open at all — Face ID did not recognise him — then greets him by name and offers a password or a code to the registered email address. No app bar: the screen says "Welcome back" and does not also need a title saying "Log in". Creating an account and joining a farm as a guest are on A8, which is where a stranger lands.', ['WF4.022', 'WF4.023', 'WF4.024', 'WF4.025'], onboarding.A20),
  S('A21', 'Join a farm as a guest', 'For someone invited to a farm they do not own — which is what “as a guest” says before they tap. Six digits typed in, or the QR code read off the phone of the person who set the account up, which is where review 06/09 put it: one phone shows, one phone scans.', ['WF4.113', 'WF4.114', 'WF4.115', 'WF4.116', 'WF4.117'], onboarding.A21),

  /* -- Home -------------------------------------------------------------- */
  S('B1', 'Farm home', 'The farm and every plot on it, on one screen — the crops first, the tree groups after. It is where a single-farm account opens, and it says one thing above the list: whether anything is urgent.', ['WF5.012', 'WF5.013', 'WF5.014', 'WF5.016', 'WF5.018', 'WF5.019', 'WF5.020', 'WF5.021'], home.B1),
  S('B2', 'Plot detail', 'One plot, opening with the thing the farmer knows and we do not: what is growing on it. Then what the satellite saw, and a sentence saying where the trouble is and how long it has been there.', ['WF5.022', 'WF5.023', 'WF5.024', 'WF5.025', 'WF5.026', 'WF5.027', 'WF5.028', 'WF5.034'], plot.B2),
  S('B3', 'Crop cycles', 'What has been planted here, season by season. Open field only — a tree group has no cycle. Closing a season keeps it, which is what makes one year comparable with the last.', ['WF5.034', 'WF5.035', 'WF5.037'], plot.B3),
  S('B4', 'Add / edit crop cycle', 'Starting a new planting, or closing the one that is running. A season closes with a harvest date, and a yield if anyone weighed it.', ['WF5.034', 'WF5.036', 'WF5.038'], plot.B4),
  S('B5', 'Tree group', 'One species of tree, wherever it stands on the farm: where the trees are, what the satellite reads over them, how they are spread across the four states of health, and every tree in the group. Opened by pressing a tree group in the plot list.', ['WF5.041', 'WF5.045', 'WF5.053', 'WF5.054', 'WF5.055', 'WF5.059', 'WF5.060', 'WF5.061'], trees.B5),
  S('B6', 'Tree detail', 'One tree. It begins with a map of which tree it is, because picking tree 2841 out of eight thousand is the hard part.', ['WF5.056', 'WF5.057', 'WF5.058', 'WF5.086'], trees.B6),
  S('B7', 'Crop planner', 'New at the 13/09 catalogue review. The app recorded cycles one plot at a time and planned across none of them, so nothing could say that four plots come free in March or that a field is going into its third season of the same family. Plots down the side, twelve months across, current cycles drawn where their real dates put them, and a suggested next crop read from each plot’s own closed history.', [], planner.B7),
  S('B8', 'Farm progress', 'Twelve months of one measure for the whole farm — the comparison the app could not make: B2 charts a single plot and C4 puts the farm at two dates side by side, and nothing showed the year. It is a trend for a chosen measure and deliberately not a farm health score: averaging crops that cannot be averaged is why B1 carries no such figure.', [], planner.B8),
  S('B9', 'Draw my own plots', 'Drawing each plot on satellite imagery, corner by corner, and naming it. One plot is one crop, which is why the boundary is the only thing this route asks for before the summary. Reached from Farm settings now (Add a plot), not from first-run sign-up — the fork that used to send new sign-ups here is A9B, which this registry no longer carries; see the note near the top of this file.', ['WF4.056', 'WF4.057', 'WF4.058', 'WF4.059', 'WF4.060', 'WF4.061', 'WF4.062', 'WF4.063', 'WF4.064', 'WF4.066', 'WF4.067', 'WF4.068', 'WF4.069'], onboarding.B9),
  S('B10', 'Manage workforce', 'The people work is sent to on this farm: a name, a number and the app each of them actually reads. Nobody here holds an account — an advice reaches them as a message with a link — except the one person invited as supervisor. It is an address book, not the permission matrix the v1.5.4 review deleted.', ['WF8.003', 'WF8.005'], home.B10),
  S('B11', 'Farm settings', 'Names, boundaries, and the two things nobody should do by accident: handing the farm on, or getting rid of it.', ['WF5.046', 'WF5.047', 'WF5.048'], home.B11),

  /* -- Map --------------------------------------------------------------- */
  S('C1', 'Map', 'The farm from above, filling the screen. A search bar stays in the open, because the point of this screen is finding something, and the farm’s own outline is drawn round its plots in a line heavy enough to read against sand or crop.', ['WF5.071', 'WF5.072', 'WF5.077', 'WF5.078', 'WF5.082', 'WF5.083', 'WF5.084'], maps.C1),
  S('C2', 'Layers', 'What to draw on the map, and which of the two pictures to draw it on — each described, because the difference is clarity against freshness and both carry the monitoring result. The layer list names what each layer tells you and no longer names the index behind it.', ['WF5.074', 'WF5.075', 'WF5.076'], maps.C2),
  S('C3', 'Plot sheet', 'A tap on a plot, answered without leaving the map. It drags up to full height and opens the plot if you want more.', ['WF5.073'], maps.C3),
  S('C4', 'Compare dates', 'The whole farm at two dates at once, split by a line you drag across it. It opens a week apart — an interval, resolved to the last satellite pass before the mark, rather than a count of passes that could mean anything.', ['WF5.079'], maps.C4),
  S('C5', 'Boundary editor', 'Correcting the shape of a plot after the fact, and splitting, joining, removing or adding one. The old outline is kept, with who changed it and when.', ['WF5.090', 'WF5.091', 'WF5.092', 'WF5.093'], maps.C5),

  /* -- Advice ------------------------------------------------------------ */
  S('D1', 'Advice inbox', 'The centre of the product. Each item is three lines — how urgent and what kind, which ground, and what to do — with the detail one tap away on D2, D3 or D4. Three menus screen the list and a fourth orders it: by delivery time, by severity or by field.', ['WF5.094', 'WF5.095', 'WF5.096', 'WF5.097', 'WF5.098', 'WF5.099', 'WF5.100', 'WF5.101', 'WF5.102', 'WF5.103', 'WF5.104', 'WF5.105'], advice.D1),
  S('D2', 'Irrigation advice', 'How much water this week, on which days, in which two-hour window, and whether that is more or less than usual. One schedule, for the plot.', ['WF5.111', 'WF5.112', 'WF5.113', 'WF5.114', 'WF5.115', 'WF5.116', 'WF5.117', 'WF5.118'], advice.D2),
  S('D3', 'Fertilisation advice', 'How much nitrogen, phosphate or potash the crop is short of, per hectare, with the common products that supply it. The Monday review settled the word: nutrition was ambiguous, fertilisation is what a farmer buys.', ['WF5.119', 'WF5.120'], advice.D3),
  S('D4', 'Crop protection advice', 'The active ingredient, and the date after which the crop is safe to pick. The reminder to read the label stays on the screen.', ['WF5.121', 'WF5.122', 'WF5.123', 'WF5.124', 'WF5.125', 'WF5.126'], advice.D4),
  S('D5', 'Check a photo', 'New at the 13/09 catalogue review, and the one feature on that list that makes the phone the right device rather than the web platform: a farmer standing over damage he does not recognise photographs it and gets a shortlist. The capture state is the frame and the three things that decide whether the answer is any good — distance, light, and a healthy part of the leaf in shot.', [], advice.D5),
  S('D6', 'Photo result', 'What came back: the likeliest cause with a match percentage beside it, how to confirm it on the plant, what to do, the pre-harvest interval, and the second candidate it could also be. A diagnosis from one photograph is a shortlist rather than a verdict, and the screen says so twice.', [], advice.D6),

  /* -- More -------------------------------------------------------------- */
  S('F1', 'More', 'Everything outside the day’s work. What appears depends on who is looking.', ['WF5.160', 'WF5.161'], more.F1),
  S('F2', 'My profile', 'Contact details, and nothing else since review 06/09: a first and last name, the number and the address, all of them editable. Committing the screen sends a code to the number and hands to A9, because the number is the one detail here that has to be proved.', ['WF4.032', 'WF4.033'], more.F2),
  S('F3', 'Reports', 'The farm written up for a week, a season, or a bank. It comes back as a document in whichever language was asked for.', ['WF5.162', 'WF5.163', 'WF5.164', 'WF5.165', 'WF5.166', 'WF5.167'], more.F3),
  S('F4', 'Weather', 'The forecast, and any warning attached to it. It came off the farm screen in the v1.5.4 review — it is a thing to look up rather than a thing to be shown every time the app opens.', ['WF5.015'], more.F4),
  S('F5', 'Subscription info for existing users', 'What is being paid for and when it renews, with the sum shown. Where it was bought decides what this screen may offer, and since review 06/09 three jobs that were a phone number are rows: an invoice, switching the cycle or the level, and team members. A17 is the same question for an account that does not have one yet.', ['WF5.174', 'WF5.175', 'WF5.176', 'WF5.177', 'WF5.178', 'WF5.179'], more.F5),
  S('F6', 'Compare plans', 'The reviewer’s own list of nineteen features, drawn from the supplier document: fifteen that differ between Basic and Pro, and four that both carry as anchors. One flat table with a sticky header, no crop/tree tabs and no prices — A17 and F5 are the screens with a figure on them, and both link here.', ['WF9.001', 'WF9.002', 'WF9.003'], more.F6),
  S('F7', 'Settings', 'The language menu itself, the way through to units, notifications and storage, shared phones, Face ID, the legal documents, and closing the account for good.', ['WF5.185', 'WF5.186'], more.F7),
  S('F8', 'Units and formats', 'Land area, water, temperature, calendar, time and numerals, each in a section of its own. The calendar offers Gregorian, both, or Hijri — single, double, single.', ['WF5.180', 'WF5.181', 'WF10.019', 'WF10.020'], more.F8),
  S('F9', 'Advice distribution', 'A standing rule for where each kind of advice goes: irrigation, fertilisation and crop protection, each by SMS, WhatsApp or Telegram, each naming the people on the team who receive it.', ['WF5.182', 'WF7.006', 'WF7.007', 'WF7.008'], more.F9),
  S('F10', 'Data and storage', 'How much of the phone the app has taken up, whether to wait for Wi-Fi, and what is still waiting to be sent.', ['WF5.183', 'WF5.184', 'WF11.002', 'WF11.003'], more.F10),
  S('F11', 'Activity log', 'Who did what, when, and on which farm. Entries are added and never edited afterwards, which is the point of it.', ['WF5.187', 'WF5.188'], more.F11),
  S('F12', 'Help and user guide', 'Answers to the questions that come up most, a glossary for the agronomy words the app uses, and the tour again for anyone who skipped it.', ['WF4.030', 'WF5.189', 'WF10.012'], more.F12),
  S('F13', 'Crop guide', 'New at the 13/09 catalogue review: the 37 crops the app already knew about, readable at last. They were picker data — a name and three varieties, offered when a farmer declares what he planted — and nothing anywhere said how long the season runs, what it drinks, or what goes wrong with it. Grouped by family, searchable by variety, and marked where the farmer grows it himself.', [], guides.F13),
  S('F14', 'One crop', 'The page behind a crop: the season it commits the ground for, the water it takes, spacing, sowing and harvest windows, its varieties, and the pests and diseases that name it — each of which opens its own entry. The cross-link is the point of shipping the two directories together.', [], guides.F14),
  S('F15', 'Pests and diseases', 'The directory the app had been referring farmers to for months without having one: the glossary told them to look up a pre-harvest interval “in the disease directory”, and there was none. Eighteen entries written for this region — red palm weevil, dubas bug, bayoud — searchable by name, symptom or crop.', [], guides.F15),
  S('F16', 'One pest or disease', 'What to look for, what brings it on, what to do about it, and how long before the crop can be picked. Reached from the risk strip on a plot, from a photo diagnosis, or from the crop it affects — which is what stops a reference library being one nobody opens.', [], guides.F16),
  S('F17', 'Contact Wafra', 'Two large buttons, call or message, and a slower route for anything that needs a written record.', ['WF5.190', 'WF5.191', 'WF5.192', 'WF5.193', 'WF5.194'], more.F17),
]);

/* -- THE NOTE BESIDE A SCREEN -------------------------------------------

   A page in the deck can carry a small box of prose. It began as somewhere to
   keep the reviewer's own assumptions — "most users will sign in via Face ID",
   "this screen is only shown to new users" — which asked for no work and would
   otherwise have lived in one person's memory of a meeting. Review 06/09
   (second pass) then took the label off the box: it was headed "THE REVIEWER'S
   ASSUMPTION", and a box that announces whose thought it is before saying the
   thought is a box arguing with itself. The words stand on their own.

   Which changed what the box is FOR, and for the better. It is now simply the
   place a page says the thing a picture of a phone cannot: what a screen is,
   what a menu contains, what we are building on. Three kinds sit in it and none
   of them is labelled — a reader can tell an assumption from a definition
   without being told.

   They are here rather than in the deck builder because they are facts about
   the SCREENS, and this file is where the facts about screens live. The deck
   reads them the same way it reads the titles and the flows; the app itself
   never renders them, because a farmer must never read a note about himself. */
export const REVIEW_NOTES = {
  A20: [
    'Most users sign in with Face ID. This screen is drawn only when Face ID fails, which is what the notice at the top of it says.',
    'Creating an account and joining a farm as a guest are on A8, which is where somebody the app has never met lands.',
    'A code can be sent to the registered email address instead of a password.',
    '“Switch account” is for a farmer holding several accounts for different farms.',
  ],
  A8: [
    'This screen is shown to new users only. Anyone already registered goes straight to A20.',
  ],
  C3: [
    'The plot sheet is a pop-up panel that appears when the user taps a plot on the map. It shows the general metrics for the plot selected, and opens the full plot screen if he wants more.',
  ],
  C5: [
    'The boundary editor corrects the shape of one outline after the fact — a plot the survey drew slightly wrong, or a farm outline that has changed. Drag a corner to move it, add or remove corners, and split, join or remove the shape.',
    'The old outline is kept, with who changed it and when, so past analytics stay attached to the shape that was live at the time.',
  ],
  /* D1 HAS NO NOTE, AND THAT IS THE DECISION RATHER THAN AN OMISSION. It had
     the longest one in the deck — a list of the four filters and every option
     under each, written when the filters were drop-down menus whose options a
     photograph could not show. The 15/09 rebuild made the screen say it itself:
     the four pills are labelled, the one that is filtering is filled in, and
     the line under them prints every choice in full. A box beside the picture
     repeating what the picture says is a box a reviewer reads twice and learns
     nothing from, so review 16/09 took it off. */
};

/* Grouping for the harness "All screens" index — mirrors §3.2. */
/* WHAT THE DECK DOES NOT PRINT.

   SCREEN_GROUPS is the app's own index: every screen, filed where it belongs,
   and the harness contact sheet draws all of it. What the printed review walks
   through is a different question, and it is a question about the REVIEW rather
   than about the app — so it is answered here, once, instead of by quietly
   leaving a screen out of the index and hoping nobody notices it is missing.

   B11 is a settings form: names, region, report language, transfer, delete. A
   page of it in a screen walk is a page the review spends on a screen nobody is
   reviewing. It is in the app, it is in the harness, it is not in the deck. */
export const DECK_OMIT = ['B11'];

export const SCREEN_GROUPS = [
  // TWO SECTIONS, NOT ONE. First run used to hold everything before the tab bar
  // appears, which put the screens a farmer sees once in his life next to the
  // ones he sees every time he opens the app — and a reviewer paging through
  // fifteen of them had no way to tell which was which.
  //
  // The first section is the path somebody walks once, in the order he walks
  // it: language, tour, the front door, then making an account and a farm. A20
  // is in it, after A3, because a first-time farmer does pass through the login
  // screen — Create an account is a link on it — and the deck reads as the
  // journey rather than as a filing system. What is left in the second section
  // is what A20 leads to for somebody who is not registering: the password reset
  // and redeeming an invitation.
  //
  // The 21/08 review reordered the middle of the first section: the farm is
  // named and forked on A10, drawn on A13 or B9, and only then asked what to
  // cover. The 22/08 review moved the tour to the front, deleted A2, and made
  // A16 the place both routes finish.
  // THE TOUR SITS SECOND, AND IT USED TO SIT LAST. It was filed at the end
  // because it was a detour — offered on A1, landing back on A20 — and five
  // pages of it in the middle of the registration walk broke the one journey a
  // reviewer reads this section for.
  //
  // Review 06/09 (second pass) — "move the guided tour immediately after the
  // welcome screen A1". It is not a detour any more, and that is what the
  // previous round changed underneath it: A1's Next opens the tour, and the
  // tour's last card hands to the sign-up form. So the walk IS welcome, choose
  // a language, watch the argument, make an account — and the deck prints it in
  // that order because that is the order a farmer meets it in.
  //
  // A9B IS NOT IN THIS LIST, and neither is B9. The 13/09 review's second
  // pass removed the survey-or-draw fork from sign-up entirely — A11's
  // "Confirm and continue" leads straight to A13 now, whoever is farming
  // what — so there is no first-run step left that opens either screen. A15
  // is new in their place: the real "analysis in progress" screen that used
  // to be a pop-up. B9 still exists — see the note near the top of this
  // file — reached from Farm settings instead, so it moved to My Farm.
  //
  // THE ORDER IS THE ORDER THE THIRD PASS SET: boundary, price, survey. A17
  // sits between A13 and A15 because that is where a farmer meets it, and
  // A16 follows them because the survey it lists comes back later, in its own
  // sitting.
  { name: 'First run', ids: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19'] },
  // A20 IS IN THIS SECTION ONLY, AND IT USED TO BE IN BOTH. It was filed under
  // First run as well, because "a first-time farmer does pass through the login
  // screen — Create an account is a link on it". Review 06/09 took that link
  // off A20 and put it on A8: the login screen is now shown only to somebody the
  // app has already met, so a first-run walk that passes through it is a walk
  // through a door nobody in that section can open.
  { name: 'Log in', ids: ['A20', 'A21'] },
  // ONE SECTION FOR THE FARM AND EVERYTHING ON IT. Plots and tree groups had a
  // section title page each, which put two dividers between the farm and the
  // plot you reach from it — and a plot is not a peer of the farm, it is what
  // the farm contains. B1, then a plot and its cycles, then a tree group and
  // one tree.
  // B9 moved here from First run at the 13/09 review's second pass: it is
  // reached from B11's "Add a plot" row now, not from sign-up, so it is filed
  // where it is actually found.
  /* THE 13/09 CATALOGUE ROUND ADDED EIGHT SCREENS, filed where the farmer
     reaches them rather than in a section of their own. B7 and B8 are farm
     work, so they follow B1; D5 is the farmer raising something with us, so it
     follows the inbox it is opened from; and the two libraries are reference,
     which is what the More section already holds.

     Each pair prints twice — a list and one entry, a capture and its result —
     because a directory photographs as a list of names and a camera
     photographs as an empty frame, and neither says what the feature is.

     B7 AND B8 PRINT AFTER THE PLOT, not before it, which is a change of
     deck order and not of the app: both are still one row each on B1's More
     block, exactly where they were. The walk a reviewer reads first is the
     farm down to a plot and what is growing on it; planning next season and
     reading the year behind you are what he thinks about once he has seen
     that, so they follow it rather than interrupting it. */
  { name: 'My Farm', ids: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11'] },
  { name: 'Map', ids: ['C1', 'C2', 'C3', 'C4', 'C5'] },
  { name: 'Advice', ids: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] },
  // Review 01/09 — "move My Profile (F2) to the top of the More section, as it
  // makes the flow more natural, ending with F17 · Contact Wafra". It is where
  // the profile sits on F1 itself — the card above every other row — and the
  // walk now reads the way the screen does, finishing on the way to reach a
  // person rather than on an account form.
  { name: 'More', ids: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17'] },
];

/* THE PATHS THROUGH THE APP, AS A FARMER ACTUALLY WALKS THEM.

   SCREEN_GROUPS says which drawer a screen is filed in; this says what it comes
   after and what it leads to, which is a different question and the one a
   reviewer asks. A flow is a LINE — a short walk with one screen after another,
   which is what a filmstrip beside a printed phone can carry and what a person
   reads without being taught a notation.

   It was briefly a branching tree, and the tree was the wrong answer to a real
   question. The app does branch; the trouble is that a diagram of every branch
   from a screen is a diagram of the app, and the reviewer holding page 21 wants
   to know what HE just did and what happens next — not the shape of the whole
   product. Six tiles of one journey say that; twenty tiles of a tree say it
   less well and take four times the paper.

   EACH FLOW DECLARES THE SECTION IT BELONGS TO, and that is what fixes the
   thing the branching was trying to fix. B1 is on four different journeys — it
   leads to a plot, to a tree group, to settings, to the map — so which of them
   should print beside it? The one for the section the page is in. A page filed
   under My Plot shows the plot journey; the same screen filed under My Farm
   shows the farm one. The section is the reviewer's context and the flow now
   follows it.

   Order matters within a section: a screen on two of its flows takes the first,
   which is why the whole-farm registration route is declared before the
   drawn-plots one.

   Every step is a route the code actually takes, traced from the go() calls
   rather than from the App Map, so a flow that stops being true stops being
   true here too. Not every screen is on one — Settings and the language screen
   are places you go rather than steps you pass through. */
export const FLOWS = [
  /* -- First run --------------------------------------------------------- */
  /* ONE SIGN-UP WALK NOW, NOT TWO. The 13/09 review's second pass took the
     survey-or-draw fork out of sign-up — every new farm takes the same next
     step after A11's "Confirm and continue" — so the second flow that used
     to run through A9B and B9 has nothing left to describe; it is gone
     rather than left here pointing at a route the app no longer takes.
     Drawing plots by hand still exists, as its own flow under My Farm below,
     reached from Farm settings instead of from sign-up. */
  {
    section: 'First run',
    name: 'Signing up',
    /* THE PRICE IS INSIDE THIS WALK, AND THE SURVEY IS AT THE END OF IT.
       The 13/09 review's third pass put A17 between the boundary and the
       satellite — "after A13 we move to A17, the payment screen … once the
       user clicks the main confirmation button, we send for survey" — so the
       whole commercial decision now happens in one sitting, before MMC is
       asked for anything, and A15 is the screen that says the work has
       started. F6 sits beside A17 because that is where a farmer opens it:
       two levels and a figure raise one question, and the answer is one tap
       away and comes straight back. */
    ids: ['A1', 'A2', 'A3', 'A8', 'A9', 'A10', 'A11', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18'],
  },
  {
    section: 'First run',
    name: 'Once the survey is ready',
    // The second sitting, whenever the farmer next opens the farm: Home says
    // the survey is ready, A16 is what was found, and A17 is the price
    // adjusted to it — the same screen as in the walk above, doing its other
    // job, with A19 closing the round.
    ids: ['B1', 'A16', 'A17', 'A19'],
  },
  // Declared last within First run, so the five tour pages take it and the
  // registration screens above take the walk before it.
  {
    section: 'First run',
    name: 'The guided tour, offered from A1 and from Help',
    ids: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
  },

  /* -- Log in ------------------------------------------------------------ */
  { section: 'Log in', name: 'Joining a farm I was invited to', ids: ['A20', 'A21'] },

  /* -- My Farm -----------------------------------------------------------
     WHAT B1 LEADS TO IS THE PLOT, and that is the path this section prints.
     Adding a farm was the flow here for one round, which meant the busiest
     screen in the app illustrated the rarest thing anybody does on it. Adding a
     farm is A10 and A11, it is drawn in First run, and it does not need drawing
     twice.

     Declared first within My Farm, so B1 takes it; the tree walk below picks up
     B5 and B6, which the plot walk does not contain. */
  {
    section: 'My Farm',
    name: 'From the farm to one plot, and what is growing on it',
    ids: ['B1', 'B2', 'B3', 'B4'],
  },
  {
    section: 'My Farm',
    name: 'From the farm to a tree group, and down to one tree',
    ids: ['B1', 'B5', 'B6'],
  },
  {
    section: 'My Farm',
    name: 'The people work is sent to',
    ids: ['B1', 'B10'],
  },
  // NEW AT THE 13/09 REVIEW'S SECOND PASS. B9 used to be reached from
  // sign-up's fork; now it is Farm settings' own row, for the farmer who
  // clears a field or buys the plot next door after the farm already exists.
  // B11 itself is not in this filmstrip — DECK_OMIT keeps Farm settings out
  // of the printed deck — so the walk picks up where the deck can show it.
  {
    section: 'My Farm',
    name: 'Adding a plot by hand, after the farm already exists',
    ids: ['B1', 'B9', 'A16'],
  },
  /* THE TWO WALKS THE 13/09 CATALOGUE ROUND ADDED, declared last in this
     section so they print after the plot walks rather than in front of them.
     Both are reached from B1's More block and both end where the decision is
     actually made — the planner on the plot whose season is closing, the
     progress screen on the plot dragging the farm line down. */
  {
    section: 'My Farm',
    name: 'Planning what follows this season',
    ids: ['B1', 'B7', 'B3', 'B4'],
  },
  {
    section: 'My Farm',
    name: 'Reading the year, and the plots behind it',
    ids: ['B1', 'B8', 'B2'],
  },

  /* -- Map --------------------------------------------------------------- */
  {
    section: 'Map',
    name: 'Finding a plot on the map and correcting its boundary',
    ids: ['C1', 'C2', 'C3', 'C5'],
  },
  { section: 'Map', name: 'Comparing two dates', ids: ['C1', 'C4'] },

  /* -- Advice ------------------------------------------------------------ */
  {
    section: 'Advice',
    name: 'Reading a piece of advice and sending it on',
    ids: ['D1', 'D2'],
  },
  { section: 'Advice', name: 'The other two kinds of advice', ids: ['D1', 'D3', 'D4'] },
  /* 701, AND THE ONE JOURNEY THAT RUNS THE OTHER WAY. Every other walk in this
     section is the app raising something with the farmer; this is the farmer
     raising something with the app, and it ends in the directory because a
     diagnosis he cannot follow up is a diagnosis he ignores. */
  {
    section: 'Advice',
    name: 'Checking damage from a photograph',
    ids: ['D1', 'D5', 'D6', 'F16'],
  },

  /* -- More -------------------------------------------------------------- */
  { section: 'More', name: 'What the plan covers, and what it costs', ids: ['F1', 'F5', 'F6'] },
  { section: 'More', name: 'Settings', ids: ['F1', 'F7', 'F8', 'F9', 'F10'] },
  // The reference library, reached from Help when the farmer is not already
  // looking at the crop or the risk that raised the question.
  {
    section: 'More',
    name: 'Looking a crop or a disease up',
    ids: ['F1', 'F12', 'F13', 'F14', 'F15', 'F16'],
  },
];

/**
 * The flow to print beside a screen, given the section the page is filed under.
 *
 * Section first, so the journey matches the context the reviewer is in; any
 * flow containing the screen as a fallback, so a screen that is only ever
 * reached from elsewhere still gets a path rather than a blank column.
 */
export function flowFor(id, sectionName) {
  return FLOWS.find((f) => f.section === sectionName && f.ids.includes(id))
    ?? FLOWS.find((f) => f.ids.includes(id))
    ?? null;
}

/* Screens that need a parameter get a sensible default when jumped to directly
   from the index, so no entry in the list ever opens a broken screen. */
const DEFAULT_PARAMS = {
  // B1 opens on the MIXED farm rather than on farm-1. The merged screen exists
  // to show crops and tree groups as two blocks, and farm-1 is twelve date-palm
  // plots folded into a single group — a perfect demonstration of the fold and
  // a poor one of the screen. B2/B3/B4 open on the plot that is between crops:
  // the satellite has seen it harvested and the farmer has not said what went
  // in, which is the state the review asked for and the only one worth a page.
  /* B2 OPENS ON A PLOT THAT HAS A CROP. Review 21/09 (second pass): "make sure
     the plot selected for this example screen is a plot where we already know
     what's growing there. Plot 2 for Al Kharj South does not have a crop
     defined." He is right — plot-23 carries a detected harvest, so B2 drew its
     no-crop state and the deck's only picture of a plot was the empty one.
     plot-22 is mid-season wheat, which is what the screen is for. B3 and B4
     stay on plot-23 deliberately: the cycle list and the blocked-cycle banner
     are both worth seeing, and the harvest is what makes them interesting. */
  B1: 'farm-3', B11: 'farm-1', B10: 'farm-1', B2: 'plot-22', B3: 'plot-23', B4: 'plot-23',
  // The planner and the progress screen open on the MIXED farm, for the same
  // reason B1 does: farm-1 is one standing planting of date palms, which draws
  // a calendar with a single row on it and a year-long line with nothing to
  // compare against. farm-3 has eight plots, four crops and a season closing.
  B7: 'farm-3', B8: 'farm-3',
  B5: 'tg-01', B6: 'T-2841',
  // A16 opens on the farm whose survey has come back. A17 deliberately opens
  // WITHOUT one: with a farm still surveying it correctly shows the "no price
  // until the survey is confirmed" state of WF4.091, which is worth seeing but
  // is not what the screen is for.
  A16: 'farm-6',
  // A19 opens on the same farm A16 does, so the two pages at the end of
  // registration are about one holding rather than two.
  A19: 'farm-6',
  C3: 'plot-23', C5: 'plot-23', D2: 'adv-01', D3: null, D4: null,
  // The two directories print twice each: the list, and one entry worth
  // reading. A date palm and the weevil that decides whether a block of them
  // survives are the pair this region opens the book at.
  F14: 'date-palm', F16: 'red-palm-weevil', D6: 'leaf',
  F3: 'farm-1', F4: 'farm-1', F11: 'all', F12: '',
};

for (const [id, param] of Object.entries(DEFAULT_PARAMS)) {
  if (SCREENS[id] && param != null) SCREENS[id].route = `${id}:${param}`;
}

/* D3/D4 need an advice item of the right type; resolve them from the data. */
export function resolveDefaultRoutes(db) {
  const pick = (type) => db.advice.find((a) => a.type === type && a.status !== 'superseded');
  const map = { D3: 'nutrition', D4: 'protection' };
  for (const [id, type] of Object.entries(map)) {
    const item = pick(type);
    if (item && SCREENS[id]) SCREENS[id].route = `${id}:${item.id}`;
  }
  const irrigation = pick('irrigation');
  if (irrigation) {
    SCREENS.D2.route = `D2:${irrigation.id}`;
  }
}
