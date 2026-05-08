import "@testing-library/jest-dom/vitest";

// Mock crypto for hashPassword tests
const { subtle } = globalThis.crypto;
if (!subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      subtle: {
        digest: () => Promise.resolve(new Uint8Array(32).buffer),
      },
      randomUUID: () => "00000000-0000-0000-0000-000000000000",
    },
    writable: true,
  });
}
