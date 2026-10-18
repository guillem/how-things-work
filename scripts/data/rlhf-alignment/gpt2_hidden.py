"""
GPT-2 small's forward pass returning the final hidden states (after the last layer norm) at every
position as well as the next-token logits, for scripts/data/rlhf-alignment/build.py. The pass is
the one in scripts/data/language-models/gpt2.py (float32 numpy), which stops at the last position.
"""

import numpy as np


def forward(model, ids):
    """(hidden n x 768 after ln_f, logits of the last position as float64)."""
    W = model.W
    n = len(ids)
    assert n <= 1024
    x = W['wte.weight'][ids] + W['wpe.weight'][:n]
    mask = np.triu(np.full((n, n), -np.inf, dtype=np.float32), 1)

    def ln(x, g, b):
        m = x.mean(-1, keepdims=True)
        v = ((x - m) ** 2).mean(-1, keepdims=True)
        return (x - m) / np.sqrt(v + 1e-5) * g + b

    def gelu(x):
        return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))

    for l in range(12):
        p = f'h.{l}.'
        h = ln(x, W[p + 'ln_1.weight'], W[p + 'ln_1.bias'])
        qkv = h @ W[p + 'attn.c_attn.weight'] + W[p + 'attn.c_attn.bias']
        q, k, v = (m.reshape(n, 12, 64).transpose(1, 0, 2) for m in np.split(qkv, 3, axis=-1))
        s = q @ k.transpose(0, 2, 1) / np.float32(8) + mask
        a = np.exp(s - s.max(-1, keepdims=True))
        a /= a.sum(-1, keepdims=True)
        y = a @ v
        x = x + y.transpose(1, 0, 2).reshape(n, 768) @ W[p + 'attn.c_proj.weight'] + W[p + 'attn.c_proj.bias']
        h = ln(x, W[p + 'ln_2.weight'], W[p + 'ln_2.bias'])
        x = x + gelu(h @ W[p + 'mlp.c_fc.weight'] + W[p + 'mlp.c_fc.bias']) @ W[p + 'mlp.c_proj.weight'] + W[p + 'mlp.c_proj.bias']
    hid = ln(x, W['ln_f.weight'], W['ln_f.bias'])
    out = (hid[-1:] @ model.wteT)[0].astype(np.float64)
    assert np.isfinite(out).all() and np.isfinite(hid).all()
    return hid, out
