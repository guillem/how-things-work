<script lang="ts">
	/**
	 * Every part met in the zoom on one ruler: a bar over its measured range and a
	 * dot at the size the drawings use (structures.ts). On the powers-of-ten ruler
	 * each mark is ten times the last; `params.linear` morphs it into an ordinary
	 * ruler (0–0.3 mm), on which everything below a few micrometres piles up at 0.
	 * The morph is a tween; nothing else moves.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { lerp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { STRUCTURES, type Kind } from '../structures';
	import { formatLength, MM } from '../units';

	let { params, reduced }: StageProps = $props();

	const IDS = [
		'liver',
		'leaf',
		'mesophyllCell',
		'hepatocyte',
		'nucleus',
		'redBloodCell',
		'chloroplast',
		'ecoli',
		'mitochondrion',
		'nucleolus',
		'lysosome',
		'granum',
		'nuclearPore',
		'roughER',
		'ribosome',
		'microtubule',
		'atpSynthase',
		'nucleosome',
		'protein',
		'actin',
		'plasmaMembrane',
		'dna',
		'atp',
		'glucose',
		'water'
	];
	const rows = IDS.map((id) => STRUCTURES[id]);
	const X0 = 236;
	const X1 = 932;
	const Y0 = 70;
	const DY = 18;
	const LOG_MIN = -10; // 0.1 nm
	const LOG_MAX = -3; // 1 mm
	const LIN_MAX = 0.3 * MM;
	const logX = (m: number) => X0 + ((Math.log10(m) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (X1 - X0);
	const linX = (m: number) => X0 + (m / LIN_MAX) * (X1 - X0);

	const linear = $derived(Boolean(params.linear));
	const mode = new Tween(0, { duration: 900, easing: cubicInOut });
	$effect(() => {
		const v = linear ? 1 : 0;
		untrack(() => mode.set(v, { duration: reduced ? 0 : 900 }));
	});
	const x = (m: number) => lerp(logX(m), Math.min(linX(m), X1 + 40), mode.current);

	const COLOR: Record<Kind, string> = {
		tissue: '#c2570c',
		cell: '#d6336c',
		organelle: '#7048e8',
		machine: '#1971c2',
		molecule: '#2f9e44'
	};
	const LOG_TICKS = [-10, -9, -8, -7, -6, -5, -4, -3];
	const LIN_TICKS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
	const bottom = Y0 + rows.length * DY + 8;
</script>

<g>
	<Readout
		id="sizes-title"
		order={1}
		label="Ruler"
		value={linear ? 'ordinary: 0 to 0.3 mm' : 'powers of ten: 0.1 nm to 1 mm'}
	>
		<text x="24" y="36" class="title"
			>{linear
				? 'An ordinary ruler: 0 to 0.3 mm'
				: 'Powers of ten: every mark is 10 × the last'}</text
		>
	</Readout>
	<Readout
		id="sizes-span"
		order={2}
		label="From a water molecule to a slice of liver"
		value="0.3 nm → 0.3 mm: × 1,000,000"
	>
		<text x="936" y="36" text-anchor="end" class="muted"
			>water 0.3 nm → liver slice 0.3 mm: × 1,000,000</text
		>
	</Readout>

	<!-- grid -->
	<g opacity={1 - mode.current}>
		{#each LOG_TICKS as e (e)}
			<line
				x1={logX(10 ** e)}
				x2={logX(10 ** e)}
				y1={Y0 - 14}
				y2={bottom}
				stroke="var(--stage-grid)"
				stroke-width="1.5"
			/>
			<text x={logX(10 ** e)} y={bottom + 18} text-anchor="middle" class="tick"
				>{formatLength(10 ** e, 1)}</text
			>
		{/each}
	</g>
	<g opacity={mode.current}>
		{#each LIN_TICKS as v (v)}
			<line
				x1={linX(v * MM)}
				x2={linX(v * MM)}
				y1={Y0 - 14}
				y2={bottom}
				stroke="var(--stage-grid)"
				stroke-width="1.5"
			/>
			<text x={linX(v * MM)} y={bottom + 18} text-anchor="middle" class="tick"
				>{v === 0 ? '0' : formatLength(v * MM)}</text
			>
		{/each}
	</g>
	<line x1={X0} x2={X1} y1={bottom} y2={bottom} stroke="var(--stage-line)" stroke-width="1.5" />

	{#each rows as s, i (s.id)}
		{@const y = Y0 + i * DY}
		{@const lo = s.range?.[0] ?? s.size}
		{@const hi = s.range?.[1] ?? s.size}
		<Readout id="row-{s.id}">
			<text x={X0 - 12} {y} dy="4" text-anchor="end" class="name">{s.name}</text>
		</Readout>
		<line
			x1={x(lo)}
			x2={Math.max(x(hi), x(lo) + 0.01)}
			y1={y}
			y2={y}
			stroke={COLOR[s.kind]}
			stroke-width="6"
			stroke-linecap="round"
			opacity="0.45"
		/>
		<circle
			cx={x(s.size)}
			cy={y}
			r="4.5"
			fill={COLOR[s.kind]}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Readout id="val-{s.id}">
			<text x={Math.min(x(s.size), X1 - 30) + 10} {y} dy="4" class="val" opacity={1 - mode.current}
				>{formatLength(s.size)}</text
			>
		</Readout>
	{/each}

	<!-- key -->
	<Readout
		id="sizes-key"
		order={3}
		label="Colours"
		value="tissues, cells, organelles, machines, molecules"
	>
		{#each Object.entries(COLOR) as [k, c], i (k)}
			<circle cx={250 + i * 146} cy={bottom + 44} r="5" fill={c} />
			<text x={260 + i * 146} y={bottom + 48} class="key"
				>{k === 'machine' ? 'molecular machines' : k === 'tissue' ? 'tissues' : k + 's'}</text
			>
		{/each}
	</Readout>
	{#if mode.current > 0.5}
		<Readout
			id="sizes-pile"
			order={4}
			label="On this ruler"
			value="everything under 1 µm is within 3 px of zero"
		>
			<text
				x={X0 + 20}
				y={Y0 + rows.length * DY - 40}
				class="pile"
				opacity={(mode.current - 0.5) * 2}
				>everything smaller than 1 µm is within 3 pixels of zero</text
			>
		</Readout>
	{/if}
</g>

<style>
	.title {
		font-size: 16px;
		font-weight: 650;
		fill: var(--stage-ink);
	}
	.muted {
		font-size: 13px;
		fill: var(--stage-ink-muted);
	}
	.tick {
		font-size: 12px;
		fill: var(--stage-ink-muted);
	}
	.name {
		font-size: 12.5px;
		fill: var(--stage-ink);
	}
	.val {
		font-size: 11px;
		fill: var(--stage-ink-muted);
	}
	.key {
		font-size: 12px;
		fill: var(--stage-ink);
	}
	.pile {
		font-size: 14px;
		font-weight: 600;
		fill: var(--accent);
	}
</style>
