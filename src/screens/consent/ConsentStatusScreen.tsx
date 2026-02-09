/**
 * Consent Status Screen
 * Displays consent status dashboard with expiration warnings and revocation interface
 * Requirements: 1.9, 1.10, 1.11
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { getConsentStatus, revokeConsent } from '../../modules/consent/consentManager';
import { ConsentType } from '../../modules/consent/types';

type ConsentStackParamList = {
  ConsentStatus: {
    participantId: string;
    participantName: string;
  };
};

type ConsentStatusScreenRouteProp = RouteProp<ConsentStackParamList, 'ConsentStatus'>;
type ConsentStatusScreenNavigationProp = StackNavigationProp<
  ConsentStackParamList,
  'ConsentStatus'
>;

interface ConsentStatusData {
  hasCFRConsent: boolean;
  hasAIConsent: boolean;
  cfrExpirationDate?: Date;
  aiConsentDate?: Date;
  canCollectPHI: boolean;
}

export const ConsentStatusScreen: React.FC = () => {
  const navigation = useNavigation<ConsentStatusScreenNavigationProp>();
  const route = useRoute<ConsentStatusScreenRouteProp>();
  const { participantId, participantName } = route.params;

  const [consentStatus, setConsentStatus] = useState<ConsentStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadConsentStatus();
  }, []);

  const loadConsentStatus = async () => {
    try {
      const userId = 'current-user-id'; // TODO: Get from auth context
      const status = await getConsentStatus(participantId, userId);
      setConsentStatus(status);
    } catch (error) {
      console.error('Error loading consent status:', error);
      Alert.alert('Error', 'Failed to load consent status');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadConsentStatus();
  };

  const getDaysUntilExpiration = (expirationDate?: Date): number | null => {
    if (!expirationDate) return null;
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpirationWarning = (daysUntil: number | null): string | null => {
    if (daysUntil === null) return null;
    if (daysUntil < 0) return 'EXPIRED';
    if (daysUntil <= 30) return `Expires in ${daysUntil} days`;
    return null;
  };

  const handleRevokeConsent = (consentType: ConsentType, consentName: string) => {
    Alert.alert(
      'Revoke Consent',
      `Are you sure you want to revoke ${consentName}? This action cannot be undone and will immediately restrict access to protected health information.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const userId = 'current-user-id'; // TODO: Get from auth context
              await revokeConsent(
                participantId,
                consentType,
                'Revoked by user request',
                userId
              );
              Alert.alert('Success', 'Consent has been revoked');
              loadConsentStatus();
            } catch (error) {
              console.error('Error revoking consent:', error);
              Alert.alert('Error', 'Failed to revoke consent');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading consent status...</Text>
      </View>
    );
  }

  if (!consentStatus) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load consent status</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadConsentStatus}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cfrDaysUntilExpiration = getDaysUntilExpiration(consentStatus.cfrExpirationDate);
  const cfrWarning = getExpirationWarning(cfrDaysUntilExpiration);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Consent Status</Text>
        <Text style={styles.participantName}>{participantName}</Text>
      </View>

      {/* Overall Status Card */}
      <View style={styles.statusCard}>
        <Text style={styles.statusCardTitle}>Overall Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Can Collect PHI:</Text>
          <View
            style={[
              styles.statusBadge,
              consentStatus.canCollectPHI ? styles.statusBadgeActive : styles.statusBadgeInactive,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {consentStatus.canCollectPHI ? 'YES' : 'NO'}
            </Text>
          </View>
        </View>
        {!consentStatus.canCollectPHI && (
          <Text style={styles.warningText}>
            CFR Part 2 consent is required before collecting protected health information
          </Text>
        )}
      </View>

      {/* CFR Part 2 Consent Card */}
      <View style={styles.consentCard}>
        <View style={styles.consentHeader}>
          <Text style={styles.consentTitle}>42 CFR Part 2 Consent</Text>
          <View
            style={[
              styles.statusIndicator,
              consentStatus.hasCFRConsent
                ? styles.statusIndicatorActive
                : styles.statusIndicatorInactive,
            ]}
          />
        </View>

        <View style={styles.consentDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text
              style={[
                styles.detailValue,
                consentStatus.hasCFRConsent ? styles.detailValueActive : styles.detailValueInactive,
              ]}
            >
              {consentStatus.hasCFRConsent ? 'Active' : 'Not Provided'}
            </Text>
          </View>

          {consentStatus.cfrExpirationDate && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expires:</Text>
                <Text style={styles.detailValue}>
                  {consentStatus.cfrExpirationDate.toLocaleDateString()}
                </Text>
              </View>

              {cfrWarning && (
                <View
                  style={[
                    styles.warningBanner,
                    cfrDaysUntilExpiration && cfrDaysUntilExpiration < 0
                      ? styles.warningBannerExpired
                      : styles.warningBannerExpiring,
                  ]}
                >
                  <Text style={styles.warningBannerText}>⚠️ {cfrWarning}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {consentStatus.hasCFRConsent && (
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => handleRevokeConsent('CFR_PART_2', 'CFR Part 2 Consent')}
          >
            <Text style={styles.revokeButtonText}>Revoke Consent</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* AI Consent Card */}
      <View style={styles.consentCard}>
        <View style={styles.consentHeader}>
          <Text style={styles.consentTitle}>AI Processing Consent</Text>
          <View
            style={[
              styles.statusIndicator,
              consentStatus.hasAIConsent
                ? styles.statusIndicatorActive
                : styles.statusIndicatorInactive,
            ]}
          />
        </View>

        <View style={styles.consentDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text
              style={[
                styles.detailValue,
                consentStatus.hasAIConsent ? styles.detailValueActive : styles.detailValueInactive,
              ]}
            >
              {consentStatus.hasAIConsent ? 'Active' : 'Not Provided'}
            </Text>
          </View>

          {consentStatus.aiConsentDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provided:</Text>
              <Text style={styles.detailValue}>
                {consentStatus.aiConsentDate.toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {consentStatus.hasAIConsent && (
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => handleRevokeConsent('AI_PROCESSING', 'AI Processing Consent')}
          >
            <Text style={styles.revokeButtonText}>Revoke Consent</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Information Section */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>About Consent</Text>
        <Text style={styles.infoText}>
          • CFR Part 2 consent is required by federal law for substance use disorder treatment
          records
        </Text>
        <Text style={styles.infoText}>
          • AI consent is optional and allows for AI-assisted data processing
        </Text>
        <Text style={styles.infoText}>
          • Consents can be revoked at any time, but revocation does not affect information already
          disclosed
        </Text>
        <Text style={styles.infoText}>
          • You will be notified 30 days before consent expiration
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  participantName: {
    fontSize: 16,
    color: '#666',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    marginBottom: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeInactive: {
    backgroundColor: '#FF3B30',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  warningText: {
    fontSize: 14,
    color: '#FF9800',
    marginTop: 5,
  },
  consentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  consentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  consentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusIndicatorActive: {
    backgroundColor: '#4CAF50',
  },
  statusIndicatorInactive: {
    backgroundColor: '#CCC',
  },
  consentDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValueActive: {
    color: '#4CAF50',
  },
  detailValueInactive: {
    color: '#999',
  },
  warningBanner: {
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  warningBannerExpiring: {
    backgroundColor: '#FFF3E0',
  },
  warningBannerExpired: {
    backgroundColor: '#FFEBEE',
  },
  warningBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  revokeButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  revokeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    margin: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 8,
    lineHeight: 20,
  },
});
