import { Color, Gfx } from 'engine';
import { colorToBigInt } from 'engine/color';
import { Material } from 'engine/material';
import { BigVector4 } from 'engine/math';
import { UniformBuffer } from 'engine/uniform_buffer';

export class StarMaterial extends Material {
	readonly uniform: UniformBuffer;
	readonly forwardRender = true;
	readonly coreColor: bigint;
	readonly deepColor: bigint;
	readonly shallowColor: bigint;
	readonly coronaColor: bigint;

	constructor(
		readonly gfx: Gfx,
		public seed: number,
		coronaColor: number | bigint | Color,
		shallowColor: number | bigint | Color = coronaColor,
		deepColor: number | bigint | Color = shallowColor,
		coreColor: number | bigint | Color = deepColor,
	) {
		super();
		if (Array.isArray(shallowColor)) {
			this.shallowColor = colorToBigInt(shallowColor);
		} else {
			this.shallowColor = BigInt(shallowColor||0);
		}
		if (Array.isArray(deepColor)) {
			this.deepColor = colorToBigInt(deepColor);
		} else {
			this.deepColor = BigInt(deepColor||0);
		}
		if (Array.isArray(coreColor)) {
			this.coreColor = colorToBigInt(coreColor);
		} else {
			this.coreColor = BigInt(coreColor||0);
		}
		if (Array.isArray(coronaColor)) {
			this.coronaColor = colorToBigInt(coronaColor);
		} else {
			this.coronaColor = BigInt(coronaColor||0);
		}
		this.uniform = new UniformBuffer(gfx, [
			['seed', 'u32'],
		]);
		this.updateUniform();
	}

	instanceColors(): BigVector4 {
		return [
			this.coronaColor,
			this.shallowColor,
			this.deepColor,
			this.coreColor,
		];
	}

	updateUniform() {
		this.uniform.replace( {
			seed: this.seed,
		});
	}

	bindingResource(): GPUBindingResource {
		return this.uniform.bindingResource();
	}
}
