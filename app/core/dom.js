/* ---------------------------------------------------------------------------
   dom.js — a 60-line hyperscript. The whole mockup renders through this, so
   there is exactly one place that knows how an element gets built.

     h('div.card', {onclick}, h('h2', 'Title'), list.map(row))

   Tag syntax: 'tag.class.class#id'. Props are DOM properties where they exist
   (onclick, value, checked), attributes otherwise (aria-*, data-*, role).
   --------------------------------------------------------------------------- */

import { isolateLatin } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'filter', 'feTurbulence', 'feColorMatrix', 'feBlend',
  'feComposite', 'feGaussianBlur', 'feDisplacementMap', 'linearGradient',
  'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'image', 'use', 'title',
]);

export function h(spec, props, ...children) {
  const [tag, classes, id] = parseSpec(spec);
  const isSvg = SVG_TAGS.has(tag);
  const el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);

  if (classes.length) el.setAttribute('class', classes.join(' '));
  if (id) el.id = id;

  // Second argument is props only when it is a plain object.
  if (props != null && typeof props === 'object' && !Array.isArray(props) && !(props instanceof Node)) {
    applyProps(el, props, isSvg);
  } else if (props != null) {
    children.unshift(props);
  }

  append(el, children);
  return el;
}

function parseSpec(spec) {
  if (typeof spec !== 'string') throw new TypeError('h(): tag must be a string');
  const hashAt = spec.indexOf('#');
  const id = hashAt === -1 ? '' : spec.slice(hashAt + 1);
  const head = hashAt === -1 ? spec : spec.slice(0, hashAt);
  const parts = head.split('.');
  return [parts[0] || 'div', parts.slice(1).filter(Boolean), id];
}

function applyProps(el, props, isSvg) {
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') {
      el.setAttribute('class', [el.getAttribute('class'), value].filter(Boolean).join(' '));
    } else if (key === 'style' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (v == null) continue;
        if (k.startsWith('--')) el.style.setProperty(k, String(v));
        else el.style[k] = v;
      }
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key === 'text') {
      el.textContent = isolateLatin(String(value));
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (!isSvg && key in el && key !== 'list' && key !== 'form') {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

function append(el, children) {
  for (const child of children) {
    if (child == null || child === false || child === true) continue;
    if (Array.isArray(child)) { append(el, child); continue; }
    // WF-752 — every text node passes through bidi isolation, so a measurement
    // or an identifier keeps its order inside an Arabic or Pashto sentence
    // whether it came from the catalogue or was assembled in a screen.
    el.appendChild(child instanceof Node ? child : document.createTextNode(isolateLatin(String(child))));
  }
}

/** Replace an element's children in one shot. */
export function mount(host, ...children) {
  host.replaceChildren();
  append(host, children);
  return host;
}

/** Fragment, for returning sibling lists from a helper. */
export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/** Conditional helper that reads better than `cond && h(...)` in long lists. */
export function when(cond, build) {
  return cond ? build() : null;
}
