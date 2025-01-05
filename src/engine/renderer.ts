import { Color, Constructor, Gfx } from 'engine';
import { ComposePipeline } from './pipelines/compose';
import { RenderMeshPipeline } from './pipelines/render_mesh';
import { Camera } from './camera';
import { GBuffer } from './gbuffer';
import { SimpleMesh } from './mesh';
import { Pawn, isPawnOf } from './pawn';
import { DotMaterial, Material, SimpleMaterial } from './material';
import { MaterialPipeline } from './pipelines/material';
import { RenderDotPipeline } from './pipelines/render_dot';
import { ShadowMap } from './shadow_map';
import { Scene } from './scene';
import { DirectionalLight } from './light';

export interface RenderPipelines {
	compose: ComposePipeline,
	materials: Map<Constructor<Material>, MaterialPipeline>,
}

export class Renderer {
	pipelines: RenderPipelines;

	constructor(readonly gfx: Gfx) {
		this.pipelines = {
			compose: new ComposePipeline(gfx),
			materials: new Map()
		};
		this.registerMaterial(SimpleMaterial, new RenderMeshPipeline(gfx));
		this.registerMaterial(DotMaterial, new RenderDotPipeline(gfx));
	}

	registerMaterial<M extends Material, P extends MaterialPipeline>(material: Constructor<M>, pipeline: P) {
		this.pipelines.materials.set(material, pipeline);
	}

	getMaterialPipeline<M extends Material>(material: M): MaterialPipeline | undefined {
		let constructor = material.constructor;
		while (constructor != null) {
			const pipeline = this.pipelines.materials.get(constructor as Constructor<SimpleMaterial>);
			if (pipeline) {
				return pipeline;
			}
			constructor = Object.getPrototypeOf(constructor);
		}
		console.error('Failed to find pipeline for', material);
	}

	drawSceneShadows(encoder: GPUCommandEncoder, scene: Scene, light: DirectionalLight, target: ShadowMap) {
		this.clearShadows(encoder, target);

		// Group entities by material, render them together if possible
		for (const [Mat, pipeline] of this.pipelines.materials.entries()) {
			function isValidMesh(entity: Pawn<unknown>): entity is Pawn<SimpleMesh> {
				return isPawnOf(entity, SimpleMesh) && (entity.material instanceof Mat);
			}

			const entities = scene.pawns.filter(isValidMesh);
			pipeline.drawShadowMapBatch(encoder, entities, light, target);
		}
	}

	drawScene(encoder: GPUCommandEncoder, scene: Scene, camera: Camera, target: GBuffer) {
		const [w, h] = target.size;
		camera.aspect = w / h;
		this.clear(encoder, target);


		// Group entities by material, render them together if possible
		for (const [Mat, pipeline] of this.pipelines.materials.entries()) {
			function isValidMesh(entity: Pawn<unknown>): entity is Pawn<SimpleMesh> {
				// Don't render materials needing forward rendering
				if (entity.material.forwardRender) return false;
				return isPawnOf(entity, SimpleMesh) && (entity.material instanceof Mat);
			}

			const entities = scene.pawns.filter(isValidMesh);
			pipeline.drawBatch(encoder, entities, camera, target);
		}
	}

	drawTransparencies(encoder: GPUCommandEncoder, scene: Scene, camera: Camera, depth: GPUTexture, target: GPUTexture) {
		// Group entities by material, render them together if possible
		for (const [Mat, pipeline] of this.pipelines.materials.entries()) {
			function isValidMesh(entity: Pawn<unknown>): entity is Pawn<SimpleMesh> {
				// Don't render materials using deferred rendering
				if (!entity.material.forwardRender) return false;
				return isPawnOf(entity, SimpleMesh) && (entity.material instanceof Mat);
			}

			const entities = scene.pawns.filter(isValidMesh);
			pipeline.drawTransparencies(encoder, entities, camera, depth, target);
		}
	}

	compose(
		encoder: GPUCommandEncoder,
		src: GBuffer,
		camera: Camera,
		light: DirectionalLight,
		shadows: ShadowMap,
		target: GPUTexture,
		waterColor: Color | number,
		fogColor: Color | number,
		clear?: Color,
	) {
		this.pipelines.compose.compose(encoder, src, camera, light, shadows, target, waterColor, fogColor, clear);
	}

	clear(encoder: GPUCommandEncoder, target: GBuffer) {
		const clearValue = { r: 0, g: 0, b: 0, a: 0 };
		const albedoView = target.albedo.createView();
		const normalView = target.normal.createView();
		const metaView = target.meta.createView();
		const depthView = target.depth.createView();

		encoder.beginRenderPass({
			colorAttachments: [
				{
					view: albedoView,
					clearValue,
					loadOp: 'clear',
					storeOp: 'store',
				},
				{
					view: normalView,
					clearValue,
					loadOp: 'clear',
					storeOp: 'store',
				},
				{
					view: metaView,
					clearValue,
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
			depthStencilAttachment: {
				view: depthView,
				depthClearValue: 1.0,
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
			}
		}).end();
	}

	clearShadows(encoder: GPUCommandEncoder, target: ShadowMap) {
		const layerCount = target.texture.depthOrArrayLayers;
		for (let i = 0; i < layerCount; i++) {
			const depthView = target.texture.createView({
				dimension: '2d-array',
				baseArrayLayer: i,
				arrayLayerCount: 1,
			});
			encoder.beginRenderPass({
				label: 'Clear Shadows Pass',
				colorAttachments: [],
				depthStencilAttachment: {
					view: depthView,
					depthClearValue: 1.0,
					depthLoadOp: 'clear',
					depthStoreOp: 'store',
				}
			}).end();
		}
	}
}
