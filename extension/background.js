// background.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.cmd === 'getResourceUsage') { // TODO investigate getProcessInfo returning nothing 
    console.log("Sevice worker received getResourceUsage command");
    chrome.processes.getProcessInfo([], true, procs => {
      // procs is an object keyed by PID; convert to array before sending
      console.log("Processes fetched:", procs);
      const list = Object.values(procs);
      sendResponse({ processes: list });
    });
    return true; // keep the message channel open for async sendResponse
  }
})

const baseUrl = 'https://hs_project-focusshield-ai-server.onrender.com';
const imageUrl = `${baseUrl}/predict_image`;
const textUrl = `${baseUrl}/predict_text`;

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'barrier.html' });
  }
});

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : '';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

async function downloadImage(url) {
  if (!url) return null;
  let blob;
  if (url.startsWith('data:')) {
    blob = dataUrlToBlob(url);
  } else {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch image from URL: "${url}"`);
        return null;
      }
      blob = await response.blob();
    } catch (error) {
      console.error('Error fetching image', url, error);
      return null;
    }
  }
  if (!blob.type.startsWith('image/')) return null;
  if (blob.type.startsWith('image/svg')) return null;
  try {
    await createImageBitmap(blob);
    return new File([blob], 'image', { type: blob.type });
  } catch (error) {
    console.error(`Error processing image from url ${url}`, error);
    return null;
  }
}

function thirtyDaysAgo() {
  return Date.now() - 30 * 24 * 60 * 60 * 1000;
}

function recordCategory(category) {
  const key = `${category}-log`;
  chrome.storage.local.get([key]).then(result => {
    const log = (result[key] || []).filter(time => time > thirtyDaysAgo());
    log.push(Date.now());
    chrome.storage.local.set({ [key]: log });
  });
}

setInterval(() => {
  chrome.storage.local.get(['onlineLog']).then(result => {
    const log = Array.from(result.onlineLog || []);
    log.push(Date.now());
    chrome.storage.local.set({ onlineLog: log });
  });
}, 60000);

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  const categoriesMap = {
    profanity: 'profanity',
    explicit: 'explicit-content',
    drugs: 'drugs',
    gambling: 'gambling',
    violence: 'violence',
    social: 'social-media'
  };

  if (Array.isArray(request.images)) {
    console.log(request.images.length, 'images to process');
    const categoryCount = {};
    const imagePromises = request.images.map(async imageLink => {
      const image = await downloadImage(imageLink);
      return { image, imageLink };
    });
    const imagesWithUrls = (await Promise.all(imagePromises)).filter(item => item.image);
    console.log(imagesWithUrls.length, 'images downloaded');
    const predictionPromises = imagesWithUrls.map(async ({ image, imageLink }) => {
      try {
        const formData = new FormData();
        formData.append('image', image);
        const response = await fetch(imageUrl, { method: 'POST', body: formData });
        const data = await response.json();
        const [prediction] = data.predictions || [];
        const className = prediction?.class;
        const confidence = prediction?.confidence || 0;
        if (className && className !== 'background') {
          console.log(`URL: ${imageLink} | Prediction: ${className} (${(confidence*100).toFixed(2)}%)`);
          const storageKey = categoriesMap[className] || 'background-log';
          chrome.storage.local.get([storageKey]).then(res => {
            const allowed = res[storageKey] !== false;
            if (allowed) {
              recordCategory(storageKey.replace('-log',''));
              chrome.tabs.query({}, tabs => {
                tabs.forEach(tab => {
                  chrome.tabs.sendMessage(tab.id, { action: 'removeImage', imageLink })
                    .catch(err => console.error(err));
                });
              });
              categoryCount[className] = (categoryCount[className] || 0) + 1;
            } else {
              recordCategory('background');
              chrome.tabs.query({}, tabs => {
                tabs.forEach(tab => {
                  chrome.tabs.sendMessage(tab.id, { action: 'revealImage', imageLink })
                    .catch(err => console.error(err));
                });
              });
            }
          });
        }
      } catch (error) {
        console.error(error);
      }
    });
    await Promise.all(predictionPromises);
    console.log('Image categories count:', categoryCount);
  } else if (Array.isArray(request.text)) {
    console.log(request.text.length, 'text to process');
    const categoryCount = {};
    const predictionPromises = request.text.map(async text => {
      const trimmed = text.trim();
      if (!trimmed) return;
      try {
        const formData = new FormData();
        formData.append('text', trimmed);
        const response = await fetch(textUrl, { method: 'POST', body: formData });
        const prediction = await response.json();
        const className = prediction?.class;
        const confidence = prediction?.confidence || 0;
        if (className && className !== 'background' && confidence > 0.5) {
          console.log('TEXT', trimmed, className, confidence);
          categoryCount[className] = (categoryCount[className] || 0) + 1;
        } else {
          categoryCount.background = (categoryCount.background || 0) + 1;
        }
      } catch (error) {
        console.error(error);
      }
    });
    await Promise.all(predictionPromises);
    console.log('Text categories count:', categoryCount);
  }
  sendResponse({ status: 'done' });
  return true;
});
