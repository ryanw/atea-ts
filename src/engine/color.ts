import { Vector4 } from "./math";

export type Color = Vector4;

export function hsl(h: number, s: number, l: number): Color {
	if (s === 0) {
		return [l * 255, l * 255, l * 255, 255];
	}

	let q = 0;
	if (l < 0.5) {
		q = l * (1 + s);
	}
	else {
		q = l + s - l * s;
	}
	const p = 2 * l - q;

	const r = hueToRGB(p, q, h + 1 / 3) * 255;
	const g = hueToRGB(p, q, h) * 255;
	const b = hueToRGB(p, q, h - 1 / 3) * 255;

	return [r, g, b, 255];
}

function hueToRGB(p: number, q: number, ot: number): number {
	var t = ot;
	if (t < 0) {
		t += 1;
	}
	if (t > 1) {
		t -= 1;
	}

	if (t < 1 / 6) {
		return p + (q - p) * 6 * t;
	}

	if (t < 1 / 2) {
		return q;
	}

	if (t < 2 / 3) {
		return p + (q - p) * (2 / 3 - t) * 6;
	}

	return p;
}