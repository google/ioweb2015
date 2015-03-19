#!/bin/sh

deployVersion=$1

if [ -z "$deployVersion" ]
then
  echo "Deploy version not specified."
  exit 1
fi

echo "Building IOWA: $deployVersion"
gcloud config set project io-webapp
gulp --env prod

echo "Deploying IOWA: $deployVersion"
gcloud preview app deploy dist/backend --version $deployVersion

# Create release tag.
git tag -a $deployVersion -m 'Release $deployVersion'
git push origin --tags

# Reset to staging.
gcloud config set project io-webapp-staging
