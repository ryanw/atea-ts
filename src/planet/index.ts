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
import { ui } from './ui';
import { CubeSphere } from 'engine/meshes/cubesphere';
import { add } from 'engine/math/vectors';
import { SimpleMaterial } from 'engine/material';
import { RenderStarPipeline } from './pipelines/render_star';
import { bigRandomizer, randomizer } from 'engine/noise';

const GFX_CONFIG = {
	renderMode: 0,
	ditherSize: 0,
	drawShadows: false,
	drawEdges: 0,
	canvasPixelRatio: 1,
}

/**
 * Start the game
 */
export async function main(el: HTMLCanvasElement) {
	const seed = BigInt(Math.random() * 0xffffff | 0);
	const gfx = await initGfx(el);
	const scene = await initScene(gfx);
	const world = await initWorld(gfx);
	const graphics = await initGraphics(gfx, seed);
	if (DEBUG) {
		const gui = ui(el.parentElement!, world);
	}

	const starSystem = new StarSystem(seed);
	const planets = Array.from(starSystem.planets());
	const stars = Array.from(starSystem.stars());

	for (const [i, star] of stars.entries()) {
		const materialName = `star-material-${i}`;
		graphics.insertResource(
			materialName,
			new StarMaterial(
				gfx,
				star.coronaColor,
				star.shallowColor,
				star.deepColor,
				star.coreColor,
			),
		);
		prefabs.star(world, materialName, star.position, star.radius);
	}

	const planetEntities: Array<[Planet, Entity, Entity]> = [];
	for (const [i, planet] of planets.entries()) {
		const position = planet.positionAtTime(0.0);

		const planetMaterialName = `planet-material-${i}`;
		graphics.insertResource(
			planetMaterialName,
			new PlanetMaterial(
				gfx,
				planet.terrainSeed,
				planet.lowLandColor,
				planet.highLandColor,
			),
		);
		const p = prefabs.planet(world, planetMaterialName, position, planet);


		const waterMaterialName = `water-material-${i}`;
		graphics.insertResource(
			waterMaterialName,
			new WaterMaterial(
				gfx,
				planet.terrainSeed,
				planet.shallowWaterColor,
				planet.deepWaterColor,
			),
		);
		const w = prefabs.water(world, waterMaterialName, position, planet);
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
	gfx.configure(GFX_CONFIG);

	return gfx;
}

async function initScene(gfx: Gfx): Promise<Scene> {
	const scene = new Scene(gfx);
	scene.clearColor = [0, 0, 0, 255];
	return scene;
}



async function initGraphics(gfx: Gfx, planetSeed: bigint = 0n): Promise<WorldGraphics> {
	gfx.registerMaterials([
		[PlanetMaterial, RenderPlanetPipeline],
		[WaterMaterial, RenderWaterPipeline],
		[SkyMaterial, RenderSkyPipeline],
		[StarMaterial, RenderStarPipeline],
	]);
	const { abs } = Math;
	const rng = bigRandomizer(planetSeed);
	const graphics = new WorldGraphics(gfx);

	const planetMesh = new Icosphere(gfx, 6);
	planetMesh.variantCount = 10000;
	graphics.insertResource('planet', planetMesh);

	const waterMesh = new Icosphere(gfx, 4);
	waterMesh.variantCount = 10000;
	graphics.insertResource('water', waterMesh);

	const starMesh = new CubeSphere(gfx, 8);
	graphics.insertResource('star', starMesh);


	const skyMesh = new InnerIcosphere(gfx, 2);
	graphics.insertResource('sky', skyMesh);
	graphics.insertResource('sky-material', new SkyMaterial(gfx, planetSeed + 312n, [
		hsl(0, 0, 0, 1.0),
		hsl(abs(rng() % 1.0), 0.5, 0.1, 1.0),
		hsl(abs(rng() % 1.0), 0.8, 0.2, 1.0),
		hsl(abs(rng() % 1.0), 0.8, 0.2, 1.0),
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
