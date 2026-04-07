import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { chatConversations, chatMessages } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();

// GET /companies/:companyId/conversations - list conversations
router.get('/companies/:companyId/conversations', (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const conversations = db.select().from(chatConversations)
      .where(eq(chatConversations.companyId, companyId))
      .orderBy(desc(chatConversations.createdAt))
      .all();

    // Add last message preview and message count
    const enriched = conversations.map((conv) => {
      const lastMessage = db.select().from(chatMessages)
        .where(eq(chatMessages.conversationId, conv.id))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1)
        .get();

      const countResult = db.select({ count: sql<number>`COUNT(*)` })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conv.id))
        .get();

      return {
        ...conv,
        lastMessage: lastMessage?.content?.slice(0, 100) || null,
        messageCount: countResult?.count || 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[chat] list conversations error:', err);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// POST /companies/:companyId/conversations - create conversation
router.post('/companies/:companyId/conversations', (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { type, targetId, name } = req.body;

    const id = nanoid();
    const now = new Date().toISOString();

    db.insert(chatConversations).values({
      id,
      companyId,
      type: type || 'agent',
      targetId: targetId || '',
      name: name || '',
      createdAt: now,
    }).run();

    const conv = db.select().from(chatConversations).where(eq(chatConversations.id, id)).get();
    res.status(201).json(conv);
  } catch (err) {
    console.error('[chat] create conversation error:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /conversations/:convId/messages - get messages with pagination
router.get('/conversations/:convId/messages', (req: Request, res: Response) => {
  try {
    const { convId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, convId))
      .orderBy(chatMessages.createdAt)
      .limit(limit)
      .offset(offset)
      .all();

    const countResult = db.select({ count: sql<number>`COUNT(*)` })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, convId))
      .get();

    res.json({
      messages,
      total: countResult?.count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[chat] get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// POST /conversations/:convId/messages - send a message (REST fallback)
router.post('/conversations/:convId/messages', async (req: Request, res: Response) => {
  try {
    const { convId } = req.params;
    const { senderType, senderId, content, metadata } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Verify conversation exists
    const conv = db.select().from(chatConversations).where(eq(chatConversations.id, convId)).get();
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const id = nanoid();
    const now = new Date().toISOString();

    db.insert(chatMessages).values({
      id,
      conversationId: convId,
      senderType: senderType || 'user',
      senderId: senderId || '',
      content,
      metadata: metadata || {},
      createdAt: now,
    }).run();

    const message = db.select().from(chatMessages).where(eq(chatMessages.id, id)).get();
    res.status(201).json(message);
  } catch (err) {
    console.error('[chat] send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
