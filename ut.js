// -------------------------------------------------------
// Airborne User Terminal Module
// -------------------------------------------------------

export const userTerminals = [];
export const NUM_AIRBORNE_UT = 10;
let utVisible = true;

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

// Spawn several UTs
export function spawnAirborneTerminals(viewer) {
    for (let i = 0; i < NUM_AIRBORNE_UT; i++) {
        const ut = createAirborneUT(i + 1, viewer);
        userTerminals.push(ut);
    }
    updateUTCounter();
}

// Update UT movement on every tick
export function updateUTMovement(clock, viewer) {
    for (let ut of userTerminals) {
        const pos = ut.position.getValue(clock.currentTime);
        if (!pos) continue;

        let carto = Cesium.Cartographic.fromCartesian(pos);

        // Move east + small drift
        carto.longitude += Cesium.Math.toRadians(0.02);
        carto.latitude += Cesium.Math.toRadians((Math.random() - 0.5) * 0.01);

        const newPos = Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            11000
        );

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
}

// Update UT counter in UI
export function updateUTCounter() {
    const counter = document.getElementById("utCount");
    if (counter) {
        counter.textContent = `Airborne UTs: ${userTerminals.length}`;
    }
}
