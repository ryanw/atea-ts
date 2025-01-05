import { Color } from 'engine/color';
import { Component } from '.';
import { Vector4 } from 'engine/math';
import { ResourceId } from 'engine/resource';

export class MaterialComponent extends Component {
	public emissive = false;
	public color: Color = [255, 0, 0, 255];
	public noise: Vector4 = [0, 0, 0, 0];
	public variant: number = 0.0;
	public custom?: ResourceId;

	constructor(values?: ResourceId | Partial<MaterialComponent>) {
		super();
		if (typeof values === 'string' || typeof values === 'number') {
			this.custom = values;
		} else if (values) {
			Object.assign(this, values);
		}
	}
}
