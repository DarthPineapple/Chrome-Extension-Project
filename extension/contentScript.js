let buildAutomaton, findAll;

// Load the Aho-Corasick implementation
(async () => {
    console.log("Loading Aho-Corasick module");
    const module = await import(chrome.runtime.getURL('ac.js'));
    buildAutomaton = module.buildAutomaton;
    findAll = module.findAll;
    console.log(buildAutomaton, findAll)
    loadDictionary();
})();

let AC = null;
let acReady = false;
let initialScanComplete = false;

// const BLACKLIST_ENTRIES = [
//     { term: "cocaine", payload: "drug" },
//     { term: "heroin", payload: "drug" },
// ];

var enabled = true;

chrome.storage.local.get(['enabled'], (result) => {
    if (result.enabled === undefined) {
        enabled = true;
        chrome.storage.local.set({ enabled: true });
    } else {
        enabled = result.enabled;
    }
    console.log("Content script enabled status:", enabled);
    if (enabled) {
        runInitialScan();
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) {
        enabled = changes.enabled.newValue;
    }
    console.log("Content script enabled status changed to:", enabled);

    if (enabled) {
        runInitialScan(true);
    }
});

async function loadDictionary() {
const dictUrl = chrome.runtime.getURL('blacklist.json');

    let response;
    try {
        response = await fetch(dictUrl);
    } catch (error) {
        console.error("Error fetching dictionary:", error);
        return;
    }

    if (!response.ok) {
        console.error("Failed to load dictionary:", response.statusText);
        return;
    }

    let BLACKLIST_ENTRIES = await response.json();

    console.log(buildAutomaton)
    AC = buildAutomaton(BLACKLIST_ENTRIES, { caseInsensitive: true, wholeWord: true });
    acReady = true;
    if (enabled) {
        runInitialScan(true);
    }
}

function runInitialScan(force = false) {
    if (!enabled) return;
    if (initialScanComplete && !force) return;
    if (document.readyState === "loading") {
        return;
    }

    initialScanComplete = true;
    sendImages();
    sendText();
    acCensorDocument();
}

function censorWithHits(text, hits) {
    if (hits.length == 0) return text;

    const sorted = hits.sort((a, b) => b.start - a.start);
    let output = text;
    for (const hit of sorted) {
        const len = hit.end - hit.start;
        output = output.slice(0, hit.start) + "█".repeat(len) + output.slice(hit.end);
    }; 
    return output;
}

function* textNodeWalker(root) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const text = node.textContent;

                if (!text || text.trim() === "") {
                    return NodeFilter.FILTER_REJECT;
                }

                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                const tag = parent.tagName.toLowerCase();

                if (["script", "style", "noscript", "iframe", "code", "pre", "svg", "object", "embed"].includes(tag)) {
                    return NodeFilter.FILTER_REJECT;
                }

                const style = parent.ownerDocument.defaultView.getComputedStyle(parent);
                if (!style || style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;           }
        }
    );
    let node;
    while ((node = walker.nextNode())) {
        yield node;
    }
}

function acCensorNode(node) {
    const raw = node.textContent;
    if (!raw || !acReady || ! AC) return false;
    const hits = findAll(AC, raw);
    if (hits.length === 0) return false;
    node.textContent = censorWithHits(raw, hits);
    return true;
}

function acCensorDocument() {
    if (!acReady || !AC || !document.body) return;
    for (const node of textNodeWalker(document.body)) {
        acCensorNode(node);
    }
}

function acCensorSubtree(root) {
    if (!acReady || !AC) return;
    for (const node of textNodeWalker(root)) {
        acCensorNode(node);
    }
}

const seenImages = new Set();
const seenText = new Set();

const imageUrls = new Set();

// Debounce timers
let imageDebounceTimer = null;
let textDebounceTimer = null;

// Pending batches
let pendingImages = [];
let pendingTexts = [];

// Configuration
const IMAGE_BATCH_SIZE = 10;  // Send images in batches of 10
const TEXT_BATCH_SIZE = 100;  // Send text in batches of 100
const DEBOUNCE_DELAY = 100;   // Wait 100ms before sending
let scanScheduled = false;
const pendingScanRoots = new Set();

function isDataImageOrUrl(url){
    return url.toString().startsWith("data:image/") || url.toString().startsWith("blob:") || url.toString().startsWith("http") || url.toString() === "";
}

function getElementRoots(root, selector) {
    if (!root) return [];
    if (root.nodeType === Node.DOCUMENT_NODE) {
        return Array.from(root.querySelectorAll(selector));
    }
    if (root.nodeType !== Node.ELEMENT_NODE) {
        return [];
    }

    const matches = root.matches(selector) ? [root] : [];
    return matches.concat(Array.from(root.querySelectorAll(selector)));
}

function extractImageLinks(root = document){
    const images = getElementRoots(root, 'img');
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
                    style.textContent = ".image-pending-placeholder{opacity:0 !important;}";
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

const backgroundImages = getElementRoots(root, "*");

backgroundImages.forEach((element) => {
    const backgroundImage = window.getComputedStyle(element).backgroundImage;
    if (backgroundImage && backgroundImage != "none"){
        try{
            const url = backgroundImage.match(/url\(["']?([^"']*)["']?\)/)[1];
            if(element.dataset.approved !== "true"){
                newImageLinks.push(url);

                element.dataset.originalBackgroundImage = url;
                element.style.backgroundImage = "none";
            }
        }
        catch(error){
            // Silently ignore errors from invalid background image URLs
        }
    }
})
newImageLinks.forEach((src) => {if(isDataImageOrUrl(src)) seenImages.add(src);});
return newImageLinks;
}

function flushImages() {
    if (pendingImages.length === 0) return;
    
    const batch = pendingImages.splice(0, IMAGE_BATCH_SIZE);
    console.log(`Sending ${batch.length} images immediately`);
    
    try {
        chrome.runtime.sendMessage({images: batch});
    } catch(error) {
        console.error("Error sending images:", error);
    }
    
    // If there are more images, schedule next batch immediately
    if (pendingImages.length > 0) {
        setTimeout(flushImages, 0);
    }
}

function flushTexts() {
    if (pendingTexts.length === 0) return;
    
    const batch = pendingTexts.splice(0, TEXT_BATCH_SIZE);
    console.log(`Sending ${batch.length} texts immediately`);
    
    try {
        chrome.runtime.sendMessage({text: batch});
    } catch(error) {
        console.error("Error sending text:", error);
    }
    
    // If there are more texts, schedule next batch immediately
    if (pendingTexts.length > 0) {
        setTimeout(flushTexts, 0);
    }
}

function sendImages(){
    const imageLinks = extractImageLinks();
    if (imageLinks.length === 0) return;
    
    pendingImages.push(...imageLinks);
    
    // Clear existing timer
    if (imageDebounceTimer) {
        clearTimeout(imageDebounceTimer);
    }
    
    // Debounce: wait for DEBOUNCE_DELAY ms of inactivity before sending
    imageDebounceTimer = setTimeout(() => {
        flushImages();
        imageDebounceTimer = null;
    }, DEBOUNCE_DELAY);
}

function sendImagesFromRoot(root){
    const imageLinks = extractImageLinks(root);
    if (imageLinks.length === 0) return;
    
    pendingImages.push(...imageLinks);
    
    // Clear existing timer
    if (imageDebounceTimer) {
        clearTimeout(imageDebounceTimer);
    }
    
    // Debounce: wait for DEBOUNCE_DELAY ms of inactivity before sending
    imageDebounceTimer = setTimeout(() => {
        flushImages();
        imageDebounceTimer = null;
    }, DEBOUNCE_DELAY);
}

function extractSentences(root = document.body){
    let sentences = [];

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
                const textContent = node.textContent.trim();
                if(textContent != ""){
                    sentences.push(textContent);
                }
            }
            
        }else{
            node.childNodes.forEach((child) => extractTextFromNode(child));
        }
    }

    if (root){
        extractTextFromNode(root);
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
    const texts = extractSentences();
    if (texts.length === 0) return;
    
    const filtered = [];
    for (const text of texts) {
        if (acReady && AC) {
            const hits = findAll(AC, text);
            if (hits.length == text.split(" ").length) {
                continue; // Skip texts that are entirely blacklisted
            } else {
                filtered.push(text);
            }
        } else {
            filtered.push(text);
        }
    }

    if (filtered.length === 0) return;

    pendingTexts.push(...filtered);
    
    // Clear existing timer
    if (textDebounceTimer) {
        clearTimeout(textDebounceTimer);
    }
    
    // Debounce: wait for DEBOUNCE_DELAY ms of inactivity before sending
    textDebounceTimer = setTimeout(() => {
        flushTexts();
        textDebounceTimer = null;
    }, DEBOUNCE_DELAY);
}

function sendTextFromRoot(root){
    const texts = extractSentences(root);
    if (texts.length === 0) return;
    
    const filtered = [];
    for (const text of texts) {
        if (acReady && AC) {
            const hits = findAll(AC, text);
            if (hits.length == text.split(" ").length) {
                continue; // Skip texts that are entirely blacklisted
            } else {
                filtered.push(text);
            }
        } else {
            filtered.push(text);
        }
    }

    if (filtered.length === 0) return;

    pendingTexts.push(...filtered);
    
    // Clear existing timer
    if (textDebounceTimer) {
        clearTimeout(textDebounceTimer);
    }
    
    // Debounce: wait for DEBOUNCE_DELAY ms of inactivity before sending
    textDebounceTimer = setTimeout(() => {
        flushTexts();
        textDebounceTimer = null;
    }, DEBOUNCE_DELAY);
}

function escapeRegExp(text){
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//Set up a mutationobserver
const observer = new MutationObserver((mutations) => {
    if(enabled === false){
        return;
    }

    mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
            const textNode = mutation.target;
            if (textNode?.parentElement) {
                pendingScanRoots.add(textNode.parentElement);
            }
            return;
        }

        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
                pendingScanRoots.add(node.parentElement);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                pendingScanRoots.add(node);
            }
        });
    });

    if (!scanScheduled && pendingScanRoots.size > 0) {
        scanScheduled = true;
        setTimeout(() => {
            scanScheduled = false;
            const roots = Array.from(pendingScanRoots);
            pendingScanRoots.clear();
            roots.forEach((root) => {
                sendImagesFromRoot(root);
                sendTextFromRoot(root);
                acCensorSubtree(root);
            });
        }, DEBOUNCE_DELAY);
    }
});

observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true
});

function incrementBlockedCount(key, delta) {
    chrome.storage.local.get([key], (result) => {
        const currentValue = Number(result[key] || 0);
        chrome.storage.local.set({ [key]: currentValue + delta });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    runInitialScan();
});

window.addEventListener("load", () => {
    runInitialScan(true);
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if(message.action === "removeImage" && message.imageLink){
        incrementBlockedCount("imagesBlocked", 1);
        const images = document.querySelectorAll(`img[data-originalsrc="${message.imageLink}"]`);
        images.forEach((image) => {
            image.classList.add("image-pending-placeholder");
            // image.src = "";
            // image.alt = "";
            // if(image.srcset === "" && image.dataset.originalSrcset){
            //     image.srcset = "";
            //     image.removeAttribute("data-original-srcset");
            // }
            // image.removeAttribute("data-original-src");
            // image.removeAttribute("data-original-alt");
        });

        const elements = document.querySelectorAll(`*[data-original-background-image="${message.imageLink}"]`);

        elements.forEach((element) => {
            element.style.backgroundImage = "none";
            element.removeAttribute("data-original-background-image");
        });

        console.log(`Removed image with link: ${message.imageLink}`);
    }
    else if (message.action === "log"){
        const images = document.querySelectorAll(`img[data-originalsrc="${message.imageLink}"]`);
        //console.log(`Image classified: ${message.imageLink} as ${message.className} with confidence ${message.confidence}`);
        images.forEach((image) => {
            image.alt = JSON.stringify(message.data);
        });
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
        incrementBlockedCount("tokensBlocked", message.text.trim().split(/\s+/).filter(Boolean).length);
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

// window.addEventListener("load", () => {
//     if (enabled) {
//         console.log("Page loaded - scanning for images");
//         sendImages();

//         acCensorDocument();
//     }

    
// });

// document.addEventListener("DOMContentLoaded", () => {

//     if (enabled) {
//         console.log("DOM loaded - scanning for images");
//         sendImages();

//         acCensorDocument();
//     }
    
// });
