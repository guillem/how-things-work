<script lang="ts">
	/**
	 * The Hertzsprung–Russell diagram of real nearby stars, and the main sequence as a line of
	 * masses.
	 *
	 * Phases (`step.hints.phase`):
	 *   nearby — 2,500 stars and 140 white dwarfs within 50 pc (Gaia), coloured by temperature,
	 *            with the main sequence, the giants and the white dwarfs labelled one after the
	 *            other, and the Sun marked
	 *   zams   — the stars dimmed, the MIST zero-age main sequence drawn with mass marks, and a
	 *            new star of the chosen mass (`msMass`) on it; a card gives its luminosity,
	 *            temperature, radius (drawn next to the Sun) and main-sequence lifetime, on a
	 *            log bar of time with the age of the universe marked
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import HrPlot from './HrPlot.svelte';
	import SkyLabel from './SkyLabel.svelte';
	import { hrScales, zamsPath, type Box } from './hr';
	import { UNIVERSE_AGE, mainSequenceLifetime, round2, starColour, years, zams } from '../star';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'nearby'));
	const isZams = $derived(phase === 'zams');

	const BOX: Box = { x: 70, y: 40, w: 520, h: 470 };
	const { sx, sy } = hrScales(BOX);
	const zPath = zamsPath(sx, sy);

	const focus = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const f = isZams ? 1 : 0;
		untrack(() => focus.set(f, { duration: reduced ? 0 : 800 }));
	});
	const z = $derived(focus.current);

	// ---- nearby: the regions, labelled in turn --------------------------------------------
	const show = (at: number) => (reduced ? 1 : smoothstep(at, at + 0.6, t));
	const sunX = sx(Math.log10(5772));
	const sunY = sy(0);

	// ---- zams: the chosen star -------------------------------------------------------------
	const m = $derived(Number(params.msMass ?? 1));
	const logM = Tween.of(() => Math.log10(m), { duration: 700, easing: cubicInOut });
	const shown = $derived(zams(10 ** logM.current));
	const star = $derived(zams(m));
	const life = $derived(mainSequenceLifetime(m));
	const MARKS = [0.1, 0.5, 1, 2, 5, 10, 20, 60];
	const pulse = $derived(reduced ? 0 : 0.5 + 0.5 * Math.sin(t * 3));

	// The card on the right.
	const CARD = { x: 616, y: 40, w: 326, h: 470 };
	const lifeScale = scale([6, 13], [CARD.x + 22, CARD.x + CARD.w - 22]);
	const LIFE_TICKS = [6, 7, 8, 9, 10, 11, 12, 13];
	const lifeLabel = (v: number) =>
		v === 6 ? '1 Myr' : v === 9 ? '1 Gyr' : v === 12 ? '1,000 Gyr' : '';
	const SUN_R = 7;
	const discR = $derived(Math.min(84, SUN_R * shown.R));
	const x = $derived(sx(shown.logT));
	const y = $derived(sy(shown.logL));
	const by = CARD.y + 380;
	const ux = lifeScale(Math.log10(UNIVERSE_AGE));
</script>

<g>
	<HrPlot name="hr" box={BOX} {sx} {sy} dots={1 - 0.6 * z} />

	<!-- nearby: the three groups -->
	{#if z < 0.99}
		<g opacity={1 - z}>
			<Readout id="ms" order={1} label="Main sequence" value="stars fusing hydrogen in their cores">
				<SkyLabel
					x={sx(3.72)}
					y={sy(-1.2)}
					text="main sequence"
					size={14}
					weight={700}
					rotate={-47}
					opacity={show(0.4)}
				/>
			</Readout>
			<Readout id="giants" order={2} label="Giants" value="big and cool, but bright">
				<SkyLabel
					x={sx(3.66)}
					y={sy(2.3)}
					text="giants"
					size={14}
					weight={700}
					opacity={show(1.2)}
				/>
			</Readout>
			<Readout id="wd" order={3} label="White dwarfs" value="hot but very faint: tiny">
				<SkyLabel
					x={sx(4.12)}
					y={sy(-3.95)}
					text="white dwarfs"
					size={14}
					weight={700}
					rotate={-28}
					opacity={show(2.0)}
				/>
			</Readout>
		</g>
	{/if}
	<!-- the Sun -->
	<circle cx={sunX} cy={sunY} r="6" fill="none" stroke="#ffd43b" stroke-width="1.6" />
	<circle cx={sunX} cy={sunY} r="1.6" fill="#ffd43b" />
	<Readout id="sun" order={4} label="The Sun" value="5,772 K, luminosity 1">
		<SkyLabel
			x={sunX + 12}
			y={sunY - 10}
			text="the Sun"
			anchor="start"
			size={12}
			color="#ffd43b"
			weight={600}
		/>
	</Readout>

	<!-- nearby: the card -->
	{#if z < 0.99}
		<g opacity={1 - z}>
			<rect
				x={CARD.x}
				y={CARD.y}
				width={CARD.w}
				height="236"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={CARD.x + 20}
				y={CARD.y + 34}
				text="Stars within 163 light years"
				size={15}
				weight={700}
				anchor="start"
			/>
			<Readout
				id="sample"
				order={5}
				label="Sample"
				value="1 in 15 of the stars within 50 pc (Gaia)"
			>
				<Label
					x={CARD.x + 20}
					y={CARD.y + 60}
					text="one in fifteen, measured by Gaia"
					anchor="start"
					muted
					size={12}
				/>
			</Readout>
			<Label
				x={CARD.x + 20}
				y={CARD.y + 98}
				text="each dot: one star, in its colour"
				anchor="start"
				size={13}
			/>
			<Label
				x={CARD.x + 20}
				y={CARD.y + 126}
				text="left: hotter · up: more light"
				anchor="start"
				size={13}
			/>
			<Label
				x={CARD.x + 20}
				y={CARD.y + 154}
				text="each grid line up: 10 × brighter"
				anchor="start"
				size={13}
			/>
			<Label
				x={CARD.x + 20}
				y={CARD.y + 194}
				text="most nearby stars are small, cool"
				anchor="start"
				muted
				size={12}
			/>
			<Label
				x={CARD.x + 20}
				y={CARD.y + 212}
				text="red dwarfs, too faint to see by eye"
				anchor="start"
				muted
				size={12}
			/>
		</g>
	{/if}

	<!-- zams: the line of masses and the chosen star -->
	{#if z > 0.01}
		<g opacity={z}>
			<path d={zPath} fill="none" stroke="var(--st-sky-ink)" stroke-width="2.5" opacity="0.85" />
			{#each MARKS as mk (mk)}
				{@const p = zams(mk)}
				<circle cx={sx(p.logT)} cy={sy(p.logL)} r="3" fill="var(--st-sky-ink)" />
				<Readout id="mark-{mk}">
					<SkyLabel x={sx(p.logT) - 10} y={sy(p.logL) + 4} text="{mk} M☉" anchor="end" size={11} />
				</Readout>
			{/each}
			<circle cx={x} cy={y} r={14 + 5 * pulse} fill={starColour(shown.T)} opacity="0.25" />
			<circle
				cx={x}
				cy={y}
				r="9"
				fill={starColour(shown.T)}
				stroke="var(--st-sky)"
				stroke-width="1.5"
			/>

			<!-- the card -->
			<rect
				x={CARD.x}
				y={CARD.y}
				width={CARD.w}
				height={CARD.h}
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Readout id="mass" order={1} label="A new star of" value="{m} M☉">
				<Label
					x={CARD.x + 20}
					y={CARD.y + 34}
					text="A new star of {m} M☉"
					size={16}
					weight={700}
					anchor="start"
				/>
			</Readout>
			<Readout id="lum" order={2} label="Luminosity" value="{round2(star.L)} × the Sun">
				<Label
					x={CARD.x + 20}
					y={CARD.y + 66}
					text="luminosity: {round2(star.L)} × the Sun"
					anchor="start"
				/>
			</Readout>
			<Readout
				id="temp"
				order={3}
				label="Surface"
				value="{(Math.round(star.T / 100) * 100).toLocaleString('en-US')} K"
			>
				<Label
					x={CARD.x + 20}
					y={CARD.y + 92}
					text="surface: {(Math.round(star.T / 100) * 100).toLocaleString('en-US')} K"
					anchor="start"
				/>
			</Readout>
			<Readout id="radius" order={4} label="Radius" value="{round2(star.R)} × the Sun">
				<Label
					x={CARD.x + 20}
					y={CARD.y + 118}
					text="radius: {round2(star.R)} × the Sun"
					anchor="start"
				/>
			</Readout>
			<!-- sizes, to scale with each other -->
			<circle
				cx={CARD.x + 60}
				cy={CARD.y + 210}
				r={SUN_R}
				fill={starColour(5772)}
				stroke="var(--border)"
			/>
			<Label x={CARD.x + 60} y={CARD.y + 210 + 30} text="the Sun" size={11} muted />
			<circle
				cx={CARD.x + 200}
				cy={CARD.y + 210}
				r={Math.max(1.2, discR)}
				fill={starColour(shown.T)}
				stroke="var(--border)"
			/>
			<Label
				x={CARD.x + 200}
				y={CARD.y + 210 + Math.max(discR, 8) + 18}
				text="this star (same scale)"
				size={11}
				muted
			/>

			<!-- lifetime on a log bar -->
			<Readout id="life" order={5} label="Life on the main sequence" value={years(life)}>
				<Label x={CARD.x + 20} y={by - 44} text="life on the main sequence:" anchor="start" />
				<Label
					x={CARD.x + 20}
					y={by - 22}
					text={years(life)}
					anchor="start"
					size={16}
					weight={700}
				/>
			</Readout>
			<rect
				x={lifeScale(6)}
				y={by}
				width={lifeScale(13) - lifeScale(6)}
				height="10"
				rx="5"
				fill="var(--stage-grid)"
			/>
			<rect
				x={lifeScale(6)}
				y={by}
				width={clamp(lifeScale(Math.log10(life)) - lifeScale(6), 0, lifeScale(13) - lifeScale(6))}
				height="10"
				rx="5"
				fill="var(--st-burn)"
			/>
			{#each LIFE_TICKS as v (v)}
				<line
					x1={lifeScale(v)}
					x2={lifeScale(v)}
					y1={by + 12}
					y2={by + 16}
					stroke="var(--stage-line)"
				/>
				{#if lifeLabel(v)}
					<Readout id="lt-{v}">
						<text x={lifeScale(v)} y={by + 30} text-anchor="middle" font-size="11" class="muted"
							>{lifeLabel(v)}</text
						>
					</Readout>
				{/if}
			{/each}
			<line x1={ux} x2={ux} y1={by - 6} y2={by + 16} stroke="var(--stage-ink)" stroke-width="1.5" />
			<Readout id="universe" order={6} label="Age of the universe" value="13.8 billion years">
				<Label x={ux} y={by + 50} text="age of the universe" size={11} />
			</Readout>
		</g>
	{/if}
</g>
