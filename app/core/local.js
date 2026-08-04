/* ---------------------------------------------------------------------------
   local.js — per-screen scratch state.

   Screens are re-rendered from scratch on every commit, so anything a screen
   needs to remember between renders (a half-typed phone number, which welcome
   card is showing, the vertices placed so far) lives here rather than in a
   module-level variable. Keyed by screen so two screens never collide, and
   droppable when a flow finishes.
   --------------------------------------------------------------------------- */

const scratch = new Map();

export function local(key, initial = {}) {
  if (!scratch.has(key)) scratch.set(key, structuredClone(initial));
  return scratch.get(key);
}

export function resetLocal(key) {
  scratch.delete(key);
}

export function resetAllLocal() {
  scratch.clear();
}
