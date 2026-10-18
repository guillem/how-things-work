<script lang="ts">
	/**
	 * Two portraits side by side: the frictionless pendulum on the left, whose
	 * centre is a true one (its energy is conserved), and on the right the
	 * system the `twin` control picks: the damped pendulum (a hyperbolic
	 * spiral), or r′ = −r³ or r′ = +r³, whose Jacobian at the origin is the
	 * frictionless pendulum's but whose orbits spiral in or out. Under each,
	 * what the linearisation says and what one followed orbit (drawn bold) does.
	 */
	import { Axes, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		eigenvector,
		fixedPoints,
		orbit,
		pendulumEnergy,
		rk4,
		systems,
		type Box,
		type FixedPoint,
		type SystemParams,
		type Vec
	} from '../phase';
	import { eigenText, fixed, kindColor, matText, scales, type Rect } from './frame';
	import Portrait from './Portrait.svelte';

	let { t, params }: StageProps = $props();

	const twin = $derived(String(params.twin ?? 'damped'));

	const LEFT: Rect = { left: 66, right: 450, top: 96, bottom: 384 };
	const RIGHT: Rect = { left: 546, right: 930, top: 96, bottom: 384 };
	const PEND_BOX: Box = { x: [-4, 4], y: [-3, 3] };
	const RING_BOX: Box = { x: [-2, 2], y: [-1.5, 1.5] };
	const PEND_STARTS: Vec[] = [
		[0.6, 0],
		[1.2, 0],
		[1.8, 0],
		[2.6, 0],
		[-3.9, 2.4],
		[3.9, -2.4],
		[-3.9, 2.9],
		[3.9, -2.9]
	];
	const RING_STARTS: Vec[] = [
		[1.9, 0],
		[-1.9, 0],
		[0, 1.45],
		[0, -1.45],
		[0.25, 0],
		[-0.5, 0.1]
	];

	interface Panel {
		key: string;
		rect: Rect;
		box: Box;
		title: string;
		formula: string;
		field: ReturnType<(typeof systems)['pendulum']['field']>;
		fp: FixedPoint | null;
		starts: Vec[];
		followed: Vec;
		saddles: FixedPoint[];
	}

	const frictionless: SystemParams = { gamma: 0, mu: 0 };
	const panel = (key: string, rect: Rect): Panel => {
		if (key === 'frictionless' || key === 'damped') {
			const p = { gamma: key === 'damped' ? 0.3 : 0, mu: 0 };
			const fps = fixedPoints({ ...systems.pendulum, box: PEND_BOX }, p);
			return {
				key,
				rect,
				box: PEND_BOX,
				title: key === 'damped' ? 'Damped pendulum, γ = 0.3' : 'Pendulum without friction',
				formula: key === 'damped' ? 'θ′ = ω, ω′ = −sin θ − 0.3ω' : 'θ′ = ω, ω′ = −sin θ',
				field: systems.pendulum.field(p),
				fp: fps.find((f) => Math.abs(f.x) < 1e-9) ?? null,
				starts: PEND_STARTS,
				followed: [2, 0],
				saddles: fps.filter((f) => f.kind === 'saddle')
			};
		}
		const sys = key === 'inward' ? systems.hopf : systems.subcritical;
		const fps = fixedPoints({ ...sys, box: RING_BOX }, frictionless);
		return {
			key,
			rect,
			box: RING_BOX,
			title: key === 'inward' ? 'r′ = −r³ (turning clockwise)' : 'r′ = +r³ (turning clockwise)',
			formula:
				key === 'inward'
					? 'x′ = y − x(x² + y²), y′ = −x − y(x² + y²)'
					: 'x′ = y + x(x² + y²), y′ = −x + y(x² + y²)',
			field: sys.field(frictionless),
			fp: fps.find((f) => Math.hypot(f.x, f.y) < 1e-9) ?? null,
			starts: RING_STARTS,
			followed: key === 'inward' ? [0.9, 0] : [0.3, 0],
			saddles: []
		};
	};
	const panels = $derived([panel('frictionless', LEFT), panel(twin, RIGHT)]);

	/** What one followed orbit does, measured along it (not from the clock). */
	function fate(pn: Panel): { line: string; path: Vec[] } {
		const h = 0.005;
		let s = pn.followed;
		const path: Vec[] = [s];
		if (pn.key === 'frictionless' || pn.key === 'damped') {
			const E0 = pendulumEnergy(s[0], s[1]);
			let lo = E0;
			let hi = E0;
			const T = 30;
			for (let i = 1; i <= T / h; i++) {
				s = rk4(pn.field, s[0], s[1], h);
				const E = pendulumEnergy(s[0], s[1]);
				lo = Math.min(lo, E);
				hi = Math.max(hi, E);
				if (i % 4 === 0) path.push(s);
			}
			return {
				line:
					pn.key === 'frictionless'
						? `energy over 30 time units: ${fixed(lo, 6)} to ${fixed(hi, 6)}`
						: `energy: ${fixed(E0, 3)} → ${fixed(pendulumEnergy(s[0], s[1]), 3)} after 30`,
				path
			};
		}
		const r0 = Math.hypot(...s);
		if (pn.key === 'inward') {
			for (let i = 1; i <= 20 / h; i++) {
				s = rk4(pn.field, s[0], s[1], h);
				if (i % 4 === 0) path.push(s);
			}
			return {
				line: `r: ${r0.toFixed(2)} → ${Math.hypot(...s).toFixed(2)} after 20 time units`,
				path
			};
		}
		let tt = 0;
		while (Math.hypot(...s) < 1.5 && tt < 50) {
			s = rk4(pn.field, s[0], s[1], h);
			tt += h;
			if (Math.round(tt / h) % 4 === 0) path.push(s);
		}
		return { line: `r: ${r0.toFixed(2)} → 1.50 after ${tt.toFixed(2)} time units`, path };
	}
	const fates = $derived(panels.map((pn) => fate(pn)));

	const truth = (key: string) =>
		key === 'frictionless'
			? 'truth: a centre (energy conserved)'
			: key === 'damped'
				? 'truth: spirals in, as predicted'
				: key === 'inward'
					? 'truth: spirals in'
					: 'truth: spirals out';

	function sepPaths(pn: Panel): string[] {
		const { sx, sy } = scales(pn.rect, pn.box);
		const out: string[] = [];
		const back = (x: number, y: number): Vec => {
			const [u, v] = pn.field(x, y);
			return [-u, -v];
		};
		for (const fp of pn.saddles)
			for (const k of [0, 1]) {
				const v = eigenvector(fp.jacobian, fp.eigen.re[k]);
				if (!v) continue;
				for (const s of [1, -1]) {
					const o = orbit(
						fp.eigen.re[k] > 0 ? pn.field : back,
						fp.x + s * 1e-4 * v[0],
						fp.y + s * 1e-4 * v[1],
						{
							box: pn.box,
							tMax: 20,
							back: false,
							stopSpeed: 0
						}
					);
					out.push(
						o.x
							.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(o.y[i]).toFixed(1)}`)
							.join('')
					);
				}
			}
		return out;
	}
</script>

<g>
	{#each panels as pn, i (pn.key + i)}
		{@const sc = scales(pn.rect, pn.box)}
		{@const mid = (pn.rect.left + pn.rect.right) / 2}
		{@const f = fates[i]}
		<Readout
			id="title-{i}"
			order={i * 10 + 1}
			label={i === 0 ? 'Left' : 'Right'}
			value="{pn.title}: {pn.formula}"
		>
			<Label x={mid} y={42} text={pn.title} size={15} weight={600} />
			<Label x={mid} y={64} text={pn.formula} size={12} muted tabular />
		</Readout>
		<Axes
			sx={sc.sx}
			sy={sc.sy}
			xLabel={pn.box === PEND_BOX ? 'θ' : 'x'}
			yLabel={pn.box === PEND_BOX ? 'ω' : 'y'}
			yFormat={(v: number) => fixed(v, 0)}
			xFormat={(v: number) => fixed(v, 0)}
			grid={false}
		/>
		<Portrait
			rect={pn.rect}
			box={pn.box}
			field={pn.field}
			starts={pn.starts}
			{t}
			id="pp-twin-{i}"
			grid={15}
			tMax={20}
			loop={20}
		/>
		<g clip-path="url(#pp-twin-{i}-clip)" pointer-events="none">
			{#each sepPaths(pn) as d, j (j)}
				<path {d} fill="none" stroke="var(--pp-sep)" stroke-width="2" />
			{/each}
			<path
				d={f.path
					.map(([x, y], j) => `${j ? 'L' : 'M'}${sc.sx(x).toFixed(1)} ${sc.sy(y).toFixed(1)}`)
					.join('')}
				fill="none"
				stroke="var(--pp-cycle)"
				stroke-width="3"
			/>
			<circle
				cx={sc.sx(pn.followed[0])}
				cy={sc.sy(pn.followed[1])}
				r="5"
				fill="var(--pp-cycle)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		</g>
		{#if pn.fp}
			{@const c = kindColor(pn.fp.kind)}
			<circle
				cx={sc.sx(0)}
				cy={sc.sy(0)}
				r="7"
				fill={pn.fp.kind.startsWith('stable') ? c : 'var(--stage-bg)'}
				stroke={c}
				stroke-width="2.6"
			/>
			<Readout id="lin-{i}">
				<Label
					x={mid}
					y={pn.rect.bottom + 48}
					text="J at 0 = {matText(pn.fp.jacobian, 1)}"
					size={12}
					tabular
				/>
				<Label
					x={mid}
					y={pn.rect.bottom + 68}
					text="λ = {eigenText(pn.fp.eigen)}: linearisation says {pn.fp.kind}"
					size={12}
					tabular
				/>
			</Readout>
		{/if}
		<Readout
			id="truth-{i}"
			order={i * 10 + 3}
			label="Linearisation vs truth"
			value="λ = {pn.fp ? eigenText(pn.fp.eigen) : ''}: says {pn.fp?.kind ?? ''}; {truth(
				pn.key
			)} ({f.line})"
		>
			<Label
				x={mid}
				y={pn.rect.bottom + 94}
				text={f.line}
				size={12}
				tabular
				color="var(--pp-cycle)"
			/>
			<Label x={mid} y={pn.rect.bottom + 116} text={truth(pn.key)} size={14} weight={700} />
		</Readout>
	{/each}
	<line
		x1="498"
		x2="498"
		y1="30"
		y2="580"
		stroke="var(--stage-line)"
		stroke-width="1"
		opacity="0.6"
	/>
</g>
