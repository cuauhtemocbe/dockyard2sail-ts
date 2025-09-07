import { describe, it, expect } from 'vitest';
import { greetUser, fetchData } from '../main';

describe('Main module', () => {
  it('should greet user correctly', () => {
    const result = greetUser('Test User');
    expect(result).toBe('Hello, Test User! Welcome to the TypeScript template.');
  });

  it('should greet user with empty string', () => {
    const result = greetUser('');
    expect(result).toBe('Hello, ! Welcome to the TypeScript template.');
  });

  it('should fetch data successfully', async () => {
    const result = await fetchData();
    expect(result).toBe('Data loaded successfully!');
  });
});
