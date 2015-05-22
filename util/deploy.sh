#!/bin/sh

# Copyright 2015 Google Inc. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

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
