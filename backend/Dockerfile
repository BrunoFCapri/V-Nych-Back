# Build stage
FROM rust:slim-bookworm as builder

WORKDIR /app

# Copy dependency files
COPY Cargo.toml ./

# Create a dummy main.rs to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies - this will cache them
RUN cargo build --release

# Remove the dummy main.rs
RUN rm -rf src

# Copy the source code
COPY . .

# Build the application
# Use touch main.rs to force rebuild of the project code
RUN touch src/main.rs
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies (OpenSSL is often needed)
RUN apt-get update && apt-get install -y libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder
COPY --from=builder /app/target/release/backend /usr/local/bin/backend

# Copy migrations if needed (backend runs migrations on startup so it needs them)
COPY --from=builder /app/migrations ./migrations

# Expose the port
EXPOSE 3000

# Run the application
CMD ["backend"]
