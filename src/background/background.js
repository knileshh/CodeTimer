// Background service worker for Codeforces Timer Extension
class TimerBackground {
  constructor() {
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
    this.setupStorageListeners();
    this.setupErrorHandling();
  }

  setupMessageHandlers() {
    // Use Map for better performance than switch statement
    this.messageHandlers.set('GET_TIMER_STATE', this.getTimerState.bind(this));
    this.messageHandlers.set('SAVE_TIMER_STATE', this.saveTimerState.bind(this));
    this.messageHandlers.set('GET_ALL_STATS', this.getAllStats.bind(this));
    this.messageHandlers.set('CLEAR_ALL_DATA', this.clearAllData.bind(this));
    this.messageHandlers.set('TOGGLE_EXTENSION', this.toggleExtension.bind(this));
    this.messageHandlers.set('REPORT_ERROR', this.reportError.bind(this));

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message, sendResponse);
        return true; // Keep message channel open for async response
      }
      
      // Unknown message type
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
    });
  }

  setupStorageListeners() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        // Debounce storage change notifications to avoid excessive updates
        clearTimeout(this.storageDebounceTimeout);
        this.storageDebounceTimeout = setTimeout(() => {
          this.notifyContentScripts(changes);
        }, 100);
      }
    });
  }

  async notifyContentScripts(changes) {
    try {
      const tabs = await chrome.tabs.query({url: 'https://codeforces.com/*'});
      const notifications = tabs.map(tab => 
        chrome.tabs.sendMessage(tab.id, {
          type: 'STORAGE_CHANGED',
          changes: changes
        }).catch(() => {
          // Tab might not have content script loaded yet - ignore silently
        })
      );
      
      await Promise.allSettled(notifications);
    } catch (error) {
      console.warn('Failed to notify content scripts:', error);
    }
  }

  setupErrorHandling() {
    // Global error handler for unhandled promise rejections
    self.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    });

    // Global error handler for runtime errors
    self.addEventListener('error', (event) => {
      console.error('Runtime error:', event.error);
    });
  }

  async getTimerState(message, sendResponse) {
    const { problemKey } = message;
    try {
      const result = await chrome.storage.local.get([problemKey, 'extensionEnabled']);
      const state = result[problemKey] || {
        elapsedSeconds: 0,
        isRunning: false,
        lastUpdated: new Date().toISOString(),
        history: []
      };
      const enabled = result.extensionEnabled !== false; // Default to enabled
      sendResponse({ success: true, state, enabled });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async saveTimerState(message, sendResponse) {
    const { problemKey, state } = message;
    try {
      await chrome.storage.local.set({
        [problemKey]: {
          ...state,
          lastUpdated: new Date().toISOString()
        }
      });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async getAllStats(message, sendResponse) {
    try {
      const allData = await chrome.storage.local.get();
      const stats = this.calculateStats(allData);
      sendResponse({ success: true, stats });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  calculateStats(allData) {
    const problemKeys = Object.keys(allData).filter(key => key.startsWith('cf_'));
    const today = new Date().toDateString();
    
    let totalTime = 0;
    let todayTime = 0;
    let problemCount = 0;
    const recentProblems = [];

    // Use for...of for better performance than forEach
    for (const key of problemKeys) {
      const data = allData[key];
      if (!data?.history) continue;

      for (const session of data.history) {
        const sessionTime = session.end ? 
          (new Date(session.end) - new Date(session.start)) / 1000 : 0;
        totalTime += sessionTime;
        
        if (new Date(session.start).toDateString() === today) {
          todayTime += sessionTime;
        }
      }
      
      if (data.history.length > 0) {
        problemCount++;
        recentProblems.push({
          key,
          elapsedSeconds: data.elapsedSeconds,
          lastSession: data.history[data.history.length - 1]
        });
      }
    }

    return {
      totalTime,
      todayTime,
      averageTime: problemCount > 0 ? totalTime / problemCount : 0,
      problemCount,
      recentProblems: recentProblems
        .sort((a, b) => new Date(b.lastSession.start) - new Date(a.lastSession.start))
        .slice(0, 10)
    };
  }

  async clearAllData(message, sendResponse) {
    try {
      const allData = await chrome.storage.local.get();
      const keysToRemove = Object.keys(allData).filter(key => 
        key.startsWith('cf_') || key === 'timerWidgetPosition'
      );
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
      
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async toggleExtension(message, sendResponse) {
    const { enabled } = message;
    try {
      await chrome.storage.local.set({ extensionEnabled: enabled });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async reportError(message, sendResponse) {
    try {
      const { error } = message;
      console.error('Error reported from content script:', error);
      
      // Store error for debugging
      const errors = await chrome.storage.local.get(['reportedErrors']);
      const errorList = errors.reportedErrors || [];
      errorList.push({
        ...error,
        reportedAt: new Date().toISOString()
      });
      
      // Keep only last 50 errors
      if (errorList.length > 50) {
        errorList.splice(0, errorList.length - 50);
      }
      
      await chrome.storage.local.set({ reportedErrors: errorList });
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to report error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Initialize background service
new TimerBackground();

