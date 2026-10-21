<script lang="ts">
	/**
	 * The ear cut open, seen from behind: ear flap, ear canal, eardrum, the three bones in the air
	 * of the middle ear, and the inner ear in its bone (the balance loops, and the cochlea coiled
	 * two and a half turns, with its nerve to the brain).
	 *
	 * Focus 'ear': a note's arcs run down the canal and the eardrum, bones and stirrup shake with
	 * it (slowed right down, faster for a higher note); the spot of the cochlea where the note
	 * peaks (the cochlea-hearing model's place) glows. Focus 'window': zoomed on the middle ear,
	 * with what pushes on the oval window (`params.middle`): the real eardrum and bones, an eardrum
	 * shrunk to the window's size, or nothing (the air on the window, most of the sound bouncing
	 * off), and a bar comparing the push on each bit of the window with the air's push on the
	 * eardrum (the model's ratios).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, TAU, clamp, cycle, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		LENGTH_MM,
		SOFT,
		gainDb,
		loudnessName,
		peakCm,
		pitchHz,
		respond,
		shakes,
		soundsLike,
		windowPush,
		type MiddleEar
	} from '../model';
	import HearButton from './HearButton.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'ear'));
	const octaves = $derived(Number(params.pitch ?? 5));
	const f = $derived(pitchHz(octaves));
	const middle: MiddleEar = $derived(
		focus === 'window' ? ((params.middle as MiddleEar | undefined) ?? 'ear') : 'ear'
	);
	const push = $derived(windowPush(middle));
	/** Thickness of the push arrow on the window (grows with the push, on a squeezed scale). */
	const w = $derived(1.5 + 0.9 * Math.log2(push));

	// ---- zoom onto the middle ear on the window step ------------------------------------------
	const zoomTarget = $derived(focus === 'window' ? 1 : 0);
	const zoomTw = new Tween(
		untrack(() => zoomTarget),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const z = zoomTarget;
		untrack(() => void zoomTw.set(z, reduced ? { duration: 0 } : undefined));
	});
	const zoom = $derived(reduced ? zoomTarget : zoomTw.current);
	const ZC = { x: 488, y: 268 };
	const ZTO = { x: 330, y: 300 };
	const zs = $derived(1 + 1.1 * zoom);
	const zx = (x: number) => lerp(ZC.x, ZTO.x, zoom) + (x - ZC.x) * zs;
	const zy = (y: number) => lerp(ZC.y, ZTO.y, zoom) + (y - ZC.y) * zs;

	// ---- the middle-ear choice: an eardrum shrunk to the window's size, or none at all ----------
	const drumHalfTarget = $derived(middle === 'small' ? 16 : 54);
	const drumHalf = Tween.of(() => drumHalfTarget, { duration: 700, easing: cubicInOut });
	const half = $derived(reduced ? drumHalfTarget : drumHalf.current);
	const goneTarget = $derived(middle === 'none' ? 1 : 0);
	const goneTw = Tween.of(() => goneTarget, { duration: 700, easing: cubicInOut });
	const gone = $derived(reduced ? goneTarget : goneTw.current);

	// ---- the shake, slowed right down: a higher note shakes faster -------------------------------
	/** Shakes a second as drawn. */
	const rate = $derived(0.4 + 0.22 * octaves);
	const phase = $derived(reduced ? 0.3 : cycle(t, 1 / rate));
	const s = $derived(Math.sin(TAU * phase));
	/** Eardrum's centre in and out, px. */
	const d = $derived(6 * s);

	// Sound arcs running down the canal, one per shake.
	const spacing = $derived(120 - 7 * octaves);
	const ARC_FROM = 40;
	const arcEnd = $derived(lerp(414, 548, gone));
	const arcs = $derived.by(() => {
		const out: { k: number; x: number; o: number }[] = [];
		const n = Math.ceil((arcEnd - ARC_FROM) / spacing) + 1;
		for (let k = 0; k < n; k++) {
			const x = ARC_FROM + (k + phase) * spacing;
			if (x > arcEnd) continue;
			const u = (x - ARC_FROM) / (arcEnd - ARC_FROM);
			out.push({ k, x, o: smoothstep(0, 0.12, u) * (1 - smoothstep(0.9, 1, u)) });
		}
		return out;
	});
	// With nothing in the way, most of the sound bounces back off the window's fluid.
	const echoes = $derived.by(() => {
		if (gone < 0.05) return [];
		const out: { k: number; x: number; o: number }[] = [];
		const n = Math.ceil((arcEnd - 300) / spacing) + 1;
		for (let k = 0; k < n; k++) {
			const x = arcEnd - (k + phase) * spacing;
			if (x < 300) continue;
			const u = (arcEnd - x) / (arcEnd - 300);
			out.push({ k, x, o: gone * smoothstep(0, 0.12, u) * (1 - smoothstep(0.7, 1, u)) });
		}
		return out;
	});
	const arcHalf = (x: number) => (x < 420 ? 26 + (x - 120) * -0.01 : 30);

	// ---- the cochlea: a spiral of two and a half turns, tube narrowing to the tip ----------------
	const CC = { x: 724, y: 330 };
	const R0 = 80;
	const R1 = 22;
	const TURNS = 2.5;
	const A0 = Math.PI + 0.46;
	const K = Math.log(R0 / R1) / (TURNS * TAU);
	const SEGS = 64;
	const spiral = Array.from({ length: SEGS + 1 }, (_, i) => {
		const th = (i / SEGS) * TURNS * TAU;
		const r = R0 * Math.exp(-K * th);
		return { x: CC.x + r * Math.cos(A0 + th), y: CC.y + r * Math.sin(A0 + th), r };
	});
	const spiralLen: number[] = [0];
	for (let i = 1; i <= SEGS; i++)
		spiralLen.push(
			spiralLen[i - 1] + Math.hypot(spiral[i].x - spiral[i - 1].x, spiral[i].y - spiral[i - 1].y)
		);
	const segs = spiral.slice(1).map((p, i) => ({ i, a: spiral[i], b: p, w: 0.36 * p.r }));
	/** The point of the spiral a fraction `u` of its length from the entrance. */
	function onSpiral(u: number) {
		const L = clamp(u) * spiralLen[SEGS];
		let i = 1;
		while (i < SEGS && spiralLen[i] < L) i++;
		const v = (L - spiralLen[i - 1]) / (spiralLen[i] - spiralLen[i - 1] || 1);
		return { x: lerp(spiral[i - 1].x, spiral[i].x, v), y: lerp(spiral[i - 1].y, spiral[i].y, v) };
	}
	const noteAt = $derived(onSpiral((peakCm(respond(f, SOFT)) * 10) / LENGTH_MM));
	const glow = $derived(reduced ? 0.8 : 0.55 + 0.45 * Math.abs(s));

	// ---- bones: rock with the eardrum -----------------------------------------------------------
	const bone = $derived(d * (1 - gone));
	const footX = $derived(556 + 0.45 * bone);

	// ---- headline -------------------------------------------------------------------------------
	const headline = $derived.by(() => {
		if (focus !== 'window') return `A note shaking ${shakes(f)}`;
		if (middle === 'ear') return `The window is pushed about ${Math.round(push)} times harder`;
		if (middle === 'small') return 'The window is pushed only a third harder';
		return 'Most of the sound bounces off the fluid';
	});
	const sub = $derived.by(() => {
		if (focus !== 'window') return `It sounds ${soundsLike(f)}`;
		const like = loudnessName(60 - gainDb(windowPush('ear')) + gainDb(push));
		if (middle === 'ear') return 'than the air pushes on the eardrum: a big drum on a small window';
		return `people talking would push on the window like ${like} does`;
	});

	const o = $derived({
		earLabels: 1 - zoom,
		zoomLabels: zoom,
		bones: 1 - gone
	});
	const barMax = 230;
	const barUnit = barMax / windowPush('ear');
</script>

<g class="he-ear">
	<g transform="translate({zx(0)} {zy(0)}) scale({zs})">
		<!-- head -->
		<rect x="140" y="30" width="900" height="560" rx="40" fill="var(--he-tissue)" />
		<!-- inner-ear bone -->
		<rect
			x="560"
			y="112"
			width="290"
			height="360"
			rx="60"
			fill="var(--he-bone)"
			stroke="var(--he-bone-edge)"
		/>
		<!-- ear flap -->
		<path
			d="M150 138 C 96 96 40 150 52 236 C 58 276 92 274 124 268 L 124 332 C 92 330 66 344 70 400 C 76 452 124 470 150 456 Z"
			fill="var(--he-skin)"
			stroke="var(--he-skin-edge)"
			stroke-width="1.5"
		/>
		<!-- ear canal -->
		<path
			d="M118 268 C 220 258 300 266 422 246 L 422 354 C 300 336 220 344 118 332 Z"
			fill="var(--stage-bg)"
			stroke="var(--he-skin-edge)"
			stroke-width="1.5"
		/>
		<!-- middle ear: a small room of air -->
		<rect
			x="420"
			y="172"
			width="140"
			height="236"
			rx="28"
			fill="var(--stage-bg)"
			stroke="var(--he-skin-edge)"
			stroke-width="1.5"
		/>
		<rect x="414" y="250" width="12" height="100" fill="var(--stage-bg)" />

		<!-- the note's arcs -->
		{#each arcs as a (a.k)}
			{@const h = arcHalf(a.x)}
			<path
				d="M{a.x} {300 - h} Q {a.x + 16} 300 {a.x} {300 + h}"
				fill="none"
				stroke="var(--he-air)"
				stroke-width="3"
				stroke-linecap="round"
				opacity={a.o}
			/>
		{/each}
		{#each echoes as a (a.k)}
			<path
				d="M{a.x} 270 Q {a.x - 16} 300 {a.x} 330"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="2.5"
				stroke-dasharray="5 4"
				stroke-linecap="round"
				opacity={a.o}
			/>
		{/each}

		<!-- balance loops (dimmed) -->
		<g opacity="0.5" fill="none" stroke="var(--he-fluid-edge)" stroke-width="11">
			<circle cx="618" cy="176" r="36" />
			<ellipse cx="660" cy="196" rx="34" ry="22" />
			<ellipse cx="584" cy="196" rx="16" ry="34" />
		</g>
		<g opacity="0.5" fill="none" stroke="var(--he-fluid)" stroke-width="7">
			<circle cx="618" cy="176" r="36" />
			<ellipse cx="660" cy="196" rx="34" ry="22" />
			<ellipse cx="584" cy="196" rx="16" ry="34" />
		</g>

		<!-- vestibule and the cochlea's coiled tube -->
		<line
			x1="604"
			y1="270"
			x2={spiral[0].x}
			y2={spiral[0].y}
			stroke="var(--he-fluid-edge)"
			stroke-width="32"
			stroke-linecap="round"
		/>
		<ellipse cx="600" cy="268" rx="38" ry="30" fill="var(--he-fluid-edge)" />
		{#each segs as g (g.i)}
			<line
				x1={g.a.x}
				y1={g.a.y}
				x2={g.b.x}
				y2={g.b.y}
				stroke="var(--he-fluid-edge)"
				stroke-width={g.w + 4}
				stroke-linecap="round"
			/>
		{/each}
		<line
			x1="604"
			y1="270"
			x2={spiral[0].x}
			y2={spiral[0].y}
			stroke="var(--he-fluid)"
			stroke-width="27"
			stroke-linecap="round"
		/>
		<ellipse cx="600" cy="268" rx="35" ry="27" fill="var(--he-fluid)" />
		{#each segs as g (g.i)}
			<line
				x1={g.a.x}
				y1={g.a.y}
				x2={g.b.x}
				y2={g.b.y}
				stroke="var(--he-fluid)"
				stroke-width={g.w}
				stroke-linecap="round"
			/>
		{/each}
		<!-- where the note peaks inside the cochlea -->
		{#if focus === 'ear'}
			<circle
				cx={noteAt.x}
				cy={noteAt.y}
				r="13"
				fill="var(--he-accent)"
				opacity={glow * 0.35}
				filter="url(#glow)"
			/>
			<circle cx={noteAt.x} cy={noteAt.y} r="6" fill="var(--he-accent)" opacity={glow} />
		{/if}
		<!-- nerve to the brain -->
		<path
			d="M{CC.x} {CC.y} C 790 330 830 300 960 292"
			fill="none"
			stroke="var(--he-nerve)"
			stroke-width="10"
			stroke-linecap="round"
		/>

		<!-- the eardrum and the three bones -->
		<g opacity={o.bones}>
			<path
				d="M421 {300 - half} Q {440 + d * (half / 54)} 300 421 {300 + half}"
				fill="none"
				stroke="var(--he-drum)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<g fill="var(--he-ossicle)" stroke="var(--he-ossicle-edge)" stroke-width="1.2">
				<!-- hammer: handle on the eardrum, head up in the attic -->
				<g transform="rotate({bone * 0.5} 452 206)">
					<path
						d="M{432 + d * 0.8} 300 L 428 238 L 440 214 L 452 218 L 440 242 L {438 + d * 0.8} 300 Z"
					/>
					<circle cx="450" cy="204" r="15" />
				</g>
				<!-- anvil -->
				<g transform="rotate({bone * 0.5} 478 206)">
					<ellipse cx="478" cy="206" rx="16" ry="14" />
					<path d="M486 214 L 506 262 L 498 266 L 474 216 Z" />
				</g>
			</g>
			<!-- stirrup: an arch onto the footplate in the window -->
			<g
				fill="none"
				stroke="var(--he-ossicle-edge)"
				stroke-width="5"
				stroke-linecap="round"
				stroke-linejoin="round"
				transform="translate({bone * 0.45} 0)"
			>
				<path d="M502 266 Q 528 250 {footX - 2 - bone * 0.45} 255" />
				<path d="M502 266 Q 528 286 {footX - 2 - bone * 0.45} 283" />
			</g>
			<line
				x1={footX}
				y1="253"
				x2={footX}
				y2="285"
				stroke="var(--he-ossicle-edge)"
				stroke-width="6"
				stroke-linecap="round"
			/>
		</g>

		<!-- the push: many small arrows on the eardrum, one on the window -->
		{#if zoom > 0.02}
			<g opacity={zoom}>
				{#each half > 30 ? [-0.8, -0.4, 0, 0.4, 0.8] : [-0.55, 0.55] as k (k)}
					{@const y = 300 + k * half}
					<path
						d="M394 {y - 1} L404 {y - 1} L404 {y - 4} L411 {y} L404 {y + 4} L404 {y + 1} L394 {y +
							1} Z"
						fill="var(--he-push)"
						opacity={1 - gone}
					/>
				{/each}
				<path
					d="M562 {269 - w / 2} L576 {269 - w / 2} L576 {269 - w / 2 - 3} L586 269 L576 {269 +
						w / 2 +
						3} L576 {269 + w / 2} L562 {269 + w / 2} Z"
					fill="var(--he-push)"
				/>
			</g>
		{/if}
	</g>

	<!-- labels of the whole ear -->
	{#if o.earLabels > 0.02}
		<g opacity={o.earLabels}>
			<Readout id="he-flap" order={10} label="Ear flap" marker={1} at={[zx(70), zy(120)]}>
				<Label x={zx(70)} y={zy(120)} text="ear flap" size={15} weight={600} />
			</Readout>
			<Readout id="he-canal" order={11} label="Ear canal" marker={2} at={[zx(270), zy(232)]}>
				<Label x={zx(270)} y={zy(234)} text="ear canal" size={15} weight={600} />
			</Readout>
			<Readout id="he-drum" order={12} label="Eardrum" marker={3} at={[zx(414), zy(386)]}>
				<Label x={zx(414)} y={zy(384)} text="eardrum" size={15} weight={600} />
			</Readout>
			<Readout id="he-bones" order={13} label="Three tiny bones" marker={4} at={[zx(478), zy(160)]}>
				<Label x={zx(470)} y={zy(158)} text="three tiny bones" size={15} weight={600} />
			</Readout>
			<Readout id="he-cochlea" order={14} label="Cochlea" marker={5} at={[zx(724), zy(452)]}>
				<Label x={zx(724)} y={zy(452)} text="cochlea" size={15} weight={600} />
			</Readout>
			<Readout id="he-loops" order={15} label="Balance loops" marker={6} at={[zx(640), zy(112)]}>
				<Label x={zx(640)} y={zy(108)} text="balance loops" size={13} muted />
			</Readout>
			<Readout
				id="he-nerve"
				order={16}
				label="Nerve to the brain"
				marker={7}
				at={[zx(900), zy(270)]}
			>
				<Label x={zx(936)} y={zy(274)} text="nerve to the brain" anchor="end" size={14} />
			</Readout>
			<Readout id="he-spot">
				<Label
					x={zx(724)}
					y={zy(486)}
					text="the glowing spot: where this note shakes"
					size={13}
					muted
				/>
			</Readout>
		</g>
	{/if}

	<!-- labels of the zoomed middle ear -->
	{#if o.zoomLabels > 0.02}
		<g opacity={o.zoomLabels}>
			{#if middle !== 'none'}
				<Readout id="he-z-drum" order={10} label="Eardrum" marker={1} at={[zx(421), zy(372)]}>
					<Label x={zx(421)} y={zy(300 + half) + 30} text="eardrum" size={16} weight={600} />
				</Readout>
				<Readout id="he-z-hammer" order={11} label="Hammer" marker={2} at={[zx(438), zy(182)]}>
					<Label x={zx(436)} y={zy(182)} text="hammer" size={15} anchor="end" />
				</Readout>
				<Readout id="he-z-anvil" order={12} label="Anvil" marker={3} at={[zx(492), zy(182)]}>
					<Label x={zx(492)} y={zy(184)} text="anvil" size={15} anchor="start" />
				</Readout>
				<Readout id="he-z-stirrup" order={13} label="Stirrup" marker={4} at={[zx(520), zy(306)]}>
					<Label x={zx(522)} y={zy(306)} text="stirrup" size={15} />
				</Readout>
			{/if}
			<Readout
				id="he-z-window"
				order={14}
				label="Window into the cochlea"
				marker={5}
				at={[zx(600), zy(232)]}
			>
				<Label x={zx(604)} y={zy(232)} text="window into the cochlea" size={15} weight={600} />
			</Readout>
			<Readout id="he-z-air">
				<Label x={zx(492)} y={zy(392)} text="air" size={14} muted />
			</Readout>
			<Readout id="he-z-fluid">
				<Label x={zx(640)} y={zy(300)} text="fluid" size={14} muted />
			</Readout>
		</g>

		<!-- the push compared -->
		<g opacity={o.zoomLabels}>
			<Readout id="he-bar-card">
				<rect
					x="560"
					y="430"
					width="384"
					height="144"
					rx="12"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
			</Readout>
			<Readout id="he-bar-air" order={20} label="Air on each bit of eardrum" value="1 push">
				<Label x={578} y={460} text="the air on each bit of eardrum" anchor="start" size={14} />
				<rect x="578" y="470" width={barUnit} height="18" rx="4" fill="var(--he-air)" />
			</Readout>
			<Readout
				id="he-bar-window"
				order={21}
				label="On each bit of window"
				value={middle === 'ear'
					? `${Math.round(push)} pushes`
					: middle === 'small'
						? '1⅓ pushes'
						: '1 push'}
			>
				<Label
					x={578}
					y={516}
					text={middle === 'none'
						? 'the air on each bit of window'
						: 'the stirrup on each bit of window'}
					anchor="start"
					size={14}
				/>
				<rect x="578" y="526" width={barUnit * push} height="18" rx="4" fill="var(--he-push)" />
				<Label
					x={586 + barUnit * push}
					y={541}
					text={middle === 'ear'
						? `${Math.round(push)} times`
						: middle === 'small'
							? 'a third more'
							: 'the same'}
					anchor="start"
					size={14}
					weight={700}
					tabular
				/>
			</Readout>
		</g>
	{/if}

	<!-- headline -->
	<Readout id="he-head" order={1} label="Ear" value={headline} note={sub}>
		<Label x={480} y={zoom > 0.5 ? 50 : 46} text={headline} size={20} weight={700} />
	</Readout>
	<Readout id="he-sub">
		<Label x={480} y={zoom > 0.5 ? 76 : 72} text={sub} size={14} muted />
	</Readout>

	{#if focus === 'ear'}
		<HearButton x={84} y={540} notes={[f]} />
	{/if}
</g>
