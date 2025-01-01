struct PackedVertex {
	position: array<f32, 3>,
	normal: array<f32, 3>,
	color: u32,
	alt: f32,
}

struct Vertex {
	position: vec3f,
	normal: vec3f,
	color: u32,
	alt: f32,
}

struct Material {
	seed: u32,
}

struct VertexIn {
	@builtin(vertex_index) id: u32,
	@builtin(instance_index) instance: u32,
	// Instance
	@location(3) transform0: vec4f,
	@location(4) transform1: vec4f,
	@location(5) transform2: vec4f,
	@location(6) transform3: vec4f,
	@location(7) instanceColor: u32,
	@location(8) variantIndex: u32,
	@location(9) live: u32,
}

struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) uv: vec2f,
	@location(1) normal: vec3f,
	@location(2) shallowColor: vec4f,
	@location(3) deepColor: vec4f,
	@location(4) alt: f32,
	@location(5) @interpolate(flat) triangleId: u32,
	@location(6) @interpolate(flat) quadId: u32,
}

struct FragmentOut {
	@location(0) color: vec4f,
}

struct Camera {
	view: mat4x4f,
	projection: mat4x4f,
	invProjection: mat4x4f,
	resolution: vec2f,
	t: f32,
	isShadowMap: u32,
}

struct Pawn {
	model: mat4x4f,
	id: u32,
	vertexCount: u32,
	variantCount: u32,
	variantIndex: u32,
}

struct Shadow {
	position: vec3f,
	radius: f32,
	umbra: f32,
	shape: u32,
	color: u32,
}

@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<uniform> pawn: Pawn;

@group(0) @binding(2)
var<uniform> material: Material;

@group(0) @binding(3)
var<storage, read> vertices: array<PackedVertex>;

@group(0) @binding(4)
var depthBuffer: texture_depth_2d;

@vertex
fn vs_main(in: VertexIn) -> VertexOut {
	var out: VertexOut;
	if (in.live == 0u) {
		out.position = vec4(100.0, 100.0, 100.0, 1.0);
		return out;
	}

	//let shallowColor = unpack4x8unorm(material.shallowColor);
	//let deepColor = unpack4x8unorm(material.deepColor);

	let variantIndex = in.variantIndex + pawn.variantIndex;
	let seed = material.seed + variantIndex;

	let r0 = rnd3u(vec3(12 + seed * 7));
	let r1 = rnd3u(vec3(1230 + seed * 13)) - 0.5;
	let shallowColor = hsla(r0, 0.7, 0.5, 0.2);
	let deepColor = hsla((r0 + 0.4 * r1) % 1.0, 0.5, 0.3, 0.8);


	let idx = in.id;
	let packedVertex = vertices[idx];

	let v = Vertex(
		vec3(packedVertex.position[0], packedVertex.position[1], packedVertex.position[2]),
		vec3(packedVertex.normal[0], packedVertex.normal[1], packedVertex.normal[2]),
		packedVertex.color,
		packedVertex.alt,
	);

	var normal = v.normal;

	let transform = mat4x4(
		in.transform0,
		in.transform1,
		in.transform2,
		in.transform3
	);
	let offsetModel = pawn.model * transform;
	let mv = camera.view * offsetModel;
	let mvp = camera.projection * camera.view;
	//var p = offsetModel * vec4(v.position + terrainOffset, 1.0);
	var p = offsetModel * vec4(v.position, 1.0);
	var position = mvp * p;

	out.position = position;
	out.uv = v.position.xy;
	out.triangleId = in.id / 3u;
	out.quadId = in.id / 4u;
	out.normal = normal;
	out.alt = v.alt;

	out.shallowColor = shallowColor;
	out.deepColor = deepColor;
	return out;
}


@fragment
fn fs_main(in: VertexOut) -> FragmentOut {
	var out: FragmentOut;

	let coord = vec2i(in.position.xy);
	let depthSize = vec2f(textureDimensions(depthBuffer));
	let uv = (in.position.xy / depthSize);
	let depth = textureLoad(depthBuffer, coord, 0);
	if (depth < in.position.z) {
		discard;
	}

	// Position of the rock
	let p0 = worldFromScreen(uv, in.position.z, camera.invProjection);

	// Position of the water
	let p1 = worldFromScreen(uv, depth, camera.invProjection);

	// Depth between rock and water
	let pd = (p1 - p0);

	
	let waterDepth = smoothstep(0.0, 1.0, pow(length(pd) / 512.0, 0.333));

	let color = mix(in.shallowColor, in.deepColor, waterDepth);
	out.color = vec4(color.rgb * color.a, color.a);
	//out.color = vec4(vec3(waterDepth), 1.0);
	return out;
}

const PI: f32 = 3.14159265;
fn pointToLonLat(point: vec3<f32>) -> vec2<f32> {
	let v = normalize(point);
	let lat = acos(v.y) - PI / 2.0;
	let lon = atan2(v.z, v.x) + PI / 2.0;
	return vec2(lon, lat);
}

fn lonLatToUV(ll: vec2<f32>) -> vec2<f32> {
	let x = ll.x / PI / 2.0;
	let y = ll.y / PI + 0.5;
	return vec2(fract(x), fract(y));
}

fn pointToUV(point: vec3<f32>) -> vec2<f32> {
	return lonLatToUV(pointToLonLat(point));
}

@import "./terrain_noise.wgsl";
@import "engine/shaders/noise.wgsl";
@import "engine/shaders/helpers.wgsl";
@import "engine/shaders/color.wgsl";
