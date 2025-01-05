import { Gfx } from "engine";

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


