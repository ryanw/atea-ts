import { Color, Gfx } from 'engine';
import { colorToInt, toColor } from 'engine/color';
import { StorageMaterial } from 'engine/storage_material';

export class PlanetMaterial extends StorageMaterial {
	static instanceSize = 4 * 3;
	readonly lowLandColor: Color;
	readonly highLandColor: Color;

	constructor(
		readonly gfx: Gfx,
		readonly terrainSeed: bigint,
		lowLandColor: number | bigint | Color,
		highLandColor: number | bigint | Color,
	) {
		super(gfx);
		this.lowLandColor = toColor(lowLandColor);
		this.highLandColor = toColor(highLandColor);
	}

	toArrayBuffer(): ArrayBuffer {
		return new Uint32Array([
			Number(this.terrainSeed),
			colorToInt(this.lowLandColor),
			colorToInt(this.highLandColor),
		]).buffer;
	}
}
