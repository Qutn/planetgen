import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { generatePlanetName } from './generators/names.js';
import { generateGeologicalData, determinePlanetaryComposition } from './generators/crust.js';
import { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone  } from './generators/orbit.js';

// Global variables for the three.js objects
let sphere, scene, camera, renderer;

document.addEventListener('DOMContentLoaded', () => {
    setupThreeJS();
    setupStarGeneration();
    setupSolarSystemGeneration();
});

function setupThreeJS() {
    const canvas = document.getElementById('planetCanvas');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Assuming Earth's radius is 1 unit in your 3D space
    const earthRadiusUnit = 1;
    // Start with a default sphere representing Earth
    const geometry = new THREE.SphereGeometry(earthRadiusUnit, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

// lighting
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white light
    scene.add(ambientLight);

    // Directional Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5); // position the light
    scene.add(directionalLight);

    // Point Light
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight.position.set(-10, -10, -10);
    scene.add(pointLight);

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

function updatePlanetSize(planetRadiusInEarthUnits) {
    // Remove the existing sphere from the scene
    console.log("Updating planet size to:", planetRadiusInEarthUnits); // Log the input size
    scene.remove(sphere);
    
    // Create a new geometry with the updated size
    const newGeometry = new THREE.SphereGeometry(planetRadiusInEarthUnits, 32, 32);
    console.log("Updated sphere geometry"); // Log after updating geometry

    // Update the sphere with the new geometry
    sphere.geometry.dispose(); // Dispose of the old geometry
    sphere.geometry = newGeometry;
    
    // Re-add the sphere to the scene
    scene.add(sphere);
    console.log("Re-added sphere to scene"); // Log after adding sphere back to scene

    
    // Adjust camera distance if the planet is significantly larger or smaller
    // camera.position.z = 20 * planetRadiusInEarthUnits;
    console.log("Updated camera position"); // Log camera position update

}

// star generation

function setupStarGeneration() {
    const generateStarButton = document.getElementById('generateStarButton');
    const starPropertiesDiv = document.getElementById('starProperties');

    generateStarButton.addEventListener('click', () => {
        const star = generateStar();
        displayStarProperties(star, starPropertiesDiv);
    });
}

function generateStar() {
    console.log("generateStar called");
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
        displaySolarSystemProperties(orbitData.solarSystem, solarSystemPropertiesDiv, orbitData.parentStar.habitableZone, orbitData.parentStar);
    });
}

function displaySolarSystemProperties(solarSystem, div, habitableZone, parentStar) {
    let htmlContent = '<h3>Solar System Planets</h3>';
    solarSystem.forEach((planet, index) => {
        const planetDetails = `Planet ${index + 1}: Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size.toFixed(2)}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
        htmlContent += `<p>${planetDetails}</p>`;

        if (planet.orbitRadius >= habitableZone.innerBoundary && planet.orbitRadius <= habitableZone.outerBoundary) {
            displayHabitablePlanetDetails(planet, 1, index, parentStar);
        }
    });

    div.innerHTML = htmlContent;
}

async function displayHabitablePlanetDetails(planet, systemNumber, planetIndex, star) {
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

	console.log("Planet Size (in Earth radii):", planet.size);
	// console.log("Planet Volume (in km^3):", planetVolume);

    const planetGravityInMs2 = (planet.size * 9.8).toFixed(2); // Gravity in m/s^2
    const planetGravityInG = (planetGravityInMs2 / 9.8).toFixed(2); // Convert to Earth's gravity

    const gravityDetails = `<p>Gravity: ${planetGravityInMs2} m/s<sup>2</sup> (${planetGravityInG} G)</p>`;
    content += gravityDetails;

    console.log("Displaying details for habitable planet. Size:", planet.size); // Log before calling updatePlanetSize
    updatePlanetSize(planet.size);


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