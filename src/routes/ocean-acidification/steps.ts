import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** CO₂ in the air above the water (dry mole fraction). One id, so the value follows the reader. */
const co2: Control = {
	type: 'range',
	id: 'co2',
	label: 'CO₂ in the air',
	min: 280,
	max: 1200,
	step: 1,
	default: 423,
	format: (v) => `${Math.round(v)} ppm`,
	help: '280 ppm before industry; 423 ppm in 2024. You can also drag the marker on the chart.'
};

/** Temperature of the surface water. */
const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Water temperature',
	min: -1.8,
	max: 30,
	step: 0.1,
	default: 18,
	format: (v) => `${v.toFixed(1)} °C`,
	help: 'Polar seas sit near −1.8 °C, where seawater freezes; the tropics near 28 °C; the global average is about 18 °C.'
};

/**
 * Scenes: `sea` (air over a column of seawater, the reactions, and bars of the three forms of
 * carbon; hint `focus`: 'dissolve' | 'react' | 'buffer'), `bjerrum` (the shares of the three
 * forms against pH, the water's pH marked), `sweep` (pH and carbonate ion against the air's CO₂;
 * hint `mode`: 'acid' | 'today'), `shells` (aragonite and calcite saturation against the air's
 * CO₂, a curve per temperature; hint `focus`: 'omega' | 'cold'), `revelle` (the Revelle factor
 * and the carbon taken up per 100 ppm).
 */
export const spec: ExplainerSpec = {
	slug: 'ocean-acidification',
	title: 'Ocean acidification and carbonate chemistry',
	summary:
		'Turn up the CO₂ in the air and solve seawater’s carbonate chemistry as you go: the pH slips, the dissolved CO₂ and bicarbonate climb, and the carbonate ion that shells are built from runs short, first in cold polar water.',
	chapters: [
		{ id: 'sea', title: 'CO₂ meets seawater' },
		{ id: 'forms', title: 'Three forms of one carbon' },
		{ id: 'shells', title: 'Shells and cold water' },
		{ id: 'uptake', title: 'An ocean that fills up' }
	],
	steps: [
		// ------------------------------------------------------------------ sea
		{
			id: 'dissolve',
			chapter: 'sea',
			title: 'CO₂ from the air dissolves in the sea',
			scene: 'sea',
			hints: { focus: 'dissolve' },
			duration: 22,
			controls: [co2, temp],
			body: `
<p>The ocean's surface trades gas with the air all the time. CO₂ molecules cross it in both directions until the water holds an amount of dissolved CO₂ set by the air above: <dfn data-def="The amount of a gas dissolved in a liquid at equilibrium is proportional to the gas's partial pressure above it: [CO₂] = K₀ × pCO₂.">Henry's law</dfn>, <span class="formula">[CO₂] = K₀ × pCO₂</span>.</p>
<p>Before industry the air held 280 parts per million (ppm) of CO₂; in 2024 it held 423. Slide it up and the dissolved CO₂ rises in proportion: 1.5 times the air, 1.5 times the gas in the water. Cool the water and it holds more, because gases dissolve better in cold water (K₀ at 0 °C is more than twice its value at 28 °C).</p>
<p>So far this is only gas. What makes seawater interesting is what that gas does next.</p>`,
			notes: `<p>The page treats the surface water as being in full equilibrium with the air above it, and holds the salinity at 35 and the <dfn data-def="The water's capacity to take up hydrogen ions: the excess of bases (bicarbonate, carbonate, borate, hydroxide) over acids, in µmol per kg.">total alkalinity</dfn> at 2,300 µmol/kg, typical open-ocean values. Real surface water lags the air by months, and the polar oceans also mix in old, carbon-rich deep water, so the real map is patchier than the model. K₀ is Weiss's (1974) fit; the air's CO₂ is converted to a partial pressure over water saturated with vapour (Weiss and Price 1980), and to a fugacity, as CO2SYS does.</p>`
		},
		{
			id: 'react',
			chapter: 'sea',
			title: 'Carbonic acid, and the carbonate ion that pays for it',
			scene: 'sea',
			hints: { focus: 'react' },
			duration: 26,
			controls: [co2],
			body: `
<p>A small share of the dissolved CO₂ reacts with water to make carbonic acid, which gives up a hydrogen ion and becomes <dfn data-def="HCO₃⁻, the hydrogen carbonate ion: carbonic acid that has given away one H⁺.">bicarbonate</dfn>:</p>
<p class="formula"><strong>CO₂ + H₂O ⇌ H₂CO₃ ⇌ H⁺ + HCO₃⁻</strong></p>
<p>That hydrogen ion does not stay free. Seawater is full of <dfn data-def="CO₃²⁻: bicarbonate that has given away its second H⁺. With calcium it makes calcium carbonate, CaCO₃.">carbonate ions</dfn>, and they grab it, becoming bicarbonate too:</p>
<p class="formula"><strong>H⁺ + CO₃²⁻ ⇌ HCO₃⁻</strong></p>
<p>Add the two and the hydrogen ion cancels out. The net reaction is <strong>CO₂ + CO₃²⁻ + H₂O → 2 HCO₃⁻</strong>: CO₂ entering seawater turns carbonate ion into bicarbonate. Slide the CO₂ up and watch the bars: bicarbonate grows by about two and a half times what carbonate loses. From 280 to 423 ppm, the carbonate ion has fallen by about a quarter.</p>`,
			notes: `<p>Both equilibria are the ones of <a href="../reaction-rates-equilibrium/#equilibrium">reaction rates and equilibrium</a>, with constants measured in seawater: K₁ and K₂ of Lueker, Dickson and Keeling (2000), on the total pH scale. True H₂CO₃ is only about a thousandth of the dissolved CO₂, so chemists lump the two together as CO₂*; the bars do the same. The bicarbonate gain is more than twice the carbonate loss because borate, the other base in seawater, takes up some of the hydrogen ions too (B(OH)₄⁻ + H⁺ → B(OH)₃ + H₂O), letting a little more CO₂ become bicarbonate.</p>`
		},
		{
			id: 'buffer',
			chapter: 'sea',
			title: 'Why the pH moves so little',
			scene: 'sea',
			hints: { focus: 'buffer' },
			duration: 24,
			controls: [co2],
			body: `
<p>Because carbonate and borate soak up nearly every hydrogen ion the new acid releases, seawater is a <dfn data-def="A solution that resists changes in pH: it holds a base that takes up added H⁺ (and an acid that gives it back).">buffer</dfn>. The hydrogen ions left free are a tiny remainder: about 0.008 µmol per kilogram today, against about 2,000 µmol of dissolved carbon.</p>
<p>A tiny remainder still counts on a logarithmic scale. The pH has fallen from about 8.18 to 8.03 at 18 °C, and as on the <a href="../acids-bases/#ph">pH scale</a> each step is tenfold: a drop of 0.15 means 40% more hydrogen ions. At 1,000 ppm the pH would be 7.70, three times the pre-industrial hydrogen ions.</p>
<p>What the buffer cannot hide is its own cost: the carbonate ion it used up.</p>`,
			notes: `<p>The page solves the charge balance that defines the alkalinity, <span class="formula">A<sub>T</sub> = [HCO₃⁻] + 2[CO₃²⁻] + [B(OH)₄⁻] + [OH⁻] − [H⁺]<sub>F</sub> − [HSO₄⁻] − [HF]</span>, for the one unknown, the hydrogen ion concentration. Here [H⁺]<sub>F</sub> means the free hydrogen ions; the pH shown is on the total scale, [H⁺]<sub>T</sub> = [H⁺]<sub>F</sub>(1 + S<sub>T</sub>/K<sub>S</sub>), which also counts those held by sulfate. Every species is written through its equilibrium constant (borate KB of Dickson 1990, boron from Uppström 1974, water KW of Millero 1995). Dissolving CO₂ adds no charge, so the alkalinity does not change; that is why holding it fixed is right on these timescales. Phosphate and silicate, a few µmol/kg, are left out. Over thousands of years dissolving seafloor carbonate and rock weathering do add alkalinity back, the slow cure the <a href="../carbon-cycle/#slow">carbon cycle</a> describes.</p>`
		},
		// ------------------------------------------------------------------ forms
		{
			id: 'bjerrum',
			chapter: 'forms',
			title: 'The Bjerrum plot: who wins at which pH',
			scene: 'bjerrum',
			duration: 24,
			controls: [co2, temp],
			body: `
<p>CO₂, bicarbonate and carbonate are one carbon in three states of protonation, and the pH decides the shares. This chart, a <dfn data-def="A plot of the shares of the carbonate species against pH, named after the Danish chemist Niels Bjerrum (1914).">Bjerrum plot</dfn>, shows them for seawater. CO₂ and bicarbonate cross at pH = pK₁, about 5.9; bicarbonate and carbonate at pK₂, about 9.1 at 18 °C.</p>
<p>Seawater sits between the two, on bicarbonate's plateau: about 90% of its carbon is bicarbonate, under 10% carbonate, under 1% CO₂. But it sits on the <strong>slope</strong> of the carbonate curve, so a small fall in pH costs carbonate a large share. Slide the CO₂ and watch the marker walk down that slope.</p>`,
			notes: `<p>In fresh water the same crossings are at pH 6.35 and 10.33 (25 °C). The salts of seawater stabilise the ions and pull pK₁ and pK₂ down by about 0.5 and 1.4, which is why constants measured in seawater are needed. Warmer water shifts both crossings to lower pH: move the temperature slider. The shares here are of dissolved inorganic carbon: CO₂ (with H₂CO₃), HCO₃⁻ and CO₃²⁻.</p>`
		},
		{
			id: 'not-acid',
			chapter: 'forms',
			title: 'Acidification, not acid',
			scene: 'sweep',
			hints: { mode: 'acid' },
			duration: 22,
			controls: [co2, temp],
			body: `
<p>Even at 1,200 ppm, more than four times the pre-industrial air, the model's seawater stays above pH 7.5 at any temperature: <strong>basic</strong>, not acid. "Acidification" names the direction, a shift toward acid, not a destination. Nothing on this page makes the sea corrosive to skin or to boats.</p>
<p>Look at the right instead. At 18 °C, between 280 and 1,000 ppm, the pH falls by about 0.48 units and the hydrogen ions triple, yet the water is still basic; meanwhile the carbonate ion falls by about 60%. That loss is what makes building shells and skeletons harder. The higher CO₂ and lower pH can also affect some animals' physiology directly, but nothing here turns the sea into acid.</p>`,
			notes: `<p>The pH here is on the total scale, the standard for seawater, which counts free hydrogen ions plus those held by sulfate. On that scale seawater's neutral point, where hydrogen and hydroxide ions are equal, is not exactly 7: about 6.6 at 25 °C and 7.2 near freezing. The water stays above it everywhere on this page. Measured surface ocean pH has fallen from about 8.17 around 1770 to 8.07 in 2000 (Jiang and others, <i>Scientific Reports</i>, 2019, the figure the <a href="../acids-bases/#scale">acids and bases</a> page quotes); the model at 18 °C gives 8.18 and 8.08 for the air of those years.</p>`
		},
		// ------------------------------------------------------------------ shells
		{
			id: 'saturation',
			chapter: 'shells',
			title: 'Shells need carbonate ion',
			scene: 'shells',
			hints: { focus: 'omega' },
			duration: 24,
			controls: [co2, temp],
			body: `
<p>Corals, clams, snails and many plankton build with calcium carbonate, CaCO₃, from calcium ions and carbonate ions in the water. Calcium is plentiful and steady; carbonate is the scarce half. How easy building is depends on the <dfn data-def="Ω = [Ca²⁺][CO₃²⁻] / Ksp: the product of the two ions over the product at which the mineral neither forms nor dissolves.">saturation state</dfn>:</p>
<p class="formula"><strong>Ω = [Ca²⁺][CO₃²⁻] / K<sub>sp</sub></strong></p>
<p>Above Ω = 1 the water is supersaturated and the mineral does not dissolve; below 1 bare carbonate dissolves. Two forms matter: <dfn data-def="The form of CaCO₃ built by corals, pteropods and many molluscs; about 1.5 times more soluble than calcite.">aragonite</dfn> and the less soluble <dfn data-def="The stable form of CaCO₃, built by coccolithophores, foraminifera and oysters (in part).">calcite</dfn>. At 18 °C, aragonite saturation falls from 3.4 to 2.6 between 280 and 423 ppm; drag the marker to find where it reaches 1.</p>`,
			notes: `<p>Solubility products from Mucci (1983); calcium from Riley and Tongudai (1967), 10.3 mmol/kg at salinity 35. An Ω above 1 does not make building free: many corals and pteropods calcify more slowly as Ω falls well above 1, and they spend energy pumping ions to raise Ω at the growth site. Below 1, organisms can still build, but exposed shell and skeleton dissolve.</p>`
		},
		{
			id: 'cold',
			chapter: 'shells',
			title: 'Cold seas get there first',
			scene: 'shells',
			hints: { focus: 'cold' },
			duration: 26,
			controls: [temp, co2],
			body: `
<p>Slide the temperature down to polar water. Cold water starts with less carbonate ion and loses it sooner: near freezing, aragonite saturation reaches 1 at about 540 ppm of CO₂; at 0 °C at about 590; at 18 °C not until 1,430; in tropical water at 28 °C not below 2,000 ppm.</p>
<p>Two things work together. Cold water dissolves more CO₂ for the same air, so more carbonate is consumed (K₀ at −1.8 °C is 2.7 times its value at 30 °C). And carbonic acid's second step is weaker when cold (pK₂ about 9.4 instead of 8.9), so less of the carbon sits as carbonate in the first place. The solubility of aragonite itself barely changes.</p>`,
			notes: `<p>Real polar seas reach undersaturation even sooner than this uniform model says: their surface water mixes with old, carbon-rich water from below, and sea-ice melt dilutes the alkalinity. Parts of the Arctic and Southern Ocean are already seasonally undersaturated for aragonite, and Orr and others (<i>Nature</i>, 2005) project that average Southern Ocean surface water starts to be undersaturated for aragonite at about 635 ppm (about 2070 in their scenario), or at 550 ppm (2050) if the surface is assumed to keep pace with the air, and that it is undersaturated throughout the Southern Ocean by about 790 ppm, in 2100. The fits for K₁ and K₂ were measured between 2 and 35 °C; below 2 °C the page extrapolates them, as CO2SYS users do.</p>`
		},
		// ------------------------------------------------------------------ uptake
		{
			id: 'revelle',
			chapter: 'uptake',
			title: 'The ocean takes up less as it fills',
			scene: 'revelle',
			duration: 24,
			controls: [co2, temp],
			body: `
<p>The ocean has taken up about a quarter of the CO₂ people have emitted. But the carbonate ion that lets it do so is the very thing being used up. The <dfn data-def="R = (ΔpCO₂ / pCO₂) ÷ (ΔDIC / DIC) at fixed alkalinity: how many per cent the water's CO₂ pressure rises for a 1% rise in its dissolved carbon.">Revelle factor</dfn> measures it: by how many per cent the water's CO₂ pressure rises for each 1% of carbon it takes in.</p>
<p>At 280 ppm and 18 °C it is about 9: a 10% rise in the air is matched by about a 1% rise in the water's carbon. As the CO₂ climbs, the factor climbs too, to about 16 at 1,000 ppm, and each extra 100 ppm puts less carbon into every kilogram of surface water: about 62 µmol between 280 and 380 ppm, 15 between 880 and 980 (the bars on the right).</p>`,
			notes: `<p>The factor is computed from two equilibrium solutions with pCO₂ 0.1% above and below the chosen value, at fixed alkalinity, as the ratio of their logarithmic changes in pressure and in dissolved carbon. Cold water holds more dissolved carbon for the same air, but it has less carbonate ion and a higher Revelle factor, so over this page's range a further 100 ppm adds less carbon per kilogram to cold water than to warm water: move the temperature slider and watch the bars. How much of the ocean the carbon reaches is a matter of the <a href="../ocean-currents/">ocean's circulation</a>: only the surface layer is in quick contact with the air, and the deep water takes centuries to turn over.</p>`
		},
		{
			id: 'today',
			chapter: 'uptake',
			title: 'Where the ocean is now',
			scene: 'sweep',
			hints: { mode: 'today' },
			duration: 24,
			controls: [co2, temp],
			body: `
<p>Here are the three marks that matter: 280 ppm before industry, 423 in 2024, and the slider's own value. At 423 ppm, average surface water has lost about a quarter of its pre-industrial carbonate ion and its hydrogen ions have risen by about 40%, enough to measure: at Station ALOHA north of Hawaiʻi, where surface water has been sampled since 1988, the pH falls by close to 0.002 every year.</p>
<p>With its temperature, salinity and alkalinity fixed, the surface water's chemistry is set by the air. Gas exchange lets it follow the air's CO₂ within months to a year or so, and its carbonate ion goes with it: it comes back if the air's CO₂ comes down, and, over thousands of years, as dissolving seafloor carbonate and rock weathering return alkalinity.</p>`,
			notes: `<p>Station ALOHA is the Hawaii Ocean Time-series (HOT); Dore and others (<i>PNAS</i>, 2009) found surface pH falling by 0.0019 ± 0.0002 per year over 1988–2007, as fast as the rise in the air's CO₂ predicts. This page computes the chemistry from published constants and does not plot the station's measurements. It holds alkalinity and salinity fixed everywhere, so it shows the part of the change that comes from the air alone.</p>`
		}
	]
};
