cmake_minimum_required(VERSION 3.22)
project(ratls_jni C)

add_library(ratls_jni SHARED ratls_jni.c)

# Pre-built Rust shared library
add_library(ratls_mobile SHARED IMPORTED)
set_target_properties(ratls_mobile PROPERTIES
    IMPORTED_LOCATION "${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libratls_mobile.so"
)

target_link_libraries(ratls_jni ratls_mobile log)
