import { TestBed } from '@angular/core/testing';
import { io } from 'socket.io-client';
import { LIVE_SOCKET_FACTORY } from './live-socket';

// The real client would open a connection: fake the library, an external system.
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ fake: 'socket' })) }));

describe('LIVE_SOCKET_FACTORY (default)', () => {
  it('creates the /live socket on the API path, backing off from 1 s to 30 s, without connecting yet', async () => {
    const socket = await TestBed.inject(LIVE_SOCKET_FACTORY)();
    expect(socket).toEqual({ fake: 'socket' });
    expect(io).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledWith(
      '/live',
      expect.objectContaining({
        path: '/api/socket.io',
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        autoConnect: false,
      }),
    );
  });
});
