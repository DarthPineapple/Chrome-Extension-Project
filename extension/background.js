// background.js

const baseUrl = "http://localhost:5003"
const imageUrl = `${baseUrl}/predict_image`;
const textBaseUrl = 'http://localhost:5004';
const textUrl = `${textBaseUrl}/predict_text`;

// Server limits
const MAX_TEXTS_PER_BATCH = 100;  // Match server limit
const MAX_TEXT_LENGTH = 5000;     // Match server limit
const MAX_IMAGE_BATCH = 10;       // Process images in smaller batches
const MAX_CONCURRENT_REQUESTS = 5; // Maximum concurrent requests per type

const categoriesMap = {
  profanity: 'profanity',
  explicit: 'explicit-content',
  drugs: 'drugs',
  gambling: 'gambling',
  violence: 'violence',
  social: 'social-media'
};

// Track active requests
let activeImageRequests = 0;
let activeTextRequests = 0;

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
  const batches = [];
  
  // Split into batches
  for (let i = 0; i < images.length; i += batchSize) {
    batches.push(images.slice(i, i + batchSize));
  }
  
  console.log(`Processing ${images.length} images in ${batches.length} batches`);
  
  // Process batches with concurrency limit
  const processBatch = async (batch, batchIndex) => {
    // Wait if we're at the concurrency limit
    while (activeImageRequests >= MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    activeImageRequests++;
    console.log(`Processing image batch ${batchIndex + 1}/${batches.length} (${activeImageRequests} active)`);
    
    try {
      const imagePromises = batch.map(async imageLink => {
        const image = await downloadImage(imageLink);
        return { image, imageLink };
      });
      
      const imagesWithUrls = (await Promise.all(imagePromises)).filter(item => item.image);
      
      const predictionPromises = imagesWithUrls.map(async ({ image, imageLink }) => {
        try {
          const formData = new FormData();
          formData.append('image', image);
          
          const response = await fetch(imageUrl, { method: 'POST', body: formData });
          
          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Image prediction error:', error);
            if (response.status === 429) {
              console.warn('Rate limited, waiting 500ms...');
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            return;
          }
          
          const data = await response.json();
          const [prediction] = data.predictions || [];
          const className = prediction?.class;
          const confidence = prediction?.confidence || 0;
          
          if (className && className !== 'background') {
            try {
              const result = await chrome.storage.local.get(['confidence']);
              const threshold = result.confidence ?? 0.5;

              if (confidence >= threshold) {
                const storageKey = categoriesMap[className] || 'background-log';
                const res = await chrome.storage.local.get([storageKey]);
                const allowed = res[storageKey] !== false;
                if (allowed) {
                  recordCategory(storageKey.replace('-log',''));
                  sendMessageToAllTabs({ action: 'removeImage', imageLink });
                  categoryCount[className] = (categoryCount[className] || 0) + 1;
                } else {
                  recordCategory('background');
                  sendMessageToAllTabs({ action: 'revealImage', imageLink });
                }
              } else {
                recordCategory('background');
                sendMessageToAllTabs({ action: 'revealImage', imageLink });
              }
            } catch (error) {
              console.error('Storage error:', error);
            }
          } else {
            recordCategory('background');
            sendMessageToAllTabs({ action: 'revealImage', imageLink });
          }
        } catch (error) {
          console.error('Image processing error:', error);
        }
      });
      
      await Promise.all(predictionPromises);
    } finally {
      activeImageRequests--;
    }
  };
  
  // Process all batches concurrently (up to limit)
  await Promise.all(batches.map((batch, index) => processBatch(batch, index)));
  
  return categoryCount;
}

async function processTextsInBatches(texts, batchSize = MAX_TEXTS_PER_BATCH) {
  const categoryCount = {};
  
  // Filter and truncate texts
  const validTexts = texts
    .filter(t => t && t.trim())
    .map(t => t.length > MAX_TEXT_LENGTH ? t.substring(0, MAX_TEXT_LENGTH) : t);
  
  const batches = [];
  for (let i = 0; i < validTexts.length; i += batchSize) {
    batches.push(validTexts.slice(i, i + batchSize));
  }
  
  console.log(`Processing ${validTexts.length} texts in ${batches.length} batches`);
  
  const processBatch = async (batch, batchIndex) => {
    // Wait if we're at the concurrency limit
    while (activeTextRequests >= MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    activeTextRequests++;
    console.log(`Processing text batch ${batchIndex + 1}/${batches.length} (${activeTextRequests} active)`);
    
    try {
      const response = await fetch(textUrl, {
        method: 'POST',
        body: JSON.stringify({ text: batch }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Text prediction error:', error);
        if (response.status === 429) {
          console.warn('Rate limited, waiting 500ms...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        return;
      }
      
      const predictions = await response.json();
      
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
                sendMessageToAllTabs({ action: 'removeText', text });
              } else {
                recordCategory('background');
                sendMessageToAllTabs({ action: 'revealText', text });
              }
            } catch (error) {
              console.error('Storage error:', error);
            }
          }
        } else {
          recordCategory('background');
          sendMessageToAllTabs({ action: 'revealText', text });
        }
      }
    } catch (error) {
      console.error('Text batch processing error:', error);
    } finally {
      activeTextRequests--;
    }
  };
  
  // Process all batches concurrently (up to limit)
  await Promise.all(batches.map((batch, index) => processBatch(batch, index)));
  
  return categoryCount;
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('Received request:', request);

  if (Array.isArray(request.images)) {
    console.log(request.images.length, 'images to process');
    
    // Process immediately without health check delay
    processImagesInBatches(request.images).then(categoryCount => {
      console.log('Image categories count:', categoryCount);
    }).catch(error => {
      console.error('Image processing error:', error);
    });
    
    sendResponse({ status: 'processing' });
  } else if (Array.isArray(request.text)) {
    console.log(request.text.length, 'text to process');
    
    // Process immediately without health check delay
    processTextsInBatches(request.text).then(categoryCount => {
      console.log('Text categories count:', categoryCount);
    }).catch(error => {
      console.error('Text processing error:', error);
    });
    
    sendResponse({ status: 'processing' });
  }

  return true;
});
