import { Gfx } from 'engine';
import { Material } from './material';

export type InstanceId = number;

export interface ToArrayBuffer {
	toArrayBuffer(): ArrayBuffer;
}

export class StorageBuffer<T extends ToArrayBuffer> {
	/**
	 * GPU buffer storing data. Will be replaced when buffer resizes
	 */
	storage!: GPUBuffer;
	/**
	 * Size of {@link T#toArrayBuffer} in bytes
	 */
	readonly instanceSize: number = 1;
	protected nextIndex: InstanceId = 1;
	protected capacity: number = 0;
	protected deleted: Set<number> = new Set();

	constructor(public gfx: Gfx, instanceSize: number, capacity: number = 1) {
		this.instanceSize = instanceSize;
		this.resize(capacity);
	}

	protected getNextId() {
		if (this.deleted.size > 0) {
			// Reuse deleted space
			const id = this.deleted.values().next().value;
			this.deleted.delete(id);
			return id;
		} else {
			return this.nextIndex++;
		}
	}

	resize(capacity: number) {
		if (this.capacity === capacity) {
			return;
		}
		console.debug(`Resizing storage buffer from ${this.capacity} to ${capacity}`);
		const oldStorage = this.storage;

		this.capacity = capacity;
		this.storage = this.gfx.createBuffer(
			this.instanceSize * this.capacity,
			GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		);
		if (oldStorage) {
			const enc = this.gfx.device.createCommandEncoder();
			enc.copyBufferToBuffer(oldStorage, 0, this.storage, 0, Math.min(oldStorage.size, this.storage.size));
			this.gfx.device.queue.submit([enc.finish()]);
		}
	}

	reserve(): InstanceId {
		let instanceId = this.getNextId();
		if (instanceId > this.capacity) {
			this.resize(Math.ceil(this.capacity * 1.5));
		}
		return instanceId;
	}

	push(item: T): InstanceId {
		const array = item.toArrayBuffer();
		if (array.byteLength !== this.instanceSize) {
			throw new Error(`Invalid instance. Expected ${this.instanceSize} bytes. Got ${array.byteLength} bytes`);
		}
		const instanceId = this.reserve();
		this.writeInstance(instanceId, item);
		return instanceId;
	}

	writeInstance(id: InstanceId, item: T) {
		const data = item.toArrayBuffer();
		if (data.byteLength !== this.instanceSize) {
			throw new Error(`Invalid instance. Expected ${this.instanceSize} bytes. Got ${data.byteLength} bytes`);
		}

		const index = id - 1;
		const byteOffset = this.instanceSize * index;
		this.deleted.delete(id);
		this.gfx.device.queue.writeBuffer(this.storage, byteOffset, data);
	}

	deleteInstance(id: InstanceId) {
		this.deleted.add(id);
	}

	bindingResource(): GPUBindingResource {
		return { buffer: this.storage };
	}
}

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
