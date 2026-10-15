# Content and data licences

This repository holds three kinds of material, under different terms.

## 1. Code — MIT

Everything that is software (Svelte components, TypeScript models, scripts, tests, styles) is
under the MIT licence in [`LICENSE`](LICENSE).

## 2. Original explanatory content — CC BY 4.0

The original text and illustrations of the explainers — the narratives in `src/routes/*/steps.ts`,
the drawings the scenes produce, the catalogue in `docs/TOPICS.md` and the other documentation —
are licensed under the
[Creative Commons Attribution 4.0 International licence (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
Credit: "How Things Work, by Guillem Cantallops Ramis, https://guillem.github.io/how-things-work/".

## 3. Third-party data — their own licences

Datasets, structures, images and model weights or outputs from other people keep the terms their
owners set; neither licence above relicenses them. Every one is listed, with its source, licence
and status, in [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md), and named in the header of the file
that holds it and in the page that uses it.

Note in particular:

- **Non-commercial terms.** A few sources allow only non-commercial use (Red Eléctrica's data in
  power-grid, the LibreTexts potentials in redox-batteries, Giunta's Bodenstein transcription in
  reaction-rates-equilibrium). The site is non-commercial; anyone reusing those files must keep
  them non-commercial too, or replace them.
- **Share-alike terms.** Files derived from CC BY-SA sources (the Gaia sample and the element-origin
  shares in stars) stay under CC BY-SA.
- **Unconfirmed licences.** Some sources state no licence; they are marked "Unconfirmed" in
  `docs/DATA-SOURCES.md` and used for education with full attribution.
