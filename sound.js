let clickSound;
let lastClickTime = 0;
const CLICK_COOLDOWN = 120;
let utClickSound;
let lastUTClickTime = 0;

export function setupClickSound() {
    clickSound = new Audio("button-11.wav");
    clickSound.volume = 0.25;

    utClickSound = new Audio("button-11.wav");
    utClickSound.volume = 0.35;
    utClickSound.playbackRate = 0.85;
}

export function playClickSound() {
    const now = Date.now();
    if (now - lastClickTime > CLICK_COOLDOWN) {
        lastClickTime = now;
        clickSound.currentTime = 0;
        clickSound.play();
    }
}

export function playUTClickSound() {
    const now = Date.now();
    if (now - lastUTClickTime > CLICK_COOLDOWN) {
        lastUTClickTime = now;
        utClickSound.currentTime = 0;
        utClickSound.play();
    }
}
