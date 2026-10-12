<!-- batch msgbatch_01YMk1ioZ9GYz6mtQ3M1u6qt, claude-opus-5-5, submitted 2026-10-12T02:18:49.249Z, ~$0.39 in tokens + 5 web searches -->
# Review: cpu

## Verdict
The page is ready after the small fixes below. I re-derived every number the narrative quotes from the model: the encoding 65 = 0100 00 01, the addresses 4→6, 10, 12, 16, 17 and 18, 44 instructions and 132 ticks, 55, 253, 276→20 and 23 − 42 → 237. All of them are correct, and the tests check them. The Intel clock figures, the EDVAC date and the SAP-1 attribution are also correct. No fix is urgent. The most useful one is to state on the page that this machine fetches a two-byte instruction in a single tick. The catalogue asks for every simplification to be stated, and a real 8-bit data bus would need two trips.

## Factual errors
- **low**, steps.ts:101 (the `dfn` for ALU): it defines the arithmetic *logic* unit as a circuit that "adds, subtracts and compares", which leaves out the logic operations that give it its name. A reader who has just come from logic-gates will notice. Fix: `data-def="Arithmetic logic unit: the circuit that does arithmetic (add, subtract) and logic operations (AND, OR, NOT) on bytes, and compares them. It is built from gates like the adders made of logic gates."` If you like, add to the body: "This one only adds and subtracts."
- Everything else checks out: the i9-14900K's 6 GHz maximum turbo, 3.2 GHz performance-core base, 24 cores and Q4 2023 launch; the EDVAC report of 1945; SAP-1 and Malvino; the Little Man Computer; and an ideal 3-stage pipeline finishing one instruction per tick (ARM7TDMI is a real fetch/decode/execute example).

## Model issues
- **low**, cpu.ts:162, 180, 226: `labels` is a plain `{}`, so names inherited from `Object.prototype` count as already defined. The label `constructor:` (or `__proto__:`) is rejected with "defined twice". Worse, `JMP constructor` with no such label silently assembles to `JMP 0`, because `labels['constructor']` is a function and `fn & 255` is 0. Fix: `const labels: Record<string, number> = Object.create(null);`, or use `Object.hasOwn(labels, key)` in both the duplicate check and `value()`.
- **low**, cpu.ts:209–211: `DATA [5]` gives the error "LDI takes a number, not an address", but the line is a DATA line. Fix: pass the word to `value()`, or use the neutral message `` `Expected a number, not an address: ${q(text)}` ``.
- **low**, cpu.ts:225–229: `LDI R0, R1` reports `Unknown label "R1"`. Fix: before the label lookup, add `if (/^r[0-3]$/i.test(bare)) { errors.push({ line, message: `${q(bare)} is a register; this needs a number or an address` }); return null; }`.
- The rest of the model is sound. Arithmetic wraps modulo 256. C means a borrow on SUB, which is the x86 convention. The PC advances during fetch, and a jump overwrites it. Self-modifying code behaves as it would on a von Neumann machine. Endless loops, unknown opcodes and stray addresses all stop cleanly. The tests check real computed results and the order of the cycle.

## Narrative and scene mismatches
- **medium**, steps.ts:115 and MachineScene.svelte:242–249: one fetch tick moves both instruction bytes ("65 0") across the data bus as one token. On an 8-bit machine with one-byte memory boxes, that takes two memory reads; SAP-style machines spend several clock states on a fetch. The page doesn't say this anywhere, which goes against the catalogue's rule to state simplifications. Fix: add at the end of the second paragraph of the fetch step: "(To keep things simple, this machine fetches both bytes in one tick; a real 8-bit processor would make two trips to memory.)"
- **low**, steps.ts:232 and PipelineScene.svelte:153: "This page's processor manages a few ticks a second". The Clock speed slider goes up to 60 ticks/s. Fix: "This page's processor runs at 1 to 60 ticks a second, so you can follow it."
- Everything else matches: the focus loops are on phases 6, 7 and 8 (ADD R0, R1); the flags really are off after 7 + 5; the PC goes 12 → 4 in the countdown; the pipeline timetable is right (6 instructions in 18 ticks serial, 8 pipelined).

## Catalogue requirements
- All met. The reader can write or load a program and single-step it, with the PC, registers, ALU and memory highlighted. It runs at speed, and the examples include a loop (countdown, sum, multiply) and a conditional jump (max). The takeaway shows in both scenes: the cycle highlight in the machine and the 6 GHz panel in the pipeline scene. There is no pitfall or Needs field to check.

## Clarity
- **low**, steps.ts:198: the note says wrapping round "is the same overflow as in 8-bit binary addition", then lists an "overflow" flag as one of the *other* flags of real processors. On real chips the overflow flag reports signed overflow, which is a different thing from the unsigned wrap that C reports. Fix: "Real processors have more flags (negative; overflow, which flags wrap-round for *signed* numbers the way C does for unsigned ones…) and many conditional jumps, but…"
- **low**, steps.ts:169, 216 and cpu.ts:68: "if the last result was 0" leaves it unclear that LDI and LOAD don't touch the flags. In the editor, a reader who writes `LDI R0, 0` then `JZ x` will expect a jump that doesn't happen. Fix in the editor list: `<code>JMP a</code>, <code>JZ a</code>, <code>JC a</code>: jump always, if zero, if carry (the flags are set only by ADD and SUB)`.
- **low**, steps.ts:70 and MachineScene.svelte:63–70: picking the example that is already selected does nothing, because the effect only fires when the value changes. So after editing, a reader can't reset to that example the way the help text ("replaces the text in the editor") suggests. Fix: reload whenever the select fires, or add a "Reset to example" action.

## Sources consulted
- Intel's specification page for the Core i9-14900K (maximum turbo 6 GHz, base 3.2 GHz, 24 cores, launched Q4 2023): https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz/specifications.html
- Launch date of 17 October 2023: https://www.wepc.com/cpu/intel-core-i9-14900k-specs/
- First Draft of a Report on the EDVAC (von Neumann, distributed 30 June 1945): https://en.wikipedia.org/wiki/First_Draft_of_a_Report_on_the_EDVAC and https://cs.carleton.edu/faculty/jondich/courses/cs208_s19/assignments/16_files/edvac.pdf
- ARM7TDMI three-stage fetch/decode/execute pipeline: https://developer.arm.com/documentation/ddi0210/latest/Introduction/About-the-ARM7TDMI-core/The-instruction-pipeline
- Carry flag (unsigned, borrow on subtraction) versus overflow flag (signed): https://en.wikipedia.org/wiki/Carry_flag and https://upload.wikimedia.org/wikiversity/en/8/86/Overflow.20230915.pdf
