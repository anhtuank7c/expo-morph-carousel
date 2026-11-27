import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { clamp, ringOffset } from './math';
import type { CarouselDirection, PaginationOptions } from './types';

export type PaginationProps = PaginationOptions & {
  count: number;
  /** Continuous position in pages, from the carousel. */
  position: SharedValue<number>;
  loop?: boolean;
  direction?: CarouselDirection;
  onPress?: (index: number) => void;
};

/**
 * Dots that follow the gesture continuously: the current dot stretches into a
 * pill, and while a page is dragged the width and color flow from one dot to
 * the next instead of jumping when the index changes.
 *
 * Exported so it can be placed anywhere, for example in a custom footer.
 */
export function Pagination({
  count,
  position,
  loop = false,
  direction = 'horizontal',
  onPress,
  activeColor = '#1c1c1e',
  inactiveColor = '#c7c7cc',
  size = 8,
  activeWidth = 22,
  gap = 6,
  pressable = true,
  style,
}: PaginationProps) {
  if (count <= 1) return null;
  const vertical = direction === 'vertical';
  return (
    <View
      style={[styles.row, vertical && styles.column, { gap }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot
          key={i}
          index={i}
          count={count}
          position={position}
          loop={loop}
          vertical={vertical}
          size={size}
          activeWidth={activeWidth}
          activeColor={activeColor}
          inactiveColor={inactiveColor}
          onPress={pressable && onPress ? () => onPress(i) : undefined}
        />
      ))}
    </View>
  );
}

function Dot({
  index,
  count,
  position,
  loop,
  vertical,
  size,
  activeWidth,
  activeColor,
  inactiveColor,
  onPress,
}: {
  index: number;
  count: number;
  position: SharedValue<number>;
  loop: boolean;
  vertical: boolean;
  size: number;
  activeWidth: number;
  activeColor: string;
  inactiveColor: string;
  onPress?: () => void;
}) {
  const animated = useAnimatedStyle(() => {
    const distance = loop
      ? Math.abs(ringOffset(index, position.value, count))
      : Math.abs(index - position.value);
    const t = 1 - clamp(distance, 0, 1);
    const length = size + (activeWidth - size) * t;
    return {
      width: vertical ? size : length,
      height: vertical ? length : size,
      backgroundColor: interpolateColor(t, [0, 1], [inactiveColor, activeColor]),
    };
  });

  const dot = <Animated.View style={[{ borderRadius: size / 2 }, animated]} />;
  if (!onPress) return dot;
  return (
    <Pressable onPress={onPress} hitSlop={size} accessible={false}>
      {dot}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  column: { flexDirection: 'column' },
});
