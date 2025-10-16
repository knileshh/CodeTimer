// Error handling utilities for Codeforces Timer Extension
class ErrorHandler {
  static logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      message: error.message || 'Unknown error',
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Codeforces Timer Error:', errorInfo);

    // Store error for potential reporting
    this.storeError(errorInfo);
  }

  static storeError(errorInfo) {
    try {
      const errors = JSON.parse(localStorage.getItem('cf_timer_errors') || '[]');
      errors.push(errorInfo);

      // Keep only last 10 errors
      if (errors.length > 10) {
        errors.splice(0, errors.length - 10);
      }

      localStorage.setItem('cf_timer_errors', JSON.stringify(errors));
    } catch (e) {
      console.warn('Failed to store error:', e);
    }
  }

  static async reportError(error, context = '') {
    try {
      this.logError(error, context);

      // Send error to background script for potential reporting
      if (chrome?.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({
          type: 'REPORT_ERROR',
          error: {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (e) {
      console.warn('Failed to report error:', e);
    }
  }

  static wrapAsync(fn, context = '') {
    return async (...args) => {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        this.reportError(error, context);
        throw error;
      }
    };
  }

  static wrapSync(fn, context = '') {
    return (...args) => {
      try {
        return fn.apply(this, args);
      } catch (error) {
        this.reportError(error, context);
        throw error;
      }
    };
  }

  static createSafeHandler(handler, fallback = null) {
    return (...args) => {
      try {
        return handler.apply(this, args);
      } catch (error) {
        this.logError(error, 'Safe handler');
        return fallback;
      }
    };
  }

  static getStoredErrors() {
    try {
      return JSON.parse(localStorage.getItem('cf_timer_errors') || '[]');
    } catch (e) {
      return [];
    }
  }

  static clearStoredErrors() {
    try {
      localStorage.removeItem('cf_timer_errors');
    } catch (e) {
      console.warn('Failed to clear stored errors:', e);
    }
  }
}

// Global error handlers
window.addEventListener('error', event => {
  ErrorHandler.logError(event.error, 'Global error handler');
});

window.addEventListener('unhandledrejection', event => {
  ErrorHandler.logError(event.reason, 'Unhandled promise rejection');
});

// Export for use in other files
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
}
