import { Component } from "engine/ecs/components";

export enum ShipMode {
	Space,
	Lander,
	Ground,
}

export class ShipComponent extends Component {
	constructor(
		public mode = ShipMode.Space,
	) {
		super();
	}
}


