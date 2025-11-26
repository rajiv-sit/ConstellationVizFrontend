import { toggleUTVisibility, updateUTCounter, describeUT, selectedUT, isUTVisible } from './ut.js';
import { playClickSound } from './sound.js';
import { viewer } from './cesium.js';

export function setupToolbar() {
    const toggleBtn = document.getElementById("toggleToolbar");
    const toolbarContent = document.getElementById("toolbarContent");
    toggleBtn.addEventListener("click", () => {
        toolbarContent.classList.toggle("collapsed");
        toggleBtn.textContent = toolbarContent.classList.contains("collapsed") ? "+" : "-";
    });
}

export function setupUTToggle(constellation) {
    const utButton = document.getElementById("toggleUTs");
    utButton.textContent = "Show UTs";
    const utDiv = document.getElementById("utInfo");
    if (utDiv) utDiv.innerText = "Click a UT to display info";

    utButton.addEventListener("click", () => {
        const visible = toggleUTVisibility();
        updateUTCounter();
        playClickSound();

        if (!visible) {
            if (utDiv) utDiv.innerText = "UTs hidden";
        } else {
            updateUTInfoPanel(constellation);
        }

        utButton.textContent = visible ? "Hide UTs" : "Show UTs";
    });
}

export function updateUTInfoPanel(constellation) {
    const utDiv = document.getElementById("utInfo");
    if (!utDiv) return;

    if (!isUTVisible()) {
        utDiv.innerText = "UTs hidden";
        return;
    }

    if (!selectedUT) {
        utDiv.innerText = "Click a UT to display info";
        return;
    }

    utDiv.innerText = describeUT(selectedUT, viewer.clock, constellation);
}
