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
	color: u32,
	seed: u32,
	seaLevel: f32,
}

struct VertexIn {
	@builtin(vertex_index) id: u32,
	@builtin(instance_index) instance: u32,
	// Instance
	@location(3) transform0: vec4f,
	@location(4) transform1: vec4f,
	@location(5) transform2: vec4f,
	@location(6) transform3: vec4f,
	@location(7) instanceColors: vec4<u32>,
	@location(8) variantIndex: u32,
	@location(9) variantBlend: f32,
	@location(10) live: u32,
}

struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) uv: vec2f,
	@location(1) normal: vec3f,
	@location(2) color: vec4f,
	@location(3) originalPosition: vec3f,
	@location(4) modelPosition: vec3f,
	@location(5) modelNormal: vec3f,
	@location(6) alt: f32,
	@location(7) @interpolate(flat) seed: u32,
	@location(8) @interpolate(flat) triangleId: u32,
	@location(9) @interpolate(flat) quadId: u32,
}

struct FragmentOut {
	@location(0) albedo: vec4f,
	@location(1) normal: vec4f,
	@location(2) metaOutput: u32,
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

@vertex
fn vs_main(in: VertexIn) -> VertexOut {
	var out: VertexOut;
	if (in.live == 0u) {
		out.position = vec4(100.0, 100.0, 100.0, 1.0);
		return out;
	}

	let variantIndex = in.variantIndex + pawn.variantIndex;
	let seed = material.seed + 1000 * variantIndex;

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

	let scale = 1.0/2.0;
	let offsetPoint = terrainPoint(scale, v.position, 3, seed, material.seaLevel);
	var p = offsetModel * vec4(offsetPoint, 1.0);
	//var p = offsetModel * vec4(v.position, 1.0);
	var position = mvp * p;

	out.position = position;
	out.uv = v.position.xy * 0.5 + 0.5;
	out.originalPosition = v.position;
	out.color = vec4(1.0);
	out.triangleId = in.id / 3u;
	out.quadId = in.id / 4u;
	out.normal = normal;
	out.alt = v.alt;

	out.seed = seed;

	return out;
}


@fragment
fn fs_main(in: VertexOut) -> FragmentOut {
	var out: FragmentOut;
	var color = in.color;
	if color.a == 0.0 {
		discard;
	}

	let maxOctaves = 5.0;
	let r0 = rnd3u(vec3(in.seed + 1000));
	let r1 = rnd3u(vec3(in.seed + 2000));
	let r2 = rnd3u(vec3(in.seed + 3000));

	let seaColor = hsl(r0, 0.4, 0.4);
	let landColor = hsl(r1, 0.4, 0.4);

	var p = normalize(in.originalPosition);
	//out.normal = vec4(p * -1.0, 1.0);
	let ll = pointToLonLat(p);

	let fp = fwidth(p);
	let mm = max(max(fp.x, fp.y), fp.z);
	var res = 1.0 - pow(smoothstep(0.0, 1.0/32.0, mm), 0.2);
	res = clamp(pow(res, 1.0), 0.0, 1.0);

	let octaves = i32(ceil(1.0 + res * maxOctaves));
	var n0 = terrainNoise(p, octaves, in.seed, material.seaLevel) + 0.5;
	let scale = 1.0/2.0;
	var normal = terrainNormal(scale, p, octaves + 1, in.seed, material.seaLevel);

	var brightness = 1.0;
	if n0 <= material.seaLevel {
		brightness = n0 + (1.0 - material.seaLevel);
		color = seaColor;
	}
	else {
		brightness = n0 + material.seaLevel;
		color = landColor;
	}

	/*
	if (res >= 1.0) {
		color = vec4(1.0);
	} else {
		color = hsl(f32(octaves)/8.0, 0.5, 0.5);
	}
	*/


	out.albedo = vec4(color.rgb * brightness, color.a);
	//out.albedo = vec4(color.rgb, color.a);
	out.normal = vec4(normal, 0.0);
	out.metaOutput = in.triangleId % 0xff;

	//out.albedo = hsl(res, 0.6, 0.5);

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
@import "engine/shaders/color.wgsl";
