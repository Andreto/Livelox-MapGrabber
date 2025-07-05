// Storage for captured map data
let mapData = [];
let dataCounter = 0;

// Monitor only GET requests to Livelox blob storage
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // Only process GET requests to blob storage from Livelox viewer
    if (details.method === 'GET' && 
        details.url.startsWith('https://livelox.blob.core.windows.net/class-storage/')) {
      
      // Check if the request is from a Livelox viewer tab
      // Ensure tabId is valid (non-negative) before calling tabs.get
      if (details.tabId >= 0) {
        try {
          const tab = await chrome.tabs.get(details.tabId);
          if (tab.url && tab.url.startsWith('https://www.livelox.com/Viewer/')) {
            // Fetch and parse the response content
            fetchAndParseMapData(details.url, details.timeStamp);
          }
        } catch (error) {
          console.error('Error checking tab URL:', error);
        }
      } else {
        // For requests without a valid tab ID, we can't verify the source
        // You might want to log this or handle it differently based on your needs
        console.log('Request without valid tab ID, skipping tab verification:', details.url);
      }
    }
  },
  { 
    urls: ["https://livelox.blob.core.windows.net/class-storage/*"] 
  }
);

// Fetch and parse map data from blob response
async function fetchAndParseMapData(url, timestamp) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
      return;
    }

    // Get response content as text
    const contentText = await response.text();
    
    // Try to parse as JSON
    let parsedData;
    try {
      parsedData = JSON.parse(contentText);
    } catch (parseError) {
      console.log('Response is not JSON, skipping:', url);
      return;
    }

    // Check if this contains map data with images
    if (parsedData.map && parsedData.map.images && Array.isArray(parsedData.map.images)) {
      
      // Extract map images - filter out thumbnails
      const mapImages = parsedData.map.images
        .filter(image => !image.isThumbnail) // Exclude thumbnail images
        .map(image => ({
          id: image.id,
          url: image.url,
          width: image.width,
          height: image.height,
          fileSize: image.fileSize
        }));

      // Only proceed if we have non-thumbnail images
      if (mapImages.length === 0) {
        console.log('No non-thumbnail images found in response:', url);
        return;
      }

      // Extract projection data if available
      let projectionData = null;
      if (parsedData.map.projection && parsedData.map.projection.matrix) {
        projectionData = {
          epsgCode: parsedData.map.projection.epsgCode || null,
          matrix: parsedData.map.projection.matrix,
          lengthUnit: parsedData.map.projection.lengthUnit || 1
        };
      } else if (false && parsedData.map.defaultProjection && parsedData.map.defaultProjection.matrix) {
        projectionData = {
          epsgCode: parsedData.map.defaultProjection.epsgCode || null,
          matrix: parsedData.map.defaultProjection.matrix,
          lengthUnit: parsedData.map.defaultProjection.lengthUnit || 1
        };
      }

      // Create map data record
      const mapDataRecord = {
        id: ++dataCounter,
        sourceUrl: url,
        timestamp: timestamp,
        capturedAt: Date.now(),
        mapName: parsedData.map.name || 'Unknown Map',
        mapId: parsedData.map.identifier?.id || 'Unknown ID',
        system: parsedData.map.identifier?.system || 'Unknown System',
        isHidden: parsedData.map.isHidden || false,
        hiddenUntil: parsedData.map.hiddenUntil || null,
        imageFormat: parsedData.map.imageFormat || 'Unknown',
        images: mapImages,
        totalImages: mapImages.length,
        projection: projectionData
      };

      // Store map data
      mapData.unshift(mapDataRecord);
      
      // Limit to last 20 map data records to prevent memory issues
      if (mapData.length > 20) {
        mapData = mapData.slice(0, 20);
      }

      // Store in chrome.storage for popup access
      try {
        await chrome.storage.local.set({ mapData: mapData });
        
        // Notify popup if open
        notifyMapDataPopup(mapDataRecord);
        
        console.log('Captured map data:', mapDataRecord.mapName, 'with', mapImages.length, 'non-thumbnail images');
        if (projectionData) {
          console.log('Projection data available - EPSG:', projectionData.epsgCode);
        }
      } catch (storageError) {
        console.error('Error storing map data:', storageError);
      }
      
    } else {
      console.log('Response does not contain map image data:', url);
    }
    
  } catch (error) {
    console.error('Error fetching/parsing map data:', error);
  }
}

// Generate world file content from projection matrix
function generateWorldFile(projectionMatrix) {
  if (!projectionMatrix || !Array.isArray(projectionMatrix) || projectionMatrix.length !== 3) {
    throw new Error('Invalid projection matrix');
  }

  const matrix = projectionMatrix;
  
  // Extract transformation parameters from 3x3 matrix
  // Matrix format: [[A, B, C], [D, E, F], [0, 0, 1]]
  const A = matrix[0][0]; // X-scale (pixel width in world units)
  const B = matrix[0][1]; // Y-rotation
  const C = matrix[0][2]; // X-translation (X coordinate of top-left pixel)
  const D = matrix[1][0]; // X-rotation  
  const E = matrix[1][1]; // Y-scale (pixel height in world units, typically negative)
  const F = matrix[1][2]; // Y-translation (Y coordinate of top-left pixel)

  // World file format (6 lines):
  // Line 1: A (pixel width)
  // Line 2: D (rotation about y-axis) 
  // Line 3: B (rotation about x-axis)
  // Line 4: E (pixel height, negative)
  // Line 5: C (x-coordinate of center of top left pixel)
  // Line 6: F (y-coordinate of center of top left pixel)
  
  return [
    A.toString(),
    D.toString(), 
    B.toString(),
    E.toString(),
    C.toString(),
    F.toString()
  ].join('\n');
}

// Notify popup of new map data
function notifyMapDataPopup(mapDataRecord) {
  chrome.runtime.sendMessage({
    action: 'newMapData',
    data: mapDataRecord
  }).catch(() => {
    // Popup might not be open, ignore error silently
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getMapData':
      chrome.storage.local.get(['mapData']).then(result => {
        sendResponse({ mapData: result.mapData || [] });
      }).catch(error => {
        console.error('Error getting map data:', error);
        sendResponse({ mapData: [] });
      });
      return true; // Keep message channel open for async response
      
    case 'clearMapData':
      chrome.storage.local.set({ mapData: [] }).then(() => {
        mapData = [];
        dataCounter = 0;
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error clearing map data:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'generateWorldFile':
      try {
        const { projectionMatrix, imageId } = request;
        if (!projectionMatrix) {
          sendResponse({ error: 'No projection data available' });
          return false;
        }
        
        const worldFileContent = generateWorldFile(projectionMatrix);
        sendResponse({ 
          success: true, 
          content: worldFileContent,
          filename: `map_${imageId || 'unknown'}.wld`
        });
      } catch (error) {
        console.error('Error generating world file:', error);
        sendResponse({ error: error.message });
      }
      return false;
      
    default:
      // Unknown action
      sendResponse({ error: 'Unknown action' });
      return false;
  }
});

// Clean up old map data periodically (every 30 minutes)
setInterval(() => {
  const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
  const originalLength = mapData.length;
  
  mapData = mapData.filter(data => data.capturedAt > twoHoursAgo);
  
  // Update storage if data was cleaned up
  if (mapData.length !== originalLength) {
    chrome.storage.local.set({ mapData: mapData }).catch(error => {
      console.error('Error updating storage during cleanup:', error);
    });
  }
}, 30 * 60 * 1000);