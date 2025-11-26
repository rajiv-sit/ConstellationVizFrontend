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
                fillColor: Cesium.Color.LIME,
                show: true,
                showBackground: true,
                backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.5),
                pixelOffset: new Cesium.Cartesian2(0, -12),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                eyeOffset: new Cesium.Cartesian3(0, 0, -20),
                scaleByDistance: new Cesium.NearFarScalar(3e5, 1.2, 2e6, 0.0),
                translucencyByDistance: new Cesium.NearFarScalar(3e5, 1.0, 2e6, 0.1),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 2000000.0)
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
        this.currentSat = null;
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
            `${selected} loaded - ${this.satellites.length} satellites`;

        this.viewer.trackedEntity = this.satellites[0]?.entity || null;
    }

    updateAll(currentDate) {
        this.satellites.forEach(sat => sat.updatePosition(currentDate));
    }

    clearAll() {
        // Remove satellite entities
        this.satellites.forEach(s => this.viewer.entities.remove(s.entity));
        this.satellites = [];

        // Remove highlighted orbit and reset label
        if (this.highlightedOrbit) {
            this.viewer.entities.remove(this.highlightedOrbit);
            this.highlightedOrbit = null;
        }
        if (this.currentSat?.entity?.label) {
            const lbl = this.currentSat.entity.label;
            lbl.show = true;
            lbl.text = this.currentSat.name;
            lbl.fillColor = Cesium.Color.LIME;
            lbl.backgroundColor = Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.5);
            lbl.scaleByDistance = new Cesium.NearFarScalar(3e5, 1.2, 2e6, 0.0);
            lbl.translucencyByDistance = new Cesium.NearFarScalar(3e5, 1.0, 2e6, 0.1);
            lbl.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0.0, 2000000.0);
        }
        this.currentSat = null;

        // Reset speed tracking
        this.prevPos = null;
        this.prevTime = null;
    }

    highlightSatellite(satellite) {
        // Remove previous highlight
        if (this.highlightedOrbit) {
            this.viewer.entities.remove(this.highlightedOrbit);
        }
        if (this.currentSat?.entity?.label) {
            const lbl = this.currentSat.entity.label;
            lbl.show = true;
            lbl.text = this.currentSat.name;
            lbl.fillColor = Cesium.Color.LIME;
            lbl.backgroundColor = Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.5);
            lbl.scaleByDistance = new Cesium.NearFarScalar(3e5, 1.2, 2e6, 0.0);
            lbl.translucencyByDistance = new Cesium.NearFarScalar(3e5, 1.0, 2e6, 0.1);
            lbl.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0.0, 2000000.0);
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
        this.currentSat = satellite;
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

        const labelText =
            `ID: ${sat.name}\nLon: ${lon} deg\nLat: ${lat} deg\nAlt: ${alt} km\nSpeed: ${speedKmh.toFixed(2)} km/h`;

        document.getElementById("satInfo").innerText = labelText;

        if (sat.entity?.label) {
            const lbl = sat.entity.label;
            lbl.show = true;
            lbl.text = labelText;
            lbl.fillColor = Cesium.Color.CYAN;
            lbl.showBackground = true;
            lbl.backgroundColor = Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.6);
            lbl.pixelOffset = new Cesium.Cartesian2(0, -12);
            lbl.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
            lbl.disableDepthTestDistance = Number.POSITIVE_INFINITY;
            lbl.scaleByDistance = undefined;
            lbl.translucencyByDistance = undefined;
            lbl.distanceDisplayCondition = undefined;
            lbl.eyeOffset = new Cesium.Cartesian3(0, 0, -30);
        }
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
            if (constellation.currentSat?.entity?.label) {
                const lbl = constellation.currentSat.entity.label;
                lbl.show = true;
                lbl.text = constellation.currentSat.name;
                lbl.fillColor = Cesium.Color.LIME;
                lbl.backgroundColor = Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.5);
                lbl.scaleByDistance = new Cesium.NearFarScalar(3e5, 1.2, 2e6, 0.0);
                lbl.translucencyByDistance = new Cesium.NearFarScalar(3e5, 1.0, 2e6, 0.1);
                lbl.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0.0, 2000000.0);
            }
            constellation.prevPos = null;
            constellation.prevTime = null;
            constellation.currentSat = null;
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
