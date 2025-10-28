# Project Overview

This project is a self-hosted platform called "Claude Code Service" for triggering code executions via webhooks. It features both single-agent and multi-agent workflow capabilities. The project is a monorepo with a client-server architecture.

**Key Technologies:**

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, tRPC
*   **Backend:** Node.js, Express, TypeScript, tRPC, Drizzle ORM
*   **Database:** MySQL/TiDB
*   **Containerization:** Docker

**Architecture:**

The application consists of a React-based frontend and a Node.js backend. The backend exposes a tRPC API for the frontend and webhook endpoints for external integrations. It uses Docker to run code executions in isolated containers. A MySQL or TiDB database is used for data persistence.

# Building and Running

**Prerequisites:**

*   Node.js 22+
*   Docker
*   MySQL/TiDB database
*   Claude Code Max plan (for authentication)

**Installation:**

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Set up environment variables:**

    Create a `.env` file in the root directory and add the following variables:
    ```
    DATABASE_URL="mysql://user:password@host:port/database"
    JWT_SECRET="your-jwt-secret"
    OAUTH_SERVER_URL="your-oauth-server-url"
    VITE_APP_TITLE="Claude Code Service"
    VITE_APP_LOGO="your-logo-url"
    ```

3.  **Push database schema:**
    ```bash
    pnpm db:push
    ```

**Running the application:**

*   **Development:**
    ```bash
    pnpm dev
    ```
    This will start the development server with hot-reloading. The application will be available at `http://localhost:3000`.

*   **Production:**
    ```bash
    pnpm build
    pnpm start
    ```
    This will build the application for production and start the server.

**Testing:**

*   **Run tests:**
    ```bash
    pnpm test
    ```

*   **Type-checking:**
    ```bash
    pnpm check
    ```

# Development Conventions

*   **Code Style:** The project uses Prettier for code formatting. You can format the code by running:
    ```bash
    pnpm format
    ```

*   **Testing:** The project uses Vitest for testing. Tests are located in the `__tests__` directories.

*   **Commits:** (No information on commit conventions was found in the provided files.)

*   **Branching:** (No information on branching strategy was found in the provided files.)
