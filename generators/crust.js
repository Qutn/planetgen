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

    // Custom adjustments for the most common elements in the crust
    switch (element.symbol) {
        case 'O': // Oxygen
            probability = 0.461;
            break;
        case 'Si': // Silicon
            probability = 0.282;
            break;
        case 'Al': // Aluminium
            probability = 0.082;
            break;
        case 'Fe': // Iron
            probability = 0.056;
            break;
        case 'Ca': // Calcium
            probability = 0.041;
            break;
        case 'Na': // Sodium
            probability = 0.023;
            break;
        case 'Mg': // Magnesium
            probability = 0.023;
            break;
        case 'K': // Potassium
            probability = 0.020;
            break;
        case 'Ti': // Titanium
            probability = 0.005;
            break;
        case 'H': // Hydrogen
            probability = 0.0014;
            break;
        default:
            // For other elements, use the original probability calculation
            probability = 1 / atomicMass;

            // Adjust for the iron peak
            if (atomicMass >= 55 && atomicMass <= 58) {
                probability *= 2;
            }

            // Adjust for the rarity of heavier elements
            if (atomicMass > 200) {
                probability *= 0.1;
            }
            break;
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

function adjustForPlanetSize(element, planetSize) {
    // Logic to adjust probability based on planet size
    return 1; // Placeholder
}

// Implement the estimation functions based on astrophysical and geological models
function estimateCoreSize(planetRadius) { /* ... */ }

function estimateMantleSize(planetRadius) { /* ... */ }

function estimateCrustSize(planetRadius) { /* ... */ }

function assessCoreState(planetRadius, starMass, distanceFromStar) { /* ... */ }

function assessTectonicActivity(planetMantleSize) { /* ... */ }

export { generateGeologicalData, determinePlanetaryComposition };
