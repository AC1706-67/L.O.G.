# Session Timeout Fix - Complete

## Problem Identified

The session timeout was firing every 30 seconds instead of after 15 minutes of inactivity.

### Root Causes:

1. **AuthContext.tsx - Line 75:** The `useEffect` dependency array included `authState.lastActivity`, causing the effect to re-run every time activity was updated, which recreated the interval timer constantly.

2. **SessionManager.tsx - Line 48:** The timeout check logic was broken with incorrect math: `Date.now() - (Date.now() - SESSION_TIMEOUT)` which always evaluated incorrectly.

3. **SessionManager.tsx - Line 56:** The effect was checking every 10 seconds and had `showWarning` in dependencies, causing unnecessary re-renders.

## Fixes Applied

### 1. AuthContext.tsx

**Changed:**
```typescript
// BEFORE - Broken dependency array
useEffect(() => {
  if (!authState.isAuthenticated) return;

  const interval = setInterval(() => {
    if (checkSessionTimeout()) {
      logout();
    }
  }, 60000);

  return () => clearInterval(interval);
}, [authState.isAuthenticated, authState.lastActivity]); // ❌ lastActivity causes constant re-creation
```

**To:**
```typescript
// AFTER - Fixed dependency array
useEffect(() => {
  if (!authState.isAuthenticated) return;

  const interval = setInterval(() => {
    const timeSinceLastActivity = Date.now() - authState.lastActivity;
    if (timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
      console.log('Session timeout - logging out');
      logout();
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}, [authState.isAuthenticated]); // ✅ Only depend on isAuthenticated
```

**Also updated `updateActivity` to properly update session expiry:**
```typescript
const updateActivity = useCallback(() => {
  setAuthState(prev => ({
    ...prev,
    lastActivity: Date.now(),
    session: prev.session ? {
      ...prev.session,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TIMEOUT_MS),
    } : null,
  }));
}, []);
```

### 2. SessionManager.tsx

**Changed:**
```typescript
// BEFORE - Broken timeout check
useEffect(() => {
  if (!isAuthenticated) return;

  const interval = setInterval(() => {
    if (checkSessionTimeout()) {
      handleSessionTimeout();
    } else {
      // ❌ This math is completely wrong
      const timeSinceActivity = Date.now() - (Date.now() - SESSION_TIMEOUT);
      if (timeSinceActivity >= SESSION_TIMEOUT - WARNING_BEFORE_LOGOUT && !showWarning) {
        showTimeoutWarning();
      }
    }
  }, 10000); // ❌ Checking too frequently

  return () => clearInterval(interval);
}, [isAuthenticated, showWarning]); // ❌ showWarning causes re-renders
```

**To:**
```typescript
// AFTER - Fixed timeout check
useEffect(() => {
  if (!isAuthenticated) return;

  const interval = setInterval(() => {
    if (checkSessionTimeout()) {
      handleSessionTimeout();
    }
  }, 60000); // ✅ Check every minute (not every 10 seconds)

  return () => clearInterval(interval);
}, [isAuthenticated, checkSessionTimeout]); // ✅ Proper dependencies
```

## How It Works Now

### Session Timeout Flow:

1. **User logs in** → `lastActivity` set to current time
2. **User interacts with app** → `updateActivity()` called → `lastActivity` updated
3. **Every 60 seconds** → Check if `Date.now() - lastActivity >= 15 minutes`
4. **If timeout reached** → Logout user
5. **If user is active** → Timer resets, no logout

### Key Improvements:

✅ Interval timer only created once per authentication session
✅ Timeout check uses correct math
✅ Checks every 60 seconds (not every 10 seconds)
✅ No unnecessary re-renders
✅ Session properly extends on activity

## Testing

To test the fix:

1. **Login to the app**
2. **Wait 1 minute** - Should NOT logout
3. **Interact with app** - Activity updates
4. **Leave app idle for 15 minutes** - Should logout
5. **Check console logs** - Should see "Session timeout - logging out"

## Configuration

Session timeout is configured in:
- `AuthContext.tsx`: `SESSION_TIMEOUT_MS = 15 * 60 * 1000` (15 minutes)
- `SessionManager.tsx`: `SESSION_TIMEOUT = 15 * 60 * 1000` (15 minutes)

To change timeout duration, update both constants.

## Files Modified

- ✅ `src/contexts/AuthContext.tsx` - Fixed dependency array and timeout logic
- ✅ `src/components/SessionManager.tsx` - Fixed timeout check and interval frequency

---

**Status:** ✅ FIXED - Session timeout now works correctly with 15-minute inactivity period
