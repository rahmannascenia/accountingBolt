module.exports = {
  apps: [
    {
      name: 'finansys-dev',
      script: 'npx',
      args: 'vite --host',
      cwd: '/home/user/webapp',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5173,
        HOST: '0.0.0.0'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'finansys-preview',
      script: 'npx',
      args: 'vite preview --host --port 4173',
      cwd: '/home/user/webapp',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4173,
        HOST: '0.0.0.0'
      },
      error_file: './logs/preview-err.log',
      out_file: './logs/preview-out.log',
      log_file: './logs/preview-combined.log',
      time: true
    },
    {
      name: 'finansys-build',
      script: 'npm',
      args: 'run build',
      cwd: '/home/user/webapp',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'your-git-repository.git',
      path: '/var/www/finansys',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    },
    staging: {
      user: 'deploy',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'your-git-repository.git',
      path: '/var/www/finansys-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging'
    }
  }
};