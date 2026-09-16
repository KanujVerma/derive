import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';

interface CameraCaptureProps {
  instruction: string;
  subtext?: string;
  type?: 'face' | 'shelf';
  onCapture: (uri: string) => void;
  onCancel?: () => void;
}

const { width } = Dimensions.get('window');

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  instruction,
  subtext = 'Hold steady in good light',
  type = 'face',
  onCapture,
  onCancel,
}) => {
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  const handleLaunchCamera = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        // Fallback to media library
        const lib = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.85,
        });
        if (!lib.canceled && lib.assets[0]?.uri) {
          setCapturedUri(lib.assets[0].uri);
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setCapturedUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Camera error, opening library:', e);
      const lib = await ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
      });
      if (!lib.canceled && lib.assets[0]?.uri) {
        setCapturedUri(lib.assets[0].uri);
      }
    }
  };

  const handleConfirm = async () => {
    if (!capturedUri) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    onCapture(capturedUri);
  };

  const handleRetake = () => {
    setCapturedUri(null);
  };

  return (
    <View style={styles.container}>
      {/* Viewfinder or Preview Area */}
      <View style={styles.viewfinder}>
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.reticleContainer}>
            {type === 'face' ? (
              <View style={styles.faceOvalReticle}>
                <Text style={styles.reticleInstruction}>{instruction}</Text>
                <Text style={styles.reticleSubtext}>{subtext}</Text>
              </View>
            ) : (
              <View style={styles.shelfRectReticle}>
                <Text style={styles.reticleInstruction}>{instruction}</Text>
                <Text style={styles.reticleSubtext}>{subtext}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Control Strip */}
      <View style={styles.controlsStrip}>
        {capturedUri ? (
          <View style={styles.confirmRow}>
            <Button
              label="Retake"
              variant="outline"
              size="medium"
              onPress={handleRetake}
              style={{ flex: 1 }}
            />
            <Button
              label="Use Photo"
              variant="primary"
              size="medium"
              onPress={handleConfirm}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={styles.shutterRow}>
            {onCancel && (
              <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleLaunchCamera}
              activeOpacity={0.8}
              style={styles.shutterButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLaunchCamera}
              style={styles.uploadAltButton}
              accessible={true}
              accessibilityLabel="Upload from camera roll"
            >
              <Text style={styles.uploadAltText}>Upload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewfinder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  reticleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  faceOvalReticle: {
    width: width * 0.72,
    height: width * 0.95,
    borderRadius: (width * 0.72) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  shelfRectReticle: {
    width: width * 0.85,
    height: width * 0.7,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  reticleInstruction: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginBottom: spacing.xxs,
  },
  reticleSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.sizes.caption,
    textAlign: 'center',
  },
  controlsStrip: {
    height: 120,
    backgroundColor: 'rgba(23, 26, 24, 0.95)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelButton: {
    width: 60,
  },
  cancelText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.sizes.bodyRegular,
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  uploadAltButton: {
    width: 60,
    alignItems: 'flex-end',
  },
  uploadAltText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.sizes.bodyRegular,
  },
});
