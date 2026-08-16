import type { ApiClient } from './apiTypes';
import { realApi } from './api';
import { mockApi } from './mock';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export const api: ApiClient = useMock ? mockApi : realApi;
