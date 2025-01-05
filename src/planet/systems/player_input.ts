import { DEADZONE, Key, XboxAxis, XboxButton } from 'engine/input';
import { add, magnitudeSquared, normalize, scale, subtract } from 'engine/math/vectors';
import { Vector3 } from 'engine/math';
import { multiply, multiplyVector, rotation, rotationFromQuaternion } from 'engine/math/transform';
import { System } from 'engine/ecs/systems';
import { World } from 'engine/ecs/world';
import { PlayerComponent, VelocityComponent, TransformComponent } from 'engine/ecs/components';
import { Entity } from 'engine/ecs';
import { ParticlesComponent } from 'engine/ecs/components/particles';
import { SoundComponent } from 'engine/ecs/components/sound';
import * as quats from 'engine/math/quaternions';
import { FollowCameraComponent } from 'engine/ecs/components/camera';
import { GravityComponent } from '../components/gravity';
import { MeshComponent } from 'engine/ecs/components/mesh';
import { FocusableComponent } from '../components/focusable';
import { ShipComponent, ShipMode } from '../components/ship';
import { MaterialComponent } from 'engine/ecs/components/material';

export class PlayerInputSystem extends System {
	gamepads: Array<Gamepad> = [];
	readonly heldKeys = new Map<Key, number>;
	readonly pressedKeys = new Map<Key, number>;
	readonly axis = new Map<XboxAxis, number>;
	readonly previousButtons: Record<number, number> = {};
	bindings: Record<string, Key> = {
		'w': Key.Forward,
		's': Key.Backward,
		'a': Key.RollLeft,
		'd': Key.RollRight,
		'q': Key.Left,
		'e': Key.Right,
		'f': Key.ToggleMode,
		',': Key.PrevCamera,
		'.': Key.NextCamera,
		' ': Key.Thrust,
		'alt': Key.Boost,
		'shift': Key.Brake,
		[XboxButton[XboxButton.X]]: Key.Fire,
		[XboxButton[XboxButton.B]]: Key.Pick,
		[XboxButton[XboxButton.A]]: Key.Bomb,
		[XboxButton[XboxButton.LeftBumper]]: Key.Left,
		[XboxButton[XboxButton.RightBumper]]: Key.Right,
		[XboxButton[XboxButton.LeftTrigger]]: Key.Brake,
		[XboxButton[XboxButton.RightTrigger]]: Key.Thrust,
		[XboxButton[XboxButton.LeftStick]]: Key.ToggleMode,
		[XboxAxis[XboxAxis.LeftStickX]]: Key.Left,
		[XboxAxis[XboxAxis.LeftStickY]]: Key.Forward,
		[XboxAxis[XboxAxis.RightStickX]]: Key.CameraYaw,
		[XboxAxis[XboxAxis.RightStickY]]: Key.CameraPitch,
	};

	constructor(private el: HTMLElement) {
		super();
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
	}

	override async tick(dt: number, world: World) {
		let entities;


		entities = world.entitiesWithComponents([PlayerComponent, VelocityComponent, TransformComponent]);
		for (const entity of entities) {
			this.updateMorph(dt, world, entity)
			this.updateMovement(dt, world, entity);
		}
		entities = world.entitiesWithComponents([FollowCameraComponent, TransformComponent]);
		for (const entity of entities) {
			this.updateCamera(dt, world, entity);
		}
	}

	updateMorph(dt: number, world: World, entity: Entity) {
		const { min, pow } = Math;
		const ship = world.getComponent(entity, ShipComponent);
		if (!ship) return;
		const tran = world.getComponent(entity, TransformComponent);
		if (!tran) return;
		const material = world.getComponent(entity, MaterialComponent);
		if (!material) return;

		let targetScale = tran.scale;
		const t = min(1.0, dt * 10.0);
		switch (ship.mode) {
			case ShipMode.Space:
				if (material.variant !== 0 && (material.variant | 0) !== 0) {
					material.variant = 1.0;
				}
				material.variant -= t;
				if (material.variant < 0) {
					material.variant = 0;
				}
				break;

			case ShipMode.Lander:
				if (material.variant !== 1 && (material.variant | 0) !== 0) {
					material.variant = 0.0;
				}
				material.variant += t;
				if (material.variant > 1) {
					material.variant = 1;
				}
				break;
		}

		const diff = subtract(targetScale, tran.scale);

		const ms = magnitudeSquared(diff);
		if (ms > 0.001) {
			tran.scale = add(tran.scale, scale(diff, t));
		}
		else {
			tran.scale = targetScale;
		}
	}

	updateCamera(dt: number, world: World, entity: Entity) {
		let tilt = 0;
		for (const [key, value] of this.axis.entries()) {
			if (Math.abs(value) < DEADZONE) {
				continue;
			}
			switch (key) {
				case XboxAxis.RightStickY:
					tilt += value;
					break;
			}
		}
		const cam = world.getComponent(entity, FollowCameraComponent)!;
		cam.rotation = quats.multiply(cam.rotation, quats.quaternionFromEuler(tilt * dt, 0, 0));
	}

	updateMovement(dt: number, world: World, entity: Entity) {
		this.updateGamepads();

		const ship = world.getComponent(entity, ShipComponent);
		if (!ship) return;

		switch (ship.mode) {
			case ShipMode.Space:
				this.updateSpace(dt, world, entity);
				break;
			case ShipMode.Lander:
				this.updateLander(dt, world, entity);
				break;
		}

		for (const [key, value] of this.pressedKeys.entries()) {
			let adjust = 1;
			switch (key) {
				case Key.ToggleMode:
					ship.mode = ship.mode === ShipMode.Lander ? ShipMode.Space : ShipMode.Lander;
					break;

				case Key.PrevCamera:
					adjust = -1;
				case Key.NextCamera:
					let entities = Array.from(world.entitiesWithComponents([FocusableComponent, TransformComponent]));
					const camera: Entity = world.entitiesWithComponent(FollowCameraComponent).values().next().value;
					const follow = world.getComponent(camera, FollowCameraComponent)!
					const currentFocus = follow.target;
					if (currentFocus) {
						const currentIdx = entities.indexOf(currentFocus);
						if (currentIdx === 0 && adjust < 0) {
							follow.target = entities[entities.length - 1];
						} else {
							const nextEntity = entities[(currentIdx + adjust) % entities.length];
							follow.target = nextEntity;
						}
					} else {
						follow.target = entities[0];
					}
			}
		}
		this.pressedKeys.clear();
	}

	updateSpace(dt: number, world: World, entity: Entity) {
		const transform = world.getComponent(entity, TransformComponent)!;
		const playerVelocity = world.getComponent(entity, VelocityComponent)!;
		const particles = world.getComponent(entity, ParticlesComponent);

		const speed = this.heldKeys.has(Key.Boost) ? 256 : 128;
		const rotateSpeed = 4.0;
		const movement: Vector3 = [0, 0, 0];
		let brake = 0.0;
		let pitch = 0.0;
		let yaw = 0.0;
		let thrust = 0;
		let roll = 0;
		let tilt = 0;

		for (const [key, value] of this.heldKeys.entries()) {
			switch (key) {
				case Key.Forward:
					pitch = value;
					break;
				case Key.Backward:
					pitch = -value;
					break;
				case Key.Left:
					yaw = -value;
					break;
				case Key.Right:
					yaw = value;
					break;
				case Key.RollLeft:
					roll = value;
					break;
				case Key.RollRight:
					roll = -value;
					break;
				case Key.Thrust:
					if (Math.abs(value) > DEADZONE) {
						thrust = value;
						movement[2] = value;
					}
					break;
				case Key.Brake:
					if (Math.abs(value) > DEADZONE) {
						thrust = -value;
						movement[2] = -value;
					}
					break;
			}
		}

		for (const [key, value] of this.axis.entries()) {
			if (Math.abs(value) < DEADZONE) {
				continue;
			}
			switch (key) {
				case XboxAxis.RightStickX:
					yaw += value;
					break;
				case XboxAxis.LeftStickY:
					pitch -= value;
					break;
				case XboxAxis.LeftStickX:
					roll -= value;
					break;
				case XboxAxis.RightStickY:
					tilt += value;
					break;
			}
		}

		const adjustment = quats.quaternionFromEuler(pitch * dt * rotateSpeed, yaw * dt * rotateSpeed, roll * dt * rotateSpeed);
		transform.rotation = quats.multiply(transform.rotation, adjustment);

		if (movement[0] !== 0 || movement[1] !== 0 || movement[2] !== 0) {
			const playerRot = rotationFromQuaternion(transform.rotation);

			const direction = normalize(multiplyVector(playerRot, [...movement, 0]).slice(0, 3) as Vector3);
			const velocity = scale(direction, speed * dt);
			playerVelocity.velocity = add(playerVelocity.velocity, velocity);
		}

		if (brake > 0) {
			const stopTime = 1.0;
			const vt = 1.0 - ((1.0 / stopTime) * brake * dt);
			playerVelocity.velocity = scale(playerVelocity.velocity, vt);
		}

		if (particles) {
			particles.count = 256 * thrust;
		}
	}

	updateLander(dt: number, world: World, entity: Entity) {
		const transform = world.getComponent(entity, TransformComponent)!;
		const playerVelocity = world.getComponent(entity, VelocityComponent)!;
		const particles = world.getComponent(entity, ParticlesComponent);

		const speed = this.heldKeys.has(Key.Boost) ? 256 : 128;
		const rotateSpeed = 4.0;
		const movement: Vector3 = [0, 0, 0];
		let brake = 0.0;
		let pitch = 0.0;
		let yaw = 0.0;
		let thrust = 0;
		let roll = 0;
		let tilt = 0;

		for (const [key, value] of this.heldKeys.entries()) {
			switch (key) {
				case Key.Forward:
					pitch = value;
					break;
				case Key.Backward:
					pitch = -value;
					break;
				case Key.Left:
					yaw = -value;
					break;
				case Key.Right:
					yaw = value;
					break;
				case Key.RollLeft:
					roll = value;
					break;
				case Key.RollRight:
					roll = -value;
					break;
				case Key.Thrust:
					if (Math.abs(value) > DEADZONE) {
						thrust = value;
						movement[1] = value;
					}
					break;
				case Key.Brake:
					if (Math.abs(value) > DEADZONE) {
						thrust = -value;
						movement[1] = -value;
					}
					break;
				case Key.Stable:
					break;

				case Key.Fire:
					break;

				case Key.Bomb:
					break;
			}
		}

		for (const [key, value] of this.axis.entries()) {
			if (Math.abs(value) < DEADZONE) {
				continue;
			}
			switch (key) {
				case XboxAxis.RightStickX:
					yaw += value;
					break;
				case XboxAxis.LeftStickY:
					pitch -= value;
					break;
				case XboxAxis.LeftStickX:
					roll -= value;
					break;
				case XboxAxis.RightStickY:
					tilt += value;
					break;
			}
		}

		const adjustment = quats.quaternionFromEuler(pitch * dt * rotateSpeed, yaw * dt * rotateSpeed, roll * dt * rotateSpeed);
		transform.rotation = quats.multiply(transform.rotation, adjustment);

		if (movement[0] !== 0 || movement[1] !== 0 || movement[2] !== 0) {
			const playerRot = rotationFromQuaternion(transform.rotation);

			const direction = normalize(multiplyVector(playerRot, [...movement, 0]).slice(0, 3) as Vector3);
			const velocity = scale(direction, speed * dt);
			playerVelocity.velocity = add(playerVelocity.velocity, velocity);
		}

		if (brake > 0) {
			const stopTime = 1.0;
			const vt = 1.0 - ((1.0 / stopTime) * brake * dt);
			playerVelocity.velocity = scale(playerVelocity.velocity, vt);
		}

		if (particles) {
			particles.count = 256 * thrust;
		}

		const sound = world.getComponent(entity, SoundComponent);
		if (!sound) return;
		sound.playing = thrust > 0.00;
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
				const key = this.bindings[XboxButton[i]];
				if (button.value > 0.001) {
					if (key) {
						this.pressedKeys.set(key, 1.0);
						this.heldKeys.set(key, button.value);
					}
				} else {
					this.heldKeys.delete(key);
				}
			}
		}
	}

	onKeyDown = (e: KeyboardEvent) => {
		const key: Key | undefined = this.bindings[e.key.toLowerCase()];
		if (key == null) return;
		e.preventDefault();
		this.pressedKeys.set(key, 1.0);
		this.heldKeys.set(key, 1.0);
	};

	onKeyUp = (e: KeyboardEvent) => {
		const key: Key | undefined = this.bindings[e.key.toLowerCase()];
		if (key == null) return;
		e.preventDefault();
		this.heldKeys.delete(key);
	};
}

