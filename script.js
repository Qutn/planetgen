import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { generateGeologicalData, determinePlanetaryComposition } from './generators/crust.js';
import { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone, determinePlanetType  } from './generators/orbit.js';
import { getPlanetAtmosphere, getAtmosphereDetailsForDisplay, calculateSurfaceTemperature } from './generators/atmosphere.js';

import { elementsData } from './generators/crust.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { musgraveFragmentShader, musgraveVertexShader } from './generators/texture.js';
import { createNoise2D, createNoise3D, createNoise4D }  from './node_modules/simplex-noise/dist/esm/simplex-noise.js';

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
let bloomStrength = 0.3;
let bloomRadius = 0.9;
let bloomThreshold = 0.75;
const AU_TO_SCENE_SCALE = 21840.00;

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

// Function to export universeData as a base64 string
function exportUniverseData() {
    const dataString = JSON.stringify(universeData);
    const base64Data = btoa(dataString); // Encode to base64
    console.log('Exported Data:', base64Data);
    // Example: Copy to clipboard or display in a user interface
    navigator.clipboard.writeText(base64Data).then(() => {
        alert('System data exported and copied to clipboard.');
    });
}

// Function to import universeData from a base64 string
function importUniverseData(base64Data) {
    try {
        const dataString = atob(base64Data); // Decode from base64
        const dataObject = JSON.parse(dataString);
        // Validate or sanitize dataObject as necessary
        universeData = dataObject; // Update universeData
        console.log('Imported Data:', universeData);
        // Trigger any necessary updates or rerendering here
        updateScene(); // Assuming updateScene() will use the updated universeData
    } catch (error) {
        console.error('Failed to import data:', error);
        alert('Invalid data format. Please ensure you are using a valid exported string.');
    }
}

function populateUniverseData() {
    const orbitData = generateOrbit();

    universeData.parentStar = orbitData.parentStar;
    universeData.starData = orbitData.parentStar;

    // Calculate systemOuterEdge before mapping over solarSystem
    // Ensure orbitData.solarSystem is sorted or has the last planet as the furthest one
    let systemOuterEdge = orbitData.solarSystem[orbitData.solarSystem.length - 1].orbitRadius;

    universeData.solarSystem = orbitData.solarSystem.map(planet => {
        const baseSpeed = 0.00001; // Base speed for scaling
        const scalingFactor = 21840; // Adjust this factor to control the scaling effect
        const orbitalSpeed = baseSpeed / (planet.orbitRadius * scalingFactor);
        let rotationSpeed = getRotationSpeed(planet.orbitRadius, { innerBoundary: universeData.parentStar.habitableZone.innerBoundary, outerBoundary: universeData.parentStar.habitableZone.outerBoundary }, AU_TO_SCENE_SCALE, systemOuterEdge);
        const geologicalData = generateGeologicalData(planet.radius, planet.orbitRadius, universeData.parentStar.size, universeData.parentStar.mass);
        const atmosphereComposition = getPlanetAtmosphere(planet.type, planet.orbitRadius, universeData.parentStar.habitableZone);
        const surfaceTemperature = calculateSurfaceTemperature(universeData.parentStar.luminosity, calculateStarTemperature(universeData.parentStar.type), planet.orbitRadius, planet.size, atmosphereComposition // Ensure this matches expected input in calculateSurfaceTemperature
        );
        return {
            type: planet.type,
            radius: planet.size,
            orbitRadius: planet.orbitRadius,
            atmosphere: planet.atmosphere,
            moons: planet.moons,
            axialTilt: planet.axialTilt,
            rotationSpeed,
            orbitalSpeed,
            isTidallyLocked: Math.random() < 0.1,
            geologicalData,
            atmosphereComposition,
            surfaceTemperature,
        };
    });

    // Now that systemOuterEdge is calculated outside the map, it can be assigned to universeData
    universeData.systemOuterEdge = systemOuterEdge;
}

function filterVitalDataForExport(universeData) {
    const filteredData = {
        parentStar: {
            type: universeData.parentStar.type,
            size: universeData.parentStar.size,
            mass: universeData.parentStar.mass,
            luminosity: universeData.parentStar.luminosity
        },
        solarSystem: universeData.solarSystem.map(planet => ({
            type: planet.type,
            orbitRadius: planet.orbitRadius,
            size: planet.radius, // Assuming 'radius' is the size property
            axialTilt: planet.axialTilt,
            moons: planet.moons,
            isTidallyLocked: planet.isTidallyLocked
        }))
    };
    return filteredData;
}

function encodeDataToBase64(dataObject) {
    const jsonString = JSON.stringify(dataObject);
    return btoa(jsonString); // Use btoa for base64 encoding
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
     const currentPlanet = universeData.solarSystem[currentTargetIndex];
     if (currentPlanet) {
        console.log('Geological Data for current planet:', currentPlanet.geologicalData);
    }

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
      const currentPlanet = universeData.solarSystem[currentTargetIndex];
      if (currentPlanet) {
        // console.log('Geological Data for current planet:', currentPlanet.geologicalData);
     }

    });

    document.getElementById('zoomToPlanetButton').addEventListener('click', function() {
        if (currentTargetIndex >= 0 && currentTargetIndex < celestialObjects.length) {
            const targetPlanet = celestialObjects[currentTargetIndex];
            if (targetPlanet) {
                // Calculate the target zoom position
                const distance = targetPlanet.geometry.parameters.radius * 3;
                zoomTargetPosition.set(targetPlanet.position.x, targetPlanet.position.y, targetPlanet.position.z + distance);
                zoomTargetLookAt.copy(targetPlanet.position);
                updateDesiredTargetPosition(currentTargetIndex);

                // Start zooming
                isZooming = true;
            }
        }
    });

    document.getElementById('exportSystem').addEventListener('click', function() {
        // Call the filterVitalDataForExport function to get the filtered data
        const filteredData = filterVitalDataForExport(universeData);
        const dataStr = JSON.stringify(filteredData);
        const base64Str = btoa(unescape(encodeURIComponent(dataStr)));
        document.getElementById('base64Output').value = base64Str;
    });

    document.getElementById('importSystem').addEventListener('click', function() {
        try {
            const inputStr = decodeURIComponent(escape(window.atob(document.getElementById('base64Input').value)));
            universeData = JSON.parse(inputStr);
            // Here you would add any necessary calls to update the UI based on the imported data
            alert('System data imported successfully!');
            // After importing, you might need to regenerate any dependent properties or UI elements
            // For example, if you have functions to update the visuals based on universeData
            updateScene();
        } catch (e) {
            alert('Failed to import data. Please ensure the base64 string is correct.');
        }
    });
});

async function updateScene() {
    cleanUp(); // Clears the scene of existing planets and star meshes
    await generatePlanets(); // Await the asynchronous generation of planets and their compositions
    generateRings();
    updateStarLight();
    addStarToScene();
    // updateShaderLighting();
    generateMoons();
    generateSystemName();
    visualizeOrbits();
    generateAtmospheres();
    zoomToStar();
}


function zoomToStar(starSize){
currentTargetIndex = 0; // Index of the star
updateDesiredTargetPosition(currentTargetIndex);
selectPlanet(currentTargetIndex);
// Optionally, clear the display or skip displaying conversions for the star
displayHabitablePlanetDetails(currentTargetIndex - 1);
const cameraDistance = starSize * 2.5;
camera.position.set(0, 0, 1250); // You might want to experiment with these values

}

function setupThreeJS() {
    initializeThreeJSEnvironment('planetCanvas');
    setupOrbitControls();
    const axesHelper = new THREE.AxesHelper(5); // The parameter defines the size of the axes in units.
    scene.add(axesHelper);
    setupLighting(); // Now uses universeData
    startAnimationLoop();
}

function initializeThreeJSEnvironment(canvasId) {
    canvas = document.getElementById(canvasId);
    scene = new THREE.Scene();

    const starFieldTexture = createStarFieldTexture(); // Assuming createStarFieldTexture is defined
    scene.background = starFieldTexture;

    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.01, 1000000);
    camera.position.set(0, 0, 500); // You might want to experiment with these values
    camera.castShadow = true;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // or other shadow types as needed

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), // resolution

        bloomStrength, // strength
        bloomRadius, // radius
        bloomThreshold, // threshold
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
    // const habitableZone = universeData.parentStar.habitableZone;
    const planetGeometry = new THREE.SphereGeometry(planetData.radius, 32, 32);
    const starSize = universeData.parentStar.size;
    const starMass = universeData.parentStar.mass;
    const geologicalData = generateGeologicalData(planetData.radius, planetData.orbitRadius, starSize, starMass);

    const noiseTexture = createNoiseTexture();
    // let musgraveTexture = generateFBMNoiseTexture(1024, 1024, 0.01, 0.5, 8, 2.0);
    // let planetTexture;
    let normalMap = null;
    let roughnessAmount = 0;
    // let cloudTexture = new THREE.TextureLoader().load('./texture/water_clouds_d.png');
    // let isTransparent = false;
    // let cloudOpacity = 0.0;
    let planetEmissiveTexture = null;
    let emissiveColor = 0x000000;
    let emissiveIntensityValue = 0;
    let normalMapIntensity =  new THREE.Vector2(0.0, 0.0);
    let material;

    if (planetData.type === 'Terrestrial') {
        material = new THREE.MeshStandardMaterial({
            map: new THREE.TextureLoader().load('./texture/terr_d.png'),
            roughness: 0.6,
           // color: getColorForPlanetType(planetData.type),
    
        })
        planetGeometry.rotateZ(Math.PI / 2); //rotate so texture applies properly

      }


else if (planetData.type === 'Lava Planet') {
    material = new THREE.MeshStandardMaterial({
        map: new THREE.TextureLoader().load('./texture/lava_d.png'),
        emissiveMap: new THREE.TextureLoader().load('./texture/lava_e.png'),
        emissive: 0xffffff,
        emissiveIntensity: 1.25,
        roughness: 0.8,
        normalMap: new THREE.TextureLoader().load('./texture/lava_n.png'),


    })
    planetGeometry.rotateZ(Math.PI / 2); //rotate so texture applies properly

}
else if (planetData.type === 'Gas Giant' || planetData.type === 'Ice Giant') {
    material = new THREE.MeshStandardMaterial({
        map: new THREE.TextureLoader().load('./texture/giant_d_2.png'),
        roughness: 0.95,
        normalMap: new THREE.TextureLoader().load('./texture/giant_n.png'),


    })
    planetGeometry.rotateZ(Math.PI / 2); //rotate so texture applies properly

}
else if (planetData.type === 'Ocean World') {
    material = new THREE.MeshStandardMaterial({
        map: new THREE.TextureLoader().load('./texture/ocean_d.png'),
        roughness: 0.6,
        color: getColorForPlanetType(planetData.type),

    })
    planetGeometry.rotateZ(Math.PI / 2); //rotate so texture applies properly

}
else {
    // For other planet types, use the standard material
    material = new THREE.MeshStandardMaterial({
        map: noiseTexture,
        color: getColorForPlanetType(planetData.type),
        normalMap: normalMap,
        normalScale: normalMapIntensity,
        roughness: roughnessAmount,
        emissiveMap: planetEmissiveTexture,
        emissive: emissiveColor,
        emissiveIntensity: emissiveIntensityValue,
    });
    planetGeometry.rotateZ(Math.PI / 2); //rotate so texture applies properly

}

    const planetMesh = new THREE.Mesh(planetGeometry, material);
    const phi = Math.PI / 2; // Horizontal plane
    const theta = Math.random() * Math.PI * 2; // Randomize starting position on orbit
    planetMesh.position.setFromSphericalCoords(
        planetData.orbitRadius * AU_TO_SCENE_SCALE, 
        phi, // Horizontal plane
        theta // Randomized azimuthal angle
    );

    const axialTiltRadians = THREE.Math.degToRad(planetData.axialTilt);
    planetMesh.rotation.x = axialTiltRadians; // Tilting the planet around its X-axis
    planetMesh.name = `planet${index}`;

 if (planetData.type === 'Ocean World' || planetData.type === 'Terrestrial') {
    const cloudGeometry = new THREE.SphereGeometry(planetData.radius * 1.01, 32, 32);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load('./texture/water_clouds_d.png'), // Make sure this is the correct path
        alphaMap: new THREE.TextureLoader().load('./texture/water_clouds_d.png'),
        transparent: true,
        depthWrite: false,
        opacity: 0.6,
    });
    cloudMaterial.blending = THREE.AdditiveBlending; // Example alternative blending mode
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudGeometry.rotateZ(Math.PI / 2);
    cloudGeometry.rotateX = axialTiltRadians; // Tilting the planet around its X-axis
    planetData.cloudMesh = cloudMesh;
    planetMesh.add(cloudMesh); // Assuming planetMesh is your planet

}
    scene.add(planetMesh);
    celestialObjects[index + 1] = planetMesh; // We use index + 1 because index 0 is reserved for the star
    planetData.geologicalData = geologicalData;

}

function addRingsToPlanet(planetMesh, planetData, index) {
    if (planetData.type === 'Gas Giant' || planetData.type === 'Ice Giant') {
        const { group: ringGroup, outerRadius } = createSegmentedRings(planetData.radius, planetData.type, planetData.axialTilt);
        const axialTiltRadians = THREE.Math.degToRad(planetData.axialTilt);
        ringGroup.rotation.y = axialTiltRadians;

        planetMesh.add(ringGroup);
        // adjustShadowCameraForRings(planetData.radius, outerRadius);
        planetData.ringAxialTilt = planetData.axialTilt;

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

function updateSurfaceTemperatures() {
    // Loop through each planet in the solar system
    universeData.solarSystem.forEach((planet) => {
        // Ensure all necessary data is present
        if (planet.orbitRadius && planet.atmosphere && universeData.parentStar.luminosity) {
            // Calculate the surface temperature for the current planet
            const surfaceTemperature = calculateSurfaceTemperature(
                universeData.parentStar.luminosity,
                planet.orbitRadius,
                planet.atmosphere,
                universeData.parentStar.temperature,
                planet.size,
            );

            // Update the planet object with the calculated surface temperature
            planet.surfaceTemperature = surfaceTemperature;
        }
    });
}

function setupLighting() {
    // Access star data directly from universeData
    const starData = universeData.parentStar;
    let { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    // Ensure a minimum intensity for visibility
    const minIntensity = 0.5; // Adjust as needed for minimum visibility
    const effectiveIntensity = Math.max(intensity, minIntensity);
    color = new THREE.Color(color);
    color = desaturateColor(color.getStyle(), 0.6); // Example: 0.5 as the desaturation factor

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
        ambientLight.intensity = intensity / 10;
    } else {
        ambientLight = new THREE.AmbientLight(color, intensity / 10);
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
        animateClouds();

        controls.target.lerp(desiredTargetPosition, followSpeed);
        updateDesiredTargetPosition(currentTargetIndex);

       if (isZooming) {
        camera.position.lerp(zoomTargetPosition, 0.05); // Adjust the 0.05 value for speed
        const lookAtPosition = new THREE.Vector3().lerpVectors(camera.position, zoomTargetLookAt, 0.05);
        camera.lookAt(lookAtPosition);

        if (camera.position.distanceTo(zoomTargetPosition) < 0.1) {
            isZooming = false;
            camera.position.copy(zoomTargetPosition);
            camera.lookAt(zoomTargetLookAt);
            }
        }
       // updateBloomEffect(camera, currentTargetIndex);
 //       const planetMesh = scene.getObjectByName(`planet${index}`);
   //     if (planetMesh && planetMesh.material && planetMesh.material.isShaderMaterial) {
        // Update the uniform with the current world position of the planet
   //         planetMesh.material.uniforms.objectWorldPosition.value.copy(planetMesh.position);
  //      }
        controls.update();
        composer.render();
    }


animate()
}

function animatePlanets() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh) {
            // Rotate the planet around its axis
            planetMesh.rotation.y += planetData.rotationSpeed * 20; // Adjust the speed as necessary

            // Update the planet's orbital position
            const orbitRadius = planetData.orbitRadius * AU_TO_SCENE_SCALE;
            const theta = (Date.now() * planetData.orbitalSpeed) % (Math.PI * 2);
            planetMesh.position.x = Math.cos(theta) * orbitRadius;
            planetMesh.position.z = Math.sin(theta) * orbitRadius;

            // If the planet mesh has a ShaderMaterial and a uniform for world position, update it
            if (planetMesh.material && planetMesh.material.isShaderMaterial && planetMesh.material.uniforms.objectWorldPosition && planetMesh.material.uniforms.rotationMatrix) {
                planetMesh.material.uniforms.objectWorldPosition.value.copy(planetMesh.position);
                planetMesh.material.uniforms.rotationMatrix.value = new THREE.Matrix4().makeRotationFromEuler(planetMesh.rotation);
                planetMesh.material.uniforms.lightColor.value.copy(starLight.color);
                planetMesh.material.uniforms.lightPosition.value.copy(starLight.position);
                planetMesh.material.uniforms.lightIntensity.value = starLight.intensity;

            }

            // Update the cloud mesh position if it has one
            if (planetData.cloudMesh && planetData.cloudMesh.material && planetData.cloudMesh.material.isShaderMaterial && planetData.cloudMesh.material.uniforms.objectWorldPosition) {
                planetData.cloudMesh.material.uniforms.objectWorldPosition.value.copy(planetMesh.position);
            }
        }
    });
}

function animateClouds() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh && planetData.cloudMesh) {
            // Assuming each planetData has a cloudMesh reference
            const cloudMesh = planetData.cloudMesh;
            // Adjust the rotation speed as needed
            cloudMesh.rotation.y += -0.002; // Example speed for cloud rotation
        }
    });
}

function toggleCloudVisibility(planetIndex, isVisible) {
    const planetData = universeData.solarSystem[planetIndex];
    if (planetData && planetData.cloudMesh) {
        planetData.cloudMesh.visible = isVisible;
    }
}

function animateMoons() {
    universeData.solarSystem.forEach((planetData, index) => {
        const planetMesh = scene.getObjectByName(`planet${index}`);
        if (planetMesh && planetData.moons > 0) {
            planetMesh.children.forEach((moon) => {
                if (moon.name.startsWith('moon')) {
                    const orbitData = moon.userData.orbit;
                    const angle = (Date.now() * orbitData.speed * 4 + orbitData.phase) % (Math.PI * 2);

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

function updateBloomEffect(camera, currentTargetIndex) {
    // Example calculation - you'll need to replace this with actual logic
    const target = currentTargetIndex;
    const distance = camera.position.distanceTo(currentTargetIndex);
    
    // Placeholder logic for adjusting bloom based on distance or target type
    let newBloomStrength, newBloomRadius, newBloomThreshold;
    if (distance < 50) { // Assuming distance units are consistent with your scene
        newBloomStrength = 0.0; // Stronger bloom for closer targets
        newBloomRadius = 0.5;
        newBloomThreshold = 0.85;
    } else {
        newBloomStrength = 0.5; // Weaker bloom for distant targets
        newBloomRadius = 0.1;
        newBloomThreshold = 0.95;
    }

    // Apply the new bloom parameters
    bloomStrength = newBloomStrength;
    bloomRadius = newBloomRadius;
    bloomThreshold = newBloomThreshold;

    // You might need to directly update your bloom effect object here,
    // depending on how it's implemented.
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

function updateStarLight() {
    // Access star data directly from universeData
    const starData = universeData.parentStar;
    let { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);
    color = new THREE.Color(color);
    color = desaturateColor(color.getStyle(), 0.45); // Example: 0.5 as the desaturation factor

    // Ensure a minimum intensity for visibility
    const minIntensity = 5; // Adjust as needed for minimum visibility
    const effectiveIntensity = Math.max(intensity, minIntensity);

 
    // Update the lights
    if (starLight) {
        starLight.color.set(new THREE.Color(color));
        starLight.intensity = effectiveIntensity / 2;
    }

    // Update ambient light as well
    if (ambientLight) {
        ambientLight.color.set(new THREE.Color(color));
        ambientLight.intensity = intensity / 1000;
    } else {
        ambientLight = new THREE.AmbientLight(new THREE.Color(color), intensity / 1000);
        scene.add(ambientLight);
    }

    // Dynamic bloom effect adjustment based on star luminosity
    adjustBloomEffect(starData.luminosity);
}

function updateShaderLighting() {
    // Assume material is your shader material and starLight is your THREE.PointLight
   // planetMesh.material.uniforms.lightColor.value.copy(starLight.color);
   // planetMesh.material.uniforms.lightPosition.value.copy(starLight.position);
   // planetMesh.material.uniforms.lightIntensity.value = starLight.intensity;
}

function adjustBloomEffect() {
    // Access star luminosity directly from universeData
    const starLuminosity = universeData.parentStar.luminosity;

    // Adjust these values to fine-tune the appearance
    const luminosityFloor = 0.75; // Increase if too dim stars are too bright
    const luminosityCeiling = 1.00; // Decrease if very bright stars are too bright
    const minBloomStrength = 0.75; // Minimum bloom, increase if dim stars are too bright
    const maxBloomStrength = 1.00; // Maximum bloom, decrease if bright stars are too overpowering

    // Apply a more aggressive adjustment for stars with high luminosity
    let bloomStrength;
    if (starLuminosity <= luminosityCeiling) {
        // Normalize luminosity to the [0, 1] range based on defined floor and ceiling
        const normalizedLuminosity = (starLuminosity - luminosityFloor) / (luminosityCeiling - luminosityFloor);
        // Calculate bloom strength within the defined range
        bloomStrength = maxBloomStrength - normalizedLuminosity * (maxBloomStrength - minBloomStrength);
    } else {
        // For luminosities above the ceiling, reduce bloom strength more aggressively
        bloomStrength = maxBloomStrength / (Math.log(starLuminosity - luminosityCeiling + 5));
    }

    // Ensure bloom strength does not fall below the minimum
    bloomStrength = Math.max(bloomStrength, minBloomStrength);

    // Apply the calculated bloom strength to the bloomPass
    bloomPass.strength = bloomStrength;
  //  console.log("Star Luminosity:", starLuminosity, "Adjusted Bloom Strength:", bloomStrength);
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

  //  console.log("New Light Position:", starLight.position.x, starLight.position.y, starLight.position.z);
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
    // size of 1 for planet = 1 earth radius, scale star and system based on scaling factor
    const starData = universeData.parentStar;
    const solarRadiiInEarthRadii = 109.2; // how big 1 solar radii is compared to 1 earth radius
    const starRadii = starData.size * solarRadiiInEarthRadii;
    const starGeometry = new THREE.SphereGeometry(starRadii, 32, 32);
    const { color, intensity } = calculateStarColorAndIntensity(starData.type, starData.luminosity);

    const minEmissiveIntensity = 4.00; // Minimum visible emissive intensity
    let emissiveIntensity = Math.max(Math.log1p(intensity), minEmissiveIntensity);
    const starTexture = new THREE.TextureLoader().load('./texture/star_d.png'); // Load diffuse texture

    const starMaterial = new THREE.MeshStandardMaterial({
        map: starTexture,
        color: new THREE.Color(color),
        emissiveMap: new THREE.TextureLoader().load('./texture/star_e.png'),
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
    const isInHabitableZone = planet.orbitRadius >= universeData.parentStar.habitableZone.innerBoundary && planet.orbitRadius <= universeData.parentStar.habitableZone.outerBoundary;
    const habitableZoneStatus = isInHabitableZone ? "Yes" : "No";
    const isAtmosphereHospitable = planet.atmosphere === 'nitrogen_type_III';
    const surfaceTemperature = planet.surfaceTemperature; // Assuming this is already in Celsius
    const isTemperatureHospitable = surfaceTemperature >= -80 && surfaceTemperature <= 80;
    const isHospitable = isInHabitableZone && isAtmosphereHospitable && isTemperatureHospitable;
    const hospitableStatus = isHospitable ? "Yes" : "No";


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
            <span>Moons: ${planet.moons || 'N/A'}</span>
            <span>Axial Tilt: ${planet.axialTilt.toFixed(2)}°</span>

            <span>Atmosphere: ${atmosphereFormatted}</span>
            <span>Surface Temperature: ${planet.surfaceTemperature.toFixed(2)}°C</span>
            <span>Day: ${rotationPeriodHours} hours</span>
            <span>Year: ${localDaysPerOrbitValue} days (${orbitalPeriodDays} Earth days)</span>
            <span>In Habitable Zone: ${habitableZoneStatus}</span>
            <span>Hospitable: ${hospitableStatus}</span>

        </div>
    `;

    const graphContainer = `
    <div class="graph-container">
        <canvas id="elementAbundanceGraph"></canvas>
    </div>
`;


let leftColumnContent = `
<div class="left-column">
    ${planetDetailsContent}
    ${elementDetails}
    <div class="graph-container">
        <canvas id="elementAbundanceGraph"></canvas>
    </div>
</div>`;


       //  console.log('Geological Data for current planet:', planet.geologicalData);
const geologicalData = planet.geologicalData;
const interiorCompositionHtml = `
<div class="interior-composition-container">
    <ul class="interior-composition-list">
        <li>Core: ${geologicalData.core.size.toLocaleString()} M thick, Volume: ${geologicalData.core.volume.toLocaleString()} m&sup3;</li>
        <li>Mantle: ${geologicalData.mantle.thickness.toLocaleString()} M thick, Volume: ${geologicalData.mantle.volume.toLocaleString()} m&sup3;</li>
        <li>Crust: ${geologicalData.crust.thickness.toLocaleString()} M thick, Volume: ${geologicalData.crust.volume.toLocaleString()} m&sup3;</li>
    </ul>
</div>
`;


let atmosphereCompositionContent = '<div class="composition-container">';
const atmosphereDetails = getAtmosphereDetailsForDisplay(planet.atmosphere).split(', ');
atmosphereDetails.forEach(detail => {
    atmosphereCompositionContent += `<div class="composition-item">${detail}</div>`;
});
atmosphereCompositionContent += '</div>';

let rightColumnContent = `
<div class="right-column">
    <h3 class="section-header">Atmosphere Composition</h3>
    ${atmosphereCompositionContent}
    <h3 class="section-header">Interior Composition</h3>
    ${interiorCompositionHtml}
</div>`;

// Set the innerHTML of habitablePlanetDiv to include both columns
habitablePlanetDiv.innerHTML = `${leftColumnContent}${rightColumnContent}`;
 
  //  habitablePlanetDiv.innerHTML = `${planetDetailsContent}${elementDetails}${graphContainer}`;
   // console.log(document.getElementById('elementAbundanceGraph'));
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
        tension: 0.2,
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

function formatElementName(element) {
    return element.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

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
    let intensity = Math.min(baseIntensity * starLuminosity, 300);

    return { color, intensity };
}

function calculateStarTemperature(starType) {
    // Simplified example based on stellar classification
    switch(starType) {
        case 'M': return 3250; // Example values
        case 'K': return 4250;
        case 'G': return 5750; // Sun-like
        case 'F': return 6750;
        case 'A': return 8750;
        case 'B': return 20000;
        case 'O': return 35000;
        default: return 5500; // Default to Sun-like temperature
    }
}

function desaturateColor(color, factor) {
    const white = new THREE.Color(0xffffff);
    const originalColor = new THREE.Color(color);
    const desaturatedColor = originalColor.lerp(white, factor);
    return desaturatedColor.getStyle(); // Returns the CSS color string
}

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

function getAtmosphereColor(composition) {
    const baseColors = {
        'trace': '#E0E0E0',
        'carbon_dioxide_type_I': '#E57373',
        'carbon_dioxide_type_II': '#B71C1C',
        'hydrogen_helium_type_I': '#FFF59D',
        'hydrogen_helium_type_II': '#FFCC80',
        'hydrogen_helium_type_III': '#FFE0B2',
        'ice_type_I': '#B2EBF2',
        'ice_type_II': '#64B5F6',
        'nitrogen_type_I': '#81D4FA',
        'nitrogen_type_II': '#42A5F5',
        'nitrogen_type_III': '#4FC3F7',
        'carbon_type_I': '#CE93D8',
        'ammonia_type_I': '#AED581',
        'unknown': '#add8e6' // Default color for unknown composition
    };

    // Function to apply subtle random variation to the color
    function applyRandomVariation(color) {
        // Convert hex color to RGB
        let rgb = parseInt(color.substring(1), 16);

        // Apply variation to each color component
        let r = (rgb >> 16) & 0xFF;
        let g = (rgb >> 8) & 0xFF;
        let b = rgb & 0xFF;

        // Randomly adjust each component within a range of -5 to 5
        r = Math.min(255, Math.max(0, r + Math.floor(Math.random() * 11) - 5));
        g = Math.min(255, Math.max(0, g + Math.floor(Math.random() * 11) - 5));
        b = Math.min(255, Math.max(0, b + Math.floor(Math.random() * 11) - 5));

        // Convert back to hex color string
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Check if the composition exists in the baseColors, apply random variation if so
    if (baseColors[composition]) {
        return applyRandomVariation(baseColors[composition]);
    } else {
        // Return the default 'unknown' color with random variation
        return applyRandomVariation(baseColors['unknown']);
    }
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

function createAtmosphere(planetRadius, composition, planetType) {
  const atmosphereScaleFactor = calculateAtmosphereScale(planetRadius); // Use the new scale factor
  const atmosphereRadius = planetRadius * atmosphereScaleFactor;
  const geometry = new THREE.SphereGeometry(atmosphereRadius, 32, 32);
  const color = getAtmosphereColor(composition);
  const planetColor = getColorForPlanetType(planetType);
    
    // Log the atmosphere information
   // console.log("Planet Radius:", planetRadius, "Atmosphere Radius:", atmosphereRadius);
   // console.log("Atmosphere Color:", new THREE.Color(color).getStyle());

    const material = new THREE.ShaderMaterial({
        uniforms: {
            atmosphereColor: { value: new THREE.Color(color) },
            surfaceColor: { value: new THREE.Color(planetColor) }, // Assuming the surface is white for simplicity
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

function createSegmentedRings(planetRadius, planetType, planetData) {
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
        const axialTiltRadians = THREE.Math.degToRad(planetData.axialTilt);
       // ringMesh.rotation.x = axialTiltRadians;

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
    const baseDistanceFromPlanet = planetData.radius * 10.0; // Base distance from the planet's surface

    for (let i = 0; i < planetData.moons; i++) {
        const moonScaleFactor = Math.max(planetData.radius / 5, 0.05);
        const moonRandomSize = Math.random();
        const moonGeometry = new THREE.SphereGeometry(moonRandomSize * moonScaleFactor, 32, 32);
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
        'Dwarf Planet': 0x404040, // Gray
        // Add more types as needed
    };

    return colorMap[planetType] || 0xffffff; // Default to white if type not found
}

function generateNoiseTexture(width, height, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
  
    // Initialize the 2D noise function
    const noise2D = createNoise2D();
  
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        // Generate noise value for each pixel
        // The scale factor controls the frequency of the noise
        const nx = x / scale, ny = y / scale;
        const value = noise2D(nx, ny) * 0.5 + 0.5; // Normalize to 0-1
  
        // Convert the noise value to a grayscale color
        const color = Math.floor(value * 255);
        const index = (y * width + x) * 4;
        imageData.data[index] = color;     // Red
        imageData.data[index + 1] = color; // Green
        imageData.data[index + 2] = color; // Blue
        imageData.data[index + 3] = 255;   // Alpha
      }
    }
  
    // Update canvas with the generated noise
    ctx.putImageData(imageData, 0, 0);
  
    // Create a THREE.Texture from the canvas
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true; // Mark the texture for update
    return texture;
}

function generateTextures(width, height, scale, detail, dimension, lacunarity, amplitudeScale) {
    const canvasColor = document.createElement('canvas');
    const canvasRoughness = document.createElement('canvas');
    canvasColor.width = canvasRoughness.width = width;
    canvasColor.height = canvasRoughness.height = height;
    const ctxColor = canvasColor.getContext('2d');
    const ctxRoughness = canvasRoughness.getContext('2d');
    const imageDataColor = ctxColor.createImageData(width, height);
    const imageDataRoughness = ctxRoughness.createImageData(width, height);
  
    const noise2D = createNoise2D();
  
    function fbm(nx, ny) {
      let value = 0;
      let amplitude = amplitudeScale;
      let frequency = scale;
      for (let i = 0; i < dimension; i++) {
        value += amplitude * noise2D(nx * frequency, ny * frequency);
        frequency *= lacunarity;
        amplitude *= detail;
      }
      return value;
    }
    
    function edgeFactor(u) {
        // This function calculates a factor that reduces towards the edges of the map
        const edgeWidth = 0.05; // The width of the edge where the blending starts
        const leftEdge = smoothstep(0.0, edgeWidth, u);
        const rightEdge = smoothstep(1.0, 1.0 - edgeWidth, u);
        return Math.min(leftEdge, rightEdge);
      }

      const roughnessMin = 0.3; // Lower limit of roughness (upper limit of shininess)
      const roughnessMax = 0.7; // Upper limit of roughness (lower limit of shininess)

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        // Normalizing the coordinates to the size of the texture to avoid stretching
        const nx = x / width, ny = y / height;
        // Generate fBm noise value for each pixel
        const value = fbm(nx, ny) * 0.5 + 0.5; // Normalize to 0-1

        const u = x / width; // Normalized u coordinate
        const blend = edgeFactor(u);
        const blendedValue = value * blend; // Apply blending factor



        // Convert the noise value to a grayscale color
        const color = mapToColor(blendedValue); // Use the blended value to get the color
        let index = (y * width + x) * 4;
        imageDataColor.data[index] = color.r * 255;     // Red
        imageDataColor.data[index + 1] = color.g * 255; // Green
        imageDataColor.data[index + 2] = color.b * 255; // Blue
        imageDataColor.data[index + 3] = 255;   // Alpha

        // Calculate roughness map value (inverted and clamped)
        let roughnessValue = 1.0 - blendedValue; // Use blended value for roughness
        roughnessValue = roughnessValue * (roughnessMax - roughnessMin) + roughnessMin;
        roughnessValue = Math.max(0, Math.min(1, roughnessValue)); // Ensure it's between 0 and 1
        imageDataRoughness.data[index] = roughnessValue * 255;
        imageDataRoughness.data[index + 1] = roughnessValue * 255;
        imageDataRoughness.data[index + 2] = roughnessValue * 255;
        imageDataRoughness.data[index + 3] = 255;
      }
    }
  
    // Update canvas with the generated noise
    ctxColor.putImageData(imageDataColor, 0, 0);
    ctxRoughness.putImageData(imageDataRoughness, 0, 0);

    // Create a THREE.Texture from the canvas
    const textureColor = new THREE.Texture(canvasColor);
    textureColor.needsUpdate = true;
    const textureRoughness = new THREE.Texture(canvasRoughness);
    textureRoughness.needsUpdate = true;

    return {
        colorMap: textureColor,
        roughnessMap: textureRoughness
      };

  }

  function mapToColor(value) {
    // Define color stops for terrain features, e.g., deep water, shallow water, land, mountains
    value = Math.max(0, Math.min(value, 1));

    const deepWater = new THREE.Color(0x2a4857);
    const shallowWater = new THREE.Color(0x4f7272);
    const sand = new THREE.Color(0x988b65);
    const grass = new THREE.Color(0x456c18);
    const rock = new THREE.Color(0x61524e);
    const snow = new THREE.Color(0xf2d3d0);
  
    // Interpolate between colors based on the noise value
    if (value < 0.2) return deepWater;
    else if (value < 0.4) return shallowWater.lerp(deepWater, (value - 0.2) * 5);
    else if (value < 0.5) return sand.lerp(shallowWater, (value - 0.4) * 10);
    else if (value < 0.7) return grass.lerp(sand, (value - 0.5) * 5);
    else if (value < 0.9) return rock.lerp(grass, (value - 0.7) * 5);
    else return snow.lerp(rock, (value - 0.9) * 10);
  }

function smoothstep(edge0, edge1, x) {
    // Scale, and clamp x to 0..1 range
    x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    // Evaluate polynomial
    return x * x * (3 - 2 * x);
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
const ORBITAL_SPEED_SCALE = 0.000000048; // Scale factor for orbital speed to Earth days
const LOCAL_DAY_SCALE = 1.00; // Scale factor for calculating local days per orbit

function rotationSpeedToEarthHours(rotationSpeed) {
    const rotationPeriodHours = (2 * Math.PI / Math.abs(rotationSpeed)) * ROTATION_SPEED_SCALE;
    return rotationPeriodHours;
}

function orbitalSpeedToEarthDays(orbitalSpeed, orbitRadiusAU) {
    const orbitalPeriodDays = (2 * Math.PI * orbitRadiusAU / orbitalSpeed) * ORBITAL_SPEED_SCALE;
    return orbitalPeriodDays;
}

function localDaysPerOrbit(rotationSpeed, orbitalSpeed, orbitRadiusAU) {
    const rotationPeriodHours = rotationSpeedToEarthHours(rotationSpeed);
    const orbitalPeriodDays = orbitalSpeedToEarthDays(orbitalSpeed, orbitRadiusAU);
    // Convert rotation period in hours to days for the ratio calculation
    const rotationPeriodDays = rotationPeriodHours / 24;
    // Calculate local days per orbit without any additional scaling
    const localDays = orbitalPeriodDays / rotationPeriodDays;
    return localDays;
}

function displayTimeConversions(selectedPlanetIndex) {
    const planet = universeData.solarSystem[selectedPlanetIndex];

    const rotationPeriodHours = rotationSpeedToEarthHours(planet.rotationSpeed);
    const orbitalPeriodDays = orbitalSpeedToEarthDays(planet.orbitalSpeed, planet.orbitRadius);
    const localDays = localDaysPerOrbit(planet.rotationSpeed, planet.orbitalSpeed, planet.orbitRadius);

   // console.log(`Rotation Period for ${planet.type}: ${rotationPeriodHours.toFixed(2)} Earth hours`);
   // console.log(`Orbital Period for ${planet.type}: ${orbitalPeriodDays.toFixed(2)} Earth days`);
   // console.log(`Local Days per Orbit for ${planet.type}: ${localDays.toFixed(2)}`);
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

