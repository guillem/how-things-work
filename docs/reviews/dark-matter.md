# Review: dark-matter

## Verdict
Ready after the fixes below. The model is careful (real SPARC mass models, Bradač/Clowe masses and positions, Planck 2018), and nearly every quoted number checks out against the model and its sources. The most important fix is the Bullet Cluster field size in the dark-matter slider's help text, which is wrong by a factor of 3.26 (kpc converted to Mpc, then labelled light years).

## Factual errors
- **high** — `src/routes/dark-matter/steps.ts:67`: "inside the 1.3 × 0.8 million-light-year field of the Hubble images". Bradač et al. (2006) give the field as 4.9′ × 3.2′ = 1300 × 830 kpc, i.e. 1.3 × 0.83 Mpc = about 4.2 × 2.7 million light years (1 kpc = 3,260 ly, as the page itself says). Fix: "inside the 4.2 × 2.7 million-light-year field of the Hubble images", and test the conversion from `BRADAC.fieldKpc`. Source: https://ar5iv.labs.arxiv.org/html/astro-ph/0608408 (Table 3, §IV).
- **medium** — `steps.ts:247`: "The most sensitive direct search so far, the LZ tank … found no signal in 280 days of data and set the tightest limits yet on WIMPs (LZ Collaboration 2025, arXiv:2410.17036)". Out of date: in December 2025 LZ reported 417 live days (5.7 tonne-years), still with no WIMP signal, extending the limits to WIMPs of 3–9 GeV; in September 2026 a higher-energy analysis reported one unexplained event at 2.6σ, far short of a discovery. Fix: cite the 280-day limits and the 417-day update, and say a 2026 single-event hint is not a detection. Sources: https://www.ucl.ac.uk/news/2025/dec/dark-matter-search-achieves-new-record-and-spots-neutrinos-suns-core ; https://www.kcl.ac.uk/news/kings-scientists-dig-into-surprising-result-in-search-for-dark-matter ; https://arxiv.org/abs/2410.17036
- **low** — `steps.ts:247`: EROS-2 "about 39 were expected if the halo were made of half-Sun objects". Tisserand et al. (2007) say ~39 events for objects of ~0.4 M☉. Fix: "objects of 0.4 Suns". Source: https://arxiv.org/abs/astro-ph/0607207
- **low** — `steps.ts:128`: "first seen in starlight by Vera Rubin and Kent Ford … (1970), then in radio by Albert Bosma (1978)". Rubin & Ford measured emission lines of glowing gas clouds (H II regions), not starlight; and flat radio (21-cm) curves predate Bosma (Roberts & Whitehurst 1975, Andromeda). Fix: "first seen in the light of glowing gas clouds by Vera Rubin and Kent Ford in the Andromeda galaxy (1970), then much further out with radio telescopes (Morton Roberts and Robert Whitehurst for Andromeda in 1975, Albert Bosma for many spirals in 1978)". Source: https://ui.adsabs.harvard.edu/abs/1975ApJ...201..327R
- **low** — `lensing.ts:15`: header cites Bradač "§5 and Table 4"; the ACS-field masses are in Table 3 and the 250 kpc masses in §IV. Fix the citation.

Everything else checked holds: NGC 3198 distance, masses, inclination, periods; 21-cm line and its 0.1 mm shift; van Albada et al. 1985; Eilers et al. 2019 (229 km/s, −1.7 km/s/kpc, 23,000 red giants, M_vir 7.25 × 10¹¹ M☉ of dark halo); SPARC 175 galaxies; Bullet Cluster z, lookback 3.4 Gyr, 13 and 91 × 10¹³ M☉, 2.8/2.3 × 10¹⁴ M☉ within 250 kpc, 8σ offset; Markevitch et al. 2002 (Mach 2–3, 3,000–4,000 km/s, 0.1–0.2 Gyr); Planck 2018 fractions; MOND 1983.

## Model issues
- **medium** — `galaxies.ts:212` / `steps.ts:23`: `bestHalo` searches halo ratios up to `RATIO_MAX` = 40, but the slider and chart handle stop at `RATIO_MAX / 2` = 20. At low Υ the "Find the best halo" button writes values outside the control (NGC 2841 at Υ = 0.1: 34). Fix: make the search box the control's range (one constant, 20) and test that the button's result always fits the control.
- **low** — `galaxies.ts:201`: a halo of zero mass still counts as 3 adjusted values, so "χ² per point" reads 816 on `hidden` and 777 on `visible` for the same model. Fix: `k = h && h.ratio > 0 ? 3 : 1`.

Otherwise the model is sound: quadrature sum of SPARC components with sign, pseudo-isothermal halo mass formula, Plummer lensing κ and shear, reduced-shear ellipticity transform, flat ΛCDM distances.

## Narrative and scene mismatches
- **medium** — `steps.ts:168, 181`: the halo note says "a χ² per point of about 1–2 is as good as it gets", but NGC 2403's best halo only reaches ~15 per point (readout "close, not quite"), with no explanation. Its rms miss is only 6 km/s; its error bars are tiny (some under 1 km/s) and spiral arms make small wiggles no smooth model follows. Fix: add a sentence to the `others` note.

All other quoted numbers match what the model computes (57 and 65 km/s, 6.8×, 245, 5.6×, 5½–8×, 5.3×, 5.4×, ~200 kpc offsets, 1.8 and 4.2 Gyr).

## Catalogue requirements
All met: the galaxy spun with visible matter vs measured speeds, an adjustable halo fitted to real rotation curves (four SPARC galaxies), the excess mass shown by lensing in the Bullet Cluster, the "about five times" takeaway on the budget scene.

## Clarity
No problems found for level 2; jargon (kpc, χ², Doppler, lensing, CMB, WIMPs) is defined where first used.

## Sources consulted
- Bradač et al. 2006, https://ar5iv.labs.arxiv.org/html/astro-ph/0608408
- Markevitch et al. 2002, https://arxiv.org/abs/astro-ph/0110468
- Tisserand et al. 2007, https://arxiv.org/abs/astro-ph/0607207
- Eilers et al. 2019, https://arxiv.org/abs/1810.09466
- LZ Collaboration 2025, https://arxiv.org/abs/2410.17036 ; December 2025 update, https://www.ucl.ac.uk/news/2025/dec/dark-matter-search-achieves-new-record-and-spots-neutrinos-suns-core ; September 2026 hint, https://www.kcl.ac.uk/news/kings-scientists-dig-into-surprising-result-in-search-for-dark-matter
- Roberts & Whitehurst 1975, https://ui.adsabs.harvard.edu/abs/1975ApJ...201..327R
