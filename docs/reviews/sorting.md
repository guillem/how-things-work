<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.68 in tokens + 7 web searches -->
# Review: sorting

## Verdict
Ready after the fixes below. I ported `sorts.ts` to Node and ran it. It checks out: the algorithms are correct, the shuffle is unbiased (mean inversions at n = 400 were 39,920 against an expected 39,900), and almost every number the page quotes matches what the code produces. That includes 120 comparisons for 16 bars, 499,500 for every pair at 1,000, n − 1 on sorted rows, a gap of ×22 to ×57 at 1,000 items, and the claim that bubble sort comes within 1% of n(n − 1)/2. The most important fix is how the race scores merge sort. One merge "move" slides a whole block of bars but costs one tick. That convention, not the algorithm, is what decides who finishes ahead of quick sort, and the page never says so. Second: the "about 30% more" figure for quick sort is a little high, and "a few more" contradicts it.

## Factual errors
- **low**, steps.ts:150. The text says "on average a few more than merge sort (about 30% more at 1,000 bars)". For this Lomuto version the exact average is 2(n+1)H_n − 4n = 10,986 comparisons at n = 1,000. Merge sort averages 8,708 (I ran 200 shuffles), so quick sort does about 26% more. The page's own 3-shuffle sample gives 29%. "A few more" (about 2,300 extra) contradicts the percentage. Replace with: "on average about a quarter more comparisons than merge sort (roughly 11,000 against 8,700 at 1,000 bars)". Source: https://arxiv.org/pdf/2306.13065 (2(n+1)H_n − 4n), https://algs4.cs.princeton.edu/23quicksort/
- **low**, steps.ts:135. "One comparison per bar placed" overstates the cost: once one half runs out, the rest of the other half goes in with no comparisons. Use "at most one comparison per bar placed". Source: https://algs4.cs.princeton.edu/22mergesort/

The other claims hold: bubble's n(n − 1)/2, insertion's n²/4, merge's n log₂ n, the quick sort worst case on both sorted and reversed rows, the comparison-sort lower bound, and the library pivot strategies.

## Model issues
- **medium**, sorts.ts:132–140, RaceScene.svelte:6–16 and 413–419. In the race every comparison or move is one tick. But one merge "move" shifts up to half a section of bars at once, while a quick sort swap moves only two. On 40 shuffled bars (seed 1), merge sort finishes in 235 ticks and quick sort in 288. If merge's data movement were counted the way a real merge does it (each bar written once per level, 216 writes), merge would need about 375 and finish behind quick sort. Counting the bars actually shifted gives 467 for merge. So the finishing order between these two comes from the counting convention, and it also sits awkwardly with the claim at steps.ts:150 that quick sort is "often the fastest". Fix it in one of two ways:
  - Charge a move `r − k + 1` ticks, or one tick per bar placed by the merge.
  - Keep the rule and say so in the footer (line 416): `'Place = order of finishing: every comparison, swap or merge move takes one tick (a merge move slides a whole block of bars at once). The counters and the chart count comparisons only.'`
- **medium**, e2e/sorting-model.e2e.ts:49–52. The test says "about 1.39 n log2 n", but that is only the limiting constant. At n = 1,000 the lower-order term −2.85n matters, and the exact expectation is 1.1024·n log₂ n. The test checks `> 1.1` and the measured value is 1.105, so it passes only because these particular seeds happen to land there. Replace with an exact-formula check:
  ```ts
  let H = 0; for (let i = 1; i <= 1000; i++) H += 1 / i;
  const expected = 2 * 1001 * H - 4 * 1000; // Lomuto, n − 1 compares per partition
  expect(comparisonsFor('quick', 1000, 'shuffled', 10) / expected).toBeCloseTo(1, 1);
  ```
- **low**, GrowthScene.svelte:9–20. Two claims rest only on comments and are not tested: that `mergeComparisons` gives exactly the same comparisons as `run('merge')`, and that bubble sort is within 1% of n(n − 1)/2 from 500 items. I confirmed the second (0.9962 at 500, 0.9951 at 1,000, 0.9996 at 2,469). Add both to the e2e test, since the dashed estimate and the crossing point beyond 2,500 depend on them.
- **low**, GrowthScene.svelte:438. The machine chart treats running time as comparisons × 1 µs and ignores data movement. The footer states this (line 1001), and the takeaway holds either way. Still, consider "Time counted as comparisons: the ×1 computer makes a million per second" so readers don't take it as wall-clock time.

## Narrative and scene mismatches
- **low**, BarsScene.svelte:389–400 and 230–233, steps.ts:8. The timeline handle and the arrow keys step through raw recording entries, which include the `focus`/`done` bookkeeping. The readout counts only real work. So pressing → on a bookkeeping entry leaves "X of Y operations done" unchanged, even though the help text promises "one operation at a time". The race already skips bookkeeping; do the same here by mapping the handle to indices of real operations, as `RaceScene` does with `real[]`. Alternatively, change the help to "one step at a time".

Everything else matches: the quoted numbers, the step-by-step words for each algorithm, the race behaviour on sorted rows (bubble and insertion tie first, quick sort is last), the order notes, and the crossing at roughly 110 items for ×10 and 1,900 for ×100.

## Catalogue requirements
- **low**, GrowthScene.svelte (growth phase). The entry asks the reader to "grow the input and plot operations against size". The chart is a fixed sweep from 10 to 1,000 items, and it plots comparisons, not all operations. The sweep reasonably meets the intent. To make it explicit, change the subtitle to "Comparisons (the usual measure of sorting work) needed to sort n items".

The race with four algorithms, the stepping and playing at speed, the sorted and reversed inputs, and the machine chart that makes the takeaway visible are all built as the entry describes. There is no pitfall to avoid.

## Clarity
- **low**, steps.ts:161. The race body says only that the counters show comparisons. The medals, though, rank by total operations, and the two orders can differ. Add: "Places go by finishing time, where every comparison or move takes one tick."
- **low**, steps.ts:186. The page writes "n log₂ n" in the earlier steps but "O(n log n)" here, with no word on the missing base. Add "(in Big-O the base of the logarithm does not matter: it only changes a constant factor)".

## Sources consulted
- https://algs4.cs.princeton.edu/23quicksort/ (quicksort averages about 2N ln N ≈ 1.39 N lg N compares)
- https://arxiv.org/pdf/2306.13065 (exact average 2(n+1)H_n − 4n)
- https://algs4.cs.princeton.edu/22mergesort/ (mergesort between ½ N lg N and N lg N compares)
- https://www.isa-afp.org/entries/Comparison_Sort_Lower_Bound.html (lower bound log₂(n!) for comparison sorts)
- https://en.wikipedia.org/wiki/Comparison_sort
- https://www.cs.odu.edu/~zeil/cs361/sum24/Public/insertion/index.html (insertion sort average case)
- My own Node runs of `sorts.ts` (counts at 1,000 items, the race at 16 and 40 bars, the bubble-sort ratios, the crossing points)
