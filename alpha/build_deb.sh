#!/bin/bash -ex

./alpha/set_dependencies.sh

./HWIMO-BUILD
pwd
ls -l
cp *.deb ../build
