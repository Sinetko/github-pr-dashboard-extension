import { vi } from 'vitest';

export interface FakeResponseInit {
  status?: number;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

type Responder = FakeResponseInit | ((request: RecordedRequest) => FakeResponseInit);

interface Route {
  method: string;
  matches: (url: URL) => boolean;
  responders: Responder[];
  sticky: boolean;
}

const toResponse = ({ status = 200, body, text, headers = {} }: FakeResponseInit): Response =>
  new Response(status === 304 || status === 204 ? null : (text ?? JSON.stringify(body ?? null)), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const installFetchFake = () => {
  const routes: Route[] = [];
  const requests: RecordedRequest[] = [];

  const fetchFake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    const rawBody = init?.body;
    const request: RecordedRequest = {
      method,
      url,
      headers: new Headers(init?.headers),
      body: typeof rawBody === 'string' ? (JSON.parse(rawBody) as unknown) : undefined,
    };
    requests.push(request);
    if (init?.signal?.aborted === true) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const route = routes.find(
      (candidate) =>
        candidate.method === method && candidate.matches(url) && candidate.responders.length > 0,
    );
    if (route === undefined) {
      throw new Error(`fetch-fake: no route for ${method} ${url.href}`);
    }
    const responder =
      route.sticky && route.responders.length === 1
        ? route.responders[0]
        : route.responders.shift();
    if (responder === undefined) {
      throw new Error(`fetch-fake: no responder for ${method} ${url.href}`);
    }
    return Promise.resolve(
      toResponse(typeof responder === 'function' ? responder(request) : responder),
    );
  });
  vi.stubGlobal('fetch', fetchFake);

  const on = (
    method: string,
    matcher: string | ((url: URL) => boolean),
    responders: Responder[],
    sticky = false,
  ): void => {
    const matches = typeof matcher === 'string' ? (url: URL) => url.pathname === matcher : matcher;
    routes.push({ method, matches, responders: [...responders], sticky });
  };

  return {
    fetch: fetchFake,
    requests,
    get: (matcher: string | ((url: URL) => boolean), ...responders: Responder[]) => {
      on('GET', matcher, responders);
    },
    post: (matcher: string | ((url: URL) => boolean), ...responders: Responder[]) => {
      on('POST', matcher, responders);
    },
    always: (
      method: 'GET' | 'POST',
      matcher: string | ((url: URL) => boolean),
      responder: Responder,
    ) => {
      on(method, matcher, [responder], true);
    },
  };
};

export type FetchFake = ReturnType<typeof installFetchFake>;
