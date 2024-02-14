// musgrave shader, for noise based planet texturing

// Vertex Shader
export const musgraveVertexShader = `
varying vec2 vUv;

void main() {
  // Generate spherical UVs based on the vertex position
  vec3 normalizedPosition = normalize(position);
  float u = 0.5 + atan(normalizedPosition.z, normalizedPosition.x) / (2.0 * 3.14159265358979323846);
  float v = 0.5 - asin(normalizedPosition.y) / 3.14159265358979323846;
  vUv = vec2(u, v);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader
export const musgraveFragmentShader = `
varying vec2 vUv;
uniform float layers;
uniform float amplitude;
uniform float lacunarity;
uniform float gain;

float interpolate(float a, float b, float t) {
  return mix(a, b, t * t * (3.0 - 2.0 * t));
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  return interpolate(interpolate(a, b, u.x), interpolate(c, d, u.x), u.y);
}

float fbm(vec2 coordinates) {
  float total = 0.0;
  float amplitudeLocal = amplitude;
  float frequency = 1.0;
  for (int i = 0; i < 16; i++) {
    if(i >= int(layers)) break;
    total += noise(coordinates * frequency) * amplitudeLocal;
    frequency *= lacunarity;
    amplitudeLocal *= gain;
  }
  return total;
}

vec3 mapToTerrainColor(float noiseValue) {
    // Simple color ramp - adjust these colors and thresholds as needed
    vec3 water = vec3(0.0, 0.0, 0.5); // Deep blue
    vec3 sand = vec3(0.8, 0.7, 0.2); // Sand color
    vec3 grass = vec3(0.0, 0.5, 0.0); // Green
    vec3 rock = vec3(0.5, 0.5, 0.5); // Gray
    
    float waterLevel = 0.7;
    float sandLevel = 0.8;
    float grassLevel = 0.95;
    
    if(noiseValue < waterLevel) {
      return water;
    } else if(noiseValue < sandLevel) {
      return mix(water, sand, (noiseValue - waterLevel) / (sandLevel - waterLevel));
    } else if(noiseValue < grassLevel) {
      return mix(sand, grass, (noiseValue - sandLevel) / (grassLevel - sandLevel));
    } else {
      return rock;
    }
  }
  

  void main() {
    float n = fbm(vUv * 2.5); // The multiplier here controls the scale of the noise
    vec3 color = mapToTerrainColor(n);
    gl_FragColor = vec4(color, 1.0);

  }
`;



// methos for calling different values
// material.uniforms.layers.value = 4; // Set the number of layers for the fBM noise
// material.uniforms.amplitude.value = 0.5; // Set the initial amplitude
// material.uniforms.lacunarity.value = 2.0; // Set the lacunarity
// material.uniforms.gain.value = 0.5; // Set the gain