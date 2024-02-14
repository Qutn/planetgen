// musgrave shader, for noise based planet texturing
// 3.14159265358979323846264
// Vertex Shader
export const musgraveVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  // Generate spherical UVs based on the vertex position
  float PI = 3.14159265358979323846264;

  vec3 normalizedPosition = normalize(position);
  float u = 0.5 + atan(normalizedPosition.z, normalizedPosition.x) / (2.0 * PI);
  float v = 0.5 - asin(normalizedPosition.y) / PI;
  
  // Apply a sinusoidal scaling to the U coordinate to reduce stretching
  float scalingStrength = 0.25; // Lower this value to reduce the effect, increase to enhance
  float scalingFactor = (1.0 - cos(v * PI)) * scalingStrength;

  float blendFactor = 1.3; // Factor 2: Blending Factor
  float sinusoidalU = u * scalingFactor / 2.0 + u * blendFactor;
  
  // Adjust u near the seam to create a blend zone
  float seamZoneWidth = 0.01; // Width of the blend zone on either side of the seam
  float blendZoneStart = 1.0 - seamZoneWidth;
  if (u < seamZoneWidth) {
    sinusoidalU *= smoothstep(0.0, seamZoneWidth, u);
  } else if (u > blendZoneStart) {
    sinusoidalU = blendZoneStart + (sinusoidalU - blendZoneStart) * smoothstep(0.0, seamZoneWidth, 1.0 - u);
  }

  // Use the sinusoidally adjusted U for the final UV mapping
  vUv = vec2(sinusoidalU, v);
  vNormal = normalize(normalMatrix * normal); // Transform the normal to view space

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader
export const musgraveFragmentShader = `
varying vec2 vUv;
varying vec3 vNormal;

uniform float layers;
uniform float amplitude;
uniform float lacunarity;
uniform float gain;
uniform vec3 lightColor;
uniform vec3 lightPosition;
uniform float lightIntensity;

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
  
  float edgeFactor(vec2 coord) {
    float edgeWidth = 0.1; // How wide the edge effect should be
    float uEdge = smoothstep(0.0, edgeWidth, coord.x) * (1.0 - smoothstep(1.0 - edgeWidth, 1.0, coord.x));
    float vEdge = smoothstep(0.0, edgeWidth, coord.y) * (1.0 - smoothstep(1.0 - edgeWidth, 1.0, coord.y));
    return min(uEdge, vEdge); // Use the smallest value to ensure it affects all edges
  }

  void main() {
    // Adjust the UVs to avoid the seam
    vec2 adjustedUV = vUv;
    adjustedUV.x = vUv.x < 0.5 ? mix(0.25, 0.5, vUv.x * 2.0) : mix(0.5, 0.75, (vUv.x - 0.5) * 2.0);
    
    // Get the base noise value
    float n = fbm(adjustedUV * 3.5); // The multiplier here controls the scale of the noise
    
    // Apply the edge factor to reduce noise values at the edges
    n *= edgeFactor(vUv);
  
    vec3 norm = normalize(vNormal); // Now vNormal is declared and can be used
    vec3 lightDir = normalize(lightPosition - vec3(gl_FragCoord)); // Calculate the light direction
    float diff = max(dot(norm, lightDir), 0.0); // Calculate the diffuse component
    vec3 diffuse = lightColor * diff * lightIntensity; // Calculate the final diffuse color
  
    vec3 color = mapToTerrainColor(n); // Get the base terrain color
    vec3 finalColor = color * diffuse; // Apply the lighting to the terrain color
  
    gl_FragColor = vec4(finalColor, 1.0); // Output the final color
  }
`;



// methos for calling different values
// material.uniforms.layers.value = 4; // Set the number of layers for the fBM noise
// material.uniforms.amplitude.value = 0.5; // Set the initial amplitude
// material.uniforms.lacunarity.value = 2.0; // Set the lacunarity
// material.uniforms.gain.value = 0.5; // Set the gain


  function generateNoiseTexture(width, height, scale, detail, dimension, lacunarity) {
    // Create a canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
  
    // Replace this with your noise function
    function noise(x, y, z) {
      // Placeholder for noise function
      return Math.random();
    }
  
    // Adjust the noise function based on the scale and detail parameters
    function scaledNoise(x, y, z) {
      return noise(x * scale, y * scale, z * scale) * detail;
    }
  
    // Generate noise-based texture
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        
        // Implement fbm (Fractal Brownian Motion)
        for (let o = 0; o < dimension; o++) {
          value += scaledNoise(x * frequency, y * frequency, 0) * amplitude;
          amplitude *= lacunarity;
          frequency *= detail;
        }
  
        // Normalize value to the range of 0-255
        const colorValue = Math.floor((value + 1) / 2 * 255);
        const pixelIndex = (y * width + x) * 4;
        imageData.data[pixelIndex] = colorValue;     // R
        imageData.data[pixelIndex + 1] = colorValue; // G
        imageData.data[pixelIndex + 2] = colorValue; // B
        imageData.data[pixelIndex + 3] = 255;        // A
      }
    }
  
    // Update canvas with the generated noise
    ctx.putImageData(imageData, 0, 0);
  
    // Create a THREE.Texture from the canvas
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
  
    return texture;
  }

// Usage
// const musgraveTexture = generateMusgraveTexture(1024, 1024);
// const material = new THREE.MeshStandardMaterial({
//   map: musgraveTexture,
  // ... other material properties
// });

// const planetMesh = new THREE.Mesh(planetGeometry, material);
// ... the rest of your planet creation code