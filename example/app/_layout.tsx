import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShadowVisible: false, contentStyle: { backgroundColor: '#f2f2f7' } }}>
          <Stack.Screen name="index" options={{ title: 'Morph Carousel' }} />
          <Stack.Screen name="product" options={{ title: 'Product' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="playground" options={{ title: 'Playground' }} />
          <Stack.Screen name="remote" options={{ title: 'Remote images' }} />
          <Stack.Screen name="layouts" options={{ title: 'Layouts' }} />
          <Stack.Screen name="slots" options={{ title: 'Slots' }} />
          <Stack.Screen name="order" options={{ title: 'Order a drink' }} />
          <Stack.Screen name="stress" options={{ title: 'Stress test' }} />
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
