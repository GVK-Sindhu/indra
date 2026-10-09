# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY apps/backend-python/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY apps/backend-python/app ./app
COPY apps/backend-python/uploads ./uploads

# Copy pre-built frontend distribution
COPY apps/frontend/dist ./apps/frontend/dist

# Environment variables
ENV PORT=5000
ENV SEED_DB=true
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-5000}"]
