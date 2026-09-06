import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  securityAccessGateService,
  type SecurityGateState,
} from '@/lib/services/SecurityAccessGateService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export default function RegionalAccessRestrictedModal() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const [gateState, setGateState] = useState<SecurityGateState>(
    securityAccessGateService.getState()
  );

  useEffect(() => {
    const unsubscribe = securityAccessGateService.subscribe(setGateState);
    // Trigger initial check
    void securityAccessGateService.checkAccess();
    return unsubscribe;
  }, []);

  if (!gateState.isRestricted) {
    return null;
  }

  const handleRetry = async () => {
    await securityAccessGateService.checkAccess(true);
  };

  const handleSignIn = () => {
    securityAccessGateService.dismissRestrictionTemporarily();
    router.push('/(auth)/login');
  };

  return (
    <Modal
      visible={gateState.isRestricted}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
    >
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={[
          styles.container,
          { backgroundColor: isDark ? '#09090b' : '#f4f4f5' },
        ]}
      >
        <View style={styles.content}>
          {/* Shield Alert Icon */}
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
              },
            ]}
          >
            <Ionicons name="shield-outline" size={48} color="#ef4444" />
          </View>

          {/* Badge */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
              },
            ]}
          >
            <Ionicons name="globe-outline" size={13} color="#ef4444" />
            <Text style={styles.badgeText}>REGION RESTRICTION ACTIVE</Text>
          </View>

          {/* Title & Description */}
          <Text style={[styles.title, { color: colors.text }]}>Access Restricted</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            {gateState.reason ||
              'Access to Ourlime is currently restricted from your geographic location or network.'}
          </Text>

          {/* Diagnostic Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.elevated,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.mutedText }]}>
              CONNECTION DIAGNOSTICS
            </Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={[styles.pillLabel, { color: colors.mutedText }]}>Detected IP</Text>
                <Text style={[styles.pillValue, { color: colors.text }]}>
                  {gateState.detectedIp || 'Resolving…'}
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={[styles.pillLabel, { color: colors.mutedText }]}>Region / Country</Text>
                <Text style={[styles.pillValue, { color: colors.text }]}>
                  {gateState.detectedCountry || 'Unresolved'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.footnote, { color: colors.mutedText }]}>
            If you have an administrative account or an authorized IP whitelist override, sign in to
            bypass this restriction.
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.retryButton,
                {
                  backgroundColor: colors.control,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => void handleRetry()}
              disabled={gateState.checking}
            >
              {gateState.checking ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={colors.text} />
                  <Text style={[styles.retryButtonText, { color: colors.text }]}>Check Again</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleSignIn}
            >
              <Ionicons name="log-in-outline" size={18} color="#ffffff" />
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  card: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  pillLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  pillValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  footnote: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 24,
  },
  buttonGroup: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  signInButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#10b981',
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
