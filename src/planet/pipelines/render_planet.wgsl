struct PlanetMaterial {
	seed: u32,
	landColor: u32,
	seaColor: u32,
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
	@location(8) @interpolate(flat) materialIndex: u32,
}

struct FragmentOut {
	@location(0) albedo: vec4f,
	@location(1) normal: vec4f,
	@location(2) metaOutput: u32,
}

@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<uniform> pawn: Pawn;

@group(0) @binding(2)
var<storage, read> materials: array<PlanetMaterial>;

@group(0) @binding(3)
var<storage, read> vertices: array<PackedVertex>;

@vertex
fn vs_main(in: VertexIn) -> VertexOut {
	var out: VertexOut;
	if (in.live == 0u) {
		out.position = vec4(100.0, 100.0, 100.0, 1.0);
		return out;
	}

	let material = materials[in.materialIndex];
	let seaLevel = 0.0;
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
	let offsetPoint = terrainPoint(scale, v.position, 3, seed, seaLevel);
	var p = offsetModel * vec4(offsetPoint, 1.0);
	//var p = offsetModel * vec4(v.position, 1.0);
	var position = mvp * p;

	out.position = position;
	out.uv = v.position.xy * 0.5 + 0.5;
	out.originalPosition = v.position;
	out.color = vec4(1.0);
	out.normal = normal;
	out.alt = v.alt;

	out.seed = seed;
	out.materialIndex = in.materialIndex;

	return out;
}


@fragment
fn fs_main(in: VertexOut) -> FragmentOut {
	var out: FragmentOut;
	var color = in.color;
	if color.a == 0.0 {
		discard;
	}

	let material = materials[in.materialIndex];
	let landColor = unpack4x8unorm(material.landColor);
	let seaColor = unpack4x8unorm(material.seaColor);

	let seaLevel = 0.0;
	let maxOctaves = 5.0;


	var p = normalize(in.originalPosition);
	let ll = pointToLonLat(p);

	let fp = fwidth(p);
	let mm = max(max(fp.x, fp.y), fp.z);
	var res = 1.0 - pow(smoothstep(0.0, 1.0/32.0, mm), 0.2);
	res = clamp(pow(res, 1.0), 0.0, 1.0);

	let octaves = i32(ceil(1.0 + res * maxOctaves));
	var n0 = terrainNoise(p, octaves, in.seed, seaLevel) + 0.5;
	let scale = 1.0/2.0;
	var normal = terrainNormal(scale, p, octaves + 1, in.seed, seaLevel);

	var brightness = 1.0;
	if n0 <= seaLevel {
		brightness = n0 + (1.0 - seaLevel);
		color = seaColor;
	}
	else {
		brightness = n0 + seaLevel;
		color = landColor;
	}


	out.albedo = vec4(color.rgb * brightness, color.a);
	out.normal = vec4(normal, 0.0);

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

@import "./pawn.inc.wgsl";
@import "./camera.inc.wgsl";
@import "./vertex.inc.wgsl";
@import "./terrain_noise.wgsl";
@import "engine/shaders/noise.wgsl";
@import "engine/shaders/color.wgsl";
