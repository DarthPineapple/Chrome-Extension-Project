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

    // Get resource usage stats
    console.log("Fetching resource usage stats...");
    if (chrome.processes && chrome.processes.getProcessInfo) {
        console.log("Fetching process info...");

        chrome.runtime.sendMessage({ cmd: "getResourceUsage" }, response => {
            console.log("Resource usage response:", response);
            if (response && response.processes) {
                console.log("Processes:", response.processes);
            }
        })

        // chrome.processes.getProcessInfo([], // empty array to get all processes
        //     true, // include memory usage
        //     proc => {
        //         console.log("Processes:", proc);
        //         const processInfo = proc.find(p => p.type === 'extension' && p.name.includes('FocusShield'));
        //         let memoryUsage = 0;
        //         let cpuUsage = 0;
        //         let networkUsage = false;

        //         if (processInfo) {
        //             processInfo.forEach(info => {
        //                 memoryUsage += info.memory ?? 0;
        //                 cpuUsage += info.cpu ?? 0;
        //                 // network: inbound + outbound bytes > 0?
        //                 if (info.network) {
        //                     networkUsage = info.network.inboundBytes > 0 || info.network.outboundBytes > 0;
        //                 }
        //             });

        //             // Convert memory usage to MB
        //             memoryUsage = (memoryUsage / (1024 * 1024)).toFixed(2);
        //             cpuUsage = cpuUsage.toFixed(2);

        //             document.getElementById("memory-usage").textContent = `${memoryUsage} MB`;
        //             document.getElementById("cpu-usage").textContent = `${cpuUsage}%`;
        //             document.getElementById("network-usage").textContent = networkUsage ? 'Connected' : 'Idle';
        //         }
        //     }
        // )
    }

    // Go to the options page
    document.getElementById("options-button")
    .addEventListener("click", () => {
        chrome.tabs.create({url: "barrier.html"});
    });
})