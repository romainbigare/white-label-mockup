/* ---------------------------------------------------------------------------
   index.js — the screen registry.

   Every screen in the App Map of §3.2, keyed by its specification identifier.
   The registry carries the title, a one-line note and the requirement IDs each
   screen implements, which is what feeds the reviewer caption panel and the
   "All screens" index in the harness. Keeping the mapping here means the App Map
   and the build cannot drift apart unnoticed.

   Two codes here are not in the App Map, and both are sub-screens the spec
   describes but does not number:
     A9D  the drawing canvas behind A9's "Draw my plots myself" route, which
          §4.10.1 gives no code of its own
     FORGOT  password reset, reached from A3's "Forgot your password?"

   A7 is in the App Map and NOT in this registry. The 18/08 review deleted it:
   the name and password it asked for are part of creating an account and are
   collected on A5, and the land unit it also carried belongs beside the first
   area the app prints, which is A9. §4.8's requirements survive the screen —
   WF4.041, WF4.042 and WF4.044 sit on A5, WF4.043 on A9, WF4.045 on A6.
   --------------------------------------------------------------------------- */

import * as onboarding from './onboarding.js';
import * as home from './home.js';
import * as plot from './plot.js';
import * as trees from './trees.js';
import * as workforce from './workforce.js';
import * as maps from './mapscreens.js';
import * as advice from './advice.js';
import * as tasks from './tasks.js';
import * as more from './more.js';

const S = (id, title, note, reqs, render, route) => [id, { id, title, note, reqs, render, route }];

export const SCREENS = Object.fromEntries([
  /* -- First run ---------------------------------------------------------- */
  S('A1', 'Language', 'The first thing anyone sees. Choose Arabic or Pashto and the whole app turns round to read right to left.', ['WF4.011', 'WF4.012', 'WF4.013', 'WF4.014', 'WF4.015', 'WF4.016'], onboarding.A1),
  S('A2', 'Get started', 'Three doors and nothing else: come back, start fresh, or step into someone else’s farm. No fields, so no keyboard.', ['WF4.017', 'WF4.018', 'WF4.019', 'WF4.020', 'WF4.021'], onboarding.A2),
  S('A3', 'Log in', 'Coming back. A code by text is the easy road; a password is there for anyone who prefers one.', ['WF4.022', 'WF4.023', 'WF4.024', 'WF4.025'], onboarding.A3),
  S('A4', 'Guided tour', 'Five pictures of the app doing its job, in the language just chosen. It sits on the way to the sign-up form, and comes back from Help.', ['WF4.026', 'WF4.027', 'WF4.028', 'WF4.029', 'WF4.030', 'WF4.031'], onboarding.A4),
  S('A5', 'Sign up', 'The whole account on one form: a name, a number, an email and a password. The email is what lets a licence bought elsewhere find the account.', ['WF4.032', 'WF4.033', 'WF4.035', 'WF4.036', 'WF4.037', 'WF4.041', 'WF4.042', 'WF4.044'], onboarding.A5),
  S('A6', 'Verify code', 'Four digits by text, and one sentence saying where they went. It sends itself on the last one, and five wrong tries rest the account for a quarter of an hour.', ['WF4.034', 'WF4.038', 'WF4.039', 'WF4.040', 'WF4.045'], onboarding.A6),
  S('A9', 'Add your first farm', 'The moment an account becomes a farm. It is named first — nothing under the name can be decided until there is one — and then the land unit and the fork. Each route says when to choose it and leads straight to the drawing.', ['WF4.043', 'WF4.051', 'WF4.052', 'WF4.053', 'WF4.054', 'WF4.055'], onboarding.A9),
  S('A9D', 'Draw my own plots', 'Tracing each plot on satellite imagery, corner by corner, and naming it. What grows there is not asked — the imagery answers that within a fortnight.', ['WF4.056', 'WF4.057', 'WF4.058', 'WF4.059', 'WF4.060', 'WF4.061', 'WF4.062', 'WF4.063', 'WF4.064', 'WF4.065', 'WF4.066', 'WF4.067', 'WF4.068', 'WF4.069'], onboarding.A9D),
  S('A10', 'Survey my whole farm', 'One line around the growing land, with the sheds left out. A map, the instruction in the bar above it, and a button — nothing else, now that the price and the wait are asked for on the screen after this one.', ['WF4.056', 'WF4.057', 'WF4.070', 'WF4.071', 'WF4.074', 'WF4.075', 'WF4.076', 'WF4.077'], onboarding.A10),
  S('A11', 'What we found', 'The survey read your land as open field and trees. Keep what we should watch and remove what we should not, or correct it with the four tools — join, split, remove, add.', ['WF4.078', 'WF4.079', 'WF4.080', 'WF4.081', 'WF4.082', 'WF4.083', 'WF4.084', 'WF4.085', 'WF4.086', 'WF4.087', 'WF4.088'], onboarding.A11),
  S('A12', 'What should our satellite survey?', 'The last step of both routes, and the one that asks for the quote. Say what to look at — crops, trees, or both, each with how it is priced — over a boundary that has already been drawn.', ['WF4.047', 'WF4.048', 'WF4.049', 'WF4.050', 'WF4.072', 'WF4.073', 'WF4.095'], onboarding.A12),
  S('A13', 'Your plan and price', 'Two levels, priced from what the survey actually found, with the sum written out. The trial, the VAT position and the annual discount are all on the screen rather than under it.', ['WF4.089', 'WF4.090', 'WF4.091', 'WF4.092', 'WF4.093', 'WF4.094', 'WF4.098', 'WF4.099', 'WF4.100', 'WF4.101', 'WF4.102', 'WF4.103', 'WF4.106', 'WF4.107'], onboarding.A13),
  S('A14', 'You’re ready', 'The pause between setting up and starting. It says when the first satellite pass arrives, so the empty farm makes sense.', ['WF4.112', 'WF4.002'], onboarding.A14),
  S('A15', 'Join a farm', 'For someone invited to a farm they do not own. The invitation decides whether they arrive as a supervisor or a worker.', ['WF4.113', 'WF4.114', 'WF4.115', 'WF4.116', 'WF4.117'], onboarding.A15),
  S('FORGOT', 'Reset your password', 'A code by text, then a new password — all three steps its own, now that A7 is gone.', ['WF4.023'], onboarding.FORGOT),

  /* -- Home --------------------------------------------------------------- */
  S('B1', 'Home / My farms', 'How many farms need attention this morning, as one bar. A farm is judged by its worst plot, so one failing corner stays visible, and the list leads with whatever is worst.', ['WF5.001', 'WF5.002', 'WF5.003', 'WF5.004', 'WF5.005', 'WF5.006', 'WF5.007', 'WF5.009', 'WF5.011'], home.B1),
  S('B2', 'Farm detail', 'One farm at a glance: how it is today, what the weather is doing, and the way through to its plots, trees and people.', ['WF5.012', 'WF5.013', 'WF5.014', 'WF5.015', 'WF5.016', 'WF5.017'], home.B2),
  S('B3', 'Plots', 'Every plot, listed flat and sorted with the worst first, under a key saying what the colours mean. A plot in trouble carries a way straight to the advice about it.', ['WF5.018', 'WF5.019', 'WF5.020', 'WF5.021'], home.B3),
  S('B4', 'Plot detail', 'The heart of the app: what the satellite saw over one plot, and a sentence saying where the trouble is and how long it has been there.', ['WF5.022', 'WF5.023', 'WF5.024', 'WF5.025', 'WF5.026', 'WF5.027', 'WF5.028'], plot.B4),
  S('B5', 'Crop cycles', 'What has been planted here, season by season. Closing a season keeps it, which is what makes one year comparable with the last.', ['WF5.034', 'WF5.035', 'WF5.037'], plot.B5),
  S('B6', 'Add / edit crop cycle', 'Starting a new planting, or closing the one that is running. A season closes with a harvest date, and a yield if anyone weighed it.', ['WF5.034', 'WF5.036', 'WF5.038'], plot.B6),
  S('B7', 'Measure viewer', 'The plot filling the whole screen. The colours mean the same thing every week, so two dates can be trusted against each other.', ['WF5.029', 'WF5.030', 'WF5.031'], plot.B7),
  S('B8', 'Compare', 'The same plot at two dates, with a divider to drag between them. The difference is written out underneath as well.', ['WF5.032', 'WF5.033'], plot.B8),
  S('B9', 'Tree list', 'Where an orchard is counted. It opens with how the trees are spread across the four states of health, keeping the missing and the dead apart.', ['WF5.053', 'WF5.054', 'WF5.055', 'WF5.059', 'WF5.060', 'WF5.061'], trees.B9),
  S('B10', 'Tree detail', 'One tree. It begins with a map of which tree it is, because picking tree 2841 out of eight thousand is the hard part.', ['WF5.056', 'WF5.057', 'WF5.058', 'WF5.086'], trees.B10),
  S('B11', 'Farm settings', 'Names, boundaries, and the two things nobody should do by accident: handing the farm on, or getting rid of it.', ['WF5.046', 'WF5.047', 'WF5.048'], home.B11),
  S('B12', 'Add farm', 'Taking on more land. It runs the same fork as the first farm, and a farm with trees always goes through a survey because the tree count sets the price.', ['WF5.049', 'WF5.050', 'WF5.051', 'WF5.052'], home.B12),

  /* -- Workforce ---------------------------------------------------------- */
  S('G1', 'Workforce', 'Everyone who does the work, whether or not they have the app. Each row says what language their instructions go out in and which way they travel.', ['WF5.063', 'WF5.069', 'WF5.070'], workforce.G1),
  S('G2', 'Add a worker', 'A name, a number, a language, and how to reach them. The number is the identity: type one that already has an account and the record joins it, after saying whose it is.', ['WF5.063', 'WF5.065'], workforce.G2),
  S('G3', 'Worker record', 'One person at whichever stage they have reached: no account, invited, or holding the app — and the same finished work underneath all three.', ['WF4.006', 'WF4.007', 'WF4.008', 'WF5.066', 'WF5.067', 'WF5.068', 'WF5.070'], workforce.G3),

  /* -- Map ---------------------------------------------------------------- */
  S('C1', 'Map', 'The farm from above, filling the screen. A search bar stays in the open, because the point of this screen is finding something.', ['WF5.071', 'WF5.072', 'WF5.077', 'WF5.078', 'WF5.082', 'WF5.083', 'WF5.084'], maps.C1),
  S('C2', 'Layers', 'What to draw on the map, and which of the two base maps to draw it on — each described, because the difference is clarity against freshness.', ['WF5.074', 'WF5.075', 'WF5.076'], maps.C2),
  S('C3', 'Plot sheet', 'A tap on a plot, answered without leaving the map. It drags up to full height and opens the plot if you want more.', ['WF5.073'], maps.C3),
  S('C4', 'Compare dates', 'The whole farm at two dates at once, split by a line you drag across it.', ['WF5.079'], maps.C4),
  S('C5', 'Boundary editor', 'Correcting the shape of a plot after the fact, and splitting, joining, removing or adding one. The old outline is kept, with who changed it and when.', ['WF5.090', 'WF5.091', 'WF5.092', 'WF5.093'], maps.C5),

  /* -- Advice ------------------------------------------------------------- */
  S('D1', 'Advice inbox', 'The centre of the product. Each item says what to do, how much and why, arrives already written as a job, and offers four ways to deal with it.', ['WF5.094', 'WF5.095', 'WF5.096', 'WF5.097', 'WF5.098', 'WF5.099', 'WF5.100', 'WF5.101', 'WF5.102', 'WF5.103', 'WF5.104', 'WF5.105'], advice.D1),
  S('D2', 'Irrigation advice', 'How much water this week, on which days, in which two-hour window, and whether that is more or less than usual. One schedule, for the plot.', ['WF5.111', 'WF5.112', 'WF5.113', 'WF5.114', 'WF5.115', 'WF5.116', 'WF5.117', 'WF5.118'], advice.D2),
  S('D3', 'Nutrition advice', 'How much nitrogen, phosphate or potash the crop is short of, per hectare. The choice of product is left to whoever buys it.', ['WF5.119', 'WF5.120'], advice.D3),
  S('D4', 'Crop protection advice', 'The active ingredient, and the date after which the crop is safe to pick. The reminder to read the label stays on the screen.', ['WF5.121', 'WF5.122', 'WF5.123', 'WF5.124', 'WF5.125', 'WF5.126'], advice.D4),
  S('D6', 'Weather alert', 'What is coming, when it arrives, and what it means for this farm in particular.', ['WF5.127', 'WF5.128'], advice.D6),
  S('D7', 'Record what you did', 'Writing down a job already done. Three taps for the ordinary case, and it works in the field with no signal.', ['WF5.129', 'WF5.130', 'WF5.131', 'WF5.132'], advice.D7),

  /* -- Tasks -------------------------------------------------------------- */
  S('E1', 'Tasks / My Work', 'The day’s work — meaning work somebody has actually been given. Anything overdue sits at the top and looks different. A worker sees only their own.', ['WF5.133', 'WF5.134', 'WF5.135', 'WF5.136', 'WF5.137', 'WF5.139', 'WF5.140', 'WF5.141'], tasks.E1),
  S('E2', 'Task detail', 'What one job involves. A worker’s version is pared back to what, how much, where, when, and one large button.', ['WF5.148', 'WF5.149', 'WF5.150'], tasks.E2),
  S('E3', 'New task', 'Turning a recommendation into work for a particular person. Most of it is already written down; what is left is who, and by when.', ['WF5.143', 'WF5.144', 'WF5.145', 'WF5.146', 'WF5.147'], tasks.E3),
  S('E4', 'Complete task', 'Marking a job finished, with a photo and a note if there is time for them. It confirms on the spot, signal or no signal.', ['WF5.151', 'WF5.152', 'WF5.153'], tasks.E4),
  S('E6', 'Field observation', 'Something noticed while walking the field: a photograph, what it was, how bad it looked, and where it was standing.', ['WF5.154', 'WF5.155', 'WF5.156', 'WF5.157', 'WF5.159'], tasks.E6),
  S('E7', 'Photo disease check', 'A photograph of a leaf and a guess at what is wrong with it, said with how sure the guess is and an easy way to disagree.', ['WF5.158', 'WF6.028'], tasks.E7),

  /* -- More --------------------------------------------------------------- */
  S('F0', 'More', 'Everything outside the day’s work. What appears depends on who is looking.', ['WF5.160', 'WF5.161'], more.F0),
  S('F1', 'Reports', 'The farm written up for a week, a season, or a bank. It comes back as a document in whichever language was asked for.', ['WF5.162', 'WF5.163', 'WF5.164', 'WF5.165', 'WF5.166', 'WF5.167'], more.F1),
  S('F5', 'Subscription', 'What is being paid for and when it renews, with the sum shown. Where it was bought decides what this screen may offer.', ['WF5.174', 'WF5.175', 'WF5.176', 'WF5.177', 'WF5.178', 'WF5.179'], more.F5),
  S('F6', 'Compare plans', 'What Basic includes and what Pro adds, group by group, for whichever service the account holds.', ['WF9.001', 'WF9.002', 'WF9.003'], more.F6),
  S('F7', 'Settings', 'Shared phones, fingerprint locks, the legal documents, and closing the account for good.', ['WF5.185', 'WF5.186'], more.F7),
  S('F8', 'Language and region', 'Language, land area, water, numerals and calendar. Each one takes hold the moment it is changed.', ['WF5.180', 'WF5.181', 'WF10.019', 'WF10.020'], more.F8),
  S('F9', 'Notifications', 'Which messages arrive, by what means, and when to keep quiet. Anything about safety keeps coming through.', ['WF5.182', 'WF7.006', 'WF7.007', 'WF7.008'], more.F9),
  S('F10', 'Data and storage', 'How much of the phone the app has taken up, whether to wait for Wi-Fi, and what is still waiting to be sent.', ['WF5.183', 'WF5.184', 'WF11.002', 'WF11.003'], more.F10),
  S('F11', 'Activity log', 'Who did what, when, and on which farm. Entries are added and never edited afterwards, which is the point of it.', ['WF5.187', 'WF5.188'], more.F11),
  S('F12', 'Help and user guide', 'Answers to the questions that come up most, a glossary for the agronomy words the app uses, and the tour again for anyone who skipped it.', ['WF4.030', 'WF5.189', 'WF10.012'], more.F12),
  S('F13', 'Contact Wafra', 'Two large buttons, call or message, and a slower route for anything that needs a written record.', ['WF5.190', 'WF5.191', 'WF5.192', 'WF5.193', 'WF5.194'], more.F13),
  S('F14', 'My profile', 'Name and email can be changed here. The phone number stays: it is the account.', ['WF4.032', 'WF4.033'], more.F14),
]);

/* Grouping for the harness "All screens" index — mirrors §3.2. */
export const SCREEN_GROUPS = [
  // The 21/08 review reordered the middle of this: the farm is named and
  // forked on A9, drawn on A10 or A9D, and only then asked what to cover.
  { name: 'First run', ids: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A9', 'A10', 'A9D', 'A12', 'A11', 'A13', 'A14', 'A15', 'FORGOT'] },
  { name: 'Home', ids: ['B1', 'B2', 'B3', 'B11', 'B12'] },
  { name: 'Plots', ids: ['B4', 'B5', 'B6', 'B7', 'B8'] },
  { name: 'Trees', ids: ['B9', 'B10'] },
  { name: 'Workforce', ids: ['G1', 'G2', 'G3'] },
  { name: 'Map', ids: ['C1', 'C2', 'C3', 'C4', 'C5'] },
  { name: 'Advice', ids: ['D1', 'D2', 'D3', 'D4', 'D6', 'D7'] },
  { name: 'Tasks', ids: ['E1', 'E2', 'E3', 'E4', 'E6', 'E7'] },
  { name: 'More', ids: ['F0', 'F1', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14'] },
];

/* The paths through the app, as a farmer actually walks them.

   SCREEN_GROUPS says which drawer a screen is filed in; this says what it comes
   after and what it leads to, which is a different question and the one a
   reviewer asks. Registration is two paths rather than one because A9 forks,
   and the fork is the whole point of that screen.

   Every step here is a route the code actually takes — traced from the go()
   calls, not from the App Map — so a flow that stops being true stops being
   true here too. A screen may appear in more than one; anything reading this
   for a single answer should take the first flow that contains it, which is
   why the two registration paths come first.

   Not every screen is on a flow. Settings, reports and the map are places you
   go rather than steps you pass through, and inventing a path through them
   would be drawing a line that nobody walks. */
export const FLOWS = [
  // A9 forks, so signing up is two paths that rejoin at A12. The names are
  // written the way the farmer would describe what he is doing, not the way the
  // App Map labels it — a reviewer reading "A9 → A10 → A12" over a screenshot
  // needs telling what that person came here to do.
  { name: 'Signing up, and we survey the whole farm', ids: ['A1', 'A2', 'A4', 'A5', 'A6', 'A9', 'A10', 'A12', 'A11', 'A13'] },
  { name: 'Signing up, and drawing my own plots', ids: ['A1', 'A2', 'A4', 'A5', 'A6', 'A9', 'A9D', 'A12', 'A13', 'A14'] },
  { name: 'Coming back and logging in', ids: ['A2', 'A3', 'A6'] },
  { name: 'I have forgotten my password', ids: ['A2', 'A3', 'FORGOT', 'A6'] },
  { name: 'Joining a farm I was invited to', ids: ['A2', 'A15'] },
  { name: 'Adding another farm later on', ids: ['B12', 'A10', 'A12', 'A13'] },
  { name: 'From all my farms down to one plot', ids: ['B1', 'B2', 'B3', 'B4', 'B7'] },
  { name: 'Turning advice into work that gets done', ids: ['D1', 'D2', 'E2', 'D7'] },
  { name: 'Checking on the trees', ids: ['B2', 'B9', 'B10'] },
  { name: 'Setting up the people who do the work', ids: ['B2', 'G1', 'G2', 'G3'] },
];

/* Screens that need a parameter get a sensible default when jumped to directly
   from the index, so no entry in the list ever opens a broken screen. */
const DEFAULT_PARAMS = {
  B2: 'farm-1', B3: 'farm-1', B11: 'farm-1', B4: 'plot-04', B5: 'plot-04', B6: 'plot-04',
  B7: 'plot-04|ndwi', B8: 'plot-04', B9: 'farm-1', B10: 'T-2841',
  G1: 'farm-1', G2: 'farm-1', G3: 'w-1',
  // A11 opens on the farm whose survey has come back. A13 deliberately opens
  // WITHOUT one: with a farm still surveying it correctly shows the "no price
  // until the survey is confirmed" state of WF4.091, which is worth seeing but
  // is not what the screen is for.
  A11: 'farm-6',
  C3: 'plot-04', C5: 'plot-04', D2: 'adv-01', D3: null, D4: null, D6: 'farm-1', D7: 'adv-01',
  E2: 'task-01', E3: '', E4: 'task-01', E6: '', E7: 'plot-04',
  F1: 'farm-1', F11: 'all', F12: '',
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
    SCREENS.D7.route = `D7:${irrigation.id}`;
  }
}
