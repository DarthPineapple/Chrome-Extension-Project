document.addEventListener("DOMContentLoaded", ()=>{
    const[passwordInput, submitBtn] = ["password-field", "submit-password-button"].map((id)=>document.getElementById(id));

    //dark mode
    chrome.storage.local.get(['darkMode']).then((result) => {
        const darkMode = result.darkMode ?? false;
        if (darkMode) {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }
    });

    passwordInput.addEventListener("input", ()=>{
        document.getElementById("password-error").classList.add("d-none");
    });

    const [setPasswordInput, confirmPasswordInput, setPasswordButton] = ["set-password-field","confirm-password-field", "set-password-button"
    ].map((id)=>document.getElementById(id));

    chrome.storage.local.get(["password"]).then((result) =>{
        if(result.password){
            showSection("password");
            passwordInput.focus();
        }else{
            showSection("setPassword");
            setPasswordInput.focus();
        }
    });

    submitBtn.addEventListener("click", submitPassword);
    passwordInput.addEventListener("keydown", (e) => {
        e.key === "Enter" && submitPassword();
    });

    setPasswordButton.addEventListener("click", setPassword);
    confirmPasswordInput.addEventListener("keydown", (e)=>{
        e.key === "Enter" && setPassword();
    });

});

function showSection(section){
    const passwordSection = document.getElementById("password-section");
    const setPasswordSection = document.getElementById("set-password-section");

    switch(section){
        case "password":
            passwordSection.classList.add("active");
            setPasswordSection.classList.remove("active");
            break;
        case "setPassword":
            passwordSection.classList.remove("active");
            setPasswordSection.classList.add("active");
            break;
        default:
            console.error("Invalid Section Specified");
    }
}

function submitPassword(){
    const attempedPassword = document.getElementById("password-field").value;
    const errorMessage = document.getElementById("password-error");

    chrome.storage.local.get(["password"], (result)=>{
        switch(result.password){
            case attempedPassword:
                chrome.storage.local.set({authenticated: true});
                window.location.href="options.html";
                break;
            default:
                errorMessage.classList.remove("d-none");
                errorMessage.textContent="Incorrect Password. Please try again.";
        }

    })
}

function setPassword(){
    const password = document.getElementById("set-password-field").value;
    const confirmPassword = document.getElementById("confirm-password-field").value;
    const [valid, reason] = validatePassword(password);
    if(password && password === confirmPassword){
        if(!valid){
            console.log("Invalid password:", reason);
            alert(reason);
            return;
        }
        chrome.storage.local.set({password});
        showSection("password");
    }
    else{
        console.log("Passwords do not match or are empty");
        alert(password ? "Passwords do not match": "Passwords cannot be empty");
    }
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