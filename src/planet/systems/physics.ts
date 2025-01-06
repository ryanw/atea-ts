import { add, dot, lerp, magnitude, magnitudeSquared, normalize, scale, subtract } from 'engine/math/vectors';
import { Gfx } from 'engine';
import { System } from 'engine/ecs/systems';
import { World } from 'engine/ecs/world';
import { PlayerComponent, TransformComponent, VelocityComponent } from 'engine/ecs/components';
import { PhysicsComponent } from 'engine/ecs/components/physics';
import { GravityComponent } from '../components/gravity';
import { Point3, Vector3 } from 'engine/math';
import { Entity } from 'engine/ecs';
import { ColliderComponent } from 'engine/ecs/components/collider';
import { player } from '../prefabs';

interface Planet {
	entity: Entity;
	position: Point3;
	velocity: Vector3;
	radius: number;
	force: number;
}

export class PhysicsSystem extends System {
	constructor(private gfx: Gfx) {
		super();
	}

	override async tick(dt: number, world: World) {
		this.tickPhysics(dt, world);
		this.tickVelocity(dt, world);
	}

	tickVelocity(dt: number, world: World) {
		const entities = world.entitiesWithComponents([VelocityComponent, TransformComponent]);
		for (const entity of entities) {
			const tra = world.getComponent(entity, TransformComponent)!;
			const vel = world.getComponent(entity, VelocityComponent)!;
			tra.position = add(tra.position, scale(vel.velocity, dt));
		}
	}

	tickPhysics(dt: number, world: World) {
		const bodies = world.entitiesWithComponents([GravityComponent, TransformComponent]);
		const entities = world.entitiesWithComponents([PhysicsComponent, VelocityComponent, TransformComponent]);

		let planets: Array<Planet>;

		function refreshPlanets() {
			planets = Array.from(bodies).map(ent => {
				const { force } = world.getComponent(ent, GravityComponent)!;
				const { position } = world.getComponent(ent, TransformComponent)!;
				const collider = world.getComponent(ent, ColliderComponent);
				const velocity = world.getComponent(ent, VelocityComponent);
				return {
					entity: ent,
					position,
					velocity: velocity?.velocity || [0, 0, 0],
					force,
					radius: collider?.radius ?? 0
				};
			});
		}
		refreshPlanets();

		function updateEntity(entity: Entity) {
			const { max, min } = Math;
			const tra = world.getComponent(entity, TransformComponent)!;
			const vel = world.getComponent(entity, VelocityComponent)!;
			const isPlayer = world.hasComponent(entity, PlayerComponent);

			// Add every planet's gravity to velocity
			for (const planet of planets) {
				if (planet.entity === entity) continue;
				const diff = subtract(tra.position, planet.position);
				const distance = magnitude(diff) - planet.radius;
				const drag = 1.0 - max(0.0, min(1.0, distance / 5120.0));

				const gravity = calculateGravity(tra.position, planet.position, planet.force * dt);
				const speedDiff = subtract(vel.velocity, planet.velocity);
				vel.velocity = add(vel.velocity, gravity);

				if (isPlayer) {
					const collided = hasCollided(tra.position, planet.position, planet.radius);
					if (collided) {
						// Objects touching, snap together
						//vel.velocity = [...planet.velocity];
						if (distance < 0.0) {
							tra.position = add(planet.position, scale(normalize(diff), planet.radius-0.001));
							vel.velocity = planet.velocity;
						}
						continue;
					}

					if (drag > 0.1 && magnitudeSquared(gravity) > 0) {
						// Dampening by matching planet's speed
						const speedDiff = subtract(planet.velocity, vel.velocity);
						const gravDir: Vector3 = collided ? [0, 0, 0] : normalize(gravity);
						const mag = dot(speedDiff, gravDir);
						const proj = scale(gravDir, mag);
						const velDiff = scale(subtract(speedDiff, proj), drag);
						//vel.velocity = add(vel.velocity, velDiff);
					}
				}
			}
		}

		// Pull everything towards the gravity wells

		// Update gravity wells first to avoid jitter
		const gravities = Array.from(entities).filter(e => world.hasComponent(e, GravityComponent));

		for (const entity of gravities) {
			updateEntity(entity);
		}

		refreshPlanets();
		const things = Array.from(entities).filter(e => !world.hasComponent(e, GravityComponent));
		for (const entity of things) {
			updateEntity(entity);
		}
	}
}


function calculateGravity(p: Point3, well: Point3, force: number): Vector3 {
	const diff = subtract(well, p);
	const distance = magnitude(diff);
	const dir = normalize(diff);

	// Not realistic, but feels nicer
	//return scale(dir, (1 / (distance ** 2)) * force * 1000);
	return scale(dir, (1 / distance) * force * 100);
}
function hasCollided(p0: Point3, p1: Point3, radius: number): boolean {
	return magnitude(subtract(p0, p1)) < radius;
}
