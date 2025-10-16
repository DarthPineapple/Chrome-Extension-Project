document.addEventListener("DOMContentLoaded", () => {
    // Toggle on/off
    const toggle = document.getElementById("enable-toggle");
    chrome.storage.local.get('enabled', res => {
        toggle.checked = res.enabled !== false;
    });
    toggle.addEventListener("change", () => {
        chrome.storage.local.set({ enabled: toggle.checked });
    });

    //dark mode
    chrome.storage.local.get(['darkMode']).then((result) => {
        const darkMode = result.darkMode ?? false;
        if (darkMode) {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }
    });

    // Load Stats
    chrome.storage.local.get(['tokensBlocked', 'imagesBlocked'], res => {
        document.getElementById("tokens-blocked").textContent = res.tokensBlocked ?? 0;
        document.getElementById("images-blocked").textContent = res.imagesBlocked ?? 0;
    });

    // Go to the options page
    document.getElementById("options-button")
    .addEventListener("click", () => {
        chrome.tabs.create({url: "barrier.html"});
    });
})