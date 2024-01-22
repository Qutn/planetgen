import { generatePlanetName } from './generators/names.js';

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
        displaySolarSystemProperties(orbitData.solarSystem, solarSystemPropertiesDiv, orbitData.parentStar.habitableZone);
    });
}

function displaySolarSystemProperties(solarSystem, div, habitableZone) {
    let htmlContent = '<h3>Solar System Planets</h3>';
    solarSystem.forEach((planet, index) => {
        const planetDetails = `Planet ${index + 1}: Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
        htmlContent += `<p>${planetDetails}</p>`;

        if (planet.orbitRadius >= habitableZone.innerBoundary && planet.orbitRadius <= habitableZone.outerBoundary) {
            displayHabitablePlanetDetails(planet);
        }
    });

    div.innerHTML = htmlContent;
}

function displayHabitablePlanetDetails(planet) {
    const habitablePlanetDiv = document.getElementById('habitablePlanetDetails');
	const planetName = generatePlanetName(systemNumber, planetIndex, null, null, null);
    const planetDetails = `Habitable Planet: Type - ${planet.type}, Orbit Radius - ${planet.orbitRadius.toFixed(2)} AU, Size - ${planet.size}, Atmosphere - ${planet.atmosphere}, Moons - ${planet.moons}`;
    habitablePlanetDiv.innerHTML = `<h3>Habitable Planet Details</h3><p>${planetDetails}</p>`;
    // Additional procedural generation for geology, mineral content, atmosphere, etc., can be added here
}


// Additional functions for procedural generation of planet details
// For example: generateGeology, generateMineralContent, generateAtmosphere, etc.