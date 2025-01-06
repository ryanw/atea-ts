import { Gfx, subdivideFace } from 'engine';
import { normalize } from '../math/vectors';
import { BuildCallback, ColorInstance, ColorVertex, SimpleMesh } from 'engine/mesh';
import { ICOSAHEDRON_TRIS, ICOSAHEDRON_VERTICES } from './icosahedron';


/**
 * Sphere Mesh created from subdivided icosahedron
 */
export class Icosphere extends SimpleMesh {
	constructor(gfx: Gfx, divisions: number, scale: number = 1.0, instances?: Array<ColorInstance>) {
		const vertices = buildIcosphere(
			divisions,
			position => ({
				softness: 0.0,
				position: position.map(p => p * scale),
				normal: normalize(position),
				color: BigInt(0xffffffff),
			} as ColorVertex),
		);
		super(gfx, vertices, instances);
	}
}

export class InnerIcosphere extends SimpleMesh {
	constructor(gfx: Gfx, divisions: number, instances?: Array<ColorInstance>) {
		const vertices = buildIcosphere(
			divisions,
			true,
			position => ({
				softness: 0.0,
				position: [...position],
				normal: normalize(position),
				color: BigInt(0xffffffff),
			} as ColorVertex),
		);
		super(gfx, vertices, instances);
	}
}

export function buildIcosphere<T>(divisions: number, invert: boolean, callback: BuildCallback<T>): Array<T>;
export function buildIcosphere<T>(divisions: number, callback: BuildCallback<T>): Array<T>;
export function buildIcosphere<T>(divisions: number, invertOrCallback: boolean | BuildCallback<T>, maybeCallback?: BuildCallback<T>): Array<T> {
	const invert = typeof invertOrCallback === 'boolean' ? invertOrCallback : false;
	const callback = typeof invertOrCallback === 'boolean' ? maybeCallback : invertOrCallback;
	const vertices = ICOSAHEDRON_TRIS.map(
		([v0, v1, v2]) => {
			const p0 = ICOSAHEDRON_VERTICES[invert ? v0 : v0];
			const p1 = ICOSAHEDRON_VERTICES[invert ? v2 : v1];
			const p2 = ICOSAHEDRON_VERTICES[invert ? v1 : v2];
			return subdivideFace([p0, p1, p2], divisions)
				.map(face => face
					.map((p, i) =>
						callback!(normalize(p), i)
					)
				);
		}).flat().flat();

	console.debug("Created icosphere with %d triangles", vertices.length/3);
	return vertices;
}
