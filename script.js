import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { generatePlanetName } from './generators/names.js';
import { generateGeologicalData, determinePlanetaryComposition } from './generators/crust.js';
import { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone, getPlanetAtmosphere, determinePlanetType  } from './generators/orbit.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Global variables for the three.js objects
let sphere, scene, camera, renderer, controls, canvas;
let atmosphereMesh;
let starLight, ambientLight;
let rotationSpeed = 0.001; // This is a placeholder value
let ringRotationVariance = 0.0005; 
let selectedPlanet = { type: 'Terrestrial', radius: 1, orbitRadius: 1 };
let composer;
let bloomPass;
let orbitAngle = 0; // Initial angle
const orbitSpeed = 0.001; // Speed of the orbit, adjust as necessary

const AU_TO_SCENE_SCALE = 0.15;


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
    scene = new THREE.Scene();

    const starFieldTexture = createStarFieldTexture(); // Assuming createStarFieldTexture is defined
    scene.background = starFieldTexture;

    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
	camera.position.z = 20;
    camera.castShadow = true;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // or other shadow types as needed

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), // resolution

        1.0, // strength
        0.4, // radius
        0.85 // threshold
    );
    composer.addPass(bloomPass);
    
    const effectCopy = new ShaderPass(CopyShader);
    effectCopy.renderToScreen = true;
    composer.addPass(effectCopy);

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
    // Remove existing planet and its resources
    if (sphere) {
        scene.remove(sphere);
        disposeOfMesh(sphere); // A helper function to clean up geometry, material, and texture
        sphere = null;
    }
    
    // Remove existing rings (if any)
    const existingRings = scene.getObjectByName('planetRings');
    if (existingRings) {
        scene.remove(existingRings);
        existingRings.children.forEach(child => disposeOfMesh(child)); // Clean up each segment
    }

    // Proceed with planet creation
    const noiseTexture = createNoiseTexture();
    const cloudTexture = createCloudTexture();
    const planetColor = getColorForPlanetType(planetData.type);
    const planetColorRgb = hexToRgb(planetColor);

    const planetGeometry = new THREE.SphereGeometry(planetData.radius, 32, 32);
    const planetMaterial = new THREE.MeshStandardMaterial({
        map: noiseTexture,
        color: planetColor
    });

    sphere = new THREE.Mesh(planetGeometry, planetMaterial);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.name = 'planet';

    // Position the planet according to its orbit radius
    // Assuming the sun is at the scene's origin
    scene.add(sphere);
    //sphere.position.x = planetData.orbitRadius; // Place it on the x-axis at its orbit radius distance

    // Create segmented rings for Gas Giants and Ice Giants, if applicable
    let ringSegmentsGroup = null;
    let ringsOuterRadius = 0; // Will hold the outermost radius of the rings
    if (planetData.type === 'Gas Giant' || planetData.type === 'Ice Giant') {
        const ringsData = createSegmentedRings(planetData.radius, planetData.type);
        const ringSegmentsGroup = ringsData.group;
        const ringsOuterRadius = ringsData.outerRadius;

        ringSegmentsGroup.name = 'planetRings';
        sphere.add(ringSegmentsGroup);
    }

    // Optionally, draw orbit path
    //adjustCameraToPlanet(planetData); 
    console.log("Planet Position:", sphere.position);
    console.log("Camera Position:", camera.position);
    sphere.add(atmosphereMesh);
    return ringsOuterRadius; // Return the outermost radius of the rings
}

function drawOrbitPath(orbitRadius) {
    // Remove existing orbit path if it exists
    const existingOrbitMesh = scene.getObjectByName('orbitPath');
    if (existingOrbitMesh) {
        scene.remove(existingOrbitMesh);
    }

    // Assuming starLight represents the position of your star
    const starPosition = starLight.position; // Adjust if your star's position is defined differently

    // Create new orbit path geometry and material
    const orbitGeometry = new THREE.RingGeometry(orbitRadius - 0.01, orbitRadius + 0.01, 64);
    const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
    const orbitMesh = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbitMesh.rotation.x = Math.PI / 2;
    orbitMesh.position.set(starPosition.x, starPosition.y, starPosition.z);
    orbitMesh.name = 'orbitPath';
    scene.add(orbitMesh);
}



function createAtmosphereMesh(planetData, habitableZone) {
    const atmosphereComposition = getPlanetAtmosphere(planetData.type, planetData.orbitRadius, habitableZone);
    atmosphereMesh = createAtmosphere(planetData.radius, atmosphereComposition);
    sphere.add(atmosphereMesh);
}

function setupLighting(starData) {
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    // Ensure a minimum intensity for visibility
    const minIntensity = 0.5; // Adjust as needed for minimum visibility
    const effectiveIntensity = Math.max(intensity, minIntensity);

    if (starLight) {
        scene.remove(starLight); // Remove existing light if present
    }

    // Create a new directional light
    starLight = new THREE.DirectionalLight(color, effectiveIntensity);
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

    addStarToScene(starData); // Add this line after setting up the light

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
        // composer.render();
        	// console.log("Animation frame");
            // Rotate the planet
        if (sphere) {
            sphere.rotation.y += rotationSpeed;
            controls.target.set(sphere.position.x, sphere.position.y, sphere.position.z);

        }
        const planet = scene.getObjectByName('planet');
        if (planet) {
            orbitAngle += orbitSpeed; // Increment orbit angle
            planet.position.x = starLight.position.x + Math.cos(orbitAngle) * selectedPlanet.orbitRadius;
            planet.position.z = starLight.position.z + Math.sin(orbitAngle) * selectedPlanet.orbitRadius;
            planet.position.y = starLight.position.y + Math.sin(orbitAngle) * selectedPlanet.orbitRadius;

        }
            // Rotate the rings with variance
    const rings = scene.getObjectByName('planetRings');
    if (rings) rings.rotation.y += rotationSpeed + Math.random() * ringRotationVariance - ringRotationVariance / 2;

        controls.update();
        // renderer.render(scene, camera);
        composer.render();

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
    sphere.add(atmosphereMesh);
}

function updateStarLight(starData) {
    // console.log("updateStarLight - Star Type and Luminosity:", starData.type, starData.luminosity);
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);
    // Ensure a minimum intensity for visibility
    const minIntensity = 5; // Adjust as needed for minimum visibility
    const effectiveIntensity = Math.max(intensity, minIntensity);
    // Update the lights
    updateStarLightIntensityAndColor(color, effectiveIntensity);
    updateAmbientLightIntensityAndColor(color, intensity / 10);
    // Dynamic bloom effect adjustment
    adjustBloomEffect(starData.luminosity);
}

function adjustBloomEffect(starLuminosity) {
    // Adjust these values to fine-tune the appearance
    const luminosityFloor = 0.01; // Increase if too dim stars are too bright
    const luminosityCeiling = 4.0; // Decrease if very bright stars are too bright
    const minBloomStrength = 0.5; // Minimum bloom, increase if dim stars are too bright
    const maxBloomStrength = 2.0; // Maximum bloom, decrease if bright stars are too overpowering

    // Apply a more aggressive adjustment for stars with high luminosity
    let bloomStrength;
    if (starLuminosity <= luminosityCeiling) {
        // Normalize luminosity to the [0, 1] range based on defined floor and ceiling
        const normalizedLuminosity = (starLuminosity - luminosityFloor) / (luminosityCeiling - luminosityFloor);
        // Calculate bloom strength within the defined range
        bloomStrength = maxBloomStrength - normalizedLuminosity * (maxBloomStrength - minBloomStrength);
    } else {
        // For luminosities above the ceiling, reduce bloom strength more aggressively
        bloomStrength = maxBloomStrength / (Math.log(starLuminosity - luminosityCeiling + 2));
    }

    // Ensure bloom strength does not fall below the minimum
    bloomStrength = Math.max(bloomStrength, minBloomStrength);

    // Apply the calculated bloom strength to the bloomPass
    bloomPass.strength = bloomStrength;
    console.log("Star Luminosity:", starLuminosity, "Adjusted Bloom Strength:", bloomStrength);
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
    // Default starting position for the light
    const defaultPosition = { x: 0, y: 0, z: 1 };
    
    // Reset starLight position to default before applying variance
    starLight.position.set(defaultPosition.x, defaultPosition.y, defaultPosition.z);

    const variance = 0.3; // Adjust this value for more or less variance
    const randomX = (Math.random() - 0.5) * variance;
    // Ensure that randomY is always positive or zero to keep the light above the planet
    const randomY = Math.random() * (variance / 2);

    // Adjust light position with variance
    starLight.position.x += randomX;
    // Only add to the Y position to keep the light above the planet
    starLight.position.y += Math.abs(randomY); // Use Math.abs to ensure positivity

    // Optionally, you can also adjust the Z position if needed
    // This example keeps it fixed as per the default

    // Log new light position for debugging
    console.log("New Light Position:", starLight.position.x, starLight.position.y, starLight.position.z);
}

function adjustShadowCameraForRings(planetRadius, ringsOuterRadius) {
    const size = Math.max(planetRadius, ringsOuterRadius);
    
    starLight.shadow.camera.left = -size;
    starLight.shadow.camera.right = size;
    starLight.shadow.camera.top = size;
    starLight.shadow.camera.bottom = -size;
    starLight.shadow.camera.near = 0.1;
    starLight.shadow.camera.far = size * 3; // Make sure the far plane is far enough to include the rings
    starLight.shadow.camera.updateProjectionMatrix();
    
    // This log will help you debug the sizes and ensure they're appropriate
    // console.log(`Shadow Camera Frustum adjusted: Size = ${size}`);
  }


  //planet stuff

function updatePlanetSize(planetRadiusInEarthUnits, planetType, orbitRadius, starData) {
    // Prepare new planet data
    const newPlanetData = {
        radius: planetRadiusInEarthUnits,
        type: planetType,
        orbitRadius: orbitRadius
        // Add other necessary properties if needed
    };
   const orbitRadiusAU = orbitRadius; // This should be the actual AU value

    // Create a new planet with the updated size
    createPlanet(newPlanetData);

    // Update atmosphere
    const atmosphereComposition = getPlanetAtmosphere(planetType, orbitRadius, starData.habitableZone);
    updatePlanetAndAtmosphere(planetRadiusInEarthUnits, atmosphereComposition);

    // Update lighting based on star type
    updateStarLight(starData);
    const ringsOuterRadius = createPlanet(newPlanetData); // Assuming createPlanet now returns the outer radius of the rings

    adjustShadowCameraForRings(planetRadiusInEarthUnits, ringsOuterRadius);

    // Adjust camera distance if necessary
    // camera.position.z = 20 * planetRadiusInEarthUnits;
    addStarToScene(starData);
    drawOrbitPath(orbitRadius);
    console.log("orbitRadius (converted):", orbitRadius);
    console.log("orbitRadiusAU:", orbitRadiusAU);
}


// star generation

function setupStarGeneration(div, orbitData, selectedPlanetIndex = null) {
    const generateStarButton = document.getElementById('generateStarButton');
    const starPropertiesDiv = document.getElementById('starProperties');

    generateStarButton.addEventListener('click', () => {
        const orbitData = generateOrbit();
        const star = generateStar();
        displayStarProperties(star, starPropertiesDiv);
    	setupThreeJS(star, selectedPlanet, star.habitableZone); // Call setupThreeJS with the generated star only

    });
}

function generateStar(orbitData) {
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

function addStarToScene(starData) {
    const starGeometry = new THREE.SphereGeometry(starData.size, 32, 32); // Use starData.size to represent the visual size of the star
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    // Define a minimum emissive intensity to ensure the star is always visible
    const minEmissiveIntensity = 5.00; // Adjust as needed for visual preference
    let emissiveIntensity = Math.log1p(intensity); // Adjust emissive intensity based on luminosity
    emissiveIntensity = Math.max(emissiveIntensity, minEmissiveIntensity); // Ensure it doesn't go below the minimum

    const starMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color), // Use the calculated star color
        emissive: new THREE.Color(color),
        emissiveIntensity: emissiveIntensity
    });
    console.log("Star color:", color, "Emissive intensity:", emissiveIntensity);
        
    // If there's already a star object, remove it first
    const existingStar = scene.getObjectByName('visualStar');
    if (existingStar) {
        scene.remove(existingStar);
    }

    const starMesh = new THREE.Mesh(starGeometry, starMaterial);
    starMesh.name = 'visualStar';
    starMesh.position.copy(starLight.position).normalize().multiplyScalar(100); // Adjust distance as needed
    scene.add(starMesh);
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

// Star color generation for lighting and star object
function calculateStarColorAndIntensity(starType, starLuminosity) {
    const temperatures = {
        'O': 35000,
        'B': 20000,
        'A': 8750,
        'F': 6750,
        'G': 5750,
        'K': 4250,
        'M': 3250
    };

    let baseTemperature = temperatures[starType] || 5800;
    // Apply variance to the temperature for visual diversity
    let variedTemperature = applyVisualTemperatureVariance(baseTemperature);

    let color = temperatureToRGB(variedTemperature);

    const baseIntensity = 1;
    let intensity = baseIntensity * starLuminosity;
    const maxIntensity = 5;
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

// function to apply variance to the temperature
function applyVisualTemperatureVariance(baseTemperature) {
    const variancePercentage = 0.05; // e.g., 5% variance
    const varianceAmount = baseTemperature * variancePercentage;
    const variedTemperature = baseTemperature + (Math.random() * 2 - 1) * varianceAmount;
    return variedTemperature;
}

function temperatureToRGB(temperature) {
    // Define temperature range
    const minTemp = 3000; // Min temperature (K)
    const maxTemp = 40000; // Max temperature (K)

    // Normalize temperature to 0-1 range
    const t = (Math.min(Math.max(temperature, minTemp), maxTemp) - minTemp) / (maxTemp - minTemp);

    // Define color gradients
    const colors = {
        red: [255, 0, 0],
        yellow: [255, 255, 0],
        white: [255, 255, 255],
        lightBlue: [173, 216, 230],
        blue: [0, 0, 255]
    };

    // Interpolate between colors based on temperature
    let color;
    if (t < 0.25) {
        color = interpolateColors(colors.red, colors.yellow, t / 0.25);
    } else if (t < 0.5) {
        color = interpolateColors(colors.yellow, colors.white, (t - 0.25) / 0.25);
    } else if (t < 0.75) {
        color = interpolateColors(colors.white, colors.lightBlue, (t - 0.5) / 0.25);
    } else {
        color = interpolateColors(colors.lightBlue, colors.blue, (t - 0.75) / 0.25);
    }

    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function interpolateColors(color1, color2, factor) {
    const result = color1.slice();
    for (let i = 0; i < 3; i++) {
        result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    return result;
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
   // console.log(`Atmosphere Composition: ${composition}`);
   // console.log(`Atmosphere Color:`, colors[composition] ? colors[composition].toString(16) : 'unknown');

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
   // console.log("Planet Radius:", planetRadius, "Atmosphere Radius:", atmosphereRadius);
   // console.log("Atmosphere Color:", new THREE.Color(color).getStyle());

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
            opacity: 0.4 + Math.random() * 0.5 // Random opacity for visual variety
        });

        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
        ringMesh.rotation.x = Math.PI / 2; // Adjust ring orientation to lie flat

        ringMesh.receiveShadow = true;
        ringMesh.castShadow = true;

        ringSegmentsGroup.add(ringMesh); // Add the segment to the group

        // Prepare the outer radius of the next segment by including the segment width
        currentOuterRadius = outerRadius + distanceVariance; // Include the distance variance for the next segment
    }
    
    let outerRadius = planetRadius * 1.2;

    // Return the group and the final calculated outer radius
    return {
        group: ringSegmentsGroup, // The group containing all segments
        outerRadius: outerRadius  // The final outer radius of the rings
    };
}


// helpers



function hexToRgb(hex) {
    // Assuming hex is a string like "0xffa07a"
    var r = (hex >> 16) & 255;
    var g = (hex >> 8) & 255;
    var b = hex & 255;
    return `rgb(${r}, ${g}, ${b})`;
}

function disposeOfMesh(mesh) {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material.map) mesh.material.map.dispose();
    if (mesh.material) mesh.material.dispose();
}

// colors and textures

function createNoiseTexture(size = 1024) {
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



function createCloudTexture(size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    // Fill the background with a base color representing deep space
    context.fillStyle = 'rgb(5, 10, 20)';
    context.fillRect(0, 0, size, size);

    // Draw clouds in the central part of the texture to avoid seams
    const maxOpacity = 0.3; // Maximum cloud opacity
    const minOpacity = 0.1; // Minimum cloud opacity
    const cloudsCount = 500; // Number of clouds to draw
    const buffer = size * 0.25; // Buffer space to avoid drawing at the edges

    for (let i = 0; i < cloudsCount; i++) {
        const opacity = Math.random() * (maxOpacity - minOpacity) + minOpacity;
        context.fillStyle = `rgba(255, 255, 255, ${opacity})`;

        // Draw an ellipse for each cloud, ensuring it's within the central area
        const x = Math.random() * (size - 2 * buffer) + buffer;
        const y = Math.random() * (size - 2 * buffer) + buffer;
        const radiusX = Math.random() * size / 8;
        const radiusY = Math.random() * size / 16;

        context.beginPath();
        context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
        context.fill();
    }

    // Create a mirrored copy of the texture's central part to the edges
    const halfSize = size / 2;
    const quarterSize = size / 4;
    const centerImageData = context.getImageData(quarterSize, 0, halfSize, size);
    context.putImageData(centerImageData, 0, 0); // Mirror to the left
    context.putImageData(centerImageData, 3 * quarterSize, 0); // Mirror to the right

    // Use the canvas as a texture
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true; // Important to update the texture with canvas data
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);

    return texture;
}

function createStarFieldTexture(size = 2048, stars = 10000) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    // Fill the background with black
    context.fillStyle = 'black';
    context.fillRect(0, 0, size, size);

    // Draw stars
    for (let i = 0; i < stars; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 1.5; // Vary the size for a bit of variation
        const alpha = 0.5 + Math.random() * 0.5; // Vary the opacity

        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        context.fill();
    }

    return new THREE.CanvasTexture(canvas);
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
         //   console.log(`No specific ring color for planet type: ${planetType}. Using default.`);
    }

    return new THREE.Color(colorHex);
}


