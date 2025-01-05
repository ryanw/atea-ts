import { Gfx } from 'engine';
import renderSource from './render_star.wgsl';
import renderBackSource from './render_back_star.wgsl';
import { Camera } from 'engine/camera';
import { SimpleMesh } from 'engine/mesh';
import { Pawn } from 'engine/pawn';
import { MaterialPipeline } from 'engine/pipelines/material';
import { meshInstanceLayout as oldMeshInstanceLayout } from 'engine/pipelines/render_mesh';
import { StarMaterial } from '../materials/star';

export type StarPawn = Pawn<SimpleMesh, StarMaterial>;

export class RenderStarPipeline extends MaterialPipeline {
	private pipeline!: GPURenderPipeline;
	private backPipeline!: GPURenderPipeline;

	constructor(gfx: Gfx) {
		super(gfx);

		this.buildPipeline();
		this.buildBackPipeline();
	}

	buildBackPipeline() {
		const { device } = this.gfx;

		const shader = device.createShaderModule({
			label: 'RenderBackStarPipeline Shader',
			code: renderBackSource,
		});

		const cameraBindGroupLayout = device.createBindGroupLayout({
			label: 'RenderBackStarPipeline Bind Group Layout',
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
			label: 'RenderBackStarPipeline',
			layout: pipelineLayout,
			vertex: {
				module: shader,
				entryPoint: 'vs_main',
				buffers: [oldMeshInstanceLayout]
			},
			fragment: {
				module: shader,
				entryPoint: 'fs_main',
				targets: []
			},
			primitive: { topology: 'triangle-list', frontFace: 'cw', cullMode: 'front' },
			depthStencil: {
				format: 'depth32float',
				depthWriteEnabled: true,
				depthCompare: 'less',
			}
		};
		this.backPipeline = device.createRenderPipeline(pipelineDescriptor);
	}

	buildPipeline() {
		const { device } = this.gfx;

		const shader = device.createShaderModule({
			label: 'RenderStarPipeline Shader',
			code: renderSource
		});

		const cameraBindGroupLayout = device.createBindGroupLayout({
			label: 'RenderStarPipeline Bind Group Layout',
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
				// Depth buffer
				{
					binding: 4,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					texture: {
						sampleType: 'depth'
					}
				},
				// Materials
				{
					binding: 5,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage'
					}
				},
			]
		});
		const pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [cameraBindGroupLayout],
		});

		const pipelineDescriptor: GPURenderPipelineDescriptor = {
			label: 'RenderStarPipeline',
			layout: pipelineLayout,
			vertex: {
				module: shader,
				entryPoint: 'vs_main',
				buffers: [meshInstanceLayout]
			},
			fragment: {
				module: shader,
				entryPoint: 'fs_main',
				targets: [{
					format: this.gfx.format,
					blend: {
						color: {
							srcFactor: 'src-alpha',
							dstFactor: 'one-minus-src-alpha',
							operation: 'add',
						},
						alpha: {
							srcFactor: 'one',
							dstFactor: 'one-minus-src-alpha',
							operation: 'add',
						},
					}
				}]
			},
			primitive: { topology: 'triangle-list', frontFace: 'cw', cullMode: 'back' },
		};
		this.pipeline = device.createRenderPipeline(pipelineDescriptor);
	}

	drawBackDepth(encoder: GPUCommandEncoder, pawns: Array<Pawn<SimpleMesh>>, camera: Camera, depth: GPUTexture) {
		if (pawns.length === 0) {
			return;
		}
		const { device } = this.gfx;

		const depthView = depth.createView();
		const writeDepth = pawns[0].material.writeDepth;
		if (!writeDepth) return;

		// Only writing to depth
		const passDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [],
			depthStencilAttachment: {
				view: depthView,
				depthLoadOp: 'load',
				depthStoreOp: 'store',
			}
		};

		const pass = encoder.beginRenderPass(passDescriptor);
		pass.setPipeline(this.backPipeline);

		for (const pawn of pawns) {
			if (!pawn.visible || pawn.object.vertexCount === 0 || pawn.object.instanceCount === 0) {
				continue;
			}
			const bindGroup = device.createBindGroup({
				label: 'RenderBackStarPipeline Pass Bind Group',
				layout: this.backPipeline.getBindGroupLayout(0),
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

	drawTransparencies(encoder: GPUCommandEncoder, pawns: Array<StarPawn>, camera: Camera, depth: GPUTexture, target: GPUTexture) {
		if (pawns.length === 0) {
			return;
		}
		this.drawBackDepth(encoder, pawns, camera, depth);
		const { device } = this.gfx;

		const depthView = depth.createView();

		const baseAttachment: Omit<GPURenderPassColorAttachment, 'view'> = {
			clearValue: [0, 0, 0, 0],
			loadOp: 'load',
			storeOp: 'store',
		};

		const passDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{ view: target.createView(), ...baseAttachment },
			],
		};

		const pass = encoder.beginRenderPass(passDescriptor);
		pass.setPipeline(this.pipeline);

		for (const pawn of pawns) {
			if (!pawn.visible || pawn.object.vertexCount === 0 || pawn.object.instanceCount === 0) {
				continue;
			}
			const bindGroup = device.createBindGroup({
				label: 'RenderStarPipeline Pass Bind Group',
				layout: this.pipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: camera.uniform.bindingResource() },
					{ binding: 1, resource: pawn.bindingResource() },
					{ binding: 2, resource: pawn.material.bindingResource() },
					{ binding: 3, resource: { buffer: pawn.object.vertexBuffer } },
					{ binding: 4, resource: depthView },
					{ binding: 5, resource: pawn.material.constructor.bindingResource() }
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
		// Material index
		{ shaderLocation: 7, offset: 64, format: 'uint32' },
		// Instance Colors
		{ shaderLocation: 8, offset: 68, format: 'uint32x3' },
		// Variant Index
		{ shaderLocation: 9, offset: 80, format: 'uint32' },
		// Variant Blend
		{ shaderLocation: 10, offset: 84, format: 'float32' },
		// Live
		{ shaderLocation: 11, offset: 88, format: 'uint32' },
	],
	arrayStride: 92,
};
