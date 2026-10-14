<script lang="ts">
	/**
	 * The world map: real earthquakes (USGS, M ≥ 5.5, 2015–2024), Holocene volcanoes (Smithsonian
	 * GVP) and plate boundaries (Bird 2003), on an equirectangular map that the reader can turn by
	 * dragging it sideways (or with the "Centre the map on" slider).
	 *
	 * Phases (`step.hints.phase`):
	 * - pattern: earthquakes and volcanoes only; ten years of earthquakes replay as flashes.
	 * - plates: plus the boundaries, coloured by how the plates move, and the big plates' names.
	 * - depth: earthquakes coloured by depth (shallow / intermediate / deep).
	 * - hotspots: volcanoes coloured by their tectonic setting; Hawaii and Réunion named.
	 *
	 * The static layers are drawn once (as a few long paths: one dot per earthquake is a zero-length
	 * segment with a round cap) and shown three times side by side through `<use>`, so panning is a
	 * translation and the map wraps round seamlessly.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, cycle, smoothstep, startDrag } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CATALOGUE_DAYS,
		MAP,
		MAP_H,
		NAMED_VOLCANOES,
		PLATES,
		PX_PER_DEG,
		QUOTED,
		depthClass,
		depthCounts,
		dotsPath,
		groupLines,
		land,
		linesPath,
		mapX,
		mapY,
		polygonsPath,
		quakes,
		settingShares,
		teethPath,
		trianglesPath,
		volcanoes,
		type DepthClass,
		type Setting
	} from '../globe';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	type Phase = 'pattern' | 'plates' | 'depth' | 'hotspots';
	const phase = $derived((step.hints?.phase as Phase | undefined) ?? 'pattern');

	// ---- static geometry (built once) --------------------------------------------------
	const MAG_BUCKETS = [
		{ id: 'm55', min: 5.5, max: 6, w: 2.6 },
		{ id: 'm6', min: 6, max: 7, w: 3.8 },
		{ id: 'm7', min: 7, max: 10, w: 6 }
	];
	const DEPTHS: DepthClass[] = ['shallow', 'intermediate', 'deep'];
	const quakeLayers = DEPTHS.flatMap((d) =>
		MAG_BUCKETS.map((b) => ({
			id: `${d}-${b.id}`,
			depth: d,
			w: b.w,
			d: dotsPath(
				quakes.filter((q) => depthClass(q.depth) === d && q.mag >= b.min && q.mag < b.max)
			)
		}))
	);
	const SETTINGS: Setting[] = ['subduction', 'rift', 'intraplate', 'unknown'];
	const volcanoLayers = SETTINGS.map((s) => ({
		setting: s,
		d: trianglesPath(
			volcanoes.filter((v) => v.setting === s),
			3.4
		)
	}));
	const landPath = polygonsPath(land);
	const boundaryPaths = {
		divergent: linesPath(groupLines('divergent')),
		transform: linesPath(groupLines('transform')),
		subduction: linesPath(groupLines('subduction')),
		convergent: linesPath(groupLines('convergent'))
	};
	const teeth = teethPath();
	const shares = settingShares();
	const MAJOR = ['PA', 'AF', 'NA', 'EU', 'AU', 'SA', 'NZ', 'IN', 'AN'];
	const plateLabels = PLATES.filter((p) => MAJOR.includes(p.code)).map((p) => ({
		code: p.code,
		name: p.name.toUpperCase(),
		lon: p.at[0] / 10,
		lat: Math.max(-62, Math.min(72, p.at[1] / 10))
	}));
	const named = (n: string) => NAMED_VOLCANOES.find((v) => v.name === n);
	const HOTSPOTS = [
		{ name: 'Hawaii', v: named('Kilauea') },
		{ name: 'Réunion', v: named('Fournaise, Piton de la') }
	].filter((h) => h.v);

	// ---- panning ---------------------------------------------------------------------
	const lonC = $derived(Number(params.lon ?? 150));
	/** Translation of the world copy nearest the centre, px. */
	const dx = $derived.by(() => {
		const raw = -lonC * PX_PER_DEG;
		return ((((raw + MAP.w / 2) % MAP.w) + MAP.w) % MAP.w) - MAP.w / 2;
	});
	const wrapX = (x: number) => {
		const u = x + dx - MAP.x;
		return MAP.x + (((u % MAP.w) + MAP.w) % MAP.w);
	};
	let dragFrom: { x: number; lon: number } | null = null;
	function ondown(e: PointerEvent) {
		dragFrom = null;
		startDrag(
			e,
			(p) => {
				dragFrom ??= { x: p.x, lon: lonC };
				let lon = dragFrom.lon - (p.x - dragFrom.x) / PX_PER_DEG;
				lon = ((((lon + 180) % 360) + 360) % 360) - 180;
				setParam('lon', Math.round(lon));
			},
			() => (dragFrom = null)
		);
	}

	// ---- phase fades -----------------------------------------------------------------
	const fade = (on: () => boolean) => {
		const tw = new Tween(on() ? 1 : 0, { duration: 700, easing: cubicInOut });
		$effect(() => {
			const v = on() ? 1 : 0;
			untrack(() => tw.set(v, { duration: reduced ? 0 : 700 }));
		});
		return tw;
	};
	const showBoundaries = $derived(phase !== 'pattern' && params.boundaries !== false);
	const fBound = fade(() => showBoundaries);
	const fSetting = fade(() => phase === 'hotspots');
	const fLabels = fade(() => phase === 'plates' && showBoundaries);

	const quakeColor = (d: DepthClass) => (phase === 'depth' ? `var(--pt-${d})` : 'var(--pt-quake)');
	const quakeOpacity = $derived(phase === 'hotspots' ? 0.18 : phase === 'depth' ? 0.85 : 0.55);
	const volcanoColor = (s: Setting) =>
		phase === 'hotspots'
			? s === 'subduction'
				? 'var(--pt-together)'
				: s === 'rift'
					? 'var(--pt-apart)'
					: s === 'intraplate'
						? 'var(--pt-intraplate)'
						: 'var(--stage-ink-muted)'
			: 'var(--pt-volcano)';
	const volcanoOpacity = $derived(phase === 'depth' ? 0.25 : phase === 'hotspots' ? 0.95 : 0.8);
	// boundaries are drawn in their colours on the plates step, muted elsewhere
	const coloured = $derived(phase === 'plates');
	const bColor = (g: 'apart' | 'together' | 'sideways') =>
		coloured ? `var(--pt-${g})` : 'var(--stage-ink-muted)';

	// ---- replay of the catalogue -----------------------------------------------------
	const REPLAY = 40; // seconds for ten years
	const WINDOW = 50; // days a flash lasts
	const replayOn = $derived(!reduced && phase !== 'hotspots');
	const today = $derived(replayOn ? cycle(t, REPLAY) * CATALOGUE_DAYS : CATALOGUE_DAYS);
	const flashes = $derived.by(() => {
		if (!replayOn) return [];
		const out: { i: number; x: number; y: number; r: number; o: number; c: string }[] = [];
		for (let i = 0; i < quakes.length; i++) {
			const q = quakes[i];
			const age = today - q.day;
			if (age < 0 || age > WINDOW) continue;
			const u = age / WINDOW;
			out.push({
				i,
				x: wrapX(mapX(q.lon)),
				y: mapY(q.lat),
				r: (2 + (q.mag - 5) * 3) * (0.6 + 1.6 * u),
				o: (1 - u) * smoothstep(0, 0.05, u + 0.02),
				c: quakeColor(depthClass(q.depth))
			});
		}
		return out;
	});
	const dateText = $derived.by(() => {
		if (!replayOn) return '2015 – 2024';
		const d = new Date(Date.UTC(2015, 0, 1) + Math.min(today, CATALOGUE_DAYS - 1) * 86400000);
		return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
	});

	const fmt = (n: number) => n.toLocaleString('en-GB');
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const MAP_BOTTOM = MAP.y + MAP_H;
</script>

<g class="map-scene">
	<defs>
		<clipPath id="map-scene-clip">
			<rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP_H} rx="6" />
		</clipPath>
		<g id="map-scene-world">
			<path d={landPath} fill="var(--pt-land)" stroke="var(--pt-land-edge)" stroke-width="0.6" />
			<g opacity={fBound.current} fill="none" stroke-linejoin="round" stroke-linecap="round">
				<path d={boundaryPaths.divergent} stroke={bColor('apart')} stroke-width="1.6" />
				<path d={boundaryPaths.transform} stroke={bColor('sideways')} stroke-width="1.4" />
				<path d={boundaryPaths.convergent} stroke={bColor('together')} stroke-width="1.6" />
				<path d={boundaryPaths.subduction} stroke={bColor('together')} stroke-width="1.6" />
				<path d={teeth} fill={bColor('together')} stroke="none" />
			</g>
			<g fill="none" stroke-linecap="round" opacity={quakeOpacity}>
				{#each quakeLayers as l (l.id)}
					<path d={l.d} stroke={quakeColor(l.depth)} stroke-width={l.w} />
				{/each}
			</g>
			<g opacity={volcanoOpacity} stroke="var(--stage-bg)" stroke-width="0.6">
				{#each volcanoLayers as l (l.setting)}
					<path d={l.d} fill={volcanoColor(l.setting)} />
				{/each}
			</g>
		</g>
	</defs>

	<!-- the map, three copies side by side, clipped -->
	<rect
		x={MAP.x}
		y={MAP.y}
		width={MAP.w}
		height={MAP_H}
		rx="6"
		fill="var(--pt-map-sea)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#map-scene-clip)">
		{#each [-1, 0, 1] as k (k)}
			<use href="#map-scene-world" x={dx + k * MAP.w} />
		{/each}
		<!-- earthquakes of the last few weeks of the replay -->
		{#each flashes as f (f.i)}
			<circle cx={f.x} cy={f.y} r={f.r} fill="none" stroke={f.c} stroke-width="1.6" opacity={f.o} />
		{/each}
		<!-- plate names -->
		<g opacity={fLabels.current}>
			{#each plateLabels as p (p.code)}
				<Readout id="plate-{p.code}">
					<Label
						x={Math.max(MAP.x + 70, Math.min(MAP.x + MAP.w - 70, wrapX(mapX(p.lon))))}
						y={mapY(p.lat)}
						text={p.name}
						size={11}
						weight={600}
						muted
					/>
				</Readout>
			{/each}
		</g>
		<!-- hotspots -->
		<g opacity={fSetting.current}>
			{#each HOTSPOTS as h (h.name)}
				{@const x = wrapX(mapX(h.v!.at[0] / 10))}
				{@const y = mapY(h.v!.at[1] / 10)}
				<circle cx={x} cy={y} r="9" fill="none" stroke="var(--pt-intraplate)" stroke-width="1.6" />
				<Readout id="hot-{h.name}">
					<Label {x} y={y - 15} text={h.name} size={12} weight={600} />
				</Readout>
			{/each}
		</g>
	</g>
	<!-- drag surface for turning the globe -->
	<rect
		class="pan"
		x={MAP.x}
		y={MAP.y}
		width={MAP.w}
		height={MAP_H}
		fill="transparent"
		role="presentation"
		onpointerdown={ondown}
	/>

	<!-- legend, above the map -->
	<g transform="translate(24 40)">
		{#if phase === 'depth'}
			<Readout id="legend-depth" order={1} label="Earthquake depth" value="by colour">
				<text x="0" y="4" font-size="13" font-weight="600">Earthquakes by depth:</text>
			</Readout>
			{#each DEPTHS as d, i (d)}
				{@const label =
					d === 'shallow'
						? 'under 70 km'
						: d === 'intermediate'
							? '70–300 km'
							: 'deeper than 300 km'}
				<Readout
					id="depth-{d}"
					order={2 + i}
					label={d === 'shallow'
						? 'Shallow, under 70 km'
						: d === 'intermediate'
							? '70–300 km deep'
							: 'Deeper than 300 km'}
					value={fmt(depthCounts[d])}
					color="var(--pt-{d})"
				>
					<circle cx={168 + i * 190} cy="0" r="5" fill="var(--pt-{d})" />
					<text x={178 + i * 190} y="4" font-size="13">{label} ({fmt(depthCounts[d])})</text>
				</Readout>
			{/each}
		{:else if phase === 'hotspots'}
			{#each [['subduction', 'together', 'at subduction zones'], ['rift', 'apart', 'at rifts and ridges'], ['intraplate', 'intraplate', 'within a plate']] as [s, c, label], i (s)}
				<Readout
					id="set-{s}"
					order={i + 1}
					label="Volcanoes {label}"
					value={pct(shares[s as Setting])}
					color="var(--pt-{c})"
				>
					<path d="M{i * 250} -6 l5.5 9.5 h-11 z" fill="var(--pt-{c})" transform="translate(6 0)" />
					<text x={i * 250 + 18} y="4" font-size="13">{pct(shares[s as Setting])} {label}</text>
				</Readout>
			{/each}
		{:else}
			<Readout
				id="legend-quake"
				order={1}
				label="Earthquakes, M ≥ 5.5"
				value={phase === 'pattern' ? fmt(quakes.length) : undefined}
				color="var(--pt-quake)"
			>
				<circle cx="5" cy="0" r="4" fill="var(--pt-quake)" />
				<text x="16" y="4" font-size="13"
					>{fmt(quakes.length)} earthquakes of magnitude 5.5 or more</text
				>
			</Readout>
			<Readout
				id="legend-volcano"
				order={2}
				label="Volcanoes, last 12,000 years"
				value={phase === 'pattern' ? fmt(volcanoes.length) : undefined}
				color="var(--pt-volcano)"
			>
				<path d="M340 -6 l5.5 9.5 h-11 z" fill="var(--pt-volcano)" />
				<text x="352" y="4" font-size="13"
					>{fmt(volcanoes.length)} volcanoes active in the last 12,000 years</text
				>
			</Readout>
			<Readout
				id="date"
				order={3}
				label={phase === 'pattern' ? 'Earthquakes up to' : undefined}
				value={dateText}
			>
				<text x="912" y="4" font-size="15" font-weight="600" text-anchor="end">{dateText}</text>
			</Readout>
		{/if}
	</g>

	<!-- below the map -->
	<g transform="translate(24 {MAP_BOTTOM + 30})">
		{#if phase === 'plates'}
			<g opacity={fBound.current}>
				{#each [['apart', 'apart'], ['together', 'together'], ['sideways', 'sliding past']] as [g, label], i (g)}
					<Readout
						id="b-{g}"
						order={10 + i}
						label={g === 'sideways' ? 'Plates sliding past' : `Plates moving ${label}`}
						color="var(--pt-{g})"
					>
						<path d="M{i * 150} 0 h26" stroke="var(--pt-{g})" stroke-width="2.4" />
						<text x={i * 150 + 34} y="4" font-size="13">{label}</text>
					</Readout>
				{/each}
				<Readout id="b-teeth">
					<path d="M450 0 h26" stroke="var(--pt-together)" stroke-width="2.4" />
					{#each [0, 1, 2] as k (k)}
						<path d="M{452 + k * 9} 0 l3 -5 l3 5 z" fill="var(--pt-together)" />
					{/each}
					<text x="484" y="4" font-size="13" class="muted"
						>teeth on the plate that stays on top</text
					>
				</Readout>
			</g>
			<Readout
				id="near"
				order={20}
				label="Earthquakes within 200 km of a boundary"
				value={pct(QUOTED.quakesWithin200km)}
				note="a band covering {pct(QUOTED.areaWithin200km)} of the Earth's surface"
			>
				<text x="0" y="34" font-size="15" font-weight="600"
					>{pct(QUOTED.quakesWithin200km)} of these earthquakes struck within 200 km of a plate boundary</text
				>
				<text x="0" y="54" font-size="12" class="muted"
					>— a band that covers only {pct(QUOTED.areaWithin200km)} of the Earth's surface</text
				>
			</Readout>
		{:else if phase === 'depth'}
			<Readout id="depth-note" order={10} label="The deep ones" value="only near subduction zones">
				<text x="0" y="8" font-size="14" font-weight="600"
					>The deep earthquakes all lie near subduction zones, on the side away from the trench</text
				>
				<text x="0" y="28" font-size="12" class="muted"
					>Deepest in this catalogue: {Math.max(...quakes.map((q) => q.depth))} km</text
				>
			</Readout>
		{:else if phase === 'hotspots'}
			<Readout
				id="near-v"
				order={10}
				label="Volcanoes within 300 km of a boundary"
				value={pct(QUOTED.volcanoesWithin300km)}
			>
				<text x="0" y="8" font-size="14" font-weight="600"
					>{pct(QUOTED.volcanoesWithin300km)} of the volcanoes stand within 300 km of a plate boundary</text
				>
				<text x="0" y="28" font-size="12" class="muted"
					>Hawaii and Réunion sit over hotspots, far from any boundary</text
				>
			</Readout>
		{:else}
			<Readout id="hint" order={10}>
				<text x="0" y="8" font-size="13" class="muted"
					>Drag the map sideways to turn the globe.</text
				>
			</Readout>
		{/if}
	</g>
	<Readout id="sources">
		<text x="944" y="588" font-size="10" text-anchor="end" class="muted"
			>USGS ComCat · Smithsonian GVP · Bird (2003) PB2002 · Natural Earth</text
		>
	</Readout>
</g>

<style>
	.pan {
		cursor: grab;
		touch-action: pan-y;
	}
	.pan:active {
		cursor: grabbing;
	}
	.muted {
		fill: var(--stage-ink-muted);
	}
</style>
