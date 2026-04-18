import { mock } from 'bun:test';

mock.module('cloudflare:email', () => ({
  EmailMessage: class EmailMessage {
    constructor(
      public from: string,
      public to: string,
      public raw: string,
    ) {}
  },
}));
