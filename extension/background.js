// background.js

const baseUrl = "http://localhost:5003"
const imageUrl = `${baseUrl}/predict_image`;
const textBaseUrl = 'http://localhost:5004';
const textUrl = `${textBaseUrl}/predict_text`;

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'barrier.html' });
  }
});

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : '';

  // Skip svg images
  if (mime.startsWith('image/svg')) return null;

  try {
    let bytes;
    if (/;base64/i.test(header)) {
      // Base64-encoded data
      const binary = atob(data);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      bytes = array;
    } else {
      // URI-encoded data (e.g., ;utf8,<svg ...>)
      const decoded = decodeURIComponent(data);
      bytes = new TextEncoder().encode(decoded);
    }
    return new Blob([bytes], { type: mime || 'application/octet-stream' });
  } catch (e) {
    console.error('Failed to decode data URL', e, { header, sample: data?.slice(0, 64) });
    return null;
  }
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

function sendMessageToAllTabs(message) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message, () => {
        if (chrome.runtime.lastError) {
          // No receiver in this tab; ignore
        }
      });
    });
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

  console.log('Received request:', request);

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
        console.log('Image prediction', imageLink, className, confidence);
        if (className && className !== 'background') {
          console.log(`URL: ${imageLink} | Prediction: ${className} (${(confidence*100).toFixed(2)}%)`);
          
          // Check the user preference for confidence threshold
          chrome.storage.local.get(['confidence']).then(result => {
            const threshold = result.confidence ?? 0.5;

            if (confidence >= threshold) {
              const storageKey = categoriesMap[className] || 'background-log';
              chrome.storage.local.get([storageKey]).then(res => {
                const allowed = res[storageKey] !== false;
                if (allowed) {
                  recordCategory(storageKey.replace('-log',''));
                  console.log('Removing image in all tabs', imageLink);
                  sendMessageToAllTabs({ action: 'removeImage', imageLink });
                  categoryCount[className] = (categoryCount[className] || 0) + 1;
                } else if(!className) {
                  recordCategory('background');
                  console.log('Revealing image in all tabs', imageLink);
                  sendMessageToAllTabs({ action: 'revealImage', imageLink });
                }
              });
            } else {
              recordCategory('background');
              console.log('Revealing image in all tabs (low confidence)', imageLink);
              sendMessageToAllTabs({ action: 'revealImage', imageLink });
            }
          });

          
        } else{
          recordCategory('background');
          console.log("No detections - revealing image in all tabs", imageLink);
          sendMessageToAllTabs({ action: 'revealImage', imageLink });
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
    const sentences = request.text.filter(t => t.trim());

    if (sentences.length > 0) {
      for (var i = 0; i < sentences.length; i ++) {
        const text = sentences[i];
        try {
          const response = await fetch(textUrl, { method: 'POST', body: JSON.stringify({ text: [text] }), headers: { 'Content-Type': 'application/json' } });
          const predictions = await response.json();
          console.log('Text prediction', predictions);
          const spans = predictions?.[0]?.spans || [];
          if (spans.length > 0) {
            const detectedCategories = new Set();
            spans.forEach(span => {
              const category = span.category;
              detectedCategories.add(category);
              categoryCount[category] = (categoryCount[category] || 0) + 1;
            });
            detectedCategories.forEach(category => {
              const storageKey = categoriesMap[category] || 'background-log';
              chrome.storage.local.get([storageKey]).then(res => {
                const allowed = res[storageKey] !== false;
                if (allowed) {
                  recordCategory(storageKey.replace('-log',''));
                  console.log('Censoring text in all tabs', text);
                  sendMessageToAllTabs({ action: 'removeText', text });
                } else if(!category) {
                  recordCategory('background');
                  console.log('Revealing text in all tabs', text);
                  sendMessageToAllTabs({ action: 'revealText', text });
                }
              });
            });
          } else {
            recordCategory('background');
            console.log("No detections - revealing text in all tabs", text);
            sendMessageToAllTabs({ action: 'revealText', text });
          }
        } catch (error) {
          console.error(error);
        }
      }
    }
  }

  sendResponse({ status: 'done' });
  return true;
});
