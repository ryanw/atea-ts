/**
 * Visit small planets
 *
 * @module
 */

import { Gfx } from 'engine';
import { Scene } from 'engine/scene';
import { Icosphere, InnerIcosphere } from 'engine/meshes/icosphere';
import { PlanetMaterial } from './materials/planet';
import { RenderPlanetPipeline } from './pipelines/render_planet';
import { WorldGraphics } from 'engine/world_graphics';
import { World } from 'engine/ecs/world';
import { OrbitCameraInputSystem } from 'engine/ecs/systems/orbit_camera_input';
import { FreeCameraInputSystem } from 'engine/ecs/systems/free_camera_input';
import * as prefabs from './prefabs';
import { CubeMesh } from 'engine/meshes/cube';
import { PhysicsSystem } from './systems/physics';
import { ShipMesh } from './meshes/ship';
import { PlayerInputSystem } from './systems/player_input';
import { FollowCameraSystem } from 'engine/ecs/systems/follow_camera';
import { WaterMaterial } from './materials/water';
import { RenderWaterPipeline } from './pipelines/render_water';
import { Point3, Vector3 } from 'engine/math';
import { Planet, StarSystem } from './galaxy';
import { Entity } from 'engine/ecs';
import { OrbitsSystem } from './systems/orbits';
import { SkyMaterial } from './materials/sky';
import { RenderSkyPipeline } from './pipelines/render_sky';
import { hsl } from 'engine/color';
import { FollowSystem } from 'engine/ecs/systems/follow';
import { StarMaterial } from './materials/star';
import { RenderStarPipeline } from './pipelines/render_star';
import { ui } from './ui';
import { CubeSphere } from 'engine/meshes/cubesphere';
import { add } from 'engine/math/vectors';
import { SimpleMaterial } from 'engine/material';

/**
 * Start the game
 */
export async function main(el: HTMLCanvasElement) {
	const gfx = await initGfx(el);
	const scene = await initScene(gfx);
	const world = await initWorld(gfx);
	const graphics = await initGraphics(gfx);
	if (DEBUG) {
		const gui = ui(el.parentElement!, world);
	}

	const starSystem = new StarSystem(BigInt(Math.random() * 0xffffffff | 0));
	const planets = Array.from(starSystem.planets());
	const stars = Array.from(starSystem.stars());

	for (const [i, star] of stars.entries()) {
		const materialName = `star-material-${i}`;
		graphics.insertResource(
			materialName,
			new StarMaterial(
				gfx,
				Number(star.starSeed),
				star.coronaColor,
				star.shallowColor,
				star.deepColor,
				star.coreColor,
			),
		);
		prefabs.star(world, materialName, star.position, star.radius);
	}

	const planetEntities: Array<[Planet, Entity, Entity]> = [];
	for (const planet of planets) {
		const position = planet.positionAtTime(0.0);
		const p = prefabs.planet(world, position, planet);
		const w = prefabs.water(world, position, planet);
		planetEntities.push([planet, p, w]);
	}

	const planet = planets[0];
	const star = stars[0];
	const playerStart: Point3 = add(planet.positionAtTime(0), [0, 0, -star.radius + 0.1]);
	const playerVelocity: Vector3 = planet.velocity;
	const player = prefabs.player(world, playerStart, playerVelocity);
	const camera = prefabs.orbitCamera(world, player);
	const sky = prefabs.skybox(world, camera);


	scene.currentCameraId = 1;
	scene.primaryCameraId = 1;

	gfx.run(async (dt) => {
		await world.tick(dt);
		graphics.update(world, scene);
		await gfx.draw(scene, scene.activeCamera);
	});
}

async function initGfx(el: HTMLCanvasElement): Promise<Gfx> {
	if (el.tagName !== 'CANVAS') throw new Error('Element is not a canvas');
	const gfx: Gfx = await Gfx.attachNotified(el);
	gfx.configure({ renderMode: 0, ditherSize: 0, drawShadows: false, drawEdges: 0, canvasPixelRatio: 0.5 });

	return gfx;
}

async function initScene(gfx: Gfx): Promise<Scene> {
	const scene = new Scene(gfx);
	scene.clearColor = [0, 0, 0, 255];
	return scene;
}



async function initGraphics(gfx: Gfx, planetSeed: number = 0): Promise<WorldGraphics> {
	gfx.registerMaterials([
		[PlanetMaterial, RenderPlanetPipeline],
		[WaterMaterial, RenderWaterPipeline],
		[SkyMaterial, RenderSkyPipeline],
		[StarMaterial, RenderStarPipeline],
	]);
	const graphics = new WorldGraphics(gfx);

	const planetMesh = new Icosphere(gfx, 6);
	planetMesh.variantCount = 10000;
	graphics.insertResource('planet', planetMesh);
	graphics.insertResource('planet-material', new PlanetMaterial(gfx, planetSeed, 0.0));

	const waterMesh = new Icosphere(gfx, 4);
	waterMesh.variantCount = 10000;
	graphics.insertResource('water', waterMesh);
	graphics.insertResource('water-material', new WaterMaterial(gfx, planetSeed + 1231));

	const starMesh = new CubeSphere(gfx, 8);
	graphics.insertResource('star', starMesh);


	const skyMesh = new InnerIcosphere(gfx, 2);
	graphics.insertResource('sky', skyMesh);
	graphics.insertResource('sky-material', new SkyMaterial(gfx, planetSeed + 312, [
		hsl(0.8, 0.4, 0.05, 0.1),
		hsl(Math.random(), 0.4, 0.2, 0.6),
		hsl(Math.random(), 1.0, 0.5, 0.6),
		hsl(Math.random(), 1.0, 0.5, 0.6),
		hsl(Math.random(), 1.0, 0.5, 0.6),
	]));

	graphics.insertResource('tiny-cube', new CubeMesh(gfx, [0, 0, 0], 0.01));


	graphics.insertResource('player-ship', new ShipMesh(gfx));
	graphics.insertResource('ship-material', new SimpleMaterial(gfx, 0xfffffffffn));

	return graphics;
}

async function initWorld(gfx: Gfx): Promise<World> {
	const world = new World();
	world.addSystem(new OrbitsSystem());
	world.addSystem(new PhysicsSystem(gfx));
	world.addSystem(new FreeCameraInputSystem(gfx.canvas));
	world.addSystem(new OrbitCameraInputSystem(gfx.canvas));
	world.addSystem(new FollowCameraSystem(gfx.canvas));
	world.addSystem(new PlayerInputSystem(gfx.canvas));
	world.addSystem(new FollowSystem());
	return world;
}
