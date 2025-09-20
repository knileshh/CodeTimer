// Content script for Codeforces Timer Extension
class CodeforcesTimer {
  constructor() {
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
  }

  isProblemPage() {
    const url = window.location.href;
    return url.includes('/problem/') || 
           (url.includes('/contest/') && url.includes('/problem/'));
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
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_TIMER_STATE',
        problemKey: 'dummy'
      }, (response) => {
        resolve(response?.enabled !== false);
      });
    });
  }

  async loadTimerState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_TIMER_STATE',
        problemKey: this.problemKey
      }, (response) => {
        if (response?.success) {
          this.timerState = response.state;
          this.isExtensionEnabled = response.enabled;
        }
        resolve();
      });
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
        <span class="cf-timer-title" title="Space: Start/Pause | Ctrl+R: Reset | Ctrl+S: Solved | Esc: Close">Timer</span>
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
  }

  makeDraggable() {
    const header = this.widget.querySelector('.cf-timer-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const mouseDownHandler = (e) => {
      if (e.target.classList.contains('cf-timer-close') || this.isDestroyed) return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.widget.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      this.widget.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const mouseMoveHandler = (e) => {
      if (!isDragging || this.isDestroyed) return;
      
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
    const isDark = document.body.classList.contains('dark') || 
                   document.documentElement.classList.contains('dark');
    
    this.widget.classList.toggle('cf-timer-dark', isDark);
  }

  async loadWidgetPosition() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['timerWidgetPosition'], (result) => {
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
    if (this.timerState.isRunning || this.isDestroyed) return;
    
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
    if (!this.timerState.isRunning) return;
    
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
      timeDisplay.textContent = this.formatTime(Math.max(0, remaining));
      timeDisplay.style.color = remaining <= 60 ? '#f44336' : '#2196F3'; // Red when < 1 min
    } else {
      timeDisplay.textContent = this.formatTime(this.timerState.elapsedSeconds);
      timeDisplay.style.color = '#2196F3';
    }
  }

  showCountdownComplete() {
    const timeDisplay = this.widget.querySelector('.cf-timer-time');
    timeDisplay.textContent = 'TIME UP!';
    timeDisplay.style.color = '#f44336';
    timeDisplay.style.fontWeight = 'bold';
    
    // Show notification
    if (Notification.permission === 'granted') {
      new Notification('Countdown Complete!', {
        body: 'Your countdown timer has finished.',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="18" font-size="18">⏰</text></svg>'
      });
    }
    
    // Reset after 3 seconds
    setTimeout(() => {
      this.updateDisplay();
    }, 3000);
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
    if (this.isDestroyed) return;

    // Clear existing timeout to batch writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // Batch storage writes every 5 seconds for better performance
    this.saveTimeout = setTimeout(async () => {
      if (this.isDestroyed) return;
      
      try {
        await chrome.runtime.sendMessage({
          type: 'SAVE_TIMER_STATE',
          problemKey: this.problemKey,
          state: this.timerState
        });
      } catch (error) {
        console.warn('Failed to save timer state:', error);
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
    if (this.timerState.countdownMode) {
      // Switch to stopwatch mode
      this.timerState.countdownMode = false;
      this.timerState.countdownTarget = 0;
    } else {
      // Switch to countdown mode - prompt for target time
      const targetMinutes = prompt('Enter countdown target in minutes:', '30');
      if (targetMinutes && !isNaN(targetMinutes) && targetMinutes > 0) {
        this.timerState.countdownMode = true;
        this.timerState.countdownTarget = parseInt(targetMinutes) * 60;
        this.timerState.elapsedSeconds = 0; // Reset for countdown
      } else {
        return; // User cancelled or invalid input
      }
    }
    
    this.updateDisplay();
    this.updateCountdownButton();
    this.saveTimerState();
  }

  updateCountdownButton() {
    const countdownBtn = this.widget.querySelector('.cf-timer-countdown');
    if (this.timerState.countdownMode) {
      countdownBtn.style.backgroundColor = '#FF9800';
      countdownBtn.title = 'Switch to Stopwatch Mode';
    } else {
      countdownBtn.style.backgroundColor = '';
      countdownBtn.title = 'Toggle Countdown Mode';
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STORAGE_CHANGED') {
        // Handle storage changes if needed
      }
    });
  }

  setupKeyboardShortcuts() {
    const keyboardHandler = (e) => {
      // Only handle shortcuts when timer widget is visible and focused
      if (!this.widget || this.widget.style.display === 'none' || this.isDestroyed) return;
      
      // Prevent conflicts with Codeforces shortcuts
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch(e.key) {
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
    if (this.isDestroyed) return;
    
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

