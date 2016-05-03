#!/bin/bash

# This creates a package in a manner similar to
# HWIMO-BUILD: datestring package version, apidoc
# no coveralls. But it also utilizes build-package.bash
# similar to how travis-ci does.

# Ensure we're always in the right directory.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd $SCRIPT_DIR/..

export DEBEMAIL="hwimo robots <hwimo@hwimo.lab.emc.com>"
export DEBFULLNAME="The HWIMO Robots"

GITCOMMITDATE=$(git show -s --pretty="format:%ci")
DATESTRING=$(date -d "$GITCOMMITDATE" -u +"%Y-%m-%d-%H%M%SZ")

export DEBPKGVER="$DATESTRING"
if [ -n "$BUILD_NUMBER" ]
then
  export DEBPKGVER="${DEBPKGVER}-${BUILD_NUMBER}"
fi

export DCHOPTS="-v ${DEBPKGVER} autobuild"

./extra/make-npmdeps.sh 
./extra/make-deb.sh

