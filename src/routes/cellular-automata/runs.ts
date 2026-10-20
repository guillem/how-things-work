/** Turns rows of cells into SVG rectangles, one per run of live cells, so a big pattern stays light. */
export function runs(rows: readonly Uint8Array[], x0: number, y0: number, cw: number, ch: number) {
	const out: { x: number; y: number; w: number; h: number }[] = [];
	rows.forEach((row, t) => {
		let i = 0;
		while (i < row.length) {
			if (!row[i]) {
				i++;
				continue;
			}
			let j = i;
			while (j < row.length && row[j]) j++;
			out.push({ x: x0 + i * cw, y: y0 + t * ch, w: (j - i) * cw, h: ch });
			i = j;
		}
	});
	return out;
}
