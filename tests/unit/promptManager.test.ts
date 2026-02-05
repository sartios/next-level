import { describe, it, expect } from 'vitest';
import { substituteVariables, sanitizeVariables } from '@/lib/prompts/promptManager';

describe('substituteVariables', () => {
  describe('functionality', () => {
    it('should substitute a single variable', () => {
      const template = 'Hello, {{name}}!';
      const result = substituteVariables(template, { name: 'World' });
      expect(result).toBe('Hello, World!');
    });

    it('should substitute multiple different variables', () => {
      const template = '{{greeting}}, {{name}}! Welcome to {{place}}.';
      const result = substituteVariables(template, {
        greeting: 'Hello',
        name: 'Alice',
        place: 'Wonderland'
      });
      expect(result).toBe('Hello, Alice! Welcome to Wonderland.');
    });

    it('should substitute the same variable multiple times', () => {
      const template = '{{name}} likes {{name}} because {{name}} is awesome.';
      const result = substituteVariables(template, { name: 'Bob' });
      expect(result).toBe('Bob likes Bob because Bob is awesome.');
    });

    it('should return template unchanged when no variables provided', () => {
      const template = 'Hello, {{name}}!';
      const result = substituteVariables(template);
      expect(result).toBe('Hello, {{name}}!');
    });

    it('should return template unchanged when variables is undefined', () => {
      const template = 'Hello, {{name}}!';
      const result = substituteVariables(template, undefined);
      expect(result).toBe('Hello, {{name}}!');
    });

    it('should return template unchanged when variables is empty object', () => {
      const template = 'Hello, {{name}}!';
      const result = substituteVariables(template, {});
      expect(result).toBe('Hello, {{name}}!');
    });

    it('should leave unmatched placeholders unchanged', () => {
      const template = 'Hello, {{name}}! Your role is {{role}}.';
      const result = substituteVariables(template, { name: 'Alice' });
      expect(result).toBe('Hello, Alice! Your role is {{role}}.');
    });

    it('should handle empty string values', () => {
      const template = 'Hello, {{name}}!';
      const result = substituteVariables(template, { name: '' });
      expect(result).toBe('Hello, !');
    });

    it('should handle numeric values', () => {
      const template = 'You have {{count}} items.';
      const result = substituteVariables(template, { count: 42 });
      expect(result).toBe('You have 42 items.');
    });

    it('should handle boolean values', () => {
      const template = 'Active: {{isActive}}';
      const result = substituteVariables(template, { isActive: true });
      expect(result).toBe('Active: true');
    });

    it('should handle null values by converting to string', () => {
      const template = 'Value: {{value}}';
      const result = substituteVariables(template, { value: null });
      expect(result).toBe('Value: null');
    });

    it('should handle undefined values by converting to string', () => {
      const template = 'Value: {{value}}';
      const result = substituteVariables(template, { value: undefined });
      expect(result).toBe('Value: undefined');
    });

    it('should handle multiline templates', () => {
      const template = `Line 1: {{first}}
Line 2: {{second}}
Line 3: {{third}}`;
      const result = substituteVariables(template, {
        first: 'A',
        second: 'B',
        third: 'C'
      });
      expect(result).toBe(`Line 1: A
Line 2: B
Line 3: C`);
    });

    it('should handle variables with underscores', () => {
      const template = 'User: {{user_name}}, Role: {{user_role}}';
      const result = substituteVariables(template, {
        user_name: 'Alice',
        user_role: 'Admin'
      });
      expect(result).toBe('User: Alice, Role: Admin');
    });

    it('should handle variables with numbers', () => {
      const template = 'Item {{item1}} and {{item2}}';
      const result = substituteVariables(template, {
        item1: 'First',
        item2: 'Second'
      });
      expect(result).toBe('Item First and Second');
    });

    it('should handle camelCase variables', () => {
      const template = '{{userName}} has {{careerGoals}}';
      const result = substituteVariables(template, {
        userName: 'Bob',
        careerGoals: 'becoming a developer'
      });
      expect(result).toBe('Bob has becoming a developer');
    });
  });

  describe('security', () => {
    it('should not allow regex injection via variable names', () => {
      const template = 'Hello, {{name}}!';
      // Attempting to inject regex special characters as variable name
      const result = substituteVariables(template, {
        'name}}.*{{': 'injected',
        name: 'World'
      });
      expect(result).toBe('Hello, World!');
    });

    it('should not perform recursive substitution (prevent template injection)', () => {
      const template = 'Hello, {{name}}!';
      // Value contains another template variable - should NOT be substituted
      const result = substituteVariables(template, {
        name: '{{injected}}',
        injected: 'HACKED'
      });
      expect(result).toBe('Hello, {{injected}}!');
    });

    it('should handle values containing regex special characters', () => {
      const template = 'Pattern: {{pattern}}';
      const result = substituteVariables(template, {
        pattern: '.*+?^${}()|[]\\/'
      });
      expect(result).toBe('Pattern: .*+?^${}()|[]\\/');
    });

    it('should handle variable names with regex special characters in braces', () => {
      const template = 'Test: {{normal}}';
      // Extra variables with special chars should be ignored (no match in template)
      const result = substituteVariables(template, {
        normal: 'value',
        '.*': 'regex',
        '(group)': 'capture'
      });
      expect(result).toBe('Test: value');
    });

    it('should not be vulnerable to ReDoS with pathological patterns', () => {
      const template = 'Hello, {{name}}!';
      // Long input that could cause catastrophic backtracking in vulnerable regex
      const longValue = 'a'.repeat(10000);
      const startTime = Date.now();
      const result = substituteVariables(template, { name: longValue });
      const elapsed = Date.now() - startTime;

      expect(result).toBe(`Hello, ${longValue}!`);
      // Should complete quickly (under 100ms) - ReDoS would take much longer
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle HTML content in values without modification', () => {
      const template = 'Content: {{html}}';
      const result = substituteVariables(template, {
        html: '<script>alert("xss")</script>'
      });
      // Note: substituteVariables does NOT sanitize HTML - that's the caller's responsibility
      expect(result).toBe('Content: <script>alert("xss")</script>');
    });

    it('should handle SQL-like content in values without modification', () => {
      const template = 'Query: {{sql}}';
      const result = substituteVariables(template, {
        sql: "'; DROP TABLE users; --"
      });
      // Note: substituteVariables does NOT sanitize SQL - that's the caller's responsibility
      expect(result).toBe("Query: '; DROP TABLE users; --");
    });

    it('should not treat single braces as template variables', () => {
      const template = 'Object: {key: value}, Template: {{name}}';
      const result = substituteVariables(template, { name: 'test' });
      expect(result).toBe('Object: {key: value}, Template: test');
    });

    it('should not treat triple braces as template variables', () => {
      const template = 'Escaped: {{{name}}}, Template: {{name}}';
      const result = substituteVariables(template, { name: 'test' });
      // {{{name}}} contains {{name}} so it gets substituted, leaving extra braces
      expect(result).toBe('Escaped: {test}, Template: test');
    });

    it('should handle very long templates efficiently', () => {
      const longTemplate = '{{var}}'.repeat(1000);
      const startTime = Date.now();
      const result = substituteVariables(longTemplate, { var: 'x' });
      const elapsed = Date.now() - startTime;

      expect(result).toBe('x'.repeat(1000));
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle many variables efficiently', () => {
      let template = '';
      const variables: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        template += `{{var${i}}} `;
        variables[`var${i}`] = `value${i}`;
      }

      const startTime = Date.now();
      const result = substituteVariables(template, variables);
      const elapsed = Date.now() - startTime;

      expect(result).toContain('value0');
      expect(result).toContain('value99');
      expect(elapsed).toBeLessThan(100);
    });

    it('should substitute __proto__ if present as own property (sanitizeVariables filters it)', () => {
      // substituteVariables itself doesn't filter dangerous keys - it just does substitution
      // The protection comes from sanitizeVariables which is called in getAgentPrompt
      const template = 'Value: {{__proto__}}';
      const obj = Object.create(null);
      obj.__proto__ = 'test';

      const result = substituteVariables(template, obj);
      // Without sanitizeVariables, the key would be substituted
      expect(result).toBe('Value: test');
    });

    it('should substitute constructor if present as own property (sanitizeVariables filters it)', () => {
      // substituteVariables doesn't filter keys - sanitizeVariables does
      // This test documents the behavior; getAgentPrompt calls sanitizeVariables first
      const template = 'Value: {{value}}, Constructor: {{constructor}}';
      const result = substituteVariables(template, {
        value: 'safe',
        constructor: 'test'
      });
      expect(result).toBe('Value: safe, Constructor: test');
    });

    it('should handle object values by converting to string', () => {
      const template = 'Data: {{obj}}';
      const result = substituteVariables(template, {
        obj: { key: 'value' }
      });
      expect(result).toBe('Data: [object Object]');
    });

    it('should handle array values by converting to string', () => {
      const template = 'Items: {{arr}}';
      const result = substituteVariables(template, {
        arr: ['a', 'b', 'c']
      });
      expect(result).toBe('Items: a,b,c');
    });
  });
});

describe('sanitizeVariables', () => {
  describe('functionality', () => {
    it('should return undefined when no variables provided', () => {
      expect(sanitizeVariables()).toBeUndefined();
      expect(sanitizeVariables(undefined)).toBeUndefined();
    });

    it('should return undefined when variables is empty object', () => {
      expect(sanitizeVariables({})).toBeUndefined();
    });

    it('should pass through valid alphanumeric keys', () => {
      const result = sanitizeVariables({
        name: 'Alice',
        age: 30,
        isActive: true
      });
      expect(result).toEqual({
        name: 'Alice',
        age: '30',
        isActive: 'true'
      });
    });

    it('should allow keys with underscores', () => {
      const result = sanitizeVariables({
        user_name: 'Bob',
        user_role: 'Admin'
      });
      expect(result).toEqual({
        user_name: 'Bob',
        user_role: 'Admin'
      });
    });

    it('should allow keys with numbers', () => {
      const result = sanitizeVariables({
        item1: 'First',
        item2: 'Second',
        var123: 'Third'
      });
      expect(result).toEqual({
        item1: 'First',
        item2: 'Second',
        var123: 'Third'
      });
    });

    it('should allow camelCase keys', () => {
      const result = sanitizeVariables({
        userName: 'Charlie',
        careerGoals: 'Developer'
      });
      expect(result).toEqual({
        userName: 'Charlie',
        careerGoals: 'Developer'
      });
    });

    it('should convert all values to strings', () => {
      const result = sanitizeVariables({
        str: 'text',
        num: 42,
        bool: true,
        nil: null,
        undef: undefined,
        obj: { key: 'value' },
        arr: [1, 2, 3]
      });
      expect(result).toEqual({
        str: 'text',
        num: '42',
        bool: 'true',
        nil: 'null',
        undef: 'undefined',
        obj: '[object Object]',
        arr: '1,2,3'
      });
    });
  });

  describe('security', () => {
    // These tests verify defensive filtering of keys that are commonly associated
    // with prototype pollution patterns. While string values can't pollute prototypes,
    // filtering these keys prevents the sanitized object from being misused in
    // downstream code that might do unsafe property assignments.

    it('should filter out __proto__ key as defensive measure', () => {
      const obj = Object.create(null);
      obj.name = 'safe';
      obj.__proto__ = 'filtered';

      const result = sanitizeVariables(obj);
      expect(result).toEqual({ name: 'safe' });
      expect(result).not.toHaveProperty('__proto__');
    });

    it('should filter out constructor key as defensive measure', () => {
      const result = sanitizeVariables({
        name: 'safe',
        constructor: 'filtered'
      });
      expect(result).toEqual({ name: 'safe' });
      expect(result).not.toHaveProperty('constructor');
    });

    it('should filter out prototype key as defensive measure', () => {
      const result = sanitizeVariables({
        name: 'safe',
        prototype: 'filtered'
      });
      expect(result).toEqual({ name: 'safe' });
      expect(result).not.toHaveProperty('prototype');
    });

    it('should filter out keys with special characters', () => {
      const result = sanitizeVariables({
        name: 'safe',
        'key-with-dash': 'filtered',
        'key.with.dot': 'filtered',
        'key with space': 'filtered',
        'key@special': 'filtered'
      });
      expect(result).toEqual({ name: 'safe' });
    });

    it('should filter out keys with regex special characters', () => {
      const result = sanitizeVariables({
        name: 'safe',
        '.*': 'regex',
        '(group)': 'capture',
        '[class]': 'bracket',
        'a+b': 'plus',
        'a?b': 'question',
        'a|b': 'pipe'
      });
      expect(result).toEqual({ name: 'safe' });
    });

    it('should filter out keys that could be template injection', () => {
      const result = sanitizeVariables({
        name: 'safe',
        '{{injected}}': 'attack',
        'name}}{{other': 'attack'
      });
      expect(result).toEqual({ name: 'safe' });
    });

    it('should return undefined if all keys are filtered out', () => {
      const result = sanitizeVariables({
        __proto__: 'value1',
        constructor: 'value2',
        'invalid-key': 'value3'
      });
      expect(result).toBeUndefined();
    });

    it('should not modify the original object', () => {
      const original = {
        name: 'Alice',
        __proto__: 'filtered'
      };
      const originalCopy = { ...original };

      sanitizeVariables(original);

      expect(original).toEqual(originalCopy);
    });

    it('should handle values containing template syntax (passed through as strings)', () => {
      const result = sanitizeVariables({
        name: '{{injected}}',
        nested: '{{{{deep}}}}'
      });
      // Values are just converted to strings, not filtered
      // The protection against template injection is in substituteVariables
      expect(result).toEqual({
        name: '{{injected}}',
        nested: '{{{{deep}}}}'
      });
    });

    it('should handle empty string keys by filtering them out', () => {
      const result = sanitizeVariables({
        '': 'empty key',
        name: 'valid'
      });
      // Empty string doesn't match \w+ pattern
      expect(result).toEqual({ name: 'valid' });
    });

    it('should handle very long key names', () => {
      const longKey = 'a'.repeat(10000);
      const result = sanitizeVariables({
        [longKey]: 'value'
      });
      expect(result).toEqual({ [longKey]: 'value' });
    });

    it('should handle many variables efficiently', () => {
      const variables: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        variables[`var${i}`] = `value${i}`;
      }

      const startTime = Date.now();
      const result = sanitizeVariables(variables);
      const elapsed = Date.now() - startTime;

      expect(Object.keys(result!)).toHaveLength(1000);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('integration with substituteVariables', () => {
    it('should prevent template injection via values', () => {
      const template = 'Hello, {{name}}! Role: {{role}}';
      const input = {
        name: '{{role}}', // Attempting to inject template syntax in value
        role: 'Admin'
      };

      const sanitized = sanitizeVariables(input);
      const result = substituteVariables(template, sanitized);

      // name should be the literal string "{{role}}", not substituted again
      // This proves single-pass substitution prevents recursive injection
      expect(result).toBe('Hello, {{role}}! Role: Admin');
    });

    it('should filter dangerous keys while passing through values', () => {
      const template = 'Welcome {{userName}}! Your goal: {{userGoal}}';

      const userInput = {
        userName: 'Alice',
        userGoal: 'Learn TypeScript',
        __proto__: 'filtered', // Filtered as defensive measure
        constructor: 'filtered', // Filtered as defensive measure
        'invalid-key': 'filtered' // Filtered due to invalid characters
      };

      const sanitized = sanitizeVariables(userInput);
      const result = substituteVariables(template, sanitized);

      expect(result).toBe('Welcome Alice! Your goal: Learn TypeScript');
      expect(sanitized).toEqual({
        userName: 'Alice',
        userGoal: 'Learn TypeScript'
      });
    });

    it('should pass through XSS/SQL content (sanitization is caller responsibility)', () => {
      const template = 'Input: {{userInput}}';

      const userInput = {
        userInput: '<script>alert("xss")</script>'
      };

      const sanitized = sanitizeVariables(userInput);
      const result = substituteVariables(template, sanitized);

      // XSS content passes through - HTML escaping is the caller's responsibility
      // This function only handles template variable injection, not output encoding
      expect(result).toBe('Input: <script>alert("xss")</script>');
    });
  });
});
