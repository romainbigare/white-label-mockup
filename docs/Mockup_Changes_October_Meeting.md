# Mockup changes from the October meeting

**What this is.** A list of every change to the mockup that came out of the Mark / Romain / Hani meeting. It is grouped by screen code.

**Rules I used**
- When people changed their mind, only the **last agreement** is listed. The earlier idea is not here (see the table below).
- Numbers like `[1·00:21:47]` point to the place in the transcript (1 or 2 = recording, then time).
- "Now" means what the app does today (v1.7.2). "Change" means what it must do after.
- Things that are **not agreed** are in the last section, not in the screen lists.
- Things I am **not sure about** are marked with ⚠️.

---

## Where people changed their mind (final answer wins)

| Topic | Early idea | Final answer |
|---|---|---|
| Tree minimum per species | 10 trees (Part 4) | **40 trees** (50 was said, not chosen) [2·00:30:39] |
| Pricing bands | Round **up** to the next band | Round **down**. Wafra accepts less margin [1·00:15:58] |
| Health score on the home list | Hani: keep the score | **"Urgent" label only**, no score. Mark's view won [1·00:21:47] |
| "Check a photo" on D1 | Remove it from D1 (Sunday talk) | **Keep it on D1**, rename it **"Plant diagnosis"** [2·00:40:28] |
| Map button | Add a second "View metrics" button | **Put the words "View metrics" inside the expand button** [1·00:06:55] |
| Metric buttons on trend chart | Drop-down | **Keep the row of buttons that scrolls sideways** [1·00:42:07] |
| Farm-level numbers | Words only, no percentages | **Word + warning icon + percentage is OK at farm level** [2·00:31:28] |
| Farm-level metrics place | Above the plot list | **In place of the metric picker** ⚠️ (Hani's answer was hard to hear) [2·00:01:52] |
| Soil type | Farmer types it in | **MMC guesses it, farmer can change it** [1·00:51:05] |
| Irrigation system and flow rate | Farmer enters them | **Left out for now** (later version) [2·00:34:11] |
| Fertiliser in irrigation schedule | Only in advice | **In both places** [1·00:48:04] |
| One "Advice" box | One box | **Three boxes**: Irrigation, Fertilisation, Disease & pest [1·00:40:55] |
| Growth stage | Green / grey steps | **Line chart** [1·00:31:36] |
| Irrigation for trees | Per tree | **Per area (per hectare)** [2·00:10:38] |
| Tree crowns on the map | Show crown size | **One dot per tree.** Crowns only for Wafra's own checks [2·00:26:01] |
| Variety (e.g. type of lemon) | Shown on map | **Removed everywhere. Species only** [2·00:06:26] |
| Disease forecast | Maybe keep for Premium | **Remove** [2·00:47:48] |

---

## GENERAL (many screens, or no screen)

1. **Words, not numbers, outside the plot page.** Numbers (percentages) show only on the plot page score card (B2, B5). Everywhere else show a word (for example "Good", "Poor") in the colour of its band. Five bands stay. Dark green = good, red = bad. [1·00:26:33, 1·00:27:07]
   - Farm level is the exception: word + warning icon + percentage together is fine (see B1). [2·00:31:28]
2. **Water metrics use a red-to-blue colour scale.** This is already so for soil moisture and water stress. Keep it. [1·00:28:19]
3. **"Scorecard" is one word.** Now the app says "Score card". Change it everywhere (B2, B5, C3, F6). [1·00:27:33]
4. **Take away the small round "Harvey ball" icons** (the little percentage circles). Do this on the trend chart and on the disease and pest part. Check every screen for them. [1·00:38:08, 1·00:46:11]
5. **No percentages for disease and pest.** Use an action word instead (see B2). [1·00:37:48]
6. **Remove "variety" everywhere.** Show the species only (Olive, Orange, Lemon, Lime, Date palm). Do not show the type of lemon, olive and so on. [2·00:06:26]
7. **Name tree groups after the tree, not "Plot N".** Plots stay "Plot 1, 2, 3…". Tree groups are "Olive", "Orange", "Lemon"… Romain filled the names automatically with plot numbers. Undo that for tree groups. [1·00:11:08]
8. **A species needs at least 40 trees to be a tree crop.** Below 40 the trees can be counted, but they get no tree group, no advice and no irrigation schedule. Do this on every screen that lists tree groups (B1, C1, D1, A16). [2·00:30:39]
9. **Trees are dots, never areas.** One dot per tree. One colour per species (green olive, orange for orange, yellow lemon, purple date palm). No crown outlines for the client. No blue land-use areas. [1·00:11:47, 2·00:15:11, 2·00:26:01]
10. **Do not show forest or windbreak hedges anywhere.** The data is kept, but nothing is drawn or listed. [2·00:15:36, 2·00:16:01]
11. **Irrigation for trees is per area, never per tree.** The area the tree group covers is used. [2·00:10:38]
12. **Use "Nutrition status" as the only name** for the fifth metric. Do not use "Soil health" or "Soil health status" anywhere. [2·00:46:20, 2·00:46:46]
13. **Use "Canopy health" instead of "Tree health" / "foliage".** [2·00:07:03]
14. **Show "No action" when there is nothing to do.** An empty box is good news and it calms the farmer. This applies to the three advice boxes, to each plot in the advice list, and to disease and pest. [1·00:40:41, 2·00:04:45]
15. **"Pick a metric" stays only on the map screen (C1).** On other screens the map shows the words "View metrics" (see B1, B2). [1·00:06:11, 1·00:28:30]
16. **Plots are always in number order** (1, 2, 3 … 10). Today one list jumps from 10 to 2. Check B1, D1 and any other list. [2·00:04:45]
17. **Irrigation efficiency belongs to the farm, not the plot.** It leaves the plot and irrigation screens and goes to B1. [1·00:49:04, 1·00:52:04]
18. **Soil type belongs to the farm.** It is a guess from MMC, and the farmer can change it (A16, B11). [1·00:52:04]
19. **Irrigation system and flow rate are not asked in this version.** No "irrigate for 30 minutes" advice. [2·00:34:11]

*Not a change:* the missing back arrow in the web mockup is a limit of the web version. It will not exist in the real app. [1·00:04:15]

---

## A10 — Tell us about your farm

1. **Add a "too small" screen after the numbers are checked.** There is no screen that says: "Sorry, your farm or tree count is too small for a survey." Add one. It is a new screen, so it needs a code. ⚠️ Nobody said what "too small" means in numbers. Mark said a 20-tree farm can be surveyed (and is billed as 100). [1·00:12:28, 1·00:13:03]

## A11 — Available service plans

1. **Prices use the new bands (round down).** The estimate must follow the new rule. See A17 for the rule. [1·00:15:58]

## A16 — Survey results

1. **Add the soil question.** Show: "We detected *sandy loam*" with three choices: **Yes, I agree**, **No, change it**, **I don't know**. The farmer types nothing. Romain will ask MMC if they can send the soil type at this point. [2·00:32:16, 2·00:32:28]
2. **Apply the 40-tree minimum to tree groups in the result list.** [2·00:30:39]
3. **Tree groups are named by species** in this list. [1·00:11:08]

## A17 — Service plans

1. **Billing bands round down, not up.** 125 trees is billed as 100, not 150. [1·00:15:58]
2. **Minimum bill is 100 trees.** 0–99 trees is billed as 100. A mix is fine (80 date + 20 olive = 100). [1·00:12:05, 1·00:17:19]
3. Pricing bands are "about a hundred", following MMC's bands with more steps. Romain will send a document with bands and some examples. No screen change needed beyond the numbers. [1·00:13:06, 1·00:16:40]

---

## B1 — Farm home

1. **Plot list: remove the health score column.** Take away the "Health score (%)" header and the percentage and status on every row, for plots and for tree groups. [1·00:21:14]
2. **Show an "Urgent" label with a warning icon, only when it is true.** The word stays, not only a triangle. It shows if there is urgent advice for that plot or tree group. Tapping it opens the advice. If nothing is urgent, show nothing. [1·00:21:47, 1·00:22:29]
3. **Tree groups in the list:** named by species (Olive, Orange, Lemon, Lime), only species with 40 or more trees. [1·00:23:04, 2·00:30:39]
4. **Map at the top: remove the "Pick a metric" control.** Put the words **"View metrics"** to the left of the expand icon, inside the same button. It opens the full map (C1). [1·00:06:55]
5. **Three farm-level measures replace the metric picker:** [2·00:01:52, 2·00:03:30]
   - **Irrigation efficiency** (Mark also called it "Water efficiency")
   - **Plant health**: the plant gets the nutrients and water it needs
   - **Growth / vigour**: healthy growth, linked to how much it will produce
6. **Each of the three shows:** the word in the colour of its band, a warning icon, and the percentage. Five bands. [2·00:03:20, 2·00:31:28]
7. **They are the average of all plots,** not the worst plot. [2·00:01:02]
8. **Soil type shows at farm level** with a way to change it (the change itself is in B11). ⚠️ The meeting said "farm homepage" and also "farm settings". I read it as: shown on B1, edited in B11. [1·00:52:04, 2·00:32:02]
9. ⚠️ With the picker gone, check what happens to the map legend on this map.

## B2 — Plot detail (B5 is the same screen — see B5)

**New order of the page, top to bottom.** One long scrolling page. [1·00:33:24, 1·00:40:55]
1. Map (with "View metrics" on the expand button)
2. Crop box
3. Score card (numbers stay here)
4. **Agronomic trend**
5. **Irrigation trend**
6. **Growth stage** (now a line chart)
7. **Irrigation** box
8. **Fertilisation** box
9. **Disease & pest** box

**Details**

1. **Map: remove "Pick a metric".** Use "View metrics" on the expand button, same as B1. [1·00:28:30]
2. **Crop box:** write **"Wheat"**, not "Growing wheat". Two lines: **"Planted"** and **"Estimated harvest"**. Keep it compact. [1·00:29:09]
3. **Yield number:** keep for now. ⚠️ It is not known where it comes from (see open questions). [1·00:29:35]
4. **Score card:** keep all five metrics with numbers. This is the only place numbers are shown. [1·00:27:07]
5. **Rename the trend chart "Agronomic trend"** (it covers the five metrics). Keep the **Irrigation trend** as its own chart. [1·00:33:17]
6. **Trend chart: keep the row of metric buttons** that scrolls sideways. No drop-down. [1·00:42:07]
7. **Trend chart: add numbers on the axes.** [1·00:42:19]
8. **Trend chart: the time axis is the full crop cycle.** Each crop has a standard length (onion 12 weeks, tomato 16 …). The target line is drawn for the whole cycle. The real line goes only up to today. The target stays a flat line for metrics like plant health. Romain said this already works, so check it only. [1·00:44:33, 1·00:45:52]
9. **Remove the Harvey balls** on the trend chart. [1·00:46:11]
10. **Growth stage becomes a line chart** with two lines: *expected* and *where you are today*, so the farmer sees above or below plan. It is based on biomass. It moves up, to after the two trends. [1·00:31:06, 1·00:31:46, 1·00:32:28]
11. **Remove the two buttons at the bottom** ("See advice" and "Irrigation schedule"). Their content is now in the boxes in the page. [1·00:34:33]
12. **Irrigation box:** a short summary, for example "today and tomorrow: this much water". Tap it to open the full week (B12). [1·00:35:11]
13. **Fertilisation box:** says when to fertilise and with what ("Fertilisers needed", per hectare). Shows "No action" when empty. [1·00:39:37, 1·00:40:41]
14. **Disease & pest box:** last in the list. No percentage, no Harvey ball. Show an action word: **Action required**, **Monitor**, or **Inspect**, or **No action**. Do not call it "risk". [1·00:38:08, 1·00:40:55]
15. **Urgent alerts appear inside these boxes.** [1·00:33:46]
16. **Old single "Advice" box is gone,** replaced by the three boxes. [1·00:38:33]
17. **Do not bring back irrigation efficiency, soil or irrigation system on this screen.** In v1.7.2 they moved from here to B12. Now they leave B12 as well (see B12 and B1). [1·00:51:45]

## B5 — Tree group (same screen as B2)

Everything in B2 applies, except as follows.
1. **Name** is the species (Olive, Lemon …). Species only, no variety. [1·00:11:08, 2·00:06:26]
2. **Shown only if 40 or more trees.** [2·00:30:39]
3. **Rename "Tree health" to "Canopy health".** [2·00:07:03]
4. **Keep "Died or removed (last 3 months)".** Hani agreed it is useful. Today it is the "trees that stopped signalling" part. [2·00:07:27]
5. **Trends, in this order:** Agronomic trend, Irrigation trend, **Fruit development trend**. Then the three boxes (Irrigation, Fertilisation, Disease & pest). ⚠️ I read "Fruit development trend" as replacing the growth stage on tree pages. [2·00:08:09]
6. **Irrigation is per area (per hectare),** not per tree. [2·00:10:38]
7. **Remove "this and that" before the score card.** ⚠️ Mark said "we remove this and that, then the scorecard" without saying what. Likely the same duplicate block as in C3. Please confirm. [2·00:06:33]

## B6 — Tree detail

1. **Remove variety.** The "Species" line shows the species only. [2·00:06:26]
2. **"Tree health" becomes "Canopy health".** [2·00:07:03]
3. **No crown outline for the client.** One dot per tree. [2·00:26:01]

## B11 — Farm settings

1. **Add: change soil type.** The farmer can confirm or change the soil MMC guessed. No typing needed. [2·00:32:02]
2. **Look into: merge and split plots after sign-up.** Today this is only in the sign-up result screen. Mark's worry: the satellite may count 2–3 plots where the farmer sees one. The farmer needs a way to join them. Check if B11, B9 or C5 can do it. ⚠️ This is "look into", not a firm decision. [1·00:07:11, 1·00:07:54]

## B12 — Irrigation schedule

1. **Remove "Why this much water?"** (the reference ET × crop coefficient box). [1·00:46:19]
2. **Keep the week view,** and keep the weeks scrolling. [1·00:46:36]
3. **Keep the amount per hectare and the total** (for example 300 per hectare, then the total for 4 ha). [1·00:47:15]
4. **Rename "Feed with this water" to "Fertilisers needed".** "Feed" is the wrong word. [1·00:47:15, 1·00:47:32]
5. **Show fertiliser doses per hectare,** not the total for the plot (for example 15 kg per hectare). [1·00:48:27]
6. **Remove the block with soil, irrigation system, flow rate and irrigation efficiency.** Efficiency goes to B1. Soil goes to farm level. System and flow rate are left out for now. [1·00:51:45, 2·00:31:14, 2·00:34:11]
7. **Do not show irrigation in minutes** ("irrigate 30 minutes"). [2·00:33:24]
8. **For tree groups, use the area covered by the group,** per hectare. [2·00:10:38]
9. The page is opened by tapping the irrigation box on B2 / B5. The old dock button goes (see B2). [1·00:35:11]

---

## C1 — Map

1. **Show plot labels from a lower zoom level, and make them smaller.** Farmers must see that there is something to zoom into. [1·00:24:09]
2. **"Pick a metric" stays here** (only here). [1·00:06:55, 1·00:28:30]
3. **Trees are dots only,** one colour per species. No areas, no blue land-use shapes, no crown outlines. [1·00:11:47, 2·00:15:11, 2·00:26:01]
4. **Do not draw forest or hedges.** [2·00:15:36]
5. **Tree groups are named by species,** not "Plot N". [1·00:11:08]

## C2 — Layers

1. **Tree layer shows dots only** (no crown, no land-use shapes). [2·00:15:11]
2. **No forest layer.** [2·00:15:36]

## C3 — Plot sheet (the sheet that opens when you tap a plot on the map)

1. **Remove the top block** that repeats the metric shown on the map (plant health shows twice). Keep only the grid of five metrics. [1·00:25:28, 1·00:25:44]
2. **Show words, not percentages,** in the colour of the band. Numbers only on the full plot page. [1·00:26:33, 1·00:27:07]
3. Tapping the sheet leads to the full plot page, where the numbers are. [1·00:27:07]

---

## D1 — Advice inbox

1. **Two tabs: "Plots" and "Trees".** [2·00:04:45, 2·00:05:23]
2. **Sort plots by number** (1, 2 … 10). [2·00:04:45]
3. **List every plot.** A plot with nothing to do shows **"No action"**. [2·00:04:45]
4. **Keep the red notification bubble** (the count of advice). [2·00:04:11]
5. **Keep advice in two places:** inside each plot, and in this one list for all plots. [2·00:03:59]
6. **Keep the photo button on this screen, but rename it "Plant diagnosis".** It is for pests, disease and water problems. Do not remove it. Romain thought he had to remove it (Sunday talk). That is no longer the plan. [2·00:36:54, 2·00:40:28]
7. **Tree tab only lists species with 40 or more trees.** [2·00:30:39]

## D3 — Fertilisation advice

1. **Use the name "Fertilisers needed"** for the fertiliser part. [1·00:47:32]
2. **Doses are per hectare.** [1·00:48:27]
3. **Same content shows in the Fertilisation box on B2 / B5** (both places). [1·00:48:04]

## D4 — Crop protection advice

1. **Action words for pests and disease:** *Action required*, *Monitor*, *Inspect and report back*. Or "No action". [1·00:39:37, 1·00:40:55]
2. **No probability or percentage.** [1·00:37:48]

## D5 and D6 — Check a photo / Photo result

1. **Rename "Check a photo" to "Plant diagnosis"** on D5 (title), D6, the D1 button and the entry in the More menu (F1). Romain will try other words; this is the name for now. [2·00:40:28]
2. It covers pests, disease and water problems (too much or too little). [2·00:39:19, 2·00:40:04]

---

## F3 — Reports

1. **No change yet.** Reports are a placeholder. MMC must send examples. [2·00:34:25]
2. **Name "Nutrient reports and analysis"** for the nutrient / soil report (see F6). [2·00:48:43]

## F4 — Weather

1. **Rename "Water demand" to "Evapotranspiration".** Show it in millimetres (mm). Now it says "Water demand this week". [2·00:35:30]
2. **Keep the frost indicator.** It matters in the north, Jordan and Morocco. [2·00:36:07]

## F6 — Compare plans

1. **"Vegetation indices (NDVI, NDRE, EVI, NDWI)":** rename to match the score card (plant growth, vigour, health). No raw index names. Use "Scorecard". [2·00:41:15, 2·00:42:07]
2. **"Crop growth stage modelling" becomes "Crop growth stage distribution".** [2·00:44:55]
3. **"Fruit ripeness stage distribution":** keep this name. (The tree list also says "Ripeness stage distribution". Use "Fruit ripeness stage distribution" there too.) [2·00:44:55]
4. **"Farm anomaly detection": remove.** It overlaps with advice and the score card. ⚠️ Romain said "I might remove it", and wants to ask MMC first. [2·00:43:56]
5. **"Early stress warning (water, nutrition)":** keep, but delete the "(water, nutrition)" part. Same for the tree list ("Early stress detection"). [2·00:45:00]
6. **"Canopy water content": remove** (also "Average canopy water content" in the tree list). It is used inside, not shown. [2·00:45:00]
7. **"Soil health status" becomes "Nutrition status".** Also "Soil health" in the tree list. [2·00:46:20, 2·00:46:46]
8. **"Disease forecasting": remove.** [2·00:47:39, 2·00:47:48]
9. **"NPK reports and soil analysis" becomes "Nutrient reports and analysis".** [2·00:48:43]
10. **Premium-only features** show on Basic with a small **"Premium" badge** and are disabled. Romain says this already works; check it. [2·00:44:11]
11. **Keep "Personalized crop planner"** (it is the planner calendar, B7). [2·00:43:56]
12. ⚠️ **"Yield estimation and optimization":** keep for now, but it is not clear MMC can do it (see open questions). [2·00:47:58]

---

## Not agreed yet (do not build)

- **Advice by plot or by crop?** If plots 1, 4 and 6 are all alfalfa, the farmer gets three pieces of advice. No decision. [1·00:08:55, 1·00:09:28]
- **Irrigation trend (recommended vs applied).** No way yet to know "applied" without farmer logs. Keep it for now, because farmers liked it. Mark suggests "needed vs met" instead. MMC will be asked. [1·00:35:43, 1·00:37:10]
- **Yield number:** where does it come from? MMC may not be able to give it without the farmer. [1·00:29:35, 2·00:47:58]
- **Expected growth line:** can MMC send the expected curve for each crop? [1·00:32:04]
- **Soil and nutrient test values (pH and others) at farm level.** Mark wants a button on B1 that opens a chart. Farmers asked for a **range next to each value** (is pH 8 good or bad?). Romain will think about it. Maybe a meeting this week. [2·00:50:34, 2·00:51:37]
- **Showing the pricing bands as A / B / C** to the client. Romain said it is possible. Nobody decided. [1·00:16:40]
- **Where the three farm metrics sit** (above the plot list, or in place of the picker). I used "in place of the picker". [2·00:01:25, 2·00:01:52]
- **The 40-tree minimum.** Hani said 6 × 6 m spacing. That is about 280 trees per hectare, not 36. So 40 trees is about 0.15 ha, not one hectare. Romain will check it against ADAFSA data. [2·00:27:49, 2·00:29:55]
- **Name of the photo feature.** "Plant diagnosis" for now. [2·00:40:28]
- **Tree page label "Citrus"** for plot 6. Mark said it once, but also said "species only". I used species. [2·00:06:33]

## Work that is not mockup screens (for your notes)

- **Thursday MMC call questions:** merge/split plots after sign-up; "applied" irrigation; expected growth / biomass curves; yield without the farmer; soil type accuracy and timing; whether flow rate is used for anything else; simpler tree-crown shapes; what "farm anomaly detection" is; report examples; the flagging tool.
- **Pricing document** (bands + examples) from Romain to Mark. Later: set prices from MMC's future volume discounts, and give volume discounts (100, 500, 10,000 trees).
- **Elite Agro RFQ:** Romain checks if forest trees must be tracked, then sends questions to Mark. Review order: Romain and Mark, then MMC sales, then the Saudi law firm. The text must say the data and models come from MMC (a third party) and Wafra is the local representative. No detail on MMC's model design.
- **Hani:** visit big farms in Jordan with the Arabic mockup and send the feedback.
- **Land-use views** (blue areas, forest) belong to the ADAFSA presentation, not to this app. [2·00:16:59]
