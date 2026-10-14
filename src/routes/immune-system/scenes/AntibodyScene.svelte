<script lang="ts">
	/**
	 * The two weapons of the adaptive response.
	 *
	 * Left, at true scale (one scale bar for everything): a stretch of a flu
	 * virus's surface with three haemagglutinin spikes (PDB 1RU7) and
	 * antibodies (PDB 1IGT) that drift in and grip the spikes' heads with
	 * the tip of an arm, so the spike can no longer attach to a cell.
	 *
	 * Right, a diagram (not to scale): a killer T cell finds an infected cell
	 * by the viral fragments it displays, docks with its receptors, delivers
	 * its granules, and the infected cell dies. The cycle repeats every PERIOD
	 * seconds. Under reduced motion both panels show the moment of contact.
	 */
	import { Label, clamp, cycle, easeInOut, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SHAPES } from '../shapes';

	let { t, reduced }: StageProps = $props();

	// ---- left: antibodies on the virus, at true size -------------------------------------
	const PX = 11; // drawing units per nm
	const ab = SHAPES.antibody;
	const ha = SHAPES.haemagglutinin;
	const BASE = 520; // the viral membrane, y
	/**
	 * In the outline (stem down) the antibody's two arm tips, where it binds,
	 * are at about (−7.9, −2) and (8.8, −1.5) nm. Turned upside down they
	 * point down at (−8.8, 1.5) and (7.9, 2): so one antibody can grip two
	 * spikes 16.7 nm apart, one with each arm.
	 */
	const TIP_L = 8.8;
	const TIP_R = 7.9;
	const CX = 310;
	const spikes = [CX - TIP_L * PX - 150, CX - TIP_L * PX, CX + TIP_R * PX].map((x, i) => ({
		i,
		x,
		// the spike stands on the membrane: its bottom (stalk end) at BASE
		y: BASE - ha.bottom * PX
	}));
	/** Height of a spike's head top above the page origin. */
	const HEAD_TOP = BASE - (ha.bottom - ha.top) * PX;
	const dock = $derived(reduced ? 1 : easeInOut(clamp((t - 1) / 4)));
	/** The bridging antibody (upside down, an arm on each of two spikes) and a free one. */
	const antibodies = $derived.by(() => {
		const yDock = HEAD_TOP - 1.8 * PX;
		const yFar = yDock - 120;
		return [
			{
				k: 0,
				x: CX + (1 - dock) * 18 * Math.sin(t * 1.3),
				y: yFar + (yDock - yFar) * dock,
				rot: 180 + (1 - dock) * 25
			},
			{
				k: 1,
				x: 96 + 10 * Math.sin(t * 0.9),
				y: 210 + 8 * Math.cos(t * 1.1),
				rot: 160 + 20 * Math.sin(t * 0.5)
			}
		];
	});
	const scaleBar = { x: 40, y: 100, nm: 10 };

	// ---- right: a killer T cell and an infected cell ---------------------------------------
	const PERIOD = 9;
	const ph = $derived(reduced ? 0.42 : cycle(t, PERIOD));
	const approach = $derived(smoothstep(0.05, 0.35, ph));
	const granules = $derived(smoothstep(0.38, 0.55, ph));
	const dying = $derived(smoothstep(0.55, 0.85, ph));
	const reset = $derived(smoothstep(0.9, 1, ph));
	const IC = { x: 800, y: 300 };
	const tcX = $derived(560 + (712 - 560) * approach * (1 - reset));
	const tcY = 300;
	/** Viral fragments displayed on the infected cell's surface (angles, left side). */
	const shown = [150, 180, 210];
</script>

<g>
	<!-- ===================== left: antibodies grip the virus ===================== -->
	<Readout
		id="left-title"
		order={1}
		label="Antibodies (true size)"
		value="grip the virus's spikes so it cannot attach to a cell"
	>
		<text x={40} y={52} font-size="14" font-weight="600">antibodies grip the virus</text>
		<text x={40} y={70} font-size="12" class="muted"
			>drawn at true size, traced from real structures</text
		>
	</Readout>

	<!-- the viral membrane: part of a sphere 100 nm across -->
	<path
		d="M24 {BASE + 2} Q 250 {BASE - 14} 476 {BASE + 2}"
		fill="none"
		stroke="var(--im-virus)"
		stroke-width="7"
		opacity="0.5"
		stroke-linecap="round"
	/>
	{#each spikes as s (s.i)}
		<g transform="translate({s.x} {s.y}) scale({PX})">
			{#each ha.groups as g (g.name)}
				<path
					d={g.d}
					fill={g.name === 'head' ? 'var(--im-virus)' : 'var(--im-infected-edge)'}
					opacity={g.name === 'head' ? 0.85 : 0.55}
					stroke="var(--stage-bg)"
					stroke-width={0.06}
				/>
			{/each}
		</g>
	{/each}
	{#each antibodies as a (a.k)}
		<g transform="translate({a.x} {a.y}) rotate({a.rot}) scale({PX})">
			{#each ab.groups as g (g.name)}
				<path
					d={g.d}
					fill="var(--im-antibody)"
					opacity={g.name === 'heavy' ? 0.9 : 0.55}
					stroke="var(--stage-bg)"
					stroke-width={0.06}
				/>
			{/each}
		</g>
	{/each}

	<Readout id="lbl-ab" label="Green: antibody (IgG, PDB 1IGT)" color="var(--im-antibody)">
		<Label
			x={300}
			y={252}
			text="antibody · PDB 1IGT"
			size={12}
			weight={600}
			color="var(--im-antibody)"
		/>
	</Readout>
	<Readout
		id="lbl-ha"
		label="Red: the flu spike, haemagglutinin (PDB 1RU7)"
		color="var(--im-virus)"
	>
		<Label
			x={24}
			y={HEAD_TOP - 14}
			anchor="start"
			text="spike · PDB 1RU7"
			size={12}
			weight={600}
			color="var(--im-virus)"
		/>
	</Readout>
	<Readout id="lbl-mem">
		<Label x={250} y={556} text="surface of a flu virus (about 100 nm across)" size={11} muted />
	</Readout>
	<Readout id="scalebar" label="Scale bar" value="10 nm">
		<line
			x1={scaleBar.x + 280}
			x2={scaleBar.x + 280 + scaleBar.nm * PX}
			y1={scaleBar.y}
			y2={scaleBar.y}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<text
			x={scaleBar.x + 280 + (scaleBar.nm * PX) / 2}
			y={scaleBar.y - 6}
			font-size="11"
			text-anchor="middle">10 nm</text
		>
	</Readout>
	<g opacity={dock}>
		<Readout id="left-note">
			<text x={330} y={150} font-size="11" class="muted" text-anchor="middle"
				>one antibody can grip two spikes;</text
			>
			<text x={330} y={166} font-size="11" class="muted" text-anchor="middle"
				>a gripped spike cannot latch onto a cell</text
			>
		</Readout>
	</g>

	<!-- divider -->
	<line x1={490} x2={490} y1={40} y2={570} stroke="var(--stage-grid)" />

	<!-- ===================== right: a killer T cell at work ===================== -->
	<Readout
		id="right-title"
		order={2}
		label="Killer T cells (diagram)"
		value="find infected cells by the viral fragments they display, and kill them"
	>
		<text x={512} y={52} font-size="14" font-weight="600"
			>a killer T cell kills an infected cell</text
		>
		<text x={512} y={70} font-size="12" class="muted">diagram, not to scale</text>
	</Readout>

	<!-- the infected cell -->
	<g opacity={1 - 0.75 * dying * (1 - reset)}>
		<circle
			cx={IC.x}
			cy={IC.y}
			r={92 - 22 * dying * (1 - reset)}
			fill="var(--im-infected)"
			stroke="var(--im-infected-edge)"
			stroke-width="1.6"
		/>
		<circle cx={IC.x + 10} cy={IC.y + 6} r="28" fill="var(--im-cell-edge)" opacity="0.45" />
		{#each [0, 1, 2, 3, 4] as k (k)}
			<circle
				cx={IC.x + 30 + (k % 3) * 14}
				cy={IC.y - 40 + Math.floor(k / 3) * 16}
				r="5"
				fill="var(--im-virus)"
			/>
		{/each}
		{#each shown as deg (deg)}
			{@const a = (deg * Math.PI) / 180}
			{@const r = 92 - 22 * dying * (1 - reset)}
			<g
				transform="translate({IC.x + r * Math.cos(a)} {IC.y + r * Math.sin(a)}) rotate({deg + 90})"
			>
				<path
					d="M-8 0 V-10 M8 0 V-10"
					stroke="var(--im-infected-edge)"
					stroke-width="2.4"
					stroke-linecap="round"
				/>
				<rect x={-6} y={-12} width="12" height="8" rx="2" fill="var(--im-virus)" />
			</g>
		{/each}
	</g>
	<Readout
		id="lbl-ic"
		label="Infected cell, showing viral fragments on its surface"
		color="var(--im-infected-edge)"
	>
		<Label
			x={IC.x}
			y={IC.y + 120}
			text="infected cell"
			size={12}
			weight={600}
			color="var(--im-infected-edge)"
		/>
		<Label x={IC.x} y={IC.y + 136} text="shows pieces of viral protein" size={11} muted />
	</Readout>

	<!-- the killer T cell -->
	<g>
		<circle cx={tcX} cy={tcY} r="54" fill="var(--im-tcell)" opacity="0.9" />
		<circle cx={tcX - 10} cy={tcY + 4} r="24" fill="var(--stage-bg)" opacity="0.25" />
		{#each [-30, 0, 30] as d (d)}
			{@const a = (d * Math.PI) / 180}
			<path
				d="M{tcX + 54 * Math.cos(a)} {tcY + 54 * Math.sin(a)} l{10 * Math.cos(a)} {10 *
					Math.sin(a)}"
				stroke="var(--im-tcell)"
				stroke-width="5"
				stroke-linecap="round"
			/>
		{/each}
		{#each [0, 1, 2, 3, 4, 5] as k (k)}
			{@const gx = tcX + 24 + granules * (1 - reset) * (40 + (k % 3) * 8)}
			{@const gy = tcY - 18 + k * 7}
			<circle cx={gx} cy={gy} r="4" fill="var(--im-interferon)" opacity={1 - dying * (1 - reset)} />
		{/each}
	</g>
	<Readout id="lbl-tc" label="Killer T cell" color="var(--im-tcell)">
		<Label
			x={tcX}
			y={tcY + 84}
			text="killer T cell"
			size={12}
			weight={600}
			color="var(--im-tcell)"
		/>
	</Readout>
	<Readout
		id="right-note"
		order={3}
		label="Then"
		value={dying > 0.5
			? 'the infected cell dies before its new viruses are ready'
			: 'its receptors fit the displayed fragment'}
	>
		<text x={512} y={540} font-size="12"
			>{dying > 0.5 && reset < 0.5
				? 'the infected cell dies before its new viruses are ready'
				: granules > 0.3 && reset < 0.5
					? 'it releases granules that make the cell kill itself'
					: 'its receptors fit the fragment the cell displays'}</text
		>
	</Readout>
</g>
