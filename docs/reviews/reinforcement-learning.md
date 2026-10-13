<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.54 in tokens + 9 web searches -->
# Review: reinforcement-learning

## Verdict
Ready after the fixes below. I ported `qlearning.ts` (including the mulberry32 generator) to Python and re-ran it, and every number the page quotes came out the same: 13 moves and 2.82 for the maze, 4.8 against 0.73 for the choice map, 3, 6, 28 and 30 of 30 runs finding the +10, a late average of about 4.2 at 100%, and exactly 10 with decay. The rule is standard Q-learning with ε-greedy exploration, and value iteration is correct. The most important fix is in the "A reward now is worth more" step. It says a discount of 0.5 makes the agent "short-sighted", but in the maze the agent still takes the 13-move route. Meanwhile the scene's 0.005 display cut-off removes the arrows and numbers near S, so the graphic suggests the agent has lost its way when it hasn't.

## Factual errors
- **low** — steps.ts:197: "Close relatives of it … were part of AlphaGo." TD-Gammon (TD(λ)) really is a close relative of Q-learning. AlphaGo is not: it trained a policy network on human games, then improved it by self-play policy-gradient learning, added a value network, and combined them with tree search. Fix: "Related reinforcement-learning methods learned backgammon close to the level of the best human players (Gerald Tesauro's TD-Gammon, early 1990s), and self-play reinforcement learning was part of AlphaGo, which in March 2016 …". Sources: https://augmentingcognition.com/assets/Silver2016a.pdf, https://link.springer.com/rwe/10.1007/978-0-387-30164-8_813
- I checked the other facts and they hold: Watkins 1989 and Watkins & Dayan 1992 with their convergence conditions, DQN in 2015 on 49 games, AlphaGo beating Lee Sedol 4–1 in March 2016, and cliff walking (Example 6.6), where Q-learning takes the edge route and does worse while learning than Sarsa.

## Model issues
- No problems with the model itself. The update, the handling of episode ends (no bootstrap on terminal squares, bootstrap when an episode is cut off), random tie-breaking, the decay schedule and value iteration (the Bellman optimality equation) are all correct. The tests check real properties: the Bellman residual, the γ = 0 and α = 0 limits, convergence to Q*, and cliff walking.
- **low** — GridWorldScene.svelte:125–127 and e2e/qlearning-model.e2e.ts:65: both comments say every estimate stays 0 until the first +10. That is false. Falling into a pit sets an estimate to −5; with seed 9 the very first maze episode ends in a pit. (The test's assertion, `after <= 0`, is correct.) Fix: "no estimate becomes positive before the first +10 (pits make some negative)".

## Narrative and scene mismatches
- **medium** — steps.ts:154 and GridWorldScene.svelte:328, 361. With only one reward in the maze, every γ between 0 and 1 gives the same best moves. My run at γ = 0.5 still learns the 13-move route, and its late episode lengths match the γ = 0.9 run. Meanwhile `best()` and `numbers` hide any square whose value is ≤ 0.005. At γ = 0.5 that hides S and the square next to it (10 × 0.5¹² ≈ 0.0024), so the arrows vanish exactly where the agent starts.
  - Text fix: "Lower the discount and the numbers shrink fast: at 0.5, the same +10 seen from S is worth 10 × 0.5¹² ≈ 0.002. Here the agent still finds its way, because there is only one reward. But given a near +1 and a far +10, a short-sighted agent takes the +1: at 0.5, 1 × 0.5³ = 0.125 beats 10 × 0.5⁷ ≈ 0.078." The test at e2e:181 already backs this.
  - Code fix: draw an arrow wherever `v > 0` (`if (v <= 0) return -1;`), and keep the 0.005 cut-off only for the colour bands and numbers.
- **low** — GridWorldScene.svelte:502, 1001: `f2` prints "exact: 0" at γ = 0.5, while the text says ≈ 0.002. Fix: `const f2 = (v) => v === 0 ? '0' : Math.abs(v) < 0.005 ? v.toPrecision(2) : v.toFixed(2);`
- **low** — GridWorldScene.svelte:1099: in the choice map the episode bar says "shortest: 8", but the agent's episodes to the +1 take 4 moves and plot below that line. Fix: label it `` `shortest to ${world.cells.includes(REWARD) ? 'the +10' : 'the +1'}: ${shortest}` ``.
- **low** — steps.ts:182: "It never settles at exactly 13". In the default run, 39 of the last 100 episodes take exactly 13 moves; only the average stays above 13. Fix: "Its average never settles at 13, the shortest possible, because one move in ten is still random — sometimes into a pit."
- **low** — steps.ts:139–140: the credit card usually first shows a pit update (0 → −5, in red), which the text never mentions. Fix: add "A move into a pit is nudged the same way, towards −10."

## Catalogue requirements
All met. Painting rewards, penalties and walls works; each square shows four estimates, one per move; the exploration rate, discount factor and learning rate each have a slider; and there is an early-versus-late comparison on the learning curve. The takeaway can be seen in the graphic: the colours spread back from the reward and the learnt route appears.

## Clarity
- **medium** — steps.ts:140: the figure 0.5 × (0.9 × 5) uses 0.9 before the discount factor has been explained. Fix: "…as if the square paid out, though slightly less (×0.9, the discount, explained next): 0.5 × (0.9 × 5) = 2.25."
- **low** — steps.ts:141: "γ the discount factor of the next step" reads as if γ belonged to the next move. Fix: "γ the discount factor (see the next step)".

## Sources consulted
- http://www.gatsby.ucl.ac.uk/~dayan/papers/wd92.html (Watkins & Dayan 1992)
- https://www.cs.utexas.edu/~shivaram/readings/b2hd-Watkins1989.html (Watkins 1989 thesis)
- https://www.mit.edu/~jnt/Papers/J052-94-jnt-q.pdf (Tsitsiklis, convergence conditions)
- https://web.stanford.edu/class/psych209/Readings/MnihEtAlHassibis15NatureControlDeepRL.pdf (DQN, 49 games)
- https://en.wikipedia.org/wiki/AlphaGo_versus_Lee_Sedol
- https://augmentingcognition.com/assets/Silver2016a.pdf (AlphaGo training)
- http://incompleteideas.net/book/ebook/node65.html (Sutton & Barto, cliff walking)
- https://link.springer.com/rwe/10.1007/978-0-387-30164-8_813 (TD-Gammon)
- My Python port of `qlearning.ts` (seeds 1–50, plus seed 9 at γ = 0.5 and on the open map).
