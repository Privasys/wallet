// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

// JNI bridge: JVM strings ↔ C strings ↔ Rust FFI (ratls_mobile).

#include <jni.h>
#include <string.h>

// From ratls_mobile static library
extern char *ratls_inspect(const char *host, unsigned short port, const char *ca_cert_path);
extern char *ratls_verify(const char *host, unsigned short port, const char *ca_cert_path,
                          const char *policy_json);
extern void ratls_free_string(char *ptr);

JNIEXPORT jstring JNICALL
Java_org_privasys_nativeratls_NativeRaTlsBridge_nativeInspect(
    JNIEnv *env, jclass clazz, jstring host, jint port, jstring ca_cert_path) {
    const char *host_c = (*env)->GetStringUTFChars(env, host, NULL);
    const char *ca_c = ca_cert_path ? (*env)->GetStringUTFChars(env, ca_cert_path, NULL) : NULL;

    char *result = ratls_inspect(host_c, (unsigned short)port, ca_c);

    (*env)->ReleaseStringUTFChars(env, host, host_c);
    if (ca_c) (*env)->ReleaseStringUTFChars(env, ca_cert_path, ca_c);

    jstring json = (*env)->NewStringUTF(env, result ? result : "{\"error\":\"FFI returned null\"}");
    if (result) ratls_free_string(result);
    return json;
}

JNIEXPORT jstring JNICALL
Java_org_privasys_nativeratls_NativeRaTlsBridge_nativeVerify(
    JNIEnv *env, jclass clazz, jstring host, jint port, jstring ca_cert_path,
    jstring policy_json) {
    const char *host_c = (*env)->GetStringUTFChars(env, host, NULL);
    const char *ca_c = ca_cert_path ? (*env)->GetStringUTFChars(env, ca_cert_path, NULL) : NULL;
    const char *policy_c = (*env)->GetStringUTFChars(env, policy_json, NULL);

    char *result = ratls_verify(host_c, (unsigned short)port, ca_c, policy_c);

    (*env)->ReleaseStringUTFChars(env, host, host_c);
    if (ca_c) (*env)->ReleaseStringUTFChars(env, ca_cert_path, ca_c);
    (*env)->ReleaseStringUTFChars(env, policy_json, policy_c);

    jstring json = (*env)->NewStringUTF(env, result ? result : "{\"error\":\"FFI returned null\"}");
    if (result) ratls_free_string(result);
    return json;
}
