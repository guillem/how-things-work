<script lang="ts">
	/**
	 * How much doping (step `amount`): resistivity of silicon at 300 K against the dopant
	 * concentration, on log–log axes, for phosphorus (n-type) and boron (p-type), from the
	 * model (all dopants ionised, Masetti mobilities). Pure silicon and copper are marked
	 * for scale. `params.conc` (log₁₀ of atoms per cm³) and `params.kind` (n | p) place the
	 * marker; the panel on the right reads out the carriers (electrons and holes on a log
	 * bar, showing that the minority carriers become fewer) and how many times better the
	 * doped silicon conducts than pure silicon.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, scale, wave } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { INTRINSIC, NI_SI, RHO_COPPER, atomsPerDopant, conductivity, sci, sup } from '../model';

	let { t, params, reduced }: StageProps = $props();
	const time = $derived(reduced ? 2.5 : t);

	const kind = $derived(params.kind === 'p' ? 'p' : 'n');
	const lc = Tween.of(() => Number(params.conc ?? 16.7), { duration: 500, easing: cubicInOut });
	const conc = $derived(10 ** lc.current);
	const doped = (c: number, k: 'n' | 'p') => (k === 'n' ? conductivity(c, 0) : conductivity(0, c));
	const now = $derived(doped(conc, kind));

	const X0 = 100;
	const X1 = 610;
	const Y0 = 70;
	const Y1 = 480;
	const sx = scale([12, 19.5], [X0, X1]);
	const sy = scale([-6, 6], [Y1, Y0]);
	const curve = (k: 'n' | 'p') => {
		let d = '';
		for (let i = 0; i <= 150; i++) {
			const lx = 12 + (i / 150) * 7.5;
			const ly = Math.log10(doped(10 ** lx, k).rho);
			d += `${i ? 'L' : 'M'}${sx(lx).toFixed(1)} ${sy(ly).toFixed(1)}`;
		}
		return d;
	};
	const N_CURVE = curve('n');
	const P_CURVE = curve('p');
	const COLOR = { n: 'var(--semi-electron)', p: 'var(--semi-hole)' };
	const mx = $derived(sx(lc.current));
	const my = $derived(sy(Math.log10(now.rho)));
	const ratio = $derived(now.sigma / INTRINSIC.sigma);
	const ratioText = $derived(
		ratio >= 1e6
			? `${(ratio / 1e6).toPrecision(2)} million`
			: ratio >= 1e3
				? `${Math.round(ratio / 1e3).toLocaleString('en-US')} thousand`
				: ratio.toPrecision(2)
	);
	const rhoText = (r: number) =>
		r >= 0.01 && r < 1e4
			? `${Number(r.toPrecision(2)).toLocaleString('en-US')} Ω·cm`
			: `${sci(r)} Ω·cm`;
	const perAtoms = $derived(atomsPerDopant(conc));
	const perText = $derived.by(() => {
		const r = Number(perAtoms.toPrecision(2));
		if (r >= 1e9) return `${Number((r / 1e9).toPrecision(2))} billion`;
		if (r >= 1e6) return `${Number((r / 1e6).toPrecision(2))} million`;
		if (r >= 1e3) return `${Number((r / 1e3).toPrecision(2))} thousand`;
		return r.toLocaleString('en-US');
	});

	// Carrier bar: log₁₀ of carriers per cm³ from 0 to 20.
	const BX0 = 690;
	const BX1 = 930;
	const bx = scale([0, 20], [BX0, BX1]);
	const barLen = (v: number) => Math.max(2, bx(Math.max(0, Math.log10(Math.max(v, 1)))) - BX0);
	const yTicks = [-6, -4, -2, 0, 2, 4, 6];
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'middle'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	{@render txt(X0, 40, 'Resistivity of silicon at room temperature', 15, {
		anchor: 'start',
		weight: 700
	})}
	<Axes
		{sx}
		{sy}
		xTicks={[12, 13, 14, 15, 16, 17, 18, 19]}
		{yTicks}
		xFormat={(v: number) => `10${sup(v)}`}
		yFormat={(v: number) => `10${sup(v)}`}
		xLabel="dopant atoms per cm³"
		yLabel="Ω·cm"
	/>
	<!-- references -->
	<line
		x1={X0}
		x2={X1}
		y1={sy(Math.log10(INTRINSIC.rho))}
		y2={sy(Math.log10(INTRINSIC.rho))}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="6 4"
	/>
	{@render txt(
		X1 - 4,
		sy(Math.log10(INTRINSIC.rho)) - 8,
		`pure silicon: ${rhoText(INTRINSIC.rho)}`,
		12,
		{
			anchor: 'end',
			weight: 600
		}
	)}
	<line
		x1={X0}
		x2={X1}
		y1={sy(Math.log10(RHO_COPPER))}
		y2={sy(Math.log10(RHO_COPPER))}
		stroke="var(--circ-copper)"
		stroke-width="2"
		stroke-dasharray="6 4"
	/>
	{@render txt(X1 - 4, sy(Math.log10(RHO_COPPER)) - 8, `copper: ${sci(RHO_COPPER, 2)} Ω·cm`, 12, {
		anchor: 'end',
		weight: 600
	})}
	{@render txt(X1, Y0 - 12, '↑ insulators such as diamond: far off the top', 11, {
		anchor: 'end',
		muted: true
	})}

	<!-- curves -->
	<path
		d={P_CURVE}
		fill="none"
		stroke={COLOR.p}
		stroke-width={kind === 'p' ? 3 : 1.6}
		opacity={kind === 'p' ? 1 : 0.45}
	/>
	<path
		d={N_CURVE}
		fill="none"
		stroke={COLOR.n}
		stroke-width={kind === 'n' ? 3 : 1.6}
		opacity={kind === 'n' ? 1 : 0.45}
	/>
	{@render txt(sx(13.6), sy(Math.log10(doped(10 ** 13.6, 'p').rho)) - 12, 'boron (p-type)', 12, {
		anchor: 'start',
		weight: 600,
		color: COLOR.p
	})}
	{@render txt(
		sx(14.0),
		sy(Math.log10(doped(10 ** 14.0, 'n').rho)) + 26,
		'phosphorus (n-type)',
		12,
		{
			anchor: 'end',
			weight: 600,
			color: COLOR.n
		}
	)}

	<!-- marker -->
	<line x1={mx} x2={mx} y1={my} y2={Y1} stroke={COLOR[kind]} stroke-dasharray="3 3" />
	<line x1={X0} x2={mx} y1={my} y2={my} stroke={COLOR[kind]} stroke-dasharray="3 3" />
	<circle cx={mx} cy={my} r={9 + 3 * wave(time, 2)} fill={COLOR[kind]} opacity="0.2" />
	<circle cx={mx} cy={my} r="6" fill={COLOR[kind]} stroke="var(--stage-bg)" stroke-width="2" />
	{@render txt(mx > 480 ? mx - 12 : mx + 12, my - 12, rhoText(now.rho), 14, {
		anchor: mx > 480 ? 'end' : 'start',
		weight: 700
	})}

	<!-- readout -->
	{@render txt(BX0, 92, kind === 'n' ? 'Phosphorus-doped' : 'Boron-doped', 15, {
		anchor: 'start',
		weight: 700
	})}
	{@render txt(BX0, 114, `1 dopant atom per ${perText} Si atoms`, 12, {
		anchor: 'start',
		muted: true
	})}
	{@render txt(BX0, 160, 'Carriers per cm³', 13, { anchor: 'start', weight: 700 })}
	{#each [{ k: 'e', label: 'free electrons', v: now.n, c: COLOR.n, y: 184 }, { k: 'h', label: 'holes', v: now.p, c: COLOR.p, y: 236 }] as b (b.k)}
		<rect x={BX0} y={b.y} width={BX1 - BX0} height="16" rx="3" fill="var(--semi-band)" />
		<rect x={BX0} y={b.y} width={barLen(b.v)} height="16" rx="3" fill={b.c} />
		{@render txt(BX0, b.y + 32, `${b.label}: ${sci(b.v, 2)}`, 12, { anchor: 'start', weight: 600 })}
	{/each}
	<line
		x1={bx(Math.log10(NI_SI))}
		x2={bx(Math.log10(NI_SI))}
		y1="178"
		y2="258"
		stroke="var(--stage-ink)"
		stroke-dasharray="3 3"
	/>
	{@render txt(bx(Math.log10(NI_SI)), 290, 'pure silicon: 10¹⁰ of each', 11, { muted: true })}
	{#each [0, 10, 20] as v (v)}
		{@render txt(bx(v), 306, `10${sup(v)}`, 10, { muted: true })}
	{/each}
	{@render txt(BX0, 346, `electrons × holes = ${sci(now.n * now.p, 2)}`, 12, {
		anchor: 'start',
		weight: 600
	})}
	{@render txt(BX0, 364, '= nᵢ², whatever the doping', 12, { anchor: 'start', muted: true })}

	{@render txt(BX0, 420, ratio < 1.5 ? 'About as poor a conductor' : `${ratioText} times`, 20, {
		anchor: 'start',
		weight: 700,
		color: COLOR[kind]
	})}
	{@render txt(
		BX0,
		442,
		ratio < 1.5 ? 'as pure silicon' : 'more conductive than pure silicon',
		12,
		{
			anchor: 'start',
			weight: 600
		}
	)}
	{@render txt(
		480,
		545,
		'Model: all dopants ionised, measured mobilities (Masetti et al. 1983); matches measured silicon.',
		11,
		{ muted: true }
	)}
</g>
