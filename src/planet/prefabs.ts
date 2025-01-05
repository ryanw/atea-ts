import { Entity } from "engine/ecs";
import { PlayerComponent, TransformComponent, VelocityComponent } from "engine/ecs/components";
import { CameraComponent, FollowCameraComponent, FreeCameraComponent, OrbitCameraComponent } from "engine/ecs/components/camera";
import { MaterialComponent } from "engine/ecs/components/material";
import { MeshComponent } from "engine/ecs/components/mesh";
import { PhysicsComponent } from "engine/ecs/components/physics";
import { World } from "engine/ecs/world";
import { Point3, Quaternion, Vector3 } from "engine/math";
import { quaternionFromEuler } from "engine/math/quaternions";
import { GravityComponent } from "./components/gravity";
import { ParticlesComponent } from "engine/ecs/components/particles";
import { ColliderComponent } from "engine/ecs/components/collider";
import { normalize } from "engine/math/vectors";
import { OrbitComponent } from "./components/orbit";
import { Planet } from "./galaxy";
import { FollowComponent } from "engine/ecs/components/follow";
import { FocusableComponent } from "./components/focusable";
import { MetaComponent } from "./components/meta";
import { ShipComponent, ShipMode } from "./components/ship";

export function orbitCamera(world: World, target: Entity): Entity {
	return world.createEntity([
		new MetaComponent("Orbit Camera"),
		new TransformComponent([0, 0, 0]),
		new CameraComponent(1, 100000.0),
		new OrbitCameraComponent(target, 16, [0, 0.01, 0], quaternionFromEuler(0.3, 0, 0)),
	]);
}

export function followCamera(world: World, target: Entity): Entity {
	return world.createEntity([
		new MetaComponent("Follow Camera"),
		new TransformComponent([0, 0, 0], normalize([-0.4, 0, 0, 0.8] as Quaternion)),
		new CameraComponent(2, 100000.0),
		new OrbitCameraComponent(target, 16, [0, 0.01, 0], quaternionFromEuler(0.3, 0, 0)),
	]);
}

export function freeCamera(world: World): Entity {
	return world.createEntity([
		new MetaComponent("Free Camera"),
		new TransformComponent([0, 0, -1000]),
		new CameraComponent(0.1, 10000.0),
		new FreeCameraComponent(),
	]);
}


export function skybox(world: World, target: Entity) {
	const s = 90_000;
	return world.createEntity([
		new MetaComponent("SkyBox"),
		new TransformComponent([0, 0, 0], [0, 0, 0, 1], [s, s, s]),
		new FollowComponent(target),
		new MeshComponent('sky'),
		new MaterialComponent('sky-material'),
	]);
}

export function star(world: World, material: string, position: Point3, scale: number = 1) {
	return world.createEntity([
		new MetaComponent("Star"),
		new TransformComponent(position, [0, 0, 0, 1], [scale, scale, scale]),
		new MeshComponent('star'),
		new MaterialComponent(material),
		new FocusableComponent(),
	]);
}

export function rock(world: World, position: Point3, scale: number = 1) {
	return world.createEntity([
		new TransformComponent(position, [0, 0, 0, 1], [scale, scale, scale]),
		new MeshComponent('planet'),
		new MaterialComponent('planet-material'),
	]);
}

export function planet(world: World, material: string, position: Point3, planet: Planet) {
	const scale = planet.radius;
	return world.createEntity([
		new MetaComponent("Planet"),
		new TransformComponent(position, [0, 0, 0, 1], [scale, scale, scale]),
		new MeshComponent('planet'),
		//new PhysicsComponent(),
		new OrbitComponent(planet.orbit),
		new FocusableComponent(),
		new ColliderComponent(scale),
		new VelocityComponent([0, 0, 0]),
		new MaterialComponent(material),
		new GravityComponent(10 * scale),
	]);
}

export function water(world: World, material: string, position: Point3, planet: Planet) {
	const scale = planet.waterRadius;
	return world.createEntity([
		new MetaComponent("Water"),
		new TransformComponent(position, [0, 0, 0, 1], [scale, scale, scale]),
		new MeshComponent('water'),
		new OrbitComponent(planet.orbit),
		//new PhysicsComponent(),
		new VelocityComponent([0, 0, 0]),
		new MaterialComponent(material),
	]);
}

export function moon(world: World, position: Point3, scale: number = 1) {
	return world.createEntity([
		new TransformComponent(position, [0, 0, 0, 1], [scale, scale, scale]),
		new MeshComponent('moon'),
		new PhysicsComponent(),
		new VelocityComponent([0, 50, 140]),
		new MaterialComponent('moon-material'),
		new GravityComponent(10),
	]);
}

export function bug(world: World, position: Point3 = [0, 0, 0]): Entity {
	const scale = 3.0;
	return world.createEntity([
		new PhysicsComponent(),
		new TransformComponent(position, [0, 0, 0, 1], [scale, scale, scale]),
		new VelocityComponent([
			(Math.random() - 0.5) * 200,
			(Math.random() - 0.5) * 200,
			0
		]),
		new MeshComponent('bug-ship'),
	]);
}

export function player(world: World, position: Point3 = [0, 0, 0], velocity: Vector3 = [0, 0, 0]): Entity {
	const scale = 3.0;
	return world.createEntity([
		new MetaComponent("Player"),
		new ShipComponent(ShipMode.Space),
		new PlayerComponent(),
		new PhysicsComponent(),
		new TransformComponent(position, [0, 0, 0, 1], [scale, scale, scale]),
		new VelocityComponent(velocity),
		new MeshComponent('player-ship'),
		new MaterialComponent('ship-material'),
		new ParticlesComponent('tiny-cube', 0, true),
		new FocusableComponent(),
	]);
}
