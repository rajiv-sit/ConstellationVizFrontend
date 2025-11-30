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

    viewer.scene.globe.enableLighting = true;
    loadImagery();

    // Clock settings
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    viewer.clock.multiplier = 1;
    viewer.clock.shouldAnimate = true;
}

async function loadImagery() {
    const layers = viewer.scene.globe.imageryLayers;
    layers.removeAll();

    try {
        layers.addImageryProvider(new Cesium.IonImageryProvider({ assetId: 3 }));
        console.log("✔ Cesium Ion imagery loaded");
        return;
    } catch (e) { console.warn("❌ Cesium Ion failed:", e); }

    try {
        layers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" }));
        console.log("✔ OpenStreetMap imagery loaded");
        return;
    } catch (e) { console.warn("❌ OpenStreetMap failed:", e); }

    console.error("❌ No imagery available. Earth will appear black.");
}
