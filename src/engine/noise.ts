import { BigVector3, Point3, Vector3 } from './math';

// http://www.jcgt.org/published/0009/03/02/
export function pcg3d(v: Vector3): Vector3 {
	let n0 = v.map(i => BigInt((i * 1664525 + 1013904223) | 0)) as BigVector3;

	n0[0] += n0[1] * n0[2];
	n0[1] += n0[2] * n0[0];
	n0[2] += n0[0] * n0[1];

	n0 = n0.map(v => v % 0xffffffffn) as BigVector3;

	const n1 = n0.map(i => Number(i ^ (i >> 16n)) * (1.0 / 0xffffffff)) as Vector3;

	n1[0] += n1[1] * n1[2];
	n1[1] += n1[2] * n1[0];
	n1[2] += n1[0] * n1[1];

	return n1;
}

export function bigPcg3d(v: BigVector3): BigVector3 {
	let n0 = v.map(i => (i * 1664525n | 0n) + (1013904223n)) as BigVector3;

	n0[0] += n0[1] * n0[2];
	n0[1] += n0[2] * n0[0];
	n0[2] += n0[0] * n0[1];

	n0 = n0.map(v => v % 0xffffffffn) as BigVector3;
	const n1 = n0.map(i => (i ^ (i >> 16n))) as BigVector3;

	return n1;
}

export function bigRandomizer(seed: bigint): Randomizer {
	const rng = bigIntRandomizer(seed);
	return (l: number = -1, r: number = 1) => {
		const rndInt = rng();
		const rndFloat = Number(rndInt) / 0xffffffff;
		return rndFloat * (r - l) + l;
	};
}

export type BigRandomizer = () => bigint;
export function bigIntRandomizer(seed: bigint): BigRandomizer {
	let rndIdx = 100n + 13n * seed;
	return () => {
		const n = rndIdx;
		rndIdx += 1387n;
		const coord = [n, n, n] as BigVector3;
		return bigPcg3d(coord)[0];
	};
}

export type Randomizer = (l?: number, r?: number) => number;
export function randomizer(seed: number, p: Point3 = [0, 0, 0]): Randomizer {
	let rndIdx = 100;
	return (l: number = 0, r: number = 1) => {
		const n = rndIdx++ * 100;
		const coord = [
			p[0] + n,
			p[1] + n + seed / 10000,
			p[2] + n
		] as Vector3;
		return (pcg3d(coord)[0] % 1) * (r - l) + l;
	};
}

export function random(seed: number, p: Point3 = [0, 0, 0], l: number = 0, r: number = 1): number {
	const coord = [
		p[0],
		p[1] + seed / 10000,
		p[2]
	] as Vector3;
	return (pcg3d(coord)[0] % 1) * (r - l) + l;
}
