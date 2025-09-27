// background.js

// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   if (msg.cmd === 'getResourceUsage') { // TODO investigate getProcessInfo returning nothing 
//     console.log("Sevice worker received getResourceUsage command");
//     chrome.processes.getProcessInfo([], true, procs => {
//       // procs is an object keyed by PID; convert to array before sending
//       console.log("Processes fetched:", procs);
//       const list = Object.values(procs);
//       sendResponse({ processes: list });
//     });
//     return true; // keep the message channel open for async sendResponse
//   }
// })

// const baseUrl = 'https://hs_project-focusshield-ai-server.onrender.com';
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

setInterval(() => {
  chrome.storage.local.get(['onlineLog']).then(result => {
    const log = Array.from(result.onlineLog || []);
    log.push(Date.now());
    chrome.storage.local.set({ onlineLog: log });
  });
}, 60000);

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.cmd === 'getResourceUsage') { // TODO investigate getProcessInfo returning nothing 
    console.log("Sevice worker received getResourceUsage command");
    chrome.processes.getProcessInfo([], true, procs => {
      // procs is an object keyed by PID; convert to array before sending
      console.log("Processes fetched:", procs);
      const list = Object.values(procs);
      sendResponse({ processes: list });
    });
    return true; // keep the message channel open for async sendResponse
  }
  
  
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
              // If the received confidence is lower than the set threshold, treat it as 'background'
              const storageKey = categoriesMap[className] || 'background-log';
              chrome.storage.local.get([storageKey]).then(res => {
                const allowed = res[storageKey] !== false;
                if (allowed) {
                  recordCategory(storageKey.replace('-log',''));
                  chrome.tabs.query({}, tabs => {
                    tabs.forEach(tab => {
                      console.log('Removing image in tab', tab.id, imageLink);
                      chrome.tabs.sendMessage(tab.id, { action: 'removeImage', imageLink }, () => {
                        if (chrome.runtime.lastError) {
                          // No receiver in this tab; ignore
                        }
                      });
                    });
                  });
                  categoryCount[className] = (categoryCount[className] || 0) + 1;
                } else if(!className) {
                  recordCategory('background');
                  chrome.tabs.query({}, tabs => {
                    tabs.forEach(tab => {
                      console.log('Revealing image in tab', tab.id, imageLink);
                      chrome.tabs.sendMessage(tab.id, { action: 'revealImage', imageLink }, () => {
                        if (chrome.runtime.lastError) {
                          // No receiver in this tab; ignore
                        }
                      });
                    });
                  });
                }
              });
            } else {
              recordCategory('background');
              chrome.tabs.query({}, tabs => {
                tabs.forEach(tab => {
                  console.log('Revealing image in tab', tab.id, imageLink);
                  chrome.tabs.sendMessage(tab.id, { action: 'revealImage', imageLink }, () => {
                    if (chrome.runtime.lastError) {
                      // No receiver in this tab; ignore
                    }
                  });
                });
              });
            }
          });

          
        } else{
          recordCategory('background');
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              console.log("No detections!!!");
              console.log('Revealing image in tab', tab.id, imageLink);
              chrome.tabs.sendMessage(tab.id, { action: 'revealImage', imageLink }, () => {
                if (chrome.runtime.lastError) {
                  // No receiver in this tab; ignore
                }
              });
            });
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
                  chrome.tabs.query({}, tabs => {
                    tabs.forEach(tab => {
                      console.log('Censoring text in tab', tab.id, text);
                      chrome.tabs.sendMessage(tab.id, { action: 'removeText', text }, () => {
                        if (chrome.runtime.lastError) {
                          // No receiver in this tab; ignore
                        }
                      });
                    });
                  });
                } else if(!category) {
                  recordCategory('background');
                  chrome.tabs.query({}, tabs => {
                    tabs.forEach(tab => {
                      console.log('Revealing text in tab', tab.id, text);
                      chrome.tabs.sendMessage(tab.id, { action: 'revealText', text }, () => {
                        if (chrome.runtime.lastError) {
                          // No receiver in this tab; ignore
                        }
                      });
                    });
                  });
                }
              });
            });
          } else {
            recordCategory('background');
            chrome.tabs.query({}, tabs => {
              tabs.forEach(tab => {
                console.log("No detections!!!");
                console.log('Revealing text in tab', tab.id, text);
                chrome.tabs.sendMessage(tab.id, { action: 'revealText', text }, () => {
                  if (chrome.runtime.lastError) {
                    // No receiver in this tab; ignore
                  }
                });
              });
            });
          }
        } catch (error) {
          console.error(error);
        }
      }
    }
  }

  //   const predictionPromises = request.text.map(async text => {
  //     const trimmed = text.trim();
  //     if (!trimmed) return;
  //     try {
  //       // list of all the sentences

  //       const response = await fetch(textUrl, { method: 'POST', body:  });
  //       const prediction = await response.json();
  //       const className = prediction?.class;
  //       const confidence = prediction?.confidence || 0;
  //       /* Example response:
  //       [{'spans': [{'category': 'drugs', 'end': 7, 'start': 0}, {'category': 'drugs', 'end': 7, 'start': 0}, {'category': 'drugs', 'end': 25, 'start': 16}, {'category': 'drugs', 'end': 32, 'start': 26}], 'text': 'Cocaine cocaine marijuana heroin'}]
  //       */
  //       console.log('Text prediction', prediction);
  //       // TODO: send out command to censor with "█"
  //       // if (className && className !== 'background' && confidence > 0.5) {
  //       //   console.log('TEXT', trimmed, className, confidence);
  //       //   categoryCount[className] = (categoryCount[className] || 0) + 1;
  //       // } else {
  //       //   categoryCount.background = (categoryCount.background || 0) + 1;
  //       // }
  //     } catch (error) {
  //       console.error(error);
  //     }
  //   });
  //   await Promise.all(predictionPromises);
  //   console.log('Text categories count:', categoryCount);
  // }
  sendResponse({ status: 'done' });
  return true;
});
