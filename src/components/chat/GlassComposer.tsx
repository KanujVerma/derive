import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { GlassContainer } from '@/src/components/ui/GlassContainer';
import { colors, radii, typography, spacing } from '@/src/constants/theme';

import { Icon } from '@/src/components/ui/Icon';
import { VoiceInputButton } from '@/src/components/ui/VoiceInputButton';

interface GlassComposerProps {
  onSendMessage: (text: string, imageUri?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

export const GlassComposer: React.FC<GlassComposerProps> = ({
  onSendMessage,
  placeholder = 'Ask Derive about a product or your skin...',
  disabled = false,
  isLoading = false,
}) => {
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const handlePickImage = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setAttachedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !attachedImage) || disabled || isLoading) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const outgoingText = text.trim();
    const outgoingImage = attachedImage || undefined;
    setText('');
    setAttachedImage(null);
    onSendMessage(outgoingText, outgoingImage);
  };

  return (
    <View style={styles.outerContainer}>
      <GlassContainer isFloating={true} style={styles.glassContainer}>
        {/* Attached thumbnail preview if present */}
        {attachedImage && (
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: attachedImage }} style={styles.thumbnail} />
            <TouchableOpacity
              onPress={() => setAttachedImage(null)}
              style={styles.removeThumbnailButton}
              accessible={true}
              accessibilityLabel="Remove attached image"
            >
              <Icon name="close" size={14} color={colors.inkInverse} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          {/* Camera / Photo Attachment Button */}
          <TouchableOpacity
            onPress={handlePickImage}
            activeOpacity={0.7}
            style={styles.iconButton}
            accessible={true}
            accessibilityLabel="Attach skincare photo"
            accessibilityRole="button"
          >
            <Icon name="camera" size={20} color={colors.inkMuted} />
          </TouchableOpacity>

          {/* Voice Input Button */}
          <VoiceInputButton
            context="ask"
            size={34}
            disabled={disabled || isLoading}
            onTranscript={(transcribed) => {
              setText((prev) => (prev ? `${prev} ${transcribed}` : transcribed));
            }}
          />

          {/* Text Input */}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.inkMuted}
            multiline={true}
            style={styles.input}
            editable={!disabled && !isLoading}
            accessible={true}
            accessibilityLabel="Message input field"
          />

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSend}
            activeOpacity={0.7}
            disabled={(!text.trim() && !attachedImage) || disabled || isLoading}
            style={[
              styles.sendButton,
              (!text.trim() && !attachedImage || isLoading) && styles.sendButtonDisabled,
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Icon name="forward" size={16} color={colors.inkInverse} />
          </TouchableOpacity>
        </View>
      </GlassContainer>
    </View>
  );
};


const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  glassContainer: {
    padding: spacing.xs,
    borderRadius: radii.xl,
  },
  thumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
  },
  removeThumbnailButton: {
    marginLeft: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeThumbnailText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  cameraIcon: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    color: colors.ink,
    fontSize: typography.sizes.bodyRegular,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  sendIcon: {
    color: colors.inkInverse,
    fontSize: 20,
    fontWeight: typography.weights.bold,
  },
});
