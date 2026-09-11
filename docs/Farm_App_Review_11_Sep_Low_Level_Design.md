# Farm app review — 11 September low-level design

## 1. Purpose

This document translates the decisions in the 11 September farm-app review
into implementation work for the Wafra interactive mockup. It is based on:

- `/Users/romain/Codes/ai-transcriptions/output/wafra/farm-app-review-11-sep.md`
- the current mockup at version 1.5.9
- the user's follow-up corrections to the extracted action list

The transcript is evidence for product decisions; statements inside it are not
treated as instructions to edit the repository unless they are retained in the
change register below. This repository remains a UI/UX mockup: authentication,
subscription enforcement, invitation redemption and weather modelling are
represented with deterministic local fixture state rather than real services.

## 2. Final change register

| # | Screen code | Change description |
|---:|---|---|
| 1 | B2 · Farm home | Hide the farm selector when the account has only one visible farm. |
| 2 | B2 · Farm home | Show the farm map using overall health by default and add a visible score legend using green, amber and red. |
| 3 | B2 · Farm home | Let the farmer change the map between overall health, plant health, water stress and nutrition status. |
| 4 | B2 · Farm home | Show the overall health score next to every crop plot and tree group. |
| 5 | B4 · Plot detail | Ensure the screen contains the plot map, current crop cycle, crop, area, variety, target yield, trend, water status and plot-level advice. |
| 6 | B4 · Plot detail / B13 · Tree group | Present health readings as scores from 0 to 100, where 100 is good and 0 is poor. |
| 7 | B4 · Plot detail / B13 · Tree group / B10 · Tree detail | Use only the farmer-facing health labels Good, Monitor and Urgent, in addition to No data and Missing/dead where applicable. |
| 8 | B13 · Tree group / C1–C4 · Map views | Show health at individual-tree level for a regular planting grid and use an area heat map where trees overlap or individual-tree display is unreliable. |
| 9 | B13 · Tree group / C1–C4 · Map views | Add a clear legend: dark green is good; lower scores move through lighter green and amber to red. |
| 10 | B4 · Plot detail / B13 · Tree group / D2–D4 · Advice | The UI may identify stress at tree or sub-area level, but every irrigation, fertilisation or crop-protection action must apply to a whole plot or tree group. |
| 11 | B2 / B4 / B13 / C1–C4 and all map metric pickers | Remove Photosynthesis and Soil-corrected health from all offered map metrics. |
| 12 | C3 · Plot sheet | Show the selected plot's overall health score, its component readings and an entry point to plot-level advice. |
| 13 | D1 · Advice inbox | Rename Progress to Status and use the farmer-facing states Open, Assigned and Completed. |
| 14 | Global health/advice status model | Remove Planned entirely from UI copy, filters, fixtures and status handling. |
| 15 | D4 · Crop protection advice | Express spray mixing instructions using a 20-litre tank basis instead of 32 litres. |
| 16 | D3 · Fertilisation advice | Replace unexplained chemical formulas with farmer-facing nutrient or familiar input names, such as nitrogen, phosphorus, potassium, urea and zinc. |
| 17 | D3 · Fertilisation advice | State explicitly that the recommendation is applied as a foliar spray rather than through irrigation. |
| 18 | D4 · Crop protection advice | Remove the country-specific registered-products list from the first version. |
| 19 | D2 · Irrigation advice | Add a compact weekly calendar and weather-adjusted suggestions. Each day must show whether the proposed activity is suitable and why; for example, spraying is not recommended on a very windy day. |
| 20 | A15 · Join a farm | Add the option to join an existing farm as a co-owner. |
| 21 | A15 · Join a farm / invitation overlay | Allow the primary owner to generate a code and QR code; the invited user scans or enters it, registers separate credentials and receives access to the farm. |
| 22 | B14 · Manage workforce / farm access | Support multiple owners or additional app users with separate credentials, without conflating them with message-only workforce contacts. |
| 23 | F5 · Subscription / F6 · Compare plans / entitlements | Basic includes one additional app user and Pro includes two additional app users. The primary owner is not counted as an additional user and remains the billing entity. |
| 24 | B14 · Farm access / F5 · Subscription | When the Basic allowance is full and the owner tries to add another app user, show an upgrade message instead of creating an invitation. |
| 25 | B13 · Tree group | Fix tree groups whose health donut and tree list are empty. Every fixture tree group with data must render a non-empty distribution and list; a true no-data group must render a deliberate no-data state without invalid chart values. |

## 3. Current implementation findings

The following findings determine where the implementation belongs.

### 3.1 Health and map data

- `app/data/content.json` owns the shared metric catalogue. B4 and C2 iterate
  that catalogue, while C1 and C3 read the selected key from
  `state.ui.measure`.
- `app/ui/map.js` owns metric scales, map colours, plot rasters, tree dots and
  legends. It currently renders tree points as white dots rather than colouring
  them by health.
- Plot metric values are currently raw index-like decimals. The UI prints those
  values directly in B4, B13 and C3.
- B2 always draws `ndvi`, has no map legend or metric selector, and plot rows do
  not show a health score.
- `msavi` is labelled Soil-corrected health and `psri` is labelled
  Photosynthesis. Both are offered through the shared catalogue and also appear
  in entitlement and localisation data.

### 3.2 Status model

- `app/core/status.js` currently has four ordinary states: `good`, `watch`,
  `action` and `urgent`. Their labels are Good, Monitor, Planned and Urgent.
- `action` is used in plot fixtures, advice severity, B13 filtering, sorting,
  chart segments, status CSS and translations.
- Removing the word Planned only at render time would leave a hidden fourth
  state. The data and filter model must therefore be collapsed to three
  farmer-facing health/severity states.

### 3.3 Advice and weather

- D1 currently labels its third filter Progress and offers All, Not actioned
  yet, Shared and Done. Open/assigned is inferred from `status` and `sentAt`.
- D2 renders a static `detail.split` watering schedule. The schedule entries
  contain display text rather than a reliable ISO date, so they cannot be
  joined safely to a weather forecast.
- Farm forecasts contain daily temperature, condition and rain, but currently
  lack daily wind and an explicit activity-suitability result.
- D4 fixture copy still contains `32 L water per hectare` and renders a country
  product section when `detail.products` is populated.
- D3 still displays `K2SO4`, `K2O`, NPK notation and application copy tied to
  irrigation in some fixtures.

### 3.4 Account access

- A15 currently turns any valid six-digit code into the single Supervisor role;
  it does not create credentials or a co-owner relationship.
- B14 is currently an address book for message recipients. Most entries are not
  accounts, although one can be marked as Supervisor.
- The current `team` array mixes app users and message-only workers.
- The capability matrix recognises only Owner and Supervisor. Owner access is
  global in the fixture rather than represented per farm.
- F5 still says Basic covers two people and Pro covers five.

### 3.5 B13 empty-data defect

- The authored tree sample in `app/data/farms.json` contains 60 records only
  for `farm-1/tg-01`.
- B13 calls `treesOf(farm.id)` and attempts to reuse a sample only within the
  same farm. Tree groups on farms 3 and 4 therefore receive an empty array.
- `scaleUp(count, sampleSize, total)` divides by `sampleSize`; with no sample it
  produces invalid values. The donut also receives an all-zero distribution.
- The default B13 filter is Attention, which can legitimately produce an empty
  filtered list even when the group has trees. This state must be distinguished
  from a group with no underlying sample data.

## 4. Detailed design

### 4.1 Shared health-score model

Create one health-score model used by B2, B4, B10, B13 and C3. It must not be
reimplemented inside individual screens.

#### Data contract

Keep raw satellite values for raster generation, but add or derive a
farmer-facing score:

```js
plot.measures = {
  ndvi: { value: 0.61, delta: 0.01, score: 66 },
  ndwi: { value: 0.38, delta: 0.01, score: 63 },
  ndre: { value: 0.52, delta: 0.00, score: 85 }
};
```

The renderer must use `value` for colour interpolation over scientific map
rasters and `score` for farmer-facing numbers. For fixtures without an authored
score, derive it once in `loadFixtures()` from the fixed range in
`MEASURE_SCALE`, clamped to 0–100. Do not derive a score independently in each
screen.

Overall health is the minimum of the available component scores for plant
health, water stress and nutrition status. This preserves the meeting decision
that a red component makes the overall result red. Ignore a component that has
no reading. If no component is available, overall health is `null`/No data.

```js
overallHealthScore(plot) = min(
  score(ndvi),
  score(ndwi),
  score(ndre)
)
```

#### Score-to-status thresholds

Use the thresholds discussed in the meeting:

| Score | Canonical status | Label | Colour family |
|---:|---|---|---|
| 80–100 | `good` | Good | dark/light green |
| 60–79 | `monitor` | Monitor | amber |
| 0–59 | `urgent` | Urgent | red |
| null | `nodata` | No data | neutral grey |

Missing/dead remains a separate tree-presence state and is not assigned a
health score.

#### Status migration

Replace the internal four-state ordinary scale with `good`, `monitor`,
`urgent`, `nodata`, plus tree-only `missing`.

- Migrate fixture `watch` values to `monitor`.
- Migrate fixture `action` values to `monitor`.
- Remove `action` from `SCALE`, `STATUS`, `countByStatus()` and severity filters.
- Replace `--st-watch`/`--st-action` usages that represent health with the new
  monitor token. Generic warning UI may retain a separate warning design token,
  but it must not be called Planned and must not be part of health status.
- Update sort ranking to Good 0, Monitor 1, Urgent 2. No data and Missing/dead
  remain outside severity ordering.
- Remove all `status.action`/Planned localisation strings and update generated
  catalogues.

This is an intentional breaking fixture migration; no compatibility adapter is
required for the old mockup state.

### 4.2 B2 farm home

#### Farm selector

In `farmBar(farm, farms)`, enable the title tap, picker hint and chevron only
when `farms.length > 1`. A single-farm title remains plain text.

The Add farm action currently exists only inside the farm-picker sheet. Hiding
that sheet for a single-farm account must not make the action unreachable. Add
an explicit `Add another farm` row to F0 More for users with `farm.create`; it
opens the existing `startAddFarm()` flow. Keep the picker copy for multi-farm
accounts.

#### Default map and selector

Add `overall` as a virtual map presentation, not as a scientific content
catalogue metric. B2 defaults to `overall` and stores its local selection under
`local('b2-map-' + farm.id, { measure: 'overall' })` so it does not overwrite
the full Map tab's selected layer.

The compact picker offers exactly:

1. Overall health
2. Plant health
3. Water stress
4. Nutrition status

The selected item controls `mapSvg()` and the legend immediately. The Open map
control passes the selected concrete measure to C1. If Overall health is
selected, C1 may open on Overall health only if C1 supports the virtual layer;
otherwise it opens on Plant health and the B2 selection remains unchanged.

#### Overall-health map rendering

Extend `mapSvg()`/`plotRaster()` to accept an optional `scoreForPlot` callback
or an explicit `overall` mode. Overall mode colours each plot from its overall
0–100 score. It must not pretend that the overall score is a raw NDVI value.

Use a fixed score ramp with several greens at the healthy end, then amber and
red. The visible legend must show both direction and thresholds, for example:

`Urgent 0–59 · Monitor 60–79 · Good 80–100`

#### Plot and tree-group rows

Add a compact, non-interactive health block before the existing arrow:

- numeric value such as `84 / 100`
- status word such as `Good`
- matching status colour/icon
- `No data` rather than `0 / 100` when no score exists

The block is rendered by a shared `healthScore()` component so B2, B4, B10,
B13 and C3 use identical formatting. Keep the full row usable at 360 px width;
the crop chip may wrap, but the score and 44 px navigation target must not
overlap.

### 4.3 B4 plot detail

#### Screen contents

Retain and verify the existing plot map and the current crop box. The completed
screen must expose:

- plot map and selected metric
- crop and current crop-cycle dates
- area and variety
- target yield when present
- score and trend for the selected metric
- water status
- recent plot-level suggestions and the Advice entry point

Do not reintroduce tree groups into B4; a tree group continues to redirect to
B13.

#### Scores and labels

Replace the raw selected metric value shown in the B4 summary with the metric's
0–100 score. Keep the raw value available only in the hidden explanatory/audit
content if needed. Add the shared status label next to the score.

The trend chart should plot scores, not raw index values, so its vertical domain
is consistently 0–100. Existing historical series must be transformed through
the same metric scale during fixture loading.

#### Action scope

Any highlighted sub-area on the map is diagnostic only. Recent suggestions and
the Advice button continue to route to advice whose target is the whole
`plotId`; no tree ID, polygon fragment or selected map blob is added to an
advice target.

### 4.4 B13 tree group and B10 tree detail

#### Group readings

Render the B13 Plant health, Water stress and Nutrition status values as
`score / 100` with Good, Monitor or Urgent. Use the shared score component.

The health distribution rows become Good, Monitor and Urgent, followed by the
separate Missing/dead row. Remove the old Planned segment and merge all existing
`action` sample records into Monitor.

#### Tree-level versus area-level map

Add an explicit display decision to each tree group fixture:

```js
group.treeHealthDisplay = 'trees'; // or 'area'
```

- `trees`: draw each available tree point using that tree's health score/status.
- `area`: hide individual dots and draw the existing continuous raster/heat map.
- `nodata`: draw outlines and the neutral no-data treatment.

Do not infer reliability from screen zoom. The display mode represents whether
the source data can reliably separate crowns, which is a data-quality decision.

For the mockup, regular date-palm and orchard grids use `trees`; dense or
overlapping groups use `area`. The legend under the map must explain the active
mode in text as well as colour.

#### Tree detail

B10 already shows a health score out of 100. Move it to the shared formatter
and canonical status mapping so it cannot display a label that differs from B4
or B13.

#### Empty-data repair

Generate a deterministic tree sample for every tree group during
`loadFixtures()` rather than falling back to a sample scoped to an unrelated
farm.

For each group without authored tree records:

1. Clone the authored sample's shape as a template or generate 30–60 records
   from a seeded PRNG based on the group ID.
2. Assign the target `farmId`, `plotId`, species and variety.
3. Generate unique IDs prefixed by the group ID so B10 routes remain stable.
4. Place each record on the target group's grid/points.
5. Choose a deterministic status distribution consistent with the group's
   overall status; include at least one visible record under the default filter
   for Monitor/Urgent groups.
6. Retain the group tree count as the population total and use the sample only
   to estimate the distribution.

Add guards:

- Change B13's first-open filter from Attention to All so a healthy group does
  not look empty before the farmer has chosen a filter. Preserve a later user
  selection in local state.
- `scaleUp()` returns 0 when `sampleSize === 0`.
- Do not call `pct(count / all.length)` when `all.length === 0`.
- Do not render an empty donut as if it were valid data.
- A genuine zero-data group shows `No tree measurements yet` and offers no
  misleading Show all action.
- If underlying data exists but the active filter has no matches, retain the
  existing filter-empty state and Show all action.

### 4.5 Map screens and metric catalogue

#### Remove two offered metrics

Delete `msavi` and `psri` from the authored `measures` array in
`app/data/content.json`. Regenerate `app/data/content.data.js`.

Remove their offered feature keys from plan definitions and feature metadata in
`app/core/entitlements.js`:

- `measure.msavi`
- `measure.photosynthesis`

Remove UI and content localisation entries for:

- `measure.msavi`
- `measure.psri`
- `c.measure.msavi.help`
- `c.measure.psri.help`

Raw historic fields may be removed from the authored plot fixtures because this
mockup has no compatibility requirement. Descriptive prose may still use the
ordinary scientific word "photosynthesis" where it explains plant biology; the
change removes the offered metric, not the word from all educational content.

#### Selected-measure fallback

After removing the catalogue entries, validate `state.ui.measure` whenever
fixtures are reset and before a measure is rendered. If the key is absent from
the offered catalogue, replace it with `ndvi`. This prevents persisted
`msavi`/`psri` selections from causing a blank or mislabeled map.

#### C1 and C2

C1's measure button and C2's monitoring-layer list must be built only from the
filtered shared catalogue. No locked rows for the removed metrics remain.

#### C3

Extend `plotSheetBody()` with:

- overall score and status
- Plant health, Water stress and Nutrition status component scores
- number of open plot-level advice items
- `See advice` control that sets the farm filter and opens D1
- existing `Open plot` control, routing crop plots to B4 and tree groups to B13

The plot sheet must not offer an action against an individual tree or map
sub-area.

#### C4

Continue to compare the same offered metric on two dates. Both sides use the
same fixed range and legend. Removed metric keys must resolve through the
selected-measure fallback before comparison is rendered.

### 4.6 D1 advice status and removal of Planned

Rename the filter label and state property:

```js
// before
adviceFilters.completion

// after
adviceFilters.status
```

Offer these options:

| Filter value | Label | Selection rule |
|---|---|---|
| `all` | All | All active and completed advice in scope |
| `open` | Open | `status === 'open'` and no assignee |
| `assigned` | Assigned | `status === 'open'` and one or more assigned recipients |
| `completed` | Completed | `status === 'completed'` |

For the mockup, the existing send-to interaction may populate assignment state,
but its data should be made explicit rather than relying only on a display word:

```js
advice.assignedTo = ['user-2'];
advice.assignedAt = '2026-09-11T09:30:00Z';
```

Rename fixture `done` to `completed`. Replace Shared/Done copy with
Assigned/Completed. Update the empty states and sort groups accordingly.

The severity filter offers All, Urgent and Monitor. Existing `action` and
`watch` advice severities migrate to `monitor`. No screen, menu, card,
translation or fixture may display Planned.

### 4.7 D2 weather-adjusted weekly calendar

#### Schedule data

Replace display-only schedule dates with structured entries:

```js
detail.split = [{
  date: '2026-08-04',
  volumeM3Ha: 231,
  fromHour: 18,
  toHour: 20
}];
```

Formatting belongs in D2 through the existing date, number and time helpers.

Extend daily forecast fixtures with the values needed to explain suitability:

```js
forecastDay = {
  date: '2026-08-04',
  hiC: 43,
  loC: 29,
  windKph: 18,
  windGustKph: 25,
  rainMm: 0,
  rainProbabilityPct: 0,
  activity: {
    irrigation: { status: 'good', message: 'Irrigate after 18:00' },
    spraying: { status: 'urgent', message: 'Do not spray: high wind' }
  }
};
```

Suitability is part of the advice/weather view model, not a CSS decision. In a
real product it would come from the recommendation service. The mockup uses
authored deterministic fixture outcomes so it does not invent agronomic
thresholds in the screen renderer.

#### Calendar UI

Insert a compact seven-day calendar immediately before the existing This week
schedule. Each day shows:

- short day/date
- green, amber or red suitability indicator
- planned irrigation time/amount when applicable
- one short reason for a changed or blocked activity

The calendar must remain readable at 360 px. Use a horizontally scrollable row
or a compact two-row grid; do not reduce text below existing micro-token limits.
Colour is accompanied by icon and text.

#### Weather adjustment behavior

The rendered recommendation must use the adjusted schedule, not show a warning
beside an unchanged schedule.

- High heat may move irrigation to an earlier morning or evening window.
- Forecast heavy rain may delay or reduce irrigation.
- A very windy day displays `Do not spray` for spraying suitability.
- If a proposed day is unsuitable, show the replacement day/time selected by
  the advice payload.
- If no safe replacement exists in the seven-day window, show `No suitable
  window in this forecast` rather than silently dropping the activity.

D2 remains plot-scoped: one calendar and one adjusted schedule for the whole
plot/tree group.

### 4.8 D3 fertilisation copy and method

Introduce an explicit farmer-facing application method in the advice detail:

```js
detail.applicationMethod = 'foliar-spray';
```

D3 shows `Apply as a foliar spray` near the headline. Replace the current
generic no-fertigation disclaimer with direct wording: `Apply this to the
foliage as a spray. Do not apply it through the irrigation system.`

Update visible fixture content:

- `K2SO4` becomes `Potassium` or `Potassium fertiliser`.
- `K2O content` is removed from the farmer-facing units.
- `Foliar N and Zn` becomes `Foliar nitrogen and zinc`.
- Formula-heavy product names are replaced by common input names such as Urea
  and Zinc, with the amount the farmer should prepare.
- Application windows must say Spray rather than Next irrigation.

Chemical composition may remain in hidden calculation/audit data but must not
be part of D3 titles, primary amounts or instructions.

### 4.9 D4 spray units and product-list deferral

Replace the free-text rate with structured tank-mixing data:

```js
detail.mixing = {
  tankVolumeL: 20,
  dose: 0.02,
  doseUnit: 'L',
  instruction: '0.02 L per 20 L of water'
};
```

The exact dose remains fixture/advice data; the renderer must not calculate a
new pesticide dose from the old 32-litre example. D4 formats the supplied dose
as `per 20 L of water`, with total tanks or total mixture only when supplied.

Remove the `Registered products in your country` section, its explanatory note
and all first-version fixture registration rows from D4. Retain:

- active ingredient
- mixing instruction
- pre-harvest interval and safe-harvest date
- re-entry warning
- identification guidance
- permanent product-label/local-regulation disclaimer

### 4.10 Co-owner and additional-user access

#### Separate accounts from workforce contacts

Replace the mixed conceptual model with two collections:

```js
db.accounts = [{
  id: 'user-1',
  email: 'khaled@example.com',
  phone: '+966...',
  credentialsCreated: true
}];

db.farmAccess = [{
  farmId: 'farm-1',
  accountId: 'user-1',
  role: 'primary-owner',
  status: 'active'
}];

db.workforceContacts = [{
  id: 'contact-1',
  farmIds: ['farm-1'],
  name: 'Ramesh Sharma',
  phone: '+91...',
  channel: 'whatsapp'
}];
```

Message-only workforce contacts do not consume an additional-user allowance.
Active `farmAccess` records other than `primary-owner` do consume it.

#### Roles and capabilities

Add a scoped `co-owner` role. It can view and operate the farm, plots, maps,
advice and reports. It cannot manage billing, transfer the primary-owner
relationship or delete the primary billing account. The current Supervisor role
may remain for manager access, but its farm access must also be represented by a
`farmAccess` record rather than a hard-coded farm list.

Update `farmsFor()` to resolve access from `db.farmAccess`. Update `me()` and
member selectors to read the current `state.session.userId`, not the first
record with a matching role.

#### Invitation record

Add deterministic local invitations:

```js
db.farmInvitations = [{
  id: 'invite-1',
  farmId: 'farm-1',
  role: 'co-owner',
  code: '482193',
  qrToken: 'invite-1-token',
  status: 'active',
  expiresAt: '2026-09-18T12:00:00Z',
  createdBy: 'user-1'
}];
```

The mock QR is generated from `qrToken` using the existing `qrPattern()` helper.
Code and QR resolve to the same invitation. Used, expired and revoked records
must fail without creating partial access.

#### Owner flow in B14

Keep B14's workforce address book, but add a separate `People with app access`
section above it. This section shows:

- primary owner, labelled Billing owner
- active co-owners/managers
- pending invitation and expiry
- Revoke access for an additional user
- Cancel invitation for a pending user
- Invite co-owner action

The sections must use separate wording so a message recipient cannot be
mistaken for a signed-in account.

#### Join flow in A15

Change the title to `Join an existing farm`. After code entry or QR scanning:

1. Resolve and validate the invitation.
2. Show the farm name and invited role for confirmation.
3. If the invitee has no mock account, route through A5 and A6 with
   `invitationId` preserved in signup draft state.
4. Create credentials under the invitee's email/phone rather than reusing the
   primary owner's account.
5. Add the `farmAccess` record after verification.
6. Mark the invitation used.
7. Enter the app as the invited account and open the invited farm.

The user never selects their own role; it comes from the invitation.

#### User limits and upgrade behavior

Add plan metadata rather than testing plan labels in screens:

```js
PLAN_LIMITS = {
  basic: { additionalUsers: 1 },
  pro: { additionalUsers: 2 }
};
```

Combined/crop/tree variants inherit the limit from their Basic or Pro tier.
The allowance belongs to the primary owner's subscription, not to each farm.
Count unique additional account IDs across that subscription's farms; the same
co-owner on two farms consumes one place. Count each active pending invitation
once. The primary owner is excluded.

Before creating an invitation, calculate:

`active additional users + active pending invitations`

If it is at the limit:

- Basic opens the standard Upgrade modal with copy explaining that Pro allows
  two additional users.
- Pro shows an allowance-full message; there is no higher tier in this mockup.
- Revoking a user or cancelling an invitation frees one place immediately.

Update F5 and F6 copy to:

- Basic: Primary owner + 1 additional user
- Pro: Primary owner + 2 additional users

The primary owner remains the billing entity on F5.

## 5. File-level implementation plan

| File | Required work |
|---|---|
| `app/core/status.js` | Replace the four ordinary states with Good/Monitor/Urgent; add score thresholds and shared score-to-status helpers. |
| `app/core/store.js` | Rename D1 filter state, add accounts/access/invitation fixture state, and validate the selected map metric on reset. |
| `app/core/capabilities.js` | Add co-owner capabilities and resolve farms from farm-access records. |
| `app/core/entitlements.js` | Remove the two metric feature keys and add tier-based additional-user limits. |
| `app/data/content.json` | Remove Soil-corrected health and Photosynthesis from the metric catalogue. |
| `app/data/content.data.js` | Regenerate from the authored content fixture. |
| `app/data/farms.json` | Migrate statuses, remove obsolete map measures, add per-group tree display mode and add daily weather fields needed by D2. |
| `app/data/farms.data.js` | Regenerate from `farms.json`. |
| `app/data/activity.json` | Migrate advice statuses/severities; structure D2 schedule dates; revise D3 copy/method; revise D4 mixing data and remove registered-product rows; split accounts from contacts as needed. |
| `app/data/activity.data.js` | Regenerate from `activity.json`. |
| `app/data/fixtures.js` | Derive 0–100 metric/history scores, generate deterministic tree samples for every group and initialise account/access/invitation collections. |
| `app/data/selectors.js` | Add health-score selectors, tree-group sample selector, access selectors and explicit D1 status filtering. |
| `app/data/actions.js` | Add create/cancel/redeem/revoke invitation actions and farm-access mutations; preserve whole-plot advice targets. |
| `app/ui/components.js` | Add the shared health-score display and compact weather-day/calendar components where they are generic. |
| `app/ui/map.js` | Add overall-score raster mode, health score ramp, coloured per-tree rendering, area fallback and score legends. |
| `app/ui/charts.js` | Make donut zero-safe and render the three-state tree distribution. |
| `app/screens/home.js` | Implement B2 selector behavior, map picker/legend, row scores, and split B14 app access from workforce contacts. |
| `app/screens/plot.js` | Use 0–100 scores and canonical labels on B4 and retain the required plot details/advice scope. |
| `app/screens/trees.js` | Use shared scores/statuses, tree/area map mode, repaired samples and explicit true-no-data handling on B13/B10. |
| `app/screens/mapscreens.js` | Remove obsolete metrics from every picker, support overall health where required, extend C3 and validate C4 comparison keys. |
| `app/screens/advice.js` | Implement D1 statuses, D2 weather calendar/adjusted schedule, D3 copy/method and D4 tank mixing/removal of country products. |
| `app/screens/onboarding.js` | Change A15 to invitation validation and carry invitation context through separate credential creation. |
| `app/screens/overlays.js` | Add invitation issuer/QR display, access revocation and allowance-full upgrade states. |
| `app/screens/more.js` | Add the single-farm Add another farm route and update F5/F6 user-limit and billing-owner copy. |
| `app/styles/tokens.css` | Replace health action/watch tokens with the canonical monitor palette while retaining any non-health warning token separately. |
| `app/styles/components.css` | Style row health scores, score legends, tree dots, weather calendar and app-access sections at small widths. |
| `app/i18n/source/*` and `app/i18n/*.js` | Remove Planned and obsolete metric labels; add all new status, calendar, access, invitation and advice strings; regenerate catalogues. |
| `app/screens/index.js`, `app/meta.js`, `README.md` | Update screen notes, requirement/deviation narrative and mockup version after implementation. |

## 6. Implementation sequence

1. Migrate the status and score model, fixtures and generated fixture modules.
2. Remove the two map metrics and add selected-key fallback.
3. Update shared health components, charts and map rendering.
4. Apply B2, B4, B13/B10 and C1–C4 UI changes.
5. Migrate D1 status state and fixtures.
6. Implement D2 weather schedule data and calendar.
7. Update D3 and D4 farmer-facing advice content.
8. Separate accounts, farm access and workforce contacts.
9. Implement invitation, QR, co-owner and limit flows across A15/B14/F5/F6.
10. Regenerate localisation and fixture modules, update metadata and run the
    full validation matrix.

This order keeps screens from temporarily depending on removed status or metric
keys and establishes the account model before invitation screens are changed.

## 7. Acceptance criteria and verification

### Static and generated-data checks

- `npm run check` passes.
- Regenerate fixture modules with `npm run fixtures`.
- Regenerate localisation with `npm run i18n`.
- `rg -n "Planned|Soil-corrected health|measure\.msavi|measure\.photosynthesis" app`
  finds no farmer-facing or offered-feature references. Biological explanatory
  uses of the ordinary word photosynthesis are reviewed manually rather than
  removed automatically.
- No authored advice uses `severity: "action"`, `status: "done"` or a
  `32 L` spray basis.

### Automated smoke coverage

Install the repository's development dependencies before running the browser
suite; the current environment passes `npm run check` but cannot start the smoke
suite because Playwright is not installed.

Add smoke assertions for:

- B2 with one visible farm: no selector affordance.
- B2 with multiple farms: selector remains available.
- Every B2 crop and tree-group row: score or explicit No data.
- B4 and B13: scores are within 0–100 and no raw decimal is presented as the
  primary health number.
- D1: Status label and Open/Assigned/Completed options; no Planned string.
- Metric pickers on B2, B4, C1/C2 and C4: no Photosynthesis or Soil-corrected
  health.
- D2: seven weather days, at least one adjusted recommendation, and a windy-day
  no-spray example.
- D3: Foliar spray wording and no formula-heavy primary copy.
- D4: 20 L mixing basis and no country-product section.
- A15: code and QR paths both redeem the same invitation into a separate
  account.
- Basic: first additional invitation succeeds; the next opens Upgrade.
- Pro: two additional invitations succeed; the next shows allowance full.
- Revocation/cancellation frees capacity.
- Every B13 route in the entity walk renders a finite donut distribution and a
  tree list or deliberate No data state.

### Manual visual matrix

Review at minimum:

- 360 × 640 Android and 375 × 667 iPhone SE
- 100% and 200% text size
- English and one RTL language
- Basic and Pro
- primary owner and co-owner/supervisor
- B2, B4, B13, C1, C2, C3, C4, D1, D2, D3, D4, A15, B14, F5 and F6

Verify that score badges do not collide with plot names or navigation arrows,
tree dots remain distinguishable, legends are not colour-only, the D2 calendar
is readable without shrinking text, and B14 clearly separates app access from
message recipients.

## 8. Explicitly out of scope

The revised request intentionally excludes the following transcript-derived
items from this implementation round:

- general global typography/padding work beyond what the affected components
  need
- plot sorting changes
- creating/splitting plots
- general C1 healthy/stressed investigation work as a separate action
- Red Palm Weevil or disease-prediction scope changes
- separate C4 work beyond safe removal of obsolete metric keys
- archive/ignore behavior changes
- weather changes to F15
- a new B2 share-farm entry, because an access entry already exists through
  B14/More
- Basic/Pro feature-list replacement beyond the retained user-limit row
- tree/crop catalogue alignment
- ArcGIS/GeoJSON integration
- MMC delivery, deck handover and requirements-document preparation
