/**
 * The stacked-stone mark, at three weights.
 *
 * The name is the design: a cairn is a pile of stones that marks a trail, and
 * each commit adds one. Reusing that shape as the loading state, the empty
 * state and the brand mark is what stops the product looking like a generic
 * dark dashboard.
 */

/** Flat silhouette, for the navbar and favicons. */
export const CairnMark = ({ size = 24, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <ellipse
      cx="32"
      cy="53.5"
      rx="21"
      ry="6.5"
      transform="rotate(-2 32 53.5)"
    />
    <ellipse
      cx="32"
      cy="41.5"
      rx="16.5"
      ry="5.8"
      transform="rotate(3 32 41.5)"
    />
    <ellipse
      cx="32"
      cy="30.5"
      rx="12.5"
      ry="5.2"
      transform="rotate(-4 32 30.5)"
    />
    <ellipse cx="32" cy="20.8" rx="9" ry="4.4" transform="rotate(2 32 20.8)" />
    <ellipse
      cx="32"
      cy="12.6"
      rx="5.6"
      ry="3.6"
      transform="rotate(-3 32 12.6)"
    />
  </svg>
);

const STONES = [
  { cy: 53.5, rx: 21, ry: 6.5, rotate: -2, tone: 0 },
  { cy: 41.5, rx: 16.5, ry: 5.8, rotate: 3, tone: 1 },
  { cy: 30.5, rx: 12.5, ry: 5.2, rotate: -4, tone: 2 },
  { cy: 20.8, rx: 9, ry: 4.4, rotate: 2, tone: 3 },
  { cy: 12.6, rx: 5.6, ry: 3.6, rotate: -3, tone: 4 },
];

// Bottom stones sit in shade, top stones catch the light.
const TONES = ["#5c554d", "#6d6459", "#867a6b", "#a3937f", "#c9a97e"];

/**
 * Shaded illustration for hero and empty-state use.
 *
 * `animate` staggers the stones into place, which reads as the pile being
 * built — used as the app's loading state.
 */
export const CairnIllustration = ({
  size = 160,
  animate = false,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 68"
    className={`cairn-illustration ${animate ? "cairn-animate" : ""} ${className}`}
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="cairn-glow" cx="50%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#e3a857" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#e3a857" stopOpacity="0" />
      </radialGradient>
    </defs>

    <circle cx="32" cy="30" r="32" fill="url(#cairn-glow)" />

    {/* Ground shadow anchoring the stack */}
    <ellipse cx="32" cy="61" rx="24" ry="3.4" fill="rgba(0,0,0,0.35)" />

    {STONES.map((stone, index) => (
      <g
        key={stone.cy}
        style={animate ? { animationDelay: `${index * 0.12}s` } : undefined}
      >
        <ellipse
          cx="32"
          cy={stone.cy}
          rx={stone.rx}
          ry={stone.ry}
          fill={TONES[stone.tone]}
          transform={`rotate(${stone.rotate} 32 ${stone.cy})`}
        />
        {/* Highlight along the lit upper edge */}
        <ellipse
          cx="32"
          cy={stone.cy - stone.ry * 0.42}
          rx={stone.rx * 0.72}
          ry={stone.ry * 0.32}
          fill="rgba(255, 244, 224, 0.16)"
          transform={`rotate(${stone.rotate} 32 ${stone.cy})`}
        />
      </g>
    ))}
  </svg>
);

export default CairnMark;
