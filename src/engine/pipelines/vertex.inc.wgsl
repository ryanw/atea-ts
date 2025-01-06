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

struct VertexIn {
	@builtin(vertex_index) id: u32,
	@builtin(instance_index) instance: u32,
	// Instance
	@location(3) transform0: vec4f,
	@location(4) transform1: vec4f,
	@location(5) transform2: vec4f,
	@location(6) transform3: vec4f,
	@location(7) materialIndex: u32,
	@location(8) instanceColors: vec3<u32>,
	@location(9) variantIndex: u32,
	@location(10) variantBlend: f32,
	@location(11) live: u32,
}
