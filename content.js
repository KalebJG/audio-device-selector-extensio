// Content script for Audio Device Selector extension

// Check if the browser supports the required APIs
if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    console.error('Audio Device Selector: This browser does not support the required Web APIs');
}

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'AUDIO_DEVICE_UPDATE') {
        applyAudioSettings(request.payload);
    } else if (request.type === 'AUDIO_DEVICE_RESET') {
        resetAudioSettings();
    }
    return true;
});

// Apply audio settings to the page
async function applyAudioSettings(settings) {
    if (!settings) {
        console.warn('Audio Device Selector: No settings provided');
        return;
    }

    console.log('Audio Device Selector: Applying settings', settings);
    
    try {
        // Apply to existing media elements
        await applyToExistingMediaElements(settings);
        
        // For WebRTC audio tracks (common in VoIP apps)
        if (settings.inputDeviceId || settings.inputVolume !== undefined) {
            await applyToWebRTCTracks(settings);
        }
        
        // Set up mutation observer to handle dynamically added elements
        setupMutationObserver(settings);
        
        console.log('Audio Device Selector: Settings applied successfully');
    } catch (error) {
        console.error('Audio Device Selector: Error applying settings:', error);
    }
}

// Apply settings to existing audio/video elements
async function applyToExistingMediaElements(settings) {
    // Get all audio and video elements on the page
    const audioElements = document.getElementsByTagName('audio');
    const videoElements = document.getElementsByTagName('video');
    const mediaElements = [...audioElements, ...videoElements];
    
    if (mediaElements.length === 0) {
        console.log('Audio Device Selector: No media elements found on the page');
        return;
    }
    
    // Apply settings to each media element
    const promises = mediaElements.map(element => applySettingsToElement(element, settings));
    await Promise.allSettled(promises);
}

// Apply settings to a single media element
async function applySettingsToElement(element, settings) {
    try {
        // Set output device if specified and supported
        if (settings.outputDeviceId && typeof element.setSinkId === 'function') {
            try {
                await element.setSinkId(settings.outputDeviceId);
                console.log('Audio Device Selector: Set output device to', settings.outputDeviceId);
            } catch (sinkError) {
                console.warn('Audio Device Selector: Could not set output device:', sinkError.message);
                
                // If permission denied, we need to handle it specially
                if (sinkError.name === 'NotAllowedError') {
                    console.warn('Audio Device Selector: Permission denied for setSinkId. User interaction may be required.');
                    // Could dispatch a custom event here that the popup could listen for
                }
            }
        }
        
        // Set volume if specified
        if (settings.outputVolume !== undefined) {
            element.volume = parseFloat(settings.outputVolume);
        }
    } catch (error) {
        console.warn('Audio Device Selector: Error applying settings to element:', error);
    }
}

// Apply settings to WebRTC audio tracks
async function applyToWebRTCTracks(settings) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Audio Device Selector: WebRTC APIs not available');
        return;
    }
    
    try {
        // Create constraints object
        const constraints = { audio: true };
        
        // Add input device constraint if specified
        if (settings.inputDeviceId) {
            constraints.audio = { deviceId: { exact: settings.inputDeviceId } };
        }
        
        // Get audio stream with constraints
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const tracks = stream.getAudioTracks();
        
        // Apply volume constraint if specified
        if (settings.inputVolume !== undefined && tracks.length > 0) {
            try {
                await tracks[0].applyConstraints({
                    volume: parseFloat(settings.inputVolume)
                });
                console.log('Audio Device Selector: Set input volume to', settings.inputVolume);
            } catch (error) {
                console.warn('Audio Device Selector: Could not set input volume:', error.message);
            }
        }
        
        // Stop all tracks
        tracks.forEach(track => track.stop());
    } catch (error) {
        console.warn('Audio Device Selector: Error applying WebRTC settings:', error.message);
    }
}

// Reset audio settings to defaults
function resetAudioSettings() {
    // This will effectively reset to browser defaults since we're not applying any constraints
    console.log('Audio Device Selector: Audio settings reset to defaults');
    
    // Disconnect any active mutation observers
    if (window._audioDeviceSelectorObserver) {
        window._audioDeviceSelectorObserver.disconnect();
        window._audioDeviceSelectorObserver = null;
    }
}

// Set up mutation observer to handle dynamically added media elements
function setupMutationObserver(settings) {
    // Disconnect any existing observer
    if (window._audioDeviceSelectorObserver) {
        window._audioDeviceSelectorObserver.disconnect();
    }
    
    // Create a new observer
    window._audioDeviceSelectorObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    // Check if the added node is a media element
                    if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                        applySettingsToElement(node, settings);
                    }
                    
                    // Check for media elements within added nodes
                    if (node.querySelectorAll) {
                        const mediaElements = node.querySelectorAll('audio, video');
                        for (const element of mediaElements) {
                            applySettingsToElement(element, settings);
                        }
                    }
                }
            }
        }
    });
    
    // Start observing the document with the configured parameters
    window._audioDeviceSelectorObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('Audio Device Selector: Mutation observer set up for dynamic media elements');
}

// Initial check for saved settings when the script loads
async function checkSavedSettings() {
    try {
        const url = new URL(window.location.href);
        const domain = url.hostname;
        
        // Get settings from storage
        const result = await chrome.storage.sync.get([domain]);
        const settings = result[domain];
        
        if (settings) {
            console.log('Audio Device Selector: Applying saved settings for', domain);
            await applyAudioSettings(settings);
        } else {
            console.log('Audio Device Selector: No saved settings for', domain);
        }
    } catch (error) {
        console.error('Audio Device Selector: Error checking saved settings:', error);
    }
}

// Run initial settings check when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkSavedSettings);
} else {
    checkSavedSettings();
}

// Run initial check
checkSavedSettings();
