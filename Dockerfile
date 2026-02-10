FROM node:20-slim

RUN apt-get update && apt-get install -y \
    bash \
    git \
    curl \
    jq \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN groupadd -r ralph && useradd -r -g ralph -m -s /bin/bash ralph

WORKDIR /workspace

# Ensure scripts are executable
RUN mkdir -p /workspace/scripts/ralph /workspace/logs

# Switch to non-root user
USER ralph

ENTRYPOINT ["bash"]
