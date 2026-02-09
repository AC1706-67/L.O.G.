/**
 * Access Control Service Tests
 * Property-based and unit tests for RBAC functionality
 */

import * as fc from 'fast-check';
import {
  checkAccess,
  grantAccess,
  revokeAccess,
  getResourceACL,
  getUserAccessibleResources,
  clearACL,
  UserRole,
  UserContext,
  ACLEntry,
} from '../accessControl';
import { Resource, Action } from '../types';

// Custom arbitraries for fast-check
const userRoleArb = fc.constantFrom(
  UserRole.PEER_SPECIALIST,
  UserRole.SUPERVISOR,
  UserRole.ADMIN
);

const actionArb = fc.constantFrom(
  Action.READ,
  Action.WRITE,
  Action.DELETE,
  Action.EXPORT
);

const resourceTypeArb = fc.constantFrom(
  'participant',
  'assessment',
  'consent',
  'plan',
  'interaction'
);

const userContextArb = fc.record({
  userId: fc.uuid(),
  role: userRoleArb,
  organizationId: fc.uuid(),
  assignedParticipants: fc.array(fc.uuid(), { maxLength: 10 }),
});

const resourceArb = fc.record({
  type: resourceTypeArb,
  id: fc.uuid(),
}) as fc.Arbitrary<Resource>;

beforeEach(() => {
  clearACL();
});

describe('Access Control Service', () => {
  /**
   * Property 33: Role-based access control
   * Validates: Requirements 9.3, 11.2, 11.4
   * 
   * For any access attempt to PHI, the system should enforce role-based permissions
   * with minimum necessary access principle, maintaining an access control list
   * for each participant record
   */
  describe('Feature: log-peer-recovery-system, Property 33: Role-based access control', () => {
    it('should always grant access to admin users', async () => {
      await fc.assert(
        fc.asyncProperty(
          resourceArb,
          actionArb,
          fc.uuid(),
          fc.uuid(),
          async (resource, action, userId, orgId) => {
            const adminContext: UserContext = {
              userId,
              role: UserRole.ADMIN,
              organizationId: orgId,
            };

            const hasAccess = await checkAccess(adminContext, resource, action);
            expect(hasAccess).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should grant read access to supervisors for any resource', async () => {
      await fc.assert(
        fc.asyncProperty(
          resourceArb,
          fc.uuid(),
          fc.uuid(),
          async (resource, userId, orgId) => {
            const supervisorContext: UserContext = {
              userId,
              role: UserRole.SUPERVISOR,
              organizationId: orgId,
            };

            const hasAccess = await checkAccess(supervisorContext, resource, Action.READ);
            expect(hasAccess).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce minimum necessary access for peer specialists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          actionArb,
          async (userId, orgId, participantId, assignedParticipants, action) => {
            const peerContext: UserContext = {
              userId,
              role: UserRole.PEER_SPECIALIST,
              organizationId: orgId,
              assignedParticipants,
            };

            const resource: Resource = {
              type: 'participant',
              id: participantId,
            };

            const hasAccess = await checkAccess(peerContext, resource, action);

            // Should only have access if participant is in assigned list
            const shouldHaveAccess = assignedParticipants.includes(participantId);
            expect(hasAccess).toBe(shouldHaveAccess);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain ACL entries correctly (grant and revoke)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          resourceArb,
          fc.array(actionArb, { minLength: 1, maxLength: 4 }),
          fc.uuid(),
          async (userId, resource, permissions, grantedBy) => {
            // Grant access
            const aclEntry: ACLEntry = {
              userId,
              resourceType: resource.type,
              resourceId: resource.id,
              permissions,
              grantedAt: new Date(),
              grantedBy,
              reason: 'Test access grant',
            };

            await grantAccess(aclEntry);

            // Verify ACL entry exists
            const acl = await getResourceACL(resource);
            expect(acl.length).toBeGreaterThan(0);
            expect(acl.some(entry => entry.userId === userId)).toBe(true);

            // Revoke access
            await revokeAccess(userId, resource);

            // Verify ACL entry removed
            const aclAfterRevoke = await getResourceACL(resource);
            expect(aclAfterRevoke.some(entry => entry.userId === userId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track accessible resources per user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(resourceArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (userId, resources, grantedBy) => {
            // Grant access to multiple resources
            for (const resource of resources) {
              const aclEntry: ACLEntry = {
                userId,
                resourceType: resource.type,
                resourceId: resource.id,
                permissions: [Action.READ],
                grantedAt: new Date(),
                grantedBy,
              };
              await grantAccess(aclEntry);
            }

            // Get accessible resources
            const accessibleResources = await getUserAccessibleResources(userId);

            // Should have access to all granted resources
            expect(accessibleResources.length).toBe(resources.length);
            
            for (const resource of resources) {
              expect(accessibleResources).toContain(resource.id);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should respect explicit ACL entries for supervisors on write/delete', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          resourceArb,
          fc.constantFrom(Action.WRITE, Action.DELETE, Action.EXPORT),
          fc.uuid(),
          async (userId, orgId, resource, action, grantedBy) => {
            const supervisorContext: UserContext = {
              userId,
              role: UserRole.SUPERVISOR,
              organizationId: orgId,
            };

            // Without explicit ACL, should not have write/delete access
            const hasAccessBefore = await checkAccess(supervisorContext, resource, action);
            expect(hasAccessBefore).toBe(false);

            // Grant explicit access
            const aclEntry: ACLEntry = {
              userId,
              resourceType: resource.type,
              resourceId: resource.id,
              permissions: [action],
              grantedAt: new Date(),
              grantedBy,
            };
            await grantAccess(aclEntry);

            // Now should have access
            const hasAccessAfter = await checkAccess(supervisorContext, resource, action);
            expect(hasAccessAfter).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('ACL Management', () => {
    it('should update existing ACL entries', async () => {
      const userId = 'user-123';
      const resource: Resource = { type: 'participant', id: 'participant-456' };
      
      // Grant initial access
      await grantAccess({
        userId,
        resourceType: resource.type,
        resourceId: resource.id,
        permissions: [Action.READ],
        grantedAt: new Date(),
        grantedBy: 'admin-1',
      });

      // Update with more permissions
      await grantAccess({
        userId,
        resourceType: resource.type,
        resourceId: resource.id,
        permissions: [Action.READ, Action.WRITE],
        grantedAt: new Date(),
        grantedBy: 'admin-1',
        reason: 'Updated permissions',
      });

      const acl = await getResourceACL(resource);
      expect(acl.length).toBe(1); // Should not duplicate
      expect(acl[0].permissions).toContain(Action.READ);
      expect(acl[0].permissions).toContain(Action.WRITE);
    });

    it('should filter accessible resources by type', async () => {
      const userId = 'user-123';
      
      // Grant access to different resource types
      await grantAccess({
        userId,
        resourceType: 'participant',
        resourceId: 'participant-1',
        permissions: [Action.READ],
        grantedAt: new Date(),
        grantedBy: 'admin-1',
      });

      await grantAccess({
        userId,
        resourceType: 'assessment',
        resourceId: 'assessment-1',
        permissions: [Action.READ],
        grantedAt: new Date(),
        grantedBy: 'admin-1',
      });

      const participantResources = await getUserAccessibleResources(userId, 'participant');
      const assessmentResources = await getUserAccessibleResources(userId, 'assessment');

      expect(participantResources).toEqual(['participant-1']);
      expect(assessmentResources).toEqual(['assessment-1']);
    });
  });

  describe('Default Deny Principle', () => {
    it('should deny access by default for unknown roles', async () => {
      const resource: Resource = { type: 'participant', id: 'participant-123' };
      const unknownContext: UserContext = {
        userId: 'user-123',
        role: 'unknown_role' as UserRole,
        organizationId: 'org-123',
      };

      const hasAccess = await checkAccess(unknownContext, resource, Action.READ);
      expect(hasAccess).toBe(false);
    });

    it('should deny peer specialist access to unassigned participants', async () => {
      const peerContext: UserContext = {
        userId: 'peer-123',
        role: UserRole.PEER_SPECIALIST,
        organizationId: 'org-123',
        assignedParticipants: ['participant-1', 'participant-2'],
      };

      const unassignedResource: Resource = {
        type: 'participant',
        id: 'participant-999',
      };

      const hasAccess = await checkAccess(peerContext, unassignedResource, Action.READ);
      expect(hasAccess).toBe(false);
    });
  });
});
