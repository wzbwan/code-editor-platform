package auth

import (
	"errors"
	"net/http"
	"strings"
)

var (
	ErrOriginNotAllowed = errors.New("origin not allowed")
	ErrInvalidToken     = errors.New("invalid token")
)

type Validator struct {
	AllowedOrigins map[string]struct{}
	SharedToken    string
}

func NewValidator(origins []string, sharedToken string) Validator {
	allowedOrigins := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		allowedOrigins[origin] = struct{}{}
	}

	return Validator{
		AllowedOrigins: allowedOrigins,
		SharedToken:    strings.TrimSpace(sharedToken),
	}
}

func (v Validator) ValidateRequest(r *http.Request) error {
	if err := v.validateOrigin(r); err != nil {
		return err
	}

	if v.SharedToken == "" {
		return nil
	}

	token := strings.TrimSpace(r.Header.Get("X-Runner-Token"))
	if token == "" {
		token = strings.TrimSpace(r.URL.Query().Get("token"))
	}

	if token == "" {
		authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			token = strings.TrimSpace(authHeader[7:])
		}
	}

	if token != v.SharedToken {
		return ErrInvalidToken
	}

	return nil
}

func (v Validator) IsOriginAllowed(origin string) bool {
	if len(v.AllowedOrigins) == 0 {
		return true
	}
	if origin == "" {
		return false
	}
	_, ok := v.AllowedOrigins[origin]
	return ok
}

func (v Validator) validateOrigin(r *http.Request) error {
	if len(v.AllowedOrigins) == 0 {
		return nil
	}

	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return nil
	}

	if v.IsOriginAllowed(origin) {
		return nil
	}

	return ErrOriginNotAllowed
}
