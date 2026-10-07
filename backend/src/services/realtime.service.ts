import { Server as SocketIOServer, Socket } from 'socket.io';

export class RealtimeService {
  private io: SocketIOServer | null = null;

  public init(ioServer: SocketIOServer): void {
    this.io = ioServer;

    this.io.on('connection', (socket: Socket) => {
      // Room for authenticated organization events
      socket.on('join:org', (orgId: string) => {
        if (orgId) {
          const room = `org:${orgId}`;
          socket.join(room);
        }
      });

      // Room for unauthenticated public status page live updates
      socket.on('join:status', (slug: string) => {
        if (slug) {
          const room = `status:${slug}`;
          socket.join(room);
        }
      });

      socket.on('leave:org', (orgId: string) => {
        if (orgId) {
          socket.leave(`org:${orgId}`);
        }
      });

      socket.on('leave:status', (slug: string) => {
        if (slug) {
          socket.leave(`status:${slug}`);
        }
      });
    });
  }

  public emitIncidentCreated(organizationId: string, incident: any): void {
    if (!this.io) return;
    this.io.to(`org:${organizationId}`).emit('incident:created', incident);
  }

  public emitIncidentUpdated(organizationId: string, incident: any): void {
    if (!this.io) return;
    this.io.to(`org:${organizationId}`).emit('incident:updated', incident);
  }

  public emitIncidentResolved(organizationId: string, incident: any): void {
    if (!this.io) return;
    this.io.to(`org:${organizationId}`).emit('incident:resolved', incident);
  }

  public emitNotificationSent(organizationId: string, notification: any): void {
    if (!this.io) return;
    this.io.to(`org:${organizationId}`).emit('notification:new', notification);
  }

  public emitServiceUpdated(organizationId: string, service: any, orgSlug?: string): void {
    if (!this.io) return;
    this.io.to(`org:${organizationId}`).emit('service:updated', service);
    if (orgSlug) {
      this.io.to(`status:${orgSlug}`).emit('status:service:updated', {
        serviceId: service._id,
        name: service.name,
        currentStatus: service.currentStatus,
        uptimePercentage: service.uptimePercentage,
      });
    }
  }

  public emitPublicStatusChanged(orgSlug: string, payload: any): void {
    if (!this.io) return;
    this.io.to(`status:${orgSlug}`).emit('status:update', payload);
  }
}

export const realtimeService = new RealtimeService();
