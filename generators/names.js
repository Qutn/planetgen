function generatePlanetName(systemNumber, planetIndex, atmosphereType, geologicalActivity, moonCount) {
    const bodyType = 'P'; // 'P' for planet
    atmosphereType = atmosphereType || getRandomAtmosphereType();
    geologicalActivity = geologicalActivity || getRandomGeologicalActivity();
    moonCount = moonCount || getRandomMoonCount();

    return `${bodyType}-${systemNumber}-${planetIndex}-${atmosphereType}-${geologicalActivity}-${moonCount}`;
}

function getRandomAtmosphereType() {
    // Placeholder function for atmosphere type
    const types = ['M', 'O', 'K', 'L']; // Example types
    return types[Math.floor(Math.random() * types.length)];
}

function getRandomGeologicalActivity() {
    // Placeholder function for geological activity
    const activities = ['None', 'Active', 'Very Active'];
    return activities[Math.floor(Math.random() * activities.length)];
}

function getRandomMoonCount() {
    // Placeholder function for moon count
    return Math.floor(Math.random() * 5); // Random number of moons up to 4
}

export { generatePlanetName };
