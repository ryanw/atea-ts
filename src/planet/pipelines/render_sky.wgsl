struct SkyMaterial {
	seed: u32,
	colors: array<u32, 4>,
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
	@location(9) @interpolate(flat) materialIndex: u32,
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
var<storage, read> materials: array<SkyMaterial>;

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
	let variantIndex = in.variantIndex + pawn.variantIndex;
	let seed = material.seed + 1 * variantIndex;

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
	var p = offsetModel * vec4(v.position, 1.0);
	//var p = offsetModel * vec4(v.position, 1.0);
	var position = mvp * p;

	out.position = position;
	out.uv = v.position.xy * 0.5 + 0.5;
	out.originalPosition = v.position;
	out.color = vec4(1.0);
	out.triangleId = in.id / 3u;
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

	let material = materials[in.materialIndex];
	let maxOctaves = 5.0;

	var p = normalize(in.originalPosition);
	//out.normal = vec4(p * -1.0, 1.0);

	let fp = fwidth(p);
	let mm = max(max(fp.x, fp.y), fp.z);
	var res = 1.0 - pow(smoothstep(0.0, 1.0/32.0, mm), 0.2);
	res = clamp(pow(res, 1.0), 0.0, 1.0);


	let c0 = unpack4x8unorm(material.colors[0]);
	let c1 = unpack4x8unorm(material.colors[1]);
	let c2 = unpack4x8unorm(material.colors[2]);
	let c3 = unpack4x8unorm(material.colors[3]);

	let octaves = 5;
	var n0 = skyNoise(p + vec3(camera.t/100.0, 0.0, 0.0), octaves, in.seed + 13*2);
	var n1 = skyNoise(p + vec3(0.0, camera.t/64.0, 0.0), octaves, in.seed + 13*4);
	var n2 = skyNoise(p + vec3(0.0, 0.0, camera.t/190.0), octaves, in.seed + 13*2);
	n0 = smoothstep(0.0, 1.0, n0);
	n1 = smoothstep(0.5, 1.0, n1);
	n2 = smoothstep(0.4, 1.0, n2);


	let a0 = mix(c0, c1, n0 * c1.a);
	let a1 = mix(c0, c2, n1 * c2.a);
	let a2 = mix(c0, c3, n2 * c3.a);


	out.albedo = (a0 + a1 + a2) / 3.0;
	out.normal = vec4(0.0);

	return out;
}

fn skyNoise(p: vec3<f32>, octaves: i32, seed: u32) -> f32 {
	var vseed = vec3(f32(seed) / 10000.0);
	var acc = 0.0;

	var totalAmp = 1.0;

	var amp = 1.0;
	//var freq = 4.0;
	var freq = 1.0 + 4.0 * pow(rnd3u(vec3(seed)), 3.0);
	for (var i: i32 = 0; i < octaves; i++) {
		totalAmp += amp;
		var n = smoothNoise(vseed + p * freq);
		acc += n * amp;
		freq *= 3.0;
		amp /= 1.5;
	}

	acc /= totalAmp;

	acc *= 1.0 + rnd3u(vec3(seed + 1234));
	return acc;
}

@import "./pawn.inc.wgsl";
@import "./camera.inc.wgsl";
@import "./vertex.inc.wgsl";
@import "engine/shaders/noise.wgsl";
@import "engine/shaders/color.wgsl";
