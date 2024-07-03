import { Gfx, calculateNormals } from 'engine';
import { PHI, Point3 } from 'engine/math';
import { ColorVertex, SimpleMesh } from 'engine/mesh';

const { cos, sin } = Math;

export class ShipMesh extends SimpleMesh {
	constructor(gfx: Gfx) {
		const vertices: Array<ColorVertex> = buildShipMesh((position, i) => {
			let color = 0xff0000ff;
			// Every even triangle is on the top
			const isTop = (i / 3 | 0) % 2 == 0;
			if (i < 2) {
				// First tri is the window
				color = 0xff000000;
			}
			else if (isTop) {
				color = 0xffff66B2;
			}
			else {
				color = 0xff4dB2ff;
			}
			return {
				position: [...position],
				normal: [0, 0, 0],
				color: BigInt(color),
			};
		});
		calculateNormals(vertices);
		super(gfx, vertices);
	}
}

function buildNGon(sides: number, size: number = 1): Array<Point3> {
	const vertices: Point3[] = [];
	for (let i = 0; i < sides; i++) {
		const a = 2 * (Math.PI / sides) * i - Math.PI / sides;
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

export function buildShipMesh<T>(callback: (position: Point3, index: number) => T): Array<T> {
	const hull = buildNGon(5, 0.5);
	return hull.map(callback);
}
