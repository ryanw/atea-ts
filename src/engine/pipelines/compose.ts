import { Color, Config, Gfx } from 'engine';
import { Pipeline } from './';
import shaderSource from './compose.wgsl';
import { GBuffer } from 'engine/gbuffer';
import { UniformBuffer } from 'engine/uniform_buffer';
import { identity, inverse, multiply } from 'engine/math/transform';
import { Camera } from 'engine/camera';
import { Point3 } from 'engine/math';
import { DirectionalLight, Light } from 'engine/light';
import { ShadowMap } from 'engine/shadow_map';

/**
 * Composes a {@link GBuffer} onto a single {@link GPUTexture}
 */
export class ComposePipeline extends Pipeline {
	config: Config = {
		ditherSize: 1,
		ditherDepth: 4,
		drawEdges: false,
		renderMode: 0,
		fog: 1.0,
	};
	private pipeline: GPURenderPipeline;
	private uniformBuffer: UniformBuffer;
	private sampler: GPUSampler;

	constructor(gfx: Gfx, format?: GPUTextureFormat) {
		super(gfx);

		const { device } = gfx;

		const shader = device.createShaderModule({ label: 'ComposePipeline Shader', code: shaderSource });

		const bindGroupLayout = device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {}
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {}
				},
				// Albedo
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {}
				},
				// Normal
				{
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'unfilterable-float' }
				},
				// Depth
				{
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'unfilterable-float' }
				},
				// Meta
				{
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'uint' }
				},
				// Shadows
				{
					binding: 6,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: 'unfilterable-float' }
				},
			]
		});
		const pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [bindGroupLayout],
		});

		const blendOver: GPUBlendComponent = {
			srcFactor: 'one',
			dstFactor: 'one-minus-src-alpha',
			operation: 'add',
		};
		this.pipeline = device.createRenderPipeline({
			label: 'ComposePipeline',
			layout: pipelineLayout,
			vertex: { module: shader, entryPoint: 'vs_main' },
			fragment: {
				module: shader,
				entryPoint: 'fs_main',
				targets: [{
					format: format || gfx.format,
					blend: {
						color: blendOver,
						alpha: blendOver,
					}
				}]
			},
			primitive: { topology: 'triangle-strip' },
		});

		this.uniformBuffer = new UniformBuffer(gfx, [
			['invMvp', 'mat4x4f'],
			['light', 'vec4f'],
			['lightVp', 'mat4x4f'],
			['invLightVp', 'mat4x4f'],
			['playerPosition', 'vec3f'],
			['ditherSize', 'i32'],
			['ditherDepth', 'i32'],
			['drawEdges', 'i32'],
			['renderMode', 'i32'],
			['fog', 'f32'],
			['t', 'f32'],
		]);
		this.sampler = device.createSampler({
			addressModeU: 'clamp-to-edge',
			addressModeV: 'clamp-to-edge',
			addressModeW: 'clamp-to-edge',
			magFilter: 'nearest',
			minFilter: 'linear',
			mipmapFilter: 'linear',
			lodMinClamp: 0,
			lodMaxClamp: 1000,
			maxAnisotropy: 1,
		});
	}

	compose(
		encoder: GPUCommandEncoder,
		src: GBuffer,
		camera: Camera,
		light: DirectionalLight,
		shadows: ShadowMap,
		target: GPUTexture,
		clear: Color = [0, 0, 0, 0],
	) {
		const { device } = this.gfx;

		const targetView = target.createView();

		const cameraInvMvp = inverse(multiply(camera.projection, camera.view));
		this.uniformBuffer.replace({
			invMvp: cameraInvMvp || identity(),
			light: [...light.direction, 0],
			lightVp: multiply(light.projection, light.view),
			invLightVp: inverse(multiply(light.projection, light.view))!,
			playerPosition: camera.position,
			ditherSize: this.config.ditherSize,
			ditherDepth: this.config.ditherDepth,
			drawEdges: this.config.drawEdges,
			renderMode: this.config.renderMode,
			fog: this.config.fog,
			t: performance.now() / 1000.0,
		});

		const clearValue = clear.map(v => v / 255);
		const passDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: targetView,
					clearValue,
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
		};

		const bindGroup = device.createBindGroup({
			label: 'ComposePipeline Bind Group',
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.uniformBuffer.buffer } },
				{ binding: 1, resource: this.sampler },
				{ binding: 2, resource: src.albedo.createView() },
				{ binding: 3, resource: src.normal.createView() },
				{ binding: 4, resource: src.depth.createView() },
				{ binding: 5, resource: src.meta.createView() },
				{ binding: 6, resource: shadows.texture.createView() },
			],
		});


		const pass = encoder.beginRenderPass(passDescriptor);
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.draw(4, 1, 0, 0);
		pass.end();
	}
}
