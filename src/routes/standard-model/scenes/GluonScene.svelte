<script lang="ts">
	/**
	 * The strong force. Two views (the `strongView` control):
	 *   inside — a proton's three quarks swap gluons, one exchange every PERIOD seconds, the pairs
	 *            taking turns. A gluon carries the emitter's colour and the receiver's anticolour,
	 *            so on arrival the two quarks have swapped colours; the colours are a pure
	 *            function of the number of completed exchanges, and at every instant there is one
	 *            of each. The card lists the colours now.
	 *   pull   — a quark and an antiquark are pulled apart (one cycle of PULL seconds): the gluon
	 *            field between them is a tube of constant width, and the energy stored grows in
	 *            proportion to the distance (the plot, against the electric case, which levels
	 *            off). At SNAP a new quark–antiquark pair appears in the tube and it breaks into
	 *            two mesons. Qualitative: the plot has no numbers.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, smoothstep, clamp } from '#lib/draw/index.ts';
	import type { Colour } from '../particles';
	import { chargeColour, coil, colourName } from './shared';
	import T from './T.svelte';
	import Card from './Card.svelte';

	let { t, params, reduced }: StageProps = $props();

	const view = $derived(params.strongView === 'pull' ? 'pull' : 'inside');
	const wInside = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = view;
		untrack(() => wInside.set(v === 'inside' ? 1 : 0, { duration: reduced ? 0 : 700 }));
	});
	const oIn = $derived(wInside.current);
	const oPull = $derived(1 - wInside.current);

	// ---- inside a proton ---------------------------------------------------------------
	const PERIOD = 2.6;
	const FLIGHT = 1.3;
	const PAIRS: [number, number][] = [
		[0, 1],
		[1, 2],
		[2, 0],
		[1, 0],
		[2, 1],
		[0, 2]
	];
	const CX = 300;
	const CY = 300;
	const POS: [number, number][] = [
		[CX, CY - 120],
		[CX - 125, CY + 80],
		[CX + 125, CY + 80]
	];
	const FLAV = ['u', 'u', 'd'];
	const tt = $derived(reduced ? PERIOD + 0.65 : t);
	const k = $derived(Math.floor(tt / PERIOD));
	const local = $derived(tt - k * PERIOD);
	function coloursAfter(n: number): Colour[] {
		const c: Colour[] = ['r', 'g', 'b'];
		for (let i = 0; i < n % 36; i++) {
			const [a, b] = PAIRS[i % PAIRS.length];
			[c[a], c[b]] = [c[b], c[a]];
		}
		return c;
	}
	const before = $derived(coloursAfter(k));
	const arrived = $derived(local >= FLIGHT);
	// The emitter takes the receiver's colour as it emits (it keeps the anticolour's partner);
	// the receiver changes when the gluon lands. Counting the gluon, one of each throughout.
	const now = $derived.by(() => {
		if (arrived) return coloursAfter(k + 1);
		const c = [...before];
		const [a, b] = PAIRS[k % PAIRS.length];
		c[a] = before[b];
		return c;
	});
	const pair = $derived(PAIRS[k % PAIRS.length]);
	const gluon = $derived.by(() => {
		if (arrived) return null;
		const [a, b] = pair;
		const u = clamp(local / FLIGHT, 0, 1);
		const e = u * u * (3 - 2 * u);
		const [ax, ay] = POS[a];
		const [bx, by] = POS[b];
		return {
			x: ax + (bx - ax) * e,
			y: ay + (by - ay) * e,
			col: before[a],
			anti: before[b],
			path: coil(ax, ay, bx, by, 9, 7),
			fade: smoothstep(0, 0.08, u) * (1 - smoothstep(0.92, 1, u))
		};
	});
	const springs = [
		[0, 1],
		[1, 2],
		[2, 0]
	].map(([a, b]) => ({
		key: `${a}${b}`,
		d: coil(POS[a][0], POS[a][1], POS[b][0], POS[b][1], 10, 6)
	}));
	const jig = (i: number, s: number) =>
		reduced ? 0 : 5 * Math.sin(t * 2.1 + i * 2.3 + s) + 2 * Math.sin(t * 3.3 + i + s);
	const nowText = $derived(now.map((c, i) => `${FLAV[i]} ${colourName(c)}`).join(', '));
	const gluonText = $derived(
		gluon
			? `${colourName(gluon.col)} + ${colourName(gluon.anti, true)}`
			: 'none: the next is coming'
	);

	// ---- pulling a quark out ------------------------------------------------------------
	const PULL = 10;
	const SNAP = 0.62;
	const pu = $derived(reduced ? 0.5 : cycle(t, PULL));
	const stretch = $derived(smoothstep(0.05, SNAP, pu));
	const sep = $derived(90 + 380 * stretch);
	const after = $derived(smoothstep(SNAP, SNAP + 0.06, pu));
	const drift = $derived(smoothstep(SNAP, 1, pu));
	const MX = 300;
	const MY = 260;
	const qx = $derived(MX - sep / 2 - 40 * drift);
	const aqx = $derived(MX + sep / 2 + 40 * drift);
	const tubeLeft = $derived(qx + 30);
	const tubeRight = $derived(aqx - 30);
	// After the snap: the new antiquark sits by the quark, the new quark by the antiquark.
	const nAq = $derived(qx + 70 + 20 * (1 - after));
	const nQ = $derived(aqx - 70 - 20 * (1 - after));
	const pullCaption = $derived(
		pu < SNAP - 0.04
			? ['The field between them is a narrow tube:', 'the energy grows with every bit of distance']
			: pu < SNAP + 0.08
				? ['Enough energy for a new pair (E = mc²):', 'a quark and an antiquark appear']
				: ['Two mesons, and still no free quark']
	);
	// Plot: energy stored against distance.
	const GX = 650;
	const GY = 360;
	const GW = 260;
	const GH = 200;
	const strongCurve = `M${GX} ${GY} L${GX + GW * 0.85} ${GY - GH * 0.9}`;
	const emCurve = Array.from({ length: 40 }, (_, i) => {
		const x = i / 39;
		const y = 1 - 1 / (1 + 6 * x);
		return `${i ? 'L' : 'M'}${(GX + GW * x).toFixed(1)} ${(GY - GH * 0.55 * y).toFixed(1)}`;
	}).join(' ');
	const dotX = $derived(GX + GW * 0.85 * stretch);
	const dotY = $derived(GY - GH * 0.9 * stretch);
</script>

<g>
	<!-- inside a proton -->
	<g opacity={oIn} style:pointer-events={oIn < 0.5 ? 'none' : undefined}>
		{#if oIn > 0.01}
			<circle cx={CX} cy={CY} r="215" fill="var(--sm-field)" opacity="0.7" stroke="var(--border)" />
			<T x={CX} y={CY + 245} text="a proton (u u d)" anchor="middle" size={13} muted />
			{#each springs as s (s.key)}
				<path
					d={s.d}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.6"
					opacity="0.35"
				/>
			{/each}
			{#if gluon}
				<path
					d={gluon.path}
					fill="none"
					stroke="var(--sm-strong)"
					stroke-width="2.5"
					opacity={0.7 * gluon.fade}
				/>
				<g transform="translate({gluon.x} {gluon.y})" opacity={gluon.fade}>
					<path d="M0 -15 A15 15 0 0 0 0 15 Z" fill={chargeColour(gluon.col)} />
					<path d="M0 -15 A15 15 0 0 1 0 15 Z" fill={chargeColour(gluon.anti, true)} />
					<circle r="15" fill="none" stroke="var(--stage-bg)" stroke-width="2" />
				</g>
			{/if}
			{#each POS as [x, y], i (i)}
				<g transform="translate({x + jig(i, 0)} {y + jig(i, 1.3)})">
					<circle r="44" fill={chargeColour(now[i])} stroke="var(--stage-bg)" stroke-width="3" />
					<text
						y="10"
						text-anchor="middle"
						font-weight="700"
						style:font-size="30px"
						style:fill="var(--sm-ball-ink)">{FLAV[i]}</text
					>
				</g>
			{/each}

			<Readout id="card-1"><Card x={600} y={60} w={340} h={300} /></Readout>
			<T x={620} y={96} text="Colours right now" size={13} muted />
			{#each now as c, i (i)}
				<circle cx={636 + i * 34} cy={128} r="13" fill={chargeColour(c)} />
				<text
					x={636 + i * 34}
					y={133}
					text-anchor="middle"
					font-weight="700"
					style:font-size="13px"
					style:fill="var(--sm-ball-ink)">{FLAV[i]}</text
				>
			{/each}
			<Readout
				id="now"
				order={1}
				label="Colours now"
				value={nowText}
				note="counting the gluon in flight, always one of each: colourless"
			>
				<T
					x={746}
					y={124}
					text={gluon ? 'with the gluon:' : 'one of each:'}
					size={13}
					weight={600}
					color="var(--sm-ok)"
				/>
				<T
					x={746}
					y={142}
					text={gluon ? 'one of each ✓' : 'colourless ✓'}
					size={13}
					weight={600}
					color="var(--sm-ok)"
				/>
			</Readout>
			<T x={620} y={190} text="Gluon in flight" size={13} muted />
			<Readout id="gluon" order={2} label="Gluon in flight" value={gluonText}>
				<T
					x={620}
					y={214}
					text={gluonText}
					size={14}
					weight={600}
					color={gluon ? 'var(--sm-strong)' : undefined}
				/>
			</Readout>
			<Readout id="inside-note">
				<T x={620} y={258} text="It carries the emitter's colour and the" size={12} />
				<T x={620} y={276} text="receiver's anticolour: when it lands," size={12} />
				<T x={620} y={294} text="the two quarks have swapped colours." size={12} />
				<T x={620} y={332} text="Exchanges so far: {k + (arrived ? 1 : 0)}" size={12} muted />
			</Readout>
		{/if}
	</g>

	<!-- pulling a quark out -->
	<g opacity={oPull} style:pointer-events={oPull < 0.5 ? 'none' : undefined}>
		{#if oPull > 0.01}
			{#if after < 1}
				<rect
					x={tubeLeft}
					y={MY - 14}
					width={Math.max(0, tubeRight - tubeLeft)}
					height="28"
					rx="14"
					fill="var(--sm-strong)"
					opacity={0.35 * (1 - after)}
				/>
			{/if}
			{#if after > 0}
				<rect
					x={qx + 30}
					y={MY - 14}
					width={Math.max(0, nAq - qx - 60)}
					height="28"
					rx="14"
					fill="var(--sm-strong)"
					opacity={0.35 * after}
				/>
				<rect
					x={nQ + 30}
					y={MY - 14}
					width={Math.max(0, aqx - nQ - 60)}
					height="28"
					rx="14"
					fill="var(--sm-strong)"
					opacity={0.35 * after}
				/>
				<g opacity={after}>
					<circle
						cx={nAq}
						cy={MY}
						r="28"
						fill={chargeColour('r', true)}
						stroke="var(--stage-bg)"
						stroke-width="3"
					/>
					<text
						x={nAq}
						y={MY + 7}
						text-anchor="middle"
						font-weight="700"
						style:font-size="20px"
						style:fill="var(--sm-ball-ink)">ū</text
					>
					<circle
						cx={nQ}
						cy={MY}
						r="28"
						fill={chargeColour('r')}
						stroke="var(--stage-bg)"
						stroke-width="3"
					/>
					<text
						x={nQ}
						y={MY + 7}
						text-anchor="middle"
						font-weight="700"
						style:font-size="20px"
						style:fill="var(--sm-ball-ink)">u</text
					>
				</g>
			{/if}
			<circle
				cx={qx}
				cy={MY}
				r="30"
				fill={chargeColour('r')}
				stroke="var(--stage-bg)"
				stroke-width="3"
			/>
			<text
				x={qx}
				y={MY + 8}
				text-anchor="middle"
				font-weight="700"
				style:font-size="22px"
				style:fill="var(--sm-ball-ink)">d</text
			>
			<circle
				cx={aqx}
				cy={MY}
				r="30"
				fill={chargeColour('r', true)}
				stroke="var(--stage-bg)"
				stroke-width="3"
			/>
			<text
				x={aqx}
				y={MY + 8}
				text-anchor="middle"
				font-weight="700"
				style:font-size="22px"
				style:fill="var(--sm-ball-ink)">ū</text
			>
			{#if after > 0.5}
				<T x={(qx + nAq) / 2} y={MY + 62} text="meson" anchor="middle" size={12} muted />
				<T x={(nQ + aqx) / 2} y={MY + 62} text="meson" anchor="middle" size={12} muted />
			{/if}
			<Readout id="pull-caption" order={1} label="Pulling" value={pullCaption.join(' ')}>
				{#each pullCaption as line, i (i)}
					<T
						x={MX}
						y={120 + i * 20}
						text={line}
						anchor="middle"
						size={14}
						weight={i === 0 ? 600 : 500}
					/>
				{/each}
			</Readout>

			<Readout id="card-2"><Card x={620} y={110} w={316} h={300} /></Readout>
			<T x={GX - 12} y={140} text="Energy stored, against distance" size={13} weight={600} />
			<line x1={GX} x2={GX + GW} y1={GY} y2={GY} stroke="var(--stage-line)" />
			<line x1={GX} x2={GX} y1={GY} y2={GY - GH} stroke="var(--stage-line)" />
			<T x={GX + GW} y={GY + 20} text="distance →" anchor="end" size={11} muted />
			<path d={emCurve} fill="none" stroke="var(--sm-em)" stroke-width="2" stroke-dasharray="6 5" />
			<path d={strongCurve} fill="none" stroke="var(--sm-strong)" stroke-width="3" />
			<circle cx={dotX} cy={dotY} r="6" fill="var(--sm-strong)" opacity={1 - after} />
			<Readout id="plot-key">
				<T
					x={GX + 12}
					y={GY - GH * 0.86}
					text="quarks: keeps rising"
					size={12}
					color="var(--sm-strong)"
					weight={600}
				/>
				<T
					x={GX + GW}
					y={GY - GH * 0.36}
					text="electric: levels off"
					anchor="end"
					size={12}
					color="var(--sm-em)"
					weight={600}
				/>
				<T x={GX + 40} y={GY + 38} text="(shapes only, no scale)" size={11} muted />
			</Readout>
		{/if}
	</g>
</g>
