# Helper Patches

## node-domexception

This directory contains a local patch for `node-domexception` to resolve a deprecation warning caused by specific dependencies (like `fetch-blob` -> `node-fetch`).
Since `node-domexception` is deprecated in favor of the native `DOMException` present in modern Node.js environments, this patch simply re-exports `globalThis.DOMException`.

This is enabled via `pnpm.overrides` in the root `client/package.json`.
