import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom implements CSS.escape but not CSS.supports, which Primer's PageLayout
// calls at import time. Reporting "unsupported" makes it fall back to its
// non-dvh code path, which is what we want in a test DOM anyway.
if (typeof globalThis.CSS === "undefined") {
  globalThis.CSS = {};
}
if (typeof globalThis.CSS.supports !== "function") {
  globalThis.CSS.supports = () => false;
}

// Primer components also read matchMedia during layout.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
