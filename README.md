# Project API - Local Development Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 20.x
- Yarn
- Git

## 1. Clone the Repository

```sh
git clone git@github.com:TAI-trustworthy-ai-lab/backend.git
cd api
```

## 2. Create the `.env.local` File

Create a file named `.env.local` inside the `config` folder (`config/.env.local`) with the following content:

```env
NODE_ENV=development
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=project_dev
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public
JWT_SECRET=your_secret_key
API_URL=http://localhost:3001
PORT=3001
```

- Replace `your_secret_key` with a secure random string.
- This file is used to configure both the API and the database.

## 3. Start the Database and API (with Docker Compose)

Launch the development environment using your `.env.local` file:

```sh
docker-compose --env-file config/.env.local up -d
```

**What happens:**
- The database and API containers are started.
- The database is initialized with the name from `DB_NAME` (`project_dev` by default).
- The API uses the environment variables from your `.env.local`.

## 4. Volumes and Hot Reload

- The source code is mounted as a Docker volume (`.:/app`), so any changes you make to your code are instantly reflected inside the running container.
- Hot reload is enabled: when you edit files in `src/`, the API server automatically restarts and applies your changes.
- Node modules are mounted separately to avoid conflicts (`/app/node_modules`).

**Why is this important?**
- You can develop locally inside Docker without rebuilding the image for every change.
- Your database data is persisted in a Docker volume (`project-db-data`), so it survives container restarts.

## 5. Access the Services

- API: [http://localhost:3001](http://localhost:3001)
- Prisma Studio: [http://localhost:5555](http://localhost:5555)

## 6. Useful Commands

- View API logs:  
  ```sh
  docker-compose logs -f api
  ```
- Apply database migrations:  
  ```sh
  yarn prisma migrate dev
  ```

---

**Summary:**  
- Put your `.env.local` in the `config` folder.
- Start everything with `docker-compose --env-file config/.env.local up -d`.
- Edit code and see changes live thanks to hot reload and Docker volumes.