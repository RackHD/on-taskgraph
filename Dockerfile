# Copyright 2016, EMC, Inc.

FROM rackhd/on-tasks

COPY . /RackHD/on-taskgraph/
WORKDIR /RackHD/on-taskgraph

RUN mkdir -p ./node_modules \
  && ln -s /RackHD/on-core ./node_modules/on-core \
  && ln -s /RackHD/on-core/node_modules/di ./node_modules/di \
  && npm install --ignore-scripts --production \
  && apt-get install -y libsnmp-dev

VOLUME /var/lib/dhcp
CMD [ "node", "/RackHD/on-taskgraph/index.js" ]
