/**
 * Pointer helpers for interactive scenes: convert a pointer event to the
 * scene's own 960 × 600 coordinates (whatever the stage's size on screen) and
 * follow a drag until the pointer is released.
 */
import type { Point } from './math';

/** The event's position in the coordinate system of the `<svg>` that contains `el`. */
export function toSvg(event: PointerEvent | MouseEvent, el: Element): Point {
	const svg = el instanceof SVGSVGElement ? el : (el as SVGElement).ownerSVGElement;
	const ctm = svg?.getScreenCTM();
	if (!svg || !ctm) return { x: 0, y: 0 };
	const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
	return { x: p.x, y: p.y };
}

/**
 * Starts a drag from a `pointerdown` on `event.currentTarget`: calls `move`
 * with the pointer position in scene coordinates now and on every move, until
 * the pointer is released. Captures the pointer, so the drag keeps working
 * outside the element, and stops the page from scrolling on touch screens.
 *
 * Returns a function that ends the drag early, as a release would (`end`
 * included; nothing if the drag has ended already). A component that can be
 * unmounted mid-drag (by a step change) calls it when it is destroyed: the
 * pointer's release would never reach its removed element.
 */
export function startDrag(
	event: PointerEvent,
	move: (p: Point) => void,
	end?: () => void
): () => void {
	if (event.button !== 0) return () => {};
	const el = event.currentTarget as Element;
	event.preventDefault();
	el.setPointerCapture?.(event.pointerId);
	move(toSvg(event, el));
	let done = false;
	const onMove = (e: PointerEvent) => {
		if (e.pointerId === event.pointerId) move(toSvg(e, el));
	};
	const finish = () => {
		if (done) return;
		done = true;
		el.removeEventListener('pointermove', onMove as EventListener);
		el.removeEventListener('pointerup', onUp as EventListener);
		el.removeEventListener('pointercancel', onUp as EventListener);
		end?.();
	};
	const onUp = (e: PointerEvent) => {
		if (e.pointerId === event.pointerId) finish();
	};
	el.addEventListener('pointermove', onMove as EventListener);
	el.addEventListener('pointerup', onUp as EventListener);
	el.addEventListener('pointercancel', onUp as EventListener);
	return () => {
		if (el.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
		finish();
	};
}
