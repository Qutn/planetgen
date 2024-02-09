import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { generateGeologicalData, determinePlanetaryComposition } from './generators/crust.js';
import { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone, getPlanetAtmosphere, determinePlanetType  } from './generators/orbit.js';
import { elementsData } from './generators/crust.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Global variables for the three.js objects
let sphere, scene, camera, renderer, controls, canvas;
let starLight, ambientLight;
let composer;
let bloomPass;
let celestialObjects = [];
let currentTargetIndex = 0; // Initialize the index for the currently targeted object globally
let desiredTargetPosition = new THREE.Vector3();
let followOffset = new THREE.Vector3();
let isZooming = false;
let zoomTargetPosition = new THREE.Vector3();
let zoomTargetLookAt = new THREE.Vector3();

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
    systemOuterEdge: null,
    // Additional properties and methods can be added as needed
};

function populateUniverseData() {
    const orbitData = generateOrbit();

    universeData.parentStar = orbitData.parentStar;
    universeData.starData = orbitData.parentStar;

    // Calculate systemOuterEdge before mapping over solarSystem
    // Ensure orbitData.solarSystem is sorted or has the last planet as the furthest one
    let systemOuterEdge = orbitData.solarSystem[orbitData.solarSystem.length - 1].orbitRadius;

    universeData.solarSystem = orbitData.solarSystem.map(planet => {
        const baseSpeed = 0.0001; // Base speed for scaling
        const scalingFactor = 200; // Adjust this factor to control the scaling effect
        const orbitalSpeed = baseSpeed / (planet.orbitRadius * scalingFactor);
        let rotationSpeed = getRotationSpeed(planet.orbitRadius, {
            innerBoundary: universeData.parentStar.habitableZone.innerBoundary, 
            outerBoundary: universeData.parentStar.habitableZone.outerBoundary
        }, AU_TO_SCENE_SCALE, systemOuterEdge); // Now correctly passing systemOuterEdge

        return {
            type: planet.type,
            radius: planet.size,
            orbitRadius: planet.orbitRadius,
            atmosphere: planet.atmosphere,
            moons: planet.moons,
            rotationSpeed,
            orbitalSpeed,
            isTidallyLocked: Math.random() < 0.1,
        };
    });

    // Now that systemOuterEdge is calculated outside the map, it can be assigned to universeData
    universeData.systemOuterEdge = systemOuterEdge;
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
        updateDesiredTargetPosition(currentTargetIndex);
        selectPlanet(currentTargetIndex); // Update the target planet for the camera
        if (currentTargetIndex > 0) {
            // Adjust the index by -1 because the first index (0) is reserved for the star
            displayTimeConversions(currentTargetIndex - 1);
        }
        displayHabitablePlanetDetails(currentTargetIndex - 1);
     //   displayElementalComposition(currentTargetIndex - 1); // Display composition for the newly selected planet

    });
    
    document.getElementById('snapToStar').addEventListener('click', () => {
        currentTargetIndex = 0; // Index of the star
        updateDesiredTargetPosition(currentTargetIndex);
        selectPlanet(currentTargetIndex);
        // Optionally, clear the display or skip displaying conversions for the star
        displayHabitablePlanetDetails(currentTargetIndex - 1);
     //   displayElementalComposition(currentTargetIndex - 1); // Display composition for the newly selected planet
    });
    
    document.getElementById('nextPlanet').addEventListener('click', () => {
        currentTargetIndex = Math.min(currentTargetIndex + 1, celestialObjects.length - 1);
        updateDesiredTargetPosition(currentTargetIndex);
        selectPlanet(currentTargetIndex); // Update the target planet for the camera
        if (currentTargetIndex > 0) {
            // Adjust the index by -1 because the first index (0) is reserved for the star
            displayTimeConversions(currentTargetIndex - 1);
            
        }
        displayHabitablePlanetDetails(currentTargetIndex - 1);
      //  displayElementalComposition(currentTargetIndex - 1); // Display composition for the newly selected planet
    });

    document.getElementById('zoomToPlanetButton').addEventListener('click', function() {
        if (currentTargetIndex >= 0 && currentTargetIndex < celestialObjects.length) {
            const targetPlanet = celestialObjects[currentTargetIndex];
            if (targetPlanet) {
                // Calculate the target zoom position
                const distance = targetPlanet.geometry.parameters.radius * 3;
                zoomTargetPosition.set(targetPlanet.position.x, targetPlanet.position.y, targetPlanet.position.z + distance);
                zoomTargetLookAt.copy(targetPlanet.position);
    
                // Start zooming
                isZooming = true;
            }
        }
    });
    

});

async function updateScene() {
    cleanUp(); // Clears the scene of existing planets and star meshes
    await generatePlanets(); // Await the asynchronous generation of planets and their compositions
    generateRings();
    updateStarLight();
    addStarToScene();
    generateMoons();
    generateSystemName();
    visualizeOrbits();
    generateAtmospheres();
    // Add any further steps that depend on planets being fully generated
}



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

    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 100000);
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


function updateDesiredTargetPosition(index) {
    const targetObject = celestialObjects[index];
    if (targetObject) {
        desiredTargetPosition.copy(targetObject.position);
        
    }
}


function createPlanet(planetData, index) {
    // Access parent star's habitable zone directly from universeData
    const habitableZone = universeData.parentStar.habitableZone;
    const planetGeometry = new THREE.SphereGeometry(planetData.radius, 32, 32);
    const noiseTexture = createNoiseTexture();
    const planetMaterial = new THREE.MeshStandardMaterial({
        map: noiseTexture, // Apply the noise texture as the map
        color: getColorForPlanetType(planetData.type), // You might blend this color with the texture
        // Other material properties can be adjusted as needed
    });

    const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
    const phi = Math.PI / 2; // Horizontal plane
    const theta = Math.random() * Math.PI * 2; // Randomize starting position on orbit
    planetMesh.position.setFromSphericalCoords(
        planetData.orbitRadius * AU_TO_SCENE_SCALE, 
        phi, // Horizontal plane
        theta // Randomized azimuthal angle
    );

    planetMesh.name = `planet${index}`;

    scene.add(planetMesh);
    celestialObjects[index + 1] = planetMesh; // We use index + 1 because index 0 is reserved for the star

   // if (planetData.type === 'Gas Giant' || planetData.type === 'Ice Giant') {
   //     const { group: ringGroup, outerRadius } = createSegmentedRings(planetData.radius, planetData.type);
   //     planetMesh.add(ringGroup); // Attach the rings to the planet mesh
   //     adjustShadowCameraForRings(planetData.radius, outerRadius);

   // }


}


function addRingsToPlanet(planetMesh, planetData, index) {
    if (planetData.type === 'Gas Giant' || planetData.type === 'Ice Giant') {
        const { group: ringGroup, outerRadius } = createSegmentedRings(planetData.radius, planetData.type);
        planetMesh.add(ringGroup);
        // adjustShadowCameraForRings(planetData.radius, outerRadius);
    }
}

async function generatePlanets() {
    for (let i = 0; i < universeData.solarSystem.length; i++) {
        const planetData = universeData.solarSystem[i];
        createPlanet(planetData, i);
        // Generate and store composition data for each planet
        const composition = await determinePlanetaryComposition(planetData.radius, planetData.orbitRadius, universeData.parentStar.size, universeData.parentStar.mass);
        planetData.composition = composition; // Store the composition data within the planet's data structure
    }
}

function generateAtmospheres() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh) {
            const atmosphereComposition = getPlanetAtmosphere(planetData.type, planetData.orbitRadius, universeData.parentStar.habitableZone);
            const atmosphereMesh = createAtmosphere(planetData.radius, atmosphereComposition);
            atmosphereMesh.name = `atmosphere${index}`;
            planetMesh.add(atmosphereMesh);
        }
    });
}

function generateRings() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh && (planetData.type === 'Gas Giant' || planetData.type === 'Ice Giant')) {
            addRingsToPlanet(planetMesh, planetData, index);
        }
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
    // controls = new OrbitControlsLocal(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.enableZoom = true;
    // Removed min/max polar angle to allow full vertical rotation
    // Removed min/max distance to allow any distance
     // Event listeners to detect manual control
}

function startAnimationLoop() {
    let followSpeed = 0.05; // Adjust for smoother or faster following

    function animate() {
        requestAnimationFrame(animate);
        animatePlanets();
        animateMoons();
    
        controls.target.lerp(desiredTargetPosition, followSpeed);
        updateDesiredTargetPosition(currentTargetIndex);
       // if (isFollowingObject && currentTargetIndex >= 0 && currentTargetIndex < universeData.solarSystem.length) {
       //     adjustCameraPosition(currentTargetIndex);
       // }
       if (isZooming) {
        // Move the camera towards the target position smoothly
        camera.position.lerp(zoomTargetPosition, 0.05); // Adjust the 0.05 value for speed

        // Smoothly adjust the camera to look at the target
        const lookAtPosition = new THREE.Vector3().lerpVectors(camera.position, zoomTargetLookAt, 0.05);
        camera.lookAt(lookAtPosition);

        // Optional: Stop zooming when close enough to the target position
        if (camera.position.distanceTo(zoomTargetPosition) < 0.1) {
            isZooming = false;
            camera.position.copy(zoomTargetPosition);
            camera.lookAt(zoomTargetLookAt);
        }
    }
    
        controls.update();
        composer.render();
    }


animate()
}
//end setup scripts

// animation functions
function animatePlanets() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh) {
            // Rotate the planet around its axis
            planetMesh.rotation.y += planetData.rotationSpeed;

            // Update the planet's orbital position
            const orbitRadius = planetData.orbitRadius * AU_TO_SCENE_SCALE;
            const theta = (Date.now() * planetData.orbitalSpeed) % (Math.PI * 2);
            planetMesh.position.x = Math.cos(theta) * orbitRadius;
            planetMesh.position.z = Math.sin(theta) * orbitRadius;
        }
    });
}

function animateMoons() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh && planetData.moons > 0) {
            planetMesh.children.forEach((moon) => {
                if (moon.name.startsWith('moon')) {
                    const orbitData = moon.userData.orbit;
                    const angle = (Date.now() * orbitData.speed * 16 + orbitData.phase) % (Math.PI * 2);

                    // Update position based on stored orbital parameters
                    moon.position.set(
                        Math.cos(angle) * orbitData.radius,
                        Math.sin(angle) * Math.sin(orbitData.inclination) * orbitData.radius,
                        Math.sin(angle) * Math.cos(orbitData.inclination) * orbitData.radius
                    );
                }
            });
        }
    });
}





function visualizeOrbits() {
    universeData.solarSystem.forEach((planetData, index) => {
        const orbitRadius = planetData.orbitRadius * AU_TO_SCENE_SCALE;
        // Create a geometry for the orbit. Since we're using a LineLoop, no need to remove the center vertex.
        const orbitGeometry = new THREE.RingGeometry(orbitRadius - 0.1, orbitRadius, 64);
        const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xDED38D, transparent: true, opacity: 0.05 });
        
        // Create a LineLoop with the geometry and material
        const orbitPath = new THREE.LineLoop(orbitGeometry, orbitMaterial);
        orbitPath.rotation.x = Math.PI / 2; // Orient the orbit horizontally
        orbitPath.name = `orbitPath${index}`; // Assign a name to the orbit path for cleanup identification
        scene.add(orbitPath);
    });
}

function displayElementalComposition(planetIndex) {
    // Check for valid planet index
    if (planetIndex < 0 || planetIndex >= universeData.solarSystem.length) return;

    const habitablePlanetDiv = document.getElementById('habitablePlanetDetails');
    const planet = universeData.solarSystem[planetIndex];

    // Header for Elemental Composition section
    let headerContent = `<div class="element-details-header">Elemental Composition for ${planet.name || `Planet ${planetIndex + 1}`}</div>`;

    // Start of the container that will have a max height and be scrollable
    let gridContent = '<div class="element-details-container">';

    // Generating each element detail with the specific style
    Object.entries(planet.composition).forEach(([element, mass]) => {
        const elementName = formatElementName(element); // Use the formatElementName function if needed
        gridContent += `<div class="element-detail">${elementName}: ${mass.toExponential(2)} kg</div>`;
    });

    gridContent += "</div>"; // Close the container

    // Combine header and grid content, then append to habitablePlanetDiv
    habitablePlanetDiv.innerHTML += headerContent + gridContent; // Use += to append under existing planet details

    // Ensure your CSS file is linked in your HTML and contains the provided styles
}





function selectPlanet(index) {
    currentTargetIndex = index;
    if (celestialObjects[currentTargetIndex]) {
        const planet = celestialObjects[currentTargetIndex];
        // Calculate and store the offset between the camera and the selected planet
        followOffset.copy(camera.position).sub(planet.position);
    }
}

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


function cleanUp() {
    scene.children = scene.children.filter(child => {
        if (child.name.startsWith('planet') || child.name.startsWith('orbitPath')) {
            if (child.geometry) child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
            return false; // Remove the planet and orbit path from the scene.children array
        }
        return true; // Keep the item in the scene.children array
    });
    celestialObjects = []; // Reset the celestial objects array
}
// star generation


function generateMoons() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh && planetData.moons > 0) {
            createMoonsForPlanet(planetMesh, planetData, index);
        }
    });
}

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

function formatAtmosphere(atmosphere) {
    // Convert identifier to title case for display
    return atmosphere.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function displaySolarSystemProperties() {
    const solarSystemPropertiesDiv = document.getElementById('solarSystemProperties');
    let htmlContent = '<h3 class="solar-system-title">Solar System Planets</h3>';

    universeData.solarSystem.forEach((planet, index) => {
        const moonsCount = typeof planet.moons === 'number' ? planet.moons : 'N/A';
        const atmosphereFormatted = planet.atmosphere ? formatAtmosphere(planet.atmosphere) : 'N/A';
        const rotationPeriodHours = rotationSpeedToEarthHours(planet.rotationSpeed).toFixed(2);
        const orbitalPeriodDays = orbitalSpeedToEarthDays(planet.orbitalSpeed, planet.orbitRadius).toFixed(2);
        const localDaysPerOrbitValue = localDaysPerOrbit(planet.rotationSpeed, planet.orbitalSpeed, planet.orbitRadius).toFixed(2);

        const planetDetails = `
            <div class="planet-details-container">
                <strong>Planet ${index + 1}</strong>
                <div class="planet-detail">Type: ${planet.type}</div>
                <div class="planet-detail">Orbit Radius: ${planet.orbitRadius.toFixed(2)} AU</div>
                <div class="planet-detail">Size: ${planet.radius.toFixed(2)}</div>
                <div class="planet-detail">Atmosphere: ${atmosphereFormatted}</div>
                <div class="planet-detail">Moons: ${moonsCount}</div>
                <div class="planet-detail">Sidereal Day: ${rotationPeriodHours} hours</div>
                <div class="planet-detail">Sidereal Year: ${localDaysPerOrbitValue} Sidereal Days (${orbitalPeriodDays} Earth Days)</div>
            </div>
            <hr class="planet-separator">`; // Changed to hr for a horizontal line
        htmlContent += planetDetails;

        if (planet.orbitRadius >= universeData.parentStar.habitableZone.innerBoundary &&
            planet.orbitRadius <= universeData.parentStar.habitableZone.outerBoundary) {
            htmlContent += `<div class="habitable-zone-notice"><strong>This planet is in the habitable zone!</strong></div>`;
        }
    });

    solarSystemPropertiesDiv.innerHTML = htmlContent;
}




async function displayHabitablePlanetDetails(index) {
    const habitablePlanetDiv = document.getElementById('habitablePlanetDetails');

    if (index < 0) {
        habitablePlanetDiv.innerHTML = "<h3>Star Details</h3><p>Details about the star will be displayed here.</p>";
        return;
    }

    if (index >= universeData.solarSystem.length || !universeData.solarSystem[index]) {
        console.error("Invalid planet index or planet data missing.");
        habitablePlanetDiv.innerHTML = "<h3>Invalid Planet Index</h3><p>The selected index does not correspond to a valid planet.</p>";
        return; 
    }

    const planet = universeData.solarSystem[index];
    const atmosphereFormatted = planet.atmosphere ? formatAtmosphere(planet.atmosphere) : 'N/A';
    const planetName = generatePlanetName(index + 1); // index + 1 because planet index is 0-based
    const rotationPeriodHours = rotationSpeedToEarthHours(planet.rotationSpeed).toFixed(2);
    const orbitalPeriodDays = orbitalSpeedToEarthDays(planet.orbitalSpeed, planet.orbitRadius).toFixed(2);
    const localDaysPerOrbitValue = localDaysPerOrbit(planet.rotationSpeed, planet.orbitalSpeed, planet.orbitRadius).toFixed(2);

    let elementDetails = `
    <div class="element-details-header">Elemental Composition of ${planetName}'s Crust</div>
    <div class="element-details-container">
    `;
    Object.entries(planet.composition).forEach(([elementSymbol, mass]) => {
        // Find the element name using the symbol
        const elementObj = elementsData.elements.find(element => element.symbol === elementSymbol);
        const elementName = elementObj ? elementObj.name : elementSymbol; // Fallback to symbol if name not found
        elementDetails += `<div class="element-detail">${elementName}: ${mass.toExponential(2)} kg</div>`;
    });

    elementDetails += `</div>`;

    const planetDetailsContent = `
        <div class="planet-details-header">Planet Details</div>
        <div class="planet-details-grid">
            <span>Name: ${planetName}</span>
            <span>Type: ${planet.type}</span>
            <span>Orbit Radius: ${planet.orbitRadius.toFixed(2)} AU</span>
            <span>Size: ${planet.radius.toFixed(2)}</span>
            <span>Atmosphere: ${atmosphereFormatted}</span>
            <span>Moons: ${planet.moons || 'N/A'}</span>
            <span>Day: ${rotationPeriodHours} hours</span>
            <span>Year: ${localDaysPerOrbitValue} days (${orbitalPeriodDays} Earth days)</span>
        </div>
    `;

    const graphContainer = `
    <div class="graph-container">
        <canvas id="elementAbundanceGraph"></canvas>
    </div>
`;

    habitablePlanetDiv.innerHTML = `${planetDetailsContent}${elementDetails}${graphContainer}`;
    console.log(document.getElementById('elementAbundanceGraph'));
    plotElementProbabilityGraph(planet.composition);

}

function plotElementProbabilityGraph(planetComposition) {
    // Prepare data for plotting
    const elementSymbols = Object.keys(planetComposition);
    const masses = elementSymbols.map(symbol => planetComposition[symbol]);

    // Prepare labels (using element names if possible, fallback to symbol)
    const labels = elementSymbols.map(symbol => {
        const elementObj = elementsData.elements.find(element => element.symbol === symbol);
        return elementObj ? elementObj.name : symbol; // Use element name if available
    });

    // Plot the graph
    const ctx = document.getElementById('elementAbundanceGraph').getContext('2d');
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels.map(label => label.toUpperCase()), // Force x-axis labels to uppercase
        datasets: [{
            label: 'ELEMENTAL COMPOSITION (KG)', // Force dataset label to uppercase
            data: masses,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: '#cc77ff',
            borderWidth: 1
        }]
    },
    options: {
        spanGaps: false,
        cubicInterpolationMode: "default",
        scales: {
            y: {
                beginAtZero: false,
                type: 'logarithmic',
                position: 'left',
                ticks: {
                    color: '#cc77ff',
                    callback: function(value) {
                        // Return the value formatted as exponential
                        return Number(value).toExponential();
                    }
                }
            },
            x: {
                ticks: {
                    color: '#cc77ff',
                    font: {
                        family: 'Antonio', // Apply the font to x-axis labels
                        size: 12 // Adjust as needed
                    }
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: '#cc77ff',
                    font: {
                        family: 'Antonio',
                        size: 14
                    },
                    textTransform: 'uppercase' // Although not a native Chart.js option, this demonstrates intent. CSS may be required for full effect.
                }
            }
        }
    }
});

}



function generateSystemName() {
    // All possible characters in the naming scheme
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let name = 'P'; // Start with 'P' 

    // Generate the next 3 alphanumeric characters
    for (let i = 0; i < 3; i++) {
        name += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Append a hyphen before the final three digits
    name += '-';

    // Generate the final three alphanumeric characters
    for (let i = 0; i < 3; i++) {
        name += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Store the system name
    universeData.systemName = name;
}

function generatePlanetName(planetIndex) {
    // Use the stored system name and append the planet index
    return `${universeData.systemName}/${planetIndex}`;
}


// Utility function to format element names, assuming they are in snake_case
function formatElementName(element) {
    return element.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

function calculateAtmosphereScale(planetRadius) {
  // Define the base scale factor
  const baseScale = 1.025; // 2.5% larger than the planet size as the base scale
  // Define a scale rate that will determine how much larger the atmosphere gets for larger planets
  const scaleRate = 0.01; // 1% additional scale per unit of planet size
  // Calculate the atmosphere scale factor
  const atmosphereScale = baseScale + (planetRadius * scaleRate);
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

function createMoonsForPlanet(planetMesh, planetData, planetIndex) {
    const moons = [];
    const baseDistanceFromPlanet = planetData.radius * 2.0; // Base distance from the planet's surface

    for (let i = 0; i < planetData.moons; i++) {
        const moonScaleFactor = Math.max(planetData.radius / 10, 0.05);
        const moonGeometry = new THREE.SphereGeometry(0.1 * moonScaleFactor, 32, 32);
        const moonMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);

        moonMesh.name = `moon${planetIndex}_${i}`;

        const distanceIncrement = i * (planetData.radius * 0.2);
        const distanceFromPlanetAdjusted = baseDistanceFromPlanet + distanceIncrement;
        
        // Randomize the orbital inclination and phase of the moon
        const orbitalInclination = (Math.random() - 0.5) * Math.PI; // Inclination angle (radians)
        const orbitalPhase = Math.random() * Math.PI * 2; // Phase angle (radians)

        // Calculate initial position with inclination and phase
        moonMesh.position.set(
            Math.cos(orbitalPhase) * distanceFromPlanetAdjusted,
            Math.sin(orbitalPhase) * Math.sin(orbitalInclination) * distanceFromPlanetAdjusted, // Apply inclination
            Math.sin(orbitalPhase) * Math.cos(orbitalInclination) * distanceFromPlanetAdjusted
        );

        // Store orbital parameters for animation
        moonMesh.userData.orbit = {
            radius: distanceFromPlanetAdjusted,
            inclination: orbitalInclination,
            phase: orbitalPhase,
            speed: 0.000005 // This can also be randomized for each moon
        };

        planetMesh.add(moonMesh);
        moons.push(moonMesh);
    }
    return moons;
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




// Constants for scaling factors - these can be adjusted to "look right"
const ROTATION_SPEED_SCALE = 0.001; // Scale factor for rotation speed to Earth hours
const ORBITAL_SPEED_SCALE = 0.00001; // Scale factor for orbital speed to Earth days
const LOCAL_DAY_SCALE = 1.00; // Scale factor for calculating local days per orbit

// Convert rotation speed to equivalent Earth hours for display
function rotationSpeedToEarthHours(rotationSpeed) {
    const rotationPeriodHours = (2 * Math.PI / Math.abs(rotationSpeed)) * ROTATION_SPEED_SCALE;
    return rotationPeriodHours;
}

// Convert orbital speed to equivalent Earth days for the orbit period display
function orbitalSpeedToEarthDays(orbitalSpeed, orbitRadiusAU) {
    const orbitalPeriodDays = (2 * Math.PI * orbitRadiusAU / orbitalSpeed) * ORBITAL_SPEED_SCALE;
    return orbitalPeriodDays;
}

// Calculate the number of local days per orbit for display
function localDaysPerOrbit(rotationSpeed, orbitalSpeed, orbitRadiusAU) {
    const rotationPeriodHours = rotationSpeedToEarthHours(rotationSpeed);
    const orbitalPeriodDays = orbitalSpeedToEarthDays(orbitalSpeed, orbitRadiusAU);
    // Convert rotation period in hours to days for the ratio calculation
    const rotationPeriodDays = rotationPeriodHours / 24;
    // Calculate local days per orbit without any additional scaling
    const localDays = orbitalPeriodDays / rotationPeriodDays;
    return localDays;
}

// Corrected function for displaying time conversions
function displayTimeConversions(selectedPlanetIndex) {
    const planet = universeData.solarSystem[selectedPlanetIndex];

    const rotationPeriodHours = rotationSpeedToEarthHours(planet.rotationSpeed);
    const orbitalPeriodDays = orbitalSpeedToEarthDays(planet.orbitalSpeed, planet.orbitRadius);
    const localDays = localDaysPerOrbit(planet.rotationSpeed, planet.orbitalSpeed, planet.orbitRadius);

    console.log(`Rotation Period for ${planet.type}: ${rotationPeriodHours.toFixed(2)} Earth hours`);
    console.log(`Orbital Period for ${planet.type}: ${orbitalPeriodDays.toFixed(2)} Earth days`);
    console.log(`Local Days per Orbit for ${planet.type}: ${localDays.toFixed(2)}`);
}


function getRotationSpeed(orbitRadius, habitableZone, AU_TO_SCENE_SCALE, systemOuterEdge) {
    // Convert orbitRadius to AU for accurate comparison
    let orbitRadiusAU = orbitRadius / AU_TO_SCENE_SCALE;
    
    // Determine system size and calculate the distance as a percentage of system size
    let systemSizeAU = systemOuterEdge / AU_TO_SCENE_SCALE;
    let distancePercentage = orbitRadiusAU / systemSizeAU;

    // Dynamic base speed adjustment based on system size or habitable zone width
    let habitableZoneWidth = habitableZone.outerBoundary - habitableZone.innerBoundary;
    let scalingFactor = 1 + (habitableZoneWidth / 2); // Example scaling based on habitable zone width
    
    // Apply a random factor for additional variability
    let randomFactor = Math.random() * scalingFactor;
    
    // Adjust base rotation speed dynamically
    let baseRotationSpeed = 0.0001 + (distancePercentage * randomFactor * 0.0001);

    // Apply a further modifier based on distance to the center of the habitable zone
    let habCenterAU = (habitableZone.innerBoundary + habitableZone.outerBoundary) / 2;
    let distanceFromCenter = Math.abs(orbitRadiusAU - habCenterAU) / habCenterAU;
    let speedModifier = Math.max(0.5, 1 - distanceFromCenter); // Closer to the center = slower rotation

    // Final rotation speed calculation
    let finalRotationSpeed = baseRotationSpeed * speedModifier;
    finalRotationSpeed = Math.max(0.00001, Math.min(finalRotationSpeed, 0.0005)); // Ensure within realistic bounds

    // Optionally randomize rotation direction
    finalRotationSpeed *= Math.random() < 0.5 ? 1 : -1;

    return finalRotationSpeed;
}


