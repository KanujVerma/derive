import React, { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import type { DeriveFaceCaptureViewProps, DeriveFaceCaptureViewRef } from './DeriveFaceCaptureView';

export function isDeriveFaceCaptureSupported(): boolean {
  return false;
}

const DeriveFaceCaptureView = forwardRef<DeriveFaceCaptureViewRef, DeriveFaceCaptureViewProps>(
  (props, ref) => {
    useImperativeHandle(ref, () => ({
      takePhoto: async () => {
        throw new Error('DeriveFaceCapture is not supported on web');
      },
    }));

    return <View {...props} />;
  }
);

DeriveFaceCaptureView.displayName = 'DeriveFaceCaptureView';

export default DeriveFaceCaptureView;
