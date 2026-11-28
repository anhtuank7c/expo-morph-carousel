import Constants from 'expo-constants';
import { configureSkiaWeb } from 'expo-morph-carousel';
import { MorphMenu, MorphProvider, morphSheetScreenOptions } from 'expo-morph-menu';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SHOP_MENU, ShopMenuIcon } from '../data/shopMenu';

// Served from a sub path (the documentation site): CanvasKit is there too.
const base = Constants.expoConfig?.experiments?.baseUrl;
if (Platform.OS === 'web' && base) configureSkiaWeb({ locateFile: (file) => `${base}/${file}` });

/** Height of the shop page's cart bar above the safe area: the menu button sits on top of it. */
const CART_BAR = 74;

export default function RootLayout() {
  // The expo-morph-menu button (product info) only shows on the shop page.
  const pathname = usePathname();
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MorphProvider items={SHOP_MENU} fabIcon={ShopMenuIcon}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShadowVisible: false, contentStyle: { backgroundColor: '#f2f2f7' } }}>
            <Stack.Screen name="index" options={{ title: 'Morph Carousel' }} />
            <Stack.Screen name="basic" options={{ title: 'Getting started' }} />
            <Stack.Screen name="product" options={{ title: 'Product' }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="playground" options={{ title: 'Playground' }} />
            <Stack.Screen name="remote" options={{ title: 'Remote images' }} />
            <Stack.Screen name="layouts" options={{ title: 'Layouts' }} />
            <Stack.Screen name="slots" options={{ title: 'Slots' }} />
            <Stack.Screen name="order" options={{ title: 'Order' }} />
            <Stack.Screen name="stress" options={{ title: 'Stress test' }} />
            <Stack.Screen name="stories" options={{ title: 'Stories' }} />
            <Stack.Screen name="feed" options={{ headerShown: false }} />
            <Stack.Screen name="flash-sale" options={{ title: 'Flash sale' }} />
            <Stack.Screen name="shop" options={{ title: '', headerTransparent: true }} />
            <Stack.Screen name="memories" options={{ headerShown: false }} />
            <Stack.Screen
              name="albums"
              options={{ title: '', headerTransparent: true, headerTintColor: '#fff' }}
            />
            <Stack.Screen name="(sheet)" options={morphSheetScreenOptions} />
          </Stack>
          <MorphMenu
            hidden={pathname !== '/shop'}
            bottomOffset={CART_BAR}
            fabAccessibilityLabel="Product info"
          />
        </MorphProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
