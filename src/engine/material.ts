import { Color, Gfx } from 'engine';
import { UniformBuffer } from './uniform_buffer';
import { BigVector4, Vector4 } from './math';
import { colorToBigInt } from './color';

export enum Skin {
	Matte = 1 << 0,
	Emissive = 1 << 1,
	Noise = 1 << 2,
}

/**
 * Material defines the properties of the rendered mesh
 */
export abstract class Material {
	writeDepth = true;
	forwardRender = false;
	variantIndex: number = 0;
	variantBlend: number = 1.0;
	abstract bindingResource(): GPUBindingResource;
	instanceColors(): BigVector4 {
		return [
			0xffffffffn,
			0xffffffffn,
			0xffffffffn,
			0xffffffffn,
		];
	}
}

/**
 * Simple color {@link Material} stored in a {@link GPUBuffer}
 */
export class DotMaterial extends Material {
	readonly uniform: UniformBuffer;

	constructor(
		readonly gfx: Gfx,
		private color: Color = [255, 255, 255, 255],
	) {
		super();
		this.uniform = new UniformBuffer(gfx, [
			['color', 'vec4f'],
		]);
		this.uniform.set('color', this.color.map(v => v / 255));
	}

	bindingResource(): GPUBindingResource {
		return this.uniform.bindingResource();
	}
}

/**
 * Simple color {@link Material} stored in a {@link GPUBuffer}
 */
export class SimpleMaterial extends Material {
	readonly uniform: UniformBuffer;
	private _color: bigint;
	private _receiveShadows = true;
	private _fadeout = 0.0;
	private _skin = Skin.Matte;
	private _noise: Vector4 = [0, 0, 0, 0];

	constructor(
		readonly gfx: Gfx,
		color: number | bigint | Color,
		public dither: boolean = false,
	) {
		super();
		if (Array.isArray(color)) {
			this._color = colorToBigInt(color);
		} else {
			this._color = BigInt(color);
		}
		this.uniform = new UniformBuffer(gfx, [
			['color', 'u32'],
			['dither', 'u32'],
			['fadeout', 'f32'],
			['skin', 'u32'],
			['noise', 'vec4f'],
			['receiveShadows', 'u32'],
		]);
		this.updateUniform();
	}

	get fadeout(): number {
		return this._fadeout;
	}

	set fadeout(distance: number) {
		this._fadeout = distance;
		this.updateUniform();
	}

	get receiveShadows(): boolean {
		return this._receiveShadows;
	}

	set receiveShadows(flag: boolean) {
		this._receiveShadows = flag;
		this.updateUniform();
	}

	get color(): bigint {
		return this._color;
	}

	set color(color: number | bigint) {
		this._color = BigInt(color);
		this.updateUniform();
	}

	get emissive(): boolean {
		return (this._skin & Skin.Emissive) !== 0;
	}

	set emissive(emissive: boolean) {
		if (emissive) {
			this._skin |= Skin.Emissive;
		} else {
			this._skin &= ~Skin.Emissive;
		}
		this.updateUniform();
	}

	get noise(): Vector4 {
		return [...this._noise];
	}

	set noise(noise: Vector4) {
		this._noise = [...noise];
		this.updateUniform();
	}

	bindingResource(): GPUBindingResource {
		return this.uniform.bindingResource();
	}

	updateUniform() {
		this.uniform.set('fadeout', this._fadeout);
		this.uniform.set('receiveShadows', this._receiveShadows);
		this.uniform.set('color', this._color);
		this.uniform.set('skin', this._skin);
		this.uniform.set('noise', this._noise);
	}
}
