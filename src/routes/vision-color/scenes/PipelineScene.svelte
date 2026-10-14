<script lang="ts">
	/**
	 * From light to colour: a light of one wavelength (`params.nm`, drag it along the spectrum),
	 * the three cone signals it produces (CVRL cone fundamentals), the three opponent channels the
	 * brain builds from them (colour.ts `opponent`), and the colour it looks. Pulses run along the
	 * wires, thicker for stronger signals.
	 *
	 * Phases (`step.hints.phase`):
	 *   opponent — as above.
	 *   summary  — the same, numbered as the whole path from light to colour, with the eye in front.
	 */
	import { Handle, Label, clamp, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cones, opponent, spectralColour } from '../colour';
	import { colourName } from '../steps';

	let { step, t, params, setParam }: StageProps = $props();

	const summary = $derived(step.hints?.phase === 'summary');
	const NMA = 390;
	const NMB = 700;
	const SPEC = { x0: 64, x1: 430, y: 92, h: 24 };
	const xOf = (nm: number) => SPEC.x0 + ((nm - NMA) / (NMB - NMA)) * (SPEC.x1 - SPEC.x0);
	const nmOf = (x: number) => NMA + ((x - SPEC.x0) / (SPEC.x1 - SPEC.x0)) * (NMB - NMA);
	const STOPS = Array.from({ length: 32 }, (_, i) => NMA + i * 10).map((w) => ({
		off: (w - NMA) / (NMB - NMA),
		c: spectralColour(Math.min(w, NMB), 0.95)
	}));

	const nm = $derived(clamp(Number(params.nm ?? 580), NMA, NMB));
	const c = $derived(cones(nm));
	const op = $derived(opponent(c));
	/** The brightest single wavelength's L + M, for scaling the brightness channel. */
	const MAX_BRIGHT = (() => {
		let m = 0;
		for (let w = NMA; w <= NMB; w++) m = Math.max(m, cones(w)[0] + cones(w)[1]);
		return m;
	})();
	const bright = $derived(op.bright / MAX_BRIGHT);

	const KINDS = [
		{ k: 0, id: 'L', color: 'var(--vc-l)' },
		{ k: 1, id: 'M', color: 'var(--vc-m)' },
		{ k: 2, id: 'S', color: 'var(--vc-s)' }
	] as const;
	/** Cone signals as horizontal bars, one row per cone, level with the channels. */
	const BAR = { x: 96, len: 220, h: 26 };

	const CH = { x0: 560, x1: 880, h: 26 };
	const rows = $derived([
		{
			id: 'bright',
			title: 'brightness: L + M',
			left: 'dark',
			right: 'bright',
			value: bright,
			bipolar: false,
			y: 230,
			text: bright > 0.6 ? 'bright' : bright > 0.2 ? 'medium' : 'dim'
		},
		{
			id: 'rg',
			title: 'red or green: L against M',
			left: 'green',
			right: 'red',
			value: op.redGreen,
			bipolar: true,
			y: 330,
			text: Math.abs(op.redGreen) < 0.1 ? 'neither' : op.redGreen > 0 ? 'reddish' : 'greenish'
		},
		{
			id: 'by',
			title: 'blue or yellow: S against L + M',
			left: 'yellow',
			right: 'blue',
			value: op.blueYellow,
			bipolar: true,
			y: 430,
			text: Math.abs(op.blueYellow) < 0.1 ? 'neither' : op.blueYellow > 0 ? 'bluish' : 'yellowish'
		}
	]);
	const markX = (r: { value: number; bipolar: boolean }) =>
		r.bipolar
			? (CH.x0 + CH.x1) / 2 + (clamp(r.value, -1, 1) * (CH.x1 - CH.x0)) / 2
			: CH.x0 + clamp(r.value) * (CH.x1 - CH.x0);

	// Wires from the cones to the channels: + adds, − subtracts.
	const WIRES = [
		{ k: 0, row: 0, sign: '+' },
		{ k: 1, row: 0, sign: '+' },
		{ k: 0, row: 1, sign: '+' },
		{ k: 1, row: 1, sign: '−' },
		{ k: 2, row: 2, sign: '+' },
		{ k: 0, row: 2, sign: '−' },
		{ k: 1, row: 2, sign: '−' }
	] as const;
	const ROW_Y = [230, 330, 430];
	// Where each wire meets its channel: spread a little so that the signs don't overlap.
	const ARRIVE: Record<string, number> = {
		'0-0': -7,
		'1-0': 7,
		'0-1': -7,
		'1-1': 7,
		'2-2': 9,
		'0-2': -9,
		'1-2': 0
	};
	const W0 = BAR.x + BAR.len + 24;
	const W1 = CH.x0 - 34;
	const wires = $derived(
		WIRES.map((w, i) => {
			const key = `${w.k}-${w.row}`;
			const a = { x: W0, y: ROW_Y[w.k] };
			const b = { x: W1, y: ROW_Y[w.row] + ARRIVE[key] };
			const m = (W0 + W1) / 2;
			const d = `M${a.x} ${a.y} C${m} ${a.y} ${m} ${b.y} ${b.x} ${b.y}`;
			const strength = c[w.k];
			const pulses = [0, 0.33, 0.66].map((o) => {
				const u = cycle(t, 2.2, o + i * 0.05);
				const v = 1 - u;
				const p = {
					x: v * v * v * a.x + 3 * v * v * u * m + 3 * v * u * u * m + u * u * u * b.x,
					y: v * v * v * a.y + 3 * v * v * u * a.y + 3 * v * u * u * b.y + u * u * u * b.y
				};
				return { ...p, o: strength * smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u)) };
			});
			return { ...w, key, d, b, strength, pulses };
		})
	);

	const looks = $derived(colourName(nm));
</script>

<g>
	<defs>
		<linearGradient id="pipe-spectrum" x1="0" x2="1" y1="0" y2="0">
			{#each STOPS as s (s.off)}
				<stop offset={s.off} stop-color={s.c} />
			{/each}
		</linearGradient>
		<linearGradient id="pipe-rg" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="#2f9e44" />
			<stop offset="0.5" stop-color="#9a9a9a" />
			<stop offset="1" stop-color="#e03131" />
		</linearGradient>
		<linearGradient id="pipe-by" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="#f2c200" />
			<stop offset="0.5" stop-color="#9a9a9a" />
			<stop offset="1" stop-color="#3b5bdb" />
		</linearGradient>
		<linearGradient id="pipe-bright" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="#1a1a1a" />
			<stop offset="1" stop-color="#f4f4f4" />
		</linearGradient>
	</defs>

	<!-- 1: the light -->
	<Readout id="h1">
		<Label
			x={SPEC.x0}
			y={SPEC.y - 22}
			text={summary ? '1 · light reaches the retina' : 'light of one wavelength'}
			anchor="start"
			size={13}
			weight={600}
		/>
	</Readout>
	<rect
		x={SPEC.x0}
		y={SPEC.y}
		width={SPEC.x1 - SPEC.x0}
		height={SPEC.h}
		rx="4"
		fill="url(#pipe-spectrum)"
	/>
	{#each [400, 500, 600, 700] as w (w)}
		<Readout id="tick-{w}">
			<Label x={xOf(w)} y={SPEC.y + SPEC.h + 18} text="{w} nm" size={10} muted />
		</Readout>
	{/each}
	<Handle
		x={xOf(nm)}
		y={SPEC.y + SPEC.h / 2}
		label="Wavelength"
		value={nm}
		min={NMA}
		max={NMB}
		valuetext="{nm} nanometres, {looks}"
		onmove={(p: Point) => setParam('nm', Math.round(clamp(nmOf(p.x), NMA, NMB)))}
		onkey={(k: number | 'start' | 'end') =>
			setParam('nm', k === 'start' ? NMA : k === 'end' ? NMB : clamp(nm + k, NMA, NMB))}
	/>

	{#if summary}
		<!-- the eye in front: lens and image -->
		<g transform="translate(500 66)" opacity="0.9">
			<circle
				cx="40"
				cy="30"
				r="28"
				fill="var(--vc-humour)"
				stroke="var(--vc-sclera-edge)"
				stroke-width="3"
			/>
			<ellipse cx="22" cy="30" rx="5" ry="10" fill="var(--vc-lens)" stroke="var(--vc-lens-edge)" />
			<path
				d="M-20 22 L22 22 L66 30 M-20 38 L22 38 L66 30"
				fill="none"
				stroke={spectralColour(nm)}
				stroke-width="2"
			/>
			<path d="M67 16 A28 28 0 0 1 67 44" fill="none" stroke="var(--vc-retina)" stroke-width="3" />
		</g>
		<Readout id="eye-cap">
			<Label x={540} y={142} text="the eye focuses it" size={11} muted />
		</Readout>
	{/if}

	<!-- 2: three cone signals -->
	<Readout id="h2">
		<Label
			x={BAR.x - 30}
			y={168}
			text={summary ? '2 · three kinds of cone' : 'cone signals'}
			anchor="start"
			size={13}
			weight={600}
		/>
	</Readout>
	{#each KINDS as kd (kd.id)}
		{@const y = ROW_Y[kd.k]}
		<rect
			x={BAR.x}
			y={y - BAR.h / 2}
			width={BAR.len}
			height={BAR.h}
			rx="5"
			fill="none"
			stroke="var(--stage-grid)"
		/>
		<rect
			x={BAR.x}
			y={y - BAR.h / 2}
			width={BAR.len * c[kd.k]}
			height={BAR.h}
			rx="5"
			fill={kd.color}
		/>
		<Readout id="cone-{kd.id}">
			<Label
				x={BAR.x - 14}
				y={y + 5}
				text={kd.id}
				anchor="end"
				weight={700}
				color={kd.color}
				size={15}
			/>
			<Label
				x={BAR.x + BAR.len}
				y={y - BAR.h / 2 - 8}
				text={c[kd.k].toFixed(2)}
				anchor="end"
				size={11}
				muted
			/>
		</Readout>
	{/each}

	<!-- wires -->
	{#each wires as w (w.key)}
		<path
			d={w.d}
			fill="none"
			stroke={KINDS[w.k].color}
			stroke-width={1 + 2.5 * w.strength}
			opacity="0.35"
		/>
		{#each w.pulses as p, j (j)}
			<circle cx={p.x} cy={p.y} r="3" fill={KINDS[w.k].color} opacity={p.o} />
		{/each}
		<Readout id="sign-{w.key}">
			<text
				x={w.b.x + 10}
				y={w.b.y + 4}
				style:font-size="12px"
				font-weight="700"
				style:fill={KINDS[w.k].color}>{w.sign}</text
			>
		</Readout>
	{/each}

	<!-- 3: the channels -->
	<Readout id="h3">
		<Label
			x={CH.x0}
			y={168}
			text={summary ? '3 · the brain compares them' : 'what the brain compares'}
			anchor="start"
			size={13}
			weight={600}
		/>
	</Readout>
	{#each rows as r, i (r.id)}
		<rect
			x={CH.x0}
			y={r.y - CH.h / 2}
			width={CH.x1 - CH.x0}
			height={CH.h}
			rx="6"
			fill="url(#pipe-{r.id === 'bright' ? 'bright' : r.id})"
			opacity="0.9"
		/>
		{#if r.bipolar}
			<line
				x1={(CH.x0 + CH.x1) / 2}
				y1={r.y - CH.h / 2 - 4}
				x2={(CH.x0 + CH.x1) / 2}
				y2={r.y + CH.h / 2 + 4}
				stroke="var(--stage-ink-muted)"
			/>
		{/if}
		<path
			d="M{markX(r)} {r.y - CH.h / 2 - 2} l-7 -11 h14 Z"
			fill="var(--stage-ink)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<line
			x1={markX(r)}
			y1={r.y - CH.h / 2}
			x2={markX(r)}
			y2={r.y + CH.h / 2}
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>
		<Readout id="ch-{r.id}" label={r.title} value={r.text} order={10 + i}>
			<Label x={CH.x0} y={r.y - CH.h / 2 - 18} text={r.title} anchor="start" size={12} />
			<Label x={CH.x0} y={r.y + CH.h / 2 + 18} text={r.left} anchor="start" size={11} muted />
			<Label x={CH.x1} y={r.y + CH.h / 2 + 18} text={r.right} anchor="end" size={11} muted />
			<Label x={CH.x1} y={r.y - CH.h / 2 - 18} text={r.text} anchor="end" size={12} weight={700} />
		</Readout>
	{/each}

	<!-- 4: the colour -->
	<rect
		x={760}
		y={40}
		width="120"
		height="70"
		rx="10"
		fill={spectralColour(nm)}
		stroke="var(--border)"
	/>
	<Readout
		id="looks"
		label={summary ? 'The colour you see' : 'Looks'}
		value="{looks} ({nm} nm)"
		order={0}
	>
		<Label
			x={748}
			y={64}
			text={summary ? '4 · the colour you see' : 'looks'}
			anchor="end"
			size={13}
			weight={600}
		/>
		<Label x={748} y={84} text={looks} anchor="end" size={13} />
	</Readout>

	{#if summary}
		<Readout id="takeaway">
			<Label
				x={480}
				y={560}
				text="An image like a camera’s, then three numbers per point, compared by the brain: that is colour."
				size={13}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
