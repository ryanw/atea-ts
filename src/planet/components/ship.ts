import { Component } from "engine/ecs/components";

export enum ShipMode {
	Space,
	Lander,
}

export class ShipComponent extends Component {
	constructor(
		public mode = ShipMode.Space,
	) {
		super();
	}
}


