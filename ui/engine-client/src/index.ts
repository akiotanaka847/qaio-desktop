/**
 * @qaio-ai/engine-client — TypeScript SDK for the Qaio Engine.
 *
 * Consumed by:
 * - Qaio desktop app (`app/src/`) via `window.__QAIO_ENGINE__`
 * - Qaio mobile app (direct connect, out of scope until Phase 5)
 * - Third-party integrators (npm package)
 *
 * Single source of truth for the wire protocol, matching
 * `engine/qaio-engine-protocol`.
 */

export * from "./types";
export * from "./client";
export * from "./ws";
