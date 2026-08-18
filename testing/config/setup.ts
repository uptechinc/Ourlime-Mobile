// Test environment global setup and polyfills for Ourlime Mobile

if (typeof globalThis.fetch === 'undefined') {
  // Polyfill fetch if needed
}

// Silence expected log outputs during testing if desired
export const isTestEnvironment = true;
