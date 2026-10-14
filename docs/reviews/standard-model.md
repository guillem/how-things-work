<!-- batch msgbatch_01GUhUe5w5pfyfpTsMBzj6fS, claude-opus-5-5, submitted 2026-10-14T18:05:36.569Z, ~$0.92 in tokens + 15 web searches -->
# Review: standard-model

## Verdict
Ready after the fixes below. The PDG data, the hadron builder and the conservation ledgers are solid, and the entry's interaction, takeaway and links are all built. One fix comes first: tapping the photon in the particle table throws a `RangeError` (`sci(…, 0)` calls `toFixed(-1)`). The second matters nearly as much. The decay checker's 21-mode subset is presented as "the PDG's list", so a real 1.76 % decay (K⁺ → π⁺π⁰π⁰) is reported as not being in it. After those come several overstated or historically wrong lines: the proton's size, Pauli's reasoning, the 1968 discovery of fractional charge, the claim that "every vertex" is matter emitting a carrier, and the range of weak-decay lifetimes.

## Factual errors
- **High**, steps.ts:129. "a proton is under a femtometre across": the proton's charge *radius* is 0.84 fm, so it is about 1.7 fm across. Fix: "…and a proton's radius is under a femtometre (10<sup>−15</sup> m)." Source: https://en.wikipedia.org/wiki/Proton_radius (0.84075(64) fm).
- **Medium**, steps.ts:302. "This is how Wolfgang Pauli guessed, in 1930…" follows a check on *neutron* decay that uses *electron number*. But the neutron was found in 1932, and lepton number was only proposed in 1953 (Konopinski and Mahmoud). Pauli's actual clues were the continuous electron energy spectrum and the wrong spin statistics of nuclei such as ¹⁴N. Fix: "Pauli faced the same kind of gap in 1930: beta-decay electrons came out with a spread of energies, as if some went missing, and nuclear spins didn't add up. He guessed that an unseen, neutral particle carried off the difference. It was detected 26 years later (electron number itself was only defined in 1953)." Sources: https://arxiv.org/pdf/0911.0058, https://www.nobelprize.org/uploads/2017/09/advanced-physicsprize2015.pdf
- **Medium**, steps.ts:167. "fractional charges… seen in 1968": the SLAC–MIT experiment showed point-like constituents. The fractional charges were confirmed in the early 1970s, by comparing electron scattering with neutrino scattering (Gargamelle). Fix: "…and the quarks themselves were first glimpsed in 1968, when electrons fired at protons at SLAC bounced off hard, point-like parts inside; comparing that with neutrino scattering at CERN in the early 1970s confirmed their ⅔ and ⅓ charges." Sources: https://www.nobelprize.org/uploads/2018/06/kendall-lecture-1.pdf, https://cerncourier.com/a/neutrinos-and-nucleons/
- **Medium**, steps.ts:283. "Every process in the Standard Model is made of the same kind of vertex: a matter particle emits or absorbs a force carrier." This is false. There are carrier-only vertices (three- and four-gluon, WWγ, WWZ) and Higgs vertices, and gluon self-coupling is central to confinement, which the page teaches. Fix: "Every process here is built from the same kind of vertex… (The Standard Model also has vertices where carriers meet each other, such as three gluons, possible because gluons carry colour.)"
- **Medium**, steps.ts:268. "through the weak force, anything from a tenth of a nanosecond to a quarter of an hour": this holds only for the particles in the chart. The τ lepton (2.9 × 10⁻¹³ s), B mesons (~1.5 × 10⁻¹² s) and the top (5 × 10⁻²⁵ s, as the step's own note says) also decay weakly. Fix: "…through the weak force, for the particles shown, from a tenth of a nanosecond to a quarter of an hour."
- **Medium**, steps.ts:269. The step blames slow weak decays only on the W's reach. The thousand-billion-fold spread *within* weak decays (the muon at 2.2 μs, the neutron at 15 min) comes mainly from the energy released (rate ∝ Q⁵, Sargent's rule). Add: "And the less energy a decay releases, the slower it goes (roughly as the fifth power): the muon has 105 MeV to spend and lives 2.2 μs; the neutron has 0.78 MeV and lives 15 minutes." Source: https://www.hep.phy.cam.ac.uk/~chpotter/particleandnuclearphysics/Lecture_15_NuclearDecay.pdf
- **Low**, steps.ts:143. "confirmed by every experiment since" sits awkwardly with neutrino mass (1998), which the summary note lists as missing from the model. Fix: "…confirmed by almost every experiment since, including the 2012 discovery of the Higgs boson (neutrino masses are the clear exception)."
- **Low**, steps.ts:145. "only the first [generation] lasts": the second- and third-generation neutrinos are stable too. Fix: "the heavier quarks and charged leptons decay within a fraction of a second, so ordinary matter is made of the first generation."
- **Low**, steps.ts:272. The Σ⁰ lifetime is a PDG mean life in the data (no `fromWidth` flag), not one derived from a width. Fix: "for the Δ and φ they come from the measured width Γ…"
- **Low**, steps.ts:318. "p → e⁺ π⁰ would break baryon number": the checker also crosses electron number (the test expects `['baryon','electron']`). Fix: "would break baryon number (and electron number)".
- **Low**, steps.ts:324. "only the total lepton number is believed to be conserved" overstates the consensus, since searches for neutrinoless double-beta decay are testing whether total lepton number breaks too. Fix: "…so only the total lepton number might be exactly conserved, and experiments are testing even that."
- **Low**, ZoomScene.svelte:172. "each step is 10 to 10,000 times smaller": atom to nucleus is 10⁴ to 10⁵ (hydrogen ≈ 60,000), and the drawn carbon-12 nucleus is only about 3× the proton. Fix: "each step is from a few to 100,000 times smaller".

Everything else checks out: the 61 count, 1 MeV ≈ 1.8 × 10⁻³⁰ kg, KATRIN 0.45 eV, ZEUS 0.43 × 10⁻¹⁸ m, Super-K 2.4 × 10³⁴ yr and 50,000 t, MEG II 1.5 × 10⁻¹³, π⁰ → 3γ < 3.1 × 10⁻⁸, K_S/K_L, the 0.782 MeV Q-value, the W at 86 proton masses, the 2.5 × 10⁻¹⁸ m reach, and the 1 %/17 %/89 % shares.

## Model issues
- **High**, TableScene.svelte:113. `sci((p.mass?.v ?? 0) * 1e6, 0)` makes `sci()` call `m.toFixed(digits - 1)` = `toFixed(-1)`, which throws `RangeError: toFixed() digits argument must be between 0 and 100` (checked in Node). Tapping the photon breaks the card. Fix: use `sci(…, 1)`, which gives "1 × 10⁻¹⁸". Also guard in particles.ts:757: `m.toFixed(Math.max(0, digits - 1))`. Add a test that `sci(1e-18, 0)` returns without throwing.
- **High**, DecayScene.svelte:138–143 and pdg.ts:885. `modes` is a 21-mode subset, but any allowed build that isn't in it is labelled "Not in the PDG's list of this particle's decays: rare, if it happens, or blocked by a rule not checked here." Real decays get this label:
  - K⁺ → π⁺π⁰π⁰, (1.760 ± 0.023) %, larger than modes that are included
  - n → p e⁻ ν̄e γ (~0.9 %)
  - π⁰ → e⁺e⁻e⁺e⁻ (3.3 × 10⁻⁵)
  
  Fix: add at least K⁺ → π⁺π⁰π⁰ to the build script's mode list, and reword the fallback to "Not among the decays listed here (a selection from the PDG): it may be rare, or blocked by a rule not checked here." Add a test that each parent's observed fractions sum to ≥ 0.99; the K⁺ modes currently sum to 0.982, so this test would have caught it. Source: https://pdg.lbl.gov/2018/listings/rpp2018-list-K-plus-minus.pdf
- **Low**, ProcessScene.svelte:202–210. For the pion, "this decay has 33.9 MeV to spend" compares the W with the leptons' kinetic energy. But the whole pion (139.6 MeV) annihilates into the virtual W. Fix: for `pion` use `decayParticle('pi+').mass`, and change the caption to "the most energy the W can carry".
- The model's other parts check out: hadron lookup (every established ground-state combination of u, d, s, c, b is covered), colour and baryon-number rules, ledgers, and ħ/ħc constants.

## Narrative and scene mismatches
- **Low**, steps.ts:165. The text quotes the Δ⁺⁺ lifetime, but at this step (`focus: 'charge'`) the lifetime readout has opacity 0 (BuilderScene.svelte:499), so the reader can't see it on stage. Either accept that, or let the `life` readout show at `focus === 'charge'`.
- **Low**, TableScene.svelte:362–366. For neutrinos the card says "antiparticle: opposite charge", but neutrinos have none. Fix: for `nu*` keys show "antiparticle: the antineutrino (opposite lepton number)". The gluon's "its own antiparticle" is only true of the set of eight (red–antigreen ↔ green–antired). Consider "the eight gluons are each other's antiparticles".
- Otherwise the scene readouts match the narrative numbers (1.0 %, 17 %, 89 %, 2.5 × 10⁻¹⁸ m, 100,000×, 0.782 MeV, the ledger totals).

## Catalogue requirements
All met. Quarks combine under enforced charge and colour rules. Beta decay and the other processes step through as carrier exchanges. The 17-particle table can be browsed. The takeaway is shown on stage ("Everything you have ever touched…", "Three of the four forces come from exchanging particles"). The links to atoms-periodic-table, quantum-mechanics and radioactivity are present.

## Clarity
- **Medium**, steps.ts:258. "electron number" is used in the beta step before it is defined (its definition sits in the conserve step's notes). Add a `<dfn>` at first use: "electron number (+1 for an electron or electron neutrino, −1 for their antiparticles)".
- **Low**, steps.ts:242. "virtual" is defined only in the photon step's Go-deeper note, yet the diagram labels say "W⁻ (virtual)" from the beta step on. Move the `virtual` dfn into the photon step's body.
- **Low**, steps.ts:179. "the bag turns red" on a page where red is a colour charge. Fix: "the bag's outline turns into a red warning dash".
- **Low**, steps.ts:269. ħ appears without a gloss. Add "(ħ is Planck's constant divided by 2π)".

## Sources consulted
- https://en.wikipedia.org/wiki/Proton_radius
- https://www.researchgate.net/publication/301278633_Limits_on_the_effective_quark_radius_from_inclusive_ep_scattering_at_HERA (ZEUS 2016)
- https://arxiv.org/abs/2504.15711 (MEG II, B < 1.5 × 10⁻¹³)
- https://www.researchgate.net/publication/347852417 (Super-K, τ/B(p → e⁺π⁰) > 2.4 × 10³⁴ yr); http://hep.bu.edu/~superk/about.html (50,000 t)
- https://www.eurekalert.org/news-releases/1079556 (KATRIN 0.45 eV)
- https://pdg.lbl.gov/2018/listings/rpp2018-list-K-plus-minus.pdf (K⁺ → π⁺π⁰π⁰ 1.760 %)
- https://www.nobelprize.org/uploads/2018/06/kendall-lecture-1.pdf; https://cerncourier.com/a/neutrinos-and-nucleons/ (1968 DIS, later charge confirmation)
- https://arxiv.org/pdf/0911.0058; https://www.nobelprize.org/uploads/2017/09/advanced-physicsprize2015.pdf (Pauli 1930; lepton number 1953)
- https://www.hep.phy.cam.ac.uk/~chpotter/particleandnuclearphysics/Lecture_15_NuclearDecay.pdf (Sargent's rule)
- I couldn't access the PDG 2026 database file itself. I spot-checked the masses and lifetimes against published PDG values and recent results, and they agree within normal edition-to-edition updates.
