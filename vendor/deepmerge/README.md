# Local security patch for deepmerge

This private package vendors the self-contained CommonJS distribution and types
from MIT-licensed `deepmerge@4.3.1`. The original licence is in `license.txt`.
It is installed as `deepmerge` through the root npm override, including the
Svelte Vite plugin's dependency. It is not an upstream release.

[CVE-2026-93753 / GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
has no published upstream fix as of 2026-11-03. The original implementation can
change the returned object's prototype when a target has an enumerable own
`__proto__` property, or when the target has a null prototype.

The local change adds `setProperty` and replaces all three assignments to the
object destination with `Object.defineProperty`. Copies and recursive merges
therefore create ordinary data properties without invoking inherited setters.
Array merging, custom merging, symbols, cloning and the existing inherited-key
guard retain their upstream behavior. The source and declarations are kept in
upstream formatting so the patch remains easy to review.

`e2e/dependency-security-model.e2e.ts` tests the installed dependency against
these attacks and checks the configuration-merging behavior used by Svelte.
The tests run in the normal model suite, including the release gate. The full
build and browser suites also validate the Svelte consumer.

Remove this override and directory when an upstream fixed release is available,
retaining the regression tests. A clean npm audit does not independently certify
this private patch; the code review and regression tests provide that evidence.
