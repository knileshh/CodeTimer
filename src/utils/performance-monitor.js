// Performance monitoring utilities for Codeforces Timer Extension
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
    this.isEnabled = true;
    this.maxMetrics = 100;
    
    this.setupPerformanceObserver();
  }

  // Start timing a performance metric
  startTiming(label) {
    if (!this.isEnabled) return;
    
    this.startTimes.set(label, performance.now());
  }

  // End timing and record the metric
  endTiming(label) {
    if (!this.isEnabled) return null;
    
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      console.warn(`No start time found for metric: ${label}`);
      return null;
    }
    
    const duration = performance.now() - startTime;
    this.recordMetric(label, duration);
    this.startTimes.delete(label);
    
    return duration;
  }

  // Record a performance metric
  recordMetric(label, value, metadata = {}) {
    if (!this.isEnabled) return;
    
    const metric = {
      label,
      value,
      timestamp: Date.now(),
      metadata
    };
    
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    const metrics = this.metrics.get(label);
    metrics.push(metric);
    
    // Keep only recent metrics
    if (metrics.length > this.maxMetrics) {
      metrics.splice(0, metrics.length - this.maxMetrics);
    }
    
    // Log slow operations
    if (value > 100) { // More than 100ms
      console.warn(`Slow operation detected: ${label} took ${value.toFixed(2)}ms`, metadata);
    }
  }

  // Get metrics for a specific label
  getMetrics(label) {
    return this.metrics.get(label) || [];
  }

  // Get all metrics
  getAllMetrics() {
    const result = {};
    for (const [label, metrics] of this.metrics) {
      result[label] = metrics;
    }
    return result;
  }

  // Get performance summary
  getSummary() {
    const summary = {};
    
    for (const [label, metrics] of this.metrics) {
      if (metrics.length === 0) continue;
      
      const values = metrics.map(m => m.value);
      summary[label] = {
        count: metrics.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        latest: values[values.length - 1]
      };
    }
    
    return summary;
  }

  // Setup Performance Observer for automatic monitoring
  setupPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return;
    
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.recordMetric(`measure:${entry.name}`, entry.duration, {
              startTime: entry.startTime,
              entryType: entry.entryType
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('Failed to setup PerformanceObserver:', error);
    }
  }

  // Monitor memory usage
  monitorMemory() {
    if (!performance.memory) return null;
    
    const memory = {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };
    
    this.recordMetric('memory', memory.used, {
      total: memory.total,
      limit: memory.limit,
      percentage: (memory.used / memory.limit) * 100
    });
    
    return memory;
  }

  // Monitor DOM operations
  monitorDOMOperation(operation, element) {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(`dom:${operation}`, duration, {
        tagName: element?.tagName,
        className: element?.className,
        id: element?.id
      });
    };
  }

  // Monitor storage operations
  monitorStorageOperation(operation, key, dataSize) {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(`storage:${operation}`, duration, {
        key,
        dataSize: dataSize || 0
      });
    };
  }

  // Clear old metrics
  clearOldMetrics(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const cutoff = Date.now() - maxAge;
    
    for (const [label, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(label, filtered);
    }
  }

  // Enable/disable monitoring
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  // Export metrics for analysis
  exportMetrics() {
    return {
      summary: this.getSummary(),
      allMetrics: this.getAllMetrics(),
      timestamp: Date.now()
    };
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

// Utility functions for easy use
window.performanceMonitor = performanceMonitor;

// Helper functions
window.startTiming = (label) => performanceMonitor.startTiming(label);
window.endTiming = (label) => performanceMonitor.endTiming(label);
window.recordMetric = (label, value, metadata) => performanceMonitor.recordMetric(label, value, metadata);

// Auto-clear old metrics every hour
setInterval(() => {
  performanceMonitor.clearOldMetrics();
}, 60 * 60 * 1000);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
} else {
  window.PerformanceMonitor = PerformanceMonitor;
}
