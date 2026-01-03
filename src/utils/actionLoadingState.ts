/**
 * Action Loading State Manager
 * Helps manage loading states for action buttons to provide UI feedback
 * and prevent duplicate clicks while API requests are in progress
 */

class ActionLoadingStateManager {
  private loadingStates: Map<string, boolean> = new Map();

  /**
   * Set loading state for an action
   * @param key - Unique identifier for the action
   * @param isLoading - Whether the action is loading
   */
  setLoading(key: string, isLoading: boolean): void {
    this.loadingStates.set(key, isLoading);
  }

  /**
   * Check if an action is currently loading
   * @param key - The action key to check
   */
  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  /**
   * Clear loading state for an action
   * @param key - The action key to clear
   */
  clearLoading(key: string): void {
    this.loadingStates.delete(key);
  }

  /**
   * Clear all loading states
   */
  clearAll(): void {
    this.loadingStates.clear();
  }

  /**
   * Execute an action with automatic loading state management
   * @param key - Unique identifier for the action
   * @param actionFn - Async function to execute
   * @returns Promise that resolves when the action completes
   */
  async executeWithLoading<T>(
    key: string,
    actionFn: () => Promise<T>
  ): Promise<T> {
    // If already loading, don't execute again
    if (this.isLoading(key)) {
      throw new Error(`Action ${key} is already in progress`);
    }

    this.setLoading(key, true);

    try {
      const result = await actionFn();
      return result;
    } finally {
      this.setLoading(key, false);
    }
  }
}

// Export a singleton instance
export const actionLoadingStateManager = new ActionLoadingStateManager();

export default actionLoadingStateManager;
