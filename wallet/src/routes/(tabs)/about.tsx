import Constants from 'expo-constants';
import { StyleSheet } from 'react-native';

import AboutPrivasysWallet from '@/components/AboutPrivasysWallet';
import { Text, View, Image } from '@/components/Themed';

export default function TabTwoScreen() {
    return (
        <View style={styles.container}>
            <View style={{ flexDirection: 'row', gap: 20 }}>
                <Image
                    style={styles.image}
                    source={require('@/assets/images/privasys-logo.svg')}
                    contentFit="contain"
                />
            </View>
            <Text style={styles.title}>Privasys Wallet by Privasys</Text>
            <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
            <AboutPrivasysWallet />
            <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
            <View style={{ width: '100%', paddingHorizontal: 30, gap: 10 }}>
                <View
                    style={{
                        backgroundColor: '#eeeeee',
                        padding: 20,
                        borderRadius: 8,
                        width: '100%',
                        gap: 20
                    }}
                >
                    <View
                        style={{
                            backgroundColor: 'transparent',
                            width: '100%',
                            justifyContent: 'space-between',
                            flexDirection: 'row'
                        }}
                    >
                        <Text>Version</Text>
                        <Text style={{ fontWeight: 'bold' }}>
                            {Constants.expoConfig?.extra?.CODE_VERSION}
                        </Text>
                    </View>
                    <View
                        style={{
                            backgroundColor: 'transparent',
                            width: '100%',
                            justifyContent: 'space-between',
                            flexDirection: 'row'
                        }}
                    >
                        <Text>Build Number</Text>
                        <Text style={{ fontWeight: 'bold' }}>
                            {Constants.expoConfig?.extra?.BUILD_NUMBER}
                        </Text>
                    </View>
                    <View
                        style={{
                            backgroundColor: 'transparent',
                            width: '100%',
                            justifyContent: 'space-between',
                            flexDirection: 'row'
                        }}
                    >
                        <Text>Build ID</Text>
                        <Text style={{ fontWeight: 'bold' }}>
                            {Constants.expoConfig?.extra?.BUILD_ID?.slice(0, 7)}
                        </Text>
                    </View>
                    <View
                        style={{
                            backgroundColor: 'transparent',
                            width: '100%',
                            justifyContent: 'space-between',
                            flexDirection: 'row'
                        }}
                    >
                        <Text>Build Type</Text>
                        <Text style={{ fontWeight: 'bold' }}>
                            {Constants.expoConfig?.extra?.STAGE}
                        </Text>
                    </View>
                    <View
                        style={{
                            backgroundColor: 'transparent',
                            width: '100%',
                            justifyContent: 'space-between',
                            flexDirection: 'row'
                        }}
                    >
                        <Text>Commit ID</Text>
                        <Text style={{ fontWeight: 'bold' }}>
                            {Constants.expoConfig?.extra?.COMMIT_HASH?.slice(0, 7)}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    image: { width: 50, height: 50, marginBottom: 20, backgroundColor: 'transparent' },
    title: { fontSize: 20, fontWeight: 'bold' },
    separator: { marginVertical: 30, height: 1, width: '80%' }
});
