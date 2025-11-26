import { playUTClickSound } from './sound.js';

export const userTerminals = [];
export const DEFAULT_AIRBORNE_UT = 12;
export const DEFAULT_MARITIME_UT = 8;

let utVisible = false;
export let selectedUT = null;
export function isUTVisible() {
    return utVisible;
}

function randomAirbornePosition() {
    const lat = (Math.random() * 180) - 90;
    const lon = (Math.random() * 360) - 180;
    const altitude = 11000; // meters
    return Cesium.Cartesian3.fromDegrees(lon, lat, altitude);
}

function randomMaritimePosition() {
    const lat = (Math.random() * 120) - 60; // keep ships away from poles
    const lon = (Math.random() * 360) - 180;
    const altitude = 20; // near sea level
    return Cesium.Cartesian3.fromDegrees(lon, lat, altitude);
}

function createUTEntity(id, type, viewer, position, source = "simulated") {
    const isMaritime = type === "maritime";
    const color = isMaritime ? Cesium.Color.CYAN : Cesium.Color.ORANGE;
    const outline = isMaritime ? Cesium.Color.DARKBLUE : Cesium.Color.BLACK;

    return viewer.entities.add({
        id: `UT_${type}_${id}`,
        name: `${isMaritime ? "Maritime" : "Airborne"} UT ${id}`,
        position,
        point: {
            pixelSize: 10,
            color,
            outlineColor: outline,
            outlineWidth: 1
        },
        isUserTerminal: true,
        userTerminalType: type,
        trackSource: source,
        velocity: Cesium.Cartesian3.ZERO,
        show: utVisible
    });
}

export function spawnAirborneTerminals(viewer, count = DEFAULT_AIRBORNE_UT) {
    for (let i = 0; i < count; i++) {
        const ut = createUTEntity(i + 1, "airborne", viewer, randomAirbornePosition());
        userTerminals.push(ut);
    }
}

export function spawnMaritimeTerminals(viewer, count = DEFAULT_MARITIME_UT) {
    for (let i = 0; i < count; i++) {
        const ut = createUTEntity(i + 1, "maritime", viewer, randomMaritimePosition());
        userTerminals.push(ut);
    }
}

// Allow feeding real AIS/flight tracks into the globe (tracks: [{lat, lon, alt, id?, source?}])
export function seedUTsFromTracks(tracks, type, viewer) {
    if (!Array.isArray(tracks) || !viewer) return [];

    const seeded = [];
    tracks.forEach((track, idx) => {
        const lat = track.lat ?? track.latitude;
        const lon = track.lon ?? track.longitude;
        if (lat === undefined || lon === undefined) return;

        const alt = track.alt ?? track.altitude ?? (type === "airborne" ? 11000 : 20);
        const pos = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
        const ut = createUTEntity(track.id || `${type}-track-${idx + 1}`, type, viewer, pos, track.source || "feed");
        ut.show = utVisible;
        userTerminals.push(ut);
        seeded.push(ut);
    });

    return seeded;
}

export function updateUTMovement(clock) {
    for (let ut of userTerminals) {
        if (!ut.show) continue;

        const pos = ut.position.getValue(clock.currentTime);
        if (!pos) continue;

        const carto = Cesium.Cartographic.fromCartesian(pos);
        const isMaritime = ut.userTerminalType === "maritime";

        const lonStep = isMaritime ? 0.0006 : 0.0025;
        const latStep = isMaritime ? 0.0004 : 0.0015;
        const newLongitude = carto.longitude + Cesium.Math.toRadians(lonStep);
        const newLatitude = carto.latitude + Cesium.Math.toRadians((Math.random() - 0.5) * latStep);
        const newAltitude = isMaritime ? 20 : 11000;

        const newPos = Cesium.Cartesian3.fromRadians(newLongitude, newLatitude, newAltitude);
        const vel = Cesium.Cartesian3.subtract(newPos, pos, new Cesium.Cartesian3());

        ut.position = new Cesium.ConstantPositionProperty(newPos);
        ut.velocity = vel;
    }
}

export function toggleUTVisibility() {
    utVisible = !utVisible;
    for (let ut of userTerminals) {
        ut.show = utVisible;
    }
    if (!utVisible) {
        selectedUT = null;
    }
    return utVisible;
}

export function updateUTCounter() {
    const counter = document.getElementById("utCount");
    if (!counter) return;

    const air = userTerminals.filter(u => u.userTerminalType === "airborne").length;
    const sea = userTerminals.filter(u => u.userTerminalType === "maritime").length;
    counter.textContent = `Airborne: ${air} | Maritime: ${sea}`;
}

function cartesianToGeo(pos) {
    const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos);
    return {
        lon: Cesium.Math.toDegrees(carto.longitude).toFixed(2),
        lat: Cesium.Math.toDegrees(carto.latitude).toFixed(2),
        altKm: (carto.height / 1000).toFixed(2)
    };
}

function speedFromVelocity(ut) {
    const speed = Cesium.Cartesian3.magnitude(ut.velocity || Cesium.Cartesian3.ZERO);
    return (speed * 3.6).toFixed(1); // m/s to km/h
}

export function nearestSatelliteForUT(ut, constellation, currentTime) {
    if (!constellation?.satellites?.length || !ut?.position) return null;

    const utPos = ut.position.getValue(currentTime);
    if (!utPos) return null;

    let nearest = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    constellation.satellites.forEach(sat => {
        const satPos = sat.entity.position.getValue(currentTime);
        if (!satPos) return;
        const distance = Cesium.Cartesian3.distance(utPos, satPos) / 1000; // km
        if (distance < bestDistance) {
            bestDistance = distance;
            nearest = { id: sat.name, distanceKm: distance };
        }
    });

    return nearest;
}

export function describeUT(ut, clock, constellation) {
    if (!ut) return "UT unavailable";

    const pos = ut.position.getValue(clock.currentTime);
    if (!pos) return `${ut.name}: position unknown`;

    const geo = cartesianToGeo(pos);
    const speed = speedFromVelocity(ut);
    const nearest = nearestSatelliteForUT(ut, constellation, clock.currentTime);
    const visibility = ut.show ? "visible" : "hidden";
    const source = ut.trackSource ? `source ${ut.trackSource}` : "simulated";

    let line = `${ut.name} (${ut.userTerminalType}): ${visibility}, lat ${geo.lat} deg, lon ${geo.lon} deg, alt ${geo.altKm} km, speed ${speed} km/h, ${source}`;
    if (nearest) {
        line += `, nearest sat ${nearest.id} (${nearest.distanceKm.toFixed(1)} km)`;
    }

    return line;
}

export function setupUTClick(viewer, constellation) {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction(click => {
        const picked = viewer.scene.pick(click.position);
        const entity = picked?.id;
        if (!entity?.isUserTerminal) return;

        selectedUT = entity;
        playUTClickSound();

        const utPanel = document.getElementById("utInfo");
        if (utPanel) {
            utPanel.innerText = describeUT(entity, viewer.clock, constellation);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
