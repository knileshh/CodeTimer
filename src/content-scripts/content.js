// Content script for Codeforces Timer Extension
class CodeforcesTimer {
  constructor() {
    // Start performance monitoring
    if (window.performanceMonitor) {
      window.startTiming('timer-initialization');
    }

    this.problemKey = null;
    this.timerState = {
      elapsedSeconds: 0,
      isRunning: false,
      lastUpdated: new Date().toISOString(),
      history: [],
      countdownMode: false,
      countdownTarget: 0
    };
    this.widget = null;
    this.intervalId = null;
    this.isExtensionEnabled = true;
    this.saveTimeout = null; // For batching storage writes
    this.cleanupFunctions = []; // Track cleanup functions
    this.isDestroyed = false; // Prevent operations after destruction

    this.init();
  }

  async init() {
    // Check if we're on a problem page
    if (!this.isProblemPage()) {
      return;
    }

    // Check if extension is enabled
    const enabled = await this.getExtensionEnabled();
    if (!enabled) {
      return;
    }

    // Generate problem key
    this.problemKey = this.generateProblemKey();

    // Load existing timer state
    await this.loadTimerState();

    // Create and inject timer widget
    this.createTimerWidget();

    // Setup message listeners
    this.setupMessageListeners();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Start timer if it was running
    if (this.timerState.isRunning) {
      this.startTimer();
    }

    // End performance monitoring for initialization
    if (window.performanceMonitor) {
      window.endTiming('timer-initialization');
    }
  }

  isProblemPage() {
    const url = window.location.href;
    return url.includes('/problem/') || (url.includes('/contest/') && url.includes('/problem/'));
  }

  generateProblemKey() {
    const url = window.location.href;
    const match = url.match(/\/contest\/(\d+)\/problem\/([A-Z])/);
    if (match) {
      return `cf_${match[1]}_${match[2]}`;
    }

    // Fallback for other problem page formats
    const pathParts = window.location.pathname.split('/');
    const contestId = pathParts[pathParts.length - 2];
    const problemLetter = pathParts[pathParts.length - 1];
    return `cf_${contestId}_${problemLetter}`;
  }

  async getExtensionEnabled() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'GET_TIMER_STATE',
          problemKey: 'dummy'
        },
        response => {
          resolve(response?.enabled !== false);
        }
      );
    });
  }

  async loadTimerState() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'GET_TIMER_STATE',
          problemKey: this.problemKey
        },
        response => {
          if (response?.success) {
            this.timerState = response.state;
            this.isExtensionEnabled = response.enabled;
          }
          resolve();
        }
      );
    });
  }

  createTimerWidget() {
    // Remove existing widget if any
    const existingWidget = document.getElementById('cf-timer-widget');
    if (existingWidget) {
      existingWidget.remove();
    }

    // Create widget container
    this.widget = document.createElement('div');
    this.widget.id = 'cf-timer-widget';
    this.widget.innerHTML = `
      <div class="cf-timer-header">
        <span 
          class="cf-timer-title" 
          title="Space: Start/Pause | Ctrl+R: Reset | Ctrl+S: Solved | Ctrl+C: Countdown | Esc: Close"
        >
          Timer
        </span>
        <button class="cf-timer-close" title="Close Timer (Esc)">×</button>
      </div>
      <div class="cf-timer-display">
        <span class="cf-timer-time">${this.formatTime(this.timerState.elapsedSeconds)}</span>
      </div>
      <div class="cf-timer-controls">
        <button class="cf-timer-btn cf-timer-start" title="Start Timer">▶</button>
        <button class="cf-timer-btn cf-timer-pause" title="Pause Timer">⏸</button>
        <button class="cf-timer-btn cf-timer-reset" title="Reset Timer">⏹</button>
        <button class="cf-timer-btn cf-timer-solved" title="Mark as Solved">✓</button>
        <button class="cf-timer-btn cf-timer-countdown" title="Toggle Countdown Mode">⏰</button>
      </div>
      <div class="cf-timer-countdown-panel" style="display: none;">
        <div class="cf-countdown-help">
          <small>💡 Tip: Click ⏰ again for quick 30min countdown</small>
        </div>
        <div class="cf-timer-presets">
          <button class="cf-timer-preset" data-minutes="15">15m</button>
          <button class="cf-timer-preset" data-minutes="30">30m</button>
          <button class="cf-timer-preset" data-minutes="45">45m</button>
          <button class="cf-timer-preset" data-minutes="60">1h</button>
          <button class="cf-timer-preset" data-minutes="120">2h</button>
        </div>
        <input 
          type="number" 
          class="cf-timer-custom-input" 
          placeholder="Custom minutes" 
          min="1" 
          max="300"
        >
        <div class="cf-timer-progress-bar">
          <div class="cf-timer-progress-fill"></div>
        </div>
      </div>
      <div class="cf-timer-stats">
        <button class="cf-timer-stats-btn" title="View Stats">📊</button>
      </div>
    `;

    // Add to page
    document.body.appendChild(this.widget);

    // Setup event listeners
    this.setupWidgetEventListeners();

    // Make draggable
    this.makeDraggable();

    // Apply theme
    this.applyTheme();

    // Load saved position
    this.loadWidgetPosition();

    // Update countdown button state
    this.updateCountdownButton();
  }

  setupWidgetEventListeners() {
    const startBtn = this.widget.querySelector('.cf-timer-start');
    const pauseBtn = this.widget.querySelector('.cf-timer-pause');
    const resetBtn = this.widget.querySelector('.cf-timer-reset');
    const solvedBtn = this.widget.querySelector('.cf-timer-solved');
    const countdownBtn = this.widget.querySelector('.cf-timer-countdown');
    const closeBtn = this.widget.querySelector('.cf-timer-close');
    const statsBtn = this.widget.querySelector('.cf-timer-stats-btn');

    startBtn.addEventListener('click', () => this.startTimer());
    pauseBtn.addEventListener('click', () => this.pauseTimer());
    resetBtn.addEventListener('click', () => this.resetTimer());
    solvedBtn.addEventListener('click', () => this.markAsSolved());
    countdownBtn.addEventListener('click', () => this.toggleCountdownMode());
    closeBtn.addEventListener('click', () => this.hideWidget());
    statsBtn.addEventListener('click', () => this.openStats());

    // Enhanced countdown mode event listeners
    const presetButtons = this.widget.querySelectorAll('.cf-timer-preset');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes);
        this.setCountdownTarget(minutes);
      });
    });

    const customInput = this.widget.querySelector('.cf-timer-custom-input');
    customInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        const minutes = parseInt(customInput.value);
        if (minutes && minutes > 0) {
          this.setCountdownTarget(minutes);
          customInput.value = '';
        }
      }
    });
  }

  makeDraggable() {
    const header = this.widget.querySelector('.cf-timer-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const mouseDownHandler = e => {
      if (e.target.classList.contains('cf-timer-close') || this.isDestroyed) {
        return;
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.widget.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      this.widget.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const mouseMoveHandler = e => {
      if (!isDragging || this.isDestroyed) {
        return;
      }

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      this.widget.style.left = `${startLeft + deltaX}px`;
      this.widget.style.top = `${startTop + deltaY}px`;
    };

    const mouseUpHandler = () => {
      if (isDragging && !this.isDestroyed) {
        isDragging = false;
        this.widget.style.cursor = 'grab';
        this.saveWidgetPosition();
      }
    };

    header.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);

    // Track cleanup functions
    this.cleanupFunctions.push(() => {
      header.removeEventListener('mousedown', mouseDownHandler);
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    });
  }

  applyTheme() {
    const isDark =
      document.body.classList.contains('dark') ||
      document.documentElement.classList.contains('dark');

    this.widget.classList.toggle('cf-timer-dark', isDark);
  }

  async loadWidgetPosition() {
    return new Promise(resolve => {
      chrome.storage.local.get(['timerWidgetPosition'], result => {
        const position = result.timerWidgetPosition;
        if (position) {
          this.widget.style.left = `${position.x}px`;
          this.widget.style.top = `${position.y}px`;
        } else {
          // Default position
          this.widget.style.left = '20px';
          this.widget.style.top = '100px';
        }
        resolve();
      });
    });
  }

  saveWidgetPosition() {
    const rect = this.widget.getBoundingClientRect();
    chrome.storage.local.set({
      timerWidgetPosition: {
        x: rect.left,
        y: rect.top
      }
    });
  }

  startTimer() {
    if (this.timerState.isRunning || this.isDestroyed) {
      return;
    }

    this.timerState.isRunning = true;
    this.timerState.currentSessionStart = new Date().toISOString();

    this.intervalId = setInterval(() => {
      if (this.isDestroyed) {
        this.pauseTimer();
        return;
      }

      if (this.timerState.countdownMode) {
        this.timerState.elapsedSeconds++;
        // Check if countdown target reached
        if (this.timerState.elapsedSeconds >= this.timerState.countdownTarget) {
          this.pauseTimer();
          this.showCountdownComplete();
        }
      } else {
        this.timerState.elapsedSeconds++;
      }
      this.updateDisplay();
      this.saveTimerState();
    }, 1000);

    this.updateButtonStates();
  }

  pauseTimer() {
    if (!this.timerState.isRunning) {
      return;
    }

    this.timerState.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Save current session
    if (this.timerState.currentSessionStart) {
      this.timerState.history.push({
        start: this.timerState.currentSessionStart,
        end: new Date().toISOString()
      });
      delete this.timerState.currentSessionStart;
    }

    this.updateButtonStates();
    this.saveTimerState();
  }

  resetTimer() {
    this.pauseTimer();
    this.timerState.elapsedSeconds = 0;
    this.timerState.history = [];
    this.updateDisplay();
    this.saveTimerState();
  }

  markAsSolved() {
    this.pauseTimer();
    // Add solved marker to history
    if (this.timerState.history.length > 0) {
      this.timerState.history[this.timerState.history.length - 1].solved = true;
    }
    this.saveTimerState();

    // Visual feedback
    const solvedBtn = this.widget.querySelector('.cf-timer-solved');
    solvedBtn.textContent = '✓';
    solvedBtn.style.backgroundColor = '#4CAF50';
    setTimeout(() => {
      solvedBtn.textContent = '✓';
      solvedBtn.style.backgroundColor = '';
    }, 2000);
  }

  updateDisplay() {
    const timeDisplay = this.widget.querySelector('.cf-timer-time');

    if (this.timerState.countdownMode) {
      const remaining = this.timerState.countdownTarget - this.timerState.elapsedSeconds;

      if (remaining <= 0) {
        timeDisplay.textContent = '00:00';
        timeDisplay.style.color = '#f44336';
      } else {
        timeDisplay.textContent = this.formatTime(remaining);

        // Color-coded warnings
        const percentRemaining = (remaining / this.timerState.countdownTarget) * 100;
        if (percentRemaining <= 10) {
          timeDisplay.style.color = '#f44336'; // Red - critical
        } else if (percentRemaining <= 25) {
          timeDisplay.style.color = '#FF9800'; // Orange - warning
        } else {
          timeDisplay.style.color = '#2196F3'; // Blue - normal
        }
      }
    } else {
      timeDisplay.textContent = this.formatTime(this.timerState.elapsedSeconds);
      timeDisplay.style.color = '#2196F3';
    }

    this.updateProgressBar();
  }

  updateProgressBar() {
    const progressBar = this.widget.querySelector('.cf-timer-progress-fill');

    if (this.timerState.countdownMode && this.timerState.countdownTarget > 0) {
      const remaining = this.timerState.countdownTarget - this.timerState.elapsedSeconds;
      const progress = Math.max(0, (remaining / this.timerState.countdownTarget) * 100);

      progressBar.style.width = `${progress}%`;

      // Color-coded progress bar
      if (progress <= 10) {
        progressBar.style.backgroundColor = '#f44336'; // Red
      } else if (progress <= 25) {
        progressBar.style.backgroundColor = '#FF9800'; // Orange
      } else {
        progressBar.style.backgroundColor = '#4CAF50'; // Green
      }

      progressBar.parentElement.style.display = 'block';
    } else {
      progressBar.parentElement.style.display = 'none';
    }
  }

  showCountdownComplete() {
    const timeDisplay = this.widget.querySelector('.cf-timer-time');
    timeDisplay.textContent = 'TIME UP!';
    timeDisplay.style.color = '#f44336';
    timeDisplay.style.fontWeight = 'bold';

    // Add pulsing animation
    timeDisplay.style.animation = 'pulse 1s infinite';

    // Show enhanced notification
    if (Notification.permission === 'granted') {
      new Notification('🚨 Countdown Complete!', {
        body: `Your ${this.timerState.countdownTarget / 60} minute countdown has finished!`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="18" font-size="18">⏰</text></svg>',
        requireInteraction: true,
        tag: 'countdown-complete'
      });
    }

    // Show toast notification as backup
    this.showToast("⏰ Countdown Complete! Time's up!");

    // Play sound alert (if available)
    this.playAlertSound();

    // Auto-reset after 5 seconds
    setTimeout(() => {
      if (this.timerState.countdownMode) {
        timeDisplay.style.animation = '';
        timeDisplay.style.fontWeight = 'normal';
        this.resetTimer();
      }
    }, 5000);
  }

  playAlertSound() {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
    } catch (error) {
      // Fallback - no sound if Web Audio API is not available
      console.log('Sound alert not available');
    }
  }

  updateButtonStates() {
    const startBtn = this.widget.querySelector('.cf-timer-start');
    const pauseBtn = this.widget.querySelector('.cf-timer-pause');

    if (this.timerState.isRunning) {
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-block';
    } else {
      startBtn.style.display = 'inline-block';
      pauseBtn.style.display = 'none';
    }
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  async saveTimerState() {
    if (this.isDestroyed) {
      return;
    }

    // Start performance monitoring
    if (window.performanceMonitor) {
      window.startTiming('save-timer-state');
    }

    // Clear existing timeout to batch writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Batch storage writes every 5 seconds for better performance
    this.saveTimeout = setTimeout(async () => {
      if (this.isDestroyed) {
        return;
      }

      try {
        await chrome.runtime.sendMessage({
          type: 'SAVE_TIMER_STATE',
          problemKey: this.problemKey,
          state: this.timerState
        });

        // Record successful save
        if (window.performanceMonitor) {
          window.endTiming('save-timer-state');
          window.recordMetric('storage-save-success', 1);
        }
      } catch (error) {
        console.warn('Failed to save timer state:', error);

        // Record failed save
        if (window.performanceMonitor) {
          window.endTiming('save-timer-state');
          window.recordMetric('storage-save-error', 1, { error: error.message });
        }
      }
    }, 5000);
  }

  hideWidget() {
    this.widget.style.display = 'none';
  }

  openStats() {
    chrome.runtime.sendMessage({
      type: 'OPEN_STATS'
    });
  }

  toggleCountdownMode() {
    const countdownPanel = this.widget.querySelector('.cf-timer-countdown-panel');

    if (this.timerState.countdownMode) {
      // Switch to stopwatch mode
      this.timerState.countdownMode = false;
      this.timerState.countdownTarget = 0;
      countdownPanel.style.display = 'none';
      this.showToast('Switched to Stopwatch mode');
    } else {
      // Check if panel is already visible
      if (countdownPanel.style.display === 'block') {
        // Panel is visible but no preset selected - use default 30min countdown
        this.setCountdownTarget(30);
        this.showToast('Started 30-minute countdown! Use presets for custom time.');
        return;
      } else {
        // First click - show countdown panel with default option
        countdownPanel.style.display = 'block';
        this.showToast('Choose a preset below or click countdown again for 30min default');
      }
    }

    this.updateDisplay();
    this.updateCountdownButton();
    this.updateProgressBar();
    this.saveTimerState();
  }

  setCountdownTarget(minutes) {
    if (minutes && minutes > 0) {
      this.timerState.countdownMode = true;
      this.timerState.countdownTarget = minutes * 60;
      this.timerState.elapsedSeconds = 0; // Reset for countdown

      // Hide the countdown panel
      const countdownPanel = this.widget.querySelector('.cf-timer-countdown-panel');
      countdownPanel.style.display = 'none';

      this.updateDisplay();
      this.updateCountdownButton();
      this.updateProgressBar();
      this.saveTimerState();

      // Show success feedback
      this.showToast(`Countdown set for ${minutes} minute${minutes > 1 ? 's' : ''}!`);
    }
  }

  showToast(message) {
    // Create a temporary toast notification
    const toast = document.createElement('div');
    toast.className = 'cf-timer-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  updateCountdownButton() {
    const countdownBtn = this.widget.querySelector('.cf-timer-countdown');
    const progressBar = this.widget.querySelector('.cf-timer-progress-bar');

    if (this.timerState.countdownMode) {
      countdownBtn.style.backgroundColor = '#FF9800';
      const minutes = Math.ceil(this.timerState.countdownTarget / 60);
      countdownBtn.title = `Countdown Mode (${minutes}m) - Click to switch to Stopwatch`;
      countdownBtn.textContent = '⏱️';
      progressBar.style.display = 'block';
    } else {
      countdownBtn.style.backgroundColor = '';
      countdownBtn.title = 'Toggle Countdown Mode';
      countdownBtn.textContent = '⏰';
      progressBar.style.display = 'none';
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      if (message.type === 'STORAGE_CHANGED') {
        // Handle storage changes if needed
      }
    });
  }

  setupKeyboardShortcuts() {
    const keyboardHandler = e => {
      // Only handle shortcuts when timer widget is visible and focused
      if (!this.widget || this.widget.style.display === 'none' || this.isDestroyed) {
        return;
      }

      // Prevent conflicts with Codeforces shortcuts
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (this.timerState.isRunning) {
            this.pauseTimer();
          } else {
            this.startTimer();
          }
          break;
        case 'r':
        case 'R':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.resetTimer();
          }
          break;
        case 's':
        case 'S':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.markAsSolved();
          }
          break;
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.toggleCountdownMode();
          }
          break;
        case 'Escape':
          this.hideWidget();
          break;
      }
    };

    document.addEventListener('keydown', keyboardHandler);

    // Track cleanup function
    this.cleanupFunctions.push(() => {
      document.removeEventListener('keydown', keyboardHandler);
    });
  }

  // Cleanup method to prevent memory leaks
  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    // Clear timers
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Run all cleanup functions
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    });

    // Remove widget from DOM
    if (this.widget && this.widget.parentNode) {
      this.widget.parentNode.removeChild(this.widget);
    }

    // Clear references
    this.widget = null;
    this.cleanupFunctions = [];
  }
}

// Initialize timer when DOM is ready
let timerInstance = null;

function initializeTimer() {
  // Clean up existing instance if any
  if (timerInstance) {
    timerInstance.destroy();
  }

  timerInstance = new CodeforcesTimer();
}

// Handle page navigation cleanup
window.addEventListener('beforeunload', () => {
  if (timerInstance) {
    timerInstance.destroy();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTimer);
} else {
  initializeTimer();
}
