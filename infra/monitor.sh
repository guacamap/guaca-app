#!/usr/bin/env bash
# GUACA uptime watch — run from cron on the VM, every few minutes:
#
#   */5 * * * * cd /root/guaca && bash infra/monitor.sh >> /var/log/guaca-monitor.log 2>&1
#
# Deliberately dependency-free: it calls Resend over plain HTTPS rather than
# going through our own API, because the case it exists for is our API being
# down. It only mails on a CHANGE of state (up->down, down->up), so a long
# outage produces one alert instead of one every five minutes.
set -uo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-infra/env/prod.env}"
STATE_FILE="${STATE_FILE:-/var/lib/guaca/monitor.state}"

API="${API_URL:-https://api.guaca.live}"
APP="${APP_URL:-https://app.guaca.live}"

# Read secrets without sourcing: values here are compose-literal and may
# contain spaces or <>, which a shell `source` would choke on.
val() { grep "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-; }
RESEND_API_KEY="$(val RESEND_API_KEY)"
ALERT_EMAIL="$(val ALERT_EMAIL)"
# Alerts come from their own address, so a team inbox can route them apart
# from anything a customer would ever receive.
EMAIL_FROM="$(val ALERT_FROM)"
: "${EMAIL_FROM:=Guaca Alerts <alerts@guaca.live>}"

FAILURES=""

# /healthz reports process AND database, so a DB outage is not a false green.
HEALTH="$(curl -fsS -m 20 "$API/healthz" 2>/dev/null)" || HEALTH=""
case "$HEALTH" in
  *'"ok":true'*) : ;;
  '') FAILURES+="- API $API/healthz did not respond"$'\n' ;;
  *)  FAILURES+="- API $API/healthz replied but not ok: ${HEALTH:0:200}"$'\n' ;;
esac
case "$HEALTH" in
  *'"db":true'*) : ;;
  '') : ;;
  *) FAILURES+="- API reports the database is NOT reachable"$'\n' ;;
esac

APP_CODE="$(curl -fsSL -o /dev/null -w '%{http_code}' -m 20 "$APP/" 2>/dev/null)" || APP_CODE="000"
[[ "$APP_CODE" == "200" ]] || FAILURES+="- App $APP/ returned HTTP $APP_CODE"$'\n'

# TLS expiry: renewal is automatic, so this only fires if renewal is broken —
# which is silent until the morning every client refuses to connect.
EXPIRY="$(echo | openssl s_client -connect "${API#https://}:443" -servername "${API#https://}" 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
if [[ -n "$EXPIRY" ]]; then
  SECS_LEFT=$(( $(date -d "$EXPIRY" +%s 2>/dev/null || echo 0) - $(date +%s) ))
  (( SECS_LEFT > 0 && SECS_LEFT < 7*24*3600 )) && \
    FAILURES+="- TLS certificate expires in $(( SECS_LEFT / 86400 )) days ($EXPIRY)"$'\n'
fi

NOW_STATE="up"; [[ -n "$FAILURES" ]] && NOW_STATE="down"
mkdir -p "$(dirname "$STATE_FILE")"
PREV_STATE="$(cat "$STATE_FILE" 2>/dev/null || echo unknown)"
echo "$NOW_STATE" > "$STATE_FILE"

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ "$NOW_STATE" == "$PREV_STATE" ]]; then
  echo "$STAMP $NOW_STATE (unchanged)"
  exit 0
fi

if [[ "$NOW_STATE" == "down" ]]; then
  SUBJECT="GUACA is DOWN"
  BODY="Production check failed at $STAMP:"$'\n\n'"$FAILURES"
else
  SUBJECT="GUACA recovered"
  BODY="Production checks are passing again at $STAMP."
fi
echo "$STAMP $NOW_STATE (changed from $PREV_STATE)"
echo "$BODY"

if [[ -z "$RESEND_API_KEY" || -z "$ALERT_EMAIL" ]]; then
  echo "  (no RESEND_API_KEY or ALERT_EMAIL in $ENV_FILE — cannot send the alert)"
  exit 1
fi

python3 - "$RESEND_API_KEY" "$ALERT_EMAIL" "$EMAIL_FROM" "$SUBJECT" "$BODY" <<'PY'
import json, sys, urllib.request
key, to, sender, subject, body = sys.argv[1:6]
req = urllib.request.Request(
    "https://api.resend.com/emails",
    data=json.dumps({"from": sender, "to": [to], "subject": subject, "text": body}).encode(),
    headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        # Resend sits behind Cloudflare, which blocks the default
        # "Python-urllib/3.x" agent with error 1010. curl works, urllib does
        # not — so say who we are.
        "User-Agent": "guaca-monitor/1.0",
    },
    method="POST",
)
try:
    urllib.request.urlopen(req, timeout=20)
    print("  alert sent")
except urllib.error.HTTPError as exc:
    # Print the body: Resend puts the actual reason there ("domain is not
    # verified", "restricted key"), and an alerting tool that hides why it
    # could not alert is worse than useless.
    print(f"  ALERT SEND FAILED: HTTP {exc.code} {exc.read().decode(errors='replace')[:300]}")
    sys.exit(1)
except Exception as exc:  # a failed alert must not mask the outage it reports
    print(f"  ALERT SEND FAILED: {exc}")
    sys.exit(1)
PY
