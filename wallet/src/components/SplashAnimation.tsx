// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Custom animated splash overlay.
 *
 * Two large rotated rectangles (green top-left, blue bottom-right) form the
 * icon's 135° diagonal split. The white gap shakes perpendicular to the
 * diagonal, then both shapes slide apart vertically to reveal the app.
 */

import { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    withDelay,
    runOnJS,
    Easing
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SHAPE_SIZE = Math.max(SCREEN_W, SCREEN_H) * 1.5;
const GAP = 20;

// Perpendicular distance from screen center to each shape's edge.
// Derived from the geometry: a square of side S rotated -45° has its edge
// S·√2/4 from its center. Adding GAP/2 offsets the edge from the midline.
const OFFSET = (SHAPE_SIZE + GAP) * Math.SQRT2 / 4;

// cos(45°) = sin(45°) — perpendicular direction to the diagonal
const PERP = Math.SQRT1_2;

interface Props {
    onComplete: () => void;
    onReady?: () => void;
}

export function SplashAnimation({ onComplete, onReady }: Props) {
    const shakePerp = useSharedValue(0);
    const greenSlideY = useSharedValue(0);
    const blueSlideY = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        // Shake the white gap perpendicular to the 135° diagonal
        shakePerp.value = withSequence(
            withTiming(8, { duration: 60 }),
            withTiming(-8, { duration: 60 }),
            withTiming(7, { duration: 55 }),
            withTiming(-7, { duration: 55 }),
            withTiming(4, { duration: 50 }),
            withTiming(-4, { duration: 50 }),
            withTiming(0, { duration: 40 })
        );

        // After shake (~370ms), slide apart vertically
        const slideDelay = 400;

        greenSlideY.value = withDelay(
            slideDelay,
            withTiming(-SCREEN_H, {
                duration: 500,
                easing: Easing.in(Easing.cubic)
            })
        );

        blueSlideY.value = withDelay(
            slideDelay,
            withTiming(SCREEN_H, {
                duration: 500,
                easing: Easing.in(Easing.cubic)
            })
        );

        // Fade out the entire overlay (shapes + white background)
        opacity.value = withDelay(
            slideDelay + 400,
            withTiming(0, { duration: 150 }, (finished) => {
                if (finished) {
                    runOnJS(onComplete)();
                }
            })
        );
    }, []);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    const greenStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: shakePerp.value * PERP },
            { translateY: shakePerp.value * PERP + greenSlideY.value },
            { rotate: '-45deg' }
        ]
    }));

    const blueStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: shakePerp.value * PERP },
            { translateY: shakePerp.value * PERP + blueSlideY.value },
            { rotate: '-45deg' }
        ]
    }));

    return (
        <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none" onLayout={() => onReady?.()}>
            <Animated.View style={[styles.greenShape, greenStyle]} />
            <Animated.View style={[styles.blueShape, blueStyle]} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        zIndex: 999
    },
    greenShape: {
        position: 'absolute',
        width: SHAPE_SIZE,
        height: SHAPE_SIZE,
        backgroundColor: '#34C17B',
        top: SCREEN_H / 2 - OFFSET - SHAPE_SIZE / 2,
        left: SCREEN_W / 2 - OFFSET - SHAPE_SIZE / 2,
    },
    blueShape: {
        position: 'absolute',
        width: SHAPE_SIZE,
        height: SHAPE_SIZE,
        backgroundColor: '#00AAEE',
        top: SCREEN_H / 2 + OFFSET - SHAPE_SIZE / 2,
        left: SCREEN_W / 2 + OFFSET - SHAPE_SIZE / 2,
    }
});
