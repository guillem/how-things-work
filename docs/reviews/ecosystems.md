<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.71 in tokens + 10 web searches -->
# Review: ecosystems

## Verdict

The page is ready once the fixes below are made. The facts, the equations and the scene logic are mostly sound. I re-ran the model in Node and every number the narrative depends on checks out: the balance point, the order of the four quarters of the loop, and the wolves-off cascade (elk +44%, willow −24%, beavers −29%). The most important fix is in the food web. The deer step's main claim is that the elk vanish "although no deer ever harmed an elk". But the model has a direct deer-against-elk competition term, and that term is what makes the elk die out. Without it the elk survive. This weakens the page's takeaway, but it can be fixed by changing two numbers (see Model issues).

## Factual errors

- **low**, steps.ts:134 and 137. The step presents deer as a newcomer to a web "loosely inspired by Yellowstone", but deer already live in Yellowstone: mule deer, plus a few white-tailed deer. Add to the notes at line 137: "In Yellowstone, deer are not newcomers (mule and white-tailed deer live there already); the newcomer here is a thought experiment." Source: https://www.nps.gov/yell/learn/nature/white-tailed-deer.htm
- **low**, eco.ts:67. The comment says the default parameters give "a cycle of about 10 years". In fact the run from LV_START has a cycle of 8.4 years, and the test at eco-model.e2e.ts:35 asserts 8–9. See the next section for a fix that brings the real cycle to about 10 years.
- **low**, steps.ts:96. "Records of hare and lynx pelts … show similar ten-year swings" is correct; it is the classic 10-year cycle. However, ecologists dispute that it is a pure predator–prey oscillation, because food supply plays a part too. Optional addition: "…similar ten-year swings, though there the hares' food matters as well as their predators." Sources: https://www.bio.fsu.edu/~james/krebs.pdf, https://www.researchgate.net/publication/242783962

The other facts check out: Verhulst 1838; Lotka 1925 and Volterra 1926; the last Yellowstone wolves killed in 1926 and the reintroduction in 1995; the debate over the cascade; and "apparent competition" (Holt 1977).

## Model issues

- **high**, eco.ts:102 and 105 (with steps.ts:135 and 137). The elk row has a −0.004 term for deer, and the deer row the same for elk. This is direct competition, set as strong as each species' crowding of itself. With identical niches, the deer's higher breeding rate then guarantees the elk die out, whatever the wolves do. I checked this:
  - With the term removed and everything else unchanged, the elk do not vanish; they settle at about 3.8.
  - With the term in place and the wolves switched off, the elk still vanish (0.06 at year 60).

  So the page's story, "more wolves hunt the elk harder, while the deer also eat the elk's food… no deer ever harmed an elk", is not what drives the model. Fix in eco.ts:

  ```ts
  [0.012, -0.004, 0, -0.06, 0], // elk: eat willow, crowded, eaten by wolves (no direct contact with deer)
  ...
  [0.012, 0, 0, -0.06, -0.004] // deer: like elk
  ...
  return [...rr, rr[1] + 0.25];
  ```

  Results with this change:
  - With wolves, the elk fall below 1 at year 41 and are at 0.27 at year 60, so the scene shows them as gone. Wolves end at 7.95 and deer at 46. The web settles after about 40 years, within SEG = 60.
  - Without wolves, the elk survive at about 5.

  The page would then really show apparent competition: switch the wolves off and the elk survive. Update the WebScene.svelte:24 comment to "~40 years". Add a test:

  ```ts
  test('the deer push the elk out through the shared wolves, not by contact', () => {
    expect(webRun([true, true, true, true, true]).at(-1)![1]).toBeLessThan(1);
    expect(webRun([true, true, true, false, true]).at(-1)![1]).toBeGreaterThan(2);
  });
  ```

- **medium**, eco.ts:70–72 and FieldScene.svelte:101. In the predator–prey runs, populations can fall far below one animal and then recover. I scanned the full slider grid: in 152 of 5,145 settings (about 3%), rabbits or foxes drop below 1. The worst case is birth 2.0, hunting 0.010, death 0.20: rabbits fall to 0.002, and the readout "Rabbits 0" is followed by a rebound to 2,800. A real population would be extinct at that point. This is the known "atto-fox" problem of continuous models. Fix: in FieldScene, find the first sample where H or P drops below 0.5, cut the run there with both values held at 0 from then on, and set `cycleText` to `'Rabbits died out: in a real field the cycle ends here'` (or the same for foxes). Alternatively, narrow the slider ranges. Source: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8408093/
- **low**, eco.ts:68 and steps.ts:42 (default death rate). To make the cycle match the "ten-year swings" the notes compare it with, set `LV_DEFAULT.d = 0.45` and `death.default = 0.45`. The measured cycle then becomes 9.65 years. Update the test at e2e:45–47 to expect 9–10.5 years and `lvSmallPeriod` ≈ 9.4. If you'd rather not change the model, change the comment to "about 8½ years" instead.
- **low**, steps.ts:6 and eco.ts:47. In both the logistic and the Lotka–Volterra equations, `a` is the prey's net growth rate (births minus natural deaths), not its birth rate. The simplest fix is in the notes at line 82: "…where a is the rabbits' growth rate (births minus natural deaths)". Another option is to relabel the control "Rabbit breeding rate".

## Narrative and scene mismatches

- **medium**, steps.ts:108. "Start there and nothing changes" suggests the reader can choose the starting point, but the run always starts from 200 rabbits and 30 foxes (`LV_START`). The scene does handle the case ("No cycle: the run starts at the balance point"), but only with one setting nobody is told about. Replacement: "If the run started there, nothing would change: try birth rate 0.60, hunting 0.020 and fox death rate 0.40, which put the balance point exactly at the starting 200 rabbits and 30 foxes. Start anywhere else and the populations circle round it." Making the start point draggable would be better still.
- **low**, WebScene.svelte:325. Suppose the deer drive the elk out and the reader then switches the deer off. The prefix is empty, so the summary reads "Everyone back: elk gone, …", which contradicts itself. Fix: `line: \`${prefix || (parts.some((d) => d.p < -1) ? 'Original species switched on' : 'Everyone back')}: ${body}\``.

## Catalogue requirements

All met:
- The interaction is built as written: birth, death and predation sliders; field icons plus curves; species can be removed from or added to the food web.
- The takeaway is visible in the graphic: ripple markers, rise and fall halos, and the elk vanishing.
- The entry has no pitfall and no data needs.

## Clarity

- **low**, steps.ts:33. The hunting control shows a bare number ("0.020") with no unit, which means nothing to a Level 1 reader. The model's b is the share of rabbits each fox catches per year, so the slider can say so: `format: (v) => \`${(v * 100).toFixed(1)}% of rabbits per fox per year\``.
- **low**, steps.ts:96. The note says crowding is left out but not what that changes. Add: "…left out here; put it back and the swings slowly die down towards the balance point." This is true of Lotka–Volterra with logistic prey, and it stops readers from taking the endless cycles as robust.

## Sources consulted

- Krebs et al., "What drives the 10-year cycle of snowshoe hares?": https://www.bio.fsu.edu/~james/krebs.pdf
- Hare–lynx dynamics in the Hudson's Bay Company series: https://www.researchgate.net/publication/242783962_Factors_affecting_harelynx_dynamics_in_the_classic_time_series_of_the_Hudson_Bay_Company_Canada
- Verhulst and the logistic equation (1838): https://link.springer.com/chapter/10.1007/978-0-85729-115-8_6
- History of wolves in Yellowstone (last wolves 1926): https://en.wikipedia.org/wiki/History_of_wolves_in_Yellowstone
- NPS, Yellowstone cycles and processes (trophic cascade debate): https://www.nps.gov/yell/learn/nature/cyclesprocesses.htm
- NPS, white-tailed deer in Yellowstone: https://www.nps.gov/yell/learn/nature/white-tailed-deer.htm
- Science, wolves killing beavers in Voyageurs National Park: https://www.science.org/content/article/wolf-attacks-beavers-are-altering-very-landscape-national-park
- Holt (1977) and apparent competition: https://www.academia.edu/80405473/Holt_1977_and_apparent_competition
- Fowler, "Atto-foxes and other minutiae" (Bull. Math. Biol.): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8408093/
- My own re-runs of eco.ts in Node: the default cycle, a scan of the slider grid for minimum populations, the food-web cases, and the proposed fix.
