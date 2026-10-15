<!-- batch msgbatch_0172H7i3U1VbEghDdtw1y5JA, claude-opus-5-5, submitted 2026-10-15T04:42:15.103Z, ~$1.07 in tokens + 15 web searches -->
# Review: medical-imaging

## Verdict
The page is ready once the fixes below are made. The physics is sound. The NIST μ/ρ values match the tables, the HU values and dose figures check out, and so do the Shepp–Logan ellipses, the projection formula, the Ram–Lak filter, the ultrasound reflection and transmission, and the Larmor and gradient arithmetic. The catalogue interaction is built in full. I ran the model and it reproduces the numbers the page quotes: fat −86, muscle and heart +48 to +54, lung −607, nodule +58 HU, a cyst 55 HU below the liver, a 0.8 % change in the X-ray, and noise ×1.96 when the dose is quartered. **The most important fix is the first sentence about X-rays.** "Most of them pass straight through the body" is wrong, and the page's own readouts contradict it.

## Factual errors
- **High**, steps.ts:206. "Most of them pass straight through the body. A few hit an electron…" is the opposite of what happens. With the NIST soft-tissue value at 60 keV (μ/ρ = 0.2048 cm²/g, so μ ≈ 0.217/cm), 20 cm of tissue lets through e^−4.3 ≈ 1.3 %. The page's own model gives 0.3 % through the mediastinum (p = 5.8), about 7 % through a lung, and 27 % through the default 6 cm slab. Replace with: "Many are stopped on the way: they hit an electron and are absorbed or knocked aside, and are gone from the beam. Only a few percent of the photons get through a chest, and about 1 % through the belly, and those are the ones that make the picture." Source: https://physics.nist.gov/PhysRefData/XrayMassCoef/ComTab/tissue.html
- **Low**, imaging.ts:27 and :749. "CODATA 2018 … 42.577 478 461" is wrong: that is the 2022 value. CODATA 2018 gave 42.577 478 518. Change both comments to "CODATA 2022". For water, the relevant constant is the shielded proton value, 42.576 385 43 MHz/T. It still rounds to 42.58, so you could add "(protons in water: 42.576)" to steps.ts:363. Source: https://physics.nist.gov/cuu/pdf/JPCRD2022CODATA.pdf
- **Low**, steps.ts:145. "research scanners 7 T" is out of date: the FDA cleared the first 7 T scanner for clinical use in October 2017. Replace with "Hospital scanners: 1.5 T and 3 T, and a few at 7 T (cleared for clinical use since 2017)." Source: https://www.itnonline.com/content/fda-clears-first-7t-mri-system-magnetom-terra

## Model issues
- **Low**, imaging.ts:676 and UltrasoundScene.svelte:36. The deepest layer is labelled "bone (rib)", but it sits 12 cm deep under the liver, on a line from the front of the belly. The ribs at that depth are at the back, and a front-to-back line through the liver would end at the spine or kidney. Rename it to 'bone' in NAMES, or make the line an intercostal view whose rib lies just under the muscle.
- **Low**, CtScene.svelte:273–282. The "noise in the heart" readout measures total spread, which includes about 13 HU of reconstruction error that is there even without noise (180 views). So at 4× dose the readout shows 69 → 37 HU (×1.87) rather than ×2. Measure the noise against a noise-free reconstruction of the same sinogram, e.g. `sd(recon − reconstruct(scan(ph, K), true))`.
- **Low**, e2e/medical-imaging-model.e2e.ts:199–200. The test's title says "about 10 days", but it asserts ≈ 12 (0.1/3 × 365 = 12.2). Rename it to "about 12 days by the 3 mSv/yr rule (RadiologyInfo rounds to 10)".

Apart from these, the model implements the real equations with correct units, and the tests check real properties: equal shadow totals at every angle, 1/r blur, the 1/√dose rule, and the impedance ratios.

## Narrative and scene mismatches
- **Medium**, steps.ts:236. "From the side the two lungs overlap and the dip is deep" is backwards. In the model the front view has a 5.8 peak with lung dips down to 2.4. The side view ranges only from 4.8 to 6.5, because every side ray also crosses about 30 cm of tissue. Replace with: "from the side, every ray crosses the whole width of the body, so the shadow is tall all across and the lungs make only a shallow dip."
- **Medium**, steps.ts:263 (and the list at :222). "…the lungs, the heart and the spine appear": the heart cannot appear in the reconstruction. It is `soft` inside `soft` muscle, so `partDelta` = 0 and the probe reads the same as muscle (48 against 51 HU). Replace with "the lungs and the spine appear, with the heart as the band of soft tissue between the lungs". In notes or on the Hounsfield step, add that without contrast agent the heart and muscle have the same CT number.
- **Medium**, steps.ts:189 (summary). "see the same body with echoes of sound and with spinning protons" is not what the page shows. The ultrasound step uses a separate layer stack and the MRI steps use water tubes and tissue patches. Replace with "Then see how echoes of sound and spinning protons in a magnet make images without X-rays."
- **Low**, steps.ts:363 against MriScene.svelte:208. The note says "slowed down more than a million times" but the scene says "over 100 million". The real factor is 42.58 MHz/T ÷ 0.25 Hz/T ≈ 1.7 × 10⁸, so change the note to "more than 100 million times".
- **Low**, RadiographScene.svelte:127–128 and 358. The label "fluid: 0 HU, liver +54 HU" uses the model's μ values. The Hounsfield step stresses reading reconstructed values, which here are −2 and +53. Compute them from the image: `hounsfield(discMean(ctImg, BODY_FOV, cyst.x0, cyst.y0, 0.6), muW)`, and likewise for the liver at a point away from the cyst.

Everything else checks out: the numbers the text quotes, the readouts and the control behaviour.

## Catalogue requirements
- **Low**, steps.ts:194 and :337–391. Everything in the entry is built: the draggable source, the sinogram, the progressive reconstruction, the angles control, the filter toggle and the X-ray/CT comparison. The takeaway is visible in the graphic. The added "sound and magnets" chapter (four steps' worth of ultrasound and MRI) goes beyond an entry whose takeaway is only about CT. It is well done and the MRI part uses the Fourier prerequisite, but per "Question an entry…", ask the user whether to widen the catalogue entry's Interaction and Takeaway, or to mark the chapter as an extension.

## Clarity
- **Low**, steps.ts:223 and :319. "mSv" appears in the plain-X-ray notes and the dose body before it is defined in the dose notes (:320). Move the `<dfn>` for millisievert to its first use in the dose body.
- **Low**, steps.ts:347. "under 2% at fat and muscle" reads oddly. Change it to "under 2% where fat meets muscle, a third where tissue meets bone, and almost all of it at air".

## Sources consulted
- NIST XCOM / Hubbell & Seltzer, ICRU-44 tissue tables (soft tissue, adipose, lung): https://physics.nist.gov/PhysRefData/XrayMassCoef/ComTab/tissue.html, https://physics.nist.gov/PhysRefData/XrayMassCoef/ComTab/adipose.html, https://physics.nist.gov/PhysRefData/XrayMassCoef/ComTab/lung.html
- RadiologyInfo.org (ACR/RSNA), radiation dose from X-ray and CT: https://www.radiologyinfo.org/en/info/safety-xray. It confirms 0.1 mSv (10 days), CT brain 1.6, lung screening 1.5, chest 6.1, abdomen and pelvis 7.7, and 3 mSv/yr background.
- CODATA 2022 recommended values (NIST): https://physics.nist.gov/cuu/pdf/JPCRD2022CODATA.pdf
- FDA clearance of 7 T MRI (2017): https://www.itnonline.com/content/fda-clears-first-7t-mri-system-magnetom-terra
- Kak & Slaney, ch. 5 (number of views ≈ number of rays, which supports "as many directions as pixels across"): https://engineering.purdue.edu/~malcolm/pct/CTI_Ch05.pdf
- I also ran a JavaScript port of the model (scan, ramp filter, back-projection, radiograph, HU) to check the numbers quoted above.
