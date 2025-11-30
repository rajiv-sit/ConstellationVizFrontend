let clickSound;
let lastClickTime = 0;
const CLICK_COOLDOWN = 120;

export function setupClickSound() {
    clickSound = new Audio("button-11.wav");
    clickSound.volume = 0.25;

    // Click handler will still be wired in main.js via Cesium pick
}

export function playClickSound() {
    const now = Date.now();
    if (now - lastClickTime > CLICK_COOLDOWN) {
        lastClickTime = now;
        clickSound.currentTime = 0;
        clickSound.play();
    }
}
