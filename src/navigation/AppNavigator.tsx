import React, {useEffect, useMemo} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import CalendarScreen from '../features/calendar/CalendarScreen';
import StreaksScreen from '../features/streaks/StreaksScreen';
import ActivitiesScreen from '../features/activities/ActivitiesScreen';
import SettingsScreen from '../features/activities/SettingsScreen';
import LogActivityScreen from '../features/activities/LogActivityScreen';
import ScheduleActivityScreen from '../features/calendar/ScheduleActivityScreen';
import ActivityDetailScreen from '../features/activities/ActivityDetailScreen';
import ReceiveShareScreen from '../features/sharing/ReceiveShareScreen';
import StreakDetailScreen from '../features/streaks/StreakDetailScreen';
import SignUpScreen from '../features/auth/SignUpScreen';
import LoginScreen from '../features/auth/LoginScreen';
import JournalScreen from '../features/journal/JournalScreen';
import PageEditorScreen from '../features/journal/PageEditorScreen';
import PageListScreen from '../features/journal/PageListScreen';

import {useAuthStore} from '../stores/authStore';
import {useTheme} from '../theme';
import type {Theme} from '../theme/types';

export type AuthStackParamList = {
  SignUp: undefined;
  Login: undefined;
};

export type RootTabParamList = {
  HomeTab: undefined;
  StreaksTab: undefined;
  ActivitiesTab: undefined;
  JournalTab: undefined;
  SettingsTab: undefined;
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

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const StreaksStack = createNativeStackNavigator<StreaksStackParamList>();
const ActivitiesStack = createNativeStackNavigator<ActivitiesStackParamList>();
const JournalStack = createNativeStackNavigator<JournalStackParamList>();

const TAB_ICONS: Record<string, {active: string; inactive: string}> = {
  Home: {active: '\u{1F3E0}', inactive: '\u{1F3E0}'},
  Streaks: {active: '\u{1F525}', inactive: '\u{1F525}'},
  Activities: {active: '\u{2705}', inactive: '\u{2705}'},
  Journal: {active: '\u{1F4D3}', inactive: '\u{1F4D3}'},
  Settings: {active: '\u{2699}\u{FE0F}', inactive: '\u{2699}\u{FE0F}'},
};

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

function TabIcon({label, focused}: {label: string; focused: boolean}) {
  const theme = useTheme();
  const tabStyles = useTabStyles(theme);
  const icons = TAB_ICONS[label];
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>
        {focused ? icons?.active : icons?.inactive}
      </Text>
      {focused && <View style={tabStyles.activeDot} />}
    </View>
  );
}

function HomeStackNavigator() {
  const theme = useTheme();
  return (
    <HomeStack.Navigator screenOptions={{headerShown: false}}>
      <HomeStack.Screen name="Calendar" component={CalendarScreen} />
      <HomeStack.Screen
        name="LogActivity"
        component={LogActivityScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Log Activity',
          headerTintColor: theme.colors.primary,
          headerStyle: {backgroundColor: theme.colors.bgLight},
          headerTitleStyle: {color: theme.colors.text, fontWeight: '600'},
        }}
      />
      <HomeStack.Screen
        name="ScheduleActivity"
        component={ScheduleActivityScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Schedule Activity',
          headerTintColor: theme.colors.primary,
          headerStyle: {backgroundColor: theme.colors.bgLight},
          headerTitleStyle: {color: theme.colors.text, fontWeight: '600'},
        }}
      />
      <HomeStack.Screen
        name="ReceiveShare"
        component={ReceiveShareScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          headerTitle: 'Shared Activity',
          headerTintColor: theme.colors.primary,
          headerStyle: {backgroundColor: theme.colors.bgLight},
          headerTitleStyle: {color: theme.colors.text, fontWeight: '600'},
        }}
      />
    </HomeStack.Navigator>
  );
}

function StreaksStackNavigator() {
  const theme = useTheme();
  return (
    <StreaksStack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.primary,
        headerStyle: {backgroundColor: theme.colors.bgLight},
        headerTitleStyle: {color: theme.colors.text, fontWeight: '600'},
      }}>
      <StreaksStack.Screen
        name="StreaksList"
        component={StreaksScreen}
        options={{headerShown: false}}
      />
      <StreaksStack.Screen
        name="StreakDetail"
        component={StreakDetailScreen}
        options={{headerTitle: 'Streak Detail'}}
      />
    </StreaksStack.Navigator>
  );
}

function ActivitiesStackNavigator() {
  const theme = useTheme();
  return (
    <ActivitiesStack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.primary,
        headerStyle: {backgroundColor: theme.colors.bgLight},
        headerTitleStyle: {color: theme.colors.text, fontWeight: '600'},
      }}>
      <ActivitiesStack.Screen
        name="ActivitiesList"
        component={ActivitiesScreen}
        options={{headerTitle: 'My Activities'}}
      />
      <ActivitiesStack.Screen
        name="ActivityDetail"
        component={ActivityDetailScreen}
        options={{headerTitle: 'Activity'}}
      />
    </ActivitiesStack.Navigator>
  );
}

function JournalStackNavigator() {
  const theme = useTheme();
  return (
    <JournalStack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.primary,
        headerStyle: {backgroundColor: theme.colors.bgLight},
        headerTitleStyle: {color: theme.colors.text, fontWeight: '600'},
      }}>
      <JournalStack.Screen
        name="Journal"
        component={JournalScreen}
        options={{headerShown: false}}
      />
      <JournalStack.Screen
        name="PageEditor"
        component={PageEditorScreen}
        options={{headerTitle: 'Page'}}
      />
      <JournalStack.Screen
        name="PageList"
        component={PageListScreen}
        options={{headerTitle: 'All Pages'}}
      />
    </JournalStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{headerShown: false}}>
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  const theme = useTheme();
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
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused}) => (
            <TabIcon label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="StreaksTab"
        component={StreaksStackNavigator}
        options={{
          tabBarLabel: 'Streaks',
          tabBarIcon: ({focused}) => (
            <TabIcon label="Streaks" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ActivitiesTab"
        component={ActivitiesStackNavigator}
        options={{
          tabBarLabel: 'Activities',
          tabBarIcon: ({focused}) => (
            <TabIcon label="Activities" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="JournalTab"
        component={JournalStackNavigator}
        options={{
          tabBarLabel: 'Journal',
          tabBarIcon: ({focused}) => (
            <TabIcon label="Journal" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({focused}) => (
            <TabIcon label="Settings" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

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
