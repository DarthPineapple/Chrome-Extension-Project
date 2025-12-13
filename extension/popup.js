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

    // Get system memory info
    chrome.system.memory.getInfo(info => {
        console.log("Memory Info:", info);
        const totalMemGB = info.capacity / (1024 * 1024 * 1024);
        const availableMemGB = info.availableCapacity / (1024 * 1024 * 1024);
        const usedMemGB = totalMemGB - availableMemGB;
        document.getElementById("memory-usage").textContent = `${usedMemGB.toFixed(2)} GB`;
    });


    const cpuElement = document.getElementById("cpu-usage");
    let prevCpu = null;

    function sampleCpuUsage() {
        chrome.system.cpu.getInfo(info => {
            if (chrome.runtime?.lastError) {
                cpuElement.textContent = "No CPU Info";
                return;
            }

            if (!prevCpu) {
                prevCpu = info;
                cpuElement.textContent = "...";
            }

            const corePercents = info.processors.map((p, i) => {
                const prev = prevCpu.processors[i];
                const deltaTotal = p.usage.total - prev.usage.total;
                const deltaIdle = p.usage.idle - prev.usage.idle;
                if (deltaTotal <= 0) return 0;
                const percent = ((deltaTotal - deltaIdle) / deltaTotal) * 100;
                return percent;
            });
            
            const avg = corePercents.reduce((a, b) => a + b, 0) / corePercents.length;
            cpuElement.textContent = `${avg.toFixed(2)} %`;
            prevCpu = info;
        });
    }

    sampleCpuUsage();
    setInterval(sampleCpuUsage, 1000); // Sample every second


    // Get system CPU info
    // chrome.system.cpu.getInfo(info => {
    //     console.log("Hello");
    //     console.log("CPU Info:", info);
    //     //alert("CPU Info: " + JSON.stringify(info));
    //     // Usage %
    //     /*
    //     CPU Info: {"archName":"x86_64","features":["mmx","sse","sse2","sse3","ssse3","sse4_1","sse4_2","avx"],"modelName":"12th Gen Intel(R) Core(TM) i7-12700H","numOfProcessors":20,"processors":[{"usage":{"idle":587506875000,"kernel":20730937500,"total":617254375000,"user":9016562500}},{"usage":{"idle":604100000000,"kernel":7503906250,"total":617253281250,"user":5649375000}},{"usage":{"idle":594885625000,"kernel":10645156250,"total":617253281250,"user":11722500000}},{"usage":{"idle":602149687500,"kernel":9113750000,"total":617253281250,"user":5989843750}},{"usage":{"idle":568367500000,"kernel":18501562500,"total":617253281250,"user":30384218750}},{"usage":{"idle":578763593750,"kernel":12339375000,"total":617253281250,"user":26150312500}},{"usage":{"idle":565367187500,"kernel":17835781250,"total":617253281250,"user":34050312500}},{"usage":{"idle":581861718750,"kernel":11973281250,"total":617253281250,"user":23418281250}},{"usage":{"idle":598294843750,"kernel":8509218750,"total":617253281250,"...kernel":4478906250,"total":617253281250,"user":6328906250}},{"usage":{"idle":594931093750,"kernel":9045781250,"total":617253281250,"user":13276406250}},{"usage":{"idle":607008593750,"kernel":4351093750,"total":617253281250,"user":5893593750}},{"usage":{"idle":598978593750,"kernel":8286406250,"total":617253281250,"user":9988281250}},{"usage":{"idle":597624062500,"kernel":8721406250,"total":617253281250,"user":10907812500}},{"usage":{"idle":598775156250,"kernel":8241250000,"total":617253281250,"user":10236875000}},{"usage":{"idle":598858906250,"kernel":8142812500,"total":617253281250,"user":10251562500}},{"usage":{"idle":595194687500,"kernel":9554062500,"total":617253281250,"user":12504531250}},{"usage":{"idle":595496718750,"kernel":9598281250,"total":617253281250,"user":12158281250}},{"usage":{"idle":596377187500,"kernel":9131406250,"total":617253281250,"user":11744687500}},{"usage":{"idle":593692031250,"kernel":10949843750,"total":617253281250,"user":12611406250}}],"temperatures":[]}
    //     */

    //     //alert(JSON.stringify(info.processors));

    //     /*
    //     [{"usage":{"idle":1105493281250,"kernel":2514218750,"total":1109342500000,"user":1335000000}},{"usage":{"idle":1106738125000,"kernel":1501718750,"total":1109341406250,"user":1101562500}},{"usage":{"idle":1106308593750,"kernel":1337812500,"total":1109341406250,"user":1695000000}},{"usage":{"idle":1107300937500,"kernel":1311562500,"total":1109341250000,"user":728750000}},{"usage":{"idle":1100949531250,"kernel":5348750000,"total":1109341406250,"user":3043125000}},{"usage":{"idle":1103900468750,"kernel":2912812500,"total":1109341250000,"user":2527968750}},{"usage":{"idle":1102492500000,"kernel":3605781250,"total":1109341406250,"user":3243125000}},{"usage":{"idle":1102676875000,"kernel":3998906250,"total":1109341250000,"user":2665468750}},{"usage":{"idle":1106594531250,"kernel":1237031250,"total":1109341250000,"user":1509687500}},{"usage":{"idle":1107653593750,"kernel":660625000,"total":1109341406250,"user":1027187500}},{"usage":{"idle":1106530625000,"kernel":1141562500,"total":1109341406250,"user":1669218750}},{"usage":{"idle":1107472187500,"kernel":752656250,"total":1109341406250,"user":1116562500}},{"usage":{"idle":1102302343750,"kernel":2872187500,"total":1109341250000,"user":4166718750}},{"usage":{"idle":1101844531250,"kernel":2708125000,"total":1109341250000,"user":4788593750}},{"usage":{"idle":1102008281250,"kernel":2590781250,"total":1109341250000,"user":4742187500}},{"usage":{"idle":1101602812500,"kernel":2710937500,"total":1109341406250,"user":5027656250}},{"usage":{"idle":1100716562500,"kernel":3034531250,"total":1109341250000,"user":5590156250}},{"usage":{"idle":1100721406250,"kernel":3113281250,"total":1109341406250,"user":5506718750}},{"usage":{"idle":1101166718750,"kernel":2692187500,"total":1109341250000,"user":5482343750}},{"usage":{"idle":1100993281250,"kernel":2774843750,"total":1109341406250,"user":5573281250}}]*/
        
    //      const cpuUsage = info.processors.reduce((acc, cpu) => {
    //         //alert(acc + " " + JSON.stringify(cpu));
    //          // alert("CPU Usage Data:", cpu.usage);
    //          const usage = cpu.usage;
    //          const total = usage.total;
    //          const idle = usage.idle;
    //          const usagePercent = ((total - idle) / total) * 100;
    //          return acc + usagePercent;
    //     }, 0) / info.processors.length;
    //     //alert("CPU Usage:" + cpuUsage);
    //     document.getElementById("cpu-usage").textContent = `${cpuUsage.toFixed(2)} %`;
    // });

    // For Network Status, periodically make a request to http://localhost:5003/health for image and http://localhost:5004/health for text
    setInterval(() => {
        fetch('http://localhost:5003/health')
        .then(response => {
            if (response.ok) {
                // Check text model
                fetch('http://localhost:5004/health')
                .then(resp => {
                    if (resp.ok) {
                        document.getElementById("network-status").textContent = "Online";
                    }
                })
                .catch(() => {
                    document.getElementById("network-status").textContent = "Offline";
                });
            } else {
                document.getElementById("network-status").textContent = "Offline";
            }
        })
        .catch(() => {
            document.getElementById("network-status").textContent = "Offline";
        });
    }, 5000); // every 5 seconds
})