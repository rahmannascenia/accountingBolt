import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JWTPayload, UserRole } from '../types';

const DEFAULT_JWT_SECRET = 'your-default-jwt-secret-please-change-in-production';

export class AuthUtils {
  private static getJwtSecret(env?: { JWT_SECRET?: string }): string {
    return env?.JWT_SECRET || DEFAULT_JWT_SECRET;
  }

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  static generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, env?: { JWT_SECRET?: string }): string {
    const secret = this.getJwtSecret(env);
    return jwt.sign(payload, secret, {
      expiresIn: '7d', // Token expires in 7 days
      issuer: 'accounting-system'
    });
  }

  static verifyJWT(token: string, env?: { JWT_SECRET?: string }): JWTPayload | null {
    try {
      const secret = this.getJwtSecret(env);
      const decoded = jwt.verify(token, secret) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  static extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1];
  }

  static hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      user: 1,
      accountant: 2,
      manager: 3,
      admin: 4
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  static isAdmin(userRole: UserRole): boolean {
    return userRole === 'admin';
  }

  static canAccessAdminPanel(userRole: UserRole): boolean {
    return ['admin', 'manager'].includes(userRole);
  }
}