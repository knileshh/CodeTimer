// Popup script for Codeforces Timer Extension
class PopupManager {
  constructor() {
    this.isInitialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.handleInitializationError(error);
    }
  }

  async handleInitializationError(error) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => this.init(), 1000 * this.retryCount);
    } else {
      this.showStatus('Failed to initialize popup. Please reload the extension.', 'error');
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['extensionEnabled']);
      const enabled = result.extensionEnabled !== false; // Default to enabled
      
      const toggle = document.getElementById('extensionToggle');
      toggle.classList.toggle('active', enabled);
    } catch (error) {
      this.showStatus('Error loading settings', 'error');
    }
  }

  setupEventListeners() {
    // Extension toggle
    const toggle = document.getElementById('extensionToggle');
    toggle.addEventListener('click', () => this.toggleExtension());

    // View stats button
    const viewStatsBtn = document.getElementById('viewStatsBtn');
    viewStatsBtn.addEventListener('click', () => this.viewStats());

    // Open stats link
    const openStatsLink = document.getElementById('openStatsLink');
    openStatsLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openStatsPage();
    });

    // Clear data button
    const clearDataBtn = document.getElementById('clearDataBtn');
    clearDataBtn.addEventListener('click', () => this.clearAllData());
  }

  async toggleExtension() {
    const toggle = document.getElementById('extensionToggle');
    const isActive = toggle.classList.contains('active');
    const newState = !isActive;

    try {
      await this.sendMessage({
        type: 'TOGGLE_EXTENSION',
        enabled: newState
      });

      toggle.classList.toggle('active', newState);
      this.showStatus(
        newState ? 'Timer enabled' : 'Timer disabled', 
        'success'
      );

      // Notify content scripts
      const tabs = await chrome.tabs.query({url: 'https://codeforces.com/*'});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'EXTENSION_TOGGLED',
          enabled: newState
        }).catch(() => {
          // Tab might not have content script loaded
        });
      });
    } catch (error) {
      this.showStatus('Error updating settings', 'error');
    }
  }

  async viewStats() {
    try {
      const response = await this.sendMessage({
        type: 'GET_ALL_STATS'
      });

      if (response.success) {
        this.displayStats(response.stats);
      } else {
        this.showStatus('Error loading stats', 'error');
      }
    } catch (error) {
      this.showStatus('Error loading stats', 'error');
    }
  }

  displayStats(stats) {
    const totalTime = this.formatTime(stats.totalTime);
    const todayTime = this.formatTime(stats.todayTime);
    const avgTime = this.formatTime(stats.averageTime);

    const statsHtml = `
      <div style="font-size: 12px; line-height: 1.4;">
        <div><strong>Total Time:</strong> ${totalTime}</div>
        <div><strong>Today:</strong> ${todayTime}</div>
        <div><strong>Average:</strong> ${avgTime}</div>
        <div><strong>Problems:</strong> ${stats.problemCount}</div>
      </div>
    `;

    this.showStatus(statsHtml, 'success');
  }

  async openStatsPage() {
    try {
      // Create a new tab with stats page
      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL('stats.html')
      });
      
      // Close popup
      window.close();
    } catch (error) {
      this.showStatus('Error opening stats page', 'error');
    }
  }

  async clearAllData() {
    if (!confirm('Are you sure you want to clear all timer data? This cannot be undone.')) {
      return;
    }

    try {
      const response = await this.sendMessage({
        type: 'CLEAR_ALL_DATA'
      });

      if (response.success) {
        this.showStatus('All data cleared successfully', 'success');
        
        // Notify content scripts to refresh
        const tabs = await chrome.tabs.query({url: 'https://codeforces.com/*'});
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'DATA_CLEARED'
          }).catch(() => {
            // Tab might not have content script loaded
          });
        });
      } else {
        this.showStatus('Error clearing data', 'error');
      }
    } catch (error) {
      this.showStatus('Error clearing data', 'error');
    }
  }

  async sendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success === false) {
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  showStatus(message, type = '') {
    const statusElement = document.getElementById('status') || 
                         document.getElementById('clearStatus');
    
    if (statusElement) {
      statusElement.innerHTML = message;
      statusElement.className = `status ${type}`;
      
      // Clear status after 3 seconds for success/error messages
      if (type === 'success' || type === 'error') {
        setTimeout(() => {
          statusElement.innerHTML = '';
          statusElement.className = 'status';
        }, 3000);
      }
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

