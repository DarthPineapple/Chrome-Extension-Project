document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("options-button")
    .addEventListener("click", () => {
        chrome.tabs.create({url: "barrier.html"});
    });
})