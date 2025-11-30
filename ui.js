import { toggleUTVisibility, updateUTCounter, userTerminals } from './ut.js';
import { playClickSound } from './sound.js';
import { viewer } from './cesium.js';

// Toolbar collapse
export function setupToolbar() {
    const toggleBtn = document.getElementById("toggleToolbar");
    const toolbarContent = document.getElementById("toolbarContent");
    toggleBtn.addEventListener("click", () => {
        toolbarContent.classList.toggle("collapsed");
        toggleBtn.textContent = toolbarContent.classList.contains("collapsed") ? "+" : "–";
    });
}

// UT toggle button
export function setupUTToggle() {
    const utButton = document.getElementById("toggleUTs");

    // Initialize button text based on initial visibility
    utButton.textContent = "Show UTs";

    utButton.addEventListener("click", () => {
        const visible = toggleUTVisibility(); // toggle UTs
        updateUTCounter();                     // update counter
        updateUTInfo();                        // update info panel
        playClickSound();                      // optional sound
        utButton.textContent = visible ? "Hide UTs" : "Show UTs"; // sync button text
    });
}

// Update UT info display
export function updateUTInfo() {
    const utInfo = userTerminals.map((ut, idx) => {
        const pos = ut.position.getValue(viewer.clock.currentTime);
        if (!pos) return `UT_${idx + 1}: position unknown`;

        const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(pos);
        const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(2);
        const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(2);
        const alt = (carto.height / 1000).toFixed(2);

        return `UT_${idx + 1}: Lat ${lat}°, Lon ${lon}°, Alt ${alt} km`;
    }).join('\n');

    document.getElementById("satInfo").innerText = utInfo;
}
