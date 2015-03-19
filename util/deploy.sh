#!/bin/sh

deployVersion=$1

if [ -z "$deployVersion" ]
then
  echo "Deploy version not specified."
  exit 1
fi

# Build it.
echo "Building IOWA: $deployVersion"
gulp --env prod

echo "Deploying IOWA: $deployVersion"
gcloud preview app deploy dist/backend --project io-webapp \
  --version $deployVersion

# Tag a release.
git tag -a $deployVersion -m 'Release $deployVersion'
git push origin --tags
