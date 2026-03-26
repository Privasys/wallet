import { StyleSheet } from 'react-native';

import Colors from '@/constants/colors';

import { ExternalLink } from './ExternalLink';
import { Text, View } from './Themed';

export default function WelcomeScreenInfo() {
    return (
        <View>
            <View style={styles.getStartedContainer}>
                <Text
                    style={styles.getStartedText}
                    lightColor="rgba(0,0,0,0.8)"
                    darkColor="rgba(255,255,255,0.8)"
                >
                    Test your TDX enclave attestation quotes
                </Text>
                {/* <Text
                    style={styles.getStartedText}
                    lightColor="rgba(0,0,0,0.8)"
                    darkColor="rgba(255,255,255,0.8)"
                >
                    During your next login, Privasys Wallet will receive login notifications directly, to make things even easier.
                </Text> */}

                {/* <View
                    style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
                    darkColor="rgba(255,255,255,0.05)"
                    lightColor="rgba(0,0,0,0.05)"
                >
                    <MonoText>Status: Pending enrollment</MonoText>
                </View> */}

                {/* <Text
                    style={styles.getStartedText}
                    lightColor="rgba(0,0,0,0.8)"
                    darkColor="rgba(255,255,255,0.8)">
                    Find out more at privasys.org
                </Text> */}

                {/* <Button title='Try!' onPress={() => { Sentry.captureException(new Error('First error')) }} /> */}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    getStartedContainer: { alignItems: 'center', marginHorizontal: 80 },
    homeScreenFilename: { marginVertical: 7 },
    codeHighlightContainer: { borderRadius: 3, paddingHorizontal: 4 },
    getStartedText: { fontSize: 17, lineHeight: 24, marginBottom: 20, textAlign: 'center' },
    helpContainer: { marginTop: 15, marginHorizontal: 20, alignItems: 'center' },
    helpLink: { paddingVertical: 15 },
    helpLinkText: { textAlign: 'center' }
});
