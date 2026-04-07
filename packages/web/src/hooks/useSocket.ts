import { useEffect, useRef, useCallback } from 'react';
import { getSocket, disconnectSocket } from '../services/api';
import type { Socket } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = getSocket();
    return () => {
      disconnectSocket();
      socketRef.current = null;
    };
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (...args: unknown[]) => void) => {
    if (handler) {
      socketRef.current?.off(event, handler);
    } else {
      socketRef.current?.off(event);
    }
  }, []);

  return { emit, on, off, socket: socketRef };
}
