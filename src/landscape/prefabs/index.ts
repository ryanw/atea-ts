import { Entity } from "engine/ecs";
import { PlayerComponent, TransformComponent, VelocityComponent } from "engine/ecs/components";
import { CameraComponent, FreeCameraComponent, OrbitCameraComponent } from "engine/ecs/components/camera";
import { MeshComponent } from "engine/ecs/components/mesh";
import { World } from "engine/ecs/world";
import { Point3, Vector3 } from "engine/math";
import { DecorComponent } from "../components/decor";
import { ResourceId } from "engine/resource";
import { TerrainComponent } from "../components/terrain";
import { WaterComponent } from "../components/water";
import { ShipComponent } from "../components/ship";
import { LightComponent } from "engine/ecs/components/light";
import { ParticlesComponent } from "engine/ecs/components/particles";
import { PhysicsComponent } from "engine/ecs/components/physics";
import { Planet } from "../planet";

export function lightPrefab(world: World, rotation: Vector3 = [0, 0, 0]): Entity {
	return world.createEntity([
		new LightComponent(),
		new TransformComponent([0, 0, 0], rotation),
	]);
}

export function playerPrefab(world: World, position: Point3 = [0, 0, 0]): Entity {
	return world.createEntity([
		new PlayerComponent(),
		new PhysicsComponent(),
		new ParticlesComponent("tiny-cube"),
		new ShipComponent(),
		new TransformComponent(position),
		new VelocityComponent([0, 0, 0]),
		new MeshComponent('player-ship'),
	]);
}

export function orbitCamPrefab(world: World, target: Entity): Entity {
	return world.createEntity([
		new TransformComponent([0, 0, 0], [0.5, 0, 0]),
		new CameraComponent(),
		new OrbitCameraComponent(target),
	]);
}

export function freeCamPrefab(world: World): Entity {
	return world.createEntity([
		new TransformComponent(),
		new CameraComponent(),
		new FreeCameraComponent(),
	]);
}

let decorRngIdx = 0;
export function decorPrefab(world: World, mesh: ResourceId, seed: number, spread: number, radius: number, target?: Entity): Entity {
	const idx = decorRngIdx;
	decorRngIdx += 1;
	return world.createEntity([
		new DecorComponent(mesh, seed + idx * 3211.4, spread, radius, target),
	]);
}

export function terrainPrefab(world: World, seed: number, target?: Entity): Entity {
	const { terrainSeed, terrainColors } = new Planet(seed);

	return world.createEntity([
		new TerrainComponent(terrainSeed, terrainColors.seed, target),
	]);
}

export function waterPrefab(world: World, level: number = 0): Entity {
	return world.createEntity([
		new WaterComponent(level),
	]);
}
