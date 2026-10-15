<script lang="ts">
	/**
	 * The reader runs the Spanish mainland, as an island, through 9 April 2025 (`gridAt` in
	 * grid.ts). Left: the clock, the frequency dial and the tally. Right: the day's demand
	 * (dashed ahead of the clock), the supply so far and the frequency so far; below, the
	 * balance now: what is used (demand, plus exports and storage charging) against what is
	 * supplied (each source, plus imports).
	 *
	 * The clock runs from the `start` hour at SECONDS_PER_HOUR per hour to midnight, holds,
	 * and starts again. The day so far depends on the reader's slider history and on when the
	 * trip and cloud buttons were pressed, so it is kept in a frame-to-frame accumulator (the
	 * scene guide's sanctioned exception): a plain object, reset when the day restarts, when
	 * the start hour changes or when the step is re-entered (t goes back). Under reduced
	 * motion the clock stands still at the start hour, and the buttons still act at that hour.
	 */
	import { untrack } from 'svelte';
	import { Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BAND,
		CLOUD,
		F0,
		ISLAND_FCR,
		SECONDS_PER_HOUR,
		UFLS_STEPS,
		autopilot,
		demandAt,
		realDispatch,
		gridAt,
		type Dispatch,
		type Events
	} from '../grid';
	import Dial from './Dial.svelte';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	// each game step has its own start hour (the day, the trip, the cloud)
	const startControl = $derived(
		(step.controls ?? []).find((c) => c.id.startsWith('start') && c.type === 'range')
	);
	const startHour = $derived(
		startControl && startControl.type === 'range'
			? Number(params[startControl.id] ?? startControl.default)
			: 6
	);
	const auto = $derived(params.pilot === 'auto');
	const mine: Dispatch = $derived({
		gas: Number(params.gas ?? 3600),
		hydro: Number(params.hydro ?? 9100),
		storage: Number(params.storage ?? -500)
	});
	// a new day (another start hour, or this step entered) starts from what the plants really
	// did at that hour, so the reader begins balanced
	const stepId = $derived(step.id);
	$effect(() => {
		const d = realDispatch(startHour);
		void stepId;
		untrack(() => {
			const r = (v: number) => Math.round(v / 100) * 100;
			setParam('gas', r(d.gas));
			setParam('hydro', r(d.hydro));
			setParam('storage', r(d.storage));
		});
	});
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const tripCount = $derived(offered.has('tripPlant') ? Number(params.tripPlant ?? 0) : 0);
	const cloudCount = $derived(offered.has('cloud') ? Number(params.cloud ?? 0) : 0);

	// ---- the clock
	const HOLD = 5;
	const dayLength = $derived((24 - startHour) * SECONDS_PER_HOUR);
	const local = $derived(reduced ? 0 : t % (dayLength + HOLD));
	const hour = $derived(Math.min(24, startHour + local / SECONDS_PER_HOUR));

	// ---- the day so far (accumulator; see the header)
	interface Sample {
		h: number;
		supply: number;
		f: number;
	}
	const EVERY = 0.05; // hours between samples
	let acc = {
		local: -1,
		start: -1,
		step: '',
		trips: 0,
		clouds: 0,
		ev: { trip: null, cloud: null } as Events,
		hist: [] as Sample[],
		out: 0,
		shed: 0
	};
	const state = $derived.by(() => {
		const restart =
			local < acc.local || startHour !== acc.start || step.id !== acc.step || acc.local < 0;
		if (restart) {
			acc = {
				local,
				start: startHour,
				step: step.id,
				trips: tripCount,
				clouds: cloudCount,
				ev: { trip: null, cloud: null },
				hist: [],
				out: 0,
				shed: 0
			};
		}
		// a button press since the last frame happens now
		if (tripCount !== acc.trips) {
			acc.trips = tripCount;
			acc.ev = { ...acc.ev, trip: hour };
		}
		if (cloudCount !== acc.clouds) {
			acc.clouds = cloudCount;
			acc.ev = { ...acc.ev, cloud: hour };
		}
		const d = auto ? autopilot(hour, acc.ev) : mine;
		const g = gridAt(hour, d, acc.ev);
		const last = acc.hist.at(-1);
		// the first frames of a new day wait for the sliders to be reset (the $effect above)
		const settled = reduced || local > 0.15 || !restart;
		if (settled && (!last || hour - last.h >= EVERY)) {
			if (last) {
				const dh = hour - last.h;
				if (Math.abs(last.f - F0) > BAND + 1e-9) acc.out += dh;
			}
			acc.hist = [...acc.hist, { h: hour, supply: g.supply, f: g.grid.f }];
			if (g.grid.shed > 0 && last) acc.shed += hour - last.h;
		}
		acc.local = local;
		return { g, d, ev: acc.ev, hist: acc.hist, out: acc.out, shed: acc.shed };
	});
	const g = $derived(state.g);
	const f = $derived(g.grid.f);
	const inBand = $derived(Math.abs(f - F0) <= BAND + 1e-9);

	// ---- formatting
	const clock = (h: number) => {
		const m = Math.round(h * 60) % (24 * 60);
		return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
	};
	const gw = (mw: number) => `${(mw / 1000).toFixed(1)} GW`;
	const mins = (h: number) => {
		const m = Math.round(h * 60);
		return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
	};
	const status = $derived.by(() => {
		if (g.grid.shed > 0)
			return `${Math.round(g.grid.shed).toLocaleString('en-GB')} MW of customers cut off`;
		if (inBand) return 'inside the band';
		return f < F0 ? 'too little generation' : 'too much generation';
	});
	const advice = $derived.by(() => {
		if (auto) return 'autopilot: the real schedule';
		const gap = -g.surplus;
		if (Math.abs(gap) < 150) return 'balanced';
		return gap > 0 ? `${gw(gap)} short` : `${gw(-gap)} too much`;
	});

	// ---- chart of the day
	const X0 = 372;
	const X1 = 930;
	const sx = scale([0, 24], [X0, X1]);
	const sy = scale([0, 35000], [292, 52]);
	const FY0 = 330;
	const FY1 = 420;
	const sf = scale([48.8, 50.8], [FY1, FY0]);
	const fClamp = (v: number) => Math.max(48.8, Math.min(50.8, v));
	const demandPts = Array.from({ length: 97 }, (_, i) => ({ h: i / 4, v: demandAt(i / 4) }));
	const past = $derived(demandPts.filter((p) => p.h <= hour));
	const supplyPath = $derived(
		linePath(
			state.hist,
			(s) => s.h,
			(s) => s.supply,
			sx,
			sy
		)
	);
	const fPath = $derived(
		linePath(
			state.hist,
			(s) => s.h,
			(s) => fClamp(s.f),
			sx,
			sf
		)
	);

	// ---- the balance now: used (top) against supplied (bottom)
	const BX0 = 372;
	const sb = scale([0, 40000], [BX0, 930]);
	const segs = (items: { key: string; name: string; v: number; color: string }[]) => {
		let x = 0;
		return items
			.filter((s) => s.v > 1)
			.map((s) => {
				const seg = { ...s, x0: sb(x), x1: sb(x + s.v) };
				x += s.v;
				return seg;
			});
	};
	const used = $derived(
		segs([
			{ key: 'demand', name: 'demand', v: g.demand - g.grid.shed, color: 'var(--pg-demand)' },
			{ key: 'shed', name: 'cut off', v: g.grid.shed, color: 'var(--pg-alarm)' },
			{
				key: 'exports',
				name: 'exports',
				v: -Math.min(0, g.sources.exchange),
				color: 'var(--pg-exchange)'
			},
			{
				key: 'charging',
				name: 'storing',
				v: -Math.min(0, g.sources.storage),
				color: 'var(--pg-storage)'
			}
		])
	);
	const supplied = $derived(
		segs([
			{ key: 'nuclear', name: 'nuclear', v: g.sources.nuclear, color: 'var(--pg-nuclear)' },
			{
				key: 'other',
				name: 'other',
				v: g.sources.other + g.sources.coal + g.sources.solarThermal,
				color: 'var(--pg-other)'
			},
			{ key: 'wind', name: 'wind', v: g.sources.wind, color: 'var(--pg-wind)' },
			{ key: 'solar', name: 'solar', v: g.sources.solarPV, color: 'var(--pg-solar)' },
			{
				key: 'imports',
				name: 'imports',
				v: Math.max(0, g.sources.exchange),
				color: 'var(--pg-exchange)'
			},
			{ key: 'gas', name: 'gas', v: g.sources.gas, color: 'var(--pg-gas)' },
			{ key: 'hydro', name: 'hydro', v: g.sources.hydro, color: 'var(--pg-hydro)' },
			{
				key: 'storage',
				name: 'storage',
				v: Math.max(0, g.sources.storage),
				color: 'var(--pg-storage)'
			}
		])
	);
	const usedEnd = $derived(used.at(-1)?.x1 ?? BX0);
	const UY = 480;
	const SY = 530;

	const tripped = $derived(state.ev.trip != null && hour >= state.ev.trip);
	const clouded = $derived(
		state.ev.cloud != null &&
			hour >= state.ev.cloud &&
			hour <= state.ev.cloud + 2 * CLOUD.ramp + CLOUD.hold
	);
	const solarSeg = $derived(supplied.find((s) => s.key === 'solar'));
</script>

<g>
	<!-- ===== clock, dial, tally -->
	<Readout id="clock" order={1} label="Time" value={clock(hour)}>
		<Txt x={158} y={60} text={clock(hour)} size={34} weight={700} />
		<Label x={158} y={84} text="9 April 2025 · 1 hour every {SECONDS_PER_HOUR} s" muted />
	</Readout>
	<Readout
		id="freq"
		order={2}
		label="Frequency"
		value="{f.toFixed(2)} Hz"
		note={status}
		color={inBand ? 'var(--pg-ok)' : 'var(--pg-alarm)'}
	>
		<Dial cx={158} cy={210} r={84} {f} min={48.5} max={51.5} />
		<Label
			x={158}
			y={312}
			text={status}
			color={inBand ? undefined : 'var(--pg-alarm)'}
			weight={600}
		/>
	</Readout>
	<Readout id="advice" order={3} label="Balance" value={advice}>
		<Label x={158} y={338} text={advice} muted />
	</Readout>
	<Readout
		id="reserve"
		order={4}
		label="Primary reserve in use"
		value="{Math.round(Math.abs(g.grid.fcr)).toLocaleString('en-GB')} of {ISLAND_FCR.toLocaleString(
			'en-GB'
		)} MW"
	>
		<Label
			x={158}
			y={380}
			text="primary reserve in use: {Math.round(Math.abs(g.grid.fcr)).toLocaleString(
				'en-GB'
			)} of {ISLAND_FCR.toLocaleString('en-GB')} MW"
		/>
		<rect x={58} y={390} width={200} height={8} rx="4" fill="var(--stage-grid)" />
		<rect
			x={58}
			y={390}
			width={(200 * Math.min(ISLAND_FCR, Math.abs(g.grid.fcr))) / ISLAND_FCR}
			height={8}
			rx="4"
			fill={Math.abs(g.grid.fcr) > 0.95 * ISLAND_FCR ? 'var(--pg-alarm)' : 'var(--pg-gas)'}
		/>
	</Readout>
	<Readout
		id="tally"
		order={5}
		label="So far today"
		value="outside the band {mins(state.out)}; customers cut off {mins(state.shed)}"
	>
		<Txt x={30} y={440} text="So far today" anchor="start" size={13} weight={600} />
		<Label x={30} y={464} text="outside the band: {mins(state.out)}" anchor="start" />
		<Label
			x={30}
			y={488}
			text="customers cut off: {mins(state.shed)}"
			anchor="start"
			color={state.shed > 0 ? 'var(--pg-alarm)' : undefined}
		/>
	</Readout>
	{#if tripped}
		<Readout id="tripped" order={6} label="Reactor" value="tripped at {clock(state.ev.trip ?? 0)}">
			<Label
				x={30}
				y={520}
				text="reactor tripped at {clock(state.ev.trip ?? 0)}"
				anchor="start"
				color="var(--pg-alarm)"
			/>
		</Readout>
	{/if}
	{#if clouded}
		<Readout id="clouded" order={7} label="Cloud" value="over the solar farms">
			<Label x={30} y={544} text="cloud over the solar farms" anchor="start" muted />
		</Readout>
	{/if}

	<!-- ===== the day: demand and supply -->
	{#each [0, 10000, 20000, 30000] as v (v)}
		<line x1={X0} x2={X1} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
		<text x={X0 - 8} y={sy(v) + 4} text-anchor="end" class="muted" font-size="11">{v / 1000}</text>
	{/each}
	<Txt x={X0 - 30} y={36} text="GW" anchor="start" muted size={12} />
	{#each [0, 6, 12, 18, 24] as h (h)}
		<text x={sx(h)} y={sy(0) + 17} text-anchor="middle" class="muted" font-size="11"
			>{String(h % 24).padStart(2, '0')}:00</text
		>
	{/each}
	<path
		d={linePath(
			demandPts,
			(p) => p.h,
			(p) => p.v,
			sx,
			sy
		)}
		fill="none"
		stroke="var(--pg-demand)"
		stroke-width="1.5"
		stroke-dasharray="5 5"
		opacity="0.5"
	/>
	<path
		d={linePath(
			past,
			(p) => p.h,
			(p) => p.v,
			sx,
			sy
		)}
		fill="none"
		stroke="var(--pg-demand)"
		stroke-width="2"
	/>
	<path d={supplyPath} fill="none" stroke="var(--pg-gas)" stroke-width="3" opacity="0.85" />
	<line x1={sx(hour)} x2={sx(hour)} y1={44} y2={FY1} stroke="var(--stage-ink)" opacity="0.5" />
	<circle cx={sx(hour)} cy={sy(g.demand)} r="4" fill="var(--pg-demand)" />
	<circle cx={sx(hour)} cy={sy(g.supply)} r="5" fill="var(--pg-gas)" />
	<Readout id="key-demand">
		<Label x={X0 + 8} y={64} text="demand (dashed: still to come)" anchor="start" />
		<Label x={X0 + 8} y={84} text="supply" anchor="start" color="var(--pg-gas)" weight={600} />
	</Readout>
	{#if state.ev.trip != null}
		<path
			d="M{sx(state.ev.trip)} 44 v{FY1 - 44}"
			stroke="var(--pg-alarm)"
			stroke-dasharray="3 3"
			opacity="0.7"
		/>
	{/if}
	{#if state.ev.cloud != null}
		<rect
			x={sx(state.ev.cloud)}
			y={44}
			width={sx(state.ev.cloud + 2 * CLOUD.ramp + CLOUD.hold) - sx(state.ev.cloud)}
			height={FY1 - 44}
			fill="var(--pg-cloud)"
			opacity="0.18"
		/>
	{/if}

	<!-- ===== the frequency so far -->
	<rect
		x={X0}
		y={sf(F0 + BAND)}
		width={X1 - X0}
		height={sf(F0 - BAND) - sf(F0 + BAND)}
		fill="var(--pg-band)"
	/>
	<line x1={X0} x2={X1} y1={sf(F0)} y2={sf(F0)} stroke="var(--pg-ok)" stroke-dasharray="4 4" />
	<line
		x1={X0}
		x2={X1}
		y1={sf(UFLS_STEPS[0])}
		y2={sf(UFLS_STEPS[0])}
		stroke="var(--pg-alarm)"
		stroke-dasharray="5 4"
	/>
	{#each [49, 50] as v (v)}
		<text x={X0 - 8} y={sf(v) + 4} text-anchor="end" class="muted" font-size="11">{v}</text>
	{/each}
	<Txt x={X0 - 30} y={FY0 - 8} text="Hz" anchor="start" muted size={12} />
	<path d={fPath} fill="none" stroke="var(--stage-ink)" stroke-width="2" />
	<circle
		cx={sx(hour)}
		cy={sf(fClamp(f))}
		r="4"
		fill={inBand ? 'var(--pg-ok)' : 'var(--pg-alarm)'}
	/>

	<!-- ===== the balance now -->
	<Txt x={BX0} y={UY - 22} text="Now" anchor="start" size={13} weight={600} />
	{#each used as s (s.key)}
		<rect
			x={s.x0}
			y={UY - 11}
			width={Math.max(0.5, s.x1 - s.x0)}
			height={22}
			fill={s.color}
			opacity={s.key === 'demand' ? 0.25 : 0.85}
		/>
	{/each}
	{#each supplied as s (s.key)}
		<rect
			x={s.x0}
			y={SY - 11}
			width={Math.max(0.5, s.x1 - s.x0)}
			height={22}
			fill={s.color}
			opacity="0.9"
		/>
	{/each}
	{#if clouded && solarSeg}
		<g transform="translate({(solarSeg.x0 + solarSeg.x1) / 2} {SY})" opacity="0.9">
			<ellipse cx="-9" cy="2" rx="16" ry="9" fill="var(--pg-cloud)" />
			<ellipse cx="8" cy="-2" rx="14" ry="10" fill="var(--pg-cloud)" />
		</g>
	{/if}
	<line
		x1={usedEnd}
		x2={usedEnd}
		y1={UY - 18}
		y2={SY + 18}
		stroke="var(--stage-ink)"
		stroke-dasharray="3 3"
	/>
	<Readout
		id="used"
		order={8}
		label="Used"
		value={gw(g.demand + Math.max(0, -g.sources.exchange) + Math.max(0, -g.sources.storage))}
	>
		<Label
			x={BX0 + 6}
			y={UY + 5}
			text="used: demand {gw(g.demand)}{g.sources.exchange < 0 ? ' + exports' : ''}{g.sources
				.storage < 0
				? ' + storing'
				: ''}"
			anchor="start"
		/>
	</Readout>
	<Readout
		id="supplied"
		order={9}
		label="Supplied"
		value={gw(g.supply + Math.max(0, -g.sources.exchange) + Math.max(0, -g.sources.storage))}
	/>
	{#each supplied as s, i (s.key)}
		{#if s.x1 - s.x0 > 44}
			<Readout id="seg-{s.key}" order={20 + i} label={s.name} value={gw(s.v)} color={s.color}>
				<Label x={(s.x0 + s.x1) / 2} y={SY + 30} text={s.name} />
			</Readout>
		{/if}
	{/each}
	<Readout id="mode">
		<Label
			x={X1}
			y={584}
			text={auto ? 'gas, hydro and storage: autopilot' : 'gas, hydro and storage: you'}
			anchor="end"
			muted
		/>
	</Readout>
	<Readout id="source">
		<Label x={BX0} y={584} text="Data: Red Eléctrica (REE)" anchor="start" muted />
	</Readout>
</g>
