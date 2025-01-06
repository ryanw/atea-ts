import { Gfx } from 'engine';
import defaultSource from './render_debug_material.wgsl';
import { Camera } from 'engine/camera';
import { GBuffer } from 'engine/gbuffer';
import { SimpleMesh } from 'engine/mesh';
import { Pawn } from 'engine/pawn';
import { MaterialPipeline } from 'engine/pipelines/material';
import { meshInstanceLayout } from 'engine/pipelines/render_mesh';
import { DebugMaterial } from 'engine/materials/debug';

export class RenderDebugMaterialPipeline extends MaterialPipeline {
	private solidPipeline: GPURenderPipeline;
	private wirePipeline: GPURenderPipeline;

	constructor(gfx: Gfx, source?: string) {
		super(gfx);

		const { device } = gfx;

		const shader = device.createShaderModule({
			label: 'RenderDebugMaterialPipeline Shader',
			code: source || defaultSource
		});

		const cameraBindGroupLayout = device.createBindGroupLayout({
			label: 'RenderDebugMaterialPipeline Bind Group Layout',
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
					buffer: {
						type: 'read-only-storage'
					}
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
			label: 'RenderDebugMaterialPipeline',
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
			primitive: { topology: 'triangle-list', frontFace: 'cw', cullMode: 'none', },
			depthStencil: {
				format: 'depth32float',
				depthWriteEnabled: true,
				depthCompare: 'less',
			}
		};
		this.solidPipeline = device.createRenderPipeline(pipelineDescriptor);
		this.wirePipeline = device.createRenderPipeline({
			...pipelineDescriptor,
			primitive: { topology: 'line-list', frontFace: 'cw', cullMode: 'none', },
		});
	}

	drawBatch(encoder: GPUCommandEncoder, pawns: Array<Pawn<SimpleMesh, DebugMaterial>>, camera: Camera, target: GBuffer) {
		if (pawns.length === 0) {
			return;
		}
		this.drawSolids(encoder, pawns.filter(p => !p.material.isWireframe), camera, target);
		this.drawWires(encoder, pawns.filter(p => p.material.isWireframe), camera, target);
	}

	drawSolids(encoder: GPUCommandEncoder, pawns: Array<Pawn<SimpleMesh, DebugMaterial>>, camera: Camera, target: GBuffer) {
		const { device } = this.gfx;

		const albedoView = target.albedo.createView();
		const normalView = target.normal.createView();
		const metaView = target.meta.createView();
		const depthView = target.depth.createView();

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
			depthStencilAttachment: { view: depthView, depthLoadOp: 'load', depthStoreOp: 'store' }
		};

		const pass = encoder.beginRenderPass(passDescriptor);
		pass.setPipeline(this.solidPipeline);

		for (const pawn of pawns) {
			if (!pawn.visible || pawn.object.vertexCount === 0 || pawn.object.instanceCount === 0) {
				continue;
			}
			const bindGroup = device.createBindGroup({
				label: 'RenderDebugMaterialPipeline Pass Bind Group',
				layout: this.solidPipeline.getBindGroupLayout(0),
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

	drawWires(encoder: GPUCommandEncoder, pawns: Array<Pawn<SimpleMesh, DebugMaterial>>, camera: Camera, target: GBuffer) {
		const { device } = this.gfx;

		const albedoView = target.albedo.createView();
		const normalView = target.normal.createView();
		const metaView = target.meta.createView();
		const depthView = target.depth.createView();

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
			depthStencilAttachment: { view: depthView, depthLoadOp: 'load', depthStoreOp: 'store' }
		};

		const pass = encoder.beginRenderPass(passDescriptor);
		pass.setPipeline(this.wirePipeline);

		for (const pawn of pawns) {
			if (!pawn.visible || pawn.object.vertexCount === 0 || pawn.object.instanceCount === 0) {
				continue;
			}
			const bindGroup = device.createBindGroup({
				label: 'RenderDebugMaterialPipeline Pass Bind Group',
				layout: this.solidPipeline.getBindGroupLayout(0),
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
