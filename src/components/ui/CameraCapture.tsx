import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, radii, typography, spacing } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';

export type QualityFeedback =
  | 'center_face'
  | 'turn_left'
  | 'turn_right'
  | 'hold_steady'
  | 'too_dark'
  | 'too_close'
  | 'too_far'
  | 'ready';

export interface QualityGateStatus {
  isReady: boolean;
  feedback: QualityFeedback;
  feedbackMessage: string;
}

export interface QualityGatingConfig {
  enabled?: boolean;
  autoCapture?: boolean;
  holdDurationMs?: number;
  onStatusChange?: (status: QualityGateStatus) => void;
}

export interface CameraCaptureProps {
  instruction: string;
  subtext?: string;
  stepBadge?: string;
  type?: 'face' | 'shelf';
  facing?: CameraType;
  allowFlip?: boolean;
  allowLibrary?: boolean;
  qualityGating?: QualityGatingConfig;
  onCapture: (uri: string) => void;
  onCancel?: () => void;
}

const { width } = Dimensions.get('window');

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  instruction,
  subtext = 'Hold steady in good light',
  stepBadge,
  type = 'face',
  facing: initialFacing,
  allowFlip = false,
  allowLibrary,
  qualityGating,
  onCapture,
  onCancel,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Default facing: front for face baseline selfies, back for shelf/product scanning
  const defaultFacing: CameraType = type === 'face' ? 'front' : 'back';
  const [facing, setFacing] = useState<CameraType>(initialFacing || defaultFacing);

  // Library upload is strictly disabled for standardized face baseline captures
  const libraryAllowed = allowLibrary ?? (type === 'shelf');

  const cameraRef = useRef<CameraView>(null);

  const handleFlip = () => {
    Haptics.selectionAsync();
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  const handleShutterPress = async () => {
    if (isCapturing) return;

    try {
      setIsCapturing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (cameraRef.current) {
        const picture = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        });

        if (picture?.uri) {
          setCapturedUri(picture.uri);
          return;
        }
      }

      // If camera reference was not available or didn't return a URI
      if (__DEV__) {
        // Fallback for simulator testing where physical camera hardware is absent
        setCapturedUri(
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80'
        );
      }
    } catch (err) {
      console.warn('Camera capture error, attempting fallback:', err);
      if (__DEV__) {
        setCapturedUri(
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80'
        );
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleLaunchLibrary = async () => {
    if (!libraryAllowed) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'face' ? [3, 4] : [4, 3],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setCapturedUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Library launch error:', e);
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

  // 1. Permission Loading State
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  // 2. Permission Not Granted State
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <Icon name="camera" size={32} color={colors.brand} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtext}>
            {type === 'face'
              ? 'Derive uses your front-facing camera to capture standardized baseline photos for your care review. Photos stay private to your care loop.'
              : 'Derive uses your camera to scan skincare product bottles and recognize active ingredients.'}
          </Text>

          <View style={styles.permissionActions}>
            {permission.canAskAgain ? (
              <Button
                label="Enable Camera"
                variant="primary"
                size="large"
                onPress={requestPermission}
                style={{ width: '100%' }}
              />
            ) : (
              <Button
                label="Open Settings"
                variant="primary"
                size="large"
                onPress={() => Linking.openSettings()}
                style={{ width: '100%' }}
              />
            )}

            {onCancel && (
              <Button
                label="Cancel"
                variant="ghost"
                size="medium"
                onPress={onCancel}
                style={{ width: '100%', marginTop: spacing.xs }}
              />
            )}
          </View>
        </View>
      </View>
    );
  }

  // 3. Captured Review State
  if (capturedUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedUri }} style={styles.previewImage} />

        {/* Top Review Notice */}
        <View style={styles.reviewBanner}>
          <Text style={styles.reviewBannerTitle}>Review Your Capture</Text>
          <Text style={styles.reviewBannerSub}>
            Make sure your face is clearly visible in even light without blur.
          </Text>
        </View>

        {/* Bottom Review Actions */}
        <View style={styles.reviewControlsStrip}>
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
        </View>
      </View>
    );
  }

  // 4. Live Camera Viewfinder State
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        facing={facing}
        style={StyleSheet.absoluteFill}
        onCameraReady={() => setIsCameraReady(true)}
      />

      {/* Top Floating HUD Banner */}
      <View style={styles.topHud}>
        <View style={styles.topHudRow}>
          {onCancel ? (
            <TouchableOpacity
              onPress={onCancel}
              style={styles.hudIconButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Cancel camera"
            >
              <Icon name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}

          <View style={styles.instructionPill}>
            {stepBadge && <Text style={styles.stepBadgeText}>{stepBadge}</Text>}
            <Text style={styles.instructionText}>{instruction}</Text>
            {subtext && <Text style={styles.subtextText}>{subtext}</Text>}
          </View>

          {allowFlip ? (
            <TouchableOpacity
              onPress={handleFlip}
              style={styles.hudIconButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Flip camera direction"
            >
              <Icon name="sparkle" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
      </View>

      {/* Center Guidance Reticle */}
      <View style={styles.reticleContainer} pointerEvents="none">
        {type === 'face' ? (
          <View style={styles.faceOvalReticle} />
        ) : (
          <View style={styles.shelfRectReticle} />
        )}
      </View>

      {/* Bottom Shutter & Controls Strip */}
      <View style={styles.controlsStrip}>
        <View style={styles.shutterRow}>
          <View style={{ width: 60 }} />

          {/* Shutter Button */}
          <TouchableOpacity
            onPress={handleShutterPress}
            activeOpacity={0.8}
            disabled={isCapturing}
            style={[styles.shutterButton, isCapturing && styles.shutterButtonCapturing]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>

          {/* Upload Button: strictly for shelf only */}
          {libraryAllowed ? (
            <TouchableOpacity
              onPress={handleLaunchLibrary}
              style={styles.uploadAltButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Upload from camera roll"
            >
              <Text style={styles.uploadAltText}>Upload</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permissionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.sectionTitle,
    lineHeight: typography.lineHeights.sectionTitle,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  permissionSubtext: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionActions: {
    width: '100%',
    gap: spacing.xs,
  },
  topHud: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.lg,
  },
  topHudRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  hudIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionPill: {
    flex: 1,
    marginHorizontal: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.brand,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    marginBottom: 2,
  },
  subtextText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.sizes.caption,
    textAlign: 'center',
  },
  reticleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOvalReticle: {
    width: width * 0.72,
    height: width * 0.95,
    borderRadius: (width * 0.72) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  shelfRectReticle: {
    width: width * 0.85,
    height: width * 0.65,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  reviewBanner: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  reviewBannerTitle: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  reviewBannerSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: typography.sizes.caption,
    textAlign: 'center',
  },
  reviewControlsStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    backgroundColor: 'rgba(23, 26, 24, 0.95)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  controlsStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    backgroundColor: 'rgba(23, 26, 24, 0.92)',
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
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonCapturing: {
    borderColor: colors.brand,
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
    justifyContent: 'center',
    minHeight: 44,
  },
  uploadAltText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
  },
});
