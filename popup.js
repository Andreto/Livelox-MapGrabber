class LiveloxMapGrabber {
    constructor() {
        this.mapData = [];
        this.isInitialized = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadMapData();
        this.setupMessageListener();
    }
    
    initializeElements() {
        // Check if all required elements exist
        this.status = document.getElementById('status');
        this.mapList = document.getElementById('mapList');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        if (!this.status || !this.mapList || !this.refreshBtn || !this.clearBtn) {
            console.error('Required DOM elements not found');
            return;
        }
        
        this.isInitialized = true;
    }
    
    attachEventListeners() {
        if (!this.isInitialized) return;
        
        this.refreshBtn.addEventListener('click', () => this.loadMapData());
        this.clearBtn.addEventListener('click', () => this.clearMapData());
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'newMapData' && this.isInitialized) {
                this.mapData.unshift(message.data);
                this.renderMapList();
                this.updateStatus(`New map captured: ${message.data.mapName}`);
            }
        });
    }
    
    async loadMapData() {
        if (!this.isInitialized) return;
        
        try {
            this.updateStatus('Loading map data...');
            const response = await chrome.runtime.sendMessage({ action: 'getMapData' });
            
            if (response && response.mapData) {
                this.mapData = response.mapData;
                this.renderMapList();
                this.updateStatus(`${this.mapData.length} maps loaded`);
            } else {
                this.mapData = [];
                this.renderMapList();
                this.updateStatus('No map data found');
            }
        } catch (error) {
            console.error('Error loading map data:', error);
            this.showError('Failed to load map data: ' + error.message);
        }
    }
    
    async clearMapData() {
        if (!this.isInitialized) return;
        
        try {
            this.updateStatus('Clearing data...');
            const response = await chrome.runtime.sendMessage({ action: 'clearMapData' });
            
            if (response && response.success) {
                this.mapData = [];
                this.renderMapList();
                this.updateStatus('All data cleared');
            } else {
                this.showError('Failed to clear data');
            }
        } catch (error) {
            console.error('Error clearing map data:', error);
            this.showError('Failed to clear data: ' + error.message);
        }
    }
    
    renderMapList() {
        if (!this.isInitialized || !this.mapList) return;
        
        if (this.mapData.length === 0) {
            this.mapList.innerHTML = `
                <div class="no-data">
                    No map data captured yet.<br>
                    Navigate to a Livelox viewer page to start capturing map images.
                </div>
            `;
            return;
        }
        
        try {
            this.mapList.innerHTML = this.mapData.map(map => `
                <div class="map-item">
                    <div class="map-header">${this.escapeHtml(map.mapName)}</div>
                    <div class="map-meta">
                        ID: ${this.escapeHtml(map.mapId)} | System: ${this.escapeHtml(map.system)} | 
                        Captured: ${new Date(map.capturedAt).toLocaleString()} |
                        Images: ${map.totalImages} | Format: ${this.escapeHtml(map.imageFormat)}
                        ${map.isHidden ? ' | HIDDEN' : ''}
                        ${map.projection ? ` | EPSG:${map.projection.epsgCode || 'Unknown'}` : ' | No Projection'}
                    </div>
                    <div class="image-links">
                        ${map.images.map(image => this.renderImageLink(image, map)).join('')}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering map list:', error);
            this.showError('Error displaying map data');
        }
    }
    
    renderImageLink(image, map) {
        const sizeInfo = `${image.width || 0}×${image.height || 0}`;
        const fileSizeInfo = this.formatFileSize(image.fileSize);
        
        // Check if projection data is available for world file generation
        const hasProjection = map.projection && map.projection.matrix;
        const worldFileButton = hasProjection ? 
            `<button class="world-file-btn" data-image-id="${image.id}" data-map-id="${map.id}">↓ Worldfile</button>` : '';
        
        return `
            <div class="image-item">
                <a href="${this.escapeHtml(image.url)}" target="_blank" class="image-link">
                    Map Image ${this.escapeHtml(image.id)}
                    <span class="image-info">(${sizeInfo}, ${fileSizeInfo})</span>
                </a>
                ${worldFileButton}
            </div>
        `;
    }
    
    async downloadWorldFile(imageId, mapId) {
        try {
            // Find the map data
            const mapData = this.mapData.find(m => m.id === mapId);
            if (!mapData || !mapData.projection) {
                this.showError('No projection data available for this map');
                return;
            }
            
            // Generate world file
            const response = await chrome.runtime.sendMessage({
                action: 'generateWorldFile',
                projectionMatrix: mapData.projection.matrix,
                imageId: imageId
            });
            
            if (response.error) {
                this.showError('Error generating world file: ' + response.error);
                return;
            }
            
            // Create and download file
            const blob = new Blob([response.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = response.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.updateStatus(`Downloaded world file: ${response.filename}`);
            
        } catch (error) {
            console.error('Error downloading world file:', error);
            this.showError('Failed to download world file: ' + error.message);
        }
    }
    
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return 'Unknown size';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
    
    updateStatus(message) {
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    showError(message) {
        if (this.status) {
            this.status.innerHTML = `<span style="color: #f44336;">${this.escapeHtml(message)}</span>`;
        }
        console.error('Popup error:', message);
    }
}

// Initialize when popup loads and handle delegated events
document.addEventListener('DOMContentLoaded', () => {
    try {
        const grabber = new LiveloxMapGrabber();
        
        // Handle world file download button clicks using event delegation
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('world-file-btn')) {
                const imageId = event.target.dataset.imageId;
                const mapId = parseInt(event.target.dataset.mapId);
                
                if (imageId && mapId) {
                    grabber.downloadWorldFile(imageId, mapId);
                }
            }
        });
        
    } catch (error) {
        console.error('Failed to initialize LiveloxMapGrabber:', error);
    }
});