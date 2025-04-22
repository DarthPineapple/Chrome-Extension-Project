baseUrl="https://hs_project-focusshield-ai-server.onrender.com"
imageUrl = `${baseUrl}/predict_image`
textUrl = `${baseUrl}/predict_text`

chrome.runtime.onInstalled.addListener(({reason}) =>{
    if(reason === "install"){
        chrome.tabs.create({url:"barrier.html"})
    }
})

function dataUrlToBlob(dataUrl){
    const [header, data] = dataUrl.split(",");
    const mime = header.mat(/:(.*?);/)[1];
    const binary = atob(data);
    const array = newUint8Array(binary.length);
    for(let i = 0; i < binary.length; i++){
        array[i] = binary.charCodeAt(i);
    }

    return new Blob([array], {type:mime});
}

async function downloadImage(url){
    if(!url) return;
    let blob;

    if(url.startsWith("data: ")){
        blob=dataUrlToBlob(url);
    }
    else{
        try{
            const response = await fetch(url);
            if(! response.ok){
                console.log(`failed to fetch image from URL: "${url}`);
                return null;
                
            }
            blob = await response.blob();
        }
        catch(error){
            console.error(`Error fetching image`, url, error);
            return null;
        }
    }
    if(!blob.type.startsWith("image/")){
        console.log(`Skipping non-image url ${url}`);
        return null;
    }

    if(blob.type.startsWith("image/svg")){
        console.log(`Skipping SVG image from URL: "${url}`);
        return null;
    }

    try{
        const img = await createImageBitmap(blob);
        return new File([blob], "image", {type: blob.type});
    }catch(error){
        console.error(`Error processing image from url${url}`);
        return null;
    }
}
function recordCategory(category){
    chrome.storage.local.get([`${category}-log]))`]).then((result) => {
        let currentTime = new Date.getTime();
        let log = Array.from(result[`$category}-log`] || []).filter((time) => time > thirtyDaysAgo(),);
        console.log(results);
        chrome.storage.set({[`${category}-log`]:[...log, currentTime]});
    })
}
function thirtyDaysAgo(){
    let currentDate = new Date().getTime();
    let thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return currentDate = thirtyDays;
}

setInterval(() => {
    chrome.storage.local.get(['onlineLog']).then((result => {
        log = Array.from(result.onlineLog || []);
        console.log(log);
        let time = new Date().getTime();
        log.push(time);
        chrome.storage.local.set({onlineLog: log});
    }));
}, 60000);

chrome.runtime.onMessage,addListener(async (request) => {
    if(request.images){
        console.log(request.images.length, "images to process");
        const categoryCount = {};

        const imagePromises = request.images.map(async (imageLink) => {
            const image = await downloadImage(imageLink);
            return {image, imageLink};
        });
        const imagesWithUrls = (await Promise.all(imagePromises)).filter(({image}) => image, );
        console.log(imagesWithUrls);
        console.log(imagesWithUrls.length, "images downloaded");

        const predictionPromises = imagesWithUrls.map(
            async ({ images, imageLink}) => { 
                try{
                    const formData = new FormData();
                    formData.append("image", image);
                    const response = await fetch(imageUrl, {
                        method: "POST",
                        body: formData,
                    });

                    const {predictions: [prediction] = []} = await response.json();
                    if(prediction){
                        const {class: className, confidence} = prediction;
                        if(className !== "background"){
                            console.log(`URL: ${imageLink} | Prediction: ${className} (${(confidence*100).toFixed(2)}%)`);
                            const categories = {
                                profanity: "profanity",
                                explicit: 'explicit-content',
                                drugs: 'drugs',
                                gambling: 'gambling',
                                violence: 'violence',
                                social: 'social-media'
                            };

                            Object.entries(categories).forEach(([key, value]) => {
                                chrome.storage.local.get([value]).then((result) => {
                                    if(className == key && result[value] || result[value] === undefined){
                                        console.log("category", value);
                                        recordCategory(value);
                                        chrome.tabs.query(
                                            {},
                                            (tabs) => {
                                                tabs.forEach((tab) => {
                                                    chrome.tabs.sendMessage(tab.id, {
                                                        action: "removeImage",
                                                        imageLink
                                                    }).catch((error) => {
                                                        console.error(imageLink, error);
                                                    })
                                                })
                                            }
                                        )

                                    
                                    }
                                    else if (className == key && !(result[value] || result[value] === undefined)){
                                        recordCategory("background");
                                        chrome.tabs.query(
                                            {},
                                            (tabs) => {
                                                tabs.forEach((tab) => {
                                                    chrome.tabs.sendMessage(tab.id, {
                                                        action:"revealImage", imageLink,
                                                    }).catch((error) => {
                                                        console.error(`Error revealing image from URL(${imageLink}):${error}`);
                                                    });
                                                });
                                            }
                                        );
                                    }
                                })
                            
                            
                        
                            
    }else if (request.text){
        chrome.storage.local.get([value]).then((result) => {
            if(className == key && result[value] || result[value] === undefined){
                console.log("category", value);
                recordCategory(value);
                chrome.tabs.query(
                    {},
                    (tabs) => {
                        tabs.forEach((tab) => {
                            chrome.tabs.sendMessage(tab.id, {
                                action: "removeImage",
                                imageLink
                            }).catch((error) => {
                                console.error(imageLink, error);
                            })
                        })
                    }
                )

                
            }
            else{
                recordCategory("background");
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: "revealImage",
                            imageLink,
                        }).catch((error) => {
                            console.error("Error revealing image from url", imageLink, error);
                        });
                    });
                });
                categoryCount[className] = (categoryCount[className] || 0) + 1;
            }else{
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: "revealImage",
                            imageLink,
                        }).catch((error) => {
                            console.error("Error revealing image from url", imageLink, error);
                        });
                    });
                    categoryCount["background"] = (categoryCount["background"]);
            }catch(error){
                console.error(error);
            }await Promise.all(predictionPromises);
            console.log('console');
            Object.entries(categoryCount).forEach([category, count]) => {
                console.log(category, count);
            }
            else if (className == key && !(result[value] || result[value] === undefined)){
                return;
            }
        }
else if request.text{
    console.log(request.text.length, "text to process");
    const categoryCount = {};
    const predictionPromises = request.text.map(async(text) => {
        try{
            if(text.trim().length === 0){
                return;
            }

            const formData = new FormData();
            formData.append("text", text);

            const response = await fetch(textUrl, {
                moethod: "POST",
                body: formData,
            });

            const prediction = await response.json();

            if(prediction){
                const {class:className, confidence} = prediction;
                if(className !== "background"){
                    console.log('TEXT', text, className, confidence);
                }
            }
            const categories = {
                profanity: "profanity",
                explicit: 'explicit-content',
                drugs: 'drugs',
                gambling: 'gambling',
                violence: 'violence',
                social: 'social-media'
            };Object.entries(categories).forEach([key, value]) => {
                chrome.storage.local.get([value].then((result => {
                    if(className === key && (result[value] === undefined && confidence > 0.5)){
                        chrome.tabs.query({}, (tabs => {
                            tabs.forEach((tab => {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: "revealImage",
                                    imageLink,
                                }).catch(error) => {
                                    console.error("Error revealing image from url", imageLink, error);
                                })
                            });
                    }
                })))
                categoryCount[className] = (categoryCount[className] || 0) + 1;

                else{
                    console.log(text);
                    categoryCount['background'] = (categoryCount['background'] || 0) + 1;
                }
            }
        }catch (error){
            return;
        }
    });

    await Promise.all(predictionPromises);
    console.log('categories');
    Object.entries(categoryCount).forEach([category, count]) => {
        console.log(category, count);
    }
    })
}
    