<script lang="ts">
	/**
	 * Two ways to hold a fusion plasma.
	 *
	 * Phases (`step.hints.phase`):
	 *   magnetic — a tokamak in perspective: a ring of plasma inside D-shaped field coils, one
	 *              helical field line with ions running along it; an inset shows one ion
	 *              spiralling round a straight field line (the sideways magnetic force)
	 *   inertial — a laser-driven capsule (NIF): beams enter a gold can, its X-rays blow off
	 *              the capsule surface, the recoil crushes the fuel, it fuses in a flash and
	 *              neutrons fly out; on a 6-second loop
	 *
	 * The two layers cross-fade with a tween when the step changes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, clamp, cycle, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { step, t, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'magnetic'));
	const mix = new Tween(
		untrack(() => (phase === 'inertial' ? 1 : 0)),
		{
			duration: 800,
			easing: cubicInOut
		}
	);
	$effect(() => {
		const target = phase === 'inertial' ? 1 : 0;
		const duration = untrack(() => (reduced ? 0 : 800));
		untrack(() => mix.set(target, { duration }));
	});
	const oMag = $derived(smoothstep(0.5, 0, mix.current));
	const oIn = $derived(smoothstep(0.5, 1, mix.current));
	const time = $derived(reduced ? 2.5 : t);

	// ---- tokamak geometry (3D → 2D) --------------------------------------------------------
	const CX = 330;
	const CY = 320;
	const RM = 220; // major radius
	const A = 52; // plasma minor radius
	const TILT = 0.36; // vertical squash of the ring (viewing angle)
	const proj = (phi: number, rr: number, th: number) => {
		const rad = RM + rr * Math.cos(th);
		return {
			x: CX + rad * Math.cos(phi),
			y: CY + rad * Math.sin(phi) * TILT - rr * Math.sin(th) * 0.92,
			front: Math.sin(phi) > 0
		};
	};
	const COILS = 8;
	const coils = Array.from({ length: COILS }, (_, k) => {
		const phi = (k / COILS) * Math.PI * 2 + 0.2;
		let d = '';
		for (let i = 0; i <= 40; i++) {
			const th = (i / 40) * Math.PI * 2;
			const p = proj(phi, A + 22, th);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return { k, d: d + 'Z', front: Math.sin(phi) > 0 };
	});
	// One field line: once round the ring the long way, about 3 times round the short way.
	const TURNS = 3.2;
	const N = 360;
	const field = Array.from({ length: N + 1 }, (_, i) => {
		const phi = (i / N) * Math.PI * 2;
		return proj(phi, A * 0.62, phi * TURNS);
	});
	const segs = (front: boolean) => {
		let d = '';
		let pen = false;
		for (const p of field) {
			if (p.front === front) {
				d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
				pen = true;
			} else pen = false;
		}
		return d;
	};
	const fieldBack = segs(false);
	const fieldFront = segs(true);
	const ions = $derived(
		Array.from({ length: 10 }, (_, i) => {
			const u = cycle(time, 14, i / 10);
			const phi = u * Math.PI * 2;
			const p = proj(phi, A * 0.62, phi * TURNS);
			return { id: i, ...p };
		})
	);
	const ring = (rr: number) => {
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const phi = (i / 120) * Math.PI * 2;
			const p = proj(phi, rr, -Math.PI / 2);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d + 'Z';
	};

	// ---- gyration inset ------------------------------------------------------------------
	const IX0 = 640;
	const IX1 = 920;
	const IY = 200;
	const GR = 22;
	const gyroPath = (() => {
		let d = '';
		for (let i = 0; i <= 200; i++) {
			const s = i / 200;
			const x = IX0 + 10 + s * (IX1 - IX0 - 20);
			const y = IY - GR * Math.sin(s * Math.PI * 2 * 6);
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	})();
	const gyro = $derived.by(() => {
		const s = cycle(time, 6);
		const ang = s * Math.PI * 2 * 6;
		return {
			x: IX0 + 10 + s * (IX1 - IX0 - 20),
			y: IY - GR * Math.sin(ang),
			front: Math.cos(ang) > 0
		};
	});

	// ---- inertial confinement ------------------------------------------------------------
	const HX = 480;
	const HY = 300;
	const HW = 300;
	const HH = 190;
	const u = $derived(reduced ? 0.4 : cycle(t, 6));
	const lasers = $derived(smoothstep(0, 0.08, u) * (1 - smoothstep(0.42, 0.5, u)));
	const xrays = $derived(smoothstep(0.15, 0.25, u) * (1 - smoothstep(0.55, 0.62, u)));
	const squeeze = $derived(smoothstep(0.2, 0.68, u));
	const capR = $derived(40 - 32 * squeeze);
	const flash = $derived(smoothstep(0.66, 0.7, u) * (1 - smoothstep(0.72, 0.86, u)));
	const outward = $derived(clamp((u - 0.7) / 0.28));
	const reset = $derived(1 - smoothstep(0.95, 1, u));
	// Beams enter through the open ends and strike the far inside wall near that end, as
	// NIF's cones of beams do.
	const beams = [-1, 1].flatMap((side) =>
		[-1, -0.4, 0.4, 1].map((k) => {
			const xo = HX + side * (HW / 2); // the opening
			const yo = HY - 30 * k;
			const xe = HX + side * (HW / 2 - (Math.abs(k) > 0.5 ? 60 : 105)); // hit point
			const ye = HY + Math.sign(k) * (HH / 2 - 6);
			const len = Math.hypot(xe - xo, ye - yo);
			const back = 130; // how far outside the can the beam is drawn
			return {
				id: `${side}${k}`,
				x1: xo - ((xe - xo) / len) * back,
				y1: yo - ((ye - yo) / len) * back,
				x2: xe,
				y2: ye
			};
		})
	);
	const neutrons = Array.from({ length: 14 }, (_, i) => ({
		id: i,
		a: ((i + 0.6 * hash(i, 21)) / 14) * Math.PI * 2
	}));
	const ablate = Array.from({ length: 16 }, (_, i) => ({ id: i, a: (i / 16) * Math.PI * 2 + 0.2 }));
</script>

<g>
	<!-- ===================== magnetic ===================== -->
	{#if oMag > 0.01}
		<g opacity={oMag} style:pointer-events="none">
			<!-- back coils, back of the field line -->
			{#each coils.filter((c) => !c.front) as c (c.k)}
				<path d={c.d} fill="none" stroke="var(--nf-coil)" stroke-width="4" opacity="0.3" />
			{/each}
			<path d={fieldBack} fill="none" stroke="var(--nf-alpha)" stroke-width="1.5" opacity="0.45" />
			<!-- plasma ring: top surface as a thick band -->
			<path
				d={ring(0)}
				fill="none"
				stroke="var(--nf-plasma)"
				stroke-width={A * 1.7}
				opacity="0.45"
				filter="url(#glow)"
			/>
			{#each ions as ion (ion.id)}
				<circle cx={ion.x} cy={ion.y} r="4" fill="var(--nf-fuel)" opacity={ion.front ? 1 : 0.5} />
			{/each}
			<path d={fieldFront} fill="none" stroke="var(--nf-alpha)" stroke-width="2" />
			{#each coils.filter((c) => c.front) as c (c.k)}
				<path d={c.d} fill="none" stroke="var(--nf-coil)" stroke-width="4" opacity="0.75" />
			{/each}
			<Readout id="coils" order={3} label="Field coils" color="var(--nf-coil)" opacity={oMag}>
				<Label
					x={CX - RM - 20}
					y={CY + 110}
					text="field coils"
					anchor="start"
					color="var(--nf-coil)"
					weight={600}
				/>
			</Readout>
			<Readout
				id="fieldline"
				order={4}
				label="A twisted field line"
				color="var(--nf-alpha)"
				opacity={oMag}
			>
				<Label
					x={CX - RM - 30}
					y={CY - 134}
					text="a field line, twisted into a helix"
					anchor="start"
					color="var(--nf-alpha)"
					size={12}
				/>
			</Readout>
			<Readout
				id="plasma"
				order={5}
				label="Plasma ring"
				value="100–200 million K, about 10²⁰ ions/m³"
				opacity={oMag}
			>
				<Label
					x={CX}
					y={CY + 166}
					text="plasma: 100–200 million K, about 10²⁰ ions/m³"
					size={12}
					muted
				/>
			</Readout>

			<!-- inset: one ion round one field line -->
			<rect
				x={IX0 - 8}
				y={IY - 74}
				width={IX1 - IX0 + 16}
				height="138"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<line
				x1={IX0 + 4}
				x2={IX1 - 4}
				y1={IY}
				y2={IY}
				stroke="var(--nf-alpha)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
			/>
			<path d={gyroPath} fill="none" stroke="var(--nf-fuel)" stroke-width="1.2" opacity="0.6" />
			<circle
				cx={gyro.x}
				cy={gyro.y}
				r="6"
				fill="var(--nf-fuel)"
				stroke="var(--stage-bg)"
				stroke-width="1.2"
				opacity={gyro.front ? 1 : 0.55}
			/>
			<Readout
				id="inset"
				order={2}
				label="Charged particles"
				value="spiral round field lines and slide along them"
				opacity={oMag}
			>
				<Label
					x={(IX0 + IX1) / 2}
					y={IY - 52}
					text="an ion spirals round a field line"
					size={12}
					weight={600}
				/>
				<Label
					x={(IX0 + IX1) / 2}
					y={IY + 48}
					text="free to slide along it, not across it"
					size={11}
					muted
				/>
			</Readout>

			<Readout
				id="jet"
				order={1}
				label="JET, 2023"
				value="69 MJ of fusion energy in 5.2 s, from 0.21 mg of fuel"
				opacity={oMag}
			>
				<g transform="translate({IX0 - 8} 330)">
					<rect
						width={IX1 - IX0 + 16}
						height="118"
						rx="10"
						fill="var(--surface)"
						stroke="var(--border)"
					/>
					<text x="14" y="26" font-size="14" font-weight="700">JET, England, 2023</text>
					<text x="14" y="52" font-size="13">69 MJ of fusion energy</text>
					<text x="14" y="74" font-size="13">in a 5.2-second pulse</text>
					<text x="14" y="96" font-size="13" class="muted">from 0.21 mg of fuel</text>
				</g>
			</Readout>
		</g>

		<!-- ===================== inertial ===================== -->
	{/if}
	{#if oIn > 0.01}
		<g opacity={oIn} style:pointer-events="none">
			<!-- gold can, open at both ends -->
			<path
				d="M{HX - HW / 2} {HY - HH / 2 + 50} L{HX - HW / 2} {HY - HH / 2} L{HX + HW / 2} {HY -
					HH / 2} L{HX + HW / 2} {HY - HH / 2 + 50}
			   M{HX - HW / 2} {HY + HH / 2 - 50} L{HX - HW / 2} {HY + HH / 2} L{HX + HW / 2} {HY +
					HH / 2} L{HX + HW / 2} {HY + HH / 2 - 50}"
				fill="none"
				stroke="var(--nf-gold)"
				stroke-width="10"
				stroke-linejoin="round"
			/>
			{#each beams as b (b.id)}
				<line
					x1={b.x1}
					y1={b.y1}
					x2={b.x2}
					y2={b.y2}
					stroke="var(--nf-laser)"
					stroke-width="4"
					opacity={0.9 * lasers * reset}
				/>
				<circle
					cx={b.x2}
					cy={b.y2}
					r={7}
					fill="var(--nf-laser)"
					opacity={0.6 * lasers * reset}
					filter="url(#glow)"
				/>
			{/each}
			<!-- X-rays from the walls towards the capsule -->
			{#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
				{@const a = (k / 8) * Math.PI * 2 + 0.4}
				{@const s = cycle(time, 0.6, k / 8)}
				{@const r = 120 - 70 * s}
				<circle
					cx={HX + Math.cos(a) * r}
					cy={HY + Math.sin(a) * r * 0.62}
					r="3"
					fill="var(--nf-brems)"
					opacity={xrays * reset}
				/>
			{/each}
			<!-- capsule, blowing off its surface -->
			<circle
				cx={HX}
				cy={HY}
				r={capR}
				fill="var(--nf-fuel)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				opacity={reset * (1 - 0.6 * outward)}
			/>
			{#each ablate as b (b.id)}
				{@const d = capR + 8 + 40 * squeeze}
				<circle
					cx={HX + Math.cos(b.a) * d}
					cy={HY + Math.sin(b.a) * d}
					r="2.5"
					fill="var(--stage-ink-muted)"
					opacity={xrays * reset * 0.8}
				/>
			{/each}
			<circle
				cx={HX}
				cy={HY}
				r={10 + 60 * flash}
				fill="var(--nf-fusion)"
				opacity={0.85 * flash}
				filter="url(#glow)"
			/>
			{#each neutrons as n (n.id)}
				{@const d = 14 + 190 * outward}
				<circle
					cx={HX + Math.cos(n.a) * d}
					cy={HY + Math.sin(n.a) * d * 0.42}
					r="3.5"
					fill="var(--nf-neutron)"
					opacity={smoothstep(0, 0.05, outward) * (1 - smoothstep(0.8, 1, outward))}
				/>
			{/each}

			<Readout
				id="beams"
				order={2}
				label="192 laser beams"
				value="2.05 MJ of light"
				color="var(--nf-laser)"
				opacity={oIn}
			>
				<Label
					x={HX - HW / 2 - 40}
					y={HY - 150}
					text="laser beams (192 in all)"
					anchor="end"
					color="var(--nf-laser)"
					weight={600}
				/>
			</Readout>
			<Readout
				id="can"
				order={3}
				label="Gold can"
				value="its walls glow with X-rays"
				color="var(--nf-gold)"
				opacity={oIn}
			>
				<Label x={HX} y={HY - HH / 2 - 18} text="gold can: its walls glow with X-rays" size={12} />
			</Readout>
			<Readout
				id="capsule"
				order={4}
				label="Fuel capsule"
				value="about 2 mm across, crushed inwards"
				opacity={oIn}
			>
				<Label
					x={HX}
					y={HY + HH / 2 + 30}
					text="fuel capsule, 2 mm across, crushed inwards"
					size={12}
				/>
			</Readout>
			<Readout
				id="nif"
				order={1}
				label="NIF, 5 December 2022"
				value="3.15 MJ of fusion from 2.05 MJ of laser light"
				opacity={oIn}
			>
				<g transform="translate(36 486)">
					<rect width="888" height="72" rx="10" fill="var(--surface)" stroke="var(--border)" />
					<text x="16" y="30" font-size="14" font-weight="700"
						>National Ignition Facility, 5 December 2022</text
					>
					<text x="16" y="54" font-size="13"
						>2.05 MJ of laser light in, 3.15 MJ of fusion out — for less than a billionth of a
						second</text
					>
				</g>
			</Readout>
		</g>
	{/if}
</g>
