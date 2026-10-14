<script lang="ts">
	/**
	 * A plain front-to-back X-ray of the model body (left), the real line
	 * integral of μ at 60 keV through its ellipsoids and cylinders
	 * (`radiographAt`), brighter where more is absorbed.
	 *
	 * Phases:
	 *   plain   — right: the slice at the middle of the chest seen from above,
	 *             with one ray sweeping across it front to back, and the bar of
	 *             what that ray adds up (μ × length of each part it crosses);
	 *             the ray's point is marked on the X-ray.
	 *   compare — right: the CT slice at the height of the draggable line
	 *             (params.slice), rebuilt by filtered back-projection from 180
	 *             simulated shadows, in a soft-tissue window (−250…+250 HU),
	 *             with the nodule and the cyst pointed out where the slice cuts
	 *             them, and marked (dashed) on the X-ray.
	 */
	import { Handle, Label, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BODY,
		BODY_FOV,
		BODY_Z,
		CT_KEV,
		CT_N,
		bodySlice,
		hounsfield,
		mu,
		partScale,
		radiographAt,
		reconstruct,
		scan,
		type BodyPart
	} from '../imaging';
	import { greyImage, range } from './raster';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'plain'));

	// ---- the X-ray -----------------------------------------------------------------------
	const XW = 17; // half width shown, cm
	const PXC = 10.4; // px per cm
	const X0 = 34;
	const Y0 = 74;
	const W = 2 * XW * PXC;
	const H = (BODY_Z[1] - BODY_Z[0]) * PXC;
	const GW = 170;
	const GH = 200;
	const muW = mu('water', CT_KEV);
	const film = (() => {
		const v = new Float64Array(GW * GH);
		for (let r = 0; r < GH; r++) {
			const z = BODY_Z[0] + ((r + 0.5) / GH) * (BODY_Z[1] - BODY_Z[0]);
			for (let c = 0; c < GW; c++) v[r * GW + c] = radiographAt(-XW + ((c + 0.5) / GW) * 2 * XW, z);
		}
		return v;
	})();
	const filmMax = range(film)[1];
	const filmUrl = $derived(greyImage(film, GW, GH, 0, filmMax));
	const sx = (x: number) => X0 + (x + XW) * PXC;
	const sz = (z: number) => Y0 + (z - BODY_Z[0]) * PXC;

	const part = (id: string) => BODY.find((p) => p.id === id) as BodyPart;
	const nodule = part('nodule');
	const cyst = part('cyst');

	// ---- plain: one ray through the middle slice --------------------------------------------
	const RCX = 700;
	const RCY = 196;
	const RS = 10; // px per cm in the slice drawing
	const rayX = $derived(reduced ? 4 : -14 + 28 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 14)));
	const MAT_FILL: Record<string, string> = {
		fat: 'var(--mi-fat)',
		soft: 'var(--mi-soft)',
		lung: 'var(--mi-lung)',
		bone: 'var(--mi-bone)',
		water: 'var(--mi-water)'
	};
	const shapes0 = BODY.filter((p) => partScale(p, 0) > 0).map((p) => ({
		p,
		s: partScale(p, 0),
		fill: p.id === 'heart' ? 'var(--mi-muscle)' : MAT_FILL[p.material]
	}));
	/** Length (cm) of the vertical line at x inside a part at height 0. */
	const chord = (p: BodyPart, x: number) => {
		const s = partScale(p, 0);
		if (s <= 0) return 0;
		const u = (x - p.x0) / (p.a * s);
		return u * u < 1 ? 2 * p.b * s * Math.sqrt(1 - u * u) : 0;
	};
	const contributions = $derived.by(() => {
		const out: { id: string; name: string; len: number; p: number; fill: string }[] = [];
		for (const { p, fill } of shapes0) {
			let len = chord(p, rayX);
			for (const q of BODY) if (q.parent === p.id) len -= chord(q, rayX);
			if (len > 0.01)
				out.push({ id: p.id, name: p.name, len, p: len * mu(p.material, CT_KEV), fill });
		}
		return out;
	});
	const total = $derived(contributions.reduce((a, c) => a + c.p, 0));

	// ---- compare: the CT slice at the line -------------------------------------------------
	const z = $derived(Number(params.slice ?? 0));
	const CX = 520;
	const CY = 74;
	const CS = 380;
	const ctImg = $derived(phase === 'compare' ? reconstruct(scan(bodySlice(z), 180), true) : null);
	const ctUrl = $derived(
		ctImg ? greyImage(ctImg, CT_N, CT_N, muW * (1 - 0.25), muW * (1 + 0.25)) : ''
	);
	const cpx = CS / (2 * BODY_FOV);
	const inSlice = (p: BodyPart) => partScale(p, z) > 0;
	const noduleOn = $derived(inSlice(nodule));
	const cystOn = $derived(inSlice(cyst));
	const sliceParts = $derived(
		BODY.filter((p) => inSlice(p) && !['fat', 'muscle', 'marrow'].includes(p.id)).map((p) => p.name)
	);
	function moveLine(p: Point) {
		const v = Math.round(((p.y - Y0) / PXC + BODY_Z[0]) * 2) / 2;
		setParam('slice', Math.max(-18, Math.min(18, v)));
	}
	function keyLine(s: number | 'start' | 'end') {
		const v = s === 'start' ? -18 : s === 'end' ? 18 : z + s * 0.5;
		setParam('slice', Math.max(-18, Math.min(18, v)));
	}
	const cystHU = $derived(Math.round(hounsfield(mu('water', CT_KEV), muW)));
	const liverHU = Math.round(hounsfield(mu('soft', CT_KEV), muW));
</script>

<g>
	<!-- ================= the X-ray ================= -->
	<text x={X0} y={50} font-weight="600" style:font-size="15px">Plain X-ray, front to back</text>
	<rect
		x={X0 - 1}
		y={Y0 - 1}
		width={W + 2}
		height={H + 2}
		fill="var(--mi-panel)"
		stroke="var(--border)"
	/>
	<image href={filmUrl} x={X0} y={Y0} width={W} height={H} preserveAspectRatio="none" />
	<Readout id="sides">
		<Label x={X0 + 4} y={Y0 + H + 18} anchor="start" muted text="patient's right" />
		<Label x={X0 + W - 4} y={Y0 + H + 18} anchor="end" muted text="patient's left" />
	</Readout>

	{#if phase === 'plain'}
		<line
			x1={X0}
			y1={sz(0)}
			x2={X0 + W}
			y2={sz(0)}
			stroke="var(--mi-shadow)"
			stroke-dasharray="4 4"
			opacity="0.8"
		/>
		<circle
			cx={sx(rayX)}
			cy={sz(0)}
			r="5"
			fill="var(--mi-xray)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>

		<!-- the slice from above, with the ray -->
		<text x={RCX - 170} y={50} font-weight="600" style:font-size="15px">One ray, front to back</text
		>
		<g transform="translate({RCX} {RCY}) scale({RS})">
			{#each shapes0 as s (s.p.id)}
				<ellipse
					cx={s.p.x0}
					cy={s.p.y0}
					rx={s.p.a * s.s}
					ry={s.p.b * s.s}
					fill={s.fill}
					stroke={s.p.material === 'bone' ? 'var(--mi-bone-edge)' : 'var(--stage-line)'}
					stroke-width={1 / RS}
				/>
			{/each}
		</g>
		<line
			x1={RCX + rayX * RS}
			y1={RCY - 13 * RS}
			x2={RCX + rayX * RS}
			y2={RCY + 12.5 * RS}
			stroke="var(--mi-xray)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<Readout id="front">
			<Label x={RCX + 172} y={RCY - 100} anchor="start" muted text="front" />
			<Label x={RCX + 172} y={RCY + 104} anchor="start" muted text="back" />
		</Readout>

		<!-- what the ray adds up -->
		{@const BX = RCX - 220}
		{@const BW = 440}
		{@const scaleP = BW / 7}
		<Readout id="sumhead">
			<Label
				x={BX}
				y={354}
				anchor="start"
				text="what the ray adds up: μ × length of everything it crosses"
			/>
		</Readout>
		<g>
			{#each contributions as c, i (c.id)}
				{@const x = BX + contributions.slice(0, i).reduce((a, d) => a + d.p, 0) * scaleP}
				<rect
					{x}
					y={366}
					width={Math.max(0.5, c.p * scaleP)}
					height={22}
					fill={c.fill}
					stroke="var(--stage-line)"
				/>
			{/each}
		</g>
		<Readout id="parts">
			{#each contributions.filter((c) => c.p * scaleP > 6) as c, i (c.id)}
				<Label
					x={BX + (i % 2) * 230}
					y={414 + Math.floor(i / 2) * 20}
					anchor="start"
					muted
					text="{c.name}: {c.len.toFixed(1)} cm → {c.p.toFixed(2)}"
				/>
			{/each}
		</Readout>
		<Readout
			id="total"
			order={1}
			label="This ray's total"
			value="p = {total.toFixed(2)}"
			note="{(Math.exp(-total) * 100).toPrecision(2)}% of the photons get through"
		>
			<text x={BX} y={520} style:font-size="15px" font-weight="600">
				total p = {total.toFixed(2)}: {(Math.exp(-total) * 100).toPrecision(2)}% of the photons get
				through
			</text>
		</Readout>
		<Readout id="note">
			<Label
				x={BX}
				y={546}
				anchor="start"
				muted
				text="the X-ray shows only this total: not what was crossed, nor at what depth"
			/>
		</Readout>
	{:else}
		<!-- the slice line on the X-ray -->
		<line
			x1={X0 - 6}
			y1={sz(z)}
			x2={X0 + W + 6}
			y2={sz(z)}
			stroke="var(--mi-probe)"
			stroke-width="2"
		/>
		<Handle
			x={X0 + W + 6}
			y={sz(z)}
			label="Height of the CT slice"
			value={z}
			min={-18}
			max={18}
			valuetext="{z} centimetres from the middle"
			color="var(--mi-probe)"
			onmove={moveLine}
			onkey={keyLine}
		/>
		<!-- where the hidden things are on the X-ray -->
		<circle
			cx={sx(nodule.x0)}
			cy={sz(nodule.z0)}
			r={nodule.a * PXC + 6}
			fill="none"
			stroke="var(--mi-probe)"
			stroke-dasharray="3 3"
		/>
		<circle
			cx={sx(cyst.x0)}
			cy={sz(cyst.z0)}
			r={cyst.a * PXC + 6}
			fill="none"
			stroke="var(--mi-probe)"
			stroke-dasharray="3 3"
		/>
		<Readout id="xmarks">
			<Label
				x={sx(nodule.x0)}
				y={sz(nodule.z0) - nodule.a * PXC - 12}
				text="lump"
				color="var(--mi-probe)"
			/>
			<Label
				x={sx(cyst.x0)}
				y={sz(cyst.z0) + cyst.a * PXC + 22}
				text="fluid (invisible)"
				color="var(--mi-probe)"
			/>
		</Readout>

		<text x={CX} y={50} font-weight="600" style:font-size="15px">CT slice at the line</text>
		<rect
			x={CX - 1}
			y={CY - 1}
			width={CS + 2}
			height={CS + 2}
			fill="var(--mi-panel)"
			stroke="var(--border)"
		/>
		{#if ctUrl}
			<image href={ctUrl} x={CX} y={CY} width={CS} height={CS} preserveAspectRatio="none" />
		{/if}
		{#if noduleOn}
			{@const r = nodule.a * partScale(nodule, z) * cpx + 8}
			<circle
				cx={CX + CS / 2 + nodule.x0 * cpx}
				cy={CY + CS / 2 + nodule.y0 * cpx}
				{r}
				fill="none"
				stroke="var(--mi-probe)"
				stroke-width="1.5"
			/>
			<Readout id="nod" order={3} label="Lump in the left lung" value="seen in the slice">
				<Label
					x={CX + CS / 2 + nodule.x0 * cpx}
					y={CY + CS / 2 + nodule.y0 * cpx + r + 16}
					text="lump"
					color="var(--mi-probe)"
				/>
			</Readout>
		{/if}
		{#if cystOn}
			{@const r = cyst.a * partScale(cyst, z) * cpx + 8}
			<circle
				cx={CX + CS / 2 + cyst.x0 * cpx}
				cy={CY + CS / 2 + cyst.y0 * cpx}
				{r}
				fill="none"
				stroke="var(--mi-probe)"
				stroke-width="1.5"
			/>
			<Readout
				id="cyst"
				order={3}
				label="Fluid in the liver"
				value="{cystHU} HU against {liverHU} HU"
			>
				<Label
					x={CX + CS / 2 + cyst.x0 * cpx}
					y={CY + CS / 2 + cyst.y0 * cpx - r - 14}
					text="fluid: {cystHU} HU, liver +{liverHU} HU"
					color="var(--mi-probe)"
				/>
			</Readout>
		{/if}
		<Readout
			id="z"
			order={1}
			label="Slice"
			value={z === 0 ? 'middle of the chest' : `${Math.abs(z)} cm ${z < 0 ? 'higher' : 'lower'}`}
		>
			<Label
				x={CX}
				y={CY + CS + 24}
				anchor="start"
				text="slice {z === 0
					? 'at the middle of the chest'
					: `${Math.abs(z)} cm ${z < 0 ? 'higher' : 'lower'}`} · 180 shadows · grey scale ±250 HU"
			/>
		</Readout>
		<Readout
			id="parts"
			order={2}
			label="In this slice"
			value={sliceParts.join(', ') || 'muscle and fat'}
		>
			<Label
				x={CX}
				y={CY + CS + 46}
				anchor="start"
				muted
				text="in this slice: {sliceParts.join(', ') || 'only muscle and fat'}"
			/>
		</Readout>
	{/if}
</g>
