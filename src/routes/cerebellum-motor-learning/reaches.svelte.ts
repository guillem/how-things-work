/**
 * The reader's reaches, kept for the whole visit so that the steps of the page form one
 * experiment (baseline, rotation, aftereffect, recovery). Lives outside the scenes, which are
 * remounted when the step changes scene.
 */
import type { Reach } from './experiment';

class Reaches {
	list = $state<Reach[]>([]);
	/** The last value of the "Clear my reaches" button that was acted on. */
	cleared = 0;
	/** Reaches before this index are shown on the chart even if made without a cursor. */
	revealed = $state(0);
	/** The last value of the "Show my hidden reaches" button that was acted on. */
	shown = 0;

	add(r: Reach) {
		this.list = [...this.list, r];
	}
	reveal() {
		this.revealed = this.list.length;
	}
	clear() {
		this.list = [];
		this.revealed = 0;
	}
}

export const reaches = new Reaches();
