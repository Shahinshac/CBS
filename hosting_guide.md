# Free Hosting Guide: CoreBank Enterprise CBS

This guide details how to deploy the React frontend, NestJS backend, and PostgreSQL database completely for free.

---

## 1. Database Setup (Neon.tech or Supabase)

Since Render's free PostgreSQL databases expire after 90 days, we recommend using **Neon.tech** or **Supabase** for a permanent free-tier PostgreSQL database.

### Neon.tech Setup (Recommended)
1. Go to [Neon.tech](https://neon.tech/) and sign up for a free account.
2. Create a new project. Select **PostgreSQL 16** (or matching version) and name your database (e.g., `corebanking`).
3. Once created, copy the **Connection String** from the dashboard. It will look like this:
   ```env
   postgresql://alex:password@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this connection string as `DATABASE_URL` for the backend deployment.

---

## 2. Backend Deployment (Render)

Render allows you to host Node.js applications on a free web service tier.

1. Create a free account on [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing the codebase.
4. Configure the Web Service settings:
   - **Name**: `corebank-backend`
   - **Runtime**: `Node`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm run start:prod`
5. Add the following **Environment Variables** in the Render settings dashboard:
   - `DATABASE_URL` = (Your connection string from Neon.tech/Supabase)
   - `JWT_SECRET` = (Generate a secure random string)
   - `PORT` = `10000`
6. Click **Deploy Web Service**. Render will build and start your NestJS backend. Note down the backend URL (e.g., `https://corebank-backend.onrender.com`).

---

## 3. Frontend Deployment (Vercel)

Vercel provides free, high-performance static website hosting for React applications.

1. Go to [Vercel](https://vercel.com/) and sign up for a free account.
2. Click **Add New** -> **Project**.
3. Connect your GitHub repository.
4. Select the project directory or configure the project:
   - **Framework Preset**: `Vite` (or `Other` / detect automatically)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add the following **Environment Variable**:
   - `VITE_API_URL` = `https://corebank-backend.onrender.com/api` (Use the URL of your Render backend with `/api` appended)
6. Click **Deploy**. Vercel will build and launch your frontend.

---

## 4. Post-Deployment Database Migration & Seeding

After deploying the database and backend, run the initial migrations and database seeding to populate the tables.

You can run this locally from your machine targeting the Neon database:
1. Open a terminal in the `backend` folder.
2. Run:
   ```bash
   # Linux/macOS
   DATABASE_URL="your-neon-db-connection-string" npx prisma migrate deploy
   DATABASE_URL="your-neon-db-connection-string" npx ts-node prisma/seed.ts

   # Windows (PowerShell)
   $env:DATABASE_URL="your-neon-db-connection-string"
   npx prisma migrate deploy
   npx ts-node prisma/seed.ts
   ```
This will set up all tables and create the default admin credentials on the hosted database!
