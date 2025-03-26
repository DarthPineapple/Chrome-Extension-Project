//change the background color to blue
document.body.style.backgroundColor = "lightblue";

//add a greeting to the page
let greeting = document.createElement("div");
greeting.textContent = "Hello World";
document.body.appendChild(greeting);

//Send message to background
chrome.runtime.sendMessage({greeting: "Hello from content script!"});
console.log('Message sent');

chrome.storage.sync.get('backgroundColor', function(data){
    let backgroundColor = data.backgroundColor || 'green';
    document.body.style.backgroundColor = backgroundColor;
    console.log('Background color retrieved: ', backgroundColor);
})