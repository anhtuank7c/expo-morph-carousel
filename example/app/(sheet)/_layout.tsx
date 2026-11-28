import { MorphSheetLayout } from 'expo-morph-menu';
import { Stack } from 'expo-router';

/** The shop's info screens grow out of the expo-morph-menu card and shrink back into it. */
export default function SheetLayout() {
  return (
    <MorphSheetLayout>
      <Stack.Screen name="[key]" options={{ headerShown: false }} />
    </MorphSheetLayout>
  );
}
