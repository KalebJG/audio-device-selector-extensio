// Background script for Audio Device Selector extension

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Audio Device Selector: Extension installed');
        // Set default settings if needed
        chrome.storage.sync.set({
            version: '1.0.0',
            installedAt: new Date().toISOString()
        });
    } else if (details.reason === 'update') {
        console.log(`Audio Device Selector: Updated from ${details.previousVersion} to 1.0.0`);
    }
});

// Handle messages between popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Forward device listing requests to the popup
    if (request.type === 'GET_AUDIO_DEVICES') {
        // Forward the request to the popup if it's open
        chrome.runtime.sendMessage(request, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Audio Device Selector: Error forwarding message to popup:', 
                    chrome.runtime.lastError);
                sendResponse({ error: 'Failed to communicate with popup' });
            } else {
                sendResponse(response);
            }
        });
        return true; // Required for async sendResponse
    }
    
    // Handle other message types here if needed
    return false;
});

// Listen for tab updates to apply audio settings when page loads
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only proceed if the page has finished loading and has a valid URL
    if (changeInfo.status !== 'complete' || !tab.url) {
        return;
    }
    
    try {
        // Skip chrome://, about:, and other non-http(s) URLs
        if (!tab.url.startsWith('http')) {
            return;
        }
        
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        // Get saved settings for this domain
        const result = await chrome.storage.sync.get([domain]);
        const settings = result[domain];
        
        if (settings) {
            console.log(`Audio Device Selector: Applying saved settings for ${domain}`);
            
            // Send settings to content script
            try {
                await chrome.tabs.sendMessage(tabId, {
                    type: 'AUDIO_DEVICE_UPDATE',
                    payload: settings
                });
            } catch (error) {
                console.warn(`Audio Device Selector: Could not send settings to tab ${tabId}:`, error);
                // The content script might not be injected yet, we'll try again when it loads
            }
        }
    } catch (error) {
        console.error('Audio Device Selector: Error in tab update handler:', error);
    }
});

// Listen for when a tab is replaced (e.g., when a page is restored from bfcache)
chrome.webNavigation.onTabReplaced.addListener(async (details) => {
    try {
        const tab = await chrome.tabs.get(details.tabId);
        if (tab.url) {
            const url = new URL(tab.url);
            const domain = url.hostname;
            
            const result = await chrome.storage.sync.get([domain]);
            const settings = result[domain];
            
            if (settings) {
                console.log(`Audio Device Selector: Reapplying settings to restored tab for ${domain}`);
                
                try {
                    await chrome.tabs.sendMessage(details.tabId, {
                        type: 'AUDIO_DEVICE_UPDATE',
                        payload: settings
                    });
                } catch (error) {
                    console.warn('Audio Device Selector: Could not send settings to restored tab:', error);
                }
            }
        }
    } catch (error) {
        console.error('Audio Device Selector: Error in tab replaced handler:', error);
    }
});
