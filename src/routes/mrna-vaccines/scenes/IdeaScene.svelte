<script lang="ts">
	/**
	 * Step "rehearsal": the virus and the vaccine side by side, at the same
	 * scale (2.2 px per nm). Left, a coronavirus particle about 100 nm across
	 * with its spikes (the traced 6VSB outline, true size) and its long RNA
	 * genome coiled inside; right, a lipid nanoparticle of about 90 nm with a
	 * few copies of the one short message. Below, the spike enlarged: the piece
	 * both show the immune system.
	 */
	import { TAU, cycle, hash } from '#lib/draw/index.ts';
	import Tag from './Tag.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SHAPES } from '../data';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 2.5 : t);

	const NM = 2.2; // px per nm in the two particles
	const pre = SHAPES.prefusion;

	const VIRUS = { x: 250, y: 250, r: 50 * NM };
	const LNP = { x: 710, y: 250, r: 45 * NM };

	/** Spikes around the virus: base on the membrane, pointing out. */
	const SPIKES = Array.from({ length: 16 }, (_, i) => ({
		k: i,
		a: (i / 16) * TAU + 0.15 * hash(i, 3)
	}));

	/** The coiled genome: a long random-walk curve inside the virus. */
	const genome = (() => {
		let d = '';
		const n = 420;
		for (let i = 0; i <= n; i++) {
			const u = i / n;
			const a = u * TAU * 5.3 + 0.6 * Math.sin(u * TAU * 2.1);
			const rr =
				(0.2 + 0.62 * Math.abs(Math.sin(u * TAU * 3.7 + 0.9 * Math.sin(u * TAU * 1.3)))) *
				VIRUS.r *
				0.85;
			const x = VIRUS.x + Math.cos(a) * rr;
			const y = VIRUS.y + Math.sin(a) * rr;
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	})();

	/** Copies of the message inside the particle (short wavy strands). */
	const STRANDS = [
		{ k: 0, x: -40, y: -30, a: 0.3 },
		{ k: 1, x: 20, y: 10, a: -0.4 },
		{ k: 2, x: -20, y: 40, a: 0.1 },
		{ k: 3, x: 30, y: -45, a: 1.1 }
	];
	const strand = (s: (typeof STRANDS)[number], tt: number) => {
		let d = '';
		for (let i = 0; i <= 24; i++) {
			const u = i / 24 - 0.5;
			const wob = Math.sin(u * 14 + tt * 1.2 + s.k) * 5;
			const x = u * 70;
			const y = wob;
			const ca = Math.cos(s.a);
			const sa = Math.sin(s.a);
			d += `${i ? 'L' : 'M'}${(LNP.x + s.x + x * ca - y * sa).toFixed(1)} ${(LNP.y + s.y + x * sa + y * ca).toFixed(1)}`;
		}
		return d;
	};

	/** Lipids on the rim of the particle. */
	const LIPIDS = Array.from({ length: 64 }, (_, i) => ({ k: i, a: (i / 64) * TAU }));

	const turn = $derived(cycle(time, 60) * TAU * 0.15);
	const sway = (k: number) => Math.sin(time * 0.9 + k) * 3;

	// the enlarged spike, bottom centre
	const BIG = 6.5;
	const bigX = 480;
	const bigY = 488;
</script>

<g>
	<!-- the virus -->
	<g transform="rotate({(turn * 180) / Math.PI} {VIRUS.x} {VIRUS.y})">
		{#each SPIKES as s (s.k)}
			{@const deg = (s.a * 180) / Math.PI + 90 + sway(s.k)}
			<g
				transform="translate({VIRUS.x + Math.cos(s.a) * VIRUS.r} {VIRUS.y +
					Math.sin(s.a) * VIRUS.r}) rotate({deg}) scale({NM}) translate(0 {-pre.bottom})"
			>
				{#each pre.groups as g (g.name)}
					<path
						d={g.d}
						fill={g.name === 'S1' ? 'var(--mv-s1)' : 'var(--mv-s2)'}
						stroke="var(--stage-bg)"
						stroke-width="0.5"
						vector-effect="non-scaling-stroke"
					/>
				{/each}
			</g>
		{/each}
		<circle
			cx={VIRUS.x}
			cy={VIRUS.y}
			r={VIRUS.r}
			fill="var(--im-infected)"
			stroke="var(--im-virus)"
			stroke-width="2"
		/>
		<path
			d={genome}
			fill="none"
			stroke="var(--im-virus)"
			stroke-width="1.2"
			opacity="0.75"
			stroke-linejoin="round"
		/>
	</g>

	<!-- the vaccine particle -->
	<circle
		cx={LNP.x}
		cy={LNP.y}
		r={LNP.r}
		fill="var(--mv-lnp)"
		stroke="var(--mv-lnp-edge)"
		stroke-width="1.5"
	/>
	{#each LIPIDS as l (l.k)}
		<circle
			cx={LNP.x + Math.cos(l.a) * (LNP.r - 4)}
			cy={LNP.y + Math.sin(l.a) * (LNP.r - 4)}
			r="3.2"
			fill="var(--mv-lnp-edge)"
		/>
	{/each}
	{#each STRANDS as s (s.k)}
		<path
			d={strand(s, time)}
			fill="none"
			stroke="var(--mv-mrna)"
			stroke-width="3"
			stroke-linecap="round"
		/>
	{/each}

	<!-- captions -->
	<Readout
		id="virus"
		order={1}
		label="The virus"
		value="a genome of 29,903 letters for about 30 proteins; it copies itself in your cells"
	>
		<Tag x={VIRUS.x} y={36} text="the virus" size={16} weight={600} />
		<Tag
			x={VIRUS.x}
			y={56}
			text="genome: 29,903 letters of RNA, about 30 proteins"
			size={12}
			muted
		/>
		<Tag x={VIRUS.x} y={418} text="copies itself, spreads, makes you ill" size={12} />
	</Readout>
	<Readout
		id="vaccine"
		order={2}
		label="The mRNA vaccine"
		value="copies of one message of about 4,300 letters, for one protein: the spike; it cannot copy itself"
	>
		<Tag x={LNP.x} y={36} text="the mRNA vaccine" size={16} weight={600} />
		<Tag x={LNP.x} y={56} text="one message: about 4,300 letters, one protein" size={12} muted />
		<Tag x={LNP.x} y={418} text="cannot copy itself; gone in days" size={12} />
	</Readout>

	<!-- scale bar -->
	<Readout id="scale">
		<line
			x1={430}
			x2={430 + 50 * NM}
			y1={110}
			y2={110}
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<line x1={430} x2={430} y1={105} y2={115} stroke="var(--stage-ink-muted)" />
		<line x1={430 + 50 * NM} x2={430 + 50 * NM} y1={105} y2={115} stroke="var(--stage-ink-muted)" />
		<Tag x={430 + 25 * NM} y={98} text="50 nm" size={11} muted />
	</Readout>

	<!-- the spike, enlarged -->
	<g transform="translate({bigX} {bigY}) scale({BIG}) translate(0 {-(pre.top + pre.bottom) / 2})">
		{#each pre.groups as g (g.name)}
			<path
				d={g.d}
				fill={g.name === 'S1' ? 'var(--mv-s1)' : 'var(--mv-s2)'}
				stroke="var(--stage-bg)"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
		{/each}
	</g>
	<path
		d="M310 410 C 340 450, 380 476, 425 484"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-dasharray="4 4"
		marker-end="url(#arrowhead)"
	/>
	<path
		d="M650 410 C 620 450, 580 476, 535 484"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-dasharray="4 4"
		marker-end="url(#arrowhead)"
	/>
	<Readout
		id="spike"
		order={3}
		label="Shared by both"
		value="the spike protein: what the immune system learns to recognise"
	>
		<Tag x={bigX + 64} y={528} text="the spike protein" size={14} weight={600} anchor="start" />
		<Tag
			x={bigX + 64}
			y={546}
			text="what both show the immune system"
			size={12}
			anchor="start"
			muted
		/>
		<Tag
			x={bigX + 64}
			y={563}
			text="(traced from PDB 6VSB, 6.5× enlarged)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
</g>
