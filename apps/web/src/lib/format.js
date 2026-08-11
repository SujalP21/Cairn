const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "2 days ago" — friendlier than a raw date for recency. */
export function timeAgo(value) {
  if (!value) return null;

  const seconds = (Date.now() - new Date(value).getTime()) / 1000;

  if (seconds < 45) return "just now";

  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      return relative.format(-Math.round(seconds / size), unit);
    }
  }

  return "just now";
}

export function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Palette-constrained accents, so a grid of repositories still reads as one
// product rather than a bag of random colours.
const ACCENTS = [
  "#e3a857",
  "#7fa274",
  "#c9563f",
  "#6f8fae",
  "#b08cc0",
  "#d9a441",
];

/** Stable per-repository accent derived from its name. */
export function accentFor(name = "") {
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return ACCENTS[hash % ACCENTS.length];
}
