#!/bin/bash

# Define proto files to copy
declare -a files=(
    "api/v3/api.proto"
    "submodules/googleapis/google/api/annotations.proto"
    "submodules/googleapis/google/api/http.proto"
)

# Base directories
SRC_DIR="submodules/deps.dev"
DEST_DIR="proto/deps.dev"

# Copy proto files from source to destination
for file in "${files[@]}"; do
    dest_file="$DEST_DIR/$file"
    mkdir -p "$(dirname "$dest_file")"
    cp "$SRC_DIR/$file" "$dest_file"
done
