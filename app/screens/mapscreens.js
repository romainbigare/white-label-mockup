/* ---------------------------------------------------------------------------
   mapscreens.js — C1 Map, C2 Layers, C4 Compare, C5 Boundary editor.
   (C3, the plot bottom sheet, lives in overlays.js because it is a sheet.)

   WF5.063 says layer selections persist between sessions, so the layer state is
   held on the session, not on the screen — switching tabs and coming back must
   not reset it.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, back } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, switchRow, disclaimer, req, select, divider, lockedRow,
  compareStage, compareSlider, compareLine, mapTool,
} from '../ui/components.js';
import { num, date, area } from '../core/format.js';
import { visibleFarms, farmById, plotsOf, allVisiblePlots, measureByKey, measures } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { mapSvg, legend, rampCss } from '../ui/map.js';
import { boundaryCanvas, undoVertex, polygonAreaHa } from '../ui/boundaryEditor.js';
import { saveBoundary } from '../data/actions.js';
import { plotById } from '../data/selectors.js';

/* WF5.063 — layer selection is session state, restored on every visit. */
function layers() {
  if (!state.session.layers) {
    state.session.layers = {
      basemap: 'satellite',
      boundaries: true, blocks: false, labels: true, trees: false,
      soil: false, landuse: false, labs: false,
      vraSowing: false, vraNitrogen: false, vraPK: false, zoning: false,
      irrigation: false,
    };
  }
  return state.session.layers;
}

/* -- C1 · Map, WF5.059 … WF5.069 ------------------------------------------- */

export function C1() {
  const L = layers();
  const ui = local('c1', { zoom: 1 });
  const farmFilter = state.ui.farmFilter;
  const farms = visibleFarms();
  const plots = farmFilter === 'all' ? allVisiblePlots() : plotsOf(farmFilter);
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const farm = farmFilter === 'all' ? farms[0] : farmById(farmFilter);
  const dates = farm?.imageryDates ?? [];
  const dateIndex = Math.max(0, Math.min(dates.length - 1, dates.length - 1 - state.ui.dateIndex));
  const current = dates[dateIndex];
  const measureLocked = !has(measure.featureKey);

  // No app bar. The map is the screen: it starts directly under the device's
  // own status bar, and every control floats on it. The status strip keeps the
  // ordinary light chrome rather than going dark for this one screen — the
  // clock, the signal and the battery should look the same everywhere.
  return {
    body: h('div', { style: { position: 'relative', height: '100%' } },
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        mapSvg({
          plots, measure: measureKey, basemap: L.basemap, layers: L, zoom: ui.zoom,
          dateKey: current?.date ?? '', gps: state.session.gpsGranted ? state.session.gps : null,
          onPlotTap: (plot) => openSheet('C3', { plotId: plot.id }),      // WF5.061
        })),

      // The left-hand column. With no app bar these two share the top edge with
      // the controls opposite, so they stack rather than run the full width —
      // the cached-imagery banner used to be laid straight over them.
      h('div', {
        style: {
          position: 'absolute', insetInlineStart: '10px', top: '14px', maxWidth: '54%',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px',
        },
      },
      when(farms.length > 1, () => h('button.mapchip', {
        onclick: () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('c1'); } }),
      }, icon('home', 17),
         h('span', farmFilter === 'all' ? t('filter.allfarms', 'All farms') : farmById(farmFilter).name),
         icon('chevronDown', 15))),
      // WF5.068 — when offline the map shows cached tiles with a clear banner
      // naming the date of the imagery, which the shell's banner does not.
      when(state.session.connectivity === 'offline', () => h('div.banner.banner--cached', {
        style: { borderRadius: 'var(--radius-sm)' },
      }, icon('offline', 16),
         h('span', t('c1.cached', 'Saved map from {date}', { date: date(current?.date ?? '', { short: true }) }))))),

      // Bare glyphs — see mapTool(). Captioned, these five pills took a third of
      // the width of the map they sit on.
      h('div.maptools', { style: { insetInlineEnd: '10px', top: '14px' } },
        mapTool('layers', t('c2.title', 'Layers'), () => go('C2')),
        has('maps.compare')
          ? mapTool('compare', t('b4.compare', 'Compare'), () => go('C4'))
          : mapTool('compare', t('b4.compare', 'Compare'), () => openModal('UPGRADE', { featureKey: 'maps.compare' }), { locked: true }),
        // WF5.065 — the user's own position, with a Locate me control.
        mapTool('locate', t('map.locate', 'Locate'), () => {
          if (!state.session.gpsGranted) { state.session.gpsGranted = true; commit('c1'); return; }
          toast(t('c1.centred', 'Centred on your position'));
        }),
        mapTool('plus', t('c1.zoomin', 'Zoom in'), () => { ui.zoom = Math.min(2, ui.zoom + 0.35); commit('c1'); }),
        mapTool('minus', t('c1.zoomout', 'Zoom out'), () => { ui.zoom = Math.max(0.5, ui.zoom - 0.35); commit('c1'); })),

      h('div', {
        style: {
          position: 'absolute', insetInline: '10px', bottom: '10px',
          background: 'var(--paper)', borderRadius: 'var(--radius)', padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'var(--shadow-2)',
        },
      },
      h('button.row', {
        onclick: () => openSheet('MEASURE_PICKER', { onPick: (key) => { state.ui.measure = key; commit('measure'); } }),
        style: { padding: '2px 0', borderBottom: 0, minHeight: '38px' },
      },
      h('div.row__main',
        h('div.row__title', t(`measure.${measure.key}`, measure.plain)),
        h('div.row__sub', measure.technical)),
      when(measureLocked, () => h('span.locked', icon('lock', 14), t('locked.short', 'Locked'))),
      h('span.row__chev', icon('chevronDown', 20))),
      // Wraps rather than clips: at 360 dp the stepper's two 48 dp targets and
      // its date leave the legend about 140 dp, which cut "high" to "h".
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '2px 6px', minWidth: 0, flexWrap: 'wrap' } },
        h('div', { style: { minWidth: 0 } }, legend(measureKey, null)),
        // WF5.066 — the stepper moves through available imagery dates.
        h('div', { style: { marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '2px' } },
          h('button.iconbtn', {
            onclick: () => { state.ui.dateIndex = Math.min(dates.length - 1, state.ui.dateIndex + 1); commit('c1'); },
            'aria-label': t('b4.prevdate', 'Previous image'),
          }, icon('back', 20, 'flip')),
          h('span', { style: { fontSize: 'var(--t-meta)', fontWeight: 650, minWidth: '74px', textAlign: 'center', whiteSpace: 'nowrap' } },
            date(current?.date ?? '', { short: true })),
          h('button.iconbtn', {
            onclick: () => { state.ui.dateIndex = Math.max(0, state.ui.dateIndex - 1); commit('c1'); },
            'aria-label': t('b4.nextdate', 'Next image'),
          }, icon('forward', 20, 'flip')))))),
  };
}

/* -- C2 · Layers, WF5.062 / WF5.063 / WF5.064 ------------------------------- */

export function C2() {
  const L = layers();
  const set = (key, value) => { L[key] = value; commit('layers'); };

  const layerRow = (key, label, featureKey) => {
    // WF5.064 — locked layers appear in the list with a lock and open the upgrade sheet.
    if (featureKey && !has(featureKey)) return lockedRow(featureKey, label);
    return switchRow(label, L[key], (v) => set(key, v));
  };

  return {
    top: appBar({ title: t('c2.title', 'Layers') }),
    body: page(
      section(t('c2.basemap', 'Basemap'), {},
        card({}, ['satellite', 'terrain', 'street'].map((b) => row({
          title: t(`c2.basemap.${b}`, b[0].toUpperCase() + b.slice(1)),
          onclick: () => set('basemap', b),
          value: L.basemap === b ? icon('check', 20) : null,
          chevron: false,
        })))),

      section(t('c2.measures', 'Measure layers'), {},
        card({}, measures().map((m) => (has(m.featureKey)
          ? row({
              title: t(`measure.${m.key}`, m.plain), sub: m.technical,
              onclick: () => { state.ui.measure = m.key; commit('measure'); },
              value: state.ui.measure === m.key ? icon('check', 20) : null, chevron: false,
            })
          : lockedRow(m.featureKey, t(`measure.${m.key}`, m.plain), m.technical))))),

      section(t('c2.farmlayers', 'Farm layers'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('boundaries', t('c2.boundaries', 'Farm and plot boundaries')),
          layerRow('blocks', t('c2.blocks', 'Block boundaries')),
          layerRow('labels', t('c2.labels', 'Plot labels')),
          layerRow('trees', t('c2.trees', 'Tree points'), 'tree.mapping')))),

      section(t('c2.gis', 'Advanced map layers'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('soil', t('c2.soil', 'Soil type'), 'gis.advanced'),
          layerRow('landuse', t('c2.landuse', 'Land use'), 'gis.advanced'),
          layerRow('labs', t('c2.labs', 'Testing labs'), 'gis.advanced')))),

      section(t('c2.vra', 'Variable rate maps'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('vraSowing', t('c2.vra.sowing', 'Sowing'), 'vra.maps'),
          layerRow('vraNitrogen', t('c2.vra.n', 'Nitrogen'), 'vra.maps'),
          layerRow('vraPK', t('c2.vra.pk', 'Phosphorus and potassium'), 'vra.maps'),
          layerRow('zoning', t('c2.vra.zoning', 'Zoning'), 'vra.maps')))),

      section(t('c2.irrigation', 'Irrigation'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('irrigation', t('c2.irrigationmap', 'Irrigation map'), 'irrigation.map')))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('c2.persist', 'Your layer choices are remembered between sessions.'), req('WF5.063'))),
  };
}

/* -- C4 · Compare dates on the map, WF5.067 ------------------------------- */

export function C4() {
  const L = layers();
  const ui = local('c4', { split: 50, left: 6, right: 0 });
  const farms = visibleFarms();
  const farmFilter = state.ui.farmFilter;
  const farm = farmFilter === 'all' ? farms[0] : farmById(farmFilter);
  const plots = farmFilter === 'all' ? allVisiblePlots() : plotsOf(farm.id);
  const dates = farm.imageryDates;
  const leftDate = dates[Math.max(0, dates.length - 1 - ui.left)];
  const rightDate = dates[dates.length - 1 - ui.right];
  const measureKey = state.ui.measure;

  return {
    top: appBar({ title: t('c4.title', 'Compare dates'), subtitle: farm.name }),
    // WF5.067 — a draggable divider with a different date either side.
    body: compareStage(ui.split, {},
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        mapSvg({
          plots, measure: measureKey, basemap: L.basemap, layers: L,
          dateKey: rightDate.date, compareMeasure: measureKey, comparePct: ui.split,
        })),
      compareLine(40),
      compareSlider({
        value: ui.split, min: 5, max: 95, label: t('b8.slider', 'Move the divider'),
        onRelease: (pct) => { ui.split = pct; commit('c4'); },
      }),
      h('span.mapchip', { style: { position: 'absolute', insetInlineStart: '12px', top: '12px' } }, date(leftDate.date, { short: true })),
      h('span.mapchip', { style: { position: 'absolute', insetInlineEnd: '12px', top: '12px' } }, date(rightDate.date, { short: true })),
      h('div', {
        style: {
          position: 'absolute', insetInline: '10px', bottom: '10px', background: 'var(--paper)',
          borderRadius: 'var(--radius)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px',
          boxShadow: 'var(--shadow-2)',
        },
      },
      h('div', { style: { display: 'flex', gap: '8px', minWidth: 0 } },
        select(dates.map((dt, i) => ({ value: String(dates.length - 1 - i), label: date(dt.date, { short: true }) })).reverse(),
          String(ui.left), (v) => { ui.left = Number(v); commit('c4'); }, { style: { flex: '1 1 0', minWidth: 0 } }),
        select(dates.map((dt, i) => ({ value: String(dates.length - 1 - i), label: date(dt.date, { short: true }) })).reverse(),
          String(ui.right), (v) => { ui.right = Number(v); commit('c4'); }, { style: { flex: '1 1 0', minWidth: 0 } })),
      legend(measureKey, measureByKey(measureKey).technical))),
  };
}

/* -- C5 · Boundary editor, WF5.073 … WF5.075 ------------------------------ */

export function C5(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const ui = local(`c5-${plot.id}`, { points: plot.geometry.map((p) => [...p]), selected: null });

  // WF5.075 — boundary editing is not available offline.
  if (state.session.connectivity === 'offline') {
    return {
      top: appBar({ title: t('c5.title', 'Edit boundary'), subtitle: plot.name }),
      body: page(disclaimer(t('offline.boundary', 'You need a connection to change a boundary. Everything else on this plot still works offline.'), true)),
    };
  }
  // WF5.075 — and it requires farm.boundary.edit.
  if (!can('farm.boundary.edit', farm)) {
    return {
      top: appBar({ title: t('c5.title', 'Edit boundary'), subtitle: plot.name }),
      body: page(disclaimer(t('c5.nopermission', 'Only a farm owner or supervisor can change a boundary.'), true)),
    };
  }

  const editor = boundaryCanvas({
    points: ui.points, selected: ui.selected,
    onChange: ({ selected }) => { ui.selected = selected; commit('c5'); },
  });

  return {
    tabs: false,
    top: appBar({
      title: t('c5.title', 'Edit boundary'), subtitle: plot.name,
      actions: [
        barAction('undo', t('action.undo', 'Undo'), () => undoVertex(ui.points)),
        barAction('trash', t('c5.deletevertex', 'Delete point'), () => {
          if (ui.selected == null) return;
          ui.points.splice(ui.selected, 1); ui.selected = null; commit('c5');
        }, { disabled: ui.selected == null }),
      ],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', position: 'relative', minHeight: '240px' } },
        mapSvg({ plots: plotsOf(farm.id).filter((p) => p.id !== plot.id), measure: 'ndvi', layers: { labels: false } }),
        editor.node),
      h('div', { style: { padding: '14px 16px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: '8px' } },
        h('div', h('span.num', area(editor.areaHa))),
        when(editor.invalid, () => disclaimer(t('a8d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        // WF5.074 — a versioned event, not an overwrite.
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('c5.versioned', 'The previous boundary is kept, with who changed it and when. Past analytics stay attached to the shape that was in force at the time.'),
          req('WF5.074')))),
    dock: actionDock(btn(t('action.save', 'Save boundary'), {
      variant: 'primary', disabled: ui.points.length < 3 || editor.invalid,
      onclick: () => { saveBoundary(plot, ui.points.map((p) => [...p])); back(); },
    })),
  };
}
