<script lang="ts">
	/**
	 * The measured β-globin chain in 3D (PDB 2DN2, chain B), one point per amino acid,
	 * turning slowly; drag or use the arrow keys to turn it.
	 *
	 * `step.hints.colour`:
	 *   ss   — the chain as a tube coloured by secondary structure (helix / other), with
	 *          the haem in its pocket
	 *   kind — every amino acid as a bead coloured by its side chain (the genetic-code
	 *          table's colours); `params.show` keeps only the buried ones or only the ones on
	 *          the surface, and the readout counts how many of each kind are buried
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import Label from './Text.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BURIED, buriedShare, kindOf, proteinById, runs } from '../folding';
	import { pieces, projector, Turntable } from './view3d.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const P = proteinById('globin');
	const RUNS = runs(P.exp);
	const CX = 340;
	const CY = 300;
	const SCALE = 10.5; // px per Å

	const mode = $derived(String(step.hints?.colour ?? 'ss'));
	const show = $derived(String(params.show ?? 'all'));

	// at t ≈ 2.5 s (the reduced-motion frame) the haem's flat ring faces the viewer
	const view = new Turntable(0.12, 0.2, -0.55);
	const yaw = $derived(view.yaw(t, reduced));
	const project = $derived(projector(yaw, view.pitch, SCALE, CX, CY));
	const proj = $derived(P.exp.map((v) => (v ? project(v) : null)));

	// cross-fade between the tube (ss) and the beads (kind)
	const beadsIn = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const k = mode === 'kind' ? 1 : 0;
		untrack(() => beadsIn.set(k, { duration: reduced ? 0 : 700 }));
	});
	const fb = $derived(beadsIn.current);

	const SS_COLOR: Record<string, string> = {
		H: 'var(--pf-helix)',
		E: 'var(--pf-strand)',
		'-': 'var(--pf-coil)'
	};
	const tube = $derived(pieces(proj, RUNS, (i) => SS_COLOR[P.ss[i]] ?? SS_COLOR['-'], 3));

	const zs = $derived(proj.flatMap((p) => (p ? [p.z] : [])));
	const zMin = $derived(Math.min(...zs));
	const zMax = $derived(Math.max(...zs));
	const near = (z: number) => (z - zMin) / Math.max(1, zMax - zMin);

	// ---- haem: the porphyrin ring (four bridging carbons) and its iron ----------------------
	const haem = $derived.by(() => {
		if (!P.haem) return null;
		const pts = P.haem.map((v) => project(v));
		const ring = pts.slice(5, 9);
		return {
			fe: pts[0],
			d: ring.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z',
			z: pts[0].z
		};
	});
	const behind = $derived(tube.filter((p) => !haem || p.z < haem.z));
	const front = $derived(tube.filter((p) => haem && p.z >= haem.z));

	// ---- beads ------------------------------------------------------------------------------
	const KIND_COLOR: Record<string, string> = {
		nonpolar: 'var(--dp-nonpolar)',
		polar: 'var(--dp-polar)',
		positive: 'var(--dp-positive)',
		negative: 'var(--dp-negative)'
	};
	const beads = $derived(
		proj
			.flatMap((p, i) => {
				if (!p) return [];
				const buried = (P.rsa[i] ?? 1) < BURIED;
				const shown = show === 'all' || (show === 'buried') === buried;
				return [{ i, ...p, color: KIND_COLOR[kindOf(P.sequence[i])], shown }];
			})
			.sort((a, b) => a.z - b.z)
	);
	const SICKLE = 6; // Glu7 (β6)

	const share = (kinds: Parameters<typeof buriedShare>[1]) => {
		const s = buriedShare(P, kinds);
		return `${s.buried} of ${s.of} buried (${Math.round((100 * s.buried) / s.of)}%)`;
	};
	const LEGEND = [
		{ id: 'nonpolar', label: 'Water-repelling', kinds: ['nonpolar'] as const, color: 'nonpolar' },
		{ id: 'polar', label: 'Water-loving', kinds: ['polar'] as const, color: 'polar' },
		{
			id: 'charged',
			label: 'Charged (+ / −)',
			kinds: ['positive', 'negative'] as const,
			color: 'positive'
		}
	].map((l) => ({ ...l, value: share([...l.kinds]) }));
	const shownCount = $derived(beads.filter((b) => b.shown).length);

	const sickle = $derived(proj[SICKLE]);
</script>

<g>
	<!-- drag / keyboard target for turning the chain -->
	<rect
		class="turn"
		x={CX - 300}
		y={40}
		width="600"
		height="520"
		rx="16"
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Turn the protein: drag, or use the arrow keys"
		aria-valuemin={0}
		aria-valuemax={359}
		aria-valuenow={view.degrees(t, reduced)}
		onpointerdown={(e) => view.drag(e)}
		onkeydown={(e) => view.key(e)}
		onpointerenter={() => view.hold(t)}
		onpointerleave={() => view.release(t)}
	/>

	<g style:pointer-events="none">
		<!-- the tube (ss), fading to a thin guide line under the beads (kind) -->
		{#each behind as p (p.key)}
			<path
				d={p.d}
				fill="none"
				stroke={fb > 0.5 ? 'var(--pf-coil)' : p.color}
				stroke-width={(1 - fb) * (5 + 3 * near(p.z)) + fb * 2}
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={(0.45 + 0.55 * near(p.z)) * (1 - 0.55 * fb)}
			/>
		{/each}
		{#if haem && fb < 0.99}
			<g opacity={1 - fb}>
				<path
					d={haem.d}
					fill="var(--pf-haem)"
					fill-opacity="0.55"
					stroke="var(--pf-haem)"
					stroke-width="2"
					stroke-linejoin="round"
				/>
				<circle cx={haem.fe.x} cy={haem.fe.y} r="5" fill="#e8590c" stroke="#7a2e00" />
			</g>
		{/if}
		{#each front as p (p.key)}
			<path
				d={p.d}
				fill="none"
				stroke={fb > 0.5 ? 'var(--pf-coil)' : p.color}
				stroke-width={(1 - fb) * (5 + 3 * near(p.z)) + fb * 2}
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={(0.45 + 0.55 * near(p.z)) * (1 - 0.55 * fb)}
			/>
		{/each}

		{#if fb > 0.01}
			<g opacity={fb}>
				{#each beads as b (b.i)}
					<circle
						cx={b.x}
						cy={b.y}
						r={5 + 2.5 * near(b.z)}
						fill={b.color}
						stroke="var(--stage-ink)"
						stroke-width="0.7"
						stroke-opacity="0.5"
						opacity={b.shown ? 1 : 0.08}
					/>
				{/each}
				{#if sickle}
					<circle
						cx={sickle.x}
						cy={sickle.y}
						r="12"
						fill="none"
						stroke="var(--stage-ink)"
						stroke-width="1.5"
						opacity={show === 'buried' ? 0.3 : 1}
					/>
				{/if}
			</g>
		{/if}
	</g>

	<!-- captions -->
	<Readout id="title" order={1} label="β-globin" value="as measured: PDB 2DN2, X-ray, 1.25 Å">
		<Label x={680} y={64} text="β-globin, as measured" size={16} weight={600} anchor="start" />
		<Label x={680} y={86} text="PDB 2DN2 · X-ray · 1.25 Å" size={12} anchor="start" muted />
		<Label
			x={680}
			y={104}
			text={mode === 'kind' ? 'one dot per amino acid' : 'a line through its 146 amino acids'}
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	{#if fb < 0.5}
		<g opacity={1 - 2 * fb}>
			<Readout id="helix" order={2} label="α-helix" color="var(--pf-helix)">
				<line x1="680" x2="708" y1="150" y2="150" stroke="var(--pf-helix)" stroke-width="7" stroke-linecap="round" />
				<Label x={720} y={155} text="α-helix" anchor="start" />
			</Readout>
			<Readout id="coil" order={3} label="Loop" color="var(--pf-coil)">
				<line x1="680" x2="708" y1="180" y2="180" stroke="var(--pf-coil)" stroke-width="7" stroke-linecap="round" />
				<Label x={720} y={185} text="loop between helices" anchor="start" />
			</Readout>
			<Readout id="haem" order={4} label="Haem" value="its iron atom binds oxygen" color="var(--pf-haem)">
				<rect x="682" y="200" width="24" height="18" rx="3" fill="var(--pf-haem)" fill-opacity="0.55" stroke="var(--pf-haem)" />
				<circle cx="694" cy="209" r="4" fill="#e8590c" stroke="#7a2e00" />
				<Label x={720} y={214} text="haem: its iron binds O₂" anchor="start" />
			</Readout>
			<Readout id="hint" order={9}>
				<Label x={680} y={540} text="drag to turn" size={12} anchor="start" muted />
			</Readout>
		</g>
	{:else}
		<g opacity={2 * fb - 1}>
			{#each LEGEND as l, k (l.id)}
				<Readout id="kind-{l.id}" order={2 + k} label={l.label} value={l.value} color={KIND_COLOR[l.color]}>
					<circle cx="690" cy={154 + k * 46} r="7" fill={KIND_COLOR[l.color]} stroke="var(--stage-ink)" stroke-opacity="0.5" stroke-width="0.7" />
					{#if l.id === 'charged'}
						<circle cx="706" cy={154 + k * 46} r="7" fill="var(--dp-negative)" stroke="var(--stage-ink)" stroke-opacity="0.5" stroke-width="0.7" />
					{/if}
					<Label x={722} y={158 + k * 46} text={l.label} anchor="start" weight={600} />
					<Label x={722} y={176 + k * 46} text={l.value} size={12} anchor="start" muted />
				</Readout>
			{/each}
			<Readout
				id="showing"
				order={6}
				label="Showing"
				value={show === 'all' ? `all ${shownCount}` : show === 'buried' ? `${shownCount} buried` : `${shownCount} on the surface`}
			>
				<Label
					x={680}
					y={310}
					text={show === 'all'
						? `all ${shownCount} amino acids`
						: show === 'buried'
							? `${shownCount} buried amino acids`
							: `${shownCount} on the surface`}
					size={14}
					anchor="start"
					weight={600}
				/>
			</Readout>
			<Readout id="sickle" order={7} label="Ringed" value="Glu β6: valine in sickle cell, on the surface">
				<circle cx="690" cy="354" r="9" fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
				<Label x={708} y={350} text="β6 glutamic acid, on the surface:" size={12} anchor="start" />
				<Label x={708} y={366} text="valine in sickle-cell disease" size={12} anchor="start" muted />
			</Readout>
		</g>
	{/if}
</g>

<style>
	.turn {
		cursor: grab;
		outline: none;
	}
	.turn:focus-visible {
		stroke: var(--explainer-accent, var(--accent));
		stroke-width: 2;
	}
</style>
