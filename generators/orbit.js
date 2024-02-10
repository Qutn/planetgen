// Courtesy of bryc and Bob Jenkins
function splitmix32(a) {
    return function() {
      a |= 0; a = a + 0x9e3779b9 | 0;
      var t = a ^ a >>> 16; t = Math.imul(t, 0x21f0aaad);
          t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
      return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    }
}

var SEED = Date.now();

var random = splitmix32(SEED);

export function set_random_seed(seed) {
    random = splitmix32(seed);
}

function getRandomValue(min, max) {
    return random() * (max - min) + min;
}

function generateOrbit(seed = null) {
    if (seed != null)
    {
        set_random_seed(seed);
    }

    const parentStar = generateParentStar();
    // Calculate the habitable zone based on the star's luminosity
    const luminosity = generateStarLuminosity(parentStar.type, parentStar.size);
    parentStar.habitableZone = calculateHabitableZone(luminosity);
    // const habitableZone = calculateHabitableZone(/* parameters */); // This line is not needed as habitableZone is already calculated
    const solarSystem = generateSolarSystem(parentStar);
//    const targetPlanet = selectTargetPlanet(solarSystem);

    return {
        parentStar: parentStar,
        solarSystem: solarSystem,
        habitableZone: parentStar.habitableZone

//        targetPlanet: targetPlanet
    };
}

function generateParentStar() {
    const starTypes = ["M", "K", "G", "F", "A", "B", "O"];
    const type = starTypes[Math.floor(random() * starTypes.length)];

    const age = generateStarAge(type);
    const { size, mass } = generateStarSizeAndMass(type, age);
    const luminosity = generateStarLuminosity(type, size);

    return {
        type: type,
        age: age,
        size: size,
        mass: mass,
        luminosity: luminosity
    };
}

function calculateHabitableZone(luminosity) {
    // Constants for inner and outer boundaries in AU based on luminosity
    // These are simplified estimates; actual calculations can be more complex
    const innerBoundary = 0.95 * Math.sqrt(luminosity);
    const outerBoundary = 1.37 * Math.sqrt(luminosity);

    return {
        innerBoundary: innerBoundary,
        outerBoundary: outerBoundary
    };
}

function generateStarAge(type) {
    let age;
    switch (type) {
        case "M":
            // Red dwarfs have very long lifespans
            age = getRandomAge(1, 5000); // in billions of years
            break;
        case "K":
            // Orange dwarfs
            age = getRandomAge(1, 30); // in billions of years
            break;
        case "G":
            // Yellow dwarfs
            age = getRandomAge(1, 10); // in billions of years
            break;
        case "F":
            // Yellow-white stars
            age = getRandomAge(1, 4); // in billions of years
            break;
        case "A":
            // White stars
            age = getRandomAge(0.1, 3); // in billions of years
            break;
        case "B":
            // Blue-white stars
            age = getRandomAge(0.01, 0.5); // in billions of years
            break;
        case "O":
            // Blue stars, shortest lifespan
            age = getRandomAge(0.001, 0.1); // in billions of years
            break;
        default:
            age = 0;
    }
    return age;
}

function getRandomAge(min, max) {
    return random() * (max - min) + min;
}

function generateStarSizeAndMass(type, age) {
    let size; // Radius of the star in terms of Solar radii
    let mass; // Mass of the star in terms of Solar masses

    switch (type) {
        case "M":
            // Red dwarfs
            size = getRandomValue(0.1, 0.7); // Smaller than the Sun
            mass = getRandomValue(0.08, 0.45); // Less massive than the Sun
            break;
        case "K":
            // Orange dwarfs
            size = getRandomValue(0.7, 0.96);
            mass = getRandomValue(0.45, 0.8);
            break;
        case "G":
            // Yellow dwarfs
            size = getRandomValue(0.96, 1.15);
            mass = getRandomValue(0.8, 1.04);
            break;
        case "F":
            // Yellow-white stars
            size = getRandomValue(1.15, 1.4);
            mass = getRandomValue(1.04, 1.4);
            break;
        case "A":
            // White stars
            size = getRandomValue(1.4, 1.8);
            mass = getRandomValue(1.4, 2.1);
            break;
        case "B":
            // Blue-white stars
            size = getRandomValue(1.8, 6.6);
            mass = getRandomValue(2.1, 16);
            break;
        case "O":
            // Blue stars, largest and most massive
            size = getRandomValue(6.6, 20);
            mass = getRandomValue(16, 90);
            break;
        default:
            size = 0;
            mass = 0;
    }

    return { size, mass };
}


function generateStarLuminosity(type, size) {
    let luminosity; // Luminosity in terms of Solar luminosity

    // Simplified model: Luminosity increases with size and varies by type
    switch (type) {
        case "M":
            // Red dwarfs are less luminous
            luminosity = size * 0.08;
            break;
        case "K":
            luminosity = size * 0.6;
            break;
        case "G":
            // Similar to our Sun
            luminosity = size;
            break;
        case "F":
            luminosity = size * 1.5;
            break;
        case "A":
            luminosity = size * 5;
            break;
        case "B":
            luminosity = size * 25;
            break;
        case "O":
            // Most luminous
            luminosity = size * 50;
            break;
        default:
            luminosity = 0;
    }

    return luminosity;
}

console.log("orbit.js loaded");
// end of the star generation
// 
// solar system generator
function generateSolarSystem(parentStar) {
    const numberOfPlanets = getRandomInt(3, 10);
    let solarSystemPlanets = [];
    let habitableZonePlanetAdded = false;

    for (let i = 0; i < numberOfPlanets; i++) {
        const orbitRadius = getRandomOrbitRadius(parentStar, i, numberOfPlanets);
        const planetType = determinePlanetType(parentStar, orbitRadius, habitableZonePlanetAdded);
        const planetSize = getPlanetSize(planetType); 
        const planetAtmosphere = getPlanetAtmosphere(planetType, orbitRadius, parentStar.habitableZone);
        const planetMoons = getPlanetMoons(planetType); 

        if (isInHabitableZone(orbitRadius, parentStar.habitableZone)) {
            habitableZonePlanetAdded = true;
        }

        solarSystemPlanets.push({
            type: planetType,
            orbitRadius: orbitRadius,
            size: planetSize,
        	radius: planetSize,
            atmosphere: planetAtmosphere,
            moons: planetMoons,
        });
    }

	    if (!habitableZonePlanetAdded) {
	        // Adjust one of the planets to be in the habitable zone
	        adjustForHabitableZonePlanet(solarSystemPlanets, parentStar.habitableZone);
    }
    solarSystemPlanets.sort((a, b) => a.orbitRadius - b.orbitRadius);
    return solarSystemPlanets;
}

function getRandomOrbitRadius(parentStar, planetIndex, totalPlanets) {
    // simple logarithmic spacing for orbits
    const minOrbit = 0.2; // Minimum orbit radius in AU
    const maxOrbit = 50;  // Maximum orbit radius in AU
    const spacingFactor = (Math.log(maxOrbit) - Math.log(minOrbit)) / totalPlanets;
    return Math.exp(Math.log(minOrbit) + spacingFactor * planetIndex);
}


function determinePlanetType(parentStar, orbitRadius) {
    // simple model based on orbit radius
    if (orbitRadius < 0.5) {
        return "Lava Planet";
    } else if (orbitRadius < 1.5) {
        return "Terrestrial";
    } else if (orbitRadius < 5) {
        return "Ocean World";
    } else if (orbitRadius < 10) {
        return "Gas Giant";
    } else if (orbitRadius < 30) {
        return "Ice Giant";
    } else {
        return "Dwarf Planet";
    }
}


function getPlanetSize(planetType) {
    // assign sizes based on planet type
    switch (planetType) {
        case "Lava Planet":
            return getRandomValue(0.3, 1); 
        case "Terrestrial":
            return getRandomValue(0.5, 1.5);
        case "Ocean World":
            return getRandomValue(0.8, 2);
        case "Gas Giant":
            return getRandomValue(6, 15); 
        case "Ice Giant":
            return getRandomValue(5, 14);
        case "Dwarf Planet":
            return getRandomValue(0.1, 0.3);
        default:
            return 1;
    }
}


function getPlanetAtmosphere(planetType, orbitRadius, habitableZone) {
    const atmospheres = {
        'trace': ['trace'],
        'carbon_dioxide': ['carbon_dioxide_type_I', 'carbon_dioxide_type_II'],
        'hydrogen_helium': ['hydrogen_helium_type_I', 'hydrogen_helium_type_II', 'hydrogen_helium_type_III'],
        'ice': ['ice_type_I', 'ice_type_II'],
        'nitrogen': ['nitrogen_type_I', 'nitrogen_type_II', 'nitrogen_type_III'],
        'carbon': ['carbon_type_I'],
        'ammonia': ['ammonia_type_I']
    };

    // Helper function to select a random atmosphere from a list
    const randomAtmosphere = (types) => types[Math.floor(Math.random() * types.length)];

    // Determine atmosphere based on planet type and other conditions
    switch (planetType) {
        case "Terrestrial":
            if (isInHabitableZone(orbitRadius, habitableZone)) {
                return randomAtmosphere([...atmospheres['carbon_dioxide'], ...atmospheres['nitrogen']]);
            }
            return randomAtmosphere(atmospheres['carbon_dioxide']);
        case "Ocean World":
            return randomAtmosphere([...atmospheres['carbon'], ...atmospheres['ammonia'], ...atmospheres['nitrogen']]);
        case "Gas Giant":
            return randomAtmosphere([...atmospheres['hydrogen_helium'], atmospheres['carbon'][0]]);
        case "Ice Giant":
            return randomAtmosphere([...atmospheres['ice'], atmospheres['ammonia'][0]]);
        case "Lava Planet":
                return randomAtmosphere([...atmospheres['carbon_dioxide']]);
        case "Dwarf Planet":
            return randomAtmosphere([...atmospheres['trace'], ...atmospheres['carbon_dioxide']]);
        default:
            return "unknown"; // Handle the 'unknown' case
    }
}




function getPlanetMoons(planetType) {
    switch (planetType) {
        case "Terrestrial":
            return getRandomInt(0, 3);
        case "Ocean World":
            return getRandomInt(0, 2);
        case "Gas Giant":
            return getRandomInt(1, 80); 
        case "Ice Giant":
            return getRandomInt(1, 50);
        case "Lava Planet":
            return getRandomInt(0, 2);
        case "Dwarf Planet":
            return getRandomInt(0, 5); 
        default:
            return 0;
    }
}

function getRandomInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
}


function adjustForHabitableZonePlanet(planets, habitableZone) {
    let habitableZonePlanetExists = planets.some(planet => isInHabitableZone(planet.orbitRadius, habitableZone));

    if (!habitableZonePlanetExists) {
        // Find a planet to adjust into the habitable zone
        let planetToAdjust = planets[Math.floor(random() * planets.length)];
        planetToAdjust.orbitRadius = (habitableZone.innerBoundary + habitableZone.outerBoundary) / 2;
        // planetToAdjust.type = "Terrestrial"; // Adjust type for habitability
    }
}


export function isInHabitableZone(orbitRadius, habitableZone) {
    return orbitRadius >= habitableZone.innerBoundary && orbitRadius <= habitableZone.outerBoundary;
}


// Implement the functions: getRandomPlanetType, getOrbitRadius, getOrbitPeriod, getPlanetSize
// These functions will generate specific characteristics for each planet


// function selectTargetPlanet(solarSystem) {
    // Select one planet from the solar system
    // This could be random or based on specific criteria
    // ...
//    return targetPlanet;
// }

export { generateOrbit, generateParentStar, generateStarSizeAndMass, generateStarLuminosity, calculateHabitableZone, determinePlanetType, getPlanetAtmosphere };