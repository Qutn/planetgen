
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
  
  export function calculateSurfaceTemperature(starLuminosity, starTemperature, orbitRadiusAU, planetRadius, atmosphereType) {
    const STEFAN_BOLTZMANN_CONSTANT = 5.67e-8;
    const SOLAR_LUMINOSITY_IN_WATTS = 3.828e26; // Watts
    const AU_IN_METERS = 1.496e11;
    const EARTH_RADIUS_IN_METERS = 6371e3; // Earth radius in meters for scale
    const SOLAR_TEMPERATURE = 5778; // Kelvin, for the Sun


    let adjustedStarLuminosity = starLuminosity * SOLAR_LUMINOSITY_IN_WATTS;

    let temperatureEffectFactor = Math.pow(starTemperature / SOLAR_TEMPERATURE, 4);

    let distanceFromStarInMeters = orbitRadiusAU * AU_IN_METERS;

    let effectiveTemperature = Math.pow(
        (adjustedStarLuminosity * temperatureEffectFactor * (1 - getPlanetAlbedo(atmosphereType))) /
        (16 * Math.PI * Math.pow(distanceFromStarInMeters, 2) * STEFAN_BOLTZMANN_CONSTANT),
        0.25
    );

    let greenhouseFactor = calculateGreenhouseFactor(atmosphereType);
    let surfaceTemperature = effectiveTemperature * greenhouseFactor;

    let sizeEffect = calculateSizeEffect(planetRadius);
    surfaceTemperature *= sizeEffect;

    return surfaceTemperature - 273.15; // Convert from Kelvin to Celsius for readability
}


function getPlanetAlbedo(atmosphereType) {
    // Adjust albedo based on atmosphere type; different atmospheres reflect sunlight differently
    const albedoAdjustments = {
        'trace': 0.11,
        'carbon_dioxide_type_I': 0.25,
        'carbon_dioxide_type_II': 0.29,
        'hydrogen_helium_type_I': 0.20,
        'hydrogen_helium_type_II': 0.20,
        'hydrogen_helium_type_III': 0.25,
        'ice_type_I': 0.50,
        'ice_type_II': 0.50,
        'nitrogen_type_I': 0.30,
        'nitrogen_type_II': 0.30,
        'nitrogen_type_III': 0.20,
        'carbon_type_1': 0.30,
        'ammonia_type_1': 0.30,
        // Add more types as needed
    };
    return albedoAdjustments[atmosphereType] || 0.3; // Default to Earth-like albedo if unknown
}

function calculateGreenhouseFactor(atmosphereType) {
    // Refine greenhouse factor based on atmosphere composition
    const greenhouseAdjustments = {
        'trace': 1.0,
        'carbon_dioxide_type_I': 1.25,
        'carbon_dioxide_type_II': 1.30,
        'hydrogen_helium_type_I': 1.10,
        'hydrogen_helium_type_II': 1.10,
        'hydrogen_helium_type_III': 1.40,
        'ice_type_I': 1.20,
        'ice_type_II': 1.17,
        'nitrogen_type_I': 1.10,
        'nitrogen_type_II': 1.10,
        'nitrogen_type_III': 1.20,
        'carbon_type_1': 1.50,
        'ammonia_type_1': 1.40,
    };
    return greenhouseAdjustments[atmosphereType] || 1.1; // Default factor if unknown
}

function calculateSizeEffect(planetRadiusEarthUnits) {
    // Larger planets might have thicker atmospheres and retain heat more effectively
    if (planetRadiusEarthUnits < 1) {
        return 0.95; // Smaller planets lose heat more easily
    } else if (planetRadiusEarthUnits > 1 && planetRadiusEarthUnits < 2) {
        return 1.05; // Moderate increase for slightly larger planets
    } else {
        return 1.1; // Significant heat retention for much larger planets
    }
}

  export { getAtmosphereDetailsForDisplay };