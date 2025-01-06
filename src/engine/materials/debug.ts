import { Color, Gfx } from 'engine';
import { colorToBigInt } from '../color';
import { StorageMaterial } from '../storage_material';

export class DebugMaterial extends StorageMaterial {
	static instanceSize = 4;
	private _color: bigint;

	constructor(
		readonly gfx: Gfx,
		color: number | bigint | Color,
		public isWireframe = false,
	) {
		super(gfx);
		if (Array.isArray(color)) {
			this._color = colorToBigInt(color);
		} else {
			this._color = BigInt(color||0);
		}
	}

	toArrayBuffer() {
		return new Uint32Array([
			Number(this._color),
		]);
	}
}
