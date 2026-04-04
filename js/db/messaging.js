// db/messaging.js — Availability, Conversations, Messages & Contact Form operations
// Depends on: supabase-init.js (supabaseClient), auth.js (auth), logger.js (Logger)
const dbMessaging = {
  // ====== Availability ======

  async getAvailability(userId, startDate, endDate) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabaseClient
        .from('availability')
        .select('*, profiles!availability_user_id_fkey(first_name, last_name)')
        .order('date', { ascending: true });

      if (userId) query = query.eq('user_id', userId);
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getAvailability', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async setAvailability(availabilityData) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('availability')
        .insert([{ user_id: user.id, ...availabilityData }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.setAvailability', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async deleteAvailability(id) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.deleteAvailability', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  // ====== Messaging / Chat ======

  async getConversations() {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('conversations')
        .select('*, conversation_participants(user_id, profiles(first_name, last_name, role)), messages(content, created_at, sender_id)')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getConversations', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async getMessages(conversationId, limit = 100) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('messages')
        .select('*, profiles!messages_sender_id_fkey(first_name, last_name, role)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      Logger.error('db.getMessages', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async createConversation(participantIds, subject, type = 'direct') {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: conv, error: convError } = await supabaseClient
        .from('conversations')
        .insert([{ created_by: user.id, subject, type }])
        .select()
        .single();

      if (convError) throw convError;

      const allParticipants = [...new Set([user.id, ...participantIds])];
      const { error: partError } = await supabaseClient
        .from('conversation_participants')
        .insert(allParticipants.map(uid => ({
          conversation_id: conv.id,
          user_id: uid
        })));

      if (partError) throw partError;
      return { success: true, data: conv };
    } catch (error) {
      Logger.error('db.createConversation', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async sendMessage(conversationId, content) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseClient
        .from('messages')
        .insert([{ conversation_id: conversationId, sender_id: user.id, content }])
        .select()
        .single();

      if (error) throw error;

      // Update conversation timestamp
      await supabaseClient
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return { success: true, data };
    } catch (error) {
      Logger.error('db.sendMessage', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  async markConversationRead(conversationId) {
    try {
      const user = await auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabaseClient
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      Logger.error('db.markConversationRead', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  },

  // ====== Contact Form -> Lead ======

  async submitContactForm(formData) {
    try {
      // Validate required fields
      if (!formData.name || formData.name.trim().length < 2) throw new Error('Name is required');
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) throw new Error('Valid email is required');

      // Client-side rate limit
      const lastSubmit = parseInt(sessionStorage.getItem('lastContactSubmit') || '0');
      if (Date.now() - lastSubmit < 30000) throw new Error('Please wait before submitting again');
      sessionStorage.setItem('lastContactSubmit', Date.now().toString());

      // Save as lead (no auth required for public form)
      const { data, error } = await supabaseClient
        .from('leads')
        .insert([{
          company_name: formData.company || formData.name || 'Unbekannt',
          contact_name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          source: 'website',
          notes: formData.message || '',
          status: 'new'
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      Logger.error('db.submitContactForm', error);
      return { success: false, error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
    }
  }
};
