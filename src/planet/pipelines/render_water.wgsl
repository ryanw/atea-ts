
struct WaterMaterial {
	seed: u32,
	shallowColor: u32,
	deepColor: u32,
}

struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) uv: vec2f,
	@location(1) normal: vec3f,
	@location(2) shallowColor: vec4f,
	@location(3) deepColor: vec4f,
	@location(4) alt: f32,
	@location(5) fragPosition: vec4f,
	@location(6) @interpolate(flat) triangleId: u32,
	@location(7) @interpolate(flat) quadId: u32,
}

struct FragmentOut {
	@location(0) color: vec4f,
}

@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<uniform> pawn: Pawn;

@group(0) @binding(2)
var<storage, read> materials: array<WaterMaterial>;

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

	let material = materials[in.materialIndex];
	let variantIndex = in.variantIndex + pawn.variantIndex;
	let seed = material.seed + variantIndex;

	let shallowColor = unpack4x8unorm(material.shallowColor);
	let deepColor = unpack4x8unorm(material.deepColor);

	let idx = in.id;
	let packedVertex = vertices[idx];

	let v = Vertex(
		vec3(packedVertex.position[0], packedVertex.position[1], packedVertex.position[2]),
		vec3(packedVertex.normal[0], packedVertex.normal[1], packedVertex.normal[2]),
		packedVertex.color,
		packedVertex.alt,
	);


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
	var normal = normalize(p.xyz/p.w);

	out.position = position;
	out.fragPosition = p;
	out.uv = v.position.xy;
	out.triangleId = in.id / 3u;
	out.quadId = in.id / 4u;
	out.normal = (offsetModel * vec4(normalize(v.position), 0.0)).xyz;
	out.alt = v.alt;

	out.shallowColor = shallowColor;
	out.deepColor = deepColor;
	return out;
}


@fragment
fn fs_main(in: VertexOut) -> FragmentOut {
	var out: FragmentOut;

	let normal = normalize(in.normal);

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

	
	let waterDepth = smoothstep(0.0, 1.0, pow(length(pd) / 1024.0, 0.2));
	//let waterDepth = smoothstep(0.0, 1.0, pow(length(pd) / 1024.0, 3.0));

	var color = mix(in.shallowColor, in.deepColor, waterDepth);

	let fragPos = in.fragPosition.xyz/in.fragPosition.w;
	// FIXME get as uniform
	//let lightDir = normalize(vec3(-0.6545084971874737, -0.5877852522924731, 0.4755282581475768));
	let lightDir = normalize(-fragPos.xyz);
	let shade = dot(lightDir, normal) * 0.5 + 0.5;
	var view = camera.view * vec4(0.0, 0.0, 0.0, 1.0);
	// FIXME this ain't right
	let cameraPos = camera.view * vec4(0.0, 0.0, 0.0, 1.0);
	let cp = cameraPos.xyz/cameraPos.w;
	var viewDir = normalize(cp - fragPos);

	let specularStrength = 0.5;
	let shininess = 100.0;

	// Compute the half-vector (H)
	let h = normalize(lightDir + viewDir);

	// Calculate the specular component using Phong's model
	let specular = pow(max(dot(normal, h), 0.0), shininess);

	// Multiply by the specular strength factor
	let specularColor = specularStrength * specular * vec3(1.0);
	color += vec4(specularColor, 0.0);


	out.color = vec4(color.rgb * shade * color.a, color.a);
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
@import "engine/shaders/helpers.wgsl";
@import "engine/shaders/color.wgsl";
