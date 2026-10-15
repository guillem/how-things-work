<script lang="ts">
	/**
	 * Five times as much (steps budget, candidates). Left on `budget`: dark ÷
	 * visible from three independent measurements, as bars of one visible unit
	 * plus N dark units: the best-fit halos of the four SPARC galaxies (Υ = 0.5,
	 * `bestHalo`), the Bullet Cluster's lensing (`lensing.ts`) and Planck's
	 * cosmic budget (`cosmicBudget`). On `candidates` the bars give way to
	 * three cards: what is ruled out, what is searched for, the alternative.
	 * Right: the universe's content as a ring. The bars and the ring grow in at
	 * the start of the step (one-shot).
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GALAXIES, ML_DISK_DEFAULT, bestHalo, cosmicBudget, galaxy } from '../galaxies';
	import { DARK_NEEDED, FIELD_VISIBLE } from '../lensing';
	import Card from './Card.svelte';

	let { step, t, reduced }: StageProps = $props();

	const what = $derived(step.hints?.phase === 'what');
	const tt = $derived(reduced ? 2.5 : t);
	const grow = (delay: number) => (reduced ? 1 : smoothstep(delay, delay + 0.9, tt));

	const cosmic = cosmicBudget();
	const rows = [
		...GALAXIES.map((g) => ({
			id: g.id,
			group: 'galaxies',
			label: g.name,
			ratio: bestHalo(galaxy(g.id), ML_DISK_DEFAULT).ratio
		})),
		{ id: 'bullet', group: 'bullet', label: 'Bullet Cluster', ratio: DARK_NEEDED / FIELD_VISIBLE },
		{ id: 'cmb', group: 'cmb', label: 'Whole universe', ratio: cosmic.ratio }
	];
	const GROUPS: Record<string, { title: string; note: string; y: number }> = {
		galaxies: {
			title: 'Galaxy rotation curves',
			note: 'at least: best-fit halo inside the last measured point only',
			y: 92
		},
		bullet: { title: 'Lensing by a cluster', note: 'Hubble field of the Bullet Cluster', y: 288 },
		cmb: { title: 'Cosmic microwave background', note: 'Planck satellite, 2018', y: 388 }
	};
	const rowY = (i: number) => (i < 4 ? 128 + i * 34 : i === 4 ? 322 : 422);
	const BX = 150;
	const UNIT = 46;

	// ---- the ring -----------------------------------------------------------------
	const RCX = 790;
	const RCY = 300;
	const RR = 112;
	const parts = [
		{ id: 'ord', label: 'ordinary matter', frac: cosmic.ordinary, color: 'var(--dm-visible)' },
		{ id: 'dm', label: 'dark matter', frac: cosmic.dark, color: 'var(--dm-halo)' },
		{
			id: 'de',
			label: 'dark energy',
			frac: cosmic.darkEnergy,
			color: 'var(--dm-kepler)'
		}
	];
	const arc = (a0: number, a1: number) => {
		const p = (a: number) =>
			`${(RCX + RR * Math.sin(a)).toFixed(1)} ${(RCY - RR * Math.cos(a)).toFixed(1)}`;
		return `M${p(a0)} A${RR} ${RR} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
	};
	const ringU = $derived(grow(what ? 0 : 1.2));
	const segs = $derived.by(() => {
		let a = 0;
		return parts.map((p) => {
			const a0 = a;
			a += p.frac * 2 * Math.PI;
			const a1 = Math.min(a, ringU * 2 * Math.PI);
			return { ...p, d: a1 > a0 + 1e-3 ? arc(a0, a1 - 0.02) : '', mid: (a0 + a) / 2 };
		});
	});
	const galaxyRow = rows
		.slice(0, 4)
		.map((r) => `${r.label} ${r.ratio.toFixed(1)}×`)
		.join(', ');
	const pct = (f: number) => `${(100 * f).toFixed(1)}%`;

	const CARDS = [
		{
			id: 'out',
			title: 'Ruled out as the main part',
			color: 'var(--dm-visible)',
			lines: [
				'dim stars, planets, cold gas: all ordinary',
				'matter, capped at 4.9% by the early universe',
				'compact dark objects: too few seen by',
				'microlensing surveys such as EROS-2'
			]
		},
		{
			id: 'search',
			title: 'Searched for, not yet found',
			color: 'var(--dm-halo)',
			lines: [
				'new particles that feel gravity but not light:',
				'WIMPs (underground xenon detectors such as LZ,',
				'and particle colliders), axions (microwave',
				'cavities in strong magnetic fields)'
			]
		},
		{
			id: 'alt',
			title: 'The alternative: change gravity',
			color: 'var(--dm-model)',
			lines: [
				'MOND (Milgrom 1983) fits rotation curves well',
				'without a halo, but not the Bullet Cluster’s',
				'offset lensing or the microwave background',
				'without extra unseen matter of its own'
			]
		}
	];
</script>

<g>
	{#if !what}
		<Readout
			id="title"
			order={1}
			label="Dark ÷ visible matter"
			value="three independent measurements"
		>
			<Label
				anchor="start"
				x={24}
				y={40}
				text="Dark matter ÷ visible matter, measured three ways"
				size={16}
				weight={700}
			/>
		</Readout>
		{#each Object.entries(GROUPS) as [id, gr] (id)}
			<Label anchor="start" x={24} y={gr.y} text={gr.title} size={13.5} weight={700} />
			<Label anchor="start" x={24} y={gr.y + 17} text={gr.note} size={11.5} muted />
		{/each}
		{#each rows as r, i (r.id)}
			{@const yy = rowY(i)}
			{@const u = grow(0.2 + i * 0.18)}
			<Label x={BX - 12} y={yy + 15} text={r.label} size={12.5} anchor="end" />
			<rect x={BX} y={yy} width={UNIT * u} height="20" rx="3" fill="var(--dm-visible)" />
			<rect
				x={BX + UNIT}
				y={yy}
				width={Math.max(0, UNIT * r.ratio * u)}
				height="20"
				rx="3"
				fill="var(--dm-halo)"
				opacity={u > 0 ? 0.85 : 0}
			/>
			{#each Array.from({ length: Math.floor(r.ratio) }, (_, k) => k + 1) as k (k)}
				<line
					x1={BX + UNIT * (1 + k)}
					x2={BX + UNIT * (1 + k)}
					y1={yy}
					y2={yy + 20}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
					opacity={u}
				/>
			{/each}
			<Readout
				id="row-{r.id}"
				order={2 + i}
				label={i === 0 ? 'Galaxy rotation' : i < 4 ? undefined : r.label}
				value={i === 0 ? galaxyRow : `${r.ratio.toFixed(1)} ×`}
				color="var(--dm-halo)"
			>
				<Label
					anchor="start"
					x={BX + UNIT * (1 + r.ratio) * u + 10}
					y={yy + 15}
					text="{r.ratio.toFixed(1)} ×"
					size={14}
					weight={700}
					color="var(--dm-halo)"
					opacity={u}
				/>
			</Readout>
		{/each}
		<Readout id="key">
			<rect x={24} y={478} width="16" height="12" rx="2" fill="var(--dm-visible)" />
			<Label
				anchor="start"
				x={46}
				y={489}
				text="one unit: all the visible matter (stars and gas)"
				size={12}
				muted
			/>
			<rect x={24} y={500} width="16" height="12" rx="2" fill="var(--dm-halo)" opacity="0.85" />
			<Label
				anchor="start"
				x={46}
				y={511}
				text="each further unit: as much again of dark matter"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={24}
				y={548}
				text="Galaxies: SPARC (Lelli et al. 2016), stars at 0.5 Suns per Sun of light."
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={24}
				y={566}
				text="Cluster: Bradač et al. 2006. Universe: Planck Collaboration 2020."
				size={11}
				muted
			/>
		</Readout>
	{:else}
		<Readout
			id="title2"
			order={1}
			label="What could it be?"
			value="ruled out, searched for, the alternative"
		>
			<Label
				anchor="start"
				x={24}
				y={40}
				text="What could the dark matter be?"
				size={16}
				weight={700}
			/>
		</Readout>
		{#each CARDS as c, i (c.id)}
			{@const y0 = 64 + i * 172}
			{@const o = grow(0.15 + i * 0.3)}
			<g opacity={o}>
				<Card x={24} y={y0} w={600} h={156} />
				<rect x={24} y={y0 + 14} width="5" height={128} rx="2" fill={c.color} />
				<Readout id="card-{c.id}" order={2 + i} label={c.title} value={c.lines.join(' ')}>
					<Label
						anchor="start"
						x={44}
						y={y0 + 36}
						text={c.title}
						size={14}
						weight={700}
						color={c.color}
					/>
					{#each c.lines as line, k (k)}
						<Label anchor="start" x={44} y={y0 + 64 + k * 22} text={line} size={12.5} />
					{/each}
				</Readout>
			</g>
		{/each}
	{/if}

	<!-- the universe's content -->
	<Readout id="ring-title">
		<Label
			x={RCX}
			y={RCY - RR - 54}
			text="What the universe is made of"
			size={14}
			weight={700}
			anchor="middle"
		/>
		<Label x={RCX} y={RCY - RR - 34} text="Planck 2018" size={12} anchor="middle" muted />
	</Readout>
	<circle cx={RCX} cy={RCY} r={RR} fill="none" stroke="var(--stage-grid)" stroke-width="30" />
	{#each segs as sg (sg.id)}
		{#if sg.d}
			<path
				d={sg.d}
				fill="none"
				stroke={sg.color}
				stroke-width="30"
				opacity={sg.id === 'de' ? 0.45 : 0.9}
			/>
		{/if}
	{/each}
	<Readout id="ring-ratio">
		<Label
			x={RCX}
			y={RCY - 4}
			text="{cosmic.ratio.toFixed(1)} ×"
			size={28}
			weight={700}
			anchor="middle"
			color="var(--dm-halo)"
			opacity={ringU}
		/>
		<Label
			x={RCX}
			y={RCY + 18}
			text="dark ÷ ordinary"
			size={12}
			anchor="middle"
			muted
			opacity={ringU}
		/>
	</Readout>
	{#each parts as p, i (p.id)}
		<Readout
			id="ring-{p.id}"
			order={10 + i}
			label={i === 0 ? 'The universe' : undefined}
			value={i === 0 ? parts.map((q) => `${pct(q.frac)} ${q.label}`).join(', ') : undefined}
		>
			<rect
				x={RCX - 100}
				y={RCY + RR + 40 + i * 24}
				width="14"
				height="14"
				rx="3"
				fill={p.color}
				opacity={p.id === 'de' ? 0.45 : 0.9}
			/>
			<Label anchor="start" x={RCX - 78} y={RCY + RR + 52 + i * 24} text={p.label} size={12.5} />
			<Label
				x={RCX + 110}
				y={RCY + RR + 52 + i * 24}
				text={pct(p.frac)}
				size={12.5}
				weight={700}
				anchor="end"
			/>
		</Readout>
	{/each}
</g>
