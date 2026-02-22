# Password Reset - Quick Reference

## 🚀 Quick Setup (5 minutes)

### 1. Configure Supabase
Go to: https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/url-configuration

Add these redirect URLs:
```
logpeerrecovery://**
logpeerrecovery://reset-password
```

### 2. Rebuild App
```bash
cd log-peer-recovery
npx expo run:android  # or npx expo run:ios
```

### 3. Test
1. Tap "Forgot Password" on login screen
2. Enter email
3. Check email on device
4. Tap reset link → App opens to reset screen ✅

---

## 📁 Files Changed

| File | What Changed |
|------|--------------|
| `src/screens/auth/ResetPasswordScreen.tsx` | ✨ NEW - Password reset UI |
| `src/components/DeepLinkHandler.tsx` | Added navigation to reset screen |
| `src/contexts/AuthContext.tsx` | Added PASSWORD_RECOVERY listener |
| `src/navigation/AuthNavigator.tsx` | Added ResetPassword route |
| `src/navigation/RootNavigator.tsx` | Added Supabase URL prefix |
| `src/navigation/types.ts` | Added ResetPassword type |

---

## 🔍 How It Works

```
Email link clicked
    ↓
App opens (via deep link)
    ↓
DeepLinkHandler sets session
    ↓
Navigates to ResetPasswordScreen
    ↓
User enters new password
    ↓
Password updated in Supabase
    ↓
Redirects to login
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Opens Chrome instead of app | Rebuild with `npx expo run:android` |
| App opens but shows error | Check Supabase redirect URLs |
| Doesn't navigate to reset screen | Check console logs for errors |
| Password reset fails | Verify session is active |

---

## 📋 Password Requirements

- ✅ Minimum 12 characters
- ✅ One uppercase letter
- ✅ One lowercase letter
- ✅ One number
- ✅ One special character

---

## 🧪 Test Commands

**Android:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://reset-password"
```

**iOS:**
```bash
xcrun simctl openurl booted "logpeerrecovery://reset-password"
```

---

## 📚 Full Documentation

See `PASSWORD_RESET_SETUP.md` for complete details.

---

**Ready to test!** 🎉
