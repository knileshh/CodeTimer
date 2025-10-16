# ⏱️ Codeforces Timer Extension

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.0-blue)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)

A powerful browser extension that provides a floating stopwatch for Codeforces problem-solving with persistent timing, comprehensive statistics, and performance tracking.

## ✨ Features

### 🎯 **Core Timer Functionality**
- **Floating Widget**: Appears only on Codeforces problem pages
- **Real-time Tracking**: Start/Pause/Reset with precise second-by-second updates
- **Draggable Interface**: Repositionable widget with persistent position memory
- **Theme Integration**: Automatic light/dark mode detection matching Codeforces

### 📊 **Advanced Analytics**
- **Comprehensive Stats**: Total time, daily progress, average solve times
- **Problem History**: Track all attempted problems with session details
- **Performance Metrics**: Visualize your improvement over time
- **Solved Tracking**: Mark problems as completed for accurate statistics

### 💾 **Data Management**
- **Persistent Storage**: Timer state survives page reloads and browser restarts
- **Per-Problem Tracking**: Individual timing for each contest problem
- **Local-Only**: No external network calls, complete privacy
- **Data Export**: Clear or manage your historical data

### ⚙️ **User Experience**
- **Minimal Performance Impact**: <2% CPU usage, optimized for efficiency
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Intuitive Controls**: Clean, accessible interface
- **Global Settings**: Enable/disable extension with one click

### ⏰ **Enhanced Countdown Mode**
- **Quick Presets**: 15min, 30min, 45min, 1hr, 2hr countdown options
- **Custom Duration**: Set any countdown time up to 5 hours
- **Visual Warnings**: Color-coded alerts (Green → Orange → Red) as time runs out
- **Progress Bar**: Real-time visual countdown progress indicator
- **Sound Alerts**: Audio notification when countdown completes
- **Smart Notifications**: Enhanced browser notifications with countdown details
- **Auto-Reset**: Automatic timer reset after countdown completion

## 🚀 Quick Start

### Installation (Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/knileshh/CodeTimer.git
   cd codeforces-timer-extension
   ```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project folder

3. **Start tracking**:
   - Navigate to any Codeforces problem page
   - The timer widget will appear automatically
   - Click ▶ to start timing your solution

### Installation (Production)

The extension is available on the Chrome Web Store for easy installation.

## 📖 Usage Guide

### Timer Widget Controls

| Button | Function | Description |
|--------|----------|-------------|
| ▶ | Start | Begin timing your problem-solving session |
| ⏸ | Pause | Temporarily stop the timer |
| ⏹ | Reset | Clear current session and start over |
| ✓ | Solved | Mark problem as completed |
| ⏰ | Countdown | Toggle between stopwatch and countdown modes |
| 📊 | Stats | Open detailed statistics dashboard |

### Enhanced Countdown Mode

The countdown feature helps you practice time management for competitive programming:

1. **Quick Setup**: 
   - Click ⏰ button once to see options, twice for 30min default
   - Keyboard shortcut: `Ctrl+C` for instant countdown toggle
2. **Preset Options**: One-click 15min, 30min, 45min, 1hr, or 2hr countdowns
3. **Custom Duration**: Enter any time in the input field (up to 5 hours)
4. **Smart UX**: Helpful tips and single-click defaults for faster setup
5. **Visual Feedback**: 
   - **Green Progress Bar**: More than 25% time remaining
   - **Orange Warning**: 10-25% time remaining  
   - **Red Alert**: Less than 10% time remaining
6. **Completion Alerts**: Sound notification and browser alert when time expires
7. **Auto-Reset**: Timer automatically resets 5 seconds after completion

### Statistics Dashboard

Access comprehensive analytics through:
- **Extension Popup**: Quick overview and settings
- **Stats Page**: Detailed breakdown of your progress
- **Widget Button**: Direct access from timer

### Data Management

- **Automatic Saving**: Timer state persists across sessions
- **Problem-Specific**: Each problem maintains independent timing
- **History Tracking**: Complete session logs with timestamps
- **Privacy-First**: All data stored locally on your device

## 🏗️ Technical Architecture

### System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Content       │    │   Background     │    │   Popup/Stats   │
│   Script        │◄──►│   Service        │◄──►│   Interface     │
│   (Timer UI)    │    │   Worker         │    │   (Settings)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │ Chrome Storage   │
                    │ (Local Data)     │
                    └──────────────────┘
```

### Data Structure

```javascript
// Storage schema for each problem
{
  "cf_<contestId>_<problemLetter>": {
    "elapsedSeconds": 432,           // Total time spent
    "isRunning": false,              // Current timer state
    "lastUpdated": "2025-01-20T...", // Last modification
    "history": [                     // Session history
      {
        "start": "2025-01-20T12:45:00Z",
        "end": "2025-01-20T13:00:00Z",
        "solved": true               // Completion status
      }
    ]
  }
}
```

### Performance Optimization

- **Efficient Storage**: Batched writes every 5 seconds
- **Memory Management**: Automatic cleanup of old sessions
- **CPU Optimization**: Minimal background processing
- **Network Efficiency**: Zero external dependencies

## 🔧 Development

### Prerequisites

- Node.js 16+ (for development tools)
- Chrome Browser (for testing)
- Git (for version control)

### Project Structure

```
codeforces-timer-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content.js            # Timer widget logic
├── popup.html            # Extension popup
├── popup.js              # Popup functionality
├── stats.html            # Statistics dashboard
├── stats.js              # Stats page logic
├── styles.css            # Shared styling
├── README.md             # Documentation
└── .git/                 # Version control
```

### Building and Testing

1. **Development Mode**:
   ```bash
   # Load extension in Chrome developer mode
   # Make changes to source files
   # Reload extension in chrome://extensions/
   ```

2. **Testing Checklist**:
   - [ ] Timer appears on problem pages only
   - [ ] Start/Pause/Reset functionality works
   - [ ] Position persists after page reload
   - [ ] Theme switching works correctly
   - [ ] Statistics display accurate data
   - [ ] Data clearing functions properly

### Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Code Style

- **ES6+ JavaScript** with modern syntax
- **Consistent naming** conventions (camelCase)
- **Comprehensive comments** for complex logic
- **Error handling** for all async operations

## 🛣️ Roadmap

### Version 1.1 (✅ Completed)
- [x] **Enhanced Countdown Mode**: Quick presets, progress bar, visual warnings
- [x] **Improved UI**: Better visual feedback and user experience
- [x] **Sound Alerts**: Audio notifications for countdown completion
- [x] **Progress Tracking**: Real-time countdown progress visualization

### Version 1.2 (Planned)
- [ ] **Achievement System**: Unlock badges for milestones
- [ ] **Export Data**: Download statistics as CSV/JSON
- [ ] **Keyboard Shortcuts**: Quick timer controls
- [ ] **Custom Themes**: Personalized widget appearance

### Version 1.2 (Future)
- [ ] **ML Predictions**: AI-powered solve time estimates
- [ ] **Multi-Platform**: Support for AtCoder, LeetCode
- [ ] **Team Features**: Collaborative problem solving
- [ ] **Advanced Analytics**: Performance trends and insights

### Version 2.0 (Vision)
- [ ] **Cloud Sync**: Cross-device data synchronization
- [ ] **Social Features**: Share progress with friends
- [ ] **Custom Themes**: Personalized widget appearance
- [ ] **API Integration**: Connect with competitive programming APIs

## 🤝 Community

### Support

- **Issues**: Report bugs or request features on GitHub
- **Discussions**: Join community conversations
- **Documentation**: Comprehensive guides and tutorials

### Resources

- **Chrome Extension Docs**: [developer.chrome.com](https://developer.chrome.com/docs/extensions/)
- **Codeforces API**: [codeforces.com/api](https://codeforces.com/apiHelp)
- **Competitive Programming**: [cp-algorithms.com](https://cp-algorithms.com/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Codeforces** for providing an amazing competitive programming platform
- **Chrome Extension Team** for excellent developer tools and documentation
- **Open Source Community** for inspiration and best practices

---

**Made with ❤️ for the competitive programming community**

*Track your progress, improve your speed, and become a better problem solver!*
