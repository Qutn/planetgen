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
let celestialObjects = [];


const AU_TO_SCENE_SCALE = 200.00;

let universeData = {
    parentStar: {
        type: null,
        size: null,
        age: null,
        mass: null,
        luminosity: null,
        habitableZone: {
            innerBoundary: null,
            outerBoundary: null
        }
    },
    solarSystem: [],
    selectedPlanet: null,
    // Additional properties and methods can be added as needed
};

function populateUniverseData() {
    // Assume generateOrbit() is an async function if it makes external calls or processes large data
    // If it's synchronous, you can remove the async/await keywords
    const orbitData = generateOrbit();

    universeData.parentStar = orbitData.parentStar;
    universeData.starData = orbitData.parentStar;
    universeData.solarSystem = orbitData.solarSystem.map(planet => ({
        type: planet.type,
        radius: planet.size, // Assuming 'size' should be mapped to 'radius'
        orbitRadius: planet.orbitRadius,
        atmosphere: planet.atmosphere,
        moons: planet.moons,
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize default star and planet data directly into universeData
    universeData.parentStar = {
        type: 'G',
        size: 1,
        luminosity: 1,
        habitableZone: { innerBoundary: 0.95, outerBoundary: 1.37 }
    };
    universeData.solarSystem = [
        { type: 'Terrestrial', radius: 1, orbitRadius: 1 }
    ];
    universeData.selectedPlanet = universeData.solarSystem[0]; // Assuming the first planet as the selected one

    setupThreeJS();
    setupStarGeneration();
    setupSolarSystemGeneration();

    let currentTargetIndex = 0; // Initialize the index for the currently targeted object

    document.getElementById('prevPlanet').addEventListener('click', () => {
        currentTargetIndex = Math.max(currentTargetIndex - 1, 0);
        snapCameraToCelestialObject(currentTargetIndex);
    });

    document.getElementById('snapToStar').addEventListener('click', () => {
        currentTargetIndex = 0; // Index of the star
        snapCameraToCelestialObject(currentTargetIndex);
    });

    document.getElementById('nextPlanet').addEventListener('click', () => {
        currentTargetIndex = Math.min(currentTargetIndex + 1, celestialObjects.length - 1);
        snapCameraToCelestialObject(currentTargetIndex);
    });

});


function setupThreeJS() {
    initializeThreeJSEnvironment('planetCanvas');
    setupOrbitControls();
    setupLighting(); // Now uses universeData

    startAnimationLoop();
}

// setup scripts

function initializeThreeJSEnvironment(canvasId) {
    canvas = document.getElementById(canvasId);
    scene = new THREE.Scene();

    const starFieldTexture = createStarFieldTexture(); // Assuming createStarFieldTexture is defined
    scene.background = starFieldTexture;

    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 10000);
    camera.position.set(0, 0, 20); // You might want to experiment with these values
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

function snapCameraToCelestialObject(index) {
    const target = celestialObjects[index];
    if (!target) return; // If the target doesn't exist, exit the function

    // Update the target of the orbit controls to the selected object
    controls.target.copy(target.position);

    // Position the camera away from the target by a fixed distance
    const distance = 20; // for example, the value can be adjusted as needed
    camera.position.copy(target.position).add(new THREE.Vector3(0, 0, distance));

    // Ensure the camera's up vector is correct (optional, if not the default)
    // camera.up.set(0, 1, 0);

    // Update the controls and render the scene
    controls.update();
    renderer.render(scene, camera);
}




function createPlanet(planetData, index) {
    // Access parent star's habitable zone directly from universeData
    const habitableZone = universeData.parentStar.habitableZone;

    // Planet geometry and material
    const planetGeometry = new THREE.SphereGeometry(planetData.radius, 32, 32);
    const planetMaterial = new THREE.MeshStandardMaterial({
        color: getColorForPlanetType(planetData.type)
    });
    const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);

    // Set planet position on a horizontal plane
    const phi = Math.PI / 2; // Horizontal plane
    const theta = Math.random() * Math.PI * 2; // Randomize starting position on orbit
    planetMesh.position.setFromSphericalCoords(
        planetData.orbitRadius * AU_TO_SCENE_SCALE, 
        phi, // Horizontal plane
        theta // Randomized azimuthal angle
    );

    planetMesh.name = `planet${index}`;

    // Determine atmosphere composition based on the planet's type and its orbit radius
    const atmosphereComposition = getPlanetAtmosphere(planetData.type, planetData.orbitRadius, habitableZone);
    const atmosphereMesh = createAtmosphere(planetData.radius, atmosphereComposition);
    atmosphereMesh.name = `atmosphere${index}`;
    planetMesh.add(atmosphereMesh); // Attach the atmosphere as a child of the planet

    // Add the planet (with its atmosphere) to the scene
    scene.add(planetMesh);
    celestialObjects[index + 1] = planetMesh; // We use index + 1 because index 0 is reserved for the star

}


function generatePlanets() {
    universeData.solarSystem.forEach((planetData, index) => {
        createPlanet(planetData, index);
    });
}


function setupLighting() {
    // Access star data directly from universeData
    const starData = universeData.parentStar;
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    // Ensure a minimum intensity for visibility
    const minIntensity = 0.5; // Adjust as needed for minimum visibility
    const effectiveIntensity = Math.max(intensity, minIntensity);

    if (starLight) {
        scene.remove(starLight); // Remove existing light if present
    }

    // Create a new directional light
    starLight = new THREE.PointLight(color, effectiveIntensity);
    starLight.position.set(0, 0, 0); // Position it to shine towards the scene

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

    // Now, addStarToScene should also utilize universeData instead of requiring starData as a parameter
    addStarToScene();
}


function setupOrbitControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.enableZoom = true;
    // Removed min/max polar angle to allow full vertical rotation
    // Removed min/max distance to allow any distance
}

function startAnimationLoop() {
    function animate() {
        requestAnimationFrame(animate);
            // Rotate the rings with variance
        controls.update();
        composer.render();
    }

    animate();
}

//end setup scripts

//generation functions



function updateStarLight() {
    // Access star data directly from universeData
    const starData = universeData.parentStar;
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    // Ensure a minimum intensity for visibility
    const minIntensity = 5; // Adjust as needed for minimum visibility
    const effectiveIntensity = Math.max(intensity, minIntensity);

    // Update the lights
    if (starLight) {
        starLight.color.set(new THREE.Color(color));
        starLight.intensity = effectiveIntensity;
    }

    // Update ambient light as well
    if (ambientLight) {
        ambientLight.color.set(new THREE.Color(color));
        ambientLight.intensity = intensity / 10;
    } else {
        ambientLight = new THREE.AmbientLight(new THREE.Color(color), intensity / 10);
        scene.add(ambientLight);
    }

    // Dynamic bloom effect adjustment based on star luminosity
    adjustBloomEffect(starData.luminosity);
}


function adjustBloomEffect() {
    // Access star luminosity directly from universeData
    const starLuminosity = universeData.parentStar.luminosity;

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


function adjustLightPosition() {
    // Default starting position for the light remains the same
    const defaultPosition = { x: 0, y: 0, z: 0 };

    // Reset starLight position to default before applying variance
    starLight.position.set(defaultPosition.x, defaultPosition.y, defaultPosition.z);

    // Variance can be adjusted or kept dynamic based on universeData properties if needed in the future
    const variance = 0.3;
    const randomX = (Math.random() - 0.5) * variance;
    const randomY = Math.random() * (variance / 2);

    // Adjust light position with variance
    starLight.position.x += randomX;
    starLight.position.y += Math.abs(randomY);

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

  function updateScene() {
    cleanUp(); // Clears the scene of existing planets and star meshes
    generatePlanets(); // Uses universeData to add new planet meshes to the scene
    updateStarLight(); // Updates the lighting based on the new star
    addStarToScene(); // Adds the new star mesh to the scene
}

function cleanUp() {
    scene.children = scene.children.filter(child => {
        if (child.name.startsWith('planet')) {
            if (child.geometry) child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
            return false; // Remove the planet from the scene.children array
        }
        return true; // Keep the item in the scene.children array
    });
    celestialObjects = [];

}
// star generation

function setupStarGeneration() {
    const generateStarButton = document.getElementById('generateStarButton');

    generateStarButton.addEventListener('click', () => {
        generateStar(); // This will update the universeData directly
        displayStarProperties(); // Now reads from universeData
        setupThreeJS(); // Should be refactored to use universeData
    });
}

function generateStar() {
    const parentStar = generateParentStar();
    const { size, mass } = generateStarSizeAndMass(parentStar.type, parentStar.age);
    const luminosity = generateStarLuminosity(parentStar.type, size);
    const habitableZone = calculateHabitableZone(luminosity);

    // Updating universeData directly
    universeData.starData = {
        type: parentStar.type,
        age: parentStar.age,
        size: size,
        mass: mass,
        luminosity: luminosity,
        habitableZone: habitableZone
    };

    console.log("Generated Star:", universeData.starData);
}


function addStarToScene() {
    // Access starData directly from universeData
    const starData = universeData.parentStar; // This line needs to be corrected

    const starGeometry = new THREE.SphereGeometry(starData.size, 32, 32);
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    const minEmissiveIntensity = 5.00; // Minimum visible emissive intensity
    let emissiveIntensity = Math.max(Math.log1p(intensity), minEmissiveIntensity);

    const starMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: emissiveIntensity
    });

    // Remove the existing visual star if present
    const existingStar = scene.getObjectByName('visualStar');
    if (existingStar) {
        scene.remove(existingStar);
    }

    // Create and add the new star mesh to the scene
    const starMesh = new THREE.Mesh(starGeometry, starMaterial);
    starMesh.name = 'visualStar'; // For easy identification and access
    starMesh.position.set(0, 0, 0); // Center the star in the scene

    scene.add(starMesh);
    celestialObjects[0] = starMesh;

}



function displayStarProperties() {
    const starPropertiesDiv = document.getElementById('starProperties');

    // Accessing the star data directly from universeData
    const { type, age, size, mass, luminosity, habitableZone } = universeData.starData;

    starPropertiesDiv.innerHTML = `
        <p>Type: ${type}</p>
        <p>Age: ${age.toFixed(2)} billion years</p>
        <p>Size: ${size.toFixed(2)} Solar radii</p>
        <p>Mass: ${mass.toFixed(2)} Solar masses</p>
        <p>Luminosity: ${luminosity.toFixed(2)} Solar luminosity</p>
        <p>Habitable Zone: ${habitableZone.innerBoundary.toFixed(2)} - ${habitableZone.outerBoundary.toFixed(2)} AU</p>
    `;
}


// solar system generation

function setupSolarSystemGeneration() {
    const generateSystemButton = document.getElementById('generateSystemButton');

    generateSystemButton.addEventListener('click', () => {
        populateUniverseData();
        displayStarProperties(universeData.starData);
        displaySolarSystemProperties(); // Now directly uses universeData without needing it passed as a parameter
        updateScene(); // A new function that encapsulates necessary updates

    });
}

function displaySolarSystemProperties() {
    const solarSystemPropertiesDiv = document.getElementById('solarSystemProperties');
    let htmlContent = '<h3>Solar System Planets</h3>';

    // Corrected to iterate over universeData.solarSystem instead of universeData.solarSystemData
    universeData.solarSystem.forEach((planet, index) => {
        const moonsCount = typeof planet.moons === 'number' ? planet.moons : 'N/A';
        const planetDetails = `
            <p>
                Planet ${index + 1}: 
                Type - ${planet.type}, 
                Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, 
                Size - ${planet.radius.toFixed(2)},
                Atmosphere - ${planet.atmosphere ? planet.atmosphere : 'N/A'}, 
                Moons - ${moonsCount}
            </p>
        `;
        htmlContent += planetDetails;

        // Optionally, you could also check if the planet is in the habitable zone and highlight it
        if (planet.orbitRadius >= universeData.parentStar.habitableZone.innerBoundary &&
            planet.orbitRadius <= universeData.parentStar.habitableZone.outerBoundary) {
            htmlContent += `<p><strong>This planet is in the habitable zone!</strong></p>`;
        }
    });

    solarSystemPropertiesDiv.innerHTML = htmlContent;
}



async function displayHabitablePlanetDetails(planetIndex) {
    const planet = universeData.solarSystemData[planetIndex];
    const star = universeData.starData;


    const habitablePlanetDiv = document.getElementById('habitablePlanetDetails');
    const atmosphereType = 'M';
    const geologicalActivity = 'Active';
    const moonCount = 2;
    const planetName = generatePlanetName(systemNumber, planetIndex, atmosphereType, geologicalActivity, moonCount);
    const planetDetails = `Name: ${planetName}<br>Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size.toFixed(2)}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
    const starSize = star.size;
    const starMass = star.mass;
    const orbitalRadius = planet.orbitRadius;
    const planetSize = planet.size;
    const geologicalData = generateGeologicalData(planet.size, orbitalRadius, starSize, starMass);
    const geologicalDetails = `Core Size: ${geologicalData.core.size}, Mantle Size: ${geologicalData.mantle.size}, Crust Size: ${geologicalData.crust.size}, Geological Activity: ${geologicalData.tectonics}`;
    let content = `<h3>Habitable Planet Details</h3><p>${planetDetails}</p><p>${geologicalDetails}</p>`;
    const compositionData = await determinePlanetaryComposition(planet.size, planet.orbitRadius, star.size, star.mass);
    const valuableElements = ['O', 'Si', 'Al', 'Fe', 'Na', 'Mg', 'K', 'Ti', 'H', 'Cu', 'Ag', 'Au', 'Mth']; // Iron, Copper, Silver, Gold, Mithril
    const sortedComposition = Object.entries(compositionData)
                                     .filter(([element]) => valuableElements.includes(element))
                                     .sort((a, b) => b[1] - a[1]); // Sort by abundance
    const earthVolume = (4/3) * Math.PI * Math.pow(6371, 3); // Earth's volume in km^3
    const planetVolume = (4/3) * Math.PI * Math.pow(planet.size * 6371, 3); // Planet's volume in km^3
    const scalingFactor = planetVolume / earthVolume; // Scaling factor based on volume
    const planetGravityInMs2 = (planet.size * 9.8).toFixed(2); // Gravity in m/s^2
    const planetGravityInG = (planetGravityInMs2 / 9.8).toFixed(2); // Convert to Earth's gravity
    const gravityDetails = `<p>Gravity: ${planetGravityInMs2} m/s<sup>2</sup> (${planetGravityInG} G)</p>`;
    content += gravityDetails;
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

    // Default temperature for stars not in the map
    let baseTemperature = temperatures[starType] || 5800;

    // Applying visual temperature variance for diversity
    let variedTemperature = applyVisualTemperatureVariance(baseTemperature);

    // Converting temperature to a visible color
    let color = temperatureToRGB(variedTemperature);

    // Base intensity to start with, ensuring no star is invisible
    const baseIntensity = 1;
    // Adjusting intensity based on the star's luminosity with a cap
    let intensity = Math.min(baseIntensity * starLuminosity, 5);

    return { color, intensity };
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


