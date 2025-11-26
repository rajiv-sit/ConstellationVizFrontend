import { initCesium, viewer } from './cesium.js';
import { Constellation, setupSatelliteClick } from './sat.js';
import {
    spawnAirborneTerminals,
    spawnMaritimeTerminals,
    updateUTMovement,
    seedUTsFromTracks,
    setupUTClick,
    updateUTCounter
} from './ut.js';
import {
    toggleLandingStations,
    clearLandingStations,
    landingVisibleState,
    refreshLandingStations
} from './lands.js';
import { setupToolbar, setupUTToggle, updateUTInfoPanel } from './ui.js';
import { setupClickSound } from './sound.js';

// Configurable endpoints if you want to pull real AIS/flight tracks.
// Expect JSON array of { lat, lon, alt?, id?, source? }.
const LIVE_TRACK_ENDPOINTS = {
    maritime: null, // e.g., "https://your-api.example.com/ais"
    airborne: null  // e.g., "https://your-api.example.com/flighttrack"
};

// Initialize Cesium
initCesium();

// Sound
setupClickSound();

// Constellation Manager
const constellation = new Constellation(viewer);

// UI
setupToolbar();
setupUTToggle(constellation);

// Load selected constellation
const generateBtn = document.getElementById("btnGenerate");
generateBtn.addEventListener("click", async () => {
    const selected = document.getElementById("constellationSelect").value;

    if (constellation.highlightedOrbit) {
        viewer.entities.remove(constellation.highlightedOrbit);
        constellation.highlightedOrbit = null;
    }
    clearLandingStations(viewer);

    constellation.clearAll();

    document.getElementById("satInfo").innerText = "Click a satellite for info";
    document.getElementById("status").innerText = `Loading ${selected}...`;

    await constellation.loadSelected(selected);
    // Refresh landing stations visibility for the selected constellation
    if (landingVisibleState()) {
        refreshLandingStations(viewer, selected);
    }

    viewer.trackedEntity = constellation.satellites[0]?.entity || null;
});

// Satellite click handling
setupSatelliteClick(viewer, constellation);

// UTs: spawn simulated airborne + maritime
spawnAirborneTerminals(viewer);
spawnMaritimeTerminals(viewer);
updateUTCounter();
setupUTClick(viewer, constellation);

// Landing stations toggle
const landingBtn = document.getElementById("toggleLanding");
landingBtn.addEventListener("click", () => {
    const selected = document.getElementById("constellationSelect").value;
    const visible = toggleLandingStations(viewer, selected);
    landingBtn.textContent = visible ? "Hide Landing Stations" : "Show Landing Stations";
});

// Optionally hydrate UTs from live endpoints
async function hydrateLiveUTs() {
    const types = Object.keys(LIVE_TRACK_ENDPOINTS);
    for (const type of types) {
        const url = LIVE_TRACK_ENDPOINTS[type];
        if (!url) continue;
        try {
            const response = await fetch(url);
            const data = await response.json();
            seedUTsFromTracks(data, type, viewer);
        } catch (e) {
            console.warn(`Unable to hydrate ${type} UTs from ${url}:`, e);
        }
    }
    updateUTCounter();
}

hydrateLiveUTs();

// Clock updates
viewer.clock.onTick.addEventListener(clock => {
    const currentDate = Cesium.JulianDate.toDate(clock.currentTime);

    // Satellites
    constellation.updateAll(currentDate);

    if (constellation.highlightedOrbit) {
        constellation.updateHighlightedInfo(viewer, currentDate);
    }

    // Update UT movement
    updateUTMovement(clock);

    // Update UT info panel only if visible
    const utPanelToggle = document.getElementById("toggleUTs");
    if (utPanelToggle && utPanelToggle.textContent === "Hide UTs") {
        updateUTInfoPanel(constellation);
    }
});
