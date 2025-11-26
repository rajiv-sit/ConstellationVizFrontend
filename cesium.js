export let viewer;

export function initCesium() {
    Cesium.Ion.defaultAccessToken = "YOUR_TOKEN_HERE";

    viewer = new Cesium.Viewer("cesiumContainer", {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        imageryProvider: false,
        sceneMode: Cesium.SceneMode.SCENE3D
    });

    const globe = viewer.scene.globe;
    globe.enableLighting = true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.showGroundAtmosphere = true;

    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.sun.show = true;
    viewer.scene.moon.show = true;
    viewer.scene.light = new Cesium.SunLight();
    viewer.shadows = true;
    viewer.terrainShadows = Cesium.ShadowMode.RECEIVE_ONLY;

    loadImagery();

    // Clock settings (real-time spin)
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    viewer.clock.multiplier = 1;
    viewer.clock.shouldAnimate = true;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
}

async function loadImagery() {
    const layers = viewer.scene.globe.imageryLayers;
    layers.removeAll();

    try {
        layers.addImageryProvider(new Cesium.IonImageryProvider({ assetId: 3 }));
        console.log("Cesium Ion imagery loaded");
        return;
    } catch (e) {
        console.warn("Cesium Ion failed:", e);
    }

    try {
        layers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" }));
        console.log("OpenStreetMap imagery loaded");
        return;
    } catch (e) {
        console.warn("OpenStreetMap failed:", e);
    }

    console.error("No imagery available. Earth will appear black.");
}
