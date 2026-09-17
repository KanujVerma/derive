/**
 * AutoCaptureStateMachine.ts
 *
 * Deterministic client-side state machine for hands-free baseline face capture.
 * Evaluates real-time pose (yaw, pitch, roll), centering, framing distance,
 * and Apple Vision face capture quality before triggering capture.
 *
 * Invariants:
 * - Pure TypeScript / deterministic logic: zero native dependency for tests.
 * - Minimum continuous hold duration (default 750ms) to ensure blur-free stability.
 * - Fail closed: any criterion failure immediately resets the hold timer.
 */

export type CaptureAngle = 'front' | 'left' | 'right';

export type QualityFeedback =
  | 'no_face'
  | 'center_face'
  | 'turn_left'
  | 'turn_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'too_far'
  | 'too_close'
  | 'hold_steady'
  | 'ready';

export type AutoCaptureState =
  | 'IDLE'
  | 'NOT_READY'
  | 'READY_CANDIDATE'
  | 'HOLDING'
  | 'AUTO_CAPTURE'
  | 'REVIEW';

export interface FrameQualityMetrics {
  hasFace: boolean;
  yaw?: number; // degrees: negative = turned left, positive = turned right
  pitch?: number; // degrees: negative = down, positive = up
  roll?: number; // degrees: head tilt
  centerX?: number; // normalized 0..1
  centerY?: number; // normalized 0..1
  faceWidthRatio?: number; // face width / frame width (0..1)
  captureQuality?: number; // 0..1 from Apple Vision faceCaptureQuality
}

export interface StateMachineOutput {
  state: AutoCaptureState;
  feedback: QualityFeedback;
  feedbackMessage: string;
  isReady: boolean;
  holdProgress: number; // 0.0 to 1.0
  shouldTriggerCapture: boolean;
}

export interface AutoCaptureConfig {
  targetAngle: CaptureAngle;
  requiredHoldDurationMs?: number;
  minQuality?: number;
}

const DEFAULT_HOLD_MS = 750;
const DEFAULT_MIN_QUALITY = 0.35;

/**
 * Evaluates whether a frame meets criteria for the target capture angle.
 */
export function evaluateFrameCriteria(
  metrics: FrameQualityMetrics,
  targetAngle: CaptureAngle,
  minQuality = DEFAULT_MIN_QUALITY
): { passes: boolean; feedback: QualityFeedback; message: string } {
  if (!metrics.hasFace) {
    return {
      passes: false,
      feedback: 'no_face',
      message: 'Position your face in the oval guide',
    };
  }

  // Distance / size check
  const size = metrics.faceWidthRatio ?? 0.5;
  if (size < 0.28) {
    return {
      passes: false,
      feedback: 'too_far',
      message: 'Move closer to the camera',
    };
  }
  if (size > 0.72) {
    return {
      passes: false,
      feedback: 'too_close',
      message: 'Move slightly further back',
    };
  }

  // Centering check (normalized coordinates: 0.5 is centered)
  const cx = metrics.centerX ?? 0.5;
  const cy = metrics.centerY ?? 0.5;
  if (cx < 0.32 || cx > 0.68 || cy < 0.25 || cy > 0.75) {
    return {
      passes: false,
      feedback: 'center_face',
      message: 'Center your face within the frame',
    };
  }

  // Tilt / Roll check (keep head level)
  const roll = Math.abs(metrics.roll ?? 0);
  if (roll > 14) {
    return {
      passes: false,
      feedback: 'center_face',
      message: 'Keep your head upright and level',
    };
  }

  // Pitch check (looking straight ahead, not tilted up/down)
  const pitch = metrics.pitch ?? 0;
  if (pitch > 16) {
    return {
      passes: false,
      feedback: 'tilt_down',
      message: 'Lower your chin slightly',
    };
  }
  if (pitch < -16) {
    return {
      passes: false,
      feedback: 'tilt_up',
      message: 'Raise your chin slightly',
    };
  }

  // Yaw check based on target angle
  const yaw = metrics.yaw ?? 0;
  if (targetAngle === 'front') {
    if (Math.abs(yaw) > 15) {
      return {
        passes: false,
        feedback: yaw > 0 ? 'turn_left' : 'turn_right',
        message: 'Look directly at the camera',
      };
    }
  } else if (targetAngle === 'left') {
    // User turning left means yaw is negative (or positive depending on convention)
    // We expect ~25 to 55 degrees rotation to the user's left
    if (yaw > -20) {
      return {
        passes: false,
        feedback: 'turn_left',
        message: 'Turn your head slightly to your left',
      };
    }
    if (yaw < -65) {
      return {
        passes: false,
        feedback: 'turn_right',
        message: 'Turn back slightly toward center',
      };
    }
  } else if (targetAngle === 'right') {
    // Rotation to user's right
    if (yaw < 20) {
      return {
        passes: false,
        feedback: 'turn_right',
        message: 'Turn your head slightly to your right',
      };
    }
    if (yaw > 65) {
      return {
        passes: false,
        feedback: 'turn_left',
        message: 'Turn back slightly toward center',
      };
    }
  }

  // Apple Vision capture quality metric if present
  if (metrics.captureQuality !== undefined && metrics.captureQuality < minQuality) {
    return {
      passes: false,
      feedback: 'hold_steady',
      message: 'Hold steady in even lighting',
    };
  }

  return {
    passes: true,
    feedback: 'ready',
    message: 'Hold steady...',
  };
}

/**
 * State machine class to track continuous holding duration and state transitions.
 */
export class AutoCaptureStateMachine {
  private config: AutoCaptureConfig;
  private state: AutoCaptureState = 'IDLE';
  private holdStartTime: number | null = null;

  constructor(config: AutoCaptureConfig) {
    this.config = {
      requiredHoldDurationMs: DEFAULT_HOLD_MS,
      minQuality: DEFAULT_MIN_QUALITY,
      ...config,
    };
  }

  public setTargetAngle(angle: CaptureAngle): void {
    this.config.targetAngle = angle;
    this.reset();
  }

  public reset(): void {
    this.state = 'IDLE';
    this.holdStartTime = null;
  }

  public markCaptured(): void {
    this.state = 'REVIEW';
    this.holdStartTime = null;
  }

  /**
   * Processes an incoming frame metrics update at a given timestamp.
   * Timestamp parameter allows fully deterministic unit testing.
   */
  public update(
    metrics: FrameQualityMetrics,
    now: number = Date.now()
  ): StateMachineOutput {
    if (this.state === 'REVIEW') {
      return {
        state: 'REVIEW',
        feedback: 'ready',
        feedbackMessage: 'Review your capture',
        isReady: false,
        holdProgress: 1.0,
        shouldTriggerCapture: false,
      };
    }

    const evaluation = evaluateFrameCriteria(
      metrics,
      this.config.targetAngle,
      this.config.minQuality
    );

    const holdDurationMs = this.config.requiredHoldDurationMs ?? DEFAULT_HOLD_MS;

    if (!evaluation.passes) {
      this.state = 'NOT_READY';
      this.holdStartTime = null;
      return {
        state: 'NOT_READY',
        feedback: evaluation.feedback,
        feedbackMessage: evaluation.message,
        isReady: false,
        holdProgress: 0,
        shouldTriggerCapture: false,
      };
    }

    // Criteria passed!
    if (this.holdStartTime === null) {
      this.holdStartTime = now;
      this.state = 'READY_CANDIDATE';
      return {
        state: 'READY_CANDIDATE',
        feedback: 'hold_steady',
        feedbackMessage: 'Hold steady...',
        isReady: true,
        holdProgress: 0,
        shouldTriggerCapture: false,
      };
    }

    const elapsed = now - this.holdStartTime;
    const progress = Math.min(1.0, elapsed / holdDurationMs);

    if (elapsed >= holdDurationMs) {
      this.state = 'AUTO_CAPTURE';
      return {
        state: 'AUTO_CAPTURE',
        feedback: 'ready',
        feedbackMessage: 'Capturing...',
        isReady: true,
        holdProgress: 1.0,
        shouldTriggerCapture: true,
      };
    }

    this.state = 'HOLDING';
    return {
      state: 'HOLDING',
      feedback: 'hold_steady',
      feedbackMessage: 'Hold steady...',
      isReady: true,
      holdProgress: progress,
      shouldTriggerCapture: false,
    };
  }

  public getState(): AutoCaptureState {
    return this.state;
  }
}
