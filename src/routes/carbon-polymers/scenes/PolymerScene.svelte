<script lang="ts">
	/**
	 * Polymers.
	 * - `link` (hints.phase): addition polymerisation of ethylene. Every PERIOD seconds a
	 *   CH₂=CH₂ flies in to the chain's reactive end, its double bond opens (the second line
	 *   fades) and it becomes two more CH₂ links; the chain scrolls left as it grows. All a pure
	 *   function of t; the reduced-motion frame shows the chain, the queue of monomers and the
	 *   next one on its way. Each press of `params.addMono` links one more monomer at once.
	 * - `stretch`: a schematic sample of seven chains (drawn beads grow with
	 *   `params.units`), tied by `params.xlinks` cross-links, stretched by `params.stretch`
	 *   (slider, or the handle on the sample's right edge). With a network (G > 0, from
	 *   `shearModulus()`) the chains deform affinely (x × λ, y ÷ √λ) and, let go, the handle
	 *   springs back; without one they just slide apart and stay. Chain ends outside the
	 *   outermost cross-links are drawn pale: loose ends that carry no load. The readout and the
	 *   stress–stretch curve σ = G(λ − 1/λ²) are the model's real numbers; the drawing is
	 *   schematic (a bead stands for many monomer units). Beads jiggle thermally (a pure
	 *   function of t; still under reduced motion).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Handle,
		clamp,
		cycle,
		easeInOut,
		rng,
		scale,
		smoothstep
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		RUBBER,
		gelPoint,
		looseFraction,
		shearModulus,
		strandMass,
		stress,
		youngs
	} from '../polymer';
	import { ATOM } from '../look';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'link'));

	// ================================================================== link
	const PERIOD = 2.6;
	const DX = 58; // px per carbon along the zigzag
	const ZY = 16; // zigzag half-height
	const CHAIN_Y = 300;
	const START = 6; // carbons at t = 0
	// The "Add a monomer" button links one more on top of the timer's.
	const presses = $derived(Math.max(0, Math.floor(Number(params.addMono ?? 0))));
	const added = $derived(Math.floor(t / PERIOD) + presses);
	const u = $derived(cycle(t, PERIOD));
	const carbons = $derived(START + 2 * added);
	// Scroll continuously so that the reactive end stays near x = 560.
	const scroll = $derived(Math.max(0, (START + (2 * t) / PERIOD + 2 * presses) * DX - 520));
	const cx = (i: number) => 90 + i * DX - scroll;
	const cy = (i: number) => CHAIN_Y + (i % 2 ? -ZY : ZY);
	const endX = $derived(cx(carbons - 1));
	const endY = $derived(cy(carbons - 1));
	// The incoming monomer: flies from the queue to the end (0–0.65), bonds (0.65–0.9).
	const fly = $derived(easeInOut(clamp(u / 0.65)));
	const open = $derived(smoothstep(0.65, 0.9, u));
	const mono = $derived({
		x: 800 + (endX + DX + DX / 2 - 800) * fly,
		y: 180 + (endY - 180) * fly + Math.sin(fly * Math.PI) * -30
	});
	const unitsNow = $derived(carbons / 2);
	const chainMass = $derived(unitsNow * 28.05);

	// ================================================================== stretch
	const units = $derived(Math.round(10 ** clamp(Number(params.units ?? 3.45), 1.5, 4.5)));
	const xl = $derived(clamp(Number(params.xlinks ?? 0.5), 0, 2));
	const lambdaParam = $derived(clamp(Number(params.stretch ?? 1), 1, 3));
	const lambda = Tween.of(() => lambdaParam, { duration: 650, easing: cubicInOut });
	const Mn = $derived(units * RUBBER.unitMass);
	const Mc = $derived(strandMass(xl));
	const G = $derived(shearModulus(Mn, Mc));
	const E = $derived(youngs(G));
	const network = $derived(G > 0);
	const loose = $derived(looseFraction(Mn, Mc));

	// Narrow enough that a threefold stretch still clears the readout.
	const BOX = { x: 60, y: 150, w: 176, h: 300 };
	const N_CHAINS = 7;
	const beads = $derived(Math.round(6 + 6 * (Math.log10(units) - 1.5)));
	interface Chain {
		pts: { x: number; y: number }[];
	}
	const chains = $derived.by((): Chain[] => {
		const out: Chain[] = [];
		for (let j = 0; j < N_CHAINS; j++) {
			const r = rng(101 + j * 17);
			let x = BOX.x + 20 + r() * (BOX.w - 40);
			let y = BOX.y + 20 + ((j + 0.5) / N_CHAINS) * (BOX.h - 40);
			let a = r() * Math.PI * 2;
			const pts = [{ x, y }];
			for (let k = 1; k < beads; k++) {
				a += (r() - 0.5) * 1.8;
				let nx = x + 15 * Math.cos(a);
				let ny = y + 15 * Math.sin(a);
				// Stay inside the box: turn back from the walls.
				if (nx < BOX.x + 8 || nx > BOX.x + BOX.w - 8) {
					a = Math.PI - a;
					nx = x + 15 * Math.cos(a);
				}
				if (ny < BOX.y + 8 || ny > BOX.y + BOX.h - 8) {
					a = -a;
					ny = y + 15 * Math.sin(a);
				}
				x = nx;
				y = ny;
				pts.push({ x, y });
			}
			out.push({ pts });
		}
		return out;
	});
	/** Candidate cross-links: close bead pairs on different chains, nearest first. */
	const candidates = $derived.by(() => {
		const list: { a: [number, number]; b: [number, number]; d: number }[] = [];
		chains.forEach((c, j) =>
			c.pts.forEach((p, i) =>
				chains.forEach((c2, j2) => {
					if (j2 <= j) return;
					c2.pts.forEach((q, i2) => {
						const d = Math.hypot(p.x - q.x, p.y - q.y);
						if (d < 34) list.push({ a: [j, i], b: [j2, i2], d });
					});
				})
			)
		);
		list.sort((p, q) => p.d - q.d);
		// One cross-link per bead at most.
		const used: Record<string, true> = {};
		return list.filter((c) => {
			const ka = c.a.join(':');
			const kb = c.b.join(':');
			if (used[ka] || used[kb]) return false;
			used[ka] = true;
			used[kb] = true;
			return true;
		});
	});
	const links = $derived(candidates.slice(0, Math.round(14 * xl)));
	/** Per chain, the range of beads between its outermost cross-links (null: none). */
	const tied = $derived(
		chains.map((_, j) => {
			const idx = links
				.flatMap((l) => [l.a, l.b])
				.filter((e) => e[0] === j)
				.map((e) => e[1]);
			return idx.length ? [Math.min(...idx), Math.max(...idx)] : null;
		})
	);

	// Deformation: affine about the box's left edge and middle (network), or sliding (gum).
	const midY = BOX.y + BOX.h / 2;
	const jiggle = (j: number, i: number, k: number) =>
		reduced ? 0 : 1.6 * Math.sin(2.3 * t + j * 1.7 + i * 2.1 + k * 0.9);
	const place = (j: number, i: number) => {
		const p = chains[j].pts[i];
		const L = lambda.current;
		if (network) {
			return {
				x: BOX.x + (p.x - BOX.x) * L + jiggle(j, i, 0),
				y: midY + (p.y - midY) / Math.sqrt(L) + jiggle(j, i, 1)
			};
		}
		// No network: each chain keeps its shape and slides with its centre.
		const c = chains[j].pts.reduce((s, q) => s + q.x, 0) / chains[j].pts.length;
		return {
			x: p.x + (c - BOX.x) * (L - 1) + jiggle(j, i, 0),
			y: p.y + jiggle(j, i, 1)
		};
	};
	const COLORS = ['var(--cp-chain)', 'var(--cp-chain-2)', 'var(--cp-chain-3)'];
	const drawn = $derived(chains.map((c, j) => c.pts.map((_, i) => place(j, i))));
	const rightEdge = $derived(BOX.x + BOX.w * lambda.current);
	const handleY = midY;
	function onmove(p: { x: number }) {
		setParam('stretch', Math.round(clamp((p.x - BOX.x) / BOX.w, 1, 3) * 20) / 20);
	}
	function onkey(s: number | 'start' | 'end') {
		const v = s === 'start' ? 1 : s === 'end' ? 3 : lambdaParam + 0.05 * s;
		setParam('stretch', Math.round(clamp(v, 1, 3) * 20) / 20);
	}
	function ondragend() {
		// A network springs back when let go; a gum stays where it was pulled.
		if (network) setParam('stretch', 1);
	}

	// ---- stress–stretch chart
	const C = { x: 640, y: 330, w: 270, h: 170 };
	const csx = scale([1, 3], [C.x, C.x + C.w]);
	const csy = scale([0, 4], [C.y + C.h, C.y]);
	const curve = $derived.by(() => {
		const pts: string[] = [];
		for (let k = 0; k <= 40; k++) {
			const l = 1 + (2 * k) / 40;
			pts.push(`${csx(l).toFixed(1)} ${csy(stress(G, l) / 1e6).toFixed(1)}`);
		}
		return 'M' + pts.join('L');
	});
	const sNow = $derived(stress(G, lambda.current) / 1e6);
	const mpa = (pa: number) =>
		pa >= 1e5 ? `${(pa / 1e6).toFixed(2)} MPa` : `${(pa / 1e3).toFixed(0)} kPa`;
	const fmtMass = (m: number) => `${Math.round(m).toLocaleString('en-GB')} g/mol`;
	const verdict = $derived(
		network
			? 'a network: it springs back'
			: xl === 0
				? 'no cross-links: the chains slide, it flows'
				: 'too few cross-links to bear a load'
	);
	const gel = $derived(gelPoint(Mn));
	const RX = 640;
</script>

{#snippet atom(x: number, y: number, el: 'C' | 'H', r: number)}
	<circle cx={x} cy={y} {r} fill={ATOM[el].fill} stroke={ATOM[el].edge} stroke-width="1.2" />
	{#if el === 'C'}
		<text
			{x}
			y={y + 4}
			text-anchor="middle"
			font-weight="700"
			font-size="11"
			style:fill={ATOM.C.ink}>C</text
		>
	{/if}
{/snippet}

{#snippet ethylene(x: number, y: number, openness: number, opacity: number)}
	<g {opacity}>
		<line
			x1={x - DX / 2}
			y1={y}
			x2={x + DX / 2}
			y2={y - 3}
			stroke="var(--stage-ink-muted)"
			stroke-width="2.4"
		/>
		<line
			x1={x - DX / 2}
			y1={y + 6}
			x2={x + DX / 2}
			y2={y + 3}
			stroke="var(--stage-ink-muted)"
			stroke-width="2.4"
			opacity={1 - openness}
		/>
		{#each [-1, 1] as s (s)}
			{#each [-1, 1] as v (v)}
				<line
					x1={x + (s * DX) / 2}
					y1={y}
					x2={x + (s * DX) / 2 + s * 12}
					y2={y + v * 20}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.6"
				/>
				{@render atom(x + (s * DX) / 2 + s * 12, y + v * 20, 'H', 6)}
			{/each}
			{@render atom(x + (s * DX) / 2, y + (s < 0 ? 0 : -1), 'C', 11)}
		{/each}
	</g>
{/snippet}

<g style:pointer-events="none">
	{#if phase === 'link'}
		<!-- the chain -->
		<clipPath id="polymer-clip"><rect x="20" y="80" width="920" height="460" /></clipPath>
		<g clip-path="url(#polymer-clip)">
			{#each Array.from({ length: carbons }, (_, i) => i) as i (i)}
				{@const x = cx(i)}
				{@const y = cy(i)}
				{#if x > -40 && x < 1000}
					{#if i > 0}
						<line
							x1={cx(i - 1)}
							y1={cy(i - 1)}
							x2={x}
							y2={y}
							stroke="var(--stage-ink-muted)"
							stroke-width="2.4"
						/>
					{/if}
					{#each [-1, 1] as v (v)}
						<line
							x1={x}
							y1={y}
							x2={x + v * 11}
							y2={y + (i % 2 ? -27 : 27)}
							stroke="var(--stage-ink-muted)"
							stroke-width="1.6"
						/>
						{@render atom(x + v * 11, y + (i % 2 ? -27 : 27), 'H', 7)}
					{/each}
					{@render atom(x, y, 'C', 13)}
				{/if}
			{/each}
			<!-- the new bond to the incoming monomer -->
			<line
				x1={endX}
				y1={endY}
				x2={mono.x - DX / 2}
				y2={mono.y}
				stroke="var(--cp-link)"
				stroke-width="3"
				opacity={open}
			/>
			<!-- the reactive end -->
			<circle
				cx={endX + (open > 0.5 ? 0 : 0)}
				cy={endY}
				r="17"
				fill="none"
				stroke="var(--cp-link)"
				stroke-width="2.5"
				stroke-dasharray="4 3"
				opacity={1 - open}
			/>
		</g>
		{@render ethylene(mono.x, mono.y, open, smoothstep(0, 0.12, u) * (1 - smoothstep(0.92, 1, u)))}
		<!-- the queue -->
		{#each [0, 1, 2] as k (k)}
			{@render ethylene(650 + k * 110, 470, 0, 0.9)}
		{/each}
		<Readout id="l-mono" order={2} label="Monomer" value="ethylene, CH₂=CH₂">
			<text x="805" y="425" text-anchor="middle" class="halo" font-weight="600" font-size="13"
				>monomers: ethylene, CH₂=CH₂</text
			>
		</Readout>
		<Readout id="l-chain" order={1} label="Polymer" value="polyethylene, –(CH₂–CH₂)ₙ–">
			<text x="250" y="380" text-anchor="middle" class="halo" font-weight="600" font-size="13"
				>the growing chain: polyethylene</text
			>
		</Readout>
		<Readout id="l-end">
			<text
				x={Math.min(endX, 640) + 34}
				y={endY + 52}
				text-anchor="middle"
				class="halo"
				font-size="12"
				style:fill="var(--cp-link)">reactive end</text
			>
		</Readout>
		<Readout
			id="l-open"
			order={3}
			label="Each step"
			value="the C=C opens: one electron bonds to the chain, the other is the new reactive end"
		>
			<text x="480" y="120" text-anchor="middle" class="halo" font-weight="600" font-size="14"
				>each C=C opens: one electron bonds to the chain, the other is the new reactive end</text
			>
		</Readout>
		<Readout
			id="l-count"
			order={0}
			label="Chain so far"
			value="{unitsNow} units, {Math.round(chainMass)} g/mol"
		>
			<text x="40" y="560" class="halo" font-size="13"
				>chain so far: {unitsNow} ethylene units ({carbons} carbons), {Math.round(chainMass)} g/mol ·
				real chains: thousands of units</text
			>
		</Readout>
	{:else}
		<!-- the sample -->
		<rect
			x={BOX.x}
			y={midY - BOX.h / 2 / Math.sqrt(network ? lambda.current : 1)}
			width={BOX.w * lambda.current}
			height={BOX.h / Math.sqrt(network ? lambda.current : 1)}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<rect
			x={BOX.x - 18}
			y={midY - 60}
			width="18"
			height="120"
			rx="4"
			fill="var(--stage-ink-muted)"
			opacity="0.5"
		/>
		{#each drawn as pts, j (j)}
			{@const tie = tied[j]}
			{#each pts as p, i (i)}
				{#if i > 0}
					{@const inTie = network && tie !== null && i - 1 >= tie[0] && i <= tie[1]}
					<line
						x1={pts[i - 1].x}
						y1={pts[i - 1].y}
						x2={p.x}
						y2={p.y}
						stroke={COLORS[j % 3]}
						stroke-width="3"
						stroke-linecap="round"
						opacity={inTie ? 1 : 0.4}
					/>
				{/if}
			{/each}
			{#each pts as p, i (i)}
				<circle
					cx={p.x}
					cy={p.y}
					r={i === 0 || i === pts.length - 1 ? 4 : 2.6}
					fill={COLORS[j % 3]}
				/>
			{/each}
		{/each}
		{#each links as l, k (k)}
			{@const p = drawn[l.a[0]][l.a[1]]}
			{@const q = drawn[l.b[0]][l.b[1]]}
			<line
				x1={p.x}
				y1={p.y}
				x2={q.x}
				y2={q.y}
				stroke="var(--cp-link)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<circle cx={p.x} cy={p.y} r="4" fill="var(--cp-link)" />
			<circle cx={q.x} cy={q.y} r="4" fill="var(--cp-link)" />
		{/each}
		<Readout id="s-key">
			<text x={BOX.x} y={BOX.y - 28} class="halo" font-size="11"
				><tspan style:fill="var(--cp-link)" font-weight="700">orange: cross-links</tspan> · pale: loose
				ends · each bead: many units</text
			>
		</Readout>
	{/if}
</g>

{#if phase === 'stretch'}
	<g style:pointer-events="auto">
		<Handle
			x={rightEdge}
			y={handleY}
			label="Stretch the sample"
			value={lambdaParam}
			min={1}
			max={3}
			valuetext="{lambdaParam.toFixed(2)} times its length"
			r={11}
			{onmove}
			{onkey}
			{ondragend}
		/>
	</g>
	<g style:pointer-events="none">
		<Readout id="s-pull">
			<text
				x={Math.min(rightEdge, 600)}
				y={handleY - 22}
				text-anchor="middle"
				class="halo"
				font-size="11">drag to stretch</text
			>
		</Readout>
		<g transform="translate({RX} 0)">
			<Readout
				id="s-verdict"
				order={0}
				label="The sample"
				value={verdict}
				color={network ? 'var(--cp-group)' : 'var(--cp-warn)'}
			>
				<text
					x="0"
					y="96"
					class="halo"
					font-weight="700"
					font-size="16"
					style:fill={network ? 'var(--cp-group)' : 'var(--cp-warn)'}>{verdict}</text
				>
			</Readout>
			<Readout
				id="s-chain"
				order={1}
				label="Chain"
				value="{units.toLocaleString('en-GB')} units, {fmtMass(Mn)}"
			>
				<text x="0" y="126" class="halo muted" font-size="12">chains</text>
				<text x="90" y="126" class="halo" font-size="13">{fmtMass(Mn)}</text>
			</Readout>
			<Readout
				id="s-mc"
				order={2}
				label="Between cross-links"
				value={Number.isFinite(Mc) ? fmtMass(Mc) : 'no cross-links'}
			>
				<text x="0" y="148" class="halo muted" font-size="12">strands</text>
				<text x="90" y="148" class="halo" font-size="13"
					>{Number.isFinite(Mc) ? fmtMass(Mc) : 'no cross-links'}</text
				>
			</Readout>
			<Readout
				id="s-loose"
				order={3}
				label="Loose ends"
				value="{Math.round(loose * 100)}% of the chain"
			>
				<text x="0" y="170" class="halo muted" font-size="12">loose ends</text>
				<text x="90" y="170" class="halo" font-size="13"
					>{Math.round(loose * 100)}% of each chain</text
				>
				{#if !network && xl > 0}
					<text x="90" y="187" class="halo muted" font-size="11"
						>stiffness from {gel.toFixed(2)} cross-links per 100</text
					>
				{/if}
			</Readout>
			<Readout id="s-E" order={4} label="Stiffness E" value={network ? mpa(E) : '0'}>
				<text x="0" y="210" class="halo muted" font-size="12">stiffness (Young’s modulus)</text>
				<text x="0" y="238" class="halo" font-weight="700" font-size="22"
					>{network ? mpa(E) : '0: it flows'}</text
				>
				<text x="0" y="258" class="halo muted" font-size="11"
					>ideal network: E = 3ρRT/M<tspan baseline-shift="sub" font-size="9">c</tspan> · (1 − 2M<tspan
						baseline-shift="sub"
						font-size="9">c</tspan
					>/Mₙ)</text
				>
			</Readout>
		</g>
		<g data-testid="stress-chart">
			<Axes
				sx={csx}
				sy={csy}
				xTicks={[1, 1.5, 2, 2.5, 3]}
				yTicks={[0, 1, 2, 3, 4]}
				xFormat={(v) => `${v}×`}
				xLabel="stretch"
				yLabel="stress, MPa"
			/>
			<path d={curve} fill="none" stroke="var(--cp-group)" stroke-width="2.5" />
			<circle cx={csx(lambda.current)} cy={csy(Math.min(4, sNow))} r="6" fill="var(--cp-group)" />
		</g>
	</g>
{/if}
