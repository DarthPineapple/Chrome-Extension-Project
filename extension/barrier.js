document.addEventListener("DOMContentLoaded", ()=>{
    const[passwordInput, submitBtn] = ["password-field", "submit-password-button"].map((id)=>document.getElementById(id));

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

// function match(password){
//     return password.includes(/[A-Z]/) && password.includes(/[\.\,\?\/\\\'\;\:\=\+\-\_\!\@\#\$\%\^\&\*\*\(\)]/) && password.includes(/[\d]/);
// }

function setPassword(){
    const password = document.getElementById("set-password-field").value;
    const confirmPassword = document.getElementById("confirm-password-field").value;
    if(password && password === confirmPassword){
        // if(match(password)){
        // chrome.storage.local.set({password});
        // showSection("password");
        // }
        // else{
        //     alert("Password must include special characters and numbers");
        // }
        chrome.storage.local.set({password});
        showSection("password");
    }
    else{
        alert(password ? "Passwords do not match": "Passwords cannot be empty");
    }
}