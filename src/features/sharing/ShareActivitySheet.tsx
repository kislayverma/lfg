import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import Contacts from 'react-native-contacts';
import type {Contact} from 'react-native-contacts';
import RNShare from 'react-native-share';
import QRCode from 'react-native-qrcode-svg';

import {buildShareLink, buildShareMessage} from '../../services/deepLink';
import type {SharePayload} from '../../services/deepLink';
import {useTheme, spacing, radius} from '../../theme';
import type {Theme} from '../../theme';

interface ShareActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  payload: SharePayload;
}

export default function ShareActivitySheet({
  visible,
  onClose,
  payload,
}: ShareActivitySheetProps) {
  const theme = useTheme();
  const styles = useStyles(theme);

  const [searchText, setSearchText] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const deepLink = useMemo(() => buildShareLink(payload), [payload]);

  const loadContacts = useCallback(async (query: string) => {
    try {
      const permission = await Contacts.requestPermission();
      setHasPermission(permission === 'authorized');

      if (permission !== 'authorized') {
        return;
      }

      if (query.trim().length === 0) {
        setContacts([]);
        return;
      }

      const results = await Contacts.getContactsMatchingString(query);
      setContacts(results.slice(0, 20));
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      loadContacts(text);
    },
    [loadContacts],
  );

  const handleShareViaContact = useCallback(
    async (contact: Contact) => {
      const message = buildShareMessage(payload);
      const phoneNumber = contact.phoneNumbers?.[0]?.number;

      try {
        await RNShare.open({
          message,
          ...(phoneNumber
            ? {
                recipient: phoneNumber,
                social: RNShare.Social.SMS as any,
              }
            : {}),
        });
      } catch (error: any) {
        // User cancelled share — not an error
        if (error?.message !== 'User did not share') {
          console.error('Share error:', error);
        }
      }
    },
    [payload],
  );

  const handleShareGeneric = useCallback(async () => {
    const message = buildShareMessage(payload);
    try {
      await RNShare.open({message});
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Share error:', error);
      }
    }
  }, [payload]);

  const handleClose = useCallback(() => {
    setSearchText('');
    setContacts([]);
    onClose();
  }, [onClose]);

  const renderContact = useCallback(
    ({item}: {item: Contact}) => {
      const name =
        item.displayName ||
        `${item.givenName || ''} ${item.familyName || ''}`.trim() ||
        'Unknown';
      const phone = item.phoneNumbers?.[0]?.number || '';

      return (
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => handleShareViaContact(item)}
          activeOpacity={0.7}>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactInitial}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName} numberOfLines={1}>
              {name}
            </Text>
            {phone ? (
              <Text style={styles.contactPhone} numberOfLines={1}>
                {phone}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [styles, handleShareViaContact],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Share Activity</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>{'\u{2715}'}</Text>
          </TouchableOpacity>
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <View style={styles.qrContainer}>
            <QRCode
              value={deepLink}
              size={160}
              backgroundColor="transparent"
              color={theme.colors.text}
            />
          </View>
          <Text style={styles.qrLabel}>
            {`Scan to add "${payload.name}" to LFG \u{1F680}`}
          </Text>
        </View>

        {/* Share via button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareGeneric}
          activeOpacity={0.8}>
          <Text style={styles.shareButtonText}>
            {'\u{1F4E4}'} Share via...
          </Text>
        </TouchableOpacity>

        {/* Contact search */}
        <Text style={styles.sectionLabel}>Or send to a contact</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchText}
          onChangeText={handleSearchChange}
          autoCorrect={false}
        />

        {hasPermission === false && (
          <Text style={styles.permissionText}>
            Contact access denied. You can still share via the button above.
          </Text>
        )}

        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={item => item.recordID}
          style={styles.contactList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searchText.trim().length > 0 && hasPermission !== false ? (
              <Text style={styles.emptyText}>No contacts found</Text>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

const useStyles = (theme: Theme) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.bg,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          paddingTop: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
          paddingBottom: spacing.md,
        },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
        },
        closeBtn: {
          fontSize: 20,
          color: theme.colors.textMuted,
          padding: spacing.xs,
        },
        // QR
        qrSection: {
          alignItems: 'center',
          paddingVertical: spacing.xl,
        },
        qrContainer: {
          padding: spacing.lg,
          backgroundColor: theme.colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
        },
        qrLabel: {
          marginTop: spacing.md,
          fontSize: 13,
          color: theme.colors.textSecondary,
          textAlign: 'center',
        },
        // Share button
        shareButton: {
          marginHorizontal: spacing.xl,
          backgroundColor: theme.colors.primary,
          borderRadius: radius.md,
          paddingVertical: 14,
          alignItems: 'center',
          ...theme.shadows.glow,
        },
        shareButtonText: {
          color: theme.colors.textOnPrimary,
          fontSize: 16,
          fontWeight: '700',
        },
        // Contact section
        sectionLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginHorizontal: spacing.xl,
          marginTop: spacing.xl,
          marginBottom: spacing.xs,
        },
        searchInput: {
          marginHorizontal: spacing.xl,
          backgroundColor: theme.colors.bgLight,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 12,
          fontSize: 15,
          color: theme.colors.text,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
        },
        permissionText: {
          marginHorizontal: spacing.xl,
          marginTop: spacing.sm,
          fontSize: 13,
          color: theme.colors.textMuted,
          fontStyle: 'italic',
        },
        contactList: {
          flex: 1,
          marginTop: spacing.sm,
        },
        contactRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        },
        contactAvatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.primaryPale,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
        },
        contactInitial: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.primary,
        },
        contactInfo: {
          flex: 1,
        },
        contactName: {
          fontSize: 15,
          fontWeight: '500',
          color: theme.colors.text,
        },
        contactPhone: {
          fontSize: 13,
          color: theme.colors.textSecondary,
          marginTop: 1,
        },
        emptyText: {
          textAlign: 'center',
          color: theme.colors.textMuted,
          fontSize: 14,
          paddingVertical: spacing.xl,
        },
      }),
    [theme],
  );
