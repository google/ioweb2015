#!/bin/sh

# Copyright 2015 Google Inc. All rights reserved.

deployVersion=$1

if [ -z "$deployVersion" ]
then
  echo "Deploy version not specified."
  exit 1
fi

# Build it.
echo "Building IOWA: $deployVersion"
gulp --env prod
cp backend/server.config.prod dist/backend/server.config

echo "Deploying IOWA: $deployVersion"
gcloud preview app deploy dist/backend --project io-webapp \
  --version $deployVersion

# Tag a release.
git tag -a $deployVersion -m 'Release $deployVersion'
git push origin --tags
