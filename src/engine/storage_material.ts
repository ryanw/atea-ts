import { Gfx } from 'engine';
import { Material } from './material';
import { InstanceId, StorageBuffer, ToArrayBuffer } from './storage_buffer';

export abstract class StorageMaterial extends Material implements ToArrayBuffer {
	/**
	 * Contigious storage of all material instances. Is undefined until at least 1 material instance exists
	 */
	static storage: StorageBuffer<StorageMaterial>;

	/**
	 * How many bytes a single instance takes up
	 */
	static instanceSize = 1;

	static finalization: FinalizationRegistry<InstanceId>;

	readonly instanceId: number;

	constructor(gfx: Gfx) {
		super();

		const Self = this.self();
		if (!Self.storage) {
			Self.storage = new StorageBuffer(gfx, Self.instanceSize);
			Self.finalization = new FinalizationRegistry(Self.finalize.bind(Self));
		}

		this.instanceId = Self.storage.reserve();

		// Register for garbage colllection cleanup
		Self.finalization.register(this, this.instanceId);

		// Write after subclass constructor has finished
		setTimeout(() => this.write(), 1);
	}

	/**
	 * Current instance data as a JS ArrayBuffer, ready to be copied into the StorageBuffer
	 */
	abstract toArrayBuffer(): ArrayBuffer;

	/**
	 * Called by the JS garbage collector. Here we reclaim GPU memory
	 */
	static finalize(instanceId: InstanceId) {
		this.storage.deleteInstance(instanceId);
	}

	/**
	 * Reference to the current subclass of {@link StorageMaterial}
	 */
	self(): typeof StorageMaterial {
		return this.constructor as typeof StorageMaterial;
	}

	/**
	 * Copy itself to the GPU
	 */
	write() {
		const Self = this.self();
		Self.storage.writeInstance(this.instanceId, this);
	}

	bindingResource(): GPUBindingResource {
		return this.self().storage.bindingResource();
	}

	static bindingResource(): GPUBindingResource {
		return this.storage.bindingResource();
	}
}
