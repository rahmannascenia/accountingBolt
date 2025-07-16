export interface Database {
  public: {
    Tables: {
      currencies: {
        Row: {
          id: string;
          code: string;
          name: string;
          symbol: string;
          is_base_currency: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: string;
          symbol: string;
          is_base_currency?: boolean;
        };
        Update: {
          code?: string;
          name?: string;
          symbol?: string;
          is_base_currency?: boolean;
        };
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          country: string;
          currency: string;
          customer_type: 'local' | 'foreign';
          payment_terms: number;
          tin_number: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          email: string;
          country: string;
          currency: string;
          customer_type: 'local' | 'foreign';
          payment_terms?: number;
          tin_number?: string;
        };
        Update: {
          name?: string;
          email?: string;
          country?: string;
          currency?: string;
          customer_type?: 'local' | 'foreign';
          payment_terms?: number;
          tin_number?: string;
          is_active?: boolean;
        };
      };
      bank_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          account_number: string;
          bank_name: string;
          currency: string;
          account_type: 'operational' | 'erq' | 'savings' | 'current';
          balance: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          account_number: string;
          bank_name: string;
          currency: string;
          account_type: 'operational' | 'erq' | 'savings' | 'current';
          balance?: number;
        };
        Update: {
          name?: string;
          account_number?: string;
          bank_name?: string;
          currency?: string;
          account_type?: 'operational' | 'erq' | 'savings' | 'current';
          balance?: number;
          is_active?: boolean;
        };
      };
      chart_of_accounts: {
        Row: {
          id: string;
          user_id: string;
          account_code: string;
          account_name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          parent_account_id: string | null;
          description: string | null;
          level: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          account_code: string;
          account_name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          parent_account_id?: string;
          description?: string;
          level?: number;
        };
        Update: {
          account_code?: string;
          account_name?: string;
          account_type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          parent_account_id?: string;
          description?: string;
          level?: number;
          is_active?: boolean;
        };
      };
      services: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          default_price: number;
          currency: string;
          category: string;
          is_recurring: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string;
          default_price: number;
          currency: string;
          category: string;
          is_recurring?: boolean;
        };
        Update: {
          name?: string;
          description?: string;
          default_price?: number;
          currency?: string;
          category?: string;
          is_recurring?: boolean;
          is_active?: boolean;
        };
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          invoice_number: string;
          customer_id: string;
          date: string;
          due_date: string;
          currency: string;
          subtotal: number;
          tax_amount: number;
          total_amount: number;
          bdt_amount: number | null;
          exchange_rate: number | null;
          exchange_rate_date: string | null;
          status: 'draft' | 'sent' | 'cancelled';
          invoice_type: 'custom' | 'recurring';
          parent_invoice_id: string | null;
          recurring_end_date: string | null;
          recurring_frequency: string | null;
          tds_rate: number | null;
          tds_amount: number | null;
          vds_rate: number | null;
          vds_amount: number | null;
          vat_rate: number | null;
          vat_amount: number | null;
          net_receivable: number | null;
          notes: string | null;
          journal_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          date: string;
          due_date: string;
          currency: string;
          subtotal: number;
          tax_amount?: number;
          total_amount: number;
          bdt_amount?: number;
          exchange_rate?: number;
          exchange_rate_date?: string;
          invoice_type?: 'custom' | 'recurring';
          parent_invoice_id?: string;
          recurring_end_date?: string;
          recurring_frequency?: string;
          tds_rate?: number;
          tds_amount?: number;
          vds_rate?: number;
          vds_amount?: number;
          vat_rate?: number;
          vat_amount?: number;
          net_receivable?: number;
          notes?: string;
        };
        Update: {
          customer_id?: string;
          date?: string;
          due_date?: string;
          currency?: string;
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          bdt_amount?: number;
          exchange_rate?: number;
          exchange_rate_date?: string;
          status?: 'draft' | 'sent' | 'cancelled';
          invoice_type?: 'custom' | 'recurring';
          parent_invoice_id?: string;
          recurring_end_date?: string;
          recurring_frequency?: string;
          tds_rate?: number;
          tds_amount?: number;
          vds_rate?: number;
          vds_amount?: number;
          vat_rate?: number;
          vat_amount?: number;
          net_receivable?: number;
          notes?: string;
          journal_entry_id?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          service_id: string | null;
          description: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          created_at: string;
        };
        Insert: {
          invoice_id: string;
          service_id?: string;
          description: string;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Update: {
          service_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
        };
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          payment_number: string;
          customer_id: string;
          bank_account_id: string;
          amount: number;
          currency: string;
          bdt_amount: number | null;
          exchange_rate: number | null;
          fx_calculation_method: 'foreign_to_bdt' | 'bdt_to_foreign';
          fx_rate_source: string;
          bdt_calculated_amount: number | null;
          payment_date: string;
          payment_method: 'swift' | 'bank_transfer' | 'cash' | 'check';
          status: 'pending' | 'cleared' | 'failed';
          swift_fee: number | null;
          bank_charges: number | null;
          discount_given: number | null;
          net_amount: number | null;
          reference: string | null;
          notes: string | null;
          journal_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          bank_account_id: string;
          amount: number;
          currency: string;
          bdt_amount?: number;
          exchange_rate?: number;
          fx_calculation_method?: 'foreign_to_bdt' | 'bdt_to_foreign';
          fx_rate_source?: string;
          bdt_calculated_amount?: number;
          payment_date: string;
          payment_method: 'swift' | 'bank_transfer' | 'cash' | 'check';
          swift_fee?: number;
          bank_charges?: number;
          discount_given?: number;
          net_amount?: number;
          reference?: string;
          notes?: string;
        };
        Update: {
          customer_id?: string;
          bank_account_id?: string;
          amount?: number;
          currency?: string;
          bdt_amount?: number;
          exchange_rate?: number;
          fx_calculation_method?: 'foreign_to_bdt' | 'bdt_to_foreign';
          fx_rate_source?: string;
          bdt_calculated_amount?: number;
          payment_date?: string;
          payment_method?: 'swift' | 'bank_transfer' | 'cash' | 'check';
          status?: 'pending' | 'cleared' | 'failed';
          swift_fee?: number;
          bank_charges?: number;
          discount_given?: number;
          net_amount?: number;
          reference?: string;
          notes?: string;
          journal_entry_id?: string;
        };
      };
      payment_allocations: {
        Row: {
          id: string;
          payment_id: string;
          invoice_id: string;
          allocated_amount: number;
          allocation_date: string;
          created_at: string;
        };
        Insert: {
          payment_id: string;
          invoice_id: string;
          allocated_amount: number;
          allocation_date: string;
        };
        Update: {
          allocated_amount?: number;
          allocation_date?: string;
        };
      };
      cash_incentives: {
        Row: {
          id: string;
          user_id: string;
          payment_id: string;
          customer_id: string;
          eligible_amount: number;
          incentive_rate: number;
          expected_incentive: number;
          actual_incentive: number | null;
          submission_deadline: string;
          status: 'pending' | 'documents_prepared' | 'submitted' | 'received' | 'expired' | 'rejected';
          documents_submitted: boolean;
          submission_date: string | null;
          received_date: string | null;
          notes: string | null;
          journal_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          payment_id: string;
          customer_id: string;
          eligible_amount: number;
          incentive_rate: number;
          expected_incentive: number;
          submission_deadline: string;
          actual_incentive?: number;
          submission_date?: string;
          received_date?: string;
          notes?: string;
        };
        Update: {
          eligible_amount?: number;
          incentive_rate?: number;
          expected_incentive?: number;
          actual_incentive?: number;
          submission_deadline?: string;
          status?: 'pending' | 'documents_prepared' | 'submitted' | 'received' | 'expired' | 'rejected';
          documents_submitted?: boolean;
          submission_date?: string;
          received_date?: string;
          notes?: string;
          journal_entry_id?: string;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_number: string;
          date: string;
          description: string;
          reference: string | null;
          total_debit: number;
          total_credit: number;
          status: 'draft' | 'posted';
          entry_type: string | null;
          source_id: string | null;
          source_document_type: string | null;
          source_document_id: string | null;
          is_auto_generated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          date: string;
          description: string;
          reference?: string;
          total_debit: number;
          total_credit: number;
          entry_type?: string;
          source_id?: string;
          source_document_type?: string;
          source_document_id?: string;
          is_auto_generated?: boolean;
        };
        Update: {
          date?: string;
          description?: string;
          reference?: string;
          total_debit?: number;
          total_credit?: number;
          status?: 'draft' | 'posted';
          entry_type?: string;
          source_id?: string;
          source_document_type?: string;
          source_document_id?: string;
          is_auto_generated?: boolean;
        };
      };
      journal_entry_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          account_code: string | null;
          account_name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          debit_amount: number;
          credit_amount: number;
          bdt_debit_amount: number;
          bdt_credit_amount: number;
          original_currency: string | null;
          original_amount: number | null;
          fx_rate: number | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          journal_entry_id: string;
          account_code?: string;
          account_name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          debit_amount?: number;
          credit_amount?: number;
          bdt_debit_amount?: number;
          bdt_credit_amount?: number;
          original_currency?: string;
          original_amount?: number;
          fx_rate?: number;
          description?: string;
        };
        Update: {
          account_code?: string;
          account_name?: string;
          account_type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          debit_amount?: number;
          credit_amount?: number;
          bdt_debit_amount?: number;
          bdt_credit_amount?: number;
          original_currency?: string;
          original_amount?: number;
          fx_rate?: number;
          description?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          expense_number: string;
          date: string;
          description: string;
          category: string;
          amount: number;
          currency: string;
          vendor: string | null;
          bank_account_id: string | null;
          payment_method: 'bank_transfer' | 'cash' | 'check' | 'online';
          vat_amount: number | null;
          is_recurring: boolean;
          recurring_frequency: string | null;
          status: 'pending' | 'paid' | 'cancelled';
          notes: string | null;
          journal_entry_id: string | null;
          exchange_rate: number | null;
          bdt_amount: number | null;
          fx_calculation_method: 'foreign_to_bdt' | 'bdt_to_foreign';
          fx_rate_source: string;
          bdt_calculated_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          date: string;
          description: string;
          category: string;
          amount: number;
          currency: string;
          vendor?: string;
          bank_account_id?: string;
          payment_method: 'bank_transfer' | 'cash' | 'check' | 'online';
          vat_amount?: number;
          is_recurring?: boolean;
          recurring_frequency?: string;
          notes?: string;
          exchange_rate?: number;
          bdt_amount?: number;
          fx_calculation_method?: 'foreign_to_bdt' | 'bdt_to_foreign';
          fx_rate_source?: string;
          bdt_calculated_amount?: number;
        };
        Update: {
          date?: string;
          description?: string;
          category?: string;
          amount?: number;
          currency?: string;
          vendor?: string;
          bank_account_id?: string;
          payment_method?: 'bank_transfer' | 'cash' | 'check' | 'online';
          vat_amount?: number;
          is_recurring?: boolean;
          recurring_frequency?: string;
          status?: 'pending' | 'paid' | 'cancelled';
          notes?: string;
          journal_entry_id?: string;
          exchange_rate?: number;
          bdt_amount?: number;
          fx_calculation_method?: 'foreign_to_bdt' | 'bdt_to_foreign';
          fx_rate_source?: string;
          bdt_calculated_amount?: number;
        };
      };
      fx_rates: {
        Row: {
          id: string;
          date: string;
          from_currency: string;
          to_currency: string;
          rate: number;
          source: string;
          created_by: string | null;
          created_at: string;
          modified_by: string | null;
          modified_at: string;
          is_active: boolean;
          notes: string | null;
        };
        Insert: {
          date: string;
          from_currency: string;
          to_currency: string;
          rate: number;
          source?: string;
          created_by?: string;
          modified_by?: string;
          is_active?: boolean;
          notes?: string;
        };
        Update: {
          date?: string;
          from_currency?: string;
          to_currency?: string;
          rate?: number;
          source?: string;
          created_by?: string;
          modified_by?: string;
          is_active?: boolean;
          notes?: string;
        };
      };
      bad_debt_adjustments: {
        Row: {
          id: string;
          invoice_id: string;
          customer_id: string;
          adjustment_date: string;
          original_amount: number;
          adjustment_amount: number;
          remaining_amount: number;
          currency: string;
          reason: string;
          status: 'pending' | 'posted';
          journal_entry_id: string | null;
          created_by: string | null;
          created_at: string;
          notes: string | null;
        };
        Insert: {
          invoice_id: string;
          customer_id: string;
          adjustment_date: string;
          original_amount: number;
          adjustment_amount: number;
          remaining_amount: number;
          currency: string;
          reason: string;
          status?: 'pending' | 'posted';
          journal_entry_id?: string;
          created_by?: string;
          notes?: string;
        };
        Update: {
          adjustment_date?: string;
          original_amount?: number;
          adjustment_amount?: number;
          remaining_amount?: number;
          currency?: string;
          reason?: string;
          status?: 'pending' | 'posted';
          journal_entry_id?: string;
          notes?: string;
        };
      };
      users: {
        Row: {
          id: string;
          auth_user_id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'accountant' | 'user' | 'viewer';
          permissions: Record<string, boolean>;
          is_active: boolean;
          last_login: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          email: string;
          full_name: string;
          role?: 'admin' | 'accountant' | 'user' | 'viewer';
          permissions?: Record<string, boolean>;
          is_active?: boolean;
          last_login?: string;
        };
        Update: {
          email?: string;
          full_name?: string;
          role?: 'admin' | 'accountant' | 'user' | 'viewer';
          permissions?: Record<string, boolean>;
          is_active?: boolean;
          last_login?: string;
        };
      };
      auto_journal_entries: {
        Row: {
          id: string;
          source_table: string;
          source_id: string;
          journal_entry_id: string | null;
          operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVERSE';
          is_reversal: boolean;
          original_entry_id: string | null;
          created_at: string;
        };
        Insert: {
          source_table: string;
          source_id: string;
          journal_entry_id?: string;
          operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVERSE';
          is_reversal?: boolean;
          original_entry_id?: string;
        };
        Update: {
          source_table?: string;
          source_id?: string;
          journal_entry_id?: string;
          operation_type?: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVERSE';
          is_reversal?: boolean;
          original_entry_id?: string;
        };
      };
      fx_rate_snapshots: {
        Row: {
          id: string;
          transaction_table: string;
          transaction_id: string;
          currency: string;
          rate: number;
          rate_date: string;
          snapshot_date: string;
        };
        Insert: {
          transaction_table: string;
          transaction_id: string;
          currency: string;
          rate: number;
          rate_date: string;
          snapshot_date?: string;
        };
        Update: {
          transaction_table?: string;
          transaction_id?: string;
          currency?: string;
          rate?: number;
          rate_date?: string;
          snapshot_date?: string;
        };
      };
      cash_incentive_workflow: {
        Row: {
          id: string;
          incentive_id: string;
          status: string;
          action_date: string;
          user_id: string | null;
          notes: string | null;
          document_url: string | null;
        };
        Insert: {
          incentive_id: string;
          status: string;
          action_date?: string;
          user_id?: string;
          notes?: string;
          document_url?: string;
        };
        Update: {
          status?: string;
          action_date?: string;
          user_id?: string;
          notes?: string;
          document_url?: string;
        };
      };
      user_activity: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          module: string;
          resource_type: string | null;
          resource_id: string | null;
          timestamp: string;
          ip_address: string | null;
          user_agent: string | null;
          session_id: string | null;
        };
        Insert: {
          user_id?: string;
          action: string;
          module: string;
          resource_type?: string;
          resource_id?: string;
          timestamp?: string;
          ip_address?: string;
          user_agent?: string;
          session_id?: string;
        };
        Update: {
          user_id?: string;
          action?: string;
          module?: string;
          resource_type?: string;
          resource_id?: string;
          timestamp?: string;
          ip_address?: string;
          user_agent?: string;
          session_id?: string;
        };
      };
      audit_trail: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'REVERSE';
          old_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
          user_id: string | null;
          user_email: string | null;
          timestamp: string;
          ip_address: string | null;
          user_agent: string | null;
          description: string | null;
          module: string | null;
          affected_journal_entry_id: string | null;
        };
        Insert: {
          table_name: string;
          record_id: string;
          operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'REVERSE';
          old_values?: any;
          new_values?: any;
          user_id?: string;
          user_email?: string;
          timestamp?: string;
          ip_address?: string;
          user_agent?: string;
          description?: string;
          module?: string;
          affected_journal_entry_id?: string;
        };
        Update: {
          table_name?: string;
          record_id?: string;
          operation_type?: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'REVERSE';
          old_values?: any;
          new_values?: any;
          user_id?: string;
          user_email?: string;
          timestamp?: string;
          ip_address?: string;
          user_agent?: string;
          description?: string;
          module?: string;
          affected_journal_entry_id?: string;
        };
      };
    };
    Functions: {
      get_fx_rate: {
        Args: {
          p_from_currency: string;
          p_to_currency?: string;
          p_date?: string;
        };
        Returns: number;
      };
      upsert_fx_rate: {
        Args: {
          p_from_currency: string;
          p_to_currency?: string;
          p_date?: string;
          p_rate: number;
          p_source?: string;
          p_notes?: string;
        };
        Returns: string;
      };
      log_audit_trail: {
        Args: {
          p_table_name: string;
          p_record_id: string;
          p_operation_type: string;
          p_old_values?: Record<string, unknown> | null;
          p_new_values?: Record<string, unknown> | null;
          p_description?: string;
          p_module?: string;
        };
        Returns: string;
      };
    };
  };
}