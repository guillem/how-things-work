import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { prompts } from './rlhf-data';

const question: Control = {
	type: 'select',
	id: 'question',
	label: 'Question',
	default: 'sleep',
	options: prompts.map((p) => ({ value: p.id, label: p.question }))
};

const rateMore: Control = {
	type: 'action',
	id: 'rate',
	label: 'The stand-in rater compares 100 more random pairs',
	action: 'Add 100 comparisons'
};

const forget: Control = {
	type: 'action',
	id: 'forget',
	label: 'Throw away every comparison of this question',
	action: 'Start from nothing'
};

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Back to the page’s first 100 comparisons',
	action: 'Reset'
};

/** The KL leash β, on a log scale: the slider holds log₁₀ β. */
const leash: Control = {
	type: 'range',
	id: 'leash',
	label: 'KL leash β',
	min: -2,
	max: 1,
	step: 0.05,
	default: 0,
	format: (v) => {
		const b = 10 ** v;
		return b >= 1 ? b.toFixed(b < 10 ? 1 : 0) : b.toFixed(b < 0.1 ? 3 : 2);
	},
	help: 'Large β: stay close to GPT-2. Small β: chase the reward.'
};

const rerun: Control = {
	type: 'action',
	id: 'rerun',
	label: 'Sample a new run (another seed)',
	action: 'Run again'
};

const BASE = `<dfn data-def="A language model trained only to predict the next token of text from the web and books: it continues whatever it is given, with no notion of being asked something.">base model</dfn>`;
const REF = `<dfn data-def="The model before this training step, kept frozen as a yardstick: written π_ref. Here it is GPT-2 itself.">reference model</dfn>`;
const KL = `<dfn data-def="Kullback–Leibler divergence: KL(π ‖ π_ref) = Σ π(y)·ln(π(y)/π_ref(y)), in nats. Zero when the two distributions are the same; it grows as π puts probability where π_ref puts little. On this page it can reach at most ln 64 ≈ 4.16, when everything sits on one answer.">KL divergence</dfn>`;
const SIGMOID = `<dfn data-def="σ(x) = 1/(1 + e^−x): 0.5 at x = 0, close to 1 for large x, close to 0 for very negative x. It turns a difference of scores into a probability.">σ</dfn>`;
const LOGISTIC = `<dfn data-def="The fitting rule of logistic regression: choose the weights that make the observed choices most probable, that is, minimise the average of −ln σ(r(winner) − r(loser)).">logistic loss</dfn>`;
const PCA = `<dfn data-def="Principal components: the directions along which the 64 answers' 768 numbers vary most. Keeping the first 48 keeps 99.8% of the variation with fewer numbers to fit.">principal components</dfn>`;
const PG = `<dfn data-def="Changing a policy's parameters in the direction that increases its expected return, estimated from sampled actions: answers that scored above the batch average are made more likely, those below less (REINFORCE, Williams 1992). PPO is a more careful version used for large models.">policy gradient</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'rlhf-alignment',
	title: 'RLHF: learning from human preferences',
	summary:
		'Compare pairs of answers GPT-2 wrote and watch a Bradley–Terry reward model learn from the choices; then pull the base model towards that reward on a KL leash, exactly and by policy gradient, and loosen the leash until the policy games the reward model’s mistakes.',
	chapters: [
		{ id: 'base', title: 'A base model and a judge' },
		{ id: 'reward', title: 'A reward from comparisons' },
		{ id: 'policy', title: 'The policy on a leash' },
		{ id: 'limits', title: 'What it is and is not' }
	],
	steps: [
		// ------------------------------------------------------------------ base
		{
			id: 'base',
			chapter: 'base',
			title: 'A base model continues text',
			scene: 'answers',
			hints: { mode: 'base' },
			duration: 30,
			controls: [question],
			body: `
<p>A <a href="../language-models/">language model</a> straight out of pre-training is a ${BASE}: it continues text. Give GPT-2 small (124 million weights, OpenAI 2019) “Q: How can I fall asleep faster? A:” and it writes something that looks like an answer, one token at a time, each drawn from its predicted distribution. Here it has written 64 answers to each of three questions, each stopped at a new line or at the end of a sentence. Some help, many wander off: one is about running sprints.</p>
<p>Those 64 answers are all the page works with. Since they were drawn from GPT-2, they are a sample of its distribution: on this set, the base model gives each one probability 1/64, the 64 equal tiles. Turning a base model into an assistant means moving that probability towards the answers people prefer, without breaking what the model already does well.</p>`,
			notes: `<p>The answers were sampled from the 40 most likely tokens at each step (top-k 40, as in OpenAI's published GPT-2 samples) at temperature 1, so π_ref here is “GPT-2 sampled that way”. Each answer's own probability under GPT-2 is tiny (around e<sup>−40</sup> for a sentence) and varies hugely with its length; on a sample, the right weight for each draw is 1/64, the way a histogram weights its points. Real systems first fine-tune the base model on written demonstrations (supervised fine-tuning) before RLHF; this page starts from the base model to keep the steps apart.</p>`
		},
		{
			id: 'rater',
			chapter: 'base',
			title: 'A stand-in for the human',
			scene: 'answers',
			hints: { mode: 'rater' },
			duration: 30,
			controls: [question],
			body: `
<p>RLHF learns from people's judgements, and in a real system nobody can write those down as a formula. To show what is learnt and what is lost, the page needs a judge whose preferences it knows exactly, so its stand-in “human” is a stated rule. For each question it has a list of useful words (for sleep: bed, dark, relax, caffeine, screen, routine and others), and it scores an answer:</p>
<p>+1 for each different useful word, up to 3; +1 for finishing the sentence; −1 for ending on a question; −1 for talking about itself (I, me, my); −1 for repeating one long word three times or more.</p>
<p>The colours are those scores. The rule is crude, as any written rule would be, but on this page it is the truth: the target the rest of the pipeline is trying to reach, without ever seeing the rule.</p>`,
			notes: `<p>Gao, Schulman and Hilton (2023) used the same trick at scale: a large “gold” reward model stood in for the humans and labelled the comparisons, so they could measure how far the learnt reward drifted from the preferences behind it. The rater compares two answers noisily, by the rule in the next step, with its strength set to twice its score.</p>`
		},
		// ------------------------------------------------------------------ reward
		{
			id: 'compare',
			chapter: 'reward',
			title: 'Which of two answers is better?',
			scene: 'compare',
			hints: { mode: 'pair' },
			duration: 34,
			controls: [question],
			body: `
<p>People are bad at giving answers a score from 1 to 10 consistently, and much better at saying which of two is better. So RLHF collects comparisons. Click the better of the two answers (or the arrow to skip a pair): each choice joins the 100 the stand-in rater has already made for this question.</p>
<p>To learn from comparisons, RLHF assumes the <a href="https://en.wikipedia.org/wiki/Bradley%E2%80%93Terry_model">Bradley–Terry</a> model (1952): each answer y has a hidden reward r(y), and a rater prefers a to b with probability ${SIGMOID}(r(a) − r(b)). Equal rewards give even odds; a lead of 2 gives 88%. Only differences matter, so adding the same number to every reward changes nothing. The stand-in rater follows this rule exactly, with r = 2 × its score; your clicks follow your own judgement.</p>`,
			notes: `<p>The curve is σ itself; the dot is where the current pair sits on it according to the reward model of the next step. InstructGPT's labellers (Ouyang et al. 2022) ranked 4 to 9 answers to a prompt at a time, and every pair from a ranking became one comparison. In odds, a beats b at e<sup>r(a)</sup> to e<sup>r(b)</sup>: each answer has a strength e<sup>r</sup>, the same form as the Elo rating of chess players.</p>`
		},
		{
			id: 'reward-model',
			chapter: 'reward',
			title: 'A reward model learns from the comparisons',
			scene: 'compare',
			hints: { mode: 'fit' },
			duration: 36,
			controls: [question, rateMore, forget, restart],
			body: `
<p>The reward model gives every answer a number r(y), and is fitted so that the comparisons are as probable as possible under Bradley–Terry: the ${LOGISTIC}, minimised over its weights. It is linear: r(y) = w · f(y), where f(y) is what GPT-2 itself “thinks” while reading the answer, its final hidden state (768 numbers, averaged over the answer's tokens; see the <a href="../residual-stream-logit-lens/">residual stream</a>), reduced to 48 ${PCA}. Real reward models are the language model itself with its prediction layer replaced by one that outputs a single number.</p>
<p>Each dot is one answer: across, the rater's true score; up, the reward model's. With the first 100 comparisons for the sleep question, they agree only roughly (correlation 0.47): many pairs were ties at even odds, and 48 weights is a lot to pin down. Add comparisons and watch the dots line up (0.71 after 400); start from nothing and click pairs yourself to see a reward model learn your taste.</p>`,
			notes: `<p>A small penalty on the weights' size (L2, λ = 3) keeps the fit sensible when there are few comparisons; with none, every answer gets the same reward. The fit is a logistic regression on the differences f(a) − f(b), solved by Newton's method, which on this convex loss always finds the one best set of weights. The reward model can only express what is a straight line in GPT-2's features, so even with endless comparisons it cannot reproduce a word-counting rule exactly.</p>`
		},
		// ------------------------------------------------------------------ policy
		{
			id: 'tilt',
			chapter: 'policy',
			title: 'Pull the model towards the reward, on a leash',
			scene: 'policy',
			hints: { mode: 'tilt' },
			duration: 36,
			controls: [question, leash],
			body: `
<p>Now the model itself, the <em>policy</em> π, is trained to earn reward. Left alone, it would put everything on the reward model's single favourite, so RLHF adds a leash: it maximises E<sub>π</sub>[r] − β · ${KL}(π ‖ π_ref), the reward minus a penalty for drifting from the ${REF}.</p>
<p>That objective has an exact answer: π*(y) ∝ π_ref(y) · e<sup>r(y)/β</sup>. Each answer keeps its base-model probability, multiplied by a factor that grows with its reward. It is Bayes' rule in another form: the base model is the prior, e<sup>r/β</sup> the likelihood. The bars are the 64 answers ordered by reward, with the base model's 1/64 as the dashed line. Large β keeps π close to GPT-2; slide β down and probability flows to the high-reward answers.</p>
<p>On this page the policy can only reweight the 64 answers GPT-2 wrote: an answer the base model gives no probability keeps none.</p>`,
			notes: `<p>Why this form: E<sub>π</sub>[r] − β·KL(π ‖ π_ref) = −β·KL(π ‖ π*) + β ln Z, where Z = Σ π_ref(y)·e<sup>r(y)/β</sup>; the first term is never positive and is zero only at π = π*. For a real model the sum Z runs over every possible text, far too many to add up, which is why the policy is trained by reinforcement learning instead of written down. Korbak, Perez and Buckley (2022) spell out the Bayesian reading.</p>`
		},
		{
			id: 'gradient',
			chapter: 'policy',
			title: 'What reinforcement learning does: climb to the same place',
			scene: 'policy',
			hints: { mode: 'pg' },
			duration: 36,
			controls: [question, leash, rerun],
			body: `
<p>A real policy is a network, and it is trained by ${PG}, as on the <a href="../reinforcement-learning/">reinforcement learning</a> page: sample answers from the current policy, score each with the reward minus β times its log-ratio to the reference, and make the answers that beat the batch's average more likely. The bars here are a policy with one adjustable number per answer, trained that way from GPT-2's 1/64 in batches of 16 sampled answers; the outlines are the exact optimum of the previous step.</p>
<p>The run is noisy, but at β = 1 it ends within a few per cent of the exact π_ref · e<sup>r/β</sup>, normalised: the formula is where the climb ends. Slide β below about 0.3 and run it again: the run often locks onto a well-rewarded answer it happened to sample early and stops sampling the others, ending short of the optimum. The formula says what the objective rewards; reaching it by sampling needs exploration, a real difficulty of reinforcement learning. None of this is PPO on GPT-2 (no weight of GPT-2 changes here): it is the same objective, solved two ways.</p>`,
			notes: `<p>Each step moves every answer's number by (learning rate / β) × its estimated gradient; the KL term makes the objective curved by about β, so larger steps would overshoot. InstructGPT's PPO applies the KL penalty per token inside the reward and clips each update; with 175 billion weights the policy also changes answers it never sampled, which this toy cannot show.</p>`
		},
		{
			id: 'hacking',
			chapter: 'policy',
			title: 'Loosen the leash and the reward model is gamed',
			scene: 'hack',
			duration: 40,
			controls: [question, leash, rateMore, restart],
			body: `
<p>The reward model is a learnt proxy for the preferences, not the preferences. As β falls the policy moves further from GPT-2 (KL grows, to the right) and the reward model's score keeps rising, by construction. The rater's own score rises at first, then falls: past a point the policy gains reward by piling onto the answers the reward model over-rates. With the first 100 comparisons for the sleep question, the rater's average peaks near β ≈ 0.8, at 1.33 against GPT-2's 0.98, and ends at 1.00 as the policy collapses onto the answer about running sprints.</p>
<p>This is over-optimisation, or reward hacking, measured at scale by Gao, Schulman and Hilton (2023): the true score against the distance from the reference model rises and then falls, and later for bigger reward models with more data. Add comparisons and the fall shrinks, because the reward model has fewer mistakes to exploit. Nothing here wants to cheat: an optimiser pushed hard on an imperfect measure finds where it is wrong.</p>`,
			notes: `<p>The policy at each β is the exact optimum π_ref · e<sup>r/β</sup>, normalised; its KL can reach ln 64 ≈ 4.16 nats, when one answer has everything. With other questions or other comparisons the peak sits elsewhere, and with enough comparisons the reward model's favourite can be one the rater also likes, so loosening the leash costs nothing. Gao et al. plot against d = √KL and fit simple curves in d to both best-of-n sampling and RL. Holding β fixed is one remedy; others are early stopping, ensembles of reward models and collecting new comparisons on the new policy's answers.</p>`
		},
		// ------------------------------------------------------------------ limits
		{
			id: 'limits',
			chapter: 'limits',
			title: 'From GPT-2 to an assistant, and what RLHF is not',
			scene: 'pipeline',
			duration: 40,
			body: `
<p>The recipe at full size (InstructGPT, Ouyang et al. 2022; earlier Christiano et al. 2017 and Stiennon et al. 2020): fine-tune the base model on written examples of good answers, collect comparisons of its answers, fit a reward model, and train the policy against it with a KL penalty. Labellers preferred the answers of a 1.3-billion-weight InstructGPT to those of the 175-billion GPT-3 it started from. Direct Preference Optimisation (Rafailov et al. 2023) skips the separate reward model: it takes the exact optimum of this page and solves it for the reward, r(y) = β ln(π(y)/π_ref(y)) + a constant, so the comparisons can train the policy directly.</p>
<p>Three limits. The reward model is a proxy for what the raters preferred, with its own mistakes. The leash keeps the model close to what it was: on this page it can only reweight what GPT-2 already wrote; whether RLHF at scale teaches a model anything new, or mostly brings out what pre-training put there, is still argued. And RLHF is one tool of alignment, not all of it: deciding what to want, checking that a model does it, and understanding how it works are larger problems.</p>`,
			notes: `<p>DPO's loss is the Bradley–Terry loss with that reward plugged in: −ln σ(β ln(π(y<sub>w</sub>)/π_ref(y<sub>w</sub>)) − β ln(π(y<sub>l</sub>)/π_ref(y<sub>l</sub>))), where Z cancels because only differences matter. Comparisons can also come from another model following written principles (RLAIF; Bai et al. 2022's Constitutional AI), and some recent systems train on rewards a program can check, such as a maths answer, rather than on preferences.</p>`
		}
	]
};
