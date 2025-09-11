#!/bin/bash

# Solana Token Tracker Startup Script
echo "🚀 Starting Solana Token Tracker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your API keys before continuing."
    echo "🔑 Required: HELIUS_API_KEY"
    echo "🔑 Optional: JUPITER_API_KEY, BIRDEYE_API_KEY"
    read -p "Press Enter after configuring .env file..."
fi

# Create logs directory
mkdir -p logs

# Start database and services
echo "🐘 Starting PostgreSQL database..."
docker-compose up -d postgres pgadmin redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check database health
echo "🔍 Checking database health..."
until docker-compose exec -T postgres pg_isready -U postgres -d solana_tokens; do
    echo "⏳ Database not ready yet, waiting..."
    sleep 5
done

echo "✅ Database is ready!"

# Run database migrations
echo "🗄️  Running database migrations..."
npm run migrate

# Start the application
echo "🚀 Starting Node.js application..."
docker-compose up -d app

# Wait for app to be ready
echo "⏳ Waiting for application to be ready..."
sleep 15

# Check application health
echo "🔍 Checking application health..."
until curl -f http://localhost:3000/health > /dev/null 2>&1; do
    echo "⏳ Application not ready yet, waiting..."
    sleep 5
done

echo "✅ Application is ready!"

# Show status
echo ""
echo "🎉 Solana Token Tracker is now running!"
echo ""
echo "📊 API: http://localhost:3000"
echo "🔌 WebSocket: ws://localhost:3000/ws"
echo "🐘 Database: localhost:5432"
echo "📊 pgAdmin: http://localhost:5050 (admin@admin.com / admin)"
echo "🔴 Redis: localhost:6379"
echo ""
echo "📝 Logs are available in the ./logs directory"
echo "🛑 To stop: docker-compose down"
echo "🔄 To restart: ./start.sh"
echo ""
echo "🔍 Monitoring services:"
docker-compose ps
