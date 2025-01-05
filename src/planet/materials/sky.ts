import { Color, Gfx } from 'engine';
import { ColorLike, colorToInt, toColor } from 'engine/color';
import { StorageMaterial } from 'engine/storage_material';

type ColorList = [Color, Color, Color, Color];

export class SkyMaterial extends StorageMaterial {
	static instanceSize = 4 + 4 * 4;
	readonly colors: ColorList;

	constructor(
		readonly gfx: Gfx,
		readonly seed: bigint,
		colors: [ColorLike, ColorLike, ColorLike, ColorLike],
	) {
		super(gfx);
		this.colors = colors.map(toColor) as ColorList;
	}

	toArrayBuffer(): ArrayBuffer {
		return new Uint32Array([
			Number(this.seed),
			...this.colors.map(colorToInt),
		]).buffer;
	}
}
