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
}