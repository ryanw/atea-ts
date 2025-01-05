struct StarMaterial {
	coreColor: u32,
	deepColor: u32,
	shallowColor: u32,
	coronaColor: u32,
}

struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) uv: vec2f,
	@location(1) normal: vec3f,
	@location(2) coronaColor: vec4f,
	@location(3) shallowColor: vec4f,
	@location(4) deepColor: vec4f,
	@location(5) coreColor: vec4f,
	@location(7) fragPosition: vec4f,
	@location(8) @interpolate(flat) triangleId: u32,
	@location(9) @interpolate(flat) quadId: u32,
}

struct FragmentOut {
	@location(0) color: vec4f,
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
var<storage, read> materials: array<StarMaterial>;

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
	let seed = variantIndex;

	let r0 = rnd3u(vec3(122 + seed * 7));
	let r1 = rnd3u(vec3(1200 + seed * 13)) - 0.5;

	let coronaColor = unpack4x8unorm(material.coronaColor);
	let shallowColor = unpack4x8unorm(material.shallowColor);
	let deepColor = unpack4x8unorm(material.deepColor);
	let coreColor = unpack4x8unorm(material.coreColor);

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

	out.coronaColor = coronaColor;
	out.shallowColor = shallowColor;
	out.deepColor = deepColor;
	out.coreColor = coreColor;
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


	var p = in.fragPosition.xyz / in.fragPosition.w;
	let cameraPos = camera.view * vec4(0.0, 0.0, 0.0, 1.0);
	let cp = cameraPos.xyz/cameraPos.w;

	// Position of the back
	let p0 = worldFromScreen(uv, in.position.z, camera.invProjection);

	// Position of the star
	let p1 = worldFromScreen(uv, depth, camera.invProjection);

	// Depth between rock and star
	let pd = (p1 - p0);
	let npd = normalize(pd);

	// Inner shell
	let pn0 = p0 + npd*800.0;
	// Outer shell
	let pn1 = p0 - npd*200.0;

	// Core noise
	//var n0 = fractalNoise(pn0/128.0, 2) + 0.5;
	//var n1 = fractalNoise(pn1/256.0, 3) + 0.5;
	let ct = camera.t;
	let vt = npd * ct;
	let n0 = fractalNoise(1111 + pn0/128.0 + ct*0.3, 1)/8.0;
	let n1 = fractalNoise(2222 + pn1/256.0 + ct*0.2 + n0, 3) + 0.5;
	let n2 = fractalNoise(3333 + pn0/211.0 + ct*0.3, 3)/16.0;
	let n3 = fractalNoise(4444 + pn1/344.0 + ct*0.2, 3);

	var starColor = vec4(0.0);
	
	//let starDepth = smoothstep(0.0, 1.0, pow(length(pd) / 1024.0, 0.2));
	var starDepth = smoothstep(0.0, 1.0, pow(length(pd) / 4096.0, 2.0));
	var coronaDepth = 0.0;

	// Corona noise
	starDepth -= n2;

	let corona = 0.1;
	let fuzz = corona;
	if (starDepth < corona) {
		// Draw Corona
		coronaDepth = smoothstep(0, corona, starDepth);
		// Smooth inner edge of corona
		coronaDepth *= smoothstep(corona, corona-0.2, starDepth)/2.0;

		starColor = mix(in.coronaColor, in.shallowColor, smoothstep(corona, 0.0, coronaDepth * n1));
		starColor.a = smoothstep(0.0, corona, starDepth);
	} else {
		// Draw body
		let deepColor = mix(in.deepColor, in.coreColor, smoothstep(0.0, 1.0, pow(starDepth, 2.0)));
		starColor = mix(in.shallowColor, deepColor, smoothstep(corona, 1.0, starDepth * n1));
	}

	var color = vec4(starColor.rgb, starColor.a);
	out.color = vec4(color.rgb * color.a, color.a);
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
@import "./vertex.inc.wgsl";
@import "./camera.inc.wgsl";
@import "./terrain_noise.wgsl";
@import "engine/shaders/noise.wgsl";
@import "engine/shaders/helpers.wgsl";
@import "engine/shaders/color.wgsl";
