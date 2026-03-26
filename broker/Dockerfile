# Copyright (c) Privasys. All rights reserved.
# Licensed under the GNU Affero General Public License v3.0.

FROM golang:1.24-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /auth-broker ./cmd/broker

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /auth-broker /auth-broker
EXPOSE 8090
USER nonroot:nonroot
ENTRYPOINT ["/auth-broker"]
