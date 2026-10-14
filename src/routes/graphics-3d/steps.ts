import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const deg = (v: number) => `${Math.round(v)}°`;

const az: Control = {
	type: 'range',
	id: 'az',
	label: 'Camera: round the scene',
	min: -180,
	max: 180,
	step: 1,
	default: 20,
	format: deg,
	help: 'Or drag the camera on the map.'
};
const el: Control = {
	type: 'range',
	id: 'el',
	label: 'Camera: height',
	min: 8,
	max: 70,
	step: 1,
	default: 26,
	format: deg,
	help: 'Angle above the floor, seen from the middle of the scene.'
};
const dist: Control = {
	type: 'range',
	id: 'dist',
	label: 'Camera: distance',
	min: 6.5,
	max: 8,
	step: 0.1,
	default: 7,
	format: (v) => v.toFixed(1)
};
const fov: Control = {
	type: 'range',
	id: 'fov',
	label: 'Field of view',
	min: 20,
	max: 90,
	step: 1,
	default: 45,
	format: deg,
	help: 'How wide the camera sees, top to bottom: a wide angle or a zoom lens.'
};
const lightAz: Control = {
	type: 'range',
	id: 'lightAz',
	label: 'Light: round the scene',
	min: -180,
	max: 180,
	step: 1,
	default: -45,
	format: deg,
	help: 'Or drag the lamp on the map (towards the middle to raise it).'
};
const lightEl: Control = {
	type: 'range',
	id: 'lightEl',
	label: 'Light: height',
	min: 10,
	max: 85,
	step: 1,
	default: 40,
	format: deg
};
const cubeTurn: Control = {
	type: 'range',
	id: 'cubeTurn',
	label: 'Turn the cube',
	min: 0,
	max: 90,
	step: 1,
	default: 25,
	format: deg
};
const zbuffer: Control = {
	type: 'toggle',
	id: 'zbuffer',
	label: 'Depth test (z-buffer)',
	default: true,
	help: 'Off: every triangle is painted in the order it comes, over whatever is already there.'
};
const shading: Control = {
	type: 'select',
	id: 'shading',
	label: 'Shading',
	default: 'phong',
	options: [
		{ value: 'none', label: 'None: flat colour' },
		{ value: 'lambert', label: 'Lambert: matte' },
		{ value: 'phong', label: 'Lambert + Phong highlight' }
	]
};
const texture: Control = {
	type: 'toggle',
	id: 'texture',
	label: 'Floor texture',
	default: true
};
const perspectiveCorrect: Control = {
	type: 'toggle',
	id: 'perspectiveCorrect',
	label: 'Perspective-correct texture',
	default: true,
	help: 'Off: texture coordinates are blended evenly across the screen, ignoring depth.'
};
const shadows: Control = {
	type: 'toggle',
	id: 'shadows',
	label: 'Shadow rays',
	default: true
};
const bounces: Control = {
	type: 'range',
	id: 'bounces',
	label: 'Bounce limit',
	min: 0,
	max: 6,
	step: 1,
	default: 3,
	help: 'How many reflections or refractions each ray may follow.'
};

const camera = [az, el, dist];
const lights = [lightAz, lightEl];

export const spec: ExplainerSpec = {
	slug: 'graphics-3d',
	title: '3D graphics',
	summary:
		'Move a camera and a lamp round a small scene and watch it become a picture two ways: projecting its triangles onto the screen and filling them pixel by pixel, or shooting a ray through every pixel and following its bounces off a mirror and through glass.',
	chapters: [
		{ id: 'scene', title: 'A scene made of numbers' },
		{ id: 'raster', title: 'Rasterising: triangles onto pixels' },
		{ id: 'trace', title: 'Ray tracing: back along the light' },
		{ id: 'compare', title: 'Fast or faithful' }
	],
	steps: [
		// ------------------------------------------------------------------ scene
		{
			id: 'triangles',
			chapter: 'scene',
			title: 'Everything is triangles',
			scene: 'world',
			hints: { phase: 'mesh' },
			duration: 20,
			controls: camera,
			body: `
<p>A film studio's dragon and this page's little scene are stored the same way: as a long list of <strong>triangles</strong>. Each triangle is three corners, or <dfn data-def="A corner of a triangle in a 3D model, stored as three numbers (x, y, z), often with extra numbers such as a direction for shading and a place on a texture.">vertices</dfn>, and each vertex is three numbers: how far along x, up y and towards you z it sits.</p>
<p>The scene here has a floor (2 triangles), a cube (12: two for each face) and two balls of 320 triangles each, 654 in all. A curved surface is only an approximation: each ball is an <dfn data-def="A sphere made from an icosahedron (20 triangles) by splitting every triangle into four, and pushing the new corners out onto the sphere; twice gives 320 triangles.">icosphere</dfn>, a twenty-sided die whose faces were split into four, twice.</p>
<p>The map on the left shows the scene from above, with the camera. Drag the camera round, or use the sliders: the wireframe on the right shows every edge as the camera sees it.</p>`,
			notes: `<p>Why triangles? Three points always lie in one flat plane, so a triangle can never be bent or twisted, and the inside of a triangle is easy to test. Any surface can be cut into triangles, finer where it curves. A character in a modern game is tens of thousands of triangles; a frame of a film can hold billions.</p>`
		},
		{
			id: 'model',
			chapter: 'scene',
			title: 'Placing an object: the model matrix',
			scene: 'world',
			hints: { phase: 'model' },
			duration: 22,
			controls: [cubeTurn],
			body: `
<p>The cube is stored once, as a unit cube centred on its own origin. To place it in the scene, every vertex is <strong>scaled</strong> (to 1.2 wide), <strong>turned</strong> and <strong>moved</strong>. In <a href="../linear-transformations/">linear transformations</a>, a matrix turned and stretched the plane; turning and scaling in 3D are 3 × 3 matrices in the same way.</p>
<p>Moving is the problem: a matrix always leaves the origin where it is, so no 3 × 3 matrix can shift things. The trick is <dfn data-def="Writing a 3D point with a fourth number w = 1, as (x, y, z, 1), so that a 4 × 4 matrix can move it as well as turn and scale it.">homogeneous coordinates</dfn>: write each point with a fourth number, (x, y, z, <strong>1</strong>), and use 4 × 4 matrices. The last column then adds a fixed amount to x, y and z: a move.</p>
<p>Turn the cube with the slider. The <dfn data-def="The matrix that takes an object from its own coordinates to the scene's: its size, turn and position in one 4 × 4 matrix.">model matrix</dfn> below changes, and so does where one corner lands. Multiplying the scale, turn and move matrices together (<a href="../linear-transformations/#compose">one after another</a>) gives this single matrix.</p>`
		},
		{
			id: 'view',
			chapter: 'scene',
			title: 'Moving the world in front of the camera: the view matrix',
			scene: 'world',
			hints: { phase: 'view' },
			duration: 22,
			controls: camera,
			body: `
<p>A camera can't easily look at points scattered in the scene. So graphics does the opposite: it moves and turns the <em>whole world</em> so that the camera sits at the origin, looking straight down its −z axis, with y up. That is one more 4 × 4 matrix, the <dfn data-def="The matrix that moves and turns the world so that the camera is at the origin, looking down −z.">view matrix</dfn>.</p>
<p>Its first three rows are the camera's own right, up and backward directions, and its last column undoes the camera's position. Drag the camera: the matrix and the corner's camera coordinates change. Now the corner's −z is simply its distance in front of the camera.</p>`
		},
		{
			id: 'perspective',
			chapter: 'scene',
			title: 'Perspective: divide by the distance',
			scene: 'world',
			hints: { phase: 'project' },
			duration: 24,
			controls: [fov, ...camera],
			body: `
<p>Far things look small: a point twice as far away lands twice as close to the middle of the picture. In numbers, the screen position is the sideways distance <strong>divided by the depth</strong>, x / d.</p>
<p>A matrix can only multiply and add, not divide, so the <dfn data-def="The matrix that squeezes what the camera sees into a cube from −1 to 1, and copies each point's depth into its fourth number w.">projection matrix</dfn> copies the depth into the fourth number, w. Afterwards the computer divides x, y and z by w: the <dfn data-def="Dividing a point's x, y and z by its w after the projection matrix. This is what makes far things smaller.">perspective divide</dfn>. What remains between −1 and 1 is inside the picture, and is finally scaled to pixels.</p>
<p>Change the field of view. A narrow one (a zoom lens) makes the scene fill the picture and flattens it; a wide one shows more and stretches what is near the edges. The map shows the camera's wedge of view.</p>`,
			notes: `<p>The full chain for every vertex is <strong>projection × view × model × (x, y, z, 1)</strong>. Because matrices can be multiplied together first, a graphics card works out that product once per object and then applies it to every vertex: millions of identical little 4 × 4 multiplications, which is exactly what its thousands of simple cores are good at.</p><p>The projection also keeps a depth number, z / w, between −1 (the near plane) and 1 (the far plane). The next chapter needs it.</p>`
		},
		// ------------------------------------------------------------------ raster
		{
			id: 'coverage',
			chapter: 'raster',
			title: 'Which pixels does a triangle cover?',
			scene: 'pixels',
			hints: { phase: 'cover' },
			duration: 22,
			body: `
<p>After the projection, each triangle is three points on the screen. Now the computer must decide which <dfn data-def="One small square of the picture, with one colour. The picture on this page is 192 pixels wide and 120 high.">pixels</dfn> it covers. It takes the box round the triangle and tests the centre of each pixel in it.</p>
<p>For each edge, a quick sum (a 2D cross product) tells which side of the edge a point is on: its <dfn data-def="For an edge from a to b, (b − a) × (p − a): positive when p is on one side of the edge, negative on the other, zero on it.">edge function</dfn>. A pixel is inside when it is on the inner side of all three edges. Drag the corners of the triangle; the scan shows each tested pixel and the three signs.</p>
<p>Turning shapes into pixels like this is called <dfn data-def="Turning shapes described by numbers (triangles, lines, letters) into the grid of pixels of a picture.">rasterisation</dfn>. Every pixel can be tested at the same time, independently of the others: that is why it suits a graphics card.</p>`,
			notes: `<p>The three edge-function values, divided by the triangle's area, are the pixel's <dfn data-def="Three weights that add up to 1 and say how close a point is to each corner of a triangle.">barycentric coordinates</dfn>: how much of each corner the pixel is made of. They are used to blend anything stored at the corners (depth, colour, direction, texture position) across the triangle.</p>`
		},
		{
			id: 'zbuffer',
			chapter: 'raster',
			title: 'The z-buffer: nearest wins',
			scene: 'raster',
			hints: { phase: 'zbuffer' },
			duration: 22,
			controls: [zbuffer, ...camera],
			body: `
<p>Triangles arrive in any order, and many land on the same pixel: the front and the back of a ball, the floor under the cube. Which one should you see? The nearest.</p>
<p>The <dfn data-def="A second picture, the size of the real one, that stores for every pixel the depth of the nearest surface drawn there so far.">z-buffer</dfn> keeps, for every pixel, the depth of the nearest surface drawn so far (shown below: dark is near). A new piece of triangle is drawn only if it is nearer than what is there; otherwise it is thrown away.</p>
<p>Switch the depth test off: the triangles are painted in the order they come, floor first, and each one covers what was there. The cube's far faces and the balls' back halves come out on top.</p>`,
			notes: `<p>Real graphics cards also skip triangles that face away from the camera (<dfn data-def="Skipping triangles seen from behind, which on a closed object are always hidden by its front.">back-face culling</dfn>), which halves the work on closed objects. This page leaves them in, so that switching the z-buffer off shows its full effect.</p>`
		},
		{
			id: 'shading',
			chapter: 'raster',
			title: 'How bright? Lambert and Phong',
			scene: 'raster',
			hints: { phase: 'shading' },
			duration: 24,
			controls: [shading, ...lights],
			body: `
<p>Each covered pixel now needs a colour. The simplest rule, <strong>Lambert's law</strong>, says a matte surface is lit in proportion to the cosine of the angle between its <dfn data-def="The direction pointing straight out of a surface. Here it is stored at each vertex and blended across the triangle, so a ball made of flat triangles looks smooth.">normal</dfn> n and the direction to the lamp l: brightness = n · l. A surface turned 60° away gets half the light; turned 90° or more, none.</p>
<p>Shiny things also show a <strong>highlight</strong>. Bui Tuong Phong's 1975 recipe: reflect the lamp's direction in the surface, as a mirror would (<a href="../light-optics/#mirror">angle in = angle out</a>), and see how close that reflection points to the eye. Raised to a high power, the closeness gives a small bright spot.</p>
<p>Try the three shading settings and move the lamp. Click a pixel to read its numbers. A small constant (<dfn data-def="A fixed amount of light added everywhere, standing in for the light bounced around the room, which this kind of shading doesn't follow.">ambient</dfn> light) keeps the dark sides from being black.</p>`,
			notes: `<p>Phong's model is not physics: it is a cheap curve that looks right. Today's games use "physically based" formulas that keep the energy books balanced, but the idea is the same: a few vectors at each pixel (normal, light, eye) and a formula. The ambient term here is 0.12 of full light; the lamp is a point with no fall-off with distance.</p>`
		},
		{
			id: 'texture',
			chapter: 'raster',
			title: 'Texture mapping',
			scene: 'raster',
			hints: { phase: 'texture' },
			duration: 22,
			controls: [texture, perspectiveCorrect, ...camera],
			body: `
<p>The floor is only two triangles, yet it is covered with a chessboard. Each vertex also stores a position (u, v) on an image, the <dfn data-def="An image wrapped onto a surface. Each vertex says where on the image it sits, and each pixel looks up its colour there.">texture</dfn>, and every pixel looks up its colour there. Detail costs pixels, not triangles.</p>
<p>The (u, v) of a pixel is blended from the three corners. But blending evenly across the <em>screen</em> is wrong, because the far half of the floor is squeezed into fewer pixels. Switch <strong>perspective-correct</strong> off and see the squares bend along the line between the two triangles.</p>
<p>The fix is the same w as before: blend u/w, v/w and 1/w across the screen, which <em>are</em> even there, and divide at each pixel.</p>`,
			notes: `<p>The first PlayStation (1994) drew textures without this correction, which is why its floors and walls wobbled as the camera moved. Real renderers also blend between smaller copies of a texture (<dfn data-def="Pre-shrunk copies of a texture at half, quarter… size, chosen by how big the texture appears, to avoid flicker in the distance.">mipmaps</dfn>) so that far-away squares don't flicker; this page just takes the nearest texel.</p>`
		},
		{
			id: 'rasterised',
			chapter: 'raster',
			title: "The rasteriser's picture",
			scene: 'raster',
			hints: { phase: 'raster' },
			duration: 22,
			controls: [...camera, ...lights],
			body: `
<p>That is the whole pipeline: matrices place every vertex on the screen, edge functions find the pixels, the z-buffer keeps the nearest, and a formula shades each pixel. The counters show the work: from the starting view, 654 triangles and about 50,000 pixel tests for a picture of 192 × 120 = 23,040 pixels. A graphics card does the same for pictures of millions of pixels, sixty times a second.</p>
<p>Now look closely. The lamp lights the floor, but <strong>nothing casts a shadow</strong>. The mirror ball shows no reflection: it is just shiny grey. The glass ball is opaque. Each triangle was drawn knowing only itself, the camera and the lamp, never the rest of the scene.</p>`,
			notes: `<p>Games fake what is missing with extra passes: a shadow map (the scene rendered once more from the lamp, as a z-buffer, to see what the lamp can reach), environment maps (a picture of the surroundings pasted on shiny things), screen-space reflections. They are fast, clever and imperfect, and much of a game engine is made of them.</p>`
		},
		// ------------------------------------------------------------------ trace
		{
			id: 'rays',
			chapter: 'trace',
			title: 'One ray through every pixel',
			scene: 'trace',
			hints: { phase: 'rays' },
			duration: 22,
			controls: camera,
			body: `
<p>Turn the question round. Instead of asking where each triangle lands, ask, for each pixel: <strong>what would I see if I looked through it?</strong> Shoot a <dfn data-def="A half-line: a starting point and a direction. A ray tracer follows it until it hits the nearest surface.">ray</dfn> from the eye through the pixel's centre and find the nearest triangle it hits.</p>
<p>Light really travels the other way, from the lamp to the eye. But light paths can be followed in either direction (<a href="../light-optics/">light and optics</a>), and almost all the light leaving a lamp misses the camera. Starting at the eye follows only the rays that matter.</p>
<p>Watch the picture fill row by row: one ray per pixel, 23,040 rays. The map shows the ray through the pixel you picked (click the picture to pick another). Every pixel finds the same surface as the rasteriser did, shaded with the same formula. Only the mirror and the glass look dark: their colour is meant to come from rays this tracer doesn't follow yet.</p>`,
			notes: `<p>Testing a ray against a triangle is a few dozen multiplications (this page uses the Möller–Trumbore test). The hard part is the number of tests. Testing every ray against every triangle would be hopeless for a film scene, so ray tracers sort the triangles into nested boxes (a <dfn data-def="Bounding volume hierarchy: boxes inside boxes round groups of triangles. A ray that misses a box skips everything inside it.">BVH</dfn>). This page uses the simplest version: one invisible ball round each object, tested first.</p>`
		},
		{
			id: 'shadows',
			chapter: 'trace',
			title: 'Shadow rays',
			scene: 'trace',
			hints: { phase: 'shadows' },
			duration: 22,
			controls: [shadows, ...lights],
			body: `
<p>A ray tracer can ask a question the rasteriser could not: <strong>can this point see the lamp?</strong> From the point a ray hits, send a second ray, a <dfn data-def="A ray from a surface point towards a light. If it hits something on the way, the point is in shadow.">shadow ray</dfn>, towards the lamp. If anything is in the way, the point gets only the ambient light.</p>
<p>Move the lamp: the shadows swing round and stretch when it is low. Switch shadow rays off and they vanish: the floor and the cube are then exactly the rasteriser's again. On the map, the shadow ray of the picked pixel is drawn to the lamp, and ends in a cross where it is blocked.</p>`,
			notes: `<p>The shadows here have hard edges because the lamp is a single point. A real lamp has a size, so near the edge of a shadow part of it is hidden: a soft half-shadow. Ray tracers get that by sending many shadow rays to random points on the lamp and averaging.</p><p>Simplification: the glass ball casts a full shadow here. Real glass focuses light into a bright spot (a caustic), which needs light followed from the lamp too.</p>`
		},
		{
			id: 'bounces',
			chapter: 'trace',
			title: 'Mirrors and glass: follow the bounce',
			scene: 'trace',
			hints: { phase: 'bounces' },
			duration: 26,
			controls: [bounces, ...camera],
			body: `
<p>When a ray hits the mirror ball, what you see there is whatever the <em>reflected</em> ray sees: so the tracer sends a new ray in the mirror direction, angle in equal to angle out, and follows it. When it hits glass, it splits: a little is reflected and most goes in, bent by <a href="../light-optics/#snell">Snell's law</a> (refractive index 1.5), and bent again on the way out.</p>
<p>The <strong>bounce limit</strong> says how many such turns a ray may follow; a ray that reaches the limit returns black. At 0 the mirror is dark and the glass is black. At 1 the mirror shows the sky and the floor, but the glass is still dark inside: light needs two refractions to get through it, in and out. Raise it further and reflections of reflections appear, in the mirror's view of the glass ball.</p>
<p>The map shows every ray followed for the pixel you picked: try the middle of the glass ball.</p>`,
			notes: `<p>This recipe, eye rays plus shadow rays plus mirror and glass rays, is Turner Whitted's 1980 ray tracer. What it still misses is light bounced off matte surfaces: the red glow the cube would throw on the floor beside it. <dfn data-def="Ray tracing that sends many random rays from every hit point and averages them, so that all the ways light can bounce are followed.">Path tracing</dfn>, used for films, sends many random rays from every point and averages them; that takes hundreds of rays per pixel. The share of light glass reflects comes from Schlick's approximation of the Fresnel equations: about 4% head on, nearly all at grazing angles.</p>`
		},
		// ------------------------------------------------------------------ compare
		{
			id: 'compare',
			chapter: 'compare',
			title: 'Fast or faithful',
			scene: 'compare',
			hints: { phase: 'compare' },
			duration: 26,
			controls: [bounces, az, el, lightAz],
			body: `
<p>Here are both pictures of the same scene, from the same camera, made from the same 654 triangles with the same shading formula. The <strong>rasteriser</strong> projected each triangle once and filled its pixels. The <strong>ray tracer</strong> followed light backwards from the eye: one ray per pixel, then shadow rays and bounces.</p>
<p>The bars count the work. From the starting view the rasteriser makes about 50,000 pixel tests; the ray tracer makes about 2.6 million ray–triangle tests, and every extra bounce adds more. In return it gets the shadows, the reflections and the bent light through the glass right, because it asks the whole scene about every point.</p>
<p>That is the trade. Games rasterise, to draw sixty pictures a second; films ray-trace, spending minutes or hours on each frame. Today's graphics cards have circuits for ray tests, and games mix the two: rasterise the picture, then trace a few rays for shadows and reflections.</p>`,
			notes: `<p>The counts depend on the view and on the scene: the rasteriser's work grows with the number of triangles and the pixels they cover, the ray tracer's with pixels × rays per pixel × the cost of finding the nearest triangle. With a good BVH that cost grows only slowly with the number of triangles, which is why ray tracing scales to huge film scenes.</p>`
		}
	]
};
