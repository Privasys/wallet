import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';

// Configure how notifications are handled when received
Notifications.setNotificationHandler({
    handleNotification: async (_notification: Notifications.Notification) => {
        return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true
        };
    }
});

let ambientPushToken: string | null = null;

export function useExpoPushToken() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(ambientPushToken);
    const router = useRouter();
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    useEffect(() => {
        async function registerForPushNotifications() {
            if (!Device.isDevice) {
                return;
            }

            // Ask for permission
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                return;
            }

            // Get the Expo push token
            const token = (await Notifications.getExpoPushTokenAsync()).data;
            ambientPushToken = token;
            setExpoPushToken(token);

            if (Platform.OS === 'android') {
                Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX
                });
            }
        }

        registerForPushNotifications();

        // Handle push notification taps — navigate to connect flow for auth requests
        responseListener.current = Notifications.addNotificationResponseReceivedListener(
            (response: Notifications.NotificationResponse) => {
                const data = response.notification.request.content.data;
                if (data?.type === 'auth-request' && data.origin && data.sessionId && data.rpId) {
                    const payload = JSON.stringify({
                        origin: data.origin,
                        sessionId: data.sessionId,
                        rpId: data.rpId,
                        brokerUrl: data.brokerUrl
                    });
                    router.push({ pathname: '/connect', params: { payload } });
                }
            }
        );

        return () => {
            responseListener.current?.remove();
        };
    }, [router]);

    return expoPushToken;
}
