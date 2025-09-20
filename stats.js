// Stats page script for Codeforces Timer Extension
class StatsManager {
  constructor() {
    this.stats = null;
    this.isLoading = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    try {
      this.showLoading();
      await this.loadStats();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize stats:', error);
      this.handleInitializationError(error);
    }
  }

  async handleInitializationError(error) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => this.init(), 1000 * this.retryCount);
    } else {
      this.showError('Failed to load statistics. Please refresh the page.');
    }
  }

  showLoading() {
    const container = document.getElementById('recentProblems');
    container.innerHTML = '<div class="loading">Loading statistics...</div>';
  }

  async loadStats() {
    try {
      const response = await this.sendMessage({
        type: 'GET_ALL_STATS'
      });

      if (response.success) {
        this.stats = response.stats;
        this.displayStats();
      } else {
        this.showError('Failed to load statistics');
      }
    } catch (error) {
      this.showError('Error loading statistics');
    }
  }

  displayStats() {
    this.displayOverviewStats();
    this.displayRecentProblems();
    this.displayPerformanceMetrics();
  }

  displayOverviewStats() {
    document.getElementById('totalTime').textContent = this.formatTime(this.stats.totalTime);
    document.getElementById('todayTime').textContent = this.formatTime(this.stats.todayTime);
    document.getElementById('avgTime').textContent = this.formatTime(this.stats.averageTime);
    document.getElementById('problemCount').textContent = this.stats.problemCount;
  }

  displayPerformanceMetrics() {
    const container = document.getElementById('performanceMetrics');
    
    if (!window.performanceMonitor) {
      container.innerHTML = '<div class="no-data">Performance monitoring not available</div>';
      return;
    }
    
    const metrics = window.performanceMonitor.getSummary();
    const memory = window.performanceMonitor.monitorMemory();
    
    if (Object.keys(metrics).length === 0) {
      container.innerHTML = '<div class="no-data">No performance data available yet</div>';
      return;
    }
    
    let metricsHtml = '<div class="performance-grid">';
    
    // Display key metrics
    for (const [label, data] of Object.entries(metrics)) {
      if (data.count > 0) {
        metricsHtml += `
          <div class="performance-item">
            <div class="performance-label">${label}</div>
            <div class="performance-value">${data.avg.toFixed(2)}ms</div>
            <div class="performance-details">
              Count: ${data.count} | Min: ${data.min.toFixed(2)}ms | Max: ${data.max.toFixed(2)}ms
            </div>
          </div>
        `;
      }
    }
    
    // Add memory info if available
    if (memory) {
      const memoryPercent = (memory.used / memory.limit * 100).toFixed(1);
      metricsHtml += `
        <div class="performance-item">
          <div class="performance-label">Memory Usage</div>
          <div class="performance-value">${memoryPercent}%</div>
          <div class="performance-details">
            Used: ${(memory.used / 1024 / 1024).toFixed(1)}MB | 
            Total: ${(memory.total / 1024 / 1024).toFixed(1)}MB
          </div>
        </div>
      `;
    }
    
    metricsHtml += '</div>';
    container.innerHTML = metricsHtml;
  }

  displayRecentProblems() {
    const container = document.getElementById('recentProblems');
    
    if (!this.stats.recentProblems || this.stats.recentProblems.length === 0) {
      container.innerHTML = '<div class="no-data">No problems tracked yet. Start solving on Codeforces!</div>';
      return;
    }

    const problemsHtml = this.stats.recentProblems.map(problem => {
      const problemName = this.parseProblemKey(problem.key);
      const lastSession = problem.lastSession;
      const solved = lastSession.solved ? '<span class="solved-badge">SOLVED</span>' : '';
      
      return `
        <div class="problem-item">
          <div class="problem-info">
            <div class="problem-name">${problemName} ${solved}</div>
            <div class="problem-meta">
              Last session: ${this.formatDate(lastSession.start)}
              ${lastSession.end ? ` - ${this.formatDate(lastSession.end)}` : ' (ongoing)'}
            </div>
          </div>
          <div class="problem-time">${this.formatTime(problem.elapsedSeconds)}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<ul class="problem-list">${problemsHtml}</ul>`;
  }

  parseProblemKey(key) {
    // Convert cf_1234_A to Contest 1234 Problem A
    const match = key.match(/cf_(\d+)_([A-Z])/);
    if (match) {
      return `Contest ${match[1]} Problem ${match[2]}`;
    }
    return key;
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

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  showError(message) {
    document.getElementById('recentProblems').innerHTML = 
      `<div class="error">${message}</div>`;
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

  setupEventListeners() {
    // Add any additional event listeners here
  }
}

// Global functions for button actions
async function refreshStats() {
  const statsManager = new StatsManager();
}

function openCodeforces() {
  window.open('https://codeforces.com', '_blank');
}

async function clearAllData() {
  if (!confirm('Are you sure you want to clear all timer data? This cannot be undone.')) {
    return;
  }

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CLEAR_ALL_DATA'
      }, resolve);
    });

    if (response.success) {
      alert('All data cleared successfully');
      location.reload();
    } else {
      alert('Error clearing data');
    }
  } catch (error) {
    alert('Error clearing data');
  }
}

// Initialize stats page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new StatsManager();
});

