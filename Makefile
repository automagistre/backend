HARBOR_REGISTRY ?= harbor.automagistre.ru
TAG ?= latest
IMAGE = $(HARBOR_REGISTRY)/automagistre/backend:$(TAG)

.PHONY: build tag push

build:
	docker build -t automagistre-backend:$(TAG) .

tag: build
	docker tag automagistre-backend:$(TAG) $(IMAGE)

push: tag
	docker push $(IMAGE)
