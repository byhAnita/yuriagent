import { describe, it, expect } from 'vitest';
import { newQueue, enqueue, advance, hasMore, isDrained, reset } from './beatQueue.js';

const beat = (text) => ({ speaker: 'irene', emotion: 'neutral', guard: 0, fluster: 0, text });

describe('beat reveal', () => {
  it('shows the first beat immediately and holds the rest', () => {
    const q = enqueue(newQueue(), [beat('one'), beat('two'), beat('three')]);
    expect(q.current.text).toBe('one');
    expect(q.pending).toHaveLength(2);
    expect(hasMore(q)).toBe(true);
  });

  it('uncovers one beat per tap', () => {
    let q = enqueue(newQueue(), [beat('one'), beat('two'), beat('three')]);
    q = advance(q);
    expect(q.current.text).toBe('two');
    q = advance(q);
    expect(q.current.text).toBe('three');
    expect(hasMore(q)).toBe(false);
    expect(isDrained(q)).toBe(true);
  });

  it('is a no-op once drained, so an extra tap cannot skip a turn', () => {
    let q = enqueue(newQueue(), [beat('only')]);
    const before = q;
    q = advance(q);
    expect(q).toEqual(before);
  });

  it('appends beats that arrive later in the stream without stealing focus', () => {
    let q = enqueue(newQueue(), [beat('one')]);
    q = enqueue(q, [beat('two')]);
    expect(q.current.text).toBe('one');
    expect(q.pending).toHaveLength(1);
  });

  it('ignores an empty chunk', () => {
    const q = enqueue(newQueue(), []);
    expect(q.current).toBeNull();
    expect(isDrained(q)).toBe(false);
  });

  it('counts how many beats the player has actually read', () => {
    let q = enqueue(newQueue(), [beat('one'), beat('two')]);
    expect(q.shown).toBe(1);
    q = advance(q);
    expect(q.shown).toBe(2);
  });

  it('clears on a new turn', () => {
    const q = enqueue(newQueue(), [beat('one'), beat('two')]);
    expect(reset(q)).toEqual(newQueue());
  });
});
