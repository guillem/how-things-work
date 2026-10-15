<!-- batch msgbatch_01VVhXoUFHo5aTQSaKUvPjiM, claude-opus-5-5, submitted 2026-10-15T04:42:15.922Z, ~$0.76 in tokens + 11 web searches -->
# Review: turing-machines

## Verdict
The page is ready once the fixes below are made. I re-ran the machines myself and most of the numbers check out: the increment's 8 steps, the palindrome formula for every palindrome up to length 10 (odd lengths too), S(2)/S(3)/S(4) with their 1s counts, the Σ(3) machine (14 steps, 6 ones), the TSP counts and the brute-force and Held–Karp times. The most important fix is a factual one in the universal-machine notes: the (6, 4) universal machine is by Neary and Woods, not Rogozhin. Close behind it, the busy-beaver step jumps from "S is not computable" to "S grows faster than any computable function" without justifying the second claim. There are also two medium mismatches: the page says its simulator reproduces BB(5)'s totals, but it never runs it; and "every programming language" is too broad.

## Factual errors
- **medium**: steps.ts:244 (notes on `universal`). Rogozhin (1996) gave (24,2), (10,3), (7,4), (5,5), (4,6), (3,10) and (2,18). The (6,4) machine is from Turlough Neary and Damien Woods (2007/2009), whose set was (5,5), (6,4), (9,3) and (15,2). "Hundreds of steps per simulated step" also misdescribes the smallest machines: the classic tag-system ones are exponentially slow. Fix: "Marvin Minsky found one with 7 states and 4 symbols in 1962; Yurii Rogozhin (1996) gave others with (states, symbols) of (4, 6), (5, 5) and (7, 4), and Turlough Neary and Damien Woods (2009) one with (6, 4). A real universal machine marks cells as it goes and needs many of its own steps per simulated step (for the smallest ones, far more as M's tape grows)." Sources: https://mathworld.wolfram.com/UniversalTuringMachine.html, https://doi.org/10.3233/FI-2009-0036, https://tilde.ini.uzh.ch/users/tneary/public_html/NearyWoods-MCU-07.pdf
- **medium**: steps.ts:310. If S were computable, blank-tape halting would be decidable. That only proves S is *not computable*. Saying it "grows faster than any computable function" is a stronger result (Radó's), and it doesn't follow from that one sentence. The reader also hasn't been told that blank-tape halting is undecidable. Fix: "…if it hasn't halted by then, it never will. But halting on a blank tape is just as undecidable as halting in general, so S(<i>n</i>) cannot be computable. Radó proved more: S eventually outgrows every computable function."
- **medium**: steps.ts:254. "So do every programming language" is false as written. Total languages aren't Turing-complete, and that includes Coq's own language, which the page cites later. Fix: "So does every general-purpose programming language, every processor (given enough memory), and odd systems like…"
- **low**: steps.ts:359. Karp's 1972 list of 21 problems contains Hamiltonian circuit, not TSP. TSP's NP-completeness follows directly from it. Fix: "…is NP-complete: it contains the Hamiltonian-circuit problem, which Karp proved NP-complete in 1972." Source: https://arxiv.org/pdf/1605.05448
- **low**: steps.ts:291. Rice's theorem is about properties of the function a program computes. "Does it ever print 7" is a property of its behaviour along the way (it is undecidable, but by reduction, not by Rice). Fix: "(does it output 7 on some input? does it compute the same function as this other program?)".
- **low**: UniversalScene.svelte:123. "λ-calculus · Church, 1936": Church introduced the λ-calculus in 1932–33; 1936 is when he used it to define computability. Fix: `who: 'Church, 1932–36'`, or keep 1936 and rename the box "λ-definability".

## Model issues
- **low**: e2e/turing-machines-model.e2e.ts:125–127. The "a verdict the decider gives is the truth" check just calls `decide` again; nothing tests it against reality. Fix: check each cell of `haltingTable()` against the plain simulator, e.g. `expect(run(ms[i], t.codes[j], 100_000).stop).toBe(t.cells[i][j] === 'halts' ? 'halt' : 'limit')`.
- The simulator, the encoder, the parser, `runFast`, the brute force and the greedy tour are otherwise correct. I checked `decide`'s runaway rule by hand and it is sound (beyond everything written, moving outwards on blanks, a repeated state means the machine runs forever).

## Narrative and scene mismatches
- **medium**: steps.ts:321. The text says "Run to the end, the simulator behind this page reproduces both numbers in a fraction of a second", but BeaverScene shows "47,176,870" and "4,098" as fixed text (lines 147, 153). `runFast` is only called in the tests. Two ways to fix it:
  - run `runFast(fromStandard(BEAVERS[5]), 5e7)` once in the `five` scene (in a worker or idle callback) and show its result; or
  - reword: "Run to the end (as this page's tests do), the same simulator reproduces both numbers in a fraction of a second."
- **low**: steps.ts:202. "The highlighted row of the table is the rule being applied." The highlight is one cell (state row × symbol column). Fix: "The highlighted cell of the table is the rule being applied."
- **low**: steps.ts:357. "Held–Karp … doubles its work with every city added": n² 2ⁿ grows by 2(n+1)²/n², about ×2.16 at 25 cities. Fix: "a little more than doubles its work with every city added".
- **low**: TspScene.svelte:64. `at < Math.max(1, tried)` shows a "shortest so far" length (and the green tour) while "Tried so far" still reads 0. Fix: `if (search.records[i].at < tried) r = i;`.

## Catalogue requirements
Everything checks out. All the pieces are built: the rule-table machine with add one and the palindrome check, an editor, the halting walk-through, and a TSP whose city count can be raised. The takeaway is visible in the universal, halting and growth scenes, and the prerequisite (sorting) and related topic (cpu) are linked.

## Clarity
- **low**: steps.ts:285–286 and HaltingScene.svelte:118–131. Move 2 has H answer "yes"/"no", but move 3 and the scene use "halts"/"runs forever". Fix (steps.ts:285): "…it always halts, answering “halts” if <i>M</i> halts on <i>x</i> and “runs forever” if it doesn't."
- **low**: steps.ts:269. "Configuration" is used without being defined. Fix: "the same configuration (state, tape and head position) seen twice".

## Sources consulted
- https://arxiv.org/pdf/2509.12337 (bbchallenge, "Determination of the fifth Busy Beaver value": S(5), Σ(5) = 4,098, 181,385,789 machines in Coq-BB5)
- https://bbchallenge.org/ (announced 2 July 2024; BB(6) > 2↑↑↑5, mxdys 2025)
- https://wiki.bbchallenge.org/wiki/Antihydra and https://wiki.bbchallenge.org/wiki/BB(6)
- https://www.quantamagazine.org/amateur-mathematicians-find-fifth-busy-beaver-turing-machine-20240702/
- https://mathworld.wolfram.com/UniversalTuringMachine.html (Rogozhin's 1996 list)
- https://doi.org/10.3233/FI-2009-0036 and https://tilde.ini.uzh.ch/users/tneary/public_html/NearyWoods-MCU-07.pdf (Neary & Woods; Minsky 1962)
- https://arxiv.org/pdf/1605.05448 (Karp 1972: Hamiltonian circuit, and TSP's hardness from it)
- My own re-runs of the page's machines and arithmetic: increment, palindrome (all palindromes up to length 10), BB2–4, Σ(3), tour counts and times.
