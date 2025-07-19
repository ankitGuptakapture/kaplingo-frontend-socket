import { io, Socket } from 'socket.io-client';


export type EventCallback = (...args: any[]) => void;

export class WebSocketService {
  private socket: Socket | null = null;


  connect(url: string, options?: Record<string, any>) {
    if (!this.socket) {
      this.socket = io(url, options);
    }
  }

 
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }


  on(event: string, callback: EventCallback) {
    this.socket?.on(event, callback);
  }


  off(event: string, callback?: EventCallback) {
    this.socket?.off(event, callback);
  }


  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }
}

export const webSocketService = new WebSocketService();
