<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.29 in tokens + 4 web searches -->
# Review: logic-gates

## Verdict
The page is ready after the fixes below. The facts, the evaluator and the adder circuits are correct, and the tests check real truth tables, including every pair of 4-bit numbers. The most important fix is in the catalogue requirements. The entry asks for **guided challenges** that build a half adder, a full adder and a 4-bit adder. Only the half adder can be built. The full adder and the 4-bit adder are shown, not built. The build canvas also can't add switches or lamps, so the reader can't build a 3-input full adder at all. The second fix is the closing NAND claim: the reader can't test it because NAND isn't in the palette.

## Factual errors
None found. I checked these claims and they are correct:
- the gate rules;
- the half-adder and full-adder construction ("five gates");
- the ripple-carry behaviour, and processors using faster carry schemes;
- NAND being enough to build every gate;
- "a handful of transistors" per gate (a CMOS AND gate uses 6).

## Model issues
- **low**: logic.ts:62–65, 88. An unwired gate input counts as 0, and the page never says so. Real logic inputs must not be left unconnected. This is visible in practice: a lone NOT gate wired to a lamp lights it with nothing on its input. Fix: add to the build step's `notes` (steps.ts:138): `<p>Here an input with no wire counts as 0. In a real chip every input has to be connected to something.</p>`
- **low**: CanvasScene.svelte:175–181. Every gate has the same delay, and each node jumps straight from its old final value to its new one. Real outputs can flicker briefly (a glitch) before settling, and real delays are picoseconds. That simplification is fine but should be stated, as the catalogue requires. Fix: add to the half step (steps.ts:103) `notes: '<p>The animation is slowed right down: a real gate switches in a few trillionths of a second. Each gate here takes the same time, and outputs jump straight to their final value; in real circuits they can flicker briefly before settling.</p>'`
- **low**: e2e/logic-model.e2e.ts. The page claims that NAND alone is enough, but no test backs it, and `ripple4` is never tested with `carryIn = true`. Fix: add a test that builds NOT (`NAND(a,a)`), AND (`NAND(NAND(a,b), NAND(a,b))`) and OR (`NAND(NAND(a,a), NAND(b,b))`) as `Circuit`s and compares their `truthTable` with `singleGate`. Also add `expect(ripple4(a, b, true).value).toBe(a + b + 1)` inside the exhaustive loop.

## Narrative and scene mismatches
- **low**: CanvasScene.svelte:938–953 and 955–966. While signals are still propagating, the inputs (`val('a')`, `val('b')`) update at once but the carry and sum keep their old values. For a moment the half adder reads, for example, "1 + 1 = 01 in binary" and "carry 0, sum 1: 2 in decimal". These readouts are dimmed but still wrong arithmetic. Fix: show the result only once the circuit has settled. Replace the result parts with `settled ? `${val('c')}${val('s')}` : '…'` and `settled ? `${val('a') + val('b')} in decimal` : 'adding…'`. Do the same for the full-adder lines.
- **low**: RippleScene.svelte:269. "column ${active + 1} of 4 is adding" doesn't say which end column 1 is. Fix: `` `The carry ripples right to left: bit ${active + 1} of 4 (counting from the right) is adding.` ``
- **low**: steps.ts:52, 61. The sliders are labelled "First number" and "Second number", but the scene calls the numbers A and B. Fix: `label: 'First number (A)'` and `label: 'Second number (B)'`.

## Catalogue requirements
- **high**: steps.ts:31–40 and CanvasScene.svelte:76–94, 290–295. The Interaction asks for "Guided challenges [that] build a half adder, a full adder and a 4-bit adder". Only `half` exists. The full adder is a finished demo, and the 4-bit adder is a slider demo. The canvas can't add inputs or outputs, so a 3-input circuit can't be built. Fix:
  - Add `{ value: 'full', label: 'Build a full adder' }` to `challenge`.
  - Add a `FULL_BLANK` with switches A, B and "Carry in" and lamps "Sum" and "Carry out". Extend `fits` to match `'Sum,Carry out'`.
  - Compute the target from the reference circuit instead of hard-coding it: `const TARGET = $derived(truthTable(challenge === 'full' ? FULL_ADDER : HALF_ADDER).rows.map((r) => r.outputs));`. Remove the `rows.length === 4` check (the full adder has 8 rows).
  - Widen `challenge` (line 72) to cover `'full'`, and make the target columns (line 306) and the "✓ Right" message (line 986) depend on the challenge.
  - For the 4-bit adder, either add a guided task on the ripple step (the reader connects each carry out to the next carry in, and the sum is wrong until all three links are made), or ask the catalogue owner to change the entry to say the 4-bit adder is shown, not built.
- **medium**: steps.ts:16–29 and 137. The takeaway's support, "every gate here can be made from NAND gates alone", can't be seen or tried in the graphic. The model supports NAND (logic.ts:12, 50, 155) and the scene draws it, but the palette leaves it out. Fix: add `{ value: 'NAND', label: 'NAND gate' }` to `tool`, and change the sentence to: `In fact one kind is enough: every gate here can be made from NAND gates alone ("not AND"). Try it: wire both inputs of a NAND to A and you get NOT A.` Better still, add a "Make AND from NANDs only" challenge. Source: https://en.wikipedia.org/wiki/NAND_logic
- The other requirements are met: the reader wires gates, flips inputs, watches signals propagate, the truth table updates live, there are no `Needs`, and there is no Pitfall to check.

## Clarity
- **low**: steps.ts:112. "the second adds the carry in" leaves out what it adds the carry to. Fix: `The first adds A and B; the second adds the carry in to that sum; if either produced a carry, the OR passes it on.`
- **low**: RippleScene.svelte:267. The prerequisite (binary) teaches overflow, and this is the natural place to connect to it. Fix: `'Too big for 4 bits: the last carry becomes a fifth bit, worth 16. A 4-bit register would drop it: an overflow.'`

## Sources consulted
- NAND logic (functional completeness): https://en.wikipedia.org/wiki/NAND_logic
- CircuitVerse, universal gates: https://learn.circuitverse.org/docs/comb-ssi/universal-gates.html
- ScienceDirect, carry-lookahead adder (ripple-carry delay versus carry lookahead): https://www.sciencedirect.com/topics/computer-science/carry-lookahead-adder
- US patent 11949416, CMOS AND gate made from NAND plus inverter, 6 transistors: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11949416
