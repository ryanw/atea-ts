import { Gfx } from 'engine';
import { Pipeline } from 'engine/pipelines';
import shaderSource from './particle.wgsl';
import { UniformBuffer } from 'engine/uniform_buffer';
import { Point3, Vector3 } from 'engine/math';
import { normalize } from 'engine/math/vectors';
import { oldMeshInstanceLayout } from './render_mesh';

export const INSTANCE_SIZE = oldMeshInstanceLayout.arrayStride;
export const PARTICLE_SIZE = 4 * 4;// FIXME derive from type ParticleInstance

export class ParticlePipeline extends Pipeline {
	private pipeline: GPUComputePipeline;
	private uniformBuffer: UniformBuffer;
	private counter: GPUBuffer;
	private counterRead: GPUBuffer;

	constructor(gfx: Gfx) {
		super(gfx);

		const { device } = gfx;

		this.uniformBuffer = new UniformBuffer(gfx, [
			['origin', 'vec3f'],
			['direction', 'vec3f'],
			['time', 'f32'],
			['dt', 'f32'],
			['count', 'u32'],
			['seed', 'f32'],
		]);

		this.counter = device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
		this.counterRead = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

		const shader = device.createShaderModule({ label: 'ParticlePipeline Shader', code: shaderSource });
		const bindGroupLayout = device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {}
				},
				// Atomic counter
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage',
					}
				},
				// Instances Output
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage',
					}
				},
				// Particle Output
				{
					binding: 3,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage',
					}
				},
			]
		});

		const pipelineLayout = device.createPipelineLayout({
			bindGroupLayouts: [bindGroupLayout],
		});

		this.pipeline = gfx.device.createComputePipeline({
			label: 'ParticlePipeline',
			layout: pipelineLayout,
			compute: { module: shader, entryPoint: 'main' },
		});
	}

	async createInstanceBuffer(position: Point3, capacity: number, seed: number): Promise<[GPUBuffer, GPUBuffer]> {
		const { device } = this.gfx;

		const instances = device.createBuffer({
			label: 'ParticleMesh Instance Buffer',
			size: capacity * INSTANCE_SIZE,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
		});

		const particles = device.createBuffer({
			label: 'ParticleMesh Particle Buffer',
			size: capacity * PARTICLE_SIZE,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
		});

		//this.updateParticles(instances, particles, 0, 0, position, capacity, seed);

		return [instances, particles];
	}

	updateParticles(
		instances: GPUBuffer,
		particles: GPUBuffer,
		time: number,
		dt: number,
		origin: Point3,
		direction: Vector3,
		count: number,
		instanceCount: number,
		seed: number,
	) {
		const { device } = this.gfx;

		this.uniformBuffer.replace({ seed, time, dt, origin, direction: normalize(direction), count });
		device.queue.writeBuffer(this.counter, 0, new Uint32Array([0]));

		const enc = device.createCommandEncoder({ label: 'ParticlePipeline Command Encoder' });
		const pass = enc.beginComputePass({ label: 'ParticlePipeline Compute Pass' });

		const bindGroup = device.createBindGroup({
			label: 'ParticlePipeline Bind Group',
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				// Uniforms
				{ binding: 0, resource: this.uniformBuffer.bindingResource() },
				// Atomic counter
				{ binding: 1, resource: { buffer: this.counter } },
				// Instance output buffer
				{ binding: 2, resource: { buffer: instances } },
				// Particle output buffer
				{ binding: 3, resource: { buffer: particles } },
			],
		});

		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.dispatchWorkgroups(Math.ceil(instanceCount / 256));
		pass.end();

		// Copy vec3f to the read buffer
		// FIXME better handling of pending maps
		if (this.counterRead.mapState !== 'pending') {
			//enc.copyBufferToBuffer(this.counter, 0, this.counterRead, 0, 4);
		}
		device.queue.submit([enc.finish()]);
	}

	async getInstanceCount(): Promise<number> {
		await this.counterRead.mapAsync(GPUMapMode.READ);
		const result = new Uint32Array(this.counterRead.getMappedRange());
		const instanceCount = result[0];
		this.counterRead.unmap();
		return instanceCount;
	}
}
