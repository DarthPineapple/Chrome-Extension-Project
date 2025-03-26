//Listen for browser startup
//document.body.style.backgroundColor = "green";
chrome.runtime.onStartup.addListener(() => {
    console.log("Extension Started!")
});

//Connect with content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message recieved from content script: ", message);
});

