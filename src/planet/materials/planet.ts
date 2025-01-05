import { Color, Gfx } from 'engine';
import { colorToInt, toColor } from 'engine/color';
import { StorageMaterial } from 'engine/storage_material';

export class PlanetMaterial extends StorageMaterial {
	static instanceSize = 4 * 3;
	readonly landColor: Color;
	readonly waterColor: Color;

	constructor(
		readonly gfx: Gfx,
		readonly terrainSeed: bigint,
		landColor: number | bigint | Color,
		waterColor: number | bigint | Color,
	) {
		super(gfx);
		this.landColor = toColor(landColor);
		this.waterColor = toColor(waterColor);
	}

	toArrayBuffer(): ArrayBuffer {
		return new Uint32Array([
			Number(this.terrainSeed),
			colorToInt(this.landColor),
			colorToInt(this.waterColor),
		]).buffer;
	}
}
