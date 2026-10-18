<script lang="ts">
	/**
	 * One cycle as a storyboard: four panels (start, heat, cool, warm), each showing the template
	 * at the end of its stage, under the cycle's temperature profile and a thermometer. The
	 * current stage is in focus and plays out (strands parting, primers landing, new strands
	 * growing); the others stay dimmed at their end state.
	 *
	 * "Go round by itself" (`params.auto`) steps through the stages every 3 s and writes the
	 * stage back to the slider (disabled meanwhile); with it off the slider picks the stage and a
	 * Tween plays it out. Reduced motion shows the finished cycle.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LAYOUT } from '../pcr';

	let { t, params, reduced, setParam }: StageProps = $props();

	const STAGE_S = 3;
	const NAMES = ['Start', 'Heat', 'Cool', 'Warm'];
	const TEMPS = [72, 95, 55, 72];
	const WHAT = [
		'one double strand',
		'the strands come apart',
		'primers pair at the ends',
		'the polymerase copies'
	];

	const auto = $derived(params.auto === true);
	const manual = $derived(Math.max(0, Math.min(3, Math.round(Number(params.stage ?? 3)))));

	// auto: the stage from the clock; reduced motion: the finished cycle
	const autoStage = $derived(reduced ? 3 : Math.floor((t % (4 * STAGE_S)) / STAGE_S));
	const current = $derived(auto ? autoStage : manual);
	$effect(() => {
		const s = autoStage;
		if (auto) untrack(() => setParam('stage', s));
	});

	// manual: play the chosen stage out
	const prog = new Tween(1, { duration: 1400, easing: cubicInOut });
	$effect(() => {
		void manual;
		if (auto) return;
		untrack(() => {
			if (reduced) {
				void prog.set(1, { duration: 0 });
				return;
			}
			void prog.set(0, { duration: 0 });
			void prog.set(1);
		});
	});
	const local = $derived(
		reduced ? 1 : auto ? smoothstep(0.1, 0.75, (t % STAGE_S) / STAGE_S) : prog.current
	);
	const progress = (k: number) => (k === current ? local : 1);

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 90;
	const COL = 205;
	const colX = (k: number) => X0 + k * COL;
	const W = 170;
	const { length: L, a, b, lf, lr } = LAYOUT;
	const sx = (k: number, pos: number) => colX(k) + (COL - W) / 2 + (pos / L) * W;

	// temperature profile
	const PT = 66;
	const PB = 178;
	const ty = (T: number) => lerp(PB, PT, (T - 40) / 60);
	const profile = $derived.by(() => {
		const segs: { d: string; color: string }[] = [];
		const colors = ['var(--pcr-warm)', 'var(--pcr-hot)', 'var(--pcr-cool)', 'var(--pcr-warm)'];
		for (let k = 0; k < 4; k++) {
			const x0 = colX(k);
			const from = k === 0 ? TEMPS[0] : TEMPS[k - 1];
			const ramp = k === 0 ? 0 : 0.18 * COL;
			segs.push({
				d: `M${x0} ${ty(from)} L${x0 + ramp} ${ty(TEMPS[k])} L${x0 + COL} ${ty(TEMPS[k])}`,
				color: colors[k]
			});
		}
		return segs;
	});
	/** Where the cycle is: along the current column's profile. */
	const now = $derived.by(() => {
		const k = current;
		const p = local;
		const from = k === 0 ? TEMPS[0] : TEMPS[k - 1];
		const u = 0.05 + 0.9 * p;
		const ramp = k === 0 ? 0 : 0.18;
		const T = ramp === 0 || u >= ramp ? TEMPS[k] : lerp(from, TEMPS[k], u / ramp);
		return { x: colX(k) + u * COL, T };
	});

	// ---- the molecules of each panel ---------------------------------------------------------
	const MID = 400;
	/** Half the gap between the two strands: paired (6) or apart (54). */
	const gap = (k: number) => (k === 0 ? 6 : k === 1 ? lerp(6, 54, progress(1)) : 54);
	const rungs = Array.from({ length: 21 }, (_, i) => (i * L) / 20);

	/** A primer's path from the liquid to its site, with the stage's progress. */
	function primerAt(k: number, side: 'f' | 'r') {
		const p = k === 2 ? progress(2) : 1;
		const home =
			side === 'f'
				? { x: sx(k, a), y: MID + gap(k) - 10, w: (lf / L) * W }
				: { x: sx(k, b - lr), y: MID - gap(k) + 10, w: (lr / L) * W };
		const off = side === 'f' ? { x: -24, y: 70 } : { x: 24, y: -70 };
		const e = smoothstep(0, 1, p);
		return { x: home.x + off.x * (1 - e), y: home.y + off.y * (1 - e), w: home.w, o: e };
	}
	/** The new strands of the warm stage, growing from the primers to the template's ends. */
	const grown = $derived(smoothstep(0, 1, progress(3)));
</script>

<g>
	<!-- ---------------------------------------------------------------- thermometer -->
	<g>
		<rect
			x="34"
			y={PT - 12}
			width="16"
			height={PB - PT + 22}
			rx="8"
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
		/>
		<circle cx="42" cy={PB + 22} r="13" fill="var(--pcr-hot)" />
		<rect
			x="38"
			y={ty(now.T)}
			width="8"
			height={PB + 14 - ty(now.T)}
			rx="4"
			fill="var(--pcr-hot)"
		/>
	</g>
	<Readout id="temp" order={1} label={NAMES[current]} value="{Math.round(now.T)} °C">
		<Label
			anchor="start"
			x={X0}
			y={40}
			text="{NAMES[current]} · {Math.round(now.T)} °C"
			size={16}
			weight={700}
			tabular
		/>
	</Readout>
	{#each [95, 72, 55] as T (T)}
		<line
			x1={X0}
			x2={X0 + 4 * COL}
			y1={ty(T)}
			y2={ty(T)}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<Readout id="tick-{T}">
			<Label x={X0 + 4 * COL + 6} y={ty(T) + 4} text="{T} °C" size={11} muted anchor="start" />
		</Readout>
	{/each}
	{#each profile as s, k (k)}
		<path
			d={s.d}
			fill="none"
			stroke={s.color}
			stroke-width="3"
			opacity={k === current ? 1 : 0.45}
		/>
	{/each}
	<circle
		cx={now.x}
		cy={ty(now.T)}
		r="7"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>

	<!-- ---------------------------------------------------------------- panels -->
	{#each [0, 1, 2, 3] as k (k)}
		{@const focus = k === current}
		{@const g = gap(k)}
		<g opacity={focus ? 1 : 0.55}>
			<rect
				x={colX(k) + 6}
				y={214}
				width={COL - 12}
				height={340}
				rx="12"
				fill={focus ? 'var(--surface)' : 'none'}
				stroke={focus ? 'var(--border)' : 'var(--stage-grid)'}
			/>
			<Readout
				id="title-{k}"
				order={4 + k}
				label="{k + 1}. {NAMES[k]}{k === 0 ? '' : ` ${TEMPS[k]} °C`}: {WHAT[k]}"
				marker={k + 1}
				at={[colX(k) + COL / 2, 244]}
			>
				<Label
					x={colX(k) + COL / 2}
					y={244}
					text="{k + 1}. {NAMES[k]}{k === 0 ? '' : ` · ${TEMPS[k]} °C`}"
					size={14}
					weight={600}
					halo={false}
				/>
				<Label x={colX(k) + COL / 2} y={264} text={WHAT[k]} size={12} muted halo={false} />
			</Readout>

			<!-- the chosen stretch -->
			<rect
				x={sx(k, a)}
				y={MID - 74}
				width={sx(k, b) - sx(k, a)}
				height={148}
				fill="var(--pcr-target)"
				opacity="0.08"
			/>
			<!-- rungs while paired -->
			{#if g < 20}
				{#each rungs as r (r)}
					<line
						x1={sx(k, r)}
						x2={sx(k, r)}
						y1={MID - g}
						y2={MID + g}
						stroke="var(--pcr-template)"
						stroke-width="1"
						opacity={1 - g / 20}
					/>
				{/each}
			{/if}
			<!-- the template's two strands -->
			<line
				x1={sx(k, 0)}
				x2={sx(k, L)}
				y1={MID - g}
				y2={MID - g}
				stroke="var(--pcr-template)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<line
				x1={sx(k, 0)}
				x2={sx(k, L)}
				y1={MID + g}
				y2={MID + g}
				stroke="var(--pcr-template)"
				stroke-width="3"
				stroke-linecap="round"
			/>

			{#if k >= 2}
				{#each ['f', 'r'] as const as side (side)}
					{@const p = primerAt(k, side)}
					<line
						x1={p.x}
						x2={p.x + p.w}
						y1={p.y}
						y2={p.y}
						stroke="var(--pcr-primer)"
						stroke-width="4"
						stroke-linecap="round"
						opacity={0.3 + 0.7 * p.o}
					/>
				{/each}
			{/if}
			{#if k === 3}
				{@const fEnd = lerp(a + lf, L, grown)}
				{@const rEnd = lerp(b - lr, 0, grown)}
				<!-- the new top strand grows rightwards from the forward primer, the new bottom
				     strand leftwards from the reverse primer -->
				{#if grown > 0.01}
					<line
						x1={sx(k, a + lf)}
						x2={sx(k, fEnd)}
						y1={MID + g - 10}
						y2={MID + g - 10}
						stroke="var(--pcr-long)"
						stroke-width="3"
						stroke-linecap="round"
					/>
					<line
						x1={sx(k, rEnd)}
						x2={sx(k, b - lr)}
						y1={MID - g + 10}
						y2={MID - g + 10}
						stroke="var(--pcr-long)"
						stroke-width="3"
						stroke-linecap="round"
					/>
				{/if}
				{#if grown < 0.99}
					<ellipse
						cx={sx(k, fEnd)}
						cy={MID + g - 10}
						rx="11"
						ry="8"
						fill="var(--protein)"
						stroke="var(--protein-edge)"
					/>
					<ellipse
						cx={sx(k, rEnd)}
						cy={MID - g + 10}
						rx="11"
						ry="8"
						fill="var(--protein)"
						stroke="var(--protein-edge)"
					/>
				{/if}
			{/if}

			<Readout id="note-{k}">
				{#if k === 0}
					<Label x={colX(k) + COL / 2} y={520} text="2 strands" size={13} weight={600} />
				{:else if k === 1}
					<Label x={colX(k) + COL / 2} y={520} text="2 single strands" size={13} />
				{:else if k === 2}
					<Label x={colX(k) + COL / 2} y={520} text="one primer per strand" size={13} />
				{:else}
					<Label
						x={colX(k) + COL / 2}
						y={520}
						text="4 strands: 2 double strands"
						size={13}
						weight={600}
						opacity={smoothstep(0.7, 1, grown)}
					/>
				{/if}
			</Readout>
		</g>
	{/each}

	<!-- the key under the panels -->
	<Readout
		id="key"
		order={3}
		label="Grey: template; blue: primers; amber: new copies, which run past the stretch (shaded)"
	>
		<g>
			{#each [{ c: 'var(--pcr-template)', t: 'template' }, { c: 'var(--pcr-primer)', t: 'primer' }, { c: 'var(--pcr-long)', t: 'new strand, runs past the stretch' }, { c: 'var(--pcr-target)', t: 'chosen stretch' }] as item, i (item.t)}
				{@const x = [X0 + 10, X0 + 140, X0 + 260, X0 + 560][i]}
				<rect
					{x}
					y={575}
					width="22"
					height={item.t === 'chosen stretch' ? 12 : 4}
					rx="2"
					fill={item.c}
					opacity={item.t === 'chosen stretch' ? 0.25 : 1}
					transform="translate(0 {item.t === 'chosen stretch' ? -6 : -2})"
				/>
				<Label anchor="start" x={x + 30} y={580} text={item.t} size={12} halo={false} />
			{/each}
		</g>
	</Readout>
</g>
