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

});