import { vi } from 'vitest';

/**
 * Suppress console methods during a test to keep output clean.
 * Spies are automatically restored by vi.clearAllMocks() / vi.restoreAllMocks().
 */
export function silenceConsole(...methods: ('log' | 'error' | 'warn' | 'info' | 'debug')[]) {
  for (const method of methods) {
    vi.spyOn(console, method).mockImplementation(() => {});
  }
}
