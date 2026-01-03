/**
 * Request Deduplicator - Prevents duplicate concurrent API requests using a semaphore pattern
 * This ensures that only one request is made for a given action, preventing multiple API calls
 * from consecutive rapid clicks
 */

class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  /**
   * Executes a function only if there's no pending request for the same key
   * If a request is already pending, returns the existing promise
   * 
   * @param key - Unique identifier for the request (e.g., 'ORDER_HANDOVER_123')
   * @param requestFn - Async function that makes the actual API request
   * @returns Promise that resolves when the request completes
   */
  async executeOnce<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If a request is already pending for this key, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create a new promise for this request
    const requestPromise = requestFn()
      .then((result) => {
        // Remove from pending after successful completion
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        // Remove from pending after error
        this.pendingRequests.delete(key);
        throw error;
      });

    // Store the promise to prevent concurrent requests
    this.pendingRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Executes a function with a timeout, preventing the same request from running
   * within a specified time window
   * 
   * @param key - Unique identifier for the request
   * @param requestFn - Async function that makes the actual API request
   * @param timeoutMs - Time in milliseconds to debounce subsequent requests
   * @returns Promise that resolves when the request completes
   */
  async executeWithDebounce<T>(
    key: string,
    requestFn: () => Promise<T>,
    timeoutMs: number = 1000
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const requestPromise = requestFn()
      .then((result) => {
        // Keep the key marked as pending for the timeout duration
        setTimeout(() => {
          this.pendingRequests.delete(key);
        }, timeoutMs);
        return result;
      })
      .catch((error) => {
        // Remove from pending after error
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Clears a specific pending request
   * @param key - The request key to clear
   */
  clearRequest(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clears all pending requests
   */
  clearAll(): void {
    this.pendingRequests.clear();
  }

  /**
   * Check if a request is currently pending
   * @param key - The request key to check
   */
  isPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }
}

// Export a singleton instance
export const requestDeduplicator = new RequestDeduplicator();

export default requestDeduplicator;
