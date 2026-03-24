#!/usr/bin/env bash
set -euo pipefail

# Usage:
# API_BASE (optional, default http://localhost:8080)
# NEW_USERNAME, DISPLAY_NAME, EMAIL, PASSWORD, SCHEDULED_TIME, TITLE can be overridden via env vars

API_BASE="${API_BASE:-http://localhost:8080}"
NEW_USERNAME="${NEW_USERNAME:-newuser1}"
DISPLAY_NAME="${DISPLAY_NAME:-Người Mới}"
EMAIL="${EMAIL:-newuser1@example.com}"
PASSWORD="${PASSWORD:-P@ssw0rd}"
SCHEDULED_TIME="${SCHEDULED_TIME:-2026-03-25T18:00:00Z}"
TITLE="${TITLE:-Coffee date}"

echo "=> Fetching origin and checking out 'develop'"
git fetch origin
if git show-ref --verify --quiet refs/heads/develop; then
  git checkout develop
  git pull --ff-only
else
  git checkout -b develop origin/develop
fi

echo "=> Creating user: $NEW_USERNAME"
CREATE_RESP=$(curl -sS -X POST "$API_BASE/api/users" -H "Content-Type: application/json" -d "{\"username\":\"$NEW_USERNAME\",\"displayName\":\"$DISPLAY_NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$CREATE_RESP" | jq '.' || true

echo "=> Logging in to get token"
TOKEN=$(curl -sS -X POST "$API_BASE/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"$NEW_USERNAME\",\"password\":\"$PASSWORD\"}" | jq -r '.accessToken')
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "Login failed or token not returned" >&2
  exit 1
fi

CREATOR_ID=$(curl -sS -H "Authorization: Bearer $TOKEN" "$API_BASE/api/me" | jq -r '._id')
echo "Creator ID: $CREATOR_ID"

echo "=> Searching for user 'thanh hải'"
THANHHAI_JSON=$(curl -sS -H "Authorization: Bearer $TOKEN" "$API_BASE/api/users?query=thanh%20hai")
echo "$THANHHAI_JSON" | jq '.' || true
THANH_HAI_ID=$(echo "$THANHHAI_JSON" | jq -r '.[0]._id')
if [ -z "$THANH_HAI_ID" ] || [ "$THANH_HAI_ID" == "null" ]; then
  echo "User 'thanh hải' not found" >&2
  exit 1
fi
echo "Found thanh hai id: $THANH_HAI_ID"

APPT_BODY=$(jq -n --arg c "$CREATOR_ID" --arg p "$THANH_HAI_ID" --arg t "$TITLE" --arg st "$SCHEDULED_TIME" '{creatorId:$c, participantId:$p, title:$t, location:{placeName:"Cafe X", address:"123 Đường", geo:{x:106.700, y:10.762}}, scheduledTime:$st, estimatedCost:{min:100000, max:200000, currency:"VND"}}')

echo "=> Creating appointment"
APPT_RESP=$(curl -sS -X POST "$API_BASE/api/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$APPT_BODY")
echo "$APPT_RESP" | jq '.' || true

APPT_ID=$(echo "$APPT_RESP" | jq -r '._id // .id')
if [ -n "$APPT_ID" ] && [ "$APPT_ID" != "null" ]; then
  echo "Appointment created: $APPT_ID"
  echo "=> Fetching appointment details"
  curl -sS -H "Authorization: Bearer $TOKEN" "$API_BASE/api/appointments/$APPT_ID" | jq '.'
else
  echo "Could not determine appointment id from response" >&2
  exit 1
fi

echo "Done."
