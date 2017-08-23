#!/bin/bash -ex

if [ "${VERIFY_DEP}" == "true" ]; then
    COMMIT=$(cat $(ls ../manifest-artifactory/manifest*.json) | jq -r .ontaskgraph.commit)
    git config --add remote.origin.fetch +refs/pull/*/head:refs/remotes/origin/pull/*
    git fetch
    git checkout $COMMIT
    export ONTASKS_TAG=$(<../on-tasks-docker/digest)
    sed -i "s/^FROM.*/FROM $REGISTRY\/${REPO_OWNER}\/on-tasks@${ONTASKS_TAG}/" ./Dockerfile
fi
cat Dockerfile
cp -rf * ../build
