/** Shapes of `rlhf-data.ts` (built by scripts/data/rlhf-alignment/build.py). */

export interface Answer {
	/** The answer GPT-2 wrote after the prompt, without its leading space. */
	text: string;
	/** Its length in GPT-2 tokens. */
	tokens: number;
	/** Its log-probability (nats) under the sampling that drew it. */
	logp: number;
	/** The stand-in rater's score (−3 to 4; see the build script for the rule). */
	score: number;
	/** The reward model's features: D principal components of GPT-2's hidden states. */
	f: number[];
}

export interface PromptData {
	id: string;
	/** The question, as shown. */
	question: string;
	/** The exact text given to GPT-2. */
	prompt: string;
	/** The rater's list of useful words for this question. */
	words: string[];
	/** Fraction of the features' variance the D components keep. */
	explained: number;
	answers: Answer[];
}
