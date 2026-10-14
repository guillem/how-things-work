<script lang="ts">
	/**
	 * Out of 200 acid molecules, how many have given their H⁺ away?
	 *
	 * The share is the model's degree of dissociation at the chosen concentration
	 * (`dissociated`, from the exact charge balance): all of them for HCl, about 1 in
	 * 75 for 0.1 mol/L acetic acid. HCl splits in the first seconds of the step and
	 * stays split. For acetic acid the split molecules change all the time (each
	 * "slot" splits one molecule for a few seconds, then it re-forms and another one
	 * splits) while their number stays the same: an equilibrium.
	 *
	 * Molecules are drawn as a handful of <path>s (one per colour) to keep the node
	 * count small; H⁺ ions are pink dots that drift off their molecule.
	 */
	import { Label, cycle, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ACIDS, acidPH, dissociated, type AcidId } from '../model';
	import { rng } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const acidId = $derived(
		String(step.hints?.acid ?? params.acidD ?? 'acetic') === 'hcl' ? 'hcl' : ('acetic' as AcidId)
	);
	const acid = $derived(ACIDS[acidId]);
	const c = $derived(step.hints?.acid ? 0.1 : Number(params.conc ?? 0.1));
	const share = $derived(dissociated(acid, c));
	const ph = $derived(acidPH(acid, c));
	const strong = $derived(acid.pKa === null);

	const COLS = 20;
	const ROWS = 10;
	const N = COLS * ROWS;
	const GX = 44;
	const GY = 140;
	const DX = 28;
	const DY = 40;
	const nSplit = $derived(Math.round(N * share));

	// Each molecule: anion at (x, y), its H to the right; a split H drifts off.
	const mols = Array.from({ length: N }, (_, i) => {
		const r = rng(500 + i);
		return {
			x: GX + (i % COLS) * DX + (Math.floor(i / COLS) % 2) * (DX / 2),
			y: GY + Math.floor(i / COLS) * DY,
			a: -Math.PI / 2 + (r() - 0.5) * 2.4,
			w: 0.5 + r(),
			p: r() * 6.28
		};
	});

	// Progress of each molecule's split, 0 (whole) … 1 (H⁺ away).
	const LIFE = 5;
	const split = $derived.by(() => {
		const s = new Float32Array(N);
		if (strong) {
			for (let i = 0; i < N; i++) {
				const start = 0.3 + (i % 37) * 0.04 + Math.floor(i / 37) * 0.05;
				s[i] = reduced ? 1 : smoothstep(start, start + 0.6, t);
			}
			return s;
		}
		// Slot j only uses molecules j, j + nSplit, j + 2·nSplit…, so no two slots share one,
		// and it cross-fades from one molecule to the next: always exactly nSplit split.
		const group = Math.floor(N / Math.max(1, nSplit));
		const pick = (j: number, life: number) =>
			j + nSplit * Math.floor(rng(7000 + j * 131 + life * 7919)() * group);
		for (let j = 0; j < nSplit; j++) {
			const off = (j * 0.618034) % 1;
			const life = Math.floor(t / LIFE + off);
			// `cycle`'s offset is in periods, so the phase wraps exactly when `life` ticks.
			const u = reduced ? 0.5 : cycle(t, LIFE, off);
			const out = smoothstep(0.85, 1, u);
			const a = pick(j, life);
			const b = pick(j, life + 1);
			s[a] = Math.max(s[a], 1 - out);
			s[b] = Math.max(s[b], out);
		}
		return s;
	});

	const R_A = 8;
	const R_H = 4.5;
	const circ = (x: number, y: number, r: number) =>
		`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
	const paths = $derived.by(() => {
		let anion = '';
		let ion = '';
		let h = '';
		let hplus = '';
		let bond = '';
		let minus = '';
		for (let i = 0; i < N; i++) {
			const m = mols[i];
			const u = split[i];
			const jx = reduced ? 0 : 1.5 * Math.sin(t * m.w * 2 + m.p);
			const jy = reduced ? 0 : 1.5 * Math.cos(t * m.w * 1.6 + m.p);
			const x = m.x + jx;
			const y = m.y + jy;
			const bx = Math.cos(m.a);
			const by = Math.sin(m.a);
			const d = lerp(R_A + 2, R_A + 15, u);
			const hx = x + bx * d;
			const hy = y + by * d;
			if (u > 0.5) {
				ion += circ(x, y, R_A);
				minus += `M${(x - 3.5).toFixed(1)} ${y.toFixed(1)}h7`;
				hplus += circ(hx, hy, R_H);
			} else {
				anion += circ(x, y, R_A);
				h += circ(hx, hy, R_H);
				bond += `M${(x + bx * R_A * 0.6).toFixed(1)} ${(y + by * R_A * 0.6).toFixed(1)}L${hx.toFixed(1)} ${hy.toFixed(1)}`;
			}
		}
		return { anion, ion, h, hplus, bond, minus };
	});
	const aColor = $derived(strong ? 'var(--ab-weaker)' : 'var(--carbon)');

	const shareText = $derived(
		strong
			? 'all of them'
			: nSplit === 0
				? `${(share * N).toFixed(1)} on average`
				: `${nSplit} (${(share * 100).toFixed(share < 0.1 ? 1 : 0)} %)`
	);
	const cText = $derived(`${c} mol/L`);
	const PX = 640;
</script>

<g style:font-variant-numeric="tabular-nums">
	<Readout id="what" order={1} label="In the flask" value="{acid.name}, {cText}">
		<text x={GX - 10} y={52} font-size="16" font-weight="600"
			>{acid.name}<tspan dx="10" font-size="13" font-weight="400" class="muted"
				>{cText} in water</tspan
			></text
		>
	</Readout>
	<Readout id="out-of" order={9}>
		<Label x={GX - 10} y={76} text="200 of its molecules" size={12} anchor="start" muted />
	</Readout>

	<path d={paths.bond} stroke="var(--stage-line)" stroke-width="2" fill="none" />
	<path d={paths.anion} fill={aColor} stroke="var(--stage-ink)" stroke-opacity="0.25" />
	<path d={paths.h} fill="var(--surface)" stroke="var(--stage-ink-muted)" stroke-width="1" />
	<path d={paths.ion} fill={aColor} stroke="var(--stage-ink)" stroke-width="1.6" />
	<path d={paths.minus} stroke="var(--stage-bg)" stroke-width="1.8" />
	<path d={paths.hplus} fill="var(--ab-h)" />

	<!-- the panel (its contents move under the stage on phones) -->
	<Readout id="panel">
		<rect
			x={PX}
			y={92}
			width={296}
			height={360}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="eq"
		order={2}
		label="Reaction"
		value={strong ? 'HCl → H⁺ + Cl⁻' : 'CH₃COOH ⇌ H⁺ + CH₃COO⁻'}
	>
		<text x={PX + 20} y={126} font-size="15" font-weight="600"
			>{strong ? 'HCl → H⁺ + Cl⁻' : 'CH₃COOH ⇌ H⁺ + CH₃COO⁻'}</text
		>
		<text x={PX + 20} y={146} font-size="11" class="muted"
			>{strong ? 'one way: every molecule splits' : 'both ways: splitting and re-forming'}</text
		>
	</Readout>
	<Readout id="split" order={3} label="Molecules split" value={shareText} color="var(--ab-h)">
		<text x={PX + 20} y={190} font-size="12" class="muted">molecules that gave away H⁺</text>
		<text x={PX + 20} y={216} font-size="22" font-weight="600" style:fill="var(--ab-h)"
			>{shareText}</text
		>
	</Readout>
	<Readout id="ph" order={4} label="pH" value={ph.toFixed(2)}>
		<text x={PX + 20} y={258} font-size="12" class="muted">pH of the solution</text>
		<text x={PX + 20} y={286} font-size="22" font-weight="600">{ph.toFixed(2)}</text>
	</Readout>

	<!-- key -->
	<Readout id="key-whole" order={10} label="whole molecule {acid.formula}" color={aColor}>
		<circle cx={PX + 28} cy={330} r={R_A} fill={aColor} />
		<line x1={PX + 34} y1={325} x2={PX + 42} y2={318} stroke="var(--stage-line)" stroke-width="2" />
		<circle cx={PX + 44} cy={316} r={R_H} fill="var(--surface)" stroke="var(--stage-ink-muted)" />
		<text x={PX + 62} y={334} font-size="12">whole molecule, {acid.formula}</text>
	</Readout>
	<Readout id="key-anion" order={11} label="{acid.anion} ion" color={aColor}>
		<circle
			cx={PX + 28}
			cy={366}
			r={R_A}
			fill={aColor}
			stroke="var(--stage-ink)"
			stroke-width="1.6"
		/>
		<line
			x1={PX + 24.5}
			y1={366}
			x2={PX + 31.5}
			y2={366}
			stroke="var(--stage-bg)"
			stroke-width="1.8"
		/>
		<text x={PX + 62} y={370} font-size="12">{acid.anion} ion, left behind</text>
	</Readout>
	<Readout id="key-h" order={12} label="H⁺ ion (on a water molecule)" color="var(--ab-h)">
		<circle cx={PX + 28} cy={400} r={R_H} fill="var(--ab-h)" />
		<text x={PX + 62} y={404} font-size="12">H⁺ ion (really H₃O⁺)</text>
	</Readout>
	<Readout id="note">
		<Label
			x={PX + 20}
			y={436}
			text={strong ? 'strong acid: lets go of every H⁺' : 'weak acid: most molecules stay whole'}
			size={12}
			weight={600}
			anchor="start"
		/>
	</Readout>
</g>
