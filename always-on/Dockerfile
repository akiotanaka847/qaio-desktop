# Qaio Engine — standalone deployment image.
#
# Produces a minimal image that runs the `qaio-engine` binary.
# Typical deployment: VPS (Qaio Always On), behind a reverse proxy with TLS.
#
#   docker build -t qaio/engine:dev -f always-on/Dockerfile .
#   docker run -p 7777:7777 \
#     -e QAIO_BIND_ALL=1 \
#     -e QAIO_BIND=0.0.0.0:7777 \
#     -e QAIO_ENGINE_TOKEN=<your-token> \
#     -v qaio-home:/data/.qaio \
#     -v qaio-docs:/data/Qaio \
#     qaio/engine:dev

# ---------- Build stage ----------
FROM rust:1-slim-bookworm AS build
WORKDIR /src

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Cache the dependency compile by copying the manifests first.
COPY Cargo.toml Cargo.lock ./
COPY engine/ engine/

# Only build the engine server binary — excludes the desktop app crates.
RUN cargo build --release -p qaio-engine-server --bin qaio-engine

# ---------- Runtime stage ----------
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --create-home --home-dir /data qaio

COPY --from=build /src/target/release/qaio-engine /usr/local/bin/qaio-engine

USER qaio
WORKDIR /data
ENV QAIO_HOME=/data/.qaio \
    QAIO_DOCS=/data/Qaio \
    QAIO_BIND=0.0.0.0:7777 \
    QAIO_BIND_ALL=1

EXPOSE 7777
CMD ["/usr/local/bin/qaio-engine"]
