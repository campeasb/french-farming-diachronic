.PHONY: help install dev build lint test

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  install  Install frontend dependencies"
	@echo "  dev      Start dev server on port 8080"
	@echo "  build    Production build"
	@echo "  lint     Run ESLint"
	@echo "  test     Run tests"

install:
	cd frontend && npm install

dev:
	cd frontend && npm run dev

build:
	cd frontend && npm run build
