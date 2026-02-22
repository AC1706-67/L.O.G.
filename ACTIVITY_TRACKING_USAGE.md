# Activity Tracking Usage Guide

## Overview

The app uses multiple methods to detect user activity and reset the idle timer:

1. **ActivityTracker** (automatic) - Detects touch events and navigation
2. **TrackedTextInput** (recommended) - Automatic activity tracking for text input
3. **useActivityTracking hook** (manual) - For custom components

All activity tracking is **throttled to 2 seconds minimum** to prevent excessive state updates during scrolling, typing, and continuous gestures.

---

## What ActivityTracker Detects Automatically

✅ **Reliably Detected:**
- Taps/touches on any UI element
- Button presses
- Touchable component interactions
- Navigation changes (screen switches, tab changes)

✅ **Usually Detected (depends on component structure):**
- Swipe gestures
- Scroll gestures in ScrollView/FlatList
- Drag operations

The detection depends on how React Native's responder system captures events. Touch and gesture activity is broadly detected, but scroll gestures depend on responder capture and component structure.

❌ **NOT Detected:**
- Typing in TextInput fields
- Keyboard input
- Programmatic changes

---

## Recommended: Use TrackedTextInput

The easiest way to track text input activity is to use `TrackedTextInput` instead of `TextInput`:

### Example 1: Simple text input

```typescript
import { TrackedTextInput } from '../components/TrackedTextInput';

const MyComponent = () => {
  const [text, setText] = useState('');

  return (
    <TrackedTextInput
      value={text}
      onChangeText={setText}
      placeholder="Enter text"
    />
  );
};
```

### Example 2: Form with multiple inputs

```typescript
import { TrackedTextInput } from '../components/TrackedTextInput';

const FormComponent = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <View>
      <TrackedTextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
      />
      
      <TrackedTextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
      />
    </View>
  );
};
```

### Example 3: All TextInput props work

```typescript
<TrackedTextInput
  value={password}
  onChangeText={setPassword}
  placeholder="Password"
  secureTextEntry
  autoCapitalize="none"
  onSubmitEditing={handleSubmit}
  returnKeyType="done"
  // All standard TextInput props are supported
/>
```

---

## Alternative: Using useActivityTracking Hook

For custom components or when you need more control:

### Example 1: Manual TextInput tracking

```typescript
import { TextInput } from 'react-native';
import { useActivityTracking } from '../hooks/useActivityTracking';

const MyComponent = () => {
  const { onFocus, onChange } = useActivityTracking();
  const [text, setText] = useState('');

  return (
    <TextInput
      value={text}
      onChangeText={(value) => {
        setText(value);
        onChange(); // Reset idle timer on typing
      }}
      onFocus={onFocus} // Reset idle timer when focused
      placeholder="Enter text"
    />
  );
};
```

### Example 2: Custom button with activity tracking

```typescript
import { TouchableOpacity, Text } from 'react-native';
import { useActivityTracking } from '../hooks/useActivityTracking';

const CustomButton = ({ onPress, title }) => {
  const { onPress: trackPress } = useActivityTracking();

  const handlePress = () => {
    trackPress(); // Reset idle timer
    onPress(); // Execute button action
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
};
```

### Example 3: Generic activity tracking

```typescript
import { useActivityTracking } from '../hooks/useActivityTracking';

const MyComponent = () => {
  const { trackActivity } = useActivityTracking();

  const handleCustomAction = () => {
    trackActivity(); // Reset idle timer
    // ... your custom logic
  };

  return (
    // ... your component
  );
};
```

---

## Hook API

```typescript
const {
  trackActivity, // Generic activity tracker
  onFocus,      // For TextInput onFocus
  onChange,     // For TextInput onChangeText
  onPress,      // For button/touchable onPress
  onKeyPress,   // For TextInput onKeyPress
} = useActivityTracking();
```

All methods are:
- Safe to call (only update when authenticated)
- Throttled (2 second minimum between updates)
- Optimized for performance

---

## Throttling Behavior

### Why Throttling?
Scrolling and typing can fire hundreds of events per second. Throttling prevents:
- Excessive state updates
- Battery drain
- Performance issues

### How It Works:
- Minimum 2 seconds between activity updates
- First event triggers immediately
- Subsequent events within 2 seconds are ignored
- After 2 seconds, next event triggers update

### Example Timeline:
```
0.0s: User starts typing → Activity updated ✅
0.5s: User still typing → Ignored (throttled)
1.0s: User still typing → Ignored (throttled)
1.5s: User still typing → Ignored (throttled)
2.0s: User still typing → Activity updated ✅
2.5s: User still typing → Ignored (throttled)
```

---

## When to Use Each Method

### ✅ Use TrackedTextInput for:
- Any TextInput in your app
- Forms with user input
- Search bars
- Chat/messaging interfaces
- Password fields
- Email inputs

### ✅ Use useActivityTracking hook for:
- Custom gesture handlers
- Non-standard input components
- Custom interactive elements
- When you need fine-grained control

### ❌ Don't need either for:
- Regular buttons (TouchableOpacity, Button)
- ScrollView/FlatList scrolling (usually auto-detected)
- Tab navigation (auto-detected)
- Drawer navigation (auto-detected)
- Most standard UI interactions (auto-detected)

---

## Performance Considerations

### Battery Optimization:
- Idle check interval: 15 seconds
- Activity updates throttled: 2 seconds minimum
- No performance impact from activity tracking
- Efficient state batching

### Best Practices:
1. ✅ Use `TrackedTextInput` for all text inputs
2. ✅ Let throttling handle rapid events
3. ❌ Don't call `trackActivity()` in render loops
4. ❌ Don't track automated/programmatic changes
5. ✅ Only track meaningful user interactions

---

## Testing Activity Tracking

### Test 1: Typing resets timer
1. Login
2. Wait 9 minutes
3. Start typing in a TrackedTextInput
4. Wait another 9 minutes
5. ✅ Warning should NOT appear (timer was reset)

### Test 2: Navigation resets timer
1. Login
2. Wait 9 minutes
3. Navigate to another screen
4. Wait another 9 minutes
5. ✅ Warning should NOT appear (timer was reset)

### Test 3: Touch resets timer
1. Login
2. Wait 9 minutes
3. Tap anywhere on screen
4. Wait another 9 minutes
5. ✅ Warning should NOT appear (timer was reset)

### Test 4: Throttling works
1. Login
2. Rapidly type in TrackedTextInput
3. Check console logs (should see updates every 2+ seconds, not every keystroke)
4. ✅ Activity updates are throttled

### Test 5: Scroll resets timer
1. Login
2. Wait 9 minutes
3. Scroll a list
4. Wait another 9 minutes
5. ✅ Warning should NOT appear (timer was reset)

---

## Implementation Checklist

When creating new screens:

- [ ] Replace all `TextInput` with `TrackedTextInput`
- [ ] Import from `'../components/TrackedTextInput'`
- [ ] Test that typing resets idle timer
- [ ] Verify warning doesn't appear during active typing
- [ ] Check that throttling is working (console logs)

---

## Migration Guide

### Before (Manual Tracking):
```typescript
import { TextInput } from 'react-native';
import { useActivityTracking } from '../hooks/useActivityTracking';

const MyScreen = () => {
  const { onFocus, onChange } = useActivityTracking();
  const [text, setText] = useState('');
  
  return (
    <TextInput
      value={text}
      onChangeText={(value) => {
        setText(value);
        onChange(); // Manual tracking
      }}
      onFocus={onFocus} // Manual tracking
    />
  );
};
```

### After (Automatic Tracking):
```typescript
import { TrackedTextInput } from '../components/TrackedTextInput';

const MyScreen = () => {
  const [text, setText] = useState('');
  
  return (
    <TrackedTextInput
      value={text}
      onChangeText={setText}
      // Activity tracking is automatic!
    />
  );
};
```

---

## Example: Complete Login Screen

```typescript
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { TrackedTextInput } from '../components/TrackedTextInput';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    await login({ email, password });
  };

  return (
    <View style={styles.container}>
      <TrackedTextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      
      <TrackedTextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
      
      <TouchableOpacity onPress={handleLogin} style={styles.button}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## Summary

**Automatic Detection:**
- ✅ Taps, touches (PanResponder)
- ✅ Navigation changes (Navigation listener)
- ✅ Scroll gestures (usually detected, depends on structure)

**Manual Detection Required:**
- ⚠️ TextInput typing → Use `TrackedTextInput` (recommended)
- ⚠️ Custom interactions → Use `useActivityTracking()` hook

**Performance Optimized:**
- ✅ Throttled: 2 second minimum between updates
- ✅ Battery efficient: 15 second check interval
- ✅ No performance impact

**Recommended Approach:**
1. Use `TrackedTextInput` for all text inputs
2. Let automatic detection handle everything else
3. Use `useActivityTracking()` hook only for custom cases

---

**Next Steps:** Replace all `TextInput` components with `TrackedTextInput` in your screens.
