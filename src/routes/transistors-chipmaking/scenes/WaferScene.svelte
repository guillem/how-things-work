<script lang="ts">
	/**
	 * Zoom from a 300 mm wafer to one transistor (`params.zoom`, 0…4). Five levels, each
	 * drawn at its real scale, so the view width W(z) is interpolated logarithmically
	 * between the levels and every drawing is scaled by W_level / W(z) around the centre:
	 * 0 wafer (whole M1-sized chips, √119 mm on a side, on a 300 mm disc, and one 26 × 33 mm
	 * exposure field), 1 chip (functional blocks, schematic), 2 block (rows of standard
	 * cells), 3 cells (rows 210 nm tall with gates every 51 nm), 4 transistor (gates
	 * crossing fins; one crossing highlighted). The cell height and gate pitch are TSMC N5's
	 * as measured by Angstronomics ("The truth of TSMC 5nm", 2022) on an Apple A15; the
	 * layouts themselves are schematic. The scale bar and transistor estimate follow W(z).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, hash, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { FIELD_MM, M1, WAFER_MM } from '../model';

	let { params, reduced }: StageProps = $props();
	const target = $derived(clamp(Number(params.zoom ?? 0), 0, 4));
	const Z = Tween.of(() => target, { duration: 600, easing: cubicInOut });
	const z = $derived(reduced ? target : Z.current);

	/** Width of the view at each level (mm). */
	const W = [400, 14, 0.2, 0.002, 0.0002];
	const NAMES = ['A 300 mm wafer', 'One chip', 'A block of logic', 'Rows of cells', 'Transistors'];
	const view = $derived.by(() => {
		const i = Math.min(3, Math.floor(z));
		const f = z - i;
		return Math.exp(lerp(Math.log(W[i]), Math.log(W[i + 1]), f));
	});
	const CX = 340;
	const CY = 300;
	const SIZE = 520; // px across the view
	/** Scale of level i's drawing (drawn with SIZE px = W[i]) at the current zoom. */
	const k = (i: number) => W[i] / view;
	const op = (i: number) => 1 - smoothstep(0.35, 0.8, Math.abs(z - i));

	// ---- level 0: wafer ----
	const DIE = Math.sqrt(M1.area); // mm
	const PX0 = SIZE / W[0];
	const R = (WAFER_MM / 2) * PX0;
	const dies = (() => {
		const out: { x: number; y: number }[] = [];
		const n = Math.ceil(WAFER_MM / DIE) + 2;
		for (let i = -n; i <= n; i++)
			for (let j = -n; j <= n; j++) {
				const x0 = (i - 0.5) * DIE;
				const y0 = (j - 0.5) * DIE;
				const far = Math.max(
					Math.hypot(x0, y0),
					Math.hypot(x0 + DIE, y0),
					Math.hypot(x0, y0 + DIE),
					Math.hypot(x0 + DIE, y0 + DIE)
				);
				if (far <= WAFER_MM / 2 - 3) out.push({ x: x0, y: y0 });
			}
		return out;
	})();
	const diePath = dies
		.map((d) => {
			const x = d.x * PX0 + 0.4;
			const y = d.y * PX0 + 0.4;
			const s = DIE * PX0 - 0.8;
			return `M${x.toFixed(1)} ${y.toFixed(1)}h${s.toFixed(1)}v${s.toFixed(1)}h${(-s).toFixed(1)}Z`;
		})
		.join('');
	// One exposure field: 2 × 3 whole chips fit in 26 × 33 mm.
	const fieldCols = Math.floor(FIELD_MM.w / DIE);
	const fieldRows = Math.floor(FIELD_MM.h / DIE);

	// ---- level 1: chip (schematic floorplan) ----
	const PX1 = SIZE / W[1];
	const CHIP = DIE * PX1;
	const blocks = [
		{ x: 0.04, y: 0.04, w: 0.42, h: 0.3, name: 'fast processor cores' },
		{ x: 0.5, y: 0.04, w: 0.46, h: 0.3, name: 'graphics' },
		{ x: 0.04, y: 0.38, w: 0.27, h: 0.24, name: 'cache memory' },
		{ x: 0.35, y: 0.38, w: 0.3, h: 0.24, name: '' },
		{ x: 0.69, y: 0.38, w: 0.27, h: 0.24, name: 'efficient cores' },
		{ x: 0.04, y: 0.66, w: 0.44, h: 0.3, name: 'neural engine' },
		{ x: 0.52, y: 0.66, w: 0.44, h: 0.3, name: 'memory and input/output' }
	];

	// ---- level 2: block of standard-cell rows ----
	const rows2 = Array.from({ length: 34 }, (_, r) => r);
	const stripes = (() => {
		let d = '';
		const h = SIZE / 34;
		for (const r of rows2) {
			let x = -SIZE / 2;
			let c = 0;
			while (x < SIZE / 2) {
				const w = 6 + hash(r * 97 + c, 3) * 22;
				d += `M${x.toFixed(1)} ${(-SIZE / 2 + r * h + 1).toFixed(1)}h${(w - 1.5).toFixed(1)}v${(h - 2).toFixed(1)}h${(-(w - 1.5)).toFixed(1)}Z`;
				x += w;
				c++;
			}
		}
		return d;
	})();

	// ---- level 3: cells (row 210 nm, gate pitch 51 nm) ----
	const PX3 = SIZE / (W[3] * 1e6); // px per nm
	const ROW = 210 * PX3;
	const CPP = 51 * PX3;
	const cells3 = (() => {
		let gates = '';
		let active = '';
		let metal = '';
		// One row is centred on the view, and one gate is on its centre line.
		const R0 = Math.ceil(SIZE / 2 / ROW);
		const G0 = Math.ceil(SIZE / 2 / CPP);
		for (let r = 0; r <= 2 * R0; r++) {
			const y0 = (r - R0) * ROW - ROW / 2;
			active += `M${-SIZE / 2} ${(y0 + ROW * 0.16).toFixed(1)}h${SIZE}v${(ROW * 0.24).toFixed(1)}h${-SIZE}Z`;
			active += `M${-SIZE / 2} ${(y0 + ROW * 0.6).toFixed(1)}h${SIZE}v${(ROW * 0.24).toFixed(1)}h${-SIZE}Z`;
			for (let g = 0; g <= 2 * G0; g++) {
				if (g !== G0 && hash(r * 131 + g, 1) < 0.12) continue; // cell boundaries: a gap
				const x = (g - G0) * CPP;
				gates += `M${(x - CPP * 0.16).toFixed(1)} ${(y0 + ROW * 0.08).toFixed(1)}h${(CPP * 0.32).toFixed(1)}v${(ROW * 0.84).toFixed(1)}h${(-CPP * 0.32).toFixed(1)}Z`;
			}
			for (let m = 0; m < 3; m++) {
				const x = -SIZE / 2 + hash(r, m + 4) * SIZE * 0.7;
				const w = SIZE * (0.1 + 0.2 * hash(r, m + 9));
				const y = y0 + ROW * (0.32 + m * 0.18);
				metal += `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${(ROW * 0.07).toFixed(1)}h${(-w).toFixed(1)}Z`;
			}
		}
		return { gates, active, metal };
	})();

	// ---- level 4: a few gates crossing fins ----
	const PX4 = SIZE / (W[4] * 1e6); // px per nm
	const CPP4 = 51 * PX4;
	const ROW4 = 210 * PX4;
	const gates4 = [-2, -1, 0, 1, 2].map((g) => ({ g, x: g * CPP4 }));
	const fins4 = [-0.3, -0.18, 0.18, 0.3].map((f) => f * ROW4);

	// ---- readouts ----
	const DENSITY = M1.transistors / M1.area; // per mm²
	const level = $derived(Math.round(z));
	const inView = $derived.by(() => {
		if (level === 0) return dies.length * M1.transistors;
		if (level === 1) return M1.transistors;
		if (level === 4) return 1;
		return DENSITY * view * view;
	});
	const fmtCount = (n: number) =>
		n >= 1e12
			? `${(n / 1e12).toFixed(1)} trillion`
			: n >= 1e9
				? `${Math.round(n / 1e9)} billion`
				: n >= 1e6
					? `${(n / 1e6).toFixed(1)} million`
					: n >= 10
						? `${Math.round(n / 10) * 10}`
						: String(Math.round(n));
	const countText = $derived(
		level === 0
			? `${dies.length} chips × 16 billion = ${fmtCount(inView)} transistors`
			: level === 1
				? '16 billion transistors'
				: level === 4
					? 'one transistor: a gate crossing two fins'
					: `about ${fmtCount(inView)} transistors in view`
	);
	/** Scale bar: a 1–2–5 length near a fifth of the view. */
	const bar = $derived.by(() => {
		const want = view / 5;
		const p = 10 ** Math.floor(Math.log10(want));
		const len = [1, 2, 5, 10]
			.map((m) => m * p)
			.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
		const px = (len / view) * SIZE;
		const label =
			len >= 1
				? `${len} mm`
				: len >= 1e-3
					? `${Math.round(len * 1000)} µm`
					: `${Math.round(len * 1e6)} nm`;
		return { px, label };
	});
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
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="wafer-clip">
			<rect x={CX - SIZE / 2} y={CY - SIZE / 2 + 10} width={SIZE} height={SIZE - 20} rx="12" />
		</clipPath>
	</defs>
	<rect
		x={CX - SIZE / 2}
		y={CY - SIZE / 2 + 10}
		width={SIZE}
		height={SIZE - 20}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#wafer-clip)">
		<!-- level 0 -->
		{#if op(0) > 0.01}
			<g transform="translate({CX} {CY}) scale({k(0)})" opacity={op(0)}>
				<circle r={R} fill="var(--tc-wafer)" stroke="var(--stage-line)" stroke-width={1.5 / k(0)} />
				<path d={diePath} fill="var(--tc-die)" opacity="0.55" />
				<rect
					x={(-0.5 * DIE - (FIELD_MM.w - fieldCols * DIE) / 2) * PX0}
					y={(-1.5 * DIE - (FIELD_MM.h - fieldRows * DIE) / 2) * PX0}
					width={FIELD_MM.w * PX0}
					height={FIELD_MM.h * PX0}
					fill="none"
					stroke="var(--tc-uv)"
					stroke-width={2.5 / k(0)}
				/>
				<rect
					x={-DIE * PX0 * 0.5}
					y={-DIE * PX0 * 0.5}
					width={DIE * PX0}
					height={DIE * PX0}
					fill="var(--circ-glow)"
				/>
			</g>
		{/if}
		<!-- level 1 -->
		{#if op(1) > 0.01}
			<g transform="translate({CX} {CY}) scale({k(1)})" opacity={op(1)}>
				<rect
					x={-CHIP / 2}
					y={-CHIP / 2}
					width={CHIP}
					height={CHIP}
					rx="4"
					fill="var(--tc-die)"
					opacity="0.25"
					stroke="var(--tc-die)"
				/>
				{#each blocks as b (b.x * 10 + b.y)}
					<rect
						x={-CHIP / 2 + b.x * CHIP}
						y={-CHIP / 2 + b.y * CHIP}
						width={b.w * CHIP}
						height={b.h * CHIP}
						rx="4"
						fill={b.name ? 'var(--surface)' : 'var(--circ-glow)'}
						stroke="var(--tc-die)"
						stroke-width={1.5 / k(1)}
						opacity={b.name ? 0.85 : 1}
					/>
					{#if b.name && k(1) > 0.6 && k(1) < 3}
						<Readout id="block-{b.name}">
							{@render txt(
								-CHIP / 2 + (b.x + b.w / 2) * CHIP,
								-CHIP / 2 + (b.y + b.h / 2) * CHIP + 4,
								b.name,
								13 / k(1),
								{ weight: 600 }
							)}
						</Readout>
					{/if}
				{/each}
			</g>
		{/if}
		<!-- level 2 -->
		{#if op(2) > 0.01}
			<g transform="translate({CX} {CY}) scale({k(2)})" opacity={op(2)}>
				<rect
					x={-SIZE / 2}
					y={-SIZE / 2}
					width={SIZE}
					height={SIZE}
					fill="var(--circ-glow)"
					opacity="0.25"
				/>
				<path d={stripes} fill="var(--tc-die)" opacity="0.45" />
			</g>
		{/if}
		<!-- level 3 -->
		{#if op(3) > 0.01}
			<g transform="translate({CX} {CY}) scale({k(3)})" opacity={op(3)}>
				<path d={cells3.active} fill="var(--tc-on)" opacity="0.35" />
				<path d={cells3.gates} fill="var(--tc-resist)" opacity="0.85" />
				<path d={cells3.metal} fill="var(--tc-tungsten)" opacity="0.8" />
			</g>
		{/if}
		<!-- level 4 -->
		{#if op(4) > 0.01}
			<g transform="translate({CX} {CY}) scale({k(4)})" opacity={op(4)}>
				{#each fins4 as fy (fy)}
					<rect
						x={-SIZE / 2}
						y={fy - 4 * PX4}
						width={SIZE}
						height={8 * PX4}
						rx="3"
						fill="var(--tc-on)"
						opacity="0.6"
					/>
				{/each}
				{#each gates4 as gt (gt.g)}
					<rect
						x={gt.x - 9 * PX4}
						y={-ROW4 * 0.45}
						width={18 * PX4}
						height={ROW4 * 0.9}
						rx="4"
						fill="var(--tc-resist)"
						opacity="0.85"
					/>
				{/each}
				<rect
					x={-16 * PX4}
					y={fins4[2] - 30 * PX4}
					width={32 * PX4}
					height={fins4[3] - fins4[2] + 60 * PX4}
					rx="8"
					fill="none"
					stroke="var(--circ-glow)"
					stroke-width="4"
				/>
			</g>
		{/if}
	</g>

	<!-- scale bar -->
	<Readout id="scale" order={3} label="Scale bar" value={bar.label}>
		<line
			x1={CX - SIZE / 2 + 24}
			x2={CX - SIZE / 2 + 24 + bar.px}
			y1={CY + SIZE / 2 - 32}
			y2={CY + SIZE / 2 - 32}
			stroke="var(--stage-ink)"
			stroke-width="3"
		/>
		{@render txt(CX - SIZE / 2 + 24 + bar.px / 2, CY + SIZE / 2 - 40, bar.label, 13, {
			weight: 700
		})}
	</Readout>

	<!-- readouts -->
	<Readout id="level" order={1} label="View" value={NAMES[level]}>
		{@render txt(630, 90, NAMES[level], 16, { anchor: 'start', weight: 700 })}
	</Readout>
	<Readout id="count" order={2} label="Transistors" value={countText}>
		{#each level === 0 ? [`${dies.length} whole chips`, `× 16 billion transistors`, `= ${fmtCount(inView)}`] : [countText] as line, i (i)}
			{@render txt(630, 122 + i * 22, line, 14, { anchor: 'start', weight: 600 })}
		{/each}
	</Readout>
	<Readout id="note">
		{#each level === 0 ? ['Each chip here is the size of Apple’s M1', '(about 119 mm²). The violet frame is one', 'exposure field, 26 × 33 mm: six chips', 'printed in one sweep of the scanner.'] : level === 1 ? ['16 billion transistors in about 119 mm².', 'Blocks drawn schematically; the yellow', 'one is where we zoom in.'] : level === 2 ? ['Logic is laid out in rows of standard', 'cells of equal height, like text in lines.'] : level === 3 ? ['Rows of cells 210 nm tall. Gates (pink)', 'every 51 nm cross the silicon (green);', 'metal wires (blue) connect them.'] : ['Each gate wraps over thin fins of silicon:', 'where a gate crosses its fins, there is', 'one transistor (yellow frame).'] as line, i (i)}
			{@render txt(630, 200 + i * 20, line, 12, { anchor: 'start', muted: true })}
		{/each}
	</Readout>
	<Readout id="hint">
		{@render txt(630, 520, 'Use the zoom slider below the picture.', 12, {
			anchor: 'start',
			muted: true
		})}
	</Readout>
</g>
