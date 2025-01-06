/**
 * A very simple demo
 *
 * @module
 */

import { Gfx } from 'engine';
import { QuaternionCamera } from 'engine/camera';
import { Scene } from 'engine/scene';
import { multiply, rotation, translation } from 'engine/math/transform';
import { FreeCameraController } from 'engine/input/free_camera';
import { SimpleMaterial } from 'engine/material';
import { Matrix4 } from 'engine/math';
import { Icosahedron } from 'engine/meshes/icosahedron';

/**
 * Start the demo
 */
export async function main(el: HTMLCanvasElement): Promise<Gfx> {
	if (el.tagName !== 'CANVAS') throw new Error('Element is not a canvas');
	const gfx: Gfx = await Gfx.attachNotified(el);
	const camera = new QuaternionCamera(gfx);
	const cameraController = new FreeCameraController(el, camera);
	const scene = new Scene(gfx);

	const mesh = new Icosahedron(gfx);
	scene.addMesh(mesh, new SimpleMaterial(gfx, 0xffffffff));
	const icos: Array<[number, Matrix4]> = Array.from({ length: 100 }, () => {
		const x = (Math.random() - 0.5) * 100.0;
		const y = (Math.random() - 0.5) * 100.0;
		const z = Math.random() * 100.0;
		const transform = translation(x, y, z);
		const idx = mesh.pushInstance({
			materialIndex: 0,
			instanceColor1: 0,
			instanceColor2: 0,
			instanceColor3: 0,
			transform,
			variantIndex: 0,
			variantBlend: 0.0,
			live: 1
		});

		return [idx, transform];
	});

	function update(dt: number) {
		for (const pair of icos) {
			const [idx, oldTransform] = pair;
			const transform = multiply(oldTransform, rotation(0, 1 * dt, 0));
			pair[1] = transform;
			mesh.writeInstance(idx, {
				materialIndex: 0,
				instanceColor1: 0,
				instanceColor2: 0,
				instanceColor3: 0,
				transform,
				variantIndex: 0,
				variantBlend: 0.0,
				live: 1
			});
		}
	}

	gfx.run(async (dt) => {
		cameraController.update(dt);
		update(dt);
		await gfx.draw(scene, camera);
	});

	return gfx;
}
