# The comments on the v1.5.4 deck — 1 September

Every annotation on `Wafra_Farm_App_Screens_v1.5.4.pptx`, traced to the element
it points at. The deck holds no PowerPoint comment threads: all of the feedback
is drawn onto the slides as peach note boxes, red highlight frames, leader
lines, strike-throughs and pasted screenshots, on **22 of the 59 pages**.

**45 changes.** 44 are in v1.5.5; the 45th is the flow-order question at the
end. One further note was answered on the slide and needed no work.

The work each one produced is in
[`Mockup_Changes_v155.md`](Mockup_Changes_v155.md).

---

## First run

| Page | Screen | What the mark points at | The comment | Where it landed |
|---|---|---|---|---|
| 4 | **A1** Language | The empty band between *You can change this later in Settings.* and the *Register / log in* button | *"Add: www.wafragreen.com"* | `BRAND.site` in `app/ui/brand.js`, printed on A1 |
| 5 | **A3** Log in | The empty area below *Invited? Join a farm as a guest*, with the top of F13 pasted in as the model | *"Add 'we are here to help' and WhatsApp and email buttons at the bottom"* | `helpBlock()` in `app/ui/components.js`, shared with F13 |
| 8 | **A9B** Survey or draw | The A9B step in the flow ribbon, with a line back to the slot ahead of A9 | *"Moved up one space to maintain continuity / A9B should come before A9"* | Deck order only — see the note at the end |
| 9 | **A9** Add your first farm | The A9 step in the ribbon, with a line forward to the slot after A9B | *"Moved down one space since A9 only applies if user selects 'Survey my whole farm'"* | As above |
| 10 | **A10** Survey my whole farm | The blue four-cornered square drawn on the map | *"The example provided to the user should have a minimum of five corners? This will tell him that he is not limited to a perfect square. The shape should not be a perfect pentagon"* | `STARTER` in `app/ui/boundaryEditor.js` — six corners, irregular |
| 10 | **A10** | The green *Continue* button | *"Change to: 'Request survey'"* | A10's dock |
| 10 | **A10** | The same button, with the wording pasted in from A14 | *"Add a pop-up screen: We will notify you when the farm monitoring results are available (usually within one day)."* | The new `NOTICE` overlay, then on to A11 |
| 11 | **A12** Your survey | The whole screen, struck through corner to corner, and its step crossed out in the ribbon | *"Delete? Not sure what purpose this screen is fulfilling. After A10 (Survey my whole farm), he should go to A11 (Survey results). It is too early for him to request a quote."* | Screen deleted from the registry and both flows |
| 12 | **A11** What we found | The page as a whole | *"Moved up one space to maintain continuity of presentation"* | Deck order |
| 12 | **A11** | The map card under *Summary of plots to be monitored.* | *"Map should be same size as A10"* | 215 dp → 420 dp |
| 12 | **A11** | The eight plot tiles on the map, with no farm boundary round them | *"We should show the farm outline that the user selected in A10 as a reference point. If the user made a mistake, he should be able to adjust the farm outline to remove plots. An alternative way for him to remove plots."* | `farm.boundary`, `farmBoundary()` in `ui/map.js`, and A10's edit mode |
| 12 | **A11** | The line *We found 8 plots inside your farm.* | *"Add: 'A plot should not have more than one crop.'"* | Second sentence of the lead |
| 12 | **A11** | The *What we will watch* panel, below the fold | *"Change to: 'What we will monitor'. Below that, we should show: Field crops 45.1 ha / Date palms 223 trees / Fruit trees 43 trees. If there is no value, we should show 0"* | Three rows always; the survey gained a tree species |
| 12 | **A11** | The *Confirm and continue* button | *"Change to: 'Request quote'"* | A11's confirm |
| 13 | **A10D** Draw my own plots | The screen as a whole | *"Let's reduce the text to show a larger map screen. We've already described what is a plot v. trees."* | Map takes at least half the screen |
| 13 | **A10D** | The small square plot drawn on the imagery | *"The example provided to the user should be have a minimum of five corners. This will tell him that he is not limited to a perfect square. Also, the plot example seems small compared to the map area."* | Same starter shape at `PLOT_SCALE` 0.55 |
| 13 | **A10D** | The *Field crops* option under *What is on this plot?* | *"Under field crops: Keep 'Priced per area', Delete 'For example: wheat, alfalfa…'. Under Date palms and fruits trees: Keep 'Price per tree', Delete 'For example: dates, olives…'"* | `COVERAGE` subtitles |
| 13 | **A10D** | The green *Done* button | *"Change to: 'Request quote'"* | A10D's dock |
| 13 | **A10D** | The gap in the ribbon between A13 and A14 | *"Add screen Axx (slide 15)"* | **A13B · Confirm and pay** |
| 14 | **A13** Your plan and price | The words *at all* in the trial promise | *"Remove 'at all'"* | `a13.trial.permission2` |
| 14 | **A13** | The *+ VAT* line under the price, on both cards | *"Move '+VAT' up one line to the right of 'month'"* | Set beside the figure |
| 14 | **A13** | The annual price and the coverage line, on both cards | *"Delete."* | Both removed; the annual rate is on A13B |
| 15 | **A14** You're ready | The word *our* in *Farm 1 has been added to our account.* | *"Change to: 'your'"* | `a14.watchlist2` |
| 16 | **A4** Guided tour 1 of 5 | The closing clauses of the body copy | *"Switch: '…improving irrigation efficiency, and applying fertilizers based on soil nutrient levels.'"* | `TOUR[0].body` |
| 16 | **A4** | The flow ribbon, with an arrow back to its start | A proposal to move the tour to the front of onboarding, with a recommended flow | **Answered on the slide:** *"Romain, I'll explain to Hani that the order doesn't matter as they are parallel workstreams. No need to make changes."* |
| 17 | **Axx** new panel | The page, labelled top right | *"New slide"* | **A4A**, second in the tour |
| 17 | **Axx** | The illustration panel, with a satellite photograph pasted in | *"Add picture of satellite"* | `satelliteOverFarmland()` in `ui/illustrations.js` |
| 17 | **Axx** | The heading and paragraph block | *"New text: How our service works / We collect over 200 parameters from satellites that monitor your farm on a daily basis, even under cloudy conditions. / Our Artificial Intelligence (AI) models, customized for your region, analyze these parameters and provide you with data-driven advice to optimize your farm operations."* | Verbatim |
| 18 | **A4A** 2 of 5 | The green placeholder panel, with D1 and F9 pasted in | *"Add example from D1 and F9"* | Live thumbnails of D1 and F9 |
| 18 | **A4A** | The heading and paragraph block | *"Change to: Farm planner / …"* | Verbatim |
| 19 | **A4B** 3 of 5 | The illustration panel, with D2 and D3 pasted in | *"Add examples from D2 and D3"* | Live thumbnails |
| 19 | **A4B** | The heading and paragraph block | *"Change to: Irrigation and fertilization advice / …"* | Verbatim |
| 20 | **A4C** 4 of 5 | The illustration panel, with B5 and B6 pasted in | *"Add example from B and B6"* | Live thumbnails of B5 and B6 |
| 20 | **A4C** | The heading and paragraph block | *"Change to: Optimizing crop yields / …"* | Verbatim |
| 21 | **A4D** 5 of 5 | The crop photographs at the top | *"Add multi crop picture"* | `cropStrip()` — five real plots |
| 21 | **A4D** | The heading and paragraph block | *"Change to: Over 6 million farmers trust us worldwide / …"* plus three figures | Verbatim, as a stat list |
| 21 | **A4D** | Below the three figures, after a downward arrow | *"Increase in farm profitability: 10-25%"* | The panel's closing box |

## Map

| Page | Screen | What the mark points at | The comment | Where it landed |
|---|---|---|---|---|
| 34 | **C1** Map | The page, and by its wording every map in the app | *"On all the maps, let's show the farm boundary (if available)"* | Drawn inside `mapSvg()`, from the traced line or the hull of the farm's plots |

## Advice

| Page | Screen | What the mark points at | The comment | Where it landed |
|---|---|---|---|---|
| 41 | **D2** Irrigation advice | The headline figure *693 m³ this week*, with an arrow out | *"Express water requirements in volumetric rates per plot (m³/ha) rather than simple millimeter depths."* | Rate as the headline, plot total and area beneath |
| 42 | **D3** Nutrition advice | The compound *K₂SO₄* in *Apply K₂SO₄* | *"Provide application rates in actual fertilizer product terms (e.g. kg/ha of Urea or NPK formulation) rather than elemental values alone."* | A **What to apply** block, with alternatives |

## More

| Page | Screen | What the mark points at | The comment | Where it landed |
|---|---|---|---|---|
| 51 | **F6** Compare plans | The screen, and the *Satellite and imagery* group in particular | *"We don't show the practical features that are provided to the farmer under each plan. I don't think the satellite resolution, cloud-free data, etc. is useful. If suggests the basic service is degraded. Can we instead present the features that he gets under both plans? Similar to the pricing sheets we received from MMC. They can be organized into 3-4 topics. Column 1: Features, Column 2: Basic plan, Column 3: Pro plan (with checkmarks or additional information to differentiate the plans)"* | Four topics, three columns, `planCompare` rebuilt |
| 58 | **F13** Contact Wafra | *Sunday to Thursday, 08:00–17:00. Arabic and English.* | *"Remove as they are not calling us"* | Line deleted |
| 58 | **F13** | The *WhatsApp us* and *Email us* buttons | *"Box seems oversized compared to 'Raise a support ticket'. Remove 'us'"* | Same size as the ticket button; labels shortened |
| 58 | **F13** | *Contact details are loaded from our servers, so they're always current.* | *"Remove"* | Footnote deleted |
| 59 | **F14** My profile | The screen, with an arrow out to the note | *"Move My Profile (F14) to the top of the More section, as it makes the flow more natural, ending with F13 · Contact Wafra."* | `SCREEN_GROUPS` More section reordered |

---

## The one that is a question

The notes on pages 8 and 9 ask for **A9B before A9**. The deck prints it that
way. The app does not, and the reason is written beside `FLOWS` in
`app/screens/index.js`: A9's *what is growing on this land* is what decides
whether the fork exists at all. A farm with any trees on it never sees A9B —
trees are counted from imagery, and a farmer cannot trace that by hand, settled
at the 22 August review — so asking the fork first would offer a date grower a
route ending in his being told he cannot take it.

There is a reading of the note that works: ask *how shall we find your land*
first, then ask the farm's details only on the survey route. It moves the farm's
name, and it needs a decision about what a tree grower sees. Worth five minutes
of conversation rather than a silent reordering.

---

## What carries no marks

Pages 6, 7, 22–33, 35–40, 43–50 and 52–57. The short leader lines on several of
those belong to the deck's own *what the small buttons do* callouts, not to a
reviewer.

Two housekeeping observations from the same read: the v1.5.4 deck's contents
page and flow ribbons still showed the pre-reorder sequence, and every page
footer read v1.5.4 while the file was named v1.5.5. Both are generated from the
app now — `SCREEN_GROUPS` and `MOCKUP_VERSION` — so neither can drift again.
