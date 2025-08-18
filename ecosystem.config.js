export default {
  apps: [
    {
      name: 'hono-api',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 8787
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true
    },
    {
      name: 'react-frontend',
      script: 'npm',
      args: 'run frontend:dev',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 5173
      },
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
}