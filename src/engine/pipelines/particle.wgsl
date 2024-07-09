struct Instance {
	offset: array<f32, 3>,
	color: u32,
	vertexIndex: u32,
}

struct Particle {
	velocity: array<f32, 3>,
	birth: f32,
}

struct Uniforms {
	origin: vec3f,
	direction: vec3f,
	time: f32,
	dt: f32,
	count: u32,
	seed: f32,
}

@group(0) @binding(0)
var<uniform> u: Uniforms;

@group(0) @binding(1)
var<storage, read_write> counter: atomic<u32>;

@group(0) @binding(2)
var<storage, read_write> instances: array<Instance>;

@group(0) @binding(3)
var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
	let particleCount = 256.0; // FIXME get total instance capacity
	let maxAge = 1.0;
	let spread = 6.0;
	let idx = globalId.x;
	let timeOffset = (f32(idx) / particleCount) * maxAge;
	var instance: Instance = instances[idx];
	var particle: Particle = particles[idx];

	let age = u.time - particle.birth;
	var isNew = particle.birth == 0.0;
	var isExpired = age > maxAge + timeOffset;
	var isPending = age < timeOffset;
	var isLive = idx < u.count;

	var p = vec3(instance.offset[0], instance.offset[1], instance.offset[2]);
	var velocity = vec3(particle.velocity[0], particle.velocity[1], particle.velocity[2]);

	let n0 = rnd3(particle.birth + vec3(f32(idx))) - 0.5;
	let n1 = rnd3(particle.birth + vec3(f32(idx + 10000))) - 0.5;
	let n2 = rnd3(particle.birth + vec3(f32(idx + 20000))) - 0.5;
	let n3 = rnd3(particle.birth + vec3(f32(idx + 30000))) - 0.5;

	if isPending || isNew || isExpired {
		if isLive {
			// Respawn particle
			if !isPending {
				particle.birth = u.time;
			}
			p = u.origin;

			let speed = 100.0;
			let gravity = -33.0 * u.dt;
			// FIXME need to rotate this to match u.direction
			let spray = vec3(n0 * 2.0, 0.0, n2 * 2.0);
			let thrust = (u.direction * speed) * u.dt;
			velocity = thrust + spray;
		} else {
			// Destroy particle
			particle.birth = 0.0;
			velocity = vec3(0.0);
		}
	}
	else if !isPending {
		// Update particle position
		p += velocity * u.dt;
	}

	var color = vec4(0.0);

	var shouldDraw = !isPending;
	shouldDraw = shouldDraw && particle.birth > 0.0;
	shouldDraw = shouldDraw && particle.birth <= u.time;

	if shouldDraw {
		// Draw live particles
		//let dur = (age - timeOffset) / (maxAge);
		let dur = (age - timeOffset + n3/3.0) / maxAge;
		let hot = hsl(0.13, 1.0, 1.0);
		let mid = hsl(0.13, 1.0, 0.5);
		var cold = hsl(0.0, 1.0, 0.3);
		let ct = 1.0 - clamp(dur * 1.7, 0.0, 1.5);
		if (ct < 0.5) {
			color = mix(cold, mid, ct * 2.0);
		} else {
			color = mix(mid, hot, (ct * 2.0 - 1.0));
		}
		let opacity = 1.0 - clamp(pow(dur, 2.0), 0.0, 1.0);
		color.a = opacity;
	} else {
		// Remove hidden particles
		color = vec4(0.0);
	}

	instance.color = colorToUint(color);
	particle.velocity = array(velocity.x, velocity.y, velocity.z);
	instance.offset = array(p.x, p.y, p.z);
	instances[idx] = instance;
	particles[idx] = particle;
}

@import "engine/shaders/color.wgsl";
@import "engine/shaders/noise.wgsl";
