document.documentElement.style.display = 'none';

function getGoogleSearchDescriptions(){
    //Get all the div elements with class "MjjYud"
    const resultElements = document.querySelectorAll('div.MjjYud');

    const descriptions = [];

    resultElements.forEach((element) => {
        descriptions.push(element.innerText);
    })

    return descriptions;
}

document.addEventListener("DOMContentLoaded", function(){
    
    //Begin loading
    const overlay = document.createElement("div");
    overlay.className = 'overlay';

    const loader = document.createElement('div');
    loader.className = "loader";

    const loadingText = document.createElement('div');
    loader.className = "loadting-text";
    loadingText.textContent = "Securing your connection...";

    overlay.appendChild(loader);
    overlay.appendChild(loadingText);
    document.body.appendChild(overlay);
    document.documentElement.style.display = '';

    chrome.runtime.sendMessage({
        action: "page_load",
        url: window.location.href
    });
    //Finish loading

    //Retrieve meta descriptions
    const metaDescriptions = getGoogleSearchDescriptions();
    
    chrome.runtime.sendMessage({
        action: "meta_descriptions",
        data: metaDescriptions
        },
        function(response){
            console.log("Service worker response: ", response);
        }
    );
});
