// ============================================================
//  Cesium Initialization
// ============================================================

Cesium.Ion.defaultAccessToken =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4MDA1MmYwYS04MThlLTQxZDItYTgyNC01MjYxNTllZjhiMzQiLCJpZCI6MzYyOTI3LCJpYXQiOjE3NjQxNjcwMTh9.mJEckpxKR3pFzNT8jzK5wU5qMl-lpUfs5H9LHp4IYDU";

let prevPos = null;
let prevTime = null;

const viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    imageryProvider: false,
    sceneMode: Cesium.SceneMode.SCENE3D
});

viewer.scene.globe.enableLighting = true;

// ============================================================
//  Imagery Loader with Fallback to OpenStreetMap
// ============================================================

async function loadImagery() {
    const layers = viewer.scene.globe.imageryLayers;
    layers.removeAll();

    try {
        layers.addImageryProvider(new Cesium.IonImageryProvider({ assetId: 3 }));
        console.log("✔ Cesium Ion imagery loaded");
        return;
    } catch (e) { console.warn("❌ Cesium Ion failed:", e); }

    try {
        layers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({
                url: "https://a.tile.openstreetmap.org/"
            })
        );
        console.log("✔ OpenStreetMap imagery loaded");
        return;
    } catch (e) { console.warn("❌ OpenStreetMap failed:", e); }

    console.error("❌ No imagery available. Earth will appear black.");
}

loadImagery();

// ============================================================
//  Toolbar Collapse
// ============================================================

const toggleBtn = document.getElementById("toggleToolbar");
const toolbarContent = document.getElementById("toolbarContent");
toggleBtn.addEventListener("click", () => {
    toolbarContent.classList.toggle("collapsed");
    toggleBtn.textContent = toolbarContent.classList.contains("collapsed") ? "+" : "–";
});

// ============================================================
//  Click Sound
// ============================================================

const clickSound = new Audio("button-11.wav");
clickSound.volume = 0.25;
let lastClickTime = 0;
const CLICK_COOLDOWN = 120;

// ============================================================
//  Satellite Base Class
// ============================================================

class Satellite {
    constructor(name, tle1, tle2) {
        this.name = name;
        this.tle1 = tle1;
        this.tle2 = tle2;

        this.satrec = satellite.twoline2satrec(tle1, tle2);
        this.entity = null;
        this.customOrbit = [];
    }

    computeOrbit(minutes = 90, startTime = new Date()) {
        this.customOrbit = [];

        for (let m = 0; m <= minutes; m++) {
            const date = new Date(startTime.getTime() + m * 60000);
            const eci = satellite.propagate(this.satrec, date);
            if (!eci.position) continue;

            const gmst = satellite.gstime(date);
            const geo = satellite.eciToGeodetic(eci.position, gmst);

            const cart = Cesium.Cartesian3.fromDegrees(
                Cesium.Math.toDegrees(geo.longitude),
                Cesium.Math.toDegrees(geo.latitude),
                geo.height * 1000
            );
            this.customOrbit.push(cart);
        }
    }

    addToViewer(viewer) {
        this.entity = viewer.entities.add({
            id: this.name,
            name: this.name,
            point: {
                color: Cesium.Color.RED,
                pixelSize: 6
            },
            label: {
                text: this.name,
                font: "12px sans-serif",
                fillColor: Cesium.Color.WHITE,
                scaleByDistance: new Cesium.NearFarScalar(5e6, 1.3, 2e7, 0.4)
            },
            customOrbit: this.customOrbit,
            userData: { satrec: this.satrec },
			isMySatellite: true
        });
    }

    updatePosition(currentDate) {
        const eci = satellite.propagate(this.satrec, currentDate);
        if (!eci.position || !this.entity) return;

        const gmst = satellite.gstime(currentDate);
        const geo = satellite.eciToGeodetic(eci.position, gmst);

        const cart = Cesium.Cartesian3.fromDegrees(
            Cesium.Math.toDegrees(geo.longitude),
            Cesium.Math.toDegrees(geo.latitude),
            geo.height * 1000
        );

        this.entity.position = new Cesium.ConstantPositionProperty(cart);
    }
}

// ============================================================
//  Specialized Classes
// ============================================================

class KuiperSatellite extends Satellite {
    computeOrbit(minutes = 90) {
        const epoch = satellite.jdayToDate(
            this.satrec.jdsatepoch,
            this.satrec.jdsatepochF
        );
        super.computeOrbit(minutes, epoch);
    }
}

class StarlinkSatellite extends Satellite {}

// ============================================================
//  Constellation Manager
// ============================================================

class Constellation {
    constructor(viewer) {
        this.viewer = viewer;
        this.satellites = [];
    }

    async loadFromTLE(url, SatelliteClass) {
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.split("\n").filter(l => l.trim() !== "");

        for (let i = 0; i < lines.length; i += 3) {
            const sat = new SatelliteClass(
                lines[i].trim(),
                lines[i + 1].trim(),
                lines[i + 2].trim()
            );

            sat.computeOrbit();
            sat.addToViewer(this.viewer);
            this.satellites.push(sat);
        }
    }

    updateAll(currentDate) {
        this.satellites.forEach(sat => sat.updatePosition(currentDate));
    }

    clearAll() {
        this.satellites.forEach(s => this.viewer.entities.remove(s.entity));
        this.satellites = [];
    }
}

// ============================================================
// Click Handler — Play Sound Only for Satellites
// ============================================================

let highlightedOrbit = null;

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

handler.setInputAction(click => {
    const picked = viewer.scene.pick(click.position);
    const entity = picked?.id || null;

    // If nothing picked or it's not our satellite, remove highlight
    if (!entity?.isMySatellite) {
        if (highlightedOrbit) {
            viewer.entities.remove(highlightedOrbit);
            highlightedOrbit = null;
        }
        return;
    }

    // Check if this entity is now selected by Cesium (green bounding box)
    if (viewer.selectedEntity !== entity) {
        // Not selected → skip sound
        return;
    }

    // ---------------------------------------
    // ✔ VALID SATELLITE CLICKED → play sound
    // ---------------------------------------
    const now = Date.now();
    if (now - lastClickTime > CLICK_COOLDOWN) {
        lastClickTime = now;
        clickSound.currentTime = 0;
        clickSound.play();
    }

    // Remove previous orbit highlight if any
    if (highlightedOrbit) {
        viewer.entities.remove(highlightedOrbit);
    }

    // Highlight orbit
    highlightedOrbit = viewer.entities.add({
        polyline: {
            positions: entity.customOrbit,
            width: 2,
            material: Cesium.Color.CYAN,
            clampToGround: false
        },
        satelliteId: entity.id
    });
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ============================================================
//  UI: Load Selected Constellation
// ============================================================

const constellation = new Constellation(viewer);

document.getElementById("btnGenerate").addEventListener("click", async () => {

    if (highlightedOrbit) {
        viewer.entities.remove(highlightedOrbit);
        highlightedOrbit = null;
    }

    constellation.clearAll();

    const selected = document.getElementById("constellationSelect").value;

    let url = "";
    let Class = Satellite;

    if (selected === "Starlink") {
        url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";
        Class = StarlinkSatellite;
    } else if (selected === "Kuiper") {
        url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=kuiper&FORMAT=tle";
        //Class = KuiperSatellite;
    } else if (selected === "GPS") {
        url = "https://celestrak.org/NORAD/elements/gps-ops.txt";
    } else if (selected === "Galileo") {
        url = "https://celestrak.org/NORAD/elements/galileo.txt";
    } else if (selected === "GLONASS") {
        url = "https://celestrak.org/NORAD/elements/glo-ops.txt";
    }

    document.getElementById("status").innerText = "Loading TLEs...";
    await constellation.loadFromTLE(url, Class);

    document.getElementById("status").innerText =
        `${selected} loaded — ${constellation.satellites.length} satellites`;
		
	document.getElementById("satInfo").innerText =
		"Click a satellite for info";

    viewer.trackedEntity = constellation.satellites[0]?.entity || null;
});

// ============================================================
//  Clock — Real-Time Earth Rotation
// ============================================================

viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
viewer.clock.multiplier = 1;   // FIX: real-time day/night
viewer.clock.shouldAnimate = true;

// ============================================================
//  On Tick — Update Satellite Positions + Info
// ============================================================

viewer.clock.onTick.addEventListener(clock => {
    const currentDate = Cesium.JulianDate.toDate(clock.currentTime);
    constellation.updateAll(currentDate);

    if (!highlightedOrbit || !highlightedOrbit.satelliteId) return;

    const sat = constellation.satellites
        .find(s => s.entity.id === highlightedOrbit.satelliteId);

    if (!sat) return;

    const pos = sat.entity.position.getValue(clock.currentTime);
    if (!pos) return;

    const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos);
    const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(2);
    const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(2);
    const alt = (carto.height / 1000).toFixed(2);

    // ------------------------------------------------------------------
    // SPEED CALCULATION (km/h)
    // ------------------------------------------------------------------
    let speedKmh = 0;
    const now = currentDate.getTime();

    if (prevPos && prevTime) {
        const distanceMeters = Cesium.Cartesian3.distance(prevPos, pos);
        const dtHours = (now - prevTime) / (1000 * 3600);

        if (dtHours > 0) {
            speedKmh = (distanceMeters / 1000) / dtHours;
        }
    }

    prevPos = Cesium.Cartesian3.clone(pos);
    prevTime = now;

    document.getElementById("satInfo").innerText =
        `ID: ${sat.name}\n` +
        `Longitude: ${lon}°\n` +
        `Latitude: ${lat}°\n` +
        `Altitude: ${alt} km\n` +
        `Speed: ${speedKmh.toFixed(2)} km/h`;
});
