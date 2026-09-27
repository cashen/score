# 我的高三 Share E-ink Reading System v0.14.3.0

## Baseline
- main: 5a6ed9754e9e79e1bb0fde34bab8c3e6cddfe7a5
- current package: 0.14.2.3
- open PR #64 is unrelated production-attestation work and remains untouched.

## Architecture
- Independent visual layer: /public/css/share-eink-v001.css
- Runtime semantics remain in public/app.js; only the share visual root/class changes.
- No data model, Share v2, API, URL, comparison or permission changes.
- index.html loads the E-ink layer after the existing UI Foundation so it is explicit and reversible.

## Visual contract
- E-ink-like calm grayscale, not paper texture or penmanship.
- Continuous reading surface; sections use typography and hairline dividers instead of cards.
- Score numbers are the strongest visual element without status colors.
- Mobile, tablet and desktop use different reading densities while keeping the same information order.
- No gradients, decorative ink strokes, heavy shadows or simulated paper texture.

## Accessibility contract
- 44px minimum interactive controls.
- Visible keyboard focus.
- Reduced motion, high contrast and forced-colors support.
- No hover-only information.

## Compatibility
- Preserve total / subject / timeline views and deep links.
- Preserve actual subjectSet semantics, historical ranking facts, share whitelist and deleted-exam behavior.
- Browser verification targets Chromium 360/390/768/1280 and WebKit 390, plus no horizontal overflow at narrow widths.

## Release
- Version 0.14.3.0.
- Exact tested HEAD required before PR ready.
- Merge only after CI/browser verification; then verify exact main SHA and production appVersion/buildSha.
