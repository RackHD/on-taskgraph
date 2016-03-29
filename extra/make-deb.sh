#!/bin/bash

# Ensure we're always in the right directory.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd $SCRIPT_DIR/..

BRANCH=$(git symbolic-ref --short -q HEAD)

if [ -z "$DEBFULLNAME" ]; then
        export DEBFULLNAME=`git log -n 1 --pretty=format:%an`
fi

if [ -z "$DEBEMAIL" ]; then
        export DEBEMAIL=`git log -n 1 --pretty=format:%ae`
fi

if [ -z "$DEBBRANCH" ]; then
        export DEBBRANCH=`echo "${BRANCH}" | sed 's/[\/\_]/-/g'`
fi

if [ -z "$DEBPKGVER" ]; then
  export DEBPKGVER=`git log -n 1 --pretty=oneline --abbrev-commit`
fi

if [ -z "$DCHOPTS" ]; then
        export DCHOPTS="-l ${DEBBRANCH} -u low ${DEBPKGVER}"
fi

echo "DEBDIR:       $DEBDIR"
echo "DEBFULLNAME:  $DEBFULLNAME"
echo "DEBEMAIL:     $DEBEMAIL"
echo "DEBBRANCH:    $DEBBRANCH"
echo "DEBPKGVER:    $DEBPKGVER"
echo "DCHOPTS:      $DCHOPTS"


if [ -d packagebuild ]; then
  rm -rf packagebuild
fi

git clone . packagebuild
pushd packagebuild
rm -rf node_modules
npm install --production
git log -n 1 --pretty=format:%h.%ai.%s > commitstring.txt
dch ${DCHOPTS}
debuild --no-lintian --no-tgz-check -us -uc
popd
if [ ! -d deb ]; then
  mkdir deb
fi 

cp -a *.deb deb/
