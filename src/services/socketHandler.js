import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ENV } from '../config/environment.js';
import User from '../models/User.js';
import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';

let ioInstance = null;

export const initSocket = (io) => {
  ioInstance = io;

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const token = auth.token;

      if (token) {
        try {
          const decoded = jwt.verify(token, ENV.JWT_SECRET);
          const user = await User.findById(decoded.id).select('name email role avatar isSuspended isBanned isActive');
          if (user && !user.isBanned && !user.isSuspended && user.isActive) {
            socket.user = user;
            socket.isStaff = ['super_admin', 'admin', 'manager', 'support_agent'].includes(user.role);
          }
        } catch (jwtErr) {
          // Token invalid/expired - continue as unauthenticated guest
        }
      }

      if (!socket.user) {
        socket.guestSessionId = auth.guestSessionId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        socket.guestToken = auth.guestToken || null;
        socket.isStaff = false;
      }

      next();
    } catch (err) {
      console.error('Socket auth middleware error:', err);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // If staff member, auto-join staff channel for queue updates
    if (socket.isStaff) {
      socket.join('staff:support');
    }

    // Customer joins own user room
    if (socket.user) {
      socket.join(`user:${socket.user._id}`);
    }

    // Join Conversation Room
    socket.on('join_conversation', async ({ conversationId, guestToken }, callback) => {
      try {
        const conversation = await ChatConversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ success: false, message: 'Conversation not found' });
          return;
        }

        // Authorization check: Staff, conversation owner, or verified guest
        let authorized = false;
        if (socket.isStaff) {
          authorized = true;
        } else if (socket.user && conversation.customer && conversation.customer.toString() === socket.user._id.toString()) {
          authorized = true;
        } else if (conversation.isGuest) {
          const tokenToCheck = guestToken || socket.guestToken;
          if (tokenToCheck) {
            const hash = crypto.createHash('sha256').update(tokenToCheck).digest('hex');
            if (hash === conversation.guestInfo?.tokenHash) {
              authorized = true;
            }
          }
        }

        if (!authorized) {
          if (callback) callback({ success: false, message: 'Unauthorized to join this conversation' });
          return;
        }

        socket.join(`conversation:${conversationId}`);

        // Update online presence
        if (!socket.isStaff) {
          conversation.isCustomerOnline = true;
          conversation.lastCustomerSeenAt = new Date();
          await conversation.save();
          io.to(`conversation:${conversationId}`).emit('customer_presence', {
            conversationId,
            isOnline: true,
          });
        }

        if (callback) callback({ success: true, conversationId });
      } catch (err) {
        console.error('Error joining conversation room:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Leave Conversation Room
    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Real-Time Message Dispatch
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, message, attachments = [], isInternalNote = false, guestToken } = data;
        if (!message || !message.trim()) {
          if (callback) callback({ success: false, message: 'Message content cannot be blank' });
          return;
        }

        const conversation = await ChatConversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ success: false, message: 'Conversation not found' });
          return;
        }

        // Authorization
        let senderType = 'customer';
        let senderName = socket.user?.name || conversation.guestInfo?.name || 'Customer';
        let senderId = socket.user?._id || null;

        if (socket.isStaff) {
          senderType = 'agent';
          senderName = socket.user?.name || 'Support Specialist';
        } else if (conversation.isGuest) {
          senderType = 'guest';
        }

        // Internal notes strictly staff-only
        const actualInternalNote = socket.isStaff ? Boolean(isInternalNote) : false;

        const newMsg = await ChatMessage.create({
          conversation: conversation._id,
          sender: senderId,
          senderType,
          senderName,
          message: message.trim(),
          attachments: Array.isArray(attachments) ? attachments : [],
          isInternalNote: actualInternalNote,
          messageType: actualInternalNote ? 'note' : attachments.length > 0 ? 'attachment' : 'text',
        });

        // Update conversation summary
        if (!actualInternalNote) {
          conversation.lastMessage = {
            text: message.trim(),
            senderRole: senderType,
            timestamp: new Date(),
          };
          conversation.lastActivityAt = new Date();

          if (senderType === 'agent') {
            conversation.unreadCustomerCount = (conversation.unreadCustomerCount || 0) + 1;
            if (conversation.status === 'waiting_agent') {
              conversation.status = 'active';
            }
          } else {
            conversation.unreadStaffCount = (conversation.unreadStaffCount || 0) + 1;
          }
          await conversation.save();
        }

        // Broadcast: If internal note, send ONLY to staff in room or staff channel
        if (actualInternalNote) {
          // Emit only to staff
          io.to('staff:support').emit('new_internal_note', {
            conversationId,
            message: newMsg,
          });
        } else {
          // Public message to room participants
          io.to(`conversation:${conversationId}`).emit('new_message', {
            conversationId,
            message: newMsg,
          });

          // Queue update for all staff dashboard subscribers
          io.to('staff:support').emit('conversation_updated', {
            conversationId,
            lastMessage: conversation.lastMessage,
            status: conversation.status,
            unreadStaffCount: conversation.unreadStaffCount,
          });
        }

        if (callback) callback({ success: true, message: newMsg });
      } catch (err) {
        console.error('Socket send_message error:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Typing Indicators
    socket.on('typing_start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        userName: socket.user?.name || 'Visitor',
        isStaff: socket.isStaff,
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
        conversationId,
        userName: socket.user?.name || 'Visitor',
      });
    });

    // Read Receipt Marking
    socket.on('mark_read', async ({ conversationId }) => {
      try {
        const conversation = await ChatConversation.findById(conversationId);
        if (conversation) {
          if (socket.isStaff) {
            conversation.unreadStaffCount = 0;
            await ChatMessage.updateMany(
              { conversation: conversation._id, isReadByStaff: false },
              { $set: { isReadByStaff: true } }
            );
          } else {
            conversation.unreadCustomerCount = 0;
            await ChatMessage.updateMany(
              { conversation: conversation._id, isReadByCustomer: false },
              { $set: { isReadByCustomer: true } }
            );
          }
          await conversation.save();
          socket.to(`conversation:${conversationId}`).emit('messages_read', { conversationId });
        }
      } catch (err) {
        console.error('Socket mark_read error:', err);
      }
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      // Clean up presence if applicable
    });
  });
};

export const getIO = () => {
  return ioInstance;
};
