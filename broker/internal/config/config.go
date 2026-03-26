// Copyright (c) Privasys. All rights reserved.
// Licensed under the GNU Affero General Public License v3.0.

package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port        int
	ExpoPushURL string
}

func Load() *Config {
	port := 8090
	if p := os.Getenv("BROKER_PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			port = v
		}
	}

	expoPush := os.Getenv("EXPO_PUSH_URL")
	if expoPush == "" {
		expoPush = "https://exp.host/--/api/v2/push/send"
	}

	return &Config{
		Port:        port,
		ExpoPushURL: expoPush,
	}
}

func (c *Config) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}
