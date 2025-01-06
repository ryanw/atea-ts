struct DebugMaterial {
	color: u32,
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
	@location(7) @interpolate(flat) materialIndex: u32,
}

struct FragmentOut {
	@location(0) albedo: vec4f,
	@location(1) normal: vec4f,
	@location(2) metaOutput: u32,
    @builtin(frag_depth) depth: f32,
}

@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<uniform> pawn: Pawn;

@group(0) @binding(2)
var<storage, read> materials: array<DebugMaterial>;

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
	var mv = camera.view * offsetModel;
	let mvp = camera.projection * mv;





	let scale = 1.0 / camera.resolution.y / 2.0;
	var origin = camera.view * offsetModel * vec4(0.0, 0.0, 0.0, 1.0);
	origin /= origin.w;
	let distScale = scale * origin.z;
	// Only position, no rotation
	//let p = translate(v.position * distScale) * origin;
	// Only position and rotation
	let p = mv * scaling(vec3(distScale)) * vec4(v.position, 1.0);

	let position = camera.projection * p;


	out.position = position;
	out.uv = v.position.xy * 0.5 + 0.5;
	out.originalPosition = v.position;
	out.color = vec4(1.0);
	out.normal = normal;
	out.alt = v.alt;

	out.materialIndex = in.materialIndex;

	return out;
}


@fragment
fn fs_main(in: VertexOut) -> FragmentOut {
	var out: FragmentOut;
	let material = materials[in.materialIndex];
	let color = in.color * unpack4x8unorm(material.color);

	out.albedo = vec4(color.rgb, color.a);
	out.normal = vec4(0.0);
	// Draw always on top
	out.depth = 0.0;

	return out;
}

@import "./pawn.inc.wgsl";
@import "./camera.inc.wgsl";
@import "./vertex.inc.wgsl";
@import "engine/shaders/helpers.wgsl";
@import "engine/shaders/noise.wgsl";
@import "engine/shaders/color.wgsl";
