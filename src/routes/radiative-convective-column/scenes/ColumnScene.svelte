<script lang="ts">
	/**
	 * The column's temperature against altitude (left) and where its escaping infrared leaves
	 * from (right, the share of the outgoing flux per kilometre, with the ground's share through
	 * the window and the band at the bottom). The convecting layers are drawn in the troposphere
	 * colour, the radiative ones in the stratosphere colour; the reference column (τ∞ = 3.5, the
	 * reader's other settings) is dashed whenever τ∞ differs from it. `focus` picks the callout:
	 * 'radiative' (the analytic profile, skin and ground jump), 'unstable' (layers steeper than Γ),
	 * 'convection' (tropopause), 'emission' (the τ = 1 level), 'saturated' (what the band lets
	 * through), 'strat' (the stratosphere against the reference).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, cycle, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TAU_REF, absorbedSolar, emissionTemp, temperatureAt } from '../model';
	import { C, dK, fmtK, fmtKm, fmtW, settingsOf, solve } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'convection'));
	const s = $derived(settingsOf(params, step));
	const now = $derived(solve(s));
	/** The column drawn dashed for comparison: twice the absorber on 'strat', else τ∞ = 3.5. */
	const twice = $derived(focus === 'strat');
	const refTau = $derived(twice ? 2 * s.tau : TAU_REF);
	const ref = $derived(solve({ ...s, tau: refTau }));
	const showRef = $derived(twice || Math.abs(s.tau - TAU_REF) > 0.05);

	// ---- geometry ------------------------------------------------------------
	const Z_MAX = 40;
	const Y0 = 494;
	const Y1 = 84;
	const sy = scale([0, Z_MAX], [Y0, Y1]);
	const T_HI = 380;
	const sxT = scale([170, T_HI], [96, 560]);
	const P = { x0: 650, x1: 900 };
	/** The share axis reaches 30%, or further when the ground's share is larger (a thin band). */
	const SHARE_MAX = $derived(
		Math.max(0.3, Math.ceil((now.d.shareWindow + now.d.shareSurfaceBand) * 10) / 10)
	);
	const sxS = $derived(scale([0, SHARE_MAX], [P.x0, P.x1]));
	const shareTicks = $derived(
		Array.from({ length: Math.round(SHARE_MAX * 10) + 1 }, (_, i) => i / 10).filter(
			(_, i) => SHARE_MAX <= 0.5 || i % 2 === 0
		)
	);

	// The profile (layer temperatures and heights, ground first) eases between steps and settings.
	const target = $derived([now.column.ts, ...now.column.T, ...now.d.z]);
	const shown = Tween.of(() => target, { duration: 450, easing: cubicInOut });
	const prof = $derived.by(() => {
		const v = shown.current.length === target.length ? shown.current : target;
		const n = now.column.T.length;
		return { ts: v[0], T: v.slice(1, n + 1), z: v.slice(n + 1) };
	});

	const pts = (T: number[], z: number[], from: number, to: number) => {
		let d = '';
		for (let k = from; k <= to && k < T.length; k++) {
			if (z[k] > Z_MAX + 2) break;
			d += `${d ? 'L' : 'M'}${sxT(T[k]).toFixed(1)} ${sy(z[k]).toFixed(1)}`;
		}
		return d;
	};
	const top = $derived(now.d.tropopause);
	/** The convecting part, from the ground (no jump) to the tropopause layer. */
	const tropoPath = $derived(
		top >= 0
			? `M${sxT(prof.ts).toFixed(1)} ${sy(0).toFixed(1)}` +
					pts(prof.T, prof.z, 0, top + 1).replace(/^M/, 'L')
			: ''
	);
	const stratPath = $derived(pts(prof.T, prof.z, Math.max(0, top + 1), prof.T.length - 1));
	const refPath = $derived(
		(ref.d.tropopause >= 0
			? `M${sxT(ref.column.ts).toFixed(1)} ${sy(0).toFixed(1)}`
			: `M${sxT(ref.column.T[0]).toFixed(1)} ${sy(ref.d.z[0]).toFixed(1)}`) +
			pts(ref.column.T, ref.d.z, 0, ref.column.T.length - 1).replace(/^M/, 'L')
	);

	/** Layers steeper than the lapse rate (radiative equilibrium only). */
	const unstable = $derived.by(() => {
		if (s.convection || focus !== 'unstable') return [] as { id: number; d: string }[];
		const out: { id: number; d: string }[] = [];
		const T = now.column.T;
		const z = now.d.z;
		for (let k = 0; k < T.length - 1 && z[k + 1] < Z_MAX; k++) {
			const rate = (T[k] - T[k + 1]) / (z[k + 1] - z[k]);
			if (rate > s.lapse)
				out.push({
					id: k,
					d: `M${sxT(T[k]).toFixed(1)} ${sy(z[k]).toFixed(1)}L${sxT(T[k + 1]).toFixed(1)} ${sy(z[k + 1]).toFixed(1)}`
				});
		}
		return out;
	});
	const unstableTop = $derived(unstable.length ? now.d.z[unstable[unstable.length - 1].id + 1] : 0);

	/** The lapse-rate line from the air at the ground, for comparison. */
	const lapseLine = $derived.by(() => {
		const T0 = s.convection ? now.column.ts : now.column.T[0];
		const z1 = Math.min(Z_MAX, (T0 - 175) / s.lapse);
		return { x0: sxT(T0), y0: sy(0), x1: sxT(T0 - s.lapse * z1), y1: sy(z1) };
	});

	// ---- where the infrared leaves from --------------------------------------
	const bins = $derived.by(() => {
		const out = Array.from({ length: Z_MAX }, (_, i) => ({ i, share: 0 }));
		now.d.share.forEach((sh, k) => {
			const i = Math.min(Z_MAX - 1, Math.max(0, Math.floor(now.d.z[k])));
			out[i].share += sh;
		});
		return out;
	});
	const bandShare = $derived(now.d.share.reduce((a, b) => a + b, 0));

	// infrared leaving: dots rising to space from heights spread as the shares (fixed quantiles)
	const N_DOTS = 14;
	const quantiles = $derived.by(() => {
		const cum: number[] = [];
		let acc = 0;
		for (const b of bins) {
			acc += b.share;
			cum.push(acc);
		}
		return Array.from({ length: N_DOTS }, (_, j) => {
			const q = ((j + 0.5) / N_DOTS) * acc;
			const i = cum.findIndex((c) => c >= q);
			return Math.max(0, i) + 0.5;
		});
	});
	const tt = $derived(reduced ? 2.5 : t);
	const dots = $derived(
		quantiles.map((z0, j) => {
			const u = cycle(tt, 3.2, j / N_DOTS);
			const y = sy(z0) + (Y1 - 6 - sy(z0)) * u;
			return {
				j,
				x: 926 + (j % 3) * 6,
				y,
				o: reduced ? 0.8 : smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u))
			};
		})
	);

	// ---- read-outs -----------------------------------------------------------
	const te = emissionTemp(absorbedSolar());
	const groundJump = $derived(now.column.ts - now.column.T[0]);
	const skin = $derived(now.column.T[now.column.T.length - 1]);
	const t10 = $derived(temperatureAt(now.column, 10));
	const t10ref = $derived(temperatureAt(ref.column, 10));
	const through = $derived(Math.exp(-s.tau));
	const pctText = (f: number) =>
		f === 0
			? '0%'
			: f >= 0.1
				? `${Math.round(f * 100)}%`
				: f >= 0.001
					? `${(f * 100).toFixed(1)}%`
					: f >= 0.0001
						? `${(f * 100).toFixed(2)}%`
						: 'under 0.01%';
	const emLabel = $derived(
		now.d.emissionZ === null
			? ''
			: `${fmtKm(now.d.emissionZ)} · ${Math.round(now.d.emissionT ?? 0)} K`
	);
	const showEm = $derived(focus !== 'unstable');
	const emStrong = $derived(['emission', 'saturated', 'radiative'].includes(focus));
</script>

<g>
	<defs>
		<clipPath id="rcc-clip">
			<rect x={sxT(170)} y={Y1 - 6} width={sxT(T_HI) - sxT(170)} height={Y0 - Y1 + 12} />
		</clipPath>
	</defs>

	<!-- ---------------------------------------------------------------- profile -->
	<Axes
		sx={sxT}
		{sy}
		xTicks={[180, 210, 240, 270, 300, 330, 360]}
		yTicks={[0, 10, 20, 30, 40]}
		xLabel="temperature (K)"
		yLabel="altitude (km)"
	/>

	{#if focus === 'strat' && top >= 0}
		<rect
			x={sxT(170)}
			y={Y1}
			width={sxT(T_HI) - sxT(170)}
			height={Math.max(0, sy(now.d.tropopauseZ ?? 0) - Y1)}
			fill={C.strat}
			opacity="0.08"
		/>
	{/if}

	<g clip-path="url(#rcc-clip)">
		{#if focus === 'unstable' || focus === 'convection'}
			<line
				x1={lapseLine.x0}
				y1={lapseLine.y0}
				x2={lapseLine.x1}
				y2={lapseLine.y1}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="2 5"
			/>
		{/if}
		{#if showRef}
			<path d={refPath} fill="none" stroke={C.ref} stroke-width="1.8" stroke-dasharray="7 5" />
		{/if}
		{#if tropoPath}
			<path d={tropoPath} fill="none" stroke={C.tropo} stroke-width="3" stroke-linejoin="round" />
		{/if}
		<path d={stratPath} fill="none" stroke={C.strat} stroke-width="3" stroke-linejoin="round" />
		{#each unstable as u (u.id)}
			<path
				d={u.d}
				fill="none"
				stroke={C.unstable}
				stroke-width="6"
				stroke-linecap="round"
				opacity="0.85"
			/>
		{/each}
		{#if !s.convection}
			<!-- the jump between the ground and the air touching it -->
			<line
				x1={sxT(prof.T[0])}
				y1={sy(prof.z[0])}
				x2={sxT(prof.ts)}
				y2={sy(0)}
				stroke={focus === 'unstable' ? C.unstable : C.strat}
				stroke-width="2"
				stroke-dasharray="3 3"
			/>
		{/if}
	</g>
	<circle
		cx={Math.min(sxT(T_HI), sxT(prof.ts))}
		cy={sy(0)}
		r="6.5"
		fill={C.tropo}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	{#if prof.ts > T_HI}
		<Readout id="offscale">
			<Label
				x={sxT(T_HI) - 12}
				y={sy(0) - 14}
				anchor="end"
				text="ground {Math.round(now.column.ts)} K, off the scale →"
				size={11}
				color={C.tropoText}
			/>
		</Readout>
	{/if}

	<!-- tropopause -->
	{#if top >= 0 && now.d.tropopauseZ !== null}
		<line
			x1={sxT(170)}
			x2={sxT(T_HI)}
			y1={sy(now.d.tropopauseZ)}
			y2={sy(now.d.tropopauseZ)}
			stroke={C.stratText}
			stroke-width="1.2"
			stroke-dasharray="6 4"
			opacity={focus === 'convection' || focus === 'strat' ? 1 : 0.55}
		/>
		<Readout
			id="trop"
			order={3}
			label="Tropopause"
			value={fmtKm(now.d.tropopauseZ)}
			color={C.strat}
		>
			<Label
				x={sxT(T_HI) - 6}
				y={sy(now.d.tropopauseZ) - 8}
				anchor="end"
				text="tropopause · {fmtKm(now.d.tropopauseZ)}"
				size={12}
				weight={600}
				color={C.stratText}
				tabular
			/>
		</Readout>
	{/if}

	<!-- emission level, across both panels -->
	{#if showEm && now.d.emissionZ !== null}
		<line
			x1={sxT(170)}
			x2={P.x1 + 4}
			y1={sy(now.d.emissionZ)}
			y2={sy(now.d.emissionZ)}
			stroke={C.emission}
			stroke-width={emStrong ? 2 : 1.2}
			opacity={emStrong ? 1 : 0.6}
		/>
		{#if showRef && ref.d.emissionZ !== null && (focus === 'emission' || focus === 'saturated')}
			<line
				x1={P.x0}
				x2={P.x1 + 4}
				y1={sy(ref.d.emissionZ)}
				y2={sy(ref.d.emissionZ)}
				stroke={C.emission}
				stroke-width="1.2"
				stroke-dasharray="5 4"
				opacity="0.7"
			/>
		{/if}
	{/if}

	<!-- labels on the profile -->
	<Readout id="key">
		{#if tropoPath}
			<Label
				x={sxT(Math.min(335, prof.ts)) - 12}
				y={sy(2.2)}
				anchor="end"
				text={s.convection ? 'troposphere: on the lapse rate' : ''}
				size={12}
				color={C.tropoText}
			/>
		{/if}
		<Label
			x={sxT(Math.max(185, skin)) + 10}
			y={sy(32)}
			anchor="start"
			text={s.convection && top >= 0
				? 'stratosphere: radiative equilibrium'
				: 'radiative equilibrium'}
			size={12}
			color={C.stratText}
		/>
		{#if showRef}
			<Label
				x={sxT(Math.max(185, ref.column.T[ref.column.T.length - 1])) + 10}
				y={sy(36.5)}
				anchor="start"
				text="dashed: τ∞ = {refTau.toFixed(1)}"
				size={11}
				muted
			/>
		{/if}
		{#if focus === 'unstable' && unstable.length}
			<Label
				x={sxT(Math.min(330, now.column.T[0])) + 8}
				y={sy(Math.max(unstableTop, 1.5)) - 10}
				anchor="start"
				text="steeper than {s.lapse.toFixed(1)} K/km: unstable"
				size={12}
				weight={600}
				color={C.unstableText}
			/>
		{/if}
		{#if focus === 'unstable' || focus === 'convection'}
			<Label
				x={lapseLine.x1 + 6}
				y={lapseLine.y1 + 4}
				anchor="start"
				text="Γ = {s.lapse.toFixed(1)} K/km"
				size={11}
				muted
			/>
		{/if}
	</Readout>

	<!-- ---------------------------------------------------------------- panel -->
	<Axes
		sx={sxS}
		{sy}
		xTicks={shareTicks}
		yTicks={[0, 10, 20, 30, 40]}
		xFormat={(v: number) => `${Math.round(v * 100)}%`}
		grid={false}
	/>
	{#each bins as b (b.i)}
		{#if b.share > 0.0005}
			<rect
				x={P.x0}
				y={sy(b.i + 1) + 1}
				width={Math.max(0, sxS(b.share) - P.x0)}
				height={Math.max(1, sy(b.i) - sy(b.i + 1) - 2)}
				rx="2"
				fill={C.ir}
				opacity="0.85"
			/>
		{/if}
	{/each}
	<!-- from the ground: window and band -->
	<rect
		x={P.x0}
		y={Y0 + 24}
		width={Math.max(0, sxS(now.d.shareWindow) - P.x0)}
		height="12"
		rx="2"
		fill={C.window}
	/>
	<rect
		x={sxS(now.d.shareWindow)}
		y={Y0 + 24}
		width={Math.max(0, sxS(now.d.shareWindow + now.d.shareSurfaceBand) - sxS(now.d.shareWindow))}
		height="12"
		rx="2"
		fill={C.ir}
		opacity="0.55"
	/>
	<Readout
		id="ground"
		order={5}
		label="From the ground"
		value="window {pctText(now.d.shareWindow)} ({fmtW(now.d.olrWindow)}), band {pctText(
			now.d.shareSurfaceBand
		)}"
		color={C.window}
	>
		<Label
			x={P.x0}
			y={Y0 + 50}
			anchor="start"
			text="ground: window {pctText(now.d.shareWindow)} · band {pctText(now.d.shareSurfaceBand)}"
			size={11}
			color={C.windowText}
			tabular
		/>
	</Readout>
	<Readout id="panel-title">
		<Label
			x={P.x0}
			y={Y1 - 18}
			anchor="start"
			text="where the escaping infrared leaves from"
			size={12}
			weight={600}
		/>
		<Label
			x={P.x0}
			y={Y1 - 3}
			anchor="start"
			text="air: {pctText(bandShare)} of {fmtW(now.d.olr)}"
			size={11}
			muted
			tabular
		/>
	</Readout>
	{#each dots as d (d.j)}
		<circle cx={d.x} cy={d.y} r="2.6" fill={C.ir} opacity={d.o} />
	{/each}
	{#if showEm && now.d.emissionZ !== null}
		<Readout
			id="em"
			order={2}
			label="Emission level"
			value={now.d.emissionZ === null
				? '—'
				: `${fmtKm(now.d.emissionZ)}, ${Math.round(now.d.emissionT ?? 0)} K`}
			color={C.emission}
		>
			<Label
				x={P.x1}
				y={sy(now.d.emissionZ) - 22}
				anchor="end"
				text="emission level (τ = 1)"
				size={11}
				weight={600}
				color={C.emissionText}
			/>
			<Label
				x={P.x1}
				y={sy(now.d.emissionZ) - 8}
				anchor="end"
				text={emLabel}
				size={11}
				weight={600}
				color={C.emissionText}
				tabular
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- header -->
	<Readout id="ts" order={1} label="Ground" value={fmtK(now.column.ts)} color={C.tropo}>
		<Label
			x={96}
			y={36}
			anchor="start"
			text="ground {fmtK(now.column.ts)}"
			size={16}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout id="settings">
		<Label
			x={262}
			y={36}
			anchor="start"
			text="τ∞ = {s.tau.toFixed(1)} · window {s.window > 0 ? 'open' : 'closed'} · {s.convection
				? `convection to ${s.lapse.toFixed(1)} K/km`
				: 'no convection'}"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<!-- ---------------------------------------------------------------- caption -->
	<rect
		x="96"
		y="544"
		width="464"
		height="44"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if focus === 'radiative'}
		<Readout
			id="cap"
			order={6}
			label="Radiative equilibrium"
			value="skin {fmtK(skin)}; ground {fmtK(now.column.ts)}, {groundJump.toFixed(
				1
			)} K above the air"
		>
			<Label
				x={112}
				y={562}
				anchor="start"
				text="skin {fmtK(skin)} (2^−¼ × {te.toFixed(0)} K = {(te * 2 ** -0.25).toFixed(
					1
				)} K when grey)"
				size={12}
				tabular
			/>
			<Label
				x={112}
				y={579}
				anchor="start"
				text="ground {fmtK(now.column.ts)}, {groundJump.toFixed(
					1
				)} K warmer than the air touching it"
				size={12}
				tabular
			/>
		</Readout>
	{:else if focus === 'unstable'}
		<Readout
			id="cap"
			order={6}
			label="Unstable layers"
			value={unstable.length ? `up to ${fmtKm(unstableTop)}` : 'none'}
			color={C.unstable}
		>
			<Label
				x={112}
				y={562}
				anchor="start"
				text={unstable.length
					? `layers up to ${fmtKm(unstableTop)} cool faster than ${s.lapse.toFixed(1)} K/km`
					: `no layer is steeper than ${s.lapse.toFixed(1)} K/km`}
				size={12}
				color={C.unstableText}
				weight={600}
				tabular
			/>
			<Label
				x={112}
				y={579}
				anchor="start"
				text="and the ground is {groundJump.toFixed(1)} K warmer than the air above it"
				size={12}
				tabular
			/>
		</Readout>
	{:else if focus === 'convection'}
		<Readout
			id="cap"
			order={6}
			label="Convection"
			value={s.convection ? `tropopause ${fmtKm(now.d.tropopauseZ ?? 0)}` : 'off'}
		>
			<Label
				x={112}
				y={562}
				anchor="start"
				text={s.convection
					? `convection to ${s.lapse.toFixed(1)} K/km: tropopause at ${fmtKm(now.d.tropopauseZ ?? 0)}, ${fmtK(now.d.tropopauseT ?? 0)}`
					: 'convection off: pure radiative equilibrium'}
				size={12}
				tabular
			/>
			<Label
				x={112}
				y={579}
				anchor="start"
				text="ground {fmtK(now.column.ts)} · without convection {fmtK(
					solve({ ...s, convection: false }).column.ts
				)}"
				size={12}
				tabular
			/>
		</Readout>
	{:else if focus === 'emission'}
		<Readout id="cap" order={6} label="Emission temperature" value="{te.toFixed(1)} K = (OLR/σ)^¼">
			<Label
				x={112}
				y={562}
				anchor="start"
				text="outgoing {fmtW(now.d.olr)} = σ × ({te.toFixed(1)} K)⁴: the emission temperature"
				size={12}
				tabular
			/>
			<Label
				x={112}
				y={579}
				anchor="start"
				text={now.d.emissionZ === null
					? 'the band is too thin to have a τ = 1 level'
					: `the air at τ = 1 is ${fmtK(now.d.emissionT ?? 0)}; the ground is ${fmtK(now.column.ts)}`}
				size={12}
				tabular
			/>
		</Readout>
	{:else if focus === 'saturated'}
		<Readout
			id="cap"
			order={6}
			label="Through the band"
			value="e^−{s.tau.toFixed(1)} = {pctText(through)} of the ground's infrared"
		>
			<Label
				x={112}
				y={562}
				anchor="start"
				text="the band passes e^−{s.tau.toFixed(1)} = {pctText(through)} of the ground's infrared"
				size={12}
				tabular
			/>
			<Label
				x={112}
				y={579}
				anchor="start"
				text="ground {dK(now.column.ts - ref.column.ts)} and emission level {(now.d.emissionZ ??
					0) -
					(ref.d.emissionZ ?? 0) >=
				0
					? '+'
					: '−'}{Math.abs((now.d.emissionZ ?? 0) - (ref.d.emissionZ ?? 0)).toFixed(
					1
				)} km vs τ∞ = 3.5"
				size={12}
				tabular
			/>
		</Readout>
	{:else}
		<Readout
			id="cap"
			order={6}
			label="Twice the absorber"
			value="stratosphere {dK(t10ref - t10)}, ground {dK(ref.column.ts - now.column.ts)}"
			color={C.strat}
		>
			<Label
				x={112}
				y={562}
				anchor="start"
				text="twice the absorber (τ∞ {refTau.toFixed(1)}): stratosphere (10 hPa) {dK(t10ref - t10)}"
				size={12}
				weight={600}
				color={C.stratText}
				tabular
			/>
			<Label
				x={112}
				y={579}
				anchor="start"
				text="ground {dK(ref.column.ts - now.column.ts)} · window {s.window > 0
					? `open, ${fmtW(now.d.olrWindow)}`
					: 'closed: a fully grey gas'}"
				size={12}
				tabular
			/>
		</Readout>
	{/if}
</g>
