import type { Env, AuditAction } from '../types';

export class DatabaseUtils {
  static generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
  }

  static async executeQuery<T = any>(
    db: D1Database, 
    query: string, 
    params: any[] = []
  ): Promise<{ results: T[]; meta: any }> {
    try {
      const result = await db.prepare(query).bind(...params).all();
      return {
        results: result.results as T[],
        meta: result.meta
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('Database operation failed');
    }
  }

  static async executeQueryFirst<T = any>(
    db: D1Database, 
    query: string, 
    params: any[] = []
  ): Promise<T | null> {
    try {
      const result = await db.prepare(query).bind(...params).first();
      return result as T | null;
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('Database operation failed');
    }
  }

  static async insertRecord<T = any>(
    db: D1Database,
    table: string,
    data: Record<string, any>,
    returning: string[] = ['*']
  ): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING ${returning.join(', ')}
    `;

    try {
      const result = await db.prepare(query).bind(...values).first();
      return result as T;
    } catch (error) {
      console.error('Database insert error:', error);
      throw new Error('Failed to insert record');
    }
  }

  static async updateRecord<T = any>(
    db: D1Database,
    table: string,
    id: string,
    data: Record<string, any>,
    returning: string[] = ['*']
  ): Promise<T> {
    const updates = Object.keys(data);
    const values = Object.values(data);
    const setClause = updates.map(col => `${col} = ?`).join(', ');
    
    const query = `
      UPDATE ${table} 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING ${returning.join(', ')}
    `;

    try {
      const result = await db.prepare(query).bind(...values, id).first();
      if (!result) {
        throw new Error('Record not found');
      }
      return result as T;
    } catch (error) {
      console.error('Database update error:', error);
      throw new Error('Failed to update record');
    }
  }

  static async deleteRecord(
    db: D1Database,
    table: string,
    id: string
  ): Promise<boolean> {
    const query = `DELETE FROM ${table} WHERE id = ?`;
    
    try {
      const result = await db.prepare(query).bind(id).run();
      return result.changes > 0;
    } catch (error) {
      console.error('Database delete error:', error);
      throw new Error('Failed to delete record');
    }
  }

  static async logAudit(
    db: D1Database,
    tableName: string,
    recordId: string,
    action: AuditAction,
    userId: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    const auditData = {
      id: this.generateId('audit'),
      table_name: tableName,
      record_id: recordId,
      action,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      user_id: userId,
      timestamp: new Date().toISOString()
    };

    try {
      await this.insertRecord(db, 'audit_log', auditData);
    } catch (error) {
      // Log audit errors but don't fail the main operation
      console.error('Failed to log audit entry:', error);
    }
  }

  static async paginate<T = any>(
    db: D1Database,
    baseQuery: string,
    countQuery: string,
    params: any[] = [],
    page: number = 1,
    limit: number = 10
  ): Promise<{
    results: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await this.executeQueryFirst<{ count: number }>(
      db,
      countQuery,
      params
    );
    const total = countResult?.count || 0;
    
    // Get paginated results
    const paginatedQuery = `${baseQuery} LIMIT ? OFFSET ?`;
    const { results } = await this.executeQuery<T>(
      db,
      paginatedQuery,
      [...params, limit, offset]
    );

    return {
      results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async transaction<T>(
    db: D1Database,
    operations: (tx: D1Database) => Promise<T>
  ): Promise<T> {
    // D1 doesn't support explicit transactions yet, so we'll simulate it
    // In a real implementation, you'd use proper transaction handling
    try {
      return await operations(db);
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  static parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}