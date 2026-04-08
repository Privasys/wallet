// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Settings screen — manage wallet configuration.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Pressable, Alert, ScrollView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore, GRACE_OPTIONS } from '@/stores/settings';
import { useTrustedAppsStore } from '@/stores/trusted-apps';

export default function SettingsScreen() {
    const router = useRouter();
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
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Settings',
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} hitSlop={8}>
                            <Ionicons name="chevron-back" size={24} color="#007AFF" />
                        </Pressable>
                    ),
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: '#F8FAFB' }
                }}
            />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
                    <View style={styles.emptyCard}>
                        <Ionicons name="key-outline" size={32} color="#C7C7CC" />
                        <Text style={styles.emptyText}>No credentials registered yet</Text>
                    </View>
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
                <View style={styles.dangerSection}>
                    <Text style={styles.dangerTitle}>Danger Zone</Text>
                    <Pressable style={styles.dangerButton} onPress={handleClearAll}>
                        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        <Text style={styles.dangerButtonText}>Clear All Data</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: '#F8FAFB' },
    content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0F172A',
        marginTop: 24,
        marginBottom: 6
    },
    sectionDescription: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 14,
        lineHeight: 20
    },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 24,
        gap: 8,
        marginBottom: 8
    },
    emptyText: { fontSize: 14, color: '#C7C7CC' },

    optionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12
    },
    optionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    optionButtonActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF'
    },
    optionText: { fontSize: 15, fontWeight: '500', color: '#0F172A' },
    optionTextActive: { color: '#fff' },

    credentialCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8
    },
    credentialInfo: { flex: 1, backgroundColor: 'transparent' },
    credentialRp: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
    credentialMeta: { fontSize: 12, color: '#64748B' },
    removeButton: { color: '#FF3B30', fontSize: 14, fontWeight: '500' },

    dangerSection: {
        marginTop: 40,
        alignItems: 'center',
        gap: 12
    },
    dangerTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFF1F0',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderWidth: 1,
        borderColor: '#FECACA'
    },
    dangerButtonText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' }
});
