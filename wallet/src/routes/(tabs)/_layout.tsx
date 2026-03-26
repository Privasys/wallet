import { Icon, Label } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';

export default function TabLayout() {
    return (
        <NativeTabs>
            <NativeTabs.Trigger name="index">
                <Label>Home</Label>
                <Icon sf="house.fill" drawable="ic_menu_home" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="scan">
                <Label>Scan</Label>
                <Icon sf="qrcode.viewfinder" drawable="ic_menu_camera" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="about">
                <Label>About</Label>
                <Icon sf="info.circle.fill" drawable="ic_menu_help" />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
