// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Custom animated splash overlay.
 *
 * Two stretched polygon shapes (green top-left, blue bottom-right) start
 * at the white diagonal divider, shake briefly, then slide apart vertically
 * to reveal the app beneath.
 */

import { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    withDelay,
    withSpring,
    runOnJS,
    Easing
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// How far the shapes slide off-screen
const SLIDE_DISTANCE = SCREEN_H * 0.7;

interface Props {
    onComplete: () => void;
}

export function SplashAnimation({ onComplete }: Props) {
    const shakeX = useSharedValue(0);
    const greenY = useSharedValue(0);
    const blueY = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        // Shake sequence: small quick oscillations
        shakeX.value = withSequence(
            withTiming(6, { duration: 60 }),
            withTiming(-6, { duration: 60 }),
            withTiming(5, { duration: 55 }),
            withTiming(-5, { duration: 55 }),
            withTiming(3, { duration: 50 }),
            withTiming(-3, { duration: 50 }),
            withTiming(0, { duration: 40 })
        );

        // After shake (~370ms), slide apart
        const slideDelay = 400;

        greenY.value = withDelay(
            slideDelay,
            withTiming(-SLIDE_DISTANCE, {
                duration: 500,
                easing: Easing.in(Easing.cubic)
            })
        );

        blueY.value = withDelay(
            slideDelay,
            withTiming(SLIDE_DISTANCE, {
                duration: 500,
                easing: Easing.in(Easing.cubic)
            })
        );

        // Fade out slightly before slide completes, then signal done
        opacity.value = withDelay(
            slideDelay + 400,
            withTiming(0, { duration: 150 }, (finished) => {
                if (finished) {
                    runOnJS(onComplete)();
                }
            })
        );
    }, []);

    const greenStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: shakeX.value },
            { translateY: greenY.value }
        ],
        opacity: opacity.value
    }));

    const blueStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: shakeX.value },
            { translateY: blueY.value }
        ],
        opacity: opacity.value
    }));

    return (
        <Animated.View style={styles.overlay} pointerEvents="none">
            {/* Green shape — top-left, slides up */}
            <Animated.View style={[styles.greenShape, greenStyle]} />
            {/* Blue shape — bottom-right, slides down */}
            <Animated.View style={[styles.blueShape, blueStyle]} />
        </Animated.View>
    );
}

/**
 * The shapes are positioned to recreate the icon's diagonal split.
 * Each shape is a tall rectangle rotated 45° and offset so the white
 * diagonal gap between them sits in the centre of the screen.
 *
 * The diagonal goes from top-right to bottom-left (same as the icon).
 */

const SHAPE_SIZE = Math.max(SCREEN_W, SCREEN_H) * 1.5;
const GAP = 20; // white gap between shapes (half each side)

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF',
        zIndex: 999
    },
    greenShape: {
        position: 'absolute',
        width: SHAPE_SIZE,
        height: SHAPE_SIZE,
        backgroundColor: '#34C17B',
        // Rotate and position so bottom-right edge sits at screen centre
        transform: [{ rotate: '-45deg' }],
        top: -SHAPE_SIZE / 2 - GAP / 2,
        left: -SHAPE_SIZE / 2 + SCREEN_W / 2 - SCREEN_H * 0.05
    },
    blueShape: {
        position: 'absolute',
        width: SHAPE_SIZE,
        height: SHAPE_SIZE,
        backgroundColor: '#00AAEE',
        transform: [{ rotate: '-45deg' }],
        top: SCREEN_H / 2 + GAP / 2 - SHAPE_SIZE / 2 + SCREEN_H * 0.05,
        left: SCREEN_W / 2 - SHAPE_SIZE / 2 + SCREEN_H * 0.05
    }
});
