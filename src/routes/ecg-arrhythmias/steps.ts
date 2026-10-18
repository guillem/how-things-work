import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { AV_NONE } from './model';
import { CONTROL_DEFAULTS } from './scenarios';

const rate: Control = {
	type: 'range',
	id: 'rate',
	label: 'Sinus node rate',
	min: 40,
	max: 150,
	step: 5,
	default: CONTROL_DEFAULTS.rate,
	format: (v) => `${v} a minute`
};

const gradient: Control = {
	type: 'toggle',
	id: 'gradient',
	label: 'Cells excited last recover first',
	default: CONTROL_DEFAULTS.gradient,
	help: 'Off: every ventricular cell keeps its action potential for the same time.'
};

const av: Control = {
	type: 'range',
	id: 'av',
	label: 'AV node conduction',
	min: 0,
	max: 1,
	step: 0.05,
	default: CONTROL_DEFAULTS.av,
	format: (v) => (v < AV_NONE ? 'none (complete block)' : `${Math.round(v * 100)} %`),
	help: 'Lower is a sicker AV node: slower to conduct and slower to recover. At 0 it passes nothing.'
};

const coupling: Control = {
	type: 'range',
	id: 'coupling',
	label: 'Early beat, after the QRS',
	min: 200,
	max: 700,
	step: 10,
	default: CONTROL_DEFAULTS.coupling,
	format: (v) => `${v} ms`,
	help: 'Changing it starts the heart again. The early beats here come by themselves (see the text); the button adds one.'
};

const fire: Control = { type: 'action', id: 'fire', label: 'Early beat', action: 'Fire one' };

const slow: Control = {
	type: 'toggle',
	id: 'slow',
	label: 'Diseased ventricles: conduction 5× slower',
	default: CONTROL_DEFAULTS.slow
};

const scar: Control = {
	type: 'toggle',
	id: 'scar',
	label: 'A scar',
	default: CONTROL_DEFAULTS.scar
};

const patchy: Control = {
	type: 'toggle',
	id: 'patchy',
	label: 'Patchy recovery',
	default: CONTROL_DEFAULTS.patchy,
	help: 'Half of the ventricles’ patches keep their action potential twice as long.'
};

const shock: Control = { type: 'action', id: 'shock', label: 'Defibrillator', action: 'Shock' };

/**
 * Scenes: `sheet` (the sheet of heart muscle with its conduction system, painted by voltage,
 * beside the pseudo-ECG; `step.hints.focus` picks the side panel: 'wave' (lead II and one
 * cell's action potential), 'leads' (Einthoven's triangle with the heart's vector, leads I, II
 * and III) or 'rhythm' (lead II above a real MIT-BIH strip named by `step.hints.record`, with
 * the atria's and ventricles' rates)), and `records` (the five MIT-BIH excerpts with their
 * reference annotations). What each step runs is in `scenarios.ts`.
 */
export const spec: ExplainerSpec = {
	slug: 'ecg-arrhythmias',
	title: 'The ECG and arrhythmias',
	summary:
		'A sheet of heart muscle as an excitable medium, with a hand-built conduction system, and the pseudo-ECG read off it on Einthoven’s three leads. Slow the AV node until beats drop, fire an early beat into slowed, scarred tissue and watch a wave chase its own tail as tachycardia, let it break up into fibrillation, then shock it and let the sinus node take over. Real recordings from the MIT-BIH database alongside. An educational model, not a diagnostic tool.',
	chapters: [
		{ id: 'shadow', title: 'A wave and its shadow' },
		{ id: 'breaks', title: 'When the rhythm breaks' },
		{ id: 'reset', title: 'Resetting the rhythm' }
	],
	steps: [
		// ------------------------------------------------------------------ shadow
		{
			id: 'wave',
			chapter: 'shadow',
			title: 'A wave crosses a sheet of muscle',
			scene: 'sheet',
			hints: { focus: 'wave', record: 'sinus' },
			duration: 30,
			controls: [rate],
			body: `
<p>A heart muscle cell is excitable, like a <a href="../neurons/#threshold">neuron</a>: nudge its voltage past a threshold and it fires an action potential, then stays <dfn data-def="Unable to fire again until it has recovered; for a ventricular cell this lasts most of its 250–300 ms action potential.">refractory</dfn> until it recovers. Unlike a neuron's, its action potential lasts about a quarter of a second, and its cells are joined by gap junctions, so a firing cell excites its neighbours and a wave sweeps across the tissue.</p>
<p>Here is a sheet of such cells, each following the Aliev–Panfilov equations, a two-variable model of cardiac excitation. The <strong>sinus node</strong> at the top left fires 75 times a minute. Its wave crosses the <strong>atria</strong> in about 90 ms and stops at an insulating ring, the heart's fibrous skeleton. The only way through is the <strong>AV node</strong>, which conducts slowly and holds the wave back for about a tenth of a second while the atria finish emptying. Then the <strong>His bundle</strong> and the <strong>Purkinje fibres</strong>, four times faster than muscle, carry it to many points of the <strong>ventricles</strong> at once, which fire within about 80 ms.</p>
<p>On the right is lead II of the electrocardiogram this sheet would produce, and the voltage of one ventricular cell (the white dot). The <a href="../heart-circulation/#signal">P wave, the QRS and the T wave</a> are the atria firing, the ventricles firing and the ventricles recovering. Change the rate: the waves come closer together, and the ventricles follow one for one.</p>
<p><strong>This is a teaching model, not a diagnostic tool.</strong> It cannot read a real ECG, and nothing here should be used to judge one.</p>`,
			notes: `<p>The model: ∂u/∂t = ∇·(D∇u) − k·u(u − a)(u − 1) − u·v + I and ∂v/∂t = r(x, y)·ε(u, v)·(−v − k·u(u − b − 1)), with ε = ε₀ + μ₁v/(u + μ₂) (Aliev and Panfilov, <i>Chaos, Solitons & Fractals</i> 7:293, 1996; k = 8, a = 0.15, b = 0.1, ε₀ = 0.01, μ₁ = 0.11, μ₂ = 0.3). u is a scaled voltage, v a slow recovery variable, I a stimulus or the current from a junction; r(x, y) is the page's own recovery-rate multiplier, which sets the gradient of the second step and is halved in some patches on the fibrillation step; one model time unit is taken as 8 ms so that the action potential lasts about 280 ms. The sheet is 120 × 140 cells. Its layout, and the conduction system, are <strong>hand-built</strong>, not anatomy: the AV node, His bundle and Purkinje fibres are one-dimensional cables laid over the sheet, the Purkinje fibres hand the wave to the muscle at junctions, and the atria, AV node and His bundle pass it on one way only. Conduction speeds are set by D: about 0.9 cells per ms in the atria, 0.6 in the ventricles, 2 in the Purkinje fibres. Diffusion is solved implicitly, so a time step of 0.4 ms is stable.</p>`
		},
		{
			id: 'leads',
			chapter: 'shadow',
			title: 'The ECG is the wave’s shadow on three leads',
			scene: 'sheet',
			hints: { focus: 'leads' },
			duration: 30,
			controls: [gradient],
			body: `
<p>Electrodes on the skin do not see single cells. Where a wave front is crossing, excited tissue sits next to resting tissue, and current flows across the front; added over the whole heart, these fronts act like one electric <dfn data-def="A pair of equal and opposite charges a small distance apart; here, the net separation of current across all the wave fronts in the heart at one instant.">dipole</dfn>, the heart's vector (the arrow). It swings around as the wave moves.</p>
<p>A limb lead measures the voltage between two limbs, which reads the heart's vector projected onto the line between them: lead I across the shoulders, lead II from the right arm to the left leg, lead III from the left arm to the left leg, the sides of <strong>Einthoven's triangle</strong>. A wave moving towards a lead's positive end gives an upward deflection; one moving at right angles gives none. Because the three sides close, <strong>II = I + III</strong> at every instant (Einthoven's law), which the three traces obey.</p>
<p>The <strong>T wave</strong> is upright although recovery is the opposite of excitation. That is because cells in different regions keep their action potentials for different times, so the ventricles do not recover in the order they were excited: broadly, regions excited late recover early, and a recovery that runs the other way, with the opposite sign, deflects the same way. Turn that off, so that every cell keeps its action potential for the same time and recovers in the order it was excited, and the T wave turns upside down.</p>`,
			notes: `<p>The pseudo-ECG here is the sheet's net dipole, p = −Σ∇u over the tissue, each region weighted by its wall's thickness (the atria a fifth of the left ventricle, the right ventricle 0.4 of it), projected on the three limb-lead axes (0°, +60°, +120°). It is a far-field approximation of a flat sheet, not a model of a torso, and the millivolt scale is chosen to make the QRS about 1 mV. A real ECG adds the augmented limb leads and six chest leads, and its shapes depend on the heart's 3D anatomy and the body around it. Real ventricular recovery varies through the wall and across the heart, and mapping studies find gradients along several axes rather than one simple reversal of the activation order. This flat sheet represents those differences with one imposed gradient of action-potential length across the ventricles.</p>`
		},
		// ------------------------------------------------------------------ breaks
		{
			id: 'block',
			chapter: 'breaks',
			title: 'Too slow: block at the AV node',
			scene: 'sheet',
			hints: { focus: 'rhythm', record: 'block' },
			duration: 35,
			controls: [av],
			body: `
<p>Not every arrhythmia is fast. The AV node is a bottleneck by design, and when it is diseased (by age, scarring, some drugs) the wave gets stuck there. Lower its conduction and watch the PR interval, from the start of the P wave to the QRS:</p>
<ul>
<li><strong>First-degree block</strong>: the PR interval lengthens past 200 ms, but every P is still followed by a QRS.</li>
<li><strong>Second-degree block</strong>: the node has not recovered when the next wave arrives, so some P waves are not followed by a QRS. Here every other one is lost (2:1 block), and the ventricles beat at half the atria's rate. The real recording below, from the MIT-BIH database, shows 2:1 block in a patient: look for a P wave between the QRS complexes.</li>
<li><strong>Third-degree (complete) block</strong>: nothing gets through. The atria carry on at 75 a minute, and the ventricles would stop if a backup pacemaker in the His bundle did not fire on its own after 1.5 s of silence: about 40 a minute, with a narrow QRS, and no link between P and QRS.</li>
</ul>
<p>None of these is treated with a shock. Persistent complete block and Mobitz II block (see Go deeper) generally need a pacemaker when there is no reversible cause; first-degree block and some second-degree blocks in the AV node are watched rather than paced.</p>`,
			notes: `<p>Here the AV node's conduction and its recovery are scaled down together (its coupling and the rate of its recovery variable), so the degrees of block come in order as the slider goes down. Real second-degree block comes in two kinds: Wenckebach (Mobitz I), where the PR lengthens beat by beat until one P is dropped, usually in the AV node, and Mobitz II, where beats drop without warning, usually below it, in the His–Purkinje system. Real escape rhythms come from the AV junction (40–60 a minute, narrow QRS) or, if the block is lower, from the ventricles (20–40, wide QRS); the page's escape pacemaker is a simple timer in the His bundle.</p>`
		},
		{
			id: 'early',
			chapter: 'breaks',
			title: 'An early beat from the ventricles',
			scene: 'sheet',
			hints: { focus: 'rhythm', record: 'pvc' },
			duration: 30,
			controls: [coupling, fire],
			body: `
<p>Sometimes a spot of ventricular muscle fires on its own, before the next sinus beat: a <dfn data-def="Premature ventricular contraction: a beat that starts in the ventricles, early, rather than coming from the sinus node through the AV node.">premature ventricular contraction</dfn>. Its wave does not use the Purkinje fibres; it creeps through the muscle from the spot (marked with a ring), so the QRS is <strong>wide</strong>, over 120 ms, and oddly shaped, and no P wave comes before it. Most people have some: occasional isolated ones are usually benign in an otherwise healthy heart, though very frequent ones can, over time, weaken its pumping.</p>
<p>Here the spot fires after every third QRS, at the delay you choose; the button fires one more. Too early, and the muscle around it is still refractory: nothing happens. A little later, and the wave spreads through recovered muscle, and the sheet goes back to the sinus rhythm afterwards. The real recording shows a patient's ventricular premature beats alternating with normal ones (bigeminy).</p>
<p>In healthy muscle the wave cannot loop back on itself. A wave is as long as its speed times the time the tissue stays refractory: here about 0.6 cells per ms × 280 ms, some 170 cells, longer than the sheet is wide. Long before the wave could come round, everything behind it is still refractory, so it dies at the edges.</p>`,
			notes: `<p>The wavelength λ = conduction velocity × refractory period is the key length of re-entry (Wiener and Rosenblueth, 1946; Allessie and colleagues, 1977). In a healthy human ventricle, conduction at about 0.5 m/s and a refractory period of about 0.25 s give λ ≈ 12 cm, larger than the path around most of the ventricles. The early beat here is a stimulus applied to a small spot; real premature beats come from cells that fire on their own (abnormal automaticity) or from afterdepolarizations that trigger a new action potential (triggered activity). A fast rhythm can also come from such a focus firing again and again rather than from a loop.</p>`
		},
		{
			id: 'reentry',
			chapter: 'breaks',
			title: 'Too fast: a wave that chases its own tail',
			scene: 'sheet',
			hints: { focus: 'rhythm', record: 'vt' },
			duration: 40,
			controls: [slow, scar, coupling, fire],
			body: `
<p>Disease changes that. After a heart attack, the muscle around the dead tissue is patchy and conducts slowly; here the ventricles conduct five times slower and have a scar (dark). Their wave is now about 35 cells long, short enough to fit in a loop.</p>
<p>The same early beat, fired into tissue that has only partly recovered, can now go one way but not the other: on one side the tissue is still refractory and the wave is blocked; on the other it creeps forward. By the time it curls round, the blocked side has recovered, and the wave goes on turning. It becomes a <strong>spiral</strong>, or circles the scar, and every turn excites the whole ventricle: the ECG fills with wide, fast, regular complexes, about 180 a minute, while the atria carry on at 75. This is <strong>ventricular tachycardia</strong>, as in the real recording.</p>
<p>The dangerous fast rhythms are usually like this: not a faster pacemaker, but a wave that has found a loop. Turn the slowing off (or try another timing) and the same beat leaves nothing behind.</p>`,
			notes: `<p>Re-entry needs three things: a substrate where the wave is shorter than the available loop (slow conduction, a short refractory period, an obstacle such as a scar); a trigger (an early beat); and <strong>unidirectional block</strong>, which the early beat finds in tissue that is recovering unevenly. The window of timings that start re-entry is the vulnerable window. On this page the substrate is exaggerated: the sheet is much smaller, relative to its wave, than a heart is, so its disease has to slow conduction far more than real disease does to make room for a spiral. In real post-infarction tachycardia the circuit usually runs through a narrow channel of surviving muscle in the scar. Fast rhythms also arise from foci firing rapidly and from triggered activity; torsades de pointes, for example, starts from early afterdepolarizations.</p>`
		},
		{
			id: 'vf',
			chapter: 'breaks',
			title: 'Fibrillation: the spiral breaks up',
			scene: 'sheet',
			hints: { focus: 'rhythm', record: 'vfl' },
			duration: 40,
			controls: [patchy],
			body: `
<p>During a fast rotating rhythm, the wave comes back to each region every 300 ms or so, so any patch of muscle that recovers more slowly than its neighbours is still refractory when it comes. With <strong>patchy recovery</strong> (half the patches keep their action potential twice as long, as with an uneven blood supply), the front breaks on those patches, and each broken end curls into a new spiral. They wander, collide and break again.</p>
<p>That is <strong>ventricular fibrillation</strong>. No part of the ventricles moves in step with another, so the heart quivers and pumps nothing; without treatment it kills within minutes. The ECG loses its complexes and becomes an irregular wobble. The real trace shows ventricular flutter, a fast, nearly sinusoidal rhythm that often comes just before fibrillation.</p>
<p>Turn the patchiness off and the same beat makes the tachycardia of the step before: fewer, steadier waves.</p>`,
			notes: `<p>Two mechanisms are thought to sustain fibrillation, probably both at once in real hearts: many wandering wavelets (Moe, 1962) and a few fast "mother rotors" whose waves break up in heterogeneous tissue (Jalife, 2000). Steep restitution, the action potential shortening sharply when beats come close together, is another way spirals break (Weiss and colleagues). Small hearts fibrillate less readily than large ones: a sheet must be many wavelengths across to hold many wavelets (the critical-mass idea, Garrey, 1914).</p>`
		},
		// ------------------------------------------------------------------ reset
		{
			id: 'shock',
			chapter: 'reset',
			title: 'A shock stops the waves',
			scene: 'sheet',
			hints: { focus: 'rhythm' },
			duration: 40,
			controls: [shock],
			body: `
<p>A defibrillator does not restart a stopped heart: it terminates ventricular fibrillation (or pulseless ventricular tachycardia) so that an organized rhythm can resume. Here its effect is idealized: every cell of the sheet and its cables is raised to the excited voltage at once (real shocks polarize tissue unevenly). Cells that were resting fire; cells that were already excited or refractory are held there. For a moment there is no resting tissue anywhere for a wave to move into, so every spiral dies at once.</p>
<p>The sheet starts in fibrillation and shocks itself at 5 s (or press <em>Shock</em>). Then everything recovers together, and the ECG is quiet until the <strong>sinus node</strong>, which has kept firing all along, sends its next wave through the AV node, and the normal beat returns.</p>
<p>The diseased tissue is still there, so another early beat could start it all again; that is why survivors of cardiac arrest often get an implanted defibrillator.</p>`,
			notes: `<p>Real defibrillation is subtler than "every cell at once": the shock's field excites tissue unevenly, prolongs the refractoriness of cells caught in their action potential, and can itself start new spirals if it is too weak (the upper limit of vulnerability). Modern biphasic shocks need less energy. For ventricular fibrillation and pulseless ventricular tachycardia, the outcome depends mostly on how quickly the shock comes: historical estimates for witnessed arrests found survival falling by roughly 7–10 % for every minute before defibrillation when no CPR was given, and by roughly 3–4 % a minute with bystander CPR. That is why public automated defibrillators exist.</p>`
		},
		{
			id: 'flatline',
			chapter: 'reset',
			title: 'A flat line is not shockable',
			scene: 'sheet',
			hints: { focus: 'rhythm' },
			duration: 30,
			controls: [shock],
			body: `
<p>Films shock flat lines. Real resuscitation does not: <dfn data-def="No electrical activity in the heart at all: a flat line on the ECG.">asystole</dfn> is not a shockable rhythm, and an automated external defibrillator will not advise a shock for it.</p>
<p>Here the sinus node has stopped and no backup pacemaker fires. The sheet shocks itself at 2.5 s (or press <em>Shock</em>): every cell fires together and recovers together, which adds nothing but a blip as they recover, and then the line is flat again. A shock can only clear chaos so that a pacemaker can take over; with no pacemaker there is nothing to take over.</p>
<p>Asystole is treated with chest compressions and adrenaline, while looking for a cause; a slow rhythm like complete block, with a pacemaker.</p>`,
			notes: `<p>Resuscitation guidelines (for example the European Resuscitation Council's and the American Heart Association's) divide cardiac-arrest rhythms into shockable (ventricular fibrillation, pulseless ventricular tachycardia) and non-shockable (asystole, pulseless electrical activity). The page's synchronous excitation produces almost no ECG, because a dipole needs a front between excited and resting tissue; the small blip as the cells recover comes from their different action-potential lengths.</p>`
		},
		{
			id: 'records',
			chapter: 'reset',
			title: 'Real recordings',
			scene: 'records',
			duration: 40,
			body: `
<p>These are real ECGs: eight-second excerpts of five recordings from the <strong>MIT-BIH Arrhythmia Database</strong>, 30-minute recordings made at Boston's Beth Israel Hospital between 1975 and 1979 and annotated beat by beat by cardiologists (Moody and Mark, 2001; published on PhysioNet, Goldberger and colleagues, 2000, under the Open Data Commons Attribution License). Each shows the upper channel, a modified lead II, with the database's own labels over the beats.</p>
<p>Compare them with the sheet. The normal rhythm's narrow QRS and upright T; the premature beats, wide and without a P wave; the 2:1 block, with every other P wave left unanswered; the run of ventricular tachycardia, wide and regular; the ventricular flutter, a fast, smooth wave with no separate complexes.</p>
<p>The sheet is far simpler than a heart: two dimensions, a hand-built conduction system, one lead's worth of geometry. It still makes the main shapes, because an ECG is mostly the shadow of where the wave of excitation goes. <strong>Again: this page explains; it does not diagnose.</strong> Reading a real ECG takes all twelve leads, the patient and a trained clinician.</p>`,
			notes: `<p>Records used: 100 (normal sinus rhythm, from 0 s), 119 (ventricular bigeminy, from 21.5 s), 231 (2:1 AV block, from 98 s), 205 (ventricular tachycardia, from 1460 s) and 207 (ventricular flutter, from 247 s), downloaded from https://physionet.org/content/mitdb/1.0.0/ and converted by <code>scripts/data/ecg-arrhythmias/build-records.mjs</code> (MLII channel, averaged from 360 to 120 samples a second). Labels: N normal, V ventricular premature beat, R right bundle branch block beat, ! flutter wave, [ start of flutter or fibrillation, and the rhythm changes (N), (B) bigeminy, (BII) second-degree block, (VT), (VFL). Citation: Moody GB, Mark RG. The impact of the MIT-BIH Arrhythmia Database. <i>IEEE Eng in Med and Biol</i> 20(3):45–50 (2001); Goldberger AL et al. PhysioBank, PhysioToolkit, and PhysioNet. <i>Circulation</i> 101(23):e215–e220 (2000).</p>`
		}
	]
};
