HARBOR_REGISTRY ?= harbor.automagistre.ru
TAG ?= latest
IMAGE = $(HARBOR_REGISTRY)/automagistre/backend:$(TAG)

.PHONY: build build-no-cache tag push deploy

# Обычная сборка (кэш ускоряет повторные сборки)
build:
	docker build -t automagistre-backend:$(TAG) .

# Полная пересборка без кэша — когда нужна гарантированно свежая сборка
build-no-cache:
	docker build --no-cache -t automagistre-backend:$(TAG) .

tag: build
	docker tag automagistre-backend:$(TAG) $(IMAGE)

push: tag
	docker push $(IMAGE)

# На сервере: TAG=latest docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
deploy:
	docker compose -f docker-compose.prod.yml pull
	docker compose -f docker-compose.prod.yml up -d
