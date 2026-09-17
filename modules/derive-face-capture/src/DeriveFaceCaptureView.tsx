import React from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';
import type { FrameQualityMetrics } from '@/src/components/camera/AutoCaptureStateMachine';

export interface DeriveFaceCaptureViewProps extends ViewProps {
  targetAngle?: 'front' | 'left' | 'right';
  isActive?: boolean;
  onFrameMetrics?: (event: { nativeEvent: FrameQualityMetrics }) => void;
  onPhotoCaptured?: (event: { nativeEvent: { uri: string } }) => void;
}

const NativeView: React.ComponentType<DeriveFaceCaptureViewProps> =
  requireNativeViewManager('DeriveFaceCapture');

export default function DeriveFaceCaptureView(props: DeriveFaceCaptureViewProps) {
  return <NativeView {...props} />;
}
