import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';

export default function RootLayout() {
  const initializeDefaultRoutine = useRoutineStore((s) => s.initializeDefaultRoutine);

  useEffect(() => {
    // Ensure default routine is ready on launch
    initializeDefaultRoutine();
  }, [initializeDefaultRoutine]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen
          name="check-in/index"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="refill/index"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="founder/index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="founder/review-routine"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="founder/refills"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
