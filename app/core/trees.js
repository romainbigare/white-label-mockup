/* ---------------------------------------------------------------------------
   trees.js — when trees are a crop the app watches, and when they are not.

   FORTY TREES MAKE A TREE CROP — the October review (the early idea was ten;
   fifty was said and not chosen). It was set per species, while a tree group
   was a species; since trees are grouped by the FIELD the farmer draws, it is
   applied per tree field. Below it the trees are still counted, but the field
   is not a tree group: no advice and no irrigation schedule. Five fig trees by
   the house are not an orchard, and a schedule worked out for them is a
   schedule nobody will follow.

   ONE RULE, IN ONE PLACE, because four screens list tree groups — My Farm
   (B1), the map (C1), the advice inbox (D1) and the survey results (A16) —
   and each of them asks this function rather than knowing the number. The
   read layer (data/selectors.js) applies it to the farm's plots and the
   survey (screens/onboarding.js) applies it to what the satellite found.

   The number is still being checked against ADAFSA's data: at 6 × 6 m
   spacing forty trees is about 0.15 ha, not a hectare. If it moves, it moves
   here.
   --------------------------------------------------------------------------- */

export const MIN_GROUP_TREES = 40;

/** Are this many trees in one field enough to be a tree group? */
export function formsTreeGroup(treeCount) {
  return (treeCount ?? 0) >= MIN_GROUP_TREES;
}

/** Is this plot record one the app watches? Every field is; a tree field
    from forty trees — or while it is still being counted, when nobody knows. */
export function isWatched(plot) {
  return plot.kind !== 'trees' || !!plot.counting || formsTreeGroup(plot.treeCount);
}
