const DITHER_SHADOWS: bool = true;
const DRAW_BUMPS: bool = false;
const JIGGLY: bool = true;

const SKIN_MATTE: u32 = 1u << 0u;
const SKIN_EMISSIVE: u32 = 1u << 1u;
const SKIN_NOISE: u32 = 1u << 2u;

struct PackedVertex {
	position: array<f32, 3>,
	normal: array<f32, 3>,
	color: u32,
	softness: f32,
}

struct Vertex {
	position: vec3f,
	normal: vec3f,
	color: u32,
	softness: f32,
}

struct VertexIn {
	@builtin(vertex_index) id: u32,
	@builtin(instance_index) instance: u32,
	// Instance
	@location(3) transform0: vec4f,
	@location(4) transform1: vec4f,
	@location(5) transform2: vec4f,
	@location(6) transform3: vec4f,
	@location(7) instanceColor: vec4<u32>,
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
	@location(6) @interpolate(flat) triangleId: u32,
	@location(7) @interpolate(flat) quadId: u32,
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

struct Material {
	color: u32,
	dither: u32,
	fadeout: f32,
	skin: u32,
	noise: vec4<f32>,
	receiveShadows: u32,
}

struct Shadow {
	position: vec3f,
	radius: f32,
	umbra: f32,
	shape: u32,
	color: u32,
}

const ditherMatrix = mat4x4(
	0.0000, 0.5000, 0.1250, 0.6250,
	0.7500, 0.2500, 0.8750, 0.3750,
	0.1875, 0.6875, 0.0625, 0.5625,
	0.9375, 0.4375, 0.8125, 0.3125
);


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
	let emissive = (material.skin & SKIN_EMISSIVE) != 0;

	let variantIndex0 = in.variantIndex + pawn.variantIndex;
	let vertexOffset0 = euclidModu(variantIndex0, pawn.variantCount) * pawn.vertexCount;
	let idx0 = in.id + vertexOffset0;
	let pkv0 = vertices[idx0];

	var v = Vertex();
	if (in.variantBlend > 0.0) {
		let variantIndex1 = in.variantIndex + pawn.variantIndex + 1u;
		let vertexOffset1 = euclidModu(variantIndex1, pawn.variantCount) * pawn.vertexCount;
		let idx1 = in.id + vertexOffset1;
		let pkv1 = vertices[idx1];

		v = Vertex(
			mix(
				vec3(pkv0.position[0], pkv0.position[1], pkv0.position[2]),
				vec3(pkv1.position[0], pkv1.position[1], pkv1.position[2]),
				in.variantBlend
			),
			mix(
				vec3(pkv0.normal[0], pkv0.normal[1], pkv0.normal[2]),
				vec3(pkv1.normal[0], pkv1.normal[1], pkv1.normal[2]),
				in.variantBlend
			),
			pkv1.color,
			mix(pkv1.softness, pkv0.softness, in.variantBlend),
		);
	} else {
		v = Vertex(
			vec3(pkv0.position[0], pkv0.position[1], pkv0.position[2]),
			vec3(pkv0.normal[0], pkv0.normal[1], pkv0.normal[2]),
			pkv0.color,
			pkv0.softness,
		);
	}


	let transform = mat4x4(
		in.transform0,
		in.transform1,
		in.transform2,
		in.transform3
	);
	let offsetModel = pawn.model * transform;
	let mv = camera.view * offsetModel;
	let mvp = camera.projection * camera.view;
	var p = offsetModel * vec4(v.position, 1.0);
	if JIGGLY && v.softness > 0.0 {
		let j0 = fractalNoise((p.xyz/p.w) / 32.0 + vec3(100.0) + vec3(camera.t) * vec3(0.2, 0.01, 0.1), 2) - 0.5;
		let j1 = fractalNoise((p.xyz/p.w) / 32.0 + vec3(200.0) + vec3(camera.t) * vec3(0.2, 0.01, 0.1), 2) - 0.5;
		let j2 = fractalNoise((p.xyz/p.w) / 32.0 + vec3(300.0) + vec3(camera.t) * vec3(0.2, 0.01, 0.1), 2) - 0.5;
		let jigFactor = clamp(smoothstep(0.0, 3.0, p.y - 1.0), 0.0, 1.0) * v.softness / 2.0;
		let jig = vec3(j0, 0.0, j2) * jigFactor;
		p.x += jig.x;
		p.y += jig.y;
		p.z += jig.z;
	}
	var position = mvp * p;


	out.position = position;
	out.uv = v.position.xy * 0.5 + 0.5;


	let triangleId = in.id / 3;
	let quadId = in.id / 6;
	if emissive {
		out.normal = vec3(0.0);
	}
	else {
		out.normal = (offsetModel * vec4(normalize(v.normal), 0.0)).xyz;
	}

	out.originalPosition = v.position;
	let modelPosition = offsetModel * vec4(v.position, 1.0);
	out.modelPosition = modelPosition.xyz / modelPosition.w;
	out.modelNormal = (mv * vec4(v.normal, 0.0)).xyz;

	let vertexColor = uintToColor(v.color);
	let instanceColor = uintToColor(in.instanceColor[0]);
	let materialColor = uintToColor(material.color);
	if vertexColor.r == 1.0 && vertexColor.g == 1.0 && vertexColor.b == 1.0 && vertexColor.a == 1.0 {
		out.color = instanceColor * materialColor;
	}
	else {
		out.color = vertexColor * materialColor;
	}

	out.triangleId = (rnd3uu(vec3(4 + triangleId, 0, 9 + pawn.id))) % 0xff;
	out.quadId = (rnd3uu(vec3(4 + quadId, 0, 9 + pawn.id))) % 0xff;

	return out;
}


@fragment
fn fs_main(in: VertexOut) -> FragmentOut {
	var out: FragmentOut;
	var color = in.color;
	if color.a == 0.0 {
		discard;
	}

	let noisy = false;// FIXME material.noise.x > 0.0;

	var shade = 0.0;
	var shadowCount = 8u;

	if material.fadeout > 0.0 {
		let depth = smoothstep(0.0, 1.0, pow(((in.position.z / in.position.w) / material.fadeout), 4.0));
		color *= 1.0 - depth;
	}

	if !DITHER_SHADOWS && camera.isShadowMap > 0 {
		// Very translucent objects don't cast shadows
		if color.a < 0.5 {
			discard;
		}
	} else {
		let opacity = color.a;
		if color.a < 0.99 {
			color.a = 1.0;
			let ditherCoord = vec2(i32(in.position.x) % 4, i32(in.position.y) % 4);
			let ditherVal = ditherMatrix[ditherCoord.x][ditherCoord.y];
			if opacity < ditherVal {
				discard;
			}
		}
	}
	if color.a == 0.0 {
		discard;
	}
	if camera.isShadowMap == 0 {
		out.metaOutput = in.quadId;
		//out.metaOutput = in.triangleId;
		out.albedo =  vec4((color.rgb * (1.0-shade)) * color.a, color.a);

		var nn = vec3(0.0);
		// Add noisy texture to surface
		if noisy && length(in.normal) > 0.0 {
			var s0 = 0.1;
			var s1 = material.noise.x;
			var oc = 2;
			var nl = fractalNoise(s1 * in.modelPosition + vec3(-s0, 0.0, 0.0), oc) - 0.5;
			var nr = fractalNoise(s1 * in.modelPosition + vec3(s0, 0.0, 0.0), oc) - 0.5;
			var nd = fractalNoise(s1 * in.modelPosition + vec3(0.0, 0.0, -s0), oc) - 0.5;
			var nu = fractalNoise(s1 * in.modelPosition + vec3(0.0, 0.0, s0), oc) - 0.5;
			var grad = vec3(nl - nr, material.noise.y, nd - nu);
			nn = normalize(grad);
		}
		out.normal = vec4(normalize(in.normal + nn), 0.0);
	}


	return out;
}

// From: https://iquilezles.org/articles/distfunctions2d/
fn sdPentagon(q: vec2f, r: f32) -> f32 {
	var p = q;
    let k = vec3(0.809016994,0.587785252,0.726542528);
    p.x = abs(p.x);
    p -= 2.0*min(dot(vec2(-k.x,k.y),p),0.0)*vec2(-k.x,k.y);
    p -= 2.0*min(dot(vec2( k.x,k.y),p),0.0)*vec2( k.x,k.y);
    p -= vec2(clamp(p.x,-r*k.z,r*k.z),r);    
    return length(p)*sign(p.y);
}

@import "engine/shaders/helpers.wgsl";
@import "engine/shaders/color.wgsl";
@import "engine/shaders/noise.wgsl";
