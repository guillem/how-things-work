<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.56 in tokens + 4 web searches -->
# Review: graph-search

## Verdict
The page is ready after the fixes below. I re-ran `search.ts` in Node and every number the narrative quotes is correct:
- **Marsh:** breadth-first search takes 15 steps at cost 39; Dijkstra and A* take 21 steps at cost 21.
- **A\* on the marsh:** 46 squares against Dijkstra's 173, about a quarter.
- **Weighted A\*:** 36 squares at ×3 and 16 at ×5, both costing 39.
- **Mixed map:** breadth-first 22 steps at cost 30, the others 24 at cost 24; A* 75 squares against Dijkstra's 150.
- **Roads:** 473 km; Dijkstra settles 9 towns, A* 7.

The algorithms are standard and correct. The history (1956, twenty minutes, café in Amsterdam; A* in 1968) matches primary sources. The most important fix is on the first step. It says the next steps will search "this map", but each step keeps its own map (`'map:' + step.id`), so the reader's walls disappear when they click Next.

## Factual errors
- **low** · steps.ts:127. "worked out a fix" suggests Dijkstra was improving breadth-first search. In fact he was choosing a problem to demonstrate the new ARMAC computer: the shortest route between two Dutch cities. He worked it out in 1956 and published it in 1959. Suggested replacement: "In 1956 Edsger Dijkstra, looking for a problem to show off a new computer, worked out the answer in about twenty minutes on a café terrace in Amsterdam (he published it three years later): always expand…". Sources: Dijkstra's oral-history interview, https://conservancy.umn.edu/server/api/core/bitstreams/7a97387c-e045-4647-925c-d6d94a312f6e/content ; https://en.wikipedia.org/wiki/Dijkstra's_algorithm

Everything else checks out: the A* date, admissibility, the consistency condition in the note, the claim that no road beats a straight line, and the 473 km route.

## Model issues
- **medium** · e2e/search-model.e2e.ts. Several numbers the page quotes are not tested, so a change to a preset or a tie-break could quietly falsify the text:
  - the marsh "quarter" (46 of 173);
  - the weighted runs (×3 gives 36 squares at cost 39; ×5 gives 16 at cost 39);
  - the road route (473 km, 9 towns against 7).

  The tests also only use the three preset maps. Add, for example:
  ```ts
  test('numbers quoted in the narrative', () => {
    expect(search(MARSH, 'astar').expanded).toBe(46);
    expect(search(MARSH, 'dijkstra').expanded).toBe(173);
    for (const [w, n] of [[3, 36], [5, 16]] as const) {
      const r = search(MARSH, 'astar', w);
      expect(r.expanded).toBe(n); expect(r.cost).toBe(39);
    }
    const d = route(REGION, 0, 9, 'dijkstra'), a = route(REGION, 0, 9, 'astar');
    expect(d.km).toBe(473); expect(d.order.length).toBe(9); expect(a.order.length).toBe(7);
  });
  test('random maps: Dijkstra and A* match brute force; BFS has the fewest steps', () => {
    const rnd = rng(1);
    for (let k = 0; k < 300; k++) {
      const cells = Array.from({ length: 22 * 11 }, () => { const u = rnd(); return (u < 0.25 ? 2 : u < 0.4 ? 1 : 0) as Cell; });
      const g = { cols: 22, rows: 11, cells, start: 0, goal: 22 * 11 - 1 };
      g.cells[g.start] = 0; g.cells[g.goal] = 0;
      const best = cheapest(g);
      expect(search(g, 'dijkstra').cost).toBe(best);
      expect(search(g, 'astar').cost).toBe(best);
      // and BFS path length equals cheapest() run with every cost set to 1
    }
  });
  ```
- **low** · e2e/search-model.e2e.ts:138. The `- 0.5` tolerance would let a road be slightly shorter than the straight line, which would make the A* estimate too high. Drop the tolerance: `toBeGreaterThanOrEqual(Math.hypot(...))`. The current roads all pass anyway.
- **low** · search.ts:171. The comment says the goal "is reached once it is queued", but the loop only stops when the goal is dequeued. The behaviour is correct; the comment is misleading. Replace it with: `// here `done` means "discovered"; the search stops when the goal is dequeued`.

## Narrative and scene mismatches
- **medium** · steps.ts:90 against GridScene.svelte:59. "In the next steps, three different methods will search this map." The map is stored per step, so the reader's edits do not carry over, and later steps load the marsh anyway. Two possible fixes:
  - **Change the text:** "In the next steps, three different methods will search maps like this one; on each step you can paint and move S and G again."
  - **Change the code:** key the map by preset, `const mapKey = $derived('map:' + String(step.hints?.map ?? step.id));`. Then `map` and `bfs` share the open map, and the marsh steps share one marsh. That fits "Paint more mud and watch the ripple bend round it" across Dijkstra and A*.
- **medium** · steps.ts:52 (the estimate control's help text). "its straight-line guess" is wrong for the grid. There the estimate is the Manhattan step count, as the text at steps.ts:142 and 153 says. Replace with: `help: 'How much A* multiplies its guess of the cost still to go (steps to the goal, ignoring walls and mud).'`
- **low** · steps.ts:154. "Trust the estimate more … and A* rushes more directly at the goal, looking at fewer squares" is not true for small multipliers on this map. ×1.5 visits 49 squares and ×2 and ×2.5 visit 48, all more than 46, with the route unchanged. The slider offers these values. Add: "(small multipliers such as × 1.5 or × 2 change little here)".
- **low** · RoadsScene.svelte:133. "A route is a systematic exploration of a graph" is not what is meant: a route is not an exploration. Replace with: `'Finding a route is a systematic exploration of a graph — and a good estimate lets the search skip much of it.'`
- **low** · steps.ts:181. "three quarters of the squares on the open marsh" names neither of the two maps (open, marsh). Replace with: "nearly three quarters of the squares on the marsh map".

## Catalogue requirements
All met. The reader can draw walls and mud and move S and G. Breadth-first search, Dijkstra and A* expand their frontiers on screen. Cells visited and route cost are compared side by side. Breadth-first search is shown taking the fewest-steps route through the mud. The page then switches to a weighted road graph. The takeaway is visible in the readouts (46 against 173 squares; 75 against 150). The pitfall is handled: the estimate is based on the cheapest terrain, the note says so, and the estimate step shows an over-trusted estimate missing the cheapest route.

## Clarity
- **low** · steps.ts:127. "expand" is used here for the first time (the BFS step said "look at"), and the readouts use it too, without a definition for level 1. Suggested wording: "always <strong>expand</strong> (take off the frontier and look at the neighbours of) the frontier square with the lowest cost so far."
- **low** · steps.ts:166–167 against RaceScene.svelte:513 and 556. The text says "squares" but the race scene says "cells". Use one word on the page; "squares" matches the rest of it.

## Sources consulted
- Dijkstra oral-history interview (Charles Babbage Institute): https://conservancy.umn.edu/server/api/core/bitstreams/7a97387c-e045-4647-925c-d6d94a312f6e/content
- Dijkstra's algorithm, history section: https://en.wikipedia.org/wiki/Dijkstra's_algorithm
- Hart, Nilsson and Raphael (1968), "A Formal Basis for the Heuristic Determination of Minimum Cost Paths": https://dblp.org/rec/journals/tssc/HartNR68.html
- Zhang et al., "A* Search with Inconsistent Heuristics", IJCAI 2009 (admissible but inconsistent estimates, and re-expanding nodes): https://www.ijcai.org/Proceedings/09/Papers/111.pdf
- Kask, ICS 271 slides on A* admissibility and consistency: https://ics.uci.edu/~kkask/Fall-2016%20CS271/slides/03-InformedHeuristicSearch.pdf
- My own Node re-run of `search.ts` (copied verbatim), for all quoted counts and costs.
