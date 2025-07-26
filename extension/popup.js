document.addEventListener("DOMContentLoaded", () => {
    // Toggle on/off
    const toggle = document.getElementById("enable-toggle");
    chrome.storage.local.get('enabled', res => {
        toggle.checked = res.enabled !== false;
    });
    toggle.addEventListener("change", () => {
        chrome.storage.local.set({ enabled: toggle.checked });
    });

    // Load Stats


    // Get resource usage stats


    // Go to the options page
    document.getElementById("options-button")
    .addEventListener("click", () => {
        chrome.tabs.create({url: "barrier.html"});
    });
})