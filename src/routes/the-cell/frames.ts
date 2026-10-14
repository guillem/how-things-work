/**
 * The zoom of "The cell": a chain of views ("frames") from a tissue down to
 * single molecules, each with its true width, and the camera that moves
 * continuously between them.
 *
 * Every frame is a view `W` metres wide (960 stage units across, 600 down)
 * centred on a point of the world, in metres. Frames that draw something are
 * drawn in their own units (960 / W per metre); waypoints only steer the
 * camera. Between two consecutive frames the camera zooms about the one point
 * that stays still on the screen (the centre of the similarity that maps one
 * view onto the other), so the next frame grows in place without sliding, and
 * the view at the end of the zoom is exactly that frame.
 */
import { BACTERIUM_TARGETS, CYTOPLASM_VIEW_DEPTH } from './bacterium';
import { hepatocyte } from './liver';
import { PLANT_TARGETS } from './plant';
import type { CellType } from './structures';
import { NM, UM } from './units';

export interface Frame {
	id: string;
	cell: CellType;
	/** Width of the view, metres. */
	W: number;
	/** Centre of the view in the world, metres. */
	c: readonly [number, number];
	/** Which drawing to show (frames without one are camera waypoints). */
	draw?: string;
	/** Structure described in the card when the reader has picked nothing. */
	focus: string;
}

/** Stage size in units; the view's aspect ratio. */
export const STAGE = { w: 960, h: 600 } as const;

const h = hepatocyte();
const um = (p: readonly [number, number]) => [p[0] * UM, p[1] * UM] as const;
const add = (p: readonly [number, number], dx: number, dy: number) =>
	[p[0] + dx, p[1] + dy] as const;

/** Where the molecule views sit inside their machine views, nm from that view's centre. */
export const ATOM_SPOTS = {
	/** A stretch of linker DNA in the chromatin view. */
	dna: [-30, 14],
	/** An ATP molecule beside an ATP synthase head in the crista view. */
	atp: [12, -24],
	/** A chlorophyll in a photosystem II antenna in the thylakoid view. */
	chlorophyll: [-42, -6.6],
	/** A glucose molecule in the bacterium's cytoplasm view. */
	glucose: [34, 26]
} as const;

const spot = (base: readonly [number, number], s: readonly [number, number]) =>
	add(base, s[0] * NM, s[1] * NM);

// ---- the animal: a liver cell ---------------------------------------------------------
const chromatinC = um(h.targets.chromatin);
const cristaC = add(um(h.targets.cristaTip), -25 * NM, 0);
const ribosomeC = add(um(h.targets.erFace), 0, 12 * NM);
const membraneC = um(h.targets.edge);

// ---- the plant and the bacterium (see plant.ts and bacterium.ts for the layouts) --------
const thylakoidC = um(PLANT_TARGETS.thylakoid);
const cytoplasmC = add(um(BACTERIUM_TARGETS.envelope), 0, CYTOPLASM_VIEW_DEPTH * NM);

export const FRAMES: Record<string, Frame> = Object.fromEntries(
	(
		[
			{ id: 'liver', cell: 'animal', W: 300 * UM, c: [0, 0], draw: 'liver', focus: 'liver' },
			{
				id: 'hepatocyte',
				cell: 'animal',
				W: 40 * UM,
				c: [0, 0],
				draw: 'hepatocyte',
				focus: 'hepatocyte'
			},
			{
				id: 'nucleusView',
				cell: 'animal',
				W: 14 * UM,
				c: um([h.nucleus.x, h.nucleus.y]),
				focus: 'nucleus'
			},
			{
				id: 'chromatin',
				cell: 'animal',
				W: 100 * NM,
				c: chromatinC,
				draw: 'chromatin',
				focus: 'chromatin'
			},
			{
				id: 'dnaAtoms',
				cell: 'animal',
				W: 5 * NM,
				c: spot(chromatinC, ATOM_SPOTS.dna),
				draw: 'atoms',
				focus: 'dna'
			},
			{
				id: 'mitoView',
				cell: 'animal',
				W: 3 * UM,
				c: um([h.targets.mito.x, h.targets.mito.y]),
				focus: 'mitochondrion'
			},
			{
				id: 'crista',
				cell: 'animal',
				W: 100 * NM,
				c: cristaC,
				draw: 'crista',
				focus: 'atpSynthase'
			},
			{
				id: 'atpAtoms',
				cell: 'animal',
				W: 4 * NM,
				c: spot(cristaC, ATOM_SPOTS.atp),
				draw: 'atoms',
				focus: 'atp'
			},
			{ id: 'erView', cell: 'animal', W: 2 * UM, c: um(h.targets.erFace), focus: 'roughER' },
			{
				id: 'ribosome',
				cell: 'animal',
				W: 80 * NM,
				c: ribosomeC,
				draw: 'ribosome',
				focus: 'ribosome'
			},
			{
				id: 'edgeView',
				cell: 'animal',
				W: 1.5 * UM,
				c: add(membraneC, 0, 0.3 * UM),
				focus: 'plasmaMembrane'
			},
			{
				id: 'membrane',
				cell: 'animal',
				W: 50 * NM,
				c: membraneC,
				draw: 'membrane',
				focus: 'plasmaMembrane'
			},

			{ id: 'leaf', cell: 'plant', W: 400 * UM, c: [0, 0], draw: 'leaf', focus: 'leaf' },
			{
				id: 'mesophyll',
				cell: 'plant',
				W: 100 * UM,
				c: um(PLANT_TARGETS.cell),
				draw: 'mesophyll',
				focus: 'mesophyllCell'
			},
			{
				id: 'chloroplastView',
				cell: 'plant',
				W: 8 * UM,
				c: um(PLANT_TARGETS.chloroplast),
				focus: 'chloroplast'
			},
			{
				id: 'granumView',
				cell: 'plant',
				W: 1.2 * UM,
				c: um(PLANT_TARGETS.granum),
				focus: 'granum'
			},
			{
				id: 'thylakoid',
				cell: 'plant',
				W: 120 * NM,
				c: thylakoidC,
				draw: 'thylakoid',
				focus: 'psii'
			},
			{
				id: 'chlorophyllAtoms',
				cell: 'plant',
				W: 4 * NM,
				c: spot(thylakoidC, ATOM_SPOTS.chlorophyll),
				draw: 'atoms',
				focus: 'chlorophyll'
			},

			{ id: 'colony', cell: 'bacterium', W: 30 * UM, c: [0, 0], draw: 'colony', focus: 'colony' },
			{ id: 'ecoli', cell: 'bacterium', W: 3 * UM, c: [0, 0], draw: 'ecoli', focus: 'ecoli' },
			{
				id: 'cytoplasm',
				cell: 'bacterium',
				W: 150 * NM,
				c: cytoplasmC,
				draw: 'cytoplasm',
				focus: 'cytosol'
			},
			{
				id: 'glucoseAtoms',
				cell: 'bacterium',
				W: 4 * NM,
				c: spot(cytoplasmC, ATOM_SPOTS.glucose),
				draw: 'atoms',
				focus: 'glucose'
			}
		] satisfies Frame[]
	).map((f) => [f.id, f])
);

/** The branches the zoom can follow, by cell type: frame ids from the widest to the deepest. */
export const BRANCHES = {
	animal: {
		mitochondrion: ['liver', 'hepatocyte', 'mitoView', 'crista', 'atpAtoms'],
		nucleus: ['liver', 'hepatocyte', 'nucleusView', 'chromatin', 'dnaAtoms'],
		er: ['liver', 'hepatocyte', 'erView', 'ribosome'],
		membrane: ['liver', 'hepatocyte', 'edgeView', 'membrane']
	},
	plant: {
		chloroplast: [
			'leaf',
			'mesophyll',
			'chloroplastView',
			'granumView',
			'thylakoid',
			'chlorophyllAtoms'
		]
	},
	bacterium: {
		cytoplasm: ['colony', 'ecoli', 'cytoplasm', 'glucoseAtoms']
	}
} as const satisfies Record<CellType, Record<string, readonly string[]>>;

export type Branch = { [C in CellType]: keyof (typeof BRANCHES)[C] }[CellType];

export const DEFAULT_BRANCH: Record<CellType, string> = {
	animal: 'mitochondrion',
	plant: 'chloroplast',
	bacterium: 'cytoplasm'
};

/** Which branch selecting a structure leads into (structures not listed keep the current one). */
export const BRANCH_OF: Record<string, string> = {
	nucleus: 'nucleus',
	nucleolus: 'nucleus',
	nuclearPore: 'nucleus',
	nuclearEnvelope: 'nucleus',
	chromatin: 'nucleus',
	mitochondrion: 'mitochondrion',
	crista: 'mitochondrion',
	roughER: 'er',
	ribosome: 'er',
	plasmaMembrane: 'membrane',
	actin: 'membrane'
};

export function branchFrames(cell: CellType, branch: string): Frame[] {
	const b =
		(BRANCHES[cell] as Record<string, readonly string[]>)[branch] ??
		Object.values(BRANCHES[cell])[0];
	return b.map((id) => FRAMES[id]);
}

/** The narrowest and widest view of a branch, metres. */
export function zoomRange(chain: readonly Frame[]): [number, number] {
	return [chain.at(-1)!.W * 0.75, chain[0].W * 1.25];
}

export interface Camera {
	/** Centre of the view, metres. */
	x: number;
	y: number;
	/** Width of the view, metres. */
	f: number;
}

/**
 * The camera for a view `f` metres wide along `chain`: between frames k and
 * k + 1 it zooms about their fixed point Q, so that at f = W_k it shows frame k
 * and at f = W_{k+1} frame k + 1, exactly.
 */
export function cameraAt(chain: readonly Frame[], f: number): Camera {
	if (f >= chain[0].W) return { x: chain[0].c[0], y: chain[0].c[1], f };
	for (let k = 0; k + 1 < chain.length; k++) {
		const a = chain[k];
		const b = chain[k + 1];
		if (f > b.W) {
			const qx = (b.c[0] * a.W - a.c[0] * b.W) / (a.W - b.W);
			const qy = (b.c[1] * a.W - a.c[1] * b.W) / (a.W - b.W);
			const s = f / a.W;
			return { x: qx + (a.c[0] - qx) * s, y: qy + (a.c[1] - qy) * s, f };
		}
	}
	const last = chain.at(-1)!;
	return { x: last.c[0], y: last.c[1], f };
}

/**
 * How opaque a drawn frame is at view width f: it fades in as the view
 * narrows from 3 W to 1.25 W (on a log scale). The first frame is always opaque.
 */
export function fadeIn(frame: Frame, f: number, first: boolean) {
	if (first) return 1;
	const u = Math.log((3 * frame.W) / f) / Math.log(3 / 1.25);
	const v = Math.min(1, Math.max(0, u));
	return v * v * (3 - 2 * v);
}

export interface Layer {
	frame: Frame;
	opacity: number;
	/** Transform from the frame's own units to stage units. */
	scale: number;
	tx: number;
	ty: number;
	/** The reader can click this layer's structures. */
	interactive: boolean;
}

/**
 * The drawn frames to show for a camera, back to front: a frame is dropped
 * once the next drawn frame has fully faded in over it.
 */
export function layers(chain: readonly Frame[], cam: Camera): Layer[] {
	const drawn = chain.filter((fr) => fr.draw);
	const out: Layer[] = [];
	for (let i = 0; i < drawn.length; i++) {
		const fr = drawn[i];
		const opacity = fadeIn(fr, cam.f, i === 0);
		if (opacity <= 0) break;
		const next = drawn[i + 1];
		if (next && fadeIn(next, cam.f, false) >= 1) continue;
		const scale = fr.W / cam.f;
		// stage = 480 + (world − cam) · 960 / f, with world = c + (u − 480) · W / 960
		const k = STAGE.w / cam.f;
		out.push({
			frame: fr,
			opacity,
			scale,
			tx: STAGE.w / 2 + (fr.c[0] - cam.x) * k - (STAGE.w / 2) * scale,
			ty: STAGE.h / 2 + (fr.c[1] - cam.y) * k - (STAGE.h / 2) * scale,
			interactive: false
		});
	}
	// the front-most layer that is mostly visible takes the clicks
	for (let i = out.length - 1; i >= 0; i--)
		if (out[i].opacity > 0.5) {
			out[i].interactive = true;
			break;
		}
	return out;
}

/** The frame the view is "in": the deepest one whose width the view has reached (within 1.6×). */
export function currentFrame(chain: readonly Frame[], f: number): Frame {
	let cur = chain[0];
	for (const fr of chain) if (f <= fr.W * 1.6) cur = fr;
	return cur;
}
