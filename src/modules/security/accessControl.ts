/**
 * Access Control Service
 * Implements RBAC (Role-Based Access Control) with minimum necessary access principle
 * Requirements: 9.3, 11.2, 11.4
 */

import { Resource, Action } from './types';

/**
 * User roles in the system
 */
export enum UserRole {
  PEER_SPECIALIST = 'peer_specialist',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin',
}

/**
 * Access Control List entry
 */
export interface ACLEntry {
  userId: string;
  resourceType: string;
  resourceId: string;
  permissions: Action[];
  grantedAt: Date;
  grantedBy: string;
  reason?: string;
}

/**
 * User context for access control decisions
 */
export interface UserContext {
  userId: string;
  role: UserRole;
  organizationId: string;
  assignedParticipants?: string[]; // For peer specialists
}

// In-memory ACL storage (in production, this would be in database)
const accessControlList: Map<string, ACLEntry[]> = new Map();

/**
 * Checks if a user has access to a specific resource and action
 * Implements RBAC with minimum necessary access principle
 * 
 * @param userContext - The user requesting access
 * @param resource - The resource being accessed
 * @param action - The action being performed
 * @returns true if access is granted, false otherwise
 */
export async function checkAccess(
  userContext: UserContext,
  resource: Resource,
  action: Action
): Promise<boolean> {
  // Admin role has access to everything
  if (userContext.role === UserRole.ADMIN) {
    return true;
  }

  // Supervisor role has read access to all participants in their organization
  if (userContext.role === UserRole.SUPERVISOR) {
    if (action === Action.READ) {
      return true;
    }
    // Supervisors can write/delete if they have explicit ACL entry
    return hasExplicitAccess(userContext.userId, resource, action);
  }

  // Peer specialist role - minimum necessary access
  if (userContext.role === UserRole.PEER_SPECIALIST) {
    // Check if this participant is assigned to this peer specialist
    if (resource.type === 'participant') {
      const isAssigned = userContext.assignedParticipants?.includes(resource.id);
      if (!isAssigned) {
        return false;
      }
      
      // Assigned peer specialists have full access to their participants
      return true;
    }

    // For other resource types (assessments, plans, etc.), check if they belong to assigned participants
    return hasExplicitAccess(userContext.userId, resource, action);
  }

  // Default deny
  return false;
}

/**
 * Checks if a user has explicit ACL entry for a resource
 * 
 * @param userId - The user ID
 * @param resource - The resource being accessed
 * @param action - The action being performed
 * @returns true if explicit access exists, false otherwise
 */
function hasExplicitAccess(userId: string, resource: Resource, action: Action): boolean {
  const aclKey = `${resource.type}:${resource.id}`;
  const entries = accessControlList.get(aclKey) || [];
  
  return entries.some(entry => 
    entry.userId === userId && entry.permissions.includes(action)
  );
}

/**
 * Grants access to a user for a specific resource
 * 
 * @param entry - The ACL entry to add
 */
export async function grantAccess(entry: ACLEntry): Promise<void> {
  const aclKey = `${entry.resourceType}:${entry.resourceId}`;
  const entries = accessControlList.get(aclKey) || [];
  
  // Check if entry already exists
  const existingIndex = entries.findIndex(e => 
    e.userId === entry.userId && 
    e.resourceType === entry.resourceType && 
    e.resourceId === entry.resourceId
  );

  if (existingIndex >= 0) {
    // Update existing entry
    entries[existingIndex] = entry;
  } else {
    // Add new entry
    entries.push(entry);
  }

  accessControlList.set(aclKey, entries);
}

/**
 * Revokes access from a user for a specific resource
 * 
 * @param userId - The user ID
 * @param resource - The resource
 */
export async function revokeAccess(userId: string, resource: Resource): Promise<void> {
  const aclKey = `${resource.type}:${resource.id}`;
  const entries = accessControlList.get(aclKey) || [];
  
  const filteredEntries = entries.filter(entry => entry.userId !== userId);
  
  if (filteredEntries.length > 0) {
    accessControlList.set(aclKey, filteredEntries);
  } else {
    accessControlList.delete(aclKey);
  }
}

/**
 * Gets all ACL entries for a specific resource
 * 
 * @param resource - The resource
 * @returns Array of ACL entries
 */
export async function getResourceACL(resource: Resource): Promise<ACLEntry[]> {
  const aclKey = `${resource.type}:${resource.id}`;
  return accessControlList.get(aclKey) || [];
}

/**
 * Gets all resources a user has access to
 * 
 * @param userId - The user ID
 * @param resourceType - Optional filter by resource type
 * @returns Array of resource IDs the user can access
 */
export async function getUserAccessibleResources(
  userId: string,
  resourceType?: string
): Promise<string[]> {
  const accessibleResources: string[] = [];

  for (const [aclKey, entries] of accessControlList.entries()) {
    const [type, id] = aclKey.split(':');
    
    if (resourceType && type !== resourceType) {
      continue;
    }

    const hasAccess = entries.some(entry => entry.userId === userId);
    if (hasAccess) {
      accessibleResources.push(id);
    }
  }

  return accessibleResources;
}

/**
 * Handles unauthorized access attempts
 * Requirement 11.5: Deny access and create security alert
 * 
 * @param userContext - The user attempting access
 * @param resource - The resource being accessed
 * @param action - The action being attempted
 * @param ipAddress - IP address of the request
 * @param deviceId - Device ID of the request
 * @returns Security alert data
 */
export async function handleUnauthorizedAccess(
  userContext: UserContext,
  resource: Resource,
  action: Action,
  ipAddress: string,
  deviceId: string
): Promise<{ denied: true; alert: import('./types').SecurityAlertData }> {
  // Create security alert
  const alert: import('./types').SecurityAlertData = {
    severity: 'high',
    type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    description: `User ${userContext.userId} (role: ${userContext.role}) attempted unauthorized ${action} access to ${resource.type} ${resource.id} from IP ${ipAddress}`,
    userId: userContext.userId,
    requiresAction: true,
  };

  // Log the unauthorized access attempt
  await logUnauthorizedAccess({
    userId: userContext.userId,
    resource,
    action,
    ipAddress,
    deviceId,
    timestamp: new Date(),
  });

  return { denied: true, alert };
}

/**
 * Logs unauthorized access attempts to audit log
 * 
 * @param attempt - Details of the unauthorized access attempt
 */
async function logUnauthorizedAccess(attempt: {
  userId: string;
  resource: Resource;
  action: Action;
  ipAddress: string;
  deviceId: string;
  timestamp: Date;
}): Promise<void> {
  try {
    // Import supabase dynamically to avoid circular dependencies
    const { supabase } = await import('../../config/supabase');
    
    await supabase.from('audit_logs').insert({
      log_type: 'SECURITY_EVENT',
      user_id: attempt.userId,
      event_type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      severity: 'high',
      event_description: `Unauthorized ${attempt.action} attempt on ${attempt.resource.type} ${attempt.resource.id}`,
      ip_address: attempt.ipAddress,
      device_id: attempt.deviceId,
      timestamp: attempt.timestamp.toISOString(),
    });
  } catch (error) {
    console.error('Failed to log unauthorized access attempt:', error);
    // Don't throw - we still want to deny access even if logging fails
  }
}

/**
 * Clears all ACL entries (for testing purposes)
 */
export function clearACL(): void {
  accessControlList.clear();
}
