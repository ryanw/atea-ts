import { Gfx, Size } from 'engine';
import { Point3 } from 'engine/math';
import { add } from 'engine/math/vectors';
import { SimpleMesh, toVertex } from 'engine/mesh';

/**
 * Mesh shaped like a flat subdivided plane
 */
export class QuadMesh extends SimpleMesh {
	constructor(gfx: Gfx, divisions: [number, number] = [1, 1], size: Size = [1, 1]) {
		const vertices = buildQuad(divisions, size).map(toVertex);
		super(gfx, vertices);
	}
}

export function buildQuad(divisions: [number, number] = [1, 1], size: Size = [1, 1]): Array<Point3> {
	const s0 = (1 / (divisions[0] + 1)) * size[0];
	const s1 = (1 / (divisions[1] + 1)) * size[1];
	const quad: Array<Point3> = [
		[-s0, 0, -s1],
		[-s0, 0, s1],
		[s0, 0, s1],

		[s0, 0, s1],
		[s0, 0, -s1],
		[-s0, 0, -s1],
	];

	const vertexCount = (divisions[0] + 1) * (divisions[1] + 1) * quad.length;

	const subquad: Array<Point3> = new Array(vertexCount);

	const gap = 0.0;
	const stepX = s0 * 2 + gap;
	const stepY = s1 * 2 + gap;
	const offset = [
		-s0 * divisions[0],
		-s1 * divisions[1],
	];
	for (let y = 0; y <= divisions[1]; y++) {
		for (let x = 0; x <= divisions[0]; x++) {
			const o = x + y * (divisions[0] + 1);
			for (let i = 0; i < quad.length; i++) {
				const p = quad[i];
				const idx = o * quad.length + i;
				const vertexPosition: Point3 = [
					stepX * x + offset[0],
					0,
					stepY * y + offset[1],
				];
				subquad[idx] = add(p, vertexPosition);
			}
		}
	}

	return subquad;
}

export function buildWireQuad(divisions: [number, number] = [1, 1], size: Size = [1, 1]): Array<Point3> {
	const s0 = (1 / (divisions[0] + 1)) * size[0];
	const s1 = (1 / (divisions[1] + 1)) * size[1];
	const quad: Array<Point3> = [
		[-s0, 0, -s1], [-s0, 0, s1],
		[-s0, 0, s1], [s0, 0, s1],
		[s0, 0, s1], [s0, 0, -s1],
		[s0, 0, -s1], [-s0, 0, -s1],
		[-s0, 0, -s1], [-s0, 0, -s1],
	];

	const vertexCount = (divisions[0] + 1) * (divisions[1] + 1) * quad.length;

	const subquad: Array<Point3> = new Array(vertexCount);

	const gap = 0.0;
	const stepX = s0 * 2 + gap;
	const stepY = s1 * 2 + gap;
	const offset = [
		-s0 * divisions[0],
		-s1 * divisions[1],
	];
	for (let y = 0; y <= divisions[1]; y++) {
		for (let x = 0; x <= divisions[0]; x++) {
			const o = x + y * (divisions[0] + 1);
			for (let i = 0; i < quad.length; i++) {
				const p = quad[i];
				const idx = o * quad.length + i;
				const vertexPosition: Point3 = [
					stepX * x + offset[0],
					0,
					stepY * y + offset[1],
				];
				subquad[idx] = add(p, vertexPosition);
			}
		}
	}

	return subquad;
}
