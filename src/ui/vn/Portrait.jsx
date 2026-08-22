/**
 * One asset per character. Emotion is CSS. CLAUDE.md section 14.
 *
 * The SVG is loaded as an <img> and recoloured through a CSS variable the art
 * itself references (`--mascot-base`), which is why the card palette can drive
 * five different characters from one shared drawing system.
 *
 * portraitMode `single` and `multi` are v2. The structure here already treats
 * the portrait as an opaque rectangle with all expression in the surrounding
 * chrome, which is exactly what `single` needs.
 */

const EMOTION_CLASS = {
  neutral: 'portrait--neutral',
  happy: 'portrait--happy',
  blush: 'portrait--blush',
  shy: 'portrait--shy',
  upset: 'portrait--upset',
  surprised: 'portrait--surprised',
};

export default function Portrait({
  card,
  emotion = 'neutral',
  speaking = true,
  size = 'full',
  /** Bump this to replay a one-shot keyframe for a repeated emotion. */
  pulseKey = 0,
}) {
  const cls = EMOTION_CLASS[emotion] ?? EMOTION_CLASS.neutral;
  const src = card.portraits?.neutral ?? `portraits/${card.id}.svg`;

  return (
    <div
      className={`relative flex items-end justify-center transition-all duration-500 ${
        size === 'full' ? 'h-full' : 'h-24'
      }`}
      style={{
        opacity: speaking ? 1 : 0.55,
        transform: speaking ? 'scale(1)' : 'scale(0.95)',
        '--mascot-base': card.palette.base,
        '--cheek': card.palette.accent,
      }}
    >
      <img
        key={`${emotion}-${pulseKey}`}
        src={src}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={`portrait ${cls} h-full w-auto max-w-full select-none object-contain`}
      />
      <div
        className={`portrait-blush-wash ${emotion === 'blush' ? 'portrait-blush-wash--on' : ''}`}
      />
    </div>
  );
}
