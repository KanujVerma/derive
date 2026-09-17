import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { Platform, ViewProps } from 'react-native';
import type { FrameQualityMetrics } from '@/src/components/camera/AutoCaptureStateMachine';

export interface DeriveFaceCaptureViewProps extends ViewProps {
  targetAngle?: 'front' | 'left' | 'right';
  isActive?: boolean;
  onFrameMetrics?: (event: { nativeEvent: FrameQualityMetrics }) => void;
  onPhotoCaptured?: (event: { nativeEvent: { uri: string } }) => void;
}

export interface DeriveFaceCaptureViewRef {
  takePhoto: () => Promise<{ uri: string }>;
}

let NativeViewComponent: any = null;

export function isDeriveFaceCaptureSupported(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    if (!NativeViewComponent) {
      NativeViewComponent = requireNativeViewManager('DeriveFaceCapture');
    }
    return !!NativeViewComponent;
  } catch {
    return false;
  }
}

const DeriveFaceCaptureView = forwardRef<DeriveFaceCaptureViewRef, DeriveFaceCaptureViewProps>(
  (props, ref) => {
    const nativeRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      takePhoto: async () => {
        if (nativeRef.current?.takePhoto) {
          return await nativeRef.current.takePhoto();
        }
        throw new Error('DeriveFaceCapture native view ref not available');
      },
    }));

    if (!isDeriveFaceCaptureSupported()) {
      return null;
    }

    const Component = NativeViewComponent || requireNativeViewManager('DeriveFaceCapture');
    return <Component {...props} ref={nativeRef} />;
  }
);

DeriveFaceCaptureView.displayName = 'DeriveFaceCaptureView';

export default DeriveFaceCaptureView;
