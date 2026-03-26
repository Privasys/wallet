// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Settings screen — manage wallet configuration.
 */

import { Stack } from 'expo-router';
import { StyleSheet, Pressable, Alert, ScrollView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore, GRACE_OPTIONS } from '@/stores/settings';
import { useTrustedAppsStore } from '@/stores/trusted-apps';

export default function SettingsScreen() {
    const { credentials, removeCredential } = useAuthStore();
    const { gracePeriodSec, setGracePeriod } = useSettingsStore();
    const { apps, remove: removeTrustedApp } = useTrustedAppsStore();

    const handleClearAll = () => {
        Alert.alert(
            'Clear All Data',
            'This will remove all registered credentials and trusted apps. You will need to re-register with each service.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                        for (const cred of credentials) {
                            removeCredential(cred.credentialId);
                        }
                        for (const app of apps) {
                            removeTrustedApp(app.rpId);
                        }
                    }
                }
            ]
        );
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Settings' }} />
            <ScrollView contentContainerStyle={styles.content}>
                {/* Grace Period */}
                <Text style={styles.sectionTitle}>Biometric Grace Period</Text>
                <Text style={styles.sectionDescription}>
                    After authenticating once, skip the biometric prompt for subsequent requests
                    within this window.
                </Text>
                <View style={styles.optionsRow}>
                    {GRACE_OPTIONS.map((sec) => (
                        <Pressable
                            key={sec}
                            style={[
                                styles.optionButton,
                                gracePeriodSec === sec && styles.optionButtonActive
                            ]}
                            onPress={() => setGracePeriod(sec)}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    gracePeriodSec === sec && styles.optionTextActive
                                ]}
                            >
                                {sec === 0 ? 'Always' : `${sec}s`}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {/* Registered Credentials */}
                <Text style={styles.sectionTitle}>Registered Credentials</Text>
                {credentials.length === 0 ? (
                    <Text style={styles.emptyText}>No credentials registered yet.</Text>
                ) : (
                    credentials.map((cred) => (
                        <View key={cred.credentialId} style={styles.credentialCard}>
                            <View style={styles.credentialInfo}>
                                <Text style={styles.credentialRp}>{cred.rpId}</Text>
                                <Text style={styles.credentialMeta}>
                                    {cred.userName} · Registered{' '}
                                    {new Date(cred.registeredAt * 1000).toLocaleDateString()}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() =>
                                    Alert.alert(
                                        'Remove Credential',
                                        `Remove credential for ${cred.rpId}?`,
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Remove',
                                                style: 'destructive',
                                                onPress: () => {
                                                    removeCredential(cred.credentialId);
                                                    removeTrustedApp(cred.rpId);
                                                }
                                            }
                                        ]
                                    )
                                }
                            >
                                <Text style={styles.removeButton}>Remove</Text>
                            </Pressable>
                        </View>
                    ))
                )}

                {/* Danger Zone */}
                <View style={styles.dangerZone}>
                    <Pressable style={styles.dangerButton} onPress={handleClearAll}>
                        <Text style={styles.dangerButtonText}>Clear All Data</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    content: { padding: 20, paddingTop: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 24, marginBottom: 8 },
    sectionDescription: { fontSize: 14, opacity: 0.6, marginBottom: 12, lineHeight: 20 },
    emptyText: { fontSize: 14, opacity: 0.5, fontStyle: 'italic', marginBottom: 16 },

    optionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12
    },
    optionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(128,128,128,0.15)',
        alignItems: 'center'
    },
    optionButtonActive: { backgroundColor: '#007AFF' },
    optionText: { fontSize: 15, fontWeight: '500' },
    optionTextActive: { color: '#fff' },

    credentialCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(128,128,128,0.1)',
        borderRadius: 10,
        padding: 14,
        marginBottom: 8
    },
    credentialInfo: { flex: 1, backgroundColor: 'transparent' },
    credentialRp: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    credentialMeta: { fontSize: 12, opacity: 0.5 },
    removeButton: { color: '#FF3B30', fontSize: 14, fontWeight: '500' },

    dangerZone: { marginTop: 40, alignItems: 'center' },
    dangerButton: {
        backgroundColor: '#FF3B30',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 40
    },
    dangerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
