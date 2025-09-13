const CATEGORIES = ['violence', 'profanity', 'explicit', 'drugs', 'gambling']
const PRESETS = {
    ages_3_5: ['violence', 'profanity', 'explicit', 'drugs', 'gambling', 0.3],
    ages_6_12: ['violence', 'profanity', 'explicit', 'drugs', 'gambling', 0.5],
    ages_13_18: ['violence', 'explicit', 'drugs', 'gambling', 0.7],
    custom: null
}

function validatePassword(password) {
    // return true if the password is sufficiently strong, reason given if not
    var longEnough = password.length >= 6;
    var hasUpper = /[A-Z]/.test(password);
    var hasSpecial = /[\.\,\?\/\\\'\;\:\=\+\-\_\!\@\#\$\%\^\&\*\*\(\)]/.test(password);
    var hasNumber = /\d/.test(password);
    
    if (!longEnough) {
        return [false, "Password must be at least 6 characters long."];
    }
    if (!hasUpper) {
        return [false, "Password must contain at least one uppercase letter."];
    }
    if (!hasSpecial) {
        return [false, "Password must contain at least one special character."];
    }
    if (!hasNumber) {
        return [false, "Password must contain at least one number."];
    }
    return [true, ""];
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
        const newPassword=document.getElementById("new-password-field");
        // const confirmPassword = document.getElementById("confirm-new-password-field");
        const passwordError = document.getElementById('password-error');

        // if(!newPassword){
        //     passwordError.textContent = "Password field cannot be empty";
        //     passwordError.classList.remove('d-none');
        //     return;
        // }
        // if(newPassword !== confirmPassword){
        //     passwordError.textContent = "Passwords do not match";
        //     passwordError.classList.remove('d-none');
        //     return;
        // }

        // Validate password strength
        const [isValid, reason] = validatePassword(newPassword.value);
        if (!isValid) {
            passwordError.textContent = reason;
            passwordError.classList.remove('d-none');
            // return;
        } else {
            chrome.storage.local.set({password:newPassword.value}, ()=>{
                alert("password changed successfully");
                document.getElementById("new-password-field").value="";
                //document.getElementById("confirm-new-password-field").value="";
                passwordError.classList.add("d-none");
            });
        }
    })

    const setConfidenceField = document.getElementById("set-confidence-field");
    const setConfidenceButton = document.getElementById("save-confidence-level-button");
    if(setConfidenceField){
        chrome.storage.local.get(['confidence']).then((result) => {
            const confidence = result.confidence ?? 0.5;
            setConfidenceField.value = Math.round(confidence * 100);
        });

        setConfidenceButton.addEventListener("click", (event) => {
            let percent = parseInt(setConfidenceField.value ?? 50);
            if(percent>100){
                percent = 100;
            }if(percent < 0){
                percent=0;
            }
            chrome.storage.local.set({confidence:percent/100});
            // setConfidenceField.value = percent;
        });
    }

    const darkModeToggle = document.getElementById("dark-mode-toggle");
    chrome.storage.local.get(['darkMode']).then((result) => {
        const darkMode = result.darkMode ?? false;
        darkModeToggle.checked = darkMode;
        if (darkMode) {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }
    });
    darkModeToggle.addEventListener("change", (event) => {
        const darkMode = event.target.checked;
        chrome.storage.local.set({darkMode: darkMode});
        if (darkMode) {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }
    });

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
                // obj.confidence = parseInt(document.getElementById('set-confidence-field').value ?? 50) / 100;
                chrome.storage.local.set({blockingOptions: obj});
                chrome.storage.local.set({confidence: parseInt(document.getElementById('set-confidence-field').value ?? 50) / 100});
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
                // obj.confidence = PRESETS[preset][preset_length - 1];
                chrome.storage.local.set({blockingOptions: obj});
                chrome.storage.local.set({confidence: PRESETS[preset][preset_length - 1]});
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