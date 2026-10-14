// Checks the neural-network model: backpropagation against finite differences for every
// activation, what a single neuron can and cannot learn, how many hidden neurons the circle and
// the corners need, that a network without activations collapses into one neuron, and the
// training results the narrative quotes. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { rng } from '../src/lib/draw/math';
import {
	ACTIVATIONS,
	Run,
	accuracy,
	backward,
	collapseLinear,
	createNet,
	crossEntropy,
	dataset,
	forward,
	gradient,
	applyStep,
	predict,
	sigmoid,
	type Net
} from '../src/routes/neural-networks/network';

const lossOf = (net: Net, x: number[], y: number) => {
	const { z } = forward(net, x);
	return crossEntropy(z[z.length - 1][0], y);
};

test('backpropagation gives the same slopes as nudging each weight (finite differences)', () => {
	const rand = rng(5);
	const h = 1e-6;
	for (const act of ACTIVATIONS) {
		for (const hidden of [[], [3], [4, 3], [2, 2, 2]]) {
			const net = createNet([2, ...hidden, 1], act, 3);
			// Make the biases non-zero too, so their slopes are tested away from the start.
			net.b.forEach((b) => b.forEach((_, i) => (b[i] = rand() - 0.5)));
			for (let k = 0; k < 3; k++) {
				const x = [2 * rand() - 1, 2 * rand() - 1];
				const y = k % 2;
				const g = backward(net, forward(net, x), y);
				const check = (arr: Float64Array, grad: Float64Array, what: string) => {
					for (let i = 0; i < arr.length; i++) {
						const keep = arr[i];
						arr[i] = keep + h;
						const up = lossOf(net, x, y);
						arr[i] = keep - h;
						const down = lossOf(net, x, y);
						arr[i] = keep;
						const fd = (up - down) / (2 * h);
						const scale = Math.max(1e-3, Math.abs(fd), Math.abs(grad[i]));
						expect(
							Math.abs(fd - grad[i]) / scale,
							`${act} [${hidden.join(',')}] ${what}[${i}]`
						).toBeLessThan(1e-6);
					}
				};
				net.W.forEach((w, l) => check(w, g.gW[l], `W${l}`));
				net.b.forEach((b, l) => check(b, g.gb[l], `b${l}`));
			}
		}
	}
});

test('the output error is p − y, and a 50/50 guess costs ln 2 = 0.693', () => {
	const net = createNet([2, 1], 'tanh', 1);
	const x = [0.3, -0.7];
	const fw = forward(net, x);
	const p = fw.a[1][0];
	expect(backward(net, fw, 1).delta[0][0]).toBeCloseTo(p - 1, 12);
	expect(backward(net, fw, 0).delta[0][0]).toBeCloseTo(p, 12);
	expect(crossEntropy(0, 1)).toBeCloseTo(Math.LN2, 12);
	expect(crossEntropy(0, 0)).toBeCloseTo(0.693, 3);
	// Large sums stay finite and match −log p.
	expect(crossEntropy(40, 0)).toBeCloseTo(40, 6);
	expect(crossEntropy(-3, 1)).toBeCloseTo(-Math.log(sigmoid(-3)), 12);
});

test('one step against the gradient lowers the loss on that example', () => {
	const net = createNet([2, 2, 1], 'tanh', 1);
	const e = dataset('xor')[0];
	const before = lossOf(net, [e.x, e.y], e.label);
	applyStep(net, gradient(net, [e]), 0.5);
	expect(lossOf(net, [e.x, e.y], e.label)).toBeLessThan(before);
});

test('a single neuron separates the two clusters but not the corners or the circle', () => {
	const clusters = new Run({ data: 'clusters', hidden: [], act: 'tanh', lr: 0.3, seed: 1 });
	expect(clusters.solvedAt(20)).toBeGreaterThanOrEqual(0);
	for (const data of ['xor', 'circle'] as const) {
		const run = new Run({ data, hidden: [], act: 'tanh', lr: 0.3, seed: 1 });
		run.at(300);
		// A straight line can get at most three of the four corners right.
		expect(Math.max(...run.accuracies), data).toBeLessThan(0.76);
		// Its loss stays near that of a 50/50 guess.
		expect(run.losses[300], data).toBeGreaterThan(0.65);
	}
});

test('two hidden neurons solve the corners; the circle needs three', () => {
	const xor = new Run({ data: 'xor', hidden: [2], act: 'tanh', lr: 0.3, seed: 1 });
	expect(xor.solvedAt(100)).toBe(17);
	const circle2 = new Run({ data: 'circle', hidden: [2], act: 'tanh', lr: 0.3, seed: 1 });
	circle2.at(300);
	expect(Math.max(...circle2.accuracies)).toBeLessThan(0.9);
	const circle3 = new Run({ data: 'circle', hidden: [3], act: 'tanh', lr: 0.3, seed: 1 });
	expect(circle3.solvedAt(200)).toBe(64);
});

test('an unlucky start can get stuck: the corners with seed 2 stays at 75%', () => {
	const run = new Run({ data: 'xor', hidden: [2], act: 'tanh', lr: 0.3, seed: 2 });
	run.at(500);
	// Three corners right, one wrong: a local minimum of the loss.
	expect(Math.max(...run.accuracies)).toBeLessThan(0.8);
	expect(run.accuracies[500]).toBeCloseTo(0.75, 2);
});

test('without activations, layers collapse into one neuron and draw a straight line', () => {
	const run = new Run({ data: 'circle', hidden: [8, 8], act: 'linear', lr: 0.1, seed: 1 });
	const net = run.at(200);
	const { w, b } = collapseLinear(net);
	const rand = rng(9);
	for (let k = 0; k < 20; k++) {
		const x = [2 * rand() - 1, 2 * rand() - 1];
		expect(predict(net, x)).toBeCloseTo(sigmoid(w[0] * x[0] + w[1] * x[1] + b), 10);
	}
	expect(Math.max(...run.accuracies)).toBeLessThan(0.7);
});

test('the spiral needs depth: one layer of 8 fails, three layers of 8 succeed', () => {
	const shallow = new Run({ data: 'spiral', hidden: [8], act: 'relu', lr: 0.1, seed: 1 });
	shallow.at(300);
	expect(Math.max(...shallow.accuracies)).toBeLessThan(0.75);
	const deep = new Run({ data: 'spiral', hidden: [8, 8, 8], act: 'relu', lr: 0.1, seed: 1 });
	expect(deep.solvedAt(300)).toBe(231);
	expect(deep.losses[231]).toBeLessThan(deep.losses[0] / 5);
});

test('runs are deterministic, and the datasets are balanced and inside the plane', () => {
	const a = new Run({ data: 'circle', hidden: [4], act: 'relu', lr: 0.3, seed: 1 });
	const b = new Run({ data: 'circle', hidden: [4], act: 'relu', lr: 0.3, seed: 1 });
	expect(accuracy(a.at(10), a.data)).toBe(accuracy(b.at(10), b.data));
	expect(a.losses[10]).toBe(b.losses[10]);
	for (const id of ['clusters', 'xor', 'circle', 'spiral'] as const) {
		const d = dataset(id);
		expect(d.length).toBe(200);
		expect(d.filter((e) => e.label === 1).length).toBe(100);
		for (const e of d) {
			expect(Math.abs(e.x)).toBeLessThan(1);
			expect(Math.abs(e.y)).toBeLessThan(1);
		}
	}
});
