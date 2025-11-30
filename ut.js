// -------------------------------------------------------
// Airborne User Terminal Module
// -------------------------------------------------------
export const userTerminals = [];
export const NUM_AIRBORNE_UT = 15;
let utVisible = false; // start hidden

// Create one airborne UT
export function createAirborneUT(id, viewer) {
    const lat = (Math.random() * 180) - 90;
    const lon = (Math.random() * 360) - 180;
    const altitude = 11000; // 11 km

    const startPos = Cesium.Cartesian3.fromDegrees(lon, lat, altitude);

    const entity = viewer.entities.add({
        id: `UT_${id}`,
        name: `Airborne UT ${id}`,
        position: startPos,
        point: {
            pixelSize: 10,
            color: Cesium.Color.ORANGE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1
        },
        isUserTerminal: true,
        velocity: Cesium.Cartesian3.ZERO,
        show: utVisible
    });

    return entity;
}

// Spawn all UTs
export function spawnAirborneTerminals(viewer) {
    for (let i = 0; i < NUM_AIRBORNE_UT; i++) {
        const ut = createAirborneUT(i + 1, viewer);
        userTerminals.push(ut);
    }
}

// Update UT movement (only visible UTs)
export function updateUTMovement(clock, viewer) {
    for (let ut of userTerminals) {
        if (!ut.show) continue; // move only visible UTs

        const pos = ut.position.getValue(clock.currentTime);
        if (!pos) continue;

        const carto = Cesium.Cartographic.fromCartesian(pos);

        // slower movement than satellites
        const newLongitude = carto.longitude + Cesium.Math.toRadians(0.002);
        const newLatitude = carto.latitude + Cesium.Math.toRadians((Math.random() - 0.5) * 0.001);

        const newPos = Cesium.Cartesian3.fromRadians(newLongitude, newLatitude, 11000);
        const vel = Cesium.Cartesian3.subtract(newPos, pos, new Cesium.Cartesian3());

        ut.position = new Cesium.ConstantPositionProperty(newPos);
        ut.velocity = vel;
    }
}

// Toggle visibility of all UTs
export function toggleUTVisibility() {
    utVisible = !utVisible;
    for (let ut of userTerminals) {
        ut.show = utVisible;
    }
    return utVisible; // used to update button text
}

// Update UT counter in UI
export function updateUTCounter() {
    const counter = document.getElementById("utCount");
    if (counter) {
        counter.textContent = `Airborne UTs: ${userTerminals.length}`;
    }
}
