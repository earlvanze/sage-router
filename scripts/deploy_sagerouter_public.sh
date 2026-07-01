#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT}/web"

PAGES_PROJECT="${SAGEROUTER_CLOUDFLARE_PAGES_PROJECT:-sage-router-web}"
PAGES_PRODUCTION_BRANCH="${SAGEROUTER_CLOUDFLARE_PAGES_PRODUCTION_BRANCH:-main}"
DEPLOY_PAGES="${SAGEROUTER_DEPLOY_PAGES:-1}"
DEPLOY_CLOUD_RUN="${SAGEROUTER_DEPLOY_CLOUD_RUN:-0}"
RUN_READINESS="${SAGEROUTER_DEPLOY_RUN_READINESS:-1}"
REQUIRE_ALL_EDGE_UPSTREAMS="${SAGEROUTER_DEPLOY_REQUIRE_ALL_EDGE_UPSTREAMS:-1}"
GHCR_IMAGE_DIGEST="${GHCR_IMAGE_DIGEST:-${SAGEROUTER_GHCR_IMAGE_DIGEST:-}}"
API_BASE="${SAGEROUTER_API_BASE_URL:-https://api.sagerouter.dev}"
POST_DEPLOY_WARMUP_ATTEMPTS="${SAGEROUTER_POST_DEPLOY_WARMUP_ATTEMPTS:-18}"
POST_DEPLOY_WARMUP_DELAY_SECONDS="${SAGEROUTER_POST_DEPLOY_WARMUP_DELAY_SECONDS:-5}"
CLOUD_RUN_DEPLOYED=0

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 2
  fi
}

git_value() {
  git -C "$ROOT" "$@" 2>/dev/null || true
}

resolve_release_digest_from_actions() {
  require_cmd gh
  require_cmd jq
  local run_id digest target_sha runs_json
  target_sha="$(git_value rev-parse HEAD)"
  runs_json="$(
    gh run list \
      --repo earlvanze/sage-router \
      --workflow "Release image" \
      --limit 20 \
      --json databaseId,conclusion,headSha,createdAt
  )"
  if [[ -n "$target_sha" ]]; then
    run_id="$(
      jq -r --arg sha "$target_sha" '.[] | select(.conclusion == "success" and .headSha == $sha) | .databaseId' <<<"$runs_json" \
        | head -n1
    )"
  else
    run_id=""
  fi
  if [[ -z "$run_id" ]]; then
    run_id="$(
      jq -r '.[] | select(.conclusion == "success") | .databaseId' <<<"$runs_json" \
        | head -n1
    )"
  fi
  if [[ -z "$run_id" ]]; then
    return 1
  fi
  digest="$(
    gh run view "$run_id" --repo earlvanze/sage-router --log \
      | sed -n 's/.*"containerimage.digest": "\(sha256:[0-9a-f]\{64\}\)".*/\1/p' \
      | tail -n1
  )"
  [[ -n "$digest" ]] || return 1
  printf '%s\n' "$digest"
}

deploy_pages() {
  require_cmd npm
  require_cmd npx

  local tmp commit_hash commit_message
  tmp="$(mktemp -d /tmp/sage-router-web.XXXXXX)"
  commit_hash="$(git_value rev-parse HEAD)"
  commit_message="$(git_value log -1 --pretty=%s)"

  printf 'Building Cloudflare Pages from clean temp copy: %s\n' "$tmp" >&2
  (
    cd "$WEB_DIR"
    tar \
      --exclude='./node_modules' \
      --exclude='./dist' \
      --exclude='./.wrangler' \
      -cf - .
  ) | tar -xf - -C "$tmp"

  (
    cd "$tmp"
    npm ci
    npm run build
    if [[ -d functions ]]; then
      npx wrangler pages functions build functions \
        --outdir dist/_worker.js \
        --output-routes-path dist/_routes.json \
        --build-output-directory dist
    fi
  )

  printf 'Deploying Cloudflare Pages project=%s branch=%s\n' "$PAGES_PROJECT" "$PAGES_PRODUCTION_BRANCH" >&2
  local wrangler_args=(
    pages deploy "$tmp/dist"
    --project-name "$PAGES_PROJECT"
    --branch "$PAGES_PRODUCTION_BRANCH"
    --commit-dirty=true
  )
  if [[ -n "$commit_hash" ]]; then
    wrangler_args+=(--commit-hash "$commit_hash")
  fi
  if [[ -n "$commit_message" ]]; then
    wrangler_args+=(--commit-message "$commit_message")
  fi
  npx wrangler "${wrangler_args[@]}"
}

deploy_cloud_run() {
  if [[ -z "$GHCR_IMAGE_DIGEST" ]]; then
    printf 'GHCR_IMAGE_DIGEST not set; resolving latest successful Release image digest from GitHub Actions.\n' >&2
    GHCR_IMAGE_DIGEST="$(resolve_release_digest_from_actions || true)"
  fi
  if [[ -z "$GHCR_IMAGE_DIGEST" ]]; then
    printf 'Could not resolve GHCR image digest. Set GHCR_IMAGE_DIGEST=sha256:... and retry.\n' >&2
    exit 2
  fi

  printf 'Deploying Cloud Run from GHCR digest %s\n' "$GHCR_IMAGE_DIGEST" >&2
  DEPLOY_FROM_GHCR_REMOTE=1 GHCR_IMAGE_DIGEST="$GHCR_IMAGE_DIGEST" \
    bash "$ROOT/deploy/gcp/cloudrun-deploy.sh"
  CLOUD_RUN_DEPLOYED=1
}

http_code_to_file() {
  local url="$1"
  shift
  curl -sS -o /tmp/sage-router-deploy-warmup-body -w '%{http_code}' "$url" "$@"
}

wait_for_public_edge_after_cloud_run_deploy() {
  require_cmd curl
  require_cmd jq

  local attempt health_code health_ok pricing_code catalog_code webhook_code webhook_error
  for attempt in $(seq 1 "$POST_DEPLOY_WARMUP_ATTEMPTS"); do
    health_code="$(http_code_to_file "${API_BASE%/}/edge/health")"
    health_ok="$(jq -r '.status == "ok" and (.failover.controlPlanePinned == true)' /tmp/sage-router-deploy-warmup-body 2>/dev/null || true)"

    pricing_code="$(http_code_to_file "${API_BASE%/}/pricing")"
    catalog_code="$(http_code_to_file "${API_BASE%/}/model-catalog")"
    webhook_code="$(http_code_to_file "${API_BASE%/}/billing/stripe/webhook" \
      -H "Content-Type: application/json" \
      --data '{"id":"evt_deploy_warmup_unsigned","type":"deploy.warmup"}')"
    webhook_error="$(jq -r '.error // empty' /tmp/sage-router-deploy-warmup-body 2>/dev/null || true)"

    if [[ "$health_code" == "200" && "$health_ok" == "true" && "$pricing_code" == "200" && "$catalog_code" == "200" && "$webhook_code" == "400" && "$webhook_error" == "invalid_signature" ]]; then
      rm -f /tmp/sage-router-deploy-warmup-body
      printf 'Post-deploy public edge warmup passed after %s attempt(s).\n' "$attempt" >&2
      return 0
    fi

    printf 'Waiting for public edge warmup attempt %s/%s: health=%s controlPlanePinned=%s pricing=%s modelCatalog=%s stripeWebhook=%s/%s\n' \
      "$attempt" "$POST_DEPLOY_WARMUP_ATTEMPTS" "$health_code" "${health_ok:-missing}" "$pricing_code" "$catalog_code" "$webhook_code" "${webhook_error:-missing}" >&2
    if [[ "$attempt" -lt "$POST_DEPLOY_WARMUP_ATTEMPTS" ]]; then
      sleep "$POST_DEPLOY_WARMUP_DELAY_SECONDS"
    fi
  done

  rm -f /tmp/sage-router-deploy-warmup-body
  printf 'Post-deploy public edge warmup failed after %s attempt(s).\n' "$POST_DEPLOY_WARMUP_ATTEMPTS" >&2
  return 1
}

if [[ "$DEPLOY_PAGES" != "0" ]]; then
  deploy_pages
else
  printf 'Skipping Cloudflare Pages deploy because SAGEROUTER_DEPLOY_PAGES=0\n' >&2
fi

if [[ "$DEPLOY_CLOUD_RUN" == "1" || -n "$GHCR_IMAGE_DIGEST" ]]; then
  deploy_cloud_run
else
  printf 'Skipping Cloud Run deploy. Set SAGEROUTER_DEPLOY_CLOUD_RUN=1 or GHCR_IMAGE_DIGEST=sha256:... to update it.\n' >&2
fi

if [[ "$RUN_READINESS" != "0" ]]; then
  if [[ "$CLOUD_RUN_DEPLOYED" == "1" ]]; then
    wait_for_public_edge_after_cloud_run_deploy
  fi
  if [[ -z "${SAGEROUTER_MIN_HEALTHY_UPSTREAMS:-}" && "$REQUIRE_ALL_EDGE_UPSTREAMS" != "0" && "$API_BASE" == "https://api.sagerouter.dev" ]]; then
    export SAGEROUTER_MIN_HEALTHY_UPSTREAMS=all
    export SAGEROUTER_EDGE_HEALTH_RETRY_ATTEMPTS="${SAGEROUTER_EDGE_HEALTH_RETRY_ATTEMPTS:-12}"
    export SAGEROUTER_EDGE_HEALTH_RETRY_DELAY_SECONDS="${SAGEROUTER_EDGE_HEALTH_RETRY_DELAY_SECONDS:-5}"
    export SAGEROUTER_EDGE_HEALTH_STABLE_ATTEMPTS="${SAGEROUTER_EDGE_HEALTH_STABLE_ATTEMPTS:-2}"
    printf 'Requiring all configured public edge upstreams healthy for production deploy readiness with a stable recovery window. Set SAGEROUTER_DEPLOY_REQUIRE_ALL_EDGE_UPSTREAMS=0 or SAGEROUTER_MIN_HEALTHY_UPSTREAMS=N to override.\n' >&2
  fi
  "$ROOT/scripts/check_sagerouter_launch_readiness.sh"
else
  printf 'Skipping launch readiness because SAGEROUTER_DEPLOY_RUN_READINESS=0\n' >&2
fi
