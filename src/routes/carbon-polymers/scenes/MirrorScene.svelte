<script lang="ts">
	/**
	 * A molecule (left) and its mirror image (right), in 3D, across a mirror line. The reader
	 * turns the right-hand copy (drag, or the arrow keys); dashed rings on the right show
	 * where the left molecule's atoms are, and each group that lands in the ring of the same
	 * group lights up. The action `lineup` turns the copy (a quaternion slerp, one Tween) to
	 * line up two groups exactly (`alignTwo`), or, for an achiral molecule, to the best fit
	 * (`bestFit`), which then matches every group. The verdict comes from `bestFit` on the
	 * mirror image: a leftover mismatch means the molecule is chiral.
	 *
	 * Molecule: `hints.centre` (step `mirror`) or `params.centre` (step `handed`). The copy's
	 * rotation is scene state, reset when the molecule changes. Everything is drawn from a fixed
	 * camera, so nothing moves unless the reader turns it (or presses the button).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { startDrag, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CENTRES,
		IDENTITY,
		alignTwo,
		apply,
		axisAngle,
		bestFit,
		landsOn,
		matrixToQuat,
		mirror,
		mul,
		quatToMatrix,
		rs,
		slerp,
		type M3,
		type Quat,
		type V3
	} from '../chirality';
	import { ATOM, ballRadius, type DrawEl } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const centreId = $derived(String(step.hints?.centre ?? params.centre ?? 'alanine'));
	const centre = $derived(CENTRES.find((c) => c.id === centreId) ?? CENTRES[0]);

	// A fixed view that shows all four groups clearly (turn the stored geometry once).
	const VIEW: M3 = mul(axisAngle([1, 0, 0], -0.35), axisAngle([0, 1, 0], 0.5));
	const left = $derived(centre.groups.map((g) => apply(VIEW, g.pos)));
	const mirrored = $derived(left.map(mirror));
	// For the molecules drawn from data, H is the group a chemist looks along; pick the pair
	// to line up: H and F, H and COOH, or (achiral) everything.
	const pairToLine = $derived.by((): [number, number] => {
		const find = (l: string) => centre.groups.findIndex((g) => g.label === l);
		if (centre.id === 'alanine') return [find('H'), find('COOH')];
		return [find('H'), find('F')];
	});
	const plainFit = $derived(bestFit(mirrored, left));
	// CH₂FCl: its two hydrogens are interchangeable, so the best fit may swap them.
	const fit = $derived.by(() => {
		const iHs = centre.groups.map((g, i) => (g.label === 'H' ? i : -1)).filter((i) => i >= 0);
		if (iHs.length !== 2) return plainFit;
		const swapped = mirrored.map((p, i) =>
			i === iHs[0] ? mirrored[iHs[1]] : i === iHs[1] ? mirrored[iHs[0]] : p
		);
		const alt = bestFit(swapped, left);
		return alt.rms < plainFit.rms ? alt : plainFit;
	});
	/** Some leftover mismatch even at the best turn: chiral. */
	const chiral = $derived(fit.rms > 0.05);
	const superimposable = $derived(!chiral);

	// ---- the reader's turn of the copy
	let rot = $state<M3>(IDENTITY);
	const anim = new Tween(1, { duration: 900, easing: cubicInOut });
	let q0: Quat = [1, 0, 0, 0];
	let q1: Quat = [1, 0, 0, 0];
	// Until the reader touches it, the copy rocks gently from side to side (a pure function of
	// t; still under reduced motion), inviting a turn.
	let touched = $state(false);
	const rock = $derived(touched || reduced ? 0 : 0.35 * Math.sin(0.7 * t));
	const current = $derived(
		mul(
			axisAngle([0, 1, 0], rock),
			anim.current < 1 ? quatToMatrix(slerp(q0, q1, anim.current)) : rot
		)
	);

	// Reset when the molecule changes.
	$effect(() => {
		void centreId;
		untrack(() => {
			rot = IDENTITY;
			touched = false;
			anim.set(1, { duration: 0 });
		});
	});
	// The "line up" button.
	const pressed = $derived(Number(params.lineup ?? 0));
	let lastPressed = -1;
	$effect(() => {
		const n = pressed;
		untrack(() => {
			if (lastPressed < 0 || n === lastPressed) {
				lastPressed = n;
				return;
			}
			lastPressed = n;
			touched = true;
			const target = superimposable
				? fit.R
				: alignTwo(mirrored, left, pairToLine[0], pairToLine[1]);
			q0 = matrixToQuat(current);
			q1 = matrixToQuat(target);
			rot = target;
			anim.set(0, { duration: 0 });
			anim.set(1, { duration: reduced ? 0 : 900 });
		});
	});

	let last: Point | null = null;
	function settle() {
		// Take over from the rocking or the animation where it is now.
		rot = current;
		touched = true;
		anim.set(1, { duration: 0 });
	}
	function spin(dx: number, dy: number) {
		settle();
		rot = mul(mul(axisAngle([0, 1, 0], dx), axisAngle([1, 0, 0], dy)), rot);
	}
	function turn(e: PointerEvent) {
		startDrag(
			e,
			(p) => {
				if (last) spin((p.x - last.x) * 0.012, (p.y - last.y) * 0.012);
				last = p;
			},
			() => (last = null)
		);
	}
	function turnKey(e: KeyboardEvent) {
		const s = e.shiftKey ? 0.5 : 0.15;
		if (e.key === 'ArrowLeft') spin(-s, 0);
		else if (e.key === 'ArrowRight') spin(s, 0);
		else if (e.key === 'ArrowUp') spin(0, -s);
		else if (e.key === 'ArrowDown') spin(0, s);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	// ---- drawing (orthographic, x right, y up, z towards the viewer)
	const PX = 100; // px per Å
	const LX = 250;
	const RXc = 700;
	const CY = 300;
	const moved = $derived(mirrored.map((p) => apply(current, p)));
	const lands = $derived(landsOn(moved, left, 0.35));
	// A group matches when it sits in the ring of a group with the same label.
	const matched = $derived(
		lands.map((j, i) => j >= 0 && centre.groups[j].label === centre.groups[i].label)
	);
	const count = $derived(matched.filter(Boolean).length);

	const look = (g: { el: string }): DrawEl => (g.el in ATOM ? (g.el as DrawEl) : 'C');
	const radius = (g: { el: string; label: string }) =>
		g.label.length > 2 ? 26 : ballRadius(look(g), 1.25);
	interface Drawn {
		key: string;
		x: number;
		y: number;
		z: number;
		i: number;
	}
	const draw = (pts: V3[], cx: number, tag: string): Drawn[] =>
		pts
			.map((p, i) => ({ key: `${tag}${i}`, x: cx + p[0] * PX, y: CY - p[1] * PX, z: p[2], i }))
			.sort((a, b) => a.z - b.z);
	const leftAtoms = $derived(draw(left, LX, 'l'));
	const rightAtoms = $derived(draw(moved, RXc, 'r'));
	const ghosts = $derived(draw(left, RXc, 'g'));

	const ordered = $derived.by(() => {
		// CIP priorities for the R/S label.
		const pri: Record<string, number> = { Br: 4, Cl: 3, F: 2, 'NH₂': 3, COOH: 2, 'CH₃': 1, H: 0 };
		const idx = centre.groups
			.map((g, i) => ({ i, p: pri[g.label] ?? 0 }))
			.sort((a, b) => b.p - a.p)
			.map((x) => x.i);
		return idx;
	});
	const label = (pts: V3[]) => rs(ordered.map((i) => pts[i]));
	const leftName = $derived(
		!chiral ? '' : centre.id === 'alanine' ? `L-alanine (${label(left)})` : `(${label(left)})`
	);
	const rightName = $derived(
		!chiral
			? ''
			: centre.id === 'alanine'
				? `D-alanine (${label(mirrored)})`
				: `(${label(mirrored)})`
	);
	const verdict = $derived(
		superimposable
			? count === 4
				? 'All four line up: the same molecule'
				: 'It can be turned to fit: not chiral'
			: count >= 2
				? `${count} of 4 line up, and that is the best you can do`
				: `${count} of 4 groups line up`
	);
</script>

{#snippet ball(d: Drawn, pts: 'left' | 'right')}
	{@const g = centre.groups[d.i]}
	{@const r = radius(g)}
	{@const lk = ATOM[look(g)]}
	{@const cx = pts === 'left' ? LX : RXc}
	{@const len = Math.hypot(d.x - cx, d.y - CY) || 1}
	<!-- a bond in front of the carbon starts at its edge, so the carbon stays legible -->
	{@const off = d.z >= 0 ? Math.min(ballRadius('C', 1.25), len) : 0}
	<line
		x1={cx + ((d.x - cx) / len) * off}
		y1={CY + ((d.y - CY) / len) * off}
		x2={d.x}
		y2={d.y}
		stroke="var(--stage-ink-muted)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<circle
		cx={d.x}
		cy={d.y}
		{r}
		fill={lk.fill}
		stroke={pts === 'right' && matched[d.i] ? 'var(--cp-group)' : lk.edge}
		stroke-width={pts === 'right' && matched[d.i] ? 3 : 1.5}
	/>
	<circle cx={d.x - r * 0.3} cy={d.y - r * 0.32} r={r * 0.36} fill="#ffffff" opacity="0.22" />
	<text
		x={d.x}
		y={d.y + (g.label.length > 2 ? 4.5 : r * 0.36)}
		text-anchor="middle"
		font-weight="700"
		font-size={g.label.length > 2 ? 12.5 : Math.max(11, r * 0.95)}
		style:fill={lk.ink}>{g.label}</text
	>
{/snippet}

{#snippet carbon(cx: number)}
	<circle
		{cx}
		cy={CY}
		r={ballRadius('C', 1.25)}
		fill={ATOM.C.fill}
		stroke={ATOM.C.edge}
		stroke-width="1.5"
	/>
	<text
		x={cx}
		y={CY + 5}
		text-anchor="middle"
		font-weight="700"
		font-size="14"
		style:fill={ATOM.C.ink}>C</text
	>
{/snippet}

<g>
	<!-- the mirror -->
	<line
		x1="475"
		x2="475"
		y1="92"
		y2="500"
		stroke="var(--cp-mirror)"
		stroke-width="2"
		stroke-dasharray="8 6"
	/>
	<Readout id="mirror-label">
		<text x="475" y="84" text-anchor="middle" class="halo muted" font-size="12">mirror</text>
	</Readout>

	<!-- left: the molecule -->
	<g style:pointer-events="none">
		{#each leftAtoms.filter((d) => d.z < 0) as d (d.key)}{@render ball(d, 'left')}{/each}
		{@render carbon(LX)}
		{#each leftAtoms.filter((d) => d.z >= 0) as d (d.key)}{@render ball(d, 'left')}{/each}
	</g>

	<!-- right: the mirror image, turnable -->
	<rect
		class="turn"
		x={RXc - 200}
		y="96"
		width="400"
		height="400"
		rx="16"
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Turn the mirror image: drag, or use the arrow keys"
		aria-valuemin={0}
		aria-valuemax={4}
		aria-valuenow={count}
		aria-valuetext="{count} of 4 groups lined up"
		onpointerdown={turn}
		onkeydown={turnKey}
	/>
	<g style:pointer-events="none">
		{#each ghosts as d (d.key)}
			{@const g = centre.groups[d.i]}
			<circle
				cx={d.x}
				cy={d.y}
				r={radius(g) + 5}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="4 4"
				opacity="0.75"
			/>
		{/each}
		{#each rightAtoms.filter((d) => d.z < 0) as d (d.key)}{@render ball(d, 'right')}{/each}
		{@render carbon(RXc)}
		{#each rightAtoms.filter((d) => d.z >= 0) as d (d.key)}{@render ball(d, 'right')}{/each}
	</g>

	<!-- captions -->
	<g style:pointer-events="none">
		<Readout id="left-name" order={1} label="Left" value={`${centre.name} ${leftName}`.trim()}>
			<text x={LX} y="44" text-anchor="middle" class="halo" font-weight="700" font-size="16"
				>{centre.name}</text
			>
			<text x={LX} y="64" text-anchor="middle" class="halo muted" font-size="12"
				>{leftName || centre.formula}</text
			>
		</Readout>
		<Readout
			id="right-name"
			order={2}
			label="Right"
			value={rightName ? `mirror image ${rightName}` : 'mirror image'}
		>
			<text x={RXc} y="44" text-anchor="middle" class="halo" font-weight="700" font-size="16"
				>its mirror image</text
			>
			<text x={RXc} y="64" text-anchor="middle" class="halo muted" font-size="12"
				>{rightName || 'drag to turn it'}</text
			>
		</Readout>
		<Readout
			id="verdict"
			order={0}
			label="Lined up"
			value={verdict}
			color={count === 4 ? 'var(--cp-group)' : undefined}
		>
			<text
				x="480"
				y="540"
				text-anchor="middle"
				class="halo"
				font-weight="700"
				font-size="16"
				style:fill={count === 4 ? 'var(--cp-group)' : undefined}>{verdict}</text
			>
		</Readout>
		<Readout
			id="verdict-2"
			order={3}
			label="Verdict"
			value={chiral ? 'chiral: can’t be superimposed' : 'not chiral'}
		>
			<text x="480" y="562" text-anchor="middle" class="halo muted" font-size="12"
				>{chiral
					? 'Four different groups: no turn puts the copy on the original (chiral)'
					: 'Two groups are the same: a turn puts the copy on the original'}</text
			>
		</Readout>
		<Readout id="rings">
			<text x={RXc} y="520" text-anchor="middle" class="halo muted" font-size="11"
				>dashed rings: where the left molecule’s atoms are</text
			>
		</Readout>
		<Readout id="source">
			<text x={LX} y="520" text-anchor="middle" class="halo muted" font-size="11"
				>{centre.source}</text
			>
		</Readout>
	</g>
</g>

<style>
	.turn {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.turn:active {
		cursor: grabbing;
	}
	.turn:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
