#!/bin/sh

# Ensure we're always in the right directory.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd $SCRIPT_DIR/..

rm -rf *.deb deb/
rm -rf node_modules/
rm -rf test/
rm commitstring.txt
rm -rf on-taskgraph*.tar.gz*
rm -rf *.build
rm -rf packagebuild/
