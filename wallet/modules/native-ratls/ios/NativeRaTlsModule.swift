// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import ExpoModulesCore
import NativeRaTlsC

public class NativeRaTlsModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeRaTls")

        AsyncFunction("inspect") { (host: String, port: Int, caCertPath: String?) -> String in
            return await withCheckedContinuation { continuation in
                DispatchQueue.global(qos: .userInitiated).async {
                    let result = host.withCString { hostPtr in
                        if let path = caCertPath {
                            return path.withCString { pathPtr in
                                ratls_inspect(hostPtr, UInt16(port), pathPtr)
                            }
                        } else {
                            return ratls_inspect(hostPtr, UInt16(port), nil)
                        }
                    }

                    guard let result else {
                        continuation.resume(returning: "{\"error\":\"FFI returned null\"}")
                        return
                    }

                    let json = String(cString: result)
                    ratls_free_string(result)
                    continuation.resume(returning: json)
                }
            }
        }

        AsyncFunction("verify") { (host: String, port: Int, caCertPath: String?, policyJson: String) -> String in
            return await withCheckedContinuation { continuation in
                DispatchQueue.global(qos: .userInitiated).async {
                    let result = host.withCString { hostPtr in
                        policyJson.withCString { policyPtr in
                            if let path = caCertPath {
                                return path.withCString { pathPtr in
                                    ratls_verify(hostPtr, UInt16(port), pathPtr, policyPtr)
                                }
                            } else {
                                return ratls_verify(hostPtr, UInt16(port), nil, policyPtr)
                            }
                        }
                    }

                    guard let result else {
                        continuation.resume(returning: "{\"error\":\"FFI returned null\"}")
                        return
                    }

                    let json = String(cString: result)
                    ratls_free_string(result)
                    continuation.resume(returning: json)
                }
            }
        }
    }
}
