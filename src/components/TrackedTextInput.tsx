import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useActivityTracking } from '../hooks/useActivityTracking';

/**
 * TrackedTextInput - TextInput wrapper with automatic activity tracking
 * 
 * This component automatically tracks user activity for idle timeout management.
 * Use this instead of plain TextInput to ensure typing resets the idle timer.
 * 
 * Features:
 * - Automatically calls activity tracking on focus
 * - Automatically calls activity tracking on text change
 * - Automatically calls activity tracking on key press
 * - Throttled to prevent excessive updates (2 second minimum)
 * - Passes through all TextInput props
 * 
 * Usage:
 * ```tsx
 * import { TrackedTextInput } from '../components/TrackedTextInput';
 * 
 * <TrackedTextInput
 *   value={text}
 *   onChangeText={setText}
 *   placeholder="Enter text"
 * />
 * ```
 */
export const TrackedTextInput = React.forwardRef<TextInput, TextInputProps>(
  (props, ref) => {
    const { onFocus, onChange, onKeyPress } = useActivityTracking();

    const handleFocus = (e: any) => {
      onFocus();
      props.onFocus?.(e);
    };

    const handleChangeText = (text: string) => {
      onChange();
      props.onChangeText?.(text);
    };

    const handleKeyPress = (e: any) => {
      onKeyPress();
      props.onKeyPress?.(e);
    };

    return (
      <TextInput
        {...props}
        ref={ref}
        onFocus={handleFocus}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
      />
    );
  }
);

TrackedTextInput.displayName = 'TrackedTextInput';
