const landingStations = {
  Starlink: [
    { name: "Hawthorne, USA", lat: 33.9207, lon: -118.3278 },
    { name: "Redmond, USA", lat: 47.6740, lon: -122.1215 },
    { name: "Seattle, USA", lat: 47.6062, lon: -122.3321 },
    { name: "Boca Chica, USA", lat: 25.9972, lon: -97.1566 },
    { name: "Kourou, FRA", lat: 5.2360, lon: -52.7680 }
  ],
  Kuiper: [
    { name: "Redmond, USA", lat: 47.6740, lon: -122.1215 },
    { name: "Cape Canaveral, USA", lat: 28.3968, lon: -80.6057 },
    { name: "Bangalore, IND", lat: 12.9716, lon: 77.5946 },
    { name: "Paris, FRA", lat: 48.8566, lon: 2.3522 }
  ],
  Galileo: [
    { name: "Oberpfaffenhofen, DEU", lat: 48.0810, lon: 11.2779 },
    { name: "Fucino, ITA", lat: 41.9656, lon: 13.5600 },
    { name: "Kourou, FRA", lat: 5.2360, lon: -52.7680 }
  ],
  GPS: [
    { name: "Colorado Springs, USA", lat: 38.8339, lon: -104.8214 },
    { name: "Ascension Island", lat: -7.9467, lon: -14.3559 },
    { name: "Kwajalein, MHL", lat: 9.1890, lon: 167.4200 }
  ],
  GLONASS: [
    { name: "St. Petersburg, RUS", lat: 59.9311, lon: 30.3609 },
    { name: "Moscow, RUS", lat: 55.7558, lon: 37.6173 },
    { name: "Khabarovsk, RUS", lat: 48.4808, lon: 135.0928 }
  ]
};

let landingEntities = [];
let landingVisible = false;

export function clearLandingStations(viewer) {
  landingEntities.forEach(e => viewer.entities.remove(e));
  landingEntities = [];
}

export function landingVisibleState() {
  return landingVisible;
}

export function setLandingVisibility(show) {
  landingVisible = show;
}

export function getLandingSites(constellationName) {
  return landingStations[constellationName] || [];
}

function applyLandingStations(viewer, constellationName, shouldShow) {
  clearLandingStations(viewer);
  landingVisible = shouldShow;
  if (!shouldShow) return landingVisible;

  const sites = landingStations[constellationName] || [];
  sites.forEach((site, idx) => {
    const entity = viewer.entities.add({
      id: `LS_${constellationName}_${idx}`,
      name: `Landing Station - ${site.name}`,
      position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 0),
      point: {
        pixelSize: 10,
        color: Cesium.Color.GREEN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1
      },
      label: {
        text: site.name,
        font: "12px sans-serif",
        fillColor: Cesium.Color.CHARTREUSE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.6),
        pixelOffset: new Cesium.Cartesian2(0, -12),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1e6, 1.2, 8e6, 0.2),
        translucencyByDistance: new Cesium.NearFarScalar(1e6, 1.0, 8e6, 0.2)
      },
      isLandingStation: true
    });
    landingEntities.push(entity);
  });

  return landingVisible;
}

export function toggleLandingStations(viewer, constellationName) {
  return applyLandingStations(viewer, constellationName, !landingVisible);
}

export function refreshLandingStations(viewer, constellationName) {
  return applyLandingStations(viewer, constellationName, landingVisible);
}
