const seenImages = new Set();
const seenText = new Set();

const imageUrls = new Set();

function isDataImageOrUrl(url){
    return url.toString().startsWith("data:image/") || url.toString().startsWith("blob:") || url.toString().startsWith("http") || url.toString() === "";
}

function extractImageLinks(){
    const images = document.querySelectorAll('img');
    const newImageLinks = Array.from(images)
        .filter((img) => img.dataset.approved !== "true")
        .map((img) => {
            if (!img.src.startsWith("data:image/gif")){
                if (!img.dataset.originalsrc){
                    img.dataset.originalsrc = img.src;
                }

                // Preserve layout dimensions
                if (!img.dataset.originalSized) {
                    const rect = img.getBoundingClientRect();
                    if (rect.width && rect.height) {
                        img.style.width = `${rect.width}px`;
                        img.style.height = `${rect.height}px`;
                    }
                    img.dataset.originalSized = "true";
                }

                // Inject style
                if (!document.getElementById("image-hider-style")) {
                    const style = document.createElement("style");
                    style.id = "image-hider-style";
                    style.textContent = ".image-pending-placeholder{opacity:0 !important;";
                    document.head.appendChild(style);
                }

                // Use a transparent 1x1 pixel as a placeholder
                const transparentPx = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                img.src = transparentPx;
                img.alt = "";
                img.classList.add("image-pending-placeholder");

                return img.dataset.originalsrc
            }
            else{
                return "";
            }
        })
    .filter((src) => src !== "" && !seenImages.has(src));
newImageLinks.forEach((src) => {if(isDataImageOrUrl(src)) seenImages.add(src);});
console.log("Seen images 1:", seenImages);

const backgroundImages = Array.from(document.querySelectorAll("*"));

backgroundImages.forEach((element) => {
    const backgroundImage = window.getComputedStyle(element).backgroundImage;
    if (backgroundImage && backgroundImage != "none"){
        try{
            url = backgroundImage.match(/url\(["']?([^"']*)["']?\)/)[1];
            if(element.dataset.approved !== "true"){
                newImageLinks.push(url);

                element.dataset.originalBackgroundImage = url;
                element.style.backgroundImage = "none";
            }
        }
        catch(error){
            ;
        }
    }
})
newImageLinks.forEach((src) => {if(isDataImageOrUrl(src)) seenImages.add(src);});
console.log("Background images:", newImageLinks);
console.log("Seen images:", seenImages);
return newImageLinks;
}

function sendImages(){
    const imageLinks = extractImageLinks();
    try{
        console.log("Sending image links:", imageLinks);
        if(imageLinks.length > 0){
            chrome.runtime.sendMessage({images: imageLinks});
        }
    }
    catch(error){
        ;
    }
}
function extractSentences(){
    sentences = [];

    const excludedTags = new Set([
        "script",
        "style",
        "noscript",
        "iframe",
        "code",
        "pre",
        "svg",
        "object",
        "embed"
    ]);

    function isVisible(node){
        const style = window.getComputedStyle(node);
        return (
            style &&
            style.display !== "none" &&
            style.visibility !== "hidden" && 
            parseFloat(style.opacity) > 0
        )
    };

    function extractTextFromNode(node){
        if(node.nodeType == Node.TEXT_NODE){
            const parent = node.parentElement;
            if(parent && isVisible(parent) && !excludedTags.has(parent.tagName.toLowerCase())){
                textContent = node.textContent.trim(0);
                if(textContent != ""){
                    sentences.push(textContent);
                }
            }
            
        }else{
            node.childNodes.forEach((child) => extractTextFromNode(child));
        }
    }

    if (document.body){
        extractTextFromNode(document.body);
    }

    sentences = sentences
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence !== "")
        .filter((sentence) => !sentence.includes("???"))
        .filter((sentence) => !sentence.includes("!"))
        .filter((sentence) => !seenText.has(sentence));


    sentences.forEach((sentence) => seenText.add(sentence));
    
    return sentences;
}

function sendText(){
    const text = extractSentences();
    try{
        if(text.length > 0){
            console.log("Sending text:", text);
            chrome.runtime.sendMessage({text: text});
        }
    }
    catch(error){
        ;
    }
}

function escapeRegExp(text){
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//Set up a mutationobserver
const observer = new MutationObserver(() => {
    console.log("DOM mutated");
    sendImages();
    sendText();
});

observer.observe(document, {
    childList: true,
    subtree: true
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if(message.action === "removeImage" && message.imageLink){
        const images = document.querySelectorAll(`img[data-originalsrc="${message.imageLink}"]`);
        images.forEach((image) => {
            image.classList.add("image-pending-placeholder");
        });

        const elements = document.querySelectorAll(`*[data-original-background-image="${message.imageLink}"]`);

        elements.forEach((element) => {
            element.style.backgroundImage = "none";
            element.removeAttribute("data-original-background-image");
        });

        console.log(`Removed image with link: ${message.imageLink}`);
    }
    else if(message.action === "revealImage" && message.imageLink){
        console.log(`Revealing image with link: ${message.imageLink}`);
        const images = document.querySelectorAll(`img[data-originalsrc="${message.imageLink}"]`)
        console.log("Images to reveal:", images);
        images.forEach((image) => {
            console.log("Revealing image:", message.imageLink);
            image.src = message.imageLink;
            image.classList.remove("image-pending-placeholder");
            image.dataset.approved = "true";
        });

        const elements = document.querySelectorAll(`*[data-original-background-image="${message.imageLink}"]`);

        elements.forEach((element) => {
            element.style.backgroundImage = `url(${element.dataset.originalBackgroundImage})`;
            element.dataset.approved = "true";
            element.style.display = "block";
            element.removeAttribute("data-original-background-image");
        });
    }
    else if (message.action === "removeText" && message.text){
        // command to censor with "█"
        const text = message.text.trim();
        
        function removeTextFromNode(node){
            if(node.nodeType === Node.TEXT_NODE){
                const textContent = node.textContent.trim();
                if(textContent === ""){
                    return;
                }
                if(node.textContent.includes(text)){
                    node.textContent = node.textContent.replaceAll(new RegExp(escapeRegExp(text), "g"), "█".repeat(text.length));
                    console.log(`Removed text: ${text}`);
                }
            }
            else{
                node.childNodes.forEach((child) => removeTextFromNode(child));
            }
        }
        removeTextFromNode(document.body);
    }
});

window.addEventListener("load", () => {
    console.log("Page loaded - scanning for images");
    sendImages();
});

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded - scanning for images");
    sendImages();
});