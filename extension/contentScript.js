const seenImages = new Set();
const seenText = new Set();

const imageUrls = new Set();

function extractImageLinks(){
    const images = document.querySelectorAll('img');
    const newImageLinks = Array.from(images)
        .filter((img) => img.dataset.approved !== "true")
        .map((img) => {
            if (!img.src.startsWith("data:image/gif")){
                if (!img.dataset.originalsrc){
                    img.dataset.originalsrc = img.src;
                }

                img.dataset.originalAlt = img.alt;
                
                if (img.srcset !== ""){
                    img.dataset.originalSrcset = img.srcset;
                    img.srcset = "";
                }

                img.src = "";
                img.alt = "";

                return img.dataset.originalsrc
            }
            else{
                return "";
            }
        })
    .filter((src) => src !== "" && !seenImages.has(src));
newImageLinks.forEach((src) => seenImages.add(src));

const backgroundImages = Array.from(document.querySelectorAll("*"));

backgroundImages.forEach((element) => {
    const backgroundImage = window.getComputedStyle(element).backgroundImage;
    if (backgroundImage && backgroundImage != "none"){
        try{
            url = backgroundImage.match(/url\(["']?([^"']*)["']?\)/)[1];
            if(element.dataset.approved !== "true"){
                newImageLinks.push(url);

                element.dataset.originalBackgroundImage = url.
                element.style.backgroundImage = "none";
            }
        }
        catch(error){
            ;
        }

        
            }
        
    
    return newImageLinks;
    })
}

function sendImages(){
    const imageLinks = extractImageLinks();
    try{
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
                textConstnt = node.textContent.trim(0);
                if(textContent != ""){
                    sentence.push(textContent);
                }
            }
            
        }else{
            node.childNodes.forEach((child) => extractTextFromNode(child));
        }
    }

    extractTextFromNode(document.body);

    sentences = sentences
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence !== "")
        .filter((sentence) => !sentence.includes("???"))
        .filter((sentence) => !sentence.includes("!"))
        .filter((sentence) => !seenText.has(sentence));
}

function sendText(){
    const text = extractSentences();
    try{
        if(text.length > 0){
            chrome.runtime.sendMessage({text: text});
        }
    }
    catch(error){
        ;
    }
}

function escapeRegExp(text){
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//Set up a mutationobserver
const observer = new MutationObserver(() => {
    sendImages();
    sendText();
});

observer.observe(document, {
    childList: true,
    subtree: true
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if(message.action === "removeImage" && message.imageLink){
        const images = document.querySelectorAll(`img[data-original-src="${message.imageLink}"]`);
        images.forEach((image) => {
            image.src = "";
            image.alt = "";
            if(image.srcset === "" && image.dataset.originalSrcset){
                image.srcset = "";
                image.removeAttribute("data-original-srcset");
            }
            image.removeAttribute("data-original-src");
            image.removeAttribute("data-original-alt");
        });

        const elements = document.querySelectorAll(`*[data-original-background-image="${message.imageLink}"]`);

        elements.forEach((element) => {
            element.style.backgroundImage = "none";
            element.removeAttribute("data-original-background-image");
        });
    }
    else if(message.action === "revealImage" && messages.imageLink){
        const images = document.querySelectorAll(`img[src=""][data-original-src="${message.imageLink}"]);`)
        images.forEach((image) => {
            image,src = "";
            image.alt = "";
            if(image.srcset === "" && image.dataset.originalSrcset){
                image.srcset = image.originalSrcSet;
                image.removeAttribute("data-original-srcset");
            }
            image.dataset.approves = "true";
            image.style.display = "block";
            image.removeAttribute("data-original-src");
            image.removeAttribute("data-original-alt");
        });

        const elements = document.querySelectorAll(`*[data-original-background-image="${message.imageLink}"]`);

        elements.forEach((element) => {
            element.style.backgroundImage = `url(${element.style.originalBackgroundImage})`;
            element.dataset.approved = "true";
            element.style.display = "clock";
            element.removeAttribute("data-original-backgruond-image);")
        });
    }
        else if (message.action === "removeText" && message.text){
            const text = message.text.trim();
            
            function removeTextFromNode(node){
                if(node.nodeType === Node.TEXT_NODE){
                    textContent = node.textContent.trim();
                    if(textContent === ""){
                        return;
                    }
                    if(node.textContent.includes(text)){
                        node.textContent = node.textContent.replace(new RegExp(escapeRegExp(text), "gi"), "???");
                        ;
                    }
                }
                else{
                    node.childNodes.forEach((child) => removeTextFromNode(child));
                }
                removeTextFromNode(document.body);
            }
    }
});

window.addEventListener("load", () => {
    sendImages();
    sendText();
});

document.addEventListener("DOMContentLoaded", () => {
    sendImages();
    sendText();
});