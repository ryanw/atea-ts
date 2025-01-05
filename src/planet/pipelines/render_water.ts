import { Gfx } from 'engine';
import renderSource from './render_water.wgsl';
import renderBackSource from './render_back_water.wgsl';
import { Camera } from 'engine/camera';
import { SimpleMesh } from 'engine/mesh';
import { Pawn } from 'engine/pawn';
import { MaterialPipeline } from 'engine/pipelines/material';
import { oldMeshInstanceLayout } from 'engine/pipelines/render_mesh';

export class RenderWaterPipeline extends MaterialPipeline {
	private pipeline!: GPURenderPipeline;
	private fillDepthPipeline!: GPURenderPipeline;

	constructor(gfx: Gfx) {
		super(gfx);

		this.buildRenderPipeline();
		this.buildFillPipeline();
	}

	buildFillPipeline() {
		const { device } = this.gfx;

		const shader = device.createShaderModule({
			label: 'RenderBackWaterPipeline Shader',
			code: renderBackSource,
		});

		const cameraBindGroupLayout = device.createBindGroupLayout({
			label: 'RenderBackWaterPipeline Bind Group Layout',
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
			label: 'RenderBackWaterPipeline',
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
		this.fillDepthPipeline = device.createRenderPipeline(pipelineDescriptor);
	}

	buildRenderPipeline(source?: string) {
		const { device } = this.gfx;

		const shader = device.createShaderModule({
			label: 'RenderWaterPipeline Shader',
			code: renderSource
		});

		const cameraBindGroupLayout = device.createBindGroupLayout({
			label: 'RenderWaterPipeline Bind Group Layout',
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
			]
		});
		const pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [cameraBindGroupLayout],
		});

		const blendOver: GPUBlendComponent = {
			srcFactor: 'one',
			dstFactor: 'one-minus-src-alpha',
			operation: 'add',
		};
		const pipelineDescriptor: GPURenderPipelineDescriptor = {
			label: 'RenderWaterPipeline',
			layout: pipelineLayout,
			vertex: {
				module: shader,
				entryPoint: 'vs_main',
				buffers: [oldMeshInstanceLayout]
			},
			fragment: {
				module: shader,
				entryPoint: 'fs_main',
				targets: [{
					format: this.gfx.format,
					blend: {
						color: blendOver,
						alpha: blendOver,
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
			depthStencilAttachment:  {
				view: depthView,
				depthLoadOp: 'load',
				depthStoreOp: 'store',
			}
		};

		const pass = encoder.beginRenderPass(passDescriptor);
		pass.setPipeline(this.fillDepthPipeline);

		for (const pawn of pawns) {
			if (!pawn.visible || pawn.object.vertexCount === 0 || pawn.object.instanceCount === 0) {
				continue;
			}
			const bindGroup = device.createBindGroup({
				label: 'RenderBackWaterPipeline Pass Bind Group',
				layout: this.fillDepthPipeline.getBindGroupLayout(0),
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

	drawTransparencies(encoder: GPUCommandEncoder, pawns: Array<Pawn<SimpleMesh>>, camera: Camera, depth: GPUTexture, target: GPUTexture) {
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
				label: 'RenderWaterPipeline Pass Bind Group',
				layout: this.pipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: camera.uniform.bindingResource() },
					{ binding: 1, resource: pawn.bindingResource() },
					{ binding: 2, resource: pawn.material.bindingResource() },
					{ binding: 3, resource: { buffer: pawn.object.vertexBuffer } },
					{ binding: 4, resource: depthView },
				],
			});
			pass.setBindGroup(0, bindGroup);
			pass.setVertexBuffer(0, pawn.object.instanceBuffer);
			pass.draw(pawn.object.vertexCount, pawn.object.instanceCount);
		}
		pass.end();
	}
}
