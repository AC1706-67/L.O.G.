/**
 * Query Service Property-Based Tests
 * Property tests for query access control
 * Feature: log-peer-recovery-system
 */

import * as fc from 'fast-check';
import { processQuery } from '../queryService';
import { QueryIntent, QueryIntentType } from '../types';
import { UserContext, UserRole } from '../../security/accessControl';
import { Action } from '../../security/types';

// Mock Supabase before importing
jest.mock('../../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock Nova AI service
jest.mock('../../ai/novaService', () => ({
  processConversation: jest.fn(),
}));

// Mock access control
jest.mock('../../security/accessControl', () => ({
  checkAccess: jest.fn(),
  UserRole: {
    PEER_SPECIALIST: 'peer_specialist',
    SUPERVISOR: 'supervisor',
    ADMIN: 'admin',
  },
}));

// Mock session logger
jest.mock('../../logging/sessionLogger', () => ({
  logPHIAccess: jest.fn(() => Promise.resolve()),
}));

import { supabase } from '../../../config/supabase';
import { processConversation } from '../../ai/novaService';
import { checkAccess } from '../../security/accessControl';
import { logPHIAccess } from '../../logging/sessionLogger';

describe('Query Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 29: Query access control
   * For any natural language query, the system should retrieve data only from 
   * records the user has permission to access
   * **Validates: Requirements 7.2**
   */
  describe('Feature: log-peer-recovery-system, Property 29: Query access control', () => {
    /**
     * Requirement 7.2: Access control enforcement
     * WHEN query intent is determined, THE System SHALL retrieve relevant data 
     * from the database while respecting access permissions
     */

    test('Peer specialists can only query their assigned participants', async () => {
      // Generator for peer specialist user context
      const peerSpecialistContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.PEER_SPECIALIST),
        organizationId: fc.uuid(),
        assignedParticipants: fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
      });

      // Generator for query strings
      const queryArbitrary = fc.constantFrom(
        'How many participants are on MAT?',
        'Show me all participants',
        'List participants in recovery',
        'Count active participants'
      );

      await fc.assert(
        fc.asyncProperty(
          peerSpecialistContextArbitrary,
          queryArbitrary,
          async (userContext: UserContext, query: string) => {
            // Mock Nova AI to return a count intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'count',
                entities: [],
                filters: {},
                requiresPHI: false,
              }),
            });

            // Mock Supabase query chain
            let capturedParticipantFilter: string[] | undefined;
            const mockQuery = {
              in: jest.fn((field: string, values: string[]) => {
                if (field === 'id') {
                  capturedParticipantFilter = values;
                }
                return mockQuery;
              }),
              eq: jest.fn(() => mockQuery),
              gte: jest.fn(() => mockQuery),
              lte: jest.fn(() => mockQuery),
              order: jest.fn(() => mockQuery),
              limit: jest.fn(() => mockQuery),
            };

            (supabase.from as jest.Mock).mockReturnValue({
              select: jest.fn(() => ({
                ...mockQuery,
                then: jest.fn((resolve) => resolve({ count: 5, error: null })),
              })),
            });

            // Execute query
            await processQuery(query, userContext);

            // Property: Query results should be filtered to only assigned participants
            expect(capturedParticipantFilter).toBeDefined();
            expect(capturedParticipantFilter).toEqual(userContext.assignedParticipants);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Supervisors can query all participants in their organization', async () => {
      // Generator for supervisor user context
      const supervisorContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.SUPERVISOR),
        organizationId: fc.uuid(),
      });

      // Generator for query strings
      const queryArbitrary = fc.constantFrom(
        'How many participants are on MAT?',
        'Show me all participants',
        'List participants in recovery',
        'Count active participants'
      );

      await fc.assert(
        fc.asyncProperty(
          supervisorContextArbitrary,
          queryArbitrary,
          async (userContext: UserContext, query: string) => {
            // Mock Nova AI to return a count intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'count',
                entities: [],
                filters: {},
                requiresPHI: false,
              }),
            });

            // Mock Supabase query chain
            let participantFilterApplied = false;
            const mockQuery = {
              in: jest.fn((field: string, values: string[]) => {
                if (field === 'id') {
                  participantFilterApplied = true;
                }
                return mockQuery;
              }),
              eq: jest.fn(() => mockQuery),
              gte: jest.fn(() => mockQuery),
              lte: jest.fn(() => mockQuery),
              order: jest.fn(() => mockQuery),
              limit: jest.fn(() => mockQuery),
            };

            (supabase.from as jest.Mock).mockReturnValue({
              select: jest.fn(() => ({
                ...mockQuery,
                then: jest.fn((resolve) => resolve({ count: 50, error: null })),
              })),
            });

            // Execute query
            await processQuery(query, userContext);

            // Property: Supervisors should NOT have participant filter applied
            // (they can access all participants in their organization)
            expect(participantFilterApplied).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Admins can query all participants without restrictions', async () => {
      // Generator for admin user context
      const adminContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.ADMIN),
        organizationId: fc.uuid(),
      });

      // Generator for query strings
      const queryArbitrary = fc.constantFrom(
        'How many participants are on MAT?',
        'Show me all participants',
        'List participants in recovery',
        'Count active participants'
      );

      await fc.assert(
        fc.asyncProperty(
          adminContextArbitrary,
          queryArbitrary,
          async (userContext: UserContext, query: string) => {
            // Mock Nova AI to return a count intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'count',
                entities: [],
                filters: {},
                requiresPHI: false,
              }),
            });

            // Mock Supabase query chain
            let participantFilterApplied = false;
            const mockQuery = {
              in: jest.fn((field: string, values: string[]) => {
                if (field === 'id') {
                  participantFilterApplied = true;
                }
                return mockQuery;
              }),
              eq: jest.fn(() => mockQuery),
              gte: jest.fn(() => mockQuery),
              lte: jest.fn(() => mockQuery),
              order: jest.fn(() => mockQuery),
              limit: jest.fn(() => mockQuery),
            };

            (supabase.from as jest.Mock).mockReturnValue({
              select: jest.fn(() => ({
                ...mockQuery,
                then: jest.fn((resolve) => resolve({ count: 100, error: null })),
              })),
            });

            // Execute query
            await processQuery(query, userContext);

            // Property: Admins should NOT have participant filter applied
            // (they can access all participants)
            expect(participantFilterApplied).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Queries requesting specific participant data verify access before returning results', async () => {
      // Generator for user context (any role)
      const userContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constantFrom(UserRole.PEER_SPECIALIST, UserRole.SUPERVISOR, UserRole.ADMIN),
        organizationId: fc.uuid(),
        assignedParticipants: fc.option(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          { nil: undefined }
        ),
      });

      // Generator for participant IDs
      const participantIdArbitrary = fc.uuid();

      await fc.assert(
        fc.asyncProperty(
          userContextArbitrary,
          participantIdArbitrary,
          async (userContext: UserContext, participantId: string) => {
            // Mock Nova AI to return a detail intent with specific participant
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'detail',
                entities: [participantId],
                filters: {},
                requiresPHI: true,
              }),
            });

            // Mock checkAccess to track access verification
            let accessCheckCalled = false;
            let checkedParticipantId: string | undefined;
            (checkAccess as jest.Mock).mockImplementation(
              async (ctx: UserContext, resource: any, action: Action) => {
                accessCheckCalled = true;
                checkedParticipantId = resource.id;
                // Grant access for this test
                return true;
              }
            );

            // Mock Supabase query chain for detail query
            (supabase.from as jest.Mock).mockReturnValue({
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn(() => ({
                    data: { id: participantId, first_name_encrypted: 'test' },
                    error: null,
                  })),
                })),
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    data: [],
                    error: null,
                  })),
                })),
              })),
            });

            // Execute query
            await processQuery(`Pull up participant ${participantId}`, userContext);

            // Property: Access control must be verified for participant-specific queries
            expect(accessCheckCalled).toBe(true);
            expect(checkedParticipantId).toBe(participantId);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Access denied queries return error without exposing data', async () => {
      // Generator for peer specialist context
      const peerSpecialistContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.PEER_SPECIALIST),
        organizationId: fc.uuid(),
        assignedParticipants: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
      });

      // Generator for participant ID NOT in assigned list
      const unassignedParticipantIdArbitrary = fc.uuid();

      await fc.assert(
        fc.asyncProperty(
          peerSpecialistContextArbitrary,
          unassignedParticipantIdArbitrary,
          async (userContext: UserContext, participantId: string) => {
            // Ensure participant is not in assigned list
            if (userContext.assignedParticipants?.includes(participantId)) {
              return; // Skip this iteration
            }

            // Mock Nova AI to return a detail intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'detail',
                entities: [participantId],
                filters: {},
                requiresPHI: true,
              }),
            });

            // Mock checkAccess to deny access
            (checkAccess as jest.Mock).mockResolvedValue(false);

            // Mock Supabase - should NOT be called if access is denied
            const mockSelect = jest.fn();
            (supabase.from as jest.Mock).mockReturnValue({
              select: mockSelect,
            });

            // Execute query
            const result = await processQuery(`Pull up participant ${participantId}`, userContext);

            // Property: Query should fail with access denied error
            expect(result.response).toContain('Access denied');
            expect(result.response).toContain('Insufficient permissions');

            // Property: No participant data should be returned
            expect(result.data).toBeUndefined();

            // Property: Database should not be queried for participant details
            // (access check happens before database query)
            expect(mockSelect).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('List queries filter results based on user role and permissions', async () => {
      // Generator for different user contexts
      const userContextArbitrary = fc.oneof(
        // Peer specialist with assigned participants
        fc.record({
          userId: fc.uuid(),
          role: fc.constant(UserRole.PEER_SPECIALIST),
          organizationId: fc.uuid(),
          assignedParticipants: fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
        }),
        // Supervisor without assigned participants
        fc.record({
          userId: fc.uuid(),
          role: fc.constant(UserRole.SUPERVISOR),
          organizationId: fc.uuid(),
          assignedParticipants: fc.constant(undefined),
        }),
        // Admin without assigned participants
        fc.record({
          userId: fc.uuid(),
          role: fc.constant(UserRole.ADMIN),
          organizationId: fc.uuid(),
          assignedParticipants: fc.constant(undefined),
        })
      );

      await fc.assert(
        fc.asyncProperty(userContextArbitrary, async (userContext: UserContext) => {
          // Mock Nova AI to return a list intent
          (processConversation as jest.Mock).mockResolvedValue({
            response: JSON.stringify({
              intentType: 'list',
              entities: [],
              filters: { status: 'active' },
              requiresPHI: true,
            }),
          });

          // Mock Supabase query chain
          let participantFilterApplied = false;
          let appliedParticipantIds: string[] | undefined;
          const mockQuery = {
            in: jest.fn((field: string, values: string[]) => {
              if (field === 'id') {
                participantFilterApplied = true;
                appliedParticipantIds = values;
              }
              return mockQuery;
            }),
            eq: jest.fn(() => mockQuery),
            limit: jest.fn(() => mockQuery),
          };

          (supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn(() => ({
              ...mockQuery,
              then: jest.fn((resolve) => resolve({ data: [], error: null })),
            })),
          });

          // Execute query
          await processQuery('Show me all active participants', userContext);

          // Property: Peer specialists should have participant filter applied
          if (userContext.role === UserRole.PEER_SPECIALIST) {
            expect(participantFilterApplied).toBe(true);
            expect(appliedParticipantIds).toEqual(userContext.assignedParticipants);
          }

          // Property: Supervisors and admins should NOT have participant filter
          if (
            userContext.role === UserRole.SUPERVISOR ||
            userContext.role === UserRole.ADMIN
          ) {
            expect(participantFilterApplied).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    test('Comparison queries verify access to participant before comparing assessments', async () => {
      // Generator for user context
      const userContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constantFrom(UserRole.PEER_SPECIALIST, UserRole.SUPERVISOR, UserRole.ADMIN),
        organizationId: fc.uuid(),
        assignedParticipants: fc.option(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          { nil: undefined }
        ),
      });

      // Generator for participant ID
      const participantIdArbitrary = fc.uuid();

      await fc.assert(
        fc.asyncProperty(
          userContextArbitrary,
          participantIdArbitrary,
          async (userContext: UserContext, participantId: string) => {
            // Mock Nova AI to return a comparison intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'comparison',
                entities: [participantId],
                filters: { assessment_type: 'BARC_10' },
                requiresPHI: true,
              }),
            });

            // Mock checkAccess to track verification
            let accessVerified = false;
            (checkAccess as jest.Mock).mockImplementation(async () => {
              accessVerified = true;
              return true;
            });

            // Mock Supabase for assessment query
            (supabase.from as jest.Mock).mockReturnValue({
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  order: jest.fn(() => ({
                    data: [
                      { total_score: 30, completed_at: '2024-01-01' },
                      { total_score: 45, completed_at: '2024-02-01' },
                    ],
                    error: null,
                  })),
                })),
              })),
            });

            // Execute query
            await processQuery(`Compare BARC-10 scores for ${participantId}`, userContext);

            // Property: Access must be verified before comparing assessments
            expect(accessVerified).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Trend queries apply role-based filtering consistently', async () => {
      // Generator for peer specialist with assigned participants
      const peerSpecialistContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.PEER_SPECIALIST),
        organizationId: fc.uuid(),
        assignedParticipants: fc.array(fc.uuid(), { minLength: 3, maxLength: 15 }),
      });

      await fc.assert(
        fc.asyncProperty(
          peerSpecialistContextArbitrary,
          async (userContext: UserContext) => {
            // Mock Nova AI to return a trend intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'trend',
                entities: [],
                filters: {},
                requiresPHI: false,
              }),
            });

            // Mock Supabase query chain
            let participantFilterApplied = false;
            let appliedParticipantIds: string[] | undefined;
            const mockQuery = {
              in: jest.fn((field: string, values: string[]) => {
                if (field === 'id') {
                  participantFilterApplied = true;
                  appliedParticipantIds = values;
                }
                return mockQuery;
              }),
              gte: jest.fn(() => mockQuery),
              order: jest.fn(() => mockQuery),
            };

            (supabase.from as jest.Mock).mockReturnValue({
              select: jest.fn(() => ({
                ...mockQuery,
                then: jest.fn((resolve) =>
                  resolve({
                    data: [
                      { created_at: '2024-01-15' },
                      { created_at: '2024-02-20' },
                    ],
                    error: null,
                  })
                ),
              })),
            });

            // Execute query
            await processQuery('Show enrollment trends', userContext);

            // Property: Peer specialists should only see trends for their assigned participants
            expect(participantFilterApplied).toBe(true);
            expect(appliedParticipantIds).toEqual(userContext.assignedParticipants);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('PHI queries with entities trigger PHI access logging', async () => {
      // This test verifies that when a query has requiresPHI=true and entities present,
      // the logPHIAccess function is called with correct parameters

      // Generator for admin user context (guaranteed access)
      const adminContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.ADMIN),
        organizationId: fc.uuid(),
        assignedParticipants: fc.constant(undefined),
      });

      // Generator for participant ID
      const participantIdArbitrary = fc.uuid();

      await fc.assert(
        fc.asyncProperty(
          adminContextArbitrary,
          participantIdArbitrary,
          async (userContext: UserContext, participantId: string) => {
            // Setup: Mock all dependencies to ensure successful query execution
            
            // Mock Nova AI - return intent with entities
            let novaCallCount = 0;
            (processConversation as jest.Mock).mockImplementation(async (input: any) => {
              novaCallCount++;
              if (novaCallCount === 1) {
                // Intent interpretation
                return {
                  response: JSON.stringify({
                    intentType: 'detail',
                    entities: [participantId],
                    filters: {},
                    requiresPHI: true,
                  }),
                };
              } else {
                // Response formatting
                return {
                  response: `Here are the details for participant ${participantId}.`,
                };
              }
            });

            // Mock access control - admin has access
            (checkAccess as jest.Mock).mockResolvedValue(true);

            // Mock Supabase - return successful query results
            (supabase.from as jest.Mock).mockImplementation((table: string) => {
              if (table === 'participants') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      single: jest.fn(async () => ({
                        data: { id: participantId, first_name_encrypted: 'encrypted_John' },
                        error: null,
                      })),
                    })),
                  })),
                };
              }
              if (table === 'assessments') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      order: jest.fn(() => ({
                        limit: jest.fn(async () => ({
                          data: [],
                          error: null,
                        })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'recovery_plans') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        single: jest.fn(async () => ({
                          data: null,
                          error: { message: 'Not found' },
                        })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'queries') {
                return {
                  insert: jest.fn(async () => ({ data: {}, error: null })),
                };
              }
              return {};
            });

            // Clear mock history
            (logPHIAccess as jest.Mock).mockClear();

            // Execute: Process the query
            const result = await processQuery(`Show me participant ${participantId}`, userContext);

            // Property: PHI access logging must occur for queries with requiresPHI=true and entities
            // This is the core property being tested - access control enforcement through logging
            expect(logPHIAccess).toHaveBeenCalledTimes(1);

            // Verify logged data contains correct information
            const loggedData = (logPHIAccess as jest.Mock).mock.calls[0][0];
            expect(loggedData.userId).toBe(userContext.userId);
            expect(loggedData.participantId).toBe(participantId);
            expect(loggedData.accessType).toBe('read');
            expect(loggedData.dataType).toBe('query_result');
            expect(loggedData.purpose).toContain(participantId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 30: Query PHI authorization
   * For any query requesting PHI, the system should verify user authorization 
   * before returning results
   * **Validates: Requirements 7.6**
   */
  describe('Feature: log-peer-recovery-system, Property 30: Query PHI authorization', () => {
    /**
     * Requirement 7.6: PHI authorization verification
     * WHEN a query requests PHI, THE System SHALL verify user authorization 
     * before returning results
     */

    test('Queries requesting PHI verify authorization before returning results', async () => {
      // Generator for user contexts with different roles
      const userContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constantFrom(UserRole.PEER_SPECIALIST, UserRole.SUPERVISOR, UserRole.ADMIN),
        organizationId: fc.uuid(),
        assignedParticipants: fc.option(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          { nil: undefined }
        ),
      });

      // Generator for PHI-requesting queries
      const phiQueryArbitrary = fc.record({
        query: fc.constantFrom(
          'Show me participant details',
          'What is the BARC-10 score?',
          'Pull up assessment results',
          'Show recovery plan',
          'Display participant record'
        ),
        participantId: fc.uuid(),
        intentType: fc.constantFrom('detail', 'comparison', 'list') as fc.Arbitrary<QueryIntentType>,
      });

      await fc.assert(
        fc.asyncProperty(
          userContextArbitrary,
          phiQueryArbitrary,
          async (userContext: UserContext, phiQuery: any) => {
            // Mock Nova AI to return PHI-requesting intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: phiQuery.intentType,
                entities: [phiQuery.participantId],
                filters: {},
                requiresPHI: true, // This is the key - query requires PHI
              }),
            });

            // Track authorization verification
            let authorizationVerified = false;
            let verifiedParticipantId: string | undefined;
            let verifiedAction: Action | undefined;

            (checkAccess as jest.Mock).mockImplementation(
              async (ctx: UserContext, resource: any, action: Action) => {
                authorizationVerified = true;
                verifiedParticipantId = resource.id;
                verifiedAction = action;
                // Grant access for this test
                return true;
              }
            );

            // Mock Supabase responses
            (supabase.from as jest.Mock).mockImplementation((table: string) => {
              if (table === 'participants') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      single: jest.fn(async () => ({
                        data: { id: phiQuery.participantId },
                        error: null,
                      })),
                    })),
                    in: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        limit: jest.fn(async () => ({
                          data: [{ id: phiQuery.participantId }],
                          error: null,
                        })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'assessments') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      order: jest.fn(() => ({
                        limit: jest.fn(async () => ({ data: [], error: null })),
                      })),
                      eq: jest.fn(() => ({
                        order: jest.fn(() => ({ data: [], error: null })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'recovery_plans') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        single: jest.fn(async () => ({ data: null, error: { message: 'Not found' } })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'queries') {
                return {
                  insert: jest.fn(async () => ({ data: {}, error: null })),
                };
              }
              return {};
            });

            // Execute query
            await processQuery(phiQuery.query, userContext);

            // Property: Authorization MUST be verified for PHI-requesting queries
            expect(authorizationVerified).toBe(true);
            expect(verifiedParticipantId).toBe(phiQuery.participantId);
            expect(verifiedAction).toBe(Action.READ);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Unauthorized PHI queries are denied and do not return data', async () => {
      // Generator for peer specialist with limited access
      const peerSpecialistContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.PEER_SPECIALIST),
        organizationId: fc.uuid(),
        assignedParticipants: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
      });

      // Generator for unassigned participant ID
      const unassignedParticipantIdArbitrary = fc.uuid();

      await fc.assert(
        fc.asyncProperty(
          peerSpecialistContextArbitrary,
          unassignedParticipantIdArbitrary,
          async (userContext: UserContext, participantId: string) => {
            // Ensure participant is not in assigned list
            if (userContext.assignedParticipants?.includes(participantId)) {
              return; // Skip this iteration
            }

            // Mock Nova AI to return PHI-requesting intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'detail',
                entities: [participantId],
                filters: {},
                requiresPHI: true,
              }),
            });

            // Mock checkAccess to deny authorization
            (checkAccess as jest.Mock).mockResolvedValue(false);

            // Mock Supabase - should NOT be called if authorization fails
            const mockSelect = jest.fn();
            (supabase.from as jest.Mock).mockReturnValue({
              select: mockSelect,
            });

            // Execute query
            const result = await processQuery(
              `Show me details for participant ${participantId}`,
              userContext
            );

            // Property: Unauthorized PHI queries must be denied
            expect(result.response).toContain('Access denied');
            expect(result.response).toContain('Insufficient permissions');

            // Property: No PHI data should be returned
            expect(result.data).toBeUndefined();

            // Property: Database should not be queried for PHI
            expect(mockSelect).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('PHI authorization is verified before each participant entity in multi-entity queries', async () => {
      // Generator for user context
      const userContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constantFrom(UserRole.SUPERVISOR, UserRole.ADMIN),
        organizationId: fc.uuid(),
      });

      // Generator for multiple participant IDs
      const participantIdsArbitrary = fc.array(fc.uuid(), { minLength: 2, maxLength: 5 });

      await fc.assert(
        fc.asyncProperty(
          userContextArbitrary,
          participantIdsArbitrary,
          async (userContext: UserContext, participantIds: string[]) => {
            // Mock Nova AI to return intent with multiple entities
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'comparison',
                entities: participantIds,
                filters: {},
                requiresPHI: true,
              }),
            });

            // Track all authorization checks
            const verifiedParticipants: string[] = [];
            (checkAccess as jest.Mock).mockImplementation(
              async (ctx: UserContext, resource: any, action: Action) => {
                verifiedParticipants.push(resource.id);
                return true; // Grant access
              }
            );

            // Mock Supabase
            (supabase.from as jest.Mock).mockImplementation((table: string) => {
              if (table === 'assessments') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        order: jest.fn(() => ({ data: [], error: null })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'queries') {
                return {
                  insert: jest.fn(async () => ({ data: {}, error: null })),
                };
              }
              return {};
            });

            // Execute query
            await processQuery('Compare participants', userContext);

            // Property: Authorization must be verified for EACH participant entity
            // Note: The implementation calls checkAccess in verifyQueryAccess for each entity,
            // and may call it again in the specific query execution function
            expect(verifiedParticipants.length).toBeGreaterThanOrEqual(participantIds.length);
            participantIds.forEach((id) => {
              expect(verifiedParticipants).toContain(id);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Non-PHI queries do not trigger authorization checks', async () => {
      // Generator for user context
      const userContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constantFrom(UserRole.PEER_SPECIALIST, UserRole.SUPERVISOR, UserRole.ADMIN),
        organizationId: fc.uuid(),
        assignedParticipants: fc.option(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          { nil: undefined }
        ),
      });

      // Generator for non-PHI queries (aggregate counts without specific participants)
      const nonPhiQueryArbitrary = fc.constantFrom(
        'How many participants are enrolled?',
        'Count active participants',
        'Show enrollment statistics',
        'What is the total count?'
      );

      await fc.assert(
        fc.asyncProperty(
          userContextArbitrary,
          nonPhiQueryArbitrary,
          async (userContext: UserContext, query: string) => {
            // Mock Nova AI to return non-PHI intent
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'count',
                entities: [], // No specific entities
                filters: {},
                requiresPHI: false, // Not requesting PHI
              }),
            });

            // Track authorization checks
            let authorizationCheckCalled = false;
            (checkAccess as jest.Mock).mockImplementation(async () => {
              authorizationCheckCalled = true;
              return true;
            });

            // Mock Supabase
            const mockQuery = {
              in: jest.fn(() => mockQuery),
              eq: jest.fn(() => mockQuery),
            };
            (supabase.from as jest.Mock).mockReturnValue({
              select: jest.fn(() => ({
                ...mockQuery,
                then: jest.fn((resolve) => resolve({ count: 42, error: null })),
              })),
            });

            // Execute query
            await processQuery(query, userContext);

            // Property: Non-PHI queries should NOT trigger authorization checks
            // (role-based filtering is applied, but not entity-level authorization)
            expect(authorizationCheckCalled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('PHI authorization failures are logged for audit purposes', async () => {
      // Generator for peer specialist context
      const peerSpecialistContextArbitrary = fc.record({
        userId: fc.uuid(),
        role: fc.constant(UserRole.PEER_SPECIALIST),
        organizationId: fc.uuid(),
        assignedParticipants: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
      });

      // Generator for unassigned participant
      const unassignedParticipantIdArbitrary = fc.uuid();

      await fc.assert(
        fc.asyncProperty(
          peerSpecialistContextArbitrary,
          unassignedParticipantIdArbitrary,
          async (userContext: UserContext, participantId: string) => {
            // Ensure participant is not assigned
            if (userContext.assignedParticipants?.includes(participantId)) {
              return;
            }

            // Mock Nova AI
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'detail',
                entities: [participantId],
                filters: {},
                requiresPHI: true,
              }),
            });

            // Mock checkAccess to deny
            (checkAccess as jest.Mock).mockResolvedValue(false);

            // Mock Supabase queries table to track logging
            let queryLogged = false;
            let loggedQueryData: any;
            (supabase.from as jest.Mock).mockImplementation((table: string) => {
              if (table === 'queries') {
                return {
                  insert: jest.fn(async (data: any) => {
                    queryLogged = true;
                    loggedQueryData = data;
                    return { data: {}, error: null };
                  }),
                };
              }
              return {
                select: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    single: jest.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              };
            });

            // Execute query
            await processQuery(`Get participant ${participantId} details`, userContext);

            // Property: Failed authorization attempts must be logged
            expect(queryLogged).toBe(true);
            expect(loggedQueryData.user_id).toBe(userContext.userId);
            expect(loggedQueryData.successful).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('PHI authorization respects role-based access control hierarchy', async () => {
      // Generator for different role contexts
      const roleContextArbitrary = fc.constantFrom(
        {
          role: UserRole.PEER_SPECIALIST,
          shouldHaveAccess: false, // To unassigned participants
        },
        {
          role: UserRole.SUPERVISOR,
          shouldHaveAccess: true, // To all in organization
        },
        {
          role: UserRole.ADMIN,
          shouldHaveAccess: true, // To all participants
        }
      );

      const participantIdArbitrary = fc.uuid();

      await fc.assert(
        fc.asyncProperty(
          roleContextArbitrary,
          participantIdArbitrary,
          async (roleContext: any, participantId: string) => {
            const userContext: UserContext = {
              userId: 'test-user-id',
              role: roleContext.role,
              organizationId: 'test-org-id',
              assignedParticipants:
                roleContext.role === UserRole.PEER_SPECIALIST ? ['other-participant-id'] : undefined,
            };

            // Mock Nova AI
            (processConversation as jest.Mock).mockResolvedValue({
              response: JSON.stringify({
                intentType: 'detail',
                entities: [participantId],
                filters: {},
                requiresPHI: true,
              }),
            });

            // Mock checkAccess based on role
            (checkAccess as jest.Mock).mockImplementation(
              async (ctx: UserContext, resource: any, action: Action) => {
                // Simulate role-based access control
                if (ctx.role === UserRole.ADMIN || ctx.role === UserRole.SUPERVISOR) {
                  return true;
                }
                if (ctx.role === UserRole.PEER_SPECIALIST) {
                  return ctx.assignedParticipants?.includes(resource.id) || false;
                }
                return false;
              }
            );

            // Mock Supabase
            (supabase.from as jest.Mock).mockImplementation((table: string) => {
              if (table === 'participants') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      single: jest.fn(async () => ({
                        data: { id: participantId },
                        error: null,
                      })),
                    })),
                  })),
                };
              }
              if (table === 'assessments') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      order: jest.fn(() => ({
                        limit: jest.fn(async () => ({ data: [], error: null })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'recovery_plans') {
                return {
                  select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        single: jest.fn(async () => ({ data: null, error: { message: 'Not found' } })),
                      })),
                    })),
                  })),
                };
              }
              if (table === 'queries') {
                return {
                  insert: jest.fn(async () => ({ data: {}, error: null })),
                };
              }
              return {};
            });

            // Execute query
            const result = await processQuery(`Show participant ${participantId}`, userContext);

            // Property: Authorization outcome must match role-based access hierarchy
            if (roleContext.shouldHaveAccess) {
              expect(result.response).not.toContain('Access denied');
              expect(result.data).toBeDefined();
            } else {
              expect(result.response).toContain('Access denied');
              expect(result.data).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
