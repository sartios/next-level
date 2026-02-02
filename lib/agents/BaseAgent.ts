/**
 * Base class for agents that require lazy initialization.
 * Provides thread-safe singleton initialization with promise caching.
 */
export abstract class BaseAgent<TAgent> {
  protected agent: TAgent | null = null;
  protected initPromise: Promise<void> | null = null;

  protected abstract readonly agentName: string;

  /**
   * Implement this to create and configure your agent.
   */
  protected abstract createAgent(): Promise<TAgent>;

  /**
   * Ensures the agent is initialized before use.
   * Safe to call multiple times - will only initialize once.
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.agent) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          this.agent = await this.createAgent();
        } catch (error) {
          this.initPromise = null;
          throw error;
        }
      })();
    }

    await this.initPromise;
  }

  /**
   * Returns the initialized agent, throwing if not ready.
   */
  protected getAgent(): TAgent {
    if (!this.agent) {
      throw new Error(`${this.agentName} not initialized`);
    }
    return this.agent;
  }
}
