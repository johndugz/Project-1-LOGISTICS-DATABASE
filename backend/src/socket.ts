import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken } from './utils/auth';
import { UserRole } from './models/types';

export interface AdminActivityNotification {
  type: 'new_user' | 'booking_created' | 'transit_event_added' | 'transit_event_updated';
  message: string;
  createdAt: string;
  shipmentId?: string;
}

export interface OperationsActivityNotification {
  type: 'booking_created' | 'transit_event_added' | 'transit_event_updated';
  message: string;
  createdAt: string;
  shipmentId?: string;
}

let io: SocketServer | null = null;

export function initializeSocket(server: HttpServer): SocketServer {
  const corsOrigin = process.env.CORS_ORIGIN || true;

  io = new SocketServer(server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) || '';

    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const decoded = verifyToken(token);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { role?: UserRole } | undefined;

    if (user?.role === UserRole.ADMIN) {
      socket.join('admins');
      socket.join('operations');
    }

    if (user?.role === UserRole.OPERATOR) {
      socket.join('operations');
    }
  });

  return io;
}

export function emitPendingApprovalsUpdate(): void {
  if (!io) return;
  io.to('admins').emit('pending-approvals-updated');
}

export function emitAdminActivityNotification(notification: AdminActivityNotification): void {
  if (!io) return;
  io.to('admins').emit('admin-activity-notification', notification);
}

export function emitOperationsActivityNotification(notification: OperationsActivityNotification): void {
  if (!io) return;
  io.to('operations').emit('operations-activity-notification', notification);
}
