// Smoothstep that works the same on all platforms
fn ss(e0: f32, e1: f32, t: f32) -> f32 {
	let x = clamp((t - e0) / (e1 - e0), 0.0, 1.0);
	return x * x * (3 - 2 * x);
}

fn euclidMod(n: i32, m: i32) -> i32 {
	var x = n % m;
	if n < 0 {
		x += m;
	}
	return x;
}

fn euclidModu(n: u32, m: u32) -> u32 {
	var x = n % m;
	if n < 0 {
		x += m;
	}
	return x;
}
fn euclidModf(n: f32, m: f32) -> f32 {
	var x = n % m;
	if n < 0.0 {
		x += m;
	}
	return x;
}

fn worldFromScreen(coord : vec2f, depth_sample: f32, mvp: mat4x4f) -> vec3f {
  // reconstruct world-space position from the screen coordinate.
  let posClip = vec4(coord.x * 2.0 - 1.0, (1.0 - coord.y) * 2.0 - 1.0, depth_sample, 1.0);
  let posWorldW = mvp * posClip;
  let posWorld = posWorldW.xyz / posWorldW.www;
  return posWorld;
}

fn translate(offset: vec3f) -> mat4x4f {
	return mat4x4f(
		1.0, 0.0, 0.0, 0.0,
		0.0, 1.0, 0.0, 0.0,
		0.0, 0.0, 1.0, 0.0,
		offset.x, offset.y, offset.z, 1.0,
	);
}

fn lookAt(dir: vec3f, up: vec3f) -> mat4x4f {
	let forward = normalize(dir);
	let right = normalize(cross(up, forward));
	let up2 = cross(forward, right);
	return mat4x4f(
		vec4(right, 0.0),
		vec4(up2, 0.0),
		vec4(forward, 0.0),
		vec4(0.0, 0.0, 0.0, 1.0),
	);
}

fn rot2(angle: f32) -> mat2x2f {
	let c = cos(angle);
	let s = sin(angle);
	return mat2x2f(c, -s, s, c);
}

fn identity() -> mat4x4f {
	return translate(vec3(0.0));
}
