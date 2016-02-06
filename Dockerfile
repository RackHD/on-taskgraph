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

RUN apk add --update dhcp

EXPOSE 67
EXPOSE 67/udp

RUN touch /var/lib/dhcp/dhcpd.leases

CMD [ "/RackHD/on-taskgraph/docker_entry.sh" ]
