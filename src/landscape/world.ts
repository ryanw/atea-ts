import { Gfx } from 'engine';
import { Camera } from 'engine/camera';
import { Point2, Point3 } from 'engine/math';
import { TerrainHeightQueryPipeline } from './pipelines/terrain_height_query';
import { OrbitCameraController } from 'engine/input/orbit_camera';
import { FreeCameraController } from 'engine/input/free_camera';
import { PlayerController } from './input';
import { Player } from './player';
import { TerrainCache } from './terrain_cache';
import { add } from 'engine/math/vectors';

type Timeout = ReturnType<typeof setTimeout>;
type CameraController = OrbitCameraController | FreeCameraController;

export class World {
	player = new Player();
	playerController: PlayerController;
	spawnPosition: Point3 = [0, 0, 0];
	cameras: Array<CameraController> = [];
	queryTerrain: TerrainHeightQueryPipeline;
	terrainCache: TerrainCache;
	currentCameraId = 0;
	tickrate = 60;

	private currentTimer: Timeout | null = null;

	constructor(public gfx: Gfx, public seed: number) {
		this.terrainCache = new TerrainCache(gfx, seed);
		this.queryTerrain = new TerrainHeightQueryPipeline(gfx);
		this.playerController = new PlayerController(gfx.canvas);
		this.cameras = [
			new OrbitCameraController(gfx.canvas, new Camera(gfx)),
			new FreeCameraController(gfx.canvas, new Camera(gfx)),
		];

		this.updateCameras();
		this.init();
	}

	get activeCamera(): CameraController {
		return this.cameras[this.currentCameraId % this.cameras.length];
	}

	async init() {
		const h = await this.terrainCache.heightAt(this.spawnPosition);
		for (const camera of this.cameras) {
			camera.camera.position = [0, 6.0 + h, -8];
			camera.camera.rotate(0.1, 0);
		}
		this.spawnPosition[1] = 1.0 + h;
		this.spawnPlayer();
	}


	run() {
		const tick = async () => {
			const now = performance.now();
			const dt = (1000 / this.tickrate);
			await this.update(dt / 1000);

			const ft = performance.now() - now;
			const delay = Math.max(0, dt - ft);
			this.currentTimer = setTimeout(tick, delay);
		};
		tick();
	}

	stop() {
		if (this.currentTimer) {
			clearTimeout(this.currentTimer);
			this.currentTimer = null;
		}
	}

	async update(dt: number) {
		const rad = 1.0;
		const coords: Point3[] = [
			[-rad, 0, -rad],
			[-rad, 0, rad],
			[rad, 0, rad],
			[rad, 0, -rad],
		];
		let height = -10000.0;
		for (const coord of coords) {
			height = Math.max(height, await this.terrainCache.heightAt(add(this.player.position, coord)));
		}
		this.player.surfaceHeight = height;
		this.playerController.update(this.player, this.activeCamera.camera, dt);
		this.player.update(dt);

		for (const camera of this.cameras) {
			camera.target = this.player.position;
			camera.update(dt);
		}
	}

	spawnPlayer() {
		this.player.position = [...this.spawnPosition];
	}

	updateCameras() {
		this.playerController.disabled = !(this.activeCamera instanceof OrbitCameraController);
		for (const camera of this.cameras) {
			camera.disabled = true;
		}
		this.activeCamera.disabled = false;
	}
}

