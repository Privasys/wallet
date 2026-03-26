// Copyright (c) Privasys. All rights reserved.
// Licensed under the GNU Affero General Public License v3.0.

// Package relay implements the WebSocket relay hub that pairs browser
// and wallet connections by session ID.
package relay

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics
var (
	sessionsActive = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "broker_sessions_active",
		Help: "Number of active relay sessions.",
	})
	messagesRelayed = promauto.NewCounter(prometheus.CounterOpts{
		Name: "broker_messages_relayed_total",
		Help: "Total messages relayed between peers.",
	})
	connectionsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "broker_connections_total",
		Help: "Total WebSocket connections by role.",
	}, []string{"role"})
)

const (
	RoleBrowser = "browser"
	RoleWallet  = "wallet"

	// Max time to wait for a peer before closing
	peerTimeout = 120 * time.Second

	// Max message size (64KB)
	maxMessageSize = 64 * 1024

	// WebSocket timeouts
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

// session holds the two peers (browser + wallet) for a given session ID.
type session struct {
	id      string
	mu      sync.Mutex
	browser *peer
	wallet  *peer
	created time.Time
}

type peer struct {
	conn *websocket.Conn
	role string
	send chan []byte
	done chan struct{}
}

// Hub manages all active relay sessions.
type Hub struct {
	mu       sync.RWMutex
	sessions map[string]*session
	quit     chan struct{}
}

func NewHub() *Hub {
	return &Hub{
		sessions: make(map[string]*session),
		quit:     make(chan struct{}),
	}
}

// Run starts the hub's garbage collector for stale sessions.
func (h *Hub) Run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.cleanStale()
		case <-h.quit:
			return
		}
	}
}

func (h *Hub) Shutdown() {
	close(h.quit)
}

// SessionCountJSON returns the active session count as a JSON number string.
func (h *Hub) SessionCountJSON() string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return fmt.Sprintf("%d", len(h.sessions))
}

// Join adds a connection to a session. If both peers are present, they'll
// relay messages to each other.
func (h *Hub) Join(sessionID, role string, conn *websocket.Conn) {
	connectionsTotal.WithLabelValues(role).Inc()

	h.mu.Lock()
	s, exists := h.sessions[sessionID]
	if !exists {
		s = &session{
			id:      sessionID,
			created: time.Now(),
		}
		h.sessions[sessionID] = s
		sessionsActive.Inc()
	}
	h.mu.Unlock()

	p := &peer{
		conn: conn,
		role: role,
		send: make(chan []byte, 16),
		done: make(chan struct{}),
	}

	s.mu.Lock()
	switch role {
	case RoleBrowser:
		if s.browser != nil {
			// Close existing browser connection (replaced)
			close(s.browser.done)
		}
		s.browser = p
	case RoleWallet:
		if s.wallet != nil {
			close(s.wallet.done)
		}
		s.wallet = p
	}
	other := s.otherPeer(role)
	s.mu.Unlock()

	// If the peer arrived, notify the other side
	if other != nil {
		msg := fmt.Sprintf(`{"type":"%s-waiting"}`, role)
		select {
		case other.send <- []byte(msg):
		default:
		}
	}

	// Start read/write pumps
	go h.writePump(s, p)
	h.readPump(s, p) // Blocks until close
}

// Remove cleans up a peer from a session.
func (h *Hub) remove(s *session, p *peer) {
	s.mu.Lock()
	if s.browser == p {
		s.browser = nil
	}
	if s.wallet == p {
		s.wallet = nil
	}
	empty := s.browser == nil && s.wallet == nil
	s.mu.Unlock()

	p.conn.Close()

	if empty {
		h.mu.Lock()
		delete(h.sessions, s.id)
		h.mu.Unlock()
		sessionsActive.Dec()
	}
}

func (s *session) otherPeer(role string) *peer {
	if role == RoleBrowser {
		return s.wallet
	}
	return s.browser
}

// readPump reads messages from a peer and forwards them to the other peer.
func (h *Hub) readPump(s *session, p *peer) {
	defer h.remove(s, p)

	p.conn.SetReadLimit(maxMessageSize)
	p.conn.SetReadDeadline(time.Now().Add(pongWait))
	p.conn.SetPongHandler(func(string) error {
		p.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, msg, err := p.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("session %s [%s] read error: %v", s.id[:8], p.role, err)
			}
			return
		}

		// Forward to the other peer
		s.mu.Lock()
		other := s.otherPeer(p.role)
		s.mu.Unlock()

		if other != nil {
			select {
			case other.send <- msg:
				messagesRelayed.Inc()
			default:
				log.Printf("session %s [%s] dropped message (other send full)", s.id[:8], p.role)
			}
		}
	}
}

// writePump sends messages from the send channel to the WebSocket.
func (h *Hub) writePump(s *session, p *peer) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		p.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-p.send:
			p.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				p.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := p.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			p.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := p.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-p.done:
			p.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}
	}
}

// cleanStale removes sessions older than the peer timeout with no active peers.
func (h *Hub) cleanStale() {
	h.mu.Lock()
	defer h.mu.Unlock()

	cutoff := time.Now().Add(-peerTimeout)
	for id, s := range h.sessions {
		s.mu.Lock()
		stale := s.browser == nil && s.wallet == nil && s.created.Before(cutoff)
		s.mu.Unlock()
		if stale {
			delete(h.sessions, id)
			sessionsActive.Dec()
		}
	}
}
