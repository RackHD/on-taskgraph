#!/bin/bash

# This has to be kept in sync with .travis.yml packages to
# be effective.

echo "Installing system dependencies"
sudo apt-get update
sudo apt-get install -y \
    debhelper \
    default-jdk \
    devscripts \
    dh-make \
    git \
    libkrb5-dev \
    nodejs \
    nodejs-legacy \
    npm \
    rabbitmq-server \
    pbuilder \
    ubuntu-dev-tools
