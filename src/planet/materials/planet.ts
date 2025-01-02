import { Gfx } from 'engine';
import { Material } from 'engine/material';
import { UniformBuffer } from 'engine/uniform_buffer';

export class PlanetMaterial extends Material {
	readonly uniform: UniformBuffer;

	constructor(
		readonly gfx: Gfx,
		readonly seed: number,
		readonly seaLevel: number = 0,
	) {
		super();
		this.uniform = new UniformBuffer(gfx, [
			['color', 'u32'],
			['seed', 'u32'],
			['seaLevel', 'f32'],
		]);
		this.updateUniform();
	}

	updateUniform() {
		this.uniform.replace( {
			color: BigInt(0xffffff00),
			seed: this.seed,
			seaLevel: this.seaLevel,
		});
	}

	bindingResource(): GPUBindingResource {
		return this.uniform.bindingResource();
	}
}

