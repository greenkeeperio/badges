FROM mhart/alpine-node:7

ARG PKG_VERSION
ADD greenkeeper-badges-${PKG_VERSION}.tgz ./
WORKDIR /package

ENV PORT 5000
EXPOSE 5000

CMD ["npm", "start"]
