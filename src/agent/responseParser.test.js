import { describe, it, expect } from 'vitest';
import {
  parseMetaLine,
  parseResponse,
  totalDeltas,
  createStreamParser,
} from './responseParser.js';

const ctx = { rosterIds: ['irene', 'nana'], focusId: 'irene' };

describe('parseMetaLine', () => {
  it('parses the contract form', () => {
    expect(parseMetaLine('@irene|blush|guard-8|fluster+12')).toEqual({
      speaker: 'irene',
      emotion: 'blush',
      guard: -8,
      fluster: 12,
    });
  });

  it('returns null for prose', () => {
    expect(parseMetaLine('*She takes the bottle.* "Thanks."')).toBeNull();
    expect(parseMetaLine('')).toBeNull();
  });

  it('survives dropped pipes and reordered fields', () => {
    const out = parseMetaLine('@nana | upset fluster-5 guard+10');
    expect(out.speaker).toBe('nana');
    expect(out.guard).toBe(10);
    expect(out.fluster).toBe(-5);
  });

  it('falls back to neutral for an unknown emotion', () => {
    expect(parseMetaLine('@irene|smouldering|guard-2|fluster+2').emotion).toBe('neutral');
  });

  it('treats a malformed delta as zero', () => {
    const out = parseMetaLine('@irene|happy|guard|fluster');
    expect(out.guard).toBe(0);
    expect(out.fluster).toBe(0);
  });

  it('clamps an absurd delta rather than trusting it', () => {
    expect(parseMetaLine('@irene|happy|guard-9999|fluster+9999')).toMatchObject({
      guard: -40,
      fluster: 40,
    });
  });
});

describe('member bleed: the hard guarantee', () => {
  it('DROPS a beat whose speaker is not in the roster', () => {
    const raw = [
      '@irene|happy|guard-5|fluster+5',
      '"Thanks for waiting."',
      '',
      '@wendy|teasing|guard+0|fluster+0',
      '"Where is my present?"',
    ].join('\n');

    const { beats, dropped } = parseResponse(raw, ctx);
    expect(beats).toHaveLength(1);
    expect(beats[0].speaker).toBe('irene');
    expect(dropped).toHaveLength(1);
    expect(dropped[0].speaker).toBe('wendy');
    expect(dropped[0].reason).toBe('off-roster');
  });

  it('does not remap an off-roster speaker onto the focus character', () => {
    const raw = '@seulgi|happy|guard-5|fluster+5\n"Hello."';
    const { beats } = parseResponse(raw, ctx);
    expect(beats).toHaveLength(0);
  });

  it('keeps both speakers in a legitimate group scene', () => {
    const raw = [
      '@irene|neutral|guard-2|fluster+1',
      '"You are late."',
      '',
      '@nana|happy|guard-4|fluster+3',
      '"She has been waiting an hour."',
    ].join('\n');
    expect(parseResponse(raw, ctx).beats.map((b) => b.speaker)).toEqual(['irene', 'nana']);
  });
});

describe('malformed output', () => {
  it('renders bare prose as the focus character and moves nothing', () => {
    const raw = 'She looks up from her phone and almost smiles. "You came."';
    const { beats, malformed } = parseResponse(raw, ctx);

    expect(malformed).toBe(true);
    expect(beats).toHaveLength(1);
    expect(beats[0].speaker).toBe('irene');
    expect(beats[0].guard).toBe(0);
    expect(beats[0].fluster).toBe(0);
    expect(beats[0].emotion).toBeNull();
  });

  it('never returns a metadata line as visible text', () => {
    const raw = '@irene|blush|guard-8|fluster+12\n*a beat* "Thanks."';
    for (const beat of parseResponse(raw, ctx).beats) {
      expect(beat.text).not.toContain('@irene');
      expect(beat.text).not.toContain('guard-8');
    }
  });

  it('skips a metadata line with no prose under it', () => {
    const raw = '@irene|happy|guard-1|fluster+1\n\n@nana|neutral|guard+0|fluster+0\n"Hi."';
    const { beats } = parseResponse(raw, ctx);
    expect(beats).toHaveLength(1);
    expect(beats[0].speaker).toBe('nana');
  });

  it('never throws on junk', () => {
    for (const junk of ['', null, undefined, '@@@@', '|||', '@|||||', '\n\n\n']) {
      expect(() => parseResponse(junk, ctx)).not.toThrow();
    }
  });

  it('handles an empty roster without crashing', () => {
    expect(() => parseResponse('@irene|happy|guard+0|fluster+0\n"hi"', {})).not.toThrow();
  });
});

describe('totalDeltas', () => {
  it('sums meter movement across beats', () => {
    const raw = [
      '@irene|neutral|guard-5|fluster+3',
      '"One."',
      '',
      '@irene|blush|guard-7|fluster+9',
      '"Two."',
    ].join('\n');
    expect(totalDeltas(parseResponse(raw, ctx).beats)).toEqual({ guard: -12, fluster: 12 });
  });
});

describe('createStreamParser', () => {
  it('emits a beat as soon as its terminator arrives', () => {
    const parser = createStreamParser(ctx);

    expect(parser.push('@irene|blush|guard-8|fluster+12\n')).toHaveLength(0);
    expect(parser.push('*She looks up.* "You came."')).toHaveLength(0);

    const emitted = parser.push('\n\n@nana|happy|');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].speaker).toBe('irene');
    expect(emitted[0].emotion).toBe('blush');
  });

  it('flushes the tail on end', () => {
    const parser = createStreamParser(ctx);
    parser.push('@irene|happy|guard-3|fluster+4\n"One."\n\n');
    parser.push('@nana|shy|guard-1|fluster+2\n"Two."');

    const { beats } = parser.end();
    expect(beats.map((b) => b.speaker)).toEqual(['irene', 'nana']);
  });

  it('drops off-roster beats mid-stream too', () => {
    const parser = createStreamParser(ctx);
    parser.push('@joy|happy|guard-3|fluster+4\n"Hello."\n\n');
    parser.push('@irene|neutral|guard+0|fluster+0\n"Ignore her."');

    const { beats, dropped } = parser.end();
    expect(beats).toHaveLength(1);
    expect(dropped).toHaveLength(1);
  });

  it('produces the same result as a single-shot parse', () => {
    const raw = '@irene|happy|guard-3|fluster+4\n"One."\n\n@nana|shy|guard-1|fluster+2\n"Two."';
    const parser = createStreamParser(ctx);
    for (const ch of raw) parser.push(ch);

    expect(parser.end().beats).toEqual(parseResponse(raw, ctx).beats);
  });
});
