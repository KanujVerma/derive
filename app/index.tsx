import { Redirect } from 'expo-router';
import { useOnboardingStore } from '@/src/stores/onboardingStore';

export default function Index() {
  const isCompleted = useOnboardingStore((s) => s.isCompleted);

  // If already onboarded, go to Today; otherwise start onboarding
  if (isCompleted) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(onboarding)/1-welcome" />;
}
