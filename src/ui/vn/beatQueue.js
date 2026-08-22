/**
 * Beat reveal queue. Pure, so the pacing logic is testable without a DOM.
 *
 * The model returns up to three beats per call and the player uncovers them one
 * tap at a time. While they read, the next call is already in flight - the
 * player's own pacing is the latency budget (CLAUDE.md section 8).
 */

export function newQueue() {
  return { current: null, pending: [], shown: 0 };
}

/** Beats arriving from the stream. The first one shows immediately. */
export function enqueue(queue, beats) {
  if (beats.length === 0) return queue;
  if (!queue.current) {
    return { current: beats[0], pending: [...queue.pending, ...beats.slice(1)], shown: queue.shown + 1 };
  }
  return { ...queue, pending: [...queue.pending, ...beats] };
}

export function hasMore(queue) {
  return queue.pending.length > 0;
}

export function advance(queue) {
  if (queue.pending.length === 0) return queue;
  const [next, ...rest] = queue.pending;
  return { current: next, pending: rest, shown: queue.shown + 1 };
}

/** True once every beat of the turn has been read. */
export function isDrained(queue) {
  return Boolean(queue.current) && queue.pending.length === 0;
}

/** A new turn clears what came before. Block 5 is the only thing that grows. */
export function reset() {
  return newQueue();
}
