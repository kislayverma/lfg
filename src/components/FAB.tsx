import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Modal,
  Pressable,
} from 'react-native';
import {useTheme, spacing, radius} from '../theme';
import type {Theme} from '../theme';

interface FABProps {
  onLogActivity: () => void;
  onScheduleActivity: () => void;
}

export default function FAB({onLogActivity, onScheduleActivity}: FABProps) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0.6)).current;

  // Breathing pulse animation for the glow ring
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulseAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [glowPulseAnim]);

  useEffect(() => {
    if (menuVisible) {
      Animated.parallel([
        Animated.spring(rotateAnim, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(menuScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(rotateAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(menuScale, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [menuVisible, rotateAnim, menuScale, menuOpacity]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <View style={styles.fabContainer}>
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: glowPulseAnim,
            },
          ]}
        />
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setMenuVisible(true)}
          activeOpacity={0.85}>
          <Animated.Text style={[styles.fabIcon, {transform: [{rotate: spin}]}]}>
            +
          </Animated.Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={styles.overlay}
          onPress={() => setMenuVisible(false)}>
          <Animated.View
            style={[
              styles.menu,
              {
                opacity: menuOpacity,
                transform: [{scale: menuScale}],
              },
            ]}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setMenuVisible(false);
                onLogActivity();
              }}>
              <View style={[styles.menuIconCircle, {backgroundColor: theme.colors.primaryPale}]}>
                <Text style={styles.menuIconText}>{'\u{270F}\u{FE0F}'}</Text>
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuLabel}>Log Activity</Text>
                <Text style={styles.menuHint}>Record what you did</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setMenuVisible(false);
                onScheduleActivity();
              }}>
              <View style={[styles.menuIconCircle, {backgroundColor: theme.colors.accentPale}]}>
                <Text style={styles.menuIconText}>{'\u{1F4C5}'}</Text>
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuLabel}>Schedule Activity</Text>
                <Text style={styles.menuHint}>Plan a recurring habit</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fabContainer: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 60,
      height: 60,
      zIndex: 100,
    },
    glowRing: {
      position: 'absolute',
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: theme.colors.primaryGlow,
      top: -8,
      left: -8,
    },
    fab: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadows.glow,
    },
    fabIcon: {
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '400',
      marginTop: -2,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      padding: spacing.xxl,
      paddingBottom: 100,
    },
    menu: {
      backgroundColor: theme.colors.elevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      paddingVertical: spacing.sm,
      minWidth: 240,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: 56,
    },
    menuIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    menuIconText: {
      fontSize: 16,
    },
    menuTextContainer: {
      flex: 1,
    },
    menuLabel: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '600',
    },
    menuHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
  });
