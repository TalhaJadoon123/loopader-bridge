# Build stage
FROM rust:1.75 AS builder

WORKDIR /app

# Copy Cargo files
COPY engine/Cargo.toml engine/Cargo.lock ./

# Create dummy source to cache dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

# Copy actual source
COPY engine/src ./src
COPY engine/Cargo.toml engine/Cargo.lock ./

# Build actual binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/loopader-engine /app/engine

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run binary
CMD ["./engine"]