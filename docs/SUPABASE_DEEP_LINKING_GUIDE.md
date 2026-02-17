# Supabase Deep Linking Implementation Guide

Complete guide for implementing Supabase invite deep links in your Expo React Native app.

---

## PART 1: Expo Configuration

### Deep Link Scheme
Your app is configured with the custom scheme: `logpeerrecovery://`

**Location:** `app.config.js`

```javascript
scheme: "logpeerrecovery"
```

### iOS Configuration
- **Bundle Identifier:** `com.logpeerrecovery.app`
- **Associated Domains:** `applinks:nkedmosycikakajobaht.supabase.co`
  - Enables Universal Links (HTTPS links that open your app)
  - More secure than custom schemes
  - Better user experience (no "Open in app?" prompt)

### Android Configuration
- **Package:** `com.logpeerrecovery.app`
- **Intent Filters:** Configured to handle both custom scheme and HTTPS links
  - Custom scheme: `logpeerrecovery://`
  - HTTPS: `https://nkedmosycikakajobaht.supabase.co/auth/v1/verify`

---

## PART 2: Supabase Dashboard Configuration

### Navigate to: Authentication → URL Configuration

### 1. Site URL
```
logpeerrecovery://
```

**Why:** This is the base URL Supabase uses to construct redirect URLs. When a user clicks an invite link, Supabase will redirect to this scheme, which opens your mobile app.

### 2. Redirect URLs (Add all of these)
```
logpeerrecovery://**
logpeerrecovery://auth/callback
logpeerrecovery://auth/callback/**
https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
```

**Why each URL:**
- `logpeerrecovery://**` - Wildcard to allow any path under your scheme
- `logpeerrecovery://auth/callback` - Specific callback endpoint
- `logpeerrecovery://auth/callback/**` - Callback with additional parameters
- `https://...` - Fallback for web/testing

### 3. Additional Email Template Configuration

Navigate to: **Authentication → Email Templates**

For each template (Invite User, Reset Password, etc.), ensure the redirect URL uses your custom scheme:

**Invite User Template:**
```
{{ .ConfirmationURL }}
```

This variable automatically uses your configured Site URL.

**Important:** The confirmation URL will be:
```
logpeerrecovery://auth/callback?type=invite&access_token=...&refresh_token=...
```

---

## PART 3: How It Works - End-to-End Flow

### Step-by-Step Process

1. **Admin Sends Invite**
   ```typescript
   // In your admin panel
   await supabase.auth.admin.inviteUserByEmail('user@example.com')
   ```

2. **User Receives Email**
   - Email contains link like: `logpeerrecovery://auth/callback?type=invite&token=...`
   - Or with PKCE: `logpeerrecovery://auth/callback?type=invite&access_token=...&refresh_token=...`

3. **User Taps Link**
   - Mobile OS recognizes `logpeerrecovery://` scheme
   - OS opens your app (or prompts to open if not running)

4. **App Opens**
   - `DeepLinkHandler` component is mounted
   - Listens for the incoming URL via `Linking.getInitialURL()` or `Linking.addEventListener()`

5. **Link Processing**
   ```typescript
   // DeepLinkHandler detects Supabase auth callback
   const parsed = Linking.parse(url);
   const { queryParams } = parsed;
   
   // Checks for: type, access_token, refresh_token, error
   if (isSupabaseAuthCallback(queryParams)) {
     await handleSupabaseAuthCallback(queryParams);
   }
   ```

6. **Session Exchange**
   ```typescript
   // With PKCE flow (automatic)
   const { data: { session } } = await supabase.auth.getSession();
   
   // Or manual token exchange
   await supabase.auth.setSession({
     access_token: params.access_token,
     refresh_token: params.refresh_token,
   });
   ```

7. **Session Persistence**
   - Supabase client automatically stores session in AsyncStorage
   - Session includes: access_token, refresh_token, user data
   - Auto-refresh enabled (tokens refresh before expiry)

8. **Auth State Update**
   ```typescript
   // AuthContext listens to auth state changes
   supabase.auth.onAuthStateChange((event, session) => {
     if (event === 'SIGNED_IN' && session) {
       // Update app state
       // Fetch user profile
       // Navigate to authenticated screens
     }
   });
   ```

9. **User Is Logged In**
   - App navigates to authenticated screens
   - User can complete profile setup if needed
   - Session persists across app restarts

---

## PART 4: Code Architecture

### Component Hierarchy
```
App.tsx
└── SafeAreaProvider
    └── AuthProvider (manages auth state)
        └── DeepLinkHandler (processes deep links)
            └── SessionManager (handles timeouts)
                └── RootNavigator (navigation)
```

### Key Components

#### 1. DeepLinkHandler (`src/components/DeepLinkHandler.tsx`)
- Listens for deep links
- Parses Supabase auth callbacks
- Exchanges tokens for sessions
- Shows loading/error states

#### 2. AuthContext (`src/contexts/AuthContext.tsx`)
- Manages authentication state
- Listens to Supabase auth changes
- Handles login, logout, session management
- Provides auth state to entire app

#### 3. Supabase Client (`src/config/supabase.ts`)
- Configured with PKCE flow
- AsyncStorage for persistence
- Auto token refresh enabled

### Auth Flow Types Supported

1. **Invite** (`type=invite`)
   - New user invitation
   - Creates account and session

2. **Recovery** (`type=recovery`)
   - Password reset
   - User can set new password after session created

3. **Magic Link** (`type=magiclink`)
   - Passwordless login
   - Direct session creation

4. **Email Confirmation** (`type=signup` or `type=email`)
   - Email verification
   - Confirms email and creates session

---

## PART 5: Testing Deep Links

### Test on iOS Simulator
```bash
xcrun simctl openurl booted "logpeerrecovery://auth/callback?type=invite&access_token=test&refresh_token=test"
```

### Test on Android Emulator
```bash
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://auth/callback?type=invite&access_token=test&refresh_token=test"
```

### Test on Physical Device

1. **Send yourself a test email:**
   ```bash
   # Use Supabase CLI or dashboard to send invite
   ```

2. **Or create a test link:**
   - Create a note/message with the deep link
   - Tap it on your device

3. **Or use a QR code:**
   - Generate QR code with deep link
   - Scan with device camera

### Debug Logging

Enable detailed logging in `DeepLinkHandler.tsx`:
```typescript
console.log('Processing deep link:', url);
console.log('Parsed params:', queryParams);
console.log('Auth type:', authType);
```

Check logs in:
- **iOS:** Xcode console or `npx react-native log-ios`
- **Android:** Android Studio Logcat or `npx react-native log-android`

---

## PART 6: Common Issues & Solutions

### Issue 1: "localhost:3000" in Email Links
**Problem:** Email links redirect to localhost instead of app

**Solution:**
- Update Supabase Site URL to `logpeerrecovery://`
- Update Redirect URLs to include your scheme
- Regenerate email templates if needed

### Issue 2: App Doesn't Open on Link Tap
**Problem:** Tapping link opens browser instead of app

**Solutions:**
- **iOS:** Ensure scheme is in `app.config.js`
- **Android:** Check `intentFilters` in `app.config.js`
- Rebuild app: `eas build` or `expo run:android/ios`
- Clear app data and reinstall

### Issue 3: "Invalid Redirect URL" Error
**Problem:** Supabase rejects the redirect

**Solution:**
- Add exact redirect URL to Supabase dashboard
- Include wildcard patterns: `logpeerrecovery://**`
- Check for typos in scheme name

### Issue 4: Session Not Persisting
**Problem:** User logged out after app restart

**Solutions:**
- Verify `persistSession: true` in Supabase client
- Check AsyncStorage permissions
- Ensure `autoRefreshToken: true` is set
- Check for session timeout (15 minutes default)

### Issue 5: Deep Link Works in Dev, Not Production
**Problem:** Deep links work in Expo Go but not in EAS build

**Solutions:**
- Ensure `scheme` is in `app.config.js` (not just `app.json`)
- Rebuild with EAS: `eas build --platform android/ios`
- For iOS: Configure Associated Domains in Apple Developer Portal
- For Android: Verify package name matches

### Issue 6: Android Intent Filter Not Working
**Problem:** Android doesn't recognize HTTPS links

**Solutions:**
- Add `autoVerify: true` to intent filters
- Create `.well-known/assetlinks.json` file (for App Links)
- Verify domain ownership in Google Search Console
- Use custom scheme as fallback

### Issue 7: Multiple Auth Callbacks
**Problem:** Deep link handler called multiple times

**Solution:**
- Add debouncing to `processDeepLink` function
- Track processed URLs to avoid duplicates
- Use `useRef` to store processing state

---

## PART 7: Production Readiness Checklist

### Pre-Launch Checklist

- [ ] **Expo Configuration**
  - [ ] Custom scheme configured (`logpeerrecovery://`)
  - [ ] Bundle identifier set (iOS)
  - [ ] Package name set (Android)
  - [ ] Associated domains configured (iOS)
  - [ ] Intent filters configured (Android)

- [ ] **Supabase Configuration**
  - [ ] Site URL set to custom scheme
  - [ ] All redirect URLs added
  - [ ] Email templates updated
  - [ ] PKCE flow enabled
  - [ ] Row Level Security (RLS) enabled on all tables

- [ ] **Code Implementation**
  - [ ] DeepLinkHandler integrated
  - [ ] AuthContext listens to auth state changes
  - [ ] Session persistence enabled
  - [ ] Auto token refresh enabled
  - [ ] Error handling implemented
  - [ ] Loading states shown to user

- [ ] **Testing**
  - [ ] Tested invite flow on iOS
  - [ ] Tested invite flow on Android
  - [ ] Tested password recovery
  - [ ] Tested with app closed
  - [ ] Tested with app in background
  - [ ] Tested with app in foreground
  - [ ] Tested session persistence
  - [ ] Tested auto token refresh

- [ ] **Security**
  - [ ] HTTPS enforced for API calls
  - [ ] Tokens stored securely (AsyncStorage)
  - [ ] Session timeout configured (15 minutes)
  - [ ] MFA available for sensitive accounts
  - [ ] Audit logging enabled
  - [ ] HIPAA BAA signed with Supabase

- [ ] **User Experience**
  - [ ] Loading indicator during auth
  - [ ] Error messages user-friendly
  - [ ] Success feedback provided
  - [ ] Smooth navigation after auth
  - [ ] Profile setup flow for new users

- [ ] **Monitoring**
  - [ ] Error tracking configured (Sentry, etc.)
  - [ ] Analytics for auth events
  - [ ] Deep link success/failure metrics
  - [ ] Session duration tracking

### Post-Launch Monitoring

Monitor these metrics:
- Deep link success rate
- Auth completion rate
- Session persistence rate
- Token refresh failures
- User-reported auth issues

---

## PART 8: Advanced Configuration

### Universal Links (iOS)

For production iOS apps, configure Universal Links:

1. **Add Associated Domains capability in Apple Developer Portal**
2. **Create apple-app-site-association file:**
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [{
         "appID": "TEAM_ID.com.logpeerrecovery.app",
         "paths": ["/auth/v1/verify", "/auth/v1/callback"]
       }]
     }
   }
   ```
3. **Host file at:** `https://nkedmosycikakajobaht.supabase.co/.well-known/apple-app-site-association`

### App Links (Android)

For production Android apps, configure App Links:

1. **Create assetlinks.json:**
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.logpeerrecovery.app",
       "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
     }
   }]
   ```
2. **Host file at:** `https://nkedmosycikakajobaht.supabase.co/.well-known/assetlinks.json`

### Custom Email Templates

Customize invite emails in Supabase dashboard:

```html
<h2>You're invited to LOG Peer Recovery</h2>
<p>Click the link below to accept your invitation:</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
```

The `{{ .ConfirmationURL }}` variable automatically includes your configured redirect URL.

---

## Support & Resources

- **Expo Linking Docs:** https://docs.expo.dev/guides/linking/
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Supabase PKCE Flow:** https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts
- **React Native Linking:** https://reactnative.dev/docs/linking

---

## Troubleshooting Commands

```bash
# Check if scheme is registered (iOS)
xcrun simctl openurl booted "logpeerrecovery://"

# Check if scheme is registered (Android)
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://"

# View Android logs
adb logcat | grep -i "logpeerrecovery"

# View iOS logs
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "logpeerrecovery"'

# Clear AsyncStorage (for testing)
# Add this to your app temporarily:
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();
```

---

## Quick Reference

### Supabase Dashboard URLs
- **Site URL:** `logpeerrecovery://`
- **Redirect URLs:** `logpeerrecovery://**`

### Test Deep Link
```
logpeerrecovery://auth/callback?type=invite&access_token=test&refresh_token=test
```

### Key Files
- `app.config.js` - Deep link configuration
- `src/config/supabase.ts` - Supabase client with PKCE
- `src/components/DeepLinkHandler.tsx` - Deep link processing
- `src/contexts/AuthContext.tsx` - Auth state management

---

**Implementation Status:** ✅ Complete

Your app is now configured to handle Supabase invite deep links on both iOS and Android!
