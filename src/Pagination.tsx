import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { clamp, ringOffset } from './math';
import type { CarouselDirection, DotSlotProps, PaginationOptions } from './types';

export type PaginationProps = PaginationOptions & {
  count: number;
  /** Continuous position in pages, from the carousel. */
  position: SharedValue<number>;
  loop?: boolean;
  direction?: CarouselDirection;
  onPress?: (index: number) => void;
  /** Replace the look of each dot; the pagination still lays them out and computes `active`. */
  Dot?: ComponentType<DotSlotProps>;
};

/**
 * Dots that follow the gesture continuously: the current dot stretches into a
 * pill, and while a page is dragged the width and color flow from one dot to
 * the next instead of jumping when the index changes.
 *
 * Exported so it can be placed anywhere, for example in a custom footer, and
 * each dot can be replaced with `Dot`.
 */
export function Pagination({
  count,
  position,
  loop = false,
  direction = 'horizontal',
  onPress,
  Dot,
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
        <DotHost
          key={i}
          index={i}
          count={count}
          position={position}
          loop={loop}
          direction={direction}
          Dot={Dot}
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

/** Computes how active one dot is and renders the slot or the built-in pill. */
function DotHost({
  index,
  count,
  position,
  loop,
  direction,
  Dot,
  onPress,
  ...look
}: {
  index: number;
  count: number;
  position: SharedValue<number>;
  loop: boolean;
  direction: CarouselDirection;
  Dot?: ComponentType<DotSlotProps>;
  onPress?: () => void;
  size: number;
  activeWidth: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const active = useDerivedValue(() => {
    const distance = loop
      ? Math.abs(ringOffset(index, position.value, count))
      : Math.abs(index - position.value);
    return 1 - clamp(distance, 0, 1);
  });
  const dot = Dot ? (
    <Dot index={index} count={count} active={active} direction={direction} onPress={onPress} />
  ) : (
    <PillDot active={active} vertical={direction === 'vertical'} {...look} />
  );
  // A custom dot gets `onPress` and decides how to be pressable itself.
  if (Dot || !onPress) return dot;
  return (
    <Pressable onPress={onPress} hitSlop={look.size} accessible={false}>
      {dot}
    </Pressable>
  );
}

function PillDot({
  active,
  vertical,
  size,
  activeWidth,
  activeColor,
  inactiveColor,
}: {
  active: SharedValue<number>;
  vertical: boolean;
  size: number;
  activeWidth: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const animated = useAnimatedStyle(() => {
    const t = active.value;
    const length = size + (activeWidth - size) * t;
    return {
      width: vertical ? size : length,
      height: vertical ? length : size,
      backgroundColor: interpolateColor(t, [0, 1], [inactiveColor, activeColor]),
    };
  });
  return <Animated.View style={[{ borderRadius: size / 2 }, animated]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  column: { flexDirection: 'column' },
});
