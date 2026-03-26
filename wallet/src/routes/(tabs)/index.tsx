import { StyleSheet, ScrollView } from 'react-native';

import { Text, View, Image } from '@/components/Themed';
import { useTrustedAppsStore } from '@/stores/trusted-apps';

export default function TabOneScreen() {
    const { apps } = useTrustedAppsStore();

    return (
        <View style={styles.container}>
            <Image
                style={styles.image}
                source={require('@/assets/images/privasys-logo.svg')}
                contentFit="contain"
                transition={1000}
            />
            <Text style={styles.title}>Privasys Wallet</Text>

            {apps.length === 0 ? (
                <>
                    <View
                        style={styles.separator}
                        lightColor="#eee"
                        darkColor="rgba(255,255,255,0.1)"
                    />
                    <Text style={styles.emptyText}>
                        No services connected yet.{'\n'}Scan a QR code to get started.
                    </Text>
                </>
            ) : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    <Text style={styles.sectionTitle}>Connected Services</Text>
                    {apps.map((app) => (
                        <View key={app.rpId} style={styles.serviceCard}>
                            <View style={styles.serviceIcon}>
                                <Text style={styles.serviceIconText}>
                                    {app.teeType === 'sgx' ? '🔒' : '🛡'}
                                </Text>
                            </View>
                            <View style={styles.serviceInfo}>
                                <Text style={styles.serviceName}>{app.rpId}</Text>
                                <Text style={styles.serviceMeta}>
                                    {app.teeType.toUpperCase()} · Verified{' '}
                                    {new Date(app.lastVerified * 1000).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', paddingTop: 80 },
    image: { width: 60, height: 60, marginBottom: 20, backgroundColor: 'transparent' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    separator: { marginVertical: 30, height: 1, width: '80%' },
    emptyText: { fontSize: 15, textAlign: 'center', opacity: 0.5, lineHeight: 22 },
    list: { width: '100%', flex: 1 },
    listContent: { padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '600', opacity: 0.5, marginBottom: 12 },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(128,128,128,0.1)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8
    },
    serviceIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(128,128,128,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    serviceIconText: { fontSize: 20 },
    serviceInfo: { flex: 1, backgroundColor: 'transparent' },
    serviceName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    serviceMeta: { fontSize: 12, opacity: 0.5 }
});
