# Security compatibility patches

Use Bun 1.4.4 and the committed `bun.lock`. Bun applies these patches during installation, including `--frozen-lockfile --ignore-scripts`; no postinstall hook is needed. Do not discard patches to resolve lockfile conflicts.

- `query-string@7.1.3`: normalize the ESM namespace of patched `decode-uri-component@0.5.1` into the callable decoder expected by this CommonJS consumer. Keeps Expo Router's existing API.
- `metro@0.83.3`: read filename-based image inputs as bytes for `image-size@2.0.4`. Its default export already works with Metro's interop; the removed path API needed adaptation.
- `node-forge@1.4.0`: reject extra nested DigestAlgorithm elements during PKCS#1 v1.5 validation. Narrow local backport of the check proposed in https://github.com/digitalbazaar/forge/pull/1152, addressing https://github.com/advisories/GHSA-86w9-cpqp-85rv. This is a local fix, not an upstream release. The package-version audit continues to flag 1.4.0; the advisory has not been suppressed.

`bun test scripts/security-dependencies.test.js` checks the installed packages, including normal URI decoding, large malformed input, real image assets, Metro's path API, valid RSA signatures with/without NULL parameters, and rejection of extra nested elements. These tests are included in the normal `bun test` suite and CI.

When upstream dependencies ship compatible fixes, remove the relevant patch and override together and rerun these tests plus Android/iOS/web exports. Retain the RSA regression after replacing its local patch.
