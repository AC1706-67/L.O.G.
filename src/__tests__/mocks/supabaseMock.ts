// Shared chainable Supabase mock helper
// Provides a consistent mock interface for Supabase client methods used in tests.

export function makeSupabaseMock() {
  const chain: any = {
    from: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(() => chain),
    maybeSingle: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
  };

  // Return the chain itself to allow chaining
  return chain;
}

// Guard test to ensure insert exists on the chain
if (process.env.NODE_ENV === 'test') {
  describe('makeSupabaseMock', () => {
    it('should include insert function on the chain', () => {
      const mock = makeSupabaseMock();
      expect(typeof mock.insert).toBe('function');
    });
  });
}
