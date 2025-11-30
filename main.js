import { initCesium, viewer } from './cesium.js';
import { Constellation, setupSatelliteClick } from './sat.js';
import { spawnAirborneTerminals, updateUTMovement } from './ut.js';
import { setupToolbar, setupUTToggle } from './ui.js';
import { setupClickSound } from './sound.js';

// Cesium initialization
initCesium();

// Click sound
setupClickSound();

// UI setup
setupToolbar();
setupUTToggle();

// Constellation manager
const constellation = new Constellation(viewer);

// Generate constellation
document.getElementById("btnGenerate").addEventListener("click", async () => {
    const selected = document.getElementById("constellationSelect").value;
    if (constellation.highlightedOrbit) viewer.entities.remove(constellation.highlightedOrbit);
    constellation.clearAll();
    document.getElementById("satInfo").innerText = "Click a satellite for info";
    document.getElementById("status").innerText = `Loading ${selected}...`;
    await constellation.loadSelected(selected);
    viewer.trackedEntity = constellation.satellites[0]?.entity || null;
});

// Satellite click
setupSatelliteClick(viewer, constellation);

// Airborne UTs
spawnAirborneTerminals(viewer);

// Clock tick updates
viewer.clock.onTick.addEventListener(clock => {
    const currentDate = Cesium.JulianDate.toDate(clock.currentTime);

    // Satellite updates
    constellation.updateAll(currentDate);
    if (constellation.highlightedOrbit) constellation.updateHighlightedInfo(viewer, currentDate);

    // UT movement only if visible
    updateUTMovement(clock, viewer);
});
