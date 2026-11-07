# =============================================================================
# Cervos Pharmacy OS — Tauri + Next.js Docker Build
# Platform: Android (aarch64)
# Based on: ghcr.io/tauri-apps/tauri-stable:node18-debian
# =============================================================================
FROM ghcr.io/tauri-apps/tauri-stable:node18-debian AS builder

# Set working directory
WORKDIR /app

# Copy project files (relative to where docker build is run)
COPY cervos-desktop/ .

# Install dependencies
RUN npm ci

# Install Tauri CLI (already included in the base image, but ensure latest)
RUN cargo install --locked tauri-cli@2

# Build Next.js application
RUN npx next build

# Build Android APK (release, aarch64)
RUN tauri android build --target aarch64

# =============================================================================
# Optional: Export the built APK and dist for use outside the container
# =============================================================================
# The APK will be at: cervos-desktop/src-tauri/target/aarch64-unknown-linux-android/debug/app-release.apk
# Or: cervos-desktop/src-tauri/target/release/app-release.apk (release build)

# Next.js static/SSR output at: cervos-desktop/dist/
# .next/ directory contains the server build

# To use outside container, mount volumes or copy after run:
#   docker cp cervos-build:/app/cervos-desktop/src-tauri/target/...
#   docker cp cervos-build:/app/cervos-desktop/dist/...