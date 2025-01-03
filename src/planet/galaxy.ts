import { Matrix4, Point3, Quaternion, Vector3 } from "engine/math";
import { multiply } from "engine/math/transform";
import { quaternionFromEuler } from "engine/math/quaternions";
import { multiplyVector, rotation, rotationFromQuaternion, transformPoint } from "engine/math/transform";
import { Randomizer, bigIntRandomizer, bigRandomizer, randomizer } from "engine/noise";
import { magnitude } from "engine/math/vectors";
import { Orbit } from "./orbit";

export class StarSystemList {
	constructor(
		public galaxySeed: bigint,
	) {
	}
}

export class Galaxy {
	constructor(
		public galaxySeed: bigint,
	) {
	}

	*starSystems(): Generator<StarSystem> {
		const rng = bigIntRandomizer(this.galaxySeed + 1n);
		let systemSeed;
		for (let i = 0; i < 8; i++) {
			systemSeed = rng();
			const system = new StarSystem(systemSeed);
			yield system;
		}
	}
}

export class StarSystem {
	readonly planetCount: number;
	constructor(
		public systemSeed: bigint,
	) {
		const rng = bigRandomizer(this.systemSeed + 3240n);
		this.planetCount = rng(3, 16) | 0;
	}

	*stars(): Generator<Star> {
		const rng = bigIntRandomizer(this.systemSeed + 1n);
		const starSeed = rng();
		yield new Star(starSeed, [0, 0, 0]);
	}

	*planets(): Generator<Planet> {
		const rngi = bigIntRandomizer(this.systemSeed + 435543n);
		const rngf = bigRandomizer(this.systemSeed + 435543n);
		const star = this.stars().next().value;
		let orbit = star.radius + 0;
		let planetSeed;
		for (let i = 0; i < this.planetCount; i++) {
			planetSeed = rngi();
			const planet = new Planet(planetSeed, orbit + rngf(200.0, 1000.0));
			orbit = magnitude(planet.positionAtTime(0)) + planet.radius * 2.0;
			yield planet;
		}
	}
}

export class Star {
	readonly radius: number;
	constructor(
		readonly starSeed: bigint,
		readonly position: Point3,
	) {
		const rng = bigRandomizer(starSeed);
		this.radius = rng(1000, 2000);
	}
}

export class Planet {
	readonly orbit: Orbit;
	readonly radius: number;
	readonly density: number;
	readonly waterLevel: number;

	constructor(
		readonly planetSeed: bigint,
		orbitRadius: number,
	) {
		const rng = bigRandomizer(planetSeed);
		this.density = rng();
		this.waterLevel = rng(0, 100);
		this.radius = rng(200, 700);
		const orbitOffset = rng(0.0, Math.PI * 2);
		const orbitSpeed = rng(0.0, 1.0);
		const orbitTilt = quaternionFromEuler(0, 0, rng(0.0, Math.PI / 6.0));

		this.orbit = new Orbit(
			orbitRadius,
			orbitSpeed,
			orbitOffset,
			orbitTilt,
		);
	}

	get waterRadius(): number {
		return Math.max(0, this.radius - this.waterLevel);
	}

	get velocity(): Vector3 {
		return [0, 0, 0];
	}


	positionAtTime(time: number): Point3 {
		return this.orbit.positionAtTime(time);
	}
}

export class Moon {
	constructor(
		public moonSeed: bigint,
	) {
	}
}
