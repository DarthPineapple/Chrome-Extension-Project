const CATEGORIES = ['violence', 'profanity', 'explicit', 'drugs', 'gambling']
const PRESETS = {
    ages_3_5: ['violence', 'profanity', 'explicit', 'drugs', 'gambling', 0.3],
    ages_6_12: ['violence', 'profanity', 'explicit', 'drugs', 'gambling', 0.5],
    ages_13_18: ['violence', 'explicit', 'drugs', 'gambling', 0.7],
    custom: null
}

document.addEventListener('DOMContentLoaded', ()=>{
    chrome.storage.local.get(['authenticated']).then((result) =>{
        if (!result.authenticated){
            window.location.href="barrier.html";
        }
    });

    document.querySelectorAll(".tablink").forEach((tablink)=>{
        tablink.addEventListener("click", ()=>{
            document.querySelectorAll('.tabcontent').forEach((content) => content.classList.add("d-none"));
        const href=tablink.dataset.href;
        document.querySelector(href).classList.remove('d-none');
        document.querySelectorAll('.tablink').forEach((link) => link.classList.remove('active'));
        tablink.classList.add('active');
        });
        });
    

    document.querySelectorAll('.expand-button').forEach((button) => {
        button.addEventListener("click", (event) => {
            const targetId = event.currentTarget.dataset.target;
            const section = document.getElementById(targetId);
            if(!section){
                return;
            }
            section.classList.toggle("active");
        });
    });

    document.getElementById("change-password-submit-button").addEventListener("click", ()=>{
        const newPassword=document.getElementById("new-password-field").ariaValueMax;
        const confirmPassword = document.getElementById("confirm-new-password-field").ariaValueMax;
        const passwordError = document.getElementById('password-error');

        if(!newPassword || !confirmPassword){
            passwordError.textContent = "Password fields cannot be empty";
            passwordError.classList.remove('d-none');
            return;
        }
        if(newPassword !== confirmPassword){
            passwordError.textContent = "Passwords do not match";
            passwordError.classList.remove('d-none');
            return;
        }

        chrome.storage.local.set({password:newPassword}, ()=>{
            alert("password changed successfully");
            document.getElementById("new-password-field").value="";
            document.getElementById("confirm-new-password-field").value="";
            passwordError.classList.add("d-none");
        });
    })

    const setConfidenceField = document.getElementById("set-confidence-field");
    if(setConfidenceField){
        setConfidenceField.addEventListener("blue", (event) => {
            let percent = parseInt(event.target.value);
            if(percent>100){
                percent = 100;
            }if(percent < 0){
                percent=0;
            }
            chrome.storage.local.set({confidence:percent/100});
            setConfidenceField.value = percent;
        });
    }

    document.getElementById("logout-button").addEventListener("click", ()=>{
        chrome.storage.local.set({authenticate: false}, ()=>{
            window.location.href="barrier.html";
        });
    });
    initBlockingUI();
});

// ===== Block UI Logic =====
function initBlockingUI() {
    // Load saved options
    chrome.storage.local.get(['blockingOptions']).then((result) => {
        const options = result.blockingOptions || {};
        console.log("Loaded options:", options);
        const preset = options.preset || 'custom';
        if (preset === 'custom') {
            setCustomEnable(true);
            CATEGORIES.forEach((cat) => {
                const checkbox = document.getElementById(cat);
                if (checkbox) {
                    checkbox.checked = options[cat] || false;
                }
            })}

        const radio = document.querySelector(`input[name="blocking"][value="${preset}"]`);
        if (radio) {
            radio.checked = true;
        }
    });

    // Listen for radio changes
    document.querySelectorAll('input[name="blocking"]').forEach((radio) => {
        radio.addEventListener('change', (event) => {
            const preset = event.target.value;
            if (preset === 'custom') {
                setCustomEnable(true);
                const obj = {
                    "preset": "custom"
                };
                document.querySelectorAll('.custom-cat').forEach((checkbox) => {
                    const category = checkbox.id;
                    obj[category] = checkbox.checked;

                    // attach listener to each checkbox
                    checkbox.addEventListener('change', (event) => {
                        const category = event.target.id;
                        const isChecked = event.target.checked;
                        chrome.storage.local.get(['blockingOptions']).then((result) => {
                            const options = result.blockingOptions || {};
                            options[category] = isChecked;
                            chrome.storage.local.set({blockingOptions: options});
                            console.log("Updated custom:", options);
                        });
                    })
                });
                obj.confidence = parseInt(document.getElementById('set-confidence-field').value ?? 50) / 100;
                chrome.storage.local.set({blockingOptions: obj});
                console.log("Saved custom:", obj);
            } else {
                setCustomEnable(false);
                const obj = {
                    "preset": preset
                };
                CATEGORIES.forEach((cat) => {
                    console.log("Preset: ", preset);
                    obj[cat] = PRESETS[preset].includes(cat);
                })
                var preset_length = PRESETS[preset].length;
                obj.confidence = PRESETS[preset][preset_length - 1];
                chrome.storage.local.set({blockingOptions: obj});
                console.log("Saved preset:", obj);
            }
        })
    });
}

function setCustomEnable(enabled) {
    document.querySelectorAll('.custom-cat').forEach((checkbox) => {
        checkbox.disabled = !enabled;
    })
}