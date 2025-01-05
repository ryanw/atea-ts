import { Point3, Quaternion } from "engine/math";
import { multiply, rotation, rotationFromQuaternion, transformPoint } from "engine/math/transform";

export class Orbit {
	constructor({
		public radius: number,
		public speed: number = 1.0,
		public offset: number = 0.0,
		public tilt: Quaternion = [0, 0, 0, 1],
		public origin: Point3 = [0, 0, 0],
	}) {
	}

	positionAtTime(time: number): Point3 {
		const orbitTime = 1.0;
		const angle = (this.offset + time / orbitTime) * this.speed*10.0;
		const start: Point3 = [this.radius, 0, 0];
		const rot = multiply(rotationFromQuaternion(this.tilt), rotation(0, angle, 0));
		return transformPoint(rot, start);
	}
}
