<script lang="ts">
	/**
	 * From the pass to a rate: the energy along the path of least energy with the zero-point
	 * levels at the start and at the pass and the effective barrier E₀ between them (left), and
	 * the Eyring rate (kT/h)·e^{−E₀/kT} against 1000/T on a log scale (right), with the
	 * readouts at the chosen temperature.
	 *
	 * Hints (see ../steps.ts): `isotope` (draw D beside H: the levels, the second line and the
	 * ratio; the `heavy` toggle picks which one is in focus). Controls: `reaction`, `temp`,
	 * `heavy`. Static apart from a slow pulse of the marker dot (nothing here moves in time);
	 * reduced motion shows the same frame.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Axes, Label, scale, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { KB } from '../leps';
	import { REACTIONS, reactantBond, type ReactionId } from '../trajectory';
	import {
		crossingFrequency,
		effectiveBarrier,
		eyring,
		minimumPath,
		passZeroPoint,
		reactantZeroPoint
	} from '../rate';

	let { step, t, params, reduced }: StageProps = $props();

	const isotope = $derived(step.hints?.isotope === true);
	const rid = $derived(
		(String(params.reaction ?? 'h-h2') === 'f-h2' ? 'f-h2' : 'h-h2') as ReactionId
	);
	const R = $derived(REACTIONS[rid]);
	const T = $derived(Number(params.temp ?? 300));
	const heavy = $derived(isotope && params.heavy === true);

	// ---- the profile ----------------------------------------------------------------------
	const PROF = { x: 96, y: 70, w: 360, h: 400 };
	const profile = $derived.by(() => {
		const p = minimumPath(R.surface);
		const zero = -reactantBond(R).pair.D;
		const s: number[] = [0];
		for (let i = 1; i < p.length; i++)
			s.push(s[i - 1] + Math.hypot(p[i].r1 - p[i - 1].r1, p[i].r2 - p[i - 1].r2));
		const e = p.map((q) => q.v - zero);
		const top = e.indexOf(Math.max(...e));
		return { s, e, top };
	});
	/** H + H₂: the whole path; F + H₂: from the entrance valley to just past the pass. */
	const pDomain = $derived.by((): [number, number] => {
		const { s, top } = profile;
		if (rid === 'h-h2') return [s[0] + 0.6, s[s.length - 1] - 0.6];
		return [s[0] + 0.8, s[top] + 0.6];
	});
	const pY = $derived(
		rid === 'h-h2' ? ([0, 0.65] as [number, number]) : ([-0.08, 0.4] as [number, number])
	);
	const px = $derived(scale(pDomain, [PROF.x, PROF.x + PROF.w]));
	const py = $derived(scale(pY, [PROF.y + PROF.h, PROF.y]));
	const profD = $derived.by(() => {
		const { s, e } = profile;
		let d = '';
		for (let i = 0; i < s.length; i++) {
			if (s[i] < pDomain[0] || s[i] > pDomain[1]) continue;
			d += `${d ? 'L' : 'M'}${px(s[i]).toFixed(1)} ${py(Math.max(pY[0], e[i])).toFixed(1)}`;
		}
		return d;
	});
	const topX = $derived(px(profile.s[profile.top]));
	const passE = $derived(profile.e[profile.top]);

	const levels = $derived(
		[false, true].map((d) => ({
			d,
			start: reactantZeroPoint(R, d),
			pass: passE + passZeroPoint(R, d),
			e0: effectiveBarrier(R, d)
		}))
	);
	const focus = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const h = heavy ? 1 : 0;
		untrack(() => focus.set(h, { duration: reduced ? 0 : 700 }));
	});
	const shown = $derived(isotope ? levels : levels.slice(0, 1));
	const opacityOf = (d: boolean) =>
		!isotope ? 1 : d ? 0.5 + 0.5 * focus.current : 1 - 0.5 * focus.current;
	const colorOf = (d: boolean) => (d ? 'var(--tst-zpe-d)' : 'var(--tst-zpe-h)');
	const startX0 = PROF.x + 64;
	const startX1 = PROF.x + 150;
	const arrowX = (d: boolean) => PROF.x + (d ? 44 : 22);

	// ---- the rate -------------------------------------------------------------------------
	const PLOT = { x: 588, y: 70, w: 330, h: 250 };
	const ax = scale([0.5, 5], [PLOT.x, PLOT.x + PLOT.w]);
	const ay = scale([4, 14], [PLOT.y + PLOT.h, PLOT.y]);
	const lineD = (d: boolean) => {
		let out = '';
		for (let inv = 0.5; inv <= 5.0001; inv += 0.05) {
			const k = eyring(R, 1000 / inv, d);
			out += `${out ? 'L' : 'M'}${ax(inv).toFixed(1)} ${ay(Math.log10(k)).toFixed(1)}`;
		}
		return out;
	};
	const lines = $derived(shown.map((l) => ({ d: l.d, path: lineD(l.d) })));
	const kH = $derived(eyring(R, T));
	const kD = $derived(eyring(R, T, true));
	const share = $derived(Math.exp(-effectiveBarrier(R, heavy) / (KB * T)));
	const pulse = $derived(reduced ? 0 : wave(t, 2));

	const SUP: Record<string, string> = {
		'0': '⁰',
		'1': '¹',
		'2': '²',
		'3': '³',
		'4': '⁴',
		'5': '⁵',
		'6': '⁶',
		'7': '⁷',
		'8': '⁸',
		'9': '⁹',
		'-': '⁻'
	};
	function sci(v: number, digits = 1) {
		const e = Math.floor(Math.log10(v));
		const m = v / 10 ** e;
		const exp = String(e)
			.split('')
			.map((c) => SUP[c] ?? c)
			.join('');
		return `${m.toFixed(digits)} × 10${exp}`;
	}
	const reactionName = $derived(
		rid === 'h-h2' ? (heavy ? 'D + D₂' : 'H + H₂') : heavy ? 'F + D₂' : 'F + H₂'
	);
	const hydName = $derived(rid === 'h-h2' ? 'H + H₂' : 'F + H₂');
	const deutName = $derived(rid === 'h-h2' ? 'D + D₂' : 'F + D₂');
	const tickFmt = (v: number) =>
		`10${String(v)
			.split('')
			.map((c) => SUP[c] ?? c)
			.join('')}`;
</script>

<g>
	<defs>
		<clipPath id="tst-rate-clip">
			<rect x={PROF.x} y={PROF.y} width={PROF.w} height={PROF.h} />
		</clipPath>
	</defs>

	<!-- ===== the profile with its zero-point levels ===== -->
	<Label
		x={PROF.x + PROF.w / 2}
		y={PROF.y - 26}
		text="Energy along the path of least energy"
		weight={600}
	/>
	<Axes sx={px} sy={py} xLabel="along the path (Å)" yLabel="energy (eV)" xTicks={[]} />
	<g clip-path="url(#tst-rate-clip)">
		<path d={profD} fill="none" stroke="var(--tst-path)" stroke-width="2.2" />
		{#each shown as l (l.d)}
			<g opacity={opacityOf(l.d)}>
				<line
					x1={startX0}
					x2={startX1}
					y1={py(l.start)}
					y2={py(l.start)}
					stroke={colorOf(l.d)}
					stroke-width="2.5"
					stroke-dasharray={l.d ? '6 4' : 'none'}
				/>
				<line
					x1={topX - 34}
					x2={topX + 34}
					y1={py(l.pass)}
					y2={py(l.pass)}
					stroke={colorOf(l.d)}
					stroke-width="2.5"
					stroke-dasharray={l.d ? '6 4' : 'none'}
				/>
				<path
					d="M{arrowX(l.d)} {py(l.start)}H{startX0}M{arrowX(l.d)} {py(l.pass)}H{topX - 34}"
					stroke={colorOf(l.d)}
					stroke-width="1"
					stroke-dasharray="2 3"
					fill="none"
				/>
			</g>
		{/each}
	</g>
	<circle cx={topX} cy={py(passE)} r="4" fill="var(--tst-pass)" />
	<Label
		x={topX + 10}
		y={py(passE) + 18}
		text="‡ pass {passE.toFixed(passE < 0.1 ? 3 : 2)} eV"
		anchor="start"
		color="var(--tst-pass)"
		weight={600}
		size={12}
	/>
	{#each shown as l, i (l.d)}
		<g opacity={opacityOf(l.d)}>
			<line
				x1={arrowX(l.d)}
				x2={arrowX(l.d)}
				y1={py(l.start)}
				y2={py(l.pass) + 4}
				stroke={colorOf(l.d)}
				stroke-width="1.8"
				marker-end="url(#arrowhead)"
			/>
			<Readout
				id="e0-{l.d ? 'd' : 'h'}"
				order={l.d ? 3 : 2}
				label="E₀ ({l.d ? 'D' : 'H'})"
				value="{l.e0.toFixed(3)} eV"
				color={colorOf(l.d)}
			>
				<Label
					x={PROF.x + 70}
					y={PROF.y + 18 + i * 20}
					text="E₀ ({l.d ? deutName : hydName}) = {l.e0.toFixed(3)} eV"
					anchor="start"
					color={colorOf(l.d)}
					weight={600}
					size={13}
					tabular
				/>
			</Readout>
		</g>
	{/each}
	<Readout id="zpe-key">
		<Label
			x={startX0}
			y={py(levels[isotope ? 1 : 0].start) + 22}
			text="molecule's zero-point level{isotope ? ' (D₂ dashed)' : ''}"
			anchor="start"
			muted
			size={11}
		/>
		<Label
			x={topX + 38}
			y={py(levels[0].pass) - 8}
			text="pass + its zero-point"
			anchor="start"
			muted
			size={11}
		/>
		{#if rid === 'f-h2'}
			<Label
				x={PROF.x + PROF.w - 8}
				y={PROF.y + PROF.h - 12}
				text="↓ HF + H: valley floor 1.38 eV lower"
				anchor="end"
				muted
				size={11}
			/>
		{/if}
	</Readout>

	<!-- ===== the rate against temperature ===== -->
	<Label
		x={PLOT.x + PLOT.w / 2}
		y={PLOT.y - 26}
		text="Energy-only Eyring factor (kT/h)·e^(−E₀/kT)"
		weight={600}
		size={12}
	/>
	<Axes
		sx={ax}
		sy={ay}
		xLabel="1000 / T (1/K)"
		yLabel="factor (s⁻¹), partition functions left out"
		yTicks={[4, 6, 8, 10, 12, 14]}
		yFormat={tickFmt}
	/>
	{#each lines as l (l.d)}
		<path
			d={l.path}
			fill="none"
			stroke={colorOf(l.d)}
			stroke-width="2.2"
			stroke-dasharray={l.d ? '7 4' : 'none'}
			opacity={opacityOf(l.d)}
		/>
	{/each}
	<line
		x1={ax(1000 / T)}
		x2={ax(1000 / T)}
		y1={PLOT.y}
		y2={PLOT.y + PLOT.h}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		stroke-dasharray="3 3"
	/>
	{#each shown as l (l.d)}
		<circle
			cx={ax(1000 / T)}
			cy={ay(Math.log10(l.d ? kD : kH))}
			r={5 + pulse}
			fill={colorOf(l.d)}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={opacityOf(l.d)}
		/>
	{/each}
	<Label x={PLOT.x + PLOT.w - 6} y={PLOT.y + 16} text="hot ←" anchor="end" muted size={11} />
	<Label
		x={PLOT.x + 8}
		y={PLOT.y + PLOT.h - 10}
		text="→ cold"
		anchor="start"
		muted
		size={11}
		halo
	/>

	<!-- ===== readouts ===== -->
	<Readout
		id="temp"
		order={1}
		label="At"
		value="{Math.round(T)} K: kT/h = {sci(crossingFrequency(T))} s⁻¹"
	>
		<Label
			x={560}
			y={392}
			text="At {Math.round(T)} K: kT/h = {sci(crossingFrequency(T))} per second"
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="share" order={4} label="Boltzmann factor" value="e^(−E₀/kT) = {sci(share)}">
		<Label
			x={560}
			y={420}
			text="{reactionName}: Boltzmann factor e^(−E₀/kT) = {sci(share)}"
			anchor="start"
			muted
			tabular
		/>
	</Readout>
	<Readout id="rate" order={5} label="Energy-only factor" value="{sci(heavy ? kD : kH)} s⁻¹">
		<Label
			x={560}
			y={448}
			text="energy-only factor = {sci(heavy ? kD : kH)} per second"
			anchor="start"
			weight={600}
			tabular
		/>
	</Readout>
	{#if isotope}
		<Readout id="ratio" order={6} label="k(H) / k(D) from E₀ alone" value={(kH / kD).toFixed(2)}>
			<Label
				x={560}
				y={484}
				text="k(H) / k(D) from E₀ alone = {(kH / kD).toFixed(2)}"
				anchor="start"
				pill
				weight={700}
				tabular
			/>
		</Readout>
	{/if}
</g>
