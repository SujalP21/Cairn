import { useMemo } from "react";

/*
 * Deterministic identicons.
 *
 * Every account gets a distinct, stable image with no uploads, no storage and
 * no API work — the pattern is derived from the user id alone. Hues are pulled
 * from the app's own earth palette so a wall of avatars still looks like one
 * product rather than a bag of random colours.
 */

const HUES = [
  ["#e3a857", "#8a6a34"], // sandstone
  ["#7fa274", "#4c6545"], // lichen
  ["#c9563f", "#7d3527"], // terracotta
  ["#6f8fae", "#42566b"], // slate blue
  ["#b08cc0", "#6b5478"], // heather
  ["#d9a441", "#8a6828"], // ochre
];

function hash(value) {
  let h = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return Math.abs(h);
}

/** 5x5 grid, mirrored horizontally so the result always looks intentional. */
function buildPattern(seed) {
  const cells = [];

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const bit = (seed >> ((y * 3 + x) % 30)) & 1;
      if (!bit) continue;

      cells.push([x, y]);
      if (x < 2) cells.push([4 - x, y]);
    }
  }

  return cells;
}

export const Avatar = ({ userId, name, size = 40, className = "" }) => {
  const { cells, fg, bg } = useMemo(() => {
    const seed = hash(String(userId ?? name ?? "cairn"));
    const [foreground, background] = HUES[seed % HUES.length];

    return { cells: buildPattern(seed), fg: foreground, bg: background };
  }, [userId, name]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      className={`avatar ${className}`}
      role="img"
      aria-label={name ? `${name}'s avatar` : "Avatar"}
      style={{ background: bg, borderRadius: "50%" }}
    >
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fg} />
      ))}
    </svg>
  );
};

export default Avatar;
