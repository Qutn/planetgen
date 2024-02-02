import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { generatePlanetName } from './generators/names.js';
import { generateGeologicalData, determinePlanetaryComposition } from './generators/crust.js';
import { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone, getPlanetAtmosphere, determinePlanetType  } from './generators/orbit.js';

// Global variables for the three.js objects
let sphere, scene, camera, renderer, controls, canvas;
let atmosphereMesh;
let starLight, ambientLight;
let rotationSpeed = 0.001; // This is a placeholder value
let ringRotationVariance = 0.0005; 


document.addEventListener('DOMContentLoaded', () => {
    const defaultStar = { type: 'G', size: 1, luminosity: 1, habitableZone: { innerBoundary: 0.95, outerBoundary: 1.37 } };
    const defaultPlanet = { type: 'Terrestrial', radius: 1, orbitRadius: 1 };
	//	console.log("DOMContentLoaded - Default Star Data:", defaultStar);
    setupThreeJS(defaultStar, defaultPlanet, defaultStar.habitableZone);
    setupStarGeneration();
    setupSolarSystemGeneration();
});

function setupThreeJS(star, planet, habitableZone) {
    initializeThreeJSEnvironment('planetCanvas');
    createPlanet(planet);
    createAtmosphereMesh(planet, habitableZone);
    setupLighting(star);
    setupOrbitControls();
    startAnimationLoop();
}

// setup scripts

function initializeThreeJSEnvironment(canvasId) {
    canvas = document.getElementById(canvasId);
    //	console.log("Canvas initialized:", canvas, "Dimensions:", canvas.clientWidth, "x", canvas.clientHeight);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
	camera.position.z = 20;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // or other shadow types as needed
    camera.castShadow = true;

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    //	console.log("Window resized: New dimensions", canvas.clientWidth, "x", canvas.clientHeight);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
	//    console.log("Camera aspect updated to:", camera.aspect);
}

function createPlanet(planetData) {
    // Remove existing planet
    if (sphere) {
        scene.remove(sphere);
        if (sphere.geometry) sphere.geometry.dispose();
        if (sphere.material.map) sphere.material.map.dispose();
        if (sphere.material) sphere.material.dispose();
        sphere = null;
    }
    
    // Remove existing rings (if any)
    const existingRings = scene.getObjectByName('planetRings');
    if (existingRings) {
        existingRings.children.forEach((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material.map) child.material.map.dispose();
            if (child.material) child.material.dispose();
        });
        scene.remove(existingRings);
    }

    // Proceed with planet creation
    const noiseTexture = createNoiseTexture();
    const planetColor = getColorForPlanetType(planetData.type); // Get color based on planet type
    const planetColorRgb = hexToRgb(planetColor); // Convert hex color to RGB
    console.log(`Creating ${planetData.type}: Color chosen is ${planetColorRgb} (Hex: ${planetColor.toString(16)})`);

    const planetGeometry = new THREE.SphereGeometry(planetData.radius, 32, 32);
    const planetMaterial = new THREE.MeshStandardMaterial({
        map: noiseTexture, // Apply the noise texture
        color: planetColor // Apply the color from our function
    });

    sphere = new THREE.Mesh(planetGeometry, planetMaterial);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.name = 'planet'; // Naming the planet for easy identification
    scene.add(sphere);

    // Create segmented rings for Gas Giants and Ice Giants
    if (planetData.type === 'Gas Giant' || planetData.type === 'Ice Giant') {
        const ringSegmentsGroup = createSegmentedRings(planetData.radius, planetData.type);
        ringSegmentsGroup.name = 'planetRings'; // Naming the group for easy access
        scene.add(ringSegmentsGroup); // Add the group to the scene
    }
}


function createAtmosphereMesh(planetData, habitableZone) {
    const atmosphereComposition = getPlanetAtmosphere(planetData.type, planetData.orbitRadius, habitableZone);
    atmosphereMesh = createAtmosphere(planetData.radius, atmosphereComposition);
    scene.add(atmosphereMesh);
}

function setupLighting(starData) {
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    if (starLight) {
        scene.remove(starLight); // Remove existing light if present
    }

    // Create a new directional light
    starLight = new THREE.DirectionalLight(color, intensity);
    starLight.position.set(0, 0, 1); // Position it to shine towards the scene

    // Enable shadow casting for the light
    starLight.castShadow = true;

    // Configure shadow properties
    starLight.shadow.mapSize.width = 2048; // Increase for better shadow resolution
    starLight.shadow.mapSize.height = 2048;
    starLight.shadow.camera.near = 0.1; // Adjust based on your scene's scale
    starLight.shadow.camera.far = 10000;
    starLight.shadow.radius = 4;

    // Add the light to the scene
    scene.add(starLight);
    adjustLightPosition();

    // Update ambient light as well
    if (ambientLight) {
        ambientLight.color.set(color);
        ambientLight.intensity = intensity / 5;
    } else {
        ambientLight = new THREE.AmbientLight(color, intensity / 5);
        scene.add(ambientLight);
    }
}

function setupOrbitControls() {
    controls = new OrbitControls(camera, renderer.domElement);
	//    console.log("OrbitControls initialized:", controls);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
}

function startAnimationLoop() {
    function animate() {
        requestAnimationFrame(animate);
        	// console.log("Animation frame");
            // Rotate the planet
        if (sphere) {
            sphere.rotation.y += rotationSpeed;
        }
            // Rotate the rings with variance
    const rings = scene.getObjectByName('planetRings');
    if (rings) rings.rotation.y += rotationSpeed + Math.random() * ringRotationVariance - ringRotationVariance / 2;

        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

//end setup scripts

//generation functions


function updatePlanetAndAtmosphere(planetRadius, atmosphereComposition) {
    // Update planet geometry and material
    // Update or create atmosphere
    if (atmosphereMesh) {
        scene.remove(atmosphereMesh);
    }

    atmosphereMesh = createAtmosphere(planetRadius, atmosphereComposition);
    scene.add(atmosphereMesh);
}

function updateStarLight(starData) {
    console.log("updateStarLight - Star Type and Luminosity:", starData.type, starData.luminosity);
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    // Update the lights
    updateStarLightIntensityAndColor(color, intensity);
    updateAmbientLightIntensityAndColor(color, intensity / 10);
}


function updateStarLightIntensityAndColor(color, intensity) {
    starLight.color.set(color);
    starLight.intensity = intensity;
    adjustLightPosition();

}

function updateAmbientLightIntensityAndColor(color, intensity) {
    ambientLight.color.set(color);
    ambientLight.intensity = intensity;
}

function adjustLightPosition() {
    const variance = 0.1; // Adjust this value for more or less variance
    const randomX = (Math.random() - 0.5) * variance;
    // Ensure that randomY is always positive or zero to keep the light above the planet
    const randomY = Math.random() * (variance / 2);

    // Adjust light position
    starLight.position.x += randomX;
    // Only add to the Y position to keep the light above the planet
    starLight.position.y += Math.abs(randomY); // Use Math.abs to ensure positivity

    // Log new light position for debugging
    console.log("New Light Position:", starLight.position);
}



function updatePlanetSize(planetRadiusInEarthUnits, planetType, orbitRadius, starData) {
    // Prepare new planet data
    const newPlanetData = {
        radius: planetRadiusInEarthUnits,
        type: planetType,
        orbitRadius: orbitRadius
        // Add other necessary properties if needed
    };

    // Create a new planet with the updated size
    createPlanet(newPlanetData);

    // Update atmosphere
    const atmosphereComposition = getPlanetAtmosphere(planetType, orbitRadius, starData.habitableZone);
    updatePlanetAndAtmosphere(planetRadiusInEarthUnits, atmosphereComposition);

    // Update lighting based on star type
    updateStarLight(starData);

    // Adjust camera distance if necessary
    // camera.position.z = 20 * planetRadiusInEarthUnits;
}


// star generation

function setupStarGeneration(div, orbitData, selectedPlanetIndex = null) {
    const generateStarButton = document.getElementById('generateStarButton');
    const starPropertiesDiv = document.getElementById('starProperties');

    generateStarButton.addEventListener('click', () => {
        const star = generateStar();
        displayStarProperties(star, starPropertiesDiv);
    	setupThreeJS(orbitData.parentStar, selectedPlanet, orbitData.parentStar.habitableZone); // Call setupThreeJS with the generated star only

    });
}

function generateStar() {
	// console.log("generateStar - Generated Star Data:", star);
    // Import or reference the functions from orbit.js
    const parentStar = generateParentStar();
    const { size, mass } = generateStarSizeAndMass(parentStar.type, parentStar.age);
    const luminosity = generateStarLuminosity(parentStar.type, size);
    const habitableZone = calculateHabitableZone(luminosity);

    return {
        type: parentStar.type,
        age: parentStar.age,
        size: size,
        mass: mass,
        luminosity: luminosity,
        habitableZone: habitableZone
    };
    console.log("Generated Star:", parentStar);

}

function calculateGravity(planetRadiusInEarthRadii) {
    const earthGravity = 9.8; // in m/s^2
    return earthGravity * planetRadiusInEarthRadii;
}

function displayStarProperties(star, div) {
    div.innerHTML = `
        <p>Type: ${star.type}</p>
        <p>Age: ${star.age.toFixed(2)} billion years</p>
        <p>Size: ${star.size.toFixed(2)} Solar radii</p>
        <p>Mass: ${star.mass.toFixed(2)} Solar masses</p>
        <p>Luminosity: ${star.luminosity.toFixed(2)} Solar luminosity</p>
        <p>Habitable Zone: ${star.habitableZone.innerBoundary.toFixed(2)} - ${star.habitableZone.outerBoundary.toFixed(2)} AU</p>
    `;
}

// solar system generation

function setupSolarSystemGeneration() {
    const generateSystemButton = document.getElementById('generateSystemButton');
    const solarSystemPropertiesDiv = document.getElementById('solarSystemProperties');
    const starPropertiesDiv = document.getElementById('starProperties');

    generateSystemButton.addEventListener('click', () => {
        const orbitData = generateOrbit();
        displayStarProperties(orbitData.parentStar, starPropertiesDiv);
    	displaySolarSystemProperties(solarSystemPropertiesDiv, orbitData);
    });
}

function displaySolarSystemProperties(div, orbitData, selectedPlanetIndex = null) {
    let htmlContent = '<h3>Solar System Planets</h3>';
    let selectedPlanet = null;

    orbitData.solarSystem.forEach((planet, index) => {
        const planetDetails = `Planet ${index + 1}: Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size.toFixed(2)}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
        htmlContent += `<p>${planetDetails}</p>`;

        	if (planet.orbitRadius >= orbitData.parentStar.habitableZone.innerBoundary && planet.orbitRadius <= orbitData.parentStar.habitableZone.outerBoundary) {
            	displayHabitablePlanetDetails(planet, 1, index, orbitData.parentStar);
        	}

        // Check if this is the selected planet for focused display
        	if (selectedPlanetIndex !== null && index === selectedPlanetIndex) {
            	selectedPlanet = planet;
        	}
    });

    div.innerHTML = htmlContent;

    // If a selected planet is defined, set up its ThreeJS representation
    if (selectedPlanet) {
        setupThreeJS(orbitData.parentStar, selectedPlanet, orbitData.parentStar.habitableZone);
    }
}

async function displayHabitablePlanetDetails(planet, systemNumber, planetIndex, star, starData) {
    	// console.log("Displaying habitable planet details"); // Debugging log
    const habitablePlanetDiv = document.getElementById('habitablePlanetDetails');
    
    // Assuming these are placeholders for now
    const atmosphereType = 'M';
    const geologicalActivity = 'Active';
    const moonCount = 2;
    const planetName = generatePlanetName(systemNumber, planetIndex, atmosphereType, geologicalActivity, moonCount);
    const planetDetails = `Name: ${planetName}<br>Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size.toFixed(2)}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
		// console.log("Planet Details:", planetDetails); // Debugging log
    // Star and planet data
    const starSize = star.size;
    const starMass = star.mass;
    const orbitalRadius = planet.orbitRadius;
    const planetSize = planet.size;
    	// console.log("Star Size:", starSize, "Star Mass:", starMass, "Orbital Radius:", orbitalRadius, "Planet Size:", planetSize); // Debugging log
    // Get geological data
    const geologicalData = generateGeologicalData(planet.size, orbitalRadius, starSize, starMass);
    	// console.log("Geological Data:", geologicalData); // Debugging log
    // Append geological data to planet details
    const geologicalDetails = `Core Size: ${geologicalData.core.size}, Mantle Size: ${geologicalData.mantle.size}, Crust Size: ${geologicalData.crust.size}, Geological Activity: ${geologicalData.tectonics}`;
    let content = `<h3>Habitable Planet Details</h3><p>${planetDetails}</p><p>${geologicalDetails}</p>`;
    // Element composition
    const compositionData = await determinePlanetaryComposition(planet.size, planet.orbitRadius, star.size, star.mass);
    	// console.log("Composition Data:", compositionData); // Debugging log
		// console.log("Keys in Composition Data:", Object.keys(compositionData));
    // Sort and filter elements
    const valuableElements = ['O', 'Si', 'Al', 'Fe', 'Na', 'Mg', 'K', 'Ti', 'H', 'Cu', 'Ag', 'Au', 'Mth']; // Iron, Copper, Silver, Gold, Mithril
    const sortedComposition = Object.entries(compositionData)
                                     .filter(([element]) => valuableElements.includes(element))
                                     .sort((a, b) => b[1] - a[1]); // Sort by abundance
		// console.log("Sorted Composition:", sortedComposition); // Debugging log
    // Calculate and append elemental mass
    const earthVolume = (4/3) * Math.PI * Math.pow(6371, 3); // Earth's volume in km^3
    const planetVolume = (4/3) * Math.PI * Math.pow(planet.size * 6371, 3); // Planet's volume in km^3
    const scalingFactor = planetVolume / earthVolume; // Scaling factor based on volume
		// console.log("Planet Size (in Earth radii):", planet.size);
		// console.log("Planet Volume (in km^3):", planetVolume);
    const planetGravityInMs2 = (planet.size * 9.8).toFixed(2); // Gravity in m/s^2
    const planetGravityInG = (planetGravityInMs2 / 9.8).toFixed(2); // Convert to Earth's gravity
    const gravityDetails = `<p>Gravity: ${planetGravityInMs2} m/s<sup>2</sup> (${planetGravityInG} G)</p>`;
    content += gravityDetails;

    	// console.log("Displaying details for habitable planet. Size:", planet.size); // Log before calling updatePlanetSize
		// console.log("displayHabitablePlanetDetails - Star Data:", star);
    updatePlanetSize(planet.size, planet.type, planet.orbitRadius, star, starData);

	let elementDetails = '';
	sortedComposition.forEach(([element, percentage]) => {
    	const elementVolume = planetVolume * percentage * 1000000000;
    	let elementMass = elementVolume * getElementDensity(element);
    	elementMass *= scalingFactor; // Apply scaling factor to element mass
            		// console.log(`Element: ${element}, Percentage: ${percentage}, Volume: ${elementVolume}, Mass: ${elementMass}`);
    	const formattedElementMass = elementMass.toExponential(2); // Format elementMass in scientific notation
    	elementDetails += `<p>${element}: ${formattedElementMass} kg</p>`;
    		// console.log(`Formatted Mass for ${element}: ${formattedElementMass}`);
});
    	// console.log("Element Details:", elementDetails); // Debugging log
	content += `<div class="element-details">${elementDetails}</div>`;
    habitablePlanetDiv.innerHTML = content;
		// console.log("Final HTML Content:", content);

}

function getElementDensity(element) {
    // Return density of the element, placeholder values used here, will reference a json eventually
const densities = {
    'O': 1.429,
    'Si': 2330,
    'Al': 2700,
    'Fe': 7874,
    'Na': 968,
    'Mg': 1740,
    'K': 856,
    'Ti': 4506,
    'H': 0.08988,
    'Cu': 8960,
    'Ag': 10490,
    'Au': 19300,
    'Mth': 12000
};
    return densities[element] || 5500; // Default density
}

// Star color generation for lighting
function calculateStarColorAndIntensity(starType, starLuminosity) {
    console.log("calculateStarColorAndIntensity - Received Star Type:", starType, "Luminosity:", starLuminosity);
    const temperatures = {
        'O': 35000, // Average temperature in Kelvin
        'B': 20000, // Average temperature in Kelvin
        'A': 8750,  // Average temperature in Kelvin
        'F': 6750,  // Average temperature in Kelvin
        'G': 5750,  // Average temperature in Kelvin
        'K': 4250,  // Average temperature in Kelvin
        'M': 3250   // Average temperature in Kelvin
    };

    const temperature = temperatures[starType] || 5800; // Default to Sun-like temperature (G-type)
    const peakWavelength = 0.0029 / temperature; // Wien's Law
    let color = wavelengthToRGB(peakWavelength * 1e9); // Convert to nanometers

    // Desaturate the color by blending it with white
    const desaturationFactor = 0.5; // Adjust this to control the desaturation level (0 = full color, 1 = full white)
    color = desaturateColor(color, desaturationFactor);

    // Calculate intensity based on star's luminosity
    const baseIntensity = 1; // Base intensity for a sun-like star (G-type)
    let intensity = baseIntensity * starLuminosity;

    // Optionally, add limits or scaling as needed
    // For example, a cap on the maximum intensity
    const maxIntensity = 5; // Maximum intensity cap
    intensity = Math.min(intensity, maxIntensity);

    return { color, intensity };
}

// Function to desaturate a color towards white
function desaturateColor(color, factor) {
    const white = new THREE.Color(0xffffff);
    const originalColor = new THREE.Color(color);
    const desaturatedColor = originalColor.lerp(white, factor);
    return desaturatedColor.getStyle(); // Returns the CSS color string
}

// convert wavelength to rgb
function wavelengthToRGB(wavelength) {
    // Normalize wavelength to a range between 380 and 780
    const normalizedWavelength = Math.max(380, Math.min(wavelength, 780));
    // Map the normalized wavelength to a 0-1 range
    const t = (normalizedWavelength - 380) / (780 - 380);
    // Define color points for interpolation
    const colors = {
        red: { r: 255, g: 0, b: 0 },      // Red
        yellow: { r: 255, g: 255, b: 0 }, // Yellow
        white: { r: 255, g: 255, b: 255 },// White
        blue: { r: 0, g: 0, b: 255 }      // Blue
    };
    let r, g, b;
    // Linear interpolation between color points
    if (t < 0.33) {
        // From red to yellow
        r = lerp(colors.red.r, colors.yellow.r, t / 0.33);
        g = lerp(colors.red.g, colors.yellow.g, t / 0.33);
        b = lerp(colors.red.b, colors.yellow.b, t / 0.33);
    } else if (t < 0.66) {
        // From yellow to white
        r = lerp(colors.yellow.r, colors.white.r, (t - 0.33) / 0.33);
        g = lerp(colors.yellow.g, colors.white.g, (t - 0.33) / 0.33);
        b = lerp(colors.yellow.b, colors.white.b, (t - 0.33) / 0.33);
    } else {
        // From white to blue
        r = lerp(colors.white.r, colors.blue.r, (t - 0.66) / 0.34);
        g = lerp(colors.white.g, colors.blue.g, (t - 0.66) / 0.34);
        b = lerp(colors.white.b, colors.blue.b, (t - 0.66) / 0.34);
    }
    // Convert RGB values to 0-255 range and return as string
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Linear interpolation function
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

// adjust gamma function
function adjustGamma(value) {
    if (value <= 0) {
        return 0;
    } else {
        return Math.pow(value, 0.8);
    }
}

// get color of atmosphere from generated comp, will adjust later
function getAtmosphereColor(composition) {
    const colors = {
        'water_vapor': 0x0000ff,
        'nitrogen_oxygen': 0xadd8e6,
        'hydrogen_helium': 0xffa500,
        'methane': 0x800080,
        'carbon_dioxide': 0xff0000,
        'thin': 0x808080,
        'unknown': 0xadd8e6
    };

  // Log the composition and the corresponding color
    console.log(`Atmosphere Composition: ${composition}`);
    console.log(`Atmosphere Color:`, colors[composition] ? colors[composition].toString(16) : 'unknown');

    return colors[composition] || colors['unknown']; // Fallback to 'unknown' if composition is not defined
}

function calculateAtmosphereScale(planetSize) {
  // Define the base scale factor
  const baseScale = 1.025; // 2.5% larger than the planet size as the base scale
  // Define a scale rate that will determine how much larger the atmosphere gets for larger planets
  const scaleRate = 0.01; // 1% additional scale per unit of planet size
  // Calculate the atmosphere scale factor
  const atmosphereScale = baseScale + (planetSize * scaleRate);
  // Cap the atmosphere scale to a maximum value to prevent excessively large atmospheres
  const maxScale = 1.1; // 10% larger than the planet size as the max scale
  return Math.min(atmosphereScale, maxScale);

}

function createAtmosphere(planetRadius, composition) {
  const atmosphereScaleFactor = calculateAtmosphereScale(planetRadius); // Use the new scale factor
  const atmosphereRadius = planetRadius * atmosphereScaleFactor;
  const geometry = new THREE.SphereGeometry(atmosphereRadius, 32, 32);
  const color = getAtmosphereColor(composition);
    
    // Log the atmosphere information
    console.log("Planet Radius:", planetRadius, "Atmosphere Radius:", atmosphereRadius);
    console.log("Atmosphere Color:", new THREE.Color(color).getStyle());

    const material = new THREE.ShaderMaterial({
        uniforms: {
            atmosphereColor: { value: new THREE.Color(color) },
            surfaceColor: { value: new THREE.Color(0xffffff) }, // Assuming the surface is white for simplicity
        },
        vertexShader: /* glsl */`
            varying vec3 vertexNormal;
            void main() {
                vertexNormal = normalize(normalMatrix * normal); // Normal in view space
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 atmosphereColor;
            uniform vec3 surfaceColor;
            varying vec3 vertexNormal;
            void main() {
                // Calculate intensity based on the angle to the view direction
                float viewAngle = dot(vertexNormal, vec3(0, 0, 1));
                float atmosphereEffect = smoothstep(0.0, 1.0, pow(1.0 - viewAngle, 2.0));
                float intensity = pow(0.6 - dot(vertexNormal, vec3(0, 0, 1)), 2.0);
  					gl_FragColor = vec4(atmosphereColor, intensity * 0.5); // reduce intensity for a subtler effect

                // Mix the surface color and the atmosphere color based on the calculated effect
                vec3 finalColor = mix(surfaceColor, atmosphereColor, atmosphereEffect);

                // Output the final color with the alpha representing the atmosphere effect
                gl_FragColor = vec4(finalColor, atmosphereEffect);
            }
        `,
        side: THREE.BackSide,
        blending: THREE.NormalBlending,
        transparent: true
    });

    return new THREE.Mesh(geometry, material);
}

function createSegmentedRings(planetRadius, planetType) {
    const ringSegmentsGroup = new THREE.Group(); // Group to hold all ring segments

    // Randomize the total number of ring segments between 5 and 20
    const numSegments = Math.floor(Math.random() * (20 - 5 + 1)) + 5;
    let currentOuterRadius = planetRadius * 1.2; // Initial outer radius of the first segment

    for (let i = 0; i < numSegments; i++) {
        // Generate random width for the segment, with a minimum width to ensure visibility
        const segmentWidth = Math.random() * 0.2 + 0.05;
        const innerRadius = currentOuterRadius;
        const outerRadius = innerRadius + segmentWidth;

        // Add a small variance to the distance between segments
        const distanceVariance = Math.random() * 0.05 + 0.01; // Adjust variance as desired
        currentOuterRadius += distanceVariance; // Apply variance to the next segment's starting point

        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64, 1);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: ringColor(planetType), // Dynamic color based on planet type
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5 + Math.random() * 0.5 // Random opacity for visual variety
        });

        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
        ringMesh.rotation.x = Math.PI / 2; // Adjust ring orientation to lie flat

        ringMesh.receiveShadow = true;
        ringMesh.castShadow = true;

        ringSegmentsGroup.add(ringMesh); // Add the segment to the group

        // Prepare the outer radius of the next segment by including the segment width
        currentOuterRadius = outerRadius + distanceVariance; // Include the distance variance for the next segment
    }

    ringSegmentsGroup.name = 'planetRings'; // Naming the group for easy access
    return ringSegmentsGroup; // Return the group containing all segments
}


// helpers

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function hexToRgb(hex) {
    // Assuming hex is a string like "0xffa07a"
    var r = (hex >> 16) & 255;
    var g = (hex >> 8) & 255;
    var b = hex & 255;
    return `rgb(${r}, ${g}, ${b})`;
}


// colors and textures

function createNoiseTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    const imageData = context.createImageData(size, size);

    for (let i = 0; i < imageData.data.length; i += 4) {
        // Generate random grayscale value
        const val = Math.floor(Math.random() * 255);
        imageData.data[i] = val;     // Red
        imageData.data[i + 1] = val; // Green
        imageData.data[i + 2] = val; // Blue
        imageData.data[i + 3] = 255; // Alpha
    }

    context.putImageData(imageData, 0, 0);

    return new THREE.CanvasTexture(canvas);
}

function getColorForPlanetType(planetType) {
    const colorMap = {
        'Terrestrial': 0x228b22, // Forest Green
        'Ice Giant': 0xadd8e6,   // Light Blue
        'Gas Giant': 0xffa07a,   // Light Salmon (for an orange/tan look)
        'Lava Planet': 0xff4500, // OrangeRed
        'Ocean World': 0x1e90ff, // DodgerBlue
        'Dwarf Planet': 0x808080, // Gray
        // Add more types as needed
    };

    return colorMap[planetType] || 0xffffff; // Default to white if type not found
}

function createRingTexture() {
    // Create a canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512; // Texture width
    canvas.height = 128; // Texture height, making it elongated for ring-like appearance

    const context = canvas.getContext('2d');

    // Generate noise
    for (let i = 0; i < canvas.width; i++) {
        for (let j = 0; j < canvas.height; j++) {
            const val = Math.floor(Math.random() * 255);
            context.fillStyle = `rgb(${val},${val},${val})`;
            context.fillRect(i, j, 1, 1);
        }
    }

    // Optionally, apply additional effects like gradients or patterns here

    // Use the canvas as a texture
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true; // Important to update the texture with canvas data

    return texture;
}

function ringColor(planetType) {
    // Default color
    let colorHex = 0xada9a1; // A generic ring color

    switch (planetType) {
        case 'Gas Giant':
            colorHex = 0xd2b48c; // Tan
            break;
        case 'Ice Giant':
            colorHex = 0xadd8e6; // Light Blue
            break;
        // Add more cases as needed
        default:
            console.log(`No specific ring color for planet type: ${planetType}. Using default.`);
    }

    return new THREE.Color(colorHex);
}