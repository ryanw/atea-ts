import { Gfx, calculateNormals } from 'engine';
import { Point3, Vector3 } from '../math';
import { multiply, rotationFromVector, scaling, transformPoint, translation } from '../math/transform';
import { SimpleMesh, toVertex } from 'engine/mesh';
import { buildQuad, buildWireQuad } from './quad';

/**
 * Mesh shaped like an Cube, uses lines rather than triangles
 */
export class WireCube extends SimpleMesh {
	constructor(gfx: Gfx, divisions: [number, number, number] = [0, 0, 0], scale: number | Vector3 = 1) {
		if (divisions[0] == null) debugger;
		const s: Vector3 = typeof scale === 'number' ? [scale, scale, scale] : scale;
		const transforms = [
			// Top
			multiply(
				scaling(...s),
				translation(0, 1, 0),
				rotationFromVector([0, 1, 0], [0, 1, 0]),
			),
			// Bottom
			multiply(
				scaling(...s),
				translation(0, -1, 0),
				rotationFromVector([0, -1, 0], [0, 1, 0]),
			),
			// Left
			multiply(
				scaling(...s),
				translation(-1, 0, 0),
				rotationFromVector([-1, 0, 0], [0, 1, 0]),
			),
			// Right
			multiply(
				scaling(...s),
				translation(1, 0, 0),
				rotationFromVector([1, 0, 0], [0, 1, 0]),
			),
			// Front
			multiply(
				scaling(...s),
				translation(0, 0, 1),
				rotationFromVector([0, 0, 1], [0, 1, 0]),
			),
			// Back
			multiply(
				scaling(...s),
				translation(0, 0, -1),
				rotationFromVector([0, 0, -1], [0, 1, 0]),
			),
		];
		const divs: Array<[number, number]> = [
			[divisions[0], divisions[2]],
			[divisions[1], divisions[2]],
			[divisions[0], divisions[1]],
		];

		const vertices = transforms.map((t, i) => buildWireQuad(divs[i / 2 | 0]).map(v => transformPoint(t, v))).flat().map(toVertex);
		calculateNormals(vertices);
		super(gfx, vertices);
	}
}

/**
 * Mesh shaped like an Cube
 */
export class CubeMesh extends SimpleMesh {
	constructor(gfx: Gfx, divisions: [number, number, number] = [0, 0, 0], scale: number | Vector3 = 1) {
		if (divisions[0] == null) debugger;
		const s: Vector3 = typeof scale === 'number' ? [scale, scale, scale] : scale;
		const transforms = [
			// Top
			multiply(
				scaling(...s),
				translation(0, 1, 0),
				rotationFromVector([0, 1, 0], [0, 1, 0]),
			),
			// Bottom
			multiply(
				scaling(...s),
				translation(0, -1, 0),
				rotationFromVector([0, -1, 0], [0, 1, 0]),
			),
			// Left
			multiply(
				scaling(...s),
				translation(-1, 0, 0),
				rotationFromVector([-1, 0, 0], [0, 1, 0]),
			),
			// Right
			multiply(
				scaling(...s),
				translation(1, 0, 0),
				rotationFromVector([1, 0, 0], [0, 1, 0]),
			),
			// Front
			multiply(
				scaling(...s),
				translation(0, 0, 1),
				rotationFromVector([0, 0, 1], [0, 1, 0]),
			),
			// Back
			multiply(
				scaling(...s),
				translation(0, 0, -1),
				rotationFromVector([0, 0, -1], [0, 1, 0]),
			),
		];
		const divs: Array<[number, number]> = [
			[divisions[0], divisions[2]],
			[divisions[1], divisions[2]],
			[divisions[0], divisions[1]],
		];

		const vertices = transforms.map((t, i) => buildQuad(divs[i / 2 | 0]).map(v => transformPoint(t, v))).flat().map(toVertex);
		calculateNormals(vertices);
		super(gfx, vertices);
	}
}




export const CUBE_VERTS: Array<Point3> = [
	[-1, -1, 1],
	[1, -1, 1],
	[1, 1, 1],

	[-1, -1, 1],
	[1, 1, 1],
	[-1, 1, 1],

	[1, -1, 1],
	[1, -1, -1],
	[1, 1, -1],

	[1, -1, 1],
	[1, 1, -1],
	[1, 1, 1],

	[1, -1, -1],
	[-1, -1, -1],
	[-1, 1, -1],

	[1, -1, -1],
	[-1, 1, -1],
	[1, 1, -1],

	[-1, -1, -1],
	[-1, -1, 1],
	[-1, 1, 1],

	[-1, -1, -1],
	[-1, 1, 1],
	[-1, 1, -1],

	[-1, 1, 1],
	[1, 1, 1],
	[1, 1, -1],

	[-1, 1, 1],
	[1, 1, -1],
	[-1, 1, -1],

	[1, -1, 1],
	[-1, -1, -1],
	[1, -1, -1],

	[1, -1, 1],
	[-1, -1, 1],
	[-1, -1, -1]
];

