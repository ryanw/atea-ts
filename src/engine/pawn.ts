import { Matrix4 } from './math';
import { Material } from './material';
import { Gfx } from 'engine';
import { SimpleMesh } from './mesh';
import { UniformBuffer } from './uniform_buffer';
import { identity } from './math/transform';

/**
 * Type Guard to test if the `T` in {@link Pawn} is a specific type
 *
 * @param pawn Pawn to test
 * @param constructor Constructor of the type to verify
 *
 * @example
 * if (isPawnOf(pawn, SimpleMesh)) {
 *   console.log(
 *     "Pawn is a mesh with %i vertices",
 *     pawn.object.vertexCount,
 *   );
 * }
 */
export function isPawnOf<T, M extends Material = Material>(pawn: Pawn<unknown, M>, constructor: new (...args: any[]) => T): pawn is Pawn<T, M> {
	return pawn.object instanceof constructor;
}


export class Pawn<T, M extends Material = Material> {
	public visible = true;
	private buffer: UniformBuffer;
	private _transform: Matrix4 = identity();
	public _variantIndex = 0;

	constructor(
		gfx: Gfx,
		readonly object: T,
		public material: M,
		transform: Matrix4 = identity(),
	) {
		this.buffer = new UniformBuffer(gfx, [
			['transform', 'mat4x4f'],
			['id', 'u32'],
			['vertexCount', 'u32'],
			['variantCount', 'u32'],
			['variantIndex', 'u32'],
		]);
		this.buffer.set('id', Math.random() * 0xffffffff | 0);
		this.transform = transform;
	}

	get transform(): Matrix4 {
		return [...this._transform];
	}

	set transform(transform: Matrix4) {
		this._transform = [...transform];
		this.buffer.set('transform', transform);
	}

	get variantIndex(): number {
		return this._variantIndex;
	}

	set variantIndex(index: number) {
		this._variantIndex = index;
		this.buffer.set('variantIndex', index);
	}

	bindingResource(): GPUBindingResource {
		// FIXME this should be automatic or moved elsewhere
		if (isPawnOf(this, SimpleMesh)) {
			this.buffer.set('vertexCount', this.object.vertexCount);
			this.buffer.set('variantCount', this.object.variantCount);
		}
		return this.buffer.bindingResource();
	}

	destroy() {
		if (isPawnOf(this, SimpleMesh)) {
			this.object.destroy();
		}
	}
}
