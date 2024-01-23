import { generatePlanetName } from './generators/names.js';
import { generateGeologicalData, determinePlanetaryComposition } from './generators/crust.js';
import { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone  } from './generators/orbit.js';


document.addEventListener('DOMContentLoaded', () => {
    setupThreeJS();
    setupStarGeneration();
    setupSolarSystemGeneration();
});

function setupThreeJS() {
    const canvas = document.getElementById('planetCanvas');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const geometry = new THREE.SphereGeometry(5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(10, 10, 10);
    scene.add(light);

    camera.position.z = 15;

    window.addEventListener('resize', () => {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    });

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    animate();
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

function displayStarProperties(star, div) {
    div.innerHTML = `
        <p>Type: ${star.type}</p>
        <p>Age: ${star.age} billion years</p>
        <p>Size: ${star.size} Solar radii</p>
        <p>Mass: ${star.mass} Solar masses</p>
        <p>Luminosity: ${star.luminosity} Solar luminosity</p>
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
        const planetDetails = `Planet ${index + 1}: Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
        htmlContent += `<p>${planetDetails}</p>`;

        if (planet.orbitRadius >= habitableZone.innerBoundary && planet.orbitRadius <= habitableZone.outerBoundary) {
            displayHabitablePlanetDetails(planet, 1, index, parentStar);
        }
    });

    div.innerHTML = htmlContent;
}

async function displayHabitablePlanetDetails(planet, systemNumber, planetIndex, star) {
    console.log("Displaying habitable planet details"); // Debugging log
    const habitablePlanetDiv = document.getElementById('habitablePlanetDetails');
    
    // Assuming these are placeholders for now
    const atmosphereType = 'M';
    const geologicalActivity = 'Active';
    const moonCount = 2;
    const planetName = generatePlanetName(systemNumber, planetIndex, atmosphereType, geologicalActivity, moonCount);

    const planetDetails = `Name: ${planetName}<br>Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
    console.log("Planet Details:", planetDetails); // Debugging log

    // Star and planet data
    const starSize = star.size;
    const starMass = star.mass;
    const orbitalRadius = planet.orbitRadius;
    const planetSize = planet.size;
    console.log("Star Size:", starSize, "Star Mass:", starMass, "Orbital Radius:", orbitalRadius, "Planet Size:", planetSize); // Debugging log

    // Get geological data
    const geologicalData = generateGeologicalData(planet.size, orbitalRadius, starSize, starMass);
    console.log("Geological Data:", geologicalData); // Debugging log

    // Append geological data to planet details
    const geologicalDetails = `Core Size: ${geologicalData.core.size}, Mantle Size: ${geologicalData.mantle.size}, Crust Size: ${geologicalData.crust.size}, Geological Activity: ${geologicalData.tectonics}`;
    let content = `<h3>Habitable Planet Details</h3><p>${planetDetails}</p><p>${geologicalDetails}</p>`;

    // Element composition
    const compositionData = await determinePlanetaryComposition(planet.size, planet.orbitRadius, star.size, star.mass);
    console.log("Composition Data:", compositionData); // Debugging log
	console.log("Keys in Composition Data:", Object.keys(compositionData));


    // Sort and filter elements
    const valuableElements = ['O', 'Si', 'Al', 'Fe', 'Na', 'Mg', 'K', 'Ti', 'H', 'Cu', 'Ag', 'Au', 'Mth']; // Iron, Copper, Silver, Gold, Mithril
    const sortedComposition = Object.entries(compositionData)
                                     .filter(([element]) => valuableElements.includes(element))
                                     .sort((a, b) => b[1] - a[1]); // Sort by abundance
	console.log("Sorted Composition:", sortedComposition); // Debugging log

    // Calculate and append elemental mass
    const earthVolume = (4/3) * Math.PI * Math.pow(6371, 3); // Earth's volume in km^3
    const planetVolume = (4/3) * Math.PI * Math.pow(planet.size * 6371, 3); // Planet's volume in km^3
    const scalingFactor = planetVolume / earthVolume; // Scaling factor based on volume

	console.log("Planet Size (in Earth radii):", planet.size);
	console.log("Planet Volume (in km^3):", planetVolume);

let elementDetails = '';
sortedComposition.forEach(([element, percentage]) => {
    const elementVolume = planetVolume * percentage * 1000000000;
    let elementMass = elementVolume * getElementDensity(element);
    elementMass *= scalingFactor; // Apply scaling factor to element mass
        
    console.log(`Element: ${element}, Percentage: ${percentage}, Volume: ${elementVolume}, Mass: ${elementMass}`);

    const formattedElementMass = elementMass.toExponential(2); // Format elementMass in scientific notation

    elementDetails += `<p>${element}: ${formattedElementMass} kg</p>`;
    console.log(`Formatted Mass for ${element}: ${formattedElementMass}`);
});


    console.log("Element Details:", elementDetails); // Debugging log

    content += `<div>${elementDetails}</div>`;
    habitablePlanetDiv.innerHTML = content;

	console.log("Final HTML Content:", content);

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