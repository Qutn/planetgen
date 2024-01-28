import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { generatePlanetName } from './generators/names.js';
import { generateGeologicalData, determinePlanetaryComposition } from './generators/crust.js';
import { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone, getPlanetAtmosphere, determinePlanetType  } from './generators/orbit.js';

// Global variables for the three.js objects
let sphere, scene, camera, renderer;
let atmosphereMesh;

document.addEventListener('DOMContentLoaded', () => {
    const defaultStar = { type: 'G', size: 1, luminosity: 1, habitableZone: { innerBoundary: 0.95, outerBoundary: 1.37 } };
		console.log("DOMContentLoaded - Default Star Data:", defaultStar);
    const defaultPlanet = { type: 'Terrestrial', radius: 1, orbitRadius: 1 };
    setupThreeJS(defaultStar, defaultPlanet, defaultStar.habitableZone);
    setupStarGeneration();
    setupSolarSystemGeneration();
});

function setupThreeJS(star, planet, habitableZone) {
    // Default values for planet and star
    const defaultStar = { type: 'G', size: 1, luminosity: 1 };
    const defaultPlanet = { type: 'Terrestrial', radius: 1 };
    const planetData = planet || defaultPlanet;
    const starData = star || defaultStar;
 		console.log("setupThreeJS - Star Data:", starData);
    console.log("Planet Data in setupThreeJS:", planetData);

    // Ensure planetData.radius is defined
    if (typeof planetData.radius === 'undefined' || isNaN(planetData.radius)) {
        console.error("Planet radius is undefined or NaN, using default radius.");
        planetData.radius = defaultPlanet.radius;
    }

    const canvas = document.getElementById('planetCanvas');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const earthRadiusUnit = 1;

    // Create Planet
    const planetGeometry = new THREE.SphereGeometry(planetData.radius, 32, 32);
    const planetMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e3da }); // You can change the color
    sphere = new THREE.Mesh(planetGeometry, planetMaterial);
    scene.add(sphere);

    // Create Atmosphere
    const atmosphereComposition = getPlanetAtmosphere(planetData.type, planetData.orbitRadius, starData.habitableZone);
    atmosphereMesh = createAtmosphere(planetData.radius, atmosphereComposition);
    scene.add(atmosphereMesh);

    // Calculate star color and intensity

    const { color } = calculateStarColorAndIntensity(starData.type);
	const luminosityMultiplier = 1.5; // Adjust this value to fine-tune the light intensity
    let lightIntensity = starData.luminosity * luminosityMultiplier;

    // Set a minimum intensity threshold
    const minIntensity = 0.5; // Define a minimum intensity (adjust as needed)
    const maxIntensity = 3;   // Define a maximum intensity

    lightIntensity = Math.min(Math.max(lightIntensity, minIntensity), maxIntensity);

    const starLight = new THREE.PointLight(color, lightIntensity);
    starLight.position.set(10, 10, 10);
    scene.add(starLight);

    console.log("Calculated Star Color:", color, "Intensity:", lightIntensity);

    // Ambient Light
    const ambientLight = new THREE.AmbientLight(color, lightIntensity/10); // ambient light 
    scene.add(ambientLight);


    // Update planet and atmosphere
    updatePlanetAndAtmosphere(planetData.radius, atmosphereComposition);

    // Update lighting
    // updateLighting(starData.type);
	updateStarLight(starData.type)

//camera
    camera.position.z = 20; // Adjusted for better view

    window.addEventListener('resize', () => {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    });

    // OrbitControls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // optional, for smoother interaction
    controls.dampingFactor = 0.1;
    controls.enableZoom = true; // enable zooming

    window.addEventListener('resize', () => {
        // ... (existing resize event listener)
    });

    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // only required if controls.enableDamping or controls.autoRotate are set to true
        renderer.render(scene, camera);
    }
    console.log("ThreeJS setup complete"); // Confirm ThreeJS setup
    animate();
}

function updatePlanetAndAtmosphere(planetRadius, atmosphereComposition) {
    // Update planet geometry and material
    // ... [existing code to update planet geometry]

    // Update or create atmosphere
    if (atmosphereMesh) {
        scene.remove(atmosphereMesh);
    }
    atmosphereMesh = createAtmosphere(planetRadius, atmosphereComposition);
    scene.add(atmosphereMesh);
}



async function updateStarLight(starType) {

    console.log("updateStarLight - Explicit Star Type:", starType);
    const { color, intensity } = calculateStarColorAndIntensity(starType);

    // Find the existing star light in the scene and update it
    const starLight = scene.getObjectByName('starLight');
    if (starLight) {
        console.log("Updating existing star light. Old color:", starLight.color.getStyle());
        starLight.color.set(color);
        starLight.intensity = intensity;
        console.log("Updated star light. New color:", starLight.color.getStyle());
    } else {
        // If no star light is found, create a new one
        const newStarLight = new THREE.PointLight(color, intensity);
        newStarLight.name = 'starLight'; // Naming the light for easy identification
        newStarLight.position.set(10, 10, 10); // Positioning the light source
        scene.add(newStarLight);
    }


    // Update ambient light if needed
    const ambientLight = scene.getObjectByName('ambientLight');
    if (ambientLight) {
        ambientLight.color.set(color);
        ambientLight.intensity = intensity / 10;
    }
}

function updatePlanetSize(planetRadiusInEarthUnits, planetType, orbitRadius, starData) {
    // Remove the existing sphere from the scene
    console.log("Updating planet size to:", planetRadiusInEarthUnits); // Log the input size
    console.log("updatePlanetSize - Star Data before updateStarLight call:", starData);
    scene.remove(sphere);
    
    // Create a new geometry with the updated size
    const newGeometry = new THREE.SphereGeometry(planetRadiusInEarthUnits, 32, 32);
    // console.log("Updated sphere geometry"); // Log after updating geometry

    // Update the sphere with the new geometry
    sphere.geometry.dispose(); // Dispose of the old geometry
    sphere.geometry = newGeometry;
    
    // Re-add the sphere to the scene
    scene.add(sphere);

    if (atmosphereMesh) {
        scene.remove(atmosphereMesh); // Remove the existing atmosphere mesh

        const atmosphereScaleFactor = calculateAtmosphereScale(planetRadiusInEarthUnits);
        const newAtmosphereGeometry = new THREE.SphereGeometry(planetRadiusInEarthUnits * atmosphereScaleFactor, 32, 32);
        atmosphereMesh.geometry.dispose(); // Dispose of the old geometry
        atmosphereMesh.geometry = newAtmosphereGeometry;

        scene.add(atmosphereMesh); // Re-add the updated atmosphere to the scene
    }
    // console.log("Re-added sphere to scene"); // Log after adding sphere back to scene
    // Update atmosphere
    const atmosphereComposition = getPlanetAtmosphere(planetType, orbitRadius, starData.habitableZone);
    updatePlanetAndAtmosphere(planetRadiusInEarthUnits, atmosphereComposition);

    // Update lighting based on star type
    updateStarLight(starData.type);
        console.log("updatePlanetSize - Star Data AFTER updateStarLight call:", starData);

    // Adjust camera distance if the planet is significantly larger or smaller
    // camera.position.z = 20 * planetRadiusInEarthUnits;
    // console.log("Updated camera position"); // Log camera position update

}

// star generation

function setupStarGeneration() {
    const generateStarButton = document.getElementById('generateStarButton');
    const starPropertiesDiv = document.getElementById('starProperties');

    generateStarButton.addEventListener('click', () => {
        const star = generateStar();
        displayStarProperties(star, starPropertiesDiv);
    	setupThreeJS(null, Star, planet, orbitData.parentStar); // Call setupThreeJS with the generated star only

    });
}

function generateStar() {
    console.log("generateStar called");
	console.log("generateStar - Generated Star Data:", star);

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

    console.log("Displaying details for habitable planet. Size:", planet.size); // Log before calling updatePlanetSize
		console.log("displayHabitablePlanetDetails - Star Data:", star);
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
    // Return density of the element, placeholder values used here
const densities = {
    'O': 1.429, // Gaseous form
    'Si': 2330,
    'Al': 2700,
    'Fe': 7874,
    'Na': 968,
    'Mg': 1740,
    'K': 856,
    'Ti': 4506,
    'H': 0.08988, // Gaseous form
    'Cu': 8960,
    'Ag': 10490,
    'Au': 19300,
    'Mth': 12000 // Fictional element
};
    return densities[element] || 5500; // Default density
}


// Additional functions for procedural generation of planet details
// For example: generateGeology, generateMineralContent, generateAtmosphere, etc.

// Star color generation for lighting
function calculateStarColorAndIntensity(starType) {
    console.log("calculateStarColorAndIntensity - Received Star Type:", starType);
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
    const peakWavelength = 0.0029 / temperature; // In meters, using Wien's Law
    console.log("Star Type:", starType, "Temperature:", temperature);

    // Convert wavelength to RGB
    const color = wavelengthToRGB(peakWavelength * 1e9); // Convert to nanometers

    // Placeholder for intensity
    const intensity = 1; // Modify based on star size or luminosity

    return { color, intensity };
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


function adjustGamma(value) {
    if (value <= 0) {
        return 0;
    } else {
        return Math.pow(value, 0.8);
    }
}

// Assuming you have a function to get the atmosphere color based on composition
function getAtmosphereColor(composition) {
    const colors = {
        'water_vapor': 0x0000ff,
        'nitrogen_oxygen': 0xadd8e6,
        'hydrogen_helium': 0xffa500,
        'methane': 0x800080,
        'carbon_dioxide': 0xff0000,
        'thin': 0x808080,
        'unknown': 0xadd8e6 // This is an example, you can choose any color or handling for unknown compositions
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
