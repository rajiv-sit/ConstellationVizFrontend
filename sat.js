// -------------------------------------------------------
// Satellite Module
// -------------------------------------------------------
import { playClickSound } from './sound.js';

// ==================== Satellite Classes ====================

export class Satellite {
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
            point: { color: Cesium.Color.RED, pixelSize: 6 },
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

export class KuiperSatellite extends Satellite {
    computeOrbit(minutes = 90) {
        const epoch = satellite.jdayToDate(
            this.satrec.jdsatepoch,
            this.satrec.jdsatepochF
        );
        super.computeOrbit(minutes, epoch);
    }
}

export class StarlinkSatellite extends Satellite {}

// ==================== Constellation Manager ====================

export class Constellation {
    constructor(viewer) {
        this.viewer = viewer;
        this.satellites = [];
        this.prevPos = null;
        this.prevTime = null;
        this.highlightedOrbit = null;
    }

    async loadFromTLE(url, SatelliteClass) {
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.split("\n").filter(l => l.trim() !== "");

        this.clearAll(); // Clear satellites + orbit history

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

    async loadSelected(selected) {
        let url = "";
        let Class = Satellite;

        switch (selected) {
            case "Starlink":
                url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";
                Class = StarlinkSatellite;
                break;
            case "Kuiper":
                url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=kuiper&FORMAT=tle";
                // Class = KuiperSatellite;
                break;
            case "GPS":
                url = "https://celestrak.org/NORAD/elements/gps-ops.txt";
                break;
            case "Galileo":
                url = "https://celestrak.org/NORAD/elements/galileo.txt";
                break;
            case "GLONASS":
                url = "https://celestrak.org/NORAD/elements/glo-ops.txt";
                break;
            default:
                console.error("Unknown constellation:", selected);
                return;
        }

        document.getElementById("status").innerText = `Loading ${selected}...`;
        document.getElementById("satInfo").innerText = "Click a satellite for info";

        await this.loadFromTLE(url, Class);

        document.getElementById("status").innerText =
            `${selected} loaded — ${this.satellites.length} satellites`;

        this.viewer.trackedEntity = this.satellites[0]?.entity || null;
    }

    updateAll(currentDate) {
        this.satellites.forEach(sat => sat.updatePosition(currentDate));
    }

    clearAll() {
        // Remove satellite entities
        this.satellites.forEach(s => this.viewer.entities.remove(s.entity));
        this.satellites = [];

        // Remove highlighted orbit
        if (this.highlightedOrbit) {
            this.viewer.entities.remove(this.highlightedOrbit);
            this.highlightedOrbit = null;
        }

        // Reset speed tracking
        this.prevPos = null;
        this.prevTime = null;
    }

    highlightSatellite(satellite) {
        // Remove previous highlight
        if (this.highlightedOrbit) {
            this.viewer.entities.remove(this.highlightedOrbit);
        }

        // Add new orbit polyline
        this.highlightedOrbit = this.viewer.entities.add({
            polyline: {
                positions: satellite.customOrbit,
                width: 2,
                material: Cesium.Color.CYAN,
                clampToGround: false
            },
            satelliteId: satellite.entity.id
        });

        // Reset speed tracking for highlighted
        this.prevPos = null;
        this.prevTime = null;
    }

    updateHighlightedInfo(viewer, currentDate) {
        if (!this.highlightedOrbit || !this.highlightedOrbit.satelliteId) return;

        const sat = this.satellites.find(s => s.entity.id === this.highlightedOrbit.satelliteId);
        if (!sat) return;

        const pos = sat.entity.position.getValue(viewer.clock.currentTime);
        if (!pos) return;

        const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos);
        const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(2);
        const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(2);
        const alt = (carto.height / 1000).toFixed(2);

        let speedKmh = 0;
        const now = currentDate.getTime();
        if (this.prevPos && this.prevTime) {
            const distanceMeters = Cesium.Cartesian3.distance(this.prevPos, pos);
            const dtHours = (now - this.prevTime) / (1000 * 3600);
            if (dtHours > 0) speedKmh = (distanceMeters / 1000) / dtHours;
        }

        this.prevPos = Cesium.Cartesian3.clone(pos);
        this.prevTime = now;

        document.getElementById("satInfo").innerText =
            `ID: ${sat.name}\nLongitude: ${lon}°\nLatitude: ${lat}°\nAltitude: ${alt} km\nSpeed: ${speedKmh.toFixed(2)} km/h`;
    }
}

// ==================== Satellite Click Handling ====================

export function setupSatelliteClick(viewer, constellation) {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction(click => {
        const picked = viewer.scene.pick(click.position);
        const entity = picked?.id || null;

        if (!entity?.isMySatellite) {
            // Remove orbit if clicked outside
            if (constellation.highlightedOrbit) {
                viewer.entities.remove(constellation.highlightedOrbit);
                constellation.highlightedOrbit = null;
            }
            constellation.prevPos = null;
            constellation.prevTime = null;
            return;
        }

        const sat = constellation.satellites.find(s => s.entity.id === entity.id);
        if (!sat) return;

        playClickSound();

        // Highlight this satellite
        constellation.highlightSatellite(sat);

        // Immediately update info
        constellation.updateHighlightedInfo(viewer, new Date());
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
