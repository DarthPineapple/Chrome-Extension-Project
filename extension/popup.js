document.addEventListener("DOMContentLoaded", 
    function(){
        chrome.runtime.sendMessage(
            {
                action: "get_status"
            }, 
            function(response){
                if (response.status === "success"){
                    const messageDiv = document.createElement("div");
                    messageDiv.className = "message";
                    messageDiv.textContent = "Browser Protected by FocusShield AI";
                    const switchDiv = document.createElement("div");
                    //switchDiv.className = "switch";
                    //switch.textContent = 
                }
            }
        )
    }
)