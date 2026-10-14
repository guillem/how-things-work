/**
 * Backpropagation through the denoising network of src/routes/diffusion-models/ddpm.ts, for the
 * training script (train.mjs). The forward pass is the page's own (`forward` in ddpm.ts, with
 * `keep` on); the backward pass below is written out by hand and checked against finite
 * differences by `train.mjs --gradcheck`.
 *
 * Loss: the mean over the batch and the D coordinates of w · (x̂₀ − x₀)², with w = min(SNR_t, 5)
 * per example (see ddpm.ts): the min-SNR-weighted noise-prediction loss.
 */
import { forward, shapes, unflatten } from '../../../src/routes/diffusion-models/ddpm.ts';

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/**
 * Adds to `gflat` (a flat gradient laid out like the weights) the gradient of the loss of the
 * batch (x [B][D], ts, labels, clean data x0 [B][D], weights w [B]); returns the loss.
 */
export function backprop(wt, gflat, x, ts, labels, x0, w) {
	const { D, H, E, blocks } = wt.cfg;
	const g = unflatten(wt.cfg, gflat);
	const B = ts.length;
	const I = D + 2 * E;
	const C = 2 * E;
	const a = forward(wt, x, ts, labels, true);
	let loss = 0;
	const dout = new Float32Array(B * D);
	const k = 2 / (B * D);
	for (let i = 0; i < B * D; i++) {
		const wn = w[Math.floor(i / D)];
		const e = a.out[i] - x0[i];
		loss += wn * e * e;
		dout[i] = k * wn * e;
	}
	loss /= B * D;

	// output layer
	accOuter(g.wout, g.bout, dout, B, D, a.h[blocks], H, 0, H);
	const dh = new Float32Array(B * H);
	backIn(dh, H, 0, dout, B, D, wt.wout, H);
	const dc = new Float32Array(B * C);
	// blocks, last first: h_{k+1} = h_k + SiLU(z_k), z_k = W_k h_k + U_k c + b_k
	for (let b = blocks - 1; b >= 0; b--) {
		const z = a.z[b];
		const dz = new Float32Array(B * H);
		for (let i = 0; i < B * H; i++) {
			const s = sigmoid(z[i]);
			dz[i] = dh[i] * s * (1 + z[i] * (1 - s));
		}
		accOuter(g.w[b], g.b[b], dz, B, H, a.h[b], H, 0, H);
		accOuter(g.u[b], null, dz, B, H, a.inp, I, D, C);
		backIn(dh, H, 0, dz, B, H, wt.w[b], H);
		backIn(dc, C, 0, dz, B, H, wt.u[b], C);
	}
	// input layer: h_0 = W_in [x, c] + b_in
	accOuter(g.win, g.bin, dh, B, H, a.inp, I, 0, I);
	// gradient on the condition through W_in's last 2E columns
	for (let n = 0; n < B; n++)
		for (let j = 0; j < H; j++) {
			const s = dh[n * H + j];
			if (s === 0) continue;
			const wo = j * I + D;
			for (let i = 0; i < C; i++) dc[n * C + i] += s * wt.win[wo + i];
		}
	// the label embedding is the condition's second half
	for (let n = 0; n < B; n++) {
		const eo = labels[n] * E;
		for (let i = 0; i < E; i++) g.emb[eo + i] += dc[n * C + E + i];
	}
	return loss;
}

/** gW[j][i] += Σ_n dY[n][j] · X[n][off + i]; gB[j] += Σ_n dY[n][j]. */
function accOuter(gW, gB, dY, B, J, X, stride, off, len) {
	for (let j = 0; j < J; j++) {
		const wo = j * len;
		let sb = 0;
		for (let n = 0; n < B; n++) {
			const s = dY[n * J + j];
			if (s === 0) continue;
			sb += s;
			const xo = n * stride + off;
			for (let i = 0; i < len; i++) gW[wo + i] += s * X[xo + i];
		}
		if (gB) gB[j] += sb;
	}
}

/** dX[n][off + i] += Σ_j dY[n][j] · W[j][i]. */
function backIn(dX, stride, off, dY, B, J, W, len) {
	for (let n = 0; n < B; n++) {
		const xo = n * stride + off;
		for (let j = 0; j < J; j++) {
			const s = dY[n * J + j];
			if (s === 0) continue;
			const wo = j * len;
			for (let i = 0; i < len; i++) dX[xo + i] += s * W[wo + i];
		}
	}
}

/** Initial weights: scaled normal (fan-in), residual blocks started small, biases 0. */
export function initWeights(cfg, gauss) {
	const flat = new Float32Array(shapes(cfg).reduce((n, [, s]) => n + s, 0));
	let o = 0;
	const I = cfg.D + 2 * cfg.E;
	for (const [name, size] of shapes(cfg)) {
		let sd = 0;
		if (name === 'win') sd = Math.sqrt(1 / I);
		else if (name === 'emb') sd = 1;
		else if (/^w\d/.test(name)) sd = Math.sqrt(1 / cfg.H) * 0.5;
		else if (/^u\d/.test(name)) sd = Math.sqrt(1 / (2 * cfg.E)) * 0.5;
		else if (name === 'wout') sd = Math.sqrt(1 / cfg.H);
		for (let i = 0; i < size; i++) flat[o + i] = sd ? gauss() * sd : 0;
		o += size;
	}
	return flat;
}
