import { Gfx, calculateNormals } from 'engine';
import { Point3, Vector3 } from '../math';
import { multiply, rotationFromVector, scaling, transformPoint, translation } from '../math/transform';
import { SimpleMesh, toVertex } from 'engine/mesh';
import { buildQuad, buildWireQuad } from './quad';
import { magnitude } from 'engine/math/vectors';

/**
 * Wire mesh of an arrow pointing in any direction
 */
export class WireArrow extends SimpleMesh {
	constructor(gfx: Gfx, direction: Vector3 = [0, 0, 1]) {
		const { min } = Math;
		const len = magnitude(direction);
		const wid = min(len/2, 12);
		const dep = min(len/2, 12);
		const points: Array<Point3> = [
			[0, 0, 0], [0, 0, len],

			// Tip
			[0, 0, len], [wid, 0, len - dep],
			[0, 0, len], [-wid, 0, len - dep],
			[0, 0, len], [0, wid, len - dep],
			[0, 0, len], [0, -wid, len - dep],
		]
		const vertices = points.map(toVertex);
		super(gfx, vertices);
	}
}
