# Full-Stack Accounting System

A comprehensive accounting system built with **D1 Database**, **Hono Framework**, and **React** with full admin management capabilities.

## 🚀 Technology Stack

### Backend
- **[Hono](https://hono.dev/)** - Modern, lightweight web framework
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - SQLite-based edge database
- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Serverless runtime

### Frontend
- **[React](https://reactjs.org/)** - Frontend framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[React Query](https://tanstack.com/query)** - Server state management
- **[React Router](https://reactrouter.com/)** - Client-side routing

### Authentication & Security
- **JWT-based authentication** - Secure token-based auth
- **Role-based access control** - Admin, Manager, Accountant, User roles
- **Password hashing** - bcrypt for secure password storage
- **Rate limiting** - API protection
- **Audit logging** - Track all system changes

## 📋 Features

### Core Accounting Features
- ✅ **Customer Management** - Complete customer CRUD operations
- ✅ **Invoice Management** - Create, track, and manage invoices
- ✅ **Chart of Accounts** - Flexible accounting structure
- ✅ **Payment Tracking** - Record and apply payments
- ✅ **Vendor/Bills Management** - Accounts payable
- ✅ **Journal Entries** - Manual accounting adjustments
- ✅ **Financial Reports** - Trial balance, P&L, Balance sheet

### Admin Management Features
- ✅ **User Management** - Create and manage system users
- ✅ **Role-Based Permissions** - Granular access control
- ✅ **Admin Dashboard** - System overview and statistics  
- ✅ **Audit Trail** - Complete system activity logging
- ✅ **System Monitoring** - Track performance and usage

### Technical Features
- ✅ **Full-stack TypeScript** - End-to-end type safety
- ✅ **RESTful API** - Clean, documented API endpoints
- ✅ **Real-time Updates** - Optimistic UI updates
- ✅ **Responsive Design** - Mobile-friendly interface
- ✅ **Error Handling** - Comprehensive error management
- ✅ **Data Validation** - Client and server-side validation

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Cloudflare account (for deployment)

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
```bash
# Create D1 database (requires Cloudflare account)
npx wrangler d1 create accounting-system

# Update wrangler.toml with your database ID

# Run migrations
npm run db:migrate:local
```

### 3. Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Update .env with your configuration
```

### 4. Development Server
```bash
# Start the backend API
npm run dev

# In another terminal, start the frontend
npm run frontend:dev
```

### 5. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8787
- **Default Admin**: admin@accounting.com / admin123

## 📁 Project Structure

```
accounting-system-d1-hono/
├── src/                      # Backend Hono API
│   ├── routes/              # API route handlers
│   ├── middleware/          # Authentication, CORS, rate limiting
│   ├── utils/              # Database utilities, auth helpers
│   ├── types/              # TypeScript type definitions
│   └── index.ts            # Main Hono application
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts (Auth, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # API client, utilities
│   │   └── types/          # Frontend type definitions
│   └── index.html         # Main HTML template
├── migrations/            # Database schema migrations
├── backup/               # Backup of original project
├── wrangler.toml        # Cloudflare Workers configuration
├── package.json         # Project dependencies and scripts
└── README.md           # This file
```

## 🔐 User Roles & Permissions

### Admin
- **Full system access** - All features and user management
- **User Management** - Create, update, delete users
- **System Settings** - Configure system preferences
- **Audit Access** - View all system activity

### Manager  
- **Business Operations** - Customers, invoices, payments
- **User Management** - Limited user operations
- **Reports Access** - All financial reports
- **Admin Dashboard** - System overview

### Accountant
- **Core Accounting** - Invoices, customers, payments
- **Journal Entries** - Manual accounting adjustments
- **Reports Access** - Financial reports and analysis
- **Data Entry** - Create and modify records

### User
- **View Access** - Read-only access to assigned records
- **Limited Operations** - Basic data entry tasks

## 🗄️ Database Schema

The system uses a comprehensive database schema with the following main tables:

- **users** - System user accounts and roles
- **customers** - Customer information and billing details
- **vendors** - Vendor/supplier information
- **invoices** & **invoice_line_items** - Invoice management
- **bills** & **bill_line_items** - Accounts payable
- **payments** & **payment_applications** - Payment tracking
- **chart_of_accounts** - Accounting structure
- **journal_entries** & **journal_entry_lines** - Manual entries
- **bank_accounts** - Bank account management
- **audit_log** - System activity tracking

## 🚀 Deployment

### Cloudflare Pages + Workers

1. **Build the frontend**:
```bash
npm run frontend:build
```

2. **Deploy to Cloudflare**:
```bash
# Deploy the Worker with frontend assets
npm run deploy
```

3. **Set up D1 database**:
```bash
# Run migrations on production database
npm run db:migrate:remote
```

4. **Configure environment variables** in Cloudflare dashboard

## 🧪 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - User logout

### Admin Management
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - List users (paginated)
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/audit-log` - View audit log

### Customers
- `GET /api/customers` - List customers (paginated)
- `POST /api/customers` - Create customer
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Invoices
- `GET /api/invoices` - List invoices (paginated)
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice details
- `PATCH /api/invoices/:id/status` - Update invoice status
- `DELETE /api/invoices/:id` - Delete invoice

## 🔧 Development Scripts

```bash
# Backend development
npm run dev                  # Start Hono development server
npm run build               # Build for production
npm run deploy              # Deploy to Cloudflare Workers

# Frontend development  
npm run frontend:dev        # Start React development server
npm run frontend:build      # Build React for production

# Database operations
npm run db:generate         # Generate new migration
npm run db:migrate:local    # Apply migrations locally
npm run db:migrate:remote   # Apply migrations to production

# Testing and linting
npm run test               # Run tests
npm run lint               # Lint code
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **[Hono Documentation](https://hono.dev/)**
- **[Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)**
- **[Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)**
- **[React Documentation](https://reactjs.org/docs/)**

## 🎯 Next Steps

This is a fully functional full-stack accounting system ready for customization and deployment. Key areas for enhancement:

- **Additional Reports** - More financial reports and analytics
- **File Uploads** - Invoice attachments and document management  
- **Email Integration** - Automated invoice sending
- **Multi-currency** - Foreign exchange support
- **Mobile App** - React Native mobile application
- **Advanced Permissions** - More granular role-based access
- **API Documentation** - OpenAPI/Swagger documentation

---

**Built with ❤️ using modern web technologies**