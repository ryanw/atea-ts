import { Gfx } from 'engine';
import defaultSource from './render_mesh.wgsl';
import { EulerCamera } from 'engine/camera';
import { GBuffer } from 'engine/gbuffer';
import { SimpleMesh } from 'engine/mesh';
import { Pawn } from 'engine/pawn';
import { MaterialPipeline } from './material';
import { ShadowMap } from 'engine/shadow_map';
import { DirectionalLight } from 'engine/light';

/**
 * Render Pipeline to draw {@link SimpleMesh} instances to a {@link GBuffer}
 */
export class RenderMeshPipeline extends MaterialPipeline {
	private pipeline: GPURenderPipeline;
	private pipelineShadowMap: GPURenderPipeline;
	private pipelineNoDepth: GPURenderPipeline;

	constructor(gfx: Gfx, source?: string) {
		super(gfx);

		const { device } = gfx;

		const shader = device.createShaderModule({ label: 'RenderMeshPipeline Shader', code: source || defaultSource });

		const cameraBindGroupLayout = device.createBindGroupLayout({
			label: 'RenderMeshPipeline Bind Group Layout',
			entries: [
				// Camera
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {}
				},
				// Entity
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: {}
				},
				// Material
				{
					binding: 2,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {}
				},
				// Vertices
				{
					binding: 3,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
					}
				},
			]
		});
		const pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [cameraBindGroupLayout],
		});

		const pipelineDescriptor: GPURenderPipelineDescriptor = {
			label: 'RenderMeshPipeline',
			layout: pipelineLayout,
			vertex: {
				module: shader,
				entryPoint: 'vs_main',
				buffers: [meshInstanceLayout]
			},
			fragment: {
				module: shader,
				entryPoint: 'fs_main',
				targets: [
					// Albedo output
					{
						format: 'rgba16float', blend: {
							alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
							color: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
						}
					},
					// Normal output
					{
						format: 'rgba16float', blend: {
							alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'zero' },
							color: { operation: 'add', srcFactor: 'one', dstFactor: 'zero' },
						}
					},
					// Meta output
					{ format: 'r8uint' },
				]
			},
			primitive: { topology: 'triangle-list', frontFace: 'cw', cullMode: 'back', },
			depthStencil: {
				format: 'depth32float',
				depthWriteEnabled: true,
				depthCompare: 'less',
			}
		};
		this.pipeline = device.createRenderPipeline(pipelineDescriptor);

		this.pipelineNoDepth = device.createRenderPipeline({
			...pipelineDescriptor,
			depthStencil: {
				format: 'depth32float',
				depthWriteEnabled: false,
				depthCompare: 'less',
			}
		});

		const pipelineShadowDescriptor: GPURenderPipelineDescriptor = {
			label: 'RenderMeshPipeline ShadowMap',
			layout: pipelineLayout,
			vertex: {
				module: shader,
				entryPoint: 'vs_main',
				buffers: [meshInstanceLayout],
			},
			fragment: {
				module: shader,
				entryPoint: 'fs_main',
				targets: [
					// No targets other than depth
				]
			},
			primitive: { topology: 'triangle-list', frontFace: 'cw', cullMode: 'front', },
			depthStencil: {
				format: 'depth32float',
				depthWriteEnabled: true,
				depthCompare: 'less',
			}
		};
		this.pipelineShadowMap = device.createRenderPipeline(pipelineShadowDescriptor);
	}

	drawShadowMapBatch(encoder: GPUCommandEncoder, pawns: Array<Pawn<SimpleMesh>>, light: DirectionalLight, target: ShadowMap) {
		if (pawns.length === 0) {
			return;
		}
		const { device } = this.gfx;

		const shadowLayerCount = light.cascades.length;
		for (let i = 0; i < shadowLayerCount; i++) {
			const depthView = target.texture.createView({
				label: `RenderMeshPipeline ShadowMap[${i}] DepthView`,
				dimension: '2d-array',
				baseArrayLayer: i,
				arrayLayerCount: 1,
			});

			const passDescriptor: GPURenderPassDescriptor = {
				label: `RenderMeshPipeline ShadowMap[${i}] Render Pass`,
				colorAttachments: [],
				depthStencilAttachment: {
					view: depthView,
					depthLoadOp: 'load',
					depthStoreOp: 'store',
				}
			};

			const pass = encoder.beginRenderPass(passDescriptor);
			pass.setPipeline(this.pipelineShadowMap);

			for (const src of pawns) {
				if (!src.visible || src.object.vertexCount === 0 || src.object.instanceCount === 0) {
					continue;
				}
				const bindGroup = device.createBindGroup({
					label: `RenderMeshPipeline ShadowMap[${i}] Bind Group`,
					layout: this.pipeline.getBindGroupLayout(0),
					entries: [
						// @ts-ignore
						{ binding: 0, resource: ('uniforms' in light ? light.uniforms[i] : light.uniform).bindingResource() },
						{ binding: 1, resource: src.bindingResource() },
						{ binding: 2, resource: src.material.bindingResource() },
						{ binding: 3, resource: { buffer: src.object.vertexBuffer } },
					],
				});
				pass.setBindGroup(0, bindGroup);
				pass.setVertexBuffer(0, src.object.instanceBuffer);
				pass.draw(src.object.vertexCount, src.object.instanceCount);
			}
			pass.end();
		}
	}

	drawBatch(encoder: GPUCommandEncoder, pawns: Array<Pawn<SimpleMesh>>, camera: EulerCamera, target: GBuffer) {
		if (pawns.length === 0) {
			return;
		}
		const { device } = this.gfx;

		const albedoView = target.albedo.createView();
		const normalView = target.normal.createView();
		const metaView = target.meta.createView();
		const depthView = target.depth.createView();
		// FIXME assumes all entities use same material
		const writeDepth = pawns[0].material.writeDepth;

		const baseAttachment: Omit<GPURenderPassColorAttachment, 'view'> = {
			clearValue: [0, 0, 0, 0],
			loadOp: 'load',
			storeOp: 'store',
		};

		const passDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{ view: albedoView, ...baseAttachment },
				{ view: normalView, ...baseAttachment },
				{ view: metaView, ...baseAttachment },
			],
			depthStencilAttachment: writeDepth
				? { view: depthView, depthLoadOp: 'load', depthStoreOp: 'store' }
				: { view: depthView, depthReadOnly: true }
		};

		const pass = encoder.beginRenderPass(passDescriptor);
		pass.setPipeline(writeDepth ? this.pipeline : this.pipelineNoDepth);

		for (const pawn of pawns) {
			if (!pawn.visible || pawn.object.vertexCount === 0 || pawn.object.instanceCount === 0) {
				continue;
			}
			const bindGroup = device.createBindGroup({
				label: 'RenderMeshPipeline Pass Bind Group',
				layout: this.pipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: camera.uniform.bindingResource() },
					{ binding: 1, resource: pawn.bindingResource() },
					{ binding: 2, resource: pawn.material.bindingResource() },
					{ binding: 3, resource: { buffer: pawn.object.vertexBuffer } },
				],
			});
			pass.setBindGroup(0, bindGroup);
			pass.setVertexBuffer(0, pawn.object.instanceBuffer);
			pass.draw(pawn.object.vertexCount, pawn.object.instanceCount);
		}
		pass.end();
	}
}

export const meshInstanceLayout: GPUVertexBufferLayout = {
	stepMode: 'instance',
	attributes: [
		// Transform
		{ shaderLocation: 3, offset: 0, format: 'float32x4' },
		{ shaderLocation: 4, offset: 16, format: 'float32x4' },
		{ shaderLocation: 5, offset: 32, format: 'float32x4' },
		{ shaderLocation: 6, offset: 48, format: 'float32x4' },
		// Instance Colors
		{ shaderLocation: 7, offset: 64, format: 'uint32x4' },
		// Variant Index
		{ shaderLocation: 8, offset: 80, format: 'uint32' },
		// Variant Blend
		{ shaderLocation: 9, offset: 84, format: 'float32' },
		// Live
		{ shaderLocation: 10, offset: 88, format: 'uint32' },
	],
	arrayStride: 92,
};
