import { DEADZONE, Key, XboxAxis, XboxButton } from 'engine/input';
import { System } from '.';
import { TransformComponent } from '../components';
import { OrbitCameraComponent } from '../components/camera';
import { World } from '../world';
import { inverse, multiply, rotation, rotationFromQuaternion, rotationFromVector, transformPoint, translation } from 'engine/math/transform';
import { add, dot, magnitude, normalize } from 'engine/math/vectors';
import * as quats from 'engine/math/quaternions';
import { Quaternion } from 'engine/math';

const MIN_DISTANCE = 1;
const MAX_DISTANCE = 10000;

export class OrbitCameraInputSystem extends System {
	bindings: Record<string, Key> = {
		'w': Key.Forward,
		'a': Key.Left,
		's': Key.Backward,
		'd': Key.Right,
		'q': Key.Down,
		'e': Key.Up,
		'shift': Key.Boost,
	};
	distance: number = 8;
	readonly heldKeys = new Map<Key, number>;
	readonly axis = new Map<XboxAxis, number>;
	readonly previousButtons: Record<number, number> = {};
	private previousTouch?: Touch;
	private world?: World;


	constructor(private el: HTMLElement) {
		super();
		document.addEventListener('pointerlockchange', this.onPointerLockChange);
		el.addEventListener('mousedown', this.onMouseDown);
		el.addEventListener('touchstart', this.onTouchStart, { passive: true });
		el.addEventListener('wheel', this.onWheel, { passive: true });
	}

	override setup(world: World) {
		this.world = world;
	}

	override teardown(_world: World) {
		this.world = undefined;
	}

	override async tick(dt: number, world: World) {
		const { abs, pow, max } = Math;
		this.updateGamepads();

		const rotateSpeed = 4.0;
		let pitch = 0;
		let yaw = 0;
		for (const [key, amount] of this.axis.entries()) {
			if (abs(amount) < DEADZONE) {
				continue;
			}
			const value = pow(amount, 3.0) * rotateSpeed;
			switch (key) {
				case XboxAxis.RightStickX:
					yaw = value;
					break;
				case XboxAxis.RightStickY:
					pitch = value;
					break;
			}
		}

		const entities = world.entitiesWithComponents([OrbitCameraComponent, TransformComponent]);
		for (const entity of entities) {
			const trans = world.getComponent(entity, TransformComponent)!;
			const { target, offset, rotation: cameraRotation } = world.getComponent(entity, OrbitCameraComponent)!;
			if (!target) continue;
			const { position: targetPoint, rotation: entRotation } = world.getComponent(target, TransformComponent)!;

			const targetRotation = quats.multiply(entRotation, cameraRotation);

			const similar = 1.0 / max(0.1, dot(trans.rotation, targetRotation));
			trans.rotation = quats.lerp(trans.rotation, targetRotation, 1.0 * dt * similar);

			let transform = translation(...targetPoint);
			transform = multiply(transform, rotationFromQuaternion(trans.rotation));
			transform = multiply(transform, translation(0, 0, -this.distance));
			trans.position = transformPoint(transform, offset);
		}
	}

	grab() {
		this.el.requestPointerLock();
	}

	release() {
		document.exitPointerLock();
	}

	updateGamepads() {
		if (!document.hasFocus()) return;
		for (const pad of navigator.getGamepads()) {
			// We get nulls for some reason
			if (!pad) continue;
			const {
				axes: [leftStickX, leftStickY, rightStickX, rightStickY],
				buttons,
			} = pad;

			this.axis.set(XboxAxis.LeftStickX, leftStickX);
			this.axis.set(XboxAxis.LeftStickY, leftStickY);
			this.axis.set(XboxAxis.RightStickX, rightStickX);
			this.axis.set(XboxAxis.RightStickY, rightStickY);

			for (let i = 0; i < buttons.length; i++) {
				const button = buttons[i];
				if (this.previousButtons[i] === button.value) {
					// Value unchanged
					continue;
				}
				this.previousButtons[i] = button.value;
				if (button.value > 0.001) {
					const key = this.bindings[XboxButton[i]];
					if (key) {
						this.heldKeys.set(key, button.value);
					}
				} else {
					this.heldKeys.delete(i);
				}
			}
		}
	}

	rotateCameras(x: number, y: number) {
		const { world } = this;
		if (!world) return;

		const s = Math.PI;
		const rot0 = quats.quaternionFromEuler(x * s, 0, 0);
		const rot1 = quats.quaternionFromEuler(0, 0, y * s);
		const entities = world.entitiesWithComponents([OrbitCameraComponent, TransformComponent]);
		for (const entity of entities) {
			const cam = world.getComponent(entity, OrbitCameraComponent)!;
			if (!cam.target) continue;

			const targetTrans = world.getComponent(cam.target, TransformComponent)!;
			const rotDiff = quats.multiply(quats.conjugate(cam.rotation), targetTrans.rotation);
			const finalRot = quats.multiply(
				rot0,
				rotDiff,
				rot1,
				quats.conjugate(rotDiff),
			);


			const newCamRot = quats.multiply(cam.rotation, finalRot);
			cam.rotation = normalize(newCamRot);

			const transform = world.getComponent(entity, TransformComponent)!;
			transform.rotation = quats.multiply(transform.rotation, finalRot);
		}
	}

	onPointerLockChange = (_e: Event) => {
		if (document.pointerLockElement === this.el) {
			document.addEventListener('mousemove', this.onMouseMove);
		} else {
			document.removeEventListener('mousemove', this.onMouseMove);
		}
	};

	onWheel = (e: WheelEvent) => {
		this.distance *= 1.0 - (e.deltaY / -1000.0);
		this.distance = Math.min(Math.max(this.distance, MIN_DISTANCE), MAX_DISTANCE);
	};

	onMouseDown = (e: MouseEvent) => {
		// Ignore press if pointer is locked
		if (document.pointerLockElement === this.el) return;
		if (e.button === 0) {
			document.addEventListener('mouseup', this.onMouseUp);
			document.addEventListener('mousemove', this.onMouseMove);
		}
	};

	onMouseUp = (e: MouseEvent) => {
		// Ignore press if pointer is locked
		if (document.pointerLockElement === this.el) return;
		if (e.button === 0) {
			document.removeEventListener('mouseup', this.onMouseUp);
			document.removeEventListener('mousemove', this.onMouseMove);
		}
	};

	onMouseMove = (e: MouseEvent) => {
		if (!this.world) return;
		const x = e.movementX / 1000;
		const y = e.movementY / 1000;

		this.rotateCameras(y, x);
		this.tick(0, this.world);
	};

	onTouchStart = (e: TouchEvent) => {
		const [touch] = e.changedTouches;
		this.previousTouch = touch;
		document.addEventListener('touchend', this.onTouchEnd);
		document.addEventListener('touchmove', this.onTouchMove);
	};

	onTouchMove = (e: TouchEvent) => {
		if (!this.world) return;
		const [touch] = e.changedTouches;
		if (!this.previousTouch) {
			this.previousTouch = touch;
			return;
		}
		const { clientX: x, clientY: y } = touch;
		const { clientX: px, clientY: py } = this.previousTouch;
		const dx = px - x;
		const dy = py - y;

		this.rotateCameras(dy / -1000, dx / -1000);
		this.tick(0, this.world);
		this.previousTouch = touch;
	};

	onTouchEnd = (e: TouchEvent) => {
		this.previousTouch = undefined;
		document.removeEventListener('touchend', this.onTouchEnd);
		document.removeEventListener('touchmove', this.onTouchMove);
	};
}

