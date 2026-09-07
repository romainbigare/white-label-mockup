/* ---------------------------------------------------------------------------
   index.js — the screen registry.

   Every screen in the App Map of §3.2, keyed by its specification identifier.
   The registry carries the title, a one-line note and the requirement IDs each
   screen implements, which is what feeds the reviewer caption panel and the
   "All screens" index in the harness. Keeping the mapping here means the App Map
   and the build cannot drift apart unnoticed.

   Two codes here are not in the App Map, and both are sub-screens the spec
   describes but does not number:
     A10D  the drawing canvas behind A9's "Draw my own plots" route, which
          §4.10.1 gives no code of its own
     FORGOT  password reset, reached from A3's "Forgot your password?"

   A7 is in the App Map and NOT in this registry. The 18/08 review deleted it:
   the name and password it asked for are part of creating an account and are
   collected on A5, and the land unit it also carried belongs beside the first
   area the app prints, which is A9. §4.8's requirements survive the screen —
   WF4.041, WF4.042 and WF4.044 sit on A5, WF4.043 on A9, WF4.045 on A6.

   A2 has gone the same way, at the 22/08 review, which asked twice whether it
   could be merged into A3 and asked for its contents to be moved there. Three
   doors of equal weight is a decision the app can make for the farmer: logging
   in is the common case, so A3 is the front door and the other two doors are
   links beneath the form. §4.5 survives the screen — WF4.017's ban on a login
   form was about the ROUTING screen and dies with it, WF4.020's language
   control is in A3's app bar, and WF4.018's tour now runs before either.

   WHAT v1.5.4 DELETED, AND WHY NONE OF IT IS A GAP.

     B3   merged into B2. The farm screen and the list of its plots were the
          same screen asked for twice; B2 is now the farm AND every plot on it.
     B1   the list of farms. A list of farms is a picker, and a picker belongs
          in the app bar — it is the FARM_SWITCH sheet, opened from the farm
          name on B2, and it carries Add a farm too.
     B7, B8   the full-screen measure viewer and the date comparison. Both were
          the MAP, rebuilt at plot scope and reachable from nowhere else. B4's
          third map button hands the plot to C1 instead.
     B9   every tree on a farm, behind a plot filter. Replaced by B13, the tree
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
   is fulfilling. After A10 he should go to A11. It is too early for him to
   request a quote." It was the screen that asked for the quote and explained
   what the survey covers, and both halves had already moved: the explanation is
   the tour's second panel, and the quote is asked for on A11, where the farmer
   is looking at what he would be quoted on. A10 now makes the farm, runs the
   survey and says when the answer comes.

   Two codes are new. **F15 Weather** is the block that came off B2 — a forecast
   is something to look up, not something to be shown every time the app opens.
   **B13 Tree group** is what B9 became.

   A third was added and withdrawn inside one review: **A13B Confirm and pay**,
   for the marker between A13 and A14. The second pass of the same review took
   it out — "it wasn't there before and shouldn't be there now" — so the payment
   page stays a conversation rather than a screen.

   WHAT v1.5.8 DID TO THE FIRST RUN. Review 06/09 struck out two screens and
   drew a third.

     A1   was the language chooser and is now the WELCOME screen: what the app
          does, in one sentence, before it asks anything. "First screen tells
          users what we do (to avoid any misunderstanding)."
     A1B  is new — the language sheet A1's corner chip raises, modelled on the
          reference the reviewer pasted in, and carrying his ten languages.
     A4   the tour's opening panel, the last one still illustrated by an icon,
          was struck through corner to corner and marked "Delete". The tour is
          five panels, so it runs A4 … A4D and A4E has gone.

   Two are renamed: A9D is **A10D**, because it is the drawing canvas and it
   belongs beside A10, the other one; and A11 is **Survey results**, which is
   what the review calls it and what it now says on the screen.
   --------------------------------------------------------------------------- */

import * as onboarding from './onboarding.js';
import * as home from './home.js';
import * as plot from './plot.js';
import * as trees from './trees.js';
import * as maps from './mapscreens.js';
import * as advice from './advice.js';
import * as more from './more.js';

/* A screen. The last argument is for the one thing only some screens have:
     route  a hash route that differs from the id */
const S = (id, title, note, reqs, render, { route } = {}) =>
  [id, { id, title, note, reqs, render, route }];

export const SCREENS = Object.fromEntries([
  /* -- First run, and coming back ------------------------------------------
     Registered in one block because the registry is keyed by id and the App Map
     numbers them together; SCREEN_GROUPS below is what files them into the two
     sections the deck prints. */
  S('A1', 'Welcome', 'The first thing anyone sees, once, on the first launch: the mark and one sentence saying what the app does, centred, with the address at the foot. Next takes the tour and Skip goes straight to the sign-up form. Registered users see neither — they open on A3.', ['WF4.011', 'WF4.014', 'WF4.018'], onboarding.A1),
  S('A1B', 'Choose your language', 'Not a screen — a pop-up sheet over A1, raised by the globe in its corner and closed by choosing a row. It has a page here because a printed deck cannot show a state of another screen any other way. Ten languages, each in its own script with its code beside it; pressing one turns the whole app round if it reads right to left, and closes the sheet. It is where Arabic and Pashto are chosen, and it is one tap from the corner of A1.', ['WF4.011', 'WF4.012', 'WF4.015', 'WF4.016'], onboarding.A1B),
  S('A3', 'Log in', 'The way back in for somebody the app has already met, and only for them. It opens with the reason it is open at all — Face ID did not recognise him — then greets him by name and offers a password or a code to the registered email address. No app bar: the screen says "Welcome back" and does not also need a title saying "Log in". Creating an account and joining a farm as a guest are on A5, which is where a stranger lands.', ['WF4.022', 'WF4.023', 'WF4.024', 'WF4.025'], onboarding.A3),
  S('A4', 'Guided tour — 1 of 5', 'How the service works, and the first of five pictures of the app doing its job, in the language just chosen. Next on A1 opens it and Help brings it back. Illustrated by a satellite over the same synthesised farmland the map screens draw.', ['WF4.026', 'WF4.027', 'WF4.028', 'WF4.029', 'WF4.030', 'WF4.031'], onboarding.A4),
  S('A4A', 'Guided tour — 2 of 5', 'The farm planner, illustrated by D1 and F9 themselves. In the app these five are one carousel; on paper each needs a page of its own, or four of the five are never seen.', ['WF4.026', 'WF4.027', 'WF4.028'], onboarding.A4A),
  S('A4B', 'Guided tour — 3 of 5', 'Irrigation and fertilisation advice, illustrated by D2 and D3.', ['WF4.026', 'WF4.027', 'WF4.028'], onboarding.A4B),
  S('A4C', 'Guided tour — 4 of 5', 'Optimising crop yields, illustrated by B5 and B6.', ['WF4.026', 'WF4.027', 'WF4.028'], onboarding.A4C),
  S('A4D', 'Guided tour — 5 of 5', 'What the farmers already using it get out of it, and the panel that hands on to the front door. The only one that argues with figures, and the only one drawn as a funnel: three savings narrowing into one.', ['WF4.026', 'WF4.029', 'WF4.031'], onboarding.A4D),
  S('A5', 'Sign up', 'The whole account on one form, and since review 06/09 the email address is the account: a first and last name, an optional company, the address, a number from any country in the world, and a password. The two doors that used to be on A3 are at the foot of it.', ['WF4.032', 'WF4.033', 'WF4.035', 'WF4.036', 'WF4.037', 'WF4.041', 'WF4.042', 'WF4.044'], onboarding.A5),
  S('A6', 'Verify code', 'Four digits to the registered email address, and one sentence saying where they went. The boxes are real inputs, so the phone raises its own keyboard and can fill the code in itself; it sends on the last digit, and five wrong tries rest the account for a quarter of an hour. A brand new account is asked about Face ID here and nowhere else.', ['WF4.034', 'WF4.038', 'WF4.039', 'WF4.040', 'WF4.045'], onboarding.A6),
  S('A9', 'Add your first farm', 'The moment an account becomes a farm: its name, the unit its land is measured in, and what is growing on it. Everything under the name is a decision about one particular farm, so the name is asked first, and a Continue button carries the answers to the fork.', ['WF4.043', 'WF4.051', 'WF4.053', 'WF4.055'], onboarding.A9),
  S('A9B', 'Choose survey or draw', 'The fork, and the whole of what used to be B12. Both routes are always offered here, with the reason for each — because the only farms that reach this screen are farms of field crops. A farm with any trees on it never sees it: trees are counted one by one from the imagery, the count sets the price, and A9 sends such a farm straight to A10 with the reason on A9 itself. It is printed AFTER A9 in the deck by design: A9 asks what is growing, and that answer is what decides whether this screen appears at all, so the fork cannot be asked first.', ['WF4.052', 'WF4.054', 'WF5.049', 'WF5.050', 'WF5.051', 'WF5.052'], onboarding.A9B),
  S('A10D', 'Draw my own plots', 'Drawing each plot on satellite imagery, corner by corner, and naming it. One plot is one crop, which is why the boundary is the only thing this route asks for before the summary.', ['WF4.056', 'WF4.057', 'WF4.058', 'WF4.059', 'WF4.060', 'WF4.061', 'WF4.062', 'WF4.063', 'WF4.064', 'WF4.066', 'WF4.067', 'WF4.068', 'WF4.069'], onboarding.A10D),
  S('A10', 'Survey my whole farm', 'One line around the growing land, with the sheds left out. A map, the instruction in the bar above it, and one button, which requests the survey and says when the answer comes back. Opened with a farm id it edits that farm’s outline instead.', ['WF4.056', 'WF4.057', 'WF4.070', 'WF4.071', 'WF4.074', 'WF4.075', 'WF4.076', 'WF4.077'], onboarding.A10),
  S('A11', 'Survey results', 'The end of both routes: the plots the survey found, or the plots the farmer drew, as one list to approve, over the farm’s own outline. Every row offers all three of Keep, Edit and Remove, one button underneath adds a plot that is missing, and the app bar carries the way back to the boundary.', ['WF4.078', 'WF4.079', 'WF4.080', 'WF4.081', 'WF4.082', 'WF4.083', 'WF4.084', 'WF4.085', 'WF4.086', 'WF4.087', 'WF4.088', 'WF4.065'], onboarding.A11),
  S('A13', 'Your plan and price for new users', 'Two levels, priced from what the survey actually found. No cost per hectare, because a farm of crops and trees is priced two ways at once; the quantities are on the card above and the way back to the plot list is at the bottom. F5 is the same question for an account that already has one.', ['WF4.089', 'WF4.090', 'WF4.091', 'WF4.092', 'WF4.093', 'WF4.094', 'WF4.098', 'WF4.099', 'WF4.100', 'WF4.101', 'WF4.102', 'WF4.103', 'WF4.106', 'WF4.107'], onboarding.A13),
  S('A14', 'You’re ready', 'The pause between setting up and starting. It says when the first satellite pass arrives, so the empty farm makes sense.', ['WF4.112', 'WF4.002'], onboarding.A14),
  S('A15', 'Join a farm as a guest', 'For someone invited to a farm they do not own — which is what “as a guest” says before they tap. Six digits typed in, or the QR code read off the phone of the person who set the account up, which is where review 06/09 put it: one phone shows, one phone scans.', ['WF4.113', 'WF4.114', 'WF4.115', 'WF4.116', 'WF4.117'], onboarding.A15),
  S('FORGOT', 'Reset your password', 'A temporary code to the registered email address, then a new password against the full rule — a letter, a number and a symbol, not just a length.', ['WF4.023'], onboarding.FORGOT),

  /* -- Home --------------------------------------------------------------- */
  S('B2', 'Farm home', 'The farm and every plot on it, on one screen — the crops first, the tree groups after. It is where a single-farm account opens, and it says one thing above the list: whether anything is urgent.', ['WF5.012', 'WF5.013', 'WF5.014', 'WF5.016', 'WF5.018', 'WF5.019', 'WF5.020', 'WF5.021'], home.B2),
  S('B4', 'Plot detail', 'One plot, opening with the thing the farmer knows and we do not: what is growing on it. Then what the satellite saw, and a sentence saying where the trouble is and how long it has been there.', ['WF5.022', 'WF5.023', 'WF5.024', 'WF5.025', 'WF5.026', 'WF5.027', 'WF5.028', 'WF5.034'], plot.B4),
  S('B5', 'Crop cycles', 'What has been planted here, season by season. Open field only — a tree group has no cycle. Closing a season keeps it, which is what makes one year comparable with the last.', ['WF5.034', 'WF5.035', 'WF5.037'], plot.B5),
  S('B6', 'Add / edit crop cycle', 'Starting a new planting, or closing the one that is running. A season closes with a harvest date, and a yield if anyone weighed it.', ['WF5.034', 'WF5.036', 'WF5.038'], plot.B6),
  S('B13', 'Tree group', 'One species of tree, wherever it stands on the farm: where the trees are, what the satellite reads over them, how they are spread across the four states of health, and every tree in the group. Opened by pressing a tree group in the plot list.', ['WF5.041', 'WF5.045', 'WF5.053', 'WF5.054', 'WF5.055', 'WF5.059', 'WF5.060', 'WF5.061'], trees.B13),
  S('B10', 'Tree detail', 'One tree. It begins with a map of which tree it is, because picking tree 2841 out of eight thousand is the hard part.', ['WF5.056', 'WF5.057', 'WF5.058', 'WF5.086'], trees.B10),
  S('B14', 'Manage workforce', 'The people work is sent to on this farm: a name, a number and the app each of them actually reads. Nobody here holds an account — an advice reaches them as a message with a link — except the one person invited as supervisor. It is an address book, not the permission matrix the v1.5.4 review deleted.', ['WF8.003', 'WF8.005'], home.B14),
  S('B11', 'Farm settings', 'Names, boundaries, and the two things nobody should do by accident: handing the farm on, or getting rid of it.', ['WF5.046', 'WF5.047', 'WF5.048'], home.B11),

  /* -- Map ---------------------------------------------------------------- */
  S('C1', 'Map', 'The farm from above, filling the screen. A search bar stays in the open, because the point of this screen is finding something, and the farm’s own outline is drawn round its plots in a line heavy enough to read against sand or crop.', ['WF5.071', 'WF5.072', 'WF5.077', 'WF5.078', 'WF5.082', 'WF5.083', 'WF5.084'], maps.C1),
  S('C2', 'Layers', 'What to draw on the map, and which of the two pictures to draw it on — each described, because the difference is clarity against freshness and both carry the monitoring result. The layer list names what each layer tells you and no longer names the index behind it.', ['WF5.074', 'WF5.075', 'WF5.076'], maps.C2),
  S('C3', 'Plot sheet', 'A tap on a plot, answered without leaving the map. It drags up to full height and opens the plot if you want more.', ['WF5.073'], maps.C3),
  S('C4', 'Compare dates', 'The whole farm at two dates at once, split by a line you drag across it. It opens a week apart — an interval, resolved to the last satellite pass before the mark, rather than a count of passes that could mean anything.', ['WF5.079'], maps.C4),
  S('C5', 'Boundary editor', 'Correcting the shape of a plot after the fact, and splitting, joining, removing or adding one. The old outline is kept, with who changed it and when.', ['WF5.090', 'WF5.091', 'WF5.092', 'WF5.093'], maps.C5),

  /* -- Advice ------------------------------------------------------------- */
  S('D1', 'Advice inbox', 'The centre of the product. Each item is three lines — how urgent and what kind, which ground, and what to do — with the detail one tap away on D2, D3 or D4. Three menus screen the list and a fourth orders it: by delivery time, by severity or by field.', ['WF5.094', 'WF5.095', 'WF5.096', 'WF5.097', 'WF5.098', 'WF5.099', 'WF5.100', 'WF5.101', 'WF5.102', 'WF5.103', 'WF5.104', 'WF5.105'], advice.D1),
  S('D2', 'Irrigation advice', 'How much water this week, on which days, in which two-hour window, and whether that is more or less than usual. One schedule, for the plot.', ['WF5.111', 'WF5.112', 'WF5.113', 'WF5.114', 'WF5.115', 'WF5.116', 'WF5.117', 'WF5.118'], advice.D2),
  S('D3', 'Fertilisation advice', 'How much nitrogen, phosphate or potash the crop is short of, per hectare, with the common products that supply it. The Monday review settled the word: nutrition was ambiguous, fertilisation is what a farmer buys.', ['WF5.119', 'WF5.120'], advice.D3),
  S('D4', 'Crop protection advice', 'The active ingredient, and the date after which the crop is safe to pick. The reminder to read the label stays on the screen.', ['WF5.121', 'WF5.122', 'WF5.123', 'WF5.124', 'WF5.125', 'WF5.126'], advice.D4),

  /* -- More --------------------------------------------------------------- */
  S('F0', 'More', 'Everything outside the day’s work. What appears depends on who is looking.', ['WF5.160', 'WF5.161'], more.F0),
  S('F1', 'Reports', 'The farm written up for a week, a season, or a bank. It comes back as a document in whichever language was asked for.', ['WF5.162', 'WF5.163', 'WF5.164', 'WF5.165', 'WF5.166', 'WF5.167'], more.F1),
  S('F15', 'Weather', 'The forecast, and any warning attached to it. It came off the farm screen in the v1.5.4 review — it is a thing to look up rather than a thing to be shown every time the app opens.', ['WF5.015'], more.F15),
  S('F5', 'Subscription info for existing users', 'What is being paid for and when it renews, with the sum shown. Where it was bought decides what this screen may offer, and since review 06/09 three jobs that were a phone number are rows: an invoice, switching the cycle or the level, and team members. A13 is the same question for an account that does not have one yet.', ['WF5.174', 'WF5.175', 'WF5.176', 'WF5.177', 'WF5.178', 'WF5.179'], more.F5),
  S('F6', 'Compare plans', 'The reviewer\u2019s own list of nineteen features, drawn from the supplier document: fifteen that differ between Basic and Pro, and four that both carry as anchors. One flat table with a sticky header, no crop/tree tabs and no prices \u2014 A13 and F5 are the screens with a figure on them, and both link here.', ['WF9.001', 'WF9.002', 'WF9.003'], more.F6),
  S('F7', 'Settings', 'The language menu itself, the way through to units, notifications and storage, shared phones, Face ID, the legal documents, and closing the account for good.', ['WF5.185', 'WF5.186'], more.F7),
  S('F8', 'Units and formats', 'Land area, water, temperature, calendar, time and numerals, each in a section of its own. The calendar offers Gregorian, both, or Hijri — single, double, single.', ['WF5.180', 'WF5.181', 'WF10.019', 'WF10.020'], more.F8),
  S('F9', 'Advice distribution', 'A standing rule for where each kind of advice goes: irrigation, fertilisation and crop protection, each by SMS, WhatsApp or Telegram, each naming the people on the team who receive it.', ['WF5.182', 'WF7.006', 'WF7.007', 'WF7.008'], more.F9),
  S('F10', 'Data and storage', 'How much of the phone the app has taken up, whether to wait for Wi-Fi, and what is still waiting to be sent.', ['WF5.183', 'WF5.184', 'WF11.002', 'WF11.003'], more.F10),
  S('F11', 'Activity log', 'Who did what, when, and on which farm. Entries are added and never edited afterwards, which is the point of it.', ['WF5.187', 'WF5.188'], more.F11),
  S('F12', 'Help and user guide', 'Answers to the questions that come up most, a glossary for the agronomy words the app uses, and the tour again for anyone who skipped it.', ['WF4.030', 'WF5.189', 'WF10.012'], more.F12),
  S('F13', 'Contact Wafra', 'Two large buttons, call or message, and a slower route for anything that needs a written record.', ['WF5.190', 'WF5.191', 'WF5.192', 'WF5.193', 'WF5.194'], more.F13),
  S('F14', 'My profile', 'Contact details, and nothing else since review 06/09: a first and last name, the number and the address, all of them editable. Committing the screen sends a code to the number and hands to A6, because the number is the one detail here that has to be proved.', ['WF4.032', 'WF4.033'], more.F14),
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
  A3: [
    'Most users sign in with Face ID. This screen is drawn only when Face ID fails, which is what the notice at the top of it says.',
    'Creating an account and joining a farm as a guest are on A5, which is where somebody the app has never met lands.',
    'A code can be sent to the registered email address instead of a password.',
    '“Switch account” is for a farmer holding several accounts for different farms.',
  ],
  A5: [
    'This screen is shown to new users only. Anyone already registered goes straight to A3.',
  ],
  C3: [
    'The plot sheet is a pop-up panel that appears when the user taps a plot on the map. It shows the general metrics for the plot selected, and opens the full plot screen if he wants more.',
  ],
  C5: [
    'The boundary editor corrects the shape of one outline after the fact — a plot the survey drew slightly wrong, or a farm outline that has changed. Drag a corner to move it, add or remove corners, and split, join or remove the shape.',
    'The old outline is kept, with who changed it and when, so past analytics stay attached to the shape that was live at the time.',
  ],
  D1: [
    'Severity: All · Urgent · Planned · Monitor.',
    'Type: All · Irrigation · Fertilisation · Crop protection.',
    'Progress: All · Not actioned yet · Shared · Done.',
    'Sort by: Delivery time · Severity · Field. The order also sets the headings, so a list sorted by field is grouped by field.',
  ],
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
  // it: language, tour, the front door, then making an account and a farm. A3
  // is in it, after A4, because a first-time farmer does pass through the login
  // screen — Create an account is a link on it — and the deck reads as the
  // journey rather than as a filing system. What is left in the second section
  // is what A3 leads to for somebody who is not registering: the password reset
  // and redeeming an invitation.
  //
  // The 21/08 review reordered the middle of the first section: the farm is
  // named and forked on A9, drawn on A10 or A10D, and only then asked what to
  // cover. The 22/08 review moved the tour to the front, deleted A2, and made
  // A11 the place both routes finish.
  // THE TOUR SITS SECOND, AND IT USED TO SIT LAST. It was filed at the end
  // because it was a detour — offered on A1, landing back on A3 — and five
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
  // Review 01/09 asked for A9B before A9, and the second pass of the same
  // review took that back: "let's keep it AFTER A9 in the slides, and add a
  // visible note to the powerpoint explaining it". So the deck prints the order
  // the app actually walks, and A9B's `when` line carries the explanation —
  // which is better than the reordering was, because a page out of order says
  // nothing about why while a note on the page does.
  { name: 'First run', ids: ['A1', 'A1B', 'A4', 'A4A', 'A4B', 'A4C', 'A4D', 'A5', 'A6', 'A9', 'A9B', 'A10', 'A10D', 'A11', 'A13', 'A14'] },
  // A3 IS IN THIS SECTION ONLY, AND IT USED TO BE IN BOTH. It was filed under
  // First run as well, because "a first-time farmer does pass through the login
  // screen — Create an account is a link on it". Review 06/09 took that link
  // off A3 and put it on A5: the login screen is now shown only to somebody the
  // app has already met, so a first-run walk that passes through it is a walk
  // through a door nobody in that section can open.
  { name: 'Log in', ids: ['A3', 'FORGOT', 'A15'] },
  // ONE SECTION FOR THE FARM AND EVERYTHING ON IT. Plots and tree groups had a
  // section title page each, which put two dividers between the farm and the
  // plot you reach from it — and a plot is not a peer of the farm, it is what
  // the farm contains. B2, then a plot and its cycles, then a tree group and
  // one tree.
  { name: 'My Farm', ids: ['B2', 'B11', 'B4', 'B5', 'B6', 'B13', 'B10', 'B14'] },
  { name: 'Map', ids: ['C1', 'C2', 'C3', 'C4', 'C5'] },
  { name: 'Advice', ids: ['D1', 'D2', 'D3', 'D4'] },
  // Review 01/09 — "move My Profile (F14) to the top of the More section, as it
  // makes the flow more natural, ending with F13 · Contact Wafra". It is where
  // the profile sits on F0 itself — the card above every other row — and the
  // walk now reads the way the screen does, finishing on the way to reach a
  // person rather than on an account form.
  { name: 'More', ids: ['F0', 'F14', 'F1', 'F15', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13'] },
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
   thing the branching was trying to fix. B2 is on four different journeys — it
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
  /* Review 01/09 deleted a step and added one.

     A12 IS GONE. "Not sure what purpose this screen is fulfilling. After A10
     he should go to A11. It is too early for him to request a quote." So A10
     requests the survey itself, says so in a pop-up, and hands to A11.

     THE ONE THING THAT IS NOT HERE is the fork moving in front of A9. The
     review asked for A9B before A9 and then, on the second pass, asked for the
     deck to keep the order it had with a note explaining why — which is what
     A9B's `when` line now carries. The reason the code cannot follow the first
     reading: A9's "what is growing on this farm" is what decides whether the
     fork appears. A farm with trees never sees A9B — trees are counted from the
     imagery and cannot be traced by hand, settled at the 22/08 review — so
     asking the fork first would offer a date grower a route that ends in being
     told he cannot take it. Still open, and now said out loud on the page. */
  {
    section: 'First run',
    name: 'Signing up, and we survey the whole farm',
    // F6 sits between the price and the confirmation because that is where a
    // farmer actually opens it: A13 offers two levels and a figure, and the
    // question it raises — what is the difference — is one tap away and comes
    // straight back here.
    ids: ['A1', 'A1B', 'A4', 'A5', 'A6', 'A9', 'A9B', 'A10', 'A11', 'A13', 'F6', 'A14'],
  },
  {
    section: 'First run',
    name: 'Signing up, and drawing my own plots',
    ids: ['A9', 'A9B', 'A10D', 'A11', 'A13', 'F6', 'A14'],
  },
  // Declared last within First run, so the five tour pages take it and the
  // registration screens above take the two walks before it.
  {
    section: 'First run',
    name: 'The guided tour, offered from A1 and from Help',
    ids: ['A1', 'A4', 'A4A', 'A4B', 'A4C', 'A4D', 'A5'],
  },

  /* -- Log in ------------------------------------------------------------ */
  { section: 'Log in', name: 'I have forgotten my password', ids: ['A3', 'FORGOT', 'A6'] },
  { section: 'Log in', name: 'Joining a farm I was invited to', ids: ['A3', 'A15'] },

  /* -- My Farm -----------------------------------------------------------
     WHAT B2 LEADS TO IS THE PLOT, and that is the path this section prints.
     Adding a farm was the flow here for one round, which meant the busiest
     screen in the app illustrated the rarest thing anybody does on it. Adding a
     farm is A9 and A9B, it is drawn in First run, and it does not need drawing
     twice.

     Declared first within My Farm, so B2 takes it; the tree walk below picks up
     B13 and B10, which the plot walk does not contain. */
  {
    section: 'My Farm',
    name: 'From the farm to one plot, and what is growing on it',
    ids: ['B2', 'B4', 'B5', 'B6'],
  },
  {
    section: 'My Farm',
    name: 'From the farm to a tree group, and down to one tree',
    ids: ['B2', 'B13', 'B10'],
  },
  {
    section: 'My Farm',
    name: 'The people work is sent to',
    ids: ['B2', 'B14'],
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

  /* -- More -------------------------------------------------------------- */
  { section: 'More', name: 'What the plan covers, and what it costs', ids: ['F0', 'F5', 'F6'] },
  { section: 'More', name: 'Settings', ids: ['F0', 'F7', 'F8', 'F9', 'F10'] },
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
  // B2 opens on the MIXED farm rather than on farm-1. The merged screen exists
  // to show crops and tree groups as two blocks, and farm-1 is twelve date-palm
  // plots folded into a single group — a perfect demonstration of the fold and
  // a poor one of the screen. B4/B5/B6 open on the plot that is between crops:
  // the satellite has seen it harvested and the farmer has not said what went
  // in, which is the state the review asked for and the only one worth a page.
  B2: 'farm-3', B11: 'farm-1', B14: 'farm-1', B4: 'plot-23', B5: 'plot-23', B6: 'plot-23',
  B13: 'tg-01', B10: 'T-2841',
  // A11 opens on the farm whose survey has come back. A13 deliberately opens
  // WITHOUT one: with a farm still surveying it correctly shows the "no price
  // until the survey is confirmed" state of WF4.091, which is worth seeing but
  // is not what the screen is for.
  A11: 'farm-6',
  // A14 opens on the same farm A11 does, so the two pages at the end of
  // registration are about one holding rather than two.
  A14: 'farm-6',
  C3: 'plot-23', C5: 'plot-23', D2: 'adv-01', D3: null, D4: null,
  F1: 'farm-1', F15: 'farm-1', F11: 'all', F12: '',
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
