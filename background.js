// Background service worker for Codeforces Timer Extension
class TimerBackground {
  constructor() {
    this.setupMessageHandlers();
    this.setupStorageListeners();
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'GET_TIMER_STATE':
          this.getTimerState(message.problemKey, sendResponse);
          return true; // Keep message channel open for async response
        case 'SAVE_TIMER_STATE':
          this.saveTimerState(message.problemKey, message.state, sendResponse);
          return true;
        case 'GET_ALL_STATS':
          this.getAllStats(sendResponse);
          return true;
        case 'CLEAR_ALL_DATA':
          this.clearAllData(sendResponse);
          return true;
        case 'TOGGLE_EXTENSION':
          this.toggleExtension(message.enabled, sendResponse);
          return true;
      }
    });
  }

  setupStorageListeners() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        // Notify content scripts of storage changes
        chrome.tabs.query({url: 'https://codeforces.com/*'}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'STORAGE_CHANGED',
              changes: changes
            }).catch(() => {
              // Tab might not have content script loaded yet
            });
          });
        });
      }
    });
  }

  async getTimerState(problemKey, sendResponse) {
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

  async saveTimerState(problemKey, state, sendResponse) {
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

  async getAllStats(sendResponse) {
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

    problemKeys.forEach(key => {
      const data = allData[key];
      if (data && data.history) {
        data.history.forEach(session => {
          const sessionTime = session.end ? 
            (new Date(session.end) - new Date(session.start)) / 1000 : 0;
          totalTime += sessionTime;
          
          if (new Date(session.start).toDateString() === today) {
            todayTime += sessionTime;
          }
        });
        
        if (data.history.length > 0) {
          problemCount++;
          recentProblems.push({
            key,
            elapsedSeconds: data.elapsedSeconds,
            lastSession: data.history[data.history.length - 1]
          });
        }
      }
    });

    return {
      totalTime,
      todayTime,
      averageTime: problemCount > 0 ? totalTime / problemCount : 0,
      problemCount,
      recentProblems: recentProblems.sort((a, b) => 
        new Date(b.lastSession.start) - new Date(a.lastSession.start)
      ).slice(0, 10)
    };
  }

  async clearAllData(sendResponse) {
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

  async toggleExtension(enabled, sendResponse) {
    try {
      await chrome.storage.local.set({ extensionEnabled: enabled });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Initialize background service
new TimerBackground();

