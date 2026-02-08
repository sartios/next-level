import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbedQuery = vi.fn();
const mockEmbedDocuments = vi.fn();

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: mockEmbedQuery,
    embedDocuments: mockEmbedDocuments
  }))
}));

// Import after mock setup
import { createEmbedding, createEmbeddings } from '@/lib/embeddings';

describe('embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEmbedding', () => {
    it('should return embedding for a text', async () => {
      const fakeEmbedding = [0.1, 0.2, 0.3];
      mockEmbedQuery.mockResolvedValue(fakeEmbedding);

      const result = await createEmbedding('hello world');

      expect(mockEmbedQuery).toHaveBeenCalledWith('hello world');
      expect(result).toEqual(fakeEmbedding);
    });

    it('should truncate text longer than 30000 characters', async () => {
      const longText = 'a'.repeat(40000);
      mockEmbedQuery.mockResolvedValue([0.1]);

      await createEmbedding(longText);

      const calledWith = mockEmbedQuery.mock.calls[0][0] as string;
      expect(calledWith.length).toBe(30000);
    });

    it('should not truncate text within limit', async () => {
      const text = 'a'.repeat(30000);
      mockEmbedQuery.mockResolvedValue([0.1]);

      await createEmbedding(text);

      const calledWith = mockEmbedQuery.mock.calls[0][0] as string;
      expect(calledWith.length).toBe(30000);
    });
  });

  describe('createEmbeddings', () => {
    it('should return empty array for empty input', async () => {
      const result = await createEmbeddings([]);

      expect(result).toEqual([]);
      expect(mockEmbedDocuments).not.toHaveBeenCalled();
    });

    it('should return embeddings for multiple texts', async () => {
      const fakeEmbeddings = [[0.1], [0.2], [0.3]];
      mockEmbedDocuments.mockResolvedValue(fakeEmbeddings);

      const result = await createEmbeddings(['a', 'b', 'c']);

      expect(mockEmbedDocuments).toHaveBeenCalledWith(['a', 'b', 'c']);
      expect(result).toEqual(fakeEmbeddings);
    });

    it('should truncate each text in the batch', async () => {
      const longText = 'x'.repeat(40000);
      mockEmbedDocuments.mockResolvedValue([[0.1], [0.2]]);

      await createEmbeddings([longText, 'short']);

      const calledWith = mockEmbedDocuments.mock.calls[0][0] as string[];
      expect(calledWith[0].length).toBe(30000);
      expect(calledWith[1]).toBe('short');
    });

    it('should batch texts in groups of 100', async () => {
      const texts = Array.from({ length: 250 }, (_, i) => `text-${i}`);
      mockEmbedDocuments
        .mockResolvedValueOnce(Array(100).fill([0.1]))
        .mockResolvedValueOnce(Array(100).fill([0.2]))
        .mockResolvedValueOnce(Array(50).fill([0.3]));

      const result = await createEmbeddings(texts);

      expect(mockEmbedDocuments).toHaveBeenCalledTimes(3);
      expect(mockEmbedDocuments.mock.calls[0][0]).toHaveLength(100);
      expect(mockEmbedDocuments.mock.calls[1][0]).toHaveLength(100);
      expect(mockEmbedDocuments.mock.calls[2][0]).toHaveLength(50);
      expect(result).toHaveLength(250);
    });
  });
});
