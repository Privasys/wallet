// Copyright (c) Privasys. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

package org.privasys.nativeratls

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

class NativeRaTlsModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NativeRaTls")

        AsyncFunction("inspect") { host: String, port: Int, caCertPath: String? ->
            runBlocking(Dispatchers.IO) {
                NativeRaTlsBridge.nativeInspect(host, port, caCertPath)
            }
        }

        AsyncFunction("verify") { host: String, port: Int, caCertPath: String?, policyJson: String ->
            runBlocking(Dispatchers.IO) {
                NativeRaTlsBridge.nativeVerify(host, port, caCertPath, policyJson)
            }
        }
    }
}
