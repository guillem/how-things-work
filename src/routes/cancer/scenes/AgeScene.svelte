<script lang="ts">
	/**
	 * Cancer incidence by age (SEER, 2018–2022) on log–log axes, with the Armitage–Doll line:
	 * rate ∝ age^(k−1). `params.site` picks the cancer, `params.hits` the k of the reader's line
	 * (its height is the best fit for that slope); the dashed line is the best fit over ages
	 * 30–79. The points appear by age over the first two seconds.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SEER_AGE } from '../data';
	import { fitStages, interceptFor } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const siteId = $derived(String(params.site ?? 'colorectal'));
	const site = $derived(SEER_AGE.find((s) => s.id === siteId) ?? SEER_AGE[0]);
	const k = $derived(Number(params.hits ?? 5));
	const FIT_LO = 30;
	const FIT_HI = 80;
	const points = $derived(
		site.bands
			.filter((b) => b.mid !== null)
			.map((b) => ({
				age: b.mid!,
				rate: b.rate,
				label: b.age,
				inFit: b.mid! > FIT_LO && b.mid! < FIT_HI
			}))
	);
	const fitPts = $derived(points.filter((p) => p.inFit));
	const best = $derived(fitStages(fitPts));

	const slope = new Tween(4, { duration: 700, easing: cubicInOut });
	const target = $derived(k - 1);
	$effect(() => {
		const v = target;
		untrack(() => slope.set(v));
	});

	// ---- axes (log10 both) ----------------------------------------------------------------
	const X0 = 100;
	const X1 = 690;
	const Y0 = 60;
	const Y1 = 520;
	const lx = scale([0, 2], [X0, X1]);
	const sxAge = (a: number) => lx(Math.log10(a));
	const yRange = $derived.by(() => {
		const rs = points.map((p) => p.rate);
		return [Math.floor(Math.log10(Math.min(...rs))), Math.ceil(Math.log10(Math.max(...rs)))];
	});
	const ly = $derived(scale([yRange[0], yRange[1]], [Y1, Y0]));
	const syRate = (r: number) => ly(Math.log10(r));
	const yTicks = $derived(
		Array.from({ length: yRange[1] - yRange[0] + 1 }, (_, i) => yRange[0] + i)
	);
	const X_TICKS = [1, 2, 5, 10, 20, 30, 50, 70, 100];

	const linePath = (sl: number, b: number, a0: number, a1: number) => {
		const pts: string[] = [];
		for (let i = 0; i <= 24; i++) {
			const a = a0 * Math.pow(a1 / a0, i / 24);
			const y = ly((b + sl * Math.log(a)) / Math.LN10);
			pts.push(`${sxAge(a).toFixed(1)},${y.toFixed(1)}`);
		}
		return 'M' + pts.join('L');
	};
	const yourB = $derived(interceptFor(fitPts, slope.current));
	const yourIn = $derived(linePath(slope.current, yourB, FIT_LO, FIT_HI));
	const yourOut = $derived(linePath(slope.current, yourB, 1, 100));
	const bestPath = $derived(linePath(best.slope, best.intercept, 1, 100));

	const tt = $derived(reduced ? 99 : t);
	const shown = (i: number, n: number) => smoothstep(0, 1, (tt - 0.3 - (i / n) * 1.6) / 0.25);

	const r70 = $derived(site.bands.find((b) => b.age === '70-74'));
	const note = $derived(
		{
			colorectal: 'The bump at 50–54: screening, from 45–50 in the US, finds tumours earlier.',
			pancreas: 'Almost no cases before 30; then a steady, steep climb.',
			all: 'All cancers together: the old-age pattern dominates.',
			'all-leukaemia': 'Peaks at ages 1–4: often started before birth, few hits needed.'
		}[site.id] ?? ''
	);
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
	/** 10 to the power n, with a superscript exponent. */
	const pow10 = (n: number) =>
		n === 0 ? '1' : n === 1 ? '10' : '10' + [...String(n)].map((c) => SUP[c] ?? c).join('');
	const fmtK = (v: number) => v.toFixed(1);
	/** Greedy word wrap into lines of at most `n` characters. */
	function wrap(text: string, n: number): string[] {
		const out: string[] = [];
		let line = '';
		for (const w of text.split(' ')) {
			if (line && line.length + 1 + w.length > n) {
				out.push(line);
				line = w;
			} else line = line ? `${line} ${w}` : w;
		}
		if (line) out.push(line);
		return out;
	}
	const doubling = $derived(Math.pow(2, k - 1));
</script>

<g class="age-scene">
	<Readout id="age-title">
		<text x={X0} y={36} style:font-size="15px" font-weight="600"
			>{site.label}: new cases per 100,000 people a year, by age</text
		>
	</Readout>

	<!-- frame -->
	<rect
		x={sxAge(FIT_LO)}
		y={Y0}
		width={sxAge(FIT_HI) - sxAge(FIT_LO)}
		height={Y1 - Y0}
		fill="var(--stage-grid)"
	/>
	{#each yTicks as v (v)}
		<line x1={X0} x2={X1} y1={ly(v)} y2={ly(v)} stroke="var(--stage-grid)" stroke-width="1.5" />
		<text x={X0 - 8} y={ly(v) + 4} text-anchor="end" style:font-size="12px" class="muted"
			>{pow10(v)}</text
		>
	{/each}
	{#each X_TICKS as a (a)}
		<line x1={sxAge(a)} x2={sxAge(a)} y1={Y1} y2={Y1 + 5} stroke="var(--stage-line)" />
		<text x={sxAge(a)} y={Y1 + 20} text-anchor="middle" style:font-size="12px" class="muted"
			>{a}</text
		>
	{/each}
	<line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke="var(--stage-line)" />
	<line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke="var(--stage-line)" />
	<Readout id="age-axes">
		<text x={(X0 + X1) / 2} y={Y1 + 44} text-anchor="middle" style:font-size="12px" class="muted"
			>age (log scale)</text
		>
		<text
			x={X0 - 52}
			y={(Y0 + Y1) / 2}
			text-anchor="middle"
			style:font-size="12px"
			class="muted"
			transform="rotate(-90 {X0 - 52} {(Y0 + Y1) / 2})">rate per 100,000 a year (log scale)</text
		>
		<text
			x={(sxAge(FIT_LO) + sxAge(FIT_HI)) / 2}
			y={Y0 + 16}
			text-anchor="middle"
			style:font-size="11px"
			class="muted">fitted: ages 30–79</text
		>
	</Readout>

	<defs>
		<clipPath id="age-clip">
			<rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
		</clipPath>
	</defs>
	<g clip-path="url(#age-clip)">
		<!-- lines -->
		<path
			d={bestPath}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
		/>
		<path d={yourOut} fill="none" stroke="var(--ca-cancer)" stroke-width="1.5" opacity="0.35" />
		<path d={yourIn} fill="none" stroke="var(--ca-cancer)" stroke-width="3" />
	</g>
	<!-- data -->
	{#each points as p, i (p.label)}
		<circle
			cx={sxAge(p.age)}
			cy={syRate(p.rate)}
			r="5"
			fill={p.inFit ? 'var(--stage-ink)' : 'var(--stage-bg)'}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			opacity={shown(i, points.length)}
		/>
	{/each}

	<!-- readouts -->
	<Readout id="best" order={1} label="Best fit" value="k ≈ {fmtK(best.k)} steps">
		<text x={724} y={88} style:font-size="12px" class="muted">best fit (dashed)</text>
		<text x={724} y={114} style:font-size="22px" font-weight="600">k ≈ {fmtK(best.k)}</text>
	</Readout>
	<Readout id="yours" order={2} label="Your line" value="k = {k}" color="var(--ca-cancer)">
		<text x={724} y={156} style:font-size="12px" class="muted">your line</text>
		<text x={724} y={182} style:font-size="22px" font-weight="600" style:fill="var(--ca-cancer)"
			>k = {k}</text
		>
	</Readout>
	<Readout
		id="double"
		order={3}
		label="Twice the age"
		value="×{doubling.toLocaleString('en-US')} the risk"
	>
		<text x={724} y={222} style:font-size="13px">twice the age:</text>
		<text x={724} y={242} style:font-size="13px" font-weight="600"
			>×{doubling.toLocaleString('en-US')} the yearly risk</text
		>
		<text x={724} y={260} style:font-size="11px" class="muted">(2 to the power k − 1)</text>
	</Readout>
	{#if r70}
		<Readout
			id="r70"
			order={4}
			label="Ages 70–74"
			value="{r70.rate.toLocaleString('en-US', { maximumFractionDigits: 0 })} per 100,000 a year"
		>
			<text x={724} y={306} style:font-size="12px" class="muted">ages 70–74</text>
			<text x={724} y={326} style:font-size="13px"
				>{r70.rate.toLocaleString('en-US', { maximumFractionDigits: 0 })} per 100,000 a year</text
			>
		</Readout>
	{/if}
	<Readout id="note">
		{#each wrap(note, 32) as line, i (i)}
			<text x={724} y={372 + i * 17} style:font-size="12px" class="muted">{line}</text>
		{/each}
	</Readout>
	<Readout id="source">
		<Label
			x={X1}
			y={584}
			text="Data: SEER, US National Cancer Institute, diagnoses 2018–2022"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>
</g>
