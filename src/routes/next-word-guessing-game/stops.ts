/** Places in The Tale of Jemima Puddle-Duck where the guessing game stops for a guess. */

export interface Stop {
	/** The sentence up to the gap, as printed in the book. */
	before: string;
	/** The word the book has next. */
	answer: string;
	/** The four cards the reader picks from (the answer among them). */
	choices: string[];
}

export const STOPS: Stop[] = [
	{
		before: 'When she reached the top of the',
		answer: 'hill',
		choices: ['lion', 'hill', 'tree', 'sky']
	},
	{
		before: 'She tried to hide her eggs; but they were always found and carried',
		answer: 'off',
		choices: ['home', 'away', 'off', 'water']
	},
	{
		before: '… flapping her shawl, and then she jumped off into the',
		answer: 'air',
		choices: ['pond', 'wood', 'air', 'lion']
	},
	{
		before: '“I wish to hatch my own',
		answer: 'eggs',
		choices: ['eggs', 'nest', 'way', 'ducks']
	},
	{
		before: 'He had black prick ears and sandy coloured',
		answer: 'whiskers',
		choices: ['fur', 'eyes', 'hair', 'whiskers']
	}
];
