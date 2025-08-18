# Comprehensive Accounting System

This is a comprehensive accounting system built with React, TypeScript, and Supabase. It provides a wide range of features for managing customers, invoices, payments, expenses, and more.

![Version](https://img.shields.io/badge/version-0.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Table of Contents

- [Quick Start](#quick-start)
- [About the Project](#about-the-project)
- [Demo](#demo)
- [Technology Stack](#technology-stack)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation Steps](#1-clone-the-repository)
  - [Building for Production](#6-building-for-production)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/rahmannascenia/accountingBolt.git

# Navigate to the project directory
cd accountingBolt

# Install dependencies
npm install

# Create .env file (copy from example)
cp .env.example .env

# Start development server
npm run dev
```

## About the Project

The Comprehensive Accounting System is a powerful, open-source solution designed to streamline financial management for small and medium-sized businesses. Built with a modern tech stack, this application provides a robust set of features to handle everything from customer and invoice management to complex financial reporting and foreign exchange analysis.

Our goal is to provide a user-friendly and intuitive platform that simplifies the accounting process, allowing business owners and financial professionals to focus on what matters most: growing their business. By leveraging the power of React, TypeScript, and Supabase, we've created a system that is not only fast and reliable but also highly scalable and customizable.

Whether you're a freelancer, a growing startup, or an established business, this Comprehensive Accounting System can be adapted to meet your unique needs. We believe in the power of open-source and encourage contributions from the community to help make this project even better.

## Demo

A live demo of the application is available at: [https://accounting-bolt.example.com](https://accounting-bolt.example.com)

> **Note**: This is a placeholder link. Replace with your actual demo URL when available.

## Technology Stack

- **Frontend**:
  - [React](https://reactjs.org/) - A JavaScript library for building user interfaces
  - [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types
  - [Vite](https://vitejs.dev/) - Next generation frontend tooling
  - [TailwindCSS](https://tailwindcss.com/) - A utility-first CSS framework
  - [Lucide React](https://lucide.dev/) - Beautiful and consistent icon set

- **Backend**:
  - [Supabase](https://supabase.com/) - An open-source Firebase alternative
  - PostgreSQL - Open-source relational database

- **Testing**:
  - [Vitest](https://vitest.dev/) - A Vite-native testing framework
  - [Testing Library](https://testing-library.com/) - Simple and complete testing utilities

## Features

- **Customer Management:** Manage customer information, including contact details, billing addresses, and payment terms.
- **Invoice Management:** Create, send, and track invoices.
- **Payment Management:** Record and track customer payments.
- **Expense Management:** Track business expenses and categorize them for accounting purposes.
- **Bank Account Management:** Manage bank accounts and reconcile transactions.
- **Journal Entry Management:** Create and manage journal entries for manual adjustments.
- **Chart of Accounts Management:** Customize the chart of accounts to fit your business needs.
- **Foreign Exchange (FX) Rate Management:** Manage FX rates for multi-currency transactions.
- **Cash Incentive Management:** Manage cash incentives for customers.
- **Reporting:** Generate a variety of reports, including trial balance, balance sheet, and accounts receivable breakdown.
- **Service Management:** Manage the services you offer to customers.
- **Audit Trail:** Track all changes made to the system for auditing purposes.
- **FX Analysis:** Analyze the impact of foreign exchange rates on your business.
- **User Management:** Manage user access and permissions.

## Getting Started

This guide will walk you through the process of setting up the project on your local machine.

### Prerequisites

Before you begin, make sure you have the following installed on your system:

- **Git:** A version control system for tracking changes in code. You can download it from [https://git-scm.com/](https://git-scm.com/).
- **Node.js:** A JavaScript runtime environment. You can download it from [https://nodejs.org/](https://nodejs.org/).
- **npm:** The Node Package Manager, which is included with Node.js.

### 1. Clone the Repository

First, you need to clone the repository to your local machine. Open your terminal and run the following command:

```bash
git clone https://github.com/rahmannascenia/accountingBolt.git
```

This will create a new directory called `accountingBolt` with all the project files.

### 2. Navigate to the Project Directory

Next, navigate to the newly created project directory:

```bash
cd accountingBolt
```

### 3. Install Dependencies

Now, you need to install all the project dependencies using npm:

```bash
npm install
```

This command will download and install all the necessary packages defined in the `package.json` file.

### 4. Set Up Supabase

This project uses Supabase as its backend. You'll need to create a Supabase project and set up the database.

#### a. Create a Supabase Project

If you don't already have a Supabase account, you can create one for free at [https://supabase.com/](https://supabase.com/). Once you've created an account, create a new project.

#### b. Get Your Supabase Credentials

After creating your project, you'll need to get your Supabase URL and anon key. You can find these in your project's settings under the "API" section.

#### c. Create a `.env` File

In the root of the project directory, create a new file called `.env`. This file will store your Supabase credentials. Add the following lines to the `.env` file, replacing `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual credentials:

```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

#### d. Push Database Migrations

This project includes database migrations that define the database schema. To apply these migrations to your Supabase project, you'll need to use the Supabase CLI.

First, install the Supabase CLI by following the instructions in the [official documentation](https://supabase.com/docs/guides/cli).

Once you have the Supabase CLI installed, you'll need to link your local project to your Supabase project. Run the following command and follow the prompts:

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

You can find your project ID in your Supabase project's settings.

After linking your project, you can push the database migrations to your Supabase project:

```bash
supabase db push
```

This command will apply the migrations in the `supabase/migrations` directory to your Supabase database, creating all the necessary tables and columns.

### 5. Start the Development Server

Now that you've set up the project, you can start the development server:

```bash
npm run dev
```

This will start the development server on `http://localhost:5173`. You can now open your browser and navigate to this URL to see the application in action.

### 6. Building for Production

When you're ready to deploy the application, you can build it for production:

```bash
npm run build
```

This command will create a production-ready build in the `dist` directory.

### 7. Preview the Production Build

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

The project follows a standard React + TypeScript structure:

```
accountingBolt/
├── src/                  # Source code
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and shared code
│   ├── App.tsx           # Main application component
│   └── main.tsx          # Application entry point
├── supabase/             # Supabase related files
│   └── migrations/       # Database migrations
├── public/               # Static assets
├── .env.example          # Example environment variables
└── package.json          # Project dependencies and scripts
```

## Testing

The project uses Vitest for testing. To run the tests:

```bash
npm run test
```

## Development Workflow

1. **Create a Branch**: Always create a new branch for your feature or bugfix
2. **Write Tests**: Write tests for new features or bug fixes
3. **Implement Changes**: Make your changes to the codebase
4. **Run Tests**: Ensure all tests pass
5. **Lint Code**: Run `npm run lint` to check for code style issues
6. **Submit PR**: Push your changes and submit a pull request

## Troubleshooting

### Common Issues

1. **Supabase Connection Issues**
   - Ensure your `.env` file contains the correct Supabase credentials
   - Check if your Supabase project is active

2. **Build Errors**
   - Make sure all dependencies are installed with `npm install`
   - Check for TypeScript errors with `tsc --noEmit`

3. **Database Migrations**
   - If you encounter issues with database migrations, ensure you're using the latest version of the Supabase CLI

## Documentation

For more detailed information about the technologies used in this project, refer to their official documentation:

- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/guide/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

## Contributing

Contributions are welcome! If you'd like to contribute to the project, please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License.
