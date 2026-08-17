#!/usr/bin/env bash
# GUACA post-deploy smoke test — run from ANY machine against the public URLs.
#
#   ./infra/smoke.sh https://api.guaca.live https://app.guaca.live https://guaca.live
#
# Checks what actually breaks a release: TLS, the API answering, the legal
# pages Play requires, and that production is NOT running with the dev
# sign-in bypass open. Exits non-zero if anything fails, so it can gate a
# deploy.
set -uo pipefail

API="${1:-https://api.guaca.live}"
APP="${2:-https://app.guaca.live}"
WEB="${3:-https://guaca.live}"
FAILED=0

check() { # name, expected, actual
  if [[ "$2" == "$3" ]]; then
    printf '  ok   %-46s %s\n' "$1" "$3"
  else
    printf '  FAIL %-46s got %s, want %s\n' "$1" "$3" "$2"
    FAILED=1
  fi
}

code() { curl -sS -o /dev/null -w '%{http_code}' -m 25 "$1" 2>/dev/null || echo 000; }

echo "== TLS and reachability =="
check "api TLS + places (needs bbox → 400)" 400 "$(code "$API/api/places")"
check "api places with bbox" 200 "$(code "$API/api/places?bbox=-68.1,10.4,-67.9,10.6")"
check "app root" 200 "$(code "$APP/")"
check "app map" 200 "$(code "$APP/map")"
check "app service worker" 200 "$(code "$APP/sw.js")"

echo "== Play requirements =="
check "privacy policy" 200 "$(code "$WEB/privacy")"
check "terms" 200 "$(code "$WEB/terms")"
check "account deletion" 200 "$(code "$WEB/delete-account")"

echo "== production safety =="
# The dev bypass must be closed. A 200 here means NODE_ENV is not production.
BYPASS=$(curl -sS -m 25 -X POST "$API/api/tourist/auth/verify" \
  -H 'content-type: application/json' \
  -d '{"email":"smoke-should-not-exist@guaca.live","code":"000000"}' \
  -o /dev/null -w '%{http_code}' 2>/dev/null || echo 000)
if [[ "$BYPASS" == "200" ]]; then
  printf '  FAIL %-46s dev bypass ACCEPTED in production\n' "dev bypass closed"
  FAILED=1
else
  printf '  ok   %-46s rejected (%s)\n' "dev bypass closed" "$BYPASS"
fi

# Cookies must be Secure over HTTPS, or the wrapper drops the session.
if [[ "$API" == https://* ]]; then
  SECURE=$(curl -sS -m 25 -i -X POST "$API/api/tourist/logout" 2>/dev/null | grep -ic 'set-cookie:.*secure' || true)
  check "session cookie marked Secure" 1 "${SECURE:-0}"
fi

echo
if [[ "$FAILED" == 0 ]]; then
  echo "PASS — deployment looks healthy."
else
  echo "FAILED — do not announce this deploy yet."
fi
exit "$FAILED"
