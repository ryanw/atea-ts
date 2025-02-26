/**
 * Fly around procedurally generated alien worlds 👽🚀
 *
 * @module
 */

import { Gfx } from 'engine';
import { CubeMesh } from 'engine/mesh';
import { Scene } from 'engine/scene';
import { DotMaterial } from 'engine/material';
import { ui } from './ui';
import { ShipMesh } from './meshes/ship';
import { StarMesh } from './meshes/star';
import { animalPrefab, decorPrefab, freeCamPrefab, lightPrefab, orbitCamPrefab, playerPrefab, terrainPrefab, waterPrefab } from './prefabs';
import { WorldGraphics } from 'engine/world_graphics';
import { World } from 'engine/ecs/world';
import { FreeCameraInputSystem } from 'engine/ecs/systems/free_camera_input';
import { OrbitCameraInputSystem } from 'engine/ecs/systems/orbit_camera_input';
import { PlayerInputSystem } from './systems/player_input';
import { PhysicsSystem } from 'engine/ecs/systems/physics';
import { RockMesh } from './meshes/rock';
import { TreeMesh } from './meshes/tree';
import { TuftMesh } from './meshes/tuft';
import { TerrainSystem } from 'engine/ecs/systems/terrain';
import { getParam } from 'engine/helpers';
import { FlowersMesh } from './meshes/flowers';
import { InsectsMesh } from './meshes/insects';
import { InsectAISystem } from './systems/insect_ai';
import { Socket } from 'engine/net/socket';
import { NetworkSystem } from './systems/network';
import { Sound } from 'engine/sound';
import { thrusterSound } from './sounds/thruster';
import { SoundSystem } from 'engine/ecs/systems/sound';
import { BombMesh, LaserMesh } from './meshes/projectiles';

/**
 * Procedurally generated alien worlds
 *
 * @param el Canvas element to draw into
 */
export async function main(el: HTMLCanvasElement) {
	const gfx: Gfx = await Gfx.attachNotified(el);
	if (DEBUG) {
		gfx.framecap = 60;
	}
	const seed = getSeed();


	// Sound effects
	const sound = new Sound();
	sound.create('thruster', thrusterSound);

	// Add the HTML UI stuff
	ui(el.parentElement!, gfx, sound, seed);

	// Socket for multiplayer
	const socket = connectSocket();
	socket.login("Test User", seed);

	// Graphics objects
	const scene = new Scene(gfx);
	scene.fogColor = [0, 0, 0, 255];
	// Sky dome
	const stars = scene.addMesh(new StarMesh(gfx, [0, 0, 0], 5000.0, 1.0, seed), new DotMaterial(gfx));


	// Sync graphics with world
	const graphics = new WorldGraphics(gfx);
	graphics.insertResource('tiny-cube', new CubeMesh(gfx, [0, 0, 0], 0.05));
	graphics.insertResource('small-cube', new CubeMesh(gfx, [0, 0, 0], 0.1));
	graphics.insertResource('cube', new CubeMesh(gfx, [0, 0, 0], 0.5));
	graphics.insertResource('player-ship', new ShipMesh(gfx));
	graphics.insertResource('bomb', new BombMesh(gfx));
	graphics.insertResource('laser', new LaserMesh(gfx));
	graphics.insertResource('animal-placeholder', new InsectsMesh(gfx, seed + 55, 32));
	graphics.insertResource('decor-rocks', new RockMesh(gfx, seed + 41, 4));
	graphics.insertResource('decor-trees', new TreeMesh(gfx, seed + 77, 16));
	graphics.insertResource('decor-tufts-1', new TuftMesh(gfx, seed + 11, 5));
	graphics.insertResource('decor-tufts-2', new TuftMesh(gfx, seed + 22, 5));
	graphics.insertResource('decor-cubes', new CubeMesh(gfx, [0, 0, 0], 0.2));
	graphics.insertResource('decor-flowers-1', new FlowersMesh(gfx, seed + 64, 32));
	graphics.insertResource('decor-flowers-2', new FlowersMesh(gfx, seed + 94, 32));


	// World simulation
	const world = new World();
	world.addSystem(new PhysicsSystem(gfx));
	world.addSystem(new SoundSystem(sound));
	world.addSystem(new PlayerInputSystem(el));
	world.addSystem(new FreeCameraInputSystem(el));
	world.addSystem(new OrbitCameraInputSystem(el));
	world.addSystem(new TerrainSystem(gfx));
	world.addSystem(new InsectAISystem());
	world.addSystem(new NetworkSystem(socket));

	const light = lightPrefab(world, [0.5, 0.7, 0.0]);
	const player = playerPrefab(world, [0, 3, 0]);
	const freeCam = freeCamPrefab(world);
	const orbitCam = orbitCamPrefab(world, player);
	const water = waterPrefab(world);
	const flowers0 = decorPrefab(world, 'decor-flowers-1', seed, 8, 4, orbitCam);
	const flowers1 = decorPrefab(world, 'decor-flowers-2', seed, 16, 4, orbitCam);
	const rocks0 = decorPrefab(world, 'decor-rocks', seed, 12, 3, orbitCam);
	const rocks1 = decorPrefab(world, 'decor-rocks', seed, 24, 4, orbitCam);
	const trees0 = decorPrefab(world, 'decor-trees', seed, 48, 4, orbitCam);
	const trees1 = decorPrefab(world, 'decor-trees', seed, 96, 4, orbitCam);
	const tufts0 = decorPrefab(world, 'decor-tufts-1', seed, 3, 5, orbitCam);
	const tufts1 = decorPrefab(world, 'decor-tufts-2', seed, 7, 4, orbitCam);
	const terrain = terrainPrefab(world, seed, orbitCam);

	for (let i = 0; i < 20; i++) {
		//const animal = animalPrefab(world, 'animal-placeholder', [rnd(-32, 32), 3, rnd(-32, 32)]);
	}

	world.run();

	// FIXME set default camera to orbit camera
	scene.currentCameraId = 2;
	scene.primaryCameraId = 2;
	// Start main loop
	gfx.run(async (dt) => {
		graphics.update(world, scene);
		await gfx.draw(scene, scene.activeCamera);
	});
}

function connectSocket(): Socket {
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const hostname = window.location.hostname;
	const port = proto === 'wss:' ? 443 : 3012;
	const path = proto === 'wss:' ? '/v2/socket' : '';
	const addr = `${proto}//${hostname}:${port}${path}`;
	return new Socket(addr);
}

function getSeed(): number {
	const seedParam = getParam('seed');
	return Math.abs(seedParam ? parseInt(seedParam, 36) : Math.random() * 0x7fffffff | 0);
}
