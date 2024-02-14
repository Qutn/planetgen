// musgrave shader, for noise based planet texturing

export const musgraveVertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vPosition = position;
  vNormal = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const musgraveFragmentShader = `
varying vec3 vPosition;
varying vec3 vNormal;

uniform float layers;
uniform float amplitude;
uniform float lacunarity;
uniform float gain;
uniform mat4 modelMatrix;

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
    
    float waterLevel = 0.2;
    float sandLevel = 0.3;
    float grassLevel = 0.6;
    
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
    // Transform vertex position to world space
    vec3 worldPosition = vec3(modelMatrix * vec4(vPosition, 1.0));
  
    // Calculate blend weights based on the normal vector
    vec3 blendWeights = abs(vNormal);
    blendWeights = blendWeights / dot(blendWeights, vec3(1.0));
  
    // Scale worldPosition by some value to avoid stretching on larger planets
    vec3 scaledPosition = worldPosition * 0.1; // Tune this scale factor as needed
  
    // Sample noise for each axis
    float nX = fbm((scaledPosition.yz + 1.0) * 5.0) * blendWeights.x;
    float nY = fbm((scaledPosition.xz + 1.0) * 5.0) * blendWeights.y;
    float nZ = fbm((scaledPosition.xy + 1.0) * 5.0) * blendWeights.z;
  
    // Combine the noise values based on the blend weights
    float combinedNoise = nX + nY + nZ;
    combinedNoise = clamp(combinedNoise / (blendWeights.x + blendWeights.y + blendWeights.z), 0.0, 1.0);
  
    // Map the noise value to terrain colors
    vec3 color = mapToTerrainColor(combinedNoise);

   // Visualize the UVs by mapping position to color
   vec3 uvColor = worldPosition - floor(worldPosition);
   uvColor = uvColor * blendWeights; // Apply blend weights to visualize the triplanar blending
 
   gl_FragColor = vec4(uvColor, 1.0);

   // gl_FragColor = vec4(color, 1.0);
  }
`;



// methos for calling different values
// material.uniforms.layers.value = 4; // Set the number of layers for the fBM noise
// material.uniforms.amplitude.value = 0.5; // Set the initial amplitude
// material.uniforms.lacunarity.value = 2.0; // Set the lacunarity
// material.uniforms.gain.value = 0.5; // Set the gain