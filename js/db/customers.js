// db/customers.js — Customers, CallProtocols, Tags & Activities CRUD operations
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbCustomers = {
  // ====== CRM: Customers ======

  async getCustomers(filters = {}) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabaseClient
        .from('customers')
        .select('*, customer_tag_assignments(tag_id, customer_tags(name, color))')
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
      if (filters.search) {
        query = query.or(`company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }
      if (filters.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getCustomers', error);
      return { success: false, error: error.message || 'Fehler beim Laden der Kunden.' };
    }
  },

  async getCustomer(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('customers')
        .select('*, customer_tag_assignments(tag_id, customer_tags(name, color))')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.getCustomer', error);
      return { success: false, error: error.message || 'Fehler beim Laden des Kunden.' };
    }
  },

  async createCustomer(data) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!data.company_name) throw new Error('Firmenname ist erforderlich');

      const { data: customer, error } = await supabaseClient
        .from('customers')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: customer };
    } catch (error) {
      Logger.error('db.createCustomer', error);
      return { success: false, error: error.message || 'Fehler beim Erstellen.' };
    }
  },

  async updateCustomer(id, updates) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.updateCustomer', error);
      return { success: false, error: error.message || 'Fehler beim Aktualisieren.' };
    }
  },

  async deleteCustomer(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.deleteCustomer', error);
      return { success: false, error: error.message || 'Fehler beim Löschen.' };
    }
  },

  async convertLeadToCustomer(leadId) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if already converted
      const { data: existing } = await supabaseClient
        .from('customers')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (existing) return { success: true, data: existing, alreadyExists: true };

      // Get lead data
      const { data: lead, error: leadErr } = await supabaseClient
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadErr) throw leadErr;

      // Create customer from lead
      const { data: customer, error: custErr } = await supabaseClient
        .from('customers')
        .insert([{
          lead_id: lead.id,
          assigned_to: lead.assigned_to,
          organization_id: lead.organization_id,
          company_name: lead.company_name,
          contact_name: lead.contact_name,
          email: lead.email,
          phone: lead.phone,
          industry: lead.industry,
          notes: lead.notes,
          plan: 'starter',
          status: 'active'
        }])
        .select()
        .single();

      if (custErr) throw custErr;

      // Update lead status to won
      await supabaseClient
        .from('leads')
        .update({ status: 'won' })
        .eq('id', leadId);

      // Log activity
      await supabaseClient.from('customer_activities').insert([{
        customer_id: customer.id,
        actor_id: user.id,
        type: 'created',
        title: 'Kunde erstellt aus Lead',
        details: `Lead "${lead.company_name}" wurde konvertiert`
      }]);

      return { success: true, data: customer };
    } catch (error) {
      Logger.error('db.convertLeadToCustomer', error);
      return { success: false, error: error.message || 'Fehler bei der Konvertierung.' };
    }
  },

  // ====== CRM: Call Protocols ======

  async getCallProtocols(customerId) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('call_protocols')
        .select('*')
        .eq('customer_id', customerId)
        .order('called_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getCallProtocols', error);
      return { success: false, error: error.message || 'Fehler beim Laden.' };
    }
  },

  async createCallProtocol(data) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      data.caller_id = user.id;

      const { data: protocol, error } = await supabaseClient
        .from('call_protocols')
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      // Update customer last_contact_at
      await supabaseClient
        .from('customers')
        .update({ last_contact_at: data.called_at || new Date().toISOString() })
        .eq('id', data.customer_id);

      // Log activity
      const dirLabel = data.direction === 'inbound' ? 'Eingehender' : 'Ausgehender';
      await supabaseClient.from('customer_activities').insert([{
        customer_id: data.customer_id,
        actor_id: user.id,
        type: 'call',
        title: `${dirLabel} Anruf protokolliert`,
        details: data.notes || data.subject || ''
      }]);

      return { success: true, data: protocol };
    } catch (error) {
      Logger.error('db.createCallProtocol', error);
      return { success: false, error: error.message || 'Fehler beim Speichern.' };
    }
  },

  async deleteCallProtocol(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('call_protocols')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.deleteCallProtocol', error);
      return { success: false, error: error.message || 'Fehler beim Löschen.' };
    }
  },

  // ====== CRM: Customer Tags ======

  async getCustomerTags() {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('customer_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getCustomerTags', error);
      return { success: false, error: error.message || 'Fehler beim Laden.' };
    }
  },

  async createCustomerTag(name, color) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('customer_tags')
        .insert([{ name, color: color || '#7c3aed' }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.createCustomerTag', error);
      return { success: false, error: error.message || 'Fehler beim Erstellen.' };
    }
  },

  async assignCustomerTag(customerId, tagId) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('customer_tag_assignments')
        .insert([{ customer_id: customerId, tag_id: tagId }]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.assignCustomerTag', error);
      return { success: false, error: error.message || 'Fehler.' };
    }
  },

  async removeCustomerTag(customerId, tagId) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('customer_tag_assignments')
        .delete()
        .eq('customer_id', customerId)
        .eq('tag_id', tagId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.removeCustomerTag', error);
      return { success: false, error: error.message || 'Fehler.' };
    }
  },

  // ====== CRM: Customer Activities ======

  async getCustomerActivities(customerId, limit = 50) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('customer_activities')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getCustomerActivities', error);
      return { success: false, error: error.message || 'Fehler beim Laden.' };
    }
  },

  async logCustomerActivity(customerId, type, title, details) {
    try {
      const user = await auth.getUser();
      if (!user) return { success: false };

      await supabaseClient.from('customer_activities').insert([{
        customer_id: customerId,
        actor_id: user.id,
        type,
        title,
        details
      }]);
      return { success: true };
    } catch (error) {
      Logger.error('db.logCustomerActivity', error);
      return { success: false };
    }
  }
};
