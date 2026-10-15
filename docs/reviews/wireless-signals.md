# Review: wireless-signals

## Verdict
Ready after the fixes below. Almost every number the page quotes was recomputed from the model in Node and matches (QPSK BER cliff, QAM thresholds, Friis/kTB figures, channel-width capacities, AM/FM/PSK occupied bandwidths, the 390 Mbit/s Wi-Fi rate). The most important fix is the Shannon step: the Wi-Fi 5 marker sits exactly on Shannon's curve, so the graphic says Wi-Fi reaches the limit, contradicting "every scheme on this page sits to its right"; its 256-QAM 5/6 tones carry 6.7 bits each, which Shannon alone allows only from about 20 dB.

## Factual errors
- **high** — steps.ts:333 and LimitScene.svelte:14: "Wi-Fi 5's fastest single-stream mode sends 390 Mbit/s in 80 MHz". 390 Mbit/s is VHT MCS 9 with the normal 800 ns guard interval; the same mode with the short guard interval is 433.3 Mbit/s, and 160 MHz doubles it. Fix: "Wi-Fi 5's 256-QAM mode with a 5/6 code sends 390 Mbit/s in 80 MHz (one stream, normal guard interval)". Source: IEEE 802.11ac VHT MCS table, e.g. https://en.wikipedia.org/wiki/IEEE_802.11ac-2013#Data_rates_and_speed (the model's own `wifiRate(80, 8, 5/6, true)` = 433.3).
- **medium** — steps.ts:178: "stations are spaced 200 kHz apart" holds for the Americas (FCC 200 kHz channels); Europe and most of ITU Region 1 use a 100 kHz raster. Also the 180 kHz Carson figure holds only for mono audio (stereo's multiplex reaches 53 kHz, ≈256 kHz). Fix: "FM broadcasting swings ±75 kHz with mono audio up to 15 kHz, so a station needs about 180 kHz (stereo needs more); the Americas put stations on a 200 kHz grid, Europe on a 100 kHz grid with nearby stations kept further apart." Source: https://en.wikipedia.org/wiki/FM_broadcast_band
- Builder's flags checked: AM 9 kHz (ITU Regions 1 and 3) / 10 kHz (Region 2) is correct; FM ±75 kHz deviation and 15 kHz audio correct. ETSI EN 300 328 V2.2.2 §4.3.2.2.3 confirmed from the PDF: "The RF output power for non-FHSS equipment shall be equal to or less than 20 dBm."

## Model issues
- No errors in the model: erfc fit, Cho–Yoon BER, Friis, kTB, Welch spectra, 99% occupied bandwidth and the OFDM rate formula all check out. The tests check real-world properties (Q-function values, BER vs theory, Carson, Friis, 802.11 rate tables, the −1.59 dB Shannon floor).
- **low** — e2e/wireless-signals-model.e2e.ts:197: the test pins "allowed by Shannon from 14.5 dB" but nothing guards that the Wi-Fi mode cannot actually work there. Fix: add an assertion that its 6.7 coded bits per tone need ≥ 20 dB.

## Narrative and scene mismatches
- **high** — LimitScene.svelte:90–107 and steps.ts:333: the Wi-Fi dot is drawn at (14.5 dB, 4.9) on the curve and labelled "Wi-Fi 5 with its error-correcting code", implying the code reaches capacity; the narrative's "close most of the gap" ties to that point. 4.9 bit/s/Hz is net of guard interval and unused subcarriers, which lower bits per hertz but not the SNR each tone needs: 6.67 bits per tone needs log₂⁻¹ → 20.0 dB by Shannon alone. Fix: draw the Wi-Fi point at the 20 dB floor, with a dashed line back to the curve at 14.5 dB, and label it "needs at least 20 dB"; rewrite the sentence to say codes close much of the gap but overhead (guard interval, pilots) and the code leave Wi-Fi well right of the curve.
- **medium** — steps.ts:206: "it takes twice the bandwidth to send twice as many symbols per second", but the step offers FSK, whose 99% width only goes from 3.3 to 4.2 MHz when the rate doubles. Fix: limit the claim to amplitude and phase keying and note that FSK's width is set mostly by the gap between its tones.
- Everything else matches: QPSK 1 in 18 / 1 in 1,280 / 2.7 × 10⁻⁷; 16-QAM 2.9 × 10⁻⁶ and 64-QAM 8.5 × 10⁻³ at 20 dB; 1e-3 thresholds 6.79/9.80/16.54/22.55/28.41 dB; 96 → 337 Mbit/s, wideband 764 Mbit/s; 18 → 1.1 MHz; AM 1.03 MHz, FM 4.0 MHz.

## Catalogue requirements
- Interaction built as written (ASK/FSK/PSK on waveform, spectrum and constellation; noise, distance, a second transmitter; denser constellations). Takeaway shown in the Shannon step. Fine.

## Clarity
- Clear for level 2. No issues.

## Sources consulted
- https://en.wikipedia.org/wiki/IEEE_802.11ac-2013 (VHT MCS rates)
- https://en.wikipedia.org/wiki/FM_broadcast_band
- https://www.etsi.org/deliver/etsi_en/300300_300399/300328/02.02.02_60/en_300328v020202p.pdf (§4.3.2.2.3)
- S.-Y. Chung et al., "On the design of low-density parity-check codes within 0.0045 dB of the Shannon limit", IEEE Commun. Lett. 5 (2), 2001.
