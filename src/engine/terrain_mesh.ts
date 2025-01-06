import { Gfx, Size } from 'engine';
import { Point3 } from 'engine/math';
import { SimpleMesh } from 'engine/mesh';
import { TerrainPipeline } from './pipelines/terrain';
import { hsl } from 'engine/color';
import { ColorScheme } from './color_scheme';
import { identity } from './math/transform';

export class TerrainMesh extends SimpleMesh {
	private terrainPipeline: TerrainPipeline;

	constructor(
		gfx: Gfx,
		readonly size: Size,
		readonly chunkId: Point3,
		private terrainSeed: number,
		colorSchemeOrPipeline: ColorScheme | TerrainPipeline,
	) {
		const instances = [{
			transform: identity(),
			materialIndex: BigInt(0xffffffff),
			instanceColor1: BigInt(0xffffffff),
			instanceColor2: BigInt(0xffffffff),
			instanceColor3: BigInt(0xffffffff),
			variantIndex: BigInt(0x0),
			variantBlend: 0.0,
			live: 1,
		}]
		super(gfx, undefined, instances);
		if (colorSchemeOrPipeline instanceof TerrainPipeline) {
			this.terrainPipeline = colorSchemeOrPipeline;
		} else {
			this.terrainPipeline = new TerrainPipeline(this.gfx, colorSchemeOrPipeline);
		}
		this.createVertexBuffer();
	}

	private async createVertexBuffer() {
		this.vertexBuffer = await this.terrainPipeline.createVertexBuffer(this.size, this.chunkId, this.terrainSeed);
		this.vertexCount = this.size[0] * this.size[1] * 6;
	}
}

export const DEFAULT_COLORS = [
	hsl(0.14, 0.5, 0.5),
	hsl(0.3, 0.5, 0.3),
	hsl(0.3, 0.6, 0.4),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
	hsl(0.0, 0.0, 0.3),
];
