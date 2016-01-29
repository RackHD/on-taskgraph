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
RUN cp -a /tmp/node_modules /RackHD/on-taskgraph/

RUN apt-get update && apt-get install -y isc-dhcp-server

ENV dhcpGateway $dhcpGateway

EXPOSE 67
EXPOSE 67/udp

ENTRYPOINT [ "/RackHD/on-taskgraph/docker_entry.sh" ]
