import { describe, it, expect } from 'vitest';
import { parseErrorInfo } from '@/lib/agents/utils';

describe('parseErrorInfo', () => {
  it('extracts info from a standard Error', () => {
    const err = new Error('something went wrong');
    const result = parseErrorInfo(err);

    expect(result.exceptionType).toBe('Error');
    expect(result.message).toBe('something went wrong');
    expect(result.traceback).toContain('something went wrong');
  });

  it('uses err.name from built-in Error subclasses', () => {
    const err = new TypeError('bad type');
    const result = parseErrorInfo(err);

    expect(result.exceptionType).toBe('TypeError');
    expect(result.message).toBe('bad type');
    expect(result.traceback).toContain('bad type');
  });

  it('prefers err.name over err.constructor.name when they differ', () => {
    const err = new Error('overridden');
    err.name = 'CustomName';
    const result = parseErrorInfo(err);

    expect(result.exceptionType).toBe('CustomName');
  });

  it('falls back to constructor.name when err.name is empty', () => {
    const err = new TypeError('empty name');
    err.name = '';
    const result = parseErrorInfo(err);

    expect(result.exceptionType).toBe('TypeError');
  });

  it('handles a string value', () => {
    const result = parseErrorInfo('oops');

    expect(result.exceptionType).toBe('Error');
    expect(result.message).toBe('oops');
    expect(result.traceback).toBe('');
  });

  it('handles a number value', () => {
    const result = parseErrorInfo(42);

    expect(result.exceptionType).toBe('Error');
    expect(result.message).toBe('42');
    expect(result.traceback).toBe('');
  });

  it('handles null', () => {
    const result = parseErrorInfo(null);

    expect(result.exceptionType).toBe('Error');
    expect(result.message).toBe('null');
    expect(result.traceback).toBe('');
  });

  it('handles undefined', () => {
    const result = parseErrorInfo(undefined);

    expect(result.exceptionType).toBe('Error');
    expect(result.message).toBe('undefined');
    expect(result.traceback).toBe('');
  });

  it('handles an Error with no stack', () => {
    const err = new Error('no stack');
    err.stack = undefined;
    const result = parseErrorInfo(err);

    expect(result.exceptionType).toBe('Error');
    expect(result.message).toBe('no stack');
    expect(result.traceback).toBe('');
  });

  it('handles a custom Error subclass', () => {
    class AppError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'AppError';
      }
    }

    const err = new AppError('app failed');
    const result = parseErrorInfo(err);

    expect(result.exceptionType).toBe('AppError');
    expect(result.message).toBe('app failed');
  });
});
