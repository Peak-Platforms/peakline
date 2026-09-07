#!/bin/bash
# Run this ONCE, after you have a Daily API key with a card on file.
# It hides Daily's own branding for every room on your domain going forward —
# no need to repeat this per room.

if [ -z "$1" ]; then
  echo "Usage: ./setup-branding.sh YOUR_DAILY_API_KEY"
  exit 1
fi

curl --request POST \
  --url https://api.daily.co/v1/ \
  --header "Authorization: Bearer $1" \
  --header "Content-Type: application/json" \
  --data '{"properties":{"hide_daily_branding": true}}'

echo ""
echo "Done — Daily's branding is now hidden domain-wide."
