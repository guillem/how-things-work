<!-- batch msgbatch_01PSCmk2K7yX5fvTLPnXfMxz, claude-opus-5-5, submitted 2026-10-14T13:19:50.260Z, ~$1.11 in tokens + 5 web searches -->
# Review: convolution-vision

## Verdict
The page is ready after the fixes below. The model is correct: "same" convolution as cross-correlation, ReLU, 2 × 2 max pooling, a dense layer and softmax, an 11,274-parameter count that matches `SHAPES`, and 14 × 14 receptive fields. The MNIST preparation follows LeCun's description, and the narrative's numbers come from the stored constants. I decoded the second-layer patches the text names (filters 13, 5, 11, 14), and they match their descriptions. There is one factual error: the claim that without the ReLU "the layers would collapse into one" does not hold for this network, because max pooling sits between the layers. The most important behaviour fix is that the "centre and scale" toggle leaks into the other steps and makes the Draw step's caption false. The catalogue's "textures" rung is described with a citation but not shown, and nobody has raised that against the entry.

## Factual errors
- **medium**, steps.ts:214. The text says "As on the neural-networks page, without this bend the layers would collapse into one." That holds for stacked linear layers. Here, though, max pooling sits between the two convolutions, and max pooling is not linear, so even without the ReLU the network would not reduce to one layer. Replace with: "Without it a map could not tell an edge from its opposite, and two convolutions in a row, with nothing between them, would amount to a single larger one."
- **low**, steps.ts:244 and 245. The text says "The whole network has 11,274 weights" and "Most of the weights, 7,850". Both figures include the 34 biases (8 + 16 + 10). Fix: "11,274 weights and biases" and "7,850 of them are in the last layer".
- **low**, steps.ts:189. "Small detectors, a few dozen weights each" is true of the first layer (25 weights) but not the second (200). Fix: "small detectors, a few dozen to a few hundred weights each".
- **low**, steps.ts:176. The note says the division "follows GIMP's 'convolution matrix' filter". GIMP's Normalise option also adds an offset of 128 when the sum is 0, and an offset of 255 when it is negative; the page does neither. Fix: "is like the Normalise option of GIMP's 'convolution matrix' filter". Source: https://docs.gimp.org/2.10/en/gimp-filter-convolution-matrix.html
- Everything else checks out against sources:
  - MNIST: 70,000 digits, 60k/10k split, Census Bureau employees and high-school students, 20 × 20 box, centre of mass placed at the centre.
  - AlexNet: 5 convolutional layers, 60 million parameters, 1.2 million images, 1,000 classes.
  - Zeiler & Fergus: corners in layer 2, mesh textures in layer 3, dog faces and bird legs in layer 4, whole objects in layer 5.
  - Sobel 1968, 784² = 614,656, and the confusion pairs (9 read as 4, 8 times; 7 read as 2, 6 times).

## Model issues
- **medium**, scenes/shared.ts:78. `inputOf` honours `params.centre === false` for every select, not just `wrong`. If a reader switches centring off on "Where it goes wrong" and then returns to "Draw a digit" (or the layer steps) with "Your drawing", the network gets the uncentred image. Meanwhile PredictScene:96 still says "your drawing, centred and scaled like MNIST". I am assuming params are shared across steps, which the shared `digit` and drawing suggest. Fix: `const centred = id !== 'wrong' || params.centre !== false; const img = centred ? prepare(st) : drawAsIs(st);`
- **low**, steps.ts:59–60 and ConvScene.svelte:34–35. The shift slider goes to ±6 px. An MNIST digit's 20 px box, placed by centre of mass, can leave less than 6 px on one side, so ink is pushed off the edge. When that happens the map no longer "keeps its shape exactly", and the "both moved N px" marker (`x0Ink + dx`) is off. Fix: limit the slider to ±4 (`min: -4, max: 4`), or add "until it reaches the edge" to the text.
- The tests check real properties (flat-field behaviour of the presets, edge sign, shift equivariance, centre-of-mass placement, misreading without preparation). No other issues.

## Narrative and scene mismatches
- **low**, scenes/DeeperScene.svelte:51. The "layer 1 · edges" rung shows first-layer filters 1, 2 and 4. I decoded the weights: filter 2 is a noisy mixture, and filter 4 has only a partial diagonal pattern. Filters 1, 3, 5 and 7 are the clearly banded ones. Fix: `[0, 2, 4].map(...)`. I am moderately confident, because I only read the weights as numbers, not as the rendered images.
- **low**, steps.ts:202. "Most are bands of blue beside bands of orange … much like Sobel's" slightly overstates it: about half of the decoded filters are clean bands. Fix: "many are bands of blue beside bands of orange … rough edge detectors at several orientations."

## Catalogue requirements
- **medium**, Interaction "later ones to textures and object parts". The page shows parts of digits, from its own two-layer network. Textures and photo-object parts are only described, citing Zeiler & Fergus, and have no images. The page says so openly (steps.ts:270), but the catalogue rule says to question the entry rather than build something else. Fix: either propose changing the entry to "later ones to parts of digits, and (in larger networks, described) textures and object parts", or add precomputed top-activation patches from a small published photo network.
- **low**, Interaction "Slide a small editable filter across an image and see the output build up". The build-up animation only runs with the fixed Sobel filter (ConvScene.svelte:37). The editable filter only ever shows the finished map. Fix: in `edit` mode, let the reader drag or hover the window over the input and show the same arithmetic readout, reusing `window3` and `cv-sum`.
- The other requirements are met:
  - The Takeaway is visible in the shift step and the ladder scene.
  - The Needs entry is met by a small trained network running in the browser, with 99.09% accuracy on the MNIST test set and source attribution.
  - The prediction for a drawn digit carries a label.

## Clarity
- **low**, steps.ts:156 (Sobel definition) "measures how fast brightness changes". On this page ink = 1, and ink is drawn dark on the light theme, so "brightness" reads backwards. Fix: "how fast the pixel values change from left to right (top to bottom)".
- **low**, steps.ts:228. "One unit of this layer" uses "unit" without defining it. Fix: "one unit (one pixel of a feature map, i.e. one neuron) of this layer".
- **low**, steps.ts:171. "The pixel minus its neighbours' excess" is hard to parse. Fix: "five times the pixel minus its four neighbours: the pixel plus how much it stands out from them, so edges get a bright rim and a dark rim."

## Sources consulted
- Zeiler & Fergus, "Visualizing and Understanding Convolutional Networks", ECCV 2014: https://cs.nyu.edu/~fergus/papers/zeilerECCV2014.pdf
- Krizhevsky, Sutskever & Hinton, "ImageNet Classification with Deep Convolutional Neural Networks", NeurIPS 2012: https://proceedings.neurips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks.pdf
- MNIST preparation (20 × 20 box, centre of mass in 28 × 28), reproducing LeCun's description: https://academictorrents.com/details/323a0048d87ca79b68f12a6350a57776b6a3b7fb (original: http://yann.lecun.com/exdb/mnist/)
- MNIST origins (NIST SD-1/SD-3, Census Bureau employees, high-school students): https://en.wikipedia.org/wiki/MNIST_database
- GIMP Convolution Matrix documentation: https://docs.gimp.org/2.10/en/gimp-filter-convolution-matrix.html
- My own checks: I decoded the shipped first-layer weights and the PARTS patches for second-layer filters 5, 11, 13 and 14, and recomputed the receptive field (5 → 6 → 14 px).
