<script lang="ts">
	/**
	 * Side view of a bar magnet held upright over a table, red (north) end down. On the clips step
	 * it is lowered over a heap of steel paper clips: once its end comes within jumping distance a
	 * clip leaps up, becomes a magnet itself (its ends take the poles the model gives) and holds a
	 * chain. On the metals step it hangs just above one object, and picks it up only if the
	 * object's metal is one a magnet pulls.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, cubicOut } from 'svelte/easing';
	import { Label, hash, startDrag, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CLIP_JUMP, MATERIALS, inducedNearPole, type Magnet, type Material } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'clips'));
	const height = $derived(Number(params.height ?? 6));
	const material = $derived(String(params.material ?? 'nail') as Material);
	const info = $derived(MATERIALS[material] ?? MATERIALS.nail);

	// ---- one scale: 32 px per centimetre ---------------------------------------------------------
	const U = 32;
	const TABLE = 540;
	const MX = 330;
	const MAG_L = 6 * U;
	const MAG_W = 1.2 * U;
	/** Top of the heap of clips (and of the object on the metals step), px. */
	const HEAP_TOP = TABLE - 1.2 * U;
	const CLIP_L = 2.2 * U;
	const CLIP_W = 0.8 * U;

	// On the metals step the magnet is held just above the object, and lifted once it has caught it.
	const magBottomTarget = $derived(
		phase === 'metals' ? (info.magnetic ? TABLE - 8 * U : TABLE - 50 - U) : HEAP_TOP - height * U
	);
	const magBottom = Tween.of(() => magBottomTarget, { duration: 500, easing: cubicInOut });
	const bottom = $derived(reduced ? magBottomTarget : magBottom.current);

	// ---- clips: caught once the magnet has come close enough, and kept when it is lifted ---------
	let caught = $state(untrack(() => Number(params.height ?? 6) <= CLIP_JUMP));
	$effect(() => {
		if (phase === 'clips' && height <= CLIP_JUMP) untrack(() => (caught = true));
	});
	const jump = new Tween(
		untrack(() => (caught ? 1 : 0)),
		{ duration: 450, easing: cubicOut }
	);
	$effect(() => {
		const c = caught;
		untrack(() => void jump.set(c ? 1 : 0, reduced ? { duration: 0 } : undefined));
	});
	const CHAIN = 3;
	/**
	 * The chain hangs from the magnet's end, as long as the room above the table allows; with the
	 * magnet right down in the heap, the first clip clings to its end sideways.
	 */
	const chain = $derived.by(() => {
		if (!caught) return [];
		const out = [];
		for (let i = 0; i < CHAIN; i++) {
			const top = bottom + i * (CLIP_L - 6);
			const fits = top + CLIP_L <= TABLE - 4;
			if (i > 0 && !fits) break;
			const sway = reduced ? 0 : (wave(t, 2.4, i * 0.2) - 0.5) * 3;
			out.push(
				fits
					? { i, cy: top + CLIP_L / 2, sway, rot: 0 }
					: { i, cy: bottom + CLIP_W / 2 + 1, sway: 0, rot: 90 }
			);
		}
		return out;
	});
	// Which pole the clip's top end becomes, from the field of the magnet just above it.
	const magnet: Magnet = { x: 0, y: 0, angle: Math.PI / 2, length: 6 };
	const clipTop = inducedNearPole(magnet, { x: 0, y: 3.1 }, { x: 0, y: 3 + 2.2 });

	// The heap: clips lying about in a mound (one fewer once one has jumped up).
	const heap = Array.from({ length: 9 }, (_, i) => ({
		i,
		x: MX + (hash(i, 2) - 0.5) * 120,
		y: TABLE - 10 - hash(i, 5) * 22 - (1 - Math.abs(hash(i, 2) - 0.5) * 2) * 10,
		a: 60 + hash(i, 9) * 60
	}));

	// ---- metals ---------------------------------------------------------------------------------
	const pickTarget = $derived(phase === 'metals' && info.magnetic ? 1 : 0);
	const pick = Tween.of(() => pickTarget, { duration: 450, easing: cubicOut });
	const lift = $derived(reduced ? pickTarget : pick.current);
	/**
	 * The object's size, px: its height when it hangs from the magnet's end, and its width, which
	 * is how tall it is while it lies on its side on the table.
	 */
	const OBJ: Record<Material, { h: number; w: number }> = {
		nail: { h: 110, w: 30 },
		clip: { h: CLIP_L, w: CLIP_W },
		nickel: { h: 80, w: 22 },
		spoon: { h: 120, w: 34 },
		foil: { h: 46, w: 46 },
		copper: { h: 52, w: 46 },
		gold: { h: 44, w: 44 }
	};
	const obj = $derived(OBJ[material] ?? OBJ.nail);
	const objH = $derived(obj.h);
	/** Centre of the object, px: lying on the table, or hanging from the magnet's end. */
	const objY = $derived((TABLE - obj.w / 2) * (1 - lift) + (bottom + objH / 2 + 1) * lift);
	const objRot = $derived(90 * (1 - lift));

	// ---- dragging the magnet up and down -----------------------------------------------------------
	function setHeight(h: number) {
		setParam('height', Math.round(Math.max(0, Math.min(8, h)) * 2) / 2);
	}
	function drag(e: PointerEvent) {
		const start = height;
		let y0: number | null = null;
		startDrag(e, (p) => {
			if (y0 === null) y0 = p.y;
			setHeight(start + (y0 - p.y) / U);
		});
	}
	function key(e: KeyboardEvent) {
		const d: Record<string, number> = {
			ArrowUp: 0.5,
			ArrowRight: 0.5,
			ArrowDown: -0.5,
			ArrowLeft: -0.5
		};
		if (e.key === 'Home') setHeight(0);
		else if (e.key === 'End') setHeight(8);
		else if (d[e.key] !== undefined) setHeight(height + d[e.key]);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	function clipPath(l: number, w: number) {
		const r1 = w / 3;
		const r2 = w / 2;
		return [
			`M${-w / 6} ${-l / 2 + w * 0.9}`,
			`L${-w / 6} ${l / 2 - r1}`,
			`A${r1} ${r1} 0 0 0 ${w / 2} ${l / 2 - r1}`,
			`L${w / 2} ${-l / 2 + r2}`,
			`A${r2} ${r2} 0 0 0 ${-w / 2} ${-l / 2 + r2}`,
			`L${-w / 2} ${l / 2 - w * 0.6}`,
			`A${r1} ${r1} 0 0 0 ${w / 6} ${l / 2 - w * 0.6}`,
			`L${w / 6} ${-l / 2 + w * 1.4}`
		].join(' ');
	}
	const CLIP = clipPath(CLIP_L, CLIP_W);
	const SMALL_CLIP = clipPath(CLIP_L * 0.9, CLIP_W * 0.9);

	const headline = $derived.by(() => {
		if (phase === 'metals')
			return info.magnetic
				? `${info.name}: the magnet picks it up`
				: `${info.name}: the magnet ignores it`;
		if (!caught)
			return height > CLIP_JUMP + 1 ? 'too far: the pull is too weak' : 'nearly close enough…';
		return chain.length > 1
			? `a chain of ${chain.length} clips: each one is a magnet now`
			: 'a clip jumped up: it is a magnet now';
	});
	const sub = $derived(
		phase === 'metals'
			? info.magnetic
				? 'iron, nickel, cobalt and most steels are pulled'
				: 'most metals are not pulled at all'
			: caught && chain.length < 2
				? 'lift the magnet to see the chain'
				: caught
					? 'a blue end under each red end: unlike ends pull'
					: 'lower the magnet'
	);
</script>

<g class="mg-clips">
	<!-- the table -->
	<rect x="16" y={TABLE} width="928" height="44" rx="6" fill="var(--mg-board)" />
	<line x1="16" y1={TABLE} x2="944" y2={TABLE} stroke="var(--stage-ink-muted)" stroke-width="2" />

	<!-- the heap of clips -->
	{#if phase === 'clips'}
		{#each heap.slice(chain.length) as c (c.i)}
			<path
				d={SMALL_CLIP}
				transform="translate({c.x} {c.y}) rotate({c.a})"
				fill="none"
				stroke="var(--mg-steel)"
				stroke-width="3"
				stroke-linecap="round"
			/>
		{/each}
	{/if}

	<!-- the holder and the magnet, red (north) end down -->
	<line
		x1={MX}
		y1={bottom - MAG_L - 4}
		x2={MX}
		y2="16"
		stroke="var(--stage-ink-muted)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<g transform="translate({MX} {bottom - MAG_L / 2})">
		<rect
			x={-MAG_W / 2}
			y={-MAG_L / 2}
			width={MAG_W}
			height={MAG_L / 2}
			rx="4"
			fill="var(--mg-south)"
			filter="url(#soft-shadow)"
		/>
		<rect x={-MAG_W / 2} y="0" width={MAG_W} height={MAG_L / 2} rx="4" fill="var(--mg-north)" />
		<rect x={-MAG_W / 2} y="0" width={MAG_W} height="4" fill="var(--mg-north)" />
		<text x="0" y={-MAG_L / 4 + 6} text-anchor="middle" font-size="17" font-weight="700" fill="#fff"
			>S</text
		>
		<text x="0" y={MAG_L / 4 + 6} text-anchor="middle" font-size="17" font-weight="700" fill="#fff"
			>N</text
		>
	</g>
	{#if phase === 'clips'}
		<rect
			class="mg-drag"
			x={MX - MAG_W / 2 - 10}
			y={bottom - MAG_L - 6}
			width={MAG_W + 20}
			height={MAG_L + 12}
			rx="8"
			fill="transparent"
			stroke="var(--focus)"
			stroke-width="1.5"
			stroke-dasharray="5 5"
			role="slider"
			tabindex="0"
			aria-label="Magnet height"
			aria-valuenow={height}
			aria-valuetext={`${height} cm above the clips`}
			aria-valuemin={0}
			aria-valuemax={8}
			onpointerdown={drag}
			onkeydown={key}
		/>
	{/if}

	<!-- the chain: each clip a magnet, blue end up under a red end -->
	{#if phase === 'clips'}
		{#each chain as c (c.i)}
			{@const fromY = HEAP_TOP + 10}
			{@const y = c.i === 0 ? fromY + (c.cy - fromY) * jump.current : c.cy}
			<g
				transform="translate({MX + c.sway} {y}) rotate({c.rot})"
				opacity={c.i === 0 ? 1 : jump.current}
			>
				<path
					d={CLIP}
					fill="none"
					stroke="var(--mg-steel)"
					stroke-width="3.5"
					stroke-linecap="round"
				/>
				{#if c.rot === 0}
					<circle
						cx="0"
						cy={-CLIP_L / 2 + 4}
						r="5"
						fill={clipTop === 'S' ? 'var(--mg-south)' : 'var(--mg-north)'}
					/>
					<circle
						cx="0"
						cy={CLIP_L / 2 - 4}
						r="5"
						fill={clipTop === 'S' ? 'var(--mg-north)' : 'var(--mg-south)'}
					/>
				{/if}
			</g>
		{/each}
		{#if caught}
			<Readout id="mg-chain-note">
				<Label
					x={MX + 44}
					y={Math.min(bottom + 40, HEAP_TOP - 24)}
					text="blue end up, red end down"
					anchor="start"
					size={14}
					muted
					opacity={jump.current}
				/>
			</Readout>
		{/if}
	{/if}

	<!-- the metals step: one object, picked up or left on the table -->
	{#if phase === 'metals'}
		<g transform="translate({MX} {objY}) rotate({objRot})">
			{#if material === 'nail'}
				<rect x="-5" y={-objH / 2 + 7} width="10" height={objH - 20} fill="var(--mg-steel)" />
				<rect x="-15" y={-objH / 2} width="30" height="8" rx="2" fill="var(--mg-steel)" />
				<path d="M-5 {objH / 2 - 13} L0 {objH / 2} L5 {objH / 2 - 13} Z" fill="var(--mg-steel)" />
			{:else if material === 'clip'}
				<path
					d={CLIP}
					fill="none"
					stroke="var(--mg-steel)"
					stroke-width="3.5"
					stroke-linecap="round"
				/>
			{:else if material === 'nickel'}
				<rect
					x="-11"
					y={-objH / 2}
					width="22"
					height={objH}
					rx="2"
					fill="var(--mg-nickel)"
					stroke="var(--mg-steel)"
				/>
			{:else if material === 'spoon'}
				<ellipse cx="0" cy={-objH / 2 + 24} rx="17" ry="24" fill="var(--mg-spoon)" />
				<rect
					x="-4"
					y={-objH / 2 + 42}
					width="8"
					height={objH - 42}
					rx="3"
					fill="var(--mg-spoon)"
				/>
			{:else if material === 'foil'}
				<path
					d="M-23 5 L-16 -15 L0 -22 L18 -14 L23 4 L14 19 L-5 22 L-20 15 Z"
					fill="var(--mg-foil)"
					stroke="var(--mg-steel)"
				/>
			{:else if material === 'copper'}
				{#each [-12, -4, 4, 12] as dx (dx)}
					<ellipse
						cx={dx}
						cy="0"
						rx="8"
						ry="23"
						fill="none"
						stroke="var(--mg-copper)"
						stroke-width="3"
					/>
				{/each}
			{:else}
				<ellipse
					cx="0"
					cy="0"
					rx="18"
					ry="18"
					fill="none"
					stroke="var(--mg-gold)"
					stroke-width="6"
				/>
			{/if}
		</g>
		<Readout id="mg-obj-name">
			<Label x={MX + 70} y={objY + 5} text={info.name} anchor="start" size={15} weight={600} />
		</Readout>
	{/if}

	<!-- readouts -->
	<Readout id="mg-clip-head" order={1} label="Magnet" value={headline}>
		<Label x={620} y={60} text={headline} anchor="middle" size={20} weight={700} />
	</Readout>
	<Readout id="mg-clip-sub" order={2} label="Note" value={sub}>
		<Label x={620} y={90} text={sub} anchor="middle" size={14} muted />
	</Readout>
	{#if phase === 'clips'}
		<Readout
			id="mg-height"
			order={3}
			label="Height"
			value={height === 0 ? 'touching the clips' : `${height} cm above the clips`}
		>
			<Label
				x={620}
				y={116}
				text={height === 0 ? 'touching the clips' : `${height} cm above the clips`}
				anchor="middle"
				size={14}
				muted
				tabular
			/>
		</Readout>
	{/if}
</g>

<style>
	.mg-drag {
		cursor: ns-resize;
		touch-action: none;
		outline: none;
	}
	.mg-drag:focus-visible {
		stroke-width: 3;
	}
</style>
