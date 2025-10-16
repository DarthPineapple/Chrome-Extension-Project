// background.js

const baseUrl = "http://localhost:5003"
const imageUrl = `${baseUrl}/predict_image`;
const textBaseUrl = 'http://localhost:5004';
const textUrl = `${textBaseUrl}/predict_text`;

// Server limits
const MAX_TEXTS_PER_BATCH = 100;  // Match server limit
const MAX_TEXT_LENGTH = 5000;     // Match server limit
const MAX_IMAGE_BATCH = 10;       // Process images in smaller batches

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: 'barrier.html' });
  }
});

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : '';

  // Allow SVG images now
  // if (mime.startsWith('image/svg')) return null;

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
    if (!blob) return null;
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
  // Allow SVG now - removed the SVG filter
  // if (blob.type.startsWith('image/svg')) return null;
  
  // Validate against allowed MIME types
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(blob.type)) {
    console.warn(`Unsupported image type: ${blob.type} for URL: ${url}`);
    return null;
  }
  
  try {
    // Skip bitmap validation for SVG
    if (blob.type !== 'image/svg+xml') {
      await createImageBitmap(blob);
    }
    
    // Generate proper filename with extension based on MIME type
    const extensionMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    const extension = extensionMap[blob.type] || 'jpg';
    const filename = `image.${extension}`;
    return new File([blob], filename, { type: blob.type });
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

async function checkServerHealth(url) {
  try {
    const response = await fetch(`${url}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('Server health check failed:', error);
    return false;
  }
}

async function processImagesInBatches(images, batchSize = MAX_IMAGE_BATCH) {
  const categoryCount = {};
  
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    console.log(`Processing image batch ${i / batchSize + 1} of ${Math.ceil(images.length / batchSize)}`);
    
    const imagePromises = batch.map(async imageLink => {
      const image = await downloadImage(imageLink);
      return { image, imageLink };
    });
    
    const imagesWithUrls = (await Promise.all(imagePromises)).filter(item => item.image);
    console.log(imagesWithUrls.length, 'images downloaded in this batch');
    
    const predictionPromises = imagesWithUrls.map(async ({ image, imageLink }) => {
      try {
        const formData = new FormData();
        formData.append('image', image);
        
        // Log file details for debugging
        console.log(`Sending image: ${image.name}, type: ${image.type}, size: ${image.size} bytes`);
        
        const response = await fetch(imageUrl, { method: 'POST', body: formData });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Image prediction error:', error);
          // If rate limited, wait and retry
          if (response.status === 429) {
            console.warn('Rate limited, waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          return;
        }
        
        const data = await response.json();
        const [prediction] = data.predictions || [];
        const className = prediction?.class;
        const confidence = prediction?.confidence || 0;
        console.log('Image prediction', imageLink, className, confidence);
        
        if (className && className !== 'background') {
          console.log(`URL: ${imageLink} | Prediction: ${className} (${(confidence*100).toFixed(2)}%)`);
          
          try {
            const result = await chrome.storage.local.get(['confidence']);
            const threshold = result.confidence ?? 0.5;

            if (confidence >= threshold) {
              const storageKey = categoriesMap[className] || 'background-log';
              const res = await chrome.storage.local.get([storageKey]);
              const allowed = res[storageKey] !== false;
              if (allowed) {
                recordCategory(storageKey.replace('-log',''));
                console.log('Removing image in all tabs', imageLink);
                sendMessageToAllTabs({ action: 'removeImage', imageLink });
                categoryCount[className] = (categoryCount[className] || 0) + 1;
              } else {
                recordCategory('background');
                console.log('Revealing image in all tabs (category blocked)', imageLink);
                sendMessageToAllTabs({ action: 'revealImage', imageLink });
              }
            } else {
              recordCategory('background');
              console.log('Revealing image in all tabs (low confidence)', imageLink);
              sendMessageToAllTabs({ action: 'revealImage', imageLink });
            }
          } catch (error) {
            console.error('Storage error:', error);
          }
        } else {
          recordCategory('background');
          console.log("No detections - revealing image in all tabs", imageLink);
          sendMessageToAllTabs({ action: 'revealImage', imageLink });
        }
      } catch (error) {
        console.error('Image processing error:', error);
      }
    });
    
    await Promise.all(predictionPromises);
  }
  
  return categoryCount;
}

async function processTextsInBatches(texts, batchSize = MAX_TEXTS_PER_BATCH) {
  const categoryCount = {};
  
  // Filter and truncate texts
  const validTexts = texts
    .filter(t => t && t.trim())
    .map(t => t.length > MAX_TEXT_LENGTH ? t.substring(0, MAX_TEXT_LENGTH) : t);
  
  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize);
    console.log(`Processing text batch ${i / batchSize + 1} of ${Math.ceil(validTexts.length / batchSize)}`);
    
    try {
      const response = await fetch(textUrl, {
        method: 'POST',
        body: JSON.stringify({ text: batch }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Text prediction error:', error);
        // If rate limited, wait and retry
        if (response.status === 429) {
          console.warn('Rate limited, waiting 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          i -= batchSize; // Retry this batch
          continue;
        }
        continue;
      }
      
      const predictions = await response.json();
      console.log('Text predictions received:', predictions.length);
      
      // Process each text's predictions
      for (let j = 0; j < predictions.length; j++) {
        const text = batch[j];
        const spans = predictions[j]?.spans || [];
        
        if (spans.length > 0) {
          const detectedCategories = new Set();
          spans.forEach(span => {
            const category = span.category;
            detectedCategories.add(category);
            categoryCount[category] = (categoryCount[category] || 0) + 1;
          });
          
          for (const category of detectedCategories) {
            const storageKey = categoriesMap[category] || 'background-log';
            try {
              const res = await chrome.storage.local.get([storageKey]);
              const allowed = res[storageKey] !== false;
              if (allowed) {
                recordCategory(storageKey.replace('-log',''));
                console.log('Censoring text in all tabs', text);
                sendMessageToAllTabs({ action: 'removeText', text });
              } else {
                recordCategory('background');
                console.log('Revealing text in all tabs (category blocked)', text);
                sendMessageToAllTabs({ action: 'revealText', text });
              }
            } catch (error) {
              console.error('Storage error:', error);
            }
          }
        } else {
          recordCategory('background');
          console.log("No detections - revealing text in all tabs", text);
          sendMessageToAllTabs({ action: 'revealText', text });
        }
      }
    } catch (error) {
      console.error('Text batch processing error:', error);
    }
  }
  
  return categoryCount;
}

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
    
    // Check image server health
    const imageServerHealthy = await checkServerHealth(baseUrl);
    if (!imageServerHealthy) {
      console.error('Image server is not healthy');
      sendResponse({ status: 'error', message: 'Image server unavailable' });
      return true;
    }
    
    const categoryCount = await processImagesInBatches(request.images);
    console.log('Image categories count:', categoryCount);
  } else if (Array.isArray(request.text)) {
    console.log(request.text.length, 'text to process');
    
    // Check text server health
    const textServerHealthy = await checkServerHealth(textBaseUrl);
    if (!textServerHealthy) {
      console.error('Text server is not healthy');
      sendResponse({ status: 'error', message: 'Text server unavailable' });
      return true;
    }
    
    const categoryCount = await processTextsInBatches(request.text);
    console.log('Text categories count:', categoryCount);
  }

  sendResponse({ status: 'done' });
  return true;
});
