import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useAuthStore} from '../../stores/authStore';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme';
import type {AuthStackParamList} from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
        scrollContent: {
          flexGrow: 1,
          padding: spacing.xxl,
          justifyContent: 'center',
        },
        header: {
          alignItems: 'center',
          marginBottom: 40,
        },
        appName: {
          fontSize: 52,
          fontWeight: '800',
          color: theme.colors.primary,
          letterSpacing: -2,
        },
        tagline: {
          fontSize: 16,
          color: theme.colors.textSecondary,
          marginTop: spacing.sm,
          textAlign: 'center',
          lineHeight: 22,
        },
        form: {
          backgroundColor: theme.colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          padding: spacing.xxl,
        },
        title: {
          fontSize: 26,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: spacing.xs,
        },
        subtitle: {
          fontSize: 14,
          color: theme.colors.textSecondary,
          marginBottom: spacing.xl,
          lineHeight: 20,
        },
        label: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.textSecondary,
          marginBottom: spacing.xs,
          marginTop: spacing.lg,
        },
        input: {
          backgroundColor: theme.colors.bgLight,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          fontSize: 16,
          color: theme.colors.text,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
        },
        errorContainer: {
          backgroundColor: theme.colors.dangerPale,
          borderRadius: radius.sm,
          padding: spacing.md,
          marginTop: spacing.md,
        },
        errorText: {
          color: theme.colors.danger,
          fontSize: 14,
          fontWeight: '500',
        },
        button: {
          backgroundColor: theme.colors.primary,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: spacing.xxl,
          ...theme.shadows.glow,
        },
        buttonDisabled: {
          opacity: 0.5,
          shadowOpacity: 0,
        },
        buttonText: {
          color: theme.colors.textOnPrimary,
          fontSize: 17,
          fontWeight: '700',
        },
        switchLink: {
          alignItems: 'center',
          paddingVertical: spacing.xl,
        },
        switchText: {
          fontSize: 15,
          color: theme.colors.textSecondary,
        },
        switchTextBold: {
          color: theme.colors.accent,
          fontWeight: '700',
        },
      }),
    [theme],
  );

export default function SignUpScreen() {
  const theme = useTheme();
  const styles = useStyles(theme);
  const navigation = useNavigation<Nav>();
  const signup = useAuthStore(s => s.signup);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSignUp = useCallback(async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const result = await signup(phone, name);
      if (!result.success) {
        setError(result.error || 'Sign up failed');
      }
    } catch (e) {
      setError('Something went wrong');
      console.error('Signup error:', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, name, signup]);

  const isValid = name.trim().length > 0 && phone.trim().length > 0;

  return (
    <ScreenWrapper keyboard>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.header,
            {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
          ]}>
          <Text style={styles.appName}>{`LFG \u{1F680}`}</Text>
          <Text style={styles.tagline}>
            Your habits, your way.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.form,
            {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
          ]}>
          <Text style={styles.title}>Get Started</Text>

          <Text style={styles.label}>What should we call you?</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9876543210"
            placeholderTextColor={theme.colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="done"
          />

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              (!isValid || isSubmitting) && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.8}>
            <Text style={styles.buttonText}>
              {isSubmitting ? 'Setting up...' : "Let's Go!"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={styles.switchLink}
          onPress={() => navigation.navigate('Login')}>
          <Text style={styles.switchText}>
            Already tracking habits?{' '}
            <Text style={styles.switchTextBold}>Welcome back</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}
