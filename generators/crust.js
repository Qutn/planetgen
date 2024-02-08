async function loadElementsData() {
    const response = await fetch('generators/elements_with_abundances.json');
    const data = await response.json();
    console.log(data); // Check the structure is as expected
    return data;
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

function baseProbability(element) {
    if (element.abundance !== undefined && element.abundance !== null) {
        // Return the abundance as the base probability
        return element.abundance;
    } else {
        // Handle the case where the element has no abundance data
        console.warn(`No abundance data found for element: ${element.symbol}`);
        return 0;
    }
}

function quadraticCurve(Z, startZ, endZ, peakVal, endVal) {
    // Assuming the peak is at Carbon (Z=6), adjust the constants accordingly
    const a = (endVal - peakVal) / Math.pow((startZ - endZ), 2); // Quadratic coefficient
    const b = -2 * a * endZ; // Linear coefficient
    const c = peakVal - (a * Math.pow(startZ, 2)) - (b * startZ); // Constant term

    return (a * Math.pow(Z, 2)) + (b * Z) + c;
}


function linearInterpolation(Z, startZ, endZ, startVal, endVal) {
    const slope = (endVal - startVal) / (endZ - startZ);
    return startVal + slope * (Z - startZ);
}

function exponentialDecay(Z, startZ, startVal, endVal) {
    const decayRate = 30; // Adjust this value to control the decay rate
    const decay = Math.exp((Z - startZ) / decayRate) * (startVal - endVal);
  //  console.log(`Exponential decay for Z=${Z}: ${decay}`);
    return startVal - decay;
}



function handleFantasyElements(Z, name) {
    // Define a basic mapping of fantasy/sci-fi elements 
    const sciFiElementProbabilities = {
        'Mithral': -6, // Extremely rare
        'Adamantine': -6.5, // Even rarer
        'Naquadah': -5.5, // Rare
        'Trinium': -5, // Uncommon
        'Duranium': -4, // Uncommon, but slightly more so than Trinium
        'Tritanium': -4.5, // Rare
        'Neutronium': -7, // Extremely rare, almost theoretical
        'Trelium-D': -4.8, // Rare
        'Dilithium': -6.7, // Very rare
        'Trilithium': -6.7, // Very rare
        'Latinum': -5.2, // Rare
    };

    return sciFiElementProbabilities[name] || -2; // Default low log probability for unspecified elements
}




function adjustForStarSize(element, starSize) {
    let adjustmentFactor = 1;

    // Assuming starSize is a relative measurement where 1 is similar to the Sun
    if (starSize > 1) {
        // Heavier elements are more likely for stars larger than the Sun
        adjustmentFactor += (element.atomicMass - 30) / 200;
    } else {
        // Lighter elements are more likely for stars smaller than or equal to the Sun
        adjustmentFactor -= (element.atomicMass - 30) / 200;
    }

    // Ensure the adjustment factor doesn't go below 0.1
    adjustmentFactor = Math.max(adjustmentFactor, 0.1);

    // Log the adjustment factor for debugging
    //console.log(`Element: ${element.name}, Star Size: ${starSize}, Adjustment Factor: ${adjustmentFactor}`);

    return adjustmentFactor;
}

function adjustForOrbitalRadius(element, orbitalRadius, starLuminosity) {
    let adjustmentFactor = 1;
    const iceLineAU = calculateIceLine(starLuminosity); // Calculate the ice line based on star luminosity

    // Example adjustments
    if (orbitalRadius < iceLineAU) {
        // Inside the ice line
        if (element.isVolatile) {
            adjustmentFactor *= 0.5; // Decrease probability for volatiles
        } else {
            adjustmentFactor *= 1.5; // Increase probability for refractories
        }
    } else {
        // Outside the ice line
        if (element.isVolatile) {
            adjustmentFactor *= 1.5; // Increase probability for volatiles
        } else {
            adjustmentFactor *= 0.5; // Decrease probability for refractories
        }
    }

    // Further adjustments can be made based on additional criteria
    // For example, adjusting for specific elements based on their unique properties

    return adjustmentFactor;
}

function calculateIceLine(starLuminosity) {
    // Placeholder function to calculate the ice line position based on star luminosity
    // This can be a simple linear model or a more complex calculation
    return Math.sqrt(starLuminosity / 4); // Simple example, not scientifically accurate
}


function adjustForPlanetSize(elementAbundanceFraction, planetSize) {
    // Constants
    const earthCrustMassKg = 2.83e22; // Approximate mass of Earth's crust in kg
    const oxygenPercentage = 0.461; // Fraction of oxygen in Earth's crust
    
    // Calculate mass of oxygen in Earth's crust
    const oxygenMassInEarthCrust = earthCrustMassKg * oxygenPercentage;
    
    // Calculate the scaling factor from fractional abundance to kg
    const scalingFactor = earthCrustMassKg / oxygenPercentage; // Adjusted to correct for the total crust mass

    // Scale the element's abundance fraction to kilograms using the scaling factor
    const elementMassInEarthCrustKg = elementAbundanceFraction * scalingFactor;
    
    // Adjust the scaled mass for planet size
    // Assuming the mass of the planet's crust scales with the cube of its radius relative to Earth
    const planetCrustMassAdjustmentFactor = Math.pow(planetSize, 3);
    
    // Calculate adjusted element mass for the given planet size
    const adjustedElementMass = elementMassInEarthCrustKg * planetCrustMassAdjustmentFactor;

    // Calculate the adjustment factor for the element based on its abundance and the planet size
    const adjustmentFactor = adjustedElementMass / elementMassInEarthCrustKg;

    return adjustmentFactor;
}




// Implement the estimation functions based on astrophysical and geological models
function estimateCoreSize(planetRadius) { /* ... */ }

function estimateMantleSize(planetRadius) { /* ... */ }

function estimateCrustSize(planetRadius) { /* ... */ }

function assessCoreState(planetRadius, starMass, distanceFromStar) { /* ... */ }

function assessTectonicActivity(planetMantleSize) { /* ... */ }

export { generateGeologicalData, determinePlanetaryComposition };
export const elementsData = await loadElementsData();
