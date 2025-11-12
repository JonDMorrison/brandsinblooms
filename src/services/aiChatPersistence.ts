import { supabase } from '@/integrations/supabase/client';

export interface Session {
  id: string;
  title: string | null;
  contextType: string | null;
  contextId: string | null;
  messageCount: number;
  imageCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface MessageData {
  id: string;
  sessionId: string;
  messageType: 'user_prompt' | 'thinking_text' | 'assistant_response' | 'images';
  content: string;
  sequenceNumber: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface GeneratedImageData {
  id: string;
  sessionId: string;
  messageId: string;
  globalImageId: string;
  imageUrl: string;
  userPrompt: string;
  enhancedPrompt: string | null;
  generationOrder: number;
  isSelected: boolean;
}

export interface MessageWithSession extends MessageData {
  session: {
    id: string;
    title: string | null;
    contextType: string | null;
    channel: string | null;
    createdAt: string;
  };
}

// Type-safe wrappers for new tables
type AnyTable = any;

export class AIChatPersistenceService {
  /**
   * Find or create a session for the given context
   */
  static async findOrCreateSession(params: {
    contextType?: string;
    contextId?: string;
    channel?: string;
  }): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('User not authenticated');

    const { data: userProfile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userData.user.id)
      .single();

    if (!userProfile) throw new Error('User profile not found');

    // Try to find existing session for this context
    let query = supabase
      .from('ai_assistant_sessions' as AnyTable)
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('context_type', params.contextType || 'general')
      .order('last_activity_at', { ascending: false })
      .limit(1);
    
    // Handle context_id properly - use .is() for null, .eq() for values
    if (params.contextId) {
      query = query.eq('context_id', params.contextId);
    } else {
      query = query.is('context_id', null);
    }
    
    const { data: existingSession } = await query.maybeSingle();

    if (existingSession) {
      return (existingSession as any).id;
    }

    // Create new session
    const { data: newSession, error } = await supabase
      .from('ai_assistant_sessions' as AnyTable)
      .insert({
        user_id: userData.user.id,
        tenant_id: userProfile.tenant_id,
        context_type: params.contextType || 'general',
        context_id: params.contextId || null,
        channel: params.channel || 'newsletter'
      })
      .select('id')
      .single();

    if (error) throw error;
    return (newSession as any).id;
  }

  /**
   * Load the most recent N messages from a session (for infinite scroll)
   */
  static async loadMessages(
    sessionId: string,
    limit: number = 15,
    beforeSequence?: number
  ): Promise<MessageData[]> {
    let query = supabase
      .from('ai_assistant_messages' as AnyTable)
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: false })
      .limit(limit);

    if (beforeSequence !== undefined) {
      query = query.lt('sequence_number', beforeSequence);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Reverse to get chronological order (oldest to newest)
    return (data || []).reverse().map((msg: any) => ({
      id: msg.id,
      sessionId: msg.session_id,
      messageType: msg.message_type as any,
      content: msg.content,
      sequenceNumber: msg.sequence_number,
      metadata: msg.metadata || {},
      createdAt: msg.created_at
    }));
  }

  /**
   * Load recent messages from ALL user sessions (for global chat history)
   */
  static async loadGlobalMessages(
    limit: number = 15,
    beforeTimestamp?: string
  ): Promise<MessageWithSession[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('User not authenticated');

    // Query messages with session info joined
    let query = supabase
      .from('ai_assistant_messages' as AnyTable)
      .select(`
        *,
        ai_assistant_sessions!inner(
          id,
          title,
          context_type,
          channel,
          created_at,
          user_id
        )
      `)
      .eq('ai_assistant_sessions.user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (beforeTimestamp) {
      query = query.lt('created_at', beforeTimestamp);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Reverse to get chronological order and map to interface
    return (data || []).reverse().map((msg: any) => ({
      id: msg.id,
      sessionId: msg.session_id,
      messageType: msg.message_type as any,
      content: msg.content,
      sequenceNumber: msg.sequence_number,
      metadata: msg.metadata || {},
      createdAt: msg.created_at,
      session: {
        id: msg.ai_assistant_sessions.id,
        title: msg.ai_assistant_sessions.title,
        contextType: msg.ai_assistant_sessions.context_type,
        channel: msg.ai_assistant_sessions.channel,
        createdAt: msg.ai_assistant_sessions.created_at
      }
    }));
  }

  /**
   * Load images associated with a message
   */
  static async loadImagesForMessage(messageId: string): Promise<GeneratedImageData[]> {
    console.log('📸 Loading images for message:', messageId);
    
    const { data, error } = await supabase
      .from('ai_assistant_generated_images' as AnyTable)
      .select(`
        *,
        global_image_gallery!inner(public_url)
      `)
      .eq('message_id', messageId)
      .order('generation_order', { ascending: true });

    if (error) {
      console.error('❌ Error loading images:', error);
      throw error;
    }

    console.log('✅ Loaded images from database:', {
      count: data?.length || 0,
      imageData: data?.map((img: any) => ({
        id: img.id,
        globalImageId: img.global_image_id,
        hasGalleryData: !!img.global_image_gallery,
        publicUrl: img.global_image_gallery?.public_url
      }))
    });

    return (data || []).map((img: any) => ({
      id: img.id,
      sessionId: img.session_id,
      messageId: img.message_id,
      globalImageId: img.global_image_id,
      imageUrl: (img.global_image_gallery as any).public_url,
      userPrompt: img.user_prompt,
      enhancedPrompt: img.enhanced_prompt,
      generationOrder: img.generation_order,
      isSelected: img.is_selected
    }));
  }

  /**
   * Save a new message to the session
   */
  static async saveMessage(params: {
    sessionId: string;
    messageType: 'user_prompt' | 'thinking_text' | 'assistant_response' | 'images';
    content: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    // Get the next sequence number
    const { data: lastMessage } = await supabase
      .from('ai_assistant_messages' as AnyTable)
      .select('sequence_number')
      .eq('session_id', params.sessionId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = ((lastMessage as any)?.sequence_number || 0) + 1;

    const { data, error } = await supabase
      .from('ai_assistant_messages' as AnyTable)
      .insert({
        session_id: params.sessionId,
        message_type: params.messageType,
        content: params.content,
        sequence_number: nextSequence,
        metadata: params.metadata || {}
      } as AnyTable)
      .select('id')
      .single();

    if (error) throw error;
    return (data as any).id;
  }

  /**
   * Save generated images for a message
   */
  static async saveGeneratedImages(params: {
    sessionId: string;
    messageId: string;
    userPrompt: string;
    enhancedPrompt: string;
    images: Array<{
      globalImageId: string;
      order: number;
    }>;
  }): Promise<void> {
    const inserts = params.images.map(img => ({
      session_id: params.sessionId,
      message_id: params.messageId,
      global_image_id: img.globalImageId,
      user_prompt: params.userPrompt,
      enhanced_prompt: params.enhancedPrompt,
      generation_order: img.order
    }));

    const { error } = await supabase
      .from('ai_assistant_generated_images' as AnyTable)
      .insert(inserts as AnyTable);

    if (error) throw error;
  }

  /**
   * Mark an image as selected by the user
   */
  static async markImageSelected(params: {
    imageRecordId: string;
    usedInContext: string;
    usedInId: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('ai_assistant_generated_images' as AnyTable)
      .update({
        is_selected: true,
        selected_at: new Date().toISOString(),
        used_in_context: params.usedInContext,
        used_in_id: params.usedInId
      } as AnyTable)
      .eq('id', params.imageRecordId);

    if (error) throw error;
  }
}
