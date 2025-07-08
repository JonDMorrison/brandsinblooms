/**
 * Performance optimization utilities for production
 */

// Lazy loading image optimization
export const optimizeImageLoading = () => {
  // Add loading="lazy" to all images that don't have it
  const images = document.querySelectorAll('img:not([loading])');
  images.forEach(img => {
    img.setAttribute('loading', 'lazy');
  });
};

// Debounce function for expensive operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function for scroll/resize events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Intersection Observer for lazy loading
export const createLazyLoadObserver = (callback: (entries: IntersectionObserverEntry[]) => void) => {
  return new IntersectionObserver(callback, {
    root: null,
    rootMargin: '50px',
    threshold: 0.1
  });
};

// Memory cleanup for event listeners
export const addCleanupListener = (element: Element, event: string, handler: EventListener) => {
  element.addEventListener(event, handler);
  return () => element.removeEventListener(event, handler);
};

// Performance monitoring (production-safe)
export const measurePerformance = (name: string, fn: () => void | Promise<void>) => {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now();
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        const end = performance.now();
        console.log(`${name} took ${end - start}ms`);
      });
    } else {
      const end = performance.now();
      console.log(`${name} took ${end - start}ms`);
      return result;
    }
  }
  return fn();
};