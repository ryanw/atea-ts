import { Gfx, Size } from 'engine';
import { Camera, EulerCamera, QuaternionCamera } from './camera';
import { Entity } from './ecs';
import { PlayerComponent, TransformComponent, VelocityComponent } from './ecs/components';
import { CameraComponent } from './ecs/components/camera';
import { MeshComponent } from './ecs/components/mesh';
import { World } from './ecs/world';
import { Matrix4, Point3, Vector3 } from './math';
import { identity, multiply, multiplyVector, rotation, rotationFromQuaternion, rotationFromVector, scaling, translation } from './math/transform';
import { SimpleMesh } from './mesh';
import { Pawn } from './pawn';
import { ResourceId } from './resource';
import { Scene } from './scene';
import { Material, SimpleMaterial } from './material';
import { LightComponent } from './ecs/components/light';
import { DirectionalLight } from './light';
import { Chunk, ChunkKey, toChunkHash } from './terrain';
import { ParticlesComponent } from './ecs/components/particles';
import { Particles } from './particles';
import { TerrainComponent } from './ecs/components/terrain';
import { TerrainMesh } from './terrain_mesh';
import { TerrainPipeline } from './pipelines/terrain';
import { ColorScheme } from './color_scheme';
import { DecorComponent } from './ecs/components/decor';
import { DecorMesh } from './decor_mesh';
import { MaterialComponent } from './ecs/components/material';
import { colorToInt } from './color';
import { DecorPipeline } from './pipelines/decor';
import { add, magnitude, normalize, subtract } from './math/vectors';
import { quaternionToEuler } from './math/quaternions';
import { StorageMaterial } from './storage_material';
import { Icosphere } from './meshes/icosphere';
import { DebugMaterial } from './materials/debug';
import { CubeMesh, WireCube } from './meshes/cube';
import { WireArrow } from './meshes/arrow';

export type Resource = {};

let NEXT_RESOURCE_ID: number = 1000000;

export type QueuedChunk = {
	entity: Entity;
	terrainSeed: number;
	size: Size;
	chunk: Chunk;
	material: Material;
};

export interface DebugInstance {
	positionId: number;
	velocityId: number;
}

export class WorldGraphics {
	private meshes: Map<Entity, [number, Pawn<SimpleMesh>]> = new Map();
	private instanceMeshes: Map<SimpleMesh, Pawn<SimpleMesh>> = new Map();
	private decors: Map<Entity, Pawn<DecorMesh>> = new Map();
	private lights: Map<Entity, DirectionalLight> = new Map();
	private particles: Map<Entity, Pawn<Particles>> = new Map();
	private terrains: Map<Entity, Map<ChunkKey, Pawn<SimpleMesh>>> = new Map();
	private cameras: Map<Entity, Camera> = new Map();
	private resources: Map<ResourceId, Resource> = new Map();
	private queuedTerrain: Map<ChunkKey, QueuedChunk> = new Map();
	private activeTerrain: Map<ChunkKey, Chunk> = new Map();
	private terrainPipelines: Map<number, TerrainPipeline> = new Map();
	private decorPipelines: Map<number, DecorPipeline> = new Map();
	private debugInstances: Map<Entity, DebugInstance> = new Map();
	private debugMeshes: {
		dot: { mesh: Icosphere, pawn?: Pawn<Icosphere, DebugMaterial> },
		vector: { mesh: CubeMesh, pawn?: Pawn<CubeMesh, DebugMaterial> },
	};

	constructor(
		private gfx: Gfx,
		private heightShaderSource?: string,
	) {
		this.debugMeshes = {
			dot: {
				mesh: new Icosphere(this.gfx, 0, 5.0)
			},
			vector: {
				mesh: new WireArrow(this.gfx, [0, 0, 100])
			},
		};
	}

	update(world: World, scene: Scene) {
		this.updateCameras(world, scene);
		//this.updateEulerCameras(world, scene);
		this.updateLights(world, scene);
		this.updateMeshes(world, scene);
		this.updateDebug(world, scene);
		this.updateTerrain(world, scene);
		this.updateDecor(world, scene);
		this.updateParticles(world, scene);
		this.updateClipping(scene);
	}

	updateDebug(world: World, scene: Scene) {
		this.setupMeshes(scene);

		const entities = world.entitiesWithComponents([VelocityComponent, TransformComponent]);
		const playerId = world.entitiesWithComponent(PlayerComponent).values().next().value;
		const playerVelocity = world.getComponent(playerId, VelocityComponent)!.velocity;
		for (const entity of entities) {
			const { position, rotation } = world.getComponent(entity, TransformComponent)!;
			const { velocity }  = world.getComponent(entity, VelocityComponent)!;
			const transform = multiply(
				translation(...position),
				rotationFromQuaternion(rotation),
			);

			// Draw dots on every entity
			let debugInst = this.debugInstances.get(entity);
			if (debugInst == null) {
				const posMesh = this.debugMeshes.dot.pawn!;
				const positionId = this.debugMeshes.dot.mesh.pushInstance({
					transform,
					materialIndex: BigInt(posMesh.material.instanceIndex),
					instanceColor1: 0xffffffff,
					instanceColor2: 0xffffffff,
					instanceColor3: 0xffffffff,
					variantIndex: 0,
					variantBlend: 0.0,
					live: 1,
				});
				const velMesh = this.debugMeshes.vector.pawn!;
				const velocityId = this.debugMeshes.vector.mesh.pushInstance({
					transform,
					materialIndex: BigInt(velMesh.material.instanceIndex),
					instanceColor1: 0xffffffff,
					instanceColor2: 0xffffffff,
					instanceColor3: 0xffffffff,
					variantIndex: 0,
					variantBlend: 0.0,
					live: 1,
				});
				debugInst = {
					positionId,
					velocityId,
				};
				this.debugInstances.set(entity, debugInst);
			}

			scene.updateMeshTransform(this.debugMeshes.dot.pawn!, debugInst.positionId, transform);
			const velocityDiff = subtract(velocity, playerVelocity);

			const velocityArrowTransform = multiply(
				translation(...position),
				rotationFromVector(normalize(velocityDiff)),
				scaling(magnitude(velocityDiff)/200),
			);
			scene.updateMeshTransform(this.debugMeshes.vector.pawn!, debugInst.velocityId, velocityArrowTransform);
		}
	}
	setupMeshes(scene: Scene) {
		if (!this.debugMeshes.dot.pawn) {
			this.debugMeshes.dot.pawn = scene.addMesh(
				this.debugMeshes.dot.mesh,
				new DebugMaterial(this.gfx, 0xffffff00n),
			);
		}

		if (!this.debugMeshes.vector.pawn) {
			const pawn = scene.addMesh(
				this.debugMeshes.vector.mesh,
				new DebugMaterial(this.gfx, 0xff00ff00n, true),
			);
			this.debugMeshes.vector.pawn = pawn;
		}
	}

	updateClipping(scene: Scene) {
		const camera = scene.primaryCamera;
		const planes = camera.clippingPlanes();
		scene.frustumClip(planes);
	}

	updateCameras(world: World, scene: Scene) {
		const entities = world.entitiesWithComponents([CameraComponent, TransformComponent]);
		const saw = new Set();
		for (const entity of entities) {
			saw.add(entity);
			const { near, far } = world.getComponent(entity, CameraComponent)!;
			let camera = this.cameras.get(entity);
			if (!camera) {
				camera = new QuaternionCamera(scene.gfx);
				camera.near = near;
				camera.far = far;
				this.cameras.set(entity, camera);
				scene.addCamera(camera);
			}
			const { position, rotation } = world.getComponent(entity, TransformComponent)!;
			camera.position = [...position];
			if (camera instanceof EulerCamera) {
				throw new Error("Not implemented");
			}
			else if (camera instanceof QuaternionCamera) {
				camera.rotation = [...rotation];
			}
		}

		const removed: Array<Entity> = [...this.cameras.keys()].filter(e => !saw.has(e));
		for (const entity of removed) {
			console.warn('Camera Removed', entity);
		}
	}

	updateLights(world: World, scene: Scene) {
		const entities = world.entitiesWithComponents([LightComponent, TransformComponent]);
		const saw = new Set();
		for (const entity of entities) {
			saw.add(entity);

			const { position: lightPosition, rotation: lightRotation } = world.getComponent(entity, TransformComponent)!;

			let light = this.lights.get(entity);
			if (!light) {
				scene.light = new DirectionalLight(this.gfx, 2);
				light = scene.light;
				this.lights.set(entity, light);
			}
			light.rotation = quaternionToEuler(lightRotation);
			light.updateForCamera(scene.primaryCamera);
		}

		const removed: Array<Entity> = [...this.lights.keys()].filter(e => !saw.has(e));
		for (const entity of removed) {
			console.warn('Not implemented: Remove light', entity);
		}
	}

	updateParticles(world: World, scene: Scene) {
		const entities = world.entitiesWithComponents([ParticlesComponent, TransformComponent]);
		const saw = new Set();
		for (const entity of entities) {
			saw.add(entity);
			const { meshId, count: particleCount, emissive, offset } = world.getComponent(entity, ParticlesComponent)!;
			const { position: emitterPosition, rotation: emitterRotation } = world.getComponent(entity, TransformComponent)!;

			let particles = this.particles.get(entity);
			if (!particles) {
				const mesh: SimpleMesh = this.getResource(meshId);
				particles = scene.addMesh(new Particles(this.gfx, [], 256));
				if (particles.material instanceof SimpleMaterial) {
					particles.material.emissive = emissive;
				}
				this.particles.set(entity, particles);
				particles.object.vertexBuffer = mesh.vertexBuffer;
				particles.object.vertexCount = mesh.vertexCount;
				particles.object.variantCount = mesh.variantCount;
			}
			particles.object.origin = add(emitterPosition, offset);
			particles.object.direction = multiplyVector(rotationFromQuaternion(emitterRotation), [0, -1, 0, 0]).slice(0, 3) as Vector3;
			particles.object.update(performance.now() / 1000.0);
			particles.object.count = particleCount;
		}

		const removed: Array<Entity> = [...this.particles.keys()].filter(e => !saw.has(e));
		for (const entity of removed) {
			const pawn = this.particles.get(entity);
			this.particles.delete(entity);
			if (pawn) {
				scene.removePawn(pawn);
			}
		}
	}

	updateMeshes(world: World, scene: Scene) {
		const { device } = this.gfx;
		const entities = world.entitiesWithComponents([MeshComponent, TransformComponent]);
		const saw = new Set();
		for (const entity of entities) {
			saw.add(entity);

			const { meshId: meshResourceId } = world.getComponent(entity, MeshComponent)!;
			const transform = transformForEntity(world, entity);
			// FIXME only update if transform has changed

			let [idx, pawn] = this.meshes.get(entity) || [];
			if (pawn == null || idx == null) {
				// Create
				const mesh: SimpleMesh = this.getResource(meshResourceId);
				pawn = this.instanceMeshes.get(mesh);
				let material;
				// FIXME support different material per mesh
				const materialComp = world.getComponent(entity, MaterialComponent);
				if (materialComp) {
					material = this.getMaterialForComponent(materialComp);
				}
				else {
					material = new SimpleMaterial(this.gfx, 0xffffffff);
				}
				if (!pawn) {
					pawn = scene.addMesh(mesh, material);
					this.instanceMeshes.set(mesh, pawn);
				}
				const variantIndex = (mesh.instanceCount + 1 % mesh.variantCount);
				const colors = material.instanceColors();
				idx = mesh.pushInstance({
					transform,
					materialIndex: (material instanceof StorageMaterial) ? BigInt(material.instanceId - 1) : 0n,
					instanceColor1: colors[1],
					instanceColor2: colors[2],
					instanceColor3: colors[3],
					variantIndex: material.variantIndex | 0,
					variantBlend: material.variantIndex % 1.0,
					live: 1,
				});
				this.meshes.set(entity, [idx, pawn]);
			}

			// FIXME better field updating
			// Update the transform of the instance
			device.queue.writeBuffer(
				pawn.object.instanceBuffer,
				idx * pawn.object.instanceSize,
				new Float32Array(transform),
			);
			// Update variant
			const materialComp = world.getComponent(entity, MaterialComponent);
			if (materialComp) {
				const material = this.getMaterialForComponent(materialComp);
				material.variantIndex = materialComp.variant | 0;
				material.variantBlend = materialComp.variant % 1.0;
				const bufferOffset = idx * pawn.object.instanceSize + 16 * 4 + 4 * 4;
				device.queue.writeBuffer(
					pawn.object.instanceBuffer,
					bufferOffset,
					new Uint32Array([material.variantIndex]),
				);
				device.queue.writeBuffer(
					pawn.object.instanceBuffer,
					bufferOffset + 4,
					new Float32Array([material.variantBlend]),
				);
			}
		}

		// Remove stale meshes
		const removed: Array<Entity> = [...this.meshes.keys()].filter(e => !saw.has(e));
		if (removed.length > 0) {
			console.debug("Removing meshes", removed);
		}
		for (const entity of removed) {
			const [idx, pawn] = this.meshes.get(entity) || [];
			this.meshes.delete(entity);
			if (pawn && idx != null) {
				pawn.object.removeInstance(idx);
			}
		}
	}

	updateTerrain(world: World, scene: Scene) {
		const entities = world.entitiesWithComponent(TerrainComponent);
		const saw = new Set();
		for (const entity of entities) {
			saw.add(entity);

			const terrain = world.getComponent(entity, TerrainComponent)!;
			const materialComp = world.getComponent(entity, MaterialComponent);
			let material;
			if (materialComp) {
				material = this.getMaterialForComponent(materialComp);
			}
			else {
				material = new SimpleMaterial(this.gfx, 0xffffffff);
			}

			const colors = ColorScheme.random(terrain.colorSeed);
			// FIXME what if there's multiple terrains 1 once scene?
			if (terrain.water) {
				scene.waterColor = [...colors.scheme.water];
			}
			//if (scene.fogColor[3] > 0 && colors.scheme.fog[3] > 0) {
			//	scene.fogColor = [...colors.scheme.fog];
			//}
			this.updateTerrainQueue(entity, terrain, material);
			if (this.queuedTerrain.size === 0) {
				this.removeExpiredTerrainChunks(entity, terrain, scene);
			}
		}
		this.processTerrainQueue(scene);

		const removed: Array<Entity> = [...this.terrains.keys()].filter(e => !saw.has(e));
		for (const entity of removed) {
		}
	}

	updateDecor(world: World, scene: Scene) {
		const entities = world.entitiesWithComponent(DecorComponent);
		const terrainId = [...world.entitiesWithComponent(TerrainComponent)][0];
		if (!terrainId) return;
		const { terrainSeed } = world.getComponent(terrainId, TerrainComponent)!;
		const saw = new Set();
		for (const entity of entities) {
			saw.add(entity);
			const { seed: decorSeed, spread, radius, meshId } = world.getComponent(entity, DecorComponent)!;
			let decor = this.decors.get(entity);
			if (!decor) {
				const materialComp = world.getComponent(entity, MaterialComponent);
				console.debug('Adding Decor for entity', entity, meshId);
				const mesh: SimpleMesh = this.getResource(meshId);
				decor = scene.addMesh(new DecorMesh(this.gfx, [], [0, 0], 1.0, spread, terrainSeed, decorSeed, radius, this.heightShaderSource));
				decor.material = (materialComp && this.getMaterialForComponent(materialComp)) || decor.material;
				decor.object.vertexBuffer = mesh.vertexBuffer;
				decor.object.vertexCount = mesh.vertexCount;
				decor.object.variantCount = mesh.variantCount;
				if (decor.material instanceof SimpleMaterial) {
					// Fade out decor int he distance
					decor.material.fadeout = 8 * radius * spread;
				}
				this.decors.set(entity, decor);
			}
			decor.object.clippingPlanes = scene.primaryCamera.clippingPlanes();
			const pos = scene.primaryCamera.position;
			decor.object.move(pos[0], pos[2]);
		}

		const removed: Array<Entity> = [...this.decors.keys()].filter(e => !saw.has(e));
		for (const entity of removed) {
		}
	}

	nextResourceId() {
		return NEXT_RESOURCE_ID++;
	}

	addResource<T extends Resource>(resource: T): ResourceId {
		const id = this.nextResourceId();
		this.resources.set(id, resource);
		return id;
	}

	insertResource<T extends Resource>(id: ResourceId, resource: T) {
		this.resources.set(id, resource);
	}

	private getResource<T extends Resource>(id: ResourceId): T {
		const res = this.resources.get(id);
		if (!res) {
			throw new MissingResource(id);
		}
		return res as T;
	}

	private updateTerrainQueue(entity: Entity, terrain: TerrainComponent, material: Material) {
		for (const [key, chunk] of terrain.chunks.entries()) {
			if (this.activeTerrain.has(key) || this.queuedTerrain.has(key)) continue;
			this.queuedTerrain.set(key, {
				entity,
				terrainSeed: terrain.terrainSeed,
				size: terrain.chunkSize,
				material,
				chunk,
			});
		}
	}

	private processTerrainQueue(scene: Scene, batchSize: number = 8) {
		if (this.queuedTerrain.size === 0) return;
		const chunkies = this.queuedTerrain.keys();
		let i = 0;
		for (const key of chunkies) {
			const chunk = this.queuedTerrain.get(key);
			if (!chunk) continue;
			this.generateTerrainChunk(scene, chunk);
			this.queuedTerrain.delete(key);
			if (++i >= batchSize) break;
		}
	}

	private generateTerrainChunk(scene: Scene, queuedChunk: QueuedChunk) {
		const { entity, size: chunkSize, terrainSeed, chunk, material } = queuedChunk;
		const scale = 1 << chunk.lod;
		const chunkId: Point3 = [
			chunk.position[0] / scale | 0,
			chunk.position[1] / scale | 0,
			chunk.lod,
		];
		const position: Point3 = [
			chunkId[0] * scale * chunkSize[0],
			0,
			chunkId[1] * scale * chunkSize[1],
		];
		const key = toChunkHash(chunk);
		this.activeTerrain.set(key, chunk);
		const terrain = scene.addMesh(
			new TerrainMesh(
				scene.gfx,
				chunkSize,
				chunkId,
				terrainSeed,
				this.getTerrainPipeline(terrainSeed, new ColorScheme([255, 255, 255, 255])),
			),
			material,
			translation(...position),
		);
		if (!this.terrains.has(entity)) {
			this.terrains.set(entity, new Map());
		}
		const chunks = this.terrains.get(entity)!;
		chunks.set(toChunkHash(chunk), terrain);
	}

	private removeExpiredTerrainChunks(entity: Entity, terrain: TerrainComponent, scene: Scene) {
		const chunks = this.terrains.get(entity);
		if (!chunks) return;
		let limit = 4;
		for (const [key, _chunk] of this.activeTerrain.entries()) {
			// It's still live, skip it
			if (terrain.chunks.has(key)) continue;
			this.activeTerrain.delete(key);

			const pawn = chunks.get(key);
			if (!pawn) continue;
			// Terrain has expired, remove it
			scene.removePawn(pawn);
			chunks.delete(key);
			if (--limit < 0) {
				break;
			}
		}
	}

	private getTerrainPipeline(seed: number, colors: ColorScheme): TerrainPipeline {
		let pipeline = this.terrainPipelines.get(seed);
		if (!pipeline) {
			pipeline = new TerrainPipeline(this.gfx, colors, this.heightShaderSource);
			this.terrainPipelines.set(seed, pipeline);
		}
		return pipeline;
	}

	private getDecorPipeline(seed: number): DecorPipeline {
		let pipeline = this.decorPipelines.get(seed);
		if (!pipeline) {
			pipeline = new DecorPipeline(this.gfx, this.heightShaderSource);
			this.decorPipelines.set(seed, pipeline);
		}
		return pipeline;
	}

	private getMaterialForComponent(comp: MaterialComponent): Material {
		if (!comp) debugger;
		if (comp.custom != null) {
			const material = this.getResource<Material>(comp.custom);
			if (!material) {
				console.error("Missing material", comp.custom, comp);
			}
			return material ?? new SimpleMaterial(this.gfx, 0xff0000ff);
		} else {
			const material = new SimpleMaterial(this.gfx, 0xffffffff);
			material.color = colorToInt(comp.color);
			material.emissive = comp.emissive;
			material.noise = comp.noise;
			return material;
		}
	}

}

export class MissingResource extends Error {
	constructor(id: ResourceId) {
		super(`Resource Not Found: ${id}`);
	}
}

function transformForEntity(world: World, entity: Entity): Matrix4 {
	if (!world.hasComponent(entity, TransformComponent)) {
		return identity();
	}
	const { transform } = world.getComponent(entity, TransformComponent)!;
	return transform;
}
