#!/bin/bash -ex

if [ "${VERIFY_DEP}" == "true" ]; then
    COMMIT=$(cat $(ls ../manifest-artifactory/manifest*.json) | jq -r .ontaskgraph.commit)
    git config --add remote.origin.fetch +refs/pull/*/head:refs/remotes/origin/pull/*
    git fetch
    git checkout $COMMIT
    pushd ../on-tasks
    COMMIT=$(cat $(ls ../manifest-artifactory/manifest*.json) | jq -r .ontasks.commit)
    git config --add remote.origin.fetch +refs/pull/*/head:refs/remotes/origin/pull/*
    git fetch
    git checkout $COMMIT
    rm -rf .git
    popd
    pushd ../on-core
    COMMIT=$(cat $(ls ../manifest-artifactory/manifest*.json) | jq -r .oncore.commit)
    git config --add remote.origin.fetch +refs/pull/*/head:refs/remotes/origin/pull/*
    git fetch
    git checkout $COMMIT
    rm -rf .git
    popd
    mkdir -p node_modules

    # Map on-tasks
    pushd ../
    mkdir -p on-tasks/node_modules
    ln -s $(pwd)/on-tasks $(pwd)/on-taskgraph/node_modules/on-tasks
    ln -s $(pwd)/on-core $(pwd)/on-tasks/node_modules/on-core
    popd
    # Map on-core
    pushd ../
    ln -s $(pwd)/on-core $(pwd)/on-taskgraph/node_modules/on-core
    popd

    # Run npm install for on-tasks and on-core
    pushd ../on-tasks
    npm install
    popd
    pushd ../on-core
    npm install
    popd
fi
