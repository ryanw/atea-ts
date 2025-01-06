import { Matrix4 } from './math';
import { Material, SimpleMaterial } from './material';
import { Color, Gfx } from 'engine';
import { Mesh, SimpleMesh } from './mesh';
import { ShadowBuffer } from './shadow_buffer';
import { Pawn } from './pawn';
import { EulerCamera, ClippingPlanes, Camera } from './camera';
import { transformPoint } from './math/transform';
import { dot, magnitude, subtract } from './math/vectors';
import { DirectionalLight } from './light';
import { TerrainMesh } from './terrain_mesh';

export type AddArguments = Parameters<Scene['addPawn']> | Parameters<Scene['addMesh']>;
export type CameraId = number;

/**
 * Contains the graph of all GPU objects draw in a scene
 */
export class Scene {
	clearColor: Color = [0, 0, 0, 0];
	waterColor: Color = [0, 0, 0, 0];
	fogColor: Color = [0, 0, 0, 0];
	pawns: Array<Pawn<unknown>> = [];
	cameras: Array<Camera> = [];
	currentCameraId = 0;
	primaryCameraId = 0;
	shadowBuffer: ShadowBuffer;
	light: DirectionalLight;

	constructor(readonly gfx: Gfx) {
		this.addCamera(new EulerCamera(gfx));
		this.light = new DirectionalLight(gfx);
		this.shadowBuffer = new ShadowBuffer(gfx, 32);
		this.light.rotate(0.2, -0.3);
		this.shadowBuffer.push({
			position: [0.0, 1000.0, 0.0],
			radius: 0.2,
			umbra: 0.33,
			shape: 0,
			color: 0xff00ffff,
		});
	}

	get activeCamera(): Camera {
		return this.cameras[this.currentCameraId % this.cameras.length];
	}

	get primaryCamera(): Camera {
		return this.cameras[this.primaryCameraId % this.cameras.length];
	}

	nextCamera() {
		this.currentCameraId = (this.currentCameraId + 1) % this.cameras.length;
	}

	prevCamera() {
		this.currentCameraId -= 1;
		if (this.currentCameraId < 0) {
			this.currentCameraId = this.cameras.length - 1;
		}
	}

	add(...args: AddArguments): Pawn<unknown> | void {
		// FIXME this is a big hacky
		if (args[0] instanceof Pawn) {
			return this.addPawn(...(args as Parameters<Scene['addPawn']>));
		}
		else if (args[0] instanceof SimpleMesh) {
			return this.addMesh(...args as Parameters<Scene['addMesh']>);
		}
	}

	addCamera<T extends Camera>(camera: T): CameraId {
		this.cameras.push(camera);

		return this.cameras.length - 1;
	}

	addPawn<T>(pawn: Pawn<T>): Pawn<T> {
		this.pawns.push(pawn);
		return pawn;
	}

	addMesh<T extends Mesh<any, any>>(item: T, material?: undefined, transform?: Matrix4): Pawn<T, Material>;
	addMesh<T extends Mesh<any, any>, M extends Material>(item: T, material: M, transform?: Matrix4): Pawn<T, M>;
	addMesh<T extends Mesh<any, any>, M extends Material>(item: T, material?: M, transform?: Matrix4): Pawn<T, M | Material> {
		return this.addPawn(new Pawn(
			this.gfx,
			item,
			material ?? new SimpleMaterial(this.gfx, 0xffffffff),
			transform
		));
	}

	updateMeshTransform<T extends Mesh<any, any>>(pawn: Pawn<T>, index: number, transform: Matrix4) {
		if (!pawn.object.instanceBuffer) return;
		// FIXME better field updating
		this.gfx.device.queue.writeBuffer(
			pawn.object.instanceBuffer,
			index * pawn.object.instanceSize,
			new Float32Array(transform),
		);
	}

	removePawn(pawn: Pawn<unknown>) {
		this.pawns = this.pawns.filter(e => e !== pawn);
		pawn.destroy();
	}

	frustumClip(planes: ClippingPlanes) {
		pawnLoop:
		for (const pawn of this.pawns) {
			if (pawn.object instanceof TerrainMesh) {
				pawn.visible = true;
				const mesh = pawn.object;
				const lod = mesh.chunkId[2];
				const meshScale = 1 << lod;
				const radius = magnitude(pawn.object.size) * meshScale;


				// FIXME bottom (3) is clipping too much
				for (const plane of planes.filter((_, i) => i != 3)) {
					const n = plane[1];
					const o = plane[0];
					const p = transformPoint(pawn.transform, [0, 0, 0]);
					const vp = subtract(p, o);
					const vd = dot(vp, n);
					pawn.visible = vd < radius;
					if (!pawn.visible) {
						continue pawnLoop;
					}
				}
			}
		}
	}
}

