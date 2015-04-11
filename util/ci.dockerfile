FROM buildpack-deps

RUN apt-get update -qq && apt-get install -qqy locales
RUN localedef -i en_US -f UTF-8 en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

RUN apt-get install -y \
	ca-certificates curl python-pip gcc libc6-dev make \
	bzr git mercurial \
	--no-install-recommends
RUN pip install docker-py

ENV CLOUDSDK_CORE_DISABLE_PROMPTS=1
ENV CLOUDSDK_PYTHON_SITEPACKAGES=1
ADD https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.tar.gz /gcloud.tar.gz
RUN mkdir /gcloud && \
  tar -xzf /gcloud.tar.gz --strip 1 -C /gcloud && \
  /gcloud/install.sh && \
  /gcloud/bin/gcloud components update app -q && \
  rm -f /gcloud.tar.gz
ENV PATH=/gcloud/bin:$PATH

ENV NODE_VERSION 0.10.38
ENV NPM_VERSION 2.7.3
# verify gpg and sha256: http://nodejs.org/dist/v0.10.31/SHASUMS256.txt.asc
# gpg: aka "Timothy J Fontaine (Work) <tj.fontaine@joyent.com>"
# gpg: aka "Julien Gilli <jgilli@fastmail.fm>"
RUN gpg --keyserver pool.sks-keyservers.net --recv-keys 7937DFD2AB06298B2293C3187D33FF9D0246406D 114F43EE0176B71C7BC219DD50A3051F888C628D

RUN curl -SLO "http://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
	&& curl -SLO "http://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
	&& gpg --verify SHASUMS256.txt.asc \
	&& grep " node-v$NODE_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
	&& tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
	&& rm "node-v$NODE_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc \
	&& npm install -g npm@"$NPM_VERSION" \
	&& npm cache clear

RUN npm install -g gulp bower

ENV GOLANG_VERSION 1.4.2

RUN curl -sSL https://golang.org/dl/go$GOLANG_VERSION.src.tar.gz \
		| tar -C /usr/src -xz

RUN cd /usr/src/go/src && ./make.bash --no-clean > /dev/null

ENV PATH /usr/src/go/bin:$PATH

RUN mkdir -p /go/src
ENV GOPATH /go
ENV PATH /go/bin:$PATH
WORKDIR /go

