// Pure layout rules for the Groups meeting screen. No browser or Daily code here,
// so these can be checked on their own.

/** How many people are shown at once: fewer on a phone, where tiles get small fast. */
export function pageSizeFor(width: number): number {
  return width > 0 && width < 700 ? 6 : 9;
}

/** How many people sit in the strip under a shared screen. */
export function stripSizeFor(width: number): number {
  return width > 0 && width < 700 ? 3 : 6;
}

/**
 * Picks the number of columns that gives the largest tiles for this many people
 * in a box this size, so two people sit side by side on a laptop and stacked on a phone.
 */
export function bestColumns(count: number, width: number, height: number): number {
  if (count <= 1 || !width || !height) return 1;
  const ratio = 4 / 3;
  let best = 1;
  let bestWidth = 0;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tileWidth = Math.min(width / cols, (height / rows) * ratio);
    if (tileWidth > bestWidth + 0.5) {
      bestWidth = tileWidth;
      best = cols;
    }
  }
  return best;
}

/**
 * Keeps the display order steady as people come and go: everyone already in the
 * order stays where they are, people who left drop out, newcomers go on the end.
 * Returns the same array when nothing changed.
 */
export function reconcileOrder(order: string[], present: string[]): string[] {
  const here = new Set(present);
  const kept = order.filter((id) => here.has(id));
  const known = new Set(kept);
  const added = present.filter((id) => !known.has(id));
  if (added.length === 0 && kept.length === order.length) return order;
  return [...kept, ...added];
}

/**
 * Brings someone who just started talking onto the first page.
 *
 * `order` lists everyone except you; `slots` is how many of them fit on the first
 * page. If the speaker is already there, nothing moves. Otherwise they trade places
 * with whoever on the first page has gone longest without speaking, so only one
 * tile changes instead of the whole grid reshuffling.
 */
export function promoteSpeaker(
  order: string[],
  speakerId: string,
  slots: number,
  lastSpoke: Record<string, number>
): string[] {
  const at = order.indexOf(speakerId);
  if (at < 0 || slots <= 0 || at < slots) return order;

  let quietest = 0;
  for (let i = 1; i < slots; i++) {
    if ((lastSpoke[order[i]] ?? 0) < (lastSpoke[order[quietest]] ?? 0)) quietest = i;
  }

  const next = order.slice();
  next[at] = order[quietest];
  next[quietest] = speakerId;
  return next;
}
