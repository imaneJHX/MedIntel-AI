import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });
// jsdom has no layout. Give chart containers a deterministic nonzero test size.
class ResizeObserverStub {
  observe(element: Element) {
    this.callback(
      [
        {
          contentRect: { width: 700, height: 350 },
          target: element,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  constructor(private callback: ResizeObserverCallback) {}
}
Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverStub,
  writable: true,
});
Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  value: () => ({
    width: 700,
    height: 350,
    top: 0,
    left: 0,
    right: 700,
    bottom: 350,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
});
