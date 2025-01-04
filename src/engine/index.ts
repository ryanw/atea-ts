import { Camera } from './camera';
import { GBuffer } from './gbuffer';
import { Material } from './material';
import { Matrix4, Point3, Vector2, Vector3 } from './math';
import { transformPoint } from './math/transform';
import { add, cross, normalize, scale, subtract } from './math/vectors';
import { NormalVertex } from './mesh';
import { MaterialPipeline } from './pipelines/material';
import { Renderer } from './renderer';
import { Scene } from './scene';
import { ShadowMap } from './shadow_map';

export { Color } from './color';
export type Size = Vector2;
export type Constructor<T> = new (...args: Array<any>) => T;
export type Triangle = [Point3, Point3, Point3];
export type Volume = { position: Point3, size: Vector3, rotation: Matrix4 };

export type MaterialTuple = [
	new (...args: any[]) => Material,
	new (gfx: Gfx) => MaterialPipeline,
];

export interface Config {
	ditherSize: number;
	ditherDepth: number;
	drawEdges: number;
	drawShadows: boolean;
	renderMode: number;
	fog: number;
}

/**
 * Main rendering context, all access to the GPU goes through this.
 *
 * @example
 * const canvas = document.querySelector('canvas');
 * const gfx = await Gfx.attach(canvas);
 * const scene = new Scene();
 * scene.add(new Entity(
 *   gfx,
 *   new Cube(gfx),
 *   new Material([200, 80, 20, 255]),
 * ));
 * const camera = new Camera();
 * await gfx.draw(scene, camera);
 */
export class Gfx {
	pixelRatio: number = 1;
	canvasPixelRatio: number = window.devicePixelRatio || 1;
	framecap: number = 0;
	readonly context: GPUCanvasContext;
	readonly format: GPUTextureFormat;
	readonly gbuffer: GBuffer;
	readonly shadowMap: ShadowMap;
	private drawShadows: boolean = true;
	private renderer: Renderer;
	private frameSample: number = 128;
	private frameTimes: Array<number> = [];
	private uncappedFrameTimes: Array<number> = [];

	/**
	 * Initialise the WebGPU Context and return a new Gfx instance
	 */
	static async attach(canvas: HTMLCanvasElement): Promise<Gfx> {
		if (!navigator?.gpu) throw new UnsupportedError();
		const adapter = await navigator.gpu.requestAdapter();
		try {
			adapter?.requestAdapterInfo().then(info => console.info("Got GPU:", info));
		} catch (e) {
		}
		if (!adapter) throw new UnsupportedError();
		const device = await adapter.requestDevice({
			requiredFeatures: ['timestamp-query'],
		});
		if (!device) throw new UnsupportedError();
		return new Gfx(canvas, adapter, device);
	}

	/**
	 * Initialise the WebGPU Context and return a new Gfx instance.
	 * Will `alert()` if there is an exception initialising the GPU.
	 */
	static async attachNotified(canvas: HTMLCanvasElement): Promise<Gfx> {
		try {
			return await Gfx.attach(canvas);
		}
		catch (e: unknown) {
			alert(e?.toString?.() || 'An unknown error occured');
			throw e;
		}
	}

	/**
	 * Construct a new {@link Gfx} from a WebGPU Adapter and Device.
	 * What you instead probably want to use is {@link Gfx.attach}
	 */
	constructor(
		/**
		 * Canvas element to attach to. It must not have had a graphics context already created.
		 */
		readonly canvas: HTMLCanvasElement,
		/**
		 * WebGPU adapter interface
		 */
		readonly adapter: GPUAdapter,
		/**
		 * WebGPU logical device
		 */
		readonly device: GPUDevice,
	) {
		canvas.setAttribute('tabIndex', '0');
		canvas.focus();
		this.format = navigator.gpu.getPreferredCanvasFormat();
		this.context = canvas.getContext('webgpu') as GPUCanvasContext;
		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: 'premultiplied',
		});

		this.shadowMap = new ShadowMap(this, [2048, 2048, 8]);
		this.gbuffer = new GBuffer(this);
		this.updateSize();

		this.renderer = new Renderer(this);

		const resizeObserver = new ResizeObserver(() => this.updateSize());
		resizeObserver.observe(this.canvas.parentElement!);

	}

	/**
	 * GPUTexture that will be drawn to the screen
	 */
	get currentTexture(): GPUTexture {
		return this.context.getCurrentTexture();
	}

	/**
	 * Pixel size of the canvas after scaling
	 */
	get canvasSize(): Size {
		const w = this.canvas.clientWidth * this.canvasPixelRatio | 0;
		const h = this.canvas.clientHeight * this.canvasPixelRatio | 0;
		return [w, h];
	}

	/**
	 * Pixel size of the image drawn to screen
	 */
	get framebufferSize(): Size {
		return this.canvasSize.map(v => v * this.pixelRatio) as Size;
	}

	/**
	 * Current frames per second
	 */
	get fps(): number {
		if (this.frameTimes.length < this.frameSample) {
			return 0;
		}
		const total = this.frameTimes.reduce((a, dt) => a + 1 / dt, 0);
		return total / this.frameTimes.length;
	}

	/**
	 * Potential framerate if vsync was disabled
	 */
	get uncappedFps(): number {
		if (this.uncappedFrameTimes.length < this.frameSample) {
			return 0;
		}
		const total = this.uncappedFrameTimes.reduce((a, dt) => a + 1 / dt, 0);
		return total / this.uncappedFrameTimes.length;
	}

	configure(config: Partial<Config & { canvasPixelRatio: number }>) {
		if (config.canvasPixelRatio && config.canvasPixelRatio !== this.canvasPixelRatio) {
			this.canvasPixelRatio = config.canvasPixelRatio;
			this.updateSize();
		}
		if (config.drawShadows != null) {
			this.drawShadows = config.drawShadows;
		}
		Object.assign(
			this.renderer.pipelines.compose.config,
			config,
		);
	}

	registerMaterial<M extends Material, P extends MaterialPipeline>(material: Constructor<M>, pipeline: P) {
		this.renderer.registerMaterial(material, pipeline);
	}

	registerMaterials(materials: Array<MaterialTuple>) {
		for (const [mat, pipe] of materials) {
			this.registerMaterial(mat, new pipe(this));
		}
	}

	/**
	 * Updates the HTMLCanvasElement's width and height attributes to match its actual rendered pixel size
	 */
	updateSize() {
		const w = Math.floor(this.canvas.parentElement!.clientWidth * this.canvasPixelRatio);
		const h = Math.floor(this.canvas.parentElement!.clientHeight * this.canvasPixelRatio);
		this.canvas.setAttribute('width', w.toFixed(0));
		this.canvas.setAttribute('height', h.toFixed(0));
		// Hack for odd numbers causing weird scaling
		this.canvas.style.width = (w / this.canvasPixelRatio) + 'px';
		this.canvas.style.height = (h / this.canvasPixelRatio) + 'px';
	}

	/**
	 * Draw a {@link Scene} to the internal {@link GBuffer}
	 */
	async draw(scene: Scene, camera: Camera) {
		this.gbuffer.size = this.framebufferSize;
		await this.encode(async (encoder) => {
			if (this.drawShadows) {
				this.renderer.drawSceneShadows(encoder, scene, scene.light, this.shadowMap);
			}
			this.renderer.drawScene(encoder, scene, camera, this.gbuffer);
			this.renderer.compose(
				encoder,
				this.gbuffer,
				camera,
				scene.light,
				this.shadowMap,
				this.currentTexture,
				scene.waterColor,
				scene.fogColor,
				scene.clearColor,
			);
			this.renderer.drawTransparencies(encoder, scene, camera, this.gbuffer.depth, this.currentTexture);
		});
	}

	/**
	 * Create and submit a GPUCommandEncoder filled using an async callback
	 */
	async encode(callback: (encoder: GPUCommandEncoder) => Promise<void>) {
		const { device } = this;
		const encoder = device.createCommandEncoder({ label: "Root Encoder" });
		await callback(encoder);
		if (this.gbuffer.size.join(',') !== this.framebufferSize.join(',')) {
			// Canvas resized during render, ignore this draw
			return;
		}
		device.queue.submit([encoder.finish()]);
	}

	/**
	 * Start an infinite draw loop, running the callback before drawing each frame
	 */
	run(callback: (dt: number, gfx: Gfx) => Promise<void>) {
		let now = performance.now();
		let dt = 0;
		const draw = async () => {
			dt = (performance.now() - now) / 1000;
			now = performance.now();
			await callback(dt, this);

			if (this.framecap) {
				// How long the draw took
				const ft = performance.now() - now;
				const delay = (1000 / this.framecap) - ft;
				if (delay > 0) {
					setTimeout(draw, delay);
				}
				else {
					requestAnimationFrame(draw);
				}
			} else {
				requestAnimationFrame(draw);
			}

			this.sampleFrame(dt);
			const ft = (performance.now() - now) / 1000;
			this.sampleUncappedFrame(ft);
		};
		draw();
	}

	private sampleFrame(dt: number) {
		if (dt <= 0) return;
		this.frameTimes.push(dt);
		while (this.frameTimes.length > this.frameSample) {
			this.frameTimes.shift();
		}
	}

	private sampleUncappedFrame(dt: number) {
		if (dt <= 0) return;
		this.uncappedFrameTimes.push(dt);
		while (this.uncappedFrameTimes.length > this.frameSample) {
			this.uncappedFrameTimes.shift();
		}
	}

	/**
	 * Create a new GPUTexture
	 */
	createTexture(format: GPUTextureFormat, size: GPUExtent3DStrict = [1, 1], label?: string): GPUTexture {
		const device = this.device;
		let usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
		const dim = Array.isArray(size) ? size.length - 1 : 1;
		let dimension: GPUTextureDimension = (['1d', '2d', '3d'] as GPUTextureDimension[])[dim] || '2d';

		if (['r32uint', 'rgba8unorm', 'rgba8uint', 'r32float'].includes(format)) {
			usage |= GPUTextureUsage.STORAGE_BINDING;
		}
		if (dimension === '2d' && ['r32uint', 'r8uint', 'rgba8unorm', 'rgba8snorm', 'rgba16float', 'rgba32float', 'depth32float', 'depth24plus'].includes(format)) {
			usage |= GPUTextureUsage.RENDER_ATTACHMENT;
		}


		return device.createTexture({
			label,
			format,
			dimension,
			size,
			usage
		});
	}

	/**
	 * Create a new GPUBuffer
	 */
	createBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
		return this.device.createBuffer({ size, usage });
	}
}

/**
 * Exception when the platform does not support WebGPU
 */
export class UnsupportedError extends Error {
	constructor() {
		super("Your browser doesn't support WebGPU");
	}
}

/**
 * Get the normal of a triangle
 */
export function calculateNormal(triangle: Triangle, transform?: Matrix4): Vector3 {
	let [p0, p1, p2] = triangle;
	if (transform) {
		p0 = transformPoint(transform, p0);
		p1 = transformPoint(transform, p1);
		p2 = transformPoint(transform, p2);
	}

	const v0 = subtract(p2, p0);
	const v1 = subtract(p1, p0);
	return normalize(cross(v0, v1));
}

/**
 * Update the normals in a collection of {@link NormalVertex} so they're perpendicular to the triangle's surface
 */
export function calculateNormals(vertices: Array<NormalVertex>, transform?: Matrix4) {
	for (let i = 0; i < vertices.length; i += 3) {
		const triangle: Triangle = [
			vertices[i + 0].position,
			vertices[i + 1].position,
			vertices[i + 2].position,
		];
		const normal = calculateNormal(triangle, transform);

		vertices[i + 0].normal = normal;
		vertices[i + 1].normal = normal;
		vertices[i + 2].normal = normal;
	}
}

export function subdivideFace(face: Triangle, divisions: number): Array<Triangle> {
	if (divisions <= 0) {
		return [face];
	}
	const [a, b, c] = face;
	const d: Point3 = scale(add(a, b), 0.5);
	const e: Point3 = scale(add(b, c), 0.5);
	const f: Point3 = scale(add(c, a), 0.5);

	const faces: Array<Triangle> = [[a, d, f], [d, b, e], [f, e, c], [f, d, e]];
	return faces.flatMap(face => subdivideFace(face, divisions - 1))
}
