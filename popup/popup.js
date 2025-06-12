// DOM Elements
const inputDeviceSelect = document.getElementById('input-device');
const outputDeviceSelect = document.getElementById('output-device');
const inputVolume = document.getElementById('input-volume');
const outputVolume = document.getElementById('output-volume');
const inputVolumeValue = document.getElementById('input-volume-value');
const outputVolumeValue = document.getElementById('output-volume-value');
const testSoundBtn = document.getElementById('test-sound');
const testMicBtn = document.getElementById('test-mic');
const resetBtn = document.getElementById('reset-devices');
const statusMessage = document.createElement('div');
statusMessage.className = 'status-message';
document.querySelector('.container').appendChild(statusMessage);
const permissionWarning = document.getElementById('permission-warning');
const retryPermissionBtn = document.getElementById('retry-permission');
const openSettingsBtn = document.getElementById('open-settings');
const permissionRequest = document.getElementById('permission-request');
const grantPermissionBtn = document.getElementById('grant-permission');

// State
let devices = [];
let currentTab = null;
let audioContext = null;
let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        
        // Load saved settings for this website
        await loadSettings();
        
        // Enumerate available devices
        await refreshDevices();
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError('Failed to initialize. Please try again.');
    }
});

// Load saved settings for current website
async function loadSettings() {
    try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;
        
        const result = await chrome.storage.sync.get([domain]);
        const settings = result[domain] || {};
        
        // Update UI with saved settings
        if (settings.inputDeviceId) {
            inputDeviceSelect.value = settings.inputDeviceId;
        }
        
        if (settings.outputDeviceId) {
            outputDeviceSelect.value = settings.outputDeviceId;
        }
        
        if (settings.inputVolume !== undefined) {
            inputVolume.value = settings.inputVolume;
            inputVolumeValue.textContent = `${Math.round(settings.inputVolume * 100)}%`;
        }
        
        if (settings.outputVolume !== undefined) {
            outputVolume.value = settings.outputVolume;
            outputVolumeValue.textContent = `${Math.round(settings.outputVolume * 100)}%`;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save settings for current website
async function saveSettings() {
    if (!currentTab || !currentTab.url) {
        showError('Cannot save settings: No active tab found');
        return;
    }
    
    setLoading(true);
    showStatus('Saving settings...');
    
    try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;
        
        const settings = {
            inputDeviceId: inputDeviceSelect.value,
            outputDeviceId: outputDeviceSelect.value,
            inputVolume: parseFloat(inputVolume.value),
            outputVolume: parseFloat(outputVolume.value),
            lastUpdated: new Date().toISOString()
        };
        
        await chrome.storage.sync.set({ [domain]: settings });
        
        // Notify content script about the change
        try {
            await chrome.tabs.sendMessage(currentTab.id, {
                type: 'AUDIO_DEVICE_UPDATE',
                payload: settings
            });
            showFeedback('Settings saved and applied');
        } catch (error) {
            console.warn('Could not notify content script:', error);
            showFeedback('Settings saved (reload page to apply)');
        }
        
        // Show a brief confirmation
        showStatus('');
    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save settings: ' + error.message);
    } finally {
        setLoading(false);
    }
}

// Enumerate available audio devices
async function refreshDevices() {
    setLoading(true);
    showStatus('Loading audio devices...');
    showPermissionWarning(false);
    
    try {
        // Request permission to access audio devices
        try {
            console.log('[AudioExt] Calling getUserMedia to prompt for mic permission');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: false 
            });
            console.log('[AudioExt] getUserMedia success, stream id:', stream.id);
            // Stop all tracks in the stream to release them
            stream.getTracks().forEach(track => track.stop());
            
            // Hide permission UI if it was shown
            showPermissionWarning(false);
            showPermissionRequest(false);
        } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
                console.error('[AudioExt] Permission error:', error.name, error.message);
                showPermissionWarning(true);
                showPermissionRequest(true);
                showError('Microphone access required to list audio devices');
            } else {
                console.error('[AudioExt] getUserMedia error:', error.name, error.message);
                showError('Failed to access audio devices: ' + error.message);
            }
            setLoading(false);
            return;
        }
        
        try {
            // Get all audio devices
            console.log('[AudioExt] Calling enumerateDevices to list audio devices');
            const deviceList = await navigator.mediaDevices.enumerateDevices();
            console.log('[AudioExt] enumerateDevices returned', deviceList.length, 'devices');
            deviceList.forEach(d => console.log('  kind:', d.kind, 'label:', d.label || '(no label)', 'id:', d.deviceId));
            devices = deviceList.filter(device => 
                device.kind === 'audioinput' || device.kind === 'audiooutput'
            );
            
            // Populate input devices
            const inputDevices = devices.filter(device => device.kind === 'audioinput');
            populateDeviceSelect(inputDeviceSelect, inputDevices, 'Microphone');
            
            // Populate output devices
            const outputDevices = devices.filter(device => device.kind === 'audiooutput');
            populateDeviceSelect(outputDeviceSelect, outputDevices, 'Speakers');
            
            // Re-apply current selections if they exist
            await loadSettings();
            showStatus('');
        } catch (error) {
            console.error('Error enumerating devices:', error);
            showError('Failed to list audio devices: ' + error.message);
        }
    } finally {
        setLoading(false);
    }
}

// Populate a device select dropdown
function populateDeviceSelect(selectElement, devices, defaultLabel) {
    // Save current selection
    const currentValue = selectElement.value;
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = `Default ${defaultLabel}`;
    selectElement.appendChild(defaultOption);
    
    // Check if we have any devices
    if (devices.length === 0) {
        const option = document.createElement('option');
        option.value = 'no-devices';
        option.textContent = `No ${defaultLabel}s found`;
        option.disabled = true;
        selectElement.appendChild(option);
        return;
    }
    
    // Check if we have labels (permission granted)
    const hasLabels = devices.some(device => device.label && device.label.length > 0);
    
    // Add each device as an option
    devices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        
        // Use label if available, otherwise use generic name
        if (device.label) {
            option.textContent = device.label;
        } else {
            option.textContent = `${defaultLabel} ${index + 1}`;
            // If we don't have labels, we need permission
            if (index === 0 && !hasLabels) {
                showPermissionRequest(true);
            }
        }
        
        selectElement.appendChild(option);
    });
    
    // Restore selection if it exists
    if (currentValue && devices.some(d => d.deviceId === currentValue)) {
        selectElement.value = currentValue;
    }
}

// Set up event listeners
function setupEventListeners() {
    // Device selection changes
    inputDeviceSelect.addEventListener('change', saveSettings);
    outputDeviceSelect.addEventListener('change', saveSettings);
    
    // Volume changes
    inputVolume.addEventListener('input', (e) => {
        inputVolumeValue.textContent = `${Math.round(e.target.value * 100)}%`;
        saveSettings();
    });
    
    outputVolume.addEventListener('input', (e) => {
        outputVolumeValue.textContent = `${Math.round(e.target.value * 100)}%`;
        saveSettings();
    });
    
    // Test buttons
    testSoundBtn.addEventListener('click', playTestSound);
    testMicBtn.addEventListener('click', testMicrophone);
    
    // Reset button
    resetBtn.addEventListener('click', resetToDefaults);
    
    retryPermissionBtn.addEventListener('click', refreshDevices);
    openSettingsBtn.addEventListener('click', () => {
        const extId = chrome.runtime.id;
        chrome.tabs.create({
            url: `chrome://settings/content/siteDetails?site=chrome-extension://${extId}`
        });
    });
    
    // Grant permission button
    grantPermissionBtn.addEventListener('click', requestMicrophonePermission);
    
    // Check if we have permission already
    if (navigator.permissions && navigator.permissions.query) {
        try {
            navigator.permissions.query({ name: 'microphone' })
                .then(permissionStatus => {
                    console.log('[AudioExt] Initial permission status:', permissionStatus.state);
                    if (permissionStatus.state === 'denied') {
                        showPermissionRequest(true);
                    }
                })
                .catch(err => console.warn('[AudioExt] Could not query permission status:', err));
        } catch (e) {
            console.warn('[AudioExt] Could not query permission status:', e);
        }
    }
}

// Play test sound on selected output device
async function playTestSound() {
    try {
        // Create audio context if it doesn't exist
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create oscillator
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Play sound
        oscillator.start();
        
        // Stop after 1 second
        setTimeout(() => {
            oscillator.stop();
            oscillator.disconnect();
            gainNode.disconnect();
        }, 1000);
        
        showFeedback('Playing test sound');
    } catch (error) {
        console.error('Error playing test sound:', error);
        showError('Failed to play test sound');
    }
}

// Test microphone recording and playback
async function testMicrophone() {
    try {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            // Stop recording if already recording
            mediaRecorder.stop();
            testMicBtn.textContent = 'Record & Playback Mic';
            return;
        }
        
        // Get selected input device
        const constraints = {
            audio: {
                deviceId: inputDeviceSelect.value ? { exact: inputDeviceSelect.value } : undefined,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
            video: false
        };
        
        // Request microphone access
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set up media recorder
        mediaRecorder = new MediaRecorder(mediaStream);
        audioChunks = [];
        
        // Collect audio data
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        // When recording stops, play back the recorded audio
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            // Set output device if selected
            if (outputDeviceSelect.value) {
                try {
                    await audio.setSinkId(outputDeviceSelect.value);
                } catch (err) {
                    console.warn('Could not set sinkId:', err);
                }
            }
            
            // Play the recorded audio
            audio.volume = outputVolume.value;
            audio.play();
            
            // Clean up
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                    mediaStream = null;
                }
            };
        };
        
        // Start recording
        mediaRecorder.start();
        testMicBtn.textContent = 'Stop Recording';
        showFeedback('Recording... Click again to stop');
        
        // Auto-stop after 5 seconds
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                testMicBtn.textContent = 'Record & Playback Mic';
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error testing microphone:', error);
        showError('Failed to access microphone');
        testMicBtn.textContent = 'Record & Playback Mic';
    }
}

// Reset to default devices for current website
async function resetToDefaults() {
    try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;
        
        // Remove settings for this domain
        await chrome.storage.sync.remove(domain);
        
        // Reset UI to defaults
        inputDeviceSelect.value = '';
        outputDeviceSelect.value = '';
        inputVolume.value = 1;
        outputVolume.value = 1;
        inputVolumeValue.textContent = '100%';
        outputVolumeValue.textContent = '100%';
        
        // Notify content script
        chrome.tabs.sendMessage(currentTab.id, {
            type: 'AUDIO_DEVICE_RESET'
        });
        
        showFeedback('Settings reset to defaults');
    } catch (error) {
        console.error('Error resetting settings:', error);
        showError('Failed to reset settings');
    }
}

// Set loading state for the UI
function setLoading(isLoading) {
    const container = document.querySelector('.container');
    if (isLoading) {
        container.classList.add('loading');
    } else {
        container.classList.remove('loading');
    }
}

// Show status message to the user
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message' + (isError ? ' error' : '');
    
    if (message) {
        // Auto-hide non-error messages after 3 seconds
        if (!isError) {
            setTimeout(() => {
                if (statusMessage.textContent === message) {
                    statusMessage.textContent = '';
                }
            }, 3000);
        }
    }
}

// Show feedback message to the user
function showFeedback(message) {
    console.log('Feedback:', message);
    showStatus(message, false);
}

// Show error message to the user
function showError(message) {
    console.error('Error:', message);
    showStatus(message, true);
}

// Show permission warning to the user
function showPermissionWarning(show = true) {
    permissionWarning.classList.toggle('hidden', !show);
}

// Show permission request UI
function showPermissionRequest(show = true) {
    permissionRequest.classList.toggle('hidden', !show);
}

// Request microphone permission explicitly
async function requestMicrophonePermission() {
    showStatus('Requesting microphone permission...');
    setLoading(true);
    
    try {
        console.log('[AudioExt] Explicitly requesting microphone permission');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[AudioExt] Permission granted!');
        stream.getTracks().forEach(track => track.stop());
        
        // Hide permission UI
        showPermissionRequest(false);
        showPermissionWarning(false);
        
        // Refresh devices now that we have permission
        await refreshDevices();
    } catch (error) {
        console.error('[AudioExt] Permission request failed:', error.name, error.message);
        showError('Could not get microphone permission: ' + error.message);
        setLoading(false);
    }
}
