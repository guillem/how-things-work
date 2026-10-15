<script lang="ts">
	/**
	 * Zooming into matter, in four panels (not to scale): an atom (a fuzzy electron cloud and a
	 * nucleus too small to see), a nucleus of protons and neutrons, a proton of three quarks
	 * (u u d, one of each colour) tied by gluons, and a quark or electron, a point with no
	 * measured size. Dashed wedges join each panel to the part of the previous one it enlarges.
	 * Below: the three particles that everyday matter is made of.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { hash, Label, TAU } from '#lib/draw/index.ts';
	import { protonRadius } from '../particles';
	import { chargeColour, coil } from './shared';

	let { t, reduced }: StageProps = $props();

	const PY = 230;
	const R = 92;
	const PX = [126, 366, 606, 846];
	const dash = $derived(reduced ? 0 : -t * 14);

	// atom: a swarm of electron dots (never orbits)
	const cloud = $derived.by(() => {
		let d = '';
		for (let i = 0; i < 6; i++) {
			const a = hash(i, 1) * TAU;
			const r = 26 + 52 * hash(i, 2);
			const x =
				PX[0] +
				r * Math.cos(a) +
				(reduced ? 0 : 9 * Math.sin(t * (0.5 + hash(i, 3)) + 6 * hash(i, 4)));
			const y =
				PY +
				r * Math.sin(a) +
				(reduced ? 0 : 9 * Math.cos(t * (0.6 + hash(i, 5)) + 6 * hash(i, 6)));
			d += `M${(x - 5).toFixed(1)} ${y.toFixed(1)}a5 5 0 1 0 10 0a5 5 0 1 0 -10 0`;
		}
		return d;
	});

	// nucleus: carbon-12, 6 protons and 6 neutrons, packed
	const nucleons = Array.from({ length: 12 }, (_, i) => {
		const r = 17 * Math.sqrt(i + 0.5);
		const a = i * 2.39996;
		return { i, x: r * Math.cos(a), y: r * Math.sin(a), p: [0, 3, 4, 7, 9, 10].includes(i) };
	}).reverse();
	const jig = (i: number, s: number) => (reduced ? 0 : 1.5 * Math.sin(t * 6 + i * 1.7 + s));

	// proton: three quarks
	const QR = 22;
	const QP: [number, number][] = [
		[PX[2], PY - 40],
		[PX[2] - 40, PY + 28],
		[PX[2] + 40, PY + 28]
	];
	const qj = (i: number, s: number) => (reduced ? 0 : 3 * Math.sin(t * 2.2 + i * 2.1 + s));
	const springs = [
		[0, 1],
		[1, 2],
		[2, 0]
	].map(([a, b]) => ({ key: `${a}${b}`, d: coil(QP[a][0], QP[a][1], QP[b][0], QP[b][1], 5, 4) }));

	// wedges: from a small circle in panel i to the edge of panel i + 1
	const SRC: [number, number, number][] = [
		[PX[0], PY, 8],
		[PX[1] + 18, PY - 4, 12],
		[PX[2], PY - 40, 10]
	];
	const wedge = (i: number) => {
		const [sx, sy, sr] = SRC[i];
		const tx = PX[i + 1];
		return [`M${sx} ${sy - sr} L${tx - 30} ${PY - R}`, `M${sx} ${sy + sr} L${tx - 30} ${PY + R}`];
	};
	const radiusFm = protonRadius.fm.toFixed(2);
</script>

<g>
	{#each [0, 1, 2] as i (i)}
		{#each wedge(i) as d, j (j)}
			<path
				{d}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="4 5"
				stroke-dashoffset={dash}
				opacity="0.7"
			/>
		{/each}
	{/each}

	{#each PX as x, i (i)}
		<circle cx={x} cy={PY} r={R} fill="var(--surface)" stroke="var(--border)" stroke-width="1.5" />
	{/each}

	{#each [0, 1, 2] as i (i)}
		<circle
			cx={SRC[i][0]}
			cy={SRC[i][1]}
			r={SRC[i][2]}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
		/>
	{/each}

	<!-- atom -->
	<circle cx={PX[0]} cy={PY} r={R - 6} fill="var(--sm-lepton)" opacity="0.1" />
	<path d={cloud} fill="var(--sm-lepton)" />
	<circle cx={PX[0]} cy={PY} r="2.5" fill="var(--stage-ink)" />

	<!-- nucleus -->
	{#each nucleons as b (b.i)}
		<circle
			cx={PX[1] + b.x + jig(b.i, 0)}
			cy={PY + b.y + jig(b.i, 2)}
			r="15"
			fill={b.p ? 'var(--sm-red)' : 'var(--stage-ink-muted)'}
			stroke="var(--stage-bg)"
			stroke-width="2"
			opacity={b.p ? 0.85 : 0.6}
		/>
	{/each}

	<!-- proton -->
	<circle cx={PX[2]} cy={PY} r={R - 10} fill="var(--sm-field)" />
	{#each springs as s (s.key)}
		<path d={s.d} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.5" opacity="0.6" />
	{/each}
	{#each QP as [x, y], i (i)}
		<circle
			cx={x + qj(i, 0)}
			cy={y + qj(i, 1)}
			r={QR}
			fill={chargeColour((['r', 'g', 'b'] as const)[i])}
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<text
			x={x + qj(i, 0)}
			y={y + qj(i, 1) + 7}
			text-anchor="middle"
			font-weight="700"
			style:font-size="19px"
			style:fill="var(--sm-ball-ink)">{['u', 'u', 'd'][i]}</text
		>
	{/each}

	<!-- a point -->
	<circle cx={PX[3]} cy={PY} r="4" fill="var(--sm-quark)" />
	<circle
		cx={PX[3]}
		cy={PY}
		r={reduced ? 22 : 14 + 8 * ((t * 0.6) % 1)}
		fill="none"
		stroke="var(--sm-quark)"
		opacity={reduced ? 0.4 : 1 - ((t * 0.6) % 1)}
	/>

	<!-- captions -->
	{#each [{ title: 'Atom', size: 'about 10⁻¹⁰ m', note: 'electrons around a nucleus' }, { title: 'Nucleus', size: '10⁻¹⁵ to 10⁻¹⁴ m', note: 'protons and neutrons' }, { title: 'Proton', size: `radius ${radiusFm} × 10⁻¹⁵ m`, note: 'two up quarks, one down' }, { title: 'Quark, electron', size: 'no size measured', note: 'smaller than 10⁻¹⁸ m' }] as c, i (i)}
		<Readout id="cap-{i}" order={i + 1} label={c.title} value={c.size} note={c.note}>
			<Label x={PX[i]} y={PY + R + 30} text={c.title} anchor="middle" size={15} weight={700} />
			<Label x={PX[i]} y={PY + R + 50} text={c.size} anchor="middle" size={13} />
			<Label x={PX[i]} y={PY + R + 68} text={c.note} anchor="middle" size={12} muted />
		</Readout>
	{/each}
	<Readout id="scale">
		<Label
			x={480}
			y={60}
			text="Zooming in (not to scale: each step is a few to 100,000 times smaller)"
			anchor="middle"
			size={13}
			muted
		/>
	</Readout>

	<!-- everyday matter -->
	<rect
		x={210}
		y={478}
		width={540}
		height={92}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="everyday"
		order={5}
		label="Everything you touch"
		value="up quarks, down quarks and electrons"
	>
		<Label
			x={480}
			y={506}
			text="Everything you have ever touched is made of"
			anchor="middle"
			size={14}
			weight={600}
		/>
	</Readout>
	{#each [{ s: 'u', name: 'up quark', c: 'var(--sm-quark)' }, { s: 'd', name: 'down quark', c: 'var(--sm-quark)' }, { s: 'e⁻', name: 'electron', c: 'var(--sm-lepton)' }] as p, i (p.s)}
		<circle cx={300 + i * 170} cy={540} r="17" fill={p.c} />
		<text
			x={300 + i * 170}
			y={546}
			text-anchor="middle"
			font-weight="700"
			style:font-size="16px"
			style:fill="var(--sm-ball-ink)">{p.s}</text
		>
		<Readout id="ev-{i}">
			<Label anchor="start" x={324 + i * 170} y={545} text={p.name} size={13} />
		</Readout>
	{/each}
</g>
