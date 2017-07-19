# Copyright 2016, EMC, Inc.

FROM rackhd/on-tasks:devel

COPY . /RackHD/on-taskgraph/
WORKDIR /RackHD/on-taskgraph

RUN mkdir -p ./node_modules \
  && ln -s /RackHD/on-tasks ./node_modules/on-tasks \
  && ln -s /RackHD/on-core ./node_modules/on-core \
  && ln -s /RackHD/on-core/node_modules/di ./node_modules/di \
  && npm install --production \
  && apt-get install -y libsnmp-dev snmp-mibs-downloader snmp \
  && download-mibs \
  && bash build_debug/build_image_info.sh

VOLUME /var/lib/dhcp
CMD [ "node", "/RackHD/on-taskgraph/index.js" ]
