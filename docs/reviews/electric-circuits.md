<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.65 in tokens + 11 web searches -->
# Review: electric-circuits

## Verdict
The page is ready after the fixes below. The solver is correct: it applies Kirchhoff's current law at every peg (nodal analysis), the battery is modelled as a voltage with an internal resistance, and the tests check KCL, energy balance, Ohm's law, series, parallel and short circuits. The preset readings match the text (0.50 A, 0.25 A, 3 V, 1 A, 0.75 W). The catalogue's interaction, takeaway and pitfall are all covered. The most important fix is the "Go deeper" note on the series step. It says two real bulbs in series would glow *brighter* than shown. A cooler filament does draw more power than the fixed-resistance model predicts, but it gives off much less light. Real bulbs would look *dimmer* than the 25 % glow drawn.

## Factual errors
- **Low**, WireScene.svelte:324. "magnified about 10 million times" is too small. The ions are drawn 42 units apart, which is about 10 mm on a typical desktop stage. Copper's lattice constant: a = 361.50 pm (at 20 °C), so neighbouring atoms are about 0.18–0.26 nm apart. That puts the magnification at roughly 4–6 × 10⁷ (closer to 2 × 10⁷ on a phone). Fix: "magnified tens of millions of times". Source: https://en.wikipedia.org/wiki/Copper (moderate confidence: the exact figure depends on screen size).

Everything else checks out: the drift speed (0.037 mm/s at 0.5 A in 1 mm² copper, with n = 8.5 × 10²⁸ m⁻³), the coulomb (6.24 × 10¹⁸ electrons), 1 V = 1 J/C, Ohm's law stated as proportionality, the origin of the conventional-current direction, and the mains voltages.

## Model issues
- **Medium**, circuit.ts:9–10 and 40 (battery 0.02 Ω), not stated on the page. The catalogue requires simplifications to be stated on the page. Only the fixed-resistance bulb is. With r = 0.02 Ω, a short circuit reads about 300 A on the meters and tooltips. Real dry cells are far weaker: Energizer gives a typical IR: 150 to 300 milliohms (fresh) for one alkaline cell. Four in series (6 V) have about 0.6–1.2 Ω and short at roughly 5–10 A. The near-ideal battery also hides the voltage sag on the parallel step. Keep the value, so the preset readings stay clean, but add to the build step after the short-circuit sentence: *"(The batteries here are almost ideal, with only 0.02 Ω inside, so the meters show hundreds of amps. A real pack of dry cells has around an ohm inside and gives several amps, still enough to get hot.)"* Source: https://www.farnell.com/datasheets/1820687.pdf
- **Low**, circuit.ts:269–270. Brightness proportional to power is a further simplification that isn't stated. The series-note replacement above covers it.
- **Low**, circuit.ts:145. `parseBoard` accepts a non-numeric value (e.g. `B 0 1 x`), which gives NaN. A NaN resistance or voltage spreads through `solveLinear` and every readout shows NaN. Fix: `else if (value !== undefined) { const x = +value; if (!Number.isFinite(x)) return null; part.value = x; }`
- **Low**, e2e/circuit-model.e2e.ts:116–123. The short-circuit test places the wire (0,2)–(1,2) twice; the second `place` call is redundant. The build step asks readers to try two batteries in series and then opposed, but neither case is tested. Add a test that a bulb across two aiding batteries carries about 1 A, and across two opposed batteries carries 0 A. The Ohm test's `toBeCloseTo(V / R, 1)` is loose; use precision 2, as the other tests do.

## Narrative and scene mismatches
No problems found. Every number the text quotes matches what the solver computes and the scenes show. The switches, toggles, captions and readout cards behave as each step describes.

## Catalogue requirements
- The interaction, takeaway and pitfall are met: ammeters show the same current all round a loop, the readouts state "the bulb does not use up current", and there is a drift-speed race and a bicycle-chain inset. The two simplifications noted above still need to be stated on the page (definition of done, item 5).

## Clarity
- **Medium**, steps.ts:108 (loop step). The step says "The dots are moving electric charge", and the definition says that in wires the moving charges are electrons. But the dots move from + to −, and conventional current isn't explained until the "Go deeper" note two steps later. A high-school reader who knows electrons are negative will see a contradiction. The board's dots also move at about 60 px/s, which suggests fast charges before the drift step corrects that. Append: *"(The dots follow the direction circuit diagrams use, out of the battery's + end; the electrons in the wire actually drift the other way, and far more slowly — see "Slow charges, instant light".)"*
- **Low**, steps.ts:121. "the bulb turns that push into light and heat" mixes up force and energy, on the very point the pitfall is about. Replace with: "the battery gives the charges energy as it pushes them round the loop, and the bulb turns that energy into light and heat".
- **Low**, steps.ts:148. "electric potential" is used without a definition at Level 1. Wrap it: `<dfn data-def="How much energy each coulomb of charge has at a point in the circuit, measured from the battery's − end, in volts.">electric potential</dfn>`.

## Sources consulted
- https://www.edn.com/rich-voltage-poor-voltage-my-incandescent-tale-2/ (lamp exponents: light ∝ V^3.4, power ∝ V^1.6)
- https://www.farnell.com/datasheets/1820687.pdf (Energizer alkaline cell internal resistance)
- https://en.wikipedia.org/wiki/Copper (lattice constant)
- http://hyperphysics.phy-astr.gsu.edu/hbase/electric/miccur.html (drift velocity, v = I/(neA))
- https://phys.libretexts.org/Bookshelves/University_Physics/Book:_Introductory_Physics_-_Building_Models_to_Describe_Our_World_(Martin_Neary_Rinaldo_and_Woodman)/19:_Electric_Current/19.02:_Microscopic_model_of_current (current density and drift direction)
- https://hackaday.com/2017/07/17/conventional-current-vs-electron-current/ (Franklin's convention)
