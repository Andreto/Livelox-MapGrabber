# Network Request Monitor Chrome Extension

A Chrome extension that captures and monitors network requests made by web pages, similar to the Network tab in Chrome DevTools.

## Features

- **Real-time Network Monitoring**: Captures all HTTP/HTTPS requests made by web pages
- **Request Details**: Shows method, URL, headers, status codes, response times, and more
- **Filtering**: Filter requests by URL, method, or request type
- **Request/Response Analysis**: View detailed information about each request including:
  - Request headers and body
  - Response headers and status codes
  - Request timing and duration
  - Error information for failed requests
- **Clean Interface**: Easy-to-use popup interface with DevTools-like styling

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this extension directory
4. The Network Request Monitor icon will appear in your Chrome toolbar

## Usage

1. Click the extension icon in the Chrome toolbar to open the monitoring popup
2. Navigate to any website - requests will be automatically captured
3. Click on any request in the list to view detailed information
4. Use the filter box to search for specific requests
5. Use "Clear" to remove all captured requests
6. Use "Refresh" to update the display with new requests

## Permissions

This extension requires the following permissions:
- `webRequest`: To intercept and analyze network requests
- `storage`: To store captured request data
- `activeTab`: To access the current tab
- `tabs`: To identify which tab made the request
- `<all_urls>`: To monitor requests from all websites

## Technical Details

### Architecture
- **Manifest V3**: Uses the latest Chrome extension format
- **Service Worker**: Background script that captures network events
- **Content Script**: Runs on web pages to capture JavaScript-initiated requests
- **Popup Interface**: Displays captured requests in a user-friendly format

### Files
- `manifest.json`: Extension configuration and permissions
- `background.js`: Service worker that captures network requests
- `popup.html/js`: User interface for viewing requests
- `content.js`: Content script for additional request capture
- `icons/`: Extension icons

### Captured Information
- Request URL and method
- Request and response headers
- Request body (for POST/PUT requests)
- Response status codes
- Request timing and duration
- Error information for failed requests
- Request initiator information

## Development

To modify or extend this extension:

1. Make changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test functionality on various websites

## Limitations

- Only captures requests that the Chrome webRequest API can intercept
- Some requests may be filtered by Chrome's security policies
- Storage is limited to prevent memory issues (max 1000 requests)

## Privacy

This extension only monitors network requests locally within your browser. No data is sent to external servers or stored permanently.

## License

This project is open source and available under the MIT License.
