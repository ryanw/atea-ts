import { Color, Gfx } from 'engine';
import { colorToBigInt } from 'engine/color';
import { StorageMaterial } from 'engine/storage_material';

function toColorBigInt(color: number | bigint | Color): bigint {
	if (Array.isArray(color)) {
		return colorToBigInt(color);
	}
	return BigInt(color || 0);
}

export class StarMaterial extends StorageMaterial {
	static instanceSize = 4 * 4;
	readonly forwardRender = true;
	readonly coronaColor: bigint;
	readonly shallowColor: bigint;
	readonly deepColor: bigint;
	readonly coreColor: bigint;

	constructor(
		readonly gfx: Gfx,
		coronaColor: number | bigint | Color,
		shallowColor: number | bigint | Color = coronaColor,
		deepColor: number | bigint | Color = shallowColor,
		coreColor: number | bigint | Color = deepColor,
	) {
		super(gfx);
		this.coronaColor = toColorBigInt(coronaColor);
		this.shallowColor = toColorBigInt(shallowColor);
		this.deepColor = toColorBigInt(deepColor);
		this.coreColor = toColorBigInt(coreColor);
	}

	toArrayBuffer(): ArrayBuffer {
		return new Uint32Array([
			Number(this.coronaColor),
			Number(this.shallowColor),
			Number(this.deepColor),
			Number(this.coreColor),
		]).buffer;
	}
}
