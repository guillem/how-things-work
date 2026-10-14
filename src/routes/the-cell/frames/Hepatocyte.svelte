<script lang="ts" module>
	/**
	 * One liver cell in section, in micrometres (see liver.ts for the layout and
	 * its sources), with its neighbours from the tissue around it. Drawn at three
	 * levels of detail as the view narrows: the whole cell (membranes as hairlines);
	 * below ~8 µm, double membranes, nuclear pores, cristae with their own
	 * membranes and the rims of the ER; below ~1 µm, single nucleosomes, ATP
	 * synthase heads on the cristae, the actin under the membrane and the proteins
	 * in it, at the places the molecular views put them. Membranes are drawn at
	 * their true thickness once that is wider than a hairline.
	 */
	import {
		cristae,
		hepatocyte,
		liverTissue,
		SIZES,
		targetCristae,
		type Capsule,
		type Pt
	} from '../liver';
	import {
		chromatinField,
		CORTEX_ACTIN,
		MEMBRANE_PROTEINS,
		CRISTA_MACHINES,
		ER
	} from '../molecular';
	import { circlePath, capsulePath, polyline } from './types';

	const H = hepatocyte();
	const T = liverTissue();

	function offset(pts: readonly Pt[], d: number): Pt[] {
		return pts.map((p, i) => {
			const a = pts[Math.max(0, i - 1)];
			const b = pts[Math.min(pts.length - 1, i + 1)];
			const dx = b[0] - a[0];
			const dy = b[1] - a[1];
			const L = Math.hypot(dx, dy) || 1;
			return [p[0] - (dy / L) * d, p[1] + (dx / L) * d];
		});
	}

	const neighbours = T.cells.filter((c) => !c.target);
	const neighbourPath = neighbours.map((c) => polyline(c.outline, true)).join('');
	const neighbourNuclei = neighbours
		.map((c) => circlePath(c.nucleus.x, c.nucleus.y, c.nucleus.r))
		.join('');
	const rbcs = T.rbcs
		.map((b) => {
			const deg = (b.angle * 180) / Math.PI;
			const ca = Math.cos(b.angle);
			const sa = Math.sin(b.angle);
			return `M${b.x - b.a * ca} ${b.y - b.a * sa}A${b.a} ${b.b} ${deg} 1 0 ${b.x + b.a * ca} ${b.y + b.a * sa}A${b.a} ${b.b} ${deg} 1 0 ${b.x - b.a * ca} ${b.y - b.a * sa}Z`;
		})
		.join('');

	const outline = polyline(H.outline, true);
	const N = H.nucleus;

	// rough ER: the target cisterna's lower face carries explicit ribosomes; the rest use dot dashes
	const rerPath = H.rer.map((c) => polyline(c)).join('');
	const ribo = SIZES.ribosome;
	const faceOff = SIZES.rerThickness / 2 + ribo / 2 + 0.001;
	const target = H.rer[2];
	// the target cisterna's lower (cytosolic) face carries explicit ribosomes: dashes only on its upper face
	const mid = Math.floor(target.length / 2);
	const down = offset(target, faceOff)[mid][1] > target[mid][1] ? 1 : -1;
	const rerDots = H.rer
		.map((c) =>
			c === target
				? polyline(offset(c, -down * faceOff))
				: polyline(offset(c, faceOff)) + polyline(offset(c, -faceOff))
		)
		.join('');
	// explicit ribosomes along the target's lower (cytosolic) face, 37 nm apart, one at the target point
	const [ex, ey] = H.targets.erFace;
	const erRibosomes: Pt[] = [];
	for (let k = -40; k <= 40; k++) {
		const x = ex + (k * ER.spacing) / 1000;
		const dxN = x - N.x;
		const rr = Math.hypot(ex - N.x, ey - N.y) + ribo / 2 + 0.001;
		if (Math.abs(dxN) >= rr) continue;
		const y = N.y + Math.sqrt(rr * rr - dxN * dxN);
		erRibosomes.push([x, y]);
	}
	const erRiboPath = erRibosomes.map(([x, y]) => circlePath(x, y, ribo / 2)).join('');

	const serPath = H.ser.map((c) => polyline(c)).join('');
	const golgiPath = H.golgi.map((c) => polyline(c)).join('');
	const mtPath = H.microtubules.map((c) => polyline(c)).join('');

	// mitochondria: outer membrane, inner membrane, cristae
	const innerOf = (c: Capsule): Capsule => ({
		...c,
		a: c.a - SIZES.ims - SIZES.membrane,
		b: c.b - SIZES.ims - SIZES.membrane
	});
	const mitoOuter = H.mitochondria.map((c) => capsulePath(c.x, c.y, c.a, c.b, c.angle)).join('');
	const mitoInner = H.mitochondria
		.map((c) => {
			const i = innerOf(c);
			return capsulePath(i.x, i.y, i.a, i.b, i.angle);
		})
		.join('');
	function cristaLines(c: Capsule, list: ReturnType<typeof cristae>) {
		const ib = innerOf(c).b;
		const ca = Math.cos(c.angle);
		const sa = Math.sin(c.angle);
		const at = (u: number, v: number): Pt => [c.x + u * ca - v * sa, c.y + u * sa + v * ca];
		return list.map((k) => {
			const v0 = k.side * ib;
			// the round cap reaches half the crista's thickness beyond the line's end
			const v1 = k.side * (ib - 2 * ib * k.reach) + k.side * (SIZES.crista / 2);
			return polyline([at(k.s, v0), at(k.s, v1)]);
		});
	}
	const cristaPath = H.mitochondria
		.map((c, i) => cristaLines(c, i === 0 ? targetCristae() : cristae(c, 1000 + i)).join(''))
		.join('');
	// the target crista's tip, where the crista view's ATP synthases sit
	const [tx, ty] = H.targets.cristaTip;
	/** The ribosomes nearest the ER target (drawn as outlines when zoomed in). */
	const nearRibosomes = erRibosomes.filter(([x]) => Math.abs(x - ex) < 0.6);

	// nucleus: two membranes 30 nm apart, broken by pores 120 nm wide
	const rOut = N.r;
	const rIn = N.r - SIZES.perinuclear - SIZES.membrane;
	function envelope(r: number) {
		const half = SIZES.pore / 2 / r;
		const ps = [...H.pores].sort((a, b) => a - b);
		let d = '';
		for (let i = 0; i < ps.length; i++) {
			const a0 = ps[i] + half;
			const a1 = ps[(i + 1) % ps.length] - half + (i + 1 === ps.length ? Math.PI * 2 : 0);
			const p0 = [N.x + r * Math.cos(a0), N.y + r * Math.sin(a0)];
			const p1 = [N.x + r * Math.cos(a1), N.y + r * Math.sin(a1)];
			d += `M${p0[0]} ${p0[1]}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0]} ${p1[1]}`;
		}
		return d;
	}
	const envOuter = envelope(rOut);
	const envInner = envelope(rIn);
	const poreBlobs = H.pores
		.flatMap((a) => {
			const rm = (rOut + rIn) / 2;
			return [-1, 1].map((s) => {
				const b = a + (s * (SIZES.pore / 2 - 0.012)) / rm;
				return circlePath(N.x + rm * Math.cos(b), N.y + rm * Math.sin(b), 0.022);
			});
		})
		.join('');
	const hetero = H.heterochromatin.map((d) => circlePath(d.x, d.y, d.r)).join('');
	const [cx0, cy0] = H.targets.chromatin;
	// the beads around the chromatin view, kept inside the nucleus
	const field = chromatinField().filter((run) =>
		run.beads.every(([x, y]) => Math.hypot(cx0 + x / 1000 - N.x, cy0 + y / 1000 - N.y) < N.r - 0.05)
	);
	const nucleosomeDots = field
		.flatMap((run) => run.beads.map(([x, y]) => circlePath(cx0 + x / 1000, cy0 + y / 1000, 0.0055)))
		.join('');
	const linkers = field
		.map((run) => polyline(run.beads.map(([x, y]) => [cx0 + x / 1000, cy0 + y / 1000] as Pt)))
		.join('');

	const disc = (list: { x: number; y: number; r: number }[]) =>
		list.map((d) => circlePath(d.x, d.y, d.r)).join('');
	const perox = disc(H.peroxisomes);
	const peroxCores = H.peroxisomes
		.map((d) => `M${d.x - d.r * 0.35} ${d.y - d.r * 0.25}h${d.r * 0.7}v${d.r * 0.5}h${-d.r * 0.7}Z`)
		.join('');
	const lyso = disc(H.lysosomes);
	const endo = disc(H.endosomes);
	const endoInner = H.endosomes
		.flatMap((d) =>
			[0, 1, 2].map((k) =>
				circlePath(
					d.x + Math.cos(k * 2.1) * d.r * 0.45,
					d.y + Math.sin(k * 2.1) * d.r * 0.45,
					0.025
				)
			)
		)
		.join('');
	const centrioles = H.centrioles.map((c) => capsulePath(c.x, c.y, c.a, c.b, c.angle)).join('');

	// the cell edge: actin filaments in the cortex and the proteins in the membrane, near the edge target
	const [bx, by] = H.targets.edge;
	const actin: Pt[][] = CORTEX_ACTIN.map((seg) =>
		seg.map(([x, y]) => [bx + x / 1000, by + y / 1000] as Pt)
	);
	const actinPath = actin.map((p) => polyline(p)).join('');
</script>

<script lang="ts">
	import Machine from './Machine.svelte';
	import Part from './Part.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { FrameProps } from './types';

	let { ppu, sel, pick, interactive }: FrameProps = $props();

	/** A stroke width: the true width (µm), or `minPx` stage units if that is wider. */
	const sw = (trueUm: number, minPx: number) => Math.max(trueUm, minPx / ppu);
	const detail = $derived(smoothstep(40, 90, ppu));
	const fine = $derived(smoothstep(600, 1400, ppu));
</script>

<g>
	<rect x="-60" y="-40" width="120" height="80" fill="var(--tc-plasma)" />
	<!-- the neighbouring cells, as in the tissue view -->
	<Part id="hepatocyte" {sel} {pick} {interactive}>
		<path
			d={neighbourPath}
			fill="var(--tc-cytosol)"
			stroke="var(--tc-cytosol-edge)"
			stroke-width={sw(0.004, 1)}
		/>
		<path d={neighbourPath} fill="url(#hep-dots)" />
	</Part>
	<path
		d={neighbourNuclei}
		fill="var(--tc-nucleus)"
		stroke="var(--tc-envelope)"
		stroke-width={sw(0.004, 1)}
	/>
	<Part id="redBloodCell" {sel} {pick} {interactive}>
		<path d={rbcs} fill="var(--tc-rbc)" stroke="var(--tc-rbc-edge)" stroke-width={sw(0.004, 0.8)} />
	</Part>
	<defs>
		<pattern id="hep-dots" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
			<ellipse cx="0.4" cy="0.5" rx="0.45" ry="0.22" fill="var(--tc-dots)" />
			<ellipse cx="1.2" cy="1.25" rx="0.3" ry="0.2" fill="var(--tc-dots)" />
		</pattern>
	</defs>

	<!-- the cell: cytosol and membrane -->
	<Part id="cytosol" {sel} {pick} {interactive}>
		<path d={outline} fill="var(--tc-cytosol)" />
	</Part>
	<Part id="microtubule" {sel} {pick} {interactive}>
		<path
			d={mtPath}
			fill="none"
			stroke="var(--tc-tubule)"
			stroke-width={sw(SIZES.microtubule, 0.6)}
			stroke-linecap="round"
			opacity="0.7"
		/>
	</Part>
	<Part id="plasmaMembrane" {sel} {pick} {interactive}>
		<path
			d={outline}
			fill="none"
			stroke="var(--tc-cytosol-edge)"
			stroke-width={sw(SIZES.membrane, 1.4)}
		/>
	</Part>
	{#if fine > 0}
		<g opacity={fine}>
			<Part id="actin" {sel} {pick} {interactive}>
				<path
					d={actinPath}
					fill="none"
					stroke="var(--tc-actin)"
					stroke-width="0.0065"
					stroke-linecap="round"
				/>
			</Part>
			{#each MEMBRANE_PROTEINS as m (m.id)}
				<g transform="translate({bx} {by}) scale(0.001)"><Machine id={m.id} x={m.x} y={m.y} /></g>
			{/each}
		</g>
	{/if}

	<!-- smooth ER and Golgi -->
	<Part id="smoothER" {sel} {pick} {interactive}>
		<path
			d={serPath}
			fill="none"
			stroke="var(--tc-er-edge)"
			stroke-width={SIZES.serThickness + 0.008}
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={0.25 + 0.5 * detail}
		/>
		<path
			d={serPath}
			fill="none"
			stroke="var(--tc-ser)"
			stroke-width={SIZES.serThickness}
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={0.45 + 0.55 * detail}
		/>
	</Part>
	<Part id="golgi" {sel} {pick} {interactive}>
		<path
			d={golgiPath}
			fill="none"
			stroke="var(--tc-golgi-edge)"
			stroke-width={SIZES.golgiThickness + 0.008}
			stroke-linecap="round"
		/>
		<path
			d={golgiPath}
			fill="none"
			stroke="var(--tc-golgi)"
			stroke-width={SIZES.golgiThickness}
			stroke-linecap="round"
		/>
	</Part>

	<!-- rough ER with its ribosomes -->
	<Part id="roughER" {sel} {pick} {interactive}>
		<path
			d={rerPath}
			fill="none"
			stroke="var(--tc-er-edge)"
			stroke-width={SIZES.rerThickness + 0.008}
			stroke-linecap="round"
			opacity={0.35 + 0.65 * detail}
		/>
		<path
			d={rerPath}
			fill="none"
			stroke="var(--tc-er)"
			stroke-width={SIZES.rerThickness}
			stroke-linecap="round"
		/>
	</Part>
	<Part id="ribosome" {sel} {pick} {interactive}>
		<g opacity={0.45 + 0.55 * detail}>
			<path
				d={rerDots}
				fill="none"
				stroke="var(--tc-ribosome)"
				stroke-width={ribo}
				stroke-dasharray="0.0001 0.037"
				stroke-linecap="round"
			/>

			<path d={erRiboPath} fill="var(--tc-ribosome)" opacity={1 - fine} />
			{#if fine > 0}
				<g opacity={fine}>
					{#each nearRibosomes as [x, y], i (i)}
						<g transform="translate({x} {y - ribo / 2 - 0.001}) scale(0.001)"
							><Machine id="ribosome80S" x={0} y={0} /></g
						>
					{/each}
				</g>
			{/if}
		</g>
	</Part>

	<!-- mitochondria -->
	<Part id="mitochondrion" {sel} {pick} {interactive}>
		<path
			d={mitoOuter}
			fill="var(--tc-mito)"
			stroke="var(--tc-mito-edge)"
			stroke-width={sw(SIZES.membrane, 0.8)}
		/>
		<path
			d={mitoInner}
			fill="var(--tc-matrix)"
			stroke="var(--tc-mito-edge)"
			stroke-width={sw(SIZES.membrane, 0.6)}
			opacity={detail}
		/>
	</Part>
	<Part id="crista" {sel} {pick} {interactive}>
		<path
			d={cristaPath}
			fill="none"
			stroke="var(--tc-mito-edge)"
			stroke-width={Math.max(SIZES.crista, 0.9 / ppu)}
			stroke-linecap="round"
		/>
		<path
			d={cristaPath}
			fill="none"
			stroke="var(--tc-mito)"
			stroke-width={SIZES.crista - 2 * SIZES.membrane}
			stroke-linecap="round"
			opacity={detail}
		/>
	</Part>
	{#if fine > 0}
		<g opacity={fine}>
			<Part id="atpSynthase" {sel} {pick} {interactive}>
				<g transform="translate({tx - 0.025} {ty}) scale(0.001)">
					{#each CRISTA_MACHINES as m, i (i)}
						<Machine id={m.id} x={m.x} y={m.y} angle={m.angle} flip={m.flip} />
					{/each}
				</g>
			</Part>
		</g>
	{/if}

	<!-- small round organelles -->
	<Part id="peroxisome" {sel} {pick} {interactive}>
		<path
			d={perox}
			fill="var(--tc-perox)"
			stroke="var(--tc-organelle-edge)"
			stroke-width={sw(SIZES.membrane, 0.6)}
		/>
		<path d={peroxCores} fill="var(--tc-organelle-edge)" opacity="0.5" />
	</Part>
	<Part id="lysosome" {sel} {pick} {interactive}>
		<path
			d={lyso}
			fill="var(--tc-lyso)"
			stroke="var(--tc-organelle-edge)"
			stroke-width={sw(SIZES.membrane, 0.6)}
		/>
	</Part>
	<Part id="endosome" {sel} {pick} {interactive}>
		<path
			d={endo}
			fill="var(--tc-endo)"
			stroke="var(--tc-organelle-edge)"
			stroke-width={sw(SIZES.membrane, 0.6)}
		/>
		<path
			d={endoInner}
			fill="none"
			stroke="var(--tc-organelle-edge)"
			stroke-width={sw(SIZES.membrane, 0.4)}
			opacity={detail}
		/>
	</Part>
	<Part id="centriole" {sel} {pick} {interactive}>
		<path d={centrioles} fill="var(--tc-tubule)" opacity="0.8" />
	</Part>

	<!-- nucleus -->
	<Part id="nucleus" {sel} {pick} {interactive}>
		<circle cx={N.x} cy={N.y} r={rIn} fill="var(--tc-nucleus)" />
		<path d={hetero} fill="var(--tc-chromatin)" opacity="0.55" />
	</Part>
	<Part id="nucleolus" {sel} {pick} {interactive}>
		<circle
			cx={H.nucleolus.x}
			cy={H.nucleolus.y}
			r={H.nucleolus.r}
			fill="var(--tc-nucleolus)"
			opacity="0.85"
		/>
	</Part>
	<Part id="nuclearEnvelope" {sel} {pick} {interactive}>
		<circle
			cx={N.x}
			cy={N.y}
			r={(rOut + rIn) / 2}
			fill="none"
			stroke="var(--tc-envelope)"
			stroke-width={Math.max(rOut - rIn + SIZES.membrane, 1.2 / ppu)}
			opacity={1 - detail}
		/>
		<g opacity={detail}>
			<path
				d={envOuter}
				fill="none"
				stroke="var(--tc-envelope)"
				stroke-width={sw(SIZES.membrane, 0.7)}
			/>
			<path
				d={envInner}
				fill="none"
				stroke="var(--tc-envelope)"
				stroke-width={sw(SIZES.membrane, 0.7)}
			/>
		</g>
	</Part>
	{#if detail > 0}
		<g opacity={detail}>
			<Part id="nuclearPore" {sel} {pick} {interactive}>
				<path d={poreBlobs} fill="var(--tc-envelope)" />
			</Part>
		</g>
	{/if}
	{#if fine > 0}
		<g opacity={fine}>
			<Part id="chromatin" {sel} {pick} {interactive}>
				<path d={linkers} fill="none" stroke="var(--tc-dna)" stroke-width="0.002" />
				<path d={nucleosomeDots} fill="var(--tc-histone)" />
			</Part>
		</g>
	{/if}
</g>
