import { Gfx, calculateNormals } from 'engine';
import { PHI, Point3 } from 'engine/math';
import { ColorVertex, SimpleMesh } from 'engine/mesh';
import { magnitude, magnitudeSquared, scale } from 'engine/math/vectors';

const { cos, sin } = Math;

function toVertex(position: Point3, i: number): ColorVertex {
	let color = 0xffffffffn;
	// Every even triangle is on the top
	const isTop = (i / 3 | 0) % 2 == 0;
	if (isTop && i < 12) {
		// First tri is the window
		color = 0xff000000n;
	}
	else if (isTop) {
		color = 0xff9c31a3n;
	}
	else {
		color = 0xff4dB2ffn;
	}
	return {
		softness: 0,
		position: [...position],
		normal: [0, 0, 0],
		color,
	};
}

export class ShipMesh extends SimpleMesh {
	constructor(gfx: Gfx) {
		// Space mode mesh
		const spaceVertices: Array<ColorVertex> = buildSpaceMesh(toVertex);
		calculateNormals(spaceVertices);

		// Lander mode mesh
		const landerVertices: Array<ColorVertex> = buildLanderMesh(toVertex);
		calculateNormals(landerVertices);

		// Ground mode mesh
		const groundVertices: Array<ColorVertex> = buildGroundMesh(toVertex);
		calculateNormals(groundVertices);

		super(gfx, [...spaceVertices, ...landerVertices, ...groundVertices]);

		// Force it to 3 variants. Space, Lander, and Ground
		this.vertexCount = landerVertices.length;
		this.variantCount = 3;
	}
}

function buildNGon(sides: number, size: number = 1): Array<Point3> {
	const vertices: Point3[] = [];
	for (let i = 0; i < sides; i++) {
		const a = 2 * (Math.PI / sides) * i - Math.PI / sides * 2;
		const x = sin(a);
		const y = cos(a);
		vertices.push([x * size, 0, y * size]);
	}

	const hull: Point3[] = [];
	for (let i = 0; i < vertices.length; i++) {
		// Add triangle on either side
		hull.push(
			vertices[i],
			vertices[(i + 1) % vertices.length],
			[0, (1.0 / PHI) * size, 0],
		);
		hull.push(
			vertices[i],
			[0, (-0.5 / PHI) * size, 0],
			vertices[(i + 1) % vertices.length],
		);
	}
	return hull;
}

export function buildLanderMesh<T>(callback: (position: Point3, index: number) => T): Array<T> {
	const size = 0.1
	return buildNGon(6, size).map(callback);
}

export function buildSpaceMesh<T>(callback: (position: Point3, index: number) => T): Array<T> {
	const size = 0.1
	const { abs } = Math;
	const hull = buildNGon(6);
	return hull.map((p, i) => {
		const sx = 1.0 - p[2];
		const sy = 1.0 - p[2];
		let sz = 1.6;
		if (p[2] < 0) {
			sz *= 0.3 + 0.4 * abs(p[0]);
		}
		const q = scale(p, [sx * size, sy * size, sz * size]);
		return callback(q, i);
	});
}
export function buildGroundMesh<T>(callback: (position: Point3, index: number) => T): Array<T> {
	const { ceil } = Math;
	const hull = buildNGon(6);
	const size = 0.06;
	const s = size;
	const e = 0.0001;
	return hull.map((p, i) => {
		const q: Point3 = p[1] > -e
			// Top
			? [
				p[0] * size,
				(p[1] + 1.2) * size,
				p[2] * size,
			]
			// Bottom
			: p.map(v => v * size) as Point3;
		return callback(q, i);
	});
}
