
import { isInHabitableZone } from './orbit.js';
// Define the base atmosphere types and the logic to choose one
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

// Exported function to determine atmosphere based on planet type and other conditions
export function getPlanetAtmosphere(planetType, orbitRadius, habitableZone) {
    // Logic remains the same as before
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

// Define the base makeup for each atmosphere type
const baseAtmosphereComposition = {
    'trace': {
        // Example: Mercury or Pluto
        // Trace atmospheres are typically very thin with no significant pressure or major components
        'He': 42, // These are placeholder values as trace atmospheres can vary wildly
        'Na': 42,
        'O2': 16
    },
    'carbon_dioxide_type_I': {
        // Example: Mars
        'CO2': 95.32,
        'N2': 2.7,
        'Ar': 1.6,
        'O2': 0.13,
        'CO': 0.08
    },
    'carbon_dioxide_type_II': {
        // Example: Venus
        'CO2': 96.5,
        'N2': 3.5,
        'Ar': 0.005,
        'SO2': 0.015
    },
    'hydrogen_helium_type_I': {
        // Example: Jupiter
        'H2': 75,
        'He': 24,
        'CH4': 1 // Methane and other trace elements can also be present in small amounts
    },
    'hydrogen_helium_type_II': {
        // Example: Saturn
        'H2': 93,
        'He': 6,
        'CH4': 0.3, // Small amounts of methane, ammonia, etc.
        'NH3': 0.3, // Ammonia
        'H2O': 0.1 // Water vapor
    },
    'hydrogen_helium_type_III': {
        // Example: Brown Dwarf
        'H2': 70,
        'CH4': 15, // High amounts of methane
        'H2O': 10, // Water vapor
        'NH3': 5 // Ammonia
    },
    'ice_type_I': {
        // Example: Uranus
        'H2': 83,
        'He': 15,
        'CH4': 2, // Methane
        'C2H2': 0.0004 // Acetylene, and other trace elements
    },
    'ice_type_II': {
        // Example: Neptune
        'H2': 80,
        'He': 19,
        'CH4': 1.5
    },
    'nitrogen_type_I': {
        // Example: Titan
        'N2': 94,
        'CH4': 5, // Methane
        'H2': 1
    },
    'nitrogen_type_II': {
        // Example: Triton
        'N2': 99,
        'CH4': 0.5, // Methane
        'CO': 0.5 // Carbon Monoxide
    },
    'nitrogen_type_III': {
        // Terrestrial planet with a life-supporting atmosphere, like Earth
        'N2': 78,
        'O2': 21,
        'Ar': 1
    },
    'carbon_type_I': {
        // Example: Hot Jupiter like HD 209458b
        'H2O': 50, // Water vapor
        'CO': 20, // Carbon monoxide
        'CH4': 10, // Methane
        'HCN': 10, // Hydrogen cyanide
        'NH3': 10 // Ammonia
    },
    'ammonia_type_I': {
        // Theoretical atmosphere with a significant presence of ammonia
        'NH3': 60, // Ammonia
        'H2': 20, // Hydrogen
        'He': 10,
        'CH4': 10 // Methane
    }
};

// Function to get base composition
export function getBaseComposition(atmosphereType) {
    return baseAtmosphereComposition[atmosphereType] || {};
}

// A function that could apply adjustments to the base composition
function applyAdjustments(baseComposition) {
    // Placeholder for potential adjustments
    // For now, it simply returns the base composition
    // Later, this could include logic to modify the composition based on various factors
    return baseComposition;
  }
  
  // The output function to provide the data for display
  function getAtmosphereDetailsForDisplay(atmosphereType) {
    // Get the base composition for the given atmosphere type
    const baseComposition = baseAtmosphereComposition[atmosphereType];
  
    // Apply any adjustments to the base composition
    const adjustedComposition = applyAdjustments(baseComposition);
  
    // Convert the composition into a display-friendly format
    const displayData = Object.entries(adjustedComposition).map(([compound, percentage]) => {
      return `${compound}: ${percentage}%`;
    }).join(', ');
  
    // Return the display data
    return displayData;
  }
  
  function calculateSurfaceTemperature(starLuminosity, orbitRadiusAU, atmosphereComposition) {
    const STEFAN_BOLTZMANN_CONSTANT = 5.67e-8;
    const SOLAR_LUMINOSITY = 3.828e26; // Watts
    const AU_IN_METERS = 1.496e11;
    const EARTH_ALBEDO = 0.3; // This can be adjusted or made dynamic based on planet characteristics
    const GREENHOUSE_EFFECT_FACTOR = 1.1; // This is a simplification and can be refined

    // Convert AU to meters for the formula
    let distanceInMeters = orbitRadiusAU * AU_IN_METERS;

    // Assuming the atmosphereComposition affects the greenhouse factor
    let greenhouseFactor = calculateGreenhouseFactor(atmosphereComposition);

    // Calculate effective temperature without atmosphere
    let effectiveTemperature = Math.pow(
        (starLuminosity * SOLAR_LUMINOSITY * (1 - EARTH_ALBEDO)) /
        (16 * Math.PI * Math.pow(distanceInMeters, 2) * STEFAN_BOLTZMANN_CONSTANT),
        0.25
    );

    // Adjust temperature for greenhouse effect
    let surfaceTemperature = effectiveTemperature * greenhouseFactor;

    return surfaceTemperature - 273.15; // Convert Kelvin to Celsius
}

function calculateGreenhouseFactor(atmosphereComposition) {
    // This is a very rough estimate and would depend on the specific gases and their proportions
    // For example, a higher proportion of greenhouse gases like CO2 or methane would increase the factor
    let greenhouseFactor = GREENHOUSE_EFFECT_FACTOR;

    if (atmosphereComposition.includes('CO2')) {
        greenhouseFactor *= 1.1;
    }
    if (atmosphereComposition.includes('CH4')) {
        greenhouseFactor *= 1.2;
    }
    // ... other conditions based on atmosphereComposition ...

    return greenhouseFactor;
}



  export { getAtmosphereDetailsForDisplay };