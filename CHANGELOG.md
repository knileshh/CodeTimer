# Changelog

All notable changes to the Codeforces Timer Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-20

### Added
- Initial release of Codeforces Timer Extension
- Floating timer widget with Start/Pause/Reset functionality
- Draggable interface with position persistence
- Theme-aware styling (light/dark mode support)
- Comprehensive statistics dashboard
- Per-problem timer state persistence using Chrome Storage API
- Extension popup with settings and quick stats
- Background service worker for state management
- Problem page detection for Codeforces contests
- Session history tracking with timestamps
- Mark problems as solved functionality
- Data management (clear all data with confirmation)
- Global extension enable/disable toggle
- Responsive design for desktop and mobile
- Performance optimizations (batched storage writes)
- Error handling and graceful degradation
- Modern Chrome Extension Manifest V3 compatibility

### Technical Details
- Built with vanilla JavaScript (ES6+)
- Uses Chrome Extension APIs (storage, runtime, tabs)
- Local-only data storage (no external network calls)
- Optimized for minimal CPU usage (<2% idle)
- Cross-tab synchronization support
- Memory leak prevention on navigation

### Browser Support
- Chrome 88+
- Edge 88+ (Chromium-based)
- Manifest V3 compatible

## [1.1.0] - 2025-01-20

### Added
- **Keyboard Shortcuts**: Space for Start/Pause, Ctrl+R for Reset, Ctrl+S for Solved, Esc to close
- **Countdown Mode**: Set target times for problems with visual countdown display
- **Enhanced Notifications**: Browser notifications for countdown completion
- **Visual Feedback**: Color-coded warnings when countdown approaches target
- **Performance Optimizations**: Batched storage writes every 5 seconds
- **Improved Error Handling**: Graceful error recovery with try-catch blocks

### Technical Improvements
- Better memory management with timeout cleanup
- Enhanced accessibility with keyboard navigation
- Improved user experience with tooltips and visual cues
- Optimized storage operations for better performance

## [Unreleased]

### Planned Features
- Countdown mode with custom target times
- Achievement system with badges and milestones
- Data export functionality (CSV/JSON)
- Keyboard shortcuts for quick timer controls
- Enhanced analytics with performance trends
- Multi-platform support (AtCoder, LeetCode)
- Cloud synchronization for cross-device usage
- Custom themes and personalization options
- Social features for sharing progress
- ML-powered solve time predictions

### Known Issues
- None currently reported

### Security
- All data stored locally on user's device
- No external network requests
- No user data collection or tracking
- Privacy-first approach with local-only storage
