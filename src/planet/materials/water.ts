import { Color, Gfx } from 'engine';
import { colorToBigInt } from 'engine/color';
import { StorageMaterial } from 'engine/storage_material';

export class WaterMaterial extends StorageMaterial {
	static instanceSize = 3 * 4;
	forwardRender = true;
	private _deepColor: bigint;
	private _shallowColor: bigint;

	constructor(
		readonly gfx: Gfx,
		public seed: number,
		shallowColor?: number | bigint | Color,
		deepColor?: number | bigint | Color,
	) {
		super(gfx);
		if (Array.isArray(shallowColor)) {
			this._shallowColor = colorToBigInt(shallowColor);
		} else {
			this._shallowColor = BigInt(shallowColor||0);
		}
		if (Array.isArray(deepColor)) {
			this._deepColor = colorToBigInt(deepColor);
		} else {
			this._deepColor = BigInt(deepColor||0);
		}
	}

	toArrayBuffer() {
		return new Uint32Array([
			this.seed,
			Number(this._shallowColor),
			Number(this._deepColor),
		]);
	}
}
