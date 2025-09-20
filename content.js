// Content script for Codeforces Timer Extension
class CodeforcesTimer {
  constructor() {
    this.problemKey = null;
    this.timerState = {
      elapsedSeconds: 0,
      isRunning: false,
      lastUpdated: new Date().toISOString(),
      history: []
    };
    this.widget = null;
    this.intervalId = null;
    this.isExtensionEnabled = true;
    
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
        <span class="cf-timer-title">Timer</span>
        <button class="cf-timer-close" title="Close Timer">×</button>
      </div>
      <div class="cf-timer-display">
        <span class="cf-timer-time">${this.formatTime(this.timerState.elapsedSeconds)}</span>
      </div>
      <div class="cf-timer-controls">
        <button class="cf-timer-btn cf-timer-start" title="Start Timer">▶</button>
        <button class="cf-timer-btn cf-timer-pause" title="Pause Timer">⏸</button>
        <button class="cf-timer-btn cf-timer-reset" title="Reset Timer">⏹</button>
        <button class="cf-timer-btn cf-timer-solved" title="Mark as Solved">✓</button>
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
  }

  setupWidgetEventListeners() {
    const startBtn = this.widget.querySelector('.cf-timer-start');
    const pauseBtn = this.widget.querySelector('.cf-timer-pause');
    const resetBtn = this.widget.querySelector('.cf-timer-reset');
    const solvedBtn = this.widget.querySelector('.cf-timer-solved');
    const closeBtn = this.widget.querySelector('.cf-timer-close');
    const statsBtn = this.widget.querySelector('.cf-timer-stats-btn');

    startBtn.addEventListener('click', () => this.startTimer());
    pauseBtn.addEventListener('click', () => this.pauseTimer());
    resetBtn.addEventListener('click', () => this.resetTimer());
    solvedBtn.addEventListener('click', () => this.markAsSolved());
    closeBtn.addEventListener('click', () => this.hideWidget());
    statsBtn.addEventListener('click', () => this.openStats());
  }

  makeDraggable() {
    const header = this.widget.querySelector('.cf-timer-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('cf-timer-close')) return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.widget.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      this.widget.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      this.widget.style.left = `${startLeft + deltaX}px`;
      this.widget.style.top = `${startTop + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.widget.style.cursor = 'grab';
        this.saveWidgetPosition();
      }
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
    if (this.timerState.isRunning) return;
    
    this.timerState.isRunning = true;
    this.timerState.currentSessionStart = new Date().toISOString();
    
    this.intervalId = setInterval(() => {
      this.timerState.elapsedSeconds++;
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
    timeDisplay.textContent = this.formatTime(this.timerState.elapsedSeconds);
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
    chrome.runtime.sendMessage({
      type: 'SAVE_TIMER_STATE',
      problemKey: this.problemKey,
      state: this.timerState
    });
  }

  hideWidget() {
    this.widget.style.display = 'none';
  }

  openStats() {
    chrome.runtime.sendMessage({
      type: 'OPEN_STATS'
    });
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STORAGE_CHANGED') {
        // Handle storage changes if needed
      }
    });
  }
}

// Initialize timer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CodeforcesTimer();
  });
} else {
  new CodeforcesTimer();
}

