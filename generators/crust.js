async function loadElementsData() {
    const response = await fetch('generators/elements_with_abundances.json');
    const data = await response.json();
    console.log(data); // Check the structure is as expected
    return data;
}

function generateGeologicalData(planetSize, orbitalRadius, starSize, starMass, planetType) {
    // Calculate the interior structure sizes in meters
    const interiorSizes = calculateInterior(planetSize, planetType);

    // Determine the state of the core (e.g., molten or solid), could be a separate function based on planetSize, starMass, distanceFromStar
    const coreState = assessCoreState(planetSize, starMass, orbitalRadius); // This is a placeholder function call

    // Return an object containing the geological data
    return {
        core: {
            size: interiorSizes.core.radius,
            volume: interiorSizes.core.volume,
            state: coreState
        },
        mantle: {
            thickness: interiorSizes.mantle.thickness,
            volume: interiorSizes.mantle.volume
        },
        crust: {
            thickness: interiorSizes.crust.thickness,
            volume: interiorSizes.crust.volume
        },
        // Assume tectonic activity is determined by another process/function
       // tectonics: determineTectonicActivity(planetSize, starMass, orbitalRadius) // Placeholder for actual function
    };
}

function calculateInterior(planetSize, planetType) {
    const earthRadiusInMeters = 6378000; // Earth's radius in meters
    const planetRadiusInMeters = planetSize * earthRadiusInMeters; // Planet's radius in meters

    // Adjustments based on feedback
    const coreRadiusInMeters = estimateCoreSize(planetSize, planetType) * planetRadiusInMeters;
    const mantleOuterRadiusInMeters = estimateMantleSize(planetSize, planetType) * planetRadiusInMeters;
    const crustThicknessInMeters = estimateCrustSize(planetSize, planetType) * planetRadiusInMeters;

    // Correct calculation for mantle and crust thickness
    const mantleThicknessInMeters = mantleOuterRadiusInMeters - coreRadiusInMeters;
    const crustOuterRadiusInMeters = mantleOuterRadiusInMeters + crustThicknessInMeters;

    // Calculate volumes in cubic meters correctly
    const coreVolume = (4 / 3) * Math.PI * Math.pow(coreRadiusInMeters, 3);
    const mantleVolume = (4 / 3) * Math.PI * (Math.pow(mantleOuterRadiusInMeters, 3) - Math.pow(coreRadiusInMeters, 3));
    const crustVolume = (4 / 3) * Math.PI * (Math.pow(crustOuterRadiusInMeters, 3) - Math.pow(mantleOuterRadiusInMeters, 3));

    return {
        core: { radius: coreRadiusInMeters, volume: coreVolume },
        mantle: { thickness: mantleThicknessInMeters, volume: mantleVolume },
        crust: { thickness: crustThicknessInMeters, volume: crustVolume },
    };
}


async function determinePlanetaryComposition(planetSize, orbitalRadius, starSize, starMass) {
    let composition = {};

    // Load elements data
    const elementsData = await loadElementsData();
    const elements = elementsData.elements;

    elements.forEach(element => {
        let baseProb = baseProbability(element);
        let starSizeAdjustment = adjustForStarSize(element, starSize);
        let orbitalRadiusAdjustment = adjustForOrbitalRadius(element, orbitalRadius);
        let planetSizeAdjustment = adjustForPlanetSize(element.abundance, planetSize); // Ensure this uses final abundance value
        let adjustedProbability = baseProb * starSizeAdjustment * orbitalRadiusAdjustment * planetSizeAdjustment;

        composition[element.symbol] = adjustedProbability;
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
    let planetSizeAdjustment = adjustForPlanetSize(element.abundance, planetSize, element.name, element.symbol); // Assuming element.abundance is the fraction
    probability *= planetSizeAdjustment;

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

    //return adjustmentFactor;
    return 1;
}

const elementTypes = {
    volatiles: ['H', 'He', 'C', 'N', 'O', 'Ne', 'S', 'Ar', 'Kr', 'Xe'], // Hydrogen, Helium, Carbon, Nitrogen, Oxygen, etc.
    refractories: ['Fe', 'Mg', 'Si', 'Al', 'Ca', 'Ti', 'Cr', 'Ni'] // Iron, Magnesium, Silicon, Aluminium, etc.
};

function isElementVolatile(elementSymbol) {
    return elementTypes.volatiles.includes(elementSymbol);
}

function adjustForOrbitalRadius(elementSymbol, orbitalRadius, starLuminosity) {
    let adjustmentFactor = 1;
    const iceLineAU = calculateIceLine(starLuminosity); // Calculate the ice line based on star luminosity

    if (isElementVolatile(elementSymbol)) {
        // Element is volatile
        adjustmentFactor = orbitalRadius < iceLineAU ? 0.5 : 1.5;
    } else {
        // Element is refractory
        adjustmentFactor = orbitalRadius < iceLineAU ? 1.5 : 0.5;
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


function adjustForPlanetSize(elementAbundanceFraction, planetSize, element) {
    // Constants
    const earthCrustMassKg = 2.83e22; // Approximate mass of Earth's crust in kg
    const oxygenPercentage = 0.461; // Fraction of oxygen in Earth's crust
    const elements = elementsData.elements
  //  console.log(`earthCrustMassKg: ${earthCrustMassKg}, oxygenPercentage: ${oxygenPercentage}`);

    // Calculate mass of oxygen in Earth's crust
    const oxygenMassInEarthCrust = earthCrustMassKg * oxygenPercentage;
  //  console.log(`oxygenMassInEarthCrust: ${oxygenMassInEarthCrust}`);
    
    // Calculate the scaling factor from fractional abundance to kg
    const scalingFactor = earthCrustMassKg / oxygenPercentage; // Adjusted to correct for the total crust mass
    //console.log(`scalingFactor: ${scalingFactor}`);

    // Scale the element's abundance fraction to kilograms using the scaling factor
    const elementMassInEarthCrustKg = elementAbundanceFraction * scalingFactor;
    //console.log(`elementAbundanceFraction: ${element.name} = ${elementAbundanceFraction}, Element Mass in Kg: ${elementMassInEarthCrustKg}`);
    
    // Adjust the scaled mass for planet size
    // Assuming the mass of the planet's crust scales with the cube of its radius relative to Earth
    const planetCrustMassAdjustmentFactor = Math.pow(planetSize, 3);
    //console.log(`planetSize: ${planetSize}, planetCrustMassAdjustmentFactor: ${planetCrustMassAdjustmentFactor}`);
    
    // Calculate adjusted element mass for the given planet size
    const adjustedElementMass = elementMassInEarthCrustKg * planetCrustMassAdjustmentFactor;
    //console.log(`adjustedElementMass: ${adjustedElementMass}`);

    // Calculate the adjustment factor for the element based on its abundance and the planet size
    const adjustmentFactor = adjustedElementMass // elementMassInEarthCrustKg;
    //console.log(`adjustmentFactor: ${adjustmentFactor}`);

    if (isNaN(adjustmentFactor)) {
    //    console.error('Adjustment factor calculation resulted in NaN. Check inputs and calculations.');
    }

    return adjustmentFactor;
}





// Implement the estimation functions based on astrophysical and geological models
function estimateCoreSize(planetRadius, planetType) {
    let baseCoreSize = planetRadius * 0.1; // Starting with a base core size

    switch (planetType) {
        case 'Dwarf':
            baseCoreSize *= 0.6;
            break;
        case 'Terrestrial':
            baseCoreSize *= 1;
            break;
        case 'Ocean':
            baseCoreSize *= 0.85;
            break;
        case 'Lava':
            baseCoreSize *= 1.2; // Lava planets might have larger cores due to volcanic activity
            break;
        case 'Gas Giant':
            baseCoreSize *= 1.2; // Gas giants are expected to have larger cores
            break;
        case 'Ice Giant':
            baseCoreSize *= 1.1; // Ice giants also may have larger cores
            break;
        default:
            // Handle unexpected types, possibly with a logging statement
            break;
    }

    return baseCoreSize;
}

function determineCoreComposition(planetType) {
    const coreCompositions = {
        'Terrestrial': { 'Fe': 80, 'Ni': 10, 'S': 5, 'Other': 5 },
        'Gas Giant': { 'Rock': 50, 'H2O': 30, 'Other': 20 },
        'Ice Giant': { 'H2O': 40, 'CH4': 20, 'Rock': 30, 'Other': 10 },
        'Dwarf Planet': { 'Rock': 70, 'Ice': 20, 'Other': 10 },
    };

    return coreCompositions[planetType] || coreCompositions['Terrestrial']; // Default to terrestrial if type is unknown
}


function estimateMantleSize(planetRadius, planetType) {
    let baseMantleSize = planetRadius * 0.4; // Starting with a base mantle size

    switch (planetType) {
        case 'Dwarf':
            baseMantleSize *= 0.6;
            break;
        case 'Terrestrial':
            baseMantleSize *= 1;
            break;
        case 'Ocean':
            baseMantleSize *= 0.7; // Ocean worlds might have thinner mantles due to large water content
            break;
        case 'Lava':
            baseMantleSize *= 0.95; // Lava planets might have active mantles
            break;
        case 'Gas Giant':
            baseMantleSize *= 0.3; // Gas giants might have a smaller mantle in proportion to their size
            break;
        case 'Ice Giant':
            baseMantleSize *= 0.4; // Ice giants might also have a smaller mantle in proportion to their size
            break;
        default:
            // Handle unexpected types, possibly with a logging statement
            break;
    }

    return baseMantleSize;
}

function estimateCrustSize(planetRadius, planetType) {
    let baseCrustThickness = planetRadius * 0.05; // Starting with a base crust thickness

    switch (planetType) {
        case 'Dwarf':
            baseCrustThickness *= 0.8; // Dwarf planets might have a thicker crust relative to their size
            break;
        case 'Terrestrial':
            baseCrustThickness *= 1; // Standard thickness for terrestrial planets
            break;
        case 'Ocean':
            baseCrustThickness *= 0.4; // Ocean worlds might have a thinner crust
            break;
        case 'Lava':
            baseCrustThickness *= 0.7; // Lava planets might have a thinner crust due to volcanic activity
            break;
        case 'Gas Giant':
            // Gas giants do not have a traditional crust, but for the sake of the model, we might define a minimal layer
            baseCrustThickness *= 0.001;
            break;
        case 'Ice Giant':
            // Ice giants have a mantle of icy materials that could be considered a 'crust' of sorts
            baseCrustThickness *= 0.1;
            break;
        default:
            // Handle unexpected types, possibly with a logging statement
            break;
    }

    return baseCrustThickness;
}


function assessCoreState(planetRadius, starMass, distanceFromStar) { /* ... */ }


export { generateGeologicalData, determinePlanetaryComposition };
export const elementsData = await loadElementsData();
