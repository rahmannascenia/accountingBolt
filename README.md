# Comprehensive Accounting System

This is a comprehensive accounting system built with React, TypeScript, and Supabase. It provides a wide range of features for managing customers, invoices, payments, expenses, and more.

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

To get started with the project, you'll need to have the following installed:

- Node.js
- npm

You'll also need to create a Supabase project and set up the database schema. You can find the database schema in the `supabase/migrations` directory.

Once you've created your Supabase project, you'll need to create a `.env` file in the root of the project and add the following environment variables:

```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

You can then install the project dependencies and start the development server:

```
npm install
npm run dev
```

This will start the development server on `http://localhost:5173`.

## Contributing

Contributions are welcome! If you'd like to contribute to the project, please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License.
