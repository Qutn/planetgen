async function loadElementsData() {
    const response = await fetch('generators/elements.json');
    return await response.json();
}

function generateGeologicalData(planetSize, orbitalRadius, starSize, starMass) {
    // Placeholder values for geological data
    const coreSize = estimateCoreSize(planetSize, starMass); // Updated
    const mantleSize = estimateMantleSize(planetSize); // Updated
    const crustSize = estimateCrustSize(planetSize); // Updated
    const tectonicActivity = assessTectonicActivity(mantleSize, orbitalRadius, starMass); // Updated

    // Return an object containing the geological data
    return {
        core: {
            size: coreSize,
            state: 'Molten' // Placeholder state
        },
        mantle: {
            size: mantleSize
        },
        crust: {
            size: crustSize
        },
        tectonics: tectonicActivity
    };
}

async function determinePlanetaryComposition(planetSize, orbitalRadius, starSize, starMass) {
    let composition = {};

    // Load elements data
    const elementsData = await loadElementsData();
    const elements = elementsData.elements;

    elements.forEach(element => {
        let probability = calculateElementProbability(element, planetSize, orbitalRadius, starSize, starMass);
        composition[element.symbol] = probability;
    });

    return composition;
}

function calculateElementProbability(element, planetSize, orbitalRadius, starSize, starMass) {
    // Initialize a base probability
    let probability = baseProbability(element);

    // Adjust probability based on star size and heat
    probability *= adjustForStarSize(element, starSize);

    // Adjust for orbital radius
    probability *= adjustForOrbitalRadius(element, orbitalRadius);

    // Adjust for planet size and gravitational differentiation
    probability *= adjustForPlanetSize(element, planetSize);

    return probability;
}

// probability functions
// 
function baseProbability(element) {
    const atomicMass = element.atomicMass;
    let probability;

    // Lighter elements generally more abundant
    probability = 1 / atomicMass; 

    // Adjust for the iron peak
    if (atomicMass >= 55 && atomicMass <= 58) { // Around Iron's atomic mass
        probability *= 2; // Increase probability for elements around iron
    }

    // Adjust for the rarity of heavier elements
    if (atomicMass > 200) { // Very heavy elements
        probability *= 0.1; // Significantly reduce probability
    }

    return probability;
}


function adjustForStarSize(element, starSize) {
    let adjustmentFactor = 1;

    // Assuming starSize is a relative measurement where 1 is similar to the Sun
    if (starSize > 1) { // Larger than the Sun
        // Heavier elements are more likely
        adjustmentFactor += (element.atomicMass - 30) / 200; // Example adjustment
    } else { // Smaller than or equal to the Sun
        // Lighter elements are more likely
        adjustmentFactor -= (element.atomicMass - 30) / 200; // Example adjustment
    }

    return Math.max(adjustmentFactor, 0.1); // Ensure the factor doesn't go below 0.1

    // Log the adjustment factor for debugging
    console.log(`Element: ${element.name}, Star Size: ${starSize}, Adjustment Factor: ${adjustmentFactor}`);

    return adjustmentFactor;
}

function adjustForOrbitalRadius(element, orbitalRadius) {
    // Logic to adjust probability based on orbital radius
    return 1; // Placeholder
}

function adjustForPlanetSize(elementProbability, planetSizeInEarthRadii) {
    // Simple linear scaling based on the size of the planet
    return elementProbability * planetSizeInEarthRadii;
}



// Implement the estimation functions based on astrophysical and geological models
function estimateCoreSize(planetRadius) { /* ... */ }

function estimateMantleSize(planetRadius) { /* ... */ }

function estimateCrustSize(planetRadius) { /* ... */ }

function assessCoreState(planetRadius, starMass, distanceFromStar) { /* ... */ }

function assessTectonicActivity(planetMantleSize) { /* ... */ }

export { generateGeologicalData, determinePlanetaryComposition };
