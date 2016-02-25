# Copyright 2016, EMC, Inc.

FROM rackhd/on-core

RUN mkdir -p /RackHD/on-taskgraph
WORKDIR /RackHD/on-taskgraph

COPY ./package.json /tmp/
RUN cd /tmp \
  && ln -s /RackHD/on-core /tmp/node_modules/on-core \
  && ln -s /RackHD/on-core/node_modules/di /tmp/node_modules/di \
  && npm install --ignore-scripts --production

COPY . /RackHD/on-taskgraph/
RUN cp -a -f /tmp/node_modules /RackHD/on-taskgraph/

VOLUME /var/lib/dhcp

CMD [ "node", "/RackHD/on-taskgraph/index.js" ]
