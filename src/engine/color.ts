import { Vector4 } from './math';

export type Color = Vector4;
export type ColorLike = Color | number | bigint;

export function toColor(color: ColorLike): Color {
	if (Array.isArray(color)) {
		return color;
	}
	color = Number(color || 0);
	const r = color & 0xff;
	const g = (color >> 8) & 0xff;
	const b = (color >> 16) & 0xff;
	const a = (color >> 24) & 0xff;
	return [r, g, b, a];
}

export function hsl(h: number, s: number, ll: number, a: number = 1.0): Color {
	const l = Math.max(0, Math.min(1, ll));
	if (s === 0) {
		return [l * 255, l * 255, l * 255, a * 255];
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

	return [r, g, b, a * 255];
}

export function colorToInt(color: ColorLike): number {
	if (!color) return 0;
	if (typeof color === 'number') return color;
	if (typeof color === 'bigint') return Number(color);
	const [r, g, b, a] = color;
	return (a << 24) | (b << 16) | (g << 8) | r;
}
export function colorToBigInt(color: ColorLike): bigint {
	if (!color) return 0n;
	if (typeof color === 'bigint') return color;
	if (typeof color === 'number') return BigInt(color);
	const [r, g, b, a] = color;
	return (BigInt(a | 0) << BigInt(24)) | (BigInt(b | 0) << BigInt(16)) | (BigInt(g | 0) << BigInt(8)) | BigInt(r | 0);
}

function hueToRGB(p: number, q: number, ot: number): number {
	let t = ot;
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
