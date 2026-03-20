/**
 * App Navigator.
 *
 * Builds the bottom tab bar dynamically from the plugin registry.
 * Each enabled plugin with a tabRegistration contributes a tab.
 * Tabs are ordered by the plugin's tabRegistration.order field.
 *
 * Auth screens are handled separately (not part of the plugin tab system).
 */

import React, {useEffect, useMemo} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {registry} from '../plugins';
import type {PluginManifest, StackScreen} from '../plugins/types';

import SignUpScreen from '../features/auth/SignUpScreen';
import LoginScreen from '../features/auth/LoginScreen';

import {useAuthStore} from '../stores/authStore';
import {useTheme} from '../theme';
import type {Theme} from '../theme/types';

// ── Type Exports (kept for backward-compat with screens) ────────────

export type AuthStackParamList = {
  SignUp: undefined;
  Login: undefined;
};

export type HomeStackParamList = {
  Calendar: undefined;
  LogActivity: {date?: string} | undefined;
  ScheduleActivity: {activityId?: string; date?: string} | undefined;
  ReceiveShare: {name: string; rrule: string; time: string; duration: number};
};

export type StreaksStackParamList = {
  StreaksList: undefined;
  StreakDetail: {activityId: string};
};

export type ActivitiesStackParamList = {
  ActivitiesList: undefined;
  ActivityDetail: {activityId: string};
};

export type JournalStackParamList = {
  Journal: undefined;
  PageEditor: {title: string; pageType?: 'daily' | 'page'};
  PageList: undefined;
};

// ── Dynamic Tab Types ───────────────────────────────────────────────

// RootTabParamList is built dynamically based on enabled plugins.
// We use a generic Record for the tab navigator type.
export type RootTabParamList = Record<string, undefined>;

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

// ── Tab Icon ────────────────────────────────────────────────────────

function useTabStyles(theme: Theme) {
  return useMemo(
    () =>
      StyleSheet.create({
        iconContainer: {
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
        },
        icon: {
          fontSize: 20,
          opacity: 0.5,
        },
        iconActive: {
          opacity: 1,
        },
        activeDot: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.primary,
          marginTop: 2,
        },
      }),
    [theme],
  );
}

function TabIcon({
  icon,
  focused,
}: {
  icon: {active: string; inactive: string};
  focused: boolean;
}) {
  const theme = useTheme();
  const tabStyles = useTabStyles(theme);
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>
        {focused ? icon.active : icon.inactive}
      </Text>
      {focused && <View style={tabStyles.activeDot} />}
    </View>
  );
}

// ── Dynamic Stack Navigator Builder ─────────────────────────────────

/**
 * Creates a stack navigator component for a plugin's tab.
 * Each plugin declares its screens in tabRegistration.stack.
 */
function createPluginStackNavigator(plugin: PluginManifest) {
  const Stack = createNativeStackNavigator();

  return function PluginStack() {
    const theme = useTheme();
    return (
      <Stack.Navigator
        screenOptions={{
          headerTintColor: theme.colors.primary,
          headerStyle: {backgroundColor: theme.colors.bgLight},
          headerTitleStyle: {color: theme.colors.text, fontWeight: '600'},
        }}>
        {plugin.tabRegistration!.stack.map((screen: StackScreen) => (
          <Stack.Screen
            key={screen.name}
            name={screen.name}
            component={screen.component}
            options={screen.options}
          />
        ))}
      </Stack.Navigator>
    );
  };
}

// ── Auth Navigator ──────────────────────────────────────────────────

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{headerShown: false}}>
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// ── Main Navigator (dynamic tabs from registry) ─────────────────────

function MainNavigator() {
  const theme = useTheme();

  // Get enabled plugins with tab registrations, sorted by order
  const tabPlugins = useMemo(() => registry.getTabPlugins(), []);

  // Build stack navigator components for each tab plugin (memoized)
  const stackNavigators = useMemo(() => {
    const navMap = new Map<string, React.ComponentType<any>>();
    for (const plugin of tabPlugins) {
      // For plugins with a single screen, use the component directly
      if (plugin.tabRegistration!.stack.length === 1) {
        navMap.set(plugin.id, plugin.tabRegistration!.stack[0].component);
      } else {
        navMap.set(plugin.id, createPluginStackNavigator(plugin));
      }
    }
    return navMap;
  }, [tabPlugins]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          height: 88,
          ...theme.shadows.sm,
        },
      }}>
      {tabPlugins.map(plugin => {
        const tab = plugin.tabRegistration!;
        const tabName = `${tab.label}Tab`;
        const StackNav = stackNavigators.get(plugin.id)!;
        const iconConfig = tab.icon;

        return (
          <Tab.Screen
            key={plugin.id}
            name={tabName}
            component={StackNav}
            options={{
              tabBarLabel: tab.label,
              tabBarIcon: ({focused}) => (
                <TabIcon icon={iconConfig} focused={focused} />
              ),
            }}
          />
        );
      })}
    </Tab.Navigator>
  );
}

// ── Loading Screen ──────────────────────────────────────────────────

function useLoadingStyles(theme: Theme) {
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        },
        logo: {
          fontSize: 48,
          fontWeight: '800',
          color: theme.colors.primary,
          letterSpacing: -1,
          marginBottom: 24,
        },
        tagline: {
          fontSize: 14,
          color: theme.colors.textMuted,
          marginTop: 16,
        },
      }),
    [theme],
  );
}

// ── Root Navigator ──────────────────────────────────────────────────

export default function AppNavigator() {
  const theme = useTheme();
  const loadingStyles = useLoadingStyles(theme);
  const {isAuthenticated, isLoading, hydrate} = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <Text style={loadingStyles.logo}>{`LFG \u{1F680}`}</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={loadingStyles.tagline}>Getting things ready...</Text>
      </View>
    );
  }

  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
}
