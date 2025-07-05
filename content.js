// Content script for additional webpage interaction
// This script runs in the context of web pages and can capture additional information

console.log('Network Request Monitor - Content script loaded');

// Optional: Listen for fetch requests made by the page's JavaScript
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    console.log('Fetch request intercepted:', {
        url: url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        timestamp: new Date().toISOString()
    });
    
    // Call the original fetch and return the promise
    return originalFetch.apply(this, args);
};

// Optional: Listen for XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this._requestInfo = {
        method: method,
        url: url,
        timestamp: new Date().toISOString()
    };
    
    console.log('XHR request opened:', this._requestInfo);
    
    return originalXHROpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function(body) {
    if (this._requestInfo) {
        this._requestInfo.body = body;
        console.log('XHR request sent:', this._requestInfo);
    }
    
    return originalXHRSend.apply(this, arguments);
};

// Send page information to background script
chrome.runtime.sendMessage({
    action: 'pageInfo',
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString()
});
