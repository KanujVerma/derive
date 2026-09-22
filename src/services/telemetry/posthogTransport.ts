import PostHog, { PostHogPersistedProperty } from 'posthog-react-native';
import { sanitizeTelemetryEvent, type TelemetryEvent } from './contract.ts';

export interface TelemetrySink {
  capture(event: TelemetryEvent): void;
  reset(): void;
  optOut(): void | Promise<void>;
  optIn(): void | Promise<void>;
  isOptedOut(): boolean;
}

/** No provider is mounted: screen and touch autocapture cannot be enabled by navigation. */
export function createPostHogSink(projectKey: string, host: string): TelemetrySink {
  const client = new PostHog(projectKey, {
    host,
    defaultOptIn: false,
    captureAppLifecycleEvents: false,
    enableSessionReplay: false,
    errorTracking: { autocapture: false, exceptionSteps: { enabled: false } },
    capturePushNotificationSubscriptions: false,
    capturePushNotificationOpened: false,
    sendFeatureFlagEvent: false,
    preloadFeatureFlags: false,
    disableRemoteFeatureFlags: true,
    setDefaultPersonProperties: false,
    disableGeoip: true,
    flushAt: 10,
    flushInterval: 10_000,
    maxBatchSize: 20,
    maxQueueSize: 100,
    // SDK metadata, extra caller properties, and any unexpected auto-event are dropped here.
    before_send: (sdkEvent) => {
      if (!sdkEvent) return null;
      const safe = sanitizeTelemetryEvent(sdkEvent.event, sdkEvent.properties);
      return safe ? { event: safe.event, properties: safe.properties } : null;
    },
  });

  // PostHog reset() intentionally preserves its offline queue. That is not suitable
  // for a shared device after sign-out or a customer's opt-out decision.
  const discardQueuedEvents = (): void => {
    client.setPersistedProperty(PostHogPersistedProperty.Queue, []);
    client.setPersistedProperty(PostHogPersistedProperty.AiQueue, []);
    client.setPersistedProperty(PostHogPersistedProperty.AiCaptureQueue, []);
    client.setPersistedProperty(PostHogPersistedProperty.LogsQueue, []);
  };

  return {
    capture: ({ event, properties }) => { void client.capture(event, properties); },
    reset: () => { discardQueuedEvents(); client.reset(); },
    optOut: () => { discardQueuedEvents(); return client.optOut(); },
    optIn: () => client.optIn(),
    isOptedOut: () => client.optedOut,
  };
}
