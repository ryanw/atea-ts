import { add, dot, lerp, magnitude, magnitudeSquared, normalize, scale, subtract } from 'engine/math/vectors';
import { Gfx } from 'engine';
import { System } from 'engine/ecs/systems';
import { World } from 'engine/ecs/world';
import { TransformComponent, VelocityComponent } from 'engine/ecs/components';
import { GravityComponent } from '../components/gravity';
import { ColliderComponent } from 'engine/ecs/components/collider';
import { OrbitComponent } from '../components/orbit';

export class OrbitsSystem extends System {
	constructor() {
		super();
	}

	override async tick(dt: number, world: World) {
		const bodies = world.entitiesWithComponents([TransformComponent]);
		const planets = world.entitiesWithComponents([OrbitComponent, VelocityComponent, TransformComponent]);

		for (const entity of planets) {
			const t = world.getComponent(entity, TransformComponent)!;
			const v = world.getComponent(entity, VelocityComponent)!;
			const orbit = world.getComponent(entity, OrbitComponent)!;
			const targetPosition = orbit.positionAtTime(performance.now()/100_000.0);
			const diff = subtract(targetPosition, t.position);
			const dist = magnitude(diff);
			v.velocity = scale(normalize(diff), dist / dt);
		}
	}
}
