/**
 * Signature Capture Component
 * Provides digital signature capture functionality
 * Requirement 1.3: Create digital signature capture
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';

interface SignatureCaptureProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
}

export const SignatureCapture: React.FC<SignatureCaptureProps> = ({ onSave, onCancel }) => {
  const [paths, setPaths] = useState<Array<{ x: number; y: number }[]>>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleTouchStart = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setIsDrawing(true);
    setCurrentPath([{ x: locationX, y: locationY }]);
  };

  const handleTouchMove = (event: any) => {
    if (!isDrawing) return;
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
  };

  const handleTouchEnd = () => {
    if (currentPath.length > 0) {
      setPaths((prev) => [...prev, currentPath]);
      setCurrentPath([]);
    }
    setIsDrawing(false);
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const handleSave = () => {
    if (paths.length === 0) {
      Alert.alert('Error', 'Please provide a signature before saving');
      return;
    }

    // Convert signature paths to base64 string
    // In a real implementation, this would render the paths to a canvas and export as image
    const signatureData = JSON.stringify(paths);
    const base64Signature = Buffer.from(signatureData).toString('base64');
    
    onSave(base64Signature);
  };

  return (
    <Modal visible={true} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sign Here</Text>
          <Text style={styles.subtitle}>Use your finger to sign in the box below</Text>
        </View>

        <View
          style={styles.signatureCanvas}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Render signature paths */}
          {paths.map((path, pathIndex) => (
            <View key={pathIndex}>
              {path.map((point, pointIndex) => (
                <View
                  key={pointIndex}
                  style={[
                    styles.point,
                    {
                      left: point.x - 2,
                      top: point.y - 2,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
          {currentPath.map((point, pointIndex) => (
            <View
              key={`current-${pointIndex}`}
              style={[
                styles.point,
                {
                  left: point.x - 2,
                  top: point.y - 2,
                },
              ]}
            />
          ))}

          {paths.length === 0 && currentPath.length === 0 && (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>Sign here</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  signatureCanvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    position: 'relative',
  },
  point: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#000000',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#CCC',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  clearButton: {
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
