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
        // Get all audio and video elements on the page
        const audioElements = document.getElementsByTagName('audio');
        const videoElements = document.getElementsByTagName('video');
        const mediaElements = [...audioElements, ...videoElements];
        
        if (mediaElements.length === 0) {
            console.log('Audio Device Selector: No media elements found on the page');
        }
        
        // Apply settings to media elements
        for (const element of mediaElements) {
            try {
                // Set output device if specified and supported
                if (settings.outputDeviceId && typeof element.setSinkId === 'function') {
                    try {
                        await element.setSinkId(settings.outputDeviceId);
                        console.log('Audio Device Selector: Set output device to', settings.outputDeviceId);
                    } catch (sinkError) {
                        console.warn('Audio Device Selector: Could not set output device:', sinkError);
                    }
                }
                
                // Set volume if specified
                if (settings.outputVolume !== undefined) {
                    try {
                        element.volume = parseFloat(settings.outputVolume);
                        console.log('Audio Device Selector: Set volume to', settings.outputVolume);
                    } catch (volumeError) {
                        console.warn('Audio Device Selector: Could not set volume:', volumeError);
                    }
                }
            } catch (error) {
                console.warn('Audio Device Selector: Error applying settings to element:', error);
            }
        }
        
        // For WebRTC audio tracks (common in VoIP apps)
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const tracks = stream.getAudioTracks();
            
            // Apply settings to audio tracks
            for (const track of tracks) {
                if (settings.inputVolume !== undefined) {
                    track.applyConstraints({
                        volume: settings.inputVolume
                    });
                }
                track.stop(); // Stop the track since we just needed it for constraints
            }
        }
        
        console.log('Audio settings applied:', settings);
    } catch (error) {
        console.error('Error applying audio settings:', error);
    }
}

// Reset audio settings to defaults
function resetAudioSettings() {
    // This will effectively reset to browser defaults since we're not applying any constraints
    console.log('Audio settings reset to defaults');
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
