import { useWindowDimensions, type ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * The widest the content of a screen gets. On tablets and unfolded phones
 * the screens are a centered column instead of lines that run across the
 * whole display; full-screen demos (stories, feed, memories) still fill it.
 */
export const MAX_CONTENT_WIDTH = 600;

/** For a ScrollView's contentContainerStyle (or any container): a centered column. */
export const column: ViewStyle = { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' };

/** Width of that column on this screen. */
export function useContentWidth() {
  return Math.min(useWindowDimensions().width, MAX_CONTENT_WIDTH);
}

/**
 * Left and right padding for an overlay that spans the screen (a top bar, a
 * caption, a bottom bar): the safe area plus some room. The side insets are 0
 * on a phone in portrait, but in landscape they keep clear of the notch, and
 * on the iPhone Duo (folded or not) of the status bar in the top right corner.
 */
export function sides(insets: EdgeInsets, padding = 0): ViewStyle {
  return { paddingLeft: insets.left + padding, paddingRight: insets.right + padding };
}
