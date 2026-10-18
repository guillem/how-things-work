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

	add(r: Reach) {
		this.list = [...this.list, r];
	}
	clear() {
		this.list = [];
	}
}

export const reaches = new Reaches();
