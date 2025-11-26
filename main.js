Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4MDA1MmYwYS04MThlLTQxZDItYTgyNC01MjYxNTllZjhiMzQiLCJpZCI6MzYyOTI3LCJpYXQiOjE3NjQxNjcwMTh9.mJEckpxKR3pFzNT8jzK5wU5qMl-lpUfs5H9LHp4IYDU";

// Create viewer WITHOUT default imagery
const viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    imageryProvider: false, // Start without any base layer
    sceneMode: Cesium.SceneMode.SCENE3D
});

viewer.scene.globe.enableLighting = true;

// Load imagery with fallback
async function loadImagery() {
    const layers = viewer.scene.globe.imageryLayers;
    layers.removeAll();

    // 1️⃣ Cesium Ion imagery
    try {
        layers.addImageryProvider(new Cesium.IonImageryProvider({ assetId: 3 }));
        console.log("✔ Cesium Ion imagery loaded");
        return;
    } catch (e) {
        console.warn("❌ Cesium Ion failed:", e);
    }

    // 2️⃣ OpenStreetMap fallback
    try {
        layers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({
            url: "https://a.tile.openstreetmap.org/"
        }));
        console.log("✔ OpenStreetMap imagery loaded");
        return;
    } catch (e) {
        console.warn("❌ OpenStreetMap failed:", e);
    }

    console.error("❌ No imagery loaded. Earth will be black.");
}

loadImagery();

// ------------------------------
// Collapsible toolbar
// ------------------------------
const toggleBtn = document.getElementById("toggleToolbar");
const toolbarContent = document.getElementById("toolbarContent");
toggleBtn.addEventListener("click", () => {
    toolbarContent.classList.toggle("collapsed");
    toggleBtn.textContent = toolbarContent.classList.contains("collapsed") ? "+" : "–";
});

// ------------------------------
// Click sound
// ------------------------------
const clickSound = new Audio("https://www.soundjay.com/button/beep-07.wav");
clickSound.volume = 0.2;
let lastClickTime = 0;
const CLICK_COOLDOWN = 100;

// ------------------------------
// Satellite storage
// ------------------------------
let activeSatellites = [];
let highlightedOrbit = null;

// ------------------------------
// Clear satellites
// ------------------------------
function clearSatellites() {
    activeSatellites.forEach(s => viewer.entities.remove(s));
    activeSatellites = [];
    if (highlightedOrbit) {
        viewer.entities.remove(highlightedOrbit);
        highlightedOrbit = null;
    }
    document.getElementById("satInfo").innerText = "Click a satellite for info";
}

// ------------------------------
// Fetch TLEs from CelesTrak
// ------------------------------
async function fetchTLEs(constellation) {
    let url = "";
    switch (constellation) {
        case "GPS": url = "https://celestrak.org/NORAD/elements/gps-ops.txt"; break;
        case "Galileo": url = "https://celestrak.org/NORAD/elements/galileo.txt"; break;
        case "GLONASS": url = "https://celestrak.org/NORAD/elements/glo-ops.txt"; break;
        case "Starlink": url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"; break;
        case "Kuiper": url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=kuiper&FORMAT=tle"; break;
        default: return [];
    }

    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split("\n").filter(l => l.trim() !== "");
    const tleData = [];
    for (let i = 0; i < lines.length; i += 3) {
        tleData.push({
            name: lines[i].trim(),
            tle1: lines[i + 1].trim(),
            tle2: lines[i + 2].trim()
        });
    }
    return tleData;
}

// ------------------------------
// Generate satellites from TLE
// ------------------------------
async function generateConstellationFromTLE(constellation) {
    clearSatellites();
    document.getElementById("status").innerText = "Loading TLEs...";

    const tleData = await fetchTLEs(constellation);
    if (!tleData.length) {
        document.getElementById("status").innerText = "No TLE data found!";
        return;
    }

    for (const sat of tleData) {
        const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
        const positionsForOrbit = [];

        const startTime = new Date();

        for (let m = 0; m <= 90; m++) { // Precompute one orbit
            const date = new Date(startTime.getTime() + m * 60000);
            const eci = satellite.propagate(satrec, date);
            if (!eci.position) continue;

            const gmst = satellite.gstime(date);
            const geo = satellite.eciToGeodetic(eci.position, gmst);
            const cart = Cesium.Cartesian3.fromDegrees(
                Cesium.Math.toDegrees(geo.longitude),
                Cesium.Math.toDegrees(geo.latitude),
                geo.height * 1000
            );
            positionsForOrbit.push(cart);
        }

        const entity = viewer.entities.add({
            id: sat.name,
            name: sat.name,
            point: { color: Cesium.Color.RED, pixelSize: 6 },
            label: {
                text: sat.name,
                font: "12px sans-serif",
                fillColor: Cesium.Color.WHITE,
                scaleByDistance: new Cesium.NearFarScalar(5000000, 1.5, 15000000, 0.5)
            },
            customOrbit: positionsForOrbit,
            userData: { satrec }
        });
        activeSatellites.push(entity);
    }

    viewer.trackedEntity = activeSatellites[0] || null;
    document.getElementById("status").innerText = `${constellation} loaded! ${activeSatellites.length} satellites`;
}

// ------------------------------
// Click handler: highlight orbit & track satellite
// ------------------------------
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction(function(click) {
    const now = Date.now();
    if (now - lastClickTime > CLICK_COOLDOWN) {
        lastClickTime = now;
        clickSound.currentTime = 0;
        clickSound.play();
    }

    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id) {
        const sat = picked.id;

        if (highlightedOrbit) viewer.entities.remove(highlightedOrbit);

        highlightedOrbit = viewer.entities.add({
            polyline: {
                positions: sat.customOrbit,
                width: 2,
                material: Cesium.Color.CYAN,
                followSurface: false
            },
            satelliteId: sat.id
        });
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ------------------------------
// Update all satellites' positions dynamically
// ------------------------------
viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
viewer.clock.multiplier = 60;
viewer.clock.shouldAnimate = true;

viewer.clock.onTick.addEventListener(function(clock) {
    const currentDate = Cesium.JulianDate.toDate(clock.currentTime);

    activeSatellites.forEach(sat => {
        const satrec = sat.userData.satrec;
        const eci = satellite.propagate(satrec, currentDate);
        if (!eci.position) return;

        const gmst = satellite.gstime(currentDate);
        const geo = satellite.eciToGeodetic(eci.position, gmst);
        const cart = Cesium.Cartesian3.fromDegrees(
            Cesium.Math.toDegrees(geo.longitude),
            Cesium.Math.toDegrees(geo.latitude),
            geo.height * 1000
        );
        sat.position = new Cesium.ConstantPositionProperty(cart);

    });

    if (highlightedOrbit && highlightedOrbit.satelliteId) {
        const sat = activeSatellites.find(s => s.id === highlightedOrbit.satelliteId);
        if (!sat) return;

        const pos = sat.position.getValue(clock.currentTime);
        if (!pos) return;

        const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos);
        const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(2);
        const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(2);
        const alt = (carto.height / 1000).toFixed(2);

        const nextDate = new Date(currentDate.getTime() + 1000);
        const nextEci = satellite.propagate(sat.userData.satrec, nextDate);
        let vel = 0;
        if (nextEci.position) {
            const gmstNext = satellite.gstime(nextDate);
            const geoNext = satellite.eciToGeodetic(nextEci.position, gmstNext);
            const nextCart = Cesium.Cartesian3.fromDegrees(
                Cesium.Math.toDegrees(geoNext.longitude),
                Cesium.Math.toDegrees(geoNext.latitude),
                geoNext.height * 1000
            );
            const dx = nextCart.x - pos.x;
            const dy = nextCart.y - pos.y;
            const dz = nextCart.z - pos.z;
            vel = Math.sqrt(dx*dx + dy*dy + dz*dz);
        }

        document.getElementById("satInfo").innerText =
            `ID: ${sat.id}\nLongitude: ${lon}°\nLatitude: ${lat}°\nAltitude: ${alt} km\nVelocity: ${vel.toFixed(2)} m/s`;
    }
});

// ------------------------------
// UI Handling
// ------------------------------
document.getElementById("btnGenerate").addEventListener("click", () => {
    const constellation = document.getElementById("constellationSelect").value;
    generateConstellationFromTLE(constellation);
});

