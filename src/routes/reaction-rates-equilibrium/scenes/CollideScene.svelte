<script lang="ts">
	/**
	 * Two molecules meeting, close up, beside the energy profile.
	 *
	 * Phase `bounce`: an H₂ and an I₂ collide every 3 s and fly apart. Each
	 * collision's energy (along the line between the centres) is drawn from the real
	 * distribution at 700 K, an exponential with mean RT = 5.8 kJ/mol, so the meter
	 * and the marker on the profile barely leave the floor: none gets near 171.
	 * Phase `react`: one of the rare collisions that do get over (its energy is the
	 * barrier plus an exponential excess, the energies above Ea being distributed
	 * that way), every 6 s: the four atoms pass through the transition state and two
	 * HI fly apart, while the marker rides over the top of the profile.
	 * Reduced motion (t = 2.5): just after a bounce, or on the way into the
	 * transition state.
	 */
	import { Label, hash, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Profile, { climbTo } from '../parts/Profile.svelte';
	import { ATOM, atoms, circ, fmtPow } from '../look';
	import { DH, EA_F, R, fractionAbove } from '../model';

	let { step, t }: StageProps = $props();

	const react = $derived(step.hints?.phase === 'react');
	const T = 700;
	const RT = (R * T) / 1000;
	const EA = EA_F / 1000;
	const dh = DH / 1000;
	const S = 3.2; // close-up scale
	const C = { x: 200, y: 290 };

	// ---- bounce: one collision every P seconds ---------------------------------------
	const P = 3;
	const P2 = 6;
	const n = $derived(Math.floor(t / P));
	const u = $derived((t % P) / P);
	const energyOf = (k: number) => -RT * Math.log(Math.max(1e-9, hash(k + 1, 3)));
	/** Energy shown on the meter: the last collision's (none before the first). */
	const shown = $derived(
		react
			? EA + energyOf(Math.floor(t / P2)) * 0.6
			: u >= 0.5
				? energyOf(n)
				: n > 0
					? energyOf(n - 1)
					: 0
	);
	const collisions = $derived(react ? 0 : n + (u >= 0.5 ? 1 : 0));

	const bounce = $derived.by(() => {
		const tilt = (hash(n, 9) - 0.5) * 40;
		const dy = (hash(n, 5) - 0.5) * 60 * Math.abs(1 - 2 * u) * (u < 0.5 ? 1 : -1);
		const d = 62 + 300 * Math.abs(1 - 2 * u);
		const spin = (t * 70) % 360;
		const h = { x: C.x - d * 0.42, y: C.y + dy };
		const i = { x: C.x + d * 0.58, y: C.y - dy };
		return {
			h,
			i,
			list: [...atoms('h2', h.x, h.y, spin + tilt, S), ...atoms('i2', i.x, i.y, -spin * 0.5, S)]
		};
	});

	// ---- react: one successful collision every P2 seconds ----------------------------
	const v = $derived(((t + 0.5) % P2) / P2); // t = 2.5 (reduced motion) is the transition state
	const reacting = $derived.by(() => {
		// 0–0.3 approach, 0.3–0.5 into the transition state, 0.5–0.8 apart, then fade.
		const appr = smoothstep(0, 0.3, v);
		const ts = smoothstep(0.3, 0.5, v);
		const apart = smoothstep(0.5, 0.85, v);
		const fade = 1 - smoothstep(0.88, 1, v);
		const fadeIn = smoothstep(0, 0.06, v);
		const dx = lerp(170, 26, appr);
		// Atom positions: H's on the left, I's on the right (vertical molecules).
		const hY = lerp(3.5 * S, 12 * S, ts) + apart * 110;
		const iY = lerp(7 * S, 14 * S, ts) + apart * 110;
		const half = dx * (1 - ts) + 22 * ts - 4.5 * apart;
		const hX = C.x - half;
		const iX = C.x + half;
		return {
			o: fade * fadeIn,
			ts,
			apart,
			list: [
				[hX, C.y - hY, 5 * S, false],
				[hX, C.y + hY, 5 * S, false],
				[iX, C.y - iY, 9 * S, true],
				[iX, C.y + iY, 9 * S, true]
			] as [number, number, number, boolean][]
		};
	});

	const drawn = $derived(react ? reacting.list : bounce.list);
	const paths = $derived.by(() => {
		let h = '';
		let i = '';
		for (const [x, y, r, isI] of drawn) {
			if (isI) i += circ(x, y, r);
			else h += circ(x, y, r);
		}
		return { h, i };
	});
	/** Bonds of the reacting four: old ones fade out, new ones in. */
	const bonds = $derived.by(() => {
		if (!react) return [];
		const [h1, h2, i1, i2] = reacting.list;
		const oldO = 1 - smoothstep(0.42, 0.56, v);
		const newO = smoothstep(0.38, 0.52, v);
		return [
			{ a: h1, b: h2, o: oldO, dash: reacting.ts > 0.3 },
			{ a: i1, b: i2, o: oldO, dash: reacting.ts > 0.3 },
			{ a: h1, b: i1, o: newO, dash: reacting.apart < 0.2 },
			{ a: h2, b: i2, o: newO, dash: reacting.apart < 0.2 }
		];
	});

	// ---- the marker on the profile -----------------------------------------------
	const marker = $derived.by(() => {
		if (react) {
			const pu = 0.08 + 0.84 * smoothstep(0.15, 0.85, v);
			return { u: pu, glow: true };
		}
		const e = energyOf(n);
		const k = u < 0.4 ? 0 : u < 0.5 ? (u - 0.4) / 0.1 : u < 0.6 ? 1 - (u - 0.5) / 0.1 : 0;
		return { u: lerp(0.12, climbTo(e, EA), k), height: e * k };
	});

	// ---- meter -------------------------------------------------------------------
	const MX = 420;
	const MY0 = 470;
	const MY1 = 110;
	const my = (e: number) => MY0 - (Math.min(e, 200) / 200) * (MY0 - MY1);
	const share = fmtPow(1 / fractionAbove(EA_F, T));
</script>

<g style:font-variant-numeric="tabular-nums">
	<Readout id="title" order={1} label="In the flask" value="H₂ + I₂ at 700 K (427 °C)">
		<text x={28} y={44} style:font-size="16px" font-weight="600">H₂ + I₂ at 700 K (427 °C)</text>
	</Readout>
	<Readout id="sub">
		<Label
			x={28}
			y={68}
			text={react
				? 'one of the rare collisions that react'
				: 'close-up of one H₂ and one I₂, over and over'}
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- the collision -->
	<g opacity={react ? reacting.o : 1}>
		{#each bonds as b, k (k)}
			<line
				x1={b.a[0]}
				y1={b.a[1]}
				x2={b.b[0]}
				y2={b.b[1]}
				stroke="var(--stage-ink)"
				stroke-width="3"
				stroke-dasharray={b.dash ? '4 4' : 'none'}
				opacity={b.o * 0.7}
			/>
		{/each}
		<path d={paths.i} fill={ATOM.i} stroke={ATOM.iEdge} stroke-width="1.5" />
		<path d={paths.h} fill={ATOM.h} stroke={ATOM.hEdge} stroke-width="1.5" />
		{#if !react && u > 0.47 && u < 0.6}
			<circle
				cx={C.x + 10}
				cy={C.y}
				r={18 + 120 * (u - 0.47)}
				fill="none"
				stroke="var(--stage-ink-muted)"
				opacity={1 - (u - 0.47) / 0.13}
			/>
		{/if}
		{#if react && v > 0.4 && v < 0.6}
			<Label
				x={C.x}
				y={C.y + 110}
				text="transition state"
				size={12}
				pill
				opacity={smoothstep(0.4, 0.45, v) * (1 - smoothstep(0.55, 0.6, v))}
			/>
		{/if}
	</g>
	<Readout id="names">
		{#if !react}
			<Label x={bounce.h.x} y={bounce.h.y + 44} text="H₂" size={13} />
			<Label x={bounce.i.x} y={bounce.i.y + 74} text="I₂" size={13} />
		{:else if v < 0.32}
			<Label x={C.x - 150} y={C.y + 70} text="H₂" size={13} opacity={reacting.o} />
			<Label x={C.x + 150} y={C.y + 70} text="I₂" size={13} opacity={reacting.o} />
		{:else if v > 0.62}
			<Label
				x={C.x + 70}
				y={C.y - 50 - 110 * reacting.apart}
				text="HI"
				size={13}
				opacity={reacting.o}
			/>
			<Label
				x={C.x + 70}
				y={C.y + 62 + 110 * reacting.apart}
				text="HI"
				size={13}
				opacity={reacting.o}
			/>
		{/if}
	</Readout>

	<!-- the energy meter -->
	<rect
		x={MX - 12}
		y={MY1}
		width="24"
		height={MY0 - MY1}
		rx="6"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<rect
		x={MX - 8}
		y={my(shown)}
		width="16"
		height={Math.max(0, MY0 - my(shown) - 2)}
		rx="3"
		fill="var(--rr-forward)"
	/>
	<line
		x1={MX - 20}
		x2={MX + 20}
		y1={my(EA)}
		y2={my(EA)}
		stroke="var(--rr-barrier)"
		stroke-width="2"
	/>
	<Readout
		id="needed"
		order={3}
		label="Needed to react"
		value="{Math.round(EA)} kJ/mol"
		color="var(--rr-barrier)"
	>
		<Label
			x={MX - 22}
			y={my(EA) + 4}
			text="needed {Math.round(EA)}"
			size={12}
			anchor="end"
			color="var(--rr-barrier)"
		/>
	</Readout>
	<Readout
		id="this"
		order={2}
		label={react ? 'This rare collision' : 'This collision brought'}
		value="{shown.toFixed(react ? 0 : 1)} kJ/mol"
	>
		<Label
			x={MX}
			y={MY0 + 22}
			text="{shown.toFixed(react ? 0 : 1)} kJ/mol"
			size={13}
			weight={600}
		/>
		<Label x={MX} y={MY0 + 40} text="collision energy" size={11} muted />
	</Readout>
	<Readout
		id="count"
		order={4}
		label={react ? 'How rare' : 'Collisions · reactions'}
		value={react ? `1 collision in ${share}` : `${collisions} · 0`}
	>
		{#if react}
			<Label
				x={28}
				y={560}
				text="skipping ahead: at 700 K, 1 collision in {share} is like this one"
				size={13}
				anchor="start"
			/>
		{:else}
			<Label
				x={28}
				y={560}
				text="collisions: {collisions}   reactions: 0"
				size={13}
				anchor="start"
			/>
		{/if}
	</Readout>

	<Profile x={490} y={60} w={446} h={440} ea={EA} {dh} band={RT} {marker} id="collide-profile" />
	<Readout id="rt">
		<Label
			x={713}
			y={530}
			text="shaded: a typical collision, RT ≈ {RT.toFixed(1)} kJ/mol"
			size={12}
			muted
		/>
	</Readout>
</g>
