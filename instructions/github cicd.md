# Github CI/CD Pipeline Agent Instructions

Expected CI flow
* Detect source changes and determine modules to build
* Build the module and run tests for all modules that have modifications
* Build docker images for any modules with them and publish to dockerhub if credentials are available. if credentials are not provided then skip the publish step
  * use secrets.DOCKERHUB_USERNAME for the dockerhub username
  * use secrets.DOCKERHUB_TOKEN for the dockerhub password
* build helm charts for any modules with changes
  * when publishing to helm, use the docker hub oci registry oci://registry-1.docker.io/${{ secrets.DOCKERHUB_USERNAME }}
  * artifacthub-repo.yml should use repositoryId: e8350bf2-5554-42ac-ab24-d1e0b34f8825

Expected Release flow
* Upon push to main and succesful ci, tag project and create github release
* publish release version to dockerhub following standards set in ci flow
* publish release version to helm