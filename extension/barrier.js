document.addEventListener("DOMContentLoaded", ()=>{
    const[passwordInput, submitPassword] = ["password-field", "submit-password-button"].map((id)=>document.getElementById(id));

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

    submitPassword.addEventListener("click", submitPassword);
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
    const errorMessage = document.getElementById("incorrect-password-message");

    chrome.storage.local.get(["password"], (result)=>{
        switch(result.password){
            case attempedPassword:
                chrome.storage.local.set({authenticated: true});
                window.local.hred="options.html";
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
    if(password && password === confirmPassword){
        chrome.storage.local.set({password});
        showSection("password");
    }
    else{
        alert(password ? "Passwords do not match": "Passwords cannot be empty");
    }
}