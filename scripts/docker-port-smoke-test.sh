#!/bin/bash

# Integration smoke test for dynamic PORT binding in the production Docker
# image (issue #46 / specs/dynamic-port-binding.md). Builds the production
# stage once, then runs it twice:
#
#   Scenario 1 (default): no PORT set        -> must listen on 8080
#   Scenario 2 (injected): PORT=3000          -> must listen on 3000
#
# For each scenario, this asserts:
#   - a curl from the host to the host-mapped port returns HTTP 200
#   - `docker inspect --format='{{.State.Health.Status}}'` reports "healthy"
#
# Host ports are allocated dynamically (`-p 127.0.0.1::<container_port>`)
# rather than fixed, so the script can't collide with anything already
# listening on 8080/3000 on the host/CI runner. All containers/images it
# creates are removed on exit, success or failure.
#
# Usage: scripts/docker-port-smoke-test.sh [path/to/Dockerfile]

DOCKERFILE="${1:-Dockerfile}"
CONTEXT_DIR="$(dirname "$DOCKERFILE")"
RUN_ID="$$-$(date +%s)"
IMAGE_TAG="d2s-port-smoke-test:${RUN_ID}"
CONTAINER_DEFAULT="d2s-port-smoke-default-${RUN_ID}"
CONTAINER_INJECTED="d2s-port-smoke-injected-${RUN_ID}"
HEALTH_TIMEOUT_SECS=60

cleanup() {
  echo "🧹 Cleaning up smoke-test containers/image..."
  docker rm -f "$CONTAINER_DEFAULT" "$CONTAINER_INJECTED" >/dev/null 2>&1
  docker rmi -f "$IMAGE_TAG" >/dev/null 2>&1
  true
}
trap cleanup EXIT

fail() {
  echo "❌ $1"
}

if [ ! -f "$DOCKERFILE" ]; then
  fail "$DOCKERFILE not found"
  exit 1
fi

echo "🏗️  Building production image from $DOCKERFILE (tag: $IMAGE_TAG)..."
if ! docker build --target production -f "$DOCKERFILE" -t "$IMAGE_TAG" "$CONTEXT_DIR"; then
  fail "docker build failed"
  exit 1
fi

# Waits until `docker inspect`'s health status is "healthy", or times out.
# Returns 0 on healthy, 1 on unhealthy/timeout.
wait_for_health() {
  container="$1"
  waited=0
  status=""

  while [ "$waited" -lt "$HEALTH_TIMEOUT_SECS" ]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null)

    if [ "$status" = "healthy" ]; then
      return 0
    fi

    if [ "$status" = "unhealthy" ]; then
      fail "$container reported unhealthy health status"
      docker logs "$container" 2>&1 || true
      return 1
    fi

    sleep 1
    waited=$((waited + 1))
  done

  fail "timed out after ${HEALTH_TIMEOUT_SECS}s waiting for $container to become healthy (last status: '${status}')"
  docker logs "$container" 2>&1 || true
  return 1
}

# Runs one scenario: starts a container, waits for it to be healthy, curls
# its dynamically-mapped host port, and asserts HTTP 200 + healthy status.
# Args: description, container name, container-side port, extra `docker run` flags...
run_scenario() {
  description="$1"
  container="$2"
  container_port="$3"
  shift 3

  echo ""
  echo "▶️  Scenario: $description"

  if ! docker run -d --name "$container" -p "127.0.0.1::${container_port}" "$@" "$IMAGE_TAG" >/dev/null; then
    fail "docker run failed for $container"
    return 1
  fi

  host_port=$(docker port "$container" "${container_port}/tcp" 2>/dev/null | head -n1 | sed -E 's/.*:([0-9]+)$/\1/')
  if [ -z "$host_port" ]; then
    fail "could not determine host port mapped to container port ${container_port} for $container"
    return 1
  fi
  echo "   container port ${container_port} mapped to host port ${host_port}"

  if ! wait_for_health "$container"; then
    return 1
  fi

  http_code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${host_port}/")
  echo "   GET http://localhost:${host_port}/ -> HTTP ${http_code}"
  if [ "$http_code" != "200" ]; then
    fail "expected HTTP 200 from http://localhost:${host_port}/, got ${http_code}"
    return 1
  fi

  health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container")
  echo "   health status: ${health_status}"
  if [ "$health_status" != "healthy" ]; then
    fail "expected health status 'healthy', got '${health_status}'"
    return 1
  fi

  echo "✅ $description passed"
  return 0
}

FAILED=0

run_scenario "default port (PORT unset) -> listens on 8080" \
  "$CONTAINER_DEFAULT" 8080 || FAILED=1

run_scenario "injected port (PORT=3000) -> listens on 3000" \
  "$CONTAINER_INJECTED" 3000 -e PORT=3000 || FAILED=1

echo ""
if [ "$FAILED" -ne 0 ]; then
  fail "Docker port smoke test FAILED"
  exit 1
fi

echo "🎉 Docker port smoke test PASSED (both scenarios)"
