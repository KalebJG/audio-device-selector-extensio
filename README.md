# Audio Device Selector Extension

A Chrome extension that allows call center agents to select and manage audio input and output devices on a per-website basis.

## Features

- **Per-Website Device Selection**: Different audio devices for different websites
- **Volume Control**: Adjust input and output volume levels independently
- **Device Testing**: Built-in microphone and speaker testing
- **Persistent Settings**: Saves preferences using Chrome Sync storage
- **Responsive UI**: Clean, user-friendly interface

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/audio-device-selector-extension.git
   cd audio-device-selector-extension
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked" and select the extension directory

### From Chrome Web Store
*(Coming soon)*

## Usage

1. Click the extension icon in the Chrome toolbar
2. Configure your audio settings:
   - **Input Device**: Select your microphone
   - **Output Device**: Select your speakers/headphones
   - **Volume Controls**: Adjust input and output levels
3. Test your setup:
   - Click "Test Sound" to verify output
   - Click "Test Mic" to verify input (records 3 seconds of audio)
4. Save your settings:
   - Click "Save Settings" to apply to the current website
   - Changes are automatically saved for future visits

## Permissions

This extension requires the following permissions:

| Permission | Reason |
|------------|--------|
| `storage` | Save and load device preferences |
| `tabCapture` | Capture audio from tabs |
| `activeTab` | Access the current tab's URL |
| `scripting` | Inject content scripts |
| `tabs` | Manage browser tabs |
| `<all_urls>` | Apply settings to all websites |

## Development

### Project Structure

```
audio-device-selector-extension/
├── .gitignore          # Git ignore file
├── LICENSE             # MIT License
├── README.md           # This file
├── manifest.json       # Extension configuration
├── background.js       # Background script
├── content.js          # Content script
├── assets/             # Icons and assets
│   └── icon.svg        # Extension icon
└── popup/              # Popup UI
    ├── popup.html      # Popup markup
    ├── popup.js        # Popup logic
    └── popup.css       # Popup styles
```

### Building

1. Install dependencies (if any):
   ```bash
   npm install
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For support, please open an issue in the GitHub repository.
